// Vice Rush 3D — all sound is synthesized with WebAudio. No audio files.
// Three radio stations (synthwave basslines via oscillators), engine hum that
// follows speed, a two-tone police siren, and one-shot effects.
const STATIONS = [
  {
    name: 'VICE FM 98.4',
    track: 'Neon Palms — Midnight Drive',
    bpm: 96, root: 55, // A1
    // [semitone offset from root, beats] bass pattern
    bass: [[0, 1], [0, 1], [7, 1], [10, 1], [0, 1], [12, 1], [10, 1], [7, 1]],
    pad: [0, 3, 7, 10],
    wave: 'sawtooth',
  },
  {
    name: 'OCEAN DRIVE RADIO',
    track: 'The Sunsets — Roller Disco',
    bpm: 112, root: 65.41, // C2
    bass: [[0, 0.5], [0, 0.5], [3, 0.5], [5, 0.5], [7, 0.5], [5, 0.5], [3, 0.5], [0, 0.5]],
    pad: [0, 4, 7],
    wave: 'square',
  },
  {
    name: 'HAVANA BEATS 101',
    track: 'Calle Ocho — Salsa Neon',
    bpm: 128, root: 49, // G1
    bass: [[0, 0.5], [7, 0.5], [0, 0.5], [10, 0.5], [12, 0.5], [10, 0.5], [7, 0.5], [5, 0.5]],
    pad: [0, 5, 7],
    wave: 'triangle',
  },
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.station = 0;
    this.radioOn = true;
    this._radioTimer = null;
    this._step = 0;
    this._engineOsc = null; this._engineGain = null; this._engineFilter = null;
    this._sirenOsc = null; this._sirenGain = null; this._sirenTimer = null;
    this._master = null;
  }

  // Must be called from a user gesture at least once.
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this._master = this.ctx.createGain();
      this._master.gain.value = this.muted ? 0 : 0.5;
      this._master.connect(this.ctx.destination);
      this._startEngine();
      this._startRadio();
    } catch { this.ctx = null; }
  }

  setMuted(m) {
    this.muted = m;
    if (this._master) this._master.gain.value = m ? 0 : 0.5;
  }
  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  nextStation() {
    this.station = (this.station + 1) % STATIONS.length;
    this._step = 0;
    return STATIONS[this.station];
  }
  currentStation() { return STATIONS[this.station]; }

  _noteFreq(semitones, root) { return root * Math.pow(2, semitones / 12); }

  _startRadio() {
    if (!this.ctx || this._radioTimer) return;
    const tick = () => {
      if (!this.ctx) return;
      const st = STATIONS[this.station];
      const beatSec = 60 / st.bpm;
      const stepDur = beatSec * 0.5; // eighth notes
      if (this.radioOn && !this.muted) {
        // Bass: walk the pattern, one eighth note per tick.
        let pos = 0;
        for (const [semi, beats] of st.bass) {
          if (this._step >= pos && this._step < pos + beats * 2) {
            this._blip(st.wave, this._noteFreq(semi, st.root), stepDur * beats * 2, 0.16, 'lowpass', 700);
            break;
          }
          pos += beats * 2;
        }
        // Pad chord on bar starts.
        const barLen = st.bass.reduce((s, b) => s + b[1], 0) * 2;
        if (this._step % barLen === 0) {
          for (const semi of st.pad) {
            this._blip('sawtooth', this._noteFreq(semi, st.root * 4), stepDur * barLen * 0.9, 0.035, 'lowpass', 1200);
          }
        }
        // Hat tick on off-beats.
        if (this._step % 2 === 1) this._noise(stepDur * 0.4, 0.02, 6000);
      }
      const barLen = st.bass.reduce((s, b) => s + b[1], 0) * 2;
      this._step = (this._step + 1) % barLen;
      this._radioTimer = setTimeout(tick, stepDur * 1000);
    };
    tick();
  }

  _blip(wave, freq, dur, vol, filterType, filterFreq) {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = wave; osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    let node = osc;
    if (filterType) {
      const f = this.ctx.createBiquadFilter();
      f.type = filterType; f.frequency.value = filterFreq;
      osc.connect(f); node = f;
    }
    node.connect(g); g.connect(this._master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  _noise(dur, vol, filterFreq) {
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this._master);
    src.start(t);
  }

  _startEngine() {
    const ctx = this.ctx;
    this._engineOsc = ctx.createOscillator();
    this._engineOsc.type = 'sawtooth';
    this._engineOsc.frequency.value = 55;
    this._engineFilter = ctx.createBiquadFilter();
    this._engineFilter.type = 'lowpass'; this._engineFilter.frequency.value = 320;
    this._engineGain = ctx.createGain(); this._engineGain.gain.value = 0;
    this._engineOsc.connect(this._engineFilter);
    this._engineFilter.connect(this._engineGain);
    this._engineGain.connect(this._master);
    this._engineOsc.start();
  }

  // speedNorm 0..1, driving true/false.
  setEngine(speedNorm, driving) {
    if (!this.ctx || !this._engineOsc) return;
    const t = this.ctx.currentTime;
    const target = driving && !this.muted ? 0.02 + speedNorm * 0.075 : 0;
    this._engineGain.gain.setTargetAtTime(target, t, 0.08);
    this._engineOsc.frequency.setTargetAtTime(50 + speedNorm * 160, t, 0.08);
    this._engineFilter.frequency.setTargetAtTime(300 + speedNorm * 900, t, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this._sirenOsc) {
      this._sirenOsc = this.ctx.createOscillator();
      this._sirenOsc.type = 'triangle';
      this._sirenGain = this.ctx.createGain();
      this._sirenGain.gain.value = 0.0;
      this._sirenOsc.connect(this._sirenGain);
      this._sirenGain.connect(this._master);
      this._sirenOsc.start();
      let hi = false;
      this._sirenTimer = setInterval(() => {
        if (!this._sirenOsc) return;
        hi = !hi;
        this._sirenOsc.frequency.setTargetAtTime(hi ? 880 : 660, this.ctx.currentTime, 0.05);
        this._sirenGain.gain.setTargetAtTime(this.muted ? 0 : 0.035, this.ctx.currentTime, 0.05);
      }, 380);
    } else if (!on && this._sirenOsc) {
      clearInterval(this._sirenTimer); this._sirenTimer = null;
      try { this._sirenOsc.stop(); } catch { /* already stopped */ }
      this._sirenOsc = null; this._sirenGain = null;
    }
  }

  // One-shot effects.
  shot() { if (this.ctx && !this.muted) { this._noise(0.09, 0.28, 900); this._blip('square', 160, 0.07, 0.12, 'lowpass', 900); } }
  crash() { if (this.ctx && !this.muted) this._noise(0.25, 0.3, 400); }
  pickup() { if (this.ctx && !this.muted) { this._blip('sine', 660, 0.09, 0.14); setTimeout(() => this._blip('sine', 990, 0.12, 0.14), 80); } }
  missionPass() {
    if (!this.ctx || this.muted) return;
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._blip('triangle', f, 0.22, 0.16), i * 110));
  }
  missionFail() {
    if (!this.ctx || this.muted) return;
    [392, 330, 262].forEach((f, i) => setTimeout(() => this._blip('sawtooth', f, 0.25, 0.1, 'lowpass', 800), i * 130));
  }
  click() { if (this.ctx && !this.muted) this._blip('sine', 880, 0.05, 0.08); }
  explosion() { if (this.ctx && !this.muted) { this._noise(0.7, 0.4, 250); this._blip('sine', 55, 0.6, 0.3, 'lowpass', 200); } }
}
