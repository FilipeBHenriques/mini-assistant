// utils.js
async function fetchWindows() {
  try {
    const { openWindows } = await import("get-windows"); // ESM dynamic import
    const windows = await openWindows();
    return windows.map((w) => ({
      app: w.owner.name, // app name (e.g., "Microsoft Edge")
      title: w.title, // window title or tab title
      pid: w.owner.processId,
      path: w.owner.path,
    }));
  } catch (err) {
    console.error("Error fetching windows:", err);
    return [];
  }
}
module.exports = { fetchWindows };
