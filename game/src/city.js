// The city of Solara Bay: a grid of blocks and roads, buildings, parks, the beach, and the
// named places the story uses. All geometry is derived from the grid in config.js, so the
// renderer, the traffic, the missions and the minimap all agree on where things are.
import { BEACH_H, BLOCK, CITY_H, CITY_W, COLS, PALETTE, ROAD, ROWS } from './config.js';

// Road i (vertical) spans x in [i*(BLOCK+ROAD), +ROAD]; road j (horizontal) the same in y.
export function roadX(i) { return i * (BLOCK + ROAD); }
export function roadY(j) { return j * (BLOCK + ROAD); }
export function roadCenterX(i) { return roadX(i) + ROAD / 2; }
export function roadCenterY(j) { return roadY(j) + ROAD / 2; }
// Block (c, r) spans the rectangle between its neighbouring roads.
export function blockRect(c, r) {
  return {
    x: (c + 1) * ROAD + c * BLOCK,
    y: (r + 1) * ROAD + r * BLOCK,
    w: BLOCK,
    h: BLOCK,
  };
}
export function blockCenter(c, r) {
  const b = blockRect(c, r);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

// Named places. Each is a block (or a point) the missions and the HUD refer to.
export const PLACES = {
  safehouse: { name: 'Safehouse', block: [3, 3], blurb: 'Jax\u2019s place' },
  garage: { name: 'Rocco\u2019s Garage', block: [1, 1], blurb: 'Chop shop' },
  bank: { name: 'Solara Trust Bank', block: [6, 1], blurb: 'The big one' },
  docks: { name: 'Docks', block: [6, 5], blurb: 'Crates and cranes' },
  hospital: { name: 'St. Anselm Hospital', block: [0, 5], blurb: 'Patch up' },
  police: { name: 'Central Precinct', block: [4, 0], blurb: 'SBPD' },
  marina: { name: 'Marina', block: [0, 0], blurb: 'Boats' },
  market: { name: 'Bay Market', block: [5, 4], blurb: 'Crowds' },
};

const PARK_BLOCKS = new Set(['2,4', '5,2', '1,5']);
const SPECIAL_BLOCKS = new Set(Object.values(PLACES).map((p) => `${p.block[0]},${p.block[1]}`));

function placePoint(key) {
  const p = PLACES[key];
  return blockCenter(p.block[0], p.block[1]);
}

/** Build the static city: buildings (with collision), parks, trees, road list. */
export function createCity(random) {
  const buildings = [];
  const trees = [];
  const parks = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const b = blockRect(c, r);
      const key = `${c},${r}`;
      if (PARK_BLOCKS.has(key)) {
        parks.push(b);
        const n = 6 + Math.floor(random() * 5);
        for (let i = 0; i < n; i += 1) {
          trees.push({ x: b.x + 30 + random() * (b.w - 60), y: b.y + 30 + random() * (b.h - 60), r: 10 + random() * 7 });
        }
        continue;
      }
      const special = SPECIAL_BLOCKS.has(key);
      if (special) {
        const w = b.w * 0.62;
        const h = b.h * 0.55;
        const color = PALETTE.building[Math.floor(random() * PALETTE.building.length)];
        const roof = PALETTE.roof[Math.floor(random() * PALETTE.roof.length)];
        buildings.push({ x: b.x + (b.w - w) / 2, y: b.y + (b.h - h) / 2, w, h, color, roof, special: key });
        continue;
      }
      // One building per cell of a 2x2 sub-grid, so buildings never overlap.
      const cells = [0, 1, 2, 3].sort(() => random() - 0.5).slice(0, 1 + Math.floor(random() * 2));
      for (const cell of cells) {
        const cw = b.w / 2;
        const ch = b.h / 2;
        const cx = b.x + (cell % 2) * cw;
        const cy = b.y + Math.floor(cell / 2) * ch;
        const w = cw * (0.68 + random() * 0.2);
        const h = ch * (0.68 + random() * 0.2);
        const color = PALETTE.building[Math.floor(random() * PALETTE.building.length)];
        const roof = PALETTE.roof[Math.floor(random() * PALETTE.roof.length)];
        buildings.push({ x: cx + (cw - w) / 2, y: cy + (ch - h) / 2, w, h, color, roof, special: null });
      }
    }
  }
  return {
    buildings,
    trees,
    parks,
    width: CITY_W,
    height: CITY_H + BEACH_H,
    places: Object.fromEntries(Object.entries(PLACES).map(([k, p]) => [k, { ...p, ...placePoint(k) }])),
  };
}

/** Circle (x, y, r) against the city's buildings: push out, return the corrected position. */
export function collideCircle(city, x, y, r) {
  let nx = x;
  let ny = y;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
    const dx = nx - cx;
    const dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 === 0) {
      ny = b.y - r;
      continue;
    }
    const d = Math.sqrt(d2);
    nx = cx + (dx / d) * r;
    ny = cy + (dy / d) * r;
  }
  nx = Math.max(r, Math.min(city.width - r, nx));
  ny = Math.max(r, Math.min(city.height - r, ny));
  return { x: nx, y: ny };
}

/** Is the point on a road (not inside a block)? */
export function onRoad(x, y) {
  const mx = x % (BLOCK + ROAD);
  const my = y % (BLOCK + ROAD);
  return mx < ROAD || my < ROAD;
}

/** Nearest road centre lines, for traffic routing. */
export function nearestRoadCenter(x, y) {
  const ix = Math.round((x - ROAD / 2) / (BLOCK + ROAD));
  const iy = Math.round((y - ROAD / 2) / (BLOCK + ROAD));
  return {
    vx: Math.max(0, Math.min(COLS, ix)) * (BLOCK + ROAD) + ROAD / 2,
    hy: Math.max(0, Math.min(ROWS, iy)) * (BLOCK + ROAD) + ROAD / 2,
  };
}

/** A random point on a road, for spawning cars and pedestrians. */
export function randomRoadPoint(random) {
  if (random() < 0.5) {
    const i = Math.floor(random() * (COLS + 1));
    return { x: roadCenterX(i) + (random() < 0.5 ? -14 : 14), y: random() * CITY_H };
  }
  const j = Math.floor(random() * (ROWS + 1));
  return { x: random() * CITY_W, y: roadCenterY(j) + (random() < 0.5 ? -14 : 14) };
}
