// Sauvegarde de la progression du joueur.
//
// Source de vérité = la base (API Laravel, routes `/api/saves`). Le localStorage n'est
// utilisé que comme cache d'affichage et tampon hors-ligne : il ne sert jamais à décider seul
// de la progression et il est réécrit par la réponse du serveur dès qu'elle arrive.
//
// L'autosave est déclenché après chaque choix, changement de scène, modification de jauge ou de
// statistique : les appels sont regroupés (debounce court), réessayés en cas d'échec réseau, et
// vidés avant la fermeture de l'onglet.
import {
  chargerProgressionDistante,
  sauvegarderProgressionDistante,
  reinitialiserProgressionDistante,
  enregistrerChoixDistant,
  SLOT_PRINCIPAL,
} from "../services/playerRepository.js";

const CACHE_KEY = "otome_save_cache_v2";
const ANCIEN_CACHE_KEY = "otome_save_v1";
const DELAI_AUTOSAVE_MS = 600;
const TENTATIVES_MAX = 5;
const PA_MAX = 25;
const PA_REGEN_MS = 5 * 60 * 1000; // +1 PA toutes les 5 minutes

const etat = {
  enAttente: false, // des modifications non encore envoyées existent
  minuteur: null,
  envoiEnCours: null,
  tentatives: 0,
  sauvegardeCourante: null,
};

const statut = { enLigne: true, derniereErreur: null, derniereSynchro: null };
const abonnes = new Set();

// Permet à l'interface d'afficher un indicateur "sauvegardé / hors-ligne".
export function surStatutSauvegarde(rappel) {
  abonnes.add(rappel);
  rappel({ ...statut });
  return () => abonnes.delete(rappel);
}

function publierStatut(modifications) {
  Object.assign(statut, modifications);
  for (const rappel of abonnes) {
    try {
      rappel({ ...statut });
    } catch (erreur) {
      console.warn("Abonné au statut de sauvegarde en erreur.", erreur);
    }
  }
}

function creerSauvegardeParDefaut(playerId, slot = SLOT_PRINCIPAL) {
  return {
    playerId,
    slot,
    label: null,
    playerName: "Sucrette",
    appearance: null, // apparence de Sucrette (voir engine/appearance.js) ; null = apparence par défaut du catalogue
    currentEpisode: "episode1",
    currentNode: null,
    currentBackground: null,
    gauges: {}, // { [personnageId]: { amitie, amour } }
    flags: [], // marqueurs posés par les choix (lus par les nœuds "branch")
    choices: [], // choix importants : { episodeId, nodeId, optionIndex, optionLabel, at }
    stats: {}, // variables libres du joueur (ex. { PA: 25 })
    currency: 0,
    inventory: [],
    actionPoints: PA_MAX,
    lastActionPointsTimestamp: Date.now(),
    history: [], // historique des lignes de dialogue déjà vues
    completedEpisodes: [], // ids des épisodes terminés
    discoveredCharacterIds: [], // personnages apparus au moins une fois dans une scène jouée (carnet de relations)
    unlockedIllustrationIds: [], // identifiants des illustrations (souvenirs partagés) déjà vues
    revision: 0,
    updatedAt: null,
  };
}

// ------------------------------------------------------------
// Cache local (tampon hors-ligne uniquement)
// ------------------------------------------------------------

function ecrireCache(sauvegarde, synchronise) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ synchronise, majLocaleAt: Date.now(), sauvegarde }));
  } catch (erreur) {
    // Navigation privée / quota plein : le jeu continue, la base reste la référence.
    console.warn("Cache de sauvegarde local indisponible.", erreur);
  }
}

