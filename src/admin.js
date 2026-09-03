import { listEpisodes, saveEpisode, publishEpisode, unpublishEpisode, listMedia, addMediaEntry, uploadMedia, deleteMedia } from "./services/adminRepository.js";
import { connexionAdmin, obtenirSessionAdmin } from "./services/adminAuth.js";
import { definirSeSouvenir } from "./services/supabaseClient.js";
import { parseDocxVersEpisode } from "./services/docxImportService.js";

const STORE = "otome-admin-episodes-v2"; // cache local de secours uniquement, la base est la source de vérité

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

// Snapshot des entrées d'origine (fichiers bundlés dans assets/) : distinct des médias uploadés en base.
let BASE_FILES = copy(files);
let mediaLabels = {};
// Chemin -> { id, category } pour les médias venant de la base (nécessaire pour les supprimer).
let mediaAssetIndex = {};

let people = [];
let extraPeople = [];
let episodes = {};
let episodeId = "";
let shop = { currency: { name: "Gemmes", id: "gemmes" }, items: [] };
let activeTab = "episodes";

const WARDROBE_SLOTS = ["haut", "bas", "coiffure", "accessoire", "chaussures"];
const SHOP_STORE = "otome-admin-shop-v1";
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

// Charge la bibliothèque de médias depuis la base (partagée entre tous les admins/appareils).
async function loadMediaLibrary() {
  const medias = await listMedia();
  mediaAssetIndex = {};
  medias.forEach(({ id, category, path, label }) => {
    if (!files[category]) return;
    if (!files[category].includes(path)) files[category].push(path);
    mediaLabels[path] = label;
    mediaAssetIndex[path] = { id, category };
  });
}

// Référence un chemin déjà existant (ex: assets/... du dépôt) sans upload de fichier.
async function ajouterReferenceMedia(category, value) {
  const trimmed = (value || "").trim();
  if (!trimmed) return;
  const cree = await addMediaEntry(category, trimmed, trimmed);
  if (!files[category].includes(cree.path)) files[category].push(cree.path);
  mediaLabels[cree.path] = cree.label;
  mediaAssetIndex[cree.path] = { id: cree.id, category };
  renderMedia();
  renderSceneFlow();
}

// Upload un vrai fichier vers le bucket Storage "media" + référence en base.
async function ajouterFichierMedia(file, category) {
  const cree = await uploadMedia(file, category);
  if (!files[category].includes(cree.path)) files[category].push(cree.path);
  mediaLabels[cree.path] = cree.label;
  mediaAssetIndex[cree.path] = { id: cree.id, category };
  renderMedia();
  renderSceneFlow();
}

