// Vice Rush 3D — six story jobs from Rico and the crew. Each mission has an
// intro dialogue, staged objectives with a map marker, an optional timer,
// a cash reward, and fail + retry. Finishing all six opens free roam.
import { PLACES, REWARDS, BLOCK, HALF, BEACH_X } from './config.js';
import { range } from './random.js';

export const MISSION_DEFS = [
  {
    id: 'm1', title: 'Hot Wheels', reward: REWARDS.m1,
    intro: { speaker: 'Rico', text: 'Vic! You\u2019re out. Listen — I need a Comet GT, Ocean Drive, no questions. Steal one and bring it to the drop-off. Don\u2019t scratch it.' },
    objective: 'Steal any car, then drive it to the Ocean Drive drop-off.',
  },
  {
    id: 'm2', title: 'Package Run', reward: REWARDS.m2,
    intro: { speaker: 'Rico', text: 'Three packages, three corners of the city. Grab them all, bring the bag back to me at the hideout. The boys are watching.' },
    objective: 'Collect 3 packages around the city, then return to the hideout.',
  },
  {
    id: 'm3', title: 'Lose the Heat', reward: REWARDS.m3,
    intro: { speaker: 'Rico', text: 'The VCPD is all over you, Vic. Shake those three stars, then get to the hideout. Lay low, drive smart.' },
    objective: 'Lose your 3-star wanted level, then reach the hideout.',
  },
  {
    id: 'm4', title: 'Taxi Nights', reward: REWARDS.m4, timeLimit: 150,
    intro: { speaker: 'Marisol', text: 'My cabbie quit and the night crowd is out. Take the Vice Cab, pick up three fares before the clock runs out. Tips are yours.' },
    objective: 'Pick up 3 fares in the Vice Cab before time runs out.',
  },
  {
    id: 'm5', title: 'The Getaway', reward: REWARDS.m5, timeLimit: 120,
    intro: { speaker: 'Rico', text: 'The Docks job went loud. The chopper is already up. Get out of the Docks and reach the hideout — and don\u2019t stop for anything.' },
    objective: 'Escape the Docks with the helicopter on you. Reach the hideout in time.',
  },
  {
    id: 'm6', title: 'King of Vice City', reward: REWARDS.m6,
    intro: { speaker: 'Rico', text: 'The Red Vipers own the beachfront, and they want you gone. Clear them out, Vic. Then the whole city is yours.' },
    objective: 'Clear the rival crew at the beachfront, then reach the hideout.',
  },
];

export class MissionManager {
  constructor(game) {
    this.game = game;
    this.index = 0; // current mission index (0..5); 6 = all done, free roam
    this.active = null; // { def, stage, stageTotal, timer, data }
    this.done = false;
  }

  get currentDef() { return MISSION_DEFS[this.index] || null; }
  get allDone() { return this.index >= MISSION_DEFS.length; }

  start() {
    const def = this.currentDef;
    if (!def) return;
    const g = this.game;
    const data = {};
    let stage = 0, stageTotal = 1;
    switch (def.id) {
      case 'm1': stageTotal = 2; break; // 1: steal car, 2: deliver
      case 'm2': {
        stageTotal = 4; // 3 packages + deliver
        data.packages = this._packageSpots().map((p) => ({ ...p, taken: false }));
        for (const p of data.packages) g.combat.spawnPickup('cash', p.x, p.z, 1);
        break;
      }
      case 'm3': stageTotal = 2; g.addWanted(3, true); break;
      case 'm4': stageTotal = 3; data.fares = this._fareSpots(); data.fareIndex = 0; break;
      case 'm5': stageTotal = 1; g.addWanted(4, true); g.teleportPlayer(PLACES.docks.x, PLACES.docks.z); break;
      case 'm6': {
        stageTotal = 2;
        data.enemies = [];
        const spots = this._beachSpots();
        for (const s of spots) data.enemies.push(g.combat.spawnEnemy(s.x, s.z, 100));
        break;
      }
    }
    this.active = {
      def, stage, stageTotal,
      timer: def.timeLimit || null,
      data,
    };
    g.hud.showDialogue(def.intro.speaker, def.intro.text);
    g.hud.setMission(def.title, def.objective, stage, stageTotal);
    g.hud.showToast(`${def.title} — ${def.objective}`);
    this.updateMarker();
  }

