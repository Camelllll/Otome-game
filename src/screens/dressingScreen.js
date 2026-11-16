// Écran « dressing » : studio de style de Pommette.
// Scène 2D à cadrage partagé, catalogue unique et résumé de la tenue équipée.
// L'écran travaille sur un brouillon d'apparence : rien n'est enregistré avant « Valider mon apparence ».
// Un achat, lui, est enregistré immédiatement (via onAchat), car il dépense de la monnaie.
import {
  apparenceParDefaut,
  assemblerCalques,
  cleInventaire,
  elementsDeCategorie,
  estDebloque,
  normaliserApparence,
  trouverElement,
} from "../engine/appearance.js";
import { NOM_MONNAIE, acheter, estBoutique, indiceVerrou, prixDe } from "../engine/wardrobe.js";
import { creerAvatarPommette, creerMiniature, mettreAJourAvatar } from "../ui/pommetteAvatar.js";
import { creerZoomDressing } from "../ui/dressingZoom.js";
import { installerMenuJeu } from "../ui/gameMenu.js";
import { MusiqueAmbiance } from "../ui/backgroundMusic.js";
import { PA_ACTIFS } from "../engine/saveSystem.js";
import { demanderConfirmation } from "../ui/gameModal.js";

const CATEGORIES = [
  {
    id: "tenue",
    label: "Tenues",
    icone: "tenue",
    sections: [
      { categorie: "top", titre: "Hauts" },
      { categorie: "bottom", titre: "Bas" },
      { categorie: "outfit", titre: "Robes", optionnel: true, type: "dress" },
      { categorie: "outfit", titre: "Ensembles", optionnel: true, type: "set" },
      { categorie: "top", titre: "Manteaux", type: "coat" },
      { categorie: "shoes", titre: "Chaussures", optionnel: true },
    ],
  },
  { id: "hair", label: "Cheveux", icone: "cheveux", sections: [{ categorie: "hair", titre: "Coiffures" }] },
  { id: "face", label: "Visage", icone: "corps", sections: [{ categorie: "skin", titre: "Teint" }] },
  { id: "eyes", label: "Yeux", icone: "visage", sections: [{ categorie: "eyes", titre: "Couleurs des yeux" }] },
  { id: "eyebrows", label: "Sourcils", icone: "sourcils", sections: [{ categorie: "eyebrows", titre: "Sourcils" }] },
  { id: "mouth", label: "Lèvres", icone: "levres", sections: [{ categorie: "mouth", titre: "Maquillage des lèvres" }] },
  {
    id: "accessory",
    label: "Accessoires",
    icone: "accessoire",
    sections: [{ categorie: "accessory", titre: "Accessoires", optionnel: true, type: "accessory" }],
  },
  { id: "jewelry", label: "Bijoux", icone: "bijou", sections: [{ categorie: "accessory", titre: "Bijoux", optionnel: true, type: "jewelry" }] },
];

const FOCUS_PAR_DEFAUT = { x: 0.5, y: 0.3, w: 0.8 };

// --- Icônes SVG (contour, 24x24) --------------------------------------------------------------
const SVG_NS = "http://www.w3.org/2000/svg";
const ICONES = {
  energie: '<path d="M13 2L5 14h6l-1 8 9-13h-6z"/>',
  sourcils: '<path d="M3 14c5-6 13-6 18 0M3 14c5-3 13-3 18 0"/>',
  levres: '<path d="M2 12c4-1 6-7 10-3 4-4 6 2 10 3-5 8-15 8-20 0zM2 12c6 2 14 2 20 0"/>',
  bijou: '<path d="M3 8l4-5h10l4 5-9 13zM3 8h18M7 3l5 18 5-18"/>',
  plus: '<circle cx="10" cy="10" r="7"/><path d="M15 15l6 6M7 10h6M10 7v6"/>',
  moins: '<circle cx="10" cy="10" r="7"/><path d="M15 15l6 6M7 10h6"/>',
  reset: '<path d="M4 8a9 9 0 1 1-1 7M4 3v5h5"/>',
  entier: '<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5"/>',
  retour: '<path d="M15 5l-7 7 7 7"/>',
  corps: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20.5c0-4.1 3.1-7 7-7s7 2.9 7 7"/>',
  cheveux: '<path d="M12 3.5c-3.9 0-6.5 3-6.5 7 0 3.3-1 5.4-1.5 6.5 1.6.2 3-.3 4-1.5M12 3.5c3.9 0 6.5 3 6.5 7 0 3.3 1 5.4 1.5 6.5-1.6.2-3-.3-4-1.5M8.5 9.5c2.5 0 5-1.2 6.5-3.5"/>',
  visage: '<path d="M2.5 12s3.6-6.5 9.5-6.5S21.5 12 21.5 12s-3.6 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  tenue: '<path d="M9 3.5L3.5 6.5l2 4 2.5-1v11h8v-11l2.5 1 2-4L15 3.5c-.8 1.6-1.8 2.5-3 2.5s-2.2-.9-3-2.5z"/>',
  accessoire: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16.5v4M17 18.5h4"/>',
  boutique: '<path d="M5.5 8h13l-1 12.5h-11z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  garderobe: '<path d="M12 8V6.8a2 2 0 1 0-2-2"/><path d="M12 8l8.2 6.1a1 1 0 0 1-.6 1.9H4.4a1 1 0 0 1-.6-1.9z"/>',
  piece:
    '<circle cx="12" cy="12" r="9.2" fill="#f2d98f" stroke="#b98f3e"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#b98f3e" stroke-width="1.2"/><path d="M12 8.6l2.6 3.4-2.6 3.4-2.6-3.4z" fill="#fff4cf" stroke="#b98f3e" stroke-width="1.1"/>',
  cadenas: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  coche: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  fermer: '<path d="M6 6l12 12M18 6L6 18"/>',
  aucun: '<circle cx="12" cy="12" r="8"/><path d="M6.4 17.6L17.6 6.4"/>',
};

