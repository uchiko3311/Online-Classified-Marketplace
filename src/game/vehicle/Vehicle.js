import * as THREE from "three";
import * as CANNON from "cannon-es";
import { buildCar, WHEEL_RADIUS } from "./buildCar.js";
import { input } from "../state/inputState.js";
import { telemetry } from "../state/telemetry.js";

const MAX_STEER = 0.55;
const MAX_ENGINE_FORCE = 3200;
const MAX_BRAKE = 45;
const HANDBRAKE = 110;

export class Vehicle {
  constructor(scene, world, wheelMaterial) {
    this.scene = scene;
    this.world = world;

    const car = buildCar();
    this.car = car;
    scene.add(car.group);
    for (const w of car.wheels) scene.add(w);

    // Chassis body (mass biased low for stability)
    const chassisShape = new CANNON.Box(new CANNON.Vec3(1.0, 0.5, 2.25));
    const body = new CANNON.Body({ mass: 1650 });
    body.addShape(chassisShape, new CANNON.Vec3(0, 0.1, 0));
    body.angularDamping = 0.4;
    this.body = body;

    const vehicle = new CANNON.RaycastVehicle({
      chassisBody: body,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });

    const wheelOptions = {
      radius: WHEEL_RADIUS,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 34,
      suspensionRestLength: 0.35,
      frictionSlip: 2.2,
      dampingRelaxation: 2.4,
      dampingCompression: 4.3,
      maxSuspensionForce: 100000,
      rollInfluence: 0.03,
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0),
      maxSuspensionTravel: 0.35,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
    };

    const cx = 0.95;
    const cz = 1.5;
    const cy = -0.05;
    const points = [
      new CANNON.Vec3(cx, cy, cz), // FL
      new CANNON.Vec3(-cx, cy, cz), // FR
      new CANNON.Vec3(cx, cy, -cz), // RL
      new CANNON.Vec3(-cx, cy, -cz), // RR
    ];
    for (const p of points) {
      wheelOptions.chassisConnectionPointLocal = p.clone();
      vehicle.addWheel(wheelOptions);
    }
    vehicle.addToWorld(world);
    this.vehicle = vehicle;

