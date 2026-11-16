// Client HTTP de l'API Laravel (backend/). Authentification par jeton Bearer (Sanctum).
// L'URL de l'API peut être remplacée avant le chargement du jeu :
//   <script>window.OTOME_API_URL = "https://mon-domaine.fr/api";</script>
const URL_PAR_DEFAUT = "http://127.0.0.1:8001/api";
const CLE_JETON = "otome_api_token";

export const API_URL = String(globalThis.OTOME_API_URL || URL_PAR_DEFAUT).replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, statut = 0, details = null) {
    super(message);
    this.name = "ApiError";
    this.statut = statut;
    this.details = details;
  }
}

export function lireJeton() {
  try {
    return localStorage.getItem(CLE_JETON);
  } catch (erreur) {
    console.warn("Stockage local indisponible : le jeton ne sera pas conservé.", erreur);
    return null;
  }
}

export function memoriserJeton(jeton) {
  if (jeton !== lireJeton()) viderImagesPrivees();
  try {
    localStorage.setItem(CLE_JETON, jeton);
  } catch (erreur) {
    console.warn("Impossible de conserver le jeton de connexion.", erreur);
  }
}

export function oublierJeton() {
  viderImagesPrivees();
  try {
    localStorage.removeItem(CLE_JETON);
  } catch (erreur) {
    console.warn("Impossible d'effacer le jeton de connexion.", erreur);
  }
}

const imagesPrivees = new Map();
let generationImages = 0;

export function viderImagesPrivees() {
  generationImages += 1;
  for (const valeur of imagesPrivees.values()) {
    valeur.then(url => URL.revokeObjectURL(url)).catch(() => {});
  }
  imagesPrivees.clear();
}

export async function chargerImagePrivee(chemin) {
  const url = new URL(chemin, `${API_URL}/`);
  const api = new URL(API_URL);
  if (url.origin !== api.origin || !/^\/api\/illustrations\/\d+\/file$/.test(url.pathname)) {
    throw new ApiError("Cette illustration ne possède pas d’accès privé valide.");
  }
  const jeton = lireJeton();
  if (!jeton) throw new ApiError("Connecte-toi pour consulter cette illustration.", 401);
  const cle = `${jeton}:${url.href}`;
  if (imagesPrivees.has(cle)) return imagesPrivees.get(cle);
  const generation = generationImages;
  const chargement = (async () => {
    let reponse;
    try {
      reponse = await fetch(url.href, { headers: { Authorization: `Bearer ${jeton}`, Accept: "image/*" }, cache: "no-store" });
    } catch (erreur) {
      throw new ApiError("Impossible de charger l’illustration. Vérifie ta connexion.", 0, erreur);
    }
    if (!reponse.ok) throw new ApiError("Illustration indisponible ou non débloquée.", reponse.status);
    const blob = await reponse.blob();
    if (generation !== generationImages || jeton !== lireJeton()) throw new ApiError("La session a changé.", 401);
    return URL.createObjectURL(blob);
  })();
  imagesPrivees.set(cle, chargement);
  try {
    return await chargement;
  } catch (erreur) {
    imagesPrivees.delete(cle);
    throw erreur;
  }
}

// Extrait un message lisible d'une réponse d'erreur Laravel ({ message, errors }).
function messageDepuisReponse(donnees, statut) {
  if (donnees?.errors && typeof donnees.errors === "object") {
    const premier = Object.values(donnees.errors).flat()[0];
    if (premier) return String(premier);
  }
  if (donnees?.message) return String(donnees.message);
  return `Erreur serveur (${statut}).`;
}

// Appelle l'API. `authentifie: false` pour le contenu public et les routes de connexion.
export async function appelApi(chemin, { method = "GET", corps, authentifie = true } = {}) {
  const entetes = { Accept: "application/json" };
  if (corps !== undefined) entetes["Content-Type"] = "application/json";

  if (authentifie) {
    const jeton = lireJeton();
    if (jeton) entetes.Authorization = `Bearer ${jeton}`;
  }

  let reponse;
  try {
    reponse = await fetch(`${API_URL}${chemin}`, {
      method,
      headers: entetes,
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
  } catch (erreur) {
    throw new ApiError("Serveur injoignable. Vérifie ta connexion et que l'API est démarrée.", 0, erreur);
  }

  let donnees = null;
  const texte = await reponse.text();
  if (texte) {
    try {
      donnees = JSON.parse(texte);
    } catch {
      donnees = null;
    }
  }

  if (!reponse.ok) {
    // Jeton expiré ou révoqué : on l'oublie pour repasser par l'écran de connexion.
    if (reponse.status === 401 && authentifie) oublierJeton();
    throw new ApiError(messageDepuisReponse(donnees, reponse.status), reponse.status, donnees);
  }

  return donnees;
}