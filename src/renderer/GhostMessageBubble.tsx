import React, { useState, useEffect } from "react";

type Props = {
  message: string;
  icon?: string | null;
  onComplete?: () => void;
};

export default function GhostMessageBubble({
  message,
  icon,
  onComplete,
}: Props) {
  const [displayedText, setDisplayedText] = useState("");
  const [showIcon, setShowIcon] = useState(false);
  const [iconLoaded, setIconLoaded] = useState(false);
  const [iconError, setIconError] = useState(false);
  useEffect(() => {
    console.log("Message updated:", message);
  }, [message]);
  // Letter-by-letter typing effect - DISABLED FOR TESTING
  useEffect(() => {
    if (!message) {
      setDisplayedText("");
      setShowIcon(false);
      setIconLoaded(false);
      setIconError(false);
      return;
    }

    // Show full text immediately (no typing animation)
    setDisplayedText(message);

    // Show icon immediately
    setShowIcon(true);
    onComplete?.();
  }, [message, onComplete]);

  if (!message) return null;

  return (
    <div
      style={{
        maxWidth: "240px",
        padding: "12px 16px",
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.92) 100%)",
        color: "#1a1a1a",
        fontFamily: "'Inter', sans-serif",
        fontSize: "15px",
        fontWeight: "500",
        borderRadius: "18px",
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)",
        border: "1.5px solid rgba(255,255,255,0.5)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        textAlign: "left",
        pointerEvents: "none",
        position: "relative",
        animation: "fadeInScale 0.3s ease-out",
      }}
    >
      {/* Text container with typing effect */}
      <div
        style={{
          minHeight: "20px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ flex: 1 }}>{displayedText}</span>

        {/* Icon - slow fade in after text completes */}
        {showIcon && icon && !iconError && (
          <img
            src={icon}
            alt="app icon"
            onLoad={() => setIconLoaded(true)}
            onError={() => {
              console.warn("Failed to load icon:", icon);
              setIconError(true);
            }}
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "4px",
              animation: "slowIconFadeIn 0.8s ease-out",
              flexShrink: 0,
              opacity: iconLoaded ? 1 : 0.5,
            }}
          />
        )}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes slowIconFadeIn {
          from {
            opacity: 0;
            transform: scale(0.8) rotate(-15deg);
          }
          to {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }

        /* Typing cursor blink effect */
        @keyframes blink {
          0%,
          49% {
            opacity: 1;
          }
          50%,
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
