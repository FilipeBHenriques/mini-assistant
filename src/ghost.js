import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  GHOST_SCALE,
  GHOST_INITIAL_VELOCITY,
  GHOST_MIN_FLING_SPEED,
  GHOST_SIZE,
  GhostStates,
  GHOST_WALKING_SPEED,
  GHOST_FLING_DECELERATION,
} from "./utils/Consts";
import { tools } from "../src/aiTools.js";
import {
  MODEL_MANIFEST,
  getBuiltinModel,
  getDefaultModel,
} from "./utils/modelManifest.js";
import { STATE_KEYS } from "./utils/ghostConfig.js";
import { playClipForState } from "./utils/utils.js";

const canvas = document.getElementById("ghost-canvas");
const ghostDragArea = document.getElementById("ghost-drag-area");
const clock = new THREE.Clock();

if (!ghostDragArea) {
  console.error("❌ Ghost drag area element not found!");
} else {
  console.log("✅ Ghost drag area element found");
}

let ghostState = GhostStates.Chill; // default state

// ---- Debug Utility ----
function setDebugFunctionCall(name) {
  // Find a section with id="debug" in index.html and show what's being called
  const debugDiv = document.getElementById("debugFunction");
  if (debugDiv) {
    debugDiv.textContent = "Ghost Behavior: " + name;
  }
}

// Scene & camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 5;

// Renderer
const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = "absolute";
labelRenderer.domElement.style.top = "0";
labelRenderer.domElement.style.pointerEvents = "none"; // clicks pass through
document.body.appendChild(labelRenderer.domElement);

// Lights
const dir = new THREE.DirectionalLight(0xffffff, 1);
dir.position.set(5, 5, 5);
scene.add(dir);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

// Ghost model
let ghost = null;
let ghostHalfWidth = GHOST_SIZE.halfWidth;
let ghostHalfHeight = GHOST_SIZE.halfHeight;
let mixer = null;
let walkAction = null;
let rehydratedAnimations = {};

let ghostLabel;
let ghostMessage;
let labelObj;
let loader = new GLTFLoader();

// Helper to unload previous ghost from scene
function removeGhost() {
  if (ghost) {
    scene.remove(ghost);
    ghost = null;
    // Remove label object if it exists
    if (labelObj && labelObj.parent) {
      labelObj.parent.remove(labelObj);
      labelObj = null;
    }
    if (ghostLabel && ghostLabel.parentNode) {
      ghostLabel.parentNode.removeChild(ghostLabel);
      ghostLabel = null;
    }
    // Remove message if it exists
    if (ghostMessage && ghostMessage.parentNode) {
      ghostMessage.parentNode.removeChild(ghostMessage);
      ghostMessage = null;
    }
    mixer = null;
    walkAction = null;
    rehydratedAnimations = {};
  }
}

// Generic "getSettings" receiver: always returns a settings object (possibly null)
async function getSettings() {
  // Prefer window.electronAPI.getSettings if available, else null
  try {
    const s = await window.electronAPI.getSettings();
    return s || null;
  } catch (e) {
    console.warn("Failed to get settings from electron:", e);
    return null;
  }

  return null;
}

// Generic "getCurrentAssetUrl" receiver: returns the resolved asset url for model (given settings)
async function getCurrentModelAssetUrl(settings) {
  let resolvedSettings = settings;
  if (!resolvedSettings) {
    resolvedSettings = await getSettings();
  }
  // Prefer custom path if specified
  if (
    resolvedSettings?.model?.type === "custom" &&
    resolvedSettings.model.path
  ) {
    return resolvedSettings.model.path;
  }
  // Otherwise try builtin
  const builtin = getBuiltinModel(resolvedSettings?.model?.id || "");
  if (builtin && builtin.assetUrl) {
    return builtin.assetUrl;
  }
  // Fallback to default
  const def = getDefaultModel();
  if (def && def.assetUrl) return def.assetUrl;
  // Last resort
  if (MODEL_MANIFEST.length && MODEL_MANIFEST[0].assetUrl)
    return MODEL_MANIFEST[0].assetUrl;
  // Not found
  return null;
}

