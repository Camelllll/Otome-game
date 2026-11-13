// Point d'entrée du jeu : connecte le joueur, affiche l'écran d'accueil, puis charge l'épisode courant.
import { chargerSauvegarde, confirmerSauvegarde, sauvegarder, sauvegarderMaintenant, recalculerActionPoints } from "./engine/saveSystem.js";
import { DialogueEngine, aplatirPersonnages } from "./engine/dialogueEngine.js";
import { getCharacters, getEpisode, getPublishedEpisodesList } from "./services/gameRepository.js";
import { debloquerIllustration, listerIllustrationsDebloquees, obtenirSessionJoueur } from "./services/playerRepository.js";
import { lancerEcranDialogue } from "./screens/dialogueScreen.js";
import { lancerEcranAccueil } from "./screens/homeScreen.js";
import { lancerEcranSelectionEpisode } from "./screens/episodeSelectScreen.js";
import { lancerEcranConnexion } from "./screens/loginScreen.js";
import { lancerEcranGalerie } from "./screens/illustrationGalleryScreen.js";
import { lancerEcranDressing } from "./screens/dressingScreen.js";
import { accorderPiecesDemo, reconcilierPossessions } from "./engine/wardrobe.js";
import { chargerCatalogueApparence } from "./services/appearanceRepository.js";
import { resoudreCalques } from "./engine/appearance.js";
import { listerFichesCarnet } from "./engine/carnet.js";
import { demanderTexte } from "./ui/gameModal.js";

const conteneurJeu = document.getElementById("jeu");

// ─── Routeur hash ────────────────────────────────────────────────────────────
// Chaque écran met à jour le hash ; au rechargement on relit ce hash pour
// reprendre directement au bon endroit (sans repasser par l'accueil).
//
// Routes reconnues :
//   #bienvenue (landing page ; également affichée sans hash)
//   #accueil
//   #episodes
//   #episode/<idEpisode>
//   #dressing
//   #galerie
//
// La navigation "retour" du navigateur (ou popstate) n'est pas gérée : le hash
// sert uniquement à survivre à un F5, pas à implémenter un historique.

function lireRoute() {
  const hash = location.hash.slice(1); // retire le "#"
  if (!hash) return { ecran: null };
  const [ecran, ...params] = hash.split("/");
  return { ecran, params };
}

function allerVers(route) {
  // On remplace l'entrée courante plutôt que d'empiler dans l'historique :
  // ça évite que le bouton "retour" du navigateur recharge l'écran précédent
  // en boucle au lieu de quitter le jeu.
  history.replaceState(null, "", `#${route}`);
}

// ─────────────────────────────────────────────────────────────────────────────

// Liste les épisodes publiés depuis la base (l'admin publie les brouillons quand ils sont prêts).
async function listerEpisodesDisponibles() {
  return getPublishedEpisodesList();
}

// Ouvre le dressing (accessible à tout moment depuis le menu en jeu).
// `onTermine` est appelé après validation, `onRetour` si le joueur quitte sans enregistrer.
// Si le catalogue est indisponible, on revient directement : le jeu garde le sprite d'origine.
async function afficherDressing(sauvegarde, { onTermine, onRetour, joueur = null }) {
  allerVers("dressing");
  const catalogue = await chargerCatalogueApparence();
  if (!catalogue) {
    onRetour();
    return;
  }
  // Sprite d'origine de Sucrette : apparence par défaut tant que rien n'est personnalisé.
  let spriteOrigine = null;
  let fichesPersonnages = [];
  try {
    const personnages = await getCharacters();
    spriteOrigine = personnages?.player?.sprite || null;
    fichesPersonnages = listerFichesCarnet(personnages);
  } catch (erreur) {
    console.warn("Sprite d'origine de Sucrette indisponible.", erreur);
  }
  // Boutique : un élément déjà porté devient possédé, et la monnaie de démonstration est versée une seule fois.
  const inventaireModifie = reconcilierPossessions(catalogue, sauvegarde);
  const piecesVersees = accorderPiecesDemo(sauvegarde);
  if (inventaireModifie || piecesVersees) {
    if (!await confirmerSauvegarde(sauvegarde)) {
      console.warn("Boutique du dressing : initialisation en attente de synchronisation.");
    }
  }
  let nettoyer = () => {};
  const quitter = (action) => () => { nettoyer(); return action(); };
  nettoyer = lancerEcranDressing(conteneurJeu, {
    catalogue,
    sauvegarde,
    spriteOrigine,
    fichesPersonnages,
    onRetour: quitter(onRetour),
    navigation: {
      scenario: quitter(() => afficherSelectionEpisode(sauvegarde, joueur)),
      ...(joueur ? {
        accueil: quitter(() => afficherAccueil(joueur)),
        galerie: quitter(() => afficherGalerie(joueur, onRetour)),
      } : {}),
    },
    // sauvegarderMaintenant ne rejette jamais : elle renvoie null quand le serveur n'a pas confirmé.
    // On lève alors une erreur pour que l'écran annule l'achat (monnaie et inventaire).
    onAchat: async (annuler) => {
      const confirmee = await confirmerSauvegarde(sauvegarde);
      if (!confirmee) {
        annuler();
        // Remplace aussi le tampon hors-ligne : il ne doit pas rejouer un achat annulé.
        sauvegarder(sauvegarde);
        throw new Error("Achat non confirmé par le serveur.");
      }
    },
    onValider: async (apparence) => {
      const precedente = sauvegarde.appearance;
      sauvegarde.appearance = apparence;
      if (!await confirmerSauvegarde(sauvegarde)) {
        sauvegarde.appearance = precedente;
        sauvegarder(sauvegarde);
        throw new Error("Apparence non confirmée par le serveur.");
      }
      nettoyer();
      onTermine();
    }
  });
}

