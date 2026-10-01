/* 曲庫
 * 每首歌由一或多個聲部（voices）組成，各聲部都從第 0 拍開始。
 * 第一個聲部是右手，第二個是左手（曲譜模式會依此決定音符上標示上排或下排的按鍵）。
 * 記號：音名＋八度（C4 = 中央 C），/後面是拍數（省略為 1 拍），
 *       R = 休止，+ 連接同時按下的和弦，| 只是方便閱讀的小節線。
 * meter 是每小節幾拍、pickup 是弱起拍的拍數，節奏伴奏靠這兩個值對齊小節。
 * 所有音都必須落在 D♯2–C5（琴鍵的預設音域）之內。
 */
window.SONGS = [
  {
    id: 'scale',
    title: '音階練習',
    sub: 'C major scale · 兩個八度',
    level: 1,
    bpm: 132,
    meter: 4,
    voices: [
      'C3 D3 E3 F3 G3 A3 B3 C4 | D4 E4 F4 G4 A4 B4 C5/2 | B4 A4 G4 F4 E4 D4 C4 B3 | A3 G3 F3 E3 D3 C3/2',
    ],
  },
  {
    id: 'twinkle',
    title: '小星星',
    sub: 'Twinkle, Twinkle, Little Star',
    level: 1,
    bpm: 104,
    meter: 4,
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
    meter: 4,
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
    meter: 4,
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
    meter: 3,
    pickup: 1,
    voices: [
      'G3/0.75 G3/0.25 | A3 G3 C4 | B3/2 G3/0.75 G3/0.25 | A3 G3 D4 | C4/2 G3/0.75 G3/0.25 | ' +
      'G4 E4 C4 | B3 A3/2 F4/0.75 F4/0.25 | E4 C4 D4 | C4/3',
    ],
  },
  {
    id: 'elise',
    title: '給愛麗絲',
    sub: 'Beethoven · Für Elise（F 小調）',
    level: 3,
    bpm: 132,
    meter: 3,
    pickup: 1,
    voices: [
      // 右手（八分音符 = 1 拍），整首降大三度，旋律都在上兩排
      'C5/0.5 B4/0.5 | C5/0.5 B4/0.5 C5/0.5 G4/0.5 A#4/0.5 G#4/0.5 | ' +
      'F4 R/0.5 G#3/0.5 C4/0.5 F4/0.5 | G4 R/0.5 C4/0.5 E4/0.5 G4/0.5 | ' +
      'G#4 R/0.5 C4/0.5 C5/0.5 B4/0.5 | C5/0.5 B4/0.5 C5/0.5 G4/0.5 A#4/0.5 G#4/0.5 | ' +
      'F4 R/0.5 G#3/0.5 C4/0.5 F4/0.5 | G4 R/0.5 C4/0.5 G#4/0.5 G4/0.5 | F4/3',
      // 左手分解和弦，在下兩排
      'R | R/3 | ' +
      'F2/0.5 C3/0.5 F3/0.5 R/1.5 | C3/0.5 E3/0.5 G3/0.5 R/1.5 | ' +
      'F2/0.5 C3/0.5 F3/0.5 R/1.5 | R/3 | ' +
      'F2/0.5 C3/0.5 F3/0.5 R/1.5 | C3/0.5 E3/0.5 G3/0.5 R/1.5 | F2/0.5 C3/0.5 F3/0.5',
    ],
  },
  {
    id: 'canon',
    title: '卡農',
    sub: 'Pachelbel · Canon（D 大調雙手版）',
    level: 3,
    bpm: 72,
    meter: 4,
    voices: [
      // 右手：第一輪只聽低音，之後三段旋律
      'R/8 | F#4 E4 D4 C#4 B3 A3 B3 C#4 | D4 C#4 B3 A3 G3 F#3 G3 E3 | ' +
      'D4/0.5 F#4/0.5 A4/0.5 G4/0.5 F#4/0.5 D4/0.5 F#4/0.5 E4/0.5 ' +
      'D4/0.5 B3/0.5 D4/0.5 A4/0.5 G4/0.5 B4/0.5 A4/0.5 G4/0.5 | D4+F#4/4',
      // 左手：固定低音，重複四次
      'D3 A2 B2 F#2 G2 D3 G2 A2 | D3 A2 B2 F#2 G2 D3 G2 A2 | ' +
      'D3 A2 B2 F#2 G2 D3 G2 A2 | D3 A2 B2 F#2 G2 D3 G2 A2 | D3/4',
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
    song.voices.forEach((voice, v) => {
      let beat = 0;
      for (const token of voice.split(/\s+/)) {
        if (!token || token === '|') continue;
        const [pitch, len] = token.split('/');
        const beats = len ? Number(len) : 1;
        if (pitch !== 'R') {
          for (const name of pitch.split('+')) {
            notes.push({ t: beat * secondsPerBeat, d: beats * secondsPerBeat, midi: toMidi(name), voice: v });
          }
        }
        beat += beats;
      }
    });
    return notes.sort((a, b) => a.t - b.t || a.midi - b.midi);
  };
})();
