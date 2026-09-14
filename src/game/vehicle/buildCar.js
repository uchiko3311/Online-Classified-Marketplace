import * as THREE from "three";

// Builds a boxy, G-Class-inspired luxury SUV. This is an original stylized
// model, NOT an official Mercedes-AMG asset.
export const WHEEL_RADIUS = 0.46;
export const WHEEL_WIDTH = 0.34;

function mat(color, metalness = 0.5, roughness = 0.5, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
}

function box(w, h, d, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

export function buildCar(paint = "#1c1f24") {
  const group = new THREE.Group();

  const bodyMat = mat(paint, 0.55, 0.45);
  const trimMat = mat("#111318", 0.4, 0.6);
  const chromeMat = mat("#c8ccd2", 0.9, 0.2);
  const glassMat = new THREE.MeshStandardMaterial({
    color: "#0d1218",
    metalness: 0.1,
    roughness: 0.05,
    transparent: true,
    opacity: 0.55,
  });

  // --- Lower body / cabin (tall, upright G-wagon silhouette) ---
  const lower = box(2.0, 0.9, 4.5, bodyMat);
  lower.position.y = 0.55;
  lower.castShadow = true;
  group.add(lower);

  const cabin = box(1.94, 0.95, 3.0, bodyMat);
  cabin.position.set(0, 1.42, -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  const roof = box(1.96, 0.12, 3.02, trimMat);
  roof.position.set(0, 1.95, -0.2);
  group.add(roof);

  // roof rails
  for (const sx of [-0.85, 0.85]) {
    const rail = box(0.06, 0.08, 2.9, trimMat);
    rail.position.set(sx, 2.05, -0.2);
    group.add(rail);
  }

  // Fender flares
  for (const sx of [-1.0, 1.0]) {
    for (const sz of [1.5, -1.4]) {
      const flare = box(0.14, 0.5, 1.0, trimMat);
      flare.position.set(sx, 0.45, sz);
      group.add(flare);
    }
  }

  // --- Glass ---
  const windshield = box(1.7, 0.8, 0.08, glassMat);
  windshield.position.set(0, 1.45, 1.32);
  group.add(windshield);
  const rearGlass = box(1.7, 0.75, 0.08, glassMat);
  rearGlass.position.set(0, 1.45, -1.72);
  group.add(rearGlass);
  for (const sx of [-0.99, 0.99]) {
    const side = box(0.06, 0.62, 2.5, glassMat);
    side.position.set(sx, 1.5, -0.2);
    group.add(side);
  }

  // Grille + headlights (front = +Z)
  const grille = box(1.5, 0.5, 0.1, mat("#0a0c10", 0.6, 0.5));
  grille.position.set(0, 0.75, 2.27);
  group.add(grille);
  for (let i = -3; i <= 3; i++) {
    const bar = box(1.5, 0.03, 0.02, chromeMat);
    bar.position.set(0, 0.75 + i * 0.07, 2.32);
    group.add(bar);
  }

  const headMat = new THREE.MeshStandardMaterial({
    color: "#fdfbe6",
    emissive: "#fff4c0",
    emissiveIntensity: 0,
    metalness: 0.1,
    roughness: 0.2,
  });
  const brakeMat = new THREE.MeshStandardMaterial({
    color: "#4a0d0d",
    emissive: "#ff1a1a",
    emissiveIntensity: 0.15,
    roughness: 0.4,
  });
  const reverseMat = new THREE.MeshStandardMaterial({
    color: "#e8e8e8",
    emissive: "#ffffff",
    emissiveIntensity: 0,
    roughness: 0.4,
  });
  const indMat = () =>
    new THREE.MeshStandardMaterial({
      color: "#5a3a00",
      emissive: "#ff9500",
      emissiveIntensity: 0,
      roughness: 0.4,
    });

  const lights = { head: [], brake: [], reverse: [], left: [], right: [] };

  for (const sx of [-0.62, 0.62]) {
    const hl = box(0.42, 0.28, 0.06, headMat.clone());
    hl.position.set(sx, 0.9, 2.3);
    group.add(hl);
    lights.head.push(hl);
  }
  // rear lights (rear = -Z)
  for (const sx of [-0.7, 0.7]) {
    const tl = box(0.34, 0.5, 0.06, brakeMat.clone());
    tl.position.set(sx, 0.95, -2.28);
    group.add(tl);
    lights.brake.push(tl);

    const rl = box(0.2, 0.16, 0.06, reverseMat.clone());
    rl.position.set(sx * 0.55, 0.62, -2.28);
    group.add(rl);
    lights.reverse.push(rl);
  }
  // indicators front + rear
  const addInd = (x, z, side) => {
    const m = indMat();
    const ind = box(0.22, 0.12, 0.06, m);
    ind.position.set(x, 0.66, z);
    group.add(ind);
    lights[side].push(ind);
  };
  addInd(-0.86, 2.28, "left");
  addInd(0.86, 2.28, "right");
  addInd(-0.92, -2.26, "left");
  addInd(0.92, -2.26, "right");

  // Bumpers
  const fb = box(2.0, 0.3, 0.25, trimMat);
  fb.position.set(0, 0.4, 2.3);
  group.add(fb);
  const rb = box(2.0, 0.3, 0.25, trimMat);
  rb.position.set(0, 0.4, -2.3);
  group.add(rb);

  // Spare wheel on tailgate (G-class signature)
  const spare = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.24, 20),
    mat("#0c0d10", 0.2, 0.8)
  );
  spare.rotation.x = Math.PI / 2;
  spare.position.set(0.1, 1.05, -2.42);
  group.add(spare);

  // Mirrors
  for (const sx of [-1.05, 1.05]) {
    const m = box(0.26, 0.16, 0.12, trimMat);
    m.position.set(sx, 1.35, 1.05);
    group.add(m);
  }

  // Exhaust
  for (const sx of [-0.6, 0.6]) {
    const ex = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.2, 10),
      chromeMat
    );
    ex.rotation.x = Math.PI / 2;
    ex.position.set(sx, 0.32, -2.4);
    group.add(ex);
  }

  // --- Interior (visible in first-person / interior cameras) ---
  const interior = new THREE.Group();
  const dashMat = mat("#15171c", 0.2, 0.8);
  const dash = box(1.85, 0.35, 0.5, dashMat);
  dash.position.set(0, 1.15, 1.0);
  interior.add(dash);

  // instrument cluster (screen)
  const cluster = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.22),
    new THREE.MeshBasicMaterial({ color: "#0a1a1c" })
  );
  cluster.position.set(-0.55, 1.22, 0.78);
  cluster.rotation.x = -0.25;
  interior.add(cluster);

  // center screen
  const centerScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.26),
    new THREE.MeshBasicMaterial({ color: "#0a1420" })
  );
  centerScreen.position.set(0.15, 1.2, 0.79);
  centerScreen.rotation.x = -0.18;
  interior.add(centerScreen);

  // center console
  const console_ = box(0.4, 0.4, 1.2, dashMat);
  console_.position.set(0, 0.85, 0.1);
  interior.add(console_);

  // seats
  const seatMat = mat("#20140c", 0.1, 0.9);
  for (const sx of [-0.5, 0.5]) {
    const seat = box(0.55, 0.5, 0.55, seatMat);
    seat.position.set(sx, 0.95, -0.35);
    interior.add(seat);
    const back = box(0.55, 0.7, 0.18, seatMat);
    back.position.set(sx, 1.25, -0.62);
    interior.add(back);
  }

  // steering wheel (left-hand drive), pivot so it rotates around column axis
  const steeringPivot = new THREE.Group();
  steeringPivot.position.set(-0.55, 1.08, 0.62);
  steeringPivot.rotation.x = -0.5;
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.028, 10, 28),
    mat("#0c0d10", 0.3, 0.6)
  );
  steeringPivot.add(rim);
  for (let a = 0; a < 3; a++) {
    const spoke = box(0.32, 0.03, 0.02, mat("#1a1c22", 0.4, 0.5));
    spoke.rotation.z = (a * Math.PI * 2) / 3;
    steeringPivot.add(spoke);
  }
  const hub = new THREE.Mesh(
    new THREE.CircleGeometry(0.06, 16),
    mat("#c8ccd2", 0.8, 0.3)
  );
  hub.position.z = 0.01;
  steeringPivot.add(hub);
  interior.add(steeringPivot);

  group.add(interior);

  // --- Headlight spotlights (illuminate the road at night) ---
  const headlightLights = [];
  for (const sx of [-0.62, 0.62]) {
    const sl = new THREE.SpotLight(0xfff2cc, 0, 55, Math.PI / 6, 0.4, 1.2);
    sl.position.set(sx, 0.9, 2.3);
    const tgt = new THREE.Object3D();
    tgt.position.set(sx, -1.5, 18);
    group.add(tgt);
    sl.target = tgt;
    group.add(sl);
    headlightLights.push(sl);
  }

  // Wheels (added to scene separately, positioned by physics)
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(
    WHEEL_RADIUS,
    WHEEL_RADIUS,
    WHEEL_WIDTH,
    18
  );
  const tireMat = mat("#0b0c0e", 0.1, 0.85);
  const rimMat = mat("#c8ccd2", 0.9, 0.25);
  for (let i = 0; i < 4; i++) {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.rotation.z = Math.PI / 2; // align cylinder axis to X
    tire.castShadow = true;
    wheel.add(tire);
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(WHEEL_RADIUS * 0.55, WHEEL_RADIUS * 0.55, WHEEL_WIDTH + 0.02, 8),
      rimMat
    );
    rim.rotation.z = Math.PI / 2;
    wheel.add(rim);
    wheels.push(wheel);
  }

  function setPaint(color) {
    bodyMat.color.set(color);
  }

  return { group, interior, wheels, steeringPivot, lights, headlightLights, setPaint, bodyMat };
}
