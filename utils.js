const { windowManager } = require("node-window-manager");
const path = require("path");
const desktopIdle = require("desktop-idle");

let lastActiveWindow = null; // Store the last active window that isn't the overlay

function fetchWindows() {
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
  console.log("activateWindow", activateWindow);

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
  console.log("[minimize-external-window] called with windowId:", windowId);
  const windows = fetchWindows();

  const target = windows.find((w) => w.path.includes(windowId));

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
  console.log("[maximize-external-window] called with windowId:", windowId);
  const windows = fetchWindows();

  const target = windows.find((w) => w.path.includes(windowId));
  if (target && target.window) {
    console.log("[maximize-external-window] Maximizing window:", {
      id: target.id,
      path: target.path,
      title: target.title,
    });
    target.window.maximize(); // ✅ works here
  } else {
    console.log(
      "[maximize-external-window] No matching window found for windowId:",
      windowId
    );
  }
}

async function smoothMoveWindowById(windowId, deltaX, deltaY, options = {}) {
  const steps = options.steps || 60; // number of steps
  const interval = options.interval || 8; // ms between steps (~120fps)

  const windows = fetchWindows();
  console.log("windones fetched", windows);
  const target = windows.find((w) => w.path.includes(windowId));
  if (!target || !target.window) {
    console.warn(
      "[smooth-move-window] No matching window found for windowId:",
      windowId
    );
    return;
  }

  const win = target.window;
  const startBounds = target.bounds;
  const startX = startBounds.x;
  const startY = startBounds.y;
  const width = startBounds.width;
  const height = startBounds.height;

  let currentStep = 0;

  // Optional easing function for smoother movement
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  function step() {
    currentStep++;
    const progress = Math.min(currentStep / steps, 1);
    const easedProgress = easeInOut(progress);

    const newX = Math.round(startX + deltaX * easedProgress);
    const newY = Math.round(startY + deltaY * easedProgress);

    win.setBounds({ x: newX, y: newY, width, height });

    if (progress < 1) {
      setTimeout(step, interval);
    } else {
      // ensure exact final position
      win.setBounds({ x: startX + deltaX, y: startY + deltaY, width, height });
      console.log("[smooth-move-window] Move complete for windowId:", windowId);
    }
  }

  step();
}

function getDesktopIdleDuration() {
  return desktopIdle.getIdleTime();
}

module.exports = {
  fetchWindows,
  minimizeWindowbyId,
  maximizeWindowbyId,
  smoothMoveWindowById,
  getActiveWindow,
  getDesktopIdleDuration,
};
