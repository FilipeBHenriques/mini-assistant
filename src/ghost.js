import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  GHOST_SCALE,
  GHOST_MIN_FLING_SPEED,
  GHOST_SIZE,
  GhostStates,
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
  if (
    resolvedSettings?.model?.type === "custom" &&
    resolvedSettings.model.path
  ) {
    return resolvedSettings.model.path;
  }
  const builtin = getBuiltinModel(resolvedSettings?.model?.id || "");
  if (builtin && builtin.assetUrl) {
    return builtin.assetUrl;
  }
  const def = getDefaultModel();
  if (def && def.assetUrl) return def.assetUrl;
  if (MODEL_MANIFEST.length && MODEL_MANIFEST[0].assetUrl)
    return MODEL_MANIFEST[0].assetUrl;
  return null;
}

// This is the main routine for loading and applying the ghost model
async function loadAndApplyGhost() {
  removeGhost();
  const settings = await getSettings();
  const assetUrl = await getCurrentModelAssetUrl(settings);
  if (!assetUrl) {
    console.error("❌ Failed to resolve ghost model asset URL.");
    return;
  }

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

      let scale = GHOST_SCALE;
      if (
        settings &&
        settings.model &&
        typeof settings.model.size === "number" &&
        settings.model.size > 0
      ) {
        const normalized = settings.model.size / 50;
        scale = GHOST_SCALE * normalized;
      }
      ghost.scale.set(scale, scale, scale);

      // IMPORTANT: recalc bounding box *after* scaling!
      const newBox = new THREE.Box3().setFromObject(ghost);
      const newSize = new THREE.Vector3();
      newBox.getSize(newSize);
      ghostHalfWidth = newSize.x / 2;
      ghostHalfHeight = newSize.y / 2;

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
      labelObj.position.set(0, -ghostHalfHeight - 0.25, 0);
      ghost.add(labelObj);

      // --- Message Bubble at top right ---
      ghostMessage = document.createElement("div");
      ghostMessage.textContent = "message";
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
      ghostMessage.style.position = "relative";
      ghostMessage.style.marginTop = "-70px";
      ghostMessage.style.marginRight = "0px";
      ghostMessage.innerHTML =
        '<span style="position:relative;" id="ghost-msg-txt"></span>';

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
      messageObj.position.set(ghostHalfWidth + 0.2, ghostHalfHeight + 0.35, 0);
      ghost.add(messageObj);

      window.setGhostMessage = (msg) => {
        const span = ghostMessage.querySelector("#ghost-msg-txt");
        if (span) span.textContent = msg;
        ghostMessage.style.display = msg ? "" : "none";
      };
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

      updateDragAreaPosition();
      window.electronAPI?.setClickThrough(true);
    },
    undefined,
    (err) => console.error("❌ Error loading ghost:", err)
  );
}

loadAndApplyGhost();

window.electronAPI.onSettingsSaved(async () => {
  await loadAndApplyGhost();
});

window.electronAPI.onGhostMove(({ x, y, speed = 20 }) => {
  // Convert screen pixels to world space inside renderer
  const worldBounds = getWorldBounds();
  const ndcX = (x / window.innerWidth) * 2 - 1;
  const ndcY = -(y / window.innerHeight) * 2 + 1;
  const worldX = (ndcX * (worldBounds.xMax - worldBounds.xMin)) / 2;
  const worldY = (ndcY * (worldBounds.yMax - worldBounds.yMin)) / 2;
  moveGhostTo(worldX, worldY, speed);
});

function setGhostState(state) {
  if (GhostStates[state]) {
    ghostState = GhostStates[state];
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

    if (parsed.state === "procrastinating") {
      setGhostState("Angry");
    } else if (parsed.state === "working") {
      setGhostState("Chill");
    } else if (parsed.state === "vibing") {
      setGhostState("Sleeping");
    } else if (parsed.state) {
      setGhostState("Chill");
    }
    if (
      parsed.tool &&
      tools[parsed.tool] &&
      typeof tools[parsed.tool].run === "function"
    ) {
      try {
        tools[parsed.tool].run(parsed.args || {}, {
          mainWindow: window.electronAPI,
          minimizeActiveWindow: async (id) => {
            const windows = await window.electronAPI.getWindows();
            const target = windows.find((w) => w.id === id);
            moveToWindowCorner(target, "topRight", () => {
              // This callback runs when the ghost reaches the corner
              window.electronAPI.minimizeExternal(id);
            });
            currentAction = playClipForState(
              mixer,
              rehydratedAnimations,
              ghost.animations,
              "dragged",
              currentAction
            );
          },
          maximizeRandomWindow: (id) => window.electronAPI.maximizeExternal(id),
          smoothMoveActiveWindowToRandomPosition: (id, x, y) =>
            window.electronAPI.moveExternal(id, x, y),
          getActiveWindow: () => window.electronAPI.getActiveWindow(),
          getWindows: () => window.electronAPI.getWindows(),
          setGhostMessage: window.setGhostMessage,
          grabMouse: () => window.electronAPI.grabMouse(),
        });
      } catch (err) {
        console.warn("Failed to run ghost tool:", parsed.tool, err);
      }
    } else {
      console.log("Ghost tool not found or not runnable:", parsed.tool);
    }
  });
}

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
const velocity = new THREE.Vector3(0, 0, 0);

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

  // --- PLAY DRAGGED ANIMATION on mousedown ---
  currentAction = playClipForState(
    mixer,
    rehydratedAnimations,
    ghost?.animations,
    "dragging",
    currentAction
  );

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

  // --- PLAY DRAGGED ANIMATION during dragging ---
  currentAction = playClipForState(
    mixer,
    rehydratedAnimations,
    ghost?.animations,
    "dragging",
    currentAction
  );
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
  if (velocity.length() < minSpeed) {
    velocity.set(0, 0, 0);
    isFlinging = false;
  } else {
    isFlinging = true;
  }

  // --- PLAY DRAGGED ANIMATION during dragging ---
  currentAction = playClipForState(
    mixer,
    rehydratedAnimations,
    ghost?.animations,
    "dragged",
    currentAction
  );
});

