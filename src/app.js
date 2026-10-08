(function () {
'use strict';

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
    return { v: 1, settings: { labels: true, micLatency: 40 }, units: {}, cards: {}, streak: { count: 0, last: null, rest: null }, sketches: [], range: null, history: {}, bossPassed: false };
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
    if (!h[t]) h[t] = { revMs: [], revOk: 0, revN: 0, tuneOk: 0, tuneN: 0, earOk: 0, earN: 0, done: false };
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
    const src = ctx.createMediaStreamSource(this.stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    src.connect(this.analyser);
    this.buf = new Float32Array(2048);
    this.detect = createPitchDetector(ctx.sampleRate, 2048, { minHz: 65, maxHz: 1400 });
    this.track = createNoteTracker({});
    this.onset = createOnsetDetector({});
    this.set('on');
    const step = () => { this.raf = requestAnimationFrame(step); this.tick(); };
    this.raf = requestAnimationFrame(step);
    return true;
  },
  stop() {
    cancelAnimationFrame(this.raf);
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null; this.level = 0;
    this.set('off');
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
    if (this.frame % 2) return;
    const r = rms > 0.008 ? this.detect(b) : { freq: 0, clarity: 0, rms: rms };
    const o = this.track.update(r, gate);
    if (o.off !== null) Bus.emit('noteoff', { midi: o.off, source: 'mic' });
    if (o.on !== null) Bus.emit('note', { midi: o.on, source: 'mic', t: t });
    Bus.emit('pitch', { midiFloat: o.midiFloat, clarity: r.clarity, rms: rms });
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

/* =================================================================
   Tasks: each takes (element, params, done) and returns a cleanup
   ================================================================= */
const Tasks = {};

Tasks.climb = (el, p, done) => {
  el.innerHTML = `<p class="prompt">${p.prompt}</p><div class="lane-wrap"><canvas class="lane" aria-label="Pitch picture"></canvas></div><div class="progress-dots">${'<span></span>'.repeat(3)}</div><p class="fb info" aria-live="polite">${Mic.state === 'on' ? 'Sing or play. The dot follows you.' : 'Tap keys or turn on the mic.'}</p>`;
  const lane = PitchLane(el.querySelector('canvas'));
  const dots = el.querySelectorAll('.progress-dots span'), f = el.querySelector('.fb');
  let seq = [], finished = false;
  const off = Bus.on('note', d => {
    if (finished) return;
    const last = seq[seq.length - 1];
    if (last === d.midi) return;
    if (last === undefined || (p.dir > 0 ? d.midi > last : d.midi < last)) seq.push(d.midi); else seq = [d.midi];
    dots.forEach((s, i) => s.classList.toggle('on', i < seq.length));
    if (seq.length >= 3) {
      finished = true;
      fb(f, 'good', seq.map(noteName).join(' → ') + (p.dir > 0 ? ': each one higher.' : ': each one lower.'));
      done(true);
    } else fb(f, 'info', seq.length === 1 ? 'Now go ' + (p.dir > 0 ? 'higher.' : 'lower.') : 'One more, ' + (p.dir > 0 ? 'higher still.' : 'lower still.'));
  });
  return () => { off(); lane.stop(); };
};

Tasks.octave = (el, p, done) => {
  const rounds = p.rounds || 3; let r = 0, target = 0;
  el.innerHTML = `<p class="prompt">Listen, then find the same note in a different octave: higher or lower.</p><div class="row">${playBtn('Hear it again')}<div class="progress-dots">${'<span></span>'.repeat(rounds)}</div></div><p class="fb info" aria-live="polite"></p>`;
  const f = el.querySelector('.fb'), dots = el.querySelectorAll('.progress-dots span');
  const play = () => Sound.tone(target, Sound.now() + 0.05, 0.9);
  const next = () => { target = randInt(53, 67); play(); fb(f, 'info', 'Listening for its octave…'); };
  el.querySelector('[data-act="play"]').onclick = play;
  const off = Bus.on('note', d => {
    if (r >= rounds) return;
    if (d.midi === target) { fb(f, 'info', 'That is the exact same note. Now find it higher or lower.'); return; }
    if (mod12(d.midi) === mod12(target)) {
      dots[r].classList.add('on'); r++;
      fb(f, 'good', `${noteName(target)} and ${noteName(d.midi)}: same letter, ${Math.abs(d.midi - target) / 12} octave${Math.abs(d.midi - target) > 12 ? 's' : ''} apart.`);
      if (r >= rounds) done(true); else setTimeout(next, 1200);
    } else fb(f, 'bad', `That is ${noteName(d.midi)}. An octave sounds like the same note, only higher or lower.`);
  });
  setTimeout(next, 300);
  return off;
};

Tasks.findAll = (el, p, done) => {
  const need = p.need || 3, found = new Set();
  el.innerHTML = `<p class="prompt">Play every ${SHARP[p.pc]} you can reach. You need ${need}.</p><div class="notes-strip"><span class="empty">None yet</span></div><p class="fb info" aria-live="polite">${p.tip || ''}</p>`;
  const strip = el.querySelector('.notes-strip'), f = el.querySelector('.fb');
  const off = Bus.on('note', d => {
    if (found.size >= need) return;
    if (mod12(d.midi) === p.pc) {
      if (found.has(d.midi)) { fb(f, 'info', `You already found ${noteName(d.midi)}. Try another octave.`); return; }
      found.add(d.midi); Keyboard.mark(d.midi, 'found');
      strip.innerHTML = [...found].sort((a, b) => a - b).map(m => `<span class="n">${noteName(m)}</span>`).join('');
      if (found.size >= need) { fb(f, 'good', `All ${need}. Same letter, different octaves.`); done(true); } else fb(f, 'good', `${noteName(d.midi)}. ${need - found.size} to go.`);
    } else fb(f, 'bad', `That is ${noteName(d.midi)}. ${p.tip || ''}`);
  });
  return () => { off(); Keyboard.clearMarks(); };
};

Tasks.nameBlack = (el, p, done) => {
  const order = shuffle(BLACK_PCS).slice(0, p.rounds || 4); let r = 0;
  el.innerHTML = `<p class="prompt">The glowing black key has two names. Pick both, then check.</p><div class="choices"></div><div class="row"><button type="button" class="btn primary small" data-act="check" disabled>Check</button><div class="progress-dots">${'<span></span>'.repeat(order.length)}</div></div><p class="fb info" aria-live="polite"></p>`;
  const box = el.querySelector('.choices'), chk = el.querySelector('[data-act="check"]'), f = el.querySelector('.fb'), dots = el.querySelectorAll('.progress-dots span');
  let pc = 0, picked = new Set();
  function show() {
    Keyboard.clearMarks(); pc = order[r]; picked = new Set();
    Keyboard.mark(60 + pc, 'target');
    const others = shuffle(BLACK_PCS.filter(x => x !== pc)).slice(0, 2);
    const opts = shuffle([pc, ...others].reduce((a, x) => a.concat([SHARP[x], FLAT[x]]), []));
    box.innerHTML = opts.map(o => `<button type="button" class="choice" aria-pressed="false" data-v="${o}">${o}</button>`).join('');
    chk.disabled = true; fb(f, 'info', 'Hint: count from the white key on each side.');
  }
  box.onclick = ev => {
    const b = ev.target.closest('.choice'); if (!b) return;
    const v = b.dataset.v;
    if (picked.has(v)) picked.delete(v); else if (picked.size < 2) picked.add(v);
    box.querySelectorAll('.choice').forEach(c => c.setAttribute('aria-pressed', picked.has(c.dataset.v)));
    chk.disabled = picked.size !== 2;
  };
  chk.onclick = () => {
    const ok = picked.has(SHARP[pc]) && picked.has(FLAT[pc]);
    box.querySelectorAll('.choice').forEach(c => { if (c.dataset.v === SHARP[pc] || c.dataset.v === FLAT[pc]) c.classList.add('right'); else if (picked.has(c.dataset.v)) c.classList.add('wrong'); });
    chk.disabled = true;
    dots[r].classList.add(ok ? 'on' : 'miss'); r++;
    if (ok) fb(f, 'good', `${SHARP[pc]} is one key above ${SHARP[pc - 1]}; ${FLAT[pc]} is one key below ${SHARP[(pc + 1) % 12]}.`);
    else fb(f, 'bad', `This key is ${SHARP[pc]} (one above ${SHARP[pc - 1]}) and ${FLAT[pc]} (one below ${SHARP[(pc + 1) % 12]}). It comes back in your review deck.`);
    if (r >= order.length) { setTimeout(() => Keyboard.clearMarks(), 1200); done(true); } else setTimeout(show, ok ? 1500 : 2600);
  };
  show();
  return () => Keyboard.clearMarks();
};

Tasks.playName = (el, p, done) => {
  const items = p.items.slice(); const limit = p.limit || 0; const pass = p.pass || items.length;
  let i = 0, score = 0, timer = 0, t0 = 0;
  el.innerHTML = `<p class="prompt">${p.prompt || 'Play this note, in any octave.'}</p><div class="big-name" aria-live="polite"></div>${limit ? '<div class="timer"><i></i></div>' : ''}<div class="progress-dots">${'<span></span>'.repeat(items.length)}</div><p class="fb info" aria-live="polite"></p><div class="row" hidden><button type="button" class="btn small" data-act="retry">Try again</button></div>`;
  const big = el.querySelector('.big-name'), f = el.querySelector('.fb'), dots = el.querySelectorAll('.progress-dots span'), bar = el.querySelector('.timer i'), retry = el.querySelector('.row');
  let finished = false;
  function show() {
    const it = items[i]; big.textContent = it.label; t0 = performance.now();
    if (limit) {
      bar.style.transition = 'none'; bar.style.transform = 'scaleX(1)';
      requestAnimationFrame(() => { bar.style.transition = `transform ${limit}s linear`; bar.style.transform = 'scaleX(0)'; });
      clearTimeout(timer); timer = setTimeout(() => result(false, 'Time. That was ' + it.label + '.'), limit * 1000);
    }
  }
  function result(ok, msg) {
    clearTimeout(timer);
    dots[i].classList.add(ok ? 'on' : 'miss'); if (ok) score++;
    fb(f, ok ? 'good' : 'bad', msg);
    i++;
    if (i >= items.length) {
      finished = true; big.textContent = score + ' / ' + items.length;
      if (score >= pass) { fb(f, 'good', `${score} of ${items.length}. ${p.passMsg || 'Done.'}`); done(true, { score }); }
      else { fb(f, 'bad', `${score} of ${items.length}. You need ${pass}.`); retry.hidden = false; }
    } else setTimeout(show, 650);
  }
  el.querySelector('[data-act="retry"]').onclick = () => { i = 0; score = 0; finished = false; retry.hidden = true; dots.forEach(d => d.className = ''); show(); };
  const off = Bus.on('note', d => {
    if (finished || i >= items.length) return;
    const it = items[i];
    if (mod12(d.midi) === it.pc) result(true, `${noteName(d.midi)} in ${((performance.now() - t0) / 1000).toFixed(1)} s.`);
    else if (!limit) fb(f, 'bad', `That is ${noteName(d.midi)}. Try again.`);
    else result(false, `That is ${noteName(d.midi)}; the target was ${it.label}.`);
  });
  show();
  return () => { off(); clearTimeout(timer); };
};

Tasks.step = (el, p, done) => {
  const rounds = p.rounds || 5; let r = 0, q = null;
  el.innerHTML = `<p class="prompt"></p><div class="progress-dots">${'<span></span>'.repeat(rounds)}</div><p class="fb info" aria-live="polite">The glowing key is where you start.</p>`;
  const pr = el.querySelector('.prompt'), f = el.querySelector('.fb'), dots = el.querySelectorAll('.progress-dots span');
  function next() {
    Keyboard.clearMarks();
    const start = rand([60, 62, 64, 65, 67, 69, 71]);
    const dir = Math.random() < 0.65 ? 1 : -1, size = Math.random() < 0.5 ? 1 : 2;
    q = { start, dir, size, want: start + dir * size };
    Keyboard.mark(start, 'target');
    pr.textContent = `${size === 1 ? 'Half' : 'Whole'} step ${dir > 0 ? 'up' : 'down'} from ${SHARP[mod12(start)]}`;
  }
  const off = Bus.on('note', d => {
    if (!q || r >= rounds) return;
    if (d.midi === q.start) return;
    if (mod12(d.midi) === mod12(q.want)) {
      dots[r].classList.add('on'); r++;
      fb(f, 'good', `${pcLabel(mod12(q.want))}. ${q.size === 2 ? 'Two keys: ' + SHARP[mod12(q.start)] + ' → ' + pcLabel(mod12(q.start + q.dir)) + ' → ' + pcLabel(mod12(q.want)) + '.' : 'The very next key.'}`);
      if (r >= rounds) { Keyboard.clearMarks(); q = null; done(true); } else setTimeout(next, 1100);
    } else fb(f, 'bad', `That is ${noteName(d.midi)}. ${q.size === 1 ? 'A half step is the very next key, black or white.' : 'A whole step skips exactly one key.'}`);
  });
  next();
  return () => { off(); Keyboard.clearMarks(); };
};

Tasks.chromatic = (el, p, done) => {
  el.innerHTML = `<p class="prompt">Start on any C and play every key, black and white, up to the next C. That is 13 notes.</p><div class="notes-strip"><span class="empty">Waiting for your first note</span></div><p class="fb info" aria-live="polite"></p>`;
  const strip = el.querySelector('.notes-strip'), f = el.querySelector('.fb');
  let run = [], finished = false;
  const off = Bus.on('note', d => {
    if (finished) return;
    if (run.length && d.midi === run[run.length - 1] + 1) run.push(d.midi);
    else run = [d.midi];
    strip.innerHTML = run.map(m => `<span class="n">${SHARP[mod12(m)]}</span>`).join('');
    if (run.length >= 13) { finished = true; fb(f, 'good', 'All 12 half steps: that is the chromatic scale.'); done(true); }
    else fb(f, run.length === 1 ? 'info' : 'good', run.length === 1 ? 'Now the very next key up.' : `${run.length} of 13`);
  });
  return off;
};

Tasks.range = (el, p, done) => {
  function noMic() {
    el.innerHTML = `<p class="prompt">This step listens to your voice, so it needs the mic.</p><p class="fb info">${Mic.state === 'blocked' || Mic.state === 'unsupported' ? micProblem() : 'Turn on the mic to find your range, or skip it for now.'}</p><div class="row"><button type="button" class="btn primary" data-act="mic">Turn on mic</button><button type="button" class="btn" data-act="skip">Skip for now</button></div>`;
    el.querySelector('[data-act="mic"]').onclick = async () => { if (await Mic.start()) start(); else toast(micProblem()); };
    el.querySelector('[data-act="skip"]').onclick = () => done(true, { skipped: true });
  }
  let offP = null, lane = null;
  function start() {
    el.innerHTML = `<p class="prompt"></p><div class="lane-wrap"><canvas class="lane"></canvas></div><p class="fb info" aria-live="polite">Hold the note steady for about two seconds.</p>`;
    lane = PitchLane(el.querySelector('canvas'));
    const pr = el.querySelector('.prompt'), f = el.querySelector('.fb');
    let phase = 'low', samples = [], low = null;
    pr.textContent = 'Sing your lowest comfortable note on “ah” and hold it.';
    offP = Bus.on('pitch', q => {
      if (q.midiFloat == null || q.clarity < 0.9) { samples = []; return; }
      samples.push(q.midiFloat);
      if (samples.length > 3) {
        const med = samples.slice().sort((a, b) => a - b)[Math.floor(samples.length / 2)];
        samples = samples.filter(v => Math.abs(v - med) < 1);
      }
      if (samples.length >= 36) {
        const val = Math.round(mean(samples)); samples = [];
        if (phase === 'low') { low = val; phase = 'high'; pr.textContent = 'Now your highest comfortable note. No straining.'; fb(f, 'good', `Low note: ${noteName(low)}.`); }
        else {
          const lo = Math.min(low, val), hi = Math.max(low, val), span = hi - lo;
          const zl = lo + Math.round(span * 0.2), zh = hi - Math.round(span * 0.2);
          Store.data.range = { lo, hi, zl, zh }; Store.save();
          offP(); offP = null;
          pr.textContent = `Your range: ${noteName(lo)} to ${noteName(hi)}, ${span} half steps.`;
          fb(f, 'good', `Home zone: ${noteName(zl)} to ${noteName(zh)}. Singing tasks will stay inside it.`);
          done(true);
        }
      }
    });
  }
  if (Mic.state === 'on') start(); else noMic();
  return () => { if (offP) offP(); if (lane) lane.stop(); };
};

/* timing helpers for rhythm tasks */
function scheduleLights(lights, times, beatIdx) {
  const ids = [];
  times.forEach((t, i) => {
    const delay = Math.max(0, (t - Sound.now()) * 1000);
    ids.push(setTimeout(() => { lights.forEach(l => l.classList.remove('lit')); const L = lights[beatIdx(i)]; if (L) L.classList.add('lit'); }, delay));
  });
  return () => ids.forEach(clearTimeout);
}
function tapPadHTML() { return `<button type="button" class="tap-pad" data-act="tap">Tap here, press Space, or clap</button>`; }
function wireTapPad(el) {
  const b = el.querySelector('[data-act="tap"]'); if (!b) return;
  b.addEventListener('pointerdown', ev => { ev.preventDefault(); tap('tap'); });
}

Tasks.pulse = (el, p, done) => {
  const bpm = p.bpm || 80, spb = 60 / bpm, beats = 8;
  el.innerHTML = `<p class="prompt">Keep the beat at ${bpm} BPM for two bars, clapping a little louder on beat 1.</p><div class="beats"><span class="strong"></span><span></span><span></span><span></span></div>${tapPadHTML()}<div class="offsets" hidden></div><div class="row"><button type="button" class="btn primary" data-act="go">Start: four clicks, then you</button></div><p class="fb info" aria-live="polite">${Mic.state === 'on' ? 'With the mic on, the clicks stop after the count-in so the mic only hears you. Keep the beat with the light.' : 'Tap along with the clicks.'}</p>`;
  wireTapPad(el);
  const lights = [...el.querySelectorAll('.beats span')], go = el.querySelector('[data-act="go"]'), f = el.querySelector('.fb'), offs = el.querySelector('.offsets');
  let onsets = [], listening = false, cancelLights = null, endTimer = 0;
  const off = Bus.on('onset', d => { if (listening) onsets.push(d.t); });
  go.onclick = () => {
    const ctx = Sound.ensure(); if (!ctx) { fb(f, 'bad', 'This browser has no Web Audio, so the metronome can’t run.'); return; }
    go.disabled = true; offs.hidden = true; onsets = [];
    const t0 = ctx.currentTime + 0.35;
    const silent = Mic.state === 'on';
    const all = [];
    for (let i = 0; i < 4 + beats; i++) {
      const t = t0 + i * spb; all.push(t);
      if (i < 4 || !silent) Sound.click(t, i % 4 === 0, i >= 4);
    }
    const expected = all.slice(4);
    cancelLights = scheduleLights(lights, all, i => i % 4);
    fb(f, 'info', 'One, two, three, four…');
    setTimeout(() => { listening = true; fb(f, 'info', 'Your turn.'); }, Math.max(0, (t0 + 3.5 * spb - ctx.currentTime) * 1000));
    endTimer = setTimeout(() => {
      listening = false; lights.forEach(l => l.classList.remove('lit'));
      const used = new Set(); let hits = 0; const errs = [];
      const cells = expected.map(t => {
        let best = -1, bd = 1;
        onsets.forEach((o, k) => { if (!used.has(k) && Math.abs(o - t) < bd) { bd = Math.abs(o - t); best = k; } });
        if (best >= 0 && bd <= 0.15) { used.add(best); hits++; const e = (onsets[best] - t) * 1000; errs.push(Math.abs(e)); return e; }
        return null;
      });
      offs.hidden = false;
      offs.innerHTML = cells.map((e, i) => {
        if (e === null) return `<div><div class="bar"><i class="miss"></i></div>${i % 4 + 1}</div>`;
        const top = 50 - Math.max(-48, Math.min(48, e / 150 * 48));
        return `<div><div class="bar"><i class="${Math.abs(e) < 50 ? '' : (e < 0 ? 'early' : 'late')}" style="top:calc(${top}% - 3px)"></i></div>${i % 4 + 1}</div>`;
      }).join('');
      go.disabled = false; go.textContent = 'Go again';
      if (hits >= 6) { fb(f, 'good', `${hits} of 8 beats, ${Math.round(mean(errs))} ms off on average. Bars above the line were early, below were late.`); done(true, { hits }); }
      else fb(f, 'bad', `${hits} of 8 beats landed. Watch the light and try again: you need 6.`);
    }, Math.max(0, (expected[beats - 1] + 0.5 - ctx.currentTime) * 1000));
  };
  return () => { off(); if (cancelLights) cancelLights(); clearTimeout(endTimer); };
};

const PATTERNS = [[1, 1, 1, 1], [1, 1, 2], [0.5, 0.5, 1, 0.5, 0.5, 1], [1, -1, 1, 1], [2, 0.5, 0.5, 1], [4], [0.5, 0.5, 0.5, 0.5, 2]];
Tasks.clapback = (el, p, done) => {
  const list = [PATTERNS[0]].concat(shuffle(PATTERNS.slice(1)).slice(0, (p.rounds || 3) - 1));
  const spb = 60 / (p.bpm || 72);
  let r = 0, onsets = [], listening = false, timers = [];
  el.innerHTML = `<p class="prompt">Listen, then clap or tap the rhythm back.</p><div class="notation"></div><div class="beats"><span class="strong"></span><span></span><span></span><span></span></div>${tapPadHTML()}<div class="row"><button type="button" class="btn" data-act="hear">▶ Hear it</button><button type="button" class="btn primary" data-act="go">My turn</button><div class="progress-dots">${'<span></span>'.repeat(list.length)}</div></div><p class="fb info" aria-live="polite"></p>`;
  wireTapPad(el);
  const nota = el.querySelector('.notation'), f = el.querySelector('.fb'), dots = el.querySelectorAll('.progress-dots span'), lights = [...el.querySelectorAll('.beats span')];
  const hear = el.querySelector('[data-act="hear"]'), go = el.querySelector('[data-act="go"]');
  const off = Bus.on('onset', d => { if (listening) onsets.push(d.t); });
  const starts = pat => { const out = []; let b = 0; pat.forEach(d => { if (d > 0) out.push(b); b += Math.abs(d); }); return out; };
  const draw = marks => { nota.innerHTML = rhythmSVG(list[r], marks); };
  function clearT() { timers.forEach(clearTimeout); timers = []; }
  hear.onclick = () => {
    const ctx = Sound.ensure(); if (!ctx) return; clearT();
    const t0 = ctx.currentTime + 0.3;
    for (let i = 0; i < 4; i++) Sound.click(t0 + i * spb, i === 0, true);
    const bar = t0 + 4 * spb;
    starts(list[r]).forEach(b => Sound.wood(bar + b * spb));
    const times = []; for (let i = 0; i < 8; i++) times.push(t0 + i * spb);
    const cancel = scheduleLights(lights, times, i => i % 4); timers.push(setTimeout(() => { cancel(); lights.forEach(l => l.classList.remove('lit')); }, (8 * spb + 0.6) * 1000));
  };
  go.onclick = () => {
    const ctx = Sound.ensure(); if (!ctx) return; clearT();
    go.disabled = true; hear.disabled = true; onsets = [];
    const t0 = ctx.currentTime + 0.3;
    for (let i = 0; i < 4; i++) Sound.click(t0 + i * spb, i === 0, true);
    const bar = t0 + 4 * spb;
    const times = []; for (let i = 0; i < 8; i++) times.push(t0 + i * spb);
    scheduleLights(lights, times, i => i % 4);
    timers.push(setTimeout(() => { listening = true; fb(f, 'info', 'Your turn.'); }, (3.6 * spb + 0.3) * 1000));
    timers.push(setTimeout(() => {
      listening = false; lights.forEach(l => l.classList.remove('lit'));
      const exp = starts(list[r]).map(b => bar + b * spb);
      const used = new Set(); const marks = []; let matched = 0;
      exp.forEach(t => {
        let best = -1, bd = 1;
        onsets.forEach((o, k) => { if (!used.has(k) && Math.abs(o - t) < bd) { bd = Math.abs(o - t); best = k; } });
        if (best >= 0 && bd <= 0.14) { used.add(best); matched++; marks.push('ok'); } else marks.push('no');
      });
      const extra = onsets.filter((o, k) => !used.has(k) && o > bar - 0.15).length;
      const full = []; let mi = 0; list[r].forEach(d => full.push(d > 0 ? marks[mi++] : null));
      draw(full);
      go.disabled = false; hear.disabled = false;
      if (matched === exp.length && extra <= 1) {
        dots[r].classList.add('on'); r++;
        fb(f, 'good', 'Every note landed.');
        if (r >= list.length) { done(true); go.disabled = true; hear.disabled = true; }
        else timers.push(setTimeout(() => { draw(); fb(f, 'info', 'Next rhythm. Hear it first.'); }, 1600));
      } else fb(f, 'bad', `${matched} of ${exp.length} notes landed${extra > 1 ? `, plus ${extra} extra claps` : ''}. Red dots show the ones to fix. Hear it again, then retry.`);
    }, (8 * spb + 0.55) * 1000));
  };
  draw();
  return () => { off(); clearT(); };
};

function blackCall() {
  const L = BLACK_IN_RANGE.filter(m => m >= 54 && m <= 70);
  let i = randInt(1, L.length - 3); const out = [L[i]];
  while (out.length < 4) { i = Math.max(0, Math.min(L.length - 1, i + rand([-2, -1, 1, 1, 2]))); out.push(L[i]); }
  return out;
}
Tasks.echo = (el, p, done) => {
  let phase = 'echo', round = 0, call = blackCall(), got = [];
  el.innerHTML = `<p class="prompt"></p><div class="notes-strip"></div><div class="row">${playBtn('Hear the call')}<button type="button" class="btn small" data-act="clear">Start over</button></div><p class="fb info" aria-live="polite"></p><div class="row" data-save hidden><button type="button" class="btn primary small" data-act="save">Save this answer to my sketchbook</button></div>`;
  const pr = el.querySelector('.prompt'), strip = el.querySelector('.notes-strip'), f = el.querySelector('.fb'), saveRow = el.querySelector('[data-save]');
  const play = () => Sound.seq(call.map((m, i) => ({ m, t: i * 0.42, d: 0.38 })));
  const paint = () => { strip.innerHTML = got.length ? got.map(m => `<span class="n">${SHARP[mod12(m)]}</span>`).join('') : '<span class="empty">Your notes appear here</span>'; };
  const setPrompt = () => { pr.textContent = phase === 'echo' ? `Echo ${round + 1} of 2: play the call back, note for note, on black keys.` : 'Now answer it: four black-key notes of your own that are different from the call.'; };
  el.querySelector('[data-act="play"]').onclick = play;
  el.querySelector('[data-act="clear"]').onclick = () => { got = []; paint(); fb(f, 'info', ''); };
  el.querySelector('[data-act="save"]').onclick = () => {
    saveSketch({ name: 'Answer to a call', notes: got.map((m, i) => ({ m, t: i * 0.42 })), prompt: 'Echo and answer' });
    saveRow.hidden = true; fb(f, 'good', 'Saved to your sketchbook.');
  };
  const off = Bus.on('note', d => {
    if (phase === 'done') return;
    got.push(d.midi); paint();
    if (got.length < 4) return;
    const same = got.every((m, i) => mod12(m) === mod12(call[i]));
    if (phase === 'echo') {
      if (same) {
        round++; fb(f, 'good', 'Exact echo.');
        if (round >= 2) { phase = 'answer'; call = blackCall(); }
        else call = blackCall();
        got = []; setTimeout(() => { paint(); setPrompt(); play(); }, 1200);
      } else {
        strip.innerHTML = got.map((m, i) => `<span class="n${mod12(m) === mod12(call[i]) ? '' : ' off'}">${SHARP[mod12(m)]}</span>`).join('');
        fb(f, 'bad', 'Close. The red notes differ from the call. Hear it again and retry.'); got = [];
      }
    } else {
      const allBlack = got.every(isBlack);
      if (!allBlack) { fb(f, 'bad', 'Keep the answer on black keys so it fits the call.'); got = []; return; }
      if (same) { fb(f, 'bad', 'That repeats the call exactly. Change at least one note to make it yours.'); got = []; return; }
      phase = 'done';
      fb(f, 'good', 'That is your answer. Listen to the call and answer together.');
      Sound.seq(call.map((m, i) => ({ m, t: i * 0.42, d: 0.38 })).concat(got.map((m, i) => ({ m, t: 2 + i * 0.42, d: 0.38 }))));
      saveRow.hidden = false; done(true);
    }
  });
  paint(); setPrompt(); setTimeout(play, 300);
  return off;
};

Tasks.motif = (el, p, done) => {
  let notes = [], rec = false, tStart = 0;
  el.innerHTML = `<p class="prompt">${p.prompt}</p><div class="notes-strip"></div><div class="row"><button type="button" class="btn primary" data-act="rec">● Record</button><button type="button" class="btn" data-act="play" disabled>▶ Play back</button><button type="button" class="btn ghost" data-act="clear" disabled>Clear</button></div><div class="field"><label for="motif-name">Name it</label><input id="motif-name" type="text" maxlength="40" placeholder="e.g. Rain on the roof"></div><div class="row"><button type="button" class="btn primary" data-act="save" disabled>Save to sketchbook</button></div><p class="fb info" aria-live="polite">${p.blackOnly ? 'Black keys only. Any order sounds good.' : ''}</p>`;
  const strip = el.querySelector('.notes-strip'), f = el.querySelector('.fb');
  const bRec = el.querySelector('[data-act="rec"]'), bPlay = el.querySelector('[data-act="play"]'), bClear = el.querySelector('[data-act="clear"]'), bSave = el.querySelector('[data-act="save"]'), name = el.querySelector('#motif-name');
  const max = p.max || 8, min = p.min || 3;
  const paint = () => {
    strip.innerHTML = notes.length ? notes.map(n => `<span class="n">${SHARP[mod12(n.m)]}</span>`).join('') : '<span class="empty">Press Record, then play your notes</span>';
    bPlay.disabled = !notes.length; bClear.disabled = !notes.length; bSave.disabled = notes.length < min;
  };
  bRec.onclick = () => { rec = !rec; bRec.textContent = rec ? '■ Stop' : '● Record'; if (rec) { notes = []; tStart = 0; paint(); fb(f, 'info', 'Recording. Play up to ' + max + ' notes.'); } };
  bPlay.onclick = () => Sound.seq(notes.map(n => ({ m: n.m, t: n.t, d: 0.4 })));
  bClear.onclick = () => { notes = []; paint(); };
  bSave.onclick = () => {
    const s = saveSketch({ name: name.value.trim() || 'Motif ' + (Store.data.sketches.length + 1), notes, prompt: p.prompt });
    fb(f, 'good', `Saved “${s.name}” to your sketchbook.`); bSave.disabled = true; done(true);
  };
  const off = Bus.on('note', d => {
    if (!rec) return;
    if (p.blackOnly && !isBlack(d.midi)) { fb(f, 'bad', `${noteName(d.midi)} is a white key. This motif uses black keys only.`); return; }
    if (!notes.length) tStart = d.t || Sound.now();
    notes.push({ m: d.midi, t: Math.max(0, Math.min(8, (d.t || Sound.now()) - tStart)) });
    paint();
    if (notes.length >= max) { rec = false; bRec.textContent = '● Record'; fb(f, 'info', 'That is ' + max + ' notes. Play it back, name it, save it.'); }
  });
  paint();
  return off;
};

Tasks.choice = (el, p, done) => {
  el.innerHTML = `<p class="prompt">${p.q}</p><div class="choices">${p.options.map((o, i) => `<button type="button" class="choice" data-i="${i}">${o}</button>`).join('')}</div><p class="fb info" aria-live="polite"></p>`;
  const box = el.querySelector('.choices'), f = el.querySelector('.fb'); let answered = false;
  box.onclick = ev => {
    const b = ev.target.closest('.choice'); if (!b || answered) return;
    answered = true; const ok = +b.dataset.i === p.answer;
    b.classList.add(ok ? 'right' : 'wrong');
    box.querySelector(`[data-i="${p.answer}"]`).classList.add('right');
    fb(f, ok ? 'good' : 'bad', p.why || (ok ? 'Right.' : 'Not this time.'));
    done(ok);
  };
  return () => {};
};

Tasks.card = (el, step) => {
  el.innerHTML = `<div class="body">${step.body}</div>${step.play ? `<div class="row">${playBtn(step.playLabel)}</div>` : ''}${step.fret ? `<div class="fret">${fretSVG()}</div>` : ''}${step.rhythm ? `<div class="notation">${rhythmSVG(step.rhythm)}</div>` : ''}`;
  const b = el.querySelector('[data-act="play"]');
  if (b) b.onclick = () => { if (step.play === 'metronome') { const ctx = Sound.ensure(); if (!ctx) return; const t0 = ctx.currentTime + 0.1; for (let i = 0; i < 8; i++) Sound.click(t0 + i * 0.75, i % 4 === 0); } else Sound.seq(step.play); };
  if (step.marks) Keyboard.markPcs(step.marks, 'hint');
  return () => Keyboard.clearMarks();
};

/* =================================================================
   Level 1 content
   ================================================================= */
const ARC = ['Hear', 'Echo', 'Explore', 'Name', 'Create'];
const UNITS = [
  { id: '1.1', title: 'What a note is', blurb: 'Turn vibration into a dot you can steer.', steps: [
    { k: 'card', tag: 'Hear', title: 'Low, then high', play: [{ m: 45, t: 0, d: 0.9 }, { m: 76, t: 1.0, d: 0.9 }], playLabel: 'Play two notes', body: '<p>Press play: a low note, then a high one.</p><p>Every sound is something vibrating: a string, your vocal cords, a speaker. The faster it vibrates, the higher it sounds. That height is called <b>pitch</b>.</p>' },
    { k: 'task', tag: 'Echo', type: 'climb', p: { dir: 1, prompt: 'Make the dot climb: play or sing three notes, each higher than the last.' } },
    { k: 'task', tag: 'Explore', type: 'climb', p: { dir: -1, prompt: 'Now make it fall: three notes, each lower than the last.' } },
    { k: 'card', tag: 'Name', title: 'A note is a pitch with a name', body: '<p>The A above middle C vibrates <b>440 times a second</b>, written 440 Hz. Every tuner in the world agrees on that number, so every musician agrees on what “A” means.</p><p>The readout in the dock does the same job: it turns vibrations into a name.</p>' }
  ] },
  { id: '1.2', title: 'Octaves', blurb: 'Why seven letters are enough.', steps: [
    { k: 'card', tag: 'Hear', title: 'Three notes, one name', play: [{ m: 45, t: 0, d: 0.8 }, { m: 57, t: 0.9, d: 0.8 }, { m: 69, t: 1.8, d: 0.8 }], playLabel: 'Play A2, A3, A4', body: '<p>These three notes sound like the same note at different heights. Each vibrates exactly twice as fast as the one before: 110, 220, 440 Hz.</p>' },
    { k: 'task', tag: 'Echo', type: 'octave', p: { rounds: 3 } },
    { k: 'card', tag: 'Name', title: 'Double it and you get an octave', body: '<p>Doubling the vibrations gives an <b>octave</b>. Because octaves sound like the same note, music needs only 7 letters: A B C D E F G, then the alphabet starts again.</p><p>The number after a letter says which octave: A4 is the 440 Hz A. Middle C is C4.</p>' }
  ] },
  { id: '1.3', title: 'The keyboard map', blurb: 'Black-key groups are your landmarks.', steps: [
    { k: 'card', tag: 'Hear', title: 'Twos and threes', marks: [1, 3, 6, 8, 10], body: '<p>Look at the dock: the black keys come in groups of two and three, over and over. Those groups are the landmarks for every white key.</p>' },
    { k: 'card', tag: 'Name', title: 'C and F', marks: [0, 5], body: '<p><b>C</b> sits just left of every group of two black keys. <b>F</b> sits just left of every group of three. The glowing keys are all the Cs and Fs.</p>' },
    { k: 'task', tag: 'Echo', type: 'findAll', p: { pc: 0, need: 3, tip: 'Look left of each pair of black keys.' } },
    { k: 'task', tag: 'Explore', type: 'findAll', p: { pc: 5, need: 3, tip: 'Look left of each group of three.' } },
    { k: 'task', tag: 'Explore', type: 'playName', p: { prompt: 'Find each note from the nearest landmark, in any octave.', items: shuffle([2, 4, 7, 9, 11]).map(pc => ({ pc, label: SHARP[pc] })) } }
  ] },
  { id: '1.4', title: 'Sharps, flats, two names', blurb: 'One black key, two names.', steps: [
    { k: 'card', tag: 'Name', title: '♯ up, ♭ down', marks: [1], body: '<p><b>♯ (sharp)</b> means one key higher. <b>♭ (flat)</b> means one key lower.</p><p>The glowing key is one key above C, so it is C♯. It is also one key below D, so it is D♭. One key, two names: these are called <b>enharmonic</b> notes. A double sharp (𝄪) or double flat (𝄫) moves two keys.</p>' },
    { k: 'task', tag: 'Echo', type: 'nameBlack', p: { rounds: 4 } },
    { k: 'task', tag: 'Explore', type: 'playName', p: { prompt: 'Play each one, in any octave.', items: shuffle([[6, 'F♯'], [10, 'B♭'], [3, 'E♭'], [1, 'C♯']]).map(([pc, label]) => ({ pc, label })) } }
  ] },
  { id: '1.5', title: 'Half and whole steps', blurb: 'The only two rulers you need.', steps: [
    { k: 'card', tag: 'Hear', title: 'Small and smaller', play: [{ m: 64, t: 0, d: 0.6 }, { m: 65, t: 0.65, d: 0.6 }, { m: 64, t: 1.6, d: 0.6 }, { m: 66, t: 2.25, d: 0.6 }], playLabel: 'E → F, then E → F♯', body: '<p>First a half step, then a whole step. Hear how the second gap is wider.</p>' },
    { k: 'card', tag: 'Name', title: 'Half step, whole step', body: '<p>A <b>half step</b> is the very next key, black or white, with nothing between (on a guitar, the next fret). A <b>whole step</b> is two half steps.</p><p>B to C and E to F are half steps with no black key between them.</p>' },
    { k: 'task', tag: 'Echo', type: 'step', p: { rounds: 5 } },
    { k: 'task', tag: 'Explore', type: 'chromatic', p: {} }
  ] },
  { id: '1.6', title: 'Guitar and voice view', blurb: 'Same 12 notes, other instruments.', steps: [
    { k: 'card', tag: 'Name', title: 'One fret, one half step', fret: true, body: '<p>A guitar holds the same 12 notes, laid out in a line. Each fret raises the string one half step, so the low E string reaches E again at fret 12: one octave.</p>' },
    { k: 'task', tag: 'Explore', type: 'range', p: {} }
  ] },
  { id: '1.7', title: 'Beat, tempo, strong and weak', blurb: 'Feel the pulse before you count it.', steps: [
    { k: 'card', tag: 'Hear', title: 'ONE two three four', play: 'metronome', playLabel: 'Play two bars at 80 BPM', body: '<p>A <b>beat</b> is the steady pulse you tap your foot to. <b>Tempo</b> is how fast it goes, in beats per minute (BPM).</p><p>Beats group into bars. Beat 1 of each bar is strong; the others are weaker. Listen for the higher click on beat 1.</p>' },
    { k: 'task', tag: 'Echo', type: 'pulse', p: { bpm: 80 } },
    { k: 'task', tag: 'Explore', type: 'pulse', p: { bpm: 100 } }
  ] },
  { id: '1.8', title: 'Note lengths in 4/4 and 2/4', blurb: 'Count rhythms with ta and ti-ti.', steps: [
    { k: 'card', tag: 'Name', title: 'How long a note lasts', rhythm: [4], body: '<p>Note shapes tell you how many beats a sound lasts. In 4/4 there are four beats in every bar:</p><p><b>Whole note</b> 4 beats (ta-a-a-a) · <b>half note</b> 2 (ta-a) · <b>quarter note</b> 1 (ta) · <b>two eighth notes</b> share 1 beat (ti-ti) · a <b>quarter rest</b> is 1 beat of silence (sh).</p><p>2/4 means two beats a bar, like a march. Saying the syllables out loud is the fastest way to feel a rhythm.</p>' },
    { k: 'task', tag: 'Echo', type: 'clapback', p: { rounds: 3, bpm: 72 } }
  ] },
  { id: '1.9', title: 'Echo and answer', blurb: 'Music as a conversation.', steps: [
    { k: 'card', tag: 'Hear', title: 'Call and response', body: '<p>Music often works like conversation: one phrase calls, another answers. Copying a phrase exactly trains your ear. Changing it makes it yours.</p><p>Everything here uses black keys only. Together they form a <b>pentatonic</b> scale, so nothing you play will clash.</p>' },
    { k: 'task', tag: 'Echo', type: 'echo', p: {} }
  ] },
  { id: '1.M', title: 'Your first motif', blurb: 'Make something of your own.', create: true, steps: [
    { k: 'card', tag: 'Name', title: 'A motif is a seed', body: '<p>A <b>motif</b> is a short musical idea, often only 3 or 4 notes, that a whole piece can grow from. You will keep coming back to the one you make now: Level 2 turns it into a phrase, and Level 5 grows it into an 8-bar piece.</p>' },
    { k: 'task', tag: 'Create', type: 'motif', p: { prompt: 'Make a motif of 3 to 6 notes on black keys only. Play it back, change what you don’t like, then name it.', blackOnly: true, min: 3, max: 6 } }
  ] },
  { id: '1.B', title: 'Boss challenge', blurb: 'Eight notes against the clock, then two bars of steady beat.', boss: true, steps: [
    { k: 'card', tag: 'Name', title: 'Show what you know', body: '<p>Part 1: the app names 8 notes. Play each within 3 seconds, in any octave. You need 7.</p><p>Part 2: keep a steady beat for two bars at 80 BPM. You need 6 of 8 beats.</p>' },
    { k: 'task', tag: 'Echo', type: 'playName', p: { prompt: 'Play it, any octave. 3 seconds each.', limit: 3, pass: 7, passMsg: 'Part 1 passed.', items: shuffle([0, 2, 4, 5, 7, 9, 11, 1, 3, 6, 8, 10]).slice(0, 8).map(pc => ({ pc, label: isBlack(pc) ? (Math.random() < 0.5 ? SHARP[pc] : FLAT[pc]) : SHARP[pc] })) } },
    { k: 'task', tag: 'Echo', type: 'pulse', p: { bpm: 80 } }
  ] }
];
const unitById = id => UNITS.find(u => u.id === id);
const unitDone = id => !!(Store.data.units[id] && Store.data.units[id].done);
const nextUnit = () => UNITS.find(u => !unitDone(u.id));

/* Review deck: unlocked when the unit that teaches it is finished */
const CARD_DEFS = {
  '1.1': [{ id: 'q-pitch', type: 'choice', q: 'A string starts vibrating faster. The note sounds…', options: ['Higher', 'Lower', 'Only louder'], answer: 0 }],
  '1.2': [
    { id: 'q-oct-hz', type: 'choice', q: 'A4 vibrates 440 times a second. How fast does A5 vibrate?', options: ['220 Hz', '660 Hz', '880 Hz'], answer: 2 },
    { id: 'q-oct-why', type: 'choice', q: 'Why does music need only 7 letter names?', options: ['Octaves sound like the same note', 'Pianos only have 7 keys', 'High notes have no names'], answer: 0 }
  ],
  '1.3': WHITE_PCS.map(pc => ({ id: 'play-' + pc, type: 'play', pc, label: SHARP[pc] })),
  '1.4': BLACK_PCS.map(pc => ({ id: 'black-' + pc, type: 'nameBlack', pc })).concat([[10, 'B♭'], [6, 'F♯'], [3, 'E♭'], [8, 'A♭'], [1, 'C♯']].map(([pc, label]) => ({ id: 'play-b-' + pc, type: 'play', pc, label }))),
  '1.5': [[64, 1, 1], [71, 1, 1], [64, 1, 2], [60, -1, 2], [65, -1, 1], [69, 1, 2], [60, -1, 1], [71, 1, 2]].map(([s, d, z]) => ({ id: `step-${s}-${d}-${z}`, type: 'step', start: s, dir: d, size: z })),
  '1.7': [
    { id: 'q-strong', type: 'choice', q: 'In 4/4, which beat is the strongest?', options: ['Beat 1', 'Beat 2', 'Beat 4'], answer: 0 },
    { id: 'q-bpm', type: 'choice', q: 'What does 80 BPM mean?', options: ['80 beats every minute', '80 bars every minute', '80 notes in the song'], answer: 0 }
  ],
  '1.8': [
    { id: 'q-half', type: 'choice', q: 'How many beats does a half note last in 4/4?', options: ['1', '2', '4'], answer: 1 },
    { id: 'q-titi', type: 'choice', q: 'Two eighth notes (ti-ti) together last…', options: ['Half a beat', '1 beat', '2 beats'], answer: 1 },
    { id: 'q-whole', type: 'choice', q: 'A whole note in 4/4 lasts…', options: ['1 beat', '2 beats', '4 beats'], answer: 2 },
    { id: 'q-24', type: 'choice', q: 'What does 2/4 time mean?', options: ['Two beats in every bar', 'Two bars per minute', 'Half notes only'], answer: 0 }
  ]
};
const LADDER = [0, 1, 3, 7, 14, 30];
function unlockCards(unitId) {
  (CARD_DEFS[unitId] || []).forEach(c => { if (!Store.data.cards[c.id]) Store.data.cards[c.id] = { box: 0, due: todayStr(), n: 0, ok: 0 }; });
}
function allCardDefs() { return Object.values(CARD_DEFS).reduce((a, b) => a.concat(b), []); }
function dueCards() {
  const t = todayStr();
  return allCardDefs().filter(c => Store.data.cards[c.id] && Store.data.cards[c.id].due <= t);
}
function gradeCard(id, ok, ms) {
  const s = Store.data.cards[id]; if (!s) return;
  s.n++; if (ok) s.ok++;
  if (ok) { s.box = Math.min(LADDER.length - 1, s.box + 1); s.due = addDays(todayStr(), LADDER[s.box]); }
  else { s.box = 0; s.due = addDays(todayStr(), 1); }
  const day = Store.day(); day.revN++; if (ok) { day.revOk++; day.revMs.push(ms); }
}
function masteredCount() { return Object.values(Store.data.cards).filter(s => s.box >= LADDER.length - 1).length; }

function saveSketch(s) {
  const sk = { id: 's' + Date.now().toString(36), name: s.name, notes: s.notes, prompt: s.prompt || '', created: todayStr(), level: 1 };
  Store.data.sketches.unshift(sk); Store.save(); paintStreak();
  return sk;
}

function bumpStreak() {
  const s = Store.data.streak, t = todayStr();
  if (s.last === t) return;
  if (!s.last) s.count = 1;
  else {
    const gap = daysBetween(s.last, t);
    if (gap === 1) s.count++;
    else if (gap === 2 && (!s.rest || daysBetween(s.rest, t) >= 7)) { s.count++; s.rest = addDays(t, -1); }
    else s.count = 1;
  }
  s.last = t;
}

/* =================================================================
   Lesson runner
   ================================================================= */
let cleanup = null;
function runCleanup() { if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; } Keyboard.clearMarks(); }

function runLesson(unit, host, onFinish, onExit) {
  let i = 0, stepDone = false;
  host.innerHTML = `<section class="panel"><div class="lesson-head"><div><div class="eyebrow">Level 1 · ${unit.id.endsWith('M') ? 'Create' : unit.id.endsWith('B') ? 'Boss' : 'Unit ' + unit.id}</div><h1>${unit.title}</h1></div><button type="button" class="btn ghost small" data-act="exit">← Level 1 path</button></div><div class="arc">${ARC.map(a => `<span data-a="${a}">${a}</span>`).join('')}</div><div class="stage"></div></section>`;
  const stage = host.querySelector('.stage'), arc = host.querySelectorAll('.arc span');
  host.querySelector('[data-act="exit"]').onclick = () => { runCleanup(); onExit(); };
  function show() {
    runCleanup(); stepDone = false;
    const s = unit.steps[i];
    const seen = new Set(unit.steps.slice(0, i).map(x => x.tag));
    arc.forEach(a => { a.classList.toggle('on', a.dataset.a === s.tag); a.classList.toggle('past', seen.has(a.dataset.a) && a.dataset.a !== s.tag); });
    stage.innerHTML = `<div class="tag">${s.tag} · step ${i + 1} of ${unit.steps.length}</div>${s.title ? `<h2>${s.title}</h2>` : ''}<div class="task"></div><div class="stepnav"><span>${s.k === 'task' ? '<button type="button" class="skip" data-act="skip">Skip this step</button>' : ''}</span><button type="button" class="btn primary" data-act="next">${i === unit.steps.length - 1 ? 'Finish' : 'Next'}</button></div>`;
    const body = stage.querySelector('.task'), next = stage.querySelector('[data-act="next"]');
    if (s.k === 'card') { cleanup = Tasks.card(body, s); stepDone = true; }
    else { next.disabled = true; cleanup = Tasks[s.type](body, s.p, () => { stepDone = true; next.disabled = false; next.focus({ preventScroll: true }); }); }
    next.onclick = () => { if (!stepDone) return; i++; if (i >= unit.steps.length) finish(); else show(); };
    const sk = stage.querySelector('[data-act="skip"]'); if (sk) sk.onclick = () => { i++; if (i >= unit.steps.length) finish(); else show(); };
  }
  function finish() {
    runCleanup();
    Store.data.units[unit.id] = { done: true, at: todayStr() };
    unlockCards(unit.id);
    if (unit.boss) Store.data.bossPassed = true;
    Store.save();
    onFinish(unit);
  }
  show();
}

/* =================================================================
   Views
   ================================================================= */
const view = document.getElementById('view');
let current = 'home';
function setNav(name) { document.querySelectorAll('.nav button').forEach(b => b.setAttribute('aria-current', b.dataset.view === name ? 'page' : 'false')); }
function go(name, arg) {
  runCleanup(); current = name; setNav(name === 'lesson' || name === 'daily' ? 'home' : name);
  ({ home: renderHome, lesson: renderLesson, daily: renderDaily, sketchbook: renderSketchbook, setup: renderSetup })[name](arg);
  window.scrollTo({ top: 0 });
}

function paintStreak() {
  const el = document.getElementById('streak');
  el.innerHTML = `<b>${Store.data.streak.count}</b> day streak`;
}

function staffSVG() {
  const n = UNITS.length, w = 660, x0 = 48, dx = (w - x0 - 40) / (n - 1);
  const lines = [30, 42, 54, 66, 78].map(y => `<line class="line" x1="10" y1="${y}" x2="${w - 10}" y2="${y}"/>`).join('');
  const nxt = nextUnit();
  let heads = '';
  UNITS.forEach((u, i) => {
    const x = x0 + i * dx;
    if (u.boss) {
      heads += `<g class="head bossmark ${unitDone(u.id) ? 'done' : ''}" tabindex="0" role="button" data-u="${u.id}" aria-label="Boss challenge"><line class="bar" x1="${x - 4}" y1="30" x2="${x - 4}" y2="78" stroke-width="1.5"/><line class="bar" x1="${x + 3}" y1="30" x2="${x + 3}" y2="78" stroke-width="5"/><text x="${x}" y="104" text-anchor="middle">${unitDone(u.id) ? 'Passed' : 'Boss'}</text></g>`;
      return;
    }
    const y = 84 - i * 6;
    const cls = unitDone(u.id) ? 'done' : (nxt && nxt.id === u.id ? 'next' : '');
    const ledger = y >= 84 ? `<line class="line" x1="${x - 14}" y1="${y}" x2="${x + 14}" y2="${y}"/>` : '';
    heads += `<g class="head ${cls}" tabindex="0" role="button" data-u="${u.id}" aria-label="${u.id} ${esc(u.title)}${cls === 'done' ? ', done' : ''}">${ledger}<ellipse cx="${x}" cy="${y}" rx="9" ry="6.5" transform="rotate(-20 ${x} ${y})"/><text class="lbl" x="${x}" y="104" text-anchor="middle">${u.id.endsWith('M') ? 'motif' : u.id}</text></g>`;
  });
  return `<svg class="staff" viewBox="0 0 ${w} 112" role="group" aria-label="Level 1 path: each note is a unit, rising like a scale">${lines}<text x="14" y="70" font-family="var(--f-display)" font-size="44" fill="var(--muted)" opacity="0.35">𝄞</text>${heads}</svg>`;
}

function renderHome() {
  const doneN = UNITS.filter(u => unitDone(u.id)).length;
  const due = dueCards().length, nx = nextUnit();
  const today = Store.data.history[todayStr()];
  const dailyDone = today && today.done;
  const micLine = Mic.state === 'on' ? '<b>The mic is on.</b> Sing or play and the app follows.' : (Mic.state === 'blocked' || Mic.state === 'unsupported') ? `<b>The mic isn’t available on this page.</b> Everything works with the keys in the dock, your computer keyboard (A to K) or a MIDI keyboard. To use the mic, open the standalone version from your own site or localhost.` : '<b>Use the mic, the keys, or both.</b> Turn on the mic in the dock to sing or play a real instrument; tap the keys or use A to K otherwise.';
  view.innerHTML = `
  <div class="grid-2">
    <section class="panel today">
      <div class="eyebrow">Today · ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
      <h2>${dailyDone ? 'Daily Set done. See you tomorrow.' : 'Your Daily Set is ready'}</h2>
      <p class="lead">Ten minutes in six steps: tune in, review what is due, learn one new thing, make something, train your ear, and see today’s 1% gain.</p>
      <div class="row"><button type="button" class="btn primary" data-act="daily">${dailyDone ? 'Do another round' : 'Start the Daily Set'}</button>${nx ? `<button type="button" class="btn" data-act="next">${nx.boss ? 'Take the boss challenge' : 'Jump to ' + (nx.id.endsWith('M') ? 'the motif' : nx.id + ' ' + nx.title)}</button>` : ''}</div>
      <div class="mic-note"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><span>${micLine}</span></div>
    </section>
    <section class="stats" aria-label="Progress">
      <div class="stat"><b>${Store.data.streak.count}</b><span>day streak</span></div>
      <div class="stat"><b>${due}</b><span>cards due</span></div>
      <div class="stat"><b>${Store.data.sketches.length}</b><span>sketches</span></div>
      <div class="stat"><b>${doneN}/${UNITS.length}</b><span>Level 1 stops</span></div>
      <div class="stat"><b>${masteredCount()}</b><span>cards mastered</span></div>
      <div class="stat"><b>${Store.data.range ? noteName(Store.data.range.zl) + '–' + noteName(Store.data.range.zh) : '—'}</b><span>voice home zone</span></div>
    </section>
  </div>
  <section class="panel">
    <div class="level-head"><div><div class="eyebrow">Level 1 of 5</div><h2>Hear It, Find It</h2></div><span class="chip ${Store.data.bossPassed ? 'done' : 'live'}">${Store.data.bossPassed ? 'Level passed' : doneN + ' of ' + UNITS.length + ' done'}</span></div>
    <div class="staff-wrap">${staffSVG()}</div>
    <div class="units">${UNITS.map(u => {
      const st = unitDone(u.id) ? '<span class="chip done">Done</span>' : (nx && nx.id === u.id ? '<span class="chip next">Next</span>' : '');
      return `<button type="button" class="unit${u.boss ? ' boss' : ''}" data-u="${u.id}"><span class="top-line"><span class="num">${u.boss ? 'Boss' : u.create ? 'Create' : u.id}</span>${st}</span><h3>${u.title}</h3><p>${u.blurb}</p></button>`;
    }).join('')}</div>
  </section>
  <section class="panel later" aria-label="Coming levels">
    <div class="eyebrow">Next in the path</div>
    ${[['Level 2', 'Steps & Scales', 'Intervals, the major scale, solfège, reading rhythm'], ['Level 3', 'Stack It', 'Triads, inversions, the chords of a key'], ['Level 4', 'The Clock', 'Circle of Fifths, key signatures, three minors'], ['Level 5', 'Make It Move', 'Progressions, cadences, periods, your 8-bar piece']].map(([a, b, c]) => `<div class="item"><span><b>${a} · ${b}</b><br>${c}</span><span class="chip">Locked</span></div>`).join('')}
  </section>`;
  view.querySelector('[data-act="daily"]').onclick = () => go('daily');
  const nb = view.querySelector('[data-act="next"]'); if (nb) nb.onclick = () => go('lesson', nx.id);
  view.querySelectorAll('[data-u]').forEach(b => {
    const open = () => go('lesson', b.dataset.u);
    b.addEventListener('click', open);
    b.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); } });
  });
}

