// Migration : fait de Liv et Mme Montrose de vrais crushs fonctionnels.
//
// Problèmes corrigés :
//   1. Identifiants incohérents — la base stocke id "liv_1"/"mme_montrose_1" mais les épisodes
//      utilisent "liv"/"liv_1"/"montrose"/"mme_montrose_1" selon les cas. On uniformise sur
//      "liv" et "montrose" (convention courte des autres crushs).
//   2. Fiches copiées-collées de Zoé — on leur donne leur propre personnalité.
//   3. Gauge "amour" manquante — ajoutée pour qu'ils aient un lovomètre complet.
//   4. Références dans les épisodes 3, 4, 5 — liv_1→liv, mme_montrose_1→montrose,
//      mme_montrose_png_1→montrose (clé de sprite mal placée).
//
// Sécurité : sauvegarde de characters + episodes dans supabase/backups/ AVANT toute écriture,
// puis confirmation explicite ("oui") avant de pousser en base.
//
// Usage :
//   node scripts/fix-crushs-liv-montrose.mjs --preview   # affiche ce qui sera fait (lecture seule)
//   node scripts/fix-crushs-liv-montrose.mjs --db        # applique en base (identifiants admin)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";

const SUPABASE_URL = "https://pnprcoithzjpdwzoglea.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_lfm21jd95NwouDQQZWIdCw_JFSfGWGn";
const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOSSIER_BACKUPS = join(RACINE, "supabase", "backups");
const FICHIER_CHARACTERS = join(RACINE, "data", "characters.json");

// Références à réécrire dans les épisodes : ancien id -> nouvel id.
const RENOMMAGES = {
  liv_1: "liv",
  mme_montrose_1: "montrose",
  mme_montrose_png_1: "montrose", // clé de sprite mal placée utilisée comme speaker/onScreen
};

// Fiches validées (personnalités propres, gauge amour ajoutée).
const FICHES = {
  liv: {
    id: "liv",
    name: "Liv",
    tagline: "La collègue qui connaît la boutique comme sa poche.",
    age: 20,
    field: "Salariée à la boutique de vinyles",
    personality: ["accueillante", "passionnée de musique", "bavarde", "spontanée", "bienveillante"],
    likes: ["Les vinyles", "Conseiller les clients", "Découvrir de nouveaux artistes", "Le café", "Les concerts"],
    dislikes: ["Le désordre dans les rayons", "Les clients pressés", "Qu'on juge sans écouter"],
    routeTheme: "Trouver sa place entre passion et avenir.",
    goal: "Monter sa propre boutique de disques un jour.",
    passion: "La musique sous toutes ses formes, surtout le vinyle.",
    flaw: "Elle donne tellement aux autres qu'elle oublie de penser à elle.",
    favoritePlace: "Le rayon des nouveautés, à la boutique.",
    sprite: "assets/Personnages/Persos secondaires/PNG/Liv.png",
    portraits: { default: "assets/Personnages/Persos secondaires/PNG/Liv.png" },
    gauges: { amitie: 0, amour: 0 },
  },
  montrose: {
    id: "montrose",
    name: "Mme Montrose",
    tagline: "Exigeante et juste, elle voit le potentiel avant tout le monde.",
    age: 42,
    field: "Enseignante / Responsable",
    personality: ["exigeante", "perspicace", "directe", "juste", "secrètement bienveillante"],
    likes: ["Le travail bien fait", "La rigueur", "Les élèves qui se surpassent", "Le thé"],
    dislikes: ["Le laisser-aller", "Les excuses", "Qu'on gâche son potentiel"],
    routeTheme: "L'exigence comme forme de respect.",
    goal: "Révéler le meilleur de chacun de ses élèves.",
    passion: "La transmission et l'excellence.",
    flaw: "Sa franchise peut blesser ceux qui ne la comprennent pas.",
    favoritePlace: "Son bureau, entre deux corrections.",
    sprite: "assets/Personnages/Persos secondaires/PNG/Mme Montrose.png",
    portraits: { default: "assets/Personnages/Persos secondaires/PNG/Mme Montrose.png" },
    gauges: { amitie: 0, amour: 0 },
  },
};

function deballerEpisode(data) {
  let donnees = data;
  let gardes = 0;
  while (donnees && !donnees.nodes && gardes < 5) {
    donnees = Array.isArray(donnees) ? donnees[0]?.data : donnees.data;
    gardes += 1;
  }
  return donnees;
}

// Réécrit les ids renommés dans tous les champs d'un épisode (speaker, onScreen, effects).
function renommerReferences(episode) {
  let compte = 0;
  for (const node of Object.values(episode.nodes || {})) {
    if (RENOMMAGES[node.speaker]) { node.speaker = RENOMMAGES[node.speaker]; compte++; }
    if (Array.isArray(node.onScreen)) {
      node.onScreen = node.onScreen.map((id) => {
        if (RENOMMAGES[id]) { compte++; return RENOMMAGES[id]; }
        return id;
      });
    }
    for (const option of node.options || []) {
      for (const ancien of Object.keys(option.effects || {})) {
        if (RENOMMAGES[ancien]) {
          option.effects[RENOMMAGES[ancien]] = option.effects[ancien];
          delete option.effects[ancien];
          compte++;
        }
      }
    }
  }
  return compte;
}

function sauvegarder(nom, donnees) {
  mkdirSync(DOSSIER_BACKUPS, { recursive: true });
  const horodatage = new Date().toISOString().replace(/[:.]/g, "-");
  const chemin = join(DOSSIER_BACKUPS, `${nom}-${horodatage}.json`);
  writeFileSync(chemin, JSON.stringify(donnees, null, 2) + "\n");
  return chemin;
}

