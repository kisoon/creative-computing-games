import { CONFIG } from './config.js';
import { angleDeg, clamp, dist, lerp, norm } from './util.js';

// MediaPipe Hands 21 keypoints 순서 (ml5도 동일)
export const KP = {
  wrist: 0,
  thumb_cmc: 1, thumb_mcp: 2, thumb_ip: 3, thumb_tip: 4,
  index_mcp: 5, index_pip: 6, index_dip: 7, index_tip: 8,
  middle_mcp: 9, middle_pip: 10, middle_dip: 11, middle_tip: 12,
  ring_mcp: 13, ring_pip: 14, ring_dip: 15, ring_tip: 16,
  pinky_mcp: 17, pinky_pip: 18, pinky_dip: 19, pinky_tip: 20,
};

// 굽힘도: 폈을 때 0, 접었을 때 1 (손 크기/회전에 불변)
function curlOf(k, a, b, c, d) {
  const L = dist(k[a], k[b]) + dist(k[b], k[c]) + dist(k[c], k[d]) + 1e-6;
  return clamp(1 - dist(k[a], k[d]) / L, 0, 1);
}

export class HandFeatures {
  constructor() {
    this.mapping = { scale: 1, ox: 0, oy: 0, w: 960 };
    this.reset();
  }

  reset() {
    this.prev = null;
    this.t = 0;
    this.palmHist = [];
    this.aim = { x: 0, y: -1 };
    this.aimLocked = false;
    this.ext = { thumb: false, index: false, middle: false, ring: false, pinky: false };
    this.isFist = false;
    this.isOpen = false;
    this.openness = 1;
    this.maxTip = 1;
    this.kps = null;
    this.thumbAngle = 0;
    this.speedN = 0;
    this.dir = { x: 0, y: -1 };
    this.palm = { x: 0, y: 0 };
    this.handSize = 100;
    this.curls = { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 };
  }

  setMapping(m) { this.mapping = m; }

