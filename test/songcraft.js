/* Song craft (jsdom): Listening Maps, the chord sheet (palette, split, key change, chords played in, melody fit,
   checks) and Tasks.songDraft (chords and a recorded melody, saved; a linked version 2). */
const H = require('./helpers');
(async () => {
  const t = await H.load({ unlock: 7 });
  const { w, d, wait } = t, M = w.Motif;
  const host = d.createElement('div'); d.querySelector('#view').appendChild(host);
  const $ = s => host.querySelector(s), $$ = s => [...host.querySelectorAll(s)];
  const now = () => w.performance.now() / 1000;
  const until = async x => { const ms = (x - now()) * 1000; if (ms > 0) await wait(ms); };

  /* ---------- Listening Map ---------- */
  let modelPlayed = 0;
  M.addListeningMap({ id: 'lm-test', level: 6, unit: '6.1', topic: 'Compound time', song: 'A Test Song', artist: 'Nobody',
    intro: 'Listen for the beat.', model: () => { modelPlayed++; }, listenFor: [
      { q: 'Two beats or three?', options: ['Two', 'Three'], answer: 0, why: 'Two big beats.' },
      { q: 'Does it swing?', options: ['Yes', 'No'], answer: 1, why: 'Straight.' }] });
  M.Store.data.units['6.1'] = { done: true };
  t.check(M.listeningOpen().some(m => m.id === 'lm-test') && M.listeningOpen().some(m => m.id === M.listeningThisWeek().id), 'a map opens once its unit is done; this week’s map is one of the open ones');
  let res = null;
  let clean = M.Tasks.listeningMap(host, { id: 'lm-test' }, (ok, r) => { res = r; });
  t.check(/A Test Song/.test($('.lm-song').textContent) && /never plays/.test(host.textContent), 'the map names the song and says Motif never plays it');
  $('[data-act="model"]').click();
  t.check(modelPlayed === 1, 'the model button plays Motif’s own example');
  $('.lm-q[data-q="0"] [data-k="0"]').click();
  t.check(!res && $('.lm-q[data-q="0"] .right'), 'an answer is marked and explained');
  $('.lm-q[data-q="1"] [data-k="0"]').click();
  t.check(res && res.right === 1 && res.of === 2 && M.Store.data.listening['lm-test'].right === 1, 'the last answer finishes the map and logs it');
  clean();

  /* ---------- chord sheet ---------- */
  let changes = 0;
  const sheet = M.ChordSheet.mount(host, { key: 'C', meter: '4/4', bars: 4, palette: ['I', 'IV', 'V', 'V7/V', '♭VI'], keyChanges: true, onChange: () => changes++,
    melody: [{ m: 60, t: 0, d: 1 }, { m: 62, t: 1, d: 1 }, { m: 66, t: 4, d: 2 }, { m: 67, t: 8, d: 4 }] });
  const pal = r => $$('.cs-pal [data-r]').find(b => b.dataset.r === r);
  pal('I').click(); pal('V7/V').click(); pal('V').click();
  t.check(sheet.chords.map(c => c.roman + ':' + c.sym).join(' ') === 'I:C V7/V:D7 V:G' && changes === 3, `palette fills bars in order (${sheet.chords.map(c => c.sym).join(' ')})`);
  t.check(!sheet.full && $('.cs-slot.sel').dataset.b === '3', 'the next empty bar is selected');
  host.querySelector('[data-cs="split"]').click();
  pal('♭VI').click(); pal('I').click();
  t.check(sheet.full && sheet.chords.slice(-2).map(c => c.t + '+' + c.d).join(' ') === '12+2 14+2', 'a split bar holds two chords of two beats');
  const fit = sheet.fit();
  t.check(fit.map(x => x.kind).join(' ') === 'ct nct ct ct' && fit[0].strong && !fit[1].strong, `melody fit: chord tone, passing note, F♯ in D7, G in G (${fit.map(x => x.kind).join(' ')})`);
  t.check($$('.cs-mel .n.ct').length === 3, 'fit colours show under each bar');
  /* play a chord on the keys into bar 2 */
  t.click(host.querySelector('.cs-slot[data-b="1"]'));
  t.key('f'); await wait(20); t.key('h'); await wait(20); t.key('k'); await wait(40);
  t.check(sheet.chords[1].sym === 'F' && sheet.chords[1].roman === 'IV', `a chord played on the keys goes into the selected bar (${sheet.chords[1].sym})`);
  /* a key change from bar 3: numerals are renamed in the new key */
  t.click(host.querySelector('.cs-slot[data-b="2"]'));
  const ks = host.querySelector('[data-cs="key"]');
  const gi = [...ks.options].findIndex(o => o.textContent === 'G major');
  ks.selectedIndex = gi; ks.dispatchEvent(new w.Event('change'));
  t.check(sheet.keys.map(k => k.bar + ':' + k.key).join(' ') === '0:C 2:G' && sheet.chords[2].roman === 'I' && /→ G major/.test(host.querySelector('.cs-bar[data-b="2"]').textContent), 'a key change renames the numerals after it (G becomes I in G)');
  t.check(M.SheetHas.applied([{ roman: 'V7/V' }, { roman: 'V' }]) === 1 && M.SheetHas.borrowed([{ roman: '♭VI' }, { roman: 'vi' }, { roman: 'iv6' }, { roman: 'vii°' }]) === 2 && M.SheetHas.modulates(sheet.chords, sheet.keys) === 1, 'sheet questions: applied, borrowed, modulation');
  const sc = sheet.sketchChords(120);
  t.check(sc[0].t === 0 && sc[1].t === 2 && sc[0].d === 2, 'chords in seconds for a sketch');
  sheet.destroy();
  host.innerHTML = '';

  /* ---------- song draft with a recorded melody, then version 2 ---------- */
  const pr = M.projectOf('9.T'); pr.flavour = 'song';
  let out = null;
  clean = M.Tasks.songDraft(host, { project: '9.T', prompt: 'Write it.', key: 'C', bars: 2, bpm: 120, min: 4, palette: ['I', 'IV', 'V', 'V7/V'],
    check: c => M.SheetHas.applied(c.chords) ? null : 'Use one secondary dominant.', save: { level: 9, tags: ['test'] } }, (ok, r) => { out = r; });
  pal('I').click(); pal('V7/V').click();
  t.check(/○/.test($('.sd-checks').textContent) && $('[data-act="save"]').disabled, 'save waits for the melody');
  t.click(host.querySelector('.sd-mel'));
  const spb = 0.5, start = now() + 0.15 + 4 * spb;
  t.click(host.querySelector('[data-c="rec"]'));
  for (const [b, k] of [[0, 'a'], [1, 'd'], [2, 'g'], [3, 'd'], [4, 't'], [5, 'h'], [6, 'd']]) { await until(start + b * spb + 0.012); t.key(k); }
  await until(start + 8 * spb + 0.3);
  t.check(M.Store.data.sketches.length === 0 && /✓ A chord in every bar/.test($('.sd-checks').textContent) && !$('[data-act="save"]').disabled, `recorded melody fills the checks (${$('.sd-checks').textContent})`);
  t.check(host.querySelectorAll('.cs-mel .n').length === 7, 'the recorded notes show under the chords');
  host.querySelector('.sd input[type="text"]').value = 'Travel';
  $('[data-act="save"]').click();
  const sk = M.Store.data.sketches[0];
  t.check(out && sk.name === 'Travel' && sk.chords.length === 2 && sk.chords[1].sym === 'D7' && sk.sheet[1].roman === 'V7/V' && sk.notes.length === 7 && sk.score.meter === '4/4' && pr.draft === sk.id && sk.version === 1, 'the draft saves chords, numerals, melody and score, linked to the project');
  clean(); host.innerHTML = '';
  sk.review = { note: 'end on I', scores: {} };
  clean = M.Tasks.songDraft(host, { project: '9.T', version: 2, prompt: 'Version 2.', bars: 2, min: 4, save: { level: 9 } }, (ok, r) => { out = r; });
  t.check(/end on I/.test($('.prompt').textContent) && host.querySelector('.sd input[type="text"]').value === 'Travel v2' && $$('.cs-slot b').map(b => b.textContent).join(' ') === 'I V7/V', 'version 2 reloads the chords, the melody and the review note');
  t.click(host.querySelector('.cs-slot[data-b="1"]'));
  pal('V').click();
  /* the band: opens with the flavour's style, follows chord changes, and its style is saved */
  const band = $('.sd-band');
  band.open = true; band.dispatchEvent(new w.Event('toggle')); await wait(20);
  t.check(!!$('.sd-band-ui .bk') && $('.sd-band-ui [data-bk="style"]').value === 'pop', 'Play it with a band opens a pop band for a Song flavour project');
  $('[data-act="save"]').click();
  t.check(M.Store.data.sketches[0].version === 2 && pr.v2 === M.Store.data.sketches[0].id && M.Store.data.sketches[0].from === sk.id, 'version 2 saves linked to the draft');
  t.check(M.Store.data.sketches[0].backing && M.Store.data.sketches[0].backing.style === 'pop', 'the band’s style is saved with the sketch');
  clean();
  t.check(M.ChordIn.users === 0, 'chord input released');
  t.finish();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
