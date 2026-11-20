export function creer(balise, classe, texte) {
  const element = document.createElement(balise);
  if (classe) element.className = classe;
  if (texte !== undefined) element.textContent = texte;
  return element;
}

export function icone(nom) {
  const chemins = {
    coeur: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    verrou: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
    jouer: '<path d="m8 4 12 8-12 8Z"/>',
    compte: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/>',
    rencontres: '<circle cx="12" cy="7" r="3.5"/><path d="M5 22v-3a7 7 0 0 1 14 0v3M5 4a3 3 0 0 0 0 6m14-6a3 3 0 0 1 0 6M2 20v-3a5 5 0 0 1 3-4m17 7v-3a5 5 0 0 0-3-4"/>',
    livre: '<path d="M12 5v16M12 5C8 2 4 3 2 4v15c4-2 7-1 10 2 3-3 6-4 10-2V4c-2-1-6-2-10 1Z"/>',
    robe: '<path d="m8 3 4 3 4-3 2 4-4 4 6 10H4l6-10-4-4Z"/>',
    fleche: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    etoile: '<path d="m12 2 3.2 6.8L22 12l-6.8 3.2L12 22l-3.2-6.8L2 12l6.8-3.2Z"/>',
    manette: '<path d="M7 6h10c2 0 3 2 3.5 4l1.5 7c.5 2-2 3-3.5 1L16 15H8l-2.5 3c-1.5 2-4 1-3.5-1l1.5-7C4 8 5 6 7 6ZM6 10v4m-2-2h4m7-1h.1m3 2h.1M9 6l1-2h4l1 2"/>',
    inscription: '<circle cx="10" cy="7" r="4"/><path d="M2 21v-2a8 8 0 0 1 11-7m5 2v8m-4-4h8"/>',
    oeil: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    "oeil-barre": '<path d="m3 3 18 18M10.5 5.1 12 5c6 0 10 7 10 7a21 21 0 0 1-3 3.5M6 6.5A25 25 0 0 0 2 12s4 7 10 7a12 12 0 0 0 5-1.1M10 10a3 3 0 0 0 4 4"/>',
  };
  const element = creer("span", `entree-icone entree-icone-${nom}`);
  element.setAttribute("aria-hidden", "true");
  element.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${chemins[nom] || chemins.coeur}</svg>`;
  return element;
}

export function creerImage(src, classe, alt = "", prioritaire = false) {
  const image = creer("img", classe);
  image.alt = alt;
  image.decoding = "async";
  image.loading = prioritaire ? "eager" : "lazy";
  if (prioritaire) image.fetchPriority = "high";
  image.draggable = false;
  image.addEventListener("error", () => {
    console.warn("Asset de l'accueil indisponible :", src);
    image.hidden = true;
    if (alt) {
      image.parentElement?.append(creer("span", "entree-asset-absent", `Visuel indisponible · ${alt}`));
    }
  }, { once: true });
  image.src = src;
  return image;
}

export function creerBouton(texte, action, { secondaire = false, pictogramme } = {}) {
  const bouton = creer("button", `entree-bouton ${secondaire ? "entree-bouton-secondaire" : "entree-bouton-primaire"}`);
  bouton.type = "button";
  if (pictogramme) bouton.append(icone(pictogramme));
  bouton.append(creer("span", "", texte));
  if (action) bouton.addEventListener("click", action);
  return bouton;
}

export function creerEntete(numero, titre, texte) {
  const entete = creer("header", "entree-entete");
  entete.append(creer("p", "entree-surtitre", numero), creer("h2", "", titre));
  const ornement = creer("div", "entree-ornement");
  ornement.setAttribute("aria-hidden", "true");
  ornement.append(icone("coeur"));
  entete.append(ornement);
  if (texte) entete.append(creer("p", "entree-intro", texte));
  return entete;
}

export function creerRubanGlacage(classe, identifiant) {
  const ruban = creer("div", classe);
  ruban.setAttribute("aria-hidden", "true");
  ruban.innerHTML = `<svg viewBox="0 0 1440 220" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${identifiant}" x1="0" y1="45" x2="0" y2="185" gradientUnits="userSpaceOnUse">
        <stop stop-color="#6b0419"/><stop offset=".25" stop-color="#d92640"/>
        <stop offset=".4" stop-color="#f78d96"/><stop offset=".51" stop-color="#bb102c"/>
        <stop offset=".8" stop-color="#8c041d"/><stop offset="1" stop-color="#4f0314"/>
      </linearGradient>
    </defs>
    <path d="M-30 100C210 185 380 20 660 96S1110 200 1470 80L1470 112C1110 225 930 195 650 127S210 212-30 129Z"
      fill="url(#${identifiant})" stroke="#d2516570"/>
    <path d="M-30 102C210 187 380 22 660 98S1110 202 1470 82" stroke="#ffc2be" stroke-opacity=".65" stroke-width="1.5"/>
    <path d="M-30 123C210 206 380 42 653 120S1110 218 1470 105" stroke="#690217" stroke-opacity=".6" stroke-width="2"/>
  </svg>`;
  return ruban;
}

export function creerTransitionConcept() {
  const transition = creer("div", "entree-transition");
  transition.setAttribute("aria-hidden", "true");
  transition.innerHTML = `<svg class="entree-transition-ruban" viewBox="0 0 1520 150" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="entree-vague-creme" x1="0" y1="20" x2="0" y2="150" gradientUnits="userSpaceOnUse">
        <stop stop-color="#e8a5a5"/><stop offset=".35" stop-color="#f8ddd2"/><stop offset="1" stop-color="#fff0e4"/>
      </linearGradient>
    </defs>
    <path d="M0 0H1520V150H0Z" fill="#4b0615"/>
    <path d="M0 65C200-45 365 160 610 85S1050-10 1290 35 1460 65 1520 45V150H0Z" fill="url(#entree-vague-creme)"/>
    <path d="M0 55C200-55 365 150 610 75S1050-20 1290 25 1460 55 1520 35" stroke="#e8a5a5" stroke-opacity=".5" stroke-width="2"/>
    <path d="M0 65C200-45 365 160 610 85S1050-10 1290 35 1460 65 1520 45" stroke="#c51f3a" stroke-opacity=".45" stroke-width="1.5"/>
  </svg>`;
  return transition;
}

export function creerCartePersonnage(personnage, action) {
  const carte = creer("article", "entree-personnage");
  const portrait = creer("div", "entree-portrait");
  portrait.append(creerImage(personnage.spritePreview || personnage.sprite, "", personnage.name));
  const sceau = creer("span", "entree-personnage-coeur");
  sceau.setAttribute("aria-hidden", "true");
  sceau.append(icone("coeur"));
  const contenu = creer("div", "entree-personnage-texte");
  const bouton = creerBouton("Découvrir son histoire", action, { secondaire: true });
  bouton.append(icone("fleche"));
  bouton.setAttribute("aria-label", `Découvrir l'histoire de ${personnage.name}`);
  contenu.append(
    creer("h3", "", personnage.name),
    creer("p", "", personnage.tagline || "Une rencontre à découvrir sur le campus."),
    bouton,
  );
  carte.append(portrait, contenu, sceau);
  return carte;
}

