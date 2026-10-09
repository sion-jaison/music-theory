/* =================================================================
   Level 2 · Steps & Scales
   Reading both staves, the major scale from any note, solfège,
   intervals by counting and by ear, and rhythms with dots, ties,
   rests and sixteenths. Every top-level name here starts with L2_ or
   l2 so it cannot clash with the other level files.
   ================================================================= */

/* ---------- small helpers ---------- */
function l2Naturals(lo, hi) {
  const out = [];
  for (let m = Theory.midi(lo); m <= Theory.midi(hi); m++) if (!isBlack(m)) out.push(Theory.fromMidi(m));
  return out;
}
function l2Cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function l2A(word) { return /^[aeiou]/i.test(word) ? 'an' : 'a'; }
function l2List(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
/* the scale a lesson writes on the staff: from octave 4, except B♭ which sits lower */
function l2ScaleNotes(root) { return Theory.scale(Theory.withOct(root, root === 'B♭' ? 3 : 4), 'major', true); }

const L2_TREBLE = l2Naturals('C4', 'A5');
const L2_BASS = l2Naturals('E2', 'C4');
const L2_CMAJ = [0, 2, 4, 5, 7, 9, 11];
const L2_ORD = ['', 'unison', '2nd', '3rd', '4th', '5th', '6th', '7th', 'octave'];
const L2_EAR_POOL = [2, 3, 4, 5, 7, 9, 12];
const L2_BOSS_POOL = [2, 4, 5, 7, 9, 12];
const L2_SAYINGS = {
  treble: { lines: 'E G B D F', spaces: 'F A C E', lineWords: ['Every', 'Good', 'Boy', 'Does', 'Fine'], lineSaying: 'Every Good Boy Does Fine', spaceSaying: 'they spell FACE', bottom: 'E4', top: 'F5' },
  bass: { lines: 'G B D F A', spaces: 'A C E G', lineWords: ['Good', 'Boys', 'Do', 'Fine', 'Always'], spaceWords: ['All', 'Cows', 'Eat', 'Grass'], lineSaying: 'Good Boys Do Fine Always', spaceSaying: 'All Cows Eat Grass', bottom: 'G2', top: 'A3' }
};

/* ---------- reading the staff ---------- */
/* where a written note sits, in words: 'the line the treble clef curls round' */
function l2Where(n, staff) {
  const bass = staff === 'bass', pos = Staff.step(n) - (bass ? 18 : 30);
  if (n === 'C4') return bass ? 'middle C, on its own ledger line above the bass staff' : 'middle C, on its own ledger line below the staff';
  if (!bass && n === 'G4') return 'the line the treble clef curls round';
  if (bass && n === 'F3') return 'the line between the bass clef’s two dots';
  const LINES = ['the bottom line', 'the 2nd line', 'the middle line', 'the 4th line', 'the top line'];
  const SPACES = ['the bottom space', 'the 2nd space', 'the 3rd space', 'the top space'];
  if (pos >= 0 && pos <= 8 && pos % 2 === 0) { const S = L2_SAYINGS[bass ? 'bass' : 'treble'], k = pos / 2; return `${LINES[k]}, “${S.lineWords[k]}” in ${S.lineSaying}`; }
  if (pos > 0 && pos < 8) { const k = (pos - 1) / 2; return bass ? `${SPACES[k]}, “${L2_SAYINGS.bass.spaceWords[k]}” in All Cows Eat Grass` : `${SPACES[k]}, the ${Theory.letterOf(n)} of FACE`; }
  if (pos === -1) return 'the space just below the staff';
  if (pos === 9) return 'the space just above the staff';
  return pos < 0 ? 'on a ledger line below the staff' : 'on a ledger line above the staff';
}
/* a hint from the nearest landmark (middle C, treble G, bass F), or from the line and space sayings */
function l2Landmark(n, staff) {
  const bass = staff === 'bass', s = Staff.step(n);
  const marks = bass ? [['F3', 'the bass clef’s two dots hug F3'], ['C4', 'middle C sits on a ledger line just above the bass staff']]
    : [['G4', 'the treble clef curls round G4'], ['C4', 'middle C sits on a ledger line just below the staff']];
  const [L, text] = marks.slice().sort((a, b) => Math.abs(Staff.step(a[0]) - s) - Math.abs(Staff.step(b[0]) - s))[0];
  const d = s - Staff.step(L);
  if (d === 0) return `This one is a landmark: ${text}.`;
  if (Math.abs(d) <= 3) {
    const letters = [];
    for (let k = Staff.step(L); ; k += Math.sign(d)) { letters.push(Theory.LETTERS[((k % 7) + 7) % 7]); if (k === s) break; }
    return `Landmark: ${text}. Count ${d > 0 ? 'up' : 'down'} from there: ${letters.join(', ')}.`;
  }
  const S = L2_SAYINGS[bass ? 'bass' : 'treble'], pos = s - (bass ? 18 : 30);
  if (pos < 0) return `It hangs below the staff. The bottom line is ${S.bottom}: count down from there.`;
  if (pos > 8) return `It sits above the staff. The top line is ${S.top}: count up from there.`;
  return pos % 2 === 0 ? `It sits on a line. Lines from the bottom: ${S.lines} (${S.lineSaying}).` : `It sits in a space. Spaces from the bottom: ${S.spaces} (${S.spaceSaying}).`;
}
function l2Draw(src, k) {
  let out = [];
  while (out.length < k) { const s = shuffle(src); if (out.length && s[0].n === out[out.length - 1].n) s.push(s.shift()); out = out.concat(s); }
  return out.slice(0, k);
}
/* notes for a sprint: [{ n, staff }]. The grand staff mixes both pools half and half. */
function l2SprintItems(clef, rounds, pool) {
  const tag = (list, staff) => list.map(n => ({ n, staff }));
  if (pool) return l2Draw(tag(pool, clef === 'bass' ? 'bass' : 'treble'), rounds);
  if (clef === 'grand') { const half = Math.ceil(rounds / 2); return shuffle(l2Draw(tag(L2_TREBLE, 'treble'), half).concat(l2Draw(tag(L2_BASS, 'bass'), rounds - half))); }
  return l2Draw(tag(clef === 'bass' ? L2_BASS : L2_TREBLE, clef), rounds);
}

/* Staff sprint: a note appears on the staff; play it in any octave.
   p: { clef: 'treble'|'bass'|'grand', rounds, pool (note names), limit (seconds per note), pass, passMsg, prompt, start }
   Untimed: a wrong note gets a landmark hint and the note stays; score counts first tries.
   Timed: a wrong note or the clock ends the round; below `pass`, a Try again button starts a fresh set.
   done(true, { score }) */
Tasks.staffSprint = (el, p, done) => {
  const clef = p.clef || 'treble', rounds = p.rounds || 8, limit = p.limit || 0, pass = p.pass || 0;
  let items = [], i = 0, score = 0, tries = 0, timer = 0, wait = 0, t0 = 0, busy = true, over = false;
  el.innerHTML = `<div class="l2-task">${p.prompt ? `<p class="prompt">${p.prompt}</p>` : ''}<div class="l2-sprint${clef === 'grand' ? ' grand' : ''}"></div>${limit ? '<div class="timer"><i></i></div>' : ''}${rounds > 1 ? `<div class="progress-dots">${'<span></span>'.repeat(rounds)}</div>` : ''}<p class="fb info" aria-live="polite">${p.start || 'Play it on the keys, your instrument or your voice. Any octave counts.'}</p><div class="row" data-retry hidden><button type="button" class="btn small" data-act="retry">Try again</button></div></div>`;
  const host = el.querySelector('.l2-sprint'), f = el.querySelector('.fb'), dots = el.querySelectorAll('.progress-dots span'), bar = el.querySelector('.timer i'), retry = el.querySelector('[data-retry]');
  const draw = (it, mark) => {
    host.innerHTML = Staff.svg({ clef, notes: [{ n: it.n, staff: clef === 'grand' ? it.staff : undefined, mark }], labels: [mark ? it.n : ''], gap: 70, minWidth: clef === 'grand' ? 200 : 180, aria: `A note on the ${it.staff} staff: ${it.n}` });
  };
  function start() {
    items = l2SprintItems(clef, rounds, p.pool); i = 0; score = 0; over = false; retry.hidden = true;
    dots.forEach(d => { d.className = ''; });
    show();
  }
  function show() {
    const it = items[i]; tries = 0; busy = false; draw(it); t0 = performance.now();
    if (limit) {
      bar.style.transition = 'none'; bar.style.transform = 'scaleX(1)';
      requestAnimationFrame(() => { bar.style.transition = `transform ${limit}s linear`; bar.style.transform = 'scaleX(0)'; });
      clearTimeout(timer); timer = setTimeout(() => result(false, `Time. That was ${it.n}, ${l2Where(it.n, it.staff)}.`), limit * 1000);
    }
  }
  function result(found, msg) {
    clearTimeout(timer); busy = true;
    const it = items[i];
    if (found && tries === 0) score++;
    if (dots[i]) dots[i].classList.add(found ? 'on' : 'miss');
    draw(it, found ? 'ok' : 'no');
    i++;
    if (i < items.length) { fb(f, found ? 'good' : 'bad', msg); wait = setTimeout(show, found ? 1000 : 2400); return; }
    over = true;
    if (rounds === 1) { fb(f, found ? 'good' : 'bad', msg); done(true, { score }); return; }
    if (!limit) { fb(f, 'good', `${msg} All ${items.length} read, ${score} on the first try.`); done(true, { score }); return; }
    if (score >= pass) { fb(f, 'good', `${msg} ${score} of ${items.length}. ${p.passMsg || 'Done.'}`); done(true, { score }); }
    else { fb(f, 'bad', `${score} of ${items.length}. You need ${pass}. The landmarks help: middle C, the treble G and the bass F.`); retry.hidden = false; }
  }
  el.querySelector('[data-act="retry"]').onclick = start;
  const off = Bus.on('note', d => {
    if (busy || over) return;
    const it = items[i];
    if (mod12(d.midi) === Theory.pc(it.n)) result(true, `Right: that’s ${it.n}, ${l2Where(it.n, it.staff)}.${limit ? ` ${((performance.now() - t0) / 1000).toFixed(1)} s.` : ''}`);
    else if (limit) result(false, `That’s ${SHARP[mod12(d.midi)]}. This one is ${it.n}, ${l2Where(it.n, it.staff)}.`);
    else { tries++; fb(f, 'bad', `That’s ${noteName(d.midi)}. ${l2Landmark(it.n, it.staff)}`); }
  });
  start();
  return () => { off(); clearTimeout(timer); clearTimeout(wait); };
};

/* Play the note asked: "Play mi in G major", "Play a 3rd above D".
   p: { prompt, items: [{ ask (html), sub, pc, right, hint, marks (pcs that glow), start (midi that glows as the starting note) }] }
   A wrong note gets the item's hint and the round stays open. done(true, { firstTry }) */
Tasks.playAsked = (el, p, done) => {
  const items = p.items;
  let i = 0, first = 0, tries = 0, wait = 0, busy = false;
  el.innerHTML = `<div class="l2-task">${p.prompt ? `<p class="lead">${p.prompt}</p>` : ''}<div class="l2-ask" aria-live="polite"><div class="q"></div><div class="sub"></div></div>${items.length > 1 ? `<div class="progress-dots">${'<span></span>'.repeat(items.length)}</div>` : ''}<p class="fb info" aria-live="polite"></p></div>`;
  const q = el.querySelector('.l2-ask .q'), sub = el.querySelector('.l2-ask .sub'), f = el.querySelector('.fb'), dots = el.querySelectorAll('.progress-dots span');
  function show() {
    const it = items[i]; tries = 0; busy = false;
    Keyboard.clearMarks();
    if (it.marks) Keyboard.markPcs(it.marks, 'hint');
    if (it.start != null) Keyboard.mark(it.start, 'target');
    q.innerHTML = it.ask; sub.textContent = it.sub || '';
    fb(f, 'info', it.start != null ? 'The glowing key is where you start.' : '');
  }
  const off = Bus.on('note', d => {
    if (busy || i >= items.length) return;
    const it = items[i];
    if (it.start != null && (d.midi === it.start || (mod12(d.midi) === mod12(it.start) && it.pc !== mod12(it.start)))) { fb(f, 'info', 'That’s the starting note. Now count up from it.'); return; }
    if (mod12(d.midi) === it.pc) {
      busy = true; if (!tries) first++;
      if (dots[i]) dots[i].classList.add('on');
      fb(f, 'good', it.right);
      i++;
      if (i >= items.length) { wait = setTimeout(() => Keyboard.clearMarks(), 1200); done(true, { firstTry: first }); }
      else wait = setTimeout(show, 1400);
    } else { tries++; fb(f, 'bad', `That’s ${noteName(d.midi)}. ${it.hint}`); }
  });
  show();
  return () => { off(); clearTimeout(wait); Keyboard.clearMarks(); };
};

/* ---------- scales ---------- */
function l2RecipeGuide() {
  return `<div class="l2-recipe" role="img" aria-label="Recipe: whole, whole, half, whole, whole, whole, half"><span class="lab">Recipe</span>${Theory.recipe('major').map(s => `<span class="${s === 1 ? 'h' : ''}">${Theory.stepName(s)}</span>`).join('')}</div>`;
}
/* C major as chips with whole and half gaps between them; the two matching halves are tinted */
function l2StepsArt() {
  const sc = Theory.scale('C', 'major').concat(['C']), rec = Theory.recipe('major');
  let html = '';
  sc.forEach((n, k) => {
    html += `<span class="nt ${k < 4 ? 'a' : 'b'}">${n}</span>`;
    if (k < 7) html += `<span class="gp ${rec[k] === 1 ? 'h' : 'w'}${k === 3 ? ' join' : ''}">${Theory.stepName(rec[k])}</span>`;
  });
  return `<div class="l2-steps" role="img" aria-label="C major: C D E F, whole whole half, joined by a whole step to G A B C, whole whole half">${html}</div><div class="l2-halves"><span>C D E F: W W H</span><span>F to G: W</span><span>G A B C: W W H</span></div>`;
}
function l2SigText(root) {
  const k = Theory.keySig(root), n = Math.abs(k.n);
  const why = { G: ' E to F is only a half step, so the 7th note rises to F♯.', F: ' A to B is a whole step, but the recipe needs a half step there, so B comes down to B♭.' }[root] || '';
  return `${root} major: ${n ? `${n} ${k.n > 0 ? 'sharp' : 'flat'}${n > 1 ? 's' : ''}, ${l2List(k.acc)}` : 'no sharps or flats'}.${why}`;
}
/* after a note with a sharp or flat: why it is spelled that way */
function l2SpellTip(note) {
  const acc = Theory.accOf(note); if (!acc) return '';
  const pc = Theory.pc(note), other = acc > 0 ? FLAT[pc] : SHARP[pc];
  return ` ${Theory.stripOct(note)}, not ${other}: ${other[0]} has its own place in the scale, and every letter comes once.`;
}

/* playSeq in a spaced Level 2 frame; labels the gaps W or H in either direction (a descending scale too) */
Tasks.scaleWalk = (el, p, done) => {
  const notes = p.notes;
  el.innerHTML = '<div class="l2-task"></div>';
  const inner = Tasks.playSeq(el.firstChild, Object.assign({}, p, {
    hint: p.hint || (i => {
      if (!i) return `Start on ${Theory.stripOct(notes[0])}.`;
      const s = Theory.midi(notes[i]) - Theory.midi(notes[i - 1]);
      return `Next is a ${Math.abs(s) === 1 ? 'half' : 'whole'} step ${s > 0 ? 'up' : 'down'} from ${Theory.stripOct(notes[i - 1])}.`;
    })
  }), done);
  const fix = () => el.querySelectorAll('.stp.on').forEach(s => { const v = { '-1': 'H', '-2': 'W', '-3': 'W+H' }[s.textContent]; if (v) s.textContent = v; });
  const off = Bus.on('note', fix);
  return () => { off(); inner(); };
};

/* Tasks.quiz in a spaced Level 2 frame (same options as Tasks.quiz) */
Tasks.quizL2 = (el, p, done) => {
  el.innerHTML = '<div class="l2-task l2-quiz"></div>';
  return Tasks.quiz(el.firstChild, p, done);
};

/* Build major scales by ear and recipe, names hidden until played; each finished scale is shown on the staff.
   p: { roots: ['G'] or ['D', 'A', 'B♭', 'E♭'], prompt, show } */
Tasks.scaleBuild = (el, p, done) => {
  const roots = p.roots;
  let k = 0, inner = null;
  el.innerHTML = `<div class="l2-task">${p.prompt ? `<p class="lead">${p.prompt}</p>` : ''}${roots.length > 1 ? `<div class="progress-dots">${'<span></span>'.repeat(roots.length)}</div>` : ''}<div class="l2-build"></div><div class="l2-reveal" hidden></div><div class="row" data-next hidden><button type="button" class="btn small primary" data-act="nextscale">Next scale</button></div></div>`;
  const host = el.querySelector('.l2-build'), reveal = el.querySelector('.l2-reveal'), nextRow = el.querySelector('[data-next]'), dots = el.querySelectorAll('.progress-dots span');
  function start() {
    const root = roots[k], notes = l2ScaleNotes(root);
    reveal.hidden = true; nextRow.hidden = true;
    if (inner) inner();
    inner = Tasks.playSeq(host, {
      prompt: `Build <b>${root} major</b>: start on ${root} and follow the recipe.`, art: l2RecipeGuide(), notes, show: p.show || 'hidden', steps: true,
      start: 'The names stay hidden until you find each note.',
      progress: i => `${i} of ${notes.length}.${i > 1 ? l2SpellTip(notes[i - 1]) : ''}`,
      endText: `${notes.map(Theory.stripOct).join(' ')}. Every letter once.`
    }, () => finished(root, notes));
  }
  function finished(root, notes) {
    if (dots[k]) dots[k].classList.add('on');
    reveal.innerHTML = `<div class="art">${Staff.svg({ clef: 'treble', notes, labels: notes.map(Theory.stripOct), gap: 40, aria: `${root} major on the treble staff: ${notes.join(' ')}` })}</div><p>${l2SigText(root)}</p>`;
    reveal.hidden = false;
    k++;
    if (k >= roots.length) done(true); else nextRow.hidden = false;
  }
  el.querySelector('[data-act="nextscale"]').onclick = start;
  start();
  return () => { if (inner) inner(); };
};

/* The boss scale: names hidden, no W/H labels, up to `allow` wrong notes. A fail offers a new root.
   p: { roots, allow, passMsg } */
Tasks.scaleTest = (el, p, done) => {
  const allow = p.allow == null ? 2 : p.allow;
  let inner = null, root = rand(p.roots);
  el.innerHTML = `<div class="l2-task"><div class="l2-st"></div><div class="row" data-retry hidden><button type="button" class="btn small" data-act="retry">Try again</button></div></div>`;
  const host = el.querySelector('.l2-st'), retry = el.querySelector('[data-retry]');
  function start() {
    retry.hidden = true;
    if (inner) inner();
    const notes = l2ScaleNotes(root), names = notes.map(Theory.stripOct).join(' ');
    inner = Tasks.playSeq(host, { prompt: `Play <b>${root} major</b> up one octave, from ${root} to ${root}.`, notes, show: 'hidden', start: `The names stay hidden. Up to ${allow} wrong notes are fine.` }, (ok, r) => {
      const f = host.querySelector('.fb');
      if (r.misses <= allow) { fb(f, 'good', `${names}. ${r.misses ? r.misses + ' wrong note' + (r.misses > 1 ? 's' : '') + ', inside the limit.' : 'No wrong notes.'} ${p.passMsg || ''}`.trim()); done(true, r); }
      else { fb(f, 'bad', `${r.misses} wrong notes; the limit is ${allow}. ${root} major is ${names}. Try again with a new scale.`); retry.hidden = false; }
    });
  }
  el.querySelector('[data-act="retry"]').onclick = () => { root = rand(p.roots.filter(x => x !== root)) || root; start(); };
  start();
  return () => { if (inner) inner(); };
};

/* ---------- questions and play-it items (lessons and review cards) ---------- */
function l2NameQ(clef) {
  const n = rand(clef === 'bass' ? L2_BASS : L2_TREBLE), letter = Theory.letterOf(n);
  const opts = shuffle([letter].concat(shuffle(Theory.LETTERS.split('').filter(x => x !== letter)).slice(0, 3)));
  return { q: 'Name this note.', html: `<div class="l2-qstaff">${Staff.svg({ clef, notes: [n], gap: 70, minWidth: 170, aria: `A note on the ${clef} staff` })}</div>`, options: opts, answer: opts.indexOf(letter), why: `${n}: ${l2Where(n, clef)}.` };
}
function l2SayingQ(clef) {
  const S = L2_SAYINGS[clef], kind = rand(['lines', 'spaces']), right = S[kind];
  const opts = shuffle(['E G B D F', 'F A C E', 'G B D F A', 'A C E G']);
  return { q: `On the ${clef} staff, the ${kind} from the bottom up are…`, options: opts, answer: opts.indexOf(right), why: `${right}: ${kind === 'lines' ? S.lineSaying : S.spaceSaying}.` };
}
function l2SpellQ() {
  const key = rand(['G', 'D', 'A', 'F', 'B♭', 'E♭']), sc = Theory.scale(key);
  const withAcc = sc.map((n, i) => i).filter(i => i > 0 && Theory.accOf(sc[i]) !== 0);
  const k = withAcc.length ? rand(withAcc) : randInt(1, 6), note = sc[k], pc = Theory.pc(note);
  const other = Theory.accOf(note) > 0 ? FLAT[pc] : SHARP[pc];
  const opts = shuffle([note, other, Theory.letterOf(note)]);
  return { q: `How is the ${L2_ORD[k + 1] === 'octave' ? '8th' : L2_ORD[k + 1]} note of ${key} major spelled?`, options: opts, answer: opts.indexOf(note), why: `${note}. ${key} major is ${sc.join(' ')}: every letter once, so ${other} (a second ${other[0]}) cannot be in it.` };
}
const L2_DEG_WHY = ['Home: the scale starts and ends here.', '“Super” means above: one step above the tonic.', 'Halfway from the tonic up to the dominant.', 'Sits just below the dominant.', 'The strongest pull back home.', 'One step above the dominant.', 'A half step below the tonic, leading up to it.'];
function l2DegNameQ() {
  const k = randInt(0, 6), others = shuffle([0, 1, 2, 3, 4, 5, 6].filter(x => x !== k)).slice(0, 2), opts = shuffle([k].concat(others));
  const why = `${l2Cap(Theory.DEGREE_NAMES[k])}: degree ${k + 1}, ${Theory.SOLFEGE[k]}. ${L2_DEG_WHY[k]}`;
  if (Math.random() < 0.5) return { q: `Degree ${k + 1} of a scale (${Theory.SOLFEGE[k]}) is called the…`, options: opts.map(x => Theory.DEGREE_NAMES[x]), answer: opts.indexOf(k), why };
  return { q: `The ${Theory.DEGREE_NAMES[k]} is which degree?`, options: opts.map(x => `${x + 1} (${Theory.SOLFEGE[x]})`), answer: opts.indexOf(k), why };
}
function l2DegreeItem(keys) {
  const key = rand(keys || ['C', 'G', 'F', 'D']), k = randInt(0, 6), sc = Theory.scale(key), note = sc[k];
  const sol = Theory.SOLFEGE[k], name = Theory.DEGREE_NAMES[k], form = rand(['sol', 'sol', 'num', 'name']);
  const ask = form === 'sol' ? `Play <b>${sol}</b> in ${key} major` : form === 'num' ? `Play degree <b>${k + 1}</b> of ${key} major` : `Play the <b>${name}</b> of ${key} major`;
  return {
    ask, sub: `Do is ${key}.`, pc: Theory.pc(note), marks: [Theory.pc(key)],
    right: `${note}: ${sol}, degree ${k + 1} of ${key} major, the ${name}.`,
    hint: `Count up ${key} major from do: ${sc.slice(0, k + 1).map((x, j) => `${x} (${Theory.SOLFEGE[j]})`).join(', ')}.`
  };
}
/* a short tune after the home chord, ending on do, mi or sol (scale-step numbers, 0 = do) */
const L2_ENDINGS = {
  0: [[2, 1, 0], [4, 3, 2, 1, 0], [0, 1, 2, 1, 0], [4, 5, 6, 7], [2, 3, 1, 0]],
  2: [[0, 1, 2], [4, 3, 2], [0, 2, 4, 3, 2], [5, 4, 3, 2], [0, 1, 0, 1, 2]],
  4: [[0, 1, 2, 3, 4], [0, 2, 4], [2, 3, 4], [7, 6, 5, 4], [2, 1, 2, 3, 4]]
};
function l2EndingQ() {
  const end = rand([0, 2, 4]), ph = rand(L2_ENDINGS[end]), tonic = rand([55, 57, 60, 62, 65]);
  const off = k => 12 * Math.floor(k / 7) + Theory.NAT[k % 7];
  const play = [0, 4, 7].map(s => ({ m: tonic + s, t: 0, d: 1, v: 0.5 })).concat(ph.map((k, j) => ({ m: tonic + off(k), t: 1.4 + j * 0.45, d: j === ph.length - 1 ? 1 : 0.4 })));
  const key = SHARP[mod12(tonic)];
  const why = { 0: `It came home to do (${key}). That is why it sounds finished.`, 2: `It stopped on mi, the middle of the home chord: settled, but not quite home.`, 4: `It stopped on sol, the top of the home chord. It sounds as if it wants to go on.` }[end];
  return { q: 'The home chord, then a short tune. Which note does the tune end on?', options: ['do', 'mi', 'sol'], answer: [0, 2, 4].indexOf(end), play, playLabel: 'Hear it again', why: ok => (ok ? 'Right. ' : `It ended on ${Theory.SOLFEGE[end]}. `) + why };
}
function l2LetterItem(root, num) {
  const L = Theory.LETTERS; root = root || rand(L.split('')); const n = num || randInt(2, 8);
  const ri = L.indexOf(root), letters = []; for (let j = 0; j < n; j++) letters.push(L[(ri + j) % 7]);
  const top = letters[n - 1], word = L2_ORD[n];
  return {
    ask: `Play ${l2A(word)} <b>${word}</b> above ${root}`, sub: 'White keys only. Count the starting letter as 1.',
    pc: Theory.pc(top), start: Theory.midi(root + '3'),
    right: `${top}: ${letters.join(', ')}. ${n} letters, ${l2A(word)} ${word}.`,
    hint: `Count letters up from ${root}, and count ${root} itself as 1.`
  };
}
const L2_SIZES = [['2', 'M2'], ['b3', 'm3'], ['3', 'M3'], ['4', 'P4'], ['5', 'P5'], ['6', 'M6'], ['8', 'P8']];
function l2SizeItem() {
  const root = rand(['C', 'D', 'F', 'G', 'A']), [deg, short] = rand(L2_SIZES);
  const x = Theory.INTERVALS.find(v => v.short === short), top = Theory.up(root, deg);
  return {
    ask: `Play ${l2A(x.name)} <b>${x.name}</b> above ${root}`, sub: `${x.semis} half steps`,
    pc: Theory.pc(top), start: Theory.midi(root + '3'),
    right: `${top}: ${x.semis} half steps up from ${root}. Song: ${x.song} (${x.hint}).`,
    hint: `Count ${x.semis} half steps up from ${root}. Every key counts, black or white.`
  };
}
function l2CountQ() {
  const L = Theory.LETTERS, a = randInt(0, 6), n = randInt(2, 8), letters = [];
  for (let j = 0; j < n; j++) letters.push(L[(a + j) % 7]);
  const opts = shuffle([n].concat(shuffle([2, 3, 4, 5, 6, 7, 8].filter(x => x !== n)).slice(0, 2)));
  return { q: `From ${L[a]} up to the next ${letters[n - 1]} is…`, options: opts.map(x => `${l2A(L2_ORD[x])} ${L2_ORD[x]}`), answer: opts.indexOf(n), why: `${letters.join(' ')}: ${n} letters, counting both ends.` };
}
/* two notes on the treble staff, together or one after the other; name the number */
function l2StaffIntQ() {
  const n = randInt(2, 7), lo = randInt(0, L2_TREBLE.length - n), a = L2_TREBLE[lo], b = L2_TREBLE[lo + n - 1];
  const together = Math.random() < 0.5, same = (Staff.step(b) - Staff.step(a)) % 2 === 0;
  const opts = shuffle([n].concat(shuffle([2, 3, 4, 5, 6, 7].filter(x => x !== n)).slice(0, 3)));
  return {
    q: 'What interval is this? Count the letters, both ends.', options: opts.map(x => L2_ORD[x]), answer: opts.indexOf(n),
    html: `<div class="l2-qstaff">${Staff.svg({ clef: 'treble', notes: together ? [[a, b]] : [a, b], gap: 56, minWidth: 180, aria: `Two notes on the treble staff: ${a} and ${b}` })}</div>`,
    play: together ? [{ m: Theory.midi(a), t: 0, d: 1 }, { m: Theory.midi(b), t: 0, d: 1 }] : [{ m: Theory.midi(a), t: 0, d: 0.6 }, { m: Theory.midi(b), t: 0.7, d: 0.8 }], autoplay: false,
    why: `${a} up to ${b}: ${L2_TREBLE.slice(lo, lo + n).map(Theory.stripOct).join(' ')}, ${n} letters. ${same ? 'Line to line or space to space: an odd number.' : 'Line to space: an even number.'}`
  };
}
/* ear: two notes, low then high; options carry the song anchors */
function l2IntervalQ(pool) {
  pool = pool || L2_EAR_POOL;
  const semis = rand(pool), x = Theory.INTERVALS[semis], lo = randInt(53, 79 - semis);
  const opts = shuffle([semis].concat(shuffle(pool.filter(s => s !== semis)).slice(0, 3)));
  const label = s => `<span class="l2-opt"><b>${Theory.INTERVALS[s].name}</b><small>${Theory.INTERVALS[s].song}</small></span>`;
  return {
    q: 'Which interval is this?', options: opts.map(label), answer: opts.indexOf(semis), playLabel: 'Hear it again',
    play: [{ m: lo, t: 0, d: 0.7 }, { m: lo + semis, t: 0.8, d: 1 }],
    why: ok => `${ok ? 'Right: ' : 'It was '}${l2A(x.name)} ${x.name}, ${semis} half steps (${noteName(lo)} up to ${noteName(lo + semis)}). ${x.song}: ${x.hint}.`
  };
}
function l2SemisQ() {
  const x = rand(Theory.INTERVALS.slice(1));
  const opts = shuffle([x.semis].concat(shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(s => s !== x.semis)).slice(0, 3)));
  return { q: `How many half steps make ${l2A(x.name)} ${x.name}?`, options: opts.map(String), answer: opts.indexOf(x.semis), why: `${l2Cap(x.name)}: ${x.semis} half steps. Anchor: ${x.song}.` };
}
function l2SongQ() {
  const pool = Theory.INTERVALS.filter(v => v.semis > 0 && v.semis !== 11), x = rand(pool);
  const opts = shuffle([x].concat(shuffle(pool.filter(v => v !== x)).slice(0, 2)));
  return { q: `“${x.song}”: ${x.hint}. Which interval is that?`, options: opts.map(v => v.name), answer: opts.indexOf(x), play: [{ m: 60, t: 0, d: 0.6 }, { m: 60 + x.semis, t: 0.7, d: 0.9 }], autoplay: false, playLabel: 'Hear the two notes', why: `${l2Cap(x.name)}, ${x.semis} half steps.` };
}
function l2DotQ() {
  const [nm, right, wrong, why] = rand([
    ['dotted half note', '3 beats', ['2 beats', '4 beats'], 'A half note (2) plus half again (1): 3 beats. Ta-a-a.'],
    ['dotted quarter note', '1½ beats', ['1 beat', '2 beats'], 'A quarter note (1) plus half again (½): 1½ beats. Ta-i.']
  ]);
  const opts = shuffle([right].concat(wrong));
  return { q: `A ${nm} lasts…`, options: opts, answer: opts.indexOf(right), why };
}

