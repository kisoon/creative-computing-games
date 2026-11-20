/* =========================================================
   game-world.js — 캔버스 · 배경 · 캐릭터 · 이펙트
   ========================================================= */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let DPR = 1;

function fitCanvas() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
}
fitCanvas();

/* ---------- 공통 드로잉 헬퍼 ---------- */
function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}

function drawShadow(x, y, rx, ry, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha == null ? 0.18 : alpha;
  ctx.fillStyle = '#20452a';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/* ---------- 배경 프리컴퓨트 ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const bgRnd = mulberry32(20261113);

const bgTufts = Array.from({ length: 105 }, () => ({
  x: bgRnd() * W,
  y: 392 + bgRnd() * 140,
  h: 6 + bgRnd() * 15,
  s: 0.6 + bgRnd() * 0.9,
  ph: bgRnd() * TAU,
  tint: bgRnd()
}));

const bgFore = Array.from({ length: 30 }, () => ({
  x: bgRnd() * W,
  y: 508 + bgRnd() * 46,
  h: 16 + bgRnd() * 26,
  s: 1 + bgRnd() * 0.8,
  ph: bgRnd() * TAU
}));

const bgFlowers = Array.from({ length: 24 }, () => ({
  x: 30 + bgRnd() * 900,
  y: 404 + bgRnd() * 112,
  h: 6 + bgRnd() * 8,
  ph: bgRnd() * TAU,
  color: pick(['#fff6da', '#ffe28a', '#ffc2cf', '#e6f3ff'])
}));

const bgRocks = Array.from({ length: 8 }, () => ({
  x: 40 + bgRnd() * 880,
  y: 420 + bgRnd() * 90,
  rx: 4 + bgRnd() * 8,
  ry: 3 + bgRnd() * 4
}));

const bgClouds = Array.from({ length: 7 }, (_, i) => ({
  x: bgRnd() * W,
  y: 44 + bgRnd() * 150,
  s: 0.55 + bgRnd() * 0.85,
  sp: 3 + bgRnd() * 6,
  a: 0.5 + bgRnd() * 0.35
}));

const bgBirds = Array.from({ length: 4 }, () => ({
  x: bgRnd() * W,
  y: 70 + bgRnd() * 110,
  sp: 7 + bgRnd() * 8,
  s: 0.7 + bgRnd() * 0.6,
  ph: bgRnd() * TAU
}));

const bgPollen = Array.from({ length: 30 }, () => ({
  x: bgRnd() * W,
  y: 360 + bgRnd() * 170,
  r: 0.8 + bgRnd() * 1.8,
  ph: bgRnd() * TAU,
  sp: 0.3 + bgRnd() * 0.8
}));

const bgPines = Array.from({ length: 34 }, () => ({
  x: bgRnd() * (W + 40) - 20,
  y: 360 + bgRnd() * 6,
  h: 12 + bgRnd() * 24,
  w: 8 + bgRnd() * 10
}));

/* ---------- 배경 ---------- */
function drawCloud(x, y, s, a) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(255,255,255,' + a + ')';
  ctx.beginPath();
  ctx.arc(-28, 2, 17, 0, TAU);
  ctx.arc(-6, -8, 24, 0, TAU);
  ctx.arc(22, -2, 19, 0, TAU);
  ctx.arc(2, 8, 22, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawHillLayer(baseY, amp, color, phase) {
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, baseY);
  for (let x = 0; x <= W; x += 16) {
    const y = baseY - Math.sin(x * 0.008 + phase) * amp - Math.sin(x * 0.0035 + phase * 2.3) * amp * 0.7;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawBackground() {
  const t = game.time;

  // 하늘
  const sky = ctx.createLinearGradient(0, 0, 0, 400);
  sky.addColorStop(0, '#8fd3f4');
  sky.addColorStop(0.55, '#c8eaea');
  sky.addColorStop(1, '#f4f0cf');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, 400);

  // 태양
  const sun = ctx.createRadialGradient(792, 106, 8, 792, 106, 200);
  sun.addColorStop(0, 'rgba(255,248,205,0.95)');
  sun.addColorStop(0.3, 'rgba(255,238,165,0.4)');
  sun.addColorStop(1, 'rgba(255,238,165,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(560, -110, 520, 430);
  ctx.fillStyle = '#fff8cf';
  circle(792, 106, 33);
  ctx.fill();

  // 구름
  for (const c of bgClouds) {
    const x = ((c.x + t * c.sp) % (W + 320)) - 160;
    drawCloud(x, c.y, c.s, c.a);
  }

  // 새
  ctx.strokeStyle = 'rgba(70,110,120,0.45)';
  ctx.lineWidth = 1.6;
  for (const b of bgBirds) {
    const x = ((b.x + t * b.sp) % (W + 100)) - 50;
    const flap = Math.sin(t * 5 + b.ph) * 3 * b.s;
    ctx.beginPath();
    ctx.moveTo(x - 7 * b.s, b.y + flap);
    ctx.quadraticCurveTo(x, b.y - 3 * b.s, x + 7 * b.s, b.y + flap);
    ctx.stroke();
  }

  // 먼 언덕
  drawHillLayer(352, 20, '#a9dcb4', 0.4);
  drawHillLayer(370, 30, '#85c996', 1.7);

  // 지평선 소나무
  ctx.fillStyle = 'rgba(78,146,98,0.42)';
  for (const p of bgPines) {
    ctx.beginPath();
    ctx.moveTo(p.x - p.w / 2, p.y);
    ctx.lineTo(p.x, p.y - p.h);
    ctx.lineTo(p.x + p.w / 2, p.y);
    ctx.closePath();
    ctx.fill();
  }

  // 초원
  const field = ctx.createLinearGradient(0, 370, 0, H);
  field.addColorStop(0, '#a2da83');
  field.addColorStop(0.42, '#7ec768');
  field.addColorStop(1, '#4c9a4e');
  ctx.beginPath();
  ctx.moveTo(0, 378);
  for (let x = 0; x <= W; x += 20) {
    ctx.lineTo(x, 378 - Math.sin(x * 0.006 + 1.1) * 3);
  }
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fillStyle = field;
  ctx.fill();

  // 햇빛 띠
  const band = ctx.createLinearGradient(0, 372, 0, 480);
  band.addColorStop(0, 'rgba(255,255,215,0.34)');
  band.addColorStop(1, 'rgba(255,255,215,0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, 372, W, 110);

  // 전투 자리 (옅은 빛)
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#e9f5a8';
  ctx.beginPath();
  ctx.ellipse(480, 462, 360, 44, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // 돌
  for (const r of bgRocks) {
    ctx.fillStyle = 'rgba(94,124,92,0.5)';
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.rx, r.ry, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(190,215,180,0.35)';
    ctx.beginPath();
    ctx.ellipse(r.x - r.rx * 0.25, r.y - r.ry * 0.3, r.rx * 0.45, r.ry * 0.35, 0, 0, TAU);
    ctx.fill();
  }

  // 꽃
  for (const f of bgFlowers) {
    const sway = Math.sin(t * 1.5 + f.ph) * 1.8;
    ctx.strokeStyle = 'rgba(60,130,64,0.75)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.quadraticCurveTo(f.x + sway * 0.4, f.y - f.h * 0.6, f.x + sway, f.y - f.h);
    ctx.stroke();
    ctx.fillStyle = f.color;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.4;
      circle(f.x + sway + Math.cos(a) * 2.4, f.y - f.h + Math.sin(a) * 2.4, 1.9);
      ctx.fill();
    }
    ctx.fillStyle = '#ffd45e';
    circle(f.x + sway, f.y - f.h, 1.4);
    ctx.fill();
  }

  // 풀포기
  for (const g of bgTufts) {
    const sway = Math.sin(t * 1.35 + g.ph) * 3.2 * g.s;
    ctx.strokeStyle = g.tint > 0.5 ? 'rgba(54,124,62,0.85)' : 'rgba(110,178,90,0.9)';
    ctx.lineWidth = 1.5 * g.s;
    ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(g.x + i * 2.4 * g.s, g.y);
      ctx.quadraticCurveTo(
        g.x + i * 3 * g.s + sway * 0.45,
        g.y - g.h * 0.6,
        g.x + i * 4 * g.s + sway,
        g.y - g.h
      );
      ctx.stroke();
    }
  }

  // 떠다니는 꽃가루
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of bgPollen) {
    const a = 0.25 + 0.35 * Math.sin(t * p.sp + p.ph);
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fffde0';
    circle(p.x + Math.sin(t * 0.6 + p.ph) * 9, p.y + Math.cos(t * 0.45 + p.ph) * 7, p.r);
    ctx.fill();
  }
  ctx.restore();
}

function drawForeground() {
  const t = game.time;
  for (const g of bgFore) {
    const sway = Math.sin(t * 1.2 + g.ph) * 4.5 * g.s;
    ctx.strokeStyle = 'rgba(32,86,42,0.9)';
    ctx.lineWidth = 2.6 * g.s;
    ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(g.x + i * 3.4 * g.s, g.y);
      ctx.quadraticCurveTo(
        g.x + i * 4.2 * g.s + sway * 0.5,
        g.y - g.h * 0.55,
        g.x + i * 5.6 * g.s + sway,
        g.y - g.h
      );
      ctx.stroke();
    }
  }
}

/* ---------- 이펙트 ---------- */
function drawEffects() {
  for (const e of effects) {
    const p = 1 - e.life / e.max;
    if (e.type === 'slash') {
      const alpha = Math.pow(1 - p, 0.7);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(e.facing, 1);
      ctx.globalCompositeOperation = 'lighter';

      if (e.kind === 'q') {
        const a0 = -2.0;
        const a1 = 1.15;
        const end = a0 + (a1 - a0) * Math.min(1, p * 1.7);
        for (let i = 0; i < 3; i++) {
          const r = 46 + i * 11;
          ctx.beginPath();
          ctx.arc(0, 0, r, a0, end);
          ctx.strokeStyle = i === 1
            ? 'rgba(255,255,255,' + (0.9 * alpha) + ')'
            : 'rgba(150,250,255,' + (0.38 * alpha) + ')';
          ctx.lineWidth = Math.max(1, (11 - i * 2.6) * alpha);
          ctx.stroke();
        }
      } else {
        for (let i = 0; i < 3; i++) {
          const y = (i - 1) * 9;
          const len = 78 + i * 16;
          ctx.beginPath();
          ctx.moveTo(16, y);
          ctx.lineTo(16 + len * Math.min(1, p * 2), y);
          ctx.strokeStyle = 'rgba(220,255,255,' + (0.75 * alpha) + ')';
          ctx.lineWidth = 3 - i * 0.6;
          ctx.stroke();
        }
      }
      ctx.restore();
    } else if (e.type === 'shock') {
      const alpha = Math.pow(1 - p, 1.2);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,220,150,' + (alpha * 0.7) + ')';
      ctx.lineWidth = 4 * (1 - p) + 1;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, 20 + 90 * p, 8 + 22 * p, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawParticles() {
  for (const p of particles) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.type === 'spark') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      circle(p.x, p.y, p.size);
      ctx.fill();
      ctx.restore();
    } else if (p.type === 'leaf') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot || 0);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (p.type === 'dust') {
      ctx.save();
      ctx.globalAlpha = a * 0.42;
      ctx.fillStyle = p.color;
      circle(p.x, p.y, p.size);
      ctx.fill();
      ctx.restore();
    } else if (p.type === 'confetti') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot || 0);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.6);
      ctx.restore();
    }
  }
}

