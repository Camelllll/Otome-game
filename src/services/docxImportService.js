// Import d'épisode depuis un .docx écrit avec une syntaxe simplifiée (voir docs/modele-episode.txt) :
// - "PERSONNAGE : texte" = ligne de dialogue (sans "PERSONNAGE :" = narration).
// - "[decor: ...]", "[musique: ...]", "[illustration: ...]" = directives de mise en scène.
// - "- texte (perso+5)" = option de choix ; "-- PERSONNAGE : texte" juste après = réponse courte liée à cette option.
// - "- texte -> nom_de_scene" = l'option mène à une scène entière différente (voir "## nom_de_scene").
// - "## nom_de_scene" = marque le début d'un bloc nommé, atteignable depuis un "-> nom_de_scene".
// - "[fin]" ou "[fin: episode2]" = fin de l'épisode.
import mammoth from "https://esm.sh/mammoth@1.8.0";

function normaliserId(valeur) {
  return valeur
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

// Normalise un nom de section pour que "Scène Oui", "scene_oui" et "scene-oui" désignent la même chose.
function normaliserLabel(valeur) {
  return normaliserId(valeur).replace(/[^a-z0-9]/g, "");
}

// Extrait une destination explicite en fin de texte : "-> nom_de_scene".
function extraireDestination(texte) {
  const correspondance = texte.match(/->\s*(\S+)\s*$/);
  if (!correspondance) return { texte: texte.trim(), destination: null };
  return { texte: texte.slice(0, correspondance.index).trim(), destination: normaliserLabel(correspondance[1]) };
}

// Extrait un effet optionnel en fin de texte : "(perso+5)" ou "(perso:amitie-5)".
function extraireEffet(texte) {
  const correspondance = texte.match(/\(([a-zà-ÿ_]+)(?::(amitie|amour))?\s*([+-]\d+)\)\s*$/i);
  if (!correspondance) return { texte: texte.trim(), effets: {} };
  const perso = normaliserId(correspondance[1]);
  const jauge = (correspondance[2] || "amour").toLowerCase();
  const delta = Number(correspondance[3]);
  return { texte: texte.slice(0, correspondance.index).trim(), effets: { [perso]: { [jauge]: delta } } };
}

// Extrait "PERSONNAGE : texte" ; sans ce motif, la ligne est de la narration.
function extraireReplique(ligne) {
  const correspondance = ligne.match(/^([A-Za-zÀ-ÿ' ]{2,30})\s*:\s*(.+)$/);
  if (!correspondance) return { speaker: "narration", texte: ligne };
  return { speaker: normaliserId(correspondance[1]), texte: correspondance[2].trim() };
}

export async function parseDocxVersEpisode(arrayBuffer, episodeId, titre, personnagesConnus = new Set()) {
  const resultat = await mammoth.extractRawText({ arrayBuffer });
  const lignes = resultat.value
    .split(/\r?\n/)
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.length > 0);

  const nodes = {};
  let compteur = 0;
  const nouvelId = () => `n${++compteur}`;
  let premierId = null;
  let pendants = []; // liste de { type: "node", id } ou { type: "option", choiceId, index } en attente d'un ".next"
  let decorCourant = "";
  let musiqueCourante = "";
  let illustrationEnAttente = "";
  const avertissements = [];
  const sectionsDefinies = {}; // label normalisé -> id du premier nœud du bloc
  let sectionEnAttente = null; // label vu juste avant, à associer au prochain nœud créé
  const sautsEnAttente = []; // { type: "node"|"option", id/choiceId+index, label } à résoudre en fin de parsing

  function enregistrerSection(id) {
    if (sectionEnAttente) {
      sectionsDefinies[sectionEnAttente] = id;
      sectionEnAttente = null;
    }
  }

  function fixerSuite(idSuivant) {
    for (const pendant of pendants) {
      if (pendant.type === "node") {
        const noeud = nodes[pendant.id];
        if (noeud && !noeud.next) noeud.next = idSuivant;
      } else {
        const choix = nodes[pendant.choiceId];
        if (choix && !choix.options[pendant.index].next) choix.options[pendant.index].next = idSuivant;
      }
    }
  }

  function verifierPersonnage(speaker) {
    if (speaker === "narration" || speaker === "moi") return;
    if (personnagesConnus.size && !personnagesConnus.has(speaker)) {
      avertissements.push(`Personnage inconnu : "${speaker}" (vérifie l'orthographe dans le document).`);
    }
  }

  function creerNoeudDialogue(speaker, texte) {
    const id = nouvelId();
    enregistrerSection(id);
    verifierPersonnage(speaker);
    nodes[id] = {
      type: "line",
      speaker,
      text: texte,
      next: "",
      ...(decorCourant ? { background: decorCourant } : {}),
      ...(musiqueCourante ? { music: musiqueCourante } : {}),
      ...(illustrationEnAttente ? { cg: illustrationEnAttente } : {}),
    };
    illustrationEnAttente = "";
    return id;
  }

  let i = 0;
  while (i < lignes.length) {
    const ligne = lignes[i];

    const section = ligne.match(/^#{1,2}\s*(.+)$/);
    if (section) {
      sectionEnAttente = normaliserLabel(section[1]);
      i += 1;
      continue;
    }

    const directive = ligne.match(/^\[\s*(decor|musique|illustration|fin)\s*:?\s*([^\]]*)\]$/i);
    if (directive) {
      const type = directive[1].toLowerCase();
      const valeur = directive[2].trim();
      if (type === "decor") decorCourant = valeur;
      else if (type === "musique") musiqueCourante = valeur;
      else if (type === "illustration") illustrationEnAttente = valeur;
      else if (type === "fin") {
        const id = nouvelId();
        enregistrerSection(id);
        nodes[id] = { type: "end", text: "FIN", nextEpisode: valeur || null };
        fixerSuite(id);
        if (!premierId) premierId = id;
        pendants = [];
      }
      i += 1;
      continue;
    }

    if (ligne.startsWith("- ")) {
      const idChoix = nouvelId();
      enregistrerSection(idChoix);
      const options = [];

      while (i < lignes.length && lignes[i].startsWith("- ")) {
        const { texte: sansDestination, destination } = extraireDestination(lignes[i].slice(2));
        const { texte, effets } = extraireEffet(sansDestination);
        i += 1;

        let premierNoeudBranche = null;
        let dernierNoeudBranche = null;
        while (i < lignes.length && lignes[i].startsWith("-- ")) {
          const { speaker, texte: texteReplique } = extraireReplique(lignes[i].slice(3).trim());
          const idReplique = creerNoeudDialogue(speaker, texteReplique);
          if (dernierNoeudBranche) nodes[dernierNoeudBranche].next = idReplique;
          else premierNoeudBranche = idReplique;
          dernierNoeudBranche = idReplique;
          i += 1;
        }

        options.push({
          text: texte,
          effects: effets,
          next: premierNoeudBranche || "",
          __pendantId: dernierNoeudBranche,
          __destination: destination,
        });
      }

      nodes[idChoix] = {
        type: "choice",
        speaker: "moi",
        options: options.map(({ __pendantId, __destination, ...option }) => option),
      };
      fixerSuite(idChoix);
      if (!premierId) premierId = idChoix;

      pendants = [];
      options.forEach((option, index) => {
        if (option.__destination) {
          // Destination explicite (-> nom_de_scene) : résolue après le parsing complet du document,
          // pour autoriser une scène référencée plus loin dans le fichier.
          sautsEnAttente.push(
            option.__pendantId
              ? { type: "node", id: option.__pendantId, label: option.__destination }
              : { type: "option", choiceId: idChoix, index, label: option.__destination }
          );
        } else {
          pendants.push(
            option.__pendantId ? { type: "node", id: option.__pendantId } : { type: "option", choiceId: idChoix, index }
          );
        }
      });
      continue;
    }

    const { speaker, texte } = extraireReplique(ligne);
    const id = creerNoeudDialogue(speaker, texte);
    fixerSuite(id);
    if (!premierId) premierId = id;
    pendants = [{ type: "node", id }];
    i += 1;
  }

  for (const saut of sautsEnAttente) {
    const cible = sectionsDefinies[saut.label];
    if (!cible) {
      avertissements.push(`Destination introuvable : "${saut.label}" (vérifie qu'il existe bien un "## ${saut.label}").`);
      continue;
    }
    if (saut.type === "node") {
      if (!nodes[saut.id].next) nodes[saut.id].next = cible;
    } else if (!nodes[saut.choiceId].options[saut.index].next) {
      nodes[saut.choiceId].options[saut.index].next = cible;
    }
  }

  if (!premierId) throw new Error("Aucun contenu reconnu dans ce document (vérifie qu'il n'est pas vide).");

  return {
    episode: { id: episodeId, title: titre, start: premierId, nodes },
    avertissements,
  };
}