function renderLesson(id) {
  const u = unitById(id);
  runLesson(u, view, unit => showComplete(unit), () => go('home'));
}
function showComplete(unit) {
  const nx = nextUnit();
  const cards = (CARD_DEFS[unit.id] || []).length;
  view.innerHTML = `<section class="panel done-card"><div class="eyebrow">${unit.boss ? 'Level 1' : 'Unit ' + unit.id} complete</div><div class="big">${unit.boss ? 'Level 1 passed.' : unit.title + ': done.'}</div><p>${cards ? `${cards} review card${cards > 1 ? 's' : ''} joined your deck. They come back on a growing schedule: tomorrow, then 3, 7, 14 and 30 days.` : unit.create ? 'Your motif is in the sketchbook. You will grow it into a phrase in Level 2.' : 'Nice work.'}</p>${unit.boss ? '<p>You can find any note, step by half and whole steps, keep a steady beat and read basic rhythms. Level 2 arrives in the next build.</p>' : ''}<div class="row">${nx ? `<button type="button" class="btn primary" data-act="next">${nx.boss ? 'Boss challenge' : 'Next: ' + nx.title}</button>` : ''}<button type="button" class="btn" data-act="home">Level 1 path</button></div></section>`;
  const nb = view.querySelector('[data-act="next"]'); if (nb) nb.onclick = () => go('lesson', nx.id);
  view.querySelector('[data-act="home"]').onclick = () => go('home');
  paintStreak();
}