// --- Fling update per frame ---
function updateFling(delta) {
  if (!isFlinging || !ghost) return;

  ghost.position.x += velocity.x * delta;
  ghost.position.y += velocity.y * delta;

  const bounds = getWorldBounds();

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

  const decel = Math.pow(GHOST_FLING_DECELERATION, delta);
  velocity.multiplyScalar(decel);

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
let moveSpeed = 2;
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
      isMoving = true;
    }
  }

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

  // Play walking animation if ghost is moving, otherwise idle
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

let genericTarget = null;
let genericMoveSpeed = 2;
let genericMoveCallback = null;

export function moveGhostTo(x, y, speed = genericMoveSpeed, callback) {
  genericTarget = new THREE.Vector3(x, y, 0);
  genericMoveSpeed = speed;
  genericMoveCallback = callback;
}

function updateGenericMovement(delta) {
  if (!ghost || !genericTarget) return;

  const dx = genericTarget.x - ghost.position.x;
  const dy = genericTarget.y - ghost.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const step = genericMoveSpeed * delta;

  // ✅ If we can reach or overshoot the target this frame
  if (dist <= step) {
    ghost.position.x = genericTarget.x;
    ghost.position.y = genericTarget.y;

    // Call callback **once**
    if (genericMoveCallback) {
      const cb = genericMoveCallback;
      genericMoveCallback = null;
      cb(); // ← will run minimizeExternal() now
    }

    genericTarget = null;
  } else {
    ghost.position.x += (dx / dist) * step;
    ghost.position.y += (dy / dist) * step;
  }

  // Clamp to world bounds
  const bounds = getWorldBounds();
  const clampedX = Math.max(
    bounds.xMin + ghostHalfWidth,
    Math.min(bounds.xMax - ghostHalfWidth, ghost.position.x)
  );
  const clampedY = Math.max(
    bounds.yMin + ghostHalfHeight,
    Math.min(bounds.yMax - ghostHalfHeight, ghost.position.y)
  );

  ghost.position.x = clampedX;
  ghost.position.y = clampedY;

  // ✅ If we reach the target OR hit the bounds, consider it arrived
  if (
    (Math.abs(clampedX - genericTarget.x) < 0.01 &&
      Math.abs(clampedY - genericTarget.y) < 0.01) || // reached target
    clampedX === bounds.xMin + ghostHalfWidth ||
    clampedX === bounds.xMax - ghostHalfWidth ||
    clampedY === bounds.yMin + ghostHalfHeight ||
    clampedY === bounds.yMax - ghostHalfHeight // hit bounds
  ) {
    genericTarget = null;
    if (genericMoveCallback) {
      const cb = genericMoveCallback;
      cb();
      genericMoveCallback = null;
    }
  }

  updateDragAreaPosition();
}

function moveToWindowCorner(window, corner, callback) {
  if (!window || !ghost) return;

  const bounds = window.bounds; // { x, y, width, height }

  // Default: center of ghost aligns with screen corner
  let screenX = bounds.x;
  let screenY = bounds.y;

  switch (corner) {
    case "topLeft":
      screenX += ghostHalfWidth * 2; // offset by ghost half-width
      screenY += ghostHalfHeight * 2;
      break;
    case "topRight":
      screenX = bounds.x + bounds.width - ghostHalfWidth * 2;
      screenY += ghostHalfHeight * 2;
      break;
    case "bottomLeft":
      screenX += ghostHalfWidth;
      screenY = bounds.y + bounds.height - ghostHalfHeight;
      break;
    case "bottomRight":
      screenX = bounds.x + bounds.width - ghostHalfWidth;
      screenY = bounds.y + bounds.height - ghostHalfHeight;
      break;
  }

  // Convert screen coordinates to normalized device coordinates (-1 to 1)
  const ndcX = (screenX / renderer.domElement.width) * 2 - 1;
  const ndcY = -(screenY / renderer.domElement.height) * 2 + 1;

  // Convert NDC to world space
  const worldBounds = getWorldBounds();
  const worldX = (ndcX * (worldBounds.xMax - worldBounds.xMin)) / 2;
  const worldY = (ndcY * (worldBounds.yMax - worldBounds.yMin)) / 2;

  moveGhostTo(worldX, worldY, 5, callback);

  // Trigger dragged animation if available
  currentAction = playClipForState(
    mixer,
    rehydratedAnimations,
    ghost.animations,
    "dragged",
    currentAction
  );
}

function ghostMouseGrab(
  durationMs = 3000,
  pullDistance = 30,
  targetX,
  targetY,
  corner = null,
  behavior = null
) {
  if (window.electronAPI) {
    window.electronAPI.grabMouse(
      durationMs,
      pullDistance,
      targetX,
      targetY,
      corner,
      behavior
    );
  }
}

// --- Animation loop ---
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (mixer) mixer.update(delta);

  updateFling(delta);
  movementLoop(delta);
  updateGenericMovement(delta);

  renderer.render(scene, camera);
  if (labelRenderer) labelRenderer.render(scene, camera);
}

animate();
