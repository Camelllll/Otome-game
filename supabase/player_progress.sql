-- ============================================================
-- SAUVEGARDE SERVEUR DE LA PROGRESSION (multi-appareils, multi-slots)
-- À exécuter APRÈS schema.sql, admin_auth_policies.sql et player_accounts.sql.
-- Idempotent : peut être rejoué sans perte de données.
--
-- Principe : le client n'écrit JAMAIS directement dans les tables de progression.
-- Toutes les écritures passent par des fonctions RPC "security definer" qui valident
-- les données (bornage des jauges, régénération des PA calculée côté serveur, tailles
-- maximales des tableaux). Le joueur ne peut donc pas se donner 100 % d'amour ou des PA
-- infinis en modifiant le localStorage ou en appelant l'API depuis la console.
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABLES
-- ------------------------------------------------------------

-- player_saves passe d'une ligne unique par joueur à une ligne par emplacement (slot) :
--   slot 0 = sauvegarde principale (autosave), slots 1..3 = emplacements manuels.
alter table player_saves add column if not exists id uuid not null default gen_random_uuid();
alter table player_saves add column if not exists slot smallint not null default 0;
alter table player_saves add column if not exists label text;
alter table player_saves add column if not exists gauges jsonb not null default '{}'::jsonb;
alter table player_saves add column if not exists flags jsonb not null default '[]'::jsonb;
alter table player_saves add column if not exists choices jsonb not null default '[]'::jsonb;
alter table player_saves add column if not exists stats jsonb not null default '{}'::jsonb;
alter table player_saves add column if not exists completed_episodes jsonb not null default '[]'::jsonb;
alter table player_saves add column if not exists revision bigint not null default 0;
alter table player_saves add column if not exists created_at timestamptz not null default now();
alter table player_saves add column if not exists updated_at timestamptz not null default now();

-- current_episode ne doit plus dépendre de la table episodes : une sauvegarde reste valide
-- même si un épisode est renommé ou dépublié côté admin (la contrainte est retrouvée par son
-- contenu, son nom pouvant varier selon l'historique du projet).
do $$
declare
  v_nom text;
begin
  for v_nom in
    select conname from pg_constraint
    where conrelid = 'player_saves'::regclass
      and contype = 'f'
      and confrelid = 'episodes'::regclass
  loop
    execute format('alter table player_saves drop constraint %I', v_nom);
  end loop;
end $$;

-- L'ancienne clé primaire portait sur player_id : elle empêcherait plusieurs emplacements.
do $$
declare
  v_nom text;
begin
  select conname into v_nom from pg_constraint
  where conrelid = 'player_saves'::regclass and contype = 'p';

  if v_nom = 'player_saves_pkey_id' then
    return; -- migration déjà appliquée
  end if;

  if v_nom is not null then
    execute format('alter table player_saves drop constraint %I', v_nom);
  end if;

  alter table player_saves add constraint player_saves_pkey_id primary key (id);
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_saves_player_slot_key' and conrelid = 'player_saves'::regclass
  ) then
    alter table player_saves add constraint player_saves_player_slot_key unique (player_id, slot);
  end if;
end $$;

alter table player_saves drop constraint if exists player_saves_slot_check;
alter table player_saves add constraint player_saves_slot_check check (slot between 0 and 9);

-- Reprise des jauges historiques (table player_gauges) dans la colonne jsonb du slot 0.
update player_saves s
set gauges = coalesce((
  select jsonb_object_agg(g.character_id, jsonb_build_object('amitie', g.amitie, 'amour', g.amour))
  from player_gauges g
  where g.player_id = s.player_id
), '{}'::jsonb)
where s.slot = 0 and s.gauges = '{}'::jsonb;