function icone(nom, classe = "") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.7");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", `dressing-icone ${classe}`.trim());
  svg.innerHTML = ICONES[nom] || ""; // contenu statique défini ci-dessus
  return svg;
}

function creer(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

function formaterMontant(valeur) {
  return new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.floor(Number(valeur) || 0)));
}

// Choix d'un élément dans un brouillon : choisir un haut ou un bas retire la robe, sinon le clic ne changerait rien.
function appliquerChoix(base, categorie, id) {
  const suivant = { ...base, [categorie]: id };
  if ((categorie === "top" || categorie === "bottom") && id !== null) suivant.outfit = null;
  return suivant;
}

/**
 * @param {HTMLElement} conteneurRacine
 * @param {object} options
 * @param {object} options.catalogue - catalogue d'apparence chargé.
 * @param {object} options.sauvegarde - sauvegarde courante (prénom, monnaie, inventaire, apparence enregistrée).
 * @param {string|null} [options.spriteOrigine] - sprite d'origine de Pommette (characters.json). Tant que le joueur
 *   n'a rien choisi, il est affiché à la place des calques ; « Réinitialiser » le rétablit.
 * @param {(apparence: object|null) => Promise<void>|void} options.onValider - enregistre et change d'écran
 *   (apparence null = sprite d'origine) ; s'il échoue, l'écran reste ouvert et affiche un message.
 * @param {(annuler: () => void) => Promise<void>|void} options.onAchat - enregistre la sauvegarde juste après un achat (monnaie et
 *   inventaire). S'il échoue, l'achat est annulé.
 * @param {(() => void)|null} [options.onRetour] - quitte sans enregistrer l'apparence.
 */
