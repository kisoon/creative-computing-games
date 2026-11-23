// One Euro Filter — 손 떨림을 줄이면서 빠른 움직임은 지연 없이 따라가는 스무딩 필터.
// 참고: Casiez et al., "1€ Filter" (CHI 2012)

export class OneEuroFilter {
  constructor({ minCutoff = 1, beta = 0, dCutoff = 1 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  static alpha(cutoff, dt) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(x, timestampMs) {
    if (this.tPrev === null) {
      this.tPrev = timestampMs;
      this.xPrev = x;
      return x;
    }

    const dt = (timestampMs - this.tPrev) / 1000;

    // 프레임이 크게 끊기면(탭 전환 등) 필터 상태를 리셋해서 튀지 않게 한다.
    if (dt <= 0 || dt > 0.25) {
      this.tPrev = timestampMs;
      this.xPrev = x;
      this.dxPrev = 0;
      return x;
    }

    const dx = (x - this.xPrev) / dt;
    const aD = OneEuroFilter.alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = OneEuroFilter.alpha(cutoff, dt);
    const xHat = a * x + (1 - a) * this.xPrev;

    this.xPrev = xHat;
    this.dxPrev = dxHat;
    this.tPrev = timestampMs;
    return xHat;
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }
}
