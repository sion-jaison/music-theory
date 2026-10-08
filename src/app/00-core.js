/* =================================================================
   Music basics
   ================================================================= */
const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const BLACK_PCS = [1, 3, 6, 8, 10];
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const mod12 = n => ((n % 12) + 12) % 12;
const isBlack = m => BLACK_PCS.indexOf(mod12(m)) >= 0;
const pcLabel = pc => SHARP[pc] === FLAT[pc] ? SHARP[pc] : SHARP[pc] + ' / ' + FLAT[pc];
const noteName = m => SHARP[mod12(m)] + (Math.floor(m / 12) - 1);
const rand = a => a[Math.floor(Math.random() * a.length)];
const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KB_LO = 48, KB_HI = 72;
const BLACK_IN_RANGE = []; for (let m = 49; m <= 70; m++) if (isBlack(m)) BLACK_IN_RANGE.push(m);

function todayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function parseDay(s) { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function addDays(s, n) { const d = parseDay(s); d.setDate(d.getDate() + n); return todayStr(d); }
function daysBetween(a, b) { return Math.round((parseDay(b) - parseDay(a)) / 86400000); }

/* =================================================================
   Event bus
   ================================================================= */
const Bus = {
  h: {},
  on(e, f) { (this.h[e] = this.h[e] || new Set()).add(f); return () => this.h[e].delete(f); },
  emit(e, d) { (this.h[e] || []).forEach(f => { try { f(d); } catch (err) { console.error(err); } }); }
};

/* =================================================================
   Storage (this browser only)
   ================================================================= */
const Store = {
  key: 'motif.v1',
  data: null,
  defaults() {
    return { v: 1, settings: { labels: true, micLatency: 40 }, units: {}, cards: {}, streak: { count: 0, last: null, rest: null }, sketches: [], range: null, history: {}, bossPassed: false, viewLevel: null, bests: {} };
  },
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(this.key)); } catch (e) { d = null; }
    this.data = Object.assign(this.defaults(), d || {});
    this.data.settings = Object.assign(this.defaults().settings, this.data.settings || {});
  },
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* storage unavailable: progress lasts this visit only */ } },
  day() {
    const t = todayStr();
    const h = this.data.history;
    if (!h[t]) h[t] = { revMs: [], revOk: 0, revN: 0, tuneOk: 0, tuneN: 0, earOk: 0, earN: 0, done: false, wins: [] };
    if (!h[t].wins) h[t].wins = [];
    return h[t];
  }
};

/* =================================================================
   Sound out
   ================================================================= */
const Sound = {
  ctx: null, master: null, busyUntil: 0,
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  now() { return this.ctx ? this.ctx.currentTime : performance.now() / 1000; },
  tone(midi, when, dur, vel) {
    const ctx = this.ensure(); if (!ctx) return;
    dur = dur || 0.5; vel = vel || 0.8;
    const t0 = Math.max(ctx.currentTime + 0.005, when == null ? ctx.currentTime : when);
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vel * 0.5, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(vel * 0.16, t0 + 0.28);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur + 0.45);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(9000, f * 9), t0);
    lp.frequency.exponentialRampToValueAtTime(Math.max(500, f * 2.2), t0 + dur + 0.4);
    lp.connect(g); g.connect(this.master);
    [[1, 'triangle', 1], [2, 'sine', 0.28], [3, 'sine', 0.09]].forEach(([mult, type, amp]) => {
      const o = ctx.createOscillator(); const og = ctx.createGain();
      o.type = type; o.frequency.value = f * mult; og.gain.value = amp;
      o.connect(og); og.connect(lp); o.start(t0); o.stop(t0 + dur + 0.5);
    });
    this.busyUntil = Math.max(this.busyUntil, t0 + dur + 0.35);
  },
  click(when, accent, soft) {
    const ctx = this.ensure(); if (!ctx) return;
    const t0 = Math.max(ctx.currentTime + 0.005, when == null ? ctx.currentTime : when);
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'square'; o.frequency.value = accent ? 1760 : 1180;
    const peak = soft ? 0.12 : (accent ? 0.35 : 0.22);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + 0.07);
    this.busyUntil = Math.max(this.busyUntil, t0 + 0.09);
  },
  wood(when) {
    const ctx = this.ensure(); if (!ctx) return;
    const t0 = Math.max(ctx.currentTime + 0.005, when);
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(1050, t0); o.frequency.exponentialRampToValueAtTime(700, t0 + 0.06);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + 0.14);
    this.busyUntil = Math.max(this.busyUntil, t0 + 0.15);
  },
  /* Run fn with every sound it makes sent to `dest` instead of the master (a loop's own gain node, so stopping it
     silences notes already scheduled). gate: false leaves the mic listening while those sounds play. */
  routed(dest, fn, opts) {
    const m = this.master, keep = this.busyUntil;
    this.master = dest;
    try { fn(); } finally { this.master = m; if (opts && opts.gate === false) this.busyUntil = keep; }
  },
  seq(notes, lead) {
    const ctx = this.ensure(); if (!ctx) return 0;
    const t0 = ctx.currentTime + (lead == null ? 0.08 : lead);
    notes.forEach(n => this.tone(n.m, t0 + n.t, n.d || 0.5, n.v || 0.8));
    const end = notes.reduce((e, n) => Math.max(e, n.t + (n.d || 0.5)), 0);
    return (t0 - ctx.currentTime + end) * 1000;
  }
};

