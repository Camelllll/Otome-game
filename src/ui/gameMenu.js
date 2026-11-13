// Menu de jeu en haut à droite : personnages, dressing, épisodes, retour accueil, musique.
import { creerCarnet } from "./carnetRelations.js";

/**
 * @param {HTMLElement} scene - conteneur de l'écran de jeu.
 * @param {object} options - { musique, fiches, getInfosPersonnage, getSauvegarde, onRetourEpisodes, onRetourAccueil, onDressing }
 */
export function installerMenuJeu(scene, { musique, fiches = [], getInfosPersonnage, getSauvegarde, onRetourEpisodes, onRetourAccueil, onDressing } = {}) {

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
  panneau.setAttribute("role", "menu");

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
    "Les personnages"
  );

  const optionDressing = creerOption(
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H7v10c0 1.1.9 2 2 2h6a2 2 0 0 0 2-2V10h3.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>`,
    "Mon dressing",
    !onDressing
  );

  const optionEpisodes = creerOption(
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    "Journal des épisodes",
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
    optionEpisodes,
  );

  if (onRetourAccueil) {
    const optionAccueil = creerOption(
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
      "Retour à l'accueil"
    );
    optionAccueil.addEventListener("click", () => {
      ouvrirMenu(false);
      onRetourAccueil();
    });
    panneau.appendChild(optionAccueil);
  }

  // Section Paramètres (musique)
  panneau.append(
    creerSeparateur(),
    creerSectionTitre("Paramètres"),
    optionMusique,
  );

  // ── Carnet de relations ────────────────────────────────────────────
  const carnet = creerCarnet({ fiches, getInfosPersonnage, getSauvegarde });

  scene.append(bouton, panneau, carnet.element);

  // Synchroniser l'état initial de l'icône musique dans le panneau
  rafraichirIconeMusique();

  // ── Ouverture / fermeture ──────────────────────────────────────────
  function ouvrirMenu(ouvert) {
    panneau.classList.toggle("visible", ouvert);
    bouton.setAttribute("aria-expanded", String(ouvert));
    bouton.classList.toggle("actif", ouvert);
  }

  bouton.addEventListener("click", (event) => {
    event.stopPropagation();
    ouvrirMenu(!panneau.classList.contains("visible"));
  });

  scene.addEventListener("pointerdown", (event) => {
    if (!panneau.contains(event.target) && event.target !== bouton) ouvrirMenu(false);
  });

  // ── Actions des options ────────────────────────────────────────────
  optionPersonnages.addEventListener("click", () => {
    ouvrirMenu(false);
    carnet.ouvrir();
  });

  optionDressing.addEventListener("click", () => {
    ouvrirMenu(false);
    onDressing?.();
  });

  optionEpisodes.addEventListener("click", () => {
    ouvrirMenu(false);
    onRetourEpisodes?.();
  });

  optionMusique.addEventListener("click", async () => {
    await musique?.basculer();
    rafraichirIconeMusique();
    // On laisse le menu ouvert pour que l'utilisateur voit le changement d'état
  });
}