async function lancerEpisode(idEpisode, sauvegarde, joueur) {
  allerVers(`episode/${idEpisode}`);
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
  const fichesPersonnages = listerFichesCarnet(charactersData);

  lancerEcranDialogue(conteneurJeu, moteur, {
    fichesPersonnages,
    onRetourEpisodes: () => afficherSelectionEpisode(sauvegarde, joueur),
    onRetourAccueil: joueur ? () => afficherAccueil(joueur) : null,
    onIllustrations: joueur ? () => afficherGalerie(joueur, () => lancerEpisode(idEpisode, sauvegarde, joueur)) : null,
    onDressing: () => afficherDressing(sauvegarde, { onTermine: reprendreEpisode, onRetour: reprendreEpisode, joueur }),
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
  allerVers("galerie");
  let illustrations = [];
  try {
    illustrations = await listerIllustrationsDebloquees();
  } catch (erreur) {
    console.warn("Galerie distante indisponible.", erreur);
  }
  lancerEcranGalerie(conteneurJeu, { illustrations, onRetour });
}

async function afficherSelectionEpisode(sauvegarde, joueur) {
  allerVers("episodes");
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
      return afficherDressing(sauvegarde, { onTermine: retourJournal, onRetour: retourJournal, joueur });
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
  allerVers("accueil");
  await lancerEcranAccueil(conteneurJeu, {
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

function afficherEntree(joueur, sauvegarde) {
  allerVers("bienvenue");
  const retour = () => afficherEntree(joueur, sauvegarde);
  const executer = async (action) => {
    try {
      await action();
    } catch (erreur) {
      console.error("Navigation depuis l'accueil impossible.", erreur);
      retour();
      await demanderConfirmation({
        titre: "Campus indisponible",
        message: erreur.message || "Impossible de charger cet écran. Réessaie dans un instant.",
        confirmer: "Fermer",
        annuler: "Retour",
      });
    }
  };
  lancerEcranConnexion(conteneurJeu, {
    joueur,
    sauvegarde,
    onContinuer: () => executer(async () => {
      recalculerActionPoints(sauvegarde);
      if (sauvegarde.currentNode) {
        await lancerEpisode(sauvegarde.currentEpisode, sauvegarde, joueur);
      } else {
        await afficherSelectionEpisode(sauvegarde, joueur);
      }
    }),
    onDressing: () => executer(() => afficherDressing(sauvegarde, { onTermine: retour, onRetour: retour, joueur })),
    onGalerie: () => executer(() => afficherGalerie(joueur, retour)),
    onAccueil: () => executer(() => afficherAccueil(joueur)),
  });
}

// ─── Reprise depuis le hash au rechargement ───────────────────────────────────
// On tente de rétablir l'écran courant sans repasser par l'accueil.
// Si le joueur n'est plus connecté, on retombe sur l'écran de connexion.
async function reprendreDepuisHash(joueur, sauvegarde) {
  const { ecran, params } = lireRoute();

  switch (ecran) {
    case null:
    case "bienvenue":
      afficherEntree(joueur, sauvegarde);
      return;
    case "episode": {
      const idEpisode = params?.[0] || sauvegarde.currentEpisode;
      if (idEpisode) {
        await lancerEpisode(idEpisode, sauvegarde, joueur);
        return;
      }
      // Pas d'id d'épisode lisible → sélection
      await afficherSelectionEpisode(sauvegarde, joueur);
      return;
    }
    case "episodes":
      await afficherSelectionEpisode(sauvegarde, joueur);
      return;
    case "dressing":
      await afficherDressing(sauvegarde, {
        onTermine: () => afficherSelectionEpisode(sauvegarde, joueur),
        onRetour: () => afficherSelectionEpisode(sauvegarde, joueur),
        joueur,
      });
      return;
    case "galerie":
      await afficherGalerie(joueur, () => afficherAccueil(joueur));
      return;
    case "accueil":
    default:
      await afficherAccueil(joueur);
  }
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
    // On a une session : essaie de reprendre là où le joueur en était.
    const sauvegarde = await chargerSauvegarde(joueurExistant.id);
    recalculerActionPoints(sauvegarde);
    await reprendreDepuisHash(joueurExistant, sauvegarde);
    return;
  }

  // Pas de session : écran de connexion, puis reprendre depuis le hash (ou accueil par défaut).
  lancerEcranConnexion(conteneurJeu, {
    onConnecte: async (joueur) => {
      const sauvegarde = await chargerSauvegarde(joueur.id);
      recalculerActionPoints(sauvegarde);
      // Le hash précédent appartient peut-être à une autre session.
      afficherEntree(joueur, sauvegarde);
    }
  });
}

demarrer().catch((erreur) => {
  console.error(erreur);
  conteneurJeu.textContent = "Erreur au chargement du jeu. Consulte la console.";
});