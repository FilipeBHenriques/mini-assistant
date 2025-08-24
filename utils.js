const { windowManager } = require("node-window-manager");

function fetchWindows() {
  return (
    windowManager
      .getWindows()
      // remove invisible / cloaked windows
      .filter((w) => w.isVisible() && w.getTitle().trim() !== "")
      // keep only "normal" app windows (skip tool windows, background stuff)
      .filter((w) => w.isWindow())
      .map((w) => ({
        id: w.id,
        title: w.getTitle(),
        bounds: w.getBounds(),
        processId: w.processId,
        path: w.path,
      }))
  );
}

module.exports = { fetchWindows };
