// =====================================================
// ml5.js HandPose Motion Capture Mini Game MVP
// p5.js + ml5.js handPose
// =====================================================

let video;
let handPose;
let hands = [];

// -----------------------------------------------------
// Game constants
// -----------------------------------------------------
const CANVAS_W = 960;
const CANVAS_H = 540;

const GAME_TIME_SECONDS = 60;
const HAND_STATE_HISTORY_SIZE = 5;

const FLICK_SPEED_THRESHOLD = 1.15;
const ATTACK_COOLDOWN_MS = 800;
const FLICK_DAMAGE = 18;
const DAMAGE_APPLY_SPEED = 0.55;

const SCREEN = {
  TITLE: "TITLE",
  HAND_TEST: "HAND_TEST",
  MODE_SELECT: "MODE_SELECT",
  WEED: "WEED",
  BATTLE: "BATTLE",
  RESULT: "RESULT"
};

const HAND_STATE = {
  NO_HAND: "NO_HAND",
  OPEN_HAND: "OPEN_HAND",
  FIST: "FIST",
  UNKNOWN: "UNKNOWN"
};

// -----------------------------------------------------
// Game state
// -----------------------------------------------------
let gameState = {
  screen: SCREEN.TITLE,
  mode: null,
  score: 0,
  timeLeft: GAME_TIME_SECONDS,
  startedAt: 0,
  handState: HAND_STATE.NO_HAND,
  rawHandState: HAND_STATE.NO_HAND,
  weedGestureState: "WAIT_OPEN",
  lastAttackTime: 0,
  message: ""
};

let handStateHistory = [];
let previousFingerTip = null;

let weed;
let monster;
let particles = [];

// -----------------------------------------------------
// ml5 setup
// -----------------------------------------------------
function preload() {
  handPose = ml5.handPose({ flipped: true });
}

function setup() {
  createCanvas(CANVAS_W, CANVAS_H);
  textFont("sans-serif");

  video = createCapture(VIDEO, { flipped: true });
  video.size(CANVAS_W, CANVAS_H);
  video.hide();

  handPose.detectStart(video, gotHands);

  resetObjects();
}

function gotHands(results) {
  hands = results;
}

// -----------------------------------------------------
// Main draw loop
// -----------------------------------------------------
function draw() {
  drawBackground();

  const hand = hands.length > 0 ? hands[0] : null;
  updateHand(hand);

  if (gameState.screen === SCREEN.WEED || gameState.screen === SCREEN.BATTLE) {
    updateTimer();
  }

  if (gameState.screen === SCREEN.WEED) {
    updateWeedMode();
  }

  if (gameState.screen === SCREEN.BATTLE) {
    updateBattleMode(hand);
  }

  updateParticles();

  renderScreen(hand);
}

// =====================================================
// Input
// =====================================================

function mousePressed() {
  handlePointerPressed(mouseX, mouseY);
}

function touchStarted() {
  handlePointerPressed(mouseX, mouseY);
  return false;
}

function handlePointerPressed(x, y) {
  if (gameState.screen === SCREEN.TITLE) {
    gameState.screen = SCREEN.HAND_TEST;
    gameState.message = "손을 카메라 앞에 보여주세요.";
    return;
  }

  if (gameState.screen === SCREEN.HAND_TEST) {
    gameState.screen = SCREEN.MODE_SELECT;
    return;
  }

  if (gameState.screen === SCREEN.MODE_SELECT) {
    if (insideButton(x, y, 250, 250, 200, 70)) {
      startWeedMode();
    }

    if (insideButton(x, y, 510, 250, 200, 70)) {
      startBattleMode();
    }

    return;
  }

  if (gameState.screen === SCREEN.RESULT) {
    gameState.screen = SCREEN.MODE_SELECT;
    return;
  }
}

function keyPressed() {
  if (key === "1") startWeedMode();
  if (key === "2") startBattleMode();
  if (key === "r" || key === "R") gameState.screen = SCREEN.MODE_SELECT;
}

