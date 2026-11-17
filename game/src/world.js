// The city of Vice Rush: a street grid, buildings, a park, a beach and the water's
// edge. Generation is seeded, so every load builds the same city. This module owns
// the static layout and the collision queries; moving things live in entities.js.
import { BEACH_X, BLOCK, CITY_SEED, COLORS, ROAD_W, WATER_X, WORLD } from './config.js';
import { createRandom, pick, range } from './random.js';

// Road centrelines run at multiples of BLOCK, inset from the world edge.
export function roadLines() {
  const lines = [];
  for (let p = BLOCK; p < WORLD; p += BLOCK) lines.push(p);
  return lines;
}

function circleHitsRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export function createCity() {
  const random = createRandom(CITY_SEED);
  const lines = roadLines();
  const buildings = [];
  const trees = [];
  const lamps = [];

  // Park: a two-by-two block green in the middle of the city.
  const park = { x: 1350, y: 1350, w: 600, h: 600 };
  for (let i = 0; i < 46; i++) {
    trees.push({
      x: park.x + 30 + random() * (park.w - 60),
      y: park.y + 30 + random() * (park.h - 60),
      r: 12 + random() * 10,
    });
  }

  // Buildings fill every block that is not the park and not the beach strip.
  for (let bx = 0; bx < lines.length - 1; bx++) {
    for (let by = 0; by < lines.length - 1; by++) {
      const x0 = lines[bx] + ROAD_W / 2 + 14;
      const y0 = lines[by] + ROAD_W / 2 + 14;
      const x1 = lines[bx + 1] - ROAD_W / 2 - 14;
      const y1 = lines[by + 1] - ROAD_W / 2 - 14;
      if (x0 >= BEACH_X - 60) continue; // beach strip stays open
      if (x0 >= park.x - 10 && x0 < park.x + park.w && y0 >= park.y - 10 && y0 < park.y + park.h) continue;
      const count = 1 + Math.floor(random() * 3);
      for (let i = 0; i < count; i++) {
        const w = range(random, 60, Math.max(70, (x1 - x0) / count));
        const h = range(random, 60, 110);
        const x = x0 + ((x1 - x0 - w) * (count === 1 ? 0.5 : i / Math.max(1, count - 1) + (random() - 0.5) * 0.2));
        const y = y0 + random() * Math.max(1, y1 - y0 - h);
        buildings.push({
          x, y, w, h,
          color: pick(random, COLORS.buildingRoof),
          stories: 1 + Math.floor(random() * 5),
        });
      }
    }
  }

  // Street lamps along the roads.
  for (const line of lines) {
    for (let p = BLOCK / 2; p < WORLD; p += BLOCK) {
      lamps.push({ x: line + ROAD_W / 2 + 6, y: p });
      lamps.push({ x: p, y: line + ROAD_W / 2 + 6 });
    }
  }

  // Named districts, for the HUD and the story text.
  const districts = [
    { name: 'Downtown', x: 300, y: 300, w: 1200, h: 900 },
    { name: 'Little Havana Row', x: 300, y: 1500, w: 900, h: 1200 },
    { name: 'Sunset Park', x: park.x, y: park.y, w: park.w, h: park.h },
    { name: 'Ocean Drive', x: BEACH_X - 300, y: 300, w: 600, h: 2400 },
    { name: 'Northside', x: 1800, y: 300, w: 1200, h: 900 },
    { name: 'The Docks', x: 300, y: 2700, w: 1200, h: 600 },
  ];

  return {
    lines, buildings, trees, lamps, park, districts,
    // Is this point on a road (within the asphalt)?
    isRoad(x, y) {
      if (x > BEACH_X || y < 0 || y > WORLD || x < 0) return false;
      for (const line of lines) {
        if (Math.abs(x - line) < ROAD_W / 2 || Math.abs(y - line) < ROAD_W / 2) return true;
      }
      return false;
    },
    // Nearest point on the road network, for spawning cars and cops.
    nearestRoad(x, y) {
      let best = null;
      let bestD = Infinity;
      for (const line of lines) {
        const candidates = [
          { x: line, y: Math.max(0, Math.min(WORLD, y)) },
          { x: Math.max(0, Math.min(WORLD, x)), y: line },
        ];
        for (const c of candidates) {
          const d = (c.x - x) ** 2 + (c.y - y) ** 2;
          if (d < bestD) { bestD = d; best = c; }
        }
      }
      return best;
    },
    // Circle vs buildings / water / world edge. Returns the blocking rect or null.
    collideCircle(x, y, r) {
      if (x < r || y < r || x > WORLD - r || y > WORLD - r) return { x: -1, y: -1, w: 0, h: 0, edge: true };
      if (x > WATER_X - r) return { x: WATER_X, y: 0, w: WORLD, h: WORLD, edge: true, water: true };
      for (const b of buildings) {
        if (circleHitsRect(x, y, r, b)) return b;
      }
      return null;
    },
    // Push a circle out of whatever it overlaps; returns true when it was pushed.
    resolveCircle(body, r) {
      const hit = this.collideCircle(body.x, body.y, r);
      if (!hit) return false;
      if (hit.edge) {
        body.x = Math.max(r, Math.min(WORLD - r, body.x));
        body.y = Math.max(r, Math.min(WORLD - r, body.y));
        if (body.x > WATER_X - r) body.x = WATER_X - r;
        return true;
      }
      // Push out along the smallest penetration axis.
      const cx = Math.max(hit.x, Math.min(body.x, hit.x + hit.w));
      const cy = Math.max(hit.y, Math.min(body.y, hit.y + hit.h));
      let dx = body.x - cx;
      let dy = body.y - cy;
      const d = Math.hypot(dx, dy);
      if (d < 0.001) {
        const left = body.x - hit.x;
        const right = hit.x + hit.w - body.x;
        const top = body.y - hit.y;
        const bottom = hit.y + hit.h - body.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) body.x = hit.x - r;
        else if (m === right) body.x = hit.x + hit.w + r;
        else if (m === top) body.y = hit.y - r;
        else body.y = hit.y + hit.h + r;
        return true;
      }
      dx /= d; dy /= d;
      body.x = cx + dx * r;
      body.y = cy + dy * r;
      return true;
    },
    districtAt(x, y) {
      for (const d of districts) {
        if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
      }
      return 'Vice City';
    },
  };
}
