/* =========================================================================
   손 인식 두더지 잡기
   - 편 손(OPEN)  : 뿅망치 커서 이동
   - 주먹(FIST)   : 편 손 -> 주먹으로 "바뀌는 순간" 1회 타격
   - 제한 시간 30초, 구멍 9개
   - 카메라가 없어도 마우스로 플레이 가능
   ========================================================================= */

const CFG = {
  W: 900,
  H: 700,

  // 주먹 판정 임계값 (fist-hit-detection.md 참고, 카메라 앞에서 튜닝)
  OPEN_ENTER: 1.15,
  FIST_ENTER: 0.85,
  FIST_EXIT: 1.00,
  FIST_CONFIRM_FRAMES: 3,
  OPEN_CONFIRM_FRAMES: 2,
  HIT_COOLDOWN_MS: 300,
  MIN_HAND_SIZE: 0.03,
  MIN_CONFIDENCE: 0.5,

  // 게임
  GAME_SECONDS: 30,
  HOLE_R: 68,
};

// 손 좌표를 화면에 매핑할 때 쓰는 여유 영역 (가장자리 손도 닿게)
const MAP_X0 = 0.06, MAP_X1 = 0.94;
const MAP_Y0 = 0.12, MAP_Y1 = 0.88;

/* ------------------------------ 상태 ---------------------------------- */

let handPose;
let video;
let hands = [];

// 손 상태 머신
let handState = "NO_HAND"; // NO_HAND | OPEN | FIST
let fistStreak = 0;
let openStreak = 0;
let lastHitAt = -99999;
let lastHandedness = null;
let lastSpread = 0;
let lastHandSize = 0;
let hasHandMetrics = false;

// 커서
let cursor = { x: CFG.W / 2, y: CFG.H / 2 };
let hasCursor = false;
let cursorHistory = [];

// 게임
let phase = "ready"; // ready | playing | over
let timeLeft = CFG.GAME_SECONDS;
let score = 0;
let combo = 0;
let bestCombo = 0;
let holes = [];
let spawnTimer = 0;
let pops = [];
let hammer = { x: CFG.W / 2, y: CFG.H / 2, swing: 0 };

let showDebug = true;
let actx = null;
let modelReady = false;
let bootAt = 0; // 로딩 직후 의도치 않은 클릭으로 시작되는 것 방지

/* ------------------------------ 초기화 --------------------------------- */

function preload() {
  handPose = ml5.handPose({ maxHands: 2 }, () => {
    modelReady = true;
  });
}

function setup() {
  createCanvas(CFG.W, CFG.H);
  textFont("sans-serif");
  bootAt = millis();

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  try {
    handPose.detectStart(video, gotHands);
  } catch (e) {
    console.warn("손 인식 시작 실패:", e);
  }

  buildHoles();
}

function buildHoles() {
  holes = [];
  const xs = [CFG.W * 0.2, CFG.W * 0.5, CFG.W * 0.8];
  const ys = [265, 430, 595];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      holes.push({
        x: xs[c],
        y: ys[r],
        mole: null,
        flash: 0,
      });
    }
  }
}

/* --------------------------- 손 인식 콜백 ------------------------------ */

