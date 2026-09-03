// Accès en lecture seule au contenu du jeu (personnages, épisodes publiés, boutique) via Supabase.
import { supabase } from "./supabaseClient.js";

// Reconstruit la forme { player, crushs, secondary } attendue par aplatirPersonnages().
export async function getCharacters() {
  const { data, error } = await supabase.from("characters").select("id, is_player, is_secondary, data");
  if (error) throw error;

  const player = data.find((row) => row.is_player)?.data;
  const crushs = data.filter((row) => !row.is_player && !row.is_secondary).map((row) => row.data);
  const secondary = data.filter((row) => !row.is_player && row.is_secondary).map((row) => row.data);

  return { player, crushs, secondary };
}

// Liste les épisodes publiés (visibles par les joueurs), triés par id.
export async function getPublishedEpisodesList() {
  const { data, error } = await supabase
    .from("episodes")
    .select("id, title")
    .eq("status", "published")
    .order("id", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getEpisode(episodeId) {
  const { data, error } = await supabase
    .from("episodes")
    .select("data")
    .eq("id", episodeId)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Épisode publié introuvable : ${episodeId}`);
  return data.data;
}

export async function getShop() {
  const { data, error } = await supabase.from("shop_items").select("id, slot, label, price, data");
  if (error) throw error;
  return {
    currency: { name: "Gemmes", id: "gemmes" },
    items: data.map((row) => ({ id: row.id, slot: row.slot, label: row.label, price: row.price, ...row.data })),
  };
}