// This is the main routine for loading and applying the ghost model
async function loadAndApplyGhost() {
  // Unload previous ghost from scene
  removeGhost();
  const settings = await getSettings();
  const assetUrl = await getCurrentModelAssetUrl(settings);
  if (!assetUrl) {
    console.error("❌ Failed to resolve ghost model asset URL.");
    return;
  }
  console.log("settings", settings);

  loader.load(
    assetUrl,
    (gltf) => {
      ghost = gltf.scene;
      ghost.scale.set(GHOST_SCALE, GHOST_SCALE, GHOST_SCALE);
      ghost.position.set(0, 0, 0);
      scene.add(ghost);

      const box = new THREE.Box3().setFromObject(ghost);
      const size = new THREE.Vector3();
      box.getSize(size);
      // Scale the ghost based on settings.model.size if available, else use GHOST_SCALE
      let scale = GHOST_SCALE;
      if (
        settings &&
        settings.model &&
        typeof settings.model.size === "number" &&
        settings.model.size > 0
      ) {
        // settings.model.size is assumed as a number, e.g., from 0-100 for a slider
        // We'll treat size 50 (default slider) as "normal"/"GHOST_SCALE"
        const normalized = settings.model.size / 50;
        scale = GHOST_SCALE * normalized;
      }
      ghost.scale.set(scale, scale, scale);
      ghostHalfWidth = size.x / 2;
      ghostHalfHeight = size.y / 2;
      console.log("✅ Ghost loaded, bounding box:", size);

      // --- Bottom Label ---
      ghostLabel = document.createElement("div");
      ghostLabel.textContent = `State: ${ghostState}`;
      ghostLabel.style.color = "white";
      ghostLabel.style.fontFamily = "sans-serif";
      ghostLabel.style.fontSize = "16px";
      ghostLabel.style.textShadow = "0 0 5px black";
      ghostLabel.style.padding = "2px 10px";
      ghostLabel.style.background = "rgba(0,0,0,0.5)";
      ghostLabel.style.borderRadius = "12px";

      labelObj = new CSS2DObject(ghostLabel);
      // Place the label on the bottom center, under the ghost
      labelObj.position.set(0, -ghostHalfHeight - 0.25, 0);
      ghost.add(labelObj);

      // --- Message Bubble at top right ---
      ghostMessage = document.createElement("div");
      ghostMessage.textContent = "message"; // Start empty
      ghostMessage.style.maxWidth = "240px";
      ghostMessage.style.padding = "8px 16px";
      ghostMessage.style.background = "rgba(255,255,255,0.94)";
      ghostMessage.style.color = "#222";
      ghostMessage.style.fontFamily = "sans-serif";
      ghostMessage.style.fontSize = "15px";
      ghostMessage.style.borderRadius = "18px";
      ghostMessage.style.boxShadow = "0 4px 16px rgba(0,0,0,0.12)";
      ghostMessage.style.border = "2px solid #4442";
      ghostMessage.style.whiteSpace = "pre-line";
      ghostMessage.style.textAlign = "left";
      ghostMessage.style.pointerEvents = "none";

      // Cute speech bubble 'tail' using CSS ::after
      ghostMessage.style.position = "relative";
      ghostMessage.style.marginTop = "-70px";
      ghostMessage.style.marginRight = "0px";
      ghostMessage.innerHTML =
        '<span style="position:relative;" id="ghost-msg-txt"></span>';

      // We'll create the "tail" as a sub-element:
      const tail = document.createElement("div");
      tail.style.position = "absolute";
      tail.style.right = "14px";
      tail.style.top = "100%";
      tail.style.width = "0";
      tail.style.height = "0";
      tail.style.borderLeft = "8px solid transparent";
      tail.style.borderRight = "8px solid transparent";
      tail.style.borderTop = "12px solid rgba(255,255,255,0.94)";
      tail.style.filter = "drop-shadow(0 1px 2px #aaa7)";
      ghostMessage.appendChild(tail);

      const messageObj = new CSS2DObject(ghostMessage);
      // Top right corner (relative to ghost bounding box)
      // X is to the right, Y is above
      messageObj.position.set(
        ghostHalfWidth + 0.2, // a little to the right
        ghostHalfHeight + 0.35, // a little above
        0
      );
      ghost.add(messageObj);

      // Provide a helper function to set the message text
      window.setGhostMessage = (msg) => {
        const span = ghostMessage.querySelector("#ghost-msg-txt");
        if (span) span.textContent = msg;
        ghostMessage.style.display = msg ? "" : "none";
      };
      // Hide initially
      window.setGhostMessage("");

      if (gltf.animations && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(ghost);
        const savedAnimations = settings?.animations || {};
        rehydratedAnimations = {};

        for (const state of STATE_KEYS) {
          const savedKey = savedAnimations[state];
          if (!savedKey) {
            rehydratedAnimations[state] = null;
            continue;
          }

          const clip = gltf.animations.find((clip, idx) => {
            const key = clip.name?.trim()
              ? `name:${clip.name.trim()}`
              : `index:${idx}`;
            return key === savedKey;
          });

          rehydratedAnimations[state] = clip || null;
        }
      }

      // Initialize drag area position
      updateDragAreaPosition();

      // Start with click-through enabled (most of window is transparent)
      window.electronAPI?.setClickThrough(true);

      // startGhostBehaviorLoop();
    },
    undefined,
    (err) => console.error("❌ Error loading ghost:", err)
  );
}

