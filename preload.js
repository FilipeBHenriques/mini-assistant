// Preload script for Electron
// This file provides a secure bridge between the renderer process and main process

const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // Switch to the next monitor
  switchMonitor: () => {
    ipcRenderer.send("switch-monitor");
  },

  getProcesses: () => ipcRenderer.invoke("get-process-list"),
  minimizeExternal: (windowId) =>
    ipcRenderer.send("minimize-external-window", windowId),
  maximizeExternal: (windowId) =>
    ipcRenderer.send("maximize-external-window", windowId),
  moveExternal: (windowId, x, y, width, height) =>
    ipcRenderer.send("move-external-window", { windowId, x, y, width, height }),
  setClickThrough: (enable) => ipcRenderer.send("set-click-through", enable),
  askGhost: (prompt) => ipcRenderer.invoke("ask-ghost", prompt),
});
