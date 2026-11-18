// Vice Rush 3D — deterministic screenshot staging. ?shot=chase|drive|foot|
// mission arranges the scene (player, cars, cops, helicopter, mission,
// dialogue) so the four screenshots each show a different slice of the game.
// The recorder sees real renders of the game, never composites.
import { PLACES, BLOCK, HALF, BEACH_X } from './config.js';
import { Car } from './vehicles.js';

// Dialogue + toast shown for each shot. refreshShotHud re-shows them right
// before the screenshot, because the auto-hide timers run on real time while
// a software-rendered frame can take seconds.
const SHOT_HUD = {
  chase: {
    speaker: 'Rico',
    text: 'The chopper is up and the whole VCPD is on you, Vic. Lose them and get to the hideout — don\u2019t stop for anything.',
    toast: 'WANTED — 4 STARS',
  },
  drive: {
    speaker: 'Rico',
    text: 'Nice wheels, Vic. Now bring it to the Ocean Drive drop-off — and try not to scratch it.',
    toast: 'HOT WHEELS — DELIVER THE CAR',
  },
  foot: {
    speaker: 'Rico',
    text: 'The Red Vipers own the beachfront, Vic. Clear them out — the whole city is watching.',
    toast: 'KING OF VICE CITY — CLEAR THE CREW',
  },
  mission: {
    speaker: 'Rico',
    text: 'Three packages, three corners of the city. Grab them all, bring the bag back to me.',
    toast: 'PACKAGE RUN — 3 PACKAGES',
  },
};

export function refreshShotHud(game, name) {
  const h = SHOT_HUD[name];
  if (!h) return;
  game.hud.showDialogue(h.speaker, h.text);
  game.hud.showToast(h.toast);
}

export function stageShot(game, name) {
  const p = game.player;
  const hud = game.hud;

  if (name === 'chase') {
    // COVER: sunset police chase — player in a sports car, 4 stars, helicopter
    // overhead, cruisers closing in, mission panel + dialogue on screen.
    const car = new Car('sports', -HALF + 4 * BLOCK, -HALF + 2 * BLOCK, Math.PI * 0.5);
    car.driver = 'player';
    game.scene.add(car.group);
    p.car = car;
    p.x = car.x; p.z = car.z;
    game.playerMesh.visible = false;
    car.speed = 26;
    game.missions.index = 2;
    game.missions.start(); // Lose the Heat — objective panel visible
    game.addWanted(4, true);
    game.camYaw = car.heading;
    // Cruisers ahead and alongside, in the camera's view (car faces -x).
    for (const [dx, dz] of [[-26, 5], [-18, -7], [-34, -2]]) {
      const cop = new Car('police', car.x + dx, car.z + dz, car.heading);
      cop.driver = 'police';
      cop.speed = 22;
      game.scene.add(cop.group);
      game.police.cruisers.push(cop);
    }
    // Helicopter: lock it above the road ahead, in frame, for the cover shot.
    game.police.heliLock = { dx: -48, dz: 0 };
    // Level the chase camera so the heli and the sunset sky are in frame.
    game.shotCam = { dist: 11, height: 3.0, lookY: 4.5 };
    refreshShotHud(game, name);
  } else if (name === 'drive') {
    // Driving downtown in traffic.
    const car = new Car('sedan', -HALF + 2 * BLOCK, -HALF + 3 * BLOCK, Math.PI);
    car.driver = 'player';
    game.scene.add(car.group);
    p.car = car;
    p.x = car.x; p.z = car.z;
    game.playerMesh.visible = false;
    car.speed = 18;
    game.missions.index = 0;
    game.missions.start(); // Hot Wheels — deliver the car
    game.missions.active.stage = 1;
    game.hud.setMission('Hot Wheels', 'Steal any car, then drive it to the Ocean Drive drop-off.', 1, 2);
    game.missions.updateMarker();
    game.camYaw = car.heading;
    // Traffic ahead on the same road (car faces +z here: heading PI).
    for (const [type, dz, lane] of [['taxi', 26, -3], ['sedan', 44, 3], ['coupe', 62, -3]]) {
      const t = new Car(type, car.x + lane, car.z + dz, car.heading);
      t.driver = 'traffic'; t.cruise = 10; t.speed = 10;
      game.scene.add(t.group);
      game.traffic.cars.push(t);
    }
    refreshShotHud(game, name);
  } else if (name === 'foot') {
    // On foot on Ocean Drive, facing the sunset city with peds and rivals.
    p.x = -HALF + 7 * BLOCK; p.z = -HALF + 2 * BLOCK; // on the road (x = 216)
    p.heading = Math.PI / 2; // face west, toward the sunset
    game.camYaw = Math.PI / 2; // camera behind, east of the player
    game.playerMesh.visible = true;
    game._placePlayerMesh();
    game.peds.spawn(p.x, p.z, 6);
    // Pull three pedestrians onto the sidewalk beside the player.
    const near = game.peds.peds.slice(-3);
    const spots = [[-6, 9], [5, -10], [-11, -8]];
    near.forEach((pd, i) => {
      pd.x = p.x + spots[i][0]; pd.z = p.z + spots[i][1];
      pd.mesh.group.position.set(pd.x, 0, pd.z);
    });
    // Two rival crew members ahead, on the road, with health bars.
    game.combat.spawnEnemy(p.x - 14, p.z + 4, 100);
    game.combat.spawnEnemy(p.x - 20, p.z - 6, 100);
    game.missions.index = 5;
    game.missions.start(); // King of Vice City — final showdown framing
    refreshShotHud(game, name);
  } else if (name === 'mission') {
    // A mission in progress: Package Run, first package just ahead.
    p.x = -HALF + BLOCK; p.z = -HALF + BLOCK + 16; // on the road, south of package 1
    p.heading = 0; // face north, toward the package
    game.camYaw = 0; // camera behind, south of the player
    game.playerMesh.visible = true;
    game._placePlayerMesh();
    game.missions.index = 1;
    game.missions.start(); // Package Run
    const car = new Car('coupe', p.x + 5, p.z + 8, 0.4);
    car.driver = null;
    game.scene.add(car.group);
    game.parkedCars.push(car);
    game.peds.spawn(p.x, p.z, 4);
    refreshShotHud(game, name);
  } else {
    // Unknown shot name: plain free-roam start.
    hud.showToast('Vice Rush 3D — free roam');
  }
  game._syncHud();
}
