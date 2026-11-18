// Vice Rush 3D — traffic: cars cruise the road grid in lanes, slow at
// intersections, despawn far from the player and respawn nearby.
import { Car } from './vehicles.js';
import { BLOCK, GRID_N, HALF, ROAD_W, BEACH_X, CAR_TYPES } from './config.js';
import { mulberry32, pick, range, clamp } from './random.js';

const TRAFFIC_TYPES = ['sedan', 'sedan', 'coupe', 'taxi', 'van', 'truck', 'sports'];
const MAX_TRAFFIC = 14;

export class TrafficManager {
  constructor(scene, colliders, rng) {
    this.scene = scene;
    this.colliders = colliders;
    this.rng = rng || mulberry32(777);
    this.cars = [];
    this._spawnTimer = 0;
  }

  roadCoord(i) { return -HALF + i * BLOCK; }

  // Pick a random road position: on a road centreline, offset into a lane.
  randomRoadPos() {
    const rng = this.rng;
    const horizontal = rng() < 0.5;
    const line = this.roadCoord(Math.floor(rng() * GRID_N));
    const along = range(rng, -HALF + 10, Math.min(HALF - 10, BEACH_X - 10));
    const lane = (rng() < 0.5 ? -1 : 1) * (ROAD_W / 4);
    if (horizontal) return { x: along, z: line + lane, heading: lane < 0 ? Math.PI / 2 : -Math.PI / 2 };
    return { x: line + lane, z: along, heading: lane < 0 ? Math.PI : 0 };
  }

  spawnCar(px, pz) {
    let pos = this.randomRoadPos();
    let tries = 0;
    while (tries++ < 8) {
      const d2 = (pos.x - px) ** 2 + (pos.z - pz) ** 2;
      if (d2 > 60 * 60 && d2 < 260 * 260) break;
      pos = this.randomRoadPos();
    }
    const car = new Car(pick(this.rng, TRAFFIC_TYPES), pos.x, pos.z, pos.heading);
    car.driver = 'traffic';
    car.cruise = range(this.rng, 9, 15);
    this.scene.add(car.group);
    this.cars.push(car);
    return car;
  }

  ensure(px, pz) {
    this._spawnTimer -= 1 / 60;
    if (this.cars.length < MAX_TRAFFIC && this._spawnTimer <= 0) {
      this.spawnCar(px, pz);
      this._spawnTimer = 0.4;
    }
  }

  // Simple traffic AI: follow the current road, turn at intersections.
  update(dt, px, pz, onCrash) {
    this.ensure(px, pz);
    const rng = this.rng;
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      if (car.dead) { this.removeCar(i); continue; }
      const d2 = (car.x - px) ** 2 + (car.z - pz) ** 2;
      if (d2 > 320 * 320) { this.removeCar(i); continue; }
      // Slow near intersections (snap decisions look like stopping).
      const nearX = this._nearRoad(car.x), nearZ = this._nearRoad(car.z);
      let target = car.cruise;
      if (nearX && nearZ && rng() < dt * 0.5) target = 0;
      // Gentle speed control toward target.
      const throttle = car.speed < target ? 0.7 : (car.speed > target + 1 ? -0.6 : 0);
      car.drive(throttle, 0, dt);
      // At an intersection, sometimes turn onto the cross street.
      if (nearX && nearZ && rng() < dt * 0.35) {
        car.heading += (rng() < 0.5 ? 1 : -1) * Math.PI / 2;
        car.updateMesh();
      }
      // Keep inside the city; turn around at the edges.
      if (car.x < -HALF - 6 || car.x > BEACH_X - 6 || car.z < -HALF - 6 || car.z > HALF - 6) {
        car.heading += Math.PI;
        car.x = clamp(car.x, -HALF, BEACH_X - 8);
        car.z = clamp(car.z, -HALF, HALF);
        car.updateMesh();
      }
      // Crude car-car separation: slow if another car is right ahead.
      for (const other of this.cars) {
        if (other === car) continue;
        const dx = other.x - car.x, dz = other.z - car.z;
        const d = Math.hypot(dx, dz);
        if (d < 7 && d > 0.01) {
          const fx = -Math.sin(car.heading), fz = -Math.cos(car.heading);
          if (dx * fx + dz * fz > 0) car.speed = Math.min(car.speed, other.speed * 0.8);
        }
      }
      if (onCrash) onCrash(car);
    }
  }

  _nearRoad(v) {
    const rel = ((v + HALF) % BLOCK + BLOCK) % BLOCK;
    return Math.min(rel, BLOCK - rel) < ROAD_W * 0.7;
  }

  removeCar(i) {
    const car = this.cars[i];
    this.scene.remove(car.group);
    this.cars.splice(i, 1);
  }

  removeAll() {
    for (let i = this.cars.length - 1; i >= 0; i--) this.removeCar(i);
  }
}
