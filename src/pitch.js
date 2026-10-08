/* ------------------------------------------------------------------
   Motif · listening engine
   Pitch: McLeod Pitch Method (McLeod & Wyvill, "A Smarter Way to Find
   Pitch", 2005). Normalized square difference function (NSDF), key
   maxima, k-threshold, parabolic interpolation.
   Chords: spectral-peak chroma and harmonic templates (further down).
   ------------------------------------------------------------------ */

function freqToMidi(f) { return 69 + 12 * Math.log2(f / 440); }
function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

function createPitchDetector(sampleRate, size, opts) {
  opts = opts || {};
  const minHz = opts.minHz || 60;
  const maxHz = opts.maxHz || 1500;
  const k = opts.k || 0.9;
  const maxLag = Math.min(size - 3, Math.floor(sampleRate / minHz));
  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  const x = new Float32Array(size);
  const nsdf = new Float32Array(maxLag + 3);

  return function detect(input) {
    const n = Math.min(size, input.length);
    let mean = 0;
    for (let i = 0; i < n; i++) mean += input[i];
    mean /= n;
    let energy = 0;
    for (let i = 0; i < n; i++) { const v = input[i] - mean; x[i] = v; energy += v * v; }
    const rms = Math.sqrt(energy / n);
    if (rms < 1e-4) return { freq: 0, clarity: 0, rms: rms };

    for (let tau = 0; tau <= maxLag + 1; tau++) {
      let acf = 0, m = 0;
      const lim = n - tau;
      for (let j = 0; j < lim; j++) {
        const a = x[j], b = x[j + tau];
        acf += a * b;
        m += a * a + b * b;
      }
      nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
    }

    // Skip the positive lobe around lag 0, then collect one key maximum per positive lobe.
    let tau = 1;
    while (tau <= maxLag && nsdf[tau] > 0) tau++;
    const peaks = [];
    let best = -1, bestIdx = -1, inPos = false;
    for (; tau <= maxLag; tau++) {
      const v = nsdf[tau];
      if (v > 0) {
        inPos = true;
        if (v > best) { best = v; bestIdx = tau; }
      } else if (inPos) {
        peaks.push(bestIdx);
        inPos = false;
        best = -1;
      }
    }
    if (inPos && bestIdx > 0 && bestIdx < maxLag) peaks.push(bestIdx);

    let top = 0;
    for (let i = 0; i < peaks.length; i++) {
      const p = peaks[i];
      if (p >= minLag && nsdf[p] > top) top = nsdf[p];
    }
    if (top <= 0) return { freq: 0, clarity: 0, rms: rms };

    const thr = k * top;
    let chosen = -1;
    for (let i = 0; i < peaks.length; i++) {
      const p = peaks[i];
      if (p >= minLag && nsdf[p] >= thr) { chosen = p; break; }
    }
    if (chosen < 1) return { freq: 0, clarity: 0, rms: rms };

    const a = nsdf[chosen - 1], b = nsdf[chosen], c = nsdf[chosen + 1];
    const den = a - 2 * b + c;
    let shift = 0, clarity = b;
    if (den !== 0) {
      shift = 0.5 * (a - c) / den;
      clarity = b - 0.25 * (a - c) * shift;
    }
    return { freq: sampleRate / (chosen + shift), clarity: Math.min(1, clarity), rms: rms };
  };
}

/* Turns a stream of pitch readings into note-on / note-off events.
   A note must hold for `need` readings; it is released after `release`
   readings of silence. Hysteresis keeps a wobbly voice on one note. */
function createNoteTracker(opts) {
  opts = opts || {};
  const need = opts.need || 3;
  const release = opts.release || 4;
  const minClarity = opts.minClarity || 0.88;
  let cand = null, candCount = 0, held = null, miss = 0;

  function update(r, gateOpen) {
    const out = { on: null, off: null, midiFloat: null };
    const ok = gateOpen && r.freq > 0 && r.clarity >= minClarity;
    if (ok) {
      const mf = freqToMidi(r.freq);
      out.midiFloat = mf;
      const m = (held !== null && Math.abs(mf - held) < 0.65) ? held : Math.round(mf);
      miss = 0;
      if (m === cand) candCount++; else { cand = m; candCount = 1; }
      if (candCount >= need && m !== held) {
        if (held !== null) out.off = held;
        held = m;
        out.on = m;
      }
    } else {
      miss++;
      cand = null;
      candCount = 0;
      if (held !== null && miss >= release) { out.off = held; held = null; }
    }
    return out;
  }
  function reset() {
    const prev = held;
    held = null; cand = null; candCount = 0; miss = 0;
    return prev;
  }
  return { update: update, reset: reset };
}

