// The HUD, the minimap and the menus: everything drawn over the world. Cash and health,
// wanted stars, the mission objective, the speed, the context prompt, the banners, and the
// title / pause / wasted / busted / complete screens.
import { CITY_H, CITY_W, FONT, PALETTE, VIEW, WANTED } from './config.js';
import { currentDef, currentStage, objectiveText, stageTarget } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const MM = { x: VIEW.width - 216, y: VIEW.height - 168, w: 196, h: 148 };

function money(n) {
  return `$${Math.floor(n).toLocaleString()}`;
}

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight || ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }
  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
  }

  function drawStars(state) {
    const n = state.wanted;
    const x0 = VIEW.width - 30;
    const y0 = 34;
    for (let i = 0; i < WANTED.max; i += 1) {
      const x = x0 - i * 30;
      ctx.font = '26px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillStyle = i < n ? PALETTE.gold : 'rgba(255,255,255,0.22)';
      ctx.fillText('\u2605', x, y0);
    }
    if (n > 0) text('WANTED', x0 - (WANTED.max - 1) * 30 - 58, y0 - 2, 12, PALETTE.red, 'left', '700');
  }

  function drawMinimap(state) {
    const { x, y, w, h } = MM;
    panel(x, y, w, h);
    const sx = w / CITY_W;
    const sy = h / CITY_H;
    const s = Math.min(sx, sy);
    const ox = x + (w - CITY_W * s) / 2;
    const oy = y + (h - CITY_H * s) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    // Roads as light lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 8; i += 1) {
      const rx = ox + (i * (260 + 72)) * s;
      ctx.beginPath(); ctx.moveTo(rx, oy); ctx.lineTo(rx, oy + CITY_H * s); ctx.stroke();
    }
    for (let j = 0; j <= 7; j += 1) {
      const ry = oy + (j * (260 + 72)) * s;
      ctx.beginPath(); ctx.moveTo(ox, ry); ctx.lineTo(ox + CITY_W * s, ry); ctx.stroke();
    }
    // Mission marker.
    const target = stageTarget(state.missions, state.city);
    if (target) {
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(ox + target.x * s, oy + target.y * s, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police.
    ctx.fillStyle = '#5a9bff';
    for (const car of state.police.copCars) {
      ctx.beginPath();
      ctx.arc(ox + car.x * s, oy + car.y * s, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ox + state.player.x * s, oy + state.player.y * s, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    text('SOLARA BAY', x + 8, y + 16, 11, PALETTE.muted, 'left', '700');
  }

  function drawHud(state, prompt, view) {
    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.scale(view.scale, view.scale);
    drawHudInner(state, prompt);
    ctx.restore();
  }

  function drawHudInner(state, prompt) {
    // Cash + debt, top left.
    panel(16, 14, 250, 64);
    text(money(state.cash), 30, 40, 24, PALETTE.text, 'left', '700');
    text(`Debt ${money(state.debt)}`, 30, 62, 13, state.debt === 0 ? PALETTE.green : PALETTE.muted, 'left', '600');
    // Health bar.
    const hp = Math.max(0, state.player.health);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(30, 86, 150, 10);
    ctx.fillStyle = hp > 50 ? PALETTE.green : hp > 25 ? PALETTE.gold : PALETTE.red;
    ctx.fillRect(30, 86, 150 * (hp / 100), 10);
    text('HEALTH', 186, 95, 11, PALETTE.muted, 'left', '700');
    drawStars(state);
    // Mission objective, top centre.
    const obj = objectiveText(state.missions);
    const def = currentDef(state.missions);
    ctx.font = '600 15px ' + FONT;
    const ow = ctx.measureText(obj).width + 28;
    panel((VIEW.width - ow) / 2, 14, ow, 34);
    text(obj, VIEW.width / 2, 36, 15, PALETTE.text, 'center', '600');
    if (def) text(def.name, VIEW.width / 2, 62, 12, PALETTE.gold, 'center', '700');
    // Speed + car health, bottom left.
    if (!state.player.onFoot && state.player.car) {
      const mph = Math.round(state.player.car.speed * 0.14);
      panel(16, VIEW.height - 78, 190, 62);
      text(`${mph} mph`, 30, VIEW.height - 44, 26, PALETTE.text, 'left', '700');
      const chp = Math.max(0, state.player.car.hp);
      text('CAR', 138, VIEW.height - 44, 11, PALETTE.muted, 'left', '700');
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(30, VIEW.height - 32, 160, 8);
      ctx.fillStyle = chp > 60 ? PALETTE.green : PALETTE.red;
      ctx.fillRect(30, VIEW.height - 32, 160 * (chp / 150), 8);
    }
    // Context prompt.
    if (prompt) {
      ctx.font = '600 16px ' + FONT;
      const pw = ctx.measureText(prompt).width + 30;
      panel((VIEW.width - pw) / 2, VIEW.height - 118, pw, 36);
      text(prompt, VIEW.width / 2, VIEW.height - 94, 16, PALETTE.text, 'center', '600');
    }
    drawMinimap(state);
    // Banner.
    if (state.missions.bannerTimer > 0 && state.missions.banner) {
      ctx.font = '700 26px ' + FONT;
      const bw = ctx.measureText(state.missions.banner).width + 44;
      panel((VIEW.width - bw) / 2, 110, bw, 46);
      text(state.missions.banner, VIEW.width / 2, 140, 26, PALETTE.gold, 'center', '700');
    }
    if (state.bannerTimer > 0 && state.bannerText) {
      ctx.font = '15px ' + FONT;
      const bw = Math.min(VIEW.width - 200, ctx.measureText(state.bannerText).width + 40);
      panel((VIEW.width - bw) / 2, 164, bw, 40);
      // Wrap the intro into the panel crudely: two lines if long.
      if (state.bannerText.length > 90) {
        const mid = state.bannerText.lastIndexOf(' ', 90);
        text(state.bannerText.slice(0, mid), VIEW.width / 2, 182, 15, PALETTE.text, 'center');
        text(state.bannerText.slice(mid + 1), VIEW.width / 2, 200, 15, PALETTE.text, 'center');
      } else {
        text(state.bannerText, VIEW.width / 2, 188, 15, PALETTE.text, 'center');
      }
    }
    // Low-health vignette.
    if (hp < 30) {
      ctx.fillStyle = `rgba(229,83,75,${0.14 + 0.1 * Math.sin(state.time * 5)})`;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
  }

  function drawMenu(state, screen, best, save, view) {
    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.scale(view.scale, view.scale);
    drawMenuInner(state, screen, best, save);
    ctx.restore();
  }

  function drawMenuInner(state, screen, best, save) {
    ctx.fillStyle = 'rgba(8, 12, 20, 0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    if (screen === SCREEN_TITLE) {
      text('SOLARA BAY', VIEW.width / 2, 170, 72, PALETTE.gold, 'center', '800');
      text('A sun-soaked open-world crime story', VIEW.width / 2, 210, 20, PALETTE.text, 'center');
      text('Jax Marlowe owes $50,000 to the fixer Mara Voss. Five jobs pay it down.', VIEW.width / 2, 244, 16, PALETTE.muted, 'center');
      if (save) {
        text(`Continue — ${money(save.cash)} in hand, debt ${money(save.debt)}, job ${save.mission + 1} of 5`, VIEW.width / 2, 300, 16, PALETTE.green, 'center', '600');
      }
      text('WASD drive / walk    E steal car & interact    Mouse aim, click or Space to shoot', VIEW.width / 2, 348, 16, PALETTE.text, 'center');
      text('Shift run    P pause    M mute', VIEW.width / 2, 376, 16, PALETTE.text, 'center');
      text('Press Enter or click to start', VIEW.width / 2, 440, 20, PALETTE.gold, 'center', '700');
      if (best > 0) text(`Best cash ${money(best)}`, VIEW.width / 2, 480, 14, PALETTE.muted, 'center');
    } else if (screen === SCREEN_PAUSED) {
      text('PAUSED', VIEW.width / 2, 260, 56, PALETTE.text, 'center', '800');
      text('Press P or Enter to keep playing', VIEW.width / 2, 320, 18, PALETTE.muted, 'center');
      text(`${money(state.cash)}   •   Debt ${money(state.debt)}   •   Job ${state.missions.index + 1} of 5`, VIEW.width / 2, 360, 16, PALETTE.text, 'center');
    } else if (screen === SCREEN_OVER) {
      const over = state.gameOver;
      if (over === 'wasted') {
        text('WASTED', VIEW.width / 2, 240, 72, PALETTE.red, 'center', '800');
        text('Jax went down in the streets of Solara Bay.', VIEW.width / 2, 300, 18, PALETTE.text, 'center');
      } else if (over === 'busted') {
        text('BUSTED', VIEW.width / 2, 240, 72, '#5a9bff', 'center', '800');
        text('The SBPD finally put the cuffs on Jax.', VIEW.width / 2, 300, 18, PALETTE.text, 'center');
      } else {
        text('DEBT PAID', VIEW.width / 2, 240, 72, PALETTE.gold, 'center', '800');
        text('Five jobs. Fifty thousand dollars. Solara Bay is yours now.', VIEW.width / 2, 300, 18, PALETTE.text, 'center');
      }
      text(`${money(state.cash)} earned   •   Debt ${money(state.debt)}`, VIEW.width / 2, 350, 16, PALETTE.text, 'center');
      text('Press Enter to play again', VIEW.width / 2, 420, 20, PALETTE.gold, 'center', '700');
    }
  }

  return { drawHud, drawMenu, text, panel };
}