function insideButton(px, py, x, y, w, h) {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

// =====================================================
// Hand state
// =====================================================

function updateHand(hand) {
  if (!hand) {
    gameState.rawHandState = HAND_STATE.NO_HAND;
    gameState.handState = HAND_STATE.NO_HAND;
    handStateHistory = [];
    previousFingerTip = null;
    return;
  }

  const rawState = getHandState(hand);
  const stableState = getStableHandState(rawState);

  gameState.rawHandState = rawState;
  gameState.handState = stableState;
}

function getHandState(hand) {
  if (!hand) return HAND_STATE.NO_HAND;

  if (isFist(hand)) return HAND_STATE.FIST;
  if (isOpenHand(hand)) return HAND_STATE.OPEN_HAND;

  return HAND_STATE.UNKNOWN;
}

function isOpenHand(hand) {
  const k = hand.keypoints;
  if (!k || k.length < 21) return false;

  const fingers = [
    { tip: 8, pip: 6 },
    { tip: 12, pip: 10 },
    { tip: 16, pip: 14 },
    { tip: 20, pip: 18 }
  ];

  let extended = 0;

  for (const f of fingers) {
    if (k[f.tip].y < k[f.pip].y) {
      extended++;
    }
  }

  return extended >= 3;
}

function isFist(hand) {
  const k = hand.keypoints;
  if (!k || k.length < 21) return false;

  const fingers = [
    { tip: 8, pip: 6 },
    { tip: 12, pip: 10 },
    { tip: 16, pip: 14 },
    { tip: 20, pip: 18 }
  ];

  let folded = 0;

  for (const f of fingers) {
    if (k[f.tip].y > k[f.pip].y) {
      folded++;
    }
  }

  return folded >= 3;
}

function getStableHandState(rawState) {
  handStateHistory.push(rawState);

  if (handStateHistory.length > HAND_STATE_HISTORY_SIZE) {
    handStateHistory.shift();
  }

  const counts = {};
  for (const state of handStateHistory) {
    counts[state] = (counts[state] || 0) + 1;
  }

  let bestState = rawState;
  let bestCount = 0;

  for (const state in counts) {
    if (counts[state] > bestCount) {
      bestCount = counts[state];
      bestState = state;
    }
  }

  return bestState;
}

// =====================================================
// Game start/reset
// =====================================================

function resetObjects() {
  weed = {
    x: width / 2,
    y: 395,
    state: "idle",
    pullProgress: 0,
    successTimer: 0
  };

  monster = {
    x: width / 2,
    y: 300,
    maxHp: 100,
    hp: 100,
    pendingDamage: 0,
    state: "idle",
    hitFlashTimer: 0,
    shake: 0
  };

  particles = [];
}

function startWeedMode() {
  resetObjects();
  gameState.screen = SCREEN.WEED;
  gameState.mode = "WEED";
  gameState.score = 0;
  gameState.timeLeft = GAME_TIME_SECONDS;
  gameState.startedAt = millis();
  gameState.weedGestureState = "WAIT_OPEN";
  gameState.message = "손을 폈다가, 주먹을 쥐고, 다시 펴세요.";
}

function startBattleMode() {
  resetObjects();
  gameState.screen = SCREEN.BATTLE;
  gameState.mode = "BATTLE";
  gameState.score = 0;
  gameState.timeLeft = GAME_TIME_SECONDS;
  gameState.startedAt = millis();
  gameState.lastAttackTime = 0;
  gameState.message = "딱밤처럼 검지를 빠르게 튕겨보세요.";
}

function updateTimer() {
  const elapsed = floor((millis() - gameState.startedAt) / 1000);
  gameState.timeLeft = max(0, GAME_TIME_SECONDS - elapsed);

  if (gameState.timeLeft <= 0) {
    finishGame("시간 종료!");
  }
}

function finishGame(message) {
  gameState.screen = SCREEN.RESULT;
  gameState.message = message;
}

// =====================================================
// Weed mode
// =====================================================

function updateWeedMode() {
  updateWeedGesture(gameState.handState);

  if (weed.state === "pulling") {
    weed.pullProgress += 5;
    weed.successTimer++;

    if (weed.pullProgress > 85) {
      weed.state = "removed";
      weed.successTimer = 0;
    }
  }

  if (weed.state === "removed") {
    weed.successTimer++;
    if (weed.successTimer > 25) {
      spawnNewWeed();
    }
  }
}

function updateWeedGesture(handState) {
  if (handState === HAND_STATE.NO_HAND) {
    gameState.weedGestureState = "WAIT_OPEN";
    return;
  }

  switch (gameState.weedGestureState) {
    case "WAIT_OPEN":
      if (handState === HAND_STATE.OPEN_HAND) {
        gameState.weedGestureState = "WAIT_FIST";
        gameState.message = "좋아요. 이제 주먹을 쥐세요.";
      }
      break;

    case "WAIT_FIST":
      if (handState === HAND_STATE.FIST) {
        gameState.weedGestureState = "WAIT_RELEASE";
        gameState.message = "잡았습니다. 다시 손을 펴세요!";
      }
      break;

    case "WAIT_RELEASE":
      if (handState === HAND_STATE.OPEN_HAND) {
        onWeedPulled();
        gameState.weedGestureState = "WAIT_OPEN";
        gameState.message = "잡초를 뽑았습니다!";
      }
      break;
  }
}

function onWeedPulled() {
  if (weed.state !== "idle") return;

  gameState.score += 1;
  weed.state = "pulling";
  weed.pullProgress = 0;

  spawnDustEffect(weed.x, weed.y - 25);
}

function spawnNewWeed() {
  weed.x = random(260, width - 260);
  weed.y = random(360, 420);
  weed.state = "idle";
  weed.pullProgress = 0;
  weed.successTimer = 0;
}

// =====================================================
// Battle mode
// =====================================================

function updateBattleMode(hand) {
  const now = millis();

  if (hand && detectFlick(hand) && now - gameState.lastAttackTime > ATTACK_COOLDOWN_MS) {
    onFlickAttack();
    gameState.lastAttackTime = now;
  }

  applyPendingDamage();

  if (monster.hitFlashTimer > 0) {
    monster.hitFlashTimer--;
  } else if (monster.state === "hit") {
    monster.state = "idle";
  }

  if (monster.shake > 0) {
    monster.shake *= 0.85;
    if (monster.shake < 0.5) monster.shake = 0;
  }
}

function detectFlick(hand) {
  const k = hand.keypoints;
  if (!k || k.length < 21) return false;

  const tip = k[8];
  const now = millis();

  if (!previousFingerTip) {
    previousFingerTip = {
      x: tip.x,
      y: tip.y,
      time: now
    };
    return false;
  }

  const dt = max(now - previousFingerTip.time, 1);
  const dx = tip.x - previousFingerTip.x;
  const dy = tip.y - previousFingerTip.y;
  const distance = sqrt(dx * dx + dy * dy);
  const speed = distance / dt;

  previousFingerTip = {
    x: tip.x,
    y: tip.y,
    time: now
  };

  return speed > FLICK_SPEED_THRESHOLD;
}

function onFlickAttack() {
  if (monster.hp <= 0) return;

  monster.pendingDamage += FLICK_DAMAGE;
  monster.state = "hit";
  monster.hitFlashTimer = 15;
  monster.shake = 12;

  gameState.score += 3;
  gameState.message = "딱밤 성공!";

  spawnHitEffect(monster.x, monster.y);
}

function applyPendingDamage() {
  if (monster.pendingDamage > 0 && monster.hp > 0) {
    const amount = min(DAMAGE_APPLY_SPEED, monster.pendingDamage);
    monster.hp -= amount;
    monster.pendingDamage -= amount;

    if (monster.hp <= 0) {
      monster.hp = 0;
      monster.pendingDamage = 0;
      monster.state = "defeated";
      gameState.score += 20;
      spawnClearEffect(monster.x, monster.y);
      finishGame("토벌 성공!");
    }
  }
}

// =====================================================
// Particles
// =====================================================

function spawnDustEffect(x, y) {
  for (let i = 0; i < 22; i++) {
    particles.push({
      x,
      y,
      vx: random(-2.8, 2.8),
      vy: random(-3.5, -0.5),
      life: random(25, 45),
      maxLife: 45,
      size: random(5, 13),
      color: color(160, 115, 65)
    });
  }
}

function spawnHitEffect(x, y) {
  for (let i = 0; i < 18; i++) {
    particles.push({
      x: x + random(-30, 30),
      y: y + random(-20, 20),
      vx: random(-4, 4),
      vy: random(-4, 4),
      life: random(18, 32),
      maxLife: 32,
      size: random(6, 16),
      color: color(255, random(90, 160), random(90, 160))
    });
  }
}

function spawnClearEffect(x, y) {
  for (let i = 0; i < 45; i++) {
    particles.push({
      x,
      y,
      vx: random(-5, 5),
      vy: random(-5, 5),
      life: random(35, 65),
      maxLife: 65,
      size: random(5, 18),
      color: color(random(180, 255), random(160, 255), random(60, 180))
    });
  }
}

function updateParticles() {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08;
    p.life--;
  }

  particles = particles.filter((p) => p.life > 0);
}

