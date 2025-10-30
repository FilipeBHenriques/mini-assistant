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
import { tools } from "./aiTools";

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
let lastDirection = "right";
let lastNonZeroMove = new THREE.Vector2(1, 0);
let targetRotationY = Math.PI / 2;
let smoothTurnSpeed = 6.0;

let ghostLabel;
let ghostMessage;
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
      walkAction = mixer.clipAction(gltf.animations[0]);
      walkAction.play();
    }

    // Initialize drag area position
    updateDragAreaPosition();

    // Start with click-through enabled (most of window is transparent)
    window.electronAPI?.setClickThrough(true);

    startGhostBehaviorLoop();
  },
  undefined,
  (err) => console.error("❌ Error loading ghost:", err)
);

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
    // You could trigger animation here (if using AnimationMixer or similar)
    // e.g., playChillAnimation(), playAngryAnimation(), etc.
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

    // Test smooth movement tool (smoothMoveActiveWindowToRandomPosition) if available
    if (
      tools.smoothMoveActiveWindowToRandomPosition &&
      typeof tools.smoothMoveActiveWindowToRandomPosition.run === "function"
    ) {
      tools.smoothMoveActiveWindowToRandomPosition.run(
        {},
        {
          mainWindow: window.electronAPI,
          smoothMoveActiveWindowToRandomPosition: (id, x, y) =>
            window.electronAPI.moveExternal(id, x, y),
          getActiveWindow: () => window.electronAPI.getActiveWindow(),
          getWindows: () => window.electronAPI.getWindows(),
          setGhostMessage: window.setGhostMessage,
        }
      );
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

// --- Key handling ---
const keys = {};
let movementTargetWindowId = null;
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
      if (ghostLabel) ghostLabel.textContent = parsed.state;
    }
  }
  if (e.key === " ") {
    e.preventDefault();
    switchMonitor();
  }
  if (e.key.toLowerCase() === "m" && window.electronAPI?.minimizeExternal) {
    // For demonstration, still uses old target
    window.electronAPI.minimizeExternal(movementTargetWindowId || "msedge.exe");
  }
  if (e.key.toLowerCase() === "n" && window.electronAPI?.maximizeExternal) {
    window.electronAPI.maximizeExternal(movementTargetWindowId || "msedge.exe");
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
// On first movement, select a random window. If not found, resets per movement trigger.
async function movementLoop() {
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

  ghost.position.x += deltaX * scaleX;
  ghost.position.y -= deltaY * scaleY;

  mouseVel.x = deltaX * 100;
  mouseVel.y = deltaY * 100;

  lastMouse.x = e.clientX;
  lastMouse.y = e.clientY;

  updateDragAreaPosition();
});

document.addEventListener("mouseup", () => {
  if (!isDragging) return;

  isDragging = false;
  ghostDragArea.classList.remove("dragging");
  window.electronAPI?.setClickThrough(true);

  const scaleX =
    (getWorldBounds().xMax - getWorldBounds().xMin) / window.innerWidth;
  const scaleY =
    (getWorldBounds().yMax - getWorldBounds().yMin) / window.innerHeight;

  velocity.x = mouseVel.x * scaleX * 1000;
  velocity.y = -mouseVel.y * scaleY * 1000;

  const minVelocity = 1.5;

  if (Math.abs(velocity.x) < minVelocity)
    velocity.x = Math.sign(velocity.x || 1) * minVelocity;
  if (Math.abs(velocity.y) < minVelocity)
    velocity.y = Math.sign(velocity.y || 1) * minVelocity;

  // ----- Pause behaviors -----
  if (ghostBehaviorTimeout) {
    clearTimeout(ghostBehaviorTimeout);
    ghostBehaviorTimeout = null;
  }

  isFlinging = true;
});

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

/**
 * ---------- GHOST STATE LOGIC BELOW ----------
 */

let ghostBehavior = null;
let ghostBehaviorTimeout = null;

function resetGhostBehaviorCycle() {
  if (ghostBehaviorTimeout) clearTimeout(ghostBehaviorTimeout);
  startGhostBehaviorLoop();
}