function drawNumbers() {
  for (const n of numbers) {
    const k = n.life / n.max;
    const alpha = Math.min(1, k * 3);
    const pop = n.kind === 'dmg' ? 1 + 0.3 * Math.max(0, (k - 0.68) / 0.32) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(n.x, n.y);
    ctx.scale(pop, pop);
    ctx.font = '900 ' + n.size + 'px "Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(12,24,20,0.55)';
    ctx.strokeText(n.text, 0, 0);
    ctx.fillStyle = n.color;
    ctx.fillText(n.text, 0, 0);
    ctx.restore();
  }
}

/* ---------- 해골 기사 ---------- */
function drawBone(x1, y1, x2, y2, w, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawLeg(hipX, hipY, footX, footY, w, color, kneeOut) {
  const kx = (hipX + footX) / 2 + kneeOut;
  const ky = (hipY + footY) / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(kx, ky);
  ctx.lineTo(footX, footY);
  ctx.stroke();
  ctx.fillStyle = color;
  circle(kx, ky, w * 0.5);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(footX + 2, footY - 1, 6, 3.6, 0, 0, TAU);
  ctx.fill();
}

function drawSword(x, y, ang, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  if (alpha != null) ctx.globalAlpha *= alpha;

  // 손잡이
  ctx.fillStyle = '#5a3b2a';
  rr(-13, -3, 12, 6, 2);
  ctx.fill();
  // 폼멜
  ctx.fillStyle = '#e8c36a';
  circle(-14, 0, 3.2);
  ctx.fill();
  // 가드
  ctx.fillStyle = '#f0c964';
  rr(0, -8, 4, 16, 1.5);
  ctx.fill();

  // 날
  const g = ctx.createLinearGradient(0, -4, 0, 4);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, '#e2edf4');
  g.addColorStop(1, '#9fb4c2');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(4, -4.2);
  ctx.lineTo(52, -3.4);
  ctx.lineTo(60, 0);
  ctx.lineTo(52, 3.4);
  ctx.lineTo(4, 4.2);
  ctx.closePath();
  ctx.fill();

  // 광택
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(8, -1.7);
  ctx.lineTo(48, -1.2);
  ctx.stroke();
  ctx.restore();
}

