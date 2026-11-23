/**
 * p5.js 스케치 진입점.
 * 카메라 세팅, 모델 로드, 상태 관리, 패널 UI 동기화를 담당합니다.
 */

let video;

const appState = {
  status: "loading", // loading | ready | detecting | stopped | error
  message: "모델을 불러오는 중…",
};

const dom = {};
let lastPanelSync = 0;
let lastHandsSignature = "";

/* ---------------------------------------------------------------- p5 life */

function setup() {
  const canvas = createCanvas(CONFIG.canvas.width, CONFIG.canvas.height);
  canvas.parent("canvas-holder");
  pixelDensity(1);
  textFont("system-ui, -apple-system, 'Segoe UI', sans-serif");

  cacheDom();
  bindUi();
  setupCamera();
  initHandPose();
}

function draw() {
  background(...CONFIG.colors.background);

  drawVideo();

  if (HandDetector.isDetecting) {
    HandDrawer.drawHands(HandDetector.hands, HandDetector.connections);
  }

  if (AudioEngine.playing) {
    // 감지 중이 아니면 빈 배열을 넘겨 소리만 서서히 줄입니다.
    Instrument.update(HandDetector.isDetecting ? HandDetector.hands : []);
    Instrument.drawOverlay();
  }

  drawStageMessage();
  syncPanel();
  tryAutoStart();
}

function keyPressed() {
  if (key === " ") {
    toggleDetection();
    return false; // 스페이스로 페이지가 스크롤되지 않게
  }

  if (key === "s" || key === "S") {
    HandDrawer.showSkeleton = !HandDrawer.showSkeleton;
    updateButtonLabels();
  }

  if (key === "k" || key === "K") {
    HandDrawer.showLabels = !HandDrawer.showLabels;
    updateButtonLabels();
  }

  if (key === "p" || key === "P") {
    togglePlay();
  }

  return true;
}

/* ------------------------------------------------------------ initialization */

function cacheDom() {
  dom.badge = document.getElementById("status-badge");
  dom.statusText = document.getElementById("status-text");
  dom.handsCount = document.getElementById("hands-count");
  dom.handsList = document.getElementById("hands-list");
  dom.modelInfo = document.getElementById("model-info");
  dom.fileHint = document.getElementById("file-hint");
  dom.noteName = document.getElementById("note-name");
  dom.noteFreq = document.getElementById("note-freq");
  dom.volumeMeter = document.getElementById("volume-meter");
  dom.vibratoMeter = document.getElementById("vibrato-meter");
  dom.octaveValue = document.getElementById("octave-value");
  dom.octaveDown = document.getElementById("octave-down");
  dom.octaveUp = document.getElementById("octave-up");
  dom.playToggle = document.getElementById("play-toggle");
  dom.toggleDetect = document.getElementById("toggle-detect");
  dom.toggleSkeleton = document.getElementById("toggle-skeleton");
  dom.toggleLabel = document.getElementById("toggle-label");
}

function bindUi() {
  dom.toggleDetect.addEventListener("click", toggleDetection);

  dom.toggleSkeleton.addEventListener("click", () => {
    HandDrawer.showSkeleton = !HandDrawer.showSkeleton;
    updateButtonLabels();
  });

  dom.toggleLabel.addEventListener("click", () => {
    HandDrawer.showLabels = !HandDrawer.showLabels;
    updateButtonLabels();
  });

  dom.playToggle.addEventListener("click", togglePlay);
  dom.octaveDown.addEventListener("click", () => changeOctave(-1));
  dom.octaveUp.addEventListener("click", () => changeOctave(1));

  dom.modelInfo.textContent = `handPose · ${CONFIG.handPose.modelType}`;

  // file:// 로 직접 열면 브라우저가 카메라를 막는 경우가 많아 안내를 보여 줍니다.
  if (window.location.protocol === "file:" && dom.fileHint) {
    dom.fileHint.hidden = false;
  }

  updateButtonLabels();
}

