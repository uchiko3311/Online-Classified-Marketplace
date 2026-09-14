import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildCar } from "../game/vehicle/buildCar.js";
import { writeSave, loadSave } from "../game/save/save.js";
import { emit } from "../game/state/gameBus.js";

const PAINTS = [
  { name: "Obsidian", hex: "#1c1f24" },
  { name: "Alpine White", hex: "#e7e9ec" },
  { name: "AMG Green", hex: "#28402f" },
  { name: "Desert Sand", hex: "#b79a68" },
  { name: "Graphite", hex: "#3b4048" },
  { name: "Signal Red", hex: "#8f2420" },
];

export default function Garage({ onBack }) {
  const canvasRef = useRef(null);
  const carRef = useRef(null);
  const camRef = useRef(null);
  const controlsRef = useRef(null);
  const [paint, setPaint] = useState(loadSave().paint || "#1c1f24");
  const [interior, setInterior] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    let raf;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#0c1119");
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.set(6, 3, 6.5);
      camRef.current = camera;

      const resize = () => {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };

      scene.add(new THREE.HemisphereLight(0xbcd3ff, 0x20242c, 1.0));
      const key = new THREE.DirectionalLight(0xffffff, 2.4);
      key.position.set(6, 9, 5);
      key.castShadow = true;
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffb26b, 1.2);
      fill.position.set(-6, 3, -5);
      scene.add(fill);

      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(9, 64),
        new THREE.MeshStandardMaterial({ color: "#151a22", roughness: 0.5, metalness: 0.4 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 8),
          new THREE.MeshBasicMaterial({ color: "#d9a441" })
        );
        dot.position.set(Math.cos(a) * 8.6, 0.05, Math.sin(a) * 8.6);
        scene.add(dot);
      }

      const car = buildCar(paint);
      carRef.current = car;
      car.wheels.forEach((w, i) => {
        const sx = i % 2 === 0 ? 0.95 : -0.95;
        const sz = i < 2 ? 1.5 : -1.5;
        w.position.set(sx, 0.46, sz);
        scene.add(w);
      });
      scene.add(car.group);

      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.minDistance = 3;
      controls.maxDistance = 14;
      controls.maxPolarAngle = Math.PI / 2.05;
      controls.target.set(0, 1, 0);
      controlsRef.current = controls;

      resize();
      window.addEventListener("resize", resize);
      const loop = () => {
        raf = requestAnimationFrame(loop);
        controls.update();
        renderer.render(scene, camera);
      };
      loop();
      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        controls.dispose();
        renderer.dispose();
      };
    } catch (e) {
      console.error("[MtskhetaDrive] Garage viewer failed:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPaint = (hex) => {
    setPaint(hex);
    if (carRef.current) carRef.current.setPaint(hex);
    writeSave({ paint: hex });
    emit("setPaint", hex);
  };

  const toggleInterior = () => {
    const cam = camRef.current;
    const controls = controlsRef.current;
    if (!cam || !controls) return;
    const next = !interior;
    setInterior(next);
    if (next) {
      cam.position.set(-0.5, 1.5, -1.2);
      controls.target.set(-0.5, 1.3, 2);
      controls.minDistance = 0.5;
    } else {
      cam.position.set(6, 3, 6.5);
      controls.target.set(0, 1, 0);
      controls.minDistance = 3;
    }
  };

  return (
    <div className="screen overlay sheet">
      <div className="panel card">
        <h2>Garage</h2>
        <p className="muted">
          Drag to orbit, pinch/scroll to zoom. Choose a paint finish — it is
          saved and applied to your SUV in the world.
        </p>
        <canvas ref={canvasRef} className="garage-canvas" />
        <div className="field">
          <label>Paint finish</label>
          <div className="swatches">
            {PAINTS.map((p) => (
              <button
                key={p.hex}
                title={p.name}
                aria-label={p.name}
                className={`swatch ${paint === p.hex ? "on" : ""}`}
                style={{ background: p.hex }}
                onClick={() => applyPaint(p.hex)}
              />
            ))}
          </div>
        </div>
        <div className="row">
          <button className={`btn ${interior ? "active" : ""}`} onClick={toggleInterior}>
            {interior ? "Exterior view" : "Interior view"}
          </button>
          <button className="btn primary" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
