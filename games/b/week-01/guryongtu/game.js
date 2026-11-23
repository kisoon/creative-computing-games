/* ============================================================
   GURYONGTU · Digital Duel Arena
   2-player web board game
   ============================================================ */

(() => {
  "use strict";

  const STORAGE_KEY = "guryongtu.save.v1";
  const VERSION = 1;
  const MAX_ROUNDS = 9;
  const WIN_TARGET = 5;
  const TILES_LEFT_BASE = 9;
  const TILE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  const TEAM = {
    red: { en: "RED", ko: "레드", label: "RED TEAM" },
    blue: { en: "BLUE", ko: "블루", label: "BLUE TEAM" },
  };

  const OUTCOME_KO = {
    red: "레드팀 승리",
    blue: "블루팀 승리",
    draw: "무승부",
  };

  const $ = (id) => document.getElementById(id);

  const el = {
    introOverlay: $("introOverlay"),
    startBtn: $("startBtn"),
    finalOverlay: $("finalOverlay"),
    finalCard: $("finalCard"),
    finalKicker: $("finalKicker"),
    finalTitle: $("finalTitle"),
    finalSub: $("finalSub"),
    finalScoreRed: $("finalScoreRed"),
    finalScoreBlue: $("finalScoreBlue"),
    finalMeta: $("finalMeta"),
    rematchBtn: $("rematchBtn"),
    viewBoardBtn: $("viewBoardBtn"),
    finalClose: $("finalClose"),
    confetti: $("confetti"),
    rulesBtn: $("rulesBtn"),
    rulesOverlay: $("rulesOverlay"),
    rulesClose: $("rulesClose"),
    rulesOk: $("rulesOk"),
    restartBtn: $("restartBtn"),
    restartOverlay: $("restartOverlay"),
    restartCancel: $("restartCancel"),
    restartCancelX: $("restartCancelX"),
    restartConfirm: $("restartConfirm"),
    redScore: $("redScore"),
    blueScore: $("blueScore"),
    redPips: $("redPips"),
    bluePips: $("bluePips"),
    roundNum: $("roundNum"),
    roundFill: $("roundFill"),
    redPanel: $("redPanel"),
    bluePanel: $("bluePanel"),
    redBoard: $("redBoard"),
    blueBoard: $("blueBoard"),
    redStatus: $("redStatus"),
    blueStatus: $("blueStatus"),
    redRemain: $("redRemain"),
    blueRemain: $("blueRemain"),
    redRecord: $("redRecord"),
    blueRecord: $("blueRecord"),
    redMask: $("redMask"),
    blueMask: $("blueMask"),
    arena: $("arena"),
    lamps: $("lamps"),
    redSlot: $("redSlot"),
    blueSlot: $("blueSlot"),
    redCard: $("redCard"),
    blueCard: $("blueCard"),
    redCardFront: $("redCardFront"),
    blueCardFront: $("blueCardFront"),
    redSlotStatus: $("redSlotStatus"),
    blueSlotStatus: $("blueSlotStatus"),
    judgeKicker: $("judgeKicker"),
    judgeMain: $("judgeMain"),
    judgeSub: $("judgeSub"),
    judgeDetail: $("judgeDetail"),
    arenaStatus: $("arenaStatus"),
    nextBtn: $("nextBtn"),
    history: $("history"),
    toast: $("toast"),
    liveRegion: $("liveRegion"),
  };

  const toggles = Array.from(document.querySelectorAll("[data-toggle]"));
  const voiceSupported = "speechSynthesis" in window;
  const timers = new Set();

  let state = createInitialState();
  let ui = { flipped: false, busy: false };
  let lastScores = { red: 0, blue: 0 };
  let toastTimer = 0;
  let audioCtx = null;
  let lastFocusedElement = null;

  /* ============================================================
     helpers
     ============================================================ */

  function createInitialState() {
    return {
      version: VERSION,
      started: false,
      round: 1,
      scores: { red: 0, blue: 0 },
      history: [],
      picks: { red: null, blue: null },
      phase: "idle",
      matchWinner: null,
      voiceOn: true,
      sfxOn: true,
      savedAt: Date.now(),
    };
  }

  function validTile(value) {
    return Number.isInteger(value) && value >= 1 && value <= 9;
  }

  function otherTeam(team) {
    return team === "red" ? "blue" : "red";
  }

  function judgeRound(red, blue) {
    if (red === blue) return "draw";
    if (red === 1 && blue === 9) return "red";
    if (red === 9 && blue === 1) return "blue";
    return red > blue ? "red" : "blue";
  }

  function determineMatchWinner(snapshot) {
    if (snapshot.scores.red >= WIN_TARGET) return "red";
    if (snapshot.scores.blue >= WIN_TARGET) return "blue";
    if (snapshot.history.length >= MAX_ROUNDS) {
      if (snapshot.scores.red > snapshot.scores.blue) return "red";
      if (snapshot.scores.blue > snapshot.scores.red) return "blue";
      return "draw";
    }
    return null;
  }

  function applyRoundToState(snapshot) {
    const { red, blue } = snapshot.picks;
    if (!validTile(red) || !validTile(blue)) return false;

    const round = snapshot.history.length + 1;
    if (round > MAX_ROUNDS) return false;

    const result = judgeRound(red, blue);
    snapshot.history.push({ round, red, blue, result });
    if (result !== "draw") snapshot.scores[result] += 1;
    snapshot.round = round;
    snapshot.matchWinner = determineMatchWinner(snapshot);
    snapshot.phase = snapshot.matchWinner ? "over" : "result";
    return true;
  }

  function later(fn, delay) {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, delay);
    timers.add(id);
    return id;
  }

  function clearTimers() {
    timers.forEach((id) => window.clearTimeout(id));
    timers.clear();
  }

  function setLive(text) {
    if (el.liveRegion) el.liveRegion.textContent = text;
  }

  function showToast(message) {
    if (!el.toast) return;
    window.clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.classList.add("show");
    toastTimer = window.setTimeout(() => el.toast.classList.remove("show"), 2400);
  }

  function sameScore(a, b) {
    return a.red === b.red && a.blue === b.blue;
  }

  /* ============================================================
     persistence
     ============================================================ */

  function loadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function saveState() {
    try {
      state.savedAt = Date.now();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      /* Storage can be unavailable (private mode / file protocol). */
    }
  }

  function normalizeState(raw) {
    if (!raw || raw.version !== VERSION) return null;

    const s = createInitialState();
    s.started = raw.started === true;
    s.voiceOn = raw.voiceOn !== false;
    s.sfxOn = raw.sfxOn !== false;

    if (!s.started) {
      if (!voiceSupported) s.voiceOn = false;
      return s;
    }

    const seen = { red: new Set(), blue: new Set() };

    if (Array.isArray(raw.history)) {
      for (const entry of raw.history) {
        if (!entry || typeof entry !== "object") continue;
        const expectedRound = s.history.length + 1;
        if (entry.round !== expectedRound) continue;
        if (!validTile(entry.red) || !validTile(entry.blue)) continue;
        if (!Object.prototype.hasOwnProperty.call(OUTCOME_KO, entry.result)) continue;
        if (seen.red.has(entry.red) || seen.blue.has(entry.blue)) continue;

        const result = judgeRound(entry.red, entry.blue);
        seen.red.add(entry.red);
        seen.blue.add(entry.blue);
        s.history.push({ round: expectedRound, red: entry.red, blue: entry.blue, result });
      }
    }

    for (const entry of s.history) {
      if (entry.result !== "draw") s.scores[entry.result] += 1;
    }

    if (raw.picks && typeof raw.picks === "object") {
      for (const team of ["red", "blue"]) {
        const pick = raw.picks[team];
        if (validTile(pick) && !seen[team].has(pick)) {
          s.picks[team] = pick;
        }
      }
    }

    const phase = raw.phase;

    if (phase === "reveal" && s.picks.red !== null && s.picks.blue !== null) {
      s.round = s.history.length + 1;
      if (!applyRoundToState(s)) {
        s.phase = "select";
        s.round = Math.min(MAX_ROUNDS, s.history.length + 1);
        s.picks = { red: null, blue: null };
      }
    } else if (phase === "result" || phase === "over") {
      if (s.history.length === 0) {
        s.phase = "select";
        s.round = 1;
        s.picks = { red: null, blue: null };
      } else {
        const last = s.history[s.history.length - 1];
        s.round = last.round;
        s.picks = { red: last.red, blue: last.blue };
        s.matchWinner = determineMatchWinner(s);
        s.phase = s.matchWinner ? "over" : "result";
      }
    } else {
      s.phase = "select";
      s.round = Math.min(MAX_ROUNDS, s.history.length + 1);
      if (s.history.length >= MAX_ROUNDS) {
        s.matchWinner = determineMatchWinner(s);
        s.phase = s.matchWinner ? "over" : "result";
        s.round = MAX_ROUNDS;
      }
      if (s.picks.red !== null && s.picks.blue !== null) {
        s.picks = { red: null, blue: null };
      }
    }

    if (s.matchWinner) {
      s.matchWinner = determineMatchWinner(s);
      if (!s.matchWinner) s.matchWinner = null;
    }

    if (!voiceSupported) s.voiceOn = false;
    return s;
  }

  /* ============================================================
     static construction
     ============================================================ */

  function buildLamps() {
    if (!el.lamps) return;
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 36; index += 1) {
      const lamp = document.createElement("span");
      lamp.className = "lamp";
      lamp.style.setProperty("--a", `${index * 10}deg`);
      lamp.style.setProperty("--d", `${-((index % 12) * 0.11).toFixed(2)}s`);
      fragment.appendChild(lamp);
    }
    el.lamps.appendChild(fragment);
  }

  function buildBoard(team, board) {
    if (!board) return;
    const fragment = document.createDocumentFragment();

    for (const number of TILE_NUMBERS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tile ${number % 2 === 1 ? "odd" : "even"}`;
      button.dataset.num = String(number);
      button.dataset.team = team;
      button.setAttribute("aria-label", `${TEAM[team].ko}팀 ${number} 타일`);
      button.innerHTML =
        `<span class="tile-parity">${number % 2 === 1 ? "ODD" : "EVEN"}</span>` +
        `<span class="tile-num">${number}</span>`;
      button.addEventListener("click", () => handlePick(team, number));
      fragment.appendChild(button);
    }

    board.appendChild(fragment);
  }

  function buildPips(container) {
    if (!container) return;
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < WIN_TARGET; index += 1) {
      const pip = document.createElement("span");
      pip.className = "pip";
      fragment.appendChild(pip);
    }
    container.appendChild(fragment);
  }

  function buildHistory() {
    if (!el.history) return;
    const fragment = document.createDocumentFragment();
    for (let round = 1; round <= MAX_ROUNDS; round += 1) {
      const cell = document.createElement("div");
      cell.className = "h-cell";
      cell.dataset.round = String(round);
      cell.innerHTML =
        `<span class="h-round">R${round}</span>` +
        `<span class="h-result">&middot;</span>`;
      fragment.appendChild(cell);
    }
    el.history.appendChild(fragment);
  }

  /* ============================================================
     rendering
     ============================================================ */

  function renderAll() {
    renderToggles();
    renderScore();
    renderRound();
    renderBoards();
    renderPanels();
    renderArena();
    renderHistory();
    renderControls();
  }

  function renderToggles() {
    for (const button of toggles) {
      const kind = button.dataset.toggle;
      const on = kind === "voice" ? state.voiceOn : state.sfxOn;
      const supported = kind !== "voice" || voiceSupported;

      button.setAttribute("aria-pressed", String(on && supported));
      button.classList.toggle("is-off", !on || !supported);

      const label = button.querySelector("[data-state-label]");
      if (label) {
        label.textContent = kind === "voice" && !voiceSupported ? "N/A" : on ? "ON" : "OFF";
      }

      if (kind === "voice") {
        const use = button.querySelector('use[data-icon="voice"]');
        if (use) use.setAttribute("href", on && supported ? "#i-sound" : "#i-mute");
      }

      if (kind === "voice" && !voiceSupported) {
        button.disabled = true;
        button.title = "이 브라우저는 음성 합성을 지원하지 않습니다";
      }
    }
  }

  function popScore(element) {
    element.classList.remove("pop");
    void element.offsetWidth;
    element.classList.add("pop");
  }

  function renderScore() {
    if (!el.redScore || !el.blueScore) return;

    el.redScore.textContent = String(state.scores.red);
    el.blueScore.textContent = String(state.scores.blue);

    if (state.scores.red !== lastScores.red) popScore(el.redScore);
    if (state.scores.blue !== lastScores.blue) popScore(el.blueScore);
    lastScores = { red: state.scores.red, blue: state.scores.blue };

    updatePips(el.redPips, state.scores.red);
    updatePips(el.bluePips, state.scores.blue);
  }

  function updatePips(container, score) {
    if (!container) return;
    Array.from(container.children).forEach((pip, index) => {
      pip.classList.toggle("on", index < score);
    });
  }

  function renderRound() {
    if (!el.roundNum || !el.roundFill) return;
    el.roundNum.textContent = String(state.round);
    const progress = Math.min(100, (state.history.length / MAX_ROUNDS) * 100);
    el.roundFill.style.width = `${progress}%`;
  }

  function isUsedInHistory(team, number) {
    return state.history.some((entry) => entry[team] === number);
  }

  function renderBoards() {
    const boards = { red: el.redBoard, blue: el.blueBoard };
    const picks = state.picks;

    for (const team of ["red", "blue"]) {
      const board = boards[team];
      if (!board) continue;

      const masked =
        state.phase === "select" &&
        picks[team] !== null &&
        picks[otherTeam(team)] === null;

      board.setAttribute("aria-hidden", String(masked));

      Array.from(board.children).forEach((button) => {
        const number = Number(button.dataset.num);
        const used = isUsedInHistory(team, number);
        const picked = !used && picks[team] === number;
        const selectable = state.phase === "select" && picks[team] === null;

        button.classList.toggle("used", used);
        button.classList.toggle("picked", picked);
        button.disabled = used || !selectable;
        button.setAttribute("aria-disabled", String(button.disabled));
      });

      const panel = team === "red" ? el.redPanel : el.bluePanel;
      if (panel) panel.classList.toggle("masked", masked);
    }
  }

  function renderPanels() {
    const last = state.history[state.history.length - 1] || null;
    const showingResult = state.phase === "result" || state.phase === "over";

    for (const team of ["red", "blue"]) {
      const panel = team === "red" ? el.redPanel : el.bluePanel;
      const statusEl = team === "red" ? el.redStatus : el.blueStatus;
      const remainEl = team === "red" ? el.redRemain : el.blueRemain;
      const recordEl = team === "red" ? el.redRecord : el.blueRecord;
      if (!panel || !statusEl) continue;

      const hasPicked = state.picks[team] !== null;
      const active = state.started && state.phase === "select" && !hasPicked;
      panel.classList.toggle("is-active", active);

      let status = "STANDBY";
      let statusClass = "";

      if (!state.started || state.phase === "idle") {
        status = "STANDBY";
      } else if (state.phase === "select") {
        status = hasPicked ? "LOCKED" : "SELECT";
      } else if (state.phase === "reveal") {
        status = "JUDGING";
      } else if (showingResult && last) {
        if (state.phase === "over") {
          if (state.matchWinner === "draw") {
            status = "DRAW";
            statusClass = "status-draw";
          } else if (state.matchWinner === team) {
            status = "CHAMPION";
            statusClass = "status-win";
          } else {
            status = "RUNNER UP";
            statusClass = "status-lose";
          }
        } else if (last.result === "draw") {
          status = "DRAW";
          statusClass = "status-draw";
        } else if (last.result === team) {
          status = "WIN";
          statusClass = "status-win";
        } else {
          status = "LOSE";
          statusClass = "status-lose";
        }
      }

      statusEl.textContent = status;
      statusEl.className = `panel-status ${statusClass}`.trim();

      const pendingPick =
        (state.phase === "select" || state.phase === "reveal") && hasPicked ? 1 : 0;
      const remaining = Math.max(0, TILES_LEFT_BASE - state.history.length - pendingPick);
      if (remainEl) remainEl.textContent = String(remaining);
      if (recordEl) recordEl.textContent = `${state.scores[team]} ${state.scores[team] === 1 ? "WIN" : "WINS"}`;
    }
  }

  function renderArena() {
    if (!el.arena) return;

    const phase = state.phase;
    const last = state.history[state.history.length - 1] || null;
    const showingResult = (phase === "result" || phase === "over") && last !== null;
    const flipped = showingResult || ui.flipped;

    const arenaState = !state.started || phase === "idle"
      ? "state-idle"
      : phase === "select"
        ? "state-select"
        : phase === "reveal"
          ? "state-judging"
          : last
            ? `state-${last.result}`
            : "state-idle";

    el.arena.classList.remove(
      "state-idle",
      "state-select",
      "state-judging",
      "state-red",
      "state-blue",
      "state-draw"
    );
    el.arena.classList.add(arenaState);

    renderSlot("red", el.redSlot, el.redCard, el.redCardFront, el.redSlotStatus, last, showingResult, flipped);
    renderSlot("blue", el.blueSlot, el.blueCard, el.blueCardFront, el.blueSlotStatus, last, showingResult, flipped);

    renderJudge(phase, last, showingResult, flipped);
    renderArenaStatus(phase, last, showingResult);
  }

  function renderSlot(team, slot, card, front, statusEl, last, showingResult, flipped) {
    if (!slot || !card || !front || !statusEl) return;

    const pick = state.picks[team];
    const filled = pick !== null;
    slot.classList.toggle("is-filled", filled);

    card.classList.toggle("flipped", filled && flipped);

    const numEl = front.querySelector(".front-num");
    const parityEl = front.querySelector(".front-parity");
    if (filled) {
      front.classList.toggle("even", pick % 2 === 0);
      front.classList.toggle("odd", pick % 2 === 1);
      if (numEl) numEl.textContent = String(pick);
      if (parityEl) parityEl.textContent = pick % 2 === 1 ? "ODD" : "EVEN";
    }

    const back = card.querySelector(".card-back");
    front.setAttribute("aria-hidden", String(!(filled && flipped)));
    if (back) back.setAttribute("aria-hidden", String(filled && flipped));

    let status = "READY";
    if (filled) status = "LOCKED";
    if (state.phase === "reveal" && filled) status = ui.flipped ? "OPEN" : "LOCKED";

    if (showingResult && last) {
      if (last.result === "draw") status = "DRAW";
      else if (last.result === team) status = "WIN";
      else status = "LOSE";
    }

    statusEl.textContent = status;

    slot.classList.toggle("is-win", Boolean(showingResult && last && last.result === team));
    slot.classList.toggle(
      "is-lose",
      Boolean(showingResult && last && last.result !== "draw" && last.result !== team)
    );
    slot.classList.toggle("is-draw", Boolean(showingResult && last && last.result === "draw"));

    let aria = `${TEAM[team].ko}팀 슬롯: `;
    if (!filled) aria += "READY, 선택 대기 중";
    else if (!flipped) aria += "타일 선택 완료, 비공개";
    else aria += `${pick} 타일 공개`;
    if (showingResult && last) {
      aria += `, ${last.result === "draw" ? "무승부" : last.result === team ? "승리" : "패배"}`;
    }
    slot.setAttribute("aria-label", aria);
  }

  function renderJudge(phase, last, showingResult, flipped) {
    if (!el.judgeMain) return;

    let kicker = "JUDGE SYSTEM";
    let main = "READY";
    let sub = "양 팀, 타일을 선택하세요";
    let detail = "SELECT YOUR TILE";

    if (!state.started || phase === "idle") {
      sub = "게임을 시작하세요";
      detail = "PRESS GAME START";
    } else if (phase === "select") {
      const redPicked = state.picks.red !== null;
      const bluePicked = state.picks.blue !== null;
      if (!redPicked && !bluePicked) {
        sub = "양 팀, 타일을 선택하세요";
        detail = "SELECT YOUR TILE";
      } else if (redPicked && !bluePicked) {
        sub = "블루팀 선택 대기 중";
        detail = "RED LOCKED · AWAITING BLUE";
      } else if (!redPicked && bluePicked) {
        sub = "레드팀 선택 대기 중";
        detail = "BLUE LOCKED · AWAITING RED";
      }
    } else if (phase === "reveal") {
      kicker = "BATTLE IN PROGRESS";
      main = "VS";
      sub = flipped ? "두 팀의 타일이 공개되었습니다" : "두 팀의 타일을 공개합니다";
      detail = "JUDGING...";
    } else if (showingResult && last) {
      kicker = state.phase === "over" ? "FINAL RESULT" : `ROUND ${last.round} RESULT`;
      main = last.result === "draw" ? "DRAW" : `${TEAM[last.result].en} WIN`;
      sub = describeComparison(last);
      detail =
        state.phase === "over"
          ? state.scores[state.matchWinner] >= WIN_TARGET
            ? "FIVE WINS · MATCH COMPLETE"
            : "ROUND LIMIT · MATCH COMPLETE"
          : "PRESS NEXT ROUND";
    }

    el.judgeKicker.textContent = kicker;
    el.judgeMain.textContent = main;
    el.judgeSub.textContent = sub;
    el.judgeDetail.textContent = detail;
  }

  function describeComparison(entry) {
    const { red, blue, result } = entry;
    if (result === "draw") return `${red} = ${blue} · 무승부`;
    if (red === 1 && blue === 9) return "1 vs 9 · 1이 9를 이김";
    if (red === 9 && blue === 1) return "9 vs 1 · 1이 9를 이김";
    return red > blue ? `${red} > ${blue} · 레드팀 승리` : `${blue} > ${red} · 블루팀 승리`;
  }

  function renderArenaStatus(phase, last, showingResult) {
    if (!el.arenaStatus) return;

    let text = "WAITING FOR START";

    if (!state.started || phase === "idle") {
      text = "WAITING FOR START";
    } else if (phase === "select") {
      const redPicked = state.picks.red !== null;
      const bluePicked = state.picks.blue !== null;
      if (!redPicked && !bluePicked) text = "WAITING FOR PLAYERS";
      else if (redPicked && !bluePicked) text = "RED LOCKED · BLUE SELECTING";
      else if (!redPicked && bluePicked) text = "BLUE LOCKED · RED SELECTING";
    } else if (phase === "reveal") {
      text = "JUDGING TILES...";
    } else if (showingResult && last) {
      text =
        last.result === "draw"
          ? `ROUND ${last.round} DRAW`
          : `${TEAM[last.result].en} TAKES ROUND ${last.round}`;
      if (state.phase === "over") {
        text = state.matchWinner === "draw" ? "MATCH COMPLETE · DRAW" : "MATCH COMPLETE · CHAMPION";
      }
    }

    el.arenaStatus.textContent = text;
  }

  function renderHistory() {
    if (!el.history) return;
    const cells = Array.from(el.history.children);

    for (const cell of cells) {
      const round = Number(cell.dataset.round);
      const entry = state.history.find((item) => item.round === round);
      const resultEl = cell.querySelector(".h-result");
      if (!resultEl) continue;

      cell.classList.remove("done", "red", "blue", "draw", "current");
      cell.removeAttribute("title");

      if (entry) {
        cell.classList.add("done", entry.result);
        resultEl.textContent = entry.result === "draw" ? "D" : entry.result === "red" ? "R" : "B";
        const outcome = entry.result === "draw" ? "무승부" : OUTCOME_KO[entry.result];
        cell.title = `R${round} · RED ${entry.red} : ${entry.blue} BLUE · ${outcome}`;
        cell.setAttribute("aria-label", cell.title);
      } else {
        resultEl.textContent = "·";
        cell.setAttribute("aria-label", `R${round} · 미진행`);
      }

      if (round === state.round) cell.classList.add("current");
    }

    const current = el.history.querySelector(".h-cell.current");
    if (current && el.history.scrollWidth > el.history.clientWidth + 4) {
      el.history.scrollLeft =
        current.offsetLeft - el.history.clientWidth / 2 + current.offsetWidth / 2;
    }
  }

  function renderControls() {
    if (!el.nextBtn) return;
    const label = el.nextBtn.querySelector("span");
    const phase = state.phase;

    el.nextBtn.classList.remove("is-ready");
    el.nextBtn.disabled = true;

    if (phase === "result") {
      if (label) label.textContent = "NEXT ROUND";
      el.nextBtn.disabled = false;
      el.nextBtn.classList.add("is-ready");
    } else if (phase === "over") {
      if (label) label.textContent = "FINAL RESULT";
      el.nextBtn.disabled = false;
    } else if (phase === "reveal") {
      if (label) label.textContent = "JUDGING...";
    } else {
      if (label) label.textContent = "NEXT ROUND";
    }
  }

  /* ============================================================
     game flow
     ============================================================ */

  function handlePick(team, number) {
    if (!state.started || state.phase !== "select") return;
    if (state.picks[team] !== null) return;
    if (isUsedInHistory(team, number)) {
      sfxError();
      return;
    }

    ensureAudio();
    state.picks[team] = number;
    sfxSelect();

    if (state.picks.red !== null && state.picks.blue !== null) {
      startReveal();
      return;
    }

    saveState();
    renderAll();

    const opponent = otherTeam(team);
    const message = `${TEAM[team].ko}팀 선택 완료. ${TEAM[opponent].ko}팀, 타일을 선택하세요.`;
    announce(message);
    setLive(message);
  }

  function startReveal() {
    if (state.phase !== "select") return;

    state.phase = "reveal";
    ui = { flipped: false, busy: true };
    saveState();
    renderAll();
    ensureAudio();
    sfxLock();

    const message = "두 팀 모두 선택 완료. 대결!";
    announce(message, { interrupt: true });
    setLive("두 팀의 타일을 공개합니다. 자동 판정 중입니다.");

    later(() => {
      if (state.phase !== "reveal") return;
      ui.flipped = true;
      renderArena();
      sfxReveal();
    }, 480);

    later(() => {
      if (state.phase !== "reveal") return;
      finishRound();
    }, 1420);
  }

  function finishRound() {
    if (state.phase !== "reveal") return;
    if (!applyRoundToState(state)) return;

    ui.flipped = true;
    ui.busy = false;
    saveState();
    renderAll();

    const entry = state.history[state.history.length - 1];
    sfxResult(entry.result, state.phase === "over");
    announceResult(entry);

    if (state.phase === "over") {
      later(showFinalOverlay, 800);
    }
  }

  function announceResult(entry) {
    const scores = state.scores;

    if (state.matchWinner) {
      if (state.matchWinner === "draw") {
        const message = `경기 종료. 최종 스코어 레드 ${scores.red} 대 블루 ${scores.blue}. 무승부입니다.`;
        announce(message, { interrupt: true });
        setLive(message);
        return;
      }

      const winner = TEAM[state.matchWinner];
      const fiveWins = scores[state.matchWinner] >= WIN_TARGET;
      const message = fiveWins
        ? `경기 종료! ${winner.ko}팀, 다섯 승 달성! 최종 스코어 레드 ${scores.red} 대 블루 ${scores.blue}. 최종 우승입니다!`
        : `경기 종료! 최종 스코어 레드 ${scores.red} 대 블루 ${scores.blue}. ${winner.ko}팀, 최종 우승입니다!`;
      announce(message, { interrupt: true });
      setLive(message);
      return;
    }

    const special = (entry.red === 1 && entry.blue === 9) || (entry.red === 9 && entry.blue === 1);
    let message;
    if (entry.result === "draw") {
      message = `무승부입니다. 현재 스코어 레드 ${scores.red}, 블루 ${scores.blue}.`;
    } else {
      message = special
        ? `1이 9를 이겼습니다! ${TEAM[entry.result].ko}팀 승리. 현재 스코어 레드 ${scores.red}, 블루 ${scores.blue}.`
        : `${TEAM[entry.result].ko}팀 승리! 현재 스코어 레드 ${scores.red}, 블루 ${scores.blue}.`;
    }

    announce(message, { interrupt: true });
    setLive(message);
  }

  function nextRound() {
    if (state.phase !== "result") return;
    if (state.history.length >= MAX_ROUNDS) return;

    clearTimers();
    state.round = state.history.length + 1;
    state.picks = { red: null, blue: null };
    state.phase = "select";
    ui = { flipped: false, busy: false };
    saveState();
    renderAll();
    sfxClick();

    const message = `라운드 ${state.round}. 양 팀, 타일을 선택하세요.`;
    announce(message, { interrupt: true });
    setLive(message);
  }

  function startGame() {
    ensureAudio();
    closeOverlay(el.introOverlay, false);

    state.started = true;
    state.phase = "select";
    state.round = 1;
    state.picks = { red: null, blue: null };
    ui = { flipped: false, busy: false };
    lastScores = { red: state.scores.red, blue: state.scores.blue };
    saveState();
    renderAll();
    sfxStart();

    const message =
      "구룡투! 게임을 시작합니다. 먼저 다섯 승을 차지하는 팀이 우승합니다. 레드팀, 타일을 선택하세요.";
    announce(message, { interrupt: true });
    setLive(message);
  }

  function resetGame(fromRematch = false) {
    clearTimers();
    const voiceOn = state.voiceOn;
    const sfxOn = state.sfxOn;

    state = createInitialState();
    state.started = true;
    state.phase = "select";
    state.voiceOn = voiceOn;
    state.sfxOn = sfxOn;
    ui = { flipped: false, busy: false };
    lastScores = { red: 0, blue: 0 };

    closeOverlay(el.restartOverlay, false);
    closeOverlay(el.rulesOverlay, false);
    closeOverlay(el.finalOverlay, false);
    closeOverlay(el.introOverlay, false);
    clearConfetti();

    saveState();
    renderAll();
    ensureAudio();
    sfxStart();

    const message = fromRematch
      ? "재대결! 먼저 다섯 승을 차지하는 팀이 우승합니다. 레드팀, 타일을 선택하세요."
      : "새 게임을 시작합니다. 먼저 다섯 승을 차지하는 팀이 우승합니다. 레드팀, 타일을 선택하세요.";
    announce(message, { interrupt: true });
    setLive(message);
  }

  /* ============================================================
     final result
     ============================================================ */

  function showFinalOverlay() {
    if (!state.matchWinner) return;
    if (el.finalOverlay.classList.contains("show")) return;

    const winner = state.matchWinner;
    const isDraw = winner === "draw";
    const wonByFive = !isDraw && state.scores[winner] >= WIN_TARGET;

    el.finalOverlay.dataset.winner = winner;
    el.finalKicker.textContent = isDraw
      ? "MATCH COMPLETE · DRAW"
      : wonByFive
        ? "FIVE WINS · CHAMPION"
        : "ROUND LIMIT · CHAMPION";
    el.finalTitle.textContent = isDraw ? "DRAW" : TEAM[winner].label;
    el.finalSub.textContent = isDraw
      ? "양 팀, 승부를 가리지 못했습니다"
      : wonByFive
        ? "최종 우승 · 5승 달성"
        : "최종 우승 · 최다 승리";
    el.finalScoreRed.textContent = String(state.scores.red);
    el.finalScoreBlue.textContent = String(state.scores.blue);
    el.finalScoreRed.classList.toggle("is-winner", winner === "red");
    el.finalScoreBlue.classList.toggle("is-winner", winner === "blue");
    el.finalMeta.textContent = `ROUND ${state.history.length} / ${MAX_ROUNDS} · ${
      isDraw ? "NO WINNER" : "WINNER"
    }`;

    buildConfetti(isDraw ? null : winner);
    openOverlay(el.finalOverlay, el.rematchBtn);
  }

  function buildConfetti(winner) {
    if (!el.confetti) return;
    el.confetti.replaceChildren();
    if (!winner) return;

    const colors =
      winner === "red"
        ? ["#ff3355", "#ff8b9c", "#ffd0d8", "#ffcf72", "#ffffff"]
        : ["#3d7eff", "#8ec4ff", "#cfe4ff", "#ffcf72", "#ffffff"];

    for (let index = 0; index < 44; index += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = `${(Math.random() * 100).toFixed(2)}%`;
      piece.style.background = colors[index % colors.length];
      piece.style.setProperty("--drift", `${(Math.random() * 200 - 100).toFixed(0)}px`);
      piece.style.width = `${(5 + Math.random() * 5).toFixed(1)}px`;
      piece.style.height = `${(8 + Math.random() * 10).toFixed(1)}px`;
      piece.style.animationDuration = `${(2.6 + Math.random() * 1.9).toFixed(2)}s`;
      piece.style.animationDelay = `${(Math.random() * 0.6).toFixed(2)}s`;
      el.confetti.appendChild(piece);
    }
  }

  function clearConfetti() {
    if (el.confetti) el.confetti.replaceChildren();
  }

  /* ============================================================
     overlays
     ============================================================ */

  function syncBodyLock() {
    const hasOpen = Boolean(document.querySelector(".overlay.show"));
    document.body.classList.toggle("overlay-open", hasOpen);
  }

  function openOverlay(overlay, focusTarget) {
    if (!overlay) return;
    lastFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
    syncBodyLock();

    if (focusTarget) {
      window.setTimeout(() => {
        if (overlay.classList.contains("show")) {
          focusTarget.focus({ preventScroll: true });
        }
      }, 80);
    }
  }

  function closeOverlay(overlay, restoreFocus = true) {
    if (!overlay || !overlay.classList.contains("show")) return;
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
    syncBodyLock();

    if (restoreFocus && lastFocusedElement && document.contains(lastFocusedElement)) {
      lastFocusedElement.focus({ preventScroll: true });
      lastFocusedElement = null;
    }
  }

  function openRules() {
    openOverlay(el.rulesOverlay, el.rulesClose);
  }

  function openRestart() {
    openOverlay(el.restartOverlay, el.restartConfirm);
  }

  function handleNext() {
    if (state.phase === "result") {
      nextRound();
    } else if (state.phase === "over") {
      showFinalOverlay();
    }
  }

  /* ============================================================
     sound effects (Web Audio API)
     ============================================================ */

  function ensureAudio() {
    try {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return null;
        audioCtx = new AudioContextClass();
      }
      if (audioCtx.state === "suspended") {
        void audioCtx.resume();
      }
      return audioCtx;
    } catch (error) {
      return null;
    }
  }

  function tone(frequency, options = {}) {
    if (!state.sfxOn) return;
    const ctx = ensureAudio();
    if (!ctx) return;

    const {
      type = "sine",
      duration = 0.12,
      volume = 0.05,
      delay = 0,
      endFrequency = null,
    } = options;

    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.04);
  }

  function noiseBurst(duration = 0.4, volume = 0.05, delay = 0) {
    if (!state.sfxOn) return;
    const ctx = ensureAudio();
    if (!ctx) return;

    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 950;
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(ctx.currentTime + delay);
  }

  function sfxClick() {
    tone(560, { type: "square", duration: 0.04, volume: 0.022 });
  }

  function sfxSelect() {
    tone(440, { type: "triangle", duration: 0.08, volume: 0.05 });
    tone(660, { type: "triangle", duration: 0.11, volume: 0.045, delay: 0.07 });
  }

  function sfxError() {
    tone(150, { type: "sawtooth", duration: 0.12, volume: 0.04 });
    tone(110, { type: "square", duration: 0.14, volume: 0.025, delay: 0.08 });
  }

  function sfxLock() {
    noiseBurst(0.16, 0.04);
    tone(90, { type: "sine", duration: 0.24, volume: 0.06, endFrequency: 55 });
    tone(300, { type: "triangle", duration: 0.12, volume: 0.028, delay: 0.04, endFrequency: 620 });
  }

  function sfxReveal() {
    noiseBurst(0.42, 0.07);
    tone(180, { type: "sawtooth", duration: 0.34, volume: 0.028, endFrequency: 900 });
    tone(90, { type: "sine", duration: 0.3, volume: 0.045 });
  }

  function sfxWin() {
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      tone(frequency, {
        type: "triangle",
        duration: index === 3 ? 0.4 : 0.14,
        volume: 0.05,
        delay: index * 0.09,
      });
    });
  }

  function sfxDraw() {
    tone(440, { type: "sine", duration: 0.18, volume: 0.045 });
    tone(392, { type: "sine", duration: 0.3, volume: 0.04, delay: 0.16 });
  }

  function sfxStart() {
    tone(220, { type: "sawtooth", duration: 0.28, volume: 0.028, endFrequency: 880 });
    tone(880, { type: "sine", duration: 0.3, volume: 0.04, delay: 0.24 });
    tone(1174.66, { type: "sine", duration: 0.34, volume: 0.032, delay: 0.33 });
  }

  function sfxFinal() {
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      tone(frequency, {
        type: "triangle",
        duration: 0.24,
        volume: 0.05,
        delay: index * 0.13,
      });
    });
    tone(1567.98, { type: "sine", duration: 0.7, volume: 0.032, delay: 0.66 });
    tone(130.81, { type: "sine", duration: 0.8, volume: 0.04, delay: 0.66 });
  }

  function sfxResult(result, isOver) {
    if (isOver) sfxFinal();
    else if (result === "draw") sfxDraw();
    else sfxWin();
  }

  /* ============================================================
     voice announcements (Speech Synthesis API)
     ============================================================ */

  let speechToken = 0;
  let koreanVoice = null;

  function loadVoices() {
    if (!voiceSupported) return;
    try {
      const voices = window.speechSynthesis.getVoices();
      koreanVoice =
        voices.find(
          (voice) =>
            /^ko/i.test(voice.lang) &&
            /google|yuna|jimin|sora|seul|female|여성/i.test(voice.name)
        ) ||
        voices.find((voice) => /^ko/i.test(voice.lang)) ||
        voices.find((voice) => /korean/i.test(voice.name)) ||
        null;
    } catch (error) {
      koreanVoice = null;
    }
  }

  function speak(text, { interrupt = true, force = false } = {}) {
    if (!state.voiceOn || !voiceSupported) return;
    if (!state.started && !force) return;

    const synth = window.speechSynthesis;
    const token = ++speechToken;

    try {
      if (interrupt) synth.cancel();
      if (!koreanVoice) loadVoices();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = koreanVoice ? koreanVoice.lang : "ko-KR";
      utterance.rate = 1.02;
      utterance.pitch = 1;
      utterance.volume = 1;
      if (koreanVoice) utterance.voice = koreanVoice;

      window.setTimeout(() => {
        if (token !== speechToken) return;
        try {
          synth.speak(utterance);
        } catch (error) {
          /* ignore synthesis errors */
        }
      }, 35);
    } catch (error) {
      /* ignore synthesis errors */
    }
  }

  function announce(text, options) {
    if (!state.voiceOn) return;
    speak(text, options);
  }

  function cancelSpeech() {
    speechToken += 1;
    if (!voiceSupported) return;
    try {
      window.speechSynthesis.cancel();
    } catch (error) {
      /* ignore */
    }
  }

  function handleToggle(kind) {
    if (kind === "voice" && !voiceSupported) return;
    ensureAudio();

    const key = kind === "voice" ? "voiceOn" : "sfxOn";
    state[key] = !state[key];
    saveState();
    renderToggles();

    if (kind === "sfx") {
      if (state.sfxOn) sfxClick();
      showToast(state.sfxOn ? "효과음을 켰습니다." : "효과음을 껐습니다.");
    } else if (state.voiceOn) {
      speak("음성 안내를 켰습니다.", { interrupt: true, force: true });
      showToast("음성 안내를 켰습니다.");
    } else {
      cancelSpeech();
      showToast("음성 안내를 껐습니다.");
    }
  }

  /* ============================================================
     events + boot
     ============================================================ */

  function bindEvents() {
    el.startBtn?.addEventListener("click", startGame);
    el.nextBtn?.addEventListener("click", handleNext);

    for (const button of toggles) {
      button.addEventListener("click", () => handleToggle(button.dataset.toggle));
    }

    el.rulesBtn?.addEventListener("click", openRules);
    el.rulesClose?.addEventListener("click", () => closeOverlay(el.rulesOverlay));
    el.rulesOk?.addEventListener("click", () => closeOverlay(el.rulesOverlay));

    el.restartBtn?.addEventListener("click", openRestart);
    el.restartCancel?.addEventListener("click", () => closeOverlay(el.restartOverlay));
    el.restartCancelX?.addEventListener("click", () => closeOverlay(el.restartOverlay));
    el.restartConfirm?.addEventListener("click", () => {
      closeOverlay(el.restartOverlay, false);
      resetGame();
    });

    el.rematchBtn?.addEventListener("click", () => resetGame(true));
    el.viewBoardBtn?.addEventListener("click", () => closeOverlay(el.finalOverlay, false));
    el.finalClose?.addEventListener("click", () => closeOverlay(el.finalOverlay, false));

    const backdrops = [
      [el.rulesOverlay, el.rulesOverlay],
      [el.restartOverlay, el.restartOverlay],
      [el.finalOverlay, el.finalOverlay],
    ];
    for (const [overlay, target] of backdrops) {
      overlay?.addEventListener("click", (event) => {
        if (event.target === target) closeOverlay(overlay, overlay === el.finalOverlay ? false : true);
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (el.restartOverlay?.classList.contains("show")) {
        closeOverlay(el.restartOverlay);
      } else if (el.rulesOverlay?.classList.contains("show")) {
        closeOverlay(el.rulesOverlay);
      } else if (el.finalOverlay?.classList.contains("show")) {
        closeOverlay(el.finalOverlay, false);
      }
    });

    window.addEventListener("pagehide", saveState);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveState();
    });
  }

  function boot() {
    buildLamps();
    buildBoard("red", el.redBoard);
    buildBoard("blue", el.blueBoard);
    buildPips(el.redPips);
    buildPips(el.bluePips);
    buildHistory();
    bindEvents();

    if (voiceSupported) {
      loadVoices();
      if (typeof window.speechSynthesis.addEventListener === "function") {
        window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
      }
    }


    const saved = loadState();
    if (saved) {
      const normalized = normalizeState(saved);
      if (normalized) {
        state = normalized;
        lastScores = { red: state.scores.red, blue: state.scores.blue };
        ui.flipped = state.phase === "result" || state.phase === "over";

        if (!state.started) {
          renderAll();
          openOverlay(el.introOverlay, el.startBtn);
        } else {
          saveState();
          renderAll();

          if (state.phase === "over") {
            showFinalOverlay();
            showToast("이전 게임 결과를 불러왔습니다.");
          } else {
            showToast("이전 게임을 이어서 진행합니다.");
          }
        }

        renderToggles();
        return;
      }
    }

    state = createInitialState();
    if (!voiceSupported) state.voiceOn = false;
    lastScores = { red: 0, blue: 0 };
    ui = { flipped: false, busy: false };
    saveState();
    renderAll();
    openOverlay(el.introOverlay, el.startBtn);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
