/* Level 5 walkthrough: every unit renders; the main task of each unit is driven with the computer keys;
   ear questions are answered from the notes the app actually plays; the final boss is passed with keys only. */
const H = require('./helpers');
(async () => {
  const seed = { id: 'sSeed', name: 'Seed motif', notes: [{ m: 61, t: 0 }, { m: 63, t: 0.4 }, { m: 66, t: 0.8 }], prompt: 'test', level: 1, created: '2026-01-01' };
  const t = await H.load({ unlock: 5, store: { sketches: [seed] } });
  const M = t.w.Motif, T = M.Theory, d = t.d;
  const mod = n => ((n % 12) + 12) % 12;
  const stage = () => t.$('.stage');
  const nextOn = () => !!t.nextBtn() && !t.nextBtn().disabled;
  const fbText = () => (t.$('.stage .fb') || {}).textContent || '';

  /* record every scheduled tone, so ear questions can be answered from what is heard */
  let tones = [];
  const tone0 = M.Sound.tone;
  M.Sound.tone = function (m, when) { if (when != null) tones.push({ m, when }); return tone0.apply(this, arguments); };
  /* group the recorded tones into chords (3+ pitch classes struck together) */
  function heardChords() {
    const list = tones.slice().sort((a, b) => a.when - b.when), groups = [];
    let g = null;
    list.forEach(x => { if (!g || x.when - g.t > 0.1) { g = { t: x.when, ms: [] }; groups.push(g); } g.ms.push(x.m); });
    return groups.map(gr => { const pcs = [...new Set(gr.ms.map(mod))]; return pcs.length >= 3 ? T.identify(pcs, mod(Math.min(...gr.ms)))[0] : null; }).filter(Boolean);
  }
  const deg = (c, key) => mod(c.rootPc - key);
  function cadenceOf(ch) {
    const key = ch[0].rootPc, last = deg(ch[ch.length - 1], key), prev = deg(ch[ch.length - 2], key);
    return last === 9 ? 'Deceptive' : last === 7 ? 'Half' : prev === 7 ? 'Authentic' : 'Plagal';
  }
  function loopOf(ch) { const i = ch.slice(0, 4).findIndex(c => c.q === 'min'); return ['vi–IV–I–V', 'I–vi–IV–V', 'I–V–vi–IV'][i]; }
  function earAnswer() {
    const ch = heardChords(), n = t.$$('.stage .quiz-q .choice').length;
    return n === 3 ? loopOf(ch) : cadenceOf(ch);
  }
  /* answer quiz rounds: decide() returns the start of the right option's text */
  async function answer(rounds, decide) {
    for (let r = 0; r < rounds; r++) {
      await t.wait(420);
      const want = decide();
      const b = t.$$('.stage .quiz-q .choice').find(x => x.textContent.startsWith(want));
      if (!b) { t.check(false, `quiz option "${want}" exists`); return; }
      tones = [];
      b.click();
      await t.wait(1200);
    }
  }
  const numAnswer = () => {
    const m = t.$('.stage .quiz-q .prompt').textContent.match(/In (.+) major, which chord is (\S+)\?/);
    return T.pretty(T.romanChord(m[2], m[1]).sym);
  };
  /* play a chord by tapping its notes within a second, then wait for the task to move on */
  async function playChord(sym) { const c = T.parseChord(sym); for (const pc of T.chordPcs(c.root, c.q)) { t.pc(pc); await t.wait(15); } await t.wait(1000); }
  async function playProg(romans, key, mode) { for (const c of T.progression(romans, key, mode)) await playChord(c.sym); }
  /* open a unit and move to step n (Skip on tasks, Next on cards) */
  async function gotoStep(id, n) {
    t.openUnit(id); await t.wait(40);
    for (let i = 1; i < n; i++) { const sk = t.$('.stage [data-act="skip"]'); if (sk) sk.click(); else t.next(); tones = []; await t.wait(40); }
    return new RegExp(`step ${n} of`).test(t.$('.stage .tag').textContent);
  }

  // Home: Level 5 is open and lists its 11 stops
  t.home(5); await t.wait(40);
  t.check(t.$('.level-head h2').textContent === 'Make It Move', 'Level 5 is titled Make It Move');
  t.check(t.$$('.unit').length === 11 && !t.$('.unit[disabled]'), 'Level 5 shows 11 open stops');
  const ids = t.$$('.unit').map(u => u.dataset.u).join(' ');
  t.check(ids === '5.1 5.2 5.3 5.4 5.5 5.6 5.7 5.8 5.9 5.P 5.B', 'unit ids in plan order: ' + ids);

  // Every unit renders every step and finishes
  for (const id of ['5.1', '5.2', '5.3', '5.4', '5.5', '5.6', '5.7', '5.8', '5.9', '5.P']) t.check(await t.walk(id), `${id} renders every step and finishes`);
  const stored = () => JSON.parse(t.w.localStorage.getItem('motif.v1'));
  const cardIds = Object.keys(stored().cards || {});
  t.check(cardIds.length >= 30 && cardIds.every(c => c.startsWith('l5-')), `review cards unlocked (${cardIds.length}, all l5-)`);

  // 5.1: follow I–IV–V–I in C; then build a trip that ends at home
  t.check(await gotoStep('5.1', 2), '5.1 step 2 opens');
  t.check(t.$('.l5-follow .big-name').textContent === 'I · C', '5.1 follower shows “I · C”');
  await playProg(['I', 'IV', 'V', 'I'], 'C');
  t.check(nextOn() && t.$$('.l5-prog .l5-cell.ok').length === 4, '5.1 I–IV–V–I in C followed chord by chord');
  t.check(M.ChordIn.users === 1, 'chord input is on while the follower runs');
  t.next(); await t.wait(30); t.next(); await t.wait(30); t.click('.stage [data-act="skip"]'); await t.wait(40);
  for (const r of ['I', 'IV', 'V', 'V']) { t.click(`.stage [data-r="${r}"]`); await t.wait(10); }
  t.click('.stage [data-act="play"]'); await t.wait(20);
  t.check(!nextOn() && /End on I/.test(fbText()), '5.1 builder: a trip that stops on V is not finished');
  t.click('.stage [data-act="clear"]');
  for (const r of ['I', 'IV', 'V', 'I']) { t.click(`.stage [data-r="${r}"]`); await t.wait(10); }
  t.click('.stage [data-act="play"]'); await t.wait(20);
  t.check(nextOn() && /T → S → D → T/.test(fbText()), '5.1 builder: I IV V I reads T → S → D → T');
  t.home(); await t.wait(30);
  t.check(M.ChordIn.users === 0 && t.$$('.kb .key.found, .kb .key.hint').length === 0, 'leaving a lesson stops chord input and clears key marks');

  // 5.2: the four-chord loop in G
  t.check(await gotoStep('5.2', 2), '5.2 step 2 opens');
  await playProg(['I', 'V', 'vi', 'IV'], 'G');
  t.check(nextOn(), '5.2 I–V–vi–IV in G followed (G D Em C)');

  // 5.3: the three blues 7th chords, then improvise with the blues scale over the twelve-bar loop
  t.check(await gotoStep('5.3', 3), '5.3 step 3 opens');
  await playProg(['I7', 'IV7', 'V7'], 'C');
  t.check(nextOn(), '5.3 C7 F7 G7 played as four-note chords');
  t.check(await gotoStep('5.3', 6), '5.3 step 6 opens');
  t.check(t.$$('.l5-loop .l5-cell').length === 12, '5.3 the backing loop shows twelve bars');
  t.click('.stage [data-l5="go"]'); await t.wait(30);
  t.pc('E'); await t.wait(20);
  t.check(t.$('.l5-trail .n.out') && /outside the scale/.test(fbText()), '5.3 E is marked outside the C blues scale');
  const blues = T.scale('C', 'blues').map(T.pc);
  for (let i = 0; i < 12; i++) { t.pc(blues[i % 6]); await t.wait(20); }
  t.check(nextOn() && t.$$('.l5-trail .n.ct').length >= 11, '5.3 twelve blues-scale notes over the loop complete the improvisation');
  t.home(); await t.wait(30);

  // 5.4: ii–V–I
  t.check(await gotoStep('5.4', 2), '5.4 step 2 opens');
  await playProg(['ii7', 'V7', 'Imaj7'], 'C');
  t.check(nextOn(), '5.4 Dm7 G7 Cmaj7 followed');

  // 5.5: name cadences by ear (answers worked out from the chords the app plays)
  t.check(await gotoStep('5.5', 4), '5.5 step 4 opens');
  await answer(6, () => cadenceOf(heardChords()));
  t.check(nextOn() && /6 of 6/.test(stage().textContent), '5.5 six cadences named by ear');

  // 5.6: I–IV–V–I in D and in F, then numbers into chords with the circle
  t.check(await gotoStep('5.6', 3), '5.6 step 3 opens');
  t.check(t.$$('.stage .circle5 .wedge.fam').length === 6, '5.6 the circle lights the family slice of D');
  await playProg(['I', 'IV', 'V', 'I'], 'D');
  t.check(nextOn(), '5.6 I–IV–V–I in D (D G A D)');
  t.next(); await t.wait(40);
  t.check(t.$('.stage .chord-target .tones').textContent === '', '5.6 the F major step shows no note names');
  await playProg(['I', 'IV', 'V', 'I'], 'F');
  t.check(nextOn(), '5.6 I–IV–V–I in F (F B♭ C F)');
  t.check(await gotoStep('5.6', 6), '5.6 step 6 opens');
  await answer(5, numAnswer);
  t.check(nextOn(), '5.6 numbers turned into chords in five keys');
  // the circle explorer (step 2) responds to a tap on a wedge
  t.check(await gotoStep('5.6', 2), '5.6 step 2 opens');
  t.$('.stage .circle5 [data-pos="2"][data-ring="major"]').dispatchEvent(new t.w.MouseEvent('click', { bubbles: true })); await t.wait(20);
  t.check(/D major/.test(t.$('.l5-cx-line').textContent) && /D – G – A – D/.test(t.$('.l5-cx-line').textContent), '5.6 tapping D on the circle lists D G A D');

  // 5.7: chord-tone radar over a looping I–V–vi–IV
  t.check(await gotoStep('5.7', 3), '5.7 step 3 opens');
  const rng = t.$('.stage .l5-tempo input'); rng.value = '140'; rng.dispatchEvent(new t.w.Event('input', { bubbles: true }));
  t.click('.stage [data-l5="go"]'); await t.wait(60);
  t.check(t.$$('.kb .key.hint').length > 0, '5.7 the dock glows with the current chord’s notes');
  const loopChords = T.progression(['I', 'V', 'vi', 'IV'], 'C'), cMaj = T.scale('C').map(T.pc);
  for (let i = 0; i < 16; i++) {
    const c = loopChords[+t.$('.l5-loop').dataset.cur], pcs = T.chordPcs(c.root, c.q);
    t.pc(i % 2 === 0 ? pcs[(i / 2) % 3] : cMaj.find(p => pcs.indexOf(p) < 0)); await t.wait(25);
    if (i === 0) t.check(t.$('.l5-trail .n.ct') && t.$('.kb .key.l5-hit-ct'), '5.7 a chord tone lights green on the trail and the keys');
    if (i === 1) t.check(t.$('.l5-trail .n.inkey'), '5.7 a passing note in the key lights blue');
  }
  t.pc('F♯'); await t.wait(20);
  t.check(t.$('.l5-trail .n.out') && t.$('.kb .key.l5-hit-out'), '5.7 F♯ lights red: outside the key');
  t.check(nextOn() && /in the chord/.test(t.$('.l5-tally').textContent), '5.7 radar completes after 16 notes, most in the key, 8 chord tones');
  await t.wait(1900);
  t.check(t.$('.l5-loop').dataset.cur === '1', '5.7 the loop moved on to the V chord after one bar');
  t.home(); await t.wait(30);
  tones = []; await t.wait(1200);
  t.check(tones.length === 0 && t.$$('.kb .key.hint').length === 0, 'leaving the radar stops the loop and clears the keys');

  // 5.8: crescendo without a mic falls back to ordering the dynamics
  t.check(await gotoStep('5.8', 3), '5.8 step 3 opens');
  t.check(!!t.$('.stage [data-pool]'), '5.8 with no mic, the crescendo step offers the keys version');
  t.click('.stage [data-d="ff"]'); await t.wait(10);
  t.check(/softer is still left/.test(fbText()), '5.8 ff first is rejected: softest first');
  for (const s of ['p', 'mp', 'mf', 'f', 'ff']) { t.click(`.stage [data-d="${s}"]`); await t.wait(10); }
  t.check(nextOn() && /crescendo/.test(fbText()), '5.8 p → ff in order completes the step');
  // tempo by ear: the gap between the notes gives the BPM
  t.check(await gotoStep('5.8', 6), '5.8 step 6 opens');
  const BPM = { Largo: 50, Andante: 76, Moderato: 108, Allegro: 138, Presto: 184 };
  await answer(4, () => {
    const ws = tones.map(x => x.when).sort((a, b) => a - b), bpm = 60 / (ws[1] - ws[0]);
    return t.$$('.stage .quiz-q .choice').map(b => b.textContent).sort((a, b) => Math.abs(BPM[a] - bpm) - Math.abs(BPM[b] - bpm))[0];
  });
  t.check(nextOn(), '5.8 tempo words named by ear');

  // 5.9: question or answer, by where the phrase stops
  t.check(await gotoStep('5.9', 3), '5.9 step 3 opens');
  await answer(4, () => { const ch = heardChords(); return deg(ch[ch.length - 1], ch[0].rootPc) === 7 ? 'Question' : 'Answer'; });
  t.check(nextOn(), '5.9 question and answer phrases told apart');
  t.check(await gotoStep('5.9', 4), '5.9 step 4 opens');
  t.check(t.$('.stage .l5-svg') && /1st and 2nd endings/.test(stage().textContent) && t.$$('.stage .l5-form').length === 2, '5.9 form card shows AABA, verse/chorus and repeat endings');

  // 5.P: the 8-bar piece, grown from a sketch, recorded over the loop
  t.check(await gotoStep('5.P', 2), '5.P step 2 opens');
  t.click(t.$$('.stage [data-g="key"] .choice')[1]); await t.wait(10);
  t.check(t.$$('.l5-bar')[3].textContent.includes('D') && t.$$('.l5-bar')[7].textContent.includes('G'), '5.P G major: bar 4 is D (V), bar 8 is G (I)');
  t.$('#l5-seed').value = 'sSeed'; t.click('.stage [data-act="useseed"]'); await t.wait(10);
  t.check(t.$$('.l5-bar')[0].querySelectorAll('.n').length === 3, '5.P the sketch opens bar 1');
  const pr = t.$('.stage .l5-tempo input'); pr.value = '132'; pr.dispatchEvent(new t.w.Event('input', { bubbles: true }));
  const barS = 4 * 60 / 132;
  t.click('.stage [data-act="rec"]');
  const t0 = performance.now();
  await t.wait((barS + 0.2) * 1000 + 120);
  for (const n of ['B', 'A', 'G', 'A', 'B']) { t.pc(n); await t.wait(250); }
  await t.wait(Math.max(0, (5 * barS + 0.25) * 1000 - (performance.now() - t0)));
  for (const n of ['B', 'C', 'A', 'F♯', 'G']) { t.pc(n); await t.wait(200); }
  t.click('.stage [data-act="rec"]'); await t.wait(30);
  t.check(t.$$('.l5-checks li.ok').length >= 3, '5.P checks pass: 8+ notes, both halves, ends on the home chord');
  t.d.querySelector('#l5-piece-name').value = 'Test piece';
  t.click('.stage [data-act="save"]'); await t.wait(30);
  const sk = stored().sketches[0];
  t.check(nextOn() && sk.name === 'Test piece' && sk.level === 5 && sk.key === 'G major' && sk.bpm === 132 && sk.from === 'sSeed', '5.P saves the piece with key, tempo, level 5 and the sketch it grew from');
  t.check(sk.chords.length === 8 && sk.chords[3].sym === 'D' && sk.chords[7].sym === 'G' && sk.notes.length >= 13 && sk.notes.every(n => n.d > 0), '5.P the piece carries 8 bars of chords and timed notes');

  // review card types: a numeral in a key, and a whole progression from numerals
  t.home(); await t.wait(30);
  const host = d.createElement('div'); d.body.appendChild(host);
  let got = null;
  let clean = M.CARD_TYPES.l5roman(host, { roman: 'IV', key: 'D' }, ok => { got = ok; });
  t.check(host.querySelector('.big-name').textContent === 'IV in D', 'card l5roman shows the numeral, not the chord');
  await playChord('G');
  t.check(got === true, 'card l5roman: G B D is the IV in D');
  clean(); got = null;
  clean = M.CARD_TYPES.l5prog(host, { romans: ['I', 'V', 'vi', 'IV'], key: 'G' }, ok => { got = ok; });
  t.check(host.querySelectorAll('.l5-cell span')[0].textContent === '?', 'card l5prog hides the chord names');
  await playProg(['I', 'V', 'vi', 'IV'], 'G');
  t.check(got === true, 'card l5prog: the loop in G played from numerals');
  clean(); host.remove();

  // Final boss: no skipping; keys only
  t.openUnit('5.B'); await t.wait(40);
  t.next(); await t.wait(40);
  t.check(!t.$('.stage [data-act="skip"]'), 'boss steps cannot be skipped');
  const kn = t.$('.l5-keyname');
  t.check(/^[CGFD] major$/.test(kn.textContent) && t.$$('.l5-prog .l5-cell span').every(s => s.textContent === '?') && !t.$('.stage [data-act="play"]') && t.$('.chord-target .tones').textContent === '', 'boss part 1 shows the key and numerals only');
  await playProg(['I', 'IV', 'V', 'I'], kn.dataset.key);
  t.check(nextOn(), `boss part 1: I–IV–V–I in ${kn.textContent} from numerals`);
  tones = []; t.next(); await t.wait(40);
  await answer(6, () => cadenceOf(heardChords()));
  t.check(nextOn(), 'boss part 2: six cadences named by ear');
  t.next(); await t.wait(40);
  t.check(!t.$('.stage .circle5 .wedge.fam'), 'boss part 3 shows the circle without the numerals');
  await answer(6, numAnswer);
  t.check(nextOn(), 'boss part 3: numbers into chords in three keys');
  t.next(); await t.wait(60);
  t.check(t.$('.done-card .big').textContent === 'Beginner section complete.', 'passing the boss shows “Beginner section complete.”');
  t.check(/everything a beginner needs/.test(t.$('.done-card').textContent), 'the completion screen celebrates what the learner can do');
  t.home(); await t.wait(40);
  t.check(t.$('.panel.grad') && /Beginner section complete/.test(t.$('.panel.grad').textContent), 'home shows the beginner-complete banner');

  // Daily Set at Level 5: a review card, the create prompts, and the cadence ear spark
  t.click('[data-act="daily"]'); await t.wait(300);
  t.click('.stage [data-act="skip"]'); await t.wait(80);
  t.check(/Card 1 of/.test(stage().textContent) && (t.$('.stage .task .prompt') || t.$('.stage .task .choice')), 'Daily Set review renders a Level 5 card');
  t.click('.stage [data-act="skip"]'); await t.wait(60);
  t.click('.stage [data-act="skip"]'); await t.wait(60);
  t.check(/4-bar/.test(t.$('.stage .task .prompt').textContent) && t.$('#motif-name'), 'Daily Set Create uses a Level 5 melody prompt');
  t.click('.stage [data-act="skip"]'); await t.wait(60);
  t.check(t.$('.stage h2').textContent === 'Name the cadence', 'Daily Set ear spark is Level 5’s cadences');
  tones = []; await answer(5, earAnswer);
  t.check(nextOn() && /5 of 5/.test(stage().textContent), 'ear spark: five rounds answered by ear');
  t.click('.stage [data-act="next"]'); await t.wait(60);
  t.check(/1%/.test(t.$('.stage .tag').textContent), 'Daily Set reaches Today’s 1%');
  t.check(M.ChordIn.users === 0, 'every ChordIn.start() was matched by a stop()');
  t.finish();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
