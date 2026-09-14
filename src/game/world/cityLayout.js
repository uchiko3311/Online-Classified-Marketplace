// Deterministic, procedural layout for a Mtskheta-inspired town.
// NOTE: This is a stylized representation informed by Mtskheta's character
// (a dense old-town street grid, the Mtkvari riverside, the Svetitskhoveli
// cathedral as a central landmark and a Jvari-style monastery on the hill
// across the water). It is NOT surveyed GIS data and is not an exact
// reproduction of the real street network. The street topology is a
// regularized plan; architectural variety (roofs, heights, styles, colours)
// is procedurally generated to read like a real Georgian town.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const GRID = 9; // intersections per axis
export const BLOCK = 72; // metres between intersections
export const ROAD_HALF = 5.5; // half road width
export const HALF = ((GRID - 1) * BLOCK) / 2;

export function nodePos(i, j) {
  return {
    x: i * BLOCK - HALF,
    z: j * BLOCK - HALF,
  };
}

// Major avenues are wider; used for visuals + wider carriageway.
export function isMajor(index) {
  const mid = Math.floor(GRID / 2);
  return index === mid || index === 0 || index === GRID - 1;
}

// Warm Georgian old-town palette: sandstone, ochre, cream, faded brick.
const WALL_PALETTE = [
  "#d9cba9", "#cdb894", "#e0d4bb", "#c7a97f", "#d2b48c",
  "#bfa17c", "#e6dcc6", "#b89b78", "#caa15f", "#d8c4a0",
];
const ROOF_PALETTE = ["#9a4b30", "#a5502f", "#8f4429", "#b1603a", "#7d4b3a", "#994d33"];

