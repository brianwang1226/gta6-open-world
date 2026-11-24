// The world: all the state, one step, and the rules that join the systems — car crashes,
// running pedestrians over, gang cars, the Comet GT, busting and wasting, saving. No drawing
// and no browser in it except localStorage for the save.
import {
  BEACH_H, BEST_KEY, BLOCK, CAR, CASH_START, CITY_H, CITY_W, DEBT_START, PALETTE, PLAYER, ROAD, SAVE_KEY, VIEW,
  WANTED, clamp,
} from './config.js';
import { createCity, nearestRoadCenter, roadCenterX, roadCenterY } from './city.js';
import { createPlayer, driveCar, enterCar, exitCar, makeCar, nearestCar, stepPlayer } from './player.js';
import { createTraffic, stepTraffic } from './traffic.js';
import { addWanted, clearWanted, createPolice, stepPolice } from './police.js';
import { createCombat, explode, fire, spawnParticles, stepCombat } from './combat.js';
import { createMissions, stepMissions } from './missions.js';

export const EVENT_HURT = 1;
export const EVENT_PICKUP = 2;
export const EVENT_MISSION = 4;
export const EVENT_SHOT = 8;
export const EVENT_CRASH = 16;
export const EVENT_SCRAPE = 32;
export const EVENT_RAM = 64;
export const EVENT_EXPLODE = 128;

export function createWorld(random) {
  const city = createCity(random);
  const spawn = spawnPoint(city);
  const state = {
    random,
    city,
    time: 0,
    cash: CASH_START,
    debt: DEBT_START,
    wanted: 0,
    events: 0,
    gameOver: null,
    bannerText: '',
    bannerTimer: 0,
    camera: { x: spawn.x, y: spawn.y },
    player: createPlayer(city, spawn),
    traffic: createTraffic(city, random),
    police: createPolice(random),
    combat: createCombat(),
    missions: createMissions(city),
    gangCars: [],
    comet: null,
    aimX: spawn.x,
    aimY: spawn.y - 100,
  };
  state.clearWanted = () => clearWanted(state, state.police);
  state.spawnGangCars = () => spawnGangCars(state);
  state.hurtPlayer = (amount) => hurtPlayer(state, amount);
  state.onPedShot = (ped) => { addWanted(state, state.police, WANTED.shoot, state.time); };
  state.onCopShot = (cop) => { addWanted(state, state.police, WANTED.killCop, state.time); };
  state.onCarShot = (car) => {
    if (car.kind === 'police') addWanted(state, state.police, WANTED.shoot, state.time);
    if (car.kind === 'gang') {
      // Gang cars are fair game in Job 4; shooting one outside it still draws heat.
      if (state.missions.index !== 3) addWanted(state, state.police, WANTED.shoot, state.time);
    }
    if (car.hp <= 0) destroyCar(state, car);
  };
  spawnComet(state);
  for (let i = 0; i < 4; i += 1) {
    const p = state.city.places.safehouse;
    const car = makeCar(p.x - 90 + i * 55, p.y + 90, Math.PI / 2, PALETTE.carColors[i % PALETTE.carColors.length], 'parked', 520);
    state.traffic.cars.push(car);
  }
  return state;
}

function spawnGangCars(state) {
  const { random, player } = state;
  for (let i = 0; i < 3; i += 1) {
    const angle = (i / 3) * Math.PI * 2 + random();
    const d = 520 + random() * 260;
    const car = makeCar(player.x + Math.cos(angle) * d, player.y + Math.sin(angle) * d, angle, PALETTE.gang, 'gang', 540);
    car.hp = 110;
    car.shootTimer = 1 + random();
    state.gangCars.push(car);
    state.traffic.cars.push(car);
  }
}

function destroyCar(state, car) {
  if (car.dead) return;
  car.dead = true;
  explode(state.combat, car.x, car.y);
  state.events |= EVENT_EXPLODE;
  if (car.kind === 'gang') {
    state.missions.wrecked += 1;
    state.traffic.cars = state.traffic.cars.filter((c) => c !== car);
    state.gangCars = state.gangCars.filter((c) => c !== car);
  }
  if (car.kind === 'player' && state.player.car === car) {
    // The player's ride blew up under him.
    state.player.car = null;
    state.player.onFoot = true;
    hurtPlayer(state, 30);
  }
}

