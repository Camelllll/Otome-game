// Boutique du dressing : prix, possession et achat d'éléments d'apparence.
// Séparation des données :
//   - catalogue global : API du studio (un élément vendu a `unlock: { type: "shop", price }`) ;
//   - inventaire du joueur : `sauvegarde.inventory` (clés `wardrobe:<catégorie>:<id>`, voir cleInventaire) ;
//   - apparence équipée : `sauvegarde.appearance`.
// La monnaie est `sauvegarde.currency`. Tout est déjà persisté par le système de sauvegarde existant.
import { cleInventaire, estDebloque, trouverElement } from "./appearance.js";

export const NOM_MONNAIE = "gemmes";

// Monnaie de démonstration : le jeu ne permet pas encore d'en gagner. Versée une seule fois par sauvegarde.
// Pour la retirer, mettre PIECES_DEMO à 0 (ou ne plus appeler accorderPiecesDemo dans main.js).
export const FLAG_PIECES_DEMO = "demo-dressing-pieces";
export const PIECES_DEMO = 300;

export function estBoutique(element) {
  return element?.unlock?.type === "shop";
}

export function prixDe(element) {
  const prix = element?.unlock?.price;
  return Number.isSafeInteger(prix) && prix >= 0 ? prix : null;
}

// Renvoie null si l'élément est possédé ou achetable ; sinon l'indice à afficher pour expliquer le verrou.
// Condition d'achat connue : unlock.requires = { type: "flag", flag, hint }. Un type inconnu reste verrouillé.
export function indiceVerrou(element, sauvegarde) {
  if (estDebloque(element, sauvegarde)) return null;
  const regle = element?.unlock || {};
  if (estBoutique(element)) {
    if (prixDe(element) === null) return "Prix indisponible";
    const requis = regle.requires;
    if (!requis) return null;
    const remplie =
      (requis.type === "flag" && Array.isArray(sauvegarde?.flags) && sauvegarde.flags.includes(requis.flag)) ||
      (requis.type === "episode" && Array.isArray(sauvegarde?.completedEpisodes) && sauvegarde.completedEpisodes.includes(requis.episode)) ||
      (requis.type === "level" && Number.isFinite(sauvegarde?.stats?.level) && sauvegarde.stats.level >= requis.level);
    return remplie ? null : requis.hint || "Pas encore débloqué";
  }
  return regle.hint || "Pas encore débloqué";
}

/**
 * Tente l'achat. Ne touche à la sauvegarde que si l'achat réussit.
 * @returns {{ok: true, prix: number, annuler: () => void} | {ok: false, raison: string, manque?: number, indice?: string}}
 */
export function acheter(element, sauvegarde) {
  if (!element || !sauvegarde || !estBoutique(element)) return { ok: false, raison: "non-vendu" };
  if (estDebloque(element, sauvegarde)) return { ok: false, raison: "deja-possede" };
  const indice = indiceVerrou(element, sauvegarde);
  if (indice) return { ok: false, raison: "verrouille", indice };

  const prix = prixDe(element);
  const solde = Math.max(0, Math.floor(Number(sauvegarde.currency) || 0));
  if (solde < prix) return { ok: false, raison: "fonds", manque: prix - solde };

  const avant = { currency: sauvegarde.currency, inventory: sauvegarde.inventory };
  sauvegarde.currency = solde - prix;
  sauvegarde.inventory = [...(Array.isArray(avant.inventory) ? avant.inventory : []), cleInventaire(element)];
  return {
    ok: true,
    prix,
    // Rétablit l'état d'avant l'achat (utilisé si l'enregistrement échoue).
    annuler() {
      sauvegarde.currency = avant.currency;
      sauvegarde.inventory = avant.inventory;
    },
  };
}

// Verse la monnaie de démonstration une seule fois. Renvoie true si elle vient d'être versée.
export function accorderPiecesDemo(sauvegarde) {
  if (!sauvegarde || PIECES_DEMO <= 0) return false;
  if (!Array.isArray(sauvegarde.flags)) sauvegarde.flags = [];
  if (sauvegarde.flags.includes(FLAG_PIECES_DEMO)) return false;
  sauvegarde.flags.push(FLAG_PIECES_DEMO);
  sauvegarde.currency = (Number(sauvegarde.currency) || 0) + PIECES_DEMO;
  return true;
}

// Migration : un élément désormais vendu mais déjà porté dans l'apparence enregistrée devient possédé,
// pour qu'une sauvegarde existante ne le perde pas. Renvoie true si l'inventaire a changé.
export function reconcilierPossessions(catalogue, sauvegarde) {
  const apparence = sauvegarde?.appearance;
  if (!catalogue || !apparence || typeof apparence !== "object") return false;
  let modifie = false;
  for (const [categorie, id] of Object.entries(apparence)) {
    if (typeof id !== "string") continue;
    const element = trouverElement(catalogue, categorie, id);
    if (element && estBoutique(element) && !estDebloque(element, sauvegarde)) {
      sauvegarde.inventory = [...(Array.isArray(sauvegarde.inventory) ? sauvegarde.inventory : []), cleInventaire(element)];
      modifie = true;
    }
  }
  return modifie;
}