// Écran d'accueil du jeu : bannière illustrée officielle, intro et boutons de lancement.
import { chargerSauvegarde, reinitialiserSauvegarde, aUneProgression } from "../engine/saveSystem.js";
import { MusiqueAmbiance } from "../ui/backgroundMusic.js";

export async function lancerEcranAccueil(conteneurRacine, { joueur, onDemarrer }) {
  // Lancer la musique d'ambiance
  const musique = new MusiqueAmbiance();
  
  const accueil = document.createElement("div");
  accueil.className = "ecran-accueil";

  // Fond décoratif de secours (pendant le chargement de la bannière)
  const fond = document.createElement("div");
  fond.className = "fond-accueil";
  accueil.appendChild(fond);

  // Bannière officielle : campus + les 4 prétendants + logo intégré
  const fondImage = document.createElement("img");
  fondImage.className = "fond-accueil-image";
  fondImage.src = "assets/Décors/page d'accueil 2.png";
  fondImage.alt = "Pomme d'Amour — Université Aster";
  accueil.appendChild(fondImage);

  // Voile dégradé bas d'écran pour la lisibilité du panneau de boutons
  const voile = document.createElement("div");
  voile.className = "voile-accueil";
  accueil.appendChild(voile);

  // Particules cœurs / pommes romantiques flottantes
  const zoneParticules = document.createElement("div");
  zoneParticules.className = "particules-flottantes";
  for (let i = 0; i < 14; i++) {
    const coeur = document.createElement("span");
    coeur.className = "particule-coeur";
    coeur.textContent = i % 3 === 0 ? "🍎" : i % 2 === 0 ? "♥" : "✦";
    coeur.style.left = `${Math.random() * 95}%`;
    coeur.style.animationDelay = `${Math.random() * 7}s`;
    coeur.style.animationDuration = `${8 + Math.random() * 6}s`;
    zoneParticules.appendChild(coeur);
  }
  accueil.appendChild(zoneParticules);

  // Contenu principal (panneau bas d'écran)
  const contenu = document.createElement("div");
  contenu.className = "contenu-accueil";

  // Étiquette ruban façon marque-page de jeu
  const ruban = document.createElement("div");
  ruban.className = "ruban-accueil";
  ruban.innerHTML = "<span>🎓</span> Université Aster";
  contenu.appendChild(ruban);

  // Intro texte
  const intro = document.createElement("p");
  intro.className = "intro-accueil";
  intro.innerHTML = "Chaque cœur a son histoire, et chaque choix change ton destin.";
  contenu.appendChild(intro);

  // Zone boutons
  const zoneBoutons = document.createElement("div");
  zoneBoutons.className = "zone-boutons-accueil";

  // Bouton Continuer : la progression vient de la base, pas du navigateur.
  const sauvegarde = await chargerSauvegarde(joueur.id);
  if (aUneProgression(sauvegarde)) {
    const btnContinuer = document.createElement("button");
    btnContinuer.className = "btn-accueil btn-continuer";
    btnContinuer.innerHTML = `<span>💖</span> Continuer (${sauvegarde.playerName || "Sucrette"})`;
    btnContinuer.addEventListener("click", () => onDemarrer("continuer", sauvegarde));
    zoneBoutons.appendChild(btnContinuer);
  }

  // Bouton Nouvelle partie
  const btnNouvelle = document.createElement("button");
  btnNouvelle.className = "btn-accueil btn-nouvelle";
  btnNouvelle.innerHTML = "<span>✨</span> Nouvelle partie";
  btnNouvelle.addEventListener("click", async () => {
    if (aUneProgression(sauvegarde) && !window.confirm("Commencer une nouvelle partie effacera ta progression actuelle. Continuer ?")) {
      return;
    }
    btnNouvelle.disabled = true;
    try {
      const nouvelleSauvegarde = await reinitialiserSauvegarde(joueur.id);
      onDemarrer("nouvelle", nouvelleSauvegarde);
    } finally {
      btnNouvelle.disabled = false;
    }
  });
  zoneBoutons.appendChild(btnNouvelle);

  contenu.appendChild(zoneBoutons);
  accueil.appendChild(contenu);

  // Démarrer la musique au premier clic
  accueil.addEventListener("pointerdown", () => musique.demarrer(), { once: true });

  conteneurRacine.innerHTML = "";
  conteneurRacine.appendChild(accueil);
}
