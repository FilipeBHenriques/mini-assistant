const { windowManager } = require("node-window-manager");
const path = require("path");

function fetchWindows() {
  return windowManager
    .getWindows()
    .filter((w) => {
      if (!w.isWindow() || !w.isVisible()) return false;
      if (!w.getTitle().trim()) return false;

      // get exe name only
      const exe = w.path ? path.basename(w.path).toLowerCase() : "";

      // skip known background/helper processes
      if (
        exe.includes("trap") ||
        exe.includes("crashpad") ||
        exe.includes("helper") ||
        exe.includes("overlay") ||
        exe.includes("updater")
      ) {
        return false;
      }

      return true;
    })
    .map((w) => ({
      id: w.id,
      title: w.getTitle(),
      bounds: w.getBounds(),
      processId: w.processId,
      path: w.path ? path.basename(w.path) : null,
      window: w,
    }));
}

function getActiveWindow() {
  const activateWindow = windowManager.getActiveWindow();
  return {
    id: activateWindow.id,
    title: activateWindow.getTitle(),
    bounds: activateWindow.getBounds(),
    processId: activateWindow.processId,
    path: activateWindow.path ? path.basename(activateWindow.path) : null,
    window: activateWindow,
  };
}

function minimizeWindowbyId(windowId) {
  console.log("[minimize-external-window] called with windowId:", windowId);
  const windows = fetchWindows();

  const target = windows.find((w) => w.path.includes(windowId));

  if (target && target.window) {
    console.log("[minimize-external-window] Minimizing window:", {
      id: target.id,
      path: target.path,
      title: target.title,
    });
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

module.exports = {
  fetchWindows,
  minimizeWindowbyId,
  maximizeWindowbyId,
  smoothMoveWindowById,
  getActiveWindow,
};
