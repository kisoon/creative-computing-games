(function (global) {
  'use strict';

  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    const AudioCtor = global.AudioContext || global.webkitAudioContext;
    if (!AudioCtor) return null;
    ctx = new AudioCtor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.42;
    master.connect(ctx.destination);
    return ctx;
  }

  function blip(freq, endFreq, duration, type, volume, delay) {
    const c = ensure();
    if (!c || muted) return;
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  function noiseHit(duration, volume, cutoff) {
    const c = ensure();
    if (!c || muted) return;
    const length = Math.floor(c.sampleRate * duration);
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const source = c.createBufferSource();
    source.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = c.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  const GameAudio = {
    unlock() {
      ensure();
    },

    hop() {
      blip(520, 760, 0.075, 'triangle', 0.07);
    },

    start() {
      blip(392, 523, 0.12, 'triangle', 0.09, 0);
      blip(587, 784, 0.16, 'triangle', 0.075, 0.09);
    },

    death() {
      blip(230, 55, 0.5, 'sawtooth', 0.14);
      noiseHit(0.34, 0.2, 900);
    },

    toggle() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.42;
      return muted;
    },

    isMuted() {
      return muted;
    },
  };

  global.GameAudio = GameAudio;
})(window);