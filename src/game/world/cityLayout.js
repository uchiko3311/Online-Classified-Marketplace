// Deterministic, procedural layout for a Mtskheta-inspired town.
// NOTE: This is a stylized representation informed by Mtskheta's character
// (a dense old-town street grid, the Mtkvari riverside, the Svetitskhoveli
// cathedral as a central landmark and a Jvari-style monastery on the hill
// across the water). It is NOT surveyed GIS data and is not an exact
// reproduction of the real street network.

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

export function buildLayout(seed = 20240115) {
  const rand = mulberry32(seed);

  // River runs along the far south edge (beyond the last road row).
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
  const cathCol = Math.floor(GRID / 2) - 1; // block index
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
  const palette = ["#c9bda6", "#b8a488", "#cdc4b4", "#a89b83", "#d8cdb8", "#9c8f79"];

  for (let bc = 0; bc < GRID - 1; bc++) {
    for (let br = 0; br < GRID - 1; br++) {
      const isCathedral = bc === cathCol && br === cathRow;
      const blockX0 = bc * BLOCK - HALF + ROAD_HALF;
      const blockZ0 = br * BLOCK - HALF + ROAD_HALF;
      const blockW = BLOCK - ROAD_HALF * 2;

      // Small central square (park) sometimes.
      const isPark = !isCathedral && rand() < 0.09;

      if (isCathedral) continue; // reserved for the landmark
      if (isPark) {
        // Trees clustered in the park.
        const cx = blockX0 + blockW / 2;
        const cz = blockZ0 + blockW / 2;
        const count = 5 + Math.floor(rand() * 5);
        for (let t = 0; t < count; t++) {
          trees.push({
            x: cx + (rand() - 0.5) * blockW * 0.8,
            z: cz + (rand() - 0.5) * blockW * 0.8,
            s: 0.8 + rand() * 0.9,
          });
        }
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
        if (rand() < 0.18) {
          // vacant lot -> a couple of trees
          trees.push({ x: lx + half / 2, z: lz + half / 2, s: 0.7 + rand() * 0.6 });
          continue;
        }
        const setback = 2 + rand() * 3;
        const w = half - setback * 2 - rand() * 3;
        const d = half - setback * 2 - rand() * 3;
        if (w < 6 || d < 6) continue;
        const tier = rand();
        let h;
        if (tier < 0.55) h = 6 + rand() * 6; // houses
        else if (tier < 0.9) h = 12 + rand() * 12; // mid rise
        else h = 24 + rand() * 20; // taller
        buildings.push({
          x: lx + half / 2,
          z: lz + half / 2,
          w,
          d,
          h,
          color: palette[Math.floor(rand() * palette.length)],
          roof: rand() < 0.5,
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
        trees.push({ x: gx + ROAD_HALF + 2.5, z, s: 0.7 + rand() * 0.4 });
        trees.push({ x: gx - ROAD_HALF - 2.5, z, s: 0.7 + rand() * 0.4 });
      }
    }
  }
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const p = nodePos(i, j);
      lights.push({ x: p.x + ROAD_HALF + 1.5, z: p.z + ROAD_HALF + 1.5 });
    }
  }

  // Jvari-style monastery on the hill across the river ---------------------
  const monastery = { x: BLOCK * 0.5, z: riverZ + riverWidth / 2 + 34, y: 10 };

  // Bridge: main central north-south road crossing the river --------------
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
