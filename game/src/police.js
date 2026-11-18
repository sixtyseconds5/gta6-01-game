// Vice Rush 3D — the VCPD: cruisers that chase and ram, roadblocks at 3+
// stars, a searchlight helicopter at 4-5 stars, and on-foot cops who try to
// arrest you when the heat is high.
import * as THREE from 'three';
import { Car } from './vehicles.js';
import { BLOCK, HALF, BEACH_X } from './config.js';
import { mulberry32, range, clamp } from './random.js';

export class PoliceManager {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng || mulberry32(99);
    this.cruisers = [];
    this.cops = [];
    this.heli = null;
    this.heliLight = null;
    this._spawnTimer = 0;
    this._copTimer = 0;
    this.roadblock = null;
    this._blockTimer = 0;
  }

  wantedCruisers(stars) {
    return stars <= 0 ? 0 : stars === 1 ? 1 : stars === 2 ? 2 : stars === 3 ? 3 : 4;
  }

  update(dt, t, stars, px, pz, playerSpeed, playerInCar, onArrest, onRam) {
    // --- cruisers ---
    this._spawnTimer -= dt;
    const want = this.wantedCruisers(stars);
    if (this.cruisers.length < want && this._spawnTimer <= 0) {
      this._spawnTimer = 1.2;
      const a = this.rng() * Math.PI * 2;
      const car = new Car('police', px + Math.sin(a) * 70, pz + Math.cos(a) * 70, 0);
      car.driver = 'police';
      car.x = clamp(car.x, -HALF, BEACH_X - 8); car.z = clamp(car.z, -HALF, HALF);
      this.scene.add(car.group);
      this.cruisers.push(car);
    }
    for (let i = this.cruisers.length - 1; i >= 0; i--) {
      const car = this.cruisers[i];
      if (car.dead || stars === 0) { this.scene.remove(car.group); this.cruisers.splice(i, 1); continue; }
      // Chase: steer toward the player, ram at close range.
      const dx = px - car.x, dz = pz - car.z;
      const dist = Math.hypot(dx, dz) || 1;
      const targetHeading = Math.atan2(-dx, -dz); // heading so forward (-sin,-cos) points at player
      let dh = targetHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = clamp(dh * 1.6, -1, 1);
      const throttle = dist > 6 ? 1 : 0.6;
      car.drive(throttle, steer, dt);
      if (dist < 5.5 && onRam) onRam(car, dist);
    }

    // --- roadblock at 3+ stars: a line of cruisers across the road ahead ---
    this._blockTimer -= dt;
    if (stars >= 3 && !this.roadblock && this._blockTimer <= 0) {
      this._blockTimer = 25;
      const a = Math.atan2(px, pz);
      const bx = px + Math.sin(a) * 0 + 0, bz = pz;
      this.roadblock = [];
      for (let k = -1; k <= 1; k++) {
        const car = new Car('police', clamp(px + k * 5, -HALF, BEACH_X - 8), clamp(pz + 42, -HALF, HALF), Math.PI);
        car.driver = 'police';
        this.scene.add(car.group);
        this.roadblock.push(car);
      }
    }
    if (stars < 3 && this.roadblock) {
      for (const c of this.roadblock) this.scene.remove(c.group);
      this.roadblock = null;
    }

    // --- helicopter at 4-5 stars ---
    if (stars >= 4 && !this.heli) this._spawnHeli();
    if (stars < 4 && this.heli) {
      this.scene.remove(this.heli); this.scene.remove(this.heliLight.target);
      this.heli = null; this.heliLight = null;
    }
    if (this.heli) {
      let hx, hz;
      if (this.heliLock) { hx = px + this.heliLock.dx; hz = pz + this.heliLock.dz; }
      else { hx = px + Math.sin(t * 0.25) * 45; hz = pz + Math.cos(t * 0.2) * 45; }
      this.heli.position.set(hx, 30 + Math.sin(t * 0.8) * 2, hz);
      this.heli.rotation.y = Math.atan2(px - hx, pz - hz);
      this.heli.userData.rotor.rotation.y += dt * 14; // rotor spin
      this.heliLight.position.set(hx, 29, hz);
      this.heliLight.target.position.set(px, 0, pz);
      this.heliLight.target.updateMatrixWorld();
    }

    // --- on-foot cops try to arrest at 3+ stars ---
    this._copTimer -= dt;
    if (stars >= 3 && this.cops.length < stars - 1 && this._copTimer <= 0) {
      this._copTimer = 3;
      const a = this.rng() * Math.PI * 2;
      const cop = this._makeCop(px + Math.sin(a) * 24, pz + Math.cos(a) * 24);
      this.cops.push(cop);
    }
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const cop = this.cops[i];
      if (stars < 3) { this.scene.remove(cop.group); this.cops.splice(i, 1); continue; }
      const dx = px - cop.x, dz = pz - cop.z;
      const dist = Math.hypot(dx, dz) || 1;
      const speed = 4.6;
      cop.x += (dx / dist) * speed * dt;
      cop.z += (dz / dist) * speed * dt;
      cop.group.position.set(cop.x, 0, cop.z);
      cop.group.rotation.y = Math.atan2(dx, dz);
      cop.walkPhase += dt * 9;
      cop.legL.rotation.x = Math.sin(cop.walkPhase) * 0.6;
      cop.legR.rotation.x = -Math.sin(cop.walkPhase) * 0.6;
      if (dist < 1.6 && !playerInCar && onArrest) onArrest(cop);
    }
  }

  _makeCop(x, z) {
    const g = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x1f3a93 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x14181f });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe0ac69 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.9, 0.38), navy);
    body.position.y = 1.05; body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
    head.position.y = 1.74;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.12, 10), dark);
    cap.position.y = 1.94;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.26), dark);
    legL.position.set(-0.16, 0.31, 0);
    const legR = legL.clone(); legR.position.x = 0.16;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), navy);
    armL.position.set(-0.44, 1.05, 0);
    const armR = armL.clone(); armR.position.x = 0.44;
    g.add(body, head, cap, legL, legR, armL, armR);
    g.position.set(x, 0, z);
    this.scene.add(g);
    return { group: g, x, z, legL, legR, walkPhase: 0 };
  }

  _spawnHeli() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xdfe6ea }); // white VCPD livery
    const blue = new THREE.MeshLambertMaterial({ color: 0x2f6fd0 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.6), bodyMat);
    body.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.4, 4.0), blue);
    stripe.position.y = 0.2;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.2), bodyMat);
    tail.position.set(0, 0.3, 3.8);
    // Visible searchlight cone so the beam reads in screenshots and in play.
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(6, 30, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }),
    );
    cone.rotation.x = Math.PI; // apex up at the heli, opening downward
    cone.position.y = -16;
    const rotor = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    rotor.add(blade);
    rotor.position.y = 1.0;
    const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 3.2), bodyMat);
    skidL.position.set(-0.9, -0.9, 0);
    const skidR = skidL.clone(); skidR.position.x = 0.9;
    g.add(body, stripe, tail, rotor, skidL, skidR, cone);
    g.userData.rotor = rotor;
    this.scene.add(g);
    this.heli = g;
    const light = new THREE.SpotLight(0xfff2b0, 900, 120, 0.32, 0.5, 1.2);
    light.position.set(0, 41, 0);
    light.target.position.set(0, 0, 0);
    this.scene.add(light); this.scene.add(light.target);
    this.heliLight = light;
  }

  clear() {
    for (const c of this.cruisers) this.scene.remove(c.group);
    this.cruisers = [];
    for (const c of this.cops) this.scene.remove(c.group);
    this.cops = [];
    if (this.roadblock) { for (const c of this.roadblock) this.scene.remove(c.group); this.roadblock = null; }
    if (this.heli) { this.scene.remove(this.heli); this.scene.remove(this.heliLight.target); this.heli = null; this.heliLight = null; }
  }
}
