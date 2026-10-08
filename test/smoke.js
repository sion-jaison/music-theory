const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(process.env.MOTIF_PAGE || __dirname + '/../dist/motif-standalone.html', 'utf8');
const errors = [];
const dom = new JSDOM(html, {
  url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w) {
    const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
    const node = () => ({ connect() {}, start() {}, stop() {}, gain: param(), frequency: param(), type: '' });
    w.scrollTo = () => {};
    w.AudioContext = function () { this.state = 'running'; this.sampleRate = 48000; this.destination = {}; };
    Object.defineProperty(w.AudioContext.prototype, 'currentTime', { get() { return w.performance.now() / 1000; } });
    Object.assign(w.AudioContext.prototype, { resume() {}, createGain: node, createOscillator: node, createBiquadFilter: node });
    w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
    w.console.error = (...a) => errors.push(a.join(' '));
    w.addEventListener('error', e => errors.push(e.message));
  }
});
const w = dom.window, d = w.document;
const wait = ms => new Promise(r => setTimeout(r, ms));
const key = k => d.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true }));
const click = sel => { const el = typeof sel === 'string' ? d.querySelector(sel) : sel; if (!el) throw new Error('missing ' + sel); el.click(); };
const next = () => { const b = d.querySelector('.stage [data-act="next"]'); if (!b) throw new Error('no next'); if (b.disabled) throw new Error('next still disabled at: ' + d.querySelector('.stage .tag').textContent); b.click(); };
const check = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) process.exitCode = 1; };

