/* Item registry + preview helpers */

const ITEMS = [...TOP_ITEMS, ...BOTTOM_ITEMS, ...ACCESSORY_ITEMS, ...SHOE_ITEMS, ...DECOR_ITEMS];

const ITEM_BY_ID = ITEMS.reduce((map, item) => {
  map[item.id] = item;
  return map;
}, {});

const PREVIEW_VIEW = {
  top: '110 160 100 220',
  bottom: '104 292 112 184',
  acc: '102 6 116 126',
  hat: '102 6 116 126',
  neck: '104 138 112 140',
  shoes: '106 526 108 96'
};

function itemPreview(item) {
  if (item.cat === 'scene') {
    return `<svg viewBox="${item.previewView}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      ${item.render()}
    </svg>`;
  }
  const c = CHARS[state.active];
  const view = PREVIEW_VIEW[item.slot] || PREVIEW_VIEW.acc;
  return `<svg viewBox="${view}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>${SHARED_DEFS}</defs>
    ${item.render(c)}
  </svg>`;
}

const SLOTS = [
  { key: 'top', label: '상의', empty: '기본 나시' },
  { key: 'bottom', label: '하의', empty: '기본 반바지' },
  { key: 'shoes', label: '신발', empty: '기본 신발' },
  { key: 'hat', label: '모자', empty: '없음' },
  { key: 'neck', label: '목도리', empty: '없음' }
];

const CATEGORY_LABELS = { top: '상의', bottom: '하의', acc: '소품', shoes: '신발', scene: '배경' };
