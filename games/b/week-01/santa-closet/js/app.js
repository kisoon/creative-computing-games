/* Game state + UI */

const STORAGE_KEY = 'santa-closet-v1';

const blankOutfit = () => ({ top: null, bottom: null, shoes: null, hat: null, neck: null });
const blankDecor = () => ({ indoor: [], outdoor: [] });

const state = {
  active: 'female',
  category: 'top',
  background: 'outdoor',
  muted: false,
  outfits: {
    female: blankOutfit(),
    male: blankOutfit()
  },
  decorations: blankDecor()
};

const els = {
  scene: document.getElementById('scene'),
  svg: document.getElementById('characterSvg'),
  charFrame: document.getElementById('charFrame'),
  dropZone: document.getElementById('characterDrop'),
  dropHint: document.getElementById('dropHint'),
  outfitBar: document.getElementById('outfitBar'),
  itemsGrid: document.getElementById('itemsGrid'),
  itemCount: document.getElementById('itemCount'),
  soundBtn: document.getElementById('soundBtn'),
  resetBtn: document.getElementById('resetBtn'),
  toast: document.getElementById('toast'),
  fx: document.getElementById('fxLayer'),
  snow: document.getElementById('snowfall'),
  decoLayer: document.getElementById('decoLayer')
};

let ignoreClickUntil = 0;
let dragState = null;
let toastTimer = null;
let audioCtx = null;

/* ---------- rendering ---------- */

function characterMarkup() {
  const key = state.active;
  const c = CHARS[key];
  const o = state.outfits[key];
  const top = ITEM_BY_ID[o.top];
  const bottom = ITEM_BY_ID[o.bottom];
  const shoes = ITEM_BY_ID[o.shoes];
  const hat = ITEM_BY_ID[o.hat];
  const neck = ITEM_BY_ID[o.neck];

  const layers = [
    `<defs>${SHARED_DEFS}</defs>`,
    backHairLayer(key, c),
    legsLayer(c),
    armsLayer(c),
    torsoLayer(c),
    headLayer(key, c),
    bottom ? bottom.render(c) : baseShorts(c),
    top ? top.render(c) : baseTank(c),
    handsLayer(c),
    shoes ? shoes.render(c) : shoesLayer(c),
    neck ? neck.render(c) : '',
    hat ? hat.render(c) : ''
  ];

  return layers.filter(Boolean).join('');
}

function renderCharacter() {
  els.svg.innerHTML = characterMarkup();
  els.svg.setAttribute('aria-label', `${state.active === 'female' ? '여자' : '남자'} 캐릭터의 옷 입히기`);
}

function renderItems() {
  const o = state.outfits[state.active];
  const decorated = state.decorations[state.background];
  const list = ITEMS.filter((item) => {
    if (item.cat !== state.category) return false;
    if (item.who && item.who !== 'unisex' && item.who !== state.active) return false;
    if (item.cat === 'scene' && !item.scenes.includes(state.background)) return false;
    return true;
  });

  els.itemCount.textContent = `${list.length}개`;

  els.itemsGrid.innerHTML = list.map((item) => {
    const isScene = item.cat === 'scene';
    const active = isScene ? decorated.includes(item.id) : o[item.slot] === item.id;
    const tag = isScene
      ? `${item.tag}${active ? ' · 배치됨' : ''}`
      : item.slot === 'hat'
        ? '모자'
        : item.slot === 'neck'
          ? '목도리'
          : item.tag;
    const action = isScene
      ? `${item.name} ${active ? '배경에서 빼기' : '배경에 추가'}`
      : `${item.name} ${active ? '벗기기' : '입히기'}`;
    return `
      <button class="item-card${active ? ' is-worn' : ''}" type="button" data-id="${item.id}" aria-pressed="${active}" aria-label="${action}">
        <span class="item-thumb">${itemPreview(item)}</span>
        <span class="item-info">
          <span class="item-name">${item.name}</span>
          <span class="item-tag">${tag}</span>
        </span>
        ${active ? '<span class="worn-check" aria-hidden="true">✓</span>' : ''}
      </button>
    `;
  }).join('');
}

