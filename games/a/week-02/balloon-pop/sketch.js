/**
 * 하늘빛 풍선 팡팡 — p5.js × ml5.js HandPose
 * ------------------------------------------------------------
 * · 카메라에 손이 실제로 인식된 뒤에만 "게임 시작" 버튼이 활성화됩니다.
 * · 손끝 5곳으로 하늘에서 떨어지는 풍선을 터뜨리는 게임입니다.
 * · 배경은 애니메이션 하늘, 카메라 영상은 왼쪽 아래 미리보기로 표시됩니다.
 */

const VIDEO_W = 960;
const VIDEO_H = 720;
const MAX_LIVES = 3;
const FINGERTIP_RADIUS = 23;
const HAND_CONFIDENCE_MIN = 0.28;
const BEST_KEY = "balloon-best";

const BALLOON_COLORS = [
  { base: "#ff5d73", dark: "#b4123f" }, // 빨강
  { base: "#ff8a3d", dark: "#c2410c" }, // 주황
  { base: "#ffd23f", dark: "#b77900" }, // 노랑
  { base: "#7ae582", dark: "#177245" }, // 연두
  { base: "#2ee6c8", dark: "#0f766e" }, // 민트
  { base: "#4dabf7", dark: "#1864ab" }, // 파랑
  { base: "#8b9dff", dark: "#3b4bb3" }, // 남색
  { base: "#c084fc", dark: "#6d28d9" }, // 보라
  { base: "#ff86c8", dark: "#a61e6c" }, // 분홍
  { base: "#f5f3ff", dark: "#8b87a3" }, // 크림
];

const FINGERTIP_NAMES = [
  "thumb_tip",
  "index_finger_tip",
  "middle_finger_tip",
  "ring_finger_tip",
  "pinky_finger_tip",
];

// ml5.js가 연결 정보를 주지 못해도 손 뼈대를 그릴 수 있게 하는 백업 연결선
const DEFAULT_HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

// ---------- 카메라 · 손 인식 상태 ----------
let video = null;
let cameraState = "starting"; // starting | ready | error
let modelState = "loading"; // loading | ready | error
let handPose = null;
let hands = [];
let connections = DEFAULT_HAND_CONNECTIONS;
let detectionStarted = false;

let firstHandSeenAt = 0;
let lastHandSeenAt = -Infinity;

// ---------- 게임 상태 ----------
let gameState = "lobby"; // lobby | playing | over
let balloons = [];
let particles = [];
let rings = [];
let popups = [];

let score = 0;
let best = 0;
let lastRunNewBest = false;
let lives = MAX_LIVES;
let combo = 0;
let lastPopAt = -99999;
let gameStartAt = 0;
let spawnAcc = 0;
let shake = 0;
let flash = 0;

// ---------- 배경 ----------
let clouds = [];
let cloudSprites = [];
let sparkles = [];
let lobbyBalloons = [];

// ---------- UI · 사운드 ----------
let ui = null;
let uiSyncAt = 0;
let lastUiState = "";
let audioCtx = null;

// ---------------------------------------------------------------------------
// p5 기본 설정
// ---------------------------------------------------------------------------
function setup() {
  const cnv = createCanvas(VIDEO_W, VIDEO_H);
  cnv.parent("canvas-holder");
  cnv.elt.setAttribute("aria-label", "하늘빛 풍선 팡팡 게임 화면");

  pixelDensity(1);
  frameRate(60);
  textFont("system-ui, -apple-system, Apple SD Gothic Neo, Noto Sans KR, sans-serif");
  strokeJoin(ROUND);
  strokeCap(ROUND);

  try {
    best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch (error) {
    best = 0;
  }

  ui = {
    startScreen: document.getElementById("start-screen"),
    endScreen: document.getElementById("end-screen"),
    startButton: document.getElementById("start-button"),
    startButtonHint: document.getElementById("start-button-hint"),
    restartButton: document.getElementById("restart-button"),
    restartButtonHint: document.getElementById("restart-button-hint"),
    reloadButton: document.getElementById("reload-button"),
    startStatus: document.getElementById("start-status"),
    startStatusIcon: document.getElementById("start-status-icon"),
    startStatusTitle: document.getElementById("start-status-title"),
    startStatusDetail: document.getElementById("start-status-detail"),
    endStatus: document.getElementById("end-status"),
    endStatusIcon: document.getElementById("end-status-icon"),
    endStatusTitle: document.getElementById("end-status-title"),
    endStatusDetail: document.getElementById("end-status-detail"),
    finalScore: document.getElementById("final-score"),
    recordMessage: document.getElementById("record-message"),
    newBest: document.getElementById("new-best"),
  };

  bindUI();
  buildSky();
  buildLobbyBalloons();
  setupCamera();
  setupHandPose();
}

function bindUI() {
  ui.startButton.addEventListener("click", () => {
    ensureAudio();
    if (!isHandReady()) {
      syncUI(true);
      return;
    }
    beginGame();
  });

  ui.restartButton.addEventListener("click", () => {
    ensureAudio();
    if (!isHandReady()) {
      syncUI(true);
      return;
    }
    beginGame();
  });

  ui.reloadButton.addEventListener("click", () => window.location.reload());
}

// ---------------------------------------------------------------------------
// 카메라와 손 인식 모델
// ---------------------------------------------------------------------------
async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraState = "error";
    console.warn("이 브라우저에서는 카메라를 사용할 수 없습니다.");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: VIDEO_W },
        height: { ideal: VIDEO_H },
      },
      audio: false,
    });

    const element = document.createElement("video");
    element.autoplay = true;
    element.muted = true;
    element.playsInline = true;
    element.setAttribute("playsinline", "");
    element.srcObject = stream;

    await waitForVideoDimensions(element);
    await element.play();

    video = element;
    cameraState = "ready";
    tryStartDetection();
  } catch (error) {
    console.warn("카메라를 시작하지 못했습니다.", error);
    cameraState = "error";
  }
}

