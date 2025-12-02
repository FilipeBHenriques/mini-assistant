const {
  app,
  BrowserWindow,
  screen,
  ipcMain,
  dialog,
  Tray,
  Menu,
  protocol,
  net,
} = require("electron");
const {
  fetchWindows,
  minimizeWindowbyId,
  maximizeWindowbyId,
  getActiveWindow,
  getDesktopIdleDuration,
  animateWindowToRandomDisplayPosition,
  ghostMouseGrab,
} = require("./utils.js");
const { tools } = require("../mini-assistant/src/aiTools.js");
const fs = require("fs");

const { exec } = require("child_process");
const { getInstalledApps } = require("get-installed-apps");
// Duplicate import of "open" removed. (Already imported above.)

ipcMain.handle("launch-app", async (event, exePath) => {
  return new Promise((resolve, reject) => {
    const command = `start "" "${exePath}"`;
    exec(command, (err) => {
      if (err) reject(err);
      else resolve("Launched!");
    });
  });
});

const OpenAI = require("openai");

const ollama = new OpenAI({
  baseURL: "http://localhost:11434/v1",
  apiKey: "none",
});

const path = require("path");

// Register the scheme as privileged BEFORE app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: "local-file",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

const isDev = !app.isPackaged;

let mainWindow;
let tray = null;
let currentDisplayIndex = 0;
let lastActiveWindow = null;
let settingsWindow = null;

let currentDisplay = null;

function updateCurrentDisplay() {
  const displays = screen.getAllDisplays();
  if (displays[currentDisplayIndex]) {
    currentDisplay = displays[currentDisplayIndex];
  }
}

function getWindowDisplay(windowBounds) {
  const displays = screen.getAllDisplays();

  const centerX = windowBounds.x + windowBounds.width / 2;
  const centerY = windowBounds.y + windowBounds.height / 2;

  for (let i = 0; i < displays.length; i++) {
    const display = displays[i];
    const bounds = display.bounds;

    if (
      centerX >= bounds.x &&
      centerX < bounds.x + bounds.width &&
      centerY >= bounds.y &&
      centerY < bounds.y + bounds.height
    ) {
      return { display, index: i };
    }
  }

  return { display: screen.getPrimaryDisplay(), index: 0 };
}

function getPointDisplay(x, y) {
  const displays = screen.getAllDisplays();

  for (let i = 0; i < displays.length; i++) {
    const display = displays[i];
    const bounds = display.bounds;

    if (
      x >= bounds.x &&
      x < bounds.x + bounds.width &&
      y >= bounds.y &&
      y < bounds.y + bounds.height
    ) {
      return { display, index: i };
    }
  }

  return { display: screen.getPrimaryDisplay(), index: 0 };
}

ipcMain.handle("check-same-display-as-window", async (event, windowId) => {
  const windows = await fetchWindows();
  const targetWindow = windows.find((w) => w.id === windowId);

  if (!targetWindow) return { same: false, targetDisplayIndex: null };

  const windowDisplay = getWindowDisplay(targetWindow.bounds);
  const isSame = windowDisplay.index === currentDisplayIndex;

  return {
    same: isSame,
    targetDisplayIndex: windowDisplay.index,
    ghostDisplayIndex: currentDisplayIndex,
  };
});

ipcMain.handle("check-same-display-as-cursor", async () => {
  const cursorPos = screen.getCursorScreenPoint();
  const cursorDisplay = getPointDisplay(cursorPos.x, cursorPos.y);
  const isSame = cursorDisplay.index === currentDisplayIndex;

  return {
    same: isSame,
    targetDisplayIndex: cursorDisplay.index,
    ghostDisplayIndex: currentDisplayIndex,
    cursorPos,
  };
});

function createTray() {
  tray = new Tray(path.join(__dirname, "public/logo192.png"));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Settings...",
      click: () => {
        openSettingsWindow();
      },
    },
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

function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: true,
    modal: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  if (isDev) {
    settingsWindow.loadURL("http://localhost:5173/settings.html");
    settingsWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    settingsWindow.loadFile(path.join(__dirname, "dist/settings.html"));
  }
  settingsWindow.once("ready-to-show", () => settingsWindow.show());
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}
function createWindow() {
  // Get all displays
  const displays = screen.getAllDisplays();

  console.log(`Found ${displays.length} displays`);

  // Start with the first display
  createWindowOnDisplay(1);
}