(async () => {
  await wait(300);
  check(d.querySelectorAll('.unit').length === 11, 'home shows 11 Level 1 stops');
  check(d.querySelectorAll('.kb .key').length === 25, 'dock keyboard has 25 keys (C3–C5)');
  check(d.title === 'Motif', 'page title is set');
  check(d.querySelectorAll('.level-tabs button').length >= 1, 'home shows level tabs');

  // Unit 1.1
  click('.unit[data-u="1.1"]'); await wait(50);
  next(); await wait(50);
  key('a'); key('s'); key('d'); await wait(50);
  check(!d.querySelector('.stage [data-act="next"]').disabled, '1.1 climb completes after three rising notes');
  next(); await wait(50);
  key('d'); key('s'); key('a'); await wait(50);
  next(); await wait(50);
  next(); await wait(50);
  check(/done/.test(d.querySelector('.done-card .big').textContent), '1.1 finishes and shows the completion screen');

  // Unit 1.3: landmarks
  click('[data-act="home"]'); await wait(50);
  click('.unit[data-u="1.3"]'); await wait(50);
  next(); await wait(20);
  check(d.querySelectorAll('.kb .key.hint').length === 5, '1.3 card highlights every C and F (5 keys)');
  next(); await wait(20);
  key('a'); key('k'); key('z'); key('a'); await wait(50);
  check(!d.querySelector('.stage [data-act="next"]').disabled, '1.3 find every C completes with C4, C5, C3');
  next(); await wait(20);
  key('f'); key('x'); key('f'); key('x'); key('f'); await wait(50);
  next(); await wait(20);
  key('z');
  for (let i = 0; i < 5; i++) {
    const label = d.querySelector('.big-name').textContent;
    const pc = { D: 's', E: 'd', G: 'g', A: 'h', B: 'j' }[label];
    key(pc); await wait(700);
  }
  check(!d.querySelector('.stage [data-act="next"]').disabled, '1.3 play-by-name completes');
  next(); await wait(50);

  // Unit 1.5: half and whole steps
  click('[data-act="home"]'); await wait(50);
  click('.unit[data-u="1.5"]'); await wait(30);
  next(); await wait(20); next(); await wait(20);
  const SH = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const KEYS = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j'];
  for (let i = 0; i < 5; i++) {
    const m = d.querySelector('.stage .prompt').textContent.match(/(Half|Whole) step (up|down) from (\S+)/);
    const start = SH.indexOf(m[3]);
    const want = ((start + (m[2] === 'up' ? 1 : -1) * (m[1] === 'Half' ? 1 : 2)) % 12 + 12) % 12;
    key(KEYS[want]); await wait(1200);
  }
  check(!d.querySelector('.stage [data-act="next"]').disabled, '1.5 five half/whole step rounds complete');
  next(); await wait(20);
  ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k'].forEach(key); await wait(50);
  check(/chromatic/.test(d.querySelector('.stage .fb').textContent), '1.5 chromatic run of 13 notes completes');
  next(); await wait(50);

  // Every other unit opens and every step renders (skip through)
  for (const id of ['1.2', '1.4', '1.6', '1.7', '1.8', '1.9', '1.M']) {
    click('[data-act="home"]') ; await wait(20);
    click(`.unit[data-u="${id}"]`); await wait(40);
    let guard = 0;
    while (d.querySelector('.stage') && guard++ < 10) {
      const sk = d.querySelector('.stage [data-act="skip"]');
      if (sk) sk.click(); else next();
      await wait(40);
    }
    check(!!d.querySelector('.done-card'), `${id} renders every step and finishes`);
  }
  // Boss: no skipping. Part 1 plays 8 named notes; part 2 keeps the beat.
  click('[data-act="home"]'); await wait(20);
  click('.unit[data-u="1.B"]'); await wait(40);
  next(); await wait(40);
  check(!d.querySelector('.stage [data-act="skip"]'), 'boss steps cannot be skipped');
  const PCKEY = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j'];
  const NAMES = { 'C': 0, 'C♯': 1, 'D♭': 1, 'D': 2, 'D♯': 3, 'E♭': 3, 'E': 4, 'F': 5, 'F♯': 6, 'G♭': 6, 'G': 7, 'G♯': 8, 'A♭': 8, 'A': 9, 'A♯': 10, 'B♭': 10, 'B': 11 };
  for (let i = 0; i < 8; i++) { key(PCKEY[NAMES[d.querySelector('.big-name').textContent]]); await wait(700); }
  check(!d.querySelector('.stage [data-act="next"]').disabled, 'boss part 1: eight named notes played in time');
  next(); await wait(40);
  const bspb = 0.75, bt0 = w.performance.now() / 1000 + 0.35;
  click('[data-act="go"]');
  for (let i = 0; i < 8; i++) { const at = (bt0 + (4 + i) * bspb + 0.02) * 1000; await wait(at - w.performance.now()); key(' '); }
  await wait(1400);
  next(); await wait(40);
  check(d.querySelector('.done-card .big').textContent.includes('Level 1 passed'), 'boss finish marks Level 1 passed');
  check(/Level 2/.test(d.querySelector('.done-card').textContent), 'passing the boss opens Level 2');

  // Motif: record black keys, reject a white key, save
  click('[data-act="home"]'); await wait(20);
  click('.unit[data-u="1.M"]'); await wait(30);
  next(); await wait(30);
  click('[data-act="rec"]'); key('w'); key('a'); key('e'); key('t'); await wait(30);
  check(/white key/.test(d.querySelector('.stage .fb').textContent), 'motif recorder rejects a white key');
  d.querySelector('#motif-name').value = 'Test motif';
  click('[data-act="save"]'); await wait(30);
  click('.nav [data-view="sketchbook"]'); await wait(30);
  check(d.querySelector('.sketch h3').textContent === 'Test motif', 'sketchbook lists the saved motif');

  // Daily Set: walk all six steps with skip
  click('.nav [data-view="home"]'); await wait(20);
  check(d.querySelector('.stat b') !== null, 'home stats render');
  click('[data-act="daily"]'); await wait(300);
  key('a'); await wait(30);
  for (let i = 0; i < 5; i++) { click('.stage [data-act="skip"]'); await wait(60); }
  check(/1%/.test(d.querySelector('.stage .tag').textContent), 'Daily Set reaches Today’s 1%');
  check(/\b1\b/.test(d.getElementById('streak').textContent), 'streak becomes 1 day');

  // Review deck has cards and renders a card
  click('[data-act="next"]'); await wait(30);
  const due = +d.querySelectorAll('.stat b')[1].textContent;
  check(due > 0, `review deck has ${due} cards due after finishing units`);
  click('[data-act="daily"]'); await wait(50);
  click('.stage [data-act="skip"]'); await wait(60);
  check(/Card 1 of/.test(d.querySelector('.stage').textContent), 'review step shows the first due card');

  click('.nav [data-view="setup"]'); await wait(30);
  check(d.querySelectorAll('.setup-list .panel').length === 5, 'sound setup renders 5 panels');
  click('[data-act="mic"]'); await wait(50);
  check(/not available|blocked/.test(d.querySelector('[data-mic-status]').textContent), 'mic reports unavailable cleanly when there is no getUserMedia');

  const stored = JSON.parse(w.localStorage.getItem('motif.v1'));
  check(stored && stored.units['1.1'].done && stored.sketches.length >= 1, 'progress and sketches persist to storage');

  check(errors.length === 0, 'no runtime errors' + (errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''));
  process.exit(process.exitCode || 0);
})().catch(e => { console.log('CRASH', e.message, errors.slice(0, 5)); process.exit(1); });
