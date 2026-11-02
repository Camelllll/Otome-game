// Écran de connexion / inscription : écran-titre d'otome game.
// Décor du campus, personnages en pied de chaque côté, logo et fenêtre de dialogue.
// Contrat inchangé : lancerEcranConnexion(conteneurRacine, { onConnecte }).
import { creerCompteJoueur, connexionJoueur } from "../services/playerRepository.js";

const DECOR = "assets/Décors/Entrée campus.png";
const DECOR_SECOURS = "assets/Décors/Cour Campus.jpg";
const LOGO = "assets/logo/Logo Pomme d'Amour.png";
const DOSSIER_PERSONNAGES = "assets/Personnages/Crushs/PNG/";

// decalage : distance au bord de l'écran (en vw). taille : hauteur en % de l'écran.
// rang : "avant" reste visible partout, "arriere" disparaît sur les écrans moyens et petits.
const TROUPE = [
  { nom: "Isaac", fichier: "Isaac.png", cote: "gauche", decalage: -2, taille: 88, plan: 2, rang: "avant" },
  { nom: "Aaron", fichier: "Aaron.png", cote: "gauche", decalage: 13, taille: 80, plan: 1, rang: "arriere" },
  { nom: "Sasha", fichier: "Sasha.png", cote: "droite", decalage: -2, taille: 88, plan: 2, rang: "avant" },
  { nom: "Camel", fichier: "Camel.png", cote: "droite", decalage: 13, taille: 80, plan: 1, rang: "arriere" }
];

const ICONES = {
  star: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.1 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  user: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  alert: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/></svg>'
};

const LIBELLE_CONNEXION = "Entrer sur le Campus";
const LIBELLE_INSCRIPTION = "Commencer l'aventure";
const MESSAGE_CHAMPS_VIDES = "Merci de renseigner tous les champs obligatoires.";
const MESSAGE_ECHEC = "Connexion impossible, vérifie tes identifiants.";

function creer(balise, classe, texte) {
  const element = document.createElement(balise);
  if (classe) element.className = classe;
  if (texte !== undefined) element.textContent = texte;
  return element;
}

function creerChamp({ id, libelle, icone, type, placeholder, autocomplete, maxLength, requis }) {
  const groupe = creer("div", "groupe-champ");

  const label = creer("label", "label-champ", libelle);
  label.htmlFor = id;

  const enveloppe = creer("div", "champ-saisie-wrapper");
  const pictogramme = creer("span", "champ-icone");
  pictogramme.innerHTML = icone;

  const saisie = creer("input", "champ-saisie");
  saisie.id = id;
  saisie.name = id;
  saisie.type = type;
  saisie.placeholder = placeholder;
  saisie.autocomplete = autocomplete;
  saisie.maxLength = maxLength;
  saisie.required = requis;

  enveloppe.append(pictogramme, saisie);
  groupe.append(label, enveloppe);
  return { groupe, saisie };
}

function creerPersonnage({ nom, fichier, cote, decalage, taille, plan, rang }, indice) {
  const figure = creer("figure", `perso perso-${cote}`);
  figure.dataset.rang = rang;
  figure.style.setProperty("--decalage", String(decalage));
  figure.style.setProperty("--taille", String(taille));
  figure.style.setProperty("--plan", String(plan));
  figure.style.setProperty("--ordre", String(indice));

  const image = creer("img", "perso-image");
  image.alt = "";
  image.decoding = "async";
  image.draggable = false;
  // Si une image manque, on retire simplement le personnage plutôt que d'afficher une icône cassée.
  image.onerror = () => figure.remove();
  image.src = `${DOSSIER_PERSONNAGES}${fichier}`;

  figure.append(image, creer("figcaption", "perso-nom", nom));
  return figure;
}

