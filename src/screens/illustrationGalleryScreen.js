function titreIllustration(illustration, index) {
  const nomFichier = decodeURIComponent(illustration.path.split("/").pop() || "");
  return nomFichier.replace(/\.[^.]+$/, "") || `Illustration ${index + 1}`;
}

function dateAcquisition(valeur) {
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function lancerEcranGalerie(conteneurRacine, { illustrations = [], onRetour }) {
  const ecran = document.createElement("div");
  ecran.className = "ecran-galerie";
  ecran.innerHTML = `
    <header class="header-galerie">
      <div class="identite-galerie">
        <img src="assets/logo/Logo Pomme d'Amour.png" alt="Pomme d'Amour">
        <div><p>Collection</p><h1>Mes illustrations</h1></div>
      </div>
      <button class="btn-retour-galerie" type="button">← Retour</button>
    </header>
    <main class="contenu-galerie">
      <p class="intro-galerie">Les moments précieux rencontrés au fil de tes choix.</p>
      <div class="grille-illustrations"></div>
    </main>
  `;

  const grille = ecran.querySelector(".grille-illustrations");
  if (!illustrations.length) {
    grille.innerHTML = `
      <div class="galerie-vide">
        <span aria-hidden="true">♡</span>
        <h2>Ta collection commence ici</h2>
        <p>Les illustrations apparaîtront après leur découverte dans l'histoire.</p>
      </div>
    `;
  } else {
    illustrations.forEach((illustration, index) => {
      const carte = document.createElement("article");
      carte.className = "carte-illustration";
      const image = document.createElement("img");
      image.src = illustration.path;
      image.alt = titreIllustration(illustration, index);
      image.loading = "lazy";
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", `Agrandir ${image.alt}`);
      const details = document.createElement("div");
      details.className = "details-illustration";
      const meta = document.createElement("p");
      meta.textContent = `Obtenue le ${dateAcquisition(illustration.acquiredAt)}`;
      details.appendChild(meta);
      carte.append(image, details);
      image.addEventListener("click", () => ouvrirIllustration(image.src, image.alt));
      image.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          ouvrirIllustration(image.src, image.alt);
        }
      });
      grille.appendChild(carte);
    });
  }

  function ouvrirIllustration(src, alt) {
    const voile = document.createElement("div");
    voile.className = "visionneuse-galerie";
    const fermerBouton = document.createElement("button");
    fermerBouton.type = "button";
    fermerBouton.setAttribute("aria-label", "Fermer");
    fermerBouton.textContent = "×";
    const image = document.createElement("img");
    image.src = src;
    image.alt = alt;
    voile.append(fermerBouton, image);
    const fermer = () => voile.remove();
    fermerBouton.addEventListener("click", fermer);
    voile.addEventListener("click", (event) => {
      if (event.target === voile) fermer();
    });
    ecran.appendChild(voile);
  }

  ecran.querySelector(".btn-retour-galerie").addEventListener("click", () => onRetour?.());
  conteneurRacine.replaceChildren(ecran);
}