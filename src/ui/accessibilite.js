/**
 * accessibilite.js : préférences d'accessibilité du jeu.
 *
 * Un seul objet de réglages, enregistré dans localStorage (clé "pda-a11y") et appliqué à <html>
 * sous forme de variables CSS (--ui-text-scale, --dialogue-background-opacity, ...) et d'attributs
 * data-a11y-*. Les feuilles de style (styles/accessibilite.css) réagissent à ces attributs.
 *
 * Les changements sont annoncés par l'événement "pda:a11y-change" sur document, ce qui permet
 * à un autre module (par exemple la synchronisation avec le profil joueur) de les écouter.
 */

const CLE_STOCKAGE = "pda-a11y";
const VERSION = 2;

export const EVENEMENT_A11Y = "pda:a11y-change";

export const PALIERS_TEXTE = Object.freeze([
  { valeur: 1, libelle: "Standard", pourcentage: 100 },
  { valeur: 1.15, libelle: "Confort", pourcentage: 115 },
  { valeur: 1.3, libelle: "Grand", pourcentage: 130 },
  { valeur: 1.5, libelle: "Très grand", pourcentage: 150 },
  { valeur: 1.75, libelle: "Très grand +", pourcentage: 175 },
  { valeur: 2, libelle: "Maximum", pourcentage: 200 },
]);

export const MODES_CONTRASTE = Object.freeze([
  { valeur: "standard", libelle: "Standard", description: "L'apparence habituelle du jeu." },
  { valeur: "enhanced", libelle: "Contraste renforcé", description: "Texte plus foncé, fonds plus clairs, bordures visibles." },
  { valeur: "high", libelle: "Contraste élevé", description: "Fond blanc, texte noir, bordures épaisses, boutons très distincts." },
]);

export const MODES_TRANSPARENCE = Object.freeze([
  { valeur: "normal", libelle: "Transparence normale", opacite: 0.85 },
  { valeur: "reduced", libelle: "Transparence réduite", opacite: 0.95 },
  { valeur: "opaque", libelle: "Fonds opaques", opacite: 1 },
]);

export const MODES_COEURS = Object.freeze([
  { valeur: "full", libelle: "Animations complètes" },
  { valeur: "reduced", libelle: "Animations réduites" },
  { valeur: "off", libelle: "Pas d'animation" },
]);

const DEFAUTS_FIXES = Object.freeze({
  textScale: 1,
  contrastMode: "standard",
  transparencyMode: "normal",
  comfortableReading: false,
  reduceMotion: false,
  noGlow: false,
  calmDecor: false,
  heartAnimations: "full",
});

function mouvementReduitSysteme() {
  try {
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  } catch (_) {
    return false;
  }
}

/** Valeurs par défaut. Le mouvement réduit suit le réglage du système tant que le joueur n'a rien choisi. */
function defauts() {
  return { ...DEFAUTS_FIXES, reduceMotion: mouvementReduitSysteme() };
}

function paletProche(valeur, repli) {
  if (typeof valeur !== "number" || !Number.isFinite(valeur)) return repli;
  return PALIERS_TEXTE.reduce(
    (meilleur, palier) => (Math.abs(palier.valeur - valeur) < Math.abs(meilleur.valeur - valeur) ? palier : meilleur),
  ).valeur;
}

function choisir(valeur, autorises, repli) {
  return autorises.some((o) => o.valeur === valeur) ? valeur : repli;
}

function booleen(valeur, repli) {
  return typeof valeur === "boolean" ? valeur : repli;
}

function normaliser(brut, base) {
  const src = brut && typeof brut === "object" ? brut : {};
  return {
    textScale: paletProche(src.textScale, base.textScale),
    contrastMode: choisir(src.contrastMode, MODES_CONTRASTE, base.contrastMode),
    transparencyMode: choisir(src.transparencyMode, MODES_TRANSPARENCE, base.transparencyMode),
    comfortableReading: booleen(src.comfortableReading, base.comfortableReading),
    reduceMotion: booleen(src.reduceMotion, base.reduceMotion),
    noGlow: booleen(src.noGlow, base.noGlow),
    calmDecor: booleen(src.calmDecor, base.calmDecor),
    heartAnimations: choisir(src.heartAnimations, MODES_COEURS, base.heartAnimations),
  };
}

