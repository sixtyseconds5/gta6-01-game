// Moving things: the player, traffic cars, pedestrians, police, bullets and
// particles. All simulation, no drawing — render.js paints this state.
import { CAR, CAR_COLORS, PLAYER, WANTED, WORLD } from './config.js';
import { createRandom, pick, range } from './random.js';

let nextId = 1;

export function makeCar(x, y, angle, color, police = false) {
  return {
    id: nextId++, kind: 'car', x, y, angle, speed: 0,
    color: color ?? pick(Math.random, CAR_COLORS),
    police,
    health: CAR.maxHealth,
    w: 44, h: 20,
    driver: null, // 'player' | 'traffic' | 'police' | null (parked)
    targetSpeed: 0,
    turnAt: 0,
    siren: 0,
    smoke: 0,
    crashTimer: 0, // cooldown between collision damage ticks
    ramTimer: 0, // cooldown between police rams
  };
}

export function makePed(x, y, random) {
  return {
    id: nextId++, kind: 'ped', x, y,
    angle: random() * Math.PI * 2,
    speed: 26 + random() * 30,
    color: pick(random, ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#ecf0f1', '#fd79a8']),
    health: 30,
    panic: 0,
    walkPhase: random() * 6,
    changeAt: 0,
  };
}

export function makeCop(x, y) {
  return {
    id: nextId++, kind: 'cop', x, y,
    angle: 0, speed: 245,
    health: 60, arrest: 0,
    color: '#2f6fd0',
    walkPhase: 0,
  };
}

export function createEntities(city) {
  const random = createRandom(987654321);
  const state = {
    player: {
      x: 1050, y: 1050, angle: -Math.PI / 2, vx: 0, vy: 0,
      health: PLAYER.maxHealth, cash: 250, inCar: null,
      fireTimer: 0, hurtTimer: 0, punchTimer: 0, enterCooldown: 0,
      aimX: 0, aimY: 0,
    },
    cars: [],
    peds: [],
    cops: [],
    bullets: [],
    particles: [],
    skids: [],
    pickups: [],
    wanted: 0,
    crimeTimer: 0, // seconds since the last crime
    decayTimer: 0,
    shake: 0,
    time: 0,
    busted: false,
    wasted: false,
    message: '',
    messageTimer: 0,
  };

  // Parked cars along the roads, plus moving traffic.
  for (let i = 0; i < 26; i++) {
    const line = city.lines[Math.floor(random() * city.lines.length)];
    const along = 120 + random() * (WORLD - 240);
    const horizontal = random() < 0.5;
    const x = horizontal ? along : line + (random() < 0.5 ? -ROAD_OFFSET : ROAD_OFFSET);
    const y = horizontal ? line + (random() < 0.5 ? -ROAD_OFFSET : ROAD_OFFSET) : along;
    const angle = horizontal ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar(x, y, angle, pick(random, CAR_COLORS));
    car.driver = random() < 0.55 ? 'traffic' : null;
    car.targetSpeed = 110 + random() * 90;
    state.cars.push(car);
  }
  for (let i = 0; i < 34; i++) {
    const p = randomSidewalkPoint(city, random);
    state.peds.push(makePed(p.x, p.y, random));
  }
  return state;
}

const ROAD_OFFSET = 24;

function randomSidewalkPoint(city, random) {
  const line = city.lines[Math.floor(random() * city.lines.length)];
  const along = 120 + random() * (WORLD - 240);
  const horizontal = random() < 0.5;
  const off = (Math.random() < 0.5 ? -1 : 1) * (ROAD_OFFSET + 22);
  return horizontal
    ? { x: along, y: line + off }
    : { x: line + off, y: along };
}

export function addCrime(state, stars) {
  state.wanted = Math.min(WANTED.maxStars, state.wanted + stars);
  state.crimeTimer = 0;
  state.decayTimer = 0;
}

export function spawnParticles(state, x, y, color, count, speed = 160) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    state.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.4 + Math.random() * 0.5, maxLife: 0.9, color,
      size: 2 + Math.random() * 4,
    });
  }
  if (state.particles.length > 400) state.particles.splice(0, state.particles.length - 400);
}

