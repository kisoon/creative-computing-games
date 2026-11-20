/* NEON BEAT — original Web Audio tracks + chart generation
 * Everything below is synthesized at runtime. No recordings are bundled.
 */
(function () {
  "use strict";

  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const NOTE_INDEX = {
    C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
    "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11
  };
  const QUALITIES = {
    maj: [0, 4, 7],
    m: [0, 3, 7],
    min: [0, 3, 7],
    "7": [0, 4, 7, 10],
    maj7: [0, 4, 7, 11],
    m7: [0, 3, 7, 10],
    min7: [0, 3, 7, 10],
    sus4: [0, 5, 7],
    dim: [0, 3, 6]
  };

  function midiOf(name) {
    const match = String(name).match(/^([A-G])(#|b)?(-?\d+)$/);
    if (!match) throw new Error("Unknown note: " + name);
    const pc = NOTE_INDEX[match[1] + (match[2] || "")];
    return (parseInt(match[3], 10) + 1) * 12 + pc;
  }

  function chordNotes(chordName, octave) {
    const match = String(chordName).match(/^([A-G])(#|b)?(maj7|min7|m7|maj|min|m|7|sus4|dim)?$/);
    if (!match) throw new Error("Unknown chord: " + chordName);
    const root = NOTE_INDEX[match[1] + (match[2] || "")];
    const quality = match[3] || "maj";
    const intervals = QUALITIES[quality] || QUALITIES.maj;
    const rootMidi = (octave + 1) * 12 + root;
    return intervals.map((interval) => rootMidi + interval);
  }

  function hashString(value) {
    let h = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seededRandom(seed) {
    let value = seed >>> 0;
    return function random() {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const DRUM_PATTERNS = {
    none: { kick: [], snare: [], hat: [], open: [], clap: [] },
    soft: { kick: [0, 8], snare: [12], hat: [2, 6, 10, 14], open: [], clap: [] },
    half: { kick: [0, 10], snare: [8], hat: [2, 4, 6, 10, 12, 14], open: [14], clap: [] },
    pop: { kick: [0, 8, 11], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], open: [], clap: [4, 12] },
    drive: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14], open: [], clap: [4, 12] },
    edm: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14], open: [14], clap: [4, 12] },
    funk: { kick: [0, 3, 6, 10, 14], snare: [4, 12], hat: [0, 2, 3, 6, 8, 10, 11, 14], open: [7], clap: [12] }
  };

  const BASS_PATTERNS = {
    none: [],
    root: [{ s: 0, d: 6, o: 0 }, { s: 8, d: 6, o: 0 }],
    pop: [{ s: 0, d: 3, o: 0 }, { s: 3, d: 2, o: 0 }, { s: 8, d: 3, o: 0 }, { s: 11, d: 3, o: 12 }],
    drive: [
      { s: 0, d: 2, o: 0 }, { s: 2, d: 2, o: 0 }, { s: 4, d: 2, o: 12 }, { s: 6, d: 2, o: 0 },
      { s: 8, d: 2, o: 0 }, { s: 10, d: 2, o: 0 }, { s: 12, d: 2, o: 12 }, { s: 14, d: 2, o: 7 }
    ],
    funk: [
      { s: 0, d: 2, o: 0 }, { s: 3, d: 2, o: 0 }, { s: 6, d: 2, o: 12 },
      { s: 10, d: 2, o: 0 }, { s: 14, d: 2, o: 7 }
    ]
  };

  const ARP_PATTERNS = {
    up8: [
      { s: 0, i: 0, d: 2 }, { s: 2, i: 1, d: 2 }, { s: 4, i: 2, d: 2 }, { s: 6, i: 3, d: 2 },
      { s: 8, i: 4, d: 2 }, { s: 10, i: 5, d: 2 }, { s: 12, i: 4, d: 2 }, { s: 14, i: 3, d: 2 }
    ],
    updown8: [
      { s: 0, i: 0, d: 2 }, { s: 2, i: 1, d: 2 }, { s: 4, i: 2, d: 2 }, { s: 6, i: 3, d: 2 },
      { s: 8, i: 4, d: 2 }, { s: 10, i: 3, d: 2 }, { s: 12, i: 2, d: 2 }, { s: 14, i: 1, d: 2 }
    ],
    ballad: [
      { s: 0, i: 0, d: 4 }, { s: 3, i: 1, d: 2 }, { s: 6, i: 2, d: 2 },
      { s: 8, i: 3, d: 4 }, { s: 11, i: 4, d: 2 }, { s: 14, i: 2, d: 2 }
    ],
    funk: [
      { s: 0, i: 0, d: 1.2 }, { s: 2, i: 2, d: 1.2 }, { s: 3, i: 1, d: 1.2 },
      { s: 6, i: 3, d: 1.2 }, { s: 8, i: 0, d: 1.2 }, { s: 10, i: 2, d: 1.2 },
      { s: 11, i: 1, d: 1.2 }, { s: 14, i: 3, d: 1.2 }
    ]
  };

  const TRACKS = [
    {
      id: "moonlight",
      index: "01",
      title: "달빛 소나타",
      subtitle: "Moonlight Sonata · Synth Edit",
      composer: "L. v. Beethoven / 신스 어레인지",
      tag: "CLASSIC",
      description: "베토벤 1악장의 아르페지오를 네온 신스로 다시 그린 몽환적인 피아노 트랙.",
      bpm: 84,
      leadWave: "bell",
      accent: "#a58cff",
      accent2: "#62e6ff",
      level: { normal: 2, hard: 3 },
      mix: { lead: 0.7, arp: 0.8, pad: 0.8, bass: 0.7, drums: 0.72 },
      sections: [
        {
          name: "INTRO", bars: 4, energy: 0, chords: [["C#m", 3], ["A", 3], ["E", 3], ["B", 3]],
          arp: "updown8", arpChart: true, arpGain: 0.78, pad: true, bass: "none", drums: "none", crash: true
        },
        {
          name: "VERSE", bars: 8, energy: 1, chords: [["C#m", 3], ["A", 3], ["E", 3], ["B", 3]],
          melody: [
            { s: 0, m: "G#4", d: 6 }, { s: 8, m: "C#5", d: 4 }, { s: 12, m: "B4", d: 4 },
            { s: 16, m: "A4", d: 6 }, { s: 24, m: "G#4", d: 8 }
          ],
          arp: "updown8", arpChart: true, arpGain: 0.6, pad: true, bass: "root", drums: "soft"
        },
        {
          name: "CHORUS", bars: 8, energy: 2, chords: [["C#m", 3], ["A", 3], ["E", 3], ["B", 3]],
          melody: [
            { s: 0, m: "C#5", d: 4 }, { s: 4, m: "E5", d: 2 }, { s: 6, m: "G#5", d: 2 },
            { s: 8, m: "F#5", d: 4 }, { s: 12, m: "E5", d: 4 },
            { s: 16, m: "D#5", d: 4 }, { s: 20, m: "C#5", d: 2 }, { s: 22, m: "B4", d: 2 }, { s: 24, m: "G#4", d: 8 }
          ],
          arp: "updown8", arpChart: true, arpGain: 0.62, pad: true, bass: "pop", drums: "pop",
          hold: true, holdBeats: [0, 8], holdDuration: 4, crash: true
        },
        {
          name: "OUTRO", bars: 4, energy: 0, chords: [["C#m", 3], ["A", 3], ["E", 3], ["B", 3]],
          arp: "updown8", arpChart: true, arpGain: 0.72, pad: true, bass: "none", drums: "none"
        }
      ]
    },
    {
      id: "bumblebee",
      index: "02",
      title: "왕벌의 비행",
      subtitle: "Flight of the Bumblebee · Overclock",
      composer: "N. Rimsky-Korsakov / 신스 어레인지",
      tag: "CLASSIC",
      description: "쉼 없이 몰아치는 반음계 질주. 손가락이 기억해야 하는 초고속 클래식 리믹스.",
      bpm: 160,
      leadWave: "square",
      accent: "#ffd166",
      accent2: "#ff7b54",
      level: { normal: 3, hard: 5 },
      mix: { lead: 0.55, arp: 0.55, pad: 0.6, bass: 0.8, drums: 0.72 },
      sections: [
        {
          name: "INTRO", bars: 4, energy: 1, chords: [["Am", 3], ["E", 3], ["Am", 3], ["E", 3]],
          melody: [
            { s: 0, m: "A4", d: 1 }, { s: 1, m: "B4", d: 1 }, { s: 2, m: "C5", d: 1 }, { s: 3, m: "D5", d: 1 },
            { s: 4, m: "E5", d: 1 }, { s: 5, m: "F5", d: 1 }, { s: 6, m: "G5", d: 1 }, { s: 7, m: "A5", d: 1 },
            { s: 8, m: "G#5", d: 1 }, { s: 9, m: "A5", d: 1 }, { s: 10, m: "B5", d: 1 }, { s: 11, m: "C6", d: 1 },
            { s: 12, m: "B5", d: 1 }, { s: 13, m: "A5", d: 1 }, { s: 14, m: "G#5", d: 1 }, { s: 15, m: "E5", d: 1 },
            { s: 16, m: "F5", d: 1 }, { s: 17, m: "E5", d: 1 }, { s: 18, m: "D5", d: 1 }, { s: 19, m: "C5", d: 1 },
            { s: 20, m: "B4", d: 1 }, { s: 21, m: "C5", d: 1 }, { s: 22, m: "D5", d: 1 }, { s: 23, m: "E5", d: 1 },
            { s: 24, m: "F5", d: 1 }, { s: 25, m: "G5", d: 1 }, { s: 26, m: "A5", d: 1 }, { s: 27, m: "G5", d: 1 },
            { s: 28, m: "F5", d: 1 }, { s: 29, m: "E5", d: 1 }, { s: 30, m: "D5", d: 1 }, { s: 31, m: "B4", d: 1 }
          ],
          pad: true, bass: "drive", drums: "drive", crash: true
        },
        {
          name: "A", bars: 8, energy: 2, chords: [["Am", 3], ["E", 3], ["Am", 3], ["E", 3]],
          melody: [
            { s: 0, m: "A4", d: 1 }, { s: 1, m: "B4", d: 1 }, { s: 2, m: "C5", d: 1 }, { s: 3, m: "D5", d: 1 },
            { s: 4, m: "E5", d: 1 }, { s: 5, m: "F5", d: 1 }, { s: 6, m: "G5", d: 1 }, { s: 7, m: "A5", d: 1 },
            { s: 8, m: "G#5", d: 1 }, { s: 9, m: "A5", d: 1 }, { s: 10, m: "B5", d: 1 }, { s: 11, m: "C6", d: 1 },
            { s: 12, m: "B5", d: 1 }, { s: 13, m: "A5", d: 1 }, { s: 14, m: "G#5", d: 1 }, { s: 15, m: "E5", d: 1 },
            { s: 16, m: "F5", d: 1 }, { s: 17, m: "E5", d: 1 }, { s: 18, m: "D5", d: 1 }, { s: 19, m: "C5", d: 1 },
            { s: 20, m: "B4", d: 1 }, { s: 21, m: "C5", d: 1 }, { s: 22, m: "D5", d: 1 }, { s: 23, m: "E5", d: 1 },
            { s: 24, m: "F5", d: 1 }, { s: 25, m: "G5", d: 1 }, { s: 26, m: "A5", d: 1 }, { s: 27, m: "G5", d: 1 },
            { s: 28, m: "F5", d: 1 }, { s: 29, m: "E5", d: 1 }, { s: 30, m: "D5", d: 1 }, { s: 31, m: "B4", d: 1 }
          ],
          pad: true, bass: "drive", drums: "drive", hold: true, holdBeats: [0], holdDuration: 4
        },
        {
          name: "B", bars: 8, energy: 3, chords: [["Am", 3], ["Dm", 3], ["E", 3], ["Am", 3]],
          melody: [
            { s: 0, m: "E5", d: 1 }, { s: 1, m: "F5", d: 1 }, { s: 2, m: "G5", d: 1 }, { s: 3, m: "A5", d: 1 },
            { s: 4, m: "B5", d: 1 }, { s: 5, m: "A5", d: 1 }, { s: 6, m: "G5", d: 1 }, { s: 7, m: "F5", d: 1 },
            { s: 8, m: "E5", d: 1 }, { s: 9, m: "D5", d: 1 }, { s: 10, m: "C5", d: 1 }, { s: 11, m: "B4", d: 1 },
            { s: 12, m: "A4", d: 1 }, { s: 13, m: "B4", d: 1 }, { s: 14, m: "C5", d: 1 }, { s: 15, m: "D5", d: 1 },
            { s: 16, m: "E5", d: 1 }, { s: 17, m: "G5", d: 1 }, { s: 18, m: "A5", d: 1 }, { s: 19, m: "B5", d: 1 },
            { s: 20, m: "C6", d: 1 }, { s: 21, m: "B5", d: 1 }, { s: 22, m: "A5", d: 1 }, { s: 23, m: "G5", d: 1 },
            { s: 24, m: "F5", d: 1 }, { s: 25, m: "E5", d: 1 }, { s: 26, m: "D5", d: 1 }, { s: 27, m: "C5", d: 1 },
            { s: 28, m: "B4", d: 1 }, { s: 29, m: "A4", d: 1 }, { s: 30, m: "B4", d: 1 }, { s: 31, m: "E5", d: 1 }
          ],
          pad: true, bass: "drive", drums: "edm", hold: true, holdBeats: [0, 8], holdDuration: 4, crash: true
        },
        {
          name: "C", bars: 8, energy: 3, chords: [["Am", 3], ["E", 3], ["Am", 3], ["E", 3]],
          melody: [
            { s: 0, m: "A5", d: 1 }, { s: 1, m: "G#5", d: 1 }, { s: 2, m: "A5", d: 1 }, { s: 3, m: "B5", d: 1 },
            { s: 4, m: "C6", d: 1 }, { s: 5, m: "B5", d: 1 }, { s: 6, m: "A5", d: 1 }, { s: 7, m: "G#5", d: 1 },
            { s: 8, m: "A5", d: 1 }, { s: 9, m: "E5", d: 1 }, { s: 10, m: "F5", d: 1 }, { s: 11, m: "E5", d: 1 },
            { s: 12, m: "D5", d: 1 }, { s: 13, m: "C5", d: 1 }, { s: 14, m: "B4", d: 1 }, { s: 15, m: "A4", d: 1 },
            { s: 16, m: "B4", d: 1 }, { s: 17, m: "C5", d: 1 }, { s: 18, m: "D5", d: 1 }, { s: 19, m: "E5", d: 1 },
            { s: 20, m: "F5", d: 1 }, { s: 21, m: "G5", d: 1 }, { s: 22, m: "A5", d: 1 }, { s: 23, m: "B5", d: 1 },
            { s: 24, m: "C6", d: 1 }, { s: 25, m: "B5", d: 1 }, { s: 26, m: "A5", d: 1 }, { s: 27, m: "G#5", d: 1 },
            { s: 28, m: "A5", d: 1 }, { s: 29, m: "E5", d: 1 }, { s: 30, m: "B4", d: 1 }, { s: 31, m: "A4", d: 1 }
          ],
          pad: true, bass: "drive", drums: "edm", crash: true
        },
        {
          name: "OUTRO", bars: 4, energy: 1, chords: [["Am", 3], ["E", 3], ["Am", 3], ["E", 3]],
          melody: [
            { s: 0, m: "A5", d: 2 }, { s: 4, m: "E5", d: 2 }, { s: 8, m: "C5", d: 4 }, { s: 16, m: "A4", d: 8 }
          ],
          pad: true, bass: "root", drums: "soft"
        }
      ]
    },
    {
      id: "haru",
      index: "03",
      title: "하루",
      subtitle: "HARU · K-Pop Neon",
      composer: "NEON BEAT Original",
      tag: "K-POP",
      description: "네온 조명 아래 터지는 후렴. 반짝이는 신스와 묵직한 팝 비트가 만나는 오리지널 트랙.",
      bpm: 118,
      leadWave: "saw",
      accent: "#ff4d9d",
      accent2: "#8f7bff",
      level: { normal: 2, hard: 4 },
      mix: { lead: 0.66, arp: 0.5, pad: 0.72, bass: 0.82, drums: 0.78 },
      sections: [
        {
          name: "INTRO", bars: 4, energy: 0, chords: [["C#m", 3], ["A", 3], ["E", 3], ["B", 3]],
          arp: "up8", arpChart: true, arpGain: 0.55, pad: true, bass: "root", drums: "soft", crash: true
        },
        {
          name: "VERSE", bars: 8, energy: 1, chords: [["C#m", 3], ["A", 3], ["E", 3], ["B", 3]],
          melody: [
            { s: 0, m: "G#4", d: 4 }, { s: 4, m: "A4", d: 2 }, { s: 6, m: "B4", d: 2 },
            { s: 8, m: "G#4", d: 4 }, { s: 12, m: "E4", d: 4 },
            { s: 16, m: "F#4", d: 4 }, { s: 20, m: "G#4", d: 2 }, { s: 22, m: "A4", d: 2 }, { s: 24, m: "B4", d: 8 }
          ],
          pad: true, bass: "pop", drums: "pop"
        },
        {
          name: "PRE", bars: 4, energy: 2, chords: [["C#m", 3], ["A", 3], ["E", 3], ["B", 3]],
          melody: [
            { s: 0, m: "C#5", d: 2 }, { s: 2, m: "D#5", d: 2 }, { s: 4, m: "E5", d: 2 }, { s: 6, m: "F#5", d: 2 },
            { s: 8, m: "G#5", d: 4 }, { s: 12, m: "F#5", d: 4 },
            { s: 16, m: "E5", d: 2 }, { s: 18, m: "D#5", d: 2 }, { s: 20, m: "C#5", d: 2 }, { s: 22, m: "B4", d: 2 },
            { s: 24, m: "G#4", d: 8 }
          ],
          arp: "up8", arpChart: true, arpGain: 0.38, pad: true, bass: "drive", drums: "drive", riser: true
        },
        {
          name: "CHORUS", bars: 8, energy: 3, chords: [["C#m", 3], ["A", 3], ["E", 3], ["B", 3]],
          melody: [
            { s: 0, m: "E5", d: 2 }, { s: 2, m: "G#5", d: 2 }, { s: 4, m: "B5", d: 4 },
            { s: 8, m: "A5", d: 2 }, { s: 10, m: "G#5", d: 2 }, { s: 12, m: "E5", d: 4 },
            { s: 16, m: "F#5", d: 2 }, { s: 18, m: "G#5", d: 2 }, { s: 20, m: "A5", d: 4 }, { s: 24, m: "B5", d: 8 }
          ],
          arp: "up8", arpChart: true, arpGain: 0.32, pad: true, bass: "drive", drums: "edm",
          hold: true, holdBeats: [0, 8], holdDuration: 4, crash: true
        },
        {
          name: "BRIDGE", bars: 4, energy: 1, chords: [["C#m", 3], ["A", 3], ["E", 3], ["B", 3]],
          melody: [
            { s: 0, m: "C#5", d: 8 }, { s: 8, m: "B4", d: 8 }, { s: 16, m: "A4", d: 8 }, { s: 24, m: "G#4", d: 8 }
          ],
          pad: true, bass: "root", drums: "half"
        },
        {
          name: "FINAL", bars: 4, energy: 3, chords: [["C#m", 3], ["A", 3], ["E", 3], ["B", 3]],
          melody: [
            { s: 0, m: "E5", d: 2 }, { s: 2, m: "G#5", d: 2 }, { s: 4, m: "B5", d: 4 },
            { s: 8, m: "A5", d: 2 }, { s: 10, m: "G#5", d: 2 }, { s: 12, m: "E5", d: 4 },
            { s: 16, m: "F#5", d: 2 }, { s: 18, m: "G#5", d: 2 }, { s: 20, m: "A5", d: 4 }, { s: 24, m: "B5", d: 8 }
          ],
          arp: "up8", arpChart: true, arpGain: 0.28, pad: true, bass: "drive", drums: "edm",
          snake: true, snakeBeat: 2, snakeDuration: 8, snakePath: [0, 1, 2, 1, 2, 3], crash: true
        }
      ]
    },
    {
      id: "eojjeoda",
      index: "04",
      title: "어쩌다",
      subtitle: "EOJJEODA · City Pop",
      composer: "NEON BEAT Original",
      tag: "CITY POP",
      description: "늦은 밤 창가에 흐르는 시티팝. 부드러운 건반과 벨 사운드가 길게 이어지는 홀드로 흐릅니다.",
      bpm: 96,
      leadWave: "bell",
      accent: "#ff9a7b",
      accent2: "#ffcf8a",
      level: { normal: 2, hard: 3 },
      mix: { lead: 0.66, arp: 0.55, pad: 0.76, bass: 0.68, drums: 0.6 },
      sections: [
        {
          name: "INTRO", bars: 4, energy: 0, chords: [["Fmaj7", 3], ["G", 3], ["Em7", 3], ["Am", 3]],
          arp: "ballad", arpChart: true, arpGain: 0.58, pad: true, bass: "root", drums: "soft", crash: true
        },
        {
          name: "VERSE", bars: 8, energy: 1, chords: [["Fmaj7", 3], ["G", 3], ["Em7", 3], ["Am", 3]],
          melody: [
            { s: 0, m: "C5", d: 4 }, { s: 4, m: "E5", d: 2 }, { s: 6, m: "F5", d: 2 },
            { s: 8, m: "E5", d: 4 }, { s: 12, m: "C5", d: 4 },
            { s: 16, m: "D5", d: 4 }, { s: 20, m: "E5", d: 2 }, { s: 22, m: "G5", d: 2 }, { s: 24, m: "F5", d: 8 }
          ],
          arp: "ballad", arpChart: true, arpGain: 0.4, pad: true, bass: "pop", drums: "half"
        },
        {
          name: "CHORUS", bars: 8, energy: 2, chords: [["Fmaj7", 3], ["G", 3], ["Em7", 3], ["Am", 3]],
          melody: [
            { s: 0, m: "A5", d: 4 }, { s: 4, m: "G5", d: 2 }, { s: 6, m: "E5", d: 2 },
            { s: 8, m: "F5", d: 4 }, { s: 12, m: "E5", d: 4 },
            { s: 16, m: "D5", d: 4 }, { s: 20, m: "C5", d: 2 }, { s: 22, m: "D5", d: 2 }, { s: 24, m: "E5", d: 8 }
          ],
          arp: "ballad", arpChart: true, arpGain: 0.45, pad: true, bass: "pop", drums: "pop",
          hold: true, holdBeats: [0, 8], holdDuration: 4, crash: true
        },
        {
          name: "BRIDGE", bars: 4, energy: 1, chords: [["Fmaj7", 3], ["G", 3], ["Em7", 3], ["Am", 3]],
          melody: [
            { s: 0, m: "F5", d: 8 }, { s: 8, m: "E5", d: 8 }, { s: 16, m: "D5", d: 8 }, { s: 24, m: "C5", d: 8 }
          ],
          arp: "ballad", arpChart: true, arpGain: 0.52, pad: true, bass: "root", drums: "soft",
          hold: true, holdBeats: [0], holdDuration: 6
        },
        {
          name: "OUTRO", bars: 4, energy: 0, chords: [["Fmaj7", 3], ["G", 3], ["Em7", 3], ["Am", 3]],
          arp: "ballad", arpChart: true, arpGain: 0.6, pad: true, bass: "none", drums: "none"
        }
      ]
    },
    {
      id: "mister",
      index: "05",
      title: "미스터",
      subtitle: "MISTER · Funk Machine",
      composer: "NEON BEAT Original",
      tag: "FUNK",
      description: "끈적한 베이스와 브라스 스탭. 고개가 절로 끄덕여지는 네온 펑크 트랙.",
      bpm: 122,
      leadWave: "brass",
      accent: "#ff6f91",
      accent2: "#ffb84d",
      level: { normal: 3, hard: 4 },
      mix: { lead: 0.56, arp: 0.5, pad: 0.55, bass: 0.9, drums: 0.78 },
      sections: [
        {
          name: "INTRO", bars: 4, energy: 1, chords: [["Am7", 3], ["Dm7", 3], ["G7", 3], ["Cmaj7", 3]],
          arp: "funk", arpChart: true, arpGain: 0.55, pad: true, bass: "funk", drums: "funk", crash: true
        },
        {
          name: "VERSE", bars: 8, energy: 2, chords: [["Am7", 3], ["Dm7", 3], ["G7", 3], ["Cmaj7", 3]],
          melody: [
            { s: 0, m: "A4", d: 2 }, { s: 3, m: "C5", d: 2 }, { s: 6, m: "E5", d: 4 },
            { s: 10, m: "D5", d: 2 }, { s: 12, m: "C5", d: 4 },
            { s: 16, m: "B4", d: 2 }, { s: 19, m: "D5", d: 2 }, { s: 22, m: "G5", d: 4 }, { s: 26, m: "E5", d: 6 }
          ],
          arp: "funk", arpChart: true, arpGain: 0.32, pad: true, bass: "funk", drums: "funk"
        },
        {
          name: "CHORUS", bars: 8, energy: 3, chords: [["Am7", 3], ["Dm7", 3], ["G7", 3], ["Cmaj7", 3]],
          melody: [
            { s: 0, m: "E5", d: 2 }, { s: 2, m: "G5", d: 2 }, { s: 4, m: "A5", d: 4 },
            { s: 8, m: "G5", d: 2 }, { s: 10, m: "E5", d: 2 }, { s: 12, m: "D5", d: 4 },
            { s: 16, m: "C5", d: 2 }, { s: 18, m: "D5", d: 2 }, { s: 20, m: "E5", d: 4 }, { s: 24, m: "A5", d: 8 }
          ],
          arp: "funk", arpChart: true, arpGain: 0.3, pad: true, bass: "funk", drums: "funk",
          hold: true, holdBeats: [0, 8], holdDuration: 4, crash: true
        },
        {
          name: "BRIDGE", bars: 4, energy: 2, chords: [["Am7", 3], ["Dm7", 3], ["G7", 3], ["Cmaj7", 3]],
          melody: [
            { s: 0, m: "A4", d: 4 }, { s: 4, m: "C5", d: 2 }, { s: 6, m: "E5", d: 2 },
            { s: 8, m: "G5", d: 4 }, { s: 12, m: "E5", d: 4 },
            { s: 16, m: "D5", d: 4 }, { s: 20, m: "C5", d: 4 }, { s: 24, m: "A4", d: 8 }
          ],
          arp: "funk", arpChart: true, arpGain: 0.4, pad: true, bass: "funk", drums: "funk", riser: true
        },
        {
          name: "FINAL", bars: 4, energy: 3, chords: [["Am7", 3], ["Dm7", 3], ["G7", 3], ["Cmaj7", 3]],
          melody: [
            { s: 0, m: "E5", d: 2 }, { s: 2, m: "G5", d: 2 }, { s: 4, m: "A5", d: 4 },
            { s: 8, m: "G5", d: 2 }, { s: 10, m: "E5", d: 2 }, { s: 12, m: "D5", d: 4 },
            { s: 16, m: "C5", d: 2 }, { s: 18, m: "D5", d: 2 }, { s: 20, m: "E5", d: 4 }, { s: 24, m: "A5", d: 8 }
          ],
          arp: "funk", arpChart: true, arpGain: 0.32, pad: true, bass: "funk", drums: "funk", crash: true
        }
      ]
    },
    {
      id: "step",
      index: "06",
      title: "STEP",
      subtitle: "STEP! · Snake Mode",
      composer: "NEON BEAT Original",
      tag: "DANCE",
      description: "네온 스테이지의 피날레. 폭발하는 EDM 드롭과 HARD 전용 스네이크 홀드가 기다립니다.",
      bpm: 138,
      leadWave: "saw",
      accent: "#4de8ff",
      accent2: "#ff4d9d",
      level: { normal: 3, hard: 5 },
      mix: { lead: 0.6, arp: 0.5, pad: 0.74, bass: 0.88, drums: 0.82 },
      sections: [
        {
          name: "INTRO", bars: 4, energy: 0, chords: [["Em", 3], ["C", 3], ["G", 3], ["D", 3]],
          arp: "up8", arpChart: true, arpGain: 0.55, pad: true, bass: "root", drums: "soft", crash: true
        },
        {
          name: "VERSE", bars: 8, energy: 2, chords: [["Em", 3], ["C", 3], ["G", 3], ["D", 3]],
          melody: [
            { s: 0, m: "B4", d: 2 }, { s: 2, m: "E5", d: 2 }, { s: 4, m: "G5", d: 4 },
            { s: 8, m: "F#5", d: 2 }, { s: 10, m: "E5", d: 2 }, { s: 12, m: "B4", d: 4 },
            { s: 16, m: "D5", d: 2 }, { s: 18, m: "E5", d: 2 }, { s: 20, m: "G5", d: 4 }, { s: 24, m: "A5", d: 8 }
          ],
          pad: true, bass: "pop", drums: "pop"
        },
        {
          name: "BUILD", bars: 4, energy: 2, chords: [["Em", 3], ["C", 3], ["G", 3], ["D", 3]],
          melody: [
            { s: 0, m: "E5", d: 2 }, { s: 4, m: "G5", d: 2 }, { s: 8, m: "B5", d: 2 }, { s: 12, m: "D6", d: 2 }
          ],
          arp: "up8", arpChart: true, arpGain: 0.5, pad: true, bass: "drive", drums: "drive", riser: true
        },
        {
          name: "CHORUS", bars: 8, energy: 3, chords: [["Em", 3], ["C", 3], ["G", 3], ["D", 3]],
          melody: [
            { s: 0, m: "E5", d: 2 }, { s: 2, m: "G5", d: 2 }, { s: 4, m: "B5", d: 4 },
            { s: 8, m: "A5", d: 2 }, { s: 10, m: "G5", d: 2 }, { s: 12, m: "E5", d: 4 },
            { s: 16, m: "D5", d: 2 }, { s: 18, m: "E5", d: 2 }, { s: 20, m: "G5", d: 4 }, { s: 24, m: "A5", d: 8 }
          ],
          arp: "up8", arpChart: true, arpGain: 0.32, pad: true, bass: "drive", drums: "edm",
          hold: true, holdBeats: [0, 8], holdDuration: 4, crash: true
        },
        {
          name: "BREAK", bars: 4, energy: 2, chords: [["Em", 3], ["C", 3], ["G", 3], ["D", 3]],
          melody: [
            { s: 0, m: "B5", d: 8 }, { s: 8, m: "A5", d: 4 }, { s: 12, m: "G5", d: 4 },
            { s: 16, m: "E5", d: 8 }, { s: 24, m: "D5", d: 8 }
          ],
          arp: "up8", arpChart: true, arpGain: 0.42, pad: true, bass: "root", drums: "half",
          hold: true, holdBeats: [0], holdDuration: 8
        },
        {
          name: "FINAL", bars: 4, energy: 3, chords: [["Em", 3], ["C", 3], ["G", 3], ["D", 3]],
          melody: [
            { s: 0, m: "E5", d: 2 }, { s: 2, m: "G5", d: 2 }, { s: 4, m: "B5", d: 4 },
            { s: 8, m: "A5", d: 2 }, { s: 10, m: "G5", d: 2 }, { s: 12, m: "E5", d: 4 },
            { s: 16, m: "D5", d: 2 }, { s: 18, m: "E5", d: 2 }, { s: 20, m: "G5", d: 4 }, { s: 24, m: "A5", d: 8 }
          ],
          arp: "up8", arpChart: true, arpGain: 0.3, pad: true, bass: "drive", drums: "edm",
          snake: true, snakeBeat: 0, snakeDuration: 8, snakePath: [3, 2, 1, 2, 1, 0], crash: true
        }
      ]
    }
  ];

  function compileSong(track) {
    const beatDur = 60 / track.bpm;
    const barDur = beatDur * 4;
    const stepDur = beatDur / 4;
    const events = [];
    const chartCandidates = [];
    const sectionInfo = [];
    let barCursor = 0;
    let timeCursor = 0;

    function pushEvent(type, t, data) {
      events.push(Object.assign({ type, t }, data));
    }

    track.sections.forEach((section) => {
      const sectionStartBar = barCursor;
      const sectionStartTime = timeCursor;
      if (section.crash) pushEvent("crash", timeCursor, { gain: 0.9 });
      if (section.riser) {
        pushEvent("riser", timeCursor + Math.max(0, section.bars - 1) * barDur, {
          dur: barDur * 0.92,
          gain: 0.7
        });
      }

      for (let bar = 0; bar < section.bars; bar += 1) {
        const barTime = timeCursor + bar * barDur;
        const chordDef = section.chords[bar % section.chords.length];
        const chord = chordNotes(chordDef[0], chordDef[1]);
        const phraseBars = section.phraseBars || 2;
        const phraseBar = bar % phraseBars;

        if (section.pad !== false) {
          pushEvent("pad", barTime, {
            midis: chord.map((note) => note + 12),
            dur: barDur * 0.96,
            gain: section.padGain || 1
          });
        }

        if (section.arp && ARP_PATTERNS[section.arp]) {
          const pattern = ARP_PATTERNS[section.arp];
          const arpNotes = chord.map((note) => note + 12).concat(chord.map((note) => note + 24));
          pattern.forEach((item) => {
            const note = arpNotes[item.i % arpNotes.length];
            const eventTime = barTime + item.s * stepDur;
            pushEvent("arp", eventTime, {
              midi: note,
              dur: item.d * stepDur * 0.82,
              gain: section.arpGain || 0.55
            });
            if (section.arpChart) {
              chartCandidates.push({
                t: eventTime,
                midi: note,
                dur: item.d * stepDur,
                source: "arp",
                strength: 0.72
              });
            }
          });
        }

        if (section.bass && section.bass !== "none" && BASS_PATTERNS[section.bass]) {
          BASS_PATTERNS[section.bass].forEach((item) => {
            pushEvent("bass", barTime + item.s * stepDur, {
              midi: chord[0] - 12 + item.o,
              dur: item.d * stepDur * 0.9,
              gain: 1
            });
          });
        }

        if (section.stabs) {
          [3, 7, 11, 14].forEach((step) => {
            pushEvent("stab", barTime + step * stepDur, {
              midis: chord.map((note) => note + 12),
              dur: stepDur * 1.1,
              gain: 0.7
            });
          });
        }

        const drums = DRUM_PATTERNS[section.drums || "none"];
        if (drums) {
          drums.kick.forEach((step) => pushEvent("kick", barTime + step * stepDur, { gain: 1 }));
          drums.snare.forEach((step) => pushEvent("snare", barTime + step * stepDur, { gain: 1 }));
          drums.clap.forEach((step) => pushEvent("clap", barTime + step * stepDur, { gain: 0.7 }));
          drums.hat.forEach((step) => pushEvent("hat", barTime + step * stepDur, { gain: 0.7 }));
          drums.open.forEach((step) => pushEvent("openhat", barTime + step * stepDur, { gain: 0.65 }));
          if (section.fill && bar === section.bars - 1) {
            [12, 13, 14, 15].forEach((step) => pushEvent("snare", barTime + step * stepDur, { gain: 0.55 }));
          }
        }

        if (section.melody && section.melody.length) {
          section.melody.forEach((note) => {
            const noteBar = Math.floor(note.s / 16);
            if (noteBar !== phraseBar) return;
            const localStep = note.s - phraseBar * 16;
            const eventTime = barTime + localStep * stepDur;
            const midi = midiOf(note.m) + (section.transpose || 0);
            const duration = Math.max(0.055, note.d * stepDur * 0.9);
            pushEvent("lead", eventTime, {
              midi,
              dur: duration,
              gain: note.gain || 1,
              wave: section.leadWave || track.leadWave
            });
            chartCandidates.push({
              t: eventTime,
              midi,
              dur: duration,
              source: "lead",
              strength: 1
            });
          });
        }
      }

      sectionInfo.push({
        name: section.name,
        startBar: sectionStartBar,
        bars: section.bars,
        startTime: sectionStartTime,
        energy: section.energy || 0,
        hold: !!section.hold,
        holdBeats: section.holdBeats || [],
        holdDuration: section.holdDuration || 4,
        snake: !!section.snake,
        snakeBeat: section.snakeBeat || 0,
        snakeDuration: section.snakeDuration || 8,
        snakePath: section.snakePath || [0, 1, 2, 1, 2, 3]
      });

      barCursor += section.bars;
      timeCursor += section.bars * barDur;
    });

    events.sort((a, b) => a.t - b.t);
    const duration = timeCursor + 1.7;
    return {
      id: track.id,
      track,
      bpm: track.bpm,
      beatDur,
      barDur,
      stepDur,
      events,
      chartCandidates,
      sections: sectionInfo,
      duration,
      totalBars: barCursor
    };
  }

  function lanePicker(trackId, difficulty) {
    const random = seededRandom(hashString(trackId + ":" + difficulty));
    let lastLane = -1;
    let lastTime = -10;
    let sameLaneCount = 0;
    let lastPitch = 64;

    return function pick(candidate) {
      const fast = candidate.t - lastTime < 0.23;
      let allowed = [0, 1, 2, 3];
      if (lastLane >= 0) {
        allowed = allowed.filter((lane) => {
          if (lane !== lastLane) return true;
          return sameLaneCount < 1 && !fast;
        });
      }
      if (!allowed.length) allowed = [0, 1, 2, 3].filter((lane) => lane !== lastLane);
      const weights = allowed.map((lane) => {
        let weight = 1;
        if (candidate.midi >= 76) weight += lane >= 2 ? 1.7 : 0.1;
        else if (candidate.midi >= 69) weight += lane >= 1 ? 0.55 : 0.2;
        else if (candidate.midi <= 60) weight += lane <= 1 ? 1.35 : 0.15;
        if (lastLane >= 0 && Math.abs(lane - lastLane) === 1) weight *= 1.28;
        if (lane === lastLane) weight *= 0.12;
        if (candidate.midi > lastPitch) weight += lane > lastLane ? 0.5 : 0.12;
        if (candidate.midi < lastPitch) weight += lane < lastLane ? 0.5 : 0.12;
        return Math.max(0.01, weight);
      });
      const total = weights.reduce((sum, value) => sum + value, 0);
      let roll = random() * total;
      let lane = allowed[allowed.length - 1];
      for (let i = 0; i < allowed.length; i += 1) {
        roll -= weights[i];
        if (roll <= 0) {
          lane = allowed[i];
          break;
        }
      }
      if (lane === lastLane) sameLaneCount += 1;
      else sameLaneCount = 0;
      lastLane = lane;
      lastTime = candidate.t;
      lastPitch = candidate.midi;
      return lane;
    };
  }

  function chartFor(song, difficulty) {
    const isHard = difficulty === "hard";
    const minGap = isHard ? 0.115 : 0.19;
    const candidates = song.chartCandidates
      .filter((candidate) => candidate.t >= 2.4 && candidate.t < song.duration - 0.8)
      .sort((a, b) => a.t - b.t || b.strength - a.strength);

    const taps = [];
    let lastTime = -10;
    candidates.forEach((candidate) => {
      if (candidate.t - lastTime < minGap) return;
      taps.push(candidate);
      lastTime = candidate.t;
    });

    const pickLane = lanePicker(song.id, difficulty);
    let notes = taps.map((candidate, index) => ({
      id: song.id + "-" + difficulty + "-n" + index,
      type: "tap",
      time: candidate.t,
      lane: pickLane(candidate),
      duration: 0,
      midi: candidate.midi,
      source: candidate.source,
      status: "pending"
    }));

    const snakes = [];
    if (isHard) {
      song.sections.forEach((section) => {
        if (!section.snake) return;
        const start = section.startTime + section.snakeBeat * song.beatDur;
        const duration = section.snakeDuration * song.beatDur;
        if (start < 2.4 || start + duration > song.duration - 0.6) return;
        const path = section.snakePath.map((lane, index, array) => ({
          offset: (duration / (array.length - 1)) * index,
          lane
        }));
        const snake = {
          id: song.id + "-hard-snake-" + snakes.length,
          type: "snake",
          time: start,
          lane: path[0].lane,
          duration,
          path,
          status: "pending",
          checkpoints: path.map((point, index) => ({
            offset: point.offset,
            lane: point.lane,
            passed: false,
            index
          }))
        };
        snakes.push(snake);
        notes = notes.filter((note) => note.time < start - 0.25 || note.time > start + duration + 0.3);
      });
    }

    notes = notes.concat(snakes);

    const holdSpecs = [];
    song.sections.forEach((section) => {
      if (!section.hold) return;
      section.holdBeats.forEach((beat) => {
        const t = section.startTime + beat * song.beatDur;
        const duration = section.holdDuration * song.beatDur;
        if (t < 2.4 || t + duration > song.duration - 0.8) return;
        if (snakes.some((snake) => t < snake.time + snake.duration + 0.5 && t + duration > snake.time - 0.5)) return;
        holdSpecs.push({ time: t, duration });
      });
    });

    holdSpecs.forEach((spec, holdIndex) => {
      let bestLane = 0;
      let bestConflicts = Infinity;
      for (let lane = 0; lane < 4; lane += 1) {
        const conflicts = notes.filter((note) => {
          if (note.lane !== lane || note.type === "snake") return false;
          return note.time < spec.time + spec.duration + 0.22 && note.time + Math.max(0.16, note.duration) > spec.time - 0.22;
        }).length;
        if (conflicts < bestConflicts) {
          bestConflicts = conflicts;
          bestLane = lane;
        }
      }
      notes = notes.filter((note) => {
        if (note.lane !== bestLane || note.type === "snake") return true;
        return !(note.time < spec.time + spec.duration + 0.22 && note.time + Math.max(0.16, note.duration) > spec.time - 0.22);
      });
      notes.push({
        id: song.id + "-" + difficulty + "-hold" + holdIndex,
        type: "hold",
        time: spec.time,
        lane: bestLane,
        duration: spec.duration,
        status: "pending"
      });
    });

    notes.sort((a, b) => a.time - b.time || a.lane - b.lane);
    notes.forEach((note, index) => {
      note.index = index;
      note.endTime = note.time + (note.duration || 0);
      note.status = "pending";
      note.judged = false;
      note.holdProgress = 0;
      note.snakeIndex = -1;
    });

    return {
      difficulty,
      notes,
      totalNotes: notes.length,
      snakeCount: snakes.length,
      holdCount: notes.filter((note) => note.type === "hold").length,
      tapCount: notes.filter((note) => note.type === "tap").length
    };
  }

  const songCache = new Map();
  const chartCache = new Map();

  function getSong(trackId) {
    if (songCache.has(trackId)) return songCache.get(trackId);
    const track = TRACKS.find((item) => item.id === trackId);
    if (!track) return null;
    const song = compileSong(track);
    songCache.set(trackId, song);
    return song;
  }

  function getChart(trackId, difficulty) {
    const key = trackId + ":" + difficulty;
    if (chartCache.has(key)) return chartCache.get(key);
    const song = getSong(trackId);
    if (!song) return null;
    const chart = chartFor(song, difficulty);
    chartCache.set(key, chart);
    return chart;
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.round(seconds));
    return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
  }

  window.NeonTracks = {
    tracks: TRACKS,
    getSong,
    getChart,
    formatDuration
  };
})();
