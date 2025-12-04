import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Props = {
  onOpenCommand?: (arg: string) => void;
  onMemeCommand?: (arg: string) => void;
  onAskCommand?: (arg: string) => void;
};

type ChatPopoverProps = Props & {
  className?: string;
};

const COMMANDS = [
  { value: "/open", label: "/open", description: "Open an application" },
  { value: "/meme", label: "/meme", description: "Generate a meme" },
  { value: "/ask", label: "/ask", description: "Ask a question" },
];

export default function ChatPopover({
  onOpenCommand,
  onMemeCommand,
  onAskCommand,
  className = "",
}: ChatPopoverProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [showCommand, setShowCommand] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<string | null>(null);

  const filteredCommands = COMMANDS.filter((cmd) =>
    cmd.value.startsWith(value)
  );

  useEffect(() => {
    setShowCommand(value.startsWith("/") && value.length > 0);
    setSelectedIndex(0);
  }, [value]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  function handleCommandSelect(commandValue: string) {
    setValue(commandValue + " ");
    setShowCommand(false);
    inputRef.current?.focus();
  }

  async function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;

    const parts = trimmed.split(" ");
    const cmd = parts[0];
    const arg = parts.slice(1).join(" ");

    if (cmd === "/open") {
      onOpenCommand?.(arg);
    } else if (cmd === "/meme") {
      onMemeCommand?.(arg);
    } else if (cmd === "/ask") {
      onAskCommand?.(arg);
    } else {
      console.log("chat message:", trimmed);
    }
    (window as any).electronAPI?.setClickThrough(true);
    setValue("");
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (showCommand && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleCommandSelect(filteredCommands[selectedIndex].value);
      } else if (e.key === "Escape") {
        setShowCommand(false);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div
      className={className || "fixed right-6 bottom-6 z-50"}
      style={{ pointerEvents: "auto" }}
      onMouseEnter={() => {
        (window as any).electronAPI?.setClickThrough(false);
      }}
      onMouseLeave={() => {
        (window as any).electronAPI?.setClickThrough(true);
      }}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="lg"
            style={{
              background:
                "linear-gradient(135deg, #a855f7 0%, #8b5cf6 50%, #6366f1 100%)",
              boxShadow: "0 25px 50px -12px rgba(168, 85, 247, 0.5)",
            }}
            className="h-16 w-16 rounded-full hover:scale-105 transition-all duration-300 border-2 border-white/20"
            aria-label="Open chat"
          >
            <MessageCircle className="h-7 w-7" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          style={{
            background:
              "linear-gradient(135deg, #0f172a 0%, #0f172a 50%, #1e293b 100%)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          }}
          className="w-96 p-0 border-slate-700/50"
          align="end"
          side="top"
          sideOffset={12}
        >
          <div
            style={{
              background:
                "linear-gradient(90deg, rgba(139, 92, 246, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)",
            }}
            className="p-4 border-b border-slate-700/50"
          >
            <h3
              style={{
                background: "linear-gradient(90deg, #c4b5fd 0%, #a5b4fc 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
              className="text-base font-semibold"
            >
              Ghost Chat
            </h3>
            <p style={{ color: "#94a3b8" }} className="text-xs mt-1">
              Type / for commands
            </p>
          </div>

          <div className="p-4">
            <div className="relative">
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type /open <app> or /meme <topic>"
                style={{
                  backgroundColor: "rgba(30, 41, 59, 0.5)",
                  borderColor: "rgba(51, 65, 85, 0.5)",
                  backdropFilter: "blur(4px)",
                  color: "#f1f5f9",
                }}
                className="w-full px-4 py-3 pr-12 rounded-lg border text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                autoFocus
              />
              <Button
                onClick={submit}
                size="sm"
                style={{
                  background:
                    "linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)",
                  boxShadow: "0 10px 15px -3px rgba(139, 92, 246, 0.5)",
                }}
                className="absolute right-1.5 top-1.5 h-9 px-3"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {loading && (
              <div className="mt-3 text-sm text-slate-300">Thinking…</div>
            )}

            {lastResponse && (
              <div className="mt-3 text-sm text-slate-200">{lastResponse}</div>
            )}

            {showCommand && filteredCommands.length > 0 && (
              <div
                style={{
                  backgroundColor: "rgba(30, 41, 59, 0.5)",
                  borderColor: "rgba(51, 65, 85, 0.5)",
                  backdropFilter: "blur(4px)",
                }}
                className="mt-2 border rounded-lg overflow-hidden"
              >
                {filteredCommands.map((cmd, index) => (
                  <div
                    key={cmd.value}
                    onClick={() => handleCommandSelect(cmd.value)}
                    style={{
                      backgroundColor:
                        index === selectedIndex
                          ? "rgba(139, 92, 246, 0.2)"
                          : "transparent",
                    }}
                    className="px-4 py-3 cursor-pointer transition-colors hover:bg-violet-500/10"
                  >
                    <div className="flex flex-col">
                      <span
                        style={{ color: "#d8b4fe" }}
                        className="font-semibold"
                      >
                        {cmd.label}
                      </span>
                      <span
                        style={{ color: "#94a3b8" }}
                        className="text-xs mt-0.5"
                      >
                        {cmd.description}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showCommand && filteredCommands.length === 0 && (
              <div
                style={{
                  backgroundColor: "rgba(30, 41, 59, 0.5)",
                  borderColor: "rgba(51, 65, 85, 0.5)",
                  backdropFilter: "blur(4px)",
                }}
                className="mt-2 border rounded-lg overflow-hidden"
              >
                <div
                  style={{ color: "#94a3b8" }}
                  className="text-sm py-6 text-center"
                >
                  No commands found.
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
