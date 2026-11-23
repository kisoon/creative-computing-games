let handPose;
let video;
let hands = [];

let handStates = {};
let sprites = {};
let tongueTex = [], shardTex = [], bubbleTex = [];

// 그리는 순서 (앞쪽이 아래 레이어)
const LAYERS = ['smoke', 'water', 'ice', 'fire', 'lightning', 'glint'];
let lists = {};
for (let l of LAYERS) lists[l] = [];

// 엄지와 맞닿는 손가락 끝 keypoint 번호
const FINGERS = { fire: 8, water: 12, lightning: 16, ice: 20 };

// 레이어별 최대 파티클 수
const CAP = { smoke: 40, water: 120, ice: 120, fire: 220, lightning: 200, glint: 60 };

// 손바닥 펼침(발사) 판정 기준 — 인식이 어려우면 여기 숫자를 조절하세요
const OPEN_EXTEND = 1.55;  // 손가락 끝이 손목에서 손바닥 길이의 몇 배 이상 떨어져야 하는지
const OPEN_SPREAD = 1.45;  // 손가락 끝 간격이 손가락 뿌리 간격의 몇 배 이상 벌어져야 하는지
const OPEN_THUMB = 0.55;   // 엄지가 검지 뿌리에서 손바닥 길이의 몇 배 이상 떨어져야 하는지

// 얼음 기둥 배치 (ox: 가로 위치, h: 높이, tilt: 기울기, d: 자라기 시작하는 지연 프레임)
const PILLARS = [
  { ox: -0.45, h: 0.55, tilt: -0.4, d: 0 },
  { ox: -0.15, h: 0.85, tilt: -0.12, d: 3 },
  { ox: 0.15, h: 0.75, tilt: 0.12, d: 6 },
  { ox: 0.45, h: 0.5, tilt: 0.4, d: 9 }
];

async function setup() {
  pixelDensity(1);
  createCanvas(640, 480).parent('frame');
  makeSprites();

  // ml5 1.4의 handPose()는 인스턴스를 바로 돌려주므로, 모델이 실제로 준비될 때까지 기다린다.
  handPose = ml5.handPose({ maxHands: 2, modelType: 'lite' });
  await handPose.ready;

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  handPose.detectStart(video, gotHands);
}

function draw() {
  // 카메라가 아직 준비되지 않은 첫 프레임 보호
  if (!video || video.elt.readyState < 2) return;

  image(video, 0, 0, width, height);

  for (let i = 0; i < hands.length; i++) {
    let key = hands[i].handedness || String(i);
    if (!handStates[key]) handStates[key] = new HandElement();
    handStates[key].track(hands[i].keypoints);
  }
  for (let key in handStates) handStates[key].step();

  for (let key in handStates) handStates[key].drawHandGlow();

  for (let layer of LAYERS) {
    blendMode(layerBlend(layer));
    let list = lists[layer];
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      let p = list[i];
      p.update();
      p.show();
      if (!p.isDead()) list[w++] = p;
    }
    list.length = w;
  }
  blendMode(BLEND);

  // 손에 붙어 있는 얼음 기둥
  for (let key in handStates) handStates[key].drawHandExtras();
}

function layerBlend(layer) {
  return layer === 'fire' || layer === 'lightning' || layer === 'glint' ? ADD : BLEND;
}

function room(layer) {
  return lists[layer].length < CAP[layer];
}

/* ---------- 스프라이트 (미리 그려두기) ---------- */

function makeLayer(w, h, drawFn) {
  let g = createGraphics(w, h);
  g.pixelDensity(1);
  drawFn(g.drawingContext);
  return g;
}

