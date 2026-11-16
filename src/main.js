// Point d'entrée du jeu : connecte le joueur, affiche l'écran d'accueil, puis charge l'épisode courant.
import { chargerSauvegarde, chargerDerniereProgression, aUneProgression, reinitialiserSauvegarde, confirmerSauvegarde, sauvegarder, sauvegarderMaintenant, recalculerActionPoints, attendreJournalChoix, preparerSortieSession, fermerSessionSauvegarde } from "./engine/saveSystem.js";
import { DialogueEngine, aplatirPersonnages } from "./engine/dialogueEngine.js";
import { getCharacters, getEpisode, getPublishedEpisodesList } from "./services/gameRepository.js";
import { debloquerIllustration, obtenirSessionJoueur } from "./services/playerRepository.js";
import { lancerEcranDialogue } from "./screens/dialogueScreen.js";
import { lancerEcranSelectionEpisode } from "./screens/episodeSelectScreen.js";
import { lancerEcranConnexion } from "./screens/loginScreen.js";
import { lancerEcranProfil } from "./screens/profileScreen.js";
import { lancerEcranCompte } from "./screens/accountScreen.js";
import { lancerEcranDressing } from "./screens/dressingScreen.js";
import { accorderPiecesDemo, reconcilierPossessions } from "./engine/wardrobe.js";
import { chargerCatalogueApparence } from "./services/appearanceRepository.js";
import { resoudreCalques } from "./engine/appearance.js";
import { listerFichesCarnet } from "./engine/carnet.js";
import { normaliserNomJoueur } from "./engine/playerName.js";
import { demanderConfirmation } from "./ui/gameModal.js";

const conteneurJeu = document.getElementById("jeu");
let restaurationHistorique = true;
let indexHistorique = history.state?.campusIndex ?? 0;
let ignorerRetour = false;
let sortieEcran = null;
history.replaceState({ ...history.state, campusIndex: indexHistorique }, "", location.hash || "#bienvenue");

// ─── Routeur hash ────────────────────────────────────────────────────────────
// Chaque écran met à jour le hash ; au rechargement on relit ce hash pour
// reprendre directement au bon endroit (sans repasser par l'accueil).
//
// Routes reconnues :
//   #bienvenue (présentation publique ; redirige vers les épisodes si connecté)
//   #accueil (ancien lien, redirigé vers #episodes)
//   #episodes (accueil du jeu)
//   #episode/<idEpisode>
//   #dressing
//   #galerie
//
// Les retours navigateur restaurent l'écran sans empiler une nouvelle entrée.

function lireRoute() {
  const hash = location.hash.slice(1); // retire le "#"
  if (!hash) return { ecran: null };
  const [ecran, ...params] = hash.split("/");
  return { ecran, params };
}

function allerVers(route) {
  const hash = `#${route}`;
  if (location.hash === hash) return;
  if (!restaurationHistorique) indexHistorique += 1;
  history[restaurationHistorique ? "replaceState" : "pushState"](
    { campusIndex: indexHistorique }, "", hash,
  );
}

function lireEmplacementActif(joueur) {
  try {
    const valeur = sessionStorage.getItem(`otome-slot-actif-${joueur.id}`);
    const slot = valeur === null ? 0 : Number(valeur);
    return Number.isInteger(slot) && slot >= 0 && slot <= 9 ? slot : 0;
  } catch (erreur) {
    console.warn("Emplacement actif indisponible.", erreur);
    return 0;
  }
}

