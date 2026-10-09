/* Toolbox tabs: listen (notes, chords, key guess), circle, scales, chords, progressions, hooks. */
const H = require('./helpers');
(async () => {
  const t = await H.load();
  t.click('.nav [data-view="toolbox"]'); await t.wait(30);
  t.check(t.$$('.tool-tabs button').length === 6, 'toolbox has six tabs');

  // Listen: notes then a chord, then a key guess
  t.click('[data-tab="listen"]'); await t.wait(20);
  t.pc('A'); await t.wait(20);
  t.check(/^A\d$/.test(t.$('[data-note]').textContent), 'listen: shows the note played');
  t.pc('C'); t.pc('E'); await t.wait(30);
  t.check(/^Am/.test(t.$('[data-chord]').textContent), 'listen: A C E named Am (' + t.$('[data-chord]').textContent + ')');
  await t.wait(1700);
  t.pc('F♯'); t.pc('D'); await t.wait(30);
  t.check(/G major/.test(t.$('[data-key]').textContent), 'listen: A C E F♯ D suggests G major — "' + t.$('[data-key]').textContent + '"');

  // Circle: tap D on the outer ring
  t.click('[data-tab="circle"]'); await t.wait(20);
  t.click('.circle5 [data-pos="2"][data-ring="major"]'); await t.wait(20);
  t.check(/D major/.test(t.$('.key-info h2').textContent) && /F♯ C♯/.test(t.$('.key-info').textContent), 'circle: D major shows its two sharps');
  t.check(t.$$('.chord-btn').length === 7, 'circle: seven chords listed for the key');
  t.click('.circle5 [data-pos="3"][data-ring="minor"]'); await t.wait(20);
  t.check(/F♯ minor/.test(t.$('.key-info h2').textContent), 'circle: inner ring picks the minor key');

  // Scales: E♭ harmonic minor, then play it
  t.click('[data-tab="scales"]'); await t.wait(20);
  const sr = t.$('#sc-root'), sty = t.$('#sc-type');
  sr.value = 'A'; sr.dispatchEvent(new t.w.Event('change')); sty.value = 'harmonic'; sty.dispatchEvent(new t.w.Event('change')); await t.wait(20);
  t.check(t.$$('.tool-out .notes-strip .n').map(n => n.textContent).join(' ') === 'A B C D E F G♯ A', 'scales: A harmonic minor spelled');
  t.click('.tool-out [data-act="try"]'); await t.wait(20);
  for (const n of ['A', 'B', 'C', 'D', 'E', 'F', 'G♯', 'A']) { t.pc(n); await t.wait(10); }
  t.check(/All the way up/.test(t.$('.try .fb').textContent), 'scales: play-it-yourself completes');

  // Chords: F♯m, second inversion
  t.click('[data-tab="chords"]'); await t.wait(20);
  const cr = t.$('#ch-root'), cq = t.$('#ch-q');
  cr.value = 'F♯'; cr.dispatchEvent(new t.w.Event('change')); cq.value = 'min'; cq.dispatchEvent(new t.w.Event('change')); await t.wait(20);
  t.click('[data-inv="2"]'); await t.wait(20);
  t.check(/F♯m\/C♯/.test(t.$('.tool-out h2').textContent), 'chords: second inversion of F♯m is F♯m/C♯');

  // Progressions: I–V–vi–IV in G, try it
  t.click('[data-tab="progressions"]'); await t.wait(20);
  const pk = t.$('#pr-key'); pk.value = 'G'; pk.dispatchEvent(new t.w.Event('change')); await t.wait(20);
  t.check(t.$$('.prog-chord b').map(b => b.textContent).join(' ') === 'G D Em C', 'progressions: four-chord loop in G');
  t.click('.tool-out [data-act="try"]'); await t.wait(20);
  for (const ch of [['G', 'B', 'D'], ['D', 'F♯', 'A'], ['E', 'G', 'B'], ['C', 'E', 'G']]) { ch.forEach(n => t.pc(n)); await t.wait(1000); }
  t.check(t.$$('.try .progress-dots span.on').length === 4, 'progressions: all four chords played');

  t.click('[data-tab="hooks"]'); await t.wait(20);
  t.check(t.$$('.hook-group').length >= 1 && t.$$('.hook').length >= 4, 'hooks: memory hooks listed');
  t.finish();
})();
