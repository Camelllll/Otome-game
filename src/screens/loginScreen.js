import { creerCompteJoueur, connexionJoueur } from "../services/playerRepository.js";
import { getCharacters, getEpisode, getBackgrounds } from "../services/gameRepository.js";
import { urlMedia } from "../services/mediaDelivery.js";
import { creerMoteurExtrait } from "../engine/episodePreview.js";
import { lancerEcranDialogue } from "./dialogueScreen.js";
import { creerSectionConcept } from "../ui/conceptSection.js";
import { creerCarrouselPersonnages, creerDecorPersonnages } from "../ui/characterCarousel.js";
import {
  creer, icone, creerImage, creerBouton, creerEntete,
  creerTransitionConcept,
} from "../ui/landingComponents.js";

const LOGO = "assets/logo/Logo Pomme d'Amour.png";

function creerChamp(id, libelle, type, pictogramme, autocomplete) {
  const groupe = creer("div", "entree-champ");
  const label = creer("label", "", libelle);
  label.htmlFor = `entree-${id}`;
  const enveloppe = creer("div", "entree-saisie");
  const saisie = creer("input");
  saisie.id = `entree-${id}`;
  saisie.name = id;
  saisie.type = type;
  saisie.autocomplete = autocomplete;
  saisie.required = id !== "pseudo";
  saisie.maxLength = id === "pseudo" ? 40 : 100;
  if (id === "email") saisie.placeholder = "Adresse e-mail";
  if (id === "password") saisie.placeholder = "Mot de passe";
  if (id === "pseudo") saisie.placeholder = "Pommette";
  enveloppe.append(icone(pictogramme), saisie);
  if (id === "password") {
    const afficher = creer("button", "entree-voir-mdp");
    afficher.append(icone("oeil"));
    afficher.type = "button";
    afficher.setAttribute("aria-label", "Afficher le mot de passe");
    afficher.setAttribute("aria-pressed", "false");
    afficher.addEventListener("click", () => {
      const visible = saisie.type === "password";
      saisie.type = visible ? "text" : "password";
      afficher.replaceChildren(icone(visible ? "oeil-barre" : "oeil"));
      afficher.setAttribute("aria-label", visible ? "Masquer le mot de passe" : "Afficher le mot de passe");
      afficher.setAttribute("aria-pressed", String(visible));
    });
    enveloppe.append(afficher);
  }
  groupe.append(label, enveloppe);
  return { groupe, saisie };
}

