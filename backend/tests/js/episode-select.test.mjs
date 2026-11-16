import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { lancerEcranSelectionEpisode } from '../../../src/screens/episodeSelectScreen.js';

class Element {
    constructor(tag) {
        this.tagName = tag;
        this.children = [];
        this.className = '';
        this.dataset = {};
        this.attributes = {};
        this.listeners = {};
        this.style = { setProperty() {} };
        this.classList = {
            add: name => { this.className = [...new Set([...this.className.split(' '), name])].join(' '); },
            remove: name => { this.className = this.className.split(' ').filter(value => value !== name).join(' '); },
            toggle: (name, active) => active ? this.classList.add(name) : this.classList.remove(name),
            contains: name => this.className.split(' ').includes(name),
        };
    }
    set innerHTML(value) { this.html = value; this.children = []; }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.children.push(child); return child; }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    all() { return this.children.flatMap(child => [child, ...child.all()]); }
    contains(child) { return this === child || this.all().includes(child); }
    querySelector(selector) {
        return this.all().find(element => selector.startsWith('.')
            ? element.classList.contains(selector.slice(1)) : element.tagName === selector);
    }
}

test('le journal affiche les bonnes vignettes sans changer les décors ou la sélection', async t => {
    const ancienDocument = globalThis.document;
    const ancienneFenetre = globalThis.window;
    const ancienStockage = globalThis.localStorage;
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.window = { matchMedia: () => ({ matches: false }) };
    globalThis.localStorage = { getItem: () => null };
    t.after(() => {
        if (ancienDocument === undefined) delete globalThis.document;
        else globalThis.document = ancienDocument;
        if (ancienneFenetre === undefined) delete globalThis.window;
        else globalThis.window = ancienneFenetre;
        if (ancienStockage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = ancienStockage;
    });

    const racine = new Element('div');
    const choix = [];
    const navigation = [];
    lancerEcranSelectionEpisode(racine, {
        episodes: [
            { id: 'episode1', title: 'Première rentrée' },
            { id: 'episode2', title: 'Soirée' },
            { id: 'episode3', title: 'Les cours' },
        ],
        episodeActuel: 'episode1',
        joueur: { pseudo: 'Pommette' },
        sauvegarde: { playerName: 'Pomette', actionPoints: 0 },
        onSelect: id => choix.push(id),
        onDressing: () => navigation.push('dressing'),
        onProfil: () => navigation.push('carnet'),
        onCompte: () => navigation.push('compte'),
        onNouvellePartie: () => navigation.push('nouvelle'),
    });
    const trouver = classe => racine.all().find(element => element.classList.contains(classe));
    const chapitres = racine.all().filter(element => element.classList.contains('chapitre'));
    const image = trouver('apercu-image');
    const fond = trouver('journal-fond');
    const scene = trouver('apercu-scene');

    assert.equal(trouver('hud-chip-pa'), undefined);
    assert.equal(trouver('hud-dressing'), undefined);
    const profil = trouver('hud-chip');
    assert.equal(profil.tagName, 'button');
    assert.equal(profil.type, 'button');
    assert.equal(profil.attributes['aria-label'], 'Mon profil — Pommette');
    assert.equal(profil.children[1].textContent, 'Pommette');
    await profil.listeners.click();
    assert.deepEqual(navigation, ['carnet']);
    navigation.length = 0;
    const menu = trouver('bouton-menu');
    menu.listeners.click({ stopPropagation() {} });
    assert.equal(menu.attributes['aria-expanded'], 'true');
    trouver('ecran-selection-episode').listeners.pointerdown({ target: trouver('journal-page') });
    assert.equal(menu.attributes['aria-expanded'], 'false');
    const options = racine.all().filter(element => element.classList.contains('option-menu'));
    assert.ok(!options.some(element => /Accueil/.test(element.html)));
    for (const texte of ['Mon dressing', 'Mon carnet', 'Compte', "Recommencer l'histoire"]) {
        await options.find(element => element.html.includes(texte)).listeners.click();
    }
    assert.deepEqual(navigation, ['dressing', 'carnet', 'compte', 'nouvelle']);
    assert.equal(image.src, 'assets/Illustrations/vignette-episode-1.png');
    assert.equal(fond.src, 'assets/Décors/Entrée campus.png');
    assert.ok(scene.classList.contains('vignette-officielle'));
    assert.ok(existsSync(new URL(`../../../${image.src}`, import.meta.url)));

    chapitres[1].listeners.click();
    assert.equal(image.src, 'assets/Illustrations/vignette-episode-2.png');
    assert.equal(image.alt, 'Illustration : Soirée');
    assert.equal(fond.src, 'assets/Décors/Cour campus nuit.png');
    assert.ok(scene.classList.contains('vignette-officielle'));
    assert.ok(existsSync(new URL(`../../../${image.src}`, import.meta.url)));
    await trouver('apercu-jouer').listeners.click();
    assert.deepEqual(choix, ['episode2']);

    chapitres[2].listeners.click();
    assert.equal(image.src, 'assets/Décors/Salle de TD.jpg');
    assert.equal(fond.src, image.src);
    assert.equal(scene.classList.contains('vignette-officielle'), false);
});