function drawPlayer() {
  const p = player;
  const t = game.time;

  ctx.save();
  drawShadow(p.x, GROUND + 3, 30, 8, 0.22);
  ctx.translate(p.x, GROUND);

  if (p.dead) {
    const k = easeOutCubic(Math.min(1, p.deathT / 0.6));
    ctx.translate(0, -4 * k);
    ctx.rotate(1.15 * k);
  }
  ctx.scale(p.facing, 1);

  const bob = p.dead ? 0 : (p.moving ? -Math.abs(Math.sin(p.walkPhase)) * 2.2 : Math.sin(t * 2.1) * 1.3);
  ctx.translate(0, bob);

  if (p.iframes > 0 && Math.floor(t * 26) % 2 === 0) ctx.globalAlpha = 0.5;
  if (p.hurtFlash > 0) ctx.filter = 'brightness(1.7) saturate(1.3)';

  const legSwing = p.moving ? Math.sin(p.walkPhase) * 6 : 0;
  const armSwing = p.moving ? Math.sin(p.walkPhase + Math.PI) * 4 : 0;

  // 뒤쪽 팔
  drawBone(-5, -45, -13 - armSwing * 0.5, -35, 5, '#ddd5bf');
  drawBone(-13 - armSwing * 0.5, -35, -15 - armSwing, -27, 4.4, '#ddd5bf');
  ctx.fillStyle = '#eee7d5';
  circle(-15 - armSwing, -27, 3.2);
  ctx.fill();

  // 다리
  drawLeg(-6, -22, -9 + legSwing, -1, 5.4, '#ddd5bf', -2);
  drawLeg(6, -22, 9 - legSwing, -1, 5.4, '#efe7d2', 2);

  // 골반
  ctx.fillStyle = '#efe7d2';
  ctx.beginPath();
  ctx.ellipse(0, -23, 8.5, 6.5, 0, 0, TAU);
  ctx.fill();

  // 척추
  drawBone(0, -24, 0, -47, 4.6, '#efe7d2');

  // 갈비뼈
  ctx.strokeStyle = '#efe7d2';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const y = -44 + i * 5.6;
    ctx.beginPath();
    ctx.moveTo(-11, y);
    ctx.quadraticCurveTo(0, y + 5, 11, y);
    ctx.stroke();
  }
  // 쇄골
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-10, -47);
  ctx.quadraticCurveTo(0, -50, 10, -47);
  ctx.stroke();

  // 목
  drawBone(0, -47, 0, -52, 4.4, '#efe7d2');

  // 빨간 스카프
  const flow = Math.sin(t * 4.2) * 2.4;
  ctx.fillStyle = '#d9483f';
  ctx.beginPath();
  ctx.moveTo(-5, -54);
  ctx.quadraticCurveTo(-22, -57 + flow, -30, -50 + flow);
  ctx.quadraticCurveTo(-20, -46, -10, -48);
  ctx.quadraticCurveTo(-19, -42 + flow, -26, -37 + flow);
  ctx.quadraticCurveTo(-12, -40, -4, -47);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -53, 12, 5.2, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#b53a34';
  ctx.beginPath();
  ctx.ellipse(-2, -50, 5, 2.4, 0, 0, TAU);
  ctx.fill();

  // 머리
  const skullGrad = ctx.createLinearGradient(0, -104, 0, -48);
  skullGrad.addColorStop(0, '#fffdf4');
  skullGrad.addColorStop(1, '#e8e1cd');
  ctx.fillStyle = skullGrad;
  ctx.beginPath();
  ctx.ellipse(2, -82, 23, 22, 0, 0, TAU);
  ctx.fill();
  rr(-11, -70, 26, 22, 9);
  ctx.fill();

  // 눈구멍
  ctx.fillStyle = '#1b252a';
  ctx.beginPath();
  ctx.ellipse(-9, -84, 6.6, 7.6, -0.08, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(11, -84, 6.6, 7.6, 0.08, 0, TAU);
  ctx.fill();

  // 눈동자
  ctx.save();
  ctx.shadowColor = '#7ef9ff';
  ctx.shadowBlur = 9;
  ctx.fillStyle = '#a8fdff';
  circle(-7.4, -83, 2.5);
  ctx.fill();
  circle(12.6, -83, 2.5);
  ctx.fill();
  ctx.restore();

  // 코
  ctx.fillStyle = '#2a3438';
  ctx.beginPath();
  ctx.moveTo(-1.5, -73);
  ctx.lineTo(5.5, -73);
  ctx.lineTo(2, -68);
  ctx.closePath();
  ctx.fill();

  // 입 + 이빨
  ctx.fillStyle = '#2a3438';
  rr(-9, -62, 21, 9, 4);
  ctx.fill();
  ctx.fillStyle = '#f3ecd9';
  for (let i = 0; i < 3; i++) ctx.fillRect(-5.5 + i * 6, -62, 2, 5.4);

  // 금 간 자국
  ctx.strokeStyle = 'rgba(95,85,68,0.4)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-5, -103);
  ctx.lineTo(-1, -97);
  ctx.lineTo(-6, -94);
  ctx.stroke();

  // 앞팔 + 검
  let armAng = 0.95 + Math.sin(t * 2) * 0.05;
  let swordAng = armAng - 0.55;

  if (p.attack) {
    const a = p.attack;
    if (a.type === 'q') {
      const k = a.t / 0.37;
      if (k < 0.2) armAng = lerp(0.95, -2.0, easeOutCubic(k / 0.2));
      else if (k < 0.52) armAng = lerp(-2.0, 1.25, easeInCubic((k - 0.2) / 0.32));
      else armAng = lerp(1.25, 0.95, (k - 0.52) / 0.48);
      swordAng = armAng + 0.12;
    } else {
      const k = a.t / 0.55;
      armAng = k < 0.15 ? lerp(0.95, 0.35, k / 0.15) : 0.05;
      swordAng = armAng - 0.02;
    }
  }

  const shX = 7;
  const shY = -45;
  const handX = shX + Math.cos(armAng) * 21;
  const handY = shY + Math.sin(armAng) * 21;

  drawBone(shX, shY, handX, handY, 5, '#f4eddb');
  ctx.fillStyle = '#f4eddb';
  circle(handX, handY, 3.6);
  ctx.fill();

  if (p.attack && p.attack.type === 'q') {
    drawSword(handX, handY, swordAng + 0.55, 0.14);
    drawSword(handX, handY, swordAng + 0.28, 0.24);
  }
  drawSword(handX, handY, swordAng, 1);

  if (p.attack && p.attack.type === 'e') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.max(0, 0.8 - p.attack.t * 2.4);
    ctx.strokeStyle = '#d9ffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(handX + 6, handY);
    ctx.lineTo(handX + 76, handY);
    ctx.stroke();
    ctx.restore();
  }

  ctx.filter = 'none';
  ctx.restore();
}

