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

function sauvegardeParDefaut(playerId) {
  return {
    playerId,
    playerName: "Sucrette",
    currentEpisode: "episode1",
    currentNode: null,
    currentBackground: null,
    gauges: {},
    currency: 0,
    inventory: [],
    actionPoints: 25,
    lastActionPointsTimestamp: Date.now(),
    history: [],
    completedEpisodes: [],
  };
}

// Charge la progression complète d'un joueur (fusion player_saves + player_gauges).
export async function chargerProgressionDistante(playerId) {
  const [{ data: sauvegarde, error: erreurSave }, { data: lignesJauges, error: erreurJauges }] = await Promise.all([
    supabase.from("player_saves").select("*").eq("player_id", playerId).maybeSingle(),
    supabase.from("player_gauges").select("character_id, amitie, amour").eq("player_id", playerId),
  ]);
  if (erreurSave) throw erreurSave;
  if (erreurJauges) throw erreurJauges;

  const gauges = {};
  for (const ligne of lignesJauges || []) {
    gauges[ligne.character_id] = { amitie: ligne.amitie, amour: ligne.amour };
  }

  if (!sauvegarde) return { ...sauvegardeParDefaut(playerId), gauges };

  return {
    playerId,
    playerName: sauvegarde.player_name,
    currentEpisode: sauvegarde.current_episode,
    currentNode: sauvegarde.current_node,
    currentBackground: sauvegarde.current_background,
    gauges,
    currency: sauvegarde.currency,
    inventory: sauvegarde.inventory || [],
    actionPoints: sauvegarde.action_points,
    lastActionPointsTimestamp: new Date(sauvegarde.last_action_points_at).getTime(),
    history: sauvegarde.history || [],
    completedEpisodes: sauvegarde.completed_episodes || [],
  };
}

// Persiste la progression en base (best-effort : les erreurs réseau sont remontées à l'appelant).
export async function sauvegarderProgressionDistante(sauvegarde) {
  if (!sauvegarde.playerId) return;

  const ligneSave = {
    player_id: sauvegarde.playerId,
    player_name: sauvegarde.playerName,
    current_episode: sauvegarde.currentEpisode,
    current_node: sauvegarde.currentNode,
    current_background: sauvegarde.currentBackground,
    currency: sauvegarde.currency,
    inventory: sauvegarde.inventory || [],
    action_points: sauvegarde.actionPoints,
    last_action_points_at: new Date(sauvegarde.lastActionPointsTimestamp).toISOString(),
    history: sauvegarde.history || [],
    completed_episodes: sauvegarde.completedEpisodes || [],
  };

  const lignesJauges = Object.entries(sauvegarde.gauges || {}).map(([characterId, valeurs]) => ({
    player_id: sauvegarde.playerId,
    character_id: characterId,
    amitie: valeurs.amitie ?? 0,
    amour: valeurs.amour ?? 0,
  }));

  const requetes = [supabase.from("player_saves").upsert(ligneSave)];
  if (lignesJauges.length > 0) {
    requetes.push(supabase.from("player_gauges").upsert(lignesJauges));
  }

  for (const { error } of await Promise.all(requetes)) {
    if (error) throw error;
  }
}

export async function reinitialiserProgressionDistante(playerId) {
  await Promise.all([
    supabase.from("player_saves").delete().eq("player_id", playerId),
    supabase.from("player_gauges").delete().eq("player_id", playerId),
  ]);
  return sauvegardeParDefaut(playerId);
}
