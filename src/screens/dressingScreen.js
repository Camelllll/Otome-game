// Écran « dressing » : les choix à gauche, Sucrette en direct à droite (au-dessus sur mobile).
// L'écran travaille sur un brouillon : rien n'est enregistré avant « Valider mon apparence ».
import {
  apparenceParDefaut,
  assemblerCalques,
  elementsDeCategorie,
  estDebloque,
  normaliserApparence,
} from "../engine/appearance.js";
import { creerAvatarSucrette, creerMiniature, mettreAJourAvatar } from "../ui/sucretteAvatar.js";

const ONGLETS = [
  { id: "skin", label: "Corps", icone: "🧍", sections: [{ categorie: "skin" }] },
  { id: "hair", label: "Cheveux", icone: "💇", sections: [{ categorie: "hair" }] },
  { id: "face", label: "Visage", icone: "👁️", sections: [{ categorie: "eyes", titre: "Yeux" }, { categorie: "eyebrows", titre: "Sourcils" }, { categorie: "mouth", titre: "Bouche" }] },
  {
    id: "tenue",
    label: "Tenue",
    icone: "👗",
    sections: [
      { categorie: "top", titre: "Hauts" },
      { categorie: "bottom", titre: "Bas" },
      { categorie: "outfit", titre: "Robes et tenues complètes", optionnel: true },
    ],
  },
  { id: "accessory", label: "Accessoires", icone: "✨", sections: [{ categorie: "accessory", optionnel: true }] },
];

const FOCUS_PAR_DEFAUT = { x: 0.5, y: 0.3, w: 0.8 };

