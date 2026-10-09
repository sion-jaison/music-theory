/* Level 2 walkthrough (jsdom): every unit, the main task of each unit driven with the computer keys,
   the full boss with keys only, review cards and the Daily Set at Level 2.
   Ear questions are answered from the notes the app plays (Sound.tone is wrapped to log them). */
const H = require('./helpers');

const RAIN = { id: 'sRain', name: 'Rain on the roof', notes: [{ m: 61, t: 0 }, { m: 63, t: 0.4 }, { m: 66, t: 0.8 }, { m: 63, t: 1.2 }], level: 1, created: '2026-10-01', prompt: '' };
const DUR = { whole: 4, 'dotted half': 3, half: 2, 'dotted quarter': 1.5, quarter: 1, eighth: 0.5, sixteenth: 0.25 };
const ORD = ['2nd', '3rd', '4th', '5th', '6th', '7th', 'octave'];

(async () => {
  const t = await H.load({ unlock: 2, store: { sketches: [RAIN] } });
  const { w, d, wait } = t;
  const M = w.Motif, T = M.Theory;

  /* every tone the app plays (lessons, quizzes and the keys themselves) */
  const tones = [];
  const tone = M.Sound.tone;
  M.Sound.tone = function (m) { tones.push(m); return tone.apply(this, arguments); };

  const $ = sel => d.querySelector('.stage ' + sel);
  const $$ = sel => [...d.querySelectorAll('.stage ' + sel)];
  const fbText = () => $$('.fb').map(e => e.textContent).join(' | ');
  const nextOn = () => !t.nextBtn().disabled;
  const play = name => t.pc(T.pc(name));
  const clickChoice = text => { const c = $$('.choice').find(b => (b.querySelector('b') || b).textContent.trim() === text); if (!c) throw new Error('no choice ' + text + ' in ' + $$('.choice').map(b => b.textContent).join(',')); c.click(); };

  /* staff sprint: read the written note from the staff's label */
  const sprintNote = (root) => /: (\S+)$/.exec((root || d).querySelector('.l2-sprint svg').getAttribute('aria-label'))[1];
  const sprintStaff = (root) => /on the (\w+) staff/.exec((root || d).querySelector('.l2-sprint svg').getAttribute('aria-label'))[1];
  async function sprint(rounds) { const seen = new Set(); for (let i = 0; i < rounds; i++) { seen.add(sprintStaff()); play(sprintNote()); await wait(1080); } return seen; }

  /* "Play mi in G major", "Play degree 5 of D major", "Play the leading tone of F major" */
  function degreePc(text) {
    const key = (/(?:in|of) (\S+) major/.exec(text) || [])[1];
    let k, m;
    if ((m = /Play (do|re|mi|fa|sol|la|ti) in/.exec(text))) k = T.SOLFEGE.indexOf(m[1]);
    else if ((m = /degree (\d)/.exec(text))) k = +m[1] - 1;
    else k = T.DEGREE_NAMES.findIndex(nm => text.includes('the ' + nm + ' of'));
    return T.pc(T.scale(key)[k]);
  }
  /* "Play a 3rd above D" (letters, white keys) */
  function letterPc(text) {
    const m = /Play an? (\S+) above ([A-G])/.exec(text), n = ORD.indexOf(m[1]) + 2;
    return T.pc(T.LETTERS[(T.LETTERS.indexOf(m[2]) + n - 1) % 7]);
  }
  /* "Play a perfect 5th above D" (half steps) */
  function sizePc(text) {
    const m = /Play an? (.+) above ([A-G])/.exec(text), x = T.INTERVALS.find(v => v.name === m[1]);
    return (T.pc(m[2]) + x.semis) % 12;
  }
  async function asked(n, solve) {
    for (let i = 0; i < n; i++) { t.pc(solve($('.l2-ask .q').textContent)); await wait(1480); }
  }
  /* ear quizzes: the interval is the last two tones played */
  async function intervalQuiz(rounds) {
    for (let i = 0; i < rounds; i++) {
      await wait(450);
      const [a, b] = tones.slice(-2), x = T.INTERVALS[b - a];
      clickChoice(x.name); tones.length = 0;
      await wait(1150);
    }
  }
  /* rhythm: read the notes from the notation's label, then tap Space on every clapped note */
  function rhythmOf(svg) {
    const m = /Rhythm in (\d)\/4: (.*)$/.exec(svg.getAttribute('aria-label'));
    const onsets = []; let at = 0;
    m[2].split(', ').forEach(item => item.split(' tied to ').forEach((part, k) => {
      const rest = / rest$/.test(part), len = DUR[part.replace(/ (note|rest)$/, '')];
      if (!rest && k === 0) onsets.push(at);
      at += len;
    }));
    return { meter: +m[1], onsets, beats: at };
  }
  async function clap(root, opts) {
    opts = opts || {};
    const r = rhythmOf(root.querySelector('.notation svg'));
    const spb = 60 / parseInt(root.querySelector('[data-tempo]').textContent, 10);
    const t0 = w.performance.now() / 1000 + 0.3;
    root.querySelector('[data-act="go"]').click();
    const beats = opts.taps || r.onsets;
    for (const b of beats) { await wait((t0 + (r.meter + b) * spb + 0.01) * 1000 - w.performance.now()); t.key(' '); }
    await wait((t0 + (r.meter + Math.ceil(r.beats)) * spb + 0.7) * 1000 - w.performance.now());
    return r;
  }

  /* ---------- every unit renders and adds its review cards ---------- */
  for (const id of ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8', '2.9', '2.P']) {
    t.check(await t.walk(id), `${id} renders every step and finishes`);
    const ids = (M.CARD_DEFS[id] || []).map(c => c.id);
    const store = M.Store.data.cards;
    t.check(ids.length > 0 && ids.every(c => /^l2-/.test(c) && store[c]), `${id} adds its ${ids.length} review card${ids.length > 1 ? 's' : ''}`);
  }
  t.check(M.LEVELS.find(l => l.n === 2).units.map(u => u.id).join(' ') === '2.1 2.2 2.3 2.4 2.5 2.6 2.7 2.8 2.9 2.P 2.B', 'Level 2 has the eleven planned stops in order');

  /* ---------- 2.1: staff sprint in the treble clef ---------- */
  t.openUnit('2.1'); await wait(40);
  t.check(!!$('.nstaff'), '2.1 opens with notes on the staff');
  t.next(); await wait(30); t.next(); await wait(30);
  let n0 = sprintNote();
  t.pc((T.pc(n0) + 1) % 12); await wait(30);
  t.check(/Landmark|landmark|Lines from|Spaces from|staff/.test(fbText()) && !nextOn(), '2.1 a wrong note gets a landmark hint and the note stays');
  play(n0); await wait(30);
  t.check(fbText().indexOf('Right: that’s ' + n0 + ',') === 0, `2.1 feedback names the written note (${fbText().slice(0, 70)}…)`);
  await wait(1080);
  t.key('z'); play(sprintNote()); t.key('x'); await wait(1080);
  t.check($$('.progress-dots span.on').length === 2, '2.1 the right letter in another octave counts');
  await sprint(3);
  t.check(nextOn(), '2.1 read-and-play completes after 5 notes');
  t.next(); await wait(30); t.next(); await wait(30);
  t.click('.stage [data-act="skip"]'); await wait(40);
  t.check(!!$('.timer'), '2.1 staff sprint has a timer');
  await sprint(8);
  t.check(nextOn() && /8 of 8/.test(fbText()), '2.1 staff sprint: 8 of 8 read in time');
  t.next(); await wait(40);
  t.check(!!d.querySelector('.done-card'), '2.1 finishes');

  /* ---------- 2.2: bass clef, then the grand staff ---------- */
  t.openUnit('2.2'); await wait(40);
  t.next(); await wait(30);
  n0 = sprintNote();
  t.pc((T.pc(n0) + 2) % 12); await wait(20);
  t.check(sprintStaff() === 'bass' && /F3|middle C/.test(fbText()), `2.2 a wrong bass note gets a hint from F3 or middle C (${fbText()})`);
  t.click('.stage [data-act="skip"]'); await wait(30);
  t.next(); await wait(30); t.next(); await wait(30);
  t.click('.stage [data-act="skip"]'); await wait(30);
  const staves = await sprint(8);
  t.check(nextOn() && staves.has('treble') && staves.has('bass'), '2.2 grand-staff sprint mixes both staves and completes');
  t.next(); await wait(40);

  /* ---------- 2.3: the recipe, up and down ---------- */
  t.openUnit('2.3'); await wait(40);
  t.next(); await wait(30);
  for (const n of ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C']) { play(n); await wait(15); }
  t.check($$('.stp.on').map(s => s.textContent).join(' ') === 'W W H W W W H' && nextOn(), '2.3 C major up shows W W H W W W H');
  t.next(); await wait(30);
  play('C'); play('A'); await wait(15);
  t.check(/half step down from C/.test(fbText()), '2.3 going down, a wrong note gets a step-down hint');
  for (const n of ['B', 'A', 'G', 'F', 'E', 'D', 'C']) { play(n); await wait(15); }
  t.check($$('.stp.on').map(s => s.textContent).join(' ') === 'H W W W H W W' && nextOn(), '2.3 C major down shows H W W W H W W');
  t.next(); await wait(30);
  t.check(/2-2-1-2-2-2-1/.test($('.body').textContent) && $$('.l2-steps .gp.h').length === 2, '2.3 recipe card shows 2-2-1-2-2-2-1 with two half steps');
  t.next(); await wait(40);

  /* ---------- 2.4: build scales ---------- */
  async function build() {
    const root = /Build (\S+) major/.exec($('.l2-build .prompt').textContent)[1];
    for (const n of T.scale(root).concat([root])) { play(n); await wait(15); }
    return root;
  }
  t.openUnit('2.4'); await wait(40);
  t.next(); await wait(30);
  t.check($$('.l2-build .n.hid').length === 8, '2.4 G major starts with every name hidden');
  await build();
  t.check(nextOn() && /F♯/.test($('.l2-reveal').textContent) && /♯/.test($('.l2-reveal svg').textContent), '2.4 G major built; the staff shows F♯');
  t.next(); await wait(30);
  for (const n of ['F', 'G', 'A', 'B♭']) { play(n); await wait(15); }
  t.check($$('.l2-build .n.ok').map(c => c.textContent).join(' ') === 'F G A B♭' && /B♭, not A♯/.test(fbText()), '2.4 F major: the 4th note is spelled B♭, not A♯');
  for (const n of ['C', 'D', 'E', 'F']) { play(n); await wait(15); }
  t.check(nextOn(), '2.4 F major built');
  t.next(); await wait(30);
  t.check(/♮/.test($('.art').textContent), '2.4 the natural sign is shown');
  t.next(); await wait(30);
  const built = [];
  for (let i = 0; i < 4; i++) { built.push(await build()); await wait(20); if (i < 3) { t.click('.stage [data-act="nextscale"]'); await wait(20); } }
  t.check(nextOn() && built.join(' ') === 'D A B♭ E♭', '2.4 D, A, B♭ and E♭ major built from the recipe');
  t.next(); await wait(30);
  for (let i = 0; i < 4; i++) {
    const m = /the (\d)\D+ note of (\S+) major/.exec($('.quiz-q .prompt').textContent);
    clickChoice(T.scale(m[2])[+m[1] - 1]); await wait(1150);
  }
  t.check(nextOn(), '2.4 spelling quiz: 4 of 4');
  t.next(); await wait(40);

  /* ---------- 2.5: solfège and degrees ---------- */
  t.openUnit('2.5'); await wait(40);
  t.next(); await wait(30);
  t.check($('.notes-strip').textContent.indexOf('doremifasollatido') === 0, '2.5 the G major strip is labelled in solfège');
  for (const n of T.scale('G').concat(['G'])) { play(n); await wait(15); }
  t.check(nextOn(), '2.5 G major sung or played by syllable');
  t.next(); await wait(30);
  t.check(d.querySelectorAll('.kb .key.hint').length > 0 && /leading tone/.test($('.art').textContent), '2.5 degree names table, home chord glowing');
  t.next(); await wait(30);
  const askText = $('.l2-ask .q').textContent;
  t.pc((degreePc(askText) + 1) % 12); await wait(20);
  t.check(/Count up/.test(fbText()), `2.5 a wrong degree gets a count-up hint (“${askText}”)`);
  await asked(6, degreePc);
  t.check(nextOn(), '2.5 six degrees played by name, number and syllable');
  tones.length = 0;
  t.next(); await wait(30);
  for (let i = 0; i < 5; i++) {
    await wait(450);
    const end = ((tones[tones.length - 1] - tones[0]) % 12 + 12) % 12;
    clickChoice({ 0: 'do', 4: 'mi', 7: 'sol' }[end]); tones.length = 0;
    await wait(1150);
  }
  t.check(nextOn(), '2.5 ear: five endings named (do, mi or sol)');
  t.next(); await wait(40);

  /* ---------- 2.6: count the letters ---------- */
  t.openUnit('2.6'); await wait(40);
  t.next(); await wait(30); t.next(); await wait(30);
  t.check(d.querySelectorAll('.kb .key.target').length === 1, '2.6 the starting note glows on the keys');
  play('C'); await wait(20);
  t.check(/starting note/.test(fbText()), '2.6 playing the starting note is not counted as a miss');
  await asked(3, letterPc);
  t.check(nextOn(), '2.6 a 2nd, 3rd and 5th above C');
  t.next(); await wait(30); t.next(); await wait(30);
  const starts = new Set();
  for (let i = 0; i < 2; i++) { starts.add(/above ([A-G])/.exec($('.l2-ask .q').textContent)[1]); t.pc(letterPc($('.l2-ask .q').textContent)); await wait(1480); }
  t.check($$('.progress-dots span.on').length === 2, `2.6 intervals above other white keys (${[...starts].join(', ')})`);
  t.click('.stage [data-act="skip"]'); await wait(30);
  for (let i = 0; i < 5; i++) {
    const m = /: (\S+) and (\S+)$/.exec($('.quiz-q svg').getAttribute('aria-label'));
    clickChoice(ORD[M.Staff.step(m[2]) - M.Staff.step(m[1]) - 1]); await wait(1150);
  }
  t.check(nextOn(), '2.6 five intervals read on the staff');
  t.next(); await wait(40);

  /* ---------- 2.7: sizes and song anchors ---------- */
  t.openUnit('2.7'); await wait(40);
  t.next(); await wait(30);
  tones.length = 0;
  d.querySelector('.stage [data-s="7"]').click();
  t.check(tones.join(' ') === '60 67' && $$('.l2-itbl tbody tr').length === 12, '2.7 the interval table plays C up a perfect 5th (two notes only)');
  t.next(); await wait(30);
  await asked(5, sizePc);
  t.check(nextOn(), '2.7 five intervals measured in half steps');
  tones.length = 0;
  t.next(); await wait(30);
  t.check($$('.choice small').length === 4, '2.7 every option carries its song anchor');
  await intervalQuiz(6);
  t.check(nextOn(), '2.7 six intervals named by ear');
  t.next(); await wait(40);

  /* ---------- 2.8: 3/4, dots and ties ---------- */
  t.openUnit('2.8'); await wait(40);
  t.check(/3\/4/.test($('.notation svg').getAttribute('aria-label')), '2.8 opens in 3/4');
  t.next(); await wait(30);
  for (let i = 0; i < 3; i++) {
    const r = await clap(d.querySelector('.stage'));
    t.check(r.meter === 3 && $$('.notation .ok').length === r.onsets.length, `2.8 clap-back in 3/4, rhythm ${i + 1}: every clap landed`);
    await wait(1700);
  }
  t.check(nextOn(), '2.8 three 3/4 rhythms clapped back');
  t.next(); await wait(30);
  const syl = $$('.notation .syl').map(s => s.textContent).join(' ');
  t.check(syl === 'ta-a-a ta-i ti ta ta', `2.8 dotted half and dotted quarter syllables (${syl})`);
  t.next(); await wait(30);
  t.check(!!$('.notation .l2tie') && $$('.notation .syl').map(s => s.textContent).join(' ') === 'ta ta -a ta', '2.8 a tie is drawn and said ta ta -a ta');
  t.next(); await wait(40);
  t.check(!!$('[data-act="go"]'), '2.8 dots-and-ties clap-back opens');
  t.click('.stage [data-act="skip"]'); await wait(40);

  /* a clapped tie is caught and explained */
  const host = d.createElement('div'); d.body.appendChild(host);
  let res = null;
  const clean = M.Tasks.rhythmEcho(host, { patterns: ['q q_q q'], rounds: 1, bpm: 150 }, (ok, r) => { res = r; });
  await clap(host, { taps: [0, 1, 2, 3] });
  t.check(!res && /tie makes one sound/.test(host.querySelector('.fb').textContent), '2.8 clapping a tied note fails with a tie hint');
  await clap(host);
  t.check(res && res.fails === 1, '2.8 holding the tie passes');
  clean(); host.remove();

  /* ---------- 2.9: eighth rests and sixteenths ---------- */
  t.openUnit('2.9'); await wait(40);
  t.check($$('.notation .syl').map(s => s.textContent).join(' ') === 'ta ti ti ti ka ti ka ta' && $$('.notation rect').length >= 3, '2.9 sixteenths are beamed and said ti-ka-ti-ka');
  t.next(); await wait(30);
  t.check(/eighth rest/.test($('.notation svg').getAttribute('aria-label')) && $$('.notation .l2cnt').map(c => c.textContent).join('') === '1234&&', '2.9 eighth rests with 1 & 2 & counting');
  t.next(); await wait(30);
  t.click('.stage [data-act="skip"]'); await wait(30);
  t.next(); await wait(30);
  for (let i = 0; i < 3; i++) {
    const r = await clap(d.querySelector('.stage'));
    t.check(r.onsets.length >= 7 && $$('.notation .ok').length === r.onsets.length, `2.9 sixteenths at 60 BPM, rhythm ${i + 1}: every clap landed`);
    await wait(1700);
  }
  t.check(nextOn(), '2.9 three sixteenth rhythms clapped back');
  t.next(); await wait(40);

  /* ---------- 2.P: grow the motif into a phrase ---------- */
  t.openUnit('2.P'); await wait(40);
  t.next(); await wait(30); t.next(); await wait(30);
  t.check($$('.l2-sk').length === 2, '2.P lists the sketch and Start fresh');
  t.click('.stage .l2-sk[data-id="sRain"]'); await wait(20);
  t.check(/half step/.test($('.l2-from').textContent), '2.P a black-key motif is moved a half step onto white keys');
  t.click('.stage [data-act="use"]'); await wait(20);
  t.check($('.notes-strip').textContent === 'DEGE', '2.P the motif becomes the opening: D E G E');
  t.click('.stage [data-act="rec"]');
  play('F'); play('E'); t.pc(1); play('D'); await wait(20);
  t.check($$('.notes-strip .n').length === 7, '2.P recording appends to the opening and skips the black key');
  t.click('.stage [data-act="save"]'); await wait(20);
  t.check(/unfinished/.test(fbText()) && !nextOn(), '2.P a phrase ending on D (re) is not saved');
  play('C'); await wait(20);
  t.check(/Ends on C \(do\)/.test($('.l2-end').textContent), '2.P the ending reads C (do)');
  d.querySelector('#l2-phrase-name').value = 'Rain comes home';
  t.click('.stage [data-act="save"]'); await wait(20);
  const sk = M.Store.data.sketches[0];
  t.check(nextOn() && sk.name === 'Rain comes home' && sk.level === 2 && sk.from === 'sRain' && sk.key === 'C' && sk.notes.length === 8 && sk.notes[7].m % 12 === 0, '2.P phrase saved: level 2, grown from the motif, in C, ending on do');
  t.next(); await wait(40);

  /* ---------- 2.B: the boss, keys only ---------- */
  t.openUnit('2.B'); await wait(40);
  t.next(); await wait(40);
  t.check(!d.querySelector('.stage [data-act="skip"]'), 'boss steps cannot be skipped');
  const both = await sprint(8);
  t.check(nextOn() && both.has('treble') && both.has('bass') && /Part 1 passed/.test(fbText()), 'boss part 1: 8 notes across both staves read in time');
  t.next(); await wait(40);
  let root = /Play (\S+) major/.exec($('.l2-st .prompt').textContent)[1];
  for (let i = 0; i < 3; i++) { t.pc((T.pc(root) + 1) % 12); await wait(10); }
  for (const n of T.scale(root).concat([root])) { play(n); await wait(15); }
  t.check(!nextOn() && !$('[data-retry]').hidden && $$('.l2-st .n.hid').length === 0, `boss part 2: three wrong notes in ${root} major mean Try again`);
  t.click('.stage [data-act="retry"]'); await wait(20);
  const root2 = /Play (\S+) major/.exec($('.l2-st .prompt').textContent)[1];
  t.check(root2 !== root && $$('.l2-st .n.hid').length === 8, 'boss part 2: Try again brings a new scale, names hidden');
  for (const n of T.scale(root2).concat([root2])) { play(n); await wait(15); }
  t.check(nextOn() && /Part 2 passed/.test(fbText()), `boss part 2: ${root2} major played with the names hidden`);
  tones.length = 0;
  t.next(); await wait(40);
  await intervalQuiz(6);
  t.check(nextOn() && /Part 3 passed/.test(fbText()), 'boss part 3: six intervals named by ear');
  t.next(); await wait(60);
  const doneText = d.querySelector('.done-card').textContent;
  const hasL3 = M.LEVELS.some(l => l.n === 3);
  t.check(M.Store.data.units['2.B'].done && (hasL3 ? /Level 2 passed/.test(doneText) && /Level 3/.test(doneText) : /Level 2 passed|Beginner section complete/.test(doneText)), hasL3 ? 'boss passed: Level 2 passed, Level 3 opens' : 'boss passed (Level 3 is not in this build, so the level is the last one)');

  /* ---------- Daily Set at Level 2: review cards, create, ear spark ---------- */
  const due = { box: 0, due: '2000-01-01', n: 0, ok: 0 };
  const t2 = await H.load({ unlock: 2, store: { cards: { 'l2-treble-read': Object.assign({}, due), 'l2-degree-play': Object.assign({}, due), 'l2-spell': Object.assign({}, due), 'l2-clap-dot': Object.assign({}, due) } } });
  const M2 = t2.w.Motif, d2 = t2.d;
  const tones2 = [];
  const tone2 = M2.Sound.tone;
  M2.Sound.tone = function (m) { tones2.push(m); return tone2.apply(this, arguments); };
  const s2 = sel => d2.querySelector('.stage ' + sel);
  t2.click('[data-act="daily"]'); await t2.wait(300);
  t2.click('.stage [data-act="skip"]'); await t2.wait(60);
  t2.check(/Card 1 of 4/.test(s2('.task').textContent), 'Daily Set review shows the four due Level 2 cards');
  const kinds = [];
  for (let i = 0; i < 4; i++) {
    if (s2('.l2-sprint')) { kinds.push('staff'); t2.pc(T.pc(sprintNote(d2))); }
    else if (s2('.l2-ask')) { kinds.push('ask'); t2.pc(degreePc(s2('.l2-ask .q').textContent)); }
    else if (s2('.notation')) { kinds.push('clap'); const t0 = t2.w.performance.now(); await (async () => { const r = rhythmOf(s2('.notation svg')), spb = 60 / 72, start = t0 / 1000 + 0.3; s2('[data-act="go"]').click(); for (const b of r.onsets) { await t2.wait((start + (r.meter + b) * spb + 0.01) * 1000 - t2.w.performance.now()); t2.key(' '); } await t2.wait((start + (r.meter + 4) * spb + 0.7) * 1000 - t2.w.performance.now()); })(); }
    else { kinds.push('spell'); const m = /the (\d)\D+ note of (\S+) major/.exec(s2('.prompt').textContent); const c = [...d2.querySelectorAll('.stage .choice')].find(b => b.textContent === T.scale(m[2])[+m[1] - 1]); c.click(); }
    await t2.wait(1000);
  }
  const graded = ['l2-treble-read', 'l2-degree-play', 'l2-spell', 'l2-clap-dot'].map(id => M2.Store.data.cards[id]);
  t2.check(kinds.slice().sort().join(' ') === 'ask clap spell staff' && graded.every(c => c.n === 1 && c.box === 1), `Daily Set: staff, play-the-degree, spelling and clap cards each answered right (${kinds.join(', ')})`);
  t2.check(!s2('[data-act="next"]').disabled, 'Daily Set review step completes');
  t2.click('.stage [data-act="next"]'); await t2.wait(60);
  t2.check(/2\.1/.test(s2('.task').textContent) || /Notes on the treble staff/.test(d2.querySelector('.stage h2').textContent), 'Daily Set new bite offers 2.1');
  t2.click('.stage [data-act="skip"]'); await t2.wait(60);
  const prompts = M2.LEVELS.find(l => l.n === 2).create.prompts;
  t2.check(prompts.some(p => s2('.prompt').textContent === p), 'Daily Set create uses a Level 2 C major prompt');
  t2.click('.stage [data-act="rec"]'); t2.pc(6); await t2.wait(20);
  t2.check(/not in C major/.test(s2('.fb').textContent), 'Daily Set create keeps to C major');
  t2.click('.stage [data-act="skip"]'); await t2.wait(60);
  t2.check(d2.querySelector('.stage h2').textContent === 'Name the interval', 'Daily Set ear spark is Level 2’s interval quiz');
  tones2.length = 0;
  for (let i = 0; i < 5; i++) {
    await t2.wait(450);
    const [a, b] = tones2.slice(-2), x = T.INTERVALS[b - a];
    [...d2.querySelectorAll('.stage .choice')].find(c => c.querySelector('b').textContent === x.name).click(); tones2.length = 0;
    await t2.wait(1150);
  }
  const day = M2.Store.day();
  t2.check(!s2('[data-act="next"]').disabled && day.earN === 5 && day.earOk === 5, 'Daily Set ear spark: 5 of 5 intervals, recorded for Today’s 1%');
  if (t2.errors.length) t.errors.push(...t2.errors);
  if (t2.failures) process.exitCode = 1;
  t.finish();
})().catch(e => { console.log('CRASH', e && e.stack); process.exit(1); });
