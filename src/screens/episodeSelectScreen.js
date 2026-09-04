// Écran de sélection d'épisode : ambiance Otome Game / Amour Sucré avec cartes illustrées et statuts.

const DECORS_PAR_DEFAUT = {
  episode1: {
    image: "assets/Décors/Entrée campus.png",
    synopsis: "Arrivée sur le campus, premiers cartons et rencontres inattendues à l'Université Aster."
  },
  episode2: {
    image: "assets/Décors/Cour campus nuit.png",
    synopsis: "La grande soirée d'intégration : guirlandes, musique et rapprochements sous les étoiles."
  },
  episode3: {
    image: "assets/Décors/Salle de TD.jpg",
    synopsis: "Premiers cours magistraux, travaux de groupe et regards complices."
  },
  episode4: {
    image: "assets/Décors/Cafétéria campus.png",
    synopsis: "Pause café, confidences entre amis et choix décisifs pour ton histoire de cœur."
  }
};

export function lancerEcranSelectionEpisode(conteneurRacine, { episodes, episodeActuel, joueur, sauvegarde, onSelect, onRetourAccueil }) {
  const ecran = document.createElement("div");
  ecran.className = "ecran-selection-episode";

  // En-tête supérieur style jeu Amour Sucré
  const header = document.createElement("header");
  header.className = "header-selection-episode";

  const blocLogo = document.createElement("div");
  blocLogo.className = "logo-header-selection";
  const logo = document.createElement("img");
  logo.className = "mini-logo-pomme";
  logo.src = "assets/logo/Logo Pomme d'Amour.png";
  logo.alt = "Pomme d'Amour";
  const blocTitres = document.createElement("div");
  const titreApp = document.createElement("h2");
  titreApp.className = "header-titre-app";
  titreApp.textContent = "Pomme d'Amour";
  const sousTitreApp = document.createElement("p");
  sousTitreApp.className = "header-sous-titre-app";
  sousTitreApp.textContent = "Université Aster";
  blocTitres.append(titreApp, sousTitreApp);
  blocLogo.append(logo, blocTitres);
  header.appendChild(blocLogo);

  const infosJoueur = document.createElement("div");
  infosJoueur.className = "header-infos-joueur";

  const pseudo = sauvegarde?.playerName || joueur?.pseudo || "Sucrette";
  const badgeNom = document.createElement("div");
  badgeNom.className = "badge-joueur-nom";
  badgeNom.innerHTML = `<span>🎀</span> ${pseudo}`;
  infosJoueur.appendChild(badgeNom);

  const pa = sauvegarde?.actionPoints ?? 25;
  const badgeAP = document.createElement("div");
  badgeAP.className = "badge-ap";
  badgeAP.innerHTML = `<span>⚡</span> ${pa} PA`;
  infosJoueur.appendChild(badgeAP);

  if (onRetourAccueil) {
    const btnRetour = document.createElement("button");
    btnRetour.type = "button";
    btnRetour.className = "btn-retour-accueil";
    btnRetour.innerHTML = "<span>🏠</span> Accueil";
    btnRetour.addEventListener("click", () => onRetourAccueil());
    infosJoueur.appendChild(btnRetour);
  }

  header.appendChild(infosJoueur);
  ecran.appendChild(header);

  // Particules cœurs romantiques flottantes
  const zoneParticules = document.createElement("div");
  zoneParticules.className = "particules-flottantes";
  for (let i = 0; i < 10; i++) {
    const coeur = document.createElement("span");
    coeur.className = "particule-coeur";
    coeur.textContent = i % 3 === 0 ? "🍎" : i % 2 === 0 ? "♥" : "✦";
    coeur.style.left = `${Math.random() * 95}%`;
    coeur.style.animationDelay = `${Math.random() * 6}s`;
    coeur.style.animationDuration = `${8 + Math.random() * 6}s`;
    zoneParticules.appendChild(coeur);
  }
  ecran.appendChild(zoneParticules);

  // Contenu central
  const contenu = document.createElement("div");
  contenu.className = "contenu-selection-episode";

  const titre = document.createElement("h1");
  titre.className = "titre-selection-episode";
  titre.textContent = "Journal des Épisodes";
  contenu.appendChild(titre);

  const sousTitre = document.createElement("p");
  sousTitre.className = "sous-titre-selection-episode";
  sousTitre.textContent = "Choisis ton chapitre et écris ton histoire à l'Université Aster.";
  contenu.appendChild(sousTitre);

  const liste = document.createElement("div");
  liste.className = "liste-episodes";

  episodes.forEach(({ id, title, complete, verrouille }) => {
    const carte = document.createElement("article");
    carte.className = "carte-episode";
    if (id === episodeActuel) carte.classList.add("actif");
    if (complete) carte.classList.add("termine");
    if (verrouille) carte.classList.add("verrouille");

    const numero = id.match(/^episode(\d+)$/)?.[1] || id;
    const metaEpisode = DECORS_PAR_DEFAUT[id] || {
      image: "assets/Décors/Cour Campus.jpg",
      synopsis: "Poursuis tes aventures et renforce tes liens avec les étudiants du campus."
    };

    // Bannière avec illustration
    const banniere = document.createElement("div");
    banniere.className = "banniere-episode-wrapper";
    const img = document.createElement("img");
    img.className = "banniere-episode-img";
    img.src = metaEpisode.image;
    img.alt = title;
    img.onerror = () => {
      img.src = "assets/Décors/Cour Campus.jpg";
    };

    const ruban = document.createElement("div");
    ruban.className = "ruban-badge-episode";
    ruban.innerHTML = `<span>🍎</span> Épisode ${numero}`;

    const statutBadge = document.createElement("div");
    statutBadge.className = "badge-statut-episode";
    if (id === episodeActuel) {
      statutBadge.classList.add("en-cours");
      statutBadge.textContent = "▶ En cours";
    } else if (complete) {
      statutBadge.classList.add("termine");
      statutBadge.textContent = "✨ Terminé";
    } else if (verrouille) {
      statutBadge.classList.add("verrouille");
      statutBadge.textContent = "🔒 Verrouillé";
    } else {
      statutBadge.classList.add("disponible");
      statutBadge.textContent = "🌸 Disponible";
    }

    banniere.append(img, ruban, statutBadge);
    carte.appendChild(banniere);

    // Corps de la carte
    const corps = document.createElement("div");
    corps.className = "corps-carte-episode";

    const titreEp = document.createElement("h3");
    titreEp.className = "titre-episode-carte";
    titreEp.textContent = title;

    const descEp = document.createElement("p");
    descEp.className = "description-episode-carte";
    descEp.textContent = metaEpisode.synopsis;

    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "bouton-jouer-episode";
    bouton.disabled = Boolean(verrouille);
    
    if (id === episodeActuel) {
      bouton.innerHTML = "<span>▶</span> Continuer l'épisode";
    } else if (complete) {
      bouton.innerHTML = "<span>↺</span> Rejouer l'épisode";
    } else if (verrouille) {
      bouton.innerHTML = "<span>🔒</span> Épisode verrouillé";
    } else {
      bouton.innerHTML = "<span>🌸</span> Commencer l'épisode";
    }

    if (!verrouille) {
      carte.addEventListener("click", (e) => {
        onSelect(id);
      });
    }

    corps.append(titreEp, descEp, bouton);
    carte.appendChild(corps);
    liste.appendChild(carte);
  });

  contenu.appendChild(liste);
  ecran.appendChild(contenu);

  conteneurRacine.innerHTML = "";
  conteneurRacine.appendChild(ecran);
}
