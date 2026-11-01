// Accès en lecture seule au contenu du jeu (personnages, épisodes publiés, boutique) via l'API Laravel.
import { appelApi } from "./apiClient.js";

// Forme { player, crushs, secondary } attendue par aplatirPersonnages().
export async function getCharacters() {
  return appelApi("/characters", { authentifie: false });
}

// Liste les épisodes publiés (visibles par les joueurs) : [{ id, title }].
export async function getPublishedEpisodesList() {
  const donnees = await appelApi("/episodes", { authentifie: false });
  return Array.isArray(donnees) ? donnees : [];
}

export async function getEpisode(episodeId) {
  return appelApi(`/episodes/${encodeURIComponent(episodeId)}`, { authentifie: false });
}

export async function getShop() {
  return appelApi("/shop", { authentifie: false });
}