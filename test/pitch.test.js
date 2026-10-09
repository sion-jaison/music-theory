const P = require('../src/pitch.js');

const SR = 48000, N = 2048;
function tone(f, harmonics, opts) {
  opts = opts || {};
  const buf = new Float32Array(N);
  const phase0 = opts.phase || 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const vib = opts.vibCents ? Math.pow(2, (opts.vibCents * Math.sin(2 * Math.PI * 5.5 * t)) / 1200) : 1;
    let v = 0;
    harmonics.forEach((a, h) => { v += a * Math.sin(2 * Math.PI * f * vib * (h + 1) * t + phase0 * (h + 1)); });
    if (opts.noise) v += (Math.random() * 2 - 1) * opts.noise;
    buf[i] = v * (opts.gain || 0.3);
  }
  return buf;
}
const det = P.createPitchDetector(SR, N, { minHz: 65, maxHz: 1400 });
const cases = [
  ['A4 sine', 440, [1]],
  ['A2 rich (piano-like)', 110, [1, 0.8, 0.6, 0.5, 0.4, 0.3]],
  ['Guitar low E', 82.41, [0.6, 1, 0.7, 0.5, 0.35, 0.2]],
  ['Weak fundamental C3', 130.81, [0.15, 1, 0.8, 0.4]],
  ['C6 sine', 1046.5, [1]],
  ['Voice 220 + vibrato + noise', 220, [1, 0.5, 0.3, 0.2], { vibCents: 20, noise: 0.05 }],
  ['Middle C square-ish', 261.63, [1, 0, 0.33, 0, 0.2, 0, 0.14]],
  ['G2 low voice', 98, [1, 0.7, 0.4], { noise: 0.03 }],
];
let fails = 0;
for (const [name, f, h, o] of cases) {
  const r = det(tone(f, h, o));
  const cents = 1200 * Math.log2(r.freq / f);
  const tol = 15 + ((o && o.vibCents) || 0);
  const ok = Math.abs(cents) < tol && r.clarity > 0.85 && Math.round(P.freqToMidi(r.freq)) === Math.round(P.freqToMidi(f));
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(30)} expected ${f.toFixed(2)}  got ${r.freq.toFixed(2)} Hz  (${cents.toFixed(1)} cents, clarity ${r.clarity.toFixed(3)})`);
}
// noise should not look like a clear pitch
const noise = new Float32Array(N).map(() => (Math.random() * 2 - 1) * 0.3);
const rn = det(noise);
const noiseOk = rn.clarity < 0.88;
if (!noiseOk) fails++;
console.log(`${noiseOk ? 'PASS' : 'FAIL'}  white noise clarity ${rn.clarity.toFixed(3)} (must be < 0.88)`);

// tracker: wobbling A4 must produce exactly one note-on
const tr = P.createNoteTracker({});
let ons = 0;
for (let i = 0; i < 20; i++) {
  const f = 440 * Math.pow(2, (Math.sin(i) * 45) / 1200);
  const o = tr.update({ freq: f, clarity: 0.95, rms: 0.1 }, true);
  if (o.on !== null) ons++;
}
const trOk = ons === 1;
if (!trOk) fails++;
console.log(`${trOk ? 'PASS' : 'FAIL'}  tracker held one note through ±45 cent wobble (${ons} note-on)`);

// timing: one detection must be fast enough for 30 per second
const t0 = Date.now();
const buf = tone(110, [1, 0.8, 0.6]);
for (let i = 0; i < 60; i++) det(buf);
const ms = (Date.now() - t0) / 60;
console.log(`INFO  ${ms.toFixed(2)} ms per detection (budget about 16 ms)`);
if (ms > 16) fails++;

// onset detector: claps every 0.5 s in a quiet room
const on = P.createOnsetDetector({});
let hits = 0;
for (let f = 0; f < 180; f++) {
  const t = f / 60;
  const clap = (f % 30 === 0) ? 0.25 : (f % 30 === 1 ? 0.08 : 0.004);
  if (on(clap, t)) hits++;
}
const onOk = hits === 6;
if (!onOk) fails++;
console.log(`${onOk ? 'PASS' : 'FAIL'}  onset detector found ${hits} of 6 claps`);

console.log(fails ? `\n${fails} failing` : '\nall passing');
process.exit(fails ? 1 : 0);
