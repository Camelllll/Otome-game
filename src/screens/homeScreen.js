// Écran d'accueil du jeu : titre, intro, bouton démarrage, personnages dispersés en arrière-plan.
import { chargerSauvegarde, reinitialiserSauvegarde } from "../engine/saveSystem.js";
import { MusiqueAmbiance } from "../ui/backgroundMusic.js";

export async function lancerEcranAccueil(conteneurRacine, { joueur, onDemarrer }) {
  // Lancer la musique d'ambiance
  const musique = new MusiqueAmbiance();
  
  const accueil = document.createElement("div");
  accueil.className = "ecran-accueil";

  // Fond décoratif avec dégradé
  const fond = document.createElement("div");
  fond.className = "fond-accueil";
  accueil.appendChild(fond);

  // Zone personnages dispersés (arrière-plan)
  const zonePersonnagesArriere = document.createElement("div");
  zonePersonnagesArriere.className = "zone-personnages-arriere";

  const personnages = [
    { name: "Isaac", top: "8%", left: "5%", width: "22%" },
    { name: "Aaron", top: "15%", right: "8%", width: "26%" },
    { name: "Sasha", top: "45%", left: "2%", width: "20%" },
    { name: "Camel", top: "40%", right: "5%", width: "23%" },
    { name: "Mehdi", bottom: "5%", left: "40%", transform: "translateX(-50%)", width: "24%" }
  ];

  personnages.forEach((perso) => {
    const imgContainer = document.createElement("div");
    imgContainer.className = "perso-arriere";
    if (perso.top) imgContainer.style.top = perso.top;
    if (perso.bottom) imgContainer.style.bottom = perso.bottom;
    if (perso.left) imgContainer.style.left = perso.left;
    if (perso.right) imgContainer.style.right = perso.right;
    if (perso.transform) imgContainer.style.transform = perso.transform;

    const img = document.createElement("img");
    img.src = `assets/Personnages/Crushs/PNG/${perso.name}.png`;
    img.alt = perso.name;
    img.style.width = perso.width;
    img.style.height = "auto";
    img.onerror = () => {
      imgContainer.style.display = "none";
    };

    imgContainer.appendChild(img);
    zonePersonnagesArriere.appendChild(imgContainer);
  });

  accueil.appendChild(zonePersonnagesArriere);

  // Voile semi-transparent pour lisibilité du texte
  const voile = document.createElement("div");
  voile.className = "voile-accueil";
  accueil.appendChild(voile);

  // Contenu principal (superposé)
  const contenu = document.createElement("div");
  contenu.className = "contenu-accueil";

  // Titre principal
  const titre = document.createElement("h1");
  titre.className = "titre-accueil";
  titre.textContent = "Choisis-moi";
  contenu.appendChild(titre);

  // Sous-titre
  const sousTitre = document.createElement("p");
  sousTitre.className = "sous-titre-accueil";
  sousTitre.textContent = "Université Aster";
  contenu.appendChild(sousTitre);

  // Intro texte
  const intro = document.createElement("p");
  intro.className = "intro-accueil";
  intro.innerHTML = "Bienvenue à l'Université Aster.<br/>Ici, chaque cœur a son histoire,<br/>et chaque choix change ton destin.";
  contenu.appendChild(intro);

  // Zone boutons
  const zoneBoutons = document.createElement("div");
  zoneBoutons.className = "zone-boutons-accueil";

  // Bouton Continuer
  const sauvegarde = await chargerSauvegarde(joueur.id);
  const aDejaJoue = Boolean(sauvegarde.currentNode) || sauvegarde.playerName !== "Sucrette";
  if (aDejaJoue) {
    const btnContinuer = document.createElement("button");
    btnContinuer.className = "btn-accueil btn-continuer";
    btnContinuer.textContent = `Continuer (${sauvegarde.playerName})`;
    btnContinuer.addEventListener("click", () => onDemarrer("continuer"));
    zoneBoutons.appendChild(btnContinuer);
  }

  // Bouton Nouvelle partie
  const btnNouvelle = document.createElement("button");
  btnNouvelle.className = "btn-accueil btn-nouvelle";
  btnNouvelle.textContent = "Nouvelle partie";
  btnNouvelle.addEventListener("click", async () => {
    await reinitialiserSauvegarde(joueur.id);
    onDemarrer("nouvelle");
  });
  zoneBoutons.appendChild(btnNouvelle);

  contenu.appendChild(zoneBoutons);
  accueil.appendChild(contenu);

  // Démarrer la musique au premier clic
  accueil.addEventListener("pointerdown", () => musique.demarrer(), { once: true });

  conteneurRacine.innerHTML = "";
  conteneurRacine.appendChild(accueil);
}
