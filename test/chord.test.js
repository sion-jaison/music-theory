const P = require('../src/pitch.js');

/* Chord engine on synthetic analyser frames: notes are rendered in the time
   domain, windowed (Blackman, alpha 0.16) and transformed exactly like a Web
   Audio AnalyserNode with fftSize 16384, without smoothing. */
const N = 16384;
const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const IV = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10] };

let seed = Number(process.env.SEED) || 20261008;
function rnd() {   // mulberry32, so every run hears the same frames
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function gauss() { return Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd()); }

// --- analyser model: Blackman window, radix-2 FFT, 20*log10(|X| / N) ---
const win = new Float64Array(N);
for (let i = 0; i < N; i++) win[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / N) + 0.08 * Math.cos(4 * Math.PI * i / N);
const rev = new Uint32Array(N);
for (let i = 0, bits = Math.log2(N); i < N; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
const cosT = new Float64Array(N / 2), sinT = new Float64Array(N / 2);
for (let i = 0; i < N / 2; i++) { cosT[i] = Math.cos(2 * Math.PI * i / N); sinT[i] = -Math.sin(2 * Math.PI * i / N); }
const re = new Float64Array(N), im = new Float64Array(N);
function fft() {
  for (let i = 0; i < N; i++) { const j = rev[i]; if (j > i) { const t = re[i]; re[i] = re[j]; re[j] = t; } }
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1, step = N / size;
    for (let s = 0; s < N; s += size) {
      for (let k = 0; k < half; k++) {
        const a = s + k, b = a + half, wr = cosT[k * step], wi = sinT[k * step];
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
      }
    }
  }
}
function analyser(x) {
  for (let i = 0; i < N; i++) { re[i] = x[i] * win[i]; im[i] = 0; }
  fft();
  const db = new Float32Array(N / 2);
  for (let k = 0; k < N / 2; k++) db[k] = 20 * Math.log10(Math.sqrt(re[k] * re[k] + im[k] * im[k]) / N);
  return db;
}

// --- instruments: [{ ratio to f0, amplitude }] ---
function partials(kind, midi) {
  const out = [];
  if (kind === 'piano') {
    const B = 1.5e-4 + 3e-4 * rnd();                        // string stiffness
    const tilt = 0.25 + 0.15 * rnd();
    for (let h = 1; h <= 24; h++) out.push([h * Math.sqrt(1 + B * h * h), Math.exp(-tilt * (h - 1)) * (0.75 + 0.5 * rnd())]);
    if (midi < 55 && rnd() < 0.7) out[0][1] = out[1][1] * (0.25 + 0.5 * rnd());   // fundamental below the 2nd harmonic
  } else if (kind === 'guitar') {
    const B = 3e-5 + 1e-4 * rnd(), beta = 0.12 + 0.12 * rnd();   // pluck position along the string
    for (let h = 1; h <= 24; h++) out.push([h * Math.sqrt(1 + B * h * h), Math.abs(Math.sin(Math.PI * h * beta)) / Math.pow(h, 1.1) * (0.75 + 0.5 * rnd())]);
  } else {                                                   // organ flute stop: nearly pure
    [1, 0.3, 0.12, 0.05].forEach((a, i) => out.push([i + 1, a]));
  }
  return out;
}

/* Render notes ([midi, ...]) into one analyser frame. Every note gets its own
   detune (±8 cents), level and random partial phases. Returns dB bins. */
function frame(notes, kind, sr, o) {
  o = o || {};
  const x = new Float64Array(N);
  notes.forEach(m => {
    const f0 = 440 * Math.pow(2, (m - 69 + (rnd() * 2 - 1) * 0.08) / 12);
    const gain = 0.6 + 0.4 * rnd();
    partials(kind, m).forEach(([ratio, amp]) => {
      const f = f0 * ratio;
      if (f > sr * 0.45) return;
      const w = 2 * Math.PI * f / sr, cw = Math.cos(w), sw = Math.sin(w);
      const ph = 2 * Math.PI * rnd(), a = gain * amp;
      let c = Math.cos(ph), s = Math.sin(ph);
      for (let i = 0; i < N; i++) { x[i] += a * s; const t = c * cw - s * sw; s = s * cw + c * sw; c = t; }
    });
  });
  let e = 0;
  for (let i = 0; i < N; i++) e += x[i] * x[i];
  const g = (o.rms || 0.1) / Math.sqrt(e / N);
  const noise = o.noise != null ? o.noise : 0.002 + 0.006 * rnd();
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = x[i] * g + noise * gauss();
  return analyser(out);
}

