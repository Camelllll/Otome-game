// Écran « Journal des épisodes » : sélecteur de chapitres façon visual novel.
// À gauche, la page du journal avec la liste des épisodes. À droite, l'aperçu de l'épisode
// choisi (scène + boîte de dialogue). Un clic sélectionne, le bouton lance l'épisode.

const IMAGE_PAR_DEFAUT = "assets/Décors/Cour Campus.jpg";
const SYNOPSIS_PAR_DEFAUT = "Poursuis tes aventures et renforce tes liens avec les étudiants du campus.";
const SYNOPSIS_VERROUILLE = "Cet épisode n'est pas encore débloqué.";

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

const ICONES = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.6 7.9l-1.4-1.4z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill-rule="evenodd" d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1zm2 0h6V8a3 3 0 0 0-6 0v2z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3 2 12h3v8h5v-5h4v5h5v-8h3z"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.1 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/></svg>'
};

const LIBELLES_STATUT = {
  termine: "Terminé",
  verrouille: "Verrouillé",
  "en-cours": "En cours",
  disponible: "Nouveau"
};

const LIBELLES_BOUTON = {
  termine: "Épisode terminé",
  verrouille: "Verrouillé",
  "en-cours": "Continuer",
  disponible: "Commencer"
};

const ICONE_STATUT = {
  termine: "check",
  verrouille: "lock",
  "en-cours": "play",
  disponible: "star"
};

function creer(balise, classe, texte) {
  const element = document.createElement(balise);
  if (classe) element.className = classe;
  if (texte !== undefined) element.textContent = texte;
  return element;
}

function poserIconeEtTexte(element, icone, texte) {
  element.innerHTML = icone;
  element.append(creer("span", "", texte));
}

function poserImage(img, source) {
  img.onerror = () => {
    img.onerror = null;
    img.src = IMAGE_PAR_DEFAUT;
  };
  img.src = source;
}

function numeroDe(id) {
  const correspondance = String(id).match(/^episode(\d+)$/);
  return correspondance ? correspondance[1] : String(id);
}

function statutDe({ id, complete, verrouille }, episodeActuel) {
  if (complete) return "termine";
  if (verrouille) return "verrouille";
  if (id === episodeActuel) return "en-cours";
  return "disponible";
}

function creerHud({ sauvegarde, joueur, onRetourAccueil }) {
  const hud = creer("header", "hud-journal");

  const marque = creer("div", "hud-marque");
  const logo = creer("img", "hud-logo");
  logo.src = "assets/logo/Logo Pomme d'Amour.png";
  logo.alt = "Pomme d'Amour";
  const titres = creer("div");
  titres.append(creer("h2", "hud-nom-app", "Pomme d'Amour"), creer("p", "hud-lieu", "Université Aster"));
  marque.append(logo, titres);
  hud.appendChild(marque);

  const infos = creer("div", "hud-infos");

  const pseudo = sauvegarde?.playerName || joueur?.pseudo || "Sucrette";
  const chipJoueur = creer("div", "hud-chip");
  const initiale = [...String(pseudo)][0]?.toUpperCase() || "S";
  const avatar = creer("span", "hud-avatar", initiale);
  avatar.setAttribute("aria-hidden", "true");
  chipJoueur.append(avatar, creer("span", "", pseudo));
  infos.appendChild(chipJoueur);

  const pa = sauvegarde?.actionPoints ?? 25;
  const chipPa = creer("div", "hud-chip hud-chip-pa");
  chipPa.title = "Points d'action";
  poserIconeEtTexte(chipPa, ICONES.bolt, `${pa} PA`);
  infos.appendChild(chipPa);

  if (typeof onRetourAccueil === "function") {
    const accueil = creer("button", "hud-accueil");
    accueil.type = "button";
    poserIconeEtTexte(accueil, ICONES.home, "Accueil");
    accueil.addEventListener("click", () => onRetourAccueil());
    infos.appendChild(accueil);
  }

  hud.appendChild(infos);
  return hud;
}

