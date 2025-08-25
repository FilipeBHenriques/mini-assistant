import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const canvas = document.getElementById("ghost-canvas");
const clock = new THREE.Clock(); // top-level
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

// Load ghost model (put ghost.glb in src/assets/)
let ghost = null;
let ghostBoundingBox = null;
let ghostHalfWidth = 0.5; // fallback default
let ghostHalfHeight = 0.5; // fallback default

let mixer = null;
let walkAction = null;

// Track last direction for facing
let lastDirection = "right"; // "left" or "right"
let lastNonZeroMove = new THREE.Vector2(1, 0); // Default facing right

// For smooth turning
let targetRotationY = Math.PI / 2; // Default facing right
let smoothTurnSpeed = 6.0; // radians per second, higher = snappier

const loader = new GLTFLoader();
loader.load(
  new URL("./assets/ghost2.glb", import.meta.url).href,
  (gltf) => {
    ghost = gltf.scene;
    ghost.scale.set(GHOST_SCALE, GHOST_SCALE, GHOST_SCALE);
    ghost.position.set(0, 0, 0);
    scene.add(ghost);
    // Compute bounding box for the ghost
    const box = new THREE.Box3().setFromObject(ghost);
    ghostBoundingBox = box;
    // Get half extents for collision
    const size = new THREE.Vector3();
    box.getSize(size);
    ghostHalfWidth = size.x / 2;
    ghostHalfHeight = size.y / 2;
    console.log("✅ Ghost loaded, bounding box:", size);
    // --- Animation setup ---
    if (gltf.animations && gltf.animations.length) {
      console.log("ghost has animantpons");
      mixer = new THREE.AnimationMixer(ghost);
      walkAction = mixer.clipAction(gltf.animations[0]);
      walkAction.play();
    }
  },
  undefined,
  (err) => console.error("❌ Error loading ghost:", err)
);

function switchMonitor() {
  // Send message to main process to switch monitor
  if (window.electronAPI && window.electronAPI.switchMonitor) {
    window.electronAPI.switchMonitor();
  } else {
    console.log("Press SPACE to switch monitors!");
  }
}

// Movement
const keys = {};
document.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  // Switch monitor with SPACE key (manual override)
  if (e.key === " ") {
    e.preventDefault();
    switchMonitor();
  }
  if (e.key.toLowerCase() === "m") {
    console.log("pressing m");
    // You’ll need the windowId from fetchWindows() results
    const targetWindowId = "msedge.exe"; // Example ID
    if (window.electronAPI && window.electronAPI.minimizeExternal) {
      window.electronAPI.minimizeExternal(targetWindowId);
    } else {
      console.log("minimizeExternal not implemented in electronAPI");
    }
  }
  if (e.key.toLowerCase() === "n") {
    console.log("pressing n");
    // You’ll need the windowId from fetchWindows() results
    const targetWindowId = "msedge.exe"; // Example ID
    if (window.electronAPI.maximizeExternal) {
      window.electronAPI.maximizeExternal(targetWindowId);
    } else {
      console.log("maximizeExternal not implemented in electronAPI");
    }
  }

  const targetWindowId = "msedge.exe";

  const moveAmount = 50;
  if (["j", "k", "l", "i"].includes(e.key.toLowerCase())) {
    console.log("movement key pressed ");
    // Fetch current window position (optional: you could cache this)
    let x = 0;
    let y = 0;
    if (window.electronAPI.moveExternal) {
      console.log("moveecternla exists");
      switch (e.key.toLowerCase()) {
        case "j":
          x = moveAmount;
          break;
        case "l":
          x = moveAmount;
          break;
        case "i":
          y = moveAmount;
          break;
        case "k":
          y = moveAmount;
          break;
      }
      window.electronAPI.moveExternal(targetWindowId, x, y);
    }
  }
});

document.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

// Ghost movement velocity
const velocity = new THREE.Vector3(
  (Math.random() - 0.5) * 0.02,
  (Math.random() - 0.5) * 0.02,
  0
);

