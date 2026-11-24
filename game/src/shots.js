// The screenshot scenes behind ?shot=cover|chase|mission|combat. Each one sets the real world
// to a moment of play — the player driving the boulevard, a police chase, a pickup at the docks,
// a shootout with a gang car — then runs the rules forward a short while so traffic and
// pedestrians settle, and returns the screen to draw. The same seed always gives the same frame.
import { STEP } from './config.js';
import { roadCenterX, roadCenterY } from './city.js';
import { SCREEN_PLAY } from './hud.js';
import { enterCar, makeCar } from './player.js';
import { introFor } from './missions.js';
import { stepWorld } from './world.js';

// A fake input that holds the wheel straight and the throttle down.
function driveInput() {
  return {
    axes() { return { x: 0, y: -1 }; },
    run() { return false; },
    takeActions() { return 0; },
  };
}
function idleInput() {
  return {
    axes() { return { x: 0, y: 0 }; },
    run() { return false; },
    takeActions() { return 0; },
  };
}

function placeTraffic(world, spots) {
  for (const s of spots) {
    const car = makeCar(s.x, s.y, s.angle, s.color, 'traffic', 520);
    car.cruise = s.speed || 160;
    car.speed = s.speed || 160;
    car.vx = Math.cos(s.angle) * car.speed;
    car.vy = Math.sin(s.angle) * car.speed;
    world.traffic.cars.push(car);
  }
}

function placeCop(world, x, y, angle, topSpeed) {
  const car = makeCar(x, y, angle, '#1c2733', 'police', topSpeed || 560);
  car.hp = 120;
  car.flash = 1;
  world.police.copCars.push(car);
  world.traffic.cars.push(car);
  return car;
}

function setMission(world, index, stage, banner) {
  world.missions.index = index;
  world.missions.stage = stage;
  world.missions.started = true;
  world.missions.timer = 0;
  world.missions.holdTimer = 0;
  world.missions.wrecked = index === 3 ? 1 : 0;
  world.missions.banner = banner;
  world.missions.bannerTimer = 3.5;
  world.bannerText = introFor(index);
  world.bannerTimer = 5;
}

function stepFor(world, input, seconds) {
  const aim = { x: world.player.x, y: world.player.y - 100 };
  for (let i = 0; i < seconds / STEP; i += 1) {
    stepWorld(world, input, aim, false, false, false, STEP);
  }
}

/** Set `world` to the named scene and return the screen to draw over it. */
export function stageShot(name, world) {
  const player = world.player;
  if (name === 'chase') {
    // A three-car police chase down the avenue, four stars.
    const x = roadCenterX(4) - 14; // the player's lane, heading south
    const y = 1250;
    const comet = world.comet;
    comet.x = x;
    comet.y = y;
    comet.angle = Math.PI / 2;
    player.x = x;
    player.y = y;
    enterCar(player, comet);
    // Oncoming lane only, so nothing sits in the player's path.
    placeTraffic(world, [
      { x: roadCenterX(4) + 14, y: y + 260, angle: -Math.PI / 2, color: '#c8c8d0', speed: 170 },
      { x: roadCenterX(4) + 14, y: y - 320, angle: -Math.PI / 2, color: '#3a6ab8', speed: 150 },
      { x: roadCenterX(2) + 14, y: y + 120, angle: -Math.PI / 2, color: '#c8a03a', speed: 140 },
    ]);
    placeCop(world, x, y - 380, Math.PI / 2);
    placeCop(world, x + 4, y - 470, Math.PI / 2);
    placeCop(world, x - 30, y - 300, Math.PI / 2);
    world.wanted = 4;
    world.camera.x = x;
    world.camera.y = y;
    stepFor(world, driveInput(), 1.0);
    setMission(world, 1, 0, 'Job 2 — Heat Check');
    world.missions.timer = 21;
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'mission') {
    // On foot at the docks, the package waiting, the city behind him.
    const docks = world.city.places.docks;
    player.onFoot = true;
    player.car = null;
    player.x = docks.x - 150;
    player.y = docks.y + 90;
    player.angle = Math.PI / 4;
    placeTraffic(world, [
      { x: roadCenterX(6) + 14, y: docks.y - 200, angle: -Math.PI / 2, color: '#5a8a3a', speed: 150 },
      { x: roadCenterX(6) + 14, y: docks.y + 260, angle: -Math.PI / 2, color: '#e0e0e0', speed: 160 },
    ]);
    world.camera.x = player.x;
    world.camera.y = player.y;
    stepFor(world, idleInput(), 1.2);
    setMission(world, 2, 1, 'Job 3 — Dockside');
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'combat') {
    // A shootout with a Viper gang car on the market street, three stars.
    const market = world.city.places.market;
    player.onFoot = true;
    player.car = null;
    player.x = market.x - 120;
    player.y = market.y + 60;
    player.angle = 0;
    const gang = makeCar(market.x + 60, market.y + 60, Math.PI, '#7a2a8a', 'gang', 540);
    gang.hp = 70;
    world.gangCars.push(gang);
    world.traffic.cars.push(gang);
    placeTraffic(world, [
      { x: roadCenterX(5) - 14, y: market.y - 260, angle: Math.PI / 2, color: '#b85a2a', speed: 150 },
    ]);
    placeCop(world, market.x - 300, market.y - 180, 0);
    world.wanted = 3;
    world.camera.x = player.x;
    world.camera.y = player.y;
    // Fire one shot so a bullet is in the air.
    stepFor(world, idleInput(), 0.6);
    const aim = { x: gang.x, y: gang.y };
    stepWorld(world, idleInput(), aim, false, false, true, STEP);
    setMission(world, 3, 0, 'Job 4 — Payback');
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // Cover: the Comet GT flying down the boulevard, a cop on his tail, two stars.
  // The player keeps to one lane; traffic uses the oncoming lane, so the drive is clean.
  const x = roadCenterX(3) - 14;
  const y = 1150;
  const comet = world.comet;
  comet.x = x;
  comet.y = y;
  comet.angle = Math.PI / 2;
  player.x = x;
  player.y = y;
  enterCar(player, comet);
  placeTraffic(world, [
    { x: roadCenterX(3) + 14, y: y + 300, angle: -Math.PI / 2, color: '#c8c8d0', speed: 175 },
    { x: roadCenterX(3) + 14, y: y - 380, angle: -Math.PI / 2, color: '#3a6ab8', speed: 155 },
    { x: roadCenterX(3) + 14, y: y - 180, angle: -Math.PI / 2, color: '#c8a03a', speed: 165 },
    { x: roadCenterX(5) + 14, y: y + 140, angle: -Math.PI / 2, color: '#5a8a3a', speed: 150 },
  ]);
  placeCop(world, x, y - 200, Math.PI / 2, 700);
  world.wanted = 2;
  world.camera.x = x;
  world.camera.y = y;
  stepFor(world, driveInput(), 1.0);
  setMission(world, 0, 2, 'Job 1 — Wheels Up');
  return { screen: SCREEN_PLAY, best: 0 };
}
