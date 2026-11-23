// 모든 튜닝 값은 여기 한 곳에 모읍니다.
export const CONFIG = {
  // --- 좌표 스무딩 ---
  smoothAlpha: 0.5,

  // --- 손가락 펴짐/접힘 판정 (히스테리시스) ---
  extendCurl: 0.32,
  curlCurl: 0.62,
  thumbOpenDeg: 50,      // 엄지 확장 각도 임계값 (불꽃 자세 전용)
  thumbHysteresisDeg: 8,

  // --- 손 벌어짐 판정 ---
  // maxTip = (손바닥에서 가장 먼 손끝 거리) / handSize
  //   주먹 ≈ 0.5~0.7 / 권총자세 ≈ 1.2~1.5 / 활짝 편 손 ≈ 1.6~2.0
  //   → 주먹은 maxTip 하나로 판정하면 권총 자세와 확실히 갈린다
  fistMaxTip: 0.95,        // 이보다 작으면 주먹 (발사)
  fistHysteresis: 0.12,
  // openness = 손끝 5개의 평균 거리 / handSize  (방어막 판정)
  //   주먹 ≈ 0.4 / 권총자세 ≈ 0.8 / 활짝 편 손 ≈ 1.4
  openOpenness: 1.15,
  opennessHysteresis: 0.08,

  // --- 제스처 안정화 (ms) ---
  fireHoldMs: 200,       // 불꽃 자세 유지 시간
  shieldHoldMs: 250,     // 방어막 자세 유지 시간
  fistHoldMs: 120,       // 주먹 유지 시간 (순간 오인 방지)
  releaseMs: 150,        // 자세 해제 판정 시간
  launchMs: 250,         // 발사 후 잠금 시간

  // --- 불꽃 ---
  fireChargeRate: 0.9,   // 초당 충전량
  chargeMin: 0.25,       // 이 이하로는 발사 불가
  orbLifeMs: 2500,       // 자세를 풀어도 오브가 남는 시간

  // --- 조준 ---
  aimMinSpeed: 1.2,      // 이 속도 이상일 때만 조준 갱신 (handSize/초)
  aimSmooth: 0.3,

  // --- 발사 ---
  fireballSpeedMin: 750, // px/초
  fireballSpeedMax: 1600,

  // --- 방어막 ---
  shieldFollowK: 14,     // 클수록 손을 빨리 따라옴
  shieldRadiusHand: 1.5, // 손 크기 대비 반지름
  shieldMinRadius: 70,
  shieldFaceSmooth: 0.18,

  debug: true,
};
