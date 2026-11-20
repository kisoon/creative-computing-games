(() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  실 색상                                                            */
  /* ------------------------------------------------------------------ */
  const PALETTE = {
    C: { name: '크림', hex: '#F2E2C8' },
    P: { name: '분홍', hex: '#F191AC' },
    R: { name: '빨강', hex: '#E2605E' },
    Y: { name: '노랑', hex: '#F3C64F' },
    G: { name: '초록', hex: '#71BF8E' },
    D: { name: '진초록', hex: '#4E8A64' },
    O: { name: '주황', hex: '#F0A05B' },
    S: { name: '하늘', hex: '#A9D2EA' },
    B: { name: '파랑', hex: '#6F9FD8' },
    N: { name: '남색', hex: '#4F5F8C' },
    L: { name: '라일락', hex: '#A99AD6' },
    W: { name: '흰색', hex: '#FBF7EF' },
    E: { name: '갈색', hex: '#6E4B3A' },
  };

  /* ------------------------------------------------------------------ */
  /*  도안 10종                                                         */
  /* ------------------------------------------------------------------ */
  const PATTERNS = [
    {
      name: '나비',
      size: 9,
      palette: ['L', 'P', 'E', 'C'],
      desc: '보랏빛 날개에 분홍 점을 찍었어요. 좌우 대칭을 맞춰 한 땀씩 채워 보세요.',
      rows: [
        'CCCECECCC',
        'CLCCECCLC',
        'CLLLELLLC',
        'CLLPEPLLC',
        'CCLLELLCC',
        'CCLCECLCC',
        'CCLLELLCC',
        'CLLLELLLC',
        'CCCCCCCCC',
      ],
    },
    {
      name: '물고기',
      size: 9,
      palette: ['S', 'W', 'O', 'Y', 'E', 'G'],
      desc: '파란 물속을 헤엄치는 주황 물고기. 지느러미와 거품까지 색이 달라요.',
      rows: [
        'SSWSSWSSS',
        'SSSSYSSSS',
        'SSSOOOSSS',
        'SSOOOOYYY',
        'SOOEOOOYY',
        'SSOOOOOYY',
        'SSSOOOSSS',
        'SSSSYSSSS',
        'SGSSSSSGS',
      ],
    },
    {
      name: '설산',
      size: 10,
      palette: ['S', 'Y', 'W', 'B', 'G'],
      desc: '노란 해와 구름, 눈 덮인 산을 떠요. 하늘과 산의 경계를 잘 확인하세요.',
      rows: [
        'SSSSSSYSSS',
        'SSSSSYYYSS',
        'SWWWSSYSSS',
        'SSSSSSSSSS',
        'SSSSBBSSSS',
        'SSSBBBBSSS',
        'SSBBWWBBSS',
        'SBBWWWWBBS',
        'BBBWWWWBBB',
        'GGGGGGGGGG',
      ],
    },
    {
      name: '커피 한 잔',
      size: 10,
      palette: ['C', 'S', 'W', 'E'],
      desc: '김이 피어오르는 커피 한 잔. 크림색 거품과 갈색 커피를 구분해요.',
      rows: [
        'CCCCCCCCCC',
        'CCCSCCCSCC',
        'CCSCCCCSCC',
        'CCCSCCCSCC',
        'CWWWWWWWCC',
        'CWEEEEEWWC',
        'CWEEEEEWWC',
        'CWWWWWWWCC',
        'CCWWWWWWCC',
        'CCCCCCCCCC',
      ],
    },
    {
      name: '로켓',
      size: 10,
      palette: ['N', 'Y', 'R', 'W', 'B', 'O'],
      desc: '별이 뜬 밤하늘로 떠나는 로켓. 창문과 불꽃까지 꼼꼼히 채워요.',
      rows: [
        'NYNNNNNNYN',
        'NNNNNRRNNN',
        'NNNNRRRRNN',
        'NNNRRRRRNN',
        'NNWWWWWWNN',
        'NNWWBBWWNN',
        'NNWWBBWWNN',
        'NRWWWWWWRN',
        'NRRWWWWRRN',
        'NNNOOOONNN',
      ],
    },
    {
      name: '선인장',
      size: 9,
      palette: ['C', 'G', 'D', 'E', 'O'],
      desc: '가시는 없지만 색은 많아요. 초록 선인장과 주황 화분을 떠 보세요.',
      rows: [
        'CCCCCCCCC',
        'CCCGGGCCC',
        'CCGGGGGCC',
        'GGGGDGGGG',
        'GGGGDGGGG',
        'CCGGDGGCC',
        'CCCGGGCCC',
        'CCOEEEOCC',
        'CCOOOOOCC',
      ],
    },
    {
      name: '버섯',
      size: 9,
      palette: ['C', 'R', 'W', 'E', 'G'],
      desc: '빨간 갓에 하얀 점, 하얀 기둥. 눈까지 달린 귀여운 버섯이에요.',
      rows: [
        'CCCCCCCCC',
        'CCCRRRCCC',
        'CCRRWRRCC',
        'CRRRRRRRC',
        'RRWRRRWRR',
        'CCCWWWCCC',
        'CCCEWECCC',
        'CCCWWWCCC',
        'CGCCCCCGC',
      ],
    },
    {
      name: '아늑한 집',
      size: 9,
      palette: ['S', 'R', 'W', 'Y', 'E', 'G'],
      desc: '빨간 지붕과 노란 창문이 있는 작은 집. 초록 잔디까지 채워요.',
      rows: [
        'SSSSSSSSS',
        'SSSSRSSSS',
        'SSSRRRSSS',
        'SSRRRRRSS',
        'SRRRRRRRS',
        'SWWWWWWWS',
        'SWYYWWWWS',
        'SWYYWWEES',
        'GGGGGGGGG',
      ],
    },
    {
      name: '선물 상자',
      size: 9,
      palette: ['C', 'R', 'Y'],
      desc: '노란 리본을 묶은 빨간 선물 상자. 리본이 십자로 지나가요.',
      rows: [
        'CCCCCCCCC',
        'CCYYCYYCC',
        'CCCYCYCCC',
        'CCCCYCCCC',
        'RRRRYRRRR',
        'YYYYYYYYY',
        'RRRRYRRRR',
        'RRRRYRRRR',
        'RRRRYRRRR',
      ],
    },
    {
      name: '생일 케이크',
      size: 10,
      palette: ['C', 'Y', 'W', 'R', 'P', 'B'],
      desc: '딸기와 초, 알록달록 스프링클이 올라간 케이크. 마지막 한 조각까지!',
      rows: [
        'CCCCCCCCCC',
        'CCCCYCCCCC',
        'CCCCWCCCCC',
        'CCCCWCCCCC',
        'CWRWWWWRWC',
        'CPPPPPPPPC',
        'CPPYPPPYPC',
        'CWRWWWWRWC',
        'CPPPPPPPPC',
        'BBBBBBBBBB',
      ],
    },
  ];

  /* 이번 판에 플레이할 도안 수 */
  const RUN_LENGTH = 3;

  /* 도안 데이터 검증 */
  PATTERNS.forEach((p, i) => {
    if (p.rows.length !== p.size || p.rows.some((row) => row.length !== p.size)) {
      console.error(`도안 ${i + 1} (${p.name}) 크기가 맞지 않습니다.`);
    }
    [...p.rows.join('')].forEach((ch) => {
      if (!PALETTE[ch]) console.error(`도안 ${p.name}: 알 수 없는 실 색상 코드 "${ch}"`);
      if (!p.palette.includes(ch)) console.error(`도안 ${p.name}: 팔레트에 "${ch}"가 없습니다.`);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  DOM                                                               */
  /* ------------------------------------------------------------------ */
  const $ = (id) => document.getElementById(id);

  const boardEl = $('board');
  const boardFrame = $('boardFrame');
  const miniEl = $('mini');
  const swatchesEl = $('swatches');
  const dotsEl = $('dots');
  const overlay = $('overlay');
  const ovKicker = $('ovKicker');
  const ovTitle = $('ovTitle');
  const ovText = $('ovText');
  const endStats = $('endStats');
  const ovBtn = $('ovBtn');

  const patternCounterEl = $('patternCounter');
  const timerEl = $('timer');
  const matchedEl = $('matched');
  const movesEl = $('moves');
  const mistakesEl = $('mistakes');
  const patternNameEl = $('patternName');
  const patternMetaEl = $('patternMeta');
  const patternDescEl = $('patternDesc');
  const yarnBallEl = $('yarnBall');
  const yarnNameEl = $('yarnName');
  const muteBtn = $('muteBtn');
  const restartBtn = $('restartBtn');

  /* ------------------------------------------------------------------ */
  /*  상태                                                              */
  /* ------------------------------------------------------------------ */
  const state = {
    deck: [],
    patternIndex: 0,
    board: [],
    cursor: { r: 0, c: 0 },
    yarnIndex: 0,
    locked: false,
    gameOver: false,
    moves: 0,
    mistakes: 0,
    elapsedMs: 0,
    startTime: 0,
    timerId: null,
    transitionTimer: null,
    endTimer: null,
    muted: false,
    cellEls: [],
  };

  /* 이번 판에 플레이할 도안 3개를 무작위로 뽑습니다. */
  function pickDeck() {
    const pool = PATTERNS.map((_, i) => i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, RUN_LENGTH);
  }

  function currentPattern() {
    return PATTERNS[state.deck[state.patternIndex]];
  }

  /* ------------------------------------------------------------------ */
  /*  사운드                                                            */
  /* ------------------------------------------------------------------ */
  let audioCtx = null;
  let lastStitchSound = 0;

  function getCtx() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function tone(ctx, freq, when, dur, gain, type) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(gain, when + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start(when);
    osc.stop(when + dur + 0.03);
  }

  function sfx(kind) {
    if (state.muted) return;
    const ctx = getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;

    try {
      if (kind === 'stitch') {
        const now = performance.now();
        if (now - lastStitchSound < 35) return;
        lastStitchSound = now;
        tone(ctx, 460 + Math.random() * 120, t, 0.055, 0.022, 'triangle');
      } else if (kind === 'yarn') {
        tone(ctx, 620, t, 0.07, 0.03, 'sine');
        tone(ctx, 840, t + 0.055, 0.09, 0.024, 'sine');
      } else if (kind === 'bump') {
        tone(ctx, 150, t, 0.09, 0.035, 'sine');
      } else if (kind === 'success') {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          tone(ctx, f, t + i * 0.085, 0.28, 0.045, 'triangle');
        });
      } else if (kind === 'end') {
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
          tone(ctx, f, t + i * 0.12, 0.5, 0.05, 'triangle');
        });
      }
    } catch (err) {
      /* 사운드 실패는 게임 진행에 영향 없음 */
    }
  }

  /* ------------------------------------------------------------------ */
  /*  타이머                                                            */
  /* ------------------------------------------------------------------ */
  function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function tick() {
    if (!state.timerId) return;
    timerEl.textContent = formatTime(performance.now() - state.startTime);
  }

  function startTimer() {
    if (state.timerId || state.gameOver || state.locked) return;
    state.startTime = performance.now() - state.elapsedMs;
    state.timerId = setInterval(tick, 200);
    tick();
  }

  function stopTimer() {
    if (!state.timerId) return;
    clearInterval(state.timerId);
    state.timerId = null;
    state.elapsedMs = performance.now() - state.startTime;
    timerEl.textContent = formatTime(state.elapsedMs);
  }

  /* ------------------------------------------------------------------ */
  /*  렌더링                                                            */
  /* ------------------------------------------------------------------ */
  function renderBoard(p) {
    boardEl.innerHTML = '';
    boardEl.style.setProperty('--size', p.size);
    state.cellEls = [];

    for (let r = 0; r < p.size; r++) {
      const rowEls = [];
      for (let c = 0; c < p.size; c++) {
        const target = p.rows[r][c];
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.style.setProperty('--target', PALETTE[target].hex);
        cell.dataset.r = r;
        cell.dataset.c = c;

        const yarn = document.createElement('div');
        yarn.className = 'yarn';
        cell.appendChild(yarn);

        boardEl.appendChild(cell);
        rowEls.push(cell);
      }
      state.cellEls.push(rowEls);
    }

    updateCursor(null);
  }

  function renderMini(p) {
    miniEl.innerHTML = '';
    miniEl.style.gridTemplateColumns = `repeat(${p.size}, 1fr)`;
    p.rows.forEach((row) => {
      [...row].forEach((ch) => {
        const cell = document.createElement('div');
        cell.style.background = PALETTE[ch].hex;
        cell.title = PALETTE[ch].name;
        cell.dataset.color = ch;
        miniEl.appendChild(cell);
      });
    });
  }

  function renderSwatches(p) {
    swatchesEl.innerHTML = '';
    p.palette.forEach((ch, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.dataset.color = ch;
      btn.innerHTML = `<span class="dot" style="--c:${PALETTE[ch].hex}"></span>${PALETTE[ch].name}`;
      btn.addEventListener('click', () => {
        selectYarn(i);
        btn.blur();
      });
      swatchesEl.appendChild(btn);
    });
  }

  function renderYarn() {
    const p = currentPattern();
    const ch = p.palette[state.yarnIndex];
    yarnBallEl.style.setProperty('--yarn-ui', PALETTE[ch].hex);
    yarnNameEl.textContent = PALETTE[ch].name;
    [...swatchesEl.children].forEach((el, i) => {
      el.classList.toggle('active', i === state.yarnIndex);
    });
  }

  function updateCursor(prev) {
    if (prev) {
      const old = state.cellEls[prev.r] && state.cellEls[prev.r][prev.c];
      if (old) old.classList.remove('cursor');
    }
    const el = state.cellEls[state.cursor.r] && state.cellEls[state.cursor.r][state.cursor.c];
    if (el) el.classList.add('cursor');
  }

  function updateCell(r, c, animate) {
    const p = currentPattern();
    const cell = state.cellEls[r][c];
    const knit = state.board[r][c];

    cell.classList.toggle('knit', Boolean(knit));
    cell.classList.toggle('wrong', Boolean(knit) && knit !== p.rows[r][c]);

    if (knit) cell.style.setProperty('--yarn', PALETTE[knit].hex);

    if (animate) {
      cell.classList.remove('pop');
      void cell.offsetWidth;
      cell.classList.add('pop');
      setTimeout(() => cell.classList.remove('pop'), 360);
    }
  }

  function renderDots() {
    [...dotsEl.children].forEach((dot, i) => {
      const done = i < state.patternIndex || (state.locked && i === state.patternIndex);
      dot.classList.toggle('done', done);
      dot.classList.toggle('active', i === state.patternIndex && !state.locked);
    });
  }

  function countCorrect() {
    const p = currentPattern();
    let correct = 0;
    for (let r = 0; r < p.size; r++) {
      for (let c = 0; c < p.size; c++) {
        if (state.board[r][c] === p.rows[r][c]) correct++;
      }
    }
    return correct;
  }

  function updateHUD() {
    const p = currentPattern();
    matchedEl.textContent = `${countCorrect()} / ${p.size * p.size}`;
    movesEl.textContent = String(state.moves);
    mistakesEl.textContent = String(state.mistakes);
    patternCounterEl.textContent = `${state.patternIndex + 1} / ${RUN_LENGTH}`;
  }

  /* ------------------------------------------------------------------ */
  /*  도안 로드                                                         */
  /* ------------------------------------------------------------------ */
  function loadPattern(index) {
    state.patternIndex = index;
    const p = currentPattern();
    state.board = Array.from({ length: p.size }, () => Array(p.size).fill(null));
    state.cursor = {
      r: Math.floor(p.size / 2),
      c: Math.floor(p.size / 2),
    };
    state.locked = false;

    /* 시작 칸의 도안 색과 같은 실을 미리 집어 듭니다. */
    const centerChar = p.rows[state.cursor.r][state.cursor.c];
    const centerIdx = p.palette.indexOf(centerChar);
    state.yarnIndex = centerIdx > -1 ? centerIdx : 0;

    renderBoard(p);
    renderMini(p);
    renderSwatches(p);
    renderYarn();
    renderDots();
    updateHUD();
    updateTimerLabel();

    patternNameEl.textContent = p.name;
    patternMetaEl.textContent = `${p.size} × ${p.size} · ${p.palette.length}가지 실`;
    patternDescEl.textContent = p.desc;

    boardFrame.classList.remove('complete');
    hideOverlay();
  }

  function updateTimerLabel() {
    timerEl.textContent = formatTime(state.timerId ? performance.now() - state.startTime : state.elapsedMs);
  }

  /* ------------------------------------------------------------------ */
  /*  입력 처리                                                         */
  /* ------------------------------------------------------------------ */
  function applyKnit(r, c) {
    const p = currentPattern();
    const ch = p.palette[state.yarnIndex];

    if (state.board[r][c] === ch) return;

    state.board[r][c] = ch;
    if (ch !== p.rows[r][c]) state.mistakes++;

    updateCell(r, c, true);
    sfx('stitch');
  }

  function move(dr, dc) {
    if (state.locked || state.gameOver) return;

    const p = currentPattern();
    const nr = state.cursor.r + dr;
    const nc = state.cursor.c + dc;

    if (nr < 0 || nr >= p.size || nc < 0 || nc >= p.size) {
      sfx('bump');
      return;
    }

    startTimer();

    const prev = state.cursor;
    state.cursor = { r: nr, c: nc };
    updateCursor(prev);

    applyKnit(nr, nc);
    state.moves++;

    updateHUD();
    checkComplete();
  }

  function selectYarn(i) {
    if (state.locked || state.gameOver) return;
    if (state.yarnIndex === i) return;
    state.yarnIndex = i;
    renderYarn();
    sfx('yarn');
  }

  function cycleYarn() {
    if (state.locked || state.gameOver) return;
    const p = currentPattern();
    state.yarnIndex = (state.yarnIndex + 1) % p.palette.length;
    renderYarn();
    sfx('yarn');
  }

  /* ------------------------------------------------------------------ */
  /*  완료 처리                                                         */
  /* ------------------------------------------------------------------ */
  function checkComplete() {
    const p = currentPattern();
    const total = p.size * p.size;
    if (countCorrect() === total) completePattern();
  }

  function completePattern() {
    if (state.locked) return;
    state.locked = true;
    stopTimer();
    renderDots();
    updateHUD();
    boardFrame.classList.add('complete');
    sfx('success');

    const p = currentPattern();
    const isLast = state.patternIndex === RUN_LENGTH - 1;

    if (isLast) {
      state.gameOver = true;
      state.endTimer = setTimeout(() => {
        state.endTimer = null;
        if (!state.gameOver) return;
        sfx('end');
        showEnd();
      }, 550);
      return;
    }

    showOverlay({
      kicker: `${state.patternIndex + 1} / ${RUN_LENGTH} 완성`,
      title: p.name,
      text: '다음 도안을 준비하고 있어요…',
      stats: null,
      button: false,
    });

    const finishedIndex = state.patternIndex;
    state.transitionTimer = setTimeout(() => {
      state.transitionTimer = null;
      if (state.gameOver || state.patternIndex !== finishedIndex) return;
      loadPattern(finishedIndex + 1);
    }, 1700);
  }

  function showOverlay({ kicker, title, text, stats, button }) {
    ovKicker.textContent = kicker;
    ovTitle.textContent = title;
    ovText.textContent = text;

    if (stats && stats.length) {
      endStats.hidden = false;
      endStats.innerHTML = stats
        .map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`)
        .join('');
    } else {
      endStats.hidden = true;
      endStats.innerHTML = '';
    }

    ovBtn.hidden = !button;
    overlay.hidden = false;
  }

  function hideOverlay() {
    overlay.hidden = true;
  }

  function showEnd() {
    showOverlay({
      kicker: '3개 도안 완성',
      title: '수고했어요! 🧶',
      text: '세 개의 도안을 모두 떴어요. 손끝이 따뜻해졌나요?',
      stats: [
        ['시간', formatTime(state.elapsedMs)],
        ['이동', `${state.moves}번`],
        ['실수', `${state.mistakes}회`],
      ],
      button: true,
    });
  }

  function restartGame() {
    hideOverlay();
    stopTimer();
    if (state.transitionTimer) {
      clearTimeout(state.transitionTimer);
      state.transitionTimer = null;
    }
    if (state.endTimer) {
      clearTimeout(state.endTimer);
      state.endTimer = null;
    }
    state.elapsedMs = 0;
    state.startTime = 0;
    state.timerId = null;
    state.moves = 0;
    state.mistakes = 0;
    state.gameOver = false;
    state.locked = false;
    timerEl.textContent = '0:00';
    state.deck = pickDeck();
    loadPattern(0);
    sfx('yarn');
  }

  /* ------------------------------------------------------------------ */
  /*  사운드 토글                                                       */
  /* ------------------------------------------------------------------ */
  function updateMuteButton() {
    muteBtn.textContent = state.muted ? '🔇 꺼짐' : '🔊 소리';
    muteBtn.setAttribute('aria-label', state.muted ? '소리 켜기' : '소리 끄기');
  }

  function toggleMute() {
    state.muted = !state.muted;
    try {
      localStorage.setItem('shoe-knit-muted', state.muted ? '1' : '0');
    } catch (err) { /* ignore */ }
    updateMuteButton();
    if (!state.muted) sfx('yarn');
  }

  /* ------------------------------------------------------------------ */
  /*  이벤트                                                            */
  /* ------------------------------------------------------------------ */
  const ARROWS = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  };

  window.addEventListener('keydown', (e) => {
    const k = e.key;
    const isSpace = k === ' ' || k === 'Space' || k === 'Spacebar';

    if (k.startsWith('Arrow') || isSpace) e.preventDefault();

    if (k === 'm' || k === 'M') {
      toggleMute();
      return;
    }
    if (k === 'r' || k === 'R') {
      restartGame();
      return;
    }
    if (state.gameOver) {
      if (k === 'Enter') {
        e.preventDefault();
        restartGame();
      }
      return;
    }

    if (isSpace) {
      if (!e.repeat) cycleYarn();
      return;
    }

    const dir = ARROWS[k];
    if (dir) move(dir[0], dir[1]);
  });

  ovBtn.addEventListener('click', () => {
    restartGame();
    ovBtn.blur();
  });

  restartBtn.addEventListener('click', () => {
    restartGame();
    restartBtn.blur();
  });

  muteBtn.addEventListener('click', () => {
    toggleMute();
    muteBtn.blur();
  });

  /* ------------------------------------------------------------------ */
  /*  시작                                                              */
  /* ------------------------------------------------------------------ */
  function init() {
    for (let i = 0; i < RUN_LENGTH; i++) {
      const dot = document.createElement('i');
      dotsEl.appendChild(dot);
    }

    try {
      state.muted = localStorage.getItem('shoe-knit-muted') === '1';
    } catch (err) { /* ignore */ }
    updateMuteButton();

    state.deck = pickDeck();
    loadPattern(0);
    updateTimerLabel();
  }

  init();
})();