function hurtPlayer(state, amount) {
  const player = state.player;
  player.health -= amount;
  player.lastHurt = state.time;
  state.events |= EVENT_HURT;
  if (player.health <= 0) {
    player.health = 0;
    state.gameOver = 'wasted';
  }
}

function spawnComet(state) {
  const garage = state.city.places.garage;
  const car = makeCar(garage.x + 40, garage.y + 30, -Math.PI / 2, PALETTE.playerCar, 'parked', 720);
  car.isComet = true;
  car.hp = 150;
  state.comet = car;
  state.traffic.cars.push(car);
}

// The spawn: pavement south of the safehouse, beside the parked cars. The block
// centre is inside the safehouse building and would push the player out the far side.
export function spawnPoint(city) {
  const safe = city.places.safehouse;
  return { x: safe.x - 40, y: safe.y + 130 };
}

export function resetWorld(state) {
  const spawn = spawnPoint(state.city);
  state.time = 0;
  state.cash = CASH_START;
  state.debt = DEBT_START;
  state.wanted = 0;
  state.gameOver = null;
  state.bannerText = '';
  state.bannerTimer = 0;
  state.player = createPlayer(state.city, spawn);
  state.traffic = createTraffic(state.city, state.random);
  state.police = createPolice(state.random);
  state.combat = createCombat();
  state.missions = createMissions(state.city);
  state.gangCars = [];
  state.camera.x = spawn.x;
  state.camera.y = spawn.y;
  state.clearWanted = () => clearWanted(state, state.police);
  state.spawnGangCars = () => spawnGangCars(state);
  state.hurtPlayer = (amount) => hurtPlayer(state, amount);
  state.onPedShot = () => { addWanted(state, state.police, WANTED.shoot, state.time); };
  state.onCarShot = (car) => {
    if (car.kind === 'police') addWanted(state, state.police, WANTED.shoot, state.time);
    if (car.kind === 'gang' && state.missions.index !== 3) addWanted(state, state.police, WANTED.shoot, state.time);
    if (car.hp <= 0) destroyCar(state, car);
  };
  spawnComet(state);
  // A few parked cars around the safehouse so the player can get moving.
  for (let i = 0; i < 4; i += 1) {
    const p = state.city.places.safehouse;
    const car = makeCar(p.x - 90 + i * 55, p.y + 90, Math.PI / 2, PALETTE.carColors[i % PALETTE.carColors.length], 'parked', 520);
    state.traffic.cars.push(car);
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.mission !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash,
      debt: state.debt,
      mission: state.missions.index,
      best: readBest(),
    }));
  } catch { /* storage off: the save lasts this visit only */ }
}

export function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch { /* ignore */ }
}

function carCollisions(state, dt) {
  const cars = state.traffic.cars;
  const player = state.player;
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 44 && d > 0.01) {
        const push = (44 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        // Signed approach speed along the line between them. Only a real
        // approach hurts, and only once: the impulse below makes the two
        // separate, so the next frame the approach is ~0 and no damage repeats.
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rel > 0) {
          const kick = rel * 0.6;
          a.vx -= nx * kick;
          a.vy -= ny * kick;
          b.vx += nx * kick;
          b.vy += ny * kick;
          if (rel > 240) {
            a.hp -= rel * 0.05;
            b.hp -= rel * 0.05;
            state.events |= EVENT_CRASH;
            if (a.hp <= 0) destroyCar(state, a);
            if (b.hp <= 0) destroyCar(state, b);
          }
        }
      }
    }
  }
  // A shoved parked car slides: its velocity only lives in vx/vy, and nothing
  // else integrates it, so move it here and let friction bleed it off.
  for (const car of cars) {
    if (car.dead || car.kind !== 'parked') continue;
    if (car.vx === 0 && car.vy === 0) continue;
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    car.vx *= Math.exp(-2.5 * dt);
    car.vy *= Math.exp(-2.5 * dt);
    if (Math.hypot(car.vx, car.vy) < 4) { car.vx = 0; car.vy = 0; }
  }
  // The player's car running pedestrians over.
  if (!player.onFoot && player.car) {
    const car = player.car;
    for (const ped of state.traffic.peds) {
      if (ped.dead) continue;
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < 30 && car.speed > 170) {
        ped.dead = true;
        spawnParticles(state.combat, ped.x, ped.y, 10, '#c85a5a', 160);
        addWanted(state, state.police, WANTED.hitPed, state.time);
        state.events |= EVENT_CRASH;
      } else if (d < 30) {
        // Shove them aside at low speed.
        ped.x += ((ped.x - car.x) / (d || 1)) * 40 * dt * 10;
        ped.y += ((ped.y - car.y) / (d || 1)) * 40 * dt * 10;
      }
    }
  }
}