function waitForVideoDimensions(element) {
  if (element.readyState >= 1 && element.videoWidth > 0) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      element.removeEventListener("loadedmetadata", finish);
      resolve();
    };

    element.addEventListener("loadedmetadata", finish, { once: true });
    window.setTimeout(finish, 5000);
  });
}

function setupHandPose() {
  if (typeof ml5 === "undefined") {
    modelState = "error";
    console.warn("ml5.js를 불러오지 못했습니다.");
    return;
  }

  try {
    // flipHorizontal: 거울처럼 보이는 웹캠 화면과 손 좌표를 일치시킵니다.
    handPose = ml5.handPose({
      maxHands: 1,
      flipHorizontal: true,
      modelType: "full",
    });

    handPose.ready
      .then(() => {
        modelState = "ready";
        connections =
          typeof handPose.getConnections === "function"
            ? handPose.getConnections()
            : DEFAULT_HAND_CONNECTIONS;
        if (!connections || !connections.length) {
          connections = DEFAULT_HAND_CONNECTIONS;
        }
        tryStartDetection();
      })
      .catch((error) => {
        modelState = "error";
        console.error("손 인식 모델을 불러오지 못했습니다.", error);
      });
  } catch (error) {
    modelState = "error";
    console.error("손 인식 모델을 시작하지 못했습니다.", error);
  }
}

function tryStartDetection() {
  if (detectionStarted || cameraState !== "ready" || modelState !== "ready") return;
  if (!video || !handPose || video.readyState < 2) return;

  try {
    window.Ml5Runtime.start(handPose, video, gotHands);
    detectionStarted = true;
  } catch (error) {
    detectionStarted = false;
    modelState = "error";
    console.error("손 인식 감지를 시작하지 못했습니다.", error);
  }
}

function gotHands(results) {
  const detected = Array.isArray(results)
    ? results.filter((hand) => {
        const confidence =
          typeof hand.confidence === "number"
            ? hand.confidence
            : typeof hand.score === "number"
              ? hand.score
              : 1;
        return confidence >= HAND_CONFIDENCE_MIN;
      })
    : [];

  hands = detected;

  if (detected.length > 0) {
    const now = millis();
    if (now - lastHandSeenAt > 1200) {
      firstHandSeenAt = now;
    }
    lastHandSeenAt = now;
  }
}

function isHandReady() {
  if (cameraState !== "ready" || modelState !== "ready" || !detectionStarted) {
    return false;
  }

  const now = millis();
  const recentlySeen = lastHandSeenAt > 0 && now - lastHandSeenAt < 500;
  // 인식 결과가 한두 프레임 비는 경우만 짧게 허용합니다.
  const currentlyVisible = hands.length > 0 || now - lastHandSeenAt < 250;

  return (
    recentlySeen &&
    currentlyVisible &&
    firstHandSeenAt > 0 &&
    now - firstHandSeenAt >= 280
  );
}

// ---------------------------------------------------------------------------
// 메인 루프
// ---------------------------------------------------------------------------
function draw() {
  const dt = Math.min(deltaTime || 16.667, 48) / 16.667;

  // 카메라가 모델보다 늦게 준비되거나 영상 메타데이터가 늦게 도착한 경우를 대비합니다.
  if (!detectionStarted) tryStartDetection();

  if (gameState === "playing") updateGame(dt);
  updateEffects(dt);
  updateSky(dt);
  updateUI();

  drawSky();

  if (gameState === "lobby") drawLobbyBalloons();
  drawWorld();
  drawHandOverlay();
  drawCameraPreview();

  if (gameState === "playing") {
    drawHUD();
    drawPlayHint();
  }

  shake *= 0.88;
  flash = Math.max(0, flash - 0.035 * dt);
}

