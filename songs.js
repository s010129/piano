/* 曲庫
 * 每首歌由一或多個聲部（voices）組成，各聲部都從第 0 拍開始。
 * 記號：音名＋八度（C4 = 中央 C），/後面是拍數（省略為 1 拍），
 *       R = 休止，+ 連接同時按下的和弦，| 只是方便閱讀的小節線。
 * 所有音都必須落在 C3–E5（琴鍵的預設音域）之內。
 */
window.SONGS = [
  {
    id: 'scale',
    title: '音階練習',
    sub: 'C major scale · 全音域',
    level: 1,
    bpm: 132,
    voices: [
      'C3 D3 E3 F3 G3 A3 B3 C4 | D4 E4 F4 G4 A4 B4 C5 D5 | E5/2 D5 C5 B4 A4 G4 F4 | E4 D4 C4 B3 A3 G3 F3 E3 | D3 C3/2',
    ],
  },
  {
    id: 'twinkle',
    title: '小星星',
    sub: 'Twinkle, Twinkle, Little Star',
    level: 1,
    bpm: 104,
    voices: [
      'C4 C4 G4 G4 | A4 A4 G4/2 | F4 F4 E4 E4 | D4 D4 C4/2 | ' +
      'G4 G4 F4 F4 | E4 E4 D4/2 | G4 G4 F4 F4 | E4 E4 D4/2 | ' +
      'C4 C4 G4 G4 | A4 A4 G4/2 | F4 F4 E4 E4 | D4 D4 C4/2',
    ],
  },
  {
    id: 'bee',
    title: '小蜜蜂',
    sub: 'Hänschen klein',
    level: 1,
    bpm: 116,
    voices: [
      'G4 E4 E4/2 | F4 D4 D4/2 | C4 D4 E4 F4 | G4 G4 G4/2 | ' +
      'G4 E4 E4/2 | F4 D4 D4/2 | C4 E4 G4 G4 | E4/4 | ' +
      'D4 D4 D4 D4 | D4 E4 F4/2 | E4 E4 E4 E4 | E4 F4 G4/2 | ' +
      'G4 E4 E4/2 | F4 D4 D4/2 | C4 E4 G4 G4 | C4/4',
    ],
  },
  {
    id: 'joy',
    title: '歡樂頌',
    sub: 'Beethoven · Ode to Joy',
    level: 2,
    bpm: 120,
    voices: [
      'E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4/1.5 D4/0.5 D4/2 | ' +
      'E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4/1.5 C4/0.5 C4/2 | ' +
      'D4 D4 E4 C4 | D4 E4/0.5 F4/0.5 E4 C4 | D4 E4/0.5 F4/0.5 E4 D4 | C4 D4 G3/2 | ' +
      'E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4/1.5 C4/0.5 C4/2',
    ],
  },
  {
    id: 'birthday',
    title: '生日快樂',
    sub: 'Happy Birthday to You',
    level: 2,
    bpm: 96,
    voices: [
      'G3/0.75 G3/0.25 | A3 G3 C4 | B3/2 G3/0.75 G3/0.25 | A3 G3 D4 | C4/2 G3/0.75 G3/0.25 | ' +
      'G4 E4 C4 | B3 A3/2 F4/0.75 F4/0.25 | E4 C4 D4 | C4/3',
    ],
  },
  {
    id: 'elise',
    title: '給愛麗絲',
    sub: 'Beethoven · Für Elise',
    level: 3,
    bpm: 132,
    voices: [
      // 右手（八分音符 = 1 拍）
      'E5/0.5 D#5/0.5 | E5/0.5 D#5/0.5 E5/0.5 B4/0.5 D5/0.5 C5/0.5 | ' +
      'A4 R/0.5 C4/0.5 E4/0.5 A4/0.5 | B4 R/0.5 E4/0.5 G#4/0.5 B4/0.5 | ' +
      'C5 R/0.5 E4/0.5 E5/0.5 D#5/0.5 | E5/0.5 D#5/0.5 E5/0.5 B4/0.5 D5/0.5 C5/0.5 | ' +
      'A4 R/0.5 C4/0.5 E4/0.5 A4/0.5 | B4 R/0.5 E4/0.5 C5/0.5 B4/0.5 | A4/3',
      // 左手分解和弦（原曲最低音超出音域，保留其上兩個音）
      'R | R/3 | ' +
      'R/0.5 E3/0.5 A3/0.5 R/1.5 | R/0.5 E3/0.5 G#3/0.5 R/1.5 | ' +
      'R/0.5 E3/0.5 A3/0.5 R/1.5 | R/3 | ' +
      'R/0.5 E3/0.5 A3/0.5 R/1.5 | R/0.5 E3/0.5 G#3/0.5 R/1.5 | R/0.5 E3/0.5 A3/0.5',
    ],
  },
  {
    id: 'canon',
    title: '卡農',
    sub: 'Pachelbel · Canon（C 大調雙手版）',
    level: 3,
    bpm: 72,
    voices: [
      // 左手：固定低音，重複四次
      'C3 G3 A3 E3 F3 C3 F3 G3 | C3 G3 A3 E3 F3 C3 F3 G3 | ' +
      'C3 G3 A3 E3 F3 C3 F3 G3 | C3 G3 A3 E3 F3 C3 F3 G3 | C3/4',
      // 右手：第一輪只聽低音，之後三段旋律
      'R/8 | E5 D5 C5 B4 A4 G4 A4 B4 | C5 B4 A4 G4 F4 E4 F4 D4 | ' +
      'C4/0.5 E4/0.5 G4/0.5 F4/0.5 E4/0.5 C4/0.5 E4/0.5 D4/0.5 ' +
      'C4/0.5 A3/0.5 C4/0.5 G4/0.5 F4/0.5 A4/0.5 G4/0.5 F4/0.5 | C5/4',
    ],
  },
];

window.parseSong = (() => {
  const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  function toMidi(name) {
    const m = /^([A-G])(#|b)?(\d)$/.exec(name);
    if (!m) throw new Error(`無法辨識的音名：${name}`);
    const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
    return 12 * (Number(m[3]) + 1) + STEP[m[1]] + accidental;
  }

  return function parseSong(song) {
    const secondsPerBeat = 60 / song.bpm;
    const notes = [];
    for (const voice of song.voices) {
      let beat = 0;
      for (const token of voice.split(/\s+/)) {
        if (!token || token === '|') continue;
        const [pitch, len] = token.split('/');
        const beats = len ? Number(len) : 1;
        if (pitch !== 'R') {
          for (const name of pitch.split('+')) {
            notes.push({ t: beat * secondsPerBeat, d: beats * secondsPerBeat, midi: toMidi(name) });
          }
        }
        beat += beats;
      }
    }
    return notes.sort((a, b) => a.t - b.t || a.midi - b.midi);
  };
})();
