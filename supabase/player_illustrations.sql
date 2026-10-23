-- Galerie de récompenses persistante par compte joueur.
-- À exécuter après player_accounts.sql et player_progress.sql.

create table if not exists player_illustrations (
  id bigint generated always as identity primary key,
  player_id uuid not null references players(id) on delete cascade,
  illustration_path text not null,
  episode_id text,
  node_id text,
  acquired_at timestamptz not null default now(),
  unique (player_id, illustration_path)
);

create index if not exists player_illustrations_player_idx
  on player_illustrations (player_id, acquired_at desc);

alter table player_illustrations enable row level security;

drop policy if exists "Un joueur lit ses illustrations" on player_illustrations;
create policy "Un joueur lit ses illustrations" on player_illustrations
  for select using (auth.uid() = player_id);

revoke insert, update, delete on player_illustrations from anon, authenticated;

create or replace function public.game_unlock_illustration(
  p_path text,
  p_episode_id text default null,
  p_node_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_player uuid := public.game_current_player();
  v_row player_illustrations;
begin
  if p_path is null or length(trim(p_path)) = 0 or length(p_path) > 1000 then
    raise exception 'ILLUSTRATION_INVALIDE : chemin absent ou trop long.' using errcode = '22023';
  end if;

  insert into player_illustrations (player_id, illustration_path, episode_id, node_id)
  values (
    v_player,
    trim(p_path),
    left(nullif(trim(p_episode_id), ''), 80),
    left(nullif(trim(p_node_id), ''), 120)
  )
  on conflict (player_id, illustration_path) do update set
    episode_id = coalesce(player_illustrations.episode_id, excluded.episode_id),
    node_id = coalesce(player_illustrations.node_id, excluded.node_id)
  returning * into v_row;

  return jsonb_build_object(
    'path', v_row.illustration_path,
    'episodeId', v_row.episode_id,
    'nodeId', v_row.node_id,
    'acquiredAt', v_row.acquired_at
  );
end $$;

create or replace function public.game_list_illustrations()
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
      'path', illustration_path,
      'episodeId', episode_id,
      'nodeId', node_id,
      'acquiredAt', acquired_at
    ) order by acquired_at desc)
    from player_illustrations
    where player_id = v_player
  ), '[]'::jsonb);
end $$;

revoke all on function public.game_unlock_illustration(text, text, text) from public, anon;
revoke all on function public.game_list_illustrations() from public, anon;
grant execute on function public.game_unlock_illustration(text, text, text) to authenticated;
grant execute on function public.game_list_illustrations() to authenticated;