import { creer, creerImage, icone } from "./landingComponents.js";

function decoration(classe, viewBox, contenu, proportions = "xMidYMid meet") {
  const element = creer("div", classe);
  element.setAttribute("aria-hidden", "true");
  element.innerHTML = `<svg viewBox="${viewBox}" preserveAspectRatio="${proportions}" fill="none" xmlns="http://www.w3.org/2000/svg">${contenu}</svg>`;
  return element;
}

export function creerSectionConcept({ onChoix, onRencontres, onUnivers }) {
  const section = creer("section", "entree-section entree-concept-section");
  section.id = "entree-concept";
  section.tabIndex = -1;
  section.setAttribute("aria-labelledby", "entree-concept-titre");
  const texte = creer("div", "entree-concept-presentation");
  const titre = creer("h2", "", "Bien plus qu'une");
  titre.id = "entree-concept-titre";
  titre.append(creer("em", "", "simple romance."));
  texte.append(
    creer("p", "entree-concept-surtitre", "Le concept"),
    titre,
    creer("p", "entree-concept-description", "Pomme d'Amour est un otome interactif qui te plonge au cœur de la vie d'Aster, un campus où se croisent ambitions, amitiés, secrets… et histoires d'amour."),
  );
  const liste = creer("ul", "entree-concept-fonctionnalites");
  [
    ["coeur", "À chacun son histoire.", "Fais connaissance avec les personnages, découvre leurs personnalités et rapproche-toi de tes coups de cœur. Tes choix influencent tes relations et te permettent de suivre les routes qui te ressemblent.", onChoix],
    ["rencontres", "Des histoires à collectionner", "Vis une aventure ponctuée de rencontres, de surprises et de rebondissements. Débloque de nouvelles illustrations avec tes crushs et rassemble tes plus beaux souvenirs au fil des épisodes.", onRencontres],
    ["livre", "Le dressing de Pommette", "Personnalise ta Pommette selon tes envies et renouvelle son style au fil de tes aventures. Après tout, une nouvelle année mérite bien quelques nouvelles tenues !", onUnivers],
  ].forEach(([pictogramme, intitule, description, action]) => {
    const ligne = creer("li");
    const bouton = creer("button", "entree-concept-fonctionnalite");
    bouton.type = "button";
    const contenu = creer("span", "entree-concept-fonctionnalite-texte");
    contenu.append(creer("span", "entree-concept-fonctionnalite-titre", intitule), creer("span", "", description));
    bouton.append(icone(pictogramme), contenu);
    bouton.addEventListener("click", action);
    ligne.append(bouton);
    liste.append(ligne);
  });
  texte.append(liste);

  const composition = creer("div", "entree-concept-composition");
  composition.append(decoration("entree-concept-ruban", "0 0 760 640", `
    <defs>
      <linearGradient id="concept-satin" x1="140" y1="110" x2="680" y2="530" gradientUnits="userSpaceOnUse">
        <stop stop-color="#570615"/><stop offset=".18" stop-color="#df3044"/>
        <stop offset=".3" stop-color="#ff9b94"/><stop offset=".42" stop-color="#9b071f"/>
        <stop offset=".65" stop-color="#46030f"/><stop offset=".82" stop-color="#dd233b"/><stop offset="1" stop-color="#6b0619"/>
      </linearGradient>
    </defs>
    <path d="M470 140C415-22 680-8 682 122S380 280 406 365 766 342 724 475 229 636 109 512 76 377 252 339"
      stroke="url(#concept-satin)" stroke-width="36"/>
    <path d="M470 122C440-23 679 2 681 122M723 465C682 596 229 626 109 503"
      stroke="#ffc7b4" stroke-opacity=".6" stroke-width="1.5"/>
    <g fill="#f3d9b6">
      <path d="m93 134 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z"/>
      <path d="m630 300 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z"/>
      <circle cx="552" cy="68" r="1.8"/><circle cx="183" cy="569" r="2"/><circle cx="716" cy="268" r="1.5"/>
    </g>
  `));
  const cadres = ["camel", "stella"].map((id) => {
    const nom = id === "camel" ? "Camel" : "Stella";
    const cadre = creer("figure", `entree-concept-portrait entree-concept-portrait-${id}`);
    const image = creer("div", "entree-concept-portrait-image");
    image.append(creer("p", "entree-concept-portrait-statut", `Chargement du portrait de ${nom}…`));
    cadre.append(image, creer("figcaption", "", nom));
    composition.append(cadre);
    return { id, nom, image };
  });
  composition.append(
    decoration("entree-concept-enveloppe", "0 0 360 240", `
      <defs>
        <linearGradient id="concept-papier" x2="0" y2="1"><stop stop-color="#fff5e7"/><stop offset="1" stop-color="#e7b698"/></linearGradient>
        <radialGradient id="concept-cire"><stop stop-color="#d1273d"/><stop offset=".65" stop-color="#a00924"/><stop offset="1" stop-color="#630719"/></radialGradient>
      </defs>
      <rect x="17" y="25" width="326" height="196" rx="8" fill="url(#concept-papier)" stroke="#d7a281" stroke-width="2"/>
      <path d="m20 215 160-118 160 118" fill="#efc7ab" stroke="#cf947b" stroke-width="2"/>
      <path d="m18 29 162 122L342 29" fill="url(#concept-papier)" stroke="#c38c74" stroke-width="2"/>
      <circle cx="180" cy="135" r="36" fill="url(#concept-cire)" stroke="#e45c65" stroke-width="2"/>
      <circle cx="180" cy="135" r="28" stroke="#f3908a" stroke-opacity=".65"/>
      <path d="M180 151c-39-22-17-44 0-25 17-19 39 3 0 25Z" fill="#960c26" stroke="#f6b2a1" stroke-width="1.5"/>
      <path d="M57 216c35-30 65-19 90-14-26 3-37 12-51 26l-18-8-27 13Z" fill="#a70a26"/>
    `),
    decoration("entree-concept-pomme", "0 0 190 290", `
      <defs>
        <linearGradient id="concept-baton" x2="1" y2="0"><stop stop-color="#bf713b"/><stop offset=".5" stop-color="#ffe2a6"/><stop offset="1" stop-color="#d49352"/></linearGradient>
        <radialGradient id="concept-sucre" cx=".35" cy=".2" r=".85"><stop stop-color="#f6464f"/><stop offset=".4" stop-color="#bf0825"/><stop offset=".8" stop-color="#8d001a"/><stop offset="1" stop-color="#460011"/></radialGradient>
        <linearGradient id="concept-noeud"><stop stop-color="#ed3b4e"/><stop offset=".45" stop-color="#a80622"/><stop offset="1" stop-color="#4f0314"/></linearGradient>
      </defs>
      <rect x="98" y="6" width="12" height="140" rx="5" transform="rotate(10 104 76)" fill="url(#concept-baton)" stroke="#f5c38b"/>
      <path d="M96 124c-47-37-89 3-77 66 8 45 38 85 77 72 39 13 70-27 78-72 12-63-31-103-78-66Z"
        fill="url(#concept-sucre)" stroke="#ed7275" stroke-width="2"/>
      <path d="M44 145c-12 8-16 23-12 38" stroke="#fff4e2" stroke-width="9" stroke-linecap="round" opacity=".8"/>
      <path d="M50 198c4 17 10 29 18 35" stroke="#f8515a" stroke-width="2" stroke-linecap="round"/>
      <path d="M97 121C42 58 26 85 40 112c12 20 33 12 57 9ZM97 121c50-65 74-43 59-15-9 22-34 20-59 15Z"
        fill="url(#concept-noeud)" stroke="#f37880"/>
      <path d="M93 123c-26 10-35 22-44 40l23-7 11 15c3-22 6-33 10-48Zm9 0c27 11 35 23 43 41l-23-8-10 15c-3-21-6-33-10-48Z"
        fill="url(#concept-noeud)" stroke="#d13548"/>
      <ellipse cx="97" cy="121" rx="11" ry="12" fill="#bd102b" stroke="#f57d80"/>
    `),
  );
  section.append(texte, composition, decoration("entree-concept-vague", "0 0 1527 150", `
    <path d="M-20 23C280 180 450 10 729 80s432-62 818-1v80H-20Z" fill="#e8a5a5" fill-opacity=".2"/>
    <path d="M-20 38C280 195 450 25 729 95s432-62 818-1v65H-20Z" fill="#4b0615"/>
    <path d="M-20 38C280 195 450 25 729 95s432-62 818-1" stroke="#c51f3a" stroke-opacity=".6" stroke-width="2"/>
  `, "none"));

  function afficherPortraits(donnees) {
    cadres.forEach(({ id, nom, image }) => {
      const personnage = donnees?.crushs?.find((p) => p.id === id);
      if (personnage?.sprite) {
        image.replaceChildren(creerImage(personnage.spritePreview || personnage.sprite, "", nom));
      } else {
        console.warn(`Portrait de ${nom} indisponible pour la section Concept.`);
        image.replaceChildren(creer("p", "entree-concept-portrait-statut", `Portrait de ${nom} momentanément indisponible.`));
      }
    });
  }
  return { section, afficherPortraits };
}
