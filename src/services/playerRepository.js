// Comptes joueurs et persistance de la progression via l'API Laravel (jeton Bearer Sanctum).
// Le serveur valide et borne toutes les données : le client ne fait que les transmettre.
import { appelApi, lireJeton, memoriserJeton, oublierJeton, ApiError } from "./apiClient.js";

// Crée un compte (email + mot de passe) et connecte directement le joueur.
export async function creerCompteJoueur(email, motDePasse, pseudo) {
  const pseudoNettoye = (pseudo || "").trim();
  const donnees = await appelApi("/auth/register", {
    method: "POST",
    authentifie: false,
    corps: { email: email.trim(), password: motDePasse, pseudo: pseudoNettoye || null },
  });
  memoriserJeton(donnees.token);
  return donnees.player;
}

export async function connexionJoueur(email, motDePasse) {
  const donnees = await appelApi("/auth/login", {
    method: "POST",
    authentifie: false,
    corps: { email: email.trim(), password: motDePasse },
  });
  memoriserJeton(donnees.token);
  return donnees.player;
}

// Retrouve le joueur déjà connecté (jeton conservé), ou null si personne n'est connecté.
export async function obtenirSessionJoueur() {
  if (!lireJeton()) return null;
  try {
    const donnees = await appelApi("/auth/me");
    return donnees.player;
  } catch (erreur) {
    if (erreur instanceof ApiError && erreur.statut === 401) return null;
    throw erreur;
  }
}

export async function deconnecterJoueur() {
  try {
    await appelApi("/auth/logout", { method: "POST" });
  } catch (erreur) {
    console.warn("Déconnexion côté serveur impossible, le jeton local est effacé quand même.", erreur);
  } finally {
    oublierJeton();
  }
}

// Emplacements de sauvegarde : 0 = sauvegarde principale (autosave), 1..9 = emplacements manuels.
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
    appearance: donnees.appearance && typeof donnees.appearance === "object" ? donnees.appearance : null,
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
    discoveredCharacterIds: Array.isArray(donnees.discoveredCharacterIds) ? donnees.discoveredCharacterIds : [],
    unlockedIllustrationIds: Array.isArray(donnees.unlockedIllustrationIds) ? donnees.unlockedIllustrationIds : [],
    revision: Number(donnees.revision) || 0,
    updatedAt: donnees.updatedAt ?? null,
  };
}

// Charge la progression d'un emplacement depuis la base (jamais depuis le localStorage).
export async function chargerProgressionDistante(playerId, slot = SLOT_PRINCIPAL) {
  const donnees = await appelApi(`/saves/${slot}`);
  return normaliserSauvegarde(donnees, playerId, slot);
}

// Persiste la progression via l'API serveur, qui valide et borne les données critiques
// (lovomètres, PA, monnaie). Retourne la sauvegarde telle qu'enregistrée en base.
export async function sauvegarderProgressionDistante(sauvegarde) {
  if (!sauvegarde?.playerId) return null;
  const slot = sauvegarde.slot ?? SLOT_PRINCIPAL;

  const payload = {
    playerName: sauvegarde.playerName,
    appearance: sauvegarde.appearance ?? null,
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
    discoveredCharacterIds: sauvegarde.discoveredCharacterIds || [],
    unlockedIllustrationIds: sauvegarde.unlockedIllustrationIds || [],
  };

  const donnees = await appelApi(`/saves/${slot}`, { method: "PUT", corps: payload });
  return normaliserSauvegarde(donnees, sauvegarde.playerId, slot);
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
  await appelApi(`/saves/${slot}/choices`, {
    method: "POST",
    corps: {
      episodeId: episodeId ?? null,
      nodeId: nodeId ?? null,
      optionIndex: optionIndex ?? null,
      optionLabel,
      flags,
      effects,
    },
  });
}

export async function listerSauvegardesDistantes() {
  const donnees = await appelApi("/saves");
  return Array.isArray(donnees) ? donnees : [];
}

export async function listerChoixDistants(slot = SLOT_PRINCIPAL, limite = 200) {
  const donnees = await appelApi(`/saves/${slot}/choices?limit=${encodeURIComponent(limite)}`);
  return Array.isArray(donnees) ? donnees : [];
}

export async function debloquerIllustration({ path, episodeId, nodeId }) {
  if (!path) return null;
  return appelApi("/illustrations", {
    method: "POST",
    corps: { path, episodeId: episodeId ?? null, nodeId: nodeId ?? null },
  });
}

export async function listerIllustrationsDebloquees() {
  const donnees = await appelApi("/illustrations");
  return Array.isArray(donnees) ? donnees : [];
}

export async function copierSauvegardeDistante(slotSource, slotCible, label = null) {
  const donnees = await appelApi(`/saves/${slotSource}/copy`, {
    method: "POST",
    corps: { target: slotCible, label },
  });
  return normaliserSauvegarde(donnees, donnees?.playerId, slotCible);
}

export async function reinitialiserProgressionDistante(playerId, slot = SLOT_PRINCIPAL, playerName = null) {
  const donnees = await appelApi(`/saves/${slot}/reset`, { method: "POST", corps: { playerName } });
  return normaliserSauvegarde(donnees, playerId, slot);
}