// Point d'entrée du jeu : affiche l'écran d'accueil, puis charge l'épisode courant.
import { chargerSauvegarde, sauvegarder, recalculerActionPoints } from "./engine/saveSystem.js";
import { DialogueEngine, aplatirPersonnages } from "./engine/dialogueEngine.js";
import { lancerEcranDialogue } from "./screens/dialogueScreen.js";
import { lancerEcranAccueil } from "./screens/homeScreen.js";
import { lancerEcranSelectionEpisode } from "./screens/episodeSelectScreen.js";

const conteneurJeu = document.getElementById("jeu");

async function chargerJson(chemin) {
  const reponse = await fetch(chemin);
  if (!reponse.ok) throw new Error(`Impossible de charger ${chemin}`);
  return reponse.json();
}

async function chargerEpisode(idEpisode) {
  try {
    const brouillon = JSON.parse(localStorage.getItem("otome-admin-episodes-v2") || "null");
    if (brouillon?.episodes?.[idEpisode]) return brouillon.episodes[idEpisode];
  } catch (erreur) {
    console.warn("Brouillon du back-office illisible, chargement du fichier publié.", erreur);
  }
  return chargerJson(`data/episodes/episode${idEpisode}.json`);
}

// Liste les épisodes publiés (data/episodes) ainsi que ceux créés dans l'admin mais pas encore publiés.
async function listerEpisodesDisponibles() {
  const ids = new Set([1, 2]);
  const titresBrouillon = {};

  try {
    const brouillon = JSON.parse(localStorage.getItem("otome-admin-episodes-v2") || "null");
    Object.entries(brouillon?.episodes || {}).forEach(([cle, episode]) => {
      const correspondance = cle.match(/^episode(\d+)$/);
      if (!correspondance) return;
      const id = Number(correspondance[1]);
      ids.add(id);
      titresBrouillon[id] = episode?.title;
    });
  } catch (erreur) {
    console.warn("Brouillon du back-office illisible, liste d'épisodes réduite aux fichiers publiés.", erreur);
  }

  return Promise.all(
    [...ids].sort((a, b) => a - b).map(async (id) => {
      if (titresBrouillon[id]) return { id, title: titresBrouillon[id] };
      try {
        const data = await chargerJson(`data/episodes/episode${id}.json`);
        return { id, title: data.title || `Épisode ${id}` };
      } catch {
        return { id, title: `Épisode ${id}` };
      }
    })
  );
}

async function lancerEpisode(idEpisode, sauvegarde) {
  const [charactersData, episodeData] = await Promise.all([
    chargerJson("data/characters.json"),
    chargerEpisode(idEpisode)
  ]);

  const personnagesParId = aplatirPersonnages(charactersData);
  const moteur = new DialogueEngine(episodeData, personnagesParId, sauvegarde);

  lancerEcranDialogue(conteneurJeu, moteur, {
    onFinEpisode: (prochainEpisode) => {
      if (!prochainEpisode) return;
      sauvegarde.currentEpisode = prochainEpisode;
      sauvegarde.currentNode = null;
      sauvegarde.currentBackground = null;
      sauvegarder(sauvegarde);
      lancerEpisode(sauvegarde.currentEpisode, sauvegarde);
    }
  });
}

async function afficherSelectionEpisode(sauvegarde) {
  const episodes = await listerEpisodesDisponibles();
  lancerEcranSelectionEpisode(conteneurJeu, {
    episodes,
    episodeActuel: sauvegarde.currentEpisode,
    onSelect: (idEpisode) => {
      sauvegarde.currentEpisode = idEpisode;
      sauvegarde.currentNode = null;
      sauvegarde.currentBackground = null;
      sauvegarder(sauvegarde);
      lancerEpisode(idEpisode, sauvegarde);
    }
  });
}

async function afficherAccueil() {
  lancerEcranAccueil(conteneurJeu, {
    onDemarrer: async (type) => {
      const sauvegarde = chargerSauvegarde();
      recalculerActionPoints(sauvegarde);

      // Pour une nouvelle partie, demander le prénom
      if (type === "nouvelle") {
        try {
          const nomSaisi = window.prompt("Quel est le prénom de ton héroïne ?", "Sucrette");
          if (nomSaisi) sauvegarde.playerName = nomSaisi.trim();
        } catch (erreur) {
          console.warn("Saisie du prénom indisponible, valeur par défaut conservée.", erreur);
        }
        sauvegarder(sauvegarde);
      }

      afficherSelectionEpisode(sauvegarde);
    }
  });
}

afficherAccueil().catch((erreur) => {
  console.error(erreur);
  conteneurJeu.textContent = "Erreur au chargement du jeu. Consulte la console.";
});
