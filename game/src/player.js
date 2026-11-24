// The player: Jax Marlowe, getaway driver. On foot he walks and runs and aims with the mouse;
// in a car he drives it with arcade physics. Entering a car is E next to it; E again gets out.
import { CAR, PLAYER } from './config.js';
import { collideCircle } from './city.js';

export function createPlayer(city, spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    angle: -Math.PI / 2,
    health: PLAYER.health,
    onFoot: true,
    car: null,
    speed: 0,
    lastHurt: -99,
    busted: 0, // seconds a cop has held him, on foot
    aimX: spawn.x,
    aimY: spawn.y - 100,
  };
}

/** Drive one car for a step. `ax` is -1/0/1 throttle, `steer` is -1/0/1. Returns speed. */
export function driveCar(car, ax, steer, dt) {
  const forward = Math.cos(car.angle);
  const right = Math.sin(car.angle);
  const along = car.vx * forward + car.vy * right;
  const side = -car.vx * right + car.vy * forward;
  let nextAlong = along;
  if (ax > 0) nextAlong += CAR.accel * dt;
  else if (ax < 0) nextAlong -= (along > 20 ? CAR.brake : CAR.accel * 0.55) * dt;
  else nextAlong -= Math.sign(nextAlong) * Math.min(Math.abs(nextAlong), 260 * dt);
  nextAlong = Math.max(-CAR.reverseMax, Math.min(car.topSpeed || 620, nextAlong));
  const nextSide = side * Math.exp(-CAR.grip * dt);
  const speedFactor = Math.min(1, Math.abs(nextAlong) / 260);
  const turn = steer * CAR.steer * speedFactor * Math.sign(nextAlong || 1) * dt;
  car.angle += turn;
  const nf = Math.cos(car.angle);
  const nr = Math.sin(car.angle);
  car.vx = nf * nextAlong - nr * nextSide;
  car.vy = nr * nextAlong + nf * nextSide;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.speed = Math.hypot(car.vx, car.vy);
  return car.speed;
}

export function makeCar(x, y, angle, color, kind, topSpeed) {
  return {
    x, y, angle,
    vx: 0, vy: 0, speed: 0,
    color, kind: kind || 'traffic',
    topSpeed: topSpeed || 620,
    hp: CAR.hp,
    dead: false,
    flash: 0,
    honk: 0,
  };
}

/** Step the player. Returns event flags the world turns into sound and wanted changes. */
export function stepPlayer(player, input, city, cars, dt, time, canShoot) {
  let events = 0;
  if (player.health < PLAYER.health && time - player.lastHurt > PLAYER.regenDelay) {
    player.health = Math.min(PLAYER.health, player.health + PLAYER.regen * dt);
  }
  if (player.onFoot) {
    const axes = input.axes();
    const speed = input.run() ? PLAYER.run : PLAYER.walk;
    let mx = axes.x;
    let my = axes.y;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
      player.angle = Math.atan2(my, mx);
    }
    const nx = player.x + mx * speed * dt;
    const ny = player.y + my * speed * dt;
    const fixed = collideCircle(city, nx, ny, PLAYER.radius);
    player.x = fixed.x;
    player.y = fixed.y;
    player.speed = len > 0 ? speed : 0;
  } else if (player.car) {
    const axes = input.axes();
    // In a car, W/S is throttle and A/D steers; S brakes then reverses.
    driveCar(player.car, -axes.y, axes.x, dt);
    const fixed = collideCircle(city, player.car.x, player.car.y, 24);
    if (fixed.x !== player.car.x || fixed.y !== player.car.y) {
      // Scraped a building: slow down hard and spark.
      player.car.vx *= 0.4;
      player.car.vy *= 0.4;
      player.car.x = fixed.x;
      player.car.y = fixed.y;
      events |= 32; // EVENT_SCRAPE
    }
    player.x = player.car.x;
    player.y = player.car.y;
    player.angle = player.car.angle;
    player.speed = player.car.speed;
  }
  return events;
}

/** The nearest stealable car within reach, or null. */
export function nearestCar(player, cars, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.dead || car.kind === 'player') continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(player, car) {
  car.kind = 'player';
  player.car = car;
  player.onFoot = false;
  car.vx = 0;
  car.vy = 0;
  car.speed = 0;
}

export function exitCar(player) {
  if (!player.car) return;
  const car = player.car;
  // Parked where it was left: the traffic system only moves kind 'traffic',
  // so a 'parked' car stays put and can be stolen again.
  car.kind = 'parked';
  const side = player.angle + Math.PI / 2;
  player.x = car.x + Math.cos(side) * 34;
  player.y = car.y + Math.sin(side) * 34;
  player.onFoot = true;
  player.car = null;
}
