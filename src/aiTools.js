// Helper function to ensure ghost is on correct display
async function ensureGhostOnSameDisplay(ctx, targetType, targetId = null) {
  let displayCheck;

  if (targetType === "cursor") {
    displayCheck = await ctx.mainWindow.checkSameDisplayAsCursor();
  } else if (targetType === "window" && targetId) {
    displayCheck = await ctx.mainWindow.checkSameDisplayAsWindow(targetId);
  } else {
    console.warn("Invalid targetType or missing targetId");
    return false;
  }

  if (!displayCheck.same) {
    console.log(
      `🔄 Moving ghost to display ${displayCheck.targetDisplayIndex}`
    );
    ctx.mainWindow.moveGhostToDisplay(displayCheck.targetDisplayIndex);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return true; // Ghost moved
  }

  return false; // Already on same display
}

export const tools = {
  say: {
    description:
      "Display a speech bubble above the ghost with your chosen message. Speak in the ghost's playful or mischievous personality. Use brief, encouraging, funny, or motivational lines to guide, cheer up, or gently scold the user based on their activity.",
    parameters: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
    run: async ({ message }, ctx) => {
      if (ctx.setGhostMessage) ctx.setGhostMessage(message);
      return { success: true };
    },
  },
  minimizeActiveWindow: {
    description: "Minimize the currently active window.",
    parameters: { type: "object", properties: {}, required: [] },
    run: async (_args, ctx) => {
      if (ctx.getActiveWindow && ctx.minimizeActiveWindow) {
        const activeWindow = await ctx.getActiveWindow();
        if (activeWindow && activeWindow.id) {
          await ensureGhostOnSameDisplay(ctx, "window", activeWindow.id);
          ctx.minimizeActiveWindow(activeWindow.id);
        } else {
          console.warn("No active window to minimize");
        }
      }
      return { success: true };
    },
  },
  maximizeRandomWindow: {
    description: "Maximize a random open window.",
    parameters: { type: "object", properties: {}, required: [] },
    run: async (_args, ctx) => {
      if (ctx.getWindows && ctx.maximizeRandomWindow) {
        const windows = await ctx.getWindows();
        if (windows && windows.length > 0) {
          const randomWindow =
            windows[Math.floor(Math.random() * windows.length)];
          await ensureGhostOnSameDisplay(ctx, "window", randomWindow.id);
          ctx.maximizeRandomWindow(randomWindow.id);
        } else {
          console.warn("No windows available to maximize");
        }
      }
      return { success: true };
    },
  },
  smoothMoveActiveWindowToRandomPosition: {
    description:
      "Smoothly move the currently active window to a random (x, y) position within the current screen.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    run: async (_args, ctx) => {
      if (ctx.getActiveWindow && ctx.smoothMoveActiveWindowToRandomPosition) {
        const activeWindow = await ctx.getActiveWindow();
        if (activeWindow && activeWindow.id && activeWindow.bounds) {
          await ensureGhostOnSameDisplay(ctx, "window", activeWindow.id);
          const { width, height } = activeWindow.bounds;
          const { x: dx, y: dy, width: dw, height: dh } = activeWindow.bounds;
          const maxX = dw - width;
          const maxY = dh - height;
          const randX = dx + Math.floor(Math.random() * (maxX + 1));
          const randY = dy + Math.floor(Math.random() * (maxY + 1));
          ctx.smoothMoveActiveWindowToRandomPosition(
            activeWindow.id,
            randX,
            randY
          );
          return { success: true };
        } else {
          console.warn(
            "No active window with bounds/displayBounds to move.",
            activeWindow
          );
          return { success: false, error: "No active window or bounds info" };
        }
      } else {
        console.warn(
          "Required context functions (getActiveWindow/moveExternal) not available"
        );
        return { success: false, error: "Context methods not available" };
      }
    },
  },

  grabMouse: {
    description:
      "Have the ghost grab and move the user's mouse toward a target, or pull it around playfully.",
    parameters: {
      type: "object",
      properties: {
        durationMs: {
          type: "integer",
          description:
            "Number of milliseconds to grab the mouse (default: 3000)",
        },
        pullDistance: {
          type: "integer",
          description: "How far to pull the mouse (default: 30 pixels)",
        },
      },
      required: [],
    },
    run: async (args, ctx) => {
      if (ctx.grabMouse) {
        // Check display and move ghost
        const displayCheck = await ensureGhostOnSameDisplay(ctx, "cursor");

        // ✅ Pass the display index to grabMouse
        return await ctx.grabMouse({
          ...args,
          displayIndex: displayCheck ? displayCheck.targetDisplayIndex : null,
        });
      } else {
        console.warn("Mouse grab not available in this context");
        return { success: false, error: "mouse grab not implemented in ctx" };
      }
    },
  },
};