// ---------------------------------------------------------------------------
// 게임 로직
// ---------------------------------------------------------------------------
function beginGame() {
  if (!isHandReady()) {
    syncUI(true);
    return;
  }

  balloons = [];
  particles = [];
  rings = [];
  popups = [];

  score = 0;
  lives = MAX_LIVES;
  combo = 0;
  lastPopAt = -99999;
  spawnAcc = 0;
  shake = 0;
  flash = 0;
  lastRunNewBest = false;

  gameState = "playing";
  gameStartAt = millis();

  ui.startScreen.hidden = true;
  ui.endScreen.hidden = true;

  playStart();
  syncUI(true);
}

function updateGame(dt) {
  const elapsedSec = (millis() - gameStartAt) / 1000;
  const spawnInterval = Math.max(430, 940 - elapsedSec * 8.2);

  spawnAcc += deltaTime;
  if (spawnAcc >= spawnInterval) {
    spawnAcc = 0;
    if (balloons.length < 14) spawnBalloon(elapsedSec);
  }

  if (combo > 0 && millis() - lastPopAt > 1800) combo = 0;

  const tips = getMappedHands().flatMap((hand) => hand.tips);

  for (let i = balloons.length - 1; i >= 0; i--) {
    const balloon = balloons[i];

    balloon.y += balloon.vy * dt;
    balloon.x +=
      (balloon.drift + Math.sin(frameCount * 0.02 + balloon.phase) * balloon.sway * 0.35) *
      dt;

    let popped = false;
    for (const tip of tips) {
      const hitDistance = balloon.r * 0.94 + FINGERTIP_RADIUS;
      if (dist(balloon.x, balloon.y, tip.x, tip.y) < hitDistance) {
        popBalloon(balloon);
        balloons.splice(i, 1);
        popped = true;
        break;
      }
    }

    if (popped) continue;

    if (balloon.y - balloon.r * 1.7 > height) {
      balloons.splice(i, 1);
      loseLife();
    }
  }
}

function spawnBalloon(elapsedSec) {
  const radius = random(33, 57);
  const palette = BALLOON_COLORS[Math.floor(random(BALLOON_COLORS.length))];
  const speedBoost = 1 + Math.min(1.6, elapsedSec / 45);

  balloons.push({
    x: random(radius + 22, width - radius - 22),
    y: -radius * 1.8,
    r: radius,
    vy: random(1.65, 2.65) * speedBoost,
    drift: random(-0.34, 0.34),
    sway: random(0.5, 1.45),
    phase: random(TWO_PI),
    wobble: random(TWO_PI),
    base: color(palette.base),
    dark: color(palette.dark),
  });
}

function popBalloon(balloon) {
  const now = millis();
  combo = now - lastPopAt < 1350 ? combo + 1 : 1;
  lastPopAt = now;

  const gain = 10 + Math.min(combo - 1, 4) * 5;
  score += gain;

  spawnBurst(balloon.x, balloon.y, balloon.base, balloon.r);
  rings.push({
    x: balloon.x,
    y: balloon.y,
    r: balloon.r * 0.5,
    life: 1,
    color: balloon.base,
  });
  popups.push({
    x: balloon.x,
    y: balloon.y - 8,
    text: "+" + gain,
    life: 1,
    color: balloon.base,
  });

  playPop(combo);
  if (navigator.vibrate) navigator.vibrate(18);
}

function loseLife() {
  lives -= 1;
  combo = 0;
  shake = 12;
  flash = 1;
  playMiss();

  if (lives <= 0) {
    lives = 0;
    endGame();
  }
}

function endGame() {
  gameState = "over";

  const previousBest = best;
  lastRunNewBest = score > previousBest && score > 0;

  if (score > best) {
    best = score;
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch (error) {
      /* 저장할 수 없는 브라우저에서는 이번 판 기록만 보여 줍니다. */
    }
  }

  ui.finalScore.textContent = String(score);
  ui.recordMessage.textContent = "최고 기록 " + best + "점";
  ui.newBest.hidden = !lastRunNewBest;
  ui.endScreen.hidden = false;

  playGameOver();
  syncUI(true);
}

// ---------------------------------------------------------------------------
// 하늘 배경
// ---------------------------------------------------------------------------
function buildSky() {
  cloudSprites = [];
  for (let variant = 0; variant < 3; variant++) {
    const sprite = createGraphics(420, 240);
    sprite.pixelDensity(1);
    sprite.noStroke();
    sprite.fill(255);

    // 구름 한 덩어리를 투명한 그래픽 버퍼에 먼저 그려서
    // 반투명으로 표시할 때 퍼프끼리 겹쳐 지저분해지지 않게 합니다.
    for (let i = 0; i < 8; i++) {
      const cx = 210 + random(-112, 112);
      const cy = 145 + random(-38, 30);
      sprite.ellipse(cx, cy, random(82, 152), random(56, 102));
    }
    sprite.rect(68, 134, 284, 58, 29);
    cloudSprites.push(sprite);
  }

  clouds = [];
  for (let i = 0; i < 11; i++) {
    clouds.push({
      x: random(-width * 0.1, width * 1.1),
      y: random(55, height * 0.69),
      scale: random(35, 88),
      speed: random(0.05, 0.15),
      alpha: random(62, 124),
      sprite: Math.floor(random(cloudSprites.length)),
    });
  }

  sparkles = [];
  for (let i = 0; i < 26; i++) {
    sparkles.push({
      x: random(width),
      y: random(height * 0.72),
      size: random(1.2, 3.4),
      phase: random(TWO_PI),
      speed: random(0.08, 0.25),
      alpha: random(40, 110),
    });
  }
}