// Initial load
loadAndApplyGhost();

// Listen for settings saved: change the ghost model live
window.electronAPI.onSettingsSaved(async () => {
  await loadAndApplyGhost();
});

// --- Monitor & external window control ---
function switchMonitor() {
  if (window.electronAPI?.switchMonitor) window.electronAPI.switchMonitor();
}

// --- Util: Get a random open/active window ID from Electron
async function getRandomActiveWindowId() {
  // Assumes electronAPI.getOpenWindows returns list like [{ id, processName, title, ... }, ...]
  if (window.electronAPI?.getOpenWindows) {
    try {
      const windows = await window.electronAPI.getOpenWindows();
      if (Array.isArray(windows) && windows.length > 0) {
        // pick a random window (not ourselves if possible)
        // Exclude our own process/window (if we can detect)
        const filtered = windows.filter(
          (w) =>
            !w.isGhostWindow && // (Optional: If electron marks its own ghost window)
            !/ghost/i.test(w.title || "") // by window title fallback
        );
        const candidateList = filtered.length > 0 ? filtered : windows;
        return candidateList[Math.floor(Math.random() * candidateList.length)]
          .id;
      }
      return null;
    } catch (e) {
      console.warn("Could not get open windows for random move:", e);
      return null;
    }
  }
  return null;
}

function setGhostState(state) {
  // Change the in-memory ghost state and optionally trigger animation/sprite swap
  if (GhostStates[state]) {
    ghostState = GhostStates[state];
    // Optionally update label/UI
    if (ghostLabel) ghostLabel.textContent = `AI: ${state}`;
  } else {
    console.warn(`Unknown ghost state: ${state}`);
  }
}

// --- Auto ghost response handler ---
if (window.electronAPI?.onAutoGhostResponse) {
  window.electronAPI.onAutoGhostResponse((ghostResponse) => {
    console.log("👻 Received auto ghost response:", ghostResponse);

    let parsed;
    try {
      parsed = JSON.parse(ghostResponse);
    } catch {
      parsed = { state: "unknown", reasoning: ghostResponse };
    }

    // Update ghost state based on the response
    if (parsed.state === "procrastinating") {
      setGhostState("Angry");
    } else if (parsed.state === "working") {
      setGhostState("Chill");
    } else if (parsed.state === "vibing") {
      setGhostState("Sleeping");
    } else if (parsed.state) {
      setGhostState("Chill");
    }
    // Call the AI tool chosen by the ghost, if it exists and has a run method
    if (
      parsed.tool &&
      tools[parsed.tool] &&
      typeof tools[parsed.tool].run === "function"
    ) {
      try {
        tools[parsed.tool].run(parsed.args || {}, {
          mainWindow: window.electronAPI,
          minimizeActiveWindow: (id) => window.electronAPI.minimizeExternal(id),
          maximizeRandomWindow: (id) => window.electronAPI.maximizeExternal(id),
          smoothMoveActiveWindowToRandomPosition: (id, x, y) =>
            window.electronAPI.moveExternal(id, x, y),
          getActiveWindow: () => window.electronAPI.getActiveWindow(),
          getWindows: () => window.electronAPI.getWindows(),
          setGhostMessage: window.setGhostMessage,
        });
      } catch (err) {
        console.warn("Failed to run ghost tool:", parsed.tool, err);
      }
    } else {
      console.log("Ghost tool not found or not runnable:", parsed.tool);
    }
  });
}