/* ---------- Daily Set ---------- */
const DAILY = ['Tune-in', 'Review', 'New bite', 'Create', 'Ear spark', 'Today’s 1%'];
const CREATE_PROMPTS = [
  'Make a 4-note motif on black keys that climbs, then falls.',
  'Make a motif that starts and ends on the same note.',
  'Make a motif with one big jump in it.',
  'Make a motif that uses only two different notes.',
  'Make a motif that sounds like a question.',
  'Repeat one note three times, then move. Make that a motif.'
];
function renderDaily() {
  let s = 0;
  view.innerHTML = `<section class="panel"><div class="lesson-head"><div><div class="eyebrow">Daily Set · about 10 minutes</div><h1>Today’s practice</h1></div><button type="button" class="btn ghost small" data-act="exit">← Home</button></div><div class="strip">${DAILY.map(d => `<div>${d}</div>`).join('')}</div><div class="stage"></div></section>`;
  const stage = view.querySelector('.stage'), strip = view.querySelectorAll('.strip div');
  view.querySelector('[data-act="exit"]').onclick = () => go('home');
  const day = Store.day();
  function frame(title, sub) {
    strip.forEach((d, i) => { d.classList.toggle('on', i === s); d.classList.toggle('past', i < s); });
    stage.innerHTML = `<div class="tag">${DAILY[s]} · ${s + 1} of 6</div><h2>${title}</h2>${sub ? `<p class="lead">${sub}</p>` : ''}<div class="task"></div><div class="stepnav"><button type="button" class="skip" data-act="skip">Skip</button><button type="button" class="btn primary" data-act="next" disabled>Next</button></div>`;
    const next = stage.querySelector('[data-act="next"]');
    const advance = () => { runCleanup(); s++; steps[s](); };
    next.onclick = advance; stage.querySelector('[data-act="skip"]').onclick = advance;
    return { body: stage.querySelector('.task'), ready: () => { next.disabled = false; } };
  }
  const steps = [
    function tune() {
      const f = frame('Match three notes', 'Listen, then play or sing the same note. Any octave counts.');
      const zone = Store.data.range;
      const lo = zone ? Math.max(48, zone.zl) : 55, hi = zone ? Math.min(72, zone.zh) : 67;
      let r = 0, target = randInt(lo, hi), tries = 0;
      f.body.innerHTML = `<div class="row">${playBtn('Hear it again')}<div class="progress-dots"><span></span><span></span><span></span></div></div><p class="fb info" aria-live="polite">Listening…</p>`;
      const fbEl = f.body.querySelector('.fb'), dots = f.body.querySelectorAll('.progress-dots span');
      const play = () => Sound.tone(target, Sound.now() + 0.05, 1);
      f.body.querySelector('[data-act="play"]').onclick = play;
      setTimeout(play, 250);
      cleanup = Bus.on('note', d => {
        if (r >= 3) return;
        tries++;
        if (mod12(d.midi) === mod12(target)) {
          dots[r].classList.add('on'); r++; if (tries === 1) day.tuneOk++; day.tuneN++; tries = 0;
          fb(fbEl, 'good', `${pcLabel(mod12(target))}. Matched.`);
          if (r >= 3) { Store.save(); f.ready(); } else { target = randInt(lo, hi); setTimeout(play, 900); }
        } else fb(fbEl, 'bad', `That is ${noteName(d.midi)}. ${d.midi < target ? 'Go higher.' : 'Go lower.'}`);
      });
    },
    function review() {
      let due = dueCards();
      const practice = !due.length;
      const unlocked = allCardDefs().filter(c => Store.data.cards[c.id]);
      if (practice) due = shuffle(unlocked).slice(0, 3);
      due = shuffle(due).slice(0, 8);
      const f = frame(practice ? (unlocked.length ? 'Nothing due: a quick warm-up' : 'Your review deck is empty') : `${due.length} card${due.length > 1 ? 's' : ''} due`, unlocked.length ? 'Answer by playing, singing or choosing. Speed counts toward mastery.' : 'Cards join the deck as you finish Level 1 units. The first lesson adds the first card.');
      if (!due.length) { f.ready(); return; }
      let k = 0;
      const holder = document.createElement('div'); f.body.appendChild(holder);
      const counter = document.createElement('p'); counter.className = 'eyebrow'; f.body.prepend(counter);
      function show() {
        runCleanup();
        if (k >= due.length) { counter.textContent = 'Deck done'; holder.innerHTML = '<p class="fb good">All cards answered. The scheduler has moved each one to its next date.</p>'; Store.save(); f.ready(); return; }
        counter.textContent = `Card ${k + 1} of ${due.length}`;
        const c = due[k], t0 = performance.now();
        const fin = ok => { if (!practice) gradeCard(c.id, ok, performance.now() - t0); k++; setTimeout(show, ok ? 900 : 1900); };
        if (c.type === 'choice') cleanup = Tasks.choice(holder, c, fin);
        else if (c.type === 'play') cleanup = cardPlay(holder, c, fin);
        else if (c.type === 'step') cleanup = cardStep(holder, c, fin);
        else if (c.type === 'nameBlack') cleanup = cardBlack(holder, c, fin);
      }
      show();
    },
    function newBite() {
      const nx = nextUnit();
      const f = frame(nx ? (nx.boss ? 'Boss challenge' : `Up next: ${nx.title}`) : 'Level 1 complete', nx ? nx.blurb : 'Every Level 1 stop is done. Level 2 arrives in the next build; for now, your review deck keeps the skills sharp.');
      if (!nx) { f.ready(); return; }
      f.body.innerHTML = `<button type="button" class="btn primary" data-act="open">Start ${nx.boss ? 'the boss challenge' : nx.id.endsWith('M') ? 'the motif' : 'unit ' + nx.id}</button>`;
      f.body.querySelector('[data-act="open"]').onclick = () => {
        const host = document.createElement('div'); f.body.innerHTML = ''; f.body.appendChild(host);
        runLesson(nx, host, unit => { host.innerHTML = `<p class="fb good">${unit.title}: done. ${(CARD_DEFS[unit.id] || []).length ? 'New review cards joined your deck.' : ''}</p>`; f.ready(); }, () => { host.innerHTML = '<p class="fb info">Lesson paused. You can pick it up from the Level 1 path.</p>'; f.ready(); });
      };
    },
    function create() {
      const prompt = rand(CREATE_PROMPTS);
      const f = frame('Make something', 'Two minutes, one small constraint. Everything you save goes in your sketchbook.');
      cleanup = Tasks.motif(f.body, { prompt, blackOnly: true, min: 3, max: 8 }, () => f.ready());
    },
    function ear() {
      const f = frame('Higher or lower?', 'Two notes. Was the second one higher or lower than the first?');
      let r = 0, a = 0, b = 0, ok = 0;
      f.body.innerHTML = `<div class="row">${playBtn('Hear them again')}<div class="progress-dots">${'<span></span>'.repeat(5)}</div></div><div class="choices"><button type="button" class="choice" data-v="1">Higher</button><button type="button" class="choice" data-v="-1">Lower</button></div><p class="fb info" aria-live="polite"></p>`;
      const fbEl = f.body.querySelector('.fb'), dots = f.body.querySelectorAll('.progress-dots span'), box = f.body.querySelector('.choices');
      const play = () => Sound.seq([{ m: a, t: 0, d: 0.6 }, { m: b, t: 0.75, d: 0.6 }]);
      function next() {
        const gap = r < 2 ? randInt(4, 7) : r < 4 ? randInt(2, 3) : 1;
        a = randInt(55, 68); b = a + (Math.random() < 0.5 ? gap : -gap);
        box.querySelectorAll('.choice').forEach(c => { c.className = 'choice'; c.disabled = false; });
        play();
      }
      f.body.querySelector('[data-act="play"]').onclick = play;
      box.onclick = ev => {
        const c = ev.target.closest('.choice'); if (!c || c.disabled) return;
        const right = Math.sign(b - a) === +c.dataset.v;
        box.querySelectorAll('.choice').forEach(x => { x.disabled = true; });
        c.classList.add(right ? 'right' : 'wrong'); dots[r].classList.add(right ? 'on' : 'miss');
        if (right) ok++;
        fb(fbEl, right ? 'good' : 'bad', `${noteName(a)} → ${noteName(b)}: ${Math.abs(b - a)} half step${Math.abs(b - a) > 1 ? 's' : ''} ${b > a ? 'up' : 'down'}.`);
        r++;
        if (r >= 5) { day.earOk += ok; day.earN += 5; Store.save(); f.ready(); } else setTimeout(next, 1300);
      };
      setTimeout(next, 250);
    },
    function onePercent() {
      day.done = true; bumpStreak(); Store.save(); paintStreak();
      const f = frame('Today’s 1%', '');
      const msg = onePercentMessage();
      f.body.innerHTML = `<div class="one-percent">${msg.big}</div><p>${msg.small}</p><p class="eyebrow" style="margin-top:12px">${Store.data.streak.count} day streak · ${dueCards().length} cards due now</p>`;
      const nb = stage.querySelector('[data-act="next"]'); nb.disabled = false; nb.textContent = 'Done'; nb.onclick = () => go('home');
      stage.querySelector('[data-act="skip"]').hidden = true;
      strip.forEach(d => { d.classList.remove('on'); d.classList.add('past'); });
    }
  ];
  steps[0]();
}
function onePercentMessage() {
  const h = Store.data.history, t = todayStr();
  const today = h[t];
  const prevDays = Object.keys(h).filter(d => d < t).sort();
  const prev = prevDays.length ? h[prevDays[prevDays.length - 1]] : null;
  const speed = x => x && x.revMs && x.revMs.length ? mean(x.revMs) / 1000 : null;
  const acc = (o, n) => n ? o / n : null;
  if (prev) {
    const s0 = speed(prev), s1 = speed(today);
    if (s0 && s1 && s1 < s0) return { big: `${s0.toFixed(1)} s → ${s1.toFixed(1)} s`, small: 'Average time per review card, last session vs today. Faster recall is what mastery looks like.' };
    const e0 = acc(prev.earOk, prev.earN), e1 = acc(today.earOk, today.earN);
    if (e0 != null && e1 != null && e1 > e0) return { big: `${Math.round(e0 * 100)}% → ${Math.round(e1 * 100)}%`, small: 'Higher-or-lower accuracy, last session vs today.' };
    const u0 = acc(prev.tuneOk, prev.tuneN), u1 = acc(today.tuneOk, today.tuneN);
    if (u0 != null && u1 != null && u1 > u0) return { big: `${Math.round(u0 * 100)}% → ${Math.round(u1 * 100)}%`, small: 'Notes matched on the first try, last session vs today.' };
    return { big: 'Steady', small: 'No number beat last time today, and that is normal. Spaced practice dips before it climbs.' };
  }
  const s1 = speed(today);
  return { big: s1 ? `${s1.toFixed(1)} s per card` : 'Day one', small: s1 ? 'Your first review speed. Tomorrow’s Daily Set compares against it.' : 'Your first Daily Set is done. From tomorrow, this step shows one number that improved.' };
}

