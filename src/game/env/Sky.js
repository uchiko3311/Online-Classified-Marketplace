import * as THREE from "three";

const DAY_SKY = new THREE.Color("#8fb6dd");
const DUSK_SKY = new THREE.Color("#e8935a");
const NIGHT_SKY = new THREE.Color("#0a1020");

export class Sky {
  constructor(scene, quality = "medium") {
    this.scene = scene;
    this.quality = quality;
    this.weather = "clear";

    this.hemi = new THREE.HemisphereLight(0xbfd4ff, 0x4a4436, 0.6);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff2d8, 1.5);
    this.sun.castShadow = quality !== "low";
    const s = quality === "high" ? 2048 : 1024;
    this.sun.shadow.mapSize.set(s, s);
    const d = 120;
    this.sun.shadow.camera.left = -d;
    this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d;
    this.sun.shadow.camera.bottom = -d;
    this.sun.shadow.camera.far = 400;
    this.sun.shadow.bias = -0.0004;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(this.ambient);

    scene.fog = new THREE.Fog(DAY_SKY.getHex(), 120, 620);
    scene.background = DAY_SKY.clone();

    this.nightFactor = 0;
    this._buildRain();
  }

  _buildRain() {
    const count = this.quality === "high" ? 4000 : this.quality === "low" ? 1200 : 2400;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 120;
      pos[i * 3 + 1] = Math.random() * 60;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xafc8e6 & 0xffffff,
      size: 0.28,
      transparent: true,
      opacity: 0.5,
    });
    mat.color = new THREE.Color("#a8c4e6");
    this.rain = new THREE.Points(geo, mat);
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  setWeather(w) {
    this.weather = w;
    this.rain.visible = w === "rain";
  }

  setTime(hours) {
    this.hours = hours;
    // Sun elevation: peak at 13:00, below horizon at night
    const t = ((hours - 6) / 12) * Math.PI; // 6->0, 18->PI
    const elevation = Math.sin(t); // -1..1
    const azimuth = ((hours - 6) / 24) * Math.PI * 2;
    const dist = 200;
    const y = Math.sin(t) * dist;
    const x = Math.cos(azimuth) * dist;
    const z = Math.sin(azimuth) * dist * 0.4;
    this.sun.position.set(x, Math.max(6, y), z);

    const dayAmount = Math.max(0, elevation);
    this.nightFactor = 1 - Math.min(1, dayAmount * 1.4);

    // dusk tint when sun is low
    const duskAmount = Math.max(0, 1 - Math.abs(elevation) * 3) * (elevation > -0.2 ? 1 : 0);

    let weatherDim = 1;
    if (this.weather === "cloudy") weatherDim = 0.55;
    if (this.weather === "rain") weatherDim = 0.4;

    this.sun.intensity = dayAmount * 2.2 * weatherDim;
    this.hemi.intensity = (0.25 + dayAmount * 0.7) * (this.weather === "clear" ? 1 : 0.7);
    this.ambient.intensity = 0.12 + dayAmount * 0.22;

    const sky = new THREE.Color();
    sky.copy(NIGHT_SKY).lerp(DAY_SKY, dayAmount);
    sky.lerp(DUSK_SKY, duskAmount * 0.6);
    if (this.weather !== "clear") sky.lerp(new THREE.Color("#5a6472"), 0.5);
    this.scene.background.copy(sky);
    if (this.scene.fog) {
      this.scene.fog.color.copy(sky);
      this.scene.fog.near = this.weather === "rain" ? 40 : 120;
      this.scene.fog.far = this.weather === "rain" ? 340 : this.nightFactor > 0.5 ? 420 : 620;
    }
  }

  update(dt, cameraPos) {
    if (this.rain.visible && cameraPos) {
      const p = this.rain.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - dt * 55;
        if (y < 0) y = 60;
        p.setY(i, y);
      }
      p.needsUpdate = true;
      this.rain.position.set(cameraPos.x, 0, cameraPos.z);
    }
    // keep sun shadow focused near the camera
    if (cameraPos) {
      this.sun.target.position.set(cameraPos.x, 0, cameraPos.z);
      const dir = this.sun.position.clone().normalize().multiplyScalar(200);
      this.sun.position.set(cameraPos.x + dir.x, dir.y, cameraPos.z + dir.z);
    }
  }
}