/* =================================================================
   Listening: microphone, MIDI, computer keys, on-screen keys
   ================================================================= */
const Mic = {
  state: 'off', stream: null, analyser: null, buf: null, detect: null, track: null, onset: null, raf: 0, frame: 0, level: 0,
  src: null, chordUsers: 0, an2: null, db: null, ctrack: null,
  /* chord listening runs only while a chord task needs it: a second, finer analyser (16384-point FFT) */
  wantChords(on) { this.chordUsers = Math.max(0, this.chordUsers + (on ? 1 : -1)); this.setupChords(); },
  setupChords() {
    const need = this.chordUsers > 0 && this.state === 'on' && typeof analyzeSpectrum === 'function';
    if (need && !this.an2) {
      this.an2 = Sound.ctx.createAnalyser();
      this.an2.fftSize = 16384; this.an2.smoothingTimeConstant = 0.5;
      this.src.connect(this.an2);
      this.db = new Float32Array(this.an2.frequencyBinCount);
      /* chord analysis runs every other frame (~30 fps): 4 frames on ≈ 130 ms, 6 frames off ≈ 200 ms */
      this.ctrack = createChordTracker({ need: 4, release: 6 });
    } else if (!need && this.an2) {
      try { this.src.disconnect(this.an2); } catch (e) { /* already gone */ }
      this.an2 = null; this.db = null; this.ctrack = null;
      Bus.emit('chroma', null);
    }
  },
  async start() {
    if (this.state === 'on') return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.isSecureContext) { this.set('unsupported'); return false; }
    const ctx = Sound.ensure(); if (!ctx) { this.set('unsupported'); return false; }
    this.set('starting');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) {
      this.set(e && e.name === 'NotFoundError' ? 'nodevice' : 'blocked');
      return false;
    }
    const src = this.src = ctx.createMediaStreamSource(this.stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    src.connect(this.analyser);
    this.buf = new Float32Array(2048);
    this.detect = createPitchDetector(ctx.sampleRate, 2048, { minHz: 65, maxHz: 1400 });
    this.track = createNoteTracker({});
    this.onset = createOnsetDetector({});
    this.set('on');
    this.setupChords();
    const step = () => { this.raf = requestAnimationFrame(step); this.tick(); };
    this.raf = requestAnimationFrame(step);
    return true;
  },
  stop() {
    cancelAnimationFrame(this.raf);
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null; this.level = 0;
    this.set('off');
    this.setupChords();
  },
  set(s) { this.state = s; Bus.emit('mic', s); },
  tick() {
    const ctx = Sound.ctx; if (!ctx || !this.analyser) return;
    const b = this.buf;
    this.analyser.getFloatTimeDomainData(b);
    let e = 0; for (let i = 0; i < b.length; i++) e += b[i] * b[i];
    const rms = Math.sqrt(e / b.length);
    this.level = rms;
    const t = ctx.currentTime;
    const gate = t > Sound.busyUntil;
    const lat = (Store.data.settings.micLatency || 0) / 1000;
    const hit = this.onset(rms, t);
    if (gate && hit) {
      Bus.emit('onset', { t: t - lat, source: 'mic' });
      const off = this.track.reset();
      if (off !== null) Bus.emit('noteoff', { midi: off, source: 'mic' });
    }
    this.frame++;
    if (this.frame % 2) { this.chordTick(gate); return; }
    const r = rms > 0.008 ? this.detect(b) : { freq: 0, clarity: 0, rms: rms };
    const o = this.track.update(r, gate);
    if (o.off !== null) Bus.emit('noteoff', { midi: o.off, source: 'mic' });
    if (o.on !== null) Bus.emit('note', { midi: o.on, source: 'mic', t: t });
    Bus.emit('pitch', { midiFloat: o.midiFloat, clarity: r.clarity, rms: rms });
  },
  chordTick(gate) {
    if (!this.an2) return;
    this.an2.getFloatFrequencyData(this.db);
    const a = gate ? analyzeSpectrum(this.db, Sound.ctx.sampleRate, this.an2.fftSize) : null;
    const m = a ? matchChord(a.chroma, { bassPc: a.bassPc, played: a.played }) : null;
    Bus.emit('chroma', a);
    /* The bass of one frame can flicker during the attack, so vote over the frames that matched this same chord
       (later frames weigh more; a tie goes to the root), and correct the event once the bass has settled. */
    const key = m ? m.root + m.quality : null;
    if (key !== this.bassKey) { this.bassKey = key; this.bassHist = []; }
    if (m && a.bassPc >= 0) this.bassHist.push(a.bassPc);
    const o = this.ctrack.update(m);
    if (o.off) { Bus.emit('chordoff', { source: 'mic' }); this.held = null; }
    if (o.on) {
      /* report the chord's own notes; the raw active pitch classes include overtones (a C chord's B and D) */
      const pcs = Theory.chordPcs(Theory.rootName(o.on.root, o.on.quality), o.on.quality).sort((x, y) => x - y);
      this.held = { on: o.on, pcs, bass: this.voteBass(pcs, o.on.root), frames: 0 };
      Bus.emit('chord', chordEvent('mic', pcs, this.held.bass, o.on.root, o.on.quality));
    } else if (this.held && ++this.held.frames === 10 && this.bassKey === this.held.on.root + this.held.on.quality) {
      const b = this.voteBass(this.held.pcs, this.held.on.root);
      if (b !== this.held.bass) { this.held.bass = b; Bus.emit('chord', chordEvent('mic', this.held.pcs, b, this.held.on.root, this.held.on.quality)); }
    }
  },
  voteBass(pcs, root) {
    const votes = {};
    this.bassHist.slice(-12).forEach((b, k) => { if (pcs.indexOf(b) >= 0) votes[b] = (votes[b] || 0) + 1 + k; });
    const best = Object.keys(votes).sort((x, y) => votes[y] - votes[x] || (+y === root) - (+x === root))[0];
    return best == null ? root : +best;
  }
};

