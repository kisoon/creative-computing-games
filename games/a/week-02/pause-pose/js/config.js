/**
 * 전역 설정값 모음.
 * 튜닝 포인트를 한 곳에 모아 두면 이후 기능을 붙이기 쉽습니다.
 */
const CONFIG = {
  // 캔버스(=웹캠) 해상도. 웹캠에서 흔히 쓰는 4:3 비율입니다.
  canvas: {
    width: 640,
    height: 480,
  },

  // ml5.handPose(options) 에 그대로 전달되는 모델 옵션.
  // 문서: maxHands, flipped, runtime("tfjs" | "mediapipe"), modelType("lite" | "full")
  handPose: {
    maxHands: 2,
    flipped: false, // 결과 좌표 반전은 화면에서만 처리합니다(mirror 옵션 참고)
    runtime: "tfjs",
    modelType: "full",
  },

  // 웹캠 화면을 거울처럼 좌우 반전해서 보여 줄지 여부.
  // 켜면 키포인트도 같은 기준으로 뒤집어 그립니다.
  mirror: true,

  keypointRadius: 6,

  // 손 위치로 연주하는 악기 설정
  instrument: {
    defaultOctave: 4,
    minOctave: 2,
    maxOctave: 6,

    // C 장조 음계만 사용합니다. 샵/플랫(반음) 없이 흰 건반 음만 나옵니다.
    scale: [0, 2, 4, 5, 7, 9, 11, 12],

    pitchTop: 0.1, // 캔버스 위쪽 10% 지점 = 최고음
    pitchBottom: 0.9, // 아래쪽 90% 지점 = 최저음

    // 손을 오므린 정도 → 음량
    // (손목~중지 뿌리 길이로 나눈 손끝 평균 거리)
    openness: {
      closed: 1.05, // 이 값 이하 = 완전히 오므림 (무음)
      open: 2.15, // 이 값 이상 = 활짝 펼침 (최대 음량)
    },
    volumeCurve: 1.15, // 크기 → 음량 곡선
    volumeMax: 0.28, // 최대 출력 (클리핑 방지)

    // 좌우로 흔드는 움직임 → 비브라토
    vibrato: {
      rate: 5.4, // 떨림 속도 (Hz)
      maxCents: 32, // 최대 떨림 폭 (센트)
      sensitivity: 42, // 좌우 속도 → 떨림 폭
      threshold: 0.3, // 이 속도(화면 폭/초) 이하는 무시
    },

    smoothing: 0.18, // 손 움직임을 따라가는 부드러움 (0~1)
  },

  colors: {
    background: [12, 12, 14],
    keypoint: [0, 230, 118],
    connection: [255, 255, 255],
  },

  // 손가락 21개 키포인트의 기본 연결 정보.
  // handPose.getConnections() 를 사용할 수 없을 때의 대체값입니다.
  connections: [
    [0, 1], [1, 2], [2, 3], [3, 4],           // 엄지
    [0, 5], [5, 6], [6, 7], [7, 8],           // 검지
    [5, 9], [9, 10], [10, 11], [11, 12],      // 중지
    [9, 13], [13, 14], [14, 15], [15, 16],    // 약지
    [13, 17], [17, 18], [18, 19], [19, 20],   // 새끼
    [0, 17],                                  // 손바닥 아래쪽
  ],
};
