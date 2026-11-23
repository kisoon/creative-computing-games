/* =========================================================
   HAND SIGN PORTAL
   ml5.js HandPose + FaceMesh
   ---------------------------------------------------------
   thumb + index pinch  -> opens a portal (organic shape)
   middle / ring / pinky -> selects one of five filters
   ========================================================= */

import { FilterEngine } from "./effects.js";

/* ---------------------------------------------------------
   Config
   --------------------------------------------------------- */
const FILTERS = [
  {
    id: "negative",
    ko: "네거티브",
    en: "NEGATIVE",
    accent: "#ff4d6d",
    pattern: "000",
    hint: "중지 · 약지 · 새끼 접기",
  },
  {
    id: "glitch",
    ko: "글리치",
    en: "GLITCH",
    accent: "#25f4ee",
    pattern: "110",
    hint: "중지 · 약지 펴기",
  },
  {
    id: "pixel",
    ko: "픽셀화",
    en: "PIXELATE",
    accent: "#ffd93d",
    pattern: "011",
    hint: "약지 · 새끼 펴기",
  },
  {
    id: "mono",
    ko: "모노크롬",
    en: "MONOCHROME",
    accent: "#f4f1ea",
    pattern: "111",
    hint: "중지 · 약지 · 새끼 펴기",
  },
  {
    id: "face",
    ko: "얼굴 왜곡",
    en: "FACE WARP",
    accent: "#c9a7ff",
    pattern: "101",
    hint: "중지 · 새끼 펴기",
  },
];

/* pattern -> filter index. Anything else falls back to the
   closest defined pattern, so a half-made sign still works. */
const PATTERN_INDEX = { "000": 0, "110": 1, "011": 2, "111": 3, "101": 4 };

const DEFAULT_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const PINCH_ENTER = 0.55;
const PINCH_EXIT = 0.95;
const HAND_LOST_MS = 460;
const SIGN_STABLE_MS = 140;
const PREVIEW_MS = 9000;

/* ---------------------------------------------------------
   DOM
   --------------------------------------------------------- */
const stage = document.getElementById("stage");
const canvas = document.getElementById("view");
const gfx = canvas.getContext("2d", { alpha: false });

const startBtn = document.getElementById("startBtn");
const demoBtn = document.getElementById("demoBtn");
const retryBtn = document.getElementById("retryBtn");
const errorDemoBtn = document.getElementById("errorDemoBtn");
const loader = document.getElementById("loader");
const loaderTitle = document.getElementById("loaderTitle");
const loaderSub = document.getElementById("loaderSub");
const errorPanel = document.getElementById("errorPanel");
const errorMsg = document.getElementById("errorMsg");
const errorTip = document.getElementById("errorTip");
const flashEl = document.getElementById("flash");
const legend = document.getElementById("legend");
const statusText = document.getElementById("statusText");
const filterEn = document.getElementById("filterEn");
const filterKo = document.getElementById("filterKo");
const hintText = document.getElementById("hintText");
const introNote = document.getElementById("introNote");
const soundBtn = document.getElementById("soundBtn");
const shotBtn = document.getElementById("shotBtn");
const fullBtn = document.getElementById("fullBtn");
const helpBtn = document.getElementById("helpBtn");

/* ---------------------------------------------------------
   State
   --------------------------------------------------------- */
const state = {
  started: false,
  demo: false,
  booting: false,
  cameraLive: false,
  handReady: false,
  muted: false,

  hands: [],
  lastHandAt: 0,
  keypoints: null,
  handScale: 1,
  pinching: false,
  fingers: { middle: false, ring: false, pinky: false },
  pattern: "",
  candidatePattern: "",
  candidateSince: 0,

  activeFilter: 0,
  hasOpened: false,
  previewUntil: 0,

  portal: {
    presence: 0,
    cx: 0,
    cy: 0,
    r: 200,
    rot: 0,
    initialized: false,
  },
  thumbTip: null,
  indexTip: null,
  palm: null,

  faceStatus: "idle",
  faceLoading: false,
  faceRunning: false,
  lastFaceUseAt: 0,
  faceErrorAt: 0,
  faceSmooth: null,
  faceData: null,
  fxCanvas: null,

  hudAt: 0,
  lastStatus: "",
  lastHint: "",
  time: 0,
};

const engine = new FilterEngine();

/* offscreen source frame (mirrored webcam or synthetic demo) */
const frameCanvas = document.createElement("canvas");
const frameCtx = frameCanvas.getContext("2d", { alpha: false });

/* video + models */
const video = document.createElement("video");
video.playsInline = true;
video.muted = true;
video.autoplay = true;
video.setAttribute("aria-hidden", "true");

let handPose = null;
let connections = DEFAULT_CONNECTIONS;
let faceMesh = null;
let faceTriangles = [];
let faces = [];
let mediaStream = null;

let scanPattern = null;
let toastEl = null;
let toastTimer = 0;
let audioCtx = null;

const filterButtons = [];

/* ---------------------------------------------------------
   Small helpers
   --------------------------------------------------------- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

function hexToRgba(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) d++;
  return d;
}

function filterForPattern(p) {
  if (PATTERN_INDEX[p] != null) return PATTERN_INDEX[p];
  let best = 0;
  let bestD = 9;
  FILTERS.forEach((f, i) => {
    const d = hamming(p, f.pattern);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

function showToast(message, ms = 3600) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    stage.appendChild(toastEl);
  }
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), ms);
}

function flashScreen(color, alpha = 0.2, hold = 30) {
  flashEl.style.transition = "none";
  flashEl.style.background = color;
  flashEl.style.opacity = String(alpha);
  void flashEl.offsetWidth;
  setTimeout(() => {
    flashEl.style.transition = "opacity .55s ease";
    flashEl.style.opacity = "0";
  }, hold);
}

/* ---------------------------------------------------------
   Audio (tiny synthesized UI sounds)
   --------------------------------------------------------- */
