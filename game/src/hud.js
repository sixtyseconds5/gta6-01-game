// Vice Rush 3D — HUD: DOM overlay (health, cash, wanted stars, weapon slots,
// mission panel, radio, speedometer, dialogue, district toasts) plus a live
// 2D-canvas minimap, and the title / pause / busted / wasted screens.
import { BLOCK, GRID_N, HALF, BEACH_X, WATER_X, DISTRICTS, WEAPONS } from './config.js';

const STAR_ON = '\u2605', STAR_OFF = '\u2606';

export class HUD {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.map = this.el('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.marker = null; // {x, z, label}
    this._dialogueTimer = null;
    this._toastTimer = null;
    this._districtTimer = null;
    this.sticky = false; // shot mode: dialogue/toast never auto-hide
    this._lastDistrict = null;
    this._flashTimer = null;
    this.onNewGame = null;
    this.onContinue = null;
    this.onResume = null;
    this.onRestart = null;
    this._wireButtons();
  }

  _wireButtons() {
    const bind = (id, fn) => { const b = this.el(id); if (b) b.addEventListener('click', () => fn && fn()); };
    bind('btn-new', () => this.onNewGame && this.onNewGame());
    bind('btn-continue', () => this.onContinue && this.onContinue());
    bind('btn-resume', () => this.onResume && this.onResume());
    bind('btn-restart', () => this.onRestart && this.onRestart());
    bind('btn-retry', () => this.onRestart && this.onRestart());
  }

  show(screen) {
    for (const s of ['title', 'pause', 'busted', 'wasted']) {
      const el = this.el(`screen-${s}`);
      if (el) el.style.display = s === screen ? 'flex' : 'none';
    }
    const hud = this.el('hud');
    if (hud) hud.style.display = screen === 'game' ? 'block' : 'none';
    const cross = this.el('crosshair');
    if (cross) cross.style.display = screen === 'game' ? 'block' : 'none';
  }

  setSaveAvailable(has) {
    const b = this.el('btn-continue');
    if (b) b.style.display = has ? 'inline-block' : 'none';
    const note = this.el('save-note');
    if (note) note.textContent = has ? 'Saved progress found — continue where you left off.' : 'No saved progress yet.';
  }

  setHealth(h, max) {
    const bar = this.el('health-fill');
    if (bar) { bar.style.width = `${Math.max(0, h / max * 100)}%`; bar.style.background = h > 50 ? '#2ecc71' : h > 25 ? '#f1c40f' : '#e74c3c'; }
    const txt = this.el('health-text');
    if (txt) txt.textContent = `${Math.ceil(Math.max(0, h))}`;
  }

  setCash(cash) { const el = this.el('cash'); if (el) el.textContent = `$${cash.toLocaleString('en-US')}`; }
  setRespect(r) { const el = this.el('respect'); if (el) el.textContent = `${r}`; }

  setWanted(stars) {
    const el = this.el('stars');
    if (el) {
      el.textContent = STAR_ON.repeat(stars) + STAR_OFF.repeat(5 - stars);
      el.classList.toggle('hot', stars >= 3);
    }
  }

  setWeapons(slots, current) {
    const el = this.el('weapons');
    if (!el) return;
    el.innerHTML = slots.map((s, i) => {
      const w = WEAPONS[s.name];
      const cls = i === current ? 'slot active' : 'slot';
      return `<div class="${cls}"><b>${i + 1}</b> ${w.label} <span>${s.ammo}</span></div>`;
    }).join('');
  }

  setMission(title, objective, stage, stageTotal) {
    const t = this.el('mission-title');
    if (t) t.textContent = title + (stageTotal > 0 ? `  ·  STAGE ${stage}/${stageTotal}` : '');
    const o = this.el('mission-objective');
    if (o) o.textContent = objective;
  }

  setSpeed(kmh, inCar) {
    const el = this.el('speedo');
    if (!el) return;
    el.style.display = inCar ? 'block' : 'none';
    if (inCar) el.innerHTML = `<b>${Math.round(kmh)}</b> km/h`;
  }

  setCarHealth(h, inCar) {
    const el = this.el('car-health');
    if (!el) return;
    el.style.display = inCar ? 'block' : 'none';
    if (inCar) el.innerHTML = `CAR <b>${Math.max(0, Math.ceil(h))}</b>`;
  }

