/* Notation and rhythm engine (src/app/12-notation.js): the shorthand, meters, conventional re-writing, quantizing,
   playback timing, engraving structure, rhythm clap-back scoring, MelodyCapture recording and editing, Tasks.capture.
   Timed input uses the jsdom clock: Sound.now() is performance.now() / 1000. */
const H = require('./helpers');

(async () => {
  const t = await H.load({ unlock: 6 });
  const { w, d, wait } = t;
  const S = w.MotifNotation.Score, MC = w.MotifNotation.MelodyCapture, M = w.Motif;
  const near = (a, b, eps) => Math.abs(a - b) < (eps || 1e-6);
  /* events → 'C4:q. D4:e~' style text for comparisons: ~ marks a tie into the next, ³ a triplet note */
  const val = { 4: 'w', 3: 'h.', 2: 'h', 1.5: 'q.', 1: 'q', 0.75: 'e.', 0.5: 'e', 0.375: 's.', 0.25: 's', 0.125: 't' };
  const name = e => { const tq = e.tup ? e.d * 1.5 : e.d; const k = Object.keys(val).find(v => near(+v, tq)); return (e.p ? e.p + ':' : '') + (k ? val[k] : e.d.toFixed(3)) + (e.rest ? 'r' : '') + (e.tup ? '³' : ''); };
  const show = ev => ev.map((e, i) => (e.tie ? '_' : (i ? ' ' : '')) + name(e)).join('');
  const now = () => w.performance.now() / 1000;
  const until = async s => { const ms = (s - now()) * 1000; if (ms > 0) await wait(ms); };
  const host = d.createElement('div'); d.body.appendChild(host);

  /* ---------- the shorthand ---------- */
  const p1 = S.parse('q. e 3[e er e] C4:q_e F♯4:s Bb3:h.r');
  t.check(p1.length === 9 && near(p1[0].d, 1.5) && near(p1[1].d, 0.5) && near(p1[2].d, 1 / 3) && p1[2].tup === 3 && p1[3].rest && p1[3].tup === 3,
    'parse: dotted, triplet eighths and a triplet rest');
  t.check(p1[5].p === 'C4' && p1[6].p === 'C4' && p1[6].tie && !p1[5].tie && p1[7].p === 'F♯4' && near(p1[7].d, 0.25) && p1[8].rest && p1[8].p === null && near(p1[8].d, 3),
    'parse: a pitched tie carries the pitch; F♯ spelled; a pitched rest has no pitch');
  t.check(S.parse('3[q e] e e').every((e, i) => i > 1 || e.tup === 3) && near(S.length('3[q e] e e'), 2) && S.parse('q q').every(e => e.p === null && !e.tup),
    'parse: 3[q e] fills one beat; unpitched notes have p null');
  let threw = false; try { S.parse('q x q'); } catch (e) { threw = true; }
  t.check(threw, 'parse: an unknown token throws');

  /* ---------- meters ---------- */
  const m78 = S.meter('7/8'), m68 = S.meter('6/8'), m54 = S.meter('5/4'), m22 = S.meter('2/2'), m78b = S.meter('7/8:3+2+2'), m128 = S.meter('12/8');
  t.check(m78.groups.join() === '1,1,1.5' && near(m78.barLen, 3.5) && !m78.compound, "meter: '7/8' groups 2+2+3 by default");
  t.check(m78b.groups.join() === '1.5,1,1' && m68.groups.join() === '1.5,1.5' && m68.compound && m128.groups.length === 4 && near(m128.barLen, 6), "meter: '7/8:3+2+2', 6/8 and 12/8 in dotted-quarter beats");
  t.check(m54.groups.length === 5 && m54.accents.join() === '0,3' && S.meter('7/4').accents.join() === '0,4' && m22.groups.join() === '2,2' && S.meter('5/8').groups.join() === '1,1.5',
    'meter: 5/4 accents 3+2, 7/4 4+3, 2/2 in halves, 5/8 as 2+3');

  /* ---------- writing it conventionally ---------- */
  const N = (s, m) => show(S.normalize(s, m || '4/4'));
  t.check(N('h. h q') === 'h. q_q q', `normalize: a half note across the bar line becomes a tie (${N('h. h q')})`);
  t.check(N('q h q') === 'q q_q q', 'normalize: a half note on beat 2 of 4/4 shows beat 3');
  t.check(N('h h') === 'h h' && N('q q h') === 'q q h' && N('h. q') === 'h. q' && N('w') === 'w', 'normalize: halves on beats 1 and 3, a dotted half on 1, a whole bar stay single');
  t.check(N('e q e q q') === 'e e_e e q q', 'normalize: an off-beat quarter is tied across the beat');
  t.check(N('q q. e q') === 'q q_e e q' && N('q. e q q') === 'q. e q q', 'normalize: q. on beat 1 stays, q. on beat 2 hides the middle and is tied');
  t.check(N('h e e e e', '6/8') === 'q._e e e e e' && N('q e q e', '6/8') === 'q e q e' && N('h.', '6/8') === 'h.', 'normalize: 6/8 shows its two dotted-quarter beats');
  t.check(N('q h q', '2/2') === 'q q_q q' && N('e q e h', '2/2') === 'e q e h', 'normalize: 2/2 keeps its half-note beats visible');
  t.check(N('w q', '5/4') === 'h._q q' && N('h. h', '5/4') === 'h. h', 'normalize: 5/4 does not hide its 3+2 split');
  t.check(N('q q q q q q q', '7/8') === 'q q q e_e e_e e_e q', `normalize: 7/8 ties across the bar (${N('q q q q q q q', '7/8')})`);
  t.check(N('qr qr q q') === 'hr q q' && N('q qr qr q') === 'q qr qr q' && N('er er er er er er', '6/8') === 'h.r', 'normalize: rests merge into a half rest on beat 1, not on beat 2; a bar of rests is one');
  t.check(N('3[e_e e] q h') === 'q³ e³ q h' && N('3[e e e] q h') === 'e³ e³ e³ q h' && N('3[e_e_e] q h') === 'q q h', 'normalize: tied triplets merge; a triplet that is one sound becomes a plain quarter');
  t.check(N('C4:q D4:h_e E4:e') === 'C4:q D4:q_D4:q. E4:e', 'normalize: pitched ties keep their pitch');

  /* ---------- onsets, length, playback timing ---------- */
  t.check(S.onsets('q e_e qr q').join() === '0,1,3' && near(S.length('q e_e qr q'), 4), 'onsets skip rests and tied notes; length adds every event');
  const tn = S.toNotes('C4:q D4:e E4:e_q', { bpm: 120 });
  t.check(tn.length === 3 && tn[0].m === 60 && near(tn[1].t, 0.5) && near(tn[1].d, 0.25) && near(tn[2].t, 0.75) && near(tn[2].d, 0.75), 'toNotes: seconds at 120 BPM, ties held');
  const sw = S.toNotes('e e e e', { bpm: 60, swing: 0.67 }), sw68 = S.toNotes('e e e e e e', { bpm: 60, swing: 0.67, meter: '6/8' });
  t.check(sw[0].m === 72 && near(sw[1].t, 0.67, 1e-3) && near(sw[0].d, 0.67, 1e-3) && near(sw[1].d, 0.33, 1e-3) && near(sw[2].t, 1) && near(sw68[1].t, 0.5),
    'toNotes: swing moves the off-beat eighth to 0.67 of the beat; unpitched sounds as 72; compound time stays straight');

  /* ---------- quantizing ---------- */
  const jit = [0.025, -0.025, 0.018, -0.02, 0.022, -0.012, 0.01, -0.025, 0.025, -0.018, 0.015, -0.022];
  function hitsFor(src, bpm, start, j, swing) {
    const out = []; let at = 0, k = 0;
    S.parse(src).forEach(e => { if (!e.rest && !e.tie) out.push({ t: start + at * 60 / bpm + (j ? j[k++ % j.length] : 0) }); at += e.d; });
    return out;
  }
  for (const [src, meter] of [['q e e e e | q. q e', '6/8'], ['e e e q. | e e e e e e', '6/8'], ['q. q e | e e e q.', '6/8']]) {
    for (let flip = 1; flip >= -1; flip -= 2) {
      const got = S.quantize(hitsFor(src, 90, 5, jit.map(v => v * flip)), { bpm: 90, meter, start: 5, bars: 2 });
      t.check(show(got) === N(src, meter), `quantize: 6/8 at 90 BPM with ±25 ms jitter → ${N(src, meter)} (got ${show(got)})`);
    }
  }
  const qt = S.quantize(hitsFor('q 3[e e e] e e q', 90, 2, jit), { bpm: 90, meter: '4/4', start: 2, bars: 1 });
  t.check(show(qt) === 'q e³ e³ e³ e e q', `quantize: a triplet beat in 4/4 is found (${show(qt)})`);
  const q16 = S.quantize(hitsFor('s s s s e. s e e q', 80, 1, jit.map(v => v * 0.5)), { bpm: 80, meter: '4/4', start: 1, bars: 1 });
  t.check(show(q16) === 's s s s e. s e e q', `quantize: sixteenths and a dotted eighth stay binary (${show(q16)})`);
  const qx = S.quantize(hitsFor('q q q q', 100, 0, null).map((h, i) => Object.assign(h, { midi: [60, 61, 70, 72][i] })).concat([]), { bpm: 100, meter: '4/4', start: 0, bars: 1, keySig: -2 });
  t.check(show(qx) === 'C4:q D♭4:q B♭4:q C5:q' && show(S.quantize([{ t: 0, midi: 70 }], { bpm: 100, bars: 1, keySig: 2 })) === 'A♯4:w', 'quantize: pitches spelled for the key signature (flats in B♭, sharps in D)');
  const rel = S.quantize([{ t: 0, midi: 60, off: 0.55 }, { t: 2.0, midi: 62, off: 2.4 }, { t: 2.5, midi: 64 }], { bpm: 60, meter: '4/4', start: 0, bars: 1 });
  t.check(show(rel) === 'C4:e er qr D4:e E4:e_E4:q', `quantize: a known release before a long gap leaves a rest (${show(rel)})`);
  t.check(show(S.quantize([{ t: 0 }, { t: 0.5 }, { t: 0.98 }], { bpm: 60, meter: '3/4', start: 0, bars: 1 })) === 'e e h', 'quantize: without releases a note lasts until the next onset or the bar end');
  t.check(show(S.quantize([{ t: 1.97 }, { t: 3.02 }], { bpm: 60, meter: '4/4', start: 2, bars: 1 })) === 'q q_h', 'quantize: a slightly early first hit lands on beat 1 (and a dotted half on beat 2 is written q_h)');
  const fn = S.fromNotes([{ m: 67, t: 0, d: 0.45 }, { m: 69, t: 0.5, d: 0.45 }, { m: 71, t: 1, d: 0.9 }, { m: 67, t: 2, d: 1.9 }], { bpm: 120, meter: '4/4' });
  t.check(show(fn) === 'G4:q A4:q B4:h G4:w', `fromNotes: sketch notes in seconds → events (${show(fn)})`);

  /* ---------- engraving ---------- */
  const count = (svg, re) => (svg.match(re) || []).length;
  let g = S.svg('q e e s s s s 3[e e e] | e. s q h', { meter: '4/4', clef: 'perc', counts: true, syllables: true });
  t.check(count(g, /class="nt-hd"/g) === 14 && count(g, /class="nt-beam" data-level="1"/g) === 4 && count(g, /class="nt-beam" data-level="2"/g) === 2 && count(g, /class="nt-tup"/g) === 1,
    `svg: 14 heads, 4 primary beams, 2 secondary (one a stub), one triplet 3 (${count(g, /class="nt-hd"/g)} / ${count(g, /data-level="1"/g)} / ${count(g, /data-level="2"/g)})`);
  t.check(/>la</.test(g) && />li</.test(g) && />&amp;<|>&</.test(g) && />ti</.test(g) && />ka</.test(g) && />tri</.test(g), 'svg: counts and syllables (& e a, la li, ti ka, tri-o-la)');
  g = S.svg('e e e e e e', { meter: '6/8', clef: 'perc' });
  const g34 = S.svg('e e e e e e', { meter: '3/4', clef: 'perc' });
  t.check(count(g, /data-level="1"/g) === 2 && count(g34, /data-level="1"/g) === 3, '6/8 beams eighths in threes, 3/4 in twos');
  t.check(count(S.svg('e e e e e e e', { meter: '7/8', clef: 'perc' }), /data-level="1"/g) === 3 && count(S.svg('e e e e e e e e', { meter: '4/4' }), /data-level="1"/g) === 2, '7/8 beams 2+2+3; 4/4 eighths beam by the half bar');
  g = S.svg(S.normalize('C4:h. D4:h E4:q', '4/4'), { meter: '4/4' });
  t.check(count(g, /class="nt-tie"/g) === 1 && count(g, /class="nt-bar"/g) === 2 && count(g, /nt-bar-end/g) === 1, 'svg: a tie across the bar line, a bar line and a final double bar');
  g = S.svg('F♯4:q F♯4:q F4:q F♯4:q | F♯4:q B♭4:q B4:q C4:q', { meter: '4/4' });
  const accOf = svg => (svg.match(/class="nt-acc"[^>]*>[^<]*</g) || []).map(x => x.replace(/.*>/, '').replace('<', ''));
  const accs = accOf(g);
  t.check(accs.join(' ') === '♯ ♮ ♯ ♯ ♭ ♮', `svg: accidentals per bar: F♯ once, F♮, F♯ again, renewed in bar 2 (${accs.join(' ')})`);
  g = S.svg('F♯4:q F♯4:q F4:q G4:q', { meter: '4/4', keySig: 1 });
  t.check(accOf(g).join(' ') === '♯ ♮', 'svg: with one sharp in the key, F♯ needs nothing and F needs a natural (the first ♯ is the key signature)');
  g = S.svg('C4:w | A5:h C6:h', { meter: '4/4' });
  t.check(count(g, /class="nt-ledger"/g) === 1 + 1 + 2, 'svg: ledger lines below and above the staff');
  g = S.svg('qr er sr tr tr hr | wr | q.r e e. s q', { meter: '4/4', clef: 'perc' });
  t.check(count(g, /class="nt-rest"/g) >= 6 && count(g, /class="nt-dot"/g) === 2, 'svg: rests of every value, dotted ones with their dot');
  g = S.svg('3[q q q] h', { meter: '4/4', clef: 'perc' });
  t.check(count(g, /class="nt-brk"/g) === 1 && count(g, /class="nt-tup"/g) === 1, 'svg: unbeamed triplets get a bracket');
  g = S.svg('C4:q D4:q E4:h', { editable: true, selected: 1, marks: ['ok', 'no'] });
  t.check(count(g, /data-i="/g) === 3 && /nt-ev no sel/.test(g) && count(g, /class="nt-hit"/g) === 3 && count(g, /nt-mk/g) === 2, 'svg: editable events, selection and marks');
  g = S.svg('q q q q q | q q q q q q q', { meter: ['5/4', '7/4'], clef: 'perc' });
  t.check(count(g, /class="nt-ts"/g) === 4, 'svg: a meter change shows the new time signature');
  const wide = S.svg(Array(8).fill('e e e e e e e e').join(' | '), { meter: '4/4', clef: 'perc', counts: true });
  const ww = +/width="(\d+)"/.exec(wide)[1];
  t.check(ww > 64 * 22 && ww < 64 * 40, `svg: 8 bars of 4/4 eighths get readable room (${ww} px)`);

  /* ---------- play: start, onsets, stop ---------- */
  const t0 = now();
  const pl = S.play('q e e 3[e e e] q', { meter: '4/4', bpm: 120, countIn: 1, swing: 0.6 });
  t.check(near(pl.start - t0, 0.15 + 2, 0.03) && pl.onsets.length === 7 && near(pl.onsets[2] - pl.start, 0.5 + 0.6 * 0.5, 1e-3) && near(pl.onsets[3] - pl.start, 1, 1e-3) && near(pl.end - pl.start, 2, 1e-3),
    'play: count-in of one bar, swung eighths, triplets untouched');
  t.check(pl.beats.filter(b => b.k < 0).length === 4, 'play: the count-in follows the meter (four beats in 4/4)');
  pl.stop();
  const pl68 = S.play('q.', { meter: '6/8', bpm: 90, countIn: 1 }), pl78 = S.play('q q q.', { meter: '7/8', bpm: 90, countIn: 1 });
  t.check(pl68.beats.filter(b => b.k < 0).length === 2 && pl78.beats.filter(b => b.k < 0).length === 3, 'play: 6/8 counts in two dotted-quarter beats, 7/8 counts 2+2+3');
  pl68.stop(); pl78.stop();

  /* ---------- rhythmTap: clap-back scored with timed Space presses ---------- */
  let res = null;
  const doneFn = (ok, r) => { res = Object.assign({ ok }, r); };
  async function clapBack(pattern, meter, bpm, offsets, extra) {
    res = null;
    const spb = 60 / bpm, M = S.meter(meter), start = now() + 0.15 + M.barLen * spb;
    host.querySelector('[data-act="go"]').click();
    const times = S.onsets(pattern).map((b, k) => offsets[k] == null ? null : start + b * spb + offsets[k]).filter(x => x != null);
    if (extra != null) times.push(start + extra * spb);
    for (const at of times.sort((a, b) => a - b)) { await until(at); t.key(' '); }
    await until(start + S.length(pattern) * spb + 0.75);
  }
  let clean = M.Tasks.rhythmTap(host, { patterns: ['q q e e q'], meter: '4/4', bpm: 100, rounds: 1 }, doneFn);
  t.check(host.querySelectorAll('.nt-beats span').length === 4 && /class="ntn"/.test(host.innerHTML), 'rhythmTap: shows the rhythm and four beat lights');
  await clapBack('q q e e q', '4/4', 100, [0.03, -0.04, 0.02, -0.03, 0.04]);
  t.check(res && res.ok && res.score === 1 && /Every note landed/.test(host.querySelector('.fb').textContent), 'rhythmTap: claps within ±40 ms at 100 BPM all land');
  clean();
  clean = M.Tasks.rhythmTap(host, { patterns: ['q. e q q'], meter: '4/4', bpm: 90, rounds: 1 }, doneFn);
  await clapBack('q. e q q', '4/4', 90, [0, 0.16, 0, 0]);
  t.check(!res && /3 of 4 notes landed/.test(host.querySelector('.fb').textContent) && host.querySelectorAll('.nt-mk.no').length === 1, 'rhythmTap: a clap 160 ms late misses, marked red');
  await clapBack('q. e q q', '4/4', 90, [0, 0, 0, 0], 1);
  t.check(res && res.ok && res.score === 0, 'rhythmTap: one stray clap is forgiven, as in Levels 1 and 2 (score counts first tries only)');
  clean();
  clean = M.Tasks.rhythmTap(host, { patterns: ['e q e q q'], meter: '4/4', bpm: 90, once: true }, doneFn);
  await clapBack('e q e q q', '4/4', 90, [0, 0, 0, 0, 0], 1);
  t.check(res && res.ok === false && /tie makes one sound/.test(host.querySelector('.fb').textContent), 'rhythmTap: a clap on a tied note fails with a tip (once: one try)');
  clean();
  clean = M.Tasks.rhythmTap(host, { patterns: ['q e q e', 'q. q.'], meter: '6/8', bpm: 120, rounds: 2, pass: 2 }, doneFn);
  await clapBack('q e q e', '6/8', 120, [0.02, -0.03, 0.03, 0]);
  t.check(host.querySelectorAll('.progress-dots .on').length === 1, 'rhythmTap: 6/8 round one lands (test mode)');
  await wait(1900);
  await clapBack('q. q.', '6/8', 120, [0, 0]);
  t.check(res && res.ok && res.score === 2, 'rhythmTap: two of two in 6/8 passes');
  clean();
  clean = M.Tasks.rhythmTap(host, { patterns: ['e e e e'], meter: '4/4', bpm: 60, swing: 0.67, once: true }, doneFn);
  res = null;
  { const st = now() + 0.15 + 4; host.querySelector('[data-act="go"]').click(); for (const b of [0, 0.67, 1, 1.67]) { await until(st + b); t.key(' '); } await until(st + 2.8); }
  t.check(res && res.ok, 'rhythmTap: swung eighths are clapped long-short');
  clean();

  /* ---------- MelodyCapture: record from the computer keys, then edit ---------- */
  let changes = 0;
  const cap = MC.mount(host, { meter: '4/4', bpm: 120, bars: 1, countIn: 1, onChange: () => changes++ });
  t.check(show(cap.events) === 'wr' && host.querySelector('.nt-edit svg'), 'MelodyCapture: starts with an empty bar');
  const rs = now() + 0.15 + 2;
  host.querySelector('[data-c="rec"]').click();
  for (const [b, k] of [[0, 'a'], [0.5, 's'], [1, 'd'], [2, 'f']]) { await until(rs + b * 0.5 + 0.012); t.key(k); }
  await until(rs + 2.2);
  t.check(show(cap.events) === 'C4:e D4:e E4:q F4:h' && changes === 1, `MelodyCapture: keys at set times → C4:e D4:e E4:q F4:h (${show(cap.events)})`);
  t.check(cap.notes.length === 4 && near(cap.notes[1].t, 0.25) && near(cap.notes[3].d, 1), 'MelodyCapture: notes in seconds for playback and sketches');
  const box = host.querySelector('.nt-edit');
  const press = (key, shift) => box.dispatchEvent(new w.KeyboardEvent('keydown', { key, shiftKey: !!shift, bubbles: true }));
  const pick = i => { const b = host.querySelector('.nt-edit'); t.click(b.querySelector(`[data-i="${i}"] .nt-hit`) || b.querySelector(`[data-i="${i}"]`)); };
  pick(0);
  t.check(/Bar 1, beat 1: C4, eighth/.test(host.querySelector('.nt-info').textContent) && box.querySelector('.nt-ev.sel'), 'editor: click selects a note and names it');
  press('ArrowUp'); t.check(show(cap.events) === 'C♯4:e D4:e E4:q F4:h', '↑ raises a half step');
  press('ArrowUp', true); t.check(show(cap.events) === 'C♯5:e D4:e E4:q F4:h', 'Shift+↑ raises an octave');
  press(']'); t.check(show(cap.events) === 'C♯5:q E4:q F4:h' && near(S.length(cap.events), 4), '] doubles; the next note gives way and the bar stays full');
  press('['); t.check(show(cap.events) === 'C♯5:e E4:e_E4:q F4:h' && near(S.length(cap.events), 4), '[ halves; the next note stretches back to fill the bar');
  press('.'); t.check(show(cap.events) === 'C♯5:e. E4:s_E4:q F4:h', '. dots the note');
  press('ArrowRight'); press('ArrowRight'); press('Delete');
  t.check(show(cap.events) === 'C♯5:e. E4:s_E4:q hr', '→ moves on; Delete turns the note into a rest');
  press('z'); press('z');
  t.check(show(cap.events) === 'C♯5:e E4:e_E4:q F4:h', 'Z undoes, one step at a time');
  const oct = t.w.document.querySelector('.readout .heard').textContent;
  pick(0); t.key('g'); await wait(20);
  t.check(show(cap.events).startsWith('G4:e E4:e') && /E4/.test(host.querySelector('.nt-info').textContent), `editor: playing a key gives the selected note its pitch and moves on (${show(cap.events)})`);
  cap.destroy();

  /* pcs: a note outside the scale is refused while recording */
  const cap2 = MC.mount(host, { meter: '3/4', bpm: 120, bars: 1, countIn: 1, pcs: [0, 2, 4, 5, 7, 9, 11], pcsLabel: 'C major' });
  const rs2 = now() + 0.15 + 1.5;
  cap2.record();
  await until(rs2 + 0.01); t.key('a'); await until(rs2 + 0.51); t.key('w'); await wait(5);
  t.check(/C♯4 is not in C major/.test(host.querySelector('.fb').textContent), 'MelodyCapture: notes outside pcs are refused with a message');
  await until(rs2 + 1.01); t.key('d');
  await until(rs2 + 1.7);
  t.check(show(cap2.events) === 'C4:h E4:q', `MelodyCapture: 3/4 recording stops by itself after the bars (${show(cap2.events)})`);
  cap2.destroy();

  /* perc: taps and Space make an unpitched groove */
  const cap3 = MC.mount(host, { meter: '6/8', bpm: 120, bars: 1, countIn: 1, clef: 'perc' });
  const rs3 = now() + 0.15 + 1.5;
  cap3.record();
  for (const b of [0, 1, 1.5, 2.5]) { await until(rs3 + b * 0.5 + 0.01); t.key(' '); }
  await until(rs3 + 1.7);
  t.check(show(cap3.events) === 'q e q e', `MelodyCapture perc: tapped 6/8 groove → q e q e (${show(cap3.events)})`);
  cap3.destroy();

  /* ---------- Tasks.capture saves a sketch with its score ---------- */
  res = null;
  const before = M.Store.data.sketches.length;
  clean = M.Tasks.capture(host, { prompt: 'Write it.', meter: '4/4', bpm: 96, bars: 1, min: 3, initial: S.parse('C4:q D4:q E4:q qr'), check: ev => ev.filter(e => !e.rest).slice(-1)[0].p === 'C4' ? null : 'End on C.', save: { level: 6, tags: ['test'], extra: { version: 2 } } }, doneFn);
  t.check(host.querySelector('[data-act="save"]').disabled && /End on C/.test(host.querySelector('.nt-checks').textContent), 'capture: the brief check holds Save back');
  pick(2); t.key('a'); await wait(20);
  t.check(!host.querySelector('[data-act="save"]').disabled, 'capture: fixing the last note to C enables Save');
  host.querySelector('input[type="text"]').value = 'Test tune';
  host.querySelector('[data-act="save"]').click();
  const sk = M.Store.data.sketches[0];
  t.check(res && res.ok && M.Store.data.sketches.length === before + 1 && sk.name === 'Test tune' && sk.score && sk.score.meter === '4/4' && sk.score.bpm === 96 && sk.score.events.length === 4 && sk.notes.length === 3 && sk.tags[0] === 'test' && sk.version === 2 && sk.level === 6,
    'capture: saves name, notes, score { meter, bpm, keySig, events }, tags and extra fields');
  clean();

  /* ---------- dictation and meter feel ---------- */
  res = null;
  clean = M.Tasks.rhythmDictation(host, { patterns: ['q e e q q'], meter: '4/4', bpm: 100, rounds: 1, mode: 'choose' }, doneFn);
  const opts = [...host.querySelectorAll('.choice')];
  t.check(opts.length >= 3 && opts.every(o => o.querySelector('svg.ntn')), 'dictation (choose): three or four notations to pick from');
  const right = opts.find(o => /quarter note, eighth note, eighth note, quarter note, quarter note/.test(o.querySelector('svg').getAttribute('aria-label')));
  right.click(); await wait(1200);
  t.check(res && res.score === 1, 'dictation (choose): the right notation scores');
  clean();
  res = null;
  clean = M.Tasks.rhythmDictation(host, { patterns: ['q e e h'], meter: '4/4', bpm: 120, rounds: 1, mode: 'tap' }, doneFn);
  t.check(!host.querySelector('.nt-target svg'), 'dictation (tap): the rhythm is hidden before you tap');
  { const st = now() + 0.15 + 2; host.querySelector('[data-act="go"]').click(); for (const b of [0, 1, 1.5, 2]) { await until(st + b * 0.5 + 0.02); t.key(' '); } await until(st + 2.7); }
  t.check(res && res.score === 1 && host.querySelector('.nt-mine svg') && host.querySelectorAll('.nt-target .nt-mk.ok').length === 4, 'dictation (tap): taps are quantized, engraved under the answer and match');
  clean();
  res = null;
  clean = M.Tasks.meterFeel(host, { rounds: 2, choices: ['simple duple', 'simple triple', 'compound duple'], items: [{ meter: '6/8' }] }, doneFn);
  for (let k = 0; k < 2; k++) { [...host.querySelectorAll('.choice')].find(b => b.textContent === 'compound duple').click(); await wait(1150); }
  t.check(res && res.score === 2, 'meterFeel: 6/8 is compound duple');
  clean();
  clean = M.Tasks.meterFeel(host, { rounds: 1, choices: ['3/4', '6/8'], items: [{ meter: '3/4' }] }, doneFn);
  res = null; [...host.querySelectorAll('.choice')].find(b => b.textContent === '3/4').click(); await wait(1150);
  t.check(res && res.score === 1, 'meterFeel: choices can be meters');
  clean();
  t.finish();
})();