function drawParticles() {
  noStroke();

  for (const p of particles) {
    const alpha = map(p.life, 0, p.maxLife, 0, 220);
    fill(red(p.color), green(p.color), blue(p.color), alpha);
    circle(p.x, p.y, p.size);
  }
}

// =====================================================
// Rendering
// =====================================================

function renderScreen(hand) {
  if (gameState.screen === SCREEN.TITLE) {
    drawTitleScreen();
  } else if (gameState.screen === SCREEN.HAND_TEST) {
    drawHandTestScreen(hand);
  } else if (gameState.screen === SCREEN.MODE_SELECT) {
    drawModeSelectScreen();
  } else if (gameState.screen === SCREEN.WEED) {
    drawWeedMode();
  } else if (gameState.screen === SCREEN.BATTLE) {
    drawBattleMode();
  } else if (gameState.screen === SCREEN.RESULT) {
    drawResultScreen();
  }

  drawParticles();

  if (hand) {
    drawHandDebug(hand);
  }

  drawHUD();
}

function drawBackground() {
  background(247, 239, 216);

  // camera preview as a faint background
  push();
  tint(255, 55);
  image(video, 0, 0, width, height);
  noTint();
  pop();

  // ground
  noStroke();
  fill(230, 205, 155);
  rect(0, 410, width, 130);

  fill(218, 190, 135);
  for (let x = 0; x < width; x += 60) {
    ellipse(x, 420 + sin(frameCount * 0.01 + x) * 3, 90, 25);
  }
}

