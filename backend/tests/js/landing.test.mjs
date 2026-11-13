import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { lancerEcranConnexion } from '../../../src/screens/loginScreen.js';

class Element {
    constructor(tag) {
        this.tagName = tag;
        this.children = [];
        this.attributes = {};
        this.listeners = {};
        this.className = '';
        this.value = '';
        this.hidden = false;
        this.isConnected = true;
        this.dataset = {};
        this.offsetWidth = 0;
        this.offsetHeight = 0;
        this.scrollTop = 0;
        this.scrollLeft = 0;
        this.scrollWidth = 0;
        this.clientWidth = 0;
        this.clientTop = 0;
        this.style = { setProperty() {} };
        this.classList = {
            add: name => { this.className += ` ${name}`; },
            remove: name => { this.className = this.className.split(' ').filter(c => c !== name).join(' '); },
            toggle: (name, active) => active ? this.classList.add(name) : this.classList.remove(name),
            contains: name => this.className.split(' ').includes(name),
        };
    }
    set textContent(value) { this.text = value; this.children = []; }
    get textContent() { return (this.text || '') + this.children.map(c => c.textContent).join(''); }
    set innerHTML(value) { this.textContent = value.replace(/<[^>]*>/g, ''); }
    get firstElementChild() { return this.children[0]; }
    get lastElementChild() { return this.children.at(-1); }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name]; }
    removeAttribute(name) { delete this.attributes[name]; }
    append(...children) { children.forEach(c => { c.parentElement = this; }); this.children.push(...children); }
    appendChild(child) { this.append(child); return child; }
    prepend(...children) { children.forEach(c => { c.parentElement = this; }); this.children.unshift(...children); }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
    async emit(name, properties = {}) {
        for (const listener of this.listeners[name] || []) await listener({ preventDefault() {}, ...properties });
    }
    querySelector(selector) {
        return this.all().find(c => selector.startsWith('.')
            ? c.className.split(' ').includes(selector.slice(1))
            : selector.startsWith('#') ? c.id === selector.slice(1) : c.tagName === selector);
    }
    all() { return this.children.flatMap(c => [c, ...c.all()]); }
    reportValidity() { return this.valid !== false; }
    scrollIntoView() { throw new Error('Landing navigation must scroll only its own container'); }
    scrollTo(options) {
        this.lastScroll = options;
        if ('top' in options) this.scrollTop = options.top;
        if ('left' in options) this.scrollLeft = options.left;
    }
    focus() { this.focused = true; }
    getBoundingClientRect() { return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }; }
}

const characters = {
    player: { id: 'moi', sprite: 'player.png' },
    crushs: [
        { id: 'liam', name: 'Liam', sprite: 'liam.png', tagline: 'Citation existante', showInCharactersMenu: true, gauges: { amour: 0 } },
        { id: 'isaac', name: 'Isaac', sprite: 'isaac.png', showInCharactersMenu: true },
        { id: 'camel', name: 'Camel', sprite: 'camel.png', showInCharactersMenu: true },
        { id: 'mehdi', name: 'Mehdi', sprite: 'mehdi.png', showInCharactersMenu: true },
        { id: 'aaron', name: 'Aaron', sprite: 'aaron.png', showInCharactersMenu: true },
        { id: 'stella', name: 'Stella', sprite: 'stella.png', showInCharactersMenu: true },
        { id: 'sasha', name: 'Sasha', sprite: 'sasha.png', showInCharactersMenu: true },
        { id: 'duplicate', name: 'Liam', sprite: 'other.png', showInCharactersMenu: true },
        { id: 'hidden', name: 'Invisible', sprite: 'hidden.png', showInCharactersMenu: false },
    ],
    secondary: [],
};
const episode = { id: 'episode1', start: 'intro', nodes: {
    intro: { type: 'line', speaker: 'narration', text: 'Intro', next: 'first', background: 'campus-api.png' },
    first: { type: 'line', speaker: 'liam', text: 'Première année ?', onScreen: ['liam'], next: 'reply' },
    reply: { type: 'line', speaker: 'moi', text: 'Oui, {playerName}.', onScreen: ['liam'], next: 'choice' },
    choice: { type: 'choice', speaker: 'moi', onScreen: ['liam'], options: [
        { text: 'Merci !', next: 'answer', effects: { liam: { amour: 5 } } },
    ] },
    answer: { type: 'line', speaker: 'liam', text: 'Bienvenue.', onScreen: ['liam'] },
} };

