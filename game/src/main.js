// Vice Rush — boot and the one loop. The game moves between four screens:
// title, play, paused and game over. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
//
// ?shot=chase|drive|foot|mission stages that scene instead of the title screen
// and starts play at once, then sets window.__shotReady for a screenshot.
import { PLAYER } from './config.js';
import { createCity } from './world.js';
import { createEntities, stepEntities } from './entities.js';
import { createMissions, stepMissions } from './missions.js';
import { createAudio } from './audio.js';
import { createInput, ACTION_CONFIRM, ACTION_ENTER, ACTION_PAUSE } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const SAVE_KEY = 'vice-rush-save-v1';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const input = createInput(canvas);
const renderer = createRenderer(canvas);
const audio = createAudio();
const city = createCity();

function newGame() {
  return {
    city,
    state: createEntities(city),
    missions: createMissions(),
  };
}

let game = newGame();
let screen = SCREEN_TITLE;
let saveExists = false;

function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

function writeSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: game.state.player.cash,
      missionIndex: game.missions.index,
      completed: game.missions.completed,
      x: game.state.player.x,
      y: game.state.player.y,
      health: game.state.player.health,
    }));
    saveExists = true;
  } catch (e) {
    // Storage unavailable (private mode): the game still plays.
  }
}

function applySave(data) {
  game.state.player.cash = data.cash;
  game.missions.index = Math.min(data.missionIndex, 2);
  game.missions.completed = Array.isArray(data.completed) ? data.completed : [];
  game.missions.stage = 'intro';
  game.state.player.x = data.x;
  game.state.player.y = data.y;
  game.state.player.health = data.health ?? PLAYER.maxHealth;
  game.state.player.inCar = null;
}

saveExists = readSave() !== null;

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function startPlay() {
  const save = readSave();
  if (save) applySave(save);
  screen = SCREEN_PLAY;
  audio.ensure();
  setStatus('Playing Vice Rush.');
}

function restart() {
  game = newGame();
  game.missions.stage = 'intro';
  screen = SCREEN_PLAY;
  setStatus('Playing Vice Rush.');
}

function update(dt, actions) {
  const events = {};
  const p = game.state.player;

  // Mouse aim: screen position to world position.
  if (input.mouseActive) {
    const camX = Math.max(renderer.viewW / 2, Math.min(3600 - renderer.viewW / 2, p.x)) - renderer.viewW / 2;
    const camY = Math.max(renderer.viewH / 2, Math.min(3600 - renderer.viewH / 2, p.y)) - renderer.viewH / 2;
    p.aimX = camX + input.mouseX;
    p.aimY = camY + input.mouseY;
  }

  stepEntities(game.state, game.city, {
    up: input.up, down: input.down, left: input.left, right: input.right,
    run: input.run, shoot: input.shoot, enter: (actions & ACTION_ENTER) !== 0,
    mouseActive: input.mouseActive, aimX: p.aimX, aimY: p.aimY,
  }, dt, events);
  stepMissions(game.missions, game.state, dt, { confirm: (actions & ACTION_CONFIRM) !== 0 });

  if (events.shot) audio.gunshot();
  if (events.crash) audio.crash();
  if (events.explosion) audio.explosion();
  if (events.pickup) audio.pickup();
  if (events.enterCar || events.exitCar) audio.enterCar();
  audio.update(p.inCar ? p.inCar.speed : 0, game.state.wanted, game.state.time);

  // Mission completion is announced by the banner; save and chime once per banner.
  if (game.missions.banner.startsWith('MISSION PASSED') && game.missions.banner !== lastBanner) {
    lastBanner = game.missions.banner;
    audio.missionPass();
    writeSave();
  }

  if (game.state.busted || game.state.wasted) {
    screen = SCREEN_OVER;
    audio.busted();
    setStatus(game.state.busted ? 'Busted by the VCPD.' : 'Wasted.');
  }
}

let last = performance.now();
let acc = 0;
let lastBanner = '';

function frame(now) {
  const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;

  const actions = input.takeActions();
  if (input.takeMute()) {
    const muted = audio.toggleMute();
    game.state.message = muted ? 'Sound muted (M to unmute)' : 'Sound on';
    game.state.messageTimer = 1.5;
  }

  if (screen === SCREEN_TITLE) {
    if (actions & ACTION_CONFIRM) startPlay();
    // Clicking the start prompt also starts.
    if (input.shoot) startPlay();
  } else if (screen === SCREEN_PLAY) {
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
    } else {
      acc += elapsed;
      while (acc >= STEP) {
        update(STEP, actions);
        acc -= STEP;
        if (screen !== SCREEN_PLAY) { acc = 0; break; }
      }
    }
  } else if (screen === SCREEN_PAUSED) {
    if (actions & ACTION_PAUSE) screen = SCREEN_PLAY;
  } else if (screen === SCREEN_OVER) {
    if (actions & ACTION_CONFIRM) restart();
  }

  const startButton = renderer.draw(game.state, game.city, game.missions, screen, saveExists, audio.muted);
  void startButton;
  requestAnimationFrame(frame);
}

if (shot) {
  screen = stageShot(shot, game);
  // Debug hook for the screenshot run: inspect the staged state from the console.
  window.__vice = game;
  // Paint twice so the first visible frame is settled, then signal readiness.
  renderer.draw(game.state, game.city, game.missions, screen, saveExists, audio.muted);
  renderer.draw(game.state, game.city, game.missions, screen, saveExists, audio.muted);
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}