/* review card bodies */
function cardPlay(el, c, fin) {
  el.innerHTML = `<p class="prompt">Play this note, in any octave.</p><div class="big-name">${c.label}</div><p class="fb info" aria-live="polite"></p>`;
  const f = el.querySelector('.fb'); let done = false;
  const off = Bus.on('note', d => { if (done) return; done = true; const ok = mod12(d.midi) === c.pc; fb(f, ok ? 'good' : 'bad', ok ? `${noteName(d.midi)}. Right.` : `That was ${noteName(d.midi)}. ${c.label} is ${landmarkHint(c.pc)}.`); fin(ok); });
  return off;
}
function landmarkHint(pc) {
  return { 0: 'just left of the two black keys', 2: 'between the two black keys', 4: 'just right of the two black keys', 5: 'just left of the three black keys', 7: 'between the first and second of the three', 9: 'between the second and third of the three', 11: 'just right of the three black keys', 1: 'the first of the two black keys', 3: 'the second of the two black keys', 6: 'the first of the three black keys', 8: 'the middle of the three black keys', 10: 'the last of the three black keys' }[pc];
}
function cardStep(el, c, fin) {
  Keyboard.mark(c.start, 'target');
  el.innerHTML = `<p class="prompt">${c.size === 1 ? 'Half' : 'Whole'} step ${c.dir > 0 ? 'up' : 'down'} from ${SHARP[mod12(c.start)]}</p><p class="fb info" aria-live="polite">Start from the glowing key.</p>`;
  const f = el.querySelector('.fb'); let done = false; const want = c.start + c.dir * c.size;
  const off = Bus.on('note', d => { if (done || d.midi === c.start) return; done = true; const ok = mod12(d.midi) === mod12(want); fb(f, ok ? 'good' : 'bad', ok ? `${pcLabel(mod12(want))}. Right.` : `The answer is ${pcLabel(mod12(want))}.`); fin(ok); });
  return () => { off(); Keyboard.clearMarks(); };
}
function cardBlack(el, c, fin) {
  Keyboard.mark(60 + c.pc, 'target');
  const opts = shuffle([SHARP[c.pc], FLAT[c.pc], ...shuffle(BLACK_PCS.filter(x => x !== c.pc)).slice(0, 1).reduce((a, x) => a.concat([SHARP[x], FLAT[x]]), [])]);
  el.innerHTML = `<p class="prompt">Name the glowing key. Pick both names.</p><div class="choices">${opts.map(o => `<button type="button" class="choice" aria-pressed="false" data-v="${o}">${o}</button>`).join('')}</div><p class="fb info" aria-live="polite"></p>`;
  const box = el.querySelector('.choices'), f = el.querySelector('.fb'); const picked = new Set(); let done = false;
  box.onclick = ev => {
    const b = ev.target.closest('.choice'); if (!b || done) return;
    picked.add(b.dataset.v); b.setAttribute('aria-pressed', 'true');
    if (picked.size === 2) {
      done = true; const ok = picked.has(SHARP[c.pc]) && picked.has(FLAT[c.pc]);
      box.querySelectorAll('.choice').forEach(x => { if (x.dataset.v === SHARP[c.pc] || x.dataset.v === FLAT[c.pc]) x.classList.add('right'); else if (picked.has(x.dataset.v)) x.classList.add('wrong'); });
      fb(f, ok ? 'good' : 'bad', ok ? 'Both names. Right.' : `It is ${SHARP[c.pc]} and ${FLAT[c.pc]}.`); fin(ok);
    }
  };
  return () => Keyboard.clearMarks();
}

