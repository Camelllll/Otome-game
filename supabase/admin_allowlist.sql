-- À exécuter APRÈS les fichiers SQL précédents dans le SQL Editor Supabase.
-- Corrige un problème de sécurité : actuellement, n'importe quel compte joueur (créé
-- depuis le jeu) peut aussi se connecter et modifier le contenu depuis admin.html,
-- car les policies admin autorisaient "n'importe quel utilisateur authentifié".
-- On restreint désormais l'accès en écriture à une liste blanche d'admins.

create table if not exists admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table admin_users enable row level security;
-- Aucune policy définie ici volontairement : la table n'est lisible/modifiable par
-- personne depuis le client (même pas les admins). Gère-la uniquement via le SQL Editor.

-- Fonction utilitaire : indique si l'utilisateur connecté est admin, sans exposer la liste
-- complète des admins au client (security definer = bypass RLS en interne uniquement).
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

grant execute on function is_admin() to authenticated;

-- Remplace les anciennes policies "tout utilisateur authentifié" par "admin de la liste blanche".
drop policy if exists "Admin authentifié gère les personnages" on characters;
drop policy if exists "Admin authentifié gère les épisodes" on episodes;
drop policy if exists "Admin authentifié gère la boutique" on shop_items;

create policy "Admin autorisé gère les personnages" on characters
  for all using (is_admin()) with check (is_admin());

create policy "Admin autorisé gère les épisodes" on episodes
  for all using (is_admin()) with check (is_admin());

create policy "Admin autorisé gère la boutique" on shop_items
  for all using (is_admin()) with check (is_admin());

-- Ajoute ton compte admin à la liste blanche (remplace l'email par le tien) :
insert into admin_users (user_id)
select id from auth.users where email = 'TON_EMAIL_ADMIN_ICI'
on conflict do nothing;
