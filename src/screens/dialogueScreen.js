// Écran de dialogue : affiche le décor, le personnage sur scène, sa bulle, la barre du bas et les lovomètres.
import { afficherBullePersonnage, afficherBarreNarration, afficherFinEpisode } from "../ui/dialogueBox.js";
import { afficherLovometre, animerGainLovo, animerPerteLovo } from "../ui/gaugeBar.js";
import { MusiqueAmbiance } from "../ui/backgroundMusic.js";
import { installerMenuJeu } from "../ui/gameMenu.js";
import { enregistrerRencontres } from "../engine/carnet.js";
import { sauvegarder } from "../engine/saveSystem.js";
import { getIllustrationsCatalogue } from "../services/gameRepository.js";
import { chargerImagePrivee } from "../services/apiClient.js";
import { ajustementScene, imageScenePrete, tailleDuPersonnage } from "../ui/stageSizing.js";

export function lancerEcranDialogue(conteneurRacine, moteur, { onFinEpisode, onRetourEpisodes, onIllustrations, onDressing, onProfil, onIllustrationDebloquee, fichesPersonnages = [] } = {}) {
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
    onIllustrations,
    onDressing,
    onProfil,
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
    const emplacement = { cadre, sprite, id: null, ajustementPret: false, erreur: false };
    sprite.addEventListener("load", () => {
      emplacement.erreur = false;
      ajusterPersonnages();
      actualiserVisibilite();
      placerBulle();
    });
    sprite.addEventListener("error", () => {
      if (sprite.currentSrc && sprite.currentSrc !== sprite.src) return;
      emplacement.erreur = true;
      console.warn("Sprite de personnage inaccessible :", sprite.src);
      actualiserVisibilite();
      placerBulle();
    });
    cadre.appendChild(sprite);
    zonePersonnages.appendChild(cadre);
    return emplacement;
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

    zonePersonnages.classList.toggle(
      "taille-scene",
      !extrait && personnagesPresents.some((personnage) => tailleDuPersonnage(moteur.personnagesParId.get(personnage.id)))
    );
    emplacements.forEach((emplacement, index) => {
      const personnage = personnagesPresents[index];
      emplacement.id = personnage?.id ?? null;
      const sourceChangee = personnage && emplacement.sprite.getAttribute("src") !== personnage.sprite;
      if (!personnage || sourceChangee) {
        emplacement.cadre.style.visibility = "hidden";
        emplacement.cadre.style.opacity = "0";
      }
      const disposition = personnagesPresents.length === 1
        ? "solo"
        : personnagesPresents.length === 2 ? `duo-${index}` : `trio-${index}`;
      emplacement.cadre.className = `cadre-personnage ${disposition}`;
      emplacement.cadre.classList.toggle("taille-ajustee", !extrait && Boolean(tailleDuPersonnage(moteur.personnagesParId.get(personnage?.id))));
      if (sourceChangee) {
        emplacement.erreur = false;
        emplacement.sprite.src = personnage.sprite;
      }
    });
    preparerAjustements();
    ajusterPersonnages();
    actualiserVisibilite();
  }

  // Les sprites contiennent de larges marges transparentes : on mesure une fois les bords réellement dessinés
  // au niveau de la tête et des épaules, pour poser la bulle juste à côté du visage.
  const bornesParSprite = new Map();

  function bornesDuDessin(sprite, mesureObligatoire = false) {
    if (bornesParSprite.has(sprite.src)) {
      const resultat = bornesParSprite.get(sprite.src);
      if (resultat.valide || !mesureObligatoire) return resultat.bornes;
    }
    let bornes = { gauche: 0, droite: 1, haut: 0, bas: 1 };
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
          bornes = { gauche: minX / LARGEUR, droite: (maxX + 1) / LARGEUR, haut: premiereLigne / hauteur, bas: (derniereLigne + 1) / hauteur };
        }
      } else {
        console.warn("Sprite vide :", sprite.src);
        bornesParSprite.set(sprite.src, { bornes, valide: false });
        return mesureObligatoire ? null : bornes;
      }
    } catch (erreur) {
      console.warn("Impossible de mesurer le sprite :", sprite.src, erreur);
      if (mesureObligatoire) return null;
      bornesParSprite.set(sprite.src, { bornes, valide: false });
      return bornes;
    }
    bornesParSprite.set(sprite.src, { bornes, valide: true });
    return bornes;
  }

  const mesuresScene = new Map();
  function mesurerSprite(src) {
    if (!mesuresScene.has(src)) {
      const mesure = new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
          const bornes = bornesDuDessin(image, true);
          if (!bornes) return reject(new Error(`Sprite non analysable : ${src}`));
          resolve({ image: { width: image.naturalWidth, height: image.naturalHeight }, bornes });
        };
        image.onerror = () => reject(new Error(`Sprite inaccessible pour la mesure : ${src}`));
        image.src = src;
      });
      mesuresScene.set(src, mesure);
    }
    return mesuresScene.get(src);
  }

  let referenceScene = null;
  const mesuresPretes = new Map();
  const mesuresEnEchec = new Set();
  function preparerAjustements() {
    for (const emplacement of emplacements) {
      const fiche = moteur.personnagesParId.get(emplacement.id);
      if (extrait || !fiche) {
        emplacement.sprite.style.transform = "";
        continue;
      }
      const reference = moteur.personnagesParId.get("isaac");
      const taille = tailleDuPersonnage(fiche);
      const tailleReference = tailleDuPersonnage(reference);
      if (!taille) {
        if (fiche.taille || fiche.height) console.warn("Taille de personnage invalide :", emplacement.id, fiche.taille || fiche.height);
        emplacement.sprite.style.transform = "";
        continue;
      }
      if (!tailleReference || !reference?.sprite) {
        console.warn("Taille ou sprite de référence manquant pour la scène :", emplacement.id);
        mesuresEnEchec.add(emplacement.sprite.src);
        emplacement.sprite.style.transform = "";
        continue;
      }
      const src = emplacement.sprite.src;
      if (mesuresEnEchec.has(src) || (mesuresPretes.has(src) && referenceScene)) continue;
      Promise.all([mesurerSprite(src), mesurerSprite(reference.sprite)]).then(([mesure, ref]) => {
        mesuresPretes.set(src, mesure);
        referenceScene = { ...ref, taille: tailleReference };
        if (!scene.isConnected) return;
        ajusterPersonnages();
        actualiserVisibilite();
        placerBulle();
      }).catch((erreur) => {
        mesuresEnEchec.add(src);
        console.warn("Ajustement de taille impossible :", erreur);
        if (scene.isConnected) {
          ajusterPersonnages();
          actualiserVisibilite();
          placerBulle();
        }
      });
    }
  }

  function ajusterPersonnages() {
    for (const emplacement of emplacements) {
      const fiche = moteur.personnagesParId.get(emplacement.id);
      const mesure = mesuresPretes.get(emplacement.sprite.src);
      const taille = tailleDuPersonnage(fiche);
      emplacement.ajustementPret = Boolean(emplacement.id && (extrait || !taille || mesuresEnEchec.has(emplacement.sprite.src)));
      if (extrait || !mesure || !referenceScene || !taille || mesuresEnEchec.has(emplacement.sprite.src)) {
        emplacement.sprite.style.transform = "";
        continue;
      }
      const cadre = { width: emplacement.cadre.clientWidth, height: emplacement.cadre.clientHeight };
      const ajustement = ajustementScene(cadre, mesure.image, mesure.bornes, referenceScene, taille, referenceScene.taille);
      emplacement.ajustementPret = Boolean(ajustement);
      emplacement.sprite.style.transform = ajustement
        ? `translateY(${ajustement.decalage}px) scale(${ajustement.echelle})`
        : "";
    }
  }

  function actualiserVisibilite() {
    for (const emplacement of emplacements) {
      const visible = Boolean(emplacement.id) && imageScenePrete(emplacement.sprite, emplacement.ajustementPret);
      emplacement.cadre.style.visibility = visible ? "visible" : "hidden";
      emplacement.cadre.style.opacity = visible ? "1" : "0";
    }
  }

  // Le cadre d'un personnage est bien plus large que son dessin (object-fit: contain) :
  // on recalcule la boîte réellement occupée par le sprite pour coller la bulle contre lui.
  function boiteDuLocuteur(speakerId) {
    const emplacement = emplacements.find((item) => item.id === speakerId);
    const sprite = emplacement?.sprite;
    if (emplacement?.cadre.style.visibility !== "visible") return null;
    if (!sprite?.naturalWidth || !sprite.naturalHeight) return null;
    const cadre = sprite.getBoundingClientRect();
    if (!cadre.width || !cadre.height) return null;
    const echelle = Math.min(cadre.width / sprite.naturalWidth, cadre.height / sprite.naturalHeight);
    const largeur = sprite.naturalWidth * echelle;
    const hauteur = sprite.naturalHeight * echelle;
    const bornes = mesuresPretes.get(sprite.src)?.bornes || bornesDuDessin(sprite);
    if (!bornes) return null;
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

    const emplacement = emplacements.find((item) => item.id === affichageCourant.speakerId);
    bulle.style.visibility = emplacement && emplacement.cadre.style.visibility !== "visible" && !emplacement.erreur
      ? "hidden" : "";
    const boite = boiteDuLocuteur(affichageCourant.speakerId);
    let cote = coteDeBulle(affichageCourant, boite);
    if (boite && !extrait && !affichageCourant.position && tailleDuPersonnage(moteur.personnagesParId.get(affichageCourant.speakerId))) {
      const rectScene = scene.getBoundingClientRect();
      const espaceGauche = boite.gauche - rectScene.left - 14;
      const espaceDroite = rectScene.right - boite.droite - 14;
      if (cote === "gauche" && espaceGauche < bulle.offsetWidth && espaceDroite > espaceGauche) cote = "droite";
      else if (cote === "droite" && espaceDroite < bulle.offsetWidth && espaceGauche > espaceDroite) cote = "gauche";
    }
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
  function actualiserDisposition() {
    scene.style.setProperty("--hauteur-barre", `${zoneBarre.offsetHeight || 0}px`);
    ajusterPersonnages();
    actualiserVisibilite();
    placerBulle();
  }
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
    window.addEventListener("resize", actualiserDisposition);
  }

  // Carnet de relations : illustrations définies dans le studio (chargées une fois, en arrière-plan).
  let catalogueSouvenirs = [];

  // « Niveau de révélation » (1 à 3) de l'illustration déclenchée par ce nœud.
  // Niveau 1 par défaut si la fiche est introuvable ou si le catalogue n'est pas encore arrivé.
  const RARETES_VALIDES = new Set(["common", "uncommon", "rare", "epic", "ultra_rare", "legendary"]);

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
  // (il parle ou il est à l'écran).
  function suivreCarnet(affichage) {
    const sauvegardeJeu = moteur.sauvegarde;
    if (extrait || !sauvegardeJeu || !affichage) return;

    const idsVus = [...(affichage.onScreen || []), ...personnagesPresents.map((personnage) => personnage.id)];
    if (affichage.estPersonnageSurScene) idsVus.push(affichage.speakerId);

    const rencontre = enregistrerRencontres(sauvegardeJeu, idsVus, moteur.personnagesParId);
    if (rencontre) sauvegarder(sauvegardeJeu);
  }

  if (!extrait) getIllustrationsCatalogue().then((liste) => {
    catalogueSouvenirs = liste;
  });

  const demandesIllustrations = new Map();
  const messageIllustration = document.createElement("p");
  messageIllustration.className = "message-illustration";
  messageIllustration.setAttribute("role", "alert");
  voileIllustration.appendChild(messageIllustration);

  function signalerIllustration(path, nodeId) {
    const cle = `${nodeId}:${path}`;
    if (!demandesIllustrations.has(cle)) {
      const demande = Promise.resolve().then(() => onIllustrationDebloquee?.({
        path, episodeId: moteur.episodeData.id, nodeId,
      })).catch(erreur => { demandesIllustrations.delete(cle); throw erreur; });
      demandesIllustrations.set(cle, demande);
    }
    return demandesIllustrations.get(cle);
  }

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

    if ((affichage.cg || affichage.cgUnavailable) && illustrationFermee !== affichage.nodeId) {
      const dejaVisible = voileIllustration.classList.contains("visible");
      voileIllustration.dataset.niveau = String(niveauRevelation(affichage.nodeId));
      voileIllustration.dataset.rarete = rareteIllustration(affichage.nodeId);
      voileIllustration.classList.add("visible");
      // Le jingle ne se joue qu'à l'apparition, pas à chaque nouveau rendu pendant que l'illustration reste ouverte.
      if (!dejaVisible) musique?.jouerJingleRevelation(Number(voileIllustration.dataset.niveau));
      if (!illustrationsSignalees.has(affichage.nodeId)) {
        illustrationsSignalees.add(affichage.nodeId);
        illustrationCg.removeAttribute("src");
        messageIllustration.textContent = "Chargement de l’illustration…";
        const chargement = affichage.cgUnavailable
          ? Promise.reject(new Error("Cette illustration doit encore être importée dans la médiathèque privée. Tu peux poursuivre l’histoire."))
          : signalerIllustration(affichage.cg, affichage.nodeId).then(acquisition => {
            const sauvegardeJeu = moteur.sauvegarde;
            if (acquisition?.id && sauvegardeJeu) {
              const souvenirs = sauvegardeJeu.unlockedIllustrationIds ??= [];
              if (!souvenirs.includes(acquisition.id)) souvenirs.push(acquisition.id);
            }
            return chargerImagePrivee(affichage.cg);
          });
        chargement.then(src => {
          if (affichageCourant?.nodeId !== affichage.nodeId) return;
          illustrationCg.src = src;
          messageIllustration.textContent = "";
        }).catch(erreur => {
          if (affichageCourant?.nodeId !== affichage.nodeId) return;
          messageIllustration.textContent = erreur.message;
          illustrationsSignalees.delete(affichage.nodeId);
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
    afficherLovometre(lovometreGauche, infoLovo
      ? { ...moteur.personnagesParId.get(infoLovo.id), ...infoLovo }
      : null);
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
          // La réponse de Pommette est déjà visible sous la bulle : on la valide avec ce clic et on passe à son nœud suivant.
          if (affichage.reponsePommette?.next) moteur.aller(affichage.reponsePommette.next);
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
            if (!extrait) window.removeEventListener("resize", actualiserDisposition);
          };
        }
      });
    }

    // Le personnage, les jauges et les CG disposent uniquement de l'espace au-dessus de la barre.
    // On mesure la barre après son rendu afin d'empêcher tout chevauchement, même pour un texte long.
    const hauteurBarre = zoneBarre.offsetHeight || 0;
    scene.style.setProperty("--hauteur-barre", `${hauteurBarre}px`);

    // Placée en dernier : le lovomètre et la barre sont alors dans leur état définitif.
    ajusterPersonnages();
    actualiserVisibilite();
    placerBulle();
  }

  rendre();
}
