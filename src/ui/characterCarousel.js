import { creer, icone, creerImage, creerCartePersonnage, creerRubanGlacage } from "./landingComponents.js";

export function creerCarrouselPersonnages(action) {
  const bloc = creer("div", "entree-carousel");
  bloc.setAttribute("role", "region");
  bloc.setAttribute("aria-roledescription", "carrousel");
  bloc.setAttribute("aria-label", "Les personnages d'Aster");
  const piste = creer("div", "entree-personnages");
  piste.id = "entree-casting-piste";
  piste.tabIndex = 0;
  piste.hidden = true;
  piste.setAttribute("aria-label", "Galerie des personnages. Flèches gauche et droite pour défiler.");
  const precedent = fleche("précédents", -1);
  const suivant = fleche("suivants", 1);
  const reperes = creer("div", "entree-carousel-reperes");
  reperes.setAttribute("aria-label", "Positions de la galerie");
  const annonce = creer("p", "entree-carousel-annonce");
  annonce.setAttribute("aria-live", "polite");
  annonce.setAttribute("aria-atomic", "true");
  bloc.append(precedent, piste, suivant, reperes, annonce);
  let cartes = [];

  function fleche(libelle, direction) {
    const bouton = creer("button", `entree-carousel-fleche entree-carousel-fleche-${direction < 0 ? "precedente" : "suivante"}`);
    bouton.type = "button";
    bouton.hidden = true;
    bouton.setAttribute("aria-label", `Personnages ${libelle}`);
    bouton.setAttribute("aria-controls", piste.id);
    bouton.append(icone("fleche"));
    bouton.addEventListener("click", () => {
      const { pas } = mesurer();
      defiler(Math.round(piste.scrollLeft / pas) + direction);
    });
    return bouton;
  }

  function mesurer() {
    const pas = cartes.length > 1
      ? cartes[1].getBoundingClientRect().left - cartes[0].getBoundingClientRect().left
      : cartes[0]?.getBoundingClientRect().width || 0;
    const max = Math.max(0, piste.scrollWidth - piste.clientWidth);
    return { pas, max };
  }

  function defiler(index) {
    const { pas, max } = mesurer();
    piste.scrollTo({
      left: Math.max(0, Math.min(max, index * pas)),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }

  function actualiser() {
    const { pas, max } = mesurer();
    const nombre = pas > 0 ? Math.round(max / pas) + 1 : 0;
    precedent.hidden = suivant.hidden = max <= 1;
    precedent.disabled = piste.scrollLeft <= 1;
    suivant.disabled = piste.scrollLeft >= max - 1;
    if (reperes.children.length !== nombre) {
      reperes.replaceChildren();
      for (let index = 0; index < nombre; index++) {
        const bouton = creer("button", "entree-carousel-repere");
        bouton.type = "button";
        bouton.setAttribute("aria-label", `Voir les personnages à partir de ${cartes[index].dataset.nom}`);
        bouton.setAttribute("aria-controls", piste.id);
        bouton.addEventListener("click", () => defiler(index));
        reperes.append(bouton);
      }
    }
    const active = pas > 0 ? Math.min(nombre - 1, Math.round(piste.scrollLeft / pas)) : 0;
    [...reperes.children].forEach((bouton, index) => {
      if (index === active) bouton.setAttribute("aria-current", "step");
      else bouton.removeAttribute("aria-current");
    });
    if (nombre > 0) {
      const visibles = Math.max(1, Math.round(piste.clientWidth / pas));
      const texte = `Personnages ${active + 1} à ${Math.min(cartes.length, active + visibles)} sur ${cartes.length}`;
      if (annonce.textContent !== texte) annonce.textContent = texte;
    }
  }
  piste.addEventListener("scroll", actualiser, { passive: true });
  piste.addEventListener("keydown", (event) => {
    if (event.target !== piste) return;
    const index = Math.round(piste.scrollLeft / mesurer().pas);
    const destinations = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: cartes.length - 1 };
    if (!(event.key in destinations)) return;
    event.preventDefault();
    defiler(destinations[event.key]);
  });
  const observation = new ResizeObserver(() => {
    if (!bloc.isConnected) { observation.disconnect(); return; }
    actualiser();
  });
  observation.observe(piste);

  function afficherPersonnages(personnages) {
    cartes = personnages.map((personnage, index) => {
      const carte = creerCartePersonnage(personnage, action);
      carte.dataset.nom = personnage.name;
      carte.setAttribute("role", "group");
      carte.setAttribute("aria-roledescription", "diapositive");
      carte.setAttribute("aria-label", `${personnage.name}, ${index + 1} sur ${personnages.length}`);
      return carte;
    });
    piste.replaceChildren(...cartes);
    piste.hidden = cartes.length === 0;
    piste.scrollTo({ left: 0, behavior: "instant" });
    actualiser();
  }
  return { bloc, piste, afficherPersonnages };
}

export function creerDecorPersonnages() {
  const decor = creer("div", "entree-rencontres-decor");
  decor.setAttribute("aria-hidden", "true");
  const enveloppe = creer("div", "entree-rencontres-enveloppe");
  enveloppe.innerHTML = `<svg viewBox="0 0 180 130" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="casting-papier" x2="0" y2="1"><stop stop-color="#f8d1c9"/><stop offset="1" stop-color="#c97f8b"/></linearGradient></defs>
    <rect x="10" y="12" width="160" height="106" rx="6" fill="url(#casting-papier)" stroke="#ffd9cd"/>
    <path d="m12 114 78-57 78 57M12 15l78 61 78-61" stroke="#a65469" stroke-width="1.5"/>
    <path d="M90 90C45 64 72 42 90 63c18-21 45 1 0 27Z" fill="#a30d22" stroke="#ef7c8b" stroke-width="2"/>
    <path d="M82 61c-7-8-16-3-15 3" stroke="#ffbab5" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
  const photo = creer("div", "entree-rencontres-photo");
  photo.hidden = true;
  decor.append(enveloppe, photo);
  for (let index = 0; index < 3; index++) decor.append(creer("span", `entree-rencontres-petale entree-rencontres-petale-${index}`));
  function afficherDecor(image) {
    photo.replaceChildren(creerImage(image, "", ""));
    photo.hidden = false;
  }
  return { elements: [decor, creerRubanGlacage("entree-rencontres-ruban", "entree-casting-glacage")], afficherDecor };
}
