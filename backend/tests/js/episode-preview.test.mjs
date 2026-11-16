import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { creerMoteurExtrait } from '../../../src/engine/episodePreview.js';
import { appliquerEffets, poserFlags, resoudreBranche } from '../../../src/engine/relationManager.js';
import { DialogueEngine, aplatirPersonnages } from '../../../src/engine/dialogueEngine.js';
import { normaliserNomJoueur, remplacerAncienNom } from '../../../src/engine/playerName.js';

const personnages = {
    player: { id: 'moi', defaultName: 'Pommette', sprite: 'avatar.png' },
    crushs: [{ id: 'liam', name: 'Liam', sprite: 'liam.png', gauges: { amour: 0 } }],
    secondary: [],
};
const episode = {
    id: 'episode1', start: 'intro',
    nodes: {
        intro: { type: 'line', speaker: 'narration', text: 'Intro', background: 'campus.png', next: 'rencontre' },
        rencontre: { type: 'line', speaker: 'liam', text: 'Bienvenue.', onScreen: ['liam'], next: 'choix' },
        choix: { type: 'choice', speaker: 'moi', options: [
            { text: 'Merci !', effects: { liam: { amour: 5 } }, flags: ['sourire'], next: 'positive' },
            { text: 'Je me débrouille.', effects: { liam: { amour: -5 } }, next: 'negative' },
        ] },
        positive: { type: 'line', speaker: 'liam', text: 'Avec plaisir.', next: 'apres' },
        negative: { type: 'line', speaker: 'liam', text: 'D’accord.', next: 'apres' },
        apres: { type: 'line', speaker: 'narration', text: 'La suite du vrai jeu.' },
    },
};