function createWindowOnDisplay(displayIndex) {
  const displays = screen.getAllDisplays();
  if (!displays[displayIndex]) return;

  const display = displays[displayIndex];
  const { x, y, width, height, inne } = display.workArea; // or workAreaSize
  const scale = display.scaleFactor;

  console.log(
    `Creating window on display ${displayIndex}: ${width}x${height} at (${x}, ${y})`
  );

  if (mainWindow) {
    // Move & resize the window
    console.log("width height2", width, height, width / scale, height / scale);
    mainWindow.setBounds(display.workArea);
    // Send new size to renderer so it can update Three.js
    mainWindow.webContents.send("resize-window", { width, height });
  } else {
    console.log("width height", width, height, width / scale, height / scale);
    mainWindow = new BrowserWindow({
      width: width / scale,
      height: height / scale,
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

    // Make it appear over fullscreen borderless windows IMPORTANT
    mainWindow.setAlwaysOnTop(true, "screen-saver");
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    if (isDev) {
      mainWindow.loadURL("http://localhost:5173"); // Vite dev server
      mainWindow.webContents.openDevTools({ mode: "detach" });
    } else {
      mainWindow.loadFile(path.join(__dirname, "dist/index.html"));
    }

    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
      // Enable selective click-through: most of window is click-through, but drag area works IMPORTANT
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
    });

    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  }

  currentDisplayIndex = displayIndex;
  updateCurrentDisplay(); // Add this line
}

ipcMain.on("move-ghost-to-display", (event, displayIndex) => {
  moveToDisplay(displayIndex);
});

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
  minimizeWindowbyId(windowId);
});
ipcMain.on("maximize-external-window", (event, windowId) => {
  maximizeWindowbyId(windowId);
});

ipcMain.handle("get-active-window", async () => {
  // Use whatever window manager or API you have:
  const win = getActiveWindow(); // example
  if (!win) return null;
  return win;
});

ipcMain.handle("get-windows", async () => {
  const windows = await fetchWindows();
  return windows;
});

// Dynamic click-through control for selective interaction
ipcMain.on("set-click-through", (event, enable) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(enable, { forward: true });
  }
});

ipcMain.on("move-external-window", (event, { windowId }) => {
  animateWindowToRandomDisplayPosition(windowId, screen);
});

const userDataPath = app.getPath("userData");
const SETTINGS_FILE = path.join(userDataPath, "ghost-settings.json");

ipcMain.handle("save-settings", async (event, settings) => {
  try {
    // Convert custom model path to local-file:// URL before saving
    if (settings?.model?.type === "custom" && settings.model.path) {
      // Only convert if it's not already a local-file:// URL
      if (!settings.model.path.startsWith("local-file://")) {
        let normalizedPath = settings.model.path.replace(/\\/g, "/");

        // Ensure drive letter has colon (C: not C/)
        if (normalizedPath.match(/^[a-zA-Z]\//)) {
          normalizedPath =
            normalizedPath.charAt(0) + ":" + normalizedPath.slice(1);
        }

        settings.model.path = `local-file:///${normalizedPath}`;
      }
    }

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send("settings-saved");
    });
    return true;
  } catch (err) {
    console.error("Failed to save settings:", err);
    return false;
  }
});

ipcMain.handle("load-settings", async () => {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return null;
    const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to load settings:", err);
    return null;
  }
});

