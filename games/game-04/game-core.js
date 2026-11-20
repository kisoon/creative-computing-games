/* =========================================================
   해골 기사 : 초원의 나무 괴물
   game-core.js — 상태 · 전투 · 사운드
   ========================================================= */
'use strict';

const W = 960;
const H = 540;
const GROUND = 456;
const TAU = Math.PI * 2;

const SKILL = {
  q: { cd: 1.0, dmg: 5, range: 112 },
  e: { cd: 3.0, dmg: 10, range: 150 }
};

/* ---------- 유틸 ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;
const easeOutBack = (t) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/* ---------- 게임 상태 ---------- */
const game = {
  state: 'title',      // title | playing | victory | defeat
  stateTime: 0,
  time: 0,
  paused: false,
  elapsed: 0,
  shake: 0,
  hitstop: 0,
  flash: 0,
  over: null,
  toast: null
};

const player = {
  x: 300, facing: 1,
  hp: 100, maxHp: 100, displayHp: 100, ghostHp: 100,
  attack: null,
  cooldowns: { q: 0, e: 0 },
  iframes: 0,
  walkPhase: 0,
  moving: false,
  dead: false,
  deathT: 0,
  hurtFlash: 0
};

const monster = {
  x: 690, facing: -1,
  hp: 50, maxHp: 50, displayHp: 50, ghostHp: 50,
  state: 'chase',
  timer: 0, windupDur: 0.68,
  nextAttack: 2.4,
  contactCd: 0,
  hurtFlash: 0,
  walkPhase: 0,
  enraged: false,
  attackHit: false,
  dead: false,
  deathT: 0
};

const keys = new Set();
const touch = { left: false, right: false };
const particles = [];
const numbers = [];
const effects = [];

/* ---------- 사운드 (WebAudio) ---------- */
const Sound = (() => {
  let ac = null;
  let master = null;
  let enabled = true;

  function ensure() {
    if (!enabled) return;
    try {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ac = new AC();
        master = ac.createGain();
        master.gain.value = 0.25;
        master.connect(ac.destination);
      }
      if (ac.state === 'suspended') ac.resume();
    } catch (e) { /* 오디오 미지원 환경 무시 */ }
  }

  function tone(freq, freq2, dur, type, vol, delay) {
    if (!enabled || !ac) return;
    const t0 = ac.currentTime + (delay || 0);
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (freq2) o.frequency.exponentialRampToValueAtTime(Math.max(24, freq2), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  function noise(dur, vol, f0, f1, q) {
    if (!enabled || !ac) return;
    const n = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, ac.currentTime);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), ac.currentTime + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  return {
    init: ensure,
    get enabled() { return enabled; },
    toggle() {
      enabled = !enabled;
      if (master) master.gain.value = enabled ? 0.25 : 0;
      if (enabled) ensure();
      return enabled;
    },
    swing() { ensure(); noise(0.16, 0.5, 1400, 320, 1.2); tone(320, 140, 0.1, 'sawtooth', 0.05); },
    thrust() { ensure(); noise(0.2, 0.55, 2200, 700, 1.5); tone(480, 180, 0.16, 'square', 0.045); },
    hit(heavy) {
      ensure();
      noise(heavy ? 0.2 : 0.1, heavy ? 0.6 : 0.4, heavy ? 700 : 1000, 120, 0.8);
      tone(heavy ? 120 : 170, 55, heavy ? 0.18 : 0.1, 'square', heavy ? 0.16 : 0.1);
    },
    hurt() { ensure(); tone(300, 110, 0.26, 'sawtooth', 0.14); noise(0.12, 0.25, 800, 200, 0.7); },
    denied() { ensure(); tone(180, 140, 0.06, 'square', 0.05); },
    windup() { ensure(); tone(220, 330, 0.2, 'triangle', 0.06); },
    slam() { ensure(); noise(0.3, 0.5, 500, 90, 0.8); tone(95, 42, 0.32, 'square', 0.16); },
    roar() {
      ensure();
      tone(140, 60, 0.6, 'sawtooth', 0.16);
      tone(210, 90, 0.5, 'sawtooth', 0.08, 0.05);
      noise(0.5, 0.2, 300, 80, 0.6);
    },
    victory() { ensure(); [523, 659, 784, 1047].forEach((f, i) => tone(f, f * 1.01, 0.3, 'triangle', 0.12, i * 0.11)); },
    defeat() { ensure(); [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.98, 0.45, 'sine', 0.13, i * 0.15)); }
  };
})();

