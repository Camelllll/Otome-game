// Point d'entrée du jeu : connecte le joueur, affiche l'écran d'accueil, puis charge l'épisode courant.
import { chargerSauvegarde, sauvegarder, sauvegarderMaintenant, recalculerActionPoints } from "./engine/saveSystem.js";
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

async function lancerEpisode(idEpisode, sauvegarde, joueur) {
  const [charactersData, episodeData] = await Promise.all([
    getCharacters(),
    getEpisode(idEpisode)
  ]);

  const personnagesParId = aplatirPersonnages(charactersData);
  const moteur = new DialogueEngine(episodeData, personnagesParId, sauvegarde);

  lancerEcranDialogue(conteneurJeu, moteur, {
    fichesPersonnages: [...(charactersData.crushs || []), ...(charactersData.secondary || [])],
    onRetourEpisodes: () => afficherSelectionEpisode(sauvegarde, joueur),
    onRetourAccueil: joueur ? () => afficherAccueil(joueur) : null,
    onFinEpisode: (prochainEpisode) => {
      if (!prochainEpisode) {
        // Pas d'épisode suivant défini : retour à l'écran de sélection plutôt que de rester bloqué.
        afficherSelectionEpisode(sauvegarde, joueur);
        return;
      }
      sauvegarde.currentEpisode = prochainEpisode;
      sauvegarde.currentNode = null;
      sauvegarde.currentBackground = null;
      // Transition d'épisode : on attend la confirmation du serveur avant de charger la suite.
      sauvegarderMaintenant(sauvegarde).finally(() => {
        lancerEpisode(sauvegarde.currentEpisode, sauvegarde, joueur);
      });
    }
  });
}

async function afficherSelectionEpisode(sauvegarde, joueur) {
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
    joueur,
    sauvegarde,
    onRetourAccueil: joueur ? () => afficherAccueil(joueur) : null,
    onSelect: (idEpisode) => {
      // Ne remet le dialogue à zéro que si on change réellement d'épisode (sinon on perdrait la reprise en cours).
      if (idEpisode !== sauvegarde.currentEpisode) {
        sauvegarde.currentEpisode = idEpisode;
        sauvegarde.currentNode = null;
        sauvegarde.currentBackground = null;
        sauvegarder(sauvegarde);
      }
      lancerEpisode(idEpisode, sauvegarde, joueur);
    }
  });
}

async function afficherAccueil(joueur) {
  lancerEcranAccueil(conteneurJeu, {
    joueur,
    onDemarrer: async (type, sauvegardeChargee) => {
      const sauvegarde = sauvegardeChargee || (await chargerSauvegarde(joueur.id));
      recalculerActionPoints(sauvegarde);

      // Pour une nouvelle partie, demander le prénom
      if (type === "nouvelle") {
        try {
          const nomSaisi = window.prompt("Quel est le prénom de ton héroïne ?", "Sucrette");
          if (nomSaisi) sauvegarde.playerName = nomSaisi.trim();
        } catch (erreur) {
          console.warn("Saisie du prénom indisponible, valeur par défaut conservée.", erreur);
        }
        await sauvegarderMaintenant(sauvegarde);
      }

      // Si une partie est déjà en cours, on reprend directement le dialogue là où elle s'est arrêtée
      // plutôt que de repasser par l'écran de sélection.
      if (type === "continuer" && sauvegarde.currentNode) {
        lancerEpisode(sauvegarde.currentEpisode, sauvegarde, joueur);
        return;
      }

      afficherSelectionEpisode(sauvegarde, joueur);
    }
  });
}

async function demarrer() {
  let joueurExistant = null;
  try {
    joueurExistant = await obtenirSessionJoueur();
  } catch (erreur) {
    // Session illisible (jeton expiré, stockage bloqué) : on repasse par l'écran de connexion.
    console.warn("Session joueur indisponible, retour à la connexion.", erreur);
  }
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

