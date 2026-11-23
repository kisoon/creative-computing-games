/* Christmas bottoms */

const BOTTOM_ITEMS = [
  {
    id: 'santa-pants',
    name: '산타 팬츠',
    tag: '팬츠',
    cat: 'bottom',
    slot: 'bottom',
    render(c) {
      return `
        ${pantsLegs(c, '#b9322d', { trim: '#f7efe1' })}
        ${pantsHip(c, '#b9322d')}
        <path d="M${c.waistL - 1} ${c.waistY + 3} Q160 ${c.waistY - 4} ${c.waistR + 1} ${c.waistY + 3}" stroke="#f7efe1" stroke-width="5" fill="none"/>
        <path d="M160 ${c.waistY + 2} L160 ${c.hipY + 13}" stroke="#8a211f" stroke-width="2" opacity=".55"/>
        <rect x="${c.waistL + 4}" y="${c.waistY + 26}" width="7" height="3" rx="1.5" fill="#f7efe1" opacity=".7" transform="rotate(-6 149 329)"/>
        <rect x="${c.waistR - 11}" y="${c.waistY + 26}" width="7" height="3" rx="1.5" fill="#f7efe1" opacity=".7" transform="rotate(6 171 329)"/>
        <path d="M${c.legs[0].x1 - 9} ${c.hipY + 22} L${c.legs[0].x2 - 7} ${570}" stroke="#8a211f" stroke-width="1.5" opacity=".4"/>
        <path d="M${c.legs[1].x1 + 9} ${c.hipY + 22} L${c.legs[1].x2 + 7} ${570}" stroke="#8a211f" stroke-width="1.5" opacity=".4"/>
      `;
    }
  },
  {
    id: 'plaid-skirt',
    name: '체크 스커트',
    tag: '스커트',
    cat: 'bottom',
    slot: 'bottom',
    who: 'female',
    render(c) {
      const hem = 426;
      const topY = c.hipY - 42;
      return `
        ${skirtShape(c, 'url(#plaid)', { hem, flare: 27 })}
        <path d="M${c.hipL} ${topY} Q160 ${topY - 11} ${c.hipR} ${topY}" stroke="#8e2b2b" stroke-width="10" fill="none" stroke-linecap="round"/>
        <path d="M${c.hipL - 20} ${hem - 2} Q160 ${hem + 15} ${c.hipR + 20} ${hem - 2}" stroke="#f8f0df" stroke-width="9" fill="none" stroke-linecap="round"/>
        <path d="M147 ${topY + 8} L137 ${hem - 6} M160 ${topY + 5} L160 ${hem + 8} M173 ${topY + 8} L183 ${hem - 6}" stroke="#5d2424" stroke-width="5" opacity=".18"/>
        <path d="M139 ${topY + 20} L126 ${hem - 10} M181 ${topY + 20} L194 ${hem - 10}" stroke="#5d2424" stroke-width="3" opacity=".14"/>
        <circle cx="160" cy="${topY + 1}" r="3.5" fill="#e5bd62"/>
        <path d="M160 ${topY + 6} L150 ${topY + 26} M160 ${topY + 6} L170 ${topY + 26}" stroke="#e5bd62" stroke-width="2" opacity=".75"/>
      `;
    }
  },
  {
    id: 'green-pants',
    name: '코듀로이 팬츠',
    tag: '팬츠',
    cat: 'bottom',
    slot: 'bottom',
    render(c) {
      let stitches = '';
      c.legs.forEach((l, i) => {
        const off = i === 0 ? -5 : 5;
        stitches += `<path d="M${l.x1 + off} ${l.y1 + 16} L${l.x2 + off} ${l.y2 - 10}" stroke="#1d4d3a" stroke-width="1.6" opacity=".55"/>`;
        stitches += `<path d="M${l.x1 + off * 1.8} ${l.y1 + 20} L${l.x2 + off * 1.8} ${l.y2 - 12}" stroke="#3d8668" stroke-width="1.2" opacity=".35"/>`;
      });
      return `
        ${pantsLegs(c, '#2f6b50', { trim: '#26573f' })}
        ${pantsHip(c, '#2f6b50')}
        ${stitches}
        <path d="M${c.waistL - 1} ${c.waistY + 4} Q160 ${c.waistY - 3} ${c.waistR + 1} ${c.waistY + 4}" stroke="#224f3a" stroke-width="6" fill="none"/>
        <rect x="${c.waistL + 16}" y="${c.waistY + 1}" width="9" height="9" rx="2" fill="#d9b15f"/>
        <rect x="${c.waistR - 25}" y="${c.waistY + 1}" width="9" height="9" rx="2" fill="#d9b15f"/>
        <path d="M160 ${c.waistY + 2} L160 ${c.hipY + 12}" stroke="#1d4d3a" stroke-width="2" opacity=".65"/>
        <path d="M${c.legs[0].x1 - 8} ${c.hipY + 18} L${c.legs[0].x1 - 7} ${c.hipY + 34} M${c.legs[1].x1 + 8} ${c.hipY + 18} L${c.legs[1].x1 + 7} ${c.hipY + 34}" stroke="#d9b15f" stroke-width="2" opacity=".7"/>
      `;
    }
  },
  {
    id: 'snow-skirt',
    name: '눈꽃 튤 스커트',
    tag: '스커트',
    cat: 'bottom',
    slot: 'bottom',
    who: 'female',
    render(c) {
      const hem = 422;
      const topY = c.hipY - 42;
      return `
        ${skirtShape(c, '#eaf5ff', { hem, flare: 31 })}
        <path d="M${c.hipL + 2} ${topY + 20} L${c.hipL - 24} ${hem - 4} Q160 ${hem + 20} ${c.hipR + 24} ${hem - 4} L${c.hipR - 2} ${topY + 20} Q160 ${hem + 18} ${c.hipL + 2} ${topY + 20} Z" fill="#cfe7fa" opacity=".55"/>
        <path d="M${c.hipL - 18} ${hem + 2} Q160 ${hem + 22} ${c.hipR + 18} ${hem + 2}" stroke="#ffffff" stroke-width="10" fill="none" stroke-linecap="round" opacity=".9"/>
        <path d="M${c.hipL} ${topY} Q160 ${topY - 11} ${c.hipR} ${topY}" stroke="#7faecf" stroke-width="9" fill="none" stroke-linecap="round"/>
        <path d="M160 ${topY + 1} L160 ${topY + 18}" stroke="#7faecf" stroke-width="2.4"/>
        ${starShape(160, topY + 28, 7, '#f4cd6c')}
        ${snowflake(144, 380, 8, '#ffffff', 1.5)}
        ${snowflake(178, 392, 10, '#ffffff', 1.6)}
        ${snowflake(151, 407, 6, '#ffffff', 1.3)}
        <g fill="#b9dcf3">
          <circle cx="133" cy="362" r="2.4"/><circle cx="187" cy="356" r="2"/><circle cx="180" cy="414" r="2.2"/>
        </g>
      `;
    }
  },
  {
    id: 'candy-leggings',
    name: '캔디 레깅스',
    tag: '레깅스',
    cat: 'bottom',
    slot: 'bottom',
    who: 'female',
    render(c) {
      let bands = '';
      const half = (c.legWidth + 8) / 2 - 1.5;
      c.legs.forEach((l) => {
        for (let i = 1; i < 11; i += 1) {
          const t = 0.08 + (i / 12);
          const x = l.x1 + (l.x2 - l.x1) * t;
          const y = l.y1 + (l.y2 - l.y1) * t;
          bands += `<path d="M${x - half} ${y} L${x + half} ${y}" stroke="#c93434" stroke-width="6.5" stroke-linecap="butt"/>`;
        }
      });
      return `
        ${pantsLegs(c, '#f3ecdd')}
        ${bands}
        ${pantsHip(c, '#f3ecdd')}
        <path d="M${c.waistL - 1} ${c.waistY + 4} Q160 ${c.waistY - 3} ${c.waistR + 1} ${c.waistY + 4}" stroke="#c93434" stroke-width="7" fill="none"/>
        <path d="M160 ${c.waistY + 2} L160 ${c.hipY + 12}" stroke="#d8cbb5" stroke-width="2" opacity=".8"/>
        <circle cx="160" cy="${c.waistY + 14}" r="2.6" fill="#c93434"/>
      `;
    }
  },
  {
    id: 'knit-skirt',
    name: '케이블 니트 스커트',
    tag: '스커트',
    cat: 'bottom',
    slot: 'bottom',
    who: 'female',
    render(c) {
      const hem = 410;
      const topY = c.hipY - 42;
      return `
        ${skirtShape(c, '#e9dfc8', { hem, flare: 18 })}
        <path d="M${c.hipL} ${topY} Q160 ${topY - 11} ${c.hipR} ${topY}" stroke="#d7c8a9" stroke-width="10" fill="none" stroke-linecap="round"/>
        <path d="M${c.hipL - 14} ${hem - 2} Q160 ${hem + 14} ${c.hipR + 14} ${hem - 2}" stroke="#d7c8a9" stroke-width="8" fill="none" stroke-linecap="round"/>
        <path d="M149 324 Q156 346 149 368 Q143 386 149 400 M160 319 Q168 344 161 368 Q155 390 161 404 M171 324 Q178 346 171 368 Q165 386 171 400" stroke="#d1c09e" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        <path d="M138 330 Q160 342 182 330" stroke="#f7f0e0" stroke-width="1.5" fill="none" opacity=".8"/>
        <path d="M140 ${hem - 8} V${hem + 2} M147 ${hem - 7} V${hem + 4} M154 ${hem - 7} V${hem + 5} M166 ${hem - 7} V${hem + 5} M173 ${hem - 7} V${hem + 4} M180 ${hem - 8} V${hem + 2}" stroke="#d7c8a9" stroke-width="1.3" opacity=".65"/>
      `;
    }
  },
  {
    id: 'velvet-skirt',
    name: '벨벳 미니 스커트',
    tag: '스커트',
    cat: 'bottom',
    slot: 'bottom',
    who: 'female',
    render(c) {
      const hem = 406;
      const topY = c.hipY - 42;
      return `
        ${skirtShape(c, '#8b2130', { hem, flare: 24 })}
        <path d="M${c.hipL + 4} ${topY + 12} Q160 ${topY + 26} ${c.hipR - 4} ${topY + 12}" stroke="#bd4356" stroke-width="5" fill="none" opacity=".4"/>
        <path d="M${c.hipL} ${topY} Q160 ${topY - 11} ${c.hipR} ${topY}" stroke="#661522" stroke-width="9" fill="none" stroke-linecap="round"/>
        <path d="M${c.hipL - 17} ${hem - 2} Q160 ${hem + 15} ${c.hipR + 17} ${hem - 2}" stroke="#f7edda" stroke-width="9" fill="none" stroke-linecap="round"/>
        <path d="M151 ${topY + 8} L146 ${hem - 4} M169 ${topY + 8} L174 ${hem - 4}" stroke="#5c111d" stroke-width="4" opacity=".25"/>
        <path d="M160 ${topY + 1} C152 ${topY + 10} 146 ${topY + 8} 148 ${topY + 16} C154 ${topY + 15} 158 ${topY + 10} 160 ${topY + 7} C162 ${topY + 10} 166 ${topY + 15} 172 ${topY + 16} C174 ${topY + 8} 168 ${topY + 10} 160 ${topY + 1} Z" fill="#e6b55f"/>
        <circle cx="160" cy="${topY + 7}" r="2.5" fill="#a87c2f"/>
      `;
    }
  },
  {
    id: 'santa-joggers',
    name: '산타 조거 팬츠',
    tag: '조거 팬츠',
    cat: 'bottom',
    slot: 'bottom',
    who: 'male',
    render(c) {
      return `
        ${pantsLegs(c, '#303038', { trim: '#43434d' })}
        ${pantsHip(c, '#303038')}
        <path d="M${c.waistL - 1} ${c.waistY + 4} Q160 ${c.waistY - 3} ${c.waistR + 1} ${c.waistY + 4}" stroke="#c43b36" stroke-width="6" fill="none"/>
        <path d="M${c.legs[0].x1 - 10} ${c.hipY + 18} L${c.legs[0].x2 - 8} ${c.legs[0].y2 - 16}" stroke="#c43b36" stroke-width="4" opacity=".85"/>
        <path d="M${c.legs[1].x1 + 10} ${c.hipY + 18} L${c.legs[1].x2 + 8} ${c.legs[1].y2 - 16}" stroke="#c43b36" stroke-width="4" opacity=".85"/>
        <path d="M160 ${c.waistY + 2} L160 ${c.hipY + 12}" stroke="#1f1f25" stroke-width="2" opacity=".8"/>
        <path d="M154 ${c.waistY + 8} Q150 ${c.waistY + 22} 152 ${c.waistY + 30} M166 ${c.waistY + 8} Q170 ${c.waistY + 22} 168 ${c.waistY + 30}" stroke="#f4e8d2" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <circle cx="152" cy="${c.waistY + 32}" r="2.4" fill="#f4e8d2"/>
        <circle cx="168" cy="${c.waistY + 32}" r="2.4" fill="#f4e8d2"/>
      `;
    }
  },
  {
    id: 'wool-slacks',
    name: '울 슬랙스',
    tag: '슬랙스',
    cat: 'bottom',
    slot: 'bottom',
    who: 'male',
    render(c) {
      return `
        ${pantsLegs(c, '#6d5a4f', { trim: '#5b4a41' })}
        ${pantsHip(c, '#6d5a4f')}
        <path d="M${c.waistL - 1} ${c.waistY + 4} Q160 ${c.waistY - 3} ${c.waistR + 1} ${c.waistY + 4}" stroke="#4e3e36" stroke-width="6" fill="none"/>
        <path d="M160 ${c.waistY + 2} L160 ${c.hipY + 12}" stroke="#4e3e36" stroke-width="2" opacity=".65"/>
        <path d="M${c.legs[0].x1 - 2} ${c.hipY + 12} L${c.legs[0].x2 - 2} ${c.legs[0].y2 - 12} M${c.legs[1].x1 + 2} ${c.hipY + 12} L${c.legs[1].x2 + 2} ${c.legs[1].y2 - 12}" stroke="#8a7464" stroke-width="2" opacity=".65"/>
        <path d="M${c.waistL + 16} ${c.waistY + 1} V${c.waistY + 12} M${c.waistR - 22} ${c.waistY + 1} V${c.waistY + 12}" stroke="#4e3e36" stroke-width="3" opacity=".65"/>
        <rect x="${c.waistL + 19}" y="${c.waistY + 3}" width="8" height="7" rx="1.5" fill="#c7a15b"/>
        <path d="M${c.legs[0].x2 - 8} ${c.legs[0].y2 - 16} H${c.legs[0].x2 + 9} M${c.legs[1].x2 - 9} ${c.legs[1].y2 - 16} H${c.legs[1].x2 + 8}" stroke="#4e3e36" stroke-width="2" opacity=".7"/>
      `;
    }
  }
];