/* ---------- 상태 전환 ---------- */
function setState(s) {
  game.state = s;
  game.stateTime = 0;
}

function toast(text, dur) {
  game.toast = { text, t: dur || 1.6, max: dur || 1.6 };
}

function resetGame() {
  player.x = 300;
  player.facing = 1;
  player.hp = player.maxHp;
  player.displayHp = player.maxHp;
  player.ghostHp = player.maxHp;
  player.attack = null;
  player.cooldowns.q = 0;
  player.cooldowns.e = 0;
  player.iframes = 0;
  player.walkPhase = 0;
  player.moving = false;
  player.dead = false;
  player.deathT = 0;
  player.hurtFlash = 0;

  monster.x = 690;
  monster.facing = -1;
  monster.hp = monster.maxHp;
  monster.displayHp = monster.maxHp;
  monster.ghostHp = monster.maxHp;
  monster.state = 'chase';
  monster.timer = 0;
  monster.nextAttack = 2.4;
  monster.contactCd = 0;
  monster.hurtFlash = 0;
  monster.walkPhase = 0;
  monster.enraged = false;
  monster.attackHit = false;
  monster.dead = false;
  monster.deathT = 0;

  particles.length = 0;
  numbers.length = 0;
  effects.length = 0;

  game.elapsed = 0;
  game.shake = 0;
  game.hitstop = 0;
  game.flash = 0;
  game.over = null;
  game.paused = false;
  game.toast = null;
}

function startGame() {
  resetGame();
  setState('playing');
  Sound.init();
  toast('Q · E 로 공격하세요!', 1.8);
}

/* ---------- 이펙트 생성 ---------- */
function spawnDamageNumber(x, y, text, color, big, kind) {
  numbers.push({
    x, y, text: String(text), color,
    life: 0.85, max: 0.85,
    size: big ? 27 : 19,
    vy: -100, vx: rand(-26, 26),
    kind: kind || 'dmg'
  });
}

function spawnFloat(x, y, text, color, size) {
  numbers.push({
    x, y, text, color,
    life: 1.1, max: 1.1,
    size: size || 22,
    vy: -34, vx: 0,
    kind: 'text'
  });
}

function burstSparks(x, y, n, color, power) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU);
    const s = rand(60, power || 250);
    particles.push({
      type: 'spark', x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s - 50,
      life: rand(0.2, 0.5), max: 0.55,
      size: rand(1.5, 3.6), color,
      gravity: 700
    });
  }
}

function leafBurst(x, y, n) {
  const colors = ['#6cc96f', '#4fae5b', '#8edc7d', '#3f8f4f'];
  for (let i = 0; i < n; i++) {
    const life = rand(0.9, 2.0);
    particles.push({
      type: 'leaf', x: x + rand(-50, 50), y: y + rand(-40, 40),
      vx: rand(-90, 90), vy: rand(-140, -30),
      life, max: life,
      size: rand(4, 8), color: pick(colors),
      gravity: 180, rot: rand(0, TAU), vr: rand(-5, 5)
    });
  }
}

function dustBurst(x, y, n) {
  for (let i = 0; i < n; i++) {
    const life = rand(0.3, 0.7);
    particles.push({
      type: 'dust', x: x + rand(-30, 30), y: y + rand(-5, 5),
      vx: rand(-110, 110), vy: rand(-70, -10),
      life, max: life,
      size: rand(5, 13), color: '#d9e8bd',
      gravity: -30
    });
  }
}

function confettiBurst(x, y, n) {
  const cols = ['#ffd166', '#7ef9d0', '#ff8a8a', '#9ecbff', '#c9a7ff'];
  for (let i = 0; i < n; i++) {
    const life = rand(1.2, 2.4);
    particles.push({
      type: 'confetti', x: x + rand(-220, 220), y: y + rand(-80, 40),
      vx: rand(-160, 160), vy: rand(-380, -120),
      life, max: life,
      size: rand(3, 6), color: pick(cols),
      gravity: 520, rot: rand(0, TAU), vr: rand(-8, 8)
    });
  }
}