function buildLobbyBalloons() {
  lobbyBalloons = [];
  const spots = [
    { x: 90, y: 220, r: 50 },
    { x: 165, y: 420, r: 35 },
    { x: 865, y: 205, r: 44 },
    { x: 800, y: 455, r: 31 },
    { x: 54, y: 585, r: 27 },
  ];

  for (let i = 0; i < spots.length; i++) {
    const palette = BALLOON_COLORS[(i * 3 + 1) % BALLOON_COLORS.length];
    lobbyBalloons.push({
      ...spots[i],
      baseY: spots[i].y,
      phase: random(TWO_PI),
      speed: random(0.0007, 0.0014),
      wobble: random(TWO_PI),
      phase2: random(TWO_PI),
      base: color(palette.base),
      dark: color(palette.dark),
    });
  }
}

function updateSky(dt) {
  for (const cloud of clouds) {
    cloud.x += cloud.speed * dt;
    if (cloud.x - cloud.scale * 1.8 > width) {
      cloud.x = -cloud.scale * 1.9;
      cloud.y = random(55, height * 0.7);
    }
  }

  for (const sparkle of sparkles) {
    sparkle.y -= sparkle.speed * 0.16 * dt;
    if (sparkle.y < -5) {
      sparkle.y = height * 0.72;
      sparkle.x = random(width);
    }
  }

  for (const balloon of lobbyBalloons) {
    balloon.y = balloon.baseY + Math.sin(millis() * balloon.speed + balloon.phase) * 10;
  }
}

function drawSky() {
  const ctx = drawingContext;

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#1768c5");
  sky.addColorStop(0.38, "#62b7f4");
  sky.addColorStop(0.72, "#b9e6ff");
  sky.addColorStop(1, "#eafaff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // 햇빛
  const sunX = width * 0.8;
  const sunY = height * 0.16;
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 250);
  glow.addColorStop(0, "rgba(255, 253, 220, 0.95)");
  glow.addColorStop(0.22, "rgba(255, 244, 184, 0.52)");
  glow.addColorStop(0.58, "rgba(255, 240, 188, 0.16)");
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  noStroke();
  fill(255, 252, 220, 232);
  circle(sunX, sunY, 78);
  fill(255, 255, 255, 110);
  circle(sunX - 10, sunY - 10, 46);

  drawClouds();
  drawSparkles();
}

function drawClouds() {
  push();
  noStroke();
  for (const cloud of clouds) {
    const drift = Math.sin(frameCount * 0.003 + cloud.y) * 4;
    const sprite = cloudSprites[cloud.sprite];
    if (!sprite) continue;

    const drawWidth = cloud.scale * 2.35;
    const drawHeight = drawWidth * (240 / 420);

    // 스프라이트 전체에 한 번만 투명도를 적용해 구름이 겹쳐도 자연스럽습니다.
    tint(255, cloud.alpha);
    image(
      sprite,
      cloud.x + drift - drawWidth / 2,
      cloud.y - drawHeight * 0.61,
      drawWidth,
      drawHeight
    );
    noTint();
  }
  pop();
}

function drawSparkles() {
  noStroke();
  for (const sparkle of sparkles) {
    const twinkle = 0.55 + Math.sin(frameCount * 0.035 + sparkle.phase) * 0.45;
    fill(255, 255, 255, sparkle.alpha * twinkle);
    circle(sparkle.x, sparkle.y, sparkle.size);
  }
}

function drawLobbyBalloons() {
  for (const balloon of lobbyBalloons) {
    drawBalloon({
      ...balloon,
      y: balloon.y,
      sway: 0.8,
      phase: balloon.phase2,
    });
  }
}

// ---------------------------------------------------------------------------
// 풍선과 효과
// ---------------------------------------------------------------------------
function drawWorld() {
  push();
  if (shake > 0.2) {
    translate(random(-shake, shake), random(-shake, shake));
  }

  for (const balloon of balloons) drawBalloon(balloon);
  drawParticles();
  drawRings();
  drawPopups();

  pop();

  if (flash > 0.01) {
    noStroke();
    fill(255, 55, 86, 88 * flash);
    rect(0, 0, width, height);
  }
}

