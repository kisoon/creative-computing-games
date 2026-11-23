// 말랑이의 얼굴(눈/입/볼). 몸통 변형 비율에 맞춰 같이 늘어나고 찌그러진다.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const INK = "#4a3b33";

export class Face {
  constructor() {
    this.blinkPhase = 1;
    this.nextBlink = 1.5 + Math.random() * 2;
    this.blinkScale = 1;
    this.squint = 0;
    this.mouth = 0;
    this.look = 0;
  }

  update(dt, { deform = 0, contact = false, grab = 0, lookTarget = 0 } = {}) {
    // 깜빡임
    this.nextBlink -= dt;
    if (this.nextBlink <= 0 && this.blinkPhase >= 1) {
      this.blinkPhase = 0;
      this.nextBlink = 2.2 + Math.random() * 3;
    }
    if (this.blinkPhase < 1) {
      this.blinkPhase = Math.min(1, this.blinkPhase + dt / 0.15);
    }
    const blink = Math.sin(this.blinkPhase * Math.PI);
    this.blinkScale = 1 - 0.92 * blink;

    // 누르면 눈 감고 입 벌림
    const squintTarget = deform > 0.16 || contact || grab > 0.45 ? 1 : 0;
    const mouthTarget = contact ? Math.max(0.7, grab) : grab * 0.8;
    this.squint += (squintTarget - this.squint) * Math.min(1, dt * 12);
    this.mouth += (mouthTarget - this.mouth) * Math.min(1, dt * 10);

    // 손 쪽을 바라봄
    const look = clamp(lookTarget, -1, 1);
    this.look += (look - this.look) * Math.min(1, dt * 5);
  }

  draw(ctx, jelly) {
    const bounds = jelly.getBounds();
    const R = jelly.R;
    const mx = (bounds.minX + bounds.maxX) / 2;
    const my = (bounds.minY + bounds.maxY) / 2;
    const sx = (bounds.maxX - bounds.minX) / 2 / R;
    const sy = (bounds.maxY - bounds.minY) / 2 / R;

    const fx = mx + this.look * R * 0.06;
    const fy = my + jelly.deform * R * 0.015;

    const eyeDx = R * 0.26 * sx;
    const eyeY = fy - R * 0.055 * sy;
    const eyeRx = Math.max(10, R * 0.072 * sx);
    const eyeRy = Math.max(3, R * 0.098 * sy * this.blinkScale);

    // 볼
    const blush = 0.12 + jelly.deform * 0.34;
    ctx.save();
    ctx.fillStyle = `rgba(255, 122, 132, ${clamp(blush, 0, 0.55)})`;
    for (const sign of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(
        fx + sign * R * 0.34 * sx,
        fy + R * 0.1 * sy,
        R * 0.095 * sx,
        R * 0.055 * sy,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.restore();

    // 눈
    ctx.save();
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    ctx.lineCap = "round";

    for (const sign of [-1, 1]) {
      const ex = fx + sign * eyeDx;

      if (this.squint > 0.55) {
        // 웃는 눈 (⌒)
        const w = R * 0.062 * sx;
        const h = R * 0.052 * sy;
        ctx.lineWidth = Math.max(4, R * 0.028);
        ctx.beginPath();
        ctx.moveTo(ex - w, eyeY + h * 0.4);
        ctx.quadraticCurveTo(ex, eyeY - h, ex + w, eyeY + h * 0.4);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeRx, eyeRy, 0, 0, Math.PI * 2);
        ctx.fill();

        // 하이라이트
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.ellipse(
          ex - eyeRx * 0.28,
          eyeY - eyeRy * 0.35,
          Math.max(2, eyeRx * 0.26),
          Math.max(2, eyeRy * 0.22),
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.fillStyle = INK;
      }
    }
    ctx.restore();

    // 입
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineCap = "round";
    const mouthY = fy + R * 0.2 * sy;

    if (this.mouth > 0.5) {
      ctx.beginPath();
      ctx.ellipse(fx, mouthY, R * 0.05 * sx, R * 0.062 * sy, 0, 0, Math.PI * 2);
      ctx.fill();
      // 아랫입술 하이라이트
      ctx.fillStyle = "rgba(255, 150, 150, 0.55)";
      ctx.beginPath();
      ctx.ellipse(fx, mouthY + R * 0.028 * sy, R * 0.03 * sx, R * 0.024 * sy, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.lineWidth = Math.max(4, R * 0.026);
      ctx.beginPath();
      ctx.moveTo(fx - R * 0.075 * sx, mouthY);
      ctx.quadraticCurveTo(fx, mouthY + R * 0.075 * sy, fx + R * 0.075 * sx, mouthY);
      ctx.stroke();
    }
    ctx.restore();
  }
}
