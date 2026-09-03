-- À exécuter APRÈS schema.sql dans le SQL Editor Supabase.
-- Remplace l'accès "clé secrète" (bloqué par Supabase dans un navigateur) par un vrai compte
-- admin authentifié : n'importe quel utilisateur connecté (via Supabase Auth) peut gérer le contenu.
-- Étape manuelle requise : Authentication > Users > Add user (email + mot de passe), à utiliser
-- pour te connecter dans admin.html.

create policy "Admin authentifié gère les personnages" on characters
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Admin authentifié gère les épisodes" on episodes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Admin authentifié gère la boutique" on shop_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
