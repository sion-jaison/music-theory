/* Level 4 walkthrough: every unit renders, the main task of each unit is driven with the computer keys
   and circle taps (answers worked out from what is on screen), the boss passes, the clock time is kept,
   review cards unlock and render, and the Daily Set uses Level 4 content. */
const H = require('./helpers');

(async () => {
  const sketch = { id: 'sk1', name: 'Test phrase', notes: [60, 64, 67, 69, 71, 72].map((m, k) => ({ m, t: k * 0.4 })), key: 'C major', level: 2, created: '2026-01-01', prompt: '' };
  const t = await H.load({ unlock: 4, store: { sketches: [sketch] } });
  const M = t.w.Motif, T = M.Theory, D = () => M.Store.data;
  const wait = t.wait;
  /* SVG wedges have no .click() in jsdom */
  const tap = el => { if (!el) throw new Error('missing wedge'); el.dispatchEvent(new t.w.MouseEvent('click', { bubbles: true })); };
  const wedge = (pos, ring) => t.$(`.stage [data-pos="${pos}"][data-ring="${ring || 'major'}"]`);
  const fbText = () => (t.$('.stage .task .fb') || {}).textContent || '';
  const nextOn = () => !t.nextBtn().disabled;
  const play = async (names, gap) => { for (const n of names) { t.pc(T.stripOct(n)); await wait(gap == null ? 15 : gap); } };
  /* the key signature drawn in a container: + sharps, − flats */
  const sigOf = root => { const a = [...root.querySelectorAll('.nstaff .acc')].map(x => x.textContent); return a.length ? (a[0] === '♯' ? a.length : -a.length) : 0; };
  /* remember what the app plays, so ear questions can be answered from the sound */
  let lastSeq = null;
  const seq0 = M.Sound.seq;
  M.Sound.seq = function (notes, lead) { lastSeq = notes; return seq0.call(this, notes, lead); };
  const scaleType = notes => {
    const ms = notes.map(n => n.m), steps = ms.slice(1).map((m, i) => m - ms[i]).join(',');
    return ['major', 'minor', 'harmonic', 'melodic'].find(ty => T.recipe(ty).join(',') === steps);
  };
  /* answer a quiz round by round; solve(question text, question element, options) → the option text to pick (or { wrong: true }) */
  async function quiz(rounds, solve, pause) {
    for (let r = 0; r < rounds; r++) {
      if (pause) await wait(pause);
      const q = t.$('.stage .quiz-q');
      const opts = [...q.querySelectorAll('.choice')].map(b => b.textContent);
      const want = solve(q.querySelector('.prompt').textContent, q, opts, r);
      let k = want && want.wrong ? opts.findIndex(o => o !== want.right) : opts.indexOf(want);
      if (k < 0) throw new Error(`no option "${want}" in ${opts.join(' | ')}`);
      q.querySelector(`.choice[data-i="${k}"]`).click();
      await wait(want && want.wrong ? 2300 : 1200);
    }
  }
  /* play the tonic of each signature shown. wrongFirst: a wrong note on the first item
     (strict tasks count it and move on; others let you try again) */
  async function tonics(count, wrongFirst, strict) {
    for (let r = 0; r < count; r++) {
      const n = sigOf(t.$('.stage .l4-keyart')), minor = /minor/.test(t.$('.stage [data-q]').textContent);
      const tonic = T.keyFromSig(n, minor ? 'minor' : 'major');
      if (wrongFirst && r === 0) {
        t.pc((T.pc(tonic) + 1) % 12); await wait(20);
        if (strict) { await wait(2500); continue; }
      }
      t.pc(tonic); await wait(1400);
    }
  }
  /* fill the clock by reading each asked key; one wrong tap first if asked */
  async function fillClock(wrongFirst) {
    t.click('.stage [data-act="start"]'); await wait(20);
    let guard = 0, first = true;
    while (guard++ < 30) {
      const m = /^(\S+) (major|minor)$/.exec(t.$('.stage [data-ask]').textContent);
      if (!m) break;
      const pos = T.circlePos(m[1], m[2]);
      if (first && wrongFirst) { tap(wedge((pos + 3) % 12, m[2])); await wait(10); }
      first = false;
      tap(wedge(pos, m[2])); await wait(10);
    }
  }
  /* play the chords named by numerals in a familySlice task */
  async function chords(count, key, mode) {
    for (let r = 0; r < count; r++) {
      const c = T.romanChord(t.$('.stage .big-name').textContent, key, mode);
      await play(c.notes, 10); await wait(1000);
    }
  }
  const noteBaseline = M.Bus.h.note.size;

  t.home(4); await wait(30);
  t.check(t.$$('.unit').length === 11 && /The Clock/.test(t.$('.level-head h2').textContent), 'home shows The Clock with 11 stops');
  t.check(M.LEVELS.find(l => l.n === 4).units.map(u => u.id).join(' ') === '4.1 4.2 4.3 4.4 4.5 4.6 4.7 4.8 4.9 4.C 4.B', 'unit ids match the plan');

  // every unit renders every step (skip through)
  for (const id of ['4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7', '4.8', '4.9', '4.C']) t.check(await t.walk(id), `${id} renders every step`);
  D().units = { '1.B': { done: true }, '2.B': { done: true }, '3.B': { done: true } }; D().cards = {};

  // 4.1 Key signatures: read G major from a signature, play the order of sharps, order quiz
  t.openUnit('4.1'); await wait(30);
  t.check(t.$$('.stage .art .nstaff').length === 2, '4.1 shows G major written out and with a signature');
  t.next(); await wait(30);
  await play(['G', 'A', 'B', 'C', 'D', 'E']); t.pc('F'); await wait(10);
  t.check(/F♯/.test(fbText()), '4.1 a plain F gets the signature hint');
  await play(['F♯', 'G']);
  t.check(nextOn(), '4.1 G major read from the one-sharp signature');
  t.next(); await wait(30);
  await play(t.$$('.stage .notes-strip .n').map(c => c.textContent));
  t.check(nextOn() && /five black keys/.test(fbText()), '4.1 first five sharps played in order');
  t.next(); await wait(30);
  t.check(/Father Charles Goes Down And Ends Battle/.test(t.$('.stage').textContent) && /Battle Ends And Down Goes Charles’ Father/.test(t.$('.stage').textContent), '4.1 both order sayings shown');
  t.next(); await wait(30);
  await quiz(4, q => {
    const m = /has (\d) (sharps|flats)/.exec(q), k = +m[1], sharp = m[2] === 'sharps';
    return (sharp ? T.ORDER_SHARPS : T.ORDER_FLATS).slice(0, k).map(l => l + (sharp ? '♯' : '♭')).join(' ');
  });
  t.check(nextOn(), '4.1 order-of-accidentals quiz passed');
  t.next(); await wait(30);
  t.check(!!t.$('.done-card') && !!D().cards['l4-order-sharps'], '4.1 finishes and unlocks its review cards');

  // 4.2 Read the key: play tonics of sharp and flat keys, then name signatures
  t.openUnit('4.2'); await wait(30);
  t.next(); await wait(20); t.next(); await wait(30);
  t.pc((T.pc(T.keyFromSig(sigOf(t.$('.stage .l4-keyart')))) + 1) % 12); await wait(10);
  t.check(/half step|last sharp/i.test(fbText()), '4.2 a wrong tonic gets the last-sharp hint');
  await tonics(4);
  t.check(nextOn(), '4.2 tonics of four sharp keys played');
  t.next(); await wait(30);
  t.check(t.$$('.stage .l4-keyart .acc').every(a => a.textContent === '♭'), '4.2 Explore shows flat signatures');
  await tonics(4);
  t.check(nextOn(), '4.2 tonics of four flat keys played');
  t.next(); await wait(30);
  await quiz(5, (q, el) => T.keyFromSig(sigOf(el), 'major') + ' major');
  t.check(nextOn(), '4.2 five signatures named');
  t.next(); await wait(30);

  // 4.3 The Circle of Fifths: walk both sides, use the explorer
  t.openUnit('4.3'); await wait(30);
  t.next(); await wait(30);
  await play(t.$$('.stage .notes-strip .n').map(c => c.textContent));
  t.check(nextOn() && t.$$('.stage .wedge.major.ok').length === 6, '4.3 walked C G D A E B; the clock filled six spots');
  t.next(); await wait(30);
  t.check(/Cats Go Down Alleys Eating Birds/.test(t.$('.stage').textContent) && /BEAD/.test(t.$('.stage').textContent), '4.3 circle card has both hooks');
  t.next(); await wait(30);
  t.pc('C'); t.pc('G'); await wait(10);
  t.check(/Next is F/.test(fbText()), '4.3 flat walk hints at F after a wrong note');
  await play(['C', 'F', 'B♭', 'E♭', 'A♭', 'D♭', 'G♭']);
  t.check(nextOn() && t.$$('.stage .wedge.major.ok').length === 7, '4.3 walked the flat side to G♭');
  t.next(); await wait(30);
  tap(wedge(2, 'major')); await wait(20);
  let info = t.$('.stage .l4-info').textContent;
  t.check(/D major/.test(info) && /F♯ C♯/.test(info) && /B minor/.test(info) && !!t.$('.stage .l4-info .nstaff'), '4.3 explorer: D shows 2 sharps on a staff and its relative minor');
  tap(wedge(6, 'minor')); await wait(20);
  info = t.$('.stage .l4-info').textContent;
  t.check(/D♯ minor/.test(info) && /F♯ major/.test(info) && /E♭ minor/.test(info), '4.3 explorer: inner ring at 6 o’clock names D♯ minor, its major and its twin spelling');
  t.next(); await wait(30);

  // 4.4 Clock maths: discover the pattern, the far side, fill the clock against the timer
  t.openUnit('4.4'); await wait(30);
  await quiz(5, (q, el) => { const pos = +el.querySelector('.wedge.sel').dataset.pos; return String(pos <= 5 ? pos : 12 - pos); });
  t.check(nextOn(), '4.4 clock-maths discovery quiz passed');
  t.next(); await wait(20); t.next(); await wait(20);
  t.check(/C♭ major/.test(t.$('.stage').textContent) && /G♭ major/.test(t.$('.stage').textContent) && /C♯ major/.test(t.$('.stage').textContent), '4.4 far-side card names the three enharmonic pairs');
  t.next(); await wait(30);
  t.click('.stage [data-act="start"]'); await wait(20);
  const ask0 = /^(\S+) major$/.exec(t.$('.stage [data-ask]').textContent)[1];
  tap(wedge(0)); await wait(10);
  t.check(wedge(0).classList.contains('no') && /o’clock/.test(fbText()), '4.4 a wrong tap flashes red and gives the clock maths');
  await wait(700);
  t.check(!wedge(0).classList.contains('no'), '4.4 the red flash clears');
  for (let g = 0; g < 3; g++) { const m = /^(\S+) major$/.exec(t.$('.stage [data-ask]').textContent); if (m) { tap(wedge(T.circlePos(m[1]))); await wait(10); } }
  t.check(nextOn() && [5, 6, 7].every(p => wedge(p).classList.contains('ok')) && ['C♯', 'G♭', 'C♭'].indexOf(ask0) >= 0, '4.4 C♯, G♭ and C♭ placed at the bottom of the clock');
  t.next(); await wait(30);
  t.check(t.$$('.stage .wedge.major text').length === 0 && t.$$('.stage .wedge.minor').length === 0, '4.4 Fill the clock starts blank, outer ring only');
  await fillClock(true);
  t.check(nextOn() && t.$$('.stage .wedge.major.ok').length === 12, '4.4 all 12 keys placed');
  t.check(typeof (D().bests || {}).clock === 'number', `4.4 fill-the-clock time recorded (${(D().bests || {}).clock} s)`);
  t.check(!t.$('.stage [data-act="start"]').hidden, '4.4 offers another round');
  t.next(); await wait(30);

  // 4.5 Neighbours are family: the slice widget, six chords of G, chords from the slice
  t.openUnit('4.5'); await wait(30);
  t.next(); await wait(30);
  t.check(t.$('.stage .l4-six').textContent.replace(/\s+/g, '') === 'IVCIGVDiiAmviEmiiiBm', '4.5 slice widget shows G’s six chords');
  tap(wedge(2)); await wait(20);
  t.check(/D major/.test(t.$('.stage .l4-info h3').textContent) && t.$$('.stage .wedge.fam').length === 6, '4.5 tapping D moves the slice');
  t.next(); await wait(30);
  await chords(6, 'G', 'major');
  t.check(nextOn() && t.$$('.stage .progress-dots .on').length === 6, '4.5 played I IV V vi ii iii in G');
  t.next(); await wait(30);
  await quiz(4, q => { const m = /In (\S+) major, which chord is (\S+)\?/.exec(q); return T.pretty(T.romanChord(m[2], m[1]).sym); });
  t.check(nextOn(), '4.5 chords found from the slice in other keys');
  t.next(); await wait(30);

  // 4.6 Natural minor and relative keys
  t.openUnit('4.6'); await wait(30);
  t.click('.stage [data-pl="1"]'); await wait(10);
  t.check(lastSeq && scaleType(lastSeq) === 'minor', '4.6 Hear plays A natural minor');
  t.next(); await wait(30);
  t.check(t.$$('.kb .key.target').length > 0, '4.6 next key glows on the dock');
  await play(T.scale('A3', 'minor', true));
  t.check(nextOn() && t.$$('.stage .stp.on').map(s => s.textContent).join(' ') === 'W H W W H W W', '4.6 A natural minor played, steps W H W W H W W');
  t.check(t.$$('.kb .key.target').length === 0, '4.6 dock marks cleared at the end');
  t.next(); await wait(30);
  t.check(/2-1-2-2-1-2-2/.test(t.$('.stage').textContent) && /down 3 half steps/.test(t.$('.stage').textContent), '4.6 recipe and relative-minor hook shown');
  t.next(); await wait(30);
  await play(T.scale('E4', 'minor', true));
  t.check(nextOn(), '4.6 E natural minor played');
  t.next(); await wait(30);
  t.check(!!t.$('.stage .l4-hide-minor') && t.$$('.stage .wedge.minor.ok').length === 1, '4.6 inner ring names hidden except A minor');
  await fillClock(true);
  t.check(nextOn() && t.$$('.stage .wedge.minor.ok').length === 7, '4.6 six minor keys placed on the inner ring');
  t.next(); await wait(30);
  await tonics(4, true);
  t.check(nextOn(), '4.6 minor tonics played from signatures');
  t.next(); await wait(30);

  // 4.7 Three minors
  t.openUnit('4.7'); await wait(30);
  t.next(); await wait(30);
  await play(T.scale('A3', 'harmonic', true));
  t.check(nextOn() && t.$$('.stage .stp.on').some(s => s.textContent === 'W+H'), '4.7 A harmonic minor played; the gap shows as W+H');
  t.next(); await wait(30);
  t.check(/♯7/.test(t.$('.stage').textContent) && /♯6 ♯7/.test(t.$('.stage').textContent), '4.7 harmonic and melodic hooks shown');
  t.next(); await wait(30);
  await play(T.scale('A3', 'melodic', true).concat(T.scale('A3', 'minor', true).reverse().slice(1)));
  t.check(nextOn(), '4.7 melodic up, natural down');
  t.next(); await wait(400);
  await quiz(5, () => ({ minor: 'Natural', harmonic: 'Harmonic', melodic: 'Melodic' })[scaleType(lastSeq)], 300);
  t.check(nextOn(), '4.7 which-minor ear quiz answered from the sound');
  t.next(); await wait(30);

  // 4.8 Parallel keys and mood
  t.openUnit('4.8'); await wait(30);
  t.click('.stage [data-pl="1"]'); await wait(10);
  t.check(lastSeq.map(n => n.m % 12).filter(p => p === 4 || p === 9 || p === 11).length === 0, '4.8 the minor version has no E, A or B');
  t.next(); await wait(20); t.next(); await wait(30);
  await play(T.scale('C4', 'minor', true));
  t.check(nextOn(), '4.8 C minor played');
  t.next(); await wait(30);
  const tune = t.$$('.stage .art .nlabel').map(x => x.textContent);
  await play(tune.map(n => ['E', 'A', 'B'].indexOf(n) >= 0 ? n + '♭' : n));
  t.check(tune.length === 10 && nextOn(), '4.8 tune flipped to C minor by lowering E, A and B');
  t.next(); await wait(30);
  await quiz(4, q => { const k = /Turn (\S+) major/.exec(q)[1], s = T.scale(k); return [s[2], s[5], s[6]].join(', '); });
  t.check(nextOn(), '4.8 lower-3-6-7 quiz passed');
  t.next(); await wait(30);

  // 4.9 Chords in minor keys
  t.openUnit('4.9'); await wait(30);
  t.next(); await wait(30);
  t.check(/i ii° III iv v VI VII/.test(t.$('.stage').textContent) && /Am B° C Dm Em F G/.test(t.$('.stage').textContent), '4.9 chords of A minor come from Theory.diatonic');
  t.next(); await wait(20); t.next(); await wait(30);
  t.check(!!t.$('.stage .wedge.major.ask[data-pos="4"]'), '4.9 the borrowed V (E) glows on the clock');
  await chords(4, 'A', 'minor');
  t.check(nextOn(), '4.9 played Am Dm E Am');
  t.next(); await wait(30);
  await chords(4, 'E', 'minor');
  t.check(nextOn(), '4.9 played Em Am B Em');
  t.next(); await wait(30);

  // 4.C Minor mood: flip a stored sketch, undo one change, save
  t.openUnit('4.C'); await wait(30);
  t.next(); await wait(30);
  t.click('.stage [data-sk="0"]'); await wait(20);
  t.check(t.$$('.stage [data-min] .n').map(x => x.textContent).join(' ') === 'C E♭ G A♭ B♭ C', '4.C sketch turned to C minor: E♭ A♭ B♭');
  t.click('.stage [data-min] [data-k="4"]'); await wait(10);
  t.check(t.$('.stage [data-min] [data-k="4"]').textContent === 'B', '4.C a change can be undone (B kept)');
  t.click('.stage [data-act="save"]'); await wait(20);
  const saved = D().sketches[0];
  t.check(nextOn() && saved.level === 4 && saved.key === 'C minor' && saved.from === 'sk1' && saved.notes.map(n => n.m).join() === '60,63,67,68,71,72', '4.C saved as a Level 4 sketch in C minor, grown from the original');
  t.next(); await wait(30);

  // Boss: fill the clock, name 8 signatures (one wrong), play 4 tonics (one wrong)
  t.openUnit('4.B'); await wait(30);
  t.next(); await wait(30);
  t.check(!t.$('.stage [data-act="skip"]'), 'boss steps cannot be skipped');
  const best0 = D().bests.clock;
  await fillClock(true);
  t.check(nextOn() && /placed in/.test(fbText()), 'boss part 1: all 12 keys placed in under 90 s');
  t.check(typeof D().bests.clock === 'number' && D().bests.clock <= best0, 'boss clock time kept as a personal best');
  t.next(); await wait(30);
  await quiz(8, (q, el, opts, r) => {
    const right = T.keyFromSig(sigOf(el), /minor/.test(q) ? 'minor' : 'major') + (/minor/.test(q) ? ' minor' : ' major');
    return r === 0 ? { wrong: true, right } : right;
  });
  t.check(nextOn() && /7 of 8/.test(t.$('.stage .quiz-q').textContent), 'boss part 2: 7 of 8 signatures named passes');
  t.next(); await wait(30);
  await tonics(4, true, true);
  t.check(nextOn() && /3 of 4/.test(fbText()), 'boss part 3: 3 of 4 tonics passes');
  t.next(); await wait(40);
  t.check(/Level 4 passed|Beginner section complete/.test(t.$('.done-card .big').textContent), 'boss passed: ' + t.$('.done-card .big').textContent);
  t.check(D().units['4.B'] && D().units['4.B'].done, 'boss stored as passed');

  // review cards: every Level 4 card type renders, repeatedly
  const host = t.d.createElement('div'); t.d.body.appendChild(host);
  let rendered = 0, ids = 0;
  Object.keys(M.CARD_DEFS).filter(u => u[0] === '4').forEach(u => M.CARD_DEFS[u].forEach(c => {
    ids++;
    for (let k = 0; k < 12; k++) { const clean = M.CARD_TYPES[c.type](host, c, () => {}); if (host.querySelector('.prompt')) rendered++; if (typeof clean === 'function') clean(); }
  }));
  host.remove();
  const unitsWithCards = Object.keys(M.CARD_DEFS).filter(u => u[0] === '4');
  t.check(rendered === ids * 12 && unitsWithCards.length === 9 && unitsWithCards.every(u => M.CARD_DEFS[u].length >= 2 && M.CARD_DEFS[u].length <= 8), `${ids} Level 4 review cards render (2–8 per unit)`);
  t.check(Object.values(M.CARD_DEFS).flat().filter(c => /^l4-/.test(c.id)).length === ids, 'Level 4 card ids start with l4-');

  // a play-the-tonic card grades the first note
  let graded = null;
  const host2 = t.d.createElement('div'); t.d.body.appendChild(host2);
  const cl = M.CARD_TYPES.l4Tonic(host2, { prompt: 'x', mode: 'major' }, ok => { graded = ok; });
  t.pc(T.keyFromSig(sigOf(host2), 'major')); await wait(1500);
  t.check(graded === true, 'l4Tonic card: right tonic grades true');
  cl(); host2.remove();

  // Daily Set: Level 4 review card, minor-key create prompt, major/minor ear spark.
  // Passing the boss made Level 5 current (when it exists), so set the boss aside while the Daily Set runs as a Level 4 learner's.
  const bossRecord = D().units['4.B']; delete D().units['4.B'];
  t.home(); await wait(30);
  t.click('[data-act="daily"]'); await wait(300);
  t.click('.stage [data-act="skip"]'); await wait(80);
  t.check(/Card 1 of/.test(t.$('.stage').textContent) && !!t.$('.stage .task .prompt') && Object.keys(D().cards).every(id => /^l4-/.test(id)), 'Daily Set review renders a Level 4 card');
  t.click('.stage [data-act="skip"]'); await wait(60);
  t.click('.stage [data-act="skip"]'); await wait(60);
  const lv4 = M.LEVELS.find(l => l.n === 4);
  t.check(lv4.create.prompts.indexOf(t.$('.stage .task .prompt').textContent) >= 0, 'Daily Set create uses a minor-key prompt');
  t.click('.stage [data-act="rec"]'); t.pc('C♯'); await wait(10);
  t.check(/not in A minor/.test(fbText()), 'Daily Set create keeps to A minor');
  t.click('.stage [data-act="skip"]'); await wait(400);
  t.check(/Major or minor/.test(t.$('.stage h2').textContent) && t.$$('.stage .quiz-q .choice').length === 4, 'Daily Set ear spark: which scale, four choices once 4.7 is done');
  const earN = M.Store.day().earN;
  await quiz(5, () => ({ major: 'Major', minor: 'Natural minor', harmonic: 'Harmonic minor', melodic: 'Melodic minor' })[scaleType(lastSeq)], 300);
  t.check(nextOn() && M.Store.day().earN === earN + 5 && M.Store.day().earOk >= 5, 'Daily Set ear spark: 5 rounds scored');
  t.next(); await wait(40);
  t.check(/1%/.test(t.$('.stage .tag').textContent), 'Daily Set reaches Today’s 1%');
  D().units['4.B'] = bossRecord;

  // clean-up: no listeners or chord input left behind
  t.home(); await wait(30);
  t.check(M.Bus.h.note.size === noteBaseline && M.ChordIn.users === 0 && t.$$('.kb .key.target, .kb .key.found, .kb .key.hint').length === 0, 'tasks leave no note listeners, chord input or dock marks behind');
  t.finish();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
