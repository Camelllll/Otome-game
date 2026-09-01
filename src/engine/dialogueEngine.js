// Moteur de dialogue générique : lit un épisode JSON et fait avancer la progression nœud par nœud.
import { appliquerEffets } from "./relationManager.js";
import { sauvegarder } from "./saveSystem.js";

export class DialogueEngine {
  /**
   * @param {object} episodeData - JSON de l'épisode (voir data/episodes/episode1.json)
   * @param {Map<string, object>} personnagesParId - map id -> fiche personnage (characters.json aplati)
   * @param {object} sauvegarde - objet de sauvegarde courant (modifié en place)
   */
  constructor(episodeData, personnagesParId, sauvegarde) {
    this.episodeData = episodeData;
    this.personnagesParId = personnagesParId;
    this.sauvegarde = sauvegarde;
    // Restaure le dernier décor connu pour ne pas repartir sur un fond vide après une reprise de partie.
    this.background = sauvegarde.currentBackground || null;
    this.nodeId = sauvegarde.currentNode || episodeData.start;
    // Pagination : un texte trop long est découpé en pages de 3 lignes maximum, affichées une par une.
    this.pageIndex = 0;
  }

  get noeudCourant() {
    return this.episodeData.nodes[this.nodeId];
  }

  // Remplace les variables comme {playerName} dans un texte.
  interpoler(texte) {
    return texte.replaceAll("{playerName}", this.sauvegarde.playerName || "Sucrette");
  }

  // Retourne les informations d'affichage du nœud courant (texte, portrait, décor, choix...).
  obtenirAffichage() {
    const noeud = this.noeudCourant;
    if (!noeud) return null;

    if (noeud.background) {
      this.background = noeud.background;
      this.sauvegarde.currentBackground = noeud.background;
    }

    const personnage = this.personnagesParId.get(noeud.speaker);
    const nomAffiche = personnage ? personnage.name : this.nomSpeakerParDefaut(noeud.speaker);
    const portrait = noeud.portrait && personnage?.portraits ? personnage.portraits[noeud.portrait] : null;
    // false pour "moi"/"narration" et pour les nœuds sans speaker (ex. "end").
    const estPersonnageSurScene = Boolean(noeud.speaker) && noeud.speaker !== "moi" && noeud.speaker !== "narration";
    // Sprite plein pied affiché sur la scène : le portrait du nœud prime, sinon l'illustration par défaut du personnage.
    const spriteScene = estPersonnageSurScene ? (portrait || personnage?.sprite || null) : null;
    // Position sur scène : celle précisée dans le nœud, sinon celle par défaut du personnage, sinon à droite.
    const position = noeud.position || personnage?.stagePosition || "right";

    const { texte: textePage, aDautresPages } = this.obtenirPageDeTexte(noeud);

    const reponseSucrette = this.obtenirReponseSucrette(noeud);

    return {
      nodeId: this.nodeId,
      type: noeud.type,
      speakerId: noeud.speaker,
      speakerName: nomAffiche,
      text: textePage ? this.interpoler(textePage) : null,
      aDautresPages,
      portrait,
      spriteScene,
      position,
      estPersonnageSurScene,
      cg: noeud.cg || null,
      background: this.background,
      playerAvatar: this.personnagesParId.get("moi")?.sprite || null,
      options: noeud.type === "choice"
        ? noeud.options.map((option, index) => ({ index, text: this.interpoler(option.text) }))
        : null,
      affectedCharacters: noeud.type === "choice" ? this.obtenirPersonnagesAffectes(noeud) : [],
      reponseSucrette,
      nextEpisode: noeud.nextEpisode || null,
      // Mise en scène explicite définie dans l'admin (remplace la gestion automatique quand elle est présente).
      onScreen: Array.isArray(noeud.onScreen) ? noeud.onScreen : null
    };
  }