const Midi = {
  state: 'off',
  async start() {
    if (!navigator.requestMIDIAccess) { this.state = 'unsupported'; Bus.emit('midi', this.state); return false; }
    try {
      const acc = await navigator.requestMIDIAccess();
      const wire = () => acc.inputs.forEach(inp => { inp.onmidimessage = ev => this.msg(ev); });
      wire(); acc.onstatechange = wire;
      this.state = acc.inputs.size ? 'on' : 'nodevice';
    } catch (e) { this.state = 'blocked'; }
    Bus.emit('midi', this.state);
    return this.state === 'on';
  },
  msg(ev) {
    const st = ev.data[0] & 0xf0, n = ev.data[1], vel = ev.data[2];
    if (st === 0x90 && vel > 0) input(n, 'midi');
    else if (st === 0x80 || (st === 0x90 && vel === 0)) Bus.emit('noteoff', { midi: n, source: 'midi' });
  }
};

/* one entry point for every played note that is not the mic */
function input(midi, source) {
  Sound.tone(midi, null, 0.45, 0.8);
  const t = Sound.now();
  Bus.emit('note', { midi: midi, source: source, t: t });
  Bus.emit('onset', { t: t, source: source });
}
function tap(source) {
  Sound.click(null, false, true);
  Bus.emit('onset', { t: Sound.now(), source: source || 'tap' });
}

