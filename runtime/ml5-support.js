/* Keep the original model weights and inference options; serve TF Hub files locally. */
(() => {
  'use strict';
  const base = new URL('../vendor/models/', document.currentScript.src);
  const paths = [
    'mediapipe/tfjs-model/handpose_3d/detector/full/1/',
    'mediapipe/tfjs-model/handpose_3d/detector/lite/1/',
    'mediapipe/tfjs-model/handpose_3d/landmark/full/1/',
    'mediapipe/tfjs-model/handpose_3d/landmark/lite/1/',
    'mediapipe/tfjs-model/face_detection/short/1/',
    'mediapipe/tfjs-model/face_landmarks_detection/attention_mesh/1/',
    'mediapipe/tfjs-model/face_landmarks_detection/face_mesh/1/',
    'google/tfjs-model/movenet/multipose/lightning/1/',
    'google/tfjs-model/movenet/singlepose/lightning/4/',
  ];
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
    if (url.href === 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task') {
      return fetchOriginal(new URL('pose_landmarker_lite.task', base), init);
    }
    const path = url.pathname.slice(1);
    if (url.hostname !== 'tfhub.dev' || !paths.some(prefix => path.startsWith(prefix))) {
      return fetchOriginal(input, init);
    }
    const local = new URL(path, base);
    if (input instanceof Request) return fetchOriginal(new Request(local, input), init);
    return fetchOriginal(local, init);
  };
})();

/* A canvas snapshot avoids video-texture inference failures on some GPU backends. */
(() => {
  'use strict';
  const streams = new Map();
  const snapshots = new WeakMap();
  const originalStops = new WeakMap();
  function videoOf(source) {
    const element = source?.elt || source;
    return element?.tagName === 'VIDEO' ? element : null;
  }
  function snapshot(video) {
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;
    let frame = snapshots.get(video);
    if (!frame) { frame = document.createElement('canvas'); snapshots.set(video, frame); }
    if (frame.width !== video.videoWidth || frame.height !== video.videoHeight) {
      frame.width = video.videoWidth;
      frame.height = video.videoHeight;
    }
    frame.getContext('2d', { alpha: false }).drawImage(video, 0, 0, frame.width, frame.height);
    return frame;
  }
  function stop(model) {
    const state = streams.get(model);
    if (state) {
      state.stopped = true;
      cancelAnimationFrame(state.frame);
      streams.delete(model);
    }
    originalStops.get(model)?.();
  }
  async function start(model, source, callback) {
    model = model?.then ? await model : model;
    if (!originalStops.has(model)) {
      originalStops.set(model, model.detectStop?.bind(model));
      model.detectStop = () => stop(model);
    }
    stop(model);
    const video = videoOf(source);
    const state = { stopped: false, frame: 0, started: false };
    streams.set(model, state);
    if (model.ready) await model.ready;
    if (state.stopped) return;
    if (!video) { model.detectStart(source, callback); return; }
    function pump() {
      if (state.stopped) return;
      if (video.srcObject && !video.srcObject.active) { stop(model); return; }
      const frame = snapshot(video);
      if (frame && !state.started) {
        state.started = true;
        model.detectStart(frame, callback);
      }
      state.frame = requestAnimationFrame(pump);
    }
    pump();
  }
  window.Ml5Runtime = {
    start(model, source, callback) {
      const pending = start(model, source, callback);
      pending.catch(error => console.error('ml5 camera initialization:', error));
      return pending;
    },
    async detect(model, source) {
      model = await model;
      if (model.ready) await model.ready;
      const video = videoOf(source);
      if (!video) return model.detect(source);
      const frame = snapshot(video);
      return frame ? model.detect(frame) : [];
    },
  };
  addEventListener('pagehide', () => { for (const model of streams.keys()) stop(model); });
})();
