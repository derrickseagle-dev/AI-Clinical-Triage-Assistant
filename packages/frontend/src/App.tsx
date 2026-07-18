import { useState, useEffect } from "react";

function App() {
  const [health, setHealth] = useState<string>("checking...");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealth(data.status))
      .catch(() => setHealth("unreachable"));
  }, []);

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>Astrata Health</h1>
      <h2>AI Clinical Triage Assistant</h2>
      <p>Backend status: <strong>{health}</strong></p>
    </div>
  );
}

export default App;
