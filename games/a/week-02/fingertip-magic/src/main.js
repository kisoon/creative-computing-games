import { CONFIG } from './config.js';
import { HandFeatures, SimHand } from './hand.js';
import { Gestures, STATE } from './gestures.js';
import { Game } from './game.js';

const W = 960;
const H = 540;

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const sketch = (p) => {
  let handPose = null;
  let video = null;
  let hands = [];
  let detectSeq = 0;
  let detectTime = -9999;
  let lastSeq = -1;
  let lastFeat = null;
  let featDt = 1 / 30;

  let track, sim, gestures, game, lightG;
  let vm = null;
  let lastT = 0;
  let simOn = false;
  const keys = new Set();
  let booted = false;

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(W, H);
    p.textFont('monospace');

    video = p.createCapture(p.VIDEO);
    video.size(W, H);
    video.hide();

    track = new HandFeatures();
    sim = new SimHand();
    gestures = new Gestures();
    game = new Game(W, H);
    lightG = p.createGraphics(W, H);

    handPose = ml5.handPose({ maxHands: 1, flipped: false });
    startDetection();

    setTimeout(() => {
      if (booted) return;
      const msg = document.querySelector('#boot div');
      if (msg) {
        msg.innerHTML = '웹캠을 시작할 수 없습니다.<br>권한을 허용하거나 <b>K</b>를 눌러<br>시뮬레이션 모드로 실행하세요.';
      }
    }, 6000);

    // 테스트/디버깅용 훅
    window.__magic = {
      gestures, game, config: CONFIG,
      get simOn() { return simOn; },
      get mouse() { return { x: p.mouseX, y: p.mouseY }; },
      get feat() { return lastFeat; },
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  };

  async function startDetection() {
    const boot = document.getElementById('boot');
    try {
      if (handPose.ready) await handPose.ready;
      handPose.detectStart(video, (results) => {
        const now = p.millis();
        if (detectTime > 0) {
          featDt = Math.min(Math.max((now - detectTime) / 1000, 1 / 120), 0.2);
        }
        detectTime = now;
        hands = results || [];
        detectSeq++;
        if (!booted) {
          booted = true;
          boot?.classList.add('hide');
        }
      });
    } catch (err) {
      console.error(err);
      const msg = document.querySelector('#boot div');
      if (msg) msg.textContent = '모델/웹캠 오류: ' + err.message + ' (K: 시뮬레이션 모드)';
    }
  }

  function onKeyDown(e) {
    const k = e.key.toLowerCase();
    keys.add(k);
    if (k === 'k') {
      simOn = !simOn;
      track.reset();
      sim.reset();
      gestures.reset();
      document.getElementById('boot')?.classList.add('hide');
    }
    if (k === 'r') game.reset();
    if (k === 'd') CONFIG.debug = !CONFIG.debug;
  }

  function onKeyUp(e) {
    keys.delete(e.key.toLowerCase());
  }

  // 마우스로 제스처를 흉내내는 모드
  function simPose() {
    const held = (...ks) => ks.every((k) => keys.has(k));
    if (held('s')) {
      return {
        ext: { thumb: true, index: true, middle: true, ring: true, pinky: true },
        openness: 1.6, maxTip: 1.9, isFist: false, isOpen: true,
      };
    }
    if (held('l')) {
      return {
        ext: { thumb: false, index: false, middle: false, ring: false, pinky: false },
        openness: 0.4, maxTip: 0.55, isFist: true, isOpen: false,
      };
    }
    if (held('f')) {
      return {
        ext: { thumb: true, index: true, middle: false, ring: false, pinky: false },
        openness: 0.85, maxTip: 1.35, isFist: false, isOpen: false,
      };
    }
    return {
      ext: { thumb: false, index: false, middle: false, ring: false, pinky: false },
      openness: 0.9, maxTip: 1.0, isFist: false, isOpen: false,
    };
  }

  function updateMapping() {
    const el = video?.elt;
    const vw = el?.videoWidth || 640;
    const vh = el?.videoHeight || 480;
    const scale = Math.max(W / vw, H / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    vm = { scale, dw, dh, ox: (W - dw) / 2, oy: (H - dh) / 2 };
    track.setMapping({ scale, ox: vm.ox, oy: vm.oy, w: W });
  }

  p.draw = () => {
    if (!track) return;

    const now = p.millis();
    const dt = lastT ? Math.min((now - lastT) / 1000, 0.05) : 1 / 60;
    lastT = now;

    updateMapping();

    let f = null;
    if (simOn) {
      f = sim.update(p.mouseX, p.mouseY, simPose(), dt);
      lastFeat = f;
    } else {
      if (detectSeq !== lastSeq) {
        lastSeq = detectSeq;
        const kps = hands[0]?.keypoints;
        lastFeat = kps ? track.update(kps, featDt) : (track.reset(), null);
      }
      const fresh = now - detectTime < 400;
      f = fresh ? lastFeat : null;
    }

    gestures.update(f, dt);
    if (gestures.launched) {
      game.launch(gestures.launched.origin, gestures.launched.dir, gestures.launched.power);
    }
    game.update(dt, f, gestures);

    render(f);
  };

  function render(f) {
    p.background(4, 6, 12);

    // 배경: 좌우 반전된 웹캠 (어둡게)
    if (vm && video?.elt?.readyState >= 2) {
      p.push();
      p.tint(255, 80);
      p.translate(W, 0);
      p.scale(-1, 1);
      p.image(video, vm.ox, vm.oy, vm.dw, vm.dh);
      p.pop();
    }

    game.drawWorld(p);

    const lights = game.getLights(gestures);
    drawDarkness(lights);
    game.drawGlow(p, lights);
    game.drawTop(p, gestures);

    if (CONFIG.debug && f?.kps) drawSkeleton(f.kps);
    if (gestures.state === STATE.CHARGE) drawAim(gestures);

    drawHud(f);
  }

  function drawDarkness(lights) {
    const ctx = lightG.drawingContext;
    lightG.clear();
    lightG.noStroke();
    lightG.fill(2, 4, 10, 228);
    lightG.rect(0, 0, W, H);

    lightG.blendMode(p.REMOVE);
    for (const l of lights) {
      const r = Math.max(l.r, 8);
      const grad = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(0.55, 'rgba(0,0,0,0.72)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(l.x, l.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    lightG.blendMode(p.BLEND);

    p.image(lightG, 0, 0);
  }

  function drawSkeleton(kps) {
    p.push();
    p.noFill();
    p.stroke(90, 220, 255, 160);
    p.strokeWeight(2);
    for (const [a, b] of CONNECTIONS) {
      p.line(kps[a].x, kps[a].y, kps[b].x, kps[b].y);
    }
    p.noStroke();
    for (let i = 0; i < kps.length; i++) {
      const tip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
      p.fill(tip ? 255 : 200, tip ? 190 : 240, 255, 230);
      p.circle(kps[i].x, kps[i].y, tip ? 9 : 5);
    }
    p.pop();
  }

  function drawAim(g) {
    const x = g.palm.x;
    const y = g.palm.y;
    const len = 170;
    const ex = x + g.aim.x * len;
    const ey = y + g.aim.y * len;

    p.push();
    p.stroke(120, 230, 255, 190);
    p.strokeWeight(2);
    p.line(x, y, ex, ey);
    p.noStroke();
    p.fill(120, 230, 255, 220);
    const ang = Math.atan2(g.aim.y, g.aim.x);
    p.push();
    p.translate(ex, ey);
    p.rotate(ang);
    p.triangle(0, 0, -14, -7, -14, 7);
    p.pop();
    p.circle(ex, ey, 6);
    p.pop();
  }

  function drawHud(f) {
    const g = gestures;

    p.push();
    p.noStroke();
    p.fill(8, 14, 24, 165);
    p.rect(12, 12, 250, CONFIG.debug ? 168 : 122, 8);

    p.textSize(13);
    p.fill(140, 220, 255);
    p.text('MAGIC HANDS — MVP', 24, 26);
    p.fill(230, 240, 255);
    p.text(`state  ${g.state}`, 24, 48);
    p.text(`score  ${game.score}`, 24, 66);

    // 충전 바
    const bw = 150;
    p.fill(24, 36, 54);
    p.rect(24, 76, bw, 8, 3);
    p.fill(255, 150, 50);
    p.rect(24, 76, bw * g.charge, 8, 3);

    if (CONFIG.debug) {
      p.fill(140, 165, 195);
      p.textSize(11);
      p.text(`thumb ${(f?.thumbAngle ?? 0).toFixed(0)}° (>${CONFIG.thumbOpenDeg})`, 24, 96);
      p.text(`open  max ${(f?.maxTip ?? 0).toFixed(2)} <${CONFIG.fistMaxTip} / mean ${(f?.openness ?? 0).toFixed(2)} >${CONFIG.openOpenness}`, 24, 112);
      p.text(`aim   ${g.aim.x.toFixed(2)}, ${g.aim.y.toFixed(2)}`, 24, 128);
      p.text(`fps   ${p.frameRate().toFixed(0)}`, 24, 144);
      p.text(simOn ? 'MODE  SIM (K)' : 'MODE  CAMERA', 24, 160);
    } else {
      p.fill(120, 140, 170);
      p.textSize(11);
      p.text(simOn ? 'SIM (K)' : 'CAMERA', 24, 100);
    }
    p.pop();

    if (!f) {
      p.push();
      p.noStroke();
      p.fill(150, 180, 210, 220);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(15);
      p.text('손을 카메라에 보여주세요   (K: 시뮬레이션 모드)', W / 2, H - 44);
      p.pop();
    }

    if (game.toastT > 0) {
      p.push();
      p.noStroke();
      p.fill(255, 210, 130, Math.min(255, game.toastT * 400));
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(18);
      p.text(game.toast, W / 2, H - 90);
      p.pop();
    }
  }
};

new p5(sketch);
