// Drawing the world only: the city, the cars, the people, the bullets, the particles. The
// 1280x720 view is scaled to fit the window and centred; the camera follows the player. The
// HUD, the minimap and the menus live in hud.js.
import { BEACH_H, BLOCK, CITY_H, CITY_W, COLS, FONT, PALETTE, ROAD, ROWS, VIEW } from './config.js';
import { blockRect, roadCenterX, roadCenterY, roadX, roadY } from './city.js';
import { stageTarget } from './missions.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, w: 0, h: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * ratio);
    const h = Math.round(window.innerHeight * ratio);
    canvas.width = w;
    canvas.height = h;
    view.scale = Math.min(w / VIEW.width, h / VIEW.height);
    view.x = (w - VIEW.width * view.scale) / 2;
    view.y = (h - VIEW.height * view.scale) / 2;
    view.w = w;
    view.h = h;
  }
  resize();
  window.addEventListener('resize', resize);

  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight || ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  /** Screen position of a world point, for the HUD's aim and prompts. */
  function toScreen(wx, wy, camera) {
    return {
      x: view.x + (wx - (camera.x - VIEW.width / 2)) * view.scale,
      y: view.y + (wy - (camera.y - VIEW.height / 2)) * view.scale,
    };
  }
  function toWorld(sx, sy, camera) {
    return {
      x: (sx - view.x) / view.scale + (camera.x - VIEW.width / 2),
      y: (sy - view.y) / view.scale + (camera.y - VIEW.height / 2),
    };
  }

  function drawCity(state, camera) {
    const city = state.city;
    // Ground: the whole city footprint. (The caller already translated into world coords.)
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, CITY_W, CITY_H + BEACH_H);
    // Beach and water at the bottom.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, CITY_H, CITY_W, BEACH_H * 0.55);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(0, CITY_H + BEACH_H * 0.55, CITY_W, BEACH_H * 0.45);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, CITY_H + BEACH_H * 0.55);
    ctx.lineTo(CITY_W, CITY_H + BEACH_H * 0.55);
    ctx.stroke();
    // Parks.
    for (const p of city.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
    // Sidewalks: light border inside each block.
    ctx.fillStyle = PALETTE.sidewalk;
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const b = blockRect(c, r);
        ctx.fillRect(b.x - 8, b.y - 8, b.w + 16, b.h + 16);
      }
    }
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (let i = 0; i <= COLS; i += 1) ctx.fillRect(roadX(i), 0, ROAD, CITY_H);
    for (let j = 0; j <= ROWS; j += 1) ctx.fillRect(0, roadY(j), CITY_W, ROAD);
    // Lane dashes.
    ctx.fillStyle = PALETTE.lane;
    const dash = 26;
    const gap = 30;
    for (let i = 0; i <= COLS; i += 1) {
      const cx = roadCenterX(i);
      for (let y = 0; y < CITY_H; y += dash + gap) ctx.fillRect(cx - 2, y, 4, dash);
    }
    for (let j = 0; j <= ROWS; j += 1) {
      const cy = roadCenterY(j);
      for (let x = 0; x < CITY_W; x += dash + gap) ctx.fillRect(x, cy - 2, dash, 4);
    }
    // Trees.
    for (const t of city.trees) {
      ctx.fillStyle = '#3f7a34';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5da34e';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Buildings.
    for (const b of city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      ctx.fillStyle = PALETTE.glass;
      const cols = Math.max(1, Math.floor((b.w - 24) / 26));
      const rows = Math.max(1, Math.floor((b.h - 24) / 26));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          ctx.fillRect(b.x + 14 + i * 26, b.y + 14 + j * 26, 12, 12);
        }
      }
    }
    // Place labels.
    ctx.font = `600 13px ${FONT}`;
    ctx.textAlign = 'center';
    for (const key of Object.keys(city.places)) {
      const p = city.places[key];
      ctx.fillStyle = 'rgba(12,16,24,0.55)';
      const w = ctx.measureText(p.name).width + 14;
      ctx.fillRect(p.x - w / 2, p.y - 24, w, 18);
      ctx.fillStyle = '#f4f1e8';
      ctx.fillText(p.name, p.x, p.y - 11);
    }
    // Mission marker beacon.
    const target = stageTarget(state.missions, city);
    if (target) {
      const pulse = 1 + Math.sin(state.time * 4) * 0.12;
      ctx.save();
      ctx.translate(target.x, target.y);
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // A guiding line from the player to the marker, faint.
      ctx.strokeStyle = 'rgba(242,201,76,0.35)';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.moveTo(state.player.x, state.player.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawCar(car, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    if (car.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
    }
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(-24, -10, 48, 24, 7);
    ctx.fill();
    // Body.
    ctx.fillStyle = car.flash > 0 ? '#ffffff' : car.color;
    roundRect(-23, -11, 46, 22, 7);
    ctx.fill();
    // Windshield and rear window.
    ctx.fillStyle = '#20262e';
    ctx.fillRect(6, -8, 8, 16);
    ctx.fillRect(-14, -8, 6, 16);
    // Wheels.
    ctx.fillStyle = '#14181d';
    ctx.fillRect(-16, -13, 10, 4);
    ctx.fillRect(-16, 9, 10, 4);
    ctx.fillRect(8, -13, 10, 4);
    ctx.fillRect(8, 9, 10, 4);
    if (car.kind === 'police') {
      ctx.fillStyle = '#f4f1e8';
      ctx.fillRect(-4, -11, 8, 22);
      const light = car.flash === 1 ? '#ff3b30' : car.flash === 2 ? '#2f7bff' : '#888888';
      ctx.fillStyle = light;
      ctx.fillRect(-2, -11, 5, 6);
      ctx.fillRect(-2, 5, 5, 6);
    }
    if (car.isComet) {
      ctx.fillStyle = '#ffd76a';
      ctx.fillRect(-23, -2, 46, 4);
    }
    ctx.restore();
    if (car.hp < 60 && car.hp > 0) {
      // Smoke from a dying car.
      ctx.fillStyle = 'rgba(60,60,60,0.5)';
      ctx.beginPath();
      ctx.arc(car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, 8 + Math.sin(time * 9) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPerson(x, y, angle, color, radius, outline) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(x + 2, y + 3, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = outline || 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * (radius + 7), y + Math.sin(angle) * (radius + 7));
    ctx.stroke();
  }

  function drawWorld(state) {
    const camera = state.camera;
    const vx = camera.x - VIEW.width / 2;
    const vy = camera.y - VIEW.height / 2;
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.scale(view.scale, view.scale);
    ctx.save();
    ctx.translate(-vx, -vy);
    drawCity(state, camera);
    // Cars, sorted so the player's car draws on top.
    const cars = [...state.traffic.cars].sort((a, b) => (a.kind === 'player' ? 1 : 0) - (b.kind === 'player' ? 1 : 0));
    for (const car of cars) {
      if (!car.dead) drawCar(car, state.time);
    }
    // Pedestrians and foot cops.
    for (const ped of state.traffic.peds) {
      if (!ped.dead) drawPerson(ped.x, ped.y, ped.angle, ped.color, 9);
    }
    for (const cop of state.police.footCops) {
      if (!cop.dead) drawPerson(cop.x, cop.y, cop.angle, cop.color, 10, '#7fb2ff');
    }
    // Bullets.
    ctx.fillStyle = '#ffe9a8';
    for (const b of state.combat.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Particles.
    for (const p of state.combat.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // The player on foot: a gold figure with a white ring, so he reads against any ground.
    const player = state.player;
    if (player.onFoot) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y, PLAYER_RADIUS + 4, 0, Math.PI * 2);
      ctx.stroke();
      drawPerson(player.x, player.y, player.angle, PALETTE.player, PLAYER_RADIUS, '#7a5a00');
      // Aim line, short and faint.
      ctx.strokeStyle = 'rgba(232,178,58,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(player.x + Math.cos(player.angle) * 46, player.y + Math.sin(player.angle) * 46);
      ctx.stroke();
    }
    // Damage vignette handled by the HUD; the world ends here.
    ctx.restore();
    ctx.restore();
  }

  return { drawWorld, toScreen, toWorld, text, view, resize };
}

const PLAYER_RADIUS = 13;
