// ml5 handPose의 keypoints(비디오 픽셀 좌표)를 캔버스 좌표 + 콜라이더로 바꾼다.
// - 좌우 미러링은 "여기서만" 처리한다 (ml5 옵션 flipped은 쓰지 않음).
// - 손마다 One Euro Filter를 유지해서 떨림을 줄이고, 속도를 계산한다.

import { CONFIG } from "../config.js";
import { OneEuroFilter } from "../physics/oneEuroFilter.js";

const TIP_INDEX = [4, 8, 12, 16, 20];
const PALM_INDEX = [0, 5, 9, 13, 17];
// 검지/중지/약지/새끼의 MCP-PIP-DIP-TIP
const FINGER_CHAINS = [
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function smoothstep01(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** b에서 꺾인 각도의 코사인 (펴짐 1, 90도 0, 접힘 -1) */
function jointCos(a, b, c) {
  const v1x = b.x - a.x;
  const v1y = b.y - a.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const l1 = Math.hypot(v1x, v1y) || 1;
  const l2 = Math.hypot(v2x, v2y) || 1;
  return (v1x * v2x + v1y * v2y) / (l1 * l2);
}

function fingerCurl(points, chain, palmUnit) {
  const [mcp, pip, dip, tip] = chain;
  // 1) 손목에서 손끝까지의 거리 비율 (주먹이면 짧아진다)
  const tipRatio = dist(points[tip], points[0]) / palmUnit;
  const distCurl = clamp((1.95 - tipRatio) / 0.75, 0, 1);

  // 2) 관절이 접힌 각도
  const cos =
    0.5 * jointCos(points[mcp], points[pip], points[dip]) +
    0.5 * jointCos(points[pip], points[dip], points[tip]);
  const angleCurl = clamp((0.55 - cos) / 1.4, 0, 1);

  return clamp(distCurl * 0.55 + angleCurl * 0.45, 0, 1);
}

/** 손 21점에서 핀치/주먹/집기 위치를 계산한다. */
function detectGesture(points, palm, ch) {
  const palmUnit = Math.max(8, dist(points[0], points[9]));

  const pinchRatio = dist(points[4], points[8]) / palmUnit;
  const pinch = smoothstep01(
    (CONFIG.hand.pinchEnter - pinchRatio) /
      (CONFIG.hand.pinchEnter - CONFIG.hand.pinchFull)
  );

  const curls = FINGER_CHAINS.map((chain) => fingerCurl(points, chain, palmUnit));
  const curlAvg = curls.reduce((a, b) => a + b, 0) / curls.length;
  const fist = smoothstep01(
    (curlAvg - CONFIG.hand.fistEnter) / (CONFIG.hand.fistFull - CONFIG.hand.fistEnter)
  );

  const strength = Math.max(pinch, fist);
  const kind = pinch >= fist ? "pinch" : "fist";

  let gx;
  let gy;
  if (kind === "pinch") {
    gx = (points[4].x + points[8].x) / 2;
    gy = (points[4].y + points[8].y) / 2;
  } else {
    let sx = 0;
    let sy = 0;
    for (const i of TIP_INDEX) {
      sx += points[i].x;
      sy += points[i].y;
    }
    sx /= TIP_INDEX.length;
    sy /= TIP_INDEX.length;
    // 주먹은 손바닥과 손끝 사이를 움켜쥐는 느낌으로
    gx = sx * 0.45 + palm.x * 0.55;
    gy = sy * 0.45 + palm.y * 0.55;
  }

  return {
    pinch,
    fist,
    curl: curlAvg,
    extended: 1 - curlAvg,
    strength,
    kind,
    x: gx,
    y: gy,
    tipRadius: ch * CONFIG.hand.tipRadiusRatio,
  };
}

export class HandMapper {
  constructor() {
    this.tracks = [];
    this.nextId = 1;
    this.lastVideoWidth = CONFIG.camera.width;
    this.lastVideoHeight = CONFIG.camera.height;
  }

  reset() {
    this.tracks = [];
  }

  /**
   * @param {Array} hands ml5 결과 배열
   * @param {HTMLVideoElement} video
   * @param {HTMLCanvasElement} canvas
   * @param {number} now performance.now()
   */
  update(hands, video, canvas, now) {
    const cw = canvas.width;
    const ch = canvas.height;
    const vw = video?.videoWidth || this.lastVideoWidth;
    const vh = video?.videoHeight || this.lastVideoHeight;
    this.lastVideoWidth = vw;
    this.lastVideoHeight = vh;

    // 비디오와 캔버스의 비율이 달라도 손 크기가 왜곡되지 않도록 균일 스케일을 쓴다.
    const scale = ch / vh;
    const offsetX = (cw - vw * scale) / 2;

    const rawHands = [];
    for (const hand of hands || []) {
      const points = (hand.keypoints || []).map((kp) => ({
        x: offsetX + (vw - kp.x) * scale, // 미러링
        y: kp.y * scale,
      }));
      if (points.length < 21) continue;

      const confidence = hand.confidence ?? hand.score ?? 1;
      if (confidence < CONFIG.hand.minConfidence) continue;

      const palm = averagePoints(points, PALM_INDEX);
      const tips = TIP_INDEX.map((i) => ({ x: points[i].x, y: points[i].y }));

      rawHands.push({ points, palm, tips, confidence });
    }

    // 이전 트랙과 가장 가까운 손을 매칭해서 필터 상태를 이어간다.
    const usedTracks = new Set();
    const matched = [];

    for (const raw of rawHands) {
      let best = null;
      let bestDist = ch * 0.45;

      for (const track of this.tracks) {
        if (usedTracks.has(track.id)) continue;
        if (now - track.lastSeen > CONFIG.hand.staleMs) continue;
        const d = Math.hypot(raw.palm.x - track.rawPalm.x, raw.palm.y - track.rawPalm.y);
        if (d < bestDist) {
          bestDist = d;
          best = track;
        }
      }

      let track = best;
      if (!track) {
        track = createTrack(this.nextId++, now);
      }
      usedTracks.add(track.id);

      // 21개 점 각각을 X/Y 필터로 스무딩
      const smoothed = [];
      for (let i = 0; i < 21; i++) {
        const f = track.filters[i];
        smoothed.push({
          x: f.x.filter(raw.points[i].x, now),
          y: f.y.filter(raw.points[i].y, now),
        });
      }

      const dtSec = Math.max(1 / 120, (now - track.lastSeen) / 1000);
      const isNew = !best;
      const points = smoothed.map((p, i) => {
        const prev = track.lastPoints[i] ?? p;
        let vx = (p.x - prev.x) / dtSec;
        let vy = (p.y - prev.y) / dtSec;
        // 순간적인 튐으로 속도가 폭발하지 않게 제한
        vx = clamp(vx, -4000, 4000);
        vy = clamp(vy, -4000, 4000);
        return { x: p.x, y: p.y, vx, vy };
      });

      const palmPoint = averagePoints(points, PALM_INDEX);
      const tipRadius = ch * CONFIG.hand.tipRadiusRatio;
      const palmRadius = ch * CONFIG.hand.palmRadiusRatio;

      const tips = TIP_INDEX.map((i) => ({
        x: points[i].x,
        y: points[i].y,
        vx: points[i].vx,
        vy: points[i].vy,
        r: tipRadius,
      }));

      const gesture = detectGesture(points, palmPoint, ch);

      matched.push({
        id: track.id,
        confidence: raw.confidence,
        points, // 21개 스무딩된 점 (디버그/렌더용)
        tips,
        palm: { x: palmPoint.x, y: palmPoint.y, vx: palmPoint.vx, vy: palmPoint.vy, r: palmRadius },
        grab: gesture,
        speed: Math.max(
          Math.hypot(palmPoint.vx, palmPoint.vy),
          ...tips.map((t) => Math.hypot(t.vx, t.vy))
        ),
      });

      track.lastSeen = now;
      track.rawPalm = raw.palm;
      track.lastPoints = smoothed;
      if (isNew) track.createdAt = now;
    }

    // 오래된 트랙 정리
    this.tracks = this.tracks.filter(
      (t) => usedTracks.has(t.id) || now - t.lastSeen < CONFIG.hand.staleMs
    );

    // 나이 많은 순으로 정렬해서 id가 안정적으로 보이게
    matched.sort((a, b) => a.id - b.id);
    return matched;
  }
}

function createTrack(id, now) {
  const filters = [];
  for (let i = 0; i < 21; i++) {
    filters.push({
      x: new OneEuroFilter(CONFIG.filter),
      y: new OneEuroFilter(CONFIG.filter),
    });
  }
  return {
    id,
    filters,
    lastPoints: [],
    rawPalm: { x: 0, y: 0 },
    lastSeen: now,
    createdAt: now,
  };
}

function averagePoints(points, indices) {
  let x = 0;
  let y = 0;
  let vx = 0;
  let vy = 0;
  for (const i of indices) {
    x += points[i].x;
    y += points[i].y;
    vx += points[i].vx || 0;
    vy += points[i].vy || 0;
  }
  const n = indices.length;
  return { x: x / n, y: y / n, vx: vx / n, vy: vy / n };
}
