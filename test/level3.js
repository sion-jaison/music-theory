/* Level 3 walkthrough: every unit renders, each unit's main task is driven with the computer keys,
   the ear quizzes are answered by listening (the test records the notes the app plays and identifies the chord),
   the boss is passed with keys only, review cards unlock, and the Daily Set shows Level 3 content. */
const H = require('./helpers');

const L2_PHRASE = {
  id: 'sk-l2', name: 'My phrase', level: 2, key: 'G', bpm: 120, created: '2026-01-01', prompt: 'Phrase in G',
  notes: [67, 69, 71, 74, 72, 71, 69, 67].map((m, i) => ({ m, t: i * 0.5, d: 0.45 }))
};

(async () => {
  const t = await H.load({ unlock: 3, store: { sketches: [L2_PHRASE] } });
  const M = t.w.Motif, Th = M.Theory, d = t.d;

  /* everything the app plays goes through Sound.tone: record it so ear questions can be answered by "listening" */
  const rec = [];
  const tone = M.Sound.tone;
  M.Sound.tone = function (m) { rec.push(m); return tone.apply(this, arguments); };
  const WORD = { maj: 'Major', min: 'Minor', dim: 'Diminished', aug: 'Augmented' };
  const heard = notes => { const pcs = [...new Set(notes.map(m => m % 12))]; return Th.identify(pcs, Math.min.apply(null, notes) % 12)[0] || null; };

  const nextOn = () => !t.nextBtn().disabled;
  const marks = () => t.$$('.kb .key.hint, .kb .key.target, .kb .key.found').length;
  const tag = () => (t.$('.stage .tag') || {}).textContent || '';
  /* the chord the current playChords step asks for, read from the screen */
  function target() {
    const lab = t.$('.stage .chord-target .big-name').textContent.trim();
    let m = /^(\S+) in ([A-G][♯♭]?)$/u.exec(lab);
    if (m) return Th.romanChord(m[1], m[2]).sym;
    m = /^on ([A-G])$/.exec(lab);
    if (m) return Th.diatonic('C').find(c => c.root === m[1]).sym;
    if (/^[1-7]$/.test(lab)) return Th.diatonic('C')[+lab - 1].sym;
    return lab;
  }
  /* tap a chord on the computer keys: a bass note goes an octave down (Z … X) so it is lowest */
  async function play(sym) {
    const T = M.chordTarget(sym);
    let pcs = T.pcs.slice();
    if (T.bassPc != null) { t.key('z'); t.pc(T.bassPc); t.key('x'); pcs = pcs.filter(p => p !== T.bassPc); }
    for (const pc of pcs) t.pc(pc);
    await t.wait(30);
  }
  /* play every chord of the current playChords/buildChords step */
  async function driveChords() {
    const n = t.$$('.stage .progress-dots span').length, seen = [];
    for (let k = 0; k < n; k++) { const s = target(); seen.push(s); await play(s); await t.wait(1000); }
    return seen;
  }
  /* answer a quiz by what was played: decide(notes) returns the start of the right option's text */
  async function answerQuiz(rounds, decide) {
    let ok = 0;
    for (let r = 0; r < rounds; r++) {
      await t.wait(420);
      const label = decide(rec.slice(), r);
      const btn = t.$$('.stage .quiz-q .choice').find(b => b.textContent.trim().startsWith(label));
      if (!btn) { t.check(false, `quiz option “${label}” exists (${t.$$('.stage .quiz-q .choice').map(b => b.textContent).join(' | ')})`); return ok; }
      rec.length = 0; btn.click(); await t.wait(30);
      if (btn.classList.contains('right')) ok++;
      await t.wait(1150);
    }
    return ok;
  }
  const quality = notes => { const id = heard(notes); return id ? WORD[id.q] : '?'; };
  async function toQuiz() { rec.length = 0; t.next(); }
  function leaveCheck(id) {
    t.check(!!t.$('.done-card'), `${id} finishes and shows the completion card`);
    t.check(M.ChordIn.users === 0 && marks() === 0, `${id} leaves no chord listener or key marks behind`);
  }

  /* ---------- 3.1 ---------- */
  t.openUnit('3.1'); await t.wait(40);
  t.check(/One, two, three/.test(t.$('.stage h2').textContent) && t.$('.stage .nstaff'), '3.1 opens with a sound card and a staff picture');
  t.next(); await t.wait(40);
  t.check(M.ChordIn.users === 1 && t.$('.l3-meter .chroma') && /12 note names/.test(t.$('.l3-how').textContent), '3.1 chord namer starts chord input and shows the 12-bar meter with an explanation');
  t.check(t.$('.l3-fig svg.l3-g') !== null, '3.1 shows the open C guitar box');
  t.pc('C'); t.pc('E'); t.pc('G'); await t.wait(40);
  t.check(t.$('.l3-namer .big-name').textContent === 'C' && t.$('.l3-namer.hit') && /C major/.test(t.$('.l3-namer-sub').textContent), '3.1 the app names C E G as C major');
  t.check(nextOn(), '3.1 playing C E G completes the step');
  t.check(t.$$('.l3-meter .chroma i').filter(i => /scaleY\(1\)/.test(i.style.transform)).length === 3, '3.1 tapped notes light three of the 12 bars');
  await t.wait(1700);
  t.pc('D'); t.pc('F'); t.pc('A'); await t.wait(40);
  t.check(t.$('.l3-namer .big-name').textContent === 'Dm', '3.1 keeps naming chords afterwards (D F A → Dm)');
  t.next(); await t.wait(40);
  t.click('.stage [data-act="show"]'); await t.wait(10);
  t.check(/F · A · C/.test(t.$('.stage .tones').textContent) && marks() === 3, '3.1 “Show me the notes” reveals F A C and lights three keys');
  await driveChords();
  t.check(nextOn(), '3.1 skip-a-key triads on F, G, D, A recognized from keys');
  t.next(); await t.wait(40);
  t.check(/Skip a key, skip a key/.test(t.$('.stage .hook').textContent), '3.1 names the “skip a key” hook');
  t.next(); await t.wait(40);
  leaveCheck('3.1');

  /* ---------- 3.2 ---------- */
  t.openUnit('3.2'); await t.wait(40);
  t.next(); await t.wait(40);
  t.check(/C · E · G/.test(t.$('.stage .tones').textContent), '3.2 C major shows its notes');
  await driveChords();
  t.check(nextOn(), '3.2 C then C minor played');
  await toQuiz(); await t.wait(10);
  const mm = await answerQuiz(5, quality);
  t.check(mm === 5, `3.2 major/minor ear quiz plays what it asks (${mm}/5 by ear)`);
  t.check(nextOn(), '3.2 ear quiz completes');
  t.next(); await t.wait(40);
  t.click(t.$$('.stage .l3-chips .choice')[3]); await t.wait(10);
  t.check(/D minor/.test(t.$('.stage .l3-info').textContent) && /3 \+ 4/.test(t.$('.stage .l3-info').textContent) && marks() === 3 && t.$('.stage .l3-ex-staff svg'), '3.2 explorer shows Dm on staff, keys and as text with its recipe');
  t.check(/Move the middle/.test(t.$('.stage .hook').textContent), '3.2 names the “move the middle” hook');
  t.next(); await t.wait(40);
  const built = await driveChords();
  t.check(nextOn() && built.join(' ') === 'D Dm A Am E Em', '3.2 builds D Dm A Am E Em from keys');
  t.next(); await t.wait(40);
  await driveChords();
  t.check(nextOn(), '3.2 builds F, Fm, B♭, F♯m');
  t.next(); await t.wait(40);
  leaveCheck('3.2');

  /* ---------- 3.3 ---------- */
  t.openUnit('3.3'); await t.wait(40);
  t.next(); await t.wait(40);
  t.check(/3 \+ 3/.test(t.$('.stage table').textContent) && /4 \+ 4/.test(t.$('.stage table').textContent) && /C°/.test(t.$('.stage table').textContent), '3.3 recipe table lists 3 + 3 and 4 + 4 with ° and +');
  t.next(); await t.wait(40);
  t.check(t.$('.stage .chord-target .big-name').textContent === 'C°', '3.3 asks for C°');
  await driveChords();
  t.check(nextOn(), '3.3 diminished and augmented triads played');
  await toQuiz(); await t.wait(10);
  const q4 = await answerQuiz(6, quality);
  t.check(q4 === 6 && nextOn(), `3.3 four-quality ear quiz completes (${q4}/6 by ear)`);
  t.next(); await t.wait(40);
  leaveCheck('3.3');

  /* ---------- 3.4 ---------- */
  t.openUnit('3.4'); await t.wait(40);
  t.next(); await t.wait(40);
  t.next(); await t.wait(40);
  await driveChords();
  t.check(nextOn(), '3.4 C, Cm, C°, C+ read and played');
  t.next(); await t.wait(40);
  const boxes = t.$$('.stage .l3-gbox svg');
  t.check(boxes.length === 8 && boxes.every(b => b.querySelectorAll('.str').length === 6 && b.querySelectorAll('.fr').length === 4 && b.querySelector('.nut') && /on guitar/.test(b.getAttribute('aria-label'))), '3.4 eight guitar boxes, each with six strings, a nut, four frets and a label');
  const am = t.$$('.stage .l3-gbox').find(b => /A minor/.test(b.getAttribute('aria-label')));
  t.check(am.querySelectorAll('.dot').length === 3 && am.querySelectorAll('.open').length === 2 && /×/.test(am.textContent), '3.4 Am box: three finger dots, two open strings, one muted string');
  t.click(am); await t.wait(20);
  t.check(marks() === 3 && /A C E/.test(t.$('.stage .l3-gdetail').textContent) && t.$('.stage .l3-gdetail .l3-keys .on'), '3.4 tapping Am shows its piano shape on the dock and in a picture');
  t.next(); await t.wait(40);
  const six = await driveChords();
  const qs6 = six.map(s => Th.parseChord(s).q);
  t.check(nextOn() && six.length === 6 && ['maj', 'min', 'dim', 'aug'].every(q => qs6.indexOf(q) >= 0), `3.4 six named chords with all four qualities played (${six.join(' ')})`);
  t.next(); await t.wait(40);
  leaveCheck('3.4');

  /* ---------- 3.5 ---------- */
  t.openUnit('3.5'); await t.wait(40);
  t.next(); await t.wait(40);
  t.check(/Same chord, different bottom/.test(t.$('.stage .hook').textContent), '3.5 names the “same chord, different bottom” hook');
  t.next(); await t.wait(40);
  await play('C'); await t.wait(1000);
  t.pc('C'); t.pc('E'); t.pc('G'); await t.wait(30);
  t.check(/put E at the bottom/.test(t.$('.stage .fb').textContent), '3.5 root position is not C/E, and the hint says to put E at the bottom');
  await t.wait(1700);
  await play('C/E'); await t.wait(1000);
  await play('C/G'); await t.wait(1000);
  t.check(nextOn(), '3.5 C, C/E and C/G played with the right bass notes');
  t.next(); await t.wait(40);
  const inv = await driveChords();
  t.check(nextOn() && inv.every(s => s.indexOf('/') > 0), '3.5 slash chords on other roots played');
  await toQuiz(); await t.wait(10);
  const posOk = await answerQuiz(4, n => ['Root', 'First', 'Second'][heard(n).inversion]);
  t.check(posOk === 4 && nextOn(), `3.5 inversion quiz: the staff and the sound agree (${posOk}/4)`);
  t.next(); await t.wait(40);
  leaveCheck('3.5');

  /* ---------- 3.6 ---------- */
  t.openUnit('3.6'); await t.wait(40);
  t.next(); await t.wait(40);
  const dia = await driveChords();
  t.check(nextOn() && dia.join(' ') === 'C Dm Em F G Am B°', '3.6 triads on every note of C: C Dm Em F G Am B°');
  t.next(); await t.wait(40);
  t.check(/M m m M M m d/.test(t.$('.stage .hook').textContent) && /1-4-5/.test(t.$('.stage .hook').textContent), '3.6 names M m m M M m d and the Big Three 1-4-5');
  t.next(); await t.wait(40);
  t.click('.stage [data-act="skip"]'); await t.wait(40);
  await driveChords();
  t.check(nextOn(), '3.6 the Big Three of C played');
  t.next(); await t.wait(40);
  leaveCheck('3.6');

  /* ---------- 3.7 ---------- */
  t.openUnit('3.7'); await t.wait(40);
  t.next(); await t.wait(40);
  t.check(/D/.test(t.$('.stage table').textContent) && t.$$('.stage table tbody tr').length === 3, '3.7 numeral table shows C, G and F');
  t.next(); await t.wait(40);
  await driveChords();
  t.check(nextOn(), '3.7 I, IV, V, vi in C played');
  t.next(); await t.wait(40);
  const labs = [];
  for (let k = 0; k < 6; k++) { labs.push(t.$('.stage .chord-target .big-name').textContent); await play(target()); await t.wait(1000); }
  t.check(nextOn() && labs.every(l => / in [GF]$/.test(l)), `3.7 numerals in G and F played (${labs.join(', ')})`);
  t.next(); await t.wait(40);
  t.click('.stage [data-act="skip"]'); await t.wait(40);
  leaveCheck('3.7');

  /* ---------- 3.8 ---------- */
  t.openUnit('3.8'); await t.wait(40);
  t.next(); await t.wait(40);
  t.check(/4 \+ 3 \+ 4/.test(t.$('.stage table').textContent) && /4 \+ 3 \+ 3/.test(t.$('.stage table').textContent) && /3 \+ 4 \+ 3/.test(t.$('.stage table').textContent), '3.8 table lists maj7, 7 and m7 recipes');
  t.next(); await t.wait(40);
  await driveChords();
  t.check(nextOn(), '3.8 Cmaj7, C7, Cm7 played as four-note chords');
  t.next(); await t.wait(40);
  const v7 = await driveChords();
  t.check(nextOn() && v7.join(' ') === 'G7 D7 C7', '3.8 V7 in C, G and F: G7 D7 C7');
  await toQuiz(); await t.wait(10);
  const sev = await answerQuiz(6, (n, r) => { const id = heard(n); return r < 3 ? (id.q.length > 3 || id.q === '7' || id.q === 'm7' ? 'Seventh' : 'Triad') : (id.q === 'maj7' ? 'maj7' : '7'); });
  t.check(sev === 6 && nextOn(), `3.8 triad-or-7th and maj7-or-7 ear quiz (${sev}/6)`);
  t.next(); await t.wait(40);
  leaveCheck('3.8');

  /* ---------- 3.9 ---------- */
  t.openUnit('3.9'); await t.wait(40);
  t.next(); await t.wait(40);
  t.next(); await t.wait(40);
  async function driveSeq() { for (const c of t.$$('.stage .notes-strip .n')) { t.pc(c.textContent.trim()); await t.wait(5); } await t.wait(20); }
  t.check(t.$$('.stage .notes-strip .n').map(c => c.textContent).join(' ') === 'F A C F G B D G A C E A', '3.9 arpeggios of F, G and Am, 1-3-5-8');
  await driveSeq();
  t.check(nextOn(), '3.9 arpeggios played');
  t.next(); await t.wait(40);
  t.check(t.$$('.stage .notes-strip .n').slice(0, 4).map(c => c.textContent).join(' ') === 'C G E G', '3.9 Alberti starts C G E G (1-5-3-5)');
  await driveSeq();
  t.check(nextOn(), '3.9 Alberti pattern played');
  t.next(); await t.wait(40);
  t.click('.stage [data-act="skip"]'); await t.wait(40);
  leaveCheck('3.9');

  /* ---------- 3.H ---------- */
  t.openUnit('3.H'); await t.wait(40);
  t.next(); await t.wait(40);
  t.check(/D is in V \(G\)/.test(t.$('.stage .body').textContent), '3.H explains which of I, IV, V hold each note of C');
  t.next(); await t.wait(40);
  const sel = t.$('#l3-sk');
  t.check(sel.options.length === 2 && /My phrase/.test(sel.options[sel.selectedIndex].textContent), '3.H picks the Level 2 phrase first and offers the example too');
  t.check(/G major/.test(t.$('.l3-key').textContent) && t.$$('.l3-bar').length === 2, '3.H uses the phrase’s key (G) and splits it into 2 bars');
  t.check(t.$$('.l3-bar')[0].querySelectorAll('.l3-opt')[1].textContent.includes('C') && t.$$('.l3-bar')[0].querySelectorAll('.l3-opt')[2].textContent.includes('D'), '3.H offers I, IV, V transposed to G: G, C, D');
  t.check(t.$('[data-act="save"]').disabled, '3.H save waits for a chord in every bar');
  for (let k = 0; k < 2; k++) { t.click(t.$$('.l3-bar')[k].querySelector('.l3-opt.fits')); await t.wait(10); }
  t.click('[data-act="play"]'); await t.wait(10);
  t.check(!t.$('[data-act="save"]').disabled, '3.H every bar has a chord');
  t.d.querySelector('#l3-hname').value = 'Phrase with chords';
  t.click('[data-act="save"]'); await t.wait(20);
  const sk = M.Store.data.sketches[0];
  t.check(sk.level === 3 && sk.from === 'sk-l2' && sk.chords.length === 2 && sk.chords.every(c => ['G', 'C', 'D'].indexOf(c.sym) >= 0 && c.d > 0) && sk.key === 'G' && sk.name === 'Phrase with chords', `3.H saves a level-3 sketch grown from the phrase (${sk.chords.map(c => c.sym + '@' + c.t).join(' ')})`);
  t.check(nextOn(), '3.H completes after saving');
  sel.value = '1'; sel.dispatchEvent(new t.w.Event('change')); await t.wait(10);
  t.check(t.$$('.l3-bar').length === 4 && /C major/.test(t.$('.l3-key').textContent), '3.H example phrase: 4 bars in C');
  t.click('[data-act="suggest"]'); await t.wait(10);
  const picks = t.$$('.l3-bar').map(b => (b.querySelector('.l3-opt[aria-pressed="true"]') || {}).textContent || '');
  t.check(picks.length === 4 && picks[2].startsWith('IV') && picks[3].startsWith('I'), `3.H suggestions contain each bar’s main note (${picks.map(p => p.replace(/\s+/g, ' ')).join(' | ')})`);
  t.click(t.$('.l3-nbars [data-n="2"]')); await t.wait(10);
  t.check(t.$$('.l3-bar').length === 2, '3.H bar count can change');
  t.next(); await t.wait(40);
  leaveCheck('3.H');

  /* ---------- every unit renders every step ---------- */
  for (const id of ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8', '3.9', '3.H']) {
    t.check(await t.walk(id), `${id} walks through every step`);
  }
  t.check(M.ChordIn.users === 0, 'walking through units leaves chord input stopped');

  /* ---------- boss ---------- */
  t.openUnit('3.B'); await t.wait(40);
  t.next(); await t.wait(40);
  t.check(!t.$('.stage [data-act="skip"]') && t.$('.stage .timer'), 'boss: no skipping, and part 1 is timed');
  const b1 = await driveChords();
  t.check(nextOn() && b1.length === 6, `boss part 1: six named triads played from keys (${b1.join(' ')})`);
  await toQuiz(); await t.wait(10);
  const b2 = await answerQuiz(8, quality);
  t.check(b2 === 8 && nextOn(), `boss part 2: eight qualities named by ear (${b2}/8)`);
  t.next(); await t.wait(40);
  const b3 = [];
  for (let k = 0; k < 4; k++) { b3.push(t.$('.stage .chord-target .big-name').textContent); await play(target()); await t.wait(1000); }
  t.check(nextOn() && b3.every(l => / in [GF]$/.test(l)), `boss part 3: four numerals played (${b3.join(', ')})`);
  t.next(); await t.wait(60);
  const big = (t.$('.done-card .big') || {}).textContent || '';
  t.check(/Level 3 passed|Beginner section complete/.test(big), `boss finish reports “${big}”`);
  t.check(M.Store.data.units['3.B'] && M.Store.data.units['3.B'].done, 'boss is stored as passed');

  /* ---------- review cards ---------- */
  const defs = Object.keys(M.CARD_DEFS).filter(k => /^3\./.test(k)).reduce((a, k) => a.concat(M.CARD_DEFS[k]), []);
  const counts = ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8', '3.9'].map(u => (M.CARD_DEFS[u] || []).length);
  t.check(counts.every(n => n >= 2 && n <= 8), `every regular unit adds 2–8 cards (${counts.join(', ')})`);
  t.check(defs.every(c => /^l3-/.test(c.id)) && new Set(defs.map(c => c.id)).size === defs.length, 'card ids are unique and start with l3-');
  t.check(defs.every(c => M.Store.data.cards[c.id]), `all ${defs.length} Level 3 cards unlocked`);
  const host = d.createElement('div'); d.body.appendChild(host);
  let rendered = 0, played = 0;
  for (const c of defs) {
    let res = null;
    const clean = M.CARD_TYPES[c.type](host, c, ok => { res = ok; });
    if (host.querySelector('.choice, .chord-target, .notes-strip')) rendered++;
    if (c.type === 'chord' || c.type === 'l3roman') { await play(target2(host)); await t.wait(20); if (res === true) played++; }
    if (c.type === 'l3arp') {
      const m = /Arpeggiate (\S+):/.exec(host.querySelector('.prompt').textContent), ns = Th.chordNotes(Th.parseChord(m[1]).root, Th.parseChord(m[1]).q);
      for (const n of ns.concat([ns[0]])) t.pc(n); await t.wait(10); if (res === true) played++;
    }
    if (typeof clean === 'function') clean();
    M.ChordIn.clear();
    await t.wait(20);
  }
  function target2(h) {
    const lab = h.querySelector('.chord-target .big-name').textContent.trim();
    const m = /^(\S+) in ([A-G][♯♭]?)$/u.exec(lab);
    return m ? Th.romanChord(m[1], m[2]).sym : lab;
  }
  const playable = defs.filter(c => c.type === 'chord' || c.type === 'l3roman' || c.type === 'l3arp').length;
  t.check(rendered === defs.length, `every Level 3 card renders (${rendered}/${defs.length})`);
  t.check(played === playable, `every playable card accepts the right chord or arpeggio from keys (${played}/${playable})`);
  t.check(M.ChordIn.users === 0 && marks() === 0, 'cards clean up chord input and marks');
  host.remove();

  /* ---------- Daily Set ---------- */
  /* passing the boss made Level 4 current (when it exists); set the boss aside so the Daily Set is a Level 3 learner's */
  const bossRecord = M.Store.data.units['3.B']; delete M.Store.data.units['3.B'];
  t.check(Object.keys(M.Store.data.cards).every(id => /^l3-/.test(id)), 'only Level 3 cards are in this deck');
  t.home(); await t.wait(20);
  t.click('[data-act="daily"]'); await t.wait(80);
  t.click('.stage [data-act="skip"]'); await t.wait(60);
  t.check(/Card 1 of/.test(t.$('.stage').textContent) && t.$('.stage .choice, .stage .chord-target, .stage .notes-strip'), 'Daily Set review renders a Level 3 card');
  t.click('.stage [data-act="skip"]'); await t.wait(40);
  t.click('.stage [data-act="skip"]'); await t.wait(40);
  const prompt = t.$('.stage .prompt').textContent;
  t.check(/Alberti|arpeggio|Arpeggio|notes of|Use only|Use just|Make a motif from/.test(prompt), `Daily Set Create gives a chord-tone prompt (“${prompt}”)`);
  t.click('.stage [data-act="rec"]');
  let rejected = 0;
  for (let pc = 0; pc < 12; pc++) { t.pc(pc); if (/is not in/.test(t.$('.stage .fb').textContent)) rejected++; t.$('.stage .fb').textContent = ''; }
  await t.wait(20);
  t.check(rejected === 9, `Daily Set Create rejects the 9 notes outside the chord (${rejected})`);
  t.check(t.$$('.stage .notes-strip .n').length === 3, `motif kept only the three chord tones (${t.$$('.stage .notes-strip .n').map(n => n.textContent).join(' ')})`);
  rec.length = 0;
  t.click('.stage [data-act="skip"]'); await t.wait(40);
  t.check(t.$('.stage h2').textContent === 'Chord quality', 'Daily Set ear spark is the Level 3 chord quality quiz');
  t.check(t.$$('.stage .quiz-q .choice').length === 4, 'after unit 3.3 the ear spark offers all four qualities');
  const ear = await answerQuiz(5, quality);
  t.check(ear === 5 && nextOn(), `ear spark: five chords named by ear, then Next (${ear}/5)`);
  t.click('.stage [data-act="next"]'); await t.wait(40);
  t.check(/1%/.test(tag()), 'Daily Set reaches Today’s 1%');
  M.Store.data.units['3.B'] = bossRecord;
  t.finish();
})().catch(e => { console.log('CRASH', e && e.stack); process.exit(1); });
