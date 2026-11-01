import { parseDocxVersEpisode } from './docx-import.js';

const $ = (selector) => document.querySelector(selector);
const copy = (value) => JSON.parse(JSON.stringify(value));
const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[char]));
const files = { backgrounds: [], illustrations: [], music: [] };
let mediaLabels = {};
let people = [];
let episodes = {};
let episodeId = '';
const currentEpisode = () => episodes[episodeId];
let initial;
const records = new Map();
const pending = new Map();
let queue = Promise.resolve();
let timer;
let blocked = false;

function status(message) {
    $('#flow-status').textContent = message;
}

function showError(error) {
    $('#flow-error').hidden = false;
    $('#flow-error').textContent = error.message;
    status(blocked ? 'Non enregistré. Exporte ton travail avant de recharger.' : 'Action interrompue : consulte le message ci-dessus.');
}

async function request(url, body) {
    const response = await fetch(url, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': initial.csrf },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const content = await response.json().catch(() => null);
        throw new Error(content?.errors ? Object.values(content.errors).flat().join('\n') : (content?.message || `Erreur HTTP ${response.status}.`));
    }
    return response.json();
}

function payload(episode) {
    return { id: episode.id, title: episode.title, document: JSON.stringify(episode) };
}

function save() {
    if (!currentEpisode()) return;
    pending.set(episodeId, copy(currentEpisode()));
    status('Modifications en attente…');
    clearTimeout(timer);
    timer = setTimeout(() => { flush().catch(showError); }, 600);
}

async function flush() {
    clearTimeout(timer);
    if (blocked) throw new Error('La synchronisation est bloquée après une erreur. Exporte ton travail et recharge pour éviter un écrasement.');
    const work = [...pending.entries()];
    pending.clear();
    const operation = queue.then(async () => {
        if (blocked) throw new Error('Synchronisation bloquée : exporte ton travail et recharge.');
        saving = true;
        try {
        for (const [id, episode] of work) {
            const record = records.get(id);
            try {
                const result = await request(record ? initial.saveUrl : initial.createUrl, {
                    ...payload(episode), versionId: record?.versionId,
                });
                records.set(id, result);
                status(pending.size ? 'Modifications en attente…' : 'Brouillon enregistré.');
            } catch (error) {
                blocked = true;
                for (const [key, value] of work) if (!pending.has(key)) pending.set(key, value);
                throw error;
            }
        }
        } finally {
            saving = false;
        }
    });
    queue = operation.catch(() => {});
    return operation;
}

async function togglePublish() {
    try {
        await flush();
        const episode = currentEpisode();
        const result = await request(initial.publishUrl, {
            id: episode.id, versionId: records.get(episode.id).versionId,
            published: episode.status !== 'published',
        });
        records.set(episode.id, result);
        episode.status = result.status;
        renderEpisodeSelect();
        status(episode.status === 'published' ? 'Version publiée dans le studio local.' : 'Épisode dépublié.');
    } catch (error) {
        showError(error);
    }
}

function exportEpisodeData(episode) {
    return copy(episode);
}

function mediaLabel(path) {
    if (mediaLabels[path]) return mediaLabels[path];
    try { return decodeURIComponent(path.split('/').pop()); }
    catch { return path; }
}

async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
        const raw = JSON.parse(await file.text());
        const incoming = raw.type === 'otome-workspace' ? Object.values(raw.episodes || {}) : [raw];
        if (!incoming.length || incoming.some(item => !item.id || !item.nodes)) throw new Error('Le fichier doit contenir un épisode ou un espace de travail valide.');
        if (!confirm('Importer ces épisodes ? Les épisodes existants recevront de nouvelles versions brouillons.')) return;
        await flush();
        const result = await request(initial.importUrl, {
            episodes: incoming.map(item => ({
                ...payload(item), versionId: records.get(item.id)?.versionId,
            })),
        });
        for (const row of result) {
            records.set(row.id, row);
            episodes[row.id] = normalizeEpisode({ ...row.data, id: row.id, title: row.title, status: row.status });
        }
        episodeId = incoming[0].id;
        renderEpisodeTab();
        status('Import enregistré en brouillon.');
    } catch (error) { showError(error); }
}

async function importDocxFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
        if (!confirm('Remplacer le contenu de cet épisode par le document Word dans un nouveau brouillon ?')) return;
        const current = currentEpisode();
        const { episode, avertissements } = await parseDocxVersEpisode(
            await file.arrayBuffer(), current.id, current.title, new Set(people.map(person => person.id)),
        );
        episodes[current.id] = normalizeEpisode({ ...episode, status: current.status });
        save();
        renderEpisodeTab();
        await flush();
        if (avertissements.length) alert(avertissements.join('\n'));
    } catch (error) { showError(error); }
}

