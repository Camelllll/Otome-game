// Petite boucle instrumentale générée dans le navigateur : aucun fichier audio externe n'est requis.
const STORAGE_KEY = "otome-musique-active";

// Instance unique partagée par tout le jeu : sans ça, chaque écran crée son propre
// AudioContext et les musiques se superposent (et le bouton du menu n'en coupe qu'une).
let instancePartagee = null;

export class MusiqueAmbiance {
  constructor() {
    if (instancePartagee) return instancePartagee;
    instancePartagee = this;
    this.context = null;
    this.master = null;
    this.timer = null;
    this.active = localStorage.getItem(STORAGE_KEY) !== "false";
  }

  async demarrer() {
    if (!this.active) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      // Une présence très discrète, pour rester derrière les dialogues.
      this.master.gain.value = 0.055;
      this.master.connect(this.context.destination);
      this.jouerBoucle();
      this.timer = window.setInterval(() => this.jouerBoucle(), 16000);
    }

    if (this.context.state === "suspended") await this.context.resume();
  }

  jouerNote(frequence, debut, duree, volume = 1) {
    const oscillateur = this.context.createOscillator();
    const enveloppe = this.context.createGain();
    oscillateur.type = "sine";
    oscillateur.frequency.value = frequence;
    enveloppe.gain.setValueAtTime(0.0001, debut);
    enveloppe.gain.exponentialRampToValueAtTime(0.16 * volume, debut + 0.12);
    enveloppe.gain.exponentialRampToValueAtTime(0.0001, debut + duree);
    oscillateur.connect(enveloppe).connect(this.master);
    oscillateur.start(debut);
    oscillateur.stop(debut + duree + 0.05);
  }

  jouerBoucle() {
    if (!this.context || !this.active) return;
    const debut = this.context.currentTime + 0.08;
    // Accords doux (Do majeur / La mineur / Fa majeur / Sol majeur), façon visual novel romantique.
    const accords = [
      [261.63, 329.63, 392.0],
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
      [196.0, 246.94, 293.66]
    ];
    accords.forEach((accord, index) => {
      const temps = debut + index * 4;
      accord.forEach((note, noteIndex) => this.jouerNote(note, temps, 3.7, noteIndex === 0 ? 0.72 : 0.48));
      // Une petite note brillante pour donner un côté tendre et léger.
      this.jouerNote(accord[1] * 2, temps + 1.35, 1.3, 0.3);
    });
  }

  async basculer() {
    this.active = !this.active;
    localStorage.setItem(STORAGE_KEY, String(this.active));
    if (this.active) await this.demarrer();
    else if (this.context) await this.context.suspend();
    return this.active;
  }
}
