// Écran de sélection d'épisode : accès rapide à un épisode donné, pratique pour développer/tester.
export function lancerEcranSelectionEpisode(conteneurRacine, { episodes, episodeActuel, onSelect }) {
  const ecran = document.createElement("div");
  ecran.className = "ecran-selection-episode";

  const fond = document.createElement("div");
  fond.className = "fond-accueil";
  ecran.appendChild(fond);

  const contenu = document.createElement("div");
  contenu.className = "contenu-selection-episode";

  const titre = document.createElement("h1");
  titre.className = "titre-selection-episode";
  titre.textContent = "Choisis un épisode";
  contenu.appendChild(titre);

  const sousTitre = document.createElement("p");
  sousTitre.className = "sous-titre-selection-episode";
  sousTitre.textContent = "Pratique pour tester rapidement un épisode en développement.";
  contenu.appendChild(sousTitre);

  const liste = document.createElement("div");
  liste.className = "liste-episodes";

  episodes.forEach(({ id, title }) => {
    const bouton = document.createElement("button");
    bouton.className = "carte-episode";
    if (id === episodeActuel) bouton.classList.add("actif");
    bouton.innerHTML = `<span class="numero-episode">Épisode ${id}</span><span class="titre-episode">${title}</span>`;
    bouton.addEventListener("click", () => onSelect(id));
    liste.appendChild(bouton);
  });

  contenu.appendChild(liste);
  ecran.appendChild(contenu);

  conteneurRacine.innerHTML = "";
  conteneurRacine.appendChild(ecran);
}
