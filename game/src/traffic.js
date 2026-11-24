// Traffic and pedestrians: the city alive. Traffic cars drive the road grid, turning at
// intersections and slowing for the car ahead; pedestrians stroll the sidewalks and run from
// gunfire and speeding cars. Both respawn out of sight so the streets never empty.
import { BLOCK, CITY_H, CITY_W, PALETTE, PEDS, ROAD, TRAFFIC } from './config.js';
import { collideCircle, nearestRoadCenter, onRoad, randomRoadPoint, roadCenterX, roadCenterY } from './city.js';
import { makeCar } from './player.js';

const LANES = [-14, 14];

export function createTraffic(city, random) {
  const cars = [];
  const peds = [];
  return { cars, peds, city, random };
}

function spawnTrafficCar(traffic, near) {
  const { city, random } = traffic;
  let x;
  let y;
  let angle;
  let tries = 0;
  do {
    const p = randomRoadPoint(random);
    x = p.x;
    y = p.y;
    tries += 1;
  } while (near && Math.hypot(x - near.x, y - near.y) < 500 && tries < 8);
  // Angle along the road: vertical roads run north/south, horizontal east/west.
  const mx = x % (BLOCK + ROAD);
  const my = y % (BLOCK + ROAD);
  if (mx < ROAD) angle = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
  else angle = random() < 0.5 ? 0 : Math.PI;
  const color = PALETTE.carColors[Math.floor(random() * PALETTE.carColors.length)];
  const car = makeCar(x, y, angle, color, 'traffic', 420 + random() * 120);
  car.cruise = TRAFFIC.speedMin + random() * (TRAFFIC.speedMax - TRAFFIC.speedMin);
  car.lane = LANES[Math.floor(random() * 2)];
  return car;
}

function spawnPed(traffic, near) {
  const { city, random } = traffic;
  let x;
  let y;
  let tries = 0;
  do {
    x = 60 + random() * (CITY_W - 120);
    y = 60 + random() * (CITY_H - 120);
    tries += 1;
  } while (near && Math.hypot(x - near.x, y - near.y) < 320 && tries < 8);
  return {
    x, y,
    angle: random() * Math.PI * 2,
    speed: PEDS.speedMin + random() * (PEDS.speedMax - PEDS.speedMin),
    color: PALETTE.ped[Math.floor(random() * PALETTE.ped.length)],
    dead: false,
    flee: 0,
    change: 1 + random() * 4,
  };
}

function carAhead(cars, self, look) {
  const fx = Math.cos(self.angle);
  const fy = Math.sin(self.angle);
  let best = Infinity;
  for (const other of cars) {
    if (other === self || other.dead) continue;
    const dx = other.x - self.x;
    const dy = other.y - self.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (along > 0 && along < look && side < 30 && along < best) best = along;
  }
  return best;
}

export function stepTraffic(traffic, player, dt, time) {
  const { cars, peds, city, random } = traffic;
  // Keep the counts up, spawning out of the player's sight.
  while (cars.filter((c) => c.kind === 'traffic' && !c.dead).length < TRAFFIC.count) {
    cars.push(spawnTrafficCar(traffic, player));
  }
  while (peds.filter((p) => !p.dead).length < PEDS.count) {
    peds.push(spawnPed(traffic, player));
  }

  for (const car of cars) {
    if (car.dead || car.kind !== 'traffic') continue;
    // At an intersection, sometimes turn.
    const nearCenter = nearestRoadCenter(car.x, car.y);
    const onV = Math.abs(car.x - nearCenter.vx) < 40;
    const onH = Math.abs(car.y - nearCenter.hy) < 40;
    if (onV && onH && Math.abs(Math.sin(car.angle)) > 0.5) {
      if (random() < 0.12 * dt * 60) car.angle += (random() < 0.5 ? 1 : -1) * Math.PI / 2;
    } else if (onV && onH && Math.abs(Math.cos(car.angle)) > 0.5) {
      if (random() < 0.12 * dt * 60) car.angle += (random() < 0.5 ? 1 : -1) * Math.PI / 2;
    }
    // Slow for the car ahead; crawl through the player's neighbourhood.
    const ahead = carAhead(cars, car, 90);
    let target = car.cruise;
    if (ahead < 70) target = 0;
    else if (ahead < 110) target = car.cruise * 0.35;
    const d = Math.hypot(player.x - car.x, player.y - car.y);
    if (d < 60 && player.speed > 260) target = 0;
    car.speed += Math.max(-320 * dt, Math.min(200 * dt, target - car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const fixed = collideCircle(city, car.x, car.y, 22);
    if (fixed.x !== car.x || fixed.y !== car.y) {
      car.angle += Math.PI / 2;
      car.x = fixed.x;
      car.y = fixed.y;
    }
    // Wrap around the city edge so traffic never piles up outside it.
    if (car.x < -80) car.x = CITY_W + 60;
    if (car.x > CITY_W + 80) car.x = -60;
    if (car.y < -80) car.y = CITY_H + 60;
    if (car.y > CITY_H + 80) car.y = -60;
  }

  for (const ped of peds) {
    if (ped.dead) continue;
    ped.change -= dt;
    if (ped.change <= 0) {
      ped.change = 1.5 + random() * 4;
      ped.angle += (random() - 0.5) * 1.8;
    }
    const dp = Math.hypot(player.x - ped.x, player.y - ped.y);
    let speed = ped.speed;
    if (ped.flee > 0) {
      ped.flee -= dt;
      speed = ped.speed * 3.2;
      ped.angle = Math.atan2(ped.y - player.y, ped.x - player.x);
    } else if (dp < 90 && player.speed > 280) {
      ped.flee = 1.2;
    }
    const nx = ped.x + Math.cos(ped.angle) * speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * speed * dt;
    const fixed = collideCircle(city, nx, ny, 10);
    ped.x = fixed.x;
    ped.y = fixed.y;
    if (fixed.x !== nx || fixed.y !== ny) ped.angle += Math.PI / 2;
  }

  // Cull the far dead so the arrays stay short.
  for (let i = cars.length - 1; i >= 0; i -= 1) {
    if (cars[i].dead) cars.splice(i, 1);
  }
  for (let i = peds.length - 1; i >= 0; i -= 1) {
    if (peds[i].dead) peds.splice(i, 1);
  }
}
