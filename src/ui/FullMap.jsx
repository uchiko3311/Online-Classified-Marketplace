import React, { useEffect, useRef } from "react";
import { telemetry } from "../game/state/telemetry.js";
import { emit } from "../game/state/gameBus.js";

export default function FullMap({ layout, onClose }) {
  const canvasRef = useRef(null);
  const cam = useRef({ x: telemetry.x, z: telemetry.z });
  const scale = useRef(1);
  const dest = useRef(layout && layout.__lastDest ? layout.__lastDest : null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf;
    const dpr = Math.min(window.devicePixelRatio, 2);

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const fit = Math.min(window.innerWidth, window.innerHeight);
    scale.current = (fit * dpr) / (layout.HALF * 2.6);

    const worldToScreen = (wx, wz) => [
      canvas.width / 2 + (wx - cam.current.x) * scale.current,
      canvas.height / 2 + (wz - cam.current.z) * scale.current,
    ];
    const screenToWorld = (sx, sz) => [
      (sx * dpr - canvas.width / 2) / scale.current + cam.current.x,
      (sz * dpr - canvas.height / 2) / scale.current + cam.current.z,
    ];

    const draw = () => {
      raf = requestAnimationFrame(draw);
      ctx.fillStyle = "#0b0f16";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const s = scale.current;

      // river
      const r = layout.river;
      ctx.strokeStyle = "#22485f";
      ctx.lineWidth = r.width * s;
      ctx.lineCap = "round";
      let a = worldToScreen(-r.length / 2, r.z);
      let b = worldToScreen(r.length / 2, r.z);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();

      // buildings (faint)
      ctx.fillStyle = "rgba(120,132,150,0.35)";
      for (const bld of layout.buildings) {
        const [x, y] = worldToScreen(bld.x, bld.z);
        ctx.fillRect(x - (bld.w * s) / 2, y - (bld.d * s) / 2, bld.w * s, bld.d * s);
      }

      // roads
      ctx.strokeStyle = "#454d59";
      ctx.lineWidth = layout.ROAD_HALF * 2 * s;
      for (let n = 0; n < layout.GRID; n++) {
        const c = n * layout.BLOCK - layout.HALF;
        let p1 = worldToScreen(c, -layout.HALF);
        let p2 = worldToScreen(c, layout.HALF);
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.stroke();
        p1 = worldToScreen(-layout.HALF, c);
        p2 = worldToScreen(layout.HALF, c);
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.stroke();
      }

      // route
      if (telemetry.routePoints && telemetry.routePoints.length) {
        ctx.strokeStyle = "#35d0d6";
        ctx.lineWidth = 4 * dpr;
        ctx.beginPath();
        telemetry.routePoints.forEach((p, i) => {
          const [x, y] = worldToScreen(p.x, p.z);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      // landmarks
      const label = (pos, text, color) => {
        if (!pos) return;
        const [x, y] = worldToScreen(pos.x, pos.z);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 6 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e6ebf1";
        ctx.font = `${12 * dpr}px Rajdhani, sans-serif`;
        ctx.fillText(text, x + 9 * dpr, y + 4 * dpr);
      };
      label(layout.cathedral, "Svetitskhoveli", "#d9a441");
      label(layout.monastery, "Jvari Monastery", "#c9b26b");

      // destination
      if (dest.current) {
        const [x, y] = worldToScreen(dest.current.x, dest.current.z);
        ctx.strokeStyle = "#35d0d6";
        ctx.lineWidth = 3 * dpr;
        ctx.beginPath();
        ctx.arc(x, y, 10 * dpr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y - 14 * dpr);
        ctx.lineTo(x, y + 14 * dpr);
        ctx.moveTo(x - 14 * dpr, y);
        ctx.lineTo(x + 14 * dpr, y);
        ctx.stroke();
      }

      // player
      const [px, py] = worldToScreen(telemetry.x, telemetry.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-telemetry.heading + Math.PI);
      ctx.fillStyle = "#f0b95a";
      ctx.beginPath();
      ctx.moveTo(0, -10 * dpr);
      ctx.lineTo(7 * dpr, 9 * dpr);
      ctx.lineTo(0, 5 * dpr);
      ctx.lineTo(-7 * dpr, 9 * dpr);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    draw();

    // --- interaction ---
    const pointers = new Map();
    let downPos = null;
    let moved = 0;
    let pinchDist = 0;

    const onDown = (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
      if (pointers.size === 1) {
        downPos = { x: e.clientX, y: e.clientY };
        moved = 0;
      } else if (pointers.size === 2) {
        const pts = [...pointers.values()];
        pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      }
    };
    const onMove = (e) => {
      if (!pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        moved += Math.abs(dx) + Math.abs(dy);
        cam.current.x -= (dx * dpr) / scale.current;
        cam.current.z -= (dy * dpr) / scale.current;
      } else if (pointers.size === 2) {
        const pts = [...pointers.values()];
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (pinchDist) scale.current *= d / pinchDist;
        scale.current = Math.max(0.2, Math.min(6, scale.current));
        pinchDist = d;
      }
    };
    const onUp = (e) => {
      const wasTap = pointers.size === 1 && moved < 8 && downPos;
      pointers.delete(e.pointerId);
      if (wasTap) {
        const [wx, wz] = screenToWorld(e.clientX, e.clientY);
        dest.current = { x: wx, z: wz };
        emit("setDestination", { x: wx, z: wz, name: "Custom pin" });
      }
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    const onWheel = (e) => {
      e.preventDefault();
      scale.current *= e.deltaY < 0 ? 1.12 : 0.9;
      scale.current = Math.max(0.2, Math.min(6, scale.current));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [layout]);

  const go = (pos, name) => {
    dest.current = { x: pos.x, z: pos.z };
    emit("setDestination", { x: pos.x, z: pos.z, name });
  };
  const zoom = (f) => {
    scale.current = Math.max(0.2, Math.min(6, scale.current * f));
  };

  return (
    <div className="screen overlay fullmap">
      <canvas ref={canvasRef} className="fullmap-canvas" />
      <div className="fullmap-top">
        <div className="fullmap-title panel" style={{ padding: "8px 14px" }}>
          Mtskheta · Map
        </div>
        <button className="btn primary pointer" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="map-hint">Tap anywhere to set a destination · drag to pan · pinch/scroll to zoom</div>
      <div className="fullmap-tools">
        <button className="btn" onClick={() => go(layout.cathedral, "Svetitskhoveli")}>
          Cathedral
        </button>
        <button className="btn" onClick={() => go(layout.monastery, "Jvari Monastery")}>
          Monastery
        </button>
        <button
          className="btn"
          onClick={() => go({ x: layout.spawn.x, z: layout.spawn.z }, "Start point")}
        >
          Start
        </button>
        <button className="btn ghost" onClick={() => zoom(1.3)}>
          +
        </button>
        <button className="btn ghost" onClick={() => zoom(0.77)}>
          −
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            dest.current = null;
            emit("clearDestination");
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
