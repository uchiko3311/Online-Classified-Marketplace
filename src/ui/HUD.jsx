import React, { useEffect, useRef } from "react";
import { telemetry } from "../game/state/telemetry.js";
import { emit } from "../game/state/gameBus.js";
import {
  CameraIcon,
  InteriorIcon,
  MapIcon,
  LightsIcon,
  HazardIcon,
  SettingsIcon,
  ExitIcon,
} from "./Icons.jsx";

const MINIMAP_RANGE = 170; // metres radius shown

function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

function drawSpeedo(ctx, speed) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h - 6;
  const r = h - 18;
  const start = Math.PI;
  const end = 2 * Math.PI;
  // track
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, end);
  ctx.stroke();
  // value
  const frac = Math.max(0, Math.min(1, speed / 220));
  const ang = start + (end - start) * frac;
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, "#35d0d6");
  grad.addColorStop(0.7, "#d9a441");
  grad.addColorStop(1, "#e5484d");
  ctx.strokeStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, ang);
  ctx.stroke();
  // ticks
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 10; i++) {
    const a = start + (end - start) * (i / 10);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6));
    ctx.lineTo(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2));
    ctx.stroke();
  }
}

function drawMinimap(ctx, layout, routePoints) {
  const size = ctx.canvas.width;
  const s = size / 2 / MINIMAP_RANGE;
  const px = telemetry.x;
  const pz = telemetry.z;
  const heading = telemetry.heading;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  // circular clip
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#0c1119";
  ctx.fillRect(0, 0, size, size);

  ctx.translate(size / 2, size / 2);
  ctx.rotate(-heading);

  const plot = (wx, wz) => [(wx - px) * s, -(wz - pz) * s];

  // river
  if (layout.river) {
    const r = layout.river;
    const [x0] = plot(-r.length / 2, r.z - r.width / 2);
    const [, y0] = plot(-r.length / 2, r.z - r.width / 2);
    ctx.fillStyle = "#22485f";
    ctx.save();
    ctx.beginPath();
    const a = plot(-r.length / 2, r.z);
    const b = plot(r.length / 2, r.z);
    ctx.lineWidth = r.width * s;
    ctx.strokeStyle = "#22485f";
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.restore();
  }

  // roads (grid)
  ctx.strokeStyle = "#3a424e";
  ctx.lineWidth = layout.ROAD_HALF * 2 * s;
  ctx.lineCap = "round";
  for (let n = 0; n < layout.GRID; n++) {
    const c = n * layout.BLOCK - layout.HALF;
    // vertical (x=c)
    let p1 = plot(c, -layout.HALF);
    let p2 = plot(c, layout.HALF);
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.stroke();
    // horizontal (z=c)
    p1 = plot(-layout.HALF, c);
    p2 = plot(layout.HALF, c);
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.stroke();
  }

  // route
  if (routePoints && routePoints.length) {
    ctx.strokeStyle = "#35d0d6";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    routePoints.forEach((p, i) => {
      const [x, y] = plot(p.x, p.z);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // landmarks
  const mark = (pos, color) => {
    if (!pos) return;
    const [x, y] = plot(pos.x, pos.z);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  };
  mark(layout.cathedral, "#d9a441");
  mark(layout.monastery, "#c9b26b");

  ctx.restore();

  // player arrow (fixed, pointing up)
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.fillStyle = "#f0b95a";
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(6, 8);
  ctx.lineTo(0, 4);
  ctx.lineTo(-6, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function IconBtn({ label, children, onPress, className = "", innerRef }) {
  const handle = (e) => {
    e.preventDefault();
    vibrate(12);
    onPress();
  };
  return (
    <button
      ref={innerRef}
      className={`icon-btn ${className}`}
      onPointerDown={handle}
      aria-label={label}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

export default function HUD({ layout, onOpenMap, onOpenSettings, onExit }) {
  const speedoRef = useRef(null);
  const miniRef = useRef(null);
  const kmhRef = useRef(null);
  const gearRef = useRef(null);
  const navRef = useRef(null);
  const navDistRef = useRef(null);
  const lightsBtn = useRef(null);
  const hazardBtn = useRef(null);
  const interiorBtn = useRef(null);

  useEffect(() => {
    let raf;
    const speedoCtx = speedoRef.current.getContext("2d");
    const miniCtx = miniRef.current.getContext("2d");
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const spd = telemetry.speedKmh;
      drawSpeedo(speedoCtx, spd);
      if (layout) drawMinimap(miniCtx, layout, telemetry.routePoints);
      if (kmhRef.current) kmhRef.current.textContent = Math.round(spd);
      if (gearRef.current) {
        const g = telemetry.gear;
        gearRef.current.textContent = g === 0 ? "R" : "D" + g;
      }
      if (navRef.current) {
        const active = telemetry.navActive;
        navRef.current.style.display = active ? "flex" : "none";
        if (active && navDistRef.current) {
          const d = telemetry.navDistance || 0;
          navDistRef.current.textContent =
            d > 1000 ? (d / 1000).toFixed(1) + " km" : Math.round(d) + " m";
        }
      }
      if (lightsBtn.current)
        lightsBtn.current.classList.toggle("active", !!telemetry.headlights);
      if (hazardBtn.current)
        hazardBtn.current.classList.toggle("active", !!telemetry.hazard);
      if (interiorBtn.current)
        interiorBtn.current.classList.toggle("active", telemetry.cameraMode === "interior");
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [layout]);

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="minimap">
          <canvas ref={miniRef} width={148} height={148} />
          <span className="n">N</span>
        </div>
        <div className="hud-btn-row">
          <IconBtn label="Camera" onPress={() => emit("cameraCycle")}>
            <CameraIcon />
          </IconBtn>
          <IconBtn
            label="Interior"
            innerRef={interiorBtn}
            onPress={() => emit("toggleInterior")}
          >
            <InteriorIcon />
          </IconBtn>
          <IconBtn label="Map" onPress={onOpenMap}>
            <MapIcon />
          </IconBtn>
          <IconBtn label="Lights" innerRef={lightsBtn} onPress={() => emit("toggleLights")}>
            <LightsIcon />
          </IconBtn>
          <IconBtn
            label="Hazard"
            className="danger"
            innerRef={hazardBtn}
            onPress={() => emit("toggleHazard")}
          >
            <HazardIcon />
          </IconBtn>
          <IconBtn label="Settings" onPress={onOpenSettings}>
            <SettingsIcon />
          </IconBtn>
          <IconBtn label="Menu" onPress={onExit}>
            <ExitIcon />
          </IconBtn>
        </div>
      </div>

      <div className="nav-banner" ref={navRef} style={{ display: "none" }}>
        <span>Destination</span>
        <b ref={navDistRef}>--</b>
      </div>

      <div className="speedo">
        <canvas ref={speedoRef} width={150} height={96} />
        <div className="readout">
          <div className="kmh" ref={kmhRef}>
            0
          </div>
          <div className="unit">KM/H</div>
          <div className="gear" ref={gearRef}>
            D1
          </div>
        </div>
      </div>
    </div>
  );
}