function startGhostBehaviorLoop() {
  // Choose and run a behavior based on ghostState
  let behaviors = [];
  switch (ghostState) {
    case GhostStates.Chill:
      behaviors = [ghostChillMove, ghostChillSitCorner, ghostChillSpin];
      break;
    case GhostStates.Angry:
      behaviors = [
        ghostProcrastinateMinimize,
        ghostProcrastinateDragWindow,
        ghostProcrastinateFastMove,
      ];
      break;
    case GhostStates.Sleeping:
      behaviors = [ghostSleepBottomRight, ghostSleepFadeOut, ghostSleepSnore];
      break;
    default:
      behaviors = [ghostChillMove];
  }
  ghostBehavior = behaviors[Math.floor(Math.random() * behaviors.length)];

  ghostBehavior(); // will run its own timer between behaviors
}

//-------------------
// Chill state behaviors
//-------------------

// Add a helper to wrap and show debug info for each behavior
function withDebug(fn) {
  return function () {
    setDebugFunctionCall(fn.name);
    if (isFlinging) return;
    return fn.apply(this, arguments);
  };
}

const ghostChillMove = withDebug(function ghostChillMove() {
  // Move around the screen slowly for a few seconds.
  let duration = 3000 + Math.random() * 2000;
  let angle = Math.random() * Math.PI * 2;
  let speed = 0.02 + Math.random() * 0.03;
  let elapsed = 0;

  function moveStep() {
    if (!ghost || isDragging || isFlinging) return; // Interrupt if user drags
    const delta = Math.min(clock.getDelta(), 0.05);

    ghost.position.x += Math.cos(angle) * speed;
    ghost.position.y += Math.sin(angle) * speed;

    // Bounce ghost off bounds
    const bounds = getWorldBounds();
    const left = bounds.xMin + ghostHalfWidth;
    const right = bounds.xMax - ghostHalfWidth;
    const bottom = bounds.yMin + ghostHalfHeight;
    const top = bounds.yMax - ghostHalfHeight;

    if (ghost.position.x <= left || ghost.position.x >= right)
      angle = Math.PI - angle;
    if (ghost.position.y <= bottom || ghost.position.y >= top) angle = -angle;

    updateDragAreaPosition();

    elapsed += delta * 1000;
    if (elapsed < duration) {
      ghostBehaviorTimeout = setTimeout(moveStep, 16);
    } else {
      ghostBehaviorTimeout = setTimeout(startGhostBehaviorLoop, 500);
    }
  }
  moveStep();
});

const ghostChillSitCorner = withDebug(function ghostChillSitCorner() {
  if (!ghost) return;
  // Go to a random corner and sit there for a random period.
  const bounds = getWorldBounds();
  const corners = [
    { x: bounds.xMin + ghostHalfWidth, y: bounds.yMin + ghostHalfHeight },
    { x: bounds.xMax - ghostHalfWidth, y: bounds.yMin + ghostHalfHeight },
    { x: bounds.xMin + ghostHalfWidth, y: bounds.yMax - ghostHalfHeight },
    { x: bounds.xMax - ghostHalfWidth, y: bounds.yMax - ghostHalfHeight },
  ];
  const target = corners[Math.floor(Math.random() * corners.length)];
  let duration = 2000 + Math.random() * 3000;
  let sitDuration = 1200 + Math.random() * 2000;

  function goToCornerStep() {
    if (!ghost || isDragging) return;
    let dx = target.x - ghost.position.x;
    let dy = target.y - ghost.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.03) {
      let prev = ghost.position.clone();
      function sit() {
        // Stay for sitDuration and occasionally blink (add minor visual)
        if (!ghost) return;
        let elapsed = 0;
        function sitTick() {
          elapsed += 150;
          ghost.position.copy(prev);
          if (elapsed < sitDuration) {
            ghostBehaviorTimeout = setTimeout(sitTick, 150);
          } else {
            ghostBehaviorTimeout = setTimeout(startGhostBehaviorLoop, 200);
          }
        }
        sitTick();
      }
      sit();
    } else {
      // Move towards corner
      let speed = Math.min(dist, 0.045);
      ghost.position.x += (dx / dist) * speed;
      ghost.position.y += (dy / dist) * speed;
      updateDragAreaPosition();
      ghostBehaviorTimeout = setTimeout(goToCornerStep, 16);
    }
  }
  goToCornerStep();
});