/* ---------- Sketchbook ---------- */
function renderSketchbook() {
  const list = Store.data.sketches;
  view.innerHTML = `<section class="panel"><div class="level-head"><div><div class="eyebrow">Sketchbook</div><h2>Your motifs and answers</h2></div><span class="chip">${list.length} saved</span></div><p style="color:var(--muted);margin-top:8px;max-width:60ch">Every idea you save lives here. Later levels grow these into phrases, then into an 8-bar piece. Saved in this browser.</p><div class="sketches" style="margin-top:16px">${list.length ? list.map(s => `<div class="sketch" data-id="${s.id}"><div><h3>${esc(s.name)}</h3><div class="meta">${s.notes.map(n => SHARP[mod12(n.m)]).join(' · ')} · ${s.created}${s.prompt ? ' · ' + esc(s.prompt) : ''}</div></div><div class="row"><button type="button" class="btn small" data-act="play">▶ Play</button><span class="del"><button type="button" class="btn small ghost" data-act="del">Delete</button></span></div></div>`).join('') : '<div class="empty-state"><b>No sketches yet.</b><span>Your first one comes from the “Your first motif” stop on the Level 1 path, or the Create step of any Daily Set.</span><button type="button" class="btn primary" data-act="motif">Make a motif now</button></div>'}</div></section>`;
  const mk = view.querySelector('[data-act="motif"]'); if (mk) mk.onclick = () => go('lesson', '1.M');
  view.querySelectorAll('.sketch').forEach(row => {
    const s = list.find(x => x.id === row.dataset.id);
    row.querySelector('[data-act="play"]').onclick = () => Sound.seq(s.notes.map(n => ({ m: n.m, t: n.t, d: 0.4 })));
    const del = row.querySelector('.del');
    row.querySelector('[data-act="del"]').onclick = () => {
      del.innerHTML = '<span class="confirm">Delete for good? <button type="button" class="btn small" data-act="yes">Delete</button><button type="button" class="btn small ghost" data-act="no">Keep</button></span>';
      del.querySelector('[data-act="yes"]').onclick = () => { Store.data.sketches = Store.data.sketches.filter(x => x.id !== s.id); Store.save(); renderSketchbook(); };
      del.querySelector('[data-act="no"]').onclick = () => renderSketchbook();
    };
  });
}