function drawBalloon(balloon) {
  const wobble = 1 + Math.sin(frameCount * 0.075 + balloon.wobble) * 0.022;
  const swayX = Math.sin(frameCount * 0.03 + balloon.phase) * balloon.r * 0.38;

  push();
  translate(balloon.x, balloon.y);

  // 은은한 색 번짐
  noStroke();
  fill(red(balloon.base), green(balloon.base), blue(balloon.base), 25);
  circle(0, 0, balloon.r * 2.5);

  scale(wobble, 2 - wobble);

  // 끈
  noFill();
  stroke(255, 255, 255, 135);
  strokeWeight(1.5);
  bezier(
    0,
    balloon.r * 1.18,
    balloon.r * 0.22,
    balloon.r * 1.55,
    -balloon.r * 0.22 + swayX,
    balloon.r * 1.9,
    swayX,
    balloon.r * 2.35
  );

  // 풍선 몸통
  const ctx = drawingContext;
  const gradient = ctx.createRadialGradient(
    -balloon.r * 0.38,
    -balloon.r * 0.44,
    balloon.r * 0.08,
    0,
    0,
    balloon.r * 1.16
  );
  gradient.addColorStop(0, cssColor(lerpColor(balloon.base, color(255), 0.66)));
  gradient.addColorStop(0.55, cssColor(balloon.base));
  gradient.addColorStop(1, cssColor(lerpColor(balloon.base, balloon.dark, 0.72)));

  noStroke();
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, balloon.r * 1.03, balloon.r * 1.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // 테두리
  noFill();
  stroke(cssColor(lerpColor(balloon.dark, color(0), 0.16), 76));
  strokeWeight(1.4);
  ellipse(0, 0, balloon.r * 2.06, balloon.r * 2.32);

  // 매듭
  noStroke();
  fill(balloon.dark);
  triangle(
    -balloon.r * 0.12,
    balloon.r * 1.12,
    balloon.r * 0.12,
    balloon.r * 1.12,
    0,
    balloon.r * 1.3
  );
  circle(0, balloon.r * 1.115, balloon.r * 0.16);

  // 하이라이트
  push();
  translate(-balloon.r * 0.34, -balloon.r * 0.44);
  rotate(-0.48);
  noStroke();
  fill(255, 255, 255, 122);
  ellipse(0, 0, balloon.r * 0.4, balloon.r * 0.66);
  fill(255, 255, 255, 212);
  ellipse(-balloon.r * 0.03, -balloon.r * 0.12, balloon.r * 0.15, balloon.r * 0.26);
  pop();

  pop();
}

function spawnBurst(x, y, baseColor, radius) {
  const count = 16;
  const scaleFactor = constrain(radius / 45, 0.8, 1.3);
  const newParticles = [];

  for (let i = 0; i < count; i++) {
    const angle = random(TWO_PI);
    const speed = random(2, 7.8);
    newParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      size: random(4, 11) * scaleFactor,
      rot: random(TWO_PI),
      vr: random(-0.27, 0.27),
      life: 1,
      decay: random(0.014, 0.027),
      color: lerpColor(baseColor, color(255), random(0, 0.38)),
      round: random() < 0.55,
    });
  }

  for (let i = 0; i < 3; i++) {
    newParticles.push({
      x,
      y,
      vx: random(-2.2, 2.2),
      vy: random(-5.5, -3),
      size: random(1.5, 3.4),
      rot: 0,
      vr: 0,
      life: 1,
      decay: 0.012,
      color: color(255, 255, 255),
      round: true,
    });
  }

  particles.push(...newParticles);
}

function updateEffects(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 0.22 * dt;
    particle.vx *= 0.992;
    particle.rot += particle.vr * dt;
    particle.life -= particle.decay * dt;
    if (particle.life <= 0) particles.splice(i, 1);
  }

  for (let i = rings.length - 1; i >= 0; i--) {
    const ring = rings[i];
    ring.r += 7 * dt;
    ring.life -= 0.05 * dt;
    if (ring.life <= 0) rings.splice(i, 1);
  }

  for (let i = popups.length - 1; i >= 0; i--) {
    const popup = popups[i];
    popup.y -= 1.1 * dt;
    popup.life -= 0.018 * dt;
    if (popup.life <= 0) popups.splice(i, 1);
  }
}

function drawParticles() {
  noStroke();
  for (const particle of particles) {
    const alphaValue = 255 * Math.max(0, particle.life);
    fill(
      red(particle.color),
      green(particle.color),
      blue(particle.color),
      alphaValue
    );
    push();
    translate(particle.x, particle.y);
    rotate(particle.rot);
    if (particle.round) {
      circle(0, 0, particle.size * (0.6 + particle.life * 0.6));
    } else {
      rect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.65, 2);
    }
    pop();
  }
}

function drawRings() {
  noFill();
  for (const ring of rings) {
    stroke(red(ring.color), green(ring.color), blue(ring.color), 200 * ring.life);
    strokeWeight(4 * ring.life + 1);
    circle(ring.x, ring.y, ring.r * 2);
  }
  noStroke();
}

function drawPopups() {
  push();
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(26);
  for (const popup of popups) {
    fill(red(popup.color), green(popup.color), blue(popup.color), 255 * popup.life);
    text(popup.text, popup.x, popup.y);
  }
  pop();
}

// ---------------------------------------------------------------------------
// 손 좌표와 오버레이
// ---------------------------------------------------------------------------
function sourceSize() {
  return {
    width: video && video.videoWidth ? video.videoWidth : VIDEO_W,
    height: video && video.videoHeight ? video.videoHeight : VIDEO_H,
  };
}

