import test from 'node:test';
import assert from 'node:assert/strict';
import { aUneApparenceEquipee, assemblerCalques, cleInventaire, estDebloque, normaliserApparence, resoudreCalques } from '../../../src/engine/appearance.js';
import { acheter, accorderPiecesDemo, indiceVerrou, PIECES_DEMO, prixDe, reconcilierPossessions } from '../../../src/engine/wardrobe.js';

const fichier = nom => `http://127.0.0.1:8001/api/media/${nom}/file`;
const article = (id, category, slot, unlock = { type: 'default' }) => ({
    id,
    category,
    label: id,
    layers: [{ slot, file: fichier(id) }],
    unlock,
});
const yeux = article('yeux-verts', 'eyes', 'eyes', { type: 'shop', price: 150 });
const pantalon = article('pantalon-blanc', 'bottom', 'bottom', { type: 'shop', price: 200 });
const catalogue = {
    version: 2,
    basePath: '',
    canvas: { width: 600, height: 1200 },
    base: { file: '' },
    defaults: {
        skin: 'peau-claire',
        hair: 'cheveux-chatains',
        eyes: 'yeux-bleus',
        eyebrows: 'sourcils-chatains',
        mouth: 'bouche-nude',
        outfit: null,
        top: 'pull-rayure',
        bottom: 'pantalon-bleu',
        shoes: null,
        accessory: null,
    },
    items: [
        article('peau-claire', 'skin', 'body'),
        article('cheveux-chatains', 'hair', 'hair-front'),
        article('yeux-bleus', 'eyes', 'eyes'),
        yeux,
        article('sourcils-chatains', 'eyebrows', 'eyebrows'),
        article('bouche-nude', 'mouth', 'mouth'),
        article('pull-rayure', 'top', 'top'),
        article('pantalon-bleu', 'bottom', 'bottom'),
        pantalon,
    ],
};
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
    assert.equal(normaliserApparence({ bottom: pantalon.id }, catalogue, recharge).bottom, null);
});

test('migration preserves previously equipped shop items and runs only once', () => {
    const joueur = { ...save(), appearance: { eyes: yeux.id, bottom: pantalon.id } };
    assert.equal(reconcilierPossessions(catalogue, joueur), true);
    assert.equal(reconcilierPossessions(catalogue, joueur), false);
    assert.ok(joueur.inventory.includes(cleInventaire(yeux)));
    assert.ok(joueur.inventory.includes(cleInventaire(pantalon)));
    assert.equal(joueur.currency, 300);
});

test('studio catalogues use dynamic image URLs and assemble all configured appearance slots', () => {
    const layers = assemblerCalques(normaliserApparence(catalogue.defaults, catalogue), catalogue);
    assert.equal(new Set(layers.map(layer => layer.slot)).size, layers.length);
    assert.deepEqual(layers.map(layer => layer.z), layers.map(layer => layer.z).toSorted((a, b) => a - b));
    assert.ok(layers.some(layer => layer.slot === 'body'));
    assert.ok(layers.every(layer => layer.src.startsWith('http://127.0.0.1:8001/api/media/')));
});

test('a partial studio catalogue keeps the original character in front of the iris after reload', () => {
    const partiel = { ...catalogue, defaults: {}, items: [yeux] };
    const joueur = { ...save(), appearance: { eyes: yeux.id }, inventory: [cleInventaire(yeux)] };
    const options = { spriteOrigine: '/assets/pommette.png' };
    assert.equal(aUneApparenceEquipee(joueur.appearance, partiel, joueur), true);
    assert.equal(aUneApparenceEquipee({ eyes: 'ancien-id' }, partiel, joueur), false);
    assert.deepEqual(resoudreCalques(joueur.appearance, partiel, joueur, options)
        .map(layer => [layer.slot, layer.src]), [
        ['eyes', fichier(yeux.id)],
        ['body', options.spriteOrigine],
    ]);
    assert.deepEqual(assemblerCalques(null, partiel, options).map(layer => layer.slot), ['body']);
});

test('the studio skin keeps the original pupil and lash artwork in front of the selected iris', () => {
    const layers = resoudreCalques({ skin: 'peau-claire', eyes: 'yeux-bleus' }, catalogue, null, { spriteOrigine: '/assets/pommette.png' });
    assert.deepEqual(layers.map(layer => [layer.slot, layer.src]), [
        ['eyes', fichier('yeux-bleus')],
        ['body', fichier('peau-claire')],
    ]);
});