/* Onset (clap, strike) detector on frame loudness. */
function createOnsetDetector(opts) {
  opts = opts || {};
  const refractory = opts.refractory || 0.11;
  const gate = opts.gate || 0.02;
  const ratio = opts.ratio || 1.8;
  let slow = 0, prev = 0, last = -1;
  return function (rms, t) {
    const hit = rms > gate && rms > prev * ratio && rms > slow * ratio && (t - last) > refractory;
    slow = slow * 0.95 + rms * 0.05;
    prev = rms;
    if (hit) { last = t; return true; }
    return false;
  };
}

/* ------------------------------------------------------------------
   Chords: chroma from the spectral peaks of an AnalyserNode frame
   (getFloatFrequencyData: Blackman window, dB), matched against harmonic
   chord templates (Gómez 2006: each tone plus harmonics 1–6 with decaying
   weight) by cosine similarity. Overtones are the enemy: a lone C3 also
   sounds G and E, a power chord also sounds the 9th. So peaks that sit on
   another peak's harmonic series count less, and a chord tone that could be
   another chord tone's overtone must be stronger to count.
   ------------------------------------------------------------------ */

const CHORD_QUALITIES = [
  ['maj', [0, 4, 7]], ['min', [0, 3, 7]], ['dim', [0, 3, 6]], ['aug', [0, 4, 8]],
  ['sus2', [0, 2, 7]], ['sus4', [0, 5, 7]],
  ['7', [0, 4, 7, 10]], ['maj7', [0, 4, 7, 11]], ['m7', [0, 3, 7, 10]]
];
const CHORD_HARM_PC = [0, 0, 7, 0, 4, 7];   // round(12*log2(h)) mod 12, h = 1..6
let chordPkHz = new Float64Array(512), chordPkDb = new Float64Array(512);
let chordPkLvl = new Float64Array(512), chordPkSlope = new Float64Array(512), chordPkRef = new Uint8Array(512);
const chordAdj = new Float64Array(CHORD_QUALITIES.length * 12), chordRaw = new Float64Array(CHORD_QUALITIES.length * 12);

function chordMask(root, quality) {
  for (let q = 0; q < CHORD_QUALITIES.length; q++) {
    if (CHORD_QUALITIES[q][0] !== quality) continue;
    let m = 0;
    CHORD_QUALITIES[q][1].forEach(iv => { m |= 1 << ((root + iv) % 12); });
    return m;
  }
  return 0;
}

/* Index of the peak within 30 cents of f and at least minDb loud, or -1. */
function chordPeakNear(pkHz, pkDb, n, minDb, f) {
  for (let j = 0; j < n; j++) {
    if (pkDb[j] < minDb) continue;
    const c = 1200 * Math.log2(pkHz[j] / f);
    if (c > 30) break;
    if (c > -30) return j;
  }
  return -1;
}

/* One analyser frame (dB per bin) -> { chroma, bassPc, energy, peaks, played }
   or null when the frame is quiet or has too few peaks.
   chroma: Float32Array(12), max 1. bassPc: 0–11 or -1. energy: summed power
   of the peaks used. peaks: how many. played: 12-bit mask of pitch classes
   with a peak that is no harmonic of a lower peak (surely a played note);
   pass it on to matchChord with bassPc. Only local maxima count, so the
   noise floor and window sidelobes never reach the chroma. */