/* ---------- 나무 괴물 ---------- */
function drawMonsterArm(sx, sy, ex, ey, width, sway) {
  const mx = (sx + ex) / 2 + 8;
  const my = (sy + ey) / 2 - 18 + sway;
  ctx.strokeStyle = '#4f3723';
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(mx, my, ex, ey);
  ctx.stroke();

  // 잔가지
  ctx.strokeStyle = '#5d4229';
  ctx.lineWidth = Math.max(2, width * 0.32);
  for (let i = 0; i < 3; i++) {
    const a = -1.2 + i * 0.85;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex + Math.cos(a) * 17, ey + Math.sin(a) * 17);
    ctx.stroke();
  }

  // 잎 뭉치
  ctx.fillStyle = '#3f8f4f';
  circle(ex + 4, ey - 6, 10);
  ctx.fill();
  ctx.fillStyle = '#5fbd64';
  circle(ex + 9, ey - 11, 6.5);
  ctx.fill();
}

function drawCanopy(t, enraged) {
  const sway = Math.sin(t * 1.5) * 2.5;
  ctx.save();
  ctx.translate(sway, 0);

  const clusters = [
    [-34, -196, 35],
    [-4, -220, 41],
    [32, -202, 33],
    [8, -184, 29],
    [-30, -176, 24],
    [40, -178, 22]
  ];

  // 그늘
  ctx.fillStyle = '#2f6e3f';
  for (const c of clusters) {
    circle(c[0], c[1] + 6, c[2] + 3);
    ctx.fill();
  }

  // 잎
  const greens = ['#3f8f4f', '#4fa85a', '#5fbd64', '#71cc6f'];
  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i];
    ctx.fillStyle = greens[i % greens.length];
    circle(c[0], c[1], c[2]);
    ctx.fill();
  }

  // 하이라이트
  ctx.fillStyle = 'rgba(190,242,150,0.5)';
  circle(-14, -228, 15);
  ctx.fill();
  circle(-40, -204, 9);
  ctx.fill();
  ctx.fillStyle = 'rgba(210,250,170,0.35)';
  circle(24, -212, 10);
  ctx.fill();

  if (enraged) {
    ctx.fillStyle = 'rgba(255,110,70,0.12)';
    circle(0, -200, 78);
    ctx.fill();
  }
  ctx.restore();
}

