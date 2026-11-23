/* Shared drawing helpers + base character renderer */

const SKIN = '#f3c8a4';
const SKIN_SHADE = '#e2b08a';
const SKIN_LIGHT = '#ffd9b8';

const HAIR = {
  female: { dark: '#4a2d27', mid: '#5b382f', shine: '#7b5043' },
  male: { dark: '#2e2622', mid: '#3d312b', shine: '#58473d' }
};

const CHARS = {
  female: {
    shoulderL: 134, shoulderR: 186, shoulderY: 190,
    waistL: 143, waistR: 177, waistY: 312,
    hipL: 136, hipR: 184, hipY: 350,
    armWidth: 15,
    armPaths: [
      { x1: 137, y1: 199, x2: 122, y2: 318 },
      { x1: 183, y1: 199, x2: 198, y2: 318 }
    ],
    legWidth: 22,
    legs: [
      { x1: 147, y1: 348, x2: 142, y2: 586 },
      { x1: 173, y1: 348, x2: 178, y2: 586 }
    ],
    headCx: 160, headCy: 114, headRx: 39, headRy: 44,
    neck: { x: 150, w: 20, y: 150, h: 34 }
  },
  male: {
    shoulderL: 124, shoulderR: 196, shoulderY: 188,
    waistL: 133, waistR: 187, waistY: 312,
    hipL: 130, hipR: 190, hipY: 350,
    armWidth: 19,
    armPaths: [
      { x1: 130, y1: 199, x2: 118, y2: 320 },
      { x1: 190, y1: 199, x2: 202, y2: 320 }
    ],
    legWidth: 26,
    legs: [
      { x1: 146, y1: 348, x2: 140, y2: 586 },
      { x1: 174, y1: 348, x2: 180, y2: 586 }
    ],
    headCx: 160, headCy: 114, headRx: 42, headRy: 45,
    neck: { x: 148, w: 24, y: 150, h: 34 },
    topNeck: -12,
    topNeckInset: 5
  }
};

const SHARED_DEFS = `
  <pattern id="plaid" width="27" height="27" patternUnits="userSpaceOnUse">
    <rect width="27" height="27" fill="#c8403c"/>
    <rect width="27" height="12" fill="#2d6a50" opacity=".72"/>
    <rect width="12" height="27" fill="#2d6a50" opacity=".54"/>
    <path d="M0 13.5H27M13.5 0V27" stroke="#f6e6c4" stroke-width="1.5" opacity=".9"/>
    <path d="M0 5H27M0 22H27M5 0V27M22 0V27" stroke="#f6e6c4" stroke-width=".65" opacity=".34"/>
  </pattern>
  <pattern id="fabricDots" width="12" height="12" patternUnits="userSpaceOnUse">
    <circle cx="6" cy="6" r="1.15" fill="#8eb7d6" opacity=".4"/>
  </pattern>
  <pattern id="candyStripe" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
    <rect width="18" height="18" fill="#c93434"/>
    <rect width="8" height="18" fill="#f7f0e2"/>
  </pattern>
  <linearGradient id="coatShade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#000" stop-opacity=".13"/>
    <stop offset=".5" stop-color="#000" stop-opacity="0"/>
    <stop offset="1" stop-color="#000" stop-opacity=".13"/>
  </linearGradient>
`;

/* ---------- small shape helpers ---------- */

function torsoPath(c) {
  const { shoulderL: sl, shoulderR: sr, shoulderY: sy, waistL: wl, waistR: wr,
    waistY: wy, hipL: hl, hipR: hr, hipY: hy } = c;
  return `M${sl} ${sy} Q160 ${sy - 13} ${sr} ${sy} `
    + `C${sr - 1} ${sy + 56} ${wr} ${wy - 34} ${wr} ${wy} `
    + `C${hr - 1} ${wy + 20} ${hr} ${hy - 18} ${hr - 1} ${hy} `
    + `Q160 ${hy + 9} ${hl + 1} ${hy} `
    + `C${hl} ${hy - 18} ${hl + 1} ${wy + 20} ${wl} ${wy} `
    + `C${wl} ${wy - 34} ${sl + 1} ${sy + 56} ${sl} ${sy} Z`;
}

