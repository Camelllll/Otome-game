import test from 'node:test';
import assert from 'node:assert/strict';
import { CADRAGES_DRESSING, calculerCadrage, creerZoomDressing } from '../../../src/ui/dressingZoom.js';

const canvas = { width: 600, height: 1200 };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.001, `${actual} != ${expected}`);

test('full-body view fits all source pixels inside desktop, tablet and mobile stages', () => {
    for (const cadre of [{ width: 600, height: 700 }, { width: 340, height: 550 }, { width: 300, height: 400 }]) {
        const vue = calculerCadrage(canvas, cadre, CADRAGES_DRESSING.tenue);
        assert.ok(vue.x >= 0);
        assert.ok(vue.y >= 0);
        assert.ok(vue.x + canvas.width * vue.echelle <= cadre.width);
        assert.ok(vue.y + canvas.height * vue.echelle <= cadre.height);
    }
});

test('every measured feature is centered regardless of viewport aspect ratio', () => {
    for (const cadre of [{ width: 650, height: 700 }, { width: 320, height: 450 }]) {
        for (const focus of Object.values(CADRAGES_DRESSING)) {
            const vue = calculerCadrage(canvas, cadre, focus);
            close(vue.x + focus.x * canvas.width * vue.echelle, cadre.width / 2);
            close(vue.y + focus.y * canvas.height * vue.echelle, cadre.height / 2);
        }
    }
});

test('measured hair, eye, eyebrow and mouth bounds stay visible in their own crop', () => {
    const bounds = {
        hair: [155, 93, 376, 399],
        eyes: [258, 168, 308, 193],
        eyebrows: [247, 158, 308, 181],
        mouth: [282, 205, 304, 215],
    };
    for (const [categorie, [x1, y1, x2, y2]] of Object.entries(bounds)) {
        const cadre = { width: 420, height: 650 };
        const vue = calculerCadrage(canvas, cadre, CADRAGES_DRESSING[categorie]);
        assert.ok(vue.x + x1 * vue.echelle >= 0, categorie);
        assert.ok(vue.y + y1 * vue.echelle >= 0, categorie);
        assert.ok(vue.x + x2 * vue.echelle <= cadre.width, categorie);
        assert.ok(vue.y + y2 * vue.echelle <= cadre.height, categorie);
    }
});

test('manual zoom scales the whole drawing around the same feature', () => {
    const cadre = { width: 500, height: 650 };
    const normal = calculerCadrage(canvas, cadre, CADRAGES_DRESSING.eyes);
    const agrandi = calculerCadrage(canvas, cadre, CADRAGES_DRESSING.eyes, 1.4);
    close(agrandi.echelle, normal.echelle * 1.4);
    close(agrandi.x + 0.472 * canvas.width * agrandi.echelle, cadre.width / 2);
});

test('rapid category changes, zoom bounds, resize and teardown affect only the shared parent', () => {
    const originalObserver = globalThis.ResizeObserver;
    let resize;
    let disconnected = false;
    globalThis.ResizeObserver = class {
        constructor(callback) { resize = callback; }
        observe() {}
        disconnect() { disconnected = true; }
    };
    const cadre = { isConnected: true, getBoundingClientRect: () => ({ width: 500, height: 650 }) };
    const pile = { style: {}, dataset: {} };
    try {
        const zoom = creerZoomDressing(cadre, pile, canvas);
        for (const categorie of ['eyes', 'hair', 'mouth', 'tenue', 'eyebrows']) zoom.cadrer(categorie);
        assert.equal(pile.dataset.cadrage, 'eyebrows');
        for (let i = 0; i < 20; i++) zoom.agrandir();
        assert.equal(pile.dataset.zoom, '2');
        for (let i = 0; i < 20; i++) zoom.reduire();
        assert.equal(pile.dataset.zoom, '0.6');
        zoom.reinitialiser();
        assert.equal(pile.dataset.zoom, '1');
        zoom.vueComplete();
        assert.equal(pile.dataset.cadrage, 'tenue');
        resize();
        assert.match(pile.style.transform, /^translate\(.+\) scale\(.+\)$/);
        cadre.isConnected = false;
        resize();
        assert.equal(disconnected, true);
        zoom.detruire();
    } finally {
        if (originalObserver === undefined) delete globalThis.ResizeObserver;
        else globalThis.ResizeObserver = originalObserver;
    }
});
