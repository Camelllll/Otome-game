const STORE = "otome-admin-episodes-v2";

const $ = (selector) => document.querySelector(selector);
const copy = (value) => JSON.parse(JSON.stringify(value));
const esc = (value = "") =>
  String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[char]));

const files = {
  backgrounds: [
    "",
    "assets/Décors/Chambre chez les parents.png",
    "assets/Décors/Voiture (scène 2).png",
    "assets/Décors/Entrée campus.png",
    "assets/Décors/Cour Campus.jpg",
    "assets/Décors/Couloir chambres campus.png",
    "assets/Décors/Chambre sucrette campus.png",
    "assets/Décors/Cafétéria campus.png",
    "assets/Décors/Amphi 1.png",
  ],
  illustrations: [
    "",
    "assets/Illustrations/Épisode 1/Illustration 1 - Ezequiel.png",
    "assets/Illustrations/Episode 2/Illustration 1 - Sasha et Mehdi.png",
    "assets/Illustrations/Episode 2/Illustration 2 - Camel.png",
  ],
  music: ["", "Romantique doux", "Piano émotion", "Soirée campus", "Tension romantique"],
};

let people = [];
let episodes = {};
let episodeId = "";
let sceneId = "";
let nodeId = "";

const currentEpisode = () => episodes[episodeId];

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

function nodeLabel(episode, scene, id) {
  const node = episode.nodes[id];
  const sceneIndex = episode.scenes.findIndex((item) => item.id === scene.id) + 1;
  const kind = node.type === "choice" ? "Choix" : "Dialogue";
  return `${sceneIndex}. ${scene.title || "Scène"} - ${kind}`;
}

function sceneLabel(scene, index) {
  return `${index + 1}. ${scene.title || "Scène"}`;
}

function describeNode(node) {
  if (!node) return "Contenu vide";
  if (node.type === "choice") {
    const text = (node.text || "Choix sans question").replaceAll("\n", " ");
    return `${text.slice(0, 30)} · ${node.options.length} réponse(s)`;
  }
  const text = (node.text || "Dialogue vide").replaceAll("\n", " ");
  return text.slice(0, 42);
}

function buildChoiceEffects(choice) {
  const target = choice.target || "";
  const gauge = choice.gauge || "amour";
  const delta = Number(choice.delta || 0);
  return target ? { [target]: { [gauge]: delta } } : {};
}

