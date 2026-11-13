import test from 'node:test';
import assert from 'node:assert/strict';
import { acheter } from '../../../src/engine/wardrobe.js';
import { chargerSauvegarde, confirmerSauvegarde, sauvegarder, sauvegarderMaintenant } from '../../../src/engine/saveSystem.js';

test('dressing waits for its own save, survives reload and removes cancelled purchases from offline cache', async () => {
    const originalFetch = globalThis.fetch;
    const originalStorage = globalThis.localStorage;
    const cache = new Map();
    globalThis.localStorage = {
        getItem: key => cache.get(key) ?? null,
        setItem: (key, value) => cache.set(key, value),
        removeItem: key => cache.delete(key),
    };
    let remote = null;
    let release;
    let waiting = new Promise(resolve => { release = resolve; });
    let fail = false;
    let puts = 0;
    globalThis.fetch = async (_url, options) => {
        if (options.method === 'PUT') {
            puts++;
            const payload = JSON.parse(options.body);
            if (waiting) await waiting;
            if (fail) return new Response('{"message":"Indisponible"}', { status: 503 });
            remote = payload;
        }
        return new Response(JSON.stringify(remote), { status: 200 });
    };
    const joueur = { playerId: 'wardrobe-test', currency: 300, inventory: [], flags: [], appearance: null };
    const element = { id: 'verts', category: 'eyes', unlock: { type: 'shop', price: 150 } };
    try {
        const autosave = sauvegarderMaintenant(joueur);
        const achat = acheter(element, joueur);
        const confirmation = confirmerSauvegarde(joueur);
        waiting = null;
        release();
        await autosave;
        assert.ok(await confirmation);
        assert.equal(puts, 2);
        assert.equal(joueur.currency, 150);
        assert.deepEqual(joueur.inventory, ['wardrobe:eyes:verts']);
        joueur.appearance = { version: 1, eyes: 'verts' };
        assert.ok(await confirmerSauvegarde(joueur));
        const loaded = await chargerSauvegarde(joueur.playerId);
        assert.equal(loaded.currency, 150);
        assert.equal(loaded.appearance.eyes, 'verts');
        assert.deepEqual(loaded.inventory, joueur.inventory);

        const second = acheter({ ...element, id: 'marron' }, joueur);
        fail = true;
        assert.equal(await confirmerSauvegarde(joueur), null);
        second.annuler();
        sauvegarder(joueur);
        const buffered = JSON.parse(cache.get('otome_save_cache_v2')).sauvegarde;
        assert.equal(buffered.currency, 150);
        assert.deepEqual(buffered.inventory, ['wardrobe:eyes:verts']);
        assert.equal(achat.ok, true);
    } finally {
        fail = false;
        waiting = null;
        await sauvegarderMaintenant(joueur);
        globalThis.fetch = originalFetch;
        if (originalStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = originalStorage;
    }
});