async function lireTout(jeton) {
  const entetes = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
  };
  const [repChars, repEpisodes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/characters?select=id,is_player,is_secondary,data`, { headers: entetes }),
    fetch(`${SUPABASE_URL}/rest/v1/episodes?select=id,title,status,data`, { headers: entetes }),
  ]);
  if (!repChars.ok) throw new Error(`Lecture characters impossible (${repChars.status})`);
  if (!repEpisodes.ok) throw new Error(`Lecture episodes impossible (${repEpisodes.status})`);
  return { characters: await repChars.json(), episodes: await repEpisodes.json() };
}

function planifier(characters, episodes) {
  const plan = { fiches: [], episodesModifies: [] };

  // Quelles lignes characters correspondent à Liv / Montrose (clé ligne liv/montrose) ?
  for (const ligne of characters) {
    if (ligne.id === "liv") plan.fiches.push({ cle: "liv", fiche: FICHES.liv, ligne });
    if (ligne.id === "montrose") plan.fiches.push({ cle: "montrose", fiche: FICHES.montrose, ligne });
  }

  for (const episode of episodes) {
    const donnees = deballerEpisode(episode.data);
    if (!donnees?.nodes) continue;
    // Compter les références à renommer sans modifier (copie pour le preview).
    const copie = JSON.parse(JSON.stringify(donnees));
    const compte = renommerReferences(copie);
    if (compte > 0) plan.episodesModifies.push({ id: episode.id, compte });
  }
  return plan;
}

async function preview() {
  const { characters, episodes } = await lireTout(null);
  const plan = planifier(characters, episodes);
  console.log("=== Fiches à corriger en base ===");
  for (const { cle, ligne } of plan.fiches) {
    console.log(`  ${cle} : id interne actuel "${ligne.data?.id}" → "liv"/"montrose", name "${ligne.data?.name}" → corrigé, + gauge amour`);
  }
  console.log("=== Références à renommer dans les épisodes ===");
  for (const { id, compte } of plan.episodesModifies) {
    console.log(`  ${id} : ${compte} référence(s) (liv_1→liv, mme_montrose_1→montrose, mme_montrose_png_1→montrose)`);
  }
  if (!plan.episodesModifies.length) console.log("  (aucune référence à renommer)");
}

async function patchBase() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const email = await rl.question("E-mail admin : ");
  const motDePasse = await rl.question("Mot de passe admin : ");

  const reponseAuth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: motDePasse }),
  });
  if (!reponseAuth.ok) { rl.close(); throw new Error(`Connexion refusée (${reponseAuth.status})`); }
  const { access_token: jeton } = await reponseAuth.json();
  const entetes = { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" };

  const { characters, episodes } = await lireTout(jeton);

  // Sauvegardes AVANT toute écriture.
  const bakChars = sauvegarder("characters", characters);
  const bakEpisodes = sauvegarder("episodes", episodes);
  console.log(`💾 Sauvegardes : ${bakChars} + ${bakEpisodes}`);

  const plan = planifier(characters, episodes);
  console.log(`\n${plan.fiches.length} fiche(s) à corriger, ${plan.episodesModifies.length} épisode(s) à renommer.`);
  const confirmation = (await rl.question('Écrire en base ? (tape "oui") : ')).trim().toLowerCase();
  rl.close();
  if (confirmation !== "oui") { console.log("Annulé, rien n'a été écrit."); process.exit(0); }

  // 1. Corriger les fiches characters.
  for (const { cle, fiche, ligne } of plan.fiches) {
    const rep = await fetch(`${SUPABASE_URL}/rest/v1/characters?id=eq.${ligne.id}`, {
      method: "PATCH",
      headers: { ...entetes, Prefer: "return=minimal" },
      body: JSON.stringify({ data: fiche, is_secondary: false }),
    });
    if (!rep.ok) throw new Error(`Fiche ${cle} non écrite (${rep.status}) : ${await rep.text()}`);
    console.log(`✅ Fiche ${cle} corrigée (id "${fiche.id}", gauge amour ajoutée)`);
  }

  // 2. Renommer les références dans les épisodes concernés.
  for (const episode of episodes) {
    const donnees = deballerEpisode(episode.data);
    if (!donnees?.nodes) continue;
    const compte = renommerReferences(donnees);
    if (!compte) continue;
    const rep = await fetch(`${SUPABASE_URL}/rest/v1/episodes?id=eq.${episode.id}`, {
      method: "PATCH",
      headers: { ...entetes, Prefer: "return=minimal" },
      body: JSON.stringify({ data: donnees }),
    });
    if (!rep.ok) throw new Error(`Épisode ${episode.id} non écrit (${rep.status}) : ${await rep.text()}`);
    console.log(`✅ ${episode.id} : ${compte} référence(s) renommée(s)`);
  }

  // 3. Mettre à jour le fichier local characters.json (miroir de la base).
  const charactersFinal = (await lireTout(jeton)).characters;
  const player = charactersFinal.find((r) => r.is_player)?.data;
  const crushs = charactersFinal.filter((r) => !r.is_player && !r.is_secondary).map((r) => r.data);
  const secondary = charactersFinal.filter((r) => !r.is_player && r.is_secondary).map((r) => r.data);
  writeFileSync(FICHIER_CHARACTERS, JSON.stringify({ player, crushs, secondary }, null, 2) + "\n");
  console.log(`✅ data/characters.json synchronisé (${crushs.length} crushs, ${secondary.length} secondaires)`);

  console.log("\n🎉 Liv et Mme Montrose sont maintenant des crushs fonctionnels en base.");
}

const mode = process.argv[2];
if (mode === "--preview") await preview();
else if (mode === "--db") await patchBase();
else console.log("Usage : node scripts/fix-crushs-liv-montrose.mjs [--preview|--db]");