export function lancerEcranDressing(
  conteneurRacine,
  { catalogue, sauvegarde, spriteOrigine = null, onValider, onAchat, onRetour, onProfil, navigation = {}, fichesPersonnages = [], enregistrerGardeSortie } = {},
) {
  const nomJoueur = sauvegarde?.playerName || "Pommette";
  let brouillon = normaliserApparence(sauvegarde?.appearance, catalogue, sauvegarde);
  // false = le joueur porte encore le sprite d'origine ; sans sprite d'origine, on part des calques par défaut.
  let personnalise = Boolean(sauvegarde?.appearance) || !spriteOrigine;
  let occupe = false;
  const tenueInitiale = JSON.stringify({ personnalise, apparence: brouillon });
  const tenueModifiee = () => tenueInitiale !== JSON.stringify({ personnalise, apparence: brouillon });
  enregistrerGardeSortie?.(async () => {
    if (occupe) {
      afficherStatut("Attends la fin de l'enregistrement avant de quitter.");
      return false;
    }
    if (!tenueModifiee()) return true;
    definirOccupe(true);
    try {
      return Boolean(await demanderConfirmation({
        titre: "Quitter sans valider ta tenue ?",
        message: "Tes modifications de tenue seront abandonnées. Les achats déjà enregistrés restent dans ta garde-robe.",
        confirmer: "Abandonner la tenue",
        annuler: "Rester dans le dressing",
        avertissement: true,
      }));
    } finally {
      definirOccupe(false);
    }
  });
  const prevenirFermeture = event => {
    if (!tenueModifiee() && !occupe) return;
    event.preventDefault();
    event.returnValue = "";
  };
  window.addEventListener("beforeunload", prevenirFermeture);

  let mode = "garde-robe"; // "garde-robe" | "boutique"
  let indexCategorie = 0;
  const sectionsActives = new Map();
  let essai = null; // { categorie, element } : élément de la boutique essayé sans être acheté
  const nouveaux = new Set(); // clés d'inventaire des éléments achetés pendant cette visite

  const categories = CATEGORIES.map((categorie) => ({
    ...categorie,
    sections: categorie.sections.map((section) => ({ ...section, id: section.type || section.categorie })),
  }));
  indexCategorie = Math.max(0, categories.findIndex((categorie) => categorie.id === "tenue"));

  const possedes = (categorie) => elementsDeCategorie(catalogue, categorie).filter((e) => estDebloque(e, sauvegarde));
  const enVente = (categorie) =>
    elementsDeCategorie(catalogue, categorie).filter((e) => estBoutique(e) || !estDebloque(e, sauvegarde));
  const dansSection = (element, section) => {
    if (section.type === "jewelry") return element.subcategory === "jewelry";
    if (section.type === "accessory") return element.subcategory !== "jewelry";
    if (section.type === "coat") return element.subcategory === "coat";
    if (section.type === "set") return element.subcategory === "set";
    if (section.type === "dress") return element.subcategory !== "set";
    return section.categorie !== "top" || element.subcategory !== "coat";
  };

  const ecran = creer("div", "ecran-dressing");

  // Le même menu que dans les dialogues, sans navigation propre au dressing.
  const entete = creer("header", "dressing-entete");
  if (onRetour) {
    const retour = creer("button", "dressing-retour");
    retour.type = "button";
    retour.setAttribute("aria-label", "Retour");
    retour.append(icone("retour"), creer("span", "", "Retour"));
    retour.addEventListener("click", () => { if (!occupe) onRetour(); });
    entete.appendChild(retour);
  }
  entete.appendChild(creer("p", "dressing-signature", "L’atelier des possibles"));
  const enteteDroite = creer("div", "dressing-entete-droite");
  if (PA_ACTIFS && Number.isFinite(sauvegarde.actionPoints)) {
    const pa = creer("span", "dressing-ressource");
    pa.title = "Points d’action";
    pa.append(icone("energie"), creer("span", "", `${sauvegarde.actionPoints} PA`));
    enteteDroite.appendChild(pa);
  }
  entete.appendChild(enteteDroite);
  installerMenuJeu(entete, {
    musique: new MusiqueAmbiance(),
    fiches: fichesPersonnages,
    getInfosPersonnage: (id) => ({ gauges: sauvegarde.gauges?.[id] || {} }),
    getSauvegarde: () => sauvegarde,
    onRetourEpisodes: navigation.scenario,
    onIllustrations: navigation.galerie,
    onDressing: () => activerMode("garde-robe"),
    onProfil,
  });
  const boutonOuvrir = creer("button", "dressing-ouvrir");
  boutonOuvrir.type = "button";
  boutonOuvrir.setAttribute("aria-label", "Voir la garde-robe et la boutique");
  boutonOuvrir.setAttribute("aria-controls", "dressing-panneau");
  boutonOuvrir.appendChild(icone("boutique"));

  const solde = creer("div", "dressing-solde");
  solde.setAttribute("role", "status");
  const soldeValeur = creer("span", "dressing-solde-valeur");
  solde.append(icone("piece", "dressing-solde-piece"), soldeValeur, creer("span", "dressing-masque", ` ${NOM_MONNAIE}`));
  enteteDroite.append(boutonOuvrir, solde);

  function afficherSolde() {
    soldeValeur.textContent = formaterMontant(sauvegarde?.currency);
  }

  function animerSolde(classe) {
    solde.classList.remove(classe);
    void solde.offsetWidth; // relance l'animation
    solde.classList.add(classe);
    window.setTimeout(() => solde.classList.remove(classe), 800);
  }

  function animerDepense(prix) {
    animerSolde("pulse");
    if (prix <= 0) return;
    const piece = creer("span", "dressing-piece-envol");
    piece.append(icone("piece"), creer("span", "", `−${formaterMontant(prix)}`));
    solde.appendChild(piece);
    window.setTimeout(() => piece.remove(), 1200);
  }

  // --- Barre de catégories (gauche) ------------------------------------------
  const nav = creer("nav", "dressing-nav");
  nav.setAttribute("aria-label", "Catégories du dressing");
  const introduction = creer("div", "dressing-introduction");
  introduction.append(creer("span", "dressing-surtitre", "Un style, une histoire"), creer("h1", "dressing-titre", "Mon dressing"), creer("p", "", "Révèle toutes tes facettes."));
  const boutonsCategories = categories.map((categorie, index) => {
    const bouton = creer("button", "dressing-categorie");
    bouton.type = "button";
    bouton.setAttribute("aria-pressed", "false");
    const pastille = creer("span", "dressing-categorie-icone");
    pastille.appendChild(icone(categorie.icone));
    bouton.append(pastille, creer("span", "dressing-categorie-nom", categorie.label));
    bouton.addEventListener("click", () => activerCategorie(index));
    nav.appendChild(bouton);
    return bouton;
  });

  // --- Scène 2D : un seul conteneur transformé pour toutes les images --------
  const stage = creer("section", "dressing-stage");
  stage.setAttribute("aria-label", "Aperçu de ton apparence");
  const scene = creer("div", "dressing-scene");

  const perso = creer("div", "dressing-perso");
  const largeur = Number(catalogue.canvas.width);
  const hauteur = Number(catalogue.canvas.height);
  perso.style.width = `${largeur}px`;
  perso.style.height = `${hauteur}px`;
  const avatar = creerAvatarPommette(assemblerCalques(brouillon, catalogue), catalogue.canvas, { etiquette: nomJoueur });
  perso.appendChild(avatar);
  let spriteOrigineImg = null;
  if (spriteOrigine) {
    spriteOrigineImg = document.createElement("img");
    spriteOrigineImg.className = "dressing-sprite-origine";
    spriteOrigineImg.src = spriteOrigine;
    spriteOrigineImg.alt = nomJoueur;
    perso.appendChild(spriteOrigineImg);
  }

  const pastilleNom = creer("p", "dressing-nom", nomJoueur);
  const pastilleEssai = creer("div", "dressing-essai");
  pastilleEssai.hidden = true;
  const texteEssai = creer("span");
  const boutonFinEssai = creer("button", "dressing-essai-fermer");
  boutonFinEssai.type = "button";
  boutonFinEssai.setAttribute("aria-label", "Arrêter l'essayage");
  boutonFinEssai.appendChild(icone("fermer"));
  pastilleEssai.append(texteEssai, boutonFinEssai);
  scene.append(perso);
  const controlesZoom = creer("div", "dressing-controles-zoom");
  controlesZoom.setAttribute("role", "group");
  controlesZoom.setAttribute("aria-label", "Cadrage du personnage");
  const indicateurZoom = creer("output", "dressing-indicateur-zoom", "En pied");
  const zoom = creerZoomDressing(scene, perso, catalogue.canvas, {
    onChanger: ({ zoom: valeur, categorie }) => {
      indicateurZoom.textContent = `${categorie === "tenue" ? "En pied" : categories.find((c) => c.id === categorie)?.label || "Détail"} · ${Math.round(valeur * 100)} %`;
    },
  });
  for (const [label, nomIcone, action] of [
    ["Agrandir", "plus", zoom.agrandir],
    ["Réduire", "moins", zoom.reduire],
    ["Rétablir le cadrage", "reset", zoom.reinitialiser],
    ["Voir en pied", "entier", zoom.vueComplete],
  ]) {
    const bouton = creer("button", "dressing-controle");
    bouton.type = "button";
    bouton.title = label;
    bouton.setAttribute("aria-label", label);
    bouton.appendChild(icone(nomIcone));
    bouton.addEventListener("click", action);
    controlesZoom.appendChild(bouton);
  }
  controlesZoom.appendChild(indicateurZoom);

  stage.append(scene, pastilleNom, pastilleEssai, controlesZoom);

  // --- Panneau de droite : Ma garde-robe / Boutique ---------------------------
  const panneau = creer("aside", "dressing-panneau");
  panneau.id = "dressing-panneau";
  panneau.setAttribute("aria-label", "Garde-robe et boutique");
  const tete = creer("div", "dressing-panneau-tete");
  const modes = creer("div", "dressing-modes");
  modes.setAttribute("role", "tablist");
  modes.setAttribute("aria-label", "Contenu du panneau");
  const definitionsModes = [
    { id: "garde-robe", label: "Ma garde-robe", icone: "garderobe" },
    { id: "boutique", label: "Boutique", icone: "boutique" },
  ];
  const boutonsModes = definitionsModes.map((definition, index) => {
    const bouton = creer("button", "dressing-mode");
    bouton.type = "button";
    bouton.id = `dressing-mode-${definition.id}`;
    bouton.setAttribute("role", "tab");
    bouton.setAttribute("aria-controls", "dressing-liste");
    bouton.append(icone(definition.icone), creer("span", "", definition.label));
    bouton.addEventListener("click", () => activerMode(definition.id));
    bouton.addEventListener("keydown", (evenement) => {
      if (evenement.key !== "ArrowLeft" && evenement.key !== "ArrowRight") return;
      evenement.preventDefault();
      const suivant = definitionsModes[(index + 1) % definitionsModes.length];
      activerMode(suivant.id);
      document.getElementById(`dressing-mode-${suivant.id}`)?.focus();
    });
    modes.appendChild(bouton);
    return bouton;
  });
  const boutonFermer = creer("button", "dressing-fermer");
  boutonFermer.type = "button";
  boutonFermer.setAttribute("aria-label", "Revenir au personnage");
  boutonFermer.appendChild(icone("retour"));
  tete.append(modes, boutonFermer);

  const titrePanneau = creer("h2", "dressing-panneau-titre");
  const panneauSousCategories = creer("div", "dressing-sous-categories");
  panneauSousCategories.setAttribute("role", "group");
  panneauSousCategories.setAttribute("aria-label", "Sous-catégories du panneau");
  const liste = creer("div", "dressing-panneau-liste");
  liste.id = "dressing-liste";
  liste.setAttribute("role", "tabpanel");
  panneau.append(tete, titrePanneau, panneauSousCategories, liste);

  function ouvrirPanneau() {
    panneau.scrollIntoView({ behavior: reduireMouvement ? "auto" : "smooth", block: "nearest" });
    document.getElementById(`dressing-mode-${mode}`)?.focus({ preventScroll: true });
  }

  function fermerPanneau() {
    stage.scrollIntoView({ behavior: reduireMouvement ? "auto" : "smooth" });
    boutonOuvrir.focus({ preventScroll: true });
  }

  boutonOuvrir.addEventListener("click", ouvrirPanneau);
  boutonFermer.addEventListener("click", fermerPanneau);

  // --- Cartes d'éléments --------------------------------------------------------
  const cartesPanneau = [];

  function focusDe(categorie, element) {
    return element.thumbFocus || catalogue.thumbFocus?.[categorie] || FOCUS_PAR_DEFAUT;
  }

  // element = null -> carte « Aucun » (catégories facultatives).
  function creerVisuel(categorie, element) {
    if (!element) {
      const vide = creer("span", "miniature-pommette miniature-vide");
      vide.appendChild(icone("aucun"));
      return vide;
    }
    if (element.previewAsset) {
      const cadre = creer("span", "miniature-pommette");
      const image = creer("img", "dressing-miniature-dediee");
      image.src = element.previewAsset;
      image.alt = "";
      image.loading = "lazy";
      image.addEventListener("error", () => console.warn(`Miniature introuvable : ${element.previewAsset}`));
      cadre.appendChild(image);
      return cadre;
    }
    const visage = ["skin", "eyes", "eyebrows", "mouth"].includes(categorie);
    const calques = assemblerCalques({ [categorie]: element.id }, catalogue)
      .filter((calque) => visage || calque.slot !== "body");
    return creerMiniature(calques, catalogue.canvas, focusDe(categorie, element));
  }

  function marquerCarte(carte, categorie, element) {
    carte.dataset.categorie = categorie;
    carte.dataset.id = element ? element.id : "";
    if (element) carte.dataset.cle = cleInventaire(element);
  }

  function creerBadges() {
    return [creer("span", "dressing-badge dressing-badge-equipe", "Équipé"), creer("span", "dressing-badge dressing-badge-nouveau", "Nouveau")];
  }

  function creerCartePossedee(registre, categorie, element) {
    const carte = creer("button", `dressing-carte dressing-carte-possedee${element ? "" : " aucun"}`);
    carte.type = "button";
    marquerCarte(carte, categorie, element);
    const etiquette = element ? element.label : "Aucun";
    carte.title = etiquette;
    carte.append(creerVisuel(categorie, element), creer("span", "dressing-carte-nom", etiquette), ...creerBadges());
    carte.addEventListener("click", () => choisir(categorie, element ? element.id : null));
    registre.push(carte);
    return carte;
  }

  // Carte de la boutique : miniature, nom, prix + « Acheter », ou état « Possédé » / verrouillé.
  function creerCarteBoutique(registre, categorie, element) {
    const carte = creer("article", "dressing-carte dressing-carte-boutique");
    marquerCarte(carte, categorie, element);
    const prix = prixDe(element);
    carte.dataset.prix = String(prix);
    const possede = estDebloque(element, sauvegarde);
    const verrou = indiceVerrou(element, sauvegarde);

    const visuel = creer("button", "dressing-carte-visuel");
    visuel.type = "button";
    visuel.append(creerVisuel(categorie, element), ...creerBadges());

    const pied = creer("div", "dressing-carte-pied");
    if (verrou) {
      carte.classList.add("verrouille");
      visuel.disabled = true;
      visuel.title = verrou;
      visuel.setAttribute("aria-label", `${element.label} (verrouillé : ${verrou})`);
      visuel.appendChild(icone("cadenas", "dressing-cadenas"));
      const etat = creer("p", "dressing-etat dressing-etat-verrou");
      etat.append(icone("cadenas"), creer("span", "", verrou));
      pied.appendChild(etat);
    } else if (possede) {
      carte.classList.add("possedee");
      visuel.setAttribute("aria-label", `Équiper ${element.label}`);
      visuel.addEventListener("click", () => choisir(categorie, element.id));
      const etat = creer("p", "dressing-etat dressing-etat-possede");
      etat.append(icone("coche"), creer("span", "", "Possédé"));
      pied.appendChild(etat);
    } else {
      visuel.setAttribute("aria-label", `Essayer ${element.label}`);
      visuel.addEventListener("click", () => essayer(categorie, element));
      const vente = creer("div", "dressing-vente");
      const etiquettePrix = creer("span", "dressing-prix");
      etiquettePrix.append(icone("piece"), creer("span", "", formaterMontant(prix)), creer("span", "dressing-masque", ` ${NOM_MONNAIE}`));
      const boutonAcheter = creer("button", "dressing-acheter", "Acheter");
      boutonAcheter.type = "button";
      boutonAcheter.setAttribute("aria-label", `Acheter ${element.label} pour ${formaterMontant(prix)} ${NOM_MONNAIE}`);
      boutonAcheter.addEventListener("click", () => acheterElement(categorie, element, carte));
      vente.append(etiquettePrix, boutonAcheter);
      pied.appendChild(vente);
    }

    carte.append(visuel, creer("span", "dressing-carte-nom", element.label), pied);
    registre.push(carte);
    return carte;
  }

  function rendrePanneau() {
    rendreSousCategories();
    cartesPanneau.length = 0;
    liste.replaceChildren();
    liste.setAttribute("aria-labelledby", `dressing-mode-${mode}`);
    const categorie = categories[indexCategorie];
    if (!categorie) return;
    titrePanneau.textContent = categorie.label;

    const active = sectionActive();
    for (const section of categorie.sections.filter((section) => section === active)) {
      const elements = (mode === "boutique" ? enVente(section.categorie) : possedes(section.categorie))
        .filter((element) => dansSection(element, section));
      if (elements.length === 0 && !section.optionnel) continue;
      const bloc = creer("section", "dressing-section");
      bloc.appendChild(creer("h3", "dressing-section-titre", section.titre));
      const grille = creer("div", "dressing-grille");
      if (mode === "garde-robe" && section.optionnel) grille.appendChild(creerCartePossedee(cartesPanneau, section.categorie, null));
      for (const element of elements) {
        grille.appendChild(
          mode === "boutique"
            ? creerCarteBoutique(cartesPanneau, section.categorie, element)
            : creerCartePossedee(cartesPanneau, section.categorie, element),
        );
      }
      bloc.appendChild(grille);
      liste.appendChild(bloc);
    }
    if (liste.childElementCount === 0) {
      liste.appendChild(
        creer(
          "p",
          "dressing-vide",
          mode === "boutique" ? "De nouvelles pièces se préparent… Rien à acheter ici pour le moment." : "Ta collection commence ici. Aucun élément disponible dans cette catégorie.",
        ),
      );
    }
    rafraichirEtats();
  }

  // --- Barre du bas : uniquement les éléments portés -------------------------
  const bas = creer("footer", "dressing-bas");
  const rangee = creer("div", "dressing-rangee");
  const piste = creer("div", "dressing-piste");
  piste.setAttribute("role", "group");
  piste.setAttribute("aria-label", "Tenue actuelle");
  rangee.append(creer("span", "dressing-tenue-label", "Tenue actuelle"), piste);

  const statut = creer("p", "dressing-statut");
  statut.setAttribute("role", "status");
  statut.setAttribute("aria-live", "polite");
  const boutonReinitialiser = creer("button", "dressing-bouton dressing-bouton-secondaire", "Réinitialiser");
  boutonReinitialiser.type = "button";
  const boutonValider = creer("button", "dressing-bouton dressing-bouton-principal");
  boutonValider.type = "button";
  boutonValider.append(icone("coche"), creer("span", "", "Valider ma tenue"));
  const boutons = creer("div", "dressing-boutons");
  boutons.append(boutonReinitialiser, boutonValider);
  const actions = creer("div", "dressing-actions");
  actions.append(statut, boutons);
  bas.append(rangee, actions);

  const reduireMouvement = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

  // --- Utilitaires d'interface -----------------------------------------------
  function afficherStatut(message, erreur = false) {
    statut.textContent = message;
    statut.classList.toggle("dressing-statut-erreur", erreur);
  }

  // Relance une animation CSS portée par une classe.
  function animer(noeud, classe, duree = 700) {
    noeud.classList.remove(classe);
    void noeud.offsetWidth; // force le recalcul pour rejouer l'animation
    noeud.classList.add(classe);
    window.setTimeout(() => noeud.classList.remove(classe), duree);
  }

  const boutonsSuspendus = new Set();
  function definirOccupe(valeur) {
    occupe = valeur;
    if (valeur) {
      for (const bouton of ecran.querySelectorAll("button:not(:disabled)")) {
        boutonsSuspendus.add(bouton);
        bouton.disabled = true;
      }
    } else {
      for (const bouton of boutonsSuspendus) bouton.disabled = false;
      boutonsSuspendus.clear();
    }
    ecran.setAttribute("aria-busy", String(valeur));
    ecran.classList.toggle("dressing-occupe", valeur);
  }

  function sectionActive() {
    const categorie = categories[indexCategorie];
    if (!categorie) return null;
    const id = sectionsActives.get(categorie.id);
    return categorie.sections.find((section) => section.id === id) || categorie.sections[0];
  }

  function rendreSousCategories() {
    const categorie = categories[indexCategorie];
    const active = sectionActive();
    panneauSousCategories.replaceChildren();
    panneauSousCategories.hidden = !categorie || categorie.sections.length < 2;
    if (panneauSousCategories.hidden) return;
    for (const section of categorie.sections) {
      const puce = creer("button", "dressing-puce", section.titre);
      puce.type = "button";
      puce.setAttribute("aria-pressed", String(section === active));
      puce.addEventListener("click", () => {
        sectionsActives.set(categorie.id, section.id);
        rendrePanneau();
      });
      panneauSousCategories.appendChild(puce);
    }
  }

  function rendreBas() {
    piste.replaceChildren();
    if (!personnalise) {
      piste.appendChild(creer("span", "dressing-tenue-origine", "Ta tenue d’origine"));
      return;
    }
    const slots = brouillon.outfit ? ["outfit", "shoes", "accessory"] : ["top", "bottom", "shoes", "accessory"];
    for (const categorie of slots) {
      const element = trouverElement(catalogue, categorie, brouillon[categorie]);
      if (!element) continue;
      const bouton = creer("button", "dressing-element-porte");
      bouton.type = "button";
      bouton.title = element.label;
      bouton.setAttribute("aria-label", `Modifier : ${element.label}`);
      bouton.appendChild(creerVisuel(categorie, element));
      bouton.addEventListener("click", () => {
        const index = categories.findIndex((groupe) => groupe.sections.some((section) =>
          section.categorie === categorie && dansSection(element, section)));
        if (index >= 0) {
          const section = categories[index].sections.find((s) => s.categorie === categorie && dansSection(element, s));
          sectionsActives.set(categories[index].id, section.id);
          activerCategorie(index);
          ouvrirPanneau();
        }
      });
      piste.appendChild(bouton);
    }
  }

  // --- États des cartes et aperçu ----------------------------------------------
  function apparenceAffichee() {
    return essai ? appliquerChoix(brouillon, essai.categorie, essai.element.id) : brouillon;
  }

  function rafraichirEtats() {
    const recouvert = (brouillon.outfit ?? null) !== null;
    for (const carte of cartesPanneau) {
      const categorie = carte.dataset.categorie;
      const id = carte.dataset.id || null;
      const equipe = personnalise && (brouillon[categorie] ?? null) === id;
      carte.classList.toggle("equipee", equipe);
      carte.classList.toggle("essai", Boolean(essai) && essai.categorie === categorie && essai.element.id === id);
      carte.classList.toggle("nouveau", nouveaux.has(carte.dataset.cle));
      const badgeEquipe = carte.querySelector(".dressing-badge-equipe");
      const badgeNouveau = carte.querySelector(".dressing-badge-nouveau");
      if (badgeEquipe) badgeEquipe.hidden = !equipe;
      if (badgeNouveau) badgeNouveau.hidden = !nouveaux.has(carte.dataset.cle);
      // Une tenue complète recouvre le haut et le bas : on l'indique sans empêcher de les choisir.
      carte.classList.toggle("recouvert", recouvert && (categorie === "top" || categorie === "bottom"));
      if (carte instanceof HTMLButtonElement) carte.setAttribute("aria-pressed", String(equipe));
    }
  }

  function rafraichirApercu(anime = false) {
    const montrerCalques = personnalise || Boolean(essai);
    avatar.hidden = !montrerCalques;
    if (spriteOrigineImg) spriteOrigineImg.hidden = montrerCalques;
    if (montrerCalques) mettreAJourAvatar(avatar, assemblerCalques(apparenceAffichee(), catalogue));
    pastilleEssai.hidden = !essai;
    if (essai) texteEssai.textContent = `Essayage : ${essai.element.label}`;
    rafraichirEtats();
    rendreBas();
    if (anime) animer(perso, "change", 600);
  }

  // --- Navigation --------------------------------------------------------------
  function activerCategorie(index) {
    if (occupe) return;
    indexCategorie = index;
    essai = null;
    boutonsCategories.forEach((bouton, position) => {
      const actif = position === index;
      bouton.setAttribute("aria-pressed", String(actif));
      bouton.classList.toggle("actif", actif);
    });
    rendrePanneau();
    rafraichirApercu();
    cadrerCategorie();
  }

  function cadrerCategorie() {
    const categorie = categories[indexCategorie];
    const element = trouverElement(catalogue, "accessory", brouillon.accessory);
    const focus = ["accessory", "jewelry"].includes(categorie.id) && element?.thumbFocus;
    zoom.cadrer(categorie.id, focus ? { x: focus.x, y: focus.y, hauteur: focus.w * largeur / hauteur } : undefined);
  }

  function activerMode(id) {
    if (occupe) return;
    mode = id;
    essai = null;
    definitionsModes.forEach((definition, position) => {
      const actif = definition.id === id;
      boutonsModes[position].setAttribute("aria-selected", String(actif));
      boutonsModes[position].tabIndex = actif ? 0 : -1;
      boutonsModes[position].classList.toggle("actif", actif);
    });
    rendrePanneau();
    rafraichirApercu();
  }

  // --- Actions du joueur -------------------------------------------------------
  function choisir(categorie, id) {
    if (occupe) return;
    // Premier choix : on quitte le sprite d'origine et on part des calques par défaut du catalogue.
    personnalise = true;
    essai = null;
    brouillon = normaliserApparence(appliquerChoix(brouillon, categorie, id), catalogue, sauvegarde);
    afficherStatut("");
    rafraichirApercu(true);
    if (categorie === "accessory") cadrerCategorie();
  }

  function arreterEssai() {
    if (!essai) return;
    essai = null;
    rafraichirApercu(true);
  }

  // Essayage d'un élément pas encore acheté : visible sur le personnage, jamais ajouté au brouillon.
  function essayer(categorie, element) {
    if (occupe) return;
    if (essai && essai.categorie === categorie && essai.element.id === element.id) {
      arreterEssai();
      return;
    }
    essai = { categorie, element };
    afficherStatut("");
    rafraichirApercu(true);
  }

  boutonFinEssai.addEventListener("click", arreterEssai);

  function refuserAchat(resultat, carte) {
    if (resultat.raison === "fonds") {
      afficherStatut(`Il te manque ${formaterMontant(resultat.manque)} ${NOM_MONNAIE} pour cet achat.`);
      animerSolde("manque");
    } else if (resultat.raison === "verrouille") {
      afficherStatut(resultat.indice || "Cet élément n'est pas encore disponible.");
    } else {
      afficherStatut("Cet élément n'est pas disponible à l'achat.");
    }
    animer(carte, "refus", 600);
  }

  async function acheterElement(categorie, element, carte) {
    if (occupe) return;
    const resultat = acheter(element, sauvegarde);
    if (!resultat.ok) {
      if (resultat.raison === "deja-possede") {
        rendrePanneau();
      } else {
        refuserAchat(resultat, carte);
      }
      return;
    }

    definirOccupe(true);
    try {
      if (!onAchat) throw new Error("Service d'achat indisponible.");
      await onAchat(resultat.annuler);
    } catch (erreur) {
      console.error("Achat non enregistré.", erreur);
      resultat.annuler();
      afficherSolde();
      afficherStatut("L'achat n'a pas pu être enregistré. Tu n'as rien dépensé, réessaie dans un instant.", true);
      return;
    } finally {
      definirOccupe(false);
    }

    const cle = cleInventaire(element);
    nouveaux.add(cle);
    essai = null;
    personnalise = true;
    // Achat réussi : l'élément est équipé tout de suite (le brouillon, pas la sauvegarde de l'apparence).
    brouillon = normaliserApparence(appliquerChoix(brouillon, categorie, element.id), catalogue, sauvegarde);
    afficherSolde();
    animerDepense(resultat.prix);
    afficherStatut(`${element.label} acheté et équipé. Valide ton apparence pour le garder sur toi.`);
    rendrePanneau();
    rafraichirApercu(true);
    const nouvelleCarte = cartesPanneau.find((candidate) => candidate.dataset.cle === cle);
    if (nouvelleCarte) animer(nouvelleCarte, "illumine", 1400);
  }

  boutonReinitialiser.addEventListener("click", () => {
    if (occupe) return;
    essai = null;
    brouillon = normaliserApparence(apparenceParDefaut(catalogue), catalogue, sauvegarde);
    personnalise = !spriteOrigine;
    afficherStatut(
      spriteOrigine
        ? "Sprite d'origine rétabli. Pense à valider pour le conserver."
        : "Apparence par défaut rétablie. Pense à valider pour la conserver.",
    );
    rafraichirApercu(true);
  });

  boutonValider.addEventListener("click", async () => {
    if (occupe) return;
    essai = null;
    rafraichirApercu();
    definirOccupe(true);
    afficherStatut("Enregistrement…");
    try {
      if (!onValider) throw new Error("Service de sauvegarde indisponible.");
      await onValider(personnalise ? { ...brouillon } : null);
      afficherStatut("");
    } catch (erreur) {
      console.error("Apparence non enregistrée.", erreur);
      afficherStatut("Impossible d'enregistrer ton apparence. Réessaie dans un instant.", true);
    } finally {
      definirOccupe(false);
    }
  });

  // --- Assemblage ----------------------------------------------------------------
  ecran.append(entete, introduction, nav, stage, panneau, bas);

  conteneurRacine.innerHTML = "";
  conteneurRacine.appendChild(ecran);

  afficherSolde();
  activerMode(mode);
  activerCategorie(indexCategorie);
  if (!personnalise) afficherStatut("Tu portes le sprite d'origine. Choisis un élément pour la personnaliser.");
  return () => {
    zoom.detruire();
    window.removeEventListener("beforeunload", prevenirFermeture);
  };
}