function creerConnexion(onConnecte) {
  const bloc = creer("div");
  const onglets = creer("div", "entree-onglets");
  onglets.setAttribute("role", "tablist");
  onglets.setAttribute("aria-label", "Ton compte");
  const formulaire = creer("form", "entree-formulaire");
  formulaire.id = "entree-formulaire";
  formulaire.setAttribute("role", "tabpanel");
  const pseudo = creerChamp("pseudo", "Ton pseudo (facultatif)", "text", "compte", "nickname");
  const email = creerChamp("email", "Adresse e-mail", "email", "mail", "email");
  const mdp = creerChamp("password", "Mot de passe", "password", "verrou", "current-password");
  const erreur = creer("p", "entree-erreur");
  erreur.id = "entree-erreur";
  erreur.setAttribute("role", "alert");
  erreur.hidden = true;
  formulaire.setAttribute("aria-describedby", erreur.id);
  const valider = creerBouton("Entrer sur le campus", null, { pictogramme: "coeur" });
  valider.type = "submit";
  formulaire.append(pseudo.groupe, email.groupe, mdp.groupe, erreur, valider);
  let inscription = false;
  let enCours = false;
  const boutons = ["Se connecter", "Créer un compte"].map((texte, index) => {
    const bouton = creer("button", "entree-onglet");
    bouton.append(icone(index === 0 ? "compte" : "inscription"), creer("span", "", texte));
    bouton.type = "button";
    bouton.id = `entree-onglet-${index}`;
    bouton.setAttribute("role", "tab");
    bouton.setAttribute("aria-controls", formulaire.id);
    bouton.addEventListener("click", () => choisir(index === 1));
    onglets.append(bouton);
    return bouton;
  });
  function choisir(nouveau) {
    if (enCours) return;
    inscription = nouveau;
    boutons.forEach((bouton, index) => {
      const actif = (index === 1) === inscription;
      bouton.setAttribute("aria-selected", String(actif));
      bouton.tabIndex = actif ? 0 : -1;
    });
    pseudo.groupe.hidden = !inscription;
    mdp.saisie.autocomplete = inscription ? "new-password" : "current-password";
    mdp.saisie.minLength = inscription ? 8 : 1;
    valider.lastElementChild.textContent = inscription ? "Commencer l'aventure" : "Entrer sur le campus";
    formulaire.setAttribute("aria-labelledby", boutons[inscription ? 1 : 0].id);
    erreur.hidden = true;
  }
  onglets.addEventListener("keydown", (event) => {
    if (enCours || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    choisir(event.key === "Home" ? false : event.key === "End" ? true : !inscription);
    boutons[inscription ? 1 : 0].focus();
  });
  formulaire.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (enCours || !formulaire.reportValidity()) return;
    enCours = true;
    erreur.hidden = true;
    valider.disabled = true;
    boutons.forEach((bouton) => { bouton.disabled = true; });
    formulaire.setAttribute("aria-busy", "true");
    valider.lastElementChild.textContent = "Ouverture des portes…";
    try {
      const joueur = inscription
        ? await creerCompteJoueur(email.saisie.value, mdp.saisie.value, pseudo.saisie.value)
        : await connexionJoueur(email.saisie.value, mdp.saisie.value);
      await onConnecte(joueur, { nouveauCompte: inscription });
    } catch (cause) {
      erreur.textContent = cause.message || "Connexion impossible. Réessaie dans un instant.";
      erreur.hidden = false;
    } finally {
      enCours = false;
      valider.disabled = false;
      boutons.forEach((bouton) => { bouton.disabled = false; });
      formulaire.removeAttribute("aria-busy");
      valider.lastElementChild.textContent = inscription ? "Commencer l'aventure" : "Entrer sur le campus";
    }
  });
  choisir(false);
  bloc.append(onglets, formulaire);
  return { bloc, focus: email.saisie, inscrire: () => choisir(true) };
}

