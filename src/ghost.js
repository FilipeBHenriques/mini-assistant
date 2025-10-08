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

const canvas = document.getElementById("ghost-canvas");
const ghostDragArea = document.getElementById("ghost-drag-area");
const clock = new THREE.Clock();

// Check if drag area element exists
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
let lastDirection = "right";
let lastNonZeroMove = new THREE.Vector2(1, 0);
let targetRotationY = Math.PI / 2;
let smoothTurnSpeed = 6.0;

let ghostLabel;
let labelObj;

const loader = new GLTFLoader();
loader.load(
  new URL("./assets/ghost2.glb", import.meta.url).href,
  (gltf) => {
    ghost = gltf.scene;
    ghost.scale.set(GHOST_SCALE, GHOST_SCALE, GHOST_SCALE);
    ghost.position.set(0, 0, 0);
    scene.add(ghost);

    const box = new THREE.Box3().setFromObject(ghost);
    const size = new THREE.Vector3();
    box.getSize(size);
    ghostHalfWidth = size.x / 2;
    ghostHalfHeight = size.y / 2;
    console.log("✅ Ghost loaded, bounding box:", size);

    // --- Label ---
    ghostLabel = document.createElement("div");
    ghostLabel.textContent = `State: ${ghostState}`;
    ghostLabel.style.color = "white";
    ghostLabel.style.fontFamily = "sans-serif";
    ghostLabel.style.fontSize = "16px";
    ghostLabel.style.textShadow = "0 0 5px black";

    labelObj = new CSS2DObject(ghostLabel);
    labelObj.position.set(0, -ghostHalfHeight - 0.2, 0); // below ghost
    ghost.add(labelObj);

    if (gltf.animations && gltf.animations.length) {
      mixer = new THREE.AnimationMixer(ghost);
      walkAction = mixer.clipAction(gltf.animations[0]);
      walkAction.play();
    }

    // Initialize drag area position
    updateDragAreaPosition();

    // Start with click-through enabled (most of window is transparent)
    window.electronAPI?.setClickThrough(true);
  },
  undefined,
  (err) => console.error("❌ Error loading ghost:", err)
);

// --- Monitor & external window control ---
function switchMonitor() {
  if (window.electronAPI?.switchMonitor) window.electronAPI.switchMonitor();
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
      ghostState = GhostStates.Angry;
    } else if (parsed.state === "working") {
      ghostState = GhostStates.Chill;
    } else if (parsed.state === "vibing") {
      ghostState = GhostStates.Sleeping;
    }

    // Update UI
    if (ghostLabel) ghostLabel.textContent = `${parsed.state} (auto)`;
  });
}

// --- Window resize handler ---
if (window.electronAPI?.onResizeWindow) {
  window.electronAPI.onResizeWindow(({ width, height }) => {
    console.log(`🖼️ Resizing window to ${width}x${height}`);

    // Update Three.js renderer size
    renderer.setSize(width, height);
    labelRenderer.setSize(width, height);

    // Update camera aspect ratio
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // Update drag area positioning
    updateDragAreaPosition();
  });
}

// --- Key handling ---
const keys = {};
const targetWindowId = "msedge.exe";
const moveAmount = 5;

document.addEventListener("keydown", async (e) => {
  keys[e.key.toLowerCase()] = true;

  if (e.key === "i") {
    if (window.electronAPI?.askGhost) {
      const ghostResponse = await window.electronAPI.askGhost();
      console.log("👻 Ghost says:", ghostResponse);

      let parsed;
      try {
        parsed = JSON.parse(ghostResponse);
      } catch {
        parsed = { state: "unknown", reasoning: ghostResponse };
      }

      // Update UI
      if (ghostLabel) ghostLabel.textContent = parsed.state;
    }
  }

  if (e.key === " ") {
    e.preventDefault();
    switchMonitor();
  }

  if (e.key.toLowerCase() === "m" && window.electronAPI?.minimizeExternal) {
    window.electronAPI.minimizeExternal(targetWindowId);
  }

  if (e.key.toLowerCase() === "n" && window.electronAPI?.maximizeExternal) {
    window.electronAPI.maximizeExternal(targetWindowId);
  }

  if (e.key.toLowerCase() === "p") {
    if (ghostState === GhostStates.Chill) ghostState = GhostStates.Angry;
    else if (ghostState === GhostStates.Angry)
      ghostState = GhostStates.Sleeping;
    else ghostState = GhostStates.Chill;

    if (ghostLabel) ghostLabel.textContent = `State: ${ghostState}`;
  }
});