  _packageSpots() {
    return [
      { x: -HALF + BLOCK, z: -HALF + BLOCK },
      { x: HALF - 2 * BLOCK, z: HALF - BLOCK },
      { x: -HALF + 3 * BLOCK, z: HALF - 2 * BLOCK },
    ];
  }
  _fareSpots() {
    return [
      { x: -HALF + 2 * BLOCK, z: -HALF + 4 * BLOCK },
      { x: HALF - 3 * BLOCK, z: -HALF + 2 * BLOCK },
      { x: -HALF + 4 * BLOCK, z: HALF - 3 * BLOCK },
    ];
  }
  _beachSpots() {
    return [
      { x: BEACH_X + 8, z: 30 }, { x: BEACH_X + 14, z: 52 }, { x: BEACH_X + 6, z: 76 },
      { x: BEACH_X + 18, z: 44 }, { x: BEACH_X + 10, z: 92 }, { x: BEACH_X + 22, z: 66 },
    ];
  }

  // Where should the marker point right now? Returns {x, z, label} or null.
  markerTarget() {
    if (!this.active) return null;
    const { def, stage, data } = this.active;
    const g = this.game;
    switch (def.id) {
      case 'm1': return stage === 0 ? null : { ...PLACES.dropoff };
      case 'm2': {
        if (stage < 3) {
          const p = data.packages.find((pk) => !pk.taken);
          return p ? { x: p.x, z: p.z, label: 'Package' } : null;
        }
        return { ...PLACES.hideout };
      }
      case 'm3': return stage === 0 ? null : { ...PLACES.hideout };
      case 'm4': {
        if (stage < 3) {
          const f = data.fares[data.fareIndex];
          return { x: f.x, z: f.z, label: 'Fare pickup' };
        }
        return { ...PLACES.hideout };
      }
      case 'm5': return { ...PLACES.hideout };
      case 'm6': {
        if (stage === 0) return { x: PLACES.beachfront.x, z: PLACES.beachfront.z, label: 'Beachfront' };
        return { ...PLACES.hideout };
      }
    }
    return null;
  }

  updateMarker() {
    const g = this.game;
    for (const k of Object.keys(g.world.placeMeshes)) g.world.placeMeshes[k].visible = false;
    const t = this.markerTarget();
    if (!t) return;
    // Show the beacon at the nearest named place, or a floating marker.
    let best = null, bestD = 1e9;
    for (const [k, p] of Object.entries(PLACES)) {
      const d = (p.x - t.x) ** 2 + (p.z - t.z) ** 2;
      if (d < bestD) { bestD = d; best = k; }
    }
    if (best && bestD < 40 * 40) g.world.placeMeshes[best].visible = true;
    g.hud.setMarker(t.x, t.z, t.label || '');
  }

