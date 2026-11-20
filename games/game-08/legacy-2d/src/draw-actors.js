/* =========================================================================
   draw-actors.js — 물 캐릭터와 불 캐릭터
   ========================================================================= */
(() => {
  "use strict";

  const EG = window.EG;
  const C = EG.ELEMENTS;

  function drawShadow(c, player) {
    const cx = player.x + player.w / 2;
    const feetY = player.y + player.h;
    const airborne = !player.grounded;
    const width = airborne ? 20 : 27;
    c.save();
    c.globalAlpha = airborne ? 0.12 : 0.25;
    c.fillStyle = "#01060a";
    c.beginPath();
    c.ellipse(cx, feetY + 4, width, 5.5, 0, 0, EG.TAU);
    c.fill();
    c.restore();
  }

  function drawBadge(c, player, t) {
    const data = C[player.element];
    const cx = player.x + player.w / 2;
    const feetY = player.y + player.h;
    const bob = Math.sin(t * 2.4 + (player.element === "water" ? 0 : 1.8)) * 1.5;
    const y = feetY - 82 + bob;

    c.save();
    c.globalAlpha = 0.92;
    EG.roundRect(c, cx - 25, y - 10, 50, 20, 8);
    c.fillStyle = "rgba(4, 12, 19, 0.78)";
    c.fill();
    c.strokeStyle = `rgba(${data.rgb}, 0.48)`;
    c.lineWidth = 1;
    c.stroke();

    EG.drawElementIcon(c, player.element, cx - 13, y, 7, data.color);
    c.fillStyle = "rgba(236, 251, 255, 0.94)";
    c.font = "700 10px 'Apple SD Gothic Neo', sans-serif";
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillText(data.p1, cx - 4, y + 0.5);
    c.restore();
  }

  function drawWater(c, player, t) {
    const cx = player.x + player.w / 2;
    const feetY = player.y + player.h;
    const moving = Math.abs(player.vx) > 30 && player.grounded;
    const run = player.runPhase;
    const bob = player.grounded
      ? Math.sin(run * 2) * (moving ? 1.6 : 0.55) + Math.sin(t * 2.2) * 0.55
      : 0;
    const lean = EG.clamp(player.vx / EG.PHYS.maxSpeed, -1, 1) * 0.1;
    const squashX = 1 + player.squash * 0.55;
    const squashY = 1 - player.squash * 0.42;

    drawShadow(c, player);
    c.save();
    c.translate(cx, feetY + bob);
    c.rotate(lean);
    c.scale(player.facing * squashX, squashY);
    if (player.spawnGrace > 0) {
      c.globalAlpha = 0.5 + Math.abs(Math.sin(t * 22)) * 0.5;
    }

    const inPool = player.isInOwnPool();
    if (inPool) {
      c.save();
      c.globalAlpha = 0.38;
      c.strokeStyle = "#d6fcff";
      c.lineWidth = 1.2;
      c.beginPath();
      c.ellipse(0, -1, 27, 5, 0, 0, EG.TAU);
      c.stroke();
      c.restore();
    }

    // 뒤쪽 팔
    c.save();
    c.fillStyle = "rgba(84, 214, 250, 0.82)";
    c.beginPath();
    c.ellipse(-22, -25 + Math.sin(run + 1.3) * 2, 6, 8, -0.4, 0, EG.TAU);
    c.fill();
    c.restore();

    // 발
    const footSwing = moving ? Math.sin(run) * 4.5 : 0;
    const footLiftL = moving ? Math.max(0, Math.sin(run)) * 3 : 0;
    const footLiftR = moving ? Math.max(0, -Math.sin(run)) * 3 : 0;
    c.fillStyle = "#0d568f";
    c.beginPath();
    c.ellipse(-10 + footSwing, -1 - footLiftL, 8, 4.5, -0.1, 0, EG.TAU);
    c.fill();
    c.beginPath();
    c.ellipse(9 - footSwing, -1 - footLiftR, 8, 4.5, 0.1, 0, EG.TAU);
    c.fill();

    // 몸통
    const body = c.createLinearGradient(0, -62, 0, 3);
    body.addColorStop(0, "#d2fdff");
    body.addColorStop(0.2, "#8af0ff");
    body.addColorStop(0.62, "#42c8f7");
    body.addColorStop(1, "#176fc8");
    c.fillStyle = body;
    c.strokeStyle = "rgba(220, 254, 255, 0.82)";
    c.lineWidth = 1.5;
    c.shadowColor = "rgba(83, 224, 255, 0.55)";
    c.shadowBlur = 12;
    c.beginPath();
    c.moveTo(0, -62);
    c.bezierCurveTo(15, -42, 24, -28, 22, -16);
    c.bezierCurveTo(21, -3, 12, 4, 0, 4);
    c.bezierCurveTo(-12, 4, -21, -3, -22, -16);
    c.bezierCurveTo(-24, -28, -15, -42, 0, -62);
    c.closePath();
    c.fill();
    c.shadowBlur = 0;
    c.stroke();

    // 몸통 하이라이트
    c.save();
    c.globalCompositeOperation = "lighter";
    const shine = c.createLinearGradient(0, -58, 0, -15);
    shine.addColorStop(0, "rgba(255, 255, 255, 0.5)");
    shine.addColorStop(1, "rgba(255, 255, 255, 0)");
    c.fillStyle = shine;
    c.beginPath();
    c.ellipse(-6, -43, 7.5, 14, -0.35, 0, EG.TAU);
    c.fill();
    c.restore();

    // 물방울 무늬
    c.fillStyle = "rgba(225, 254, 255, 0.34)";
    c.beginPath();
    c.arc(8, -47, 2.2, 0, EG.TAU);
    c.fill();
    c.beginPath();
    c.arc(13, -39, 1.4, 0, EG.TAU);
    c.fill();

    // 얼굴
    c.fillStyle = "#effeff";
    c.beginPath();
    c.ellipse(-8, -33, 6, 7, 0, 0, EG.TAU);
    c.fill();
    c.beginPath();
    c.ellipse(8, -33, 6, 7, 0, 0, EG.TAU);
    c.fill();

    const pupilShift = 1.7;
    c.fillStyle = "#06283b";
    c.beginPath();
    c.arc(-8 + pupilShift, -32.5, 3, 0, EG.TAU);
    c.fill();
    c.beginPath();
    c.arc(8 + pupilShift, -32.5, 3, 0, EG.TAU);
    c.fill();

    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(-9.4 + pupilShift, -34, 1.05, 0, EG.TAU);
    c.fill();
    c.beginPath();
    c.arc(6.6 + pupilShift, -34, 1.05, 0, EG.TAU);
    c.fill();

    // 볼
    c.fillStyle = "rgba(74, 194, 232, 0.34)";
    c.beginPath();
    c.ellipse(-15, -24, 3.7, 2.1, 0, 0, EG.TAU);
    c.fill();
    c.beginPath();
    c.ellipse(15, -24, 3.7, 2.1, 0, 0, EG.TAU);
    c.fill();

    // 입
    c.strokeStyle = "#0c4f73";
    c.lineWidth = 1.35;
    c.lineCap = "round";
    c.beginPath();
    c.arc(0, -21.5, 4, 0.15, Math.PI - 0.15);
    c.stroke();

    // 앞쪽 팔
    c.save();
    c.fillStyle = "rgba(142, 242, 255, 0.92)";
    c.beginPath();
    c.ellipse(
      21,
      -24 + Math.sin(run + 2.6) * 2.5,
      6.2,
      8.2,
      0.45,
      0,
      EG.TAU,
    );
    c.fill();
    c.restore();

    c.restore();
  }

  function drawFire(c, player, t) {
    const cx = player.x + player.w / 2;
    const feetY = player.y + player.h;
    const moving = Math.abs(player.vx) > 30 && player.grounded;
    const run = player.runPhase;
    const bob = player.grounded
      ? Math.sin(run * 2) * (moving ? 1.5 : 0.45) + Math.sin(t * 2.8) * 0.65
      : 0;
    const lean = EG.clamp(player.vx / EG.PHYS.maxSpeed, -1, 1) * 0.1;
    const squashX = 1 + player.squash * 0.55;
    const squashY = 1 - player.squash * 0.42;

    drawShadow(c, player);
    c.save();
    c.translate(cx, feetY + bob);
    c.rotate(lean);
    c.scale(player.facing * squashX, squashY);
    if (player.spawnGrace > 0) {
      c.globalAlpha = 0.5 + Math.abs(Math.sin(t * 22)) * 0.5;
    }

    const inPool = player.isInOwnPool();
    if (inPool) {
      c.save();
      c.globalAlpha = 0.32;
      c.strokeStyle = "#ffe2a8";
      c.lineWidth = 1.2;
      c.beginPath();
      c.ellipse(0, -1, 28, 5, 0, 0, EG.TAU);
      c.stroke();
      c.restore();
    }

    // 뒤쪽 불꽃 팔
    c.save();
    c.fillStyle = "rgba(255, 126, 46, 0.82)";
    const backArmX = -23;
    const backArmY = -23 + Math.sin(run + 1.1) * 2;
    c.beginPath();
    c.moveTo(backArmX + 5, backArmY + 6);
    c.quadraticCurveTo(backArmX - 6, backArmY - 8, backArmX + 1, backArmY - 14);
    c.quadraticCurveTo(backArmX + 10, backArmY - 5, backArmX + 5, backArmY + 6);
    c.closePath();
    c.fill();
    c.restore();

    // 발
    const footSwing = moving ? Math.sin(run) * 4.5 : 0;
    c.fillStyle = "#b92f18";
    c.beginPath();
    c.ellipse(-10 + footSwing, -1, 8, 4.3, -0.1, 0, EG.TAU);
    c.fill();
    c.beginPath();
    c.ellipse(9 - footSwing, -1, 8, 4.3, 0.1, 0, EG.TAU);
    c.fill();

    // 몸통
    const body = c.createLinearGradient(0, -66, 0, 3);
    body.addColorStop(0, "#fff4bb");
    body.addColorStop(0.25, "#ffd66f");
    body.addColorStop(0.58, "#ff9a3d");
    body.addColorStop(1, "#e94321");
    c.fillStyle = body;
    c.strokeStyle = "rgba(255, 233, 181, 0.82)";
    c.lineWidth = 1.5;
    c.shadowColor = "rgba(255, 118, 45, 0.65)";
    c.shadowBlur = 13;
    c.beginPath();
    c.moveTo(0, 4);
    c.bezierCurveTo(-14, 4, -23, -5, -20, -16);
    c.bezierCurveTo(-30, -23, -26, -38, -13, -40);
    c.bezierCurveTo(-18, -54, -5, -59, 2, -48);
    c.bezierCurveTo(9, -66, 21, -54, 18, -42);
    c.bezierCurveTo(31, -35, 28, -15, 17, -6);
    c.bezierCurveTo(13, 0, 7, 4, 0, 4);
    c.closePath();
    c.fill();
    c.shadowBlur = 0;
    c.stroke();

    // 안쪽 불꽃
    c.save();
    c.globalCompositeOperation = "lighter";
    const inner = c.createLinearGradient(0, -48, 0, 2);
    inner.addColorStop(0, "rgba(255, 255, 226, 0.9)");
    inner.addColorStop(0.55, "rgba(255, 230, 132, 0.54)");
    inner.addColorStop(1, "rgba(255, 139, 52, 0)");
    c.fillStyle = inner;
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(-9, 0, -14, -8, -12, -16);
    c.bezierCurveTo(-18, -25, -11, -35, -2, -31);
    c.bezierCurveTo(0, -46, 12, -39, 10, -29);
    c.bezierCurveTo(19, -23, 16, -8, 7, -2);
    c.bezierCurveTo(4, 0, 2, 0, 0, 0);
    c.closePath();
    c.fill();

    // 살아 움직이는 불티
    const flicker = 0.5 + Math.sin(t * 7.5) * 0.5;
    c.fillStyle = `rgba(255, 252, 207, ${0.28 + flicker * 0.26})`;
    c.beginPath();
    c.arc(5, -42 + Math.sin(t * 5) * 1.5, 2.1, 0, EG.TAU);
    c.fill();
    c.beginPath();
    c.arc(-8, -46 + Math.cos(t * 4.4) * 1.2, 1.2, 0, EG.TAU);
    c.fill();
    c.restore();

    // 얼굴
    c.fillStyle = "#fff9e8";
    c.beginPath();
    c.ellipse(-8, -30, 6, 7, 0, 0, EG.TAU);
    c.fill();
    c.beginPath();
    c.ellipse(8, -30, 6, 7, 0, 0, EG.TAU);
    c.fill();

    const pupilShift = 1.7;
    c.fillStyle = "#421606";
    c.beginPath();
    c.arc(-8 + pupilShift, -29.5, 3, 0, EG.TAU);
    c.fill();
    c.beginPath();
    c.arc(8 + pupilShift, -29.5, 3, 0, EG.TAU);
    c.fill();

    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(-9.4 + pupilShift, -31, 1.05, 0, EG.TAU);
    c.fill();
    c.beginPath();
    c.arc(6.6 + pupilShift, -31, 1.05, 0, EG.TAU);
    c.fill();

    // 볼
    c.fillStyle = "rgba(255, 120, 66, 0.38)";
    c.beginPath();
    c.ellipse(-15, -21, 3.6, 2, 0, 0, EG.TAU);
    c.fill();
    c.beginPath();
    c.ellipse(15, -21, 3.6, 2, 0, 0, EG.TAU);
    c.fill();

    // 입
    c.strokeStyle = "#7e2c12";
    c.lineWidth = 1.35;
    c.lineCap = "round";
    c.beginPath();
    c.arc(0, -19, 4, 0.15, Math.PI - 0.15);
    c.stroke();

    // 앞쪽 불꽃 팔
    c.save();
    c.fillStyle = "rgba(255, 190, 94, 0.92)";
    const frontArmX = 22;
    const frontArmY = -22 + Math.sin(run + 2.4) * 2.5;
    c.beginPath();
    c.moveTo(frontArmX - 5, frontArmY + 6);
    c.quadraticCurveTo(frontArmX + 7, frontArmY - 8, frontArmX, frontArmY - 14);
    c.quadraticCurveTo(frontArmX - 10, frontArmY - 5, frontArmX - 5, frontArmY + 6);
    c.closePath();
    c.fill();
    c.restore();

    c.restore();
  }

  EG.drawPlayers = function drawPlayers(c, game) {
    const t = game.time;
    const sorted = game.players.slice().sort((a, b) => a.x - b.x);
    for (const player of sorted) {
      if (!player.alive || player.arrived) continue;
      if (player.element === "water") drawWater(c, player, t);
      else drawFire(c, player, t);
    }
    for (const player of sorted) {
      if (!player.alive || player.arrived) continue;
      drawBadge(c, player, t);
    }

    // 도착한 캐릭터의 작은 정령 표식
    for (const player of game.players) {
      if (!player.arrived) continue;
      const data = C[player.element];
      const exit = EG.LEVEL.exits.find((e) => e.element === player.element);
      if (!exit) continue;
      const bob = Math.sin(t * 2.8 + (player.element === "water" ? 0 : 1.5)) * 3;
      c.save();
      c.globalAlpha = 0.85;
      c.globalCompositeOperation = "lighter";
      EG.drawElementIcon(c, player.element, exit.x, exit.y + 58 + bob, 11, data.pale);
      c.restore();
    }
  };
})();
