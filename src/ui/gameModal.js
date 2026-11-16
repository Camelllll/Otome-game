function creerStructure({ titre, message, libelleConfirmation, libelleAnnulation, avertissement = false }) {
  const voile = document.createElement("div");
  voile.className = avertissement ? "voile-modale-jeu modale-avertissement" : "voile-modale-jeu";
  voile.innerHTML = `
    <section class="modale-jeu" role="dialog" aria-modal="true" aria-labelledby="titre-modale-jeu" aria-describedby="message-modale-jeu">
      <button class="fermer-modale-jeu" type="button" aria-label="Fermer">×</button>
      ${avertissement ? '<span class="icone-avertissement" aria-hidden="true">⚠</span>' : ""}
      <p class="surtitre-modale-jeu">Pomme d'Amour</p>
      <h2 id="titre-modale-jeu"></h2>
      <p id="message-modale-jeu" class="texte-modale-jeu"></p>
      <div class="contenu-modale-jeu"></div>
      <div class="actions-modale-jeu">
        ${libelleAnnulation ? '<button class="bouton-modale secondaire" type="button" data-action="annuler"></button>' : ""}
        <button class="bouton-modale principal" type="button" data-action="confirmer"></button>
      </div>
    </section>
  `;
  voile.querySelector("#titre-modale-jeu").textContent = titre;
  voile.querySelector("#message-modale-jeu").textContent = message;
  voile.querySelector('[data-action="confirmer"]').textContent = libelleConfirmation;
  if (libelleAnnulation) voile.querySelector('[data-action="annuler"]').textContent = libelleAnnulation;
  document.body.appendChild(voile);
  requestAnimationFrame(() => voile.classList.add("visible"));
  return voile;
}

function attendreReponse(voile, { valeurConfirmation = true, lireValeur, focusInitial } = {}) {
  return new Promise((resolve) => {
    let fermee = false;
    const fermer = (valeur) => {
      if (fermee) return;
      fermee = true;
      document.removeEventListener("keydown", gererClavier);
      voile.classList.remove("visible");
      voile.addEventListener("transitionend", () => voile.remove(), { once: true });
      setTimeout(() => voile.remove(), 250);
      focusInitial?.focus();
      resolve(valeur);
    };
    const confirmer = () => fermer(lireValeur ? lireValeur() : valeurConfirmation);
    const gererClavier = (event) => {
      if (event.key === "Escape") fermer(null);
      if (event.key === "Enter" && lireValeur && event.target?.classList?.contains("champ-modale-jeu")) {
        event.preventDefault();
        confirmer();
      }
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

export function demanderConfirmation({ titre, message, confirmer = "Continuer", annuler = "Annuler", avertissement = false }) {
  const focusInitial = document.activeElement;
  const voile = creerStructure({ titre, message, libelleConfirmation: confirmer, libelleAnnulation: annuler, avertissement });
  voile.querySelector(avertissement ? '[data-action="annuler"]' : '[data-action="confirmer"]').focus();
  return attendreReponse(voile, { focusInitial });
}

export function demanderTexte({ titre, message, valeur = "", placeholder = "", confirmer = "Valider" }) {
  const focusInitial = document.activeElement;
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
  return attendreReponse(voile, { lireValeur: () => champ.value.trim() || null, focusInitial });
}