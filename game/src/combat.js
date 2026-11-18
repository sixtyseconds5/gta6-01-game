// Vice Rush 3D — combat: hitscan weapons (pistol / SMG / shotgun), tracers,
// muzzle flash, impact particles, pickups (health, ammo, cash) and the rival
// crew enemies used by the final mission.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { mulberry32, pick, range, clamp } from './random.js';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    this.particles = [];
    this.pickups = [];
    this.enemies = [];
    this._tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
    this._particleGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    this._particleMats = {
      spark: new THREE.MeshBasicMaterial({ color: 0xffd23f }),
      blood: new THREE.MeshBasicMaterial({ color: 0xc0392b }),
      smoke: new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.6 }),
      cash: new THREE.MeshBasicMaterial({ color: 0x2ecc71 }),
    };
    this._raycaster = new THREE.Raycaster();
  }

  // Fire a hitscan shot from `origin` along `dir`. `targets` is a list of
  // { mesh, radius, onHit, kind } hit-test objects. Returns the hit point.
  shoot(origin, dir, weaponName, targets) {
    const w = WEAPONS[weaponName];
    const pellets = w.pellets || 1;
    let endPoint = origin.clone().addScaledVector(dir, w.range);
    let hitAny = null;
    for (let p = 0; p < pellets; p++) {
      const d = dir.clone();
      d.x += (Math.random() - 0.5) * w.spread * 2;
      d.y += (Math.random() - 0.5) * w.spread * 2;
      d.z += (Math.random() - 0.5) * w.spread * 2;
      d.normalize();
      this._raycaster.set(origin, d);
      this._raycaster.far = w.range;
      const meshes = targets.filter((t) => !t.dead).map((t) => t.mesh);
      const hits = this._raycaster.intersectObjects(meshes, true);
      let hitPoint = origin.clone().addScaledVector(d, w.range);
      if (hits.length > 0) {
        const h = hits[0];
        hitPoint = h.point.clone();
        // Find which target owns this mesh.
        let obj = h.object;
        while (obj && !targets.some((t) => t.mesh === obj)) obj = obj.parent;
        const target = targets.find((t) => t.mesh === obj);
        if (target) {
          target.onHit(w.damage, hitPoint);
          this.burst(hitPoint, target.kind === 'person' ? 'blood' : 'spark', 6);
          if (!hitAny || h.distance < hitAny.distance) hitAny = { target, distance: h.distance, point: hitPoint };
        }
      }
      endPoint = hitPoint;
      this.spawnTracer(origin, hitPoint, w.tracer);
    }
    return { point: endPoint, hit: hitAny };
  }

  spawnTracer(from, to, color) {
    const len = from.distanceTo(to);
    const geo = new THREE.BoxGeometry(0.05, 0.05, len);
    const mat = new THREE.MeshBasicMaterial({ color });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(from).lerp(to, 0.5);
    m.lookAt(to);
    this.scene.add(m);
    this.tracers.push({ mesh: m, life: 0.07, max: 0.07 });
  }

  burst(pos, kind, n = 8) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this._particleGeo, this._particleMats[kind] || this._particleMats.spark);
      m.position.copy(pos);
      this.scene.add(m);
      const a = Math.random() * Math.PI * 2;
      this.particles.push({
        mesh: m, life: 0.5 + Math.random() * 0.3, max: 0.8,
        vx: Math.cos(a) * range(Math.random, 2, 6), vy: range(Math.random, 2, 6), vz: Math.sin(a) * range(Math.random, 2, 6),
      });
    }
  }

  explosion(pos, onDone) {
    this.burst(pos, 'spark', 26);
    this.burst(pos, 'smoke', 14);
    const light = new THREE.PointLight(0xffa040, 600, 40, 1.5);
    light.position.copy(pos).setY(2);
    this.scene.add(light);
    this.particles.push({ mesh: light, life: 0.5, max: 0.5, vx: 0, vy: 0, vz: 0, isLight: true });
    if (onDone) onDone();
  }

  // --- pickups ---
  spawnPickup(kind, x, z, amount = 1) {
    const colors = { health: 0x2ecc71, ammo: 0xf1c40f, cash: 0x27ae60, weapon: 0xe67e22 };
    const geo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    const mat = new THREE.MeshLambertMaterial({ color: colors[kind] || 0xffffff, emissive: colors[kind] || 0xffffff, emissiveIntensity: 0.4 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.6, z);
    mesh.rotation.y = Math.PI / 4;
    this.scene.add(mesh);
    // Floating label ring so pickups read at a glance.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.9, 24),
      new THREE.MeshBasicMaterial({ color: colors[kind], transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.06, z);
    this.scene.add(ring);
    this.pickups.push({ kind, mesh, ring, x, z, amount, spin: Math.random() * 6 });
  }

  updatePickups(dt, t, px, pz) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.mesh.rotation.y += dt * 2;
      p.mesh.position.y = 0.6 + Math.sin(t * 2.5 + p.spin) * 0.15;
      const d = Math.hypot(p.x - px, p.z - pz);
      if (d < 1.6) {
        this.scene.remove(p.mesh); this.scene.remove(p.ring);
        this.pickups.splice(i, 1);
        if (this.onPickup) this.onPickup(p);
      }
    }
  }

  // --- rival crew enemies (mission 6) ---
  spawnEnemy(x, z, health = 100) {
    const g = new THREE.Group();
    const red = new THREE.MeshLambertMaterial({ color: 0x8e1616 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc68642 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.9, 0.38), red);
    body.position.y = 1.05; body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
    head.position.y = 1.74;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.42), dark);
    band.position.y = 1.86;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.26), dark);
    legL.position.set(-0.16, 0.31, 0);
    const legR = legL.clone(); legR.position.x = 0.16;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7), dark);
    gun.position.set(0.4, 1.2, -0.3);
    g.add(body, head, band, legL, legR, gun);
    g.position.set(x, 0, z);
    this.scene.add(g);
    // Health bar above the head.
    const barBg = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.02), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    barBg.position.y = 2.25;
    const barFg = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.08, 0.03), new THREE.MeshBasicMaterial({ color: 0xe74c3c }));
    barFg.position.y = 2.25;
    g.add(barBg, barFg);
    const enemy = { mesh: g, barFg, x, z, health, maxHealth: health, dead: false, shootTimer: range(Math.random, 0.5, 2), walkPhase: 0 };
    this.enemies.push(enemy);
    return enemy;
  }

  updateEnemies(dt, px, pz, player, onEnemyShot) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = px - e.x, dz = pz - e.z;
      const dist = Math.hypot(dx, dz) || 1;
      // Strafe toward the player until in range, then shoot.
      if (dist > 14) {
        e.x += (dx / dist) * 3.4 * dt;
        e.z += (dz / dist) * 3.4 * dt;
        e.mesh.position.set(e.x, 0, e.z);
        e.walkPhase += dt * 8;
      }
      e.mesh.rotation.y = Math.atan2(dx, dz);
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < 42) {
        e.shootTimer = range(Math.random, 1.2, 2.4);
        if (onEnemyShot) onEnemyShot(e, dist);
      }
      e.barFg.scale.x = clamp(e.health / e.maxHealth, 0, 1);
      e.barFg.position.x = -(1 - e.barFg.scale.x) * 0.53;
    }
  }

  damageEnemy(e, amount) {
    e.health -= amount;
    if (e.health <= 0 && !e.dead) {
      e.dead = true;
      this.burst(new THREE.Vector3(e.x, 1.2, e.z), 'blood', 14);
      this.scene.remove(e.mesh);
      return true;
    }
    return false;
  }

  clearEnemies() {
    for (const e of this.enemies) if (!e.dead) this.scene.remove(e.mesh);
    this.enemies = [];
  }

  update(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      if (tr.life <= 0) { this.scene.remove(tr.mesh); tr.mesh.geometry.dispose(); tr.mesh.material.dispose(); this.tracers.splice(i, 1); }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.scene.remove(p.mesh); if (!p.isLight) p.mesh.geometry && p.mesh.geometry.dispose && 0; this.particles.splice(i, 1); continue; }
      if (p.isLight) { p.mesh.intensity = 600 * (p.life / p.max); continue; }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += (p.vy - 4 * dt) * dt * 10;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 12 * dt;
      p.mesh.rotation.x += dt * 6;
    }
  }
}