function getWorldBounds() {
  // Calculate the world bounds so the ghost bounces off the monitor edge
  // Project the corners of the screen at z=0 into world coordinates
  // We'll use the camera's frustum at z=0
  const aspect = window.innerWidth / window.innerHeight;
  const vFOV = (camera.fov * Math.PI) / 180;
  const height = 2 * Math.tan(vFOV / 2) * Math.abs(camera.position.z);
  const width = height * aspect;
  // The center is at (0,0), so bounds are:
  return {
    xMin: -width / 2,
    xMax: width / 2,
    yMin: -height / 2,
    yMax: height / 2,
  };
}

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta(); // get frame delta

  if (mixer) mixer.update(delta); // update animation mixer

  if (ghost) {
    // Stand still if R is held
    const isStandingStill = !!keys["r"];

    // Animation play/pause logic
    if (walkAction) {
      if (isStandingStill && walkAction.isRunning()) {
        walkAction.stop();
      } else if (!isStandingStill && !walkAction.isRunning()) {
        walkAction.play();
      }
    }

    const speed = isStandingStill ? 0 : 0.05;

    // Track movement direction for facing
    let moveX = 0;
    let moveY = 0;

    // Keyboard movement
    if (keys["w"] || keys["arrowup"]) moveY += 1;
    if (keys["s"] || keys["arrowdown"]) moveY -= 1;
    if (keys["a"] || keys["arrowleft"]) moveX -= 1;
    if (keys["d"] || keys["arrowright"]) moveX += 1;

    // Normalize for diagonal movement
    if (moveX !== 0 || moveY !== 0) {
      const len = Math.sqrt(moveX * moveX + moveY * moveY);
      moveX /= len;
      moveY /= len;
      ghost.position.x += moveX * speed;
      ghost.position.y += moveY * speed;
      lastNonZeroMove.set(moveX, moveY);
    }

    // Drift when idle (only if not standing still)
    if (!isStandingStill && moveX === 0 && moveY === 0) {
      ghost.position.add(velocity);
      // Use velocity for facing if drifting
      if (velocity.x !== 0 || velocity.y !== 0) {
        lastNonZeroMove.set(velocity.x, velocity.y);
      }
    }

    // --- Smooth turning logic ---
    if (isStandingStill) {
      // Spin at 1 rotation per 2 seconds (PI radians per second)
      ghost.rotation.y += Math.PI * delta;
      // When spinning, update targetRotationY to current so it doesn't snap after spinning
      targetRotationY = ghost.rotation.y;
    } else {
      // Determine target rotation based on movement direction
      if (lastNonZeroMove.x < -0.01) {
        // Face left (-90deg)
        targetRotationY = -Math.PI / 2;
        lastDirection = "left";
      } else if (lastNonZeroMove.x > 0.01) {
        // Face right (90deg)
        targetRotationY = Math.PI / 2;
        lastDirection = "right";
      } else {
        // If not moving horizontally, keep last direction
        if (lastDirection === "left") {
          targetRotationY = -Math.PI / 2;
        } else if (lastDirection === "right") {
          targetRotationY = Math.PI / 2;
        }
      }
      // Smoothly interpolate current rotation.y toward targetRotationY
      // Use shortest path (handle wrap-around)
      let currentY = ghost.rotation.y;
      let deltaY = targetRotationY - currentY;
      // Wrap to [-PI, PI]
      deltaY = ((deltaY + Math.PI) % (2 * Math.PI)) - Math.PI;
      // Clamp step to not overshoot
      let step = smoothTurnSpeed * delta;
      if (Math.abs(deltaY) < 1e-4) {
        ghost.rotation.y = targetRotationY;
      } else {
        if (Math.abs(deltaY) < step) {
          ghost.rotation.y = targetRotationY;
        } else {
          ghost.rotation.y += Math.sign(deltaY) * step;
        }
      }
    }

    // BOUNCE OFF ACTUAL MONITOR EDGES, using ghost's real size
    const bounds = getWorldBounds();
    // Use ghost's half extents for collision
    const left = bounds.xMin + ghostHalfWidth;
    const right = bounds.xMax - ghostHalfWidth;
    const bottom = bounds.yMin + ghostHalfHeight;
    const top = bounds.yMax - ghostHalfHeight;

    // Bounce horizontally
    if (ghost.position.x <= left) {
      ghost.position.x = left;
      velocity.x = Math.abs(velocity.x);
    } else if (ghost.position.x >= right) {
      ghost.position.x = right;
      velocity.x = -Math.abs(velocity.x);
    }
    // Bounce vertically
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
