/* NEON BEAT — app shell, game flow, home UI */
(function () {
  "use strict";

  const tracks = window.NeonTracks.tracks;
  const renderer = window.NeonRenderer;
  const audio = new window.NeonAudio();
  const STORAGE_KEY = "neonbeat.scores.v1";
  const SETTINGS_KEY = "neonbeat.settings.v1";
  const KEYS = ["KeyD", "KeyF", "KeyJ", "KeyK"];
  const LANE_LABELS = ["D", "F", "J", "K"];
  const GRADE_LABELS = { perfect: "PERFECT", good: "GOOD", nice: "NICE", bad: "BAD", miss: "MISS" };
  const GRADE_COLORS = {
    perfect: "#ffd166",
    good: "#8dffbf",
    nice: "#4de8ff",
    bad: "#ff5d5d",
    miss: "#aeb7c8"
  };
  const BASE_SCORE = { perfect: 300, good: 200, nice: 100 };
  const HOLD_BONUS = 500;
  const SNAKE_CHECKPOINT_SCORE = 120;
  const SNAKE_BONUS = 700;
  const EARLY_WINDOW = 0.175;
  const LATE_WINDOW = 0.165;
  const COUNTDOWN = 3.8;
  const RESUME_STEP = 500;

  const dom = {
    home: document.getElementById("homeScreen"),
    game: document.getElementById("gameScreen"),
    stage: document.getElementById("gameStage"),
    canvas: document.getElementById("gameCanvas"),
    grid: document.getElementById("songGrid"),
    startCta: document.getElementById("startCta"),
    library: document.getElementById("library"),
    soundToggle: document.getElementById("soundToggle"),
    soundLabel: document.querySelector(".sound-label"),
    difficultyButtons: Array.from(document.querySelectorAll("[data-difficulty]")),
    speedButtons: Array.from(document.querySelectorAll("[data-speed]")),
    helpModal: document.getElementById("helpModal"),
    helpClose: document.getElementById("helpClose"),
    helpStart: document.getElementById("helpStart"),
    helpOpeners: Array.from(document.querySelectorAll("[data-open-help]")),
    pauseButton: document.getElementById("pauseButton"),
    pauseOverlay: document.getElementById("pauseOverlay"),
    resumeButton: document.getElementById("resumeButton"),
    quitButton: document.getElementById("quitButton"),
    countdownOverlay: document.getElementById("countdownOverlay"),
    countdownNumber: document.getElementById("countdownNumber"),
    countdownKicker: document.querySelector(".countdown-kicker"),
    countdownTrack: document.getElementById("countdownTrack"),
    judgement: document.getElementById("judgement"),
    judgementText: document.getElementById("judgementText"),
    judgementSub: document.getElementById("judgementSub"),
    flowPanel: document.getElementById("flowPanel"),
    flowGrade: document.getElementById("flowGrade"),
    comboDisplay: document.getElementById("comboDisplay"),
    scoreDisplay: document.getElementById("scoreDisplay"),
    hudTrackTitle: document.getElementById("hudTrackTitle"),
    hudTrackSubtitle: document.getElementById("hudTrackSubtitle"),
    hudBpm: document.getElementById("hudBpm"),
    hudDifficulty: document.getElementById("hudDifficulty"),
    songTimer: document.getElementById("songTimer"),
    songDuration: document.getElementById("songDuration"),
    songProgress: document.getElementById("songProgress"),
    snakeAlert: document.getElementById("snakeAlert"),
    resultOverlay: document.getElementById("resultOverlay"),
    resultStats: document.getElementById("resultStats"),
    resultScore: document.getElementById("resultScore"),
    resultTrack: document.getElementById("resultTrack"),
    resultHeadline: document.getElementById("resultHeadline"),
    resultMessage: document.getElementById("resultMessage"),
    newBestBadge: document.getElementById("newBestBadge"),
    rankRing: document.getElementById("rankRing"),
    rankLetter: document.getElementById("rankLetter"),
    retryButton: document.getElementById("retryButton"),
    libraryButton: document.getElementById("libraryButton")
  };

  function loadJSON(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) { /* storage unavailable */ }
  }

  const storedSettings = loadJSON(SETTINGS_KEY, {});
  const validDifficulty = storedSettings.difficulty === "hard" ? "hard" : "normal";
  const validSpeed = [1, 1.25, 1.5].includes(Number(storedSettings.speed)) ? Number(storedSettings.speed) : 1.25;

  const state = {
    screen: "home",
    difficulty: validDifficulty,
    speedFactor: validSpeed,
    muted: !!storedSettings.muted,
    starting: false,
    phase: "idle",
    pausedPhase: "playing",
    song: null,
    chart: null,
    track: null,
    startAt: 0,
    songTime: 0,
    score: 0,
    streak: 0,
    consecutiveMisses: 0,
    stats: { perfect: 0, good: 0, nice: 0, miss: 0, maxCombo: 0 },
    keys: [false, false, false, false],
    activeHolds: [],
    activeSnake: null,
    particles: [],
    rings: [],
    laneFlashes: [],
    missFlashUntil: 0,
    shakeUntil: 0,
    resumeGraceUntil: 0,
    snakeAlertVisible: false,
    judgementSerial: 0,
    finished: false
  };

  let scores = loadJSON(STORAGE_KEY, {});
  let loopToken = 0;
  let rafId = 0;
  let resumeToken = 0;
  let pointerLanes = new Map();
  let lastCountdownValue = "";

  audio.muted = state.muted;
  audio.volume = 0.7;

  function saveSettings() {
    saveJSON(SETTINGS_KEY, {
      difficulty: state.difficulty,
      speed: state.speedFactor,
      muted: state.muted
    });
  }

  function formatClock(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
  }

  function formatScore(score) {
    return String(Math.max(0, Math.round(score))).padStart(7, "0");
  }

  function bestFor(trackId, difficulty) {
    const trackScores = scores[trackId];
    return trackScores && trackScores[difficulty] ? trackScores[difficulty] : null;
  }

  function saveBest(trackId, difficulty, result) {
    if (!scores[trackId]) scores[trackId] = {};
    scores[trackId][difficulty] = result;
    saveJSON(STORAGE_KEY, scores);
  }

  function updateSoundUi() {
    if (!dom.soundToggle) return;
    dom.soundToggle.classList.toggle("is-muted", state.muted);
    dom.soundToggle.setAttribute("aria-pressed", String(!state.muted));
    if (dom.soundLabel) dom.soundLabel.textContent = state.muted ? "SOUND OFF" : "SOUND ON";
  }

  function updateDifficultyUi() {
    dom.difficultyButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.difficulty === state.difficulty);
    });
    dom.speedButtons.forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.speed) === state.speedFactor);
    });
  }

  function waveMarkup(seed, count) {
    let markup = "";
    for (let i = 0; i < count; i += 1) {
      const height = 7 + Math.round((Math.abs(Math.sin(seed + i * 1.71)) * 31) + (Math.abs(Math.cos(seed * 0.7 + i * 2.33)) * 12));
      const delay = (-(i * 0.13)).toFixed(2);
      markup += '<i style="height:' + height + "px;animation-delay:" + delay + 's"></i>';
    }
    return markup;
  }

  function renderHome() {
    const glyphs = ["♬", "♫", "♪", "♩", "𝄞", "♬"];
    dom.grid.innerHTML = tracks.map((track, index) => {
      const level = track.level[state.difficulty] || 1;
      const best = bestFor(track.id, state.difficulty);
      const duration = window.NeonTracks.formatDuration(window.NeonTracks.getSong(track.id).duration);
      const snake = track.sections.some((section) => section.snake);
      const dots = Array.from({ length: 5 }, (_, dotIndex) => '<i class="' + (dotIndex < level ? "is-on" : "") + '"></i>').join("");
      return (
        '<button type="button" class="song-card" data-track="' + track.id + '" style="--accent:' + track.accent + ";--accent-2:" + track.accent2 + '" aria-label="' + track.title + " " + state.difficulty.toUpperCase() + ' 플레이">' +
          '<span class="song-cover">' +
            '<span class="cover-index">' + track.index + " / 06</span>" +
            '<span class="song-tag">' + track.tag + "</span>" +
            '<span class="cover-art-label">' + (state.difficulty === "hard" && snake ? "SNAKE MODE" : "4 KEY RHYTHM") + "</span>" +
            '<span class="cover-glyph">' + glyphs[index % glyphs.length] + "</span>" +
            '<span class="cover-note">' + (index % 2 === 0 ? "♪" : "♫") + "</span>" +
            '<span class="cover-wave" aria-hidden="true">' + waveMarkup(index * 1.4 + track.bpm * 0.02, 18) + "</span>" +
            '<span class="play-disc" aria-hidden="true">▶</span>' +
          "</span>" +
          '<span class="song-body">' +
            '<span class="song-kicker"><i></i>' + state.difficulty.toUpperCase() + (state.difficulty === "hard" && snake ? " · SNAKE" : "") + "</span>" +
            "<h3>" + track.title + "</h3>" +
            '<span class="song-subtitle">' + track.subtitle + "</span>" +
            '<span class="song-meta">' +
              "<span>BPM " + track.bpm + "</span>" +
              '<span class="meta-divider"></span>' +
              "<span>" + duration + "</span>" +
              '<span class="meta-divider"></span>' +
              '<span class="difficulty-dots" aria-label="난이도 ' + level + ' / 5">' + dots + "</span>" +
              '<span class="best-score">BEST ' + (best ? Number(best.score).toLocaleString("ko-KR") : "—") + "</span>" +
            "</span>" +
          "</span>" +
        "</button>"
      );
    }).join("");
    updateDifficultyUi();
    updateSoundUi();
  }

  function setJudgement(grade, text, sub) {
    dom.judgement.className = "judgement";
    dom.judgement.dataset.grade = grade;
    dom.judgementText.textContent = text;
    dom.judgementSub.textContent = sub || "";
    void dom.judgement.offsetWidth;
    dom.judgement.classList.add("is-visible");
    if (grade === "perfect") dom.judgement.classList.add("is-perfect-fx");
    state.judgementSerial += 1;
  }

  function updateFlow(grade) {
    const label = grade ? (GRADE_LABELS[grade] || grade.toUpperCase()) : "READY";
    dom.flowPanel.dataset.grade = grade || "idle";
    dom.flowGrade.textContent = label;
    dom.comboDisplay.textContent = String(state.streak);
  }

  function updateScoreDisplay() {
    dom.scoreDisplay.textContent = formatScore(state.score);
  }

  function setCountdownValue(value, kicker) {
    if (lastCountdownValue === String(value) && dom.countdownKicker.textContent === kicker) return;
    lastCountdownValue = String(value);
    dom.countdownNumber.textContent = String(value);
    if (kicker) dom.countdownKicker.textContent = kicker;
    if (typeof dom.countdownNumber.animate === "function") {
      dom.countdownNumber.animate(
        [
          { transform: "scale(1.16)", opacity: 0.5 },
          { transform: "scale(1)", opacity: 1 }
        ],
        { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" }
      );
    }
  }

  function showCountdown() {
    dom.countdownOverlay.classList.remove("is-hidden");
    dom.countdownNumber.classList.remove("is-go");
  }

  function hideCountdown() {
    dom.countdownOverlay.classList.add("is-hidden");
    dom.countdownNumber.classList.remove("is-go");
  }

  function resetCountdown() {
    lastCountdownValue = "";
    dom.countdownNumber.classList.remove("is-go");
    dom.countdownKicker.textContent = "GET READY";
  }

  function openHelp() {
    dom.helpModal.classList.remove("is-hidden");
    document.body.style.overflow = "hidden";
    window.setTimeout(() => dom.helpClose.focus(), 30);
  }

  function closeHelp() {
    dom.helpModal.classList.add("is-hidden");
    document.body.style.overflow = "";
  }

  function stopLoop() {
    loopToken += 1;
    window.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function startLoop() {
    stopLoop();
    const token = loopToken;
    const frame = () => {
      if (token !== loopToken || state.screen !== "game") return;
      const now = audio.now();
      audio.schedule();
      if (state.phase === "playing" || state.phase === "countdown") {
        updateGame(now);
      }
      renderer.draw(state, now);
      rafId = window.requestAnimationFrame(frame);
    };
    rafId = window.requestAnimationFrame(frame);
  }

  function releaseAllKeys() {
    state.keys = [false, false, false, false];
    pointerLanes.clear();
  }

  async function toggleSound() {
    await audio.unlock();
    state.muted = !state.muted;
    audio.setMuted(state.muted);
    saveSettings();
    updateSoundUi();
    if (!state.muted) audio.uiClick();
  }

  async function startGame(trackId) {
    if (state.starting) return;
    state.starting = true;
    const track = tracks.find((item) => item.id === trackId);
    if (!track) {
      state.starting = false;
      return;
    }
    try {
      await audio.unlock();
    } catch (error) { /* browser without audio still gets a silent stage */ }

    if (!audio.ctx) {
      window.alert("이 브라우저에서는 Web Audio를 사용할 수 없어 음악 없이 플레이합니다.");
    }

    stopLoop();
    audio.stopSong(0.06);
    const song = window.NeonTracks.getSong(track.id);
    const chart = window.NeonTracks.getChart(track.id, state.difficulty);
    if (!song || !chart) {
      state.starting = false;
      return;
    }

    resetCountdown();
    state.screen = "game";
    state.track = track;
    state.song = song;
    state.chart = chart;
    state.songTime = -COUNTDOWN;
    state.score = 0;
    state.streak = 0;
    state.consecutiveMisses = 0;
    state.stats = { perfect: 0, good: 0, nice: 0, miss: 0, maxCombo: 0 };
    state.activeHolds = [];
    state.activeSnake = null;
    state.particles = [];
    state.rings = [];
    state.laneFlashes = [];
    state.missFlashUntil = 0;
    state.shakeUntil = 0;
    state.resumeGraceUntil = 0;
    state.snakeAlertVisible = false;
    state.finished = false;
    state.keys = [false, false, false, false];
    pointerLanes.clear();
    chart.notes.forEach((note) => {
      note.status = "pending";
      note.statusAt = 0;
      note.judged = false;
      note.holdProgress = 0;
      note.snakeIndex = -1;
      if (note.checkpoints) note.checkpoints.forEach((checkpoint) => { checkpoint.passed = false; });
    });

    dom.home.classList.add("is-hidden");
    dom.game.classList.remove("is-hidden");
    dom.game.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-playing");
    renderer.resize(state.speedFactor);

    dom.hudTrackTitle.textContent = track.title;
    dom.hudTrackSubtitle.textContent = track.subtitle;
    dom.hudBpm.textContent = "BPM " + track.bpm;
    dom.hudDifficulty.textContent = state.difficulty.toUpperCase();
    dom.hudDifficulty.classList.toggle("is-hard", state.difficulty === "hard");
    dom.songDuration.textContent = formatClock(song.duration);
    dom.songTimer.textContent = "0:00";
    dom.songProgress.style.width = "0%";
    dom.scoreDisplay.textContent = formatScore(0);
    updateFlow(null);
    dom.comboDisplay.textContent = "0";
    dom.judgement.className = "judgement";
    dom.pauseOverlay.classList.add("is-hidden");
    dom.resultOverlay.classList.add("is-hidden");
    dom.newBestBadge.classList.add("is-hidden");
    dom.snakeAlert.classList.remove("is-visible");
    dom.countdownTrack.textContent = track.title + " · " + state.difficulty.toUpperCase();
    showCountdown();
    setCountdownValue("3", "GET READY");

    const startAt = audio.now() + COUNTDOWN;
    state.startAt = startAt;
    state.phase = "countdown";
    if (audio.ctx) {
      audio.startSong(song, startAt);
      [3, 2, 1, 0].forEach((offset) => {
        const when = startAt - offset;
        if (when > audio.now() + 0.02) audio.countAt(when, offset === 0);
      });
    }
    startLoop();
    state.starting = false;
  }

  function quitToHome() {
    stopLoop();
    resumeToken += 1;
    audio.stopSong(0.12);
    if (audio.ctx && audio.ctx.state !== "running") audio.resume();
    state.phase = "idle";
    state.screen = "home";
    state.activeSnake = null;
    state.activeHolds = [];
    releaseAllKeys();
    dom.game.classList.add("is-hidden");
    dom.game.setAttribute("aria-hidden", "true");
    dom.home.classList.remove("is-hidden");
    dom.pauseOverlay.classList.add("is-hidden");
    dom.resultOverlay.classList.add("is-hidden");
    dom.countdownOverlay.classList.add("is-hidden");
    dom.snakeAlert.classList.remove("is-visible");
    document.body.classList.remove("is-playing");
    renderHome();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function pauseGame() {
    if (state.phase !== "playing" && state.phase !== "countdown") return;
    state.pausedPhase = state.phase;
    state.phase = "paused";
    releaseAllKeys();
    audio.suspend();
    dom.pauseOverlay.classList.remove("is-hidden");
    dom.snakeAlert.classList.remove("is-visible");
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function resumeGame() {
    if (state.phase !== "paused") return;
    const token = ++resumeToken;
    dom.pauseOverlay.classList.add("is-hidden");

    if (state.pausedPhase === "countdown") {
      await audio.resume();
      if (token !== resumeToken) return;
      state.phase = "countdown";
      return;
    }

    state.phase = "resuming";
    showCountdown();
    dom.countdownKicker.textContent = "RESUME";
    dom.countdownTrack.textContent = state.track.title + " · " + state.difficulty.toUpperCase();
    for (const value of ["3", "2", "1"]) {
      if (token !== resumeToken) return;
      setCountdownValue(value, "RESUME");
      await wait(RESUME_STEP);
    }
    if (token !== resumeToken) return;
    setCountdownValue("GO!", "RESUME");
    await wait(160);
    if (token !== resumeToken) return;
    await audio.resume();
    if (token !== resumeToken) return;
    state.phase = "playing";
    state.resumeGraceUntil = audio.now() + 0.7;
    hideCountdown();
  }

  function backToLibrary() {
    if (state.phase === "paused") audio.resume();
    quitToHome();
  }

  function gradeForStreak(streak) {
    if (streak >= 3) return "perfect";
    if (streak === 2) return "good";
    return "nice";
  }

  function spawnHit(lane, grade, now) {
    if (!renderer.metrics) return;
    const x = renderer.laneCenter(lane);
    const y = renderer.metrics.hitY;
    const color = GRADE_COLORS[grade] || GRADE_COLORS.nice;
    const count = grade === "perfect" ? 18 : grade === "good" ? 13 : 9;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.random() - 0.5) * Math.PI * 0.92;
      const speed = 90 + Math.random() * 260;
      state.particles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 12,
        vx: Math.cos(angle) * speed * (Math.random() < 0.5 ? -1 : 1),
        vy: -80 - Math.random() * 210,
        size: 2 + Math.random() * 5,
        color,
        born: now,
        life: 0.4 + Math.random() * 0.4,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 8,
        shape: Math.random() < 0.4 ? "diamond" : "rect"
      });
    }
    state.rings.push({ x, y, max: renderer.metrics.laneW * 1.1, color, born: now, life: 0.36 });
    state.laneFlashes[lane] = { until: now + 0.22, color };
  }

  function spawnMiss(lane, now) {
    if (!renderer.metrics) return;
    const x = renderer.laneCenter(lane);
    const y = renderer.metrics.hitY;
    for (let i = 0; i < 7; i += 1) {
      state.particles.push({
        x: x + (Math.random() - 0.5) * 22,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 150,
        vy: -30 - Math.random() * 90,
        size: 2 + Math.random() * 3,
        color: GRADE_COLORS.bad,
        born: now,
        life: 0.28 + Math.random() * 0.25,
        rot: 0,
        spin: 1,
        shape: "rect"
      });
    }
  }

  function spawnHoldTick(lane, now) {
    if (!renderer.metrics) return;
    const x = renderer.laneCenter(lane) + (Math.random() - 0.5) * renderer.metrics.laneW * 0.5;
    const y = renderer.metrics.keyTop + Math.random() * 34;
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 40,
      vy: -25 - Math.random() * 55,
      size: 1.5 + Math.random() * 2.5,
      color: GRADE_COLORS.nice,
      born: now,
      life: 0.35 + Math.random() * 0.2,
      rot: Math.random() * Math.PI,
      spin: 2,
      shape: "diamond"
    });
  }

  function registerComboHit(lane, now, bonus, extraLabel) {
    state.streak += 1;
    state.consecutiveMisses = 0;
    state.stats.maxCombo = Math.max(state.stats.maxCombo, state.streak);
    const grade = gradeForStreak(state.streak);
    const points = (BASE_SCORE[grade] || 100) + (bonus || 0);
    state.stats[grade] += 1;
    state.score += points;
    const label = "+" + points + (extraLabel ? " · " + extraLabel : "") + " · " + state.streak + " COMBO";
    setJudgement(grade, GRADE_LABELS[grade], label);
    updateFlow(grade);
    updateScoreDisplay();
    spawnHit(lane, grade, now);
    audio.hit(grade, lane);
    return grade;
  }

  function missNote(note, reason) {
    if (!note || note.status === "hit" || note.status === "missed") return;
    const now = audio.now();
    note.status = "missed";
    note.statusAt = now;
    note.judged = true;
    state.streak = 0;
    state.consecutiveMisses += 1;
    state.stats.miss += 1;
    state.missFlashUntil = now + 0.32;
    state.shakeUntil = now + 0.2;
    spawnMiss(note.lane, now);
    audio.miss();
    const bad = state.consecutiveMisses >= 2;
    const reasonText = reason === "hold"
      ? "HOLD BREAK"
      : reason === "snake"
        ? "SNAKE BREAK"
        : "타이밍을 놓쳤어요";
    setJudgement(bad ? "bad" : "miss", bad ? "BAD" : "MISS", bad ? "2연속 미스 · FLOW RESET" : reasonText);
    updateFlow(bad ? "bad" : "miss");
    updateScoreDisplay();
  }

  function findHittable(lane) {
    let best = null;
    let bestDistance = Infinity;
    state.chart.notes.forEach((note) => {
      if (note.status !== "pending") return;
      const noteLane = note.type === "snake" ? note.path[0].lane : note.lane;
      if (noteLane !== lane) return;
      const delta = state.songTime - note.time;
      if (delta < -EARLY_WINDOW || delta > LATE_WINDOW) return;
      const distance = Math.abs(delta);
      if (distance < bestDistance) {
        best = note;
        bestDistance = distance;
      }
    });
    return best;
  }

  function startHold(note, now) {
    note.status = "active";
    note.statusAt = now;
    const item = { note, lastTick: state.songTime };
    state.activeHolds.push(item);
    state.score += 80;
    updateScoreDisplay();
    setJudgement("nice", "HOLD", "끝까지 누르고 있어요 · +80");
    audio.hit("nice", note.lane);
    state.laneFlashes[note.lane] = { until: now + 0.25, color: GRADE_COLORS.nice };
  }

  function completeHold(item, now) {
    const index = state.activeHolds.indexOf(item);
    if (index < 0) return;
    state.activeHolds.splice(index, 1);
    const note = item.note;
    if (note.status !== "active") return;
    note.status = "hit";
    note.statusAt = now;
    note.judged = true;
    registerComboHit(note.lane, now, HOLD_BONUS, "HOLD CLEAR");
    audio.holdClear();
    for (let i = 0; i < 12; i += 1) spawnHoldTick(note.lane, now);
  }

  function failHold(item) {
    const index = state.activeHolds.indexOf(item);
    if (index >= 0) state.activeHolds.splice(index, 1);
    const note = item.note;
    if (note.status !== "active") return;
    missNote(note, "hold");
  }

  function startSnake(note, now) {
    note.status = "active";
    note.statusAt = now;
    if (note.checkpoints && note.checkpoints[0]) note.checkpoints[0].passed = true;
    const next = note.path.length > 1 ? note.path[1] : note.path[0];
    state.activeSnake = {
      note,
      nextCheckpoint: 1,
      requiredLane: next.lane
    };
    state.score += SNAKE_CHECKPOINT_SCORE;
    updateScoreDisplay();
    setJudgement("good", "SNAKE", LANE_LABELS[next.lane] + " 키로 이어서 따라가세요");
    audio.snakeTick();
    if (renderer.metrics) {
      state.rings.push({
        x: renderer.laneCenter(note.path[0].lane),
        y: renderer.metrics.hitY,
        max: renderer.metrics.laneW * 1.4,
        color: GRADE_COLORS.good,
        born: now,
        life: 0.5
      });
    }
    note.lane = note.path[0].lane;
  }

  function completeSnake(now) {
    if (!state.activeSnake) return;
    const note = state.activeSnake.note;
    state.activeSnake = null;
    note.status = "hit";
    note.statusAt = now;
    note.judged = true;
    registerComboHit(note.lane, now, SNAKE_BONUS, "SNAKE CLEAR");
    audio.holdClear();
    if (renderer.metrics) {
      note.path.forEach((point) => {
        state.rings.push({
          x: renderer.laneCenter(point.lane),
          y: renderer.metrics.hitY - point.offset * 18,
          max: renderer.metrics.laneW * 0.8,
          color: GRADE_COLORS.good,
          born: now,
          life: 0.55
        });
      });
    }
  }

  function failSnake() {
    if (!state.activeSnake) return;
    const note = state.activeSnake.note;
    state.activeSnake = null;
    missNote(note, "snake");
  }

  function updateHolds(now) {
    if (!state.activeHolds.length) return;
    for (let i = state.activeHolds.length - 1; i >= 0; i -= 1) {
      const item = state.activeHolds[i];
      const note = item.note;
      if (note.status !== "active") {
        state.activeHolds.splice(i, 1);
        continue;
      }
      const grace = audio.now() < state.resumeGraceUntil;
      const keyDown = state.keys[note.lane];
      if (state.songTime >= note.endTime - 0.075) {
        if (keyDown) completeHold(item, now);
        else if (!grace) failHold(item);
        continue;
      }
      if (!keyDown && !grace) {
        failHold(item);
        continue;
      }
      if (keyDown && state.songTime - item.lastTick >= 0.23) {
        item.lastTick = state.songTime;
        state.score += 10;
        updateScoreDisplay();
        spawnHoldTick(note.lane, now);
        audio.holdTick();
      }
      note.holdProgress = Math.min(1, Math.max(0, (state.songTime - note.time) / Math.max(0.001, note.duration)));
    }
  }

  function updateSnake(now) {
    const active = state.activeSnake;
    if (!active) return;
    const note = active.note;
    if (note.status !== "active") {
      state.activeSnake = null;
      return;
    }
    const checkpoint = note.checkpoints[active.nextCheckpoint];
    if (!checkpoint) {
      completeSnake(now);
      return;
    }
    const checkpointTime = note.time + checkpoint.offset;
    if (state.songTime < checkpointTime - 0.02) {
      active.requiredLane = checkpoint.lane;
      return;
    }
    if (state.keys[checkpoint.lane]) {
      checkpoint.passed = true;
      active.nextCheckpoint += 1;
      state.score += SNAKE_CHECKPOINT_SCORE;
      updateScoreDisplay();
      audio.snakeTick();
      if (renderer.metrics) {
        state.rings.push({
          x: renderer.laneCenter(checkpoint.lane),
          y: renderer.metrics.hitY,
          max: renderer.metrics.laneW * 0.75,
          color: GRADE_COLORS.good,
          born: now,
          life: 0.38
        });
      }
      if (active.nextCheckpoint >= note.checkpoints.length) {
        completeSnake(now);
      } else {
        active.requiredLane = note.checkpoints[active.nextCheckpoint].lane;
      }
    } else if (state.songTime > checkpointTime + 0.14 && audio.now() >= state.resumeGraceUntil) {
      failSnake();
    } else {
      active.requiredLane = checkpoint.lane;
    }
  }

  function updateSnakeAlert() {
    const active = state.activeSnake;
    let pending = null;
    if (!active && state.chart) {
      pending = state.chart.notes.find((note) => note.type === "snake" && note.status === "pending");
    }
    let visible = false;
    if (active) {
      visible = true;
    } else if (pending) {
      visible = state.songTime >= pending.time - 2.6 && state.songTime <= pending.time + 0.35;
    }
    if (visible !== state.snakeAlertVisible) {
      state.snakeAlertVisible = visible;
      dom.snakeAlert.classList.toggle("is-visible", visible);
    }
  }

  function updateHud() {
    const time = Math.max(0, state.songTime);
    const clock = formatClock(time);
    if (dom.songTimer.textContent !== clock) dom.songTimer.textContent = clock;
    const progress = Math.min(100, (time / state.song.duration) * 100);
    dom.songProgress.style.width = progress.toFixed(2) + "%";
  }

  function updateGame(now) {
    const time = now - state.startAt;
    state.songTime = time;

    if (state.phase === "countdown") {
      if (time < 0) {
        const remaining = -time;
        const value = Math.max(1, Math.min(3, Math.ceil(remaining)));
        setCountdownValue(String(value), "GET READY");
        updateHud();
        return;
      }
      state.phase = "playing";
      state.goHideAt = now + 0.58;
      dom.countdownNumber.textContent = "GO!";
      dom.countdownNumber.classList.add("is-go");
      if (typeof dom.countdownNumber.animate === "function") {
        dom.countdownNumber.animate(
          [{ transform: "scale(1.2)", opacity: 0.7 }, { transform: "scale(1)", opacity: 1 }],
          { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" }
        );
      }
    }

    if (state.goHideAt && now >= state.goHideAt) {
      hideCountdown();
      state.goHideAt = 0;
    }

    for (let i = 0; i < state.chart.notes.length; i += 1) {
      const note = state.chart.notes[i];
      if (note.status === "pending" && time > note.time + LATE_WINDOW) {
        missNote(note, note.type === "hold" ? "hold" : note.type === "snake" ? "snake" : "tap");
      }
    }

    updateHolds(now);
    updateSnake(now);
    updateSnakeAlert();
    updateHud();

    if (state.songTime >= state.song.duration - 0.05) finishGame(now);
  }

  function rankFor(accuracy) {
    if (accuracy >= 0.97) return "S";
    if (accuracy >= 0.9) return "A";
    if (accuracy >= 0.78) return "B";
    if (accuracy >= 0.6) return "C";
    return "D";
  }

  const RANK_META = {
    S: { color: "#ffd166", headline: "NEON LEGEND", message: "빛처럼 흐르는 완벽한 플로우." },
    A: { color: "#4de8ff", headline: "FLOW MASTER", message: "박자를 완전히 장악했어요." },
    B: { color: "#8dffbf", headline: "NICE GROOVE", message: "리듬이 손끝에 붙기 시작했어요." },
    C: { color: "#a58cff", headline: "KEEP THE BEAT", message: "조금만 더 하면 무대가 열려요." },
    D: { color: "#ff8a8a", headline: "ONE MORE TIME", message: "다음 플로우는 더 뜨거울 거예요." }
  };

  function showResults() {
    const hits = state.stats.perfect + state.stats.good + state.stats.nice;
    const total = state.chart.totalNotes;
    const accuracy = total > 0 ? hits / total : 0;
    const rank = rankFor(accuracy);
    const meta = RANK_META[rank];
    const previous = bestFor(state.track.id, state.difficulty);
    const isNewBest = !previous || state.score > previous.score;

    if (isNewBest) {
      saveBest(state.track.id, state.difficulty, {
        score: Math.round(state.score),
        maxCombo: state.stats.maxCombo,
        accuracy: Number((accuracy * 100).toFixed(1)),
        rank,
        date: Date.now()
      });
    }

    dom.resultTrack.textContent = state.track.title + " · " + state.difficulty.toUpperCase();
    dom.resultHeadline.textContent = meta.headline;
    dom.resultMessage.textContent = meta.message + " 정확도 " + (accuracy * 100).toFixed(1) + "%";
    dom.resultScore.textContent = Number(Math.round(state.score)).toLocaleString("ko-KR");
    dom.rankLetter.textContent = rank;
    dom.rankLetter.style.color = meta.color;
    dom.rankLetter.style.textShadow = "0 0 36px " + meta.color + "66";
    dom.rankRing.style.borderColor = meta.color + "88";
    dom.rankRing.style.boxShadow = "0 0 0 10px " + meta.color + "08, 0 0 44px " + meta.color + "22, inset 0 0 30px " + meta.color + "0a";
    dom.newBestBadge.classList.toggle("is-hidden", !isNewBest);

    const stats = [
      { label: "PERFECT", value: state.stats.perfect, className: "is-perfect" },
      { label: "GOOD", value: state.stats.good, className: "is-good" },
      { label: "NICE", value: state.stats.nice, className: "is-nice" },
      { label: "BAD", value: state.stats.miss, className: "is-bad" },
      { label: "MAX COMBO", value: state.stats.maxCombo, className: "" }
    ];
    dom.resultStats.innerHTML = stats.map((item) => (
      '<div class="result-stat ' + item.className + '"><span>' + item.label + "</span><strong>" + item.value + "</strong></div>"
    )).join("");
    dom.resultOverlay.classList.remove("is-hidden");
    state.finished = true;
  }

  function finishGame(now) {
    if (state.phase === "results" || state.finished) return;
    state.phase = "results";
    state.songTime = state.song.duration;
    releaseAllKeys();
    state.activeHolds = [];
    state.activeSnake = null;
    state.snakeAlertVisible = false;
    dom.snakeAlert.classList.remove("is-visible");
    dom.songProgress.style.width = "100%";
    audio.stopSong(0.9);
    showResults();
    stopLoop();
  }

  function pressLane(lane) {
    if (state.phase === "resuming") {
      state.keys[lane] = true;
      return;
    }
    if (state.phase === "paused" || state.phase === "results") return;
    state.keys[lane] = true;
    if (state.phase === "countdown") return;
    if (state.phase !== "playing") return;
    if (state.activeSnake) return;

    const note = findHittable(lane);
    if (!note) return;
    const now = audio.now();
    if (note.type === "tap") {
      note.status = "hit";
      note.statusAt = now;
      note.judged = true;
      registerComboHit(note.lane, now, 0, "");
    } else if (note.type === "hold") {
      startHold(note, now);
    } else if (note.type === "snake") {
      startSnake(note, now);
    }
  }

  function releaseLane(lane) {
    state.keys[lane] = false;
    if (state.phase !== "playing") return;
    for (let i = state.activeHolds.length - 1; i >= 0; i -= 1) {
      const item = state.activeHolds[i];
      if (item.note.lane !== lane) continue;
      if (state.songTime >= item.note.endTime - 0.16) completeHold(item, audio.now());
      else failHold(item);
    }
  }

  function handleKeyDown(event) {
    if (event.code === "Escape") {
      if (!dom.helpModal.classList.contains("is-hidden")) {
        closeHelp();
        return;
      }
      if (state.screen === "game") {
        if (state.phase === "paused") resumeGame();
        else if (state.phase === "playing" || state.phase === "countdown") pauseGame();
      }
      return;
    }
    if (event.code === "KeyM" && state.screen !== "game") {
      toggleSound();
      return;
    }
    const lane = KEYS.indexOf(event.code);
    if (lane < 0) return;
    if (state.screen !== "game") return;
    event.preventDefault();
    if (event.repeat) return;
    pressLane(lane);
  }

  function handleKeyUp(event) {
    const lane = KEYS.indexOf(event.code);
    if (lane < 0 || state.screen !== "game") return;
    event.preventDefault();
    releaseLane(lane);
  }

  function pointerLaneFromEvent(event) {
    if (!renderer.metrics) return -1;
    const rect = dom.canvas.getBoundingClientRect();
    const y = event.clientY - rect.top;
    if (y < renderer.metrics.hitY - 54) return -1;
    return renderer.laneFromX(event.clientX);
  }

  function bindEvents() {
    dom.grid.addEventListener("click", (event) => {
      const card = event.target.closest(".song-card");
      if (!card) return;
      startGame(card.dataset.track);
    });

    dom.startCta.addEventListener("click", () => {
      audio.unlock().then(() => audio.uiClick());
      dom.library.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    dom.difficultyButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.difficulty = button.dataset.difficulty === "hard" ? "hard" : "normal";
        saveSettings();
        renderHome();
        audio.unlock().then(() => audio.uiClick());
      });
    });

    dom.speedButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.speedFactor = Number(button.dataset.speed) || 1.25;
        saveSettings();
        updateDifficultyUi();
        audio.unlock().then(() => audio.uiClick());
      });
    });

    dom.soundToggle.addEventListener("click", toggleSound);

    dom.helpOpeners.forEach((button) => button.addEventListener("click", openHelp));
    dom.helpClose.addEventListener("click", closeHelp);
    dom.helpStart.addEventListener("click", () => {
      closeHelp();
      dom.library.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    dom.helpModal.addEventListener("click", (event) => {
      if (event.target === dom.helpModal) closeHelp();
    });

    dom.pauseButton.addEventListener("click", pauseGame);
    dom.resumeButton.addEventListener("click", resumeGame);
    dom.quitButton.addEventListener("click", () => {
      resumeToken += 1;
      backToLibrary();
    });
    dom.retryButton.addEventListener("click", () => {
      dom.resultOverlay.classList.add("is-hidden");
      startGame(state.track.id);
    });
    dom.libraryButton.addEventListener("click", backToLibrary);

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    dom.canvas.addEventListener("pointerdown", (event) => {
      if (state.screen !== "game") return;
      if (!["playing", "countdown", "resuming"].includes(state.phase)) return;
      const lane = pointerLaneFromEvent(event);
      if (lane < 0) return;
      event.preventDefault();
      if (dom.canvas.setPointerCapture) {
        try { dom.canvas.setPointerCapture(event.pointerId); } catch (error) { /* no-op */ }
      }
      pointerLanes.set(event.pointerId, lane);
      pressLane(lane);
    });

    const releasePointer = (event) => {
      if (!pointerLanes.has(event.pointerId)) return;
      const lane = pointerLanes.get(event.pointerId);
      pointerLanes.delete(event.pointerId);
      releaseLane(lane);
    };
    window.addEventListener("pointerup", releasePointer);
    window.addEventListener("pointercancel", releasePointer);

    dom.canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    window.addEventListener("resize", () => {
      if (state.screen === "game") renderer.resize(state.speedFactor);
    });

    window.addEventListener("blur", () => {
      if (state.screen === "game" && (state.phase === "playing" || state.phase === "countdown")) {
        pauseGame();
      } else {
        releaseAllKeys();
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && state.screen === "game" && (state.phase === "playing" || state.phase === "countdown")) {
        pauseGame();
      }
    });
  }

  function init() {
    renderer.init(dom.canvas);
    bindEvents();
    updateDifficultyUi();
    updateSoundUi();
    renderHome();
  }

  init();
})();