/* ---------- rhythm notation ----------
   A rhythm is written as text: w h. h q. q e s are notes (whole … sixteenth), add r for a rest (qr, er, hr),
   and _ ties two notes into one sound: 'q. e q q', 'q q_q q', 's s s s q q q', 'q er e q q'. */
const L2_RDUR = { w: 4, 'h.': 3, h: 2, 'q.': 1.5, q: 1, e: 0.5, s: 0.25 };
const L2_RNAME = { w: 'whole', 'h.': 'dotted half', h: 'half', 'q.': 'dotted quarter', q: 'quarter', e: 'eighth', s: 'sixteenth' };
function l2Rhythm(src) {
  const out = []; let at = 0;
  String(src).trim().split(/\s+/).forEach(tok => tok.split('_').forEach((part, k) => {
    const rest = /r$/.test(part), key = rest ? part.slice(0, -1) : part, d = L2_RDUR[key];
    if (!d) throw new Error('Not a rhythm: ' + part);
    out.push({ key, d, rest, tie: k > 0, at }); at += d;
  }));
  return out;
}
function l2Onsets(notes) { return notes.filter(n => !n.rest && !n.tie).map(n => n.at); }
function l2Beats(notes) { return notes.reduce((s, n) => s + n.d, 0); }
function l2Syl(n) {
  if (n.rest) return 'sh';
  if (n.tie) return n.d < 1 ? '-i' : '-a';
  if (n.key === 's') return n.at % 0.5 ? 'ka' : 'ti';
  return { w: 'ta-a-a-a', 'h.': 'ta-a-a', h: 'ta-a', 'q.': 'ta-i', q: 'ta', e: 'ti' }[n.key];
}
/* l2RhythmSVG(src, { meter: [3, 4], marks (per clapped note: 'ok'|'no'), counts (show 1 e & a) }) */
function l2RhythmSVG(src, o) {
  o = o || {};
  const notes = l2Rhythm(src), m = (o.meter || [4, 4])[0], beats = l2Beats(notes), bars = Math.max(1, Math.ceil(beats / m - 1e-9));
  const bw = 72, minW = 30, x0 = 56, barGap = 18, y = o.counts ? 66 : 46;
  /* spacing: proportional to time, but every note or rest gets at least minW so sixteenths and their syllables have room */
  const starts = new Set(notes.map(n => n.at)), T = [...new Set([0, beats].concat(notes.map(n => n.at), Array.from({ length: Math.ceil(beats) }, (v, b) => b)))].filter(t => t <= beats).sort((a, b) => a - b);
  const xs = [x0];
  for (let k = 1; k < T.length; k++) {
    let w = Math.max((T[k] - T[k - 1]) * bw, starts.has(T[k - 1]) ? minW : 0);
    if (T[k] < beats && Math.abs(T[k] / m - Math.round(T[k] / m)) < 1e-9) w += barGap;
    xs.push(xs[k - 1] + w);
  }
  const X = at => { const k = T.indexOf(at); if (k >= 0) return xs[k]; let j = 0; while (j < T.length - 2 && T[j + 1] < at) j++; return xs[j] + (at - T[j]) / (T[j + 1] - T[j]) * (xs[j + 1] - xs[j]); };
  const cx = n => X(n.at) + 12, sx = n => cx(n) + 7, end = xs[xs.length - 1];
  let s = `<line class="ink" x1="10" y1="${y}" x2="${end + 4}" y2="${y}" stroke-width="1"/><text class="ts" x="22" y="${y - 4}">${m}</text><text class="ts" x="22" y="${y + 16}">4</text>`;
  for (let j = 1; j < bars; j++) { const bx = X(j * m) - 5; s += `<line class="ink" x1="${bx}" y1="${y - 14}" x2="${bx}" y2="${y + 14}" stroke-width="1.5"/>`; }
  s += `<line class="ink" x1="${end + 4}" y1="${y - 14}" x2="${end + 4}" y2="${y + 14}" stroke-width="2.5"/>`;
  /* beams: runs of eighths and sixteenths inside one beat */
  const inRun = new Set();
  const short = n => !n.rest && (n.key === 'e' || n.key === 's');
  for (let b = 0; b < Math.ceil(beats); b++) {
    let run = [];
    const flush = () => {
      if (run.length > 1) {
        const a = run[0], z = run[run.length - 1];
        s += `<rect class="ink" x="${sx(a) - 1}" y="${y - 38}" width="${sx(z) - sx(a) + 2}" height="5"/>`;
        for (let k = 1; k < run.length; k++) if (run[k].key === 's' && run[k - 1].key === 's') s += `<rect class="ink" x="${sx(run[k - 1]) - 1}" y="${y - 30}" width="${sx(run[k]) - sx(run[k - 1]) + 2}" height="4"/>`;
        run.forEach(n => inRun.add(n));
      }
      run = [];
    };
    notes.forEach(n => { if (n.at >= b - 1e-9 && n.at < b + 1 - 1e-9) { if (short(n)) run.push(n); else flush(); } });
    flush();
  }
  const syl = [];
  let onset = 0;
  notes.forEach((n, i) => {
    const x = cx(n);
    if (n.rest) {
      if (n.key === 'q') s += `<path class="l2stroke" d="M${x - 3} ${y - 18} l7 9 -6 6 7 9 -4 -1 -4 5"/>`;
      else if (n.key === 'e') s += `<circle class="l2fill" cx="${x - 3}" cy="${y - 10}" r="2.8"/><path class="l2stroke" d="M${x - 3} ${y - 8} Q${x + 1} ${y - 6} ${x + 5} ${y - 13} L${x} ${y + 6}"/>`;
      else s += `<rect class="l2fill" x="${x - 8}" y="${y - 6}" width="16" height="6"/>`;
    } else {
      const hollow = n.key === 'w' || n.key === 'h' || n.key === 'h.';
      s += `<ellipse class="${hollow ? 'hollow' : 'ink'}" cx="${x}" cy="${y}" rx="8" ry="6" transform="rotate(-20 ${x} ${y})"/>`;
      if (n.key !== 'w') s += `<line class="ink" x1="${x + 7}" y1="${y - 2}" x2="${x + 7}" y2="${y - 36}" stroke-width="2"/>`;
      if (n.key.endsWith('.')) s += `<circle class="l2fill" cx="${x + 15}" cy="${y - 4}" r="2.6"/>`;
      if (short(n) && !inRun.has(n)) {
        s += `<path class="l2stroke" d="M${x + 7} ${y - 36} c1 7 11 9 7 20"/>`;
        if (n.key === 's') s += `<path class="l2stroke" d="M${x + 7} ${y - 28} c1 7 11 9 7 20"/>`;
      }
      if (n.tie && i > 0) { const a = cx(notes[i - 1]) + 4, z = x - 4; s += `<path class="l2tie" d="M${a} ${y + 7} Q${(a + z) / 2} ${y + 18} ${z} ${y + 7}"/>`; }
      if (!n.tie) { const mk = o.marks && o.marks[onset]; if (mk) s += `<circle class="${mk === 'ok' ? 'ok' : 'no'}" cx="${x}" cy="${y + 42}" r="5"/>`; onset++; }
    }
    syl.push(`<text class="syl" x="${x}" y="${y + 26}" text-anchor="middle">${l2Syl(n)}</text>`);
  });
  if (o.counts) {
    for (let b = 0; b < beats; b++) s += `<text class="l2cnt beat" x="${X(b) + 12}" y="${y - 50}" text-anchor="middle">${b % m + 1}</text>`;
    notes.forEach(n => { const fr = n.at - Math.floor(n.at + 1e-9); if (fr > 1e-6) s += `<text class="l2cnt" x="${cx(n)}" y="${y - 50}" text-anchor="middle">${fr === 0.5 ? '&' : fr === 0.25 ? 'e' : 'a'}</text>`; });
  }
  const words = [];
  notes.forEach(n => { const w = `${L2_RNAME[n.key]} ${n.rest ? 'rest' : 'note'}`; if (n.tie && words.length) words[words.length - 1] += ' tied to ' + w; else words.push(w); });
  const width = end + 12, height = y + 52;
  return `<svg class="l2r" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Rhythm in ${m}/4: ${words.join(', ')}">${s}${syl.join('')}</svg>`;
}
function l2RhythmArt(src, meter, counts) { return `<div class="notation">${l2RhythmSVG(src, { meter: [meter || 4, 4], counts })}</div>`; }
/* play a rhythm: optional count-in clicks, then a wood click and a held tone for every note (ties held through) */
function l2PlayRhythm(src, m, bpm, countIn) {
  const ctx = Sound.ensure(); if (!ctx) return null;
  const spb = 60 / bpm, notes = l2Rhythm(src), beats = l2Beats(notes), count = countIn ? m : 0;
  const t0 = ctx.currentTime + 0.3, bar = t0 + count * spb;
  for (let i = 0; i < count; i++) Sound.click(t0 + i * spb, i === 0, true);
  notes.forEach((n, i) => {
    if (n.rest || n.tie) return;
    let len = n.d; for (let j = i + 1; j < notes.length && notes[j].tie; j++) len += notes[j].d;
    Sound.wood(bar + n.at * spb);
    Sound.tone(72, bar + n.at * spb, Math.max(0.12, len * spb * 0.85), 0.45);
  });
  return { t0, bar, spb, total: count + Math.ceil(beats) };
}
function l2Waltz() {
  const ctx = Sound.ensure(); if (!ctx) return;
  const t0 = ctx.currentTime + 0.1, spb = 0.6;
  for (let i = 0; i < 6; i++) {
    Sound.click(t0 + i * spb, i % 3 === 0, i % 3 !== 0);
    if (i % 3 === 0) Sound.tone(i ? 43 : 48, t0 + i * spb, 0.5, 0.7);
    else Sound.chord(i < 3 ? [64, 67] : [62, 65], t0 + i * spb, 0.3, 0.4);
  }
}

