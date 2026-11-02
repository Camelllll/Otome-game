// Génère des calques PNG de DÉMONSTRATION pour Sucrette (910×1727, fond transparent).
//
// Usage : node scripts/generer-calques-demo.mjs [--force]
//
// - Aucune dépendance : l'encodeur PNG n'utilise que zlib.
// - Un fichier existant n'est jamais écrasé sans --force, pour ne pas perdre tes vrais calques
//   quand tu les déposes sous le même nom.
// - Tous les calques ont exactement les dimensions du sprite actuel : c'est ce qui garantit
//   la superposition parfaite (aucun décalage n'est géré dans le code du jeu).
import { deflateSync } from "node:zlib";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LARGEUR = 910;
const HAUTEUR = 1727;
const CX = LARGEUR / 2;
const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "Personnages", "Sucrette");
const FORCER = process.argv.includes("--force");

// ---------------------------------------------------------------------------
// Mini rasteriseur : formes remplies avec anticrénelage 2×2 et mélange alpha.
// ---------------------------------------------------------------------------
const hex = (couleur) => [1, 3, 5].map((i) => parseInt(couleur.slice(i, i + 2), 16));

class Calque {
  constructor() {
    this.pixels = new Uint8ClampedArray(LARGEUR * HAUTEUR * 4);
  }

  peindre({ boite, dedans }, couleur, opacite = 1) {
    const [r, g, b] = hex(couleur);
    const x0 = Math.max(0, Math.floor(boite[0]));
    const y0 = Math.max(0, Math.floor(boite[1]));
    const x1 = Math.min(LARGEUR - 1, Math.ceil(boite[2]));
    const y1 = Math.min(HAUTEUR - 1, Math.ceil(boite[3]));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        let n = 0;
        if (dedans(x + 0.25, y + 0.25)) n++;
        if (dedans(x + 0.75, y + 0.25)) n++;
        if (dedans(x + 0.25, y + 0.75)) n++;
        if (dedans(x + 0.75, y + 0.75)) n++;
        if (n > 0) this.melanger(x, y, r, g, b, (n / 4) * opacite);
      }
    }
  }

  // Composition « source over » en alpha non prémultiplié.
  melanger(x, y, r, g, b, a) {
    const i = (y * LARGEUR + x) * 4;
    const p = this.pixels;
    const ad = p[i + 3] / 255;
    const ao = a + ad * (1 - a);
    if (ao <= 0) return;
    p[i] = (r * a + p[i] * ad * (1 - a)) / ao;
    p[i + 1] = (g * a + p[i + 1] * ad * (1 - a)) / ao;
    p[i + 2] = (b * a + p[i + 2] * ad * (1 - a)) / ao;
    p[i + 3] = ao * 255;
  }
}

const ellipse = (cx, cy, rx, ry) => ({
  boite: [cx - rx, cy - ry, cx + rx, cy + ry],
  dedans: (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1,
});

const rectangle = (x0, y0, x1, y1) => ({
  boite: [x0, y0, x1, y1],
  dedans: (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1,
});

const capsule = (ax, ay, bx, by, r) => ({
  boite: [Math.min(ax, bx) - r, Math.min(ay, by) - r, Math.max(ax, bx) + r, Math.max(ay, by) + r],
  dedans: (x, y) => {
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) <= r;
  },
});

const polygone = (points) => ({
  boite: [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ],
  dedans: (x, y) => {
    let dedans = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
    }
    return dedans;
  },
});

const union = (...formes) => ({
  boite: [
    Math.min(...formes.map((f) => f.boite[0])),
    Math.min(...formes.map((f) => f.boite[1])),
    Math.max(...formes.map((f) => f.boite[2])),
    Math.max(...formes.map((f) => f.boite[3])),
  ],
  dedans: (x, y) => formes.some((f) => f.dedans(x, y)),
});

const sauf = (forme, ...retirees) => ({
  boite: forme.boite,
  dedans: (x, y) => forme.dedans(x, y) && !retirees.some((f) => f.dedans(x, y)),
});

