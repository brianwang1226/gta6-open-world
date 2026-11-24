// Solara Bay — a gta6-01 entry (Node 22, standard library only). The game is this
// directory's game/ folder: plain static files a desktop browser loads offline
// (game/index.html and its ES modules, no library and no network request). It is a
// top-down 2D open-world crime game — Jax Marlowe, $50,000 in debt to the fixer Mara
// Voss, five story jobs to pay it down — with a city to explore on foot and by car,
// traffic and pedestrians, cars to steal, a wanted level with police who respond,
// combat, a HUD with a minimap, a start screen and a localStorage save.
//
// This program hands the game in: it copies game/ and screenshots/ from beside this
// file to /output and writes /output/dossier.json, the summary the judge reads, with
// the vendored make.fun library. The screenshots are real renders of the game,
// staged by game/src/shots.js (?shot=cover|chase|mission|combat) and taken with
// Playwright; the first by name is the cover.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The entry is not shippable without its game and its screenshots: refuse loudly
// instead of handing in an empty folder.
const gameDir = join(here, 'game');
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing: the game is not in game/');
}
const shotsDir = join(here, 'screenshots');
if (!existsSync(shotsDir)) {
  throw new Error('screenshots/ is missing: take the 3 or 4 screenshots first');
}
const shots = readdirSync(shotsDir).filter((name) => /\.(png|jpe?g)$/i.test(name));
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`screenshots/ holds ${shots.length} images: gta6-01 wants 3 or 4`);
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// A one-line receipt, so a run that silently wrote nothing is obvious.
const gameEntries = readdirSync(join(out, 'game'), { recursive: true }).length;
console.log(`solara-bay: game/ (${gameEntries} entries) + ${shots.length} screenshots -> ${out}/dossier.json`);