export function fireBullet(state, fromX, fromY, angle) {
  state.bullets.push({
    x: fromX + Math.cos(angle) * 22,
    y: fromY + Math.sin(angle) * 22,
    vx: Math.cos(angle) * 720, vy: Math.sin(angle) * 720,
    life: 0.9, damage: PLAYER.bulletDamage,
  });
}

function steerCarToward(car, tx, ty, dt, maxSpeed) {
  const dx = tx - car.x;
  const dy = ty - car.y;
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  car.angle += steer * CAR.steer * dt * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
  const target = maxSpeed * (Math.abs(diff) > 1.2 ? 0.45 : 1);
  if (car.speed < target) car.speed = Math.min(target, car.speed + CAR.accel * dt);
  else car.speed = Math.max(target, car.speed - CAR.brake * dt * 0.4);
}

export function stepEntities(state, city, input, dt, events) {
  const p = state.player;
  state.time += dt;
  state.crimeTimer += dt;
  p.fireTimer = Math.max(0, p.fireTimer - dt);
  p.hurtTimer = Math.max(0, p.hurtTimer - dt);
  p.punchTimer = Math.max(0, p.punchTimer - dt);
  state.shake = Math.max(0, state.shake - dt * 2.4);
  if (state.messageTimer > 0) state.messageTimer -= dt;

  // Wanted decay: lay low and the heat fades.
  if (state.wanted > 0 && state.crimeTimer > WANTED.decayDelay) {
    state.decayTimer += dt;
    if (state.decayTimer >= WANTED.decayStep) {
      state.decayTimer = 0;
      state.wanted -= 1;
      if (state.wanted === 0) {
        state.message = 'You lost the cops. Heat is off.';
        state.messageTimer = 3;
      }
    }
  }

  // --- Player on foot ---
  if (!p.inCar) {
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len; my /= len;
      const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      p.x += mx * speed * dt;
      p.y += my * speed * dt;
      p.angle = Math.atan2(my, mx);
    }
    city.resolveCircle(p, PLAYER.radius);
    // Aim at the mouse (world position supplied by the renderer).
    if (input.mouseActive) p.angle = Math.atan2(p.aimY - p.y, p.aimX - p.x);
    if (input.shoot && p.fireTimer <= 0) {
      p.fireTimer = PLAYER.fireCooldown;
      fireBullet(state, p.x, p.y, p.angle);
      events.shot = true;
      addCrime(state, 0); // shooting alone draws attention only when it hits
      if (state.wanted < 1) { /* firing in public is noticed */ addCrime(state, 1); }
    }
    if (input.enter && p.enterCooldown <= 0) {
      p.enterCooldown = 0.35;
      const car = nearestCar(state, p.x, p.y, 56);
      if (car) {
        p.inCar = car;
        car.driver = 'player';
        car.speed = 0;
        events.enterCar = true;
        if (car.police) addCrime(state, 1);
        else if (state.wanted < 1) addCrime(state, 1); // grand theft auto
        state.message = car.police ? 'You jacked a police cruiser!' : 'Car stolen — the heat is on!';
        state.messageTimer = 2.5;
      }
    }
  } else {
    // --- Player driving ---
    const car = p.inCar;
    const forward = input.up ? 1 : input.down ? -1 : 0;
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    if (forward > 0) car.speed = Math.min(CAR.maxSpeed, car.speed + CAR.accel * dt);
    else if (forward < 0) {
      car.speed = car.speed > 20 ? car.speed - CAR.brake * dt : Math.max(-CAR.maxReverse, car.speed - CAR.accel * 0.6 * dt);
    } else {
      car.speed *= Math.max(0, 1 - 1.6 * dt);
      if (Math.abs(car.speed) < 4) car.speed = 0;
    }
    const dir = car.speed >= 0 ? 1 : -1;
    car.angle += steer * CAR.steer * dt * dir * Math.min(1, Math.abs(car.speed) / 140 + 0.15);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const before = { x: car.x, y: car.y };
    car.x = nx; car.y = ny;
    const hit = city.collideCircle(car.x, car.y, CAR.radius);
    if (hit) {
      car.x = before.x; car.y = before.y;
      if (Math.abs(car.speed) > 240) {
        events.crash = true;
        state.shake = 0.5;
        damageCar(state, car, 18);
        p.health -= 4;
      }
      car.speed *= -0.25;
    }
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    // Skid marks at speed while turning.
    if (Math.abs(car.speed) > 300 && steer !== 0) {
      state.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 4 });
      if (state.skids.length > 220) state.skids.shift();
    }
    for (const s of state.skids) s.life -= dt;
    state.skids = state.skids.filter((s) => s.life > 0);
    if (input.enter && p.enterCooldown <= 0) {
      p.enterCooldown = 0.35;
      if (Math.abs(car.speed) < 40) {
        car.driver = null;
        p.inCar = null;
        p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
        p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
        events.exitCar = true;
      }
    }
  }
  p.enterCooldown = Math.max(0, (p.enterCooldown ?? 0) - dt);

  // --- Traffic cars: follow the road grid, turn at intersections. ---
  for (const car of state.cars) {
    car.crashTimer = Math.max(0, car.crashTimer - dt);
    car.ramTimer = Math.max(0, car.ramTimer - dt);
  }
  for (const car of state.cars) {
    if (car.driver === 'player') continue;
    if (car.driver === 'police') {
      steerCarToward(car, p.x, p.y, dt, 430 + state.wanted * 26);
      car.siren += dt;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const before = { x: car.x, y: car.y };
      car.x = nx; car.y = ny;
      if (city.collideCircle(car.x, car.y, CAR.radius)) { car.x = before.x; car.y = before.y; car.speed *= 0.3; }
      // Ram the player — hard, but only once per beat, not every step.
      if (Math.hypot(car.x - p.x, car.y - p.y) < 34 && car.ramTimer <= 0) {
        car.ramTimer = 0.8;
        if (p.inCar) damageCar(state, p.inCar, 10);
        else p.health -= 12;
        events.crash = true;
        state.shake = 0.4;
        car.speed *= 0.2;
        p.hurtTimer = 0.6;
      }
      continue;
    }
    if (car.driver === 'traffic') {
      // Drive along the current heading; at an intersection, sometimes turn.
      const onV = Math.abs(Math.sin(car.angle)) > 0.7;
      const line = onV ? nearestLine(city.lines, car.x) : nearestLine(city.lines, car.y);
      const lane = onV ? line + ROAD_OFFSET * (Math.sin(car.angle) > 0 ? 1 : -1) * 0.0 : line;
      void lane;
      car.speed += (car.targetSpeed - car.speed) * dt * 0.5;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      car.x = nx; car.y = ny;
      const nearIntersection = distanceToLine(car.x, car.y, city.lines) < 12;
      if (nearIntersection && Math.random() < dt * 0.5) {
        car.angle += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
      }
      if (city.collideCircle(car.x, car.y, CAR.radius)) {
        car.angle += Math.PI / 2;
        car.x = Math.max(CAR.radius, Math.min(WORLD - CAR.radius, car.x));
        car.y = Math.max(CAR.radius, Math.min(WORLD - CAR.radius, car.y));
      }
      // Keep traffic on roads: gently pull toward the nearest road centreline.
      const road = city.nearestRoad(car.x, car.y);
      if (road) {
        car.x += (road.x - car.x) * 0.12 * dt * 4;
        car.y += (road.y - car.y) * 0.12 * dt * 4;
      }
      // Avoid running over the player on foot (traffic brakes).
      const dp = Math.hypot(car.x - p.x, car.y - p.y);
      if (!p.inCar && dp < 90) car.speed = Math.max(0, car.speed - 500 * dt);
    }
  }

  // Car vs car: simple push-apart, with one damage tick per impact, not per step.
  for (let i = 0; i < state.cars.length; i++) {
    for (let j = i + 1; j < state.cars.length; j++) {
      const a = state.cars[i];
      const b = state.cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 44) {
        const push = (44 - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        if (a.driver !== 'player') { a.x -= ux * push; a.y -= uy * push; }
        if (b.driver !== 'player') { b.x += ux * push; b.y += uy * push; }
        if ((Math.abs(a.speed) > 200 || Math.abs(b.speed) > 200) && a.crashTimer <= 0 && b.crashTimer <= 0) {
          events.crash = true;
          damageCar(state, a, 6);
          damageCar(state, b, 6);
          a.crashTimer = 0.6;
          b.crashTimer = 0.6;
        }
      }
    }
  }

  // --- Pedestrians: wander the sidewalks, panic and flee from gunfire and cars. ---
  for (const ped of state.peds) {
    ped.walkPhase += dt * 6;
    ped.changeAt -= dt;
    const playerDist = Math.hypot(ped.x - p.x, ped.y - p.y);
    const threat = state.bullets.length > 0 || (p.inCar && Math.abs(p.inCar.speed) > 260 && playerDist < 130);
    if (threat) ped.panic = 1.6;
    if (ped.panic > 0) {
      ped.panic -= dt;
      const a = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.x += Math.cos(a) * 170 * dt;
      ped.y += Math.sin(a) * 170 * dt;
      ped.angle = a;
    } else {
      if (ped.changeAt <= 0) {
        ped.changeAt = 1 + Math.random() * 2.5;
        ped.angle += (Math.random() - 0.5) * 1.6;
      }
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    city.resolveCircle(ped, 10);
    if (ped.x < 20 || ped.y < 20 || ped.x > WORLD - 20 || ped.y > WORLD - 20) {
      ped.angle += Math.PI;
      ped.x = Math.max(20, Math.min(WORLD - 20, ped.x));
      ped.y = Math.max(20, Math.min(WORLD - 20, ped.y));
    }
  }

  // --- On-foot cops chase and try to arrest the player. ---
  for (const cop of state.cops) {
    cop.walkPhase += dt * 9;
    const dx = p.x - cop.x;
    const dy = p.y - cop.y;
    const d = Math.hypot(dx, dy);
    if (d > 1) {
      cop.angle = Math.atan2(dy, dx);
      cop.x += (dx / d) * cop.speed * dt;
      cop.y += (dy / d) * cop.speed * dt;
    }
    city.resolveCircle(cop, 12);
    if (d < 30 && !p.inCar && state.wanted > 0) {
      cop.arrest += dt;
      if (cop.arrest > 1.4) state.busted = true;
    } else {
      cop.arrest = Math.max(0, cop.arrest - dt * 2);
    }
  }

  // --- Police response scales with the wanted level. ---
  const wantPoliceCars = state.wanted >= 1 ? Math.min(2 + state.wanted, 6) : 0;
  const wantCops = state.wanted >= 2 ? Math.min(state.wanted - 1, 4) : 0;
  const policeCars = state.cars.filter((c) => c.driver === 'police').length;
  if (policeCars < wantPoliceCars && Math.random() < dt * 0.8) {
    const road = city.nearestRoad(p.x + (Math.random() - 0.5) * 900, p.y + (Math.random() - 0.5) * 900);
    const car = makeCar(road.x, road.y, Math.random() * Math.PI * 2, '#1c2733', true);
    car.driver = 'police';
    car.speed = 200;
    state.cars.push(car);
    events.siren = true;
  }
  if (state.cops.length < wantCops && Math.random() < dt * 0.7) {
    const road = city.nearestRoad(p.x + (Math.random() - 0.5) * 500, p.y + (Math.random() - 0.5) * 500);
    state.cops.push(makeCop(road.x, road.y));
  }
  // Stand down when the heat is off.
  if (state.wanted === 0) {
    for (const car of state.cars) if (car.driver === 'police') car.driver = null;
    state.cops.length = 0;
  }

  // --- Bullets ---
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (city.collideCircle(b.x, b.y, 2)) { b.life = 0; spawnParticles(state, b.x, b.y, '#f5d76e', 4, 90); }
    for (const ped of state.peds) {
      if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
        ped.health -= b.damage;
        b.life = 0;
        spawnParticles(state, ped.x, ped.y, '#c0392b', 10);
        if (ped.health <= 0) {
          ped.dead = true;
          addCrime(state, 1);
          dropCash(state, ped.x, ped.y);
          events.pedDown = true;
        }
      }
    }
    for (const cop of state.cops) {
      if (Math.hypot(cop.x - b.x, cop.y - b.y) < 15) {
        cop.health -= b.damage;
        b.life = 0;
        spawnParticles(state, cop.x, cop.y, '#2f6fd0', 10);
        if (cop.health <= 0) {
          cop.dead = true;
          addCrime(state, 2);
          events.copDown = true;
        }
      }
    }
    for (const car of state.cars) {
      if (car.driver === 'player') continue;
      const dx = b.x - car.x;
      const dy = b.y - car.y;
      const ca = Math.cos(-car.angle);
      const sa = Math.sin(-car.angle);
      const lx = dx * ca - dy * sa;
      const ly = dx * sa + dy * ca;
      if (Math.abs(lx) < 24 && Math.abs(ly) < 12) {
        b.life = 0;
        damageCar(state, car, b.damage);
        spawnParticles(state, b.x, b.y, '#f5d76e', 6);
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
  state.peds = state.peds.filter((ped) => !ped.dead);
  state.cops = state.cops.filter((cop) => !cop.dead);
  // Keep the streets populated.
  while (state.peds.length < 30) {
    const pt = randomSidewalkPoint(city, Math.random);
    state.peds.push(makePed(pt.x, pt.y, Math.random));
  }

  // --- Player car hitting pedestrians ---
  if (p.inCar) {
    for (const ped of state.peds) {
      if (Math.hypot(ped.x - p.x, ped.y - p.y) < 30 && Math.abs(p.inCar.speed) > 60) {
        ped.health = 0;
        ped.dead = true;
        addCrime(state, 1);
        dropCash(state, ped.x, ped.y);
        spawnParticles(state, ped.x, ped.y, '#c0392b', 12);
        state.shake = 0.35;
        events.crash = true;
      }
    }
    state.peds = state.peds.filter((ped) => !ped.dead);
  }

  // --- Cash pickups ---
  for (const pk of state.pickups) {
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 34) {
      pk.taken = true;
      p.cash += pk.amount;
      events.pickup = true;
      state.message = `+$${pk.amount}`;
      state.messageTimer = 1.2;
    }
  }
  state.pickups = state.pickups.filter((pk) => !pk.taken);

  // --- Particles ---
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.96;
    pt.vy *= 0.96;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);

  // --- Health / game over ---
  if (p.health <= 0) {
    p.health = 0;
    state.wasted = true;
  }
  if (p.inCar && p.inCar.health <= 0) {
    spawnParticles(state, p.inCar.x, p.inCar.y, '#ff7b00', 30, 260);
    spawnParticles(state, p.inCar.x, p.inCar.y, '#333', 20, 120);
    state.cars = state.cars.filter((c) => c !== p.inCar);
    p.inCar = null;
    p.health -= 25;
    state.shake = 0.8;
    events.explosion = true;
    state.message = 'Your ride blew up!';
    state.messageTimer = 2.5;
  }
}

function damageCar(state, car, amount) {
  car.health -= amount;
  car.smoke = Math.max(car.smoke, car.health < 50 ? 1 : 0.4);
  if (car.health <= 0 && car.driver !== 'player') {
    spawnParticles(state, car.x, car.y, '#ff7b00', 26, 240);
    state.cars = state.cars.filter((c) => c !== car);
    if (car.driver === 'police') addCrime(state, 1);
  }
}

function dropCash(state, x, y) {
  state.pickups.push({ x, y, amount: 20 + Math.floor(Math.random() * 40), bob: Math.random() * 6 });
}

function nearestCar(state, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function nearestLine(lines, v) {
  let best = lines[0];
  let bestD = Infinity;
  for (const line of lines) {
    const d = Math.abs(line - v);
    if (d < bestD) { bestD = d; best = line; }
  }
  return best;
}

function distanceToLine(x, y, lines) {
  let best = Infinity;
  for (const line of lines) {
    best = Math.min(best, Math.abs(x - line), Math.abs(y - line));
  }
  return best;
}

export { ROAD_OFFSET };