async function removeMediaItem(category, value) {
  if (BASE_FILES[category].includes(value)) return;
  const reference = mediaAssetIndex[value];
  if (!reference) return;
  await deleteMedia(reference.id, value);
  files[category] = files[category].filter((item) => item !== value);
  delete mediaLabels[value];
  delete mediaAssetIndex[value];
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

let minuteurSynchronisation = null;
let minuteurCacheLocal = null;

function sauvegarderCacheLocal() {
  localStorage.setItem(STORE, JSON.stringify({ episodes, episodeId }));
}

function save() {
  // Les deux sauvegardes sont différées afin que la saisie reste fluide, même avec de longs épisodes.
  clearTimeout(minuteurCacheLocal);
  minuteurCacheLocal = setTimeout(sauvegarderCacheLocal, 150);
  const episode = currentEpisode();
  if (!episode) return;
  clearTimeout(minuteurSynchronisation);
  minuteurSynchronisation = setTimeout(() => {
    saveEpisode(episode.id, episode.title, exportEpisodeData(episode), episode.status).catch((erreur) => {
      console.warn("Synchronisation en ligne impossible pour cet épisode.", erreur);
    });
  }, 500);
}

async function togglePublish() {
  const episode = currentEpisode();
  if (!episode) return;
  try {
    if (episode.status === "published") {
      await unpublishEpisode(episode.id);
      episode.status = "draft";
    } else {
      await saveEpisode(episode.id, episode.title, exportEpisodeData(episode), "published");
      episode.status = "published";
    }
    renderEpisodeSelect();
  } catch (erreur) {
    alert("Impossible de mettre à jour le statut de publication (voir la console).");
    console.error(erreur);
  }
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
        if (category === "people") {
          const dataUrl = await readFileAsDataUrl(file);
          addPerson(pathInput.value.trim() || file.name, dataUrl);
        } else {
          try {
            await ajouterFichierMedia(file, category);
          } catch (erreur) {
            alert("Upload impossible : " + (erreur.message || "erreur inconnue."));
          }
        }
        fileInput.value = "";
        pathInput.value = "";
      };
    }

    addBtn.onclick = async () => {
      if (category === "people") {
        addPerson(pathInput.value.trim(), "");
      } else {
        try {
          await ajouterReferenceMedia(category, pathInput.value.trim());
        } catch (erreur) {
          alert("Ajout impossible : " + (erreur.message || "erreur inconnue."));
        }
      }
      pathInput.value = "";
    };
  });

  document.querySelectorAll("[data-remove-media]").forEach((button) => {
    button.onclick = async () => {
      try {
        await removeMediaItem(button.dataset.removeMedia, button.dataset.value);
      } catch (erreur) {
        alert("Suppression impossible : " + (erreur.message || "erreur inconnue."));
      }
    };
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

// Index des cibles possibles pour "Suite"/"Mène à", construit une seule fois par rendu complet.
function buildTargetOptionsIndex(episode) {
  return episode.scenes.map((scene, sceneIndex) => ({
    label: sceneLabel(scene, sceneIndex),
    items: scene.nodeIds
      .map((id, nodeIndex) => {
        const node = episode.nodes[id];
        if (!node) return null;
        const kind = node.type === "choice" ? "Choix" : node.type === "end" ? "Fin" : "Dialogue";
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

// Liste les autres épisodes pour le sélecteur "Épisode suivant" d'un nœud de fin.
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
  const kind = node.type === "choice" ? "Choix" : node.type === "end" ? "Fin" : "Dialogue";
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
      ${node.options.map((option, index) => renderChoiceOption(episode, option, index, nodeId, indexCibles)).join("")}
      <button class="add-option" data-add-option="true">+ Ajouter une réponse</button>
    </div>
  `;
}

function renderChoiceOption(episode, option, index, nodeId, indexCibles) {
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
      <label>Mène à${nodeTargetInput(option.next, "option-next")}</label>
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
      option.next = validNodeTarget(episode, target.value, nodeCard.dataset.node);
      target.value = option.next;
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
    if (field === "next") {
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

async function importDocxFile(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const personnagesConnus = new Set(people.map((personne) => personne.id));
    const idExistant = currentEpisode()?.id;
    const idCible = idExistant || Object.keys(episodes).find((id) => !episodes[id]) || "episode1";
    const titre = currentEpisode()?.title || file.name.replace(/\.docx$/i, "");

    const { episode, avertissements } = await parseDocxVersEpisode(arrayBuffer, idCible, titre, personnagesConnus);

    episodes[idCible] = normalizeEpisode({ ...episode, status: currentEpisode()?.status || "draft" });
    episodeId = idCible;
    save();
    renderEpisodeTab();

    if (avertissements.length > 0) {
      alert(`Épisode importé avec des avertissements :\n\n${avertissements.join("\n")}`);
    } else {
      alert(`Épisode importé : ${Object.keys(episode.nodes).length} nœuds générés.`);
    }
  } catch (erreur) {
    alert("Import du .docx impossible : " + (erreur.message || "erreur inconnue."));
    console.error(erreur);
  }
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
      renderEpisodeTab();
    } catch (error) {
      alert("Fichier invalide");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

async function init() {
  const [characters, dbEpisodes, publishedShop] = await Promise.all([
    fetch("data/characters.json").then((response) => response.json()),
    listEpisodes(),
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
  await loadMediaLibrary();
  loadPeopleExtras();
  people = [...people, ...extraPeople];

  // La base est la source de vérité : les épisodes (brouillons et publiés) viennent tous de là.
  episodes = Object.fromEntries(
    dbEpisodes.map((row) => [row.id, normalizeEpisode({ ...row.data, id: row.id, title: row.title, status: row.status })])
  );

  if (Object.keys(episodes).length === 0) {
    // Base vide (premier lancement) : on part d'un épisode 1 vierge.
    episodes.episode1 = normalizeEpisode(blankEpisode("episode1", "Épisode 1"));
  }

  episodeId = episodes.episode1 ? "episode1" : Object.keys(episodes)[0] || "";

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
    renderEpisodeTab();
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
  $("#import-docx").onchange = importDocxFile;
  $("#publish-episode").onclick = togglePublish;
  bindSceneFlow();
}

function render() {
  renderEpisodeSelect();
  renderSceneFlow();
  renderMedia();
  renderVestiaire();
}

// Version allégée utilisée pour toute édition d'épisode (nœud/scène) : les onglets Média et
// Vestiaire n'ont pas besoin d'être reconstruits à chaque fois, ce qui était la vraie source de lenteur.
function renderEpisodeTab() {
  renderEpisodeSelect();
  renderSceneFlow();
}

// Bascule l'affichage via style.display : l'attribut "hidden" est écrasé par la règle CSS
// ".admin-login { display:flex }" (même spécificité, la règle CSS gagne).
function afficherApp() {
  $("#admin-login").style.display = "none";
  $("#admin-app").style.display = "";
  $("#admin-app").hidden = false;
}

async function demarrerAdmin() {
  let session = null;
  try {
    session = await obtenirSessionAdmin();
  } catch (erreur) {
    // Ne doit jamais empêcher l'affichage du formulaire de connexion.
    console.warn("Vérification de session impossible, affichage du formulaire de connexion.", erreur);
  }

  if (session) {
    afficherApp();
    try {
      await init();
    } catch (erreur) {
      console.error("[admin] erreur pendant init()", erreur);
      $("#scene-flow").innerHTML = `<p class="empty">Erreur au chargement : ${esc(erreur.message)}</p>`;
    }
    return;
  }

  $("#admin-login-submit").addEventListener("click", async () => {
    const erreurEl = $("#admin-login-error");
    erreurEl.textContent = "";
    try {
      definirSeSouvenir($("#admin-remember-me").checked);
      await connexionAdmin($("#admin-email").value, $("#admin-password").value);
      afficherApp();
      await init();
    } catch (erreur) {
      erreurEl.textContent = "Connexion impossible : " + (erreur.message || "identifiants invalides.");
      console.error("[admin] erreur de connexion", erreur);
    }
  });
}

demarrerAdmin().catch((error) => {
  console.error("[admin] erreur fatale au démarrage", error);
});

