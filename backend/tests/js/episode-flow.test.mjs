import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { normalizeEpisode, blankEpisode, inferScenesFromNodes, listerEffets, validNodeTarget } from '../../resources/js/episode-flow.js';

test('new episode follows the original one-scene dialogue circuit', () => {
    const episode = blankEpisode('episode8', 'Épisode 8');
    assert.equal(episode.start, 'scene_1_dialogue_1');
    assert.equal(episode.scenes.length, 1);
    assert.deepEqual(episode.scenes[0].nodeIds, ['scene_1_dialogue_1']);
    assert.equal(episode.nodes[episode.start].speaker, 'moi');
});

test('inferring scenes keeps the last backdrop when the next node inherits it', () => {
    const episode = { nodes: {
        a: { type: 'line', background: 'campus', next: 'b' },
        b: { type: 'line', next: 'c' },
        c: { type: 'end', background: 'room' },
    } };
    const scenes = inferScenesFromNodes(episode);
    assert.equal(scenes.length, 2);
    assert.deepEqual(scenes[0].nodeIds, ['a', 'b']);
});

test('normalization is non-mutating and retains saved scene titles and custom data', () => {
    const episode = blankEpisode('episode8', 'Épisode 8');
    episode.scenes[0].title = 'La rencontre';
    episode.scenes[0].custom = { retained: true };
    episode.nodes.a = { type: 'branch', branches: [{ if: { flag: 'yes' }, next: 'scene_1_dialogue_1' }] };
    episode.start = 'missing-historical-start';
    const original = structuredClone(episode);
    const normalized = normalizeEpisode(episode);
    assert.deepEqual(episode, original);
    assert.equal(normalized.scenes[0].title, 'La rencontre');
    assert.deepEqual(normalized.scenes[0].custom, { retained: true });
    assert.ok(normalized.scenes[0].nodeIds.includes('a'));
    assert.equal(normalized.start, 'missing-historical-start');
    assert.deepEqual(normalizeEpisode(normalized), normalized);
});

test('multiple relationship effects remain separately editable', () => {
    assert.deepEqual(listerEffets({ isaac: { amour: 5, amitie: -2 }, liam: { amour: -5 } }), [
        { personId: 'isaac', gauge: 'amour', delta: 5 },
        { personId: 'isaac', gauge: 'amitie', delta: -2 },
        { personId: 'liam', gauge: 'amour', delta: -5 },
    ]);
});

test('destinations use existing node ids rather than invented links', () => {
    const episode = { nodes: { a: {}, b: {} } };
    assert.equal(validNodeTarget(episode, 'b', 'a'), 'b');
    assert.equal(validNodeTarget(episode, 'missing', 'a'), '');
    assert.equal(validNodeTarget(episode, 'a', 'a'), '');
});

function editorContext() {
    const elements = new Map();
    const context = vm.createContext({
        document: { querySelector: selector => {
            if (!elements.has(selector)) elements.set(selector, { innerHTML: '', textContent: '', value: '', classList: { toggle() {} } });
            return elements.get(selector);
        } },
        setTimeout: () => 0, clearTimeout() {},
        alert() {}, confirm: () => true, console,
    });
    const source = readFileSync(new URL('../../resources/js/episode-flow.js', import.meta.url), 'utf8')
        .replace(/^import .*;\n/gm, '')
        .replace(/^export \{.*\};\n?/gm, '')
        .replace("if (typeof document !== 'undefined') initialize();", '');
    vm.runInContext(source, context);
    vm.runInContext("episodes={test:normalizeEpisode(blankEpisode('test','Test'))};episodeId='test';people=[{id:'isaac',name:'Isaac'}];", context);
    return (code) => vm.runInContext(code, context);
}

test('original scene actions create automatic ids and connect only empty destinations', () => {
    const run = editorContext();
    run("newNode('scene_1','line');newNode('scene_1','choice');");
    assert.equal(run("Object.keys(currentEpisode().nodes).length"), 3);
    assert.equal(run("currentEpisode().nodes.scene_1_dialogue_1.next"), 'scene_1_dialogue_2');
    assert.equal(run("currentEpisode().nodes.scene_1_dialogue_2.next"), 'scene_1_choix_1');
    run("newScene();");
    assert.equal(run("currentEpisode().scenes.length"), 2);
    assert.equal(run("currentEpisode().nodes.scene_1_choix_1.options[0].next"), 'scene_2_dialogue_1');
});

test('splitting preserves ids, content and destinations; deleting clears dangling ordinary links', () => {
    const run = editorContext();
    run("newNode('scene_1','line');newNode('scene_1','choice');scinderScene('scene_1_dialogue_2');");
    assert.equal(run("currentEpisode().scenes.length"), 2);
    assert.equal(run("currentEpisode().scenes[0].nodeIds.length"), 1);
    assert.equal(run("currentEpisode().scenes[1].nodeIds.length"), 2);
    assert.equal(run("currentEpisode().nodes.scene_1_dialogue_1.next"), 'scene_1_dialogue_2');
    run("removeNode('scene_1_dialogue_2');");
    assert.equal(run("currentEpisode().nodes.scene_1_dialogue_1.next"), '');
    assert.equal(run("Object.keys(currentEpisode().nodes).length"), 2);
});

test('choice answer and multiple effects actions operate on original data structure', () => {
    const run = editorContext();
    run("newNode('scene_1','choice');addChoiceOption('scene_1_choix_1');addChoiceEffect('scene_1_choix_1',0);");
    assert.equal(run("currentEpisode().nodes.scene_1_choix_1.options.length"), 2);
    assert.equal(run("currentEpisode().nodes.scene_1_choix_1.options[0].effects.isaac.amour"), 0);
    run("removeChoiceEffect('scene_1_choix_1',0,0);removeChoiceOption('scene_1_choix_1',1);");
    assert.equal(run("Object.keys(currentEpisode().nodes.scene_1_choix_1.options[0].effects).length"), 0);
    assert.equal(run("currentEpisode().nodes.scene_1_choix_1.options.length"), 1);
});

test('loading and rendering never writes or fills historical onScreen automatically', () => {
    const run = editorContext();
    run("renderEpisodeTab();");
    assert.equal(run("pending.size"), 0);
    assert.equal(run("'onScreen' in currentEpisode().nodes.scene_1_dialogue_1"), false);
});
