// Écran de connexion / inscription : ambiance Otome Game / Amour Sucré avec logo Pomme d'Amour.
import { creerCompteJoueur, connexionJoueur } from "../services/playerRepository.js";

export function lancerEcranConnexion(conteneurRacine, { onConnecte }) {
  let onglet = "connexion";

  const ecran = document.createElement("div");
  ecran.className = "ecran-connexion";

  // Fond immersif campus avec flou doux
  const fondDecor = document.createElement("img");
  fondDecor.className = "decor-fond-connexion";
  fondDecor.src = "assets/Décors/Entrée campus.png";
  fondDecor.alt = "Entrée du campus de l'Université Aster";
  ecran.appendChild(fondDecor);

  // Voile coloré teinté rouge pomme
  const voile = document.createElement("div");
  voile.className = "voile-connexion";
  ecran.appendChild(voile);

  // Particules cœurs romantiques flottantes
  const zoneParticules = document.createElement("div");
  zoneParticules.className = "particules-flottantes";
  for (let i = 0; i < 12; i++) {
    const coeur = document.createElement("span");
    coeur.className = "particule-coeur";
    coeur.textContent = i % 3 === 0 ? "🍎" : i % 2 === 0 ? "♥" : "✦";
    coeur.style.left = `${Math.random() * 95}%`;
    coeur.style.animationDelay = `${Math.random() * 7}s`;
    coeur.style.animationDuration = `${7 + Math.random() * 6}s`;
    zoneParticules.appendChild(coeur);
  }
  ecran.appendChild(zoneParticules);

  // Boîte principale style Amour Sucré
  const carte = document.createElement("div");
  carte.className = "carte-connexion";

  // Logo du jeu Pomme d'Amour
  const wrapperLogo = document.createElement("div");
  wrapperLogo.className = "logo-connexion-wrapper";
  const logo = document.createElement("img");
  logo.className = "logo-connexion";
  logo.src = "assets/logo/Logo Pomme d'Amour.png";
  logo.alt = "Pomme d'Amour — Otome Game";
  wrapperLogo.appendChild(logo);
  carte.appendChild(wrapperLogo);

  const sousTitre = document.createElement("p");
  sousTitre.className = "sous-titre-connexion";
  sousTitre.textContent = "Université Aster · Romance & Choix";
  carte.appendChild(sousTitre);

  // Onglets Se connecter / S'inscrire
  const onglets = document.createElement("div");
  onglets.className = "onglets-connexion";

  const btnConnexion = document.createElement("button");
  btnConnexion.type = "button";
  btnConnexion.className = "btn-onglet";
  btnConnexion.innerHTML = "Se connecter";

  const btnInscription = document.createElement("button");
  btnInscription.type = "button";
  btnInscription.className = "btn-onglet";
  btnInscription.innerHTML = "Nouveau compte";

  onglets.append(btnConnexion, btnInscription);
  carte.appendChild(onglets);

  // Formulaire
  const formulaire = document.createElement("form");
  formulaire.className = "formulaire-connexion";
  formulaire.setAttribute("onsubmit", "return false");

  // Champ Pseudo
  const groupePseudo = document.createElement("div");
  groupePseudo.className = "groupe-champ";
  const labelPseudo = document.createElement("label");
  labelPseudo.className = "label-champ";
  labelPseudo.textContent = "Prénom de ton héroïne";
  const wrapperPseudo = document.createElement("div");
  wrapperPseudo.className = "champ-saisie-wrapper";
  const iconePseudo = document.createElement("span");
  iconePseudo.className = "champ-icone";
  iconePseudo.textContent = "🎀";
  const champPseudo = document.createElement("input");
  champPseudo.type = "text";
  champPseudo.className = "champ-saisie";
  champPseudo.placeholder = "Ex : Sucrette";
  champPseudo.maxLength = 40;
  wrapperPseudo.append(iconePseudo, champPseudo);
  groupePseudo.append(labelPseudo, wrapperPseudo);

  // Champ Email
  const groupeEmail = document.createElement("div");
  groupeEmail.className = "groupe-champ";
  const labelEmail = document.createElement("label");
  labelEmail.className = "label-champ";
  labelEmail.textContent = "Adresse email";
  const wrapperEmail = document.createElement("div");
  wrapperEmail.className = "champ-saisie-wrapper";
  const iconeEmail = document.createElement("span");
  iconeEmail.className = "champ-icone";
  iconeEmail.textContent = "💌";
  const champEmail = document.createElement("input");
  champEmail.type = "email";
  champEmail.className = "champ-saisie";
  champEmail.placeholder = "ton-email@exemple.com";
  champEmail.required = true;
  champEmail.maxLength = 100;
  wrapperEmail.append(iconeEmail, champEmail);
  groupeEmail.append(labelEmail, wrapperEmail);

  // Champ Mot de passe
  const groupeMotDePasse = document.createElement("div");
  groupeMotDePasse.className = "groupe-champ";
  const labelMotDePasse = document.createElement("label");
  labelMotDePasse.className = "label-champ";
  labelMotDePasse.textContent = "Mot de passe secret";
  const wrapperMotDePasse = document.createElement("div");
  wrapperMotDePasse.className = "champ-saisie-wrapper";
  const iconeMotDePasse = document.createElement("span");
  iconeMotDePasse.className = "champ-icone";
  iconeMotDePasse.textContent = "🔒";
  const champMotDePasse = document.createElement("input");
  champMotDePasse.type = "password";
  champMotDePasse.className = "champ-saisie";
  champMotDePasse.placeholder = "••••••••";
  champMotDePasse.required = true;
  champMotDePasse.maxLength = 100;
  wrapperMotDePasse.append(iconeMotDePasse, champMotDePasse);
  groupeMotDePasse.append(labelMotDePasse, wrapperMotDePasse);

  // Message d'erreur
  const messageErreur = document.createElement("p");
  messageErreur.className = "message-alerte";

  // Bouton CTA
  const boutonValider = document.createElement("button");
  boutonValider.type = "submit";
  boutonValider.className = "bouton-cta-connexion";
  boutonValider.textContent = "Entrer sur le Campus";

  formulaire.append(groupeEmail, groupeMotDePasse, messageErreur, boutonValider);
  carte.appendChild(formulaire);

  const texteBas = document.createElement("p");
  texteBas.className = "texte-bas-connexion";
  texteBas.textContent = "Prêt(e) à rencontrer Isaac, Aaron, Sasha, Camel et les autres ?";
  carte.appendChild(texteBas);

  ecran.appendChild(carte);

  function appliquerOnglet() {
    btnConnexion.classList.toggle("actif", onglet === "connexion");
    btnInscription.classList.toggle("actif", onglet === "inscription");
    
    if (onglet === "connexion") {
      boutonValider.innerHTML = "🌸 Entrer sur le Campus 🌸";
      if (formulaire.contains(groupePseudo)) {
        formulaire.removeChild(groupePseudo);
      }
    } else {
      boutonValider.innerHTML = "💖 Commencer l'Aventure";
      if (!formulaire.contains(groupePseudo)) {
        formulaire.insertBefore(groupePseudo, groupeEmail);
      }
    }
    messageErreur.textContent = "";
  }

  btnConnexion.addEventListener("click", () => {
    onglet = "connexion";
    appliquerOnglet();
  });

  btnInscription.addEventListener("click", () => {
    onglet = "inscription";
    appliquerOnglet();
  });

  async function validerFormulaire() {
    messageErreur.textContent = "";
    if (!champEmail.value.trim() || !champMotDePasse.value) {
      messageErreur.textContent = "⚠️ Merci de renseigner tous les champs obligatoires.";
      return;
    }

    boutonValider.disabled = true;
    const ancienTexte = boutonValider.innerHTML;
    boutonValider.innerHTML = "⏳ Chargement...";

    try {
      const joueur =
        onglet === "connexion"
          ? await connexionJoueur(champEmail.value, champMotDePasse.value)
          : await creerCompteJoueur(champEmail.value, champMotDePasse.value, champPseudo.value);
      onConnecte(joueur);
    } catch (erreur) {
      messageErreur.textContent = erreur.message || "Connexion impossible, vérifie tes identifiants.";
      boutonValider.disabled = false;
      boutonValider.innerHTML = ancienTexte;
    }
  }

  boutonValider.addEventListener("click", (e) => {
    e.preventDefault();
    validerFormulaire();
  });

  formulaire.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      validerFormulaire();
    }
  });

  appliquerOnglet();

  conteneurRacine.innerHTML = "";
  conteneurRacine.appendChild(ecran);
}

