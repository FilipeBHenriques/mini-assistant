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

function smoothMoveWindowById(windowId, targetX, targetY, options = {}) {
  const steps = options.steps || 30;
  const interval = options.interval || 16; // ~60fps

  const windows = fetchWindows();
  const target = windows.find((w) => w.path.includes(windowId));
  if (!target || !target.window) {
    console.log(
      "[smooth-move-external-window] No matching window found for windowId:",
      windowId
    );
    return;
  }

  const win = target.window;
  const startBounds = win.getBounds();
  const dx = (targetX - startBounds.x) / steps;
  const dy = (targetY - startBounds.y) / steps;
  const width = startBounds.width;
  const height = startBounds.height;

  let currentStep = 0;

  function step() {
    if (currentStep < steps) {
      const newX = Math.round(startBounds.x + dx * currentStep);
      const newY = Math.round(startBounds.y + dy * currentStep);
      win.setBounds({ x: newX, y: newY, width, height });
      currentStep++;
      setTimeout(step, interval);
    } else {
      // Final position to ensure accuracy
      win.setBounds({
        x: targetX,
        y: targetY,
        width,
        height,
      });
      console.log(
        "[smooth-move-external-window] Move complete for windowId:",
        windowId
      );
    }
  }

  step();
}

module.exports = {
  fetchWindows,
  minimizeWindowbyId,
  maximizeWindowbyId,
  smoothMoveWindowById,
};
