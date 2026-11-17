// Sound, all synthesized with WebAudio — no audio files, no network.
// Engine hum follows speed, the siren wails while wanted, the rest are one-shots.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    started = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: two detuned saws through a lowpass, gain follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc2 = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc2.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2.frequency.value = 55 * 1.5;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      engineOsc2.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      // Siren: a sine that slides between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch (e) {
      ctx = null;
    }
  }

  function noiseBurst(duration, volume, lowpass) {
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  function blip(freq, duration, volume, type = 'sine') {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  return {
    ensure,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    update(speed, wanted, time) {
      if (!ctx || muted) return;
      const norm = Math.min(1, Math.abs(speed) / 580);
      if (engineOsc) {
        engineOsc.frequency.value = 50 + norm * 130;
        engineOsc2.frequency.value = (50 + norm * 130) * 1.5;
        engineGain.gain.value = 0.02 + norm * 0.06;
      }
      if (sirenOsc) {
        if (wanted > 0) {
          sirenOsc.frequency.value = 660 + Math.sin(time * 4.4) * 220;
          sirenGain.gain.value = 0.035;
        } else {
          sirenGain.gain.value = 0;
        }
      }
    },
    gunshot() { if (!muted) noiseBurst(0.12, 0.5, 2400); },
    crash() { if (!muted) noiseBurst(0.25, 0.55, 700); },
    explosion() { if (!muted) { noiseBurst(0.7, 0.8, 400); blip(60, 0.5, 0.5, 'sine'); } },
    pickup() { if (!muted) { blip(880, 0.12, 0.3); setTimeout(() => blip(1320, 0.16, 0.3), 70); } },
    missionPass() {
      if (muted) return;
      blip(523, 0.15, 0.35);
      setTimeout(() => blip(659, 0.15, 0.35), 120);
      setTimeout(() => blip(784, 0.25, 0.35), 240);
    },
    enterCar() { if (!muted) blip(180, 0.1, 0.3, 'square'); },
    busted() { if (!muted) { blip(220, 0.4, 0.4, 'sawtooth'); setTimeout(() => blip(180, 0.5, 0.4, 'sawtooth'), 300); } },
  };
}
