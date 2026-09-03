-- Schéma Supabase (Postgres) pour Otome-game
-- À exécuter dans l'éditeur SQL du projet Supabase (Database > SQL Editor).

-- ============================================================
-- 1. CONTENU DU JEU (édité via l'admin, lu par le jeu)
-- ============================================================

create table if not exists characters (
  id text primary key,               -- ex: "isaac", "leonie"
  is_player boolean not null default false,
  is_secondary boolean not null default false, -- pas de route romantique
  data jsonb not null,                -- fiche complète (nom, description, jauges par défaut, portraits, etc.)
  updated_at timestamptz not null default now()
);

create table if not exists episodes (
  id text primary key,                -- ex: "episode1"
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  data jsonb not null,                 -- structure complète { start, gaugeSummary, nodes }
  updated_at timestamptz not null default now()
);
-- Le jeu ne lit que les lignes status = 'published'.
-- L'admin peut éditer un brouillon (draft) puis le publier sans toucher au code.

create table if not exists shop_items (
  id text primary key,
  slot text not null,                 -- haut / bas / coiffure / accessoire / chaussures
  label text not null,
  price integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2. JOUEURS ET PROGRESSION
-- ============================================================

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  pseudo text not null unique,
  access_code text not null,          -- code simple type "1234-ABCD", pas un vrai mot de passe
  created_at timestamptz not null default now()
);

create table if not exists player_saves (
  player_id uuid primary key references players(id) on delete cascade,
  player_name text not null default 'Sucrette',
  current_episode text references episodes(id),
  current_node text,
  current_background text,
  currency integer not null default 0,
  inventory jsonb not null default '[]'::jsonb,
  action_points integer not null default 25,
  last_action_points_at timestamptz not null default now(),
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists player_gauges (
  player_id uuid references players(id) on delete cascade,
  character_id text references characters(id),
  amitie integer not null default 0,
  amour integer not null default 0,
  primary key (player_id, character_id)
);

-- ============================================================
-- 3. SÉCURITÉ (Row Level Security)
-- ============================================================
-- Le contenu du jeu (characters, episodes publiés, shop_items) est lisible par tous.
-- Les données joueurs ne sont accessibles qu'au joueur concerné (via son id).
-- L'écriture sur characters/episodes/shop_items est réservée à l'admin (clé service_role, jamais exposée au front public).

alter table characters enable row level security;
alter table episodes enable row level security;
alter table shop_items enable row level security;
alter table players enable row level security;
alter table player_saves enable row level security;
alter table player_gauges enable row level security;

create policy "Lecture publique des personnages" on characters
  for select using (true);

create policy "Lecture publique des épisodes publiés" on episodes
  for select using (status = 'published');

create policy "Lecture publique de la boutique" on shop_items
  for select using (true);

-- Un joueur peut créer son propre compte et lire/modifier ses propres données.
create policy "Création de compte joueur" on players
  for insert with check (true);

create policy "Un joueur lit sa propre fiche" on players
  for select using (true); -- nécessaire pour vérifier pseudo/code au login

create policy "Un joueur gère sa propre sauvegarde" on player_saves
  for all using (true) with check (true);

create policy "Un joueur gère ses propres jauges" on player_gauges
  for all using (true) with check (true);

-- Note: ces policies sont volontairement permissives pour un MVP sans vrai système d'auth.
-- Étape suivante recommandée: brancher Supabase Auth (email/magic link) pour remplacer
-- le couple pseudo/access_code par de vrais comptes, et restreindre les policies avec auth.uid().