function drawTitleScreen() {
  drawPanel(width / 2 - 280, 105, 560, 320);

  fill(60, 45, 35);
  textAlign(CENTER, CENTER);
  textSize(34);
  text("손으로 하는 작은 모험", width / 2, 170);

  textSize(18);
  fill(90, 75, 60);
  text("ml5.js handPose로 잡초를 뽑고 몬스터를 토벌하세요", width / 2, 220);

  drawButton(width / 2 - 110, 285, 220, 64, "시작하기");

  textSize(14);
  fill(120, 100, 85);
  text("카메라 권한을 허용해야 실행됩니다", width / 2, 375);
}

function drawHandTestScreen(hand) {
  drawPanel(40, 40, 880, 460);

  fill(60, 45, 35);
  textAlign(CENTER, CENTER);
  textSize(28);
  text("손 인식 테스트", width / 2, 85);

  textSize(18);
  fill(80, 65, 55);
  text("손을 카메라 앞에 보여주고, 손을 펴거나 주먹을 쥐어보세요.", width / 2, 125);

  textSize(24);
  fill(30, 120, 80);
  text(`현재 손 상태: ${gameState.handState}`, width / 2, 190);

  textSize(16);
  fill(100, 85, 70);
  text(`raw: ${gameState.rawHandState}`, width / 2, 225);

  if (!hand) {
    fill(200, 70, 70);
    textSize(20);
    text("손이 아직 인식되지 않았습니다", width / 2, 280);
  } else {
    fill(60, 130, 90);
    textSize(20);
    text("손 인식 중입니다", width / 2, 280);
  }

  drawButton(width / 2 - 115, 360, 230, 60, "모드 선택으로");
}