export function lancerEcranConnexion(conteneurRacine, { onConnecte }) {
  let onglet = "connexion";
  let enCours = false;

  const ecran = creer("div", "ecran-connexion");

  // --- Scène (décorative) : décor, voile, particules, personnages ---
  const scene = creer("div", "scene-connexion");
  scene.setAttribute("aria-hidden", "true");

  const fondDecor = creer("img", "decor-fond-connexion");
  fondDecor.alt = "";
  fondDecor.decoding = "async";
  fondDecor.onerror = () => {
    fondDecor.onerror = null;
    fondDecor.src = DECOR_SECOURS;
  };
  fondDecor.src = DECOR;

  const zoneParticules = creer("div", "particules-flottantes");
  for (let i = 0; i < 12; i++) {
    const coeur = creer("span", "particule-coeur", i % 2 === 0 ? "♥" : "✦");
    coeur.style.left = `${Math.random() * 95}%`;
    coeur.style.animationDelay = `${Math.random() * 7}s`;
    coeur.style.animationDuration = `${7 + Math.random() * 6}s`;
    zoneParticules.appendChild(coeur);
  }

  const troupe = creer("div", "troupe-connexion");
  TROUPE.forEach((personnage, indice) => troupe.appendChild(creerPersonnage(personnage, indice)));

  scene.append(fondDecor, creer("div", "voile-connexion"), zoneParticules, troupe);
  ecran.appendChild(scene);

  // --- Contenu : logo, fenêtre de dialogue, réplique ---
  const contenu = creer("div", "contenu-connexion");
  const colonne = creer("div", "colonne-connexion");

  const entete = creer("header", "entete-connexion");
  const titre = creer("h1", "titre-connexion");
  const logo = creer("img", "logo-connexion");
  logo.src = LOGO;
  logo.alt = "Pomme d'Amour — Otome Game";
  titre.appendChild(logo);
  entete.append(titre, creer("p", "sous-titre-connexion", "Université Aster · Romance & Choix"));

  const carte = creer("main", "carte-connexion");

  const plaque = creer("div", "plaque-connexion");
  plaque.innerHTML = ICONES.star;
  plaque.append(creer("span", "", "Bienvenue, future Sucrette"));
  carte.appendChild(plaque);

  // Onglets présentés comme des choix de visual novel
  const onglets = creer("div", "onglets-connexion");
  onglets.setAttribute("role", "tablist");
  onglets.setAttribute("aria-label", "Connexion ou création de compte");

  function creerOnglet(id, texte) {
    const bouton = creer("button", "btn-onglet", texte);
    bouton.type = "button";
    bouton.id = `onglet-${id}`;
    bouton.setAttribute("role", "tab");
    bouton.setAttribute("aria-controls", "panneau-connexion");
    return bouton;
  }

  const btnConnexion = creerOnglet("connexion", "Se connecter");
  const btnInscription = creerOnglet("inscription", "Nouveau compte");
  onglets.append(btnConnexion, btnInscription);
  carte.appendChild(onglets);

  const formulaire = creer("form", "formulaire-connexion");
  formulaire.id = "panneau-connexion";
  formulaire.setAttribute("role", "tabpanel");
  formulaire.noValidate = true;

  const { groupe: groupePseudo, saisie: champPseudo } = creerChamp({
    id: "pseudo",
    libelle: "Prénom de ton héroïne",
    icone: ICONES.user,
    type: "text",
    placeholder: "Ex : Sucrette",
    autocomplete: "nickname",
    maxLength: 40,
    requis: false
  });

  const { groupe: groupeEmail, saisie: champEmail } = creerChamp({
    id: "email",
    libelle: "Adresse email",
    icone: ICONES.mail,
    type: "email",
    placeholder: "ton-email@exemple.com",
    autocomplete: "email",
    maxLength: 100,
    requis: true
  });

  const { groupe: groupeMotDePasse, saisie: champMotDePasse } = creerChamp({
    id: "password",
    libelle: "Mot de passe secret",
    icone: ICONES.lock,
    type: "password",
    placeholder: "••••••••",
    autocomplete: "current-password",
    maxLength: 100,
    requis: true
  });

  const messageErreur = creer("p", "message-alerte");
  messageErreur.setAttribute("role", "alert");
  messageErreur.hidden = true;
  const iconeErreur = creer("span", "message-alerte-icone");
  iconeErreur.innerHTML = ICONES.alert;
  const texteErreur = creer("span");
  messageErreur.append(iconeErreur, texteErreur);

  const boutonValider = creer("button", "bouton-cta-connexion");
  boutonValider.type = "submit";
  const libelleBouton = creer("span", "cta-libelle");
  const iconeBouton = creer("span", "cta-icone");
  iconeBouton.innerHTML = ICONES.play;
  boutonValider.append(libelleBouton, iconeBouton);

  formulaire.append(groupePseudo, groupeEmail, groupeMotDePasse, messageErreur, boutonValider);
  carte.appendChild(formulaire);

  colonne.append(
    entete,
    carte,
    creer("p", "texte-bas-connexion", "Prêt(e) à rencontrer Isaac, Aaron, Sasha, Camel et les autres ?")
  );
  contenu.appendChild(colonne);
  ecran.appendChild(contenu);

  function libelleActuel() {
    return onglet === "inscription" ? LIBELLE_INSCRIPTION : LIBELLE_CONNEXION;
  }

  function afficherErreur(message) {
    texteErreur.textContent = message;
    messageErreur.hidden = false;
  }

  function masquerErreur() {
    texteErreur.textContent = "";
    messageErreur.hidden = true;
  }

  function appliquerOnglet() {
    const inscription = onglet === "inscription";

    [[btnConnexion, !inscription], [btnInscription, inscription]].forEach(([bouton, actif]) => {
      bouton.classList.toggle("actif", actif);
      bouton.setAttribute("aria-selected", String(actif));
      bouton.tabIndex = actif ? 0 : -1;
    });

    groupePseudo.hidden = !inscription;
    champMotDePasse.autocomplete = inscription ? "new-password" : "current-password";
    libelleBouton.textContent = libelleActuel();
    formulaire.setAttribute("aria-labelledby", inscription ? btnInscription.id : btnConnexion.id);
    masquerErreur();
  }

  function choisirOnglet(nom) {
    if (enCours || nom === onglet) return;
    onglet = nom;
    appliquerOnglet();
  }

  btnConnexion.addEventListener("click", () => choisirOnglet("connexion"));
  btnInscription.addEventListener("click", () => choisirOnglet("inscription"));

  onglets.addEventListener("keydown", (evenement) => {
    if (enCours) return;
    if (evenement.key !== "ArrowLeft" && evenement.key !== "ArrowRight") return;
    evenement.preventDefault();
    choisirOnglet(onglet === "connexion" ? "inscription" : "connexion");
    (onglet === "connexion" ? btnConnexion : btnInscription).focus();
  });

  async function validerFormulaire() {
    if (enCours) return;
    masquerErreur();

    if (!champEmail.value.trim() || !champMotDePasse.value) {
      afficherErreur(MESSAGE_CHAMPS_VIDES);
      return;
    }

    enCours = true;
    boutonValider.disabled = true;
    boutonValider.setAttribute("aria-busy", "true");
    libelleBouton.textContent = "Chargement…";

    try {
      const joueur =
        onglet === "connexion"
          ? await connexionJoueur(champEmail.value, champMotDePasse.value)
          : await creerCompteJoueur(champEmail.value, champMotDePasse.value, champPseudo.value);
      onConnecte(joueur);
    } catch (erreur) {
      afficherErreur((erreur && erreur.message) || MESSAGE_ECHEC);
      boutonValider.disabled = false;
      boutonValider.removeAttribute("aria-busy");
      libelleBouton.textContent = libelleActuel();
      enCours = false;
    }
  }

  formulaire.addEventListener("submit", (evenement) => {
    evenement.preventDefault();
    validerFormulaire();
  });

  appliquerOnglet();

  conteneurRacine.innerHTML = "";
  conteneurRacine.appendChild(ecran);

  // Curseur dans l'email, sauf sur écran tactile où cela ouvrirait le clavier d'emblée.
  if (window.matchMedia("(pointer: fine)").matches) {
    champEmail.focus({ preventScroll: true });
  }
}