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

/**
 * Débloque les souvenirs dont le moment de déclenchement vient d'être affiché.
 * @param {object[]} catalogue - illustrations définies dans le studio
 * @param {string} episodeId - épisode en cours
 * @param {string[]} nodeIds - nœuds affichés à l'écran (le nœud courant et, s'il y en a un, celui fusionné dans la bulle)
 * @returns {boolean} true si la sauvegarde a changé.
 */
export function debloquerSouvenirs(sauvegarde, catalogue, episodeId, nodeIds) {
  if (!sauvegarde || !Array.isArray(catalogue) || !Array.isArray(nodeIds)) return false;
  const debloques = listeDeLaSauvegarde(sauvegarde, "unlockedIllustrationIds");
  let change = false;
  for (const illustration of catalogue) {
    if (!illustration?.id || !illustration.unlockNodeId) continue;
    if (!nodeIds.includes(illustration.unlockNodeId)) continue;
    if (illustration.episodeId && illustration.episodeId !== episodeId) continue;
    if (illustration.unlockCondition && illustration.unlockCondition !== "viewed") continue;
    if (debloques.includes(illustration.id)) continue;
    debloques.push(illustration.id);
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