function gotHands(results) {
  hands = results || [];
  if (!modelReady) modelReady = true;

  const now = millis();
  const hand = pickHand(hands);

  if (!hand || !hand.keypoints || hand.keypoints.length < 21) {
    handState = "NO_HAND";
    fistStreak = 0;
    openStreak = 0;
    lastHandedness = null;
    hasHandMetrics = false;
    return;
  }

  const conf = typeof hand.confidence === "number" ? hand.confidence : 1;
  if (conf < CFG.MIN_CONFIDENCE) return;

  const kp = hand.keypoints;
  const m = measureHand(kp);
  if (!m.valid || m.handSize < CFG.MIN_HAND_SIZE) return;

  lastSpread = m.spread;
  lastHandSize = m.handSize;
  hasHandMetrics = true;

  // 손이 바뀌면 상태 리셋 (좌표 튐 방지)
  const hd = hand.handedness || null;
  if (lastHandedness && hd && hd !== lastHandedness) {
    handState = "NO_HAND";
    fistStreak = 0;
    openStreak = 0;
    cursorHistory = [];
  }
  lastHandedness = hd;

  // 커서 좌표 (스무딩)
  const p = mapPoint(m.palm);
  if (!hasCursor) {
    cursor.x = p.x;
    cursor.y = p.y;
    hasCursor = true;
  } else {
    cursor.x += 0.35 * (p.x - cursor.x);
    cursor.y += 0.35 * (p.y - cursor.y);
  }

  // 이전 확정 상태로 히스토리 기록 (타격 좌표 계산용)
  cursorHistory.push({ x: cursor.x, y: cursor.y, state: handState, t: now });
  if (cursorHistory.length > 20) cursorHistory.shift();

  // 편 손으로 확정된 동안에만 뿅망치 이동
  if (handState === "OPEN") {
    hammer.x = cursor.x;
    hammer.y = cursor.y;
  }

  // 스트릭 갱신
  fistStreak = m.spread <= CFG.FIST_ENTER ? fistStreak + 1 : 0;
  openStreak = m.spread >= CFG.OPEN_ENTER ? openStreak + 1 : 0;

  // --- 상태 전환 ---
  if (handState !== "FIST" && fistStreak >= CFG.FIST_CONFIRM_FRAMES) {
    const isEdge = handState === "OPEN"; // 편 손 -> 주먹 전환만 타격
    handState = "FIST";
    openStreak = 0;

    if (isEdge && now - lastHitAt >= CFG.HIT_COOLDOWN_MS) {
      lastHitAt = now;
      const p2 = medianOfLastOpen(3) || cursor;
      smashAt(p2);
    }
    return;
  }

  if (handState === "FIST") {
    if (m.spread > CFG.FIST_EXIT) {
      handState = "OPEN";
      fistStreak = 0;
    }
    return; // 주먹 유지 중 추가 타격 없음
  }

  if (openStreak >= CFG.OPEN_CONFIRM_FRAMES) {
    handState = "OPEN";
  }
}

function pickHand(list) {
  let best = null;
  let bestScore = -1;
  for (const h of list) {
    if (!h || !h.keypoints || h.keypoints.length < 21) continue;
    const s = typeof h.confidence === "number" ? h.confidence : 0.5;
    if (s > bestScore) {
      bestScore = s;
      best = h;
    }
  }
  return best;
}

function measureHand(kp) {
  const P = (i) => kp[i];
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const handSize = d(P(0), P(9));
  if (!isFinite(handSize) || handSize < 1e-6) return { valid: false };

  const palm = {
    x: (P(0).x + P(5).x + P(9).x + P(13).x + P(17).x) / 5,
    y: (P(0).y + P(5).y + P(9).y + P(13).y + P(17).y) / 5,
  };

  const tips = [8, 12, 16, 20];
  let sum = 0;
  for (const i of tips) sum += d(P(i), palm);
  const spread = sum / tips.length / handSize;

  return { valid: true, handSize, palm, spread };
}

function cameraActive() {
  return !!(
    video &&
    video.elt &&
    video.elt.readyState >= 2 &&
    video.elt.videoWidth > 0
  );
}

function mapPoint(pt) {
  const vw = video.width || 640;
  const vh = video.height || 480;
  // 좌우 반전 (거울 모드)
  const nx = 1 - constrain(pt.x / vw, 0, 1);
  const ny = constrain(pt.y / vh, 0, 1);
  return {
    x: CFG.W * (MAP_X0 + nx * (MAP_X1 - MAP_X0)),
    y: CFG.H * (MAP_Y0 + ny * (MAP_Y1 - MAP_Y0)),
  };
}

