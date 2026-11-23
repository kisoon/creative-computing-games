/* ============================================================
   印 · 인술 트레이너
   12인(12지신) 인식 + 인 시퀀스 → 인술 이펙트 MVP
   - ml5.js handPose (MoveNet/MediaPipe HandLandmarker) : 21 관절
   - ml5.js faceMesh (입 벌림 판정)
   - 인식 방식: 사용자 캘리브레이션(1-shot) + kNN
   ============================================================ */

/* ---------- 상수 ---------- */

const W = 1280;
const H = 720;
const VW = 640;
const VH = 480;
const COVER = Math.max(W / VW, H / VH);
const OFFX = (W - VW * COVER) / 2;
const OFFY = (H - VH * COVER) / 2;

const SEALS = [
  { name: "쥐", emoji: "🐀", code: "Digit1" },
  { name: "소", emoji: "🐂", code: "Digit2" },
  { name: "호랑이", emoji: "🐅", code: "Digit3" },
  { name: "토끼", emoji: "🐇", code: "Digit4" },
  { name: "용", emoji: "🐉", code: "Digit5" },
  { name: "뱀", emoji: "🐍", code: "Digit6" },
  { name: "말", emoji: "🐴", code: "Digit7" },
  { name: "염소", emoji: "🐐", code: "Digit8" },
  { name: "원숭이", emoji: "🐒", code: "Digit9" },
  { name: "닭", emoji: "🐓", code: "Digit0" },
  { name: "개", emoji: "🐕", code: "KeyQ" },
  { name: "돼지", emoji: "🐗", code: "KeyW" },
];

const SEAL_BY_NAME = Object.fromEntries(SEALS.map((s) => [s.name, s]));
const SEAL_BY_CODE = Object.fromEntries(SEALS.map((s) => [s.code, s.name]));

const JUTSU = [
  {
    id: "chidori",
    name: "치도리",
    seals: ["소", "토끼", "원숭이"],
    sub: "CHIDORI",
    accent: "#7fe3ff",
  },
  {
    id: "fireball",
    name: "호화구의 술법",
    seals: ["뱀", "염소", "원숭이", "돼지", "말", "호랑이"],
    sub: "FIREBALL JUTSU",
    accent: "#ff9a4d",
  },
  {
    id: "clone",
    name: "분신술",
    seals: ["염소", "뱀", "호랑이"],
    sub: "CLONE JUTSU",
    accent: "#a9c7ff",
  },
];

const MODEL_KEY = "ninjutsu-12seal-model-v1";
const RECOG_THRESHOLD = 0.27;
const STABLE_FRAMES = 6;
const STABLE_MS = 280;
const TRAIN_SAMPLES = 5;

const HAND_LINKS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

/* ---------- 상태 ---------- */

let handPose = null;
let faceMesh = null;
let facePromise = null;
let faceDetecting = false;
let video = null;
let detecting = false;

let hands = [];
let faces = [];
let lastHandAt = 0;

let state = "idle"; // idle | play
let demoMode = false;
let model = loadModel();
let sampleCache = null;

let training = null;
let seq = [];
let lastEmit = { name: null, at: 0 };
let cand = { name: null, count: 0, since: 0, dist: 0 };

let effect = null;
let particles = [];
let dust = [];
let shake = 0;
let flash = 0;

let bannerTimer = null;
let promptTimer = null;
let toastTimer = null;
let promptUntil = 0;

let bgLayer = null;
let demoLayer = null;
let soundOn = true;
let audioCtx = null;
let skeletonOn = true;
let lastHud = 0;
let lastSeqSig = "";
let lastJutsuUpd = 0;

let statusText = "";
let statusWarn = false;
let statusUntil = 0;

const UI = {};

/* ============================================================
   p5
   ============================================================ */

function setup() {
  const c = createCanvas(W, H);
  c.parent("canvasHost");
  pixelDensity(1);
  frameRate(60);

  UI.startOverlay = document.getElementById("startOverlay");
  UI.seqBar = document.getElementById("seqBar");
  UI.sealNow = document.getElementById("sealNow");
  UI.statusLine = document.getElementById("statusLine");
  UI.trainDrawer = document.getElementById("trainDrawer");
  UI.sealGrid = document.getElementById("sealGrid");
  UI.trainCount = document.getElementById("trainCount");
  UI.banner = document.getElementById("banner");
  UI.bannerName = UI.banner.querySelector(".banner-name");
  UI.bannerSub = UI.banner.querySelector(".banner-sub");
  UI.prompt = document.getElementById("prompt");
  UI.toast = document.getElementById("toast");
  UI.helpModal = document.getElementById("helpModal");
  UI.jutsuList = document.getElementById("jutsuList");
  UI.helpJutsu = document.getElementById("helpJutsu");
  UI.soundBtn = document.getElementById("btnSound");

  makeBackground();
  makeDemoLayer();
  makeDust();
  buildJutsuPanel();
  buildHelp();
  buildSealGrid();
  wireUI();
  maybeAutoDemo();

  setStatus("ml5 모델 불러오는 중…");

  (async () => {
    try {
      if (typeof ml5 === "undefined") throw new Error("ml5 not loaded");
      handPose = await ml5.handPose({ maxHands: 2, flipped: true });
      setStatus("준비 완료 · 시작을 눌러 주세요");
      if (state === "play" && video && video.elt && video.elt.videoWidth > 0 && !detecting) {
        handPose.detectStart(video, onHands);
        detecting = true;
      }
    } catch (e) {
      console.error(e);
      setStatus("모델 로드 실패 — 인터넷 연결을 확인하세요", true);
    }
  })();
}

function draw() {
  const dt = Math.min(0.05, (deltaTime || 16) / 1000);

  if (state === "idle") {
    drawIdle(dt);
    return;
  }

  if (!training) updateRecognition();
  updateTraining();
  updateEffects(dt);
  renderPlay(dt);
  updateHUD();
}

/* ============================================================
   배경 / 대기 화면
   ============================================================ */