function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function tone(freq, dur = 0.09, type = "sine", vol = 0.045, slideTo = 0) {
  if (state.muted) return;
  ensureAudio();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(vol, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

const sfx = {
  open() {
    tone(420, 0.16, "sine", 0.04, 760);
    setTimeout(() => tone(880, 0.12, "triangle", 0.025), 60);
  },
  close() {
    tone(520, 0.16, "sine", 0.03, 260);
  },
  filter(i) {
    const base = [392, 494, 587, 698, 784][i] || 440;
    tone(base, 0.07, "triangle", 0.028);
    setTimeout(() => tone(base * 1.5, 0.07, "sine", 0.018), 45);
  },
  shot() {
    tone(1100, 0.06, "square", 0.02, 700);
  },
};

/* ---------------------------------------------------------
   Hand icon (SVG line art, generated from finger pattern)
   --------------------------------------------------------- */
function handIcon(pattern) {
  const [m, r, p] = pattern.split("").map((c) => c === "1");
  const finger = (x, y, h, w = 9) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}"/>`;

  return `<svg viewBox="0 0 100 112" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <!-- thumb -->
    <path d="M41 84 C30 80 24 70 25 60 C26 51 30 44 34 39"/>
    <!-- index -->
    <path d="M53 64 C48 54 41 45 34 39"/>
    <!-- palm -->
    <path d="M42 108 V70 C42 62 47 57 54 57 H78 C84 57 88 62 88 69 V108"/>
    <!-- wrist -->
    <path d="M48 108 v-4 M58 108 v-3 M68 108 v-3"/>
    <!-- middle / ring / pinky -->
    ${finger(50, m ? 16 : 45, m ? 44 : 12)}
    ${finger(63, r ? 19 : 47, r ? 41 : 10)}
    ${finger(75, p ? 27 : 49, p ? 33 : 8, 8)}
    <!-- pinch -->
    <circle cx="31" cy="35" r="5.5" stroke-width="2.2"/>
    <circle cx="31" cy="35" r="1.6" fill="currentColor" stroke="none"/>
  </svg>`;
}

/* ---------------------------------------------------------
   Build legend / initial canvas
   --------------------------------------------------------- */
function buildLegend() {
  FILTERS.forEach((f, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gesture";
    btn.dataset.index = String(i);
    btn.style.setProperty("--c", f.accent);
    btn.setAttribute("aria-label", `${f.ko} 필터, ${f.hint}`);
    btn.innerHTML = `
      <span class="gesture-icon">${handIcon(f.pattern)}</span>
      <span class="gesture-text">
        <span class="g-ko">${f.ko}</span>
        <span class="g-hint">${f.hint}</span>
      </span>
      <span class="g-key">${i + 1}</span>
    `;
    btn.addEventListener("click", () => {
      if (!state.started) return;
      startPreview(i);
    });
    legend.appendChild(btn);
    filterButtons.push(btn);
  });
}

function buildScanPattern() {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 4;
  const x = c.getContext("2d");
  x.fillStyle = "rgba(0,0,0,.55)";
  x.fillRect(0, 3, 4, 1);
  scanPattern = gfx.createPattern(c, "repeat");
}

function resizeCanvas(w, h) {
  if (!w || !h) return;
  const scale = Math.min(1, 1440 / w, 900 / h);
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  if (canvas.width === cw && canvas.height === ch) return;

  canvas.width = cw;
  canvas.height = ch;
  frameCanvas.width = cw;
  frameCanvas.height = ch;
  engine.resize(cw, ch);
  buildScanPattern();
  state.faceSmooth = null;
  state.faceData = null;

  if (!state.portal.initialized) {
    state.portal.cx = cw / 2;
    state.portal.cy = ch * 0.47;
    state.portal.r = Math.min(cw, ch) * 0.3;
  }
}

/* ---------------------------------------------------------
   Filter switching
   --------------------------------------------------------- */
function setFilter(index, force = false) {
  if (!force && state.activeFilter === index) return;
  state.activeFilter = index;
  const f = FILTERS[index];

  document.documentElement.style.setProperty("--filter-accent", f.accent);
  filterButtons.forEach((b, i) => b.classList.toggle("active", i === index));

  if (state.started) {
    flashScreen(f.accent, 0.12, 20);
    sfx.filter(index);
  }

  // reset face smoothing so a new face doesn't stretch from the old one
  if (f.id !== "face") {
    state.faceSmooth = null;
  }
}

function startPreview(index, duration = PREVIEW_MS) {
  const now = performance.now();
  state.previewUntil = now + duration;
  state.hasOpened = true;
  state.previewFilter = index;
  setFilter(index, true);

  if (FILTERS[index].id === "face") ensureFaceModel();

  const f = FILTERS[index];
  showToast(`${f.ko} · ${f.hint}`, 2600);
}

/* ---------------------------------------------------------
   Start / boot
   --------------------------------------------------------- */
function setLoading(show, title, sub) {
  loader.hidden = !show;
  if (title) loaderTitle.textContent = title;
  if (sub) loaderSub.textContent = sub;
}

function setStarted() {
  state.started = true;
  document.body.classList.add("started");
  setLoading(false);
  hideError();
  ensureAudio();
  tone(330, 0.18, "sine", 0.03, 660);
}

function showError(message, tip) {
  setLoading(false);
  errorMsg.textContent = message;
  errorTip.textContent = tip || "";
  errorTip.hidden = !tip;
  errorPanel.hidden = false;
}

function hideError() {
  errorPanel.hidden = true;
}

function describeCameraError(err) {
  const name = err && err.name;
  if (err && err.appCode === "file") {
    return {
      message: "이 페이지는 file:// 로 열려 있어 카메라를 사용할 수 없습니다.",
      tip:
        "터미널에서 이 폴더로 이동한 뒤 아래 명령을 실행하세요.\n\n" +
        "  python3 -m http.server 8000\n\n" +
        "브라우저에서 http://localhost:8000 을 열면 됩니다.",
    };
  }
  if (err && err.appCode === "insecure") {
    return {
      message: "카메라는 HTTPS 또는 localhost에서만 열 수 있습니다.",
      tip: "로컬 서버(예: python3 -m http.server)로 열거나 HTTPS 주소에서 접속해 주세요.",
    };
  }
  if (err && err.appCode === "unsupported") {
    return {
      message: "이 브라우저는 웹캠 API를 지원하지 않습니다.",
      tip: "Chrome, Edge, Safari 최신 버전에서 다시 시도해 주세요.",
    };
  }
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return {
      message: "카메라 권한이 거부되었습니다.",
      tip:
        "주소창의 카메라/자물쇠 아이콘에서 권한을 '허용'으로 바꾼 뒤 다시 시도하세요.\n" +
        "macOS: 시스템 설정 → 개인정보 보호 및 보안 → 카메라에서 브라우저를 허용.",
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      message: "사용할 수 있는 카메라를 찾지 못했습니다.",
      tip: "웹캠을 연결하거나, 카메라 없이 미리보기로 먼저 둘러볼 수 있습니다.",
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      message: "카메라를 다른 앱이 사용 중입니다.",
      tip: "화상회의 앱 등을 종료한 뒤 다시 시도해 주세요.",
    };
  }
  if (err && err.appCode === "model") {
    return {
      message: "ml5.js 모델을 불러오지 못했습니다.",
      tip: "인터넷 연결을 확인하고 새로고침해 주세요.\n모델은 unpkg CDN에서 내려받습니다.",
    };
  }
  return {
    message: "카메라를 시작하는 중 문제가 발생했습니다.",
    tip: (err && (err.message || String(err))) || "알 수 없는 오류",
  };
}