  // Called every frame while a mission is active.
  update(dt) {
    if (!this.active) return;
    const g = this.game;
    const a = this.active;
    if (a.timer !== null) {
      a.timer -= dt;
      if (a.timer <= 0) { this.fail('Time ran out.'); return; }
    }
    const px = g.player.x, pz = g.player.z;
    const near = (x, z, r = 5) => Math.hypot(px - x, pz - z) < r;
    switch (a.def.id) {
      case 'm1':
        if (a.stage === 0 && g.player.car) { a.stage = 1; this._stage('Car secured. Now deliver it to Ocean Drive.'); }
        else if (a.stage === 1 && g.player.car && near(PLACES.dropoff.x, PLACES.dropoff.z, 7)) this.complete();
        break;
      case 'm2': {
        if (a.stage < 3) {
          const p = a.data.packages.find((pk) => !pk.taken);
          if (p && near(p.x, p.z, 4)) { p.taken = true; a.stage++; this._stage(`Package ${a.stage}/3 collected.`); }
        } else if (near(PLACES.hideout.x, PLACES.hideout.z, 6)) this.complete();
        break;
      }
      case 'm3':
        if (a.stage === 0 && g.wanted === 0) { a.stage = 1; this._stage('Heat is off. Now get to the hideout.'); }
        else if (a.stage === 1 && near(PLACES.hideout.x, PLACES.hideout.z, 6)) this.complete();
        break;
      case 'm4': {
        if (a.stage < 3) {
          const f = a.data.fares[a.data.fareIndex];
          const inTaxi = g.player.car && g.player.car.typeName === 'taxi';
          if (f && near(f.x, f.z, 5) && inTaxi) {
            a.data.fareIndex++; a.stage++;
            g.addCash(150);
            this._stage(`Fare ${a.stage}/3 picked up. +$150 tip.`);
          }
        } else if (near(PLACES.hideout.x, PLACES.hideout.z, 6)) this.complete();
        break;
      }
      case 'm5':
        if (near(PLACES.hideout.x, PLACES.hideout.z, 6)) this.complete();
        break;
      case 'm6': {
        if (a.stage === 0) {
          const alive = a.data.enemies.filter((e) => !e.dead).length;
          if (alive === 0) { a.stage = 1; this._stage('Beachfront is yours. Now get to the hideout.'); }
        } else if (near(PLACES.hideout.x, PLACES.hideout.z, 6)) this.complete();
        break;
      }
    }
    this.updateMarker();
  }

  _stage(text) {
    const g = this.game;
    const a = this.active;
    g.hud.setMission(a.def.title, a.def.objective, a.stage, a.stageTotal);
    g.hud.showToast(text);
    g.audio.pickup();
    this.updateMarker();
  }

  complete() {
    const g = this.game;
    const a = this.active;
    g.addCash(a.def.reward);
    g.addRespect(a.def.id === 'm6' ? 50 : 10);
    g.audio.missionPass();
    g.hud.showDialogue('Rico', `Job done, Vic. $${a.def.reward} is yours. ${this.index + 1 < MISSION_DEFS.length ? 'Next one when you\u2019re ready — press J to start it.' : 'The city is yours now. Free roam, king.'}`);
    g.hud.showToast(`MISSION PASSED — ${a.def.title}  +$${a.def.reward}`);
    this.index++;
    this.active = null;
    g.saveProgress();
    if (this.allDone) {
      g.hud.setMission('Free Roam', 'Vice City is yours. Explore, earn, cause trouble.', 0, 0);
      g.hud.showToast('ALL MISSIONS COMPLETE — KING OF VICE CITY');
    } else {
      g.hud.setMission('Next job ready', 'Press J to start the next job from Rico.', 0, 0);
    }
    for (const k of Object.keys(g.world.placeMeshes)) g.world.placeMeshes[k].visible = false;
    g.hud.setMarker(null);
  }

  fail(reason) {
    const g = this.game;
    const a = this.active;
    g.audio.missionFail();
    g.hud.showDialogue('Rico', `That went sideways, Vic. ${reason} We can run it again — press J to retry.`);
    g.hud.showToast(`MISSION FAILED — ${a.def.title}: ${reason}`);
    if (a.def.id === 'm6') g.combat.clearEnemies();
    if (a.def.id === 'm2') { for (const p of g.combat.pickups) { /* packages stay; retry re-spawns */ } }
    this.active = null;
    g.hud.setMission('Job failed', 'Press J to retry the job.', 0, 0);
    for (const k of Object.keys(g.world.placeMeshes)) g.world.placeMeshes[k].visible = false;
    g.hud.setMarker(null);
  }

  // M key: start next mission, or retry the failed one.
  requestStart() {
    if (this.active) return;
    if (this.allDone) return;
    this.start();
  }
}