function analyzeSpectrum(db, sampleRate, fftSize, opts) {
  opts = opts || {};
  const floorDb = opts.floorDb != null ? opts.floorDb : -90;
  const rangeDb = opts.rangeDb || 45;
  const minTopDb = opts.minTopDb != null ? opts.minTopDb : -80;
  const minPeaks = opts.minPeaks || 3;
  const bassDb = opts.bassDb || 20;
  const compress = opts.compress || 0.65;
  const ot = opts.overtone != null ? opts.overtone : 0.5;
  const otDb = opts.overtoneDb != null ? opts.overtoneDb : -3;
  const binHz = sampleRate / fftSize;
  const lo = Math.max(1, Math.floor((opts.minHz || 55) / binHz));
  const hi = Math.min(db.length - 2, Math.ceil((opts.maxHz || 2100) / binHz));
  if (chordPkHz.length < hi - lo) {
    chordPkHz = new Float64Array(hi - lo); chordPkDb = new Float64Array(hi - lo);
    chordPkLvl = new Float64Array(hi - lo); chordPkSlope = new Float64Array(hi - lo); chordPkRef = new Uint8Array(hi - lo);
  }
  const pkHz = chordPkHz, pkDb = chordPkDb, pkLvl = chordPkLvl, pkSlope = chordPkSlope, pkRef = chordPkRef;

  // Local maxima, refined by a parabola through the three dB values.
  let n = 0, top = -Infinity;
  for (let k = lo; k <= hi; k++) {
    const b = db[k];
    if (!(b > floorDb && b > db[k - 1] && b >= db[k + 1])) continue;
    const a = db[k - 1], c = db[k + 1];
    let d = 0, p = b;
    if (a > -Infinity && c > -Infinity) {
      const den = a - 2 * b + c;
      if (den < 0) { d = 0.5 * (a - c) / den; p = b - 0.25 * (a - c) * d; }
    }
    pkHz[n] = (k + d) * binHz;
    pkDb[n] = p;
    n++;
    if (p > top) top = p;
  }
  if (n < minPeaks || top < minTopDb) return null;
  const thr = Math.max(floorDb, top - rangeDb);

  // Envelope of the series each peak would start: its loudest octave partial
  // among f, 2f, 4f (a piano's fundamental can sit under its 2nd partial, and
  // two notes an octave apart can cancel in one bin), falling by the darker
  // of the f->2f and 2f->4f steps, in dB per octave, clamped to [-24, 0].
  const tolLo = Math.pow(2, -30 / 1200), tolHi = Math.pow(2, 30 / 1200);
  const stretchHi = Math.pow(2, 60 / 1200);   // stiff strings run sharp
  for (let j = 0, k = 0, k4 = 0; j < n; j++) {
    while (k < n && pkHz[k] < 2 * tolLo * pkHz[j]) k++;
    while (k4 < n && pkHz[k4] < 4 * tolLo * pkHz[j]) k4++;
    const o2 = (k < n && pkHz[k] < 2 * tolHi * pkHz[j]) ? pkDb[k] : thr;
    const o4 = (k4 < n && pkHz[k4] < 4 * tolHi * pkHz[j]) ? pkDb[k4] : thr;
    const lv = Math.max(pkDb[j], o2, o4);
    pkLvl[j] = lv;
    pkSlope[j] = Math.max(-24, Math.min(0, o2 - pkDb[j], o4 - o2));
    pkRef[j] = lv === pkDb[j] ? 0 : lv === o2 ? 1 : 2;
  }

  // Each peak adds its linear magnitude to the nearest pitch class: full
  // weight within 25 cents, raised-cosine fade to zero at 45 cents. A peak at
  // h = 3, 5, 6, 7... times a lower peak, and no louder than that series'
  // envelope predicts (+ overtoneDb), may be just an overtone: it counts
  // `overtone` times, back to full over the next 4 dB (a played G4 over a
  // flute-like C3 is far louder than C3's envelope allows). Once a pitch class
  // has a peak on nobody's harmonic series it is played, and its later peaks
  // count in full.
  const chroma = new Float32Array(12);
  let used = 0, energy = 0, played = 0;
  for (let i = 0; i < n; i++) {
    if (pkDb[i] < thr) continue;
    used++;
    const lin = Math.pow(10, pkDb[i] / 20);
    energy += lin * lin;
    const m = 69 + 12 * Math.log2(pkHz[i] / 440);
    const r = Math.round(m);
    const dc = Math.abs(m - r) * 100;
    if (dc >= 45) continue;
    const pc = ((r % 12) + 12) % 12;
    let g = 1, harm = false;
    for (let j = 0; j < i && g > ot && !(played >> pc & 1); j++) {
      const q = pkHz[i] / pkHz[j];
      if (q > 16.5) continue;
      if (q < 1.9) break;
      const h = Math.round(q);
      if (pkDb[j] < thr || q < h * tolLo || q > h * stretchHi) continue;
      harm = true;
      if ((h & (h - 1)) === 0) continue;   // octaves keep the pitch class
      const ex = (pkDb[i] - (pkLvl[j] + pkSlope[j] * (Math.log2(h) - pkRef[j]) + otDb)) / 4;
      const gj = ex <= 0 ? ot : ex >= 1 ? 1 : ot + (1 - ot) * ex;
      if (gj < g) g = gj;
    }
    if (!harm && pkDb[i] >= top - 30) played |= 1 << pc;
    chroma[pc] += g * (dc <= 25 ? 1 : Math.pow(Math.cos(Math.PI * (dc - 25) / 40), 2)) * lin;
  }
  if (used < minPeaks) return null;
  // Compress the sums so a tripled root does not drown a single third.
  let max = 0;
  for (let i = 0; i < 12; i++) { chroma[i] = Math.pow(chroma[i], compress); if (chroma[i] > max) max = chroma[i]; }
  if (max <= 0) return null;
  for (let i = 0; i < 12; i++) chroma[i] /= max;

  // Bass: lowest peak that is strong, or not far below and with a strong
  // octave (a piano or a small mic can leave the fundamental well under the
  // 2nd harmonic). A peak that is the 3rd partial of real but weaker peaks
  // at f/3 and 2f/3 yields to f/3.
  const strong = top - bassDb, weak = top - 30;
  let bass = -1;
  for (let i = 0; i < n && bass < 0; i++) {
    if (pkDb[i] >= strong) bass = i;
    else if (pkDb[i] >= weak) { const j = chordPeakNear(pkHz, pkDb, n, weak, 2 * pkHz[i]); if (j >= 0 && pkDb[j] >= strong) bass = i; }
  }
  let bassPc = -1;
  if (bass >= 0) {
    let f = pkHz[bass];
    const j = chordPeakNear(pkHz, pkDb, n, weak, f / 3);
    if (j >= 0 && chordPeakNear(pkHz, pkDb, n, weak, 2 * f / 3) >= 0) f = pkHz[j];
    bassPc = ((Math.round(69 + 12 * Math.log2(f / 440)) % 12) + 12) % 12;
  }
  return { chroma: chroma, bassPc: bassPc, energy: energy, peaks: used, played: played };
}

