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
const clock = new THREE.Clock();

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

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let isDragging = false;
let dragPlane = new THREE.Plane();
let dragOffset = new THREE.Vector3();
let lastMouse = new THREE.Vector2();
let mouseVel = new THREE.Vector2();

canvas.addEventListener("mousedown", (e) => {
  if (!ghost) return;

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(ghost, true);

  if (intersects.length > 0) {
    isDragging = true;
    window.electronAPI?.setClickThrough(false);

    // Drag plane for smooth movement
    dragPlane.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(new THREE.Vector3()),
      intersects[0].point
    );

    dragOffset.copy(intersects[0].point).sub(ghost.position);
    lastMouse.set(e.clientX, e.clientY);
    mouseVel.set(0, 0);
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (!ghost) return;

  // Keep click-through toggle for hover effect
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(ghost, true);
  window.electronAPI?.setClickThrough(intersects.length === 0);

  // Dragging logic
  if (!isDragging) return;

  if (raycaster.ray.intersectPlane(dragPlane, new THREE.Vector3())) {
    const pos = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, pos);
    ghost.position.copy(pos.sub(dragOffset));
  }

  // Track velocity for fling
  mouseVel.set(e.clientX - lastMouse.x, e.clientY - lastMouse.y);
  lastMouse.set(e.clientX, e.clientY);
});

canvas.addEventListener("mouseup", () => {
  if (!isDragging) return;
  isDragging = false;

  const scaleX =
    (getWorldBounds().xMax - getWorldBounds().xMin) / window.innerWidth;
  const scaleY =
    (getWorldBounds().yMax - getWorldBounds().yMin) / window.innerHeight;
  console.log("sclae", scaleX, scaleY);
  // Apply “goofy” velocity
  velocity.x = mouseVel.x * scaleX * 0.4;
  velocity.y = -mouseVel.y * scaleY * 0.4;

  const minVelocity = GHOST_MIN_FLING_SPEED; // tweak to taste

  velocity.x = mouseVel.x * scaleX * 0.4;
  velocity.y = -mouseVel.y * scaleY * 0.4;

  // Apply minimums
  if (Math.abs(velocity.x) < minVelocity)
    velocity.x = Math.sign(velocity.x || 1) * minVelocity;
  if (Math.abs(velocity.y) < minVelocity)
    velocity.y = Math.sign(velocity.y || 1) * minVelocity;

  isFlinging = true;
  window.electronAPI?.setClickThrough(true);
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
  }

  renderer.render(scene, camera);
  if (labelRenderer) labelRenderer.render(scene, camera);
}

animate();