function monter(t, options = {}, repondreAuth = () => Response.json({ token: 'test-only', player: { id: 'test' } }), repondrePublic) {
    const originaux = Object.fromEntries(['document', 'fetch', 'localStorage', 'matchMedia', 'ResizeObserver', 'getComputedStyle'].map(k => [k, globalThis[k]]));
    const appels = [];
    const stockage = new Map();
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.localStorage = { getItem: k => stockage.get(k), setItem: (k, v) => stockage.set(k, v) };
    globalThis.matchMedia = () => ({ matches: true });
    globalThis.getComputedStyle = element => ({ scrollMarginTop: element.style.scrollMarginTop || '0px' });
    globalThis.ResizeObserver = class { observe() {} disconnect() {} };
    globalThis.fetch = async (url, config) => {
        appels.push({ url, config });
        if (repondrePublic && !url.includes('/auth/')) return repondrePublic(url);
        if (url.endsWith('/characters')) return Response.json(characters);
        if (url.endsWith('/backgrounds')) return Response.json([{ sourcePath: 'assets/Décors/Entrée campus.png', image: 'entry-from-database.png' }]);
        if (url.endsWith('/episodes/episode1')) return Response.json(episode);
        if (url.includes('/auth/')) return repondreAuth(url, config);
        throw new Error(`Unexpected request: ${url}`);
    };
    t.after(async () => {
        await terminerChargement();
        for (const [k, v] of Object.entries(originaux)) {
            if (v === undefined) delete globalThis[k];
            else globalThis[k] = v;
        }
    });
    const root = new Element('div');
    lancerEcranConnexion(root, { onConnecte() {}, ...options });
    const trouver = selector => root.querySelector(selector);
    return { root, trouver, appels, stockage };
}
const terminerChargement = () => new Promise(resolve => setImmediate(resolve));

test('the decorative campus photo uses the published database image instead of the obsolete local asset', async t => {
    const { trouver } = monter(t);
    await terminerChargement();
    const photo = trouver('.entree-rencontres-photo');
    assert.equal(photo.hidden, false);
    assert.equal(photo.querySelector('img').src, 'entry-from-database.png');
});

test('a missing or unavailable campus decoration never falls back to the obsolete asset or blocks characters and preview', async t => {
    for (const unavailable of [false, true]) {
        await t.test(unavailable ? 'API unavailable' : 'campus missing', async t => {
            const avertissement = t.mock.method(console, 'warn', () => {});
            const { root, trouver } = monter(t, {}, undefined, url => {
                if (url.endsWith('/backgrounds')) return unavailable
                    ? Response.json({ message: 'Indisponible' }, { status: 503 })
                    : Response.json([{ sourcePath: 'another-background.png', image: 'other.png' }]);
                return Response.json(url.endsWith('/characters') ? characters : episode);
            });
            await terminerChargement();
            const photo = trouver('.entree-rencontres-photo');
            assert.equal(photo.hidden, true);
            assert.equal(photo.querySelector('img'), undefined);
            assert.equal(root.all().filter(e => e.className === 'entree-personnage').length, 7);
            assert.ok(trouver('.ecran-dialogue'));
            assert.ok(avertissement.mock.calls.some(c => /campus/.test(c.arguments[0])));
        });
    }
});

