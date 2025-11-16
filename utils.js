const { windowManager } = require("node-window-manager");
const path = require("path");
const { powerMonitor } = require("electron");
const robot = require("@hurdlegroup/robotjs");

let lastActiveWindow = null; // Store the last active window that isn't the overlay

function fetchWindows() {
  // Use a Set to track unique windows by processId+title (as path alone may not be unique)
  const seen = new Set();
  return windowManager
    .getWindows()
    .filter((w) => {
      if (!w.isWindow() || !w.isVisible()) return false;

      // get exe name only
      const exe = w.path ? path.basename(w.path).toLowerCase() : "";
      const title = w.getTitle().trim();

      // skip known background/helper processes
      if (
        exe.includes("trap") ||
        exe.includes("crashpad") ||
        exe.includes("helper") ||
        exe.includes("overlay") ||
        exe.includes("updater") ||
        exe.includes("dwm") || // Desktop Window Manager
        exe.includes("winlogon") || // Windows logon
        exe.includes("csrss") // Client Server Runtime Process
      ) {
        return false;
      }

      // Compose a unique key using processId and normalized title
      const key = `${w.processId}:${title}`;
      if (seen.has(key)) return false;
      seen.add(key);

      return true;
    })
    .map((w) => {
      const title = w.getTitle().trim();
      const exe = w.path ? path.basename(w.path) : "Unknown";

      return {
        id: w.id,
        title: title || `${exe} (No Title)`, // Fallback title for windows without names
        bounds: w.getBounds(),
        processId: w.processId,
        path: exe,
        window: w,
      };
    });
}

function getActiveWindow() {
  const activateWindow = windowManager.getActiveWindow();

  // Check if the active window is our overlay electron window
  const isOverlayWindow =
    activateWindow.path &&
    (activateWindow.path.includes("electron") ||
      activateWindow.path.includes("mini-assistant"));

  if (isOverlayWindow) {
    // Return the last saved active window if current is overlay
    return lastActiveWindow;
  }

  // Save this as the last active window since it's not the overlay
  const title = activateWindow.getTitle().trim();
  const exe = activateWindow.path
    ? path.basename(activateWindow.path)
    : "Unknown";

  const windowInfo = {
    id: activateWindow.id,
    title: title || `${exe} (No Title)`, // Fallback title for windows without names
    bounds: activateWindow.getBounds(),
    processId: activateWindow.processId,
    path: exe,
    window: activateWindow,
  };

  lastActiveWindow = windowInfo;
  return windowInfo;
}

function minimizeWindowbyId(windowId) {
  const windows = fetchWindows();

  const target = windows.find((w) => w.id === windowId);

  if (target && target.window) {
    target.window.minimize(); // ✅ works here
  } else {
    console.log(
      "[minimize-external-window] No matching window found for windowId:",
      windowId
    );
  }
}

function maximizeWindowbyId(windowId) {
  const windows = fetchWindows();

  const target = windows.find((w) => w.id === windowId);
  if (target && target.window) {
    target.window.maximize(); // ✅ works here
  } else {
    console.log(
      "[maximize-external-window] No matching window found for windowId:",
      windowId
    );
  }
}

async function getDesktopIdleDuration() {
  return powerMonitor.getSystemIdleTime();
}

function animateWindowToRandomDisplayPosition(windowId, screen) {
  const windows = fetchWindows();
  const target = windows.find(
    (w) => w.id === windowId || (w.path && w.path.includes(windowId))
  );
  if (!target || !target.window) {
    console.warn(
      "[animateWindowToRandomDisplayPosition] No matching window found for windowId:",
      windowId
    );
    return;
  }

  const win = target.window;
  let bounds = target.bounds;

  // If screen provided, use that for screen geometry
  let display;
  if (screen && screen.getDisplayMatching && bounds) {
    display = screen.getDisplayMatching(bounds);
  }

  // Use display workArea if available, otherwise basic desktop size
  const screenArea =
    display && display.workArea
      ? display.workArea
      : { x: 0, y: 0, width: 1920, height: 1080 };
  const winWidth = bounds.width || 400;
  const winHeight = bounds.height || 300;

  // Prevent positioning outside display
  const minX = screenArea.x;
  const minY = screenArea.y;
  const maxX = screenArea.x + screenArea.width - winWidth;
  const maxY = screenArea.y + screenArea.height - winHeight;
  // Generate random position
  const randX = Math.floor(Math.random() * (maxX - minX + 1)) + minX;
  const randY = Math.floor(Math.random() * (maxY - minY + 1)) + minY;

  // Animate window to new position (not teleport)
  const startX = bounds.x;
  const startY = bounds.y;
  const steps = 30;
  const interval = 10; // ms per step

  let currentStep = 0;

  // Optional easing function for smoother movement
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  function step() {
    currentStep++;
    const progress = Math.min(currentStep / steps, 1);
    const eased = easeInOut(progress);

    const newX = Math.round(startX + (randX - startX) * eased);
    const newY = Math.round(startY + (randY - startY) * eased);

    win.setBounds({ x: newX, y: newY, width: winWidth, height: winHeight });

    if (progress < 1) {
      setTimeout(step, interval);
    } else {
      // Ensure exact final position
      win.setBounds({ x: randX, y: randY, width: winWidth, height: winHeight });
      console.log(
        `[animateWindowToRandomDisplayPosition] Animation complete for windowId ${windowId} to (${randX}, ${randY})`
      );
    }
  }

  step();
}

