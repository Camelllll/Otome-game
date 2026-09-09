// Corrige un bug Vercel : les fichiers dont le nom contient un "+" (ex: "Camel + sucrette.png")
// renvoient une erreur 404 une fois déployés (le "+" casse la résolution du chemin par le CDN),
// alors qu'ils s'affichaient normalement en local. Les fichiers ont été renommés sur disque
// (" + " → " et ") ; ce script met à jour les chemins correspondants stockés en base Supabase
// (colonnes jsonb `episodes.data` et `characters.data`, source de vérité utilisée par le jeu en ligne).
//
// Usage :
//   node scripts/fix-plus-in-asset-paths.mjs --db     # patch la base (identifiants admin demandés)
//   node scripts/fix-plus-in-asset-paths.mjs --check  # liste les lignes encore concernées, sans écrire
//
// Le script est idempotent : on peut le relancer sans risque (aucune ligne ne matche une 2e fois).

import { createInterface } from "node:readline/promises";

const SUPABASE_URL = "https://pnprcoithzjpdwzoglea.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_lfm21jd95NwouDQQZWIdCw_JFSfGWGn";

// Chemins renommés (ancien → nouveau), un par fichier concerné.
const RENOMMAGES = [
  [
    "assets/Illustrations/Episode 2/Illustration 3 - Camel + sucrette.png",
    "assets/Illustrations/Episode 2/Illustration 3 - Camel et sucrette.png",
  ],
  [
    "assets/Illustrations/Episode 2/Illustration 3 - Mehdi + sucrette.jpg",
    "assets/Illustrations/Episode 2/Illustration 3 - Mehdi et sucrette.jpg",
  ],
  [
    "assets/Illustrations/Episode 2/Illustration 3 - Sasha + sucrette.png",
    "assets/Illustrations/Episode 2/Illustration 3 - Sasha et sucrette.png",
  ],
  [
    "assets/Illustrations/Épisode 3/Illustration 3 - Mehdi + sucrette.JPG",
    "assets/Illustrations/Épisode 3/Illustration 3 - Mehdi et sucrette.JPG",
  ],
  [
    "assets/Illustrations/Épisode 3/Illustration 4 - Camel + sucrette.png",
    "assets/Illustrations/Épisode 3/Illustration 4 - Camel et sucrette.png",
  ],
  [
    "assets/Illustrations/Épisode 3/Illustration 5 - Sasha + sucrette.JPG",
    "assets/Illustrations/Épisode 3/Illustration 5 - Sasha et sucrette.JPG",
  ],
  [
    "assets/Illustrations/Épisode 4/Illustration 1 - Stella + sucrette.png",
    "assets/Illustrations/Épisode 4/Illustration 1 - Stella et sucrette.png",
  ],
  [
    "assets/Illustrations/Épisode 4/Illustration 2 - Sasha + sucrette.png",
    "assets/Illustrations/Épisode 4/Illustration 2 - Sasha et sucrette.png",
  ],
  [
    "assets/Illustrations/Épisode 4/Illustration 3 - Aaron + sucrette.png",
    "assets/Illustrations/Épisode 4/Illustration 3 - Aaron et sucrette.png",
  ],
  [
    "assets/Illustrations/Épisode 4/Illustration 4 - Camel + sucrette.png",
    "assets/Illustrations/Épisode 4/Illustration 4 - Camel et sucrette.png",
  ],
  [
    "assets/Illustrations/Épisode 4/Illustration 4 - Mehdi + sucrette.png",
    "assets/Illustrations/Épisode 4/Illustration 4 - Mehdi et sucrette.png",
  ],
];

function remplacerDansTexte(texteJson) {
  let resultat = texteJson;
  let nbRemplacements = 0;
  for (const [ancien, nouveau] of RENOMMAGES) {
    // Les chemins sont sérialisés en JSON : on remplace la sous-chaîne littérale (pas de regex nécessaire).
    if (resultat.includes(ancien)) {
      resultat = resultat.split(ancien).join(nouveau);
      nbRemplacements += 1;
    }
  }
  return { resultat, nbRemplacements };
}

async function authentifier() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const email = await rl.question("E-mail admin : ");
  const motDePasse = await rl.question("Mot de passe admin : ");
  rl.close();

  const reponseAuth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: motDePasse }),
  });
  if (!reponseAuth.ok) {
    throw new Error(`Connexion refusée (${reponseAuth.status}) : ${await reponseAuth.text()}`);
  }
  const { access_token: jeton } = await reponseAuth.json();
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${jeton}`,
    "Content-Type": "application/json",
  };
}

async function corrigerTable(entetes, { table, colonneId, dryRun }) {
  const reponse = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${colonneId},data`, {
    headers: entetes || { apikey: SUPABASE_PUBLISHABLE_KEY },
  });
  if (!reponse.ok) throw new Error(`Lecture ${table} refusée (${reponse.status}) : ${await reponse.text()}`);
  const lignes = await reponse.json();

  let totalLignesTouchees = 0;
  for (const ligne of lignes) {
    const texteOriginal = JSON.stringify(ligne.data);
    const { resultat, nbRemplacements } = remplacerDansTexte(texteOriginal);
    if (nbRemplacements === 0) continue;
    totalLignesTouchees += 1;
    console.log(`   - ${table}[${colonneId}=${ligne[colonneId]}] : ${nbRemplacements} chemin(s) corrigé(s)`);
    if (dryRun) continue;

    const reponseMaj = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${colonneId}=eq.${encodeURIComponent(ligne[colonneId])}`, {
      method: "PATCH",
      headers: entetes,
      body: JSON.stringify({ data: JSON.parse(resultat) }),
    });
    if (!reponseMaj.ok) {
      throw new Error(`Écriture ${table}[${colonneId}=${ligne[colonneId]}] refusée (${reponseMaj.status}) : ${await reponseMaj.text()}`);
    }
  }
  return totalLignesTouchees;
}

async function main() {
  const dryRun = process.argv.includes("--check");
  if (!dryRun && !process.argv.includes("--db")) {
    console.log("Usage : node scripts/fix-plus-in-asset-paths.mjs --db | --check");
    process.exit(1);
  }

  const entetes = dryRun ? null : await authentifier();

  console.log(dryRun ? "🔎 Vérification (aucune écriture) :" : "✏️  Correction en base :");
  const nbEpisodes = await corrigerTable(entetes, { table: "episodes", colonneId: "id", dryRun });
  const nbPersonnages = await corrigerTable(entetes, { table: "characters", colonneId: "id", dryRun });

  console.log(`\n${dryRun ? "À corriger" : "Corrigés"} : ${nbEpisodes} épisode(s), ${nbPersonnages} personnage(s).`);
}

main().catch((erreur) => {
  console.error("❌", erreur.message);
  process.exit(1);
});