function waitForVideo() {
  return new Promise((resolve, reject) => {
    if (video.videoWidth > 0) return resolve();
    const timer = setTimeout(() => reject(new Error("video-timeout")), 10000);
    video.addEventListener(
      "loadedmetadata",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

async function bootCamera() {
  if (state.booting) return;
  state.booting = true;
  startBtn.disabled = true;
  startBtn.querySelector("span").textContent = "준비 중…";
  hideError();
  setLoading(true, "카메라 연결 중", "권한을 허용해 주세요");

  try {
    if (location.protocol === "file:") {
      const e = new Error("file protocol");
      e.appCode = "file";
      throw e;
    }
    if (!window.isSecureContext) {
      const e = new Error("insecure context");
      e.appCode = "insecure";
      throw e;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const e = new Error("no mediaDevices");
      e.appCode = "unsupported";
      throw e;
    }
    if (!window.ml5) {
      const e = new Error("ml5 missing");
      e.appCode = "model";
      throw e;
    }

    const modelPromise = ml5.handPose({
      maxHands: 1,
      modelType: "full",
      flipped: false,
    });

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    video.srcObject = mediaStream;
    await video.play().catch(() => {});
    await waitForVideo();
    resizeCanvas(video.videoWidth, video.videoHeight);

    setLoading(true, "손 인식 모델 준비 중", "handpose · 21 keypoints");
    try {
      handPose = await modelPromise;
    } catch (err) {
      const e = new Error("model load failed");
      e.appCode = "model";
      throw e;
    }

    window.Ml5Runtime.start(handPose, video, onHands);
    if (typeof handPose.getConnections === "function") {
      connections = handPose.getConnections() || DEFAULT_CONNECTIONS;
    }

    state.cameraLive = true;
    state.handReady = true;
    state.demo = false;
    setStarted();
    setTimeout(() => showToast("엄지와 검지를 맞대보세요", 3200), 500);
  } catch (err) {
    console.warn(err);
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
      video.srcObject = null;
    }
    if (handPose) {
      try {
        handPose.detectStop();
      } catch (_) {}
    }
    state.cameraLive = false;
    state.handReady = false;
    const info = describeCameraError(err);
    showError(info.message, info.tip);
  } finally {
    state.booting = false;
    startBtn.disabled = false;
    startBtn.querySelector("span").textContent = "카메라 시작";
    setLoading(false);
  }
}

function startDemo() {
  hideError();
  state.demo = true;
  setStarted();
  state.portal.presence = 1;
  state.portal.cx = canvas.width / 2;
  state.portal.cy = canvas.height * 0.47;
  state.portal.r = Math.min(canvas.width, canvas.height) * 0.31;
  state.portal.initialized = true;
  startPreview(0, 14000);
  showToast("데모 모드 · 카드나 1~5 키로 필터를 바꿔보세요", 4800);
}

/* ---------------------------------------------------------
   Model callbacks
   --------------------------------------------------------- */
function onHands(results) {
  state.hands = results || [];
  if (results && results.length) state.lastHandAt = performance.now();
}

function onFaces(results) {
  faces = results || [];
}

async function ensureFaceModel() {
  if (state.demo || !state.cameraLive || state.faceLoading) return;

  if (faceMesh) {
    if (!state.faceRunning) {
      try {
        window.Ml5Runtime.start(faceMesh, video, onFaces);
        state.faceRunning = true;
        state.faceStatus = "ready";
      } catch (err) {
        console.warn("faceMesh restart failed", err);
      }
    }
    return;
  }

  state.faceLoading = true;
  state.faceStatus = "loading";
  try {
    faceMesh = await ml5.faceMesh({
      maxFaces: 1,
      refineLandmarks: false,
      flipped: false,
    });
    try {
      faceTriangles = faceMesh.getTriangles() || [];
    } catch (err) {
      faceTriangles = [];
    }
    window.Ml5Runtime.start(faceMesh, video, onFaces);
    state.faceRunning = true;
    state.faceStatus = "ready";
  } catch (err) {
    console.warn("faceMesh load failed", err);
    state.faceStatus = "error";
    state.faceErrorAt = performance.now();
    showToast("얼굴 메쉬 모델을 불러오지 못했습니다", 4000);
  } finally {
    state.faceLoading = false;
  }
}

function stopFaceModel() {
  if (!faceMesh || !state.faceRunning) return;
  try {
    faceMesh.detectStop();
  } catch (_) {}
  state.faceRunning = false;
  faces = [];
  state.faceSmooth = null;
}

/* ---------------------------------------------------------
   Coordinates / gestures
   --------------------------------------------------------- */
function mapPoint(p) {
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  return {
    x: ((vw - p.x) * canvas.width) / vw,
    y: (p.y * canvas.height) / vh,
  };
}

function updateGesture(now) {
  const hand = state.hands[0];
  const fresh = hand && now - state.lastHandAt < HAND_LOST_MS;

  if (!fresh) {
    if (state.pinching) {
      state.pinching = false;
      sfx.close();
    }
    state.keypoints = null;
    state.thumbTip = null;
    state.indexTip = null;
    state.palm = null;
    state.fingers = { middle: false, ring: false, pinky: false };
    state.pattern = "";
    state.candidatePattern = "";
    return;
  }

  const k = hand.keypoints.map(mapPoint);
  state.keypoints = k;

  const wrist = k[0];
  const scale = Math.max(1, dist(wrist, k[9]));
  state.handScale = scale;
  state.palm = k[9];
  state.thumbTip = k[4];
  state.indexTip = k[8];

  const pinchRatio = dist(k[4], k[8]) / scale;

  if (!state.pinching && pinchRatio < PINCH_ENTER) {
    state.pinching = true;
    state.previewUntil = 0;
    state.hasOpened = true;
    setFilter(state.activeFilter, true);
    sfx.open();
    flashScreen(FILTERS[state.activeFilter].accent, 0.16, 40);
    if (FILTERS[state.activeFilter].id === "face") ensureFaceModel();
  } else if (state.pinching && pinchRatio > PINCH_EXIT) {
    state.pinching = false;
    sfx.close();
  }

  // finger extension with hysteresis
  const ratio = (tip, pip) => dist(k[tip], wrist) / Math.max(1, dist(k[pip], wrist));
  const read = (key, tip, pip) => {
    const r = ratio(tip, pip);
    const was = state.fingers[key];
    return was ? r > 1.12 : r > 1.24;
  };
  state.fingers = {
    middle: read("middle", 12, 10),
    ring: read("ring", 16, 14),
    pinky: read("pinky", 20, 18),
  };

  const pattern = `${state.fingers.middle ? 1 : 0}${state.fingers.ring ? 1 : 0}${
    state.fingers.pinky ? 1 : 0
  }`;
  state.pattern = pattern;

  if (pattern !== state.candidatePattern) {
    state.candidatePattern = pattern;
    state.candidateSince = now;
  }

  if (state.pinching && now - state.candidateSince > SIGN_STABLE_MS) {
    const index = filterForPattern(pattern);
    if (index !== state.activeFilter) {
      setFilter(index);
      if (FILTERS[index].id === "face") ensureFaceModel();
    }
  }

  // portal center: a little above the pinch, following the hand
  const mid = { x: (k[4].x + k[8].x) / 2, y: (k[4].y + k[8].y) / 2 };
  const dir = { x: mid.x - wrist.x, y: mid.y - wrist.y };
  const len = Math.max(1, Math.hypot(dir.x, dir.y));
  dir.x /= len;
  dir.y /= len;

  const minDim = Math.min(canvas.width, canvas.height);
  const targetR = clamp(scale * 2.45, minDim * 0.12, minDim * 0.4);
  const target = {
    cx: mid.x + dir.x * targetR * 0.2,
    cy: mid.y + dir.y * targetR * 0.2,
    r: targetR,
    rot: Math.atan2(k[8].y - k[4].y, k[8].x - k[4].x),
  };

  state.portalTarget = target;
}

/* ---------------------------------------------------------
   Portal state
   --------------------------------------------------------- */
function updatePortal(now, dt, t) {
  const p = state.portal;
  const previewing = now < state.previewUntil;
  const targetPresence = state.pinching || previewing ? 1 : 0;

  const speed = targetPresence ? 9 : 6;
  p.presence += (targetPresence - p.presence) * (1 - Math.exp(-speed * dt));
  if (p.presence < 0.0015) p.presence = 0;

  const minDim = Math.min(canvas.width, canvas.height);

  if (state.pinching && state.portalTarget) {
    const tg = state.portalTarget;
    const k = 1 - Math.exp(-12 * dt);
    const kr = 1 - Math.exp(-10 * dt);
    const krr = 1 - Math.exp(-9 * dt);

    if (!p.initialized) {
      p.cx = tg.cx;
      p.cy = tg.cy;
      p.r = tg.r;
      p.rot = tg.rot;
      p.initialized = true;
    } else {
      p.cx = lerp(p.cx, tg.cx, k);
      p.cy = lerp(p.cy, tg.cy, k);
      p.r = lerp(p.r, tg.r, kr);
      p.rot += Math.atan2(Math.sin(tg.rot - p.rot), Math.cos(tg.rot - p.rot)) * krr;
    }
  } else if (previewing) {
    const k = 1 - Math.exp(-5 * dt);
    const tx = canvas.width / 2;
    const ty = canvas.height * 0.47;
    const tr = minDim * 0.3 * (1 + 0.015 * Math.sin(t * 1.4));
    p.cx = lerp(p.cx, tx, k);
    p.cy = lerp(p.cy, ty, k);
    p.r = lerp(p.r, tr, k);
    p.rot += dt * 0.1;
    p.initialized = true;
  }

  // keep the whole portal on screen (unless the hand is off screen)
  if (p.initialized) {
    const margin = p.r * 0.22;
    p.cx = clamp(p.cx, margin, canvas.width - margin);
    p.cy = clamp(p.cy, margin, canvas.height - margin);
  }
}

/* ---------------------------------------------------------
   Face data
   --------------------------------------------------------- */
function computeFaceBox(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const pad = Math.max(4, (maxX - minX) * 0.03);
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  };
}

function getFaceData() {
  if (!faces.length || !faces[0].keypoints || !faces[0].keypoints.length) {
    state.faceData = null;
    return null;
  }
  const raw = faces[0].keypoints;

  if (!state.faceSmooth || state.faceSmooth.length !== raw.length) {
    state.faceSmooth = raw.map((p) => mapPoint(p));
  } else {
    for (let i = 0; i < raw.length; i++) {
      const target = mapPoint(raw[i]);
      const s = state.faceSmooth[i];
      s.x = lerp(s.x, target.x, 0.55);
      s.y = lerp(s.y, target.y, 0.55);
    }
  }

  const box = computeFaceBox(state.faceSmooth);
  const data = {
    points: state.faceSmooth,
    triangles: faceTriangles,
    box,
  };
  state.faceData = data;
  return data;
}

/* ---------------------------------------------------------
   Drawing: synthetic demo scene
   --------------------------------------------------------- */
function drawSynthetic(t) {
  const w = canvas.width;
  const h = canvas.height;
  const c = frameCtx;

  const bg = c.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#0b0916");
  bg.addColorStop(0.46, "#12142a");
  bg.addColorStop(1, "#071416");
  c.fillStyle = bg;
  c.fillRect(0, 0, w, h);

  const glow = (x, y, r, color) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(0.55, color.replace(/[\d.]+\)$/, "0.06)"));
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  };

  glow(w * (0.3 + 0.04 * Math.sin(t * 0.31)), h * (0.3 + 0.05 * Math.cos(t * 0.27)), w * 0.45, "rgba(124,78,255,0.42)");
  glow(w * (0.73 + 0.04 * Math.cos(t * 0.23)), h * (0.64 + 0.04 * Math.sin(t * 0.33)), w * 0.4, "rgba(0,224,198,0.3)");
  glow(w * (0.52 + 0.05 * Math.sin(t * 0.19)), h * 0.96, w * 0.55, "rgba(255,77,109,0.2)");

  // hairline grid
  c.strokeStyle = "rgba(255,255,255,.055)";
  c.lineWidth = 1;
  const step = Math.max(48, Math.round(w / 18));
  c.beginPath();
  for (let x = (w % step) / 2; x < w; x += step) {
    c.moveTo(x, 0);
    c.lineTo(x, h);
  }
  for (let y = (h % step) / 2; y < h; y += step) {
    c.moveTo(0, y);
    c.lineTo(w, y);
  }
  c.stroke();

  // concentric orbit rings
  c.save();
  c.translate(w * 0.5, h * 0.47);
  c.rotate(t * 0.05);
  c.strokeStyle = "rgba(244,241,234,.14)";
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.arc(0, 0, Math.min(w, h) * (0.24 + i * 0.055), 0, Math.PI * 2);
    c.stroke();
  }
  c.setLineDash([2, 12]);
  c.strokeStyle = "rgba(201,167,255,.5)";
  c.beginPath();
  c.arc(0, 0, Math.min(w, h) * 0.395, 0, Math.PI * 2);
  c.stroke();
  c.restore();

  // graphic portrait
  const cx = w * 0.5;
  const cy = h * 0.47;
  const R = Math.min(w, h) * 0.185;

  c.fillStyle = "rgba(255,45,117,.75)";
  c.beginPath();
  c.arc(cx + R * 0.5, cy - R * 0.16, R * 0.78, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = "rgba(0,229,255,.55)";
  c.beginPath();
  c.arc(cx - R * 0.58, cy + R * 0.2, R * 0.48, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = "#efeae0";
  c.beginPath();
  c.arc(cx, cy, R, 0, Math.PI * 2);
  c.fill();

  // blink
  const blinkPhase = (t * 0.42) % 1;
  const blink = blinkPhase > 0.965 ? 0.1 : 1;
  c.fillStyle = "#111018";
  c.beginPath();
  c.ellipse(cx - R * 0.34, cy - R * 0.12, R * 0.075, R * 0.11 * blink, 0, 0, Math.PI * 2);
  c.ellipse(cx + R * 0.34, cy - R * 0.12, R * 0.075, R * 0.11 * blink, 0, 0, Math.PI * 2);
  c.fill();

  // nose
  c.strokeStyle = "#111018";
  c.lineWidth = Math.max(2, R * 0.025);
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(cx, cy + R * 0.02);
  c.lineTo(cx - R * 0.05, cy + R * 0.3);
  c.lineTo(cx + R * 0.08, cy + R * 0.32);
  c.stroke();

  // mouth
  c.beginPath();
  c.arc(cx, cy + R * 0.32, R * 0.28, 0.18 * Math.PI, 0.82 * Math.PI);
  c.stroke();

  // tiny poster labels
  c.fillStyle = "rgba(244,241,234,.5)";
  c.font = `500 ${Math.max(9, Math.round(w * 0.009))}px "Space Grotesk", sans-serif`;
  c.textAlign = "left";
  c.fillText("DEMO / SIGNAL 01", w * 0.06, h * 0.12);
  c.fillText("NO CAMERA — PREVIEW MODE", w * 0.06, h * 0.12 + 16);

  c.textAlign = "right";
  c.fillText("ML5.JS", w * 0.94, h * 0.12);
  c.fillText(`${Math.round(fpsEstimate)} FPS`, w * 0.94, h * 0.12 + 16);

  c.textAlign = "left";

  // corner ticks
  c.strokeStyle = "rgba(255,255,255,.2)";
  c.beginPath();
  const m = 24;
  c.moveTo(m, m + 18); c.lineTo(m, m); c.lineTo(m + 18, m);
  c.moveTo(w - m - 18, m); c.lineTo(w - m, m); c.lineTo(w - m, m + 18);
  c.moveTo(m, h - m - 18); c.lineTo(m, h - m); c.lineTo(m + 18, h - m);
  c.moveTo(w - m - 18, h - m); c.lineTo(w - m, h - m); c.lineTo(w - m, h - m - 18);
  c.stroke();
}

/* ---------------------------------------------------------
   Drawing: camera frame
   --------------------------------------------------------- */
function drawCameraFrame() {
  const w = canvas.width;
  const h = canvas.height;
  const c = frameCtx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = "source-over";
  c.clearRect(0, 0, w, h);
  c.save();
  c.translate(w, 0);
  c.scale(-1, 1);
  c.drawImage(video, 0, 0, w, h);
  c.restore();
}

/* ---------------------------------------------------------
   Drawing: portal
   --------------------------------------------------------- */
function blobPath(ctx, cx, cy, r, rot, t, expand = 0) {
  const n = 76;
  ctx.beginPath();
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const wob =
      1 +
      0.03 * Math.sin(a * 3 + t * 1.55) +
      0.016 * Math.sin(a * 5 - t * 2.05) +
      0.008 * Math.sin(a * 8 + t * 1.2);
    const rr = (r + expand) * wob;
    const x0 = Math.cos(a) * rr * 1.045;
    const y0 = Math.sin(a) * rr * 0.965;
    const x = cx + x0 * cosR - y0 * sinR;
    const y = cy + x0 * sinR + y0 * cosR;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPortal(t, now) {
  const p = state.portal;
  if (p.presence < 0.004) return;

  const f = FILTERS[state.activeFilter];
  const pv = clamp(p.presence, 0, 1);
  const alpha = clamp(pv * 1.5, 0, 1);
  const grow = Math.max(0, easeOutBack(pv));
  const r = Math.max(2, p.r * grow);
  const cx = p.cx;
  const cy = p.cy;
  const rot = p.rot;
  const preview = now < state.previewUntil;

  // 1. filtered frame inside the organic shape
  gfx.save();
  blobPath(gfx, cx, cy, r, rot, t);
  gfx.clip();
  gfx.globalAlpha = alpha;
  if (state.fxCanvas) gfx.drawImage(state.fxCanvas, 0, 0);

  // color grade
  gfx.globalCompositeOperation = "overlay";
  gfx.globalAlpha = alpha * 0.12;
  gfx.fillStyle = f.accent;
  gfx.fillRect(cx - r * 1.3, cy - r * 1.3, r * 2.6, r * 2.6);

  // scanlines
  if (scanPattern) {
    gfx.globalCompositeOperation = "source-over";
    gfx.globalAlpha = alpha * 0.22;
    gfx.fillStyle = scanPattern;
    gfx.fillRect(cx - r * 1.1, cy - r * 1.1, r * 2.2, r * 2.2);
  }

  // vignette
  const g = gfx.createRadialGradient(cx, cy, r * 0.38, cx, cy, r * 1.16);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.72, "rgba(0,0,0,.06)");
  g.addColorStop(1, "rgba(0,0,0,.6)");
  gfx.globalCompositeOperation = "source-over";
  gfx.globalAlpha = alpha;
  gfx.fillStyle = g;
  gfx.fillRect(cx - r * 1.2, cy - r * 1.2, r * 2.4, r * 2.4);

  // scanning line while the face model loads
  if (f.id === "face" && state.faceStatus === "loading") {
    const y = cy - r + ((t * 90) % (r * 2));
    const lg = gfx.createLinearGradient(cx - r, y, cx + r, y);
    lg.addColorStop(0, "rgba(201,167,255,0)");
    lg.addColorStop(0.5, "rgba(201,167,255,.8)");
    lg.addColorStop(1, "rgba(201,167,255,0)");
    gfx.globalAlpha = alpha;
    gfx.fillStyle = lg;
    gfx.fillRect(cx - r, y, r * 2, 2);
    gfx.font = `500 ${Math.max(9, Math.round(r * 0.055))}px "Space Grotesk", sans-serif`;
    gfx.textAlign = "center";
    gfx.textBaseline = "middle";
    gfx.fillStyle = "rgba(255,255,255,.7)";
    gfx.fillText("LOADING FACE MESH", cx, cy);
  }
  gfx.restore();

  // 2. border + glow
  gfx.save();
  gfx.globalAlpha = alpha;
  gfx.lineJoin = "round";
  blobPath(gfx, cx, cy, r, rot, t);
  gfx.shadowColor = f.accent;
  gfx.shadowBlur = 34 * pv;
  gfx.strokeStyle = hexToRgba(f.accent, 0.92);
  gfx.lineWidth = 2.4;
  gfx.stroke();
  gfx.shadowBlur = 0;
  gfx.strokeStyle = "rgba(255,255,255,.75)";
  gfx.lineWidth = 0.8;
  gfx.stroke();

  // rotating dashed ring
  blobPath(gfx, cx, cy, r, rot, t, 11);
  gfx.setLineDash([2, 12]);
  gfx.lineDashOffset = -t * 26;
  gfx.strokeStyle = "rgba(255,255,255,.28)";
  gfx.lineWidth = 1.1;
  gfx.stroke();
  gfx.setLineDash([]);
  gfx.restore();

  // 3. label
  if (pv > 0.35) {
    const label = f.en;
    gfx.save();
    gfx.font = '600 10px "Space Grotesk", sans-serif';
    if ("letterSpacing" in gfx) gfx.letterSpacing = "0.16em";
    const tw = gfx.measureText(label).width;
    const lh = 20;
    const lw = tw + 24;
    const ly = cy - r * 0.99 - lh - 8;
    const labelY = ly < 12 ? cy + r * 0.99 + 8 : ly;
    gfx.globalAlpha = alpha;
    gfx.fillStyle = f.accent;
    gfx.shadowColor = f.accent;
    gfx.shadowBlur = 18;
    roundRect(gfx, cx - lw / 2, labelY, lw, lh, 10);
    gfx.fill();
    gfx.shadowBlur = 0;
    gfx.fillStyle = "#08080b";
    gfx.textAlign = "center";
    gfx.textBaseline = "middle";
    gfx.fillText(label, cx, labelY + lh / 2 + 0.5);
    if ("letterSpacing" in gfx) gfx.letterSpacing = "0px";
    gfx.restore();
  }

  // 4. pinch handles + signal
  if (state.pinching && state.thumbTip && state.indexTip) {
    const a = state.thumbTip;
    const b = state.indexTip;
    gfx.save();
    gfx.globalAlpha = alpha;
    gfx.strokeStyle = hexToRgba(f.accent, 0.7);
    gfx.setLineDash([3, 7]);
    gfx.lineDashOffset = -now * 0.03;
    gfx.lineWidth = 1.3;
    gfx.beginPath();
    gfx.moveTo(a.x, a.y);
    gfx.lineTo(b.x, b.y);
    gfx.stroke();
    gfx.setLineDash([]);

    [a, b].forEach((pt, i) => {
      const pulse = 0.65 + 0.35 * Math.sin(t * 3 + i * 1.8);
      gfx.strokeStyle = hexToRgba(f.accent, 0.9);
      gfx.lineWidth = 1.4;
      gfx.beginPath();
      gfx.arc(pt.x, pt.y, 9 + pulse * 3, 0, Math.PI * 2);
      gfx.stroke();
      gfx.fillStyle = f.accent;
      gfx.beginPath();
      gfx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      gfx.fill();
    });
    gfx.restore();
  }

  // 5. orbiting sparkles
  if (pv > 0.5) {
    gfx.save();
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = i * 2.399 + t * (0.16 + (i % 4) * 0.03);
      const rr = r * (1.03 + 0.045 * Math.sin(t * 1.3 + i));
      const x = cx + Math.cos(a) * rr * 1.045;
      const y = cy + Math.sin(a) * rr * 0.965;
      const tw = Math.abs(Math.sin(t * 1.8 + i * 0.9));
      gfx.globalAlpha = alpha * (0.1 + tw * 0.65);
      gfx.fillStyle = i % 5 === 0 ? "#ffffff" : f.accent;
      const size = 0.8 + (i % 3) * 0.7;
      gfx.beginPath();
      gfx.arc(x, y, size, 0, Math.PI * 2);
      gfx.fill();
    }
    gfx.restore();
  }

  // 6. face targeting brackets
  if (state.faceData && state.faceStatus === "ready" && f.id === "face") {
    gfx.save();
    gfx.globalAlpha = alpha;
    drawFaceBrackets(state.faceData.box, f.accent, t);
    gfx.restore();
  }

  // 7. preview tag
  if (preview && pv > 0.4) {
    gfx.save();
    gfx.globalAlpha = alpha * 0.8;
    gfx.font = '500 8px "Space Grotesk", sans-serif';
    if ("letterSpacing" in gfx) gfx.letterSpacing = "0.18em";
    gfx.textAlign = "center";
    gfx.textBaseline = "middle";
    gfx.fillStyle = "rgba(255,255,255,.75)";
    gfx.fillText("PREVIEW", cx, cy + r * 0.62);
    if ("letterSpacing" in gfx) gfx.letterSpacing = "0px";
    gfx.restore();
  }
}