/* ---------- Setup ---------- */
function renderSetup() {
  const st = Store.data.settings;
  view.innerHTML = `<div class="setup-list">
    <section class="panel"><h2>Microphone</h2><p>The mic hears single notes from a voice, guitar, piano or any instrument, and claps for rhythm work. Sound is analysed on this device and never uploaded.</p><p style="margin-top:8px"><b>Status:</b> <span data-mic-status></span></p><div class="row"><button type="button" class="btn primary" data-act="mic"></button></div><p style="margin-top:12px">Headphones help: they keep the app’s own sounds out of the mic. Your browser’s voice processing is switched off so musical notes stay clean.</p></section>
    <section class="panel"><h2>Rhythm timing</h2><p>Phones and Bluetooth headsets add delay. If your claps keep scoring late, raise this.</p><div class="row"><label for="lat">Mic delay correction</label><input id="lat" type="range" min="0" max="160" step="10" value="${st.micLatency}"><span class="mono" data-lat>${st.micLatency} ms</span></div></section>
    <section class="panel"><h2>Keyboard</h2><p>Your computer keyboard plays one octave. Space taps a beat.</p><div class="kbd-map" style="margin-top:10px">${Object.keys(KEYMAP).map(k => `<kbd>${k.toUpperCase()} ${SHARP[KEYMAP[k] % 12]}</kbd>`).join('')}<kbd>Z octave down</kbd><kbd>X octave up</kbd><kbd>Space tap</kbd></div><div class="row"><label class="toggle"><input id="labels" type="checkbox" ${st.labels ? 'checked' : ''}> Show note names on the keys</label></div></section>
    <section class="panel"><h2>MIDI keyboard</h2><p>Plug in a USB MIDI keyboard for exact notes. Works in Chrome, Edge and Firefox; Safari does not support it.</p><div class="row"><button type="button" class="btn" data-act="midi">Connect MIDI</button><span data-midi-status class="chip">${Midi.state === 'on' ? 'Connected' : 'Not connected'}</span></div></section>
    <section class="panel"><h2>Start over</h2><p>Clears units, review cards, streak and sketches from this browser.</p><div class="row" data-reset><button type="button" class="btn ghost" data-act="reset">Reset progress</button></div></section>
  </div>`;
  const micBtn = view.querySelector('[data-act="mic"]'), micSt = view.querySelector('[data-mic-status]');
  const paint = () => {
    micSt.textContent = { on: 'listening', off: 'off', starting: 'asking for permission…', blocked: 'blocked on this page', unsupported: 'not available on this page', nodevice: 'no microphone found' }[Mic.state];
    micBtn.textContent = Mic.state === 'on' ? 'Turn mic off' : 'Turn mic on';
  };
  paint(); const offMic = Bus.on('mic', paint);
  micBtn.onclick = async () => { if (Mic.state === 'on') Mic.stop(); else if (!(await Mic.start())) toast(micProblem()); };
  const lat = view.querySelector('#lat'), latTxt = view.querySelector('[data-lat]');
  lat.oninput = () => { st.micLatency = +lat.value; latTxt.textContent = lat.value + ' ms'; Store.save(); };
  view.querySelector('#labels').onchange = ev => { st.labels = ev.target.checked; Keyboard.setLabels(st.labels); Store.save(); };
  view.querySelector('[data-act="midi"]').onclick = async () => {
    await Midi.start();
    view.querySelector('[data-midi-status]').textContent = { on: 'Connected', nodevice: 'No MIDI keyboard found', blocked: 'Blocked on this page', unsupported: 'Not supported in this browser' }[Midi.state] || 'Not connected';
  };
  const rs = view.querySelector('[data-reset]');
  view.querySelector('[data-act="reset"]').onclick = () => {
    rs.innerHTML = '<span class="confirm">This clears everything in this browser. <button type="button" class="btn small" data-act="yes">Reset</button><button type="button" class="btn small ghost" data-act="no">Cancel</button></span>';
    rs.querySelector('[data-act="yes"]').onclick = () => { Store.data = Store.defaults(); Store.save(); paintStreak(); Keyboard.setLabels(true); toast('Progress cleared.'); go('home'); };
    rs.querySelector('[data-act="no"]').onclick = () => renderSetup();
  };
  cleanup = offMic;
}

/* =================================================================
   Boot
   ================================================================= */
function boot() {
  Store.load();
  Keyboard.mount(document.getElementById('kb'));
  mountReadout(document.getElementById('readout'));
  paintStreak();
  document.querySelectorAll('.nav button').forEach(b => { b.onclick = () => go(b.dataset.view); });
  document.getElementById('brand').onclick = () => go('home');
  const dock = document.querySelector('.dock');
  const setDock = () => document.documentElement.style.setProperty('--dock-h', dock.offsetHeight + 'px');
  setDock();
  if (window.ResizeObserver) new ResizeObserver(setDock).observe(dock);
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext)) Mic.set('unsupported');
  go('home');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
