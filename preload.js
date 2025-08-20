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
  // Listen for bounce-back messages
  onBounceBack: (callback) => {
    ipcRenderer.on("bounce-back", (event, direction) => {
      callback(direction);
    });
  },

  getProcesses: () => ipcRenderer.invoke("get-process-list"),
});