function makeBackground() {
  bgLayer = createGraphics(W, H);
  const ctx = bgLayer.drawingContext;

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#080b12");
  g.addColorStop(0.45, "#0b1220");
  g.addColorStop(1, "#05070c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const r = ctx.createRadialGradient(W * 0.5, H * 0.45, H * 0.1, W * 0.5, H * 0.45, H * 0.95);
  r.addColorStop(0, "rgba(40, 70, 110, 0.30)");
  r.addColorStop(0.55, "rgba(12, 20, 34, 0.12)");
  r.addColorStop(1, "rgba(0, 0, 0, 0.55)");
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, W, H);

  // 엔소(円相) 느낌의 흐린 링
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.strokeStyle = "rgba(232, 176, 75, 0.07)";
  ctx.lineWidth = 54;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, Math.min(W, H) * 0.34, 0.35, Math.PI * 2 - 0.18);
  ctx.stroke();
  ctx.restore();

  // 미세 그리드
  ctx.strokeStyle = "rgba(140, 180, 220, 0.025)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

function makeDust() {
  dust = [];
  for (let i = 0; i < 60; i++) {
    dust.push({
      x: random(W),
      y: random(H),
      r: random(0.6, 2.2),
      vy: random(-7, -2),
      vx: random(-3, 3),
      a: random(0.05, 0.22),
      p: random(TWO_PI),
    });
  }
}

function drawIdle(dt) {
  image(bgLayer, 0, 0, W, H);
  updateDust(dt);
  drawDust();
}

function updateDust(dt) {
  for (const d of dust) {
    d.p += dt * 0.6;
    d.x += (d.vx + Math.sin(d.p) * 4) * dt;
    d.y += d.vy * dt;
    if (d.y < -10) {
      d.y = H + 10;
      d.x = random(W);
    }
    if (d.x < -10) d.x = W + 10;
    if (d.x > W + 10) d.x = -10;
  }
}

function drawDust() {
  noStroke();
  for (const d of dust) {
    fill(200, 220, 255, 255 * d.a);
    circle(d.x, d.y, d.r * 2);
  }
}

/* ============================================================
   카메라 / 시작
   ============================================================ */

async function startExperience(asDemo) {
  state = "play";
  demoMode = !!asDemo;
  initAudio();
  UI.startOverlay.classList.add("hidden");
  setStatus(demoMode ? "데모 모드 · 키보드 1~0, Q, W" : "카메라 권한을 허용해 주세요…");

  if (demoMode) {
    showToast("데모 모드 · 키보드 1~0, Q, W 로 인을 입력하세요");
    return;
  }

  try {
    video = createCapture(VIDEO);
    video.size(VW, VH);
    video.hide();

    const ok = await waitFor(() => video && video.elt && video.elt.videoWidth > 0, 12000);
    if (!ok) throw new Error("camera timeout");

    setStatus("손을 카메라에 보여 주세요");
    if (handPose) {
      handPose.detectStart(video, onHands);
      detecting = true;
    }
    // 호화구 발동 시 바로 쓸 수 있도록 얼굴 모델을 미리 준비
    ensureFaceMesh();
  } catch (e) {
    console.error(e);
    demoMode = true;
    if (video) {
      try { video.remove(); } catch (_) {}
      video = null;
    }
    setStatus("카메라를 열 수 없어 데모 모드로 전환했습니다", true);
    showToast("카메라 없이 데모 모드로 실행합니다");
  }
}

function onHands(results) {
  hands = results || [];
  lastHandAt = millis();
}

function waitFor(fn, timeout = 8000) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      if (fn()) return resolve(true);
      if (performance.now() - t0 > timeout) return resolve(false);
      setTimeout(tick, 100);
    };
    tick();
  });
}

/* ============================================================
   렌더링 (플레이)
   ============================================================ */

function renderPlay(dt) {
  push();

  if (shake > 0.2) {
    translate(random(-shake, shake), random(-shake, shake));
  }

  image(bgLayer, 0, 0, W, H);

  if (video && video.elt && video.elt.videoWidth > 0) {
    push();
    translate(W, 0);
    scale(-1, 1);
    image(video, OFFX, OFFY, VW * COVER, VH * COVER);
    pop();

    noStroke();
    fill(4, 7, 12, 92);
    rect(0, 0, W, H);
  } else {
    updateDust(dt);
    drawDust();
    if (demoMode && demoLayer) {
      push();
      tint(155, 195, 245, 150);
      image(demoLayer, 0, OFFY, W, VH * COVER);
      noTint();
      pop();
    }
  }

  if (effect && effect.type === "clone") drawCloneEffect();

  drawSkeleton();
  if (effect && effect.type === "fireball" && effect.phase === "fire") drawFireJet();
  drawParticles();
  drawShockwave();

  if (effect && effect.type === "chidori") drawChidori();

  drawVignette();
  pop();
}

function drawVignette() {
  const ctx = drawingContext;
  ctx.save();
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  if (flash > 0.004) {
    noStroke();
    fill(255, 255, 255, 255 * Math.min(0.55, flash));
    rect(0, 0, W, H);
  }
}

function drawSkeleton() {
  if (!skeletonOn || !hands || !hands.length) return;

  push();
  noFill();
  for (const h of hands) {
    const kp = h.keypoints || [];
    if (kp.length < 21) continue;
    const conf = avgConf(kp);
    if (conf < 0.25) continue;

    stroke(127, 227, 255, 70);
    strokeWeight(1.4);
    for (const [a, b] of HAND_LINKS) {
      if ((kp[a].confidence ?? 1) < 0.3 || (kp[b].confidence ?? 1) < 0.3) continue;
      const pa = toCanvas(kp[a].x, kp[a].y);
      const pb = toCanvas(kp[b].x, kp[b].y);
      line(pa.x, pa.y, pb.x, pb.y);
    }

    noStroke();
    for (let i = 0; i < 21; i++) {
      if ((kp[i].confidence ?? 1) < 0.3) continue;
      const p = toCanvas(kp[i].x, kp[i].y);
      fill(220, 245, 255, i % 4 === 0 ? 170 : 90);
      circle(p.x, p.y, i % 4 === 0 ? 5 : 3.2);
    }
  }
  pop();
}

function toCanvas(x, y) {
  return { x: x * COVER + OFFX, y: y * COVER + OFFY };
}

function avgConf(kp) {
  let s = 0;
  for (const p of kp) s += p.confidence ?? 1;
  return s / kp.length;
}

/* ============================================================
   인식 (관절 특징 + kNN)
   ============================================================ */

