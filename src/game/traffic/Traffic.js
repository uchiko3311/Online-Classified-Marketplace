import * as THREE from "three";
import * as CANNON from "cannon-es";

const CAR_COLORS = ["#b23b3b", "#2f6bb0", "#d7d7d7", "#2c2f36", "#4a7a4a", "#c9a23a"];

function makeTrafficCar(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.9, 4.0),
    new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.5 })
  );
  body.position.y = 0.7;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.7, 2.0),
    new THREE.MeshStandardMaterial({ color: "#11151b", metalness: 0.2, roughness: 0.3 })
  );
  cabin.position.set(0, 1.35, -0.2);
  g.add(cabin);
  const tailMat = new THREE.MeshStandardMaterial({
    color: "#3a0000",
    emissive: "#ff2020",
    emissiveIntensity: 0.6,
  });
  for (const sx of [-0.6, 0.6]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.06), tailMat);
    tl.position.set(sx, 0.8, -2.02);
    g.add(tl);
  }
  return g;
}

export class Traffic {
  constructor(scene, physics, layout, count) {
    this.scene = scene;
    this.physics = physics;
    this.layout = layout;
    this.cars = [];
    this._tmpDir = new THREE.Vector3();
    for (let i = 0; i < count; i++) this._spawnCar(i);
  }

  _randomNodeNearPlayer(px, pz, minR = 60, maxR = 200) {
    const nodes = this.layout.nodes;
    for (let tries = 0; tries < 30; tries++) {
      const n = nodes[Math.floor(Math.random() * nodes.length)];
      const d = Math.hypot(n.x - px, n.z - pz);
      if (d > minR && d < maxR && this.layout.adjacency[n.id].length) return n;
    }
    return nodes[Math.floor(Math.random() * nodes.length)];
  }

  _spawnCar() {
    const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    const mesh = makeTrafficCar(color);
    this.scene.add(mesh);
    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.9, 0.6, 2.0)));
    this.physics.world.addBody(body);
    const from = this.layout.nodes[Math.floor(Math.random() * this.layout.nodes.length)];
    const nbrs = this.layout.adjacency[from.id];
    const to = this.layout.nodes[nbrs[Math.floor(Math.random() * nbrs.length)].to];
    const car = {
      mesh,
      body,
      from,
      to,
      p: Math.random(),
      speed: 7 + Math.random() * 6,
    };
    this.cars.push(car);
    this._place(car, 0, 0);
  }

  _pickNext(car) {
    const nbrs = this.layout.adjacency[car.to.id];
    const options = nbrs.filter((n) => n.to !== car.from.id);
    const pool = options.length ? options : nbrs;
    const next = pool[Math.floor(Math.random() * pool.length)];
    car.from = car.to;
    car.to = this.layout.nodes[next.to];
    car.p = 0;
  }

  _place(car) {
    const a = car.from;
    const b = car.to;
    const x = a.x + (b.x - a.x) * car.p;
    const z = a.z + (b.z - a.z) * car.p;
    // right-hand lane offset
    this._tmpDir.set(b.x - a.x, 0, b.z - a.z).normalize();
    const ox = this._tmpDir.z * 2.6;
    const oz = -this._tmpDir.x * 2.6;
    const heading = Math.atan2(this._tmpDir.x, this._tmpDir.z);
    car.mesh.position.set(x + ox, 0, z + oz);
    car.mesh.rotation.y = heading;
    car.body.position.set(x + ox, 0.6, z + oz);
    car.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), heading);
  }

  update(dt, playerPos) {
    for (const car of this.cars) {
      const a = car.from;
      const b = car.to;
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;

      // simple avoidance: slow if player is just ahead on same tile
      const dPlayer = Math.hypot(car.mesh.position.x - playerPos.x, car.mesh.position.z - playerPos.z);
      const speed = dPlayer < 8 ? car.speed * 0.25 : car.speed;

      const prevX = car.mesh.position.x;
      const prevZ = car.mesh.position.z;
      car.p += (speed * dt) / len;
      if (car.p >= 1) this._pickNext(car);
      this._place(car);

      // kinematic velocity for contact resolution
      car.body.velocity.set(
        (car.mesh.position.x - prevX) / dt,
        0,
        (car.mesh.position.z - prevZ) / dt
      );

      // recycle if far away
      if (dPlayer > 260) {
        const n = this._randomNodeNearPlayer(playerPos.x, playerPos.z);
        const nbrs = this.layout.adjacency[n.id];
        car.from = n;
        car.to = this.layout.nodes[nbrs[Math.floor(Math.random() * nbrs.length)].to];
        car.p = 0;
        this._place(car);
      }
    }
  }
}

export class Pedestrians {
  constructor(scene, layout, count) {
    this.scene = scene;
    this.layout = layout;
    this.peds = [];
    const bodyMat = new THREE.MeshStandardMaterial({ color: "#6b5b8a", roughness: 1 });
    const headMat = new THREE.MeshStandardMaterial({ color: "#caa987", roughness: 1 });
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.7, 3, 6), bodyMat);
      torso.position.y = 0.9;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), headMat);
      head.position.y = 1.5;
      g.add(torso, head);
      scene.add(g);
      this.peds.push({
        mesh: g,
        dir: Math.random() * Math.PI * 2,
        speed: 1 + Math.random(),
        phase: Math.random() * 6,
      });
    }
  }

  update(dt, playerPos) {
    for (const p of this.peds) {
      p.phase += dt * p.speed * 4;
      const m = p.mesh;
      m.position.x += Math.sin(p.dir) * p.speed * dt;
      m.position.z += Math.cos(p.dir) * p.speed * dt;
      m.rotation.y = p.dir;
      m.position.y = Math.abs(Math.sin(p.phase)) * 0.06; // bob
      const d = Math.hypot(m.position.x - playerPos.x, m.position.z - playerPos.z);
      if (d > 120 || d < 1) {
        // respawn on a sidewalk near the player
        const ang = Math.random() * Math.PI * 2;
        const r = 25 + Math.random() * 60;
        m.position.set(playerPos.x + Math.cos(ang) * r, 0, playerPos.z + Math.sin(ang) * r);
        p.dir = Math.random() * Math.PI * 2;
      }
    }
  }
}