function scoopTopPath(c, { grow = 2, hemY = c.hipY - 4, neck = 30 } = {}) {
  const sl = c.shoulderL - grow;
  const sr = c.shoulderR + grow;
  const sy = c.shoulderY;
  const wl = c.waistL - 2 - grow;
  const wr = c.waistR + 2 + grow;
  const hl = c.hipL - grow;
  const hr = c.hipR + grow;
  const depth = Math.max(14, neck + (c.topNeck || 0));
  const ins = c.topNeckInset || 0;
  const nL = 149 + ins;
  const nR = 171 - ins;
  return `M${sl} ${sy} C${sl + 12 + ins * 0.8} ${sy + 8}, ${nL - 3} ${sy + 12}, ${nL} ${sy + depth} `
    + `Q160 ${sy + depth + 12} ${nR} ${sy + depth} `
    + `C${nR + 3} ${sy + 12} ${sr - 12 - ins * 0.8} ${sy + 8} ${sr} ${sy} `
    + `L${wr} ${c.waistY} L${hr} ${hemY} Q160 ${hemY + 12} ${hl} ${hemY} `
    + `L${wl} ${c.waistY} Z`;
}

function sleeveLayer(c, color, { trim = null, short = false, width = 9 } = {}) {
  let out = '';
  c.armPaths.forEach((a) => {
    const ex = short ? a.x1 + (a.x2 - a.x1) * 0.42 : a.x2;
    const ey = short ? a.y1 + (a.y2 - a.y1) * 0.42 : a.y2;
    out += `<path d="M${a.x1} ${a.y1} L${ex} ${ey}" fill="none" stroke="${color}" stroke-width="${c.armWidth + width}" stroke-linecap="round"/>`;
    if (trim && !short) {
      const dx = a.x2 - a.x1;
      const dy = a.y2 - a.y1;
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      const sx = a.x2 - ux * 13;
      const sy = a.y2 - uy * 13;
      out += `<path d="M${sx} ${sy} L${a.x2} ${a.y2}" fill="none" stroke="${trim}" stroke-width="${c.armWidth + width + 1}" stroke-linecap="round"/>`;
    }
  });
  return out;
}