function renderEpisodeTab() {
    renderEpisodeSelect();
    renderSceneFlow();
}

function initialize() {
    const element = $('#episode-flow-data');
    if (!element) return;
    initial = JSON.parse(element.textContent);
    people = [...initial.characters];
    if (!people.some(person => person.id === 'moi')) people.unshift({ id: 'moi', name: 'Héroïne' });
    episodes = Object.fromEntries(initial.episodes.filter(row => row.data).map(row => {
        records.set(row.id, row);
        for (const node of Object.values(row.data.nodes || {})) {
            if (node.speaker && node.speaker !== 'narration' && !people.some(person => person.id === node.speaker)) {
                people.push({ id: node.speaker, name: `${node.speaker} (hors catalogue)` });
            }
            for (const [field, category] of Object.entries({ background: 'backgrounds', cg: 'illustrations', music: 'music' })) {
                if (node[field] && !files[category].includes(node[field])) files[category].push(node[field]);
            }
        }
        return [row.id, normalizeEpisode({ ...row.data, id: row.id, title: row.title, status: row.status })];
    }));
    for (const asset of initial.media) {
        if (!files[asset.category]) continue;
        if (!files[asset.category].includes(asset.url)) files[asset.category].push(asset.url);
        mediaLabels[asset.url] = asset.label;
    }
    episodeId = initial.selected;
    $('#episode-select').onchange = (event) => {
        episodeId = event.target.value;
        const record = records.get(episodeId);
        if (record) history.replaceState(null, '', `${initial.previewBase}/${record.databaseId}`);
        renderEpisodeTab();
    };
    $('#episode-title').oninput = (event) => { currentEpisode().title = event.target.value; save(); };
    $('#episode-title').onchange = renderEpisodeSelect;
    $('#new-episode-main').onclick = newEpisode;
    $('#new-scene-main').onclick = newScene;
    $('#export-json').onclick = downloadCurrent;
    $('#export-all').onclick = downloadAll;
    $('#import-json').onchange = importFile;
    $('#import-docx').onchange = importDocxFile;
    $('#publish-episode').onclick = togglePublish;
    $('#save-episode').onclick = () => flush().catch(showError);
    $('#preview-episode').onclick = async () => {
        const popup = window.open('about:blank', '_blank');
        if (popup) popup.opener = null;
        try {
            await flush();
            const url = `${initial.previewBase}/${records.get(episodeId).databaseId}/preview`;
            if (popup) popup.location.href = url;
            else location.href = url;
        } catch (error) { popup?.close(); showError(error); }
    };
    bindSceneFlow();
    window.addEventListener('beforeunload', event => {
        if (pending.size || saving) { event.preventDefault(); event.returnValue = ''; }
    });
    renderEpisodeTab();
    status('Brouillon chargé. Enregistrement automatique après modification.');
}

let saving = false;
if (typeof document !== 'undefined') initialize();


function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueId(base, taken) {
  let index = 1;
  let candidate = `${base}_${index}`;
  while (taken.has(candidate)) {
    index += 1;
    candidate = `${base}_${index}`;
  }
  return candidate;
}

function nodeIdsForEpisode(episode) {
  return Object.keys(episode.nodes || {});
}

function sceneLabel(scene, index) {
  return `${index + 1}. ${scene.title || "Scène"}`;
}

function buildChoiceEffects(choice) {
  const target = choice.target || "";
  const gauge = choice.gauge || "amour";
  const delta = Number(choice.delta || 0);
  return target ? { [target]: { [gauge]: delta } } : {};
}

function normalizeScene(scene, index, episode) {
  const normalized = {
    ...scene,
    id: scene.id || `scene_${index + 1}`,
    title: scene.title || `Scène ${index + 1}`,
    background: scene.background || "",
    music: scene.music || "",
    nodeIds: ensureArray(scene.nodeIds),
  };

  normalized.nodeIds = normalized.nodeIds.filter((id) => episode.nodes[id]);
  return normalized;
}

function inferScenesFromNodes(episode) {
  const scenes = [];
  let activeScene = null;

  Object.entries(episode.nodes).forEach(([id, node]) => {
    const background = node.background || activeScene?.background || "";
    if (!activeScene || activeScene.background !== background) {
      activeScene = {
        id: `scene_${scenes.length + 1}`,
        title: `Scène ${scenes.length + 1}`,
        background,
        music: node.music || "",
        nodeIds: [],
      };
      scenes.push(activeScene);
    }
    activeScene.nodeIds.push(id);
  });

  return scenes;
}