/* ---------- 전투 ---------- */
function monsterInFront(range) {
  if (monster.dead) return false;
  const dx = monster.x - player.x;
  return Math.abs(dx) <= range && dx * player.facing >= -20;
}

function tryAttack(kind) {
  if (game.state !== 'playing' || game.paused || game.over) return;
  if (player.dead || monster.dead) return;
  if (player.attack) return;
  const p = player;
  const s = SKILL[kind];

  if (p.cooldowns[kind] > 0) {
    Sound.denied();
    return;
  }

  p.attack = { type: kind, t: 0, hit: false };
  p.cooldowns[kind] = s.cd;

  if (kind === 'q') Sound.swing();
  else Sound.thrust();

  effects.push({
    type: 'slash',
    x: p.x + p.facing * 8,
    y: GROUND - 52,
    facing: p.facing,
    life: kind === 'q' ? 0.26 : 0.2,
    max: kind === 'q' ? 0.26 : 0.2,
    kind
  });

  if (kind === 'e') dustBurst(p.x - p.facing * 16, GROUND - 4, 5);
}

function hurtPlayer(amount, sourceX) {
  const p = player;
  if (p.dead || p.iframes > 0 || game.over) return false;

  p.hp = Math.max(0, p.hp - amount);
  p.iframes = 0.85;
  p.hurtFlash = 0.22;
  p.x = clamp(p.x + Math.sign(p.x - sourceX || -p.facing) * 26, 70, 890);

  game.shake = Math.max(game.shake, 12);
  game.hitstop = Math.max(game.hitstop, 0.06);
  game.flash = Math.max(game.flash, 0.35);

  spawnDamageNumber(p.x, GROUND - 122, amount, '#ff7c7c', false, 'player');
  burstSparks(p.x, GROUND - 62, 16, '#ffd166', 260);
  Sound.hurt();

  if (p.hp <= 0) {
    p.dead = true;
    p.deathT = 0;
    p.attack = null;
    game.over = { type: 'defeat', t: 0 };
    Sound.defeat();
  }
  return true;
}

function damageMonster(amount, kind) {
  const m = monster;
  if (m.dead || game.over) return;

  m.hp = Math.max(0, m.hp - amount);
  m.hurtFlash = 0.2;
  m.x = clamp(m.x + (player.x < m.x ? 9 : -9), 110, 900);

  game.shake = Math.max(game.shake, kind === 'e' ? 13 : 7);
  game.hitstop = Math.max(game.hitstop, kind === 'e' ? 0.075 : 0.045);
  game.flash = Math.max(game.flash, kind === 'e' ? 0.3 : 0.12);

  spawnDamageNumber(m.x + rand(-8, 8), GROUND - 162, amount,
    kind === 'e' ? '#ffd75e' : '#eafcff', kind === 'e');
  burstSparks(m.x + (player.x < m.x ? -20 : 20), GROUND - 108,
    kind === 'e' ? 22 : 12, kind === 'e' ? '#ffe27a' : '#d8fbff',
    kind === 'e' ? 320 : 230);
  leafBurst(m.x, GROUND - 195, kind === 'e' ? 7 : 4);
  Sound.hit(kind === 'e');

  if (m.hp <= 0) {
    m.dead = true;
    m.deathT = 0;
    m.state = 'dead';
    game.over = { type: 'victory', t: 0 };
    leafBurst(m.x, GROUND - 175, 26);
    burstSparks(m.x, GROUND - 145, 30, '#b7ff9e', 380);
    Sound.victory();
  } else if (m.state === 'windup') {
    m.state = 'stagger';
    m.timer = 0.4;
    m.nextAttack = rand(1.6, 3.0);
    spawnFloat(m.x, GROUND - 196, '경직!', '#bff7ff', 18);
  }
}

