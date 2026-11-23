/* =========================================================
   effects.js — canvas filter engine
   All filters render the (already mirrored) frame canvas into
   an offscreen canvas. The app clips that canvas to the portal.
   ========================================================= */

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/** tiny deterministic PRNG so glitch holds for a few frames at a time */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/* ---------- face mesh helpers ------------------------------------ */

function drawTriangle(ctx, img, srcPts, dstPts, tri, w, h) {
  const [i0, i1, i2] = tri;
  const s0 = srcPts[i0];
  const s1 = srcPts[i1];
  const s2 = srcPts[i2];
  if (!s0 || !s1 || !s2) return;

  const d0 = dstPts[i0];
  const d1 = dstPts[i1];
  const d2 = dstPts[i2];

  const den = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
  if (Math.abs(den) < 1e-7) return;

  // map source -> destination (canvas affine)
  const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / den;
  const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / den;
  const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / den;
  const d = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / den;
  const e = d0.x - a * s0.x - c * s0.y;
  const f = d0.y - b * s0.x - d * s0.y;

  // expand destination slightly to hide seams between triangles
  const cx = (d0.x + d1.x + d2.x) / 3;
  const cy = (d0.y + d1.y + d2.y) / 3;
  const k = 1.08;
  const x0 = cx + (d0.x - cx) * k;
  const y0 = cy + (d0.y - cy) * k;
  const x1 = cx + (d1.x - cx) * k;
  const y1 = cy + (d1.y - cy) * k;
  const x2 = cx + (d2.x - cx) * k;
  const y2 = cy + (d2.y - cy) * k;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();
}

/**
 * A funhouse-face displacement. Everything is zero at the face
 * boundary so the warped patch blends into the untouched frame.
 */
function displaceFace(points, time, box) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const hw = Math.max(1, box.w / 2);
  const hh = Math.max(1, box.h / 2);
  const amp = Math.min(42, box.w * 0.078);

  const eyeL = points[33] && points[133]
    ? { x: (points[33].x + points[133].x) / 2, y: (points[33].y + points[133].y) / 2 }
    : null;
  const eyeR = points[362] && points[263]
    ? { x: (points[362].x + points[263].x) / 2, y: (points[362].y + points[263].y) / 2 }
    : null;
  const eyeRad = Math.max(10, box.w * 0.135);

  const sx = 1 + 0.1 * Math.sin(time * 1.15 + 0.8);
  const sy = 1 + 0.14 * Math.sin(time * 1.55);
  const swirl = 0.26 * Math.sin(time * 1.05);
  const eyeZoom = 0.55 + 0.55 * Math.sin(time * 1.85);

  const out = new Array(points.length);

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const nx = (p.x - cx) / hw;
    const ny = (p.y - cy) / hh;
    const maxAbs = Math.max(Math.abs(nx), Math.abs(ny));
    // 1 in the middle, 0 near the outline so the patch blends in
    const edge = Math.max(0, Math.min(1, (0.94 - maxAbs) / 0.34));

    // squeeze / stretch
    let dx = (p.x - cx) * (sx - 1) * edge * 0.9;
    let dy = (p.y - cy) * (sy - 1) * edge * 0.9;

    // liquid wave across the face
    dx += Math.sin(ny * 4.8 + time * 2.3) * amp * 0.95 * edge;
    dy += Math.cos(nx * 4.1 - time * 1.9) * amp * 0.7 * edge;

    // swirl around the face center
    const rx = p.x - cx;
    const ry = p.y - cy;
    const ang = swirl * edge;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    dx += (rx * ca - ry * sa - rx) * 0.6;
    dy += (rx * sa + ry * ca - ry) * 0.6;

    // eyes bulge in and out
    if (eyeL) {
      const ex = p.x - eyeL.x;
      const ey = p.y - eyeL.y;
      const ed = Math.hypot(ex, ey) / eyeRad;
      if (ed < 1) {
        const w = 1 - ed * ed;
        dx += ex * eyeZoom * w * edge;
        dy += ey * eyeZoom * w * edge;
      }
    }
    if (eyeR) {
      const ex = p.x - eyeR.x;
      const ey = p.y - eyeR.y;
      const ed = Math.hypot(ex, ey) / eyeRad;
      if (ed < 1) {
        const w = 1 - ed * ed;
        dx += ex * eyeZoom * w * edge;
        dy += ey * eyeZoom * w * edge;
      }
    }

    // jaw / mouth smear
    if (ny > 0.15) {
      const jaw = ((ny - 0.15) / 0.85) * edge;
      dx += nx * amp * 1.05 * jaw * (1 + 0.4 * Math.sin(time * 1.6));
      dy += Math.sin(nx * 3.6 + time * 2.1) * amp * 0.55 * jaw;
    }

    out[i] = { x: p.x + dx, y: p.y + dy };
  }
  return out;
}

/* ---------- main engine ----------------------------------------- */

