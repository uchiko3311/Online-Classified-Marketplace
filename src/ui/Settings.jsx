import React, { useState } from "react";
import { writeSave, clearSave } from "../game/save/save.js";
import { emit } from "../game/state/gameBus.js";

const QUALITIES = ["low", "medium", "high", "ultra"];
const WEATHERS = ["clear", "cloudy", "rain"];
const PIXEL = { low: 1, medium: 1.5, high: 2, ultra: 2 };

export default function Settings({ save, inGame, onBack }) {
  const [quality, setQuality] = useState(save.quality || "medium");
  const [weather, setWeather] = useState("clear");
  const [time, setTime] = useState(Math.round(save.timeOfDay ?? 12));
  const [autoTime, setAutoTime] = useState(true);
  const [audio, setAudio] = useState(true);

  const pickQuality = (q) => {
    setQuality(q);
    writeSave({ quality: q });
    emit("setPixelRatio", PIXEL[q]);
  };
  const pickWeather = (w) => {
    setWeather(w);
    emit("setWeather", w);
  };
  const changeTime = (h) => {
    setTime(h);
    setAutoTime(false);
    emit("setAutoTime", false);
    emit("setTime", h);
  };
  const toggleAuto = () => {
    const v = !autoTime;
    setAutoTime(v);
    emit("setAutoTime", v);
  };
  const toggleAudio = () => {
    const v = !audio;
    setAudio(v);
    emit("audioEnabled", v);
  };

  return (
    <div className="screen overlay sheet">
      <div className="panel card">
        <h2>Settings</h2>
        <p className="muted">
          Graphics quality changes render resolution live. Traffic density and
          shadows apply fully next time you start driving.
        </p>

        <div className="field">
          <label>Graphics quality</label>
          <div className="seg">
            {QUALITIES.map((q) => (
              <button key={q} className={quality === q ? "on" : ""} onClick={() => pickQuality(q)}>
                {q.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {inGame && (
          <>
            <div className="field">
              <label>Weather</label>
              <div className="seg">
                {WEATHERS.map((w) => (
                  <button key={w} className={weather === w ? "on" : ""} onClick={() => pickWeather(w)}>
                    {w.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>
                Time of day — {String(time).padStart(2, "0")}:00
                {autoTime ? " (auto cycle)" : ""}
              </label>
              <input
                type="range"
                min="0"
                max="23"
                value={time}
                onChange={(e) => changeTime(Number(e.target.value))}
              />
              <div className="row">
                <button className={`btn ${autoTime ? "active" : ""}`} onClick={toggleAuto}>
                  Auto day/night: {autoTime ? "On" : "Off"}
                </button>
              </div>
            </div>

            <div className="field">
              <label>Audio</label>
              <button className={`btn ${audio ? "active" : ""}`} onClick={toggleAudio}>
                Engine sound: {audio ? "On" : "Off"}
              </button>
            </div>
          </>
        )}

        <div className="field">
          <label>Save data</label>
          <button
            className="btn"
            onClick={() => {
              clearSave();
              window.location.reload();
            }}
          >
            Reset progress & reload
          </button>
        </div>

        <div className="row">
          <button className="btn primary" onClick={onBack}>
            {inGame ? "Resume" : "Back"}
          </button>
        </div>
      </div>
    </div>
  );
}
