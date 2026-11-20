// Rendu de Pommette par calques PNG superposés. Un conteneur, une <img> par calque.
// Tous les calques ont les dimensions du sprite de base et sont placés en `inset: 0` en pourcentage :
// l'alignement reste donc identique à toutes les tailles d'écran. Aucune image fusionnée n'est produite.
import { urlMedia } from "../services/mediaDelivery.js";

function afficherSource(img, src) {
  img.style.visibility = "";
  img.src = src;
}

function creerImage(calque, lazy = false) {
  const img = document.createElement("img");
  img.className = "calque-pommette";
  img.dataset.slot = calque.slot;
  img.alt = "";
  img.draggable = false;
  img.decoding = "async";
  img.loading = lazy ? "lazy" : "eager";
  img.style.zIndex = String(calque.z);
  // Un calque introuvable ne doit pas afficher d'icône d'image cassée.
  img.addEventListener("error", () => {
    img.style.visibility = "hidden";
    console.warn(`Calque introuvable : ${img.getAttribute("src")}`);
  });
  afficherSource(img, calque.src);
  return img;
}

function precharger(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = resolve;
    image.src = src;
  });
}

const jetons = new WeakMap();

/**
 * Construit le conteneur de calques (synchrone).
 * @param {Array<{slot: string, z: number, src: string}>} calques - liste issue de resoudreCalques.
 * @param {{width: number, height: number}} canvas - dimensions du sprite de base.
 * @param {{etiquette?: string}} options - texte alternatif ; vide = purement décoratif.
 */
export function creerAvatarPommette(calques, canvas, { etiquette = "Pommette", lazy = false } = {}) {
  const pile = document.createElement("div");
  pile.className = "pommette-calques";
  if (canvas?.width && canvas?.height) pile.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
  if (etiquette) {
    pile.setAttribute("role", "img");
    pile.setAttribute("aria-label", etiquette);
  } else {
    pile.setAttribute("aria-hidden", "true");
  }
  for (const calque of calques) pile.appendChild(creerImage(calque, lazy));
  return pile;
}

/**
 * Met à jour la pile par différence : seuls les calques modifiés sont touchés. Les nouvelles images sont
 * préchargées avant l'échange, pour éviter tout clignotement. Une mise à jour plus récente annule la précédente.
 */
export async function mettreAJourAvatar(pile, calques) {
  const jeton = (jetons.get(pile) || 0) + 1;
  jetons.set(pile, jeton);

  const existants = new Map([...pile.children].map((img) => [img.dataset.slot, img]));
  const aCharger = calques.filter((calque) => existants.get(calque.slot)?.getAttribute("src") !== calque.src);
  await Promise.all(aCharger.map((calque) => precharger(calque.src)));
  if (jetons.get(pile) !== jeton) return;

  const voulus = new Set(calques.map((calque) => calque.slot));
  for (const [slot, img] of existants) {
    if (!voulus.has(slot)) img.remove();
  }
  for (const calque of calques) {
    let img = existants.get(calque.slot);
    if (!img) {
      pile.appendChild(creerImage(calque));
      continue;
    }
    if (img.getAttribute("src") !== calque.src) afficherSource(img, calque.src);
    img.style.zIndex = String(calque.z);
  }
}

/**
 * Miniature carrée : la même pile de calques, recadrée sur une zone du sprite.
 * @param {{x: number, y: number, w: number}} focus - centre (x, y) et largeur visible (w), en fractions du sprite.
 */
export function creerMiniature(calques, canvas, focus) {
  const cadre = document.createElement("span");
  cadre.className = "miniature-pommette";
  const pile = creerAvatarPommette(calques.map(calque => ({ ...calque, src: urlMedia(calque.src, { miniature: true }) })), canvas, { etiquette: "", lazy: true });
  const largeur = 100 / focus.w;
  const rapport = canvas.height / canvas.width;
  pile.style.width = `${largeur}%`;
  pile.style.left = `${50 - focus.x * largeur}%`;
  pile.style.top = `${50 - focus.y * largeur * rapport}%`;
  cadre.appendChild(pile);
  return cadre;
}