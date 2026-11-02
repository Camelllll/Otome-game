// Menu de jeu en haut à droite : musique, fiches des personnages et retour à la sélection d'épisodes.
import { jaugeEnPourcentageAffichage } from "../engine/relationManager.js";

function ligneFiche(titre, valeur) {
  if (!valeur) return "";
  const contenu = Array.isArray(valeur) ? valeur.join(" · ") : valeur;
  return `<p class="fiche-ligne"><span class="fiche-label">${titre}</span> ${contenu}</p>`;
}

function barreRelation(nom, valeur) {
  const pourcentage = jaugeEnPourcentageAffichage(valeur);
  const remplissage = Math.max(0, pourcentage);
  return `
    <div class="fiche-jauge fiche-jauge-${nom}">
      <div class="fiche-jauge-entete">
        <span>Amour</span>
        <strong>${pourcentage}%</strong>
      </div>
      <div class="fiche-jauge-barre" aria-hidden="true">
        <span style="width: ${remplissage}%"></span>
      </div>
    </div>
  `;
}

function carteFiche(personnage, getInfosPersonnage) {
  const infos = getInfosPersonnage?.(personnage.id) || {};
  const jauges = infos.gauges || personnage.gauges || {};
  return `
    <article class="fiche-personnage">
      <div class="fiche-visuel">
        ${personnage.sprite ? `<img class="fiche-portrait" src="${personnage.sprite}" alt="${personnage.name}">` : ""}
      </div>
      <div class="fiche-corps">
        <div class="fiche-identite">
          <p class="fiche-role">${personnage.field || "Campus"}</p>
          <h3>${personnage.name}${personnage.age ? ` · ${personnage.age} ans` : ""}</h3>
          ${personnage.tagline ? `<p class="fiche-tagline">« ${personnage.tagline} »</p>` : ""}
        </div>
        <div class="fiche-jauges" aria-label="Lovomètres de ${personnage.name}">
          ${barreRelation("amour", jauges.amour)}
        </div>
        <div class="fiche-details">
          ${ligneFiche("Taille", personnage.height)}
          ${ligneFiche("Caractère", personnage.personality)}
          ${ligneFiche("Aime", personnage.likes)}
          ${ligneFiche("N'aime pas", personnage.dislikes)}
          ${ligneFiche("Passion", personnage.passion)}
          ${ligneFiche("Objectif", personnage.goal)}
          ${ligneFiche("Défaut", personnage.flaw)}
          ${ligneFiche("Lieu préféré", personnage.favoritePlace)}
          ${ligneFiche("Thème de sa route", personnage.routeTheme)}
        </div>
      </div>
    </article>
  `;
}

/**
 * @param {HTMLElement} scene - conteneur de l'écran de jeu.
 * @param {object} options - { musique, fiches, getInfosPersonnage, onRetourEpisodes, onRetourAccueil, onIllustrations, onDressing }
 */
export function installerMenuJeu(scene, { musique, fiches = [], getInfosPersonnage, onRetourEpisodes, onRetourAccueil, onIllustrations, onDressing } = {}) {
  const bouton = document.createElement("button");
  bouton.className = "bouton-menu";
  bouton.type = "button";
  bouton.innerHTML = "Menu";
  bouton.setAttribute("aria-haspopup", "true");
  bouton.setAttribute("aria-expanded", "false");

  const panneau = document.createElement("div");
  panneau.className = "panneau-menu";
  panneau.setAttribute("role", "menu");

  const optionMusique = document.createElement("button");
  optionMusique.className = "option-menu";
  optionMusique.type = "button";

  const optionPersonnages = document.createElement("button");
  optionPersonnages.className = "option-menu";
  optionPersonnages.type = "button";
  optionPersonnages.innerHTML = "<span>👥</span> Les personnages";

  const optionEpisodes = document.createElement("button");
  optionEpisodes.className = "option-menu";
  optionEpisodes.type = "button";
  optionEpisodes.innerHTML = "<span>📖</span> Journal des épisodes";
  optionEpisodes.disabled = !onRetourEpisodes;

  const optionIllustrations = document.createElement("button");
  optionIllustrations.className = "option-menu";
  optionIllustrations.type = "button";
  optionIllustrations.innerHTML = "<span>▣</span> Mes illustrations";
  optionIllustrations.disabled = !onIllustrations;

  const optionDressing = document.createElement("button");
  optionDressing.className = "option-menu";
  optionDressing.type = "button";
  optionDressing.innerHTML = "<span>👗</span> Mon dressing";
  optionDressing.disabled = !onDressing;

  panneau.append(optionMusique, optionPersonnages, optionDressing, optionIllustrations, optionEpisodes);

  if (onRetourAccueil) {
    const optionAccueil = document.createElement("button");
    optionAccueil.className = "option-menu";
    optionAccueil.type = "button";
    optionAccueil.innerHTML = "<span>🏠</span> Retour à l'accueil";
    optionAccueil.addEventListener("click", () => {
      ouvrirMenu(false);
      onRetourAccueil();
    });
    panneau.appendChild(optionAccueil);
  }

  const voile = document.createElement("div");
  voile.className = "voile-personnages";
  voile.innerHTML = `
    <div class="fenetre-personnages" role="dialog" aria-label="Présentation des personnages">
      <div class="fenetre-personnages-head">
        <div>
          <p class="fenetre-personnages-surtitre">Carnet de relations</p>
          <h2>Les personnages</h2>
        </div>
        <button class="fermer-personnages" type="button" aria-label="Fermer">×</button>
      </div>
      <div class="liste-fiches"></div>
    </div>
  `;

  scene.append(bouton, panneau, voile);

  function afficherEtatMusique() {
    optionMusique.innerHTML = musique?.active ? "<span>🎵</span> Musique : Activée" : "<span>🔇</span> Musique : Coupée";
    optionMusique.classList.toggle("muet", !musique?.active);
  }
  afficherEtatMusique();

  function ouvrirMenu(ouvert) {
    panneau.classList.toggle("visible", ouvert);
    bouton.setAttribute("aria-expanded", String(ouvert));
  }

  function rendreFiches() {
    const liste = voile.querySelector(".liste-fiches");
    liste.innerHTML = fiches.length
      ? fiches.map((personnage) => carteFiche(personnage, getInfosPersonnage)).join("")
      : "<p class=\"fiche-vide\">Aucune fiche disponible.</p>";
  }

  bouton.addEventListener("click", (event) => {
    event.stopPropagation();
    ouvrirMenu(!panneau.classList.contains("visible"));
  });

  // Un clic ailleurs dans la scène referme le menu sans faire avancer le dialogue.
  scene.addEventListener("pointerdown", (event) => {
    if (!panneau.contains(event.target) && event.target !== bouton) ouvrirMenu(false);
  });

  optionMusique.addEventListener("click", async () => {
    await musique?.basculer();
    afficherEtatMusique();
  });

  optionPersonnages.addEventListener("click", () => {
    rendreFiches();
    voile.classList.add("visible");
    ouvrirMenu(false);
  });

  optionIllustrations.addEventListener("click", () => {
    ouvrirMenu(false);
    onIllustrations?.();
  });

  optionDressing.addEventListener("click", () => {
    ouvrirMenu(false);
    onDressing?.();
  });

  voile.querySelector(".fermer-personnages").addEventListener("click", () => voile.classList.remove("visible"));
  voile.addEventListener("click", (event) => {
    if (event.target === voile) voile.classList.remove("visible");
  });

  optionEpisodes.addEventListener("click", () => {
    ouvrirMenu(false);
    onRetourEpisodes?.();
  });
}
