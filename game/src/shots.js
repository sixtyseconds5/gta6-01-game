// The screenshot scenes behind ?shot=chase|drive|foot|mission. Each one stages a
// real game state — a fresh world, a placed player, traffic and police — then plays
// it forward for a fixed number of steps with a simple autopilot driving the real
// simulation, so the frame is what real play looks like and the same scene always
// gives the same frame.
import { makeCar, makePed, stepEntities, addCrime } from './entities.js';
import { startMission } from './missions.js';
import { SCREEN_PLAY } from './render.js';

const STEPS = 150; // 2.5 s of play at 60 steps a second
const DT = 1 / 60;

function driveInput(state, tx, ty) {
  // Steer the player's car toward a target point, throttle down.
  const car = state.player.inCar;
  if (!car) return { up: false, down: false, left: false, right: false, run: false, shoot: false, enter: false, mouseActive: false, aimX: 0, aimY: 0 };
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return {
    up: true, down: false,
    left: diff < -0.08, right: diff > 0.08,
    run: false, shoot: false, enter: false, mouseActive: false, aimX: 0, aimY: 0,
  };
}

function playForward(game, steps, tx, ty) {
  const events = {};
  for (let i = 0; i < steps; i++) {
    const input = driveInput(game.state, tx, ty);
    stepEntities(game.state, game.city, input, DT, events);
  }
}

export function stageShot(shot, game) {
  const { state, city, missions } = game;
  const p = state.player;
  state.wanted = 0;
  state.cops.length = 0;
  state.bullets.length = 0;
  state.message = '';
  state.messageTimer = 0;

  if (shot === 'chase') {
    // Player in a stolen car, three police cruisers on his tail, wanted 3 stars,
    // mission 1 active with the drop-off marked. Straight east along road y=900.
    const car = makeCar(1500, 900, 0, '#c0392b');
    car.driver = 'player';
    car.speed = 320;
    state.cars.push(car);
    p.inCar = car;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    addCrime(state, 3);
    for (let i = 0; i < 3; i++) {
      const pc = makeCar(1500 - 95 - i * 70, 900 + (i % 2 === 0 ? -24 : 24), 0, '#1c2733', true);
      pc.driver = 'police';
      pc.speed = 380;
      state.cars.push(pc);
    }
    missions.index = 0;
    startMission(missions, state, city);
    missions.banner = '';
    missions.bannerTimer = 0;
    state.message = 'The VCPD is on your tail — reach the drop-off!';
    state.messageTimer = 10;
    playForward(game, STEPS, 3400, 900);
  } else if (shot === 'drive') {
    // Cruising through downtown traffic in a stolen sedan, no heat.
    // Straight east along road y=600, in the eastbound lane (y=624);
    // oncoming traffic keeps to the westbound lane (y=576).
    const car = makeCar(600, 624, 0, '#2980b9');
    car.driver = 'player';
    car.speed = 300;
    state.cars.push(car);
    p.inCar = car;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    missions.index = 0;
    missions.stage = 'intro';
    // Extra traffic on the same street so the drive reads as a busy city road.
    for (const [tx, ty, ta] of [[1000, 576, Math.PI], [1700, 576, Math.PI], [2400, 576, Math.PI], [2600, 624, 0]]) {
      const t = makeCar(tx, ty, ta, ['#e67e22', '#f1c40f', '#8e44ad', '#1abc9c'][Math.floor(Math.random() * 4)]);
      t.driver = 'traffic';
      t.targetSpeed = 130;
      state.cars.push(t);
    }
    playForward(game, STEPS, 3400, 624);
  } else if (shot === 'foot') {
    // On foot in Sunset Park, pedestrians strolling, traffic passing on the roads.
    p.x = 1650;
    p.y = 1650;
    p.angle = Math.PI / 4;
    p.inCar = null;
    for (let i = 0; i < 6; i++) {
      state.peds.push(makePed(1500 + i * 55, 1550 + (i % 3) * 60, Math.random));
    }
    missions.index = 0;
    missions.stage = 'intro';
  } else if (shot === 'mission') {
    // Mission 2 in progress: two packages already collected, the third marked
    // ahead on the road, player driving west toward it with a little heat.
    missions.index = 1;
    startMission(missions, state, city);
    missions.packages[0].taken = true;
    missions.packages[1].taken = true;
    missions.collected = 2;
    missions.banner = '';
    missions.bannerTimer = 0;
    const car = makeCar(2100, 2400, Math.PI, '#27ae60');
    car.driver = 'player';
    car.speed = 340;
    state.cars.push(car);
    p.inCar = car;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    addCrime(state, 1);
    const pc = makeCar(2100 + 150, 2400 + 24, Math.PI, '#1c2733', true);
    pc.driver = 'police';
    pc.speed = 320;
    state.cars.push(pc);
    state.message = 'Package 2/3 — one more, then deliver the bag.';
    state.messageTimer = 10;
    playForward(game, STEPS, 500, 2400);
  } else {
    return SCREEN_PLAY;
  }
  return SCREEN_PLAY;
}
