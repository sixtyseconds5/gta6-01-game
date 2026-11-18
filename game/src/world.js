// Vice Rush 3D — procedural Vice City: street grid, districts, park, beach,
// animated water, low-poly buildings with canvas window textures, palms,
// lamps, billboards and props. All geometry is generated at runtime; no
// image files, no network.
import * as THREE from 'three';
import { BLOCK, GRID_N, HALF, ROAD_W, BEACH_X, WATER_X, DISTRICTS, PLACES, CITY_SEED } from './config.js';
import { mulberry32, pick, range, clamp } from './random.js';

const ROOF_COLORS = [0xb5674a, 0x8a7f8d, 0xc98f4e, 0x6f8fae, 0xa85f6e, 0x7d9b6a, 0x96705a, 0x4a6b8a, 0xd9a05b];
const WALL_COLORS = [0xe8d8c8, 0xd8c8b8, 0xc8b8a8, 0xb8c8d8, 0xd8b8c8, 0xc8d8b8, 0xe0c090, 0xa8b8c8];

function makeWindowTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e8e0d0'; g.fillRect(0, 0, 128, 256);
  for (let y = 12; y < 244; y += 22) {
    for (let x = 10; x < 118; x += 24) {
      const lit = Math.random() < 0.28;
      g.fillStyle = lit ? '#ffd98a' : '#2c3e50';
      g.fillRect(x, y, 16, 14);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x, y, 16, 3);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeGroundTexture() {
  const S = 1024;
  const minX = -HALF - 40, minZ = -HALF - 40;
  const w = (WATER_X + 40) - minX, h = (HALF + 40) - minZ;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d');
  const X = (x) => (x - minX) / w * S;
  const Z = (z) => (z - minZ) / h * S;
  const W = (m) => m / w * S;
  const H = (m) => m / h * S;

  g.fillStyle = '#6fae56'; g.fillRect(0, 0, S, S); // grass base
  // Park block (Sunset Park) — the one block with no buildings (block 2,0).
  g.fillStyle = '#4e8f3e';
  g.fillRect(X(-134.5), Z(-278.5), W(53), H(53));
  g.fillStyle = '#c9b896';
  g.fillRect(X(-111), Z(-278.5), W(6), H(53));
  g.fillRect(X(-134.5), Z(-255), W(53), H(6));
  // Sand strip at the east edge.
  g.fillStyle = '#e8d29a';
  g.fillRect(X(BEACH_X), Z(-HALF - 40), W(WATER_X + 40 - BEACH_X), H(HALF * 2 + 80));
  // Sidewalk slabs for each block.
  g.fillStyle = '#c9c2b4';
  for (let i = 0; i < GRID_N - 1; i++) {
    for (let j = 0; j < GRID_N - 1; j++) {
      const x0 = -HALF + i * BLOCK + ROAD_W / 2;
      const z0 = -HALF + j * BLOCK + ROAD_W / 2;
      if (x0 > BEACH_X - 4) continue; // beach blocks have no sidewalks
      g.fillRect(X(x0), Z(z0), W(BLOCK - ROAD_W), H(BLOCK - ROAD_W));
    }
  }
  // Roads (dark asphalt).
  g.fillStyle = '#3d3f45';
  for (let i = 0; i < GRID_N; i++) {
    const x = -HALF + i * BLOCK;
    const z = -HALF + i * BLOCK;
    g.fillRect(X(x - ROAD_W / 2), Z(-HALF - 40), W(ROAD_W), H(HALF * 2 + 80));
    g.fillRect(X(-HALF - 40), Z(z - ROAD_W / 2), W(WATER_X + 40 - (-HALF - 40)), H(ROAD_W));
  }
  // Centre dashed lines.
  g.fillStyle = '#e8d44d';
  for (let i = 0; i < GRID_N; i++) {
    const x = -HALF + i * BLOCK, z = -HALF + i * BLOCK;
    for (let d = -HALF - 30; d < HALF + 30; d += 18) {
      g.fillRect(X(x - 0.5), Z(d), W(1), H(9));
      g.fillRect(X(d), Z(z - 0.5), W(9), H(1));
    }
  }
  // Crosswalks at intersections.
  g.fillStyle = '#e8e8e8';
  for (let i = 0; i < GRID_N; i++) {
    for (let j = 0; j < GRID_N; j++) {
      const x = -HALF + i * BLOCK, z = -HALF + j * BLOCK;
      for (let k = -2; k <= 2; k++) {
        g.fillRect(X(x + k * 2.4 - 0.8), Z(z - ROAD_W / 2 - 1.2), W(1.6), H(2.4));
        g.fillRect(X(x + k * 2.4 - 0.8), Z(z + ROAD_W / 2 - 1.2), W(1.6), H(2.4));
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeWaterTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#1e7fa8'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
  for (let i = 0; i < 10; i++) {
    g.beginPath();
    const y = 8 + i * 13;
    g.moveTo(0, y);
    g.bezierCurveTo(30, y - 5, 60, y + 5, 128, y - 3);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 10);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeBillboardTexture(text, sub, bg, fg) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(8, 8, 496, 240);
  g.fillStyle = fg; g.textAlign = 'center';
  g.font = 'bold 64px Arial';
  g.fillText(text, 256, 120);
  g.font = 'bold 34px Arial';
  g.fillText(sub, 256, 190);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeSkyDome() {
  const geo = new THREE.SphereGeometry(1400, 24, 12);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x2e6fb8) },
      mid: { value: new THREE.Color(0xf7a05a) },
      bot: { value: new THREE.Color(0xffc98a) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
      void main(){ float h = normalize(vP).y; vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, h)) : mix(bot, mid, smoothstep(-0.05, 0.25, h)); gl_FragColor = vec4(c, 1.0); }`,
  });
  return new THREE.Mesh(geo, mat);
}

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return DISTRICTS[0];
}

export function buildWorld(scene) {
  const rng = mulberry32(CITY_SEED);
  const colliders = []; // {x0,z0,x1,z1}
  const dummy = new THREE.Object3D();

  // --- sky, fog, lights ---
  scene.add(makeSkyDome());
  scene.fog = new THREE.Fog(0xf2a05e, 120, 620);
  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x6a7a5a, 1.3);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a0, 1.9);
  sun.position.set(-150, 300, -90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -110; sun.shadow.camera.right = 110;
  sun.shadow.camera.top = 110; sun.shadow.camera.bottom = -110;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  scene.add(sun); scene.add(sun.target);
  // Sun disc low in the west.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(46, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9b0, fog: false }),
  );
  sunDisc.position.set(-1050, 190, -260);
  sunDisc.lookAt(0, 60, 0);
  scene.add(sunDisc);

  // --- ground ---
  const minX = -HALF - 40, w = (WATER_X + 40) - minX, h = (HALF + 40) - (-HALF - 40);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(minX + w / 2, 0, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  // --- water (animated) ---
  const waterTex = makeWaterTexture();
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(140, h + 80),
    new THREE.MeshLambertMaterial({ map: waterTex, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(WATER_X + 70, 0.25, 0);
  scene.add(water);

  // --- buildings (instanced) ---
  const windowTex = makeWindowTexture();
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0);
  const bMat = new THREE.MeshLambertMaterial({ map: windowTex });
  const placements = [];
  const parkBlock = { i: 2, j: 0 }; // Sunset Park block stays open
  for (let i = 0; i < GRID_N - 1; i++) {
    for (let j = 0; j < GRID_N - 1; j++) {
      if (i === parkBlock.i && j === parkBlock.j) continue;
      const bx0 = -HALF + i * BLOCK + ROAD_W / 2 + 3;
      const bz0 = -HALF + j * BLOCK + ROAD_W / 2 + 3;
      const bw = BLOCK - ROAD_W - 6, bd = BLOCK - ROAD_W - 6;
      if (bx0 > BEACH_X - 10) continue;
      const downtown = i < 3 && j < 3;
      const count = rng() < 0.45 ? 1 : (rng() < 0.6 ? 2 : 4);
      if (count === 1) {
        placements.push({ x: bx0 + bw / 2, z: bz0 + bd / 2, w: bw * range(rng, 0.7, 0.95), d: bd * range(rng, 0.7, 0.95), h: downtown ? range(rng, 30, 70) : range(rng, 10, 30) });
      } else if (count === 2) {
        const horiz = rng() < 0.5;
        for (let k = 0; k < 2; k++) {
          placements.push(horiz
            ? { x: bx0 + bw * (0.25 + 0.5 * k), z: bz0 + bd / 2, w: bw * 0.42, d: bd * 0.8, h: downtown ? range(rng, 22, 55) : range(rng, 8, 24) }
            : { x: bx0 + bw / 2, z: bz0 + bd * (0.25 + 0.5 * k), w: bw * 0.8, d: bd * 0.42, h: downtown ? range(rng, 22, 55) : range(rng, 8, 24) });
        }
      } else {
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
          placements.push({ x: bx0 + bw * (0.25 + 0.5 * a), z: bz0 + bd * (0.25 + 0.5 * b), w: bw * 0.4, d: bd * 0.4, h: downtown ? range(rng, 14, 40) : range(rng, 7, 18) });
        }
      }
    }
  }
  const buildings = new THREE.InstancedMesh(bGeo, bMat, placements.length);
  const col = new THREE.Color();
  placements.forEach((p, idx) => {
    dummy.position.set(p.x, 0, p.z);
    dummy.scale.set(p.w, p.h, p.d);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    buildings.setMatrixAt(idx, dummy.matrix);
    col.setHex(pick(rng, WALL_COLORS));
    buildings.setColorAt(idx, col);
    colliders.push({ x0: p.x - p.w / 2, z0: p.z - p.d / 2, x1: p.x + p.w / 2, z1: p.z + p.d / 2 });
  });
  buildings.castShadow = true; buildings.receiveShadow = true;
  scene.add(buildings);

  // Rooftop AC boxes (instanced, one per building, random subset).
  const roofGeo = new THREE.BoxGeometry(1, 1, 1);
  roofGeo.translate(0, 0.5, 0);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x8a8f94 });
  const roofCount = placements.length;
  const roofs = new THREE.InstancedMesh(roofGeo, roofMat, roofCount);
  placements.forEach((p, idx) => {
    dummy.position.set(p.x + range(rng, -p.w / 4, p.w / 4), p.h, p.z + range(rng, -p.d / 4, p.d / 4));
    dummy.scale.set(range(rng, 2, 5), range(rng, 0.8, 1.6), range(rng, 2, 5));
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    roofs.setMatrixAt(idx, dummy.matrix);
  });
  roofs.castShadow = true;
  scene.add(roofs);

  // --- palm trees (instanced trunks + crowns) along the beach and park ---
  const palmSpots = [];
  for (let z = -HALF + 20; z < HALF - 10; z += 26) {
    palmSpots.push({ x: BEACH_X + 8 + range(rng, -3, 3), z });
    palmSpots.push({ x: BEACH_X + 22 + range(rng, -3, 3), z: z + 13 });
  }
  for (let k = 0; k < 14; k++) palmSpots.push({ x: range(rng, -30, 130), z: range(rng, -HALF + 20, -HALF + 130) });
  for (let k = 0; k < 8; k++) palmSpots.push({ x: range(rng, -HALF + 20, HALF - 140), z: range(rng, -HALF + 20, HALF - 20) });
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 7, 6);
  trunkGeo.translate(0, 3.5, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const crownGeo = new THREE.ConeGeometry(2.6, 3.2, 6);
  crownGeo.translate(0, 8.2, 0);
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2e8b3a });
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, palmSpots.length);
  palmSpots.forEach((p, idx) => {
    const lean = range(rng, -0.08, 0.08);
    dummy.position.set(p.x, 0, p.z); dummy.scale.set(1, range(rng, 0.85, 1.25), 1);
    dummy.rotation.set(lean, rng() * Math.PI * 2, lean);
    dummy.updateMatrix();
    trunks.setMatrixAt(idx, dummy.matrix);
    crowns.setMatrixAt(idx, dummy.matrix);
  });
  trunks.castShadow = true; crowns.castShadow = true;
  scene.add(trunks); scene.add(crowns);

  // --- street lamps (instanced) along every road ---
  const lampSpots = [];
  for (let i = 0; i < GRID_N; i++) {
    for (let d = -HALF + 18; d < HALF - 10; d += 36) {
      lampSpots.push({ x: -HALF + i * BLOCK + ROAD_W / 2 + 1.2, z: d });
      lampSpots.push({ x: d, z: -HALF + i * BLOCK + ROAD_W / 2 + 1.2 });
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6.5, 5);
  poleGeo.translate(0, 3.25, 0);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
  const headGeo = new THREE.SphereGeometry(0.35, 8, 6);
  const headMat = new THREE.MeshLambertMaterial({ color: 0xffd98a, emissive: 0xffb347, emissiveIntensity: 0.9 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, lampSpots.length);
  lampSpots.forEach((p, idx) => {
    dummy.position.set(p.x, 0, p.z); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix(); poles.setMatrixAt(idx, dummy.matrix);
    dummy.position.set(p.x, 6.5, p.z); dummy.updateMatrix(); heads.setMatrixAt(idx, dummy.matrix);
  });
  scene.add(poles); scene.add(heads);

  // --- billboards with original text ---
  const boards = [
    { text: 'VICE RUSH', sub: 'NEON PALMS HOTEL', bg: '#ff2e88', fg: '#ffffff', x: -HALF + 2 * BLOCK, z: -HALF + 5 * BLOCK, ry: Math.PI / 2 },
    { text: 'SUNSET COLA', sub: 'TASTE THE SUNSET', bg: '#ff6b35', fg: '#fff3d6', x: HALF - 3 * BLOCK, z: -HALF + 2 * BLOCK, ry: 0 },
    { text: 'OCEAN DRIVE', sub: 'BEACH • CLUBS • NEON', bg: '#0f7b8a', fg: '#ffe66d', x: HALF - 2 * BLOCK, z: HALF - 3 * BLOCK, ry: -Math.PI / 2 },
    { text: 'HAVANA BEATS', sub: 'CALLE OCHO • ALL NIGHT', bg: '#e17055', fg: '#fff3d6', x: -HALF + 5 * BLOCK, z: HALF - 2 * BLOCK, ry: Math.PI },
    { text: 'VCPD', sub: 'STAY SAFE, VICE CITY', bg: '#2f6fd0', fg: '#ffffff', x: -HALF + 4 * BLOCK, z: -HALF + 4 * BLOCK, ry: Math.PI / 2 },
    { text: 'COMET GT', sub: '0–100 IN 3.1 SECONDS', bg: '#1c1f26', fg: '#f1c40f', x: HALF - 4 * BLOCK, z: HALF - 5 * BLOCK, ry: 0 },
  ];
  const postGeo = new THREE.BoxGeometry(0.5, 9, 0.5);
  const postMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  for (const b of boards) {
    const grp = new THREE.Group();
    const tex = makeBillboardTexture(b.text, b.sub, b.bg, b.fg);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
    board.position.y = 12; board.castShadow = true;
    grp.add(board);
    for (const px of [-5, 5]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(px, 4.5, 0); grp.add(post);
    }
    grp.position.set(b.x, 0, b.z);
    grp.rotation.y = b.ry;
    scene.add(grp);
    colliders.push({ x0: b.x - 1, z0: b.z - 1, x1: b.x + 1, z1: b.z + 1 });
  }

  // --- props: hydrants + benches (instanced) ---
  const hydGeo = new THREE.CylinderGeometry(0.28, 0.32, 0.8, 8);
  hydGeo.translate(0, 0.4, 0);
  const hydMat = new THREE.MeshLambertMaterial({ color: 0xc0392b });
  const hydSpots = [];
  for (let k = 0; k < 40; k++) {
    hydSpots.push({ x: range(rng, -HALF + 10, BEACH_X - 10), z: range(rng, -HALF + 10, HALF - 10) });
  }
  const hyds = new THREE.InstancedMesh(hydGeo, hydMat, hydSpots.length);
  hydSpots.forEach((p, idx) => { dummy.position.set(p.x, 0, p.z); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); hyds.setMatrixAt(idx, dummy.matrix); });
  scene.add(hyds);

  // --- clouds ---
  const clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xfff2e0, transparent: true, opacity: 0.85 });
  for (let k = 0; k < 12; k++) {
    const cl = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), cloudMat);
    cl.scale.set(range(rng, 18, 42), range(rng, 4, 8), range(rng, 10, 20));
    cl.position.set(range(rng, -600, 600), range(rng, 110, 190), range(rng, -600, 600));
    scene.add(cl); clouds.push(cl);
  }

  // Mission / place markers: glowing beacon pillars + ground rings.
  const placeMeshes = {};
  for (const [key, p] of Object.entries(PLACES)) {
    const grp = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3.0, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 30;
    grp.add(ring); grp.add(beam);
    grp.position.set(p.x, 0, p.z);
    grp.visible = false;
    scene.add(grp);
    placeMeshes[key] = grp;
  }

  return {
    colliders,
    districtAt,
    placeMeshes,
    update(dt, t, playerPos) {
      waterTex.offset.x += dt * 0.015;
      waterTex.offset.y += dt * 0.008;
      water.position.y = 0.25 + Math.sin(t * 0.7) * 0.06;
      for (const cl of clouds) { cl.position.x += dt * 1.2; if (cl.position.x > 700) cl.position.x = -700; }
      // Shadow frustum follows the player for crisp shadows.
      if (playerPos) {
        sun.position.set(playerPos.x - 150, 300, playerPos.z - 90);
        sun.target.position.set(playerPos.x, 0, playerPos.z);
        sun.target.updateMatrixWorld();
      }
    },
  };
}

// Circle (player/car) vs building AABB push-out. Returns corrected position.
export function collideCircle(colliders, x, z, radius) {
  for (const c of colliders) {
    const nx = clamp(x, c.x0, c.x1);
    const nz = clamp(z, c.z0, c.z1);
    const dx = x - nx, dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * radius;
        z = nz + (dz / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const px = Math.min(x - c.x0, c.x1 - x);
        const pz = Math.min(z - c.z0, c.z1 - z);
        if (px < pz) x = (x - c.x0 < c.x1 - x) ? c.x0 - radius : c.x1 + radius;
        else z = (z - c.z0 < c.z1 - z) ? c.z0 - radius : c.z1 + radius;
      }
    }
  }
  return { x, z };
}

export { ROOF_COLORS };
