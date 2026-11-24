// The wanted system and the Solara Bay Police Department. Stars rise with crimes and fall
// when the heat dies down; cop cars spawn to match the stars and ram the player's car, and foot
// cops chase him on foot and hold him to bust him.
import { CITY_H, CITY_W, PALETTE, WANTED } from './config.js';
import { collideCircle, randomRoadPoint } from './city.js';
import { driveCar, makeCar } from './player.js';

export function createPolice(random) {
  return {
    random,
    copCars: [],
    footCops: [],
    lastCrime: -99,
    decayTimer: 0,
    sirenOn: false,
  };
}

export function addWanted(state, police, stars, time) {
  state.wanted = Math.min(WANTED.max, state.wanted + stars);
  police.lastCrime = time;
  police.decayTimer = 0;
}

function spawnCopCar(police, player) {
  const { random } = police;
  let x;
  let y;
  let tries = 0;
  do {
    const p = randomRoadPoint(random);
    x = p.x;
    y = p.y;
    tries += 1;
  } while (Math.hypot(x - player.x, y - player.y) < 650 && tries < 10);
  const car = makeCar(x, y, Math.atan2(player.y - y, player.x - x), PALETTE.police, 'police', 560);
  car.hp = 120;
  car.cruise = 0;
  return car;
}

function spawnFootCop(police, player) {
  const { random } = police;
  const angle = random() * Math.PI * 2;
  const d = 420 + random() * 200;
  return {
    x: player.x + Math.cos(angle) * d,
    y: player.y + Math.sin(angle) * d,
    angle: 0,
    speed: 235,
    color: '#22303f',
    dead: false,
    hold: 0,
  };
}

export function stepPolice(police, state, city, cars, dt, time) {
  const player = state.player;
  // Decay: no crime for a while and no cop close by, and the heat drops a star.
  const nearestCop = nearestCopDist(police, player);
  if (state.wanted > 0 && time - police.lastCrime > WANTED.decayDelay && nearestCop > 520) {
    police.decayTimer += dt;
    if (police.decayTimer >= WANTED.decayEvery) {
      police.decayTimer = 0;
      state.wanted -= 1;
    }
  } else {
    police.decayTimer = 0;
  }

  // Keep the cop cars matched to the stars.
  const wantCars = state.wanted;
  while (police.copCars.length < wantCars) {
    const car = spawnCopCar(police, player);
    police.copCars.push(car);
    cars.push(car);
  }
  while (police.copCars.length > wantCars) {
    const car = police.copCars.pop();
    car.dead = true;
  }
  // Foot cops from 2 stars up.
  const wantFoot = state.wanted >= 4 ? 2 : state.wanted >= 2 ? 1 : 0;
  while (police.footCops.length < wantFoot) police.footCops.push(spawnFootCop(police, player));
  while (police.footCops.length > wantFoot) police.footCops.pop();

  // Cop cars chase: steer toward the player and ram.
  for (const car of police.copCars) {
    if (car.dead) continue;
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    const throttle = dist > 60 ? 1 : 0.4;
    driveCar(car, throttle, steer, dt);
    const fixed = collideCircle(city, car.x, car.y, 24);
    if (fixed.x !== car.x || fixed.y !== car.y) {
      car.vx *= 0.5;
      car.vy *= 0.5;
      car.x = fixed.x;
      car.y = fixed.y;
    }
    car.flash = (time * 6) % 1 < 0.5 ? 1 : 2;
    // Ramming the player's car hurts it; ramming the player on foot hurts him.
    if (!player.onFoot && player.car && dist < 52) {
      player.car.hp -= 26 * dt;
      car.hp -= 8 * dt;
      state.events |= 64; // EVENT_RAM
    }
  }

  // Foot cops run the player down and hold him.
  player.busted = 0;
  for (const cop of police.footCops) {
    if (cop.dead) continue;
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    cop.angle = Math.atan2(dy, dx);
    if (player.onFoot && dist < 46) {
      cop.hold += dt;
      player.busted = cop.hold;
    } else {
      cop.hold = Math.max(0, cop.hold - dt * 2);
    }
    if (dist > 30) {
      cop.x += (dx / dist) * cop.speed * dt;
      cop.y += (dy / dist) * cop.speed * dt;
    }
    const fixed = collideCircle(city, cop.x, cop.y, 11);
    cop.x = fixed.x;
    cop.y = fixed.y;
  }

  police.sirenOn = state.wanted > 0 && nearestCop < 900;
}

export function nearestCopDist(police, player) {
  let best = Infinity;
  for (const car of police.copCars) {
    if (car.dead) continue;
    best = Math.min(best, Math.hypot(car.x - player.x, car.y - player.y));
  }
  for (const cop of police.footCops) {
    if (cop.dead) continue;
    best = Math.min(best, Math.hypot(cop.x - player.x, cop.y - player.y));
  }
  return best;
}

export function clearWanted(state, police) {
  state.wanted = 0;
  police.decayTimer = 0;
  for (const car of police.copCars) car.dead = true;
  police.copCars.length = 0;
  police.footCops.length = 0;
}
