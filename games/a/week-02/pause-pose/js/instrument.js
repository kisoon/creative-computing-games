/**
 * 손동작 → 악기 제어 매핑.
 * - 손을 펴고 오므린 크기: 음량
 * - 위아래 위치: 음높이 (C 장조, 샵/플랫 없음)
 * - 좌우로 흔드는 움직임: 비브라토
 */
const Instrument = {
  active: false,
  octave: CONFIG.instrument.defaultOctave,
  volume: 0,
  frequency: 0,
  vibrato: 0,
  noteName: "—",
  pointer: { x: 0, y: 0 },
  openness: 0,

  _lastPoint: null,
  _lastTime: 0,

  /** 옥타브를 delta 만큼 올리거나 내립니다. */
  setOctave(delta) {
    const { minOctave, maxOctave } = CONFIG.instrument;
    this.octave = Math.min(maxOctave, Math.max(minOctave, this.octave + delta));
    AudioEngine.octave = this.octave;
    return this.octave;
  },

  /** 매 프레임 손 결과를 받아 음량·음높이·비브라토를 갱신합니다. */
  update(hands) {
    const hand = Array.isArray(hands) ? hands[0] : null;
    if (!hand || !Array.isArray(hand.keypoints)) {
      this.release();
      return;
    }

    const settings = CONFIG.instrument;
    const keypoints = hand.keypoints;
    const palm = this.palmCenter(keypoints);

    // 1) 음량: 손을 펼수록 커지고, 오므릴수록 작아집니다.
    const openness = this.opennessRatio(keypoints);
    this.openness = openness;

    const { closed, open } = settings.openness;
    const openT = Math.min(1, Math.max(0, (openness - closed) / (open - closed)));
    const targetVolume = Math.pow(openT, settings.volumeCurve) * settings.volumeMax;

    // 2) 음높이: 손바닥의 세로 위치 (위 = 높은 음). C 장조 음만 사용합니다.
    const yNorm = Math.min(1, Math.max(0, palm.y / height));
    const span = settings.pitchBottom - settings.pitchTop;
    const pitchT = 1 - Math.min(1, Math.max(0, (yNorm - settings.pitchTop) / span));
    const degree = Math.round(pitchT * (settings.scale.length - 1));
    const semitone = settings.scale[degree];

    const targetFrequency = AudioEngine.frequencyFor(this.octave, semitone);

    // 3) 비브라토: 좌우로 흔드는 속도가 빠를수록 떨림이 커집니다.
    const targetVibrato = this.computeVibrato(palm);
    const vibratoK = targetVibrato > this.vibrato ? 0.35 : 0.12;
    this.vibrato += (targetVibrato - this.vibrato) * vibratoK;

    // 값이 튀지 않도록 보간합니다.
    const k = settings.smoothing;
    this.volume += (targetVolume - this.volume) * k;
    this.frequency = this.frequency
      ? this.frequency + (targetFrequency - this.frequency) * k
      : targetFrequency;
    this.noteName = AudioEngine.noteNameFor(this.octave, semitone);
    this.pointer = { x: palm.x, y: palm.y };
    this.active = true;

    AudioEngine.setTargets(this.volume, this.frequency);
    AudioEngine.setVibrato(this.vibrato);
  },

  /** 손이 사라졌을 때: 소리/비브라토만 서서히 줄이고 마지막 음높이는 유지합니다. */
  release() {
    this.active = false;
    this.noteName = "—";
    this.openness = 0;
    this.volume += (0 - this.volume) * 0.2;
    this.vibrato += (0 - this.vibrato) * 0.2;
    this._lastPoint = null;

    AudioEngine.setTargets(this.volume, this.frequency || 261.63);
    AudioEngine.setVibrato(this.vibrato);
  },

  /** 손바닥 중심(손목 + 손가락 뿌리 4개)의 화면 좌표 */
  palmCenter(keypoints) {
    const indices = [0, 5, 9, 13, 17];
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (const index of indices) {
      const keypoint = keypoints[index];
      if (!keypoint) continue;
      const point = HandDrawer.toScreen(keypoint);
      sumX += point.x;
      sumY += point.y;
      count += 1;
    }

    if (count === 0) return { x: width / 2, y: height / 2 };
    return { x: sumX / count, y: sumY / count };
  },

  /**
   * 손의 펼침 정도를 손 크기로 나눠 계산합니다.
   * 손목~중지 뿌리 거리를 기준으로 삼아 손이 화면에서 멀어져도 값이 일정합니다.
   * 주먹 ≈ 1.0, 활짝 편 손 ≈ 2.0 이상.
   */
  opennessRatio(keypoints) {
    const wrist = keypoints[0];
    const palm = keypoints[9] || keypoints[5];
    if (!wrist || !palm) return 0;

    const palmSize = Math.hypot(palm.x - wrist.x, palm.y - wrist.y) || 1;
    const tips = [4, 8, 12, 16, 20].map((index) => keypoints[index]).filter(Boolean);
    if (tips.length === 0) return 0;

    const total = tips.reduce(
      (sum, tip) => sum + Math.hypot(tip.x - wrist.x, tip.y - wrist.y),
      0,
    );
    return total / tips.length / palmSize;
  },

  /** 좌우 속도(화면 폭/초)를 비브라토 깊이(센트)로 변환합니다. */
  computeVibrato(palm) {
    const now = millis();
    const dt = this._lastTime
      ? Math.min(0.2, Math.max(0.01, (now - this._lastTime) / 1000))
      : 0;

    let target = 0;
    if (this._lastPoint && dt > 0) {
      const speed = Math.abs(palm.x - this._lastPoint.x) / width / dt;
      const { threshold, sensitivity, maxCents } = CONFIG.instrument.vibrato;
      target = Math.min(maxCents, Math.max(0, (speed - threshold) * sensitivity));
    }

    this._lastPoint = palm;
    this._lastTime = now;
    return target;
  },

  /** 캔버스 위에 피치 가이드·손 크기 링·음이름을 표시합니다. */
  drawOverlay() {
    if (!this.active || !AudioEngine.playing) return;

    const { x, y } = this.pointer;
    const accent = CONFIG.colors.keypoint;

    // 음높이 기준선
    stroke(accent[0], accent[1], accent[2], 70);
    strokeWeight(1);
    line(0, y, width, y);

    // 손을 펼친 크기에 따라 커지는 링
    const ringSize = map(this.openness, 1.0, 2.3, 26, 86, true);
    noFill();
    stroke(accent[0], accent[1], accent[2], 110 + this.vibrato * 3);
    strokeWeight(2);
    circle(x, y, ringSize);

    noStroke();
    fill(accent[0], accent[1], accent[2]);
    circle(x, y, 5);

    // 음이름 배지
    const label = this.noteName;
    textSize(15);
    textAlign(CENTER, BOTTOM);
    const labelWidth = textWidth(label) + 18;

    noStroke();
    fill(0, 0, 0, 170);
    rect(x - labelWidth / 2, y - ringSize / 2 - 26, labelWidth, 24, 8);
    fill(255);
    text(label, x, y - ringSize / 2 - 8);
  },
};