let decoSignature = '';

function renderDecorations() {
  const ids = (state.decorations[state.background] || []).filter((id) => {
    const item = ITEM_BY_ID[id];
    return item && item.scenes.includes(state.background);
  });

  const signature = `${state.background}:${ids.join(',')}`;
  if (signature === decoSignature) return;
  decoSignature = signature;

  els.decoLayer.innerHTML = ids.map((id) => {
    const item = ITEM_BY_ID[id];
    return `<span class="deco deco--${item.decoClass}" data-id="${id}">${item.render()}</span>`;
  }).join('');

  requestAnimationFrame(() => {
    els.decoLayer.querySelectorAll('.deco').forEach((node) => node.classList.add('is-visible'));
  });
}

function renderScene() {
  els.scene.dataset.bg = state.background;
  document.querySelectorAll('.bg-btn').forEach((btn) => {
    const active = btn.dataset.bg === state.background;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  renderDecorations();
}

function renderOutfitBar() {
  const o = state.outfits[state.active];
  els.outfitBar.innerHTML = SLOTS.map((slot) => {
    const item = ITEM_BY_ID[o[slot.key]];
    return `
      <div class="outfit-slot${item ? ' is-filled' : ''}">
        <span class="slot-text">
          <span>${slot.label}</span>
          <b>${item ? item.name : slot.empty}</b>
        </span>
        ${item ? `<button class="slot-clear" type="button" data-slot="${slot.key}" aria-label="${slot.label} 벗기기">×</button>` : ''}
      </div>
    `;
  }).join('');
}

function renderAll() {
  renderCharacter();
  renderItems();
  renderOutfitBar();
  renderScene();

  document.querySelectorAll('.char-btn').forEach((btn) => {
    const active = btn.dataset.char === state.active;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  document.querySelectorAll('.tab').forEach((btn) => {
    const active = btn.dataset.cat === state.category;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });
}

/* ---------- persistence ---------- */

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      active: state.active,
      background: state.background,
      muted: state.muted,
      outfits: state.outfits,
      decorations: state.decorations
    }));
  } catch (err) {
    /* storage unavailable: game still works */
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return;

    if (saved.active === 'female' || saved.active === 'male') state.active = saved.active;
    if (saved.background === 'indoor' || saved.background === 'outdoor') state.background = saved.background;
    if (typeof saved.muted === 'boolean') state.muted = saved.muted;

    ['female', 'male'].forEach((key) => {
      const savedOutfit = saved.outfits && saved.outfits[key];
      if (!savedOutfit) return;
      Object.keys(state.outfits[key]).forEach((slot) => {
        const item = ITEM_BY_ID[savedOutfit[slot]];
        const fitsWho = !item || !item.who || item.who === 'unisex' || item.who === key;
        if (item && item.slot === slot && fitsWho) state.outfits[key][slot] = item.id;
      });
    });

    ['indoor', 'outdoor'].forEach((bg) => {
      const savedDecor = saved.decorations && saved.decorations[bg];
      if (!Array.isArray(savedDecor)) return;
      state.decorations[bg] = savedDecor.filter((id) => {
        const item = ITEM_BY_ID[id];
        return item && item.cat === 'scene' && item.scenes.includes(bg);
      });
    });
  } catch (err) {
    /* ignore corrupted save */
  }
}

/* ---------- sound ---------- */

function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone(freq, delay = 0, duration = 0.2, volume = 0.035) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.03);
}

function chime() {
  if (state.muted) return;
  try {
    tone(784, 0, 0.22);
    tone(1046.5, 0.07, 0.22);
    tone(1318.5, 0.14, 0.3);
  } catch (err) { /* ignore */ }
}

function softPop() {
  if (state.muted) return;
  try {
    tone(330, 0, 0.12, 0.025);
    tone(262, 0.06, 0.16, 0.02);
  } catch (err) { /* ignore */ }
}

