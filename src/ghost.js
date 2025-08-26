import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const canvas = document.getElementById("ghost-canvas");
const clock = new THREE.Clock();
const GHOST_SCALE = 0.2;

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

// Lights
const dir = new THREE.DirectionalLight(0xffffff, 1);
dir.position.set(5, 5, 5);
scene.add(dir);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

// Ghost model
let ghost = null;
let ghostHalfWidth = 0.5;
let ghostHalfHeight = 0.5;
let mixer = null;
let walkAction = null;
let lastDirection = "right";
let lastNonZeroMove = new THREE.Vector2(1, 0);
let targetRotationY = Math.PI / 2;
let smoothTurnSpeed = 6.0;

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

// --- Key handling ---
const keys = {};
const targetWindowId = "msedge.exe";
const moveAmount = 5;

document.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;

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
});

document.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// --- External window movement loop ---
function movementLoop() {
  let x = 0;
  let y = 0;

  if (keys["j"]) x -= moveAmount;
  if (keys["l"]) x += moveAmount;
  if (keys["i"]) y -= moveAmount;
  if (keys["k"]) y += moveAmount;

  if (window.electronAPI?.moveExternal) {
    window.electronAPI.moveExternal(targetWindowId, x, y);
  }

  requestAnimationFrame(movementLoop);
}
movementLoop();

// --- Ghost idle drift ---
const velocity = new THREE.Vector3(
  (Math.random() - 0.5) * 0.02,
  (Math.random() - 0.5) * 0.02
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

  if (ghost) {
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
}

animate();
