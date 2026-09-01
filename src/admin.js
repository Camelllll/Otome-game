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
    "assets/Décors/Cour campus nuit.png",
    "assets/Décors/Couloir chambres campus.png",
    "assets/Décors/Chambre sucrette campus.png",
    "assets/Décors/Cafétéria campus.png",
    "assets/Décors/Amphi 1.png",
  ],
  illustrations: [
    "",
    "assets/Illustrations/Épisode 1/Illustration 1 - Liam.png",
    "assets/Illustrations/Episode 2/Illustration 1 - Sasha et Mehdi.png",
    "assets/Illustrations/Episode 2/Illustration 2 - Camel.png",
    "assets/Illustrations/Episode 2/Illustration 3 - Camel + sucrette.png",
    "assets/Illustrations/Episode 2/Illustration 3 - Mehdi + sucrette.jpg",
    "assets/Illustrations/Épisode 3/Illustration 1 - Isaac.png",
    "assets/Illustrations/Épisode 3/Illustration 2 - Stella.png",
    "assets/Illustrations/Épisode 3/Illustration 3 - Mehdi + sucrette.JPG",
    "assets/Illustrations/Épisode 3/Illustration 4 - Camel + sucrette.png",
    "assets/Illustrations/Épisode 3/Illustration 5 - Sasha + sucrette.JPG",
    "assets/Illustrations/Épisode 3/Illustration 6 - Aaron.png",
    "assets/Illustrations/Épisode 4/Illustration 1 - Stella + sucrette.png",
    "assets/Illustrations/Épisode 4/Illustration 2 - Sasha + sucrette.png",
    "assets/Illustrations/Épisode 4/Illustration 3 - Aaron + sucrette.png",
    "assets/Illustrations/Épisode 4/Illustration 4 - Camel + sucrette.png",
    "assets/Illustrations/Épisode 4/Illustration 4 - Mehdi + sucrette.png",
  ],
  music: ["", "Romantique doux", "Piano émotion", "Soirée campus", "Tension romantique"],
};

// Dossiers scannés au démarrage pour découvrir automatiquement les nouveaux fichiers ajoutés sur le disque
// (fonctionne avec le listing de dossier fourni par `python3 -m http.server` ; ignoré silencieusement sinon).
const MEDIA_FOLDERS = {
  backgrounds: ["assets/Décors/"],
  illustrations: [
    "assets/Illustrations/Épisode 1/",
    "assets/Illustrations/Episode 2/",
    "assets/Illustrations/Épisode 3/",
    "assets/Illustrations/Épisode 4/",
  ],
};

// Snapshot des entrées d'origine : sert à distinguer ce qui est supprimable (ajouté depuis l'admin).
let BASE_FILES = copy(files);
let mediaLabels = {};

let people = [];
let extraPeople = [];
let episodes = {};
let episodeId = "";
let shop = { currency: { name: "Gemmes", id: "gemmes" }, items: [] };
let activeTab = "episodes";

const WARDROBE_SLOTS = ["haut", "bas", "coiffure", "accessoire", "chaussures"];
const SHOP_STORE = "otome-admin-shop-v1";
const MEDIA_STORE = "otome-admin-media-v1";
const PEOPLE_STORE = "otome-admin-people-v1";

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

