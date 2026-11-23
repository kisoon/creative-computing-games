// 게임 전체에서 쓰는 튜닝 상수. 감각을 조절할 때는 여기만 건드리면 된다.

export const CONFIG = {
  // 캔버스 내부 해상도 (CSS로 화면에 맞게 줄여 그린다)
  canvas: { width: 1280, height: 720 },

  // 카메라 요청 해상도
  camera: { width: 640, height: 480 },

  // ml5.handPose 옵션
  // flipped(거울 모드)는 ml5에 맡기지 않고 landmarks.js에서 직접 처리한다.
  // ml5 런타임에 따라 flip 동작이 달라질 수 있어서 한 곳에서만 뒤집는 편이 안전하다.
  handPose: { maxHands: 2, modelType: "lite" },

  hand: {
    minConfidence: 0.3,
    staleMs: 420, // 이 시간보다 오래된 인식 결과는 버린다
    tipRadiusRatio: 0.028, // 캔버스 높이 대비 손끝 콜라이더 반경
    palmRadiusRatio: 0.07, // 캔버스 높이 대비 손바닥 콜라이더 반경
    // 제스처 판정 (0~1 비율)
    pinchEnter: 0.78, // 손가락 사이 거리/손 크기 가 이 값보다 작아지면 핀치 시작
    pinchFull: 0.3, // 이 값 이하이면 완전한 핀치
    fistEnter: 0.46, // 손가락 말림 정도가 이 값보다 크면 주먹 시작
    fistFull: 0.8, // 이 값 이상이면 완전한 주먹
  },

  filter: { minCutoff: 1.4, beta: 0.02, dCutoff: 1.0 },

  jelly: {
    centerY: 0.55,
    radiusRatio: 0.225,
    vertices: 96,
    spring: 900,
    damping: 18,
    maxDisplacementRatio: 0.62,
    // 집어서 당길 때
    grabMinStrength: 0.32, // 이 이상이면 집기 시작
    grabFollow: 0.85, // 손을 따라오는 정도 (1에 가까울수록 즉각적)
    pinchGrabRadiusRatio: 0.34, // 핀치로 잡는 표면 반경 (R 대비)
    fistGrabRadiusRatio: 0.62, // 주먹으로 잡는 표면 반경
    pullLimitRatio: 0.95, // 최대 늘어나는 거리 (R 대비)
  },

  audio: {
    masterGain: 0.9,
    cooldownMs: 110,
    maxVoices: 3,
  },
};
