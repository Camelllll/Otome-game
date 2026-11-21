import test from 'node:test';
import assert from 'node:assert/strict';
import { afficherLovometre, creerBarreDeJauge, animerGainLovo, animerPerteLovo } from '../../../src/ui/gaugeBar.js';
import { creerCarnet } from '../../../src/ui/carnetRelations.js';

class Element {
    constructor(tag) {
        this.tagName = tag;
        this.className = '';
        this.children = [];
        this.attributes = {};
        this.style = { setProperty(name, value) { this[name] = value; } };
        this.listeners = {};
        this.classList = {
            add: name => { this.className = [...new Set([...this.className.split(' '), name])].join(' '); },
            remove: (...names) => { this.className = this.className.split(' ').filter(item => !names.includes(item)).join(' '); },
            contains: name => this.className.split(' ').includes(name),
            toggle: (name, actif) => actif ? this.classList.add(name) : this.classList.remove(name),
        };
    }
    set innerHTML(value) { this.html = value; this.children = []; }
    append(...children) { children.forEach(child => { child.parentElement = this; }); this.children.push(...children); }
    appendChild(child) { this.append(child); return child; }
    get lastElementChild() { return this.children.at(-1); }
    remove() { this.parentElement.children = this.parentElement.children.filter(child => child !== this); }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    querySelector(selector) {
        return this.all().find(element => selector.slice(1).split('.').every(name => element.classList.contains(name)));
    }
    getBoundingClientRect() { return { left: 12, top: 12, width: 22, height: 22 }; }
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

test('le score est affiché au-dessus de la piste et le remplissage évolue de −100 % à +100 %', t => {
    const { conteneur, trouver } = monter(t);
    for (const [valeur, attendu, largeur] of [[-150, -100, 0], [-50, -50, 25], [-5, -5, 47.5], [0, 0, 50], [5, 5, 52.5], [50, 50, 75], [100, 100, 100], [150, 100, 100]]) {
        afficherLovometre(conteneur, { id: 'isaac', name: 'Isaac', sprite: 'isaac.png', gauges: { amour: valeur } });
        const valeurTexte = trouver('lovometre-pourcentage');
        const barre = trouver('lovometre-barre');
        assert.equal(trouver('lovometre-portrait').children[1].src, 'isaac.png');
        assert.equal(valeurTexte.textContent, `${attendu} %`);
        const entete = trouver('lovometre-entete');
        assert.deepEqual(trouver('lovometre-identite').children, [entete, barre]);
        assert.deepEqual(entete.children, [trouver('lovometre-coeur'), trouver('lovometre-nom'), valeurTexte]);
        assert.deepEqual(barre.children, [trouver('lovometre-piste')]);
        assert.equal(barre.style['--lovo-position'], `${largeur}%`);
        assert.ok(trouver('lovometre-coeur').html.includes('<svg'));
        assert.equal(trouver('lovometre-jalons'), undefined);
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
    assert.equal(trouver('lovometre-pourcentage').textContent, '42 %');
    assert.equal(trouver('lovometre-barre').style['--lovo-position'], '71%');
});

test('les variations animent le même HUD et un changement de personnage ne réutilise pas son portrait', t => {
    const { conteneur, trouver } = monter(t);
    const personnage = score => ({ id: 'liam', name: 'Liam', portraits: { default: 'portrait.png' }, sprite: 'sprite.png', gauges: { amour: score } });
    afficherLovometre(conteneur, personnage(0));
    const barre = trouver('lovometre-barre');
    assert.equal(trouver('lovometre-portrait').children[1].src, 'portrait.png');
    afficherLovometre(conteneur, personnage(65));
    assert.equal(trouver('lovometre-barre'), barre);
    assert.equal(barre.style['--lovo-position'], '82.5%');
    afficherLovometre(conteneur, personnage(15));
    assert.equal(barre.style['--lovo-position'], '57.5%');
    afficherLovometre(conteneur, { id: 'isaac', name: 'Isaac', gauges: { amour: 100 } });
    assert.notEqual(trouver('lovometre-barre'), barre);
    assert.equal(trouver('lovometre-portrait').children[0].textContent, 'I');
});

test('les petits cœurs SVG sont nettoyés en fin de vol et respectent la réduction des animations', t => {
    const { conteneur } = monter(t);
    const scene = new Element('div');
    conteneur.className = 'lovometre';
    scene.appendChild(conteneur);
    afficherLovometre(conteneur, { name: 'Liam', gauges: { amour: 50 } });
    for (const animer of [animerGainLovo, animerPerteLovo]) {
        animer(scene, 10);
        const particules = conteneur.lastElementChild;
        assert.equal(particules.classList.contains('lovo-particules'), true);
        assert.ok(particules.children.every(coeur => coeur.html.includes('<svg')));
        particules.listeners.animationend({ target: particules.lastElementChild });
        assert.equal(conteneur.children.includes(particules), false);
    }
    const precedent = globalThis.matchMedia;
    globalThis.matchMedia = () => ({ matches: true });
    t.after(() => {
        if (precedent === undefined) delete globalThis.matchMedia;
        else globalThis.matchMedia = precedent;
    });
    animerGainLovo(scene, 10);
    assert.equal(conteneur.children.length, 1);
});

test('les préférences du jeu empêchent la création de particules', t => {
    const { conteneur } = monter(t);
    const scene = new Element('div');
    conteneur.className = 'lovometre';
    scene.appendChild(conteneur);
    afficherLovometre(conteneur, { name: 'Liam', gauges: { amour: 50 } });
    for (const dataset of [{ a11yMotion: 'reduce' }, { a11yHearts: 'off' }, { a11yHearts: 'reduced' }]) {
        globalThis.document.documentElement = { dataset };
        animerGainLovo(scene, 10);
        assert.equal(conteneur.children.length, 1);
    }
});

test('les autres barres de jauge gardent leur échelle centrée à zéro', t => {
    monter(t);
    for (const [score, largeur] of [[-100, 0], [0, 50], [100, 100]]) {
        const jauge = creerBarreDeJauge('Amitié', score);
        assert.equal(jauge.children[1].children[0].style.width, `${largeur}%`);
    }
});

test('le carnet conserve les scores signés, centre le neutre et aligne les jalons sur les vrais seuils', async t => {
    monter(t);
    t.mock.method(globalThis, 'fetch', async () => Response.json([]));
    globalThis.document.addEventListener = () => {};
    globalThis.document.removeEventListener = () => {};
    class Zone extends Element {
        constructor(tag) { super(tag); this.zones = new Map(); }
        set innerHTML(value) { this.html = value; }
        querySelector(selector) {
            if (!this.zones.has(selector)) this.zones.set(selector, new Zone('div'));
            return this.zones.get(selector);
        }
        querySelectorAll() { return []; }
        contains() { return false; }
        addEventListener() {}
        focus() {}
    }
    globalThis.document.createElement = tag => new Zone(tag);
    let valeur = 0;
    const carnet = creerCarnet({
        fiches: [{ id: 'isaac', name: 'Isaac', categorieCarnet: 'crush' }],
        getSauvegarde: () => ({ discoveredCharacterIds: ['isaac'] }),
        getInfosPersonnage: () => ({ gauges: { amour: valeur } }),
    });
    for (const [score, largeur] of [[-100, 0], [-50, 25], [0, 50], [25, 62.5], [100, 100]]) {
        valeur = score;
        carnet.ouvrir();
        const html = carnet.element.querySelector('.carnet-fiche').html;
        assert.ok(html.includes(`aria-valuemin="-100" aria-valuemax="100" aria-valuenow="${score}"`));
        assert.ok(html.includes(`style="width:${largeur}%"`));
        assert.ok(carnet.element.querySelector('.carnet-grille').html.includes(`<b>${score}%</b>`));
        assert.ok(html.includes('style="--pos:62.5"'));
        assert.ok(html.includes(`carnet-jalon ${score >= 25 ? 'atteint' : ''} `));
        carnet.fermer();
    }
    await new Promise(resolve => setImmediate(resolve));
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