function slugify(value) {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "personnage"
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Lit le listing HTML d'un dossier (fourni par ex. par `python3 -m http.server`) pour trouver les fichiers ajoutés.
async function discoverFolder(folderPath) {
  try {
    const response = await fetch(folderPath);
    if (!response.ok) return [];
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    return [...doc.querySelectorAll("a[href]")]
      .map((link) => decodeURIComponent(link.getAttribute("href")))
      .filter((name) => !name.includes("/") && /\.(png|jpe?g|webp|gif)$/i.test(name))
      .map((name) => `${folderPath}${name}`);
  } catch {
    // Pas de listing de dossier disponible (hébergement statique sans autoindex) : on garde la liste connue.
    return [];
  }
}

async function discoverMedia() {
  for (const [category, folders] of Object.entries(MEDIA_FOLDERS)) {
    const found = (await Promise.all(folders.map(discoverFolder))).flat();
    found.forEach((path) => {
      if (!files[category].includes(path)) files[category].push(path);
    });
  }
}

function loadMediaExtras() {
  try {
    const saved = JSON.parse(localStorage.getItem(MEDIA_STORE) || "null");
    if (!saved) return;
    ensureArray(saved.backgrounds).forEach((value) => {
      if (value && !files.backgrounds.includes(value)) files.backgrounds.push(value);
    });
    ensureArray(saved.illustrations).forEach((value) => {
      if (value && !files.illustrations.includes(value)) files.illustrations.push(value);
    });
    ensureArray(saved.music).forEach((value) => {
      if (value && !files.music.includes(value)) files.music.push(value);
    });
    mediaLabels = saved.labels && typeof saved.labels === "object" ? saved.labels : {};
  } catch {
    // Un brouillon média invalide ne doit jamais empêcher l'accès à l'admin.
  }
}

function saveMediaExtras() {
  localStorage.setItem(
    MEDIA_STORE,
    JSON.stringify({
      backgrounds: files.backgrounds.filter((item) => !BASE_FILES.backgrounds.includes(item)),
      illustrations: files.illustrations.filter((item) => !BASE_FILES.illustrations.includes(item)),
      music: files.music.filter((item) => !BASE_FILES.music.includes(item)),
      labels: mediaLabels,
    })
  );
}

function addMediaItem(category, value, label = "") {
  const trimmed = (value || "").trim();
  if (!trimmed) return;
  if (!files[category].includes(trimmed)) files[category].push(trimmed);
  if (label) mediaLabels[trimmed] = label;
  saveMediaExtras();
  renderMedia();
  renderSceneFlow();
}

function removeMediaItem(category, value) {
  if (BASE_FILES[category].includes(value)) return;
  files[category] = files[category].filter((item) => item !== value);
  delete mediaLabels[value];
  saveMediaExtras();
  renderMedia();
  renderSceneFlow();
}

function loadPeopleExtras() {
  try {
    const saved = JSON.parse(localStorage.getItem(PEOPLE_STORE) || "null");
    extraPeople = ensureArray(saved?.people).filter((person) => person && person.id && person.name);
  } catch {
    extraPeople = [];
  }
}

function savePeopleExtras() {
  localStorage.setItem(PEOPLE_STORE, JSON.stringify({ people: extraPeople }));
}

function addPerson(name, sprite) {
  const trimmedName = (name || "").trim();
  if (!trimmedName) return;
  const existingIds = new Set(people.map((person) => person.id));
  const id = uniqueId(slugify(trimmedName), existingIds);
  const person = { id, name: trimmedName, sprite: sprite || "" };
  people.push(person);
  extraPeople.push(person);
  savePeopleExtras();
  renderMedia();
  renderSceneFlow();
}

function removePerson(id) {
  if (!extraPeople.some((person) => person.id === id)) return;
  people = people.filter((person) => person.id !== id);
  extraPeople = extraPeople.filter((person) => person.id !== id);
  savePeopleExtras();
  renderMedia();
  renderSceneFlow();
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

function mediaLabel(path) {
  if (!path) return "";
  if (path.startsWith("data:")) return mediaLabels[path] || "Image importée";
  return path.split("/").pop();
}

function renderMediaAddRow(category, { placeholder, withFile = true, accept = "" } = {}) {
  return `
    <div class="media-add-row" data-category="${esc(category)}">
      <input type="text" class="media-add-path" placeholder="${esc(placeholder)}" />
      ${
        withFile
          ? `<label class="btn btn-light media-file-label">Choisir un fichier<input type="file" class="media-add-file" accept="${esc(accept)}" hidden /></label>`
          : ""
      }
      <button type="button" class="primary-action media-add-btn">+ Ajouter</button>
    </div>
  `;
}

function renderMedia() {
  const backgrounds = files.backgrounds.filter(Boolean);
  const illustrations = files.illustrations.filter(Boolean);
  const music = files.music.filter(Boolean);

  const mediaCard = (category, path) => `
    <div class="media-card">
      <img src="${esc(path)}" alt="${esc(mediaLabel(path))}" loading="lazy" />
      <div class="media-name">${esc(mediaLabel(path))}</div>
      ${
        BASE_FILES[category].includes(path)
          ? ""
          : `<button class="delete media-remove" data-remove-media="${esc(category)}" data-value="${esc(path)}">Supprimer</button>`
      }
    </div>`;

  $("#media-content").innerHTML = `
    <p class="branch-help">Ajoute ici tes décors, illustrations, musiques et personnages : ils apparaîtront ensuite dans les menus de l'onglet Épisodes. Pour une image, choisis un fichier ou indique son chemin dans <code>assets/</code>.</p>
    <section class="media-section">
      <h2>Décors (${backgrounds.length})</h2>
      ${renderMediaAddRow("backgrounds", { placeholder: "assets/Décors/mon-decor.png", accept: "image/*" })}
      <div class="media-grid">
        ${backgrounds.map((path) => mediaCard("backgrounds", path)).join("")}
      </div>
    </section>
    <section class="media-section">
      <h2>Illustrations (${illustrations.length})</h2>
      ${renderMediaAddRow("illustrations", { placeholder: "assets/Illustrations/mon-illustration.png", accept: "image/*" })}
      <div class="media-grid">
        ${illustrations.map((path) => mediaCard("illustrations", path)).join("")}
      </div>
    </section>
    <section class="media-section">
      <h2>Musiques (${music.length})</h2>
      ${renderMediaAddRow("music", { placeholder: "Nom du morceau", withFile: false })}
      <ul class="media-list">
        ${music
          .map(
            (name) => `
          <li>
            <span>🎵 ${esc(name)}</span>
            ${
              BASE_FILES.music.includes(name)
                ? ""
                : `<button class="delete media-remove" data-remove-media="music" data-value="${esc(name)}">Supprimer</button>`
            }
          </li>`
          )
          .join("")}
      </ul>
    </section>
    <section class="media-section">
      <h2>Personnages (${people.length})</h2>
      <div class="media-add-row" data-category="people">
        <input type="text" class="media-add-path" placeholder="Nom du personnage" />
        <label class="btn btn-light media-file-label">Choisir un sprite<input type="file" class="media-add-file" accept="image/*" hidden /></label>
        <button type="button" class="primary-action media-add-btn">+ Ajouter</button>
      </div>
      <div class="media-grid">
        ${people
          .map(
            (person) => `
          <div class="media-card">
            ${person.sprite ? `<img src="${esc(person.sprite)}" alt="${esc(person.name)}" loading="lazy" />` : `<img alt="" />`}
            <div class="media-name">${esc(person.name)}</div>
            ${
              extraPeople.some((extra) => extra.id === person.id)
                ? `<button class="delete media-remove" data-remove-person="${esc(person.id)}">Supprimer</button>`
                : ""
            }
          </div>`
          )
          .join("")}
      </div>
    </section>
  `;

  bindMedia();
}

function bindMedia() {
  document.querySelectorAll("#media-content .media-add-row").forEach((row) => {
    const category = row.dataset.category;
    const pathInput = row.querySelector(".media-add-path");
    const fileInput = row.querySelector(".media-add-file");
    const addBtn = row.querySelector(".media-add-btn");

    if (fileInput) {
      fileInput.onchange = async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const dataUrl = await readFileAsDataUrl(file);
        if (category === "people") {
          addPerson(pathInput.value.trim() || file.name, dataUrl);
        } else {
          addMediaItem(category, dataUrl, file.name);
        }
        fileInput.value = "";
        pathInput.value = "";
      };
    }

    addBtn.onclick = () => {
      if (category === "people") {
        addPerson(pathInput.value.trim(), "");
      } else {
        addMediaItem(category, pathInput.value.trim());
      }
      pathInput.value = "";
    };
  });

  document.querySelectorAll("[data-remove-media]").forEach((button) => {
    button.onclick = () => removeMediaItem(button.dataset.removeMedia, button.dataset.value);
  });

  document.querySelectorAll("[data-remove-person]").forEach((button) => {
    button.onclick = () => removePerson(button.dataset.removePerson);
  });
}

function saveShop() {
  localStorage.setItem(SHOP_STORE, JSON.stringify(shop));
}

function newShopItem() {
  const existingIds = new Set(shop.items.map((item) => item.id));
  const id = uniqueId("article", existingIds);
  shop.items.push({ id, name: "Nouvel article", slot: WARDROBE_SLOTS[0], price: 0, sprite: "" });
  saveShop();
  renderVestiaire();
}

function deleteShopItem(id) {
  shop.items = shop.items.filter((item) => item.id !== id);
  saveShop();
  renderVestiaire();
}

function updateShopItem(id, field, value) {
  const item = shop.items.find((entry) => entry.id === id);
  if (!item) return;
  item[field] = field === "price" ? Number(value || 0) : value;
  saveShop();
}

function downloadShop() {
  saveFile(shop, "shop.json");
}

function renderVestiaire() {
  $("#vestiaire-content").innerHTML = `
    <div class="vestiaire-toolbar">
      <button id="new-item" class="primary-action">+ Ajouter un article</button>
      <button id="export-shop" class="btn btn-light" style="color:var(--accent);border-color:var(--border)">Exporter le vestiaire</button>
    </div>
    <div class="vestiaire-grid">
      ${shop.items
        .map(
          (item) => `
        <div class="vestiaire-card" data-id="${esc(item.id)}">
          ${item.sprite ? `<img src="${esc(item.sprite)}" alt="${esc(item.name)}" />` : `<img alt="" />`}
          <div>
            <label>Nom</label>
            <input data-field="name" value="${esc(item.name)}" />
          </div>
          <div>
            <label>Emplacement</label>
            <select data-field="slot">
              ${WARDROBE_SLOTS.map(
                (slot) => `<option value="${esc(slot)}" ${slot === item.slot ? "selected" : ""}>${esc(slot)}</option>`
              ).join("")}
            </select>
          </div>
          <div>
            <label>Prix (${esc(shop.currency?.name || "Gemmes")})</label>
            <input data-field="price" type="number" min="0" value="${item.price}" />
          </div>
          <div>
            <label>Sprite</label>
            <input data-field="sprite" value="${esc(item.sprite || "")}" placeholder="assets/..." />
          </div>
          <button class="delete" data-delete="${esc(item.id)}">Supprimer cet article</button>
        </div>`
        )
        .join("") || '<p class="empty">Aucun article pour le moment.</p>'}
    </div>
  `;

  $("#new-item").onclick = newShopItem;
  $("#export-shop").onclick = downloadShop;

  document.querySelectorAll("#vestiaire-content .vestiaire-card").forEach((card) => {
    const id = card.dataset.id;
    card.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("input", () => {
        updateShopItem(id, input.dataset.field, input.value);
        if (input.dataset.field === "sprite") {
          const img = card.querySelector("img");
          if (img) img.src = input.value;
        }
      });
    });
    card.querySelector("[data-delete]").onclick = () => deleteShopItem(id);
  });
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tab}`);
  });
  $("#topbar-title").textContent = { episodes: "Épisodes", media: "Média", vestiaire: "Vestiaire" }[tab];
}

function episodeDisplayName(episode) {
  return episode.title || episode.id;
}

function renderEpisodeSelect() {
  const episode = currentEpisode();
  $("#episode-select").innerHTML = Object.values(episodes)
    .map(
      (item) =>
        `<option value="${esc(item.id)}" ${item.id === episodeId ? "selected" : ""}>${esc(episodeDisplayName(item))}</option>`
    )
    .join("");
  $("#episode-title").value = episode ? episode.title || "" : "";
}

function renderSceneFlow() {
  const episode = currentEpisode();
  const container = $("#scene-flow");

  if (!episode) {
    container.innerHTML = '<p class="empty">Crée un épisode pour commencer.</p>';
    return;
  }

  container.innerHTML = episode.scenes.length
    ? episode.scenes.map((scene, index) => renderSceneBlock(episode, scene, index)).join("")
    : '<p class="empty">Ajoute une première scène pour commencer cet épisode.</p>';
}

function renderSceneBlock(episode, scene, index) {
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
            ? scene.nodeIds.map((id, nodeIndex) => renderNodeCard(episode, episode.nodes[id], id, nodeIndex)).join("")
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

function nodeTargetOptions(episode, current, excludeId = "") {
  const groups = episode.scenes
    .map((scene, sceneIndex) => {
      const items = scene.nodeIds
        .filter((id) => id !== excludeId)
        .map((id) => {
          const node = episode.nodes[id];
          if (!node) return "";
          const nodeIndex = scene.nodeIds.indexOf(id);
          const kind = node.type === "choice" ? "Choix" : "Dialogue";
          const preview = (node.text || "").replaceAll("\n", " ").slice(0, 28);
          const label = `${kind} ${nodeIndex + 1}${preview ? " — " + preview : ""}`;
          return `<option value="${esc(id)}" ${id === current ? "selected" : ""}>${esc(label)}</option>`;
        })
        .join("");
      return items ? `<optgroup label="${esc(sceneLabel(scene, sceneIndex))}">${items}</optgroup>` : "";
    })
    .join("");

  return `<option value="">— Fin de l’épisode —</option>${groups}`;
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

function renderNodeCard(episode, node, id, index) {
  if (!node) return "";
  const kind = node.type === "choice" ? "Choix" : "Dialogue";
  const speakerOptions = [
    `<option value="narration" ${node.speaker === "narration" ? "selected" : ""}>Narration</option>`,
    ...people.map((person) => `<option value="${esc(person.id)}" ${person.id === node.speaker ? "selected" : ""}>${esc(person.name)}</option>`),
  ].join("");

  return `
    <div class="node-card ${node.type === "choice" ? "choice" : ""}" data-node="${esc(id)}">
      <div class="node-card-head">
        <span class="node-index">${index + 1}. ${kind}</span>
        <button class="node-delete" data-delete-node="${esc(id)}" title="Supprimer">×</button>
      </div>
      <div class="node-grid">
        <label>Personnage<select data-field="speaker">${speakerOptions}</select></label>
        <label>Musique<select data-field="music">${labelsForSelect(files.music, node.music || "", "— Aucune musique —")}</select></label>
        <label>Position de bulle<select data-field="position">
          ${["left", "center", "right"].map((position) => `<option value="${position}" ${node.position === position ? "selected" : ""}>${position[0].toUpperCase()}${position.slice(1)}</option>`).join("")}
        </select></label>
        <label>Illustration<select data-field="cg">${labelsForSelect(files.illustrations, node.cg || "", "— Aucune illustration —", mediaLabel)}</select></label>
      </div>
      <label>Personnages à l’écran<span class="onscreen-list">${onScreenCheckboxes(node)}</span></label>
      <small class="effect-help">Laisse tout décoché pour garder la mise en scène automatique (le jeu garde les 3 derniers qui ont parlé).</small>
      <label>${node.type === "choice" ? "Question du choix" : "Phrase du dialogue"}<textarea data-field="text" rows="3">${esc(node.text || "")}</textarea></label>
      ${
        node.type === "choice"
          ? renderChoiceOptions(episode, node, id)
          : `<label>Suite<select data-field="next">${nodeTargetOptions(episode, node.next || "", id)}</select></label>`
      }
    </div>
  `;
}

function renderChoiceOptions(episode, node, nodeId) {
  return `
    <div class="node-options">
      ${node.options.map((option, index) => renderChoiceOption(episode, option, index, nodeId)).join("")}
      <button class="add-option" data-add-option="true">+ Ajouter une réponse</button>
    </div>
  `;
}

function renderChoiceOption(episode, option, index, nodeId) {
  const effectKey = Object.keys(option.effects || {})[0] || "";
  const effectValue = effectKey ? option.effects[effectKey] : {};
  const gauge = Object.keys(effectValue || {})[0] || "amour";
  const delta = effectValue?.[gauge] ?? 0;

  return `
    <article class="choice-option" data-option="${index}">
      <button class="delete-option" type="button" data-delete-option="${index}">×</button>
      <label>Réponse<textarea data-field="option-text" rows="2">${esc(option.text || "")}</textarea></label>
      <div class="choice-option-grid">
        <label>Lovometer de<select data-field="option-target">${peopleOptions(effectKey)}</select></label>
        <label>Jauge<select data-field="option-gauge">
          <option value="amour" ${gauge === "amour" ? "selected" : ""}>Amour</option>
          <option value="amitie" ${gauge === "amitie" ? "selected" : ""}>Amitié</option>
        </select></label>
        <label>Variation (%)<input data-field="option-delta" type="number" min="-100" max="100" step="1" value="${esc(delta)}"></label>
      </div>
      <label>Mène à<select data-field="option-next">${nodeTargetOptions(episode, option.next || "", nodeId)}</select></label>
      <small class="effect-help">Bonne réponse : +5 · Neutre : 0 · Mauvaise réponse : −5</small>
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
      option.next = target.value || "";
    } else {
      const person = optionCard.querySelector('[data-field="option-target"]').value || "";
      const gauge = optionCard.querySelector('[data-field="option-gauge"]').value || "amour";
      const delta = Number(optionCard.querySelector('[data-field="option-delta"]').value || 0);
      option.effects = person ? { [person]: { [gauge]: delta } } : {};
    }

    save();
    return;
  }

  if (nodeCard) {
    const node = episode.nodes[nodeCard.dataset.node];
    if (!node) return;

    if (field === "speaker") node.speaker = target.value;
    if (field === "music") node.music = target.value || "";
    if (field === "position") node.position = target.value;
    if (field === "cg") node.cg = target.value || "";
    if (field === "text") node.text = target.value;
    if (field === "next") node.next = target.value || "";
    if (field === "onscreen") {
      node.onScreen = [...nodeCard.querySelectorAll('[data-field="onscreen"]:checked')].map((box) => box.value);
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

  container.addEventListener("input", (event) => handleSceneFlowInput(event.target));
  container.addEventListener("change", (event) => handleSceneFlowInput(event.target));

  container.addEventListener("click", (event) => {
    const addLine = event.target.closest("[data-add-line]");
    const addChoice = event.target.closest("[data-add-choice]");
    const deleteScene = event.target.closest("[data-delete-scene]");
    const deleteNode = event.target.closest("[data-delete-node]");
    const addOption = event.target.closest("[data-add-option]");
    const deleteOption = event.target.closest("[data-delete-option]");

    if (addLine) newNode(addLine.dataset.addLine, "line");
    else if (addChoice) newNode(addChoice.dataset.addChoice, "choice");
    else if (deleteScene) removeScene(deleteScene.dataset.deleteScene);
    else if (deleteNode) removeNode(deleteNode.dataset.deleteNode);
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
  render();
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
  render();
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
  render();
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
  render();
}

function removeNode(id) {
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
  render();
}

function addChoiceOption(id) {
  const node = currentEpisode().nodes[id];
  if (!node) return;
  node.options.push({ text: "Nouvelle réponse", effects: {}, next: "" });
  save();
  render();
}

function removeChoiceOption(id, index) {
  const node = currentEpisode().nodes[id];
  if (!node) return;
  node.options.splice(index, 1);
  save();
  render();
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
  const [characters, publishedEpisodes, publishedShop] = await Promise.all([
    fetch("data/characters.json").then((response) => response.json()),
    Promise.all(["episode1", "episode2"].map(async (id) => {
      const response = await fetch(`data/episodes/${id}.json`);
      return response.ok ? response.json() : null;
    })),
    fetch("data/shop.json").then((response) => (response.ok ? response.json() : null)),
  ]);

  shop = publishedShop || shop;
  const savedShop = localStorage.getItem(SHOP_STORE);
  if (savedShop) {
    try {
      shop = JSON.parse(savedShop);
    } catch {
      // Une ancienne sauvegarde invalide ne doit jamais empêcher l'accès à l'admin.
    }
  }

  people = [
    ...(characters.player ? [characters.player] : []),
    ...ensureArray(characters.crushs),
    ...ensureArray(characters.secondary),
  ].map((person) => ({
    id: person.id,
    name: person.name || person.defaultName,
    sprite: person.sprite || "",
  }));

  await discoverMedia();
  BASE_FILES = copy(files);
  loadMediaExtras();
  loadPeopleExtras();
  people = [...people, ...extraPeople];

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

  bind();
  render();
}

function bind() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });
  $("#episode-select").onchange = (event) => {
    episodeId = event.target.value;
    save();
    render();
  };
  $("#episode-title").onchange = (event) => {
    const episode = currentEpisode();
    if (episode) episode.title = event.target.value.trim() || episode.title;
    save();
    renderEpisodeSelect();
  };
  $("#new-episode-main").onclick = newEpisode;
  $("#new-scene-main").onclick = newScene;
  $("#export-json").onclick = downloadCurrent;
  $("#export-all").onclick = downloadAll;
  $("#import-json").onchange = importFile;
  bindSceneFlow();
}

function render() {
  renderEpisodeSelect();
  renderSceneFlow();
  renderMedia();
  renderVestiaire();
}

init().catch((error) => {
  $("#scene-flow").innerHTML = `<p class="empty">${esc(error.message)}</p>`;
});

