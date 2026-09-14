import * as THREE from "three";
import { telemetry } from "../state/telemetry.js";

export const CAMERA_MODES = ["chase", "close", "first", "interior"];

const OFFSETS = {
  chase: { pos: new THREE.Vector3(0, 4.2, -8.5), look: new THREE.Vector3(0, 1.6, 6) },
  close: { pos: new THREE.Vector3(0, 2.6, -5.0), look: new THREE.Vector3(0, 1.4, 6) },
  first: { pos: new THREE.Vector3(-0.35, 1.65, 0.9), look: new THREE.Vector3(-0.35, 1.55, 8) },
  interior: { pos: new THREE.Vector3(-0.5, 1.42, 0.15), look: new THREE.Vector3(-0.5, 1.3, 8) },
};

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = "chase";
    this._lookTarget = new THREE.Vector3();
    this._prevSpeed = 0;
    this._shake = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._initialized = false;
  }

  setMode(mode) {
    if (CAMERA_MODES.includes(mode)) {
      this.mode = mode;
      telemetry.cameraMode = mode;
      this._initialized = false;
    }
  }

  cycle() {
    const idx = CAMERA_MODES.indexOf(this.mode);
    this.setMode(CAMERA_MODES[(idx + 1) % CAMERA_MODES.length]);
  }

  update(dt, vehicle) {
    const group = vehicle.car.group;
    group.updateWorldMatrix(true, false);
    const conf = OFFSETS[this.mode];
    const rigid = this.mode === "first" || this.mode === "interior";

    const desiredPos = conf.pos.clone();
    group.localToWorld(desiredPos);
    const lookPos = conf.look.clone();
    group.localToWorld(lookPos);

    // shake from longitudinal acceleration
    const speed = telemetry.speedKmh;
    const accel = (speed - this._prevSpeed) / Math.max(dt, 0.001);
    this._prevSpeed = speed;
    const shakeAmt = rigid ? 0.012 : 0.004;
    const jitter = (Math.min(Math.abs(accel), 60) / 60) * shakeAmt + (speed / 200) * shakeAmt;
    this._shake.set(
      (Math.random() - 0.5) * jitter,
      (Math.random() - 0.5) * jitter,
      0
    );

    if (!this._initialized) {
      this.camera.position.copy(desiredPos);
      this._lookTarget.copy(lookPos);
      this._initialized = true;
    }

    if (rigid) {
      this.camera.position.copy(desiredPos).add(this._shake);
      this._lookTarget.lerp(lookPos, Math.min(1, dt * 20));
    } else {
      const k = Math.min(1, dt * (this.mode === "close" ? 8 : 5));
      this.camera.position.lerp(desiredPos, k);
      this._lookTarget.lerp(lookPos, Math.min(1, dt * 6));
    }
    this.camera.lookAt(this._lookTarget);
  }
}
