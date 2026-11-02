// Catalogue des éléments d'apparence de Sucrette.
// Aujourd'hui : un fichier JSON statique. Une future migration vers la base de données ne changera
// que cette fonction (par exemple appelApi("/appearance/catalogue")) : le reste du jeu reçoit le même objet.
import { catalogueValide } from "../engine/appearance.js";

const URL_CATALOGUE = "data/appearance/catalogue.json";

let catalogueEnCache = null;

// Renvoie le catalogue, ou null s'il est indisponible : le jeu retombe alors sur le sprite d'origine.
export async function chargerCatalogueApparence() {
  if (catalogueEnCache) return catalogueEnCache;
  try {
    // "no-cache" : le navigateur revalide le fichier à chaque chargement, pour ne jamais garder un ancien catalogue.
    const reponse = await fetch(URL_CATALOGUE, { cache: "no-cache" });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    const catalogue = await reponse.json();
    if (!catalogueValide(catalogue)) throw new Error("Format de catalogue invalide.");
    catalogueEnCache = catalogue;
    return catalogue;
  } catch (erreur) {
    console.warn("Catalogue d'apparence indisponible : le sprite d'origine est utilisé.", erreur);
    return null;
  }
}