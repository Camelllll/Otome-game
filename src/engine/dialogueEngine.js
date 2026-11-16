// Moteur de dialogue générique : lit un épisode JSON et fait avancer la progression nœud par nœud.
import { appliquerEffets, poserFlags, resoudreBranche } from "./relationManager.js";
import { sauvegarder, sauvegarderMaintenant, enregistrerChoix } from "./saveSystem.js";
import { normaliserNomJoueur, remplacerAncienNom } from "./playerName.js";

export class DialogueEngine {
  /**
   * @param {object} episodeData - JSON de l'épisode (voir data/episodes/episode1.json)
   * @param {Map<string, object>} personnagesParId - map id -> fiche personnage (characters.json aplati)
   * @param {object} sauvegarde - objet de sauvegarde courant (modifié en place)
   * @param {{calques: Array, canvas: {width: number, height: number}}|null} [apparencePommette] - calques de
   *   l'apparence de Pommette (voir engine/appearance.js) ; null = on garde le sprite statique de characters.json
   * @param {{ephemere?: boolean}} [options] - désactive sauvegardes et journal de choix pour un extrait isolé
   */
  constructor(episodeData, personnagesParId, sauvegarde, apparencePommette = null, { ephemere = false } = {}) {
    this.ephemere = ephemere;
    this.episodeData = episodeData;
    this.apparencePommette = apparencePommette;
    this.personnagesParId = personnagesParId;
    this.sauvegarde = sauvegarde;
    // Restaure le dernier décor connu pour ne pas repartir sur un fond vide après une reprise de partie.
    this.background = sauvegarde.currentBackground || null;
    this.nodeId = sauvegarde.currentNode || episodeData.start;
    // Pagination : un texte trop long est découpé en pages de 3 lignes maximum, affichées une par une.
    this.pageIndex = 0;
    // Sécurité : si une sauvegarde pointe sur un nœud d'aiguillage, on le résout immédiatement.
    this.resoudreBranchements();
  }

  get noeudCourant() {
    return this.episodeData.nodes[this.nodeId];
  }

  // Remplace les variables comme {playerName} dans un texte.
  interpoler(texte) {
    const nom = normaliserNomJoueur(this.sauvegarde.playerName);
    return remplacerAncienNom(texte, nom).replaceAll("{playerName}", () => nom);
  }

