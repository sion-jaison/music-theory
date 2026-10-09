/* The intermediate weekly rhythm and Portfolio (jsdom): this week's Listening Map and pick on home, the Listening Map
   page, the Portfolio's tag filter, notation and pick of the week (and picks seeding projects), an Ear Gym level-up as
   today's 1%, and version 2 rated on the draft's rubric. */
const H = require('./helpers');
(async () => {
  const today = new Date(), day = n => { const d = new Date(today); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const sk = (id, name, tags, created, extra) => Object.assign({ id, name, tags, created, level: 6, notes: [{ m: 60, t: 0, d: 0.5 }, { m: 64, t: 0.5, d: 0.5 }], prompt: '' }, extra || {});
  const store = {
    units: { '1.B': { done: true }, '2.B': { done: true }, '3.B': { done: true }, '4.B': { done: true }, '5.B': { done: true }, '6.1': { done: true }, '6.4': { done: true } },
    sketches: [
      sk('a1', 'Lilt', ['compound time', 'groove'], day(0), { score: { meter: '6/8', bpm: 120, keySig: 0, events: [{ p: 'C4', d: 1.5, rest: false, tie: false, tup: 0 }, { p: 'E4', d: 1.5, rest: false, tie: false, tup: 0 }] } }),
      sk('a2', 'Five', ['odd meter'], day(0)),
      sk('a3', 'Old idea', ['groove'], day(40))
    ]
  };
  const t = await H.load({ store });
  const { w, wait } = t, M = w.Motif, $ = t.$, $$ = t.$$;

  /* ---------- home: this week ---------- */
  t.home(); await wait(30);
  t.check(!!$('.week') && /Listening Map/.test($('.week').textContent), 'home shows this week’s panel to intermediate learners');
  const mapId = $('[data-act="map"]').dataset.id;
  t.check(/^lm6-/.test(mapId) && M.LISTENING_MAPS.filter(m => m.level === 6).length === 5, `Level 6 has five Listening Maps; this week’s is ${mapId}`);
  t.check(M.listeningThisWeek().id === mapId, 'the week’s map stays the same within the week');
  t.click('[data-act="map"]'); await wait(30);
  t.check(/Listening Map/.test($('h1').textContent) && $('.lm-song') && /never plays/.test($('.lm').textContent), 'the map opens on its own page');
  const map = M.LISTENING_MAPS.find(m => m.id === mapId);
  map.listenFor.forEach((q, i) => t.click(`.lm-q[data-q="${i}"] [data-k="${q.answer}"]`));
  t.check(!$('[data-act="done"]').hidden && M.Store.data.listening[mapId].right === map.listenFor.length, 'answering every question finishes the map');
  t.click('[data-act="done"]'); await wait(30);
  t.check(/heard: \d of \d/.test($('.week').textContent) && /Listen again/.test($('[data-act="map"]').textContent), 'home shows the map as heard this week');

  /* ---------- Portfolio ---------- */
  t.click('[data-act="pick"]'); await wait(30);
  t.check(/Portfolio/.test($('.eyebrow').textContent) && $('.pick-box.open') && $$('#pk-s option').length === 2, 'the pick form lists only this week’s sketches');
  t.check($('[data-act="savepick"]').disabled, 'a pick needs a reason');
  $('#pk-s').value = 'a1'; $('#pk-s').dispatchEvent(new w.Event('change'));
  $('#pk-t').value = 'Lilting Night'; $('#pk-t').dispatchEvent(new w.Event('input'));
  $('#pk-w').value = 'The second bar answers the first.'; $('#pk-w').dispatchEvent(new w.Event('input'));
  t.click('[data-act="savepick"]'); await wait(30);
  t.check(M.Store.data.picks.length === 1 && M.Store.data.picks[0].id === 'a1' && /★ Lilting Night/.test($('.pick-box').textContent), 'the pick is saved with its title and reason');
  t.check(/★ Lilting Night/.test($('.sketch[data-id="a1"] h3').textContent) && M.Store.day().wins.some(x => /Lilting Night/.test(x.big)), 'the picked sketch shows its title and becomes today’s 1%');
  t.click('[data-tag="groove"]'); await wait(20);
  t.check($$('.sketch').map(x => x.dataset.id).join() === 'a1,a3', 'the tag filter shows sketches with that technique');
  t.click('[data-tag="★"]'); await wait(20);
  t.check($$('.sketch').map(x => x.dataset.id).join() === 'a1', 'the ★ filter shows picks');
  t.click('.sketch[data-id="a1"] [data-act="see"]'); await wait(20);
  t.check(!$('.sketch[data-id="a1"] .sk-art').hidden && $('.sketch[data-id="a1"] .sk-art svg'), 'Notation shows the sketch’s score');
  t.click('[data-tag=""]'); await wait(20);
  t.check($$('.sketch').length === 3, 'All shows everything again');

  /* picks seed projects first */
  const host = t.d.createElement('div'); t.d.body.appendChild(host);
  let clean = M.Tasks.projectSetup(host, { project: 'X.P' }, () => {});
  t.check(host.querySelectorAll('[data-s]')[1].textContent === 'Lilt', 'a Portfolio pick is the first seed offered for a project');
  clean();

  /* ---------- Ear Gym level-up is today's 1% ---------- */
  M.Store.data.units['6.5'] = { done: true };
  M.Store.data.ear = { degrees: { diff: 1, n: 0, ok: 0 } };
  const before = M.Store.day().wins.length;
  const skill = M.EAR_SKILLS.find(s => s.id === 'degrees'), run0 = skill.run;
  skill.run = (body, fin) => { fin(5, 5); return () => {}; };
  M.EarGym.unlocked().forEach(s => { if (s.id !== 'degrees') M.Store.data.ear[s.id] = { diff: 1, n: 10, ok: 10 }; });
  M.EarGym.run(host, () => {});
  skill.run = run0;
  const win = M.Store.day().wins[before];
  t.check(M.Store.data.ear.degrees.diff === 2 && win && /Scale degrees: 1 → 2/.test(win.big) && M.Store.data.earLog.slice(-1)[0].id === 'degrees', 'an Ear Gym level-up is logged and becomes today’s 1%');

  /* ---------- version 2 rated on the same rubric ---------- */
  const pr = M.projectOf('Y.P');
  const crit = [{ id: 'a', label: 'Motive' }, { id: 'b', label: 'Form' }];
  M.Store.data.sketches.unshift(sk('d1', 'Draft', ['theme'], day(0), { project: 'Y.P', version: 1, review: { scores: { a: 0, b: 1 }, note: 'more', criteria: crit } }));
  M.Store.data.sketches.unshift(sk('d2', 'Draft v2', ['theme'], day(0), { project: 'Y.P', version: 2 }));
  pr.draft = 'd1'; pr.v2 = 'd2';
  let res = null;
  host.innerHTML = '';
  clean = M.Tasks.compare(host, { project: 'Y.P' }, (ok, r) => { res = r; });
  t.check(host.querySelectorAll('.ab-rub .rub').length === 2, 'compare offers the draft’s rubric for version 2');
  host.querySelectorAll('.ab-rub .rub').forEach(fs => fs.querySelector('[data-v="2"]').click());
  host.querySelector('[data-pick="b"]').click();
  const why = host.querySelector('#ab-why'); why.value = 'Clearer phrases.'; why.dispatchEvent(new w.Event('input'));
  host.querySelector('[data-act="save"]').click();
  const v2 = M.Store.data.sketches.find(x => x.id === 'd2');
  t.check(res && res.scores.a === 2 && v2.review.scores.b === 2 && M.Store.day().wins.some(x => x.big === 'Rubric 1 → 4 of 4'), 'version 2’s rating is saved and the rubric gain is today’s 1%');
  clean();
  t.finish();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
