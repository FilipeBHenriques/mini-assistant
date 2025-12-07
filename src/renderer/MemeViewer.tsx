import React, { useState, useEffect } from "react";
import { X, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  nsfw?: boolean;
  onClose: () => void;
};

interface Meme {
  title: string;
  image: string;
  source?: string;
}

export default function MemeViewer({ nsfw = false, onClose }: Props) {
  const [meme, setMeme] = useState<Meme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeme = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`https://meme-api.com/gimme`);
      const memeData = await res.json();

      console.log("Fetched meme data:", memeData);
      if (memeData && memeData.title && memeData.url) {
        setMeme({
          title: memeData.title,
          image: memeData.url,
        });
      } else {
        setError("Failed to fetch meme data");
      }
    } catch (err) {
      console.error("Error fetching meme:", err);
      setError(
        `Error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeme();
  }, [nsfw]);

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 1000,
        pointerEvents: "auto",
      }}
      onMouseEnter={() => {
        (window as any).electronAPI?.setClickThrough(false);
      }}
      onMouseLeave={() => {
        (window as any).electronAPI?.setClickThrough(true);
      }}
    >
      {/* Backdrop */}
      <div
        onClick={() => {
          (window as any).electronAPI?.setClickThrough(true);
          onClose();
        }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          zIndex: 999,
          pointerEvents: "auto",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "relative",
          zIndex: 1001,
          backgroundColor: "#1e293b",
          borderRadius: "16px",
          padding: "24px",
          maxWidth: "600px",
          width: "90vw",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          animation: "slideIn 0.3s ease-out",
          pointerEvents: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h2
            style={{
              color: "#f1f5f9",
              fontSize: "18px",
              fontWeight: "600",
              margin: 0,
            }}
          >
            {nsfw ? "🔞 NSFW Meme" : "😂 Random Meme"}
          </h2>
          <button
            onClick={() => {
              (window as any).electronAPI?.setClickThrough(true);
              onClose();
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = "#f1f5f9")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = "#94a3b8")
            }
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            minHeight: "300px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            pointerEvents: "auto",
          }}
        >
          {loading ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <Loader2
                size={32}
                style={{
                  color: "#a855f7",
                  animation: "spin 1s linear infinite",
                }}
              />
              <p style={{ color: "#94a3b8" }}>Loading meme...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: "center" }}>
              <p style={{ color: "#ef4444", marginBottom: "12px" }}>{error}</p>
              <Button
                onClick={fetchMeme}
                style={{
                  background:
                    "linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)",
                  color: "white",
                }}
              >
                <RotateCw size={16} style={{ marginRight: "8px" }} />
                Retry
              </Button>
            </div>
          ) : meme ? (
            <>
              <img
                src={meme.image}
                alt={meme.title}
                style={{
                  maxWidth: "100%",
                  maxHeight: "400px",
                  borderRadius: "8px",
                  objectFit: "contain",
                  animation: "fadeIn 0.3s ease-out",
                }}
              />
              <p
                style={{
                  color: "#cbd5e1",
                  fontSize: "14px",
                  textAlign: "center",
                  margin: "0",
                  fontStyle: "italic",
                }}
              >
                {meme.title}
              </p>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginTop: "20px",
            justifyContent: "space-between",
            pointerEvents: "auto",
          }}
        >
          <Button
            onClick={fetchMeme}
            disabled={loading}
            style={{
              background: "linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)",
              color: "white",
              flex: 1,
            }}
          >
            <RotateCw size={16} style={{ marginRight: "8px" }} />
            Next Meme
          </Button>
          <Button
            onClick={() => {
              (window as any).electronAPI?.setClickThrough(true);
              onClose();
            }}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              color: "#f1f5f9",
              border: "1px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            Close
          </Button>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