    this.currentSteer = 0;
    this.blinkTimer = 0;
    this.blinkOn = false;
    this.headlights = false;
    this.leftBlink = false;
    this.rightBlink = false;
    this.hazard = false;
    this._upsideTime = 0;
  }

  setSpawn(x, z, heading = 0) {
    this.body.position.set(x, 1.2, z);
    this.body.velocity.setZero();
    this.body.angularVelocity.setZero();
    const q = new CANNON.Quaternion();
    q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), heading);
    this.body.quaternion.copy(q);
  }

  respawnUpright() {
    const p = this.body.position;
    this.setSpawn(p.x, p.z, telemetry.heading);
    this.body.position.y = 1.4;
  }

  update(dt) {
    const v = this.vehicle;

    // Steering with smoothing (less sensitive at speed)
    const speed = this.body.velocity.length();
    const steerLimit = MAX_STEER * (1 - Math.min(0.45, speed / 90));
    const targetSteer = input.steer * steerLimit;
    this.currentSteer += (targetSteer - this.currentSteer) * Math.min(1, dt * 8);
    v.setSteeringValue(this.currentSteer, 0);
    v.setSteeringValue(this.currentSteer, 1);

    // Throttle / brake / reverse
    let engineForce = 0;
    let brake = 0;
    const forwardVec = new CANNON.Vec3(0, 0, 1);
    this.body.quaternion.vmult(forwardVec, forwardVec);
    const forwardSpeed = this.body.velocity.dot(forwardVec); // + forward

    if (input.throttle > 0) engineForce = -MAX_ENGINE_FORCE * input.throttle;
    if (input.reverse > 0) engineForce = MAX_ENGINE_FORCE * 0.6 * input.reverse;
    // brake pedal: if moving forward and pressing brake, brake; else it also
    // acts to stop reverse
    if (input.brake > 0) {
      if (forwardSpeed > 0.5) {
        brake = MAX_BRAKE * input.brake;
        engineForce = 0;
      } else {
        engineForce = MAX_ENGINE_FORCE * 0.55 * input.brake; // reverse via brake when stopped
      }
    }

    for (let i = 0; i < 4; i++) v.applyEngineForce(engineForce, i);
    for (let i = 0; i < 4; i++) v.setBrake(brake, i);

    if (input.handbrake) {
      v.setBrake(HANDBRAKE, 2);
      v.setBrake(HANDBRAKE, 3);
    }

    // idle rolling resistance
    if (engineForce === 0 && brake === 0 && !input.handbrake) {
      for (let i = 0; i < 4; i++) v.setBrake(2.5, i);
    }

    // Sync wheel meshes
    for (let i = 0; i < 4; i++) {
      v.updateWheelTransform(i);
      const t = v.wheelInfos[i].worldTransform;
      const wheel = this.car.wheels[i];
      wheel.position.copy(t.position);
      wheel.quaternion.copy(t.quaternion);
    }

    // Sync body mesh
    this.car.group.position.copy(this.body.position);
    this.car.group.quaternion.copy(this.body.quaternion);

    // Steering wheel visual
    this.car.steeringPivot.rotation.z = -(this.currentSteer / MAX_STEER) * 3.0;

    // --- Lights ---
    const braking = input.brake > 0 && forwardSpeed > 0.3;
    const reversing = engineForce > 0 && forwardSpeed < 0.5;
    for (const l of this.car.lights.brake) {
      l.material.emissiveIntensity = braking ? 1.6 : 0.15;
    }
    for (const l of this.car.lights.reverse) {
      l.material.emissiveIntensity = reversing ? 1.4 : 0;
    }
    for (const l of this.car.lights.head) {
      l.material.emissiveIntensity = this.headlights ? 1.8 : 0;
    }
    for (const sl of this.car.headlightLights) {
      sl.intensity = this.headlights ? 3.2 : 0;
    }

    // Indicators / hazard blink
    this.blinkTimer += dt;
    if (this.blinkTimer > 0.45) {
      this.blinkTimer = 0;
      this.blinkOn = !this.blinkOn;
    }
    const leftActive = this.leftBlink || this.hazard;
    const rightActive = this.rightBlink || this.hazard;
    for (const l of this.car.lights.left)
      l.material.emissiveIntensity = leftActive && this.blinkOn ? 2.2 : 0;
    for (const l of this.car.lights.right)
      l.material.emissiveIntensity = rightActive && this.blinkOn ? 2.2 : 0;

    // --- Telemetry ---
    const kmh = Math.abs(forwardSpeed) * 3.6;
    telemetry.speedKmh = kmh;
    telemetry.x = this.body.position.x;
    telemetry.z = this.body.position.z;
    const e = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion(
        this.body.quaternion.x,
        this.body.quaternion.y,
        this.body.quaternion.z,
        this.body.quaternion.w
      ),
      "YXZ"
    );
    telemetry.heading = e.y;
    telemetry.throttle = input.throttle;
    telemetry.brake = input.brake;

    // gear + rpm model (purely for display, derived from real speed)
    const gearSpeeds = [0, 25, 50, 80, 120, 170];
    let gear = 1;
    for (let g = 1; g < gearSpeeds.length; g++) {
      if (kmh >= gearSpeeds[g - 1]) gear = g;
    }
    if (reversing) telemetry.gear = 0; // R
    else telemetry.gear = gear;
    const within =
      (kmh - gearSpeeds[Math.max(0, gear - 1)]) /
      Math.max(1, gearSpeeds[gear] - gearSpeeds[gear - 1]);
    telemetry.rpm = 900 + Math.min(1, within + input.throttle * 0.4) * 5600;

    // Flip recovery
    const up = new CANNON.Vec3(0, 1, 0);
    const bodyUp = new CANNON.Vec3(0, 1, 0);
    this.body.quaternion.vmult(bodyUp, bodyUp);
    if (bodyUp.dot(up) < 0.1 && speed < 1) {
      this._upsideTime += dt;
      if (this._upsideTime > 2.5) {
        this.respawnUpright();
        this._upsideTime = 0;
      }
    } else {
      this._upsideTime = 0;
    }
  }
}