function medianOfLastOpen(n) {
  const open = cursorHistory.filter((h) => h.state === "OPEN").slice(-n);
  if (!open.length) return null;
  const xs = open.map((o) => o.x).sort((a, b) => a - b);
  const ys = open.map((o) => o.y).sort((a, b) => a - b);
  const mid = Math.floor(open.length / 2);
  return { x: xs[mid], y: ys[mid] };
}

/* ----------------------------- 타격 처리 ------------------------------- */

function smashAt(p) {
  if (!p) return;

  hammer.x = constrain(p.x, 20, CFG.W - 20);
  hammer.y = constrain(p.y, 20, CFG.H - 20);
  hammer.swing = 1;

  if (phase !== "playing") return;

  // 가장 가까운 "살아있는 두더지" 하나만
  let target = null;
  let bestDist = Infinity;
  for (const h of holes) {
    if (!h.mole) continue;
    const d = Math.hypot(p.x - h.x, p.y - h.y);
    if (d <= CFG.HOLE_R * 1.2 && d < bestDist) {
      bestDist = d;
      target = h;
    }
  }

  if (target) {
    target.mole = null;
    target.flash = 1;
    score += 1;
    combo += 1;
    bestCombo = max(bestCombo, combo);

    pops.push({
      x: target.x,
      y: target.y - 46,
      vy: -55,
      text: "+1",
      color: [255, 226, 120],
      t: 0,
      life: 0.7,
      size: 34,
    });

    if (combo > 0 && combo % 3 === 0) {
      pops.push({
        x: target.x,
        y: target.y - 92,
        vy: -35,
        text: "COMBO x" + combo,
        color: [140, 255, 210],
        t: 0,
        life: 0.9,
        size: 24,
      });
    }

    beep(700 + min(combo, 10) * 45, 0.07, "square", 0.05);
  } else {
    combo = 0;
    beep(170, 0.09, "sine", 0.04);
  }
}

/* ----------------------------- 게임 루프 ------------------------------- */

function startGame() {
  phase = "playing";
  timeLeft = CFG.GAME_SECONDS;
  score = 0;
  combo = 0;
  bestCombo = 0;
  spawnTimer = 0.35;
  pops = [];
  for (const h of holes) {
    h.mole = null;
    h.flash = 0;
  }
  handState = "NO_HAND";
  fistStreak = 0;
  openStreak = 0;
  lastHitAt = -99999;
  cursorHistory = [];
  ensureAudio();
  beep(520, 0.09, "triangle", 0.05);
}

function endGame() {
  phase = "over";
  for (const h of holes) h.mole = null;
  beep(240, 0.25, "sine", 0.06);
}

function updateGame(dt) {
  timeLeft -= dt;
  if (timeLeft <= 0) {
    timeLeft = 0;
    endGame();
    return;
  }

  const progress = 1 - timeLeft / CFG.GAME_SECONDS;

  // 두더지 수명
  for (const h of holes) {
    h.flash = max(0, h.flash - dt * 4);
    if (!h.mole) continue;
    h.mole.age += dt;
    if (h.mole.age >= h.mole.life) {
      h.mole = null;
      combo = 0;
      pops.push({
        x: h.x,
        y: h.y - 40,
        vy: -30,
        text: "MISS",
        color: [200, 200, 200],
        t: 0,
        life: 0.6,
        size: 20,
      });
    }
  }

  // 스폰
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    trySpawn(progress);
    spawnTimer = lerp(0.95, 0.55, progress) * random(0.8, 1.2);
  }

  // 팝업
  for (const p of pops) {
    p.t += dt;
    p.y += p.vy * dt;
  }
  pops = pops.filter((p) => p.t < p.life);

  // 뿅망치 복귀 애니메이션
  hammer.swing = max(0, hammer.swing - dt * 5);
}

function trySpawn(progress) {
  const empty = holes.filter((h) => !h.mole);
  if (!empty.length) return;

  const active = holes.length - empty.length;
  const maxConcurrent = progress > 0.55 ? 2 : 1;
  if (active >= maxConcurrent) return;

  const h = random(empty);
  const life = lerp(1.15, 0.78, progress) * random(0.9, 1.1);
  h.mole = { age: 0, life, tone: floor(random(3)) };
}

