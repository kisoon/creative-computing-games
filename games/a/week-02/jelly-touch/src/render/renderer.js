// 캔버스 렌더러. 상태를 읽어서 그리기만 한다.

import { CONFIG } from "../config.js";

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.bg = this.createBackground();
  }

  createBackground() {
    const { width: w, height: h } = CONFIG.canvas;
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const g = off.getContext("2d");

    const base = g.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, "#fffaf6");
    base.addColorStop(0.5, "#fbeee4");
    base.addColorStop(1, "#f2ddcd");
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);

    // 은은한 빛 번짐 2개
    const glow1 = g.createRadialGradient(w * 0.22, h * 0.18, 0, w * 0.22, h * 0.18, h * 0.85);
    glow1.addColorStop(0, "rgba(255, 214, 190, 0.55)");
    glow1.addColorStop(1, "rgba(255, 214, 190, 0)");
    g.fillStyle = glow1;
    g.fillRect(0, 0, w, h);

    const glow2 = g.createRadialGradient(w * 0.85, h * 0.9, 0, w * 0.85, h * 0.9, h * 0.7);
    glow2.addColorStop(0, "rgba(255, 190, 175, 0.35)");
    glow2.addColorStop(1, "rgba(255, 190, 175, 0)");
    g.fillStyle = glow2;
    g.fillRect(0, 0, w, h);

    // 아주 옅은 점 패턴
    g.fillStyle = "rgba(190, 140, 110, 0.055)";
    for (let y = 22; y < h; y += 44) {
      for (let x = 22; x < w; x += 44) {
        g.beginPath();
        g.arc(x, y, 1.4, 0, Math.PI * 2);
        g.fill();
      }
    }

    return off;
  }

  draw(state) {
    const { jelly, hands, face, effects, debug, fps } = state;
    const ctx = this.ctx;
    const { width: W, height: H } = CONFIG.canvas;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this.bg, 0, 0);

    const R = jelly.R;
    const bounds = jelly.getBounds();
    const mx = (bounds.minX + bounds.maxX) / 2;
    const my = (bounds.minY + bounds.maxY) / 2;

    // 바닥 그림자
    ctx.save();
    ctx.translate(mx, jelly.cy + R * 1.03);
    ctx.scale(1, 0.17);
    const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.0);
    shadow.addColorStop(0, "rgba(150, 90, 65, 0.22)");
    shadow.addColorStop(0.7, "rgba(150, 90, 65, 0.08)");
    shadow.addColorStop(1, "rgba(150, 90, 65, 0)");
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 몸통 (그림자 + 그라데이션)
    const bodyGradient = ctx.createRadialGradient(
      mx - R * 0.35,
      my - R * 0.42,
      R * 0.08,
      mx,
      my,
      R * 1.15
    );
    bodyGradient.addColorStop(0, "#fff0e4");
    bodyGradient.addColorStop(0.45, "#ffdcc5");
    bodyGradient.addColorStop(0.8, "#ffc8aa");
    bodyGradient.addColorStop(1, "#f0b394");

    ctx.save();
    ctx.shadowColor = "rgba(190, 110, 80, 0.2)";
    ctx.shadowBlur = 42;
    ctx.shadowOffsetY = 16;
    traceBody(ctx, jelly.vertices);
    ctx.fillStyle = bodyGradient;
    ctx.fill();
    ctx.restore();

    // 하이라이트 + 아랫면 음영
    ctx.save();
    traceBody(ctx, jelly.vertices);
    ctx.clip();

    const hi = ctx.createRadialGradient(
      mx - R * 0.34,
      my - R * 0.44,
      R * 0.02,
      mx - R * 0.18,
      my - R * 0.28,
      R * 0.95
    );
    hi.addColorStop(0, "rgba(255,255,255,0.85)");
    hi.addColorStop(0.4, "rgba(255,255,255,0.22)");
    hi.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hi;
    ctx.fillRect(mx - R * 1.5, my - R * 1.5, R * 3, R * 3);

    const shade = ctx.createRadialGradient(
      mx + R * 0.25,
      my + R * 0.8,
      R * 0.05,
      mx,
      my + R * 0.55,
      R * 1.0
    );
    shade.addColorStop(0, "rgba(214, 128, 96, 0.32)");
    shade.addColorStop(1, "rgba(214, 128, 96, 0)");
    ctx.fillStyle = shade;
    ctx.fillRect(mx - R * 1.5, my - R * 1.5, R * 3, R * 3);
    ctx.restore();

    // 테두리
    ctx.save();
    traceBody(ctx, jelly.vertices);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 접촉 지점 표시 (얼굴 아래, 몸통 위)
    for (const c of jelly.contacts.values()) {
      const radius = Math.max(30, 24 + 30 * c.depth);
      const glow = ctx.createRadialGradient(c.x, c.y, radius * 0.15, c.x, c.y, radius);
      if (c.kind === "grab") {
        glow.addColorStop(0, "rgba(255, 214, 200, 0.5)");
        glow.addColorStop(0.55, "rgba(255, 186, 172, 0.2)");
      } else {
        glow.addColorStop(0, "rgba(255,255,255,0.42)");
        glow.addColorStop(0.6, "rgba(255,255,255,0.16)");
      }
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.save();
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 집고 있는 곳은 살짝 눌린 자국처럼 표시
    for (const grab of jelly.grabs.values()) {
      const radius = 26 + 44 * grab.strength;
      const glow = ctx.createRadialGradient(
        grab.x,
        grab.y,
        radius * 0.1,
        grab.x,
        grab.y,
        radius
      );
      glow.addColorStop(0, "rgba(255, 170, 155, 0.26)");
      glow.addColorStop(1, "rgba(255, 170, 155, 0)");
      ctx.save();
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(grab.x, grab.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 얼굴
    face.draw(ctx, jelly);

    // 파티클
    effects.draw(ctx);

    // 디버그
    if (debug) this.drawDebug(ctx, hands, jelly, fps);
  }

  drawDebug(ctx, hands, jelly, fps) {
    const H = CONFIG.canvas.height;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(60, 90, 120, 0.55)";

    for (const hand of hands) {
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(hand.points[a].x, hand.points[a].y);
        ctx.lineTo(hand.points[b].x, hand.points[b].y);
        ctx.stroke();
      }
      for (let i = 0; i < hand.points.length; i++) {
        const p = hand.points[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, i % 4 === 0 ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(40, 120, 200, 0.85)";
        ctx.fill();
      }

      // 콜라이더
      ctx.setLineDash([6, 6]);
      for (const c of [hand.palm, ...hand.tips]) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 90, 90, 0.55)";
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    ctx.fillStyle = "rgba(60, 50, 45, 0.8)";
    ctx.font = "600 16px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(
      `FPS ${fps.toFixed(0)}   hands ${hands.length}   deform ${jelly.deform.toFixed(
        2
      )}   grabs ${jelly.grabs.size}`,
      20,
      H - 22
    );
    ctx.restore();
  }
}

function traceBody(ctx, verts) {
  const n = verts.length;
  ctx.beginPath();
  const last = verts[n - 1];
  const first = verts[0];
  ctx.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
  for (let i = 0; i < n; i++) {
    const cur = verts[i];
    const next = verts[(i + 1) % n];
    ctx.quadraticCurveTo(cur.x, cur.y, (cur.x + next.x) / 2, (cur.y + next.y) / 2);
  }
  ctx.closePath();
}
