import { chargerImagePrivee } from "../services/apiClient.js";

export const RARETES = {
  common: "Commune",
  uncommon: "Peu commune",
  rare: "Rare",
  epic: "Épique",
  ultra_rare: "Épique",
  legendary: "Légendaire",
};

function element(tag, classe, texte = "") {
  const el = document.createElement(tag);
  el.className = classe;
  el.textContent = texte;
  return el;
}

function informationsIllustration(illustration, titre, detaillees = false) {
  const informations = element("div", "pda-illustration-infos");
  const nom = element("h3", "", titre);
  nom.title = titre;
  informations.append(nom);
  if (illustration.characters?.length) {
    const personnages = element("p", "", illustration.characters.join(", "));
    personnages.title = personnages.textContent;
    informations.append(personnages);
  }
  const rarete = RARETES[illustration.rarity];
  if (rarete) {
    const badge = element("span", "pda-rarete", rarete);
    badge.dataset.rarete = illustration.rarity;
    informations.append(badge);
  }
  if (illustration.acquiredAt) {
    informations.append(element("p", "", `Obtenue le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: detaillees ? "long" : "medium" }).format(new Date(illustration.acquiredAt))}`));
  }
  return informations;
}

export function ouvrirIllustration(src, titre, illustration) {
  const focus = document.activeElement;
  const dialogue = element("dialog", "pda-visionneuse");
  dialogue.setAttribute("aria-label", titre);
  const fermer = element("button", "", "Fermer ×");
  fermer.type = "button";
  const image = element("img", "");
  image.src = src;
  image.alt = titre;
  dialogue.append(fermer, image);
  if (illustration) dialogue.append(informationsIllustration(illustration, titre, true));
  fermer.addEventListener("click", () => dialogue.close());
  dialogue.addEventListener("click", event => { if (event.target === dialogue) dialogue.close(); });
  dialogue.addEventListener("close", () => { dialogue.remove(); focus?.focus(); }, { once: true });
  document.body.append(dialogue);
  dialogue.showModal();
}

export function paginerIllustrations(illustrations, capacite, ancre = 0) {
  const totalPages = Math.ceil(illustrations.length / capacite);
  const page = Math.max(0, Math.min(Math.floor(ancre / capacite), totalPages - 1));
  const debut = page * capacite;
  return { page, totalPages, debut, elements: illustrations.slice(debut, debut + capacite) };
}

function creerCarteIllustration(illustration, index) {
  const titre = illustration.title || `Illustration ${index + 1}`;
  const carte = element("article", "pda-illustration");
  const media = element("div", "pda-illustration-media");
  const agrandir = element("button", "");
  agrandir.type = "button";
  agrandir.disabled = true;
  agrandir.setAttribute("aria-label", `Agrandir ${titre}`);
  const image = element("img", "");
  image.alt = titre;
  const erreur = element("p", "pda-erreur");
  erreur.setAttribute("role", "alert");
  if (illustration.path) {
    chargerImagePrivee(illustration.path, { miniature: true }).then(src => {
      image.src = src;
      agrandir.disabled = false;
    }).catch(cause => { erreur.textContent = cause.message; });
  } else {
    erreur.textContent = "Cette illustration nécessite un import privé. Son acquisition est conservée.";
  }
  image.addEventListener("error", () => { erreur.textContent = "Cette illustration n’a pas pu être affichée."; agrandir.disabled = true; });
  agrandir.append(image);
  agrandir.addEventListener("click", async () => {
    agrandir.disabled = true;
    agrandir.setAttribute("aria-busy", "true");
    erreur.textContent = "Chargement de l’illustration…";
    try {
      const src = await chargerImagePrivee(illustration.path);
      if (carte.isConnected) ouvrirIllustration(src, titre, illustration);
      erreur.textContent = "";
    } catch (cause) {
      erreur.textContent = cause.message;
    } finally {
      agrandir.disabled = false;
      agrandir.removeAttribute("aria-busy");
    }
  });
  media.append(agrandir, erreur);
  carte.append(media, informationsIllustration(illustration, titre));
  return carte;
}

export function creerCollectionIllustrations(illustrations, { signal } = {}) {
  const collection = element("div", "pda-collection-pagination");
  const grille = element("div", "pda-collection");
  grille.id = "pda-grille-illustrations";
  collection.append(grille);
  if (!illustrations.length) {
    const vide = element("p", "pda-notice", "Ta collection commence ici. Les illustrations apparaîtront après leur découverte dans l’histoire.");
    grille.append(vide);
    return collection;
  }
  let capacite = 0;
  let ancre = 0;
  const pagination = element("nav", "pda-pagination");
  pagination.setAttribute("aria-label", "Pagination des illustrations");
  const precedent = element("button", "pda-bouton", "←");
  const suivant = element("button", "pda-bouton", "→");
  [[precedent, "Page précédente"], [suivant, "Page suivante"]].forEach(([commande, label]) => {
    commande.type = "button";
    commande.disabled = true;
    commande.setAttribute("aria-label", label);
    commande.setAttribute("aria-controls", grille.id);
  });
  const compteur = element("span", "pda-compteur-pages");
  compteur.setAttribute("role", "status");
  compteur.setAttribute("aria-live", "polite");
  compteur.setAttribute("aria-atomic", "true");
  const afficher = () => {
    const { page, totalPages, debut, elements } = paginerIllustrations(illustrations, capacite, ancre);
    ancre = debut;
    grille.replaceChildren(...elements.map((illustration, index) => creerCarteIllustration(illustration, debut + index)));
    precedent.disabled = page === 0;
    suivant.disabled = page + 1 >= totalPages;
    compteur.replaceChildren(element("span", "", `${debut + 1}–${debut + elements.length} sur ${illustrations.length}`),
      element("span", "", `Page ${page + 1} / ${totalPages}`));
  };
  precedent.addEventListener("click", () => { ancre -= capacite; afficher(); });
  suivant.addEventListener("click", () => { ancre += capacite; afficher(); });
  pagination.append(precedent, compteur, suivant);
  collection.append(pagination);
  const observer = new ResizeObserver(([entree]) => {
    const { width, height } = entree.contentRect;
    if (!width || !height) return;
    const colonnes = width >= 440 && height >= 330 ? 2 : 1;
    const lignes = Math.max(1, Math.min(2, Math.floor((height - 50) / 280)));
    grille.style.gridTemplateColumns = `repeat(${colonnes}, minmax(0, 1fr))`;
    grille.style.gridTemplateRows = `repeat(${lignes}, minmax(0, 1fr))`;
    collection.classList.toggle("pda-collection-compacte", height < 300);
    collection.classList.toggle("pda-collection-basse", height < 200);
    if (capacite !== colonnes * lignes) {
      capacite = colonnes * lignes;
      afficher();
    }
  });
  if (!signal?.aborted) observer.observe(collection);
  signal?.addEventListener("abort", () => observer.disconnect(), { once: true });
  return collection;
}

// L'ancienne route #galerie est conservée ; le routeur utilise désormais le carnet.
export function lancerEcranGalerie(racine, { illustrations = [], onRetour }) {
  const cycle = new AbortController();
  const ecran = element("main", "pda-ecran");
  const page = element("section", "pda-page");
  const retour = element("button", "pda-bouton", "Retour");
  retour.addEventListener("click", () => { cycle.abort(); onRetour(); });
  page.append(element("h1", "pda-titre", "Mes Illustrations"), creerCollectionIllustrations(illustrations, { signal: cycle.signal }), retour);
  ecran.append(page);
  racine.replaceChildren(ecran);
}
