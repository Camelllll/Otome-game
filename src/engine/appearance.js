// Apparence de Pommette : modèle de données, validation et assemblage des calques.
// Ce module ne touche jamais au DOM : chaque fonction est pure et testable seule.
//
// Une seule configuration décrit l'apparence active (stockée dans la sauvegarde, clé `appearance`) :
//   { version: 1, skin: "peau-claire", hair: "coupe1-chatain", eyes: "bleu", eyebrows: "chatains",
//     mouth: "nude", outfit: null, top: "pull1-rayures", bottom: "pantalon1-bleu", accessory: null }
// `outfit` (robe, tenue complète) remplace `top` et `bottom` quand il est renseigné.
// `accessory: null` désactive l'accessoire.

export const VERSION_APPARENCE = 1;

export const CLES_APPARENCE = Object.freeze(["skin", "hair", "eyes", "eyebrows", "mouth", "outfit", "top", "bottom", "shoes", "accessory"]);
// Ces clés ne peuvent jamais rester vides : sans elles, l'écran serait vide.
const CLES_OBLIGATOIRES = Object.freeze(["skin", "hair", "eyes", "eyebrows", "mouth", "top", "bottom"]);

// Ordre de rendu explicite : plus la valeur est grande, plus le calque est au premier plan.
export const ORDRE_CALQUES = Object.freeze({
  "hair-back": 5,
  body: 10,
  mouth: 15,
  eyes: 20,
  eyebrows: 25,
  bottom: 30,
  shoes: 35,
  top: 40,
  outfit: 45,
  accessory: 50,
  "hair-front": 60,
  "accessory-top": 70,
});

export function catalogueValide(catalogue) {
  return Boolean(
    catalogue &&
      typeof catalogue.basePath === "string" &&
      Number(catalogue.canvas?.width) > 0 &&
      Number(catalogue.canvas?.height) > 0 &&
      typeof catalogue.base?.file === "string" &&
      catalogue.defaults &&
      typeof catalogue.defaults === "object" &&
      Array.isArray(catalogue.items),
  );
}

// Clé d'un élément dans `sauvegarde.inventory` (liste de chaînes déjà persistée par le système de sauvegarde).
export function cleInventaire(element) {
  return `wardrobe:${element.category}:${element.id}`;
}

const indexes = new WeakMap();

function indexDe(catalogue) {
  let index = indexes.get(catalogue);
  if (!index) {
    index = new Map(catalogue.items.map((element) => [`${element.category}:${element.id}`, element]));
    indexes.set(catalogue, index);
  }
  return index;
}

export function trouverElement(catalogue, categorie, id) {
  if (!catalogue || typeof id !== "string") return null;
  return indexDe(catalogue).get(`${categorie}:${id}`) || null;
}

export function elementsDeCategorie(catalogue, categorie) {
  return (catalogue?.items || []).filter((element) => element.category === categorie);
}

// Règle de déblocage. Types connus : "default" (toujours) et "flag" (flag présent dans la sauvegarde).
// Un type inconnu reste verrouillé. Les récompenses ou épisodes s'ajouteront ici. Le serveur ne contrôle
// aujourd'hui que le format des identifiants (PlayerSaveService::sanitizeAppearance) : la vérification des
// déblocages côté serveur viendra avec la migration du catalogue en base.
export function estDebloque(element, sauvegarde = null) {
  const regle = element?.unlock;
  if (!regle || regle.type === "default") return true;
  if (regle.type === "flag") return Array.isArray(sauvegarde?.flags) && sauvegarde.flags.includes(regle.flag);
  // "shop" : l'élément est acheté (clé présente dans l'inventaire). Voir engine/wardrobe.js.
  if (regle.type === "shop") return Array.isArray(sauvegarde?.inventory) && sauvegarde.inventory.includes(cleInventaire(element));
  return false;
}

export function apparenceParDefaut(catalogue) {
  const defauts = catalogue?.defaults || {};
  const apparence = { version: VERSION_APPARENCE };
  for (const cle of CLES_APPARENCE) apparence[cle] = defauts[cle] ?? null;
  return apparence;
}

// Rend toujours une apparence complète et valide : identifiant inconnu, mauvaise catégorie ou
// élément verrouillé sont remplacés par la valeur par défaut. Ancienne sauvegarde (null) = apparence par défaut.
export function normaliserApparence(brute, catalogue, sauvegarde = null) {
  const defauts = apparenceParDefaut(catalogue);
  if (!catalogue) return defauts;
  const source = brute && typeof brute === "object" ? brute : {};
  const resultat = { version: VERSION_APPARENCE };
  for (const cle of CLES_APPARENCE) {
    const valeur = source[cle];
    const element = trouverElement(catalogue, cle, valeur);
    if (element && estDebloque(element, sauvegarde)) {
      resultat[cle] = element.id;
    } else if (valeur === null && !CLES_OBLIGATOIRES.includes(cle)) {
      resultat[cle] = null;
    } else {
      resultat[cle] = defauts[cle];
    }
  }
  return resultat;
}

// Une variante remplace les calques d'un élément quand tous ses critères `when` sont réunis
// (ex. coiffure différente quand un ruban est porté).
function varianteCorrespondante(element, apparence) {
  return (element.variants || []).find((variante) => {
    const criteres = Object.entries(variante.when || {});
    return criteres.length > 0 && criteres.every(([cle, ids]) => ids.includes(apparence[cle] ?? null));
  });
}

function calquesDeElement(element, apparence) {
  return (varianteCorrespondante(element, apparence) || element).layers || [];
}

// Assemble la liste ordonnée des calques à afficher pour une apparence, sans rien compléter :
// une clé absente ou nulle n'affiche rien (utile pour les miniatures). Pour l'apparence active,
// passer par resoudreCalques.
export function assemblerCalques(apparence, catalogue) {
  if (!catalogue) return [];
  const a = apparence || {};
  const parSlot = new Map();

  const ajouter = (couche, id) => {
    if (!couche?.file || !Object.hasOwn(ORDRE_CALQUES, couche.slot)) {
      console.warn(`Calque ignoré (slot ou fichier invalide) : ${id}`, couche);
      return;
    }
    parSlot.set(couche.slot, {
      slot: couche.slot,
      z: ORDRE_CALQUES[couche.slot],
      src: `${catalogue.basePath}${couche.file}`,
      id,
    });
  };

  const ajouterElement = (categorie) => {
    const element = trouverElement(catalogue, categorie, a[categorie]);
    if (!element) return false;
    for (const couche of calquesDeElement(element, a)) ajouter(couche, element.id);
    return true;
  };

  // Corps par défaut du catalogue, remplacé par la peau choisie (même slot « body »).
  ajouter({ slot: "body", file: catalogue.base.file }, "body");
  ajouterElement("skin");
  ajouterElement("hair");
  ajouterElement("eyes");
  ajouterElement("eyebrows");
  ajouterElement("mouth");
  if (!ajouterElement("outfit")) {
    ajouterElement("top");
    ajouterElement("bottom");
  }
  ajouterElement("shoes");
  ajouterElement("accessory");

  return [...parSlot.values()].sort((x, y) => x.z - y.z);
}

// Point d'entrée du jeu : apparence enregistrée (ou null) -> calques prêts à afficher.
export function resoudreCalques(apparence, catalogue, sauvegarde = null) {
  return assemblerCalques(normaliserApparence(apparence, catalogue, sauvegarde), catalogue);
}