test('landing keeps the game preview and seven cards, with Isaac and Aaron in the hero regardless of catalogue order', async t => {
    const { root, trouver, appels } = monter(t);
    await terminerChargement();
    const cartes = root.all().filter(e => e.className === 'entree-personnage');
    assert.equal(cartes.length, 7);
    assert.deepEqual(cartes.map(c => c.querySelector('h3').textContent), ['Isaac', 'Aaron', 'Camel', 'Mehdi', 'Liam', 'Stella', 'Sasha']);
    assert.match(cartes[4].textContent, /Citation existante/);
    assert.doesNotMatch(root.textContent, /Invisible/);
    assert.equal(trouver('.entree-hero-decor'), undefined);
    assert.equal(trouver('.entree-petales'), undefined);
    assert.deepEqual(trouver('.entree-casting').all().filter(e => e.tagName === 'img').map(e => e.src), ['isaac.png', 'aaron.png']);
    assert.ok(trouver('.ecran-dialogue'));
    assert.ok(trouver('.barre-narration'));
    assert.ok(root.all().indexOf(trouver('.entree-rencontres')) < root.all().indexOf(trouver('.entree-apercu')));
    assert.ok(appels.every(a => !a.url.includes('/saves')));
    assert.equal(trouver('.entree-galerie'), undefined);
    const jouer = trouver('.entree-footer').all().find(e => e.tagName === 'button' && e.textContent === 'Jouer');
    await jouer.emit('click');
    assert.equal(trouver('.entree-defilement').lastScroll.top, 0);
});

test('carousel arrows, progress and keyboard reach Sasha without scrolling the page vertically', async t => {
    const { trouver } = monter(t);
    await terminerChargement();
    const piste = trouver('.entree-personnages');
    piste.clientWidth = 1020;
    piste.scrollWidth = 1800;
    piste.children.forEach((carte, index) => {
        carte.getBoundingClientRect = () => ({ left: index * 260 - piste.scrollLeft, width: 240 });
    });
    const precedent = trouver('.entree-carousel-fleche-precedente');
    const suivant = trouver('.entree-carousel-fleche-suivante');
    await piste.emit('scroll');
    assert.equal(precedent.disabled, true);
    assert.equal(suivant.disabled, false);
    assert.equal(trouver('.entree-carousel-reperes').children.length, 4);
    await suivant.emit('click');
    assert.deepEqual(piste.lastScroll, { left: 260, behavior: 'instant' });
    await piste.emit('scroll');
    assert.equal(precedent.disabled, false);
    await trouver('.entree-carousel-reperes').lastElementChild.emit('click');
    assert.equal(piste.scrollLeft, 780);
    await piste.emit('scroll');
    assert.equal(suivant.disabled, true);
    assert.equal(trouver('.entree-carousel-annonce').textContent, 'Personnages 4 à 7 sur 7');
    await piste.emit('keydown', { key: 'Home', target: piste });
    assert.equal(piste.scrollLeft, 0);
    await piste.emit('keydown', { key: 'End', target: piste });
    assert.equal(piste.scrollLeft, 780);
    assert.equal(trouver('.entree-defilement').lastScroll, undefined);
    piste.clientWidth = 240;
    await piste.emit('scroll');
    assert.equal(trouver('.entree-carousel-reperes').children.length, 7);
    await piste.children[0].querySelector('button').emit('click');
    assert.equal(trouver('#entree-email').focused, true);
});

test('hero does not substitute other characters if one of its two sprites is missing', async t => {
    t.mock.method(console, 'warn', () => {});
    const { trouver } = monter(t, {}, undefined, url => url.endsWith('/characters')
        ? Response.json({ ...characters, crushs: characters.crushs.filter(p => p.id !== 'aaron') })
        : Response.json(episode));
    await terminerChargement();
    assert.match(trouver('.entree-casting-statut').textContent, /Isaac et Aaron/);
    assert.equal(trouver('.entree-casting').all().filter(e => e.tagName === 'img').length, 0);
    assert.ok(trouver('.entree-formulaire'));
});

