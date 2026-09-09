// Migration épisode 4 : aiguillage du raccompagnement final.
//
// Ce script transforme l'épisode 4 pour que, après « J'ai dit au revoir à Liv… » (n716) :
//   1. si le joueur a répondu « Tu devrais peut-être t'accorder une pause de temps en temps. »
//      au choix n697 (flag "liam_pause"), c'est Liam qui raccompagne l'héroïne (n717) ;
//   2. sinon, c'est le crush dont le lovomètre "amour" est le plus haut qui l'attend
//      (tirage au sort en cas d'égalité ; Liam exclu de la comparaison) ;
//   3. chaque scène de raccompagnement se termine sur la fin commune (n1166) au lieu de
//      cascader dans la scène du crush suivant.
//
// Usage :
//   node scripts/fix-episode4.mjs --local   # patch data/episodes/episode4.json
//   node scripts/fix-episode4.mjs --db      # patch l'épisode 4 en base (identifiants admin demandés)
//   node scripts/fix-episode4.mjs --test    # simule le routage sur le JSON local patché
//
// Le script est idempotent : on peut le relancer sans risque.

import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { resoudreBranche } from "../src/engine/relationManager.js";

const SUPABASE_URL = "https://pnprcoithzjpdwzoglea.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_lfm21jd95NwouDQQZWIdCw_JFSfGWGn";
const FICHIER_LOCAL = new URL("../data/episodes/episode4.json", import.meta.url);

// --- Transformation (partagée entre le mode local et le mode base) ---

function transformerEpisode4(episode) {
  const nodes = episode.nodes || {};
  const corrections = [];

  // 1. Flag "liam_pause" sur la bonne réponse du dernier choix avec Liam (n697).
  const bonneReponse = nodes.n697?.options?.find((option) =>
    (option.text || "").includes("pause de temps en temps")
  );
  if (bonneReponse) {
    bonneReponse.flags = [...new Set([...(bonneReponse.flags || []), "liam_pause"])];
    corrections.push('n697 : flag "liam_pause" sur la bonne réponse');
  } else {
    console.warn("⚠️  Choix n697 introuvable : flag non posé.");
  }

  // 2. Après la sortie de la boutique, on passe par l'aiguillage.
  if (nodes.n716) {
    nodes.n716.next = "b_raccompagnement";
    corrections.push("n716 : next → b_raccompagnement");
  } else {
    console.warn("⚠️  Nœud n716 introuvable.");
  }

  // 3. Nœud d'aiguillage : Liam si flag, sinon le crush au lovomètre le plus haut (Liam exclu).
  nodes.b_raccompagnement = {
    type: "branch",
    branches: [
      { if: { flag: "liam_pause" }, next: "n717" },
      {
        if: {
          topGauge: {
            gauge: "amour",
            routes: {
              camel: "n769",
              isaac: "n821",
              mehdi: "n897",
              sasha: "n948",
              aaron: "n1016",
              stella: "n1085",
            },
          },
        },
      },
    ],
    fallback: "n769",
  };
  corrections.push("b_raccompagnement : nœud branch créé");

  // 4. Chaque scène de raccompagnement se termine sur la fin commune (n1166).
  const finsDeBloc = ["n820", "n896", "n947", "n1015", "n1084"];
  for (const id of finsDeBloc) {
    if (nodes[id]) {
      nodes[id].next = "n1166";
      corrections.push(`${id} : next → n1166 (fin commune)`);
    } else {
      console.warn(`⚠️  Nœud ${id} introuvable.`);
    }
  }

  return corrections;
}

// --- Modes d'application ---

async function patchLocal() {
  const brut = readFileSync(FICHIER_LOCAL, "utf8");
  const episode = JSON.parse(brut);
  const corrections = transformerEpisode4(episode);
  writeFileSync(FICHIER_LOCAL, JSON.stringify(episode, null, 2) + "\n");
  console.log(`✅ ${corrections.length} corrections appliquées au JSON local :`);
  corrections.forEach((correction) => console.log(`   - ${correction}`));
}

