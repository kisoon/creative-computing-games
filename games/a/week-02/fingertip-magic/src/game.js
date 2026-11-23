import { CONFIG } from './config.js';
import { clamp, dist, lerp, rand } from './util.js';

function burst(x, y, n, s = 1) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (40 + Math.random() * 220) * s;
    const life = 0.4 + Math.random() * 0.8;
    out.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 60,
      r: 1 + Math.random() * 2.5,
      life, max: life,
    });
  }
  return out;
}

export class Game {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.reset();
  }

  reset() {
    this.time = 0;
    this.score = 0;
    this.candles = [0.18, 0.5, 0.82].map((fx) => ({
      x: fx * this.w,
      y: this.h * 0.58,
      r: 26,
      lit: false,
      seed: Math.random() * 100,
    }));
    this.fireballs = [];
    this.embers = [];
    this.sparks = [];
    this.spawnTimer = 1.5;
    this.shield = { active: false, x: this.w / 2, y: this.h / 2, face: { x: 0, y: -1 }, radius: 80, alpha: 0 };
    this.cleared = false;
    this.toast = '';
    this.toastT = 0;
  }

  say(msg, t = 1.6) { this.toast = msg; this.toastT = t; }

  launch(origin, dir, power) {
    const p = clamp(power, 0, 1);
    const speed = lerp(CONFIG.fireballSpeedMin, CONFIG.fireballSpeedMax, p);
    this.fireballs.push({
      x: origin.x, y: origin.y,
      vx: dir.x * speed, vy: dir.y * speed,
      r: 9 + 13 * p,
      power: p,
      dead: false,
    });
    this.sparks.push(...burst(origin.x, origin.y, 10, 0.7));
  }

  update(dt, f, g) {
    this.time += dt;
    if (this.toastT > 0) this.toastT -= dt;

    this._updateShield(dt, f, g);
    this._spawnEmbers(dt);
    this._updateFireballs(dt);
    this._updateEmbers(dt);
    this._updateSparks(dt);
  }

  _updateShield(dt, f, g) {
    const sh = this.shield;
    const want = g && g.state === 'SHIELD' && f && f.hasHand;

    if (want) {
      const k = 1 - Math.exp(-CONFIG.shieldFollowK * dt);
      sh.x += (f.palm.x - sh.x) * k;
      sh.y += (f.palm.y - sh.y) * k;
      sh.radius = Math.max(CONFIG.shieldMinRadius, f.handSize * CONFIG.shieldRadiusHand);
      if (f.speedN > 1.0) {
        sh.face.x = lerp(sh.face.x, f.dir.x, CONFIG.shieldFaceSmooth);
        sh.face.y = lerp(sh.face.y, f.dir.y, CONFIG.shieldFaceSmooth);
        const m = Math.hypot(sh.face.x, sh.face.y) || 1;
        sh.face.x /= m;
        sh.face.y /= m;
      }
      sh.active = true;
      sh.alpha = Math.min(1, sh.alpha + dt * 6);
    } else {
      sh.alpha = Math.max(0, sh.alpha - dt * 4);
      sh.active = sh.alpha > 0.02;
    }
  }

  _spawnEmbers(dt) {
    if (this.cleared) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    this.spawnTimer = rand(1.2, 2.4);
    const n = Math.random() < 0.3 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      this.embers.push({
        x: rand(0.08, 0.92) * this.w,
        y: -20,
        vy: rand(90, 170),
        r: rand(6, 10),
        dead: false,
      });
    }
  }

  _updateFireballs(dt) {
    for (const b of this.fireballs) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < -80 || b.x > this.w + 80 || b.y < -80 || b.y > this.h + 80) {
        b.dead = true;
        continue;
      }

      for (const c of this.candles) {
        if (c.lit || dist(b, c) > c.r + b.r) continue;
        c.lit = true;
        b.dead = true;
        this.score += 100;
        this.sparks.push(...burst(c.x, c.y, 28, 1.5));
        this.say('촛불 점화! +100');
        if (this.candles.every((x) => x.lit)) {
          this.cleared = true;
          this.say('클리어! R 로 다시 시작');
        }
      }
    }
    this.fireballs = this.fireballs.filter((b) => !b.dead);
  }

  _updateEmbers(dt) {
    const sh = this.shield;
    for (const e of this.embers) {
      e.y += e.vy * dt;

      if (sh.active) {
        const d = dist(e, sh);
        if (d < sh.radius + e.r) {
          const nx = (e.x - sh.x) / (d || 1);
          const ny = (e.y - sh.y) / (d || 1);
          // 방어막이 향한 쪽에서 온 것만 막는다
          if (nx * sh.face.x + ny * sh.face.y > 0.15) {
            e.dead = true;
            this.score += 50;
            this.sparks.push(...burst(e.x, e.y, 16, 1.0));
            this.say('방어 성공 +50', 1.0);
            continue;
          }
        }
      }

      for (const c of this.candles) {
        if (dist(e, c) > c.r) continue;
        e.dead = true;
        if (c.lit) {
          c.lit = false;
          this.score = Math.max(0, this.score - 50);
          this.say('촛불이 꺼졌다 -50');
        }
      }

      if (e.y > this.h + 40) e.dead = true;
    }
    this.embers = this.embers.filter((e) => !e.dead);
  }

  _updateSparks(dt) {
    for (const s of this.sparks) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 320 * dt;
      s.life -= dt;
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
  }

  // 빛을 내는 오브젝트 목록 (어둠 뚫기 + 글로우 공용)
  getLights(g) {
    const L = [];
    if (g && g.orb > 0) {
      L.push({ x: g.orbPos.x, y: g.orbPos.y, r: 130 + 170 * g.orbPower, power: 0.9 });
    }
    for (const c of this.candles) {
      if (c.lit) L.push({ x: c.x, y: c.y - 12, r: 140, power: 0.8 });
    }
    for (const b of this.fireballs) {
      L.push({ x: b.x, y: b.y, r: 80 + 50 * b.power, power: 0.75 });
    }
    for (const e of this.embers) {
      L.push({ x: e.x, y: e.y, r: 50, power: 0.35 });
    }
    if (this.shield.active) {
      L.push({ x: this.shield.x, y: this.shield.y, r: this.shield.radius * 1.1, power: 0.3 });
    }
    return L;
  }

  // 어둠 아래 그려지는 것들
  drawWorld(p) {
    for (const c of this.candles) this._drawCandle(p, c);

    p.noStroke();
    for (const e of this.embers) {
      p.fill(255, 140, 50, 200);
      p.circle(e.x, e.y, e.r * 2);
    }

    for (const b of this.fireballs) {
      p.fill(255, 170, 60, 220);
      p.circle(b.x, b.y, b.r * 2);
      p.fill(255, 240, 190, 240);
      p.circle(b.x, b.y, b.r * 1.1);
    }

    for (const s of this.sparks) {
      const a = clamp(s.life / s.max, 0, 1);
      p.fill(255, 200, 120, 255 * a);
      p.circle(s.x, s.y, s.r * 2);
    }
  }

  _drawCandle(p, c) {
    p.push();
    p.noStroke();
    p.fill(44, 48, 62);
    p.rect(c.x - 11, c.y + 12, 22, 28, 3);
    p.stroke(96, 86, 74);
    p.strokeWeight(2);
    p.line(c.x, c.y + 13, c.x, c.y + 1);
    p.noStroke();

    if (c.lit) {
      const t = p.millis() * 0.006 + c.seed;
      const fx = Math.sin(t * 1.7) * 2.2;
      p.fill(255, 120, 30, 90);
      p.circle(c.x + fx, c.y - 12, 34);
      p.fill(255, 170, 45, 190);
      p.ellipse(c.x + fx, c.y - 14, 15, 30);
      p.fill(255, 240, 170, 235);
      p.ellipse(c.x + fx * 0.5, c.y - 11, 7, 15);
    } else {
      p.fill(26, 30, 40);
      p.circle(c.x, c.y - 3, 12);
    }
    p.pop();
  }

  // 어둠 위에 더해지는 빛
  drawGlow(p, lights) {
    const ctx = p.drawingContext;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      const a = 0.35 * l.power;
      g.addColorStop(0, `rgba(255,190,110,${a})`);
      g.addColorStop(0.45, `rgba(255,120,35,${a * 0.35})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 어둠보다 위에 그려야 하는 것들 (방어막, 손의 불꽃)
  drawTop(p, g) {
    const sh = this.shield;
    if (sh.alpha > 0.01) {
      const ang = Math.atan2(sh.face.y, sh.face.x);
      p.push();
      p.translate(sh.x, sh.y);
      p.noFill();
      p.stroke(110, 190, 255, 170 * sh.alpha);
      p.strokeWeight(7);
      p.arc(0, 0, sh.radius * 2, sh.radius * 2, ang - p.PI / 3, ang + p.PI / 3);
      p.stroke(210, 240, 255, 90 * sh.alpha);
      p.strokeWeight(2);
      p.arc(0, 0, sh.radius * 1.65, sh.radius * 1.65, ang - p.PI / 3.1, ang + p.PI / 3.1);
      p.pop();
    }

    if (g && g.orb > 0) {
      const t = p.millis() * 0.01;
      const r = 14 + 34 * g.orbPower;
      const x = g.orbPos.x;
      const y = g.orbPos.y;
      p.push();
      p.noStroke();
      p.fill(255, 120, 30, 70);
      p.circle(x, y, r * 2.6);
      p.fill(255, 170, 50, 160);
      p.circle(x, y, r * 1.7);
      p.fill(255, 240, 180, 220);
      p.circle(x + Math.sin(t) * 2, y + Math.cos(t * 1.3) * 2, r);
      p.pop();
    }
  }
}
