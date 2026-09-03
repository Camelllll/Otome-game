-- À exécuter APRÈS les fichiers SQL précédents dans le SQL Editor Supabase.
-- Bibliothèque de médias (décors, illustrations, musiques) uploadés depuis l'admin,
-- stockés dans le bucket Storage "media" et référencés ici pour les lister facilement.

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('backgrounds', 'illustrations', 'music')),
  path text not null,
  label text not null,
  created_at timestamptz not null default now()
);

alter table media_assets enable row level security;

create policy "Lecture publique des médias" on media_assets
  for select using (true);

create policy "Admin autorisé gère les médias" on media_assets
  for all using (is_admin()) with check (is_admin());

-- Storage : mêmes règles sur le bucket "media" (à créer manuellement dans Storage si pas déjà fait).
create policy "Lecture publique du bucket media" on storage.objects
  for select using (bucket_id = 'media');

create policy "Admin autorisé écrit dans le bucket media" on storage.objects
  for all using (bucket_id = 'media' and is_admin()) with check (bucket_id = 'media' and is_admin());
