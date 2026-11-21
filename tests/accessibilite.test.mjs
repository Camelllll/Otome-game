import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Faux navigateur : localStorage, <html> et matchMedia suffisent au module accessibilite.js.
const stockage = new Map();
const racine = {
  style: {
    props: {},
    fontSize: "",
    setProperty(nom, valeur) {
      this.props[nom] = valeur;
    },
  },
  dataset: {},
};

globalThis.localStorage = {
  getItem: (cle) => (stockage.has(cle) ? stockage.get(cle) : null),
  setItem: (cle, valeur) => stockage.set(cle, String(valeur)),
  removeItem: (cle) => stockage.delete(cle),
};
globalThis.document = { documentElement: racine, dispatchEvent: () => true };
globalThis.CustomEvent = class {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};
globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {} }) };

// Chaque import avec un paramètre différent réévalue le module : c'est un rechargement de page.
async function rechargerModule() {
  return import(`../src/ui/accessibilite.js?rechargement=${Math.random()}`);
}

beforeEach(() => {
  stockage.clear();
  racine.style.props = {};
  racine.dataset = {};
});

test("les valeurs par défaut sont celles demandées", async () => {
  const module = await rechargerModule();
  const prefs = module.chargerPrefsA11y();
  assert.equal(prefs.textScale, 1);
  assert.equal(prefs.contrastMode, "standard");
  assert.equal(prefs.transparencyMode, "normal");
  assert.equal(prefs.comfortableReading, false);
  assert.equal(prefs.reduceMotion, false);
});

test("les préférences restent après rechargement et sont appliquées à <html>", async () => {
  let module = await rechargerModule();
  module.appliquerPrefsA11y({
    textScale: 1.5,
    contrastMode: "high",
    transparencyMode: "opaque",
    comfortableReading: true,
    reduceMotion: true,
  });

  module = await rechargerModule();
  const prefs = module.initialiserA11y();

  assert.equal(prefs.textScale, 1.5);
  assert.equal(prefs.contrastMode, "high");
  assert.equal(prefs.transparencyMode, "opaque");
  assert.equal(prefs.comfortableReading, true);
  assert.equal(prefs.reduceMotion, true);

  assert.equal(racine.style.props["--ui-text-scale"], "1.5");
  assert.equal(racine.style.props["--dialogue-background-opacity"], "1");
  assert.equal(racine.style.props["--motion-duration"], "0.01ms");
  assert.equal(racine.dataset.a11yContrast, "high");
  assert.equal(racine.dataset.a11yTransparency, "opaque");
  assert.equal(racine.dataset.a11yComfort, "on");
  assert.equal(racine.dataset.a11yMotion, "reduce");
});

test("une valeur invalide revient à une valeur sûre", async () => {
  stockage.set("pda-a11y", JSON.stringify({ version: 2, textScale: 9, contrastMode: "rose", reduceMotion: "oui" }));
  const module = await rechargerModule();
  const prefs = module.chargerPrefsA11y();
  assert.equal(prefs.textScale, 2);
  assert.equal(prefs.contrastMode, "standard");
  assert.equal(prefs.reduceMotion, false);
});

test("la taille de texte à 200 % est conservée et appliquée", async () => {
  const module = await rechargerModule();
  module.appliquerPrefsA11y({ textScale: 2 });
  assert.equal(module.chargerPrefsA11y().textScale, 2);
  assert.equal(racine.style.fontSize, "200%");
});

test("les réglages de mouvement et de cœurs restent actifs après rechargement", async () => {
  let module = await rechargerModule();
  module.appliquerPrefsA11y({ reduceMotion: true, noGlow: true, heartAnimations: "off" });
  module = await rechargerModule();
  module.initialiserA11y();
  assert.equal(racine.dataset.a11yMotion, "reduce");
  assert.equal(racine.dataset.a11yGlow, "off");
  assert.equal(racine.dataset.a11yHearts, "off");
});

test("l'ancien format (version 1) est migré", async () => {
  stockage.set("pda-a11y", JSON.stringify({ echelle: 1.3, opacite: 1 }));
  const module = await rechargerModule();
  const prefs = module.chargerPrefsA11y();
  assert.equal(prefs.textScale, 1.3);
  assert.equal(prefs.transparencyMode, "opaque");
});

test("reinitialiser efface la sauvegarde et restaure les défauts", async () => {
  const module = await rechargerModule();
  module.appliquerPrefsA11y({ textScale: 1.3 });
  const prefs = module.reinitialiserPrefsA11y();
  assert.equal(prefs.textScale, 1);
  assert.equal(stockage.has("pda-a11y"), false);
});