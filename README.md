[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/brianwang1226/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/brianwang1226/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solara Bay

A top-down 2D open-world crime game, in the spirit of GTA 6 and entirely original:
Jax Marlowe owes $50,000 to the fixer Mara Voss, and five story jobs pay it down.
Explore a sun-soaked city on foot and by car, steal cars, outrun the police at four
wanted stars, shoot it out with the Viper gang, and save your progress. No network
requests, no libraries — plain static files a desktop browser loads offline.

    node serve.ts        # then open http://localhost:8080

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to
`/output` and writes `/output/dossier.json` with `buildDossier` from
`vendor/makefun-game.ts`:

    mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

## Play

- **WASD** drive / walk, **Shift** run, **E** steal a car & interact, **mouse** aim,
  **click** or **Space** shoot, **P** pause, **M** mute.
- **Jobs**: 1 Wheels Up — steal the Comet GT and deliver it to the docks; 2 Heat
  Check — survive 45 seconds at two stars; 3 Dockside — grab a package on foot;
  4 Payback — wreck three Viper gang cars; 5 The Big One — rob the bank and escape
  at three stars. Each pays down the $50,000 debt; paying it off wins the game.
- **Wanted**: stealing a car, hitting a pedestrian, shooting, and killing a cop
  raise the stars; cops chase and ram, foot cops try to bust you, and the heat
  cools off if you stay out of sight.
- **Save**: progress (cash, debt, job) is kept in localStorage; the best cash
  total is kept too.

## The city

An 8×7 block grid with roads, sidewalks, parks, a beach, and eight named places
(Safehouse, Rocco's Garage, the Docks, Bay Market, the Bank, Central Precinct,
the Marina, the Hospital). Traffic follows the road grid, pedestrians stroll the
sidewalks and flee gunfire, and the whole city is seeded (`?seed=N`) so a run is
reproducible. The screenshots are staged by `game/src/shots.js`
(`?shot=cover|chase|mission|combat`) and taken with Playwright.

## Source

Split into files with one clear job each under `game/src/`: `main.js` (boot and
loop), `config.js` (numbers), `city.js` (the map), `player.js` (on foot and
driving), `traffic.js` (cars and pedestrians), `police.js` (wanted and cops),
`missions.js` (the five jobs), `combat.js` (shooting and explosions), `world.js`
(the rules that join the systems), `render.js` (canvas drawing), `hud.js` (HUD,
minimap and menus), `audio.js` (WebAudio sounds), `input.js` (keyboard and
mouse), `random.js` (seeded random), `shots.js` (staged screenshots).