function updateSoundButton() {
  els.soundBtn.textContent = state.muted ? '🔇' : '🔊';
  els.soundBtn.setAttribute('aria-label', state.muted ? '배경음악 켜기' : '배경음악 끄기');
  els.soundBtn.title = state.muted ? '배경음악 켜기' : '배경음악 끄기';
}

/* ---------- looping christmas carol (Web Audio, no external files) ---------- */

const BGM_BPM = 96;
const BGM_LOOP_BEATS = 32;
const BGM_MELODY = [
  [0, 76, 1], [1, 76, 1], [2, 76, 1],
  [4, 76, 1], [5, 76, 1], [6, 76, 1],
  [8, 76, 1], [9, 79, 1], [10, 72, 1], [11, 74, 1], [12, 76, 1.8],
  [16, 77, 1], [17, 77, 1], [18, 77, 1], [19, 77, 1],
  [20, 77, 1], [21, 76, 1], [22, 76, 1], [23, 76, 1],
  [24, 74, 1], [25, 74, 1], [26, 76, 1], [27, 74, 1], [28, 79, 1.8]
];
const BGM_CHORDS = [
  [0, [60, 64, 67]], [4, [60, 64, 67]], [8, [60, 64, 67]], [12, [60, 64, 67]],
  [16, [60, 65, 69]], [20, [60, 65, 69]], [24, [59, 62, 67]], [28, [60, 64, 67]]
];
const BGM_BASS = [[0, 48], [4, 48], [8, 48], [12, 48], [16, 53], [20, 53], [24, 55], [28, 48]];

let bgmGain = null;
let bgmTimer = null;
let bgmNext = 0;

function midiToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function bgmNote(note, when, duration, volume, type = 'triangle') {
  if (!audioCtx || !bgmGain) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(midiToFreq(note), when);
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(volume, when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.12, duration));
  osc.connect(gain);
  gain.connect(bgmGain);
  osc.start(when);
  osc.stop(when + duration + 0.06);
}

function scheduleBgmLoop(start) {
  const spb = 60 / BGM_BPM;
  BGM_MELODY.forEach(([beat, note, beats]) => {
    const when = start + beat * spb;
    const duration = beats * spb;
    bgmNote(note, when, duration, 0.022, 'triangle');
    bgmNote(note + 12, when, duration * 0.6, 0.0045, 'sine');
  });
  BGM_CHORDS.forEach(([beat, notes]) => {
    notes.forEach((note) => bgmNote(note, start + beat * spb, 3.7 * spb, 0.0045, 'sine'));
  });
  BGM_BASS.forEach(([beat, note]) => {
    bgmNote(note, start + beat * spb, 3.7 * spb, 0.011, 'sine');
  });
}

function pumpBgm() {
  if (!audioCtx || !bgmGain || state.muted) return;
  const now = audioCtx.currentTime;
  if (bgmNext < now + 0.08) bgmNext = now + 0.14;
  let guard = 0;
  while (bgmNext < now + 2.4 && guard < 8) {
    scheduleBgmLoop(bgmNext);
    bgmNext += BGM_LOOP_BEATS * (60 / BGM_BPM);
    guard += 1;
  }
}

function startBgm() {
  if (state.muted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (!bgmGain) {
    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.0001;
    bgmGain.connect(ctx.destination);
  }
  const t = ctx.currentTime;
  bgmGain.gain.cancelScheduledValues(t);
  bgmGain.gain.setValueAtTime(Math.max(0.0001, bgmGain.gain.value), t);
  bgmGain.gain.linearRampToValueAtTime(0.55, t + 1.1);

  if (!bgmTimer) {
    bgmNext = t + 0.18;
    pumpBgm();
    bgmTimer = setInterval(pumpBgm, 900);
  } else {
    pumpBgm();
  }
}

function fadeBgmOut() {
  if (!audioCtx || !bgmGain) return;
  const t = audioCtx.currentTime;
  bgmGain.gain.cancelScheduledValues(t);
  bgmGain.gain.setValueAtTime(Math.max(0.0001, bgmGain.gain.value), t);
  bgmGain.gain.linearRampToValueAtTime(0.0001, t + 0.35);
}

/* ---------- effects ---------- */

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('is-show'), 1900);
}