const ghostChillSpin = withDebug(function ghostChillSpin() {
  // Spin in place for a random duration
  let duration = 1800 + Math.random() * 1200;
  let elapsed = 0;
  function spinStep() {
    if (!ghost || isDragging) return;
    const delta = Math.min(clock.getDelta(), 0.05);
    ghost.rotation.y += delta * 6.5; // Fast spin
    elapsed += delta * 1000;
    if (elapsed < duration) {
      ghostBehaviorTimeout = setTimeout(spinStep, 16);
    } else {
      ghostBehaviorTimeout = setTimeout(startGhostBehaviorLoop, 500);
    }
  }
  spinStep();
});

//-------------------
// Procrastinating state (Angry)
//-------------------

const ghostProcrastinateMinimize = withDebug(
  function ghostProcrastinateMinimize() {
    // Calls electron to minimize a random external window, and looms at edge.
    let done = false;
    (async () => {
      let randomTargetId = await getRandomActiveWindowId();
      if (randomTargetId && window.electronAPI?.minimizeExternal) {
        window.electronAPI.minimizeExternal(randomTargetId);
        done = true;
      }
      // Quick zoom to corner for fun
      if (ghost) {
        const bounds = getWorldBounds();
        ghost.position.x = bounds.xMin + ghostHalfWidth;
        ghost.position.y = bounds.yMax - ghostHalfHeight;
        updateDragAreaPosition();
      }
      ghostBehaviorTimeout = setTimeout(
        startGhostBehaviorLoop,
        done ? 1000 : 1500
      );
    })();
  }
);

const ghostProcrastinateDragWindow = withDebug(
  function ghostProcrastinateDragWindow() {
    // Drags a random window around slowly in a lazy circle
    let t = 0;
    let runTime = 3000 + Math.random() * 2000;
    let moving = true;
    let selectedWindowId = null;

    (async () => {
      selectedWindowId = await getRandomActiveWindowId();

      function dragStep() {
        if (!ghost) return;
        if (window.electronAPI?.moveExternal && selectedWindowId) {
          let x = Math.cos(t / 90) * 6;
          let y = Math.sin(t / 90) * 6;
          window.electronAPI.moveExternal(selectedWindowId, x, y);
        }
        t += 2;
        runTime -= 16;
        if (runTime > 0) {
          ghostBehaviorTimeout = setTimeout(dragStep, 16);
        } else {
          ghostBehaviorTimeout = setTimeout(startGhostBehaviorLoop, 600);
        }
      }
      dragStep();
    })();
  }
);

const ghostProcrastinateFastMove = withDebug(
  function ghostProcrastinateFastMove() {
    // Move our ghost rapidly back and forth to get user attention
    let moves = 0;
    let maxMoves = 45 + Math.floor(Math.random() * 22);
    let direction = 1;
    function dash() {
      if (!ghost) return;
      const bounds = getWorldBounds();
      ghost.position.x += direction * 0.16;
      if (
        ghost.position.x > bounds.xMax - ghostHalfWidth ||
        ghost.position.x < bounds.xMin + ghostHalfWidth
      ) {
        direction = -direction;
        moves += 1;
      }
      updateDragAreaPosition();
      if (moves < maxMoves) {
        ghostBehaviorTimeout = setTimeout(dash, 12);
      } else {
        ghostBehaviorTimeout = setTimeout(startGhostBehaviorLoop, 300);
      }
    }
    dash();
  }
);

//-------------------
// Sleeping state
//-------------------

const ghostSleepBottomRight = withDebug(function ghostSleepBottomRight() {
  // Go to bottom right and stand still, reduce alpha slightly
  if (!ghost) return;
  const bounds = getWorldBounds();
  let targetX = bounds.xMax - ghostHalfWidth;
  let targetY = bounds.yMin + ghostHalfHeight;
  let interval = 0;

  function moveToSleepSpot() {
    if (!ghost) return;
    let dx = targetX - ghost.position.x;
    let dy = targetY - ghost.position.y;
    let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.025) {
      ghost.position.x = targetX;
      ghost.position.y = targetY;
      ghost.material &&
        ((ghost.material.transparent = true), (ghost.material.opacity = 0.72));
      ghostBehaviorTimeout = setTimeout(
        startGhostBehaviorLoop,
        3500 + Math.random() * 1500
      );
    } else {
      let speed = Math.min(dist, 0.04);
      ghost.position.x += (dx / dist) * speed;
      ghost.position.y += (dy / dist) * speed;
      updateDragAreaPosition();
      ghostBehaviorTimeout = setTimeout(moveToSleepSpot, 18);
    }
  }
  moveToSleepSpot();
});

