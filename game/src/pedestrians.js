// Vice Rush 3D — pedestrians: stroll the sidewalks, panic and flee from
// gunfire and crashes, and can be knocked down by a speeding car.
import * as THREE from 'three';
import { BLOCK, HALF, ROAD_W, BEACH_X } from './config.js';
import { mulberry32, pick, range, clamp } from './random.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xe67e22, 0x1abc9c, 0xecf0f1, 0xfd79a8, 0x6c5ce7];
const PANTS = [0x2c3e50, 0x34495e, 0x7f8c8d, 0x5d4037, 0x1a1a2e];
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];

function makePedMesh(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: pick(rng, PANTS) });
  const skin = new THREE.MeshLambertMaterial({ color: pick(rng, SKINS) });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), shirt);
  body.position.y = 1.05; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.72; head.castShadow = true;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.26), pants);
  legL.position.set(-0.16, 0.31, 0);
  const legR = legL.clone(); legR.position.x = 0.16;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt);
  armL.position.set(-0.42, 1.05, 0);
  const armR = armL.clone(); armR.position.x = 0.42;
  g.add(body, head, legL, legR, armL, armR);
  return { group: g, legL, legR, armL, armR };
}

export class PedestrianManager {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng || mulberry32(4242);
    this.peds = [];
    this._timer = 0;
  }

  spawn(px, pz, count = 1) {
    const rng = this.rng;
    for (let k = 0; k < count; k++) {
      let x, z, tries = 0;
      do {
        x = range(rng, -HALF + 12, BEACH_X - 12);
        z = range(rng, -HALF + 12, HALF - 12);
        tries++;
      } while (tries < 10 && (Math.hypot(x - px, z - pz) < 25 || this._onRoad(x, z)));
      const mesh = makePedMesh(rng);
      mesh.group.position.set(x, 0, z);
      this.scene.add(mesh.group);
      this.peds.push({
        mesh, x, z,
        heading: rng() * Math.PI * 2,
        speed: range(rng, 1.0, 1.8),
        panic: 0, // 0 calm .. 1 fleeing
        panicX: 0, panicZ: 0,
        down: false, downTimer: 0,
        walkPhase: rng() * 6,
      });
    }
  }

  _onRoad(x, z) {
    const rx = ((x + HALF) % BLOCK + BLOCK) % BLOCK;
    const rz = ((z + HALF) % BLOCK + BLOCK) % BLOCK;
    return Math.min(rx, BLOCK - rx) < ROAD_W / 2 + 1 || Math.min(rz, BLOCK - rz) < ROAD_W / 2 + 1;
  }

  ensure(px, pz) {
    this._timer -= 1 / 60;
    if (this.peds.length < 18 && this._timer <= 0) { this.spawn(px, pz, 2); this._timer = 0.5; }
  }

  panicAt(x, z, radius = 40) {
    for (const p of this.peds) {
      if (p.down) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < radius) {
        p.panic = 1;
        p.panicX = (p.x - x) / (d || 1);
        p.panicZ = (p.z - z) / (d || 1);
      }
    }
  }

  update(dt, px, pz) {
    this.ensure(px, pz);
    const rng = this.rng;
    for (let i = this.peds.length - 1; i >= 0; i--) {
      const p = this.peds[i];
      if (Math.hypot(p.x - px, p.z - pz) > 320) { this.scene.remove(p.mesh.group); this.peds.splice(i, 1); continue; }
      if (p.down) {
        p.downTimer -= dt;
        p.mesh.group.rotation.x = -Math.PI / 2;
        if (p.downTimer <= 0) { p.down = false; p.mesh.group.rotation.x = 0; p.panic = 1; }
        continue;
      }
      p.panic = Math.max(0, p.panic - dt * 0.12);
      const speed = p.panic > 0 ? 5.2 : p.speed;
      let hx, hz;
      if (p.panic > 0) { hx = p.panicX; hz = p.panicZ; }
      else {
        // Wander: mostly along sidewalks; occasionally change direction.
        if (rng() < dt * 0.25) p.heading += pick(rng, [-Math.PI / 2, Math.PI / 2, Math.PI]);
        hx = Math.sin(p.heading); hz = Math.cos(p.heading);
      }
      p.x = clamp(p.x + hx * speed * dt, -HALF, BEACH_X - 2);
      p.z = clamp(p.z + hz * speed * dt, -HALF, HALF);
      p.mesh.group.position.set(p.x, 0, p.z);
      p.mesh.group.rotation.y = Math.atan2(hx, hz);
      // Walk cycle.
      p.walkPhase += dt * speed * 3.2;
      const s = Math.sin(p.walkPhase) * 0.5;
      p.mesh.legL.rotation.x = s; p.mesh.legR.rotation.x = -s;
      p.mesh.armL.rotation.x = -s * 0.8; p.mesh.armR.rotation.x = s * 0.8;
    }
  }

  knockDown(p) {
    p.down = true; p.downTimer = 6; p.panic = 0;
  }
}
