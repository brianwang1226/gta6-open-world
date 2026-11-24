// The story: Jax Marlowe owes $50,000 to the fixer Mara Voss. Five jobs pay it down. Each
// mission is a list of stages; a stage is a place to reach, something to do there, or a
// condition to survive. The world asks the mission for its marker, its objective line and its
// reward, and the mission answers with events when a stage completes.
import { blockCenter } from './city.js';

// Mission definitions: name, intro, stages, reward.
const DEFS = [
  {
    name: 'Job 1 — Wheels Up',
    intro: 'Mara: "Steal the Comet GT from Rocco\u2019s Garage. Bring it to the docks. No scratches — well, fewer scratches."',
    reward: 800,
    stages: [
      { kind: 'goto', place: 'garage', label: 'Get to Rocco\u2019s Garage', radius: 90 },
      { kind: 'steal', place: 'garage', label: 'Steal the Comet GT  (E to get in)', radius: 120 },
      { kind: 'deliver', place: 'docks', label: 'Deliver the Comet GT to the Docks', radius: 110, needCar: true },
    ],
  },
  {
    name: 'Job 2 — Heat Check',
    intro: 'Mara: "The precinct is watching. Lose that heat, then come home. Forty-five seconds of clean air."',
    reward: 1200,
    stages: [
      { kind: 'survive', label: 'Lose the cops — stay alive for 45s', seconds: 45 },
      { kind: 'goto', place: 'safehouse', label: 'Get back to the Safehouse', radius: 90 },
    ],
  },
  {
    name: 'Job 3 — Dockside',
    intro: 'Mara: "A crate at the docks has my name on it. On foot, quiet. Bring it to the buyer at Bay Market."',
    reward: 1500,
    stages: [
      { kind: 'goto', place: 'docks', label: 'Reach the Docks on foot', radius: 90, onFoot: true },
      { kind: 'pickup', place: 'docks', label: 'Grab the package  (E to take it)', radius: 80 },
      { kind: 'deliver', place: 'market', label: 'Deliver the package to Bay Market', radius: 110 },
    ],
  },
  {
    name: 'Job 4 — Payback',
    intro: 'Mara: "The Vipers torched my last courier. Three of their cars are out there. Wreck them all."',
    reward: 2500,
    stages: [
      { kind: 'wreck', label: 'Wreck the Viper gang cars  (0 / 3)', count: 3 },
    ],
  },
  {
    name: 'Job 5 — The Big One',
    intro: 'Mara: "Solara Trust Bank. In, out, rich. The whole precinct will be on you — get to the Safehouse."',
    reward: 8000,
    stages: [
      { kind: 'goto', place: 'bank', label: 'Reach Solara Trust Bank', radius: 100 },
      { kind: 'grab', place: 'bank', label: 'Grab the cash  (hold E — 3s)', radius: 90, seconds: 3 },
      { kind: 'escape', place: 'safehouse', label: 'Escape to the Safehouse — lose the heat on the way', radius: 100 },
    ],
  },
];

export function createMissions(city) {
  const missions = {
    index: 0,
    stage: 0,
    timer: 0,
    holdTimer: 0,
    wrecked: 0,
    banner: null,
    bannerTimer: 0,
    done: false,
    hasPackage: false,
    started: false,
  };
  return missions;
}

export function currentDef(missions) {
  return missions.index < DEFS.length ? DEFS[missions.index] : null;
}

export function introFor(index) {
  return index < DEFS.length ? DEFS[index].intro : '';
}

export function currentStage(missions) {
  const def = currentDef(missions);
  return def ? def.stages[missions.stage] : null;
}

export function stageTarget(missions, city) {
  const stage = currentStage(missions);
  if (!stage || !stage.place) return null;
  const place = city.places[stage.place];
  return place ? { x: place.x, y: place.y, name: place.name } : null;
}

