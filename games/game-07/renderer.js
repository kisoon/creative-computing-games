/* NEON BEAT — canvas stage renderer */
(function () {
  "use strict";

  const TAU = Math.PI * 2;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function hexToRgb(hex) {
    let value = String(hex || "#ffffff").replace("#", "");
    if (value.length === 3) value = value.split("").map((ch) => ch + ch).join("");
    const number = parseInt(value, 16);
    return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
  }

  function rgba(hex, alpha) {
    const c = hexToRgb(hex);
    return "rgba(" + c.r + "," + c.g + "," + c.b + "," + alpha + ")";
  }

  function mixHex(a, b, amount) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    const value = (channelA, channelB) => Math.round(channelA + (channelB - channelA) * amount);
    const toHex = (number) => number.toString(16).padStart(2, "0");
    return "#" + toHex(value(ca.r, cb.r)) + toHex(value(ca.g, cb.g)) + toHex(value(ca.b, cb.b));
  }

  function smoothstep(t) {
    const x = clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function makeLaneColors(track) {
    return [
      track.accent,
      track.accent2,
      mixHex(track.accent, "#ffd166", 0.42),
      mixHex(track.accent2, "#ff4d9d", 0.35)
    ];
  }

  class StageRenderer {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.metrics = null;
      this.laneColors = ["#ff4d9d", "#4de8ff", "#ffd166", "#a58cff"];
    }

    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
    }

    resize(speedFactor) {
      if (!this.canvas) return null;
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const width = Math.max(320, rect.width || window.innerWidth);
      const height = Math.max(420, rect.height || window.innerHeight);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.width = width;
      this.height = height;
      this.dpr = dpr;
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
      this.canvas.style.width = width + "px";
      this.canvas.style.height = height + "px";
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.metrics = this.computeMetrics(width, height, speedFactor || 1.25);
      return this.metrics;
    }

    computeMetrics(width, height, speedFactor) {
      const compact = width < 720 || height < 680;
      let laneW = Math.min(118, width * 0.94 / 4);
      if (compact) laneW = Math.min(laneW, 102);
      if (height < 560) laneW = Math.min(laneW, 82);
      const laneAreaW = laneW * 4;
      const left = (width - laneAreaW) / 2;
      const hitY = height - (compact ? 129 : 158);
      const keyTop = hitY + 31;
      const keyHeight = Math.max(58, height - keyTop - (compact ? 12 : 21));
      const approach = 2.08 / speedFactor;
      const speed = (hitY + 50) / approach;
      return {
        width,
        height,
        laneW,
        laneAreaW,
        left,
        right: left + laneAreaW,
        hitY,
        keyTop,
        keyHeight,
        speed,
        approach,
        compact
      };
    }

    laneCenter(lane) {
      const m = this.metrics;
      return m.left + m.laneW * (lane + 0.5);
    }

    laneFromX(clientX) {
      if (!this.metrics) return -1;
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      if (x < this.metrics.left || x > this.metrics.right) return -1;
      return clamp(Math.floor((x - this.metrics.left) / this.metrics.laneW), 0, 3);
    }

    draw(state, now) {
      if (!this.ctx || !state.song) return;
      const ctx = this.ctx;
      const m = this.metrics || this.resize(state.speedFactor);
      const track = state.song.track;
      this.laneColors = makeLaneColors(track);
      const songTime = state.songTime || 0;
      const beatDur = state.song.beatDur;
      const beatProgress = state.phase === "playing" || state.phase === "countdown"
        ? ((songTime / beatDur) % 1 + 1) % 1
        : 0;
      const beatPulse = Math.pow(1 - beatProgress, 5);

      let shakeX = 0;
      let shakeY = 0;
      if (now < state.shakeUntil) {
        const power = (state.shakeUntil - now) * 60;
        shakeX = Math.sin(now * 94) * power;
        shakeY = Math.cos(now * 77) * power * 0.6;
      }

      ctx.save();
      ctx.translate(shakeX, shakeY);
      this.drawBackground(ctx, m, track, songTime, beatPulse, now);
      this.drawHighway(ctx, m, state, songTime);
      this.drawNotes(ctx, m, state, songTime, now);
      this.drawHitZone(ctx, m, state, now, beatPulse);
      this.drawKeys(ctx, m, state, now, beatPulse);
      this.drawParticles(ctx, state, now);
      this.drawOverlayFx(ctx, m, state, now);
      ctx.restore();
    }

    drawBackground(ctx, m, track, songTime, beatPulse, now) {
      const w = m.width;
      const h = m.height;
      const base = ctx.createLinearGradient(0, 0, 0, h);
      base.addColorStop(0, "#050711");
      base.addColorStop(0.55, "#04060e");
      base.addColorStop(1, "#02040a");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);

      const drift = Math.sin(songTime * 0.24) * 0.06;
      const glowA = ctx.createRadialGradient(w * (0.72 + drift), h * 0.18, 0, w * (0.72 + drift), h * 0.18, h * 0.72);
      glowA.addColorStop(0, rgba(track.accent, 0.16 + beatPulse * 0.025));
      glowA.addColorStop(0.48, rgba(track.accent, 0.035));
      glowA.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glowA;
      ctx.fillRect(0, 0, w, h);

      const glowB = ctx.createRadialGradient(w * 0.22, h * 0.88, 0, w * 0.22, h * 0.88, h * 0.65);
      glowB.addColorStop(0, rgba(track.accent2, 0.085));
      glowB.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glowB;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.globalAlpha = 0.075;
      ctx.strokeStyle = "#f7f2e6";
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i += 1) {
        const y = 92 + i * 11;
        ctx.beginPath();
        ctx.moveTo(w * 0.06, y);
        ctx.lineTo(w * 0.94, y);
        ctx.stroke();
      }
      for (let i = 0; i < 5; i += 1) {
        const y = h * 0.68 + i * 11;
        ctx.beginPath();
        ctx.moveTo(w * 0.08, y);
        ctx.lineTo(w * 0.92, y);
        ctx.stroke();
      }
      ctx.restore();

      const leftRay = ctx.createLinearGradient(0, 0, w * 0.38, h);
      leftRay.addColorStop(0, rgba(track.accent2, 0.05));
      leftRay.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = leftRay;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.12);
      ctx.lineTo(w * 0.2, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();

      const rightRay = ctx.createLinearGradient(w, h * 0.35, w * 0.65, h);
      rightRay.addColorStop(0, rgba(track.accent, 0.045));
      rightRay.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rightRay;
      ctx.beginPath();
      ctx.moveTo(w, h * 0.18);
      ctx.lineTo(w, 0);
      ctx.lineTo(w * 0.78, 0);
      ctx.closePath();
      ctx.fill();

      const vignette = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.2, w / 2, h * 0.55, h * 0.9);
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.58)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      for (let y = 0; y < h; y += 4) {
        ctx.fillRect(0, y, w, 1);
      }
      ctx.restore();
    }

    drawHighway(ctx, m, state, songTime) {
      const track = state.song.track;
      const left = m.left;
      const right = m.right;
      const top = 0;
      const bottom = m.hitY + 2;
      const laneW = m.laneW;

      const glass = ctx.createLinearGradient(0, top, 0, bottom);
      glass.addColorStop(0, "rgba(5,7,14,0.16)");
      glass.addColorStop(0.35, "rgba(5,7,14,0.66)");
      glass.addColorStop(1, "rgba(3,5,11,0.82)");
      ctx.fillStyle = glass;
      ctx.fillRect(left, top, right - left, bottom - top);

      for (let lane = 0; lane < 4; lane += 1) {
        if (lane % 2 === 1) {
          ctx.fillStyle = "rgba(255,255,255,0.014)";
          ctx.fillRect(left + lane * laneW, top, laneW, bottom - top);
        }
        const laneGlow = ctx.createLinearGradient(0, bottom - 150, 0, bottom);
        laneGlow.addColorStop(0, "rgba(0,0,0,0)");
        laneGlow.addColorStop(1, rgba(this.laneColors[lane], 0.035));
        ctx.fillStyle = laneGlow;
        ctx.fillRect(left + lane * laneW + 1, bottom - 150, laneW - 2, 150);
      }

      // Faint five-line staves, like an arcade score that became sheet music.
      ctx.save();
      const staffGap = 9;
      const staffGroup = 52;
      for (let base = 58; base < bottom - 40; base += 148) {
        for (let line = 0; line < 5; line += 1) {
          const y = base + line * staffGap;
          ctx.strokeStyle = "rgba(247,242,230," + (line === 0 || line === 4 ? 0.055 : 0.036) + ")";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(left + 10, y);
          ctx.lineTo(right - 10, y);
          ctx.stroke();
        }
      }
      ctx.restore();

      // Moving measure bars give the highway a score-like pulse.
      const firstMeasure = Math.floor((songTime - 1.2) / state.song.barDur);
      const lastMeasure = Math.ceil((songTime + m.approach) / state.song.barDur);
      ctx.save();
      for (let measure = Math.max(0, firstMeasure); measure <= lastMeasure; measure += 1) {
        const measureTime = measure * state.song.barDur;
        const y = m.hitY - (measureTime - songTime) * m.speed;
        if (y < 14 || y > m.hitY - 2) continue;
        ctx.strokeStyle = "rgba(247,242,230," + (measure % 4 === 0 ? 0.10 : 0.055) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(left + 8, y);
        ctx.lineTo(right - 8, y);
        ctx.stroke();
        if (measure % 4 === 0) {
          ctx.fillStyle = "rgba(247,242,230,0.2)";
          ctx.font = "7px " + "SFMono-Regular, Menlo, monospace";
          ctx.textAlign = "left";
          ctx.fillText(String(measure + 1).padStart(2, "0"), left - 22, y + 2);
        }
      }
      ctx.restore();

      const topFade = ctx.createLinearGradient(0, 0, 0, 120);
      topFade.addColorStop(0, "rgba(4,6,13,0.94)");
      topFade.addColorStop(1, "rgba(4,6,13,0)");
      ctx.fillStyle = topFade;
      ctx.fillRect(left, 0, right - left, 120);

      for (let lane = 0; lane <= 4; lane += 1) {
        const x = left + lane * laneW;
        const isEdge = lane === 0 || lane === 4;
        ctx.strokeStyle = isEdge ? "rgba(247,242,230,0.17)" : "rgba(247,242,230,0.075)";
        ctx.lineWidth = isEdge ? 1.4 : 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, bottom);
        ctx.stroke();
      }

      const sideLight = ctx.createLinearGradient(left - 30, 0, left, 0);
      sideLight.addColorStop(0, "rgba(0,0,0,0)");
      sideLight.addColorStop(1, rgba(track.accent, 0.04));
      ctx.fillStyle = sideLight;
      ctx.fillRect(left - 30, 0, 30, bottom);

      const sideLightR = ctx.createLinearGradient(right, 0, right + 30, 0);
      sideLightR.addColorStop(0, rgba(track.accent2, 0.04));
      sideLightR.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sideLightR;
      ctx.fillRect(right, 0, 30, bottom);
    }

    drawNotes(ctx, m, state, songTime, now) {
      const notes = state.chart ? state.chart.notes : [];
      const laneW = m.laneW;
      ctx.save();
      ctx.beginPath();
      ctx.rect(m.left - 15, 0, m.laneAreaW + 30, m.hitY + 14);
      ctx.clip();

      for (let i = 0; i < notes.length; i += 1) {
        const note = notes[i];
        if (note.type === "snake") {
          this.drawSnake(ctx, m, state, note, songTime, now);
          continue;
        }
        const y = m.hitY - (note.time - songTime) * m.speed;
        if (note.type === "hold") {
          this.drawHold(ctx, m, state, note, y, songTime, now);
        } else {
          this.drawTap(ctx, m, state, note, y, now);
        }
      }
      ctx.restore();
    }

    noteAlpha(note, now) {
      if (note.status === "hit" || note.status === "missed") {
        const age = now - (note.statusAt || now);
        return Math.max(0, 1 - age / 0.42);
      }
      return 1;
    }

    drawTap(ctx, m, state, note, y, now) {
      if (y < -55 || y > m.hitY + 68) return;
      const alpha = this.noteAlpha(note, now);
      if (alpha <= 0) return;
      const laneW = m.laneW;
      const width = laneW - 18;
      const height = Math.min(44, laneW * 0.43);
      const x = this.laneCenter(note.lane) - width / 2;
      const color = this.laneColors[note.lane];
      const near = Math.abs(note.time - (state.songTime || 0)) < 0.09;
      const drawY = y - height / 2;

      ctx.save();
      ctx.globalAlpha = alpha;
      if (note.status === "missed") {
        ctx.shadowColor = "rgba(255,93,93,0.65)";
      } else {
        ctx.shadowColor = rgba(color, 0.52);
      }
      ctx.shadowBlur = near ? 28 : 15;
      const gradient = ctx.createLinearGradient(0, drawY, 0, drawY + height);
      gradient.addColorStop(0, note.status === "missed" ? "#ff8585" : mixHex(color, "#ffffff", 0.34));
      gradient.addColorStop(0.52, note.status === "missed" ? "#c93838" : color);
      gradient.addColorStop(1, note.status === "missed" ? "#701e1e" : mixHex(color, "#111421", 0.48));
      ctx.fillStyle = gradient;
      roundedRect(ctx, x, drawY, width, height, 7);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.38)";
      ctx.lineWidth = 1;
      roundedRect(ctx, x + 0.5, drawY + 0.5, width - 1, height - 1, 6.5);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.29)";
      ctx.fillRect(x + 7, drawY + 4, width - 14, 1);
      ctx.fillStyle = "rgba(4,6,12,0.54)";
      ctx.font = "700 " + Math.round(height * 0.46) + "px Georgia, serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("♪", this.laneCenter(note.lane), drawY + height / 2 + 1);

      if (near) {
        const ring = ctx.createRadialGradient(this.laneCenter(note.lane), m.hitY, 0, this.laneCenter(note.lane), m.hitY, laneW * 0.7);
        ring.addColorStop(0, rgba(color, 0.18));
        ring.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = ring;
        ctx.fillRect(this.laneCenter(note.lane) - laneW, m.hitY - laneW, laneW * 2, laneW * 2);
      }
      ctx.restore();
    }

    drawHold(ctx, m, state, note, headY, songTime, now) {
      const alpha = this.noteAlpha(note, now);
      if (alpha <= 0) return;
      const laneW = m.laneW;
      const laneX = this.laneCenter(note.lane);
      const color = this.laneColors[note.lane];
      const bodyW = Math.max(28, laneW * 0.43);
      const tailY = m.hitY - (note.endTime - songTime) * m.speed;
      const isActive = note.status === "active";
      const visibleTop = Math.max(-80, Math.min(tailY, headY));
      const visibleBottom = Math.min(m.hitY + 10, Math.max(tailY, headY));
      const height = Math.min(44, laneW * 0.43);
      const headVisible = headY > -55 && headY < m.hitY + 68;

      ctx.save();
      ctx.globalAlpha = alpha;

      if (visibleBottom > visibleTop + 4 && visibleBottom > -40) {
        ctx.shadowColor = rgba(color, 0.34);
        ctx.shadowBlur = 18;
        const bodyGradient = ctx.createLinearGradient(0, visibleTop, 0, Math.max(visibleTop + 1, visibleBottom));
        bodyGradient.addColorStop(0, rgba(color, isActive ? 0.35 : 0.17));
        bodyGradient.addColorStop(0.5, rgba(color, isActive ? 0.78 : 0.55));
        bodyGradient.addColorStop(1, rgba(color, 0.82));
        ctx.fillStyle = bodyGradient;
        roundedRect(ctx, laneX - bodyW / 2, visibleTop, bodyW, Math.max(6, visibleBottom - visibleTop), bodyW / 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = rgba(color, 0.7);
        ctx.lineWidth = 1.2;
        roundedRect(ctx, laneX - bodyW / 2 + 0.5, visibleTop + 0.5, bodyW - 1, Math.max(5, visibleBottom - visibleTop - 1), bodyW / 2);
        ctx.stroke();

        ctx.save();
        roundedRect(ctx, laneX - bodyW / 2, visibleTop, bodyW, Math.max(6, visibleBottom - visibleTop), bodyW / 2);
        ctx.clip();
        ctx.strokeStyle = "rgba(4,6,12,0.5)";
        ctx.lineWidth = 2;
        const chevronStep = 30;
        const scroll = ((songTime * 92) % chevronStep);
        for (let y = visibleBottom - scroll; y > visibleTop - 20; y -= chevronStep) {
          ctx.beginPath();
          ctx.moveTo(laneX - bodyW * 0.2, y);
          ctx.lineTo(laneX, y - 7);
          ctx.lineTo(laneX + bodyW * 0.2, y);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (headVisible) {
        const width = laneW - 18;
        const drawY = headY - height / 2;
        ctx.shadowColor = rgba(color, 0.48);
        ctx.shadowBlur = isActive ? 26 : 15;
        const gradient = ctx.createLinearGradient(0, drawY, 0, drawY + height);
        gradient.addColorStop(0, mixHex(color, "#ffffff", 0.42));
        gradient.addColorStop(1, mixHex(color, "#111421", 0.4));
        ctx.fillStyle = gradient;
        roundedRect(ctx, laneX - width / 2, drawY, width, height, 7);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,0.42)";
        ctx.stroke();
        ctx.fillStyle = "rgba(4,6,12,0.65)";
        ctx.font = "800 8px SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("HOLD", laneX, drawY + height / 2 + 1);
      }
      ctx.restore();
    }

    snakeLaneAt(note, relativeTime) {
      const path = note.path;
      if (!path || path.length === 0) return note.lane;
      if (relativeTime <= 0) return path[0].lane;
      if (relativeTime >= note.duration) return path[path.length - 1].lane;
      for (let i = 0; i < path.length - 1; i += 1) {
        const start = path[i];
        const end = path[i + 1];
        if (relativeTime >= start.offset && relativeTime <= end.offset) {
          const t = smoothstep((relativeTime - start.offset) / Math.max(0.0001, end.offset - start.offset));
          return start.lane + (end.lane - start.lane) * t;
        }
      }
      return path[path.length - 1].lane;
    }

    drawSnake(ctx, m, state, note, songTime, now) {
      const alpha = this.noteAlpha(note, now);
      if (alpha <= 0) return;
      const relative = songTime - note.time;
      const isActive = note.status === "active";
      const pendingHeadY = m.hitY - (note.time - songTime) * m.speed;
      if (!isActive && pendingHeadY < -90) return;
      if (songTime > note.endTime + 0.5) return;

      const sampleStart = Math.max(0, relative);
      const sampleEnd = note.duration;
      const points = [];
      const step = 0.035;
      for (let offset = sampleStart; offset <= sampleEnd + 0.001; offset += step) {
        const lane = this.snakeLaneAt(note, offset);
        const x = m.left + m.laneW * (lane + 0.5);
        const y = m.hitY - (offset - relative) * m.speed;
        if (y < -90) break;
        points.push({ x, y });
      }
      if (!points.length) return;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.shadowColor = "rgba(141,255,191,0.5)";
      ctx.shadowBlur = isActive ? 30 : 20;

      const bodyGradient = ctx.createLinearGradient(0, m.hitY, 0, Math.max(0, points[points.length - 1].y));
      bodyGradient.addColorStop(0, isActive ? "rgba(160,255,207,0.95)" : "rgba(141,255,191,0.75)");
      bodyGradient.addColorStop(0.55, "rgba(77,232,255,0.55)");
      bodyGradient.addColorStop(1, "rgba(77,232,255,0.08)");

      ctx.strokeStyle = "rgba(4,14,10,0.8)";
      ctx.lineWidth = m.laneW * 0.56;
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();

      ctx.strokeStyle = bodyGradient;
      ctx.lineWidth = m.laneW * 0.42;
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.setLineDash([4, 9]);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      // Key caps travel along the snake so the next press is readable.
      let nextCheckpoint = -1;
      if (isActive && note.checkpoints) {
        nextCheckpoint = note.checkpoints.findIndex((checkpoint) => !checkpoint.passed);
      }
      note.path.forEach((pathPoint, index) => {
        if (index === 0) return;
        const y = m.hitY - (pathPoint.offset - relative) * m.speed;
        if (y < -30 || y > m.hitY + 40) return;
        const x = m.left + m.laneW * (pathPoint.lane + 0.5);
        const isNext = isActive && index === nextCheckpoint;
        const pulse = isNext ? 0.75 + Math.sin(now * 12) * 0.2 : 0.38;
        ctx.save();
        ctx.globalAlpha = alpha * pulse;
        ctx.fillStyle = isNext ? "rgba(141,255,191,0.95)" : "rgba(10,20,17,0.86)";
        ctx.strokeStyle = isNext ? "#ffffff" : "rgba(141,255,191,0.65)";
        ctx.lineWidth = isNext ? 2 : 1;
        if (isNext) {
          ctx.shadowColor = "rgba(141,255,191,0.8)";
          ctx.shadowBlur = 18;
        }
        roundedRect(ctx, x - 12, y - 12, 24, 24, 6);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = isNext ? "rgba(3,14,8,0.92)" : "rgba(220,255,237,0.8)";
        ctx.font = "800 10px SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(["D", "F", "J", "K"][pathPoint.lane], x, y + 1);
        ctx.restore();
      });

      const headLane = this.snakeLaneAt(note, Math.max(0, relative));
      const headX = m.left + m.laneW * (headLane + 0.5);
      const headY = isActive ? m.hitY : pendingHeadY;
      if (headY > -30 && headY < m.hitY + 58) {
        const pulse = 1 + Math.sin(now * 9) * 0.07;
        ctx.save();
        ctx.translate(headX, headY);
        ctx.scale(pulse, pulse);
        ctx.shadowColor = "rgba(141,255,191,0.92)";
        ctx.shadowBlur = 28;
        const headGradient = ctx.createLinearGradient(0, -18, 0, 18);
        headGradient.addColorStop(0, "#d4ffe7");
        headGradient.addColorStop(0.45, "#8dffbf");
        headGradient.addColorStop(1, "#28cfa2");
        ctx.fillStyle = headGradient;
        roundedRect(ctx, -m.laneW * 0.31, -19, m.laneW * 0.62, 38, 10);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,0.65)";
        ctx.lineWidth = 1.2;
        roundedRect(ctx, -m.laneW * 0.31, -19, m.laneW * 0.62, 38, 10);
        ctx.stroke();
        ctx.fillStyle = "rgba(3,14,8,0.82)";
        ctx.font = "800 17px SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("↝", 0, 1);
        ctx.restore();

        if (!isActive) {
          const targetLane = note.path[0].lane;
          ctx.save();
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = "rgba(141,255,191,0.9)";
          ctx.font = "700 8px SFMono-Regular, Menlo, monospace";
          ctx.textAlign = "center";
          ctx.fillText("HOLD " + ["D", "F", "J", "K"][targetLane] + " TO START", headX, headY - 30);
          ctx.restore();
        }
      }
      ctx.restore();
    }

    drawHitZone(ctx, m, state, now, beatPulse) {
      const left = m.left;
      const right = m.right;
      const y = m.hitY;
      ctx.save();
      const glow = ctx.createLinearGradient(0, y - 36, 0, y + 22);
      glow.addColorStop(0, "rgba(77,232,255,0)");
      glow.addColorStop(0.72, "rgba(255,255,255,0.04)");
      glow.addColorStop(1, "rgba(77,232,255,0.12)");
      ctx.fillStyle = glow;
      ctx.fillRect(left, y - 36, right - left, 58);

      ctx.shadowColor = "rgba(255,255,255,0.7)";
      ctx.shadowBlur = 16 + beatPulse * 10;
      ctx.strokeStyle = "rgba(247,242,230,0.88)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.shadowBlur = 0;

      for (let lane = 0; lane < 4; lane += 1) {
        const x = this.laneCenter(lane);
        const color = this.laneColors[lane];
        const active = state.keys[lane];
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = active ? "#ffffff" : "rgba(247,242,230,0.7)";
        ctx.shadowColor = rgba(color, 0.8);
        ctx.shadowBlur = active ? 22 : 10;
        ctx.fillRect(-3.5, -3.5, 7, 7);
        ctx.restore();
      }

      ctx.fillStyle = "rgba(247,242,230,0.32)";
      ctx.font = "7px SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "right";
      ctx.fillText("TIMING LINE", right - 10, y - 9);
      ctx.restore();
    }

    drawKeys(ctx, m, state, now, beatPulse) {
      const keyTop = m.keyTop;
      const keyBottom = m.height - (m.compact ? 9 : 17);
      const height = Math.max(56, keyBottom - keyTop);
      const laneW = m.laneW;
      const labels = ["D", "F", "J", "K"];

      for (let lane = 0; lane < 4; lane += 1) {
        const color = this.laneColors[lane];
        const x = m.left + lane * laneW + 6;
        const width = laneW - 12;
        const pressed = state.keys[lane];
        const holdActive = state.activeHolds.some((item) => item.note.lane === lane);
        const snakeActive = state.activeSnake && state.activeSnake.requiredLane === lane;
        const flash = state.laneFlashes[lane] && now < state.laneFlashes[lane].until
          ? state.laneFlashes[lane]
          : null;

        ctx.save();
        if (pressed || holdActive || snakeActive) {
          ctx.shadowColor = rgba(color, 0.7);
          ctx.shadowBlur = 25;
        }
        const keyGradient = ctx.createLinearGradient(0, keyTop, 0, keyTop + height);
        if (pressed || holdActive || snakeActive) {
          keyGradient.addColorStop(0, rgba(color, 0.34));
          keyGradient.addColorStop(1, rgba(color, 0.09));
        } else {
          keyGradient.addColorStop(0, "rgba(255,255,255,0.065)");
          keyGradient.addColorStop(1, "rgba(255,255,255,0.012)");
        }
        ctx.fillStyle = keyGradient;
        roundedRect(ctx, x, keyTop + (pressed ? 2 : 0), width, height - (pressed ? 2 : 0), 8);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = pressed ? rgba(color, 0.85) : "rgba(247,242,230,0.17)";
        ctx.lineWidth = pressed ? 1.5 : 1;
        roundedRect(ctx, x + 0.5, keyTop + (pressed ? 2.5 : 0.5), width - 1, height - (pressed ? 3 : 1), 7.5);
        ctx.stroke();

        ctx.fillStyle = pressed ? rgba(color, 0.95) : rgba(color, 0.55);
        roundedRect(ctx, x + 9, keyTop + (pressed ? 10 : 8), width - 18, 2, 2);
        ctx.fill();

        ctx.fillStyle = flash ? flash.color : (pressed ? "#ffffff" : "rgba(247,242,230,0.74)");
        ctx.font = "700 " + Math.min(24, laneW * 0.22) + "px SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(labels[lane], m.left + lane * laneW + laneW / 2, keyTop + height * 0.46);

        ctx.fillStyle = "rgba(247,242,230,0.23)";
        ctx.font = "6px SFMono-Regular, Menlo, monospace";
        ctx.fillText("LANE 0" + (lane + 1), m.left + lane * laneW + laneW / 2, keyTop + height * 0.68);

        if (holdActive) {
          const pulse = 0.45 + Math.sin(now * 7) * 0.15;
          ctx.strokeStyle = rgba(color, pulse);
          ctx.lineWidth = 1;
          roundedRect(ctx, x + 4, keyTop + 5, width - 8, height - 10, 5);
          ctx.stroke();
        }
        ctx.restore();
      }

      const floorGlow = ctx.createLinearGradient(0, keyBottom - 50, 0, keyBottom);
      floorGlow.addColorStop(0, "rgba(0,0,0,0)");
      floorGlow.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = floorGlow;
      ctx.fillRect(m.left, keyBottom - 50, m.laneAreaW, 50);

      const titleGlow = ctx.createRadialGradient(m.width / 2, keyBottom, 0, m.width / 2, keyBottom, m.width * 0.5);
      titleGlow.addColorStop(0, rgba(this.laneColors[1], 0.12 + beatPulse * 0.03));
      titleGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = titleGlow;
      ctx.fillRect(0, keyBottom - 20, m.width, 50);
    }

    drawParticles(ctx, state, now) {
      if (!state.particles || !state.particles.length) return;
      const particles = state.particles;
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        const age = now - particle.born;
        if (age > particle.life) {
          particles.splice(i, 1);
          continue;
        }
        const progress = age / particle.life;
        const x = particle.x + particle.vx * age;
        const y = particle.y + particle.vy * age + 0.5 * 470 * age * age;
        ctx.save();
        ctx.globalAlpha = (1 - progress) * 0.9;
        ctx.fillStyle = particle.color;
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 10;
        ctx.translate(x, y);
        ctx.rotate(particle.rot + age * particle.spin);
        const size = particle.size * (1 - progress * 0.35);
        if (particle.shape === "diamond") {
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-size / 2, -size / 2, size, size);
        } else {
          ctx.fillRect(-size / 2, -size / 2, size, size * 0.62);
        }
        ctx.restore();
      }

      if (state.rings && state.rings.length) {
        for (let i = state.rings.length - 1; i >= 0; i -= 1) {
          const ring = state.rings[i];
          const age = now - ring.born;
          if (age > ring.life) {
            state.rings.splice(i, 1);
            continue;
          }
          const progress = age / ring.life;
          ctx.save();
          ctx.globalAlpha = (1 - progress) * 0.8;
          ctx.strokeStyle = ring.color;
          ctx.lineWidth = 2 * (1 - progress) + 0.4;
          ctx.beginPath();
          ctx.ellipse(ring.x, ring.y, ring.max * progress, ring.max * progress * 0.42, 0, 0, TAU);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    drawOverlayFx(ctx, m, state, now) {
      const w = m.width;
      const h = m.height;

      if (now < state.missFlashUntil) {
        const alpha = Math.max(0, (state.missFlashUntil - now) * 1.9);
        const flash = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.8);
        flash.addColorStop(0, "rgba(255,50,70,0)");
        flash.addColorStop(1, "rgba(255,50,70," + (alpha * 0.3) + ")");
        ctx.fillStyle = flash;
        ctx.fillRect(0, 0, w, h);
      }

      if (state.activeSnake) {
        const pulse = 0.5 + Math.sin(now * 6) * 0.2;
        ctx.save();
        ctx.strokeStyle = "rgba(141,255,191," + pulse * 0.5 + ")";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([7, 9]);
        roundedRect(ctx, m.left - 8, m.hitY - 116, m.laneAreaW + 16, 142, 10);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  window.NeonRenderer = new StageRenderer();
})();