test('every preview choice changes only its temporary gauge, reaches the excerpt end and can be reset', t => {
    const ecritures = [];
    t.mock.method(globalThis, 'setTimeout', () => { ecritures.push('timer'); });
    const stockage = globalThis.localStorage;
    globalThis.localStorage = { getItem: () => null, setItem: () => ecritures.push('cache') };
    t.after(() => {
        if (stockage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = stockage;
    });
    const avant = structuredClone({ episode, personnages });
    for (const [choix, attendu] of [[0, 5], [1, -5]]) {
        const moteur = creerMoteurExtrait(episode, personnages);
        assert.equal(moteur.ephemere, true);
        while (moteur.noeudCourant.type !== 'choice') moteur.avancer();
        assert.equal(moteur.obtenirAffichage().background, 'campus.png');
        assert.deepEqual(moteur.obtenirAffichage().onScreen, ['liam']);
        moteur.choisir(choix);
        assert.equal(moteur.sauvegarde.gauges.liam.amour, attendu);
        assert.equal(moteur.noeudCourant.text, episode.nodes[choix === 0 ? 'positive' : 'negative'].text);
        moteur.avancer();
        assert.equal(moteur.estTermine(), true);
    }
    assert.deepEqual(ecritures, []);
    assert.deepEqual({ episode, personnages }, avant);
    assert.equal(creerMoteurExtrait(episode, personnages).sauvegarde.gauges.liam.amour, 0);
});

test('the regular dialogue engine still saves advances, choices and episode completion', () => {
    const appels = [];
    const contexte = vm.createContext({
        appliquerEffets, poserFlags, resoudreBranche, normaliserNomJoueur, remplacerAncienNom,
        sauvegarder: () => appels.push('save'),
        sauvegarderMaintenant: () => appels.push('immediate'),
        enregistrerChoix: () => appels.push('choice'),
    });
    const source = readFileSync(new URL('../../../src/engine/dialogueEngine.js', import.meta.url), 'utf8')
        .replace(/^import .*;\n/gm, '').replaceAll('export ', '');
    vm.runInContext(`${source}\nglobalThis.Moteur = DialogueEngine;`, contexte);
    const moteur = new contexte.Moteur({
        ...episode,
        nodes: { ...episode.nodes, positive: { ...episode.nodes.positive, next: 'fin' }, fin: { type: 'end' } },
    }, new Map(personnages.crushs.map(p => [p.id, p])), { gauges: {}, currentNode: 'rencontre' });
    moteur.avancer();
    moteur.choisir(0);
    moteur.avancer();
    assert.deepEqual(appels, ['save', 'choice', 'immediate', 'immediate']);
});

test('an episode without a usable choice reports a missing excerpt instead of fabricating one', () => {
    assert.throws(() => creerMoteurExtrait({ ...episode, start: 'apres' }, personnages), /Aucun passage avec choix/);
});

test("la réplique de l'épisode 1 utilise le prénom sauvegardé plutôt que la fiche de l'héroïne", () => {
    const episode1 = JSON.parse(readFileSync(new URL('../../../data/episodes/episode1.json', import.meta.url), 'utf8'));
    const fiches = aplatirPersonnages({
        ...personnages, player: { ...personnages.player, defaultName: 'Sucrette' },
    });
    const sauvegarde = { playerName: 'Camille', currentNode: 'scene_22_dialogue_1' };
    const moteur = new DialogueEngine(episode1, fiches, sauvegarde, null, { ephemere: true });
    const affichage = moteur.obtenirAffichage();
    assert.equal(affichage.text, 'Ah, pardon… Je pensais…');
    assert.equal(affichage.speakerName, 'Camille');
    assert.equal(fiches.get('moi').name, 'Sucrette');
    assert.equal(sauvegarde.currentNode, 'scene_22_dialogue_1');
});

test('réplique seule, réponse fusionnée, narration et choix partagent le même prénom personnalisé', () => {
    const prenom = 'Camille $&';
    const moteur = new DialogueEngine({
        id: 'test', start: 'liam', nodes: {
            liam: { type: 'line', speaker: 'liam', text: 'Bonjour {playerName}.', next: 'moi' },
            moi: { type: 'line', speaker: 'moi', text: 'Je suis {playerName}.', next: 'narration' },
            narration: { type: 'line', speaker: 'narration', text: '{playerName} écoute. Sucrette sourit.', next: 'choix' },
            choix: { type: 'choice', speaker: 'moi', options: [{ text: 'Moi, {playerName}.', next: 'fin' }] },
            fin: { type: 'end' },
        },
    }, aplatirPersonnages(personnages), { playerName: prenom }, null, { ephemere: true });
    const rencontre = moteur.obtenirAffichage();
    assert.equal(rencontre.text, `Bonjour ${prenom}.`);
    assert.equal(rencontre.reponsePommette.speakerName, prenom);
    assert.equal(rencontre.reponsePommette.text, `Je suis ${prenom}.`);
    const reponse = moteur.avancer();
    assert.equal(reponse.speakerName, prenom);
    assert.equal(reponse.text, `Je suis ${prenom}.`);
    const narration = moteur.avancer();
    assert.equal(narration.speakerName, '');
    assert.equal(narration.text, `${prenom} écoute. ${prenom} sourit.`);
    const choix = moteur.avancer();
    assert.equal(choix.speakerName, prenom);
    assert.equal(choix.options[0].text, `Moi, ${prenom}.`);
});

test('les parties et extraits anciens utilisent Pommette sans changer le contenu publié', () => {
    const anciensPersonnages = { ...personnages, player: { ...personnages.player, defaultName: 'Sucrette' } };
    for (const playerName of [undefined, '', 'Sucrette', ' sucrette ']) {
        const moteur = new DialogueEngine({
            start: 'moi', nodes: { moi: { type: 'line', speaker: 'moi', text: 'Je suis {playerName}.' } },
        }, aplatirPersonnages(anciensPersonnages), { playerName }, null, { ephemere: true });
        assert.equal(moteur.obtenirAffichage().speakerName, 'Pommette');
        assert.equal(moteur.obtenirAffichage().text, 'Je suis Pommette.');
    }
    assert.equal(creerMoteurExtrait(episode, anciensPersonnages).sauvegarde.playerName, 'Pommette');
    assert.equal(anciensPersonnages.player.defaultName, 'Sucrette');
});