function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus("error", "이 브라우저에서는 웹캠을 사용할 수 없습니다.");
    return;
  }

  // 권한 거부/장치 없음 등을 명확한 메시지로 안내하기 위해 먼저 확인합니다.
  navigator.mediaDevices
    .getUserMedia({ video: true, audio: false })
    .then((stream) => {
      stream.getTracks().forEach((track) => track.stop());
      createWebcam();
    })
    .catch((error) => {
      console.error("[HandPose] 웹캠 접근 실패:", error);
      setStatus(
        "error",
        window.location.protocol === "file:"
          ? "file:// 로는 카메라를 쓸 수 없습니다. 로컬 서버를 실행한 뒤 localhost 주소로 접속해 주세요."
          : "웹캠 권한이 필요합니다. 주소창의 카메라 권한을 허용한 뒤 새로고침하세요.",
      );
    });
}

function createWebcam() {
  video = createCapture(VIDEO, () => {
    if (appState.status === "loading") {
      setStatus("loading", "모델을 불러오는 중…");
    }
  });

  video.size(CONFIG.canvas.width, CONFIG.canvas.height);
  video.hide();

  const elt = video.elt;
  if (elt) {
    elt.setAttribute("playsinline", "");
    elt.addEventListener("error", () => {
      setStatus("error", "웹캠을 시작하지 못했습니다. 브라우저 권한을 확인하세요.");
    });
  }
}

/**
 * 모델을 로드합니다.
 * 주의: p5.js 전역 모드에는 `loadModel`(3D 모델 로더)이 이미 있어
 * 같은 이름을 쓰면 p5 쪽 함수로 덮어써집니다. 그래서 initHandPose 로 명명했습니다.
 */
async function initHandPose() {
  try {
    await HandDetector.load();
    if (appState.status === "error") return;
    setStatus("ready", "모델 준비 완료. 곧 감지를 시작합니다.");
  } catch (error) {
    console.error("[HandPose] 모델 로드 실패:", error);
    setStatus("error", "모델을 불러오지 못했습니다. 네트워크와 CDN 상태를 확인하세요.");
  }
}

/* ------------------------------------------------------------ render helpers */

function drawVideo() {
  if (!isVideoReady()) return;

  push();
  if (CONFIG.mirror) {
    // 거울 모드: 영상만 뒤집고, 키포인트도 drawer 에서 같은 기준으로 뒤집습니다.
    translate(width, 0);
    scale(-1, 1);
  }
  image(video, 0, 0, width, height);
  pop();
}

function drawStageMessage() {
  const showMessage = !isVideoReady() || appState.status === "error";
  if (!showMessage) return;

  noStroke();
  fill(0, 0, 0, 170);
  rect(0, 0, width, height);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(16);
  const message =
    appState.status === "error" ? appState.message : "웹캠 영상을 기다리는 중…";
  text(message, width / 2, height / 2);
}

/* ---------------------------------------------------------------- detection */

function isVideoReady() {
  const elt = video?.elt;
  return Boolean(
    elt && elt.readyState >= 2 && elt.videoWidth > 0 && elt.videoHeight > 0,
  );
}

function tryAutoStart() {
  if (HandDetector.isDetecting) return;
  if (appState.status !== "ready") return;
  if (!isVideoReady()) return;
  startDetection();
}

function startDetection() {
  if (!HandDetector.model || !isVideoReady()) return;

  HandDetector.start(video);
  setStatus("detecting", "손을 감지하는 중입니다.");
}

function stopDetection() {
  HandDetector.stop();
  setStatus("stopped", "감지가 정지되었습니다.");
  renderHandsList(HandDetector.hands);
}

function toggleDetection() {
  if (HandDetector.isDetecting) {
    stopDetection();
  } else if (HandDetector.model) {
    startDetection();
  }
}

/* ------------------------------------------------------------------ instrument */

async function togglePlay() {
  if (AudioEngine.playing) {
    AudioEngine.stop();
    Instrument.release();
    updateInstrumentUi();
    return;
  }

  const started = await AudioEngine.start();
  if (!started) {
    setStatus("error", "이 브라우저에서는 오디오를 재생할 수 없습니다.");
    return;
  }

  Instrument.octave = AudioEngine.octave;
  updateInstrumentUi();
}

function changeOctave(delta) {
  Instrument.setOctave(delta);
  updateInstrumentUi();
}