function drawFaceBrackets(box, accent, t) {
  const len = Math.max(12, Math.min(24, box.w * 0.09));
  const x = box.x;
  const y = box.y;
  const w = box.w;
  const h = box.h;
  gfx.save();
  gfx.strokeStyle = hexToRgba(accent, 0.55 + 0.2 * Math.sin(t * 2.4));
  gfx.lineWidth = 1.2;
  gfx.beginPath();
  gfx.moveTo(x, y + len); gfx.lineTo(x, y); gfx.lineTo(x + len, y);
  gfx.moveTo(x + w - len, y); gfx.lineTo(x + w, y); gfx.lineTo(x + w, y + len);
  gfx.moveTo(x, y + h - len); gfx.lineTo(x, y + h); gfx.lineTo(x + len, y + h);
  gfx.moveTo(x + w - len, y + h); gfx.lineTo(x + w, y + h); gfx.lineTo(x + w, y + h - len);
  gfx.stroke();

  gfx.font = '500 8px "Space Grotesk", sans-serif';
  if ("letterSpacing" in gfx) gfx.letterSpacing = "0.16em";
  gfx.fillStyle = hexToRgba(accent, 0.7);
  gfx.textAlign = "left";
  gfx.textBaseline = "bottom";
  gfx.fillText("FACE MESH", x, y - 5);
  if ("letterSpacing" in gfx) gfx.letterSpacing = "0px";
  gfx.restore();
}