const KEYMAP = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12 };
let kbOctave = 60;
document.addEventListener('keydown', ev => {
  if (ev.repeat || ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const tag = (ev.target && ev.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const k = ev.key.toLowerCase();
  if (k === ' ') {
    if (tag === 'BUTTON') return;
    ev.preventDefault(); tap('key'); return;
  }
  if (k === 'z') { kbOctave = Math.max(36, kbOctave - 12); toast('Computer keys now start at ' + noteName(kbOctave)); return; }
  if (k === 'x') { kbOctave = Math.min(84, kbOctave + 12); toast('Computer keys now start at ' + noteName(kbOctave)); return; }
  if (k in KEYMAP) { ev.preventDefault(); input(kbOctave + KEYMAP[k], 'key'); }
});

/* =================================================================
   On-screen keyboard (the dock)
   ================================================================= */
const Keyboard = {
  el: null, keys: new Map(), marks: new Map(),
  mount(el) {
    this.el = el;
    const whites = []; for (let m = KB_LO; m <= KB_HI; m++) if (!isBlack(m)) whites.push(m);
    const W = whites.length, ww = 100 / W, bw = ww * 0.62;
    let html = '';
    whites.forEach((m, i) => {
      const lab = mod12(m) === 0 ? `<span class="c">${noteName(m)}</span>` : `<span>${SHARP[mod12(m)]}</span>`;
      html += `<button type="button" class="key w" data-m="${m}" style="left:${i * ww}%;width:${ww}%" aria-label="${noteName(m)}">${lab}</button>`;
    });
    for (let m = KB_LO; m <= KB_HI; m++) {
      if (!isBlack(m)) continue;
      const i = whites.indexOf(m - 1);
      html += `<button type="button" class="key b" data-m="${m}" style="left:${(i + 1) * ww - bw / 2}%;width:${bw}%" aria-label="${noteName(m)} (${FLAT[mod12(m)]}${Math.floor(m / 12) - 1})"><span>${SHARP[mod12(m)]}</span></button>`;
    }
    el.innerHTML = html;
    el.querySelectorAll('.key').forEach(k => this.keys.set(+k.dataset.m, k));
    el.addEventListener('pointerdown', ev => {
      const k = ev.target.closest('.key'); if (!k) return;
      ev.preventDefault();
      const m = +k.dataset.m;
      k.classList.add('down');
      input(m, 'tap');
    });
    const up = ev => { const k = ev.target.closest && ev.target.closest('.key'); if (k) k.classList.remove('down'); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', () => el.querySelectorAll('.down').forEach(k => k.classList.remove('down')), true);
    el.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { const k = ev.target.closest('.key'); if (k) { ev.preventDefault(); ev.stopPropagation(); input(+k.dataset.m, 'tap'); } } });
    Bus.on('note', d => { if (d.source === 'mic') this.flash(d.midi, 'lit', 350); });
    this.setLabels(Store.data.settings.labels);
  },
  setLabels(on) { if (this.el) this.el.classList.toggle('nolabels', !on); },
  flash(midi, cls, ms) {
    const k = this.keys.get(midi); if (!k) return;
    k.classList.add(cls);
    setTimeout(() => k.classList.remove(cls), ms || 400);
  },
  mark(midi, cls) { const k = this.keys.get(midi); if (k) k.classList.add(cls); this.marks.set(midi + ':' + cls, true); },
  markPcs(pcs, cls) { this.keys.forEach((k, m) => { if (pcs.indexOf(mod12(m)) >= 0) this.mark(m, cls); }); },
  clearMarks() { this.keys.forEach(k => k.classList.remove('hint', 'target', 'found')); this.marks.clear(); }
};

/* readout in the dock */
function mountReadout(el) {
  const heard = el.querySelector('.heard'), cents = el.querySelector('.cents'), dot = cents.querySelector('i'), hint = el.querySelector('.hint');
  const pill = el.querySelector('.mic-pill'), lvl = pill.querySelector('.lvl i'), pillTxt = pill.querySelector('.txt');
  let lastPitch = 0;
  Bus.on('note', d => { heard.textContent = noteName(d.midi); });
  Bus.on('pitch', p => {
    if (p.midiFloat == null) return;
    lastPitch = performance.now();
    const c = (p.midiFloat - Math.round(p.midiFloat)) * 100;
    dot.style.left = `calc(${50 + c}% - 5px)`;
    cents.classList.toggle('in-tune', Math.abs(c) < 12);
    cents.title = (c >= 0 ? '+' : '') + c.toFixed(0) + ' cents';
  });
  const paintPill = () => {
    const s = Mic.state;
    pill.classList.toggle('on', s === 'on');
    pill.classList.toggle('blocked', s === 'blocked' || s === 'unsupported' || s === 'nodevice');
    pillTxt.textContent = { on: 'Mic on', off: 'Turn on mic', starting: 'Asking…', blocked: 'Mic blocked', unsupported: 'No mic here', nodevice: 'No mic found' }[s] || 'Mic';
    cents.hidden = s !== 'on';
    hint.textContent = s === 'on'
      ? 'Listening. Headphones keep the app’s own sounds out of the mic.'
      : (s === 'blocked' || s === 'unsupported')
        ? 'The mic is not available on this page. Tap the keys, use A–K on your keyboard, or plug in a MIDI keyboard.'
        : 'Tap the keys, use A–K on your computer keyboard, or turn on the mic.';
  };
  Bus.on('mic', paintPill); paintPill();
  pill.addEventListener('click', async () => {
    if (Mic.state === 'on') { Mic.stop(); return; }
    const ok = await Mic.start();
    if (!ok) toast(micProblem());
  });
  (function meter() { lvl.style.width = Math.min(100, Mic.level * 600) + '%'; if (performance.now() - lastPitch > 400) cents.classList.remove('in-tune'); requestAnimationFrame(meter); })();
}
function micProblem() {
  if (Mic.state === 'nodevice') return 'No microphone was found on this device.';
  return 'This page can’t use the mic here. Open the standalone version from your own site or localhost to use it.';
}

/* =================================================================
   Small UI helpers
   ================================================================= */
let toastTimer = 0;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3600);
}
function fb(el, kind, text) { el.className = 'fb ' + kind; el.textContent = text; }
function playBtn(label) { return `<button type="button" class="btn small" data-act="play">▶ ${label || 'Play'}</button>`; }