/**
 * 카메라 영상을 cover 방식으로 보여 줄 때의 좌표를 화면 좌표로 바꿉니다.
 * 손 좌표는 flipHorizontal 옵션 덕분에 이미 거울상 좌표입니다.
 */
function projectPoint(normalizedX, normalizedY, dx, dy, dw, dh) {
  const source = sourceSize();
  const scale = Math.max(dw / source.width, dh / source.height);
  const drawWidth = source.width * scale;
  const drawHeight = source.height * scale;

  return {
    x: dx + dw / 2 + (normalizedX - 0.5) * drawWidth,
    y: dy + dh / 2 + (normalizedY - 0.5) * drawHeight,
  };
}

function getMappedHands() {
  const source = sourceSize();
  const mapped = [];

  for (const hand of hands) {
    const keypoints = hand.keypoints || [];
    if (!keypoints.length) continue;

    const points = keypoints.map((keypoint) => {
      const point = projectPoint(
        keypoint.x / source.width,
        keypoint.y / source.height,
        0,
        0,
        width,
        height
      );
      return { ...point, name: keypoint.name };
    });

    const tips = FINGERTIP_NAMES.map((name) =>
      points.find((point) => point.name === name)
    ).filter(Boolean);

    mapped.push({ points, tips });
  }

  return mapped;
}

function drawHandOverlay() {
  const mappedHands = getMappedHands();
  if (!mappedHands.length) return;

  const ctx = drawingContext;

  for (const hand of mappedHands) {
    // 손 뼈대
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(255, 255, 255, 0.62)";
    noFill();
    stroke(255, 255, 255, 86);
    strokeWeight(2);

    for (const pair of connections) {
      const a = hand.points[pair[0]];
      const b = hand.points[pair[1]];
      if (a && b) line(a.x, a.y, b.x, b.y);
    }

    // 관절
    noStroke();
    fill(255, 255, 255, 135);
    for (const point of hand.points) {
      circle(point.x, point.y, 4.2);
    }
    ctx.restore();

    // 손끝 조준점
    const pulse = 1 + Math.sin(frameCount * 0.16) * 0.07;
    for (const tip of hand.tips) {
      drawFingertipTarget(tip.x, tip.y, pulse);
    }
  }
}