function animateClass(name) {
  els.charFrame.classList.remove(name);
  void els.charFrame.offsetWidth;
  els.charFrame.classList.add(name);
}

function sparkleBurst() {
  if (!els.fx) return;
  const rect = els.charFrame.getBoundingClientRect();
  const symbols = ['✨', '❄️', '⭐', '💫', '🎉'];
  for (let i = 0; i < 9; i += 1) {
    const spark = document.createElement('span');
    spark.className = 'fx-spark';
    spark.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    spark.style.left = `${rect.left + rect.width * (0.12 + Math.random() * 0.76)}px`;
    spark.style.top = `${rect.top + rect.height * (0.16 + Math.random() * 0.6)}px`;
    spark.style.fontSize = `${12 + Math.random() * 12}px`;
    spark.style.setProperty('--dx', `${Math.random() * 110 - 55}px`);
    spark.style.setProperty('--rot', `${Math.random() * 180 - 90}deg`);
    spark.style.animationDelay = `${Math.random() * 0.08}s`;
    els.fx.appendChild(spark);
    setTimeout(() => spark.remove(), 1250);
  }
}

/* ---------- outfit actions ---------- */

function wear(item, { toggle = false } = {}) {
  if (item.cat === 'scene') {
    toggleDecoration(item.id, { addOnly: !toggle });
    return;
  }
  const outfit = state.outfits[state.active];
  const already = outfit[item.slot] === item.id;

  if (toggle && already) {
    outfit[item.slot] = null;
    renderAll();
    saveState();
    softPop();
    showToast(`${item.name} 벗었어요`);
    return;
  }

  if (already) return;

  outfit[item.slot] = item.id;
  renderAll();
  saveState();
  animateClass('is-equipping');
  sparkleBurst();
  chime();
}

function clearSlot(slotKey) {
  const outfit = state.outfits[state.active];
  if (!outfit[slotKey]) return;
  outfit[slotKey] = null;
  renderAll();
  saveState();
  softPop();
  const label = SLOTS.find((slot) => slot.key === slotKey);
  showToast(`${label ? label.label : '아이템'}을 벗었어요`);
}

function toggleDecoration(id, { addOnly = false } = {}) {
  const room = state.decorations[state.background];
  const item = ITEM_BY_ID[id];
  if (!item || item.cat !== 'scene') return;
  const index = room.indexOf(id);

  if (index >= 0) {
    if (addOnly) return;
    room.splice(index, 1);
    renderAll();
    saveState();
    softPop();
    showToast(`${item.name}을(를) 배경에서 뺐어요`);
    return;
  }

  room.push(id);
  renderAll();
  saveState();
  sparkleBurst();
  chime();
  showToast(`${item.name}을(를) 배경에 놓았어요`);
}

/* ---------- drag and drop ---------- */

function createGhost(item) {
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.innerHTML = `<div class="ghost-thumb">${itemPreview(item)}</div><span>${item.name}</span>`;
  document.body.appendChild(ghost);
  return ghost;
}

function moveGhost(x, y) {
  if (!dragState) return;
  dragState.ghost.style.left = `${x}px`;
  dragState.ghost.style.top = `${y}px`;

  const under = document.elementFromPoint(x, y);
  const isScene = dragState.item.cat === 'scene';
  const over = isScene
    ? Boolean(under && under.closest('#scene'))
    : Boolean(under && under.closest('#characterDrop'));

  if (over !== dragState.over) {
    dragState.over = over;
    if (isScene) {
      els.scene.classList.toggle('decor-drag-over', over);
    } else {
      els.dropZone.classList.toggle('drag-over', over);
      els.dropHint.textContent = over ? '여기에 놓으면 입혀져요!' : '옷을 끌어다 놓아 보세요';
    }
  }
}

function endDrag() {
  if (!dragState) return;
  const { item, ghost, over } = dragState;
  ghost.remove();
  els.dropZone.classList.remove('drag-over');
  els.scene.classList.remove('decor-drag-over');
  els.dropHint.textContent = '옷을 끌어다 놓아 보세요';
  document.body.classList.remove('is-dragging');
  dragState = null;
  if (!over) return;
  if (item.cat === 'scene') toggleDecoration(item.id, { addOnly: true });
  else wear(item);
}