/* Pitch lane: a scrolling picture of what the mic or keys are doing */
function PitchLane(canvas) {
  const ctx2 = canvas.getContext('2d');
  const pts = []; let raf = 0, alive = true;
  const LO = 40, HI = 84, SPAN = 5;
  const offP = Bus.on('pitch', p => { if (p.midiFloat != null) pts.push({ t: performance.now() / 1000, m: p.midiFloat, kind: 'mic' }); });
  const offN = Bus.on('note', d => { if (d.source !== 'mic') pts.push({ t: performance.now() / 1000, m: d.midi, kind: 'tap' }); });
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function draw() {
    if (!alive) return;
    raf = requestAnimationFrame(draw);
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2.clearRect(0, 0, w, h);
    const y = m => h - 10 - (m - LO) / (HI - LO) * (h - 20);
    ctx2.font = '11px ' + css('--f-mono');
    for (let m = LO; m <= HI; m++) {
      if (mod12(m) !== 0) continue;
      ctx2.strokeStyle = css('--line'); ctx2.lineWidth = 1;
      ctx2.beginPath(); ctx2.moveTo(36, y(m)); ctx2.lineTo(w, y(m)); ctx2.stroke();
      ctx2.fillStyle = css('--muted'); ctx2.fillText(noteName(m), 4, y(m) + 4);
    }
    const now = performance.now() / 1000;
    while (pts.length && pts[0].t < now - SPAN) pts.shift();
    const x = t => 36 + (w - 60) * (1 - (now - t) / SPAN);
    ctx2.fillStyle = css('--accent');
    pts.forEach(p => {
      const r = p.kind === 'tap' ? 6 : 3;
      ctx2.beginPath(); ctx2.arc(x(p.t), y(Math.max(LO, Math.min(HI, p.m))), r, 0, Math.PI * 2); ctx2.fill();
    });
    const last = pts[pts.length - 1];
    if (last && now - last.t < 0.4) {
      ctx2.fillStyle = css('--glow');
      ctx2.beginPath(); ctx2.arc(w - 24, y(Math.max(LO, Math.min(HI, last.m))), 10, 0, Math.PI * 2); ctx2.fill();
    }
  }
  draw();
  return { stop() { alive = false; cancelAnimationFrame(raf); offP(); offN(); } };
}

