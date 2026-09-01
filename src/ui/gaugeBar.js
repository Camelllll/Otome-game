// Composant d'interface : barre de jauge de relation (Amitié / Amour).
import { jaugeEnPourcentageAffichage } from "../engine/relationManager.js";

export function creerBarreDeJauge(nom, valeur) {
  const pourcentage = jaugeEnPourcentageAffichage(valeur);
  const conteneur = document.createElement("div");
  conteneur.className = "jauge";

  const etiquette = document.createElement("span");
  etiquette.className = "jauge-etiquette";
  etiquette.textContent = nom;

  const barre = document.createElement("div");
  barre.className = "jauge-barre";
  const remplissage = document.createElement("div");
  remplissage.className = "jauge-remplissage";
  remplissage.style.width = `${pourcentage}%`;
  barre.appendChild(remplissage);

  conteneur.appendChild(etiquette);
  conteneur.appendChild(barre);
  return conteneur;
}

// Barre de compatibilité horizontale affichée en haut à gauche.
export function afficherLovometre(conteneur, personnage) {
  conteneur.innerHTML = "";
  if (!personnage || !personnage.gauges) {
    conteneur.classList.remove("visible");
    return;
  }
  conteneur.classList.add("visible");

  const typeJauge = personnage.gauges.amour !== undefined ? "amour" : "amitie";
  const valeur = personnage.gauges[typeJauge] ?? 0;
  const pourcentage = jaugeEnPourcentageAffichage(valeur);

  const cadre = document.createElement("div");
  cadre.className = "lovometre-cadre";

  const coeurEmbleme = document.createElement("span");
  coeurEmbleme.className = "lovometre-embleme";
  coeurEmbleme.textContent = "♥";

  const nom = document.createElement("span");
  nom.className = "lovometre-nom";
  nom.textContent = personnage.name;

  const barre = document.createElement("div");
  barre.className = "lovometre-barre";
  const niveau = pourcentage < 25 ? "faible" : pourcentage < 50 ? "moyen" : pourcentage < 75 ? "eleve" : "fort";
  barre.classList.add(`niveau-${niveau}`);
  const remplissage = document.createElement("div");
  remplissage.className = "lovometre-remplissage";
  remplissage.style.width = `${pourcentage}%`;
  barre.appendChild(remplissage);

  const pourcentageTexte = document.createElement("span");
  pourcentageTexte.className = "lovometre-pourcentage";
  // Fond clair à faible niveau, fond rose à fort niveau : la couleur conserve toujours un contraste suffisant.
  pourcentageTexte.classList.toggle("sur-remplissage", pourcentage >= 55);
  pourcentageTexte.textContent = `${pourcentage}%`;
  barre.appendChild(pourcentageTexte);

  cadre.append(coeurEmbleme, nom, barre);
  conteneur.appendChild(cadre);
}

// Effet visuel déclenché seulement après un gain réel de relation : les cœurs rejoignent la jauge.
export function animerGainLovo(scene, gain) {
  const envol = document.createElement("div");
  envol.className = "coeurs-gain";
  const nombreCoeurs = Math.min(5, Math.max(2, Math.ceil(gain / 3)));
  for (let index = 0; index < nombreCoeurs; index += 1) {
    const coeur = document.createElement("span");
    coeur.className = "coeur-gain";
    coeur.textContent = "♥";
    coeur.style.setProperty("--delai", `${index * 80}ms`);
    coeur.style.setProperty("--decalage", `${(index - (nombreCoeurs - 1) / 2) * 24}px`);
    envol.appendChild(coeur);
  }
  scene.appendChild(envol);
  window.setTimeout(() => envol.remove(), 2100 + nombreCoeurs * 130);
}

// Pour une réponse négative, les cœurs s'échappent de la jauge puis se fragmentent.
export function animerPerteLovo(scene, perte) {
  const envol = document.createElement("div");
  envol.className = "coeurs-perte";
  const nombreCoeurs = Math.min(5, Math.max(2, Math.ceil(Math.abs(perte) / 3)));
  for (let index = 0; index < nombreCoeurs; index += 1) {
    const coeur = document.createElement("span");
    coeur.className = "coeur-perte";
    coeur.textContent = "♥";
    coeur.style.setProperty("--delai", `${index * 120}ms`);
    coeur.style.setProperty("--decalage", `${index * 29}px`);
    envol.appendChild(coeur);

    const eclat = document.createElement("span");
    eclat.className = "eclat-coeur";
    eclat.textContent = "✦";
    eclat.style.setProperty("--delai", `${520 + index * 120}ms`);
    eclat.style.setProperty("--decalage", `${index * 29}px`);
    envol.appendChild(eclat);
  }
  scene.appendChild(envol);
  window.setTimeout(() => envol.remove(), 2100 + nombreCoeurs * 120);
}
