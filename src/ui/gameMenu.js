// Menu partagé entre les épisodes, le dialogue et le dressing.
import { creerCarnet } from "./carnetRelations.js";
import { demanderConfirmation } from "./gameModal.js";
import {
  MODES_CONTRASTE,
  MODES_COEURS,
  MODES_TRANSPARENCE,
  PALIERS_TEXTE,
  appliquerPrefsA11y,
  chargerPrefsA11y,
} from "./accessibilite.js";

/**
 * @param {HTMLElement} scene - conteneur de l'écran de jeu.
 * @param {object} options - { musique, fiches, getInfosPersonnage, getSauvegarde, onRetourEpisodes, onDressing, onProfil, onCompte, onNouvellePartie }
 */
export function installerMenuJeu(scene, { musique, fiches = [], getInfosPersonnage, getSauvegarde, onRetourEpisodes, onDressing, onProfil, onCompte, onNouvellePartie, surface = scene } = {}) {
  let navigationEnCours = false;
  async function naviguer(action) {
    if (navigationEnCours) return;
    navigationEnCours = true;
    ouvrirMenu(false);
    try {
      await action();
    } catch (erreur) {
      console.error("Navigation depuis le jeu impossible.", erreur);
      await demanderConfirmation({
        titre: "Navigation impossible", message: erreur.message, confirmer: "Fermer", annuler: null,
      });
    } finally {
      navigationEnCours = false;
    }
  }

  function rafraichirIconeMusique() {
    const actif = !!musique?.active;

    // Synchroniser l'option musique dans le panneau
    if (optionMusique) {
      optionMusique.classList.toggle("muet", !actif);
      const iconeEl = optionMusique.querySelector(".option-menu-icone");
      if (iconeEl) {
        iconeEl.innerHTML = actif
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
               <path d="M9 18V5l12-2v13"/>
               <circle cx="6" cy="18" r="3"/>
               <circle cx="18" cy="16" r="3"/>
             </svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
               <path d="M9 18V5l12-2v13"/>
               <circle cx="6" cy="18" r="3"/>
               <circle cx="18" cy="16" r="3"/>
               <line x1="2" y1="2" x2="22" y2="22"/>
             </svg>`;
      }
      const labelEl = optionMusique.querySelector(".option-menu-label");
      if (labelEl) labelEl.textContent = actif ? "Musique activée" : "Musique désactivée";
      const badge = optionMusique.querySelector(".badge-muet");
      if (badge) badge.textContent = actif ? "" : "muet";
    }
  }

  // ── Bouton principal du menu (icône hamburger seule) ───────────────
  const bouton = document.createElement("button");
  bouton.className = "bouton-menu";
  bouton.type = "button";
  bouton.setAttribute("aria-haspopup", "true");
  bouton.setAttribute("aria-expanded", "false");
  bouton.setAttribute("aria-label", "Menu");
  bouton.innerHTML = `
    <svg class="menu-hamburger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <line x1="4" y1="7"  x2="20" y2="7"/>
      <line x1="4" y1="12" x2="20" y2="12"/>
      <line x1="4" y1="17" x2="20" y2="17"/>
    </svg>`;

  // ── Panneau menu ───────────────────────────────────────────────────
  const panneau = document.createElement("div");
  panneau.className = "panneau-menu";
  panneau.id = "menu-jeu";
  panneau.setAttribute("role", "group");
  panneau.setAttribute("aria-label", "Menu du jeu");
  bouton.removeAttribute("aria-haspopup");
  bouton.setAttribute("aria-controls", panneau.id);

  // Séparateur utilitaire
  function creerSeparateur() {
    const s = document.createElement("div");
    s.className = "menu-separateur";
    return s;
  }

  // Titre de section
  function creerSectionTitre(label) {
    const t = document.createElement("div");
    t.className = "menu-section-titre";
    t.textContent = label;
    return t;
  }

  // Option
  function creerOption(icone, label, desactive = false) {
    const btn = document.createElement("button");
    btn.className = "option-menu";
    btn.type = "button";
    btn.disabled = desactive;
    btn.innerHTML = `<span class="option-menu-icone">${icone}</span><span class="option-menu-label">${label}</span>`;
    return btn;
  }

  const optionPersonnages = creerOption(
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    "Relations",
    fiches.length === 0
  );

  const optionDressing = creerOption(
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H7v10c0 1.1.9 2 2 2h6a2 2 0 0 0 2-2V10h3.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>`,
    "Mon dressing",
    !onDressing
  );

  const optionEpisodes = creerOption(
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    "Accueil · Épisodes",
    !onRetourEpisodes
  );

  // Option musique dans le panneau (état initial synchronisé après création)
  const optionMusique = creerOption(
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
       <path d="M9 18V5l12-2v13"/>
       <circle cx="6" cy="18" r="3"/>
       <circle cx="18" cy="16" r="3"/>
     </svg>`,
    "Musique activée"
  );
  // Ajouter la pastille muet (cachée par défaut si musique active)
  optionMusique.innerHTML += `<span class="badge-muet"></span>`;

  panneau.append(
    creerSectionTitre("Histoire"),
    optionPersonnages,
    optionDressing,
    creerSeparateur(),
    creerSectionTitre("Navigation"),
  );
  if (onRetourEpisodes) panneau.appendChild(optionEpisodes);

  if (onProfil) {
    const optionProfil = creerOption(
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
      "Mon carnet"
    );
    optionProfil.addEventListener("click", () => {
      return naviguer(onProfil);
    });
    panneau.appendChild(optionProfil);
  }
  if (onCompte) {
    const compte = creerOption(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>',
      "Compte",
    );
    compte.addEventListener("click", () => naviguer(onCompte));
    panneau.appendChild(compte);
  }
  if (onNouvellePartie) {
    const recommencer = creerOption(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7"/></svg>',
      "Recommencer l'histoire",
    );
    recommencer.addEventListener("click", () => naviguer(onNouvellePartie));
    panneau.appendChild(recommencer);
  }

  // Section Paramètres (musique)
  panneau.append(
    creerSeparateur(),
    creerSectionTitre("Paramètres"),
    optionMusique,
  );

  // ── Option Accessibilité ──────────────────────────────────────────
  const optionAccessibilite = creerOption(
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
       <circle cx="12" cy="5" r="1.5"/>
       <path d="M12 7.5v5l-3 4.5m3-4.5 3 4.5"/>
       <path d="M6.5 10.5a9 9 0 0 0 11 0"/>
     </svg>`,
    "Accessibilité"
  );
  panneau.appendChild(optionAccessibilite);

  // ── Panneau Accessibilité (sous-panneau) ─────────────────────────
  const panneauA11y = document.createElement("div");
  panneauA11y.className = "panneau-a11y";
  panneauA11y.setAttribute("role", "group");
  panneauA11y.setAttribute("aria-label", "Paramètres d'accessibilité");
  panneauA11y.hidden = true;

  /**
   * Crée un contrôle de réglage (label + boutons − / valeur / +).
   */
  function creerReglage({ id, label, valeurs, lire, ecrire, formaterValeur }) {
    const wrapper = document.createElement("div");
    wrapper.className = "a11y-reglage";
    wrapper.setAttribute("role", "group");
    wrapper.setAttribute("aria-labelledby", id + "-titre");

    const labelEl = document.createElement("span");
    labelEl.className = "a11y-reglage-label";
    labelEl.id = id + "-titre";
    labelEl.textContent = label;

    const controles = document.createElement("div");
    controles.className = "a11y-reglage-controles";

    const btnMoins = document.createElement("button");
    btnMoins.type = "button";
    btnMoins.className = "a11y-btn-step";
    btnMoins.setAttribute("aria-label", "Diminuer " + label);
    btnMoins.textContent = "−";

    const affichage = document.createElement("span");
    affichage.className = "a11y-valeur";
    affichage.id = id + "-valeur";
    affichage.setAttribute("aria-live", "polite");

    const btnPlus = document.createElement("button");
    btnPlus.type = "button";
    btnPlus.className = "a11y-btn-step";
    btnPlus.setAttribute("aria-label", "Augmenter " + label);
    btnPlus.textContent = "+";

    function raffraichir(val) {
      affichage.textContent = formaterValeur(val);
      btnMoins.disabled = val === valeurs[0];
      btnPlus.disabled = val === valeurs[valeurs.length - 1];
    }

    function decaler(sens) {
      const index = valeurs.indexOf(lire());
      const cible = valeurs[Math.min(valeurs.length - 1, Math.max(0, index + sens))];
      ecrire(cible);
      raffraichir(cible);
      if (document.activeElement?.disabled) (sens > 0 ? btnMoins : btnPlus).focus();
    }

    btnMoins.addEventListener("click", () => decaler(-1));
    btnPlus.addEventListener("click", () => decaler(1));

    controles.append(btnMoins, affichage, btnPlus);
    wrapper.append(labelEl, controles);

    // Retourner la fonction de rafraîchissement pour l'appel initial
    wrapper._raffraichir = () => raffraichir(lire());
    return wrapper;
  }

  const titreA11y = document.createElement("div");
  titreA11y.className = "a11y-titre";
  titreA11y.textContent = "Accessibilité";

  const descA11y = document.createElement("p");
  descA11y.className = "a11y-desc";
  descA11y.textContent = "Ajuste l'affichage du jeu selon tes besoins.";

  const reglageTexte = creerReglage({
    id: "a11y-texte",
    label: "Taille du texte",
    valeurs: PALIERS_TEXTE.map((p) => p.valeur),
    lire: () => chargerPrefsA11y().textScale,
    ecrire: (v) => appliquerPrefsA11y({ textScale: v }),
    formaterValeur: (v) => {
      const palier = PALIERS_TEXTE.find((p) => p.valeur === v);
      return palier ? `${palier.libelle} (${palier.pourcentage} %)` : `${Math.round(v * 100)} %`;
    },
  });

  const reglageContraste = creerReglage({
    id: "a11y-contraste",
    label: "Contraste",
    valeurs: MODES_CONTRASTE.map((m) => m.valeur),
    lire: () => chargerPrefsA11y().contrastMode,
    ecrire: (v) => appliquerPrefsA11y({ contrastMode: v }),
    formaterValeur: (v) => MODES_CONTRASTE.find((m) => m.valeur === v)?.libelle ?? v,
  });

  const reglageTransparence = creerReglage({
    id: "a11y-transparence",
    label: "Transparence",
    valeurs: MODES_TRANSPARENCE.map((m) => m.valeur),
    lire: () => chargerPrefsA11y().transparencyMode,
    ecrire: (v) => appliquerPrefsA11y({ transparencyMode: v }),
    formaterValeur: (v) => MODES_TRANSPARENCE.find((m) => m.valeur === v)?.libelle ?? v,
  });

  const reglageCoeurs = creerReglage({
    id: "a11y-coeurs",
    label: "Animations des cœurs",
    valeurs: MODES_COEURS.map((m) => m.valeur),
    lire: () => chargerPrefsA11y().heartAnimations,
    ecrire: (v) => appliquerPrefsA11y({ heartAnimations: v }),
    formaterValeur: (v) => MODES_COEURS.find((m) => m.valeur === v)?.libelle ?? v,
  });

  // Lecture confortable : bouton à bascule. L'état est écrit en texte et porté par aria-pressed,
  // pour ne pas reposer uniquement sur la couleur.
  const reglageConfort = document.createElement("div");
  reglageConfort.className = "a11y-reglage";

  const libelleConfort = document.createElement("span");
  libelleConfort.className = "a11y-reglage-label";
  libelleConfort.id = "a11y-confort-titre";
  libelleConfort.textContent = "Lecture confortable";

  const etatConfort = document.createElement("span");
  etatConfort.id = "a11y-confort-etat";

  const btnConfort = document.createElement("button");
  btnConfort.type = "button";
  btnConfort.className = "a11y-bascule";
  btnConfort.setAttribute("aria-labelledby", "a11y-confort-titre a11y-confort-etat");
  btnConfort.append(etatConfort);

  function rafraichirConfort() {
    const actif = chargerPrefsA11y().comfortableReading;
    btnConfort.setAttribute("aria-pressed", String(actif));
    etatConfort.textContent = actif ? "Activée" : "Désactivée";
  }

  btnConfort.addEventListener("click", () => {
    appliquerPrefsA11y({ comfortableReading: !chargerPrefsA11y().comfortableReading });
    rafraichirConfort();
  });

  reglageConfort.append(libelleConfort, btnConfort);
  reglageConfort._raffraichir = rafraichirConfort;

  function creerBascule(id, libelle, cle) {
    const wrapper = document.createElement("div");
    wrapper.className = "a11y-reglage";
    const label = document.createElement("span");
    label.className = "a11y-reglage-label";
    label.id = `${id}-titre`;
    label.textContent = libelle;
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "a11y-bascule";
    bouton.setAttribute("aria-labelledby", `${id}-titre ${id}-etat`);
    const etat = document.createElement("span");
    etat.id = `${id}-etat`;
    bouton.append(etat);
    wrapper._raffraichir = () => {
      const actif = chargerPrefsA11y()[cle];
      bouton.setAttribute("aria-pressed", String(actif));
      etat.textContent = actif ? "Activée" : "Désactivée";
    };
    bouton.addEventListener("click", () => {
      appliquerPrefsA11y({ [cle]: !chargerPrefsA11y()[cle] });
      wrapper._raffraichir();
    });
    wrapper.append(label, bouton);
    return wrapper;
  }
  const reglageMouvement = creerBascule("a11y-mouvement", "Réduire les animations", "reduceMotion");
  const reglageLueurs = creerBascule("a11y-lueurs", "Réduire les scintillements", "noGlow");

  const btnFermerA11y = document.createElement("button");
  btnFermerA11y.type = "button";
  btnFermerA11y.className = "a11y-btn-fermer";
  btnFermerA11y.textContent = "← Retour";
  btnFermerA11y.setAttribute("aria-label", "Fermer les paramètres d'accessibilité");

  panneauA11y.append(
    titreA11y,
    descA11y,
    reglageTexte,
    reglageContraste,
    reglageTransparence,
    reglageConfort,
    reglageMouvement,
    reglageLueurs,
    reglageCoeurs,
    btnFermerA11y,
  );
  panneau.appendChild(panneauA11y);

  // Synchroniser les valeurs affichées à l'ouverture
  function synchroniserA11y() {
    reglageTexte._raffraichir();
    reglageContraste._raffraichir();
    reglageTransparence._raffraichir();
    reglageConfort._raffraichir();
    reglageMouvement._raffraichir();
    reglageLueurs._raffraichir();
    reglageCoeurs._raffraichir();
  }

  function ouvrirA11y(ouvert) {
    panneauA11y.hidden = !ouvert;
    // Masquer les autres éléments du panneau quand le sous-panneau est ouvert
    panneau.querySelectorAll(":scope > :not(.panneau-a11y)").forEach(el => {
      el.style.display = ouvert ? "none" : "";
    });
    if (ouvert) {
      synchroniserA11y();
      btnFermerA11y.focus();
    } else {
      optionAccessibilite.focus();
    }
  }

  optionAccessibilite.addEventListener("click", () => {
    ouvrirA11y(true);
  });

  btnFermerA11y.addEventListener("click", () => {
    ouvrirA11y(false);
  });

  // ── Carnet de relations ────────────────────────────────────────────
  const carnet = creerCarnet({ fiches, getInfosPersonnage, getSauvegarde });

  scene.append(bouton, panneau);
  surface.append(carnet.element);

  // Synchroniser l'état initial de l'icône musique dans le panneau
  rafraichirIconeMusique();

  // ── Ouverture / fermeture ──────────────────────────────────────────
  function ouvrirMenu(ouvert) {
    // Referme le sous-panneau Accessibilité avec le menu pour le retrouver au menu principal à la réouverture.
    if (!ouvert && !panneauA11y.hidden) ouvrirA11y(false);
    panneau.classList.toggle("visible", ouvert);
    bouton.setAttribute("aria-expanded", String(ouvert));
    bouton.classList.toggle("actif", ouvert);
  }

  bouton.addEventListener("click", (event) => {
    event.stopPropagation();
    ouvrirMenu(!panneau.classList.contains("visible"));
  });

  // Échap ferme d'abord le sous-panneau Accessibilité, puis le menu. Écouteur posé sur la scène pour ne pas survivre à l'écran.
  scene.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !panneau.classList.contains("visible")) return;
    event.preventDefault();
    if (!panneauA11y.hidden) {
      ouvrirA11y(false);
      optionAccessibilite.focus();
    } else {
      ouvrirMenu(false);
      bouton.focus();
    }
  });

  surface.addEventListener("pointerdown", (event) => {
    if (!panneau.contains(event.target) && !bouton.contains(event.target)) ouvrirMenu(false);
  });

  // ── Actions des options ────────────────────────────────────────────
  optionPersonnages.addEventListener("click", () => {
    ouvrirMenu(false);
    bouton.focus();
    carnet.ouvrir();
  });

  optionDressing.addEventListener("click", () => {
    return naviguer(onDressing);
  });

  optionEpisodes.addEventListener("click", () => {
    return naviguer(onRetourEpisodes);
  });

  optionMusique.addEventListener("click", async () => {
    await musique?.basculer();
    rafraichirIconeMusique();
    // On laisse le menu ouvert pour que l'utilisateur voit le changement d'état
  });
}