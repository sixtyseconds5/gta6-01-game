// Vice Rush 3D — boot + game loop: third-person player and car control,
// chase camera, wanted heat, interactions (steal, shop, garage), BUSTED /
// WASTED flow, and wiring for every system.
import * as THREE from 'three';
import { BLOCK, HALF, BEACH_X, WATER_X, PLAYER, CAR, WANTED, WEAPONS, PLACES, DISTRICTS } from './config.js';
import { mulberry32, clamp, lerp, dist2 } from './random.js';
import { buildWorld, collideCircle, districtAt } from './world.js';
import { Car } from './vehicles.js';
import { TrafficManager } from './traffic.js';
import { PedestrianManager } from './pedestrians.js';
import { PoliceManager } from './police.js';
import { Combat } from './combat.js';
import { MissionManager } from './missions.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { loadSave, saveGame } from './save.js';
import { stageShot, refreshShotHud } from './shots.js';

const rng = mulberry32(20261118);

export class Game {
  constructor() {
    this.state = 'title'; // title | playing | paused | busted | wasted
    this.cash = 250;
    this.respect = 0;
    this.wanted = 0;
    this.lastCrimeAt = -100;
    this._decayTimer = 0;
    this.health = PLAYER.maxHealth;
    this.missionIndex = 0;
    this.weapons = [{ name: 'pistol', ammo: WEAPONS.pistol.ammo }];
    this.weaponIndex = 0;
    this._fireCooldown = 0;
    this._shotWantedTimer = 0;
    this._shake = 0;
    this._elapsed = 0;
    this._nearCar = null;
    this._nearInteract = null;

    const container = document.getElementById('game-container');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(0, 8, 20);

    this.world = buildWorld(this.scene);
    this.input = new Input(this.renderer.domElement);
    this.audio = new AudioEngine();
    this.hud = new HUD();
    this.traffic = new TrafficManager(this.scene, this.world.colliders, mulberry32(777));
    this.peds = new PedestrianManager(this.scene, mulberry32(4242));
    this.police = new PoliceManager(this.scene, mulberry32(99));
    this.combat = new Combat(this.scene);
    this.missions = new MissionManager(this);
    this.missions.index = 0;

    this._buildPlayer();
    this._buildParkedCars();
    this._spawnPickups();
    this._wireHud();
    this._wireKeys();
    this.combat.onPickup = (p) => this._onPickup(p);

    this.camYaw = Math.PI; // camera looks north (-Z) by default
    this.camPitch = 0.32;
    this._camYawOffset = 0;
    this.player = {
      x: PLACES.hideout.x, z: PLACES.hideout.z, y: 0,
      heading: 0, vy: 0, grounded: true,
      car: null, speed: 0,
    };
    this._placePlayerMesh();

    window.addEventListener('resize', () => this._onResize());
    this._onResize();
    this._clock = new THREE.Clock();
    this._frames = 0;
    this._loop = this._loop.bind(this);
    this.renderer.setAnimationLoop(this._loop);

    // Screenshot staging: ?shot=chase|drive|foot|mission
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    this._shotName = shot;
    if (shot) {
      this.hud.sticky = true; // dialogue + toast stay on screen for the shot
      this.startNewGame();
      setTimeout(() => {
        stageShot(this, shot);
        // SwiftShader frames are slow, so readiness is time-based, not
        // frame-count based; re-show the dialogue/toast right before the
        // signal so they are on screen when the screenshot is taken.
        setTimeout(() => {
          refreshShotHud(this, shot);
          window.__shotReady = true;
        }, 8000);
      }, 400);
    } else {
      const save = loadSave();
      this.hud.setSaveAvailable(!!save);
      this.hud.show('title');
    }
  }

