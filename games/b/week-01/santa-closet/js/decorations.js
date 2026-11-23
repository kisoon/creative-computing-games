/* Scene decorations */

const DECOR_ITEMS = [
  {
    id: 'wreath',
    name: '크리스마스 화환',
    tag: '벽 장식',
    cat: 'scene',
    slot: 'scene',
    scenes: ['indoor', 'outdoor'],
    decoClass: 'wreath',
    previewView: '0 0 100 100',
    render() {
      let needles = '';
      for (let i = 0; i < 12; i += 1) {
        const a = (i * 30) * Math.PI / 180;
        const x = 50 + Math.cos(a) * 30;
        const y = 50 + Math.sin(a) * 30;
        needles += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="9" ry="5" fill="${i % 2 ? '#2f7a56' : '#245f44'}" transform="rotate(${i * 30} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
      }
      return `<svg viewBox="0 0 100 100" aria-hidden="true">
        ${needles}
        <circle cx="50" cy="50" r="29" fill="none" stroke="#1d523b" stroke-width="16"/>
        <circle cx="50" cy="50" r="29" fill="none" stroke="#347f59" stroke-width="8" stroke-dasharray="3 5"/>
        <circle cx="50" cy="50" r="23" fill="none" stroke="#e8f2e8" stroke-width="2" opacity=".28"/>
        <g fill="#e14a42">
          <circle cx="34" cy="35" r="3.4"/><circle cx="67" cy="40" r="3.2"/><circle cx="62" cy="66" r="3.4"/><circle cx="39" cy="65" r="3"/>
        </g>
        <g fill="#f4cd6b">
          <circle cx="48" cy="26" r="2.4"/><circle cx="28" cy="55" r="2.2"/><circle cx="73" cy="56" r="2.2"/>
        </g>
        <path d="M50 76 C42 69 34 72 39 79 C43 84 48 80 50 77 C52 80 57 84 61 79 C66 72 58 69 50 76 Z" fill="#cf3a3a"/>
        <circle cx="50" cy="77" r="3" fill="#a92a2a"/>
      </svg>`;
    }
  },
  {
    id: 'gift-pile',
    name: '선물 더미',
    tag: '바닥 장식',
    cat: 'scene',
    slot: 'scene',
    scenes: ['indoor', 'outdoor'],
    decoClass: 'gifts',
    previewView: '0 0 150 105',
    render() {
      return `<svg viewBox="0 0 150 105" aria-hidden="true">
        <ellipse cx="78" cy="98" rx="67" ry="8" fill="#071522" opacity=".18"/>
        <rect x="8" y="50" width="54" height="45" rx="4" fill="#c33f3b"/>
        <rect x="8" y="50" width="54" height="12" fill="#a62f2c"/>
        <rect x="31" y="50" width="9" height="45" fill="#f0cd79"/>
        <rect x="8" y="45" width="54" height="9" rx="3" fill="#f0cd79"/>
        <path d="M35 47 C25 37 18 43 28 48 M35 47 C45 37 52 43 42 48" stroke="#f0cd79" stroke-width="4" fill="none"/>
        <rect x="66" y="65" width="44" height="31" rx="3" fill="#2f7658"/>
        <rect x="83" y="65" width="8" height="31" fill="#f6ead0"/>
        <rect x="66" y="73" width="44" height="7" fill="#f6ead0"/>
        <path d="M87 65 C80 55 73 60 82 64 M87 65 C94 55 101 60 92 64" stroke="#f6ead0" stroke-width="3.5" fill="none"/>
        <rect x="103" y="30" width="39" height="64" rx="4" fill="#d8c09a"/>
        <rect x="118" y="30" width="8" height="64" fill="#b54a44"/>
        <rect x="103" y="44" width="39" height="8" fill="#b54a44"/>
        <path d="M122 30 C112 19 105 25 115 29 M122 30 C132 19 139 25 129 29" stroke="#b54a44" stroke-width="3.5" fill="none"/>
        <g fill="#fff" opacity=".7"><circle cx="20" cy="70" r="1.8"/><circle cx="58" cy="86" r="1.6"/><circle cx="98" cy="38" r="1.5"/></g>
      </svg>`;
    }
  },
  {
    id: 'candles',
    name: '촛불 세트',
    tag: '실내 장식',
    cat: 'scene',
    slot: 'scene',
    scenes: ['indoor'],
    decoClass: 'candles',
    previewView: '0 0 90 110',
    render() {
      return `<svg viewBox="0 0 90 110" aria-hidden="true">
        <ellipse cx="45" cy="103" rx="34" ry="6" fill="#0b1720" opacity=".2"/>
        <rect x="22" y="88" width="46" height="12" rx="4" fill="#d8b56b"/>
        <rect x="18" y="96" width="54" height="7" rx="3.5" fill="#b8914b"/>
        <rect x="26" y="54" width="13" height="38" rx="4" fill="#f4e7ca"/>
        <rect x="41" y="42" width="14" height="50" rx="4" fill="#efe0c0"/>
        <rect x="57" y="63" width="12" height="29" rx="4" fill="#f7edd8"/>
        <path d="M32 56 Q34 50 31 47" stroke="#6b4a32" stroke-width="1.5" fill="none"/>
        <path d="M48 44 Q50 37 47 34" stroke="#6b4a32" stroke-width="1.5" fill="none"/>
        <path d="M63 65 Q65 59 62 56" stroke="#6b4a32" stroke-width="1.5" fill="none"/>
        <g class="candle-flames">
          <path d="M32 45 Q27 40 32 34 Q37 40 32 45Z" fill="#ffcf62"/>
          <path d="M48 32 Q43 27 48 20 Q53 27 48 32Z" fill="#ffbf4f"/>
          <path d="M63 54 Q59 49 63 44 Q68 49 63 54Z" fill="#ffd674"/>
        </g>
        <g fill="#f5d27e"><circle cx="30" cy="92" r="2"/><circle cx="45" cy="92" r="2"/><circle cx="60" cy="92" r="2"/></g>
        <path d="M8 88 Q18 76 29 86 Q20 94 8 88Z" fill="#2f7354"/>
        <path d="M80 84 Q70 74 60 86 Q70 92 80 84Z" fill="#2f7354"/>
        <circle cx="17" cy="82" r="2.4" fill="#d44b42"/><circle cx="73" cy="81" r="2.4" fill="#d44b42"/>
      </svg>`;
    }
  },
  {
    id: 'stockings',
    name: '크리스마스 양말',
    tag: '실내 장식',
    cat: 'scene',
    slot: 'scene',
    scenes: ['indoor'],
    decoClass: 'stockings',
    previewView: '0 0 160 110',
    render() {
      return `<svg viewBox="0 0 160 110" aria-hidden="true">
        <path d="M8 12 Q80 32 152 10" stroke="#7c5238" stroke-width="4" fill="none" stroke-linecap="round"/>
        <g transform="translate(23 20)">
          <rect x="15" y="0" width="30" height="50" rx="6" fill="#c43b38"/>
          <path d="M15 44 Q15 65 33 65 Q52 65 52 48 L45 44 Q46 55 33 55 Q23 55 23 43 Z" fill="#c43b38"/>
          <rect x="12" y="0" width="36" height="12" rx="5" fill="#f8f0df"/>
          <path d="M22 20 L38 20 M22 28 L38 28" stroke="#f8f0df" stroke-width="3" opacity=".8"/>
          <circle cx="47" cy="57" r="5" fill="#f8f0df"/>
        </g>
        <g transform="translate(79 26)">
          <rect x="15" y="0" width="30" height="50" rx="6" fill="#2f7658"/>
          <path d="M15 44 Q15 65 33 65 Q52 65 52 48 L45 44 Q46 55 33 55 Q23 55 23 43 Z" fill="#2f7658"/>
          <rect x="12" y="0" width="36" height="12" rx="5" fill="#f8f0df"/>
          <path d="M23 21 l5 5 l5 -5 l5 5 l5 -5" stroke="#f8f0df" stroke-width="2" fill="none"/>
          <circle cx="47" cy="57" r="5" fill="#f8f0df"/>
        </g>
        <g transform="translate(127 18)">
          <rect x="5" y="0" width="24" height="40" rx="5" fill="#d8c09a"/>
          <path d="M5 35 Q5 52 19 52 Q33 52 33 38 L27 35 Q28 44 19 44 Q12 44 12 34 Z" fill="#d8c09a"/>
          <rect x="3" y="0" width="28" height="10" rx="4" fill="#f8f0df"/>
          <circle cx="29" cy="45" r="4" fill="#f8f0df"/>
        </g>
        <g fill="#f5d06f"><circle cx="14" cy="45" r="2"/><circle cx="145" cy="58" r="2"/></g>
      </svg>`;
    }
  },
  {
    id: 'snowman',
    name: '눈사람 친구',
    tag: '실외 장식',
    cat: 'scene',
    slot: 'scene',
    scenes: ['outdoor'],
    decoClass: 'snowman',
    previewView: '0 0 110 140',
    render() {
      return `<svg viewBox="0 0 110 140" aria-hidden="true">
        <ellipse cx="55" cy="132" rx="45" ry="7" fill="#0a1a2b" opacity=".2"/>
        <circle cx="55" cy="102" r="30" fill="#f4faff"/>
        <circle cx="55" cy="67" r="23" fill="#f8fcff"/>
        <circle cx="55" cy="40" r="17" fill="#ffffff"/>
        <path d="M32 32 Q55 12 78 32 L73 23 Q55 8 37 23 Z" fill="#3b3b46"/>
        <rect x="34" y="28" width="42" height="5" rx="2.5" fill="#2d2d36"/>
        <circle cx="49" cy="37" r="2.2" fill="#33323a"/>
        <circle cx="61" cy="37" r="2.2" fill="#33323a"/>
        <path d="M55 41 L65 44 L55 46 Z" fill="#e38a3f"/>
        <path d="M38 55 Q55 64 72 55 L73 62 Q55 72 37 62 Z" fill="#c33d3a"/>
        <path d="M68 59 L76 83 L69 84 L64 61 Z" fill="#a92f2d"/>
        <path d="M45 50 Q55 60 65 50" stroke="#c33d3a" stroke-width="3" fill="none" opacity=".7"/>
        <circle cx="55" cy="70" r="2.3" fill="#c6d8e6"/>
        <circle cx="55" cy="82" r="2.3" fill="#c6d8e6"/>
        <circle cx="55" cy="102" r="2.5" fill="#c6d8e6"/>
        <circle cx="55" cy="116" r="2.5" fill="#c6d8e6"/>
        <path d="M26 64 L8 50 M27 72 L4 70 M84 64 L102 50 M83 72 L106 70" stroke="#7b5137" stroke-width="3" stroke-linecap="round"/>
        <circle cx="42" cy="47" r="5" fill="#f3a3a0" opacity=".55"/>
        <circle cx="68" cy="47" r="5" fill="#f3a3a0" opacity=".55"/>
      </svg>`;
    }
  },
  {
    id: 'reindeer-light',
    name: '루돌프 조명',
    tag: '실외 장식',
    cat: 'scene',
    slot: 'scene',
    scenes: ['outdoor'],
    decoClass: 'reindeer',
    previewView: '0 0 160 125',
    render() {
      return `<svg viewBox="0 0 160 125" aria-hidden="true">
        <ellipse cx="82" cy="116" rx="62" ry="7" fill="#071522" opacity=".22"/>
        <path d="M36 108 L42 60 Q44 38 70 36 Q98 34 112 50 L124 78 L118 82 L104 58 Q92 46 72 48 Q54 50 51 68 L46 108 Z"
          fill="none" stroke="#d9a84f" stroke-width="4" stroke-linejoin="round"/>
        <path d="M42 82 L102 78 M50 70 L108 67" stroke="#b8863c" stroke-width="2" opacity=".65"/>
        <path d="M68 36 C62 22 55 16 48 10 M64 28 L50 22 M70 22 L62 8 M96 38 C102 22 110 14 119 8 M100 30 L116 20 M98 22 L110 8"
          stroke="#d9a84f" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M52 48 Q48 34 58 26 Q64 22 66 34" fill="none" stroke="#d9a84f" stroke-width="3"/>
        <circle cx="60" cy="42" r="4" fill="#e45449"/>
        <circle cx="124" cy="80" r="5.5" fill="#e45449" class="bulb"/>
        <circle cx="102" cy="76" r="4.5" fill="#f2c75e" class="bulb"/>
        <circle cx="76" cy="48" r="4.5" fill="#f2c75e" class="bulb"/>
        <circle cx="62" cy="54" r="4" fill="#9ed9ac" class="bulb"/>
        <circle cx="43" cy="96" r="4.5" fill="#f2c75e" class="bulb"/>
        <path d="M42 108 L34 118 M50 108 L55 118" stroke="#b8863c" stroke-width="4" stroke-linecap="round"/>
        <path d="M36 62 Q34 55 38 50" stroke="#b8863c" stroke-width="3" fill="none"/>
      </svg>`;
    }
  }
];
