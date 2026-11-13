// Coordonnées normalisées mesurées sur les PNG du catalogue 600 × 1200.
// Une transformation unique porte la pile entière, jamais les calques individuels.
export const CADRAGES_DRESSING = Object.freeze({
  tenue: { x: 0.48, y: 0.5, hauteur: 1 },
  hair: { x: 0.443, y: 0.205, hauteur: 0.38 },
  face: { x: 0.475, y: 0.157, hauteur: 0.24 },
  eyes: { x: 0.472, y: 0.151, hauteur: 0.12 },
  eyebrows: { x: 0.463, y: 0.142, hauteur: 0.12 },
  mouth: { x: 0.489, y: 0.175, hauteur: 0.1 },
  accessory: { x: 0.48, y: 0.3, hauteur: 0.65 },
  jewelry: { x: 0.48, y: 0.24, hauteur: 0.4 },
});

export function calculerCadrage(canvas, cadre, focus, zoom = 1) {
  const echelle = Math.min(
    cadre.width * 0.92 / (canvas.width * Math.min(1, focus.hauteur * 2)),
    cadre.height * 0.98 / (canvas.height * focus.hauteur),
  ) * zoom;
  return {
    echelle,
    x: cadre.width / 2 - focus.x * canvas.width * echelle,
    y: cadre.height / 2 - focus.y * canvas.height * echelle,
  };
}

export function creerZoomDressing(cadre, pile, canvas, { onChanger } = {}) {
  let categorie = "tenue";
  let focus = CADRAGES_DRESSING.tenue;
  let zoom = 1;
  let detruit = false;
  let observateur;

  function afficher() {
    if (detruit) return;
    const dimensions = cadre.getBoundingClientRect();
    if (!dimensions.width || !dimensions.height) return;
    const vue = calculerCadrage(canvas, dimensions, focus, zoom);
    pile.style.transform = `translate(${vue.x}px, ${vue.y}px) scale(${vue.echelle})`;
    pile.dataset.cadrage = categorie;
    pile.dataset.zoom = String(zoom);
    onChanger?.({ zoom, categorie });
  }

  function cadrer(id, focusElement) {
    categorie = id;
    focus = focusElement || CADRAGES_DRESSING[id] || CADRAGES_DRESSING.tenue;
    zoom = 1;
    afficher();
  }

  observateur = new ResizeObserver(() => {
    if (!cadre.isConnected) {
      detruire();
      return;
    }
    afficher();
  });
  observateur.observe(cadre);

  function detruire() {
    detruit = true;
    observateur.disconnect();
  }

  return {
    cadrer,
    agrandir() { zoom = Math.min(2, Math.round((zoom + 0.2) * 10) / 10); afficher(); },
    reduire() { zoom = Math.max(0.6, Math.round((zoom - 0.2) * 10) / 10); afficher(); },
    reinitialiser() { zoom = 1; afficher(); },
    vueComplete() { cadrer("tenue"); },
    detruire,
  };
}