const ghostSleepFadeOut = withDebug(function ghostSleepFadeOut() {
  // Fade ghost in and out to appear sleeping
  if (!ghost) return;
  let origAlpha =
    ghost.material && ghost.material.opacity ? ghost.material.opacity : 1;
  let t = 0;
  function fadeStep() {
    if (!ghost || !ghost.material) return;
    t += 0.016;
    ghost.material.transparent = true;
    ghost.material.opacity = 0.7 + 0.22 * Math.cos(t * 2);
    if (t < 5) {
      ghostBehaviorTimeout = setTimeout(fadeStep, 16);
    } else {
      ghost.material.opacity = origAlpha;
      ghostBehaviorTimeout = setTimeout(startGhostBehaviorLoop, 200);
    }
  }
  fadeStep();
});

const ghostSleepSnore = withDebug(function ghostSleepSnore() {
  // Simulate snoring - just a head tilt or a bob animation.
  if (!ghost) return;
  let elapsed = 0;
  let duration = 1700 + Math.random() * 700;
  function snore() {
    elapsed += 20;
    ghost.rotation.x = 0.15 * Math.sin(elapsed / 180);
    if (elapsed < duration) {
      ghostBehaviorTimeout = setTimeout(snore, 20);
    } else {
      ghost.rotation.x = 0;
      ghostBehaviorTimeout = setTimeout(
        startGhostBehaviorLoop,
        350 + Math.random() * 200
      );
    }
  }
  snore();
});

/**
 * --- Animation loop ---
 * This loop is now focused on rendering & misc updates,
 * and hands off the "ghost intent" behaviors to the above logic.
 */
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (mixer) mixer.update(delta);

  if (isFlinging && ghost) {
    const delta = clock.getDelta();
    ghost.position.x += velocity.x * delta;
    ghost.position.y += velocity.y * delta;
    const bounds = getWorldBounds();
    if (
      ghost.position.x > bounds.xMax - ghostHalfWidth ||
      ghost.position.x < bounds.xMin + ghostHalfWidth
    ) {
      velocity.x *= -1;
      ghost.position.x = THREE.MathUtils.clamp(
        ghost.position.x,
        bounds.xMin + ghostHalfWidth,
        bounds.xMax - ghostHalfWidth
      );
    }
    if (
      ghost.position.y > bounds.yMax - ghostHalfHeight ||
      ghost.position.y < bounds.yMin + ghostHalfHeight
    ) {
      velocity.y *= -1;
      ghost.position.y = THREE.MathUtils.clamp(
        ghost.position.y,
        bounds.yMin + ghostHalfHeight,
        bounds.yMax - ghostHalfHeight
      );
    }

    // deceleration
    velocity.multiplyScalar(
      Math.pow(GHOST_FLING_DECELERATION || 0.92, delta * 60)
    );

    // We check velocity.length() to see if the ghost's speed is very low,
    // which means it has almost stopped after being flung. When that happens,
    // we stop the fling and resume ghost behaviors.
    if (velocity.length() < 10 || isNaN(velocity.length())) {
      velocity.set(0, 0, 0);
      isFlinging = false;
      resetGhostBehaviorCycle();
    }

    updateDragAreaPosition();
  }

  // Keyboard movement overrides (optional)
  if (ghost && !isDragging) {
    let moveX = 0,
      moveY = 0;
    if (keys["w"] || keys["arrowup"]) moveY += 1;
    if (keys["s"] || keys["arrowdown"]) moveY -= 1;
    if (keys["a"] || keys["arrowleft"]) moveX -= 1;
    if (keys["d"] || keys["arrowright"]) moveX += 1;

    if (moveX !== 0 || moveY !== 0) {
      const len = Math.sqrt(moveX * moveX + moveY * moveY);
      ghost.position.x += (moveX / len) * 0.07;
      ghost.position.y += (moveY / len) * 0.07;
      updateDragAreaPosition();
    }
  }

  renderer.render(scene, camera);
  if (labelRenderer) labelRenderer.render(scene, camera);
}

animate();
