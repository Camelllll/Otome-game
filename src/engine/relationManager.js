// Gestion des jauges de relation (Amitié / Amour) par personnage.
// Les jauges sont directement exprimées en pourcentage : un effet de +5 ajoute 5 % au lovomètre, un effet de -5 descend à -5 %.
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

// La jauge est déjà un pourcentage : on se contente de la borner (anciennes sauvegardes comprises).
export function jaugeEnPourcentageAffichage(valeur) {
  return Math.round(Math.max(JAUGE_MIN, Math.min(JAUGE_MAX, valeur ?? 0)));
}

// Enregistre des marqueurs de choix (ex. "liam_pause") dans la sauvegarde :
// ils servent aux nœuds "branch" pour aiguiller l'histoire selon les réponses passées.
export function poserFlags(sauvegarde, flags) {
  if (!Array.isArray(flags) || !flags.length) return;
  sauvegarde.flags ||= [];
  for (const flag of flags) {
    if (flag && !sauvegarde.flags.includes(flag)) sauvegarde.flags.push(flag);
  }
}

// Résout un nœud "branch" (aiguillage invisible) : la première condition remplie gagne,
// sinon on prend le fallback. Conditions supportées :
// - { flag: "..." } : vrai si le marqueur a été posé par un choix précédent.
// - { topGauge: { gauge, routes } } : suit la route du personnage dont la jauge est la plus
//   haute (ex. le lovomètre "amour"). En cas d'égalité, tirage au sort parmi les ex æquo.
export function resoudreBranche(noeud, sauvegarde) {
  for (const branche of noeud.branches || []) {
    const condition = branche.if;
    if (!condition) {
      if (branche.next) return branche.next;
      continue;
    }
    if (condition.flag) {
      if ((sauvegarde.flags || []).includes(condition.flag)) return branche.next;
      continue;
    }
    if (condition.topGauge) {
      const { gauge = "amour", routes = {} } = condition.topGauge;
      const candidats = Object.keys(routes);
      if (!candidats.length) continue;
      const valeurs = candidats.map((id) => sauvegarde.gauges[id]?.[gauge] ?? 0);
      const max = Math.max(...valeurs);
      const exAequo = candidats.filter((id, index) => valeurs[index] === max);
      const choisi = exAequo[Math.floor(Math.random() * exAequo.length)];
      return routes[choisi];
    }
  }
  return noeud.fallback || null;
}

export { JAUGE_MIN, JAUGE_MAX };