  setRadio(station, track, muted) {
    const el = this.el('radio');
    if (el) el.textContent = muted ? 'RADIO MUTED (M)' : `${station} — ${track}`;
  }

  setTimer(seconds) {
    const el = this.el('mission-timer');
    if (!el) return;
    if (seconds === null || seconds === undefined) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    const s = Math.max(0, Math.ceil(seconds));
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    el.classList.toggle('urgent', s <= 20);
  }

  setInteract(text) {
    const el = this.el('interact');
    if (!el) return;
    el.style.display = text ? 'block' : 'none';
    if (text) el.textContent = text;
  }

  setMarker(x, z, label) { this.marker = x === null ? null : { x, z, label: label || '' }; }

  showDialogue(speaker, text) {
    const box = this.el('dialogue');
    if (!box) return;
    this.el('dialogue-speaker').textContent = speaker;
    this.el('dialogue-text').textContent = text;
    this.el('dialogue-portrait').textContent = speaker.slice(0, 2).toUpperCase();
    box.style.display = 'block';
    clearTimeout(this._dialogueTimer);
    if (!this.sticky) this._dialogueTimer = setTimeout(() => { box.style.display = 'none'; }, 9000);
  }

  showToast(text) {
    const el = this.el('toast');
    if (!el) return;
    el.textContent = text;
    el.style.opacity = '1';
    clearTimeout(this._toastTimer);
    if (!this.sticky) this._toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 3500);
  }

  showDistrict(name) {
    if (name === this._lastDistrict) return;
    this._lastDistrict = name;
    const el = this.el('district');
    if (!el) return;
    el.textContent = name;
    el.style.opacity = '1';
    clearTimeout(this._districtTimer);
    this._districtTimer = setTimeout(() => { el.style.opacity = '0'; }, 2600);
  }

  flashDamage() {
    const el = this.el('damage-flash');
    if (!el) return;
    el.style.opacity = '0.45';
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => { el.style.opacity = '0'; }, 120);
  }

  // --- minimap ---
  drawMinimap(px, pz, heading, cars, cops, enemies) {
    const ctx = this.mapCtx;
    const S = this.map.width;
    const minX = -HALF - 20, maxX = WATER_X + 20;
    const minZ = -HALF - 20, maxZ = HALF + 20;
    const X = (x) => (x - minX) / (maxX - minX) * S;
    const Z = (z) => (z - minZ) / (maxZ - minZ) * S;
    ctx.clearRect(0, 0, S, S);
    // Sea + sand.
    ctx.fillStyle = '#1e7fa8'; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#e8d29a'; ctx.fillRect(X(BEACH_X), 0, X(WATER_X) - X(BEACH_X), S);
    // Land.
    ctx.fillStyle = '#5d7a4a'; ctx.fillRect(0, 0, X(BEACH_X), S);
    // Roads.
    ctx.strokeStyle = '#3d3f45'; ctx.lineWidth = 3;
    for (let i = 0; i < GRID_N; i++) {
      const x = -HALF + i * BLOCK, z = -HALF + i * BLOCK;
      ctx.beginPath(); ctx.moveTo(X(x), 0); ctx.lineTo(X(x), S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, Z(z)); ctx.lineTo(S, Z(z)); ctx.stroke();
    }
    // District tint.
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (const d of DISTRICTS) ctx.fillRect(X(d.x0), Z(d.z0), X(d.x1) - X(d.x0), Z(d.z1) - Z(d.z0));
    // Mission marker.
    if (this.marker) {
      const mx = X(this.marker.x), mz = Z(this.marker.z);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(mx, mz, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, mz, 11 + Math.sin(Date.now() / 200) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    // Cars (white), cops (blue), enemies (red).
    const dot = (x, z, color, r) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(x), Z(z), r, 0, Math.PI * 2); ctx.fill(); };
    for (const c of cars) dot(c.x, c.z, '#ffffff', 2.5);
    for (const c of cops) dot(c.x, c.z, '#2f6fd0', 3.5);
    for (const e of enemies || []) if (!e.dead) dot(e.x, e.z, '#e74c3c', 3.5);
    // Player arrow.
    const px2 = X(px), pz2 = Z(pz);
    ctx.save();
    ctx.translate(px2, pz2);
    ctx.rotate(heading);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Border.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); ctx.stroke();
  }
}
