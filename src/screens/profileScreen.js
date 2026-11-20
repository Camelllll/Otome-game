import { demanderConfirmation } from "../ui/gameModal.js";
import { deconnecterJoueur, listerIllustrationsDebloquees } from "../services/playerRepository.js";
import { appelApi } from "../services/apiClient.js";
import { getCharacters } from "../services/gameRepository.js";
import { creerCollectionIllustrations } from "./illustrationGalleryScreen.js";
import { creerCarnet } from "../ui/carnetRelations.js";

export function creer(tag, classe = "", texte = "") {
  const element = document.createElement(tag);
  element.className = classe;
  element.textContent = texte;
  return element;
}

export function bouton(texte, action, classe = "pda-bouton") {
  const element = creer("button", classe, texte);
  element.type = "button";
  element.addEventListener("click", async () => {
    try {
      await action();
    } catch (erreur) {
      console.error("Action depuis le carnet impossible.", erreur);
      await demanderConfirmation({
        titre: "Action impossible", message: erreur.message, confirmer: "Fermer", annuler: null,
      });
    }
  });
  return element;
}

export function dateFormatee(valeur) {
  if (!valeur || Number.isNaN(new Date(valeur).getTime())) return "Non renseignée";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(valeur));
}

const TRACES = {
  profil: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  illustrations: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 18 6-6 4 4 4-6 4 8"/>',
  trophees: '<path d="M7 3h10v6a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 5 4M17 5h4v3a4 4 0 0 1-5 4M12 14v7M7 21h10"/>',
  parametres: '<circle cx="12" cy="12" r="3"/><path d="m9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/>',
  coeur: '<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-5 5 3 11 8 15 5-4 13-10 8-15z"/>',
  reponses: '<path d="m5 12 4 4L20 5M20 12v8H4V4h10"/>',
};

