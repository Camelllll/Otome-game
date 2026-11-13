// Carnet de relations : galerie des personnages, fiche du personnage sélectionné et souvenirs partagés.
import { jaugeEnPourcentageAffichage } from "../engine/relationManager.js";
import { souvenirsDuPersonnage } from "../engine/carnet.js";
import { getIllustrationsCatalogue } from "../services/gameRepository.js";
import { PROFILS_CARNET } from "../data/carnetProfils.js";

const ECHAPPEMENTS = { "\u0026": "\u0026amp;", "<": "\u0026lt;", ">": "\u0026gt;", '"': "\u0026quot;", "'": "\u0026#39;" };

function esc(valeur) {
  return String(valeur ?? "").replace(/[&<>"']/g, (caractere) => ECHAPPEMENTS[caractere]);
}

function icone(corps, classe = "") {
  return `<svg class="ico ${classe}" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${corps}</svg>`;
}

const ICONES = {
  coeur: icone('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'),
  coeurPlein: icone('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>', "plein"),
  cadenas: icone('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  croix: icone('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
  retour: icone('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>'),
  valide: icone('<polyline points="20 6 9 17 4 12"/>'),
  etoile: icone('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
  regle: icone('<path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0L2.7 16.7a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4z"/><path d="m7.5 10.5 2 2M10.5 7.5l2 2M13.5 4.5l2 2M4.5 13.5l2 2"/>'),
  poids: icone('<circle cx="12" cy="5" r="3"/><path d="M6.5 8a2 2 0 0 0-1.905 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.925-2.54L19.4 9.5A2 2 0 0 0 17.48 8z"/>'),
  livre: icone('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
  image: icone('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
  duo: icone('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
};

const SILHOUETTE =
  '<svg class="carnet-silhouette" viewBox="0 0 120 160" aria-hidden="true" focusable="false"><circle cx="60" cy="48" r="26"/><path d="M12 160c0-34 22-58 48-58s48 24 48 58z"/></svg>';

const JALONS = [25, 50, 75, 100];

// Profil affiché : les données API (carnet dans data) priment, PROFILS_CARNET sert de fallback
// pour les persos dont le mode d'emploi n'a pas encore été migré dans le studio.
function lireProfil(personnage) {
  const fallback = PROFILS_CARNET[personnage.id] || {};
  // Le studio écrit carnet.modeEmploi directement dans data, que l'API renvoie à plat.
  const carnetApi = personnage.carnet || {};
  return {
    citation:    personnage.tagline    || fallback.citation   || "",
    age:         personnage.age        ?? fallback.age        ?? null,
    formation:   personnage.formation  || fallback.formation  || personnage.field || "",
    taille:      personnage.taille     || fallback.taille     || personnage.height || "",
    poids:       personnage.poids      || fallback.poids      || personnage.weight || "",
    signe:       personnage.signe      || fallback.signe      || personnage.zodiac || "",
    description: personnage.description|| fallback.description|| "",
    modeEmploi:  carnetApi.modeEmploi  || fallback.modeEmploi || null,
  };
}

// Pourcentage d'affinité, ou null si le personnage n'a pas de jauge à suivre.
function affinite(personnage, contexte) {
  const jauges = { ...(personnage.gauges || {}), ...(contexte.getInfos?.(personnage.id)?.gauges || {}) };
  const valeur = jauges[personnage.categorieCarnet === "crush" ? "amour" : "amitie"];
  if (valeur === undefined || valeur === null) return null;
  const pourcentage = jaugeEnPourcentageAffichage(valeur);
  return Math.max(0, Math.min(100, Number.isFinite(pourcentage) ? pourcentage : 0));
}

function rendreLovometre(personnage, pourcentage) {
  if (pourcentage === null) {
    return '<p class="carnet-sans-affinite">Aucune affinité à suivre pour l’instant.</p>';
  }
  const jalons = JALONS.map(
    (palier) =>
      `<li class="carnet-jalon ${pourcentage >= palier ? "atteint" : ""} ${palier === 100 ? "dernier" : ""}" style="--pos:${palier}">${pourcentage >= palier ? ICONES.coeurPlein : ICONES.coeur}</li>`
  ).join("");
  return `
    <div class="carnet-lovo" role="group" aria-label="Affinité">
      <div class="carnet-lovo-tete">
        <span class="carnet-lovo-titre">${ICONES.coeurPlein}Affinité</span>
        <strong>${pourcentage}%</strong>
      </div>
      <div class="carnet-lovo-barre" role="progressbar" aria-label="Affinité avec ${esc(personnage.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pourcentage}">
        <span style="width:${pourcentage}%"></span>
      </div>
      <ol class="carnet-lovo-jalons" aria-hidden="true">${jalons}</ol>
    </div>`;
}

function rendreModeEmploi(modeEmploi) {
  if (!modeEmploi) return "";
  const liste = (elements, classe, pictogramme) =>
    Array.isArray(elements) && elements.length
      ? `<ul class="carnet-mode-liste ${classe}">${elements.map((element) => `<li>${pictogramme}<span>${esc(element)}</span></li>`).join("")}</ul>`
      : "";
  const faire = liste(modeEmploi.faire, "faire", ICONES.valide);
  const eviter = liste(modeEmploi.eviter, "eviter", ICONES.croix);
  if (!faire && !eviter) return "";
  return `<div class="carnet-mode"><h4>Mode d’emploi</h4><div class="carnet-mode-colonnes">${faire}${eviter}</div></div>`;
}

function rendreProfil(personnage, contexte) {
  const pourcentage = affinite(personnage, contexte);
  const profil = lireProfil(personnage);
  const puces = [
    [ICONES.regle, "Taille", profil.taille],
    [ICONES.poids, "Poids", profil.poids],
    [ICONES.etoile, "Signe", profil.signe],
  ]
    .filter(([, , valeur]) => valeur)
    .map(([pictogramme, libelle, valeur]) => `<li class="carnet-puce">${pictogramme}<span class="carnet-sr">${libelle} : </span><span>${esc(valeur)}</span></li>`)
    .join("");

  const presentation = profil.description
    ? `<section class="carnet-presentation">
         <p class="carnet-description">${esc(profil.description)}</p>
       </section>`
    : "";

  return `
    <article class="carnet-profil">
      <div class="carnet-sprite">
        ${personnage.sprite ? `<img src="${esc(personnage.sprite)}" alt="Portrait de ${esc(personnage.name)}">` : SILHOUETTE}
      </div>
      <div class="carnet-identite">
        <p class="carnet-role">${esc(profil.formation || "Campus")}</p>
        <h3 class="carnet-nom">${esc(personnage.name)}${profil.age ? `<span class="carnet-age">${esc(profil.age)} ans</span>` : ""}</h3>
        ${puces ? `<ul class="carnet-puces">${puces}</ul>` : ""}
        ${profil.citation ? `<blockquote class="carnet-citation">${esc(profil.citation)}</blockquote>` : ""}
        ${rendreLovometre(personnage, pourcentage)}
        ${rendreModeEmploi(profil.modeEmploi)}
      </div>
      ${presentation}
    </article>`;
}

function rendreProfilVerrouille() {
  return `
    <div class="carnet-fiche-verrouillee">
      <div class="carnet-silhouette-grande">${SILHOUETTE}<span class="carnet-cadenas">${ICONES.cadenas}</span></div>
      <h3 class="carnet-nom">???</h3>
      <p>Ce personnage n’est pas encore apparu dans votre histoire.</p>
    </div>`;
}

function carteRencontree(personnage, index, selectionne, pourcentage) {
  return `
    <button type="button" class="carnet-carte ${selectionne ? "selectionnee" : ""}" data-index="${index}" aria-pressed="${selectionne}">
      <span class="carnet-carte-portrait">${personnage.sprite ? `<img src="${esc(personnage.sprite)}" alt="" loading="lazy">` : SILHOUETTE}</span>
      <span class="carnet-carte-nom">${esc(personnage.name)}</span>
      ${pourcentage === null ? "" : `<span class="carnet-carte-affinite">${ICONES.coeurPlein}<b>${pourcentage}%</b></span>`}
    </button>`;
}

function carteVerrouillee(index, selectionne) {
  return `
    <button type="button" class="carnet-carte verrouillee ${selectionne ? "selectionnee" : ""}" data-index="${index}" aria-pressed="${selectionne}" aria-label="Personnage non rencontré">
      <span class="carnet-carte-portrait">${SILHOUETTE}<span class="carnet-cadenas">${ICONES.cadenas}</span></span>
      <span class="carnet-carte-nom">???</span>
      <span class="carnet-carte-indice">À rencontrer au fil de l’histoire</span>
    </button>`;
}

function libelleEpisode(illustration) {
  return illustration.episodeTitle || illustration.episodeId || "";
}

const RARETE_LIBELLES = {
  common:    "Commun",
  rare:      "Rare",
  ultra_rare:"Ultra Rare",
  legendary: "Légendaire",
};

function badgeRarete(illustration, debloque) {
  // On affiche la rareté même sur les vignettes verrouillées (sauf spoilerLevel >= 2 où tout est masqué).
  if (!debloque && Number(illustration.spoilerLevel) >= 2) return "";
  const rarete = illustration.rarity;
  if (!rarete || rarete === "common") return "";
  const libelle = RARETE_LIBELLES[rarete] ?? rarete;
  return `<span class="badge-rarete rarete-${esc(rarete)}" aria-label="Rareté : ${libelle}">${libelle}</span>`;
}

function carteSouvenir(illustration, index, debloque) {
  const plusieurs = Array.isArray(illustration.characterIds) && illustration.characterIds.length > 1;
  const badgeDuo = plusieurs ? `<span class="carnet-souvenir-duo" title="Souvenir partagé avec plusieurs personnages">${ICONES.duo}</span>` : "";
  const badgeRar = badgeRarete(illustration, debloque);
  if (!debloque) {
    const episode = Number(illustration.spoilerLevel) >= 2 ? "???" : esc(libelleEpisode(illustration));
    return `
      <div class="carnet-souvenir verrouille" aria-label="Souvenir verrouillé">
        <span class="carnet-vignette"><span class="carnet-cadenas">${ICONES.cadenas}</span>${badgeDuo}${badgeRar}</span>
        <span class="carnet-souvenir-texte">
          <strong>???</strong>
          <small>${episode}</small>
          <span class="carnet-etat">Verrouillé</span>
        </span>
      </div>`;
  }
  return `
    <button type="button" class="carnet-souvenir" data-souvenir="${index}">
      <span class="carnet-vignette"><img src="${esc(illustration.image)}" alt="" loading="lazy">${badgeDuo}${badgeRar}</span>
      <span class="carnet-souvenir-texte">
        <strong>${esc(illustration.title)}</strong>
        <small>${esc(libelleEpisode(illustration))}</small>
        <span class="carnet-etat ouvert">Débloqué</span>
      </span>
    </button>`;
}

/**
 * @param {object} options
 * @param {object[]} options.fiches - fiches des personnages (avec `categorieCarnet` : "crush" | "autre")
 * @param {(id: string) => object} [options.getInfosPersonnage] - jauges à jour d'un personnage
 * @param {() => object} [options.getSauvegarde] - sauvegarde courante (rencontres et souvenirs débloqués)
 * @returns {{ element: HTMLElement, ouvrir: () => void, fermer: () => void }}
 */
export function creerCarnet({ fiches = [], getInfosPersonnage, getSauvegarde } = {}) {
  const element = document.createElement("div");
  element.className = "voile-personnages voile-carnet";
  element.innerHTML = `
    <div class="carnet" role="dialog" aria-modal="true" aria-label="Carnet de relations : les personnages">
      <header class="carnet-entete">
        <button class="carnet-retour" type="button">${ICONES.retour}<span>Retour</span></button>
        <div class="carnet-titres">
          <p class="carnet-surtitre">${ICONES.livre}Carnet de relations</p>
          <h2>Les personnages</h2>
        </div>
        <button class="carnet-fermer" type="button" aria-label="Fermer">${ICONES.croix}</button>
      </header>
      <div class="carnet-corps">
        <aside class="carnet-galerie" aria-label="Galerie des personnages">
          <div class="carnet-onglets" role="tablist"></div>
          <div class="carnet-grille"></div>
        </aside>
        <section class="carnet-fiche" aria-live="polite"></section>
        <aside class="carnet-souvenirs" aria-label="Souvenirs partagés"></aside>
      </div>
      <div class="carnet-lightbox" hidden></div>
    </div>`;

  const zoneOnglets = element.querySelector(".carnet-onglets");
  const zoneGrille = element.querySelector(".carnet-grille");
  const zoneFiche = element.querySelector(".carnet-fiche");
  const zoneSouvenirs = element.querySelector(".carnet-souvenirs");
  const lightbox = element.querySelector(".carnet-lightbox");

  let onglet = "crush";
  let selectionId = null;
  let catalogue = [];
  let ouvert = false;
  let listeAffichee = [];
  let souvenirsAffiches = [];

  const fichesDe = (categorie) => fiches.filter((personnage) => (personnage.categorieCarnet === "crush" ? "crush" : "autre") === categorie);

  function lireContexte() {
    const sauvegarde = getSauvegarde?.() || {};
    return {
      rencontres: new Set(Array.isArray(sauvegarde.discoveredCharacterIds) ? sauvegarde.discoveredCharacterIds : []),
      vus: new Set(Array.isArray(sauvegarde.unlockedIllustrationIds) ? sauvegarde.unlockedIllustrationIds : []),
      getInfos: getInfosPersonnage,
    };
  }

  function assurerSelection(contexte) {
    const liste = fichesDe(onglet);
    if (liste.some((personnage) => personnage.id === selectionId)) return;
    selectionId = (liste.find((personnage) => contexte.rencontres.has(personnage.id)) || liste[0])?.id ?? null;
  }

  function rendreOnglets(contexte) {
    const definitions = [
      ["crush", "Crushs"],
      ["autre", "Autres personnages"],
    ];
    zoneOnglets.innerHTML = definitions
      .map(([cle, libelle]) => {
        const liste = fichesDe(cle);
        const rencontres = liste.filter((personnage) => contexte.rencontres.has(personnage.id)).length;
        const actif = cle === onglet;
        return `<button type="button" role="tab" class="carnet-onglet ${actif ? "actif" : ""}" data-onglet="${cle}" aria-selected="${actif}">${libelle}<span class="carnet-compteur">${rencontres}/${liste.length}</span></button>`;
      })
      .join("");
  }

  function rendreGalerie(contexte) {
    listeAffichee = fichesDe(onglet);
    zoneGrille.innerHTML = listeAffichee.length
      ? listeAffichee
          .map((personnage, index) => {
            const selectionne = personnage.id === selectionId;
            return contexte.rencontres.has(personnage.id)
              ? carteRencontree(personnage, index, selectionne, affinite(personnage, contexte))
              : carteVerrouillee(index, selectionne);
          })
          .join("")
      : '<p class="carnet-vide">Aucun personnage dans cette catégorie.</p>';
  }

  function rendreFiche(contexte) {
    const personnage = fiches.find((fiche) => fiche.id === selectionId);
    if (!personnage) {
      zoneFiche.innerHTML = '<p class="carnet-vide">Sélectionnez un personnage.</p>';
      return;
    }
    zoneFiche.innerHTML = contexte.rencontres.has(personnage.id) ? rendreProfil(personnage, contexte) : rendreProfilVerrouille();
    zoneFiche.scrollTop = 0;
  }

  function rendreSouvenirs(contexte) {
    const personnage = fiches.find((fiche) => fiche.id === selectionId);
    souvenirsAffiches = [];
    const entete = (compteur) =>
      `<div class="carnet-souvenirs-tete"><h3>${ICONES.image}Souvenirs partagés</h3>${compteur}</div>`;

    if (!personnage || !contexte.rencontres.has(personnage.id)) {
      zoneSouvenirs.innerHTML = `${entete("")}
        <div class="carnet-souvenirs-verrou">${ICONES.cadenas}<p>Les souvenirs apparaîtront après la première rencontre.</p></div>`;
      return;
    }

    souvenirsAffiches = souvenirsDuPersonnage(catalogue, personnage.id);
    const debloques = souvenirsAffiches.filter((illustration) => contexte.vus.has(illustration.id)).length;
    const restants = souvenirsAffiches.length - debloques;
    const compteur = souvenirsAffiches.length ? `<span class="carnet-compteur">${debloques}/${souvenirsAffiches.length}</span>` : "";
    const cartes = souvenirsAffiches.map((illustration, index) => carteSouvenir(illustration, index, contexte.vus.has(illustration.id))).join("");
    const vide = souvenirsAffiches.length ? "" : `<p class="carnet-vide">Vos souvenirs avec ${esc(personnage.name)} apparaîtront ici.</p>`;
    const aDecouvrir =
      souvenirsAffiches.length === 0 || restants > 0
        ? `<div class="carnet-adecouvrir">${ICONES.etoile}<div><strong>À découvrir…</strong><p>D’autres moments restent à vivre.</p></div></div>`
        : "";
    zoneSouvenirs.innerHTML = `${entete(compteur)}<div class="carnet-souvenirs-liste">${cartes}${vide}</div>${aDecouvrir}`;
  }

  function rendre() {
    const contexte = lireContexte();
    assurerSelection(contexte);
    rendreOnglets(contexte);
    rendreGalerie(contexte);
    rendreFiche(contexte);
    rendreSouvenirs(contexte);
  }

  function nomsAssocies(illustration, contexte) {
    const autres = (illustration.characterIds || []).filter((id) => id !== selectionId);
    return autres.map((id) => {
      const fiche = fiches.find((personnage) => personnage.id === id);
      return fiche && contexte.rencontres.has(id) ? fiche.name : "???";
    });
  }

  function ouvrirLightbox(illustration) {
    const contexte = lireContexte();
    const autres = nomsAssocies(illustration, contexte);
    lightbox.innerHTML = `
      <figure class="carnet-lightbox-cadre">
        <button type="button" class="carnet-lightbox-fermer" aria-label="Fermer l’illustration">${ICONES.croix}</button>
        <img src="${esc(illustration.image)}" alt="${esc(illustration.title)}">
        <figcaption>
          <strong>${esc(illustration.title)}</strong>
          <span>${esc(libelleEpisode(illustration))}</span>
          ${autres.length ? `<span class="carnet-lightbox-avec">${ICONES.duo}Avec ${esc(autres.join(", "))}</span>` : ""}
        </figcaption>
      </figure>`;
    lightbox.hidden = false;
    lightbox.querySelector(".carnet-lightbox-fermer").focus();
  }

  function fermerLightbox() {
    lightbox.hidden = true;
    lightbox.innerHTML = "";
  }

  function surTouche(evenement) {
    if (evenement.key !== "Escape") return;
    if (!lightbox.hidden) fermerLightbox();
    else fermer();
  }

  function ouvrir() {
    ouvert = true;
    rendre();
    element.classList.add("visible");
    document.addEventListener("keydown", surTouche);
    element.querySelector(".carnet-fermer").focus();
    // Le catalogue est chargé une seule fois ; on réaffiche dès qu'il est disponible.
    getIllustrationsCatalogue().then((liste) => {
      catalogue = liste;
      if (ouvert) rendre();
    });
  }

  function fermer() {
    ouvert = false;
    fermerLightbox();
    element.classList.remove("visible");
    document.removeEventListener("keydown", surTouche);
  }

  element.addEventListener("click", (evenement) => {
    const cible = evenement.target;
    if (!(cible instanceof Element)) return;
    if (cible === element) return fermer();
    if (cible.closest(".carnet-lightbox")) {
      if (!cible.closest(".carnet-lightbox-cadre") || cible.closest(".carnet-lightbox-fermer")) fermerLightbox();
      return;
    }
    if (cible.closest(".carnet-fermer, .carnet-retour")) return fermer();

    const boutonOnglet = cible.closest("[data-onglet]");
    if (boutonOnglet) {
      onglet = boutonOnglet.dataset.onglet === "crush" ? "crush" : "autre";
      selectionId = null;
      return rendre();
    }
    const carte = cible.closest("[data-index]");
    if (carte) {
      const personnage = listeAffichee[Number(carte.dataset.index)];
      if (personnage) {
        selectionId = personnage.id;
        rendre();
      }
      return;
    }
    const souvenir = cible.closest("[data-souvenir]");
    if (souvenir) {
      const illustration = souvenirsAffiches[Number(souvenir.dataset.souvenir)];
      if (illustration) ouvrirLightbox(illustration);
    }
  });

  return { element, ouvrir, fermer };
}