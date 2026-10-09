/* Level 6 (Groove & Line), units 6.5–6.9, the project, the boss, and the intermediate Daily Set.
   Units 6.1–6.4 have their own test (level6-rhythm.js). Quiz answers come from wrapping Tasks.choice;
   ear answers from the notes the app plays. */
const H = require('./helpers');
(async () => {
  const t = await H.load({ unlock: 6 });
  const M = t.w.Motif, T = M.Theory, wait = t.wait, $ = t.$;
  let lastItem = null;
  const choice = M.Tasks.choice;
  M.Tasks.choice = (el, item, done) => { lastItem = item; return choice(el, item, done); };
  const played = [];
  const tone = M.Sound.tone.bind(M.Sound);
  /* every tone with the moment it was scheduled: chords and sequences arrive in batches, a quiz target alone */
  M.Sound.tone = (m, when, d, v) => { played.push({ m, at: t.w.performance.now() }); return tone(m, when, d, v); };
  async function nextTarget(since) {
    for (let k = 0; k < 120; k++) {
      const solo = played.filter(x => x.at > since && played.filter(y => Math.abs(y.at - x.at) < 2).length === 1);
      if (solo.length) return solo[solo.length - 1].m;
      await wait(100);
    }
    throw new Error('no target note was played');
  }
  const nextOn = () => !t.nextBtn().disabled;
  const fbText = () => ($('.stage .fb:last-of-type') || $('.stage .fb') || {}).textContent || '';
  async function answerQuiz(rounds, wrong) {
    let right = 0;
    for (let r = 0; r < rounds; r++) {
      await wait(60);
      const k = wrong && r === 0 ? (lastItem.answer + 1) % lastItem.options.length : lastItem.answer;
      t.$$('.stage .quiz-q .choice').find(b => +b.dataset.i === k).click();
      if (k === lastItem.answer) right++;
      await wait(k === lastItem.answer ? 1200 : 2300);
    }
    return right;
  }
  const noteBaseline = M.Bus.h.note.size;
  const now = () => t.w.performance.now() / 1000;
  const until = async x => { const ms = (x - now()) * 1000; if (ms > 0) await wait(ms); };
  const checksText = () => $('.stage .nt-checks').textContent;
  const saveOn = () => !$('.stage [data-act="save"]').disabled;
  const nameIt = v => { $('.stage .nt-task .field input').value = v; };
  /* record keys one per beat over the click (count-in of one bar), then stop */
  async function recordKeys(bpm, keys) {
    const spb = 60 / bpm, start = now() + 0.15 + 4 * spb;
    t.click('.stage [data-c="rec"]');
    for (let i = 0; i < keys.length; i++) { await until(start + i * spb + 0.012); t.key(keys[i]); }
    await until(start + keys.length * spb + 0.1);
    t.click('.stage [data-c="stop"]'); await wait(30);
  }
  const pickNote = i => t.click($(`.stage .nt-edit [data-i="${i}"] .nt-hit`));
  const keyOf = () => /Key of (\S+) major/.exec($('.stage [data-key]').textContent)[1];

  // ---------- 6.5 ----------
  t.openUnit('6.5'); await wait(40);
  t.check(/Settled and restless/.test($('.stage h2').textContent), '6.5 opens on the Hear card');
  t.click('.stage .widget [data-pl="0"]'); await wait(30);
  t.check(M.Drone.on, '6.5 the key button starts a drone');
  t.next(); await wait(40);
  /* name mode: wait for the target note, then click its degree */
  async function nameDegrees(rounds) {
    let right = 0;
    for (let r = 0; r < rounds; r++) {
      const m = await nextTarget(t.w.performance.now()), d = M.degreeOf(m, keyOf());
      await wait(200);
      const b = $(`.stage .deg-choices [data-d="${d}"]`);
      if (b) { b.click(); right++; }
      await wait(100);
    }
    await wait(2600); /* the last resolution, then done */
    return right;
  }
  const n1 = await nameDegrees(6);
  t.check(n1 === 6 && nextOn(), `6.5 names do, mi or sol by ear (${n1}/6)`);
  t.next(); await wait(40);
  t.next(); await wait(40); // Name card
  const n2 = await nameDegrees(8);
  t.check(nextOn(), `6.5 all seven degrees with resolutions (${n2}/8)`);
  t.next(); await wait(40);
  /* play mode: read the syllable, play it */
  const SYL = { do: '1', re: '2', mi: '3', fa: '4', sol: '5', la: '6', ti: '7' };
  /* play the asked degree until the round counts it (the first round waits for the key context to finish) */
  const dotsOn = () => t.$$('.stage .progress-dots span.on').length;
  for (let r = 0; r < 5; r++) {
    for (let k = 0; k < 40 && dotsOn() === r; k++) {
      await wait(250);
      const deg = SYL[$('.stage .deg-ask').textContent.trim()];
      if (deg) t.pc((T.pc(keyOf()) + T.parseDeg(deg).semis) % 12);
    }
  }
  await wait(2600);
  t.check(nextOn(), '6.5 sing/play mode accepts each degree from the keys');
  t.next(); await wait(40);
  t.check(/lean and land/i.test($('.stage h2').textContent), '6.5 ends with the workshop');
  t.check(!saveOn() && /○/.test(checksText()), '6.5 workshop: Save waits for a tune');
  await recordKeys(92, ['g', 'h', 'j', 'k', 'f', 'd', 's', 'a']);
  t.check(/✓ Fits the brief/.test(checksText()) && saveOn(), `6.5 workshop: a recorded tune with ti→do, fa→mi and re→do passes (${checksText()})`);
  nameIt('Lean');
  t.click('.stage [data-act="save"]'); await wait(30);
  const lean = M.Store.data.sketches[0];
  t.check(lean.name === 'Lean' && lean.score.events.length >= 8 && lean.key === 'C' && lean.tags.indexOf('tendency tones') >= 0 && nextOn(), '6.5 workshop saves the recorded tune with its score');
  /* 'C4:1 B3:1' → score events */
  const L = t.w.MotifL6, ev = s => s.split(' ').map(x => { const [p, d] = x.split(':'); return { p, d: +d, rest: false, tie: false, tup: 0 }; });
  t.check(L.l6CheckTendency(ev('C4:1 B3:1 C4:1 F4:1 E4:1 D4:1 C4:2'), 'C') === null, '6.5 check accepts ti→do and fa→mi ending on do');
  t.check(/End on do/.test(L.l6CheckTendency(ev('C4:1 B3:1 C4:1 F4:1 E4:1 D4:3'), 'C')), '6.5 check asks for an ending on do');
  t.check(/at least two/.test(L.l6CheckTendency(ev('C4:1 E4:1 G4:1 E4:1 C4:4'), 'C')), '6.5 check asks for resolving tendency tones');

  // ---------- 6.6 ----------
  t.openUnit('6.6'); await wait(40);
  t.click('.stage .widget [data-pl="0"]'); await wait(30);
  t.check(!!$('.stage .widget .contour'), '6.6 the Hear card draws the contour');
  t.next(); await wait(40);
  const c1 = await answerQuiz(5);
  t.check(c1 === 5 && nextOn(), '6.6 names five contour shapes');
  t.next(); await wait(40); t.next(); await wait(40);
  for (const n of ['C', 'E', 'A', 'G', 'F', 'E', 'D', 'C']) { t.pc(n); await wait(10); }
  t.check(nextOn(), '6.6 leap-then-step tune played');
  t.check(L.l6CheckClimax(ev('C4:1 D4:1 E4:1 F4:1 A4:1 G4:1 E4:1 C4:1')) === null, '6.6 check accepts one late high point');
  t.check(/early/.test(L.l6CheckClimax(ev('A4:1 G4:1 F4:1 E4:1 D4:1 C4:1 D4:1 C4:1'))), '6.6 check flags an early high point');
  t.check(/more than once/.test(L.l6CheckClimax(ev('C4:1 G4:1 E4:1 G4:1 F4:1 E4:1 D4:1 C4:1'))), '6.6 check flags a repeated high point');

  // ---------- 6.7 ----------
  t.openUnit('6.7'); await wait(40);
  t.next(); await wait(40);
  t.check(t.$$('.stage .l6-tool').length === 8, '6.7 the Name card shows eight tools, each with notation');
  t.next(); await wait(40);
  const c2 = await answerQuiz(5, true);
  t.check(c2 === 4 && nextOn(), '6.7 tool quiz completes (one wrong answer allowed in a lesson)');
  t.next(); await wait(40);
  for (const id of ['sequence', 'inversion', 'fragment']) { t.click(`.stage [data-tool="${id}"]`); await wait(20); t.click('.stage [data-act="add"]'); await wait(20); }
  t.check($('.stage .vl-trail').textContent === 'motive → sequence → inversion → fragmentation', '6.7 Variation Lab chains three variations');
  $('.stage #vl-name').value = 'Lab phrase';
  t.click('.stage [data-act="save"]'); await wait(30);
  const lab = M.Store.data.sketches[0];
  t.check(lab.name === 'Lab phrase' && lab.score && lab.tags.indexOf('motive development') >= 0 && nextOn(), '6.7 the phrase is saved with a score and tags');

  // ---------- 6.8 ----------
  t.openUnit('6.8'); await wait(40);
  t.next(); await wait(40); t.next(); await wait(40);
  const c3 = await answerQuiz(4);
  t.check(c3 === 4 && nextOn(), '6.8 sentence or period by ear');
  t.next(); await wait(40);
  t.click('.stage [data-o="form"] [data-v="period"]'); await wait(20);
  t.check(/half cadence/.test($('.stage [data-parts]').textContent), '6.8 phrase builder shows the period’s parts');
  t.click('.stage [data-o="form"] [data-v="sentence"]'); await wait(20);
  t.click('.stage [data-o="cont"] [data-v="faster"]'); await wait(20);
  t.check(/continuation/.test($('.stage [data-parts]').textContent), '6.8 phrase builder shows the sentence’s parts');
  t.click('.stage [data-act="edit"]'); await wait(40);
  t.check(!!$('.stage .pb-edit .nt-edit svg') && saveOn(), '6.8 Edit opens the theme in the score editor');
  pickNote(0); t.key('g'); await wait(20);
  t.click('.stage .pb-edit [data-act="save"]'); await wait(30);
  const sent = M.Store.data.sketches[0];
  t.check(sent.name === 'My sentence' && sent.tags.indexOf('sentence') >= 0 && sent.chords && sent.chords.length && /^G/.test(sent.score.events[0].p) && nextOn(), '6.8 the edited sentence is saved with its chords');

  // ---------- 6.9 ----------
  t.openUnit('6.9'); await wait(40);
  t.next(); await wait(40); t.next(); await wait(40);
  const c4 = await answerQuiz(5);
  t.check(c4 === 5 && nextOn(), '6.9 names non-chord tones');
  t.next(); await wait(40);
  const c5 = await answerQuiz(3);
  t.check(c5 === 3 && nextOn(), '6.9 names ornaments by ear');
  t.next(); await wait(40);
  t.check(/0\.|You have 0/.test(checksText()) && !saveOn(), '6.9 workshop: the bare skeleton has no non-chord tones yet');
  pickNote(1); t.key('f'); await wait(20);
  pickNote(5); t.key('g'); await wait(20);
  t.check(/✓ Fits the brief/.test(checksText()) && saveOn(), `6.9 workshop: two passing tones by step entry pass (${checksText()})`);
  nameIt('Decor');
  t.click('.stage [data-act="save"]'); await wait(30);
  const decor = M.Store.data.sketches[0];
  t.check(decor.name === 'Decor' && decor.score.events.map(e => e.p).slice(0, 6).join(' ') === 'E4 F4 G4 G4 F4 G4' && nextOn(), '6.9 the decorated skeleton is saved');
  t.check(L.l6CheckDecor(ev('E4:1 F4:1 G4:2 F4:2 A4:2 G4:1 F4:0.5 E4:0.5 D4:2 E4:1 D4:1 C4:2')) === null, '6.9 check accepts a decorated skeleton');
  t.check(/at least two/.test(L.l6CheckDecor(ev('E4:1 G4:1 G4:2 F4:2 A4:2 G4:1 B3:1 D4:2 E4:1 G4:1 C4:2'))), '6.9 check asks for non-chord tones');

  // ---------- 6.P project ----------
  t.openUnit('6.P'); await wait(40);
  t.next(); await wait(40);
  t.check(!nextOn(), '6.P setup waits for a flavour');
  t.click('.stage [data-k="song"]'); await wait(20);
  t.click(t.$$('.stage [data-s]').find(b => b.textContent === 'Decor')); await wait(20);
  t.check(nextOn() && M.Store.data.projects['6.P'].flavour === 'song' && M.Store.data.projects['6.P'].seed === decor.id, '6.P setup: Song flavour, grown from the decorated skeleton');
  t.next(); await wait(40);
  t.check(t.$$('.stage .nt-edit .nt-ev').length >= 16 && /✓/.test(checksText()) && saveOn(), '6.P draft starts from the seed and ends on a stable note');
  nameIt('Theme');
  t.click('.stage [data-act="save"]'); await wait(30);
  const draft = M.Store.data.sketches[0];
  t.check(draft.name === 'Theme' && draft.project === '6.P' && draft.version === 1 && draft.tags.indexOf('song') >= 0 && draft.from === decor.id && nextOn(), '6.P draft saved as version 1');
  t.next(); await wait(40);
  t.check(/Theme/.test($('.stage [data-act="play"]').textContent) && t.$$('.stage .rub').length === 5, '6.P review lists five criteria');
  t.$$('.stage .rub').forEach((fs, i) => t.click(fs.querySelector(`[data-v="${i === 2 ? 0 : 2}"]`)));
  t.check($('.stage [data-act="save"]').disabled, '6.P review needs a note before saving');
  const note = $('.stage #rv-note'); note.value = 'make bar 12 the high point'; note.dispatchEvent(new t.w.Event('input'));
  t.click('.stage [data-act="save"]'); await wait(30);
  t.check(draft.review && draft.review.scores.climax === 0 && draft.review.note === 'make bar 12 the high point' && nextOn(), '6.P review saved on the draft');
  t.next(); await wait(40);
  t.check(/make bar 12 the high point/.test($('.stage .prompt').textContent) && $('.stage .nt-task .field input').value === 'Theme v2', 'version 2 opens the draft with the review note');
  pickNote(10); t.key('k'); await wait(20);
  t.click('.stage [data-act="save"]'); await wait(30);
  const v2 = M.Store.data.sketches[0];
  t.check(v2.name === 'Theme v2' && v2.version === 2 && v2.from === draft.id && M.Store.data.projects['6.P'].v2 === v2.id && nextOn(), '6.P version 2 saved, linked to the draft');
  t.next(); await wait(40);
  t.click('.stage [data-pick="b"]');
  const why = $('.stage #ab-why'); why.value = 'The late high point gives it somewhere to go.'; why.dispatchEvent(new t.w.Event('input'));
  t.click('.stage [data-act="save"]'); await wait(30);
  t.check(v2.compare && v2.compare.winner === v2.id && M.Store.day().wins.some(x => x.big === 'Version 2') && nextOn(), '6.P compare: version 2 judged stronger, with a reason and a win');
  t.next(); await wait(60);
  t.check(M.Store.data.units['6.P'] && M.Store.data.units['6.P'].done, '6.P project complete');

  // ---------- boss ----------
  M.Store.data.units['6.B'] = undefined;
  let seqNotes = null;
  const playSeq = M.Tasks.playSeq;
  M.Tasks.playSeq = (el, p, done) => { seqNotes = p.notes; return playSeq(el, p, done); };
  t.openUnit('6.B'); await wait(40);
  t.check(!$('.stage [data-act="skip"]'), 'boss steps cannot be skipped');
  t.next(); await wait(60);
  t.check(/6\/8/.test($('.stage .nt-chips').textContent), 'boss part 1 is in 6/8');
  const b1 = await answerQuiz(4, true);
  t.check(b1 === 3 && nextOn(), 'boss part 1: 3 of 4 rhythms in 6/8 passes');
  t.next(); await wait(60);
  const b2 = await answerQuiz(4);
  t.check(b2 === 4 && nextOn(), 'boss part 1: syncopation in 4/4');
  t.next(); await wait(40);
  const b3 = await nameDegrees(8);
  t.check(b3 === 8 && nextOn(), 'boss part 2: eight scale degrees by ear');
  t.next(); await wait(60);
  for (let k = 0; k < 3; k++) {
    const target = seqNotes;
    for (const n of target) { t.pc(T.pc(n)); await wait(15); }
    await wait(1000);
    t.check(t.$$('.stage .progress-dots span.on').length === k + 1, `boss part 3: transformation ${k + 1} of 3 played (${target.join(' ')})`);
  }
  t.check(nextOn(), 'boss part 3: sequence, inversion and retrograde all played');
  M.Tasks.playSeq = playSeq;
  t.next(); await wait(60);
  const doneText = $('#view').textContent;
  t.check(M.Store.data.units['6.B'].done && /Level 6 passed\./.test(doneText) && /Level 7, Colours, is on its way/.test(doneText), 'passing the boss passes Level 6 and names Level 7 as next');

  // ---------- Ear Gym and Daily Set ----------
  ['6.5', '6.6', '6.7', '6.8', '6.9'].forEach(id => { M.Store.data.units[id] = { done: true }; });
  t.check(M.EarGym.unlocked().length >= 5, `Ear Gym has ${M.EarGym.unlocked().length} unlocked skills`);
  M.Store.data.ear = { degrees: { diff: 1, n: 10, ok: 2 } };
  ['contour', 'motive', 'phrase', 'nct', 'lv2', 'lv3', 'lv4', 'lv5'].forEach(id => { M.Store.data.ear[id] = { diff: 2, n: 10, ok: 10 }; });
  t.check(M.EarGym.pick().id === 'degrees', 'Ear Gym picks the weakest skill');

  t.home(); await wait(30);
  t.check(t.$$('.level-section').length === 2 && /Intermediate/.test(t.$$('.level-section')[1].textContent), 'home groups levels into Beginner and Intermediate');
  t.check(/Intermediate · Level 6/.test($('.level-head .eyebrow').textContent), 'home shows the intermediate section on Level 6');
  t.click('[data-act="daily"]'); await wait(400);
  t.check(/Ear Gym/.test(t.$$('.strip div')[3].textContent) && /8 Bars/.test(t.$$('.strip div')[4].textContent), 'Daily Set uses the intermediate steps');
  t.check(/drone/.test($('.stage h2').textContent) && M.Drone.on, 'Daily tune-in plays a drone');
  const pat = t.$$('.stage .notes-strip .n').map(n => n.textContent);
  const key = /Key of (\S+) major/.exec($('.stage .chip').textContent)[1];
  for (const syl of pat) { t.pc((T.pc(key) + T.parseDeg(SYL[syl]).semis) % 12); await wait(20); }
  t.check(nextOn() && !M.Drone.on, `Daily tune-in: ${pat.join('-')} in ${key}, then the drone stops`);
  t.click('.stage [data-act="skip"]'); await wait(60);
  t.click('.stage [data-act="skip"]'); await wait(60);
  t.click('.stage [data-act="skip"]'); await wait(60);
  t.check(/Ear Gym/.test($('.stage h2').textContent) && /Scale degrees/.test($('.stage .ear-head').textContent), 'Ear Gym runs the weakest skill (scale degrees)');
  const before = M.Store.data.ear.degrees.n;
  await nameDegrees(5);
  await wait(1200);
  t.check(M.Store.data.ear.degrees.n === before + 5 && nextOn(), 'Ear Gym records five rounds');
  t.check(M.Store.data.ear.degrees.diff === 2, 'five right answers raise the difficulty');

  t.home(); await wait(30);
  t.check(M.Bus.h.note.size === noteBaseline && M.ChordIn.users === 0 && !M.Drone.on, 'no listeners, chord input or drone left behind');
  t.finish();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
