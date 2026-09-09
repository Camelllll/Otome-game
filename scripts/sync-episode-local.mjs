// Synchronise UN épisode depuis la base vers son fichier JSON local.
//
// Pourquoi : les modifications faites via le BackOffice sont écrites en base mais jamais
// répercutées dans data/episodes/*.json. Le fichier local devient périmé et ne reflète plus
// ce qui tourne en jeu. Ce script télécharge la version base (la référence) et écrase le local.
//
// Sécurité : avant d'écraser, on sauvegarde la ligne complète de la table "episodes"
// dans supabase/backups/ (horodaté), pour pouvoir restaurer en cas d'erreur.
//
// Usage :
//   node scripts/sync-episode-local.mjs episode1            # sync l'épisode 1 + backup de la table
//   node scripts/sync-episode-local.mjs episode1 --no-backup  # sync sans refaire de backup

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SUPABASE_URL = "https://pnprcoithzjpdwzoglea.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_lfm21jd95NwouDQQZWIdCw_JFSfGWGn";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOSSIER_EPISODES = join(RACINE, "data", "episodes");
const DOSSIER_BACKUPS = join(RACINE, "supabase", "backups");

const entetes = { apikey: SUPABASE_PUBLISHABLE_KEY };

// La colonne jsonb "data" doit contenir l'objet épisode ; déballe d'éventuelles imbrications.
function deballerEpisode(data) {
  let donnees = data;
  let gardes = 0;
  while (donnees && !donnees.nodes && gardes < 5) {
    donnees = Array.isArray(donnees) ? donnees[0]?.data : donnees.data;
    gardes += 1;
  }
  return donnees;
}

async function lireTableEpisodes() {
  const reponse = await fetch(`${SUPABASE_URL}/rest/v1/episodes?select=id,title,status,data,updated_at`, { headers: entetes });
  if (!reponse.ok) throw new Error(`Lecture impossible (${reponse.status}) : ${await reponse.text()}`);
  return reponse.json();
}

function sauvegarderTable(lignes) {
  mkdirSync(DOSSIER_BACKUPS, { recursive: true });
  const horodatage = new Date().toISOString().replace(/[:.]/g, "-");
  const chemin = join(DOSSIER_BACKUPS, `episodes-${horodatage}.json`);
  writeFileSync(chemin, JSON.stringify(lignes, null, 2) + "\n");
  return chemin;
}

async function synchroniser(episodeId, avecBackup) {
  const lignes = await lireTableEpisodes();

  if (avecBackup) {
    const cheminBackup = sauvegarderTable(lignes);
    console.log(`💾 Sauvegarde de la table episodes (${lignes.length} lignes) : ${cheminBackup}`);
  }

  const ligne = lignes.find((item) => item.id === episodeId);
  if (!ligne) throw new Error(`Épisode introuvable en base : ${episodeId}`);

  const donnees = deballerEpisode(ligne.data);
  if (!donnees?.nodes) throw new Error(`L'épisode ${episodeId} est corrompu en base (pas de nodes).`);

  const cheminLocal = join(DOSSIER_EPISODES, `${episodeId}.json`);
  const avant = JSON.parse(readFileSync(cheminLocal, "utf8"));
  const nbAvant = Object.keys(avant.nodes || {}).length;
  const nbApres = Object.keys(donnees.nodes).length;

  writeFileSync(cheminLocal, JSON.stringify(donnees, null, 2) + "\n");

  console.log(`✅ ${episodeId} synchronisé depuis la base vers data/episodes/${episodeId}.json`);
  console.log(`   nœuds : ${nbAvant} (local avant) → ${nbApres} (base, maintenant en local)`);
  console.log(`   statut en base : ${ligne.status} | updated_at : ${ligne.updated_at}`);
}

const episodeId = process.argv[2];
const avecBackup = !process.argv.includes("--no-backup");

if (!episodeId) {
  console.log("Usage : node scripts/sync-episode-local.mjs <episodeId> [--no-backup]");
  console.log("  Exemple : node scripts/sync-episode-local.mjs episode1");
  process.exit(1);
}

await synchroniser(episodeId, avecBackup);
