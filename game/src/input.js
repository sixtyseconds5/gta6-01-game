// Keyboard and pointer input. Held keys give movement and steering; one-shot
// presses (confirm, pause, enter/exit car) are queued as flags and taken once by
// the loop, so a press between two frames is never lost or counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Enter', 'Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let shoot = false;
  let mouseX = 0;
  let mouseY = 0;
  let mouseActive = false;
  let mutePressed = false;

  window.addEventListener('keydown', (event) => {
    if (CONFIRM.has(event.code)) { actions |= ACTION_CONFIRM; event.preventDefault(); }
    if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    if (ENTER.has(event.code)) actions |= ACTION_ENTER;
    if (MUTE.has(event.code)) mutePressed = true;
    keys.add(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseActive = true;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) shoot = true;
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseActive = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) shoot = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    get up() { return [...keys].some((k) => UP.has(k)); },
    get down() { return [...keys].some((k) => DOWN.has(k)); },
    get left() { return [...keys].some((k) => LEFT.has(k)); },
    get right() { return [...keys].some((k) => RIGHT.has(k)); },
    get run() { return [...keys].some((k) => RUN.has(k)); },
    get shoot() { return shoot; },
    get mouseActive() { return mouseActive; },
    get mouseX() { return mouseX; },
    get mouseY() { return mouseY; },
    get confirm() { return (actions & ACTION_CONFIRM) !== 0; },
    get pause() { return (actions & ACTION_PAUSE) !== 0; },
    get enter() { return (actions & ACTION_ENTER) !== 0; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeMute() {
      const m = mutePressed;
      mutePressed = false;
      return m;
    },
  };
}
