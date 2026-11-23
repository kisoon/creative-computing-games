(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const fly = (el, frames, duration = 600, easing = 'ease-out') => {
    const anim = el.animate(frames, { duration, easing, fill: 'forwards' });
    return new Promise((res) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        res();
      };
      anim.onfinish = done;
      anim.oncancel = done;
      // 안전장치: 탭이 백그라운드일 때도 진행이 멈추지 않도록
      setTimeout(done, duration + 300);
    });
  };

  const stage = $('#stage');
  const invEl = $('#inventory');
  const muteBtn = $('#muteBtn');
  const startOverlay = $('#startOverlay');
  const winOverlay = $('#winOverlay');
  const failOverlay = $('#failOverlay');
  const flashEl = $('#flash');
  const toastWrap = $('.stage-wrap');

  const ITEMS = {
    book: { name: '책', emoji: '📕' },
    apple: { name: '사과', emoji: '🍎' },
    spoon: { name: '숟가락', emoji: '🥄' },
    brick: { name: '벽돌', emoji: '🧱' },
    key: { name: '열쇠', emoji: '🔑' },
    toothbrush: { name: '칫솔', emoji: '🪥' },
    cross: { name: '나무 십자가', emoji: '✝️' },
  };
  const ORDER = ['book', 'apple', 'spoon', 'brick', 'key'];
  const DISPLAY_ORDER = ['book', 'apple', 'toothbrush', 'spoon', 'cross', 'brick', 'key'];

  const state = { started: false, done: false, failed: false, locked: false, step: 0, clicks: 0, startTime: 0 };
  const acquired = new Set(['book', 'apple', 'toothbrush', 'cross']);

  /* ---------------- inventory ---------------- */
  invEl.innerHTML = DISPLAY_ORDER.map((id) => `
    <button class="item locked" data-item="${id}" type="button" aria-label="${ITEMS[id].name}">
      <span class="icon" aria-hidden="true">${ITEMS[id].emoji}</span>
      <span class="name">${ITEMS[id].name}</span>
    </button>`).join('');

  function updateInventory() {
    [...invEl.children].forEach((btn) => {
      const id = btn.dataset.item;
      const idx = ORDER.indexOf(id);
      const has = acquired.has(id);
      const isEscapeTool = idx !== -1;
      btn.classList.toggle('locked', !has);
      btn.classList.toggle('used', isEscapeTool && has && idx < state.step && !state.done);
      btn.setAttribute('aria-disabled', String(!has));
      btn.title = !has ? `${ITEMS[id].name} — 아직 얻지 못했다` : `${ITEMS[id].name}`;
    });
  }

  function grant(id) {
    acquired.add(id);
    updateInventory();
    toast(ITEMS[id].emoji, `${ITEMS[id].name} 획득!`);
    const card = invEl.querySelector(`[data-item="${id}"]`);
    if (card) {
      card.classList.remove('pop');
      void card.offsetWidth;
      card.classList.add('pop');
    }
    sfx('pickup');
  }

  function toast(emoji, text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span>${emoji}</span>${text}`;
    toastWrap.appendChild(el);
    setTimeout(() => el.remove(), 1750);
  }


  /* ---------------- sound ---------------- */
  let actx = null;
  let muted = false;

  function tone(freq, dur = 0.08, type = 'sine', vol = 0.04, delay = 0, slideTo = null) {
    if (muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const t = actx.currentTime + delay;
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(actx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.03);
    } catch (e) { /* audio is optional */ }
  }

  function sfx(name) {
    switch (name) {
      case 'click': tone(600, 0.04, 'triangle', 0.02); break;
      case 'deny': tone(180, 0.1, 'square', 0.025); tone(138, 0.14, 'square', 0.02, 0.09); break;
      case 'clatter':
        tone(240, 0.07, 'square', 0.045);
        tone(170, 0.09, 'square', 0.035, 0.07);
        tone(120, 0.13, 'square', 0.03, 0.15);
        break;
      case 'roll':
        tone(430, 0.05, 'sine', 0.025);
        tone(360, 0.05, 'sine', 0.02, 0.06);
        tone(300, 0.05, 'sine', 0.018, 0.12);
        break;
      case 'scrape':
        tone(95, 0.32, 'sawtooth', 0.015);
        tone(65, 0.3, 'sawtooth', 0.012, 0.05);
        break;
      case 'scrapeTick': tone(130 + Math.random() * 110, 0.05, 'sawtooth', 0.015); break;
      case 'whoosh': tone(280, 0.2, 'sine', 0.03, 0, 950); break;
      case 'hit':
        tone(95, 0.26, 'square', 0.05, 0, 45);
        tone(180, 0.1, 'sawtooth', 0.03);
        break;
      case 'pickup': tone(660, 0.08, 'sine', 0.035); tone(880, 0.12, 'sine', 0.035, 0.08); break;
      case 'unlock':
        tone(520, 0.08, 'triangle', 0.035);
        tone(660, 0.08, 'triangle', 0.035, 0.1);
        tone(790, 0.16, 'triangle', 0.035, 0.2);
        break;
      case 'gate': tone(80, 0.36, 'sawtooth', 0.02); break;
      case 'alarm':
        tone(880, 0.16, 'square', 0.03);
        tone(620, 0.16, 'square', 0.03, 0.18);
        tone(880, 0.16, 'square', 0.03, 0.36);
        tone(620, 0.22, 'square', 0.03, 0.54);
        break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.26, 'sine', 0.04, i * 0.12)); break;
      default: break;
    }
  }

  /* ---------------- effects ---------------- */
  function spawnDust(x, y, n = 8) {
    const ns = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < n; i++) {
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', x);
      c.setAttribute('cy', y);
      c.setAttribute('r', String(1.4 + Math.random() * 2.2));
      c.setAttribute('fill', '#cbd3e4');
      $('#fx').appendChild(c);
      const dx = (Math.random() - 0.5) * 90;
      const dy = 20 + Math.random() * 60;
      c.animate(
        [
          { transform: 'translate(0,0)', opacity: 0.75 },
          { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
        ],
        { duration: 500 + Math.random() * 450, easing: 'cubic-bezier(.2,.7,.5,1)', fill: 'forwards' }
      ).onfinish = () => c.remove();
    }
  }

  function spawnStars(x, y) {
    const ns = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < 9; i++) {
      const s = document.createElementNS(ns, 'text');
      s.setAttribute('x', x);
      s.setAttribute('y', y);
      s.setAttribute('text-anchor', 'middle');
      s.setAttribute('font-size', String(12 + Math.random() * 12));
      s.setAttribute('fill', '#ffd766');
      s.textContent = i % 3 === 0 ? '✦' : '★';
      $('#fx').appendChild(s);
      const dx = (Math.random() - 0.5) * 150;
      const dy = -30 - Math.random() * 80;
      s.animate(
        [
          { transform: 'translate(0,0) scale(.4)', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(1.1)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${dx * 1.2}px, ${dy + 130}px) scale(.5)`, opacity: 0 },
        ],
        { duration: 800 + Math.random() * 450, easing: 'cubic-bezier(.2,.6,.5,1)', fill: 'forwards' }
      ).onfinish = () => s.remove();
    }
  }

  function flash(duration = 650) {
    flashEl.style.transition = 'none';
    flashEl.style.opacity = '0.95';
    requestAnimationFrame(() => {
      flashEl.style.transition = `opacity ${duration}ms ease-out`;
      flashEl.style.opacity = '0';
    });
  }

  /* ---------------- actions ---------------- */
  const ACTIONS = {
    async book() {
      sfx('clatter');
      await fly($('#bookInner'), [
        { transform: 'translate(0px, 0px) rotate(0deg)' },
        { transform: 'translate(-70px, -46px) rotate(-110deg)', offset: 0.5 },
        { transform: 'translate(-196px, -4px) rotate(-185deg)' },
      ], 700, 'cubic-bezier(.3,.6,.4,1)');
      stage.classList.add('distracted');
      await wait(350);
      state.step = 1;
      updateInventory();
    },

    async apple() {
      sfx('roll');
      await fly($('#appleInner'), [
        { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
        { transform: 'translate(-170px, -100px) scale(.9)', offset: 0.45, opacity: 1 },
        { transform: 'translate(-390px, -122px) scale(.55)', opacity: 0.15 },
      ], 850, 'cubic-bezier(.35,.2,.5,1)');
      $('#appleObj').style.opacity = '0';
      $('#neighborArm').setAttribute('opacity', '1');
      $('#neighborArm').animate(
        [{ transform: 'translateY(0)' }, { transform: 'translateY(-16px)' }, { transform: 'translateY(0)' }],
        { duration: 420, iterations: 2, easing: 'ease-in-out' }
      );
      await wait(500);
      const spoonObj = $('#spoonObj');
      spoonObj.classList.add('shown');
      spoonObj.setAttribute('tabindex', '0');
      await fly($('#spoonInner'), [
        { transform: 'translate(-135px, -175px) rotate(-55deg)' },
        { transform: 'translate(-30px, -50px) rotate(-20deg)', offset: 0.55 },
        { transform: 'translate(0px, 0px) rotate(0deg)' },
      ], 700, 'cubic-bezier(.3,.5,.5,1)');
      state.step = 2;
      grant('spoon');
    },

    async spoon() {
      sfx('scrape');
      const spoonObj = $('#spoonObj');
      spoonObj.classList.remove('shown');
      spoonObj.setAttribute('tabindex', '-1');
      await fly($('#prisonerInner'), [
        { transform: 'translateX(0px)' },
        { transform: 'translateX(150px)' },
      ], 500, 'ease-out');

      $('#scratches').style.opacity = '1';
      $('#wallInner').animate([
        { transform: 'translate(0px,0px) rotate(0deg)' },
        { transform: 'translate(-2px,1px) rotate(-1deg)' },
        { transform: 'translate(2px,-1px) rotate(1deg)' },
      ], { duration: 120, iterations: 9, easing: 'ease-in-out' });

      for (let i = 0; i < 3; i++) {
        spawnDust(548, 334, 6);
        sfx('scrapeTick');
        await wait(320);
      }

      $('#wallHole').style.opacity = '1';
      $('#scratches').style.opacity = '0';

      const brickObj = $('#brickObj');
      brickObj.classList.add('shown');
      brickObj.setAttribute('tabindex', '0');
      await fly($('#brickInner'), [
        { transform: 'translate(-10px, -112px) rotate(-24deg)' },
        { transform: 'translate(12px, -36px) rotate(14deg)', offset: 0.55 },
        { transform: 'translate(0px, 0px) rotate(0deg)' },
      ], 700, 'cubic-bezier(.3,.6,.5,1)');

      state.step = 3;
      grant('brick');
      await fly($('#prisonerInner'), [
        { transform: 'translateX(150px)' },
        { transform: 'translateX(0px)' },
      ], 450, 'ease-in-out');
    },

    async brick() {
      sfx('whoosh');
      const brickObj = $('#brickObj');
      await fly($('#brickInner'), [
        { transform: 'translate(0px, 0px) rotate(0deg)' },
        { transform: 'translate(-24px, -100px) rotate(-50deg)', offset: 0.28 },
        { transform: 'translate(130px, -190px) rotate(390deg)', offset: 0.7 },
        { transform: 'translate(230px, -212px) rotate(760deg)' },
      ], 620, 'cubic-bezier(.3,0,.6,1)');
      brickObj.classList.remove('shown');
      brickObj.setAttribute('tabindex', '-1');

      sfx('hit');
      stage.classList.add('shake', 'guard-down');
      spawnStars(806, 270);
      await wait(700);
      stage.classList.remove('shake');

      const dropKey = $('#dropKey');
      dropKey.classList.add('shown');
      dropKey.setAttribute('tabindex', '0');
      dropKey.classList.remove('pop');
      void dropKey.getBoundingClientRect();
      dropKey.classList.add('pop');

      state.step = 4;
      grant('key');
    },

    async key() {
      sfx('unlock');
      await wait(450);
      $('#gate').classList.add('open');
      sfx('gate');
      await wait(650);
      $('#prisonerInner').animate([
        { transform: 'translateX(0px)' },
        { transform: 'translateX(430px)' },
      ], { duration: 950, easing: 'cubic-bezier(.4,0,.8,.6)', fill: 'forwards' });
      flash(700);
      await wait(1100);
      win();
    },
  };

  async function caught() {
    if (state.failed || state.done) return;
    state.failed = true;
    state.locked = true;
    state.clicks += 1;
    sfx('alarm');
    const alertText = $('#guardAlert text');
    if (alertText) {
      alertText.textContent = '!';
      alertText.setAttribute('fill', '#ff8a7a');
    }
    stage.classList.add('caught', 'shake');
    flashEl.style.background = '#a8261e';
    flash(750);
    await wait(950);
    stage.classList.remove('shake');
    failOverlay.classList.remove('hidden');
  }

  async function act(item) {
    if (!state.started || state.done || state.failed || state.locked || !item) return;
    if (item !== ORDER[state.step]) {
      await caught();
      return;
    }
    state.clicks += 1;
    state.locked = true;
    try {
      await ACTIONS[item]();
    } catch (err) {
      console.error(err);
    } finally {
      state.locked = false;
    }
  }

  function win() {
    state.done = true;
    state.locked = true;
    state.step = ORDER.length;
    updateInventory();
    const secs = Math.max(1, Math.round((Date.now() - state.startTime) / 1000));
    $('#statClicks').textContent = String(state.clicks);
    $('#statTime').textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    winOverlay.classList.remove('hidden');
    sfx('win');
  }

  /* ---------------- events ---------------- */
  const SCENE_ITEMS = {
    bookObj: 'book',
    appleObj: 'apple',
    toothbrushObj: 'toothbrush',
    crossObj: 'cross',
    spoonObj: 'spoon',
    brickObj: 'brick',
    wallSpot: 'spoon',
    dropKey: 'key',
  };
  const gameEl = $('.game');

  gameEl.addEventListener('click', (e) => {
    if (!state.started || state.done || state.failed || state.locked) return;
    if (e.target.closest('#muteBtn')) return;
    if (e.target.closest('.overlay')) return;

    const itemBtn = e.target.closest('.item');
    if (itemBtn) {
      sfx('click');
      act(itemBtn.dataset.item);
      return;
    }

    const sceneObj = e.target.closest('#bookObj, #appleObj, #toothbrushObj, #crossObj, #spoonObj, #brickObj, #wallSpot, #dropKey');
    if (sceneObj) {
      sfx('click');
      act(SCENE_ITEMS[sceneObj.id]);
      return;
    }

    // 도구가 아닌 곳을 클릭한 경우도 교도관에게 들킨다
    sfx('click');
    caught();
  });

  document.querySelectorAll('#stage [role="button"]').forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
  });

  muteBtn.addEventListener('click', () => {
    muted = !muted;
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
    if (!muted) sfx('click');
  });

  $('#startBtn').addEventListener('click', () => {
    sfx('click');
    startOverlay.classList.add('hidden');
    state.started = true;
    state.startTime = Date.now();
    updateInventory();
  });

  $('#restartBtn').addEventListener('click', () => window.location.reload());
  $('#retryBtn').addEventListener('click', () => window.location.reload());

  updateInventory();
})();
