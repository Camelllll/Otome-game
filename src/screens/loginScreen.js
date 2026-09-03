// Écran de connexion / inscription : compte joueur via Supabase Auth (email + mot de passe).
import { creerCompteJoueur, connexionJoueur } from "../services/playerRepository.js";

export function lancerEcranConnexion(conteneurRacine, { onConnecte }) {
  let onglet = "connexion";

  const ecran = document.createElement("div");
  ecran.className = "ecran-connexion";

  const contenu = document.createElement("div");
  contenu.className = "contenu-connexion";

  const titre = document.createElement("h1");
  titre.textContent = "Choisis-moi";
  contenu.appendChild(titre);

  const onglets = document.createElement("div");
  onglets.className = "onglets-connexion";
  const btnConnexion = document.createElement("button");
  btnConnexion.type = "button";
  btnConnexion.textContent = "Se connecter";
  const btnInscription = document.createElement("button");
  btnInscription.type = "button";
  btnInscription.textContent = "Créer un compte";
  onglets.append(btnConnexion, btnInscription);
  contenu.appendChild(onglets);

  const sousTitre = document.createElement("p");
  contenu.appendChild(sousTitre);

  const formulaire = document.createElement("form");
  formulaire.className = "formulaire-connexion";
  formulaire.setAttribute("onsubmit", "return false");

  const champPseudo = document.createElement("input");
  champPseudo.type = "text";
  champPseudo.placeholder = "Prénom de ton héroïne";
  champPseudo.maxLength = 40;

  const champEmail = document.createElement("input");
  champEmail.type = "email";
  champEmail.placeholder = "Email";
  champEmail.required = true;
  champEmail.maxLength = 100;

  const champMotDePasse = document.createElement("input");
  champMotDePasse.type = "password";
  champMotDePasse.placeholder = "Mot de passe";
  champMotDePasse.required = true;
  champMotDePasse.maxLength = 100;

  const messageErreur = document.createElement("p");
  messageErreur.className = "erreur-connexion";

  const boutonValider = document.createElement("button");
  boutonValider.type = "button";
  boutonValider.textContent = "Entrer dans l'université";

  formulaire.append(champEmail, champMotDePasse, messageErreur, boutonValider);
  contenu.appendChild(formulaire);
  ecran.appendChild(contenu);

  function appliquerOnglet() {
    btnConnexion.classList.toggle("actif", onglet === "connexion");
    btnInscription.classList.toggle("actif", onglet === "inscription");
    sousTitre.textContent =
      onglet === "connexion"
        ? "Connecte-toi pour retrouver ta partie."
        : "Crée ton compte pour commencer l'aventure.";
    boutonValider.textContent = onglet === "connexion" ? "Se connecter" : "Créer mon compte";
    messageErreur.textContent = "";
    if (onglet === "inscription" && !formulaire.contains(champPseudo)) {
      formulaire.insertBefore(champPseudo, champEmail);
    } else if (onglet === "connexion" && formulaire.contains(champPseudo)) {
      formulaire.removeChild(champPseudo);
    }
  }

  btnConnexion.addEventListener("click", () => {
    onglet = "connexion";
    appliquerOnglet();
  });
  btnInscription.addEventListener("click", () => {
    onglet = "inscription";
    appliquerOnglet();
  });

  boutonValider.addEventListener("click", async () => {
    messageErreur.textContent = "";
    boutonValider.disabled = true;
    try {
      const joueur =
        onglet === "connexion"
          ? await connexionJoueur(champEmail.value, champMotDePasse.value)
          : await creerCompteJoueur(champEmail.value, champMotDePasse.value, champPseudo.value);
      onConnecte(joueur);
    } catch (erreur) {
      messageErreur.textContent = erreur.message || "Connexion impossible, réessaie.";
      boutonValider.disabled = false;
    }
  });

  appliquerOnglet();

  conteneurRacine.innerHTML = "";
  conteneurRacine.appendChild(ecran);
}

