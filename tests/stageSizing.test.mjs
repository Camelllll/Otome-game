import test from "node:test";
import assert from "node:assert/strict";
import { ajustementScene, imageScenePrete, tailleDuPersonnage, tailleEnCentimetres } from "../src/ui/stageSizing.js";

test("la taille éditée en mètres ou centimètres est interprétée sans inventer de valeur", () => {
  assert.equal(tailleEnCentimetres("1m58"), 158);
  assert.equal(tailleEnCentimetres("1,80 m"), 180);
  assert.equal(tailleEnCentimetres("192 cm"), 192);
  assert.equal(tailleEnCentimetres(""), null);
  assert.equal(tailleEnCentimetres("grande"), null);
});

test("une image ne devient visible qu'une fois la bonne source et sa taille prêtes", () => {
  const image = { src: "nouveau", currentSrc: "ancien", complete: true, naturalWidth: 100 };
  assert.equal(imageScenePrete(image, true), false);
  image.currentSrc = "nouveau";
  assert.equal(imageScenePrete(image, false), false);
  assert.equal(imageScenePrete(image, true), true);
  image.complete = false;
  assert.equal(imageScenePrete(image, true), false);
  image.complete = true;
  image.naturalWidth = 0;
  assert.equal(imageScenePrete(image, true), false);
});

test("toute fiche utilise en priorité sa taille éditée, sans inventer de taille absente", () => {
  assert.equal(tailleDuPersonnage({ id: "nouveau", taille: "1m65", height: "1m80" }), 165);
  assert.equal(tailleDuPersonnage({ id: "autre", height: "1m72" }), 172);
  assert.equal(tailleDuPersonnage({ id: "sans-taille" }), null);
  assert.equal(tailleDuPersonnage({ taille: "inconnue", height: "1m80" }), null);
  assert.equal(tailleDuPersonnage({ taille: "0m00" }), null);
});

test("les dessins de cadrages différents respectent les tailles et partagent la même ligne de pied", () => {
  const cadre = { width: 460, height: 792 };
  const reference = { image: { width: 3500, height: 6500 }, bornes: { haut: 500 / 6500, bas: 6016 / 6500 } };
  for (const [image, bornes, taille] of [
    [reference.image, reference.bornes, 180],
    [{ width: 3000, height: 6000 }, { haut: 202 / 6000, bas: 5823 / 6000 }, 192],
    [{ width: 941, height: 1672 }, { haut: 48 / 1672, bas: 1632 / 1672 }, 158],
  ]) {
    const { echelle, decalage } = ajustementScene(cadre, image, bornes, reference, taille, 180);
    const hauteur = Math.min(cadre.height, cadre.width * image.height / image.width);
    const hauteurRef = Math.min(cadre.height, cadre.width * reference.image.height / reference.image.width);
    const dessin = hauteur * (bornes.bas - bornes.haut) * echelle;
    const dessinRef = hauteurRef * (reference.bornes.bas - reference.bornes.haut);
    assert.ok(Math.abs(dessin / dessinRef - taille / 180) < 1e-10);
    assert.ok(Math.abs(decalage - hauteur * (1 - bornes.bas) * echelle + hauteurRef * (1 - reference.bornes.bas)) < 1e-10);
  }
});
