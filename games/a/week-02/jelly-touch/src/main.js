// 말랑이 터치 — 메인 루프 & 상태 연결

import { CONFIG } from "./config.js";
import { Camera } from "./input/camera.js";
import { HandTracker } from "./input/handTracker.js";
import { HandMapper } from "./input/landmarks.js";
import { Jelly } from "./physics/jelly.js";
import { Face } from "./render/face.js";
import { Effects } from "./render/effects.js";
import { Renderer } from "./render/renderer.js";
import { SquishAudio } from "./audio/squish.js";
import {
  showScreen,
  setLoading,
  showError,
  setHint,
  describeCameraError,
} from "./ui/screens.js";

const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 카메라 없이 마우스로 확인하는 데모 모드 (?demo=1)
const demoMode = new URLSearchParams(location.search).get("demo") === "1";
const pointer = { x: 0, y: 0, inside: false, down: false };
const prevPointer = { x: 0, y: 0 };

const canvas = $("stage");
const renderer = new Renderer(canvas);
const jelly = new Jelly(canvas);
const face = new Face();
const effects = new Effects();
const mapper = new HandMapper();
const camera = new Camera();
const tracker = new HandTracker();
const audio = new SquishAudio();

const state = {
  mode: "idle", // idle | loading | calibrating | playing | error
  debug: false,
  fps: 60,
  busy: false,
};

let last = performance.now();
let acc = 0;
let loadingTimer = 0;

// ---------------------------------------------------------------- 시작/재시작

async function startGame() {
  if (state.busy) return;
  state.busy = true;
  state.mode = "loading";

  audio.unlock();

  showScreen("loading");
  setLoading("카메라를 준비하는 중…");
  setHint("");

  clearTimeout(loadingTimer);
  loadingTimer = setTimeout(() => {
    if (state.mode === "loading") {
      setLoading("손 인식 모델을 내려받는 중… 조금만 기다려 주세요.");
    }
  }, 7000);

  if (!navigator.mediaDevices?.getUserMedia) {
    clearTimeout(loadingTimer);
    showError(
      "이 브라우저에서는 카메라를 쓸 수 없어요",
      "Chrome 또는 Edge 최신 버전에서 https:// 또는 http://localhost 주소로 열어 주세요."
    );
    state.mode = "error";
    state.busy = false;
    return;
  }

  try {
    await camera.start();
  } catch (err) {
    clearTimeout(loadingTimer);
    console.error(err);
    const [title, message] = describeCameraError(err);
    showError(title, message);
    state.mode = "error";
    state.busy = false;
    return;
  }

  try {
    setLoading("손 인식 모델을 준비하는 중…");
    await tracker.load(CONFIG.handPose);
    mapper.reset();
    jelly.build();

    tracker.start(camera.video);
    state.mode = "calibrating";
    showScreen(null);
    setHint("손을 화면에 보여주세요");
    clearTimeout(loadingTimer);
  } catch (err) {
    clearTimeout(loadingTimer);
    console.error(err);
    showError(
      "손 인식 모델을 불러오지 못했어요",
      "인터넷 연결을 확인하고 다시 시도해 주세요. 처음 실행할 때만 모델을 내려받아요."
    );
    state.mode = "error";
  } finally {
    state.busy = false;
  }
}

async function restart() {
  if (state.busy) return;
  tracker.stop();
  tracker.reset();
  camera.stop();
  mapper.reset();
  jelly.build();
  await new Promise((resolve) => setTimeout(resolve, 250));
  startGame();
}

// ---------------------------------------------------------------- 설정 UI

$("startBtn").addEventListener("click", startGame);
$("demoBtn").addEventListener("click", () => {
  location.search = "?demo=1";
});
$("retryBtn").addEventListener("click", restart);
$("reconnectBtn").addEventListener("click", () => {
  $("settingsPanel").classList.add("hidden");
  if (demoMode) {
    location.search = "";
    return;
  }
  restart();
});

$("settingsBtn").addEventListener("click", () => {
  $("settingsPanel").classList.toggle("hidden");
});

$("closeSettings").addEventListener("click", () => {
  $("settingsPanel").classList.add("hidden");
});

$("soundToggle").addEventListener("change", (e) => {
  audio.setEnabled(e.target.checked);
});

$("debugToggle").addEventListener("change", (e) => {
  state.debug = e.target.checked;
});

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.key === "d" || e.key === "D") {
    state.debug = !state.debug;
    $("debugToggle").checked = state.debug;
  }
  if (e.key === "m" || e.key === "M") {
    const next = !$("soundToggle").checked;
    $("soundToggle").checked = next;
    audio.setEnabled(next);
  }
});

// ---------------------------------------------------------------- 데모 (마우스)

canvas.addEventListener("pointermove", (e) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  pointer.y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  pointer.inside = true;
});

canvas.addEventListener("pointerdown", (e) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  pointer.y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  pointer.inside = true;
  pointer.down = true;
  audio.unlock();
  if (demoMode) setHint("");
});

