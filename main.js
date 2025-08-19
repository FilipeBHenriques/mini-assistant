const { app, BrowserWindow, screen, ipcMain, Tray, Menu } = require("electron");

const path = require("path");

let mainWindow = null;
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
      skipTaskbar: true, // 👈 Hides from taskbar
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, "preload.js"),
      },
      icon: path.join(__dirname, "public/logo192.png"),
      show: false,
    });

    mainWindow
      .loadFile(path.join(__dirname, "index.html"))
      .then(() => console.log("index.html loaded"))
      .catch((err) => console.error("Failed to load index.html:", err));

    mainWindow.once("ready-to-show", () => {
      mainWindow.show();

      // 👇 This makes the window 100% click-through
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

// Function to switch to monitor in specific direction
function switchToMonitorInDirection(direction) {
  const displays = screen.getAllDisplays();
  if (displays.length <= 1) return;

  // Get current display bounds
  const currentDisplay = displays[currentDisplayIndex];
  const currentBounds = currentDisplay.bounds;

  // Find the monitor in the specified direction
  let targetDisplayIndex = -1;

  for (let i = 0; i < displays.length; i++) {
    if (i === currentDisplayIndex) continue;

    const targetDisplay = displays[i];
    const targetBounds = targetDisplay.bounds;

    let isInDirection = false;

    switch (direction) {
      case "right":
        // Target monitor should be to the right (higher X coordinate)
        isInDirection = targetBounds.x > currentBounds.x;
        break;
      case "left":
        // Target monitor should be to the left (lower X coordinate)
        isInDirection = targetBounds.x < currentBounds.x;
        break;
      case "bottom":
        // Target monitor should be below (higher Y coordinate)
        isInDirection = targetBounds.y > currentBounds.y;
        break;
      case "top":
        // Target monitor should be above (lower Y coordinate)
        isInDirection = targetBounds.y < currentBounds.y;
        break;
    }

    if (isInDirection) {
      targetDisplayIndex = i;
      break;
    }
  }

  // If no monitor found in that direction, tell the renderer to bounce back
  if (targetDisplayIndex === -1) {
    // Send message to renderer to bounce instead of switch
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("bounce-back", direction);
    }
  } else {
    moveToDisplay(targetDisplayIndex);
  }
}

// Set up IPC listeners
ipcMain.on("switch-monitor", () => {
  cycleDisplay();
});

// New IPC listener for directional switching
ipcMain.on("switch-monitor-direction", (event, direction) => {
  switchToMonitorInDirection(direction);
});

// Create window when Electron is ready
app.whenReady().then(createWindow);
app.whenReady().then(createTray);

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