function featureFromHands(hs, minConf = 0.2) {
  const arr = (hs || [])
    .filter((h) => h && h.keypoints && h.keypoints.length >= 21)
    .map((h) => {
      const kp = h.keypoints;
      const w = kp[0];
      const m = kp[9];
      const s = Math.max(1e-4, dist(w.x, w.y, m.x, m.y));
      const vec = kp.map((p) => [(p.x - w.x) / s, (p.y - w.y) / s]);
      return { vec, conf: avgConf(kp), x: w.x };
    })
    .filter((h) => h.conf >= minConf)
    .sort((a, b) => a.x - b.x)
    .slice(0, 2);

  if (!arr.length) return null;
  return { hands: [arr[0] ? arr[0].vec : null, arr[1] ? arr[1].vec : null] };
}

function handDistance(a, b) {
  let s = 0;
  for (let i = 0; i < 21; i++) {
    s += Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]);
  }
  return s / 21;
}

function featureDistance(A, B) {
  let best = Infinity;
  const perms = [[0, 1], [1, 0]];
  const ca = A.hands.filter(Boolean).length;
  const cb = B.hands.filter(Boolean).length;

  for (const [i0, i1] of perms) {
    let sum = 0;
    let n = 0;
    if (A.hands[0] && B.hands[i0]) { sum += handDistance(A.hands[0], B.hands[i0]); n++; }
    if (A.hands[1] && B.hands[i1]) { sum += handDistance(A.hands[1], B.hands[i1]); n++; }
    if (n === 0) continue;
    let d = sum / n;
    if (ca !== cb) d += 0.05;
    if (d < best) best = d;
  }
  return best;
}

function trainedCount() {
  return SEALS.reduce((n, s) => n + ((model.seals[s.name] || []).length ? 1 : 0), 0);
}

function getSamples() {
  if (sampleCache) return sampleCache;
  const out = [];
  for (const s of SEALS) {
    const arr = model.seals[s.name] || [];
    for (const f of arr) out.push({ name: s.name, feat: f });
  }
  sampleCache = out;
  return out;
}

function updateRecognition() {
  if (!hands || !hands.length) {
    cand.name = null;
    cand.count = 0;
    return;
  }
  if (millis() - lastHandAt > 900) return;

  const list = getSamples();
  if (!list.length) return;

  const feat = featureFromHands(hands);
  if (!feat) return;

  let best = null;
  for (const s of list) {
    const d = featureDistance(feat, s.feat);
    if (!best || d < best.d) best = { name: s.name, d };
  }

  if (!best) return;

  if (best.d < RECOG_THRESHOLD) {
    if (cand.name !== best.name) {
      cand = { name: best.name, count: 1, since: millis(), dist: best.d };
    } else {
      cand.count++;
      cand.dist = best.d;
    }

    const stable = cand.count >= STABLE_FRAMES && millis() - cand.since >= STABLE_MS;
    if (stable && lastEmit.name !== best.name) {
      cand.count = 0;
      emitSeal(best.name, best.d);
    }
  } else {
    cand.count = 0;
    cand.name = null;
    cand.dist = best.d;
  }
}

/* ============================================================
   학습 (캘리브레이션)
   ============================================================ */

function startTraining(name) {
  if (state !== "play") {
    showToast("먼저 시작해 주세요");
    return;
  }
  if (training) {
    showToast("이미 학습 중입니다");
    return;
  }
  if (!handPose) {
    showToast("모델이 아직 준비되지 않았습니다");
    return;
  }
  if (!video || !video.elt || !video.elt.videoWidth) {
    showToast("학습에는 카메라가 필요합니다 (데모 모드 불가)");
    return;
  }

  training = {
    name,
    phase: "count",
    t0: millis(),
    lastCap: 0,
    samples: [],
    lastShown: -1,
  };
  markTrainingCard(name);
  openDrawer();
}

function updateTraining() {
  if (!training) return;
  const now = millis();

  if (training.phase === "count") {
    const remain = 3 - Math.floor((now - training.t0) / 1000);
    if (remain > 0) {
      if (remain !== training.lastShown) {
        training.lastShown = remain;
        showPrompt(`${training.name}  ${remain}`, 980);
      }
    } else {
      training.phase = "capture";
      training.t0 = now;
      training.lastCap = 0;
      showPrompt(`${training.name} 유지!`, 900, true);
    }
    return;
  }

  if (training.phase === "capture") {
    if (now - training.lastCap > 170) {
      training.lastCap = now;
      if (hands && hands.length) {
        const f = featureFromHands(hands);
        if (f) training.samples.push(f);
      }
    }
    if (training.samples.length >= TRAIN_SAMPLES || now - training.t0 > 3000) {
      finishTraining();
    }
  }
}

function finishTraining() {
  const t = training;
  training = null;
  hidePrompt();

  if (!t) return;

  if (t.samples.length >= 3) {
    model.seals[t.name] = t.samples.slice(0, TRAIN_SAMPLES);
    sampleCache = null;
    saveModel();
    buildSealGrid();
    showToast(`${t.name} 인 학습 완료 · 샘플 ${t.samples.length}개`);
    beep(880, 0.08, "triangle", 0.04);
  } else {
    markTrainingCard(null);
    buildSealGrid();
    showToast(`${t.name} 인식 실패 — 손이 잘 보이게 다시 시도해 주세요`);
  }
}

function markTrainingCard(name) {
  UI.sealGrid.querySelectorAll(".seal-card").forEach((el) => {
    el.classList.toggle("training", el.dataset.name === name);
  });
}

/* ============================================================
   시퀀스 / 인술
   ============================================================ */

function emitSeal(name, d = 0) {
  if (!SEAL_BY_NAME[name]) return;
  const now = millis();
  seq.push({ name, at: now });
  while (seq.length && now - seq[0].at > 45000) seq.shift();
  if (seq.length > 10) seq.shift();
  lastEmit = { name, at: now };

  beep(760, 0.05, "triangle", 0.025);
  renderSeq();
  checkJutsu();
}

function checkJutsu() {
  for (const j of JUTSU) {
    const n = j.seals.length;
    if (seq.length < n) continue;
    const tail = seq.slice(-n).map((s) => s.name);
    if (tail.every((v, i) => v === j.seals[i])) {
      triggerJutsu(j);
      return;
    }
  }
}