/* ---------------------------------------------------------
   Drawing: hand skeleton
   --------------------------------------------------------- */
function drawHand(t) {
  const k = state.keypoints;
  if (!k) return;

  const accent = FILTERS[state.activeFilter].accent;
  gfx.save();
  gfx.lineCap = "round";
  gfx.lineJoin = "round";

  gfx.strokeStyle = "rgba(255,255,255,.18)";
  gfx.lineWidth = 1.1;
  gfx.beginPath();
  for (const [a, b] of connections) {
    if (!k[a] || !k[b]) continue;
    gfx.moveTo(k[a].x, k[a].y);
    gfx.lineTo(k[b].x, k[b].y);
  }
  gfx.stroke();

  gfx.fillStyle = "rgba(255,255,255,.4)";
  for (let i = 0; i < k.length; i++) {
    gfx.beginPath();
    gfx.arc(k[i].x, k[i].y, 1.7, 0, Math.PI * 2);
    gfx.fill();
  }

  const tipPulse = 0.7 + 0.3 * Math.sin(t * 3.4);
  [4, 8].forEach((i) => {
    if (!k[i]) return;
    gfx.strokeStyle = hexToRgba(accent, 0.85);
    gfx.lineWidth = 1.2;
    gfx.beginPath();
    gfx.arc(k[i].x, k[i].y, 7 + tipPulse * 4, 0, Math.PI * 2);
    gfx.stroke();
    gfx.fillStyle = accent;
    gfx.beginPath();
    gfx.arc(k[i].x, k[i].y, 2.2, 0, Math.PI * 2);
    gfx.fill();
  });

  gfx.restore();
}

