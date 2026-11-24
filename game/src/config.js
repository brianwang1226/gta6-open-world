// Solara Bay — a sun-soaked coastal open-world crime game.
// Every tuning number, colour and city constant in one place.
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// City grid: blocks of 260 px separated by 72 px roads.
export const BLOCK = 260;
export const ROAD = 72;
export const COLS = 8;
export const ROWS = 7;
export const CITY_W = COLS * BLOCK + (COLS + 1) * ROAD; // 2728
export const CITY_H = ROWS * BLOCK + (ROWS + 1) * ROAD; // 2396
export const BEACH_H = 130; // sand + water band below the city

export const PLAYER = {
  radius: 13,
  walk: 205,
  run: 330,
  health: 100,
  regen: 1.6,
  regenDelay: 5,
};

export const CAR = {
  length: 46,
  width: 22,
  accel: 520,
  brake: 900,
  reverseMax: 210,
  steer: 2.7,
  grip: 6.5,
  hp: 150,
};

export const TRAFFIC = { count: 14, speedMin: 130, speedMax: 195, hp: 80 };
export const PEDS = { count: 26, speedMin: 34, speedMax: 62 };
export const BULLET = { speed: 950, life: 0.7, damage: 34 };

export const WANTED = {
  max: 5,
  decayDelay: 20,
  decayEvery: 18,
  steal: 1,
  hitPed: 1,
  shoot: 1,
  killCop: 2,
};

export const DEBT_START = 50000;
export const CASH_START = 250;

export const PALETTE = {
  grass: '#7fae5a',
  park: '#5f9e4d',
  sand: '#e0c98f',
  water: '#2e7fa8',
  road: '#3a3f47',
  roadEdge: '#2c3038',
  lane: '#d8d3a8',
  sidewalk: '#9aa0a8',
  building: ['#c96f4a', '#d8a24a', '#7a9cc6', '#b06a8a', '#6aa88a', '#a8a06a', '#8a7ab8', '#c65a5a'],
  roof: ['#8a4a34', '#9a7a34', '#5a7aa8', '#8a4a6a', '#4a7a5a', '#7a6a4a', '#6a5a98', '#9a3a3a'],
  glass: '#a8d8e8',
  player: '#e8b23a',
  playerCar: '#d82828',
  police: '#1c2733',
  policeLight: '#e83a3a',
  gang: '#7a2a8a',
  ped: ['#e8e0d0', '#c8a888', '#88a8c8', '#d88888', '#a8c888', '#d8c888'],
  carColors: ['#c8c8d0', '#3a6ab8', '#c8a03a', '#5a8a3a', '#8a3a5a', '#e0e0e0', '#2a2a2a', '#b85a2a'],
  text: '#f4f1e8',
  muted: '#b8b4a8',
  gold: '#f2c94c',
  red: '#e5534b',
  green: '#58b368',
  panel: 'rgba(12, 16, 24, 0.78)',
  panelLine: 'rgba(255,255,255,0.16)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'solara-bay.save.v1';
export const BEST_KEY = 'solara-bay.best';