function triggerJutsu(j) {
  if (effect) endEffect();
  seq = [];
  renderSeq();
  cand = { name: null, count: 0, since: 0, dist: 0 };

  effect = {
    id: j.id,
    type: j.id,
    jutsu: j,
    t0: millis(),
    accent: j.accent,
    phase: null,
    snap: null,
    ring: 0,
  };

  showBanner(j.name, j.sub, j.accent);

  if (j.id === "chidori") {
    effect.ring = 1;
    flash = 0.32;
    shake = 7;
    noise(0.8, 0.1, "highpass", 1600);
    beep(120, 0.4, "sawtooth", 0.03);
  }

  if (j.id === "fireball") {
    effect.phase = "charge";
    effect.mouthBase = 0;
    effect.mouthBaseAt = 0;
    effect.lastPrompt = 0;
    effect.autoAt = demoMode ? 1400 : 5200;
    startFaceMesh();
    showPrompt("입을 크게 벌려!", 900, true);
  }

  if (j.id === "clone") {
    effect.ring = 1;
    effect.snap = makeSnapshot();
    shake = 4;
    noise(0.35, 0.11, "bandpass", 650);
    spawnSmoke(W / 2 - 300, H * 0.62, 20);
    spawnSmoke(W / 2 + 300, H * 0.62, 20);
  }
}

function renderSeq() {
  const sig = seq.map((s) => s.name).join("|");
  if (sig === lastSeqSig) return;
  lastSeqSig = sig;

  if (!seq.length) {
    UI.seqBar.innerHTML = "";
    return;
  }

  UI.seqBar.innerHTML = seq
    .map((s, i) => {
      const seal = SEAL_BY_NAME[s.name];
      if (!seal) return "";
      const fresh = i === seq.length - 1 ? " fresh" : "";
      return `<span class="chip${fresh}"><span class="e">${seal.emoji}</span>${seal.name}</span>`;
    })
    .join("");
}

function jutsuProgress(j) {
  for (let L = Math.min(seq.length, j.seals.length); L > 0; L--) {
    const tail = seq.slice(-L).map((s) => s.name);
    if (tail.every((v, i) => v === j.seals[i])) return L;
  }
  return 0;
}

/* ============================================================
   이펙트
   ============================================================ */

function updateEffects(dt) {
  shake = Math.max(0, shake - shake * 9 * dt - 4 * dt);
  flash = Math.max(0, flash - flash * 5 * dt - 0.3 * dt);

  updateParticles(dt);

  if (!effect) return;

  const t = (millis() - effect.t0) / 1000;
  effect.t = t;

  if (effect.type === "chidori") {
    spawnSparks(dt);
    if (t > 4.4) endEffect();
    return;
  }

  if (effect.type === "fireball") {
    if (effect.phase === "charge") {
      updateFaceGate();
      if (millis() - effect.t0 > effect.autoAt) {
        startFire(null);
      }
    } else if (effect.phase === "fire") {
      const ft = (millis() - effect.fireT0) / 1000;
      if (ft < 3.0) spawnFire(dt);
      if (ft > 3.8) endEffect();
    }
    return;
  }

  if (effect.type === "clone") {
    if (t > 3.6) endEffect();
  }
}

function endEffect() {
  if (!effect) return;
  if (effect.type === "fireball" && faceMesh) {
    try { faceMesh.detectStop(); } catch (_) {}
    faceDetecting = false;
    faces = [];
  }
  if (effect.snap) {
    try { effect.snap.remove(); } catch (_) {}
  }
  effect = null;
  hidePrompt();
}

/* ---------- 치도리 ---------- */

function getRightHandAnchor() {
  if (hands && hands.length) {
    const pts = hands
      .filter((h) => h.keypoints && h.keypoints.length >= 21)
      .map((h) => {
        const kp = h.keypoints;
        const ids = [0, 5, 9, 13, 17];
        let x = 0;
        let y = 0;
        for (const i of ids) { x += kp[i].x; y += kp[i].y; }
        const p = toCanvas(x / ids.length, y / ids.length);
        return { ...p, conf: avgConf(kp) };
      })
      .filter((p) => p.conf > 0.2);

    if (pts.length) {
      pts.sort((a, b) => a.x - b.x);
      return pts[pts.length - 1];
    }
  }
  return demoMode ? { x: 778, y: 486 } : { x: W * 0.7, y: H * 0.52 };
}

function spawnSparks(dt) {
  const env = chidoriEnv();
  if (env <= 0.02) return;
  const p = getRightHandAnchor();
  const n = Math.ceil(90 * dt * env);
  for (let i = 0; i < n; i++) {
    const a = random(TWO_PI);
    const sp = random(40, 320) * env;
    particles.push({
      x: p.x + random(-16, 16),
      y: p.y + random(-16, 16),
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - random(0, 40),
      life: 0,
      max: random(0.18, 0.55),
      size: random(1, 2.8),
      drag: 0.06,
      gravity: 240,
      type: "spark",
    });
  }
}

function chidoriEnv() {
  if (!effect || effect.type !== "chidori") return 0;
  const t = (millis() - effect.t0) / 1000;
  return Math.min(1, t / 0.18) * Math.min(1, Math.max(0, (4.4 - t) / 0.6));
}