/* Rhythm notation: durations in beats, negative = rest */
function rhythmSVG(pattern, marks) {
  const bw = 72, x0 = 64, y = 46;
  let x = x0, s = '';
  const syl = [];
  pattern.forEach((d, i) => {
    const rest = d < 0, dur = Math.abs(d);
    const cx = x + 12;
    const mark = marks && marks[i];
    if (rest) {
      if (dur === 1) s += `<path class="ink" d="M${cx - 3} ${y - 18} l7 9 -6 6 7 9 -4 -1 -4 5" fill="none" stroke-width="2.4"/>`;
      else s += `<rect class="ink" x="${cx - 8}" y="${y - 7}" width="16" height="6"/>`;
      syl.push({ x: cx, t: 'sh', i });
    } else {
      const hollow = dur >= 2;
      s += `<ellipse class="${hollow ? 'hollow' : 'ink'}" cx="${cx}" cy="${y}" rx="8" ry="6" transform="rotate(-20 ${cx} ${y})"/>`;
      if (dur < 4) s += `<line class="ink" x1="${cx + 7}" y1="${y - 2}" x2="${cx + 7}" y2="${y - 36}" stroke-width="2"/>`;
      if (dur === 0.5) {
        const nextIsPair = pattern[i + 1] === 0.5 && pairStart(pattern, i);
        if (nextIsPair) s += `<rect class="ink" x="${cx + 6}" y="${y - 38}" width="${bw / 2 + 2}" height="5"/>`;
      }
      const t = dur === 4 ? 'ta-a-a-a' : dur === 2 ? 'ta-a' : dur === 1 ? 'ta' : 'ti';
      syl.push({ x: cx, t, i });
    }
    if (mark) s += `<circle class="${mark === 'ok' ? 'ok' : 'no'}" cx="${cx}" cy="${y + 40}" r="5"/>`;
    x += dur * bw;
  });
  const width = x + 20;
  const sylTxt = syl.map(o => `<text class="syl" x="${o.x}" y="${y + 26}" text-anchor="middle">${o.t}</text>`).join('');
  return `<svg viewBox="0 0 ${width} 100" role="img" aria-label="Rhythm: ${syl.map(o => o.t).join(' ')}"><line class="ink" x1="10" y1="${y}" x2="${width - 6}" y2="${y}" stroke-width="1"/><text class="ts" x="22" y="${y - 4}">4</text><text class="ts" x="22" y="${y + 16}">4</text><line class="ink" x1="${width - 6}" y1="${y - 14}" x2="${width - 6}" y2="${y + 14}" stroke-width="2"/>${s}${sylTxt}</svg>`;
}
function pairStart(p, i) { let k = 0; for (let j = 0; j < i; j++) k += Math.abs(p[j]); return Math.abs(k - Math.floor(k)) < 1e-6; }

function fretSVG() {
  const names = []; for (let i = 0; i <= 12; i++) names.push(40 + i);
  const fw = 52, x0 = 30, y = 40;
  let s = `<line class="string" x1="${x0}" y1="${y}" x2="${x0 + fw * 12.5}" y2="${y}"/>`;
  for (let i = 0; i <= 12; i++) s += `<line x1="${x0 + fw * i + fw / 2}" y1="${y - 18}" x2="${x0 + fw * i + fw / 2}" y2="${y + 18}" stroke-width="${i === 0 ? 4 : 1.5}"/>`;
  names.forEach((m, i) => {
    const cx = x0 + fw * i, blk = isBlack(m);
    s += `<circle class="dot${blk ? ' blk' : ''}" cx="${cx}" cy="${y}" r="15"/><text x="${cx}" y="${y + 4}" text-anchor="middle" ${blk ? 'style="fill:#fff"' : ''}>${SHARP[mod12(m)]}</text><text class="num" x="${cx}" y="${y + 34}" text-anchor="middle">${i === 0 ? 'open' : i}</text>`;
  });
  return `<svg viewBox="0 0 ${x0 + fw * 12.5 + 10} 84" role="img" aria-label="Low E string: open E, then F, F sharp, G, up to E again at fret 12">${s}</svg>`;
}
