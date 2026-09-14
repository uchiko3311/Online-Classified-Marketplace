import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildCar } from "../game/vehicle/buildCar.js";

function MenuBackground({ paint }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    let raf;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      const resize = () => {
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
      };
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(6, 3.2, 7);
      camera.lookAt(0, 1, 0);

      scene.add(new THREE.HemisphereLight(0xbcd3ff, 0x2a2620, 0.8));
      const key = new THREE.DirectionalLight(0xfff0d0, 2.2);
      key.position.set(6, 8, 4);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xffb26b, 1.6);
      rim.position.set(-6, 4, -6);
      scene.add(rim);

      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(6, 6, 0.3, 48),
        new THREE.MeshStandardMaterial({ color: "#12161d", roughness: 0.6, metalness: 0.3 })
      );
      disc.position.y = -0.15;
      scene.add(disc);

      const car = buildCar(paint || "#1c1f24");
      const turntable = new THREE.Group();
      turntable.add(car.group);
      car.wheels.forEach((w, i) => {
        const sx = i % 2 === 0 ? 0.95 : -0.95;
        const sz = i < 2 ? 1.5 : -1.5;
        w.position.set(sx, 0.46, sz);
        turntable.add(w);
      });
      scene.add(turntable);

      resize();
      window.addEventListener("resize", resize);
      const loop = () => {
        raf = requestAnimationFrame(loop);
        turntable.rotation.y += 0.0045;
        renderer.render(scene, camera);
      };
      loop();
      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        renderer.dispose();
      };
    } catch (e) {
      console.error("[MtskhetaDrive] Menu background failed:", e);
    }
  }, [paint]);
  return <canvas ref={ref} className="landmark-canvas" />;
}

export default function MainMenu({ onPlay, onGarage, onMap, onSettings, save }) {
  return (
    <div className="screen menu">
      <MenuBackground paint={save?.paint} />
      <div className="menu-brandmark">
        <div className="menu-kicker">GEORGIA · OPEN WORLD</div>
        <h1 className="menu-title">
          MTSKHETA
          <br />
          <span>DRIVE 3D</span>
        </h1>
        <div className="menu-sub">EXPLORE MTSKHETA</div>
      </div>
      <div className="menu-actions">
        <button className="btn primary" onClick={onPlay}>
          <span>Play</span>
          <span>▸</span>
        </button>
        <button className="btn" onClick={onGarage}>
          <span>Garage</span>
          <span>▸</span>
        </button>
        <button className="btn" onClick={onMap}>
          <span>Map</span>
          <span>▸</span>
        </button>
        <button className="btn" onClick={onSettings}>
          <span>Settings</span>
          <span>▸</span>
        </button>
        <p className="menu-note">
          Drive an original G-Class-inspired SUV through a stylized 3D Mtskheta.
          Desktop: WASD / arrows to drive, C camera, V interior, L lights, M map.
          On mobile, rotate your phone horizontally for the best experience.
        </p>
      </div>
    </div>
  );
}