function drawChidori() {
  if (!effect || effect.type !== "chidori") return;
  const env = chidoriEnv();
  if (env <= 0.01) return;

  const t = (millis() - effect.t0) / 1000;
  const p = getRightHandAnchor();

  push();
  const ctx = drawingContext;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const R = 80 + 34 * Math.sin(t * 21) + 26 * env;
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R * 1.5);
  g.addColorStop(0, `rgba(226, 250, 255, ${0.5 * env})`);
  g.addColorStop(0.3, `rgba(120, 220, 255, ${0.32 * env})`);
  g.addColorStop(0.7, `rgba(40, 130, 255, ${0.13 * env})`);
  g.addColorStop(1, "rgba(20, 60, 180, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, R * 1.6, 0, Math.PI * 2);
  ctx.fill();

  // 전기 링
  for (let r = 0; r < 3; r++) {
    const rad = 34 + r * 20 + Math.sin(t * 18 + r) * 4;
    noFill();
    stroke(150, 232, 255, 65 * env);
    strokeWeight(1.2);
    beginShape();
    for (let i = 0; i <= 30; i++) {
      const a = (i / 30) * TWO_PI;
      const rr = rad + random(-4, 4);
      vertex(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
    }
    endShape(CLOSE);
  }

  strokeCap(ROUND);
  for (let b = 0; b < 9; b++) {
    const a = random(TWO_PI);
    const len = random(50, 175);
    drawBolt(p.x, p.y, p.x + Math.cos(a) * len, p.y + Math.sin(a) * len, len * 0.26, env);
  }
  for (let b = 0; b < 4; b++) {
    const a = random(TWO_PI);
    const len = random(120, 270);
    drawBolt(p.x, p.y, p.x + Math.cos(a) * len, p.y + Math.sin(a) * len, len * 0.3, env * 0.65);
  }

  ctx.restore();

  noStroke();
  fill(255, 255, 255, 235 * env);
  circle(p.x, p.y, 18 + 7 * Math.sin(t * 38));
  fill(170, 235, 255, 90 * env);
  circle(p.x, p.y, 46 + 12 * Math.sin(t * 24));

  pop();
}

function buildBolt(x1, y1, x2, y2, depth, disp, out) {
  if (depth <= 0) {
    out.push([x1, y1], [x2, y2]);
    return;
  }
  const mx = (x1 + x2) / 2 + random(-disp, disp);
  const my = (y1 + y2) / 2 + random(-disp, disp);
  buildBolt(x1, y1, mx, my, depth - 1, disp * 0.55, out);
  buildBolt(mx, my, x2, y2, depth - 1, disp * 0.55, out);
}

function drawBolt(x1, y1, x2, y2, disp, env) {
  const pts = [];
  buildBolt(x1, y1, x2, y2, 4, disp, pts);
  noFill();

  stroke(130, 225, 255, 55 * env);
  strokeWeight(7);
  beginShape();
  for (const pt of pts) vertex(pt[0], pt[1]);
  endShape();

  stroke(238, 251, 255, 225 * env);
  strokeWeight(1.5);
  beginShape();
  for (const pt of pts) vertex(pt[0], pt[1]);
  endShape();
}

/* ---------- 호화구 ---------- */

async function startFaceMesh() {
  if (!video || faceDetecting) return;

  if (!faceMesh) {
    await ensureFaceMesh();
  }
  if (!faceMesh || faceDetecting || !video) return;
  if (!effect || effect.type !== "fireball" || effect.phase !== "charge") return;

  try {
    faceMesh.detectStart(video, onFaces);
    faceDetecting = true;
  } catch (e) {
    console.error("faceMesh detectStart failed", e);
  }
}

/* 얼굴 모델은 실제 발동 전에 미리 내려받아 둔다. */
function ensureFaceMesh() {
  if (faceMesh) return Promise.resolve(faceMesh);
  if (facePromise) return facePromise;
  if (typeof ml5 === "undefined") return Promise.resolve(null);

  facePromise = Promise.resolve()
    .then(() => ml5.faceMesh({ maxFaces: 1, flipHorizontal: true }))
    .then((m) => {
      faceMesh = m;
      return m;
    })
    .catch((e) => {
      console.error("faceMesh load failed", e);
      faceMesh = null;
      return null;
    })
    .finally(() => {
      facePromise = null;
    });

  return facePromise;
}

function onFaces(results) {
  faces = results || [];
}

function getMouthAnchor() {
  if (faces && faces.length) {
    const kp = faces[0].keypoints;
    if (kp && kp.length > 152) {
      const a = kp[13];
      const b = kp[14];
      return toCanvas((a.x + b.x) / 2, (a.y + b.y) / 2);
    }
  }
  return null;
}

function updateFaceGate() {
  if (!effect || effect.phase !== "charge") return;

  if (!video) {
    // 데모 모드: 자동 발동 타이머만 사용
    if (millis() - effect.lastPrompt > 600) {
      effect.lastPrompt = millis();
      showPrompt("입을 크게 벌려!", 900, true);
    }
    return;
  }

  if (!faces || !faces.length) {
    if (millis() - effect.lastPrompt > 700) {
      effect.lastPrompt = millis();
      showPrompt("얼굴이 보이게 해 주세요", 900, true);
    }
    return;
  }

  const kp = faces[0].keypoints;
  if (!kp || kp.length < 468) return;

  const ul = kp[13];
  const ll = kp[14];
  const top = kp[10];
  const chin = kp[152];
  const faceH = Math.max(1e-3, dist(top.x, top.y, chin.x, chin.y));
  const ratio = dist(ul.x, ul.y, ll.x, ll.y) / faceH;

  if (!effect.mouthBase) {
    effect.mouthBase = ratio;
    effect.mouthBaseAt = millis();
  } else if (millis() - effect.mouthBaseAt < 700) {
    effect.mouthBase = Math.min(effect.mouthBase, ratio);
  }

  const threshold = Math.max(0.032, (effect.mouthBase || 0) + 0.038);

  if (ratio > threshold) {
    startFire(getMouthAnchor());
  } else if (millis() - effect.lastPrompt > 650) {
    effect.lastPrompt = millis();
    showPrompt("입을 크게 벌려!", 900, true);
  }
}

function startFire(mouth) {
  if (!effect || effect.type !== "fireball" || effect.phase === "fire") return;
  effect.phase = "fire";
  effect.fireT0 = millis();
  effect.mouth = mouth || (demoMode ? { x: W / 2, y: 176 } : { x: W / 2, y: H * 0.36 });
  effect.ring = 1;
  flash = 0.45;
  shake = 11;
  hidePrompt();
  noise(1.2, 0.16, "lowpass", 900);
  beep(90, 0.5, "sawtooth", 0.035);
}

function spawnFire(dt) {
  if (!effect || effect.phase !== "fire") return;
  const m = effect.mouth;
  const n = Math.ceil(140 * dt);
  for (let i = 0; i < n; i++) {
    const a = random(-0.6, 0.6);
    const sp = random(180, 560);
    particles.push({
      x: m.x + random(-10, 10),
      y: m.y + random(-3, 8),
      vx: Math.sin(a) * sp * 0.85,
      vy: Math.cos(a) * sp * 0.55 + 120,
      life: 0,
      max: random(0.45, 1.05),
      size: random(7, 16),
      drag: 0.5,
      gravity: 90,
      type: "fire",
    });
  }
  if (random() < 0.7) {
    particles.push({
      x: m.x + random(-18, 18),
      y: m.y,
      vx: random(-30, 30),
      vy: random(-90, -20),
      life: 0,
      max: random(0.5, 1.0),
      size: random(2, 5),
      drag: 0.3,
      gravity: 40,
      type: "ember",
    });
  }
  if (random() < 0.5) {
    particles.push({
      x: m.x + random(-30, 30),
      y: m.y + random(20, 70),
      vx: random(-20, 20),
      vy: random(-60, -20),
      life: 0,
      max: random(1.2, 2.2),
      size: random(14, 28),
      drag: 0.7,
      gravity: -10,
      type: "smoke",
    });
  }
}

function drawFireJet() {
  if (!effect || !effect.mouth) return;
  const t = (millis() - effect.fireT0) / 1000;
  if (t > 3.6) return;

  const m = effect.mouth;
  const env = Math.min(1, t / 0.12) * Math.min(1, Math.max(0, (3.6 - t) / 0.4));
  if (env <= 0.01) return;

  const ctx = drawingContext;
  const len = (300 + Math.sin(t * 26) * 42 + random(-9, 9)) * env;
  const spread = (76 + Math.sin(t * 19) * 14) * env;

  push();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // 바깥 화염
  ctx.beginPath();
  ctx.moveTo(m.x - 16, m.y);
  ctx.bezierCurveTo(m.x - spread, m.y + len * 0.32, m.x - spread * 0.6, m.y + len * 0.78, m.x, m.y + len);
  ctx.bezierCurveTo(m.x + spread * 0.6, m.y + len * 0.78, m.x + spread, m.y + len * 0.32, m.x + 16, m.y);
  ctx.closePath();
  let g = ctx.createLinearGradient(m.x, m.y, m.x, m.y + len);
  g.addColorStop(0, `rgba(255, 252, 232, ${0.9 * env})`);
  g.addColorStop(0.22, `rgba(255, 205, 90, ${0.62 * env})`);
  g.addColorStop(0.6, `rgba(255, 100, 30, ${0.28 * env})`);
  g.addColorStop(1, "rgba(160, 20, 0, 0)");
  ctx.fillStyle = g;
  ctx.fill();

  // 안쪽 화염
  const len2 = len * 0.64;
  const spread2 = spread * 0.4;
  ctx.beginPath();
  ctx.moveTo(m.x - 10, m.y);
  ctx.bezierCurveTo(m.x - spread2, m.y + len2 * 0.3, m.x - spread2 * 0.6, m.y + len2 * 0.78, m.x, m.y + len2);
  ctx.bezierCurveTo(m.x + spread2 * 0.6, m.y + len2 * 0.78, m.x + spread2, m.y + len2 * 0.3, m.x + 10, m.y);
  ctx.closePath();
  g = ctx.createLinearGradient(m.x, m.y, m.x, m.y + len2);
  g.addColorStop(0, `rgba(255, 255, 245, ${0.95 * env})`);
  g.addColorStop(0.45, `rgba(255, 225, 130, ${0.6 * env})`);
  g.addColorStop(1, "rgba(255, 140, 40, 0)");
  ctx.fillStyle = g;
  ctx.fill();

  // 입 주변 발광
  const rr = (44 + 28 * Math.sin(t * 38)) * env;
  const rg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, rr * 2.2);
  rg.addColorStop(0, `rgba(255, 250, 225, ${0.8 * env})`);
  rg.addColorStop(0.4, `rgba(255, 165, 65, ${0.36 * env})`);
  rg.addColorStop(1, "rgba(255, 60, 0, 0)");
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(m.x, m.y, rr * 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  pop();
}

/* ---------- 분신술 ---------- */

function makeDemoLayer() {
  demoLayer = createGraphics(VW, VH);
  demoLayer.pixelDensity(1);
  demoLayer.clear();
  drawDemoFigure(demoLayer);
}

function makeSnapshot() {
  const g = createGraphics(VW, VH);
  g.clear();
  g.pixelDensity(1);

  if (video && video.elt && video.elt.videoWidth > 0) {
    g.push();
    g.translate(VW, 0);
    g.scale(-1, 1);
    g.image(video, 0, 0, VW, VH);
    g.pop();
    maskSnapshotToPerson(g);
  } else if (demoLayer) {
    g.image(demoLayer, 0, 0);
  } else {
    drawDemoFigure(g);
  }
  return g;
}

/* 분신 스냅샷에서 배경을 지우기 위한 부드러운 타원 마스크.
   세그멘테이션 없이 화면 중앙 인물 영역만 남기고 가장자리를 페이드한다. */
function maskSnapshotToPerson(g) {
  const ctx = g.drawingContext;
  const cx = VW / 2;
  const cy = VH * 0.5;
  const rx = VW * 0.44;
  const ry = VH * 0.62;
  const sx = rx / ry;

  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.translate(cx, cy);
  ctx.scale(sx, 1);

  const grad = ctx.createRadialGradient(0, 0, ry * 0.4, 0, 0, ry);
  grad.addColorStop(0, "rgba(0, 0, 0, 1)");
  grad.addColorStop(0.55, "rgba(0, 0, 0, 0.96)");
  grad.addColorStop(0.82, "rgba(0, 0, 0, 0.55)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, ry, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDemoFigure(g) {
  g.push();
  g.translate(VW / 2, 0);
  g.noStroke();
  g.fill(18, 28, 44, 255);
  g.drawingContext.shadowColor = "rgba(127, 227, 255, 0.4)";
  g.drawingContext.shadowBlur = 22;

  // 머리
  g.ellipse(0, 130, 62, 74);
  // 목
  g.rect(-11, 162, 22, 18, 6);
  // 몸통
  g.beginShape();
  g.vertex(-52, 178);
  g.vertex(52, 178);
  g.vertex(42, 296);
  g.vertex(-42, 296);
  g.endShape(CLOSE);

  // 팔
  g.push();
  g.translate(-48, 188);
  g.rotate(-0.18);
  g.rect(-10, 0, 20, 118, 10);
  g.pop();

  g.push();
  g.translate(48, 188);
  g.rotate(0.18);
  g.rect(-10, 0, 20, 118, 10);
  g.pop();

  // 다리
  g.push();
  g.translate(-22, 292);
  g.rotate(0.02);
  g.rect(-12, 0, 24, 118, 12);
  g.pop();

  g.push();
  g.translate(22, 292);
  g.rotate(-0.02);
  g.rect(-12, 0, 24, 118, 12);
  g.pop();

  // 테두리
  g.noFill();
  g.stroke(140, 220, 255, 105);
  g.strokeWeight(1.8);
  g.ellipse(0, 130, 64, 76);
  g.pop();
}

function drawCloneEffect() {
  if (!effect || !effect.snap) return;
  const t = (millis() - effect.t0) / 1000;
  const env = Math.min(1, t / 0.12) * Math.min(1, Math.max(0, (3.6 - t) / 0.8));
  if (env <= 0.01) return;

  const sc = 0.86;
  const iw = W * sc;
  const ih = VH * COVER * sc;
  const offsets = [
    { dx: -300, a: 0.52, ph: 0 },
    { dx: 300, a: 0.52, ph: 2.1 },
  ];

  push();
  imageMode(CENTER);
  for (const o of offsets) {
    const wobble = Math.sin(t * 2.4 + o.ph) * 8;
    const drift = (1 - Math.min(1, t / 0.35)) * 70;
    tint(140, 190, 255, 255 * o.a * env);
    image(effect.snap, W / 2 + o.dx + wobble + (o.dx > 0 ? drift : -drift), H / 2, iw, ih);
  }
  pop();
  noTint();
}

/* ---------- 충격파 ---------- */

function drawShockwave() {
  if (!effect || !effect.ring) return;
  const t = (millis() - effect.t0) / 1000;
  const life = effect.type === "clone" ? 0.7 : 0.6;
  if (t > life) {
    effect.ring = 0;
    return;
  }
  const k = t / life;
  const r = 60 + k * 420;
  const a = (1 - k) * 90;
  noFill();
  stroke(255, 255, 255, a);
  strokeWeight(2.5 * (1 - k) + 0.5);
  circle(W / 2, H * 0.55, r * 2);
  stroke(232, 176, 75, a * 0.5);
  strokeWeight(1);
  circle(W / 2, H * 0.55, r * 2.12);
  noStroke();
}

/* ---------- 파티클 ---------- */

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    if (p.life >= p.max) {
      particles.splice(i, 1);
      continue;
    }
    const drag = Math.pow(p.drag ?? 0.4, dt);
    p.vx *= drag;
    p.vy *= drag;
    p.vy += (p.gravity ?? 0) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  if (particles.length > 900) particles.splice(0, particles.length - 900);
}

function drawParticles() {
  push();

  blendMode(ADD);
  noStroke();
  for (const p of particles) {
    if (p.type === "smoke") continue;
    const f = p.life / p.max;

    let col;
    if (p.type === "spark") {
      col = [190, 238, 255, 230 * (1 - f)];
    } else if (p.type === "ember") {
      col = [255, 185, 95, 240 * (1 - f)];
    } else {
      if (f < 0.3) col = [255, 246, 205, 240 * (1 - f * 0.7)];
      else if (f < 0.65) col = [255, 150, 60, 215 * (1 - f)];
      else col = [220, 60, 30, 160 * (1 - f)];
    }

    fill(col[0], col[1], col[2], col[3]);
    const size =
      p.type === "fire"
        ? p.size * (0.55 + f * 1.5)
        : p.size * (1 - f * 0.65);
    circle(p.x, p.y, size);
  }
  blendMode(BLEND);

  for (const p of particles) {
    if (p.type !== "smoke") continue;
    const f = p.life / p.max;
    fill(70, 72, 82, 85 * (1 - f));
    circle(p.x, p.y, p.size * (1 + f * 2.2));
  }

  pop();
}

function spawnSmoke(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = random(TWO_PI);
    const sp = random(20, 150);
    particles.push({
      x: x + random(-70, 70),
      y: y + random(-40, 40),
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - random(20, 80),
      life: 0,
      max: random(0.9, 1.8),
      size: random(20, 46),
      drag: 0.5,
      gravity: -20,
      type: "smoke",
    });
  }
}

