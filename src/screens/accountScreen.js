import { construireCarnet, creer, bouton } from "./profileScreen.js";
import { appelApi, oublierJeton } from "../services/apiClient.js";
import { demanderConfirmation } from "../ui/gameModal.js";
import { normaliserNomJoueur } from "../engine/playerName.js";

export async function lancerEcranCompte(racine, { joueur, onProfil, onRetour, onAccueil, libelleRetour, onModifie, onAvantSuppression, onSupprime }) {
  const { ecran, gauche, droite, afficherPage } = construireCarnet(racine, {
    compte: true, onRetour, onAccueil, libelleRetour, onCarnet: onProfil, onCompte: () => {},
  });
  gauche.append(creer("h1", "pda-titre", "Mon compte"),
    creer("p", "pda-notice", "Informations privées. Toute modification exige ton mot de passe actuel."));
  const informations = creer("div");
  const message = creer("p", "pda-notice", "Chargement de tes informations…");
  message.setAttribute("role", "status");
  gauche.append(informations, message, bouton("← Mon carnet", onProfil));
  droite.append(creer("h2", "pda-titre-section", "Informations personnelles"));
  const edition = creer("div", "pda-edition");
  const retourEdition = () => {
    droite.dataset.edition = "false";
    edition.replaceChildren(creer("p", "pda-notice", "Choisis une information à modifier."));
    afficherPage("gauche");
  };
  retourEdition();
  droite.append(edition);
  let compte;

  function champ(formulaire, texte, nom, type, options = {}) {
    const label = creer("label", "", texte);
    const input = document.createElement("input");
    Object.assign(input, { name: nom, type, required: true, ...options });
    label.append(input);
    formulaire.append(label);
    return input;
  }

  function editer(type) {
    const titres = { email: "Modifier l’adresse e-mail", pseudo: "Modifier le pseudo", password: "Modifier le mot de passe" };
    const formulaire = creer("form", "pda-formulaire");
    formulaire.append(creer("h2", "pda-titre-section", titres[type]));
    if (type === "email") {
      champ(formulaire, "Nouvelle adresse e-mail", "email", "email", { maxLength: 100, autoComplete: "email", value: compte.email });
      formulaire.append(creer("p", "pda-notice", "La modification est immédiate après vérification de ton mot de passe. Aucun e-mail de confirmation n’est actuellement envoyé."));
    } else if (type === "pseudo") {
      champ(formulaire, "Nouveau pseudo", "pseudo", "text", { minLength: 3, maxLength: 40, autoComplete: "nickname", value: compte.pseudo });
      formulaire.append(creer("p", "pda-notice", "3 à 40 caractères : lettres, chiffres, espaces, tirets et traits de soulignement. Les pseudos ne sont pas uniques dans le jeu."));
    }
    champ(formulaire, "Mot de passe actuel", "current_password", "password", { maxLength: 100, autoComplete: "current-password" });
    if (type === "password") {
      champ(formulaire, "Nouveau mot de passe", "password", "password", { minLength: 8, maxLength: 100, autoComplete: "new-password" });
      champ(formulaire, "Confirmer le nouveau mot de passe", "password_confirmation", "password", { minLength: 8, maxLength: 100, autoComplete: "new-password" });
    }
    const statut = creer("p", "pda-erreur");
    statut.setAttribute("role", "alert");
    const valider = creer("button", "pda-bouton", "Enregistrer");
    valider.type = "submit";
    const actions = creer("div", "pda-actions-formulaire");
    actions.append(valider, bouton("Annuler", retourEdition));
    formulaire.append(statut, actions);
    formulaire.addEventListener("submit", async event => {
      event.preventDefault();
      const corps = Object.fromEntries(new FormData(formulaire));
      if (type === "password" && corps.password !== corps.password_confirmation) {
        statut.textContent = "Les nouveaux mots de passe doivent être identiques.";
        return;
      }
      valider.disabled = true;
      statut.textContent = "";
      try {
        const resultat = await appelApi("/account", { method: "PATCH", corps });
        compte = { ...resultat.player, pseudo: normaliserNomJoueur(resultat.player.pseudo) };
        Object.assign(joueur, { pseudo: compte.pseudo });
        onModifie(compte);
        formulaire.reset();
        afficherInformations();
        retourEdition();
        message.textContent = "Tes informations ont été mises à jour.";
      } catch (erreur) {
        statut.textContent = erreur.message;
      } finally {
        valider.disabled = false;
      }
    });
    edition.replaceChildren(formulaire);
    droite.dataset.edition = "true";
    afficherPage("droite");
    formulaire.querySelector("input").focus({ preventScroll: true });
  }

  function afficherInformations() {
    informations.replaceChildren();
    [["Adresse e-mail", compte.email, "email"], ["Pseudo", compte.pseudo, "pseudo"], ["Mot de passe", "••••••••••", "password"]].forEach(([titre, valeur, type]) => {
      const ligne = creer("section", "pda-compte-ligne");
      const contenu = creer("div", "pda-compte-valeur");
      const modifier = bouton("Modifier", () => editer(type));
      modifier.setAttribute("aria-label", `Modifier : ${titre}`);
      contenu.append(creer("p", "", valeur), modifier);
      ligne.append(creer("h2", "", titre), contenu);
      informations.append(ligne);
    });
  }

  const danger = creer("section", "pda-danger");
  danger.append(creer("h2", "", "Zone dangereuse"),
    creer("p", "", "La suppression du compte est définitive et efface ta progression associée."));
  const supprimer = bouton("Supprimer mon compte", async () => {
    supprimer.disabled = true;
    const confirme = await demanderConfirmation({
      titre: "Supprimer mon compte",
      message: "Cette action est définitive. La suppression de ton compte entraînera la perte de tes informations personnelles et de ta progression associée. Souhaites-tu vraiment continuer ?",
      confirmer: "Continuer la suppression",
      avertissement: true,
    });
    supprimer.disabled = false;
    if (!confirme || !racine.contains(ecran)) return;
    const formulaire = creer("form", "pda-formulaire");
    formulaire.append(creer("h2", "pda-titre-section", "Confirmer la suppression"));
    champ(formulaire, "Mot de passe actuel", "current_password", "password", { maxLength: 100, autoComplete: "current-password" });
    champ(formulaire, "Saisis SUPPRIMER pour confirmer", "confirmation", "text", { autoComplete: "off", pattern: "SUPPRIMER" });
    const statut = creer("p", "pda-erreur");
    statut.setAttribute("role", "alert");
    const confirmer = creer("button", "pda-bouton", "Supprimer définitivement");
    confirmer.type = "submit";
    const actions = creer("div", "pda-actions-formulaire");
    actions.append(confirmer, bouton("Annuler", retourEdition));
    formulaire.append(statut, actions);
    formulaire.addEventListener("submit", async event => {
      event.preventDefault();
      confirmer.disabled = true;
      try {
        await onAvantSuppression?.();
        await appelApi("/account", { method: "DELETE", corps: Object.fromEntries(new FormData(formulaire)) });
        formulaire.reset();
        oublierJeton();
        onSupprime();
      } catch (erreur) {
        statut.textContent = erreur.message;
        confirmer.disabled = false;
      }
    });
    edition.replaceChildren(formulaire);
    droite.dataset.edition = "true";
    afficherPage("droite");
    formulaire.querySelector("input").focus({ preventScroll: true });
  });
  supprimer.disabled = true;
  danger.append(supprimer);
  droite.append(danger);
  try {
    const resultat = await appelApi("/account");
    if (!racine.contains(ecran)) return;
    compte = { ...resultat.player, pseudo: normaliserNomJoueur(resultat.player.pseudo) };
    afficherInformations();
    message.textContent = "";
    supprimer.disabled = false;
  } catch (erreur) {
    message.className = "pda-erreur";
    message.textContent = erreur.message;
  }
}
