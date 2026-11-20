/* =========================================================
   game-ui.js — HUD · 타이틀 · 결과 화면 · 렌더 루프
   ========================================================= */

const UI_FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';

function panel(x, y, w, h, r, alpha) {
  rr(x, y, w, h, r);
  ctx.fillStyle = 'rgba(9,20,20,' + (alpha == null ? 0.55 : alpha) + ')';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function hpBar(x, y, w, h, ratio, ghost, cols) {
  ratio = clamp(ratio, 0, 1);
  ghost = clamp(ghost, 0, 1);
  ctx.save();
  rr(x, y, w, h, h / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();

  if (ghost > 0.002) {
    ctx.save();
    rr(x, y, w, h, h / 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,214,102,0.55)';
    ctx.fillRect(x, y, w * ghost, h);
    ctx.restore();
  }
  if (ratio > 0.002) {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, cols[0]);
    g.addColorStop(1, cols[1]);
    ctx.save();
    rr(x, y, w, h, h / 2);
    ctx.clip();
    ctx.fillStyle = g;
    ctx.fillRect(x, y, Math.max(h, w * ratio), h);
    ctx.restore();
  }
  rr(x, y, w, h, h / 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawMiniSkull(cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.fillStyle = '#f7f0dd';
  ctx.beginPath();
  ctx.ellipse(0, -2, 9, 8.5, 0, 0, TAU);
  ctx.fill();
  rr(-4, 4, 9, 6, 2.5);
  ctx.fill();
  ctx.fillStyle = '#1b252a';
  ctx.beginPath();
  ctx.ellipse(-3.4, -2.5, 2.4, 2.8, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(3.4, -2.5, 2.4, 2.8, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawMiniTree(cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.fillStyle = '#5e4229';
  rr(-3, 0, 6, 14, 2);
  ctx.fill();
  ctx.fillStyle = '#3f8f4f';
  circle(-7, -4, 6);
  ctx.fill();
  circle(7, -4, 6);
  ctx.fill();
  circle(0, -9, 8);
  ctx.fill();
  ctx.fillStyle = '#6cc96f';
  circle(-2, -11, 4);
  ctx.fill();
  ctx.restore();
}

/* ---------- HUD ---------- */
function drawPlayerHud() {
  const x = 20, y = 18, w = 306, h = 68;
  panel(x, y, w, h, 14, 0.55);

  ctx.fillStyle = 'rgba(120,240,200,0.12)';
  circle(x + 38, y + 34, 24);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,255,215,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  drawMiniSkull(x + 38, y + 35, 1.15);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '700 15px ' + UI_FONT;
  ctx.fillStyle = '#eafff6';
  ctx.fillText('해골 기사', x + 72, y + 22);

  ctx.textAlign = 'right';
  ctx.font = '700 12px ' + UI_FONT;
  ctx.fillStyle = 'rgba(210,255,235,0.75)';
  ctx.fillText(Math.ceil(player.displayHp) + ' / ' + player.maxHp, x + w - 16, y + 22);

  const low = player.hp <= player.maxHp * 0.3;
  const pulse = low ? 0.5 + 0.5 * Math.sin(game.time * 7) : 0;
  hpBar(x + 72, y + 36, w - 88, 13, player.displayHp / player.maxHp,
    player.ghostHp / player.maxHp, ['#8ff7c2', '#2fbf8f']);

  if (low) {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.4 * pulse;
    rr(x, y, w, h, 14);
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function drawBossHud() {
  const w = 326, x = W - 20 - w, y = 18, h = 68;
  panel(x, y, w, h, 14, 0.55);

  ctx.fillStyle = 'rgba(255,180,90,0.1)';
  circle(x + 38, y + 34, 24);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,190,110,0.32)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  drawMiniTree(x + 38, y + 37, 1.15);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '700 15px ' + UI_FONT;
  ctx.fillStyle = '#fff2dd';
  ctx.fillText('나무 괴물', x + 72, y + 22);

  if (monster.enraged) {
    ctx.font = '800 11px ' + UI_FONT;
    ctx.fillStyle = '#ff8a5c';
    ctx.fillText('분노', x + 148, y + 22);
  }

  ctx.textAlign = 'right';
  ctx.font = '700 12px ' + UI_FONT;
  ctx.fillStyle = 'rgba(255,225,190,0.8)';
  ctx.fillText(Math.ceil(monster.displayHp) + ' / ' + monster.maxHp, x + w - 16, y + 22);

  hpBar(x + 72, y + 36, w - 88, 13, monster.displayHp / monster.maxHp,
    monster.ghostHp / monster.maxHp, ['#ffb36b', '#ff5f5f']);

  // 체력 눈금
  ctx.save();
  ctx.strokeStyle = 'rgba(20,10,10,0.35)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const sx = x + 72 + (w - 88) * (i / 5);
    ctx.beginPath();
    ctx.moveTo(sx, y + 37);
    ctx.lineTo(sx, y + 48);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSkillCard(x, y, w, h, kind) {
  const cd = player.cooldowns[kind];
  const max = SKILL[kind].cd;
  const ready = cd <= 0;
  const ratio = 1 - clamp(cd / max, 0, 1);
  const accent = kind === 'q' ? '#8ff0ff' : '#ffd166';
  const name = kind === 'q' ? '검 휘두르기' : '찌르기';
  const desc = kind === 'q' ? '5 데미지 · 1초' : '10 데미지 · 3초';
  const key = kind === 'q' ? 'Q' : 'E';

  panel(x, y, w, h, 12, 0.6);

  const kx = x + 33;
  const ky = y + h / 2;

  // 쿨다운 링
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 3;
  circle(kx, ky, 21);
  ctx.stroke();
  if (!ready) {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(kx, ky, 21, -Math.PI / 2, -Math.PI / 2 + TAU * ratio);
    ctx.stroke();
  }
  ctx.restore();

  // 키 원
  ctx.fillStyle = ready ? 'rgba(16,38,40,0.95)' : 'rgba(12,24,26,0.95)';
  circle(kx, ky, 17);
  ctx.fill();
  ctx.strokeStyle = ready ? accent : 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 18px ' + UI_FONT;
  ctx.fillStyle = ready ? accent : 'rgba(255,255,255,0.45)';
  ctx.fillText(key, kx, ky + 1);

  // 텍스트
  ctx.textAlign = 'left';
  ctx.font = '700 15px ' + UI_FONT;
  ctx.fillStyle = ready ? '#f2fffb' : 'rgba(235,255,250,0.55)';
  ctx.fillText(name, x + 64, y + 22);

  ctx.font = '600 11px ' + UI_FONT;
  ctx.fillStyle = 'rgba(210,240,235,0.55)';
  ctx.fillText(desc, x + 64, y + 42);

  // 상태
  ctx.textAlign = 'right';
  if (ready) {
    ctx.font = '800 11px ' + UI_FONT;
    ctx.fillStyle = '#7ef9c8';
    ctx.fillText('READY', x + w - 14, y + 22);
  } else {
    ctx.font = '800 14px ' + UI_FONT;
    ctx.fillStyle = accent;
    ctx.fillText(cd.toFixed(1) + 's', x + w - 14, y + 22);
  }

  // 재충전 바
  const bx = x + 13, by = y + h - 8, bw = w - 26;
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  rr(bx, by, bw, 3, 1.5);
  ctx.fill();
  if (ratio > 0.01) {
    ctx.fillStyle = ready ? 'rgba(126,249,200,0.8)' : accent;
    rr(bx, by, bw * ratio, 3, 1.5);
    ctx.fill();
  }
}

function drawSkillHud() {
  const w = 232, h = 64, gap = 14;
  const x0 = (W - (w * 2 + gap)) / 2;
  const y = 464;
  drawSkillCard(x0, y, w, h, 'q');
  drawSkillCard(x0 + w + gap, y, w, h, 'e');

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = '600 11px ' + UI_FONT;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('P 일시정지 · M 소리', W - 22, 532);
}

function drawToast() {
  if (!game.toast) return;
  const tt = game.toast;
  const a = Math.max(0, Math.min(1, (tt.max - tt.t) / 0.15, tt.t / 0.3));
  if (a <= 0) return;

  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = '700 15px ' + UI_FONT;
  const tw = ctx.measureText(tt.text).width;
  const w = tw + 48;
  const x = W / 2 - w / 2;
  const y = 96;
  rr(x, y, w, 36, 18);
  ctx.fillStyle = 'rgba(8,22,20,0.8)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,255,220,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#dffff3';
  ctx.fillText(tt.text, W / 2, y + 19);
  ctx.restore();
}

function drawHUD() {
  drawPlayerHud();
  drawBossHud();
  drawSkillHud();
  drawToast();

  if (!player.dead && player.hp <= player.maxHp * 0.3) {
    const a = 0.1 + 0.08 * Math.sin(game.time * 5.5);
    const g = ctx.createRadialGradient(W / 2, H / 2, 230, W / 2, H / 2, 560);
    g.addColorStop(0, 'rgba(255,30,30,0)');
    g.addColorStop(1, 'rgba(255,40,40,' + a + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

/* ---------- 타이틀 ---------- */
function drawKeyPill(x, y, label, w) {
  const pw = w || 34;
  rr(x, y - 13, pw, 26, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 13px ' + UI_FONT;
  ctx.fillStyle = '#f4fffb';
  ctx.fillText(label, x + pw / 2, y + 1);
}

function drawTitle() {
  const t = game.time;
  const a = Math.min(1, game.stateTime / 0.4);

  ctx.save();
  ctx.globalAlpha = a;

  // 배경 딤
  const dim = ctx.createLinearGradient(0, 0, 0, H);
  dim.addColorStop(0, 'rgba(6,18,20,0.55)');
  dim.addColorStop(0.55, 'rgba(6,18,18,0.42)');
  dim.addColorStop(1, 'rgba(6,16,14,0.62)');
  ctx.fillStyle = dim;
  ctx.fillRect(0, 0, W, H);

  // 태그
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 13px ' + UI_FONT;
  ctx.fillStyle = '#ffe28a';
  ctx.fillText('2D 액션 · 보스전', W / 2, 84);

  // 타이틀
  ctx.save();
  ctx.shadowColor = 'rgba(120,255,210,0.35)';
  ctx.shadowBlur = 24;
  ctx.font = '900 62px ' + UI_FONT;
  ctx.fillStyle = '#fffdf2';
  ctx.fillText('해골 기사', W / 2, 144);
  ctx.restore();

  ctx.font = '700 20px ' + UI_FONT;
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText('초원의 나무 괴물', W / 2, 190);

  // 설명 패널
  panel(200, 222, 560, 150, 18, 0.62);
  ctx.textAlign = 'left';
  ctx.font = '800 12px ' + UI_FONT;
  ctx.fillStyle = 'rgba(255,226,138,0.85)';
  ctx.fillText('조작', 230, 248);
  ctx.fillText('목표', 500, 248);

  drawKeyPill(230, 280, '← →', 52);
  ctx.font = '600 14px ' + UI_FONT;
  ctx.fillStyle = '#e8fbf4';
  ctx.textAlign = 'left';
  ctx.fillText('이동', 292, 281);

  drawKeyPill(230, 314, 'Q', 34);
  ctx.fillText('검 휘두르기', 276, 315);
  ctx.font = '600 12px ' + UI_FONT;
  ctx.fillStyle = 'rgba(190,235,225,0.65)';
  ctx.fillText('5 데미지 · 쿨타임 1초', 366, 315);

  drawKeyPill(230, 348, 'E', 34);
  ctx.font = '600 14px ' + UI_FONT;
  ctx.fillStyle = '#e8fbf4';
  ctx.fillText('찌르기', 276, 349);
  ctx.font = '600 12px ' + UI_FONT;
  ctx.fillStyle = 'rgba(190,235,225,0.65)';
  ctx.fillText('10 데미지 · 쿨타임 3초', 366, 349);

  // 구분선
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(478, 252);
  ctx.lineTo(478, 344);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = '700 14px ' + UI_FONT;
  ctx.fillStyle = '#eafff8';
  ctx.fillText('나무 괴물의 체력 50을 0으로!', 500, 281);

  ctx.font = '600 12px ' + UI_FONT;
  ctx.fillStyle = 'rgba(255,190,160,0.85)';
  ctx.fillText('붙어 있으면 계속 5 피해', 500, 314);
  ctx.fillStyle = 'rgba(190,235,225,0.65)';
  ctx.fillText('빨간 예고를 보고 피하세요', 500, 342);

  // 시작 버튼
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
  const bx = W / 2 - 132, by = 398, bw = 264, bh = 56;
  ctx.save();
  ctx.shadowColor = 'rgba(255,208,90,' + (0.35 + 0.35 * pulse) + ')';
  ctx.shadowBlur = 18 + 14 * pulse;
  const bg = ctx.createLinearGradient(bx, by, bx, by + bh);
  bg.addColorStop(0, '#ffe28a');
  bg.addColorStop(1, '#ffb84d');
  rr(bx, by, bw, bh, 28);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.restore();

  rr(bx, by, bw, bh, 28);
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 20px ' + UI_FONT;
  ctx.fillStyle = '#3a2410';
  ctx.fillText('게임 시작  ▶', W / 2, by + bh / 2 + 1);

  ctx.font = '600 12px ' + UI_FONT;
  ctx.fillStyle = 'rgba(235,255,248,0.6)';
  ctx.fillText('클릭 또는 Space 로 시작', W / 2, 486);

  ctx.restore();
}

/* ---------- 결과 ---------- */
function drawResult() {
  const win = game.state === 'victory';
  const a = Math.min(1, game.stateTime / 0.45);
  ctx.save();
  ctx.globalAlpha = a;

  ctx.fillStyle = 'rgba(5,14,12,0.52)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.save();
  ctx.shadowColor = win ? 'rgba(255,220,110,0.5)' : 'rgba(255,90,90,0.45)';
  ctx.shadowBlur = 26;
  ctx.font = '900 68px ' + UI_FONT;
  ctx.fillStyle = win ? '#ffe066' : '#ff8080';
  ctx.fillText(win ? '승리!' : '패배...', W / 2, 172);
  ctx.restore();

  ctx.font = '700 18px ' + UI_FONT;
  ctx.fillStyle = '#e9fff8';
  ctx.fillText(win ? '나무 괴물을 쓰러뜨렸다!' : '해골 기사는 쓰러졌다...', W / 2, 222);

  // 스탯 패널
  panel(W / 2 - 220, 252, 440, 108, 16, 0.62);
  ctx.textAlign = 'left';
  ctx.font = '600 14px ' + UI_FONT;
  ctx.fillStyle = 'rgba(205,240,232,0.7)';
  ctx.fillText('소요 시간', W / 2 - 188, 284);
  ctx.fillText('남은 체력', W / 2 - 188, 324);

  ctx.textAlign = 'right';
  ctx.font = '800 16px ' + UI_FONT;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(game.elapsed.toFixed(1) + '초', W / 2 + 188, 284);

  if (win) {
    ctx.fillStyle = '#8ff7c2';
    ctx.fillText(Math.ceil(player.hp) + ' / ' + player.maxHp, W / 2 + 188, 324);
  } else {
    ctx.fillStyle = '#ffb36b';
    ctx.fillText('나무 괴물 ' + Math.ceil(monster.hp) + ' / ' + monster.maxHp, W / 2 + 188, 324);
  }

  // 다시 도전 버튼
  const pulse = 0.5 + 0.5 * Math.sin(game.time * 2.6);
  const bx = W / 2 - 122, by = 386, bw = 244, bh = 54;
  ctx.save();
  ctx.shadowColor = win ? 'rgba(255,208,90,' + (0.3 + 0.3 * pulse) + ')' : 'rgba(255,120,110,' + (0.3 + 0.3 * pulse) + ')';
  ctx.shadowBlur = 16 + 10 * pulse;
  const bg = ctx.createLinearGradient(bx, by, bx, by + bh);
  if (win) {
    bg.addColorStop(0, '#ffe28a');
    bg.addColorStop(1, '#ffb84d');
  } else {
    bg.addColorStop(0, '#ffb3a8');
    bg.addColorStop(1, '#ff7d6e');
  }
  rr(bx, by, bw, bh, 27);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.font = '900 19px ' + UI_FONT;
  ctx.fillStyle = '#3a2410';
  ctx.fillText('다시 도전', W / 2, by + bh / 2 + 1);

  ctx.font = '600 12px ' + UI_FONT;
  ctx.fillStyle = 'rgba(235,255,248,0.6)';
  ctx.fillText('R 키 또는 클릭', W / 2, 472);

  ctx.restore();
}

function drawPause() {
  ctx.save();
  ctx.fillStyle = 'rgba(4,12,10,0.62)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 46px ' + UI_FONT;
  ctx.fillStyle = '#eafff8';
  ctx.fillText('일시정지', W / 2, H / 2 - 12);
  ctx.font = '600 14px ' + UI_FONT;
  ctx.fillStyle = 'rgba(210,245,235,0.7)';
  ctx.fillText('P 키로 계속', W / 2, H / 2 + 34);
  ctx.restore();
}

function drawVignette() {
  const v = ctx.createRadialGradient(W / 2, H / 2, 220, W / 2, H / 2, 600);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(8,24,18,0.32)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

/* ---------- 렌더 ---------- */
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);

  ctx.save();
  if (game.shake > 0.3) {
    const s = game.shake;
    ctx.translate(rand(-s, s), rand(-s, s) * 0.6);
  }
  drawBackground();
  drawMonster();
  drawPlayer();
  drawEffects();
  drawParticles();
  drawNumbers();
  drawForeground();
  ctx.restore();

  if (game.flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.4, game.flash);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  drawVignette();

  if (game.state === 'playing' || game.state === 'victory' || game.state === 'defeat') {
    drawHUD();
  }
  if (game.state === 'title') drawTitle();
  if (game.state === 'victory' || game.state === 'defeat') drawResult();
  if (game.paused) drawPause();
}
