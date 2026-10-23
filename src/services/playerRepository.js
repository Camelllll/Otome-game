// Comptes joueurs via Supabase Auth (email + mot de passe) et persistance de la progression
// (player_saves + player_gauges) dans Supabase.
import { supabase } from "./supabaseClient.js";

// Crée un compte (email + mot de passe) et sa fiche joueur associée.
export async function creerCompteJoueur(email, motDePasse, pseudo) {
  const { data, error } = await supabase.auth.signUp({ email, password: motDePasse });
  if (error) throw error;
  if (!data.session) {
    // La confirmation par e-mail est activée côté Supabase : à désactiver pour l'instant
    // (Authentication > Providers > Email > "Confirm email").
    throw new Error("Compte créé, mais la confirmation par e-mail est requise pour l'instant.");
  }
  const { error: erreurFiche } = await supabase
    .from("players")
    .upsert({ id: data.user.id, pseudo: pseudo.trim() || null });
  if (erreurFiche) throw erreurFiche;
  return { id: data.user.id, pseudo: pseudo.trim() || email };
}

export async function connexionJoueur(email, motDePasse) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
  if (error) throw error;
  return obtenirFicheJoueur(data.user.id, data.user.email);
}

// Retrouve le joueur déjà connecté (session Supabase Auth persistée), ou null si personne n'est connecté.
export async function obtenirSessionJoueur() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) return null;
  return obtenirFicheJoueur(data.session.user.id, data.session.user.email);
}

export async function deconnecterJoueur() {
  await supabase.auth.signOut();
}

// Retrouve la fiche joueur ; la crée si elle manque (ex. compte Auth existant sans ligne "players",
// sinon les écritures de sauvegarde échouent avec une violation de clé étrangère).
async function obtenirFicheJoueur(userId, email) {
  const { data: joueur, error } = await supabase.from("players").select("id, pseudo").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (joueur) return joueur;

  const { error: erreurCreation } = await supabase.from("players").upsert({ id: userId, pseudo: email });
  if (erreurCreation) throw erreurCreation;
  return { id: userId, pseudo: email };
}

// Emplacements de sauvegarde : 0 = sauvegarde principale (autosave), 1..3 = emplacements manuels.
export const SLOT_PRINCIPAL = 0;

// Normalise la réponse du serveur vers l'objet de sauvegarde manipulé par le jeu.
// Le serveur reste la source de vérité : tout ce qui manque est remplacé par une valeur sûre.
function normaliserSauvegarde(brut, playerId, slot) {
  const donnees = brut || {};
  return {
    playerId: donnees.playerId || playerId,
    slot: donnees.slot ?? slot,
    label: donnees.label ?? null,
    playerName: donnees.playerName || "Sucrette",
    currentEpisode: donnees.currentEpisode || "episode1",
    currentNode: donnees.currentNode ?? null,
    currentBackground: donnees.currentBackground ?? null,
    gauges: donnees.gauges && typeof donnees.gauges === "object" ? donnees.gauges : {},
    flags: Array.isArray(donnees.flags) ? donnees.flags : [],
    choices: Array.isArray(donnees.choices) ? donnees.choices : [],
    stats: donnees.stats && typeof donnees.stats === "object" ? donnees.stats : {},
    currency: Number(donnees.currency) || 0,
    inventory: Array.isArray(donnees.inventory) ? donnees.inventory : [],
    actionPoints: Number.isFinite(donnees.actionPoints) ? donnees.actionPoints : 25,
    lastActionPointsTimestamp: Number(donnees.lastActionPointsTimestamp) || Date.now(),
    history: Array.isArray(donnees.history) ? donnees.history : [],
    completedEpisodes: Array.isArray(donnees.completedEpisodes) ? donnees.completedEpisodes : [],
    revision: Number(donnees.revision) || 0,
    updatedAt: donnees.updatedAt ?? null,
  };
}

// Charge la progression d'un emplacement depuis la base (RPC serveur, jamais le localStorage).
export async function chargerProgressionDistante(playerId, slot = SLOT_PRINCIPAL) {
  const { data, error } = await supabase.rpc("game_load_save", { p_slot: slot });
  if (error) throw error;
  return normaliserSauvegarde(data, playerId, slot);
}

// Persiste la progression via l'API serveur, qui valide et borne les données critiques
// (lovomètres, PA, monnaie). Retourne la sauvegarde telle qu'enregistrée en base.
export async function sauvegarderProgressionDistante(sauvegarde) {
  if (!sauvegarde?.playerId) return null;
  const slot = sauvegarde.slot ?? SLOT_PRINCIPAL;

  const payload = {
    playerName: sauvegarde.playerName,
    label: sauvegarde.label ?? null,
    currentEpisode: sauvegarde.currentEpisode,
    currentNode: sauvegarde.currentNode,
    currentBackground: sauvegarde.currentBackground,
    gauges: sauvegarde.gauges || {},
    flags: sauvegarde.flags || [],
    choices: sauvegarde.choices || [],
    stats: sauvegarde.stats || {},
    currency: sauvegarde.currency ?? 0,
    inventory: sauvegarde.inventory || [],
    actionPoints: sauvegarde.actionPoints ?? 25,
    history: sauvegarde.history || [],
    completedEpisodes: sauvegarde.completedEpisodes || [],
  };

  const { data, error } = await supabase.rpc("game_save_progress", { p_payload: payload, p_slot: slot });
  if (error) throw error;
  return normaliserSauvegarde(data, sauvegarde.playerId, slot);
}

// Journalise un choix côté serveur (historique auditable, indépendant du navigateur).
export async function enregistrerChoixDistant({
  episodeId,
  nodeId,
  optionIndex,
  optionLabel = null,
  flags = [],
  effects = {},
  slot = SLOT_PRINCIPAL,
}) {
  const { error } = await supabase.rpc("game_record_choice", {
    p_episode_id: episodeId ?? null,
    p_node_id: nodeId ?? null,
    p_option_index: optionIndex ?? null,
    p_option_label: optionLabel,
    p_flags: flags,
    p_effects: effects,
    p_slot: slot,
  });
  if (error) throw error;
}

export async function listerSauvegardesDistantes() {
  const { data, error } = await supabase.rpc("game_list_saves");
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function listerChoixDistants(slot = SLOT_PRINCIPAL, limite = 200) {
  const { data, error } = await supabase.rpc("game_list_choices", { p_slot: slot, p_limit: limite });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function debloquerIllustration({ path, episodeId, nodeId }) {
  if (!path) return null;
  const { data, error } = await supabase.rpc("game_unlock_illustration", {
    p_path: path,
    p_episode_id: episodeId ?? null,
    p_node_id: nodeId ?? null,
  });
  if (error) throw error;
  return data;
}

export async function listerIllustrationsDebloquees() {
  const { data, error } = await supabase.rpc("game_list_illustrations");
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function copierSauvegardeDistante(slotSource, slotCible, label = null) {
  const { data, error } = await supabase.rpc("game_copy_save", {
    p_source: slotSource,
    p_cible: slotCible,
    p_label: label,
  });
  if (error) throw error;
  return normaliserSauvegarde(data, data?.playerId, slotCible);
}

export async function reinitialiserProgressionDistante(playerId, slot = SLOT_PRINCIPAL, playerName = null) {
  const { data, error } = await supabase.rpc("game_reset_save", { p_slot: slot, p_player_name: playerName });
  if (error) throw error;
  return normaliserSauvegarde(data, playerId, slot);
}