/* ------------------------------- 렌더링 -------------------------------- */

function draw() {
  const dt = min(deltaTime / 1000, 0.05);

  drawBackground();

  if (phase === "playing") updateGame(dt);
  else hammer.swing = max(0, hammer.swing - dt * 5);

  // 손이 없으면 마우스가 뿅망치를 대신 조종 (플레이 중에만)
  if (!hands.length && phase === "playing") {
    hammer.x = lerp(hammer.x, mouseX, 0.25);
    hammer.y = lerp(hammer.y, mouseY, 0.25);
  }

  for (const h of holes) drawHoleBase(h);
  for (const h of holes) drawMole(h);
  for (const h of holes) drawHoleLip(h);
  drawPops();
  if (phase === "playing") drawHammer();
  drawHUD();
  drawPreview();

  if (showDebug) drawDebug();

  if (phase === "ready") drawReadyOverlay();
  if (phase === "over") drawOverOverlay();
}

function drawBackground() {
  // 이전 프레임을 완전히 지운 뒤 줄무늬를 채운다 (반투명 잔상 방지)
  background(24, 48, 40);
  noStroke();
  for (let y = 0; y < CFG.H; y += 4) {
    const t = y / CFG.H;
    fill(lerp(26, 46, t), lerp(52, 82, t), lerp(42, 58, t));
    rect(0, y, CFG.W, 4);
  }
  fill(0, 0, 0, 45);
  rect(0, 0, CFG.W, 96);
  fill(255, 255, 255, 10);
  rect(0, 96, CFG.W, 2);
}

function drawHoleBase(h) {
  noStroke();
  fill(18, 28, 22);
  ellipse(h.x, h.y + 8, CFG.HOLE_R * 2 + 14, CFG.HOLE_R * 0.9);
  fill(10, 16, 13);
  ellipse(h.x, h.y + 2, CFG.HOLE_R * 2, CFG.HOLE_R * 0.74);

  noFill();
  stroke(8, 12, 10, 160);
  strokeWeight(6);
  ellipse(h.x, h.y + 2, CFG.HOLE_R * 2 - 4, CFG.HOLE_R * 0.68);
  noStroke();
}

function drawMole(h) {
  if (!h.mole) return;

  const p = h.mole.age / h.mole.life;
  let up = 1;
  if (h.mole.age < 0.12) up = h.mole.age / 0.12;
  if (p > 0.85) up = max(0, (1 - p) / 0.15);
  up = constrain(up, 0, 1);

  const cy = h.y + 12 - up * 54;

  const ctx = drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.rect(h.x - 90, h.y - 130, 180, 138);
  ctx.clip();
  drawMoleBody(h.x, cy, h.mole.tone, p);
  ctx.restore();

  if (h.flash > 0) {
    noFill();
    stroke(255, 240, 150, 200 * h.flash);
    strokeWeight(5);
    ellipse(h.x, h.y, CFG.HOLE_R * 2 * (1.2 - h.flash * 0.4),
      CFG.HOLE_R * 0.9 * (1.2 - h.flash * 0.4));
    noStroke();
  }
}

