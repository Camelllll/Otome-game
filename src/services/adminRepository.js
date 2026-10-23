// Accès en écriture aux épisodes — réservé à l'admin authentifié (voir adminAuth.js).
// Les policies RLS (supabase/admin_auth_policies.sql) n'autorisent l'écriture qu'aux utilisateurs connectés.
import { supabase } from "./supabaseClient.js";

export async function listEpisodes() {
  const { data, error } = await supabase.from("episodes").select("id, title, status, data").order("id");
  if (error) throw error;
  return data;
}

// Liste les personnages depuis la base (source de vérité), reconstruits en { player, crushs, secondary }.
// Avant, l'admin lisait data/characters.json, qui se désynchronisait de la base (Liv/Montrose absents).
export async function listCharacters() {
  const { data, error } = await supabase.from("characters").select("id, is_player, is_secondary, data");
  if (error) throw error;
  const player = data.find((row) => row.is_player)?.data;
  const crushs = data.filter((row) => !row.is_player && !row.is_secondary).map((row) => row.data);
  const secondary = data.filter((row) => !row.is_player && row.is_secondary).map((row) => row.data);
  return { player, crushs, secondary };
}

// Liste brute (avec is_player/is_secondary) : nécessaire pour éditer/supprimer un personnage précis.
export async function listCharactersRaw() {
  const { data, error } = await supabase.from("characters").select("id, is_player, is_secondary, data");
  if (error) throw error;
  return data;
}

// Crée ou met à jour un personnage (fiche complète en jsonb). Réservé à l'admin (policy is_admin()).
export async function saveCharacter(id, isPlayer, isSecondary, data) {
  const { error } = await supabase
    .from("characters")
    .upsert({ id, is_player: isPlayer, is_secondary: isSecondary, data });
  if (error) throw error;
}

export async function deleteCharacter(id) {
  const { error } = await supabase.from("characters").delete().eq("id", id);
  if (error) throw error;
}

// Upload un sprite/portrait de personnage vers le bucket Storage "media" (dossier "characters/").
export async function uploadCharacterSprite(file) {
  const cheminStockage = `characters/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("media").upload(cheminStockage, file);
  if (error) throw error;
  const { data } = supabase.storage.from("media").getPublicUrl(cheminStockage);
  return data.publicUrl;
}

// Enregistre un épisode (brouillon par défaut). Passe status="published" pour publier directement.
export async function saveEpisode(id, title, data, status = "draft") {
  const { error } = await supabase.from("episodes").upsert({ id, title, status, data });
  if (error) throw error;
}

export async function publishEpisode(id) {
  const { error } = await supabase.from("episodes").update({ status: "published" }).eq("id", id);
  if (error) throw error;
}

export async function unpublishEpisode(id) {
  const { error } = await supabase.from("episodes").update({ status: "draft" }).eq("id", id);
  if (error) throw error;
}

export async function deleteEpisode(id) {
  const { error } = await supabase.from("episodes").delete().eq("id", id);
  if (error) throw error;
}

// Bibliothèque de médias (bucket Storage "media" + table media_assets pour le listing).
export async function listMedia() {
  const { data, error } = await supabase.from("media_assets").select("id, category, path, label").order("created_at");
  if (error) throw error;
  return data;
}

// Référence un média déjà existant (ex: chemin assets/... déjà présent dans le dépôt), sans upload.
export async function addMediaEntry(category, path, label) {
  const { data, error } = await supabase
    .from("media_assets")
    .insert({ category, path, label: label || path })
    .select("id, category, path, label")
    .single();
  if (error) throw error;
  return data;
}

export async function uploadMedia(file, category) {
  const cheminStockage = `${category}/${Date.now()}-${file.name}`;
  const { error: erreurUpload } = await supabase.storage.from("media").upload(cheminStockage, file);
  if (erreurUpload) throw erreurUpload;

  const { data: urlPublique } = supabase.storage.from("media").getPublicUrl(cheminStockage);
  const { data, error: erreurInsertion } = await supabase
    .from("media_assets")
    .insert({ category, path: urlPublique.publicUrl, label: file.name })
    .select("id, category, path, label")
    .single();
  if (erreurInsertion) throw erreurInsertion;
  return data;
}

export async function updateMediaAsset(id, category, oldPath, label, file) {
  let path = oldPath;
  let nouveauCheminStockage = "";

  if (file) {
    nouveauCheminStockage = `${category}/${Date.now()}-${crypto.randomUUID()}/${file.name}`;
    const { error } = await supabase.storage.from("media").upload(nouveauCheminStockage, file);
    if (error) throw error;
    path = supabase.storage.from("media").getPublicUrl(nouveauCheminStockage).data.publicUrl;
  }

  const requete = id
    ? supabase.from("media_assets").update({ category, path, label }).eq("id", id)
    : supabase.from("media_assets").insert({ category, path, label });
  const { data, error } = await requete.select("id, category, path, label").single();
  if (error) {
    if (nouveauCheminStockage) await supabase.storage.from("media").remove([nouveauCheminStockage]);
    throw error;
  }
  return { ...data, oldPath };
}

export async function deleteMediaStorageFile(path) {
  const cheminStockage = path.split("/media/")[1];
  if (!cheminStockage) return;
  const { error } = await supabase.storage.from("media").remove([cheminStockage]);
  if (error) throw error;
}

export async function deleteMedia(id, path) {
  // Le chemin de stockage est tout ce qui suit "/media/" dans l'URL publique.
  const cheminStockage = path.split("/media/")[1];
  if (cheminStockage) {
    await supabase.storage.from("media").remove([cheminStockage]);
  }
  const { error } = await supabase.from("media_assets").delete().eq("id", id);
  if (error) throw error;
}