window.addEventListener("pointerup", () => {
  pointer.down = false;
});

canvas.addEventListener("pointerleave", () => {
  if (!pointer.down) pointer.inside = false;
});

canvas.addEventListener("pointercancel", () => {
  pointer.down = false;
  pointer.inside = false;
});

function demoHands(dt) {
  const inv = 1 / Math.max(dt, 1 / 240);
  let vx = clamp((pointer.x - prevPointer.x) * inv, -4000, 4000);
  let vy = clamp((pointer.y - prevPointer.y) * inv, -4000, 4000);
  prevPointer.x = pointer.x;
  prevPointer.y = pointer.y;

  if (!pointer.inside && !pointer.down) return [];

  // 커서 주변에 손끝 5개 + 손바닥을 배치한 가짜 손
  const cx = pointer.x;
  const cy = pointer.y;
  const offsets = [
    [-40, -26],
    [-2, -42],
    [36, -26],
    [46, 4],
    [18, 28],
  ];
  const tips = offsets.map(([dx, dy]) => ({ x: cx + dx, y: cy + dy, vx, vy, r: 20 }));
  const palm = { x: cx + 8, y: cy + 16, vx, vy, r: 46 };

  const points = [];
  for (let i = 0; i < 21; i++) {
    const t = (i / 21) * Math.PI * 2;
    points.push({ x: cx + Math.cos(t) * 72, y: cy + Math.sin(t) * 72, vx, vy });
  }

  // 마우스를 누르고 있으면 "움켜쥐기", 그냥 움직이면 "찌르기"
  const grabbing = pointer.down;
  const grab = {
    strength: grabbing ? 1 : 0,
    x: cx,
    y: cy,
    kind: "fist",
    pinch: 0,
    fist: grabbing ? 1 : 0,
    curl: grabbing ? 1 : 0,
    extended: grabbing ? 0 : 1,
  };

  return [{ id: 1, confidence: 1, points, tips, palm, grab, speed: Math.hypot(vx, vy) }];
}

// ---------------------------------------------------------------- 메인 루프

function tick(now) {
  const rawDt = clamp((now - last) / 1000, 0, 0.1);
  last = now;
  if (rawDt > 0) {
    state.fps += (1 / rawDt - state.fps) * 0.08;
  }

  const tracking = state.mode === "playing" || state.mode === "calibrating";
  let hands = [];
  if (demoMode) {
    hands = demoHands(rawDt);
  } else if (tracking) {
    hands = mapper.update(tracker.getFresh(CONFIG.hand.staleMs), camera.video, canvas, now);
  }

  // 첫 손이 보이면 놀이 시작
  if (handTrackedDuringCalibration(hands)) {
    state.mode = "playing";
    setHint("");
  }

  // 고정 스텝 물리
  let contacts = new Map();
  let starts = [];
  let ends = [];
  acc = Math.min(acc + rawDt, 0.2);
  const step = 1 / 60;
  let steps = 0;

  while (acc >= step && steps < 4) {
    const ev = jelly.update(hands, step, now);
    contacts = ev.contacts;
    if (state.mode === "playing") {
      starts.push(...ev.starts);
      ends.push(...ev.ends);
    }
    acc -= step;
    steps++;
  }

  if (state.mode === "playing") {
    for (const c of starts) audio.contactStart(c);
    for (const c of contacts.values()) audio.contactHold(c, now);
    for (const c of ends) audio.release(c);

    // 문지르면 하트가 튄다
    for (const c of contacts.values()) {
      if (c.speed > 260 && Math.random() < 0.22) {
        effects.spawn(c.x, c.y, 1);
      }
    }
  }

  // 얼굴/파티클
  const primary = hands[0];
  const look = primary ? clamp((primary.palm.x - jelly.cx) / (jelly.R * 1.6), -1, 1) : 0;
  const grab = hands.reduce((m, h) => Math.max(m, h.grab?.strength || 0), 0);
  face.update(rawDt, {
    deform: jelly.deform,
    contact: contacts.size > 0,
    grab,
    lookTarget: look,
  });
  effects.update(rawDt);

  renderer.draw({
    jelly,
    hands,
    face,
    effects,
    debug: state.debug,
    fps: state.fps,
  });

  requestAnimationFrame(tick);
}

function handTrackedDuringCalibration(hands) {
  return state.mode === "calibrating" && hands.length > 0;
}

// 개발용 확인 창 (콘솔에서 상태를 들여다볼 때 사용)
window.__mallang = {
  state,
  jelly,
  mapper,
  tracker,
  camera,
  renderer,
  effects,
  face,
  audio,
  canvas,
  pointer,
  demoHands,
};

if (demoMode) {
  showScreen(null);
  state.mode = "playing";
  setHint("마우스로 찌르고, 누른 채 움직여 당겨보세요");
}

requestAnimationFrame(tick);
