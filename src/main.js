// Point d'entrée du jeu : connecte le joueur, affiche l'écran d'accueil, puis charge l'épisode courant.
import { chargerSauvegarde, sauvegarder, recalculerActionPoints } from "./engine/saveSystem.js";
import { DialogueEngine, aplatirPersonnages } from "./engine/dialogueEngine.js";
import { getCharacters, getEpisode, getPublishedEpisodesList } from "./services/gameRepository.js";
import { obtenirSessionJoueur } from "./services/playerRepository.js";
import { lancerEcranDialogue } from "./screens/dialogueScreen.js";
import { lancerEcranAccueil } from "./screens/homeScreen.js";
import { lancerEcranSelectionEpisode } from "./screens/episodeSelectScreen.js";
import { lancerEcranConnexion } from "./screens/loginScreen.js";

const conteneurJeu = document.getElementById("jeu");

// Liste les épisodes publiés depuis la base (l'admin publie les brouillons quand ils sont prêts).
async function listerEpisodesDisponibles() {
  return getPublishedEpisodesList();
}

async function lancerEpisode(idEpisode, sauvegarde) {
  const [charactersData, episodeData] = await Promise.all([
    getCharacters(),
    getEpisode(idEpisode)
  ]);

  const personnagesParId = aplatirPersonnages(charactersData);
  const moteur = new DialogueEngine(episodeData, personnagesParId, sauvegarde);

  lancerEcranDialogue(conteneurJeu, moteur, {
    onFinEpisode: (prochainEpisode) => {
      if (!prochainEpisode) {
        // Pas d'épisode suivant défini : retour à l'écran de sélection plutôt que de rester bloqué.
        afficherSelectionEpisode(sauvegarde);
        return;
      }
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
  const completes = new Set(sauvegarde.completedEpisodes || []);
  // Pas de verrouillage pour l'instant (en développement, il faut pouvoir tester n'importe quel épisode) :
  // seul un badge "terminé" reste affiché à titre indicatif.
  const episodesAvecStatut = episodes.map((episode) => ({
    ...episode,
    complete: completes.has(episode.id),
    verrouille: false,
  }));

  lancerEcranSelectionEpisode(conteneurJeu, {
    episodes: episodesAvecStatut,
    episodeActuel: sauvegarde.currentEpisode,
    onSelect: (idEpisode) => {
      // Ne remet le dialogue à zéro que si on change réellement d'épisode (sinon on perdrait la reprise en cours).
      if (idEpisode !== sauvegarde.currentEpisode) {
        sauvegarde.currentEpisode = idEpisode;
        sauvegarde.currentNode = null;
        sauvegarde.currentBackground = null;
        sauvegarder(sauvegarde);
      }
      lancerEpisode(idEpisode, sauvegarde);
    }
  });
}

async function afficherAccueil(joueur) {
  lancerEcranAccueil(conteneurJeu, {
    joueur,
    onDemarrer: async (type) => {
      const sauvegarde = await chargerSauvegarde(joueur.id);
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

      // Si une partie est déjà en cours, on reprend directement le dialogue là où elle s'est arrêtée
      // plutôt que de repasser par l'écran de sélection.
      if (type === "continuer" && sauvegarde.currentNode) {
        lancerEpisode(sauvegarde.currentEpisode, sauvegarde);
        return;
      }

      afficherSelectionEpisode(sauvegarde);
    }
  });
}

async function demarrer() {
  const joueurExistant = await obtenirSessionJoueur();
  if (joueurExistant) {
    afficherAccueil(joueurExistant);
    return;
  }
  lancerEcranConnexion(conteneurJeu, {
    onConnecte: (joueur) => {
      afficherAccueil(joueur);
    }
  });
}

demarrer().catch((erreur) => {
  console.error(erreur);
  conteneurJeu.textContent = "Erreur au chargement du jeu. Consulte la console.";
});