-- Journal des choix importants : sert d'historique auditable côté serveur
-- (le tableau `choices` de la sauvegarde n'en garde que les derniers pour le moteur).
create table if not exists player_choices (
  id bigint generated always as identity primary key,
  player_id uuid not null references players(id) on delete cascade,
  slot smallint not null default 0,
  episode_id text,
  node_id text,
  option_index smallint,
  option_label text,
  flags jsonb not null default '[]'::jsonb,
  effects jsonb not null default '{}'::jsonb,
  chosen_at timestamptz not null default now()
);

create index if not exists player_choices_player_idx on player_choices (player_id, slot, chosen_at desc);
create index if not exists player_saves_player_idx on player_saves (player_id, slot);

-- ------------------------------------------------------------
-- 2. SÉCURITÉ : lecture seule pour le joueur, écriture via RPC uniquement
-- ------------------------------------------------------------

alter table player_choices enable row level security;

drop policy if exists "Un joueur gère sa propre sauvegarde" on player_saves;
drop policy if exists "Un joueur gère ses propres jauges" on player_gauges;
drop policy if exists "Un joueur lit ses sauvegardes" on player_saves;
drop policy if exists "Un joueur lit ses jauges" on player_gauges;
drop policy if exists "Un joueur lit ses choix" on player_choices;

create policy "Un joueur lit ses sauvegardes" on player_saves
  for select using (auth.uid() = player_id);

create policy "Un joueur lit ses jauges" on player_gauges
  for select using (auth.uid() = player_id);

create policy "Un joueur lit ses choix" on player_choices
  for select using (auth.uid() = player_id);

revoke insert, update, delete on player_saves from anon, authenticated;
revoke insert, update, delete on player_gauges from anon, authenticated;
revoke insert, update, delete on player_choices from anon, authenticated;

-- ------------------------------------------------------------
-- 3. RÈGLES DE JEU CÔTÉ SERVEUR
-- ------------------------------------------------------------

create or replace function public.game_rules()
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'gaugeMin', -100,
    'gaugeMax', 100,
    'gaugeMaxDelta', 50,       -- progression maximale d'une jauge en une seule sauvegarde
    'paMax', 25,
    'paRegenSeconds', 300,
    'currencyMax', 1000000,
    'maxHistory', 2000,
    'maxChoices', 500,
    'maxFlags', 500,
    'maxInventory', 200,
    'maxCharacters', 200
  );
$$;

-- Tronque un tableau jsonb en ne gardant que ses N derniers éléments.
create or replace function public.game_trim_array(p_arr jsonb, p_max int)
returns jsonb language sql immutable as $$
  select case
    when p_arr is null or jsonb_typeof(p_arr) <> 'array' then '[]'::jsonb
    when jsonb_array_length(p_arr) <= p_max then p_arr
    else coalesce((
      select jsonb_agg(e order by ord)
      from (
        select e, ord
        from jsonb_array_elements(p_arr) with ordinality as t(e, ord)
        order by ord
        offset greatest(jsonb_array_length(p_arr) - p_max, 0)
      ) as garde
    ), '[]'::jsonb)
  end;
$$;

-- Valide les lovomètres : entiers bornés -100..100, progression limitée par rapport aux
-- valeurs déjà enregistrées, nombre de personnages plafonné.
create or replace function public.game_sanitize_gauges(p_new jsonb, p_old jsonb)
returns jsonb
language plpgsql
immutable as $$
declare
  v_rules jsonb := public.game_rules();
  v_min int := (v_rules->>'gaugeMin')::int;
  v_max int := (v_rules->>'gaugeMax')::int;
  v_delta int := (v_rules->>'gaugeMaxDelta')::int;
  v_max_chars int := (v_rules->>'maxCharacters')::int;
  v_old jsonb := coalesce(p_old, '{}'::jsonb);
  v_result jsonb := '{}'::jsonb;
  v_personnage text;
  v_jauge text;
  v_valeur numeric;
  v_precedent int;
  v_borne int;
  v_fiche jsonb;
  v_compte int := 0;
