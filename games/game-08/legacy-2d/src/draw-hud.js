/* =========================================================================
   draw-hud.js — 목표, 조작법, 토스트, 클리어 화면
   ========================================================================= */
(() => {
  "use strict";

  const EG = window.EG;
  const C = EG.ELEMENTS;

  function glassPanel(c, x, y, w, h, radius = 12) {
    c.save();
    c.shadowColor = "rgba(0, 0, 0, 0.28)";
    c.shadowBlur = 20;
    c.shadowOffsetY = 7;
    EG.roundRect(c, x, y, w, h, radius);
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "rgba(11, 25, 37, 0.82)");
    g.addColorStop(1, "rgba(4, 11, 18, 0.78)");
    c.fillStyle = g;
    c.fill();
    c.shadowBlur = 0;
    c.shadowOffsetY = 0;
    c.strokeStyle = "rgba(136, 204, 226, 0.18)";
    c.lineWidth = 1;
    c.stroke();

    c.strokeStyle = "rgba(255, 255, 255, 0.05)";
    c.beginPath();
    c.moveTo(x + radius, y + 1);
    c.lineTo(x + w - radius, y + 1);
    c.stroke();
    c.restore();
  }

  function drawSpacedText(c, text, x, y, spacing, align = "left") {
    const chars = Array.from(text);
    const widths = chars.map((ch) => c.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
    let cursor = align === "center" ? x - total / 2 : x;
    for (let i = 0; i < chars.length; i++) {
      c.fillText(chars[i], cursor, y);
      cursor += widths[i] + spacing;
    }
    return total;
  }

  function drawControlCard(c, player, x, y, w) {
    const data = C[player.element];
    glassPanel(c, x, y, w, 46, 10);
    c.save();
    c.fillStyle = data.color;
    c.globalAlpha = 0.85;
    c.fillRect(x + 1, y + 9, 3, 28);
    c.globalAlpha = 1;
    EG.drawElementIcon(c, player.element, x + 25, y + 23, 10, data.color);
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillStyle = "rgba(237, 251, 255, 0.94)";
    c.font = "700 12px 'Apple SD Gothic Neo', sans-serif";
    c.fillText(`${data.p1} ${data.name}`, x + 40, y + 20);
    c.fillStyle = "rgba(166, 202, 215, 0.72)";
    c.font = "500 10px 'Apple SD Gothic Neo', sans-serif";
    c.fillText(player.element === "water" ? "A D 이동  ·  W 점프" : "← → 이동  ·  ↑ 점프", x + 40, y + 33);
    c.restore();
  }

  function drawObjective(c, game) {
    const t = game.time;
    const x = 416;
    const y = 18;
    const w = 448;
    const h = 82;
    glassPanel(c, x, y, w, h, 13);

    c.save();
    c.textAlign = "center";
    c.textBaseline = "alphabetic";

    if (!game.gate.open) {
      c.fillStyle = "rgba(255, 208, 132, 0.8)";
      c.font = "700 9px 'Apple SD Gothic Neo', sans-serif";
      drawSpacedText(c, "협동 목표", x + w / 2, y + 18, 2.1, "center");

      c.fillStyle = "rgba(235, 249, 255, 0.96)";
      c.font = "700 14px 'Apple SD Gothic Neo', sans-serif";
      c.fillText("각자의 웅덩이 성소를 동시에 밟으세요", x + w / 2, y + 40);
    } else {
      const pulse = 0.55 + Math.sin(t * 2.4) * 0.2;
      c.fillStyle = `rgba(255, 226, 154, ${pulse})`;
      c.font = "700 9px 'Apple SD Gothic Neo', sans-serif";
      drawSpacedText(c, "탈출", x + w / 2, y + 18, 2.4, "center");

      c.fillStyle = "rgba(235, 249, 255, 0.96)";
      c.font = "700 14px 'Apple SD Gothic Neo', sans-serif";
      c.fillText("이제 각자의 출구로 이동하세요", x + w / 2, y + 40);
    }

    // 성소 상태
    const plateState = Object.fromEntries(
      game.plates.map((plate) => [plate.element, plate]),
    );
    const chips = [
      { element: "water", x: x + 79, label: "P1 성소" },
      { element: "fire", x: x + 205, label: "P2 성소" },
    ];
    for (const chip of chips) {
      const data = C[chip.element];
      const plate = plateState[chip.element];
      const on = game.gate.open || plate.active;
      const x0 = chip.x;
      EG.roundRect(c, x0, y + 52, 112, 20, 7);
      c.fillStyle = on
        ? `rgba(${data.rgb}, 0.16)`
        : "rgba(70, 102, 116, 0.1)";
      c.fill();
      c.strokeStyle = on
        ? `rgba(${data.rgb}, 0.55)`
        : "rgba(130, 169, 184, 0.15)";
      c.lineWidth = 1;
      c.stroke();

      EG.drawElementIcon(
        c,
        chip.element,
        x0 + 15,
        y + 62,
        6.5,
        on ? data.color : "rgba(111, 146, 159, 0.48)",
      );
      c.font = "600 9px 'Apple SD Gothic Neo', sans-serif";
      c.textAlign = "left";
      c.fillStyle = on ? "rgba(240, 253, 255, 0.92)" : "rgba(142, 174, 186, 0.52)";
      c.fillText(chip.label, x0 + 26, y + 66);

      c.beginPath();
      if (on) {
        c.fillStyle = data.color;
        c.shadowBlur = 8;
        c.shadowColor = data.color;
      } else {
        c.fillStyle = "rgba(113, 146, 159, 0.32)";
      }
      c.arc(x0 + 98, y + 62, 3, 0, EG.TAU);
      c.fill();
      c.shadowBlur = 0;
    }

    const activeCount = game.gate.open
      ? 2
      : game.plates.filter((plate) => plate.active).length;
    c.textAlign = "right";
    c.font = "700 12px 'Apple SD Gothic Neo', sans-serif";
    c.fillStyle = game.gate.open
      ? "rgba(255, 229, 160, 0.92)"
      : activeCount === 2
        ? "rgba(255, 239, 181, 0.96)"
        : "rgba(197, 225, 235, 0.66)";
    c.fillText(game.gate.open ? "OPEN" : `${activeCount} / 2`, x + w - 24, y + 66);

    // 진행 게이지
    EG.roundRect(c, x + 24, y + 76, w - 48, 1.5, 1);
    c.fillStyle = "rgba(112, 158, 173, 0.12)";
    c.fill();
    c.restore();
  }

  function drawTopHud(c, game) {
    const t = game.time;
    c.save();
    c.textAlign = "left";
    c.textBaseline = "alphabetic";

    // 왼쪽 스테이지 정보
    c.fillStyle = "rgba(145, 214, 238, 0.62)";
    c.font = "700 9px 'Apple SD Gothic Neo', sans-serif";
    drawSpacedText(c, "STAGE 01  ·  TWIN SHRINES", 32, 32, 1.2, "left");

    const titleGradient = c.createLinearGradient(30, 0, 302, 0);
    titleGradient.addColorStop(0, "#d9fbff");
    titleGradient.addColorStop(0.55, "#f6ffff");
    titleGradient.addColorStop(1, "#ffd39a");
    c.fillStyle = titleGradient;
    c.font = "800 24px 'Apple SD Gothic Neo', sans-serif";
    c.fillText("물불 원정대", 31, 60);

    c.fillStyle = "rgba(151, 193, 208, 0.55)";
    c.font = "500 9px 'Apple SD Gothic Neo', sans-serif";
    c.fillText("두 원소가 함께 여는 길", 32, 78);

    // 중앙 목표
    drawObjective(c, game);

    // 오른쪽 기록
    glassPanel(c, 1082, 18, 166, 82, 13);
    c.textAlign = "right";
    c.fillStyle = "rgba(148, 207, 226, 0.58)";
    c.font = "700 9px 'Apple SD Gothic Neo', sans-serif";
    drawSpacedText(c, "TIME", 1228, 35, 1.6, "right");

    const shownTime = game.state === "won" ? game.finishTime : game.elapsed;
    c.fillStyle = "rgba(239, 252, 255, 0.95)";
    c.font = "600 23px 'SFMono-Regular', 'Menlo', monospace";
    c.fillText(EG.formatTime(shownTime), 1227, 60);

    c.font = "500 9px 'Apple SD Gothic Neo', sans-serif";
    c.fillStyle = "rgba(152, 190, 204, 0.56)";
    c.fillText(`실패 ${game.deaths}  ·  R 재시작`, 1227, 76);

    const soundOn = !EG.sfx.muted;
    c.fillStyle = soundOn ? "rgba(130, 222, 230, 0.6)" : "rgba(125, 154, 164, 0.38)";
    c.fillText(soundOn ? "M 소리 켜짐" : "M 소리 꺼짐", 1227, 90);

    // 사운드 아이콘
    c.save();
    c.translate(1098, 88);
    c.strokeStyle = soundOn
      ? "rgba(130, 222, 230, 0.58)"
      : "rgba(125, 154, 164, 0.3)";
    c.lineWidth = 1.3;
    c.beginPath();
    c.moveTo(0, 3);
    c.lineTo(4, 3);
    c.lineTo(8, -1);
    c.lineTo(8, 8);
    c.lineTo(4, 4);
    c.lineTo(0, 4);
    c.closePath();
    c.stroke();
    if (soundOn) {
      c.beginPath();
      c.arc(9, 3.5, 4, -0.9, 0.9);
      c.stroke();
      c.globalAlpha = 0.45 + Math.sin(t * 3) * 0.18;
    }
    c.restore();
    c.restore();
  }

  function drawBottomHud(c, game) {
    const [water, fire] = game.players;
    drawControlCard(c, water, 24, 656, 344);
    drawControlCard(c, fire, 912, 656, 344);

    c.save();
    c.textAlign = "center";
    EG.roundRect(c, 640 - 168, 673, 336, 36, 10);
    c.fillStyle = "rgba(3, 9, 15, 0.82)";
    c.fill();
    c.strokeStyle = "rgba(120, 170, 188, 0.16)";
    c.lineWidth = 1;
    c.stroke();
    c.fillStyle = "rgba(186, 216, 226, 0.72)";
    c.font = "500 10px 'Apple SD Gothic Neo', sans-serif";
    c.fillText("두 캐릭터가 각자의 출구에 도착하면 스테이지 클리어", 640, 687);
    c.fillStyle = "rgba(140, 178, 191, 0.5)";
    c.font = "500 9px 'Apple SD Gothic Neo', sans-serif";
    c.fillText("같은 키보드에서 2인 플레이", 640, 702);
    c.restore();
  }

  function drawToast(c, game) {
    const toast = game.toast;
    if (!toast) return;
    const t = game.time;
    const elapsed = toast.maxLife - toast.life;
    const fadeIn = EG.clamp(elapsed / 0.16, 0, 1);
    const fadeOut = EG.clamp(toast.life / 0.32, 0, 1);
    const alpha = Math.min(fadeIn, fadeOut);
    const slide = (1 - EG.easeOutCubic(fadeIn)) * -8;

    c.save();
    c.textAlign = "center";
    c.font = "700 15px 'Apple SD Gothic Neo', sans-serif";
    const titleWidth = c.measureText(toast.title).width;
    c.font = "500 9px 'Apple SD Gothic Neo', sans-serif";
    const subWidth = c.measureText(toast.sub).width;
    const w = Math.max(248, Math.max(titleWidth, subWidth) + 66);
    const h = 54;
    const x = 640 - w / 2;
    const y = 116 + slide + Math.sin(t * 2.5) * 0.8;

    c.globalAlpha = alpha;
    c.shadowColor = "rgba(0, 0, 0, 0.4)";
    c.shadowBlur = 22;
    c.shadowOffsetY = 8;
    EG.roundRect(c, x, y, w, h, 12);
    c.fillStyle = "rgba(5, 14, 22, 0.88)";
    c.fill();
    c.shadowBlur = 0;
    c.shadowOffsetY = 0;
    c.strokeStyle = toast.color;
    c.globalAlpha = alpha * 0.5;
    c.lineWidth = 1.2;
    c.stroke();
    c.globalAlpha = alpha;

    c.fillStyle = toast.color;
    c.fillRect(x + 1, y + 12, 3, h - 24);

    c.fillStyle = "rgba(243, 253, 255, 0.98)";
    c.font = "700 15px 'Apple SD Gothic Neo', sans-serif";
    c.fillText(toast.title, 640, y + 24);
    c.fillStyle = "rgba(159, 196, 210, 0.78)";
    c.font = "500 9px 'Apple SD Gothic Neo', sans-serif";
    c.fillText(toast.sub, 640, y + 40);
    c.restore();
  }

  function drawWinOverlay(c, game) {
    if (game.state !== "won") return;
    const delay = EG.clamp((game.winTimer - 0.32) / 0.55, 0, 1);
    if (delay <= 0) return;
    const eased = EG.easeOutCubic(delay);
    const t = game.time;

    c.save();
    // 배경 딤
    c.globalAlpha = eased * 0.66;
    c.fillStyle = "#03070c";
    c.fillRect(0, 0, EG.W, EG.H);

    // 중앙 라이트
    c.globalAlpha = eased;
    c.globalCompositeOperation = "screen";
    const halo = c.createRadialGradient(640, 350, 20, 640, 350, 430);
    halo.addColorStop(0, "rgba(255, 232, 166, 0.16)");
    halo.addColorStop(0.45, "rgba(94, 220, 255, 0.07)");
    halo.addColorStop(1, "rgba(0, 0, 0, 0)");
    c.fillStyle = halo;
    c.fillRect(180, 40, 920, 620);
    c.globalCompositeOperation = "source-over";

    const scale = EG.lerp(0.92, 1, eased);
    c.translate(640, 364);
    c.scale(scale, scale);
    c.translate(-640, -364);

    const panelW = 620;
    const panelH = 344;
    const px = 640 - panelW / 2;
    const py = 364 - panelH / 2;

    c.globalAlpha = eased;
    c.shadowColor = "rgba(0, 0, 0, 0.55)";
    c.shadowBlur = 42;
    c.shadowOffsetY = 20;
    EG.roundRect(c, px, py, panelW, panelH, 24);
    const panel = c.createLinearGradient(0, py, 0, py + panelH);
    panel.addColorStop(0, "rgba(13, 31, 44, 0.97)");
    panel.addColorStop(0.55, "rgba(7, 18, 28, 0.98)");
    panel.addColorStop(1, "rgba(4, 11, 19, 0.99)");
    c.fillStyle = panel;
    c.fill();
    c.shadowBlur = 0;
    c.shadowOffsetY = 0;
    c.strokeStyle = "rgba(255, 226, 157, 0.38)";
    c.lineWidth = 1.2;
    c.stroke();

    // 장식 테두리
    c.strokeStyle = "rgba(124, 218, 243, 0.14)";
    c.lineWidth = 1;
    EG.roundRect(c, px + 8, py + 8, panelW - 16, panelH - 16, 18);
    c.stroke();

    c.textAlign = "center";
    c.fillStyle = "rgba(255, 218, 137, 0.72)";
    c.font = "700 10px 'Apple SD Gothic Neo', sans-serif";
    drawSpacedText(c, "STAGE 01  ·  CLEAR", 640, py + 43, 2.7, "center");

    const titleGradient = c.createLinearGradient(460, 0, 820, 0);
    titleGradient.addColorStop(0, "#8cefff");
    titleGradient.addColorStop(0.42, "#f3ffff");
    titleGradient.addColorStop(0.7, "#ffd37f");
    titleGradient.addColorStop(1, "#ff8a4e");
    c.fillStyle = titleGradient;
    c.font = "900 62px 'Apple SD Gothic Neo', sans-serif";
    c.shadowColor = "rgba(255, 206, 121, 0.28)";
    c.shadowBlur = 28;
    c.fillText("STAGE CLEAR", 640, py + 115);
    c.shadowBlur = 0;

    c.fillStyle = "rgba(232, 249, 255, 0.94)";
    c.font = "700 15px 'Apple SD Gothic Neo', sans-serif";
    c.fillText("두 원소가 함께 길을 열었습니다", 640, py + 149);

    // 구분선
    const line = c.createLinearGradient(px + 80, 0, px + panelW - 80, 0);
    line.addColorStop(0, "rgba(99, 232, 255, 0)");
    line.addColorStop(0.3, "rgba(99, 232, 255, 0.32)");
    line.addColorStop(0.7, "rgba(255, 177, 90, 0.32)");
    line.addColorStop(1, "rgba(255, 177, 90, 0)");
    c.fillStyle = line;
    c.fillRect(px + 78, py + 168, panelW - 156, 1);

    // 기록
    c.font = "700 9px 'Apple SD Gothic Neo', sans-serif";
    c.fillStyle = "rgba(148, 204, 221, 0.58)";
    drawSpacedText(c, "TIME", 520, py + 197, 1.4, "center");
    drawSpacedText(c, "FAILS", 760, py + 197, 1.4, "center");

    c.fillStyle = "rgba(240, 252, 255, 0.96)";
    c.font = "600 27px 'SFMono-Regular', 'Menlo', monospace";
    c.fillText(EG.formatTime(game.finishTime), 520, py + 230);
    c.fillStyle = game.deaths === 0 ? "#ffe7a4" : "rgba(240, 252, 255, 0.9)";
    c.fillText(String(game.deaths), 760, py + 230);

    if (game.deaths === 0) {
      c.fillStyle = "rgba(255, 218, 131, 0.62)";
      c.font = "600 9px 'Apple SD Gothic Neo', sans-serif";
      c.fillText("NO FALLEN ELEMENT", 760, py + 247);
    }

    // 재시작 안내
    const pulse = 0.7 + Math.sin(t * 3.2) * 0.16;
    EG.roundRect(c, 640 - 148, py + 266, 296, 46, 12);
    c.fillStyle = "rgba(255, 226, 158, 0.08)";
    c.fill();
    c.strokeStyle = `rgba(255, 226, 158, ${0.42 * pulse})`;
    c.lineWidth = 1.2;
    c.stroke();

    c.fillStyle = "rgba(255, 239, 192, 0.96)";
    c.font = "700 13px 'Apple SD Gothic Neo', sans-serif";
    c.fillText("R 키를 눌러 다시 도전", 640, py + 288);
    c.fillStyle = "rgba(160, 198, 211, 0.56)";
    c.font = "500 9px 'Apple SD Gothic Neo', sans-serif";
    c.fillText("같은 스테이지에서 즉시 재시작합니다", 640, py + 302);

    c.restore();
  }

  EG.drawHUD = function drawHUD(c, game) {
    drawTopHud(c, game);
    drawBottomHud(c, game);
    drawToast(c, game);
  };

  EG.drawWinOverlay = drawWinOverlay;
})();
