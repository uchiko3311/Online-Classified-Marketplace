import React from "react";

export default function LoadingScreen({ progress, label }) {
  const pct = Math.round((progress || 0) * 100);
  return (
    <div className="screen loading">
      <h1>
        MTSKHETA <span>DRIVE 3D</span>
      </h1>
      <div className="bar">
        <div style={{ width: pct + "%" }} />
      </div>
      <div className="label">
        {label ? `${label}...` : "Loading Mtskheta..."} {pct}%
      </div>
    </div>
  );
}

export function ErrorScreen({ error, onBack }) {
  return (
    <div className="screen loading">
      <div className="panel error-box">
        <h2>Unable to start the game</h2>
        <p style={{ color: "var(--muted)", marginBottom: 12 }}>
          A technical error occurred while initializing the 3D engine. Details
          below and in the browser console.
        </p>
        <pre>{String(error?.stack || error?.message || error)}</pre>
        {onBack && (
          <button className="btn primary" style={{ marginTop: 16 }} onClick={onBack}>
            Back to menu
          </button>
        )}
      </div>
    </div>
  );
}
