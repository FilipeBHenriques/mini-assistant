import React, { useState } from "react";
import "./App.css";

type Status = "vibing" | "working" | "procrastinating";

function App() {
  const [status, setStatus] = useState<Status>("vibing");

  const getEmoji = () => {
    if (status === "vibing") return "😀";
    if (status === "working") return "✔️";
    return "❓";
  };

  return (
    <div className="circle">
      <span className="emoji">{getEmoji()}</span>
      <div className="controls">
        <button onClick={() => setStatus("vibing")}>Vibe</button>
        <button onClick={() => setStatus("working")}>Work</button>
        <button onClick={() => setStatus("procrastinating")}>
          Procrastinate
        </button>
      </div>
    </div>
  );
}

export default App;
