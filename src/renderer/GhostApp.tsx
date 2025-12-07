import React, { useEffect, useState, useRef } from "react";
import ChatPopover from "./ChatPopover";
import GhostMessageBubble from "./GhostMessageBubble";
import MemeViewer from "./MemeViewer";

export default function GhostApp() {
  const [ghostMessage, setGhostMessage] = useState("");
  const [ghostIcon, setGhostIcon] = useState<string | null>(null);
  const [bubblePos, setBubblePos] = useState({ x: 0, y: 0 });
  const [displayedMessage, setDisplayedMessage] = useState("");
  const [showMemeViewer, setShowMemeViewer] = useState(false);
  const [nsfwMode, setNsfwMode] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const messageTimerRef = useRef<number | null>(null);

  // Setup window.setGhostMessage once on mount
  useEffect(() => {
    const setGhostMessageFn = (
      msg: string,
      icon?: string | null,
      durationMs: number = 5000
    ) => {
      // Clear any existing timers
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current);
        messageTimerRef.current = null;
      }

      // Set the full message (hidden)
      setGhostMessage(msg);
      setDisplayedMessage("");

      // Convert icon path
      if (icon) {
        try {
          const fileUrl = (window as any).electronAPI?.pathToFileURL?.(icon);
          setGhostIcon(fileUrl || icon);
        } catch (e) {
          console.warn("Failed to convert icon path:", e);
          setGhostIcon(icon);
        }
      } else {
        setGhostIcon(null);
      }

      // Start typing effect
      if (msg) {
        let currentIndex = 0;
        typingTimerRef.current = window.setInterval(() => {
          if (currentIndex < msg.length) {
            setDisplayedMessage(msg.slice(0, currentIndex + 1));
            currentIndex++;
          } else {
            if (typingTimerRef.current) {
              clearInterval(typingTimerRef.current);
              typingTimerRef.current = null;
            }

            // Set timer to clear message after duration (if duration > 0)
            if (durationMs > 0) {
              messageTimerRef.current = window.setTimeout(() => {
                setGhostMessage("");
                setDisplayedMessage("");
                setGhostIcon(null);
                messageTimerRef.current = null;
              }, durationMs);
            }
          }
        }, 30); // 30ms per character
      }
    };

    (window as any).setGhostMessage = setGhostMessageFn;
    console.log("Window.setGhostMessage initialized with typing effect");

    return () => {
      delete (window as any).setGhostMessage;
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    };
  }, []);

  useEffect(() => {
    import("../ghost.js").catch((err) =>
      console.error("Failed to load legacy ghost module:", err)
    );
  }, []);

  useEffect(() => {
    const updateBubblePosition = () => {
      const ghostDragArea = document.getElementById("ghost-drag-area");
      if (ghostDragArea) {
        const rect = ghostDragArea.getBoundingClientRect();
        setBubblePos({
          x: rect.right + 20,
          y: rect.top - 80,
        });
      }
      animationFrameRef.current = requestAnimationFrame(updateBubblePosition);
    };

    animationFrameRef.current = requestAnimationFrame(updateBubblePosition);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
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
            (async () => {
              try {
                const msg = await (window as any).electronAPI?.launchApp?.(arg);
                if (msg && msg.message) {
                  (window as any).setGhostMessage?.(
                    msg.message,
                    msg.icon,
                    5000
                  );
                } else {
                  (window as any).setGhostMessage?.("Launching...", null, 2000);
                }
              } catch (e) {
                console.warn("Failed to run /open", e);
                (window as any).setGhostMessage?.(
                  "No App Found...",
                  null,
                  3000
                );
              }
            })();
          }}
          onMemeCommand={(arg) => {
            console.log("/meme", arg);
            // Check for --nsfw flag
            const nsfw = arg?.toLowerCase().includes("--nsfw");
            setNsfwMode(nsfw);
            setShowMemeViewer(true);
          }}
          onAskCommand={(arg) => {
            console.log("/ask", arg);
            try {
              (window as any).setGhostMessage?.("Thinking...", null, 0);

              const response = (window as any).electronAPI?.askGhost?.(arg);
              response?.then((answer: string) => {
                console.log("Got response:", answer);
                if (answer) {
                  (window as any).setGhostMessage?.(answer, null, 10000);
                }
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

      {displayedMessage && (
        <div
          style={{
            position: "fixed",
            left: `${bubblePos.x}px`,
            top: `${bubblePos.y}px`,
            zIndex: 8,
            pointerEvents: "none",
          }}
        >
          <GhostMessageBubble
            message={displayedMessage}
            icon={ghostIcon}
            onComplete={() => {}}
          />
        </div>
      )}

      {showMemeViewer && (
        <MemeViewer nsfw={nsfwMode} onClose={() => setShowMemeViewer(false)} />
      )}

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
