export function connexionEconome() {
  const connexion = globalThis.navigator?.connection;
  return Boolean(connexion?.saveData
    || ["slow-2g", "2g", "3g"].includes(connexion?.effectiveType)
    || (typeof connexion?.downlink === "number" && connexion.downlink < 1.5));
}

export function urlMedia(source, { miniature = false, pleineResolution = false } = {}) {
  if (typeof source !== "string" || (!miniature && !pleineResolution && !connexionEconome())) return source;
  if (!/^(?:https?:\/\/[^/]+)?\/api\/(?:media|illustrations)\/\d+\//.test(source)) return source;
  const url = new URL(source, globalThis.location?.href || "http://localhost/");
  if (!/^\/api\/(?:media\/\d+\/(?:file|sprite|preview)|illustrations\/\d+\/file)$/.test(url.pathname)) return source;
  if (pleineResolution) url.searchParams.set("size", "display");
  else if (miniature || !url.searchParams.has("size")) url.searchParams.set("size", miniature ? "thumbnail" : "compact");
  return url.href;
}

export function adapterMedias(donnees) {
  if (Array.isArray(donnees)) return donnees.map(adapterMedias);
  if (!donnees || typeof donnees !== "object") return donnees;
  return Object.fromEntries(Object.entries(donnees).map(([cle, valeur]) => [
    cle,
    typeof valeur === "string" ? urlMedia(valeur) : adapterMedias(valeur),
  ]));
}