function drawMoleBody(x, y, tone, p) {
  const bodyColors = [
    [138, 96, 64],
    [120, 84, 60],
    [150, 106, 72],
  ];
  const c = bodyColors[tone % 3];

  // 몸통
  fill(c[0], c[1], c[2]);
  ellipse(x, y + 4, 70, 76);

  // 귀
  fill(c[0] - 10, c[1] - 10, c[2] - 10);
  ellipse(x - 30, y - 24, 26, 26);
  ellipse(x + 30, y - 24, 26, 26);

  // 주둥이
  fill(232, 206, 178);
  ellipse(x, y + 16, 38, 28);

  // 코
  fill(58, 40, 32);
  ellipse(x, y + 8, 13, 10);

  // 눈
  fill(250);
  ellipse(x - 15, y - 6, 16, 17);
  ellipse(x + 15, y - 6, 16, 17);
  fill(30, 24, 20);
  const look = sin(p * 9) * 2;
  ellipse(x - 15 + look, y - 5, 8, 9);
  ellipse(x + 15 + look, y - 5, 8, 9);

  // 수염
  stroke(90, 66, 48, 170);
  strokeWeight(1.5);
  line(x - 8, y + 14, x - 26, y + 10);
  line(x - 8, y + 18, x - 26, y + 20);
  line(x + 8, y + 14, x + 26, y + 10);
  line(x + 8, y + 18, x + 26, y + 20);
  noStroke();
}

function drawHoleLip(h) {
  noFill();
  stroke(74, 104, 80);
  strokeWeight(3);
  arc(h.x, h.y + 4, CFG.HOLE_R * 2 + 6, CFG.HOLE_R * 0.78, 0.12, PI - 0.12);
  stroke(52, 74, 58);
  strokeWeight(2);
  arc(h.x, h.y + 2, CFG.HOLE_R * 2 - 2, CFG.HOLE_R * 0.72, 0.2, PI - 0.2);
  noStroke();
}

function drawHammer() {
  const s = easeOutQuad(hammer.swing);

  // 커서 링
  noFill();
  stroke(255, 255, 255, 90);
  strokeWeight(2);
  ellipse(hammer.x, hammer.y, 44, 44);
  stroke(255, 240, 150, 160);
  ellipse(hammer.x, hammer.y, 30, 30);
  noStroke();

  push();
  translate(hammer.x, hammer.y);
  rotate(-0.6 + s * 1.35);
  scale(1 + s * 0.08);

  // 손잡이
  fill(126, 84, 48);
  rectMode(CENTER);
  rect(0, 44, 15, 96, 7);
  fill(96, 62, 34);
  rect(0, 88, 15, 16, 7);

  // 망치 머리
  fill(176, 180, 190);
  rect(0, -2, 92, 48, 14);
  fill(138, 142, 154);
  rect(0, 16, 92, 14, 7);
  fill(220, 224, 232, 90);
  rect(-24, -16, 30, 8, 4);

  pop();
  rectMode(CORNER);
}

function drawPops() {
  textAlign(CENTER, CENTER);
  for (const p of pops) {
    const a = 255 * (1 - p.t / p.life);
    const c = p.color;
    textSize(p.size);
    textStyle(BOLD);
    fill(0, 0, 0, a * 0.35);
    text(p.text, p.x + 2, p.y + 2);
    fill(c[0], c[1], c[2], a);
    text(p.text, p.x, p.y);
  }
  textStyle(NORMAL);
}

function drawHUD() {
  // 점수
  textAlign(LEFT, CENTER);
  noStroke();
  fill(255, 255, 255, 170);
  textSize(14);
  text("SCORE", 30, 30);
  fill(255);
  textSize(40);
  textStyle(BOLD);
  text(score, 30, 62);
  textStyle(NORMAL);

  // 콤보
  if (combo >= 2) {
    fill(140, 255, 210);
    textSize(16);
    textStyle(BOLD);
    text("COMBO x" + combo, 112, 66);
    textStyle(NORMAL);
  }

  // 타이머 바
  const bw = 300;
  const bx = CFG.W / 2 - bw / 2;
  const by = 34;
  noStroke();
  fill(0, 0, 0, 90);
  rect(bx, by, bw, 18, 9);
  const ratio = constrain(timeLeft / CFG.GAME_SECONDS, 0, 1);
  const col = ratio > 0.5 ? [120, 230, 160] : ratio > 0.25 ? [250, 210, 90] : [255, 110, 100];
  fill(col[0], col[1], col[2]);
  rect(bx, by, bw * ratio, 18, 9);

  fill(255, 255, 255, 220);
  textAlign(CENTER, CENTER);
  textSize(15);
  textStyle(BOLD);
  text(ceil(timeLeft) + "s", CFG.W / 2, by + 9);
  textStyle(NORMAL);

  // 손 상태 배지
  const label =
    handState === "OPEN" ? "OPEN  이동" : handState === "FIST" ? "FIST  타격" : "손 대기";
  const bc = handState === "OPEN" ? [120, 220, 160] : handState === "FIST" ? [255, 170, 90] : [160, 160, 160];
  textAlign(LEFT, CENTER);
  fill(bc[0], bc[1], bc[2], 190);
  textSize(13);
  text(label, 30, 88);
}

