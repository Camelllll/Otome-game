import test from 'node:test';
import assert from 'node:assert/strict';

function stockage() {
    const valeurs = new Map();
    return {
        getItem: cle => valeurs.get(cle) ?? null,
        setItem: (cle, valeur) => valeurs.set(cle, valeur),
        removeItem: cle => valeurs.delete(cle),
    };
}

function installerStockage(t) {
    const precedent = globalThis.localStorage;
    globalThis.localStorage = stockage();
    t.after(() => {
        if (precedent === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = precedent;
    });
}

test('la reprise choisit le dernier emplacement sans écriture ni synchronisation du cache', async t => {
    installerStockage(t);
    const appels = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        appels.push([url, options.method]);
        const data = url.endsWith('/saves')
            ? [{ slot: 0, revision: 1, updatedAt: '2025-01-01T00:00:00Z' },
                { slot: 3, revision: 2, updatedAt: '2025-02-01T00:00:00Z' }]
            : { slot: 3, revision: 2, currentNode: 'dernier', playerName: 'Sucrette' };
        return Response.json(data);
    });
    const { chargerDerniereProgression } = await import('../../../src/engine/saveSystem.js?home-read');
    const sauvegarde = await chargerDerniereProgression('joueur');
    assert.equal(sauvegarde.slot, 3);
    assert.equal(sauvegarde.currentNode, 'dernier');
    assert.equal(sauvegarde.playerName, 'Pommette');
    assert.deepEqual(appels.map(([url, method]) => [new URL(url).pathname, method]), [
        ['/api/saves', 'GET'], ['/api/saves/3', 'GET'],
    ]);

    localStorage.setItem('otome_save_cache_v2', JSON.stringify({
        synchronise: false, majLocaleAt: Date.now(),
        sauvegarde: { playerId: 'joueur', slot: 0, currentNode: 'hors-ligne', playerName: ' sucrette ' },
    }));
    appels.length = 0;
    const horsLigne = await chargerDerniereProgression('joueur');
    assert.equal(horsLigne.currentNode, 'hors-ligne');
    assert.equal(horsLigne.playerName, 'Pommette');
    assert.deepEqual(appels.map(([, method]) => method), ['GET']);

    localStorage.setItem('otome_save_cache_v2', JSON.stringify({
        synchronise: false, majLocaleAt: Date.parse('2024-01-01T00:00:00Z'),
        sauvegarde: { playerId: 'joueur', slot: 0, currentNode: 'ancien' },
    }));
    await assert.rejects(chargerDerniereProgression('joueur'), /plus ancienne/);
});

test('sans emplacement ni cache, la lecture ne crée pas de sauvegarde', async t => {
    installerStockage(t);
    const appels = [];
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        appels.push(options.method);
        return Response.json([]);
    });
    const { chargerDerniereProgression } = await import('../../../src/engine/saveSystem.js?home-empty');
    assert.equal(await chargerDerniereProgression('joueur'), null);
    assert.deepEqual(appels, ['GET']);
    assert.equal(localStorage.getItem('otome_save_cache_v2'), null);
});

test('une réinitialisation attend la sauvegarde en cours et cible uniquement le slot principal', async t => {
    installerStockage(t);
    let liberer;
    const attente = new Promise(resolve => { liberer = resolve; });
    const appels = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        appels.push([new URL(url).pathname, options.method]);
        if (options.method === 'PUT') await attente;
        return Response.json({ playerId: 'joueur', slot: options.method === 'PUT' ? 3 : 0 });
    });
    const { sauvegarderMaintenant, reinitialiserSauvegarde } = await import('../../../src/engine/saveSystem.js?home-reset');
    const envoi = sauvegarderMaintenant({ playerId: 'joueur', slot: 3, currentNode: 'scene' });
    const reset = reinitialiserSauvegarde('joueur');
    assert.deepEqual(appels, [['/api/saves/3', 'PUT']]);
    liberer();
    await envoi;
    await reset;
    assert.deepEqual(appels, [['/api/saves/3', 'PUT'], ['/api/saves/0/reset', 'POST']]);
});

test('un échec du reset conserve le cache et remonte une erreur', async t => {
    installerStockage(t);
    const cache = JSON.stringify({ synchronise: true, sauvegarde: { playerId: 'joueur', slot: 0, currentNode: 'scene' } });
    localStorage.setItem('otome_save_cache_v2', cache);
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Indisponible' }, { status: 503 }));
    t.mock.method(console, 'warn', () => {});
    const { reinitialiserSauvegarde } = await import('../../../src/engine/saveSystem.js?home-reset-failure');
    await assert.rejects(reinitialiserSauvegarde('joueur'), /Indisponible/);
    assert.equal(localStorage.getItem('otome_save_cache_v2'), cache);
});

test('une nouvelle partie ne remplace pas le cache non synchronisé d’un autre emplacement', async t => {
    installerStockage(t);
    const cache = JSON.stringify({
        synchronise: false,
        sauvegarde: { playerId: 'joueur', slot: 3, currentNode: 'scene' },
    });
    localStorage.setItem('otome_save_cache_v2', cache);
    let appels = 0;
    t.mock.method(globalThis, 'fetch', async () => { appels++; return Response.json({}); });
    const { reinitialiserSauvegarde } = await import('../../../src/engine/saveSystem.js?home-other-slot');
    await assert.rejects(reinitialiserSauvegarde('joueur'), /autre partie/);
    assert.equal(appels, 0);
    assert.equal(localStorage.getItem('otome_save_cache_v2'), cache);
});
