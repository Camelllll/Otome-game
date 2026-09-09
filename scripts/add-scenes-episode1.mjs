// Ajoute la structure "scenes" à l'épisode 1 en base (découpage par changement de décor).
//
// Pourquoi : l'épisode 1 a été seedé sans "scenes", donc le BackOffice les invente à chaque
// affichage (inferScenesFromNodes), ce qui fusionne tout dès que deux scènes partagent un décor.
// Écrire les scènes en base rend le découpage fixe et pilotable depuis le BackOffice.
//
// Sécurité : le jeu n'utilise que "nodes"/"next" et ignore "scenes" → aucun impact joueur.
// Garde-fou : le script REFUSE d'écraser un épisode qui possède déjà des scènes.
//
// Usage :
//   node scripts/add-scenes-episode1.mjs --preview   # affiche le découpage calculé (lecture seule)
//   node scripts/add-scenes-episode1.mjs --local     # écrit data/episodes/episode1.json (miroir)
//   node scripts/add-scenes-episode1.mjs --db        # écrit en base (identifiants admin demandés)

import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const SUPABASE_URL = "https://pnprcoithzjpdwzoglea.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_lfm21jd95NwouDQQZWIdCw_JFSfGWGn";
const FICHIER_LOCAL = new URL("../data/episodes/episode1.json", import.meta.url);

// Découpe les nœuds en scènes à chaque changement de décor (même logique que l'import DOCX).
function construireScenes(episode) {
  const scenes = [];
  let active = null;
  let index = 1;

  for (const [id, node] of Object.entries(episode.nodes)) {
    const background = node.background || "";
    if (!active || active.background !== background) {
      active = {
        id: `scene_${index}`,
        title: `Scène ${index}`,
        background,
        music: node.music || "",
        nodeIds: [],
      };
      scenes.push(active);
      index += 1;
    }
    active.nodeIds.push(id);
  }
  return scenes;
}

function appliquerScenes(episode) {
  if (Array.isArray(episode.scenes) && episode.scenes.length) {
    throw new Error("L'épisode possède déjà des scènes : abandon pour ne rien écraser.");
  }
  episode.scenes = construireScenes(episode);
  return episode.scenes;
}

function afficherDecoupage(scenes) {
  console.log(`\n${scenes.length} scènes générées :`);
  for (const scene of scenes) {
    const extrait = scene.background ? scene.background.split("/").pop() : "(sans décor)";
    console.log(`  ${scene.id} — ${scene.nodeIds.length} nœud(s) — décor : ${extrait}`);
    console.log(`      de ${scene.nodeIds[0]} à ${scene.nodeIds[scene.nodeIds.length - 1]}`);
  }
}

async function lireEpisodeBase() {
  const reponse = await fetch(`${SUPABASE_URL}/rest/v1/episodes?id=eq.episode1&select=id,title,status,data`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
  });
  const lignes = await reponse.json();
  const ligne = lignes?.[0];
  if (!ligne) throw new Error("Épisode 1 introuvable en base.");
  // Déballe d'éventuelles imbrications résiduelles pour retrouver l'objet épisode.
  let donnees = ligne.data;
  let gardes = 0;
  while (donnees && !donnees.nodes && gardes < 5) {
    donnees = Array.isArray(donnees) ? donnees[0]?.data : donnees.data;
    gardes += 1;
  }
  if (!donnees?.nodes) throw new Error("Colonne data corrompue ou sans nodes.");
  return { ligne, donnees };
}

async function preview() {
  const { donnees } = await lireEpisodeBase();
  const scenes = Array.isArray(donnees.scenes) && donnees.scenes.length ? donnees.scenes : construireScenes(donnees);
  if (Array.isArray(donnees.scenes) && donnees.scenes.length) {
    console.log("ℹ️  L'épisode a DÉJÀ des scènes en base. Voici l'existant :");
  }
  afficherDecoupage(scenes);
}

async function patchLocal() {
  const episode = JSON.parse(readFileSync(FICHIER_LOCAL, "utf8"));
  const scenes = appliquerScenes(episode);
  writeFileSync(FICHIER_LOCAL, JSON.stringify(episode, null, 2) + "\n");
  console.log("✅ JSON local mis à jour :");
  afficherDecoupage(scenes);
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

  const { donnees } = await lireEpisodeBase();
  const scenes = appliquerScenes(donnees); // lève une erreur si des scènes existent déjà
  afficherDecoupage(scenes);

  const confirmation = await rl.question('\nÉcrire ce découpage en base ? (tape "oui") : ');
  if (confirmation.trim().toLowerCase() !== "oui") {
    console.log("Annulé, rien n'a été écrit.");
    process.exit(0);
  }

  const reponseEcriture = await fetch(`${SUPABASE_URL}/rest/v1/episodes?id=eq.episode1`, {
    method: "PATCH",
    headers: { ...entetes, Prefer: "return=minimal" },
    body: JSON.stringify({ data: donnees }),
  });
  if (!reponseEcriture.ok) throw new Error(`Écriture refusée (${reponseEcriture.status}) : ${await reponseEcriture.text()}`);
  console.log(`✅ Épisode 1 mis à jour en base (${scenes.length} scènes).`);
}

const mode = process.argv[2];
if (mode === "--preview") await preview();
else if (mode === "--local") await patchLocal();
else if (mode === "--db") await patchBase();
else {
  console.log("Usage : node scripts/add-scenes-episode1.mjs [--preview|--local|--db]");
}
