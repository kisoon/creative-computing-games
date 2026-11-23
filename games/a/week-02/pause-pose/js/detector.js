/**
 * ml5.handPose 모델을 감싸는 얇은 래퍼.
 * - 모델 로드 / 시작 / 정지 / 단일 프레임 감지를 한 곳에서 관리합니다.
 * - sketch.js 는 이 객체만 바라보면 됩니다.
 */
const HandDetector = {
  model: null,
  hands: [],
  isDetecting: false,
  connections: CONFIG.connections.slice(),
  sourceSize: { width: CONFIG.canvas.width, height: CONFIG.canvas.height },

  /** 모델을 로드하고, 연결 정보를 확보합니다. */
  async load() {
    const instance = ml5.handPose(CONFIG.handPose);

    // p5 1.x 에서는 인스턴스를 즉시 반환하고, 준비 완료는 instance.ready 로 알려 줍니다.
    // p5 2.x 에서는 Promise 자체를 반환합니다. 두 경우를 모두 처리합니다.
    this.model =
      instance && typeof instance.then === "function" ? await instance : instance;

    // 모델이 실제로 준비될 때까지 기다립니다.
    if (this.model && this.model.ready) {
      await this.model.ready;
    }

    if (typeof this.model.getConnections === "function") {
      const connections = this.model.getConnections();
      if (Array.isArray(connections) && connections.length > 0) {
        this.connections = connections;
      }
    }

    return this.model;
  },

  /**
   * 연속 감지를 시작합니다.
   * @param {HTMLVideoElement|p5.Element|p5.Image} media
   * @param {(hands: Array) => void} [onResults]
   */
  start(media, onResults) {
    if (!this.model || this.isDetecting) return;

    this.rememberSourceSize(media);

    // detectStart 는 웹캠/비디오에서 결과가 나올 때마다 콜백을 호출합니다.
    this.model.detectStart(media, (results) => {
      this.hands = results || [];
      if (typeof onResults === "function") onResults(this.hands);
    });

    this.isDetecting = true;
  },

  /** 연속 감지를 중지하고 마지막 결과를 비웁니다. */
  stop() {
    if (!this.model || !this.isDetecting) return;
    this.model.detectStop();
    this.isDetecting = false;
    this.hands = [];
  },

  /**
   * 한 프레임만 감지합니다(정지 이미지 처리 등).
   * @param {HTMLVideoElement|p5.Element|p5.Image} media
   * @returns {Promise<Array>} 감지된 손 배열
   */
  async detectOnce(media) {
    if (!this.model) return [];
    this.rememberSourceSize(media);
    const results = await this.model.detect(media);
    return results || [];
  },

  /** 좌표 변환에 필요한 원본 미디어 크기를 기억합니다. */
  rememberSourceSize(media) {
    const elt = media?.elt || media;
    const width = media?.width || elt?.videoWidth || CONFIG.canvas.width;
    const height = media?.height || elt?.videoHeight || CONFIG.canvas.height;
    this.sourceSize = { width, height };
  },
};
