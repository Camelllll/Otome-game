// Bulle semi-transparente pour les personnages présents dans la scène.
export function afficherBullePersonnage(conteneur, affichage) {
  // La bulle reste visible pendant la réplique suivante de Sucrette : elle donne du rythme à l'échange.
  if (!affichage.estPersonnageSurScene || !affichage.text) return;
  conteneur.replaceChildren();

  const bulle = document.createElement("div");
  bulle.className = `bulle-personnage pos-${affichage.position || "center"}`;

  const nom = document.createElement("span");
  nom.className = "nom-bulle-personnage";
  nom.textContent = affichage.speakerName;

  const texte = document.createElement("span");
  texte.className = "texte-bulle-personnage";
  texte.innerHTML = affichage.text.replaceAll("\n", "<br>");
  bulle.append(nom, texte);
  conteneur.appendChild(bulle);
}

// Composant d'interface : barre du bas (narration / héroïne), toujours avec l'avatar du perso principal.
export function afficherBarreNarration(conteneur, affichage, callbacks) {
  conteneur.innerHTML = "";

  const barre = document.createElement("div");
  // Une seule barre pleine largeur pour tous les textes : elle ne recouvre jamais le décor utile.
  barre.className = "barre-narration";

  if (affichage.playerAvatar) {
    const avatar = document.createElement("img");
    avatar.src = affichage.playerAvatar;
    avatar.className = "avatar-joueur";
    barre.appendChild(avatar);
  }

  const contenu = document.createElement("div");
  contenu.className = "contenu-narration";

  // Quand un personnage parle, sa bulle est accompagnée immédiatement de la réponse suivante de Sucrette.
  const texteBas = affichage.estPersonnageSurScene ? affichage.reponseSucrette?.text : affichage.text;
  if (texteBas) {
    const texte = document.createElement("div");
    texte.className = affichage.type === "end" ? "texte-dialogue texte-fin" : "texte-dialogue";
    const nomBas = affichage.estPersonnageSurScene ? "Sucrette" : affichage.speakerName;
    const prefixeNom = nomBas
      ? `<span class="nom-personnage-inline">${nomBas}.</span> `
      : "";
    texte.innerHTML = prefixeNom + texteBas.replaceAll("\n", "<br>");
    contenu.appendChild(texte);
  }

  if (affichage.type === "choice") {
    const listeChoix = document.createElement("div");
    listeChoix.className = "liste-choix";
    for (const option of affichage.options) {
      const bouton = document.createElement("button");
      bouton.className = "bouton-choix";
      bouton.textContent = option.text;
      bouton.addEventListener("click", () => callbacks.onChoix(option.index));
      listeChoix.appendChild(bouton);
    }
    contenu.appendChild(listeChoix);
  } else {
    // Toute la barre de dialogue devient la commande de progression : plus immersive qu'un bouton isolé.
    barre.classList.add("dialogue-cliquable");
    barre.tabIndex = 0;
    barre.setAttribute("role", "button");
    barre.setAttribute("aria-label", "Passer au dialogue suivant");
    const avancer = () => callbacks.onSuivant();
    barre.addEventListener("click", avancer);
    barre.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        avancer();
      }
    });
  }

  if (affichage.estPersonnageSurScene && !affichage.reponseSucrette) barre.classList.add("sans-texte");

  barre.appendChild(contenu);
  conteneur.appendChild(barre);
}

// Écran de fin d'épisode : remplace la barre de dialogue par un panneau centré avec un bouton stylisé.
export function afficherFinEpisode(conteneur, { aProchainEpisode, onContinuer }) {
  conteneur.innerHTML = "";
  conteneur.classList.add("visible");

  const panneau = document.createElement("div");
  panneau.className = "fin-episode-panneau";

  const titre = document.createElement("h2");
  titre.textContent = "Fin de l'épisode";
  panneau.appendChild(titre);

  const texte = document.createElement("p");
  texte.textContent = aProchainEpisode
    ? "Bravo, tu as terminé cet épisode !"
    : "Tu as terminé le dernier épisode disponible pour l'instant.";
  panneau.appendChild(texte);

  const bouton = document.createElement("button");
  bouton.className = "btn-accueil btn-continuer";
  bouton.textContent = aProchainEpisode ? "Épisode suivant" : "Retour à la sélection";
  bouton.addEventListener("click", onContinuer);
  panneau.appendChild(bouton);

  conteneur.appendChild(panneau);
}
