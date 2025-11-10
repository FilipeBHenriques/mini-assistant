import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  MODEL_MANIFEST,
  getBuiltinModel,
  getDefaultModel,
} from "./utils/modelManifest.js";
import {
  STATE_KEYS,
  createDefaultConfig,
  normalizeConfig,
} from "./utils/ghostConfig.js";

const electronAPI = window.electronAPI;
const hasElectronBridge =
  typeof electronAPI === "object" && electronAPI !== null;
const STORAGE_KEY = "ghost-preview-settings";

const canvas = document.getElementById("settings-canvas");
const modelSelect = document.getElementById("model-select");
const importModelButton = document.getElementById("btn-import-model");
const modelHint = document.getElementById("model-hint");
const animationSelects = {
  idle: document.getElementById("animation-idle"),
  dragging: document.getElementById("animation-dragging"),
  dragged: document.getElementById("animation-dragged"),
  walking: document.getElementById("animation-walking"),
};
const previewButtons = document.querySelectorAll("[data-preview]");
const playCycleButton = document.getElementById("btn-play-cycle");
const resetCameraButton = document.getElementById("btn-reset-camera");
const previewWrapper = document.getElementById("preview-wrapper");

if (!canvas || !modelSelect || !previewWrapper) {
  console.warn("Settings preview UI is missing required elements.");
}

let settings = createDefaultConfig();

async function loadSettings() {
  try {
    const loaded = await window.electronAPI?.getSettings(true);
    if (loaded) {
      settings = normalizeConfig(loaded);
    }
  } catch (err) {
    console.warn("Failed to load settings:", err);
  }
}

async function saveSettings() {
  try {
    const saved = await window.electronAPI?.saveSettings(settings);
  } catch (err) {
    console.warn("Failed to save settings:", err);
  }
}

loadSettings();

let renderer;
let scene;
let camera;
let controls;
let mixer;
let activeModel;
let clips = [];
let clipLookup = new Map();
let isPlayingSequence = false;
let currentSequence = [];
let sequenceIndex = 0;

const clock = new THREE.Clock();
const loader = new GLTFLoader();

function initRenderer() {
  if (!canvas) return;

  scene = new THREE.Scene();
  scene.background = null;

  const dimensions = previewWrapper?.getBoundingClientRect() ?? {
    width: canvas.clientWidth || 4,
    height: canvas.clientHeight || 3,
  };
  const aspect = dimensions.width / Math.max(dimensions.height, 1);
  camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
  camera.position.set(2.8, 1.8, 2.8);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(dimensions.width, dimensions.height);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 1, 0);

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, 1.1);
  directional.position.set(3, 6, 5);
  scene.add(directional);

  const rimLight = new THREE.DirectionalLight(0x7ab5ff, 0.65);
  rimLight.position.set(-4, 3, -2);
  scene.add(rimLight);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(2.8, 48),
    new THREE.MeshBasicMaterial({
      color: 0x1f2230,
      opacity: 0.58,
      transparent: true,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);

  animate();
  observeResize();
}

function observeResize() {
  if (!previewWrapper || !renderer || !camera) return;
  if (typeof ResizeObserver !== "undefined") {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        renderer.setSize(width, height);
        camera.aspect = width / Math.max(height, 1);
        camera.updateProjectionMatrix();
      }
    });
    resizeObserver.observe(previewWrapper);
  } else {
    const handleWindowResize = () => {
      const rect = previewWrapper.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      camera.aspect = rect.width / Math.max(rect.height, 1);
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleWindowResize);
    handleWindowResize();
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);
  if (controls) controls.update();
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

function disposeActiveModel() {
  // Make sure we're only rendering ONE model instance at a time
  if (!activeModel) return;
  scene.remove(activeModel);
  activeModel.traverse((child) => {
    if (child.isMesh) {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) {
        child.material.forEach((mat) => mat?.dispose?.());
      } else {
        child.material?.dispose?.();
      }
    }
  });
  activeModel = undefined;
  clips = [];
  clipLookup.clear();
  mixer = undefined;
}

document
  .getElementById("btn-save-settings-footer")
  ?.addEventListener("click", () => {
    console.log("savesettings");
    saveSettings(settings);
  });

function getClipKey(clip, idx) {
  const name = clip?.name?.trim();
  if (name) return `name:${name}`;
  return `index:${idx}`;
}