export function lancerEcranSelectionEpisode(conteneurRacine, { episodes, episodeActuel, joueur, sauvegarde, onSelect, onRetourAccueil }) {
  const liste = Array.isArray(episodes) ? episodes : [];

  const entrees = liste.map((episode) => {
    const numero = numeroDe(episode.id);
    const meta = DECORS_PAR_DEFAUT[episode.id] || { image: IMAGE_PAR_DEFAUT, synopsis: SYNOPSIS_PAR_DEFAUT };
    return {
      id: episode.id,
      titre: episode.title || `Épisode ${numero}`,
      statut: statutDe(episode, episodeActuel),
      numero,
      numeroAffiche: /^\d+$/.test(numero) ? numero.padStart(2, "0") : numero,
      image: meta.image,
      synopsis: meta.synopsis,
      bouton: null
    };
  });

  const ecran = creer("div", "ecran-selection-episode");

  const fond = creer("img", "journal-fond");
  fond.alt = "";
  fond.setAttribute("aria-hidden", "true");
  ecran.appendChild(fond);

  ecran.appendChild(creerHud({ sauvegarde, joueur, onRetourAccueil }));

  const journal = creer("main", "journal");

  // --- Page du journal (liste des épisodes) ---
  const page = creer("section", "journal-page");
  page.appendChild(creer("h1", "journal-titre", "Journal des épisodes"));

  const nbTermines = entrees.filter((entree) => entree.statut === "termine").length;
  const texteProgression = `${nbTermines} / ${entrees.length} épisodes terminés`;
  page.appendChild(creer("p", "journal-progression", texteProgression));

  const pastilles = creer("div", "journal-pastilles");
  pastilles.setAttribute("role", "img");
  pastilles.setAttribute("aria-label", texteProgression);
  entrees.forEach((entree) => {
    pastilles.appendChild(creer("span", entree.statut === "termine" ? "pastille faite" : "pastille"));
  });
  page.appendChild(pastilles);

  const listeChapitres = creer("ol", "chapitres");
  entrees.forEach((entree, index) => {
    const ligne = creer("li", "chapitres-ligne");
    ligne.style.setProperty("--i", String(index));

    const bouton = creer("button", "chapitre");
    bouton.type = "button";
    bouton.dataset.statut = entree.statut;

    const num = creer("span", "chapitre-num", entree.numeroAffiche);
    const infos = creer("span", "chapitre-infos");
    infos.append(creer("span", "chapitre-titre", entree.titre), creer("span", "chapitre-statut", LIBELLES_STATUT[entree.statut]));
    const marque = creer("span", "chapitre-marque");
    marque.innerHTML = ICONES[ICONE_STATUT[entree.statut]];

    bouton.append(num, infos, marque);
    bouton.addEventListener("click", () => selectionner(index, { defiler: true }));
    bouton.addEventListener("dblclick", () => lancer(index));

    entree.bouton = bouton;
    ligne.appendChild(bouton);
    listeChapitres.appendChild(ligne);
  });
  page.appendChild(listeChapitres);

  if (entrees.length === 0) {
    page.appendChild(creer("p", "journal-vide", "Aucun épisode n'est disponible pour le moment."));
  }

  journal.appendChild(page);

  // --- Aperçu de l'épisode choisi ---
  const apercu = creer("section", "apercu");
  apercu.setAttribute("aria-live", "polite");

  const scene = creer("div", "apercu-scene");
  const image = creer("img", "apercu-image");
  const numeroGeant = creer("div", "apercu-numero");
  numeroGeant.setAttribute("aria-hidden", "true");
  const tampon = creer("div", "apercu-tampon");
  const cadenas = creer("div", "apercu-cadenas");
  cadenas.innerHTML = ICONES.lock;
  cadenas.setAttribute("aria-hidden", "true");
  scene.append(image, cadenas, numeroGeant, tampon);

  const dialogue = creer("div", "apercu-dialogue");
  const plaque = creer("div", "apercu-plaque");
  const titreApercu = creer("h2", "apercu-titre");
  const synopsis = creer("p", "apercu-synopsis");
  const jouer = creer("button", "apercu-jouer");
  jouer.type = "button";
  jouer.addEventListener("click", () => lancer(indexSelection));
  dialogue.append(plaque, titreApercu, synopsis, jouer);

  apercu.append(scene, dialogue);
  if (entrees.length > 0) journal.appendChild(apercu);

  ecran.appendChild(journal);

  // --- Logique de sélection ---
  let indexSelection = -1;

  function peutJouer(entree) {
    return entree.statut === "en-cours" || entree.statut === "disponible";
  }

  function lancer(index) {
    const entree = entrees[index];
    if (!entree || !peutJouer(entree) || typeof onSelect !== "function") return;
    onSelect(entree.id);
  }

  function selectionner(index, { focus = false, defiler = false } = {}) {
    const entree = entrees[index];
    if (!entree) return;
    const changement = index !== indexSelection;
    indexSelection = index;

    entrees.forEach((autre, i) => {
      if (i === index) autre.bouton.setAttribute("aria-current", "true");
      else autre.bouton.removeAttribute("aria-current");
    });
    if (focus) entree.bouton.focus();

    apercu.dataset.statut = entree.statut;
    poserImage(image, entree.image);
    poserImage(fond, entree.image);
    image.alt = `Illustration : ${entree.titre}`;
    numeroGeant.textContent = entree.numeroAffiche;
    tampon.textContent = LIBELLES_STATUT[entree.statut];
    plaque.textContent = `Épisode ${entree.numero}`;
    titreApercu.textContent = entree.titre;
    synopsis.textContent = entree.statut === "verrouille" ? SYNOPSIS_VERROUILLE : entree.synopsis;

    jouer.disabled = !peutJouer(entree);
    poserIconeEtTexte(jouer, ICONES[entree.statut === "termine" ? "check" : entree.statut === "verrouille" ? "lock" : "play"], LIBELLES_BOUTON[entree.statut]);

    if (changement) {
      apercu.classList.remove("transition");
      void apercu.offsetWidth;
      apercu.classList.add("transition");
    }

    if (defiler && window.matchMedia("(max-width: 860px)").matches) {
      const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      apercu.scrollIntoView({ behavior: reduit ? "auto" : "smooth", block: "start" });
    }
  }

  listeChapitres.addEventListener("keydown", (evenement) => {
    if (entrees.length === 0) return;
    let cible = -1;
    if (evenement.key === "ArrowDown") cible = Math.min(indexSelection + 1, entrees.length - 1);
    else if (evenement.key === "ArrowUp") cible = Math.max(indexSelection - 1, 0);
    else if (evenement.key === "Home") cible = 0;
    else if (evenement.key === "End") cible = entrees.length - 1;
    if (cible < 0) return;
    evenement.preventDefault();
    selectionner(cible, { focus: true });
  });

  let indexInitial = entrees.findIndex((entree) => entree.id === episodeActuel && entree.statut !== "termine");
  if (indexInitial < 0) indexInitial = entrees.findIndex((entree) => entree.statut === "disponible");
  if (indexInitial < 0) indexInitial = 0;
  selectionner(indexInitial);

  conteneurRacine.innerHTML = "";
  conteneurRacine.appendChild(ecran);
}