  // --- setup ---
  _buildPlayer() {
    const g = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0x2ecc71 });
    const jeans = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe0ac69 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.85, 0.38), jacket);
    body.position.y = 1.05; body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skin);
    head.position.y = 1.74; head.castShadow = true;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark);
    hair.position.y = 1.78;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.26), jeans);
    legL.position.set(-0.16, 0.31, 0);
    const legR = legL.clone(); legR.position.x = 0.16;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), jacket);
    armL.position.set(-0.44, 1.05, 0);
    const armR = armL.clone(); armR.position.x = 0.44;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.55), dark);
    gun.position.set(0.3, 1.15, -0.35);
    g.add(body, head, hair, legL, legR, armL, armR, gun);
    this.playerMesh = g;
    this._pLegL = legL; this._pLegR = legR; this._pArmL = armL; this._pArmR = armR; this._pGun = gun;
    this.scene.add(g);
  }

  _buildParkedCars() {
    this.parkedCars = [];
    // All parked on roads or the beach, never inside a building block.
    const spots = [
      ['sedan', PLACES.hideout.x, PLACES.hideout.z + 12, 0.6],
      ['sports', PLACES.dropoff.x, PLACES.dropoff.z - 12, -1.2],
      ['taxi', PLACES.shop.x, PLACES.shop.z + 12, 2.4],
      ['coupe', PLACES.safehouse.x, PLACES.safehouse.z - 12, 1.0],
      ['sedan', -HALF + 2 * BLOCK, -HALF + 3 * BLOCK, 0],
      ['van', HALF - 3 * BLOCK, HALF - BLOCK, 1.57],
      ['sports', BEACH_X + 8, -HALF + 3 * BLOCK, 3.14],
      ['truck', HALF - 3 * BLOCK, HALF - 3 * BLOCK, -0.8],
    ];
    for (const [type, x, z, h] of spots) {
      const car = new Car(type, x, z, h);
      car.driver = null;
      this.scene.add(car.group);
      this.parkedCars.push(car);
    }
  }

  _spawnPickups() {
    // Weapon pickups on the road by the hideout and the shop.
    this.combat.spawnPickup('weapon', PLACES.hideout.x + 3, PLACES.hideout.z - 8, 'smg');
    this.combat.spawnPickup('weapon', PLACES.shop.x - 3, PLACES.shop.z + 8, 'shotgun');
    this.combat.spawnPickup('health', PLACES.safehouse.x + 3, PLACES.safehouse.z - 8, 50);
    this.combat.spawnPickup('ammo', PLACES.hideout.x - 3, PLACES.hideout.z + 8, 1);
    this.combat.spawnPickup('health', PLACES.park.x + 4, PLACES.park.z + 4, 50);
    this.combat.spawnPickup('cash', PLACES.plaza.x + 6, PLACES.plaza.z - 6, 100);
  }

  _wireHud() {
    this.hud.onNewGame = () => { this.audio.ensure(); this.startNewGame(); };
    this.hud.onContinue = () => { this.audio.ensure(); this.startContinue(); };
    this.hud.onResume = () => { this.audio.ensure(); this.resume(); };
    this.hud.onRestart = () => { this.audio.ensure(); this.respawn(); };
  }

  _wireKeys() {
    this.input.onKey = (code) => {
      if (this.state !== 'playing') {
        if (code === 'Enter' && this.state === 'title') this.startNewGame();
        return;
      }
      this.audio.ensure();
      if (code === 'KeyM') {
        const muted = this.audio.toggleMute();
        this.hud.setRadio(this.audio.currentStation().name, this.audio.currentStation().track, muted);
      }
      if (code === 'KeyR' || code === 'KeyQ') {
        const st = this.audio.nextStation();
        this.hud.setRadio(st.name, st.track, this.audio.muted);
        this.hud.showToast(`Radio: ${st.name} — ${st.track}`);
      }
      if (code === 'KeyJ') this.missions.requestStart();
      if (code === 'KeyP') this.pause();
      if (code === 'Digit1') this.weaponIndex = 0;
      if (code === 'Digit2' && this.weapons[1]) this.weaponIndex = 1;
      if (code === 'Digit3' && this.weapons[2]) this.weaponIndex = 2;
      if (code === 'KeyE') this._interact();
    };
  }

  // --- game flow ---
  startNewGame() {
    this.cash = 250; this.respect = 0; this.wanted = 0; this.health = PLAYER.maxHealth;
    this.missionIndex = 0; this.missions.index = 0; this.missions.active = null;
    this.weapons = [{ name: 'pistol', ammo: WEAPONS.pistol.ammo }];
    this.weaponIndex = 0;
    this.player.x = PLACES.hideout.x; this.player.z = PLACES.hideout.z; this.player.y = 0;
    this.player.car = null;
    this.police.clear();
    this.combat.clearEnemies();
    this.state = 'playing';
    this.hud.show('game');
    this.hud.setMission('Welcome to Vice City', 'Press J to start your first job from Rico.', 0, 0);
    this.hud.showDialogue('Rico', 'Vic! You\u2019re out. Fresh start, fresh city. Press J when you want work — I\u2019ve got six jobs with your name on them.');
    this._syncHud();
    this.audio.ensure();
    this.hud.setRadio(this.audio.currentStation().name, this.audio.currentStation().track, this.audio.muted);
  }

  startContinue() {
    const save = loadSave();
    this.startNewGame();
    if (!save) return;
    this.cash = save.cash ?? 250;
    this.respect = save.respect ?? 0;
    this.missionIndex = save.missionIndex ?? 0;
    this.missions.index = this.missionIndex;
    this.health = save.health ?? PLAYER.maxHealth;
    if (typeof save.x === 'number') { this.player.x = save.x; this.player.z = save.z; }
    this.hud.showToast(`Welcome back, Vic. Job ${Math.min(this.missionIndex + 1, 6)}/6 — press J when ready.`);
    this._syncHud();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.hud.show('pause');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.hud.show('game');
  }

  respawn() {
    // After BUSTED / WASTED: wake up at the hideout, lighter in the pocket.
    const loss = this.state === 'wasted' ? 0.2 : 0.1;
    this.cash = Math.max(0, Math.floor(this.cash * (1 - loss)));
    this.health = PLAYER.maxHealth;
    this.wanted = 0;
    this.lastCrimeAt = -100;
    this.police.clear();
    if (this.player.car) { this.player.car.driver = null; this.parkedCars.push(this.player.car); this.player.car = null; }
    this.player.x = PLACES.hideout.x; this.player.z = PLACES.hideout.z; this.player.y = 0;
    this.playerMesh.visible = true;
    this.state = 'playing';
    this.hud.show('game');
    this._syncHud();
    this.hud.showToast('You wake up at the hideout. The city is still out there.');
  }

  saveProgress() {
    this.missionIndex = this.missions.index;
    saveGame({
      cash: this.cash, missionIndex: this.missionIndex, respect: this.respect,
      playerX: this.player.x, playerZ: this.player.z, health: this.health,
    });
  }

  teleportPlayer(x, z) {
    this.player.x = x; this.player.z = z; this.player.y = 0;
    if (this.player.car) { this.player.car.x = x; this.player.car.z = z; this.player.car.updateMesh(); }
    this._placePlayerMesh();
  }

  // --- economy / heat ---
  addCash(n) { this.cash += n; this.hud.setCash(this.cash); }
  addRespect(n) { this.respect += n; this.hud.setRespect(this.respect); }

  addWanted(n, set = false) {
    this.wanted = set ? n : clamp(this.wanted + n, 0, WANTED.maxStars);
    this.lastCrimeAt = this._elapsed;
    this._decayTimer = 0;
    this.hud.setWanted(this.wanted);
    this.audio.setSiren(this.wanted >= 1);
  }

  damagePlayer(amount) {
    if (this.state !== 'playing') return;
    this.health -= amount;
    this.hud.flashDamage();
    this._shake = Math.min(1, this._shake + 0.35);
    if (this.health <= 0) {
      this.health = 0;
      this.state = 'wasted';
      this.audio.setSiren(false);
      this.hud.show('wasted');
      if (document.pointerLockElement) document.exitPointerLock();
    }
    this._syncHud();
  }

  // --- interactions ---
  _nearestCar(maxDist = 4.2) {
    const px = this.player.x, pz = this.player.z;
    let best = null, bestD = maxDist;
    const all = [...this.parkedCars, ...this.traffic.cars, ...this.police.cruisers];
    for (const c of all) {
      if (c.dead) continue;
      const d = Math.hypot(c.x - px, c.z - pz);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  _interact() {
    if (this.player.car) { this._exitCar(); return; }
    // Compute live, not from the per-frame cache: a keypress can land
    // between frames, right after the player moved.
    const car = this._nearestCar();
    if (car) { this._enterCar(car); return; }
    const p = this.player;
    if (Math.hypot(p.x - PLACES.shop.x, p.z - PLACES.shop.z) < 6) {
      if (this.cash >= 50) {
        this.cash -= 50;
        for (const w of this.weapons) w.ammo += WEAPONS[w.name].ammo;
        this.hud.showToast('Ammo-Nation: all weapons restocked. -$50');
        this.audio.pickup();
      } else this.hud.showToast('Not enough cash — ammo costs $50.');
    } else if (Math.hypot(p.x - PLACES.safehouse.x, p.z - PLACES.safehouse.z) < 6) {
      if (this.cash >= 100) {
        this.cash -= 100;
        this.health = PLAYER.maxHealth;
        this.hud.showToast('Sunset Garage: patched up and feeling fresh. -$100');
        this.audio.pickup();
      } else this.hud.showToast('Garage service costs $100.');
    }
    this._syncHud();
  }

  _enterCar(car) {
    // Steal: traffic drivers get out, the car is yours now.
    if (car.driver === 'traffic') {
      const idx = this.traffic.cars.indexOf(car);
      if (idx >= 0) this.traffic.cars.splice(idx, 1);
      this.addWanted(1);
      this.hud.showToast(`Stole a ${car.def.label}! The VCPD noticed.`);
    } else if (car.driver === 'police') {
      this.addWanted(2);
      this.hud.showToast('You jacked a police cruiser! Bad idea, great story.');
    }
    car.driver = 'player';
    const idx = this.parkedCars.indexOf(car);
    if (idx >= 0) this.parkedCars.splice(idx, 1);
    this.player.car = car;
    this.playerMesh.visible = false;
    this.audio.click();
  }

  _exitCar() {
    const car = this.player.car;
    if (!car) return;
    car.driver = null;
    car.speed = 0;
    this.player.car = null;
    // Step out to the side of the car.
    const sx = -Math.cos(car.heading), sz = Math.sin(car.heading);
    this.player.x = car.x + sx * 2.6;
    this.player.z = car.z + sz * 2.6;
    this.player.y = 0;
    this.parkedCars.push(car);
    this.playerMesh.visible = true;
    this._placePlayerMesh();
  }

  _onPickup(p) {
    if (p.kind === 'health') {
      this.health = clamp(this.health + p.amount, 0, PLAYER.maxHealth);
      this.hud.showToast(`+${p.amount} health`);
    } else if (p.kind === 'ammo') {
      for (const w of this.weapons) w.ammo += 40;
      this.hud.showToast('+40 ammo');
    } else if (p.kind === 'cash') {
      this.addCash(p.amount);
      this.hud.showToast(`+$${p.amount} cash`);
    } else if (p.kind === 'weapon') {
      const name = p.amount;
      if (!this.weapons.find((w) => w.name === name)) {
        this.weapons.push({ name, ammo: WEAPONS[name].ammo });
        this.hud.showToast(`Picked up the ${WEAPONS[name].label}! Press ${this.weapons.length} to use it.`);
      } else {
        const w = this.weapons.find((w2) => w2.name === name);
        w.ammo += WEAPONS[name].ammo;
        this.hud.showToast(`+${WEAPONS[name].ammo} ${WEAPONS[name].label} ammo`);
      }
    }
    this.audio.pickup();
    this._syncHud();
  }

  // --- per-frame ---
  _loop() {
    const dt = Math.min(this._clock.getDelta(), 0.05);
    this._elapsed += dt;
    this._frames++;
    if (this.state === 'playing') this._update(dt);
    // World ambience keeps moving even on menus.
    this.world.update(dt, this._elapsed, this.state === 'playing' ? this.player : null);
    this.renderer.render(this.scene, this.camera);
  }

  _update(dt) {
    const input = this.input;
    const p = this.player;
    const { dx, dy } = input.consumeMouse();
    this.camYaw -= dx * 0.0028;
    this.camPitch = clamp(this.camPitch + dy * 0.0022, -0.15, 1.1);

    // --- wanted decay ---
    if (this.wanted > 0 && this._elapsed - this.lastCrimeAt > WANTED.decayDelay) {
      this._decayTimer += dt;
      if (this._decayTimer >= WANTED.decayStep) {
        this._decayTimer = 0;
        this.wanted--;
        this.hud.setWanted(this.wanted);
        if (this.wanted === 0) this.audio.setSiren(false);
      }
    }

    if (p.car) this._updateDriving(dt);
    else this._updateOnFoot(dt);

    // --- interactions prompt ---
    this._nearCar = p.car ? null : this._nearestCar();
    this._nearInteract = null;
    if (!p.car) {
      if (Math.hypot(p.x - PLACES.shop.x, p.z - PLACES.shop.z) < 6) this._nearInteract = { kind: 'shop' };
      else if (Math.hypot(p.x - PLACES.safehouse.x, p.z - PLACES.safehouse.z) < 6) this._nearInteract = { kind: 'safehouse' };
    }
    if (this._nearCar) this.hud.setInteract(`E — Steal the ${this._nearCar.def.label}`);
    else if (this._nearInteract?.kind === 'shop') this.hud.setInteract('E — Ammo-Nation: restock ammo ($50)');
    else if (this._nearInteract?.kind === 'safehouse') this.hud.setInteract('E — Sunset Garage: heal + repair ($100)');
    else if (p.car) this.hud.setInteract('E — Get out');
    else this.hud.setInteract(null);

    // --- world systems ---
    this.traffic.update(dt, p.x, p.z);
    this.peds.update(dt, p.x, p.z);
    this.police.update(dt, this._elapsed, this.wanted, p.x, p.z, p.car ? Math.abs(p.car.speed) : 0, !!p.car,
      () => { // arrested
        this.state = 'busted';
        this.hud.show('busted');
        this.audio.setSiren(false);
        if (document.pointerLockElement) document.exitPointerLock();
      },
      (cruiser) => { // rammed by a cruiser
        if (p.car) { p.car.damage(8 * dt * 10); this._shake = Math.min(1, this._shake + 0.4); }
        else this.damagePlayer(6 * dt * 10);
      });
    this.combat.update(dt);
    this.combat.updatePickups(dt, this._elapsed, p.x, p.z);
    this.combat.updateEnemies(dt, p.x, p.z, p, (e, dist) => {
      // Rival crew shoots back.
      const from = new THREE.Vector3(e.x, 1.4, e.z);
      const to = new THREE.Vector3(p.x, 1.2, p.z);
      this.combat.spawnTracer(from, to, 0xff6b6b);
      if (dist < 30 && Math.random() < 0.55) this.damagePlayer(6 + Math.random() * 6);
    });
    this.missions.update(dt);

    // --- car vs world / peds ---
    if (p.car) this._carWorldCollisions(dt);
    else this._footTrafficCollisions(dt);

    // --- camera + HUD ---
    this._updateCamera(dt);
    this._syncHud(dt);
    this.hud.drawMinimap(p.x, p.z, p.car ? p.car.heading : p.heading,
      [...this.traffic.cars, ...this.parkedCars, ...this.police.cruisers],
      this.police.cruisers, this.combat.enemies);
    const d = districtAt(p.x, p.z);
    this.hud.showDistrict(d.name);
    if (this.missions.active?.timer !== null && this.missions.active) this.hud.setTimer(this.missions.active.timer);
    else this.hud.setTimer(null);

    // --- audio ---
    const speedNorm = p.car ? Math.abs(p.car.speed) / p.car.def.topSpeed : 0;
    this.audio.setEngine(speedNorm, !!p.car);
  }

  _updateOnFoot(dt) {
    const input = this.input;
    const p = this.player;
    const ax = input.axis();
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    // Move relative to camera yaw.
    const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
    let mx = (ax.x * cos - ax.z * sin);
    let mz = (ax.x * sin + ax.z * cos);
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }
    const moving = len > 0;
    p.x += mx * speed * dt;
    p.z += mz * speed * dt;
    // Jump + gravity.
    if (input.down('Space') && p.grounded) { p.vy = PLAYER.jumpSpeed; p.grounded = false; }
    p.vy -= 22 * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.grounded = true; }
    // Collide with buildings, clamp to the city.
    const fixed = collideCircle(this.world.colliders, p.x, p.z, PLAYER.radius);
    p.x = clamp(fixed.x, -HALF - 20, WATER_X - 2);
    p.z = clamp(fixed.z, -HALF - 20, HALF + 20);
    // Face movement direction, or face the camera when aiming.
    if (moving) p.heading = lerp(p.heading, Math.atan2(mx, mz), Math.min(1, dt * 12));
    if (input.mouseHeld || input.locked) p.heading = this.camYaw + Math.PI;
    this._placePlayerMesh(moving, dt);
    // Shooting.
    this._fireCooldown -= dt;
    this._shotWantedTimer -= dt;
    const wantShoot = input.mouseHeld || input.consumeClick();
    if (wantShoot && this._fireCooldown <= 0 && this.weapons[this.weaponIndex]) {
      this._fireCooldown = WEAPONS[this.weapons[this.weaponIndex].name].cooldown;
      this._shoot();
    }
    this.hud.el('crosshair').style.display = 'block';
  }

  _updateDriving(dt) {
    const input = this.input;
    const p = this.player;
    const car = p.car;
    const ax = input.axis();
    const throttle = ax.z < 0 ? 1 : ax.z > 0 ? -1 : 0;
    const steer = ax.x;
    car.drive(throttle, steer, dt);
    p.x = car.x; p.z = car.z;
    if (car.health <= 0 && !car.exploded) {
      car.exploded = true;
      this.combat.explosion(new THREE.Vector3(car.x, 1, car.z));
      this.audio.explosion();
      this.damagePlayer(45);
      this._exitCar();
      car.dead = true;
      this.scene.remove(car.group);
      return;
    }
    this.hud.el('crosshair').style.display = 'none';
  }

  _shoot() {
    const slot = this.weapons[this.weaponIndex];
    if (!slot || slot.ammo <= 0) { this.hud.showToast('Out of ammo — visit Ammo-Nation ($50).'); return; }
    slot.ammo--;
    const w = WEAPONS[slot.name];
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    // Muzzle position: gun tip in front of the player.
    const muzzle = new THREE.Vector3(this.player.x, 1.35, this.player.z)
      .add(new THREE.Vector3(-Math.sin(this.player.heading), 0, -Math.cos(this.player.heading)).multiplyScalar(0.8));
    const targets = [];
    for (const e of this.combat.enemies) {
      if (e.dead) continue;
      targets.push({ mesh: e.mesh, kind: 'person', dead: false, onHit: (dmg) => {
        if (this.combat.damageEnemy(e, dmg)) { this.addCash(50); this.combat.spawnPickup('cash', e.x, e.z, 50); }
      } });
    }
    for (const c of [...this.traffic.cars, ...this.parkedCars, ...this.police.cruisers]) {
      if (c.dead) continue;
      const isCop = c.driver === 'police';
      targets.push({ mesh: c.group, kind: 'car', dead: false, onHit: (dmg) => {
        if (c.damage(dmg)) {
          this.combat.explosion(new THREE.Vector3(c.x, 1, c.z));
          this.audio.explosion();
          this.scene.remove(c.group);
        }
        if (isCop) this.addWanted(1);
      } });
    }
    for (const pd of this.peds.peds) {
      if (pd.down) continue;
      targets.push({ mesh: pd.mesh.group, kind: 'person', dead: false, onHit: () => {
        this.peds.knockDown(pd);
        this.peds.panicAt(pd.x, pd.z, 30);
        this.addWanted(1);
      } });
    }
    for (const cop of this.police.cops) {
      targets.push({ mesh: cop.group, kind: 'person', dead: false, onHit: () => {
        this.scene.remove(cop.group);
        this.police.cops.splice(this.police.cops.indexOf(cop), 1);
        this.addWanted(2);
      } });
    }
    this.combat.shoot(muzzle, dir, slot.name, targets);
    this.combat.burst(muzzle, 'spark', 4);
    this.audio.shot();
    this._shake = Math.min(1, this._shake + 0.12);
    if (this._shotWantedTimer <= 0) { this.addWanted(1); this._shotWantedTimer = 6; }
    this.peds.panicAt(this.player.x, this.player.z, 45);
  }

  _carWorldCollisions(dt) {
    const car = this.player.car;
    const before = { x: car.x, z: car.z };
    const fixed = collideCircle(this.world.colliders, car.x, car.z, 1.7);
    const hitWall = Math.hypot(fixed.x - before.x, fixed.z - before.z) > 0.01;
    car.x = fixed.x; car.z = fixed.z;
    car.x = clamp(car.x, -HALF - 10, WATER_X - 2);
    car.z = clamp(car.z, -HALF - 10, HALF + 10);
    if (hitWall && Math.abs(car.speed) > 8) {
      car.speed *= -0.25;
      car.damage(12);
      this.audio.crash();
      this._shake = Math.min(1, this._shake + 0.5);
      this.peds.panicAt(car.x, car.z, 25);
    }
    // Car vs traffic / police cars.
    for (const other of [...this.traffic.cars, ...this.police.cruisers]) {
      if (other.dead || other === car) continue;
      const d = Math.hypot(other.x - car.x, other.z - car.z);
      if (d < 3.4 && d > 0.01) {
        const push = (3.4 - d) / 2;
        const nx = (car.x - other.x) / d, nz = (car.z - other.z) / d;
        car.x += nx * push; car.z += nz * push;
        other.x -= nx * push; other.z -= nz * push;
        other.updateMesh();
        if (Math.abs(car.speed) > 6 || Math.abs(other.speed) > 6) {
          car.damage(6); other.damage(6);
          this.audio.crash();
          this._shake = Math.min(1, this._shake + 0.3);
        }
      }
    }
    // Car vs peds.
    for (const pd of this.peds.peds) {
      if (pd.down) continue;
      const d = Math.hypot(pd.x - car.x, pd.z - car.z);
      if (d < 2.0 && Math.abs(car.speed) > 3) {
        this.peds.knockDown(pd);
        this.peds.panicAt(pd.x, pd.z, 30);
        this.addWanted(1);
        this.audio.crash();
      }
    }
    car.updateMesh();
  }

  _footTrafficCollisions(dt) {
    const p = this.player;
    for (const car of [...this.traffic.cars, ...this.police.cruisers]) {
      if (car.dead) continue;
      const d = Math.hypot(car.x - p.x, car.z - p.z);
      if (d < 2.2 && Math.abs(car.speed) > 4) {
        this.damagePlayer(18);
        // Knock the player away from the car.
        const nx = (p.x - car.x) / (d || 1), nz = (p.z - car.z) / (d || 1);
        p.x += nx * 2; p.z += nz * 2;
        this.audio.crash();
      }
    }
  }

  _placePlayerMesh(moving = false, dt = 0) {
    const p = this.player;
    this.playerMesh.position.set(p.x, p.y, p.z);
    this.playerMesh.rotation.y = p.heading;
    if (moving) {
      const s = Math.sin(this._elapsed * 11) * 0.55;
      this._pLegL.rotation.x = s; this._pLegR.rotation.x = -s;
      this._pArmL.rotation.x = -s * 0.8; this._pArmR.rotation.x = s * 0.8;
    } else {
      this._pLegL.rotation.x = 0; this._pLegR.rotation.x = 0;
      this._pArmL.rotation.x = 0; this._pArmR.rotation.x = 0;
    }
  }

  _updateCamera(dt) {
    const p = this.player;
    let targetYaw, dist, height, lookY;
    if (p.car) {
      // Chase cam: behind the car, smoothed.
      const carYaw = p.car.heading;
      let dy = carYaw - this.camYaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.camYaw += dy * Math.min(1, dt * 2.2);
      targetYaw = this.camYaw;
      dist = 10.5; height = 4.2; lookY = 1.6;
      // Shot framing override (e.g. the chase cover: level the camera so
      // the helicopter and the sunset sky are in frame).
      if (this.shotCam) { dist = this.shotCam.dist; height = this.shotCam.height; lookY = this.shotCam.lookY; }
    } else {
      targetYaw = this.camYaw;
      dist = 6.5; height = 2.6; lookY = 1.5;
    }
    const cx = p.x + Math.sin(targetYaw) * dist;
    const cz = p.z + Math.cos(targetYaw) * dist;
    const cy = p.y + height + Math.sin(this.camPitch) * dist * 0.55;
    const look = new THREE.Vector3(p.x, p.y + lookY, p.z);
    this.camera.position.set(cx, cy, cz);
    if (this._shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this._shake * 0.5;
      this.camera.position.y += (Math.random() - 0.5) * this._shake * 0.4;
      this._shake = Math.max(0, this._shake - dt * 2.2);
    }
    this.camera.lookAt(look);
  }

  _syncHud(dt) {
    this.hud.setHealth(this.health, PLAYER.maxHealth);
    this.hud.setCash(this.cash);
    this.hud.setRespect(this.respect);
    this.hud.setWanted(this.wanted);
    this.hud.setWeapons(this.weapons, this.weaponIndex);
    if (this.player.car) {
      this.hud.setSpeed(Math.abs(this.player.car.speed) * 3.6, true);
      this.hud.setCarHealth(this.player.car.health, true);
    } else {
      this.hud.setSpeed(0, false);
      this.hud.setCarHealth(0, false);
    }
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

window.__viceGame = new Game();
