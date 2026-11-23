/**
 * 감지 결과를 캔버스에 그리는 역할만 담당합니다.
 * 좌표 변환(스케일/좌우 반전)도 여기서 처리합니다.
 */
const HANDEDNESS_LABELS = {
  Left: "왼손",
  Right: "오른손",
};

const HandDrawer = {
  showSkeleton: true,
  showLabels: false,

  drawHands(hands, connections) {
    if (!Array.isArray(hands)) return;

    for (const hand of hands) {
      if (!hand || !Array.isArray(hand.keypoints)) continue;
      if (this.showSkeleton) this.drawConnections(hand, connections);
      this.drawKeypoints(hand);
      if (this.showLabels) this.drawHandLabel(hand);
    }
  },

  /** 뼈대 연결선: [[0,1], [1,2], ...] 형태의 인덱스 쌍을 선으로 연결 */
  drawConnections(hand, connections) {
    const keypoints = hand.keypoints;
    stroke(...CONFIG.colors.connection, 140);
    strokeWeight(3);

    for (const [from, to] of connections) {
      const a = keypoints[from];
      const b = keypoints[to];
      if (!a || !b) continue;

      const p1 = this.toScreen(a);
      const p2 = this.toScreen(b);
      line(p1.x, p1.y, p2.x, p2.y);
    }
  },

  /** 21개 키포인트 점 그리기 */
  drawKeypoints(hand) {
    noStroke();
    fill(...CONFIG.colors.keypoint);

    for (const keypoint of hand.keypoints) {
      const point = this.toScreen(keypoint);
      circle(point.x, point.y, CONFIG.keypointRadius * 2);
    }
  },

  /** 손목(keypoint 0) 근처에 왼손/오른손 + 신뢰도 표시 */
  drawHandLabel(hand) {
    const wrist = hand.keypoints[0];
    if (!wrist) return;

    const point = this.toScreen(wrist);
    const label = this.handednessLabel(hand);
    const confidence = Math.round(this.handConfidence(hand) * 100);
    const value = `${label} ${confidence}%`;

    textSize(14);
    textAlign(LEFT, BOTTOM);
    const boxWidth = textWidth(value);

    noStroke();
    fill(0, 0, 0, 160);
    rect(point.x - 4, point.y - 30, boxWidth + 8, 22, 6);

    fill(255);
    text(value, point.x, point.y - 12);
  },

  /** 결과 배열을 패널 표시용 문자열로 변환합니다. */
  handednessLabel(hand) {
    const raw = hand?.handedness;
    return HANDEDNESS_LABELS[raw] || raw || "손";
  },

  handConfidence(hand) {
    if (typeof hand?.confidence === "number") return hand.confidence;
    if (typeof hand?.handednesses?.[0]?.confidence === "number") {
      return hand.handednesses[0].confidence;
    }
    return 0;
  },

  /** 원본 미디어 좌표 → 캔버스 좌표 (스케일 + 좌우 반전) */
  toScreen(keypoint) {
    const source = HandDetector.sourceSize;
    const scaleX = width / (source.width || width);
    const scaleY = height / (source.height || height);
    const x = keypoint.x * scaleX;

    return {
      x: CONFIG.mirror ? width - x : x,
      y: keypoint.y * scaleY,
    };
  },
};