  // Retourne les informations d'affichage du nœud courant (texte, portrait, décor, choix...).
  obtenirAffichage() {
    const noeud = this.noeudCourant;
    if (!noeud) return null;

    if (noeud.background) {
      this.background = noeud.background;
      this.sauvegarde.currentBackground = noeud.background;
    }

    // Résolution de la musique :
    // 1. Un changement ponctuel sur le nœud (node.music) prend le dessus immédiatement.
    // 2. Sinon, si on vient d'entrer dans une nouvelle scène, on applique sa musique de scène.
    // 3. Sinon, on garde la musique déjà en cours (persistance entre les nœuds).
    const sceneCourante = Array.isArray(this.episodeData.scenes)
      ? this.episodeData.scenes.find((s) => Array.isArray(s.nodeIds) && s.nodeIds.includes(this.nodeId))
      : null;
    if (noeud.music) {
      // Changement ponctuel explicite sur ce nœud.
      this.musicCourante = noeud.music;
    } else if (sceneCourante && sceneCourante.id !== this.sceneCouranteId) {
      // On vient d'entrer dans une nouvelle scène : on applique sa musique de scène.
      this.sceneCouranteId = sceneCourante.id;
      this.musicCourante = sceneCourante.music || this.musicCourante || "";
    } else if (this.musicCourante === undefined) {
      // Premier appel : initialisation.
      this.sceneCouranteId = sceneCourante?.id ?? null;
      this.musicCourante = sceneCourante?.music || "";
    }

    const personnage = this.personnagesParId.get(noeud.speaker);
    const nomAffiche = noeud.speaker === "moi" || noeud.speaker === "narration"
      ? this.nomSpeakerParDefaut(noeud.speaker)
      : personnage?.name || this.nomSpeakerParDefaut(noeud.speaker);
    const portrait = noeud.portrait && personnage?.portraits ? personnage.portraits[noeud.portrait] : null;
    // false pour "moi"/"narration" et pour les nœuds sans speaker (ex. "end").
    const estPersonnageSurScene = Boolean(noeud.speaker) && noeud.speaker !== "moi" && noeud.speaker !== "narration";
    // Sprite plein pied affiché sur la scène : le portrait du nœud prime, sinon l'illustration par défaut du personnage.
    const spriteScene = estPersonnageSurScene ? (portrait || personnage?.sprite || null) : null;
    // Côté de bulle imposé par l'admin ; sans consigne, l'écran la place du côté libre du personnage.
    const position = noeud.position || null;

    const { texte: textePage, aDautresPages } = this.obtenirPageDeTexte(noeud);

    const reponsePommette = this.obtenirReponsePommette(noeud);

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
      cg: this.ephemere ? null : (noeud.cg || null),
      cgUnavailable: !this.ephemere && Boolean(noeud.cgUnavailable),
      background: this.background,
      playerAvatar: this.personnagesParId.get("moi")?.sprite || null,
      playerCalques: this.apparencePommette,
      options: noeud.type === "choice"
        ? noeud.options.map((option, index) => ({ index, text: this.interpoler(option.text) }))
        : null,
      affectedCharacters: noeud.type === "choice" ? this.obtenirPersonnagesAffectes(noeud) : [],
      reponsePommette,
      nextEpisode: noeud.nextEpisode || null,
      // Mise en scène explicite définie dans l'admin (remplace la gestion automatique quand elle est présente).
      onScreen: Array.isArray(noeud.onScreen) ? noeud.onScreen : null,
      // Musique effective à ce point : changement ponctuel du nœud ou musique de la scène courante.
      music: this.musicCourante || null,
    };
  }

  // Une réplique de personnage est accompagnée immédiatement de la réponse de Pommette (ou de la narration)
  // dans la barre basse : elles s'affichent en même temps que la bulle, sans clic supplémentaire.
  obtenirReponsePommette(noeud) {
    if (!noeud.next || noeud.type !== "line" || noeud.speaker === "moi" || noeud.speaker === "narration") return null;
    const suivant = this.episodeData.nodes[noeud.next];
    if (!suivant || suivant.type !== "line" || !suivant.text || !suivant.next) return null;
    if (suivant.cg) return null;
    if (suivant.speaker !== "moi" && suivant.speaker !== "narration") return null;
    // Un texte long garde ses pages : on ne le fusionne pas dans la bulle courante.
    if (suivant.text.split("\n").length > 3) return null;
    if (!this.memeMiseEnScene(noeud, suivant)) return null;
    return {
      text: this.interpoler(suivant.text),
      speakerName: this.nomSpeakerParDefaut(suivant.speaker),
      next: suivant.next || null
    };
  }

  // Deux nœuds ne sont fusionnés que s'ils partagent le même décor et les mêmes personnages :
  // sinon l'apparition ou la disparition d'un personnage serait sautée.
  memeMiseEnScene(noeud, suivant) {
    if (suivant.background && noeud.background && suivant.background !== noeud.background) return false;
    if (!Array.isArray(suivant.onScreen)) return true;
    if (!Array.isArray(noeud.onScreen)) return false;
    return (
      noeud.onScreen.length === suivant.onScreen.length &&
      noeud.onScreen.every((id) => suivant.onScreen.includes(id))
    );
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
    const noms = { moi: normaliserNomJoueur(this.sauvegarde.playerName), narration: "" };
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
    // Marqueurs de choix (ex. bonne réponse clé) : consultables par les nœuds "branch" plus loin.
    poserFlags(this.sauvegarde, option.flags);
    // Journal serveur du choix : conservé même si la sauvegarde évolue ensuite.
    if (!this.ephemere) enregistrerChoix(this.sauvegarde, {
      episodeId: this.episodeData.id,
      nodeId: this.nodeId,
      optionIndex: indexOption,
      optionLabel: option.text || null,
      flags: option.flags || [],
      effects: option.effects || {}
    });
    this.aller(option.next, { immediat: true });
    return this.obtenirAffichage();
  }

  // Traverse les nœuds "branch" (jamais affichés) jusqu'à retomber sur un nœud affichable.
  resoudreBranchements() {
    for (let securite = 0; securite < 20; securite++) {
      const noeud = this.noeudCourant;
      if (!noeud || noeud.type !== "branch") return;
      const cible = resoudreBranche(noeud, this.sauvegarde);
      if (!cible || !this.episodeData.nodes[cible]) return;
      this.nodeId = cible;
    }
  }

  aller(nodeId, { immediat = false } = {}) {
    this.nodeId = nodeId;
    this.pageIndex = 0;
    // Réinitialise la musique courante pour qu'elle soit recalculée au prochain obtenirAffichage().
    // On garde quand même la valeur précédente en fallback si le nœud n'en déclare pas.
    // (on ne remet PAS à undefined — on laisse musicCourante en place et obtenirAffichage
    //  la mettra à jour si le nœud a node.music ou si on change de scène)
    // Un nœud "branch" ne s'affiche jamais : on le résout aussitôt vers sa destination.
    this.resoudreBranchements();
    this.sauvegarde.currentNode = this.nodeId;
    // Marque l'épisode terminé dès qu'on atteint un nœud "end" (débloque l'épisode suivant).
    const noeud = this.episodeData.nodes[this.nodeId];
    let finEpisode = false;
    if (noeud?.type === "end") {
      finEpisode = true;
      this.sauvegarde.completedEpisodes ||= [];
      if (!this.sauvegarde.completedEpisodes.includes(this.episodeData.id)) {
        this.sauvegarde.completedEpisodes.push(this.episodeData.id);
      }
    }
    // Choix et fins d'épisode partent sans attendre le regroupement des autosaves.
    if (this.ephemere) return;
    if (immediat || finEpisode) {
      sauvegarderMaintenant(this.sauvegarde);
    } else {
      sauvegarder(this.sauvegarde);
    }
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
