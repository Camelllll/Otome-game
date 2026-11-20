// Accès en lecture seule au contenu du jeu (personnages, épisodes publiés, boutique) via l'API Laravel.
import { appelApi, ApiError } from "./apiClient.js";
import { adapterMedias } from "./mediaDelivery.js";

// Forme { player, crushs, secondary } attendue par aplatirPersonnages().
export async function getCharacters() {
  return adapterMedias(await appelApi("/characters", { authentifie: false }));
}

export async function getBackgrounds() {
  const donnees = await appelApi("/backgrounds", { authentifie: false });
  if (!Array.isArray(donnees)) throw new ApiError("Le catalogue des décors reçu est invalide.");
  return adapterMedias(donnees);
}

// Liste les épisodes publiés (visibles par les joueurs) : [{ id, title }].
export async function getPublishedEpisodesList() {
  const donnees = await appelApi("/episodes", { authentifie: false });
  return Array.isArray(donnees) ? donnees : [];
}

export async function getEpisode(episodeId) {
  return adapterMedias(await appelApi(`/episodes/${encodeURIComponent(episodeId)}`, { authentifie: false }));
}

export async function getShop() {
  return appelApi("/shop", { authentifie: false });
}

// Catalogue des illustrations du carnet de relations (liaisons personnages <-> souvenirs définies dans le studio).
// Gardé en mémoire pour la session ; en cas d'échec on renvoie une liste vide sans mémoriser l'erreur.
let catalogueIllustrations = null;

export async function getIllustrationsCatalogue({ actualiser = false, propagerErreur = false } = {}) {
  if (catalogueIllustrations && !actualiser) return catalogueIllustrations;
  try {
    const donnees = await appelApi("/illustrations/catalogue", { authentifie: false });
    if (!Array.isArray(donnees)) {
      throw new ApiError("Le catalogue des illustrations reçu est invalide.");
    }
    catalogueIllustrations = donnees;
    return catalogueIllustrations;
  } catch (erreur) {
    console.warn("Catalogue des illustrations indisponible.", erreur);
    if (propagerErreur) throw erreur;
    return [];
  }
}