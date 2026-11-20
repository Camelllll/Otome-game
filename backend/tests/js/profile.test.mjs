import test from 'node:test';
import assert from 'node:assert/strict';
import { chargerImagePrivee, viderImagesPrivees, memoriserJeton, lireJeton } from '../../../src/services/apiClient.js';
import { deconnecterJoueur, obtenirSessionJoueur, listerIllustrationsDebloquees } from '../../../src/services/playerRepository.js';
import { paginerIllustrations } from '../../../src/screens/illustrationGalleryScreen.js';

test('la pagination conserve toutes les illustrations et borne la dernière page', () => {
    const illustrations = Array.from({ length: 11 }, (_, id) => ({ id }));
    const pages = [0, 4, 8].map(ancre => paginerIllustrations(illustrations, 4, ancre));
    assert.deepEqual(pages.flatMap(page => page.elements), illustrations);
    assert.equal(pages[2].totalPages, 3);
    assert.equal(pages[2].elements.length, 3);
    assert.deepEqual(paginerIllustrations(illustrations, 4, 100), pages[2]);
    assert.deepEqual(paginerIllustrations([], 4).elements, []);
});

test('un redimensionnement garde l’illustration courante sur la page affichée', () => {
    const illustrations = Array.from({ length: 11 }, (_, id) => ({ id }));
    const mobile = paginerIllustrations(illustrations, 1, 7);
    const bureau = paginerIllustrations(illustrations, 4, mobile.debut);
    assert.ok(bureau.elements.includes(mobile.elements[0]));
    assert.equal(bureau.debut, 4);
    assert.equal(bureau.page, 1);
    assert.equal(bureau.totalPages, 3);
});

function stockage(t) {
    const precedent = globalThis.localStorage;
    const donnees = new Map();
    globalThis.localStorage = {
        getItem: cle => donnees.get(cle) ?? null,
        setItem: (cle, valeur) => donnees.set(cle, valeur),
        removeItem: cle => donnees.delete(cle),
    };
    t.after(() => {
        viderImagesPrivees();
        if (precedent === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = precedent;
    });
    return donnees;
}

test("les anciens noms de compte et d'illustrations sont remplacés sans toucher aux accès privés", async t => {
    stockage(t);
    memoriserJeton('test-token');
    let pseudo = 'Sucrette';
    const illustration = {
        id: 'souvenir', path: '/api/illustrations/7/file',
        title: 'Liam et sucrette', characters: ['Liam', 'Sucrette'], characterIds: ['liam', 'moi'],
    };
    t.mock.method(globalThis, 'fetch', async url => Response.json(url.endsWith('/auth/me')
        ? { player: { id: 'test', pseudo } } : [illustration]));
    assert.equal((await obtenirSessionJoueur()).pseudo, 'Pommette');
    pseudo = 'Camille';
    assert.equal((await obtenirSessionJoueur()).pseudo, 'Camille');
    assert.deepEqual(await listerIllustrationsDebloquees(), [{
        ...illustration, title: 'Liam et Pommette', characters: ['Liam', 'Pommette'],
    }]);
});

test('les images privées ne transmettent jamais le jeton à une URL externe ou publique', async t => {
    stockage(t);
    memoriserJeton('test-token');
    let requetes = 0;
    t.mock.method(globalThis, 'fetch', async () => { requetes++; return new Response(); });
    await assert.rejects(chargerImagePrivee('https://external.invalid/api/illustrations/1/file'), /accès privé/);
    await assert.rejects(chargerImagePrivee('http://127.0.0.1:8001/api/media/1/file'), /accès privé/);
    await assert.rejects(chargerImagePrivee('assets/Illustrations/secret.png'), /accès privé/);
    assert.equal(requetes, 0);
});

test('une image privée exige la session et ne met pas en cache un refus serveur', async t => {
    stockage(t);
    const url = 'http://127.0.0.1:8001/api/illustrations/7/file';
    await assert.rejects(chargerImagePrivee(url), /Connecte-toi/);
    memoriserJeton('test-token');
    const demandes = [];
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        demandes.push(options);
        return demandes.length === 1 ? new Response('', { status: 404 }) : new Response('png');
    });
    t.mock.method(URL, 'createObjectURL', () => 'blob:test-image');
    t.mock.method(URL, 'revokeObjectURL', () => {});
    await assert.rejects(chargerImagePrivee(url), /non débloquée/);
    assert.equal(await chargerImagePrivee(url), 'blob:test-image');
    assert.equal(await chargerImagePrivee(url), 'blob:test-image');
    assert.equal(demandes.length, 2);
    assert.equal(demandes[1].headers.Authorization, 'Bearer test-token');
    assert.equal(demandes[1].cache, 'no-store');
});

