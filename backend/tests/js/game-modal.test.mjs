import test from 'node:test';
import assert from 'node:assert/strict';
import { demanderConfirmation } from '../../../src/ui/gameModal.js';

function creerDocument() {
    const listeners = {};
    const elements = {};
    const creerElement = () => ({
        listeners: {},
        classList: { add() {}, remove() {}, contains() { return false; } },
        addEventListener(name, callback) { this.listeners[name] = callback; },
        focus() {},
        remove() {},
        querySelector(selector) { return elements[selector] ||= creerElement(); },
    });
    const document = {
        activeElement: creerElement(),
        body: { appendChild(element) { this.voile = element; } },
        createElement: creerElement,
        addEventListener(name, callback) { listeners[name] = callback; },
        removeEventListener(name) { delete listeners[name]; },
        emit(name, event) { listeners[name]?.(event); },
    };
    return { document, elements };
}

function installerGlobals(t, document) {
    const precedent = { document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame };
    globalThis.document = document;
    globalThis.requestAnimationFrame = () => {};
    t.after(() => {
        for (const [cle, valeur] of Object.entries(precedent)) {
            if (valeur === undefined) delete globalThis[cle];
            else globalThis[cle] = valeur;
        }
    });
}

for (const fermeture of ['Escape', 'extérieur', 'annuler']) {
    test(`la fermeture par ${fermeture} n'est pas une confirmation`, async t => {
        const { document, elements } = creerDocument();
        installerGlobals(t, document);
        t.mock.method(globalThis, 'setTimeout', () => 0);
        const resultat = demanderConfirmation({ titre: 'Attention', message: 'Message', avertissement: true });
        if (fermeture === 'Escape') document.emit('keydown', { key: 'Escape' });
        if (fermeture === 'extérieur') document.body.voile.listeners.click({ target: document.body.voile });
        if (fermeture === 'annuler') {
            document.emit('keydown', { key: 'Enter', target: elements['[data-action="annuler"]'] });
            elements['[data-action="annuler"]'].listeners.click();
        }
        assert.equal(await resultat, null);
    });
}

test('seul le bouton de confirmation valide la modale', async t => {
    const { document, elements } = creerDocument();
    installerGlobals(t, document);
    t.mock.method(globalThis, 'setTimeout', () => 0);
    const resultat = demanderConfirmation({ titre: 'Attention', message: 'Message', avertissement: true });
    elements['[data-action="confirmer"]'].listeners.click();
    assert.equal(await resultat, true);
});