function getClipLabel(clip, idx) {
  const name = clip?.name?.trim();
  if (name) return name;
  return `Clip ${idx + 1}`;
}

function updateClipLookup(gltf) {
  clips = gltf.animations || [];
  clipLookup = new Map();
  clips.forEach((clip, idx) => {
    const key = getClipKey(clip, idx);
    clipLookup.set(key, {
      clip,
      label: getClipLabel(clip, idx),
    });
  });
}

function updateModelHint() {
  if (!modelHint) return;
  if (settings.model.type === "custom" && settings.model.path) {
    modelHint.textContent = `Imported from: ${formatPath(settings.model.path)}`;
  } else {
    const builtin = getBuiltinModel(settings.model.id) || getDefaultModel();
    modelHint.textContent = builtin ? `Built-in model: ${builtin.label}` : "";
  }
}

function populateModelOptions() {
  if (!modelSelect) return;
  modelSelect.innerHTML = "";

  if (MODEL_MANIFEST.length) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = "Built-in";
    MODEL_MANIFEST.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.label;
      optgroup.appendChild(option);
    });
    modelSelect.appendChild(optgroup);
  }

  if (settings.model.type === "custom" && settings.model.path) {
    const option = document.createElement("option");
    option.value = "__custom__";
    option.textContent = `Imported • ${deriveFileName(settings.model.path)}`;
    modelSelect.appendChild(option);
  }

  if (settings.model.type === "custom" && settings.model.path) {
    modelSelect.value = "__custom__";
  } else {
    const id =
      settings.model.id || getDefaultModel()?.id || MODEL_MANIFEST[0]?.id || "";
    modelSelect.value = id;
  }
  updateModelHint();
}

function populateAnimationSelects() {
  STATE_KEYS.forEach((state) => {
    const select = animationSelects[state];
    if (!select) return;
    select.innerHTML = "";
    select.disabled = false;

    const noneOption = document.createElement("option");
    noneOption.value = "__none__";
    noneOption.textContent = "— None —";
    select.appendChild(noneOption);

    if (!clipLookup.size) {
      const empty = document.createElement("option");
      empty.value = "__empty__";
      empty.textContent = "No animations found";
      empty.disabled = true;
      select.appendChild(empty);
      select.value = "__none__";
      select.disabled = true;
      return;
    }

    clipLookup.forEach(({ label }, key) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = label;
      select.appendChild(option);
    });
  });
}

function updateSelectsWithError(message) {
  STATE_KEYS.forEach((state) => {
    const select = animationSelects[state];
    if (!select) return;
    select.innerHTML = "";
    const option = document.createElement("option");
    option.value = "__error__";
    option.textContent = message || "Load error";
    option.disabled = true;
    select.appendChild(option);
    select.disabled = true;
  });
}

function applyAnimationSelectionsFromSettings() {
  STATE_KEYS.forEach((state) => {
    const select = animationSelects[state];
    if (!select) return;
    const saved = settings.animations[state];
    if (saved && clipLookup.has(saved)) {
      select.value = saved;
    } else {
      select.value = "__none__";
    }
  });
}

function playClipForState(stateKey, { loop = false } = {}) {
  if (!mixer || !clipLookup.size) return;
  const select = animationSelects[stateKey];
  if (!select) return;
  const clipId = select.value;
  const descriptor = clipLookup.get(clipId);
  if (!descriptor) return;

  mixer.stopAllAction();

  const action = mixer.clipAction(descriptor.clip);
  action.reset();
  action.clampWhenFinished = true;
  action.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce;
  action.repetitions = loop ? Infinity : 1;
  action.play();
}

function playSequenceOnce(sequence) {
  if (!mixer || !sequence.length) return;
  isPlayingSequence = true;
  currentSequence = sequence.slice();
  sequenceIndex = 0;

  mixer.stopAllAction();

  const handleFinished = () => {
    sequenceIndex += 1;
    if (sequenceIndex >= currentSequence.length) {
      mixer.removeEventListener("finished", handleFinished);
      isPlayingSequence = false;
      return;
    }
    const nextState = currentSequence[sequenceIndex];
    playClipForState(nextState);
  };

  mixer.addEventListener("finished", handleFinished);
  playClipForState(currentSequence[sequenceIndex]);
}

function resetCamera() {
  if (!camera || !controls) return;
  camera.position.set(2.8, 1.8, 2.8);
  controls.target.set(0, 1, 0);
  controls.update();
}

