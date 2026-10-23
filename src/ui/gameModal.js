function creerStructure({ titre, message, libelleConfirmation, libelleAnnulation }) {
  const voile = document.createElement("div");
  voile.className = "voile-modale-jeu";
  voile.innerHTML = `
    <section class="modale-jeu" role="dialog" aria-modal="true" aria-labelledby="titre-modale-jeu">
      <button class="fermer-modale-jeu" type="button" aria-label="Fermer">×</button>
      <p class="surtitre-modale-jeu">Pomme d'Amour</p>
      <h2 id="titre-modale-jeu">${titre}</h2>
      <p class="texte-modale-jeu">${message}</p>
      <div class="contenu-modale-jeu"></div>
      <div class="actions-modale-jeu">
        ${libelleAnnulation ? `<button class="bouton-modale secondaire" type="button" data-action="annuler">${libelleAnnulation}</button>` : ""}
        <button class="bouton-modale principal" type="button" data-action="confirmer">${libelleConfirmation}</button>
      </div>
    </section>
  `;
  document.body.appendChild(voile);
  requestAnimationFrame(() => voile.classList.add("visible"));
  return voile;
}

function attendreReponse(voile, { valeurConfirmation = true, lireValeur } = {}) {
  return new Promise((resolve) => {
    const fermer = (valeur) => {
      document.removeEventListener("keydown", gererClavier);
      voile.classList.remove("visible");
      voile.addEventListener("transitionend", () => voile.remove(), { once: true });
      setTimeout(() => voile.remove(), 250);
      resolve(valeur);
    };
    const confirmer = () => fermer(lireValeur ? lireValeur() : valeurConfirmation);
    const gererClavier = (event) => {
      if (event.key === "Escape") fermer(null);
      if (event.key === "Enter") confirmer();
    };

    voile.querySelector('[data-action="confirmer"]').addEventListener("click", confirmer);
    voile.querySelector('[data-action="annuler"]')?.addEventListener("click", () => fermer(null));
    voile.querySelector(".fermer-modale-jeu").addEventListener("click", () => fermer(null));
    voile.addEventListener("click", (event) => {
      if (event.target === voile) fermer(null);
    });
    document.addEventListener("keydown", gererClavier);
  });
}

export function demanderConfirmation({ titre, message, confirmer = "Continuer", annuler = "Annuler" }) {
  const voile = creerStructure({ titre, message, libelleConfirmation: confirmer, libelleAnnulation: annuler });
  voile.querySelector('[data-action="confirmer"]').focus();
  return attendreReponse(voile);
}

export function demanderTexte({ titre, message, valeur = "", placeholder = "", confirmer = "Valider" }) {
  const voile = creerStructure({ titre, message, libelleConfirmation: confirmer, libelleAnnulation: "Plus tard" });
  const contenu = voile.querySelector(".contenu-modale-jeu");
  const champ = document.createElement("input");
  champ.className = "champ-modale-jeu";
  champ.type = "text";
  champ.value = valeur;
  champ.placeholder = placeholder;
  champ.maxLength = 40;
  champ.setAttribute("aria-label", titre);
  contenu.appendChild(champ);
  champ.focus();
  champ.select();
  return attendreReponse(voile, { lireValeur: () => champ.value.trim() || null });
}