  // Une réplique de personnage peut être accompagnée immédiatement de la réponse de Sucrette dans la barre basse.
  obtenirReponseSucrette(noeud) {
    if (!noeud.next || noeud.type !== "line" || noeud.speaker === "moi" || noeud.speaker === "narration") return null;
    const suivant = this.episodeData.nodes[noeud.next];
    if (!suivant || suivant.type !== "line" || suivant.speaker !== "moi" || !suivant.text || !suivant.next) return null;
    return {
      text: this.interpoler(suivant.text),
      next: suivant.next || null
    };
  }

  // Découpe le texte du nœud en pages de 3 lignes maximum et retourne la page courante.
  obtenirPageDeTexte(noeud) {
    if (!noeud.text) return { texte: null, aDautresPages: false };
    const LIGNES_PAR_PAGE = 3;
    const lignes = noeud.text.split("\n");
    const debut = this.pageIndex * LIGNES_PAR_PAGE;
    const page = lignes.slice(debut, debut + LIGNES_PAR_PAGE);
    const aDautresPages = debut + LIGNES_PAR_PAGE < lignes.length;
    return { texte: page.join("\n"), aDautresPages };
  }

  nomSpeakerParDefaut(speakerId) {
    const noms = { moi: this.sauvegarde.playerName || "Sucrette", narration: "" };
    return noms[speakerId] ?? speakerId;
  }

  // Fait avancer le dialogue vers le nœud suivant (cas d'une simple ligne).
  avancer() {
    const noeud = this.noeudCourant;
    if (!noeud || noeud.type === "end") return this.obtenirAffichage();
    if (noeud.type === "choice") return this.obtenirAffichage(); // il faut choisir, pas avancer
    // S'il reste des pages de texte à afficher pour ce nœud, on tourne la page avant de changer de nœud.
    const { aDautresPages } = this.obtenirPageDeTexte(noeud);
    if (aDautresPages) {
      this.pageIndex += 1;
      return this.obtenirAffichage();
    }
    this.aller(noeud.next);
    return this.obtenirAffichage();
  }

  // Valide un choix : applique les effets sur les jauges puis se déplace vers le nœud lié.
  choisir(indexOption) {
    const noeud = this.noeudCourant;
    if (!noeud || noeud.type !== "choice") return this.obtenirAffichage();
    const option = noeud.options[indexOption];
    if (!option) return this.obtenirAffichage();
    appliquerEffets(this.sauvegarde, option.effects);
    this.aller(option.next);
    return this.obtenirAffichage();
  }

  aller(nodeId) {
    this.nodeId = nodeId;
    this.pageIndex = 0;
    this.sauvegarde.currentNode = nodeId;
    sauvegarder(this.sauvegarde);
  }

  estTermine() {
    return this.noeudCourant?.type === "end";
  }

  // Liste les personnages concernés par les effets des choix du nœud (pour la barre de compatibilité).
  obtenirPersonnagesAffectes(noeud) {
    const ids = new Set();
    for (const option of noeud.options) {
      for (const id of Object.keys(option.effects || {})) ids.add(id);
    }
    return this.obtenirInfosPersonnages([...ids]);
  }

  // Reconstruit les infos d'affichage (nom + jauges à jour) pour une liste d'identifiants de personnages.
  obtenirInfosPersonnages(ids) {
    return ids.map((id) => {
      const personnage = this.personnagesParId.get(id);
      // null si ce personnage n'a pas de jauge définie (ex. les parents) : pas de lovomètre à afficher.
      const jaugesParDefaut = personnage?.gauges ? { ...personnage.gauges } : null;
      return {
        id,
        name: personnage?.name || id,
        gauges: this.sauvegarde.gauges[id] || jaugesParDefaut
      };
    });
  }
}

// Construit une map id -> personnage à partir du fichier characters.json (crushs + secondaires + player).
export function aplatirPersonnages(charactersData) {
  const map = new Map();
  map.set(charactersData.player.id, { name: charactersData.player.defaultName, ...charactersData.player });
  for (const perso of charactersData.crushs) map.set(perso.id, perso);
  for (const perso of charactersData.secondary) map.set(perso.id, perso);
  return map;
}
