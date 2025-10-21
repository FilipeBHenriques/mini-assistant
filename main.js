const { app, BrowserWindow, screen, ipcMain, Tray, Menu } = require("electron");
const {
  fetchWindows,
  minimizeWindowbyId,
  maximizeWindowbyId,
  smoothMoveWindowById,
  getActiveWindow,
  getDesktopIdleDuration,
} = require("./utils.js");
const { tools } = require("../mini-assistant/src/aiTools.js");

const OpenAI = require("openai");

const ollama = new OpenAI({
  baseURL: "http://localhost:11434/v1",
  apiKey: "none",
});

const path = require("path");

const isDev = !app.isPackaged;

let mainWindow;
let tray = null;
let currentDisplayIndex = 0;
let lastActiveWindow = null; // Store the last active window that isn't the overlay
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
    // Move & resize the window
    mainWindow.setBounds({ x, y, width, height });
    // Send new size to renderer so it can update Three.js
    mainWindow.webContents.send("resize-window", { width, height });
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
      // Enable selective click-through: most of window is click-through, but drag area works
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
  minimizeWindowbyId(windowId);
});
ipcMain.on("maximize-external-window", (event, windowId) => {
  maximizeWindowbyId(windowId);
});

ipcMain.handle("get-process-list", async () => {
  const windows = await fetchWindows();
  return windows;
});

const movingWindows = new Map();

function startSmoothMovement(windowId) {
  if (movingWindows.has(windowId)) return;

  const target = fetchWindows().find((w) => w.path.includes(windowId));
  if (!target || !target.window) {
    console.warn(`[startSmoothMovement] No window found for ${windowId}`);
    return;
  }

  const win = target.window;

  // Use an object for mutable velocity
  const velocity = { x: 0, y: 0 };

  const interval = setInterval(() => {
    const bounds = win.getBounds();
    win.setBounds({
      x: bounds.x + velocity.x,
      y: bounds.y + velocity.y,
      width: bounds.width,
      height: bounds.height,
    });
  }, 8);

  movingWindows.set(windowId, { interval, velocity });
}

// Dynamic click-through control for selective interaction
ipcMain.on("set-click-through", (event, enable) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(enable, { forward: true });
    console.log(`🖱️ Click-through ${enable ? "enabled" : "disabled"}`);
  }
});

ipcMain.on("move-external-window", (event, { windowId, x, y }) => {
  if (!movingWindows.has(windowId)) startSmoothMovement(windowId);
  const data = movingWindows.get(windowId);
  data.velocity.x = x;
  data.velocity.y = y;
});

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

  // Auto-run ASJ ghost every 30 seconds
  setInterval(async () => {
    try {
      console.log("🤖 Auto-running ASJ ghost...");
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
    You should act using these tools:
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

      console.log("Prompt:", promptMsg);

      const res = await ollama.chat.completions.create({
        model: "mistral",
        messages: [
          // { role: "system", content: systemPrompt },
          { role: "user", content: promptMsg },
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
