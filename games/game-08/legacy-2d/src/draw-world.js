/* =========================================================================
   draw-world.js — 배경, 바닥, 웅덩이, 봉인문, 출구
   ========================================================================= */
(() => {
  "use strict";

  const EG = window.EG;
  const C = EG.ELEMENTS;

  const HANGING_CRYSTALS = [
    { x: 142, drop: 48, size: 11, phase: 0.2 },
    { x: 488, drop: 22, size: 7, phase: 1.7 },
    { x: 792, drop: 58, size: 12, phase: 2.9 },
    { x: 1120, drop: 34, size: 8, phase: 4.2 },
  ];

  const FAR_COLUMNS = [
    { x: 66, w: 54, top: 238 },
    { x: 342, w: 34, top: 308 },
    { x: 811, w: 42, top: 268 },
    { x: 1172, w: 62, top: 202 },
  ];

  const STALACTITES = [
    { x: 184, w: 66, h: 118 },
    { x: 432, w: 48, h: 74 },
    { x: 728, w: 84, h: 146 },
    { x: 1024, w: 58, h: 102 },
    { x: 1236, w: 82, h: 124 },
  ];

  function radial(c, x, y, radius, inner, outer) {
    const g = c.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    c.fillStyle = g;
    c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function drawHangingCrystal(c, crystal, time) {
    const sway = Math.sin(time * 0.7 + crystal.phase) * 2.2;
    const x = crystal.x + sway;
    const tipY = crystal.drop + crystal.size * 2.4;
    c.save();
    c.strokeStyle = "rgba(108, 165, 184, 0.16)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(crystal.x, 0);
    c.lineTo(x, crystal.drop);
    c.stroke();

    c.translate(x, crystal.drop);
    c.globalCompositeOperation = "lighter";
    const glow = c.createRadialGradient(0, 0, 0, 0, 0, crystal.size * 4);
    glow.addColorStop(0, "rgba(116, 228, 255, 0.18)");
    glow.addColorStop(1, "rgba(116, 228, 255, 0)");
    c.fillStyle = glow;
    c.beginPath();
    c.arc(0, 0, crystal.size * 4, 0, EG.TAU);
    c.fill();

    const gem = c.createLinearGradient(0, 0, 0, crystal.size * 2.3);
    gem.addColorStop(0, "rgba(184, 249, 255, 0.82)");
    gem.addColorStop(1, "rgba(32, 116, 169, 0.22)");
    c.fillStyle = gem;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(crystal.size * 0.62, crystal.size * 0.88);
    c.lineTo(0, tipY);
    c.lineTo(-crystal.size * 0.62, crystal.size * 0.88);
    c.closePath();
    c.fill();
    c.restore();
  }

  // -------------------------------------------------------------------------
  // 배경
  // -------------------------------------------------------------------------
  EG.drawBackground = function drawBackground(c, game) {
    const t = game.time;

    const sky = c.createLinearGradient(0, 0, 0, EG.H);
    sky.addColorStop(0, "#040a12");
    sky.addColorStop(0.38, "#081723");
    sky.addColorStop(0.72, "#0b1a26");
    sky.addColorStop(1, "#050a11");
    c.fillStyle = sky;
    c.fillRect(0, 0, EG.W, EG.H);

    radial(c, 245, 560, 480, "rgba(22, 146, 190, 0.16)", "rgba(22, 146, 190, 0)");
    radial(c, 920, 520, 560, "rgba(216, 91, 40, 0.12)", "rgba(216, 91, 40, 0)");
    radial(c, 656, 254, 430, "rgba(94, 180, 210, 0.08)", "rgba(94, 180, 210, 0)");

    // 멀리 보이는 쌍둥이 성소의 고리
    c.save();
    c.translate(642, 332);
    c.globalCompositeOperation = "lighter";
    c.lineWidth = 1.4;
    c.strokeStyle = "rgba(91, 196, 231, 0.11)";
    c.beginPath();
    c.arc(0, 0, 194, Math.PI / 2, Math.PI * 1.5);
    c.stroke();
    c.strokeStyle = "rgba(241, 138, 70, 0.1)";
    c.beginPath();
    c.arc(0, 0, 194, -Math.PI / 2, Math.PI / 2);
    c.stroke();
    c.strokeStyle = "rgba(154, 218, 235, 0.06)";
    c.lineWidth = 1;
    c.beginPath();
    c.arc(0, 0, 166, 0, EG.TAU);
    c.stroke();
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * EG.TAU + t * 0.015;
      const long = i % 2 === 0 ? 12 : 6;
      c.beginPath();
      c.moveTo(Math.cos(angle) * 203, Math.sin(angle) * 203);
      c.lineTo(Math.cos(angle) * (203 + long), Math.sin(angle) * (203 + long));
      c.strokeStyle =
        i < 8 ? "rgba(100, 225, 255, 0.12)" : "rgba(255, 160, 88, 0.1)";
      c.stroke();
    }
    c.restore();

    // 아주 먼 신전 기둥 실루엣
    for (const col of FAR_COLUMNS) {
      const g = c.createLinearGradient(0, col.top, 0, EG.FLOOR_Y);
      g.addColorStop(0, "rgba(16, 36, 49, 0.68)");
      g.addColorStop(0.45, "rgba(9, 25, 36, 0.6)");
      g.addColorStop(1, "rgba(4, 10, 16, 0.9)");
      c.fillStyle = g;
      c.fillRect(col.x, col.top, col.w, EG.FLOOR_Y - col.top);
      c.fillStyle = "rgba(111, 181, 204, 0.045)";
      c.fillRect(col.x + 4, col.top, 2, EG.FLOOR_Y - col.top);
      c.fillRect(col.x + col.w - 7, col.top, 1, EG.FLOOR_Y - col.top);
      c.fillStyle = "rgba(4, 10, 15, 0.82)";
      c.fillRect(col.x - 8, col.top - 12, col.w + 16, 12);
    }

    // 빛줄기
    c.save();
    c.globalCompositeOperation = "screen";
    const beams = [
      { x: 395, w: 92, drift: -14 },
      { x: 560, w: 170, drift: 16 },
      { x: 866, w: 112, drift: -22 },
    ];
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i];
      const gx = b.x + Math.sin(t * 0.08 + i) * b.drift;
      const beam = c.createLinearGradient(gx, 0, gx + 100, 610);
      beam.addColorStop(0, "rgba(151, 228, 255, 0.06)");
      beam.addColorStop(0.5, "rgba(105, 204, 233, 0.025)");
      beam.addColorStop(1, "rgba(78, 186, 225, 0)");
      c.fillStyle = beam;
      c.beginPath();
      c.moveTo(gx, -20);
      c.lineTo(gx + b.w, -20);
      c.lineTo(gx + b.w + 178, 612);
      c.lineTo(gx + 82, 612);
      c.closePath();
      c.fill();
    }
    c.restore();

    // 종유석
    for (const s of STALACTITES) {
      c.fillStyle = "rgba(3, 8, 13, 0.88)";
      c.beginPath();
      c.moveTo(s.x, -10);
      c.lineTo(s.x + s.w, -10);
      c.quadraticCurveTo(s.x + s.w * 0.76, s.h * 0.5, s.x + s.w * 0.48, s.h);
      c.quadraticCurveTo(s.x + s.w * 0.22, s.h * 0.54, s.x, -10);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(104, 172, 196, 0.06)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(s.x + s.w * 0.35, 0);
      c.quadraticCurveTo(
        s.x + s.w * 0.54,
        s.h * 0.5,
        s.x + s.w * 0.48,
        s.h,
      );
      c.stroke();
    }

    // 바닥 근처 안개
    c.save();
    c.globalCompositeOperation = "screen";
    for (let i = 0; i < 3; i++) {
      const x = 120 + i * 430 + Math.sin(t * 0.1 + i * 1.8) * 36;
      const mist = c.createRadialGradient(x, 610, 0, x, 610, 290);
      mist.addColorStop(0, "rgba(69, 140, 158, 0.045)");
      mist.addColorStop(1, "rgba(69, 140, 158, 0)");
      c.fillStyle = mist;
      c.fillRect(x - 300, 410, 600, 320);
    }
    c.restore();

    // 매달린 수정
    for (const crystal of HANGING_CRYSTALS) {
      drawHangingCrystal(c, crystal, t);
    }

    // 공중 먼지
    c.save();
    c.globalCompositeOperation = "lighter";
    for (const m of EG.motes) {
      const y = ((m.y - t * m.speed) % EG.H + EG.H) % EG.H;
      const x = m.x + Math.sin(t * 0.26 + m.phase) * m.drift;
      c.globalAlpha = 0.12 + 0.2 * (0.5 + 0.5 * Math.sin(t * 1.2 + m.phase));
      c.fillStyle = m.warm ? "#ffbd7a" : "#9deaff";
      c.beginPath();
      c.arc(x, y, m.size, 0, EG.TAU);
      c.fill();
    }
    c.restore();
  };

  // -------------------------------------------------------------------------
  // 바닥과 벽
  // -------------------------------------------------------------------------
  EG.drawFloor = function drawFloor(c, game) {
    const t = game.time;
    const floor = c.createLinearGradient(0, EG.FLOOR_Y, 0, EG.H);
    floor.addColorStop(0, "#1b2b39");
    floor.addColorStop(0.2, "#14222f");
    floor.addColorStop(1, "#081019");
    c.fillStyle = floor;
    c.fillRect(0, EG.FLOOR_Y, EG.W, EG.H - EG.FLOOR_Y);

    // 웅덩이의 바닥 반사광
    c.save();
    c.globalCompositeOperation = "screen";
    for (const pool of EG.LEVEL.pools) {
      const data = C[pool.type];
      const gx = pool.x + pool.w / 2;
      const g = c.createRadialGradient(gx, EG.FLOOR_Y + 18, 0, gx, EG.FLOOR_Y + 18, 160);
      g.addColorStop(0, `rgba(${data.rgb}, 0.16)`);
      g.addColorStop(1, `rgba(${data.rgb}, 0)`);
      c.fillStyle = g;
      c.fillRect(gx - 180, EG.FLOOR_Y, 360, 80);
    }
    c.restore();

    // 바닥 상단 모서리
    c.fillStyle = "rgba(111, 172, 194, 0.22)";
    c.fillRect(0, EG.FLOOR_Y, EG.W, 2);
    c.fillStyle = "rgba(4, 10, 16, 0.7)";
    c.fillRect(0, EG.FLOOR_Y + 2, EG.W, 5);

    // 석재 타일
    c.save();
    c.strokeStyle = "rgba(121, 175, 193, 0.075)";
    c.lineWidth = 1;
    const rowY = [EG.FLOOR_Y + 38, EG.FLOOR_Y + 76];
    for (const y of rowY) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(EG.W, y);
      c.stroke();
    }
    for (let row = 0; row < 2; row++) {
      const y = row === 0 ? EG.FLOOR_Y + 7 : EG.FLOOR_Y + 41;
      const step = row === 0 ? 92 : 116;
      const offset = row === 0 ? 0 : 53;
      for (let x = offset; x < EG.W; x += step) {
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x - 3, row === 0 ? EG.FLOOR_Y + 37 : EG.FLOOR_Y + 74);
        c.stroke();
      }
    }
    c.restore();

    // 바닥 균열
    c.strokeStyle = "rgba(1, 5, 8, 0.5)";
    c.lineWidth = 1.5;
    const crack = (x, y, length) => {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + length * 0.3, y + 9);
      c.lineTo(x + length * 0.48, y + 5);
      c.lineTo(x + length * 0.72, y + 18);
      c.lineTo(x + length, y + 12);
      c.stroke();
    };
    crack(70, 688, 44);
    crack(384, 706, 36);
    crack(782, 682, 52);
    crack(1094, 700, 40);

    // 좌우 벽
    const wallGradient = c.createLinearGradient(0, 0, 24, 0);
    wallGradient.addColorStop(0, "#050b12");
    wallGradient.addColorStop(0.6, "#0b1722");
    wallGradient.addColorStop(1, "rgba(16, 33, 46, 0.55)");
    c.fillStyle = wallGradient;
    c.fillRect(0, 0, 18, EG.FLOOR_Y);
    c.save();
    c.translate(EG.W, 0);
    c.scale(-1, 1);
    c.fillStyle = wallGradient;
    c.fillRect(0, 0, 18, EG.FLOOR_Y);
    c.restore();

    c.fillStyle = "rgba(118, 181, 203, 0.12)";
    c.fillRect(17, 0, 2, EG.FLOOR_Y);
    c.fillRect(EG.W - 19, 0, 2, EG.FLOOR_Y);

    c.fillStyle = "rgba(6, 12, 18, 0.9)";
    c.fillRect(0, EG.FLOOR_Y - 7, 23, 7);
    c.fillRect(EG.W - 23, EG.FLOOR_Y - 7, 23, 7);
    c.strokeStyle = "rgba(114, 181, 203, 0.15)";
    c.strokeRect(0.5, EG.FLOOR_Y - 7.5, 22, 7);

    // 얕은 빛 번짐
    c.save();
    c.globalCompositeOperation = "screen";
    c.globalAlpha = 0.35 + Math.sin(t * 1.4) * 0.05;
    const sheen = c.createLinearGradient(0, EG.FLOOR_Y, 0, EG.FLOOR_Y + 24);
    sheen.addColorStop(0, "rgba(160, 220, 238, 0.1)");
    sheen.addColorStop(1, "rgba(160, 220, 238, 0)");
    c.fillStyle = sheen;
    c.fillRect(24, EG.FLOOR_Y + 6, EG.W - 48, 24);
    c.restore();
  };

  // -------------------------------------------------------------------------
  // 웅덩이
  // -------------------------------------------------------------------------
  EG.drawPoolsBack = function drawPoolsBack(c, game) {
    const t = game.time;

    for (const pool of EG.LEVEL.pools) {
      const data = C[pool.type];
      const bottom = EG.FLOOR_Y + 6;

      // 웅덩이 테두리 / 홈
      c.save();
      const basin = c.createLinearGradient(0, pool.y - 10, 0, bottom + 12);
      basin.addColorStop(0, "#2b4352");
      basin.addColorStop(0.45, "#162834");
      basin.addColorStop(1, "#08131d");
      EG.roundRect(c, pool.x - 12, pool.y - 10, pool.w + 24, bottom - pool.y + 14, 14);
      c.fillStyle = basin;
      c.fill();
      c.strokeStyle = `rgba(${data.rgb}, 0.26)`;
      c.lineWidth = 1.2;
      c.stroke();
      c.strokeStyle = "rgba(177, 226, 239, 0.12)";
      c.beginPath();
      c.moveTo(pool.x - 4, pool.y - 9);
      c.lineTo(pool.x + pool.w + 4, pool.y - 9);
      c.stroke();
      c.restore();

      // 액체
      c.save();
      EG.roundRect(c, pool.x, pool.y, pool.w, bottom - pool.y, 9);
      c.clip();

      const liquid = c.createLinearGradient(0, pool.y, 0, bottom);
      if (pool.type === "water") {
        liquid.addColorStop(0, "rgba(56, 206, 246, 0.88)");
        liquid.addColorStop(0.32, "rgba(29, 149, 217, 0.9)");
        liquid.addColorStop(1, "rgba(8, 58, 112, 0.95)");
      } else {
        liquid.addColorStop(0, "rgba(255, 133, 48, 0.92)");
        liquid.addColorStop(0.35, "rgba(212, 58, 28, 0.94)");
        liquid.addColorStop(1, "rgba(84, 17, 16, 0.97)");
      }
      c.fillStyle = liquid;
      c.fillRect(pool.x - 2, pool.y - 3, pool.w + 4, pool.h + 20);

      // 깊이감
      const depth = c.createLinearGradient(0, bottom - 14, 0, bottom);
      depth.addColorStop(0, "rgba(0, 0, 0, 0)");
      depth.addColorStop(1, "rgba(0, 0, 0, 0.42)");
      c.fillStyle = depth;
      c.fillRect(pool.x, pool.y, pool.w, pool.h + 18);

      // 액체 속 빛의 굴절
      c.globalCompositeOperation = "lighter";
      for (let i = 0; i < 4; i++) {
        const bx = pool.x + ((i * 53 + 18) % (pool.w - 20)) + 10;
        const sway = Math.sin(t * 0.8 + i * 2.1) * 12;
        const bg = c.createLinearGradient(0, pool.y, 0, bottom);
        bg.addColorStop(0, `rgba(${data.rgb}, 0.13)`);
        bg.addColorStop(1, `rgba(${data.rgb}, 0)`);
        c.fillStyle = bg;
        c.beginPath();
        c.moveTo(bx, pool.y + 2);
        c.lineTo(bx + 20, pool.y + 2);
        c.lineTo(bx + 8 + sway, bottom);
        c.lineTo(bx - 10 + sway, bottom);
        c.closePath();
        c.fill();
      }

      // 기포 / 불티
      for (let i = 0; i < 11; i++) {
        const travel = (pool.h + 17) * 1.7;
        const by = bottom - ((t * (pool.type === "fire" ? 24 : 15) + i * 17) % travel);
        const bx =
          pool.x +
          16 +
          ((i * 41) % Math.max(1, pool.w - 32)) +
          Math.sin(t * 1.4 + i) * 5;
        const alpha = EG.clamp((bottom - by) / 8, 0.12, 0.75);
        c.fillStyle =
          pool.type === "water"
            ? `rgba(191, 249, 255, ${alpha * 0.6})`
            : `rgba(255, 218, 145, ${alpha * 0.7})`;
        c.beginPath();
        c.arc(bx, by, 1 + (i % 3) * 0.7, 0, EG.TAU);
        c.fill();
      }
      c.restore();

      // 액체를 감싸는 석재 테두리
      c.save();
      EG.roundRect(c, pool.x - 4, pool.y - 4, pool.w + 8, bottom - pool.y + 8, 10);
      c.strokeStyle = "#385565";
      c.lineWidth = 5;
      c.stroke();
      c.strokeStyle = "rgba(171, 225, 239, 0.14)";
      c.lineWidth = 1;
      c.stroke();

      const lip = c.createLinearGradient(0, bottom - 7, 0, bottom + 10);
      lip.addColorStop(0, "#314c5b");
      lip.addColorStop(0.55, "#1c303d");
      lip.addColorStop(1, "#0a151e");
      c.fillStyle = lip;
      c.fillRect(pool.x - 14, bottom - 5, pool.w + 28, 15);
      c.fillStyle = "rgba(171, 225, 239, 0.14)";
      c.fillRect(pool.x - 14, bottom - 5, pool.w + 28, 1);

      c.fillStyle = "rgba(5, 12, 18, 0.52)";
      for (let i = 0; i < 4; i++) {
        const nx = pool.x + ((i + 1) * pool.w) / 5;
        c.beginPath();
        c.moveTo(nx - 3, bottom + 1);
        c.lineTo(nx, bottom + 5);
        c.lineTo(nx + 3, bottom + 1);
        c.closePath();
        c.fill();
      }
      c.restore();

      // 테두리 돌
      c.save();
      c.fillStyle = "rgba(24, 41, 54, 0.95)";
      c.strokeStyle = "rgba(129, 186, 201, 0.16)";
      c.lineWidth = 1;
      for (const [x, flip] of [
        [pool.x - 10, 1],
        [pool.x + pool.w + 10, -1],
      ]) {
        c.beginPath();
        c.moveTo(x, pool.y - 4);
        c.lineTo(x + 8 * flip, pool.y - 11);
        c.lineTo(x + 14 * flip, pool.y + 4);
        c.lineTo(x + 8 * flip, pool.y + 11);
        c.closePath();
        c.fill();
        c.stroke();
      }
      c.restore();
    }
  };

  EG.drawPoolsFront = function drawPoolsFront(c, game) {
    const t = game.time;

    for (const pool of EG.LEVEL.pools) {
      const data = C[pool.type];
      const bottom = EG.FLOOR_Y + 6;

      c.save();
      EG.roundRect(c, pool.x, pool.y, pool.w, bottom - pool.y, 9);
      c.clip();

      // 캐릭터의 하반신을 물빛으로 물들이는 반투명 레이어
      const tint = c.createLinearGradient(0, pool.y, 0, bottom);
      tint.addColorStop(0, `rgba(${data.rgb}, 0.18)`);
      tint.addColorStop(1, `rgba(${data.rgb}, 0.08)`);
      c.fillStyle = tint;
      c.fillRect(pool.x, pool.y, pool.w, bottom - pool.y);

      // 수면
      c.beginPath();
      c.moveTo(pool.x, pool.y + 5);
      const segments = 24;
      for (let i = 0; i <= segments; i++) {
        const x = pool.x + (pool.w * i) / segments;
        const y =
          pool.y +
          Math.sin(t * 2.1 + i * 0.72) * 1.8 +
          Math.sin(t * 1.1 + i * 1.7) * 0.8;
        c.lineTo(x, y);
      }
      c.lineTo(pool.x + pool.w, pool.y + 13);
      c.lineTo(pool.x, pool.y + 13);
      c.closePath();
      const surface = c.createLinearGradient(0, pool.y, 0, pool.y + 15);
      surface.addColorStop(0, `rgba(${data.rgb}, 0.52)`);
      surface.addColorStop(1, `rgba(${data.rgb}, 0.02)`);
      c.fillStyle = surface;
      c.fill();

      c.globalCompositeOperation = "lighter";
      c.strokeStyle =
        pool.type === "water"
          ? "rgba(218, 253, 255, 0.95)"
          : "rgba(255, 229, 167, 0.95)";
      c.lineWidth = 1.8;
      c.shadowColor = data.color;
      c.shadowBlur = 9;
      c.beginPath();
      for (let i = 0; i <= segments; i++) {
        const x = pool.x + (pool.w * i) / segments;
        const y =
          pool.y +
          Math.sin(t * 2.1 + i * 0.72) * 1.8 +
          Math.sin(t * 1.1 + i * 1.7) * 0.8;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
      c.shadowBlur = 0;

      if (pool.type === "fire") {
        // 불웅덩이의 작은 불꽃 혀
        for (let i = 0; i < 9; i++) {
          const x = pool.x + 10 + (i / 8) * (pool.w - 20);
          const flicker = Math.sin(t * 7 + i * 2.3) * 3;
          const height = 8 + (i % 3) * 4 + flicker;
          const sway = Math.sin(t * 3.4 + i) * 2.2;
          c.fillStyle =
            i % 2 === 0
              ? "rgba(255, 220, 137, 0.55)"
              : "rgba(255, 119, 50, 0.45)";
          c.beginPath();
          c.moveTo(x - 5, pool.y + 2);
          c.quadraticCurveTo(x - 2, pool.y - height, x + sway, pool.y - height - 5);
          c.quadraticCurveTo(x + 4, pool.y - height * 0.4, x + 5, pool.y + 2);
          c.closePath();
          c.fill();
        }
      } else {
        // 물웅덩이의 잔물결
        for (let i = 0; i < 4; i++) {
          const x = pool.x + 28 + ((i * 47 + t * 12) % (pool.w - 56));
          const y = pool.y + 5 + Math.sin(t * 2 + i) * 1.5;
          c.strokeStyle = "rgba(220, 253, 255, 0.45)";
          c.lineWidth = 1;
          c.beginPath();
          c.ellipse(x, y, 7 + i * 1.5, 1.3, 0, 0, EG.TAU);
          c.stroke();
        }
      }

      c.restore();

      // 불웅덩이 위로 타오르는 불꽃
      if (pool.type === "fire") {
        c.save();
        c.globalCompositeOperation = "lighter";
        for (let i = 0; i < 11; i++) {
          const x = pool.x + 10 + (i / 10) * (pool.w - 20);
          const flicker = Math.sin(t * 7.5 + i * 2.3) * 4;
          const tongue = 9 + (i % 4) * 3.6 + flicker;
          const sway = Math.sin(t * 3.6 + i * 1.4) * 3;
          const flame = c.createLinearGradient(x, pool.y, x, pool.y - tongue - 8);
          flame.addColorStop(0, "rgba(255, 238, 177, 0.85)");
          flame.addColorStop(0.48, "rgba(255, 168, 66, 0.67)");
          flame.addColorStop(1, "rgba(255, 78, 32, 0)");
          c.fillStyle = flame;
          c.beginPath();
          c.moveTo(x - 5.5, pool.y + 1);
          c.quadraticCurveTo(
            x - 3,
            pool.y - tongue * 0.55,
            x + sway,
            pool.y - tongue - 7,
          );
          c.quadraticCurveTo(
            x + 4.5,
            pool.y - tongue * 0.32,
            x + 5.5,
            pool.y + 1,
          );
          c.closePath();
          c.fill();
        }
        c.restore();
      }

      // 수면 위로 피어오르는 원소 기운
      c.save();
      c.globalCompositeOperation = "lighter";
      const aura = c.createRadialGradient(
        pool.x + pool.w / 2,
        pool.y - 12,
        2,
        pool.x + pool.w / 2,
        pool.y - 12,
        pool.w * 0.58,
      );
      aura.addColorStop(
        0,
        pool.type === "water"
          ? "rgba(83, 222, 255, 0.075)"
          : "rgba(255, 128, 52, 0.08)",
      );
      aura.addColorStop(1, "rgba(0, 0, 0, 0)");
      c.fillStyle = aura;
      c.fillRect(pool.x - 36, pool.y - 60, pool.w + 72, 88);
      c.restore();
    }
  };

  // -------------------------------------------------------------------------
  // 봉인문과 에너지 도관
  // -------------------------------------------------------------------------
  EG.drawConduits = function drawConduits(c, game) {
    const gateX = EG.LEVEL.gate.x + EG.LEVEL.gate.w / 2;
    const t = game.time;

    for (let i = 0; i < game.plates.length; i++) {
      const plate = game.plates[i];
      const data = C[plate.element];
      const active = plate.active || plate.solved;
      const y = EG.LEVEL.conduitY[i];
      const startX = plate.x;
      const endX = gateX - 12;

      c.save();
      c.lineCap = "round";

      c.strokeStyle = `rgba(${data.rgb}, ${active ? 0.2 : 0.075})`;
      c.lineWidth = 8;
      c.beginPath();
      c.moveTo(startX, y);
      c.lineTo(endX, y);
      c.stroke();

      c.strokeStyle = `rgba(${data.rgb}, ${active ? 0.86 : 0.18})`;
      c.lineWidth = active ? 2.6 : 1.4;
      if (active) {
        c.globalCompositeOperation = "lighter";
        c.shadowBlur = 10;
        c.shadowColor = data.color;
        c.setLineDash([10, 8]);
        c.lineDashOffset = -t * 48;
      } else {
        c.setLineDash([3, 13]);
      }
      c.beginPath();
      c.moveTo(startX, y);
      c.lineTo(endX, y);
      c.stroke();
      c.setLineDash([]);
      c.shadowBlur = 0;

      if (active) {
        for (let k = 0; k < 5; k++) {
          const progress = ((t * 0.34 + k * 0.2 + i * 0.11) % 1);
          const x = EG.lerp(startX, endX, progress);
          c.fillStyle = `rgba(${data.rgb}, ${0.35 + Math.sin(progress * Math.PI) * 0.55})`;
          c.beginPath();
          c.arc(x, y, 2.5, 0, EG.TAU);
          c.fill();
        }
      }
      c.restore();
    }
  };

  EG.drawGate = function drawGate(c, game) {
    const t = game.time;
    const gate = EG.LEVEL.gate;
    const { x, y, w } = gate;
    const base = EG.FLOOR_Y;
    const cx = x + w / 2;
    const progress = EG.easeInOutCubic(game.gate.progress);
    const flicker = 0.9 + Math.sin(t * 4.3) * 0.06;
    const panelW = w / 2;
    const slide = progress * (panelW + 6);
    const plateStates = Object.fromEntries(game.plates.map((p) => [p.element, p]));
    const waterLit = plateStates.water.active || plateStates.water.solved;
    const fireLit = plateStates.fire.active || plateStates.fire.solved;

    // 문 뒤쪽의 옅은 빛
    if (game.gate.open || progress > 0) {
      c.save();
      c.globalCompositeOperation = "lighter";
      const portalGlow = c.createLinearGradient(0, y + 8, 0, base);
      portalGlow.addColorStop(0, "rgba(255, 238, 189, 0.09)");
      portalGlow.addColorStop(0.48, "rgba(98, 226, 255, 0.1)");
      portalGlow.addColorStop(1, "rgba(255, 161, 84, 0.06)");
      c.fillStyle = portalGlow;
      c.fillRect(x + 2, y + 8, w - 4, base - y - 8);
      c.restore();
    }

    // 문틀 전체 그림자
    c.save();
    EG.roundRect(c, x - 16, y - 8, w + 32, base - y + 16, 9);
    c.fillStyle = "rgba(2, 6, 10, 0.72)";
    c.fill();

    // 문 안쪽 / 문짝
    EG.roundRect(c, x, y + 2, w, base - y - 2, 4);
    c.fillStyle = "#02060a";
    c.fill();
    c.clip();

    if (game.gate.open) {
      const inner = c.createLinearGradient(0, y, 0, base);
      inner.addColorStop(0, "rgba(23, 61, 73, 0.62)");
      inner.addColorStop(0.45, "rgba(7, 18, 24, 0.95)");
      inner.addColorStop(1, "rgba(2, 6, 9, 0.99)");
      c.fillStyle = inner;
      c.fillRect(x, y, w, base - y);
      c.globalCompositeOperation = "lighter";
      const opening = c.createLinearGradient(x, 0, x + w, 0);
      opening.addColorStop(0, "rgba(84, 213, 247, 0.08)");
      opening.addColorStop(0.5, "rgba(255, 224, 159, 0.2)");
      opening.addColorStop(1, "rgba(255, 123, 52, 0.08)");
      c.fillStyle = opening;
      c.fillRect(x, y, w, base - y);
      c.globalCompositeOperation = "source-over";
    }

    const drawPanel = (px, side) => {
      const tint = side === -1 ? C.water : C.fire;
      const grad = c.createLinearGradient(px, 0, px + panelW, 0);
      grad.addColorStop(0, side === -1 ? "#283f4f" : "#172a36");
      grad.addColorStop(0.32, "#223744");
      grad.addColorStop(0.72, "#152530");
      grad.addColorStop(1, side === -1 ? "#101d26" : "#263d4b");
      c.fillStyle = grad;
      c.fillRect(px, y + 2, panelW + 1, base - y - 2);

      // 안쪽 베벨
      c.strokeStyle = "rgba(154, 213, 230, 0.2)";
      c.lineWidth = 1;
      c.strokeRect(px + 4.5, y + 10.5, panelW - 9, base - y - 21);
      c.strokeStyle = "rgba(3, 8, 12, 0.8)";
      c.strokeRect(px + 2.5, y + 8.5, panelW - 5, base - y - 17);

      // 가로 철제 밴드
      for (const bandY of [y + 78, y + 210, y + 342]) {
        c.fillStyle = "rgba(6, 13, 18, 0.58)";
        c.fillRect(px + 4, bandY, panelW - 8, 5);
        c.fillStyle = "rgba(155, 210, 224, 0.12)";
        c.fillRect(px + 4, bandY, panelW - 8, 1);
      }

      // 왼쪽은 물, 오른쪽은 불의 미세한 결정맥
      c.save();
      c.globalCompositeOperation = "lighter";
      c.strokeStyle = `rgba(${tint.rgb}, 0.18)`;
      c.lineWidth = 1;
      c.beginPath();
      if (side === -1) {
        c.moveTo(px + 9, y + 24);
        c.lineTo(px + 20, y + 118);
        c.lineTo(px + 12, y + 196);
        c.lineTo(px + 22, y + 278);
        c.lineTo(px + 14, y + 404);
      } else {
        c.moveTo(px + panelW - 9, y + 24);
        c.lineTo(px + panelW - 21, y + 108);
        c.lineTo(px + panelW - 13, y + 188);
        c.lineTo(px + panelW - 24, y + 298);
        c.lineTo(px + panelW - 14, y + 410);
      }
      c.stroke();
      c.restore();

      // 경첩 볼트
      for (const by of [y + 96, y + 238, y + 376]) {
        const bx = px + (side === -1 ? 7 : panelW - 7);
        c.fillStyle = "rgba(5, 11, 16, 0.75)";
        c.beginPath();
        c.arc(bx, by, 3.4, 0, EG.TAU);
        c.fill();
        c.strokeStyle = "rgba(143, 198, 214, 0.22)";
        c.lineWidth = 1;
        c.stroke();
      }

      // 문짝 룬
      const runeX = px + panelW / 2;
      c.fillStyle = `rgba(${tint.rgb}, 0.14)`;
      c.beginPath();
      c.moveTo(runeX, y + 262);
      c.lineTo(runeX + 6, y + 274);
      c.lineTo(runeX, y + 286);
      c.lineTo(runeX - 6, y + 274);
      c.closePath();
      c.fill();
    };

    drawPanel(x - slide, -1);
    drawPanel(x + panelW + slide, 1);

    // 중앙의 쌍둥이 봉인 문장
    if (progress < 0.98) {
      const lockAlpha = 1 - progress;
      const lockY = y + 232;
      c.save();
      c.globalAlpha = lockAlpha;
      c.translate(cx, lockY);
      c.rotate(t * 0.08);

      c.fillStyle = "rgba(3, 9, 14, 0.88)";
      c.beginPath();
      c.arc(0, 0, 35, 0, EG.TAU);
      c.fill();
      c.strokeStyle = "rgba(169, 220, 233, 0.22)";
      c.lineWidth = 1;
      c.stroke();

      c.save();
      c.globalCompositeOperation = "lighter";
      c.strokeStyle = `rgba(${C.water.rgb}, ${waterLit ? 0.9 : 0.28})`;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, 27, Math.PI / 2, Math.PI * 1.5);
      c.stroke();
      c.strokeStyle = `rgba(${C.fire.rgb}, ${fireLit ? 0.9 : 0.28})`;
      c.beginPath();
      c.arc(0, 0, 27, -Math.PI / 2, Math.PI / 2);
      c.stroke();
      c.restore();

      c.fillStyle = "rgba(143, 201, 218, 0.2)";
      c.beginPath();
      c.moveTo(0, -17);
      c.lineTo(8, 0);
      c.lineTo(0, 17);
      c.lineTo(-8, 0);
      c.closePath();
      c.fill();

      c.strokeStyle = "rgba(219, 244, 250, 0.42)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, -38);
      c.lineTo(0, 38);
      c.stroke();
      c.restore();
    }

    // 막고 있는 에너지 봉인
    if (progress < 0.98) {
      c.save();
      c.globalAlpha = (1 - progress) * flicker;
      c.globalCompositeOperation = "lighter";
      const seal = c.createLinearGradient(0, y, 0, base);
      seal.addColorStop(0, "rgba(117, 223, 255, 0.05)");
      seal.addColorStop(0.35, "rgba(117, 223, 255, 0.1)");
      seal.addColorStop(0.62, "rgba(255, 177, 90, 0.09)");
      seal.addColorStop(1, "rgba(255, 177, 90, 0.025)");
      c.fillStyle = seal;
      c.fillRect(x + 2, y + 4, w - 4, base - y - 4);

      for (let i = 0; i < 3; i++) {
        const ly = y + 50 + ((t * 22 + i * 130) % (base - y - 80));
        c.strokeStyle =
          i === 0
            ? "rgba(125, 235, 255, 0.3)"
            : i === 1
              ? "rgba(255, 197, 116, 0.26)"
              : "rgba(221, 245, 255, 0.2)";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x + 8, ly);
        c.lineTo(x + w - 8, ly + Math.sin(t + i) * 3);
        c.stroke();
      }

      for (let i = 0; i < 4; i++) {
        const gy = y + 80 + i * 82;
        const gx = cx + Math.sin(t * 1.3 + i * 1.7) * 8;
        c.strokeStyle = "rgba(195, 240, 250, 0.22)";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(gx - 4, gy);
        c.lineTo(gx + 4, gy);
        c.moveTo(gx, gy - 4);
        c.lineTo(gx, gy + 4);
        c.stroke();
      }
      c.restore();
    }
    c.restore();

    // 거대한 석재 문틀
    const pillarGrad = c.createLinearGradient(0, y, 0, base);
    pillarGrad.addColorStop(0, "#2b414f");
    pillarGrad.addColorStop(0.45, "#1b2d39");
    pillarGrad.addColorStop(1, "#0d1821");

    for (const px of [x - 44, x + w + 6]) {
      c.fillStyle = "rgba(2, 6, 10, 0.56)";
      c.fillRect(px - 2, y - 2, 46, base - y + 7);

      c.fillStyle = pillarGrad;
      EG.roundRect(c, px, y - 4, 38, base - y + 4, 5);
      c.fill();
      c.strokeStyle = "rgba(157, 214, 230, 0.18)";
      c.lineWidth = 1;
      c.stroke();

      // 세로 홈
      c.fillStyle = "rgba(3, 9, 14, 0.58)";
      c.fillRect(px + 9, y + 20, 4, base - y - 48);
      c.fillRect(px + 25, y + 20, 3, base - y - 48);
      c.fillStyle = "rgba(152, 207, 222, 0.1)";
      c.fillRect(px + 7, y + 20, 1, base - y - 48);
      c.fillRect(px + 23, y + 20, 1, base - y - 48);

      // 기둥 머리 / 받침
      c.fillStyle = "#334c5b";
      c.fillRect(px - 6, y - 10, 50, 15);
      c.fillStyle = "rgba(183, 232, 244, 0.14)";
      c.fillRect(px - 6, y - 10, 50, 2);
      c.fillStyle = "#2c4453";
      c.fillRect(px - 7, base - 18, 52, 18);
      c.fillStyle = "rgba(169, 222, 236, 0.13)";
      c.fillRect(px - 7, base - 18, 52, 2);
    }

    // 상단 문틀
    const lintel = c.createLinearGradient(0, y - 47, 0, y + 10);
    lintel.addColorStop(0, "#334c5b");
    lintel.addColorStop(0.35, "#263d4b");
    lintel.addColorStop(1, "#14242f");
    c.fillStyle = lintel;
    EG.roundRect(c, x - 54, y - 47, w + 108, 58, 8);
    c.fill();
    c.strokeStyle = "rgba(164, 220, 235, 0.22)";
    c.lineWidth = 1.2;
    c.stroke();

    c.fillStyle = "rgba(4, 10, 15, 0.55)";
    c.fillRect(x - 36, y - 31, w + 72, 2);
    c.fillRect(x - 36, y - 20, w + 72, 1);
    c.fillStyle = "rgba(177, 230, 244, 0.12)";
    c.fillRect(x - 42, y - 16, w + 84, 1);

    // 봉인 결정
    for (const [element, mx, lit] of [
      ["water", x - 22, waterLit],
      ["fire", x + w + 22, fireLit],
    ]) {
      const data = C[element];
      c.save();
      c.translate(mx, y - 17);
      c.fillStyle = "rgba(4, 10, 15, 0.82)";
      c.beginPath();
      c.arc(0, 0, 12.5, 0, EG.TAU);
      c.fill();
      c.strokeStyle = lit
        ? `rgba(${data.rgb}, 0.7)`
        : "rgba(132, 178, 194, 0.18)";
      c.lineWidth = 1.2;
      c.stroke();

      c.globalCompositeOperation = "lighter";
      if (lit) {
        const glow = c.createRadialGradient(0, 0, 0, 0, 0, 26);
        glow.addColorStop(0, `rgba(${data.rgb}, 0.62)`);
        glow.addColorStop(1, `rgba(${data.rgb}, 0)`);
        c.fillStyle = glow;
        c.beginPath();
        c.arc(0, 0, 26, 0, EG.TAU);
        c.fill();
      }
      c.restore();
      EG.drawElementIcon(c, element, mx, y - 17, 8, lit ? data.pale : "#7896a4");
    }

    // 문틀 상단 룬
    c.save();
    c.globalAlpha = 0.34;
    c.fillStyle = "#b9e1eb";
    for (let i = 0; i < 5; i++) {
      const gx = cx - 42 + i * 21;
      const gy = y - 38;
      c.beginPath();
      c.moveTo(gx, gy - 3);
      c.lineTo(gx + 3, gy);
      c.lineTo(gx, gy + 3);
      c.lineTo(gx - 3, gy);
      c.closePath();
      c.fill();
    }
    c.restore();

    c.save();
    c.globalAlpha = 0.5;
    c.fillStyle = "#b7dfe9";
    c.font = "600 9px 'Apple SD Gothic Neo', sans-serif";
    c.textAlign = "center";
    c.fillText("TWIN SEAL", cx, y - 59);
    c.restore();

    // 열린 뒤 안쪽 빛기둥
    if (game.gate.open) {
      c.save();
      c.globalCompositeOperation = "lighter";
      c.globalAlpha = 0.18 + progress * 0.26;
      const beam = c.createLinearGradient(cx, base, cx, y + 15);
      beam.addColorStop(0, "rgba(255, 226, 163, 0.3)");
      beam.addColorStop(0.55, "rgba(104, 228, 255, 0.08)");
      beam.addColorStop(1, "rgba(255, 146, 65, 0)");
      c.fillStyle = beam;
      c.beginPath();
      c.moveTo(cx - 21, base);
      c.lineTo(cx + 21, base);
      c.lineTo(cx + 7, y + 15);
      c.lineTo(cx - 7, y + 15);
      c.closePath();
      c.fill();
      c.restore();
    }
  };


  // -------------------------------------------------------------------------
  EG.drawPlates = function drawPlates(c, game) {
    const t = game.time;
    for (const plate of game.plates) {
      const data = C[plate.element];
      const active = plate.active || plate.solved;
      const pulse = active
        ? 1
        : 0.72 + Math.sin(t * 2.2 + (plate.element === "water" ? 0 : 1.7)) * 0.12;

      c.save();
      c.translate(plate.x, EG.FLOOR_Y - 6);

      // 성소 받침
      c.fillStyle = "rgba(4, 11, 17, 0.72)";
      c.beginPath();
      c.ellipse(0, 0, 35, 12, 0, 0, EG.TAU);
      c.fill();
      c.strokeStyle = `rgba(${data.rgb}, ${0.2 + pulse * 0.2})`;
      c.lineWidth = 1.2;
      c.stroke();

      // 룬 테두리
      c.save();
      c.rotate(t * (plate.element === "water" ? 0.25 : -0.25));
      c.strokeStyle = `rgba(${data.rgb}, ${active ? 0.9 : 0.32})`;
      c.lineWidth = 1.4;
      c.beginPath();
      c.ellipse(0, 0, 26, 8.5, 0, 0, EG.TAU);
      c.stroke();
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * EG.TAU;
        const x = Math.cos(angle) * 29;
        const y = Math.sin(angle) * 9.6;
        c.beginPath();
        c.moveTo(x * 0.86, y * 0.86);
        c.lineTo(x, y);
        c.stroke();
      }
      c.restore();

      // 중앙 아이콘 문양
      c.globalAlpha = active ? 1 : 0.72;
      c.globalCompositeOperation = active ? "lighter" : "source-over";
      EG.drawElementIcon(c, plate.element, 0, -2, 7.5, active ? data.pale : data.color);
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";

      if (active) {
        // 성소가 켜졌을 때 위로 솟는 빛
        c.globalCompositeOperation = "lighter";
        const light = c.createLinearGradient(0, 0, 0, -92);
        light.addColorStop(0, `rgba(${data.rgb}, 0.3)`);
        light.addColorStop(0.45, `rgba(${data.rgb}, 0.11)`);
        light.addColorStop(1, `rgba(${data.rgb}, 0)`);
        c.fillStyle = light;
        c.beginPath();
        c.moveTo(-22, 2);
        c.lineTo(22, 2);
        c.lineTo(9, -92);
        c.lineTo(-9, -92);
        c.closePath();
        c.fill();
        c.globalCompositeOperation = "source-over";

        const ringPulse = (t * 0.7 + (plate.element === "water" ? 0 : 0.5)) % 1;
        c.strokeStyle = `rgba(${data.rgb}, ${(1 - ringPulse) * 0.6})`;
        c.lineWidth = 1.5;
        c.beginPath();
        c.ellipse(0, 0, 26 + ringPulse * 20, 8 + ringPulse * 7, 0, 0, EG.TAU);
        c.stroke();
      }
      c.restore();
    }
  };

  // -------------------------------------------------------------------------
  // 출구
  // -------------------------------------------------------------------------
  EG.drawExits = function drawExits(c, game) {
    const t = game.time;

    for (const exit of EG.LEVEL.exits) {
      const data = C[exit.element];
      const player = game.players.find((p) => p.element === exit.element);
      const active = game.gate.open;
      const arrived = player && player.arrived;
      const pulse = 0.5 + Math.sin(t * 2 + (exit.element === "water" ? 0 : 1.8)) * 0.5;
      const left = exit.x - exit.w / 2;
      const right = exit.x + exit.w / 2;
      const top = exit.y;
      const bottom = EG.FLOOR_Y;

      // 바닥 빛
      c.save();
      c.globalCompositeOperation = "lighter";
      const floorGlow = c.createRadialGradient(exit.x, bottom, 0, exit.x, bottom, 84);
      floorGlow.addColorStop(
        0,
        `rgba(${data.rgb}, ${active ? 0.16 + pulse * 0.06 : 0.04})`,
      );
      floorGlow.addColorStop(1, `rgba(${data.rgb}, 0)`);
      c.fillStyle = floorGlow;
      c.fillRect(exit.x - 90, bottom - 16, 180, 58);
      c.restore();

      // 외곽 석재 케이싱
      c.save();
      c.beginPath();
      c.moveTo(left - 10, bottom);
      c.lineTo(left - 10, top + 39);
      c.quadraticCurveTo(left - 10, top - 11, exit.x, top - 11);
      c.quadraticCurveTo(right + 10, top - 11, right + 10, top + 39);
      c.lineTo(right + 10, bottom);
      c.closePath();
      const stone = c.createLinearGradient(left, top, right, bottom);
      stone.addColorStop(0, "#2b4050");
      stone.addColorStop(0.6, "#172733");
      stone.addColorStop(1, "#0d1820");
      c.fillStyle = stone;
      c.fill();
      c.strokeStyle = `rgba(${data.rgb}, ${active ? 0.38 : 0.14})`;
      c.lineWidth = 1.4;
      c.stroke();

      // 안쪽 아치
      c.beginPath();
      c.moveTo(left, bottom);
      c.lineTo(left, top + 34);
      c.quadraticCurveTo(left, top, exit.x, top);
      c.quadraticCurveTo(right, top, right, top + 34);
      c.lineTo(right, bottom);
      c.closePath();
      c.fillStyle = "#03080d";
      c.fill();
      c.clip();

      // 포털
      if (active) {
        const portal = c.createLinearGradient(0, top, 0, bottom);
        portal.addColorStop(0, `rgba(${data.rgb}, 0.08)`);
        portal.addColorStop(0.35, `rgba(${data.rgb}, ${arrived ? 0.58 : 0.25})`);
        portal.addColorStop(0.8, `rgba(${data.glowRgb}, ${arrived ? 0.42 : 0.16})`);
        portal.addColorStop(1, `rgba(${data.rgb}, 0.04)`);
        c.fillStyle = portal;
        c.fillRect(left, top, exit.w, exit.h);

        c.globalCompositeOperation = "lighter";
        for (let i = 0; i < 5; i++) {
          const p = ((t * 0.13 + i * 0.17) % 1);
          const y = bottom - p * (bottom - top - 24);
          const rx = 24 * (0.35 + p * 0.65);
          c.strokeStyle = `rgba(${data.rgb}, ${0.16 * (1 - p)})`;
          c.lineWidth = 1;
          c.beginPath();
          c.ellipse(exit.x, y, rx, 5, 0, 0, EG.TAU);
          c.stroke();
        }
        for (let i = 0; i < 12; i++) {
          const px = left + 9 + ((i * 37 + t * 16) % (exit.w - 18));
          const py = bottom - ((t * 32 + i * 23) % (exit.h - 10));
          c.fillStyle = `rgba(${data.rgb}, ${0.2 + ((i * 3) % 5) * 0.07})`;
          c.beginPath();
          c.arc(px, py, 1.2, 0, EG.TAU);
          c.fill();
        }
      } else {
        c.fillStyle = "rgba(5, 12, 17, 0.72)";
        c.fillRect(left, top, exit.w, exit.h);
      }
      c.restore();

      // 잠금 표식
      if (!active) {
        c.save();
        c.translate(exit.x, top + 61);
        c.strokeStyle = "rgba(130, 170, 183, 0.4)";
        c.fillStyle = "rgba(7, 16, 23, 0.7)";
        c.lineWidth = 1.5;
        EG.roundRect(c, -11, -2, 22, 18, 4);
        c.fill();
        c.stroke();
        c.beginPath();
        c.arc(0, -3, 7, Math.PI, 0);
        c.stroke();
        c.beginPath();
        c.arc(0, 7, 2.4, 0, EG.TAU);
        c.fillStyle = "rgba(142, 184, 196, 0.5)";
        c.fill();
        c.restore();
      }

      // 아치 테두리
      c.save();
      c.beginPath();
      c.moveTo(left, bottom);
      c.lineTo(left, top + 34);
      c.quadraticCurveTo(left, top, exit.x, top);
      c.quadraticCurveTo(right, top, right, top + 34);
      c.lineTo(right, bottom);
      c.strokeStyle = arrived
        ? `rgba(${data.rgb}, 0.9)`
        : `rgba(${data.rgb}, ${active ? 0.5 : 0.16})`;
      c.lineWidth = arrived ? 2.4 : 1.4;
      if (arrived) {
        c.shadowBlur = 14;
        c.shadowColor = data.color;
      }
      c.stroke();
      c.restore();

      // 상단 원형 문장
      c.save();
      c.translate(exit.x, top + 1);
      c.fillStyle = "rgba(8, 17, 23, 0.96)";
      c.strokeStyle = `rgba(${data.rgb}, ${active ? 0.72 : 0.2})`;
      c.lineWidth = 1.4;
      c.beginPath();
      c.arc(0, 0, 16, 0, EG.TAU);
      c.fill();
      c.stroke();
      EG.drawElementIcon(
        c,
        exit.element,
        0,
        0,
        9,
        active ? data.color : "rgba(105, 139, 150, 0.6)",
      );
      c.restore();

      // 출구 이름
      c.save();
      c.textAlign = "center";
      c.font = "600 11px 'Apple SD Gothic Neo', sans-serif";
      c.fillStyle = active ? data.color : "rgba(133, 168, 181, 0.5)";
      c.fillText(`${data.p1} · ${exit.label}`, exit.x, top - 21);
      c.font = "500 9px 'Apple SD Gothic Neo', sans-serif";
      c.fillStyle = active
        ? "rgba(226, 246, 252, 0.54)"
        : "rgba(140, 174, 186, 0.28)";
      c.fillText(active ? "PORTAL OPEN" : "SEALED", exit.x, top - 8);
      c.restore();

      // 도착 표시
      if (arrived) {
        const bob = Math.sin(t * 3.4) * 2;
        c.save();
        c.globalCompositeOperation = "lighter";
        c.fillStyle = "rgba(255, 248, 218, 0.9)";
        c.font = "700 12px 'Apple SD Gothic Neo', sans-serif";
        c.textAlign = "center";
        c.shadowBlur = 12;
        c.shadowColor = data.color;
        c.fillText("도착", exit.x, top - 40 + bob);
        c.restore();
      }
    }
  };

  // -------------------------------------------------------------------------
  // 월드 라벨 / 비네트
  // -------------------------------------------------------------------------
  EG.drawWorldLabels = function drawWorldLabels(c, game) {
    const t = game.time;

    for (const pool of EG.LEVEL.pools) {
      const data = C[pool.type];
      const other = pool.type === "water" ? "fire" : "water";
      const otherData = C[other];
      const cx = pool.x + pool.w / 2;
      const y = 486;

      c.save();
      EG.roundRect(c, cx - 108, y, 216, 41, 11);
      c.fillStyle = "rgba(5, 13, 21, 0.68)";
      c.fill();
      c.strokeStyle = `rgba(${data.rgb}, 0.26)`;
      c.lineWidth = 1;
      c.stroke();

      EG.drawElementIcon(c, pool.type, cx - 88, y + 13, 10, data.color);
      c.textAlign = "left";
      c.font = "700 12px 'Apple SD Gothic Neo', sans-serif";
      c.fillStyle = "rgba(227, 247, 253, 0.9)";
      c.fillText(`${pool.label} · ${data.p1} 성소`, cx - 73, y + 17);

      c.font = "600 9px 'Apple SD Gothic Neo', sans-serif";
      c.textAlign = "center";
      c.fillStyle = data.color;
      c.fillText(`${data.p1} 안전`, cx - 29, y + 33);
      c.fillStyle = "rgba(157, 187, 198, 0.5)";
      c.fillText("·", cx + 2, y + 33);
      c.fillStyle = otherData.color;
      c.fillText(`${otherData.p1} 치명`, cx + 37, y + 33);
      c.restore();

      // 성소 위치 안내
      const plate = pool.plate;
      const bob = Math.sin(t * 2.3 + (pool.type === "water" ? 0 : 1.7)) * 2;
      c.save();
      c.globalAlpha = 0.54;
      c.strokeStyle = `rgba(${data.rgb}, 0.42)`;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(plate.x, y + 42);
      c.lineTo(plate.x, y + 49 + bob);
      c.stroke();
      c.fillStyle = `rgba(${data.rgb}, 0.7)`;
      c.beginPath();
      c.moveTo(plate.x - 4, y + 48 + bob);
      c.lineTo(plate.x + 4, y + 48 + bob);
      c.lineTo(plate.x, y + 55 + bob);
      c.closePath();
      c.fill();
      c.restore();
    }
  };

  EG.drawScreenFlash = function drawScreenFlash(c) {
    if (!EG.fx.flash) return;
    c.save();
    c.globalAlpha = EG.clamp(EG.fx.flash.alpha, 0, 1);
    c.fillStyle = EG.fx.flash.color;
    c.fillRect(0, 0, EG.W, EG.H);
    c.restore();
  };

  EG.drawVignette = function drawVignette(c) {
    const vignette = c.createRadialGradient(
      EG.W / 2,
      EG.H / 2 - 10,
      260,
      EG.W / 2,
      EG.H / 2,
      790,
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(0.72, "rgba(1, 5, 9, 0.15)");
    vignette.addColorStop(1, "rgba(1, 4, 8, 0.64)");
    c.fillStyle = vignette;
    c.fillRect(0, 0, EG.W, EG.H);

    const topShade = c.createLinearGradient(0, 0, 0, 112);
    topShade.addColorStop(0, "rgba(2, 7, 12, 0.58)");
    topShade.addColorStop(1, "rgba(2, 7, 12, 0)");
    c.fillStyle = topShade;
    c.fillRect(0, 0, EG.W, 112);

    const bottomShade = c.createLinearGradient(0, EG.H - 96, 0, EG.H);
    bottomShade.addColorStop(0, "rgba(2, 6, 10, 0)");
    bottomShade.addColorStop(1, "rgba(2, 6, 10, 0.5)");
    c.fillStyle = bottomShade;
    c.fillRect(0, EG.H - 96, EG.W, 96);
  };
})();
