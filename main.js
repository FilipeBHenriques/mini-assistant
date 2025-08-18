const { app, BrowserWindow, screen, ipcMain } = require("electron");
const path = require("path");

let mainWindow = null;
let currentDisplayIndex = 0;

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

  // Make window fill the entire monitor
  const windowWidth = width;
  const windowHeight = height;

  if (mainWindow) {
    // Update existing window

    mainWindow.setBounds({
      x: x,
      y: y,
      width: windowWidth,
      height: windowHeight,
    });
  } else {
    // Create new window
    mainWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: x,
      y: y,
      transparent: true,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      clickThrough: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, "preload.js"),
      },
      icon: path.join(__dirname, "public/logo192.png"),
      show: false,
    });

    // Load your index.html file
    mainWindow
      .loadFile(path.join(__dirname, "index.html"))
      .then(() => console.log("index.html loaded"))
      .catch((err) => console.error("Failed to load index.html:", err));

    // Show window when ready
    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
      // Make the entire window ignore mouse events
      //mainWindow.setIgnoreMouseEvents(true, { forward: true });
    });

    // Handle window closed
    mainWindow.on("closed", () => {
      // Dereference the window object
      mainWindow = null;
    });
  }

  currentDisplayIndex = displayIndex;

  // Log the actual window bounds
  const bounds = mainWindow.getBounds();
  console.log(
    `Window now on display ${displayIndex}: x=${bounds.x}, y=${bounds.y}, width=${bounds.width}, height=${bounds.height}`
  );
}

// Function to move window between displays
function moveToDisplay(displayIndex) {
  const displays = screen.getAllDisplays();
  if (!mainWindow || !displays[displayIndex]) return;

  console.log(`Switching to display ${displayIndex}`);
  createWindowOnDisplay(displayIndex);
}

// Function to cycle through displays
function cycleDisplay() {
  const displays = screen.getAllDisplays();
  const nextIndex = (currentDisplayIndex + 1) % displays.length;
  moveToDisplay(nextIndex);
}

// Function to switch to next display (called when circle hits border)
function switchToNextDisplay() {
  cycleDisplay();
}

// Function to switch to monitor in specific direction
function switchToMonitorInDirection(direction) {
  const displays = screen.getAllDisplays();
  if (displays.length <= 1) return;

  // Get current display bounds
  const currentDisplay = displays[currentDisplayIndex];
  const currentBounds = currentDisplay.bounds;

  console.log(
    `Current display: ${currentDisplayIndex} at (${currentBounds.x}, ${currentBounds.y})`
  );
  console.log(`Switching monitor due to ${direction} wall touch`);

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
      console.log(
        `Found ${direction} monitor: ${i} at (${targetBounds.x}, ${targetBounds.y})`
      );
      break;
    }
  }

  // If no monitor found in that direction, tell the renderer to bounce back
  if (targetDisplayIndex === -1) {
    console.log(`No ${direction} monitor found - should bounce back`);
    // Send message to renderer to bounce instead of switch
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("bounce-back", direction);
    }
  } else {
    console.log(`Switching to ${direction} monitor: ${targetDisplayIndex}`);
    moveToDisplay(targetDisplayIndex);
  }
}

// Set up IPC listeners
ipcMain.on("switch-monitor", () => {
  console.log("Received switch-monitor request from renderer");
  cycleDisplay();
});

// New IPC listener for directional switching
ipcMain.on("switch-monitor-direction", (event, direction) => {
  console.log(`Received directional switch request: ${direction}`);
  switchToMonitorInDirection(direction);
});

// Create window when Electron is ready
app.whenReady().then(createWindow);

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
  }
});

// Security: Prevent new window creation
app.on("web-contents-created", (event, contents) => {
  contents.on("new-window", (event, navigationUrl) => {
    event.preventDefault();
  });
});