async function patchBase() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const email = await rl.question("E-mail admin : ");
  const motDePasse = await rl.question("Mot de passe admin : ");
  rl.close();

  // Connexion admin (l'écriture sur episodes exige une session authentifiée, cf. policies RLS).
  const reponseAuth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: motDePasse }),
  });
  if (!reponseAuth.ok) {
    throw new Error(`Connexion refusée (${reponseAuth.status}) : ${await reponseAuth.text()}`);
  }
  const { access_token: jeton } = await reponseAuth.json();

  const entetes = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${jeton}`,
    "Content-Type": "application/json",
  };

  const reponseLecture = await fetch(`${SUPABASE_URL}/rest/v1/episodes?id=eq.episode4&select=id,title,status,data`, {
    headers: entetes,
  });
  const lignes = await reponseLecture.json();
  const episode = lignes?.[0];
  if (!episode) throw new Error("Épisode 4 introuvable en base.");

  // La colonne jsonb "data" doit contenir UNIQUEMENT l'objet épisode ({id, nodes, ...}).
  // Si une exécution précédente a imbriqué la ligne entière ({data:[{id,data,...}]}),
  // on répare en récupérant l'objet épisode le plus profond, sinon on repart du JSON local sain.
  let donneesEpisode = episode.data;
  let gardes = 0;
  while (donneesEpisode && !donneesEpisode.nodes && gardes < 5) {
    donneesEpisode = Array.isArray(donneesEpisode) ? donneesEpisode[0]?.data : donneesEpisode.data;
    gardes += 1;
  }
  if (!donneesEpisode?.nodes) {
    console.warn("⚠️  La colonne data est corrompue (structure imbriquée). Restauration depuis data/episodes/episode4.json.");
    donneesEpisode = JSON.parse(readFileSync(FICHIER_LOCAL, "utf8"));
  }

  const corrections = transformerEpisode4(donneesEpisode);

  const reponseEcriture = await fetch(`${SUPABASE_URL}/rest/v1/episodes?id=eq.episode4`, {
    method: "PATCH",
    headers: { ...entetes, Prefer: "return=minimal" },
    body: JSON.stringify({ data: donneesEpisode }),
  });
  if (!reponseEcriture.ok) {
    throw new Error(`Écriture refusée (${reponseEcriture.status}) : ${await reponseEcriture.text()}`);
  }
  console.log(`✅ Épisode 4 mis à jour en base (${corrections.length} corrections, statut "${episode.status}" conservé) :`);
  corrections.forEach((correction) => console.log(`   - ${correction}`));
}

// --- Simulation du routage (validation sur le JSON local) ---

function simuler(sauvegarde, etiquette) {
  const episode = JSON.parse(readFileSync(FICHIER_LOCAL, "utf8"));
  const nodes = episode.nodes;

  // Point de départ : n716, dont le next passe par l'aiguillage.
  let id = nodes.n716.next;
  let noeud = nodes[id];
  if (noeud?.type === "branch") id = resoudreBranche(noeud, sauvegarde);

  // Remonte le speaker principal de la scène atteinte (les 60 premiers nœuds).
  const compteurs = {};
  let curseur = id;
  for (let i = 0; i < 60 && curseur; i++) {
    const courant = nodes[curseur];
    if (!courant) break;
    if (courant.speaker && !["moi", "narration"].includes(courant.speaker)) {
      compteurs[courant.speaker] = (compteurs[courant.speaker] || 0) + 1;
    }
    curseur = courant.type === "choice" ? courant.options[0]?.next : courant.next;
  }
  const vainqueur = Object.entries(compteurs).sort((a, b) => b[1] - a[1])[0]?.[0];
  console.log(`${etiquette} → entrée ${id}, scène de : ${vainqueur}`);
  return vainqueur;
}

function attendre(attendu, obtenu, etiquette) {
  if (obtenu === attendu) console.log(`   ✅ ${etiquette}`);
  else {
    console.error(`   ❌ ${etiquette} — attendu ${attendu}, obtenu ${obtenu}`);
    process.exitCode = 1;
  }
}

function tester() {
  const base = { playerId: "test", playerName: "Sucrette", gauges: {}, flags: [] };

  console.log("Routage après n716 :");
  attendre("liam", simuler({ ...base, flags: ["liam_pause"] }, "flag liam_pause + camel à 90"), "flag → Liam même si un autre crush est plus haut");
  attendre("camel", simuler({ ...base, gauges: { camel: { amour: 40 }, isaac: { amour: 20 } } }, "camel 40, isaac 20"), "camel plus haut → Camel");
  attendre("isaac", simuler({ ...base, gauges: { isaac: { amour: 55 }, stella: { amour: 30 } } }, "isaac 55"), "isaac plus haut → Isaac");
  attendre("stella", simuler({ ...base, gauges: { stella: { amour: 10 } } }, "stella 10 seule"), "stella seule → Stella");
  // Égalité : tout le monde à 0 → tirage au sort, mais jamais Liam.
  const echantillon = new Set();
  for (let i = 0; i < 40; i++) echantillon.add(simuler({ ...base }, `égalité (tirage ${i + 1})`));
  console.log(`   ℹ️  Tirages à égalité obtenus : ${[...echantillon].join(", ")}`);
  if (echantillon.has("liam")) {
    console.error("   ❌ Liam ne devrait jamais gagner le tirage au lovomètre (réservé au flag).");
    process.exitCode = 1;
  }

  // Chaque bloc de raccompagnement doit atteindre la fin (n1185) sans croiser un autre crush.
  console.log("Traversée des blocs jusqu'à la fin :");
  const episode = JSON.parse(readFileSync(FICHIER_LOCAL, "utf8"));
  const nodes = episode.nodes;
  const entrees = { liam: "n717", camel: "n769", isaac: "n821", mehdi: "n897", sasha: "n948", aaron: "n1016", stella: "n1085" };
  const crushs = new Set(Object.keys(entrees));
  for (const [crush, entree] of Object.entries(entrees)) {
    let curseur = entree;
    let ok = false;
    const rencontres = new Set();
    for (let i = 0; i < 500 && curseur; i++) {
      const courant = nodes[curseur];
      if (!courant) break;
      if (courant.type === "end") { ok = true; break; }
      if (crushs.has(courant.speaker)) rencontres.add(courant.speaker);
      curseur = courant.type === "choice" ? courant.options[0]?.next : courant.next;
    }
    const parasites = [...rencontres].filter((id) => id !== crush);
    attendre(true, ok, `${crush} : atteint le nœud de fin`);
    attendre(0, parasites.length, `${crush} : ne croise aucun autre crush${parasites.length ? ` (croise ${parasites.join(", ")})` : ""}`);
  }
}

// --- Entrée CLI ---

const mode = process.argv[2];
if (mode === "--local") await patchLocal();
else if (mode === "--db") await patchBase();
else if (mode === "--test") tester();
else {
  console.log("Usage : node scripts/fix-episode4.mjs [--local|--db|--test]");
  console.log("  --local  patch data/episodes/episode4.json");
  console.log("  --db     patch l'épisode 4 en base (identifiants admin demandés)");
  console.log("  --test   simule le routage sur le JSON local");
}