export function creerCarteVerrouillee(sprite) {
  const carte = creer("article", "entree-personnage entree-personnage-verrouille");
  const portrait = creer("div", "entree-portrait");
  if (sprite) portrait.append(creerImage(sprite, ""));
  portrait.append(icone("verrou"));
  const contenu = creer("div", "entree-personnage-texte");
  contenu.append(
    creer("h3", "", "???"),
    creer("p", "", "Certaines rencontres se font attendre…"),
    creer("span", "entree-secret", "À découvrir en jouant"),
  );
  carte.append(portrait, contenu);
  return carte;
}

export function creerCadreIllustration({ src, titre, verrouille = false, action }) {
  const cadre = creer("button", `entree-souvenir${verrouille ? " entree-souvenir-verrouille" : ""}`);
  cadre.type = "button";
  cadre.setAttribute("aria-label", verrouille ? "Souvenir à débloquer dans le jeu" : `Aperçu : ${titre}`);
  // Les cadres verrouillés utilisent un décor, jamais une CG non débloquée.
  cadre.append(creerImage(src, "", ""));
  if (verrouille) cadre.append(icone("verrou"));
  cadre.append(creer("span", "entree-souvenir-legende", verrouille ? "Un souvenir t'attend" : titre));
  cadre.addEventListener("click", action);
  return cadre;
}