export function lancerEcranConnexion(conteneurRacine, { onConnecte }) {
  const page = creer("div", "page-connexion");
  const defilement = creer("div", "entree-defilement");
  const principal = creer("main", "entree-principal");
  const hero = creer("section", "entree-hero");
  hero.id = "entree-campus";
  hero.tabIndex = -1;
  hero.setAttribute("aria-labelledby", "entree-titre");
  function allerA(cible, focus = cible) {
    menu.setAttribute("aria-expanded", "false");
    liens.classList.remove("est-ouvert");
    // La navbar est hors de ce conteneur : son bord supérieur est déjà dégagé.
    const top = cible === hero ? 0
      : defilement.scrollTop + cible.getBoundingClientRect().top
        - defilement.getBoundingClientRect().top - defilement.clientTop
        - parseFloat(getComputedStyle(cible).scrollMarginTop);
    defilement.scrollTo({
      top: Math.max(0, top),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
    focus.focus({ preventScroll: true });
  }
  const presentation = creer("div", "entree-presentation");
  const titre = creer("h1", "", "TOUT COMMENCE");
  titre.id = "entree-titre";
  titre.append(creer("em", "", "ICI."));
  const description = creer("p", "entree-hero-texte");
  description.append(
    creer("span", "", "Une première année à l'université, c'est aussi des habitudes à prendre, des amitiés à construire et des personnes à découvrir."),
    creer("span", "", " Au fil des rencontres, tu découvriras peu à peu ceux qui pourraient bien rendre cette année inoubliable."),
  );
  presentation.append(
    creerImage(LOGO, "entree-logo-hero", "Pomme d'Amour", true),
    creer("p", "entree-etiquette", "OTOME GAME FRANÇAIS"),
    titre,
    description,
  );
  const carte = creer("aside", "entree-compte");
  carte.id = "entree-compte";
  carte.tabIndex = -1;
  carte.setAttribute("aria-label", "Rejoins le campus");
  carte.append(creer("p", "entree-surtitre", "Ton accès au campus"));
  carte.append(
    creer("h2", "", "On t'attend à Aster"),
    creer("p", "entree-compte-intro", "Ouvre les portes de ton histoire."),
  );
  const connexion = creerConnexion(onConnecte);
  const focusCompte = connexion.focus;
  carte.append(connexion.bloc);
  const rejoindre = () => allerA(carte, focusCompte);
  const jouer = () => { connexion.inscrire(); rejoindre(); };
  const noteCompte = creer("div", "entree-compte-note");
  noteCompte.setAttribute("aria-hidden", "true");
  noteCompte.append(icone("coeur"));
  carte.append(noteCompte);

  const apercu = creer("section", "entree-section entree-apercu");
  apercu.id = "entree-univers";
  apercu.tabIndex = -1;
  const personnages = creer("section", "entree-section entree-rencontres");
  personnages.id = "entree-personnages";
  personnages.tabIndex = -1;
  const { section: concept, afficherPortraits } = creerSectionConcept({
    onChoix: () => allerA(apercu),
    onRencontres: () => allerA(personnages),
    onUnivers: () => allerA(apercu),
  });
  const actionsHero = creer("div", "entree-actions");
  actionsHero.append(
    creerBouton("Créer mon compte", jouer, { pictogramme: "jouer" }),
    creerBouton("Essayer un extrait", () => allerA(scene), { secondaire: true, pictogramme: "livre" }),
  );
  presentation.append(actionsHero);
  const casting = creer("div", "entree-casting");
  casting.setAttribute("aria-hidden", "true");
  casting.hidden = true;
  const colonnes = creer("div", "entree-hero-contenu");
  colonnes.append(presentation, casting, carte);
  hero.append(colonnes);

  const entetePersonnages = creerEntete("Les personnages", "", "Sept personnalités, sept histoires... À toi de trouver celle qui fera battre ton cœur.");
  const titrePersonnages = entetePersonnages.querySelector("h2");
  titrePersonnages.id = "entree-personnages-titre";
  titrePersonnages.textContent = "Sept rencontres. ";
  titrePersonnages.append(creer("em", "", "Et ce petit déclic."));
  personnages.setAttribute("aria-labelledby", titrePersonnages.id);
  const carrousel = creerCarrouselPersonnages(jouer);
  const grille = carrousel.piste;
  const statut = creer("p", "entree-statut", "Les rencontres se préparent…");
  statut.setAttribute("role", "status");
  const decorPersonnages = creerDecorPersonnages();
  personnages.append(...decorPersonnages.elements, entetePersonnages, statut, carrousel.bloc);

  apercu.append(creerEntete("03 / À toi de jouer", "Le premier chapitre, c'est maintenant.", "Un vrai passage de l'épisode 1. Essaie un choix : ici, rien n'est sauvegardé."));
  apercu.append(creer("p", "entree-extrait-badge", "Épisode 01 · Extrait interactif"));
  const scene = creer("div", "entree-scene");
  scene.id = "entree-extrait";
  scene.tabIndex = -1;
  scene.setAttribute("aria-label", "Extrait interactif de l'épisode 1, sans sauvegarde");
  const statutExtrait = creer("p", "entree-statut", "Chargement de l'extrait…");
  statutExtrait.setAttribute("role", "status");
  scene.append(statutExtrait);
  apercu.append(scene, creerBouton("Créer mon compte", jouer, { pictogramme: "jouer" }));

  const navigation = creer("nav", "entree-nav");
  navigation.setAttribute("aria-label", "Navigation principale");
  const marque = creer("a", "entree-marque");
  marque.href = "#entree-campus";
  marque.setAttribute("aria-label", "Accueil — Pomme d'Amour");
  marque.append(creerImage(LOGO, "", ""), creer("span", "", "Pomme d'Amour"));
  marque.addEventListener("click", (event) => { event.preventDefault(); allerA(hero, marque); });
  const liens = creer("div", "entree-nav-liens");
  liens.id = "entree-navigation";
  const menu = creerBouton("Menu", () => {
    const ouvert = menu.getAttribute("aria-expanded") !== "true";
    menu.setAttribute("aria-expanded", String(ouvert));
    liens.classList.toggle("est-ouvert", ouvert);
  }, { secondaire: true });
  menu.classList.add("entree-menu");
  menu.setAttribute("aria-expanded", "false");
  menu.setAttribute("aria-controls", liens.id);
  const ancres = [];
  [
    ["Concept", concept, "etoile"],
    ["Rencontres", personnages, "coeur"],
    ["Extrait jouable", apercu, "manette"],
  ].forEach(([texte, cible, pictogramme]) => {
    const lien = creer("a");
    lien.append(icone(pictogramme), creer("span", "", texte));
    lien.href = `#${cible.id}`;
    lien.addEventListener("click", (event) => {
      event.preventDefault();
      allerA(cible);
    });
    liens.append(lien);
    ancres.push({ cible, lien });
  });
  navigation.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true") {
      menu.setAttribute("aria-expanded", "false");
      liens.classList.remove("est-ouvert");
      menu.focus();
    }
  });
  const compte = creerBouton("Connexion", rejoindre, { secondaire: true, pictogramme: "compte" });
  navigation.append(marque, liens, menu, compte);
  const pied = creer("footer", "entree-footer");
  const signature = creer("div", "entree-signature");
  signature.append(creerImage(LOGO, "", "Pomme d'Amour"), creer("p", "", "Chaque cœur a son histoire."));
  const liensPied = creer("div", "entree-footer-liens");
  liensPied.append(
    creerBouton("Essayer un extrait", () => allerA(scene), { secondaire: true }),
    creerBouton("Les personnages", () => allerA(personnages), { secondaire: true }),
    creerBouton("Créer mon compte", jouer, { pictogramme: "jouer" }),
    creerBouton("Connexion", rejoindre, { secondaire: true }),
  );
  pied.append(signature, liensPied, creer("p", "entree-copyright", "Pomme d'Amour · Université Aster · Visual novel romantique"));
  const eviter = creer("a", "entree-eviter", "Aller au contenu");
  eviter.href = "#entree-concept";
  eviter.addEventListener("click", (event) => { event.preventDefault(); allerA(concept); });
  const invitation = creer("section", "entree-invitation");
  invitation.append(
    creer("p", "entree-surtitre", "La suite t'appartient"),
    creer("h2", "", "C'est peut-être le début de quelque chose."),
    creerBouton("Créer mon compte", jouer, { pictogramme: "jouer" }),
  );
  principal.append(hero, creerTransitionConcept(), concept, personnages, apercu, invitation);
  defilement.append(principal, pied);
  page.append(eviter, navigation, defilement);
  conteneurRacine.replaceChildren(page);

  function actualiserNavigation() {
    const ligne = defilement.getBoundingClientRect().top + 32;
    let active = null;
    ancres.forEach(({ cible, lien }) => {
      if (cible.getBoundingClientRect().top - parseFloat(getComputedStyle(cible).scrollMarginTop) <= ligne) active = lien;
    });
    ancres.forEach(({ lien }) => {
      if (lien === active) lien.setAttribute("aria-current", "location");
      else lien.removeAttribute("aria-current");
    });
  }
  defilement.addEventListener("scroll", actualiserNavigation, { passive: true });
  const observation = new ResizeObserver(() => {
    if (!page.isConnected) { observation.disconnect(); return; }
    actualiserNavigation();
  });
  observation.observe(defilement);
  observation.observe(principal);
  actualiserNavigation();

  getBackgrounds().then((decors) => {
    if (!page.isConnected) return;
    const campus = decors.find((decor) => decor.sourcePath === "assets/Décors/Entrée campus.png");
    if (!campus?.image) {
      console.warn("Décor d'entrée du campus indisponible pour la photo des personnages.");
      return;
    }
    decorPersonnages.afficherDecor(campus.image);
  }).catch((erreur) => {
    console.warn("Photo du campus indisponible.", erreur);
  });

  getCharacters().then((donnees) => {
    if (!page.isConnected) return;
    const avecSprite = (donnees?.crushs || []).filter((p) => p.name && p.sprite);
    const identifiants = ["isaac", "aaron", "camel", "mehdi", "liam", "stella", "sasha"];
    const crushs = identifiants.map((id) => avecSprite.find((p) => p.id === id)).filter(Boolean);
    statut.hidden = crushs.length === identifiants.length;
    statut.textContent = statut.hidden ? "" : "Certains portraits sont momentanément indisponibles.";
    if (!statut.hidden) console.warn("Portraits du casting indisponibles :", identifiants.filter((id) => !crushs.some((p) => p.id === id)));
    carrousel.afficherPersonnages(crushs);
    const vedettes = ["isaac", "aaron"].map((id) => avecSprite.find((p) => p.id === id));
    if (vedettes.every(Boolean)) {
      vedettes.forEach((p) => casting.append(creerImage(urlMedia(p.sprite, { pleineResolution: true }), "entree-casting-personnage", p.name, true)));
    } else {
      console.warn("Les sprites d'Isaac et Aaron sont nécessaires au casting de l'accueil.");
      casting.append(creer("p", "entree-casting-statut", "Les portraits d'Isaac et Aaron sont momentanément indisponibles."));
    }
    casting.hidden = false;
    afficherPortraits(donnees);
    function chargerExtrait() {
      getEpisode("episode1").then((episode) => {
        if (!page.isConnected) return;
        let nettoyer;
        function rejouer() {
          nettoyer?.();
          const moteur = creerMoteurExtrait(episode, donnees);
          nettoyer = lancerEcranDialogue(scene, moteur, { onFinEpisode: rejouer });
        }
        rejouer();
      }).catch((erreur) => {
        console.warn("Extrait de l'accueil indisponible.", erreur);
        if (page.isConnected) {
          statutExtrait.textContent = "L'extrait est momentanément indisponible. Retrouve l'histoire dans le jeu.";
          scene.replaceChildren(statutExtrait);
        }
      });
    }
    if ("IntersectionObserver" in globalThis) {
      const observationExtrait = new IntersectionObserver((entrees) => {
        if (!page.isConnected) {
          observationExtrait.disconnect();
        } else if (entrees.some((entree) => entree.isIntersecting)) {
          observationExtrait.disconnect();
          chargerExtrait();
        }
      }, { root: defilement, rootMargin: "600px" });
      observationExtrait.observe(scene);
    } else {
      chargerExtrait();
    }
  }).catch((erreur) => {
    console.warn("Contenu de l'accueil indisponible.", erreur);
    if (!page.isConnected) return;
    if (!grille.children.length) {
      afficherPortraits(null);
      statut.hidden = false;
      statut.textContent = "Les portraits sont momentanément indisponibles. Tu peux toujours te connecter.";
    }
    statutExtrait.textContent = "L'extrait est momentanément indisponible. Retrouve l'histoire dans le jeu.";
    scene.replaceChildren(statutExtrait);
  });
}