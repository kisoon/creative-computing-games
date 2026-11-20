(function (global) {
  'use strict';

  const BEST_KEY = 'mulbul-crossing-best-v1';
  const canvas = document.getElementById('game');
  const overlay = document.getElementById('overlay');
  const hud = document.getElementById('hud');
  const distanceEl = document.getElementById('distance');
  const bestEl = document.getElementById('best');
  const bestTitleEl = document.getElementById('best-title');
  const bestLineEl = document.getElementById('best-line');
  const toast = document.getElementById('toast');
  const toastTitle = document.getElementById('toast-title');
  const toastSub = document.getElementById('toast-sub');
  const flash = document.getElementById('hit-flash');
  const soundState = document.getElementById('sound-state');
  const startButton = document.getElementById('start');

  let best = 0;
  try {
    best = parseInt(window.localStorage.getItem(BEST_KEY) || '0', 10) || 0;
  } catch (err) {
    best = 0;
  }

  let renderer;
  try {
    renderer = new Renderer(canvas);
  } catch (err) {
    console.error(err);
    const lede = overlay.querySelector('.lede');
    if (lede) {
      lede.textContent =
        '이 브라우저에서는 3D 게임(WebGL2)을 실행할 수 없습니다. 최신 Chrome, Edge, Safari에서 다시 열어 주세요.';
    }
    startButton.disabled = true;
    startButton.textContent = 'WebGL2 필요';
    const fallback = document.createElement('a');
    fallback.href = 'legacy-2d/index.html';
    fallback.textContent = '물불 원정대 · 2D 플레이';
    fallback.style.cssText = 'display:inline-block;padding:12px 20px;margin-top:12px;background:#fff;color:#20303a;border-radius:8px;font-weight:700';
    startButton.after(fallback);
    return;
  }

  const audio = global.GameAudio;
  let lastScore = -1;

  function updateScore(score) {
    if (score === lastScore) return;
    lastScore = score;
    distanceEl.textContent = score;
    distanceEl.classList.remove('pop');
    void distanceEl.offsetWidth;
    distanceEl.classList.add('pop');
  }

  function updateBest(value) {
    bestEl.textContent = value;
    bestTitleEl.textContent = value;
    bestLineEl.style.visibility = value > 0 ? 'visible' : 'hidden';
  }

  function showToast(title, sub) {
    toastTitle.textContent = title;
    toastSub.textContent = sub;
    toast.classList.add('is-visible');
  }

  function hideToast() {
    toast.classList.remove('is-visible');
  }

  function flashHit() {
    flash.classList.remove('is-hit');
    void flash.offsetWidth;
    flash.classList.add('is-hit');
  }

  const game = new CrossingGame(renderer, {
    audio,
    best,
    onScore(score, bestScore) {
      updateScore(score);
      updateBest(bestScore);
    },
    onBest(value) {
      try {
        window.localStorage.setItem(BEST_KEY, String(value));
      } catch (err) {
        /* storage unavailable */
      }
    },
    onStart() {
      overlay.classList.add('is-hidden');
      hud.classList.add('is-live');
      hideToast();
    },
    onDeath(score) {
      showToast(
        '차에 치였다!',
        score > 0 ? `${score}m에서 아웃 · 처음부터 다시` : '아직 0m · 처음부터 다시'
      );
      flashHit();
    },
  });

  // Debug / automation hook (harmless in production).
  window.__crossing = game;

  updateBest(best);
  updateScore(0);
  bestLineEl.style.visibility = best > 0 ? 'visible' : 'hidden';

  const charButtons = Array.prototype.slice.call(document.querySelectorAll('.char-btn'));

  function selectCharacter(name) {
    game.setCharacter(name);
    for (let i = 0; i < charButtons.length; i++) {
      charButtons[i].classList.toggle('is-active', charButtons[i].dataset.char === name);
    }
  }

  for (let i = 0; i < charButtons.length; i++) {
    charButtons[i].addEventListener('click', function () {
      selectCharacter(this.dataset.char);
    });
  }

  function begin() {
    if (game.state !== 'title') return;
    audio.unlock();
    game.startFromTitle();
  }

  startButton.addEventListener('click', begin);

  function toggleSound() {
    const muted = audio.toggle();
    soundState.textContent = muted ? 'OFF' : 'ON';
  }

  const KEY_DIR = {
    KeyW: 'up',
    ArrowUp: 'up',
    KeyS: 'down',
    ArrowDown: 'down',
    KeyA: 'left',
    ArrowLeft: 'left',
    KeyD: 'right',
    ArrowRight: 'right',
  };

  window.addEventListener('keydown', function (event) {
    const dir = KEY_DIR[event.code];
    if (dir || event.code === 'Space') event.preventDefault();

    if (event.repeat) return;

    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      if (game.state === 'title') begin();
      else if (game.state === 'dying') game.restart();
      return;
    }

    if (event.code === 'KeyR') {
      game.restart();
      return;
    }

    if (event.code === 'KeyM') {
      toggleSound();
      return;
    }

    if (game.state === 'title' && (event.code === 'Digit1' || event.code === 'Digit2')) {
      selectCharacter(event.code === 'Digit1' ? 'water' : 'fire');
      return;
    }

    if (dir) game.setHeld(dir, true);
  });

  window.addEventListener('keyup', function (event) {
    const dir = KEY_DIR[event.code];
    if (dir) game.setHeld(dir, false);
  });

  window.addEventListener('blur', function () {
    game.clearHeld();
  });

  let pointer = null;

  canvas.addEventListener('pointerdown', function (event) {
    pointer = { x: event.clientX, y: event.clientY };
    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (err) {
        /* ignore */
      }
    }
  });

  canvas.addEventListener('pointerup', function (event) {
    if (!pointer) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer = null;

    if (game.state === 'title') {
      if (Math.hypot(dx, dy) < 14) begin();
      return;
    }

    if (game.state !== 'playing') return;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      game.swipe(dx > 0 ? 'right' : 'left');
    } else {
      game.swipe(dy < 0 ? 'up' : 'down');
    }
  });

  canvas.addEventListener('pointercancel', function () {
    pointer = null;
  });

  canvas.addEventListener('webglcontextlost', function (event) {
    event.preventDefault();
  });

  let lastTime = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    game.update(dt);
    game.draw();
    window.requestAnimationFrame(frame);
  }

  window.requestAnimationFrame(frame);
})(window);