function icone(nom) {
  const zone = creer("span", "pda-icone");
  zone.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TRACES[nom] || TRACES.profil}</svg>`;
  return zone;
}

export function construireCarnet(racine, { compte = false, onCarnet, onCompte, onRetour, onAccueil, libelleRetour = "Accueil" }) {
  const ecran = creer("div", `pda-ecran${compte ? " pda-ecran-compte" : ""}`);
  ecran.dataset.page = "gauche";
  const sidebar = creer("nav", "pda-sidebar");
  sidebar.setAttribute("aria-label", "Navigation principale");
  const logo = creer("img", "pda-logo");
  logo.src = "assets/logo/Logo%20Pomme%20d'Amour.png";
  logo.alt = "Pomme d'Amour";
  const accueil = bouton("", onAccueil || onRetour, "pda-logo-lien");
  accueil.setAttribute("aria-label", "Accueil");
  accueil.append(logo);
  sidebar.append(accueil, creer("div", "pda-separateur"));
  [
    ["Mon carnet", "profil", onCarnet, !compte],
    ["Compte", "parametres", onCompte, compte],
  ].forEach(([label, nom, action, actif]) => {
    const lien = bouton("", action, `pda-nav${actif ? " actif" : ""}`);
    lien.dataset.navigation = nom;
    lien.append(icone(nom), creer("span", "", label));
    if (actif) lien.setAttribute("aria-current", "page");
    sidebar.append(lien);
  });
  if (libelleRetour !== "Accueil") sidebar.append(bouton(libelleRetour, onRetour, "pda-nav"));
  sidebar.append(creer("span", "pda-marque-sidebar", "❦ A"));
  const livre = creer("main", "pda-livre");
  livre.setAttribute("aria-label", compte ? "Mon compte — carnet personnel" : "Mon carnet personnel");
  const gauche = creer("section", "pda-page pda-page-gauche");
  const droite = creer("section", "pda-page pda-page-droite");
  gauche.id = "pda-page-gauche";
  droite.id = "pda-page-droite";
  const pages = creer("nav", "pda-navigation-pages");
  pages.setAttribute("aria-label", "Pages du carnet");
  const afficherPage = cote => {
    ecran.dataset.page = cote;
    for (const commande of pages.children) commande.setAttribute("aria-pressed", String(commande.dataset.page === cote));
  };
  [["gauche", compte ? "Identifiants" : "Profil"], ["droite", compte ? "Gestion" : "Carnet"]].forEach(([cote, label]) => {
    const commande = bouton(label, () => afficherPage(cote), "pda-bouton-page");
    commande.dataset.page = cote;
    commande.setAttribute("aria-controls", `pda-page-${cote}`);
    commande.setAttribute("aria-pressed", String(cote === "gauche"));
    pages.append(commande);
  });
  const ruban = creer("span", "pda-ruban", "A");
  ruban.setAttribute("aria-label", "Université Aster");
  ruban.innerHTML = '<svg viewBox="0 0 64 72" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.2"><path d="M25 57C7 46 8 24 19 14M39 57c18-11 17-33 6-43"/><path d="m18 48-8-3 3-8m3-2-7-5 5-7m1 1-3-7 8-5m26 36 8-3-3-8m-3-2 7-5-5-7m-1 1 3-7-8-5"/></g><text x="32" y="46" text-anchor="middle" fill="currentColor" font-family="Georgia, serif" font-size="35">A</text></svg>';
  livre.append(pages, gauche, droite, ruban);
  const retourAccueil = creer("footer", "pda-retour-accueil");
  retourAccueil.append(bouton("← Retour à l'accueil", onAccueil || onRetour));
  ecran.append(sidebar, livre, retourAccueil);
  racine.replaceChildren(ecran);
  const cycle = new AbortController();
  const surveillance = new MutationObserver(() => {
    if (!racine.contains(ecran)) {
      cycle.abort();
      surveillance.disconnect();
    }
  });
  surveillance.observe(racine, { childList: true });
  return { ecran, gauche, droite, afficherPage, signal: cycle.signal };
}

function avatarLovometre(nom, personnage) {
  const avatar = creer("span", "pda-stat-avatar");
  const initiale = creer("span", "", Array.from(nom)[0].toLocaleUpperCase("fr"));
  avatar.setAttribute("aria-hidden", "true");
  avatar.append(initiale);
  const source = personnage?.portraits?.default || personnage?.sprite;
  if (!source) return avatar;

  const image = creer("img");
  image.alt = "";
  image.hidden = true;
  image.addEventListener("load", () => {
    image.classList.toggle("portrait-recadrage", image.naturalHeight >= image.naturalWidth * 1.6);
    initiale.hidden = true;
    image.hidden = false;
  }, { once: true });
  image.addEventListener("error", () => {
    console.warn("Portrait du meilleur Lovomètre inaccessible :", source);
  }, { once: true });
  avatar.append(image);
  image.src = source;
  return avatar;
}

function statistiques(stats, personnageLovometre) {
  const section = creer("section", "pda-statistiques");
  section.append(creer("h2", "pda-titre-section", "Mes statistiques de jeu"));
  const grille = creer("div", "pda-stats");
  [
    ["illustrations", stats.illustrationsDebloquees, "Illustrations débloquées", "Ta collection personnelle."],
    ["coeur", stats.meilleurLovometre ? `${stats.meilleurLovometre.valeur} %` : "—", "Meilleur Lovomètre", stats.meilleurLovometre?.personnage || "Aucune affinité enregistrée."],
  ].forEach(([nom, valeur, label, detail]) => {
    const estLovometre = nom === "coeur";
    const carte = creer("article", estLovometre ? "pda-stat pda-stat-lovometre" : "pda-stat");
    const personnage = estLovometre && stats.meilleurLovometre?.personnage;
    carte.append(personnage ? avatarLovometre(personnage, personnageLovometre) : icone(nom),
      creer("strong", "pda-stat-valeur", String(valeur)), creer("h3", "", label), creer("p", "", detail));
    grille.append(carte);
  });
  section.append(grille);
  section.append(creer("p", "pda-notice", "Lovomètre : sauvegardes et journal conservés."));
  return section;
}

export async function lancerEcranProfil(racine, { joueur, onRetour, onAccueil, libelleRetour, onCompte, onChargerRelations, onAvantDeconnexion, onDeconnecte, onglet = "apercu", onOnglet } = {}) {
  let selectionner;
  const { ecran, gauche, droite, afficherPage, signal } = construireCarnet(racine, {
    onRetour, onAccueil, libelleRetour, onCompte,
    onCarnet: () => selectionner("apercu"),
  });
  gauche.append(
    creer("p", "pda-surtitre", "UNIVERSITÉ ASTER · ESPACE PERSONNEL"),
    creer("h1", "pda-titre", "Mon carnet ♡"),
  );
  const identite = creer("div", "pda-identite");
  const avatar = creer("div", "pda-avatar", Array.from(joueur.pseudo || "?")[0].toLocaleUpperCase("fr"));
  avatar.setAttribute("aria-label", `Avatar de ${joueur.pseudo}`);
  const presentation = creer("div", "pda-presentation");
  const pseudo = creer("h2", "pda-pseudo", joueur.pseudo);
  pseudo.title = joueur.pseudo;
  presentation.append(pseudo,
    creer("p", "", "Ton histoire à Aster, au fil des pages."),
    creer("span", "pda-statut", "● Compte actif"));
  identite.append(avatar, presentation);
  gauche.append(identite, creer("div", "pda-filet", "◇"));
  const infos = creer("section", "pda-informations");
  infos.append(creer("h2", "pda-titre-section", "Mes informations"));
  const liste = creer("dl", "pda-infos");
  [["Inscription", dateFormatee(joueur.created_at)], ["Établissement", "Université Aster"]].forEach(([label, valeur]) => {
    liste.append(creer("dt", "", label), creer("dd", "", valeur));
  });
  infos.append(liste);
  const gestion = creer("section", "pda-gestion");
  gestion.append(creer("h2", "pda-titre-section", "Gestion du compte"),
    creer("p", "", "Tes identifiants et tes préférences, dans un espace privé."),
    bouton("Mon compte →", onCompte));
  gauche.append(infos, gestion, creer("p", "pda-note-bas", "UNIVERSITÉ ASTER · CARNET PERSONNEL"));

  const onglets = creer("div", "pda-onglets");
  onglets.setAttribute("role", "tablist");
  onglets.setAttribute("aria-label", "Aperçu et collections");
  const panneau = creer("div", "pda-panneau");
  panneau.id = "pda-panneau";
  panneau.setAttribute("role", "tabpanel");
  panneau.tabIndex = 0;
  const boutons = new Map();
  const labels = [["apercu", "Aperçu"], ["statistiques", "Statistiques"], ["illustrations", "Illustrations"]];
  let donnees = null;
  let illustrations = null;
  let personnageLovometre = null;
  let erreurStats = null;
  let erreurIllustrations = null;
  let vueCollection = null;
  let relations = null;
  let chargementRelations = false;
  signal.addEventListener("abort", () => vueCollection?.abort(), { once: true });
  signal.addEventListener("abort", () => relations?.fermer(), { once: true });
  async function ouvrirRelations() {
    if (chargementRelations) return;
    chargementRelations = true;
    try {
      if (!relations) {
        const contexte = await onChargerRelations();
        if (signal.aborted) return;
        relations = creerCarnet(contexte);
        ecran.append(relations.element);
      }
      relations.ouvrir();
    } finally {
      chargementRelations = false;
    }
  }
  function carte(titre, description, nom, cible) {
    const element = bouton("", typeof cible === "function" ? cible : () => selectionner(cible), "pda-carte-collection");
    element.append(icone(nom));
    const texte = creer("span");
    texte.append(creer("span", "pda-titre-carte", titre), creer("span", "pda-description", description));
    element.append(texte, creer("span", "pda-fleche", "›"));
    return element;
  }
  selectionner = (id, notifier = true) => {
    if (!boutons.has(id)) id = "apercu";
    onglet = id;
    vueCollection?.abort();
    panneau.dataset.onglet = id;
    for (const [cle, element] of boutons) {
      element.setAttribute("aria-selected", String(cle === id));
      element.tabIndex = cle === id ? 0 : -1;
    }
    panneau.setAttribute("aria-labelledby", `pda-onglet-${id}`);
    panneau.replaceChildren();
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      panneau.animate([{ opacity: 0.4, transform: "translateY(3px)" }, { opacity: 1, transform: "none" }], { duration: 180 });
    }
    if (id === "apercu") {
      const introduction = creer("header", "pda-intro-carnet");
      introduction.append(
        creer("p", "pda-surtitre", "LES PAGES DE TON HISTOIRE"),
        creer("h2", "pda-titre-section", "Tes souvenirs, à portée de cœur."),
        creer("p", "", "Des rencontres qui comptent et des moments à garder. Tout se retrouve ici."),
      );
      panneau.append(
        introduction,
        carte("Mes Illustrations", "Retrouve les moments précieux de ton histoire.", "illustrations", "illustrations"),
        carte("Mes relations", "Les rencontres et les affinités de ton histoire.", "coeur", ouvrirRelations),
      );
    } else if (id === "statistiques") {
      panneau.append(donnees ? statistiques(donnees, personnageLovometre) : creer("p", erreurStats ? "pda-erreur" : "pda-notice", erreurStats || "Chargement de tes statistiques…"));
    } else {
      panneau.append(creer("h2", "pda-titre-section", "Mes Illustrations"));
      if (illustrations) {
        vueCollection = new AbortController();
        panneau.append(creerCollectionIllustrations(illustrations, { signal: vueCollection.signal }));
      }
      else panneau.append(creer("p", erreurIllustrations ? "pda-erreur" : "pda-notice", erreurIllustrations || "Chargement de tes illustrations…"));
    }
    if (notifier) {
      afficherPage("droite");
      onOnglet?.(id);
    }
  };
  labels.forEach(([id, label], index) => {
    const element = bouton(label, () => selectionner(id), "pda-onglet");
    element.id = `pda-onglet-${id}`;
    element.setAttribute("role", "tab");
    element.setAttribute("aria-controls", panneau.id);
    element.addEventListener("keydown", (event) => {
      const touches = { ArrowRight: (index + 1) % labels.length, ArrowLeft: (index + labels.length - 1) % labels.length, Home: 0, End: labels.length - 1 };
      if (!(event.key in touches)) return;
      event.preventDefault();
      const cible = labels[touches[event.key]][0];
      selectionner(cible);
      boutons.get(cible).focus();
    });
    boutons.set(id, element);
    onglets.append(element);
  });
  const pied = creer("footer", "pda-pied");
  const statut = creer("p", "pda-erreur");
  statut.setAttribute("role", "alert");
  const deconnexion = bouton("↪  Se déconnecter", async () => {
    deconnexion.disabled = true;
    if (!await demanderConfirmation({
      titre: "Se déconnecter ?",
      message: "Ta progression et tes collections seront conservées.",
      confirmer: "Se déconnecter",
    })) {
      deconnexion.disabled = false;
      return;
    }
    try {
      await onAvantDeconnexion?.();
      await deconnecterJoueur();
      onDeconnecte();
    } catch (erreur) {
      statut.textContent = erreur.message;
      deconnexion.disabled = false;
    }
  }, "pda-deconnexion");
  pied.append(creer("div", "pda-filet", "◇"), deconnexion, statut);
  droite.append(onglets, panneau, pied);
  selectionner(onglet, false);
  afficherPage(onglet === "apercu" ? "gauche" : "droite");
  await Promise.all([
    appelApi("/profile/stats").then(async resultat => {
      donnees = resultat;
      const id = resultat.meilleurLovometre?.personnageId;
      if (!id) return;
      try {
        const catalogue = await getCharacters();
        personnageLovometre = catalogue.crushs?.find(personnage => personnage.id === id);
      } catch (erreur) {
        console.warn("Impossible de charger le portrait du meilleur Lovomètre.", erreur);
      }
    }).catch(erreur => { erreurStats = erreur.message; }),
    listerIllustrationsDebloquees().then(resultat => { illustrations = resultat; }).catch(erreur => { erreurIllustrations = erreur.message; }),
  ]);
  if (racine.contains(ecran)) selectionner(onglet, false);
}