function drawPreview() {
  const pw = 148;
  const ph = 111;
  const px = CFG.W - pw - 16;
  const py = 12;

  if (!cameraActive()) {
    noStroke();
    fill(0, 0, 0, 140);
    rect(px - 4, py - 4, pw + 8, ph + 8, 10);
    fill(255, 255, 255, 130);
    textAlign(CENTER, CENTER);
    textSize(12);
    text("카메라 없음", px + pw / 2, py + ph / 2 - 10);
    fill(160, 180, 170);
    textSize(11);
    text("마우스로 플레이", px + pw / 2, py + ph / 2 + 10);
    return;
  }

  push();
  noStroke();
  fill(0, 0, 0, 140);
  rect(px - 4, py - 4, pw + 8, ph + 8, 10);

  // 거울 모드로 영상 표시
  push();
  translate(px + pw, py);
  scale(-1, 1);
  image(video, 0, 0, pw, ph);
  pop();

  // 손가락 점
  if (hands.length) {
    const h = pickHand(hands);
    if (h && h.keypoints) {
      for (const k of h.keypoints) {
        const dx = px + pw - (k.x / (video.width || 640)) * pw;
        const dy = py + (k.y / (video.height || 480)) * ph;
        fill(120, 255, 190, 220);
        noStroke();
        circle(dx, dy, 4);
      }
    }
  }
  pop();

  noFill();
  stroke(255, 255, 255, 60);
  strokeWeight(2);
  rect(px - 4, py - 4, pw + 8, ph + 8, 10);
  noStroke();
}

function drawDebug() {
  const pw = 280;
  const ph = 74;
  const px = 16;
  const py = 104;

  noStroke();
  fill(0, 0, 0, 150);
  rect(px, py, pw, ph, 10);

  textAlign(LEFT, TOP);
  fill(200, 255, 220, 170);
  textSize(10);
  text("SPREAD", px + 12, py + 9);
  fill(200, 255, 220);
  textSize(13);
  text(nf(lastSpread, 1, 2), px + 66, py + 7);

  // 게이지
  const gx = px + 12;
  const gy = py + 28;
  const gw = pw - 24;

  fill(40, 60, 50);
  rect(gx, gy, gw, 8, 4);

  const sx = gx + constrain(lastSpread / 1.6, 0, 1) * gw;
  fill(120, 220, 255);
  rect(gx, gy, max(0, sx - gx), 8, 4);

  const tx = (v) => gx + (v / 1.6) * gw;
  stroke(255, 214, 90);
  strokeWeight(2);
  line(tx(CFG.FIST_ENTER), gy - 3, tx(CFG.FIST_ENTER), gy + 11);
  stroke(255, 120, 120);
  line(tx(CFG.OPEN_ENTER), gy - 3, tx(CFG.OPEN_ENTER), gy + 11);
  noStroke();

  fill(220);
  textSize(11);
  const cd = max(0, CFG.HIT_COOLDOWN_MS - (millis() - lastHitAt));
  text(
    "state " + handState + "   fist " + fistStreak + "/" + CFG.FIST_CONFIRM_FRAMES +
      "   cd " + Math.round(cd),
    gx,
    py + 42
  );

  fill(140, 160, 150);
  textSize(10);
  text(
    hasHandMetrics
      ? "D: 디버그 숨기기   R: 재시작"
      : "손이 잘 보이게 카메라 앞 40~80cm",
    gx,
    py + 58
  );
}