function listen(db, sr, mo) {
  const a = P.analyzeSpectrum(db, sr, N);
  if (!a) return { a: null, m: null };
  return { a: a, m: P.matchChord(a.chroma, Object.assign({ bassPc: a.bassPc, played: a.played }, mo || {})) };
}
const seen = [];   // every chord frame, re-scored at the end without the `played` hint
function hear(notes, kind, sr, root, q) {
  const db = frame(notes, kind, sr);
  seen.push({ db, sr, root, q });
  return listen(db, sr);
}
const chordName = m => m ? NAMES[m.root] + (m.quality === 'maj' ? '' : m.quality === 'min' ? 'm' : m.quality) : 'null';
// aug and sus2/sus4 are symmetric: any spelling of the same pitch-class set is right.
function same(m, root, q) {
  if (!m) return false;
  if (m.root === root && m.quality === q) return true;
  if (q === 'aug') return m.quality === 'aug' && (m.root - root + 12) % 4 === 0;
  if (q === 'sus2') return m.quality === 'sus4' && m.root === (root + 7) % 12;
  return false;
}

let fails = 0;
function check(ok, msg) { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); }
const KINDS = ['piano', 'guitar', 'organ'];
const scores = [];

// 1. major and minor, every root, close (octave 4) and open (octaves 2–4) voicings
function triads(sr) {
  let ok = 0, total = 0;
  const miss = [];
  for (const q of ['maj', 'min']) {
    for (let r = 0; r < 12; r++) {
      const t = IV[q][1];
      const voicings = {
        close: [60 + r, 60 + r + t, 67 + r],
        open: r % 2 ? [36 + r, 48 + r, 55 + r, 48 + r + t + 12] : [36 + r, 43 + r, 48 + r + t, 60 + r]
      };
      for (const v in voicings) {
        for (const kind of KINDS) {
          const { m } = hear(voicings[v], kind, sr, r, q);
          total++;
          if (same(m, r, q)) { ok++; scores.push(m.score); } else miss.push(`${NAMES[r]}${q === 'min' ? 'm' : ''} ${v} ${kind} -> ${chordName(m)}`);
        }
      }
    }
  }
  const acc = ok / total;
  check(acc >= 0.95, `maj/min triads @${sr}: ${ok}/${total} = ${(acc * 100).toFixed(1)}% (need >= 95%)`);
  miss.forEach(s => console.log(`      miss: ${s}`));
}
triads(48000);
triads(44100);

// 2. other qualities, close position from octave 3
function qualities(sr, list) {
  for (const q of list) {
    let ok = 0, total = 0;
    const miss = [];
    for (let r = 0; r < 12; r++) {
      for (const kind of KINDS) {
        const { m } = hear(IV[q].map(iv => 48 + r + iv), kind, sr, r, q);
        total++;
        if (same(m, r, q)) { ok++; scores.push(m.score); } else miss.push(`${NAMES[r]}${q} ${kind} -> ${chordName(m)}`);
      }
    }
    const acc = ok / total;
    check(acc >= 0.9, `${q.padEnd(4)} @${sr}: ${ok}/${total} = ${(acc * 100).toFixed(1)}% (need >= 90%)`);
    miss.forEach(s => console.log(`      miss: ${s}`));
  }
}
qualities(48000, ['dim', 'aug', 'sus2', 'sus4', '7', 'maj7', 'm7']);
qualities(44100, ['7', 'maj7', 'm7']);

// 3. inversions: the root stays the root, bassPc follows the bass
{
  let ok = 0, bassOk = 0, total = 0;
  const miss = [];
  for (const r of [0, 0, 2, 5, 7, 9, 10]) {
    const inv = {
      '/3rd': [52 + r, 55 + r, 60 + r],
      '/5th': [55 + r, 60 + r, 64 + r],
      '/3rd open': [40 + r, 48 + r, 55 + r, 64 + r],
      '/5th open': [43 + r, 52 + r, 60 + r, 64 + r]
    };
    for (const v in inv) {
      for (const kind of KINDS) {
        const { a, m } = hear(inv[v], kind, 48000, r, 'maj');
        const bass = inv[v][0] % 12;
        const good = same(m, r, 'maj'), gb = a && a.bassPc === bass;
        total++;
        if (good) ok++;
        if (gb) bassOk++;
        if (!good || !gb) miss.push(`${NAMES[r]}${v} ${kind} -> ${chordName(m)} bass ${a && a.bassPc >= 0 ? NAMES[a.bassPc] : '-'}`);
      }
    }
  }
  check(ok / total >= 0.9, `inversions keep their root: ${ok}/${total} = ${(ok / total * 100).toFixed(1)}% (need >= 90%)`);
  check(bassOk / total >= 0.9, `inversions bassPc = bass note: ${bassOk}/${total} = ${(bassOk / total * 100).toFixed(1)}% (need >= 90%)`);
  miss.forEach(s => console.log(`      miss: ${s}`));
}

