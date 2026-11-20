/* =========================================================================
   물불 원정대 · Elemental Duo
   core.js — 상수, 수학 헬퍼, 사운드, 파티클
   ========================================================================= */
(() => {
  "use strict";

  const EG = (window.EG = window.EG || {});

  EG.W = 1280;
  EG.H = 720;
  EG.FLOOR_Y = 640;
  EG.PLAYER_W = 44;
  EG.PLAYER_H = 64;
  EG.TAU = Math.PI * 2;

  EG.PHYS = {
    maxSpeed: 355,
    groundAccel: 3300,
    airAccel: 2150,
    groundFriction: 3000,
    airFriction: 440,
    gravity: 2100,
    lowJumpGravity: 1.3,
    jumpSpeed: 820,
    maxFall: 980,
    coyoteTime: 0.105,
    jumpBufferTime: 0.12,
    poolSpeed: 0.76,
  };

  EG.ELEMENTS = {
    water: {
      name: "물",
      p1: "P1",
      color: "#63e8ff",
      deep: "#187ad6",
      darker: "#0b3f69",
      pale: "#d6fcff",
      rgb: "99, 232, 255",
      glowRgb: "54, 199, 255",
      dangerName: "불",
    },
    fire: {
      name: "불",
      p1: "P2",
      color: "#ffb15a",
      deep: "#ef5125",
      darker: "#5f2519",
      pale: "#fff0b6",
      rgb: "255, 177, 90",
      glowRgb: "255, 124, 51",
      dangerName: "물",
    },
  };

  // -------------------------------------------------------------------------
  // 수학 / 캔버스 헬퍼
  // -------------------------------------------------------------------------
  EG.clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  EG.lerp = (a, b, t) => a + (b - a) * t;
  EG.approach = (value, target, amount) => {
    if (value < target) return Math.min(value + amount, target);
    if (value > target) return Math.max(value - amount, target);
    return target;
  };
  EG.overlaps = (a, b) =>
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y;
  EG.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  EG.easeInOutCubic = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  EG.formatTime = (seconds) => {
    const safe = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(
      safe % 60,
    ).padStart(2, "0")}`;
  };

  EG.roundRect = function roundRect(c, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    c.beginPath();
    c.moveTo(x + radius, y);
    c.arcTo(x + w, y, x + w, y + h, radius);
    c.arcTo(x + w, y + h, x, y + h, radius);
    c.arcTo(x, y + h, x, y, radius);
    c.arcTo(x, y, x + w, y, radius);
    c.closePath();
  };

  EG.drawElementIcon = function drawElementIcon(c, element, x, y, size, color) {
    c.save();
    c.translate(x, y);
    c.fillStyle = color;
    if (element === "water") {
      c.beginPath();
      c.moveTo(0, -size * 0.62);
      c.bezierCurveTo(
        size * 0.44,
        -size * 0.08,
        size * 0.35,
        size * 0.34,
        0,
        size * 0.43,
      );
      c.bezierCurveTo(
        -size * 0.35,
        size * 0.34,
        -size * 0.44,
        -size * 0.08,
        0,
        -size * 0.62,
      );
      c.closePath();
      c.fill();
    } else {
      c.beginPath();
      c.moveTo(0, size * 0.52);
      c.bezierCurveTo(
        -size * 0.42,
        size * 0.4,
        -size * 0.46,
        size * 0.02,
        -size * 0.18,
        -size * 0.2,
      );
      c.bezierCurveTo(
        -size * 0.24,
        -size * 0.4,
        -size * 0.02,
        -size * 0.46,
        size * 0.02,
        -size * 0.62,
      );
      c.bezierCurveTo(
        size * 0.18,
        -size * 0.36,
        size * 0.12,
        -size * 0.24,
        size * 0.24,
        -size * 0.12,
      );
      c.bezierCurveTo(
        size * 0.5,
        size * 0.16,
        size * 0.3,
        size * 0.44,
        0,
        size * 0.52,
      );
      c.closePath();
      c.fill();
    }
    c.restore();
  };

  // 고정된 배경 부유 입자 (매 프레임 생성하지 않음)
  EG.motes = Array.from({ length: 48 }, () => ({
    x: Math.random() * EG.W,
    y: Math.random() * EG.H,
    size: 0.7 + Math.random() * 2.2,
    speed: 4 + Math.random() * 14,
    drift: 5 + Math.random() * 16,
    phase: Math.random() * EG.TAU,
    warm: Math.random() > 0.68,
  }));

  // -------------------------------------------------------------------------
  // 사운드 — 외부 파일 없이 WebAudio로 합성
  // -------------------------------------------------------------------------
  class Sound {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = false;
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume();
        return;
      }
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.52;
      this.master.connect(this.ctx.destination);
    }

    note(freq, start, duration, options = {}) {
      if (!this.ctx || this.muted) return;
      const { type = "sine", volume = 0.055, slide = 1 } = options;
      const t0 = this.ctx.currentTime + start;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (slide !== 1) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(20, freq * slide),
          t0 + duration,
        );
      }
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + duration + 0.035);
    }

    jump(element) {
      if (element === "water") {
        this.note(350, 0, 0.12, { type: "sine", volume: 0.045, slide: 1.7 });
        this.note(700, 0.035, 0.09, { type: "sine", volume: 0.025 });
      } else {
        this.note(260, 0, 0.12, { type: "triangle", volume: 0.05, slide: 1.9 });
        this.note(540, 0.03, 0.1, { type: "square", volume: 0.012 });
      }
    }

    land(element) {
      if (element === "water") {
        this.note(130, 0, 0.07, { type: "sine", volume: 0.022, slide: 0.75 });
      } else {
        this.note(95, 0, 0.075, { type: "triangle", volume: 0.025, slide: 0.8 });
      }
    }

    death() {
      this.note(220, 0, 0.36, { type: "sawtooth", volume: 0.04, slide: 0.34 });
      this.note(110, 0.06, 0.42, { type: "triangle", volume: 0.05, slide: 0.5 });
    }

    plate() {
      this.note(660, 0, 0.15, { type: "sine", volume: 0.04 });
      this.note(990, 0.07, 0.18, { type: "sine", volume: 0.03 });
    }

    gate() {
      [392, 523.25, 659.25, 783.99].forEach((freq, i) => {
        this.note(freq, i * 0.085, 0.35, {
          type: "triangle",
          volume: 0.04,
        });
      });
      this.note(98, 0.2, 0.6, { type: "sine", volume: 0.05, slide: 0.75 });
    }

    arrive() {
      this.note(659.25, 0, 0.24, { type: "sine", volume: 0.05 });
      this.note(880, 0.08, 0.28, { type: "sine", volume: 0.045 });
    }

    win() {
      const melody = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      melody.forEach((freq, i) => {
        this.note(freq, i * 0.12, 0.42, {
          type: "triangle",
          volume: 0.05,
        });
      });
      this.note(261.63, 0.1, 0.8, { type: "sine", volume: 0.04 });
      this.note(392, 0.28, 0.7, { type: "sine", volume: 0.035 });
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.52;
      if (!this.muted) {
        this.init();
        this.note(740, 0, 0.1, { type: "sine", volume: 0.03 });
      }
      return this.muted;
    }
  }

  EG.Sound = Sound;
  EG.sfx = new Sound();

  // -------------------------------------------------------------------------
  // 파티클 / 화면 연출
  // -------------------------------------------------------------------------
  class FX {
    constructor() {
      this.items = [];
      this.rings = [];
      this.shake = 0;
      this.flash = null;
    }

    clear() {
      this.items.length = 0;
      this.rings.length = 0;
      this.shake = 0;
      this.flash = null;
    }

    add(options) {
      const life = options.life ?? 0.6;
      this.items.push({
        x: options.x,
        y: options.y,
        vx: options.vx ?? 0,
        vy: options.vy ?? 0,
        life,
        maxLife: life,
        size: options.size ?? 3,
        color: options.color ?? "#ffffff",
        gravity: options.gravity ?? 0,
        drag: options.drag ?? 1,
        shape: options.shape ?? "circle",
        glow: options.glow ?? 0,
        rotation: options.rotation ?? 0,
        spin: options.spin ?? 0,
        additive: options.additive ?? false,
        shrink: options.shrink ?? true,
      });
      if (this.items.length > 520) this.items.shift();
    }

    burst(x, y, color, count = 18, options = {}) {
      const spread = options.spread ?? 150;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * EG.TAU;
        const speed = spread * (0.28 + Math.random() * 0.9);
        this.add({
          x: x + (Math.random() - 0.5) * (options.jitter ?? 10),
          y: y + (Math.random() - 0.5) * (options.jitter ?? 10),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (options.lift ?? 0),
          life: 0.35 + Math.random() * (options.life ?? 0.55),
          size: (options.size ?? 3) * (0.55 + Math.random()),
          color,
          gravity: options.gravity ?? 330,
          drag: options.drag ?? 0.985,
          glow: options.glow ?? 6,
          shape: options.shape ?? "circle",
          additive: options.additive ?? true,
          spin: (Math.random() - 0.5) * 8,
        });
      }
    }

    ring(x, y, color, maxRadius = 54, life = 0.55, width = 3) {
      this.rings.push({
        x,
        y,
        color,
        radius: 5,
        maxRadius,
        life,
        maxLife: life,
        width,
      });
    }

    screenFlash(color, alpha = 0.2) {
      this.flash = { color, alpha, maxAlpha: alpha };
    }

    confetti() {
      const palette = [
        "#63e8ff",
        "#a5f5ff",
        "#187ad6",
        "#ffb15a",
        "#ff682e",
        "#fff0b6",
        "#ffffff",
      ];
      for (let i = 0; i < 150; i++) {
        this.add({
          x: Math.random() * EG.W,
          y: -20 - Math.random() * 260,
          vx: (Math.random() - 0.5) * 160,
          vy: 70 + Math.random() * 170,
          life: 2.7 + Math.random() * 2.2,
          size: 3 + Math.random() * 5,
          color: palette[Math.floor(Math.random() * palette.length)],
          gravity: 210,
          drag: 0.995,
          shape: "rect",
          rotation: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 10,
          shrink: false,
        });
      }
    }

    update(dt) {
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const ring = this.rings[i];
        ring.life -= dt;
        if (ring.life <= 0) {
          this.rings.splice(i, 1);
          continue;
        }
        const progress = 1 - ring.life / ring.maxLife;
        ring.radius = EG.lerp(5, ring.maxRadius, EG.easeOutCubic(progress));
      }

      for (let i = this.items.length - 1; i >= 0; i--) {
        const p = this.items[i];
        p.life -= dt;
        if (p.life <= 0 || p.y > EG.H + 80) {
          this.items.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt;
        const drag = Math.pow(p.drag, dt * 60);
        p.vx *= drag;
        p.vy *= drag;
        p.rotation += p.spin * dt;
      }

      this.shake = Math.max(0, this.shake - dt * 34);
      if (this.flash) {
        this.flash.alpha -= dt * (this.flash.maxAlpha * 3.2 + 0.4);
        if (this.flash.alpha <= 0) this.flash = null;
      }
    }

    draw(c) {
      for (const ring of this.rings) {
        const alpha = EG.clamp(ring.life / ring.maxLife, 0, 1);
        c.save();
        c.globalAlpha = alpha * 0.9;
        c.globalCompositeOperation = "lighter";
        c.strokeStyle = ring.color;
        c.lineWidth = ring.width * alpha;
        c.beginPath();
        c.ellipse(ring.x, ring.y, ring.radius, ring.radius * 0.42, 0, 0, EG.TAU);
        c.stroke();
        c.restore();
      }

      c.save();
      for (const p of this.items) {
        const alpha = EG.clamp(p.life / p.maxLife, 0, 1);
        const color = p.color;
        c.globalAlpha = alpha;
        c.globalCompositeOperation = p.additive ? "lighter" : "source-over";
        if (p.glow) {
          c.shadowBlur = p.glow;
          c.shadowColor = color;
        } else {
          c.shadowBlur = 0;
        }
        c.fillStyle = color;

        if (p.shape === "rect") {
          c.save();
          c.translate(p.x, p.y);
          c.rotate(p.rotation);
          c.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.62);
          c.restore();
        } else if (p.shape === "spark") {
          c.save();
          c.translate(p.x, p.y);
          c.rotate(Math.atan2(p.vy, p.vx));
          c.fillRect(-p.size * 0.7, -0.7, p.size * 1.8, 1.5);
          c.restore();
        } else {
          const size = p.shrink ? p.size * (0.4 + alpha * 0.6) : p.size;
          c.beginPath();
          c.arc(p.x, p.y, Math.max(0.3, size), 0, EG.TAU);
          c.fill();
        }
      }
      c.restore();
    }
  }

  EG.FX = FX;
  EG.fx = new FX();
})();