function drawModeSelectScreen() {
  drawPanel(80, 80, 800, 370);

  fill(60, 45, 35);
  textAlign(CENTER, CENTER);
  textSize(30);
  text("모드를 선택하세요", width / 2, 140);

  drawButton(250, 250, 200, 70, "잡초 뽑기");
  drawButton(510, 250, 200, 70, "토벌하기");

  textSize(15);
  fill(110, 90, 75);
  text("키보드 1: 잡초 뽑기 / 키보드 2: 토벌하기", width / 2, 370);
}

function drawWeedMode() {
  drawWeed();

  fill(60, 45, 35);
  textAlign(CENTER, CENTER);
  textSize(22);
  text(gameState.message, width / 2, 95);

  textSize(16);
  fill(90, 75, 60);
  text(`제스처 단계: ${gameState.weedGestureState}`, width / 2, 125);
}

function drawBattleMode() {
  drawMonster();
  drawHpBar(width / 2 - 170, 110, 340, 28);

  fill(60, 45, 35);
  textAlign(CENTER, CENTER);
  textSize(22);
  text(gameState.message, width / 2, 70);

  textSize(15);
  fill(90, 75, 60);
  text("검지 끝을 빠르게 튕기면 공격합니다", width / 2, 150);
}

function drawResultScreen() {
  drawPanel(width / 2 - 260, 120, 520, 300);

  fill(60, 45, 35);
  textAlign(CENTER, CENTER);
  textSize(32);
  text(gameState.message, width / 2, 185);

  textSize(26);
  fill(30, 130, 90);
  text(`점수: ${gameState.score}`, width / 2, 245);

  drawButton(width / 2 - 125, 315, 250, 64, "다시 선택하기");
}

function drawWeed() {
  push();
  translate(weed.x, weed.y - weed.pullProgress);

  if (weed.state === "removed") {
    pop();
    return;
  }

  // root
  stroke(120, 80, 50);
  strokeWeight(7);
  line(0, 5, 0, 35);

  // leaves
  stroke(45, 150, 70);
  strokeWeight(8);
  line(0, 0, -30, -55);
  line(0, 0, 0, -70);
  line(0, 0, 30, -55);
  line(0, -10, -45, -35);
  line(0, -10, 45, -35);

  noStroke();
  fill(65, 180, 90);
  ellipse(-30, -55, 20, 36);
  ellipse(0, -70, 22, 42);
  ellipse(30, -55, 20, 36);

  pop();

  // hole
  noStroke();
  fill(125, 85, 55, 150);
  ellipse(weed.x, weed.y + 25, 95, 25);
}