/** Ancien format (version 1) : { echelle, opacite }. */
function migrer(parse) {
  if (!parse || typeof parse !== "object" || parse.version === VERSION) return parse;
  const migre = {};
  if (typeof parse.echelle === "number") migre.textScale = parse.echelle;
  if (typeof parse.opacite === "number") migre.transparencyMode = parse.opacite >= 1 ? "opaque" : "normal";
  return migre;
}

function aPrefsEnregistrees() {
  try {
    return localStorage.getItem(CLE_STOCKAGE) !== null;
  } catch (_) {
    return false;
  }
}

/**
 * Charge les préférences (localStorage), ou les valeurs par défaut.
 * @returns {{ textScale: number, contrastMode: string, transparencyMode: string, comfortableReading: boolean,
 *   reduceMotion: boolean, noGlow: boolean, calmDecor: boolean, heartAnimations: string }}
 */
export function chargerPrefsA11y() {
  const base = defauts();
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE);
    if (brut) return normaliser(migrer(JSON.parse(brut)), base);
  } catch (_) { /* stockage indisponible ou JSON invalide : valeurs par défaut */ }
  return base;
}

function appliquerAuDocument(prefs) {
  const racine = document.documentElement;
  const transparence = MODES_TRANSPARENCE.find((m) => m.valeur === prefs.transparencyMode) ?? MODES_TRANSPARENCE[0];
  const echelle = prefs.textScale;

  // Les règles du jeu sont en rem : agrandir la racine agrandit tout le texte.
  racine.style.fontSize = `${Math.round(echelle * 100)}%`;
  racine.style.setProperty("--ui-text-scale", String(echelle));
  racine.style.setProperty("--dialogue-background-opacity", String(transparence.opacite));
  racine.style.setProperty("--motion-duration", prefs.reduceMotion ? "0.01ms" : "0.2s");
  // Anciens noms de variables, encore lus par style.css.
  racine.style.setProperty("--a11y-echelle-texte", String(echelle));
  racine.style.setProperty("--a11y-opacite-bulle", String(transparence.opacite));

  racine.dataset.a11yText = echelle >= 1.5 ? "xl" : echelle > 1 ? "plus" : "standard";
  racine.dataset.a11yContrast = prefs.contrastMode;
  racine.dataset.a11yTransparency = prefs.transparencyMode;
  racine.dataset.a11yComfort = prefs.comfortableReading ? "on" : "off";
  racine.dataset.a11yMotion = prefs.reduceMotion ? "reduce" : "full";
  racine.dataset.a11yGlow = prefs.noGlow ? "off" : "on";
  racine.dataset.a11yDecor = prefs.calmDecor ? "calm" : "full";
  racine.dataset.a11yHearts = prefs.heartAnimations;
}

function annoncer(prefs) {
  document.dispatchEvent(new CustomEvent(EVENEMENT_A11Y, { detail: { ...prefs } }));
}

/**
 * Fusionne, valide, enregistre et applique immédiatement les préférences.
 * @param {Partial<ReturnType<typeof chargerPrefsA11y>>} partiel
 */
export function appliquerPrefsA11y(partiel = {}) {
  const actuelles = chargerPrefsA11y();
  const prefs = normaliser({ ...actuelles, ...partiel }, actuelles);
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify({ version: VERSION, ...prefs }));
  } catch (_) { /* stockage plein ou bloqué : le réglage reste appliqué pour la session */ }
  appliquerAuDocument(prefs);
  annoncer(prefs);
  return prefs;
}

/** Efface les préférences enregistrées et revient aux valeurs par défaut. */
export function reinitialiserPrefsA11y() {
  try {
    localStorage.removeItem(CLE_STOCKAGE);
  } catch (_) { /* ignoré */ }
  const prefs = defauts();
  appliquerAuDocument(prefs);
  annoncer(prefs);
  return prefs;
}

/** À appeler une fois au démarrage : restaure les préférences et suit le réglage système de mouvement. */
export function initialiserA11y() {
  const prefs = chargerPrefsA11y();
  appliquerAuDocument(prefs);
  try {
    const requete = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    requete?.addEventListener?.("change", () => {
      if (!aPrefsEnregistrees()) {
        const suivantes = chargerPrefsA11y();
        appliquerAuDocument(suivantes);
        annoncer(suivantes);
      }
    });
  } catch (_) { /* matchMedia indisponible */ }
  return prefs;
}