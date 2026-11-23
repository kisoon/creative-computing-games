// 문지를 때 튀는 작은 하트/반짝이 파티클.

const COLORS = ["#FF6B8A", "#FFB3C1", "#FFD166", "#FF9EBB", "#FF8FA3"];

export class Effects {
  constructor() {
    this.parts = [];
    this.limit = 60;
  }

  spawn(x, y, intensity = 1) {
    const count = 1 + Math.round(Math.random() * intensity);
    for (let i = 0; i < count; i++) {
      if (this.parts.length >= this.limit) this.parts.shift();
      const isHeart = Math.random() < 0.55;
      this.parts.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 90,
        vy: -30 - Math.random() * 80,
        size: 7 + Math.random() * 9,
        rot: (Math.random() - 0.5) * 0.6,
        vr: (Math.random() - 0.5) * 2.4,
        life: 0,
        maxLife: 0.8 + Math.random() * 0.6,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        type: isHeart ? "heart" : "spark",
      });
    }
  }

  update(dt) {
    for (const p of this.parts) {
      p.life += dt;
      p.vy += 120 * dt;
      p.vx *= 1 - 1.2 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.parts = this.parts.filter((p) => p.life < p.maxLife);
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.parts) {
      const t = p.life / p.maxLife;
      const alpha = Math.sin(Math.min(1, t * 1.15) * Math.PI);
      const scale = Math.min(1, p.life * 10) * (1 - t * 0.2);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(scale, scale);
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = p.color;

      if (p.type === "heart") {
        drawHeart(ctx, p.size);
      } else {
        drawSpark(ctx, p.size);
      }
      ctx.restore();
    }
    ctx.restore();
  }
}

function drawHeart(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.32);
  ctx.bezierCurveTo(-s * 0.62, -s * 0.18, -s * 0.3, -s * 0.72, 0, -s * 0.28);
  ctx.bezierCurveTo(s * 0.3, -s * 0.72, s * 0.62, -s * 0.18, 0, s * 0.32);
  ctx.fill();
}

function drawSpark(ctx, s) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? s * 0.55 : s * 0.2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}
