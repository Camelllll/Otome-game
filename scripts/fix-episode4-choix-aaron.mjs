// Réparation épisode 4 : restauration du choix supprimé après
// « (Je ne m'attendais pas à ce qu'il soit aussi honnête.) » (n315).
//
// Le choix (speaker "moi") avait été supprimé du BackOffice, laissant n315.next vide
// (jeu bloqué) et les branches n316 / n317 / n321 orphelines. Ce script recrée le choix
// avec les 3 réponses d'origine et relie n315 → ce choix.
//
// Usage :
//   node scripts/fix-episode4-choix-aaron.mjs --local   # patch data/episodes/episode4.json
//   node scripts/fix-episode4-choix-aaron.mjs --db      # patch la base (identifiants admin demandés)
//   node scripts/fix-episode4-choix-aaron.mjs --test    # vérifie la réparation sur le JSON local

import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { resoudreBranche } from "../src/engine/relationManager.js";

const SUPABASE_URL = "https://pnprcoithzjpdwzoglea.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_lfm21jd95NwouDQQZWIdCw_JFSfGWGn";
const FICHIER_LOCAL = new URL("../data/episodes/episode4.json", import.meta.url);

const ID_CHOIX = "n1186";

// Les 3 réponses d'origine (texte exact fourni), reliées à leurs branches respectives.
function construireChoix() {
  return {
    type: "choice",
    speaker: "moi",
    options: [
      {
        text: "Moi non plus, tu sais… Comme ça, on est deux.",
        next: "n316",
        effects: { aaron: { amour: 0 } },
      },
      {
        text: "Tu peux rester là, ça ne me gêne pas.",
        next: "n317",
        effects: { aaron: { amour: 10 } },
      },
      {
        text: "Ne sois pas gêné, ce n’est rien.",
        next: "n321",
        effects: { aaron: { amour: -5 } },
      },
    ],
  };
}

function reparer(episode) {
  const nodes = episode.nodes || {};
  const corrections = [];

  if (!nodes.n315) {
    console.warn("⚠️  n315 introuvable.");
    return corrections;
  }
  nodes[ID_CHOIX] = construireChoix();
  nodes.n315.next = ID_CHOIX;
  corrections.push(`n315 : next → ${ID_CHOIX}`);
  corrections.push(`${ID_CHOIX} : choix recréé (3 réponses, branches n316 / n317 / n321)`);
  return corrections;
}

async function patchLocal() {
  const episode = JSON.parse(readFileSync(FICHIER_LOCAL, "utf8"));
  const corrections = reparer(episode);
  writeFileSync(FICHIER_LOCAL, JSON.stringify(episode, null, 2) + "\n");
  console.log(`✅ ${corrections.length} corrections appliquées au JSON local :`);
  corrections.forEach((c) => console.log(`   - ${c}`));
}

async function patchBase() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const email = await rl.question("E-mail admin : ");
  const motDePasse = await rl.question("Mot de passe admin : ");
  rl.close();

  const reponseAuth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: motDePasse }),
  });
  if (!reponseAuth.ok) throw new Error(`Connexion refusée (${reponseAuth.status}) : ${await reponseAuth.text()}`);
  const { access_token: jeton } = await reponseAuth.json();
  const entetes = { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" };

  const reponseLecture = await fetch(`${SUPABASE_URL}/rest/v1/episodes?id=eq.episode4&select=id,title,status,data`, { headers: entetes });
  const lignes = await reponseLecture.json();
  const episode = lignes?.[0];
  if (!episode) throw new Error("Épisode 4 introuvable en base.");

  // Déballe d'éventuelles imbrications résiduelles pour retrouver l'objet épisode.
  let donneesEpisode = episode.data;
  let gardes = 0;
  while (donneesEpisode && !donneesEpisode.nodes && gardes < 5) {
    donneesEpisode = Array.isArray(donneesEpisode) ? donneesEpisode[0]?.data : donneesEpisode.data;
    gardes += 1;
  }
  if (!donneesEpisode?.nodes) {
    console.warn("⚠️  data corrompue, restauration depuis le JSON local.");
    donneesEpisode = JSON.parse(readFileSync(FICHIER_LOCAL, "utf8"));
  }

  const corrections = reparer(donneesEpisode);

  const reponseEcriture = await fetch(`${SUPABASE_URL}/rest/v1/episodes?id=eq.episode4`, {
    method: "PATCH",
    headers: { ...entetes, Prefer: "return=minimal" },
    body: JSON.stringify({ data: donneesEpisode }),
  });
  if (!reponseEcriture.ok) throw new Error(`Écriture refusée (${reponseEcriture.status}) : ${await reponseEcriture.text()}`);
  console.log(`✅ Épisode 4 mis à jour en base (${corrections.length} corrections) :`);
  corrections.forEach((c) => console.log(`   - ${c}`));
}

function tester() {
  const nodes = JSON.parse(readFileSync(FICHIER_LOCAL, "utf8")).nodes;
  const choix = nodes[ID_CHOIX];
  const verif = (ok, etiquette) => { console.log(`   ${ok ? "✅" : "❌"} ${etiquette}`); if (!ok) process.exitCode = 1; };

  console.log("Vérification du choix restauré :");
  verif(nodes.n315.next === ID_CHOIX, `n315.next = ${ID_CHOIX}`);
  verif(choix?.type === "choice" && choix?.speaker === "moi", "type choice / speaker moi");
  verif(choix?.options?.length === 3, "3 réponses");
  verif(choix?.options[0].next === "n316" && choix.options[0].effects.aaron.amour === 0, "réponse 1 → n316 (+0)");
  verif(choix?.options[1].next === "n317" && choix.options[1].effects.aaron.amour === 10, "réponse 2 → n317 (+10)");
  verif(choix?.options[2].next === "n321" && choix.options[2].effects.aaron.amour === -5, "réponse 3 → n321 (-5)");

  // Chaque branche doit converger vers n325 puis la suite, jusqu'à la fin de l'épisode.
  // On traverse les nœuds "branch" comme le fait le moteur (résolution de l'aiguillage).
  const resoudre = (id) => {
    let courant = id;
    for (let g = 0; g < 20 && nodes[courant]?.type === "branch"; g++) {
      courant = resoudreBranche(nodes[courant], { gauges: {}, flags: [] });
    }
    return courant;
  };
  for (const entree of ["n316", "n317", "n321"]) {
    let curseur = entree, atteintFin = false;
    for (let i = 0; i < 600 && curseur; i++) {
      const n = nodes[curseur];
      if (!n) break;
      if (n.type === "end") { atteintFin = true; break; }
      curseur = resoudre(n.type === "choice" ? n.options[0]?.next : n.next);
    }
    verif(atteintFin, `branche ${entree} atteint la fin de l'épisode`);
  }
}

const mode = process.argv[2];
if (mode === "--local") await patchLocal();
else if (mode === "--db") await patchBase();
else if (mode === "--test") tester();
else {
  console.log("Usage : node scripts/fix-episode4-choix-aaron.mjs [--local|--db|--test]");
}