// Add the select-model-file handler
ipcMain.handle("select-model-file", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select 3D Model",
    filters: [
      { name: "3D Models", extensions: ["glb", "gltf"] },
      { name: "All Files", extensions: ["*"] },
    ],
    properties: ["openFile"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

// Set up IPC listeners
ipcMain.on("switch-monitor", () => {
  cycleDisplay();
});

// In main.js, update the IPC listener:
ipcMain.on(
  "ghost-grab-mouse",
  (
    event,
    {
      durationMs = 3000,
      pullDistance = 30,
      targetX,
      targetY,
      corner = null,
      behavior = null,
      displayIndex = null, // ✅ NEW: Pass the display index
    }
  ) => {
    // ✅ Get the bounds of the target display
    const displays = screen.getAllDisplays();
    const targetDisplay =
      displayIndex !== null
        ? displays[displayIndex]
        : displays[currentDisplayIndex];

    if (!targetDisplay) {
      console.warn("Invalid display for mouse grab");
      return;
    }

    ghostMouseGrab(
      (pos) => {
        event.sender.send("ghost-move-coords", {
          x: Math.round(pos.x),
          y: Math.round(pos.y),
        });
      },
      durationMs,
      pullDistance,
      targetX,
      targetY,
      corner,
      behavior,
      targetDisplay.bounds // ✅ Pass display bounds to ghostMouseGrab
    );
  }
);

app.whenReady().then(() => {
  protocol.handle("local-file", (request) => {
    let filePath = request.url.replace("local-file://", "");

    // Remove leading slashes
    filePath = filePath.replace(/^\/+/, "");

    // Fix Windows drive letter (c/Users -> C:/Users)
    if (filePath.match(/^[a-zA-Z]\//)) {
      filePath = filePath.charAt(0).toUpperCase() + ":" + filePath.slice(1);
    }

    filePath = decodeURIComponent(filePath);

    console.log("Protocol handler loading:", filePath);

    // Return the file using net.fetch with proper file:// URL
    return net.fetch(`file:///${filePath}`);
  });
  createWindow();
  createTray();

  // ✅ Immediately poll once
  (async () => {
    try {
      const processes = await fetchWindows();
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
    } catch (err) {
      console.error("Failed to get open windows:", err);
    }
  }, 30000); // every 30 seconds

  // Auto-run ASJ ghost every 30 seconds
  setInterval(async () => {
    try {
      const activeWindow = await getActiveWindow();
      const allWindows = await fetchWindows();
      const isIdle = await getDesktopIdleDuration();
      const availableTools = Object.entries(tools).map(
        ([name, { description, parameters }]) => ({
          name,
          description,
          parameters,
        })
      );

      // Compose a system prompt that describes the ghost AI and available tools
      const systemPrompt = `
    You are a ghost AI living inside the computer.
    You ALWAYS should act only by using these tools:
    ${availableTools
      .map(
        (t) =>
          `- ${t.name}: ${t.description}. Args: ${JSON.stringify(
            t.parameters?.properties || {},
            null,
            0
          )}`
      )
      .join("\n")}

    `;

      // Compose a prompt for the AI based on the active window and all open windows
      let promptMsg =
        systemPrompt +
        "Based on the following information, tell me if the user is procrastinating, working, or just vibing. Be concise and explain your reasoning.\n";
      promptMsg += `User has been idle for ${isIdle} minutes\n`;
      promptMsg += "Active window:\n";
      if (activeWindow) {
        if (activeWindow.title && activeWindow.title.trim() !== "") {
          promptMsg += `- Title: ${activeWindow.title}\n- App: ${activeWindow.path}\n`;
        } else {
          promptMsg += `- App: ${activeWindow.path}\n`;
        }
      } else {
        promptMsg += "- No active window detected.\n";
      }
      promptMsg += "Other open windows:\n";
      allWindows.forEach((w) => {
        if (w.title && w.title.trim() !== "") {
          promptMsg += `- Title: ${w.title} | App: ${w.path}\n`;
        } else {
          promptMsg += `- App: ${w.path}\n`;
        }
      });
      promptMsg += `
      Classify the user's current state as one of the following:
      - "procrastinating"
      - "working"
      - "vibing"

      Respond in JSON format like this (tools are mandatory):
      {
        "state": "<one of the three>",
        "reasoning": "<short explanation>"
        "tool": "<tool name from list>"
        "args" "<JSON with args needed to call the tool>"
      }`;

      const res = await ollama.chat.completions.create({
        model: "mistral",
        messages: [
          // { role: "system", content: systemPrompt },
          { role: "user", content: promptMsg },
          { role: "system", content: JSON.stringify({ tools }) },
        ],
      });

      const ghostResponse = res.choices[0].message.content;
      console.log("👻 Auto Ghost says:", ghostResponse);

      // Send the response to the renderer process
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send("auto-ghost-response", ghostResponse);
      }
    } catch (err) {
      console.error("Auto ASJ ghost error:", err);
    }
  }, 10000); // every 30 seconds

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
