// Gestion de la sauvegarde de progression du joueur : persistée en base (Supabase) avec un cache
// local (localStorage) pour un affichage instantané et un repli en cas de coupure réseau.
import {
  chargerProgressionDistante,
  sauvegarderProgressionDistante,
  reinitialiserProgressionDistante,
} from "../services/playerRepository.js";

const SAVE_KEY = "otome_save_v1";
const PA_MAX = 25;
const PA_REGEN_MS = 5 * 60 * 1000; // +1 PA toutes les 5 minutes

function creerSauvegardeParDefaut(playerId) {
  return {
    playerId,
    playerName: "Sucrette",
    currentEpisode: "episode1",
    currentNode: null,
    currentBackground: null,
    gauges: {}, // { [personnageId]: { amitie, amour } }
    currency: 0,
    inventory: [],
    actionPoints: PA_MAX,
    lastActionPointsTimestamp: Date.now(),
    history: [], // historique des lignes de dialogue déjà vues
    completedEpisodes: [] // ids des épisodes terminés (verrouillage de l'écran de sélection)
  };
}

function chargerCacheLocal(playerId) {
  const brut = localStorage.getItem(SAVE_KEY);
  if (!brut) return creerSauvegardeParDefaut(playerId);
  try {
    return { ...creerSauvegardeParDefaut(playerId), ...JSON.parse(brut), playerId };
  } catch (erreur) {
    console.warn("Cache de sauvegarde corrompu, réinitialisation.", erreur);
    return creerSauvegardeParDefaut(playerId);
  }
}

// Charge la sauvegarde du joueur connecté depuis la base ; retombe sur le cache local hors-ligne.
export async function chargerSauvegarde(playerId) {
  try {
    const sauvegarde = await chargerProgressionDistante(playerId);
    localStorage.setItem(SAVE_KEY, JSON.stringify(sauvegarde));
    return sauvegarde;
  } catch (erreur) {
    console.warn("Chargement de la sauvegarde en ligne impossible, utilisation du cache local.", erreur);
    return chargerCacheLocal(playerId);
  }
}

// Sauvegarde immédiate en local (cache instantané) + envoi en base en arrière-plan.
export function sauvegarder(sauvegarde) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(sauvegarde));
  sauvegarderProgressionDistante(sauvegarde).catch((erreur) => {
    console.warn("Sauvegarde en ligne différée (la base n'a pas pu être mise à jour).", erreur);
  });
}

export async function reinitialiserSauvegarde(playerId) {
  localStorage.removeItem(SAVE_KEY);
  try {
    return await reinitialiserProgressionDistante(playerId);
  } catch (erreur) {
    console.warn("Réinitialisation en ligne impossible, réinitialisation locale uniquement.", erreur);
    return creerSauvegardeParDefaut(playerId);
  }
}

// Recalcule les PA courants à partir du timestamp sauvegardé (régénération hors ligne incluse).
export function recalculerActionPoints(sauvegarde) {
  if (sauvegarde.actionPoints >= PA_MAX) {
    sauvegarde.lastActionPointsTimestamp = Date.now();
    return sauvegarde;
  }
  const maintenant = Date.now();
  const ecoule = maintenant - sauvegarde.lastActionPointsTimestamp;
  const paGagnes = Math.floor(ecoule / PA_REGEN_MS);
  if (paGagnes > 0) {
    sauvegarde.actionPoints = Math.min(PA_MAX, sauvegarde.actionPoints + paGagnes);
    sauvegarde.lastActionPointsTimestamp += paGagnes * PA_REGEN_MS;
  }
  return sauvegarde;
}

export function consommerActionPoints(sauvegarde, cout) {
  recalculerActionPoints(sauvegarde);
  if (sauvegarde.actionPoints < cout) return false;
  sauvegarde.actionPoints -= cout;
  sauvegarder(sauvegarde);
  return true;
}

export { PA_MAX, PA_REGEN_MS };
