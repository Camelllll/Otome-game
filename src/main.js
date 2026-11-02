// Point d'entrée du jeu : connecte le joueur, affiche l'écran d'accueil, puis charge l'épisode courant.
import { chargerSauvegarde, sauvegarder, sauvegarderMaintenant, recalculerActionPoints } from "./engine/saveSystem.js";
import { DialogueEngine, aplatirPersonnages } from "./engine/dialogueEngine.js";
import { getCharacters, getEpisode, getPublishedEpisodesList } from "./services/gameRepository.js";
import { debloquerIllustration, listerIllustrationsDebloquees, obtenirSessionJoueur } from "./services/playerRepository.js";
import { lancerEcranDialogue } from "./screens/dialogueScreen.js";
import { lancerEcranAccueil } from "./screens/homeScreen.js";
import { lancerEcranSelectionEpisode } from "./screens/episodeSelectScreen.js";
import { lancerEcranConnexion } from "./screens/loginScreen.js";
import { lancerEcranGalerie } from "./screens/illustrationGalleryScreen.js";
import { lancerEcranDressing } from "./screens/dressingScreen.js";
import { chargerCatalogueApparence } from "./services/appearanceRepository.js";
import { resoudreCalques } from "./engine/appearance.js";
import { demanderTexte } from "./ui/gameModal.js";

const conteneurJeu = document.getElementById("jeu");

// Liste les épisodes publiés depuis la base (l'admin publie les brouillons quand ils sont prêts).
async function listerEpisodesDisponibles() {
  return getPublishedEpisodesList();
}

// Ouvre le dressing (accessible à tout moment depuis le menu en jeu).
// `onTermine` est appelé après validation, `onRetour` si le joueur quitte sans enregistrer.
// Si le catalogue est indisponible, on revient directement : le jeu garde le sprite d'origine.
async function afficherDressing(sauvegarde, { onTermine, onRetour }) {
  const catalogue = await chargerCatalogueApparence();
  if (!catalogue) {
    onRetour();
    return;
  }
  // Sprite d'origine de Sucrette : apparence par défaut tant que rien n'est personnalisé.
  let spriteOrigine = null;
  try {
    spriteOrigine = (await getCharacters())?.player?.sprite || null;
  } catch (erreur) {
    console.warn("Sprite d'origine de Sucrette indisponible.", erreur);
  }
  lancerEcranDressing(conteneurJeu, {
    catalogue,
    sauvegarde,
    spriteOrigine,
    onRetour,
    onValider: async (apparence) => {
      sauvegarde.appearance = apparence;
      await sauvegarderMaintenant(sauvegarde);
      onTermine();
    }
  });
}

async function lancerEpisode(idEpisode, sauvegarde, joueur) {
  const [charactersData, episodeData, catalogueApparence] = await Promise.all([
    getCharacters(),
    getEpisode(idEpisode),
    chargerCatalogueApparence()
  ]);

  const personnagesParId = aplatirPersonnages(charactersData);
  // Calques de Sucrette uniquement si le joueur a personnalisé son apparence ; sinon sprite d'origine (null).
  const apparenceSucrette = catalogueApparence && sauvegarde.appearance
    ? {
        calques: resoudreCalques(sauvegarde.appearance, catalogueApparence, sauvegarde),
        canvas: catalogueApparence.canvas
      }
    : null;
  const moteur = new DialogueEngine(episodeData, personnagesParId, sauvegarde, apparenceSucrette);
  const reprendreEpisode = () => lancerEpisode(idEpisode, sauvegarde, joueur);
  const fichesPersonnages = [...(charactersData.crushs || []), ...(charactersData.secondary || [])]
    .filter((personnage) => personnage.showInCharactersMenu !== false);

  lancerEcranDialogue(conteneurJeu, moteur, {
    fichesPersonnages,
    onRetourEpisodes: () => afficherSelectionEpisode(sauvegarde, joueur),
    onRetourAccueil: joueur ? () => afficherAccueil(joueur) : null,
    onIllustrations: joueur ? () => afficherGalerie(joueur, () => lancerEpisode(idEpisode, sauvegarde, joueur)) : null,
    onDressing: () => afficherDressing(sauvegarde, { onTermine: reprendreEpisode, onRetour: reprendreEpisode }),
    onIllustrationDebloquee: (illustration) => {
      debloquerIllustration(illustration).catch((erreur) => {
        console.warn("Illustration non enregistrée dans la galerie.", erreur);
      });
    },
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

async function afficherGalerie(joueur, onRetour = () => afficherAccueil(joueur)) {
  let illustrations = [];
  try {
    illustrations = await listerIllustrationsDebloquees();
  } catch (erreur) {
    console.warn("Galerie distante indisponible.", erreur);
  }
  lancerEcranGalerie(conteneurJeu, { illustrations, onRetour });
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
    onDressing: () => {
      const retourJournal = () => afficherSelectionEpisode(sauvegarde, joueur);
      return afficherDressing(sauvegarde, { onTermine: retourJournal, onRetour: retourJournal });
    },
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
        const nomSaisi = await demanderTexte({
          titre: "Ton héroïne",
          message: "Quel prénom veux-tu lui donner ?",
          valeur: sauvegarde.playerName || "Sucrette",
          placeholder: "Sucrette",
          confirmer: "Commencer",
        });
        if (nomSaisi) sauvegarde.playerName = nomSaisi;
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

