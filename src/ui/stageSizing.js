// Le cadrage d'Isaac sert de référence, sans modifier ses proportions.
export function tailleEnCentimetres(valeur) {
  if (typeof valeur !== "string") return null;
  const texte = valeur.trim().toLowerCase();
  const metres = texte.match(/^(\d)\s*(?:m|[,.])\s*(\d{1,2})\s*(?:m)?$/);
  if (metres) return Number(metres[1]) * 100 + Number(metres[2].padEnd(2, "0"));
  const centimetres = texte.match(/^(\d{3})\s*cm$/);
  return centimetres ? Number(centimetres[1]) : null;
}

export function tailleDuPersonnage(personnage) {
  const taille = tailleEnCentimetres(personnage?.taille || personnage?.height);
  return taille > 0 ? taille : null;
}

export function imageScenePrete(image, ajustementPret) {
  return Boolean(ajustementPret && image.complete && image.naturalWidth && image.currentSrc === image.src);
}

export function ajustementScene(cadre, image, bornes, reference, taille, tailleReference) {
  const hauteurImage = Math.min(cadre.height, cadre.width * image.height / image.width);
  const hauteurReference = Math.min(cadre.height, cadre.width * reference.image.height / reference.image.width);
  const dessin = hauteurImage * (bornes.bas - bornes.haut);
  const dessinReference = hauteurReference * (reference.bornes.bas - reference.bornes.haut);
  if (!dessin || !dessinReference || !taille || !tailleReference) return null;
  const echelle = dessinReference * taille / tailleReference / dessin;
  const decalage = echelle * hauteurImage * (1 - bornes.bas)
    - hauteurReference * (1 - reference.bornes.bas);
  return { echelle, decalage };
}
