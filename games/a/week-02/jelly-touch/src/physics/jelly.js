// 말랑이의 소프트바디.
// 원형 외곽 정점 N개를 스프링으로 rest 위치에 붙여두고,
// 손가락/손바닥 콜라이더가 닿으면 밀어내서 찌그러뜨린다.
//
// 두 가지 손 동작을 구분한다.
//  - 찌르기(poke): 펴진 손끝/손바닥이 표면을 안쪽으로 민다.
//  - 집기(grab): 핀치(엄지+검지)나 주먹으로 표면 일부를 붙잡아 손을 따라 끌고 간다.
//    손을 멀리 당기면 표면이 손 쪽으로 길게 늘어나고, 놓으면 스프링으로 복원된다.

import { CONFIG } from "../config.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
}

export class Jelly {
  constructor(canvas) {
    this.canvas = canvas;
    this.deform = 0;
    this.lastContacts = new Map();
    this.contacts = new Map();
    this.grabs = new Map();
    this.build();
  }

  build() {
    this.cx = this.canvas.width / 2;
    this.cy = this.canvas.height * CONFIG.jelly.centerY;
    this.R = this.canvas.height * CONFIG.jelly.radiusRatio;

    const n = CONFIG.jelly.vertices;
    this.vertices = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rx = this.cx + Math.cos(a) * this.R;
      const ry = this.cy + Math.sin(a) * this.R;
      this.vertices.push({ a, rx, ry, x: rx, y: ry, vx: 0, vy: 0 });
    }
    this.lastContacts.clear();
    this.contacts.clear();
    this.grabs.clear();
  }

  /** 숨쉬는 느낌: rest 위치를 아주 살짝 키웠다 줄인다. */
  applyBreath(now) {
    const breath = 1 + 0.007 * Math.sin(now * 0.0016);
    for (const v of this.vertices) {
      v.rx = this.cx + Math.cos(v.a) * this.R * breath;
      v.ry = this.cy + Math.sin(v.a) * this.R * breath;
    }
  }

  /**
   * 집기 시작: 손 위치 주변의 표면 정점을 붙잡는다.
   * rest 좌표 기준 오프셋을 저장해서, 손을 움직이면 그 덩어리가 같이 따라온다.
   */
  beginGrab(hand, gx, gy, strength) {
    const kind = hand.grab?.kind === "pinch" ? "pinch" : "fist";
    const radiusRatio =
      kind === "pinch"
        ? CONFIG.jelly.pinchGrabRadiusRatio
        : CONFIG.jelly.fistGrabRadiusRatio;
    const radius = this.R * radiusRatio;

    const indices = [];
    const weights = [];
    const ox = [];
    const oy = [];

    for (let i = 0; i < this.vertices.length; i++) {
      const v = this.vertices[i];
      const d = Math.hypot(v.x - gx, v.y - gy);
      if (d > radius) continue;
      const w = Math.pow(1 - d / radius, 0.7);
      if (w < 0.04) continue;
      indices.push(i);
      weights.push(w);
      ox.push(v.rx - gx);
      oy.push(v.ry - gy);
    }

    // 손이 표면 바로 위에 있지 않아도 최소한 덩어리는 잡히게
    if (indices.length < 3) {
      const nearest = this.vertices
        .map((v, i) => ({ i, d: Math.hypot(v.x - gx, v.y - gy) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 8);
      indices.length = 0;
      weights.length = 0;
      ox.length = 0;
      oy.length = 0;
      for (const { i } of nearest) {
        const v = this.vertices[i];
        indices.push(i);
        weights.push(1);
        ox.push(v.rx - gx);
        oy.push(v.ry - gy);
      }
    }

    return {
      kind,
      indices,
      weights,
      ox,
      oy,
      x: gx,
      y: gy,
      // pinch는 좁게 오므리고, 주먹은 넓게 움켜쥔다
      compress: kind === "pinch" ? 0.26 : 0.68,
      strength: clamp(strength, 0, 1),
      stretch: 0,
      lastSeen: performance.now(),
    };
  }

  /**
   * @param {Array} hands HandMapper 결과
   * @returns {{contacts: Map<number, object>, starts: object[], ends: object[], deform: number}}
   */
  update(hands, dt, now) {
    const { spring, damping, maxDisplacementRatio, pullLimitRatio, grabFollow } = CONFIG.jelly;
    const verts = this.vertices;
    const n = verts.length;

    this.applyBreath(now);

    // 1) 스프링 적분 (semi-implicit Euler)
    for (const v of verts) {
      const ax = -spring * (v.x - v.rx) - damping * v.vx;
      const ay = -spring * (v.y - v.ry) - damping * v.vy;
      v.vx += ax * dt;
      v.vy += ay * dt;
      v.x += v.vx * dt;
      v.y += v.vy * dt;
    }

    // 2) 집기 상태 갱신 + 붙잡은 정점 당기기
    const grabDispX = new Float32Array(n);
    const grabDispY = new Float32Array(n);
    const grabWeight = new Float32Array(n);
    const maxPull = this.R * pullLimitRatio;

    const activeGrabIds = new Set();
    for (const hand of hands) {
      const strength = hand.grab?.strength || 0;
      const gx = hand.grab?.x ?? hand.palm.x;
      const gy = hand.grab?.y ?? hand.palm.y;
      const centerDist = Math.hypot(gx - this.cx, gy - this.cy);
      const near = centerDist < this.R * 2.0;

      let grab = this.grabs.get(hand.id);

      if (strength > CONFIG.jelly.grabMinStrength && near) {
        if (!grab) {
          grab = this.beginGrab(hand, gx, gy, strength);
          this.grabs.set(hand.id, grab);
        }
        activeGrabIds.add(hand.id);

        grab.x = gx;
        grab.y = gy;
        grab.strength += (strength - grab.strength) * Math.min(1, dt * 14);
        grab.lastSeen = now;

        const follow = clamp(grabFollow * (0.55 + 0.45 * grab.strength) * dt * 60, 0, 1);
        let stretch = 0;

        for (let k = 0; k < grab.indices.length; k++) {
          const i = grab.indices[k];
          const v = verts[i];
          const w = grab.weights[k];

          // 손 위치 + 처음 잡은 모양 오프셋(오므린 비율) = 목표 위치
          let tx = grab.x + grab.ox[k] * grab.compress;
          let ty = grab.y + grab.oy[k] * grab.compress;

          // 너무 멀리 당기면 늘어나는 한계를 둔다 (고무줄처럼)
          const rdx = tx - v.rx;
          const rdy = ty - v.ry;
          const rd = Math.hypot(rdx, rdy);
          if (rd > maxPull) {
            const s = maxPull / rd;
            tx = v.rx + rdx * s;
            ty = v.ry + rdy * s;
          }

          // 표면이 손을 따라오게 (가장자리는 부드럽게)
          const k2 = w * follow;
          v.x += (tx - v.x) * k2;
          v.y += (ty - v.y) * k2;

          grabDispX[i] = tx - v.rx;
          grabDispY[i] = ty - v.ry;
          grabWeight[i] = w;

          const d = Math.hypot(grabDispX[i], grabDispY[i]);
          if (d > stretch) stretch = d;
        }
        grab.stretch = stretch;
      }
    }

    // 손을 놓았거나 사라진 집기는 해제
    for (const id of [...this.grabs.keys()]) {
      if (!activeGrabIds.has(id)) this.grabs.delete(id);
    }

    // 3) 찌르기 충돌 (집고 있는 손은 충돌 대신 당기기를 적용했으므로 건너뛴다)
    const contacts = new Map();
    const speeds = new Map();

    for (const hand of hands) {
      if (activeGrabIds.has(hand.id)) {
        speeds.set(hand.id, hand.speed || 0);
        continue;
      }

      const colliders = [hand.palm, ...hand.tips];
      speeds.set(hand.id, hand.speed || 0);

      for (let ci = 0; ci < colliders.length; ci++) {
        const c = colliders[ci];
        const isPalm = ci === 0;
        let sumX = 0;
        let sumY = 0;
        let count = 0;
        let maxPen = 0;
        const r = c.r;
        const r2 = r * r;

        for (const v of verts) {
          const dx = v.x - c.x;
          const dy = v.y - c.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;

          const d = Math.sqrt(d2);
          const pen = r - d;

          // 손가락이 말랑이를 누르면 표면이 안쪽으로 들어간다.
          // (콜라이더 밖으로 밀면 볼록 튀어나와서 "누른 느낌"이 안 난다)
          const ix = this.cx - v.x;
          const iy = this.cy - v.y;
          const il = Math.hypot(ix, iy);
          if (il > 1) {
            const inx = ix / il;
            const iny = iy / il;

            // 빠르게 찌르면 더 깊이 들어가고, 손바닥은 조금 약하게
            const inwardSpeed = c.vx * inx + c.vy * iny;
            const boost = clamp(inwardSpeed / 2600, 0, 0.3);
            const base = isPalm ? 0.5 : 0.72;
            const push = pen * (base + boost);

            v.x += inx * push;
            v.y += iny * push;

            // 바깥으로 튀어나가려는 속도만 제거
            const vn = v.vx * inx + v.vy * iny;
            if (vn < 0) {
              v.vx -= vn * inx;
              v.vy -= vn * iny;
            }
          }

          if (pen > maxPen) maxPen = pen;
          sumX += v.x;
          sumY += v.y;
          count++;
        }

        if (count === 0) continue;

        let contact = contacts.get(hand.id);
        if (!contact) {
          contact = {
            handId: hand.id,
            count: 0,
            x: 0,
            y: 0,
            maxPen: 0,
            speed: hand.speed || 0,
            kind: "poke",
          };
          contacts.set(hand.id, contact);
        }
        contact.count += count;
        contact.x += sumX;
        contact.y += sumY;
        contact.maxPen = Math.max(contact.maxPen, maxPen);
      }
    }

    // 집고 있는 손도 접촉으로 취급해서 소리/표정이 반응하게 한다.
    for (const [id, grab] of this.grabs) {
      if (!activeGrabIds.has(id)) continue;
      const contact = {
        handId: id,
        count: grab.indices.length,
        x: grab.x,
        y: grab.y,
        maxPen: grab.stretch,
        speed: speeds.get(id) || 0,
        kind: "grab",
        grabKind: grab.kind,
        strength: grab.strength,
      };
      contacts.set(id, contact);
    }

    // 평균 접촉점/깊이 계산
    for (const contact of contacts.values()) {
      if (contact.kind === "grab") {
        contact.depth = clamp(
          contact.strength * 0.45 + contact.maxPen / (this.R * 0.9),
          0,
          1
        );
      } else {
        contact.x /= Math.max(1, contact.count);
        contact.y /= Math.max(1, contact.count);
        contact.depth = clamp(contact.maxPen / (this.R * 0.2), 0, 1);
      }
      contact.speed = speeds.get(contact.handId) || 0;
      contact.missing = 0;
    }
    this.contacts = contacts;

    // 4) 변위 스무딩 (찌그러진 모양이 뾰족해지지 않게)
    const dispX = new Float32Array(n);
    const dispY = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      dispX[i] = verts[i].x - verts[i].rx;
      dispY[i] = verts[i].y - verts[i].ry;
    }

    const smoothX = new Float32Array(n);
    const smoothY = new Float32Array(n);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        const prev = (i + n - 1) % n;
        const next = (i + 1) % n;
        const ax = (dispX[prev] + 2 * dispX[i] + dispX[next]) / 4;
        const ay = (dispY[prev] + 2 * dispY[i] + dispY[next]) / 4;
        smoothX[i] = dispX[i] * 0.55 + ax * 0.45;
        smoothY[i] = dispY[i] * 0.55 + ay * 0.45;
      }
      dispX.set(smoothX);
      dispY.set(smoothY);
    }

    // 5) 체적 보존(간이): 많이 찌그러지면 변위를 살짝 바깥으로
    const targetArea = Math.PI * this.R * this.R;
    const area = Math.abs(polygonArea(verts));
    let volumeScale = 1;
    if (area > 1 && area < targetArea) {
      volumeScale = clamp(Math.sqrt(targetArea / area), 1, 1.1);
    }

    const maxDisp = this.R * maxDisplacementRatio;
    let peak = 0;

    for (let i = 0; i < n; i++) {
      let dx = smoothX[i] * volumeScale;
      let dy = smoothY[i] * volumeScale;

      // 붙잡힌 정점은 스무딩에 먹히지 않게 손 위치를 다시 우선 적용한다.
      if (grabWeight[i] > 0) {
        const gw = Math.min(1, grabWeight[i]);
        dx = dx * (1 - gw) + grabDispX[i] * gw;
        dy = dy * (1 - gw) + grabDispY[i] * gw;
      }

      const len = Math.hypot(dx, dy);
      if (len > maxDisp) {
        const k = maxDisp / len;
        dx *= k;
        dy *= k;
      }

      verts[i].x = verts[i].rx + dx;
      verts[i].y = verts[i].ry + dy;

      const disp = Math.hypot(dx, dy);
      if (disp > peak) peak = disp;
    }

    // deform: 0~1 (사운드/표정 강도)
    const targetDeform = clamp(peak / (this.R * 0.4), 0, 1);
    const lerp = Math.min(1, dt * 16);
    this.deform += (targetDeform - this.deform) * lerp;

    // 6) 시작/종료 이벤트 (3프레임 유예)
    const known = new Set(this.lastContacts.keys());
    const starts = [];
    const ends = [];

    for (const contact of contacts.values()) {
      if (!known.has(contact.handId)) starts.push(contact);
    }

    for (const [id, prev] of [...this.lastContacts]) {
      if (!contacts.has(id)) {
        const missing = (prev.missing || 0) + 1;
        if (missing > 3) {
          ends.push(prev);
          this.lastContacts.delete(id);
        } else {
          this.lastContacts.set(id, { ...prev, missing });
        }
      }
    }

    for (const [id, contact] of contacts) {
      this.lastContacts.set(id, contact);
    }

    return { contacts, starts, ends, deform: this.deform };
  }

  getBounds() {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const v of this.vertices) {
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
    }
    return { minX, minY, maxX, maxY };
  }
}

function polygonArea(verts) {
  let area = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}
