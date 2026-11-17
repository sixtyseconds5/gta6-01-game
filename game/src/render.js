// Drawing only: the city, its people and cars, the HUD with its minimap, and the
// menus. The camera follows the player; the HUD is drawn in screen space.
import { BEACH_X, BLOCK, COLORS, ROAD_W, WATER_X, WORLD } from './config.js';
import { MISSION_NAMES, missionObjective } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const MINIMAP = 188;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 1280;
  let viewH = 720;
  let dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    viewW = canvas.clientWidth || window.innerWidth;
    viewH = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  function cameraFor(player) {
    const x = Math.max(viewW / 2, Math.min(WORLD - viewW / 2, player.x));
    const y = Math.max(viewH / 2, Math.min(WORLD - viewH / 2, player.y));
    return { x: x - viewW / 2, y: y - viewH / 2 };
  }

  function screenToWorld(cam, sx, sy) {
    return { x: cam.x + sx, y: cam.y + sy };
  }

  function drawWorld(city, cam, time) {
    const x0 = cam.x - 40;
    const y0 = cam.y - 40;
    const x1 = cam.x + viewW + 40;
    const y1 = cam.y + viewH + 40;

    // Ground.
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

    // Beach and water on the east edge.
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(Math.max(x0, BEACH_X), y0, x1 - Math.max(x0, BEACH_X), y1 - y0);
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(Math.max(x0, WATER_X), y0, x1 - Math.max(x0, WATER_X), y1 - y0);
    ctx.fillStyle = COLORS.waterDeep;
    for (let y = Math.floor(y0 / 90) * 90; y < y1; y += 90) {
      const wob = Math.sin(time * 0.8 + y * 0.05) * 6;
      ctx.fillRect(Math.max(x0, WATER_X) + 30 + wob, y, 60, 3);
    }

    // Park.
    ctx.fillStyle = COLORS.park;
    ctx.fillRect(city.park.x, city.park.y, city.park.w, city.park.h);
    ctx.fillStyle = '#c9c2b4';
    ctx.fillRect(city.park.x + city.park.w / 2 - 8, city.park.y, 16, city.park.h);
    ctx.fillRect(city.park.x, city.park.y + city.park.h / 2 - 8, city.park.w, 16);

    // Sidewalks and roads.
    for (const line of city.lines) {
      ctx.fillStyle = COLORS.sidewalk;
      ctx.fillRect(Math.max(x0, 0), line - ROAD_W / 2 - 14, Math.min(x1, WORLD) - Math.max(x0, 0), ROAD_W + 28);
      ctx.fillRect(line - ROAD_W / 2 - 14, Math.max(y0, 0), ROAD_W + 28, Math.min(y1, WORLD) - Math.max(y0, 0));
      ctx.fillStyle = COLORS.road;
      ctx.fillRect(Math.max(x0, 0), line - ROAD_W / 2, Math.min(x1, WORLD) - Math.max(x0, 0), ROAD_W);
      ctx.fillRect(line - ROAD_W / 2, Math.max(y0, 0), ROAD_W, Math.min(y1, WORLD) - Math.max(y0, 0));
    }
    // Centre dashes.
    ctx.fillStyle = COLORS.roadLine;
    for (const line of city.lines) {
      for (let p = 0; p < WORLD; p += 64) {
        if (p > x0 - 64 && p < x1) ctx.fillRect(p, line - 2, 30, 4);
        if (p > y0 - 64 && p < y1) ctx.fillRect(line - 2, p, 4, 30);
      }
    }

    // Trees.
    for (const t of city.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f7a33';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4d8f3e';
      ctx.beginPath(); ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.7, 0, Math.PI * 2); ctx.fill();
    }

    // Buildings: shadow, roof, windows, height shading.
    for (const b of city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 6, b.y + 7, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(b.x, b.y, b.w, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      const cols = Math.max(1, Math.floor(b.w / 22));
      const rows = Math.max(1, Math.floor(b.h / 22));
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          ctx.fillRect(b.x + 10 + cx * 22, b.y + 10 + cy * 22, 10, 10);
        }
      }
      if (b.stories >= 3) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${b.stories}F`, b.x + 8, b.y + b.h - 8);
      }
    }

    // Street lamps.
    ctx.fillStyle = '#2c2f36';
    for (const lamp of city.lamps) {
      if (lamp.x < x0 || lamp.x > x1 || lamp.y < y0 || lamp.y > y1) continue;
      ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
    }
  }

  function drawCar(car, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-22 + 3, -10 + 4, 46, 22);
    // Body.
    ctx.fillStyle = car.color;
    roundRect(-23, -11, 46, 22, 6);
    ctx.fill();
    // Cabin and windows.
    ctx.fillStyle = 'rgba(20,28,38,0.85)';
    roundRect(-6, -9, 16, 18, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.7)';
    ctx.fillRect(-2, -8, 8, 16);
    // Headlights and taillights.
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(21, -9, 3, 4);
    ctx.fillRect(21, 5, 3, 4);
    ctx.fillStyle = '#e33';
    ctx.fillRect(-24, -9, 3, 4);
    ctx.fillRect(-24, 5, 3, 4);
    if (car.police) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('VCPD', -8, -13);
      const flash = Math.floor(time * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ff2a2a' : '#2a6bff';
      ctx.beginPath(); ctx.arc(-14, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = flash ? '#2a6bff' : '#ff2a2a';
      ctx.beginPath(); ctx.arc(-6, 0, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (car.smoke > 0.3) {
      ctx.fillStyle = 'rgba(60,60,60,0.5)';
      ctx.beginPath();
      ctx.arc(car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, 5 + Math.sin(time * 9) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPed(ped) {
    const bob = Math.sin(ped.walkPhase) * 2;
    ctx.save();
    ctx.translate(ped.x, ped.y + bob * 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 6, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath(); ctx.arc(0, -3, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(0, -5, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawCop(cop, time) {
    const bob = Math.sin(cop.walkPhase) * 2;
    ctx.save();
    ctx.translate(cop.x, cop.y + bob * 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 7, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d4fa3';
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath(); ctx.arc(0, -3, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0d2b5c';
    ctx.fillRect(-5, -10, 10, 5);
    if (cop.arrest > 0) {
      ctx.fillStyle = '#ff5b5b';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('ARREST!', -22, -18);
    }
    ctx.restore();
  }

  function drawPlayer(p, time) {
    const bob = Math.sin(time * 10) * 1.5;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 8, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(p.angle);
    // Body: jacket, head, gun arm.
    ctx.fillStyle = '#e8b13c';
    roundRect(-8, -7, 16, 14, 6);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath(); ctx.arc(9, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2d3436';
    ctx.beginPath(); ctx.arc(10, -2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#333';
    ctx.fillRect(6, -2, 14, 4);
    ctx.restore();
    if (p.hurtTimer > 0) {
      ctx.fillStyle = 'rgba(255,0,0,0.25)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawEntities(state, missions, cam, time) {
    // Skid marks.
    ctx.strokeStyle = 'rgba(20,20,20,0.45)';
    ctx.lineWidth = 4;
    for (const s of state.skids) {
      ctx.globalAlpha = Math.min(1, s.life / 2);
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.angle) * 10, s.y - Math.sin(s.angle) * 10);
      ctx.lineTo(s.x + Math.cos(s.angle) * 10, s.y + Math.sin(s.angle) * 10);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Cash pickups.
    for (const pk of state.pickups) {
      const bob = Math.sin(time * 4 + pk.bob) * 3;
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('$', pk.x - 3, pk.y + bob + 4);
    }

    // Mission markers: a pulsing beacon and a column of light.
    const pulse = 1 + Math.sin(time * 5) * 0.15;
    for (const m of missionMarkers(missions)) {
      const col = m.kind === 'package' ? '#2ecc71' : COLORS.mission;
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.18;
      ctx.fillRect(m.x - 26, m.y - 200, 52, 200);
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(m.x, m.y, 16 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(m.x, m.y, 9 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.kind === 'package' ? '📦' : '★', m.x, m.y + 5);
      ctx.textAlign = 'left';
      if (m.label) {
        ctx.fillStyle = col;
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(m.label, m.x + 24, m.y + 5);
      }
    }

    // Cars, sorted with people by y for a top-down feel.
    const drawables = [];
    for (const car of state.cars) drawables.push({ y: car.y, draw: () => drawCar(car, time) });
    for (const ped of state.peds) drawables.push({ y: ped.y, draw: () => drawPed(ped) });
    for (const cop of state.cops) drawables.push({ y: cop.y, draw: () => drawCop(cop, time) });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    // Bullets.
    ctx.fillStyle = '#ffe27a';
    for (const b of state.bullets) {
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    }

    // Particles.
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Player (or the car he drives, drawn above).
    if (state.player.inCar) drawCar(state.player.inCar, time);
    else drawPlayer(state.player, time);

    // Player direction arrow when on foot.
    if (!state.player.inCar) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(state.player.x + Math.cos(state.player.angle) * 20, state.player.y + Math.sin(state.player.angle) * 20);
      ctx.lineTo(state.player.x + Math.cos(state.player.angle) * 30, state.player.y + Math.sin(state.player.angle) * 30);
      ctx.stroke();
    }
  }

  function drawHUD(state, missions, city, muted) {
    const p = state.player;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Top-left: health, cash, district.
    panel(12, 12, 250, 92);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 26, 36);
    ctx.fillStyle = '#9fb7d8';
    ctx.font = '13px sans-serif';
    ctx.fillText(city.districtAt(p.x, p.y), 26, 56);
    ctx.fillStyle = '#333';
    ctx.fillRect(26, 66, 200, 12);
    const hp = Math.max(0, p.health / 100);
    ctx.fillStyle = hp > 0.5 ? '#2ecc71' : hp > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(26, 66, 200 * hp, 12);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`HEALTH ${Math.round(p.health)}`, 30, 75);

    // Top-right: wanted stars.
    panel(viewW - 212, 12, 200, 56);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('WANTED', viewW - 198, 32);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < state.wanted ? '#ffd23f' : 'rgba(255,255,255,0.25)';
      ctx.font = '22px sans-serif';
      ctx.fillText('★', viewW - 198 + i * 26, 56);
    }

    // Top-centre: mission objective.
    const objective = missionObjective(missions, state);
    ctx.font = 'bold 15px sans-serif';
    const ow = ctx.measureText(objective).width + 28;
    panel((viewW - ow) / 2, 12, ow, 34);
    ctx.fillStyle = '#ffd23f';
    ctx.textAlign = 'center';
    ctx.fillText(objective, viewW / 2, 34);
    ctx.textAlign = 'left';

    // Mission list, right side.
    panel(viewW - 212, 80, 200, 96);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('MISSIONS', viewW - 198, 100);
    ctx.font = '13px sans-serif';
    MISSION_NAMES.forEach((name, i) => {
      const done = missions.completed.includes(name);
      const active = missions.index === i && missions.stage === 'active';
      ctx.fillStyle = done ? '#2ecc71' : active ? '#ffd23f' : 'rgba(255,255,255,0.55)';
      ctx.fillText(`${done ? '✓' : active ? '►' : '·'} ${i + 1}. ${name}`, viewW - 198, 120 + i * 18);
    });
    if (missions.stage === 'active' && missions.timeLeft > 0) {
      ctx.fillStyle = '#fff';
      ctx.fillText(`⏱ ${Math.ceil(missions.timeLeft)}s left`, viewW - 198, 120 + 3 * 18 - 6);
    }

    // Minimap, bottom-left.
    const mmX = 12;
    const mmY = viewH - MINIMAP - 12;
    panel(mmX - 6, mmY - 6, MINIMAP + 12, MINIMAP + 12);
    const scale = MINIMAP / WORLD;
    ctx.save();
    ctx.beginPath();
    ctx.rect(mmX, mmY, MINIMAP, MINIMAP);
    ctx.clip();
    ctx.fillStyle = '#5d8a48';
    ctx.fillRect(mmX, mmY, MINIMAP, MINIMAP);
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(mmX + WATER_X * scale, mmY, MINIMAP, MINIMAP);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(mmX + BEACH_X * scale, mmY, (WATER_X - BEACH_X) * scale, MINIMAP);
    ctx.strokeStyle = '#3d3f45';
    ctx.lineWidth = 2;
    for (const line of city.lines) {
      ctx.beginPath(); ctx.moveTo(mmX, mmY + line * scale); ctx.lineTo(mmX + MINIMAP, mmY + line * scale); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mmX + line * scale, mmY); ctx.lineTo(mmX + line * scale, mmY + MINIMAP); ctx.stroke();
    }
    ctx.fillStyle = '#5d9b4a';
    ctx.fillRect(mmX + city.park.x * scale, mmY + city.park.y * scale, city.park.w * scale, city.park.h * scale);
    for (const m of missionMarkers(missions)) {
      const blink = Math.floor(state.time * 3) % 2 === 0;
      ctx.fillStyle = m.kind === 'package' ? '#2ecc71' : blink ? '#ffd23f' : '#fff';
      ctx.beginPath(); ctx.arc(mmX + m.x * scale, mmY + m.y * scale, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#fff';
    for (const car of state.cars) {
      if (car.driver === 'police') continue;
      ctx.fillRect(mmX + car.x * scale - 1, mmY + car.y * scale - 1, 2, 2);
    }
    ctx.fillStyle = '#ff2a2a';
    for (const car of state.cars) {
      if (car.driver !== 'police') continue;
      ctx.beginPath(); ctx.arc(mmX + car.x * scale, mmY + car.y * scale, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#2a6bff';
    for (const cop of state.cops) {
      ctx.fillRect(mmX + cop.x * scale - 1, mmY + cop.y * scale - 1, 3, 3);
    }
    // Player arrow.
    ctx.save();
    ctx.translate(mmX + p.x * scale, mmY + p.y * scale);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();

    // Speedometer, bottom-right, when driving.
    if (p.inCar) {
      panel(viewW - 172, viewH - 76, 160, 64);
      ctx.fillStyle = COLORS.hudText;
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(Math.abs(p.inCar.speed) * 0.22)}`, viewW - 52, viewH - 34);
      ctx.font = '13px sans-serif';
      ctx.fillText('km/h', viewW - 24, viewH - 34);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#9fb7d8';
      ctx.font = '12px sans-serif';
      ctx.fillText(p.inCar.police ? 'VCPD CRUISER' : 'STOLEN CAR', viewW - 160, viewH - 52);
    }

    // Controls hint, bottom-centre.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      p.inCar
        ? 'WASD drive · E exit car · P pause · M mute'
        : 'WASD move · Shift run · Mouse aim · Click shoot · E steal car · P pause · M mute',
      viewW / 2, viewH - 14,
    );
    ctx.textAlign = 'left';
    if (muted) {
      ctx.fillStyle = '#f39c12';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('🔇 MUTED', 12, viewH - MINIMAP - 24);
    }

    // Toast message.
    if (state.messageTimer > 0 && state.message) {
      ctx.font = 'bold 16px sans-serif';
      const mw = ctx.measureText(state.message).width + 24;
      panel((viewW - mw) / 2, viewH - 110, mw, 32);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(state.message, viewW / 2, viewH - 88);
      ctx.textAlign = 'left';
    }

    // Mission banner.
    if (missions.bannerTimer > 0 && missions.banner) {
      ctx.font = 'bold 26px sans-serif';
      const bw = ctx.measureText(missions.banner).width + 40;
      panel((viewW - bw) / 2, viewH / 2 - 90, bw, 46);
      ctx.fillStyle = '#ffd23f';
      ctx.textAlign = 'center';
      ctx.fillText(missions.banner, viewW / 2, viewH / 2 - 59);
      ctx.textAlign = 'left';
    }
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = COLORS.hudBg;
    roundRect(x, y, w, h, 8);
    ctx.fill();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawTitle(saveExists) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grad = ctx.createLinearGradient(0, 0, 0, viewH);
    grad.addColorStop(0, '#1b2a4a');
    grad.addColorStop(0.55, '#c96f3f');
    grad.addColorStop(1, '#f2a65a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW, viewH);
    // Sun.
    ctx.fillStyle = '#ffd97a';
    ctx.beginPath(); ctx.arc(viewW * 0.78, viewH * 0.22, 70, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,217,122,0.25)';
    ctx.beginPath(); ctx.arc(viewW * 0.78, viewH * 0.22, 110, 0, Math.PI * 2); ctx.fill();
    // Skyline silhouette.
    ctx.fillStyle = 'rgba(20,24,40,0.85)';
    const base = viewH * 0.72;
    for (let i = 0; i < 24; i++) {
      const w = viewW / 24;
      const h = 60 + ((i * 37) % 130);
      ctx.fillRect(i * w, base - h, w - 6, h + viewH);
    }
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 84px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VICE RUSH', viewW / 2, viewH * 0.30);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('An open-world crime story — Vice City is yours to take.', viewW / 2, viewH * 0.30 + 40);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    const story = [
      'You are Vic Vega, fresh out of the joint and broke in Vice City.',
      'Rico has jobs for you — wheels, packages, and one very loud night.',
      'Steal cars, dodge the VCPD, and build your name, one mission at a time.',
    ];
    story.forEach((line, i) => ctx.fillText(line, viewW / 2, viewH * 0.44 + i * 26));
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('WASD move / drive · Mouse aim · Click shoot · E steal car · Shift run · P pause · M mute', viewW / 2, viewH * 0.62);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(saveExists ? 'Press ENTER to continue your save — or click START' : 'Press ENTER or click START to play', viewW / 2, viewH * 0.72);
    // START button.
    ctx.fillStyle = '#ffd23f';
    roundRect(viewW / 2 - 110, viewH * 0.72 + 18, 220, 44, 8);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('▶  START', viewW / 2, viewH * 0.72 + 47);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Progress saves automatically after each mission. An original game — no Rockstar content.', viewW / 2, viewH * 0.80);
    ctx.textAlign = 'left';
    // Start button hit area, recorded for clicks.
    return { x: viewW / 2 - 110, y: viewH * 0.72 + 18, w: 220, h: 44 };
  }

  function drawPaused() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(8,10,16,0.72)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', viewW / 2, viewH / 2 - 20);
    ctx.font = '17px sans-serif';
    ctx.fillText('Press P or Esc to resume · M to mute · progress is saved after each mission', viewW / 2, viewH / 2 + 24);
    ctx.textAlign = 'left';
  }

  function drawOver(kind, cash) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = kind === 'busted' ? 'rgba(10,20,60,0.85)' : 'rgba(60,8,8,0.85)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(kind === 'busted' ? 'BUSTED!' : 'WASTED', viewW / 2, viewH / 2 - 30);
    ctx.font = '18px sans-serif';
    ctx.fillText(
      kind === 'busted'
        ? 'The VCPD caught up with you. Vice City remembers — try again.'
        : 'Vic Vega is down. The city moves on without you — try again.',
      viewW / 2, viewH / 2 + 12,
    );
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`Cash kept: $${cash.toLocaleString('en-US')}`, viewW / 2, viewH / 2 + 52);
    ctx.fillStyle = '#fff';
    ctx.font = '17px sans-serif';
    ctx.fillText('Press ENTER to restart', viewW / 2, viewH / 2 + 96);
    ctx.textAlign = 'left';
  }

  return {
    resize,
    get viewW() { return viewW; },
    get viewH() { return viewH; },
    cameraFor,
    screenToWorld,
    draw(state, city, missions, screen, saveExists, muted) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (screen === SCREEN_TITLE) {
        return drawTitle(saveExists);
      }
      const cam = cameraFor(state.player);
      if (state.shake > 0) {
        const mag = state.shake * 8;
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
      }
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.translate(-cam.x, -cam.y);
      drawWorld(city, cam, state.time);
      drawEntities(state, missions, cam, state.time);
      ctx.restore();
      drawHUD(state, missions, city, muted);
      if (screen === SCREEN_PAUSED) drawPaused();
      if (screen === SCREEN_OVER) {
        drawOver(state.busted ? 'busted' : 'wasted', state.player.cash);
      }
      return null;
    },
  };
}

function missionMarkers(missions) {
  // Local re-export shim so render.js stays self-contained for the marker list.
  const out = [];
  if (missions.stage !== 'active') return out;
  if (missions.index === 1) {
    for (const pkg of missions.packages) if (!pkg.taken) out.push({ ...pkg, kind: 'package' });
  }
  if (missions.marker) out.push({ ...missions.marker, kind: 'target' });
  return out;
}