test('une réponse image arrivée après la fin de session est rejetée', async t => {
    stockage(t);
    memoriserJeton('test-token');
    let repondre;
    t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { repondre = resolve; }));
    const attente = chargerImagePrivee('http://127.0.0.1:8001/api/illustrations/8/file');
    viderImagesPrivees();
    repondre(new Response('png'));
    await assert.rejects(attente, /session a changé/);
});

test('les vignettes privées sont distinctes de la version détaillée et réutilisées pendant la session', async t => {
    stockage(t);
    memoriserJeton('test-token');
    const demandes = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        demandes.push({ url, options });
        return new Response('image');
    });
    t.mock.method(URL, 'createObjectURL', () => `blob:image-${demandes.length}`);
    t.mock.method(URL, 'revokeObjectURL', () => {});
    const url = 'http://127.0.0.1:8001/api/illustrations/10/file';
    const miniature = await chargerImagePrivee(url, { miniature: true });
    const detail = await chargerImagePrivee(url);
    assert.notEqual(miniature, detail);
    assert.equal(await chargerImagePrivee(url, { miniature: true }), miniature);
    assert.equal(demandes.length, 2);
    assert.match(demandes[0].url, /size=thumbnail/);
    assert.equal(demandes[1].url, url);
    assert.ok(demandes.every(d => d.options.headers.Authorization === 'Bearer test-token' && d.options.cache === 'no-store'));
});

test('la déconnexion attend le serveur et ne supprime pas la progression', async t => {
    const donnees = stockage(t);
    memoriserJeton('test-token');
    donnees.set('progression-test', 'conservée');
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
    await assert.rejects(deconnecterJoueur(), /Serveur injoignable/);
    assert.equal(lireJeton(), 'test-token');
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.ok(url.endsWith('/auth/logout'));
        assert.equal(options.method, 'POST');
        return Response.json({ ok: true });
    });
    await deconnecterJoueur();
    assert.equal(lireJeton(), null);
    assert.equal(donnees.get('progression-test'), 'conservée');
});

test('la sortie de session attend les choix dans leur ordre avant de libérer la sauvegarde', async t => {
    stockage(t);
    const appels = [];
    let liberer;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.ok(url.endsWith('/saves/3/choices'));
        const choix = JSON.parse(options.body);
        appels.push(choix.optionIndex);
        if (appels.length === 1) await new Promise(resolve => { liberer = resolve; });
        return Response.json({ id: appels.length });
    });
    const module = await import('../../../src/engine/saveSystem.js?profile-ordered-journal');
    const sauvegarde = { playerId: 1, slot: 3, choices: [] };
    module.enregistrerChoix(sauvegarde, { episodeId: 'episode1', nodeId: 'one', optionIndex: 0 });
    module.enregistrerChoix(sauvegarde, { episodeId: 'episode1', nodeId: 'two', optionIndex: 1 });
    let sortie = false;
    const attente = module.preparerSortieSession().then(() => { sortie = true; });
    await Promise.resolve();
    assert.deepEqual(appels, [0]);
    assert.equal(sortie, false);
    liberer();
    await attente;
    assert.deepEqual(appels, [0, 1]);
    module.fermerSessionSauvegarde();
});

test('un échec du journal est explicite et le choix reste disponible pour réessayer', async t => {
    stockage(t);
    t.mock.method(console, 'warn', () => {});
    let tentatives = 0;
    const payloads = [];
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        tentatives++;
        payloads.push(options.body);
        if (tentatives === 1) throw new Error('offline');
        return Response.json({ id: 1 });
    });
    const module = await import('../../../src/engine/saveSystem.js?profile-retry-journal');
    module.enregistrerChoix({ playerId: 1, slot: 0, choices: [] }, { episodeId: 'episode1', nodeId: 'one', optionIndex: 0 });
    await assert.rejects(module.attendreJournalChoix(), /choix n’a pas pu être enregistré/);
    await module.attendreJournalChoix();
    assert.equal(tentatives, 2);
    assert.equal(payloads[0], payloads[1]);
    module.fermerSessionSauvegarde();
});
