// Vice Rush — configuration and tuning constants.
// A sun-soaked open-world crime game: one city, one set of rules, no network.
export const WORLD = 3600; // city is WORLD x WORLD pixels
export const BLOCK = 300; // distance between road centrelines
export const ROAD_W = 96; // road width
export const BEACH_X = 3180; // sand starts here (east edge)
export const WATER_X = 3400; // water starts here

export const PLAYER = {
  walkSpeed: 215,
  runSpeed: 305,
  radius: 14,
  maxHealth: 100,
  bulletDamage: 34,
  fireCooldown: 0.22,
};

export const CAR = {
  accel: 540,
  brake: 950,
  maxSpeed: 580,
  maxReverse: 190,
  steer: 2.7,
  radius: 20,
  maxHealth: 120,
};

export const WANTED = {
  decayDelay: 14, // seconds with no crime before stars start falling
  decayStep: 9, // seconds per star lost while laying low
  maxStars: 5,
};

export const COLORS = {
  grass: '#7fae5a',
  grassDark: '#74a352',
  sidewalk: '#c9c2b4',
  road: '#3d3f45',
  roadLine: '#e8d44d',
  sand: '#e8d29a',
  water: '#2f7fb8',
  waterDeep: '#256a9e',
  park: '#5d9b4a',
  buildingRoof: ['#b5674a', '#8a7f8d', '#c98f4e', '#6f8fae', '#a85f6e', '#7d9b6a', '#96705a'],
  hudBg: 'rgba(12,16,24,0.72)',
  hudText: '#f2f0e6',
  accent: '#ffd23f',
  mission: '#ffd23f',
  police: '#2f6fd0',
};

export const CAR_COLORS = [
  '#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#2980b9',
  '#8e44ad', '#ecf0f1', '#1abc9c', '#e84393', '#2d3436',
  '#d35400', '#16a085',
];

// Mission cash rewards.
export const REWARDS = { m1: 500, m2: 800, m3: 1500 };

// Deterministic seed so the city layout is the same every load.
export const CITY_SEED = 20261117;
