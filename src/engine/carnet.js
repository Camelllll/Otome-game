// Carnet de relations : suivi des rencontres et des souvenirs (illustrations) débloqués.
// Les données vivent dans la sauvegarde : discoveredCharacterIds et unlockedIllustrationIds.

// Identifiants qui n'ont pas de fiche dans le carnet.
const NON_PERSONNAGES = new Set(["moi", "narration"]);

function listeDeLaSauvegarde(sauvegarde, cle) {
  if (!Array.isArray(sauvegarde[cle])) sauvegarde[cle] = [];
  return sauvegarde[cle];
}

/**
 * Marque des personnages comme rencontrés. Seuls les personnages connus du jeu sont retenus.
 * @returns {boolean} true si la sauvegarde a changé (il faut alors la sauvegarder).
 */
export function enregistrerRencontres(sauvegarde, ids, personnagesParId) {
  if (!sauvegarde || !Array.isArray(ids)) return false;
  const rencontres = listeDeLaSauvegarde(sauvegarde, "discoveredCharacterIds");
  let change = false;
  for (const id of ids) {
    if (typeof id !== "string" || NON_PERSONNAGES.has(id)) continue;
    if (personnagesParId && !personnagesParId.has(id)) continue;
    if (rencontres.includes(id)) continue;
    rencontres.push(id);
    change = true;
  }
  return change;
}

// Illustrations liées à un personnage (une illustration peut concerner plusieurs personnages).
export function souvenirsDuPersonnage(catalogue, personnageId) {
  if (!Array.isArray(catalogue)) return [];
  return catalogue.filter((illustration) => Array.isArray(illustration.characterIds) && illustration.characterIds.includes(personnageId));
}

// Fiches du carnet : crushs et autres personnages, avec leur catégorie.
export function listerFichesCarnet(charactersData) {
  const marquer = (liste, categorie) =>
    (liste || [])
      .filter((personnage) => personnage.showInCharactersMenu !== false)
      .map((personnage) => ({ ...personnage, categorieCarnet: categorie }));
  return [...marquer(charactersData?.crushs, "crush"), ...marquer(charactersData?.secondary, "autre")];
}