/* Level 6 rhythm units (6.1–6.4) walkthrough (jsdom): every unit renders and adds its cards; the main task of every step
   is driven with Space taps and computer keys at the right times; ear questions are answered from what the app plays
   (Sound.tone, Sound.chord and Sound.wood are wrapped to log it); every review card renders.
   Needs Level 6 registered: in this worktree a stub 63-level6.js does that. */
const H = require('./helpers');

const L5 = { id: 'sL5', name: 'Walking home', notes: [{ m: 67, t: 0, d: 0.6 }, { m: 69, t: 0.667, d: 0.6 }, { m: 71, t: 1.333, d: 0.6 }, { m: 66, t: 2, d: 0.6 }, { m: 67, t: 2.667, d: 1.2 }], key: 'G major', bpm: 90, level: 5, created: '2026-10-01', prompt: '' };
const DUR = { whole: 4, half: 2, quarter: 1, eighth: 0.5, sixteenth: 0.25, '32nd': 0.125 };

(async () => {
  const t = await H.load({ unlock: 6, store: { sketches: [L5] } });
  const { w, d, wait } = t;
  const M = w.Motif, S = w.MotifNotation.Score;
  const now = () => w.performance.now() / 1000;
  const until = async s => { const ms = (s - now()) * 1000; if (ms > 0) await wait(ms); };
  const $ = sel => d.querySelector('.stage ' + sel);
  const $$ = sel => [...d.querySelectorAll('.stage ' + sel)];
  const nextOn = () => !!t.nextBtn() && !t.nextBtn().disabled;
  const fbText = () => $$('.fb').map(e => e.textContent).join(' | ');
  const lv6 = M.LEVELS.find(l => l.n === 6);
  const stepP = (id, k) => { const s = lv6.units.find(u => u.id === id).steps[k - 1]; return typeof s.p === 'function' ? s.p() : s.p; };

  /* what the app plays */
  let tones = [], chords = 0, woods = [];
  const tone0 = M.Sound.tone, chord0 = M.Sound.chord, wood0 = M.Sound.wood;
  M.Sound.tone = function (m, when) { tones.push({ m, when }); return tone0.apply(this, arguments); };
  M.Sound.chord = function () { chords++; return chord0.apply(this, arguments); };
  M.Sound.wood = function (when) { woods.push(when); return wood0.apply(this, arguments); };

  /* a rhythm from an engraving's label: onsets and length in quarters */
  function rhythmOf(svg) {
    const m = /^Rhythm in (\d+)\/(\d+)(?:, \d+ bars)?: (.*)$/.exec(svg.getAttribute('aria-label'));
    const barLen = +m[1] * 4 / +m[2], onsets = [];
    let at = 0;
    m[3].split(', ').forEach(item => item.split(' tied to ').forEach((part, k) => {
      const r = /^(dotted )?(triplet )?(whole|half|quarter|eighth|sixteenth|32nd) (note|rest)$/.exec(part);
      const len = part === 'whole-bar rest' ? barLen : DUR[r[3]] * (r[1] ? 1.5 : 1) * (r[2] ? 2 / 3 : 1);
      if (part !== 'whole-bar rest' && r[4] === 'note' && k === 0) onsets.push(at);
      at += len;
    }));
    return { barLen, onsets, len: at };
  }
  const sameOnsets = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 0.02);
  /* My turn in a rhythmTap: count-in of one bar, then a Space tap on every onset */
  async function clap(p, opts) {
    opts = opts || {};
    const spb = 60 / p.bpm, barLen = S.meter(p.meter).barLen, start = now() + 0.15 + barLen * spb;
    $('[data-act="go"]').click();
    const r = rhythmOf($('.nt-box svg'));
    const taps = (opts.positions || r.onsets).map(b => start + b * spb + (opts.jitter || 0.012));
    for (const at of taps) { await until(at); t.key(' '); }
    await until(start + r.len * spb + 0.75);
    return r;
  }
  async function clapRounds(p, n) {
    for (let k = 0; k < n; k++) await clap(p);
    return $$('.progress-dots span.on').length;
  }
  /* open a unit at step n (Skip on tasks, Next on cards) */
  async function gotoStep(id, n) {
    t.openUnit(id); await wait(40);
    for (let i = 1; i < n; i++) { const sk = $('[data-act="skip"]'); if (sk) sk.click(); else t.next(); await wait(40); }
    return new RegExp(`step ${n} of`).test($('.tag').textContent);
  }

  /* ---------- home and walks ---------- */
  t.home(6); await wait(30);
  t.check(['6.1', '6.2', '6.3', '6.4'].every(id => d.querySelector(`.unit[data-u="${id}"]`)), 'Level 6 path lists units 6.1–6.4');
  for (const id of ['6.1', '6.2', '6.3', '6.4']) {
    t.check(await t.walk(id), `${id} renders every step and finishes`);
    const u = lv6.units.find(x => x.id === id), cards = (M.CARD_DEFS[id] || []).map(c => c.id);
    t.check(u.steps.length >= 4 && u.steps.length <= 6 && u.steps[u.steps.length - 1].tag === 'Create' && u.steps.filter(s => s.k === 'task').length >= 2, `${id}: ${u.steps.length} steps, at least two tasks, ending in a workshop`);
    t.check(cards.length >= 3 && cards.length <= 6 && cards.every(c => /^l6-/.test(c) && M.Store.data.cards[c]) && (M.CARD_DEFS[id] || []).some(c => c.type === 'l6clap') && (M.CARD_DEFS[id] || []).some(c => c.type === 'gen'), `${id} adds ${cards.length} review cards (gen and l6clap among them)`);
  }

  /* ---------- 6.1 compound time ---------- */
  t.openUnit('6.1'); await wait(40);
  chords = 0; $('.l6r-two [data-i="1"]').click();
  t.check($$('.l6r-two .ntn').length === 2 && chords === 2, '6.1 Hear: 3/4 and 6/8 side by side; the 6/8 groove has one chord a bar');
  t.next(); await wait(40);
  let p = stepP('6.1', 2);
  t.check(/Rhythm in 6\/8/.test($('.nt-box svg').getAttribute('aria-label')) && $$('.nt-beats span').length === 2, '6.1 Echo: a 6/8 rhythm with two beat lights');
  t.check(await clapRounds(p, 3) === 3 && nextOn(), '6.1 Echo: three 6/8 rhythms clapped back');
  t.next(); await wait(40);
  for (let k = 0; k < 4; k++) {
    chords = 0; await wait(380);
    const want = chords >= 4 ? '3/4' : '6/8';
    $$('.choice').find(b => b.textContent === want).click();
    await wait(1150);
  }
  t.check(nextOn() && /4 of 4/.test(fbText()), `6.1 Explore: 3/4 or 6/8 by ear, 4 of 4 (${fbText().slice(0, 40)})`);
  t.next(); await wait(40);
  t.check($$('.art .ntn').length === 3 && /9\/8/.test($('.art').textContent), '6.1 Name: 6/8, 9/8 and 12/8 engraved');
  tones = []; $('[data-act="play"]').click();
  t.check(tones.length > 10, '6.1 Name: plays a tune in 6/8 over its groove');
  t.next(); await wait(40);
  p = stepP('6.1', 5);
  t.check(await clapRounds(p, 2) === 2 && nextOn(), '6.1 Echo: two 12/8 rhythms clapped back');
  t.next(); await wait(40);
  /* workshop: tap a 6/8 groove: q e q e | q. e e e */
  {
    const spb = 0.5, start = now() + 0.15 + 3 * spb;
    $('[data-c="rec"]').click();
    for (const b of [0, 1, 1.5, 2.5, 3, 4.5, 5, 5.5]) { await until(start + b * spb + 0.01); t.key(' '); }
    await until(start + 6 * spb + 0.2);
    t.check(/Rhythm in 6\/8, 2 bars: quarter note, eighth note, quarter note, eighth note, dotted quarter note, eighth note, eighth note, eighth note/.test($('.nt-edit svg').getAttribute('aria-label')), '6.1 workshop: the tapped groove is written out in 6/8');
    t.check(!$('[data-act="save"]').disabled && /✓ The threes can be heard/.test($('.nt-checks').textContent), '6.1 workshop: the brief is met');
    $('input[type="text"]').value = 'Rolling six';
    $('[data-act="save"]').click();
    const sk = M.Store.data.sketches[0];
    t.check(nextOn() && sk.name === 'Rolling six' && sk.score.meter === '6/8' && sk.tags.indexOf('compound time') >= 0 && sk.notes.length === 8 && sk.level === 6, '6.1 workshop: saved with its score and tags');
  }
  t.next(); await wait(40);
  t.check(!!d.querySelector('.done-card'), '6.1 finishes');

  /* ---------- 6.2 triplets, swing and shuffle ---------- */
  t.openUnit('6.2'); await wait(40);
  tones = []; woods = []; $('[data-act="play"]').click();
  t.check(woods.length === 14 && /triplet eighth note/.test($('.art svg').getAttribute('aria-label')), '6.2 Hear: two notes a beat, then three');
  t.next(); await wait(40);
  p = stepP('6.2', 2);
  t.check(await clapRounds(p, 3) === 3 && nextOn(), '6.2 Echo: three rhythms with triplets clapped back');
  t.next(); await wait(40);
  const sw = $('.l6r-swing input');
  sw.value = '67'; sw.dispatchEvent(new w.Event('input', { bubbles: true }));
  tones = []; sw.dispatchEvent(new w.Event('change', { bubbles: true }));
  const ratio = (tones[1].when - tones[0].when) / (tones[2].when - tones[0].when);
  t.check(/Triplet swing · 67:33/.test($('.l6r-swing').textContent) && Math.abs(ratio - 0.67) < 0.01, '6.2 Explore: the swing slider plays the written eighths long–short');
  t.next(); await wait(40);
  for (let k = 0; k < 5; k++) {
    tones = []; await wait(380);
    const r = (tones[1].when - tones[0].when) / (tones[2].when - tones[0].when);
    $$('.choice').find(b => b.textContent === (r > 0.58 ? 'Swung' : 'Straight')).click();
    await wait(1150);
  }
  t.check(nextOn() && /5 of 5/.test(fbText()), '6.2 Explore: straight or swung, 5 of 5 by ear');
  t.next(); await wait(40);
  t.check($$('.art .ntn').length === 3, '6.2 Name: triplet, written swing and how it sounds');
  t.next(); await wait(40);
  t.check(/Walking home/.test($('.prompt').textContent) && $('.nt-edit svg') && /G4 quarter, A4 quarter, B4 quarter, F♯4 quarter/.test($('.nt-edit svg').getAttribute('aria-label')) && $('.nt-edit').querySelectorAll('.nt-acc').length === 1, '6.2 workshop: the Level 5 melody, written in G with its key signature');
  $$('.choice')[2].click(); await wait(20);
  t.check($('[data-act="save"]').disabled, '6.2 workshop: one feel heard is not enough');
  $$('.choice')[0].click(); await wait(20); $$('.choice')[2].click(); await wait(20);
  $('[data-act="save"]').click();
  {
    const sk = M.Store.data.sketches[0];
    t.check(nextOn() && sk.from === 'sL5' && sk.score.swing === 0.67 && sk.tags.indexOf('swing') >= 0 && sk.notes.length === 5, '6.2 workshop: saves the swung version, grown from the Level 5 sketch');
  }
  t.next(); await wait(40);

  /* ---------- 6.3 syncopation, pickups and cut time ---------- */
  t.openUnit('6.3'); await wait(40);
  t.check($$('.art .ntn').length === 2 && $$('.art .nt-tie').length >= 2, '6.3 Hear: square and pushed, with ties across the beat');
  t.next(); await wait(40);
  p = stepP('6.3', 2);
  t.check(await clapRounds(p, 3) === 3 && nextOn(), '6.3 Echo: three syncopated rhythms clapped back (no claps on ties)');
  t.next(); await wait(40);
  p = stepP('6.3', 3);
  for (let k = 0; k < 3; k++) {
    const spb = 60 / p.bpm;
    t.check(!$('.nt-target svg'), `6.3 dictation (tap) round ${k + 1}: the rhythm is hidden`);
    woods = []; $('[data-act="hear"]').click();
    const pos = woods.map(x => (x - woods[0]) / spb);
    await wait(300);
    const start = now() + 0.15 + 4 * spb;
    $('[data-act="go"]').click();
    for (const b of pos) { await until(start + b * spb + 0.012); t.key(' '); }
    await until(start + 4 * spb + 0.75);
    t.check($('.nt-target svg') && $('.nt-mine svg') && /Exactly right/.test(fbText()), `6.3 dictation (tap) round ${k + 1}: taps written out under the answer and matching`);
    if (k < 2) { $('[data-act="more"]').click(); await wait(30); }
  }
  t.check(nextOn() && $$('.progress-dots span.on').length === 3, '6.3 dictation (tap): three of three');
  t.next(); await wait(40);
  t.check($('.art svg[aria-label*="quarter note"]') && $$('.art .ntn').length === 4 && /2\/2/.test($$('.art .ntn')[3].getAttribute('aria-label')), '6.3 Name: tie, push, pickup and cut time engraved');
  t.next(); await wait(40);
  p = stepP('6.3', 5);
  for (let k = 0; k < 3; k++) {
    woods = []; await wait(380);
    const spb = 60 / p.bpm, pos = woods.map(x => (x - woods[0]) / spb);
    const opt = $$('.choice').find(b => sameOnsets(rhythmOf(b.querySelector('svg')).onsets, pos));
    if (!opt) { t.check(false, '6.3 dictation (choose): the played rhythm is among the options'); break; }
    opt.click(); await wait(1150);
  }
  t.check(nextOn() && /3 of 3/.test(fbText()), '6.3 dictation (choose): 3 of 3');
  t.next(); await wait(40);
  /* workshop: three pushes with [ */
  const pickNote = i => { const b = $('.nt-edit'); t.click(b.querySelector(`[data-i="${i}"] .nt-hit`)); };
  const edKey = k => $('.nt-edit').dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true }));
  t.check($('[data-act="save"]').disabled && /0 of 3 syncopations/.test($('.nt-checks').textContent), '6.3 workshop: the square tune has no syncopations yet');
  pickNote(0); edKey('[');
  t.check(/1 of 3/.test($('.nt-checks').textContent), '6.3 workshop: [ on the first note makes the next one arrive early');
  pickNote(3); edKey('['); pickNote(6); edKey('[');
  t.check(!$('[data-act="save"]').disabled && /Three syncopations/.test($('.nt-checks').textContent), '6.3 workshop: three syncopations meet the brief');
  $('input[type="text"]').value = 'Leaning tune';
  $('[data-act="save"]').click();
  t.check(nextOn() && M.Store.data.sketches[0].tags[0] === 'syncopation' && Math.abs(S.length(M.Store.data.sketches[0].score.events) - 16) < 1e-6, '6.3 workshop: saved, still four full bars');
  t.next(); await wait(40);

  /* ---------- 6.4 odd meters ---------- */
  t.openUnit('6.4'); await wait(40);
  t.check(/Rhythm|Melody/.test($('.art svg').getAttribute('aria-label')) && /in 5\/4/.test($('.art svg').getAttribute('aria-label')), '6.4 Hear: a riff in 5/4');
  t.next(); await wait(40);
  p = stepP('6.4', 2);
  t.check(await clapRounds(p, 3) === 3 && nextOn(), '6.4 Echo: three 5/4 rhythms clapped back');
  t.next(); await wait(40);
  for (let k = 0; k < 4; k++) {
    tones = []; await wait(380);
    const bass = tones.filter(x => x.m === 48), bar = bass[1].when - bass[0].when;
    const want = bar < 1.9 ? '4 beats' : bar < 2.5 ? '5 beats' : '7 beats';
    $$('.choice').find(b => b.textContent === want).click();
    await wait(1150);
  }
  t.check(nextOn() && /4 of 4/.test(fbText()), '6.4 Explore: count the beats, 4 of 4');
  t.next(); await wait(40);
  t.check($$('.art .ntn').length === 3 && $$('.art .ntn')[2].querySelectorAll('.nt-ts').length === 8, '6.4 Name: 7/4, 7/8 and a changing meter (a new time signature at every change)');
  t.next(); await wait(40);
  p = stepP('6.4', 5);
  t.check(await clapRounds(p, 3) === 3 && nextOn(), '6.4 Echo: three 7/8 rhythms clapped back');
  t.next(); await wait(40);
  $$('.choice').find(b => /^5\/4/.test(b.textContent)).click(); await wait(30);
  {
    const spb = 60 / 132, start = now() + 0.15 + 5 * spb;
    $('[data-c="rec"]').click();
    for (const [b, k] of [[0, 'h'], [1, 'k'], [2, 's'], [3, 'd'], [4, 'g'], [5, 'h'], [8, 'd']]) { await until(start + b * spb + 0.01); t.key(k); }
    await until(start + 10 * spb + 0.2);
    t.check(!$('[data-act="save"]').disabled && /You can hear the groups/.test($('.nt-checks').textContent), '6.4 workshop: a 5/4 riff with notes on beats 1 and 4 meets the brief');
    $('[data-act="save"]').click();
    const sk = M.Store.data.sketches[0];
    t.check(nextOn() && sk.score.meter === '5/4' && sk.tags.indexOf('odd meter') >= 0 && sk.notes.length === 7, '6.4 workshop: the riff is saved in 5/4');
  }
  t.next(); await wait(40);
  t.check(!!d.querySelector('.done-card'), '6.4 finishes');

  /* ---------- review cards ---------- */
  const host = d.createElement('div'); d.body.appendChild(host);
  const all = ['6.1', '6.2', '6.3', '6.4'].reduce((a, id) => a.concat(M.CARD_DEFS[id]), []);
  let bad = [];
  for (const c of all) {
    if (c.type === 'gen') for (let k = 0; k < 6; k++) { const q = c.gen(); if (!(q.options.length >= 2 && q.answer >= 0 && q.answer < q.options.length && new Set(q.options).size === q.options.length)) bad.push(c.id); }
    let got = null;
    const clean = M.CARD_TYPES[c.type](host, c, ok => { got = ok; });
    if (!host.querySelector('.prompt') || (c.type === 'l6clap' && !host.querySelector('.ntn'))) bad.push(c.id + ' (render)');
    if (c.type !== 'l6clap') { const b = host.querySelector('.choice'); if (b) b.click(); if (got === null) bad.push(c.id + ' (fin)'); }
    if (typeof clean === 'function') clean();
    host.innerHTML = '';
    await wait(5);
  }
  t.check(!bad.length, `every review card renders and answers (${all.length} cards)${bad.length ? ': ' + bad.join(', ') : ''}`);
  /* one-try clap-back card in 7/8 */
  {
    const c = all.find(x => x.id === 'l6-clap-78');
    let got = null;
    const clean = M.CARD_TYPES.l6clap(host, c, ok => { got = ok; });
    const spb = 60 / c.bpm, start = now() + 0.15 + 3.5 * spb;
    host.querySelector('[data-act="go"]').click();
    const r = rhythmOf(host.querySelector('.nt-box svg'));
    for (const b of r.onsets) { await until(start + b * spb + 0.015); t.key(' '); }
    await until(start + r.len * spb + 0.75);
    t.check(got === true, 'l6clap card: a 7/8 rhythm clapped back in one try passes');
    clean(); host.innerHTML = '';
  }
  M.Sound.tone = tone0; M.Sound.chord = chord0; M.Sound.wood = wood0;
  t.finish();
})();
