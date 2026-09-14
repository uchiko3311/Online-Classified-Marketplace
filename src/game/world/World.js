import * as THREE from "three";
import * as CANNON from "cannon-es";
import { asphaltTexture, grassTexture, facadeTextures } from "./textures.js";

export class World {
  constructor(scene, physics, layout, quality = "medium") {
    this.scene = scene;
    this.physics = physics;
    this.layout = layout;
    this.quality = quality;
    this.lightPositions = [];
    this.buildingMat = null;
    this._build();
  }

  _addStaticBox(hx, hy, hz, x, y, z) {
    const body = new CANNON.Body({ mass: 0, material: this.physics.groundMaterial });
    body.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
    body.position.set(x, y, z);
    this.physics.world.addBody(body);
    return body;
  }

  _build() {
    const { layout } = this;
    const L = layout.HALF * 2 + 12;

    // --- Terrain ---
    const grass = grassTexture();
    grass.repeat.set(40, 40);
    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(L * 2.2, L * 2.2),
      new THREE.MeshStandardMaterial({ map: grass, roughness: 1 })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    // Ground physics plane
    const ground = new CANNON.Body({ mass: 0, material: this.physics.groundMaterial });
    ground.addShape(new CANNON.Plane());
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.physics.world.addBody(ground);

    // --- Roads ---
    const asphalt = asphaltTexture();
    asphalt.repeat.set(L / 8, 1.4);
    const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.9 });
    const curbMat = new THREE.MeshStandardMaterial({ color: "#6b6f77", roughness: 1 });
    const roadW = layout.ROAD_HALF * 2;

    const roadGroup = new THREE.Group();
    for (let n = 0; n < layout.GRID; n++) {
      const pos = n * layout.BLOCK - layout.HALF;
      // horizontal (spans X, fixed Z)
      const curbH = new THREE.Mesh(new THREE.PlaneGeometry(L, roadW + 3), curbMat);
      curbH.rotation.x = -Math.PI / 2;
      curbH.position.set(0, 0.01, pos);
      roadGroup.add(curbH);
      const roadH = new THREE.Mesh(new THREE.PlaneGeometry(L, roadW), roadMat);
      roadH.rotation.x = -Math.PI / 2;
      roadH.position.set(0, 0.02, pos);
      roadGroup.add(roadH);
      // vertical (spans Z, fixed X)
      const curbV = new THREE.Mesh(new THREE.PlaneGeometry(roadW + 3, L), curbMat);
      curbV.rotation.x = -Math.PI / 2;
      curbV.position.set(pos, 0.01, 0);
      roadGroup.add(curbV);
      const roadV = new THREE.Mesh(new THREE.PlaneGeometry(roadW, L), roadMat);
      roadV.rotation.x = -Math.PI / 2;
      roadV.position.set(pos, 0.02, 0);
      roadGroup.add(roadV);
    }
    roadGroup.traverse((m) => (m.receiveShadow = true));
    this.scene.add(roadGroup);

    // --- Buildings (instanced) with colliders ---
    const { map, emissive } = facadeTextures();
    const bMat = new THREE.MeshStandardMaterial({
      map,
      emissiveMap: emissive,
      emissive: new THREE.Color("#fff2cc"),
      emissiveIntensity: 0,
      roughness: 0.85,
      metalness: 0.05,
    });
    this.buildingMat = bMat;
    const buildings = layout.buildings;
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const inst = new THREE.InstancedMesh(boxGeo, bMat, buildings.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const color = new THREE.Color();
    buildings.forEach((b, i) => {
      m4.compose(
        new THREE.Vector3(b.x, b.h / 2, b.z),
        q,
        new THREE.Vector3(b.w, b.h, b.d)
      );
      inst.setMatrixAt(i, m4);
      inst.setColorAt(i, color.set(b.color));
      this._addStaticBox(b.w / 2, b.h / 2, b.d / 2, b.x, b.h / 2, b.z);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    this.scene.add(inst);

    // --- Trees (instanced trunk + foliage) ---
    const trees = layout.trees;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.24, 2.0, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: "#5b4633", roughness: 1 });
    const folGeo = new THREE.IcosahedronGeometry(1.4, 0);
    const folMat = new THREE.MeshStandardMaterial({ color: "#4a6b39", roughness: 1, flatShading: true });
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
    const folInst = new THREE.InstancedMesh(folGeo, folMat, trees.length);
    folInst.castShadow = true;
    trees.forEach((t, i) => {
      const s = t.s;
      m4.compose(new THREE.Vector3(t.x, s, t.z), q, new THREE.Vector3(s, s * 1.2, s));
      trunkInst.setMatrixAt(i, m4);
      m4.compose(
        new THREE.Vector3(t.x, 2.0 * s + 1.0 * s, t.z),
        q,
        new THREE.Vector3(s * 1.3, s * 1.5, s * 1.3)
      );
      folInst.setMatrixAt(i, m4);
      this._addStaticBox(0.35 * s, 1.2 * s, 0.35 * s, t.x, 1.2 * s, t.z);
    });
    trunkInst.instanceMatrix.needsUpdate = true;
    folInst.instanceMatrix.needsUpdate = true;
    this.scene.add(trunkInst);
    this.scene.add(folInst);

    // --- Street lights (instanced poles) + light positions for pool ---
    const lights = layout.lights;
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.11, 6, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: "#2a2d33", metalness: 0.6, roughness: 0.5 });
    const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, lights.length);
    const lampGeo = new THREE.SphereGeometry(0.22, 8, 8);
    this.lampMat = new THREE.MeshStandardMaterial({
      color: "#fff3cf",
      emissive: "#ffdf9e",
      emissiveIntensity: 0,
    });
    const lampInst = new THREE.InstancedMesh(lampGeo, this.lampMat, lights.length);
    lights.forEach((l, i) => {
      m4.compose(new THREE.Vector3(l.x, 3, l.z), q, new THREE.Vector3(1, 1, 1));
      poleInst.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(l.x, 6, l.z), q, new THREE.Vector3(1, 1, 1));
      lampInst.setMatrixAt(i, m4);
      this.lightPositions.push(new THREE.Vector3(l.x, 6, l.z));
    });
    poleInst.instanceMatrix.needsUpdate = true;
    lampInst.instanceMatrix.needsUpdate = true;
    this.scene.add(poleInst);
    this.scene.add(lampInst);

    // --- River + bridge ---
    this._buildRiver();
    this._buildBridge();

    // --- Landmarks ---
    this._buildCathedral(layout.cathedral);
    this._buildMonastery(layout.monastery);

    // --- Boundary barriers ---
    const edge = layout.HALF + layout.BLOCK * 1.2;
    const barMat = new THREE.MeshStandardMaterial({ color: "#3a3d44", roughness: 0.9 });
    const mkBar = (w, d, x, z) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), barMat);
      bar.position.set(x, 0.6, z);
      this.scene.add(bar);
      this._addStaticBox(w / 2, 0.6, d / 2, x, 0.6, z);
    };
    mkBar(edge * 2, 0.6, 0, -edge);
    mkBar(0.6, edge * 2, -edge, 0);
    mkBar(0.6, edge * 2, edge, 0);
    // north barrier only outside the bridge gap
    mkBar(edge, 0.6, -edge / 2 - 3, edge);
    mkBar(edge, 0.6, edge / 2 + 3, edge);
  }

  _buildRiver() {
    const r = this.layout.river;
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(r.length, r.width),
      new THREE.MeshStandardMaterial({
        color: "#2b5b78",
        metalness: 0.6,
        roughness: 0.25,
        transparent: true,
        opacity: 0.9,
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.4, r.z);
    this.scene.add(water);
    this.waterMat = water.material;

    // river banks (visual + collider so cars don't dive in outside the bridge)
    const bankMat = new THREE.MeshStandardMaterial({ color: "#5a5346", roughness: 1 });
    for (const s of [-1, 1]) {
      const bank = new THREE.Mesh(new THREE.BoxGeometry(r.length, 1, 3), bankMat);
      bank.position.set(0, 0.1, r.z + s * (r.width / 2 + 1.5));
      this.scene.add(bank);
      this._addStaticBox(r.length / 2, 0.9, 1.5, 0, 0.1, r.z + s * (r.width / 2 + 1.5));
    }
  }

  _buildBridge() {
    const b = this.layout.bridge;
    const len = b.z1 - b.z0;
    const cz = (b.z0 + b.z1) / 2;
    const deckMat = new THREE.MeshStandardMaterial({ color: "#4c4f57", roughness: 0.9 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(b.width, 0.4, len), deckMat);
    deck.position.set(b.x, 0.1, cz);
    deck.receiveShadow = true;
    this.scene.add(deck);
    this._addStaticBox(b.width / 2, 0.2, len / 2, b.x, 0.1, cz);
    const railMat = new THREE.MeshStandardMaterial({ color: "#c8ccd2", metalness: 0.5, roughness: 0.5 });
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, len), railMat);
      rail.position.set(b.x + s * (b.width / 2), 0.6, cz);
      this.scene.add(rail);
      this._addStaticBox(0.1, 0.4, len / 2, b.x + s * (b.width / 2), 0.6, cz);
    }
  }

  _buildCathedral(pos) {
    const stone = new THREE.MeshStandardMaterial({ color: "#d8ccae", roughness: 0.9 });
    const roofMat = new THREE.MeshStandardMaterial({ color: "#7a5a3a", roughness: 0.8 });
    const g = new THREE.Group();
    // cruciform base
    const base1 = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 10), stone);
    base1.position.y = 6;
    const base2 = new THREE.Mesh(new THREE.BoxGeometry(10, 12, 18), stone);
    base2.position.y = 6;
    g.add(base1, base2);
    base1.castShadow = base2.castShadow = true;
    // central drum + conical dome
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 8, 12), stone);
    drum.position.y = 16;
    const dome = new THREE.Mesh(new THREE.ConeGeometry(3.8, 6, 12), roofMat);
    dome.position.y = 23;
    g.add(drum, dome);
    dome.castShadow = true;
    // corner pinnacles
    for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(1.2, 4, 8), roofMat);
      t.position.set(dx, 13, dz);
      g.add(t);
    }
    g.position.set(pos.x, 0, pos.z);
    this.scene.add(g);
    this._addStaticBox(9, 8, 9, pos.x, 8, pos.z);
    this.cathedralPos = new THREE.Vector3(pos.x, 0, pos.z);
  }

  _buildMonastery(pos) {
    const stone = new THREE.MeshStandardMaterial({ color: "#cabf9f", roughness: 1 });
    const roofMat = new THREE.MeshStandardMaterial({ color: "#6b4f34", roughness: 0.9 });
    // hill platform
    const hill = new THREE.Mesh(
      new THREE.CylinderGeometry(26, 34, pos.y * 2, 16),
      new THREE.MeshStandardMaterial({ color: "#4c5a3c", roughness: 1 })
    );
    hill.position.set(pos.x, 0, pos.z);
    this.scene.add(hill);
    this._addStaticBox(24, pos.y, 24, pos.x, pos.y, pos.z);

    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 9, 8), stone);
    body.position.y = 4.5;
    const dome = new THREE.Mesh(new THREE.ConeGeometry(6.6, 5, 8), roofMat);
    dome.position.y = 11;
    g.add(body, dome);
    g.position.set(pos.x, pos.y, pos.z);
    g.castShadow = true;
    this.scene.add(g);
    this.monasteryPos = new THREE.Vector3(pos.x, pos.y, pos.z);
  }

  // Called by day/night manager. factor 0=day, 1=night.
  setNight(factor) {
    if (this.buildingMat) this.buildingMat.emissiveIntensity = factor * 1.0;
    if (this.lampMat) this.lampMat.emissiveIntensity = factor * 1.6;
  }
}