/* Templates: each chord tone plus its harmonics 1–6 (weight decay^(h-1))
   folded onto pitch classes, unit length. Built for root C; roots rotate. */
let chordTpl = null, chordTplDecay = -1;
function chordTemplates(decay) {
  if (chordTpl && chordTplDecay === decay) return chordTpl;
  chordTpl = CHORD_QUALITIES.map(q => {
    const t = new Float64Array(12);
    q[1].forEach(iv => { for (let h = 0; h < 6; h++) t[(iv + CHORD_HARM_PC[h]) % 12] += Math.pow(decay, h); });
    let nn = 0;
    for (let i = 0; i < 12; i++) nn += t[i] * t[i];
    nn = Math.sqrt(nn);
    for (let i = 0; i < 12; i++) t[i] /= nn;
    const masks = new Uint16Array(12);
    for (let r = 0; r < 12; r++) masks[r] = chordMask(r, q[0]);
    return { name: q[0], ivs: q[1], t: t, masks: masks };
  });
  chordTplDecay = decay;
  return chordTpl;
}

/* Chroma -> best { root, quality, score, margin, pcs } or null.
   score: cosine similarity with the template. margin: lead over the next
   chord with a different pitch-class set (C+ = E+ = G♯+ and Csus2 = Gsus4
   are one set and do not count against each other). pcs: pitch classes at
   or above `active`. opts.bassPc and opts.played come from analyzeSpectrum;
   bassPc only breaks near-ties (sus2/sus4, aug, C6-like sets). */
