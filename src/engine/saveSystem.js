// Gestion de la sauvegarde de progression du joueur (localStorage).
const SAVE_KEY = "otome_save_v1";
const PA_MAX = 25;
const PA_REGEN_MS = 5 * 60 * 1000; // +1 PA toutes les 5 minutes

function creerSauvegardeParDefaut() {
  return {
    playerName: "Sucrette",
    currentEpisode: "episode1",
    currentNode: null,
    currentBackground: null,
    gauges: {}, // { [personnageId]: { amitie, amour } }
    currency: 0,
    inventory: [],
    actionPoints: PA_MAX,
    lastActionPointsTimestamp: Date.now(),
    history: [] // historique des lignes de dialogue déjà vues
  };
}

// Charge la sauvegarde existante ou en crée une nouvelle.
export function chargerSauvegarde() {
  const brut = localStorage.getItem(SAVE_KEY);
  if (!brut) return creerSauvegardeParDefaut();
  try {
    const sauvegarde = { ...creerSauvegardeParDefaut(), ...JSON.parse(brut) };
    return sauvegarde;
  } catch (erreur) {
    console.warn("Sauvegarde corrompue, réinitialisation.", erreur);
    return creerSauvegardeParDefaut();
  }
}

export function sauvegarder(sauvegarde) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(sauvegarde));
}

export function reinitialiserSauvegarde() {
  localStorage.removeItem(SAVE_KEY);
  return creerSauvegardeParDefaut();
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