/* ---------------------------------------------------------
   HUD
   --------------------------------------------------------- */
function updateHud(now) {
  if (!state.started) return;
  if (now - state.hudAt < 100) return;
  state.hudAt = now;

  const f = FILTERS[state.activeFilter];
  const previewing = now < state.previewUntil;
  const handFresh = state.hands.length > 0 && now - state.lastHandAt < HAND_LOST_MS;
  const portalAlive = state.portal.presence > 0.4;

  let status = "";
  if (state.demo) {
    status = `DEMO · ${f.ko}`;
  } else if (state.pinching) {
    status = `PINCH · ${f.ko}`;
  } else if (previewing) {
    status = `PREVIEW · ${f.ko}`;
  } else if (!handFresh) {
    status = "손을 화면에 보여주세요";
  } else {
    status = "엄지 + 검지로 핀치";
  }
  if (status !== state.lastStatus) {
    statusText.textContent = status;
    state.lastStatus = status;
  }

  filterEn.textContent = state.hasOpened ? f.en : "STANDBY";
  filterKo.textContent = state.hasOpened ? f.ko : "필터 없음";
  document.body.classList.toggle("is-live", portalAlive);

  // contextual hint
  let hint = "";
  if (state.demo) {
    hint = "데모 모드 · 카드나 1~5 키로 필터를 미리보세요";
  } else if (state.pinching) {
    if (f.id === "face") {
      if (state.faceStatus === "loading") hint = "얼굴 메쉬 모델을 불러오는 중…";
      else if (state.faceStatus === "error") hint = "얼굴 모델을 불러오지 못했어요";
      else if (!state.faceData) hint = "얼굴을 카메라에 보여주세요";
      else {
        const fc = {
          x: state.faceData.box.x + state.faceData.box.w / 2,
          y: state.faceData.box.y + state.faceData.box.h / 2,
        };
        const far = Math.hypot(fc.x - state.portal.cx, fc.y - state.portal.cy);
        hint =
          far > state.portal.r * 0.85
            ? "포탈을 얼굴 위로 옮겨보세요"
            : "얼굴이 포탈 안에서 일그러집니다";
      }
    } else {
      hint = `${f.hint} · 지금은 ${f.ko}`;
    }
  } else if (previewing) {
    hint = "미리보기 중 · 핀치를 하면 손으로 조작할 수 있어요";
  } else if (!handFresh) {
    hint = "손 전체가 화면에 보이도록 해주세요";
  } else {
    hint = "엄지와 검지를 맞대면 포탈이 열립니다";
  }

  if (hint !== state.lastHint) {
    hintText.textContent = hint;
    state.lastHint = hint;
  }
}