function matchChord(chroma, opts) {
  opts = opts || {};
  const minScore = opts.minScore != null ? opts.minScore : 0.6;
  const active = opts.active || 0.3;
  const toneMin = opts.toneMin || 0.3;
  const need3 = opts.need3 || 0.7, need5 = opts.need5 || 0.55, need7 = opts.need7 || 0.4;
  const fifthMin = opts.fifthMin || 0.2;
  const minShare = opts.minShare != null ? opts.minShare : 0.6;
  const bassPc = opts.bassPc != null ? opts.bassPc : -1;
  const bassBonus = opts.bassBonus != null ? opts.bassBonus : 0.02;
  const played = opts.played || 0;
  const qualities = opts.qualities || null;
  const tpl = chordTemplates(opts.decay || 0.6);

  let max = 0, e2 = 0;
  for (let i = 0; i < 12; i++) if (chroma[i] > max) max = chroma[i];
  if (!(max > 0)) return null;
  const pcs = [];
  for (let i = 0; i < 12; i++) {
    e2 += chroma[i] * chroma[i];
    if (chroma[i] >= active * max) pcs.push(i);
  }
  if (pcs.length < 3) return null;
  const nn = Math.sqrt(e2);

  const n = tpl.length * 12, adj = chordAdj, raw = chordRaw;
  for (let q = 0; q < tpl.length; q++) {
    const skip = qualities && qualities.indexOf(tpl[q].name) < 0, t = tpl[q].t;
    for (let r = 0; r < 12; r++) {
      const k = q * 12 + r;
      if (skip) { adj[k] = -Infinity; continue; }
      let dot = 0;
      for (let i = 0; i < 12; i++) dot += chroma[(i + r) % 12] * t[i];
      raw[k] = dot / nn;
      adj[k] = raw[k] + (r === bassPc ? bassBonus : 0);
    }
  }

  // Take the best-scoring candidate whose tones are all clearly there. A tone
  // that is not surely played but sits a fifth, a major third or a minor
  // seventh above another chord tone could be that tone's 3rd, 5th or 7th
  // harmonic, so it must be stronger: this keeps a power chord from passing
  // as sus2 and C (with E's 3rd harmonic B) from passing as Cmaj7. The fifth
  // over the root of a non-sus chord only has to be present: it tells the
  // least and often hides in the root's own 3rd harmonic. Then the chord
  // tones must hold most of the chroma energy (noise spreads it out).
  for (let tries = 0; tries < 8; tries++) {
    let k = -1;
    for (let i = 0; i < n; i++) if (adj[i] > -Infinity && (k < 0 || adj[i] > adj[k] + 1e-9)) k = i;
    if (k < 0 || raw[k] < minScore) return null;
    const r = k % 12, ivs = tpl[(k / 12) | 0].ivs, sus = ivs[1] === 2 || ivs[1] === 5;
    let ok = true, share = 0;
    for (let a = 0; a < ivs.length && ok; a++) {
      const pc = (r + ivs[a]) % 12, v = chroma[pc];
      let need = toneMin;
      if (ivs[a] === 7 && !sus) need = fifthMin;
      else if (!(played >> pc & 1)) {
        for (let b = 0; b < ivs.length; b++) {
          const d = (ivs[a] - ivs[b] + 12) % 12;
          need = Math.max(need, d === 7 ? need3 : d === 4 ? need5 : d === 10 ? need7 : 0);
        }
      }
      share += v * v;
      if (v < need * max) ok = false;
    }
    if (!ok || share < minShare * e2) { adj[k] = -Infinity; continue; }
    const mk = tpl[(k / 12) | 0].masks[r];
    let second = 0;
    for (let i = 0; i < n; i++) if (adj[i] > second && tpl[(i / 12) | 0].masks[i % 12] !== mk) second = adj[i];
    return { root: r, quality: tpl[(k / 12) | 0].name, score: raw[k], margin: adj[k] - second, pcs: pcs };
  }
  return null;
}

/* Turns a stream of matchChord results into chord-on / chord-off events.
   A chord must win `need` frames in a row to start and is released after
   `release` frames of silence or other chords. Hysteresis: once held, a
   frame of the same chord down to `keepScore` still counts. */
function createChordTracker(opts) {
  opts = opts || {};
  const need = opts.need || 6;
  const release = opts.release || 10;
  const minScore = opts.minScore != null ? opts.minScore : 0.8;
  const keepScore = opts.keepScore != null ? opts.keepScore : minScore - 0.1;
  let cand = 0, candCount = 0, held = null, heldKey = 0, miss = 0;

  function update(m) {
    const out = { on: null, off: false };
    const key = m ? chordMask(m.root, m.quality) : 0;   // same pitch-class set = same chord
    if (m && held && key === heldKey && m.score >= keepScore) {
      miss = 0; cand = key; candCount = need;
      return out;
    }
    if (m && m.score >= minScore) {
      if (key === cand) candCount++; else { cand = key; candCount = 1; }
      if (candCount >= need) {
        out.off = held !== null;
        held = m; heldKey = key; miss = 0;
        out.on = m;
        return out;
      }
    } else {
      cand = 0; candCount = 0;
    }
    if (held && ++miss >= release) { out.off = true; held = null; heldKey = 0; miss = 0; }
    return out;
  }
  function reset() {
    const prev = held;
    held = null; heldKey = 0; cand = 0; candCount = 0; miss = 0;
    return prev;
  }
  return { update: update, reset: reset };
}

if (typeof module !== 'undefined') {
  module.exports = {
    freqToMidi, midiToFreq, createPitchDetector, createNoteTracker, createOnsetDetector,
    analyzeSpectrum, matchChord, createChordTracker
  };
}