/* Clap back rhythms in 3/4 or 4/4, with a count-in, scoring every clap like Level 1's clap-back.
   p: { patterns: ['q q q'] or [{ r, m }], meter (default 4), rounds, bpm, counts, prompt, once (a single try; done(true, { ok })) }
   done(true, { fails }) */
Tasks.rhythmEcho = (el, p, done) => {
  const pool = p.patterns.map(x => typeof x === 'string' ? { r: x, m: p.meter || 4 } : x);
  const n = Math.min(p.rounds || 3, pool.length);
  const list = [pool[0]].concat(shuffle(pool.slice(1)).slice(0, n - 1));
  const bpm = p.bpm || 72, spb = 60 / bpm;
  let r = 0, onsets = [], listening = false, timers = [], cancelL = null, fails = 0, over = false, lights = [], pending = false;
  el.innerHTML = `<div class="l2-task"><p class="prompt">${p.prompt || 'Listen, then clap or tap the rhythm back.'}</p><div class="l2-rhead"><span class="chip" data-meter></span><span class="chip" data-tempo>${bpm} BPM</span></div><div class="notation"></div><div class="beats"></div>${tapPadHTML()}<div class="row"><button type="button" class="btn" data-act="hear">▶ Hear it</button><button type="button" class="btn primary" data-act="go">My turn</button>${n > 1 ? `<div class="progress-dots">${'<span></span>'.repeat(n)}</div>` : ''}</div><p class="fb info" aria-live="polite">${Mic.state === 'on' ? 'Clap after the count-in. The mic is listening.' : 'After the count-in, tap the pad, press Space or clap with the mic on.'}</p></div>`;
  wireTapPad(el);
  const nota = el.querySelector('.notation'), beatsEl = el.querySelector('.beats'), meterChip = el.querySelector('[data-meter]'), f = el.querySelector('.fb');
  const dots = el.querySelectorAll('.progress-dots span'), hear = el.querySelector('[data-act="hear"]'), go = el.querySelector('[data-act="go"]');
  const off = Bus.on('onset', d => { if (listening) onsets.push(d.t); });
  function setup(marks) {
    const c = list[r];
    nota.innerHTML = l2RhythmSVG(c.r, { meter: [c.m, 4], marks, counts: p.counts });
    meterChip.textContent = c.m + '/4';
    if (beatsEl.children.length !== c.m) beatsEl.innerHTML = '<span class="strong"></span>' + '<span></span>'.repeat(c.m - 1);
    lights = [...beatsEl.querySelectorAll('span')];
  }
  function clearT() { timers.forEach(clearTimeout); timers = []; if (cancelL) { cancelL(); cancelL = null; } lights.forEach(l => l.classList.remove('lit')); }
  function light(t0, count, m) {
    const times = []; for (let i = 0; i < count; i++) times.push(t0 + i * spb);
    cancelL = scheduleLights(lights, times, i => i % m);
    timers.push(setTimeout(() => lights.forEach(l => l.classList.remove('lit')), (count * spb + 0.6) * 1000));
  }
  /* after a rhythm lands, the next one appears after a pause, or at once if the learner presses Hear or My turn */
  const advance = () => { if (!pending) return; pending = false; setup(); fb(f, 'info', 'Next rhythm. Hear it first.'); };
  hear.onclick = () => {
    advance(); clearT();
    const c = list[r], pl = l2PlayRhythm(c.r, c.m, bpm, true); if (!pl) return;
    light(pl.t0, pl.total, c.m);
  };
  go.onclick = () => {
    const ctx = Sound.ensure(); if (!ctx || over) return;
    advance(); clearT();
    go.disabled = true; hear.disabled = true; onsets = [];
    const c = list[r], notes = l2Rhythm(c.r), beats = Math.ceil(l2Beats(notes)), m = c.m;
    const t0 = ctx.currentTime + 0.3, bar = t0 + m * spb, quiet = Mic.state === 'on';
    for (let i = 0; i < m + beats; i++) if (i < m || !quiet) Sound.click(t0 + i * spb, i % m === 0, true);
    light(t0, m + beats, m);
    fb(f, 'info', 'Count-in…');
    timers.push(setTimeout(() => { listening = true; fb(f, 'info', 'Your turn.'); }, ((m - 0.4) * spb + 0.3) * 1000));
    timers.push(setTimeout(() => score(notes, bar, beats), ((m + beats) * spb + 0.55) * 1000));
  };
  function score(notes, bar, beats) {
    listening = false;
    const onB = l2Onsets(notes), exp = onB.map(b => bar + b * spb);
    const gaps = onB.slice(1).map((b, k) => b - onB[k]).concat([beats - onB[onB.length - 1]]);
    const tol = Math.max(0.09, Math.min(0.14, Math.min.apply(null, gaps) * spb * 0.45));
    const used = new Set(), marks = []; let hit = 0;
    exp.forEach(t => {
      let best = -1, bd = 1;
      onsets.forEach((o, k) => { if (!used.has(k) && Math.abs(o - t) < bd) { bd = Math.abs(o - t); best = k; } });
      if (best >= 0 && bd <= tol) { used.add(best); hit++; marks.push('ok'); } else marks.push('no');
    });
    /* one stray clap is forgiven, as in Level 1, but not a clap on a tied note or a rest */
    const extras = onsets.filter((o, k) => !used.has(k) && o > bar - 0.15);
    const near = pick => extras.some(o => notes.some(nn => pick(nn) && Math.abs(o - (bar + nn.at * spb)) <= tol));
    setup(marks);
    go.disabled = false; hear.disabled = false;
    const ok = hit === exp.length && extras.length <= 1 && !near(nn => nn.tie || nn.rest);
    let tip = ' Hear it again, then retry.';
    if (near(nn => nn.tie)) tip = ' A tie makes one sound: clap the first note and hold through the second.';
    else if (near(nn => nn.rest)) tip = ' Rests are silent: no clap on the “sh”.';
    const missText = `${hit} of ${exp.length} notes landed${extras.length ? `, plus ${extras.length} extra clap${extras.length > 1 ? 's' : ''}` : ''}.${hit < exp.length ? ' Red dots show the ones to fix.' : ''}`;
    if (p.once) { over = true; go.disabled = true; hear.disabled = true; fb(f, ok ? 'good' : 'bad', ok ? 'Every note landed.' : missText + (tip.indexOf('Hear') < 0 ? tip : '')); done(true, { ok }); return; }
    if (ok) {
      if (dots[r]) dots[r].classList.add('on');
      r++;
      fb(f, 'good', 'Every note landed.');
      if (r >= list.length) { over = true; go.disabled = true; hear.disabled = true; done(true, { fails }); }
      else { pending = true; timers.push(setTimeout(advance, 1600)); }
    } else { fails++; fb(f, 'bad', missText + tip); }
  }
  setup();
  return () => { off(); clearT(); };
};