/* ============================================================
   HUD
   ============================================================ */

function buildJutsuPanel() {
  UI.jutsuList.innerHTML = JUTSU.map(
    (j) => `
    <div class="jutsu" data-jutsu="${j.id}" style="--accent:${j.accent}">
      <div class="jutsu-head">
        <span class="jutsu-name">${j.name}</span>
        <span class="jutsu-prog">0/${j.seals.length}</span>
      </div>
      <div class="jutsu-recipe">${j.seals
        .map((n) => `${SEAL_BY_NAME[n].emoji} ${n}`)
        .join('<span class="arrow">→</span>')}</div>
    </div>`
  ).join("");
}

function buildHelp() {
  UI.helpJutsu.innerHTML = JUTSU.map(
    (j) => `
    <div class="row">
      <b style="color:${j.accent}">${j.name}</b>
      <span class="seq">${j.seals.map((n) => `${SEAL_BY_NAME[n].emoji} ${n}`).join(" → ")}</span>
    </div>`
  ).join("");
}

function buildSealGrid() {
  UI.sealGrid.innerHTML = SEALS.map((s) => {
    const n = (model.seals[s.name] || []).length;
    return `<button class="seal-card ${n ? "done" : ""}" data-name="${s.name}">
      <span class="seal-emoji">${s.emoji}</span>
      <span class="seal-name">${s.name}</span>
      <span class="seal-meta">${n ? `${n}샘플` : "미학습"}</span>
    </button>`;
  }).join("");

  UI.sealGrid.querySelectorAll(".seal-card").forEach((el) => {
    el.onclick = () => startTraining(el.dataset.name);
  });

  UI.trainCount.textContent = `${trainedCount()} / 12 학습됨`;
}