document.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// --- External window movement loop ---
function movementLoop() {
  let x = 0;
  let y = 0;

  if (keys["j"]) x -= GHOST_WALKING_SPEED;
  if (keys["l"]) x += GHOST_WALKING_SPEED;
  if (keys["i"]) y -= GHOST_WALKING_SPEED;
  if (keys["k"]) y += GHOST_WALKING_SPEED;

  if (window.electronAPI?.moveExternal) {
    window.electronAPI.moveExternal(targetWindowId, x, y);
  }

  requestAnimationFrame(movementLoop);
}
movementLoop();

// --- Ghost drag area management ---
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let lastMouse = { x: 0, y: 0 };
let mouseVel = { x: 0, y: 0 };

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
  const centerX = x - 50; // Half of 100px
  const centerY = y - 50;

  // Ensure the drag area stays within screen bounds
  const clampedX = Math.max(0, Math.min(centerX, window.innerWidth - 100));
  const clampedY = Math.max(0, Math.min(centerY, window.innerHeight - 100));

  ghostDragArea.style.left = `${clampedX}px`;
  ghostDragArea.style.top = `${clampedY}px`;
}

// Drag area event handlers
// Enable interaction when mouse enters drag area
ghostDragArea.addEventListener("mouseenter", () => {
  console.log("🖱️ Mouse entered drag area - enabling interaction");
  window.electronAPI?.setClickThrough(false);
});

// Disable interaction when mouse leaves drag area
ghostDragArea.addEventListener("mouseleave", () => {
  console.log("🖱️ Mouse left drag area - enabling click-through");
  if (!isDragging) {
    window.electronAPI?.setClickThrough(true);
  }
});

ghostDragArea.addEventListener("mousedown", (e) => {
  console.log("🖱️ Drag area mousedown detected!");
  if (!ghost) return;

  isDragging = true;
  ghostDragArea.classList.add("dragging");

  // Calculate offset from mouse to ghost center
  const rect = ghostDragArea.getBoundingClientRect();
  dragOffset.x = e.clientX - rect.left - 50; // 50 is half of 100px drag area size
  dragOffset.y = e.clientY - rect.top - 50;

  lastMouse.x = e.clientX;
  lastMouse.y = e.clientY;
  mouseVel.x = 0;
  mouseVel.y = 0;

  e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
  if (!isDragging || !ghost) return;

  console.log("🖱️ Dragging ghost...");

  // Update ghost position based on mouse movement
  const deltaX = e.clientX - lastMouse.x;
  const deltaY = e.clientY - lastMouse.y;

  // Convert screen delta to world coordinates
  const scaleX =
    (getWorldBounds().xMax - getWorldBounds().xMin) / window.innerWidth;
  const scaleY =
    (getWorldBounds().yMax - getWorldBounds().yMin) / window.innerHeight;

  ghost.position.x += deltaX * scaleX;
  ghost.position.y -= deltaY * scaleY; // Invert Y for screen to world conversion

  // Track velocity for fling
  mouseVel.x = deltaX;
  mouseVel.y = deltaY;

  lastMouse.x = e.clientX;
  lastMouse.y = e.clientY;

  // Update drag area position
  updateDragAreaPosition();
});

document.addEventListener("mouseup", () => {
  if (!isDragging) return;

  console.log("🖱️ Drag ended!");

  isDragging = false;
  ghostDragArea.classList.remove("dragging");

  // Re-enable click-through after dragging
  window.electronAPI?.setClickThrough(true);

  // Apply fling velocity
  const scaleX =
    (getWorldBounds().xMax - getWorldBounds().xMin) / window.innerWidth;
  const scaleY =
    (getWorldBounds().yMax - getWorldBounds().yMin) / window.innerHeight;

  velocity.x = mouseVel.x * scaleX * 0.4;
  velocity.y = -mouseVel.y * scaleY * 0.4;

  const minVelocity = GHOST_MIN_FLING_SPEED;

  // Apply minimums
  if (Math.abs(velocity.x) < minVelocity)
    velocity.x = Math.sign(velocity.x || 1) * minVelocity;
  if (Math.abs(velocity.y) < minVelocity)
    velocity.y = Math.sign(velocity.y || 1) * minVelocity;

  isFlinging = true;
});
// --- Ghost idle drift ---

