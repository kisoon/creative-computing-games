/* NEON BEAT — real-time Web Audio synth engine */
(function () {
  "use strict";

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
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
      this.song = null;
      this.startAt = 0;
      this.eventIndex = 0;
      this.playing = false;
      this.muted = false;
      this.volume = 0.7;
      this.songBus = null;
      this.songSends = [];
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
      compressor.threshold.value = -16;
      compressor.knee.value = 22;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.28;
      master.connect(compressor);
      compressor.connect(ctx.destination);
      this.master = master;
      this.compressor = compressor;

      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 1;
      this.musicBus.connect(master);

      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.9;
      this.sfxBus.connect(master);

      // Generated plate-ish reverb. No external impulse files needed.
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
      reverbGain.gain.value = 0.6;
      convolver.connect(reverbGain);
      reverbGain.connect(master);
      this.reverb = convolver;
      this.reverbGain = reverbGain;

      const delay = ctx.createDelay(0.8);
      delay.delayTime.value = 0.29;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.24;
      const delayWet = ctx.createGain();
      delayWet.gain.value = 0.17;
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
        try { await this.ctx.resume(); } catch (error) { /* no-op */ }
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

    makeSongBus() {
      const ctx = this.ctx;
      const bus = ctx.createGain();
      bus.gain.value = 1;
      bus.connect(this.musicBus);

      const reverbSend = ctx.createGain();
      reverbSend.gain.value = 0.16;
      bus.connect(reverbSend);
      reverbSend.connect(this.reverb);

      const delaySend = ctx.createGain();
      delaySend.gain.value = 0.07;
      bus.connect(delaySend);
      delaySend.connect(this.delay);

      return { bus, sends: [reverbSend, delaySend] };
    }

    startSong(song, startAt) {
      this.init();
      if (!this.ctx) return;
      this.stopSong(0.08);
      const { bus, sends } = this.makeSongBus();
      this.song = song;
      this.startAt = startAt;
      this.eventIndex = 0;
      this.playing = true;
      this.songBus = bus;
      this.songSends = sends;
      this.schedule();
    }

    stopSong(fadeSeconds) {
      this.playing = false;
      if (!this.ctx || !this.songBus) {
        this.song = null;
        return;
      }
      const bus = this.songBus;
      const sends = this.songSends;
      const now = this.ctx.currentTime;
      const fade = fadeSeconds || 0.08;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
      bus.gain.exponentialRampToValueAtTime(0.0001, now + fade);
      this.songBus = null;
      this.songSends = [];
      this.song = null;
      window.setTimeout(() => {
        try {
          bus.disconnect();
          sends.forEach((send) => send.disconnect());
        } catch (error) { /* already disconnected */ }
      }, Math.max(300, fade * 1000 + 250));
    }

    schedule() {
      if (!this.playing || !this.song || !this.ctx || this.ctx.state !== "running") return;
      const now = this.ctx.currentTime;
      const horizon = now + 0.32;
      const events = this.song.events;
      while (this.eventIndex < events.length) {
        const event = events[this.eventIndex];
        const at = this.startAt + event.t;
        if (at > horizon) break;
        if (at >= now - 0.24) this.playEvent(event, Math.max(at, now + 0.004));
        this.eventIndex += 1;
      }
    }

    playEvent(event, when) {
      if (!this.ctx || when < this.ctx.currentTime - 0.02) return;
      const mix = this.song ? this.song.track.mix : { lead: 0.65, arp: 0.55, pad: 0.7, bass: 0.8, drums: 0.72 };
      switch (event.type) {
        case "lead": this.playLead(event, when, mix); break;
        case "arp": this.playArp(event, when, mix); break;
        case "pad": this.playPad(event, when, mix); break;
        case "bass": this.playBass(event, when, mix); break;
        case "stab": this.playStab(event, when, mix); break;
        case "kick": this.playKick(event, when, mix); break;
        case "snare": this.playSnare(event, when, mix); break;
        case "hat": this.playHat(event, when, mix, false); break;
        case "openhat": this.playHat(event, when, mix, true); break;
        case "clap": this.playClap(event, when, mix); break;
        case "crash": this.playCrash(event, when, mix); break;
        case "riser": this.playRiser(event, when, mix); break;
        default: break;
      }
    }

    connectOut(node, volume) {
      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      node.connect(gain);
      gain.connect(this.songBus);
      return gain;
    }

    playLead(event, when, mix) {
      const ctx = this.ctx;
      const duration = clamp(event.dur || 0.12, 0.055, 2.4);
      const freq = midiToFreq(event.midi);
      const volume = 0.17 * mix.lead * (event.gain || 1) * clamp(1.08 - (event.midi - 64) * 0.005, 0.62, 1.08);
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp((event.midi - 71) / 48, -0.48, 0.48);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 0.8;
      filter.frequency.setValueAtTime(Math.min(12000, Math.max(1400, freq * 8)), when);
      filter.frequency.exponentialRampToValueAtTime(Math.max(520, freq * 2.7), when + duration + 0.08);
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0.0001, when);
      envelope.gain.exponentialRampToValueAtTime(volume, when + 0.012);
      envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume * 0.42), when + Math.min(0.24, duration * 0.55));
      envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration + 0.12);
      filter.connect(envelope);
      envelope.connect(panner);
      panner.connect(this.songBus);

      const wave = event.wave || "saw";
      const oscillators = [];
      const addOsc = (type, freqValue, detune, level) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freqValue, when);
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = level;
        osc.connect(g);
        g.connect(filter);
        osc.start(when);
        osc.stop(when + duration + 0.16);
        oscillators.push(osc);
      };

      if (wave === "bell") {
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(Math.min(10000, freq * 5), when);
        filter.frequency.exponentialRampToValueAtTime(Math.max(900, freq * 1.6), when + duration + 0.2);
        const bellGain = ctx.createGain();
        bellGain.gain.setValueAtTime(0.0001, when);
        bellGain.gain.exponentialRampToValueAtTime(volume * 1.15, when + 0.008);
        bellGain.gain.exponentialRampToValueAtTime(0.0001, when + duration + 0.28);
        filter.disconnect();
        filter.connect(bellGain);
        bellGain.connect(panner);
        const carrier = ctx.createOscillator();
        carrier.type = "sine";
        carrier.frequency.value = freq;
        const mod = ctx.createOscillator();
        mod.type = "sine";
        mod.frequency.value = freq * 3.01;
        const modGain = ctx.createGain();
        modGain.gain.setValueAtTime(freq * 0.8, when);
        modGain.gain.exponentialRampToValueAtTime(freq * 0.04, when + duration + 0.2);
        mod.connect(modGain);
        modGain.connect(carrier.frequency);
        const shimmer = ctx.createOscillator();
        shimmer.type = "sine";
        shimmer.frequency.value = freq * 2.007;
        const shimmerGain = ctx.createGain();
        shimmerGain.gain.setValueAtTime(volume * 0.3, when);
        shimmerGain.gain.exponentialRampToValueAtTime(0.0001, when + duration + 0.2);
        carrier.connect(bellGain);
        shimmer.connect(shimmerGain);
        shimmerGain.connect(panner);
        carrier.start(when);
        mod.start(when);
        shimmer.start(when);
        carrier.stop(when + duration + 0.34);
        mod.stop(when + duration + 0.34);
        shimmer.stop(when + duration + 0.34);
        return;
      }

      if (wave === "square") {
        filter.frequency.setValueAtTime(Math.min(7200, Math.max(1200, freq * 5.2)), when);
        filter.frequency.exponentialRampToValueAtTime(Math.max(600, freq * 2), when + duration + 0.06);
        addOsc("square", freq, 0, 0.62);
        addOsc("triangle", freq * 0.5, 0, 0.25);
      } else if (wave === "brass") {
        addOsc("sawtooth", freq, -6, 0.62);
        addOsc("square", freq, 5, 0.22);
        addOsc("sawtooth", freq * 0.5, 3, 0.24);
        filter.frequency.setValueAtTime(Math.max(800, freq * 1.8), when);
        filter.frequency.linearRampToValueAtTime(Math.min(6800, freq * 5.5), when + 0.07);
        filter.frequency.exponentialRampToValueAtTime(Math.max(500, freq * 1.5), when + duration + 0.08);
      } else {
        addOsc("sawtooth", freq, -7, 0.52);
        addOsc("sawtooth", freq, 7, 0.42);
        addOsc("triangle", freq, 0, 0.24);
      }
    }

    playArp(event, when, mix) {
      const ctx = this.ctx;
      const duration = clamp(event.dur || 0.1, 0.05, 1.8);
      const freq = midiToFreq(event.midi);
      const volume = 0.095 * mix.arp * (event.gain || 1);
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp((event.midi - 70) / 50, -0.5, 0.5);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.min(7000, freq * 7), when);
      filter.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 2.2), when + duration + 0.05);
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0.0001, when);
      envelope.gain.exponentialRampToValueAtTime(volume, when + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration + 0.08);
      filter.connect(envelope);
      envelope.connect(panner);
      panner.connect(this.songBus);
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, when);
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.8;
      const shimmer = ctx.createOscillator();
      shimmer.type = "sine";
      shimmer.frequency.value = freq * 2;
      const shimmerGain = ctx.createGain();
      shimmerGain.gain.value = 0.22;
      osc.connect(oscGain);
      shimmer.connect(shimmerGain);
      oscGain.connect(filter);
      shimmerGain.connect(filter);
      osc.start(when);
      shimmer.start(when);
      osc.stop(when + duration + 0.12);
      shimmer.stop(when + duration + 0.12);
    }

    playPad(event, when, mix) {
      const ctx = this.ctx;
      const duration = clamp(event.dur || 0.8, 0.2, 4.5);
      const notes = event.midis || [];
      if (!notes.length) return;
      const volume = (0.034 * mix.pad * (event.gain || 1)) / Math.sqrt(notes.length);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(720, when);
      filter.frequency.linearRampToValueAtTime(1500, when + 0.38);
      filter.frequency.linearRampToValueAtTime(950, when + duration);
      filter.Q.value = 0.45;
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0.0001, when);
      envelope.gain.linearRampToValueAtTime(volume, when + 0.22);
      envelope.gain.setValueAtTime(volume, when + Math.max(0.24, duration - 0.28));
      envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration + 0.18);
      filter.connect(envelope);
      envelope.connect(this.songBus);

      notes.forEach((midi, index) => {
        const osc = ctx.createOscillator();
        osc.type = index % 2 === 0 ? "sawtooth" : "triangle";
        osc.frequency.value = midiToFreq(midi);
        osc.detune.value = index % 2 === 0 ? -4 : 4;
        const oscGain = ctx.createGain();
        oscGain.gain.value = index % 3 === 0 ? 0.7 : 0.48;
        osc.connect(oscGain);
        oscGain.connect(filter);
        osc.start(when);
        osc.stop(when + duration + 0.26);
      });
    }

    playBass(event, when, mix) {
      const ctx = this.ctx;
      const duration = clamp(event.dur || 0.18, 0.07, 1.5);
      const freq = midiToFreq(event.midi);
      const volume = 0.19 * mix.bass * (event.gain || 1);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 1.1;
      filter.frequency.setValueAtTime(Math.min(900, Math.max(260, freq * 5)), when);
      filter.frequency.exponentialRampToValueAtTime(Math.max(110, freq * 1.35), when + duration + 0.08);
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0.0001, when);
      envelope.gain.exponentialRampToValueAtTime(volume, when + 0.01);
      envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume * 0.42), when + duration);
      envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration + 0.09);
      filter.connect(envelope);
      envelope.connect(this.songBus);
      const saw = ctx.createOscillator();
      saw.type = "sawtooth";
      saw.frequency.value = freq;
      const sawGain = ctx.createGain();
      sawGain.gain.value = 0.6;
      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.value = freq;
      const subGain = ctx.createGain();
      subGain.gain.value = 0.74;
      saw.connect(sawGain);
      sub.connect(subGain);
      sawGain.connect(filter);
      subGain.connect(filter);
      saw.start(when);
      sub.start(when);
      saw.stop(when + duration + 0.12);
      sub.stop(when + duration + 0.12);
    }

    playStab(event, when, mix) {
      const ctx = this.ctx;
      const duration = clamp(event.dur || 0.12, 0.06, 0.5);
      const notes = event.midis || [];
      if (!notes.length) return;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 0.7;
      filter.frequency.value = 1550;
      filter.frequency.exponentialRampToValueAtTime(900, when + duration);
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0.0001, when);
      envelope.gain.exponentialRampToValueAtTime(0.048 * mix.pad, when + 0.01);
      envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration + 0.09);
      filter.connect(envelope);
      envelope.connect(this.songBus);
      notes.slice(0, 4).forEach((midi) => {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = midiToFreq(midi);
        const gain = ctx.createGain();
        gain.gain.value = 0.5;
        osc.connect(gain);
        gain.connect(filter);
        osc.start(when);
        osc.stop(when + duration + 0.1);
      });
    }

    playKick(event, when, mix) {
      const ctx = this.ctx;
      const volume = 0.58 * mix.drums * (event.gain || 1);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(155, when);
      osc.frequency.exponentialRampToValueAtTime(44, when + 0.14);
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(volume, when);
      envelope.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
      osc.connect(envelope);
      envelope.connect(this.songBus);
      osc.start(when);
      osc.stop(when + 0.32);
      const click = ctx.createBufferSource();
      click.buffer = this.noiseBuffer;
      const clickFilter = ctx.createBiquadFilter();
      clickFilter.type = "highpass";
      clickFilter.frequency.value = 2600;
      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(volume * 0.16, when);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.026);
      click.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(this.songBus);
      click.start(when);
      click.stop(when + 0.035);
    }

    playSnare(event, when, mix) {
      const ctx = this.ctx;
      const volume = 0.32 * mix.drums * (event.gain || 1);
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1850;
      filter.Q.value = 0.65;
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(volume, when);
      envelope.gain.exponentialRampToValueAtTime(0.0001, when + 0.19);
      noise.connect(filter);
      filter.connect(envelope);
      envelope.connect(this.songBus);
      noise.start(when);
      noise.stop(when + 0.22);
      const tone = ctx.createOscillator();
      tone.type = "triangle";
      tone.frequency.setValueAtTime(190, when);
      tone.frequency.exponentialRampToValueAtTime(130, when + 0.08);
      const toneGain = ctx.createGain();
      toneGain.gain.setValueAtTime(volume * 0.45, when);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
      tone.connect(toneGain);
      toneGain.connect(this.songBus);
      tone.start(when);
      tone.stop(when + 0.1);
    }

    playHat(event, when, mix, open) {
      const ctx = this.ctx;
      const duration = open ? 0.25 : 0.045;
      const volume = (open ? 0.1 : 0.062) * mix.drums * (event.gain || 1);
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = open ? 6800 : 8200;
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(volume, when);
      envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      noise.connect(filter);
      filter.connect(envelope);
      envelope.connect(this.songBus);
      noise.start(when);
      noise.stop(when + duration + 0.01);
    }

    playClap(event, when, mix) {
      const ctx = this.ctx;
      const volume = 0.2 * mix.drums * (event.gain || 1);
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1200;
      filter.Q.value = 1.1;
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0.0001, when);
      envelope.gain.exponentialRampToValueAtTime(volume, when + 0.004);
      envelope.gain.exponentialRampToValueAtTime(volume * 0.4, when + 0.02);
      envelope.gain.exponentialRampToValueAtTime(volume, when + 0.028);
      envelope.gain.exponentialRampToValueAtTime(0.0001, when + 0.15);
      noise.connect(filter);
      filter.connect(envelope);
      envelope.connect(this.songBus);
      noise.start(when);
      noise.stop(when + 0.17);
    }

    playCrash(event, when, mix) {
      const ctx = this.ctx;
      const volume = 0.14 * mix.drums * (event.gain || 1);
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 4300;
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(volume, when);
      envelope.gain.exponentialRampToValueAtTime(0.0001, when + 1.25);
      noise.connect(filter);
      filter.connect(envelope);
      envelope.connect(this.songBus);
      noise.start(when);
      noise.stop(when + 1.3);
    }

    playRiser(event, when, mix) {
      const ctx = this.ctx;
      const duration = clamp(event.dur || 1, 0.4, 3);
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 1.4;
      filter.frequency.setValueAtTime(420, when);
      filter.frequency.exponentialRampToValueAtTime(7600, when + duration);
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0.0001, when);
      envelope.gain.linearRampToValueAtTime(0.12 * mix.drums * (event.gain || 1), when + duration * 0.82);
      envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      noise.connect(filter);
      filter.connect(envelope);
      envelope.connect(this.songBus);
      noise.start(when);
      noise.stop(when + duration + 0.03);
    }

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

    holdTick() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime + 0.001;
      this.sfxTone(880, now, 0.035, 0.012, "sine");
    }

    holdClear() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime + 0.001;
      this.sfxTone(523.25, now, 0.14, 0.038, "sine");
      this.sfxTone(783.99, now + 0.055, 0.2, 0.03, "sine");
    }

    snakeTick() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime + 0.001;
      this.sfxTone(1046.5, now, 0.055, 0.024, "triangle");
    }

    miss() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime + 0.001;
      this.sfxTone(145, now, 0.15, 0.04, "sawtooth", 74);
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
