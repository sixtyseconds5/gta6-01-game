// Vice Rush 3D — configuration and tuning constants.
// A sun-soaked 3D open-world crime game in the spirit of GTA 6: one city,
// one set of rules, no network requests, no build step.
export const CITY_SEED = 20261118;

// City layout (metres). Streets run on a grid; blocks are BLOCK x BLOCK.
export const BLOCK = 72;          // distance between road centrelines
export const ROAD_W = 13;         // road width
export const GRID_N = 9;          // roads per axis (0..8)
export const CITY_SIZE = (GRID_N - 1) * BLOCK; // 576 m across
export const HALF = CITY_SIZE / 2;              // 288
export const BEACH_X = HALF - 18;   // sand starts here (east edge)
export const WATER_X = HALF + 26;   // water starts here
export const WORLD_MIN = -HALF - 40;
export const WORLD_MAX = HALF + 60;

export const PLAYER = {
  walkSpeed: 5.2,
  runSpeed: 9.0,
  accel: 40,
  radius: 0.55,
  maxHealth: 100,
  jumpSpeed: 7.5,
};

export const CAR = {
  accel: 22,
  brake: 38,
  maxSpeed: 42,      // sports can exceed via type multiplier
  maxReverse: 12,
  steer: 2.1,
  radius: 1.6,
  maxHealth: 120,
};

// Car types: distinct look, speed and handling.
export const CAR_TYPES = {
  sedan:   { label: 'Vulcan Sedan',  topSpeed: 34, accel: 20, color: 0xb03a2e, body: 0xb03a2e, cabin: 0x22303c, len: 4.4, wid: 1.9, h: 1.05 },
  sports:  { label: 'Comet GT',     topSpeed: 48, accel: 30, color: 0xf1c40f, body: 0xf1c40f, cabin: 0x111820, len: 4.2, wid: 1.9, h: 0.85 },
  taxi:    { label: 'Vice Cab',     topSpeed: 36, accel: 21, color: 0xf39c12, body: 0xf39c12, cabin: 0x22303c, len: 4.4, wid: 1.9, h: 1.05, taxi: true },
  truck:   { label: 'Hauler',       topSpeed: 28, accel: 15, color: 0x5d6d7e, body: 0x5d6d7e, cabin: 0x2c3e50, len: 5.6, wid: 2.1, h: 1.5 },
  police:  { label: 'VCPD Cruiser', topSpeed: 40, accel: 26, color: 0x2f6fd0, body: 0x1c1f26, cabin: 0x22303c, len: 4.5, wid: 1.95, h: 1.05, police: true },
  coupe:   { label: 'Sunset Coupe', topSpeed: 38, accel: 24, color: 0x8e44ad, body: 0x8e44ad, cabin: 0x1a2530, len: 4.3, wid: 1.85, h: 0.95 },
  van:     { label: 'Mule Van',     topSpeed: 30, accel: 16, color: 0x27ae60, body: 0x27ae60, cabin: 0x1e5631, len: 5.0, wid: 2.0, h: 1.7 },
};

// Named districts, for the HUD and the story text. Rectangles in world coords.
export const DISTRICTS = [
  { name: 'Downtown',        x0: -HALF, z0: -HALF, x1: -40,   z1: -40,  color: '#ffd23f' },
  { name: 'Little Havana Row', x0: -HALF, z0: -40,  x1: -40,   z1: HALF, color: '#ff9f43' },
  { name: 'Sunset Park',     x0: -40,   z0: -HALF, x1: 150,   z1: 40,   color: '#2ecc71' },
  { name: 'Ocean Drive',     x0: 150,   z0: -HALF, x1: BEACH_X, z1: 120, color: '#48dbfb' },
  { name: 'Northside',       x0: -40,   z0: 40,    x1: 150,   z1: HALF, color: '#a29bfe' },
  { name: 'The Docks',       x0: 150,   z0: 120,   x1: BEACH_X, z1: HALF, color: '#e17055' },
  { name: 'Vice Beach',      x0: BEACH_X, z0: -HALF, x1: WATER_X, z1: HALF, color: '#f7d794' },
];

// Key places (world coords). Every place sits on a road centreline, an
// intersection, the park, or the beach — never inside a building block,
// so the player and cars can always reach it.
export const PLACES = {
  hideout:   { x: -HALF + BLOCK, z: -HALF + 108, label: 'Vic\u2019s Hideout' },   // x=-216 road
  dropoff:   { x: HALF - BLOCK,  z: -HALF + 108, label: 'Ocean Drive Drop-off' },
  shop:      { x: -HALF + BLOCK, z: HALF - 108,  label: 'Ammo-Nation Store' },
  safehouse: { x: HALF - BLOCK,  z: HALF - 108,  label: 'Sunset Garage' },
  docks:     { x: HALF - BLOCK,  z: HALF - 180,  label: 'The Docks' },
  beachfront:{ x: BEACH_X + 6,   z: 60,          label: 'Beachfront Strip' },
  park:      { x: -HALF + 2 * BLOCK + 26, z: -HALF + 26, label: 'Sunset Park' },
  plaza:     { x: 0,           z: 0,           label: 'Vice Plaza' },
};

export const WANTED = {
  decayDelay: 14, // seconds with no crime before stars start falling
  decayStep: 9,   // seconds per star lost while laying low
  maxStars: 5,
};

export const WEAPONS = {
  pistol:  { label: 'Pistol',   damage: 34, cooldown: 0.28, spread: 0.012, auto: false, range: 90,  tracer: 0xffe08a, ammo: 60 },
  smg:     { label: 'SMG',      damage: 16, cooldown: 0.09, spread: 0.03,  auto: true,  range: 70,  tracer: 0xffd23f, ammo: 120 },
  shotgun: { label: 'Shotgun',  damage: 22, cooldown: 0.75, spread: 0.09,  auto: false, range: 45,  tracer: 0xff9f43, ammo: 24, pellets: 6 },
};

// Mission cash rewards.
export const REWARDS = { m1: 500, m2: 800, m3: 1500, m4: 900, m5: 2000, m6: 3000 };

export const COLORS = {
  skyTop: 0x2e6fb8,
  skyHorizon: 0xffb26b,
  sun: 0xffd9a0,
  fog: 0xf7b06a,
  water: 0x1e7fa8,
  waterDeep: 0x0f5b82,
  sand: 0xe8d29a,
  grass: 0x5d9b4a,
  road: 0x3d3f45,
  sidewalk: 0xc9c2b4,
  police: 0x2f6fd0,
  hudBg: 'rgba(12,16,24,0.72)',
  hudText: '#f2f0e6',
  accent: '#ffd23f',
};
