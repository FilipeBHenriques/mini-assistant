const { app, BrowserWindow, screen, ipcMain, Tray, Menu } = require("electron");
const { fetchWindows } = require("./utils.js");

const path = require("path");

const isDev = !app.isPackaged;

let mainWindow;
let tray = null;
let currentDisplayIndex = 0;
function createTray() {
  tray = new Tray(path.join(__dirname, "public/logo192.png"));
  console.log(`Creating Tray`);

  const contextMenu = Menu.buildFromTemplate([
    {
      label:
        mainWindow && mainWindow.isVisible() ? "Hide Overlay" : "Show Overlay",
      type: "checkbox",
      checked: true,
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip("My Overlay App");
  tray.setContextMenu(contextMenu);

  // Optional: click tray icon to toggle overlay
  tray.on("click", () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
}
function createWindow() {
  // Get all displays
  const displays = screen.getAllDisplays();

  console.log(`Found ${displays.length} displays`);

  // Start with the first display
  createWindowOnDisplay(0);
}
function createWindowOnDisplay(displayIndex) {
  const displays = screen.getAllDisplays();
  if (!displays[displayIndex]) return;

  const display = displays[displayIndex];
  const { x, y, width, height } = display.bounds;

  console.log(
    `Creating window on display ${displayIndex}: ${width}x${height} at (${x}, ${y})`
  );

  if (mainWindow) {
    mainWindow.setBounds({ x, y, width, height });
  } else {
    mainWindow = new BrowserWindow({
      width,
      height,
      x,
      y,
      transparent: true,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, "preload.js"),
      },
      icon: path.join(__dirname, "public/logo192.png"),
      show: false,
    });

    if (isDev) {
      mainWindow.loadURL("http://localhost:5173"); // Vite dev server
      mainWindow.webContents.openDevTools({ mode: "detach" });
    } else {
      mainWindow.loadFile(path.join(__dirname, "dist/index.html"));
    }

    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
      // Click-through overlay:
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
    });

    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  }

  currentDisplayIndex = displayIndex;
}

// Function to move window between displays
function moveToDisplay(displayIndex) {
  const displays = screen.getAllDisplays();
  if (!mainWindow || !displays[displayIndex]) return;

  createWindowOnDisplay(displayIndex);
}

// Function to cycle through displays
function cycleDisplay() {
  const displays = screen.getAllDisplays();
  const nextIndex = (currentDisplayIndex + 1) % displays.length;
  moveToDisplay(nextIndex);
}
ipcMain.on("minimize-external-window", (event, windowId) => {
  console.log("[minimize-external-window] called with windowId:", windowId);
  const windows = require("node-window-manager").windowManager.getWindows();
  console.log(
    "[minimize-external-window] Available windows:",
    windows.map((w) => ({ id: w.id, path: w.path, title: w.getTitle() }))
  );
  const target = windows.find((w) => w.path.includes(windowId));
  if (target) {
    console.log("[minimize-external-window] Minimizing window:", {
      id: target.id,
      path: target.path,
      title: target.getTitle(),
    });
    target.minimize(); // ✅ works here
  } else {
    console.log(
      "[minimize-external-window] No matching window found for windowId:",
      windowId
    );
  }
});

ipcMain.on(
  "move-external-window",
  (event, { windowId, x, y, width, height }) => {
    const windows = require("node-window-manager").windowManager.getWindows();
    const target = windows.find((w) => w.id === windowId);
    if (target) {
      target.setBounds({ x, y, width, height }); // ✅ works here
    }
  }
);

// Set up IPC listeners
ipcMain.on("switch-monitor", () => {
  cycleDisplay();
});
app.whenReady().then(() => {
  createWindow();
  createTray();

  // ✅ Immediately poll once
  (async () => {
    try {
      const processes = await fetchWindows();
      console.log("Open windows:", JSON.stringify(processes, null, 2));
      // Update NbWindows in renderer debug panel
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.executeJavaScript(
          `document.getElementById("NbWindows").textContent = "${processes.length}";`
        );
      }
    } catch (err) {
      console.error("Failed to get processes:", err);
    }
  })();

  setInterval(async () => {
    try {
      const windows = await fetchWindows();
      console.log("Open windows:", JSON.stringify(windows, null, 2));
    } catch (err) {
      console.error("Failed to get open windows:", err);
    }
  }, 30000); // every 30 seconds

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed
app.on("window-all-closed", () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    createTray();
  }
});

// Security: Prevent new window creation
app.on("web-contents-created", (event, contents) => {
  contents.on("new-window", (event, navigationUrl) => {
    event.preventDefault();
  });
});