function lireCache(playerId, slot) {
  try {
    const brut = localStorage.getItem(CACHE_KEY) || localStorage.getItem(ANCIEN_CACHE_KEY);
    if (!brut) return null;
    const contenu = JSON.parse(brut);
    // Ancien format (v1) : l'objet de sauvegarde était stocké à plat.
    const entree = contenu?.sauvegarde ? contenu : { synchronise: false, majLocaleAt: 0, sauvegarde: contenu };
    const sauvegarde = entree.sauvegarde;
    if (!sauvegarde || sauvegarde.playerId !== playerId) return null;
    if ((sauvegarde.slot ?? SLOT_PRINCIPAL) !== slot) return null;
    return { ...entree, sauvegarde: { ...creerSauvegardeParDefaut(playerId, slot), ...sauvegarde } };
  } catch (erreur) {
    console.warn("Cache de sauvegarde corrompu, il est ignoré.", erreur);
    return null;
  }
}

function viderCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(ANCIEN_CACHE_KEY);
  } catch (erreur) {
    console.warn("Impossible de vider le cache de sauvegarde local.", erreur);
  }
}

// ------------------------------------------------------------
// Chargement
// ------------------------------------------------------------

// Charge la sauvegarde du joueur depuis la base. Si un brouillon local non synchronisé existe
// (coupure réseau lors de la session précédente), il est poussé avant d'adopter la version serveur.
export async function chargerSauvegarde(playerId, slot = SLOT_PRINCIPAL) {
  const cache = lireCache(playerId, slot);

  if (cache && !cache.synchronise) {
    try {
      await sauvegarderProgressionDistante(cache.sauvegarde);
    } catch (erreur) {
      console.warn("Reprise de la sauvegarde hors-ligne impossible pour l'instant.", erreur);
    }
  }

  try {
    const sauvegarde = await chargerProgressionDistante(playerId, slot);
    etat.sauvegardeCourante = sauvegarde;
    etat.enAttente = false;
    etat.tentatives = 0;
    ecrireCache(sauvegarde, true);
    publierStatut({ enLigne: true, derniereErreur: null, derniereSynchro: Date.now() });
    return sauvegarde;
  } catch (erreur) {
    console.warn("Chargement en ligne impossible : utilisation temporaire du cache local.", erreur);
    publierStatut({ enLigne: false, derniereErreur: erreur });
    const repli = cache?.sauvegarde || creerSauvegardeParDefaut(playerId, slot);
    etat.sauvegardeCourante = repli;
    return repli;
  }
}

// Indique si une partie est déjà commencée (bouton "Continuer").
export function aUneProgression(sauvegarde) {
  return Boolean(sauvegarde?.currentNode) || (sauvegarde?.revision ?? 0) > 0;
}

// ------------------------------------------------------------
// Autosave
// ------------------------------------------------------------

// Planifie une sauvegarde (après chaque choix / scène / jauge / statistique) :
// cache local immédiat, envoi réseau groupé.
export function sauvegarder(sauvegarde) {
  if (!sauvegarde) return;
  etat.sauvegardeCourante = sauvegarde;
  etat.enAttente = true;
  ecrireCache(sauvegarde, false);

  if (etat.minuteur) clearTimeout(etat.minuteur);
  etat.minuteur = setTimeout(() => {
    etat.minuteur = null;
    envoyer();
  }, DELAI_AUTOSAVE_MS);
}

// Force l'envoi immédiat et attend la confirmation du serveur (fin d'épisode, nouvelle partie,
// changement d'écran...). Ne rejette jamais : un échec est journalisé puis retenté.
export async function sauvegarderMaintenant(sauvegarde) {
  if (sauvegarde) {
    etat.sauvegardeCourante = sauvegarde;
    etat.enAttente = true;
    ecrireCache(sauvegarde, false);
  }
  if (etat.minuteur) {
    clearTimeout(etat.minuteur);
    etat.minuteur = null;
  }
  return envoyer();
}

// Une transaction du dressing doit attendre son propre envoi, pas celui d'une autosave précédente.
export async function confirmerSauvegarde(sauvegarde) {
  const precedente = etat.envoiEnCours;
  if (precedente) {
    etat.enAttente = true;
    await precedente;
  }
  return sauvegarderMaintenant(sauvegarde);
}