/* ---------- grow a motif into a phrase ---------- */
/* move a sketch into C major: as it is, or a half step up or down (black-key motifs land on white keys) */
function l2InC(notes) {
  for (const sh of [0, 1, -1]) if (notes.every(n => L2_CMAJ.indexOf(mod12(n.m + sh)) >= 0)) return { shift: sh, notes: notes.map(n => ({ m: n.m + sh, t: n.t, d: n.d || 0.45 })) };
  return null;
}
function l2Contour(notes) {
  const w = []; for (let i = 1; i < notes.length; i++) w.push(notes[i].m > notes[i - 1].m ? 'up' : notes[i].m < notes[i - 1].m ? 'down' : 'same');
  return w.length ? w.join(', ') : 'one note';
}
/* Pick a sketch (or start fresh), record a two-bar phrase in C major that ends on do, play it back and save it.
   p: { min, max } → saveSketch({ …, level: 2, from, key: 'C' }) */
Tasks.phraseGrow = (el, p, done) => {
  const min = p.min || 5, max = p.max || 16;
  const list = (Store.data.sketches || []).filter(s => s.notes && s.notes.length).slice(0, 6);
  const names = ns => ns.map(n => SHARP[mod12(n.m)]).join(' ');
  let picked = null, conv = null, notes = [], opening = 0, rec = false, tStart = null, base = 0, saved = false;
  el.innerHTML = `<div class="l2-task"><p class="prompt">${list.length ? 'Pick a sketch to grow, or start fresh.' : 'Your sketchbook is empty, so start fresh: a short idea, an answer to it, then home.'}</p>
    <div class="l2-pick" role="group" aria-label="Sketches">${list.map(s => `<button type="button" class="choice l2-sk" data-id="${esc(s.id)}" aria-pressed="false"><span class="l2-opt"><b>${esc(s.name)}</b><small>${names(s.notes)}</small></span></button>`).join('')}<button type="button" class="choice l2-sk" data-id="" aria-pressed="false"><span class="l2-opt"><b>Start fresh</b><small>no motif</small></span></button></div>
    <div class="l2-grow" hidden>
      <p class="l2-from"></p>
      <div class="row" data-motif><button type="button" class="btn small" data-act="hearmotif">▶ Hear the motif</button><button type="button" class="btn small" data-act="use">Use it as my opening</button></div>
      <div class="notes-strip"></div>
      <div class="l2-end" aria-live="polite"></div>
      <div class="row"><button type="button" class="btn primary" data-act="rec">● Record</button><button type="button" class="btn" data-act="play" disabled>▶ Play back</button><button type="button" class="btn ghost" data-act="clear" disabled>Clear</button></div>
      <div class="field"><label for="l2-phrase-name">Name it</label><input id="l2-phrase-name" type="text" maxlength="40" placeholder="e.g. Rain finds its way home"></div>
      <div class="row"><button type="button" class="btn primary" data-act="save" disabled>Save phrase</button></div>
      <p class="fb info" aria-live="polite"></p>
    </div></div>`;
  const grow = el.querySelector('.l2-grow'), from = el.querySelector('.l2-from'), motifRow = el.querySelector('[data-motif]'), useBtn = el.querySelector('[data-act="use"]');
  const strip = el.querySelector('.notes-strip'), endEl = el.querySelector('.l2-end'), f = el.querySelector('.fb'), nameEl = el.querySelector('#l2-phrase-name');
  const bRec = el.querySelector('[data-act="rec"]'), bPlay = el.querySelector('[data-act="play"]'), bClear = el.querySelector('[data-act="clear"]'), bSave = el.querySelector('[data-act="save"]');
  const solOf = m => Theory.SOLFEGE[L2_CMAJ.indexOf(mod12(m))];
  const stopRec = () => { rec = false; bRec.textContent = '● Record'; };
  const paint = () => {
    strip.innerHTML = notes.length ? notes.map((n, k) => `<span class="n${k < opening ? ' op' : ''}">${SHARP[mod12(n.m)]}</span>`).join('') : '<span class="empty">Press Record, then play</span>';
    const last = notes[notes.length - 1];
    endEl.className = 'l2-end' + (last ? (mod12(last.m) === 0 ? ' good' : ' info') : '');
    endEl.textContent = !last ? '' : mod12(last.m) === 0 ? 'Ends on C (do): home.' : `Ends on ${SHARP[mod12(last.m)]} (${solOf(last.m)}). Head for C (do).`;
    bPlay.disabled = !notes.length; bClear.disabled = !notes.length || saved; bSave.disabled = saved || notes.length < min;
  };
  const choose = id => {
    if (saved) return;
    picked = list.find(s => s.id === id) || null;
    el.querySelectorAll('.l2-sk').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === (picked ? picked.id : ''))));
    conv = picked ? l2InC(picked.notes) : null;
    notes = []; opening = 0; stopRec(); grow.hidden = false;
    motifRow.hidden = !picked; useBtn.hidden = !conv;
    if (!picked) from.textContent = 'Start with a short idea of your own, answer it, then head home to C.';
    else if (!conv) from.textContent = `“${picked.name}” uses notes outside C major, so borrow its shape instead: ${l2Contour(picked.notes)}.`;
    else if (!conv.shift) from.textContent = `“${picked.name}” already fits C major. Use it as your opening, then keep going.`;
    else from.textContent = `“${picked.name}” lives on black keys. Moved ${conv.shift > 0 ? 'up' : 'down'} one half step, every note lands on a white key: ${names(picked.notes)} becomes ${names(conv.notes)}. Same shape, now in C major.`;
    fb(f, 'info', `White keys only. About two bars: ${min} to ${max} notes, ending on C (do).`);
    paint();
  };
  el.querySelectorAll('.l2-sk').forEach(b => { b.onclick = () => choose(b.dataset.id); });
  el.querySelector('[data-act="hearmotif"]').onclick = () => { if (picked) Sound.seq((conv ? conv.notes : picked.notes).map(n => ({ m: n.m, t: n.t, d: 0.4 }))); };
  useBtn.onclick = () => { if (!conv || saved) return; stopRec(); notes = conv.notes.map(n => Object.assign({}, n)); opening = notes.length; paint(); fb(f, 'info', 'That is your opening. Press Record and carry on from it.'); };
  bRec.onclick = () => {
    if (saved) return;
    if (rec) { stopRec(); return; }
    rec = true; tStart = null; base = notes.length ? notes[notes.length - 1].t + 0.6 : 0; bRec.textContent = '■ Stop';
    fb(f, 'info', notes.length ? 'Recording. Carry on from the end of the strip.' : 'Recording. Play your phrase.');
  };
  bPlay.onclick = () => Sound.seq(notes.map(n => ({ m: n.m, t: n.t, d: 0.45 })));
  bClear.onclick = () => { notes = []; opening = 0; paint(); };
  bSave.onclick = () => {
    if (saved) return;
    if (notes.length < min) { fb(f, 'bad', `A phrase needs at least ${min} notes.`); return; }
    const last = notes[notes.length - 1];
    if (mod12(last.m) !== 0) { fb(f, 'bad', `Your phrase ends on ${SHARP[mod12(last.m)]} (${solOf(last.m)}), so it sounds unfinished. Record a C (do) at the end.`); return; }
    stopRec(); saved = true;
    const s = saveSketch({ name: nameEl.value.trim() || (picked ? picked.name + ' phrase' : 'Phrase ' + (Store.data.sketches.length + 1)), notes: notes.map(n => ({ m: n.m, t: n.t, d: 0.45 })), prompt: 'Grow your motif into a phrase', level: 2, from: picked ? picked.id : undefined, key: 'C' });
    Sound.seq(s.notes);
    fb(f, 'good', `Saved “${s.name}” to your sketchbook. Listen: it ends on do, home.`);
    paint(); done(true);
  };
  const off = Bus.on('note', d => {
    if (!rec || saved) return;
    if (L2_CMAJ.indexOf(mod12(d.midi)) < 0) { fb(f, 'bad', `${noteName(d.midi)} is a black key, outside C major. White keys only.`); return; }
    const now = d.t || Sound.now(); if (tStart === null) tStart = now;
    notes.push({ m: d.midi, t: +(base + Math.min(12, now - tStart)).toFixed(3), d: 0.45 });
    if (notes.length >= max) { stopRec(); fb(f, 'info', `${max} notes is plenty. Play it back, then save.`); }
    else fb(f, 'info', `${notes.length} note${notes.length > 1 ? 's' : ''}.`);
    paint();
  });
  if (!list.length) choose('');
  return () => off();
};