function normalizeEpisode(raw) {
  const episode = copy(raw);
  episode.nodes ||= {};
  episode.status ||= "draft";
  episode.scenes = ensureArray(episode.scenes);

  if (episode.scenes.length === 0) {
    episode.scenes = inferScenesFromNodes(episode);
  }

  const used = new Set();
  episode.scenes = episode.scenes.map((scene, index) => {
    const normalized = normalizeScene(scene, index, episode);
    normalized.nodeIds.forEach((id) => used.add(id));
    return normalized;
  });

  const missing = nodeIdsForEpisode(episode).filter((id) => !used.has(id));
  if (missing.length && episode.scenes.length) {
    episode.scenes[episode.scenes.length - 1].nodeIds.push(...missing);
  }

  if (!episode.start) {
    episode.start = episode.scenes[0]?.nodeIds[0] || nodeIdsForEpisode(episode)[0] || "";
  }

  return episode;
}

function blankEpisode(id, title) {
  const startNode = "scene_1_dialogue_1";
  return {
    id,
    title,
    status: "draft",
    university: "Université Aster",
    start: startNode,
    music: "",
    nodes: {
      [startNode]: {
        type: "line",
        speaker: "moi",
        text: "",
        next: "",
        background: "",
        position: "center",
      },
    },
    scenes: [
      {
        id: "scene_1",
        title: "Scène 1",
        background: "",
        music: "",
        nodeIds: [startNode],
      },
    ],
  };
}

function labelsForSelect(list, value, emptyLabel = "— Aucun —", mapLabel = (item) => item) {
  const options = [...new Set([...list.filter(Boolean), ...(value ? [value] : [])])];
  return [
    `<option value="">${emptyLabel}</option>`,
    ...options.map((item) => `<option value="${esc(item)}" ${item === value ? "selected" : ""}>${esc(mapLabel(item))}</option>`),
  ].join("");
}

function peopleOptions(current) {
  return [
    '<option value="">— Aucun —</option>',
    ...people.map(
      (person) =>
        `<option value="${esc(person.id)}" ${person.id === current ? "selected" : ""}>${esc(person.name)}</option>`
    ),
  ].join("");
}