const inter = (a, b) => ({
  boite: a.boite,
  dedans: (x, y) => a.dedans(x, y) && b.dedans(x, y),
});

const miroir = (points) => points.map(([x, y]) => [LARGEUR - x, y]);

// ---------------------------------------------------------------------------
// Encodeur PNG (RGBA 8 bits, sans entrelacement).
// ---------------------------------------------------------------------------
const SIGNATURE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TABLE_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(octets) {
  let c = 0xffffffff;
  for (const o of octets) c = TABLE_CRC[(c ^ o) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloc(type, donnees) {
  const nom = Buffer.from(type, "ascii");
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([nom, donnees])));
  return Buffer.concat([longueur, nom, donnees, crc]);
}

function encoderPng(pixels) {
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(LARGEUR, 0);
  entete.writeUInt32BE(HAUTEUR, 4);
  entete[8] = 8; // profondeur de bits
  entete[9] = 6; // RGBA
  const ligne = LARGEUR * 4;
  const brut = Buffer.alloc((ligne + 1) * HAUTEUR);
  for (let y = 0; y < HAUTEUR; y++) {
    brut[y * (ligne + 1)] = 0; // filtre « aucun »
    Buffer.from(pixels.buffer, y * ligne, ligne).copy(brut, y * (ligne + 1) + 1);
  }
  return Buffer.concat([
    SIGNATURE_PNG,
    bloc("IHDR", entete),
    bloc("IDAT", deflateSync(brut, { level: 6 })),
    bloc("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Dessin des calques de démonstration. Les coordonnées sont communes à tous les calques.
// ---------------------------------------------------------------------------
const PEAU = "#f7d8c6";

function corps() {
  const c = new Calque();
  // Jambes et pieds
  c.peindre(capsule(410, 1040, 405, 1500, 50), PEAU);
  c.peindre(capsule(405, 1500, 402, 1640, 36), PEAU);
  c.peindre(capsule(500, 1040, 505, 1500, 50), PEAU);
  c.peindre(capsule(505, 1500, 508, 1640, 36), PEAU);
  c.peindre(ellipse(392, 1680, 62, 26), PEAU);
  c.peindre(ellipse(518, 1680, 62, 26), PEAU);
  // Torse
  c.peindre(polygone([[345, 505], [565, 505], [545, 760], [562, 1065], [348, 1065], [365, 760]]), PEAU);
  // Bras et mains
  c.peindre(capsule(335, 535, 275, 800, 38), PEAU);
  c.peindre(capsule(275, 800, 255, 1010, 31), PEAU);
  c.peindre(ellipse(252, 1042, 30, 38), PEAU);
  c.peindre(capsule(575, 535, 635, 800, 38), PEAU);
  c.peindre(capsule(635, 800, 655, 1010, 31), PEAU);
  c.peindre(ellipse(658, 1042, 30, 38), PEAU);
  // Cou, oreilles, tête
  c.peindre(capsule(CX, 400, CX, 520, 42), PEAU);
  c.peindre(ellipse(329, 290, 16, 30), PEAU);
  c.peindre(ellipse(581, 290, 16, 30), PEAU);
  c.peindre(ellipse(CX, 270, 125, 150), PEAU);
  c.peindre(ellipse(CX, 440, 60, 24), "#eec0aa", 0.45);
  // Visage : joues, nez, bouche, sourcils (les yeux sont un calque à part)
  c.peindre(ellipse(398, 330, 26, 15), "#f4a8a8", 0.45);
  c.peindre(ellipse(512, 330, 26, 15), "#f4a8a8", 0.45);
  c.peindre(ellipse(CX, 318, 7, 5), "#e3b09c");
  c.peindre(ellipse(CX, 366, 17, 7), "#d96f86");
  c.peindre(capsule(385, 234, 435, 228, 4.5), "#7a5a4a");
  c.peindre(capsule(475, 228, 525, 234, 4.5), "#7a5a4a");
  return c;
}

const DANS_TETE = (x, y) => ((x - CX) / 142) ** 2 + ((y - 255) / 152) ** 2 <= 1;

// Frange légère et mèches qui encadrent le visage, sans cacher les yeux.
function frangeCourbe() {
  return {
    boite: [300, 95, 610, 410],
    dedans: (x, y) => {
      if (!DANS_TETE(x, y)) return false;
      const dx = Math.abs(x - CX);
      return y < 200 + 45 * (dx / 142) ** 2 || dx > 112;
    },
  };
}

function peindreCalque(forme, couleur) {
  const c = new Calque();
  c.peindre(forme, couleur);
  return c;
}

const BRUN = "#6a3f28";
const ROUX = "#c8572b";
const BLOND = "#e9c46a";

const arriereLongs = () =>
  union(ellipse(CX, 290, 165, 190), polygone([[290, 330], [620, 330], [645, 830], [600, 862], [310, 862], [265, 830]]));
const frontLongs = () => frangeCourbe();

const courbesBoucles = [[300, 450, 56], [285, 545, 58], [320, 640, 54]];
const arriereBoucles = () =>
  union(
    ellipse(CX, 285, 165, 180),
    ...courbesBoucles.flatMap(([x, y, r]) => [ellipse(x, y, r, r), ellipse(LARGEUR - x, y, r, r)]),
  );
const frontBoucles = (avecTouffe) =>
  union(
    frangeCourbe(),
    ellipse(335, 395, 38, 52),
    ellipse(LARGEUR - 335, 395, 38, 52),
    ...(avecTouffe ? [ellipse(CX, 122, 62, 48)] : []),
  );

const bordsCarre = [[300, 300], [612, 300], [628, 500], [600, 540], [310, 540], [282, 500]];
const arriereCarre = () => union(ellipse(CX, 285, 160, 180), polygone(bordsCarre));
const frontCarre = () =>
  union(
    inter(ellipse(CX, 255, 142, 152), rectangle(300, 95, 610, 226)),
    polygone([[300, 220], [350, 240], [350, 530], [292, 530]]),
    polygone(miroir([[300, 220], [350, 240], [350, 530], [292, 530]])),
  );

function yeux(iris) {
  const c = new Calque();
  for (const cx of [415, 495]) {
    c.peindre(ellipse(cx, 277, 25, 29), "#ffffff");
    c.peindre(ellipse(cx, 279, 17, 23), iris);
    c.peindre(ellipse(cx, 281, 8, 12), "#2b1b17");
    c.peindre(ellipse(cx - 6, 271, 5, 6), "#ffffff");
    c.peindre(capsule(cx - 25, 254, cx + 25, 254, 3), "#3a2620");
  }
  return c;
}

// Haut : buste + manches courtes, avec une échancrure qui laisse voir le cou.
const formeHaut = () =>
  sauf(
    union(
      polygone([[338, 500], [572, 500], [558, 905], [352, 905]]),
      capsule(335, 535, 300, 640, 44),
      capsule(575, 535, 610, 640, 44),
    ),
    ellipse(CX, 498, 52, 40),
  );

function haut(couleur, rayures = null) {
  const c = new Calque();
  const forme = formeHaut();
  c.peindre(forme, couleur);
  if (rayures) {
    for (let y = 520; y < 905; y += 44) c.peindre(inter(forme, rectangle(250, y, 660, y + 20)), rayures);
  }
  return c;
}

function pantalon(couleur, ceinture) {
  const c = new Calque();
  c.peindre(
    union(capsule(410, 1040, 405, 1560, 56), capsule(500, 1040, 505, 1560, 56), rectangle(350, 990, 560, 1070)),
    couleur,
  );
  c.peindre(rectangle(350, 990, 560, 1030), ceinture);
  c.peindre(capsule(CX, 1080, CX, 1200, 3), ceinture);
  return c;
}

function jupe(couleur, ceinture) {
  const c = new Calque();
  c.peindre(polygone([[352, 990], [558, 990], [620, 1330], [290, 1330]]), couleur);
  c.peindre(rectangle(352, 990, 558, 1030), ceinture);
  return c;
}

function robe(couleur, ceinture, pois = null) {
  const c = new Calque();
  const forme = sauf(
    union(
      polygone([[340, 500], [570, 500], [556, 780], [640, 1400], [270, 1400], [354, 780]]),
      capsule(335, 535, 300, 640, 44),
      capsule(575, 535, 610, 640, 44),
    ),
    ellipse(CX, 498, 52, 40),
  );
  c.peindre(forme, couleur);
  if (pois) {
    for (let y = 570, rang = 0; y < 1380; y += 58, rang++) {
      for (let x = 300 + (rang % 2) * 30; x < 640; x += 60) c.peindre(inter(forme, ellipse(x, y, 9, 9)), pois);
    }
  }
  c.peindre(rectangle(353, 765, 557, 795), ceinture);
  return c;
}

function collierOr() {
  const c = new Calque();
  for (let a = 10; a <= 170; a += 2) {
    const r = (a * Math.PI) / 180;
    c.peindre(ellipse(CX + 46 * Math.cos(r), 492 + 40 * Math.sin(r), 4.5, 4.5), "#e5b94a");
  }
  c.peindre(ellipse(CX, 540, 10, 13), "#f6d77a");
  c.peindre(ellipse(CX, 540, 4, 6), "#e5b94a");
  return c;
}

function rubanRose() {
  const c = new Calque();
  const by = 112;
  c.peindre(polygone([[CX, by], [CX - 62, by - 34], [CX - 62, by + 36]]), "#ff7597");
  c.peindre(polygone([[CX, by], [CX + 62, by - 34], [CX + 62, by + 36]]), "#ff7597");
  c.peindre(ellipse(CX, by, 17, 19), "#e0476e");
  return c;
}

const CALQUES = {
  "base/corps.png": corps,
  "cheveux/longs-bruns-arriere.png": () => peindreCalque(arriereLongs(), BRUN),
  "cheveux/longs-bruns.png": () => peindreCalque(frontLongs(), BRUN),
  "cheveux/boucles-roux-arriere.png": () => peindreCalque(arriereBoucles(), ROUX),
  "cheveux/boucles-roux.png": () => peindreCalque(frontBoucles(true), ROUX),
  "cheveux/boucles-roux-ruban.png": () => peindreCalque(frontBoucles(false), ROUX),
  "cheveux/carre-blond-arriere.png": () => peindreCalque(arriereCarre(), BLOND),
  "cheveux/carre-blond.png": () => peindreCalque(frontCarre(), BLOND),
  "yeux/marron.png": () => yeux("#7a4a2b"),
  "yeux/verts.png": () => yeux("#4f9d69"),
  "yeux/bleus.png": () => yeux("#4a86c8"),
  "tenues/haut-blanc.png": () => haut("#f4f1f6"),
  "tenues/haut-mariniere.png": () => haut("#fbfbfb", "#27406b"),
  "tenues/haut-rose.png": () => haut("#f8a5bd"),
  "tenues/jean-bleu.png": () => pantalon("#4e79b5", "#3b5f95"),
  "tenues/jupe-rose.png": () => jupe("#f7a8c0", "#ee86a6"),
  "tenues/robe-rose.png": () => robe("#f6a1b9", "#e0527a"),
  "tenues/robe-bleue.png": () => robe("#7fa6d9", "#3f6aa8", "#ffffff"),
  "accessoires/collier-or.png": collierOr,
  "accessoires/ruban-rose.png": rubanRose,
};

for (const [relatif, dessiner] of Object.entries(CALQUES)) {
  const chemin = join(RACINE, relatif);
  if (existsSync(chemin) && !FORCER) {
    console.log(`= ${relatif} existe déjà (ignoré, utilise --force pour le régénérer)`);
    continue;
  }
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, encoderPng(dessiner().pixels));
  console.log(`+ ${relatif}`);
}