begin
  if p_new is null or jsonb_typeof(p_new) <> 'object' then
    return v_old;
  end if;

  for v_personnage in select k from jsonb_object_keys(p_new) as k loop
    exit when v_compte >= v_max_chars;
    v_compte := v_compte + 1;

    if jsonb_typeof(p_new -> v_personnage) <> 'object' then
      continue;
    end if;

    v_fiche := '{}'::jsonb;
    for v_jauge in select k from jsonb_object_keys(p_new -> v_personnage) as k loop
      if jsonb_typeof(p_new -> v_personnage -> v_jauge) <> 'number' then
        continue;
      end if;
      v_valeur := (p_new -> v_personnage ->> v_jauge)::numeric;
      -- Valeur de référence : uniquement si l'ancienne donnée est bien numérique.
      if jsonb_typeof(v_old -> v_personnage -> v_jauge) = 'number' then
        v_precedent := round((v_old -> v_personnage ->> v_jauge)::numeric)::int;
      else
        v_precedent := 0;
      end if;
      -- Plafond : la valeur envoyée ne peut pas dépasser l'ancienne de plus de v_delta.
      v_borne := least(v_max, v_precedent + v_delta);
      v_fiche := v_fiche || jsonb_build_object(
        v_jauge,
        greatest(v_min, least(v_borne, round(v_valeur)::int))
      );
    end loop;

    if v_fiche <> '{}'::jsonb then
      v_result := v_result || jsonb_build_object(v_personnage, v_fiche);
    end if;
  end loop;

  -- Les personnages absents du payload conservent leurs jauges : un client buggé
  -- ou tronqué ne doit jamais effacer une relation déjà acquise.
  return v_old || v_result;
end $$;

-- Sérialise une ligne de sauvegarde vers le format attendu par le client (camelCase).
create or replace function public.game_save_to_json(s player_saves)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'playerId', s.player_id,
    'slot', s.slot,
    'label', s.label,
    'playerName', s.player_name,
    'currentEpisode', s.current_episode,
    'currentNode', s.current_node,
    'currentBackground', s.current_background,
    'gauges', s.gauges,
    'flags', s.flags,
    'choices', s.choices,
    'stats', s.stats,
    'currency', s.currency,
    'inventory', s.inventory,
    'actionPoints', s.action_points,
    'lastActionPointsTimestamp', (extract(epoch from s.last_action_points_at) * 1000)::bigint,
    'history', s.history,
    'completedEpisodes', s.completed_episodes,
    'revision', s.revision,
    'updatedAt', s.updated_at
  );
$$;

create or replace function public.game_default_save(p_player_id uuid, p_slot smallint, p_player_name text)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'playerId', p_player_id,
    'slot', p_slot,
    'label', null,
    'playerName', coalesce(nullif(trim(p_player_name), ''), 'Sucrette'),
    'currentEpisode', 'episode1',
    'currentNode', null,
    'currentBackground', null,
    'gauges', '{}'::jsonb,
    'flags', '[]'::jsonb,
    'choices', '[]'::jsonb,
    'stats', '{}'::jsonb,
    'currency', 0,
    'inventory', '[]'::jsonb,
    'actionPoints', (public.game_rules()->>'paMax')::int,
    'lastActionPointsTimestamp', (extract(epoch from now()) * 1000)::bigint,
    'history', '[]'::jsonb,
    'completedEpisodes', '[]'::jsonb,
    'revision', 0,
    'updatedAt', null
  );
$$;

-- Garantit l'existence de la fiche joueur (une session Auth valide suffit).
create or replace function public.game_current_player()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := auth.uid();
begin
  if v_id is null then
    raise exception 'AUTH_REQUISE : aucune session joueur active.' using errcode = '28000';
  end if;
  insert into players (id) values (v_id) on conflict (id) do nothing;
  return v_id;
end $$;

-- ------------------------------------------------------------
-- 4. API DE SAUVEGARDE / CHARGEMENT
-- ------------------------------------------------------------