function drawMonster() {
  push();

  let shakeX = 0;
  let shakeY = 0;

  if (monster.shake > 0) {
    shakeX = random(-monster.shake, monster.shake);
    shakeY = random(-monster.shake * 0.4, monster.shake * 0.4);
  }

  translate(monster.x + shakeX, monster.y + shakeY);

  if (monster.state === "defeated") {
    rotate(sin(frameCount * 0.1) * 0.05);
    fill(180, 180, 180);
  } else if (monster.hitFlashTimer > 0) {
    fill(255, 120, 125);
  } else {
    fill(185, 155, 255);
  }

  noStroke();
  ellipse(0, 0, 150, 115);

  // ears/horns
  fill(150, 120, 230);
  triangle(-55, -35, -85, -85, -25, -55);
  triangle(55, -35, 85, -85, 25, -55);

  // face
  fill(30, 25, 35);
  circle(-35, -10, 14);
  circle(35, -10, 14);

  stroke(30, 25, 35);
  strokeWeight(4);
  noFill();

  if (monster.state === "defeated") {
    line(-45, -15, -25, 5);
    line(-25, -15, -45, 5);
    line(25, -15, 45, 5);
    line(45, -15, 25, 5);
  } else {
    arc(0, 15, 40, 25, 0, PI);
  }

  pop();
}

function drawHpBar(x, y, w, h) {
  const ratio = monster.hp / monster.maxHp;

  noStroke();
  fill(80, 60, 55);
  rect(x - 4, y - 4, w + 8, h + 8, 16);

  fill(245, 220, 220);
  rect(x, y, w, h, 14);

  fill(235, 70, 85);
  rect(x, y, w * ratio, h, 14);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(14);
  text(`HP ${ceil(monster.hp)} / ${monster.maxHp}`, x + w / 2, y + h / 2);
}

function drawHUD() {
  if (gameState.screen === SCREEN.TITLE) return;

  noStroke();
  fill(255, 245, 225, 230);
  rect(15, 15, 230, 100, 20);

  fill(60, 45, 35);
  textAlign(LEFT, TOP);
  textSize(15);
  text(`화면: ${gameState.screen}`, 35, 32);
  text(`손 상태: ${gameState.handState}`, 35, 55);
  text(`점수: ${gameState.score}`, 35, 78);

  if (gameState.screen === SCREEN.WEED || gameState.screen === SCREEN.BATTLE) {
    noStroke();
    fill(255, 245, 225, 230);
    rect(width - 185, 15, 170, 70, 20);

    fill(60, 45, 35);
    textAlign(CENTER, CENTER);
    textSize(26);
    text(`${gameState.timeLeft}s`, width - 100, 50);
  }
}

function drawHandDebug(hand) {
  if (!hand || !hand.keypoints) return;

  noStroke();

  for (let i = 0; i < hand.keypoints.length; i++) {
    const p = hand.keypoints[i];

    if (i === 8) {
      fill(255, 60, 60);
      circle(p.x, p.y, 15);
    } else {
      fill(0, 255, 130, 210);
      circle(p.x, p.y, 8);
    }
  }

  // draw rough finger lines
  stroke(0, 255, 130, 120);
  strokeWeight(3);
  drawHandLine(hand, [0, 1, 2, 3, 4]);
  drawHandLine(hand, [0, 5, 6, 7, 8]);
  drawHandLine(hand, [0, 9, 10, 11, 12]);
  drawHandLine(hand, [0, 13, 14, 15, 16]);
  drawHandLine(hand, [0, 17, 18, 19, 20]);
}

function drawHandLine(hand, indexes) {
  const k = hand.keypoints;
  noFill();
  beginShape();
  for (const idx of indexes) {
    vertex(k[idx].x, k[idx].y);
  }
  endShape();
}

function drawPanel(x, y, w, h) {
  noStroke();
  fill(255, 248, 232, 238);
  rect(x, y, w, h, 28);

  stroke(110, 90, 70, 80);
  strokeWeight(2);
  noFill();
  rect(x, y, w, h, 28);
}

function drawButton(x, y, w, h, label) {
  noStroke();
  fill(255, 190, 95);
  rect(x, y, w, h, 20);

  fill(145, 85, 35);
  rect(x, y + h - 8, w, 8, 0, 0, 20, 20);

  fill(60, 45, 35);
  textAlign(CENTER, CENTER);
  textSize(21);
  text(label, x + w / 2, y + h / 2 - 2);
}