/* ------------------------------ 오버레이 ------------------------------- */

function drawReadyOverlay() {
  noStroke();
  fill(6, 12, 9, 210);
  rect(0, 0, CFG.W, CFG.H);

  textAlign(CENTER, CENTER);
  fill(255, 240, 170);
  textSize(46);
  textStyle(BOLD);
  text("두더지 잡기", CFG.W / 2, 210);
  textStyle(NORMAL);

  fill(255);
  textSize(20);
  text("손을 펴면 뿅망치가 따라오고,", CFG.W / 2, 290);
  text("주먹을 쥐는 순간 그 자리를 내리칩니다.", CFG.W / 2, 322);

  fill(170, 230, 200);
  textSize(18);
  text("제한 시간 30초  ·  구멍 9개", CFG.W / 2, 384);

  fill(255, 255, 255, 210);
  textSize(16);
  text("카메라가 없으면 마우스로도 플레이할 수 있어요.", CFG.W / 2, 448);

  const blink = 0.6 + 0.4 * sin(millis() / 300);
  fill(255, 230, 130, 255 * blink);
  textSize(24);
  textStyle(BOLD);
  text("클릭 또는 스페이스로 시작", CFG.W / 2, 520);
  textStyle(NORMAL);

  fill(150, 160, 155);
  textSize(13);
  text(
    modelReady ? "손 인식 모델 준비 완료" : "손 인식 모델 불러오는 중...",
    CFG.W / 2,
    648
  );

  if (hasHandMetrics) {
    fill(150, 190, 175);
    textSize(13);
    text("현재 손 펴짐: " + nf(lastSpread, 1, 2), CFG.W / 2, 672);
  }
}

function drawOverOverlay() {
  noStroke();
  fill(6, 12, 9, 215);
  rect(0, 0, CFG.W, CFG.H);

  textAlign(CENTER, CENTER);
  fill(255, 240, 170);
  textSize(40);
  textStyle(BOLD);
  text("시간 종료!", CFG.W / 2, 210);
  textStyle(NORMAL);

  fill(255);
  textSize(20);
  text("점수", CFG.W / 2, 290);

  fill(140, 255, 200);
  textSize(76);
  textStyle(BOLD);
  text(score, CFG.W / 2, 356);
  textStyle(NORMAL);

  fill(220);
  textSize(18);
  text("최고 콤보  x" + bestCombo, CFG.W / 2, 428);

  const blink = 0.6 + 0.4 * sin(millis() / 300);
  fill(255, 230, 130, 255 * blink);
  textSize(22);
  textStyle(BOLD);
  text("클릭 또는 스페이스로 다시 도전", CFG.W / 2, 520);
  textStyle(NORMAL);
}

/* ------------------------------- 입력 ---------------------------------- */

function mousePressed() {
  if (millis() - bootAt < 800) return false;
  if (phase === "ready") {
    startGame();
    return false;
  }
  if (phase === "over") {
    startGame();
    return false;
  }
  if (phase === "playing") {
    smashAt({ x: mouseX, y: mouseY });
    return false;
  }
}

function keyPressed() {
  if (millis() - bootAt < 800) return false;
  if (key === " " || keyCode === ENTER) {
    if (phase !== "playing") startGame();
    return false;
  }
  if (key === "r" || key === "R") {
    startGame();
    return false;
  }
  if (key === "d" || key === "D") {
    showDebug = !showDebug;
    return false;
  }
}

/* ------------------------------- 기타 ---------------------------------- */

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

function ensureAudio() {
  if (actx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) actx = new AC();
  } catch (e) {
    actx = null;
  }
}

function beep(freq, dur, type, gain) {
  if (!actx) return;
  try {
    if (actx.state === "suspended") actx.resume();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type || "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain || 0.05, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g);
    g.connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + dur);
  } catch (e) {
    /* 무시 */
  }
}
