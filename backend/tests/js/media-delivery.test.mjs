import test from 'node:test';
import assert from 'node:assert/strict';
import { connexionEconome, urlMedia, adapterMedias } from '../../../src/services/mediaDelivery.js';
import { creerMiniature } from '../../../src/ui/pommetteAvatar.js';

function connexion(t, connection) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { connection } });
    t.after(() => {
        if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
        else delete globalThis.navigator;
    });
}

test('slow connections use compact media without changing narrative text, external art or thumbnail sizes', t => {
    connexion(t, { effectiveType: '3g' });
    assert.equal(connexionEconome(), true);
    const original = {
        nodes: { one: { background: 'https://game.test/api/media/7/file?v=abc', text: 'Bonjour, {playerName} !' } },
        sprite: 'https://game.test/api/media/8/sprite?v=def',
        thumbnail: 'https://game.test/api/media/9/file?size=thumbnail',
        custom: 'assets/Décors/campus.png',
    };
    const adapted = adapterMedias(original);
    assert.equal(adapted.nodes.one.background, 'https://game.test/api/media/7/file?v=abc&size=compact');
    assert.equal(adapted.sprite, 'https://game.test/api/media/8/sprite?v=def&size=compact');
    assert.equal(adapted.thumbnail, original.thumbnail);
    assert.equal(adapted.nodes.one.text, original.nodes.one.text);
    assert.equal(adapted.custom, original.custom);
    assert.equal(original.sprite, 'https://game.test/api/media/8/sprite?v=def');
    assert.equal(urlMedia('blob:private-image'), 'blob:private-image');
});

test('save-data and limited bandwidth select compact images, absent hints keep full quality', t => {
    const url = 'https://game.test/api/media/1/sprite';
    connexion(t, { saveData: true, effectiveType: '4g' });
    assert.match(urlMedia(url), /size=compact/);
    navigator.connection.saveData = false;
    navigator.connection.downlink = 0.8;
    assert.match(urlMedia(url), /size=compact/);
    navigator.connection.downlink = 10;
    assert.equal(urlMedia(url), url);
    delete navigator.connection;
    assert.equal(urlMedia(url), url);
    assert.match(urlMedia(url, { miniature: true }), /size=thumbnail/);
});

test('dressing thumbnails use lazy lightweight layers without modifying the equipped sources', t => {
    const previous = globalThis.document;
    globalThis.document = { createElement: tag => ({
        tagName: tag, style: {}, dataset: {}, children: [],
        setAttribute() {}, addEventListener() {}, appendChild(child) { this.children.push(child); },
    }) };
    t.after(() => { globalThis.document = previous; });
    const layers = [{ slot: 'body', z: 10, src: 'https://game.test/api/media/2/file?v=1' }];
    const miniature = creerMiniature(layers, { width: 600, height: 1200 }, { x: 0.5, y: 0.5, w: 1 });
    const image = miniature.children[0].children[0];
    assert.equal(image.loading, 'lazy');
    assert.match(image.src, /size=thumbnail/);
    assert.equal(layers[0].src, 'https://game.test/api/media/2/file?v=1');
});

test('muted music does not download and disabling sound releases the active audio source', async t => {
    const originals = Object.fromEntries(['localStorage', 'window', 'Audio'].map(key => [key, globalThis[key]]));
    const created = [];
    globalThis.localStorage = { getItem: () => 'false', setItem() {} };
    globalThis.window = { AudioContext: class {
        state = 'running';
        async suspend() { this.state = 'suspended'; }
        async resume() { this.state = 'running'; }
    } };
    globalThis.Audio = class {
        paused = true;
        constructor() { created.push(this); }
        async play() { this.paused = false; }
        pause() { this.paused = true; }
        removeAttribute(name) { if (name === 'src') this.src = ''; }
        load() { this.released = true; }
    };
    t.after(() => {
        for (const [key, value] of Object.entries(originals)) {
            if (value === undefined) delete globalThis[key];
            else globalThis[key] = value;
        }
    });
    const { MusiqueAmbiance } = await import('../../../src/ui/backgroundMusic.js?media-delivery');
    const music = new MusiqueAmbiance();
    music.jouerFichier('https://game.test/song.mp3');
    assert.equal(created.length, 0);
    await music.basculer();
    assert.equal(created.length, 1);
    assert.equal(created[0].preload, 'none');
    assert.equal(created[0].paused, false);
    await music.basculer();
    assert.equal(created[0].src, '');
    assert.equal(created[0].released, true);
    await music.basculer();
    assert.equal(created.length, 2);
    assert.equal(created[1].src, 'https://game.test/song.mp3');
});