// 4. fewer than three pitch classes is not a chord
{
  const cases = [['single C4', [60]], ['single A2', [45]], ['single E3', [52]], ['single G4', [67]],
    ['octave C3+C4', [48, 60]], ['octave A2+A3', [45, 57]],
    ['power C3+G3', [48, 55]], ['power E2+B2+E3', [40, 47, 52]], ['power A2+E3+A3', [45, 52, 57]], ['power D3+A3', [50, 57]]];
  for (const [name, notes] of cases) {
    const got = [];
    for (const kind of KINDS) got.push(listen(frame(notes, kind, 48000), 48000).m);
    check(got.every(m => m === null), `${name.padEnd(16)} -> ${got.map(chordName).join(', ')} (piano, guitar, organ: must be null)`);
  }
}

// 5. white noise and a near-silent frame
{
  const got = [];
  for (const lvl of [0.3, 0.1, 0.03, 0.01, 0.003]) {
    const x = new Float32Array(N);
    for (let i = 0; i < N; i++) x[i] = lvl * gauss();
    const { a, m } = listen(analyser(x), 48000);
    got.push(a ? chordName(m) + ` (${a.peaks} peaks)` : 'quiet');
  }
  check(got.every(s => s.startsWith('null') || s === 'quiet'), `white noise -> ${got.join(', ')} (must all be null)`);
  const q = P.analyzeSpectrum(frame([60, 64, 67], 'piano', 48000, { rms: 1e-5, noise: 0 }), 48000, N);
  check(q === null, `quiet C major (amplitude 1e-5) -> analyzeSpectrum ${q === null ? 'null' : 'not null'}`);
}

// 6. tracker: one on for a steady chord, a one-frame glitch is ignored, silence turns it off
{
  const C = { root: 0, quality: 'maj', score: 0.92, margin: 0.1, pcs: [0, 4, 7] };
  const Cweak = Object.assign({}, C, { score: 0.75 });   // under minScore 0.8, over keepScore 0.7
  const G = { root: 7, quality: 'maj', score: 0.9, margin: 0.1, pcs: [2, 7, 11] };
  const tr = P.createChordTracker({});
  let ons = 0, offs = 0, onAt = -1, offAt = -1;
  const stream = [];
  for (let i = 0; i < 40; i++) stream.push(i === 20 ? G : i >= 25 ? Cweak : C);   // glitch, then 15 weaker frames
  for (let i = 0; i < 20; i++) stream.push(null);
  stream.forEach((m, i) => {
    const o = tr.update(m);
    if (o.on) { ons++; if (onAt < 0) onAt = i; }
    if (o.off) { offs++; if (offAt < 0) offAt = i; }
  });
  check(ons === 1 && onAt === 5, `tracker: steady C gives one on (frame ${onAt}), one-frame glitch to G ignored (${ons} on)`);
  check(offs === 1 && offAt === 49, `tracker: weaker C frames keep it (hysteresis), silence turns it off (${offs} off, frame ${offAt})`);
  const tr2 = P.createChordTracker({});
  let changes = [];
  for (let i = 0; i < 30; i++) { const o = tr2.update(i < 15 ? C : G); if (o.on) changes.push(chordName(o.on) + (o.off ? ' (C off)' : '')); }
  check(changes.join(',') === 'C,G (C off)', `tracker: C then G -> ${changes.join(', ')}`);
}

// 7. cost per frame
{
  const frames = seen.slice(0, 48).map(f => f.db);
  const loud = new Float32Array(N);
  for (let i = 0; i < N; i++) loud[i] = 0.1 * gauss();
  frames.push(analyser(loud));   // noise: the most peaks, the worst case
  for (let i = 0; i < 4; i++) frames.forEach(db => listen(db, 48000));   // warm up
  const t0 = process.hrtime.bigint();
  const reps = 50;
  for (let i = 0; i < reps; i++) frames.forEach(db => listen(db, 48000));
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / (reps * frames.length);
  check(ms < 2, `analyzeSpectrum + matchChord: ${ms.toFixed(3)} ms per frame (budget 2 ms)`);
}

// The app may call matchChord with bassPc only; report how that path does.
{
  let ok = 0;
  seen.forEach(f => {
    const a = P.analyzeSpectrum(f.db, f.sr, N);
    if (same(a && P.matchChord(a.chroma, { bassPc: a.bassPc }), f.root, f.q)) ok++;
  });
  console.log(`INFO  without opts.played: ${ok}/${seen.length} = ${(100 * ok / seen.length).toFixed(1)}% of the chord frames above`);
}

scores.sort((a, b) => a - b);
console.log(`INFO  scores of correct chords: min ${scores[0].toFixed(3)}, 5th pct ${scores[Math.floor(scores.length * 0.05)].toFixed(3)}, median ${scores[scores.length >> 1].toFixed(3)}`);
console.log(fails ? `\n${fails} failing` : '\nall passing');
process.exit(fails ? 1 : 0);
