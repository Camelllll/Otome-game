// Client Supabase public (clé "publishable"), utilisé par le jeu (jamais par l'admin).
// Cette clé est sans danger à exposer côté navigateur : elle est bridée par les policies RLS
// définies dans supabase/schema.sql (lecture seule sur le contenu, écriture limitée aux joueurs).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://pnprcoithzjpdwzoglea.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_lfm21jd95NwouDQQZWIdCw_JFSfGWGn";

const REMEMBER_KEY = "otome_remember_me";

// "Se souvenir de moi" : la session est stockée dans localStorage (persiste) par défaut,
// ou dans sessionStorage (effacée à la fermeture de l'onglet) si l'utilisateur décoche la case.
function choisirStockage() {
  return localStorage.getItem(REMEMBER_KEY) === "false" ? sessionStorage : localStorage;
}

export function definirSeSouvenir(actif) {
  localStorage.setItem(REMEMBER_KEY, actif ? "true" : "false");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: {
      getItem: (cle) => choisirStockage().getItem(cle),
      setItem: (cle, valeur) => choisirStockage().setItem(cle, valeur),
      removeItem: (cle) => choisirStockage().removeItem(cle),
    },
  },
});