async function envoyer() {
  if (etat.envoiEnCours) return etat.envoiEnCours;
  const sauvegarde = etat.sauvegardeCourante;
  if (!sauvegarde?.playerId || !etat.enAttente) return null;

  etat.envoiEnCours = (async () => {
    // Le contenu envoyé est figé ici : toute modification survenue pendant la requête
    // repasse etat.enAttente à true et déclenche un nouvel envoi.
    etat.enAttente = false;
    try {
      const confirmee = await sauvegarderProgressionDistante(sauvegarde);
      etat.tentatives = 0;
      if (confirmee && !etat.enAttente) {
        // Le serveur a pu corriger des valeurs (jauges bornées, PA régénérés) : on adopte
        // sa version dans l'objet partagé avec le moteur de dialogue.
        Object.assign(sauvegarde, confirmee);
        ecrireCache(sauvegarde, true);
      }
      publierStatut({ enLigne: true, derniereErreur: null, derniereSynchro: Date.now() });
      return sauvegarde;
    } catch (erreur) {
      etat.enAttente = true;
      etat.tentatives += 1;
      publierStatut({ enLigne: false, derniereErreur: erreur });
      console.warn(`Sauvegarde en ligne échouée (tentative ${etat.tentatives}).`, erreur);
      if (etat.tentatives <= TENTATIVES_MAX) {
        const delai = Math.min(30000, DELAI_AUTOSAVE_MS * 2 ** etat.tentatives);
        if (etat.minuteur) clearTimeout(etat.minuteur);
        etat.minuteur = setTimeout(() => {
          etat.minuteur = null;
          envoyer();
        }, delai);
      }
      return null;
    } finally {
      etat.envoiEnCours = null;
    }
  })();

  const resultat = await etat.envoiEnCours;
  // Une modification est arrivée pendant l'envoi : on repart pour un tour.
  if (etat.enAttente && etat.tentatives === 0) sauvegarder(etat.sauvegardeCourante);
  return resultat;
}

// Journalise un choix côté serveur (best-effort : l'échec ne bloque pas le joueur,
// la sauvegarde contient déjà les effets du choix).
export function enregistrerChoix(sauvegarde, choix) {
  if (!sauvegarde) return;
  sauvegarde.choices ||= [];
  sauvegarde.choices.push({ ...choix, at: new Date().toISOString() });
  enregistrerChoixDistant({ ...choix, slot: sauvegarde.slot ?? SLOT_PRINCIPAL }).catch((erreur) => {
    console.warn("Journalisation du choix différée.", erreur);
  });
}

export async function reinitialiserSauvegarde(playerId, slot = SLOT_PRINCIPAL, playerName = null) {
  if (etat.minuteur) {
    clearTimeout(etat.minuteur);
    etat.minuteur = null;
  }
  etat.enAttente = false;
  etat.tentatives = 0;
  viderCache();
  try {
    const neuve = await reinitialiserProgressionDistante(playerId, slot, playerName);
    etat.sauvegardeCourante = neuve;
    ecrireCache(neuve, true);
    publierStatut({ enLigne: true, derniereErreur: null, derniereSynchro: Date.now() });
    return neuve;
  } catch (erreur) {
    console.warn("Réinitialisation en ligne impossible.", erreur);
    publierStatut({ enLigne: false, derniereErreur: erreur });
    const neuve = creerSauvegardeParDefaut(playerId, slot);
    etat.sauvegardeCourante = neuve;
    return neuve;
  }
}

// Dernière chance d'envoyer les modifications avant que l'onglet ne disparaisse.
if (typeof window !== "undefined") {
  const viderFile = () => {
    if (etat.enAttente) sauvegarderMaintenant();
  };
  window.addEventListener("pagehide", viderFile);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") viderFile();
  });
  // Retour du réseau : on rejoue immédiatement ce qui n'a pas pu partir.
  window.addEventListener("online", () => {
    etat.tentatives = 0;
    viderFile();
  });
}

// ------------------------------------------------------------
// Points d'action
// ------------------------------------------------------------

// Recalcule les PA courants à partir du timestamp sauvegardé (régénération hors ligne incluse).
// Le serveur applique la même règle et refuse tout gain non justifié par le temps écoulé.
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

export { PA_MAX, PA_REGEN_MS, SLOT_PRINCIPAL };