/* ---------- 업데이트 ---------- */
function smoothHp(e, dt) {
  e.displayHp += (e.hp - e.displayHp) * Math.min(1, dt * 9);
  if (e.ghostHp < e.hp) e.ghostHp = e.hp;
  else e.ghostHp = Math.max(e.hp, e.ghostHp - dt * 28);
}

let ambientTimer = 0;

function updateAmbient(dt) {
  ambientTimer -= dt;
  if (ambientTimer > 0) return;
  ambientTimer = rand(0.35, 0.9);

  if (!monster.dead && Math.random() < 0.55) {
    const life = rand(2.2, 3.4);
    particles.push({
      type: 'leaf',
      x: monster.x + rand(-70, 70), y: GROUND - rand(190, 230),
      vx: rand(-25, 25), vy: rand(8, 30),
      life, max: life,
      size: rand(3, 6), color: pick(['#6cc96f', '#8edc7d', '#4fae5b']),
      gravity: 10, rot: rand(0, TAU), vr: rand(-2, 2)
    });
  } else {
    const life = rand(1.6, 2.6);
    particles.push({
      type: 'spark',
      x: rand(40, 920), y: rand(370, 520),
      vx: rand(-8, 8), vy: rand(-22, -6),
      life, max: life,
      size: rand(1, 2.2), color: 'rgba(255,255,210,0.95)',
      gravity: -2
    });
  }
}

function updatePlayer(dt) {
  const p = player;
  p.iframes = Math.max(0, p.iframes - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  p.cooldowns.q = Math.max(0, p.cooldowns.q - dt);
  p.cooldowns.e = Math.max(0, p.cooldowns.e - dt);

  if (p.dead) { p.deathT += dt; return; }

  let ax = 0;
  if (game.state === 'playing' && !game.over) {
    if (keys.has('ArrowLeft') || keys.has('KeyA') || touch.left) ax -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD') || touch.right) ax += 1;
  }
  p.moving = ax !== 0;

  if (!p.attack && ax !== 0) p.facing = ax;

  let speed = 255;
  if (p.attack) speed *= p.attack.type === 'q' ? 0.25 : 0;
  p.x += ax * speed * dt;

  if (ax !== 0) p.walkPhase += dt * 11;

  if (p.attack) {
    const a = p.attack;
    a.t += dt;

    if (a.type === 'q') {
      if (!a.hit && a.t >= 0.055 && a.t <= 0.24) {
        if (monsterInFront(SKILL.q.range)) { damageMonster(SKILL.q.dmg, 'q'); a.hit = true; }
      }
      if (a.t >= 0.37) p.attack = null;
    } else {
      if (a.t <= 0.18) {
        p.x += p.facing * 540 * dt;
        if (Math.random() < 0.55) {
          const life = rand(0.25, 0.4);
          particles.push({
            type: 'dust',
            x: p.x - p.facing * 18, y: GROUND - 5 + rand(-5, 4),
            vx: -p.facing * rand(20, 70), vy: rand(-30, -5),
            life, max: life, size: rand(4, 9), color: '#d8e9b8', gravity: -20
          });
        }
      }
      if (!a.hit && a.t >= 0.03 && a.t <= 0.2) {
        if (monsterInFront(SKILL.e.range)) { damageMonster(SKILL.e.dmg, 'e'); a.hit = true; }
      }
      if (a.t >= 0.55) p.attack = null;
    }
  }

  p.x = clamp(p.x, 70, 890);

  if (!monster.dead) {
    const d = p.x - monster.x;
    if (Math.abs(d) < 62) p.x = monster.x + (d >= 0 ? 62 : -62);
  }
  p.x = clamp(p.x, 70, 890);
}

function updateMonster(dt) {
  const m = monster;
  m.hurtFlash = Math.max(0, m.hurtFlash - dt);
  m.contactCd = Math.max(0, m.contactCd - dt);

  if (m.dead) { m.deathT += dt; return; }

  if (!m.enraged && m.hp > 0 && m.hp <= m.maxHp * 0.5) {
    m.enraged = true;
    spawnFloat(m.x, GROUND - 212, '분노!', '#ff8a5c', 24);
    game.shake = Math.max(game.shake, 10);
    Sound.roar();
    burstSparks(m.x, GROUND - 150, 18, '#ff9a5c', 280);
  }

  const dx = player.x - m.x;
  const adx = Math.abs(dx);

  if (m.state !== 'strike' && m.state !== 'windup') {
    m.facing = dx >= 0 ? 1 : -1;
  }

  switch (m.state) {
    case 'chase': {
      m.nextAttack -= dt;
      if (!game.over && !player.dead && adx > 76) {
        const spd = m.enraged ? 70 : 48;
        m.x += Math.sign(dx) * spd * dt;
        m.walkPhase += dt * 7;
      }
      if (!game.over && !player.dead && m.nextAttack <= 0 && adx < 270) {
        m.state = 'windup';
        m.timer = m.enraged ? 0.52 : 0.68;
        m.windupDur = m.timer;
        m.attackHit = false;
        m.facing = dx >= 0 ? 1 : -1;
        Sound.windup();
      }
      break;
    }
    case 'windup': {
      m.timer -= dt;
      if (m.timer <= 0) {
        m.state = 'strike';
        m.timer = 0.22;
        m.attackHit = false;
        Sound.slam();
        game.shake = Math.max(game.shake, 8);
        effects.push({
          type: 'shock', x: m.x + m.facing * 80, y: GROUND - 2,
          life: 0.4, max: 0.4, facing: m.facing
        });
        dustBurst(m.x + m.facing * 70, GROUND - 4, 14);
      }
      break;
    }
    case 'strike': {
      m.timer -= dt;
      if (!m.attackHit && adx < 160 && dx * m.facing > -35) {
        if (hurtPlayer(10, m.x)) m.attackHit = true;
      }
      if (m.timer <= 0) { m.state = 'recover'; m.timer = 0.6; }
      break;
    }
    case 'recover': {
      m.timer -= dt;
      if (m.timer <= 0) {
        m.state = 'chase';
        m.nextAttack = rand(1.9, 3.5) * (m.enraged ? 0.62 : 1);
      }
      break;
    }
    case 'stagger': {
      m.timer -= dt;
      if (m.timer <= 0) {
        m.state = 'chase';
        m.nextAttack = Math.max(m.nextAttack, rand(1.2, 2.4));
      }
      break;
    }
  }

  m.x = clamp(m.x, 100, 900);

  if (!game.over && !player.dead && Math.abs(player.x - m.x) < 74 && m.contactCd <= 0) {
    if (hurtPlayer(5, m.x)) m.contactCd = 1.15;
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy += (p.gravity || 0) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.vr) p.rot += p.vr * dt;
    if (p.type === 'dust') { p.size += dt * 16; p.vx *= 0.98; }
  }
}

