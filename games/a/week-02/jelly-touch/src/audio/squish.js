// 절차적 "말랑" 사운드. 오디오 파일 없이 Web Audio API로 만든다.
// - 노이즈(찰진 느낌) + 사인 톤(말랑한 느낌)
// - 누르는 깊이에 따라 음량/음높이가 바뀐다
// - 동시 발음 수를 제한해서 소리가 뭉개지지 않게 한다

import { CONFIG } from "../config.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class SquishAudio {
  constructor(options = CONFIG.audio) {
    this.options = options;
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.noiseBuffer = null;
    this.voices = 0;
    this.enabled = true;
    this.lastPlayed = new Map();
  }

  /** 사용자 클릭 안에서 호출해야 한다 (자동재생 정책). */
  async unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 24;
      this.compressor.ratio.value = 6;
      this.compressor.attack.value = 0.004;
      this.compressor.release.value = 0.18;

      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.options.masterGain : 0;

      this.master.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoise();
    }

    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  createNoise() {
    const ctx = this.ctx;
    const length = Math.floor(ctx.sampleRate * 0.3);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(
        enabled ? this.options.masterGain : 0,
        this.ctx.currentTime,
        0.02
      );
    }
  }

  contactStart(contact) {
    this.play(contact, "squish", 1);
  }

  contactHold(contact, now) {
    // 문지르면 일정 간격으로 소리가 다시 난다.
    if (contact.speed < 240) return;
    const last = this.lastPlayed.get(contact.handId) || 0;
    if (now - last < 150) return;
    this.play(contact, "rub", 0.62);
  }

  release(contact) {
    this.play(contact, "release", 1);
  }

  play(contact, kind, strength = 1) {
    if (!this.enabled || !this.ctx || !this.master) return;
    if (this.voices >= this.options.maxVoices) return;

    const now = performance.now();
    if (now - (this.lastPlayed.get(contact.handId) || 0) < this.options.cooldownMs) return;
    this.lastPlayed.set(contact.handId, now);

    const ctx = this.ctx;
    const t = ctx.currentTime + 0.004;
    const depth = clamp(contact.depth ?? 0.4, 0, 1);
    const x = contact.x ?? CONFIG.canvas.width / 2;
    const y = contact.y ?? CONFIG.canvas.height / 2;

    const pitch = this.pitchFor(y);
    const isRelease = kind === "release";
    const duration = isRelease ? 0.14 : kind === "rub" ? 0.075 : 0.105;
    const amp =
      (isRelease ? 0.07 + 0.16 * depth : 0.05 + 0.3 * depth) * clamp(strength, 0, 1);

    const voice = ctx.createGain();
    voice.gain.setValueAtTime(0.0001, t);
    voice.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), t + 0.006);
    voice.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    let out = voice;
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp((x / CONFIG.canvas.width) * 2 - 1, -1, 1) * 0.7;
      voice.connect(panner);
      out = panner;
    }
    out.connect(this.master);

    // 1) 사인 톤: 뽀득 / 뽀용
    const osc = ctx.createOscillator();
    osc.type = "sine";
    const base = (isRelease ? 430 : kind === "rub" ? 300 : 235) * pitch;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(55, base * (isRelease ? 0.82 : 0.44)),
      t + duration
    );
    osc.connect(voice);
    osc.start(t);
    osc.stop(t + duration + 0.03);

    // 2) 밴드패스 노이즈: 찰진 느낌
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(isRelease ? 1500 : 420 + 900 * depth, t);
    band.frequency.exponentialRampToValueAtTime(
      isRelease ? 900 : 320 + 500 * depth,
      t + duration * 0.8
    );
    band.Q.value = 1.15;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, t);
    noiseGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp * 0.85), t + 0.004);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.7);

    noise.connect(band);
    band.connect(noiseGain);
    noiseGain.connect(voice);
    noise.start(t);
    noise.stop(t + duration + 0.02);

    // 보이스 카운트 정리
    this.voices++;
    osc.onended = () => {
      this.voices = Math.max(0, this.voices - 1);
      try {
        voice.disconnect();
        osc.disconnect();
        noise.disconnect();
        band.disconnect();
        noiseGain.disconnect();
      } catch {
        /* 이미 끊긴 노드는 무시 */
      }
    };
  }

  pitchFor(y) {
    const H = CONFIG.canvas.height;
    const t = clamp((y - H * 0.15) / (H * 0.7), 0, 1);
    const semitones = 4 - 8 * t; // 위쪽(+4) ~ 아래쪽(-4)
    return Math.pow(2, semitones / 12);
  }
}
