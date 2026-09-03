// Écran de sélection d'épisode : les épisodes terminés sont marqués, les suivants se débloquent progressivement.
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
  sousTitre.textContent = "Termine un épisode pour débloquer le suivant.";
  contenu.appendChild(sousTitre);

  const liste = document.createElement("div");
  liste.className = "liste-episodes";

  episodes.forEach(({ id, title, complete, verrouille }) => {
    const bouton = document.createElement("button");
    bouton.className = "carte-episode";
    if (id === episodeActuel) bouton.classList.add("actif");
    if (complete) bouton.classList.add("termine");
    if (verrouille) bouton.classList.add("verrouille");
    bouton.disabled = Boolean(verrouille);
    const numero = id.match(/^episode(\d+)$/)?.[1] || id;
    const badge = complete ? " ✅" : verrouille ? " 🔒" : "";
    bouton.innerHTML = `<span class="numero-episode">Épisode ${numero}${badge}</span><span class="titre-episode">${title}</span>`;
    if (!verrouille) bouton.addEventListener("click", () => onSelect(id));
    liste.appendChild(bouton);
  });

  contenu.appendChild(liste);
  ecran.appendChild(contenu);

  conteneurRacine.innerHTML = "";
  conteneurRacine.appendChild(ecran);
}
