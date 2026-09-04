// Menu de jeu en haut à droite : musique, fiches des personnages et retour à la sélection d'épisodes.

function ligneFiche(titre, valeur) {
  if (!valeur) return "";
  const contenu = Array.isArray(valeur) ? valeur.join(" · ") : valeur;
  return `<p class="fiche-ligne"><span class="fiche-label">${titre}</span> ${contenu}</p>`;
}

function carteFiche(personnage) {
  return `
    <article class="fiche-personnage">
      ${personnage.sprite ? `<img class="fiche-portrait" src="${personnage.sprite}" alt="${personnage.name}">` : ""}
      <div class="fiche-corps">
        <h3>${personnage.name}${personnage.age ? ` · ${personnage.age} ans` : ""}</h3>
        ${personnage.tagline ? `<p class="fiche-tagline">« ${personnage.tagline} »</p>` : ""}
        ${ligneFiche("🎓 Filière", personnage.field)}
        ${ligneFiche("📏 Taille", personnage.height)}
        ${ligneFiche("✨ Caractère", personnage.personality)}
        ${ligneFiche("💖 Aime", personnage.likes)}
        ${ligneFiche("💔 N’aime pas", personnage.dislikes)}
        ${ligneFiche("🎨 Passion", personnage.passion)}
        ${ligneFiche("🎯 Objectif", personnage.goal)}
        ${ligneFiche("📍 Lieu préféré", personnage.favoritePlace)}
      </div>
    </article>
  `;
}

/**
 * @param {HTMLElement} scene - conteneur de l'écran de jeu.
 * @param {object} options - { musique, fiches, onRetourEpisodes, onRetourAccueil }
 */
export function installerMenuJeu(scene, { musique, fiches = [], onRetourEpisodes, onRetourAccueil } = {}) {
  const bouton = document.createElement("button");
  bouton.className = "bouton-menu";
  bouton.type = "button";
  bouton.innerHTML = "<span>🍎</span> Menu";
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

  panneau.append(optionMusique, optionPersonnages, optionEpisodes);

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
        <h2><span>🍎</span> Les Personnages</h2>
        <button class="fermer-personnages" type="button" aria-label="Fermer">×</button>
      </div>
      <div class="liste-fiches">
        ${fiches.length ? fiches.map(carteFiche).join("") : "<p>Aucune fiche disponible.</p>"}
      </div>
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
    voile.classList.add("visible");
    ouvrirMenu(false);
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