function drawFingertipTarget(x, y, pulse) {
  const ctx = drawingContext;

  ctx.save();
  ctx.shadowBlur = 22;
  ctx.shadowColor = "rgba(255, 235, 154, 0.95)";

  noFill();
  stroke(255, 255, 255, 115);
  strokeWeight(2.5);
  circle(x, y, FINGERTIP_RADIUS * 2.05 * pulse);

  stroke(255, 213, 92, 242);
  strokeWeight(2.2);
  circle(x, y, FINGERTIP_RADIUS * 1.35 * pulse);

  stroke(255, 255, 255, 205);
  strokeWeight(2);
  line(x - FINGERTIP_RADIUS * 0.7, y, x - FINGERTIP_RADIUS * 0.38, y);
  line(x + FINGERTIP_RADIUS * 0.38, y, x + FINGERTIP_RADIUS * 0.7, y);
  line(x, y - FINGERTIP_RADIUS * 0.7, x, y - FINGERTIP_RADIUS * 0.38);
  line(x, y + FINGERTIP_RADIUS * 0.38, x, y + FINGERTIP_RADIUS * 0.7);

  noStroke();
  fill(255, 255, 255, 242);
  circle(x, y, 7.5);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 카메라 미리보기
// ---------------------------------------------------------------------------
function drawCameraPreview() {
  const previewW = 224;
  const previewH = 168;
  const previewX = 24;
  const previewY = height - previewH - 24;
  const radius = 18;
  const ctx = drawingContext;

  // 그림자
  ctx.save();
  ctx.shadowBlur = 24;
  ctx.shadowColor = "rgba(4, 40, 73, 0.32)";
  noStroke();
  fill(8, 35, 60, 225);
  rect(previewX, previewY, previewW, previewH, radius);
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, previewX, previewY, previewW, previewH, radius);
  ctx.clip();

  if (cameraState === "ready" && video && video.readyState >= 2 && video.videoWidth > 0) {
    const source = sourceSize();
    const scale = Math.max(previewW / source.width, previewH / source.height);
    const drawW = source.width * scale;
    const drawH = source.height * scale;

    // 카메라 영상은 거울 모드로 그립니다.
    ctx.save();
    ctx.translate(previewX + previewW / 2, previewY + previewH / 2);
    ctx.scale(-1, 1);
    ctx.drawImage(video, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    noStroke();
    fill(10, 42, 70, 34);
    rect(previewX, previewY, previewW, previewH);

    drawPreviewSkeleton(previewX, previewY, previewW, previewH);
  } else {
    const placeholder = ctx.createLinearGradient(
      previewX,
      previewY,
      previewX,
      previewY + previewH
    );
    placeholder.addColorStop(0, "#154b75");
    placeholder.addColorStop(1, "#092b4b");
    ctx.fillStyle = placeholder;
    ctx.fillRect(previewX, previewY, previewW, previewH);

    push();
    textAlign(CENTER, CENTER);
    fill(255, 255, 255, 180);
    textStyle(BOLD);
    textSize(13);
    text(
      cameraState === "error" ? "카메라를 사용할 수 없어요" : "카메라 준비 중...",
      previewX + previewW / 2,
      previewY + previewH / 2
    );
    pop();
  }

  ctx.restore();

  // 테두리
  noFill();
  stroke(255, 255, 255, 220);
  strokeWeight(2);
  rect(previewX, previewY, previewW, previewH, radius);

  // 라벨
  noStroke();
  fill(8, 38, 65, 212);
  rect(previewX, previewY - 28, 112, 24, 12);

  const handVisible = millis() - lastHandSeenAt < 800;
  fill(handVisible ? "#4bf0b4" : "#ffd166");
  circle(previewX + 15, previewY - 16, 7);

  fill(255, 255, 255, 232);
  textAlign(LEFT, CENTER);
  textStyle(BOLD);
  textSize(10);
  text("HAND CAM", previewX + 26, previewY - 15);
}

function drawPreviewSkeleton(dx, dy, dw, dh) {
  const source = sourceSize();
  const ctx = drawingContext;

  ctx.save();
  ctx.shadowBlur = 7;
  ctx.shadowColor = "rgba(255, 229, 130, 0.9)";
  noFill();
  stroke(255, 233, 135, 195);
  strokeWeight(1.6);

  for (const hand of hands) {
    const points = (hand.keypoints || []).map((keypoint) =>
      projectPoint(keypoint.x / source.width, keypoint.y / source.height, dx, dy, dw, dh)
    );

    for (const pair of connections) {
      const a = points[pair[0]];
      const b = points[pair[1]];
      if (a && b) line(a.x, a.y, b.x, b.y);
    }

    noStroke();
    fill(255, 245, 178, 225);
    for (const point of points) {
      circle(point.x, point.y, 2.8);
    }

    for (let i = 0; i < FINGERTIP_NAMES.length; i++) {
      const tipIndex = [4, 8, 12, 16, 20][i];
      const tip = points[tipIndex];
      if (!tip) continue;
      fill(255, 255, 255, 245);
      circle(tip.x, tip.y, 5);
    }
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
function drawHUD() {
  // 점수
  push();
  noStroke();
  fill(8, 34, 58, 148);
  rect(24, 22, 188, 78, 20);

  fill(123, 220, 255, 225);
  textAlign(LEFT, TOP);
  textStyle(BOLD);
  textSize(10.5);
  text("SCORE", 44, 36);

  fill(255);
  textSize(35);
  text(score, 42, 52);

  fill(255, 255, 255, 112);
  textStyle(NORMAL);
  textSize(10);
  text("BEST " + best, 44, 84);
  pop();

  // 목숨
  for (let i = 0; i < MAX_LIVES; i++) {
    const x = width - 52 - i * 43;
    const alive = i < lives;

    push();
    translate(x, 58);
    if (alive) {
      drawingContext.shadowBlur = 15;
      drawingContext.shadowColor = "rgba(255, 75, 112, 0.95)";
      fill("#ff4d6d");
    } else {
      fill(255, 255, 255, 70);
    }
    noStroke();
    drawHeartShape(28);
    pop();
  }

  // 콤보
  if (combo >= 2) {
    push();
    textAlign(CENTER, TOP);
    const s = 1 + Math.min(combo, 5) * 0.02 + Math.sin(frameCount * 0.2) * 0.025;
    translate(width / 2, 24);
    scale(s);

    noStroke();
    fill(8, 34, 58, 142);
    rect(-92, 0, 184, 44, 22);

    fill("#ffd166");
    textStyle(BOLD);
    textSize(23);
    text(combo + " 콤보!", 0, 9);
    pop();
  }
}

function drawHeartShape(size) {
  beginShape();
  vertex(0, size * 0.36);
  bezierVertex(-size * 0.92, -size * 0.28, -size * 0.46, -size * 0.96, 0, -size * 0.44);
  bezierVertex(size * 0.46, -size * 0.96, size * 0.92, -size * 0.28, 0, size * 0.36);
  endShape(CLOSE);
}

function drawPlayHint() {
  if (millis() - gameStartAt < 900) return;

  const handVisible = millis() - lastHandSeenAt < 800;
  const message = handVisible
    ? "손끝으로 풍선을 터뜨리세요!"
    : "손을 카메라에 보여 주세요";

  push();
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(15);

  const boxWidth = textWidth(message) + 48;
  const x = width / 2;
  const y = height - 42;

  noStroke();
  fill(8, 36, 62, 142);
  rect(x - boxWidth / 2, y - 19, boxWidth, 38, 19);

  fill(255, 255, 255, handVisible ? 235 : 205);
  text(message, x, y + 1);
  pop();
}

// ---------------------------------------------------------------------------
// UI 상태 동기화
// ---------------------------------------------------------------------------
function getStatusInfo() {
  if (cameraState === "error") {
    return {
      key: "camera-error",
      state: "error",
      icon: "!",
      title: "카메라를 사용할 수 없어요",
      detail: "브라우저의 카메라 권한을 허용한 뒤 새로고침해 주세요.",
    };
  }

  if (modelState === "error") {
    return {
      key: "model-error",
      state: "error",
      icon: "!",
      title: "손 인식 모델을 불러오지 못했어요",
      detail: "인터넷 연결을 확인한 뒤 새로고침해 주세요.",
    };
  }

  if (cameraState === "starting") {
    return {
      key: "camera-loading",
      state: "loading",
      icon: "◌",
      title: "카메라를 준비하고 있어요",
      detail: "권한 요청이 보이면 카메라 허용을 눌러 주세요.",
    };
  }

  if (modelState === "loading" || !detectionStarted) {
    return {
      key: "model-loading",
      state: "loading",
      icon: "◌",
      title: "손 인식 모델을 불러오는 중",
      detail: "처음 실행할 때는 몇 초 정도 걸릴 수 있어요.",
    };
  }

  if (isHandReady()) {
    return {
      key: "hand-ready",
      state: "ready",
      icon: "✓",
      title: "손 인식 완료!",
      detail: gameState === "over"
        ? "손이 보이는 지금, 다시 도전 버튼을 눌러 주세요."
        : "손이 보이는 지금, 게임 시작 버튼을 눌러 주세요.",
    };
  }

  if (millis() - lastHandSeenAt < 800) {
    return {
      key: "hand-settling",
      state: "waiting",
      icon: "✋",
      title: "손을 조금 더 보여 주세요",
      detail: "손바닥을 펴서 카메라 중앙에 잠깐 유지해 주세요.",
    };
  }

  return {
    key: "hand-waiting",
    state: "waiting",
    icon: "✋",
    title: "카메라에 손을 보여 주세요",
    detail: "손바닥을 펴서 카메라 앞 30cm 정도에 두세요.",
  };
}

function updateUI() {
  if (millis() - uiSyncAt < 90) return;
  syncUI();
}

function syncUI(force = false) {
  if (!ui) return;

  const status = getStatusInfo();
  const ready = isHandReady();

  ui.startButton.disabled = !ready;
  ui.restartButton.disabled = !ready;

  if (!force && status.key === lastUiState) return;

  lastUiState = status.key;
  uiSyncAt = millis();

  applyStatus(ui.startStatus, ui.startStatusIcon, ui.startStatusTitle, ui.startStatusDetail, status);
  applyStatus(ui.endStatus, ui.endStatusIcon, ui.endStatusTitle, ui.endStatusDetail, status);

  ui.startButtonHint.textContent = ready
    ? "준비 완료 · 버튼을 누르면 시작!"
    : "손을 인식하면 버튼이 활성화됩니다";
  ui.restartButtonHint.textContent = ready
    ? "준비 완료 · 버튼을 누르면 시작!"
    : "손을 인식하면 버튼이 활성화됩니다";

  ui.reloadButton.hidden = !(status.state === "error");
}

function applyStatus(card, iconElement, titleElement, detailElement, status) {
  if (!card) return;
  card.dataset.state = status.state;
  iconElement.textContent = status.icon;
  titleElement.textContent = status.title;
  detailElement.textContent = status.detail;
}

// ---------------------------------------------------------------------------
// 사운드 (외부 파일 없이 WebAudio로 생성)
// ---------------------------------------------------------------------------
function ensureAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}

function tone(frequencyFrom, frequencyTo, duration, type, volume, delay = 0) {
  if (!audioCtx) return;

  const startAt = audioCtx.currentTime + delay;
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequencyFrom, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(30, frequencyTo),
    startAt + duration
  );

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

function playPop(level = 1) {
  const frequency = 620 + Math.min(level, 5) * 70;
  tone(frequency, frequency * 0.32, 0.14, "sine", 0.22);
  tone(frequency * 1.7, frequency * 0.8, 0.07, "triangle", 0.07);
}

function playMiss() {
  tone(190, 70, 0.32, "sawtooth", 0.1);
}

function playStart() {
  [392, 523, 659, 784].forEach((frequency, index) => {
    tone(frequency, frequency * 1.01, 0.18, "triangle", 0.1, index * 0.08);
  });
}

function playGameOver() {
  [523, 415, 330, 247].forEach((frequency, index) => {
    tone(frequency, frequency * 0.98, 0.22, "triangle", 0.12, index * 0.14);
  });
}

// ---------------------------------------------------------------------------
// 유틸
// ---------------------------------------------------------------------------
function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function cssColor(c, alphaValue = 255) {
  return `rgba(${red(c)}, ${green(c)}, ${blue(c)}, ${alphaValue / 255})`;
}