function updateHUD() {
  const now = millis();
  if (now - lastHud < 110) return;
  lastHud = now;

  if (training) {
    UI.sealNow.innerHTML = `학습 중 · <b>${training.name}</b>`;
  } else if (demoMode) {
    UI.sealNow.innerHTML = `데모 모드 · 키 <b>1~0, Q, W</b>`;
  } else if (cand.name) {
    UI.sealNow.innerHTML = `인식 · <b>${cand.name}</b> <span style="opacity:.35;font-size:11px">d=${cand.dist.toFixed(2)}</span>`;
  } else if (!trainedCount()) {
    UI.sealNow.innerHTML = `<span style="font-size:12px;opacity:.5">우측 상단 <b>12인 학습</b>을 먼저 진행하세요</span>`;
  } else if (hands.length) {
    UI.sealNow.innerHTML = `<span style="font-size:12px;opacity:.45">인을 맺고 유지해 보세요</span>`;
  } else {
    UI.sealNow.innerHTML = `<span style="font-size:12px;opacity:.4">손을 카메라에 보여 주세요</span>`;
  }

  const lines = [];
  if (now < statusUntil) {
    lines.push(`<span class="${statusWarn ? "warn" : "ok"}">${statusText}</span>`);
  } else {
    lines.push(`<span class="${handPose ? "ok" : "warn"}">${handPose ? "handPose ready" : "model loading"}</span>`);
  }
  lines.push(`학습 ${trainedCount()}/12`);
  lines.push(`fps ${Math.round(frameRate())}`);
  UI.statusLine.innerHTML = lines.join("<br/>");

  if (now - lastJutsuUpd > 130) {
    lastJutsuUpd = now;
    for (const j of JUTSU) {
      const el = UI.jutsuList.querySelector(`[data-jutsu="${j.id}"]`);
      if (!el) continue;
      const p = jutsuProgress(j);
      el.classList.toggle("active", p > 0);
      el.querySelector(".jutsu-prog").textContent = `${p}/${j.seals.length}`;
    }
  }
}