/* ---------- interval table with play buttons (2.7) ---------- */
function l2IntervalTable(el) {
  el.innerHTML = `<div class="tbl-wrap"><table class="tbl l2-itbl"><thead><tr><th scope="col"><span class="l2-sr">Play</span></th><th scope="col">Interval</th><th scope="col">Song anchor</th></tr></thead><tbody>${Theory.INTERVALS.slice(1).map(x => `<tr><td><button type="button" class="btn small" data-s="${x.semis}" aria-label="Play ${l2A(x.name)} ${x.name}">▶</button></td><td><b>${x.name}</b><small>${x.short} · ${x.semis} half step${x.semis > 1 ? 's' : ''}</small></td><td>${x.song}<small>${x.hint}</small></td></tr>`).join('')}</tbody></table></div>`;
  const click = ev => { const b = ev.target.closest('[data-s]'); if (b) Sound.seq([{ m: 60, t: 0, d: 0.6 }, { m: 60 + +b.dataset.s, t: 0.7, d: 0.9 }]); };
  el.addEventListener('click', click);
  return () => el.removeEventListener('click', click);
}
const L2_DEG_TABLE = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Degree</th><th scope="col">Solfège</th><th scope="col">Name</th></tr></thead><tbody>${Theory.DEGREE_NAMES.map((nm, k) => `<tr><td class="mono">${k + 1}</td><td>${Theory.SOLFEGE[k]}</td><td>${nm}</td></tr>`).join('')}</tbody></table></div>`;

/* ---------- review card types ---------- */
/* { type: 'l2staff', clef }: read one note on the staff and play it; right on the first try counts */
CARD_TYPES.l2staff = (el, c, fin) => Tasks.staffSprint(el, { clef: c.clef, rounds: 1, prompt: 'Play this note, in any octave.' }, (ok, r) => fin(r.score === 1));
/* { type: 'l2ask', gen() → playAsked item }: play the note asked; right on the first try counts */
CARD_TYPES.l2ask = (el, c, fin) => Tasks.playAsked(el, { items: [c.gen()] }, (ok, r) => fin(r.firstTry === 1));
/* { type: 'l2clap', r, m, bpm }: one clap-back try */
CARD_TYPES.l2clap = (el, c, fin) => Tasks.rhythmEcho(el, { patterns: [{ r: c.r, m: c.m || 4 }], rounds: 1, bpm: c.bpm || 72, once: true, prompt: 'Hear it, then clap or tap it back. One try.' }, (ok, r) => fin(!!r.ok));

/* =================================================================
   Level 2 content
   ================================================================= */
const L2_UNITS = [
  { id: '2.1', title: 'Notes on the treble staff', blurb: 'Five lines, four spaces and two landmarks.', steps: [
    { k: 'card', tag: 'Hear', title: 'Up the staff', play: L2_TREBLE.slice(0, 8).map((n, i) => ({ m: Theory.midi(n), t: i * 0.4, d: 0.38 })), playLabel: 'Play C to C',
      art: Staff.svg({ clef: 'treble', notes: L2_TREBLE.slice(0, 8), labels: L2_TREBLE.slice(0, 8).map(Theory.stripOct), gap: 40 }),
      body: '<p>Press play and watch the notes climb. Music is written on a <b>staff</b>: five lines and the four spaces between them. Higher on the staff means higher in pitch.</p><p>Each step up, line to space to line, is the next letter: C D E F G A B C.</p>' },
    { k: 'card', tag: 'Name', title: 'Two landmarks', play: [{ m: 67, t: 0, d: 0.7 }, { m: 60, t: 0.9, d: 0.9 }], playLabel: 'Play G4, then middle C',
      art: Staff.svg({ clef: 'treble', notes: [{ n: 'G4', mark: 'target', label: 'G4' }, { n: 'C4', mark: 'target', label: 'middle C' }], gap: 96 }),
      body: '<p>The sign at the start is the <b>treble clef</b>, also called the G clef: its curl wraps round the 2nd line, and that line is <b>G4</b>.</p><p><b>Middle C</b> (C4) sits on its own short line below the staff, a <b>ledger line</b>. Find any nearby note by counting letters from one of these two.</p>' },
    { k: 'task', tag: 'Echo', title: 'Read and play', type: 'staffSprint', p: { clef: 'treble', pool: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'], rounds: 5, prompt: 'Play the note you see, in any octave. Count from middle C or from G.' } },
    { k: 'card', tag: 'Name', title: 'Lines and spaces', play: ['E4', 'G4', 'B4', 'D5', 'F5', 'F4', 'A4', 'C5', 'E5'].map((n, i) => ({ m: Theory.midi(n), t: i * 0.42 + (i > 4 ? 0.5 : 0), d: 0.38 })), playLabel: 'Play the lines, then the spaces',
      art: Staff.svg({ clef: 'treble', notes: ['E4', 'G4', 'B4', 'D5', 'F5', 'F4', 'A4', 'C5', 'E5'].map((n, i) => ({ n, mark: i < 5 ? 'target' : '' })), labels: 'E G B D F F A C E'.split(' '), gap: 36, aria: 'Treble staff: lines E G B D F, spaces F A C E' }),
      body: '<p>The five lines, bottom to top, are E G B D F. The four spaces, bottom to top, spell a word: F A C E.</p><p class="hook">Lines: <b>Every Good Boy Does Fine</b>. Spaces: <b>FACE</b>.</p>' },
    { k: 'task', tag: 'Explore', title: 'Every note from middle C to A5', type: 'staffSprint', p: { clef: 'treble', rounds: 8, prompt: 'Use the sayings, or count from a landmark.' } },
    { k: 'task', tag: 'Explore', title: 'Staff sprint', type: 'staffSprint', p: { clef: 'treble', rounds: 8, limit: 6, pass: 6, passMsg: 'Sprint done.', prompt: 'Six seconds per note. You need 6 of 8.' } }
  ] },
  { id: '2.2', title: 'Bass clef and the grand staff', blurb: 'The F clef for low notes, and middle C between the staves.', steps: [
    { k: 'card', tag: 'Hear', title: 'Low notes, second staff', play: l2Naturals('C3', 'C4').map((n, i) => ({ m: Theory.midi(n), t: i * 0.4, d: 0.38 })), playLabel: 'Play C3 up to middle C',
      art: Staff.svg({ clef: 'bass', notes: l2Naturals('C3', 'C4'), labels: l2Naturals('C3', 'C4').map(Theory.stripOct), gap: 40 }),
      body: '<p>Low notes would need a ladder of ledger lines under the treble staff, so they get a staff of their own with the <b>bass clef</b>. Press play and watch C3 climb to middle C.</p><p>The bass clef is also called the F clef: its two dots sit either side of the 4th line, and that line is <b>F3</b>.</p>' },
    { k: 'task', tag: 'Echo', title: 'Read and play', type: 'staffSprint', p: { clef: 'bass', pool: ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4'], rounds: 5, prompt: 'Play the note you see, in any octave. Count from F, between the dots, or from middle C at the top.' } },
    { k: 'card', tag: 'Name', title: 'Bass lines and spaces', play: ['G2', 'B2', 'D3', 'F3', 'A3', 'A2', 'C3', 'E3', 'G3'].map((n, i) => ({ m: Theory.midi(n), t: i * 0.42 + (i > 4 ? 0.5 : 0), d: 0.38 })), playLabel: 'Play the lines, then the spaces',
      art: Staff.svg({ clef: 'bass', notes: ['G2', 'B2', 'D3', 'F3', 'A3', 'A2', 'C3', 'E3', 'G3'].map((n, i) => ({ n, mark: i < 5 ? 'target' : '' })), labels: 'G B D F A A C E G'.split(' '), gap: 36, aria: 'Bass staff: lines G B D F A, spaces A C E G' }),
      body: '<p>The bass staff has its own names. Lines, bottom to top: G B D F A. Spaces: A C E G.</p><p class="hook">Lines: <b>Good Boys Do Fine Always</b>. Spaces: <b>All Cows Eat Grass</b>.</p>' },
    { k: 'card', tag: 'Name', title: 'The grand staff', play: [{ m: 53, t: 0, d: 0.6 }, { m: 60, t: 0.7, d: 0.6 }, { m: 67, t: 1.4, d: 0.8 }], playLabel: 'Play F3, C4, G4',
      art: Staff.svg({ clef: 'grand', notes: [{ n: 'F3', staff: 'bass', label: 'F3', mark: 'target' }, { n: 'C4', staff: 'bass', label: 'C4' }, { n: 'C4', staff: 'treble', label: 'C4' }, { n: 'G4', staff: 'treble', label: 'G4', mark: 'target' }], gap: 64, aria: 'Grand staff: F3 on the bass staff, middle C written on both staves, G4 on the treble staff' }),
      body: '<p>Piano music joins the two staves into the <b>grand staff</b>: treble on top for the right hand, bass below for the left.</p><p>Middle C sits between them. Written just above the bass staff or just below the treble staff, it is the same note and the same key. F3, middle C and G4 are your three landmarks.</p>' },
    { k: 'task', tag: 'Explore', title: 'Every note from E2 to middle C', type: 'staffSprint', p: { clef: 'bass', rounds: 8, prompt: 'Use the sayings, or count from F or middle C.' } },
    { k: 'task', tag: 'Explore', title: 'Staff sprint: both staves', type: 'staffSprint', p: { clef: 'grand', rounds: 8, limit: 6, pass: 6, passMsg: 'Both staves read.', prompt: 'Notes jump between the staves. Six seconds each; you need 6 of 8.' } }
  ] },
  { id: '2.3', title: 'The major scale recipe', blurb: 'Two matching halves and one number pattern.', steps: [
    { k: 'card', tag: 'Hear', title: 'A climb you know', play: l2ScaleNotes('C').map((n, i) => ({ m: Theory.midi(n), t: i * 0.42, d: 0.4 })), playLabel: 'Play it',
      body: '<p>Press play. You have heard this climb thousands of times: do re mi fa sol la ti do. It is the <b>C major scale</b>, all white keys from one C to the next.</p><p>It sounds even, but the steps are not all the same size. Play it and find out.</p>' },
    { k: 'task', tag: 'Echo', title: 'Play it up', type: 'scaleWalk', p: { prompt: 'Play C major up, from C to the next C. Watch the gaps fill in as you play.', notes: l2ScaleNotes('C'), steps: true, endText: 'W W H W W W H. The two half steps are E to F and B to C.' } },
    { k: 'task', tag: 'Explore', title: 'Play it down', type: 'scaleWalk', p: { prompt: 'Now from the top C down to C. Same gaps, read backwards.', notes: l2ScaleNotes('C').slice().reverse(), steps: true, endText: 'H W W W H W W: the recipe read backwards.' } },
    { k: 'card', tag: 'Name', title: 'The recipe', art: l2StepsArt(),
      body: '<p>Count each gap in half steps and C major comes out as <b>2-2-1-2-2-2-1</b>: whole, whole, half, whole, whole, whole, half.</p><p>Look at the two halves. C D E F goes whole, whole, half. G A B C goes whole, whole, half too. Two matching halves, joined by a whole step from F to G.</p><p class="hook">Recipe <b>2-2-1-2-2-2-1</b>. Start it on any note and you get that note’s major scale.</p>' }
  ] },
  { id: '2.4', title: 'Build any major scale', blurb: 'Same recipe, any starting note. Every letter once.', steps: [
    { k: 'card', tag: 'Hear', title: 'Same recipe, new start', play: l2ScaleNotes('G').map((n, i) => ({ m: Theory.midi(n), t: i * 0.42, d: 0.4 })), playLabel: 'Play a major scale from G', art: l2RecipeGuide(),
      body: '<p>Press play: the same climb, starting on G. Any note can be the start, as long as the gaps follow the recipe.</p><p>Next you build it yourself. The note names stay hidden, so trust the recipe and your ears.</p>' },
    { k: 'task', tag: 'Echo', title: 'Build G major', type: 'scaleBuild', p: { roots: ['G'] } },
    { k: 'task', tag: 'Explore', title: 'Build F major', type: 'scaleBuild', p: { roots: ['F'] } },
    { k: 'card', tag: 'Name', title: 'Every letter once',
      art: () => `<div class="l2-art2">${Staff.svg({ clef: 'treble', notes: l2ScaleNotes('F').map(n => n === 'B♭4' ? { n, mark: 'ok' } : n), labels: l2ScaleNotes('F').map(Theory.stripOct), gap: 38, aria: 'F major spelled with B flat' })}${Staff.svg({ clef: 'treble', notes: ['F4', 'G4', 'A4', { n: 'A♯4', mark: 'no' }, 'C5', 'D5', 'E5', 'F5'], labels: ['F', 'G', 'A', 'A♯', 'C', 'D', 'E', 'F'], gap: 38, aria: 'F major wrongly spelled with A sharp: two As and no B' })}${Staff.svg({ clef: 'treble', notes: [{ n: 'B♭4', label: 'B♭' }, { n: 'B4', acc: 'natural', label: 'B♮' }], gap: 56, aria: 'B flat, then B natural' })}</div>`,
      body: '<p>A major scale uses <b>every letter once, in order</b>. In F major the 4th note is the black key between A and B. Call it A♯ and you get two As and no B (the red note). Call it <b>B♭</b> and every letter appears once: F G A B♭ C D E.</p><p>The <b>natural sign ♮</b> cancels a sharp or flat: B♮ is plain B, the white key.</p><p class="hook">“Every letter once, in order.”</p>' },
    { k: 'task', tag: 'Explore', title: 'Four more', type: 'scaleBuild', p: { roots: ['D', 'A', 'B♭', 'E♭'], prompt: 'D, A, B♭ and E♭ major. Start on the note named, follow the recipe, and see which sharps or flats it needs.' } },
    { k: 'task', tag: 'Name', title: 'Spell it', type: 'quizL2', p: () => ({ rounds: 4, pass: 3, prompt: 'Every letter once: pick the right spelling.', gen: l2SpellQ }) }
  ] },
  { id: '2.5', title: 'Solfège and scale degrees', blurb: 'Do is home. Every note of the scale has a name and a job.', steps: [
    { k: 'card', tag: 'Hear', title: 'Do re mi', play: l2ScaleNotes('C').map((n, i) => ({ m: Theory.midi(n), t: i * 0.5, d: 0.45 })), playLabel: 'Play and sing along',
      art: Staff.svg({ clef: 'treble', notes: l2ScaleNotes('C'), labels: Theory.SOLFEGE.concat(['do']), gap: 40, aria: 'C major with solfège: do re mi fa sol la ti do' }),
      body: '<p>Press play and sing along: do re mi fa sol la ti do. These syllables are <b>solfège</b>. They name a note’s place in the scale, not its letter, so they work in every key.</p><p>In C major, do is C. In G major, do is G.</p>' },
    { k: 'task', tag: 'Echo', title: 'Do moves to G', type: 'scaleWalk', p: { prompt: 'Sing or play G major up, by syllable. Do is G now.', notes: l2ScaleNotes('G'), show: 'solfege', hint: (i, want) => `${Theory.SOLFEGE[i % 7]} in G major is ${Theory.stripOct(want)}.`, endText: 'Do re mi fa sol la ti do, in G: G A B C D E F♯ G.' } },
    { k: 'card', tag: 'Name', title: 'Degrees have names', marks: [0, 4, 7], art: L2_DEG_TABLE,
      play: [60, 62, 64, 65, 67, 69].map((m, i) => ({ m, t: i * 0.38, d: 0.36 })).concat([{ m: 71, t: 2.3, d: 1.3 }, { m: 72, t: 3.9, d: 1.1 }]), playLabel: 'Hear ti pull to do',
      body: '<p>Each degree also has a number (1 to 7) and a name. The <b>tonic</b> (1) is home. The <b>dominant</b> (5) pulls hardest back to it. The <b>leading tone</b> (7) leans up into do, a half step away: press play and wait for it.</p><p class="hook"><b>Do = home.</b> Do, mi and sol together make the <b>home chord</b> (glowing on the keys).</p>' },
    { k: 'task', tag: 'Explore', title: 'Play the degree', type: 'playAsked', p: () => ({ prompt: 'Play the degree asked, in any octave. Do glows on the keys.', items: [0, 1, 2, 3, 4, 5].map(() => l2DegreeItem()) }) },
    { k: 'task', tag: 'Echo', title: 'Where does it end?', type: 'quizL2', p: { rounds: 5, pass: 3, prompt: 'Listen for home: does the tune end on do, mi or sol?', gen: l2EndingQ } }
  ] },
  { id: '2.6', title: 'Intervals: count the letters', blurb: 'Measure the distance between two notes by counting letters.', steps: [
    { k: 'card', tag: 'Hear', title: 'Near and far', play: [[60, 62], [60, 64], [60, 67], [60, 72]].reduce((a, [x, y], i) => a.concat([{ m: x, t: i * 1.4, d: 0.5 }, { m: y, t: i * 1.4 + 0.55, d: 0.7 }]), []), playLabel: 'Play four pairs',
      art: Staff.svg({ clef: 'treble', notes: [['C4', 'D4'], ['C4', 'E4'], ['C4', 'G4'], ['C4', 'C5']], labels: ['C–D', 'C–E', 'C–G', 'C–C'], gap: 64 }),
      body: '<p>Press play: C with D, then with E, then G, then the C above. The distance from one note to another is an <b>interval</b>. Here it grows each time.</p>' },
    { k: 'card', tag: 'Name', title: 'Count both ends',
      art: Staff.svg({ clef: 'treble', notes: ['C4', 'D4', 'E4', 'F4', 'G4'].map((n, i) => ({ n, mark: i === 0 || i === 4 ? 'target' : '' })), labels: ['1', '2', '3', '4', '5'], gap: 44, aria: 'C up to G: five letters, a 5th' }),
      body: '<p>To name an interval, count the letters from the bottom note to the top note, and <b>count both ends</b>. C up to E: C (1), D (2), E (3). That is a <b>3rd</b>.</p><p>C up to G is C D E F G: five letters, a <b>5th</b>. The same letter one octave up is an <b>octave</b>, an 8th.</p><p class="hook">“Count the letters, include both ends.”</p>' },
    { k: 'task', tag: 'Echo', title: 'From C', type: 'playAsked', p: () => ({ prompt: 'Three intervals from C, the glowing key.', items: [l2LetterItem('C', 2), l2LetterItem('C', 3), l2LetterItem('C', 5)] }) },
    { k: 'card', tag: 'Name', title: 'Lines and spaces tell you',
      art: Staff.svg({ clef: 'treble', notes: [['E4', 'G4'], ['E4', 'B4'], ['E4', 'F4'], ['E4', 'A4']], labels: ['3rd', '5th', '2nd', '4th'], gap: 64, aria: 'E to G a 3rd, E to B a 5th, E to F a 2nd, E to A a 4th' }),
      body: '<p>On the staff you can see the number without counting. <b>Line to line</b> or <b>space to space</b> is an odd number: a 3rd, 5th or 7th. <b>Line to space</b> is even: a 2nd, 4th or 6th.</p><p>A 3rd is the next line up (or the next space). A 5th skips one line.</p>' },
    { k: 'task', tag: 'Explore', title: 'Any starting note', type: 'playAsked', p: () => ({ prompt: 'White keys only. Count letters up from the glowing key.', items: [0, 1, 2, 3, 4, 5].map(() => l2LetterItem()) }) },
    { k: 'task', tag: 'Name', title: 'Read it on the staff', type: 'quizL2', p: { rounds: 5, pass: 4, gen: l2StaffIntQ } }
  ] },
  { id: '2.7', title: 'Interval sizes and song anchors', blurb: 'Half steps give each interval its size. Songs make it stick.', steps: [
    { k: 'card', tag: 'Hear', title: 'Two kinds of 3rd', play: [{ m: 60, t: 0, d: 0.5 }, { m: 64, t: 0.55, d: 0.9 }, { m: 60, t: 1.9, d: 0.5 }, { m: 63, t: 2.45, d: 0.9 }], playLabel: 'C to E, then C to E♭',
      art: Staff.svg({ clef: 'treble', notes: [['C4', 'E4'], ['C4', 'E♭4']], labels: ['major 3rd', 'minor 3rd'], gap: 100 }),
      body: '<p>Press play: two 3rds. Both span three letters, C to E. The first is 4 half steps wide and sounds bright. The second is 3 half steps and sounds darker.</p><p>The letters give the number; the half steps give the <b>quality</b>: <b>major</b> (larger) or <b>minor</b> (smaller).</p>' },
    { k: 'card', tag: 'Name', title: 'Every size has a song', mount: l2IntervalTable,
      body: '<p>2nds, 3rds, 6ths and 7ths come major or minor. Unisons, 4ths, 5ths and octaves are <b>perfect</b>. The one in the middle, 6 half steps, is the <b>tritone</b>.</p><p>Tap ▶ to hear an interval’s two notes, then sing the start of its song to match.</p><p class="hook">Song anchors: think of the song and you can hear the interval.</p>' },
    { k: 'task', tag: 'Echo', title: 'Measure in half steps', type: 'playAsked', p: () => ({ prompt: 'Count half steps up from the glowing key: every key counts, black or white.', items: [0, 1, 2, 3, 4].map(() => l2SizeItem()) }) },
    { k: 'task', tag: 'Explore', title: 'Name it by ear', type: 'quizL2', p: { rounds: 6, pass: 4, prompt: 'Two notes, low then high. Which interval? The songs are your hints.', gen: () => l2IntervalQ(L2_EAR_POOL) } }
  ] },
  { id: '2.8', title: 'Three beats, dots and ties', blurb: 'Waltz time, dotted notes and ties.', steps: [
    { k: 'card', tag: 'Hear', title: 'ONE two three', play: l2Waltz, playLabel: 'Play two bars of waltz', art: l2RhythmArt('q q q', 3, true),
      body: '<p>Press play: ONE two three, ONE two three. Three beats in every bar, the first one strong. That is <b>3/4</b> time, the beat of a waltz.</p><p>The top number says how many beats fill a bar. The 4 underneath says each beat is a quarter note.</p>' },
    { k: 'task', tag: 'Echo', title: 'Clap in 3/4', type: 'rhythmEcho', p: { patterns: ['q q q', 'h q', 'q h', 'h.'], meter: 3, rounds: 3, bpm: 80, counts: true } },
    { k: 'card', tag: 'Name', title: 'A dot adds half again', art: l2RhythmArt('h.', 3, true) + l2RhythmArt('q. e q q', 4, true), play: () => l2PlayRhythm('q. e q q', 4, 72, true), playLabel: 'Hear ta-i ti ta ta',
      body: '<p>A <b>dot</b> after a note adds half its length again. A half note (2 beats) plus half again (1) is a <b>dotted half</b>: 3 beats, a whole bar of 3/4. Say ta-a-a.</p><p>A quarter note (1 beat) plus half again (½) is a <b>dotted quarter</b>: 1½ beats, usually followed by an eighth note to fill the gap. Say <b>ta-i ti</b>: “ta-i” holds through the first half of beat 2, and “ti” lands on its “and”.</p><p class="hook">“A dot adds half again.”</p>' },
    { k: 'card', tag: 'Name', title: 'Ties', art: l2RhythmArt('q q_q q', 4, true), play: () => l2PlayRhythm('q q_q q', 4, 72, true), playLabel: 'Hear ta ta-a ta',
      body: '<p>A <b>tie</b> is a curve joining two notes of the same pitch into one sound. Clap or play the first, then hold through the second. Here the 2nd and 3rd notes make one sound, 2 beats long.</p><p>Say the held part as “-a”: ta ta -a ta. Ties let a sound last across a beat or a bar line where no single note shape fits.</p>' },
    { k: 'task', tag: 'Explore', title: 'Dots and ties', type: 'rhythmEcho', p: { patterns: [{ r: 'q. e q q', m: 4 }, { r: 'q q_q q', m: 4 }, { r: 'h. q', m: 4 }, { r: 'q. e q', m: 3 }, { r: 'q. e h', m: 4 }, { r: 'h_q q', m: 4 }], rounds: 3, bpm: 72, counts: true } }
  ] },
  { id: '2.9', title: 'Eighth rests and sixteenths', blurb: 'Split the beat in two and in four, and count the silences.', steps: [
    { k: 'card', tag: 'Hear', title: 'One beat, four sounds', art: l2RhythmArt('q e e s s s s q', 4, true), play: () => l2PlayRhythm('q e e s s s s q', 4, 66, true), playLabel: 'Hear ta ti-ti ti-ka-ti-ka ta',
      body: '<p>Press play: one beat with one sound, then two, then four. Four <b>sixteenth notes</b> fit in one beat. Say <b>ti-ka-ti-ka</b>, or count <b>1 e & a</b>.</p><p>Eighth notes are joined by one beam, sixteenths by two.</p>' },
    { k: 'card', tag: 'Name', title: 'Half-beat silences', art: l2RhythmArt('q er e q er e', 4, true), play: () => l2PlayRhythm('q er e q er e', 4, 72, true), playLabel: 'Hear ta sh-ti ta sh-ti',
      body: '<p>An eighth note on its own has a <b>flag</b> instead of a beam. An <b>eighth rest</b> is half a beat of silence: say “sh”, and clap only on the “and” after it.</p><p>Count 1 & 2 & 3 & 4 &. Here you clap on 1, the & of 2, on 3, and the & of 4.</p>' },
    { k: 'task', tag: 'Echo', title: 'Rests and single eighths', type: 'rhythmEcho', p: { patterns: ['q er e q q', 'q q er e q', 'er e q er e q', 'e er q e er q'], rounds: 3, bpm: 72, counts: true } },
    { k: 'card', tag: 'Name', title: 'ta · ti-ti · ti-ka-ti-ka', art: l2RhythmArt('q e e s s s s', 3, true),
      body: '<p>One beat can hold one sound (ta), two (ti-ti) or four (ti-ka-ti-ka). Counting out loud keeps them even: “1” for ta, “1 &” for ti-ti, “1 e & a” for ti-ka-ti-ka.</p><p class="hook"><b>ta · ti-ti · ti-ka-ti-ka</b>: one beat split into 1, 2 or 4.</p>' },
    { k: 'task', tag: 'Explore', title: 'Sixteenths', type: 'rhythmEcho', p: { patterns: ['s s s s q q q', 'q s s s s q q', 'q q s s s s q', 'e e s s s s h'], rounds: 3, bpm: 60, counts: true, prompt: 'Slower now, so the sixteenths fit. Listen, then clap or tap it back.' } }
  ] },
  { id: '2.P', title: 'Grow your motif into a phrase', blurb: 'Turn a sketch into two bars in C major that end on do.', create: true, steps: [
    { k: 'card', tag: 'Hear', title: 'Question and answer', play: ['E4', 'F4', 'G4', 'A4', 'G4'].map((n, i) => ({ m: Theory.midi(n), t: i * 0.45, d: i === 4 ? 0.9 : 0.4 })).concat(['G4', 'F4', 'E4', 'D4', 'C4'].map((n, i) => ({ m: Theory.midi(n), t: 3.2 + i * 0.45, d: i === 4 ? 1.1 : 0.4 }))), playLabel: 'Play two short tunes',
      body: '<p>Press play: two short tunes. The first stops on sol and sounds like a question. The second comes home to do and sounds finished.</p><p>A <b>phrase</b> is a musical sentence, often two bars long. Like a sentence, it needs an ending, and in C major the strongest ending is C: do.</p>' },
    { k: 'card', tag: 'Name', title: 'Grow it, don’t start over',
      body: '<p>Composers rarely invent a whole phrase at once. They take a motif and grow it: play it, repeat it a step higher, turn it upside down, or stretch its last note. Then they head for home.</p><p>Your Level 1 motif lives on black keys. Move every note up one half step and it lands on white keys, ready for C major.</p>' },
    { k: 'task', tag: 'Create', title: 'Your phrase', type: 'phraseGrow', p: { min: 5, max: 16 } }
  ] },
  { id: '2.B', title: 'Boss challenge', blurb: 'Read both staves, play a scale with the names hidden, name intervals by ear.', boss: true, steps: [
    { k: 'card', tag: 'Name', title: 'Show what you know', body: '<p>Part 1: read 8 notes across both staves and play each within 5 seconds, in any octave. You need 7.</p><p>Part 2: play a major scale up one octave from the note named, with the names hidden. Up to 2 wrong notes are fine.</p><p>Part 3: name 6 intervals by ear. You need 5.</p>' },
    { k: 'task', tag: 'Echo', title: 'Part 1: read and play', type: 'staffSprint', p: { clef: 'grand', rounds: 8, limit: 5, pass: 7, passMsg: 'Part 1 passed.', prompt: 'Five seconds per note. You need 7 of 8.' } },
    { k: 'task', tag: 'Explore', title: 'Part 2: a major scale', type: 'scaleTest', p: { roots: ['G', 'D', 'A', 'F', 'B♭', 'E♭'], allow: 2, passMsg: 'Part 2 passed.' } },
    { k: 'task', tag: 'Name', title: 'Part 3: intervals by ear', type: 'quizL2', p: { rounds: 6, pass: 5, passMsg: 'Part 3 passed.', prompt: 'Two notes, low then high. Name the interval. You need 5 of 6.', gen: () => l2IntervalQ(L2_BOSS_POOL) } }
  ] }
];

/* Review deck: unlocked when the unit that teaches it is finished */
const L2_CARDS = {
  '2.1': [
    { id: 'l2-treble-read', type: 'l2staff', clef: 'treble' },
    { id: 'l2-treble-name', type: 'gen', gen: () => l2NameQ('treble') },
    { id: 'l2-treble-saying', type: 'gen', gen: () => l2SayingQ('treble') }
  ],
  '2.2': [
    { id: 'l2-bass-read', type: 'l2staff', clef: 'bass' },
    { id: 'l2-grand-read', type: 'l2staff', clef: 'grand' },
    { id: 'l2-bass-name', type: 'gen', gen: () => l2NameQ('bass') },
    { id: 'l2-bass-saying', type: 'gen', gen: () => l2SayingQ('bass') }
  ],
  '2.3': [
    { id: 'l2-cmajor', type: 'seq', prompt: 'Play C major up, C to C. Watch the W and H fill in.', notes: l2ScaleNotes('C'), steps: true },
    { id: 'l2-recipe', type: 'choice', q: 'The major scale recipe, in half steps, is…', options: ['2-2-1-2-2-2-1', '2-1-2-2-1-2-2', '2-2-2-1-2-2-1'], answer: 0, why: 'Whole, whole, half, whole, whole, whole, half: two W W H halves joined by a W.' },
    { id: 'l2-halfsteps', type: 'choice', q: 'In C major, the half steps fall between…', options: ['E and F, B and C', 'C and D, F and G', 'D and E, A and B'], answer: 0, why: 'E–F and B–C have no black key between them.' }
  ],
  '2.4': ['G', 'F', 'D', 'A', 'B♭', 'E♭'].map(r => ({ id: 'l2-scale-' + r.replace('♭', 'b'), type: 'seq', prompt: `Play ${r} major up one octave. The names stay hidden: follow the recipe.`, notes: l2ScaleNotes(r), show: 'hidden', steps: true }))
    .concat([{ id: 'l2-spell', type: 'gen', gen: l2SpellQ }]),
  '2.5': [
    { id: 'l2-degree-play', type: 'l2ask', gen: () => l2DegreeItem() },
    { id: 'l2-degree-name', type: 'gen', gen: l2DegNameQ },
    { id: 'l2-ending', type: 'gen', gen: l2EndingQ },
    { id: 'l2-solfa-F', type: 'seq', prompt: 'Sing or play F major up by syllable. Do is F.', notes: l2ScaleNotes('F'), show: 'solfege' }
  ],
  '2.6': [
    { id: 'l2-int-above', type: 'l2ask', gen: () => l2LetterItem() },
    { id: 'l2-int-count', type: 'gen', gen: l2CountQ },
    { id: 'l2-int-staff', type: 'gen', gen: l2StaffIntQ }
  ],
  '2.7': [
    { id: 'l2-int-ear', type: 'gen', gen: () => l2IntervalQ(L2_EAR_POOL) },
    { id: 'l2-int-semis', type: 'gen', gen: l2SemisQ },
    { id: 'l2-int-song', type: 'gen', gen: l2SongQ },
    { id: 'l2-int-size', type: 'l2ask', gen: l2SizeItem }
  ],
  '2.8': [
    { id: 'l2-dots', type: 'gen', gen: l2DotQ },
    { id: 'l2-tie', type: 'choice', q: 'Two quarter notes joined by a tie are…', options: ['Clapped once and held for 2 beats', 'Clapped twice, quickly', 'Silent for 2 beats'], answer: 0, why: 'A tie makes one sound out of two notes: clap the first, hold through the second.' },
    { id: 'l2-34', type: 'choice', q: 'What does 3/4 time mean?', options: ['Three beats in every bar', 'Three bars per minute', 'Three quarter notes per minute'], answer: 0, why: 'The top number counts the beats in a bar; the 4 means each beat is a quarter note. ONE two three.' },
    { id: 'l2-clap-dot', type: 'l2clap', r: 'q. e q q', m: 4, bpm: 72 },
    { id: 'l2-clap-waltz', type: 'l2clap', r: 'q. e q', m: 3, bpm: 76 }
  ],
  '2.9': [
    { id: 'l2-16ths', type: 'choice', q: 'How many sixteenth notes fill one beat?', options: ['2', '4', '8'], answer: 1, why: 'Four: ti-ka-ti-ka, counted 1 e & a.' },
    { id: 'l2-count16', type: 'choice', q: 'How do you count four sixteenths on beat 1?', options: ['1 e & a', '1 & 2 &', '1 2 3 4'], answer: 0, why: '“1 e & a”: one sound per syllable, all inside one beat.' },
    { id: 'l2-erest', type: 'choice', q: 'An eighth rest lasts…', options: ['Half a beat of silence', 'One beat of silence', 'A quarter of a beat'], answer: 0, why: 'As long as an eighth note: half a beat. Say “sh”.' },
    { id: 'l2-clap-rest', type: 'l2clap', r: 'q er e q q', m: 4, bpm: 72 },
    { id: 'l2-clap-16', type: 'l2clap', r: 's s s s q q q', m: 4, bpm: 60 }
  ],
  '2.P': [
    { id: 'l2-phrase-end', type: 'choice', q: 'In C major, which last note makes a phrase sound finished?', options: ['C (do)', 'G (sol)', 'B (ti)'], answer: 0, why: 'Do is home. Ending on sol or ti leaves the phrase hanging, like a question.' }
  ]
};

addLevel({
  n: 2, title: 'Steps & Scales', tagline: 'Both staves, the major scale anywhere, solfège, intervals and more rhythms',
  units: L2_UNITS, cards: L2_CARDS,
  passText: 'You can read notes on both staves, build and play any major scale, sing it with solfège, name intervals by counting and by ear, and clap rhythms with dots, ties, rests and sixteenths.',
  create: {
    params: { pcs: L2_CMAJ, pcsLabel: 'C major', min: 3, max: 8 },
    prompts: [
      'Make a phrase in C major that ends on do (C).',
      'Make a phrase that moves by steps only: every note next to the one before.',
      'Make a phrase with exactly one leap, then step back the other way.',
      'Start on sol (G) and find your way home to do (C).',
      'Climb to la (A), then fall home to do (C).',
      'Use only do, mi and sol (C, E and G): the home chord, one note at a time.'
    ]
  },
  ear: {
    title: 'Name the interval', sub: 'Two notes, low then high. Which interval is it? The songs are hints.',
    run(body, finish) { return Tasks.quizL2(body, { rounds: 5, gen: () => l2IntervalQ(L2_EAR_POOL) }, (ok, r) => finish(r.score, 5)); }
  }
});
