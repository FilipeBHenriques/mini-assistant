import React, { useEffect } from "react";
import ChatPopover from "./ChatPopover";

export default function GhostApp() {
  useEffect(() => {
    // Load legacy renderer to wire up Three.js and behaviors. The legacy script expects
    // elements with specific ids (ghost-canvas, ghost-drag-area, debug), so we render
    // those below and then import the legacy module so it can find them.
    import("../ghost.js").catch((err) =>
      console.error("Failed to load legacy ghost module:", err)
    );
    // Intentionally no cleanup: legacy module manages its own lifecycle
  }, []);

  return (
    <div
      style={{ width: "100%", height: "100%", margin: 0, position: "relative" }}
    >
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          padding: 8,
          pointerEvents: "auto",
          zIndex: 10,
          background: "transparent",
        }}
      >
        <ChatPopover
          onOpenCommand={(arg) => {
            console.log("/open", arg);
            try {
              (window as any).electronAPI?.launchApp?.(arg);
            } catch (e) {
              console.warn("Failed to run /open", e);
            }
          }}
          onMemeCommand={(arg) => {
            console.log("/meme", arg);
            try {
              (window as any).electronAPI?.askGhost?.(`meme ${arg}`);
            } catch (e) {
              console.warn("Failed to run /meme", e);
            }
          }}
          onAskCommand={(arg) => {
            console.log("/ask", arg);
            try {
              window?.setGhostMessage?.("hmmm...");

              const response = (window as any).electronAPI?.askGhost?.(arg);
              response?.then((answer: string) => {
                window.setGhostMessage(answer);
              });
            } catch (e) {
              console.warn("Failed to run /ask", e);
            }
          }}
        />
      </div>

      <div
        id="ghost-drag-area"
        style={{
          position: "fixed",
          width: 100,
          height: 100,
          background: "rgba(255,0,0,0.2)",
          border: "2px dashed rgba(255,0,0,0.6)",
          borderRadius: "50%",
          pointerEvents: "auto",
          cursor: "grab",
          zIndex: 5,
          opacity: 0.3,
        }}
      />

      <canvas
        id="ghost-canvas"
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          border: "3px solid red",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