function updatePlayButtonsState() {
  previewButtons.forEach((button) => {
    const state = button.dataset.preview;
    const select = animationSelects[state];
    if (!select) return;
    const value = select.value;
    const disabled =
      !clipLookup.size ||
      !value ||
      value === "__none__" ||
      !clipLookup.has(value);
    button.disabled = disabled;
    button.style.opacity = disabled ? "0.5" : "1";
    button.style.cursor = disabled ? "not-allowed" : "pointer";
  });

  const hasAnySelection = STATE_KEYS.some((key) => {
    const value = animationSelects[key]?.value;
    return value && clipLookup.has(value);
  });
  if (playCycleButton) {
    playCycleButton.disabled = !hasAnySelection;
    playCycleButton.style.opacity = hasAnySelection ? "1" : "0.5";
    playCycleButton.style.cursor = hasAnySelection ? "pointer" : "not-allowed";
  }
}

function persistLocally() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  } catch (err) {
    console.warn("Failed to persist settings locally:", err);
  }
}

async function persistModelSelection() {
  persistLocally();
  if (!hasElectronBridge || typeof electronAPI.saveModelSource !== "function") {
    return;
  }
  try {
    const next = await electronAPI.saveModelSource(settings.model);
    if (next) {
      settings = normalizeConfig(next);
      persistLocally();
    }
  } catch (err) {
    console.warn("Failed to persist model selection to main process:", err);
  }
}

async function persistAnimations() {
  persistLocally();
  if (
    !hasElectronBridge ||
    typeof electronAPI.saveAnimationRoles !== "function"
  ) {
    return;
  }
  try {
    const next = await electronAPI.saveAnimationRoles(settings.animations);
    if (next) {
      settings = normalizeConfig(next);
      persistLocally();
    }
  } catch (err) {
    console.warn("Failed to persist animation settings:", err);
  }
}

async function loadPersistedSettings() {
  if (hasElectronBridge && typeof electronAPI.getSettings === "function") {
    try {
      const stored = await electronAPI.getSettings();
      settings = normalizeConfig(stored);
      persistLocally();
      return;
    } catch (err) {
      console.warn("Failed to load settings from main process:", err);
    }
  }

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        settings = normalizeConfig(JSON.parse(raw));
      }
    }
  } catch (err) {
    console.warn("Failed to restore settings from local storage:", err);
  }
}

function resolveModelUrl(modelDescriptor) {
  if (!modelDescriptor) return null;
  if (modelDescriptor.type === "custom" && modelDescriptor.path) {
    if (hasElectronBridge && typeof electronAPI.pathToFileURL === "function") {
      return electronAPI.pathToFileURL(modelDescriptor.path);
    }
    return modelDescriptor.path;
  }
  const builtin =
    getBuiltinModel(modelDescriptor.id) ||
    getDefaultModel() ||
    MODEL_MANIFEST[0];
  return builtin?.assetUrl || null;
}

// --- Ghost Size Slider Logic ---
const slider = document.getElementById("ghost-size-slider");
const valueLabel = document.getElementById("ghost-size-value");
let modelOriginalMaxAxis = 1; // to store original size for rescaling

slider.addEventListener("input", () => {
  const percent = slider.value;
  valueLabel.textContent = percent;
  const ev = new CustomEvent("ghost-size-slider", {
    detail: { percentage: Number(percent) },
  });
  window.dispatchEvent(ev);

  // If an active model is present, rescale it
  if (activeModel && modelOriginalMaxAxis > 0) {
    activeModel.scale.setScalar(slider.value / modelOriginalMaxAxis);
  }
  settings.model.size = Number(slider.value);
});

// Set initial label value (since "input" doesn't fire on page load)
valueLabel.textContent = slider.value;
// Also, emit the initial event in case the renderer wants to read it up front

