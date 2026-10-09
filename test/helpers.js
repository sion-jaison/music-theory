/* Shared jsdom harness for the DOM walkthrough tests.
   const H = require('./helpers'); const t = await H.load({ unlock: 3 });  // Levels 1–3 open
   t.key('a') plays C on the computer keys; t.keys('a d g') taps several; t.openUnit('2.3'); t.walk('2.4') skips through a unit. */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const PAGE = process.env.MOTIF_PAGE || __dirname + '/../public/index.html';
/* computer-key letter for each pitch class, from the app's A–K map (C D E F G A B with W E T Y U for black keys) */
const PC_KEY = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j'];

async function load(opts) {
  opts = opts || {};
  const html = fs.readFileSync(PAGE, 'utf8');
  const errors = [];
  let failures = 0;
  const dom = new JSDOM(html, {
    url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      /* params remember their automation (ev: [kind, value, time]) so tests can see a fade or a mute */
      const param = () => ({ value: 0, ev: [], setValueAtTime(v, t) { this.ev.push(['set', v, t]); }, linearRampToValueAtTime(v, t) { this.ev.push(['lin', v, t]); }, exponentialRampToValueAtTime(v, t) { this.ev.push(['exp', v, t]); } });
      const node = () => ({ connect() {}, disconnect() {}, start() {}, stop() {}, gain: param(), frequency: param(), detune: param(), Q: param(), playbackRate: param(), type: '' });
      w.scrollTo = () => {};
      w.AudioContext = function () { this.state = 'running'; this.sampleRate = 48000; this.destination = {}; };
      Object.defineProperty(w.AudioContext.prototype, 'currentTime', { get() { return w.performance.now() / 1000; } });
      Object.assign(w.AudioContext.prototype, { resume() {}, createGain: node, createOscillator: node, createBiquadFilter: node,
        /* buffers, buffer sources, analysers and media sources for the studio tools (no real audio: analysers hear silence) */
        createBuffer(ch, len, sr) { const data = Array.from({ length: ch }, () => new Float32Array(len)); return { numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: i => data[i] }; },
        createBufferSource: node, createMediaElementSource: node,
        createAnalyser() { return Object.assign(node(), { fftSize: 2048, smoothingTimeConstant: 0.8, get frequencyBinCount() { return this.fftSize / 2; }, getFloatFrequencyData(a) { a.fill(-120); }, getFloatTimeDomainData(a) { a.fill(0); }, getByteFrequencyData(a) { a.fill(0); } }); } });
      w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
      w.console.error = (...a) => errors.push(a.join(' '));
      w.addEventListener('error', e => errors.push(e.message));
      if (opts.unlock || opts.store) {
        const units = {};
        for (let n = 1; n < (opts.unlock || 1); n++) units[n + '.B'] = { done: true, at: '2026-01-01' };
        w.localStorage.setItem('motif.v1', JSON.stringify(Object.assign({ v: 1, units }, opts.store || {})));
      }
    }
  });
  const w = dom.window, d = w.document;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const t = {
    w, d, errors, wait, PC_KEY,
    $: sel => d.querySelector(sel),
    $$: sel => [...d.querySelectorAll(sel)],
    key(k) { d.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true })); },
    async keys(list, gap) { for (const k of list.split(/\s+/).filter(Boolean)) { t.key(k); await wait(gap == null ? 20 : gap); } },
    /* play a pitch class (0–11) or a note name like 'F♯' / 'Bb' on the computer keys */
    pc(x) { t.key(PC_KEY[typeof x === 'number' ? x : nameToPc(x)]); },
    /* works for SVG elements too (circle wedges), which have no .click() in jsdom */
    click(sel) { const el = typeof sel === 'string' ? d.querySelector(sel) : sel; if (!el) throw new Error('missing ' + sel); if (typeof el.click === 'function') el.click(); else el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); },
    nextBtn: () => d.querySelector('.stage [data-act="next"]'),
    next() { const b = t.nextBtn(); if (!b) throw new Error('no next button'); if (b.disabled) throw new Error('next still disabled at: ' + (d.querySelector('.stage .tag') || {}).textContent); b.click(); },
    check(cond, msg) { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) { failures++; process.exitCode = 1; } },
    get failures() { return failures; },
    home(level) { t.click('.nav [data-view="home"]'); if (level) t.click(`.level-tabs [data-level="${level}"]`); },
    openUnit(id) { t.home(+id.split('.')[0]); t.click(`.unit[data-u="${id}"]`); },
    /* open a unit and go through every step: Skip where offered, Next otherwise. Returns true when the completion card shows. */
    async walk(id) {
      t.openUnit(id); await wait(40);
      let guard = 0;
      while (d.querySelector('.stage') && guard++ < 30) {
        const sk = d.querySelector('.stage [data-act="skip"]');
        if (sk) sk.click(); else t.next();
        await wait(40);
      }
      return !!d.querySelector('.done-card');
    },
    finish() {
      t.check(errors.length === 0, 'no runtime errors' + (errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''));
      process.exit(process.exitCode || 0);
    }
  };
  await wait(opts.settle || 250);
  return t;
}
function nameToPc(n) {
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[n[0].toUpperCase()];
  let acc = 0; for (const ch of n.slice(1)) acc += (ch === '#' || ch === '♯') ? 1 : (ch === 'b' || ch === '♭') ? -1 : 0;
  return ((base + acc) % 12 + 12) % 12;
}
module.exports = { load, nameToPc, PC_KEY };
