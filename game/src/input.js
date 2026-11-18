// Vice Rush 3D — keyboard + mouse input state. Pointer lock on click for
// mouse-look; WASD movement, E interact, Space jump, 1/2/3 weapons, M mute,
// R/Q radio, P/Esc pause.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouseDown = false; this.mouseHeld = false;
    this.locked = false;
    this.canvas = canvas;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (this.onKey) this.onKey(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => {
      if (this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    };
    this._onMouseDown = (e) => {
      if (e.target !== this.canvas) return; // HUD button clicks are not shots
      if (e.button === 0) { this.mouseDown = true; this.mouseHeld = true; }
    };
    this._onMouseUp = (e) => { if (e.button === 0) this.mouseHeld = false; };
    this._onLockChange = () => { this.locked = document.pointerLockElement === canvas; };
    this._onClick = () => {
      if (!this.locked && this.wantLock) {
        try { canvas.requestPointerLock(); } catch { /* pointer lock unavailable */ }
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('pointerlockchange', this._onLockChange);
    canvas.addEventListener('click', this._onClick);
    this.wantLock = true;
    this.onKey = null;
  }
  down(code) { return this.keys.has(code); }
  axis() {
    let x = 0, z = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) z -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) z += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    return { x, z };
  }
  consumeMouse() { const dx = this.mouseDX, dy = this.mouseDY; this.mouseDX = 0; this.mouseDY = 0; return { dx, dy }; }
  consumeClick() { const c = this.mouseDown; this.mouseDown = false; return c; }
  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    this.canvas.removeEventListener('click', this._onClick);
  }
}
