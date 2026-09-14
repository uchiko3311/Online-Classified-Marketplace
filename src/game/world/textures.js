import * as THREE from "three";

function makeCanvas(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}

function finish(canvas, repeat = 1, aniso = 8) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = aniso;
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat !== 1) tex.repeat.set(repeat, repeat);
  return tex;
}

// Simple value-noise splatter helper.
function splatter(ctx, size, count, colorFn, sizeMin = 1, sizeMax = 3) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colorFn();
    const s = sizeMin + Math.random() * (sizeMax - sizeMin);
    ctx.fillRect(Math.random() * size, Math.random() * size, s, s);
  }
}

// --- Asphalt with aggregate speckle + subtle patches + oil streaks -------
export function asphaltTexture() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#33383e";
  ctx.fillRect(0, 0, size, size);
  // subtle small tonal patches (worn areas) - kept small so they don't tile
  // into large blobs across the carriageway
  for (let i = 0; i < 40; i++) {
    const v = 40 + Math.random() * 14;
    ctx.fillStyle = `rgba(${v},${v},${v + 3},0.14)`;
    const r = 8 + Math.random() * 22;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // dense fine aggregate
  splatter(ctx, size, 14000, () => {
    const v = 28 + Math.random() * 44;
    return `rgba(${v},${v},${v + 4},0.35)`;
  }, 1, 2);
  // occasional light aggregate specks
  splatter(ctx, size, 1800, () => {
    const v = 80 + Math.random() * 55;
    return `rgba(${v},${v},${v},0.20)`;
  }, 1, 2);
  // cracks
  ctx.strokeStyle = "rgba(20,20,22,0.4)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (Math.random() - 0.5) * 80;
      y += (Math.random() - 0.5) * 80;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return finish(c);
}

// Roughness map for asphalt. Kept uniformly high (bright = rough) with only
// fine speckle so the road stays matte and never forms large shiny blobs at
// grazing camera angles.
export function asphaltRoughness() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ededed";
  ctx.fillRect(0, 0, size, size);
  splatter(ctx, size, 9000, () => {
    const v = 200 + Math.random() * 40;
    return `rgba(${v},${v},${v},0.4)`;
  }, 1, 2);
  return finish(c);
}

// --- Concrete sidewalk with expansion joints ------------------------------
export function sidewalkTexture() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#9a968c";
  ctx.fillRect(0, 0, size, size);
  splatter(ctx, size, 4000, () => {
    const v = 130 + Math.random() * 50;
    return `rgba(${v},${v},${v - 6},0.25)`;
  }, 1, 2);
  // paving joints (grid of slabs)
  ctx.strokeStyle = "rgba(70,68,62,0.55)";
  ctx.lineWidth = 2;
  const step = size / 4;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }
  return finish(c);
}

// --- Grass / ground with dirt patches -------------------------------------
export function grassTexture() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#5c6b3c";
  ctx.fillRect(0, 0, size, size);
  // dirt patches
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = `rgba(120,104,68,${0.12 + Math.random() * 0.12})`;
    const r = 20 + Math.random() * 60;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // grass blades speckle
  splatter(ctx, size, 6000, () => {
    const g = 70 + Math.random() * 70;
    return `rgba(${g * 0.55},${g},${g * 0.4},0.4)`;
  }, 1, 3);
  return finish(c);
}

// --- Plastered facade (stucco) with subtle staining -----------------------
// Multiplied by a per-building vertex color, so keep this near-white/neutral.
export function plasterTexture() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f3efe6";
  ctx.fillRect(0, 0, size, size);
  // blotchy weathering
  for (let i = 0; i < 40; i++) {
    const v = 200 + Math.random() * 40;
    ctx.fillStyle = `rgba(${v},${v - 6},${v - 16},${0.05 + Math.random() * 0.12})`;
    const r = 14 + Math.random() * 60;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // faint vertical streaks (rain staining)
  ctx.strokeStyle = "rgba(120,112,96,0.06)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (Math.random() - 0.5) * 8, size);
    ctx.stroke();
  }
  return finish(c, 1, 4);
}

// --- Terracotta / clay roof tiles -----------------------------------------
export function roofTileTexture() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#a54b32";
  ctx.fillRect(0, 0, size, size);
  const rows = 10;
  const rh = size / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    // tone per row
    const shade = 0.85 + Math.random() * 0.3;
    ctx.fillStyle = `rgba(${Math.floor(165 * shade)},${Math.floor(75 * shade)},${Math.floor(50 * shade)},1)`;
    ctx.fillRect(0, y, size, rh - 1);
    // rounded pan tiles as vertical ridges
    const cols = 12;
    const cw = size / cols;
    for (let cI = 0; cI < cols; cI++) {
      ctx.fillStyle = `rgba(0,0,0,0.12)`;
      ctx.fillRect(cI * cw, y, 1.5, rh);
      ctx.fillStyle = `rgba(255,220,190,0.10)`;
      ctx.fillRect(cI * cw + cw * 0.5, y, 1.5, rh);
    }
    // shadow line under each course
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(0, y + rh - 2, size, 2);
  }
  return finish(c, 1, 4);
}

// --- Cobblestone (old-town squares near the cathedral) --------------------
export function cobbleTexture() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#6d6660";
  ctx.fillRect(0, 0, size, size);
  const cell = 22;
  for (let y = 0; y < size; y += cell) {
    const off = (y / cell) % 2 ? cell / 2 : 0;
    for (let x = -cell; x < size; x += cell) {
      const v = 90 + Math.random() * 55;
      ctx.fillStyle = `rgb(${v},${v - 6},${v - 12})`;
      ctx.beginPath();
      const cx = x + off + cell / 2;
      const cy = y + cell / 2;
      ctx.ellipse(cx, cy, cell * 0.42, cell * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return finish(c);
}

// --- Water normal-ish ripple (used as a subtle normal map) ----------------
export function waterNormalTexture() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 6 + Math.random() * 26;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, "rgba(150,150,255,0.9)");
    grd.addColorStop(1, "rgba(128,128,255,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(c, 1, 2);
}