function makeGlow(r, g, b) {
  return makeLayer(128, 128, (ctx) => {
    let grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.4, `rgba(${r},${g},${b},0.35)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  });
}

// 물방울: 테두리가 빛나는 만화풍 물방울. filled=true는 파란 물방울, false는 흰 테두리만 있는 물방울
function makeBubble(filled, rx, ry, rot) {
  return makeLayer(64, 64, (ctx) => {
    ctx.save();
    ctx.translate(32, 32);
    ctx.rotate(rot);

    ctx.shadowColor = filled ? 'rgba(120,210,255,0.9)' : 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TWO_PI);
    if (filled) {
      let grad = ctx.createRadialGradient(-6, -6, 2, 0, 0, rx);
      grad.addColorStop(0, 'rgba(190,235,255,0.55)');
      grad.addColorStop(0.6, 'rgba(70,160,230,0.55)');
      grad.addColorStop(1, 'rgba(30,110,200,0.75)');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
    }
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = filled ? 'rgba(235,248,255,0.95)' : 'rgba(255,255,255,1)';
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // 하이라이트 (왼쪽 위 초승달 + 오른쪽 아래 작은 점)
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, rx * 0.72, PI * 1.05, PI * 1.45);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.ellipse(rx * 0.45, ry * 0.5, 2.2, 1.6, 0.6, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  });
}

function makeSprites() {
  sprites.fire = makeGlow(255, 140, 30);
  sprites.water = makeGlow(70, 160, 255);
  sprites.gold = makeGlow(255, 200, 80);
  sprites.white = makeGlow(255, 255, 255);
  sprites.ice = makeGlow(150, 205, 255);
  sprites.smoke = makeGlow(110, 110, 118);
  sprites.mist = makeGlow(215, 238, 255);

  // 불꽃 혀: 3겹(빨강/주황/노랑)을 한 장으로. 기준점 (30, 80)
  for (let sway of [-8, 0, 8]) {
    tongueTex.push(makeLayer(60, 100, (ctx) => {
      let cx = 30, by = 80;
      let layers = [
        [1, 1, 'rgba(255,100,0,0.65)'],
        [0.7, 0.75, 'rgba(255,170,20,0.75)'],
        [0.4, 0.5, 'rgba(255,235,120,0.85)']
      ];
      for (let [ws, hs, col] of layers) {
        let w = 13 * ws, h = 65 * hs, sw = sway * hs;
        ctx.beginPath();
        ctx.moveTo(cx - w, by);
        ctx.bezierCurveTo(cx - w, by - h * 0.5, cx + sw * 0.5 - w * 0.3, by - h * 0.7, cx + sw, by - h);
        ctx.bezierCurveTo(cx + sw * 0.5 + w * 0.3, by - h * 0.7, cx + w, by - h * 0.5, cx + w, by);
        ctx.bezierCurveTo(cx + w, by + w * 0.8, cx - w, by + w * 0.8, cx - w, by);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
      }
    }));
  }

  // 얼음 결정: 기준점 (22, 108), 끝은 위쪽
  for (let lean of [-8, 0, 8]) {
    shardTex.push(makeLayer(44, 116, (ctx) => {
      let cx = 22, by = 108, w = 22, h = 100;
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';

      ctx.fillStyle = 'rgb(95,155,235)';
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, by);
      ctx.lineTo(cx - w * 0.4, by - h * 0.55);
      ctx.lineTo(cx + lean, by - h);
      ctx.lineTo(cx + w * 0.05, by);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = 'rgb(205,232,255)';
      ctx.beginPath();
      ctx.moveTo(cx + w * 0.05, by);
      ctx.lineTo(cx + lean, by - h);
      ctx.lineTo(cx + w * 0.45, by - h * 0.5);
      ctx.lineTo(cx + w / 2, by);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(cx + lean, by - h);
      ctx.lineTo(cx + lean - w * 0.12, by - h * 0.7);
      ctx.lineTo(cx + lean + w * 0.18, by - h * 0.68);
      ctx.closePath();
      ctx.fill();
    }));
  }

  // 물방울 4종 (파랑 2, 흰 테두리 2). 기준점 (32, 32), 반지름 약 20
  bubbleTex.push(makeBubble(true, 21, 19, -0.4));
  bubbleTex.push(makeBubble(true, 19, 21, 0.5));
  bubbleTex.push(makeBubble(false, 21, 20, 0.2));
  bubbleTex.push(makeBubble(false, 20, 21, -0.3));
}

// tint() 대신 캔버스 알파로 직접 그리기. alpha: 0~255
function glowSprite(sp, x, y, size, alpha) {
  let ctx = drawingContext;
  let prev = ctx.globalAlpha;
  ctx.globalAlpha = constrain(alpha / 255, 0, 1);
  ctx.drawImage(sp.elt, x - size / 2, y - size / 2, size, size);
  ctx.globalAlpha = prev;
}

// 스프라이트를 이동/회전/확대해서 그리기. (ax, ay)는 스프라이트 안의 기준점, alpha: 0~1
function drawSprite(sp, x, y, ax, ay, sx, sy, rot, alpha) {
  let ctx = drawingContext;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(sx, sy);
  ctx.globalAlpha = constrain(alpha, 0, 1);
  ctx.drawImage(sp.elt, -ax, -ay);
  ctx.restore();
}

/* ---------- 유틸 ---------- */

function easeOut(t) { return 1 - pow(1 - t, 3); }

function easeOutBack(t) {
  let c1 = 1.70158;
  let c3 = c1 + 1;
  return 1 + c3 * pow(t - 1, 3) + c1 * pow(t - 1, 2);
}

function offscreen(x, y) {
  return x < -100 || x > width + 100 || y < -100 || y > height + 100;
}

function jag(x1, y1, x2, y2, disp, levels) {
  let pts = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  for (let l = 0; l < levels; l++) {
    let np = [];
    for (let i = 0; i < pts.length - 1; i++) {
      let a = pts[i], b = pts[i + 1];
      np.push(a);
      np.push({
        x: (a.x + b.x) / 2 + random(-disp, disp),
        y: (a.y + b.y) / 2 + random(-disp, disp)
      });
    }
    np.push(pts[pts.length - 1]);
    pts = np;
    disp *= 0.55;
  }
  return pts;
}

/* ---------- 손 하나의 상태 ---------- */

class HandElement {
  constructor() {
    this.element = null;   // null | 'fire' | 'water' | 'lightning' | 'ice'
    this.palmCenter = { x: 320, y: 240 };
    this.anchor = { x: 320, y: 240 };
    this.palmSize = 120;
    this.s = 1;

    this.seen = false;
    this.openFrames = 0;
    this.shooting = false;
    this.dir = { x: 0, y: -1 };     // 발사 방향 (손목 → 손가락, 부드럽게 보정됨)
    this.dirT = { x: 0, y: -1 };

    this.pillarFrames = 0;
    this.pillarTex = PILLARS.map(() => random(shardTex));
  }

  track(kp) {
    this.seen = true;
    let wrist = kp[0];
    let thumbTip = kp[4];
    let middleMcp = kp[9];

    this.palmSize = dist(wrist.x, wrist.y, middleMcp.x, middleMcp.y);

    let ids = [0, 5, 9, 13, 17];
    let sx = 0, sy = 0;
    for (let id of ids) { sx += kp[id].x; sy += kp[id].y; }
    this.palmCenter.x = sx / ids.length;
    this.palmCenter.y = sy / ids.length;

    // 발사 방향: 손목 → 중지 뿌리
    let dx = middleMcp.x - wrist.x, dy = middleMcp.y - wrist.y;
    let m = sqrt(dx * dx + dy * dy) || 1;
    this.dirT.x = dx / m;
    this.dirT.y = dy / m;

    // 주먹: 네 손가락 끝이 모두 손목 가까이에 있음
    let avgTipDist = 0;
    for (let id of [8, 12, 16, 20]) {
      avgTipDist += dist(kp[id].x, kp[id].y, wrist.x, wrist.y);
    }
    avgTipDist /= 4;
    let isFist = avgTipDist < this.palmSize * 1.3;

    // 손바닥 펼침: 손가락이 쭉 펴지고, 서로 벌어지고, 엄지도 떨어져 있음
    let tipGap = (dist(kp[8].x, kp[8].y, kp[12].x, kp[12].y) +
                  dist(kp[12].x, kp[12].y, kp[16].x, kp[16].y) +
                  dist(kp[16].x, kp[16].y, kp[20].x, kp[20].y)) / 3;
    let mcpGap = (dist(kp[5].x, kp[5].y, kp[9].x, kp[9].y) +
                  dist(kp[9].x, kp[9].y, kp[13].x, kp[13].y) +
                  dist(kp[13].x, kp[13].y, kp[17].x, kp[17].y)) / 3 || 1;
    let extended = avgTipDist > this.palmSize * OPEN_EXTEND;
    let spread = tipGap / mcpGap > OPEN_SPREAD;
    let thumbOut = dist(thumbTip.x, thumbTip.y, kp[5].x, kp[5].y) > this.palmSize * OPEN_THUMB;
    let isOpen = extended && spread && thumbOut;

    // 깜빡임 방지: 3프레임 연속이어야 시작, 3프레임 풀려야 멈춤
    this.openFrames = isOpen ? min(this.openFrames + 1, 8) : max(this.openFrames - 2, 0);

    // 엄지와 가장 가깝게 맞닿은 손가락 찾기
    let best = null;
    let bestD = Infinity;
    for (let el in FINGERS) {
      let tip = kp[FINGERS[el]];
      let d = dist(thumbTip.x, thumbTip.y, tip.x, tip.y);
      if (d < this.palmSize * 0.35 && d < bestD) {
        best = el;
        bestD = d;
      }
    }

    if (isFist) {
      this.element = null;
      this.openFrames = 0;
    } else if (best) {
      if (best !== this.element) {
        this.anchor.x = this.palmCenter.x;
        this.anchor.y = this.palmCenter.y;
        if (best === 'ice') {
          this.pillarFrames = 0;
          this.pillarTex = PILLARS.map(() => random(shardTex));
        }
      }
      this.element = best;
    }

    this.shooting = this.element !== null && this.openFrames >= 3;
  }

  step() {
    // 손이 화면에서 사라지면 발사 중지
    if (!this.seen) {
      this.shooting = false;
      this.openFrames = 0;
    }
    this.seen = false;

    this.anchor.x = lerp(this.anchor.x, this.palmCenter.x, 0.5);
    this.anchor.y = lerp(this.anchor.y, this.palmCenter.y, 0.5);
    this.s = constrain(this.palmSize / 120, 0.6, 2.2);

    this.dir.x = lerp(this.dir.x, this.dirT.x, 0.4);
    this.dir.y = lerp(this.dir.y, this.dirT.y, 0.4);
    let m = sqrt(this.dir.x * this.dir.x + this.dir.y * this.dir.y) || 1;
    this.dir.x /= m;
    this.dir.y /= m;

    if (!this.element) return;

    if (this.shooting) {
      this.shoot();
      return;
    }

    let x = this.anchor.x, y = this.anchor.y, s = this.s;

    if (this.element === 'fire') {
      for (let i = 0; i < 2; i++) if (room('fire')) lists.fire.push(new FlameTongue(x, y, s));
      if (random() < 0.35 && room('fire')) lists.fire.push(new Ember(x, y, s));
      if (random() < 0.2 && room('smoke')) lists.smoke.push(new Smoke(x, y - 30 * s, s));
    } else if (this.element === 'water') {
      // 물방울이 피어오름
      if (random() < 0.35 && lists.water.length < CAP.water - 8) spawnBubbleGroup(x, y, s);
    } else if (this.element === 'lightning') {
      if (random() < 0.75 && room('lightning')) lists.lightning.push(new Bolt(x, y, s));
      for (let i = 0; i < 2; i++) if (room('lightning')) lists.lightning.push(new Spark(x, y, s));
    } else if (this.element === 'ice') {
      // 한기 (기둥은 drawHandExtras에서 한 번만 자라남)
      if (random() < 0.5 && room('ice')) lists.ice.push(new ColdMist(x, y, s));
      if (random() < 0.3 && room('glint')) lists.glint.push(new Glint(x, y, s));
    }
  }

  // 손바닥을 펼쳤을 때: 손이 향한 방향으로 원소 발사
  shoot() {
    let ps = this.palmSize, s = this.s, d = this.dir;
    let ox = this.anchor.x + d.x * ps * 0.5;
    let oy = this.anchor.y + d.y * ps * 0.5;

    if (this.element === 'fire') {
      for (let i = 0; i < 2; i++) if (room('fire')) lists.fire.push(new FireShot(ox, oy, d, s));
      if (random() < 0.3 && room('fire')) lists.fire.push(new Ember(ox, oy, s));
    } else if (this.element === 'water') {
      for (let i = 0; i < 2; i++) if (lists.water.length < CAP.water - 4) spawnBubbleShot(ox, oy, s, d);
    } else if (this.element === 'lightning') {
      if (random() < 0.9 && room('lightning')) {
        let a = atan2(d.y, d.x) + random(-0.12, 0.12);
        let b = new Bolt(ox, oy, s, a, random(250, 420));
        lists.lightning.push(b);
        if (random() < 0.5) {
          for (let i = 0; i < 2; i++) lists.lightning.push(new Spark(b.ex, b.ey, s));
        }
      }
    } else if (this.element === 'ice') {
      if (random() < 0.55 && room('ice')) lists.ice.push(new IceShot(ox, oy, d, s));
    }
  }

  drawHandGlow() {
    if (!this.element) return;
    let x = this.anchor.x, y = this.anchor.y, ps = this.palmSize;
    let f = random(0.9, 1.1);
    blendMode(ADD);
    if (this.element === 'fire') {
      glowSprite(sprites.fire, x, y - ps * 0.4, ps * 2.6 * f, 120);
    } else if (this.element === 'water') {
      glowSprite(sprites.water, x, y, ps * 2.2, 70);
    } else if (this.element === 'lightning') {
      glowSprite(sprites.gold, x, y, ps * 2.4 * f, 150);
      glowSprite(sprites.white, x, y, ps * 0.9 * f, 230);
    } else if (this.element === 'ice') {
      glowSprite(sprites.ice, x, y, ps * 2.2, 90);
    }
    blendMode(BLEND);
  }

  // 얼음 기둥: 얼음 상태가 되면 한 번 솟아오르고, 그 뒤로는 더 자라지 않고 유지됨
  drawHandExtras() {
    let want = this.element === 'ice' && !this.shooting;
    this.pillarFrames = want ? min(this.pillarFrames + 1, 60) : max(this.pillarFrames - 3, 0);
    if (this.pillarFrames <= 0) return;

    let ps = this.palmSize;
    for (let i = 0; i < PILLARS.length; i++) {
      let p = PILLARS[i];
      let t = constrain((this.pillarFrames - p.d) / 24, 0, 1);
      if (t <= 0) continue;
      let grow = easeOutBack(t);
      let h = ps * p.h;
      let w = h * 0.22;
      drawSprite(this.pillarTex[i], this.anchor.x + p.ox * ps, this.anchor.y + ps * 0.15,
                 22, 108, (w / 22) * grow, (h / 100) * grow, p.tilt, 1);
    }
  }
}

/* ---------- 불 ---------- */

class FlameTongue {
  constructor(x, y, s) {
    this.s = s;
    this.base = x + random(-14, 14) * s;
    this.x = this.base;
    this.y = y + random(-4, 8) * s;
    this.vy = random(-1.5, -2.6) * s;
    this.w = random(9, 17) * s;
    this.h = random(45, 85) * s;
    this.phase = random(TWO_PI);
    this.freq = random(0.12, 0.22);
    this.tex = random(tongueTex);
    this.sway = 0;
    this.life = 1;
    this.decay = random(0.022, 0.034);
  }
  update() {
    this.y += this.vy;
    this.life -= this.decay;
    let k = 0.6 + (1 - this.life) * 1.6;
    this.sway = sin(this.phase + frameCount * this.freq) * this.w * k;
    this.x = this.base + this.sway * 0.4;
  }
  show() {
    let k = this.life;
    drawSprite(this.tex, this.x, this.y, 30, 80,
               (this.w / 13) * k, (this.h / 65) * k,
               atan2(this.sway, this.h) * 0.8, k);
  }
  isDead() { return this.life <= 0; }
}

// 발사되는 불: 머리는 앞, 불꽃 꼬리는 뒤로 길게 늘어짐
class FireShot {
  constructor(x, y, dir, s) {
    let a = atan2(dir.y, dir.x) + random(-0.14, 0.14);
    let sp = random(9, 14) * s;
    this.x = x;
    this.y = y;
    this.vx = cos(a) * sp;
    this.vy = sin(a) * sp;
    this.w = random(14, 24) * s;
    this.h = random(60, 100) * s;
    this.tex = random(tongueTex);
    this.life = 1;
    this.decay = 0.025;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
    if (offscreen(this.x, this.y)) this.life = 0;
  }
  show() {
    let k = this.life;
    let rot = atan2(-this.vy, -this.vx) + HALF_PI;   // 불꽃 끝이 진행 반대쪽을 향하게
    drawSprite(this.tex, this.x, this.y, 30, 80,
               (this.w / 13) * (0.6 + 0.4 * k), (this.h / 65) * (0.5 + 0.5 * k), rot, k);
    glowSprite(sprites.fire, this.x, this.y, this.w * 3, 140 * k);
  }
  isDead() { return this.life <= 0; }
}

class Ember {
  constructor(x, y, s) {
    this.x = x + random(-18, 18) * s;
    this.y = y;
    this.vx = random(-1, 1) * s;
    this.vy = random(-2.5, -1) * s;
    this.size = random(2, 4) * s;
    this.phase = random(TWO_PI);
    this.life = 1;
  }
  update() {
    this.x += this.vx + sin(this.phase + frameCount * 0.2) * 0.5;
    this.y += this.vy;
    this.life -= 0.02;
  }
  show() {
    noStroke();
    fill(255, 200, 80, this.life * 255 * random(0.6, 1));
    circle(this.x, this.y, this.size);
  }
  isDead() { return this.life <= 0; }
}

class Smoke {
  constructor(x, y, s) {
    this.x = x + random(-12, 12) * s;
    this.y = y;
    this.vx = random(-0.3, 0.3);
    this.vy = random(-1.4, -0.8) * s;
    this.size = random(40, 70) * s;
    this.life = 1;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= 0.012;
  }
  show() {
    glowSprite(sprites.smoke, this.x, this.y, this.size * (1 + (1 - this.life)), this.life * 50);
  }
  isDead() { return this.life <= 0; }
}

/* ---------- 물 ---------- */

// 물방울 하나. 천천히 피어오르며 좌우로 흔들리고, 마지막에 톡 터짐
class WaterBubble {
  constructor(x, y, r, vx, vy, decay, wob) {
    this.x = x; this.y = y;
    this.r = r;
    this.vx = vx; this.vy = vy;
    this.decay = decay;
    this.wob = wob;
    this.phase = random(TWO_PI);
    this.tex = random(bubbleTex);
    this.life = 1;
  }
  update() {
    this.x += this.vx + sin(this.phase + frameCount * 0.1) * this.wob;
    this.y += this.vy;
    this.life -= this.decay;
    if (offscreen(this.x, this.y)) this.life = 0;
  }
  show() {
    let age = 1 - this.life;
    let grow = age < 0.15 ? easeOutBack(age / 0.15) : 1;     // 작게 맺혔다가 커짐
    let popping = this.life < 0.12;
    let pop = popping ? 1 + (0.12 - this.life) * 3 : 1;      // 터질 때 살짝 부풀며 사라짐
    let a = popping ? this.life / 0.12 : 1;
    let sc = (this.r / 20) * grow * pop;
    drawSprite(this.tex, this.x, this.y, 32, 32, sc, sc, 0, a);
  }
  isDead() { return this.life <= 0; }
}

// 큰 방울 하나 + 작은 방울 몇 개가 함께 피어오름
function spawnBubbleGroup(x, y, s) {
  let bx = x + random(-20, 20) * s;
  let by = y + random(-10, 10) * s;
  let r = random(10, 22) * s;
  lists.water.push(new WaterBubble(bx, by, r, random(-0.5, 0.5) * s, random(-1.6, -0.7) * s,
                                   random(0.012, 0.018), 0.4));
  let n = floor(random(1, 4));
  for (let i = 0; i < n; i++) {
    lists.water.push(new WaterBubble(bx + random(-26, 26) * s, by + random(-18, 18) * s,
                                     r * random(0.2, 0.45),
                                     random(-0.5, 0.5) * s, random(-1.9, -0.8) * s,
                                     random(0.014, 0.022), 0.3));
  }
}

// 발사: 방울이 손이 향한 방향으로 날아감
function spawnBubbleShot(x, y, s, d) {
  let a = atan2(d.y, d.x) + random(-0.15, 0.15);
  let sp = random(8, 13) * s;
  lists.water.push(new WaterBubble(x, y, random(8, 20) * s, cos(a) * sp, sin(a) * sp, 0.02, 0.2));
  if (random() < 0.5) {
    let a2 = a + random(-0.25, 0.25);
    let sp2 = sp * random(0.8, 1.1);
    lists.water.push(new WaterBubble(x, y, random(3, 7) * s, cos(a2) * sp2, sin(a2) * sp2, 0.025, 0.2));
  }
}

/* ---------- 번개 ---------- */

class Bolt {
  // angleOverride / lenOverride를 주면 그 방향·길이로 (발사용). 없으면 사방으로 랜덤
  constructor(x, y, s, angleOverride, lenOverride) {
    this.s = s;
    this.life = 1;
    this.segs = [];

    let shot = lenOverride !== undefined;
    let len = shot ? lenOverride : random(70, 170) * s;
    let angle = angleOverride !== undefined ? angleOverride : -HALF_PI + random(-1.9, 1.9);
    this.ex = x + cos(angle) * len;
    this.ey = y + sin(angle) * len;
    let main = jag(x, y, this.ex, this.ey, len * (shot ? 0.08 : 0.14), 4);
    this.segs.push({ pts: main, w: 1 });

    let nb = shot ? floor(random(3, 6)) : floor(random(2, 4));
    for (let b = 0; b < nb; b++) {
      let idx = floor(random(2, main.length - 3));
      let p = main[idx];
      let ba = angle + random(0.5, 1.1) * (random() < 0.5 ? -1 : 1);
      let bl = len * random(0.25, 0.5) * (shot ? 0.5 : 1);
      this.segs.push({
        pts: jag(p.x, p.y, p.x + cos(ba) * bl, p.y + sin(ba) * bl, bl * 0.14, 3),
        w: 0.5
      });
    }
  }
  update() { this.life -= 0.1; }
  show() {
    let f = random(0.75, 1);
    noFill();
    strokeJoin(ROUND);
    for (let seg of this.segs) {
      let k = seg.w * this.s;
      let passes = [
        [9, 255, 190, 70, 45],
        [4.5, 255, 215, 100, 110],
        [1.8, 255, 255, 245, 255]
      ];
      for (let p of passes) {
        stroke(p[1], p[2], p[3], p[4] * this.life * f);
        strokeWeight(max(0.8, p[0] * k));
        beginShape();
        for (let v of seg.pts) vertex(v.x, v.y);
        endShape();
      }
    }
  }
  isDead() { return this.life <= 0; }
}

class Spark {
  constructor(x, y, s) {
    let a = random(TWO_PI);
    let sp = random(3, 9) * s;
    this.x = x; this.y = y;
    this.vx = cos(a) * sp;
    this.vy = sin(a) * sp;
    this.s = s;
    this.life = 1;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.92;
    this.vy *= 0.92;
    this.life -= 0.05;
  }
  show() {
    stroke(255, 235, 160, this.life * 255);
    strokeWeight(2.2 * this.s);
    line(this.x, this.y, this.x - this.vx * 2, this.y - this.vy * 2);
  }
  isDead() { return this.life <= 0; }
}

/* ---------- 얼음 ---------- */

// 한기: 손 주변에서 번져 나와 천천히 가라앉는 차가운 안개
class ColdMist {
  constructor(x, y, s) {
    let a = random(TWO_PI);
    let r = random(10, 45) * s;
    this.x = x + cos(a) * r;
    this.y = y + sin(a) * r * 0.6;
    this.vx = cos(a) * random(0.2, 0.7) * s;
    this.vy = random(0.2, 0.7) * s;      // 찬 공기는 아래로 가라앉음
    this.size = random(50, 90) * s;
    this.life = 1;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= 0.014;
  }
  show() {
    glowSprite(sprites.mist, this.x, this.y, this.size * (1 + (1 - this.life) * 0.8), this.life * 70);
  }
  isDead() { return this.life <= 0; }
}

// 발사되는 얼음 조각: 끝이 날아가는 방향을 향하고 한기 꼬리를 남김
class IceShot {
  constructor(x, y, dir, s) {
    let a = atan2(dir.y, dir.x) + random(-0.1, 0.1);
    let sp = random(11, 16) * s;
    this.x = x;
    this.y = y;
    this.vx = cos(a) * sp;
    this.vy = sin(a) * sp;
    this.h = random(50, 90) * s;
    this.w = this.h * random(0.2, 0.28);
    this.tex = random(shardTex);
    this.rot = a + HALF_PI;
    this.s = s;
    this.life = 1;
    this.decay = 0.02;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
    if (offscreen(this.x, this.y)) this.life = 0;
    if (random() < 0.4 && room('ice')) lists.ice.push(new ColdMist(this.x, this.y, this.s * 0.5));
  }
  show() {
    let a = this.life < 0.25 ? this.life / 0.25 : 1;
    drawSprite(this.tex, this.x, this.y, 22, 58, this.w / 22, this.h / 100, this.rot, a);
  }
  isDead() { return this.life <= 0; }
}

class Glint {
  constructor(x, y, s) {
    let a = random(TWO_PI);
    let r = random(10, 55) * s;
    this.x = x + cos(a) * r;
    this.y = y + sin(a) * r;
    this.size = random(4, 9) * s;
    this.life = 1;
  }
  update() { this.life -= 0.035; }
  show() {
    let k = sin(PI * (1 - this.life)) * this.size;
    stroke(200, 235, 255, this.life * 255);
    strokeWeight(1.4);
    line(this.x - k, this.y, this.x + k, this.y);
    line(this.x, this.y - k, this.x, this.y + k);
  }
  isDead() { return this.life <= 0; }
}

function gotHands(results) {
  hands = results;
}
