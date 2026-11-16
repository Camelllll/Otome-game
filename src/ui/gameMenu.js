// Menu partagé entre les épisodes, le dialogue et le dressing.
import { creerCarnet } from "./carnetRelations.js";
import { demanderConfirmation } from "./gameModal.js";

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

  // ── Carnet de relations ────────────────────────────────────────────
  const carnet = creerCarnet({ fiches, getInfosPersonnage, getSauvegarde });

  scene.append(bouton, panneau);
  surface.append(carnet.element);

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

  surface.addEventListener("pointerdown", (event) => {
    if (!panneau.contains(event.target) && !bouton.contains(event.target)) ouvrirMenu(false);
  });

  // ── Actions des options ────────────────────────────────────────────
  optionPersonnages.addEventListener("click", () => {
    ouvrirMenu(false);
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