export function objectiveText(missions) {
  const def = currentDef(missions);
  if (!def) return 'Debt paid. Solara Bay is yours — free roam.';
  const stage = currentStage(missions);
  if (!stage) return def.name;
  if (stage.kind === 'wreck') return `Wreck the Viper gang cars  (${missions.wrecked} / ${stage.count})`;
  if (stage.kind === 'survive') return `Lose the cops — stay alive  (${Math.ceil(stage.seconds - missions.timer)}s)`;
  if (stage.kind === 'grab') return `Grab the cash  (hold E — ${Math.max(0, stage.seconds - missions.holdTimer).toFixed(1)}s)`;
  return stage.label;
}

function startMission(missions, world) {
  const def = currentDef(missions);
  if (!def) return;
  missions.started = true;
  missions.stage = 0;
  missions.timer = 0;
  missions.holdTimer = 0;
  missions.wrecked = 0;
  missions.banner = `${def.name} — $${def.reward.toLocaleString()}`;
  missions.bannerTimer = 4;
  world.bannerText = def.intro;
  world.bannerTimer = 5;
  if (missions.index === 1) {
    // Job 2 starts hot.
    world.wanted = Math.max(world.wanted, 2);
  }
  if (missions.index === 3) {
    world.spawnGangCars();
  }
  if (missions.index === 4) {
    world.wanted = Math.max(world.wanted, 1);
  }
}

function completeMission(missions, world) {
  const def = currentDef(missions);
  world.cash += def.reward;
  world.debt = Math.max(0, world.debt - def.reward);
  world.events |= 4; // EVENT_MISSION
  missions.banner = `${def.name} complete — +$${def.reward.toLocaleString()}`;
  missions.bannerTimer = 4;
  missions.index += 1;
  missions.stage = 0;
  missions.timer = 0;
  missions.holdTimer = 0;
  missions.wrecked = 0;
  missions.hasPackage = false;
  if (missions.index >= DEFS.length) {
    missions.done = true;
    world.gameOver = 'complete';
    return;
  }
  startMission(missions, world);
}

export function stepMissions(missions, world, dt, interactHeld) {
  if (missions.done) return;
  if (!missions.started) {
    startMission(missions, world);
    return;
  }
  if (missions.bannerTimer > 0) missions.bannerTimer -= dt;
  const def = currentDef(missions);
  if (!def) return;
  const stage = currentStage(missions);
  if (!stage) return;
  const player = world.player;
  const target = stageTarget(missions, world.city);
  const dist = target ? Math.hypot(player.x - target.x, player.y - target.y) : Infinity;

  switch (stage.kind) {
    case 'goto': {
      if (dist < stage.radius && (!stage.onFoot || player.onFoot)) {
        missions.stage += 1;
        missions.timer = 0;
      }
      break;
    }
    case 'steal': {
      // The Comet GT is parked at the garage; getting into it completes the stage.
      if (!player.onFoot && player.car && player.car.kind === 'player' && player.car.isComet) {
        missions.stage += 1;
      }
      break;
    }
    case 'deliver': {
      if (dist < stage.radius && (!stage.needCar || !player.onFoot)) {
        missions.stage += 1;
      }
      break;
    }
    case 'pickup': {
      if (dist < stage.radius && interactHeld) {
        missions.hasPackage = true;
        missions.stage += 1;
        world.events |= 2; // EVENT_PICKUP
      }
      break;
    }
    case 'grab': {
      if (dist < stage.radius && interactHeld) {
        missions.holdTimer += dt;
        if (missions.holdTimer >= stage.seconds) {
          missions.stage += 1;
          world.events |= 2;
          world.wanted = Math.max(world.wanted, 3);
        }
      } else {
        missions.holdTimer = Math.max(0, missions.holdTimer - dt * 2);
      }
      break;
    }
    case 'survive': {
      missions.timer += dt;
      if (missions.timer >= stage.seconds) {
        missions.stage += 1;
        world.clearWanted();
      }
      break;
    }
    case 'wreck': {
      if (missions.wrecked >= stage.count) {
        missions.stage += 1;
      }
      break;
    }
    case 'escape': {
      if (dist < stage.radius && world.wanted === 0) {
        missions.stage += 1;
      }
      break;
    }
    default:
      break;
  }
  if (missions.stage >= def.stages.length) {
    completeMission(missions, world);
  }
}
