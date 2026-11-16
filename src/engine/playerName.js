export function normaliserNomJoueur(nom) {
  const texte = typeof nom === "string" ? nom.trim() : "";
  // Les anciennes parties peuvent encore contenir le nom par défaut de la première version.
  return !texte || /^sucrette$/i.test(texte) ? "Pommette" : texte;
}

export function remplacerAncienNom(texte, nom = "Pommette") {
  return texte.replace(/\bsucrette\b/gi, () => nom);
}
