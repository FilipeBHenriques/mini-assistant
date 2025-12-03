import React, { useEffect } from "react";

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
    <div style={{ width: "100%", height: "100%", margin: 0 }}>
      <div
        id="debug"
        style={{
          position: "fixed",
          top: 10,
          left: 10,
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          font: "12px monospace",
          padding: "6px 8px",
          borderRadius: 6,
          zIndex: 10,
          pointerEvents: "auto",
        }}
      >
        pos: <span id="pos">0,0</span>
        <br />
        windows: <span id="NbWindows">0</span>
        <br />
        runningFN: <span id="debugFunction">---</span>
        <br />
        <b>Controls:</b>
        <ul
          style={{
            margin: "4px 0 0 16px",
            padding: 0,
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          <li>
            <b>Space</b>: Switch monitor
          </li>
          <li>
            <b>M</b>: Minimize active window
          </li>
          <li>
            <b>Arrows</b> or <b>WASD</b>: Move ghost
          </li>
          <li>
            <b>P</b>: Change ghost state
          </li>
        </ul>
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
