// Vice Rush 3D — vehicles: low-poly car meshes built from boxes, arcade
// driving physics, damage and explosions.
import * as THREE from 'three';
import { CAR_TYPES } from './config.js';
import { clamp } from './random.js';

const sharedGeo = {
  body: new THREE.BoxGeometry(1, 1, 1),
  wheel: new THREE.CylinderGeometry(0.42, 0.42, 0.32, 10).rotateZ(Math.PI / 2),
};
const sharedMat = {
  glass: new THREE.MeshLambertMaterial({ color: 0x1a2530 }),
  tyre: new THREE.MeshLambertMaterial({ color: 0x141414 }),
  lightF: new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffe9a0, emissiveIntensity: 0.7 }),
  lightB: new THREE.MeshLambertMaterial({ color: 0xff2e2e, emissive: 0xaa0000, emissiveIntensity: 0.6 }),
  white: new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }),
  blue: new THREE.MeshLambertMaterial({ color: 0x2f6fd0 }),
  red: new THREE.MeshLambertMaterial({ color: 0xd63031 }),
  taxiSign: new THREE.MeshLambertMaterial({ color: 0xf1c40f, emissive: 0xaa8800, emissiveIntensity: 0.5 }),
};
const bodyMats = {};

function bodyMat(color) {
  if (!bodyMats[color]) bodyMats[color] = new THREE.MeshLambertMaterial({ color });
  return bodyMats[color];
}

// Build a car mesh. Faces -Z when heading = 0 (forward = -Z of the group).
// Returns { group, wheels, headlights }.
export function makeCarMesh(typeName) {
  const t = CAR_TYPES[typeName] || CAR_TYPES.sedan;
  const g = new THREE.Group();
  const mat = bodyMat(t.body);
  const L = t.len, Wd = t.wid, H = t.h;

  const body = new THREE.Mesh(sharedGeo.body, mat);
  body.scale.set(Wd, H * 0.62, L);
  body.position.y = H * 0.45;
  body.castShadow = true;
  g.add(body);

  const cabin = new THREE.Mesh(sharedGeo.body, sharedMat.glass);
  cabin.scale.set(Wd * 0.82, H * 0.55, L * 0.45);
  cabin.position.set(0, H * 0.95, L * 0.05);
  cabin.castShadow = true;
  g.add(cabin);

  if (typeName === 'truck' || typeName === 'van') {
    const cargo = new THREE.Mesh(sharedGeo.body, mat);
    cargo.scale.set(Wd * 0.96, H * 1.15, L * 0.55);
    cargo.position.set(0, H * 0.95, L * 0.22);
    cargo.castShadow = true;
    g.add(cargo);
  }
  if (typeName === 'police') {
    const stripe = new THREE.Mesh(sharedGeo.body, sharedMat.white);
    stripe.scale.set(Wd * 1.01, H * 0.2, L * 0.9);
    stripe.position.set(0, H * 0.62, 0);
    g.add(stripe);
    const bar = new THREE.Mesh(sharedGeo.body, sharedMat.blue);
    bar.scale.set(Wd * 0.5, 0.22, 0.5);
    bar.position.set(-Wd * 0.2, H * 1.32, L * 0.05);
    g.add(bar);
    const bar2 = new THREE.Mesh(sharedGeo.body, sharedMat.red);
    bar2.scale.set(Wd * 0.5, 0.22, 0.5);
    bar2.position.set(Wd * 0.2, H * 1.32, L * 0.05);
    g.add(bar2);
  }
  if (typeName === 'taxi') {
    const sign = new THREE.Mesh(sharedGeo.body, sharedMat.taxiSign);
    sign.scale.set(0.9, 0.18, 0.4);
    sign.position.set(0, H * 1.35, L * 0.05);
    g.add(sign);
  }
  // Headlights / taillights.
  for (const sx of [-1, 1]) {
    const fl = new THREE.Mesh(sharedGeo.body, sharedMat.lightF);
    fl.scale.set(0.42, 0.22, 0.12);
    fl.position.set(sx * (Wd / 2 - 0.3), H * 0.5, -L / 2 - 0.02);
    g.add(fl);
    const bl = new THREE.Mesh(sharedGeo.body, sharedMat.lightB);
    bl.scale.set(0.42, 0.22, 0.12);
    bl.position.set(sx * (Wd / 2 - 0.3), H * 0.5, L / 2 + 0.02);
    g.add(bl);
  }
  // Wheels: steering wrapper (front) + spinning mesh (axle = X).
  const wheels = [];
  for (const [wx, wz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx * (Wd / 2 + 0.05), 0.42, wz * (L / 2 - 0.75));
    const w = new THREE.Mesh(sharedGeo.wheel, sharedMat.tyre);
    w.castShadow = true;
    pivot.add(w);
    g.add(pivot);
    wheels.push({ pivot, mesh: w, front: wz < 0 });
  }
  return { group: g, wheels, type: t };
}

export class Car {
  constructor(typeName, x, z, heading = 0) {
    this.typeName = typeName;
    this.def = CAR_TYPES[typeName];
    this.mesh = makeCarMesh(typeName);
    this.group = this.mesh.group;
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0;
    this.health = 120;
    this.steerVis = 0;
    this.driver = null; // 'player' | 'traffic' | 'police' | null (parked)
    this.dead = false;
    this.exploded = false;
    this.skid = 0;
    this.updateMesh();
  }
  updateMesh() {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
  }
  // Arcade drive step. throttle -1..1, steer -1..1, dt seconds.
  drive(throttle, steer, dt) {
    const def = this.def;
    const maxF = def.topSpeed, maxR = 12;
    if (throttle > 0) this.speed += def.accel * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= 38 * dt; // brake
      else this.speed += def.accel * 0.6 * throttle * dt; // reverse
    } else {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 14 * dt); // drag
    }
    this.speed = clamp(this.speed, -maxR, maxF);
    const steerAmount = steer * 2.1 * clamp(Math.abs(this.speed) / 8, 0, 1);
    this.heading += steerAmount * Math.sign(this.speed) * dt * -1;
    // Forward is -Z rotated by heading.
    const fx = -Math.sin(this.heading), fz = -Math.cos(this.heading);
    this.x += fx * this.speed * dt;
    this.z += fz * this.speed * dt;
    this.steerVis = steer;
    // Wheel spin + front-wheel steer visual.
    const spin = this.speed * dt * 2.4;
    this.mesh.wheels.forEach((w) => {
      w.mesh.rotation.x += spin;
      if (w.front) w.pivot.rotation.y = steer * 0.42;
    });
    this.updateMesh();
  }
  damage(amount) {
    this.health -= amount;
    if (this.health <= 0 && !this.exploded) { this.exploded = true; this.dead = true; return true; }
    return false;
  }
}