  // raw: ml5 keypoints (비디오 픽셀 좌표) / dt: 직전 감지와의 시간차(초)
  update(raw, dt) {
    if (!raw || raw.length < 21) return null;

    const m = this.mapping;
    const a = CONFIG.smoothAlpha;

    // 비디오 좌표 -> 캔버스 좌표 (미러링 포함)
    const k = raw.map((kp) => ({
      x: m.w - (kp.x * m.scale + m.ox),
      y: kp.y * m.scale + m.oy,
      z: kp.z || 0,
    }));

    if (!this.prev) this.prev = k.map((v) => ({ ...v }));
    const sm = k.map((v, i) => ({
      x: lerp(this.prev[i].x, v.x, a),
      y: lerp(this.prev[i].y, v.y, a),
      z: lerp(this.prev[i].z, v.z, a),
    }));
    this.prev = sm;
    this.kps = sm;
    this.t += dt;

    const wrist = sm[KP.wrist];
    const handSize = Math.max(dist(wrist, sm[KP.middle_mcp]), 1);

    const curls = {
      thumb: curlOf(sm, KP.thumb_cmc, KP.thumb_mcp, KP.thumb_ip, KP.thumb_tip),
      index: curlOf(sm, KP.index_mcp, KP.index_pip, KP.index_dip, KP.index_tip),
      middle: curlOf(sm, KP.middle_mcp, KP.middle_pip, KP.middle_dip, KP.middle_tip),
      ring: curlOf(sm, KP.ring_mcp, KP.ring_pip, KP.ring_dip, KP.ring_tip),
      pinky: curlOf(sm, KP.pinky_mcp, KP.pinky_pip, KP.pinky_dip, KP.pinky_tip),
    };

    // 엄지는 curl 대신 벌어진 각도로 판정 (권총 자세 vs 주먹 구분)
    const thumbAngle = angleDeg(sm[KP.thumb_tip], sm[KP.thumb_mcp], sm[KP.index_mcp]);
    const th = CONFIG.thumbOpenDeg;
    const hy = CONFIG.thumbHysteresisDeg;
    const ext = {};
    ext.thumb = this.ext.thumb ? thumbAngle > th - hy : thumbAngle > th + hy;

    const fe = (name) => (this.ext[name] ? curls[name] < CONFIG.curlCurl : curls[name] < CONFIG.extendCurl);
    ext.index = fe('index');
    ext.middle = fe('middle');
    ext.ring = fe('ring');
    ext.pinky = fe('pinky');

    // 손바닥 중심
    const palm = { x: 0, y: 0 };
    for (const i of [0, 5, 9, 13, 17]) { palm.x += sm[i].x; palm.y += sm[i].y; }
    palm.x /= 5; palm.y /= 5;

    // 손 벌어짐: 손끝이 손바닥에서 얼마나 먼가 (손 크기로 정규화)
    //   maxTip = 가장 먼 손끝 → 주먹 판정 (권총 자세와 확실히 구분됨)
    //   openness = 5개 평균   → 방어막 판정
    let tipSum = 0;
    let maxTip = 0;
    for (const t of [KP.thumb_tip, KP.index_tip, KP.middle_tip, KP.ring_tip, KP.pinky_tip]) {
      const r = dist(sm[t], palm) / handSize;
      tipSum += r;
      if (r > maxTip) maxTip = r;
    }
    const openness = tipSum / 5;

    const fh = CONFIG.fistHysteresis;
    this.isFist = this.isFist
      ? maxTip < CONFIG.fistMaxTip + fh
      : maxTip < CONFIG.fistMaxTip;

    const oh = CONFIG.opennessHysteresis;
    this.isOpen = this.isOpen
      ? openness > CONFIG.openOpenness - oh
      : openness > CONFIG.openOpenness;

    this.openness = openness;
    this.maxTip = maxTip;

    // 손가락이 가리키는 방향 (조준 초기값)
    const pointDir = norm({ x: sm[KP.index_tip].x - wrist.x, y: sm[KP.index_tip].y - wrist.y });

    // 손 이동 속도 (3프레임 차분, 손 크기로 정규화)
    this.palmHist.push({ x: palm.x, y: palm.y, t: this.t });
    while (this.palmHist.length > 8) this.palmHist.shift();

    let speedN = 0;
    let dir = this.dir;
    const n = this.palmHist.length;
    if (n >= 4) {
      const p0 = this.palmHist[n - 4];
      const p1 = this.palmHist[n - 1];
      const dtp = Math.max(p1.t - p0.t, 1 / 120);
      const vx = (p1.x - p0.x) / dtp;
      const vy = (p1.y - p0.y) / dtp;
      speedN = Math.hypot(vx, vy) / handSize;
      if (Math.hypot(vx, vy) > 1) dir = norm({ x: vx, y: vy });
    }

    // 조준: 움직이는 동안만 갱신, 멈추면 마지막 방향 유지
    if (speedN > CONFIG.aimMinSpeed) {
      const s = CONFIG.aimSmooth;
      this.aim = norm({ x: lerp(this.aim.x, dir.x, s), y: lerp(this.aim.y, dir.y, s) });
      this.aimLocked = true;
    } else if (!this.aimLocked) {
      this.aim = pointDir;
    }

    this.ext = ext;
    this.thumbAngle = thumbAngle;
    this.curls = curls;
    this.speedN = speedN;
    this.dir = dir;
    this.palm = palm;
    this.handSize = handSize;

    return {
      hasHand: true,
      kps: sm,
      palm,
      handSize,
      curls,
      thumbAngle,
      ext,
      openness,
      maxTip,
      isFist: this.isFist,
      isOpen: this.isOpen,
      speedN,
      dir,
      aim: this.aim,
      pointDir,
    };
  }
}

// 웹캠 없이 마우스로 테스트하는 가짜 손
export class SimHand {
  constructor() { this.reset(); }

  reset() {
    this.t = 0;
    this.hist = [];
    this.aim = { x: 0, y: -1 };
    this.aimLocked = false;
  }

  update(x, y, pose, dt) {
    this.t += dt;
    const handSize = 120;
    this.hist.push({ x, y, t: this.t });
    while (this.hist.length > 8) this.hist.shift();

    let speedN = 0;
    let dir = { x: 0, y: -1 };
    const n = this.hist.length;
    if (n >= 4) {
      const p0 = this.hist[n - 4];
      const p1 = this.hist[n - 1];
      const dtp = Math.max(p1.t - p0.t, 1 / 120);
      const vx = (p1.x - p0.x) / dtp;
      const vy = (p1.y - p0.y) / dtp;
      speedN = Math.hypot(vx, vy) / handSize;
      if (Math.hypot(vx, vy) > 1) dir = norm({ x: vx, y: vy });
    }

    if (speedN > CONFIG.aimMinSpeed) {
      this.aim = norm({
        x: lerp(this.aim.x, dir.x, CONFIG.aimSmooth),
        y: lerp(this.aim.y, dir.y, CONFIG.aimSmooth),
      });
      this.aimLocked = true;
    } else if (!this.aimLocked) {
      this.aim = { x: 0, y: -1 };
    }

    return {
      hasHand: true,
      kps: null,
      palm: { x, y },
      handSize,
      curls: { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 },
      thumbAngle: pose.ext.thumb ? 90 : 15,
      ext: pose.ext,
      openness: pose.openness,
      maxTip: pose.maxTip ?? 0,
      isFist: !!pose.isFist,
      isOpen: !!pose.isOpen,
      speedN,
      dir,
      aim: this.aim,
      pointDir: { x: 0, y: -1 },
    };
  }
}
