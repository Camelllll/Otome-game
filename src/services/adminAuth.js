// Authentification admin (Supabase Auth) — comptes limités à une liste blanche (table
// admin_users, voir supabase/admin_allowlist.sql). N'importe quel compte joueur peut
// s'authentifier via Supabase Auth, mais seul un compte de la liste blanche a les droits d'écriture.
import { supabase } from "./supabaseClient.js";

export async function connexionAdmin(email, motDePasse) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
  if (error) throw error;
  if (!(await estAdmin())) {
    await supabase.auth.signOut();
    throw new Error("Ce compte n'a pas les droits d'accès au studio.");
  }
  return data.user;
}

// Vérifie que l'utilisateur connecté fait partie de la liste blanche des admins.
export async function estAdmin() {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) throw error;
  return Boolean(data);
}

export async function obtenirSessionAdmin() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) return null;
  if (!(await estAdmin())) {
    await supabase.auth.signOut();
    return null;
  }
  return data.session;
}

export async function deconnexionAdmin() {
  await supabase.auth.signOut();
}
