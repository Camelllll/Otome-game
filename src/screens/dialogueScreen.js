// Écran de dialogue : affiche le décor, le personnage sur scène, sa bulle, la barre du bas et les lovomètres.
import { afficherBullePersonnage, afficherBarreNarration } from "../ui/dialogueBox.js";
import { afficherLovometre, animerGainLovo, animerPerteLovo } from "../ui/gaugeBar.js";
import { MusiqueAmbiance } from "../ui/backgroundMusic.js";

export function lancerEcranDialogue(conteneurRacine, moteur, { onFinEpisode } = {}) {
  const musique = new MusiqueAmbiance();
  const scene = document.createElement("div");
  scene.className = "ecran-dialogue";

  const boutonMusique = document.createElement("button");
  boutonMusique.className = "bouton-musique";
  boutonMusique.type = "button";
  boutonMusique.setAttribute("aria-label", "Activer ou couper la musique d'ambiance");
  function afficherEtatMusique(active) {
    boutonMusique.textContent = active ? "♫ Musique" : "♫ Muet";
    boutonMusique.classList.toggle("muet", !active);
  }
  afficherEtatMusique(musique.active);
  boutonMusique.addEventListener("click", async () => afficherEtatMusique(await musique.basculer()));
  scene.appendChild(boutonMusique);

  // Le premier clic dans le jeu est nécessaire pour que les navigateurs autorisent le son.
  scene.addEventListener("pointerdown", () => musique.demarrer(), { once: true });

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

  conteneurRacine.innerHTML = "";
  conteneurRacine.appendChild(scene);

  const personnagesPresents = [];
  let decorActuel = null;
  let illustrationFermee = null;

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
      personnagesPresents.length = 0;
      affichage.onScreen.slice(0, 3).forEach((id) => {
        const personnage = moteur.personnagesParId.get(id);
        if (personnage?.sprite) personnagesPresents.push({ id, sprite: personnage.sprite });
      });
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

  function rendre() {
    const affichage = moteur.obtenirAffichage();
    if (!affichage) return;

    if (affichage.background) decor.src = affichage.background;
    mettreAJourPersonnages(affichage);

    if (affichage.cg && illustrationFermee !== affichage.nodeId) {
      illustrationCg.src = affichage.cg;
      voileIllustration.classList.add("visible");
    } else {
      voileIllustration.classList.remove("visible");
    }

    afficherBullePersonnage(zoneBulle, affichage);

    // Le lovo-meter reste réservé aux scènes en tête-à-tête : il disparaît dès qu'un second personnage arrive.
    const [infoLovo] = personnagesPresents.length === 1
      ? moteur.obtenirInfosPersonnages([personnagesPresents[0].id])
      : [];
    afficherLovometre(lovometreGauche, infoLovo);
    afficherLovometre(lovometreDroite, null);

    afficherBarreNarration(zoneBarre, affichage, {
      onSuivant: () => {
        // La réponse de Sucrette est déjà visible sous la bulle : on la valide avec ce clic et on passe à son nœud suivant.
        if (affichage.reponseSucrette?.next) moteur.aller(affichage.reponseSucrette.next);
        else moteur.avancer();
        rendre();
      },
      onChoix: (index) => {
        const option = moteur.noeudCourant?.options?.[index];
        const cible = personnagesPresents.length === 1 ? personnagesPresents[0].id : null;
        const variation = cible
          ? Object.values(option?.effects?.[cible] || {}).reduce((total, delta) => total + delta, 0)
          : 0;
        if (variation > 0) animerGainLovo(scene, variation);
        if (variation < 0) animerPerteLovo(scene, variation);
        moteur.choisir(index);
        rendre();
      }
    });

    // Le personnage, les jauges et les CG disposent uniquement de l'espace au-dessus de la barre.
    // On mesure la barre après son rendu afin d'empêcher tout chevauchement, même pour un texte long.
    const hauteurBarre = zoneBarre.offsetHeight || 0;
    scene.style.setProperty("--hauteur-barre", `${hauteurBarre}px`);

    if (affichage.type === "end" && onFinEpisode) {
      const bouton = zoneBarre.querySelector(".bouton-suivant");
      bouton?.addEventListener("click", () => onFinEpisode(affichage.nextEpisode));
    }
  }

  rendre();
}
