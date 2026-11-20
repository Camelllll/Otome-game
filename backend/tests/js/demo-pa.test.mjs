import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { consommerActionPoints, recalculerActionPoints } from '../../../src/engine/saveSystem.js';

class Element {
    constructor(tag) {
        this.tagName = tag;
        this.children = [];
        this.className = '';
        this.dataset = {};
        this.style = {};
        this.attributes = {};
        this.classList = {
            add: name => { this.className += ` ${name}`; },
            remove: name => { this.className = this.className.split(' ').filter(c => c !== name).join(' '); },
            toggle: (name, active) => active ? this.classList.add(name) : this.classList.remove(name),
        };
    }
    set innerHTML(value) { if (value === '') this.children = []; }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.children.push(child); return child; }
    replaceChildren(...children) { this.children = children; }
    get childElementCount() { return this.children.length; }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener() {}
    all() { return this.children.flatMap(child => [child, ...child.all()]); }
}

function monterDressing(paActifs) {
    const document = { createElement: tag => new Element(tag), createElementNS: (_ns, tag) => new Element(tag) };
    const zoom = { agrandir() {}, reduire() {}, reinitialiser() {}, vueComplete() {}, cadrer() {}, detruire() {} };
    const contexte = vm.createContext({
        document,
        window: { matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {} },
        PA_ACTIFS: paActifs,
        CLES_APPARENCE: [],
        normaliserApparence: () => ({}),
        assemblerCalques: () => [],
        elementsDeCategorie: () => [],
        trouverElement: () => null,
        creerAvatarPommette: () => new Element('div'),
        mettreAJourAvatar() {},
        creerZoomDressing: () => zoom,
        installerMenuJeu() {},
        MusiqueAmbiance: class {},
        NOM_MONNAIE: 'pièces',
    });
    const source = readFileSync(new URL('../../../src/screens/dressingScreen.js', import.meta.url), 'utf8')
        .replace(/^import\s+[\s\S]*?\s+from\s+["'][^"']+["'];\r?\n/gm, '')
        .replace('export function lancerEcranDressing', 'function lancerEcranDressing');
    vm.runInContext(`${source}\nthis.lancer = lancerEcranDressing;`, contexte);
    const racine = new Element('div');
    contexte.lancer(racine, {
        catalogue: { canvas: { width: 600, height: 1200 } },
        sauvegarde: { playerName: 'Demo', actionPoints: 0, currency: 50, gauges: {} },
        spriteOrigine: 'sprite.png',
    });
    return racine.all();
}

test('pendant la démo, les PA ne bloquent pas les actions et ne changent pas localement', () => {
    const sauvegarde = { actionPoints: 0, lastActionPointsTimestamp: 123 };
    const avant = structuredClone(sauvegarde);
    assert.equal(recalculerActionPoints(sauvegarde), sauvegarde);
    assert.equal(consommerActionPoints(sauvegarde, 5), true);
    assert.deepEqual(sauvegarde, avant);
});

test('le dressing masque les PA mais conserve le solde de la boutique', () => {
    const elements = monterDressing(false);
    assert.equal(elements.some(element => element.className.split(' ').includes('dressing-ressource')), false);
    assert.ok(elements.some(element => element.className.split(' ').includes('dressing-solde')));
    assert.ok(monterDressing(true).some(element => element.className.split(' ').includes('dressing-ressource')));
});
