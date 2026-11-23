/* Footwear */

function pairShoes(c, draw) {
  return c.legs.map((leg) => draw(leg.x2, leg)).join('');
}

function bootShaft(c, x, { color, cuff, sole, accent = null, laces = false }) {
  const w = c.legWidth + 10;
  const half = w / 2;
  const toe = c.legWidth * 0.72 + 5;
  let out = `
    <rect x="${x - half}" y="538" width="${w}" height="52" rx="${half * 0.55}" fill="${color}"/>
    <rect x="${x - half - 2}" y="534" width="${w + 4}" height="14" rx="6" fill="${cuff}"/>
    <ellipse cx="${x}" cy="594" rx="${toe}" ry="12" fill="${color}"/>
    <ellipse cx="${x}" cy="602" rx="${toe + 1}" ry="5.5" fill="${sole}"/>
    <path d="M${x - half + 4} 548 L${x - half + 4} 582" stroke="#000" stroke-width="2" opacity=".12"/>
    <path d="M${x + half - 3} 552 L${x + half - 3} 578" stroke="#fff" stroke-width="2" opacity=".14"/>
  `;
  if (accent) {
    out += `<rect x="${x - 9}" y="560" width="18" height="9" rx="3" fill="${accent}" opacity=".95"/>
      <rect x="${x - 4}" y="562.5" width="8" height="4" rx="1.5" fill="#7b5320" opacity=".65"/>`;
  }
  if (laces) {
    out += `<path d="M${x - 9} 552 L${x + 9} 557 M${x - 9} 562 L${x + 9} 567 M${x - 9} 572 L${x + 9} 577" stroke="#f4f8ff" stroke-width="2" stroke-linecap="round"/>`;
  }
  return out;
}

const SHOE_ITEMS = [
  {
    id: 'cozy-boots',
    name: '코지 퍼 부츠',
    tag: '부츠',
    cat: 'shoes',
    slot: 'shoes',
    who: 'unisex',
    render(c) {
      return pairShoes(c, (x) => bootShaft(c, x, {
        color: '#8a5a43', cuff: '#f4e8d2', sole: '#4a3027'
      }) + `<circle cx="${x - 10}" cy="539" r="4" fill="#f4e8d2"/><circle cx="${x + 10}" cy="539" r="4" fill="#f4e8d2"/>`);
    }
  },
  {
    id: 'santa-boots',
    name: '산타 부츠',
    tag: '부츠',
    cat: 'shoes',
    slot: 'shoes',
    who: 'unisex',
    render(c) {
      return pairShoes(c, (x) => bootShaft(c, x, {
        color: '#b62b2b', cuff: '#f8f0df', sole: '#3a2520', accent: '#e7bd5f'
      }));
    }
  },
  {
    id: 'snow-boots',
    name: '스노우 부츠',
    tag: '부츠',
    cat: 'shoes',
    slot: 'shoes',
    who: 'unisex',
    render(c) {
      return pairShoes(c, (x) => bootShaft(c, x, {
        color: '#507fa4', cuff: '#eef7ff', sole: '#dfeefa', laces: true
      }) + `<path d="M${x - 12} 584 Q${x} 588 ${x + 12} 584" stroke="#eef7ff" stroke-width="3" fill="none" opacity=".8"/>`);
    }
  },
  {
    id: 'reindeer-slippers',
    name: '루돌프 슬리퍼',
    tag: '슬리퍼',
    cat: 'shoes',
    slot: 'shoes',
    who: 'unisex',
    render(c) {
      return pairShoes(c, (x) => `
        <ellipse cx="${x}" cy="594" rx="${c.legWidth * 0.78 + 7}" ry="14" fill="#7b4c35"/>
        <ellipse cx="${x}" cy="590" rx="${c.legWidth * 0.66 + 3}" ry="10" fill="#a4714f"/>
        <path d="M${x - 13} 585 Q${x} 592 ${x + 13} 585" stroke="#f2e4cd" stroke-width="6" fill="none" stroke-linecap="round"/>
        <ellipse cx="${x}" cy="601" rx="${c.legWidth * 0.78 + 8}" ry="4" fill="#533326"/>
        <path d="M${x - 11} 578 C${x - 16} 568 ${x - 18} 562 ${x - 22} 558 M${x + 11} 578 C${x + 16} 568 ${x + 18} 562 ${x + 22} 558" stroke="#7b4c35" stroke-width="3" fill="none" stroke-linecap="round"/>
        <circle cx="${x}" cy="590" r="3" fill="#c8443c"/>
      `);
    }
  },
  {
    id: 'ribbon-flats',
    name: '리본 플랫',
    tag: '플랫',
    cat: 'shoes',
    slot: 'shoes',
    who: 'female',
    render(c) {
      return pairShoes(c, (x) => `
        <ellipse cx="${x}" cy="596" rx="${c.legWidth * 0.7 + 5}" ry="11" fill="#e5a6b3"/>
        <ellipse cx="${x}" cy="600" rx="${c.legWidth * 0.7 + 6}" ry="4" fill="#bd7f8c"/>
        <path d="M${x - 13} 588 Q${x} 580 ${x + 13} 588" stroke="#f7dfe5" stroke-width="4" fill="none"/>
        <path d="M${x} 584 C${x - 7} 576 ${x - 12} 580 ${x - 7} 586 Z M${x} 584 C${x + 7} 576 ${x + 12} 580 ${x + 7} 586 Z" fill="#f6d6dc"/>
        <circle cx="${x}" cy="584" r="2.5" fill="#d48f9d"/>
      `);
    }
  },
  {
    id: 'derby-shoes',
    name: '클래식 더비',
    tag: '구두',
    cat: 'shoes',
    slot: 'shoes',
    who: 'male',
    render(c) {
      return pairShoes(c, (x) => `
        <ellipse cx="${x}" cy="596" rx="${c.legWidth * 0.78 + 5}" ry="11.5" fill="#4a3026"/>
        <ellipse cx="${x}" cy="590" rx="${c.legWidth * 0.66 + 3}" ry="9.5" fill="#6b4635"/>
        <ellipse cx="${x}" cy="602" rx="${c.legWidth * 0.78 + 7}" ry="4" fill="#2c1d19"/>
        <path d="M${x - 11} 589 Q${x} 583 ${x + 11} 589" stroke="#8a5c45" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M${x - 8} 586 L${x + 8} 586 M${x - 7} 589.5 L${x + 7} 589.5" stroke="#34211b" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M${x - 13} 597 Q${x} 601 ${x + 13} 597" stroke="#a4785c" stroke-width="1.5" fill="none" opacity=".5"/>
      `);
    }
  }
];
