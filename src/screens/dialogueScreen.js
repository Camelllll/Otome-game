// Écran de dialogue : affiche le décor, le personnage sur scène, sa bulle, la barre du bas et les lovomètres.
import { afficherBullePersonnage, afficherBarreNarration, afficherFinEpisode } from "../ui/dialogueBox.js";
import { afficherLovometre, animerGainLovo, animerPerteLovo } from "../ui/gaugeBar.js";
import { MusiqueAmbiance } from "../ui/backgroundMusic.js";
import { installerMenuJeu } from "../ui/gameMenu.js";
import { enregistrerRencontres, debloquerSouvenirs } from "../engine/carnet.js";
import { sauvegarder } from "../engine/saveSystem.js";
import { getIllustrationsCatalogue } from "../services/gameRepository.js";

export function lancerEcranDialogue(conteneurRacine, moteur, { onFinEpisode, onRetourEpisodes, onRetourAccueil, onIllustrations, onDressing, onIllustrationDebloquee, fichesPersonnages = [] } = {}) {
  const extrait = moteur.ephemere;
  const musique = extrait ? null : new MusiqueAmbiance();
  const scene = document.createElement("div");
  scene.className = "ecran-dialogue";

  if (!extrait) installerMenuJeu(scene, {
    musique,
    fiches: fichesPersonnages,
    getInfosPersonnage: (id) => moteur.obtenirInfosPersonnages([id])[0],
    getSauvegarde: () => moteur.sauvegarde,
    onRetourEpisodes,
    onRetourAccueil,
    onIllustrations,
    onDressing
  });

  // Le premier clic dans le jeu est nécessaire pour que les navigateurs autorisent le son.
  if (!extrait) scene.addEventListener("pointerdown", () => musique.demarrer(), { once: true });

  const decor = document.createElement("img");
  decor.className = "decor";
  scene.appendChild(decor);

  // Trois emplacements permettent de garder les interlocuteurs côte à côte dans les scènes de groupe.
  const zonePersonnages = document.createElement("div");
  zonePersonnages.className = "zone-personnages";
  const creerEmplacement = () => {
    const cadre = document.createElement("div");
    cadre.className = "cadre-personnage";
    const sprite = document.createElement("img");
    sprite.className = "sprite-personnage";
    // Les dimensions réelles du dessin ne sont connues qu'une fois l'image chargée : on repositionne la bulle ensuite.
    sprite.addEventListener("load", () => placerBulle());
    cadre.appendChild(sprite);
    zonePersonnages.appendChild(cadre);
    return { cadre, sprite, id: null };
  };
  const emplacements = [creerEmplacement(), creerEmplacement(), creerEmplacement()];
  scene.appendChild(zonePersonnages);

  const zoneBulle = document.createElement("div");
  zoneBulle.className = "zone-bulle";
  scene.appendChild(zoneBulle);

  // Deux emplacements indépendants pour gérer le cas de deux personnages présents en même temps (un à gauche, un à droite).
  const lovometreGauche = document.createElement("div");
  lovometreGauche.className = "lovometre pos-gauche";
  scene.appendChild(lovometreGauche);

  const lovometreDroite = document.createElement("div");
  lovometreDroite.className = "lovometre pos-droite";
  scene.appendChild(lovometreDroite);

  const voileIllustration = document.createElement("div");
  voileIllustration.className = "voile-illustration";
  const illustrationCg = document.createElement("img");
  illustrationCg.className = "illustration-cg";
  const fermerIllustration = document.createElement("button");
  fermerIllustration.className = "fermer-illustration";
  fermerIllustration.type = "button";
  fermerIllustration.textContent = "×";
  fermerIllustration.setAttribute("aria-label", "Fermer l'illustration");
  voileIllustration.append(illustrationCg, fermerIllustration);
  scene.appendChild(voileIllustration);

  const zoneBarre = document.createElement("div");
  zoneBarre.className = "zone-narration";
  scene.appendChild(zoneBarre);

  const zoneFinEpisode = document.createElement("div");
  zoneFinEpisode.className = "ecran-fin-episode";
  scene.appendChild(zoneFinEpisode);

  conteneurRacine.innerHTML = "";
  conteneurRacine.appendChild(scene);

  const personnagesPresents = [];
  let decorActuel = null;
  let musiqueFichierActuelle = undefined; // undefined = pas encore initialisée
  let illustrationFermee = null;
  let affichageCourant = null;
  const illustrationsSignalees = new Set();

  fermerIllustration.addEventListener("click", () => {
    illustrationFermee = moteur.nodeId;
    voileIllustration.classList.remove("visible");
  });

  function mettreAJourPersonnages(affichage) {
    if (affichage.background && affichage.background !== decorActuel) {
      decorActuel = affichage.background;
      personnagesPresents.length = 0;
      zoneBulle.replaceChildren();
    }

    if (affichage.onScreen) {
      // Mise en scène choisie explicitement dans l'admin : elle remplace la gestion automatique.
      // Une liste vide signifie « personne à l'écran » : les personnages précédents disparaissent.
      personnagesPresents.length = 0;
      affichage.onScreen.slice(0, 3).forEach((id) => {
        const personnage = moteur.personnagesParId.get(id);
        if (personnage?.sprite) personnagesPresents.push({ id, sprite: personnage.sprite });
      });
      // Sécurité : celui qui parle est forcément visible, même s'il a été oublié dans la liste.
      if (
        affichage.estPersonnageSurScene &&
        affichage.spriteScene &&
        !personnagesPresents.some((personnage) => personnage.id === affichage.speakerId)
      ) {
        if (personnagesPresents.length === 3) personnagesPresents.shift();
        personnagesPresents.push({ id: affichage.speakerId, sprite: affichage.spriteScene });
      }
    } else if (affichage.estPersonnageSurScene && affichage.spriteScene) {
      const index = personnagesPresents.findIndex((personnage) => personnage.id === affichage.speakerId);
      if (index === -1) {
        // Une scène peut afficher jusqu'à trois interlocuteurs. Le plus ancien laisse sa place à un quatrième.
        if (personnagesPresents.length === 3) personnagesPresents.shift();
        personnagesPresents.push({ id: affichage.speakerId, sprite: affichage.spriteScene });
      } else {
        personnagesPresents[index].sprite = affichage.spriteScene;
      }
    }

    emplacements.forEach((emplacement, index) => {
      const personnage = personnagesPresents[index];
      emplacement.id = personnage?.id ?? null;
      const disposition = personnagesPresents.length === 1
        ? "solo"
        : personnagesPresents.length === 2 ? `duo-${index}` : `trio-${index}`;
      emplacement.cadre.className = `cadre-personnage ${disposition}`;
      emplacement.cadre.style.visibility = personnage ? "visible" : "hidden";
      if (personnage) emplacement.sprite.src = personnage.sprite;
    });
  }

  // Les sprites contiennent de larges marges transparentes : on mesure une fois les bords réellement dessinés
  // au niveau de la tête et des épaules, pour poser la bulle juste à côté du visage.
  const bornesParSprite = new Map();

  function bornesDuDessin(sprite) {
    if (bornesParSprite.has(sprite.src)) return bornesParSprite.get(sprite.src);
    let bornes = { gauche: 0, droite: 1, haut: 0 };
    try {
      const LARGEUR = 96;
      const hauteur = Math.max(1, Math.round((sprite.naturalHeight / sprite.naturalWidth) * LARGEUR));
      const canvas = document.createElement("canvas");
      canvas.width = LARGEUR;
      canvas.height = hauteur;
      const contexte = canvas.getContext("2d", { willReadFrequently: true });
      contexte.drawImage(sprite, 0, 0, LARGEUR, hauteur);
      const { data } = contexte.getImageData(0, 0, LARGEUR, hauteur);
      // Seuil élevé pour ignorer les halos et contours semi-transparents des illustrations.
      const opaque = (x, y) => data[(y * LARGEUR + x) * 4 + 3] > 60;

      let premiereLigne = -1;
      let derniereLigne = -1;
      for (let y = 0; y < hauteur; y += 1) {
        for (let x = 0; x < LARGEUR; x += 1) {
          if (!opaque(x, y)) continue;
          if (premiereLigne === -1) premiereLigne = y;
          derniereLigne = y;
          break;
        }
      }

      if (premiereLigne !== -1) {
        const finBande = Math.min(hauteur - 1, premiereLigne + Math.max(1, Math.round((derniereLigne - premiereLigne) * 0.28)));
        let minX = LARGEUR;
        let maxX = -1;
        for (let y = premiereLigne; y <= finBande; y += 1) {
          for (let x = 0; x < LARGEUR; x += 1) {
            if (!opaque(x, y)) continue;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
          }
        }
        if (maxX >= 0) {
          bornes = { gauche: minX / LARGEUR, droite: (maxX + 1) / LARGEUR, haut: premiereLigne / hauteur };
        }
      }
    } catch {
      // Image non analysable : on retombe sur la boîte complète du sprite.
    }
    bornesParSprite.set(sprite.src, bornes);
    return bornes;
  }

  // Le cadre d'un personnage est bien plus large que son dessin (object-fit: contain) :
  // on recalcule la boîte réellement occupée par le sprite pour coller la bulle contre lui.
  function boiteDuLocuteur(speakerId) {
    const emplacement = emplacements.find((item) => item.id === speakerId);
    const sprite = emplacement?.sprite;
    if (!sprite?.naturalWidth || !sprite.naturalHeight) return null;
    const cadre = emplacement.cadre.getBoundingClientRect();
    if (!cadre.width || !cadre.height) return null;
    const echelle = Math.min(cadre.width / sprite.naturalWidth, cadre.height / sprite.naturalHeight);
    const largeur = sprite.naturalWidth * echelle;
    const hauteur = sprite.naturalHeight * echelle;
    const bornes = bornesDuDessin(sprite);
    const bordGauche = cadre.left + (cadre.width - largeur) / 2;
    const sommet = cadre.bottom - hauteur + hauteur * bornes.haut;
    return {
      gauche: bordGauche + largeur * bornes.gauche,
      droite: bordGauche + largeur * bornes.droite,
      haut: sommet
    };
  }

  // La bulle se place du côté extérieur du locuteur : celui de gauche parle vers la gauche, celui de droite vers la droite.
  function coteDeBulle(affichage, boite) {
    if (affichage.position === "left") return "gauche";
    if (affichage.position === "right") return "droite";
    if (!boite) return "droite";
    const rectScene = scene.getBoundingClientRect();
    return (boite.gauche + boite.droite) / 2 < rectScene.left + rectScene.width / 2 ? "gauche" : "droite";
  }

  // Colle la bulle contre le sprite, à hauteur de tête, sans jamais sortir de l'écran.
  function placerBulle() {
    const bulle = zoneBulle.firstElementChild;
    if (!bulle || !affichageCourant) return;

    const boite = boiteDuLocuteur(affichageCourant.speakerId);
    const cote = coteDeBulle(affichageCourant, boite);
    bulle.classList.toggle("cote-gauche", cote === "gauche");
    bulle.classList.toggle("cote-droite", cote === "droite");

    if (!boite) {
      bulle.style.left = "";
      bulle.style.right = "";
      bulle.style.top = "";
      return;
    }

    const rectScene = scene.getBoundingClientRect();
    const MARGE = 14;
    const largeur = bulle.offsetWidth;
    const gauche = cote === "gauche"
      ? boite.gauche - rectScene.left - MARGE - largeur
      : boite.droite - rectScene.left + MARGE;

    const gaucheFinale = Math.max(10, Math.min(rectScene.width - largeur - 10, gauche));
    bulle.style.left = `${gaucheFinale}px`;
    bulle.style.right = "auto";
    bulle.style.top = `${hautDeBulle(rectScene, gaucheFinale, gaucheFinale + largeur, boite)}px`;
  }

  // La bulle glisse sous le lovomètre et le menu quand elle se retrouve dans leur colonne.
  function hautDeBulle(rectScene, bulleGauche, bulleDroite, boite) {
    let minimum = 12;
    const obstacles = [lovometreGauche, lovometreDroite, scene.querySelector(".bouton-menu")];
    for (const obstacle of obstacles) {
      if (!obstacle?.offsetWidth) continue;
      const rect = obstacle.getBoundingClientRect();
      if (rect.right - rectScene.left < bulleGauche - 8 || rect.left - rectScene.left > bulleDroite + 8) continue;
      minimum = Math.max(minimum, rect.bottom - rectScene.top + 10);
    }
    const haut = Math.max(minimum, boite.haut - rectScene.top + 10);
    const maximum = Math.max(12, rectScene.height - (zoneBarre.offsetHeight || 0) - zoneBulle.firstElementChild.offsetHeight - 12);
    return Math.min(haut, maximum);
  }

  let observateur;
  if (extrait) {
    observateur = new ResizeObserver(() => {
      if (!scene.isConnected) {
        observateur.disconnect();
        return;
      }
      scene.style.setProperty("--hauteur-barre", `${zoneBarre.offsetHeight || 0}px`);
      placerBulle();
    });
    observateur.observe(scene);
    observateur.observe(zoneBarre);
  } else {
    window.addEventListener("resize", placerBulle);
  }

  // Carnet de relations : illustrations définies dans le studio (chargées une fois, en arrière-plan).
  let catalogueSouvenirs = [];

  // « Niveau de révélation » (1 à 3) de l'illustration déclenchée par ce nœud.
  // Niveau 1 par défaut si la fiche est introuvable ou si le catalogue n'est pas encore arrivé.
  const RARETES_VALIDES = new Set(["common", "rare", "ultra_rare", "legendary"]);

  function niveauRevelation(nodeId) {
    const fiche = catalogueSouvenirs.find(
      (illustration) =>
        illustration.unlockNodeId === nodeId &&
        (!illustration.episodeId || illustration.episodeId === moteur.episodeData.id)
    );
    const niveau = Number(fiche?.spoilerLevel);
    return niveau >= 1 && niveau <= 3 ? niveau : 1;
  }

  function rareteIllustration(nodeId) {
    const fiche = catalogueSouvenirs.find(
      (illustration) =>
        illustration.unlockNodeId === nodeId &&
        (!illustration.episodeId || illustration.episodeId === moteur.episodeData.id)
    );
    const rarete = fiche?.rarity;
    return RARETES_VALIDES.has(rarete) ? rarete : "common";
  }

  // Un personnage est « rencontré » dès qu'il apparaît réellement dans une scène jouée
  // (il parle ou il est à l'écran). Un souvenir se débloque quand son moment est affiché.
  function suivreCarnet(affichage) {
    const sauvegardeJeu = moteur.sauvegarde;
    if (extrait || !sauvegardeJeu || !affichage) return;

    const idsVus = [...(affichage.onScreen || []), ...personnagesPresents.map((personnage) => personnage.id)];
    if (affichage.estPersonnageSurScene) idsVus.push(affichage.speakerId);

    // La réponse de Sucrette fusionnée dans la bulle est aussi affichée : son nœud compte comme vu.
    const idsNoeuds = [affichage.nodeId];
    if (affichage.reponseSucrette && moteur.noeudCourant?.next) idsNoeuds.push(moteur.noeudCourant.next);

    const rencontre = enregistrerRencontres(sauvegardeJeu, idsVus, moteur.personnagesParId);
    const souvenir = debloquerSouvenirs(sauvegardeJeu, catalogueSouvenirs, moteur.episodeData.id, idsNoeuds);
    if (rencontre || souvenir) sauvegarder(sauvegardeJeu);
  }

  if (!extrait) getIllustrationsCatalogue().then((liste) => {
    catalogueSouvenirs = liste;
    // Le premier nœud a pu s'afficher avant l'arrivée du catalogue : on revérifie l'écran courant.
    if (liste.length) suivreCarnet(affichageCourant);
  });

  function rendre() {
    const affichage = moteur.obtenirAffichage();
    if (!affichage) return;
    affichageCourant = affichage;

    if (affichage.background) decor.src = affichage.background;
    mettreAJourPersonnages(affichage);
    suivreCarnet(affichage);

    // BGM de scène : on change la piste seulement quand l'URL évolue (évite les redémarrages inutiles).
    const urlMusique = affichage.music || null;
    if (urlMusique !== musiqueFichierActuelle) {
      musiqueFichierActuelle = urlMusique;
      musique?.jouerFichier(urlMusique);
    }

    if (affichage.cg && illustrationFermee !== affichage.nodeId) {
      const dejaVisible = voileIllustration.classList.contains("visible");
      illustrationCg.src = affichage.cg;
      voileIllustration.dataset.niveau = String(niveauRevelation(affichage.nodeId));
      voileIllustration.dataset.rarete = rareteIllustration(affichage.nodeId);
      voileIllustration.classList.add("visible");
      // Le jingle ne se joue qu'à l'apparition, pas à chaque nouveau rendu pendant que l'illustration reste ouverte.
      if (!dejaVisible) musique?.jouerJingleRevelation(Number(voileIllustration.dataset.niveau));
      if (!illustrationsSignalees.has(affichage.nodeId)) {
        illustrationsSignalees.add(affichage.nodeId);
        if (!extrait) onIllustrationDebloquee?.({
          path: affichage.cg,
          episodeId: moteur.episodeData.id,
          nodeId: affichage.nodeId,
        });
      }
    } else {
      voileIllustration.classList.remove("visible");
    }

    afficherBullePersonnage(zoneBulle, affichage, coteDeBulle(affichage, boiteDuLocuteur(affichage.speakerId)));

    // Le lovo-meter reste réservé aux scènes en tête-à-tête : il disparaît dès qu'un second personnage arrive.
    const [infoLovo] = personnagesPresents.length === 1
      ? moteur.obtenirInfosPersonnages([personnagesPresents[0].id])
      : [];
    afficherLovometre(lovometreGauche, infoLovo);
    afficherLovometre(lovometreDroite, null);

    if (affichage.type === "end") {
      zoneBarre.style.display = "none";
      musique?.arreterFichier();
      afficherFinEpisode(zoneFinEpisode, {
        extrait,
        aProchainEpisode: Boolean(affichage.nextEpisode),
        onContinuer: () => onFinEpisode?.(affichage.nextEpisode),
      });
    } else {
      zoneBarre.style.display = "";
      zoneFinEpisode.classList.remove("visible");
      zoneFinEpisode.innerHTML = "";

      afficherBarreNarration(zoneBarre, affichage, {
        onSuivant: () => {
          // La réponse de Sucrette est déjà visible sous la bulle : on la valide avec ce clic et on passe à son nœud suivant.
          if (affichage.reponseSucrette?.next) moteur.aller(affichage.reponseSucrette.next);
          else moteur.avancer();
          rendre();
        },
        onChoix: (index) => {
          const option = moteur.noeudCourant?.options?.[index];
          // Un choix peut modifier plusieurs lovomètres : l'animation suit la somme des variations.
          const variation = Object.values(option?.effects || {})
            .flatMap((jauges) => Object.values(jauges || {}))
            .reduce((total, delta) => total + delta, 0);
          if (variation > 0) animerGainLovo(scene, variation);
          if (variation < 0) animerPerteLovo(scene, variation);
          moteur.choisir(index);
          rendre();
          return () => {
            observateur?.disconnect();
            if (!extrait) window.removeEventListener("resize", placerBulle);
          };
        }
      });
    }

    // Le personnage, les jauges et les CG disposent uniquement de l'espace au-dessus de la barre.
    // On mesure la barre après son rendu afin d'empêcher tout chevauchement, même pour un texte long.
    const hauteurBarre = zoneBarre.offsetHeight || 0;
    scene.style.setProperty("--hauteur-barre", `${hauteurBarre}px`);

    // Placée en dernier : le lovomètre et la barre sont alors dans leur état définitif.
    placerBulle();
  }

  rendre();
}