function stepGangCars(state, dt) {
  const player = state.player;
  for (const car of state.gangCars) {
    if (car.dead) continue;
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2));
    driveCar(car, dist > 220 ? 1 : 0.3, steer, dt);
    car.shootTimer -= dt;
    if (car.shootTimer <= 0 && dist < 520) {
      car.shootTimer = 1.1 + state.random() * 0.8;
      const angle = Math.atan2(player.y - car.y, player.x - car.x) + (state.random() - 0.5) * 0.2;
      fire(state.combat, car.x + Math.cos(angle) * 24, car.y + Math.sin(angle) * 24, angle, false);
    }
  }
}

/**
 * One fixed step. `input` is the input device, `aim` is the mouse in world coordinates,
 * `interact` is the E press this frame, `interactHeld` is E held down. Returns event flags.
 */
export function stepWorld(state, input, aim, interact, interactHeld, shootPressed, dt) {
  state.events = 0;
  state.time += dt;
  if (state.bannerTimer > 0) state.bannerTimer -= dt;
  const player = state.player;

  // Interact: get in or out of a car.
  if (interact) {
    if (player.onFoot) {
      const car = nearestCar(player, state.traffic.cars, 64);
      if (car) {
        enterCar(player, car);
        if (!car.isComet || state.missions.index !== 0) {
          addWanted(state, state.police, WANTED.steal, state.time);
        }
        state.events |= EVENT_PICKUP;
      }
    } else {
      exitCar(player);
    }
  }

  // Shooting, on foot only, toward the mouse.
  if (player.onFoot && shootPressed) {
    player.aimX = aim.x;
    player.aimY = aim.y;
    const angle = Math.atan2(aim.y - player.y, aim.x - player.x);
    if (fire(state.combat, player.x + Math.cos(angle) * 20, player.y + Math.sin(angle) * 20, angle, true)) {
      state.events |= EVENT_SHOT;
      addWanted(state, state.police, WANTED.shoot, state.time);
    }
  }
  if (player.onFoot) {
    player.aimX = aim.x;
    player.aimY = aim.y;
  }

  stepMissions(state.missions, state, dt, interactHeld);
  state.events |= stepPlayer(player, input, state.city, state.traffic.cars, dt, state.time, true);
  stepTraffic(state.traffic, player, dt, state.time);
  stepPolice(state.police, state, state.city, state.traffic.cars, dt, state.time);
  stepGangCars(state, dt);
  stepCombat(state.combat, state, dt);
  carCollisions(state, dt);

  // The player's car, wrecked.
  if (player.car && player.car.hp <= 0) destroyCar(state, player.car);

  // Busted: a foot cop held him long enough.
  if (player.onFoot && player.busted > 2.5) {
    state.gameOver = 'busted';
  }

  // Camera follows the player, eased, and never leaves the city: the view
  // always shows ground, never the dark void past the map edge.
  const cam = state.camera;
  cam.x += (player.x - cam.x) * Math.min(1, dt * 5);
  cam.y += (player.y - cam.y) * Math.min(1, dt * 5);
  cam.x = clamp(cam.x, VIEW.width / 2, CITY_W - VIEW.width / 2);
  cam.y = clamp(cam.y, VIEW.height / 2, CITY_H + BEACH_H - VIEW.height / 2);

  return state.events;
}
