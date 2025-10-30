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
      // Ask the main process for the currently active window
      if (ctx.getActiveWindow && ctx.minimizeActiveWindow) {
        const activeWindow = await ctx.getActiveWindow();
        if (activeWindow && activeWindow.id) {
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
          const { width, height } = activeWindow.bounds;
          const { x: dx, y: dy, width: dw, height: dh } = activeWindow.bounds;
          // Calculate random position that stays within screen bounds
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
};
