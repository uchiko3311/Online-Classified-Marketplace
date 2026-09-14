import * as THREE from "three";
import * as CANNON from "cannon-es";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  asphaltTexture,
  asphaltRoughness,
  grassTexture,
  sidewalkTexture,
  cobbleTexture,
  waterNormalTexture,
} from "./textures.js";
import { buildBuildings } from "./buildings.js";
import { isMajor } from "./cityLayout.js";

function scaleUV(geo, su, sv) {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  uv.needsUpdate = true;
  return geo;
}

export class World {
  constructor(scene, physics, layout, quality = "medium") {
    this.scene = scene;
    this.physics = physics;
    this.layout = layout;
    this.quality = quality;
    this.lightPositions = [];
    this.nightMats = [];
    this.lampMat = null;
    this._build();
  }

  _addStaticBox(hx, hy, hz, x, y, z, yaw = 0) {
    const body = new CANNON.Body({ mass: 0, material: this.physics.groundMaterial });
    body.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
    body.position.set(x, y, z);
    if (yaw) body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), yaw);
    this.physics.world.addBody(body);
    return body;
  }

  _mergeAdd(arr, mat, cast, receive) {
    if (!arr.length) return null;
    const merged = mergeGeometries(arr, false);
    for (const g of arr) g.dispose?.();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = !!cast;
    mesh.receiveShadow = !!receive;
    this.scene.add(mesh);
    return mesh;
  }

  _build() {
    const { layout } = this;
    const L = layout.HALF * 2 + 12;

    this._buildTerrain(L);
    this._buildRoads(L);
    this._buildBuildings();
    this._buildTrees();
    this._buildStreetLights();
    this._buildProps();
    this._buildRiver();
    this._buildBridge();
    this._buildCathedral(layout.cathedral);
    this._buildMonastery(layout.monastery);
    this._buildBoundary();
  }

  _buildTerrain(L) {
    const layout = this.layout;
    const grass = grassTexture();
    grass.repeat.set(60, 60);
    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(L * 3, L * 3),
      new THREE.MeshStandardMaterial({ map: grass, roughness: 1 })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.02;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    const ground = new CANNON.Body({ mass: 0, material: this.physics.groundMaterial });
    ground.addShape(new CANNON.Plane());
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.physics.world.addBody(ground);

    // Distant rolling hills for depth (visual backdrop only, outside play area).
    const hillMat = new THREE.MeshStandardMaterial({ color: "#57633f", roughness: 1 });
    const edge = layout.HALF + layout.BLOCK * 2;
    const hills = [];
    const rand = (() => {
      let s = 99173;
      return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    })();
    for (let i = 0; i < 26; i++) {
      const ang = (i / 26) * Math.PI * 2;
      const r = edge + 60 + rand() * 220;
      const hx = Math.cos(ang) * r;
      const hz = Math.sin(ang) * r * 0.9 + layout.river.z * 0.3;
      const rad = 60 + rand() * 120;
      const hgt = 20 + rand() * 70;
      const g = new THREE.SphereGeometry(1, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      g.scale(rad, hgt, rad);
      g.translate(hx, -4, hz);
      hills.push(g);
    }
    const merged = mergeGeometries(hills, false);
    const hillMesh = new THREE.Mesh(merged, hillMat);
    hillMesh.receiveShadow = true;
    this.scene.add(hillMesh);
    void L;
  }

  _buildRoads(L) {
    const layout = this.layout;
    const asphalt = asphaltTexture();
    const rough = asphaltRoughness();
    const roadMat = new THREE.MeshStandardMaterial({
      map: asphalt,
      roughnessMap: rough,
      roughness: 1,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const roadGeos = [];
    const curbGeos = [];
    const walkGeos = [];
    const markGeos = [];

    const curbMat = new THREE.MeshStandardMaterial({ color: "#8a8a86", roughness: 0.95 });
    const walkMat = new THREE.MeshStandardMaterial({ map: sidewalkTexture(), roughness: 0.95 });
    const markMat = new THREE.MeshStandardMaterial({
      color: "#d9d4c4",
      roughness: 0.7,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const SW = 3.4; // sidewalk width

    const addRoadLine = (horizontal, coord, half) => {
      const w = half * 2;
      // carriageway
      const road = new THREE.PlaneGeometry(horizontal ? L : w, horizontal ? w : L);
      road.rotateX(-Math.PI / 2);
      road.translate(horizontal ? 0 : coord, 0.02, horizontal ? coord : 0);
      scaleUV(road, horizontal ? L / 6 : w / 4, horizontal ? w / 4 : L / 6);
      roadGeos.push(road);

      // curbs + sidewalks on both sides
      for (const s of [-1, 1]) {
        const cOff = coord + s * (half + 0.15);
        const curb = new THREE.BoxGeometry(horizontal ? L : 0.3, 0.2, horizontal ? 0.3 : L);
        curb.translate(horizontal ? 0 : cOff, 0.1, horizontal ? cOff : 0);
        curbGeos.push(curb);

        const wOff = coord + s * (half + 0.3 + SW / 2);
        const walk = new THREE.PlaneGeometry(horizontal ? L : SW, horizontal ? SW : L);
        walk.rotateX(-Math.PI / 2);
        walk.translate(horizontal ? 0 : wOff, 0.16, horizontal ? wOff : 0);
        scaleUV(walk, horizontal ? L / 3.5 : SW / 3.5, horizontal ? SW / 3.5 : L / 3.5);
        walkGeos.push(walk);
      }

      // center dashes
      const dash = 3;
      const gap = 4.5;
      for (let p = -L / 2; p < L / 2; p += dash + gap) {
        const m = new THREE.PlaneGeometry(horizontal ? dash : 0.18, horizontal ? 0.18 : dash);
        m.rotateX(-Math.PI / 2);
        m.translate(horizontal ? p + dash / 2 : coord, 0.05, horizontal ? coord : p + dash / 2);
        markGeos.push(m);
      }
      // solid edge lines
      for (const s of [-1, 1]) {
        const eOff = coord + s * (half - 0.5);
        const edge = new THREE.PlaneGeometry(horizontal ? L : 0.12, horizontal ? 0.12 : L);
        edge.rotateX(-Math.PI / 2);
        edge.translate(horizontal ? 0 : eOff, 0.05, horizontal ? eOff : 0);
        markGeos.push(edge);
      }
    };

    for (let n = 0; n < layout.GRID; n++) {
      const pos = n * layout.BLOCK - layout.HALF;
      const half = isMajor(n) ? layout.ROAD_HALF + 2 : layout.ROAD_HALF;
      addRoadLine(true, pos, half);
      addRoadLine(false, pos, half);
    }

    // crosswalks (zebra) at major intersections
    for (let i = 0; i < layout.GRID; i++) {
      for (let j = 0; j < layout.GRID; j++) {
        if (!(isMajor(i) || isMajor(j))) continue;
        const nx = i * layout.BLOCK - layout.HALF;
        const nz = j * layout.BLOCK - layout.HALF;
        const half = layout.ROAD_HALF + 1;
        for (const [ax, az, horizontal] of [
          [0, half + 1.4, true],
          [0, -half - 1.4, true],
          [half + 1.4, 0, false],
          [-half - 1.4, 0, false],
        ]) {
          for (let bnum = -2; bnum <= 2; bnum++) {
            const bar = new THREE.PlaneGeometry(horizontal ? 0.5 : 2.4, horizontal ? 2.4 : 0.5);
            bar.rotateX(-Math.PI / 2);
            bar.translate(
              nx + ax + (horizontal ? bnum * 0.9 : 0),
              0.05,
              nz + az + (horizontal ? 0 : bnum * 0.9)
            );
            markGeos.push(bar);
          }
        }
      }
    }

    this._mergeAdd(roadGeos, roadMat, false, true);
    this._mergeAdd(curbGeos, curbMat, false, true);
    this._mergeAdd(walkGeos, walkMat, false, true);
    this._mergeAdd(markGeos, markMat, false, true);
  }

  _buildBuildings() {
    const { meshes, colliders, nightMats } = buildBuildings(this.layout, this.quality);
    for (const m of meshes) this.scene.add(m);
    for (const c of colliders) this._addStaticBox(c.hx, c.hy, c.hz, c.x, c.y, c.z, c.yaw);
    this.nightMats = nightMats;
  }

  _buildTrees() {
    const trees = this.layout.trees;
    const round = trees.filter((t) => t.kind !== "cypress");
    const cyp = trees.filter((t) => t.kind === "cypress");

    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const color = new THREE.Color();
    const trunkMat = new THREE.MeshStandardMaterial({ color: "#5a4630", roughness: 1 });

    // trunks for all trees
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 2.2, 6);
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
    trunkInst.castShadow = true;
    trees.forEach((t, i) => {
      const s = t.s;
      m4.compose(new THREE.Vector3(t.x, s * 1.1, t.z), q, new THREE.Vector3(s, s, s));
      trunkInst.setMatrixAt(i, m4);
      this._addStaticBox(0.35 * s, 1.3 * s, 0.35 * s, t.x, 1.3 * s, t.z);
    });
    trunkInst.instanceMatrix.needsUpdate = true;
    this.scene.add(trunkInst);

    // round broadleaf foliage (two stacked spheres, varied green)
    if (round.length) {
      const folGeo = new THREE.IcosahedronGeometry(1.5, 1);
      const folMat = new THREE.MeshStandardMaterial({ roughness: 0.9, vertexColors: false });
      const inst = new THREE.InstancedMesh(folGeo, folMat, round.length * 2);
      inst.castShadow = true;
      let idx = 0;
      round.forEach((t) => {
        const s = t.s;
        const g = 0.42 + Math.random() * 0.18;
        color.setRGB(g * 0.55, g, g * 0.4);
        m4.compose(new THREE.Vector3(t.x, 2.2 * s + 1.2 * s, t.z), q, new THREE.Vector3(s * 1.2, s * 1.3, s * 1.2));
        inst.setMatrixAt(idx, m4);
        inst.setColorAt(idx, color);
        idx++;
        m4.compose(new THREE.Vector3(t.x + s * 0.3, 2.2 * s + 2.1 * s, t.z - s * 0.2), q, new THREE.Vector3(s * 0.9, s * 1.0, s * 0.9));
        inst.setMatrixAt(idx, m4);
        inst.setColorAt(idx, color);
        idx++;
      });
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      this.scene.add(inst);
    }

    // cypress (tall narrow cones - common in Georgia)
    if (cyp.length) {
      const cGeo = new THREE.ConeGeometry(0.9, 5.5, 8);
      const cMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
      const inst = new THREE.InstancedMesh(cGeo, cMat, cyp.length);
      inst.castShadow = true;
      cyp.forEach((t, i) => {
        const s = t.s;
        const g = 0.3 + Math.random() * 0.12;
        color.setRGB(g * 0.5, g, g * 0.42);
        m4.compose(new THREE.Vector3(t.x, 2.2 * s + 2.7 * s, t.z), q, new THREE.Vector3(s, s * 1.15, s));
        inst.setMatrixAt(i, m4);
        inst.setColorAt(i, color);
      });
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      this.scene.add(inst);
    }
  }

  _buildStreetLights() {
    const lights = this.layout.lights;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.11, 6.5, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: "#2b2e34", metalness: 0.7, roughness: 0.4 });
    const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, lights.length);
    poleInst.castShadow = true;
    const armGeo = new THREE.BoxGeometry(1.4, 0.12, 0.12);
    const armInst = new THREE.InstancedMesh(armGeo, poleMat, lights.length);
    const lampGeo = new THREE.SphereGeometry(0.26, 10, 10);
    this.lampMat = new THREE.MeshStandardMaterial({
      color: "#fff3cf",
      emissive: "#ffdf9e",
      emissiveIntensity: 0,
    });
    const lampInst = new THREE.InstancedMesh(lampGeo, this.lampMat, lights.length);
    lights.forEach((l, i) => {
      m4.compose(new THREE.Vector3(l.x, 3.25, l.z), q, new THREE.Vector3(1, 1, 1));
      poleInst.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(l.x + 0.6, 6.3, l.z), q, new THREE.Vector3(1, 1, 1));
      armInst.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(l.x + 1.2, 6.2, l.z), q, new THREE.Vector3(1, 1, 1));
      lampInst.setMatrixAt(i, m4);
      this.lightPositions.push(new THREE.Vector3(l.x + 1.2, 6.2, l.z));
    });
    poleInst.instanceMatrix.needsUpdate = true;
    armInst.instanceMatrix.needsUpdate = true;
    lampInst.instanceMatrix.needsUpdate = true;
    this.scene.add(poleInst, armInst, lampInst);
  }

  _buildProps() {
    const props = this.layout.props || [];
    if (!props.length) return;
    const woodGeos = [];
    const legGeos = [];
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const scl = new THREE.Vector3(1, 1, 1);
    for (const p of props) {
      if (p.type !== "bench") continue;
      q.setFromAxisAngle(up, p.rot || 0);
      const seat = new THREE.BoxGeometry(1.6, 0.1, 0.5);
      m4.compose(new THREE.Vector3(p.x, 0.5, p.z), q, scl);
      seat.applyMatrix4(m4);
      woodGeos.push(seat);
      const back = new THREE.BoxGeometry(1.6, 0.5, 0.1);
      const bl = new THREE.Vector3(0, 0.3, -0.2).applyQuaternion(q);
      m4.compose(new THREE.Vector3(p.x + bl.x, 0.75, p.z + bl.z), q, scl);
      back.applyMatrix4(m4);
      woodGeos.push(back);
      for (const sx of [-0.6, 0.6]) {
        const leg = new THREE.BoxGeometry(0.1, 0.5, 0.4);
        const ll = new THREE.Vector3(sx, 0, 0).applyQuaternion(q);
        m4.compose(new THREE.Vector3(p.x + ll.x, 0.25, p.z + ll.z), q, scl);
        leg.applyMatrix4(m4);
        legGeos.push(leg);
      }
    }
    this._mergeAdd(woodGeos, new THREE.MeshStandardMaterial({ color: "#6b4a2c", roughness: 0.9 }), true, true);
    this._mergeAdd(legGeos, new THREE.MeshStandardMaterial({ color: "#33363b", metalness: 0.6, roughness: 0.5 }), true, false);
  }

  _buildRiver() {
    const r = this.layout.river;
    const normal = waterNormalTexture();
    normal.repeat.set(8, 8);
    this.waterNormal = normal;
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(r.length, r.width, 1, 1),
      new THREE.MeshStandardMaterial({
        color: "#3a6a82",
        metalness: 0.9,
        roughness: 0.18,
        normalMap: normal,
        normalScale: new THREE.Vector2(0.35, 0.35),
        transparent: true,
        opacity: 0.92,
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.4, r.z);
    this.scene.add(water);
    this.waterMat = water.material;

    const bankMat = new THREE.MeshStandardMaterial({ color: "#6a5f4c", roughness: 1 });
    for (const s of [-1, 1]) {
      const bank = new THREE.Mesh(new THREE.BoxGeometry(r.length, 1, 3.5), bankMat);
      bank.position.set(0, 0.1, r.z + s * (r.width / 2 + 1.5));
      bank.receiveShadow = true;
      this.scene.add(bank);
      this._addStaticBox(r.length / 2, 0.9, 1.75, 0, 0.1, r.z + s * (r.width / 2 + 1.5));
    }
  }

  _buildBridge() {
    const b = this.layout.bridge;
    const len = b.z1 - b.z0;
    const cz = (b.z0 + b.z1) / 2;
    const deckMat = new THREE.MeshStandardMaterial({ color: "#55585f", roughness: 0.9 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(b.width, 0.5, len), deckMat);
    deck.position.set(b.x, 0.15, cz);
    deck.receiveShadow = true;
    this.scene.add(deck);
    this._addStaticBox(b.width / 2, 0.25, len / 2, b.x, 0.15, cz);

    // stone arch piers
    const pierMat = new THREE.MeshStandardMaterial({ color: "#9a8f78", roughness: 1 });
    for (const t of [0.3, 0.7]) {
      const pz = b.z0 + len * t;
      const pier = new THREE.Mesh(new THREE.BoxGeometry(b.width + 1, 3, 2.5), pierMat);
      pier.position.set(b.x, -1.2, pz);
      this.scene.add(pier);
    }
    const railMat = new THREE.MeshStandardMaterial({ color: "#c8ccd2", metalness: 0.4, roughness: 0.5 });
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, len), railMat);
      rail.position.set(b.x + s * (b.width / 2), 0.75, cz);
      this.scene.add(rail);
      this._addStaticBox(0.11, 0.45, len / 2, b.x + s * (b.width / 2), 0.75, cz);
    }
  }

  _buildCathedral(pos) {
    const stone = new THREE.MeshStandardMaterial({ color: "#ddd0b2", roughness: 0.85, metalness: 0.02 });
    const roofMat = new THREE.MeshStandardMaterial({ color: "#7a5a3a", roughness: 0.75 });
    const g = new THREE.Group();

    // cobbled courtyard
    const cobble = cobbleTexture();
    cobble.repeat.set(14, 14);
    const yard = new THREE.Mesh(
      new THREE.CircleGeometry(26, 40),
      new THREE.MeshStandardMaterial({ map: cobble, roughness: 0.95 })
    );
    yard.geometry.rotateX(-Math.PI / 2);
    yard.position.set(pos.x, 0.05, pos.z);
    yard.receiveShadow = true;
    this.scene.add(yard);

    const base1 = new THREE.Mesh(new THREE.BoxGeometry(18, 13, 11), stone);
    base1.position.y = 6.5;
    const base2 = new THREE.Mesh(new THREE.BoxGeometry(11, 13, 19), stone);
    base2.position.y = 6.5;
    g.add(base1, base2);
    base1.castShadow = base2.castShadow = true;
    base1.receiveShadow = base2.receiveShadow = true;

    // arched windows (recesses) around the base
    const winMat = new THREE.MeshStandardMaterial({ color: "#2a2118", roughness: 0.6 });
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      const w = new THREE.Mesh(new THREE.BoxGeometry(1, 3, 0.6), winMat);
      w.position.set(pos.x + Math.cos(ang) * 8.5, 7, pos.z + Math.sin(ang) * 8.5);
      w.lookAt(pos.x, 7, pos.z);
      this.scene.add(w);
    }

    const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 9, 12), stone);
    drum.position.y = 17;
    drum.castShadow = true;
    const dome = new THREE.Mesh(new THREE.ConeGeometry(4, 7, 12), roofMat);
    dome.position.y = 25;
    dome.castShadow = true;
    g.add(drum, dome);

    // a cross on top
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 0.2), new THREE.MeshStandardMaterial({ color: "#d9c48a", metalness: 0.8, roughness: 0.3 }));
    cross.position.y = 29.5;
    g.add(cross);

    for (const [dx, dz] of [[-6.5, -6.5], [6.5, -6.5], [-6.5, 6.5], [6.5, 6.5]]) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(1.3, 4.5, 8), roofMat);
      t.position.set(dx, 14, dz);
      t.castShadow = true;
      g.add(t);
    }
    g.position.set(pos.x, 0, pos.z);
    this.scene.add(g);
    this._addStaticBox(9, 8, 9.5, pos.x, 8, pos.z);
    this.cathedralPos = new THREE.Vector3(pos.x, 0, pos.z);
  }

  _buildMonastery(pos) {
    const stone = new THREE.MeshStandardMaterial({ color: "#cdc2a2", roughness: 0.95 });
    const roofMat = new THREE.MeshStandardMaterial({ color: "#6b4f34", roughness: 0.9 });
    const hill = new THREE.Mesh(
      new THREE.CylinderGeometry(24, 40, pos.y * 2, 20),
      new THREE.MeshStandardMaterial({ map: grassTexture(), color: "#6a7048", roughness: 1 })
    );
    hill.position.set(pos.x, 0, pos.z);
    hill.receiveShadow = true;
    this.scene.add(hill);
    this._addStaticBox(22, pos.y, 22, pos.x, pos.y, pos.z);

    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 9, 8), stone);
    body.position.y = 4.5;
    body.castShadow = true;
    const cruci = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 7), stone);
    cruci.position.y = 4;
    const cruci2 = new THREE.Mesh(new THREE.BoxGeometry(7, 8, 14), stone);
    cruci2.position.y = 4;
    const dome = new THREE.Mesh(new THREE.ConeGeometry(4.2, 4.5, 8), roofMat);
    dome.position.y = 11;
    dome.castShadow = true;
    g.add(cruci, cruci2, body, dome);
    g.position.set(pos.x, pos.y, pos.z);
    this.scene.add(g);
    this.monasteryPos = new THREE.Vector3(pos.x, pos.y, pos.z);
  }

  _buildBoundary() {
    const layout = this.layout;
    const edge = layout.HALF + layout.BLOCK * 1.2;
    const barMat = new THREE.MeshStandardMaterial({ color: "#3a3d44", roughness: 0.9 });
    const bars = [];
    const mkBar = (w, d, x, z) => {
      const g = new THREE.BoxGeometry(w, 1.2, d);
      g.translate(x, 0.6, z);
      bars.push(g);
      this._addStaticBox(w / 2, 0.6, d / 2, x, 0.6, z);
    };
    mkBar(edge * 2, 0.6, 0, -edge);
    mkBar(0.6, edge * 2, -edge, 0);
    mkBar(0.6, edge * 2, edge, 0);
    mkBar(edge, 0.6, -edge / 2 - 3, edge);
    mkBar(edge, 0.6, edge / 2 + 3, edge);
    this._mergeAdd(bars, barMat, false, false);
  }

  setNight(factor) {
    for (const m of this.nightMats) m.emissiveIntensity = factor * 1.4;
    if (this.lampMat) this.lampMat.emissiveIntensity = factor * 1.8;
  }
}