function normalizeScene(scene, index, episode) {
  const normalized = {
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
    const background = node.background || "";
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

  if (!episode.start || !episode.nodes[episode.start]) {
    episode.start = episode.scenes[0]?.nodeIds[0] || nodeIdsForEpisode(episode)[0] || "";
  }

  return episode;
}

function blankEpisode(id, title) {
  const startNode = "scene_1_dialogue_1";
  return {
    id,
    title,
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
  return [
    `<option value="">${emptyLabel}</option>`,
    ...list.map((item) => `<option value="${esc(item)}" ${item === value ? "selected" : ""}>${esc(mapLabel(item))}</option>`),
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

function nodeOptions(episode, current, emptyLabel = "— Fin —", excludeId = "") {
  const ids = nodeIdsForEpisode(episode).filter((id) => id !== excludeId);
  return [
    `<option value="">${emptyLabel}</option>`,
    ...ids.map((id) => {
      const node = episode.nodes[id];
      const scene = episode.scenes.find((item) => item.nodeIds.includes(id)) || episode.scenes[0];
      return `<option value="${esc(id)}" ${id === current ? "selected" : ""}>${esc(nodeLabel(episode, scene, id))}</option>`;
    }),
  ].join("");
}

function sceneOptions(current, emptyLabel = "— Aucune scène —") {
  return [
    `<option value="">${emptyLabel}</option>`,
    ...currentEpisode().scenes.map((scene, index) => {
      const selected = scene.id === current ? "selected" : "";
      return `<option value="${esc(scene.id)}" ${selected}>${esc(sceneLabel(scene, index))}</option>`;
    }),
  ].join("");
}

function save() {
  localStorage.setItem(STORE, JSON.stringify({ episodes, episodeId }));
}

function exportEpisodeData(episode) {
  const data = copy(episode);
  delete data.scenes;
  return data;
}

function saveFile(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function findSceneForNode(id) {
  return currentEpisode().scenes.find((scene) => scene.nodeIds.includes(id)) || currentEpisode().scenes[0];
}

function setSceneForNode(scene, node) {
  if (!scene || !node) return;
  scene.nodeIds.forEach((id) => {
    const current = currentEpisode().nodes[id];
    if (!current) return;
    current.background = scene.background || "";
    current.music = scene.music || "";
  });
}

function episodeDisplayName(episode) {
  return episode.title || episode.id;
}

function renderEpisodes() {
  $("#episode-list").innerHTML = Object.values(episodes)
    .map((episode) => {
      const active = episode.id === episodeId ? "active" : "";
      const totalScenes = ensureArray(episode.scenes).length;
      const totalNodes = Object.keys(episode.nodes || {}).length;
      return `
        <button data-episode="${esc(episode.id)}" class="episode-item ${active}">
          <strong>${esc(episodeDisplayName(episode))}</strong>
          <small>${totalScenes} scène(s) · ${totalNodes} dialogue(s)</small>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("[data-episode]").forEach((button) => {
    button.onclick = () => {
      episodeId = button.dataset.episode;
      const episode = currentEpisode();
      sceneId = episode.scenes[0]?.id || "";
      nodeId = episode.scenes[0]?.nodeIds[0] || episode.start || "";
      save();
      render();
    };
  });
}

function renderScenes() {
  const episode = currentEpisode();
  $("#episode-subtitle").textContent = episodeDisplayName(episode);
  $("#scene-list").innerHTML = episode.scenes
    .map((scene, index) => {
      const active = scene.id === sceneId ? "active" : "";
      return `
        <button data-scene="${esc(scene.id)}" class="scene-item ${active}">
          <strong>${esc(sceneLabel(scene, index))}</strong>
          <small>${scene.nodeIds.length} élément(s)</small>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("[data-scene]").forEach((button) => {
    button.onclick = () => {
      sceneId = button.dataset.scene;
      const scene = episode.scenes.find((item) => item.id === sceneId);
      nodeId = scene?.nodeIds[0] || "";
      renderScenes();
      renderNodes();
      renderEditor();
    };
  });
}

function renderNodes() {
  const episode = currentEpisode();
  const scene = episode.scenes.find((item) => item.id === sceneId) || episode.scenes[0];
  const ids = scene?.nodeIds || [];

  $("#node-list").innerHTML = ids
    .map((id) => {
      const node = episode.nodes[id];
      const active = id === nodeId ? "active" : "";
      const summary = describeNode(node);
      return `
        <button data-node="${esc(id)}" class="node-item ${active}">
          <i class="dot ${node.type === "choice" ? "choice" : ""}"></i>
          <span>
            <strong>${esc(nodeLabel(episode, scene, id))}</strong>
            <small>${esc(summary)}</small>
          </span>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("[data-node]").forEach((button) => {
    button.onclick = () => {
      nodeId = button.dataset.node;
      sceneId = findSceneForNode(nodeId)?.id || sceneId;
      renderNodes();
      renderEditor();
    };
  });
}

function renderSceneEditor(scene) {
  return `
    <div class="scene-card">
      <h3>Décor de la scène</h3>
      <p class="intro">Tous les éléments ci-dessous garderont ce décor jusqu’à la scène suivante.</p>
      <div class="scene-grid">
        <label>Nom de l’épisode<input id="episode-title" value="${esc(currentEpisode().title || "")}"></label>
        <label>Nom de la scène<input id="scene-title" value="${esc(scene.title || "")}"></label>
        <label class="wide">Décor<select id="scene-background">${labelsForSelect(files.backgrounds, scene.background || "", "— Choisir un décor —", (item) => item.split("/").pop())}</select></label>
        <label>Musique de la scène<select id="scene-music">${labelsForSelect(files.music, scene.music || "", "— Garder la musique —")}</select></label>
      </div>
    </div>
  `;
}

function renderChoiceEditor(node) {
  return `
    <section class="options">
      <h2 class="section-title">Réponses</h2>
      <p class="intro">Les réponses continuent automatiquement avec l’élément suivant de cette scène.</p>
      <div id="options">${node.options.map((option, index) => renderChoice(option, index)).join("")}</div>
      <button id="add-option" class="add-option">+ Ajouter une réponse</button>
    </section>
  `;
}

function renderChoice(option, index) {
  const effectKey = Object.keys(option.effects || {})[0] || "";
  const effectValue = effectKey ? option.effects[effectKey] : {};
  const gauge = Object.keys(effectValue || {})[0] || "amour";
  const delta = effectValue?.[gauge] ?? 0;

  return `
    <article class="option" data-option="${index}">
      <button class="delete-option" type="button">×</button>
      <label>Réponse<textarea class="choice-text" rows="2">${esc(option.text || "")}</textarea></label>
      <div class="option-grid">
        <label>Lovometer de<select class="choice-target">${peopleOptions(effectKey)}</select></label>
        <label>Jauge<select class="choice-gauge">
          <option value="amour" ${gauge === "amour" ? "selected" : ""}>Amour</option>
          <option value="amitie" ${gauge === "amitie" ? "selected" : ""}>Amitié</option>
        </select></label>
        <label>Variation (%)<input class="choice-delta" type="number" min="-100" max="100" step="1" value="${esc(delta)}"></label>
      </div>
      <small class="effect-help">Bonne réponse : +5 · Neutre : 0 · Mauvaise réponse : −5</small>
    </article>
  `;
}

function speakerName(speaker) {
  if (speaker === "narration") return "Narration";
  return people.find((person) => person.id === speaker)?.name || "Personnage";
}

function renderPreview(scene, node) {
  const background = scene.background ? `style="background-image:url('${esc(scene.background)}')"` : "";
  const position = ["left", "center", "right"].includes(node.position) ? node.position : "center";
  const choices = node.type === "choice"
    ? `<div class="preview-choices">${node.options.map((option) => `<span>${esc(option.text || "Réponse")}</span>`).join("")}</div>`
    : "";
  return `
    <section class="preview" aria-label="Aperçu de la scène">
      <div class="preview-head"><h3>Aperçu</h3><small>tel que le joueur le verra</small></div>
      <div class="preview-stage ${scene.background ? "has-background" : ""}" ${background}>
        <div class="preview-scene-name">${esc(scene.title || "Scène")}</div>
        <div class="preview-bubble ${position}">
          <strong>${esc(speakerName(node.speaker))}</strong>
          <p>${esc(node.text || (node.type === "choice" ? "Question du choix" : "Votre dialogue apparaîtra ici."))}</p>
        </div>
        ${choices}
      </div>
    </section>
  `;
}

function renderEditor() {
  const root = $("#editor-content");
  const episode = currentEpisode();
  const scene = episode.scenes.find((item) => item.id === sceneId) || episode.scenes[0];
  const node = episode.nodes[nodeId] || (scene ? episode.nodes[scene.nodeIds[0]] : null);

  if (!scene || !node) {
    root.innerHTML = '<p class="empty">Crée une scène pour commencer, puis ajoute des dialogues à l’intérieur.</p>';
    return;
  }

  const speakerOptions = [
    `<option value="narration" ${node.speaker === "narration" ? "selected" : ""}>Narration</option>`,
    ...people.map((person) => `<option value="${esc(person.id)}" ${person.id === node.speaker ? "selected" : ""}>${esc(person.name)}</option>`),
  ].join("");

  root.innerHTML = `
    <div class="editor-head">
      <div>
        <h2>${esc(episodeDisplayName(episode))}</h2>
        <p class="intro">Scène active: ${esc(scene.title || "Scène")}</p>
      </div>
      <button id="delete-node" class="delete">Supprimer cet élément</button>
    </div>

    ${renderSceneEditor(scene)}

    <div class="grid">
      <label>Personnage<select id="speaker">${speakerOptions}</select></label>
      <label>Position de bulle<select id="position">
        ${["left", "center", "right"].map((position) => `<option value="${position}" ${node.position === position ? "selected" : ""}>${position[0].toUpperCase()}${position.slice(1)}</option>`).join("")}
      </select></label>
      <label class="wide">${node.type === "choice" ? "Question ou dialogue avant le choix" : "Phrase du dialogue"}<textarea id="text" rows="5">${esc(node.text || "")}</textarea></label>
      <label>Illustration<select id="cg">${labelsForSelect(files.illustrations, node.cg || "", "— Aucune illustration —", (item) => item.split("/").pop())}</select></label>
    </div>

    ${node.type === "choice" ? renderChoiceEditor(node) : ""}
    ${renderPreview(scene, node)}
  `;

  bindEditor(scene, node);
}

function syncChoice(optionCard, node, index) {
  const option = node.options[index];
  if (!option) return;

  option.text = optionCard.querySelector(".choice-text").value;
  const target = optionCard.querySelector(".choice-target").value || "";
  const gauge = optionCard.querySelector(".choice-gauge").value || "amour";
  const delta = Number(optionCard.querySelector(".choice-delta").value || 0);
  option.effects = target ? { [target]: { [gauge]: delta } } : {};
}

function bindEditor(scene, node) {
  const episode = currentEpisode();

  const update = () => {
    episode.title = $("#episode-title").value.trim() || episode.title;
    scene.title = $("#scene-title").value.trim() || scene.title;
    scene.background = $("#scene-background").value || "";
    scene.music = $("#scene-music").value || "";

    setSceneForNode(scene, node);

    node.speaker = $("#speaker").value;
    node.position = $("#position").value;
    node.text = $("#text").value;
    node.cg = $("#cg").value || "";
    episode.start = episode.scenes[0]?.nodeIds[0] || episode.start;

    save();
    renderNodes();
    const preview = document.querySelector("#editor-content .preview");
    if (preview) preview.outerHTML = renderPreview(scene, node);
  };

  document.querySelectorAll(".editor input, .editor select, .editor textarea").forEach((input) => {
    input.onchange = update;
    input.oninput = update;
  });

  $("#delete-node").onclick = () => {
    if (!confirm(`Supprimer cet élément ?`)) return;

    const oldId = nodeId;
    delete episode.nodes[oldId];

    episode.scenes.forEach((item) => {
      item.nodeIds = item.nodeIds.filter((id) => id !== oldId);
    });

    Object.values(episode.nodes).forEach((entry) => {
      if (entry.next === oldId) entry.next = "";
      if (entry.type === "choice") {
        entry.options.forEach((option) => {
          if (option.next === oldId) option.next = "";
        });
      }
    });

    nodeId = scene.nodeIds[0] || "";
    if (!nodeId) {
      const fallbackScene = episode.scenes.find((item) => item.nodeIds.length > 0);
      sceneId = fallbackScene?.id || sceneId;
      nodeId = fallbackScene?.nodeIds[0] || "";
    }

    if (episode.start === oldId) episode.start = nodeId || "";

    save();
    render();
  };

  if (node.type === "choice") {
    $("#add-option").onclick = () => {
      node.options.push({ text: "Nouvelle réponse", effects: {}, next: "" });
      save();
      renderEditor();
    };

    document.querySelectorAll(".option").forEach((card) => {
      const index = Number(card.dataset.option);
      const sync = () => {
        syncChoice(card, node, index);
        save();
        renderNodes();
        const preview = document.querySelector("#editor-content .preview");
        if (preview) preview.outerHTML = renderPreview(scene, node);
      };

      card.querySelectorAll("input, select, textarea").forEach((input) => {
        input.onchange = sync;
        input.oninput = sync;
      });

      card.querySelector(".delete-option").onclick = () => {
        node.options.splice(index, 1);
        save();
        renderEditor();
      };
    });
  }
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
  sceneId = "scene_1";
  nodeId = "scene_1_dialogue_1";
  save();
  render();
}

function newScene() {
  const episode = currentEpisode();
  const nextIndex = episode.scenes.length + 1;
  const scene = {
    id: `scene_${nextIndex}`,
    title: `Scène ${nextIndex}`,
    background: "",
    music: "",
    nodeIds: [],
  };

  const previousScene = episode.scenes[episode.scenes.length - 1];
  const firstNodeId = `${scene.id}_dialogue_1`;
  episode.nodes[firstNodeId] = {
    type: "line",
    speaker: "moi",
    text: "",
    next: "",
    background: scene.background || "",
    music: scene.music || "",
    position: "center",
  };
  scene.nodeIds.push(firstNodeId);
  episode.scenes.push(scene);
  sceneId = scene.id;
  nodeId = firstNodeId;

  if (previousScene?.nodeIds.length) {
    const lastId = previousScene.nodeIds[previousScene.nodeIds.length - 1];
    const lastNode = episode.nodes[lastId];
    if (lastNode) {
      if (lastNode.type === "line" && !lastNode.next) {
        lastNode.next = firstNodeId;
      }
      if (lastNode.type === "choice") {
        lastNode.options.forEach((option) => {
          if (!option.next) option.next = firstNodeId;
        });
      }
    }
  }

  save();
  render();
}

function newNode(type) {
  const episode = currentEpisode();
  let scene = episode.scenes.find((item) => item.id === sceneId);
  if (!scene) {
    scene = episode.scenes[0];
    sceneId = scene?.id || "";
  }
  if (!scene) return;

  const existingIds = new Set(nodeIdsForEpisode(episode));
  const base = type === "choice" ? "choix" : "dialogue";
  const id = uniqueId(`${scene.id}_${base}`, existingIds);
  const node =
    type === "choice"
      ? {
          type,
          speaker: "moi",
          text: "",
          options: [{ text: "Nouvelle réponse", effects: {}, next: "" }],
          background: scene.background || "",
          music: scene.music || "",
          position: "center",
        }
      : {
          type,
          speaker: "moi",
          text: "Nouveau dialogue",
          next: "",
          background: scene.background || "",
          music: scene.music || "",
          position: "center",
        };

  episode.nodes[id] = node;

  const previousId = scene.nodeIds[scene.nodeIds.length - 1];
  const previousNode = episode.nodes[previousId];
  if (previousNode) {
    if (previousNode.type === "line" && !previousNode.next) {
      previousNode.next = id;
    }
    if (previousNode.type === "choice") {
      previousNode.options.forEach((option) => {
        if (!option.next) option.next = id;
      });
    }
  }

  scene.nodeIds.push(id);
  nodeId = id;
  save();
  render();
}

function syncSceneFromEditor() {
  const episode = currentEpisode();
  const scene = episode.scenes.find((item) => item.id === sceneId) || episode.scenes[0];
  if (!scene) return null;
  return scene;
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

function importFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));

      if (data.type === "otome-workspace" && data.episodes) {
        episodes = Object.fromEntries(
          Object.entries(data.episodes).map(([id, episode]) => [id, normalizeEpisode(episode)])
        );
        episodeId = data.episodeId && episodes[data.episodeId] ? data.episodeId : Object.keys(episodes)[0];
      } else if (data.id && data.nodes) {
        episodes[data.id] = normalizeEpisode(data);
        episodeId = data.id;
      } else {
        throw new Error("Fichier invalide");
      }

      const active = currentEpisode();
      sceneId = active.scenes[0]?.id || "";
      nodeId = active.scenes[0]?.nodeIds[0] || active.start || "";
      save();
      render();
    } catch (error) {
      alert("Fichier invalide");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

async function init() {
  const [characters, publishedEpisodes] = await Promise.all([
    fetch("data/characters.json").then((response) => response.json()),
    Promise.all(["episode1", "episode2"].map(async (id) => {
      const response = await fetch(`data/episodes/${id}.json`);
      return response.ok ? response.json() : null;
    })),
  ]);

  people = [
    ...(characters.player ? [characters.player] : []),
    ...ensureArray(characters.crushs),
    ...ensureArray(characters.secondary),
  ].map((person) => ({
    id: person.id,
    name: person.name || person.defaultName,
  }));

  const publishedById = Object.fromEntries(
    publishedEpisodes
      .filter(Boolean)
      .map((episode) => [episode.id, normalizeEpisode(episode)])
  );

  const saved = localStorage.getItem(STORE);
  let restored = false;
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const restoredEpisodes = Object.fromEntries(
        Object.entries(parsed?.episodes || {})
          .filter(([, episode]) => episode && typeof episode === "object" && episode.nodes)
          .map(([id, episode]) => [id, normalizeEpisode(episode)])
      );

      if (Object.keys(restoredEpisodes).length > 0) {
        episodes = { ...publishedById, ...restoredEpisodes };
        episodeId = parsed.episodeId && episodes[parsed.episodeId] ? parsed.episodeId : Object.keys(episodes)[0];
        restored = true;
      }
    } catch {
      // Une ancienne sauvegarde invalide ne doit jamais empêcher l'accès à l'admin.
    }
  }

  if (!restored) {
    episodes = publishedById;
    episodeId = episodes.episode1 ? "episode1" : Object.keys(episodes)[0] || "";
  }

  const active = currentEpisode();
  sceneId = active.scenes[0]?.id || "";
  nodeId = active.scenes[0]?.nodeIds[0] || active.start || "";

  bind();
  render();
}

function bind() {
  $("#new-episode").onclick = newEpisode;
  $("#new-episode-main").onclick = newEpisode;
  $("#new-scene").onclick = newScene;
  $("#new-scene-main").onclick = newScene;
  $("#new-line").onclick = () => newNode("line");
  $("#new-line-main").onclick = () => newNode("line");
  $("#new-choice").onclick = () => newNode("choice");
  $("#export-json").onclick = downloadCurrent;
  $("#export-all").onclick = downloadAll;
  $("#import-json").onchange = importFile;
}

function render() {
  renderEpisodes();
  renderScenes();
  renderNodes();
  renderEditor();
}

init().catch((error) => {
  $("#editor-content").innerHTML = `<p class="empty">${esc(error.message)}</p>`;
});
