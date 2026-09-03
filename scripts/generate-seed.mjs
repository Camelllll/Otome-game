// Script one-shot : génère supabase/seed.sql à partir des fichiers data/*.json existants.
// Usage : node scripts/generate-seed.mjs
// Le seed.sql généré doit être collé dans le SQL Editor de Supabase (bypass RLS, donc pas besoin de clé secrète).
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

// Dollar-quoting pour éviter tout souci d'échappement de guillemets/apostrophes dans le JSON.
function sqlJson(value) {
  return `$json$${JSON.stringify(value)}$json$::jsonb`;
}

function sqlText(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function readJson(relativePath) {
  const raw = await readFile(path.join(root, relativePath), "utf8");
  return JSON.parse(raw);
}

async function buildCharactersInserts() {
  const characters = await readJson("data/characters.json");
  const rows = [];

  if (characters.player) {
    rows.push({ id: characters.player.id, isPlayer: true, isSecondary: false, data: characters.player });
  }
  for (const crush of characters.crushs || []) {
    rows.push({ id: crush.id, isPlayer: false, isSecondary: false, data: crush });
  }
  for (const secondary of characters.secondary || []) {
    rows.push({ id: secondary.id, isPlayer: false, isSecondary: true, data: secondary });
  }

  return rows
    .map(
      (row) =>
        `insert into characters (id, is_player, is_secondary, data) values (${sqlText(row.id)}, ${row.isPlayer}, ${row.isSecondary}, ${sqlJson(row.data)}) on conflict (id) do update set is_player = excluded.is_player, is_secondary = excluded.is_secondary, data = excluded.data;`
    )
    .join("\n");
}

async function buildShopInserts() {
  const shop = await readJson("data/shop.json");
  return (shop.items || [])
    .map(
      (item) =>
        `insert into shop_items (id, slot, label, price, data) values (${sqlText(item.id)}, ${sqlText(item.slot)}, ${sqlText(item.label || item.name || item.id)}, ${Number(item.price || 0)}, ${sqlJson(item)}) on conflict (id) do update set slot = excluded.slot, label = excluded.label, price = excluded.price, data = excluded.data;`
    )
    .join("\n");
}

async function buildEpisodesInserts() {
  const ids = ["episode1", "episode2", "episode3"];
  const statements = [];
  for (const id of ids) {
    let episode;
    try {
      episode = await readJson(`data/episodes/${id}.json`);
    } catch {
      continue;
    }
    // episode1/episode2 sont considérés publiés, episode3 est un brouillon (peu peuplé).
    const status = id === "episode3" ? "draft" : "published";
    statements.push(
      `insert into episodes (id, title, status, data) values (${sqlText(id)}, ${sqlText(episode.title || id)}, ${sqlText(status)}, ${sqlJson(episode)}) on conflict (id) do update set title = excluded.title, status = excluded.status, data = excluded.data;`
    );
  }
  return statements.join("\n");
}

const [charactersSql, shopSql, episodesSql] = await Promise.all([
  buildCharactersInserts(),
  buildShopInserts(),
  buildEpisodesInserts(),
]);

const output = `-- Généré par scripts/generate-seed.mjs à partir des JSON existants dans data/.
-- À coller dans le SQL Editor de Supabase (exécuté avec les droits complets, pas besoin de clé secrète).

-- Personnages
${charactersSql}

-- Boutique
${shopSql}

-- Épisodes
${episodesSql}
`;

await writeFile(path.join(root, "supabase/seed.sql"), output, "utf8");
console.log("supabase/seed.sql généré.");
