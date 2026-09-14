import React, { useEffect, useState } from "react";
import "./ui/ui.css";
import MainMenu from "./ui/MainMenu.jsx";
import GameCanvas from "./ui/GameCanvas.jsx";
import Garage from "./ui/Garage.jsx";
import Settings from "./ui/Settings.jsx";
import { loadSave } from "./game/save/save.js";

export default function App() {
  const [screen, setScreen] = useState("menu"); // menu | playing | garage | settings
  const [save, setSave] = useState(() => loadSave());
  const [openMapInitial, setOpenMapInitial] = useState(false);

  // Refresh save snapshot whenever we return to the menu (paint/quality changes).
  useEffect(() => {
    if (screen === "menu") setSave(loadSave());
  }, [screen]);

  const play = (withMap = false) => {
    setSave(loadSave());
    setOpenMapInitial(withMap);
    setScreen("playing");
  };

  return (
    <>
      <RotateHint />
      {screen === "menu" && (
        <MainMenu
          save={save}
          onPlay={() => play(false)}
          onMap={() => play(true)}
          onGarage={() => setScreen("garage")}
          onSettings={() => setScreen("settings")}
        />
      )}

      {screen === "playing" && (
        <GameCanvas
          key="game"
          quality={save.quality || "medium"}
          save={save}
          initialOpenMap={openMapInitial}
          onExit={() => setScreen("menu")}
        />
      )}

      {screen === "garage" && <Garage onBack={() => setScreen("menu")} />}

      {screen === "settings" && (
        <Settings save={save} inGame={false} onBack={() => setScreen("menu")} />
      )}
    </>
  );
}

function RotateHint() {
  return (
    <div className="rotate-hint show" id="rotate-hint">
      <div style={{ fontSize: 48 }}>⟳</div>
      <h2>Rotate your phone</h2>
      <p style={{ color: "var(--muted)", maxWidth: 320 }}>
        For the best driving experience, rotate your phone horizontally
        (landscape).
      </p>
    </div>
  );
}