-- Charge un emplacement ; renvoie une sauvegarde par défaut (non persistée) s'il est vide.
create or replace function public.game_load_save(p_slot smallint default 0)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_player uuid := public.game_current_player();
  v_slot smallint := greatest(0, least(9, coalesce(p_slot, 0)));
  v_row player_saves;
  v_pseudo text;
begin
  select * into v_row from player_saves where player_id = v_player and slot = v_slot;
  if not found then
    select pseudo into v_pseudo from players where id = v_player;
    return public.game_default_save(v_player, v_slot, v_pseudo);
  end if;
  return public.game_save_to_json(v_row);
end $$;

-- Résumé de tous les emplacements du joueur (pour un futur écran "Charger une partie").
create or replace function public.game_list_saves()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_player uuid := public.game_current_player();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'slot', s.slot,
      'label', s.label,
      'playerName', s.player_name,
      'currentEpisode', s.current_episode,
      'currentNode', s.current_node,
      'completedEpisodes', s.completed_episodes,
      'revision', s.revision,
      'updatedAt', s.updated_at
    ) order by s.slot)
    from player_saves s
    where s.player_id = v_player
  ), '[]'::jsonb);
end $$;

-- Écrit la progression après validation serveur. Renvoie la sauvegarde telle qu'enregistrée :
-- le client doit adopter cette réponse comme source de vérité.
create or replace function public.game_save_progress(p_payload jsonb, p_slot smallint default 0)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_player uuid := public.game_current_player();
  v_slot smallint := greatest(0, least(9, coalesce(p_slot, 0)));
  v_rules jsonb := public.game_rules();
  v_pa_max int := (v_rules->>'paMax')::int;
  v_regen int := (v_rules->>'paRegenSeconds')::int;
  v_ancien player_saves;
  v_row player_saves;
  v_pa_gagnes int;
  v_pa_autorise int;
  v_pa int;
  v_pa_horodatage timestamptz;
  v_nom text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'PAYLOAD_INVALIDE : un objet de sauvegarde est attendu.' using errcode = '22023';
  end if;

  select * into v_ancien from player_saves where player_id = v_player and slot = v_slot;

  -- Points d'action : la régénération est recalculée par le serveur. Le client peut
  -- en dépenser, jamais en gagner au-delà du temps réellement écoulé.
  if v_ancien.player_id is null then
    v_pa_gagnes := 0;
    v_pa_autorise := v_pa_max;
    v_pa_horodatage := now();
  else
    v_pa_gagnes := floor(extract(epoch from now() - v_ancien.last_action_points_at) / v_regen)::int;
    v_pa_autorise := least(v_pa_max, v_ancien.action_points + v_pa_gagnes);
    v_pa_horodatage := v_ancien.last_action_points_at + (v_pa_gagnes * make_interval(secs => v_regen));
  end if;
  v_pa := greatest(0, least(v_pa_autorise, coalesce((p_payload->>'actionPoints')::int, v_pa_autorise)));
  -- Jauge pleine : le compteur de régénération repart de maintenant.
  if v_pa >= v_pa_max then
    v_pa_horodatage := now();
  end if;

  v_nom := left(coalesce(nullif(trim(p_payload->>'playerName'), ''), coalesce(v_ancien.player_name, 'Sucrette')), 40);

  insert into player_saves as ps (
    player_id, slot, label, player_name, current_episode, current_node, current_background,
    gauges, flags, choices, stats, currency, inventory,
    action_points, last_action_points_at, history, completed_episodes, revision, updated_at
  )
  values (
    v_player,
    v_slot,
    left(nullif(trim(coalesce(p_payload->>'label', '')), ''), 60),
    v_nom,
    left(nullif(p_payload->>'currentEpisode', ''), 80),
    left(nullif(p_payload->>'currentNode', ''), 120),
    left(nullif(p_payload->>'currentBackground', ''), 300),
    public.game_sanitize_gauges(p_payload->'gauges', coalesce(v_ancien.gauges, '{}'::jsonb)),
    public.game_trim_array(p_payload->'flags', (v_rules->>'maxFlags')::int),
    public.game_trim_array(p_payload->'choices', (v_rules->>'maxChoices')::int),
    case when jsonb_typeof(p_payload->'stats') = 'object' then p_payload->'stats' else '{}'::jsonb end,
    greatest(0, least((v_rules->>'currencyMax')::int, coalesce((p_payload->>'currency')::int, 0))),
    public.game_trim_array(p_payload->'inventory', (v_rules->>'maxInventory')::int),
    v_pa,
    v_pa_horodatage,
    public.game_trim_array(p_payload->'history', (v_rules->>'maxHistory')::int),
    public.game_trim_array(p_payload->'completedEpisodes', 200),
    1,
    now()
  )
  on conflict (player_id, slot) do update set
    label = coalesce(excluded.label, ps.label),
    player_name = excluded.player_name,
    current_episode = coalesce(excluded.current_episode, ps.current_episode),
    current_node = excluded.current_node,
    current_background = coalesce(excluded.current_background, ps.current_background),
    gauges = excluded.gauges,
    flags = excluded.flags,
    choices = excluded.choices,
    stats = excluded.stats,
    currency = excluded.currency,
    inventory = excluded.inventory,
    action_points = excluded.action_points,
    last_action_points_at = excluded.last_action_points_at,
    history = excluded.history,
    completed_episodes = excluded.completed_episodes,
    revision = ps.revision + 1,
    updated_at = now()
  returning * into v_row;

  -- Miroir des lovomètres dans player_gauges (requêtes analytiques / back-office).
  insert into player_gauges (player_id, character_id, amitie, amour)
  select v_player, k, coalesce((v.value->>'amitie')::int, 0), coalesce((v.value->>'amour')::int, 0)
  from jsonb_each(v_row.gauges) as v(k, value)
  where v_slot = 0 and exists (select 1 from characters c where c.id = v.k)
  on conflict (player_id, character_id) do update
    set amitie = excluded.amitie, amour = excluded.amour;

  return public.game_save_to_json(v_row);