const MouseGrabBehaviors = {
  RANDOM: "RANDOM",
  CIRCLE: "CIRCLE",
  CORNER: "CORNER",
};

function ghostMouseGrab(
  moveFn,
  durationMs = 3000,
  pullDistance = 100,
  targetX,
  targetY,
  corner = null,
  behavior = null
) {
  const start = Date.now();
  let pos = robot.getMousePos(); // current position

  // Pick mouse behavior randomly if not provided
  const MouseBehavior =
    behavior ||
    [
      MouseGrabBehaviors.CIRCLE,
      MouseGrabBehaviors.RANDOM,
      MouseGrabBehaviors.CORNER,
    ][Math.floor(Math.random() * 3)];

  let angle = 0; // for circle
  const circleRadius = pullDistance || 10; // per-frame delta, fallback to 10 if undefined
  const screen = robot.getScreenSize();

  const interval = setInterval(() => {
    const now = Date.now();
    if (now - start >= durationMs) {
      clearInterval(interval);
      return;
    }

    let deltaX = 0;
    let deltaY = 0;

    switch (MouseBehavior) {
      case MouseGrabBehaviors.CIRCLE: {
        angle += 0.3; // speed
        deltaX = Math.cos(angle) * circleRadius;
        deltaY = Math.sin(angle) * circleRadius;
        break;
      }
      case MouseGrabBehaviors.RANDOM: {
        deltaX = (Math.random() - 0.5) * (pullDistance || 30);
        deltaY = (Math.random() - 0.5) * (pullDistance || 30);
        break;
      }
      case MouseGrabBehaviors.CORNER: {
        let target;
        // Determine target (corner or specific targetX/targetY)
        if (
          typeof targetX === "number" &&
          typeof targetY === "number" &&
          !corner
        ) {
          target = { x: targetX, y: targetY };
        } else {
          let tx = 0;
          let ty = 0;
          switch (corner) {
            case "topLeft":
              tx = 0;
              ty = 0;
              break;
            case "topRight":
              tx = screen.width - 1;
              ty = 0;
              break;
            case "bottomLeft":
              tx = 0;
              ty = screen.height - 1;
              break;
            case "bottomRight":
              tx = screen.width - 1;
              ty = screen.height - 1;
              break;
            default:
              // Fallback to lower right
              tx = screen.width - 1;
              ty = screen.height - 1;
          }
          target = { x: tx, y: ty };
        }
        // Move partway toward target
        deltaX = (target.x - pos.x) * 0.3;
        deltaY = (target.y - pos.y) * 0.3;
        break;
      }
      default: {
        throw new Error(
          `[ghostMouseGrab] Unknown MouseGrabBehavior: ${behavior}`
        );
      }
    }

    // Update and clamp
    pos.x += deltaX;
    pos.y += deltaY;
    pos.x = Math.max(0, Math.min(screen.width - 1, pos.x));
    pos.y = Math.max(0, Math.min(screen.height - 1, pos.y));

    robot.moveMouse(Math.round(pos.x), Math.round(pos.y));

    if (moveFn) {
      if (moveFn) moveFn({ x: pos.x, y: pos.y }); // pass current mouse pos
    }
    console.log(
      "[ghostMouseGrab] Moving mouse to:",
      Math.round(pos.x),
      Math.round(pos.y),
      deltaX,
      deltaY
    );
  }, 8);
}

module.exports = {
  fetchWindows,
  minimizeWindowbyId,
  maximizeWindowbyId,
  getActiveWindow,
  getDesktopIdleDuration,
  animateWindowToRandomDisplayPosition,
  ghostMouseGrab,
  MouseGrabBehaviors,
};