function memoriserEmplacementActif(joueur, slot) {
  try {
    sessionStorage.setItem(`otome-slot-actif-${joueur.id}`, String(slot));
  } catch (erreur) {
    console.warn("Impossible de conserver l'emplacement actif.", erreur);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

// Liste les épisodes publiés depuis la base (l'admin publie les brouillons quand ils sont prêts).
async function listerEpisodesDisponibles() {
  return getPublishedEpisodesList();
}

// Ouvre le dressing (accessible à tout moment depuis le menu en jeu).
// `onTermine` est appelé après validation, `onRetour` si le joueur quitte sans enregistrer.
// Un catalogue indisponible est signalé sans quitter l'écran courant.
async function afficherDressing(sauvegarde, { onTermine, onRetour, joueur = null }) {
  if (joueur) sauvegarde.playerName = normaliserNomJoueur(joueur.pseudo);
  const catalogue = await chargerCatalogueApparence();
  if (!catalogue) {
    await demanderConfirmation({
      titre: "Dressing indisponible",
      message: "Le catalogue n'a pas pu être chargé. Réessaie dans un instant.",
      confirmer: "Fermer", annuler: null,
    });
    return;
  }
  // Sprite d'origine de Pommette : apparence par défaut tant que rien n'est personnalisé.
  let spriteOrigine = null;
  let fichesPersonnages = [];
  try {
    const personnages = await getCharacters();
    spriteOrigine = personnages?.player?.sprite || null;
    fichesPersonnages = listerFichesCarnet(personnages);
  } catch (erreur) {
    console.warn("Sprite d'origine de Pommette indisponible.", erreur);
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
  let verifierSortie = async () => true;
  const terminer = () => {
    if (sortieEcran === sortieDressing) sortieEcran = null;
    nettoyer();
  };
  const sortieDressing = {
    confirmer: () => verifierSortie(),
    nettoyer: terminer,
  };
  sortieEcran = sortieDressing;
  const quitter = (action) => async () => {
    if (!await sortieDressing.confirmer()) return;
    let ferme = false;
    try {
      await preparerSortieSession();
      terminer();
      ferme = true;
      await action();
    } catch (erreur) {
      console.error("Navigation depuis le dressing impossible.", erreur);
      await demanderConfirmation({
        titre: "Navigation impossible", message: erreur.message, confirmer: "Fermer", annuler: null,
      });
      if (ferme) await afficherDressing(sauvegarde, { onTermine, onRetour, joueur });
    }
  };
  allerVers("dressing");
  nettoyer = lancerEcranDressing(conteneurJeu, {
    catalogue,
    sauvegarde,
    spriteOrigine,
    fichesPersonnages,
    enregistrerGardeSortie: verifier => { verifierSortie = verifier; },
    onRetour: quitter(onRetour),
    onProfil: joueur ? quitter(() => afficherProfil(joueur, onRetour)) : null,
    navigation: {
      scenario: quitter(() => afficherSelectionEpisode(sauvegarde, joueur)),
      ...(joueur ? {
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
      terminer();
      await onTermine();
    }
  });
}

async function lancerEpisode(idEpisode, sauvegarde, joueur) {
  if (joueur) sauvegarde.playerName = normaliserNomJoueur(joueur.pseudo);
  const [charactersData, episodeData, catalogueApparence] = await Promise.all([
    getCharacters(),
    getEpisode(idEpisode),
    chargerCatalogueApparence()
  ]);

  const personnagesParId = aplatirPersonnages(charactersData);
  // Calques de Pommette uniquement si le joueur a personnalisé son apparence ; sinon sprite d'origine (null).
  const apparencePommette = catalogueApparence && sauvegarde.appearance
    ? {
        calques: resoudreCalques(sauvegarde.appearance, catalogueApparence, sauvegarde),
        canvas: catalogueApparence.canvas
      }
    : null;
  const moteur = new DialogueEngine(episodeData, personnagesParId, sauvegarde, apparencePommette);
  const reprendreEpisode = () => lancerEpisode(idEpisode, sauvegarde, joueur);
  const fichesPersonnages = listerFichesCarnet(charactersData);

  allerVers(`episode/${idEpisode}`);
  lancerEcranDialogue(conteneurJeu, moteur, {
    fichesPersonnages,
    onRetourEpisodes: () => afficherSelectionEpisode(sauvegarde, joueur),
    onIllustrations: joueur ? () => afficherGalerie(joueur, () => lancerEpisode(idEpisode, sauvegarde, joueur)) : null,
    onDressing: () => afficherDressing(sauvegarde, { onTermine: reprendreEpisode, onRetour: reprendreEpisode, joueur }),
    onProfil: joueur ? () => afficherProfil(joueur, reprendreEpisode) : null,
    onIllustrationDebloquee: async (illustration) => {
      await attendreJournalChoix();
      return debloquerIllustration({ ...illustration, slot: sauvegarde.slot ?? 0 });
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

async function afficherProfil(joueur, onRetour = null, onglet = "apercu") {
  if (!joueur) {
    await afficherAccueil(null);
    return;
  }
  if (onglet === "trophees") onglet = "apercu";
  const routeOnglet = id => id === "illustrations" ? "galerie" : id === "statistiques" ? "profil/statistiques" : "profil";
  allerVers(routeOnglet(onglet));
  const accueil = () => afficherAccueil(joueur);
  await lancerEcranProfil(conteneurJeu, {
    joueur,
    onRetour: onRetour || accueil,
    onAccueil: accueil,
    libelleRetour: onRetour ? "Retour au jeu" : "Accueil",
    onglet,
    onOnglet: id => allerVers(routeOnglet(id)),
    onChargerRelations: async () => {
      await preparerSortieSession();
      const [personnages, sauvegarde] = await Promise.all([
        getCharacters(), chargerDerniereProgression(joueur.id),
      ]);
      return {
        fiches: listerFichesCarnet(personnages),
        getSauvegarde: () => sauvegarde,
        getInfosPersonnage: id => ({ gauges: sauvegarde?.gauges?.[id] || {} }),
      };
    },
    onCompte: () => afficherCompte(joueur, onRetour),
    onAvantDeconnexion: preparerSortieSession,
    onDeconnecte: () => { fermerSessionSauvegarde(); return afficherAccueil(null); },
  });
}

async function afficherGalerie(joueur, onRetour = null) {
  return afficherProfil(joueur, onRetour, "illustrations");
}

async function afficherCompte(joueur, onRetour = null) {
  if (!joueur) return afficherAccueil(null);
  await preparerSortieSession();
  allerVers("compte");
  await lancerEcranCompte(conteneurJeu, {
    joueur, onRetour: onRetour || (() => afficherAccueil(joueur)),
    onAccueil: () => afficherAccueil(joueur),
    libelleRetour: onRetour ? "Retour au jeu" : "Accueil",
    onProfil: () => afficherProfil(joueur, onRetour),
    onModifie: compte => { joueur.pseudo = compte.pseudo; },
    onAvantSuppression: preparerSortieSession,
    onSupprime: () => { fermerSessionSauvegarde(); return afficherAccueil(null); },
  });
}

async function afficherSelectionEpisode(sauvegarde, joueur) {
  if (joueur) sauvegarde.playerName = normaliserNomJoueur(joueur.pseudo);
  const episodes = await listerEpisodesDisponibles();
  let fichesPersonnages = [];
  try {
    fichesPersonnages = listerFichesCarnet(await getCharacters());
  } catch (erreur) {
    console.warn("Relations indisponibles dans le menu des épisodes.", erreur);
  }
  const completes = new Set(sauvegarde.completedEpisodes || []);
  // Pas de verrouillage pour l'instant (en développement, il faut pouvoir tester n'importe quel épisode) :
  // seul un badge "terminé" reste affiché à titre indicatif.
  const episodesAvecStatut = episodes.map((episode) => ({
    ...episode,
    complete: completes.has(episode.id),
    verrouille: false,
  }));

  allerVers("episodes");
  lancerEcranSelectionEpisode(conteneurJeu, {
    episodes: episodesAvecStatut,
    episodeActuel: sauvegarde.currentEpisode,
    joueur,
    sauvegarde,
    fichesPersonnages,
    onProfil: joueur ? () => afficherProfil(joueur) : null,
    onCompte: joueur ? () => afficherCompte(joueur) : null,
    onNouvellePartie: joueur && aUneProgression(sauvegarde) ? async () => {
      if (!await demanderConfirmation({
        titre: "Recommencer l'histoire ?",
        message: "La partie principale (emplacement 0) sera remise à zéro. Les autres emplacements et tes illustrations acquises seront conservés.",
        confirmer: "Recommencer", annuler: "Annuler", avertissement: true,
      })) return;
      const nouvelle = await reinitialiserSauvegarde(joueur.id, 0);
      Object.assign(sauvegarde, nouvelle);
      memoriserEmplacementActif(joueur, nouvelle.slot ?? 0);
      await afficherSelectionEpisode(sauvegarde, joueur);
    } : null,
    onDressing: () => {
      const retourJournal = () => afficherSelectionEpisode(sauvegarde, joueur);
      return afficherDressing(sauvegarde, { onTermine: retourJournal, onRetour: retourJournal, joueur });
    },
    onSelect: async (idEpisode) => {
      if (idEpisode !== sauvegarde.currentEpisode && sauvegarde.currentNode && !completes.has(sauvegarde.currentEpisode)) {
        if (!await demanderConfirmation({
          titre: "Changer d'épisode ?",
          message: "Le point de reprise de l'épisode en cours sera remplacé. Tes choix et tes collections seront conservés.",
          confirmer: "Changer d'épisode",
          annuler: "Rester ici",
          avertissement: true,
        })) return;
      }
      const precedente = {
        currentEpisode: sauvegarde.currentEpisode,
        currentNode: sauvegarde.currentNode,
        currentBackground: sauvegarde.currentBackground,
      };
      // Ne remet le dialogue à zéro que si on change réellement d'épisode.
      if (idEpisode !== sauvegarde.currentEpisode) {
        sauvegarde.currentEpisode = idEpisode;
        sauvegarde.currentNode = null;
        sauvegarde.currentBackground = null;
      }
      try {
        await lancerEpisode(idEpisode, sauvegarde, joueur);
        if (idEpisode !== precedente.currentEpisode) sauvegarder(sauvegarde);
      } catch (erreur) {
        Object.assign(sauvegarde, precedente);
        throw erreur;
      }
    }
  });
}

async function afficherAccueil(joueur) {
  if (!joueur) {
    afficherEntree();
    return;
  }
  await preparerSortieSession();
  const sauvegarde = await chargerDerniereProgression(joueur.id) || await chargerSauvegarde(joueur.id);
  memoriserEmplacementActif(joueur, sauvegarde.slot ?? 0);
  recalculerActionPoints(sauvegarde);
  await afficherSelectionEpisode(sauvegarde, joueur);
}

function afficherEntree() {
  allerVers("bienvenue");
  lancerEcranConnexion(conteneurJeu, {
    onConnecte: joueur => afficherAccueil(joueur),
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
      await afficherAccueil(joueur);
      return;
    case "episode": {
      const idEpisode = params?.[0] || sauvegarde.currentEpisode;
      if (idEpisode && idEpisode === sauvegarde.currentEpisode) {
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
    case "illustrations":
      await afficherGalerie(joueur);
      return;
    case "profil":
      await afficherProfil(joueur, null, params?.[0] || "apercu");
      return;
    case "trophees":
      await afficherProfil(joueur);
      return;
    case "compte":
    case "parametres":
      await afficherCompte(joueur);
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
    if ([null, "bienvenue", "accueil", "episodes"].includes(lireRoute().ecran)) {
      await afficherAccueil(joueurExistant);
      return;
    }
    // On a une session : essaie de reprendre là où le joueur en était.
    const sauvegarde = await chargerSauvegarde(joueurExistant.id, lireEmplacementActif(joueurExistant));
    recalculerActionPoints(sauvegarde);
    await reprendreDepuisHash(joueurExistant, sauvegarde);
    return;
  }

  afficherEntree();
}

window.addEventListener("popstate", async event => {
  if (ignorerRetour) {
    ignorerRetour = false;
    return;
  }
  const cible = event.state?.campusIndex;
  if (!Number.isInteger(cible)) return;
  const precedent = indexHistorique;
  const sortiePrecedente = sortieEcran;
  try {
    if (sortiePrecedente && !await sortiePrecedente.confirmer()) {
      ignorerRetour = true;
      history.go(precedent - cible);
      return;
    }
    await preparerSortieSession();
    restaurationHistorique = true;
    indexHistorique = cible;
    await demarrer();
    sortiePrecedente?.nettoyer();
  } catch (erreur) {
    console.error("Retour navigateur impossible.", erreur);
    indexHistorique = precedent;
    ignorerRetour = true;
    history.go(precedent - cible);
    await demanderConfirmation({
      titre: "Retour impossible", message: erreur.message, confirmer: "Fermer", annuler: null,
    });
  } finally {
    restaurationHistorique = false;
  }
});

demarrer().catch((erreur) => {
  console.error(erreur);
  conteneurJeu.textContent = "Erreur au chargement du jeu. Consulte la console.";
}).finally(() => {
  restaurationHistorique = false;
});