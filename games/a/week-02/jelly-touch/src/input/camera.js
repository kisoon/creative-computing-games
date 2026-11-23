// 카메라 스트림 관리. 영상은 화면에 그리지 않고(입력 전용) 숨겨둔 <video>로만 쓴다.

import { CONFIG } from "../config.js";

export class Camera {
  constructor() {
    this.video = document.createElement("video");
    this.video.className = "source-video";
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.autoplay = true;
    this.video.setAttribute("aria-hidden", "true");
    document.body.appendChild(this.video);
    this.stream = null;
  }

  get active() {
    return !!this.stream && this.stream.active;
  }

  async start(options = CONFIG.camera) {
    this.stop();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: { ideal: options.width },
        height: { ideal: options.height },
        frameRate: { ideal: 30, max: 60 },
        facingMode: "user",
      },
    });

    this.stream = stream;
    this.video.srcObject = stream;
    await this.video.play();
    await waitForVideo(this.video);
    return this.video;
  }

  stop() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    if (this.video.srcObject) {
      this.video.srcObject = null;
    }
  }
}

function waitForVideo(video) {
  return new Promise((resolve) => {
    if (video.readyState >= 2 && video.videoWidth > 0) {
      resolve();
      return;
    }
    const done = () => {
      if (video.videoWidth > 0) {
        cleanup();
        resolve();
      }
    };
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", done);
      video.removeEventListener("playing", done);
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, 5000);
    video.addEventListener("loadedmetadata", done);
    video.addEventListener("playing", done);
  });
}