end $$;

-- Enregistre un choix important (journal serveur) et le renvoie normalisé.
create or replace function public.game_record_choice(
  p_episode_id text,
  p_node_id text,
  p_option_index smallint,
  p_option_label text default null,
  p_flags jsonb default '[]'::jsonb,
  p_effects jsonb default '{}'::jsonb,
  p_slot smallint default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_player uuid := public.game_current_player();
  v_slot smallint := greatest(0, least(9, coalesce(p_slot, 0)));
  v_id bigint;
begin
  insert into player_choices (player_id, slot, episode_id, node_id, option_index, option_label, flags, effects)
  values (
    v_player,
    v_slot,
    left(nullif(p_episode_id, ''), 80),
    left(nullif(p_node_id, ''), 120),
    p_option_index,
    left(nullif(p_option_label, ''), 300),
    case when jsonb_typeof(p_flags) = 'array' then p_flags else '[]'::jsonb end,
    case when jsonb_typeof(p_effects) = 'object' then p_effects else '{}'::jsonb end
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'episodeId', p_episode_id, 'nodeId', p_node_id, 'optionIndex', p_option_index);
end $$;

-- Historique complet des choix (utile pour un futur écran "Mes décisions").
create or replace function public.game_list_choices(p_slot smallint default 0, p_limit int default 200)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_player uuid := public.game_current_player();
  v_slot smallint := greatest(0, least(9, coalesce(p_slot, 0)));
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'episodeId', c.episode_id,
      'nodeId', c.node_id,
      'optionIndex', c.option_index,
      'optionLabel', c.option_label,
      'flags', c.flags,
      'effects', c.effects,
      'chosenAt', c.chosen_at
    ) order by c.chosen_at desc)
    from (
      select * from player_choices
      where player_id = v_player and slot = v_slot
      order by chosen_at desc
      limit greatest(1, least(1000, coalesce(p_limit, 200)))
    ) c
  ), '[]'::jsonb);
end $$;

