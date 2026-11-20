/* =========================================================================
   level.js — 한 장면짜리 고정 스테이지 데이터
   ========================================================================= */
(() => {
  "use strict";

  const EG = window.EG;
  const FLOOR_Y = EG.FLOOR_Y;

  EG.LEVEL = {
    name: "쌍둥이 성소",
    subtitle: "TWIN SHRINES",

    solids: [
      { x: 0, y: FLOOR_Y, w: EG.W, h: EG.H - FLOOR_Y },
      { x: 0, y: 0, w: 14, h: FLOOR_Y },
      { x: EG.W - 14, y: 0, w: 14, h: FLOOR_Y },
    ],

    pools: [
      {
        type: "water",
        x: 258,
        y: 618,
        w: 182,
        h: 22,
        label: "물 웅덩이",
        plate: {
          id: "water",
          element: "water",
          x: 349,
          y: FLOOR_Y,
        },
      },
      {
        type: "fire",
        x: 568,
        y: 618,
        w: 172,
        h: 22,
        label: "불 웅덩이",
        plate: {
          id: "fire",
          element: "fire",
          x: 654,
          y: FLOOR_Y,
        },
      },
    ],

    gate: {
      x: 886,
      y: 210,
      w: 68,
      h: 430,
      block: { x: 886, y: 210, w: 68, h: 430 },
    },

    exits: [
      {
        element: "water",
        label: "물의 출구",
        x: 1064,
        y: 514,
        w: 74,
        h: 126,
      },
      {
        element: "fire",
        label: "불의 출구",
        x: 1190,
        y: 514,
        w: 74,
        h: 126,
      },
    ],

    spawns: {
      water: { x: 104, y: FLOOR_Y },
      fire: { x: 176, y: FLOOR_Y },
    },

    conduitY: [655, 670],
  };

  EG.LEVEL.plateList = EG.LEVEL.pools.map((pool) => pool.plate);
})();
