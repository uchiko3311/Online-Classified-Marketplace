import * as THREE from "three";

function makeCanvas(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}

export function asphaltTexture() {
  const c = makeCanvas(256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#33383f";
  ctx.fillRect(0, 0, 256, 256);
  // subtle noise
  for (let i = 0; i < 2200; i++) {
    const v = 40 + Math.random() * 30;
    ctx.fillStyle = `rgba(${v},${v},${v + 4},0.25)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

export function grassTexture() {
  const c = makeCanvas(256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#3f5138";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) {
    const g = 50 + Math.random() * 60;
    ctx.fillStyle = `rgba(${g * 0.6},${g},${g * 0.5},0.35)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Returns { map, emissive } canvas textures for building facades.
export function facadeTextures() {
  const size = 256;
  const base = makeCanvas(size);
  const emis = makeCanvas(size);
  const bctx = base.getContext("2d");
  const ectx = emis.getContext("2d");
  bctx.fillStyle = "#ffffff"; // multiplied by per-instance color
  bctx.fillRect(0, 0, size, size);
  ectx.fillStyle = "#000000";
  ectx.fillRect(0, 0, size, size);

  const cols = 6;
  const rows = 8;
  const pad = 6;
  const cw = (size - pad * (cols + 1)) / cols;
  const ch = (size - pad * (rows + 1)) / rows;
  for (let r = 0; r < rows; r++) {
    for (let cI = 0; cI < cols; cI++) {
      const x = pad + cI * (cw + pad);
      const y = pad + r * (ch + pad);
      // window frame darker on base map
      bctx.fillStyle = "rgba(30,34,40,0.85)";
      bctx.fillRect(x, y, cw, ch);
      bctx.fillStyle = "rgba(120,140,160,0.5)";
      bctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
      // lit windows on emissive map (random)
      if (Math.random() < 0.5) {
        const warm = Math.random() < 0.7;
        ectx.fillStyle = warm ? "#ffd98a" : "#bcd7ff";
        ectx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
      }
    }
  }
  const map = new THREE.CanvasTexture(base);
  const emissive = new THREE.CanvasTexture(emis);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  emissive.wrapS = emissive.wrapT = THREE.RepeatWrapping;
  return { map, emissive };
}
