// Sound, all synthesized with WebAudio: no audio files, no network. The context is created on
// the first user gesture (the title screen's start), and every effect is a short oscillator or
// noise burst through a master gain. M toggles mute.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol || 0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, low) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = low || 900;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
    click() { tone(660, 0.07, 'square', 0.08); },
    pickup() { tone(880, 0.09, 'sine', 0.14); setTimeout(() => tone(1320, 0.12, 'sine', 0.14), 80); },
    mission() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.16), i * 95)); },
    fail() { tone(220, 0.5, 'sawtooth', 0.14, 110); },
    gunshot() { noise(0.12, 0.3, 1600); },
    crash() { noise(0.25, 0.35, 300); tone(70, 0.25, 'sine', 0.25, 40); },
    siren(on) {
      if (!ctx || muted) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenGain = ctx.createGain();
        sirenOsc.type = 'sine';
        sirenOsc.frequency.value = 700;
        sirenGain.gain.value = 0.035;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
      } else if (!on && sirenOsc) {
        try { sirenOsc.stop(); } catch { /* already stopped */ }
        sirenOsc = null;
        sirenGain = null;
      }
    },
    engine(on, speedRatio) {
      if (!ctx || muted) return;
      if (on && !engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 60;
        engineGain.gain.value = 0.03;
        engineOsc.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      } else if (!on && engineOsc) {
        try { engineOsc.stop(); } catch { /* already stopped */ }
        engineOsc = null;
        engineGain = null;
      }
      if (engineOsc) engineOsc.frequency.value = 55 + speedRatio * 130;
    },
    /** Called every frame while playing: two-tone the siren, keep the engine humming. */
    update(dt, sirenOn, driving, speedRatio) {
      if (!ctx) return;
      this.siren(sirenOn);
      if (sirenOsc) {
        sirenTimer += dt;
        sirenOsc.frequency.value = (Math.floor(sirenTimer * 2.4) % 2 === 0) ? 700 : 950;
      }
      this.engine(driving, speedRatio);
    },
  };
}
