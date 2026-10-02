/* 夜曲鋼琴 Nocturne — 主程式 */
(() => {
  'use strict';

  /* ───────────── 鍵位與音名 ─────────────
   * 上兩排是一條完整的鋼琴：Q 到 \ 是白鍵，上方的數字與 - = 是黑鍵，
   *   中央 C 在 Y，左手放 Q–T、右手放 Y–\，雙手並排由左到右。
   * 下兩排是同樣的排法、低一個八度：Z 到 / 是白鍵，上方的 A–' 是黑鍵，給左手彈低音。
   * 白鍵之間沒有黑鍵的地方（E–F、B–C）對應的按鍵不發聲，手感跟真鋼琴一樣。
   */
  const UPPER_KEYS = [
    ['Digit1', '1', 51], ['KeyQ', 'Q', 52], ['KeyW', 'W', 53], ['Digit3', '3', 54], ['KeyE', 'E', 55],
    ['Digit4', '4', 56], ['KeyR', 'R', 57], ['Digit5', '5', 58], ['KeyT', 'T', 59], ['KeyY', 'Y', 60],
    ['Digit7', '7', 61], ['KeyU', 'U', 62], ['Digit8', '8', 63], ['KeyI', 'I', 64], ['KeyO', 'O', 65],
    ['Digit0', '0', 66], ['KeyP', 'P', 67], ['Minus', '-', 68], ['BracketLeft', '[', 69], ['Equal', '=', 70],
    ['BracketRight', ']', 71], ['Backslash', '\\', 72],
  ];
  const LOWER_KEYS = [
    ['KeyA', 'A', 39], ['KeyZ', 'Z', 40], ['KeyX', 'X', 41], ['KeyD', 'D', 42], ['KeyC', 'C', 43],
    ['KeyF', 'F', 44], ['KeyV', 'V', 45], ['KeyG', 'G', 46], ['KeyB', 'B', 47], ['KeyN', 'N', 48],
    ['KeyJ', 'J', 49], ['KeyM', 'M', 50], ['KeyK', 'K', 51], ['Comma', ',', 52], ['Period', '.', 53],
    ['Semicolon', ';', 54], ['Slash', '/', 55], ['Quote', "'", 56],
  ];
  const LOW = 38;  // 畫面從 D2 開始，讓最低的 D♯2（A 鍵）有位置
  const HIGH = 72; // C5
  const PLAY_LOW = 39;
  const COUNT = HIGH - LOW + 1;
  const LABELS = Array.from({ length: COUNT }, () => ({ upper: '', lower: '' }));
  const CODE_INDEX = new Map();
  UPPER_KEYS.forEach(([code, label, midi]) => { CODE_INDEX.set(code, midi - LOW); LABELS[midi - LOW].upper = label; });
  LOWER_KEYS.forEach(([code, label, midi]) => { CODE_INDEX.set(code, midi - LOW); LABELS[midi - LOW].lower = label; });
  // 曲譜模式的音符標示：右手優先標上排的鍵、左手優先標下排的鍵
  const keyLabel = (i, hand) => {
    const L = LABELS[i];
    return hand === 'L' ? L.lower || L.upper : L.upper || L.lower;
  };
  const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const OCTAVE_MIN = -1;
  const OCTAVE_MAX = 3;

  const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const CHORD_ROOTS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  // 史克里亞賓《普羅米修斯》色光鍵盤：依五度圈為每個音配一種色相
  const HUES = [0, 276, 52, 300, 192, 345, 232, 28, 286, 128, 322, 212];

  const isBlack = m => [1, 3, 6, 8, 10].includes(m % 12);
  const noteName = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ───────────── 音色：Web Audio 合成，像電子琴一樣可以切換 ───────────── */
  const TONES = [
    { id: 'piano', group: 'acoustic', name: '鋼琴', en: 'Grand Piano' },
    { id: 'epiano', group: 'acoustic', name: '電鋼琴', en: 'Electric Piano' },
    { id: 'organ', group: 'acoustic', name: '風琴', en: 'Drawbar Organ' },
    { id: 'strings', group: 'acoustic', name: '弦樂', en: 'Strings' },
    { id: 'musicbox', group: 'acoustic', name: '音樂盒', en: 'Music Box' },
    { id: 'synth', group: 'edm', name: '合成主奏', en: 'Synth Lead' },
    { id: 'supersaw', group: 'edm', name: '超級鋸齒', en: 'Supersaw' },
    { id: 'pluck', group: 'edm', name: '合成撥弦', en: 'Pluck' },
    { id: 'chip', group: 'edm', name: '8-bit 晶片', en: 'Chiptune' },
    { id: 'bass', group: 'edm', name: '合成貝斯', en: 'Synth Bass' },
    { id: 'wobble', group: 'edm', name: 'Wobble 貝斯', en: 'Wobble Bass' },
    { id: 'pad', group: 'edm', name: '氛圍鋪底', en: 'Atmos Pad' },
  ];
  const TONE_GROUPS = [
    { id: 'acoustic', label: '原聲' },
    { id: 'edm', label: '電音' },
  ];

  /* 節奏伴奏（電子琴的 Style）：每一行是一小節的十六分音符格子，
   * X 重拍、x 一般、o 輕拍、- 不打。 */
  const STYLES = [
    { id: 'pop', group: 'basic', name: '流行', en: '8 Beat Pop', bpm: 96, meter: 4, parts: {
      kick: 'X-----x-x-------', snare: '----X-------X---', chat: 'x-o-x-o-x-o-x-o-' } },
    { id: 'rock', group: 'basic', name: '搖滾', en: 'Rock', bpm: 120, meter: 4, parts: {
      kick: 'X-----x-X-x-----', snare: '----X-------X---', chat: 'X-x-X-x-X-x-X-x-' } },
    { id: 'disco', group: 'basic', name: '迪斯可', en: 'Disco', bpm: 116, meter: 4, parts: {
      kick: 'X---X---X---X---', snare: '----X-------X---', ohat: '--x---x---x---x-', chat: 'o---o---o---o---' } },
    { id: 'waltz', group: 'basic', name: '華爾滋', en: 'Waltz 3/4', bpm: 96, meter: 3, parts: {
      kick: 'X-----------', rim: '----x---x---', chat: '----o---o---' } },
    { id: 'house', group: 'edm', name: '浩室', en: 'House', bpm: 124, meter: 4, parts: {
      kick: 'X---X---X---X---', clap: '----X-------X---', ohat: '--x---x---x---x-', chat: 'oo-ooo-ooo-ooo-o' } },
    { id: 'trap', group: 'edm', name: '陷阱', en: 'Trap', bpm: 140, meter: 4, parts: {
      kick: 'X------x--x-----', clap: '--------X-------', chat: 'x-x-x-x-x-xxx-xx' } },
    { id: 'dnb', group: 'edm', name: '鼓打貝斯', en: 'Drum & Bass', bpm: 172, meter: 4, parts: {
      kick: 'X---------X-----', snare: '----X-------X---', chat: 'x-x-x-x-x-x-x-x-' } },
  ];
  const STYLE_GROUPS = [
    { id: 'basic', label: '一般' },
    { id: 'edm', label: '電音' },
  ];

  const audio = (() => {
    let ctx = null;
    let bus = null;
    let waves = null;
    let noise = null;
    let noiseLong = null;
    let master = null;
    let echo = null;    // 跟著速度走的附點八分音符回音
    let drumBus = null;
    let tone = 'piano';
    let tempo = 120;
    const sounding = new Map(); // midi → 目前發聲中的 voice
    const live = new Set();
    const MAX_VOICES = 48;

    function harmonicWave(amps) {
      const real = new Float32Array(amps.length + 1);
      const imag = new Float32Array(amps.length + 1);
      amps.forEach((a, i) => { imag[i + 1] = a; });
      return ctx.createPeriodicWave(real, imag);
    }

    function roomImpulse(seconds, decay) {
      const len = Math.floor(ctx.sampleRate * seconds);
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return buf;
    }

    function ensure() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        try { ctx = new AC({ latencyHint: 'interactive' }); } catch (_) { ctx = new AC(); }

        bus = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.knee.value = 12;
        comp.ratio.value = 3.5;
        comp.attack.value = 0.002;
        comp.release.value = 0.25;
        const room = ctx.createConvolver();
        room.buffer = roomImpulse(2.6, 3.2);
        const wet = ctx.createGain();
        wet.gain.value = 0.2;
        master = ctx.createGain();
        master.gain.value = 0.95;
        bus.connect(comp);
        bus.connect(room);
        room.connect(wet);
        wet.connect(comp);
        comp.connect(master);
        master.connect(ctx.destination);

        // 電音音色用的回音
        echo = ctx.createDelay(2);
        const feedback = ctx.createGain();
        feedback.gain.value = 0.35;
        const echoTone = ctx.createBiquadFilter();
        echoTone.type = 'lowpass';
        echoTone.frequency.value = 3500;
        const echoWet = ctx.createGain();
        echoWet.gain.value = 0.5;
        echo.connect(feedback);
        feedback.connect(echo);
        echo.connect(echoTone);
        echoTone.connect(echoWet);
        echoWet.connect(comp);

        // 鼓組另走一條，不讓大鼓壓縮到琴聲
        drumBus = ctx.createGain();
        drumBus.gain.value = 0.55;
        const drumComp = ctx.createDynamicsCompressor();
        drumComp.threshold.value = -10;
        drumComp.ratio.value = 4;
        drumBus.connect(drumComp);
        drumComp.connect(master);

        waves = {
          // 鋼琴：低音區泛音豐富、高音區接近純音
          low: harmonicWave([0.55, 1, 0.8, 0.62, 0.48, 0.36, 0.28, 0.2, 0.15, 0.11, 0.08, 0.06, 0.045, 0.03]),
          mid: harmonicWave([1, 0.62, 0.38, 0.24, 0.16, 0.1, 0.07, 0.045, 0.03, 0.02]),
          high: harmonicWave([1, 0.28, 0.1, 0.04, 0.02]),
          // 風琴拉桿：以低八度為基頻，依序是 16'、8'、5⅓'、4'、2⅔'、2'、1⅗'、1⅓'、1'
          organ: harmonicWave([0.5, 1, 0.55, 0.6, 0, 0.35, 0, 0.35, 0, 0.1, 0, 0.12, 0, 0, 0, 0.15]),
          // 8-bit 遊戲機的 25% 脈衝波
          pulse: (() => {
            const n = 32;
            const real = new Float32Array(n + 1);
            for (let k = 1; k <= n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
            return ctx.createPeriodicWave(real, new Float32Array(n + 1));
          })(),
        };
        noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.1), ctx.sampleRate);
        const nd = noise.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        noiseLong = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const nl = noiseLong.getChannelData(0);
        for (let i = 0; i < nl.length; i++) nl[i] = Math.random() * 2 - 1;
        setTempo(tempo);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }

    function osc(type, freq, detune, dest, t) {
      const o = ctx.createOscillator();
      if (typeof type === 'string') o.type = type;
      else o.setPeriodicWave(type);
      o.frequency.value = freq;
      o.detune.value = detune;
      o.connect(dest);
      o.start(t);
      return o;
    }

    function gainNode(value, dest) {
      const g = ctx.createGain();
      g.gain.value = value;
      g.connect(dest);
      return g;
    }

    function lowpass(dest, q) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = q;
      f.connect(dest);
      return f;
    }

    // 短促的敲擊／按鍵噪音
    function click(level, freq, t, length) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = freq;
      band.Q.value = 0.9;
      const g = ctx.createGain();
      g.gain.setValueAtTime(level, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + length);
      src.connect(band);
      band.connect(g);
      g.connect(bus);
      src.start(t);
      src.stop(t + length + 0.02);
    }

    function vibrato(rate, cents, delay, t) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = rate;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(delay ? 0 : cents, t);
      if (delay) depth.gain.linearRampToValueAtTime(cents, t + delay);
      lfo.connect(depth);
      lfo.start(t);
      return { lfo, depth };
    }

    /* 每種音色：建立聲源接到 v.out、排好音量包絡，設定放開琴鍵後的收尾時間，回傳最晚結束時間 */
    const VOICES = {
      piano(v, t, f, pos, vel) {
        const level = 0.11 * vel * (1.1 - pos * 0.45);
        const ring = 3.2 - pos * 2.5; // 餘音的時間常數（秒）
        const tone = lowpass(v.out, 0.6);
        tone.frequency.setValueAtTime(Math.min(16000, f * (5 + 9 * vel) + 900), t);
        tone.frequency.setTargetAtTime(Math.min(9000, f * 2.4 + 350), t + 0.01, 0.18 + (1 - pos) * 0.5);
        const wave = v.midi < 52 ? waves.low : v.midi < 77 ? waves.mid : waves.high;
        for (const side of [-1, 1]) v.srcs.push(osc(wave, f, side * (0.9 + pos * 1.6), tone, t)); // 多條弦微微走音
        const g = v.out.gain;
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(level, t + 0.004);
        g.setTargetAtTime(level * 0.38, t + 0.006, 0.07 + (1 - pos) * 0.16);
        g.setTargetAtTime(0, t + 0.28, ring);
        click(level * 0.9, Math.min(7000, f * 3 + 500), t, 0.035); // 琴槌敲弦
        v.release = 0.14 - pos * 0.08; // 制音器落下
        return t + 0.3 + ring * 7;
      },

      // 調頻（FM）合成的音叉式電鋼琴
      epiano(v, t, f, pos, vel) {
        const level = 0.13 * vel * (1.05 - pos * 0.4);
        const ring = 2.4 - pos * 1.6;
        const carrier = osc('sine', f, 0, v.out, t);
        const index = ctx.createGain();
        index.gain.setValueAtTime(f * (1.2 + 1.6 * vel), t);
        index.gain.setTargetAtTime(f * 0.25, t + 0.005, 0.35);
        index.connect(carrier.frequency);
        const modulator = osc('sine', f, 0, index, t);
        const tineGain = ctx.createGain();
        tineGain.gain.setValueAtTime(0.3, t);
        tineGain.gain.setTargetAtTime(0, t, 0.05);
        tineGain.connect(v.out);
        const tine = osc('sine', Math.min(f * 7, 16000), 0, tineGain, t);
        v.srcs.push(carrier, modulator, tine);
        const g = v.out.gain;
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(level, t + 0.003);
        g.setTargetAtTime(level * 0.55, t + 0.004, 0.3);
        g.setTargetAtTime(0, t + 0.4, ring);
        v.release = 0.1;
        return t + 0.4 + ring * 7;
      },

      // 拉桿風琴：按住就一直響，沒有力度
      organ(v, t, f) {
        const level = 0.06;
        const vib = vibrato(6.2, 7, 0, t);
        for (const cents of [0, 5]) {
          const o = osc(waves.organ, f / 2, cents, v.out, t);
          vib.depth.connect(o.detune);
          v.srcs.push(o);
        }
        v.srcs.push(vib.lfo);
        const g = v.out.gain;
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(level, t + 0.012);
        click(level * 0.6, 2500, t, 0.012); // 接點的「喀」聲
        v.release = 0.035;
        return t + 600;
      },

      // 弦樂合奏：慢慢起音、延遲的抖音
      strings(v, t, f, pos) {
        const level = 0.036 * (1.1 - pos * 0.3);
        const tone = lowpass(v.out, 0.4);
        tone.frequency.value = Math.min(12000, f * 4 + 900);
        const vib = vibrato(5.2, 9, 0.6, t);
        for (const cents of [-11, 0, 11]) {
          const o = osc('sawtooth', f, cents, tone, t);
          vib.depth.connect(o.detune);
          v.srcs.push(o);
        }
        v.srcs.push(vib.lfo);
        const g = v.out.gain;
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(level, t + 0.28);
        g.setTargetAtTime(level * 0.85, t + 0.28, 0.5);
        v.release = 0.32;
        return t + 600;
      },

      // 合成器主奏：兩把鋸齒波加低八度方波，濾波器快速關閉
      synth(v, t, f) {
        const level = 0.045;
        const tone = lowpass(v.out, 5);
        tone.frequency.setValueAtTime(Math.min(14000, f * 10 + 1200), t);
        tone.frequency.setTargetAtTime(Math.min(9000, f * 3 + 500), t + 0.005, 0.12);
        v.srcs.push(osc('sawtooth', f, -7, tone, t), osc('sawtooth', f, 7, tone, t));
        v.srcs.push(osc('square', f / 2, 0, gainNode(0.4, tone), t));
        const g = v.out.gain;
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(level, t + 0.006);
        g.setTargetAtTime(level * 0.75, t + 0.006, 0.15);
        v.release = 0.07;
        v.send = 0.15;
        return t + 600;
      },

      // 超級鋸齒：七把微微走音的鋸齒波疊在一起，EDM 主旋律的招牌聲
      supersaw(v, t, f) {
        const level = 0.022;
        const tone = lowpass(v.out, 0.8);
        tone.frequency.value = Math.min(16000, f * 6 + 1800);
        for (const cents of [-24, -15, -7, 0, 7, 15, 24]) v.srcs.push(osc('sawtooth', f, cents, tone, t));
        const g = v.out.gain;
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(level, t + 0.012);
        g.setTargetAtTime(level * 0.85, t + 0.012, 0.3);
        v.release = 0.22;
        v.send = 0.18;
        return t + 600;
      },

      // 合成撥弦：濾波器瞬間關上，配回音最有電音感
      pluck(v, t, f, pos, vel) {
        const level = 0.07 * vel;
        const tone = lowpass(v.out, 3);
        tone.frequency.setValueAtTime(Math.min(15000, f * 14 + 2000), t);
        tone.frequency.setTargetAtTime(Math.min(4000, f * 1.3 + 200), t + 0.002, 0.09);
        v.srcs.push(osc('sawtooth', f, -6, tone, t), osc('square', f, 6, gainNode(0.5, tone), t));
        const g = v.out.gain;
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(level, t + 0.003);
        g.setTargetAtTime(0, t + 0.004, 0.32);
        v.release = 0.18;
        v.send = 0.32;
        return t + 3;
      },

      // 8-bit 晶片音樂：脈衝波，按久了才出現抖音
      chip(v, t, f) {
        const level = 0.05;
        const o = osc(waves.pulse, f, 0, v.out, t);
        const vib = vibrato(6, 14, 0.35, t);
        vib.depth.connect(o.detune);
        v.srcs.push(o, vib.lfo);
        const g = v.out.gain;
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(level, t + 0.002);
        g.setTargetAtTime(level * 0.7, t + 0.002, 0.2);
        v.release = 0.03;
        v.send = 0.12;
        return t + 600;
      },

      // 合成貝斯：鋸齒波加低八度正弦波，濾波器快速收起
      bass(v, t, f, pos, vel) {
        const level = 0.09 * vel;
        const tone = lowpass(v.out, 7);
        tone.frequency.setValueAtTime(Math.min(8000, f * 9 + 300), t);
        tone.frequency.setTargetAtTime(Math.min(3000, f * 2.2 + 120), t + 0.003, 0.11);
        v.srcs.push(osc('sawtooth', f, 0, tone, t), osc('sine', f / 2, 0, gainNode(0.9, v.out), t));
        const g = v.out.gain;
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(level, t + 0.004);
        g.setTargetAtTime(level * 0.8, t + 0.004, 0.25);
        v.release = 0.06;
        return t + 600;
      },

      // Wobble 貝斯：濾波器隨節奏一開一關（八分音符）
      wobble(v, t, f) {
        const level = 0.05;
        const tone = lowpass(v.out, 9);
        tone.frequency.value = Math.min(6000, f * 2 + 450);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = (tempo / 60) * 2;
        lfo.connect(gainNode(Math.min(5000, f * 2 + 380), tone.frequency));
        lfo.start(t);
        v.srcs.push(
          osc('sawtooth', f, -5, tone, t),
          osc('sawtooth', f, 5, tone, t),
          osc('sine', f / 2, 0, gainNode(0.7, v.out), t),
          lfo,
        );
        const g = v.out.gain;
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(level, t + 0.006);
        v.release = 0.06;
        return t + 600;
      },

      // 氛圍鋪底：慢慢浮現、濾波器緩緩打開
      pad(v, t, f) {
        const level = 0.03;
        const tone = lowpass(v.out, 1.5);
        tone.frequency.setValueAtTime(f * 1.2 + 200, t);
        tone.frequency.linearRampToValueAtTime(Math.min(9000, f * 5 + 900), t + 1.8);
        for (const cents of [-14, -5, 5, 14]) v.srcs.push(osc('sawtooth', f, cents, tone, t));
        const g = v.out.gain;
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(level, t + 0.7);
        v.release = 1.1;
        v.send = 0.3;
        return t + 600;
      },

      // 音樂盒：金屬簧片被撥動，放開也會自然響完
      musicbox(v, t, f, pos, vel) {
        const level = 0.11 * vel;
        const ring = 1.6 - pos * 0.9;
        const main = osc('sine', f, 0, v.out, t);
        const octave = ctx.createGain();
        octave.gain.setValueAtTime(0.18, t);
        octave.gain.setTargetAtTime(0, t, 0.4);
        octave.connect(v.out);
        const ping = ctx.createGain();
        ping.gain.setValueAtTime(0.35, t);
        ping.gain.setTargetAtTime(0, t, 0.06);
        ping.connect(v.out);
        v.srcs.push(main, osc('sine', f * 2, 0, octave, t), osc('sine', Math.min(f * 6.27, 16000), 0, ping, t));
        const g = v.out.gain;
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(level, t + 0.002);
        g.setTargetAtTime(0, t + 0.003, ring);
        click(level * 0.5, Math.min(9000, f * 6), t, 0.01);
        v.release = 0.45;
        return t + 0.1 + ring * 8;
      },
    };

    function noteOn(midi, velocity = 0.82) {
      if (!ensure()) return null;
      const prev = sounding.get(midi);
      if (prev) noteOff(prev, 0.03); // 同一個音再按一次
      if (live.size >= MAX_VOICES) {
        for (const old of live) { if (!old.released) { noteOff(old, 0.03); break; } }
      }

      const t = ctx.currentTime + 0.002;
      const f = 440 * Math.pow(2, (midi - 69) / 12);
      const pos = clamp((midi - 24) / 72, 0, 1); // 0 = 低音，1 = 高音
      const vel = clamp(velocity + (Math.random() - 0.5) * 0.08, 0.1, 1);
      const out = ctx.createGain();
      out.connect(bus);
      const v = { midi, out, srcs: [], release: 0.1, released: false };
      const end = VOICES[tone](v, t, f, pos, vel);
      v.srcs.forEach(s => s.stop(end));
      if (v.send) out.connect(gainNode(v.send, echo));
      v.srcs[0].onended = () => {
        out.disconnect();
        live.delete(v);
        if (sounding.get(midi) === v) sounding.delete(midi);
      };
      sounding.set(midi, v);
      live.add(v);
      return v;
    }

    function noteOff(v, tau) {
      if (!v || v.released || !ctx) return;
      v.released = true;
      const t = ctx.currentTime;
      const k = tau !== undefined ? tau : v.release;
      const g = v.out.gain;
      if (g.cancelAndHoldAtTime) {
        g.cancelAndHoldAtTime(t);
      } else {
        const current = g.value;
        g.cancelScheduledValues(t);
        g.setValueAtTime(current, t);
      }
      g.setTargetAtTime(0, t, k);
      v.srcs.forEach(s => { try { s.stop(t + k * 10); } catch (_) { /* 已停止 */ } });
    }

    function setTone(id) {
      if (VOICES[id]) tone = id;
    }

    // 回音長度與 Wobble 速度都跟著節奏的速度
    function setTempo(bpm) {
      tempo = bpm;
      if (echo) echo.delayTime.setTargetAtTime(Math.min(1.5, (0.75 * 60) / bpm), ctx.currentTime, 0.05);
    }

    /* ───── 鼓組（節奏伴奏用） ───── */
    function noiseHit(t, level, type, freq, q, decay) {
      const src = ctx.createBufferSource();
      src.buffer = noiseLong;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq;
      if (q) filter.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(level, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + decay);
      src.connect(filter);
      filter.connect(g);
      g.connect(drumBus);
      src.start(t, Math.random() * 0.5);
      src.stop(t + decay + 0.02);
    }

    function toneHit(t, type, from, to, sweep, level, decay) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(from, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + sweep);
      const g = ctx.createGain();
      g.gain.setValueAtTime(level, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + decay);
      o.connect(g);
      g.connect(drumBus);
      o.start(t);
      o.stop(t + decay + 0.02);
    }

    const DRUMS = {
      kick(t, v) {
        toneHit(t, 'sine', 160, 42, 0.12, 0.95 * v, 0.42);
        noiseHit(t, 0.25 * v, 'highpass', 3000, 0, 0.012);
      },
      snare(t, v) {
        noiseHit(t, 0.5 * v, 'highpass', 1400, 0, 0.17);
        toneHit(t, 'triangle', 200, 160, 0.05, 0.35 * v, 0.09);
      },
      clap(t, v) {
        noiseHit(t, 0.6 * v, 'bandpass', 1500, 1.2, 0.012);
        noiseHit(t + 0.011, 0.6 * v, 'bandpass', 1500, 1.2, 0.012);
        noiseHit(t + 0.022, 0.6 * v, 'bandpass', 1500, 1.2, 0.16);
      },
      chat(t, v) { noiseHit(t, 0.28 * v, 'highpass', 7500, 0, 0.045); },
      ohat(t, v) { noiseHit(t, 0.22 * v, 'highpass', 6500, 0, 0.3); },
      rim(t, v) {
        noiseHit(t, 0.5 * v, 'bandpass', 2600, 3, 0.03);
        toneHit(t, 'square', 1700, 0, 0, 0.08 * v, 0.02);
      },
    };

    function drum(kind, t, v) {
      if (ctx && DRUMS[kind]) DRUMS[kind](Math.max(t, ctx.currentTime), v);
    }

    const time = () => (ctx ? ctx.currentTime : 0);

    return { ensure, noteOn, noteOff, setTone, setTempo, drum, time };
  })();

  /* ───────────── DOM ───────────── */
  const $ = sel => document.querySelector(sel);
  const app = $('#app');
  const canvas = $('#stage');
  const g2 = canvas.getContext('2d');
  const pianoEl = $('#piano');
  const caseEl = $('#piano-case');

  const TONE_KEY = 'nocturne-tone';
  const savedTone = (() => { try { return localStorage.getItem(TONE_KEY); } catch (_) { return null; } })();
  const state = {
    mode: 1,
    octave: 0,
    sustain: false,
    played: false,
    tone: Math.max(0, TONES.findIndex(t => t.id === savedTone)),
  };
  const shift = () => (state.mode === 1 ? state.octave * 12 : 0);

  const keyEls = [];
  const downCount = new Array(COUNT).fill(0);

  (function buildPiano() {
    const midis = Array.from({ length: COUNT }, (_, i) => LOW + i);
    const whites = midis.filter(m => !isBlack(m)).length;
    const BLACK_W = 0.58; // 黑鍵寬度（以白鍵寬為單位）
    const LEAN = { 1: -0.12, 3: 0.12, 6: -0.16, 8: 0, 10: 0.16 }; // 真實鋼琴黑鍵並非置中
    const span = (cls, text) => {
      const el = document.createElement('span');
      el.className = cls;
      el.textContent = text;
      return el;
    };
    let w = 0;
    midis.forEach((midi, i) => {
      const el = document.createElement('div');
      const black = isBlack(midi);
      const { upper, lower } = LABELS[i];
      el.className = 'key ' + (black ? 'black' : 'white') + (upper || lower ? '' : ' unbound');
      el.dataset.index = String(i);
      el.style.setProperty('--hue', String(HUES[midi % 12]));
      if (!black) el.append(span('nn', ''));
      if (upper) el.append(span('kb up', upper));
      if (lower) el.append(span('kb lo', lower));
      if (black) {
        const centre = w + LEAN[midi % 12] * BLACK_W;
        el.style.left = ((centre - BLACK_W / 2) / whites) * 100 + '%';
        el.style.width = (BLACK_W / whites) * 100 + '%';
      } else {
        w++;
      }
      pianoEl.appendChild(el);
      keyEls.push(el);
    });
  })();

  function refreshLabels() {
    const s = shift();
    keyEls.forEach((el, i) => {
      const m = LOW + i + s;
      const nn = el.querySelector('.nn');
      if (nn) nn.textContent = noteName(m);
      el.classList.toggle('middle-c', m === 60);
      const keys = [LABELS[i].upper, LABELS[i].lower].filter(Boolean).join(' 或 ');
      el.setAttribute('aria-label', keys ? `${noteName(m)}，按鍵 ${keys}` : noteName(m));
    });
  }

  function keyDown(i, delta) {
    downCount[i] = Math.max(0, downCount[i] + delta);
    keyEls[i].classList.toggle('down', downCount[i] > 0);
  }

  /* ───────────── 畫面幾何 ───────────── */
  const LOOKAHEAD = 2.2; // M2：音符從畫面頂端落到判定線的秒數
  const WINDOWS = { perfect: 0.06, great: 0.11, good: 0.16 }; // 判定時間窗（秒）
  const G = {
    W: 0, H: 0, dpr: 1, lanes: [], left: 0, right: 0,
    pianoTop: 0, bandH: 28, bandTop: 0, hitY: 0, pps: 200, mid: 300, hudBottom: 0,
  };

  function measure() {
    G.dpr = Math.min(window.devicePixelRatio || 1, 2);
    G.W = window.innerWidth;
    G.H = window.innerHeight;
    canvas.width = Math.round(G.W * G.dpr);
    canvas.height = Math.round(G.H * G.dpr);
    G.lanes = keyEls.map(el => {
      const r = el.getBoundingClientRect();
      return { x: r.left, w: r.width, black: el.classList.contains('black') };
    });
    const whites = G.lanes.filter(l => !l.black);
    G.left = whites[0].x;
    G.right = whites[whites.length - 1].x + whites[whites.length - 1].w;
    G.pianoTop = caseEl.getBoundingClientRect().top;
    // 標頭與琴鍵之間的舞台中段：放連擊數、和弦名稱與提示文字
    const hudBottom = document.querySelector('.hud').getBoundingClientRect().bottom;
    G.mid = Math.max(hudBottom + 80, hudBottom + (G.pianoTop - hudBottom) * 0.42);
    app.style.setProperty('--stage-mid', `${Math.round(G.mid)}px`);
    app.style.setProperty('--hud-bottom', `${Math.round(hudBottom)}px`);
    G.hudBottom = hudBottom;
    placeCenter();
    // 判定區高度＝Perfect 時間窗內音符移動的距離：音符底部落在區內按下就是 Perfect
    G.bandH = clamp(2 * WINDOWS.perfect * (G.pianoTop / LOOKAHEAD), 22, 44);
    G.bandTop = G.pianoTop - G.bandH;
    G.hitY = G.pianoTop - G.bandH / 2;
    G.pps = G.hitY / LOOKAHEAD;
  }

  /* ───────────── 特效 ───────────── */
  const rises = [];   // M1 往上飄的光柱
  const sparks = [];  // 火花粒子
  const texts = [];   // 判定文字
  const flashes = new Map(); // 鍵 index → 按下時間
  const chord = { text: '', t: 0, live: false };

  function spark(x, y, hue, spread, up, life, gravity) {
    if (sparks.length > 700) return;
    sparks.push({
      x, y, hue,
      vx: (Math.random() - 0.5) * spread,
      vy: -up * (0.4 + Math.random() * 0.8),
      g: gravity,
      life: 0,
      max: life * (0.6 + Math.random() * 0.6),
      r: 1 + Math.random() * 2,
    });
  }

  function laneCentre(i) {
    const L = G.lanes[i];
    return L.x + L.w / 2;
  }

  function spawnRise(i, midi) {
    const r = { i, hue: HUES[midi % 12], t0: performance.now(), t1: null };
    rises.push(r);
    const n = reduceMotion ? 4 : 14;
    for (let k = 0; k < n; k++) spark(laneCentre(i), G.pianoTop - 2, r.hue, 160, 170, 0.9, 60);
    return r;
  }

  function hitBurst(i, midi) {
    const n = reduceMotion ? 5 : 18;
    for (let k = 0; k < n; k++) spark(laneCentre(i), G.hitY, HUES[midi % 12], 260, 260, 0.7, 380);
  }

  const GRADE_STYLE = {
    perfect: ['PERFECT', '#f3d68f'],
    great: ['GREAT', '#8fd0ff'],
    good: ['GOOD', '#c3c9d8'],
    miss: ['MISS', '#e06a6f'],
  };

  function showJudgement(i, grade, dt) {
    const [text, color] = GRADE_STYLE[grade];
    const sub = grade === 'great' || grade === 'good' ? (dt < 0 ? '早' : '晚') : '';
    texts.push({
      text, sub, color,
      x: clamp(laneCentre(i), 60, G.W - 60),
      y: G.bandTop - 16,
      t0: performance.now(),
    });
  }

  function clearFx() {
    rises.length = 0;
    sparks.length = 0;
    texts.length = 0;
    flashes.clear();
    chord.text = '';
    chord.live = false;
  }

  /* ───────────── 和弦辨識（M1） ───────────── */
  const CHORD_TYPES = [
    ['', [0, 4, 7]], ['m', [0, 3, 7]], ['dim', [0, 3, 6]], ['aug', [0, 4, 8]],
    ['sus2', [0, 2, 7]], ['sus4', [0, 5, 7]],
    ['7', [0, 4, 7, 10]], ['maj7', [0, 4, 7, 11]], ['m7', [0, 3, 7, 10]],
    ['m7♭5', [0, 3, 6, 10]], ['dim7', [0, 3, 6, 9]], ['6', [0, 4, 7, 9]], ['m6', [0, 3, 7, 9]],
  ].map(([suffix, tpl]) => [suffix, tpl.join(',')]);

  function chordName(midis) {
    const pcs = [...new Set(midis.map(m => m % 12))].sort((a, b) => a - b);
    if (pcs.length < 3) return '';
    const bass = Math.min(...midis) % 12;
    for (const root of pcs) {
      const shape = pcs.map(p => (p - root + 12) % 12).sort((a, b) => a - b).join(',');
      const hit = CHORD_TYPES.find(([, tpl]) => tpl === shape);
      if (hit) return CHORD_ROOTS[root] + hit[0] + (bass !== root ? '/' + CHORD_ROOTS[bass] : '');
    }
    return '';
  }

  /* ───────────── 彈奏 ───────────── */
  const held = new Map();      // 來源（鍵盤代碼或指標 id）→ { i, midi, voice, rise }
  const sustained = new Set(); // 延音踏板延住的聲音

  function press(id, i, time) {
    if (held.has(id)) release(id);
    const midi = LOW + i + shift();
    const voice = audio.noteOn(midi);
    const h = { i, midi, voice, rise: null };
    held.set(id, h);
    keyDown(i, 1);
    flashes.set(i, performance.now());
    if (state.mode === 1) {
      h.rise = spawnRise(i, midi);
      if (!state.played) {
        state.played = true;
        renderCenter();
      }
      updateChord();
    } else {
      hitNote(midi, time);
    }
  }

  function release(id) {
    const h = held.get(id);
    if (!h) return;
    held.delete(id);
    keyDown(h.i, -1);
    if (h.rise) h.rise.t1 = performance.now();
    if (state.mode === 1 && state.sustain) sustained.add(h.voice);
    else audio.noteOff(h.voice);
    updateChord();
  }

  function releaseAll() {
    [...held.keys()].forEach(release);
    sustained.forEach(v => audio.noteOff(v));
    sustained.clear();
  }

  function updateChord() {
    if (state.mode !== 1) return;
    const name = chordName([...held.values()].map(h => h.midi));
    if (name) {
      chord.text = name;
      chord.t = performance.now();
      chord.live = true;
    } else if (chord.live) {
      chord.live = false;
      chord.t = performance.now();
    }
  }

  /* ───────────── M2 曲譜模式 ───────────── */
  const PENDING = 0;
  const HIT = 1;
  const MISS = 2;
  const WEIGHT = { perfect: 1, great: 0.7, good: 0.4, miss: 0 };
  const parsed = window.SONGS.map(window.parseSong);

  const game = {
    index: 1,
    speed: 1,
    auto: false,
    status: 'idle', // idle | playing | paused | done
    notes: [],
    holds: [],
    st0: 0,
    clock0: 0,
    firstT: 0,
    endT: 0,
    assisted: false, // 這一輪有沒有任何音是電腦代彈的
    combo: 0,
    maxCombo: 0,
    comboAt: 0,
    weight: 0,
    judged: 0,
    counts: { perfect: 0, great: 0, good: 0, miss: 0 },
  };

  // 歌曲時間（秒，依原速計），以 performance.now() 為時鐘
  function songTime(now) {
    return game.status === 'playing' ? game.st0 + ((now - game.clock0) / 1000) * game.speed : game.st0;
  }

  function resetRun() {
    releaseHolds();
    game.notes = parsed[game.index].map(n => ({ ...n, hand: n.voice === 1 ? 'L' : 'R', state: PENDING }));
    game.firstT = game.notes.length ? game.notes[0].t : 0;
    game.endT = game.notes.reduce((m, n) => Math.max(m, n.t + n.d), 0);
    game.assisted = false;
    game.combo = 0;
    game.maxCombo = 0;
    game.weight = 0;
    game.judged = 0;
    game.counts = { perfect: 0, great: 0, good: 0, miss: 0 };
    game.st0 = -(LOOKAHEAD + 0.8) * game.speed; // 先倒數，再讓第一個音符從頂端落下
  }

  function startSong() {
    resetRun();
    game.status = 'playing';
    game.clock0 = performance.now();
    hideResult();
    renderAll();
    refreshRhythm();
  }

  function pauseSong() {
    if (game.status !== 'playing') return;
    game.st0 = songTime(performance.now());
    game.status = 'paused';
    releaseHolds();
    renderAll();
    refreshRhythm();
  }

  function resumeSong() {
    if (game.status !== 'paused') return;
    game.clock0 = performance.now();
    game.status = 'playing';
    renderAll();
    refreshRhythm();
  }

  function stopSong() {
    game.status = 'idle';
    resetRun();
    hideResult();
    renderAll();
    refreshRhythm();
  }

  function togglePlay() {
    if (game.status === 'playing') pauseSong();
    else if (game.status === 'paused') resumeSong();
    else startSong();
  }

  function selectSong(dir) {
    if (game.status === 'playing') {
      toast('演奏中無法換曲，先按 ↓ 暫停');
      return;
    }
    game.index = (game.index + dir + window.SONGS.length) % window.SONGS.length;
    stopSong();
  }

  function setSpeed(s) {
    const now = performance.now();
    if (game.status === 'playing') {
      game.st0 = songTime(now);
      game.clock0 = now;
    } else if (game.status === 'idle' || game.status === 'done') {
      game.st0 = -(LOOKAHEAD + 0.8) * s;
    }
    game.speed = s;
    renderAll();
    if (game.status === 'playing') refreshRhythm();
  }

  function judge(n, grade, dt) {
    n.state = grade === 'miss' ? MISS : HIT;
    game.counts[grade]++;
    game.judged++;
    game.weight += WEIGHT[grade];
    if (grade === 'miss') {
      game.combo = 0;
    } else {
      game.combo++;
      game.maxCombo = Math.max(game.maxCombo, game.combo);
      game.comboAt = performance.now();
      hitBurst(n.midi - LOW, n.midi);
    }
    showJudgement(n.midi - LOW, grade, dt);
    renderReadouts();
  }

  function hitNote(midi, time) {
    if (game.status !== 'playing' || game.auto) return;
    const st = game.st0 + ((time - game.clock0) / 1000) * game.speed;
    let best = null;
    let bestDt = 0;
    for (const n of game.notes) {
      if ((n.t - st) / game.speed > WINDOWS.good) break;
      if (n.state !== PENDING || n.midi !== midi) continue;
      const dt = (st - n.t) / game.speed; // 實際秒數，負值＝太早
      if (Math.abs(dt) <= WINDOWS.good && (!best || Math.abs(dt) < Math.abs(bestDt))) {
        best = n;
        bestDt = dt;
      }
    }
    if (!best) return; // 空按不扣分
    const a = Math.abs(bestDt);
    judge(best, a <= WINDOWS.perfect ? 'perfect' : a <= WINDOWS.great ? 'great' : 'good', bestDt);
  }

  function autoPlay(n) {
    const i = n.midi - LOW;
    const voice = audio.noteOn(n.midi, 0.78);
    game.assisted = true;
    keyDown(i, 1);
    flashes.set(i, performance.now());
    game.holds.push({ i, voice, until: n.t + n.d * 0.9 });
    judge(n, 'perfect', 0);
  }

  function releaseHolds() {
    game.holds.forEach(h => {
      audio.noteOff(h.voice);
      keyDown(h.i, -1);
    });
    game.holds = [];
  }

  function updateGame(now) {
    if (game.status !== 'playing') return;
    const st = songTime(now);
    for (const n of game.notes) {
      if (n.t > st) break;
      if (n.state !== PENDING) continue;
      if (game.auto) autoPlay(n);
      else if ((st - n.t) / game.speed > WINDOWS.good) judge(n, 'miss', 0);
    }
    for (let k = game.holds.length - 1; k >= 0; k--) {
      const h = game.holds[k];
      if (st >= h.until) {
        audio.noteOff(h.voice);
        keyDown(h.i, -1);
        game.holds.splice(k, 1);
      }
    }
    if (st > game.endT + 1.2 * game.speed && game.notes.every(n => n.state !== PENDING)) finishSong();
  }

  function finishSong() {
    game.st0 = songTime(performance.now()); // 停在曲末，畫面上不再留下音符
    game.status = 'done';
    releaseHolds();
    refreshRhythm();
    const song = window.SONGS[game.index];
    const total = game.notes.length || 1;
    const acc = game.weight / total;
    const score = Math.round(acc * 1e6);
    let isBest = false;
    if (!game.assisted && score > loadBest(song.id)) {
      saveBest(song.id, score);
      isBest = true;
    }
    const rank = acc >= 0.95 ? 'S' : acc >= 0.88 ? 'A' : acc >= 0.75 ? 'B' : acc >= 0.6 ? 'C' : 'D';
    $('#result-song').textContent = song.title;
    const rankEl = $('#result-rank');
    rankEl.textContent = game.assisted ? '示範' : rank;
    rankEl.classList.toggle('demo', game.assisted);
    $('#result-flag').textContent = isBest ? '新紀錄' : '';
    $('#r-score').textContent = score.toLocaleString('en-US');
    $('#r-acc').textContent = (acc * 100).toFixed(1) + '%';
    $('#r-combo').textContent = String(game.maxCombo);
    $('#r-perfect').textContent = String(game.counts.perfect);
    $('#r-great').textContent = String(game.counts.great);
    $('#r-good').textContent = String(game.counts.good);
    $('#r-miss').textContent = String(game.counts.miss);
    $('#result').hidden = false;
    renderAll();
  }

  function hideResult() {
    $('#result').hidden = true;
  }

  const BEST_KEY = 'nocturne-best';
  function loadBest(id) {
    try { return JSON.parse(localStorage.getItem(BEST_KEY) || '{}')[id] || 0; } catch (_) { return 0; }
  }
  function saveBest(id, score) {
    try {
      const all = JSON.parse(localStorage.getItem(BEST_KEY) || '{}');
      all[id] = score;
      localStorage.setItem(BEST_KEY, JSON.stringify(all));
    } catch (_) { /* 無法儲存時略過 */ }
  }

  /* ───────────── 節奏伴奏 ───────────── */
  const rhythm = {
    on: false,
    style: 0,
    bpm: STYLES[0].bpm,
    mode: 'off', // off | free（一般模式自己打拍子）| song（曲譜模式跟著曲子）
    timer: 0,
    step: 0,
    time: 0,
    lastT: 0,   // 最後一個已排程的格子時間，重新開始時避免重複敲
    song: null,
    beats: [],  // 已排程、等著亮燈的拍子
    lit: -1,
    litAt: 0,
  };
  const mod = (a, n) => ((a % n) + n) % n;

  function playStep(barStep, t) {
    if (t <= rhythm.lastT + 0.005) return;
    rhythm.lastT = t;
    const parts = STYLES[rhythm.style].parts;
    for (const kind in parts) {
      const ch = parts[kind][barStep % parts[kind].length];
      const vel = ch === 'X' ? 1 : ch === 'x' ? 0.75 : ch === 'o' ? 0.4 : 0;
      if (vel) audio.drum(kind, t, vel);
    }
    if (barStep % 4 === 0) rhythm.beats.push({ t, beat: barStep / 4 });
  }

  function rhythmTick() {
    const now = audio.time();
    const horizon = now + 0.12;
    if (rhythm.mode === 'free') {
      const steps = STYLES[rhythm.style].meter * 4;
      if (rhythm.time < now - 0.2) rhythm.time = now + 0.02; // 計時器被瀏覽器延遲過，重新對時
      while (rhythm.time < horizon) {
        playStep(rhythm.step % steps, rhythm.time);
        rhythm.step++;
        rhythm.time += 15 / rhythm.bpm; // 一格是十六分音符
      }
    } else if (rhythm.mode === 'song') {
      const s = rhythm.song;
      for (;;) {
        const songT = (rhythm.step / 4) * s.spb;
        const t = s.offset + (s.clock0 + ((songT - s.st0) / s.speed) * 1000) / 1000;
        if (t >= horizon) break;
        if (t >= now - 0.02) playStep(mod(rhythm.step - s.pickup * 4, s.meter * 4), t);
        rhythm.step++;
      }
    }
  }

  function rhythmHalt() {
    clearInterval(rhythm.timer);
    rhythm.timer = 0;
    rhythm.mode = 'off';
    rhythm.beats = [];
  }

  function rhythmRun(mode) {
    clearInterval(rhythm.timer);
    rhythm.mode = mode;
    rhythm.beats = [];
    if (mode === 'free') {
      rhythm.step = 0;
      rhythm.time = Math.max(audio.time() + 0.05, rhythm.lastT + 0.05);
      audio.setTempo(rhythm.bpm);
    } else {
      const song = window.SONGS[game.index];
      const spb = 60 / song.bpm;
      rhythm.song = {
        clock0: game.clock0, st0: game.st0, speed: game.speed, spb,
        meter: song.meter || 4, pickup: song.pickup || 0,
        // performance.now() 與 AudioContext 時鐘的差，用跟琴聲同樣的方式對時，鼓和音符才會同時響
        offset: audio.time() - performance.now() / 1000,
      };
      rhythm.step = Math.ceil((songTime(performance.now()) / spb) * 4);
      audio.setTempo(song.bpm * game.speed);
    }
    rhythm.timer = setInterval(rhythmTick, 25);
    rhythmTick();
  }

  // 一般模式：照選的速度自己打；曲譜模式：只在曲子進行時打，速度與小節跟著曲子
  function refreshRhythm(restart) {
    if (!rhythm.on || document.hidden) rhythmHalt();
    else if (state.mode === 1) {
      if (restart || rhythm.mode !== 'free') rhythmRun('free');
    } else if (game.status === 'playing') rhythmRun('song');
    else rhythmHalt();
    renderRhythm(false);
  }

  function toggleRhythm() {
    audio.ensure();
    rhythm.on = !rhythm.on;
    if (rhythm.on && state.mode === 2 && game.status !== 'playing') toast('曲子開始後，鼓會跟著曲子的拍子打');
    refreshRhythm(true);
  }

  function setStyle(index) {
    rhythm.style = mod(index, STYLES.length);
    rhythm.bpm = STYLES[rhythm.style].bpm; // 換節奏時帶入該節奏的建議速度
    renderRhythm(true);
    if (rhythm.on) refreshRhythm(true);
  }

  function nudgeTempo(delta) {
    if (state.mode === 2) {
      toast('曲譜模式的鼓跟著曲子速度，請用上方的速度按鈕調整');
      return;
    }
    rhythm.bpm = clamp(rhythm.bpm + delta, 50, 200);
    audio.setTempo(rhythm.bpm);
    renderRhythm(false);
  }

  function showBeat(beat) {
    const dots = $('#leds').children;
    for (let k = 0; k < dots.length; k++) {
      dots[k].classList.toggle('on', k === beat);
      dots[k].classList.toggle('downbeat', k === beat && beat === 0);
    }
  }

  function updateLeds(now) {
    const t = audio.time();
    while (rhythm.beats.length && rhythm.beats[0].t <= t) {
      rhythm.lit = rhythm.beats.shift().beat;
      rhythm.litAt = now;
      showBeat(rhythm.lit);
    }
    if (rhythm.lit >= 0 && now - rhythm.litAt > 110) {
      rhythm.lit = -1;
      showBeat(-1);
    }
  }

  /* 音色／節奏的選單 */
  const pad2 = n => String(n).padStart(2, '0');
  const escapeHtml = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  function buildMenu(menu, items, groups, onPick) {
    menu.innerHTML = groups.map(g =>
      `<p class="menu-group">${g.label}</p>` +
      items.map((it, i) => (it.group !== g.id ? '' :
        `<button type="button" role="option" class="menu-item" data-index="${i}" aria-selected="false">` +
        `<span class="menu-no">${pad2(i + 1)}</span><span class="menu-name">${escapeHtml(it.name)}</span>` +
        `<span class="menu-en">${escapeHtml(it.en)}</span></button>`)).join('')).join('');
    menu.addEventListener('click', e => {
      const item = e.target.closest('.menu-item');
      if (!item) return;
      onPick(Number(item.dataset.index));
      closeMenus();
    });
  }

  function closeMenus() {
    document.querySelectorAll('.menu').forEach(m => { m.hidden = true; });
    document.querySelectorAll('.lcd').forEach(l => l.setAttribute('aria-expanded', 'false'));
  }

  function toggleMenu(menu, lcd, selected) {
    const opening = menu.hidden;
    closeMenus();
    if (!opening) return;
    menu.querySelectorAll('.menu-item').forEach(b => {
      b.setAttribute('aria-selected', String(Number(b.dataset.index) === selected));
    });
    menu.hidden = false;
    lcd.setAttribute('aria-expanded', 'true');
  }

  /* ───────────── 功能鍵 ───────────── */
  function setMode(mode) {
    if (mode === state.mode) return;
    releaseAll();
    state.sustain = false;
    state.mode = mode;
    app.dataset.mode = String(mode);
    document.querySelectorAll('.mode').forEach(b => {
      b.setAttribute('aria-pressed', String(Number(b.dataset.mode) === mode));
    });
    clearFx();
    stopSong();
    refreshLabels();
    renderAll();
    measure(); // M2 的選曲列會改變標頭高度
  }

  function setOctave(o) {
    const next = clamp(o, OCTAVE_MIN, OCTAVE_MAX);
    if (next === state.octave) {
      toast(next > 0 ? '已經是最高的八度' : '已經是最低的八度');
      return;
    }
    state.octave = next;
    refreshLabels();
    renderReadouts();
  }

  function toggleSustain() {
    state.sustain = !state.sustain;
    if (!state.sustain) {
      sustained.forEach(v => audio.noteOff(v));
      sustained.clear();
    }
    renderReadouts();
  }

  // 自動示範：打開時若還沒開始就直接播放；演奏中可隨時切換成自己彈
  function setAuto(on) {
    game.auto = on;
    if (on && (game.status === 'idle' || game.status === 'done')) startSong();
    else if (on && game.status === 'paused') resumeSong();
    else renderAll();
  }

  function setTone(index, preview) {
    state.tone = (index + TONES.length) % TONES.length;
    audio.setTone(TONES[state.tone].id);
    try { localStorage.setItem(TONE_KEY, TONES[state.tone].id); } catch (_) { /* 無法儲存時略過 */ }
    renderTone(true);
    if (preview && !(state.mode === 2 && game.status === 'playing')) {
      const v = audio.noteOn(60 + shift(), 0.75); // 試聽中央 C
      setTimeout(() => audio.noteOff(v), 380);
    }
  }

  function onArrow(code) {
    if (code === 'ArrowUp') {
      setMode(state.mode === 1 ? 2 : 1);
    } else if (state.mode === 1) {
      if (code === 'ArrowLeft') setOctave(state.octave - 1);
      else if (code === 'ArrowRight') setOctave(state.octave + 1);
      else toggleSustain();
    } else {
      if (code === 'ArrowLeft') selectSong(-1);
      else if (code === 'ArrowRight') selectSong(1);
      else togglePlay();
    }
  }

  /* ───────────── 介面更新 ───────────── */
  function renderReadouts() {
    const o = state.octave;
    $('#octave-val').textContent = o > 0 ? `+${o}` : o < 0 ? `−${-o}` : '0';
    $('#range-val').textContent = `${noteName(PLAY_LOW + shift())}–${noteName(HIGH + shift())}`;
    $('#sustain-val').textContent = state.sustain ? '踩下' : '放開';
    $('#sustain-box').classList.toggle('on', state.sustain);
    const total = game.notes.length || 1;
    $('#score-val').textContent = Math.round((game.weight / total) * 1e6).toLocaleString('en-US');
    $('#combo-val').textContent = String(game.combo);
    $('#acc-val').textContent = game.judged ? ((game.weight / game.judged) * 100).toFixed(1) + '%' : '—';
  }

  function renderSongbar() {
    const song = window.SONGS[game.index];
    const best = loadBest(song.id);
    $('#song-index').textContent = `${game.index + 1} / ${window.SONGS.length}`;
    $('#song-title').textContent = song.title;
    $('#song-sub').textContent = song.sub;
    $('#song-meta').textContent =
      `♩=${song.bpm} · ${parsed[game.index].length} 音 · ${'★'.repeat(song.level)}${'☆'.repeat(3 - song.level)}` +
      (best ? ` · 最佳 ${best.toLocaleString('en-US')}` : '');
    $('#play-btn').textContent = game.status === 'playing' ? '暫停' : game.status === 'paused' ? '繼續' : '開始';
    document.querySelectorAll('.speed button').forEach(b => {
      b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === game.speed));
    });
    $('#demo-btn').setAttribute('aria-pressed', String(game.auto));
    $('#demo-text').textContent = game.auto ? '示範中' : '自動示範';
    $('#demo-badge').hidden =
      !(state.mode === 2 && game.auto && (game.status === 'playing' || game.status === 'paused'));
  }

  function renderTone(flash) {
    const t = TONES[state.tone];
    $('#tone-no').textContent = String(state.tone + 1).padStart(2, '0');
    $('#tone-name').textContent = t.name;
    $('#tone-en').textContent = t.en;
    const lcd = $('#tone-lcd');
    lcd.classList.remove('flash');
    if (flash) {
      void lcd.offsetWidth; // 重新觸發閃爍動畫
      lcd.classList.add('flash');
    }
  }

  function renderCenter() {
    const el = $('#center-msg');
    const song = window.SONGS[game.index];
    let html = '';
    if (state.mode === 1 && !state.played) {
      html =
        '<p class="cm-eyebrow">M1 · 一般模式</p>' +
        '<p class="cm-title">用鍵盤彈奏</p>' +
        '<p class="cm-hint wide-only">上兩排是一整條鋼琴：<kbd>Q</kbd>–<kbd>\\</kbd> 是白鍵、數字和 <kbd>-</kbd><kbd>=</kbd> 是黑鍵，' +
        '<br>中央 C 在 <kbd>Y</kbd>，左手放 <kbd>Q</kbd>–<kbd>T</kbd>、右手放 <kbd>Y</kbd> 以右。' +
        '<br>下兩排 <kbd>Z</kbd>–<kbd>/</kbd> 是低一個八度的低音區（琴鍵上的金字）</p>' +
        '<p class="cm-hint narrow-only">點琴鍵彈奏，按住滑過去可以刮奏。<br>接上實體鍵盤就能用字母、數字與符號鍵彈</p>';
    } else if (state.mode === 2 && game.status === 'idle') {
      html =
        `<p class="cm-eyebrow">M2 · 曲譜模式 · 第 ${game.index + 1} 首</p>` +
        `<p class="cm-title">${song.title}</p>` +
        '<p class="cm-hint">按 <kbd>↓</kbd> 自己彈，或點「自動示範」讓電腦先彈一遍。' +
        '<br>音符落進琴鍵上方的金色判定區時，按下它標示的按鍵</p>';
    } else if (state.mode === 2 && game.status === 'paused') {
      html =
        '<p class="cm-title">已暫停</p>' +
        '<p class="cm-hint"><kbd>↓</kbd> 繼續　<kbd>←</kbd><kbd>→</kbd> 換曲</p>';
    }
    if (el.dataset.html !== html) {
      el.dataset.html = html;
      el.innerHTML = html;
      el.hidden = !html;
    }
    placeCenter();
  }

  // 提示文字放在舞台中段，但不能頂到標頭
  function placeCenter() {
    const el = $('#center-msg');
    if (el.hidden) return;
    el.style.top = `${Math.round(Math.max(G.mid, G.hudBottom + el.offsetHeight / 2 + 12))}px`;
  }

  function renderRhythm(flash) {
    const style = STYLES[rhythm.style];
    const song = window.SONGS[game.index];
    $('#style-no').textContent = pad2(rhythm.style + 1);
    $('#style-name').textContent = style.name;
    $('#style-en').textContent = style.en;
    $('#rhythm-btn').setAttribute('aria-pressed', String(rhythm.on));
    $('#rhythm-text').textContent = rhythm.on ? '停止' : '開始';
    const followSong = state.mode === 2;
    $('#tempo-val').textContent = String(followSong ? Math.round(song.bpm * game.speed) : rhythm.bpm);
    document.querySelector('.tempo').classList.toggle('locked', followSong);
    const meter = followSong ? song.meter || 4 : style.meter;
    const leds = $('#leds');
    if (leds.childElementCount !== meter) leds.innerHTML = '<i></i>'.repeat(meter);
    if (flash) {
      const lcd = $('#style-lcd');
      lcd.classList.remove('flash');
      void lcd.offsetWidth;
      lcd.classList.add('flash');
    }
  }

  function renderAll() {
    renderReadouts();
    renderSongbar();
    renderCenter();
    renderRhythm(false);
  }

  let toastTimer = 0;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
  }

  /* ───────────── 繪圖 ───────────── */
  function rr(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g2.beginPath();
    g2.moveTo(x + r, y);
    g2.arcTo(x + w, y, x + w, y + h, r);
    g2.arcTo(x + w, y + h, x, y + h, r);
    g2.arcTo(x, y + h, x, y, r);
    g2.arcTo(x, y, x + w, y, r);
    g2.closePath();
  }

  function drawRises(now) {
    const speed = Math.max(180, G.pianoTop / 2.1); // 約兩秒飄到螢幕頂端
    g2.save();
    g2.globalCompositeOperation = 'lighter';
    for (let k = rises.length - 1; k >= 0; k--) {
      const r = rises[k];
      const L = G.lanes[r.i];
      const top = G.pianoTop - ((now - r.t0) / 1000) * speed;
      const bottom = r.t1 === null ? G.pianoTop : G.pianoTop - ((now - r.t1) / 1000) * speed;
      if (bottom < -30) {
        rises.splice(k, 1);
        continue;
      }
      const y = Math.min(top, bottom - 14);
      const h = bottom - y;
      const w = L.w * (L.black ? 0.78 : 0.6);
      const x = L.x + (L.w - w) / 2;
      const fade = clamp((bottom + 30) / 140, 0, 1);
      const holding = r.t1 === null;

      const grad = g2.createLinearGradient(0, y, 0, bottom);
      grad.addColorStop(0, `hsla(${r.hue},95%,78%,${0.95 * fade})`);
      grad.addColorStop(1, `hsla(${r.hue},90%,52%,${(holding ? 0.6 : 0.15) * fade})`);
      g2.shadowColor = `hsla(${r.hue},100%,60%,${0.9 * fade})`;
      g2.shadowBlur = 22;
      g2.fillStyle = grad;
      rr(x, y, w, h, Math.min(w / 2, 10));
      g2.fill();

      g2.shadowBlur = 0;
      g2.fillStyle = `hsla(${r.hue},100%,93%,${0.5 * fade})`;
      rr(x + w * 0.32, y + 3, w * 0.36, Math.max(0, h - 6), w * 0.18);
      g2.fill();

      if (holding && Math.random() < (reduceMotion ? 0.15 : 0.6)) {
        spark(x + Math.random() * w, G.pianoTop - 4, r.hue, 30, 90, 0.8, -20);
      }
    }
    g2.restore();
  }

  function drawKeyGlow(now) {
    g2.save();
    g2.globalCompositeOperation = 'lighter';
    for (let i = 0; i < COUNT; i++) {
      const f = flashes.get(i);
      let a = downCount[i] > 0 ? 0.28 : 0;
      if (f !== undefined) {
        const age = now - f;
        if (age > 420) flashes.delete(i);
        else a = Math.max(a, 0.55 * (1 - age / 420));
      }
      if (a <= 0) continue;
      const L = G.lanes[i];
      const cx = L.x + L.w / 2;
      const rad = L.w * 1.8;
      const hue = HUES[(LOW + i + shift()) % 12];
      const grad = g2.createRadialGradient(cx, G.pianoTop, 0, cx, G.pianoTop, rad);
      grad.addColorStop(0, `hsla(${hue},95%,70%,${a})`);
      grad.addColorStop(1, `hsla(${hue},95%,60%,0)`);
      g2.fillStyle = grad;
      g2.fillRect(cx - rad, G.pianoTop - rad, rad * 2, rad);
    }
    g2.restore();
  }

  function drawHighway(now) {
    // 軌道底色與分隔線
    const grad = g2.createLinearGradient(0, 0, 0, G.bandTop);
    grad.addColorStop(0, 'rgba(214,179,106,0)');
    grad.addColorStop(1, 'rgba(214,179,106,0.05)');
    g2.fillStyle = grad;
    g2.fillRect(G.left, 0, G.right - G.left, G.bandTop);

    g2.lineWidth = 1;
    G.lanes.forEach((L, i) => {
      if (L.black) return;
      const x = Math.round(L.x) + 0.5;
      g2.strokeStyle = (LOW + i) % 12 === 0 ? 'rgba(214,179,106,0.16)' : 'rgba(235,229,216,0.05)';
      g2.beginPath();
      g2.moveTo(x, 0);
      g2.lineTo(x, G.pianoTop);
      g2.stroke();
    });
    g2.strokeStyle = 'rgba(235,229,216,0.05)';
    g2.beginPath();
    g2.moveTo(Math.round(G.right) - 0.5, 0);
    g2.lineTo(Math.round(G.right) - 0.5, G.pianoTop);
    g2.stroke();

    // 判定區：琴鍵上方一排
    g2.fillStyle = 'rgba(214,179,106,0.08)';
    g2.fillRect(G.left, G.bandTop, G.right - G.left, G.bandH);
    g2.fillStyle = 'rgba(214,179,106,0.35)';
    g2.fillRect(G.left, G.bandTop, G.right - G.left, 1);

    // 按下時該軌道亮起
    g2.save();
    g2.globalCompositeOperation = 'lighter';
    for (let i = 0; i < COUNT; i++) {
      const f = flashes.get(i);
      let a = downCount[i] > 0 ? 0.4 : 0;
      if (f !== undefined) {
        const age = now - f;
        if (age > 260) flashes.delete(i);
        else a = Math.max(a, 0.6 * (1 - age / 260));
      }
      if (a <= 0) continue;
      const L = G.lanes[i];
      const hue = HUES[(LOW + i) % 12];
      g2.fillStyle = `hsla(${hue},90%,62%,${a})`;
      g2.fillRect(L.x + 1, G.bandTop, L.w - 2, G.bandH);
      const col = g2.createLinearGradient(0, G.bandTop - 110, 0, G.bandTop);
      col.addColorStop(0, `hsla(${hue},90%,60%,0)`);
      col.addColorStop(1, `hsla(${hue},90%,60%,${a * 0.35})`);
      g2.fillStyle = col;
      g2.fillRect(L.x + 1, G.bandTop - 110, L.w - 2, 110);
    }
    g2.restore();

    // 判定線
    g2.save();
    g2.shadowColor = 'rgba(240,205,130,0.9)';
    g2.shadowBlur = 12;
    g2.fillStyle = 'rgba(243,218,156,0.95)';
    g2.fillRect(G.left, G.hitY - 1, G.right - G.left, 2);
    g2.restore();
  }

  function drawTiles(now) {
    const st = songTime(now);
    const visible = [];
    for (const n of game.notes) {
      const yB = G.hitY - ((n.t - st) / game.speed) * G.pps;
      if (yB < -4) break; // 之後的音符都還在畫面上方
      const h = Math.max(16, (n.d / game.speed) * G.pps - 4);
      const yT = yB - h;
      if (yT > G.pianoTop) continue;
      if (n.state === HIT && yT >= G.hitY) continue;
      visible.push([n, yT, yB, h]);
    }
    // 先畫白鍵軌道，再把黑鍵軌道疊在上面
    for (const blackPass of [false, true]) {
      for (const [n, yT, yB, h] of visible) {
        if (G.lanes[n.midi - LOW].black === blackPass) drawTile(n, yT, yB, h);
      }
    }
  }

  function drawTile(n, yT, yB, h) {
    const i = n.midi - LOW;
    const L = G.lanes[i];
    const x = L.x + (L.black ? 1 : 2.5);
    const w = L.w - (L.black ? 2 : 5);
    const hue = HUES[n.midi % 12];

    if (n.state === MISS) {
      const a = clamp(1 - (yB - G.hitY) / 90, 0, 1) * 0.45;
      g2.fillStyle = `rgba(120,128,150,${a})`;
      rr(x, yT, w, h, 5);
      g2.fill();
      return;
    }

    const top = yT;
    const bottom = n.state === HIT ? Math.min(yB, G.hitY) : yB; // 命中後尾巴被判定線吸收
    const hh = bottom - top;
    if (hh <= 0) return;
    const near = n.state === PENDING ? clamp(1 - Math.abs(yB - G.hitY) / 120, 0, 1) : 1;
    const light = n.state === HIT ? 80 : 58 + near * 10;

    g2.save();
    g2.shadowColor = `hsla(${hue},95%,60%,${0.35 + near * 0.5})`;
    g2.shadowBlur = 8 + near * 14;
    const grad = g2.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0, `hsla(${hue},80%,${light - 14}%,0.85)`);
    grad.addColorStop(1, `hsla(${hue},90%,${light}%,1)`);
    g2.fillStyle = grad;
    rr(x, top, w, hh, Math.min(6, w / 3));
    g2.fill();
    g2.shadowBlur = 0;
    if (L.black) {
      g2.lineWidth = 1.5;
      g2.strokeStyle = 'rgba(8,10,20,0.85)';
      g2.stroke();
    }
    if (hh > 6) {
      g2.fillStyle = 'rgba(255,255,255,0.35)';
      g2.fillRect(x + 3, top + 2, w - 6, 1.5);
    }
    if (n.state === PENDING && hh >= 16 && w >= 12) {
      g2.fillStyle = 'rgba(10,12,22,0.85)';
      g2.font = `600 ${Math.round(clamp(w * 0.42, 9, 13))}px "IBM Plex Mono", ui-monospace, monospace`;
      g2.textAlign = 'center';
      g2.textBaseline = 'alphabetic';
      g2.fillText(keyLabel(i, n.hand), x + w / 2, bottom - 5);
    }
    g2.restore();

    if (n.state === HIT && Math.random() < (reduceMotion ? 0.1 : 0.5)) {
      spark(x + Math.random() * w, G.hitY, hue, 40, 120, 0.5, 200);
    }
  }

  function drawSparks(dt) {
    g2.save();
    g2.globalCompositeOperation = 'lighter';
    for (let k = sparks.length - 1; k >= 0; k--) {
      const p = sparks[k];
      p.life += dt;
      if (p.life >= p.max) {
        sparks[k] = sparks[sparks.length - 1];
        sparks.pop();
        continue;
      }
      p.vy += p.g * dt;
      p.vx *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k1 = 1 - p.life / p.max;
      g2.fillStyle = `hsla(${p.hue},95%,${60 + 25 * k1}%,${k1})`;
      g2.beginPath();
      g2.arc(p.x, p.y, p.r * (0.4 + 0.6 * k1), 0, Math.PI * 2);
      g2.fill();
    }
    g2.restore();
  }

  function drawTexts(now) {
    g2.save();
    g2.textAlign = 'center';
    g2.textBaseline = 'alphabetic';
    for (let k = texts.length - 1; k >= 0; k--) {
      const T = texts[k];
      const age = (now - T.t0) / 1000;
      if (age > 0.7) {
        texts.splice(k, 1);
        continue;
      }
      const p = age / 0.7;
      const y = T.y - 24 * (1 - Math.pow(1 - p, 3));
      g2.globalAlpha = 1 - p * p;
      g2.fillStyle = T.color;
      g2.font = 'italic 700 20px "Bodoni Moda", Georgia, serif';
      g2.fillText(T.text, T.x, y);
      if (T.sub) {
        g2.font = '500 11px "Noto Sans TC", system-ui, sans-serif';
        g2.fillText(T.sub, T.x, y + 15);
      }
    }
    g2.restore();
  }

  function drawCentre(now) {
    const cx = (G.left + G.right) / 2;
    const cy = G.mid;
    g2.save();
    g2.textAlign = 'center';
    g2.textBaseline = 'middle';

    if (state.mode === 1 && chord.text) {
      const a = chord.live ? 1 : 1 - (now - chord.t) / 900;
      if (a > 0) {
        g2.globalAlpha = a * 0.85;
        g2.fillStyle = '#ebe5d8';
        g2.font = 'italic 500 64px "Bodoni Moda", Georgia, serif';
        g2.fillText(chord.text, cx, cy);
        g2.globalAlpha = a * 0.6;
        g2.font = '500 11px "IBM Plex Mono", ui-monospace, monospace';
        g2.fillStyle = '#d6b36a';
        g2.fillText('CHORD', cx, cy + 46);
      } else {
        chord.text = '';
      }
    }

    if (state.mode === 2 && (game.status === 'playing' || game.status === 'paused')) {
      const st = songTime(now);
      const remain = (game.firstT - st) / game.speed;
      if (remain > 0) {
        if (remain <= 3) {
          const n = Math.ceil(remain);
          const frac = n - remain;
          g2.globalAlpha = 1 - frac * 0.75;
          g2.fillStyle = '#d6b36a';
          g2.font = `italic 600 ${Math.round(88 * (1 + frac * 0.25))}px "Bodoni Moda", Georgia, serif`;
          g2.fillText(String(n), cx, cy);
        }
      } else if (game.combo >= 3) {
        const pulse = reduceMotion ? 0 : Math.max(0, 1 - (now - game.comboAt) / 160);
        g2.globalAlpha = 0.9;
        g2.fillStyle = '#ebe5d8';
        g2.font = `italic 600 ${Math.round(60 * (1 + pulse * 0.14))}px "Bodoni Moda", Georgia, serif`;
        g2.fillText(String(game.combo), cx, cy);
        g2.globalAlpha = 0.65;
        g2.fillStyle = '#d6b36a';
        g2.font = '600 11px "IBM Plex Mono", ui-monospace, monospace';
        g2.fillText('COMBO', cx, cy + 44);
      }
    }
    g2.restore();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    updateGame(now);

    g2.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    g2.clearRect(0, 0, G.W, G.H);
    if (state.mode === 2) {
      drawHighway(now);
      drawTiles(now);
    } else {
      drawRises(now);
      drawKeyGlow(now);
    }
    drawSparks(dt);
    drawTexts(now);
    drawCentre(now);
    updateLeds(now);
    requestAnimationFrame(frame);
  }

  /* ───────────── 事件 ───────────── */
  const normaliseCode = code => {
    const m = /^Numpad(\d)$/.exec(code); // 數字鍵盤等同上排數字
    return m ? 'Digit' + m[1] : code;
  };
  const stamp = e =>
    typeof e.timeStamp === 'number' && Math.abs(e.timeStamp - performance.now()) < 1000 ? e.timeStamp : performance.now();

  window.addEventListener('keydown', e => {
    if (e.code === 'Escape') closeMenus();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const code = normaliseCode(e.code);
    if (ARROWS.has(code)) {
      e.preventDefault();
      audio.ensure();
      if (!e.repeat) onArrow(code);
      return;
    }
    const i = CODE_INDEX.get(code);
    if (i === undefined) return;
    e.preventDefault();
    if (e.repeat || held.has('k' + code)) return;
    press('k' + code, i, stamp(e));
  });

  window.addEventListener('keyup', e => {
    release('k' + normaliseCode(e.code));
  });

  window.addEventListener('blur', () => {
    releaseAll();
    pauseSong();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      releaseAll();
      pauseSong();
    }
    refreshRhythm(true);
  });

  // 滑鼠／觸控：可以按住後滑過琴鍵（刮奏）
  const pointerKey = new Map();
  const keyAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const key = el && el.closest ? el.closest('.key') : null;
    return key ? Number(key.dataset.index) : null;
  };
  pianoEl.addEventListener('pointerdown', e => {
    const el = e.target.closest('.key');
    if (!el) return;
    e.preventDefault();
    const i = Number(el.dataset.index);
    pointerKey.set(e.pointerId, i);
    press('p' + e.pointerId, i, stamp(e));
    try { pianoEl.setPointerCapture(e.pointerId); } catch (_) { /* 不支援時略過 */ }
  });
  pianoEl.addEventListener('pointermove', e => {
    if (!pointerKey.has(e.pointerId)) return;
    const i = keyAt(e.clientX, e.clientY);
    if (i === pointerKey.get(e.pointerId)) return;
    release('p' + e.pointerId);
    pointerKey.set(e.pointerId, i);
    if (i !== null) press('p' + e.pointerId, i, stamp(e));
  });
  const endPointer = e => {
    if (!pointerKey.has(e.pointerId)) return;
    pointerKey.delete(e.pointerId);
    release('p' + e.pointerId);
  };
  pianoEl.addEventListener('pointerup', endPointer);
  pianoEl.addEventListener('pointercancel', endPointer);
  pianoEl.addEventListener('lostpointercapture', endPointer);

  document.querySelectorAll('.mode').forEach(b => {
    b.addEventListener('click', () => {
      audio.ensure();
      setMode(Number(b.dataset.mode));
    });
  });
  $('#prev-song').addEventListener('click', () => selectSong(-1));
  $('#next-song').addEventListener('click', () => selectSong(1));
  $('#play-btn').addEventListener('click', () => {
    audio.ensure();
    togglePlay();
  });
  document.querySelectorAll('.speed button').forEach(b => {
    b.addEventListener('click', () => setSpeed(Number(b.dataset.speed)));
  });
  $('#demo-btn').addEventListener('click', () => {
    audio.ensure();
    setAuto(!game.auto);
  });
  $('#prev-tone').addEventListener('click', () => setTone(state.tone - 1, true));
  $('#next-tone').addEventListener('click', () => setTone(state.tone + 1, true));
  $('#tone-lcd').addEventListener('click', () => toggleMenu($('#tone-menu'), $('#tone-lcd'), state.tone));
  buildMenu($('#tone-menu'), TONES, TONE_GROUPS, i => setTone(i, true));
  $('#prev-style').addEventListener('click', () => setStyle(rhythm.style - 1));
  $('#next-style').addEventListener('click', () => setStyle(rhythm.style + 1));
  $('#style-lcd').addEventListener('click', () => toggleMenu($('#style-menu'), $('#style-lcd'), rhythm.style));
  buildMenu($('#style-menu'), STYLES, STYLE_GROUPS, setStyle);
  $('#rhythm-btn').addEventListener('click', toggleRhythm);
  $('#tempo-down').addEventListener('click', () => nudgeTempo(-2));
  $('#tempo-up').addEventListener('click', () => nudgeTempo(2));
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('.panel')) closeMenus();
  });

  window.addEventListener('resize', measure);
  if (window.ResizeObserver) new ResizeObserver(measure).observe(caseEl);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  /* ───────────── 啟動 ───────────── */
  audio.setTone(TONES[state.tone].id);
  renderTone(false);
  refreshLabels();
  resetRun();
  renderAll();
  measure();
  requestAnimationFrame(frame);
})();
