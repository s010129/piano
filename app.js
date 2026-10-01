/* 夜曲鋼琴 Nocturne — 主程式 */
(() => {
  'use strict';

  /* ───────────── 鍵位與音名 ─────────────
   * 下排 Z–M 是低音區白鍵，夾在中間的 S D G H J 是黑鍵；
   * 上排 Q–P 是高音區白鍵，上方的數字 2 3 5 6 7 9 0 是黑鍵。
   * 排列方式對照真實琴鍵：白鍵一列、黑鍵在它上面一列。
   */
  const KEYS = [
    ['KeyZ', 'Z', 48], ['KeyS', 'S', 49], ['KeyX', 'X', 50], ['KeyD', 'D', 51], ['KeyC', 'C', 52],
    ['KeyV', 'V', 53], ['KeyG', 'G', 54], ['KeyB', 'B', 55], ['KeyH', 'H', 56], ['KeyN', 'N', 57],
    ['KeyJ', 'J', 58], ['KeyM', 'M', 59],
    ['KeyQ', 'Q', 60], ['Digit2', '2', 61], ['KeyW', 'W', 62], ['Digit3', '3', 63], ['KeyE', 'E', 64],
    ['KeyR', 'R', 65], ['Digit5', '5', 66], ['KeyT', 'T', 67], ['Digit6', '6', 68], ['KeyY', 'Y', 69],
    ['Digit7', '7', 70], ['KeyU', 'U', 71], ['KeyI', 'I', 72], ['Digit9', '9', 73], ['KeyO', 'O', 74],
    ['Digit0', '0', 75], ['KeyP', 'P', 76],
  ];
  const LOW = 48;
  const HIGH = 76;
  const COUNT = HIGH - LOW + 1;
  const LABELS = KEYS.map(k => k[1]);
  const CODE_INDEX = new Map(KEYS.map(([code, , midi]) => [code, midi - LOW]));
  const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const OCTAVE_MIN = -2;
  const OCTAVE_MAX = 2;

  const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const CHORD_ROOTS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  // 史克里亞賓《普羅米修斯》色光鍵盤：依五度圈為每個音配一種色相
  const HUES = [0, 276, 52, 300, 192, 345, 232, 28, 286, 128, 322, 212];

  const isBlack = m => [1, 3, 6, 8, 10].includes(m % 12);
  const noteName = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ───────────── 音色：Web Audio 合成鋼琴 ───────────── */
  const audio = (() => {
    let ctx = null;
    let bus = null;
    let waves = null;
    let noise = null;
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
        const master = ctx.createGain();
        master.gain.value = 0.95;
        bus.connect(comp);
        bus.connect(room);
        room.connect(wet);
        wet.connect(comp);
        comp.connect(master);
        master.connect(ctx.destination);

        // 低音區泛音豐富、高音區接近純音
        waves = {
          low: harmonicWave([0.55, 1, 0.8, 0.62, 0.48, 0.36, 0.28, 0.2, 0.15, 0.11, 0.08, 0.06, 0.045, 0.03]),
          mid: harmonicWave([1, 0.62, 0.38, 0.24, 0.16, 0.1, 0.07, 0.045, 0.03, 0.02]),
          high: harmonicWave([1, 0.28, 0.1, 0.04, 0.02]),
        };
        noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.1), ctx.sampleRate);
        const nd = noise.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }

    function noteOn(midi, velocity = 0.82) {
      if (!ensure()) return null;
      const prev = sounding.get(midi);
      if (prev) noteOff(prev, 0.03); // 同一條弦再敲一次
      if (live.size >= MAX_VOICES) {
        for (const v of live) { if (!v.released) { noteOff(v, 0.03); break; } }
      }

      const t = ctx.currentTime + 0.002;
      const f = 440 * Math.pow(2, (midi - 69) / 12);
      const pos = clamp((midi - 24) / 72, 0, 1); // 0 = 低音，1 = 高音
      const vel = clamp(velocity + (Math.random() - 0.5) * 0.08, 0.1, 1);
      const level = 0.11 * vel * (1.1 - pos * 0.45);
      const ring = 3.2 - pos * 2.5; // 餘音的時間常數（秒）

      const out = ctx.createGain();
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.Q.value = 0.6;
      tone.frequency.setValueAtTime(Math.min(16000, f * (5 + 9 * vel) + 900), t);
      tone.frequency.setTargetAtTime(Math.min(9000, f * 2.4 + 350), t + 0.01, 0.18 + (1 - pos) * 0.5);
      tone.connect(out);
      out.connect(bus);

      const wave = midi < 52 ? waves.low : midi < 77 ? waves.mid : waves.high;
      const oscs = [-1, 1].map(side => {
        const o = ctx.createOscillator();
        o.setPeriodicWave(wave);
        o.frequency.value = f;
        o.detune.value = side * (0.9 + pos * 1.6); // 多條弦微微走音的合唱感
        o.connect(tone);
        o.start(t);
        return o;
      });

      const g = out.gain;
      g.setValueAtTime(0, t);
      g.linearRampToValueAtTime(level, t + 0.004);
      g.setTargetAtTime(level * 0.38, t + 0.006, 0.07 + (1 - pos) * 0.16);
      g.setTargetAtTime(0, t + 0.28, ring);

      // 琴槌敲弦的短促噪音
      const hammer = ctx.createBufferSource();
      hammer.buffer = noise;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = Math.min(7000, f * 3 + 500);
      band.Q.value = 0.9;
      const hg = ctx.createGain();
      hg.gain.setValueAtTime(level * 0.9, t);
      hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
      hammer.connect(band);
      band.connect(hg);
      hg.connect(bus);
      hammer.start(t);
      hammer.stop(t + 0.05);

      const end = t + 0.3 + ring * 7;
      oscs.forEach(o => o.stop(end));
      const v = { midi, out, oscs, released: false };
      oscs[0].onended = () => {
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
      const pos = clamp((v.midi - 24) / 72, 0, 1);
      const k = tau !== undefined ? tau : 0.14 - pos * 0.08; // 制音器落下
      const g = v.out.gain;
      if (g.cancelAndHoldAtTime) {
        g.cancelAndHoldAtTime(t);
      } else {
        const current = g.value;
        g.cancelScheduledValues(t);
        g.setValueAtTime(current, t);
      }
      g.setTargetAtTime(0, t, k);
      v.oscs.forEach(o => { try { o.stop(t + k * 10); } catch (_) { /* 已停止 */ } });
    }

    return { ensure, noteOn, noteOff };
  })();

  /* ───────────── DOM ───────────── */
  const $ = sel => document.querySelector(sel);
  const app = $('#app');
  const canvas = $('#stage');
  const g2 = canvas.getContext('2d');
  const pianoEl = $('#piano');
  const caseEl = $('#piano-case');

  const state = { mode: 1, octave: 0, sustain: false, played: false };
  const shift = () => (state.mode === 1 ? state.octave * 12 : 0);

  const keyEls = [];
  const downCount = new Array(COUNT).fill(0);

  (function buildPiano() {
    const whites = KEYS.filter(k => !isBlack(k[2])).length;
    const BLACK_W = 0.58; // 黑鍵寬度（以白鍵寬為單位）
    const LEAN = { 1: -0.12, 3: 0.12, 6: -0.16, 8: 0, 10: 0.16 }; // 真實鋼琴黑鍵並非置中
    let w = 0;
    KEYS.forEach(([, label, midi], i) => {
      const el = document.createElement('div');
      const black = isBlack(midi);
      el.className = 'key ' + (black ? 'black' : 'white');
      el.dataset.index = String(i);
      el.style.setProperty('--hue', String(HUES[midi % 12]));
      el.innerHTML = black
        ? `<span class="kb">${label}</span>`
        : `<span class="nn"></span><span class="kb">${label}</span>`;
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
      el.setAttribute('aria-label', `${noteName(m)}，按鍵 ${LABELS[i]}`);
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
    pianoTop: 0, bandH: 28, bandTop: 0, hitY: 0, pps: 200, mid: 300,
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
    G.mid = Math.max(hudBottom + 60, hudBottom + (G.pianoTop - hudBottom) * 0.42);
    app.style.setProperty('--stage-mid', `${Math.round(G.mid)}px`);
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
    game.notes = parsed[game.index].map(n => ({ ...n, state: PENDING }));
    game.firstT = game.notes.length ? game.notes[0].t : 0;
    game.endT = game.notes.reduce((m, n) => Math.max(m, n.t + n.d), 0);
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
  }

  function pauseSong() {
    if (game.status !== 'playing') return;
    game.st0 = songTime(performance.now());
    game.status = 'paused';
    releaseHolds();
    renderAll();
  }

  function resumeSong() {
    if (game.status !== 'paused') return;
    game.clock0 = performance.now();
    game.status = 'playing';
    renderAll();
  }

  function stopSong() {
    game.status = 'idle';
    resetRun();
    hideResult();
    renderAll();
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
    renderSongbar();
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
    const song = window.SONGS[game.index];
    const total = game.notes.length || 1;
    const acc = game.weight / total;
    const score = Math.round(acc * 1e6);
    let isBest = false;
    if (!game.auto && score > loadBest(song.id)) {
      saveBest(song.id, score);
      isBest = true;
    }
    const rank = acc >= 0.95 ? 'S' : acc >= 0.88 ? 'A' : acc >= 0.75 ? 'B' : acc >= 0.6 ? 'C' : 'D';
    $('#result-song').textContent = song.title;
    const rankEl = $('#result-rank');
    rankEl.textContent = game.auto ? '示範' : rank;
    rankEl.classList.toggle('demo', game.auto);
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
    $('#range-val').textContent = `${noteName(LOW + shift())}–${noteName(HIGH + shift())}`;
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
    $('#auto-play').checked = game.auto;
  }

  function renderCenter() {
    const el = $('#center-msg');
    const song = window.SONGS[game.index];
    let html = '';
    if (state.mode === 1 && !state.played) {
      html =
        '<p class="cm-eyebrow">M1 · 一般模式</p>' +
        '<p class="cm-title">用鍵盤彈奏</p>' +
        '<p class="cm-hint">下排 <kbd>Z</kbd>–<kbd>M</kbd> 與上排 <kbd>Q</kbd>–<kbd>P</kbd> 是白鍵，' +
        '<br>各自上面一排的字母與數字是黑鍵</p>';
    } else if (state.mode === 2 && game.status === 'idle') {
      html =
        `<p class="cm-eyebrow">M2 · 曲譜模式 · 第 ${game.index + 1} 首</p>` +
        `<p class="cm-title">${song.title}</p>` +
        '<p class="cm-hint">按 <kbd>↓</kbd> 開始。音符落進琴鍵上方的金色判定區時，按下它標示的按鍵</p>';
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
  }

  function renderAll() {
    renderReadouts();
    renderSongbar();
    renderCenter();
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
      g2.fillText(LABELS[i], x + w / 2, bottom - 5);
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
  $('#auto-play').addEventListener('change', e => {
    game.auto = e.target.checked;
    audio.ensure();
  });

  window.addEventListener('resize', measure);
  if (window.ResizeObserver) new ResizeObserver(measure).observe(caseEl);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  /* ───────────── 啟動 ───────────── */
  refreshLabels();
  resetRun();
  renderAll();
  measure();
  requestAnimationFrame(frame);
})();