// --- Window resize handler ---
if (window.electronAPI?.onResizeWindow) {
  window.electronAPI.onResizeWindow(({ width, height }) => {
    renderer.setSize(width, height);
    labelRenderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    updateDragAreaPosition();
  });
}

// --- Ghost drag area management ---
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let lastMouse = { x: 0, y: 0 };
let mouseVel = { x: 0, y: 0 };
let isFlinging = false;
const velocity = new THREE.Vector3(0, 0, 0); // Start at zero

// Function to update drag area position based on ghost position
function updateDragAreaPosition() {
  if (!ghost || !ghostDragArea) return;

  // Convert 3D ghost position to screen coordinates
  const vector = new THREE.Vector3();
  ghost.getWorldPosition(vector);
  vector.project(camera);

  const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
  const y = (vector.y * -0.5 + 0.5) * window.innerHeight;

  // Center the 100px drag area on the ghost
  const centerX = x - 50;
  const centerY = y - 50;

  // Ensure the drag area stays within screen bounds
  const clampedX = Math.max(0, Math.min(centerX, window.innerWidth - 100));
  const clampedY = Math.max(0, Math.min(centerY, window.innerHeight - 100));

  ghostDragArea.style.left = `${clampedX}px`;
  ghostDragArea.style.top = `${clampedY}px`;
}

ghostDragArea.addEventListener("mouseenter", () => {
  window.electronAPI?.setClickThrough(false);
});

ghostDragArea.addEventListener("mouseleave", () => {
  if (!isDragging) {
    window.electronAPI?.setClickThrough(true);
  }
});

// --- Mouse Events ---
ghostDragArea.addEventListener("mousedown", (e) => {
  if (!ghost) return;

  isDragging = true;
  ghostDragArea.classList.add("dragging");

  const rect = ghostDragArea.getBoundingClientRect();
  dragOffset.x = e.clientX - rect.left - 50;
  dragOffset.y = e.clientY - rect.top - 50;

  lastMouse.x = e.clientX;
  lastMouse.y = e.clientY;
  mouseVel.x = 0;
  mouseVel.y = 0;
  velocity.set(0, 0, 0);

  e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
  if (!isDragging || !ghost) return;

  const deltaX = e.clientX - lastMouse.x;
  const deltaY = e.clientY - lastMouse.y;

  const scaleX =
    (getWorldBounds().xMax - getWorldBounds().xMin) / window.innerWidth;
  const scaleY =
    (getWorldBounds().yMax - getWorldBounds().yMin) / window.innerHeight;

  // Move ghost in world space
  ghost.position.x += deltaX * scaleX;
  ghost.position.y -= deltaY * scaleY;

  // Update mouse velocity in pixels/sec
  const dt = clock.getDelta() || 0.016;
  mouseVel.x = deltaX / dt;
  mouseVel.y = deltaY / dt;

  lastMouse.x = e.clientX;
  lastMouse.y = e.clientY;

  updateDragAreaPosition();
});

document.addEventListener("mouseup", () => {
  if (!isDragging || !ghost) return;

  isDragging = false;
  ghostDragArea.classList.remove("dragging");
  window.electronAPI?.setClickThrough(true);

  const scaleX =
    (getWorldBounds().xMax - getWorldBounds().xMin) / window.innerWidth;
  const scaleY =
    (getWorldBounds().yMax - getWorldBounds().yMin) / window.innerHeight;

  // Convert mouse velocity to world units per second
  velocity.x = mouseVel.x * scaleX;
  velocity.y = -mouseVel.y * scaleY;

  // Minimum velocity threshold to avoid tiny flings
  const minSpeed = GHOST_MIN_FLING_SPEED || 0.02;
  console.log("velocity is ", velocity);
  if (velocity.length() < minSpeed) {
    velocity.set(0, 0, 0);
    isFlinging = false;
  } else {
    isFlinging = true;
  }
});