let isFlinging = false;
const velocity = new THREE.Vector3(
  GHOST_INITIAL_VELOCITY,
  GHOST_INITIAL_VELOCITY
);

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

// --- Animation loop ---
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (mixer) mixer.update(delta);

  if (ghost && !isDragging) {
    const isStandingStill = !!keys["r"];

    // Animation logic
    if (walkAction) {
      if (isStandingStill && walkAction.isRunning()) walkAction.stop();
      else if (!isStandingStill && !walkAction.isRunning()) walkAction.play();
    }

    const speed = isStandingStill ? 0 : 0.05;

    // Keyboard movement
    let moveX = 0;
    let moveY = 0;
    if (keys["w"] || keys["arrowup"]) moveY += 1;
    if (keys["s"] || keys["arrowdown"]) moveY -= 1;
    if (keys["a"] || keys["arrowleft"]) moveX -= 1;
    if (keys["d"] || keys["arrowright"]) moveX += 1;

    if (moveX !== 0 || moveY !== 0) {
      const len = Math.sqrt(moveX * moveX + moveY * moveY);
      moveX /= len;
      moveY /= len;
      ghost.position.x += moveX * speed;
      ghost.position.y += moveY * speed;
      lastNonZeroMove.set(moveX, moveY);
    } else if (isFlinging) {
      // Gradually decrease velocity magnitude toward normal walking speed
      const normalSpeed = GHOST_WALKING_SPEED;
      const currentSpeed = velocity.length();
      if (currentSpeed > normalSpeed) {
        // Reduce speed smoothly
        const deceleration = GHOST_FLING_DECELERATION; // tweak for smoothness
        const newSpeed = Math.max(currentSpeed - deceleration, normalSpeed);
        velocity.setLength(newSpeed);
      } else if (currentSpeed < normalSpeed) {
        // If for some reason velocity is less than normal, bring it up
        velocity.setLength(normalSpeed);
      }
    } else {
      // 💤 Idle drift (only when no fling & no keys)
      ghost.position.add(velocity);
    }

    // Idle drift
    if (!isStandingStill && moveX === 0 && moveY === 0) {
      ghost.position.add(velocity);
      if (velocity.x !== 0 || velocity.y !== 0)
        lastNonZeroMove.set(velocity.x, velocity.y);
    }

    // Smooth turning
    if (isStandingStill) {
      ghost.rotation.y += Math.PI * delta;
      targetRotationY = ghost.rotation.y;
    } else {
      if (lastNonZeroMove.x < -0.01) targetRotationY = -Math.PI / 2;
      else if (lastNonZeroMove.x > 0.01) targetRotationY = Math.PI / 2;
      else
        targetRotationY = lastDirection === "left" ? -Math.PI / 2 : Math.PI / 2;

      let currentY = ghost.rotation.y;
      let deltaY =
        ((targetRotationY - currentY + Math.PI) % (2 * Math.PI)) - Math.PI;
      let step = smoothTurnSpeed * delta;
      ghost.rotation.y +=
        Math.abs(deltaY) < step ? deltaY : Math.sign(deltaY) * step;
      lastDirection = targetRotationY > 0 ? "right" : "left";
    }

    // Bounce off world edges
    const bounds = getWorldBounds();
    const left = bounds.xMin + ghostHalfWidth;
    const right = bounds.xMax - ghostHalfWidth;
    const bottom = bounds.yMin + ghostHalfHeight;
    const top = bounds.yMax - ghostHalfHeight;

    if (ghost.position.x <= left) {
      ghost.position.x = left;
      velocity.x = Math.abs(velocity.x);
    } else if (ghost.position.x >= right) {
      ghost.position.x = right;
      velocity.x = -Math.abs(velocity.x);
    }
    if (ghost.position.y <= bottom) {
      ghost.position.y = bottom;
      velocity.y = Math.abs(velocity.y);
    } else if (ghost.position.y >= top) {
      ghost.position.y = top;
      velocity.y = -Math.abs(velocity.y);
    }

    const pos = document.getElementById("pos");
    if (pos)
      pos.textContent = `${ghost.position.x.toFixed(
        2
      )}, ${ghost.position.y.toFixed(2)}`;

    // Update drag area position to follow ghost
    updateDragAreaPosition();
  }

  renderer.render(scene, camera);
  if (labelRenderer) labelRenderer.render(scene, camera);
}

animate();
