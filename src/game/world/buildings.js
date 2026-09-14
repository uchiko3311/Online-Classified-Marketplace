import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { plasterTexture, roofTileTexture } from "./textures.js";

// Builds all town buildings as a handful of merged meshes (a few draw calls),
// while keeping full per-building variety in footprint, height, roof shape,
// windows, balconies and garden walls. Returns meshes + collider descriptors
// + the materials whose emissive should ramp up at night.

function boxColored(w, h, d, color, matrix) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.applyMatrix4(matrix);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}

// Gable (pitched, ridge along local X) roof geometry with overhang.
function makeGable(w, d, rh, o) {
  const hw = w / 2 + o;
  const hd = d / 2 + o;
  const V = [
    // front slope (two tris)
    [-hw, 0, hd], [hw, 0, hd], [hw, rh, 0],
    [-hw, 0, hd], [hw, rh, 0], [-hw, rh, 0],
    // back slope
    [hw, 0, -hd], [-hw, 0, -hd], [-hw, rh, 0],
    [hw, 0, -hd], [-hw, rh, 0], [hw, rh, 0],
    // gable end x-
    [-hw, 0, -hd], [-hw, 0, hd], [-hw, rh, 0],
    // gable end x+
    [hw, 0, hd], [hw, 0, -hd], [hw, rh, 0],
  ];
  const pos = new Float32Array(V.length * 3);
  const uv = new Float32Array(V.length * 2);
  for (let i = 0; i < V.length; i++) {
    pos[i * 3] = V[i][0];
    pos[i * 3 + 1] = V[i][1];
    pos[i * 3 + 2] = V[i][2];
    uv[i * 2] = (V[i][0] + hw) / 4;
    uv[i * 2 + 1] = (V[i][2] + hd) / 3 + V[i][1] / 3;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// Hipped roof: square pyramid scaled to the footprint.
function makeHip(w, d, rh, o) {
  const g = new THREE.ConeGeometry(1, 1, 4);
  g.rotateY(Math.PI / 4);
  g.scale((w / 2 + o) * Math.SQRT2, rh, (d / 2 + o) * Math.SQRT2);
  g.translate(0, rh / 2, 0);
  // Gable roofs are non-indexed; keep hip roofs non-indexed too so both can
  // merge into a single roof mesh.
  return g.toNonIndexed();
}

export function buildBuildings(layout, quality) {
  const walls = [];
  const plinths = [];
  const roofsTile = [];
  const gravel = [];
  const winLit = [];
  const winDark = [];
  const balconies = [];
  const gardenWalls = [];
  const colliders = [];

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3(1, 1, 1);
  const lowDetail = quality === "low";

  const winW = 1.1;
  const winH = 1.5;

  for (const b of layout.buildings) {
    const yaw = b.rot || 0;
    q.setFromAxisAngle(up, yaw);

    // --- Wall body ---
    pos.set(b.x, b.h / 2, b.z);
    m4.compose(pos, q, scl);
    walls.push(boxColored(b.w, b.h, b.d, b.wallColor, m4));

    // --- Stone plinth ---
    pos.set(b.x, 0.35, b.z);
    m4.compose(pos, q, scl);
    plinths.push(new THREE.BoxGeometry(b.w + 0.35, 0.7, b.d + 0.35).applyMatrix4(m4));

    // --- Roof ---
    const overhang = 0.5;
    if (b.roofType === "flat") {
      // gravel cap + parapet (parapet uses wall colour)
      pos.set(b.x, b.h + 0.12, b.z);
      m4.compose(pos, q, scl);
      gravel.push(new THREE.BoxGeometry(b.w - 0.2, 0.24, b.d - 0.2).applyMatrix4(m4));
      const pw = 0.3;
      const rings = [
        [b.w, 0.5, pw, 0, (b.d - pw) / 2],
        [b.w, 0.5, pw, 0, -(b.d - pw) / 2],
        [pw, 0.5, b.d, (b.w - pw) / 2, 0],
        [pw, 0.5, b.d, -(b.w - pw) / 2, 0],
      ];
      for (const [pwx, pwy, pwz, ox, oz] of rings) {
        const local = new THREE.Vector3(ox, 0, oz).applyQuaternion(q);
        pos.set(b.x + local.x, b.h + 0.25, b.z + local.z);
        m4.compose(pos, q, scl);
        walls.push(boxColored(pwx, pwy, pwz, b.wallColor, m4));
      }
    } else {
      const rh = Math.min(3.2, b.w * 0.35);
      const roofGeo =
        b.roofType === "hip" ? makeHip(b.w, b.d, rh, overhang) : makeGable(b.w, b.d, rh, overhang);
      pos.set(b.x, b.h, b.z);
      m4.compose(pos, q, scl);
      roofGeo.applyMatrix4(m4);
      roofsTile.push(roofGeo);
    }

    // --- Windows (front/back always; sides on medium+) ---
    const floorsToShow = b.floors;
    const perW = Math.max(1, Math.min(4, Math.floor(b.w / 2.4)));
    const perD = Math.max(1, Math.min(4, Math.floor(b.d / 2.4)));
    const faces = lowDetail
      ? [["z", b.d / 2 + 0.06, b.w, perW], ["z", -(b.d / 2 + 0.06), b.w, perW]]
      : [
          ["z", b.d / 2 + 0.06, b.w, perW],
          ["z", -(b.d / 2 + 0.06), b.w, perW],
          ["x", b.w / 2 + 0.06, b.d, perD],
          ["x", -(b.w / 2 + 0.06), b.d, perD],
        ];

    for (const [axis, off, span, per] of faces) {
      for (let f = 0; f < floorsToShow; f++) {
        const wy = 1.4 + f * b.floorH;
        if (wy > b.h - 0.6) continue;
        for (let k = 0; k < per; k++) {
          const t = per === 1 ? 0.5 : k / (per - 1);
          const along = (t - 0.5) * (span - 1.6);
          let local;
          if (axis === "z") local = new THREE.Vector3(along, wy, off);
          else local = new THREE.Vector3(off, wy, along);
          const world = local.clone().applyQuaternion(q);
          pos.set(b.x + world.x, world.y, b.z + world.z);
          m4.compose(pos, q, scl);
          const depth = 0.1;
          const g =
            axis === "z"
              ? new THREE.BoxGeometry(winW, winH, depth)
              : new THREE.BoxGeometry(depth, winH, winW);
          g.applyMatrix4(m4);
          (Math.random() < 0.4 ? winLit : winDark).push(g);
        }
      }
    }

    // --- Balcony on the front (z+) upper floor ---
    if (b.hasBalcony && b.floors >= 2) {
      const by = 1.4 + (b.floors - 1) * b.floorH - 0.2;
      const local = new THREE.Vector3(0, by, b.d / 2 + 0.5).applyQuaternion(q);
      pos.set(b.x + local.x, local.y, b.z + local.z);
      m4.compose(pos, q, scl);
      balconies.push(new THREE.BoxGeometry(Math.min(b.w * 0.6, 3), 0.14, 1.0).applyMatrix4(m4));
      const rl = new THREE.Vector3(0, by + 0.45, b.d / 2 + 1.0).applyQuaternion(q);
      pos.set(b.x + rl.x, rl.y, b.z + rl.z);
      m4.compose(pos, q, scl);
      balconies.push(new THREE.BoxGeometry(Math.min(b.w * 0.6, 3), 0.8, 0.08).applyMatrix4(m4));
    }

    // --- Garden wall around the lot ---
    if (b.hasGarden && !lowDetail) {
      const gw = b.w + 3.2;
      const gd = b.d + 3.2;
      const segs = [
        [gw, 0.9, 0.3, 0, gd / 2],
        [gw, 0.9, 0.3, 0, -gd / 2],
        [0.3, 0.9, gd, gw / 2, 0],
        [0.3, 0.9, gd, -gw / 2, 0],
      ];
      for (const [sw, sh, sd, ox, oz] of segs) {
        const local = new THREE.Vector3(ox, 0.45, oz).applyQuaternion(q);
        pos.set(b.x + local.x, 0.45, b.z + local.z);
        m4.compose(pos, q, scl);
        gardenWalls.push(new THREE.BoxGeometry(sw, sh, sd).applyMatrix4(m4));
      }
    }

    // collider (rotated box)
    colliders.push({ hx: b.w / 2, hy: b.h / 2, hz: b.d / 2, x: b.x, y: b.h / 2, z: b.z, yaw });
  }

  // --- Materials ---
  const plaster = plasterTexture();
  const wallMat = new THREE.MeshStandardMaterial({
    map: plaster,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
  });
  const plinthMat = new THREE.MeshStandardMaterial({ color: "#8c8172", roughness: 1 });
  const roofMat = new THREE.MeshStandardMaterial({ map: roofTileTexture(), roughness: 0.82 });
  const gravelMat = new THREE.MeshStandardMaterial({ color: "#5b5852", roughness: 1 });
  const winDarkMat = new THREE.MeshStandardMaterial({
    color: "#12181f",
    metalness: 0.2,
    roughness: 0.08,
  });
  const winLitMat = new THREE.MeshStandardMaterial({
    color: "#20242c",
    emissive: new THREE.Color("#ffcf87"),
    emissiveIntensity: 0,
    roughness: 0.2,
  });
  const balconyMat = new THREE.MeshStandardMaterial({ color: "#cfc7b8", roughness: 0.8 });
  const gardenMat = new THREE.MeshStandardMaterial({ color: "#b4a888", roughness: 1 });

  const meshes = [];
  const addMerged = (arr, mat, cast = true, receive = true) => {
    if (!arr.length) return;
    const merged = mergeGeometries(arr, false);
    if (!merged) return;
    for (const g of arr) g.dispose?.();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    meshes.push(mesh);
  };

  addMerged(plinths, plinthMat);
  addMerged(walls, wallMat);
  addMerged(roofsTile, roofMat);
  addMerged(gravel, gravelMat);
  addMerged(balconies, balconyMat);
  addMerged(gardenWalls, gardenMat, false, true);
  addMerged(winDark, winDarkMat, false, false);
  addMerged(winLit, winLitMat, false, false);

  return { meshes, colliders, nightMats: [winLitMat] };
}
