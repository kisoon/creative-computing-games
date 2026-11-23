/* Christmas accessories */

const ACCESSORY_ITEMS = [
  {
    id: 'santa-hat',
    name: '산타 모자',
    tag: '모자',
    cat: 'acc',
    slot: 'hat',
    render(c) {
      const cx = c.headCx;
      const topY = c.headCy - c.headRy;
      const left = c.headCx - c.headRx;
      const right = c.headCx + c.headRx;
      return `
        <path d="M${left + 7} ${topY + 19} C${left + 20} ${topY - 38} ${cx + 22} ${topY - 58} ${cx + 34} ${topY - 40} C${cx + 40} ${topY - 31} ${cx + 33} ${topY - 22} ${cx + 23} ${topY - 17} C${cx + 10} ${topY - 30} ${cx + 2} ${topY - 7} ${right - 3} ${topY + 19} Z" fill="#c22f2c"/>
        <path d="M${left + 14} ${topY + 12} C${left + 26} ${topY - 16} ${cx + 14} ${topY - 40} ${cx + 15} ${topY - 34}" stroke="#8f1f1e" stroke-width="2.5" fill="none" opacity=".55" stroke-linecap="round"/>
        <path d="M${left - 2} ${topY + 12} Q160 ${topY} ${right + 2} ${topY + 12} Q${right + 6} ${topY + 30} ${right - 3} ${topY + 32} Q160 ${topY + 18} ${left + 3} ${topY + 32} Q${left - 6} ${topY + 30} ${left - 2} ${topY + 12} Z" fill="#f8f0df"/>
        <path d="M${left + 4} ${topY + 23} Q160 ${topY + 10} ${right - 4} ${topY + 23}" stroke="#ded2bb" stroke-width="2" fill="none" opacity=".8"/>
        <circle cx="${cx + 34}" cy="${topY - 42}" r="10" fill="#f8f0df"/>
        <circle cx="${cx + 31}" cy="${topY - 45}" r="3.5" fill="#ffffff" opacity=".65"/>
      `;
    }
  },
  {
    id: 'antlers',
    name: '루돌프 뿔',
    tag: '모자',
    cat: 'acc',
    slot: 'hat',
    render(c) {
      const cx = c.headCx;
      const topY = c.headCy - c.headRy;
      const branch = (x) => `
        <path d="M${x} ${topY + 24} C${x + (x < cx ? -10 : 10)} ${topY - 2} ${x + (x < cx ? -14 : 14)} ${topY - 24} ${x + (x < cx ? -25 : 25)} ${topY - 39}"
          stroke="#7c5136" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M${x + (x < cx ? -10 : 10)} ${topY - 10} L${x + (x < cx ? -29 : 29)} ${topY - 20}"
          stroke="#7c5136" stroke-width="5.5" fill="none" stroke-linecap="round"/>
        <path d="M${x + (x < cx ? -15 : 15)} ${topY - 25} L${x + (x < cx ? -31 : 31)} ${topY - 33}"
          stroke="#7c5136" stroke-width="5" fill="none" stroke-linecap="round"/>
        <path d="M${x} ${topY + 22} C${x + (x < cx ? -6 : 6)} ${topY + 2} ${x + (x < cx ? -9 : 9)} ${topY - 18} ${x + (x < cx ? -16 : 16)} ${topY - 30}"
          stroke="#956746" stroke-width="2" fill="none" opacity=".65" stroke-linecap="round"/>
      `;
      return `
        <path d="M${cx - 25} ${topY + 31} Q160 ${topY + 18} ${cx + 25} ${topY + 31}" stroke="#3f7358" stroke-width="5.5" fill="none" stroke-linecap="round"/>
        ${branch(cx - 24)}
        ${branch(cx + 24)}
      `;
    }
  },
  {
    id: 'earmuffs',
    name: '겨울 귀마개',
    tag: '모자',
    cat: 'acc',
    slot: 'hat',
    render(c) {
      const cx = c.headCx;
      const topY = c.headCy - c.headRy;
      const left = c.headCx - c.headRx;
      const right = c.headCx + c.headRx;
      return `
        <path d="M${left + 9} ${topY + 45} Q${left + 10} ${topY + 2} 160 ${topY + 2} Q${right - 10} ${topY + 2} ${right - 9} ${topY + 45}"
          stroke="#e9dfca" stroke-width="8" fill="none" stroke-linecap="round"/>
        <path d="M${left + 9} ${topY + 40} Q${left + 10} ${topY + 7} 160 ${topY + 7} Q${right - 10} ${topY + 7} ${right - 9} ${topY + 40}"
          stroke="#ce4139" stroke-width="4" fill="none" stroke-linecap="round"/>
        <circle cx="${left + 3}" cy="${topY + 50}" r="17" fill="#f4ecdb"/>
        <circle cx="${right - 3}" cy="${topY + 50}" r="17" fill="#f4ecdb"/>
        <circle cx="${left + 3}" cy="${topY + 50}" r="10.5" fill="#cf3b34"/>
        <circle cx="${right - 3}" cy="${topY + 50}" r="10.5" fill="#cf3b34"/>
        <path d="M${left - 4} ${topY + 44} Q${left + 3} ${topY + 38} ${left + 10} ${topY + 44}" stroke="#ffffff" stroke-width="2.4" fill="none" opacity=".65" stroke-linecap="round"/>
        <path d="M${right - 10} ${topY + 44} Q${right - 3} ${topY + 38} ${right + 4} ${topY + 44}" stroke="#ffffff" stroke-width="2.4" fill="none" opacity=".65" stroke-linecap="round"/>
      `;
    }
  },
  {
    id: 'scarf',
    name: '빨간 목도리',
    tag: '목도리',
    cat: 'acc',
    slot: 'neck',
    render(c) {
      const y = c.headCy + c.headRy + 2;
      return `
        <path d="M142 ${y + 16} C135 ${y + 45} 131 ${y + 72} 133 ${y + 92} Q144 ${y + 98} 154 ${y + 92} C154 ${y + 68} 156 ${y + 42} 160 ${y + 20} Z" fill="#cd3838"/>
        <path d="M136 ${y + 40} L153 ${y + 45} M134 ${y + 60} L154 ${y + 64} M133 ${y + 78} L154 ${y + 82}" stroke="#f3e5cd" stroke-width="4" opacity=".85"/>
        <path d="M134 ${y + 92} L133 ${y + 100} M140 ${y + 94} L139 ${y + 102} M146 ${y + 94} L146 ${y + 102} M152 ${y + 92} L153 ${y + 100}" stroke="#cd3838" stroke-width="3" stroke-linecap="round"/>
        <rect x="${c.headCx - 29}" y="${y}" width="58" height="23" rx="11.5" fill="#dc4343"/>
        <path d="M${c.headCx - 22} ${y + 2} L${c.headCx - 24} ${y + 21} M${c.headCx - 8} ${y + 1} L${c.headCx - 9} ${y + 22} M${c.headCx + 7} ${y + 1} L${c.headCx + 7} ${y + 22} M${c.headCx + 21} ${y + 2} L${c.headCx + 23} ${y + 21}" stroke="#b02a2a" stroke-width="2" opacity=".45"/>
        <path d="M${c.headCx - 24} ${y + 19} Q160 ${y + 29} ${c.headCx + 24} ${y + 19}" stroke="#ad2b2b" stroke-width="3" fill="none" opacity=".5"/>
        <circle cx="${c.headCx + 17}" cy="${y + 30}" r="3.2" fill="#f3e5cd"/>
      `;
    }
  }
];
