/* Christmas tops */

const TOP_ITEMS = [
  {
    id: 'sweater',
    name: '스노우 스웨터',
    tag: '니트',
    cat: 'top',
    slot: 'top',
    render(c) {
      const hem = c.hipY - 9;
      return `
        ${sleeveLayer(c, '#c23a32', { trim: '#f6ead4', width: 10 })}
        <path d="${scoopTopPath(c, { grow: 3, hemY: hem, neck: 28 })}" fill="#c23a32"/>
        <path d="M${c.hipL - 3} ${hem} Q160 ${hem + 12} ${c.hipR + 3} ${hem}" stroke="#f6ead4" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M${c.waistL - 1} ${c.waistY + 2} L${c.hipL - 2} ${hem - 2} M${c.waistR + 1} ${c.waistY + 2} L${c.hipR + 2} ${hem - 2}" stroke="#9e2a24" stroke-width="2" opacity=".45"/>
        <path d="M149 ${c.shoulderY + 25} Q160 ${c.shoulderY + 39} 171 ${c.shoulderY + 25}" stroke="#f6ead4" stroke-width="7" fill="none" stroke-linecap="round"/>
        ${snowflake(160, 259, 16, '#f8f1de', 2)}
        ${snowflake(136, 292, 8, '#f8f1de', 1.4)}
        ${snowflake(184, 289, 7, '#f8f1de', 1.3)}
        <circle cx="160" cy="259" r="2.4" fill="#f8f1de"/>
      `;
    }
  },
  {
    id: 'santa-coat',
    name: '산타 코트',
    tag: '코트',
    cat: 'top',
    slot: 'top',
    render(c) {
      const { shoulderL: sl, shoulderR: sr, shoulderY: sy, waistL: wl, waistR: wr, waistY: wy } = c;
      const hem = 408;
      const d = `M${sl} ${sy} C${sl + 13} ${sy + 8} 146 ${sy + 12} 149 ${sy + 30} `
        + `Q160 ${sy + 42} 171 ${sy + 30} C174 ${sy + 12} ${sr - 13} ${sy + 8} ${sr} ${sy} `
        + `L${wr + 5} ${wy + 4} L${c.hipR + 15} ${hem} L160 ${hem - 26} L${c.hipL - 15} ${hem} L${wl - 5} ${wy + 4} Z`;
      return `
        ${sleeveLayer(c, '#b62b2b', { trim: '#f7efe1', width: 10 })}
        <path d="${d}" fill="#b62b2b"/>
        <path d="${d}" fill="url(#coatShade)"/>
        <path d="M160 ${sy + 38} L160 ${hem - 27}" stroke="#f7efe1" stroke-width="8" fill="none" stroke-linecap="round"/>
        <path d="M${c.hipL - 15} ${hem - 1} L160 ${hem - 27} L${c.hipR + 15} ${hem - 1}" stroke="#f7efe1" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M${sl + 6} ${sy + 3} Q${sl + 21} ${sy + 23} 146 ${sy + 31} Q160 ${sy + 45} 174 ${sy + 31} Q${sr - 21} ${sy + 23} ${sr - 6} ${sy + 3}" stroke="#f7efe1" stroke-width="11" fill="none" stroke-linecap="round"/>
        <rect x="${wl - 3}" y="${wy - 15}" width="${wr - wl + 6}" height="20" rx="4" fill="#2c2225"/>
        <rect x="153" y="${wy - 16}" width="14" height="22" rx="3" fill="#e7bd5f"/>
        <rect x="156.5" y="${wy - 12}" width="7" height="14" rx="1.5" fill="#a87c2f"/>
        <circle cx="160" cy="250" r="3.6" fill="#e7bd5f"/>
        <circle cx="160" cy="276" r="3.6" fill="#e7bd5f"/>
        <path d="M${c.hipR + 2} ${wy + 20} L${c.hipR + 10} ${hem - 12}" stroke="#871e1e" stroke-width="2" opacity=".5"/>
        <path d="M${c.hipL - 2} ${wy + 20} L${c.hipL - 10} ${hem - 12}" stroke="#871e1e" stroke-width="2" opacity=".5"/>
      `;
    }
  },
  {
    id: 'tree-knit',
    name: '트리 니트',
    tag: '니트',
    cat: 'top',
    slot: 'top',
    render(c) {
      const hem = c.hipY - 10;
      return `
        ${sleeveLayer(c, '#226b50', { trim: '#efe2c4', width: 10 })}
        <path d="${scoopTopPath(c, { grow: 3, hemY: hem, neck: 28 })}" fill="#226b50"/>
        <path d="M${c.hipL - 2} ${hem} Q160 ${hem + 12} ${c.hipR + 2} ${hem}" stroke="#efe2c4" stroke-width="6" fill="none" stroke-linecap="round"/>
        <path d="M149 ${c.shoulderY + 25} Q160 ${c.shoulderY + 39} 171 ${c.shoulderY + 25}" stroke="#efe2c4" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M160 231 L146 254 H174 Z" fill="#f2e5c8"/>
        <path d="M160 247 L140 273 H180 Z" fill="#f2e5c8"/>
        <path d="M160 264 L133 296 H187 Z" fill="#f2e5c8"/>
        <rect x="156" y="296" width="8" height="9" rx="2" fill="#c99a55"/>
        ${starShape(160, 226, 6.5, '#f2c85d')}
        <circle cx="151" cy="269" r="2.8" fill="#c8463f"/>
        <circle cx="170" cy="279" r="2.6" fill="#dfb34e"/>
        <circle cx="158" cy="288" r="2.4" fill="#c8463f"/>
        <path d="M148 ${hem - 12} l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6" stroke="#efe2c4" stroke-width="2" fill="none" opacity=".7"/>
      `;
    }
  },
  {
    id: 'reindeer-hoodie',
    name: '루돌프 후디',
    tag: '후디',
    cat: 'top',
    slot: 'top',
    render(c) {
      const hem = c.hipY - 12;
      const sy = c.shoulderY;
      const wy = c.waistY;
      return `
        ${sleeveLayer(c, '#6d4636', { trim: '#f0dfc6', width: 11 })}
        <path d="${scoopTopPath(c, { grow: 4, hemY: hem, neck: 26 })}" fill="#6d4636"/>
        <path d="M${c.waistL} ${hem - 2} Q160 ${hem + 11} ${c.waistR} ${hem - 2}" stroke="#59382b" stroke-width="7" fill="none"/>
        <path d="M132 ${sy + 5} Q160 ${sy + 38} 188 ${sy + 5} Q193 ${sy + 28} 176 ${sy + 40} Q160 ${sy + 49} 144 ${sy + 40} Q127 ${sy + 28} 132 ${sy + 5} Z" fill="#5a382b"/>
        <path d="M153 ${sy + 36} L151 ${sy + 64}" stroke="#f0dfc6" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M167 ${sy + 36} L169 ${sy + 64}" stroke="#f0dfc6" stroke-width="2.6" stroke-linecap="round"/>
        <circle cx="151" cy="${sy + 67}" r="3" fill="#f0dfc6"/>
        <circle cx="169" cy="${sy + 67}" r="3" fill="#f0dfc6"/>
        <path d="M142 ${wy + 4} Q160 ${wy + 26} 178 ${wy + 4}" stroke="#f0dfc6" stroke-width="2.4" fill="none" opacity=".55"/>
        <g transform="translate(0 2)">
          <path d="M152 252 C146 242 140 242 139 234 M168 252 C174 242 180 242 181 234" stroke="#f0dfc6" stroke-width="2.4" fill="none" stroke-linecap="round"/>
          <path d="M146 246 L137 243 M150 240 L144 233 M174 246 L183 243 M170 240 L176 233" stroke="#f0dfc6" stroke-width="2.2" stroke-linecap="round"/>
          <ellipse cx="160" cy="264" rx="17" ry="15" fill="#f5e8d2"/>
          <ellipse cx="152" cy="266" rx="5" ry="7" fill="#e6d2b4" transform="rotate(-18 152 266)"/>
          <ellipse cx="168" cy="266" rx="5" ry="7" fill="#e6d2b4" transform="rotate(18 168 266)"/>
          <circle cx="154.5" cy="261" r="1.9" fill="#4c3327"/>
          <circle cx="165.5" cy="261" r="1.9" fill="#4c3327"/>
          <circle cx="160" cy="270" r="4.2" fill="#c9493f"/>
          <circle cx="158.8" cy="268.6" r="1.2" fill="#ffb9ac" opacity=".8"/>
        </g>
        <path d="M149 ${hem - 1} l5 5 l5 -5 l5 5 l5 -5 l5 5 l5 -5 l5 5" stroke="#f0dfc6" stroke-width="2" fill="none" opacity=".6"/>
      `;
    }
  },
  {
    id: 'snowman-sweater',
    name: '눈사람 스웨터',
    tag: '니트',
    cat: 'top',
    slot: 'top',
    who: 'female',
    render(c) {
      const hem = c.hipY - 9;
      const body = scoopTopPath(c, { grow: 3, hemY: hem, neck: 28 });
      return `
        ${sleeveLayer(c, '#f1ebdd', { trim: '#88b0d2', width: 10 })}
        <path d="${body}" fill="#f1ebdd"/>
        <path d="${body}" fill="url(#fabricDots)"/>
        <path d="M${c.hipL - 2} ${hem} Q160 ${hem + 12} ${c.hipR + 2} ${hem}" stroke="#88b0d2" stroke-width="6" fill="none" stroke-linecap="round"/>
        <path d="M149 ${c.shoulderY + 25} Q160 ${c.shoulderY + 39} 171 ${c.shoulderY + 25}" stroke="#88b0d2" stroke-width="6" fill="none" stroke-linecap="round"/>
        <g>
          <circle cx="160" cy="240" r="13" fill="#fbfdff" stroke="#a9c8de" stroke-width="1.6"/>
          <circle cx="160" cy="270" r="18" fill="#fbfdff" stroke="#a9c8de" stroke-width="1.6"/>
          <circle cx="160" cy="296" r="12" fill="#fbfdff" stroke="#a9c8de" stroke-width="1.6"/>
          <circle cx="155" cy="238" r="1.9" fill="#3c4b58"/>
          <circle cx="165" cy="238" r="1.9" fill="#3c4b58"/>
          <path d="M160 242 L168 245 L160 247 Z" fill="#e08a45"/>
          <path d="M152 249 Q160 255 168 249" stroke="#c85348" stroke-width="3.6" fill="none" stroke-linecap="round"/>
          <path d="M168 250 L175 258 L169 259 Z" fill="#c85348"/>
          <circle cx="160" cy="264" r="1.8" fill="#8fa8ba"/>
          <circle cx="160" cy="274" r="1.8" fill="#8fa8ba"/>
          <path d="M149 257 C142 251 140 247 142 242 M171 257 C178 251 180 247 178 242" stroke="#88b0d2" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        </g>
        <g fill="#b6d3e7" opacity=".85">
          <circle cx="137" cy="238" r="2.4"/><circle cx="183" cy="248" r="2" />
          <circle cx="141" cy="292" r="2.1"/><circle cx="181" cy="303" r="2.5"/>
          <circle cx="134" cy="268" r="1.5"/><circle cx="187" cy="276" r="1.5"/>
        </g>
      `;
    }
  },
  {
    id: 'cable-knit',
    name: '케이블 크롭 니트',
    tag: '크롭 니트',
    cat: 'top',
    slot: 'top',
    who: 'female',
    render(c) {
      const hem = c.waistY + 16;
      return `
        ${sleeveLayer(c, '#efe4ce', { trim: '#e0d1b5', width: 10 })}
        <path d="${scoopTopPath(c, { grow: 2, hemY: hem, neck: 31 })}" fill="#efe4ce"/>
        <path d="M149 ${c.shoulderY + 27} Q160 ${c.shoulderY + 42} 171 ${c.shoulderY + 27}" stroke="#e0d1b5" stroke-width="5" fill="none" stroke-linecap="round"/>
        <path d="M${c.hipL - 1} ${hem} Q160 ${hem + 11} ${c.hipR + 1} ${hem}" stroke="#dbc9aa" stroke-width="7" fill="none"/>
        <path d="M146 234 Q153 250 147 266 Q141 282 147 296 Q153 308 148 316" stroke="#dcc9aa" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <path d="M160 231 Q167 249 161 267 Q155 285 161 301 Q167 312 162 318" stroke="#dcc9aa" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <path d="M174 234 Q181 250 175 266 Q169 282 175 296 Q181 308 176 316" stroke="#dcc9aa" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <path d="M139 248 Q160 258 181 248 M139 280 Q160 290 181 280" stroke="#faf4e8" stroke-width="1.6" fill="none" opacity=".8"/>
        <path d="M160 262 l5 9 -5 4 -5 -4 Z" fill="#c84944"/>
        <circle cx="160" cy="259" r="2.2" fill="#c84944"/>
      `;
    }
  },
  {
    id: 'santa-cape',
    name: '산타 케이프',
    tag: '케이프',
    cat: 'top',
    slot: 'top',
    who: 'female',
    render(c) {
      const { shoulderL: sl, shoulderR: sr, shoulderY: sy } = c;
      const hem = c.hipY + 28;
      const d = `M${sl} ${sy} C${sl + 15} ${sy + 9} 146 ${sy + 14} 150 ${sy + 32} `
        + `Q160 ${sy + 43} 170 ${sy + 32} C174 ${sy + 14} ${sr - 15} ${sy + 9} ${sr} ${sy} `
        + `L${c.hipR + 15} ${hem} Q160 ${hem + 18} ${c.hipL - 15} ${hem} Z`;
      return `
        ${sleeveLayer(c, '#b72b2b', { trim: '#f8f0df', width: 10 })}
        <path d="${d}" fill="#b72b2b"/>
        <path d="${d}" fill="url(#coatShade)"/>
        <path d="M${c.hipL - 15} ${hem} Q160 ${hem + 18} ${c.hipR + 15} ${hem}" stroke="#f8f0df" stroke-width="9" fill="none" stroke-linecap="round"/>
        <path d="M160 ${sy + 40} L160 ${hem + 5}" stroke="#f8f0df" stroke-width="2" opacity=".55" stroke-dasharray="4 5"/>
        <path d="M${sl + 7} ${sy + 3} Q${sl + 22} ${sy + 24} 147 ${sy + 33} Q160 ${sy + 46} 173 ${sy + 33} Q${sr - 22} ${sy + 24} ${sr - 7} ${sy + 3}" stroke="#f8f0df" stroke-width="12" fill="none" stroke-linecap="round"/>
        <circle cx="160" cy="${sy + 43}" r="5" fill="#e7bd5f"/>
        <circle cx="${c.hipL + 3}" cy="${hem - 12}" r="3" fill="#e7bd5f"/>
        <circle cx="${c.hipR - 3}" cy="${hem - 12}" r="3" fill="#e7bd5f"/>
      `;
    }
  },
  {
    id: 'nordic-sweater',
    name: '노르딕 스웨터',
    tag: '니트',
    cat: 'top',
    slot: 'top',
    who: 'male',
    render(c) {
      const hem = c.hipY - 6;
      return `
        ${sleeveLayer(c, '#263d63', { trim: '#e9dfc9', width: 11 })}
        <path d="${scoopTopPath(c, { grow: 4, hemY: hem, neck: 25 })}" fill="#263d63"/>
        <path d="M134 ${c.shoulderY + 42} Q160 ${c.shoulderY + 58} 186 ${c.shoulderY + 42}" stroke="#e9dfc9" stroke-width="9" fill="none" opacity=".92"/>
        <path d="M136 ${c.shoulderY + 52} Q160 ${c.shoulderY + 66} 184 ${c.shoulderY + 52}" stroke="#bf4a45" stroke-width="4" fill="none"/>
        <path d="M137 ${c.shoulderY + 44} l5 7 5 -7 5 7 5 -7 5 7 5 -7 5 7 5 -7 5 7 5 -7 5 7 5 -7" stroke="#263d63" stroke-width="2.4" fill="none"/>
        ${snowflake(148, 276, 10, '#e9dfc9', 1.8)}
        ${snowflake(171, 294, 7, '#e9dfc9', 1.5)}
        ${snowflake(153, 307, 5.5, '#c9d9ef', 1.2)}
        <rect x="148" y="${c.shoulderY + 17}" width="24" height="17" rx="8" fill="#e9dfc9"/>
        <path d="M${c.hipL - 2} ${hem} Q160 ${hem + 12} ${c.hipR + 2} ${hem}" stroke="#e9dfc9" stroke-width="6" fill="none"/>
        <path d="M${c.waistL} ${hem - 7} L${c.waistL} ${hem - 1} M${c.waistL + 6} ${hem - 6} L${c.waistL + 6} ${hem + 1} M${c.waistR} ${hem - 7} L${c.waistR} ${hem - 1} M${c.waistR - 6} ${hem - 6} L${c.waistR - 6} ${hem + 1}" stroke="#e9dfc9" stroke-width="1.5" opacity=".6"/>
      `;
    }
  },
  {
    id: 'santa-shirt',
    name: '산타 셔츠',
    tag: '셔츠',
    cat: 'top',
    slot: 'top',
    who: 'male',
    render(c) {
      const sy = c.shoulderY;
      return `
        ${sleeveLayer(c, '#bd3430', { trim: '#f2e6d1', short: true, width: 10 })}
        <path d="${scoopTopPath(c, { grow: 2, hemY: c.hipY - 2, neck: 24 })}" fill="#bd3430"/>
        <path d="M160 ${sy + 34} L160 ${c.hipY + 4}" stroke="#9b2523" stroke-width="2" opacity=".65"/>
        <path d="M150 ${sy + 26} L160 ${sy + 38} L170 ${sy + 26} L164 ${sy + 21} L160 ${sy + 29} L156 ${sy + 21} Z" fill="#f7efe0"/>
        <circle cx="160" cy="${sy + 55}" r="2.4" fill="#f7efe0"/>
        <circle cx="160" cy="${sy + 72}" r="2.4" fill="#f7efe0"/>
        <circle cx="160" cy="${sy + 89}" r="2.4" fill="#f7efe0"/>
        <path d="M149 ${sy + 42} C142 ${sy + 70} 145 ${c.waistY} 148 ${c.waistY + 10} M171 ${sy + 42} C178 ${sy + 70} 175 ${c.waistY} 172 ${c.waistY + 10}" stroke="#2c2426" stroke-width="7" fill="none" stroke-linecap="round"/>
        <rect x="143" y="${c.waistY + 4}" width="10" height="9" rx="2" fill="#d8b260"/>
        <rect x="167" y="${c.waistY + 4}" width="10" height="9" rx="2" fill="#d8b260"/>
        <path d="M152 ${sy + 37} Q160 ${sy + 44} 168 ${sy + 37} L164 ${sy + 52} L160 ${sy + 45} L156 ${sy + 52} Z" fill="#2d7457"/>
        <circle cx="160" cy="${sy + 42}" r="3" fill="#215842"/>
      `;
    }
  },
  {
    id: 'forest-turtleneck',
    name: '포레스트 터틀넥',
    tag: '터틀넥',
    cat: 'top',
    slot: 'top',
    who: 'male',
    render(c) {
      const hem = c.hipY - 8;
      return `
        ${sleeveLayer(c, '#2d5b48', { trim: '#d6c8a8', width: 11 })}
        <path d="${scoopTopPath(c, { grow: 3, hemY: hem, neck: 25 })}" fill="#2d5b48"/>
        <path d="M${c.hipL - 2} ${hem} Q160 ${hem + 12} ${c.hipR + 2} ${hem}" stroke="#224737" stroke-width="7" fill="none"/>
        <rect x="145" y="${c.shoulderY + 15}" width="30" height="22" rx="10" fill="#2d5b48"/>
        <path d="M147 ${c.shoulderY + 21} H173 M147 ${c.shoulderY + 27} H173" stroke="#4a8067" stroke-width="2" opacity=".8"/>
        <path d="M152 278 L160 262 L168 278 Z" fill="#d6c8a8"/>
        <rect x="157" y="277" width="6" height="7" fill="#b6a47d"/>
        <path d="M147 289 Q160 299 173 289" stroke="#d6c8a8" stroke-width="1.6" fill="none" opacity=".55"/>
        <path d="M143 ${c.waistY + 3} V${hem - 4} M149 ${c.waistY + 2} V${hem - 3} M155 ${c.waistY + 2} V${hem - 3} M165 ${c.waistY + 2} V${hem - 3} M171 ${c.waistY + 2} V${hem - 3} M177 ${c.waistY + 3} V${hem - 4}" stroke="#224737" stroke-width="1.4" opacity=".4"/>
      `;
    }
  }
];
