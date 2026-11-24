// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the city and the traffic. ?shot=cover|chase|mission|combat (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP, VIEW } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_CRASH, EVENT_EXPLODE, EVENT_HURT, EVENT_MISSION, EVENT_PICKUP, EVENT_RAM, EVENT_SCRAPE, EVENT_SHOT,
  createWorld, loadSave, readBest, resetWorld, saveBest, saveGame, stepWorld,
} from './world.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_PAUSE, ACTION_SHOOT, createInput } from './input.js';
import { createRenderer } from './render.js';
import { SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, createHud } from './hud.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { nearestCar } from './player.js';
import { stageTarget } from './missions.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
// A small handle for automated checks; the game itself never reads it.
window.__solara = { world, VIEW, SCREEN_TITLE, SCREEN_PLAY };
const renderer = createRenderer(canvas);
const hud = createHud(canvas);
const audio = createAudio();

function runShot(name) {
  resetWorld(world);
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.drawWorld(world);
    hud.drawHud(world, '', renderer.view);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let save = loadSave();
  let accumulator = 0;
  let last = performance.now();
  let interactHeld = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    audio.unlock();
    if (fresh || !save) {
      resetWorld(world);
      save = null;
    } else {
      // Continue: restore cash, debt and the mission from the save.
      resetWorld(world);
      world.cash = save.cash;
      world.debt = save.debt;
      world.missions.index = Math.min(save.mission, 4);
      world.missions.started = false;
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Solara Bay.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.cash > best) {
      best = world.cash;
      saveBest(best);
    }
    saveGame(world);
    save = loadSave();
    announce(world.gameOver === 'complete' ? 'Debt paid. Solara Bay is yours.' : `Game over. ${world.cash} dollars.`);
  }

  function promptFor() {
    const player = world.player;
    if (player.onFoot) {
      const car = nearestCar(player, world.traffic.cars, 64);
      if (car) return car.isComet ? 'E — Steal the Comet GT' : 'E — Steal car';
      const target = stageTarget(world.missions, world.city);
      if (target && Math.hypot(player.x - target.x, player.y - target.y) < 110) {
        return 'E — Interact';
      }
      return '';
    }
    return 'E — Get out    Shift — Handbrake';
  }

  function handleEvents(events) {
    if (events & EVENT_SHOT) audio.gunshot();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_MISSION) audio.mission();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_SCRAPE) audio.crash();
    if (events & EVENT_RAM) audio.crash();
    if (events & EVENT_EXPLODE) { audio.crash(); audio.fail(); }
    if (events & EVENT_HURT) announce(`Hurt. Health ${Math.round(world.player.health)}.`);
  }

  function aimWorld() {
    const rect = canvas.getBoundingClientRect();
    const ratio = canvas.width / Math.max(1, rect.width);
    const sx = input.mouse.x * ratio;
    const sy = input.mouse.y * ratio;
    return renderer.toWorld(sx, sy, world.camera);
  }

  function step() {
    const actions = input.takeActions();
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
        return;
      }
      if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
        return;
      }
    }
    if (screen === SCREEN_TITLE) {
      // A living backdrop: traffic and pedestrians move while the title shows.
      const idle = { axes() { return { x: 0, y: 0 }; }, run() { return false; }, takeActions() { return 0; } };
      stepWorld(world, idle, { x: world.player.x, y: world.player.y - 100 }, false, false, false, STEP);
      if (actions & ACTION_CONFIRM) startGame(false);
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) startGame(true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const aim = aimWorld();
    const events = stepWorld(
      world, input, aim,
      Boolean(actions & ACTION_INTERACT),
      heldE(),
      Boolean(actions & ACTION_SHOOT) || (input.mouse.down && world.player.onFoot),
      STEP,
    );
    handleEvents(events);
    if (world.gameOver) endGame();
    // Sound: siren when cops are near, engine when driving.
    const driving = !world.player.onFoot && world.player.car !== null;
    audio.update(STEP, world.police.sirenOn, driving, driving ? world.player.car.speed / 720 : 0);
  }

  // E held down (for the bank grab): the input module exposes the key set via a probe.
  function heldE() {
    return input.held ? input.held('KeyE') : false;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Title runs the world as a backdrop; play steps it; pause and over hold still.
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
        if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) break;
      }
    } else {
      accumulator = 0;
    }
    renderer.drawWorld(world);
    const view = renderer.view;
    if (screen === SCREEN_PLAY) {
      hud.drawHud(world, promptFor(), view);
    } else {
      hud.drawMenu(world, screen, best, save, view);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM' && !event.repeat) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
  });

  announce('Solara Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