-- Nouvelle partie : vide l'emplacement (et son journal de choix) puis renvoie une sauvegarde neuve.
create or replace function public.game_reset_save(p_slot smallint default 0, p_player_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_player uuid := public.game_current_player();
  v_slot smallint := greatest(0, least(9, coalesce(p_slot, 0)));
begin
  delete from player_saves where player_id = v_player and slot = v_slot;
  delete from player_choices where player_id = v_player and slot = v_slot;
  if v_slot = 0 then
    delete from player_gauges where player_id = v_player;
  end if;
  return public.game_default_save(v_player, v_slot, p_player_name);
end $$;

-- Copie une sauvegarde vers un autre emplacement (base des slots manuels 1..3).
create or replace function public.game_copy_save(p_source smallint, p_cible smallint, p_label text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_player uuid := public.game_current_player();
  v_source smallint := greatest(0, least(9, coalesce(p_source, 0)));
  v_cible smallint := greatest(0, least(9, coalesce(p_cible, 1)));
  v_row player_saves;
begin
  if v_source = v_cible then
    raise exception 'SLOT_INVALIDE : la source et la cible doivent différer.' using errcode = '22023';
  end if;

  select * into v_row from player_saves where player_id = v_player and slot = v_source;
  if not found then
    raise exception 'SAUVEGARDE_INTROUVABLE : emplacement % vide.', v_source using errcode = 'P0002';
  end if;

  insert into player_saves as ps (
    player_id, slot, label, player_name, current_episode, current_node, current_background,
    gauges, flags, choices, stats, currency, inventory,
    action_points, last_action_points_at, history, completed_episodes, revision, updated_at
  )
  values (
    v_player, v_cible, left(nullif(trim(coalesce(p_label, '')), ''), 60), v_row.player_name,
    v_row.current_episode, v_row.current_node, v_row.current_background,
    v_row.gauges, v_row.flags, v_row.choices, v_row.stats, v_row.currency, v_row.inventory,
    v_row.action_points, v_row.last_action_points_at, v_row.history, v_row.completed_episodes, 1, now()
  )
  on conflict (player_id, slot) do update set
    label = coalesce(excluded.label, ps.label),
    player_name = excluded.player_name,
    current_episode = excluded.current_episode,
    current_node = excluded.current_node,
    current_background = excluded.current_background,
    gauges = excluded.gauges,
    flags = excluded.flags,
    choices = excluded.choices,
    stats = excluded.stats,
    currency = excluded.currency,
    inventory = excluded.inventory,
    action_points = excluded.action_points,
    last_action_points_at = excluded.last_action_points_at,
    history = excluded.history,
    completed_episodes = excluded.completed_episodes,
    revision = ps.revision + 1,
    updated_at = now()
  returning * into v_row;

  return public.game_save_to_json(v_row);
end $$;

-- ------------------------------------------------------------
-- 5. DROITS D'EXÉCUTION
-- ------------------------------------------------------------

revoke all on function public.game_load_save(smallint) from public, anon;
revoke all on function public.game_list_saves() from public, anon;
revoke all on function public.game_save_progress(jsonb, smallint) from public, anon;
revoke all on function public.game_record_choice(text, text, smallint, text, jsonb, jsonb, smallint) from public, anon;
revoke all on function public.game_list_choices(smallint, int) from public, anon;
revoke all on function public.game_reset_save(smallint, text) from public, anon;
revoke all on function public.game_copy_save(smallint, smallint, text) from public, anon;

grant execute on function public.game_load_save(smallint) to authenticated;
grant execute on function public.game_list_saves() to authenticated;
grant execute on function public.game_save_progress(jsonb, smallint) to authenticated;
grant execute on function public.game_record_choice(text, text, smallint, text, jsonb, jsonb, smallint) to authenticated;
grant execute on function public.game_list_choices(smallint, int) to authenticated;
grant execute on function public.game_reset_save(smallint, text) to authenticated;
grant execute on function public.game_copy_save(smallint, smallint, text) to authenticated;