export function buildLayout(seed = 20240115) {
  const rand = mulberry32(seed);

  const riverZ = HALF + BLOCK * 0.75;
  const riverWidth = 46;

  // Nodes + grid graph -----------------------------------------------------
  const nodes = [];
  const id = (i, j) => j * GRID + i;
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const p = nodePos(i, j);
      nodes.push({ id: id(i, j), i, j, x: p.x, z: p.z });
    }
  }

  const adjacency = nodes.map(() => []);
  const edges = [];
  const addEdge = (aI, aJ, bI, bJ) => {
    const a = id(aI, aJ);
    const b = id(bI, bJ);
    const na = nodes[a];
    const nb = nodes[b];
    const cost = Math.hypot(na.x - nb.x, na.z - nb.z);
    adjacency[a].push({ to: b, cost });
    adjacency[b].push({ to: a, cost });
    edges.push({ a, b });
  };
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      if (i < GRID - 1) addEdge(i, j, i + 1, j);
      if (j < GRID - 1) addEdge(i, j, i, j + 1);
    }
  }

  // Central landmark block (Svetitskhoveli-style cathedral) ----------------
  const cathCol = Math.floor(GRID / 2) - 1;
  const cathRow = Math.floor(GRID / 2) - 1;
  const cathCenter = {
    x: (cathCol + 0.5) * BLOCK - HALF,
    z: (cathRow + 0.5) * BLOCK - HALF,
  };
  const cathedral = { x: cathCenter.x, z: cathCenter.z };

  // Buildings: subdivide each block into a 2x2 lot grid --------------------
  const buildings = [];
  const trees = [];
  const lights = [];
  const props = []; // benches, bins, fences (street furniture)

  const mid = Math.floor(GRID / 2);
  const styleFor = (bc, br) => {
    // old-town core near cathedral => low stone houses; edges => taller
    const distCore = Math.hypot(bc - cathCol, br - cathRow);
    if (distCore < 2.2) return "oldtown";
    if (bc <= 1 || br <= 1 || bc >= GRID - 3 || br >= GRID - 3) return "residential";
    return rand() < 0.35 ? "midrise" : "residential";
  };

  for (let bc = 0; bc < GRID - 1; bc++) {
    for (let br = 0; br < GRID - 1; br++) {
      const isCathedral = bc === cathCol && br === cathRow;
      if (isCathedral) continue;

      const blockX0 = bc * BLOCK - HALF + ROAD_HALF;
      const blockZ0 = br * BLOCK - HALF + ROAD_HALF;
      const blockW = BLOCK - ROAD_HALF * 2;
      const style = styleFor(bc, br);

      // A plaza next to the cathedral, occasional parks elsewhere.
      const nearCath = Math.abs(bc - cathCol) <= 1 && Math.abs(br - cathRow) <= 1;
      const isPark = !nearCath && rand() < 0.1;
      const isPlaza = nearCath && rand() < 0.5;

      if (isPlaza) {
        const cx = blockX0 + blockW / 2;
        const cz = blockZ0 + blockW / 2;
        // ring of trees + benches around an open cobbled square
        const count = 6 + Math.floor(rand() * 4);
        for (let t = 0; t < count; t++) {
          const a = (t / count) * Math.PI * 2;
          trees.push({
            x: cx + Math.cos(a) * blockW * 0.42,
            z: cz + Math.sin(a) * blockW * 0.42,
            s: 0.9 + rand() * 0.5,
            kind: rand() < 0.4 ? "cypress" : "round",
          });
          if (t % 2 === 0)
            props.push({ type: "bench", x: cx + Math.cos(a) * blockW * 0.3, z: cz + Math.sin(a) * blockW * 0.3, rot: a });
        }
        continue;
      }

      if (isPark) {
        const cx = blockX0 + blockW / 2;
        const cz = blockZ0 + blockW / 2;
        const count = 6 + Math.floor(rand() * 6);
        for (let t = 0; t < count; t++) {
          trees.push({
            x: cx + (rand() - 0.5) * blockW * 0.82,
            z: cz + (rand() - 0.5) * blockW * 0.82,
            s: 0.8 + rand() * 1.0,
            kind: rand() < 0.35 ? "cypress" : "round",
          });
        }
        props.push({ type: "bench", x: cx - 3, z: cz, rot: 0 });
        props.push({ type: "bench", x: cx + 3, z: cz, rot: Math.PI });
        continue;
      }

      const half = blockW / 2;
      const lots = [
        [blockX0, blockZ0],
        [blockX0 + half, blockZ0],
        [blockX0, blockZ0 + half],
        [blockX0 + half, blockZ0 + half],
      ];
      for (const [lx, lz] of lots) {
        if (rand() < 0.16) {
          // garden / vacant lot -> trees + a low wall
          trees.push({ x: lx + half / 2, z: lz + half / 2, s: 0.7 + rand() * 0.7, kind: rand() < 0.3 ? "cypress" : "round" });
          continue;
        }
        const setback = 2.5 + rand() * 3;
        const w = half - setback * 2 - rand() * 3;
        const d = half - setback * 2 - rand() * 3;
        if (w < 7 || d < 7) continue;

        let floors, roofType;
        if (style === "oldtown") {
          floors = 1 + Math.floor(rand() * 2); // 1-2 storey stone houses
          roofType = rand() < 0.75 ? "gable" : "hip";
        } else if (style === "residential") {
          floors = 2 + Math.floor(rand() * 3); // 2-4 storey
          roofType = rand() < 0.5 ? "gable" : rand() < 0.7 ? "hip" : "flat";
        } else {
          floors = 4 + Math.floor(rand() * 5); // 4-8 storey mid-rise
          roofType = rand() < 0.75 ? "flat" : "hip";
        }
        const floorH = 3.0 + rand() * 0.4;
        const h = floors * floorH;

        buildings.push({
          x: lx + half / 2,
          z: lz + half / 2,
          w,
          d,
          h,
          floors,
          floorH,
          rot: (rand() - 0.5) * 0.12, // subtle orientation variety
          wallColor: WALL_PALETTE[Math.floor(rand() * WALL_PALETTE.length)],
          roofType,
          roofColor: ROOF_PALETTE[Math.floor(rand() * ROOF_PALETTE.length)],
          hasBalcony: style !== "midrise" && rand() < 0.55,
          hasGarden: style !== "midrise" && rand() < 0.4,
          style,
        });
      }
    }
  }

  // Street trees + lights along every road line ----------------------------
  for (let i = 0; i < GRID; i++) {
    const gx = i * BLOCK - HALF;
    for (let j = 0; j < GRID - 1; j++) {
      const z0 = j * BLOCK - HALF;
      for (let k = 1; k <= 2; k++) {
        const z = z0 + (BLOCK * k) / 3;
        const kind = rand() < 0.35 ? "cypress" : "round";
        trees.push({ x: gx + ROAD_HALF + 2.6, z, s: 0.7 + rand() * 0.4, kind });
        trees.push({ x: gx - ROAD_HALF - 2.6, z, s: 0.7 + rand() * 0.4, kind });
      }
    }
  }
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const p = nodePos(i, j);
      lights.push({ x: p.x + ROAD_HALF + 1.6, z: p.z + ROAD_HALF + 1.6 });
    }
  }

  const monastery = { x: BLOCK * 0.5, z: riverZ + riverWidth / 2 + 34, y: 10 };

  const bridge = {
    x: 0,
    z0: HALF,
    z1: riverZ + riverWidth / 2 + 8,
    width: ROAD_HALF * 2 + 2,
  };

  const spawn = { x: 0, z: -BLOCK * 1.5, heading: 0 };

  return {
    seed,
    GRID,
    BLOCK,
    ROAD_HALF,
    HALF,
    nodes,
    adjacency,
    edges,
    buildings,
    trees,
    lights,
    props,
    cathedral,
    monastery,
    river: { z: riverZ, width: riverWidth, length: HALF * 2 + BLOCK * 4 },
    bridge,
    spawn,
  };
}

// A* over the road grid, returns array of {x,z} waypoints.
export function findRoute(layout, startId, goalId) {
  const { adjacency, nodes } = layout;
  const h = (a, b) => Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z);
  const open = new Set([startId]);
  const cameFrom = new Map();
  const g = new Map([[startId, 0]]);
  const f = new Map([[startId, h(startId, goalId)]]);

  while (open.size) {
    let current = null;
    let best = Infinity;
    for (const n of open) {
      const fv = f.get(n) ?? Infinity;
      if (fv < best) {
        best = fv;
        current = n;
      }
    }
    if (current === goalId) {
      const path = [current];
      while (cameFrom.has(current)) {
        current = cameFrom.get(current);
        path.unshift(current);
      }
      return path.map((idn) => ({ x: nodes[idn].x, z: nodes[idn].z, id: idn }));
    }
    open.delete(current);
    for (const { to, cost } of adjacency[current]) {
      const tentative = (g.get(current) ?? Infinity) + cost;
      if (tentative < (g.get(to) ?? Infinity)) {
        cameFrom.set(to, current);
        g.set(to, tentative);
        f.set(to, tentative + h(to, goalId));
        open.add(to);
      }
    }
  }
  return null;
}

export function nearestNode(layout, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const n of layout.nodes) {
    const d = (n.x - x) ** 2 + (n.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}
