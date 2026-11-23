(() => {
  'use strict';

  /* ================================================================
     기본 도우미
  ================================================================ */
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (t) => t * t * (3 - 2 * t);
  const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  const mod = (n, m) => ((n % m) + m) % m;
  const rgb = (arr) => `rgb(${arr[0] | 0}, ${arr[1] | 0}, ${arr[2] | 0})`;
  const mixArr = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  function approach(v, target, step) {
    if (v < target) return Math.min(v + step, target);
    if (v > target) return Math.max(v - step, target);
    return v;
  }

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

  /* ================================================================
     캔버스 / 상수
  ================================================================ */
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const WORLD_W = 900;
  const WORLD_H = 6400;

  const GRAVITY = 2250;
  const MAX_FALL = 1500;
  const MAX_V = 950;          // 최대 점프 속도 (약 200px 상승)
  const MIN_V = 430;          // 최소 점프 속도
  const CHARGE_TIME = 0.5;    // 최대 차지 시간(초)
  const RUN_SPEED = 270;
  const AIR_SPEED = 250;
  const HALF_W = 14;
  const HALF_H = 18;

  let cssW = 0, cssH = 0, dpr = 1, scale = 1, viewW = 0, viewH = 0;

  function resize() {
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    scale = clamp(Math.min(cssW / 640, cssH / 640), 0.72, 1.55);
    viewW = cssW / scale;
    viewH = cssH / scale;
  }
  window.addEventListener('resize', resize);

  /* ================================================================
     게임 상태
  ================================================================ */
  const state = {
    mode: 'title',   // title | playing | won
    time: 0,
    jumps: 0,
    falls: 0,
    best: 0,
  };

  const keys = { left: false, right: false, jump: false };
  const cam = { x: WORLD_W / 2, y: 0 };

  const MAX_HP = 5;
  let hp = MAX_HP;

  let platforms = [];
  let ground = null;
  let goal = null;
  let levelStartY = WORLD_H - 70;
  let goalY = 220;

  let player = null;
  let particles = [];
  let shake = 0;
  let blink = 0;
  let blinkTimer = 3;
  let airPeak = 0;
  let winTimer = null;
  let respawn = { x: WORLD_W / 2, y: WORLD_H - 100 };
  let activeCheckpoint = null;
  let toastTimer = null;

  /* 세이브 포인트 간격 */
  const CHECKPOINT_GAP = 1150;

  /* 가구 발판 종류 */
  const FURNITURE_TYPES = [
    { kind: 'desk',   min: 116, max: 168, depth: 42 },
    { kind: 'chair',  min: 80,  max: 106, depth: 34 },
    { kind: 'sofa',   min: 146, max: 200, depth: 44 },
    { kind: 'bed',    min: 156, max: 214, depth: 44 },
    { kind: 'shelf',  min: 92,  max: 130, depth: 48 },
    { kind: 'drawer', min: 88,  max: 126, depth: 38 },
    { kind: 'stool',  min: 70,  max: 92,  depth: 30 },
    { kind: 'table',  min: 112, max: 162, depth: 38 },
  ];

  /* ================================================================
     레벨 생성 — 불규칙하지만 점프로 닿을 수 있는 가구 발판
  ================================================================ */
  function generateLevel() {
    platforms = [];
    particles = [];

    ground = { x: -60, y: WORLD_H - 70, w: WORLD_W + 120, h: 70, type: 'ground' };
    levelStartY = ground.y;

    platforms.push(ground);

    let y = ground.y;
    let cx = WORLD_W / 2;
    let lastCheckpointY = ground.y;
    const minTop = 360;

    while (y > minTop) {
      const t = clamp(1 - (y - minTop) / (ground.y - minTop), 0, 1);

      const gap = 72 + Math.random() * 46 + t * 10;
      const ny = y - gap;
      if (ny < minTop) break;

      const type = FURNITURE_TYPES[(Math.random() * FURNITURE_TYPES.length) | 0];
      let w = type.min + Math.random() * (type.max - type.min);
      let depth = type.depth;
      let kind = type.kind;

      const isCheckpoint = lastCheckpointY - ny >= CHECKPOINT_GAP && ny > 620;
      if (isCheckpoint) {
        w = 184 + Math.random() * 26;
        depth = 46;
        kind = Math.random() < 0.5 ? 'desk' : 'table';
        lastCheckpointY = ny;
      }

      let dx = (34 + Math.random() * 92 + t * 14) * (Math.random() < 0.5 ? -1 : 1);
      if (cx + dx < 190) dx = Math.abs(dx) * 0.55;
      if (cx + dx > WORLD_W - 190) dx = -Math.abs(dx) * 0.55;

      const nx = clamp(cx + dx, 42 + w / 2, WORLD_W - 42 - w / 2);

      platforms.push({
        x: nx - w / 2,
        y: ny,
        w,
        h: depth,
        kind,
        variant: (Math.random() * 3) | 0,
        checkpoint: isCheckpoint,
        active: false,
        type: 'furniture',
      });

      cx = nx;
      y = ny;
    }

    const goalW = 210;
    const gy = Math.max(220, y - (100 + Math.random() * 38));
    const gx = clamp(cx + (Math.random() * 170 - 85), 70 + goalW / 2, WORLD_W - 70 - goalW / 2);

    goal = { x: gx - goalW / 2, y: gy, w: goalW, h: 22, type: 'goal' };
    goalY = gy;
    platforms.push(goal);
  }

  function resetPlayer() {
    player = {
      x: WORLD_W / 2,
      y: ground.y - HALF_H,
      vx: 0,
      vy: 0,
      grounded: true,
      charging: false,
      charge: 0,
      facing: 1,
      squash: 0,
    };
    airPeak = player.y;
    respawn = { x: player.x, y: player.y };
    activeCheckpoint = null;
    hp = MAX_HP;
  }

  function progress() {
    const feetY = player.y + HALF_H;
    return clamp((levelStartY - feetY) / (levelStartY - goalY), 0, 1);
  }

  function snapCamera() {
    const tx = viewW >= WORLD_W ? WORLD_W / 2 : clamp(player.x, viewW / 2, WORLD_W - viewW / 2);
    const ty = viewH >= WORLD_H ? WORLD_H / 2 : clamp(player.y - viewH * 0.58, 0, WORLD_H - viewH);
    cam.x = tx;
    cam.y = ty;
  }

  /* ================================================================
     사운드 (WebAudio 미니 신디사이저)
  ================================================================ */
  let actx = null;
  let muted = false;

  function audio() {
    if (!actx) {
      try {
        actx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        actx = null;
      }
    }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }

  function beep(freq, dur, opts = {}) {
    if (muted) return;
    const ac = audio();
    if (!ac) return;
    const { type = 'triangle', vol = 0.05, slideTo = 0, delay = 0 } = opts;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, freq), t0);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    }

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  const sfx = {
    jump(power) {
      beep(240 + power * 130, 0.16, { type: 'triangle', vol: 0.045, slideTo: 620 + power * 300 });
    },
    land(impact) {
      const v = clamp(impact / 1200, 0.25, 1);
      beep(110, 0.09, { type: 'sine', vol: 0.03 + v * 0.035, slideTo: 55 });
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => {
        beep(f, 0.35, { type: 'triangle', vol: 0.04, delay: i * 0.11 });
      });
    },
    start() {
      beep(440, 0.1, { type: 'sine', vol: 0.03 });
      beep(660, 0.14, { type: 'sine', vol: 0.03, delay: 0.08 });
    },
    checkpoint() {
      beep(660, 0.14, { type: 'triangle', vol: 0.04 });
      beep(880, 0.2, { type: 'triangle', vol: 0.04, delay: 0.1 });
      beep(1320, 0.28, { type: 'sine', vol: 0.028, delay: 0.2 });
    },
    hurt() {
      beep(190, 0.2, { type: 'sawtooth', vol: 0.035, slideTo: 80 });
      beep(95, 0.24, { type: 'sine', vol: 0.05, slideTo: 50, delay: 0.02 });
    },
    ko() {
      beep(330, 0.5, { type: 'triangle', vol: 0.04, slideTo: 70 });
      beep(165, 0.6, { type: 'sine', vol: 0.035, slideTo: 45, delay: 0.1 });
    },
  };

  /* ================================================================
     파티클
  ================================================================ */
  function addParticle(p) {
    if (particles.length > 420) particles.shift();
    particles.push(p);
  }

  function spawnDust(x, y, count) {
    for (let i = 0; i < count; i++) {
      addParticle({
        x: x + rand(-14, 14),
        y: y - rand(0, 6),
        vx: rand(-90, 90),
        vy: rand(-160, -30),
        g: 420,
        life: rand(0.3, 0.7),
        maxLife: 0.7,
        size: rand(2, 4.5),
        color: Math.random() < 0.5 ? 'rgba(255,240,215,0.9)' : 'rgba(198,180,150,0.8)',
        shape: 'circle',
        rot: 0,
        vr: 0,
      });
    }
  }

  function spawnJumpPuff(x, y) {
    for (let i = 0; i < 8; i++) {
      addParticle({
        x: x + rand(-10, 10),
        y: y - 2,
        vx: rand(-120, 120),
        vy: rand(-40, 60),
        g: 500,
        life: rand(0.25, 0.5),
        maxLife: 0.5,
        size: rand(1.8, 3.6),
        color: 'rgba(255,224,170,0.85)',
        shape: 'circle',
        rot: 0,
        vr: 0,
      });
    }
  }

  function spawnConfetti(x, y, count) {
    const colors = ['#ffcf6b', '#ff7a5c', '#fff5e1', '#8ce0c8', '#b6a4ff'];
    for (let i = 0; i < count; i++) {
      addParticle({
        x: x + rand(-30, 30),
        y: y + rand(-10, 10),
        vx: rand(-340, 340),
        vy: rand(-620, -180),
        g: 900,
        life: rand(1.6, 3.2),
        maxLife: 3.2,
        size: rand(3, 6),
        color: colors[(Math.random() * colors.length) | 0],
        shape: 'rect',
        rot: rand(0, TAU),
        vr: rand(-8, 8),
      });
    }
  }

  function spawnSparkles(x, y, count) {
    const colors = ['#8ce0c8', '#ffe6a8', '#fff5e1'];
    for (let i = 0; i < count; i++) {
      addParticle({
        x: x + rand(-24, 24),
        y: y + rand(-14, 6),
        vx: rand(-70, 70),
        vy: rand(-150, -40),
        g: -30,
        life: rand(0.6, 1.3),
        maxLife: 1.3,
        size: rand(1.6, 3.6),
        color: colors[(Math.random() * colors.length) | 0],
        shape: 'circle',
        rot: 0,
        vr: 0,
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += p.g * dt;
      p.vx *= 1 - 0.9 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }

  /* ================================================================
     게임 진행
  ================================================================ */
  const startOverlay = document.getElementById('startOverlay');
  const winOverlay = document.getElementById('winOverlay');

  function startGame() {
    if (winTimer) {
      clearTimeout(winTimer);
      winTimer = null;
    }
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
    generateLevel();
    resetPlayer();
    state.mode = 'playing';
    state.time = 0;
    state.jumps = 0;
    state.falls = 0;
    state.best = 0;
    shake = 0;
    blink = 0;
    blinkTimer = rand(2, 4);
    keys.jump = false;
    snapCamera();
    startOverlay.classList.add('hidden');
    winOverlay.classList.add('hidden');
    renderCheckpointMarks();
    renderHearts();
    if (toastEl) {
      toastEl.classList.remove('show');
      clearTimeout(toastTimer);
    }
    updateHud();
    sfx.start();
  }

  function win() {
    if (state.mode !== 'playing') return;
    state.mode = 'won';
    shake = Math.max(shake, 5);
    spawnConfetti(goal.x + goal.w / 2, goal.y - 40, 90);
    sfx.win();

    document.getElementById('resultTime').textContent = formatTime(state.time);
    document.getElementById('resultJumps').textContent = state.jumps;
    document.getElementById('resultFalls').textContent = state.falls;

    winTimer = setTimeout(() => {
      if (state.mode === 'won') winOverlay.classList.remove('hidden');
    }, 700);
  }

  /* ================================================================
     HP / 세이브 포인트
  ================================================================ */
  function renderHearts(pop) {
    if (!heartsEl) return;
    heartsEl.innerHTML = '';
    for (let i = 0; i < MAX_HP; i++) {
      const s = document.createElement('span');
      s.className = 'heart' + (i < hp ? '' : ' empty');
      s.textContent = '♥';
      if (pop && i < hp) s.classList.add('pulse');
      heartsEl.appendChild(s);
    }
  }

  function showToast(msg, kind) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.className = 'show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 1900);
  }

  function flashDamage() {
    if (!damageFlashEl || !damageFlashEl.animate) return;
    damageFlashEl.animate(
      [{ opacity: 0 }, { opacity: 0.9, offset: 0.18 }, { opacity: 0 }],
      { duration: 520, easing: 'ease-out' }
    );
  }

  function activateCheckpoint(p) {
    const isNew = activeCheckpoint !== p;
    const wasHurt = hp < MAX_HP;

    if (activeCheckpoint && activeCheckpoint !== p) {
      activeCheckpoint.active = false;
      if (activeCheckpoint.markEl) activeCheckpoint.markEl.classList.remove('active');
    }

    activeCheckpoint = p;
    p.active = true;
    if (p.markEl) p.markEl.classList.add('active');

    respawn = { x: p.x + p.w / 2, y: p.y - HALF_H };
    hp = MAX_HP;
    renderHearts(isNew || wasHurt);

    if (isNew) {
      spawnSparkles(p.x + p.w / 2, p.y - 10, 20);
      sfx.checkpoint();
      showToast('세이브 포인트 저장 · HP 회복', 'good');
    } else if (wasHurt) {
      sfx.checkpoint();
      showToast('HP 회복', 'good');
    }
  }

  function hurt(dmg) {
    hp = Math.max(0, hp - dmg);
    renderHearts();
    shake = Math.max(shake, 3 + dmg);
    flashDamage();
    sfx.hurt();
    showToast('낙하 피해  -' + dmg + ' HP', 'bad');

    if (hp <= 0) ko();
  }

  function ko() {
    hp = MAX_HP;
    player.x = respawn.x;
    player.y = respawn.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
    player.charging = false;
    player.charge = 0;
    player.squash = 0.9;
    airPeak = player.y;

    shake = 7;
    snapCamera();
    renderHearts(true);
    spawnDust(player.x, player.y + HALF_H, 16);
    sfx.ko();
    flashDamage();
    showToast('기절! 마지막 세이브 포인트로 이동', 'bad');
  }

  function beginCharge() {
    if (state.mode !== 'playing') return;
    if (player.grounded && !player.charging) {
      player.charging = true;
      player.charge = 0;
    }
  }

  function releaseJump() {
    if (state.mode !== 'playing') return;
    if (player.charging && player.grounded) {
      doJump(player.charge);
    }
    player.charging = false;
    player.charge = 0;
  }

  function doJump(power) {
    const v0 = MIN_V + (MAX_V - MIN_V) * Math.pow(power, 0.9);
    player.vy = -v0;
    player.grounded = false;
    player.charging = false;
    player.charge = 0;
    player.squash = -0.35;

    state.jumps++;
    airPeak = player.y;
    shake = Math.max(shake, 1.2 + power * 1.2);
    spawnJumpPuff(player.x, player.y + HALF_H);
    sfx.jump(power);
  }

  function land(p, wasGrounded) {
    const impact = player.vy;
    player.y = p.y - HALF_H;
    player.vy = 0;
    player.grounded = true;

    if (!wasGrounded) {
      const drop = player.y - airPeak;
      const bigFall = drop > 280;

      player.squash = clamp(0.2 + impact / 1500, 0.2, 1);
      shake = Math.max(shake, Math.min(5, impact / 280));
      spawnDust(player.x, p.y, clamp(3 + impact / 130, 3, 12) | 0);
      sfx.land(impact);

      if (state.mode === 'playing') {
        state.best = Math.max(state.best, progress());
      }

      if (p.type === 'goal') {
        win();
      } else if (p.checkpoint) {
        if (bigFall) state.falls++;
        activateCheckpoint(p);
      } else if (bigFall) {
        state.falls++;
        const dmg = Math.min(3, 1 + Math.floor((drop - 280) / 300));
        hurt(dmg);
      }
    }
  }

  /* ================================================================
     업데이트
  ================================================================ */
  function update(dt) {
    const input = state.mode === 'playing';

    if (input) state.time += dt;

    blinkTimer -= dt;
    if (blinkTimer <= 0) {
      blink = 0.12;
      blinkTimer = rand(2.2, 4.6);
    }
    if (blink > 0) blink -= dt;

    const wasGrounded = player.grounded;

    /* --- 좌우 이동 --- */
    let dir = 0;
    if (input) {
      if (keys.left) dir -= 1;
      if (keys.right) dir += 1;
    }
    if (dir !== 0) player.facing = dir;

    const maxSpeed = wasGrounded ? (player.charging ? 145 : RUN_SPEED) : AIR_SPEED;
    if (dir !== 0) {
      const accel = wasGrounded ? 3000 : 1750;
      player.vx = approach(player.vx, dir * maxSpeed, accel * dt);
    } else {
      const damp = wasGrounded ? 2400 : 520;
      player.vx = approach(player.vx, 0, damp * dt);
    }

    /* --- 중력 / 이동 --- */
    player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt);

    const prevBottom = player.y + HALF_H;

    player.x += player.vx * dt;
    player.x = clamp(player.x, 26 + HALF_W, WORLD_W - 26 - HALF_W);

    player.y += player.vy * dt;
    player.grounded = false;

    if (player.vy >= 0) {
      let landing = null;
      for (const p of platforms) {
        if (
          player.x + HALF_W > p.x + 2 &&
          player.x - HALF_W < p.x + p.w - 2 &&
          prevBottom <= p.y + 4 &&
          player.y + HALF_H >= p.y
        ) {
          if (!landing || p.y < landing.y) landing = p;
        }
      }
      if (landing) land(landing, wasGrounded);
    }

    /* --- 차지 & 점프 상태 --- */
    if (player.grounded) {
      if (input && keys.jump) {
        if (!player.charging) {
          player.charging = true;
          player.charge = 0;
        }
      }
    } else if (player.charging) {
      player.charging = false;
      player.charge = 0;
    }

    if (player.charging) {
      player.charge = Math.min(1, player.charge + dt / CHARGE_TIME);
    }

    /* --- 낙하 추적 --- */
    if (!player.grounded) {
      if (wasGrounded) airPeak = player.y;
      else airPeak = Math.min(airPeak, player.y);
    }

    player.squash = approach(player.squash, 0, dt * 3.2);

    /* --- 카메라 --- */
    const targetX = viewW >= WORLD_W ? WORLD_W / 2 : clamp(player.x, viewW / 2, WORLD_W - viewW / 2);
    const targetY =
      viewH >= WORLD_H
        ? WORLD_H / 2
        : clamp(player.y - viewH * 0.58, 0, WORLD_H - viewH);

    const kx = 1 - Math.exp(-9 * dt);
    const ky = 1 - Math.exp(-(player.vy > 700 ? 15 : 9.5) * dt);
    cam.x += (targetX - cam.x) * kx;
    cam.y += (targetY - cam.y) * ky;

    shake = Math.max(0, shake - 22 * dt);

    updateParticles(dt);
  }

  /* ================================================================
     HUD
  ================================================================ */
  const progressFill = document.getElementById('progressFill');
  const progressBestEl = document.getElementById('progressBest');
  const progressText = document.getElementById('progressText');
  const jumpCountEl = document.getElementById('jumpCount');
  const timeTextEl = document.getElementById('timeText');
  const fallCountEl = document.getElementById('fallCount');
  const hintEl = document.getElementById('hint');
  const soundBtn = document.getElementById('soundBtn');
  const cpMarksEl = document.getElementById('cpMarks');
  const heartsEl = document.getElementById('hearts');
  const toastEl = document.getElementById('toast');
  const damageFlashEl = document.getElementById('damageFlash');

  function renderCheckpointMarks() {
    if (!cpMarksEl) return;
    cpMarksEl.innerHTML = '';
    for (const p of platforms) {
      if (!p.checkpoint) continue;
      const mark = document.createElement('span');
      mark.className = 'cp-mark';
      const pr = clamp((levelStartY - p.y) / (levelStartY - goalY), 0, 1);
      mark.style.left = (pr * 100).toFixed(2) + '%';
      cpMarksEl.appendChild(mark);
      p.markEl = mark;
    }
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function updateHud() {
    if (!player) return;
    const p = progress();
    progressFill.style.width = (p * 100).toFixed(1) + '%';
    progressText.textContent = Math.round(p * 100) + '%';
    progressBestEl.style.left = (state.best * 100).toFixed(1) + '%';
    progressBestEl.style.opacity = state.best > 0.01 ? '1' : '0';
    jumpCountEl.textContent = state.jumps;
    timeTextEl.textContent = formatTime(state.time);
    fallCountEl.textContent = state.falls;

    const showHint = state.mode === 'playing' && state.jumps < 2;
    hintEl.classList.toggle('hide', !showHint);
  }

  /* ================================================================
     입력
  ================================================================ */
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space') {
      e.preventDefault();
    }
    if (e.repeat) return;

    switch (e.code) {
      case 'ArrowLeft':
        keys.left = true;
        break;
      case 'ArrowRight':
        keys.right = true;
        break;
      case 'Space':
        if (state.mode === 'title') {
          startGame();
          break;
        }
        if (state.mode === 'won') {
          startGame();
          break;
        }
        keys.jump = true;
        beginCharge();
        break;
      case 'Enter':
        if (state.mode === 'title' || state.mode === 'won') startGame();
        break;
      case 'KeyR':
        if (state.mode !== 'title') startGame();
        break;
      case 'KeyM':
        toggleSound();
        break;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') keys.left = false;
    if (e.code === 'ArrowRight') keys.right = false;
    if (e.code === 'Space') {
      keys.jump = false;
      releaseJump();
    }
  });

  window.addEventListener('blur', () => {
    keys.left = keys.right = keys.jump = false;
    if (player) {
      player.charging = false;
      player.charge = 0;
    }
  });

  function toggleSound() {
    muted = !muted;
    soundBtn.textContent = muted ? '🔇' : '🔊';
    soundBtn.setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
    if (!muted) audio();
  }

  soundBtn.addEventListener('click', toggleSound);
  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('retryBtn').addEventListener('click', startGame);

  /* --- 모바일 터치 조작 --- */
  function bindHold(el, onDown, onUp) {
    let active = false;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (active) return;
      active = true;
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      onDown();
    });
    const end = (e) => {
      if (e) e.preventDefault();
      if (!active) return;
      active = false;
      onUp();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  }

  bindHold(
    document.getElementById('tLeft'),
    () => { keys.left = true; },
    () => { keys.left = false; }
  );
  bindHold(
    document.getElementById('tRight'),
    () => { keys.right = true; },
    () => { keys.right = false; }
  );
  bindHold(
    document.getElementById('tJump'),
    () => { keys.jump = true; beginCharge(); },
    () => { keys.jump = false; releaseJump(); }
  );

  /* ================================================================
     렌더링 — 배경
  ================================================================ */
  const stars = Array.from({ length: 140 }, () => ({
    x: rand(0, 2600),
    y: rand(0, 7000),
    r: rand(0.6, 1.9),
    ph: rand(0, TAU),
  }));

  const clouds = Array.from({ length: 34 }, () => ({
    x: rand(-200, 2500),
    y: rand(-200, 5400),
    s: rand(0.7, 1.6),
    a: rand(0.035, 0.08),
  }));

  const SKY_LOW = { top: [9, 14, 28], mid: [20, 27, 50], bottom: [31, 44, 70] };
  const SKY_HIGH = { top: [46, 32, 82], mid: [118, 60, 104], bottom: [240, 136, 112] };

  function skyAltitude() {
    const p = clamp((levelStartY - (cam.y + viewH * 0.5)) / (levelStartY - goalY), 0, 1);
    return smoothstep(p);
  }

  function drawBackground(t) {
    const alt = skyAltitude();
    const top = mixArr(SKY_LOW.top, SKY_HIGH.top, alt);
    const mid = mixArr(SKY_LOW.mid, SKY_HIGH.mid, alt);
    const bottom = mixArr(SKY_LOW.bottom, SKY_HIGH.bottom, alt);

    const grad = ctx.createLinearGradient(0, 0, 0, cssH);
    grad.addColorStop(0, rgb(top));
    grad.addColorStop(0.52, rgb(mid));
    grad.addColorStop(1, rgb(bottom));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cssW, cssH);

    /* 별 */
    const starAlpha = (1 - alt) * 0.85;
    if (starAlpha > 0.02) {
      for (const s of stars) {
        const sx = mod((s.x - cam.x * 0.25) * scale, cssW + 100) - 50;
        const sy = mod((s.y - cam.y * 0.25) * scale, cssH + 100) - 50;
        const tw = 0.55 + 0.45 * Math.sin(t * 1.6 + s.ph);
        ctx.globalAlpha = starAlpha * tw;
        ctx.fillStyle = '#fdf3da';
        ctx.beginPath();
        ctx.arc(sx, sy, s.r * scale, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    /* 해 */
    const sunX = WORLD_W * 0.72;
    const sunY = goalY - 40;
    const sx = cssW / 2 + (sunX - cam.x) * scale;
    const sy = (sunY - cam.y) * scale;
    const vis = clamp((alt - 0.12) / 0.5, 0, 1);
    if (vis > 0.01 && sy < cssH + 320 && sx > -320 && sx < cssW + 320) {
      ctx.save();
      ctx.globalAlpha = vis;
      const r = 330 * scale;
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      glow.addColorStop(0, 'rgba(255,226,170,0.65)');
      glow.addColorStop(0.28, 'rgba(255,170,120,0.26)');
      glow.addColorStop(1, 'rgba(255,120,90,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
      ctx.fillStyle = 'rgba(255,244,214,0.9)';
      ctx.beginPath();
      ctx.arc(sx, sy, 44 * scale, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    /* 구름 */
    const warm = alt;
    for (const cl of clouds) {
      const cx = mod((cl.x - cam.x * 0.5) * scale, cssW + 700) - 350;
      const cy = (cl.y - cam.y * 0.55) * scale - 180;
      if (cy < -220 || cy > cssH + 220) continue;
      ctx.save();
      ctx.globalAlpha = cl.a * (0.75 + 0.25 * Math.sin(t * 0.5 + cl.x));
      ctx.fillStyle = `rgb(255, ${(244 - warm * 16) | 0}, ${(236 - warm * 40) | 0})`;
      ctx.translate(cx, cy);
      ctx.scale(cl.s * scale, cl.s * scale);
      ctx.beginPath();
      ctx.ellipse(-38, 2, 40, 17, 0, 0, TAU);
      ctx.ellipse(2, -7, 50, 23, 0, 0, TAU);
      ctx.ellipse(46, 4, 36, 16, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(
      cssW / 2, cssH * 0.45, Math.min(cssW, cssH) * 0.34,
      cssW / 2, cssH * 0.5, Math.max(cssW, cssH) * 0.78
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);
  }

  /* ================================================================
     렌더링 — 발판 / 깃발
  ================================================================ */
  function inView(p) {
    return p.y + p.h > cam.y - 80 && p.y < cam.y + viewH + 80;
  }

  function drawGoalGlow(t) {
    const cx = goal.x + goal.w / 2;
    const g = ctx.createLinearGradient(0, goal.y - 760, 0, goal.y + 30);
    g.addColorStop(0, 'rgba(255,205,130,0)');
    g.addColorStop(0.72, 'rgba(255,205,130,0.08)');
    g.addColorStop(1, 'rgba(255,225,160,0.2)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - 92, goal.y + 26);
    ctx.lineTo(cx - 24, goal.y - 780);
    ctx.lineTo(cx + 24, goal.y - 780);
    ctx.lineTo(cx + 92, goal.y + 26);
    ctx.closePath();
    ctx.fill();

    /* 반짝임 */
    for (let i = 0; i < 6; i++) {
      const ph = t * 1.4 + i * 1.7;
      const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(ph));
      const px = cx + Math.sin(i * 2.1) * 96 + Math.sin(ph * 0.7) * 8;
      const py = goal.y - 26 - ((i * 37 + t * 22) % 150);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffe6a8';
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFlag(t) {
    const px = goal.x + goal.w / 2;
    const topY = goal.y - 78;
    const wave = Math.sin(t * 3.4) * 4;

    ctx.strokeStyle = '#42324c';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px, goal.y + 2);
    ctx.lineTo(px, topY);
    ctx.stroke();

    ctx.fillStyle = '#ffcf6b';
    ctx.beginPath();
    ctx.moveTo(px + 2, topY + 1);
    ctx.quadraticCurveTo(px + 34, topY + 8 + wave, px + 58, topY + 19);
    ctx.quadraticCurveTo(px + 34, topY + 30 - wave, px + 2, topY + 38);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,247,222,0.85)';
    ctx.beginPath();
    ctx.arc(px, topY - 2, 4, 0, TAU);
    ctx.fill();
  }

  const WOODS = [
    { top: '#f4d9ac', body: '#d3a56d', dark: '#94663b' },
    { top: '#eccaa0', body: '#c08f5c', dark: '#7f5733' },
    { top: '#f8e1ba', body: '#ddb47c', dark: '#a07244' },
  ];

  const FABRICS = [
    { top: '#a9dfd4', body: '#6cb4a6', dark: '#46877b', light: '#c9ede5' },
    { top: '#ffc8bb', body: '#f29488', dark: '#bc6a61', light: '#ffdfd8' },
    { top: '#d8ddaa', body: '#a5b077', dark: '#79854f', light: '#ebefcb' },
  ];

  const BOOK_COLORS = ['#ff8a7a', '#7fc4b6', '#ffcf6b', '#b6a4ff', '#e9d8b0', '#f09a5c'];

  function drawFurnitureShadow(p) {
    ctx.fillStyle = 'rgba(3,6,13,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x + p.w / 2 + 3, p.y + p.h + 1, p.w * 0.46, 5.5, 0, 0, TAU);
    ctx.fill();
  }

  function drawLeg(x, y, w, h, color) {
    ctx.fillStyle = color;
    rr(x, y, w, h, 2.5);
    ctx.fill();
  }

  function drawTopSlab(p, topColor, bottomColor, thickness) {
    const g = ctx.createLinearGradient(0, p.y, 0, p.y + thickness);
    g.addColorStop(0, topColor);
    g.addColorStop(1, bottomColor);
    ctx.fillStyle = g;
    rr(p.x, p.y, p.w, thickness, 4.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    rr(p.x + 4, p.y + 2, p.w - 8, 2.2, 1.1);
    ctx.fill();
  }

  function drawGround(p) {
    const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
    g.addColorStop(0, '#3c4a64');
    g.addColorStop(1, '#161e30');
    ctx.fillStyle = g;
    ctx.fillRect(p.x, p.y, p.w, p.h);

    ctx.fillStyle = 'rgba(160,190,220,0.32)';
    ctx.fillRect(p.x, p.y, p.w, 3);

    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    for (let x = p.x + 70; x < p.x + p.w; x += 86) {
      ctx.beginPath();
      ctx.moveTo(x, p.y + 8);
      ctx.lineTo(x, p.y + p.h);
      ctx.stroke();
    }
  }

  function drawGoalPlatform(p, t) {
    const cx = p.x + p.w / 2;
    const glow = ctx.createRadialGradient(cx, p.y + 4, 4, cx, p.y + 4, 180);
    glow.addColorStop(0, 'rgba(255,210,130,0.4)');
    glow.addColorStop(1, 'rgba(255,210,130,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, p.y + 4, 180, 0, TAU);
    ctx.fill();

    drawFurnitureShadow(p);

    drawLeg(p.x + 15, p.y + 12, 9, p.h - 12, '#b98436');
    drawLeg(p.x + p.w - 24, p.y + 12, 9, p.h - 12, '#b98436');

    const g = ctx.createLinearGradient(0, p.y, 0, p.y + 16);
    g.addColorStop(0, '#fff2c4');
    g.addColorStop(0.55, '#ffd984');
    g.addColorStop(1, '#dda347');
    ctx.fillStyle = g;
    rr(p.x, p.y, p.w, 16, 6);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    rr(p.x + 5, p.y + 2.5, p.w - 10, 2.6, 1.3);
    ctx.fill();

    ctx.fillStyle = 'rgba(150,100,40,0.22)';
    rr(p.x + 3, p.y + p.h - 4, p.w - 6, 3, 1.5);
    ctx.fill();

    drawFlag(t);
  }

  /* ---- 가구 그리기 ---- */

  function drawDesk(p) {
    const wood = WOODS[p.variant % 3];
    const fab = FABRICS[p.variant % 3];

    drawLeg(p.x + 11, p.y + 10, 8, p.h - 12, wood.dark);
    drawLeg(p.x + p.w - 19, p.y + 10, 8, p.h - 12, wood.dark);

    const dw = Math.min(58, p.w * 0.42);
    ctx.fillStyle = wood.body;
    rr(p.x + p.w * 0.42, p.y + 10, dw, 15, 3);
    ctx.fill();
    ctx.fillStyle = wood.dark;
    ctx.beginPath();
    ctx.arc(p.x + p.w * 0.42 + dw / 2, p.y + 17.5, 2, 0, TAU);
    ctx.fill();

    drawTopSlab(p, wood.top, wood.body, 12);

    /* 책 한 권 */
    ctx.fillStyle = fab.body;
    rr(p.x + 14, p.y - 4, 24, 4.5, 1.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,250,235,0.75)';
    ctx.fillRect(p.x + 16, p.y - 3.2, 20, 1.2);
  }

  function drawChair(p) {
    const wood = WOODS[p.variant % 3];
    const fab = FABRICS[p.variant % 3];

    drawLeg(p.x + 9, p.y + 9, 6, p.h - 10, wood.dark);
    drawLeg(p.x + p.w - 15, p.y + 9, 6, p.h - 10, wood.dark);

    /* 등받이 */
    ctx.fillStyle = fab.body;
    rr(p.x + 3, p.y - 25, 11, 35, 4);
    ctx.fill();
    ctx.fillStyle = fab.top;
    rr(p.x + 5, p.y - 22, 7, 27, 3);
    ctx.fill();

    drawTopSlab(p, fab.top, fab.body, 11);

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x + 6, p.y + 6);
    ctx.lineTo(p.x + p.w - 6, p.y + 6);
    ctx.stroke();
  }

  function drawSofa(p) {
    const fab = FABRICS[p.variant % 3];

    drawLeg(p.x + 13, p.y + p.h - 9, 8, 9, '#6b4b32');
    drawLeg(p.x + p.w - 21, p.y + p.h - 9, 8, 9, '#6b4b32');

    const body = ctx.createLinearGradient(0, p.y + 10, 0, p.y + p.h);
    body.addColorStop(0, fab.body);
    body.addColorStop(1, fab.dark);
    ctx.fillStyle = body;
    rr(p.x + 2, p.y + 10, p.w - 4, p.h - 16, 8);
    ctx.fill();

    const seat = ctx.createLinearGradient(0, p.y, 0, p.y + 14);
    seat.addColorStop(0, fab.top);
    seat.addColorStop(1, fab.body);
    ctx.fillStyle = seat;
    rr(p.x + 7, p.y + 1, p.w - 14, 13, 5);
    ctx.fill();

    ctx.strokeStyle = 'rgba(70,50,45,0.2)';
    ctx.lineWidth = 1.2;
    for (let k = 1; k <= 2; k++) {
      const sx = p.x + 7 + ((p.w - 14) * k) / 3;
      ctx.beginPath();
      ctx.moveTo(sx, p.y + 3);
      ctx.lineTo(sx, p.y + 12);
      ctx.stroke();
    }

    /* 팔걸이 */
    ctx.fillStyle = fab.body;
    rr(p.x, p.y - 8, 15, 21, 6);
    ctx.fill();
    rr(p.x + p.w - 15, p.y - 8, 15, 21, 6);
    ctx.fill();
    ctx.fillStyle = fab.top;
    rr(p.x + 2, p.y - 6, 11, 4, 2);
    ctx.fill();
    rr(p.x + p.w - 13, p.y - 6, 11, 4, 2);
    ctx.fill();
  }

  function drawBed(p) {
    const wood = WOODS[p.variant % 3];
    const fab = FABRICS[(p.variant + 1) % 3];

    drawLeg(p.x + 10, p.y + 9, 8, p.h - 12, wood.dark);
    drawLeg(p.x + p.w - 18, p.y + 9, 8, p.h - 12, wood.dark);

    ctx.fillStyle = wood.body;
    rr(p.x + 2, p.y + 9, p.w - 4, p.h - 12, 5);
    ctx.fill();

    const mattress = ctx.createLinearGradient(0, p.y, 0, p.y + 13);
    mattress.addColorStop(0, '#fffaf0');
    mattress.addColorStop(1, '#eadcc2');
    ctx.fillStyle = mattress;
    rr(p.x + 4, p.y, p.w - 8, 13, 5);
    ctx.fill();

    ctx.fillStyle = fab.top;
    rr(p.x + p.w * 0.32, p.y + 1, p.w * 0.64, 12, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(p.x + p.w * 0.4, p.y + 1.5);
    ctx.lineTo(p.x + p.w * 0.4, p.y + 12);
    ctx.stroke();

    ctx.fillStyle = '#fffdf6';
    rr(p.x + 10, p.y - 6, 38, 11, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,160,140,0.4)';
    ctx.beginPath();
    ctx.moveTo(p.x + 16, p.y - 1);
    ctx.lineTo(p.x + 42, p.y - 1);
    ctx.stroke();
  }

  function drawShelf(p) {
    const wood = WOODS[(p.variant + 1) % 3];

    ctx.fillStyle = wood.body;
    rr(p.x + 3, p.y + 8, p.w - 6, p.h - 8, 4);
    ctx.fill();
    ctx.strokeStyle = wood.dark;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    drawTopSlab(p, wood.top, wood.body, 10);

    const innerX = p.x + 8;
    const innerW = p.w - 16;
    const top = p.y + 17;
    const shelfH = p.h - 21;

    for (let row = 0; row < 2; row++) {
      const lineY = top + (shelfH * (row + 1)) / 2;

      ctx.strokeStyle = wood.dark;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(innerX, lineY);
      ctx.lineTo(innerX + innerW, lineY);
      ctx.stroke();

      let bx = innerX + 2;
      let k = 0;
      while (bx < innerX + innerW - 5) {
        const bw = 4 + ((p.variant + k * 3 + row * 5) % 4);
        const bh = 7 + ((p.variant + k * 7 + row * 2) % 5);
        ctx.fillStyle = BOOK_COLORS[(p.variant + k + row * 2) % BOOK_COLORS.length];
        ctx.fillRect(bx, lineY - bh, bw, bh);
        bx += bw + 2.2;
        k++;
      }
    }

    ctx.fillStyle = wood.dark;
    ctx.fillRect(p.x + 4, p.y + 8, 2, p.h - 8);
    ctx.fillRect(p.x + p.w - 6, p.y + 8, 2, p.h - 8);
  }

  function drawDrawer(p) {
    const wood = WOODS[p.variant % 3];

    ctx.fillStyle = wood.body;
    rr(p.x + 4, p.y + 9, p.w - 8, p.h - 9, 5);
    ctx.fill();
    ctx.strokeStyle = wood.dark;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    drawTopSlab(p, wood.top, wood.body, 10);

    const rx = p.x + 10;
    const rw = p.w - 20;
    const areaY = p.y + 14;
    const areaH = p.h - 20;
    const gap = 3;
    const rh = (areaH - gap) / 2;

    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = i === 0 ? wood.top : wood.body;
      rr(rx, areaY + i * (rh + gap), rw, rh, 2);
      ctx.fill();
      ctx.fillStyle = wood.dark;
      ctx.beginPath();
      ctx.arc(rx + rw / 2, areaY + i * (rh + gap) + rh / 2, 1.8, 0, TAU);
      ctx.fill();
    }

    /* 화분 */
    const px = p.x + p.w - 24;
    ctx.fillStyle = '#9a6b45';
    rr(px, p.y - 10, 9, 9, 2);
    ctx.fill();
    ctx.fillStyle = '#71b88c';
    ctx.beginPath();
    ctx.arc(px + 2, p.y - 12, 3.4, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + 7, p.y - 13, 3.4, 0, TAU);
    ctx.fill();
  }

  function drawStool(p) {
    const wood = WOODS[p.variant % 3];
    const fab = FABRICS[p.variant % 3];

    ctx.strokeStyle = wood.dark;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x + 12, p.y + 8);
    ctx.lineTo(p.x + 8, p.y + p.h);
    ctx.moveTo(p.x + p.w - 12, p.y + 8);
    ctx.lineTo(p.x + p.w - 8, p.y + p.h);
    ctx.stroke();

    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p.x + 10, p.y + p.h - 7);
    ctx.lineTo(p.x + p.w - 10, p.y + p.h - 7);
    ctx.stroke();

    drawTopSlab(p, fab.top, fab.body, 10);
  }

  function drawTable(p) {
    const wood = WOODS[p.variant % 3];

    drawLeg(p.x + 11, p.y + 10, 7, p.h - 12, wood.dark);
    drawLeg(p.x + p.w - 18, p.y + 10, 7, p.h - 12, wood.dark);
    drawLeg(p.x + p.w * 0.5 - 3, p.y + 10, 6, p.h - 14, wood.dark);

    ctx.fillStyle = wood.dark;
    rr(p.x + 15, p.y + p.h - 12, p.w - 30, 3, 1.5);
    ctx.fill();

    drawTopSlab(p, wood.top, wood.body, 11);

    /* 머그컵 */
    const mx = p.x + p.w - 28;
    ctx.fillStyle = '#fff6e6';
    rr(mx, p.y - 7, 9, 8, 2);
    ctx.fill();
    ctx.strokeStyle = '#fff6e6';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(mx + 11, p.y - 3, 3, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();
    ctx.fillStyle = '#b9793f';
    ctx.fillRect(mx + 1.5, p.y - 6.2, 6, 1.4);
  }

  /* ---- 세이브 포인트 ---- */

  function drawCheckpointAura(p, t) {
    const active = !!p.active;
    const rgb = active ? '255,205,110' : '140,224,200';
    const cx = p.x + p.w / 2;

    const beam = ctx.createLinearGradient(0, p.y - 360, 0, p.y + 4);
    beam.addColorStop(0, `rgba(${rgb},0)`);
    beam.addColorStop(0.62, `rgba(${rgb},0.045)`);
    beam.addColorStop(1, `rgba(${rgb},${active ? 0.2 : 0.12})`);
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(cx - 82, p.y + 4);
    ctx.lineTo(cx - 22, p.y - 360);
    ctx.lineTo(cx + 22, p.y - 360);
    ctx.lineTo(cx + 82, p.y + 4);
    ctx.closePath();
    ctx.fill();

    const ring = ctx.createRadialGradient(cx, p.y, 2, cx, p.y, 80);
    ring.addColorStop(0, `rgba(${rgb},0.22)`);
    ring.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.ellipse(cx, p.y, 80, 18, 0, 0, TAU);
    ctx.fill();
  }

  function drawCheckpointLamp(p, t) {
    const active = !!p.active;
    const col = active ? '#ffcf6b' : '#8ce0c8';
    const rgb = active ? '255,207,107' : '140,224,200';
    const lx = p.x + 16;
    const baseY = p.y;

    const glow = ctx.createRadialGradient(lx, baseY - 27, 0, lx, baseY - 27, 28);
    glow.addColorStop(0, `rgba(${rgb},0.4)`);
    glow.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lx, baseY - 27, 28, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = '#4b3a33';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lx, baseY);
    ctx.lineTo(lx, baseY - 25);
    ctx.stroke();

    ctx.fillStyle = '#4b3a33';
    ctx.beginPath();
    ctx.ellipse(lx, baseY, 7, 2.5, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(lx - 7, baseY - 24);
    ctx.lineTo(lx + 7, baseY - 24);
    ctx.lineTo(lx + 4.5, baseY - 33);
    ctx.lineTo(lx - 4.5, baseY - 33);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,240,0.9)';
    ctx.beginPath();
    ctx.arc(lx, baseY - 23, 2.2, 0, TAU);
    ctx.fill();

    for (let i = 0; i < 3; i++) {
      const ph = t * 1.6 + i * 2.1;
      const sx = lx + Math.sin(ph) * 11;
      const sy = baseY - 40 - ((t * 16 + i * 22) % 46);
      ctx.globalAlpha = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(ph * 1.6));
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlatform(p, t) {
    if (p.type === 'ground') {
      drawGround(p);
      return;
    }
    if (p.type === 'goal') {
      drawGoalPlatform(p, t);
      return;
    }

    if (p.checkpoint) drawCheckpointAura(p, t);
    drawFurnitureShadow(p);

    switch (p.kind) {
      case 'chair':
        drawChair(p);
        break;
      case 'sofa':
        drawSofa(p);
        break;
      case 'bed':
        drawBed(p);
        break;
      case 'shelf':
        drawShelf(p);
        break;
      case 'drawer':
        drawDrawer(p);
        break;
      case 'stool':
        drawStool(p);
        break;
      case 'table':
        drawTable(p);
        break;
      default:
        drawDesk(p);
    }

    if (p.checkpoint) drawCheckpointLamp(p, t);
  }

  /* ================================================================
     렌더링 — 플레이어 / 파티클 / 궤적
  ================================================================ */
  function drawParticles() {
    for (const p of particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.7);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawTrajectory() {
    if (!player.charging || !player.grounded) return;
    const v0 = MIN_V + (MAX_V - MIN_V) * Math.pow(player.charge, 0.9);
    const vx = player.vx;

    for (let i = 1; i <= 16; i++) {
      const tt = i * 0.048;
      const px = player.x + vx * tt;
      const py = player.y - v0 * tt + 0.5 * GRAVITY * tt * tt;
      if (py > WORLD_H || px < 0 || px > WORLD_W) break;
      const a = 0.55 * (1 - i / 18);
      ctx.globalAlpha = a;
      ctx.fillStyle = i / 16 < player.charge ? '#ffe6a8' : '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, i === 1 ? 3 : 2.3, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer(t) {
    const sq = player.squash;
    const airStretch = player.grounded ? 0 : clamp(Math.abs(player.vy) / 2600, 0, 0.14);

    let sx = 1 - airStretch * 0.55;
    let sy = 1 + airStretch;

    if (player.charging) {
      sx += player.charge * 0.14;
      sy -= player.charge * 0.16;
    }
    if (sq > 0) {
      sx += sq * 0.28;
      sy -= sq * 0.25;
    } else {
      sx -= -sq * 0.1;
      sy += -sq * 0.18;
    }
    if (player.grounded && !player.charging) sy += Math.sin(t * 3) * 0.012;

    /* 바닥 그림자 */
    if (player.grounded) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(player.x, player.y + HALF_H + 2, HALF_W * 1.15, 4, 0, 0, TAU);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(player.x, player.y + HALF_H);
    ctx.scale(sx, sy);

    const bh = HALF_H * 2;
    const dir = -player.facing;
    const sway = Math.sin(t * 4) * 2 + (player.charging ? Math.sin(t * 20) * 2.2 * player.charge : 0);
    const lid = blink > 0 ? 0.14 : 1;

    /* 꼬리 */
    ctx.strokeStyle = '#e09055';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(dir * 7, -8);
    ctx.quadraticCurveTo(dir * 25, -7 + sway, dir * 21, -26 - sway * 0.5);
    ctx.stroke();

    /* 몸통 */
    const fur = ctx.createLinearGradient(0, -bh, 0, 0);
    fur.addColorStop(0, '#ffd79f');
    fur.addColorStop(0.6, '#ffb672');
    fur.addColorStop(1, '#f39a58');
    ctx.fillStyle = fur;
    rr(-HALF_W, -bh, HALF_W * 2, bh, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,60,30,0.25)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    /* 배 */
    ctx.fillStyle = 'rgba(255,246,224,0.8)';
    ctx.beginPath();
    ctx.ellipse(0, -9, 8, 9.5, 0, 0, TAU);
    ctx.fill();

    /* 앞발 */
    ctx.fillStyle = '#fff1d6';
    rr(-11, -5, 8, 5, 2.5);
    ctx.fill();
    rr(3, -5, 8, 5, 2.5);
    ctx.fill();

    /* 귀 */
    const earWiggle = player.charging ? Math.sin(t * 24) * 0.8 * player.charge : 0;
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#ffc17c';
      ctx.beginPath();
      ctx.moveTo(s * 5, -34);
      ctx.lineTo(s * (14 + earWiggle * s), -45.5);
      ctx.lineTo(s * 15, -33);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,60,30,0.25)';
      ctx.lineWidth = 1.3;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,150,155,0.8)';
      ctx.beginPath();
      ctx.moveTo(s * 7.5, -34.5);
      ctx.lineTo(s * (12.6 + earWiggle * s), -42.6);
      ctx.lineTo(s * 13, -34.5);
      ctx.closePath();
      ctx.fill();
    }

    /* 이마 줄무늬 */
    ctx.strokeStyle = 'rgba(207,120,62,0.8)';
    ctx.lineWidth = 1.7;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 5, -35);
      ctx.lineTo(i * 5 + i * 0.5, -31);
      ctx.stroke();
    }

    /* 눈 */
    const eyeY = -25;
    const look = clamp(player.vx / 320, -1, 1);

    ctx.fillStyle = '#fffdf4';
    ctx.beginPath();
    ctx.ellipse(-5.4, eyeY, 4.2, 4.4 * lid, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(5.4, eyeY, 4.2, 4.4 * lid, 0, 0, TAU);
    ctx.fill();

    /* 고양이 세로 동공 */
    ctx.fillStyle = '#3b2a2c';
    ctx.beginPath();
    ctx.ellipse(-5.4 + look * 1.2, eyeY + 0.5, 1.3, 3.9 * lid, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(5.4 + look * 1.2, eyeY + 0.5, 1.3, 3.9 * lid, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(-5.4 + look * 1.2 + 0.7, eyeY - 1.4, 0.9, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5.4 + look * 1.2 + 0.7, eyeY - 1.4, 0.9, 0, TAU);
    ctx.fill();

    /* 볼 */
    ctx.fillStyle = 'rgba(255,130,130,0.3)';
    ctx.beginPath();
    ctx.arc(-9.3, eyeY + 6, 2.2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(9.3, eyeY + 6, 2.2, 0, TAU);
    ctx.fill();

    /* 코 */
    ctx.fillStyle = '#ff8fa3';
    ctx.beginPath();
    ctx.moveTo(-2.3, -17.6);
    ctx.lineTo(2.3, -17.6);
    ctx.lineTo(0, -15.4);
    ctx.closePath();
    ctx.fill();

    /* 수염 */
    ctx.strokeStyle = 'rgba(120,70,40,0.42)';
    ctx.lineWidth = 1;
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(s * 8.5, -18.5 + k * 1.5);
        ctx.lineTo(s * 19, -20.5 + k * 2.6);
        ctx.stroke();
      }
    }

    /* 입 */
    if (player.charging) {
      ctx.fillStyle = 'rgba(80,40,45,0.75)';
      ctx.beginPath();
      ctx.ellipse(0, -13.4, 1.5, 1.9, 0, 0, TAU);
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(120,60,50,0.65)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -15.2);
      ctx.quadraticCurveTo(-1.5, -13.5, -3, -14.9);
      ctx.moveTo(0, -15.2);
      ctx.quadraticCurveTo(1.5, -13.5, 3, -14.9);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawChargeBar(t) {
    if (!player.charging) return;

    const bw = 54;
    const bh = 8;
    const bx = player.x - bw / 2;
    const by = player.y - HALF_H - 32;
    const full = player.charge >= 0.999;

    ctx.fillStyle = 'rgba(8,12,24,0.6)';
    rr(bx, by, bw, bh, 4);
    ctx.fill();

    if (player.charge > 0.01) {
      const cw = Math.max(3, (bw - 3) * player.charge);
      ctx.fillStyle = `hsl(${140 - 125 * player.charge}, 88%, ${60 + (full ? 6 * Math.sin(t * 14) : 0)}%)`;
      rr(bx + 1.5, by + 1.5, cw, bh - 3, 2.5);
      ctx.fill();
    }

    if (full) {
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 14);
      ctx.strokeStyle = '#ffe6a8';
      ctx.lineWidth = 1.5;
      rr(bx - 2, by - 2, bw + 4, bh + 4, 5);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /* ================================================================
     메인 루프
  ================================================================ */
  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    drawBackground(t);

    const shakeX = shake > 0.05 ? rand(-shake, shake) : 0;
    const shakeY = shake > 0.05 ? rand(-shake, shake) : 0;

    ctx.save();
    ctx.translate(cssW / 2 + shakeX, shakeY);
    ctx.scale(scale, scale);
    ctx.translate(-cam.x, -cam.y);

    drawGoalGlow(t);

    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      if (inView(p)) drawPlatform(p, t);
    }

    drawTrajectory();
    drawParticles();
    drawPlayer(t);
    drawChargeBar(t);

    ctx.restore();
    drawVignette();
  }

  const STEP = 1 / 120;
  let last = performance.now();
  let acc = 0;

  function frame(now) {
    let delta = (now - last) / 1000;
    last = now;
    if (delta < 0) delta = 0;
    if (delta > 0.05) delta = 0.05;

    acc += delta;
    let guard = 0;
    while (acc >= STEP && guard++ < 8) {
      update(STEP);
      acc -= STEP;
    }

    draw(now / 1000);
    updateHud();
    requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', () => {
    last = performance.now();
    acc = 0;
  });

  /* ================================================================
     시작
  ================================================================ */
  resize();
  generateLevel();
  resetPlayer();
  snapCamera();
  renderCheckpointMarks();
  renderHearts();
  updateHud();

  requestAnimationFrame(frame);
})();
