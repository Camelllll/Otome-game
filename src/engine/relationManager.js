// Gestion des jauges de relation (Amitié / Amour) par personnage.
const JAUGE_MIN = -100;
const JAUGE_MAX = 100;

// Retourne (en la créant si besoin) la fiche de jauges d'un personnage dans la sauvegarde.
function obtenirJauges(sauvegarde, personnageId) {
  // Ne crée que les jauges effectivement utilisées, pour ne pas faire apparaître "amour" chez un perso qui n'a que l'amitié.
  if (!sauvegarde.gauges[personnageId]) {
    sauvegarde.gauges[personnageId] = {};
  }
  return sauvegarde.gauges[personnageId];
}

export function obtenirValeurJauge(sauvegarde, personnageId, nomJauge) {
  const jauges = sauvegarde.gauges[personnageId];
  return jauges ? (jauges[nomJauge] ?? 0) : 0;
}

// Applique un objet d'effets du type { personnageId: { amitie: 5, amour: -5 } } à la sauvegarde.
export function appliquerEffets(sauvegarde, effets) {
  if (!effets) return;
  for (const [personnageId, deltas] of Object.entries(effets)) {
    const jauges = obtenirJauges(sauvegarde, personnageId);
    for (const [nomJauge, delta] of Object.entries(deltas)) {
      const valeurActuelle = jauges[nomJauge] ?? 0;
      jauges[nomJauge] = Math.max(JAUGE_MIN, Math.min(JAUGE_MAX, valeurActuelle + delta));
    }
  }
}

// Convertit une valeur de jauge (-100..100) en pourcentage d'affichage pour la barre.
export function jaugeEnPourcentageAffichage(valeur) {
  return Math.round(((valeur - JAUGE_MIN) / (JAUGE_MAX - JAUGE_MIN)) * 100);
}

export { JAUGE_MIN, JAUGE_MAX };