test('the game navigation targets the playable excerpt without changing routes', async t => {
    const { trouver } = monter(t);
    const defilement = trouver('.entree-defilement');
    defilement.scrollTop = 1000;
    defilement.getBoundingClientRect = () => ({ top: 80 });
    const extrait = trouver('#entree-extrait');
    extrait.style.scrollMarginTop = '24px';
    extrait.getBoundingClientRect = () => ({ top: 80 + 3200 - defilement.scrollTop });
    const lien = trouver('.entree-nav-liens').children.find(e => e.textContent === 'Le jeu');
    await lien.emit('click');
    assert.deepEqual(defilement.lastScroll, { top: 3176, behavior: 'instant' });
    assert.equal(extrait.focused, true);
});

test('logo returns exactly to zero and closes the mobile menu from Concept and characters', async t => {
    const { trouver } = monter(t);
    const defilement = trouver('.entree-defilement');
    const menu = trouver('.entree-menu');
    for (const position of [704, 2000]) {
        defilement.scrollTop = position;
        await menu.emit('click');
        await trouver('.entree-marque').emit('click');
        assert.deepEqual(defilement.lastScroll, { top: 0, behavior: 'instant' });
        assert.equal(menu.getAttribute('aria-expanded'), 'false');
        assert.equal(trouver('.entree-nav-liens').classList.contains('est-ouvert'), false);
        assert.equal(trouver('.entree-marque').focused, true);
    }
});

test('decorative wave joins Hero to Concept without adding an intermediate content section', async t => {
    const { root, trouver } = monter(t);
    const transition = trouver('.entree-transition');
    assert.ok(root.all().indexOf(trouver('.entree-hero')) < root.all().indexOf(transition));
    assert.ok(root.all().indexOf(transition) < root.all().indexOf(trouver('#entree-concept')));
    assert.equal(transition.getAttribute('aria-hidden'), 'true');
    assert.equal(transition.all().some(e => e.tagName === 'button'), false);
    const defilement = trouver('.entree-defilement');
    defilement.getBoundingClientRect = () => ({ top: 64 });
    trouver('#entree-concept').getBoundingClientRect = () => ({ top: 64 + 1100 - defilement.scrollTop });
    const decouvrir = trouver('.entree-actions').children[1];
    await decouvrir.emit('click');
    assert.equal(defilement.lastScroll.top, 1100);
    assert.equal(trouver('#entree-concept').focused, true);
});

