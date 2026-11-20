// Composant d'interface : barre de jauge de relation (Amitié / Amour).
import { jaugeEnPourcentageAffichage, jaugeEnPourcentageRemplissage } from "../engine/relationManager.js";

export function creerBarreDeJauge(nom, valeur) {
  const remplissageVisible = jaugeEnPourcentageRemplissage(valeur);
  const conteneur = document.createElement("div");
  conteneur.className = "jauge";

  const etiquette = document.createElement("span");
  etiquette.className = "jauge-etiquette";
  etiquette.textContent = nom;

  const barre = document.createElement("div");
  barre.className = "jauge-barre";
  const remplissage = document.createElement("div");
  remplissage.className = "jauge-remplissage";
  remplissage.style.width = `${remplissageVisible}%`;
  barre.appendChild(remplissage);

  conteneur.appendChild(etiquette);
  conteneur.appendChild(barre);
  return conteneur;
}

const huds = new WeakMap();
const COEUR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path class="lovo-coeur-forme" d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
const COEUR_BRISE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path class="lovo-demi-gauche" d="M11.5 5.5C5-2-3 6 3.5 12.5L11.5 21l-1-6 2-3-3-3Z"/><path class="lovo-demi-droite" d="M13 5.5C19-2 27 6 20.5 12.5L13 21l-1-6 2-3-3-3Z"/></svg>';

function iconeCoeur(classe, brise = false) {
  const icone = document.createElement("span");
  icone.className = classe;
  icone.innerHTML = brise ? COEUR_BRISE_SVG : COEUR_SVG;
  return icone;
}

function creerHud(conteneur, personnage, typeJauge) {
  conteneur.innerHTML = "";
  const cadre = document.createElement("div");
  cadre.className = "lovometre-cadre";

  const portrait = document.createElement("div");
  portrait.className = "lovometre-portrait";
  portrait.setAttribute("aria-hidden", "true");
  const initiale = document.createElement("span");
  initiale.textContent = personnage.name?.trim().charAt(0).toUpperCase() || "?";
  portrait.appendChild(initiale);
  const source = personnage.portraits?.default || personnage.sprite;
  if (source) {
    const image = document.createElement("img");
    image.alt = "";
    image.addEventListener("load", () => {
      initiale.hidden = true;
      image.classList.toggle("portrait-recadrage", image.naturalHeight >= image.naturalWidth * 1.6);
    }, { once: true });
    image.addEventListener("error", () => {
      console.warn("Portrait du lovomètre inaccessible :", source);
      image.remove();
    }, { once: true });
    portrait.appendChild(image);
    image.src = source;
  }

  const identite = document.createElement("div");
  identite.className = "lovometre-identite";
  const nom = document.createElement("span");
  nom.className = "lovometre-nom";
  nom.textContent = personnage.name;
  nom.title = personnage.name;

  const pourcentage = document.createElement("span");
  pourcentage.className = "lovometre-pourcentage";
  pourcentage.setAttribute("aria-hidden", "true");

  const entete = document.createElement("div");
  entete.className = "lovometre-entete";
  const coeur = iconeCoeur("lovometre-coeur");
  coeur.setAttribute("aria-hidden", "true");

  const barre = document.createElement("div");
  barre.className = "lovometre-barre";
  barre.setAttribute("role", "meter");
  barre.setAttribute("aria-label", `${typeJauge === "amour" ? "Amour" : "Amitié"} avec ${personnage.name}`);
  barre.setAttribute("aria-valuemin", "-100");
  barre.setAttribute("aria-valuemax", "100");
  const remplissage = document.createElement("div");
  remplissage.className = "lovometre-remplissage";
  const piste = document.createElement("div");
  piste.className = "lovometre-piste";
  piste.appendChild(remplissage);
  barre.appendChild(piste);
  entete.append(coeur, nom, pourcentage);

  identite.append(entete, barre);
  cadre.append(portrait, identite);
  conteneur.appendChild(cadre);
  return {
    id: personnage.id || personnage.name, name: personnage.name, source, typeJauge,
    pourcentage, barre, coeur,
  };
}

// Conserver les nœuds entre les répliques permet de réellement animer les variations.
export function afficherLovometre(conteneur, personnage) {
  if (!personnage || !personnage.gauges) {
    conteneur.innerHTML = "";
    huds.delete(conteneur);
    conteneur.classList.remove("visible");
    return;
  }
  conteneur.classList.add("visible");

  const typeJauge = personnage.gauges.amour !== undefined ? "amour" : "amitie";
  const valeur = personnage.gauges[typeJauge] ?? 0;
  const pourcentage = jaugeEnPourcentageAffichage(valeur);
  const remplissage = jaugeEnPourcentageRemplissage(valeur);
  let hud = huds.get(conteneur);
  if (!hud || hud.id !== (personnage.id || personnage.name) || hud.typeJauge !== typeJauge
      || hud.name !== personnage.name || hud.source !== (personnage.portraits?.default || personnage.sprite)) {
    hud = creerHud(conteneur, personnage, typeJauge);
    huds.set(conteneur, hud);
  }
  hud.pourcentage.textContent = `${pourcentage} %`;
  hud.barre.setAttribute("aria-valuenow", String(pourcentage));
  hud.barre.setAttribute("aria-valuetext", `${pourcentage} %`);
  hud.barre.style.setProperty("--lovo-position", `${remplissage}%`);
}

function animerCoeurs(scene, variation, perte) {
  if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const conteneur = scene.querySelector(".lovometre.visible");
  const hud = conteneur && huds.get(conteneur);
  if (!hud) return;
  const rectHud = conteneur.getBoundingClientRect();
  const rectCible = hud.coeur.getBoundingClientRect();
  const envol = document.createElement("div");
  envol.className = `lovo-particules ${perte ? "perte" : "gain"}`;
  envol.setAttribute("aria-hidden", "true");
  envol.style.setProperty("--cible-x", `${rectCible.left + rectCible.width / 2 - rectHud.left}px`);
  envol.style.setProperty("--cible-y", `${rectCible.top + rectCible.height / 2 - rectHud.top}px`);
  const nombreCoeurs = Math.min(3, Math.max(1, Math.ceil(Math.abs(variation) / 5)));
  for (let index = 0; index < nombreCoeurs; index += 1) {
    const coeur = iconeCoeur("lovo-particule", perte);
    coeur.style.setProperty("--delai", `${index * 140}ms`);
    coeur.style.setProperty("--decalage", `${(index - (nombreCoeurs - 1) / 2) * 16}px`);
    envol.appendChild(coeur);
  }
  const nettoyer = (event) => {
    if (event.target === envol.lastElementChild) envol.remove();
  };
  envol.addEventListener("animationend", nettoyer);
  envol.addEventListener("animationcancel", nettoyer);
  conteneur.appendChild(envol);
}

export function animerGainLovo(scene, gain) {
  animerCoeurs(scene, gain, false);
}

export function animerPerteLovo(scene, perte) {
  animerCoeurs(scene, perte, true);
}