/* ---------------------------------------------------------
   Main loop
   --------------------------------------------------------- */
let lastTime = performance.now();
let fpsEstimate = 60;
let faceUseLog = 0;

function loop(now) {
  requestAnimationFrame(loop);

  const dtRaw = (now - lastTime) / 1000;
  lastTime = now;
  const dt = clamp(dtRaw || 0.016, 0.001, 0.05);
  const t = now / 1000;
  state.time = t;
  fpsEstimate = lerp(fpsEstimate, 1 / Math.max(dtRaw, 0.001), 0.05);

  // camera can change dimensions (orientation / device switch)
  if (state.cameraLive && video.videoWidth) {
    if (video.videoWidth !== canvas.width || video.videoHeight !== canvas.height) {
      resizeCanvas(video.videoWidth, video.videoHeight);
    }
    drawCameraFrame();
  } else {
    drawSynthetic(t);
  }

  updateGesture(now);
  updatePortal(now, dt, t);

  // face mesh lifecycle
  const wantFace =
    FILTERS[state.activeFilter].id === "face" &&
    state.portal.presence > 0.02 &&
    !state.demo &&
    state.cameraLive;

  if (wantFace) {
    state.lastFaceUseAt = now;
    if (!state.faceLoading) {
      if (state.faceStatus === "idle") ensureFaceModel();
      else if (state.faceStatus === "ready" && !state.faceRunning) ensureFaceModel();
    }
    if (state.faceStatus === "error" && now - state.faceErrorAt > 12000) {
      state.faceStatus = "idle";
    }
  } else if (state.faceRunning && now - state.lastFaceUseAt > 5000) {
    stopFaceModel();
  }

  state.faceData = FILTERS[state.activeFilter].id === "face" ? getFaceData() : null;

  // render filtered source only when it can be seen
  if (state.portal.presence > 0.004 || state.previewUntil > now) {
    state.fxCanvas = engine.render(
      FILTERS[state.activeFilter].id,
      frameCanvas,
      t,
      state.faceData
    );
  }

  // ---- composite ----
  gfx.setTransform(1, 0, 0, 1, 0, 0);
  gfx.globalAlpha = 1;
  gfx.globalCompositeOperation = "source-over";
  gfx.clearRect(0, 0, canvas.width, canvas.height);
  gfx.drawImage(frameCanvas, 0, 0);

  if (state.portal.presence > 0.004) {
    drawPortal(t, now);
  }

  drawHand(t);
  updateHud(now);
}