function updateInstrumentUi() {
  const max = CONFIG.instrument.volumeMax || 1;
  const volume = AudioEngine.playing ? Instrument.volume : 0;
  const ratio = Math.min(1, Math.max(0, volume / max));

  dom.volumeMeter.style.width = `${(ratio * 100).toFixed(1)}%`;

  const maxVibrato = CONFIG.instrument.vibrato.maxCents || 1;
  const vibrato = AudioEngine.playing ? Instrument.vibrato : 0;
  const vibratoRatio = Math.min(1, Math.max(0, vibrato / maxVibrato));
  dom.vibratoMeter.style.width = `${(vibratoRatio * 100).toFixed(1)}%`;

  dom.noteName.textContent = AudioEngine.playing && Instrument.active ? Instrument.noteName : "—";

  const freq = AudioEngine.playing && Instrument.frequency ? Math.round(Instrument.frequency) : 0;
  dom.noteFreq.textContent = freq ? `${freq} Hz` : "0 Hz";

  dom.octaveValue.textContent = String(Instrument.octave);
  dom.octaveDown.disabled = Instrument.octave <= CONFIG.instrument.minOctave;
  dom.octaveUp.disabled = Instrument.octave >= CONFIG.instrument.maxOctave;

  dom.playToggle.textContent = AudioEngine.playing ? "연주 정지" : "연주 시작";
  dom.playToggle.classList.toggle("is-playing", AudioEngine.playing);
}

/* ---------------------------------------------------------------- panel sync */

function syncPanel() {
  if (millis() - lastPanelSync < 120) return;
  lastPanelSync = millis();

  const hands = HandDetector.hands;
  dom.handsCount.textContent = String(hands.length);

  // 웹캠/모델이 아직 준비되지 않았으면 시작 버튼을 비활성화합니다.
  dom.toggleDetect.disabled =
    !HandDetector.model || (!HandDetector.isDetecting && !isVideoReady());

  const signature = hands
    .map((hand) => `${HandDrawer.handednessLabel(hand)}:${Math.round(HandDrawer.handConfidence(hand) * 100)}`)
    .join("|");

  if (signature !== lastHandsSignature) {
    lastHandsSignature = signature;
    renderHandsList(hands);
  }

  updateInstrumentUi();
}

function renderHandsList(hands) {
  if (!Array.isArray(hands) || hands.length === 0) {
    dom.handsList.innerHTML =
      '<li class="hand-list__empty">아직 감지된 손이 없습니다.</li>';
    return;
  }

  dom.handsList.innerHTML = hands
    .map((hand, index) => {
      const label = HandDrawer.handednessLabel(hand);
      const confidence = Math.round(HandDrawer.handConfidence(hand) * 100);
      return `<li class="hand-list__item">
        <span class="hand-list__dot"></span>
        <span class="hand-list__name">${index + 1}. ${label}</span>
        <span class="hand-list__value">${confidence}%</span>
      </li>`;
    })
    .join("");
}

/* ------------------------------------------------------------------- 상태 UI */

const STATUS_META = {
  loading: { label: "로딩", className: "badge--loading" },
  ready: { label: "준비", className: "badge--ready" },
  detecting: { label: "감지 중", className: "badge--detecting" },
  stopped: { label: "정지", className: "badge--stopped" },
  error: { label: "오류", className: "badge--error" },
};

function setStatus(status, message) {
  appState.status = status;
  if (typeof message === "string") appState.message = message;

  const meta = STATUS_META[status] || STATUS_META.loading;
  dom.badge.textContent = meta.label;
  dom.badge.className = `badge ${meta.className}`;
  dom.statusText.textContent = appState.message;

  updateButtonLabels();
}

function updateButtonLabels() {
  if (!dom.toggleDetect) return;

  dom.toggleDetect.textContent = HandDetector.isDetecting ? "감지 정지" : "감지 시작";

  dom.toggleSkeleton.textContent = HandDrawer.showSkeleton
    ? "뼈대 표시 끄기"
    : "뼈대 표시 켜기";

  dom.toggleLabel.textContent = HandDrawer.showLabels
    ? "이름 표시 끄기"
    : "이름 표시 켜기";
}
