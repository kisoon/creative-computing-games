// ml5.handPose 래퍼.
// ml5는 자체 추론 루프를 돌리고 콜백으로 결과를 준다. 여기서는 "마지막 결과"만 보관한다.
//
// 중요: tf.js의 WebGPU 백엔드는 <video> 프레임에서 손을 0개로 반환하는 문제가 있다.
// 그래서 ① WebGL 백엔드를 우선 사용하고, ② 영상을 캔버스에 그린 뒤 그 캔버스로 추론한다.
// (백엔드가 무엇이든 캔버스 입력은 정상 동작한다)

import { CONFIG } from "../config.js";

export class HandTracker {
  constructor() {
    this.model = null;
    this.latest = [];
    this.lastAt = 0;
    this.running = false;
    this.callbacks = 0;
    this.lastError = null;
    this.video = null;
    this.frameRaf = 0;

    this.frameCanvas = document.createElement("canvas");
    this.frameCanvas.width = CONFIG.camera.width;
    this.frameCanvas.height = CONFIG.camera.height;
    this.frameCtx = this.frameCanvas.getContext("2d", { alpha: false });
  }

  async load(options = CONFIG.handPose) {
    const ml5 = window.ml5;
    if (!ml5 || typeof ml5.handPose !== "function") {
      throw new Error("ml5.js를 불러오지 못했어요. (vendor/ml5.min.js 확인)");
    }

    // WebGPU + <video> 조합의 인식 실패를 피하기 위해 WebGL을 우선 사용한다.
    try {
      if (typeof ml5.setBackend === "function") {
        await ml5.setBackend("webgl");
      }
    } catch (err) {
      console.warn("[말랑이] WebGL 백엔드 설정에 실패해 기본 백엔드로 진행합니다.", err);
    }

    // 모델 다운로드가 끝날 때까지 기다린다. 네트워크가 죽으면 90초 후 실패 처리.
    this.model = await Promise.race([
      ml5.handPose({
        maxHands: options.maxHands,
        modelType: options.modelType,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("손 인식 모델 로딩 시간 초과")), 90000)
      ),
    ]);
    return this.model;
  }

  start(video, onResult) {
    if (!this.model) throw new Error("모델이 아직 준비되지 않았어요.");
    if (this.running) this.stop();

    this.video = video;
    this.callbacks = 0;
    this.lastError = null;
    this.syncSize();
    this.drawFrame();

    this.model.detectStart(this.frameCanvas, (results) => {
      this.latest = Array.isArray(results) ? results : [];
      this.lastAt = performance.now();
      this.callbacks++;
      if (onResult) onResult(this.latest);
    });
    this.running = true;

    // 최신 카메라 프레임을 계속 캔버스에 복사한다.
    const pump = () => {
      if (!this.running) return;
      this.drawFrame();
      this.frameRaf = requestAnimationFrame(pump);
    };
    this.frameRaf = requestAnimationFrame(pump);
  }

  stop() {
    if (this.model && this.running) {
      this.model.detectStop();
    }
    this.running = false;
    if (this.frameRaf) {
      cancelAnimationFrame(this.frameRaf);
      this.frameRaf = 0;
    }
  }

  syncSize() {
    const v = this.video;
    if (!v) return;
    const w = v.videoWidth || CONFIG.camera.width;
    const h = v.videoHeight || CONFIG.camera.height;
    if (this.frameCanvas.width !== w || this.frameCanvas.height !== h) {
      this.frameCanvas.width = w;
      this.frameCanvas.height = h;
    }
  }

  drawFrame() {
    const v = this.video;
    if (!v || !this.frameCtx || v.readyState < 2 || !v.videoWidth) return;
    this.syncSize();
    try {
      this.frameCtx.drawImage(v, 0, 0, this.frameCanvas.width, this.frameCanvas.height);
    } catch (err) {
      this.lastError = err;
    }
  }

  /** 너무 오래된 결과는 버린다 (카메라가 멈췄을 때 손이 화면에 남아있는 것 방지) */
  getFresh(maxAgeMs = CONFIG.hand.staleMs) {
    if (!this.lastAt) return [];
    return performance.now() - this.lastAt < maxAgeMs ? this.latest : [];
  }

  getStatus() {
    return {
      callbacks: this.callbacks,
      hands: this.latest.length,
      ageMs: this.lastAt ? Math.round(performance.now() - this.lastAt) : null,
      backend: window.ml5?.tf?.getBackend?.() || "?",
      canvases: this.frameCanvas.width > 0,
      error: this.lastError ? String(this.lastError) : null,
    };
  }

  reset() {
    this.latest = [];
    this.lastAt = 0;
    this.callbacks = 0;
    this.lastError = null;
  }
}
