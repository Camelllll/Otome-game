// Gestion de la musique d'ambiance : lecture de fichiers audio BGM en boucle.
const STORAGE_KEY = "otome-musique-active";

function noteJingle(frequence, delai, duree, volume = 0.5, attaque = 0.06, type = "sine") {
  return { frequence, delai, duree, volume, attaque, type };
}

// Jingles joués quand une illustration apparaît, selon son « Niveau de révélation » (1 à 3) défini dans le studio.
const JINGLES_REVELATION = {
  // 1 · Discret : deux notes cristallines.
  1: [
    noteJingle(659.25, 0, 1.2, 0.5),
    noteJingle(987.77, 0.15, 1.4, 0.4),
  ],
  // 2 · Important : arpège ascendant de Do majeur.
  2: [
    noteJingle(523.25, 0, 1.6, 0.5),
    noteJingle(659.25, 0.14, 1.6, 0.5),
    noteJingle(783.99, 0.28, 1.7, 0.5),
    noteJingle(1046.5, 0.42, 2.0, 0.55),
  ],
  // 3 · Grand secret : basse profonde puis accord qui monte en crescendo.
  3: [
    noteJingle(130.81, 0, 4.2, 0.9, 0.5, "triangle"),
    noteJingle(261.63, 0.3, 3.8, 0.6, 0.5, "triangle"),
    noteJingle(392, 0.6, 3.4, 0.5, 0.45),
    noteJingle(523.25, 0.75, 3.2, 0.5, 0.45),
    noteJingle(659.25, 0.9, 3.0, 0.5, 0.45),
    noteJingle(783.99, 1.05, 2.8, 0.5, 0.45),
    noteJingle(1046.5, 1.3, 2.6, 0.55, 0.3),
  ],
};

// Instance unique partagée par tout le jeu.
let instancePartagee = null;

export class MusiqueAmbiance {
  constructor() {
    if (instancePartagee) return instancePartagee;
    instancePartagee = this;
    this.context = null;
    this.active = localStorage.getItem(STORAGE_KEY) !== "false";
    // Lecture de fichier audio réel (BGM de scène).
    this._audio = null;       // HTMLAudioElement courant
    this._audioUrl = null;    // URL en cours de lecture
  }

  async demarrer() {
    if (!this.active) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    if (!this.context) {
      this.context = new AudioContext();
    }

    if (this.context.state === "suspended") await this.context.resume();

    // Si une BGM de fichier était en attente (bloquée par la politique autoplay avant le premier
    // geste utilisateur), on la relance depuis zéro pour éviter tout état corrompu.
    if (this._audioUrl && this.active) {
      if (!this._audio || this._audio.error || this._audio.networkState === 3 /* NETWORK_NO_SOURCE */) {
        if (this._audio) { this._audio.pause(); this._audio.src = ""; }
        this._audio = new Audio(this._audioUrl);
        this._audio.loop = true;
        this._audio.volume = 0.6;
      }
      if (this._audio.paused) {
        this._audio.volume = 0.6;
        this._audio.play().catch(() => {});
      }
    }
  }

  // Court jingle d'apparition d'une illustration : plus le niveau de révélation est élevé, plus il est ample.
  // Silencieux si la musique est coupée ou si le navigateur n'a pas encore autorisé le son.
  jouerJingleRevelation(niveau = 1) {
    if (!this.active || !this.context || this.context.state !== "running") return;
    const notes = JINGLES_REVELATION[niveau] || JINGLES_REVELATION[1];
    const sortie = this.context.createGain();
    sortie.gain.value = 0.5;
    sortie.connect(this.context.destination);
    const origine = this.context.currentTime + 0.05;

    for (const { frequence, delai, duree, volume, attaque, type } of notes) {
      const oscillateur = this.context.createOscillator();
      const enveloppe = this.context.createGain();
      const debut = origine + delai;
      oscillateur.type = type;
      oscillateur.frequency.value = frequence;
      enveloppe.gain.setValueAtTime(0.0001, debut);
      enveloppe.gain.exponentialRampToValueAtTime(0.16 * volume, debut + attaque);
      enveloppe.gain.exponentialRampToValueAtTime(0.0001, debut + duree);
      oscillateur.connect(enveloppe).connect(sortie);
      oscillateur.start(debut);
      oscillateur.stop(debut + duree + 0.05);
    }
  }

  /**
   * Joue un fichier audio en boucle (BGM de scène).
   * - Si la même URL est déjà en lecture, ne fait rien.
   * - Si une autre URL était en cours, elle est arrêtée proprement avant.
   * - Si url est null/"", la musique de fichier est arrêtée.
   * @param {string|null} url
   */
  jouerFichier(url) {
    const urlNormee = url || null;

    // Rien à changer : même piste déjà en cours.
    if (urlNormee === this._audioUrl) return;

    // Arrêt de la piste précédente.
    if (this._audio) {
      this._audio.pause();
      this._audio.src = "";
      this._audio = null;
    }

    this._audioUrl = urlNormee;

    if (!urlNormee) return;

    // On crée l'élément audio mais on NE tente PAS play() ici :
    // si l'interaction utilisateur n'a pas encore eu lieu, l'appel serait rejeté.
    // C'est demarrer() — déclenché au premier pointerdown — qui lance effectivement la lecture.
    const audio = new Audio(urlNormee);
    audio.loop = true;
    audio.volume = this.active ? 0.6 : 0;
    this._audio = audio;

    // Si l'interaction a déjà eu lieu (contexte audio déjà actif et running), on peut jouer immédiatement.
    if (this.context && this.context.state === "running" && this.active) {
      audio.play().catch(() => {});
    }
    // Sinon : demarrer() sera appelé au premier clic et lancera la lecture.
  }

  /** Arrête immédiatement la BGM de fichier (utile à la fin d'un épisode ou au retour au menu). */
  arreterFichier() {
    this.jouerFichier(null);
  }

  async basculer() {
    this.active = !this.active;
    localStorage.setItem(STORAGE_KEY, String(this.active));
    if (this.active) {
      if (this._audio && this._audioUrl) {
        this._audio.volume = 0.6;
        this._audio.play().catch(() => {});
      }
      await this.demarrer();
    } else {
      if (this._audio) {
        this._audio.volume = 0;
        this._audio.pause();
      }
      if (this.context) await this.context.suspend();
    }
    return this.active;
  }
}