async function loadModelFromUrl(url) {
  if (!url) {
    updateSelectsWithError("No model source selected");
    return;
  }

  disposeActiveModel();

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        try {
          // Only render one model at a time: disposeActiveModel ensures this

          activeModel = gltf.scene;
          activeModel.position.set(0, 0, 0);
          scene.add(activeModel);

          // Compute center and rescale using slider
          const box = new THREE.Box3().setFromObject(activeModel);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getCenter(center);
          box.getSize(size);

          activeModel.position.sub(center);

          // track the original maxAxis for slider-based scaling
          modelOriginalMaxAxis = Math.max(size.x, size.y, size.z, 0.0001);

          // scale based on slider
          const desiredScale = slider.value; // use slider.value as size
          const scale = desiredScale / modelOriginalMaxAxis;
          activeModel.scale.setScalar(scale);

          mixer = new THREE.AnimationMixer(activeModel);
          updateClipLookup(gltf);
          populateAnimationSelects();
          applyAnimationSelectionsFromSettings();
          updatePlayButtonsState();
          resolve();
        } catch (err) {
          console.error("Failed to prepare model:", err);
          updateSelectsWithError("Model preparation failed");
          reject(err);
        }
      },
      undefined,
      (error) => {
        console.error("Failed to load model for preview:", error);
        updateSelectsWithError("Failed to load model");
        reject(error);
      }
    );
  });
}

async function refreshModel() {
  const url = resolveModelUrl(settings.model);
  console.log("url", url);
  try {
    await loadModelFromUrl(url);
  } catch (_) {
    // Already logged inside loadModelFromUrl
  }
}

function handleAnimationSelectChange(state) {
  const select = animationSelects[state];
  if (!select) return;
  const value = select.value;
  if (!value || value === "__none__" || value === "__empty__") {
    settings.animations[state] = null;
  } else if (clipLookup.has(value)) {
    settings.animations[state] = value;
  } else {
    settings.animations[state] = null;
  }
  persistAnimations();
  updatePlayButtonsState();
}

function deriveFileName(filePath) {
  if (!filePath) return "Custom Model";
  const segments = filePath.split(/[/\\]+/);
  return segments[segments.length - 1] || filePath;
}

function formatPath(filePath) {
  if (!filePath) return "";
  if (filePath.length <= 80) return filePath;
  return `${filePath.slice(0, 38)}…${filePath.slice(-38)}`;
}

async function handleModelSelectionChange() {
  const selectedValue = modelSelect.value;
  if (selectedValue === "__custom__") {
    if (settings.model.type !== "custom" || !settings.model.path) {
      modelSelect.value =
        settings.model.id ||
        getDefaultModel()?.id ||
        MODEL_MANIFEST[0]?.id ||
        "";
    }
    updateModelHint();
    await refreshModel();
    return;
  }

  settings.model = {
    type: "builtin",
    id: selectedValue,
    path: "",
  };
  updateModelHint();
  await persistModelSelection();
  await refreshModel();
}

async function handleImportModelClick() {
  if (!hasElectronBridge || typeof electronAPI.selectModelFile !== "function") {
    window.alert(
      "Importing models is only available in the desktop application."
    );
    return;
  }
  try {
    const result = await electronAPI.selectModelFile();
    if (result) {
      settings = normalizeConfig(result);
      populateModelOptions();
      await refreshModel();
    }
  } catch (err) {
    console.warn("Model import cancelled or failed:", err);
  }
}

function initEventListeners() {
  modelSelect?.addEventListener("change", async () => {
    await handleModelSelectionChange();
  });

  importModelButton?.addEventListener("click", async () => {
    await handleImportModelClick();
  });

  STATE_KEYS.forEach((state) => {
    const select = animationSelects[state];
    if (!select) return;
    select.addEventListener("change", () => {
      if (isPlayingSequence) {
        mixer?.stopAllAction();
        isPlayingSequence = false;
      }
      handleAnimationSelectChange(state);
    });
  });

  previewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const state = button.dataset.preview;
      if (!state) return;
      if (isPlayingSequence) {
        mixer?.stopAllAction();
        isPlayingSequence = false;
      }
      playClipForState(state);
    });
  });

  playCycleButton?.addEventListener("click", () => {
    const sequence = STATE_KEYS.filter((state) => {
      const value = animationSelects[state]?.value;
      return value && clipLookup.has(value);
    });
    if (!sequence.length) return;
    playSequenceOnce(sequence);
  });

  resetCameraButton?.addEventListener("click", () => {
    resetCamera();
  });
}

async function bootstrap() {
  if (!canvas || !modelSelect) return;
  initRenderer();
  await loadPersistedSettings();
  populateModelOptions();
  initEventListeners();
  updatePlayButtonsState();
  await refreshModel();
}

bootstrap().catch((err) => {
  console.error("Failed to bootstrap settings view:", err);
});
