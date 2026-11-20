(function (global) {
  'use strict';

  const M3 = {};
  const colorCache = Object.create(null);

  M3.clamp = function (v, min, max) {
    return v < min ? min : v > max ? max : v;
  };

  M3.lerp = function (a, b, t) {
    return a + (b - a) * t;
  };

  M3.smoothstep = function (a, b, v) {
    const t = M3.clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  M3.hex = function (hex) {
    let color = colorCache[hex];
    if (color) return color;
    let value = hex.replace('#', '');
    if (value.length === 3) {
      value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
    }
    const num = parseInt(value, 16);
    color = [
      ((num >> 16) & 255) / 255,
      ((num >> 8) & 255) / 255,
      (num & 255) / 255,
    ];
    colorCache[hex] = color;
    return color;
  };

  M3.mix = function (a, b, t) {
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
  };

  /** Deterministic 32-bit PRNG (mulberry32). */
  M3.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  M3.perspective = function (fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2);
    const nf = 1 / (near - far);
    const out = new Float32Array(16);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[14] = 2 * far * near * nf;
    return out;
  };

  M3.lookAt = function (eye, center, up) {
    let zx = eye[0] - center[0];
    let zy = eye[1] - center[1];
    let zz = eye[2] - center[2];
    let len = Math.hypot(zx, zy, zz) || 1;
    zx /= len;
    zy /= len;
    zz /= len;

    let xx = up[1] * zz - up[2] * zy;
    let xy = up[2] * zx - up[0] * zz;
    let xz = up[0] * zy - up[1] * zx;
    len = Math.hypot(xx, xy, xz) || 1;
    xx /= len;
    xy /= len;
    xz /= len;

    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;

    const out = new Float32Array(16);
    out[0] = xx;
    out[1] = yx;
    out[2] = zx;
    out[3] = 0;
    out[4] = xy;
    out[5] = yy;
    out[6] = zy;
    out[7] = 0;
    out[8] = xz;
    out[9] = yz;
    out[10] = zz;
    out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
    return out;
  };

  M3.multiply = function (a, b) {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      const b0 = b[c * 4];
      const b1 = b[c * 4 + 1];
      const b2 = b[c * 4 + 2];
      const b3 = b[c * 4 + 3];
      for (let r = 0; r < 4; r++) {
        out[c * 4 + r] = a[r] * b0 + a[4 + r] * b1 + a[8 + r] * b2 + a[12 + r] * b3;
      }
    }
    return out;
  };

  global.M3 = M3;
})(window);