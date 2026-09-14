import * as THREE from "three";
import * as CANNON from "cannon-es";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { World } from "./world/World.js";
import { Vehicle } from "./vehicle/Vehicle.js";
import { CameraRig } from "./camera/CameraRig.js";
import { Sky } from "./env/Sky.js";
import { EngineAudio } from "./audio/EngineAudio.js";
import { KeyboardControls } from "./input/Controls.js";
import { Traffic, Pedestrians } from "./traffic/Traffic.js";
import { buildLayout, findRoute, nearestNode } from "./world/cityLayout.js";
import { telemetry } from "./state/telemetry.js";
import { on, emit } from "./state/gameBus.js";
import { writeSave } from "./save/save.js";

const QUALITY = {
  low: { pixelRatio: 1, traffic: 4, peds: 0, shadows: false },
  medium: { pixelRatio: 1.5, traffic: 8, peds: 6, shadows: true },
  high: { pixelRatio: 2, traffic: 13, peds: 12, shadows: true },
  ultra: { pixelRatio: 2, traffic: 16, peds: 16, shadows: true },
};

export class Engine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.quality = options.quality || "medium";
    this.save = options.save || {};
    this.running = false;
    this.autoTime = true;
    this.autoHeadlights = true;
    this.nav = null;
    this._unsubs = [];
    this._accum = 0;
    this._last = 0;
    this._fpsAccum = 0;
    this._fpsFrames = 0;
    this._onProgress = options.onProgress || (() => {});
  }

  async init() {
    const q = QUALITY[this.quality];
    this._onProgress(0.05, "Initializing renderer");

    if (!window.WebGLRenderingContext) {
      throw new Error("WebGL is not supported by this browser.");
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.quality !== "low",
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = q.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();

    // Neutral image-based lighting for PBR reflections (car paint, glass,
    // chrome). Applied only to the vehicle (see below) rather than globally:
    // three r160 has no scene.environmentIntensity, so a global env map would
    // light the whole city at a constant level and prevent nights from ever
    // getting dark. World brightness is therefore driven by the day/night
    // lights, and the car keeps real reflections.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    pmrem.dispose();
    this.camera = new THREE.PerspectiveCamera(
      68,
      window.innerWidth / window.innerHeight,
      0.1,
      1400
    );

    this._onProgress(0.15, "Building physics world");
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -20, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.defaultContactMaterial.friction = 0.6;
    const physics = {
      world: this.world,
      groundMaterial: new CANNON.Material("ground"),
    };
    this.physics = physics;

    this._onProgress(0.3, "Generating Mtskheta layout");
    this.layout = buildLayout();

    this._onProgress(0.45, "Constructing city (roads, buildings, landmarks)");
    // Build the heavy world in the next frame so the loading bar can paint.
    await new Promise((r) => requestAnimationFrame(() => r()));
    this.cityWorld = new World(this.scene, physics, this.layout, this.quality);

    this._onProgress(0.7, "Assembling vehicle");
    this.vehicle = new Vehicle(this.scene, this.world, physics);
    const sp = this.save.player || this.layout.spawn;
    this.vehicle.setSpawn(sp.x, sp.z, sp.heading || 0);

    // Give only the vehicle image-based reflections.
    const applyEnv = (root) =>
      root.traverse((o) => {
        if (!o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if ("envMap" in m) {
            m.envMap = this.envRT.texture;
            m.needsUpdate = true;
          }
        }
      });
    applyEnv(this.vehicle.car.group);
    for (const w of this.vehicle.car.wheels) applyEnv(w);

    this.rig = new CameraRig(this.camera);
    this.rig.setMode(this.save.cameraMode || "chase");

    this._onProgress(0.82, "Lighting and weather");
    this.sky = new Sky(this.scene, this.quality);
    this.timeOfDay = this.save.timeOfDay ?? 12;
    this.sky.setTime(this.timeOfDay);

    // headlight pool for street lamps (limited real point lights at night)
    this.lampPool = [];
    if (this.quality !== "low") {
      const poolSize = this.quality === "high" || this.quality === "ultra" ? 10 : 5;
      for (let i = 0; i < poolSize; i++) {
        const pl = new THREE.PointLight(0xffdca0, 0, 26, 1.6);
        this.scene.add(pl);
        this.lampPool.push(pl);
      }
    }

    this._onProgress(0.9, "Traffic and pedestrians");
    this.traffic = new Traffic(this.scene, physics, this.layout, q.traffic);
    this.pedestrians = new Pedestrians(this.scene, this.layout, q.peds);

    this._onProgress(0.95, "Input and audio");
    this.keyboard = new KeyboardControls();
    this.audio = new EngineAudio();

    // route line
    this.routeLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x35d0d6 })
    );
    this.routeLine.frustumCulled = false;
    this.scene.add(this.routeLine);

    if (this.save.paint) this.vehicle.car.setPaint(this.save.paint);
    if (this.save.headlights) {
      this.vehicle.headlights = true;
      this.autoHeadlights = false;
    }
    if (this.save.destination) this.setDestination(this.save.destination, this.save.destName);

    this._wireCommands();
    this._onResize = this._onResize.bind(this);
    window.addEventListener("resize", this._onResize);

    this._onProgress(1, "Ready");
    return this;
  }

  _wireCommands() {
    const sub = (evt, fn) => this._unsubs.push(on(evt, fn));
    sub("cameraCycle", () => this.rig.cycle());
    sub("setCamera", (m) => this.rig.setMode(m));
    sub("toggleInterior", () => {
      this.rig.setMode(this.rig.mode === "interior" ? "chase" : "interior");
    });
    sub("toggleLights", () => {
      this.vehicle.headlights = !this.vehicle.headlights;
      this.autoHeadlights = false;
      telemetry.headlights = this.vehicle.headlights;
    });
    sub("toggleHazard", () => {
      this.vehicle.hazard = !this.vehicle.hazard;
      telemetry.hazard = this.vehicle.hazard;
    });
    sub("blinkLeft", () => {
      this.vehicle.leftBlink = !this.vehicle.leftBlink;
      this.vehicle.rightBlink = false;
    });
    sub("blinkRight", () => {
      this.vehicle.rightBlink = !this.vehicle.rightBlink;
      this.vehicle.leftBlink = false;
    });
    sub("setTime", (h) => {
      this.timeOfDay = h;
      this.sky.setTime(h);
    });
    sub("setAutoTime", (v) => (this.autoTime = v));
    sub("setWeather", (w) => this.sky.setWeather(w));
    sub("setPaint", (c) => this.vehicle.car.setPaint(c));
    sub("respawn", () => {
      const s = this.layout.spawn;
      this.vehicle.setSpawn(s.x, s.z, s.heading);
    });
    sub("teleport", (p) => this.vehicle.setSpawn(p.x, p.z, 0));
    sub("setDestination", (p) => this.setDestination(p, p.name));
    sub("clearDestination", () => {
      this.nav = null;
      this.routeLine.geometry.setFromPoints([]);
      telemetry.routePoints = [];
      telemetry.navActive = false;
    });
    sub("setPixelRatio", (r) =>
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, r))
    );
    sub("audioEnabled", (v) => this.audio.setEnabled(v));
  }

  setDestination(target, name) {
    const startNode = nearestNode(this.layout, telemetry.x, telemetry.z);
    const goalNode = nearestNode(this.layout, target.x, target.z);
    const path = findRoute(this.layout, startNode.id, goalNode.id);
    if (!path) {
      console.warn("[MtskhetaDrive] No route found to destination.");
      return;
    }
    this.nav = {
      points: path.map((p) => ({ x: p.x, z: p.z })),
      dest: { x: target.x, z: target.z },
      targetIndex: 1,
      name: name || "Destination",
    };
    this._drawRoute();
    telemetry.navActive = true;
    writeSave({ destination: { x: target.x, z: target.z }, destName: this.nav.name });
  }

  _drawRoute() {
    if (!this.nav) return;
    const pts = this.nav.points.map((p) => new THREE.Vector3(p.x, 0.6, p.z));
    pts.push(new THREE.Vector3(this.nav.dest.x, 0.6, this.nav.dest.z));
    this.routeLine.geometry.setFromPoints(pts);
    telemetry.routePoints = [...this.nav.points, { x: this.nav.dest.x, z: this.nav.dest.z }];
  }

  _updateNav() {
    if (!this.nav) return;
    const px = telemetry.x;
    const pz = telemetry.z;
    const pts = this.nav.points;
    // advance target waypoint
    let ti = this.nav.targetIndex;
    if (ti < pts.length) {
      const d = Math.hypot(pts[ti].x - px, pts[ti].z - pz);
      if (d < 14) this.nav.targetIndex = Math.min(pts.length, ti + 1);
    }
    ti = this.nav.targetIndex;
    // remaining distance
    let remaining = 0;
    let prevX = px;
    let prevZ = pz;
    for (let i = ti; i < pts.length; i++) {
      remaining += Math.hypot(pts[i].x - prevX, pts[i].z - prevZ);
      prevX = pts[i].x;
      prevZ = pts[i].z;
    }
    remaining += Math.hypot(this.nav.dest.x - prevX, this.nav.dest.z - prevZ);
    telemetry.navDistance = remaining;

    // arrival
    const dDest = Math.hypot(this.nav.dest.x - px, this.nav.dest.z - pz);
    if (dDest < 12) {
      emit("navArrived", this.nav.name);
      this.nav = null;
      this.routeLine.geometry.setFromPoints([]);
      telemetry.routePoints = [];
      telemetry.navActive = false;
      writeSave({ destination: null });
      return;
    }

    // off-route recalculation: distance to the current target waypoint
    if (ti >= pts.length) return;
    const distToPath = Math.hypot(pts[ti].x - px, pts[ti].z - pz);
    if (distToPath > 90) {
      const startNode = nearestNode(this.layout, px, pz);
      const goalNode = nearestNode(this.layout, this.nav.dest.x, this.nav.dest.z);
      const path = findRoute(this.layout, startNode.id, goalNode.id);
      if (path) {
        this.nav.points = path.map((p) => ({ x: p.x, z: p.z }));
        this.nav.targetIndex = 1;
        this._drawRoute();
      }
    }
  }

  _updateLampPool() {
    if (!this.lampPool.length) return;
    const night = this.sky.nightFactor;
    if (night < 0.3) {
      for (const pl of this.lampPool) pl.intensity = 0;
      return;
    }
    const px = telemetry.x;
    const pz = telemetry.z;
    const positions = this.cityWorld.lightPositions;
    // find nearest N lamps
    const scored = [];
    for (const p of positions) {
      const d = (p.x - px) ** 2 + (p.z - pz) ** 2;
      if (d < 60 * 60) scored.push({ p, d });
    }
    scored.sort((a, b) => a.d - b.d);
    for (let i = 0; i < this.lampPool.length; i++) {
      const pl = this.lampPool[i];
      if (i < scored.length) {
        pl.position.copy(scored[i].p);
        pl.intensity = 4.5 * night;
      } else {
        pl.intensity = 0;
      }
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.audio.start();
    this.audio.resume();
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._loop.bind(this));
  }

  pause() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  resume() {
    if (!this.running) this.start();
  }

  _loop(now) {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._loop.bind(this));
    let dt = (now - this._last) / 1000;
    this._last = now;
    if (dt > 0.05) dt = 0.05; // clamp to avoid tunnelling after tab switch

    // physics + control
    this.vehicle.update(dt);
    this.world.step(1 / 60, dt, 3);

    // time of day
    if (this.autoTime) {
      this.timeOfDay += dt * (24 / 600); // full cycle ~10 min
      if (this.timeOfDay >= 24) this.timeOfDay -= 24;
    }
    this.sky.setTime(this.timeOfDay);
    telemetry.timeOfDay = this.timeOfDay;
    this.cityWorld.setNight(this.sky.nightFactor);
    if (this.autoHeadlights) {
      this.vehicle.headlights = this.sky.nightFactor > 0.45;
      telemetry.headlights = this.vehicle.headlights;
    }

    const playerPos = this.vehicle.car.group.position;
    this.rig.update(dt, this.vehicle);
    this.traffic.update(dt, playerPos);
    this.pedestrians.update(dt, playerPos);
    this.sky.update(dt, this.camera.position);
    this._updateLampPool();
    this._updateNav();
    this.audio.update(telemetry.rpm, telemetry.throttle, telemetry.speedKmh);

    this.renderer.render(this.scene, this.camera);

    // fps
    this._fpsAccum += dt;
    this._fpsFrames++;
    if (this._fpsAccum >= 0.5) {
      telemetry.fps = Math.round(this._fpsFrames / this._fpsAccum);
      this._fpsAccum = 0;
      this._fpsFrames = 0;
    }
  }

  saveState() {
    writeSave({
      player: { x: telemetry.x, z: telemetry.z, heading: telemetry.heading },
      cameraMode: this.rig.mode,
      timeOfDay: this.timeOfDay,
      headlights: this.vehicle.headlights,
    });
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose() {
    this.pause();
    this.saveState();
    window.removeEventListener("resize", this._onResize);
    this._unsubs.forEach((u) => u());
    this.keyboard?.dispose();
    this.audio?.dispose();
    this.renderer?.dispose();
  }
}
