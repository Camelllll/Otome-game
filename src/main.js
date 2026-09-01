// Point d'entrée du jeu : charge les données, initialise la sauvegarde et lance l'épisode courant.
import { chargerSauvegarde, sauvegarder, recalculerActionPoints } from "./engine/saveSystem.js";
import { DialogueEngine, aplatirPersonnages } from "./engine/dialogueEngine.js";
import { lancerEcranDialogue } from "./screens/dialogueScreen.js";

const conteneurJeu = document.getElementById("jeu");

async function chargerJson(chemin) {
  const reponse = await fetch(chemin);
  if (!reponse.ok) throw new Error(`Impossible de charger ${chemin}`);
  return reponse.json();
}

async function chargerEpisode(idEpisode) {
  try {
    const brouillon = JSON.parse(localStorage.getItem("otome-admin-episodes-v2") || "null");
    if (brouillon?.episodes?.[idEpisode]) return brouillon.episodes[idEpisode];
  } catch (erreur) {
    console.warn("Brouillon du back-office illisible, chargement du fichier publié.", erreur);
  }
  return chargerJson(`data/episodes/${idEpisode}.json`);
}

async function demarrer() {
  const sauvegarde = chargerSauvegarde();
  recalculerActionPoints(sauvegarde);

  if (!sauvegarde.playerName || sauvegarde.playerName === "Sucrette") {
    try {
      const nomSaisi = window.prompt("Quel est le prénom de ton héroïne ?", "Sucrette");
      if (nomSaisi) sauvegarde.playerName = nomSaisi.trim();
    } catch (erreur) {
      console.warn("Saisie du prénom indisponible, valeur par défaut conservée.", erreur);
    }
  }
  sauvegarder(sauvegarde);

  const [charactersData, episodeData] = await Promise.all([
    chargerJson("data/characters.json"),
    chargerEpisode(sauvegarde.currentEpisode)
  ]);

  const personnagesParId = aplatirPersonnages(charactersData);
  const moteur = new DialogueEngine(episodeData, personnagesParId, sauvegarde);

  lancerEcranDialogue(conteneurJeu, moteur, {
    onFinEpisode: (prochainEpisode) => {
      if (!prochainEpisode) return;
      sauvegarde.currentEpisode = prochainEpisode;
      sauvegarde.currentNode = null;
      sauvegarde.currentBackground = null;
      sauvegarder(sauvegarde);
      demarrer();
    }
  });
}

demarrer().catch((erreur) => {
  console.error(erreur);
  conteneurJeu.textContent = "Erreur au chargement du jeu. Consulte la console.";
});
