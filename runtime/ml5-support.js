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

/* Share original-size video frames; inference and artwork keep their own cadence. */
(() => {
  'use strict';
  const streams = new Map();
  const snapshots = new WeakMap();
  const originalStops = new WeakMap();
  function videoOf(source) {
    const element = source?.elt || source;
    return element?.tagName === 'VIDEO' ? element : null;
  }
  function recordFor(video) {
    let record = snapshots.get(video);
    if (!record) {
      const canvas = document.createElement('canvas');
      record = { video, canvas, context: canvas.getContext('2d', { alpha: false }),
        users: new Set(), handle: null, kind: null, lastFrame: null, stream: null };
      snapshots.set(video, record);
    }
    return record;
  }
  function snapshot(record) {
    const { video, canvas, context } = record;
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;
    const frames = video.getVideoPlaybackQuality?.().totalVideoFrames;
    const key = frames > 0 ? frames : video.currentTime;
    const resized = canvas.width !== video.videoWidth || canvas.height !== video.videoHeight;
    if (resized) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    if (resized || record.lastFrame !== key || record.stream !== video.srcObject) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      record.lastFrame = key;
      record.stream = video.srcObject;
    }
    return canvas;
  }
  function cancel(record) {
    if (record.handle === null) return;
    if (record.kind === 'video') record.video.cancelVideoFrameCallback(record.handle);
    else cancelAnimationFrame(record.handle);
    record.handle = null;
  }
  function stop(model) {
    const state = streams.get(model);
    if (state) {
      state.stopped = true;
      streams.delete(model);
      if (state.record) {
        state.record.users.delete(state);
        if (!state.record.users.size) cancel(state.record);
      }
    }
    originalStops.get(model)?.();
  }
  function schedule(record) {
    if (record.handle !== null || !record.users.size) return;
    const next = () => { record.handle = null; pump(record); };
    // Wait with rAF before the first camera frame; then follow camera delivery,
    // rather than copying the same image at the display refresh rate per model.
    if (record.video.readyState >= 2 && record.video.requestVideoFrameCallback && record.video.cancelVideoFrameCallback) {
      record.kind = 'video';
      record.handle = record.video.requestVideoFrameCallback(next);
    } else {
      record.kind = 'animation';
      record.handle = requestAnimationFrame(next);
    }
  }
  function pump(record) {
    if (!record.users.size) return;
    const video = record.video;
    if (video.srcObject && !video.srcObject.active) {
      for (const state of [...record.users]) stop(state.model);
      return;
    }
    const frame = snapshot(record);
    if (frame) {
      for (const state of record.users) {
        if (state.stopped || state.started) continue;
        state.started = true;
        state.model.detectStart(frame, state.callback);
      }
    }
    schedule(record);
  }
  async function start(model, source, callback) {
    model = model?.then ? await model : model;
    if (!originalStops.has(model)) {
      originalStops.set(model, model.detectStop?.bind(model));
      model.detectStop = () => stop(model);
    }
    stop(model);
    const state = { model, callback, stopped: false, started: false, record: null };
    streams.set(model, state);
    try {
      if (model.ready) await model.ready;
      if (state.stopped) return;
      const video = videoOf(source);
      if (!video) { model.detectStart(source, callback); return; }
      state.record = recordFor(video);
      state.record.users.add(state);
      pump(state.record);
    } catch (error) {
      if (streams.get(model) === state) stop(model);
      throw error;
    }
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
      const frame = snapshot(recordFor(video));
      return frame ? model.detect(frame) : [];
    },
  };
  addEventListener('pagehide', () => { for (const model of streams.keys()) stop(model); });
})();