// --- Fling update per frame ---
function updateFling(delta) {
  if (!isFlinging || !ghost) return;

  ghost.position.x += velocity.x * delta;
  ghost.position.y += velocity.y * delta;

  const bounds = getWorldBounds();

  // Bounce off edges
  if (ghost.position.x > bounds.xMax - ghostHalfWidth) {
    velocity.x *= -1;
    ghost.position.x = bounds.xMax - ghostHalfWidth;
  } else if (ghost.position.x < bounds.xMin + ghostHalfWidth) {
    velocity.x *= -1;
    ghost.position.x = bounds.xMin + ghostHalfWidth;
  }

  if (ghost.position.y > bounds.yMax - ghostHalfHeight) {
    velocity.y *= -1;
    ghost.position.y = bounds.yMax - ghostHalfHeight;
  } else if (ghost.position.y < bounds.yMin + ghostHalfHeight) {
    velocity.y *= -1;
    ghost.position.y = bounds.yMin + ghostHalfHeight;
  }

  // Deceleration
  const decel = Math.pow(GHOST_FLING_DECELERATION, delta);
  velocity.multiplyScalar(decel);

  // Stop when velocity is very low
  if (velocity.length() < 0.01 || isNaN(velocity.length())) {
    velocity.set(0, 0, 0);
    isFlinging = false;
  }

  updateDragAreaPosition();
}

// --- World bounds calculation ---
function getWorldBounds() {
  const aspect = window.innerWidth / window.innerHeight;
  const vFOV = (camera.fov * Math.PI) / 180;
  const height = 2 * Math.tan(vFOV / 2) * Math.abs(camera.position.z);
  const width = height * aspect;
  return {
    xMin: -width / 2,
    xMax: width / 2,
    yMin: -height / 2,
    yMax: height / 2,
  };
}

// The ghost randomly moves to a new random position from time to time,
// but ONLY if it is not being dragged or flung.
let currentAction = null;

let nextRandomMoveTime = performance.now() + 2000 + Math.random() * 2000; // ms

let moveTarget = null;
let moveSpeed = 2; // units per second, tweak as needed
function movementLoop(delta) {
  if (!ghost || isDragging || isFlinging) {
    moveTarget = null;
    nextRandomMoveTime = performance.now() + 2000 + Math.random() * 2000;
    return;
  }

  const now = performance.now();

  let isMoving = false;

  if (moveTarget) {
    const dx = moveTarget.x - ghost.position.x;
    const dy = moveTarget.y - ghost.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const step = moveSpeed * delta;

    if (dist <= step) {
      ghost.position.x = moveTarget.x;
      ghost.position.y = moveTarget.y;
      moveTarget = null;
      nextRandomMoveTime = now + 2000 + Math.random() * 2000;
    } else {
      ghost.position.x += (dx / dist) * step;
      ghost.position.y += (dy / dist) * step;
      isMoving = true; // mark that ghost is moving
    }
  }

  // Pick new random target if time
  if (!moveTarget && now >= nextRandomMoveTime) {
    const bounds = getWorldBounds();
    const x =
      Math.random() * (bounds.xMax - bounds.xMin - 2 * ghostHalfWidth) +
      bounds.xMin +
      ghostHalfWidth;
    const y =
      Math.random() * (bounds.yMax - bounds.yMin - 2 * ghostHalfHeight) +
      bounds.yMin +
      ghostHalfHeight;
    moveTarget = { x, y };
  }

  // Play walking animation if ghost is moving
  if (isMoving) {
    currentAction = playClipForState(
      mixer,
      rehydratedAnimations,
      ghost.animations,
      "walking",
      currentAction
    );
  } else {
    currentAction = playClipForState(
      mixer,
      rehydratedAnimations,
      ghost.animations,
      "idle",
      currentAction
    );
  }

  updateDragAreaPosition();
}

/**
 * --- Animation loop ---
 * This loop is now focused on rendering & misc updates,
 * and hands off the "ghost intent" behaviors to the above logic.
 */
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (mixer) mixer.update(delta);

  updateFling(delta);

  movementLoop(delta);

  renderer.render(scene, camera);
  if (labelRenderer) labelRenderer.render(scene, camera);
}

animate();
