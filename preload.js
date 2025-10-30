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
  getActiveWindow: () => ipcRenderer.invoke("get-active-window"),
  getWindows: () => ipcRenderer.invoke("get-windows"),

  minimizeExternal: (windowId) =>
    ipcRenderer.send("minimize-external-window", windowId),
  maximizeExternal: (windowId) =>
    ipcRenderer.send("maximize-external-window", windowId),
  moveExternal: (windowId, x, y, width, height) =>
    ipcRenderer.send("move-external-window", { windowId, x, y, width, height }),
  setClickThrough: (enable) => ipcRenderer.send("set-click-through", enable),
  askGhost: (prompt) => ipcRenderer.invoke("ask-ghost", prompt),

  // Auto ghost response listener
  onAutoGhostResponse: (callback) => {
    ipcRenderer.on("auto-ghost-response", (event, ghostResponse) => {
      callback(ghostResponse);
    });
  },

  // Window resize listener
  onResizeWindow: (callback) => {
    ipcRenderer.on("resize-window", (event, size) => {
      callback(size);
    });
  },
});