/* ---------------------------------------------------------
   Tools
   --------------------------------------------------------- */
function toggleMute() {
  state.muted = !state.muted;
  soundBtn.classList.toggle("is-off", state.muted);
  soundBtn.setAttribute("aria-label", state.muted ? "소리 켜기" : "소리 끄기");
  soundBtn.title = state.muted ? "소리 켜기 (M)" : "소리 끄기 (M)";
  if (!state.muted) tone(660, 0.08, "sine", 0.03);
}

function screenshot() {
  if (!state.started) return;
  flashScreen("#ffffff", 0.8, 40);
  sfx.shot();
  try {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      const d = new Date();
      const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
        d.getDate()
      ).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(
        d.getMinutes()
      ).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
      a.download = `hand-sign-portal-${stamp}.png`;
      a.href = URL.createObjectURL(blob);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      showToast("스크린샷을 저장했습니다", 2200);
    }, "image/png");
  } catch (err) {
    showToast("스크린샷 저장에 실패했습니다");
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    stage.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.();
  }
}

/* ---------------------------------------------------------
   Events
   --------------------------------------------------------- */
startBtn.addEventListener("click", () => {
  ensureAudio();
  bootCamera();
});
demoBtn.addEventListener("click", () => {
  ensureAudio();
  startDemo();
});
retryBtn.addEventListener("click", () => {
  ensureAudio();
  hideError();
  bootCamera();
});
errorDemoBtn.addEventListener("click", () => {
  hideError();
  startDemo();
});
soundBtn.addEventListener("click", toggleMute);
shotBtn.addEventListener("click", screenshot);
fullBtn.addEventListener("click", toggleFullscreen);
helpBtn.addEventListener("click", () => {
  showToast("핀치로 포탈 열기 · 1–5 필터 미리보기 · S 스크린샷 · F 전체화면", 5200);
});

window.addEventListener("keydown", (e) => {
  if (!state.started) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const key = e.key.toLowerCase();
  if (key >= "1" && key <= "5") {
    startPreview(Number(key) - 1);
  } else if (key === "s") {
    screenshot();
  } else if (key === "m") {
    toggleMute();
  } else if (key === "f") {
    toggleFullscreen();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) state.lastTime = performance.now();
});

/* ---------------------------------------------------------
   Optional debug hook (?debug)
   Feed synthetic keypoints to preview the interaction without a camera.
   --------------------------------------------------------- */
if (new URLSearchParams(location.search).has("debug")) {
  window.HandSignPortal = {
    state,
    FILTERS,
    engine,
    setFilter,
    startPreview,
    feedHand(keypoints) {
      state.hands = [{ keypoints }];
      state.lastHandAt = performance.now();
    },
  };
}

/* ---------------------------------------------------------
   Init
   --------------------------------------------------------- */
function init() {
  buildLegend();
  resizeCanvas(1280, 720);

  if (location.protocol === "file:") {
    introNote.textContent =
      "file:// 로 열면 카메라를 사용할 수 없습니다. 터미널에서 python3 -m http.server 8000 을 실행한 뒤 http://localhost:8000 으로 열어주세요.";
    introNote.classList.add("warn");
  } else if (!window.isSecureContext) {
    introNote.textContent =
      "카메라는 HTTPS 또는 localhost에서만 열 수 있습니다. 보안 연결로 다시 열어주세요.";
    introNote.classList.add("warn");
  }

  requestAnimationFrame(loop);
}

init();