function saveFile(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function episodeDisplayName(episode) {
  return episode.title || episode.id;
}

function renderEpisodeSelect() {
  const episode = currentEpisode();
  $("#episode-select").innerHTML = Object.values(episodes)
    .map(
      (item) =>
        `<option value="${esc(item.id)}" ${item.id === episodeId ? "selected" : ""}>${esc(episodeDisplayName(item))}${item.status === "published" ? " ✅" : " (brouillon)"}</option>`
    )
    .join("");
  $("#episode-title").value = episode ? episode.title || "" : "";
  const boutonPublier = $("#publish-episode");
  if (boutonPublier && episode) {
    boutonPublier.textContent = episode.status === "published" ? "Dépublier" : "Publier";
    boutonPublier.classList.toggle("published", episode.status === "published");
  }
}

function renderSceneFlow() {
  const episode = currentEpisode();
  const container = $("#scene-flow");

  if (!episode) {
    container.innerHTML = '<p class="empty">Crée un épisode pour commencer.</p>';
    return;
  }


  // Calculé une seule fois pour tout le rendu : chaque carte partage cette liste au lieu de dupliquer
  // toutes les destinations possibles dans son propre menu.
  const indexCibles = buildTargetOptionsIndex(episode);

  container.innerHTML = `
    <datalist id="node-targets">${nodeTargetOptions(indexCibles)}</datalist>
    ${
      episode.scenes.length
        ? episode.scenes.map((scene, index) => renderSceneBlock(episode, scene, index, indexCibles)).join("")
        : '<p class="empty">Ajoute une première scène pour commencer cet épisode.</p>'
    }
  `;
}

function renderSceneBlock(episode, scene, index, indexCibles) {
  return `
    <article class="scene-block" data-scene="${esc(scene.id)}">
      <div class="scene-block-head">
        <div class="scene-title-row">
          <span class="scene-index">Scène ${index + 1}</span>
          <input class="scene-title-input" data-field="scene-title" value="${esc(scene.title || "")}" />
        </div>
        <button class="delete" data-delete-scene="${esc(scene.id)}">Supprimer la scène</button>
      </div>
      <div class="scene-settings">
        <label>Décor de la scène<select data-field="scene-background">${labelsForSelect(files.backgrounds, scene.background || "", "— Choisir un décor —", mediaLabel)}</select></label>
      </div>
      <div class="scene-nodes">
        ${
          scene.nodeIds.length
            ? scene.nodeIds.map((id, nodeIndex) => renderNodeCard(episode, episode.nodes[id], id, nodeIndex, indexCibles)).join("")
            : '<p class="empty">Aucun dialogue pour l’instant.</p>'
        }
      </div>
      <div class="scene-node-actions">
        <button class="primary-action" data-add-line="${esc(scene.id)}">+ Ajouter un dialogue</button>
        <button class="choice-btn" data-add-choice="${esc(scene.id)}">+ Ajouter un choix</button>
      </div>
    </article>
  `;
}

function buildTargetOptionsIndex(episode) {
  return episode.scenes.map((scene, sceneIndex) => ({
    label: sceneLabel(scene, sceneIndex),
    items: scene.nodeIds
      .map((id, nodeIndex) => {
        const node = episode.nodes[id];
        if (!node) return null;
        const kind = node.type === "choice" ? "Choix" : node.type === "end" ? "Fin" : node.type === "branch" ? "Aiguillage" : "Dialogue";
        const preview = (node.text || "").replaceAll("\n", " ").slice(0, 28);
        const label = `${kind} ${nodeIndex + 1}${preview ? " — " + preview : ""}`;
        return { id, html: `<option value="${esc(id)}" label="${esc(`${sceneLabel(scene, sceneIndex)} - ${label}`)}"></option>` };
      })
      .filter(Boolean),
  }));
}

function nodeTargetOptions(indexCibles) {
  return indexCibles.flatMap(({ items }) => items.map((item) => item.html)).join("");
}

function nodeTargetInput(current, field) {
  return `<input data-field="${field}" list="node-targets" value="${esc(current || "")}" placeholder="Identifiant du dialogue suivant" />`;
}

function validNodeTarget(episode, value, sourceId) {
  return value && value !== sourceId && episode.nodes[value] ? value : "";
}

function episodeTargetOptions(current) {
  const options = Object.values(episodes)
    .filter((item) => item.id !== episodeId)
    .map((item) => `<option value="${esc(item.id)}" ${item.id === current ? "selected" : ""}>${esc(episodeDisplayName(item))}</option>`)
    .join("");
  return `<option value="">— Aucun (retour à la sélection) —</option>${options}`;
}

function onScreenCheckboxes(node) {
  const selected = new Set(ensureArray(node.onScreen));
  return people
    .map(
      (person) => `
      <label class="onscreen-check">
        <input type="checkbox" data-field="onscreen" value="${esc(person.id)}" ${selected.has(person.id) ? "checked" : ""} />
        ${esc(person.name)}
      </label>`
    )
    .join("");
}

function renderNodeCard(episode, node, id, index, indexCibles) {
  if (!node) return "";
  // Un nœud "branch" est un aiguillage automatique géré par le moteur (lovomètres, choix passés) :
  // carte en lecture seule pour ne pas risquer de le casser en éditant la scène alentour.
  if (node.type === "branch") {
    const destinations = [
      ...(node.branches || []).map((branche) => branche.next),
      node.fallback ? `${node.fallback} (par défaut)` : null,
    ].filter(Boolean);
    return `
      <div class="node-card branch" data-node="${esc(id)}">
        <div class="node-card-head">
          <span class="node-index">${index + 1}. Aiguillage automatique</span>
          <button class="node-delete" data-delete-node="${esc(id)}" title="Supprimer">×</button>
        </div>
        <small class="branch-help">Ce nœud dirige automatiquement le joueur selon ses lovomètres et ses choix passés. Il n'est pas modifiable ici. Destinations : ${destinations.map((cible) => esc(cible)).join(", ") || "—"}.</small>
      </div>
    `;
  }
  const kind = node.type === "choice" ? "Choix" : node.type === "end" ? "Fin" : "Dialogue";
  const speakerOptions = [
    `<option value="narration" ${node.speaker === "narration" ? "selected" : ""}>Narration</option>`,
    ...people.map((person) => `<option value="${esc(person.id)}" ${person.id === node.speaker ? "selected" : ""}>${esc(person.name)}</option>`),
  ].join("");

  // La scission n'a de sens qu'à partir du 2e nœud d'une scène (couper avant le 1er ne change rien).
  const sceneDuNoeud = episode.scenes.find((scene) => scene.nodeIds.includes(id));
  const positionDansScene = sceneDuNoeud ? sceneDuNoeud.nodeIds.indexOf(id) : 0;
  const peutScinder = positionDansScene > 0;

  return `
    <div class="node-card ${node.type === "choice" ? "choice" : ""}" data-node="${esc(id)}">
      <div class="node-card-head">
        <span class="node-index">${index + 1}. ${kind}</span>
        <span class="node-head-actions">
          ${peutScinder ? `<button class="node-split" data-split-node="${esc(id)}" title="Couper la scène en deux à partir de ce dialogue">✂ Scinder ici</button>` : ""}
          <button class="node-delete" data-delete-node="${esc(id)}" title="Supprimer">×</button>
        </span>
      </div>
      <div class="node-grid">
        <label>Personnage<select data-field="speaker">${speakerOptions}</select></label>
        <label>Musique<select data-field="music">${labelsForSelect(files.music, node.music || "", "— Aucune musique —", mediaLabel)}</select></label>
        <label>Côté de la bulle<select data-field="position">
          <option value="" ${node.position !== "left" && node.position !== "right" ? "selected" : ""}>Automatique (à côté du personnage)</option>
          <option value="left" ${node.position === "left" ? "selected" : ""}>Toujours à gauche du personnage</option>
          <option value="right" ${node.position === "right" ? "selected" : ""}>Toujours à droite du personnage</option>
        </select></label>
        <label>Illustration<select data-field="cg">${labelsForSelect(files.illustrations, node.cg || "", "— Aucune illustration —", mediaLabel)}</select></label>
      </div>
      <label>Personnages à l’écran<span class="onscreen-list">${onScreenCheckboxes(node)}</span></label>
      <small class="effect-help">Coche un personnage pour qu’il apparaisse, décoche-le pour qu’il quitte l’écran. La liste est reprise telle quelle sur ce dialogue (3 personnages maximum).</small>
      <label>${node.type === "choice" ? "Question du choix" : "Phrase du dialogue"}<textarea data-field="text" rows="3">${esc(node.text || "")}</textarea></label>
      ${
        node.type === "choice"
          ? renderChoiceOptions(episode, node, id, indexCibles)
          : `
            <label class="node-end-toggle">
              <input type="checkbox" data-field="is-end" ${node.type === "end" ? "checked" : ""} />
              Fin de l’épisode
            </label>
            ${
              node.type === "end"
                ? `<label>Épisode suivant<select data-field="next-episode">${episodeTargetOptions(node.nextEpisode || "")}</select></label>`
                : `
                  <label>Suite${nodeTargetInput(node.next, "next")}</label>
                  ${!node.next ? '<small class="node-warning">⚠️ Aucune suite définie : le jeu se bloquera sur ce dialogue. Coche « Fin de l’épisode » si c’est voulu, sinon choisis un dialogue suivant.</small>'
                    : ""}
                `
            }
          `
      }
    </div>
  `;
}

function renderChoiceOptions(episode, node, nodeId, indexCibles) {
  return `
    <div class="node-options">
      ${(node.options || []).map((option, index) => renderChoiceOption(episode, option, index, nodeId, indexCibles)).join("")}
      <button class="add-option" data-add-option="true">+ Ajouter une réponse</button>
    </div>
  `;
}

function listerEffets(effects) {
  const lignes = [];
  for (const [personId, jauges] of Object.entries(effects || {})) {
    for (const [gauge, delta] of Object.entries(jauges || {})) {
      lignes.push({ personId, gauge, delta });
    }
  }
  return lignes.length ? lignes : [{ personId: "", gauge: "amour", delta: 0 }];
}

function renderChoiceEffect({ personId, gauge, delta }, index) {
  return `
    <div class="choice-option-grid choice-effect" data-effect="${index}">
      <label>Lovometer de<select data-field="option-target">${peopleOptions(personId)}</select></label>
      <label>Jauge<select data-field="option-gauge">
        <option value="amour" ${gauge === "amour" ? "selected" : ""}>Amour</option>
        <option value="amitie" ${gauge === "amitie" ? "selected" : ""}>Amitié</option>
      </select></label>
      <label>Variation (%)<input data-field="option-delta" type="number" min="-100" max="100" step="1" value="${esc(delta)}"></label>
      <button class="delete-effect" type="button" data-delete-effect="${index}" title="Retirer ce lovometer">×</button>
    </div>
  `;
}

function renderChoiceOption(episode, option, index, nodeId, indexCibles) {
  return `
    <article class="choice-option" data-option="${index}">
      <button class="delete-option" type="button" data-delete-option="${index}">×</button>
      <label>Réponse<textarea data-field="option-text" rows="2">${esc(option.text || "")}</textarea></label>
      ${listerEffets(option.effects).map(renderChoiceEffect).join("")}
      <button class="add-effect" type="button" data-add-effect="${index}">+ Ajouter un lovometer</button>
      <label>Mène à${nodeTargetInput(option.next, "option-next")}</label>
      <small class="effect-help">Bonne réponse : +5 · Neutre : 0 · Mauvaise réponse : −5. Une même réponse peut monter un lovometer et en faire baisser un autre.</small>
    </article>
  `;
}

function handleSceneFlowInput(target) {
  const field = target.dataset.field;
  if (!field) return;

  const episode = currentEpisode();
  if (!episode) return;

  const optionCard = target.closest(".choice-option");
  const nodeCard = target.closest(".node-card");
  const sceneCard = target.closest(".scene-block");

  if (optionCard && nodeCard) {
    const node = episode.nodes[nodeCard.dataset.node];
    const option = node?.options?.[Number(optionCard.dataset.option)];
    if (!option) return;

    if (field === "option-text") {
      option.text = target.value;
    } else if (field === "option-next") {
      if (target.value && !validNodeTarget(episode, target.value, nodeCard.dataset.node)) {
        alert('Choisis une destination existante différente de ce choix.');
        target.value = option.next || '';
        return;
      }
      option.next = validNodeTarget(episode, target.value, nodeCard.dataset.node);
      target.value = option.next;
    } else {
      option.effects = {};
      optionCard.querySelectorAll(".choice-effect").forEach((ligne) => {
        const person = ligne.querySelector('[data-field="option-target"]').value || "";
        if (!person) return;
        const gauge = ligne.querySelector('[data-field="option-gauge"]').value || "amour";
        const delta = Number(ligne.querySelector('[data-field="option-delta"]').value || 0);
        option.effects[person] = { ...(option.effects[person] || {}), [gauge]: delta };
      });
    }

    save();
    return;
  }

  if (nodeCard) {
    const node = episode.nodes[nodeCard.dataset.node];
    if (!node) return;

    if (field === "speaker") {
      node.speaker = target.value;
      // Un nouveau personnage qui prend la parole entre automatiquement en scène.
      const estPersonnage = node.speaker && node.speaker !== "moi" && node.speaker !== "narration";
      if (estPersonnage && Array.isArray(node.onScreen) && !node.onScreen.includes(node.speaker)) {
        node.onScreen = [...node.onScreen, node.speaker].slice(-3);
        save();
        renderSceneFlow();
        return;
      }
    }
    if (field === "music") node.music = target.value || "";
    if (field === "position") node.position = target.value;
    if (field === "cg") node.cg = target.value || "";
    if (field === "text") node.text = target.value;
    if (field === "next") {
      if (target.value && !validNodeTarget(episode, target.value, nodeCard.dataset.node)) {
        alert('Choisis une destination existante différente de ce dialogue.');
        target.value = node.next || '';
        return;
      }
      node.next = validNodeTarget(episode, target.value, nodeCard.dataset.node);
      target.value = node.next;
    }
    if (field === "next-episode") node.nextEpisode = target.value || null;
    if (field === "is-end") {
      node.type = target.checked ? "end" : "line";
      if (node.type === "end") node.next = "";
      renderSceneFlow();
    }
    if (field === "onscreen") {
      const boxes = [...nodeCard.querySelectorAll('[data-field="onscreen"]:checked')];
      if (boxes.length > 3) {
        target.checked = false;
        alert('Trois personnages maximum à l’écran.');
        return;
      }
      node.onScreen = boxes.map((box) => box.value);
    }

    save();
    return;
  }

  if (sceneCard) {
    const scene = episode.scenes.find((item) => item.id === sceneCard.dataset.scene);
    if (!scene) return;

    if (field === "scene-title") scene.title = target.value;
    if (field === "scene-background") {
      scene.background = target.value || "";
      scene.nodeIds.forEach((id) => {
        const node = episode.nodes[id];
        if (node) node.background = scene.background;
      });
    }

    save();
  }
}

function bindSceneFlow() {
  const container = $("#scene-flow");

  container.addEventListener("input", (event) => {
    if (!['next', 'option-next'].includes(event.target.dataset.field)) handleSceneFlowInput(event.target);
  });
  container.addEventListener("change", (event) => handleSceneFlowInput(event.target));

  container.addEventListener("click", (event) => {
    const addLine = event.target.closest("[data-add-line]");
    const addChoice = event.target.closest("[data-add-choice]");
    const deleteScene = event.target.closest("[data-delete-scene]");
    const deleteNode = event.target.closest("[data-delete-node]");
    const addOption = event.target.closest("[data-add-option]");
    const deleteOption = event.target.closest("[data-delete-option]");
    const addEffect = event.target.closest("[data-add-effect]");
    const deleteEffect = event.target.closest("[data-delete-effect]");
    const splitNode = event.target.closest("[data-split-node]");

    if (splitNode) scinderScene(splitNode.dataset.splitNode);
    else if (addLine) newNode(addLine.dataset.addLine, "line");
    else if (addChoice) newNode(addChoice.dataset.addChoice, "choice");
    else if (deleteScene) removeScene(deleteScene.dataset.deleteScene);
    else if (deleteNode) removeNode(deleteNode.dataset.deleteNode);
    else if (addEffect)
      addChoiceEffect(event.target.closest(".node-card").dataset.node, Number(addEffect.dataset.addEffect));
    else if (deleteEffect)
      removeChoiceEffect(
        event.target.closest(".node-card").dataset.node,
        Number(event.target.closest(".choice-option").dataset.option),
        Number(deleteEffect.dataset.deleteEffect)
      );
    else if (addOption) addChoiceOption(event.target.closest(".node-card").dataset.node);
    else if (deleteOption)
      removeChoiceOption(event.target.closest(".node-card").dataset.node, Number(deleteOption.dataset.deleteOption));
  });
}

function newEpisode() {
  let index = 2;
  let id = "";
  const existing = new Set(Object.keys(episodes));
  do {
    id = `episode${index}`;
    index += 1;
  } while (existing.has(id));

  episodes[id] = normalizeEpisode(blankEpisode(id, `Épisode ${index - 1}`));
  episodeId = id;
  save();
  renderEpisodeTab();
}

function newScene() {
  const episode = currentEpisode();
  const scene = {
    id: uniqueId("scene", new Set(episode.scenes.map((item) => item.id))),
    title: `Scène ${episode.scenes.length + 1}`,
    background: "",
    music: "",
    nodeIds: [],
  };

  const previousScene = episode.scenes[episode.scenes.length - 1];
  const lastPreviousId = previousScene?.nodeIds[previousScene.nodeIds.length - 1];
  const lastPreviousNode = lastPreviousId ? episode.nodes[lastPreviousId] : null;

  const firstNodeId = `${scene.id}_dialogue_1`;
  episode.nodes[firstNodeId] = {
    type: "line",
    speaker: "moi",
    text: "",
    next: "",
    background: scene.background || "",
    music: lastPreviousNode?.music || "",
    position: "center",
  };
  scene.nodeIds.push(firstNodeId);
  episode.scenes.push(scene);

  if (lastPreviousNode) {
    if (lastPreviousNode.type === "line" && !lastPreviousNode.next) {
      lastPreviousNode.next = firstNodeId;
    }
    if (lastPreviousNode.type === "choice") {
      lastPreviousNode.options.forEach((option) => {
        if (!option.next) option.next = firstNodeId;
      });
    }
  }

  episode.start = episode.start || firstNodeId;
  save();
  renderEpisodeTab();
}

function scinderScene(nodeId) {
  const episode = currentEpisode();
  const scene = episode.scenes.find((item) => item.nodeIds.includes(nodeId));
  if (!scene) return;

  const indexCoupure = scene.nodeIds.indexOf(nodeId);
  if (indexCoupure <= 0) return; // rien à couper avant le premier nœud

  const sceneIndex = episode.scenes.indexOf(scene);
  const noeudCoupure = episode.nodes[nodeId];

  // Les nœuds qui déménagent dans la nouvelle scène.
  const nodeIdsDeplaces = scene.nodeIds.slice(indexCoupure);
  scene.nodeIds = scene.nodeIds.slice(0, indexCoupure);

  const nouvelleScene = {
    id: uniqueId("scene", new Set(episode.scenes.map((item) => item.id))),
    title: `${scene.title || "Scène"} (suite)`,
    // La nouvelle scène reprend le décor/musique du nœud de coupure (modifiable ensuite).
    background: noeudCoupure?.background || scene.background || "",
    music: noeudCoupure?.music || scene.music || "",
    nodeIds: nodeIdsDeplaces,
  };

  episode.scenes.splice(sceneIndex + 1, 0, nouvelleScene);

  save();
  renderEpisodeTab();
}

function newNode(targetSceneId, type) {
  const episode = currentEpisode();
  const scene = episode.scenes.find((item) => item.id === targetSceneId);
  if (!scene) return;

  const existingIds = new Set(nodeIdsForEpisode(episode));
  const base = type === "choice" ? "choix" : "dialogue";
  const id = uniqueId(`${scene.id}_${base}`, existingIds);
  const previousId = scene.nodeIds[scene.nodeIds.length - 1];
  const previousNode = episode.nodes[previousId];
  const music = previousNode?.music || scene.music || "";

  const node =
    type === "choice"
      ? {
          type,
          speaker: "moi",
          text: "",
          options: [{ text: "Nouvelle réponse", effects: {}, next: "" }],
          background: scene.background || "",
          music,
          position: "center",
        }
      : {
          type,
          speaker: "moi",
          text: "",
          next: "",
          background: scene.background || "",
          music,
          position: "center",
        };

  episode.nodes[id] = node;
  node.onScreen = ensureArray(previousNode?.onScreen).slice(0, 3);

  if (previousNode) {
    if (previousNode.type === "line" && !previousNode.next) previousNode.next = id;
    if (previousNode.type === "choice") {
      previousNode.options.forEach((option) => {
        if (!option.next) option.next = id;
      });
    }
  }

  scene.nodeIds.push(id);
  episode.start = episode.start || id;
  save();
  renderEpisodeTab();
}

function removeScene(targetSceneId) {
  const episode = currentEpisode();
  if (episode.scenes.length <= 1) {
    alert("Un épisode doit garder au moins une scène.");
    return;
  }
  if (!confirm("Supprimer cette scène et tous ses dialogues ?")) return;

  const scene = episode.scenes.find((item) => item.id === targetSceneId);
  if (!scene) return;
  if (scene.nodeIds.length >= Object.keys(episode.nodes).length) {
    alert('Un épisode doit conserver au moins un dialogue.');
    return;
  }

  scene.nodeIds.forEach((id) => delete episode.nodes[id]);
  episode.scenes = episode.scenes.filter((item) => item.id !== targetSceneId);

  const remainingIds = new Set(nodeIdsForEpisode(episode));
  Object.values(episode.nodes).forEach((entry) => {
    if (entry.next && !remainingIds.has(entry.next)) entry.next = "";
    if (entry.type === "choice") {
      entry.options.forEach((option) => {
        if (option.next && !remainingIds.has(option.next)) option.next = "";
      });
    }
  });

  if (!remainingIds.has(episode.start)) {
    episode.start = episode.scenes[0]?.nodeIds[0] || "";
  }

  save();
  renderEpisodeTab();
}

function removeNode(id) {
  if (Object.keys(currentEpisode().nodes).length <= 1) {
    alert('Un épisode doit conserver au moins un dialogue.');
    return;
  }
  if (!confirm("Supprimer ce dialogue ?")) return;
  const episode = currentEpisode();
  delete episode.nodes[id];

  episode.scenes.forEach((scene) => {
    scene.nodeIds = scene.nodeIds.filter((nodeId) => nodeId !== id);
  });

  Object.values(episode.nodes).forEach((entry) => {
    if (entry.next === id) entry.next = "";
    if (entry.type === "choice") {
      entry.options.forEach((option) => {
        if (option.next === id) option.next = "";
      });
    }
  });

  if (episode.start === id) {
    episode.start = episode.scenes[0]?.nodeIds[0] || "";
  }

  save();
  renderEpisodeTab();
}

function addChoiceOption(id) {
  const node = currentEpisode().nodes[id];
  if (!node) return;
  node.options.push({ text: "Nouvelle réponse", effects: {}, next: "" });
  save();
  renderEpisodeTab();
}

function removeChoiceOption(id, index) {
  const node = currentEpisode().nodes[id];
  if (!node) return;
  node.options.splice(index, 1);
  save();
  renderEpisodeTab();
}

function addChoiceEffect(id, optionIndex) {
  const option = currentEpisode().nodes[id]?.options?.[optionIndex];
  if (!option) return;
  option.effects ||= {};
  const libre = people.find((person) => !option.effects[person.id]);
  if (!libre) return;
  option.effects[libre.id] = { amour: 0 };
  save();
  renderEpisodeTab();
}

function removeChoiceEffect(id, optionIndex, effectIndex) {
  const option = currentEpisode().nodes[id]?.options?.[optionIndex];
  if (!option) return;
  const restants = listerEffets(option.effects).filter((_, index) => index !== effectIndex);
  option.effects = {};
  for (const { personId, gauge, delta } of restants) {
    if (!personId) continue;
    option.effects[personId] = { ...(option.effects[personId] || {}), [gauge]: delta };
  }
  save();
  renderEpisodeTab();
}

function downloadCurrent() {
  const episode = currentEpisode();
  saveFile(exportEpisodeData(episode), `${episode.id}.json`);
}

function downloadAll() {
  saveFile(
    {
      type: "otome-workspace",
      episodes,
      episodeId,
    },
    "otome-workspace.json"
  );
}

export { normalizeEpisode, blankEpisode, inferScenesFromNodes, listerEffets, validNodeTarget };