test('Concept uses only Camel and Stella from the catalogue and its features navigate to existing sections', async t => {
    const { trouver } = monter(t);
    await terminerChargement();
    const concept = trouver('#entree-concept');
    assert.deepEqual(concept.all().filter(e => e.tagName === 'img').map(e => [e.src, e.alt]), [
        ['camel.png', 'Camel'], ['stella.png', 'Stella'],
    ]);
    assert.match(concept.textContent, /Bien plus qu'une/);
    const boutons = concept.all().filter(e => e.tagName === 'button');
    await boutons[0].emit('click');
    assert.equal(trouver('#entree-univers').focused, true);
    await boutons[1].emit('click');
    assert.equal(trouver('#entree-personnages').focused, true);
    await boutons[2].emit('click');
    assert.equal(trouver('#entree-univers').focused, true);
});

test('a missing Concept portrait stays explicit without substituting a different character', async t => {
    const avertissement = t.mock.method(console, 'warn', () => {});
    const { trouver } = monter(t, {}, undefined, url => url.endsWith('/characters')
        ? Response.json({ ...characters, crushs: characters.crushs.filter(p => p.id !== 'stella') })
        : Response.json(episode));
    await terminerChargement();
    const concept = trouver('#entree-concept');
    assert.deepEqual(concept.all().filter(e => e.tagName === 'img').map(e => e.src), ['camel.png']);
    assert.match(concept.textContent, /Portrait de Stella momentanément indisponible/);
    assert.ok(avertissement.mock.calls.some(c => /Portrait de Stella/.test(c.arguments[0])));
    assert.ok(trouver('.entree-formulaire'));
});

test('navigation follows the internal scroll, handles the nested excerpt and closes the mobile menu on anchor selection', async t => {
    const { trouver } = monter(t);
    const defilement = trouver('.entree-defilement');
    const liens = trouver('.entree-nav-liens').children;
    const positions = [800, 1600, 2400, 2800];
    ['#entree-concept', '#entree-personnages', '#entree-univers', '#entree-extrait'].forEach((id, index) => {
        trouver(id).getBoundingClientRect = () => ({ top: positions[index] });
    });
    await defilement.emit('scroll');
    assert.equal(liens.some(lien => lien.getAttribute('aria-current')), false);
    positions[0] = 20;
    await defilement.emit('scroll');
    assert.equal(liens[0].getAttribute('aria-current'), 'location');
    positions.splice(0, 4, -2000, -1000, -100, 20);
    await defilement.emit('scroll');
    assert.equal(liens[3].getAttribute('aria-current'), 'location');
    assert.equal(liens.slice(0, 3).some(lien => lien.getAttribute('aria-current')), false);
    const menu = trouver('.entree-menu');
    await menu.emit('click');
    assert.equal(menu.getAttribute('aria-expanded'), 'true');
    await liens[0].emit('click');
    assert.equal(menu.getAttribute('aria-expanded'), 'false');
    assert.equal(trouver('#entree-concept').focused, true);
});

test('Concept is active while its leading wave is below the navbar and anchor navigation preserves that wave', async t => {
    const { trouver } = monter(t);
    const defilement = trouver('.entree-defilement');
    const concept = trouver('#entree-concept');
    const liens = trouver('.entree-nav-liens').children;
    defilement.getBoundingClientRect = () => ({ top: 64 });
    defilement.scrollTop = 500;
    concept.style.scrollMarginTop = '130px';
    concept.getBoundingClientRect = () => ({ top: 64 + 1000 - defilement.scrollTop });
    for (const id of ['#entree-personnages', '#entree-univers', '#entree-extrait']) {
        trouver(id).getBoundingClientRect = () => ({ top: 3000 });
    }
    await liens[0].emit('click');
    assert.equal(defilement.lastScroll.top, 870);
    await defilement.emit('scroll');
    assert.equal(liens[0].getAttribute('aria-current'), 'location');
    assert.equal(concept.focused, true);
});

test('password visibility remains keyboard accessible with the eye control', async t => {
    const { trouver } = monter(t);
    const bouton = trouver('.entree-voir-mdp');
    await bouton.emit('click');
    assert.equal(trouver('#entree-password').type, 'text');
    assert.equal(bouton.getAttribute('aria-label'), 'Masquer le mot de passe');
    assert.equal(bouton.getAttribute('aria-pressed'), 'true');
    await bouton.emit('click');
    assert.equal(trouver('#entree-password').type, 'password');
    assert.equal(bouton.getAttribute('aria-pressed'), 'false');
});

test('login keeps existing API contract and waits for the connection callback', async t => {
    let joueur;
    const { trouver, appels, stockage } = monter(t, { onConnecte: async p => { await terminerChargement(); joueur = p; } });
    trouver('#entree-email').value = 'test@example.invalid';
    trouver('#entree-password').value = 'test-password';
    await trouver('.entree-formulaire').emit('submit');
    const requete = appels.find(a => a.url.endsWith('/auth/login'));
    assert.deepEqual(JSON.parse(requete.config.body), { email: 'test@example.invalid', password: 'test-password' });
    assert.equal(joueur.id, 'test');
    assert.equal(stockage.get('otome_api_token'), 'test-only');
    assert.equal(trouver('.entree-formulaire').getAttribute('aria-busy'), undefined);
});

test('registration tabs support keyboard and send the optional heroine name', async t => {
    const { trouver, appels } = monter(t);
    await trouver('.entree-onglets').emit('keydown', { key: 'End' });
    assert.equal(trouver('#entree-onglet-1').getAttribute('aria-selected'), 'true');
    assert.equal(trouver('#entree-password').autocomplete, 'new-password');
    assert.equal(trouver('#entree-password').minLength, 8);
    trouver('#entree-pseudo').value = '  Sucrette  ';
    trouver('#entree-email').value = 'test@example.invalid';
    trouver('#entree-password').value = 'test-password';
    await trouver('.entree-formulaire').emit('submit');
    assert.equal(JSON.parse(appels.find(a => a.url.endsWith('/auth/register')).config.body).pseudo, 'Sucrette');
    await trouver('.entree-onglets').emit('keydown', { key: 'Home' });
    assert.equal(trouver('#entree-onglet-0').tabIndex, 0);
    assert.equal(trouver('#entree-password').autocomplete, 'current-password');
});

test('server errors remain visible, keep entered fields and allow retry', async t => {
    const { trouver } = monter(t, {}, () => Response.json({ message: 'Identifiants incorrects.' }, { status: 422 }));
    trouver('#entree-email').value = 'test@example.invalid';
    trouver('#entree-password').value = 'test-password';
    await trouver('.entree-formulaire').emit('submit');
    assert.equal(trouver('.entree-erreur').hidden, false);
    assert.equal(trouver('.entree-erreur').textContent, 'Identifiants incorrects.');
    assert.equal(trouver('.entree-formulaire').lastElementChild.disabled, false);
    assert.equal(trouver('#entree-email').value, 'test@example.invalid');
});

test('a failed post-login transition is reported instead of becoming an unhandled rejection', async t => {
    const { trouver } = monter(t, { onConnecte: async () => { throw new Error('Écran indisponible.'); } });
    await trouver('.entree-formulaire').emit('submit');
    assert.equal(trouver('.entree-erreur').textContent, 'Écran indisponible.');
    assert.equal(trouver('.entree-erreur').hidden, false);
    assert.equal(trouver('.entree-formulaire').lastElementChild.disabled, false);
});

test('native validity prevents submission and pending login cannot be submitted twice', async t => {
    let terminer;
    const { trouver, appels } = monter(t, {}, () => new Promise(resolve => { terminer = resolve; }));
    const formulaire = trouver('.entree-formulaire');
    formulaire.valid = false;
    await formulaire.emit('submit');
    assert.equal(appels.filter(a => a.url.includes('/auth/')).length, 0);
    formulaire.valid = true;
    const enCours = formulaire.emit('submit');
    await formulaire.emit('submit');
    assert.equal(appels.filter(a => a.url.includes('/auth/')).length, 1);
    assert.equal(trouver('#entree-onglet-1').disabled, true);
    terminer(Response.json({ token: 'test-only', player: { id: 'test' } }));
    await enCours;
    assert.equal(trouver('#entree-onglet-1').disabled, false);
});

test('connected landing displays saved progress and wires continue, dressing and gallery', async t => {
    const actions = [];
    const sauvegarde = { playerName: 'Héroïne', currentEpisode: 'episode3', currentNode: 'n42' };
    const avant = structuredClone(sauvegarde);
    const { root, trouver } = monter(t, {
        joueur: { id: 'test' }, sauvegarde,
        onContinuer: () => actions.push('continuer'),
        onDressing: () => actions.push('dressing'),
    });
    await terminerChargement();
    assert.equal(trouver('.entree-formulaire'), undefined);
    assert.match(trouver('.entree-compte').textContent, /Bon retour, Héroïne/);
    assert.equal(trouver('.entree-progression').textContent, 'Épisode en cours · 3');
    for (const texte of ["Continuer l'histoire", 'Mon dressing']) {
        await root.all().find(e => e.tagName === 'button' && e.textContent === texte).emit('click');
    }
    assert.deepEqual(actions, ['continuer', 'dressing']);
    assert.deepEqual(sauvegarde, avant);
});

test('unavailable public content is reported without disabling authentication', async t => {
    t.mock.method(console, 'warn', () => {});
    const { trouver } = monter(t, {}, undefined, () => Response.json({ message: 'Indisponible' }, { status: 503 }));
    await terminerChargement();
    assert.match(trouver('.entree-statut').textContent, /momentanément indisponibles/);
    assert.equal(trouver('.entree-statut').hidden, false);
    assert.equal(trouver('.entree-formulaire').lastElementChild.disabled, undefined);
});

test('unavailable episode keeps the loaded portraits and explains the missing preview', async t => {
    t.mock.method(console, 'warn', () => {});
    const { trouver, root } = monter(t, {}, undefined, url => url.endsWith('/characters')
        ? Response.json(characters) : Response.json({ message: 'Indisponible' }, { status: 503 }));
    await terminerChargement();
    assert.equal(root.all().filter(e => e.className === 'entree-personnage').length, 7);
    assert.match(trouver('.entree-scene').textContent, /momentanément indisponible/);
});

function routeur(hash, joueur) {
    const appels = [];
    const sauvegarde = { playerName: 'Sucrette', currentEpisode: 'episode2', currentNode: null };
    const contexte = vm.createContext({
        document: { getElementById: () => ({}) },
        location: { hash },
        history: { replaceState: (_state, _title, url) => appels.push(['route', url]) },
        console,
        obtenirSessionJoueur: async () => joueur,
        chargerSauvegarde: async () => sauvegarde,
        recalculerActionPoints() {},
        lancerEcranConnexion: (_root, options) => appels.push(['landing', options]),
        lancerEcranAccueil: (_root, options) => appels.push(['accueil', options]),
        getPublishedEpisodesList: async () => [],
        lancerEcranSelectionEpisode: (_root, options) => appels.push(['episodes', options]),
        demanderConfirmation: async options => appels.push(['erreur', options]),
    });
    const source = readFileSync(new URL('../../../src/main.js', import.meta.url), 'utf8')
        .replace(/^import .*;\n/gm, '')
        .replace(/demarrer\(\)\.catch\([\s\S]*$/, '');
    vm.runInContext(source, contexte);
    return { contexte, appels, sauvegarde };
}

test('boot with an existing session opens the connected landing at the root and resumes selection', async () => {
    const joueur = { id: 'test' };
    const { contexte, appels, sauvegarde } = routeur('', joueur);
    await contexte.demarrer();
    const options = appels.find(a => a[0] === 'landing')[1];
    assert.equal(options.joueur, joueur);
    assert.equal(options.sauvegarde, sauvegarde);
    assert.ok(appels.some(a => a[0] === 'route' && a[1] === '#bienvenue'));
    await options.onContinuer();
    assert.equal(appels.find(a => a[0] === 'episodes')[1].episodeActuel, 'episode2');
});

test('login transition replaces the form with the saved connected landing', async () => {
    const { contexte, appels } = routeur('#episode/ancien', null);
    await contexte.demarrer();
    const formulaire = appels.find(a => a[0] === 'landing')[1];
    const joueur = { id: 'nouveau' };
    await formulaire.onConnecte(joueur);
    assert.equal(appels.filter(a => a[0] === 'landing').at(-1)[1].joueur, joueur);
    assert.ok(appels.some(a => a[0] === 'route' && a[1] === '#bienvenue'));
});

test('existing explicit accueil and episodes routes keep their original screens', async () => {
    for (const [hash, attendu] of [['#accueil', 'accueil'], ['#episodes', 'episodes'], ['#bienvenue', 'landing']]) {
        const { contexte, appels } = routeur(hash, { id: 'test' });
        await contexte.demarrer();
        assert.ok(appels.some(a => a[0] === attendu), hash);
    }
});

test('a failed navigation restores the landing route and explicitly reports the error', async t => {
    t.mock.method(console, 'error', () => {});
    const { contexte, appels } = routeur('', { id: 'test' });
    await contexte.demarrer();
    contexte.getPublishedEpisodesList = async () => { throw new Error('Épisodes indisponibles.'); };
    await appels.find(a => a[0] === 'landing')[1].onContinuer();
    assert.equal(appels.filter(a => a[0] === 'route').at(-1)[1], '#bienvenue');
    assert.equal(appels.find(a => a[0] === 'erreur')[1].message, 'Épisodes indisponibles.');
});
