/* ------------------------------------------------------------------
   Motif · listening engine
   Pitch: McLeod Pitch Method (McLeod & Wyvill, "A Smarter Way to Find
   Pitch", 2005). Normalized square difference function (NSDF), key
   maxima, k-threshold, parabolic interpolation.
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

if (typeof module !== 'undefined') {
  module.exports = { freqToMidi, midiToFreq, createPitchDetector, createNoteTracker, createOnsetDetector };
}
