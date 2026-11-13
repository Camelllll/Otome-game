import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assemblerCalques, cleInventaire, estDebloque, normaliserApparence } from '../../../src/engine/appearance.js';
import { acheter, accorderPiecesDemo, indiceVerrou, PIECES_DEMO, prixDe, reconcilierPossessions } from '../../../src/engine/wardrobe.js';

const root = new URL('../../../', import.meta.url);
const catalogue = JSON.parse(readFileSync(new URL('data/appearance/catalogue.json', root)));
const yeux = catalogue.items.find(item => item.id === 'verts');
const pantalon = catalogue.items.find(item => item.id === 'pantalon1-blanc');
const save = () => ({ currency: 300, inventory: ['story-item'], flags: [], appearance: null });

test('demo currency is granted only once, including after reload', () => {
    const joueur = save();
    assert.equal(accorderPiecesDemo(joueur), true);
    assert.equal(joueur.currency, 300 + PIECES_DEMO);
    const recharge = JSON.parse(JSON.stringify(joueur));
    assert.equal(accorderPiecesDemo(recharge), false);
    assert.equal(recharge.currency, joueur.currency);
});

test('purchase debits exact price, preserves inventory and prevents duplicate purchases', () => {
    const joueur = save();
    assert.equal(estDebloque(yeux, joueur), false);
    assert.equal(acheter(yeux, joueur).ok, true);
    assert.equal(joueur.currency, 150);
    assert.deepEqual(joueur.inventory, ['story-item', cleInventaire(yeux)]);
    assert.equal(acheter(yeux, joueur).raison, 'deja-possede');
    assert.equal(joueur.currency, 150);
});

test('insufficient funds leave every save field unchanged', () => {
    const joueur = { ...save(), currency: 199 };
    const avant = structuredClone(joueur);
    assert.deepEqual(acheter(pantalon, joueur), { ok: false, raison: 'fonds', manque: 1 });
    assert.deepEqual(joueur, avant);
});

test('exact balance and free shop items are supported', () => {
    const joueur = { ...save(), currency: 200 };
    assert.equal(acheter(pantalon, joueur).ok, true);
    assert.equal(joueur.currency, 0);
    assert.equal(acheter({ ...yeux, unlock: { type: 'shop', price: 0 } }, joueur).ok, true);
});

test('invalid prices cannot accidentally become free items', () => {
    for (const price of [undefined, null, '', '150', -1, 1.5, Infinity, NaN]) {
        const element = { ...yeux, unlock: { type: 'shop', price } };
        assert.equal(prixDe(element), null);
        assert.equal(acheter(element, save()).raison, 'verrouille');
    }
});

test('failed persistence can roll back purchase without losing other inventory', () => {
    const joueur = save();
    const avant = structuredClone(joueur);
    const resultat = acheter(yeux, joueur);
    resultat.annuler();
    assert.deepEqual(joueur, avant);
});

test('flag, episode and level requirements gate purchases', () => {
    for (const [requires, progression] of [
        [{ type: 'flag', flag: 'bal' }, { flags: ['bal'] }],
        [{ type: 'episode', episode: 'episode2' }, { completedEpisodes: ['episode2'] }],
        [{ type: 'level', level: 3 }, { stats: { level: 3 } }],
    ]) {
        const element = { ...yeux, unlock: { type: 'shop', price: 150, requires } };
        assert.ok(indiceVerrou(element, save()));
        assert.equal(indiceVerrou(element, { ...save(), ...progression }), null);
        assert.equal(acheter(element, { ...save(), ...progression }).ok, true);
    }
    assert.ok(indiceVerrou({ ...yeux, unlock: { type: 'shop', price: 150, requires: { type: 'unknown' } } }, save()));
});

test('purchased equipment and currency survive a save round-trip', () => {
    const joueur = save();
    acheter(yeux, joueur);
    joueur.appearance = normaliserApparence({ eyes: yeux.id }, catalogue, joueur);
    const recharge = JSON.parse(JSON.stringify(joueur));
    assert.equal(recharge.currency, 150);
    assert.equal(estDebloque(yeux, recharge), true);
    assert.equal(normaliserApparence(recharge.appearance, catalogue, recharge).eyes, yeux.id);
    assert.equal(normaliserApparence({ bottom: pantalon.id }, catalogue, recharge).bottom, catalogue.defaults.bottom);
});

test('migration preserves previously equipped shop items and runs only once', () => {
    const joueur = { ...save(), appearance: { eyes: yeux.id, bottom: pantalon.id } };
    assert.equal(reconcilierPossessions(catalogue, joueur), true);
    assert.equal(reconcilierPossessions(catalogue, joueur), false);
    assert.ok(joueur.inventory.includes(cleInventaire(yeux)));
    assert.ok(joueur.inventory.includes(cleInventaire(pantalon)));
    assert.equal(joueur.currency, 300);
});

test('all catalogued PNG layers exist on the original aligned canvas', () => {
    for (const item of catalogue.items) {
        for (const layer of item.layers) {
            const png = readFileSync(new URL(catalogue.basePath + layer.file, root));
            assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a');
            assert.equal(png.readUInt32BE(16), catalogue.canvas.width, layer.file);
            assert.equal(png.readUInt32BE(20), catalogue.canvas.height, layer.file);
        }
    }
    const layers = assemblerCalques(normaliserApparence(null, catalogue), catalogue);
    assert.equal(new Set(layers.map(layer => layer.slot)).size, layers.length);
    assert.deepEqual(layers.map(layer => layer.z), layers.map(layer => layer.z).toSorted((a, b) => a - b));
});
