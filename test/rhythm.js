const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(process.env.MOTIF_PAGE || __dirname + '/../dist/motif-standalone.html', 'utf8');
const errors = [];
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(w) {
  w.scrollTo = () => {};
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect() {}, start() {}, stop() {}, gain: param(), frequency: param(), type: '' });
  w.AudioContext = function () { this.state = 'running'; this.sampleRate = 48000; this.destination = {}; };
  Object.defineProperty(w.AudioContext.prototype, 'currentTime', { get() { return w.performance.now() / 1000; } });
  Object.assign(w.AudioContext.prototype, { resume() {}, createGain: node, createOscillator: node, createBiquadFilter: node });
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}) });
  w.console.error = (...a) => errors.push(a.join(' '));
}});
const w = dom.window, d = w.document, wait = ms => new Promise(r => setTimeout(r, ms));
const space = () => d.dispatchEvent(new w.KeyboardEvent('keydown', { key: ' ', bubbles: true }));
const check = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) process.exitCode = 1; };
(async () => {
  await wait(200);
  // 1.7 pulse at 80 BPM: tap on every beat, 20 ms late
  d.querySelector('.unit[data-u="1.7"]').click(); await wait(30);
  d.querySelector('.stage [data-act="next"]').click(); await wait(30);
  const spb = 0.75, t0 = w.performance.now() / 1000 + 0.35;
  d.querySelector('[data-act="go"]').click();
  for (let i = 0; i < 8; i++) { const at = (t0 + (4 + i) * spb + 0.02) * 1000; await wait(at - w.performance.now()); space(); }
  await wait(1400);
  check(/8 of 8 beats/.test(d.querySelector('.stage .fb').textContent), 'pulse: 8 on-beat taps score 8 of 8 — "' + d.querySelector('.stage .fb').textContent + '"');
  check(!d.querySelector('.stage [data-act="next"]').disabled, 'pulse: step unlocks');
  // second run: only 4 taps should fail
  d.querySelector('[data-act="go"]').click();
  const t1 = w.performance.now() / 1000 + 0.35;
  for (let i = 0; i < 4; i++) { const at = (t1 + (4 + i) * spb) * 1000; await wait(at - w.performance.now()); space(); }
  await wait(4 * spb * 1000 + 1400);
  check(/4 of 8 beats landed/.test(d.querySelector('.stage .fb').textContent), 'pulse: 4 taps are scored as a miss — "' + d.querySelector('.stage .fb').textContent + '"');

  // 1.8 clap-back, first pattern is four quarter notes at 72 BPM
  d.querySelector('[data-act="exit"]').click(); await wait(30);
  d.querySelector('.unit[data-u="1.8"]').click(); await wait(30);
  d.querySelector('.stage [data-act="next"]').click(); await wait(30);
  check(d.querySelectorAll('.notation .syl').length === 4, 'clap-back shows ta ta ta ta under the first rhythm');
  const sb = 60 / 72, c0 = w.performance.now() / 1000 + 0.3;
  d.querySelector('[data-act="go"]').click();
  for (let i = 0; i < 4; i++) { const at = (c0 + (4 + i) * sb - 0.03) * 1000; await wait(at - w.performance.now()); space(); }
  await wait(5 * sb * 1000);
  check(d.querySelectorAll('.stage .progress-dots span.on').length === 1, 'clap-back: four quarters tapped 30 ms early all land (first rhythm marked done)');
  check(errors.length === 0, 'no runtime errors' + (errors.length ? ': ' + errors[0] : ''));
  process.exit(process.exitCode || 0);
})();
