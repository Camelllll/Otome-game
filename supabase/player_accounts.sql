-- À exécuter APRÈS schema.sql et admin_auth_policies.sql dans le SQL Editor Supabase.
-- Bascule les comptes joueurs sur Supabase Auth (email + mot de passe) au lieu du couple
-- pseudo/access_code, et ajoute le suivi des épisodes terminés pour verrouiller/griser
-- l'écran de sélection d'épisode.

-- players.id devient l'id de l'utilisateur Supabase Auth (auth.users.id), fourni par l'app
-- au moment de l'inscription — plus de génération automatique ni de code d'accès.
alter table players alter column id drop default;
alter table players drop column if exists access_code;
alter table players alter column pseudo drop not null;
alter table players drop constraint if exists players_pseudo_key;

alter table player_saves add column if not exists completed_episodes jsonb not null default '[]'::jsonb;

-- Anciennes policies permissives, remplacées par des policies basées sur auth.uid().
drop policy if exists "Création de compte joueur" on players;
drop policy if exists "Un joueur lit sa propre fiche" on players;
drop policy if exists "Un joueur gère sa propre sauvegarde" on player_saves;
drop policy if exists "Un joueur gère ses propres jauges" on player_gauges;

create policy "Un joueur crée sa propre fiche" on players
  for insert with check (auth.uid() = id);

create policy "Un joueur lit/modifie sa propre fiche" on players
  for select using (auth.uid() = id);

create policy "Un joueur met à jour sa propre fiche" on players
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Un joueur gère sa propre sauvegarde" on player_saves
  for all using (auth.uid() = player_id) with check (auth.uid() = player_id);

create policy "Un joueur gère ses propres jauges" on player_gauges
  for all using (auth.uid() = player_id) with check (auth.uid() = player_id);