function setStatus(text, warn = false, ms = 4500) {
  statusText = text;
  statusWarn = warn;
  statusUntil = millis() + ms;
}

function showToast(text) {
  UI.toast.textContent = text;
  UI.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => UI.toast.classList.remove("show"), 2600);
}

function showBanner(name, sub, accent) {
  UI.bannerName.textContent = name;
  UI.bannerSub.textContent = sub;
  UI.banner.style.setProperty("--accent", accent);
  UI.banner.classList.remove("show");
  void UI.banner.offsetWidth;
  UI.banner.classList.add("show");
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => UI.banner.classList.remove("show"), 1900);
}

function showPrompt(text, ms = 900, small = false) {
  UI.prompt.textContent = text;
  UI.prompt.classList.toggle("small", !!small);
  UI.prompt.classList.add("show");
  promptUntil = millis() + ms;
  clearTimeout(promptTimer);
  promptTimer = setTimeout(() => UI.prompt.classList.remove("show"), ms);
}

function hidePrompt() {
  UI.prompt.classList.remove("show");
  clearTimeout(promptTimer);
}

/* ============================================================
   오디오
   ============================================================ */

function initAudio() {
  if (audioCtx) {
    if (audioCtx.state === "suspended") audioCtx.resume();
    return;
  }
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (_) {
    audioCtx = null;
  }
}

function beep(freq, dur, type = "sine", vol = 0.03) {
  if (!soundOn || !audioCtx) return;
  try {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch (_) {}
}

function noise(dur, vol, filter = "bandpass", freq = 1200) {
  if (!soundOn || !audioCtx) return;
  try {
    const len = Math.floor(audioCtx.sampleRate * dur);
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const f = audioCtx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = audioCtx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(audioCtx.destination);
    src.start();
  } catch (_) {}
}

/* ============================================================
   UI 연결
   ============================================================ */

function wireUI() {
  document.getElementById("btnStart").onclick = () => startExperience(false);
  document.getElementById("btnDemo").onclick = () => startExperience(true);

  document.getElementById("btnTrain").onclick = () => {
    openDrawer();
    if (state !== "play") showToast("먼저 시작해 주세요");
  };

  document.getElementById("drawerClose").onclick = closeDrawer;
  document.getElementById("btnHelp").onclick = () => UI.helpModal.classList.add("open");
  document.getElementById("helpClose").onclick = () => UI.helpModal.classList.remove("open");

  document.getElementById("btnReset").onclick = () => {
    if (!confirm("학습한 12인 데이터를 모두 지울까요?")) return;
    model = { version: 1, seals: {} };
    sampleCache = null;
    saveModel();
    buildSealGrid();
    showToast("학습 데이터를 초기화했습니다");
  };

  UI.soundBtn.onclick = () => {
    soundOn = !soundOn;
    UI.soundBtn.textContent = soundOn ? "🔊" : "🔇";
    if (soundOn) initAudio();
  };

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const seal = SEAL_BY_CODE[e.code];
    if (seal && state === "play") {
      emitSeal(seal);
      e.preventDefault();
      return;
    }
    if (e.code === "KeyH") {
      skeletonOn = !skeletonOn;
      showToast(skeletonOn ? "관절 표시 켜짐" : "관절 표시 꺼짐");
    }
    if (e.code === "Escape") {
      closeDrawer();
      UI.helpModal.classList.remove("open");
      training = null;
      markTrainingCard(null);
      hidePrompt();
    }
  });
}

function openDrawer() {
  UI.trainDrawer.classList.add("open");
  UI.trainDrawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  UI.trainDrawer.classList.remove("open");
  UI.trainDrawer.setAttribute("aria-hidden", "true");
}

/* ============================================================
   저장
   ============================================================ */

function loadModel() {
  try {
    const raw = localStorage.getItem(MODEL_KEY);
    if (!raw) return { version: 1, seals: {} };
    const m = JSON.parse(raw);
    if (!m || !m.seals) return { version: 1, seals: {} };
    return m;
  } catch (_) {
    return { version: 1, seals: {} };
  }
}

function saveModel() {
  try {
    localStorage.setItem(MODEL_KEY, JSON.stringify(model));
  } catch (e) {
    console.warn("model save failed", e);
  }
}

/* 디버그/데모용 */
window.emitSeal = emitSeal;
window.debugJutsu = (id) => {
  const j = JUTSU.find((x) => x.id === id);
  if (j) triggerJutsu(j);
};

/* 시연/테스트용 자동 실행: ?demo=chidori | fireball | clone */
function maybeAutoDemo() {
  const q = new URLSearchParams(location.search);
  const id = q.get("demo");
  if (!id) return;
  setTimeout(() => {
    startExperience(true);
    if (JUTSU.some((j) => j.id === id)) {
      setTimeout(() => window.debugJutsu(id), 900);
    }
  }, 500);
}
