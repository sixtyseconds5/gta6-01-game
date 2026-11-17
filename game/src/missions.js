// Missions and the light story of Vice Rush. Three jobs, each with an objective,
// a map marker, a timer where it matters, a reward and a fail state. The mission
// module owns only the job logic; entities.js owns the simulation it reads.
import { REWARDS } from './config.js';
import { addCrime } from './entities.js';

export const MISSION_NAMES = ['Hot Wheels', 'Package Run', 'Lose the Heat'];

const MISSION_INTROS = [
  'Rico needs wheels. Steal any car, then bring it to the drop-off in Ocean Drive.',
  'Three packages are stashed around the city. Grab them all, then deliver the bag.',
  'The job went loud — the whole VCPD is on you. Lose the heat, then reach the hideout.',
];

export function createMissions() {
  return {
    index: 0, // which mission is active (0..2); 3 means the story is done
    stage: 'intro', // intro | active | done | failed
    timer: 0,
    timeLeft: 0,
    packages: [], // {x, y, taken} for mission 2
    collected: 0,
    marker: null, // {x, y, label}
    hideout: null,
    banner: '',
    bannerTimer: 0,
    completed: [],
    failedReason: '',
  };
}

// Fixed, hand-placed spots so the missions read clearly on the map.
const DROP_OFF = { x: 3250, y: 1650 };
const HIDEOUT = { x: 1650, y: 1650 };
const PACKAGE_SPOTS = [
  { x: 450, y: 360 },
  { x: 2550, y: 660 },
  { x: 750, y: 2460 },
];

export function startMission(missions, state, city) {
  const i = missions.index;
  missions.stage = 'active';
  missions.failedReason = '';
  missions.banner = `MISSION ${i + 1}: ${MISSION_NAMES[i]}`;
  missions.bannerTimer = 3.5;
  if (i === 0) {
    missions.timeLeft = 240;
    missions.marker = { ...DROP_OFF, label: 'Drop-off' };
  } else if (i === 1) {
    missions.timeLeft = 300;
    missions.packages = PACKAGE_SPOTS.map((s) => ({ ...s, taken: false }));
    missions.collected = 0;
    missions.marker = null;
  } else if (i === 2) {
    missions.timeLeft = 240;
    addCrime(state, 3);
    missions.marker = { ...HIDEOUT, label: 'Hideout' };
    state.message = 'Wanted level 3! Lose the cops, then reach the hideout.';
    state.messageTimer = 4;
  }
  void city;
}

export function missionObjective(missions, state) {
  if (missions.index >= 3) return 'Story complete — free roam. Cause chaos, Vice City is yours.';
  if (missions.stage === 'intro') return `Next job: ${MISSION_NAMES[missions.index]} — press Enter to start it.`;
  if (missions.stage === 'failed') return `Mission failed: ${missions.failedReason} — press Enter to retry.`;
  if (missions.index === 0) {
    return missions.marker
      ? 'Drive the stolen car to the drop-off (yellow marker).'
      : 'Steal a car — walk up to one and press E.';
  }
  if (missions.index === 1) {
    if (missions.collected < 3) return `Collect the packages: ${missions.collected}/3 (green markers).`;
    return 'Deliver the bag to the drop-off (yellow marker).';
  }
  if (missions.index === 2) {
    if (state && state.wanted > 0) {
      return 'Lose the cops first — wanted level must hit 0.';
    }
    return 'Reach the hideout (yellow marker).';
  }
  return '';
}

export function stepMissions(missions, state, dt, input) {
  if (missions.bannerTimer > 0) missions.bannerTimer -= dt;
  if (missions.index >= 3) return;

  if (missions.stage === 'intro' || missions.stage === 'failed') {
    if (input.confirm) {
      missions.stage = 'intro';
      startMission(missions, state);
    }
    return;
  }

  missions.timeLeft -= dt;
  if (missions.timeLeft <= 0) {
    missions.stage = 'failed';
    missions.failedReason = 'Out of time.';
    return;
  }

  const p = state.player;
  const near = (pt, dist) => Math.hypot(p.x - pt.x, p.y - pt.y) < dist;

  if (missions.index === 0) {
    if (!p.inCar) return;
    if (missions.marker && near(missions.marker, 70)) completeMission(missions, state);
  } else if (missions.index === 1) {
    for (const pkg of missions.packages) {
      if (!pkg.taken && near(pkg, 46)) {
        pkg.taken = true;
        missions.collected += 1;
        state.player.cash += 50;
        state.message = `Package ${missions.collected}/3 — +$50`;
        state.messageTimer = 2;
        if (missions.collected === 3) missions.marker = { ...DROP_OFF, label: 'Drop-off' };
      }
    }
    if (missions.collected === 3 && missions.marker && near(missions.marker, 70)) {
      completeMission(missions, state);
    }
  } else if (missions.index === 2) {
    if (state.wanted === 0 && missions.marker && near(missions.marker, 70)) {
      completeMission(missions, state);
    }
  }
}

function completeMission(missions, state) {
  const i = missions.index;
  const reward = REWARDS[`m${i + 1}`];
  state.player.cash += reward;
  missions.completed.push(MISSION_NAMES[i]);
  missions.banner = `MISSION PASSED — ${MISSION_NAMES[i]}  +$${reward}`;
  missions.bannerTimer = 4;
  missions.index += 1;
  missions.stage = missions.index >= 3 ? 'done' : 'intro';
  missions.marker = null;
  missions.packages = [];
  state.message = missions.index >= 3
    ? 'Story complete! Vice City is yours — free roam.'
    : `Next job unlocked: ${MISSION_NAMES[missions.index]}`;
  state.messageTimer = 4;
}

export function missionMarkers(missions) {
  const out = [];
  if (missions.stage !== 'active') return out;
  if (missions.index === 1) {
    for (const pkg of missions.packages) if (!pkg.taken) out.push({ ...pkg, kind: 'package' });
  }
  if (missions.marker) out.push({ ...missions.marker, kind: 'target' });
  return out;
}

export { DROP_OFF, HIDEOUT, MISSION_INTROS, PACKAGE_SPOTS };
