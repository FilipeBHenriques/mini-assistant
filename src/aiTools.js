export const tools = {
  setGhostState: {
    description: "Changes the ghost's animation state.",
    parameters: {
      type: "object",
      properties: {
        state: { type: "string", enum: ["Chill", "Angry", "Sleeping"] },
      },
      required: ["state"],
    },
    run: async ({ state }, ctx) => {
      if (ctx.setGhostState) ctx.setGhostState(state); // <-- call the local function
      return { success: true };
    },
  },

  say: {
    description: "Make the ghost speak a message bubble.",
    parameters: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
    run: async ({ message }, ctx) => {
      console.log(`💬 Ghost says: ${message}`);
      ctx.mainWindow.webContents.send("ghost-speak", message);
      return { success: true };
    },
  },
};