function bindItemDrag() {
  els.itemsGrid.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' || event.button !== 0) return;
    const card = event.target.closest('.item-card');
    if (!card) return;
    const item = ITEM_BY_ID[card.dataset.id];
    if (!item) return;

    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;

    const onMove = (moveEvent) => {
      if (!active) {
        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 6) return;
        active = true;
        dragState = { item, ghost: createGhost(item), over: false };
        document.body.classList.add('is-dragging');
      }
      moveEvent.preventDefault();
      moveGhost(moveEvent.clientX, moveEvent.clientY);
    };

    const onUp = (upEvent) => {
      cleanup();
      if (active) {
        moveGhost(upEvent.clientX, upEvent.clientY);
        endDrag();
        ignoreClickUntil = Date.now() + 320;
      }
    };

    const onCancel = () => {
      cleanup();
      if (active) endDrag();
    };

    const cleanup = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
    };

    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
  });
}

/* ---------- events ---------- */

function bindEvents() {
  els.itemsGrid.addEventListener('click', (event) => {
    const card = event.target.closest('.item-card');
    if (!card) return;
    if (Date.now() < ignoreClickUntil) return;
    const item = ITEM_BY_ID[card.dataset.id];
    if (item) wear(item, { toggle: true });
  });

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (state.category === tab.dataset.cat) return;
      state.category = tab.dataset.cat;
      renderAll();
    });
  });

  document.querySelectorAll('.char-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.active === btn.dataset.char) return;
      state.active = btn.dataset.char;
      saveState();
      renderAll();
      animateClass('is-switching');
      softPop();
    });
  });

  document.querySelectorAll('.bg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.background === btn.dataset.bg) return;
      state.background = btn.dataset.bg;
      saveState();
      renderAll();
      softPop();
    });
  });

  els.outfitBar.addEventListener('click', (event) => {
    const clearBtn = event.target.closest('.slot-clear');
    if (!clearBtn) return;
    clearSlot(clearBtn.dataset.slot);
  });

  els.soundBtn.addEventListener('click', () => {
    state.muted = !state.muted;
    updateSoundButton();
    saveState();
    if (state.muted) {
      fadeBgmOut();
    } else {
      startBgm();
      chime();
    }
  });

  els.resetBtn.addEventListener('click', () => {
    state.outfits.female = blankOutfit();
    state.outfits.male = blankOutfit();
    state.decorations = blankDecor();
    renderAll();
    saveState();
    animateClass('is-switching');
    chime();
    showToast('코디와 배경 소품을 처음으로 되돌렸어요');
  });

  const armBgm = () => {
    if (!state.muted) startBgm();
  };
  document.addEventListener('pointerdown', armBgm, { once: true });
  document.addEventListener('keydown', armBgm, { once: true });

  window.addEventListener('resize', () => {
    if (dragState) els.dropZone.classList.remove('drag-over');
  });
}

/* ---------- snow ---------- */

function initSnow() {
  const count = window.matchMedia('(max-width: 680px)').matches ? 26 : 44;
  for (let i = 0; i < count; i += 1) {
    const flake = document.createElement('i');
    const size = 2 + Math.random() * 4;
    flake.style.left = `${Math.random() * 100}%`;
    flake.style.width = `${size.toFixed(1)}px`;
    flake.style.height = `${size.toFixed(1)}px`;
    flake.style.opacity = `${(0.28 + Math.random() * 0.6).toFixed(2)}`;
    flake.style.animationDuration = `${8 + Math.random() * 11}s`;
    flake.style.animationDelay = `${-Math.random() * 16}s`;
    flake.style.setProperty('--drift', `${(Math.random() * 90 - 45).toFixed(0)}px`);
    els.snow.appendChild(flake);
  }
}

/* ---------- init ---------- */

loadState();
updateSoundButton();
renderAll();
initSnow();
bindEvents();
bindItemDrag();