function updateNumbers(dt) {
  for (let i = numbers.length - 1; i >= 0; i--) {
    const n = numbers[i];
    n.life -= dt;
    if (n.life <= 0) { numbers.splice(i, 1); continue; }
    n.y += n.vy * dt;
    n.x += n.vx * dt;
    n.vy += 120 * dt;
  }
}

function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    effects[i].life -= dt;
    if (effects[i].life <= 0) effects.splice(i, 1);
  }
}

function update(dt) {
  if (game.paused) return;

  game.time += dt;
  game.stateTime += dt;

  game.shake = Math.max(0, game.shake - dt * 55);
  game.flash = Math.max(0, game.flash - dt * 3.2);

  if (game.toast) {
    game.toast.t -= dt;
    if (game.toast.t <= 0) game.toast = null;
  }

  if (game.state === 'playing') {
    if (!game.over) game.elapsed += dt;
    updatePlayer(dt);
    updateMonster(dt);

    if (game.over) {
      game.over.t += dt;
      if (game.over.t > 1.25 && game.state === 'playing') {
        setState(game.over.type);
        if (game.over.type === 'victory') confettiBurst(W / 2, 260, 44);
      }
    }
  }

  updateParticles(dt);
  updateNumbers(dt);
  updateEffects(dt);

  if (game.state === 'playing' || game.state === 'title') updateAmbient(dt);

  smoothHp(player, dt);
  smoothHp(monster, dt);
}
