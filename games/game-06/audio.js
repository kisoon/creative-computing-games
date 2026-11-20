/* NEON BEAT — real recording playback + synthesized UI/hit SFX */
(function () {
  "use strict";

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const NOTE_FREQS = [523.25, 659.25, 783.99, 1046.5];

  class NeonAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.musicBus = null;
      this.sfxBus = null;
      this.reverb = null;
      this.delay = null;
      this.noiseBuffer = null;
      this.muted = false;
      this.volume = 0.72;
      this.buffers = new Map();
      this.loads = new Map();
      this.source = null;
      this.sourceGain = null;
      this.sourceStartedAt = 0;
      this.sourceOffset = 0;
    }

    init() {
      if (this.ctx) return;
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      const ctx = new AudioCtor();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0.0001 : this.volume;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -15;
      compressor.knee.value = 24;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.28;
      master.connect(compressor);
      compressor.connect(ctx.destination);
      this.master = master;
      this.compressor = compressor;

      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0.92;
      this.musicBus.connect(master);

      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.84;
      this.sfxBus.connect(master);

      const rate = ctx.sampleRate;
      const length = Math.floor(rate * 2.2);
      const impulse = ctx.createBuffer(2, length, rate);
      for (let channel = 0; channel < 2; channel += 1) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i += 1) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.7);
        }
      }
      const convolver = ctx.createConvolver();
      convolver.buffer = impulse;
      const reverbGain = ctx.createGain();
      reverbGain.gain.value = 0.42;
      convolver.connect(reverbGain);
      reverbGain.connect(master);
      this.reverb = convolver;
      this.reverbGain = reverbGain;

      const delay = ctx.createDelay(0.8);
      delay.delayTime.value = 0.28;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.2;
      const delayWet = ctx.createGain();
      delayWet.gain.value = 0.12;
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(delayWet);
      delayWet.connect(master);
      this.delay = delay;

      const noiseLength = Math.floor(rate * 2);
      const noise = ctx.createBuffer(1, noiseLength, rate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < noiseLength; i += 1) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = noise;
    }

    async unlock() {
      this.init();
      if (this.ctx && this.ctx.state !== "running") {
        try { await this.ctx.resume(); } catch (error) { /* autoplay policy */ }
      }
      return this.ctx;
    }

    now() {
      return this.ctx ? this.ctx.currentTime : 0;
    }

    setMuted(muted) {
      this.muted = muted;
      if (!this.ctx || !this.master) return;
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(muted ? 0.0001 : this.volume, now, 0.025);
    }

    async suspend() {
      if (this.ctx && this.ctx.state === "running") {
        try { await this.ctx.suspend(); } catch (error) { /* no-op */ }
      }
    }

    async resume() {
      if (this.ctx && this.ctx.state !== "running") {
        try { await this.ctx.resume(); } catch (error) { /* no-op */ }
      }
    }

    async fetchArrayBuffer(url, onProgress) {
      const response = await fetch(url, { cache: "force-cache" });
      if (!response.ok) throw new Error("HTTP " + response.status + " · " + url);
      const total = Number(response.headers.get("Content-Length")) || 0;
      if (!response.body || !onProgress || !total) {
        return response.arrayBuffer();
      }
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        onProgress(Math.min(1, received / total));
      }
      const merged = new Uint8Array(received);
      let offset = 0;
      chunks.forEach((chunk) => {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      });
      return merged.buffer;
    }

    async decode(arrayBuffer) {
      this.init();
      if (!this.ctx) throw new Error("Web Audio is not available in this browser.");
      const copy = arrayBuffer.slice(0);
      return new Promise((resolve, reject) => {
        const settle = (buffer) => {
          if (!buffer) reject(new Error("Audio decoding returned no data."));
          else resolve(buffer);
        };
        try {
          const maybePromise = this.ctx.decodeAudioData(copy, settle, reject);
          if (maybePromise && typeof maybePromise.then === "function") {
            maybePromise.then(settle).catch(reject);
          }
        } catch (error) {
          reject(error);
        }
      });
    }

    /**
     * Loads the first decodable URL and caches it. Sources are listed in
     * preference order (OGG first, MP3 fallback for Safari).
     */
    async loadTrack(urls, onProgress) {
      const list = Array.isArray(urls) ? urls : [urls];
      const key = list.join("|");
      if (this.buffers.has(key)) return this.buffers.get(key);
      if (this.loads.has(key)) return this.loads.get(key);

      const job = (async () => {
        let lastError = null;
        for (let index = 0; index < list.length; index += 1) {
          const url = list[index];
          try {
            const arrayBuffer = await this.fetchArrayBuffer(url, (ratio) => {
              if (onProgress) onProgress((index + ratio) / list.length);
            });
            const buffer = await this.decode(arrayBuffer);
            this.buffers.set(key, buffer);
            this.buffers.set(url, buffer);
            return buffer;
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError || new Error("No playable audio source.");
      })();

      this.loads.set(key, job);
      try {
        return await job;
      } finally {
        this.loads.delete(key);
      }
    }

    async loadFile(file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = await this.decode(arrayBuffer);
      this.buffers.set("local:" + file.name + ":" + file.size, buffer);
      return buffer;
    }

    /**
     * Play a decoded recording. `when` and duration use AudioContext time.
     * `offset` selects a segment inside the original recording.
     */
    startSong(buffer, when, offset, duration) {
      this.init();
      if (!this.ctx || !buffer) return;
      this.stopSong(0.04, true);

      const ctx = this.ctx;
      const startAt = Math.max(when, ctx.currentTime + 0.01);
      const playDuration = Math.max(0.05, Math.min(duration, buffer.duration - offset));
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 1;

      // Gentle fade-in avoids a click when the segment starts mid-waveform.
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.linearRampToValueAtTime(1, startAt + 0.06);
      const fadeStart = startAt + Math.max(0.1, playDuration - 0.45);
      gain.gain.setValueAtTime(1, fadeStart);
      gain.gain.linearRampToValueAtTime(0.0001, startAt + playDuration);

      source.connect(gain);
      gain.connect(this.musicBus);
      source.start(startAt, Math.max(0, offset), playDuration);
      source.onended = () => {
        if (this.source === source) {
          this.source = null;
          this.sourceGain = null;
        }
        try { gain.disconnect(); } catch (error) { /* already gone */ }
      };

      this.source = source;
      this.sourceGain = gain;
      this.sourceStartedAt = startAt;
      this.sourceOffset = offset;
    }

    stopSong(fadeSeconds, immediate) {
      if (!this.ctx) {
        this.source = null;
        this.sourceGain = null;
        return;
      }
      const source = this.source;
      const gain = this.sourceGain;
      this.source = null;
      this.sourceGain = null;
      if (!source || !gain) return;

      const now = this.ctx.currentTime;
      const fade = immediate ? 0.012 : Math.max(0.02, fadeSeconds || 0.08);
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
        gain.gain.linearRampToValueAtTime(0.0001, now + fade);
      } catch (error) { /* scheduling unavailable */ }
      try { source.stop(now + fade + 0.015); } catch (error) { /* already stopped */ }
    }

    /* ---------- hit / UI sound effects ---------- */

    sfxTone(freq, when, duration, volume, type, slideTo) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, when);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, when + duration);
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0.0001, when);
      envelope.gain.exponentialRampToValueAtTime(volume, when + 0.006);
      envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      osc.connect(envelope);
      envelope.connect(this.sfxBus);
      osc.start(when);
      osc.stop(when + duration + 0.02);
    }

    hit(grade, lane) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime + 0.001;
      const base = NOTE_FREQS[lane] || 660;
      if (grade === "perfect") {
        this.sfxTone(base, now, 0.1, 0.045, "triangle");
        this.sfxTone(base * 1.5, now + 0.035, 0.14, 0.022, "sine");
      } else if (grade === "good") {
        this.sfxTone(base, now, 0.085, 0.034, "triangle");
      } else {
        this.sfxTone(base, now, 0.065, 0.026, "sine");
      }
    }

    chord() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime + 0.001;
      this.sfxTone(1318.5, now, 0.12, 0.018, "sine");
      this.sfxTone(1760, now + 0.02, 0.16, 0.014, "sine");
    }

    holdTick() {
      if (!this.ctx) return;
      this.sfxTone(880, this.ctx.currentTime + 0.001, 0.035, 0.012, "sine");
    }

    holdClear() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime + 0.001;
      this.sfxTone(523.25, now, 0.14, 0.038, "sine");
      this.sfxTone(783.99, now + 0.055, 0.2, 0.03, "sine");
      this.sfxTone(1046.5, now + 0.105, 0.24, 0.022, "sine");
    }

    snakeTick() {
      if (!this.ctx) return;
      this.sfxTone(1046.5, this.ctx.currentTime + 0.001, 0.055, 0.024, "triangle");
    }

    miss() {
      if (!this.ctx) return;
      this.sfxTone(145, this.ctx.currentTime + 0.001, 0.15, 0.04, "sawtooth", 74);
    }

    countTick(final) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime + 0.001;
      this.sfxTone(final ? 1046.5 : 659.25, now, final ? 0.2 : 0.085, final ? 0.05 : 0.035, "triangle");
    }

    countAt(when, final) {
      if (!this.ctx) return;
      this.sfxTone(final ? 1046.5 : 659.25, when, final ? 0.2 : 0.085, final ? 0.05 : 0.035, "triangle");
    }

    uiClick() {
      this.sfxTone(520, this.now() + 0.001, 0.045, 0.02, "sine");
    }
  }

  window.NeonAudio = NeonAudio;
})();
