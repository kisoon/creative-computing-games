/**
 * Web Audio 기반 신시사이저.
 * - 단일 오실레이터 2개(사인 + 살짝 디튠된 트라이앵글)를 로우패스 필터로 다듬습니다.
 * - 모든 값은 setTargetAtTime 으로 부드럽게 이동해 클릭/지직 소리를 막습니다.
 */
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const AudioEngine = {
  ctx: null,
  masterGain: null,
  voiceGain: null,
  filter: null,
  oscMain: null,
  oscSub: null,

  playing: false,
  octave: CONFIG.instrument.defaultOctave,
  volume: 0,
  frequency: 261.63,
  vibrato: 0,

  /** 오디오 그래프를 최초 1회 구성합니다. (사용자 클릭 이후에 호출되어야 합니다) */
  ensureContext() {
    if (this.ctx) return this.ctx;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    const ctx = new AudioCtx();

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.8;
    masterGain.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2600;
    filter.Q.value = 0.6;
    filter.connect(masterGain);

    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 0;
    voiceGain.connect(filter);

    const oscMain = ctx.createOscillator();
    oscMain.type = "sine";
    oscMain.frequency.value = this.frequency;
    oscMain.connect(voiceGain);

    const oscSub = ctx.createOscillator();
    oscSub.type = "triangle";
    oscSub.frequency.value = this.frequency;
    oscSub.detune.value = 9;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.3;
    oscSub.connect(subGain);
    subGain.connect(voiceGain);

    // 비브라토 LFO: 두 오실레이터의 detune(센트)을 흔듭니다.
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = CONFIG.instrument.vibrato.rate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0;
    lfo.connect(lfoGain);
    lfoGain.connect(oscMain.detune);
    lfoGain.connect(oscSub.detune);

    oscMain.start();
    oscSub.start();
    lfo.start();

    Object.assign(this, { ctx, masterGain, voiceGain, filter, oscMain, oscSub, lfo, lfoGain });
    return ctx;
  },

  /** 연주 시작. 오디오 컨텍스트를 깨우고 소리를 낼 준비를 합니다. */
  async start() {
    const ctx = this.ensureContext();
    if (!ctx) return false;

    try {
      await ctx.resume();
    } catch (error) {
      console.error("[Audio] 컨텍스트를 시작하지 못했습니다:", error);
      return false;
    }

    this.playing = true;
    return true;
  },

  /** 연주 정지. 볼륨을 0으로 내린 뒤 잠시 후 컨텍스트를 재웁니다. */
  stop() {
    this.playing = false;

    if (!this.ctx) return;

    const ctx = this.ctx;
    this.voiceGain.gain.cancelScheduledValues(ctx.currentTime);
    this.voiceGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    this.volume = 0;

    setTimeout(() => {
      if (!this.playing && ctx.state === "running") {
        ctx.suspend().catch(() => {});
      }
    }, 500);
  },

  /** 음량·주파수 목표값을 부드럽게 반영합니다. */
  setTargets(volume, frequency) {
    if (!this.playing || !this.ctx) return;

    const now = this.ctx.currentTime;
    this.voiceGain.gain.setTargetAtTime(volume, now, 0.06);
    this.oscMain.frequency.setTargetAtTime(frequency, now, 0.07);
    this.oscSub.frequency.setTargetAtTime(frequency, now, 0.07);

    this.volume = volume;
    this.frequency = frequency;
  },

  /** 비브라토 깊이(센트)를 부드럽게 반영합니다. */
  setVibrato(cents) {
    if (!this.ctx) return;

    const max = CONFIG.instrument.vibrato.maxCents;
    const depth = Math.min(max, Math.max(0, cents));
    this.vibrato = depth;
    this.lfoGain.gain.setTargetAtTime(depth, this.ctx.currentTime, 0.05);
  },

  midiFor(octave, semitone) {
    return 12 * (octave + 1) + semitone;
  },

  /** 옥타브 + 반음 → 주파수(Hz) */
  frequencyFor(octave, semitone) {
    return 440 * Math.pow(2, (this.midiFor(octave, semitone) - 69) / 12);
  },

  /** 옥타브 + 반음 → 음이름 (예: 4, 9 → "A4") */
  noteNameFor(octave, semitone) {
    const midi = this.midiFor(octave, semitone);
    return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
  },
};
