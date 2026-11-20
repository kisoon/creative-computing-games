/* =========================================================
   game-main.js — 입력 · 루프 · 초기화
   ========================================================= */
'use strict';

window.addEventListener('resize', fitCanvas);
window.addEventListener('orientationchange', () => setTimeout(fitCanvas, 120));

const PREVENT_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'Space', 'KeyQ', 'KeyE',
  'KeyA', 'KeyD', 'KeyR', 'KeyP', 'KeyM', 'Enter'
]);

window.addEventListener('keydown', (e) => {
  if (PREVENT_KEYS.has(e.code)) e.preventDefault();
  keys.add(e.code);
  Sound.init();
  if (e.repeat) return;

  // 사운드 토글
  if (e.code === 'KeyM') {
    const on = Sound.toggle();
    toast(on ? '소리 켜짐' : '소리 꺼짐');
    return;
  }

  // 시작 / 재시작
  if (game.state === 'title' &&
    (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyQ' || e.code === 'KeyE')) {
    startGame();
    return;
  }
  if ((game.state === 'victory' || game.state === 'defeat') &&
    (e.code === 'KeyR' || e.code === 'Space' || e.code === 'Enter')) {
    startGame();
    return;
  }
  if (game.state === 'playing' && e.code === 'KeyR') {
    startGame();
    return;
  }

  // 일시정지
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (game.state === 'playing') {
      game.paused = !game.paused;
      keys.clear();
    }
    return;
  }

  // 스킬
  if (game.state === 'playing' && !game.paused) {
    if (e.code === 'KeyQ') tryAttack('q');
    else if (e.code === 'KeyE') tryAttack('e');
  }
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

window.addEventListener('blur', () => {
  keys.clear();
  touch.left = false;
  touch.right = false;
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    keys.clear();
    touch.left = false;
    touch.right = false;
    if (game.state === 'playing' && !game.over) game.paused = true;
  }
});

/* ---------- 포인터 ---------- */
const stageEl = document.getElementById('stage');

stageEl.addEventListener('pointerdown', (e) => {
  if (e.target && e.target.closest && e.target.closest('.tbtn')) return;
  Sound.init();
  if (game.state === 'title') {
    startGame();
  } else if (game.state === 'victory' || game.state === 'defeat') {
    startGame();
  } else if (game.paused) {
    game.paused = false;
  }
});

window.addEventListener('contextmenu', (e) => e.preventDefault());

/* ---------- 터치 버튼 ---------- */
document.querySelectorAll('.tbtn').forEach((btn) => {
  const act = btn.dataset.act;

  const down = (ev) => {
    ev.preventDefault();
    Sound.init();
    btn.classList.add('active');
    if (act === 'left') touch.left = true;
    else if (act === 'right') touch.right = true;
    else if (act === 'q') tryAttack('q');
    else if (act === 'e') tryAttack('e');
  };

  const up = (ev) => {
    if (ev) ev.preventDefault();
    btn.classList.remove('active');
    if (act === 'left') touch.left = false;
    else if (act === 'right') touch.right = false;
  };

  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('pointerleave', up);
});

/* ---------- 메인 루프 ---------- */
let lastTime = performance.now();

function frame(now) {
  let raw = (now - lastTime) / 1000;
  lastTime = now;
  if (!isFinite(raw) || raw < 0) raw = 0;
  raw = Math.min(raw, 0.05);

  if (game.hitstop > 0) {
    game.hitstop = Math.max(0, game.hitstop - raw);
    update(0);
  } else {
    update(raw);
  }

  render();
  requestAnimationFrame(frame);
}

resetGame();
setState('title');
requestAnimationFrame(frame);
