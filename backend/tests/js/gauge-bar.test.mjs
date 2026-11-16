import test from 'node:test';
import assert from 'node:assert/strict';
import { afficherLovometre } from '../../../src/ui/gaugeBar.js';

class Element {
    constructor(tag) {
        this.tagName = tag;
        this.className = '';
        this.children = [];
        this.attributes = {};
        this.style = {};
        this.classList = {
            add: name => { this.className = [...new Set([...this.className.split(' '), name])].join(' '); },
            remove: name => { this.className = this.className.split(' ').filter(item => item !== name).join(' '); },
            contains: name => this.className.split(' ').includes(name),
            toggle: (name, actif) => actif ? this.classList.add(name) : this.classList.remove(name),
        };
    }
    set innerHTML(_value) { this.children = []; }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.children.push(child); return child; }
    setAttribute(name, value) { this.attributes[name] = value; }
    all() { return this.children.flatMap(child => [child, ...child.all()]); }
}

function monter(t) {
    const precedent = globalThis.document;
    globalThis.document = { createElement: tag => new Element(tag) };
    t.after(() => {
        if (precedent === undefined) delete globalThis.document;
        else globalThis.document = precedent;
    });
    const conteneur = new Element('div');
    const trouver = classe => conteneur.all().find(element => element.classList.contains(classe));
    return { conteneur, trouver };
}

test('le lovomètre conserve son cœur et son pourcentage sans curseur pomme', t => {
    const { conteneur, trouver } = monter(t);
    for (const [valeur, attendu] of [[-150, -100], [-5, -5], [0, 0], [5, 5], [55, 55], [100, 100], [150, 100]]) {
        afficherLovometre(conteneur, { name: 'Isaac', gauges: { amour: valeur } });
        const valeurTexte = trouver('lovometre-pourcentage');
        const barre = trouver('lovometre-barre');
        assert.equal(trouver('lovometre-curseur'), undefined);
        assert.equal(conteneur.all().some(element => element.tagName === 'img'), false);
        assert.equal(trouver('lovometre-embleme').textContent, '♥');
        assert.equal(valeurTexte.textContent, `${attendu}%`);
        assert.equal(barre.children.includes(valeurTexte), true);
        assert.equal(valeurTexte.classList.contains('sur-remplissage'), attendu >= 55);
        assert.equal(trouver('lovometre-remplissage').style.width, `${Math.max(0, attendu)}%`);
        assert.equal(barre.attributes.role, 'meter');
        assert.equal(barre.attributes['aria-label'], 'Amour avec Isaac');
        assert.equal(barre.attributes['aria-valuenow'], String(attendu));
        assert.equal(barre.attributes['aria-valuemin'], '-100');
        assert.equal(barre.attributes['aria-valuemax'], '100');
    }
});

test('le lovomètre conserve le nom complet et la jauge amitié des personnages secondaires', t => {
    const { conteneur, trouver } = monter(t);
    const nom = 'Un personnage au nom particulièrement long';
    afficherLovometre(conteneur, { name: nom, gauges: { amitie: 42 } });
    assert.equal(trouver('lovometre-nom').textContent, nom);
    assert.equal(trouver('lovometre-nom').title, nom);
    assert.equal(trouver('lovometre-barre').attributes['aria-label'], `Amitié avec ${nom}`);
    assert.equal(trouver('lovometre-pourcentage').textContent, '42%');
});

test('un personnage sans jauge retire le lovomètre précédent', t => {
    const { conteneur } = monter(t);
    for (const personnage of [null, { name: 'Parent' }, { name: 'Parent', gauges: null }]) {
        afficherLovometre(conteneur, { name: 'Liam', gauges: { amour: 5 } });
        assert.equal(conteneur.classList.contains('visible'), true);
        afficherLovometre(conteneur, personnage);
        assert.equal(conteneur.classList.contains('visible'), false);
        assert.equal(conteneur.children.length, 0);
    }
});