function creer(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

/**
 * @param {HTMLElement} conteneurRacine
 * @param {object} options
 * @param {object} options.catalogue - catalogue d'apparence chargé.
 * @param {object} options.sauvegarde - sauvegarde courante (prénom, déblocages, apparence enregistrée).
 * @param {string|null} [options.spriteOrigine] - sprite d'origine de Sucrette (characters.json). Tant que le joueur
 *   n'a rien choisi, il est affiché à la place des calques ; « Réinitialiser » le rétablit.
 * @param {(apparence: object|null) => Promise<void>|void} options.onValider - enregistre et change d'écran
 *   (apparence null = sprite d'origine) ; s'il échoue, l'écran reste ouvert et affiche un message.
 * @param {(() => void)|null} [options.onRetour] - quitte sans enregistrer.
 */
export function lancerEcranDressing(conteneurRacine, { catalogue, sauvegarde, spriteOrigine = null, onValider, onRetour } = {}) {
  const nomJoueur = sauvegarde?.playerName || "Sucrette";
  let brouillon = normaliserApparence(sauvegarde?.appearance, catalogue, sauvegarde);
  // false = le joueur porte encore le sprite d'origine ; sans sprite d'origine, on part des calques par défaut.
  let personnalise = Boolean(sauvegarde?.appearance) || !spriteOrigine;
  let occupe = false;

  const ecran = creer("div", "ecran-dressing");

  // --- En-tête -------------------------------------------------------------
  const entete = creer("header", "dressing-entete");
  if (onRetour) {
    const retour = creer("button", "dressing-retour", "← Retour");
    retour.type = "button";
    retour.addEventListener("click", () => onRetour());
    entete.appendChild(retour);
  }
  const titres = creer("div", "dressing-titres");
  titres.append(
    creer("p", "dressing-surtitre", "Garde-robe"),
    creer("h1", "dressing-titre", "Mon dressing"),
  );
  entete.appendChild(titres);

  // --- Panneau de choix (gauche) ------------------------------------------
  const tuiles = [];

  function focusDe(categorie, element) {
    return element.thumbFocus || catalogue.thumbFocus?.[categorie] || FOCUS_PAR_DEFAUT;
  }

  // element = null -> tuile « Aucun » (catégories facultatives).
  function creerTuile(categorie, element) {
    const bouton = creer("button", "dressing-tuile");
    bouton.type = "button";
    bouton.dataset.categorie = categorie;
    bouton.dataset.id = element ? element.id : "";

    if (element) {
      const calques = assemblerCalques({ [categorie]: element.id }, catalogue);
      bouton.appendChild(creerMiniature(calques, catalogue.canvas, focusDe(categorie, element)));
    } else {
      bouton.appendChild(creer("span", "miniature-sucrette miniature-vide", "∅"));
    }
    bouton.appendChild(creer("span", "dressing-tuile-nom", element ? element.label : "Aucun"));

    if (element && !estDebloque(element, sauvegarde)) {
      const indice = element.unlock?.hint || "Pas encore débloqué";
      bouton.disabled = true;
      bouton.classList.add("verrouille");
      bouton.title = indice;
      bouton.setAttribute("aria-label", `${element.label} (verrouillé : ${indice})`);
      bouton.appendChild(creer("span", "dressing-tuile-cadenas", "🔒"));
    } else {
      bouton.addEventListener("click", () => choisir(categorie, element ? element.id : null));
    }
    tuiles.push(bouton);
    return bouton;
  }

  const panneau = creer("section", "dressing-panneau");
  const listeOnglets = creer("div", "dressing-onglets");
  listeOnglets.setAttribute("role", "tablist");
  listeOnglets.setAttribute("aria-label", "Catégories");
  const zoneChoix = creer("div", "dressing-zone-choix");
  const boutonsOnglets = [];
  const panneauxOnglets = [];

  for (const onglet of ONGLETS) {
    const contenu = creer("div", "dressing-choix");
    contenu.id = `dressing-panneau-${onglet.id}`;
    contenu.setAttribute("role", "tabpanel");
    contenu.setAttribute("aria-labelledby", `dressing-onglet-${onglet.id}`);
    contenu.hidden = true;

    for (const section of onglet.sections) {
      const elements = elementsDeCategorie(catalogue, section.categorie);
      if (elements.length === 0) continue;
      const bloc = creer("div", "dressing-section");
      if (section.titre) bloc.appendChild(creer("h2", "dressing-section-titre", section.titre));
      const grille = creer("div", "dressing-grille");
      if (section.optionnel) grille.appendChild(creerTuile(section.categorie, null));
      for (const element of elements) grille.appendChild(creerTuile(section.categorie, element));
      bloc.appendChild(grille);
      contenu.appendChild(bloc);
    }
    // Catégorie sans aucun élément dans le catalogue : pas d'onglet vide.
    if (contenu.childElementCount === 0) continue;

    const bouton = creer("button", "dressing-onglet");
    bouton.type = "button";
    bouton.id = `dressing-onglet-${onglet.id}`;
    bouton.setAttribute("role", "tab");
    bouton.setAttribute("aria-controls", contenu.id);
    bouton.append(creer("span", "dressing-onglet-icone", onglet.icone), creer("span", "dressing-onglet-nom", onglet.label));
    const index = boutonsOnglets.length;
    bouton.addEventListener("click", () => activerOnglet(index));

    boutonsOnglets.push(bouton);
    panneauxOnglets.push(contenu);
    listeOnglets.appendChild(bouton);
    zoneChoix.appendChild(contenu);
  }

  function activerOnglet(index) {
    boutonsOnglets.forEach((bouton, i) => {
      const actif = i === index;
      bouton.setAttribute("aria-selected", String(actif));
      bouton.tabIndex = actif ? 0 : -1;
      panneauxOnglets[i].hidden = !actif;
    });
  }

  listeOnglets.addEventListener("keydown", (evenement) => {
    if (evenement.key !== "ArrowRight" && evenement.key !== "ArrowLeft") return;
    const courant = boutonsOnglets.findIndex((bouton) => bouton.getAttribute("aria-selected") === "true");
    const pas = evenement.key === "ArrowRight" ? 1 : -1;
    const suivant = (courant + pas + boutonsOnglets.length) % boutonsOnglets.length;
    activerOnglet(suivant);
    boutonsOnglets[suivant].focus();
  });

  panneau.append(listeOnglets, zoneChoix);

  // --- Aperçu (droite) -----------------------------------------------------
  const apercu = creer("section", "dressing-apercu");
  const scene = creer("div", "dressing-scene");
  const avatar = creerAvatarSucrette(assemblerCalques(brouillon, catalogue), catalogue.canvas, { etiquette: nomJoueur });
  avatar.classList.add("dressing-avatar");
  const spriteOrigineImg = creer("img", "dressing-avatar dressing-sprite-origine");
  if (spriteOrigine) {
    spriteOrigineImg.src = spriteOrigine;
    spriteOrigineImg.alt = nomJoueur;
    spriteOrigineImg.draggable = false;
  }
  avatar.hidden = !personnalise;
  spriteOrigineImg.hidden = personnalise;
  scene.append(creer("div", "dressing-sol"), spriteOrigineImg, avatar);
  apercu.append(scene, creer("p", "dressing-nom", nomJoueur));

  // --- Actions -------------------------------------------------------------
  const pied = creer("footer", "dressing-actions");
  const statut = creer("p", "dressing-statut");
  statut.setAttribute("role", "status");
  statut.setAttribute("aria-live", "polite");

  const boutonReinitialiser = creer("button", "dressing-bouton dressing-bouton-secondaire", "Réinitialiser");
  boutonReinitialiser.type = "button";
  const boutonValider = creer("button", "dressing-bouton dressing-bouton-principal", "Valider mon apparence");
  boutonValider.type = "button";

  const groupeBoutons = creer("div", "dressing-boutons");
  groupeBoutons.append(boutonReinitialiser, boutonValider);
  pied.append(statut, groupeBoutons);

  // --- Logique -------------------------------------------------------------
  function afficherStatut(message, erreur = false) {
    statut.textContent = message;
    statut.classList.toggle("dressing-statut-erreur", erreur);
  }

  function rafraichirTuiles() {
    for (const tuile of tuiles) {
      const categorie = tuile.dataset.categorie;
      const id = tuile.dataset.id || null;
      tuile.setAttribute("aria-pressed", String(personnalise && (brouillon[categorie] ?? null) === id));
      // Une tenue complète recouvre le haut et le bas : on l'indique sans empêcher de les choisir.
      const recouvert = brouillon.outfit !== null && (categorie === "top" || categorie === "bottom");
      tuile.classList.toggle("recouvert", recouvert);
    }
  }

  function rafraichirApercu() {
    rafraichirTuiles();
    avatar.hidden = !personnalise;
    spriteOrigineImg.hidden = personnalise;
    if (personnalise) mettreAJourAvatar(avatar, assemblerCalques(brouillon, catalogue));
  }

  function choisir(categorie, id) {
    if (occupe) return;
    // Premier choix : on quitte le sprite d'origine et on part des calques par défaut du catalogue.
    personnalise = true;
    const suivant = { ...brouillon, [categorie]: id };
    // Choisir un haut ou un bas retire la robe, sinon le clic ne changerait rien à l'écran.
    if ((categorie === "top" || categorie === "bottom") && id !== null) suivant.outfit = null;
    brouillon = normaliserApparence(suivant, catalogue, sauvegarde);
    afficherStatut("");
    rafraichirApercu();
  }

  function definirOccupe(valeur) {
    occupe = valeur;
    boutonValider.disabled = valeur;
    boutonReinitialiser.disabled = valeur;
    ecran.classList.toggle("dressing-occupe", valeur);
  }

  boutonReinitialiser.addEventListener("click", () => {
    if (occupe) return;
    brouillon = normaliserApparence(apparenceParDefaut(catalogue), catalogue, sauvegarde);
    personnalise = !spriteOrigine;
    afficherStatut(
      spriteOrigine
        ? "Sprite d'origine rétabli. Pense à valider pour le conserver."
        : "Apparence par défaut rétablie. Pense à valider pour la conserver."
    );
    rafraichirApercu();
  });

  boutonValider.addEventListener("click", async () => {
    if (occupe) return;
    definirOccupe(true);
    afficherStatut("Enregistrement…");
    try {
      await onValider?.(personnalise ? { ...brouillon } : null);
      afficherStatut("");
    } catch (erreur) {
      console.error("Apparence non enregistrée.", erreur);
      afficherStatut("Impossible d'enregistrer ton apparence. Réessaie dans un instant.", true);
    } finally {
      definirOccupe(false);
    }
  });

  // --- Assemblage ----------------------------------------------------------
  const corps = creer("div", "dressing-corps");
  corps.append(panneau, apercu);
  ecran.append(entete, corps, pied);

  conteneurRacine.innerHTML = "";
  conteneurRacine.appendChild(ecran);

  activerOnglet(0);
  rafraichirTuiles();
  if (!personnalise) afficherStatut("Tu portes le sprite d'origine. Choisis un élément pour la personnaliser.");
}