function drawMonsterFace(m, t) {
  // 눈구멍
  ctx.fillStyle = '#241a11';
  ctx.beginPath();
  ctx.ellipse(-15, -119, 10, 8, 0.12, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(16, -119, 10, 8, -0.12, 0, TAU);
  ctx.fill();

  const glow = m.state === 'windup' ? '#ff5a3c' : (m.enraged ? '#ff7a4a' : '#ffd166');
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = 13;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(-13, -118, 4.2, 4.8, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(14, -118, 4.2, 4.8, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // 화난 눈썹
  ctx.fillStyle = '#2c1d12';
  ctx.beginPath();
  ctx.moveTo(-27, -130);
  ctx.lineTo(-8, -125);
  ctx.lineTo(-27, -122);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(28, -130);
  ctx.lineTo(9, -125);
  ctx.lineTo(28, -122);
  ctx.closePath();
  ctx.fill();

  // 입
  const open = m.state === 'windup' ? 9 : (m.state === 'strike' ? 13 : 0);
  ctx.fillStyle = '#1f150e';
  rr(-23, -101, 46, 16 + open, 7);
  ctx.fill();

  if (m.enraged || m.state === 'windup' || m.state === 'strike') {
    ctx.fillStyle = 'rgba(255,120,60,' + (0.25 + 0.2 * Math.sin(t * 10)) + ')';
    rr(-19, -98, 38, 10 + open, 5);
    ctx.fill();
  }

  // 이빨
  ctx.fillStyle = '#d9c48d';
  for (let i = 0; i < 5; i++) {
    const x = -21 + i * 9;
    ctx.beginPath();
    ctx.moveTo(x, -101);
    ctx.lineTo(x + 7, -101);
    ctx.lineTo(x + 3.5, -94);
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0; i < 4; i++) {
    const x = -17 + i * 9;
    ctx.beginPath();
    ctx.moveTo(x, -85 + open);
    ctx.lineTo(x + 6, -85 + open);
    ctx.lineTo(x + 3, -92 + open);
    ctx.closePath();
    ctx.fill();
  }

  // 나무 결
  ctx.strokeStyle = 'rgba(35,22,12,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-31, -60);
  ctx.quadraticCurveTo(-27, -100, -34, -150);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(28, -58);
  ctx.quadraticCurveTo(33, -105, 26, -152);
  ctx.stroke();
}

function drawMonster() {
  const m = monster;
  const t = game.time;

  // 공격 예고 장판
  if (!m.dead && m.state === 'windup') {
    const prog = 1 - m.timer / m.windupDur;
    ctx.save();
    ctx.globalAlpha = 0.1 + 0.22 * prog;
    ctx.fillStyle = '#ff5a42';
    ctx.beginPath();
    ctx.ellipse(m.x + m.facing * 88, GROUND - 4, 102, 21, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.25 + 0.35 * prog;
    ctx.strokeStyle = '#ff8a6a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(m.x + m.facing * 88, GROUND - 4, 102, 21, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  drawShadow(m.x, GROUND + 4, 60, 13, 0.24);
  ctx.translate(m.x, GROUND);

  if (m.dead) {
    const k = easeOutCubic(Math.min(1, m.deathT / 0.9));
    ctx.translate(0, -6 * k);
    ctx.rotate(-1.25 * k);
  }
  ctx.scale(m.facing, 1);
  if (m.hurtFlash > 0) ctx.filter = 'brightness(1.9) saturate(0.7)';

  const moving = m.state === 'chase' ? Math.abs(Math.sin(m.walkPhase)) : 0;
  const breathe = Math.sin(t * 1.5) * 2.2;
  ctx.translate(0, -moving * 2.5 + breathe * 0.3);

  // 뒤쪽 가지팔
  drawMonsterArm(-32, -120, -62, -94, 10, Math.sin(t * 1.7) * 3);

  // 수관
  drawCanopy(t, m.enraged);

  // 뿌리 다리
  ctx.strokeStyle = '#4b3522';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-30, -40);
  ctx.lineTo(-34, -10);
  ctx.lineTo(-52, -1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(30, -40);
  ctx.lineTo(35, -10);
  ctx.lineTo(53, -1);
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-40, -5);
  ctx.lineTo(-60, -3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(40, -5);
  ctx.lineTo(62, -3);
  ctx.stroke();

  // 몸통
  const bark = ctx.createLinearGradient(-42, -175, 44, -36);
  bark.addColorStop(0, '#7a5738');
  bark.addColorStop(0.5, '#5e4229');
  bark.addColorStop(1, '#44301e');
  ctx.fillStyle = bark;
  ctx.beginPath();
  ctx.moveTo(-38, -38);
  ctx.bezierCurveTo(-47, -90, -35, -140, -30, -172);
  ctx.lineTo(28, -172);
  ctx.bezierCurveTo(33, -140, 45, -90, 38, -38);
  ctx.quadraticCurveTo(0, -27, -38, -38);
  ctx.closePath();
  ctx.fill();

  // 나무 결
  ctx.strokeStyle = 'rgba(35,22,12,0.26)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-18, -44);
  ctx.quadraticCurveTo(-23, -100, -20, -160);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2, -40);
  ctx.quadraticCurveTo(-2, -105, 1, -168);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(21, -44);
  ctx.quadraticCurveTo(25, -100, 21, -158);
  ctx.stroke();
  ctx.fillStyle = 'rgba(30,18,9,0.35)';
  ctx.beginPath();
  ctx.ellipse(-25, -72, 4, 7, 0.2, 0, TAU);
  ctx.fill();

  // 얼굴
  drawMonsterFace(m, t);

  // 앞쪽 가지팔
  let ex, ey;
  const shX = 31;
  const shY = -121;
  if (m.state === 'windup') {
    const k = 1 - m.timer / m.windupDur;
    const ang = lerp(0.35, -1.15, easeOutCubic(k));
    ex = shX + Math.cos(ang) * 49;
    ey = shY + Math.sin(ang) * 49;
  } else if (m.state === 'strike') {
    const k = Math.min(1, (1 - m.timer / 0.22) * 1.6);
    const ang = lerp(-1.15, 1.2, easeInCubic(k));
    ex = shX + Math.cos(ang) * 49;
    ey = shY + Math.sin(ang) * 49;
  } else if (m.state === 'stagger') {
    ex = shX + 18;
    ey = shY + 34;
  } else {
    const ang = 0.45 + Math.sin(t * 1.8) * 0.06;
    ex = shX + Math.cos(ang) * 49;
    ey = shY + Math.sin(ang) * 49;
  }
  drawMonsterArm(shX, shY, ex, ey, 12, Math.sin(t * 1.9) * 2);

  // 분노 표시
  if (m.enraged && !m.dead) {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 6);
    ctx.strokeStyle = '#ff6b45';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, -110, 54, 78, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  ctx.filter = 'none';
  ctx.restore();

  // 공격 예고 !
  if (!m.dead && m.state === 'windup') {
    const prog = 1 - m.timer / m.windupDur;
    const scale = easeOutBack(Math.min(1, prog * 3));
    ctx.save();
    ctx.translate(m.x, GROUND - 272 - Math.sin(t * 16) * 2);
    ctx.scale(scale, scale);
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 18);
    ctx.fillStyle = '#ff5a3c';
    circle(0, 0, 16);
    ctx.fill();
    ctx.fillStyle = '#fff6ea';
    ctx.font = '900 23px "Pretendard","Apple SD Gothic Neo",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 1);
    ctx.restore();
  }
}
