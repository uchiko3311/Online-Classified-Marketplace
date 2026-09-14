import React, { useEffect, useRef, useState } from "react";
import { Engine } from "../game/Engine.js";
import { on } from "../game/state/gameBus.js";
import LoadingScreen, { ErrorScreen } from "./LoadingScreen.jsx";
import HUD from "./HUD.jsx";
import TouchControls from "./TouchControls.jsx";
import FullMap from "./FullMap.jsx";
import Settings from "./Settings.jsx";

export default function GameCanvas({ quality, save, initialOpenMap, onExit }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [phase, setPhase] = useState("loading"); // loading | ready | error
  const [progress, setProgress] = useState({ v: 0, label: "" });
  const [error, setError] = useState(null);
  const [layout, setLayout] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let disposed = false;
    const engine = new Engine(canvasRef.current, {
      quality,
      save,
      onProgress: (v, label) => setProgress({ v, label }),
    });
    engineRef.current = engine;
    engine
      .init()
      .then(() => {
        if (disposed) {
          engine.dispose();
          return;
        }
        setLayout(engine.layout);
        engine.start();
        setPhase("ready");
        if (initialOpenMap) setMapOpen(true);
      })
      .catch((err) => {
        console.error("[MtskhetaDrive] Engine init failed:", err);
        setError(err);
        setPhase("error");
      });

    const saveTimer = setInterval(() => {
      if (engineRef.current && engineRef.current.running) engineRef.current.saveState();
    }, 5000);

    const onArrived = on("navArrived", (name) => {
      console.log("[MtskhetaDrive] Arrived at", name);
    });

    const onVisibility = () => {
      if (document.hidden) engineRef.current?.pause();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      clearInterval(saveTimer);
      onArrived();
      document.removeEventListener("visibilitychange", onVisibility);
      engine.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pause/resume engine when overlays are shown
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || phase !== "ready") return;
    if (mapOpen || settingsOpen) engine.pause();
    else engine.resume();
  }, [mapOpen, settingsOpen, phase]);

  const exit = () => {
    engineRef.current?.saveState();
    onExit();
  };

  return (
    <div className="screen">
      <canvas ref={canvasRef} />

      {phase === "loading" && <LoadingScreen progress={progress.v} label={progress.label} />}
      {phase === "error" && <ErrorScreen error={error} onBack={onExit} />}

      {phase === "ready" && (
        <>
          <HUD
            layout={layout}
            onOpenMap={() => setMapOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onExit={exit}
          />
          <TouchControls />
          {mapOpen && <FullMap layout={layout} onClose={() => setMapOpen(false)} />}
          {settingsOpen && (
            <Settings save={save} inGame onBack={() => setSettingsOpen(false)} />
          )}
        </>
      )}
    </div>
  );
}