function snowflake(x, y, r, color, width = 2) {
  let arms = '';
  let branches = '';
  for (let i = 0; i < 6; i += 1) {
    const a = (i * 60 - 90) * Math.PI / 180;
    const x2 = x + Math.cos(a) * r;
    const y2 = y + Math.sin(a) * r;
    arms += `<line x1="${x}" y1="${y}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
    const mx = x + Math.cos(a) * r * 0.58;
    const my = y + Math.sin(a) * r * 0.58;
    [Math.PI / 4, -Math.PI / 4].forEach((tilt) => {
      const b = a + tilt;
      branches += `<line x1="${mx.toFixed(1)}" y1="${my.toFixed(1)}" x2="${(mx + Math.cos(b) * r * 0.28).toFixed(1)}" y2="${(my + Math.sin(b) * r * 0.28).toFixed(1)}" stroke="${color}" stroke-width="${Math.max(1, width - 0.7)}" stroke-linecap="round"/>`;
    });
  }
  return `<g opacity=".95">${arms}${branches}</g>`;
}

function starShape(x, y, r, fill) {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.44;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    pts.push(`${(x + Math.cos(a) * rad).toFixed(1)},${(y + Math.sin(a) * rad).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
}

function pantsHip(c, color) {
  const { waistL: wl, waistR: wr, waistY: wy, hipL: hl, hipR: hr, hipY: hy } = c;
  return `<path d="M${wl - 1} ${wy + 4} Q160 ${wy - 4} ${wr + 1} ${wy + 4} `
    + `L${hr + 1} ${hy + 7} Q160 ${hy + 21} ${hl - 1} ${hy + 7} Z" fill="${color}"/>`;
}

function pantsLegs(c, color, { trim = null } = {}) {
  const width = c.legWidth + 8;
  let out = '';
  c.legs.forEach((l) => {
    out += `<path d="M${l.x1} ${l.y1 - 12} L${l.x2} ${l.y2}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  });
  if (trim) {
    c.legs.forEach((l) => {
      const dx = l.x2 - l.x1;
      const dy = l.y2 - l.y1;
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      const sx = l.x2 - ux * 15;
      const sy = l.y2 - uy * 15;
      out += `<path d="M${sx} ${sy} L${l.x2} ${l.y2}" fill="none" stroke="${trim}" stroke-width="${width + 1}" stroke-linecap="round"/>`;
    });
  }
  return out;
}

function skirtShape(c, fill, { hem = 430, flare = 24 } = {}) {
  const topY = c.hipY - 42;
  return `<path d="M${c.hipL} ${topY} Q160 ${topY - 11} ${c.hipR} ${topY} `
    + `L${c.hipR + flare} ${hem} Q160 ${hem + 17} ${c.hipL - flare} ${hem} Z" fill="${fill}"/>`;
}

/* ---------- base body layers ---------- */

function backHairLayer(key, c) {
  const h = HAIR[key];
  if (key === 'female') {
    return `<path d="M160 58 C126 58 113 84 117 120 C119 148 112 200 120 240 C123 258 138 262 144 246 C148 230 142 198 144 170 L176 170 C178 198 172 230 176 246 C182 262 197 258 200 240 C208 200 201 148 203 120 C207 84 194 58 160 58 Z" fill="${h.dark}"/>
      <path d="M125 120 C124 162 123 206 130 238" stroke="${h.mid}" stroke-width="8" fill="none" stroke-linecap="round" opacity=".55"/>
      <path d="M195 120 C196 162 197 206 190 238" stroke="${h.mid}" stroke-width="8" fill="none" stroke-linecap="round" opacity=".55"/>`;
  }
  return `<ellipse cx="160" cy="113" rx="${c.headRx + 4}" ry="${c.headRy + 2}" fill="${h.dark}"/>`;
}

function armsLayer(c) {
  let out = '';
  c.armPaths.forEach((a) => {
    out += `<path d="M${a.x1} ${a.y1} L${a.x2} ${a.y2}" stroke="${SKIN}" stroke-width="${c.armWidth}" stroke-linecap="round" fill="none"/>`;
  });
  return out;
}

function legsLayer(c) {
  let out = '';
  c.legs.forEach((l) => {
    out += `<path d="M${l.x1} ${l.y1} L${l.x2} ${l.y2}" stroke="${SKIN}" stroke-width="${c.legWidth}" stroke-linecap="round" fill="none"/>`;
    out += `<path d="M${l.x1 + 5} ${l.y1 + 40} L${l.x2 + 3} ${l.y2 - 40}" stroke="${SKIN_LIGHT}" stroke-width="5" stroke-linecap="round" fill="none" opacity=".45"/>`;
  });
  return out;
}

function torsoLayer(c) {
  return `<path d="${torsoPath(c)}" fill="${SKIN}"/>`
    + `<path d="M160 ${c.shoulderY + 18} L160 ${c.hipY - 8}" stroke="${SKIN_SHADE}" stroke-width="1.4" opacity=".25"/>`
    + `<ellipse cx="151" cy="${c.shoulderY + 46}" rx="22" ry="30" fill="${SKIN_LIGHT}" opacity=".18"/>`;
}

function headLayer(key, c) {
  const h = HAIR[key];
  const cx = c.headCx;
  const cy = c.headCy;
  const rx = c.headRx;
  const ry = c.headRy;
  let out = '';

  out += `<rect x="${c.neck.x}" y="${c.neck.y}" width="${c.neck.w}" height="${c.neck.h}" rx="8" fill="${SKIN}"/>`;
  out += `<path d="M${c.neck.x + 3} ${c.neck.y + 5} L${c.neck.x + 3} ${c.neck.y + c.neck.h - 4}" stroke="${SKIN_SHADE}" stroke-width="3" opacity=".35" stroke-linecap="round"/>`;
  out += `<circle cx="${cx - rx + 3}" cy="${cy + 8}" r="8" fill="${SKIN}"/>`;
  out += `<circle cx="${cx + rx - 3}" cy="${cy + 8}" r="8" fill="${SKIN}"/>`;
  out += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${SKIN}"/>`;
  out += `<ellipse cx="${cx - 12}" cy="${cy + 18}" rx="15" ry="17" fill="${SKIN_LIGHT}" opacity=".2"/>`;

  // face — the two characters have different features
  if (key === 'female') {
    out += `<g>
      <ellipse cx="${cx - 17}" cy="${cy + 10}" rx="3.1" ry="4.3" fill="#3b2a27"/>
      <ellipse cx="${cx + 17}" cy="${cy + 10}" rx="3.1" ry="4.3" fill="#3b2a27"/>
      <circle cx="${cx - 18.1}" cy="${cy + 8.6}" r="1.15" fill="#fff"/>
      <circle cx="${cx + 15.9}" cy="${cy + 8.6}" r="1.15" fill="#fff"/>
      <path d="M${cx - 21} ${cy + 7} L${cx - 24} ${cy + 4.5} M${cx - 20.5} ${cy + 9.5} L${cx - 24.5} ${cy + 9}" stroke="#3b2a27" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <path d="M${cx + 21} ${cy + 7} L${cx + 24} ${cy + 4.5} M${cx + 20.5} ${cy + 9.5} L${cx + 24.5} ${cy + 9}" stroke="#3b2a27" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <path d="M${cx - 24} ${cy + 3.5} Q${cx - 19} ${cy + .5} ${cx - 12.5} ${cy + 2.8}" stroke="${h.dark}" stroke-width="1.25" fill="none" stroke-linecap="round" opacity=".65"/>
      <path d="M${cx + 12.5} ${cy + 2.8} Q${cx + 19} ${cy + .5} ${cx + 24} ${cy + 3.5}" stroke="${h.dark}" stroke-width="1.25" fill="none" stroke-linecap="round" opacity=".65"/>
      <path d="M${cx - 3} ${cy + 17.5} Q${cx} ${cy + 20} ${cx + 3} ${cy + 17.5}" stroke="${SKIN_SHADE}" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".75"/>
      <path d="M${cx - 6.5} ${cy + 27} Q${cx} ${cy + 33} ${cx + 6.5} ${cy + 27} Q${cx} ${cy + 30.5} ${cx - 6.5} ${cy + 27} Z" fill="#c46c64"/>
      <ellipse cx="${cx - 25}" cy="${cy + 20}" rx="7.5" ry="4.6" fill="#f1a09c" opacity=".42"/>
      <ellipse cx="${cx + 25}" cy="${cy + 20}" rx="7.5" ry="4.6" fill="#f1a09c" opacity=".42"/>
    </g>`;
  } else {
    out += `<g>
      <ellipse cx="${cx - 17}" cy="${cy + 10}" rx="3.7" ry="3.1" fill="#332723"/>
      <ellipse cx="${cx + 17}" cy="${cy + 10}" rx="3.7" ry="3.1" fill="#332723"/>
      <circle cx="${cx - 18.1}" cy="${cy + 9}" r="1" fill="#fff"/>
      <circle cx="${cx + 15.9}" cy="${cy + 9}" r="1" fill="#fff"/>
      <path d="M${cx - 25} ${cy + 3.5} L${cx - 11.5} ${cy + 5.2}" stroke="${h.dark}" stroke-width="2.7" fill="none" stroke-linecap="round"/>
      <path d="M${cx + 11.5} ${cy + 5.2} L${cx + 25} ${cy + 3.5}" stroke="${h.dark}" stroke-width="2.7" fill="none" stroke-linecap="round"/>
      <path d="M${cx - 4} ${cy + 18} Q${cx} ${cy + 21.5} ${cx + 4} ${cy + 18}" stroke="${SKIN_SHADE}" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".8"/>
      <path d="M${cx - 7} ${cy + 28} Q${cx} ${cy + 32} ${cx + 7} ${cy + 28}" stroke="#9e5e52" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M${cx - 23} ${cy + 22} Q${cx - 19} ${cy + 20} ${cx - 15} ${cy + 22}" stroke="#d9a58a" stroke-width="1.2" fill="none" opacity=".5" stroke-linecap="round"/>
      <path d="M${cx + 15} ${cy + 22} Q${cx + 19} ${cy + 20} ${cx + 23} ${cy + 22}" stroke="#d9a58a" stroke-width="1.2" fill="none" opacity=".5" stroke-linecap="round"/>
    </g>`;
  }

  // front hair
  if (key === 'female') {
    out += `<path d="M120 111 C117 76 134 61 160 61 C186 61 203 77 200 111 C192 94 182 87 171 88 C162 74 144 74 139 92 C133 90 126 99 120 111 Z" fill="${h.dark}"/>`;
    out += `<path d="M129 92 C136 78 148 72 160 73" stroke="${h.shine}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".55"/>`;
    out += `<path d="M121 102 C115 126 117 150 123 166" stroke="${h.dark}" stroke-width="12" fill="none" stroke-linecap="round"/>`;
    out += `<path d="M199 102 C205 126 203 150 197 166" stroke="${h.dark}" stroke-width="12" fill="none" stroke-linecap="round"/>`;
  } else {
    out += `<path d="M118 111 C115 75 134 61 160 61 C187 61 205 77 202 113 C197 94 188 85 174 87 C166 76 150 76 143 89 C135 87 126 96 118 111 Z" fill="${h.dark}"/>`;
    out += `<path d="M131 86 C141 74 153 70 164 71" stroke="${h.shine}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".45"/>`;
  }
  return out;
}

function baseTank(c) {
  const p = scoopTopPath(c, { grow: 0, hemY: c.waistY + 12, neck: 34 });
  return `<path d="${p}" fill="#f6f0e2"/>
    <path d="M${c.waistL} ${c.waistY + 12} Q160 ${c.waistY + 24} ${c.waistR} ${c.waistY + 12}" stroke="#e6dcc7" stroke-width="3" fill="none"/>
    <path d="M150 ${c.shoulderY + 38} Q160 ${c.shoulderY + 48} 170 ${c.shoulderY + 38}" stroke="#e6dcc7" stroke-width="2" fill="none" opacity=".8"/>`;
}

function baseShorts(c) {
  const top = c.hipY - 44;
  return `<path d="M${c.hipL + 1} ${top} Q160 ${top - 9} ${c.hipR - 1} ${top} L${c.hipR + 1} ${c.hipY + 7} Q160 ${c.hipY + 18} ${c.hipL - 1} ${c.hipY + 7} Z" fill="#a9c6da"/>
    <path d="M${c.hipL + 2} ${top + 5} Q160 ${top - 3} ${c.hipR - 2} ${top + 5}" stroke="#8fb2ca" stroke-width="4" fill="none"/>
    <path d="M160 ${top + 4} L160 ${c.hipY + 12}" stroke="#8fb2ca" stroke-width="2" opacity=".55"/>`;
}

function handsLayer(c) {
  let out = '';
  c.armPaths.forEach((a) => {
    out += `<circle cx="${a.x2}" cy="${a.y2}" r="${c.armWidth * 0.55 + 1}" fill="${SKIN}"/>`;
    out += `<path d="M${a.x2 - 4} ${a.y2 - 3} L${a.x2 + 2} ${a.y2 - 5}" stroke="${SKIN_SHADE}" stroke-width="1.4" opacity=".5" stroke-linecap="round"/>`;
  });
  return out;
}

function shoesLayer(c) {
  let out = '';
  c.legs.forEach((l) => {
    const cx = l.x2;
    const rx = c.legWidth * 0.72;
    out += `<ellipse cx="${cx}" cy="596" rx="${rx + 3}" ry="11" fill="#322321"/>`;
    out += `<ellipse cx="${cx}" cy="591" rx="${rx}" ry="10" fill="#5a3b33"/>`;
    out += `<ellipse cx="${cx - 2}" cy="587" rx="${rx * 0.58}" ry="4" fill="#7a5548" opacity=".8"/>`;
    out += `<path d="M${cx - rx} 599 Q${cx} 606 ${cx + rx} 599" stroke="#201512" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  });
  return out;
}