export class FilterEngine {
  constructor() {
    this.w = 0;
    this.h = 0;
    this.out = makeCanvas(1, 1);
    this.outCtx = this.out.getContext("2d");

    this.mono = makeCanvas(1, 1);
    this.monoCtx = this.mono.getContext("2d", { willReadFrequently: true });

    this.small = makeCanvas(1, 1);
    this.smallCtx = this.small.getContext("2d");

    this.warp = makeCanvas(1, 1);
    this.warpCtx = this.warp.getContext("2d");
    this.warpScale = 0.62;

    this.noise = this.makeNoise();
  }

  makeNoise() {
    const c = makeCanvas(128, 128);
    const x = c.getContext("2d");
    const img = x.createImageData(c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = 110 + Math.random() * 60;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = Math.random() * 34;
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  resize(w, h) {
    if (!w || !h) return;
    if (this.w === w && this.h === h) return;
    this.w = w;
    this.h = h;
    this.out.width = w;
    this.out.height = h;
    this.outCtx = this.out.getContext("2d");

    const monoW = Math.ceil(w / 2);
    const monoH = Math.ceil(h / 2);
    this.mono.width = monoW;
    this.mono.height = monoH;
    this.monoCtx = this.mono.getContext("2d", { willReadFrequently: true });

    this.small.width = Math.ceil(w / 16);
    this.small.height = Math.ceil(h / 16);
    this.smallCtx = this.small.getContext("2d");

    this.warp.width = Math.ceil(w * this.warpScale);
    this.warp.height = Math.ceil(h * this.warpScale);
    this.warpCtx = this.warp.getContext("2d");
  }

  render(id, source, time, face) {
    const ctx = this.outCtx;
    const { w, h } = this;
    if (!w || !h) return this.out;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.imageSmoothingEnabled = true;
    ctx.shadowBlur = 0;
    ctx.clearRect(0, 0, w, h);

    switch (id) {
      case "negative":
        this.renderNegative(ctx, source);
        break;
      case "glitch":
        this.renderGlitch(ctx, source, time, w, h);
        break;
      case "pixel":
        this.renderPixel(ctx, source, w, h);
        break;
      case "mono":
        this.renderMono(ctx, source, w, h);
        break;
      case "face":
        this.renderFace(ctx, source, time, face, w, h);
        break;
      default:
        ctx.drawImage(source, 0, 0, w, h);
    }

    // shared film grain, so every filter feels like one instrument
    ctx.globalAlpha = 0.16;
    ctx.globalCompositeOperation = "overlay";
    const pattern = ctx.createPattern(this.noise, "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      const ox = Math.floor((time * 17) % 128);
      const oy = Math.floor((time * 29) % 128);
      ctx.save();
      ctx.translate(-ox, -oy);
      ctx.fillRect(0, 0, w + 128, h + 128);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    return this.out;
  }

  /* --------------------------------------------------------- */

  renderNegative(ctx, src) {
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = "difference";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = "source-over";
  }

  renderGlitch(ctx, src, time, w, h) {
    const bucket = Math.floor(time * 9);
    const rnd = mulberry32(bucket * 7919 + 13);

    ctx.drawImage(src, 0, 0, w, h);

    // torn horizontal slices
    const count = 7 + Math.floor(rnd() * 8);
    for (let i = 0; i < count; i++) {
      const sy = rnd() * h;
      const sh = 3 + rnd() * h * 0.075;
      const dx = (rnd() - 0.5) * w * 0.07;
      ctx.drawImage(src, 0, sy, w, sh, dx, sy, w, sh);
    }

    // chromatic fringe
    const shift = 2 + Math.sin(time * 22) * 3;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.16;
    ctx.filter = "hue-rotate(115deg) saturate(2.2)";
    ctx.drawImage(src, shift, 0, w, h);
    ctx.filter = "hue-rotate(-115deg) saturate(2.2)";
    ctx.drawImage(src, -shift, 0, w, h);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // broken color blocks
    if (rnd() > 0.45) {
      const colors = ["#25f4ee", "#ff2d75", "#ffe93d", "#ffffff"];
      for (let i = 0; i < 3; i++) {
        if (rnd() > 0.55) continue;
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.16 + rnd() * 0.2;
        ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
        ctx.fillRect(rnd() * w, rnd() * h, w * (0.05 + rnd() * 0.3), 1 + rnd() * 7);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    // occasional full-frame black scan band
    if (rnd() > 0.72) {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(0, rnd() * h, w, 2 + rnd() * 24);
      ctx.globalCompositeOperation = "source-over";
    }
  }

  renderPixel(ctx, src, w, h) {
    const sw = this.small.width;
    const sh = this.small.height;
    this.smallCtx.imageSmoothingEnabled = true;
    this.smallCtx.clearRect(0, 0, sw, sh);
    this.smallCtx.drawImage(src, 0, 0, sw, sh);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.small, 0, 0, sw, sh, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;

    // subtle pixel-grid shimmer
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = "#000";
    const step = Math.max(8, Math.round(w / 60));
    for (let x = 0; x < w; x += step) ctx.fillRect(x, 0, 1, h);
    for (let y = 0; y < h; y += step) ctx.fillRect(0, y, w, 1);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  renderMono(ctx, src, w, h) {
    const mw = this.mono.width;
    const mh = this.mono.height;
    this.monoCtx.clearRect(0, 0, mw, mh);
    this.monoCtx.drawImage(src, 0, 0, mw, mh);

    const img = this.monoCtx.getImageData(0, 0, mw, mh);
    const d = img.data;
    const contrast = 1.55;
    for (let i = 0; i < d.length; i += 4) {
      let v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      v = (v - 128) * contrast + 128;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      // posterize to 4 ink levels
      const q = Math.round(v / 85) * 85;
      d[i] = q;
      d[i + 1] = q;
      d[i + 2] = q;
    }
    this.monoCtx.putImageData(img, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.mono, 0, 0, mw, mh, 0, 0, w, h);

    // faint cool duotone wash for the "print" feeling
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "rgba(236, 240, 255, .1)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  }

  renderFace(ctx, src, time, face, w, h) {
    ctx.drawImage(src, 0, 0, w, h);

    if (!face || !face.points || !face.points.length || !face.triangles || !face.triangles.length) {
      this.renderStripWarp(ctx, src, time, w, h);
      return;
    }

    const s = this.warpScale;
    const wctx = this.warpCtx;
    const wc = this.warp;

    wctx.setTransform(s, 0, 0, s, 0, 0);
    wctx.globalAlpha = 1;
    wctx.globalCompositeOperation = "source-over";
    wctx.imageSmoothingEnabled = true;
    wctx.clearRect(0, 0, w, h);
    wctx.drawImage(src, 0, 0, w, h);

    const dst = displaceFace(face.points, time, face.box);
    const tris = face.triangles;
    const box = face.box;

    // only warp the face patch (saves a lot of triangles)
    const padX = box.w * 0.06;
    const padY = box.h * 0.06;
    const minX = box.x - padX;
    const maxX = box.x + box.w + padX;
    const minY = box.y - padY;
    const maxY = box.y + box.h + padY;

    const srcPts = face.points;
    for (let i = 0; i < tris.length; i++) {
      const tri = tris[i];
      const p0 = srcPts[tri[0]];
      if (!p0) continue;
      const p1 = srcPts[tri[1]];
      const p2 = srcPts[tri[2]];
      if (!p1 || !p2) continue;
      const mx = (p0.x + p1.x + p2.x) / 3;
      const my = (p0.y + p1.y + p2.y) / 3;
      if (mx < minX || mx > maxX || my < minY || my > maxY) continue;
      drawTriangle(wctx, src, srcPts, dst, tri, w, h);
    }

    // feather the patch so the mesh boundary melts into the frame
    wctx.save();
    wctx.globalCompositeOperation = "destination-in";
    wctx.translate(box.x + box.w / 2, box.y + box.h / 2);
    wctx.scale(box.w * 0.63, box.h * 0.59);
    const mask = wctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    mask.addColorStop(0, "rgba(0,0,0,1)");
    mask.addColorStop(0.62, "rgba(0,0,0,1)");
    mask.addColorStop(1, "rgba(0,0,0,0)");
    wctx.fillStyle = mask;
    wctx.fillRect(-1, -1, 2, 2);
    wctx.restore();

    // paste the warped face (with a little padding) onto the frame
    const dx = clamp(Math.floor(box.x - padX), 0, w);
    const dy = clamp(Math.floor(box.y - padY), 0, h);
    const dw = clamp(Math.ceil(box.w + padX * 2), 1, w - dx);
    const dh = clamp(Math.ceil(box.h + padY * 2), 1, h - dy);
    if (dw > 2 && dh > 2) {
      ctx.drawImage(wc, dx * s, dy * s, dw * s, dh * s, dx, dy, dw, dh);
    }

    // a soft scan glow through the face
    const g = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
    g.addColorStop(0, "rgba(201,167,255,0)");
    g.addColorStop(0.5, "rgba(201,167,255,.08)");
    g.addColorStop(1, "rgba(201,167,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(dx, dy, dw, dh);
  }

  renderStripWarp(ctx, src, time, w, h) {
    ctx.drawImage(src, 0, 0, w, h);

    const size = Math.min(w, h);
    const bw = size * 0.62;
    const bh = size * 0.78;
    const cx = w / 2;
    const cy = h * 0.44;
    const strip = 3;
    ctx.imageSmoothingEnabled = true;

    for (let y = 0; y < bh; y += strip) {
      const ny = (y / bh) * 2 - 1;
      const dx = Math.sin(ny * 5.2 + time * 2.2) * bw * 0.032;
      const squeeze = 1 + 0.16 * Math.sin(ny * 3.1 + time * 1.4);
      const dw = bw * squeeze;
      const sy = cy - bh / 2 + y;
      ctx.drawImage(
        src,
        cx - bw / 2, sy, bw, strip + 0.5,
        cx - dw / 2 + dx, sy, dw, strip + 0.5
      );
    }
  }
}
