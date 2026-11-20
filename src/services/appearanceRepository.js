// Les catégories et articles d'apparence sont gérés dans le studio et chargés depuis l'API.
import { catalogueValide } from "../engine/appearance.js";
import { API_URL } from "./apiClient.js";

let catalogueEnCache = null;

// Renvoie null si le studio ou son catalogue est indisponible.
export async function chargerCatalogueApparence() {
  if (catalogueEnCache) return catalogueEnCache;
  try {
    const reponse = await fetch(`${API_URL}/appearance/catalogue`, {
      headers: { Accept: "application/json" },
      cache: "no-cache",
    });
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