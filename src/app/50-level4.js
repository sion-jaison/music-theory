/* =================================================================
   Level 4 · The Clock
   Key signatures, the Circle of Fifths, relative and parallel minors.
   New tasks: keyTonic, fillClock, circleWalk, familySlice, minorMood.
   New review card types: l4Tonic, l4Numeral.
   ================================================================= */

/* ---------- helpers ---------- */
const L4_SIGS = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
const l4At = (name, oct) => Theory.withOct(Theory.stripOct(name), oct);
/* a comfortable octave on the dock: G, A and B in octave 3, the rest in octave 4 */
const l4Mid = name => l4At(name, 'GAB'.indexOf(Theory.letterOf(name)) >= 0 ? 3 : 4);
const l4Hour = pos => (pos || 12) + ' o’clock';
const l4Seq = (notes, step) => { step = step || 0.3; return notes.map((n, i) => ({ m: typeof n === 'number' ? n : Theory.midi(n), t: i * step, d: step * 0.95 })); };
function l4SigWords(n) {
  if (!n) return 'no sharps or flats';
  const k = Math.abs(n);
  return k + (n > 0 ? ' sharp' : ' flat') + (k > 1 ? 's' : '');
}
/* a key signature on a staff (treble unless o.clef says bass); o.notes are drawn after it */
function l4Sig(n, o) {
  o = o || {};
  const clef = o.clef || 'treble';
  return `<div class="l4-sig${clef === 'grand' ? ' grand' : ''}">${Staff.svg({ clef, notes: o.notes || [], keySig: n, gap: o.gap || 64, aria: o.aria || `${clef} staff with ${l4SigWords(n)} in the key signature` })}</div>`;
}
/* the tonic as a note on the staff; the signature already covers its accidental */
const l4TonicNote = (tonic, clef, label, mark) => ({ n: l4At(tonic, clef === 'bass' ? 3 : 4), label, mark, acc: false });
const l4Fig = (svg, cap) => `<figure>${svg}${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
const l4Figs = figs => `<div class="l4-figs">${figs.join('')}</div>`;
const l4Hook = html => `<div class="hook">${html}</div>`;
/* options with the right answer and up to n − 1 distinct wrong ones (kept in the order given), shuffled */
function l4Choice(right, wrongs, n) {
  const pool = [];
  wrongs.forEach(w => { if (w !== right && pool.indexOf(w) < 0) pool.push(w); });
  const options = shuffle([right].concat(pool.slice(0, (n || 4) - 1)));
  return { options, answer: options.indexOf(right) };
}
/* how to read a signature, as a sentence */
function l4SigWhy(n, mode) {
  const sig = Theory.keySig(Theory.keyFromSig(n)), M = sig.major;
  let s = n === 0 ? 'No sharps or flats: C major.'
    : n > 0 ? `The last sharp is ${sig.acc[n - 1]}; a half step up is ${M}. ${M} major.`
      : n === -1 ? 'One flat, B♭: F major, the one to know by heart.'
        : `The second-to-last flat is ${sig.acc[-n - 2]}: ${M} major.`;
  if (mode === 'minor') s += ` Its relative minor, 3 half steps down, is ${sig.minor} minor.`;
  return s;
}
function l4TonicHint(n, mode, tries) {
  if (tries >= 2) return l4SigWhy(n, mode);
  if (mode === 'minor') return 'Name the major key first, then go down 3 half steps to its relative minor.';
  if (n === 0) return 'No sharps or flats at all. Which major scale uses only white keys?';
  if (n > 0) return `The last sharp is ${Theory.keySig(Theory.keyFromSig(n)).acc[n - 1]}. Go up a half step from it.`;
  if (n === -1) return 'One flat is the odd one out: learn it by heart. It is a 4th above C.';
  return 'Look at the second-to-last flat.';
}
/* "Which major (or minor) key has this signature?" */
function l4SigQ(n, mode, clef) {
  const minor = mode === 'minor', suffix = minor ? ' minor' : ' major';
  const right = Theory.keyFromSig(n, mode), sig = Theory.keySig(Theory.keyFromSig(n));
  const near = shuffle([n - 1, n + 1, n - 2, n + 2].filter(k => k >= -7 && k <= 7)).map(k => Theory.keyFromSig(k, mode));
  const slips = [Theory.keyFromSig(n, minor ? 'major' : 'minor')];
  if (!minor && n > 0) slips.push(sig.acc[n - 1]);        // the last sharp itself
  if (!minor && n < -1) slips.push(sig.acc[-n - 1]);      // the last flat instead of the second-to-last
  const ch = l4Choice(right + suffix, slips.concat(near).map(k => k + suffix));
  return { q: `Which ${minor ? 'minor' : 'major'} key has this signature?`, html: l4Sig(n, { clef }), options: ch.options, answer: ch.answer, why: l4SigWhy(n, mode) };
}
/* "A signature has 3 sharps. Which are they?" */
function l4OrderQ(sharp) {
  const k = randInt(2, 5), order = sharp ? Theory.ORDER_SHARPS : Theory.ORDER_FLATS, sym = sharp ? '♯' : '♭';
  const fmt = a => a.map(l => l + sym).join(' ');
  const right = fmt(order.slice(0, k));
  const ch = l4Choice(right, shuffle([fmt(order.slice(0, k).sort()), fmt(order.slice(0, k).reverse()), fmt((sharp ? Theory.ORDER_FLATS : Theory.ORDER_SHARPS).slice(0, k)), fmt(order.slice(1, k + 1))]));
  return {
    q: `A key signature has ${k} ${sharp ? 'sharps' : 'flats'}. Which are they, in order?`, options: ch.options, answer: ch.answer,
    why: sharp ? `Sharps arrive F C G D A E B, “Father Charles Goes Down And Ends Battle”: ${right}.` : `Flats arrive B E A D G C F, “Battle Ends And Down Goes Charles’ Father”: ${right}.`
  };
}
/* "One step clockwise from D is…" (skips the far side, where the names change spelling) */
function l4StepQ() {
  const cw = Math.random() < 0.5, pos = rand(cw ? [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11] : [0, 1, 2, 3, 4, 5, 8, 9, 10, 11]);
  const at = d => Theory.CIRCLE[(pos + d + 12) % 12], to = at(cw ? 1 : -1);
  const ch = l4Choice(to, [at(cw ? -1 : 1), at(cw ? 2 : -2), at(6), at(cw ? -2 : 2)]);
  return {
    q: `On the Circle of Fifths, what is one step ${cw ? 'clockwise' : 'anticlockwise'} from ${at(0)}?`, options: ch.options, answer: ch.answer,
    why: cw ? `Clockwise is up a 5th: ${at(0)} → ${to}. One more sharp, or one fewer flat.` : `Anticlockwise is up a 4th (down a 5th): ${at(0)} → ${to}. One more flat, or one fewer sharp.`
  };
}
/* a blank clock with one spot glowing */
const l4Spot = (pos, center) => `<div class="l4-qcircle">${Circle.svg({ static: true, hide: true, ring: 'major', sigs: false, marks: { [pos]: 'ask' }, center: center || [l4Hour(pos)] })}</div>`;
function l4HourQ() {
  const pos = rand([1, 2, 3, 4, 5, 7, 8, 9, 10, 11]), n = pos <= 5 ? pos : pos - 12, k = Math.abs(n);
  /* wrong answers: the other side's count, one more or fewer, and (on the flat side) the hour itself */
  const ch = l4Choice(l4SigWords(n), shuffle([l4SigWords(-n), l4SigWords(n > 0 ? n + 1 : n - 1), l4SigWords(n > 0 ? n - 1 : n + 1), n < 0 ? l4SigWords(-pos) : l4SigWords(n + 2)]));
  return {
    q: 'How many sharps or flats does the key at the glowing spot have?', html: l4Spot(pos), options: ch.options, answer: ch.answer,
    why: n > 0 ? `The hour is the number of sharps: ${Theory.CIRCLE[pos]} major has ${l4SigWords(n)}.` : `On the flat side, 12 − ${pos} = ${k}: ${Theory.CIRCLE[pos]} major has ${l4SigWords(n)}.`
  };
}
function l4WhereQ() {
  const pos = randInt(0, 11), at = d => Theory.CIRCLE[(pos + d + 12) % 12], alt = Theory.CIRCLE_ALT[pos];
  const ch = l4Choice(at(0), shuffle([at(1), at(-1), at(6), at(2)]));
  return {
    q: 'Which major key lives at the glowing spot?', html: l4Spot(pos), options: ch.options, answer: ch.answer,
    why: `${l4Hour(pos)} is ${at(0)} major${alt ? ` (also spelled ${alt.major} major)` : ''}, with ${Circle.sigText(pos).replace('no ♯ or ♭', 'no sharps or flats')}.`
  };
}
const L4_ENH = [['B', 'C♭', 5], ['F♯', 'G♭', 6], ['D♭', 'C♯', 7]];
function l4EnhQ() {
  const [a, b, pos] = rand(L4_ENH), flip = Math.random() < 0.5, from = flip ? b : a, right = flip ? a : b;
  const ch = l4Choice(right, shuffle(['C♭', 'G♭', 'C♯', 'B', 'F♯', 'D♭', 'E', 'A♭'].filter(x => x !== from)));
  const words = k => l4SigWords(Theory.keySig(k).n);
  return {
    q: `Which major key shares ${l4Hour(pos)} with ${from} major?`, html: l4Spot(pos, [from + ' major', l4Hour(pos)]), options: ch.options, answer: ch.answer,
    why: `${a} major (${words(a)}) and ${b} major (${words(b)}) are the same keys on the piano, spelled two ways. Sharps plus flats make 12.`
  };
}
/* the six chords of a key, read from (or remembered off) the circle */
function l4SliceQ(withArt) {
  const key = rand(['C', 'G', 'D', 'A', 'F', 'B♭', 'E♭']), roman = rand(['IV', 'V', 'vi', 'ii', 'iii']);
  const syms = ['I', 'IV', 'V', 'vi', 'ii', 'iii'].map(r => Theory.romanChord(r, key).sym);
  const right = Theory.romanChord(roman, key).sym;
  const ch = l4Choice(Theory.pretty(right), shuffle(syms.filter(s => s !== right)).map(Theory.pretty));
  return {
    q: `In ${key} major, which chord is ${roman}?`, html: withArt ? `<div class="l4-qcircle">${Circle.svg({ static: true, selected: Theory.circlePos(key), family: true, center: [key + ' major'] })}</div>` : '',
    options: ch.options, answer: ch.answer,
    why: `${key}’s slice: I ${syms[0]}, IV ${syms[1]} and V ${syms[2]} outside; vi ${syms[3]}, ii ${syms[4]} and iii ${syms[5]} inside. ${roman} is ${Theory.pretty(right)}.`
  };
}
function l4RelQ(toMinor) {
  if (toMinor) {
    const M = rand(['C', 'G', 'D', 'A', 'E', 'F', 'B♭', 'E♭']), right = Theory.relMinor(M);
    const ch = l4Choice(right + ' minor', shuffle([Theory.up(M, 'b3'), Theory.down(M, '5'), Theory.up(M, '3'), Theory.up(M, '2')]).map(k => k + ' minor'));
    return { q: `What is the relative minor of ${M} major?`, options: ch.options, answer: ch.answer, why: `Down 3 half steps from ${M} is ${right}. ${right} minor shares ${M} major’s signature: ${l4SigWords(Theory.keySig(M).n)}.` };
  }
  const m = rand(['A', 'E', 'B', 'D', 'G', 'C', 'F♯']), right = Theory.relMajor(m);
  const ch = l4Choice(right + ' major', shuffle([Theory.down(m, 'b3'), Theory.up(m, '5'), Theory.up(m, '3'), Theory.up(m, '4')]).map(k => k + ' major'));
  return { q: `${m} minor is the relative minor of which major key?`, options: ch.options, answer: ch.answer, why: `Up 3 half steps from ${m} is ${right}. Same signature: ${l4SigWords(Theory.keySig(right).n)}.` };
}
function l4HarmQ() {
  const t = rand(['A', 'E', 'D', 'G', 'C', 'B']), nat = Theory.scale(t, 'minor'), right = Theory.scale(t, 'harmonic')[6];
  const ch = l4Choice(right, shuffle([nat[6], Theory.alter(nat[5], 1), Theory.alter(nat[2], 1)]));
  return { q: `Harmonic minor raises the 7th. What is the 7th note of ${t} harmonic minor?`, options: ch.options, answer: ch.answer, why: `${t} natural minor has ${nat[6]}; harmonic minor raises it to ${right}, a half step below ${t}. That is the leading tone.` };
}
function l4ParallelQ() {
  const t = rand(['G', 'D', 'F', 'A', 'E', 'B♭']), maj = Theory.scale(t), fmt = ix => ix.map(k => maj[k]).join(', ');
  const ch = l4Choice(fmt([2, 5, 6]), shuffle([fmt([1, 4, 5]), fmt([2, 3, 6]), fmt([0, 2, 4]), fmt([3, 5, 6])]));
  return { q: `Turn ${t} major into ${t} minor. Which three notes come down a half step?`, options: ch.options, answer: ch.answer, why: `Lower 3, 6 and 7: ${[2, 5, 6].map(k => maj[k] + ' → ' + Theory.alter(maj[k], -1)).join(', ')}. ${t} minor: ${Theory.scale(t, 'minor').join(' ')}.` };
}
function l4MinorChordQ() {
  const key = rand(['A', 'E', 'D']), list = Theory.diatonic(key, 'minor'), c = rand(list.filter(x => x.q !== 'dim'));
  const ch = l4Choice(Theory.pretty(c.sym), shuffle(list.filter(x => x !== c)).map(x => Theory.pretty(x.sym)));
  return { q: `In ${key} minor, which chord is ${c.roman}?`, options: ch.options, answer: ch.answer, why: `${key} minor: ${list.map(x => x.roman + ' ' + Theory.pretty(x.sym)).join(', ')}.` };
}
/* ear: play a scale, name it. types: any of major, minor, harmonic, melodic */
const L4_SCALE_WORDS = { major: 'Major', minor: 'Natural minor', harmonic: 'Harmonic minor', melodic: 'Melodic minor' };
function l4ScaleEarQ(types, words) {
  const tonic = rand(['C', 'D', 'E', 'F', 'G', 'A']), type = rand(types), notes = Theory.scale(l4Mid(tonic), type, true);
  const w = words || L4_SCALE_WORDS;
  const tip = { major: 'A bright, high 3rd.', minor: 'A low 3rd, and a whole step from 7 up to 8.', harmonic: 'The raised 7th leaves a gap of 3 half steps, then a half step home.', melodic: 'It starts minor, then brightens near the top: 6 and 7 are raised.' }[type];
  return {
    q: types.length > 2 ? 'Which scale is this?' : (types.indexOf('major') >= 0 ? 'Major or minor?' : 'Which minor is this?'),
    options: types.map(x => w[x]), answer: types.indexOf(type), play: l4Seq(notes, 0.28), playLabel: 'Hear it again',
    why: `${tonic} ${Theory.SCALES[type].name}: ${notes.map(Theory.stripOct).join(' ')}. ${tip}`
  };
}
/* an original 2-bar tune in C (degrees 3 5 6 5 3 | 4 3 2 7 1), and its parallel-minor flip */
const L4_TUNE = [['E4', 0, 0.5], ['G4', 0.5, 0.5], ['A4', 1, 0.25], ['G4', 1.25, 0.25], ['E4', 1.5, 0.5], ['F4', 2, 0.25], ['E4', 2.25, 0.25], ['D4', 2.5, 0.5], ['B3', 3, 0.5], ['C4', 3.5, 1]];
const l4Flip = (n, tonic) => ['M3', 'M6', 'M7'].indexOf(Theory.interval(tonic, Theory.stripOct(n)).short) >= 0 ? Theory.alter(n, -1) : n;
const l4TuneNotes = minor => L4_TUNE.map(x => minor ? l4Flip(x[0], 'C') : x[0]);
function l4TuneSeq(minor, shift) {
  return L4_TUNE.map(([n, t, d]) => ({ m: Theory.midi(minor ? l4Flip(n, 'C') : n) + (shift || 0), t: t * 1.1, d: d * 1.1 }));
}
function l4TuneQ() {
  const minor = Math.random() < 0.5, tonic = rand(['C', 'D', 'F', 'G']);
  let shift = Theory.pc(tonic); if (shift > 5) shift -= 12;
  const ch = { options: ['Major', 'Minor'], answer: minor ? 1 : 0 };
  return { q: 'Same little tune. Major or minor this time?', play: l4TuneSeq(minor, shift), playLabel: 'Hear it again', options: ch.options, answer: ch.answer, why: minor ? `Minor: the 3rd, 6th and 7th of ${tonic} were lowered.` : `Major: the 3rd, 6th and 7th of ${tonic} are high and bright.` };
}
/* several play buttons in one card (a card's mount) */
function l4Players(list) {
  return el => {
    el.innerHTML = `<div class="row">${list.map((x, k) => `<button type="button" class="btn small" data-pl="${k}">▶ ${x[0]}</button>`).join('')}</div>`;
    const click = ev => { const b = ev.target.closest('[data-pl]'); if (b) list[+b.dataset.pl][1](); };
    el.addEventListener('click', click);
    return () => el.removeEventListener('click', click);
  };
}
const l4Chords = (syms, gap) => playChordList(syms.map((sym, k) => ({ sym, t: k * (gap || 0.9), d: (gap || 0.9) - 0.05 })));
/* chord tones stacked upward from a root octave, as spelled notes for the staff */
function l4Stack(names, oct) {
  let prev = -1;
  return names.map(n => { let o = oct, s = l4At(n, o); while (Theory.midi(s) <= prev) { o++; s = l4At(n, o); } prev = Theory.midi(s); return s; });
}

/* ---------- tasks ---------- */

/* See a key signature, play the key's tonic in any octave.
   p: { prompt, items: [{ n (signed count), mode: 'major'|'minor', clef }], strict (the first note counts, as in the boss), pass, passMsg }
   done(true, { score }) */
Tasks.keyTonic = (el, p, done) => {
  let items = p.items.slice(), i = 0, score = 0, tries = 0, timer = 0, busy = false, finished = false;
  const pass = p.pass || 0;
  el.innerHTML = `${p.prompt ? `<p class="prompt">${p.prompt}</p>` : ''}<div class="l4-keytask"><div class="l4-keyart"></div><div class="l4-keyside"><div class="l4-ask" data-q aria-live="polite"></div><div class="progress-dots">${'<span></span>'.repeat(items.length)}</div></div></div><p class="fb info" aria-live="polite">Play the tonic on any instrument, in any octave.</p><div class="row" data-retry hidden><button type="button" class="btn small" data-act="retry">Try again</button></div>`;
  const art = el.querySelector('.l4-keyart'), q = el.querySelector('[data-q]'), f = el.querySelector('.fb'), dots = el.querySelectorAll('.progress-dots span'), retry = el.querySelector('[data-retry]');
  const tonicOf = it => Theory.keyFromSig(it.n, it.mode);
  function show(mark) {
    const it = items[i], tonic = tonicOf(it), minor = it.mode === 'minor';
    art.innerHTML = l4Sig(it.n, { clef: it.clef, notes: mark ? [l4TonicNote(tonic, it.clef, tonic + (minor ? 'm' : ''), mark)] : [] });
    q.textContent = mark ? `${tonic} ${minor ? 'minor' : 'major'}` : (minor ? 'Which minor key?' : 'Which major key?');
  }
  function result(ok) {
    const it = items[i];
    busy = true;
    dots[i].classList.add(ok ? 'on' : 'miss'); if (ok) score++;
    show(ok ? 'ok' : 'target');
    fb(f, ok ? 'good' : 'bad', (ok ? '' : 'Not this time. ') + l4SigWhy(it.n, it.mode));
    i++; tries = 0;
    timer = setTimeout(() => {
      busy = false;
      if (i < items.length) { show(); fb(f, 'info', ''); return; }
      finished = true;
      if (score >= pass) { if (items.length > 1) fb(f, 'good', `${score} of ${items.length}. ${p.passMsg || 'Done.'}`); done(true, { score }); }
      else { fb(f, 'bad', `${score} of ${items.length}. You need ${pass}.`); retry.hidden = false; }
    }, ok ? 1300 : 2400);
  }
  el.querySelector('[data-act="retry"]').onclick = () => {
    items = shuffle(items); i = 0; score = 0; tries = 0; finished = false; retry.hidden = true;
    dots.forEach(d => { d.className = ''; }); show(); fb(f, 'info', 'Play the tonic, in any octave.');
  };
  const off = Bus.on('note', d => {
    if (finished || busy || i >= items.length) return;
    const it = items[i];
    if (mod12(d.midi) === Theory.pc(tonicOf(it))) result(true);
    else if (p.strict) result(false);
    else { tries++; fb(f, 'bad', `That is ${noteName(d.midi)}. ${l4TonicHint(it.n, it.mode, tries)}`); }
  });
  show();
  return () => { off(); clearTimeout(timer); };
};

/* Fill the clock: tap where each key lives on a blank Circle of Fifths.
   p: { prompt, ask: [{ name, pos }] (default: the 12 major keys, shuffled), inOrder, ring: 'major'|'minor' (minor: tap the inner ring, names hidden there),
        reveal (positions shown from the start), ok (marks shown from the start), timed, limit (seconds to pass), record (keep the best time),
        hints (default true), again (offer another round) }
   done(true, { time, misses }) */
const L4_CLOCK12 = Theory.CIRCLE.map((name, pos) => ({ name, pos }));
const l4Ask = (names, mode) => names.map(name => ({ name, pos: Theory.circlePos(name, mode) }));
function l4ClockHint(want, minorRing) {
  if (minorRing) { const M = Theory.relMajor(want.name); return `${want.name} minor is the relative minor of ${M} major (3 half steps up). Look under ${M}.`; }
  const n = Theory.keySig(want.name).n;
  if (n === 0) return 'C sits at the top, 12 o’clock.';
  return n > 0 ? `${want.name} major has ${l4SigWords(n)}, so it sits at ${n} o’clock.` : `${want.name} major has ${l4SigWords(n)}: 12 − ${-n} = ${12 + n} o’clock.`;
}
Tasks.fillClock = (el, p, done) => {
  const minorRing = p.ring === 'minor', ring = minorRing ? 'minor' : 'major';
  const total = (p.ask || L4_CLOCK12).length;
  let ask = [], i = 0, misses = 0, t0 = 0, secs = 0, running = false, tick = 0, flashT = 0, ok = {}, flash = {}, reveal = [];
  el.innerHTML = `${p.prompt ? `<p class="prompt">${p.prompt}</p>` : ''}<div class="l4-clockbar"><span class="l4-ask" data-ask aria-live="polite">Ready</span>${p.timed ? '<span class="chip" data-time>0.0 s</span>' : ''}<span class="chip" data-count>0 / ${total}</span></div><div class="l4-circle l4-clock${minorRing ? ' l4-hide-minor' : ''}"></div><p class="fb info" aria-live="polite">Press Start. The app names a key; tap where it lives.</p><div class="row"><button type="button" class="btn primary" data-act="start">${p.timed ? 'Start the clock' : 'Start'}</button></div>`;
  const host = el.querySelector('.l4-circle'), askEl = el.querySelector('[data-ask]'), timeEl = el.querySelector('[data-time]'), countEl = el.querySelector('[data-count]'), f = el.querySelector('.fb'), startBtn = el.querySelector('[data-act="start"]');
  const base = () => { ok = Object.assign({}, p.ok || {}); reveal = (p.reveal || []).slice(); };
  const opts = () => {
    const want = running ? ask[i] : null;
    return { hide: !minorRing, reveal, ring: minorRing ? null : 'major', marks: Object.assign({}, ok, flash), center: want ? [want.name, ring] : (ask.length && i >= ask.length ? [p.timed ? secs + ' s' : 'Done', 'all ' + ask.length] : ['Ready']) };
  };
  base();
  const circ = Circle.mount(host, opts(), pick);
  /* inner names are hidden on screen, so hide them from screen readers too until placed */
  const mask = () => { if (minorRing) host.querySelectorAll('.wedge.minor:not(.ok)').forEach(w => w.setAttribute('aria-label', 'inner ring, ' + l4Hour(+w.dataset.pos))); };
  mask();
  function paint() {
    const want = running ? ask[i] : null;
    askEl.textContent = want ? `${want.name} ${ring}` : (ask.length && i >= ask.length ? 'All placed' : 'Ready');
    countEl.textContent = `${Math.min(i, total)} / ${total}`;
    /* keep keyboard focus on the same wedge across the redraw */
    const a = document.activeElement, w = a && host.contains(a) && a.closest ? a.closest('[data-pos]') : null;
    const fp = w ? w.dataset.pos : null, fr = w ? w.dataset.ring : null;
    circ.update(opts()); mask();
    if (fp != null) { const again = host.querySelector(`[data-pos="${fp}"][data-ring="${fr}"]`); if (again && again.focus) again.focus(); }
  }
  function start() {
    ask = p.ask ? (p.inOrder ? p.ask.slice() : shuffle(p.ask)) : shuffle(L4_CLOCK12);
    i = 0; misses = 0; secs = 0; flash = {}; base();
    running = true; t0 = performance.now(); startBtn.hidden = true;
    if (timeEl) { timeEl.textContent = '0.0 s'; clearInterval(tick); tick = setInterval(() => { timeEl.textContent = ((performance.now() - t0) / 1000).toFixed(1) + ' s'; }, 100); }
    fb(f, 'info', minorRing ? 'Minor keys live on the inner ring.' : 'Tap the right spot on the clock.');
    paint();
  }
  function pick(pos, r) {
    if (!running) { fb(f, 'info', ask.length && i >= ask.length ? 'All placed.' : 'Press Start first.'); return; }
    if (r !== ring) { fb(f, 'info', minorRing ? 'Minor keys live on the inner ring.' : 'Major keys live on the outer ring.'); return; }
    const want = ask[i], key = minorRing ? 'm' + pos : pos;
    if (pos === want.pos) {
      ok[key] = 'ok'; if (reveal.indexOf(pos) < 0) reveal.push(pos);
      flash = {};
      Sound.tone(Theory.midi(l4Mid(want.name)), null, 0.5, 0.6);
      i++;
      if (i >= ask.length) { end(); return; }
      fb(f, 'good', `${want.name} ${ring}: ${l4Hour(pos)}.`);
    } else {
      misses++;
      flash = { [key]: 'no' };
      clearTimeout(flashT); flashT = setTimeout(() => { flash = {}; paint(); }, 600);
      fb(f, 'bad', p.hints === false ? `Not there. Find ${want.name} ${ring}.` : l4ClockHint(want, minorRing));
    }
    paint();
  }
  function end() {
    running = false; clearInterval(tick); clearTimeout(flashT); flash = {};
    secs = Math.round((performance.now() - t0) / 100) / 10;
    if (timeEl) timeEl.textContent = secs.toFixed(1) + ' s';
    let msg = `All ${ask.length} placed${p.timed ? ' in ' + secs + ' s' : ''}, ${misses ? misses + ' wrong tap' + (misses > 1 ? 's' : '') : 'no wrong taps'}.`;
    if (p.record) {
      const prev = Store.data.bests ? Store.data.bests.clock : null;
      const better = recordBest('clock', secs, { lowerIsBetter: true, label: 'Fill-the-clock time, your best vs today', format: s => s + ' s' });
      msg += better ? (prev != null ? ` New best: ${prev} s → ${secs} s.` : ' Your first time on the board.') : ` Your best is ${prev} s.`;
    }
    paint();
    if (p.limit && secs > p.limit) { fb(f, 'bad', `${msg} You need under ${p.limit} s.`); startBtn.textContent = 'Try again'; startBtn.hidden = false; return; }
    fb(f, 'good', msg);
    if (p.again) { startBtn.textContent = 'Play again'; startBtn.hidden = false; }
    done(true, { time: secs, misses });
  }
  startBtn.onclick = start;
  return () => { circ.destroy(); clearInterval(tick); clearTimeout(flashT); };
};

/* Walk the circle: play keys in circle order while the clock fills in.
   p: { prompt, keys: ['C', 'G', …], dir: 1 (clockwise) | -1, mark (glow the next key), endText } */
Tasks.circleWalk = (el, p, done) => {
  const keys = p.keys, pos = keys.map(k => Theory.circlePos(k)), cw = p.dir !== -1;
  el.innerHTML = '<div class="l4-split l4-taskfirst"><div class="l4-circle"></div><div class="l4-walk"></div></div>';
  const state = k => {
    const marks = {}; pos.slice(0, k).forEach(x => { marks[x] = 'ok'; });
    const live = k < pos.length;
    return { static: true, ring: 'major', hide: true, reveal: pos.slice(0, k + 1), marks, selected: live ? pos[k] : null, center: live ? [keys[k], Circle.sigText(pos[k])] : [keys.length + ' keys', cw ? 'clockwise' : 'anticlockwise'] };
  };
  const circ = Circle.mount(el.querySelector('.l4-circle'), state(0), null);
  const step = cw ? 'up a 5th, one more sharp' : 'up a 4th, one more flat';
  const off = Tasks.playSeq(el.querySelector('.l4-walk'), {
    prompt: p.prompt, notes: keys.map(l4Mid), mark: p.mark,
    hint: (k, want) => k ? `Next is ${Theory.stripOct(want)}: ${step} from ${keys[k - 1]}.` : `Start on ${keys[0]}, at the top of the clock.`,
    progress: k => { circ.update(state(k)); return `${keys[k - 1]}. Next: ${keys[k]}, ${step}.`; },
    endText: p.endText
  }, (ok, r) => { circ.update(state(pos.length)); done(true, r); });
  return () => { off(); circ.destroy(); };
};

/* Play chords read from a key's slice of the circle. Major: the family slice with numerals.
   Minor: the same slice read from the inner ring, with the borrowed V glowing.
   p: { key, mode, romans (default I IV V vi ii iii), prompt, tones, passMsg } → Tasks.playChords */
Tasks.familySlice = (el, p, done) => {
  const minor = p.mode === 'minor', key = p.key;
  const romans = p.romans || ['I', 'IV', 'V', 'vi', 'ii', 'iii'];
  const chords = romans.map(r => Theory.romanChord(r, key, minor ? 'minor' : 'major').sym);
  let circle;
  if (minor) {
    const at = Theory.circlePos(key, 'minor'), marks = {};
    [-1, 0, 1].forEach(d => { const x = (at + d + 12) % 12; marks[x] = 'fam'; marks['m' + x] = d ? 'fam' : 'sel'; });
    if (romans.indexOf('V') >= 0) marks[Theory.circlePos(Theory.romanChord('V', key, 'minor').root)] = 'ask';
    circle = Circle.svg({ static: true, marks, center: [key + ' minor', romans.join(' ')] });
  } else circle = Circle.svg({ static: true, selected: Theory.circlePos(key), family: true, center: [key + ' major', 'six chords'] });
  el.innerHTML = `<div class="l4-split l4-taskfirst"><div class="l4-circle">${circle}</div><div class="l4-chords"></div></div>`;
  return Tasks.playChords(el.querySelector('.l4-chords'), { prompt: p.prompt, chords, labels: romans, tones: p.tones, passMsg: p.passMsg }, done);
};

/* Minor mood: turn a sketch into its parallel minor (lower degrees 3, 6 and 7 of its key), keep or undo each change, save.
   p: { prompt }  done(true) once saved */
const L4_EXAMPLE = { name: 'Example: Morning walk', key: 'C major', notes: [60, 62, 64, 67, 69, 67, 64, 62, 64, 65, 62, 59, 60].map((m, k) => ({ m, t: k * 0.4, d: k === 12 ? 1 : 0.38 })) };
function l4SketchTonic(s) {
  const m = /^\s*([A-Ga-g])(#|♯|b|♭)?/u.exec(s.key || '');
  if (m) return Theory.pretty(m[1].toUpperCase() + (m[2] || ''));
  /* a black-key motif from Level 1 lives in F♯ (G♭) major pentatonic */
  return s.notes.every(n => isBlack(n.m)) ? 'F♯' : 'C';
}
/* the conventional name for the parallel minor (D♭ → C♯ minor, not a key with 8 flats) */
const l4MinorName = tonic => Math.abs(Theory.keySig(tonic, 'minor').n) > 7 ? Theory.pcName(Theory.pc(tonic)) : tonic;
function l4MinorChord(sym, low) {
  try {
    const c = Theory.parseChord(sym), dn = x => low.indexOf(x) >= 0 ? mod12(x - 1) : x;
    const pcs = Theory.chordPcs(c.root, c.q).map(dn), bass = c.bass ? dn(Theory.pc(c.bass)) : null;
    const id = Theory.identify(pcs, bass)[0];
    if (!id) return sym;
    return id.inversion && bass != null ? id.sym + '/' + Theory.pcName(bass, true) : id.sym;
  } catch (e) { return sym; }
}
Tasks.minorMood = (el, p, done) => {
  const mine = (Store.data.sketches || []).filter(s => s.notes && s.notes.length && !/minor/i.test(s.key || '')).slice(0, 6);
  const list = mine.concat([L4_EXAMPLE]);
  let src = null, tonic = 'C', mtonic = 'C', low = [], flips = [], keep = [];
  el.innerHTML = `<p class="prompt">${p.prompt}</p><div class="choices" data-pick>${list.map((s, k) => `<button type="button" class="choice" data-sk="${k}" aria-pressed="false">${esc(s.name)}</button>`).join('')}</div>
    <div class="l4-mood" hidden>
      <div class="l4-line"><span class="eyebrow" data-a></span><div class="notes-strip" data-orig></div></div>
      <div class="l4-line"><span class="eyebrow" data-b></span><div class="notes-strip" data-min></div></div>
      <p class="l4-chordline" data-chords hidden></p>
      <div class="row"><button type="button" class="btn small" data-act="orig">▶ Original</button><button type="button" class="btn small" data-act="minor">▶ Minor version</button></div>
      <div class="field"><label for="l4-mood-name">Name it</label><input id="l4-mood-name" type="text" maxlength="40"></div>
      <div class="row"><button type="button" class="btn primary" data-act="save">Save to sketchbook</button></div>
    </div><p class="fb info" aria-live="polite">${mine.length ? 'Pick a sketch to turn minor.' : 'No major-key sketches yet, so start from the example phrase.'}</p>`;
  const work = el.querySelector('.l4-mood'), f = el.querySelector('.fb'), nameIn = el.querySelector('#l4-mood-name');
  const origEl = el.querySelector('[data-orig]'), minEl = el.querySelector('[data-min]'), chordsEl = el.querySelector('[data-chords]'), saveBtn = el.querySelector('[data-act="save"]');
  const nm = (m, sharp) => (sharp ? SHARP : FLAT)[mod12(m)];
  const minorNotes = () => src.notes.map((n, k) => Object.assign({}, n, { m: n.m - (flips[k] && keep[k] ? 1 : 0) }));
  const minorChords = () => (src.chords || []).map(c => Object.assign({}, c, { sym: l4MinorChord(c.sym, low) }));
  function paint() {
    const sO = Theory.keySig(tonic).n >= 0, sM = Theory.keySig(mtonic, 'minor').n >= 0;
    el.querySelector('[data-a]').textContent = `Original · ${tonic} major`;
    el.querySelector('[data-b]').textContent = `Minor · ${mtonic} minor · tap a glowing note to undo it`;
    origEl.innerHTML = src.notes.map((n, k) => `<span class="n${flips[k] ? ' l4-was' : ''}">${nm(n.m, sO)}</span>`).join('');
    minEl.innerHTML = src.notes.map((n, k) => !flips[k] ? `<span class="n">${nm(n.m, sM)}</span>`
      : `<button type="button" class="n l4-flip${keep[k] ? '' : ' undone'}" data-k="${k}" aria-pressed="${keep[k]}" aria-label="${keep[k] ? `${nm(n.m - 1, sM)}, lowered from ${nm(n.m, sO)}. Tap to keep ${nm(n.m, sO)}.` : `${nm(n.m, sO)}, kept. Tap to lower it.`}">${keep[k] ? nm(n.m - 1, sM) : nm(n.m, sO)}</button>`).join('');
    const ch = src.chords || [];
    chordsEl.hidden = !ch.length;
    if (ch.length) chordsEl.textContent = `Chords: ${ch.map(c => Theory.pretty(c.sym)).join(' ')} → ${minorChords().map(c => Theory.pretty(c.sym)).join(' ')}`;
  }
  el.querySelector('[data-pick]').onclick = ev => {
    const b = ev.target.closest('[data-sk]'); if (!b) return;
    el.querySelectorAll('[data-sk]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    src = list[+b.dataset.sk];
    tonic = l4SketchTonic(src); mtonic = l4MinorName(tonic);
    low = [4, 9, 11].map(x => mod12(Theory.pc(tonic) + x));
    flips = src.notes.map(n => low.indexOf(mod12(n.m)) >= 0); keep = flips.slice();
    nameIn.value = (src.name.replace(/^Example: /, '') + ' in minor').slice(0, 40);
    work.hidden = false; paint();
    const sO = Theory.keySig(tonic).n >= 0, sM = Theory.keySig(mtonic, 'minor').n >= 0;
    const moved = low.filter(x => src.notes.some(n => mod12(n.m) === x)).map(x => `${nm(x, sO)} → ${nm(x - 1, sM)}`);
    saveBtn.disabled = !moved.length;
    if (moved.length) fb(f, 'info', `Lower 3, 6 and 7 of ${tonic}: ${moved.join(', ')}. Play both versions, then undo any change you don’t like.`);
    else fb(f, 'bad', `None of these notes is the 3rd, 6th or 7th of ${tonic} major, so the minor version sounds the same. Try another sketch or the example.`);
  };
  minEl.onclick = ev => {
    const b = ev.target.closest('[data-k]'); if (!b) return;
    const k = +b.dataset.k; keep[k] = !keep[k]; paint();
    Sound.tone(src.notes[k].m - (keep[k] ? 1 : 0), null, 0.5, 0.7);
    const nb = minEl.querySelector(`[data-k="${k}"]`); if (nb) nb.focus();
  };
  el.querySelector('[data-act="orig"]').onclick = () => { if (src) playSketch(src); };
  el.querySelector('[data-act="minor"]').onclick = () => { if (src) playSketch({ notes: minorNotes(), chords: minorChords() }); };
  saveBtn.onclick = () => {
    if (!src) return;
    const s = saveSketch(Object.assign({ name: nameIn.value.trim() || src.name + ' in minor', notes: minorNotes(), prompt: 'Minor mood: ' + src.name, level: 4, key: mtonic + ' minor' },
      src.id ? { from: src.id } : {}, src.chords && src.chords.length ? { chords: minorChords() } : {}, src.bpm ? { bpm: src.bpm } : {}));
    saveBtn.disabled = true;
    fb(f, 'good', `Saved “${s.name}” in ${mtonic} minor to your sketchbook.`);
    done(true);
  };
  return () => {};
};

/* ---------- interactive cards ---------- */

/* the circle explorer: tap a key to hear its scale, see its signature and meet its relative */
function l4Explorer(el) {
  el.innerHTML = '<div class="l4-split"><div class="l4-circle"></div><div class="l4-info" aria-live="polite"></div></div>';
  const info = el.querySelector('.l4-info');
  const circ = Circle.mount(el.querySelector('.l4-circle'), { selected: 0 }, (pos, ring) => show(pos, ring, true));
  function show(pos, ring, play) {
    const minor = ring === 'minor', major = Theory.CIRCLE[pos], rel = Theory.CIRCLE_MINOR[pos], sig = Theory.keySig(major), alt = Theory.CIRCLE_ALT[pos];
    const tonic = minor ? rel : major;
    const notes = Theory.scale(l4At(tonic, 4), minor ? 'minor' : 'major', true);
    circ.update({ selected: pos, marks: minor ? { ['m' + pos]: 'ask' } : {} });
    info.innerHTML = `<div class="eyebrow">${l4Hour(pos)}</div><h3>${tonic} ${minor ? 'minor' : 'major'}</h3><p>${sig.n ? `${l4SigWords(sig.n)}: ${sig.acc.join(' ')}` : 'No sharps or flats'}.</p><div class="l4-staff">${Staff.svg({ notes: notes.map(n => ({ n, acc: false })), keySig: sig.n, gap: 26 })}</div><p>${minor ? `Relative major: <b>${major} major</b>, on the outer ring.` : `Relative minor: <b>${rel} minor</b>, on the inner ring.`} Same signature, different home note.</p>${alt ? `<p>Also spelled <b>${minor ? alt.minor + ' minor' : alt.major + ' major'}</b>, with ${l4SigWords(Theory.keySig(alt.major).n)}.</p>` : ''}<div class="row"><button type="button" class="btn small" data-act="scale">▶ Play the scale</button></div>`;
    const playIt = () => Sound.seq(l4Seq(notes, 0.24));
    info.querySelector('[data-act="scale"]').onclick = playIt;
    if (play) playIt();
  }
  show(0, 'major', false);
  return () => circ.destroy();
}
/* the family slice: tap a key, see and hear its six chords */
function l4FamilyWidget(el) {
  el.innerHTML = '<div class="l4-split"><div class="l4-circle"></div><div class="l4-info" aria-live="polite"></div></div>';
  const info = el.querySelector('.l4-info');
  let sel = 1;
  const circ = Circle.mount(el.querySelector('.l4-circle'), { selected: sel, family: true }, pos => { sel = pos; paint(); });
  function paint() {
    const key = Theory.CIRCLE[sel], sym = r => Theory.romanChord(r, key).sym;
    const cell = (r, inner) => `<div${inner ? ' class="in"' : ''}><span>${r}</span><b>${Theory.pretty(sym(r))}</b></div>`;
    circ.update({ selected: sel });
    info.innerHTML = `<div class="eyebrow">Tap any key to move the slice</div><h3>${key} major</h3><div class="l4-six">${cell('IV')}${cell('I')}${cell('V')}${cell('ii', 1)}${cell('vi', 1)}${cell('iii', 1)}</div><p>Outside: I with its neighbours IV and V. Inside, right under them: ii, vi and iii.</p><div class="row"><button type="button" class="btn small" data-act="six">▶ Play all six</button></div>`;
    info.querySelector('[data-act="six"]').onclick = () => l4Chords(['I', 'IV', 'V', 'vi', 'ii', 'iii'].map(sym));
  }
  paint();
  return () => circ.destroy();
}

/* ---------- content ---------- */
const L4_AMIN = Theory.diatonic('A', 'minor');
const L4_AHARM_V = Theory.diatonic('A', 'harmonic')[4];
const L4_G = Theory.scale('G4', 'major', true);
const l4Deg = (type) => Theory.SCALES[type].degrees.concat(['8']).map(d => d.replace('b', '♭').replace('#', '♯'));

const L4_UNITS = [
  { id: '4.1', title: 'Key signatures', blurb: 'Write F♯ once, not every time.', steps: [
    { k: 'card', tag: 'Hear', title: 'Write it once', play: l4Seq(L4_G), playLabel: 'Play G major',
      body: '<p>Press play: G major. Its scale has one black key, F♯.</p><p>A song in G is full of F♯s. Writing ♯ before every F would clutter the page, so musicians write it once, at the start of every line. That is a <b>key signature</b>: it says “every F is F♯” for the whole piece.</p>',
      art: l4Figs([l4Fig(Staff.svg({ notes: L4_G, gap: 30 }), 'Sharp written every time'), l4Fig(Staff.svg({ notes: L4_G.map(n => ({ n, acc: false })), keySig: 1, gap: 30 }), 'Sharp written once, in the signature')]) },
    { k: 'task', tag: 'Echo', type: 'playSeq', p: { prompt: 'Read the staff and play G major, from G up to G. The signature tells you which F to play.', notes: L4_G, show: 'hidden',
      art: Staff.svg({ notes: L4_G.map(n => ({ n, acc: false })), keySig: 1, gap: 34 }),
      hint: (i, want) => Theory.letterOf(want) === 'F' ? 'The ♯ on the top line means every F is F♯.' : 'Read the next note on the staff.', endText: 'G major, read from a one-sharp signature.' } },
    { k: 'task', tag: 'Explore', type: 'playSeq', p: { prompt: 'Sharps always join a signature in the same order. Play the first five, left to right.', notes: ['F♯4', 'C♯5', 'G♯4', 'D♯5', 'A♯4'], art: l4Sig(5, { gap: 20 }),
      endText: 'All five black keys, each one a 5th above the last.' } },
    { k: 'card', tag: 'Name', title: 'Always the same order',
      body: '<p>Sharps always appear in one order, and flats in the reverse order. A signature with three sharps is always F♯ C♯ G♯; one with two flats is always B♭ E♭.</p>' +
        l4Hook('<b>Sharps: F C G D A E B</b>. “Father Charles Goes Down And Ends Battle.”') + l4Hook('<b>Flats: B E A D G C F</b>. The same sentence backwards: “Battle Ends And Down Goes Charles’ Father.”'),
      art: l4Figs([l4Fig(Staff.svg({ clef: 'grand', notes: [], keySig: 7, gap: 24 }), 'Seven sharps'), l4Fig(Staff.svg({ clef: 'grand', notes: [], keySig: -7, gap: 24 }), 'Seven flats')]) },
    { k: 'task', tag: 'Explore', type: 'quiz', p: { rounds: 4, pass: 3, gen: i => l4OrderQ(i % 2 === 0) } }
  ] },
  { id: '4.2', title: 'Read the key', blurb: 'See a signature, play its home note.', steps: [
    { k: 'card', tag: 'Hear', title: 'Every signature points home', play: l4Seq(Theory.scale('D4', 'major', true)), playLabel: 'Play D major',
      body: '<p>Two sharps, F♯ and C♯. Only one major key uses exactly those two: <b>D major</b>. Press play to hear it.</p><p>Every signature names one major key, and with it a home note, the <b>tonic</b>.</p>',
      art: l4Sig(2, { clef: 'grand', notes: [l4TonicNote('D', 'treble', 'D')] }) },
    { k: 'card', tag: 'Name', title: 'Two tricks and two to know',
      body: l4Hook('<b>Sharp keys: the last sharp, then up a half step.</b> Two sharps end on C♯; a half step up is D. D major.') + l4Hook('<b>Flat keys: the second-to-last flat.</b> B♭ E♭ A♭: the second-to-last is E♭. E♭ major.') + '<p>Learn two by heart: no sharps or flats is <b>C major</b>, and one flat (B♭) is <b>F major</b>.</p>',
      art: l4Figs([l4Fig(l4Sig(2, { notes: [l4TonicNote('D', 'treble', 'D')] }), 'Last sharp C♯, so D'), l4Fig(l4Sig(-3, { notes: [l4TonicNote('E♭', 'treble', 'E♭')] }), 'Second-to-last flat E♭'), l4Fig(l4Sig(-1, { notes: [l4TonicNote('F', 'treble', 'F')] }), 'One flat: F')]) },
    { k: 'task', tag: 'Echo', type: 'keyTonic', p: () => ({ prompt: 'Which major key? Play its tonic, in any octave.', items: shuffle([1, 2, 3, 4]).map(n => ({ n, mode: 'major' })) }) },
    { k: 'task', tag: 'Explore', type: 'keyTonic', p: () => ({ prompt: 'Now flat keys. Play the tonic.', items: shuffle([-1, -2, -3, -4]).map(n => ({ n, mode: 'major', clef: n % 2 ? 'treble' : 'bass' })) }) },
    { k: 'task', tag: 'Name', type: 'quiz', p: () => { const sigs = shuffle(L4_SIGS).slice(0, 5); return { rounds: 5, pass: 4, gen: i => l4SigQ(sigs[i], 'major', i % 2 ? 'bass' : 'treble') }; } }
  ] },
  { id: '4.3', title: 'The Circle of Fifths', blurb: 'Twelve keys on a clock.', steps: [
    { k: 'card', tag: 'Hear', title: 'Up a 5th, again and again', play: l4Seq([48, 55, 62, 69, 76, 83], 0.55), playLabel: 'Play C G D A E B',
      body: '<p>Each note is a <b>5th</b> above the last: 7 half steps. C, G, D, A, E, B.</p><p>Keep going and you meet every one of the 12 notes once, then land back on C. Put those 12 steps round a clock and you get the most useful picture in music theory.</p>' },
    { k: 'task', tag: 'Echo', type: 'circleWalk', p: { prompt: 'Walk the circle clockwise from C. Any octave works: a 4th down lands on the same letter as a 5th up.', keys: ['C', 'G', 'D', 'A', 'E', 'B'], mark: true, endText: 'Six keys clockwise: C G D A E B.' } },
    { k: 'card', tag: 'Name', title: 'The Circle of Fifths',
      body: '<p>Put the 12 major keys round a clock with C at the top. Each step <b>clockwise</b> goes up a 5th and adds one sharp. Each step <b>anticlockwise</b> goes up a 4th (down a 5th) and adds one flat. This is the <b>Circle of Fifths</b>.</p>' +
        l4Hook('Clockwise from C: <b>C G D A E B</b>. “Cats Go Down Alleys Eating Birds.”') + l4Hook('Anticlockwise: <b>F</b>, then <b>B♭ E♭ A♭ D♭ G♭</b>. After F, the flats spell BEAD, then G.') +
        '<p>The order of sharps, F C G D A E B, is the same walk, starting one step before C.</p>',
      art: `<div class="l4-circle">${Circle.svg({ static: true, ring: 'major', center: ['Clockwise', 'one more ♯'] })}</div>` },
    { k: 'task', tag: 'Explore', type: 'circleWalk', p: { prompt: 'Now the flat side: walk anticlockwise from C. F first, then BEAD-G.', keys: ['C', 'F', 'B♭', 'E♭', 'A♭', 'D♭', 'G♭'], dir: -1, endText: 'C F B♭ E♭ A♭ D♭ G♭: round to the bottom of the clock.' } },
    { k: 'card', tag: 'Explore', title: 'Explore the clock', mount: l4Explorer,
      body: '<p>Tap any key. You hear its scale and see its signature. The inner ring holds each key’s <b>relative minor</b>: same signature, different home note. Unit 4.6 is all about it.</p>' }
  ] },
  { id: '4.4', title: 'Clock maths and the far side', blurb: 'The time tells the signature.', steps: [
    { k: 'task', tag: 'Explore', type: 'quiz', p: () => {
      const QS = [[3, [0, 1, 2, 3], 'G sits at 1 o’clock with 1 sharp. D sits at 2 o’clock with 2. A sits at 3 o’clock. How many sharps does A major have?'],
        [4, [0, 1, 2, 3, 4], 'E sits at 4 o’clock. How many sharps?'],
        [9, [0, 11, 10, 9], 'Now the flat side. F at 11 o’clock has 1 flat; B♭ at 10 o’clock has 2. How many flats does E♭ have, at 9 o’clock?'],
        [8, [0, 11, 10, 9, 8], 'A♭ sits at 8 o’clock. How many flats?'],
        [7, [0, 11, 10, 9, 8, 7], 'D♭ sits at 7 o’clock. How many flats?']];
      return { prompt: 'Find the pattern between the time and the signature.', rounds: QS.length, pass: 3, gen: i => {
        const [pos, rev, q] = QS[i], n = pos <= 5 ? pos : pos - 12, k = Math.abs(n), key = Theory.CIRCLE[pos];
        const ch = l4Choice(String(k), [String(k - 1), String(k + 1), String(pos)].filter(x => x !== '0'));
        return { q, options: ch.options, answer: ch.answer, html: `<div class="l4-qcircle">${Circle.svg({ static: true, ring: 'major', hide: true, reveal: rev, sigs: false, selected: pos, center: [key, l4Hour(pos)] })}</div>`,
          why: n > 0 ? `${key} major: ${l4SigWords(n)}, ${Theory.keySig(key).acc.join(' ')}. The hour is the number of sharps.` : `${key} major: 12 − ${pos} = ${k} flats, ${Theory.keySig(key).acc.join(' ')}.` };
      } };
    } },
    { k: 'card', tag: 'Name', title: 'The time tells the signature',
      body: l4Hook('<b>The hour is the number of sharps.</b> G at 1 o’clock has 1♯; E at 4 o’clock has 4♯.') + l4Hook('<b>On the flat side, 12 minus the hour is the number of flats.</b> E♭ at 9 o’clock has 12 − 9 = 3♭.') + '<p>So a quick look at the clock tells you any signature, and the tricks from 4.2 take you back from a signature to its place.</p>',
      art: `<div class="l4-circle">${Circle.svg({ static: true, ring: 'major', center: ['The time', 'tells the signature'] })}</div>` },
    { k: 'card', tag: 'Name', title: 'The far side', play: l4Seq(Theory.scale('F♯4', 'major', true)), playLabel: 'Play F♯ major (= G♭ major)',
      body: '<p>At the bottom of the clock, the sharp side meets the flat side. Three spots have two names that sound exactly the same. These are <b>enharmonic keys</b>:</p><p>5 o’clock: B major (5♯) or C♭ major (7♭).<br>6 o’clock: F♯ major (6♯) or G♭ major (6♭).<br>7 o’clock: D♭ major (5♭) or C♯ major (7♯).</p>' + l4Hook('At the far side, <b>sharps plus flats make 12</b>.'),
      art: l4Figs([l4Fig(l4Sig(6, { notes: [l4TonicNote('F♯', 'treble', 'F♯')] }), 'F♯ major: 6 sharps'), l4Fig(l4Sig(-6, { notes: [l4TonicNote('G♭', 'treble', 'G♭')] }), 'G♭ major: 6 flats')]) },
    { k: 'task', tag: 'Explore', type: 'fillClock', p: { prompt: 'Tap where each of these keys lives. Count its sharps or flats first.', ask: l4Ask(['C♯', 'G♭', 'C♭']), reveal: [0, 1, 2, 3, 4, 8, 9, 10, 11] } },
    { k: 'task', tag: 'Explore', type: 'fillClock', p: { prompt: 'Fill the clock. The app names a key; tap where it lives. Your time goes on the board.', timed: true, record: true, again: true } }
  ] },
  { id: '4.5', title: 'Neighbours are family', blurb: 'Six chords in one slice of the clock.', steps: [
    { k: 'card', tag: 'Hear', title: 'Six chords that belong together', play: () => l4Chords(['G', 'C', 'D', 'Em', 'Am', 'Bm']), playLabel: 'Play G C D Em Am Bm',
      body: '<p>These six chords all come from G major. Play any of them in a song in G and they fit.</p><p>You could work them out note by note, as in Level 3. The clock does it at a glance.</p>' },
    { k: 'card', tag: 'Name', title: 'The family slice', mount: l4FamilyWidget,
      body: '<p>A key and its two neighbours on the clock are its <b>I</b>, <b>IV</b> and <b>V</b>, the three major chords. The three minors right under them are <b>vi</b>, <b>ii</b> and <b>iii</b>.</p>' + l4Hook('The <b>family slice</b>: three outside, three inside. (The seventh chord, vii°, is the one left out.)') },
    { k: 'task', tag: 'Echo', type: 'familySlice', p: { key: 'G', prompt: 'Play the six chords of G major, read from the slice. Each numeral is a spot on the clock.' } },
    { k: 'task', tag: 'Explore', type: 'quiz', p: { prompt: 'Use the slice to find chords in other keys.', rounds: 4, pass: 3, gen: () => l4SliceQ(true) } }
  ] },
  { id: '4.6', title: 'Natural minor and relative keys', blurb: 'Same notes, new home.', steps: [
    { k: 'card', tag: 'Hear', title: 'Same keys, different home',
      body: '<p>Both scales use only white keys. The first starts on C and sounds bright. The second starts on A and sounds darker, as if the light changed.</p>',
      mount: l4Players([['C major', () => Sound.seq(l4Seq(Theory.scale('C4', 'major', true)))], ['A minor', () => Sound.seq(l4Seq(Theory.scale('A3', 'minor', true)))]]) },
    { k: 'task', tag: 'Echo', type: 'playSeq', p: { prompt: 'Play A natural minor: every white key from A up to A. Watch the steps appear.', notes: Theory.scale('A3', 'minor', true), steps: true, mark: true, endText: 'A natural minor: W H W W H W W.' } },
    { k: 'card', tag: 'Name', title: 'Natural minor and the relative minor',
      body: '<p>Start a major scale on its 6th note, <b>la</b>, and you get its <b>relative minor</b>. A minor uses C major’s notes and C major’s signature, with A as home. On the clock it sits on the inner ring, right under C.</p>' +
        l4Hook('Natural minor recipe: <b>2-1-2-2-1-2-2</b>.') + l4Hook('<b>Relative minor = down 3 half steps</b> from the major tonic: C, B, B♭, A.'),
      art: `<div class="l4-circle">${Circle.svg({ static: true, selected: 0, marks: { m0: 'ask' }, center: ['C major', 'A minor'] })}</div>` },
    { k: 'task', tag: 'Explore', type: 'playSeq', p: { prompt: 'E minor is the relative minor of G major, so it borrows G’s F♯. Play it up from E.', notes: Theory.scale('E4', 'minor', true), steps: true,
      art: Staff.svg({ notes: Theory.scale('E4', 'minor', true).map(n => ({ n, acc: false })), keySig: 1, gap: 34 }), endText: 'E natural minor, same signature as G major.' } },
    { k: 'task', tag: 'Explore', type: 'fillClock', p: { prompt: 'The inner names are hidden. Tap where each minor key lives: under its relative major.', ring: 'minor', ok: { m0: 'ok' }, ask: l4Ask(['E', 'D', 'B', 'G', 'F♯', 'C'], 'minor') } },
    { k: 'task', tag: 'Name', type: 'keyTonic', p: () => ({ prompt: 'Which minor key? Find the major key first, then go down 3 half steps. Play the minor tonic.', items: shuffle([0, 1, -1, 2]).map(n => ({ n, mode: 'minor' })) }) }
  ] },
  { id: '4.7', title: 'Three minors', blurb: 'Natural, harmonic and melodic.', steps: [
    { k: 'card', tag: 'Hear', title: 'One start, three tops',
      body: '<p>Three versions of A minor. They start the same and differ near the top. Listen to the last few notes of each.</p>',
      mount: l4Players([['Natural', () => Sound.seq(l4Seq(Theory.scale('A3', 'minor', true)))], ['Harmonic', () => Sound.seq(l4Seq(Theory.scale('A3', 'harmonic', true)))], ['Melodic', () => Sound.seq(l4Seq(Theory.scale('A3', 'melodic', true).concat(Theory.scale('A3', 'minor', true).reverse().slice(1))))]]) },
    { k: 'task', tag: 'Echo', type: 'playSeq', p: { prompt: 'Play A harmonic minor: A natural minor with G♯ instead of G.', notes: Theory.scale('A3', 'harmonic', true), steps: true, mark: true, endText: 'Hear that gap from F to G♯? Three half steps, then a half step home.' } },
    { k: 'card', tag: 'Name', title: 'Natural, harmonic, melodic',
      body: '<p><b>Natural minor</b> is the plain version. <b>Harmonic minor</b> raises the 7th, so the 7th becomes a <b>leading tone</b> a half step below home, and leaves an exotic gap before it. <b>Melodic minor</b> raises the 6th and 7th on the way up for a smooth climb, and comes down as natural minor.</p>' +
        l4Hook('Harmonic = natural with <b>♯7</b>. Recipe 2-1-2-2-1-3-1.') + l4Hook('Melodic going up = natural with <b>♯6 ♯7</b>. Recipe 2-1-2-2-2-2-1. Coming down: natural.'),
      art: l4Figs([['minor', 'Natural'], ['harmonic', 'Harmonic: ♯7'], ['melodic', 'Melodic, going up: ♯6 ♯7']].map(([type, cap]) => l4Fig(Staff.svg({ notes: Theory.scale('A3', type, true), labels: l4Deg(type), gap: 30 }), cap))) },
    { k: 'task', tag: 'Explore', type: 'playSeq', p: { prompt: 'Play A melodic minor up, then natural minor down.', notes: Theory.scale('A3', 'melodic', true).concat(Theory.scale('A3', 'minor', true).reverse().slice(1)),
      hint: i => i < 8 ? 'Going up, raise 6 and 7: F♯ and G♯.' : 'Coming down, play natural minor: G and F, no sharps.', endText: 'Up melodic, down natural.' } },
    { k: 'task', tag: 'Name', type: 'quiz', p: { prompt: 'Ear check: which minor is it?', rounds: 5, pass: 3, gen: () => l4ScaleEarQ(['minor', 'harmonic', 'melodic'], { minor: 'Natural', harmonic: 'Harmonic', melodic: 'Melodic' }) } }
  ] },
  { id: '4.8', title: 'Parallel keys and mood', blurb: 'Same home, different mood.', steps: [
    { k: 'card', tag: 'Hear', title: 'One tune, two moods',
      body: '<p>A short tune in C, played twice. Same rhythm, same shape, same home note. Only three notes change.</p>',
      mount: l4Players([['In C major', () => Sound.seq(l4TuneSeq(false))], ['In C minor', () => Sound.seq(l4TuneSeq(true))]]) },
    { k: 'card', tag: 'Name', title: 'Parallel keys',
      body: '<p>C major and C minor share a tonic. Keys like that are <b>parallel keys</b>. (Relative keys share a signature instead, like C major and A minor.)</p>' + l4Hook('Minor = major with <b>♭3, ♭6 and ♭7</b>. “Lower 3, 6 and 7.”') + '<p>C minor’s signature has three flats: it borrows them from its relative major, E♭.</p>',
      art: l4Figs([l4Fig(Staff.svg({ notes: Theory.scale('C4', 'major', true), labels: l4Deg('major'), gap: 30 }), 'C major'), l4Fig(Staff.svg({ notes: Theory.scale('C4', 'minor', true), labels: l4Deg('minor'), gap: 30 }), 'C minor: lower 3, 6, 7')]) },
    { k: 'task', tag: 'Echo', type: 'playSeq', p: { prompt: 'Play C minor: C major with E♭, A♭ and B♭.', notes: Theory.scale('C4', 'minor', true), steps: true, mark: true, endText: 'C natural minor: 2-1-2-2-1-2-2, like A minor.' } },
    { k: 'task', tag: 'Explore', type: 'playSeq', p: { prompt: 'Here is the tune in C major. Play it in C minor: lower every E, A and B.', notes: l4TuneNotes(true), show: 'hidden',
      art: Staff.svg({ notes: l4TuneNotes(false), labels: l4TuneNotes(false).map(Theory.stripOct), filled: true, gap: 34 }),
      hint: (i, want) => { const was = l4TuneNotes(false)[i]; return was !== want ? `${Theory.stripOct(was)} comes down to ${Theory.stripOct(want)}.` : `${Theory.stripOct(want)} stays as it is.`; }, endText: 'The tune in C minor. Same shape, new mood.' } },
    { k: 'task', tag: 'Name', type: 'quiz', p: { rounds: 4, pass: 3, gen: () => l4ParallelQ() } }
  ] },
  { id: '4.9', title: 'Chords in minor keys', blurb: 'i iv V i and the borrowed V.', steps: [
    { k: 'card', tag: 'Hear', title: 'Two endings',
      body: '<p>Two chord endings in A minor. The second changes one note in one chord. Which sounds more finished?</p>',
      mount: l4Players([['i–iv–v–i', () => l4Chords(['Am', 'Dm', 'Em', 'Am'], 1)], ['i–iv–V–i', () => l4Chords(['Am', 'Dm', 'E', 'Am'], 1)]]) },
    { k: 'card', tag: 'Name', title: 'The chords of A minor', play: () => l4Chords(L4_AMIN.map(c => c.sym)), playLabel: 'Play all seven',
      body: `<p>Build a triad on every note of A natural minor and you get <b>${L4_AMIN.map(c => c.roman).join(' ')}</b>: ${L4_AMIN.map(c => Theory.pretty(c.sym)).join(' ')}. They are C major’s chords, starting from A.</p>` + l4Hook('<b>Same family slice, read from the inner ring</b>: Am in the middle with Dm and Em beside it, then C, F and G outside.'),
      art: Staff.svg({ notes: L4_AMIN.map(c => l4Stack(c.notes, 'AB'.indexOf(c.root[0]) >= 0 ? 3 : 4)), labels: L4_AMIN.map(c => c.roman), gap: 44 }) },
    { k: 'card', tag: 'Name', title: 'Borrow a stronger V', play: () => l4Chords(['Em', 'Am', 'E', 'Am'], 1), playLabel: 'v–i, then V–i',
      body: `<p>In natural minor the v chord is minor (Em), and its G sits a whole step below A, so it pulls home only gently.</p><p>Harmonic minor raises G to <b>G♯</b>, the leading tone. That turns v into a major <b>V</b>: ${L4_AHARM_V.notes.join(' ')}. Most music in minor keys borrows this V for a stronger pull home.</p>`,
      art: Staff.svg({ notes: [l4Stack(['E', 'G', 'B'], 4), l4Stack(L4_AHARM_V.notes, 4), l4Stack(['A', 'C', 'E'], 4)], labels: ['v', 'V', 'i'], gap: 56 }) },
    { k: 'task', tag: 'Echo', type: 'familySlice', p: { key: 'A', mode: 'minor', romans: ['i', 'iv', 'V', 'i'], tones: true, prompt: 'Play i–iv–V–i in A minor. The glowing outer spot is E, the borrowed V.' } },
    { k: 'task', tag: 'Explore', type: 'familySlice', p: { key: 'E', mode: 'minor', romans: ['i', 'iv', 'V', 'i'], prompt: 'Now i–iv–V–i in E minor. Read i and iv from the inner ring; V needs E minor’s raised 7th, D♯.' } }
  ] },
  { id: '4.C', title: 'Minor mood', blurb: 'Turn a phrase into its parallel minor.', create: true, steps: [
    { k: 'card', tag: 'Name', title: 'Same idea, new mood',
      body: '<p>A <b>parallel minor</b> keeps the home note and lowers the 3rd, 6th and 7th of the scale. Do that to one of your sketches and it changes mood without changing shape.</p><p>Pick a sketch, listen to both versions, and keep only the changes you like. The minor version is saved as a new sketch, so the original stays as it was.</p>' },
    { k: 'task', tag: 'Create', type: 'minorMood', p: { prompt: 'Pick a sketch to turn minor.' } }
  ] },
  { id: '4.B', title: 'Boss challenge', blurb: 'Fill the clock, name 8 signatures, play 4 tonics.', boss: true, steps: [
    { k: 'card', tag: 'Name', title: 'Show what you know',
      body: '<p>Part 1: fill the clock. Tap where each of the 12 major keys lives, all 12 in under 90 seconds.</p><p>Part 2: name 8 key signatures, some as major keys and some as minor. You need 7.</p><p>Part 3: see a signature and play its tonic, in any octave. You need 3 of 4.</p>' },
    { k: 'task', tag: 'Echo', type: 'fillClock', p: { prompt: 'Part 1: tap where each major key lives. All 12 in under 90 seconds.', timed: true, limit: 90, record: true, hints: false } },
    { k: 'task', tag: 'Name', type: 'quiz', p: () => {
      const sigs = shuffle(L4_SIGS).slice(0, 8), modes = shuffle(['major', 'major', 'major', 'major', 'major', 'minor', 'minor', 'minor']);
      return { prompt: 'Part 2: name the key from its signature.', rounds: 8, pass: 7, passMsg: 'Part 2 passed.', gen: i => l4SigQ(sigs[i], modes[i], rand(['treble', 'treble', 'bass'])) };
    } },
    { k: 'task', tag: 'Echo', type: 'keyTonic', p: () => ({ prompt: 'Part 3: play the tonic of each key, in any octave. The first note you play counts.', strict: true, pass: 3, passMsg: 'Part 3 passed.',
      items: shuffle(shuffle(L4_SIGS).slice(0, 4).map((n, k) => ({ n, mode: k === 3 ? 'minor' : 'major', clef: rand(['treble', 'bass']) }))) }) }
  ] }
];

/* ---------- review cards ---------- */
/* play the tonic of a shown signature (c.mode, c.sigs) */
CARD_TYPES.l4Tonic = (el, c, fin) => {
  const it = { n: rand(c.sigs || L4_SIGS), mode: c.mode || 'major', clef: rand(['treble', 'treble', 'bass']) };
  return Tasks.keyTonic(el, { prompt: c.prompt, items: [it], strict: true }, (ok, r) => fin(r.score === 1));
};
/* play a chord named by its numeral: c.make() → { prompt, chord, label } */
CARD_TYPES.l4Numeral = (el, c, fin) => {
  const x = c.make();
  return Tasks.playChords(el, { prompt: x.prompt, chords: [x.chord], labels: [x.label] }, (ok, r) => fin(r.misses <= 1));
};
const L4_CARDS = {
  '4.1': [
    { id: 'l4-order-sharps', type: 'gen', gen: () => l4OrderQ(true) },
    { id: 'l4-order-flats', type: 'gen', gen: () => l4OrderQ(false) },
    { id: 'l4-first-sharp', type: 'choice', q: 'Every sharp key signature starts with the same sharp. Which one?', options: ['F♯', 'C♯', 'B♯'], answer: 0, why: '“Father Charles Goes Down And Ends Battle”: F♯ always comes first.' },
    { id: 'l4-first-flat', type: 'choice', q: 'Every flat key signature starts with the same flat. Which one?', options: ['F♭', 'B♭', 'E♭'], answer: 1, why: '“Battle Ends And Down Goes Charles’ Father”: B♭ always comes first.' },
    { id: 'l4-why-sig', type: 'choice', q: 'What does a key signature do?', options: ['Says which notes are sharp or flat all the way through', 'Sets the tempo', 'Shows how loud to play'], answer: 0, why: 'Written once at the start of each line, it saves writing ♯ or ♭ before every note.' }
  ],
  '4.2': [
    { id: 'l4-read-sharp', type: 'gen', gen: () => l4SigQ(randInt(1, 6), 'major', rand(['treble', 'bass'])) },
    { id: 'l4-read-flat', type: 'gen', gen: () => l4SigQ(-randInt(1, 6), 'major', rand(['treble', 'bass'])) },
    { id: 'l4-tonic', type: 'l4Tonic', prompt: 'Which major key? Play its tonic, in any octave.' },
    { id: 'l4-one-flat', type: 'choice', q: 'Which major key has exactly one flat?', options: ['B♭ major', 'F major', 'C major'], answer: 1, why: 'F major has one flat, B♭. Learn that one by heart.' },
    { id: 'l4-trick-sharp', type: 'choice', q: 'In a sharp key signature, how do you find the major key?', options: ['Go a half step up from the last sharp', 'Take the first sharp', 'Count the sharps and add 2'], answer: 0, why: 'Last sharp, then up a half step: C♯ → D major.' },
    { id: 'l4-trick-flat', type: 'choice', q: 'With two or more flats, the major key is named by…', options: ['the last flat', 'the second-to-last flat', 'the first flat'], answer: 1, why: 'B♭ E♭ A♭: the second-to-last flat is E♭, so E♭ major.' }
  ],
  '4.3': [
    { id: 'l4-step', type: 'gen', gen: l4StepQ },
    { id: 'l4-cats', type: 'choice', q: '“Cats Go Down Alleys Eating Birds” gives the keys going clockwise from C. Which are they?', options: ['C G D A E B', 'C D E F G A', 'C F B♭ E♭ A♭ D♭'], answer: 0, why: 'Each one is a 5th above the last.' },
    { id: 'l4-bead', type: 'choice', q: 'Anticlockwise from C, after F, the flat keys spell…', options: ['B♭ E♭ A♭ D♭ G♭ (BEAD-G)', 'F♯ C♯ G♯ D♯', 'G D A E B'], answer: 0, why: 'F, then BEAD, then G: each one a 4th above the last.' },
    { id: 'l4-fifth', type: 'choice', q: 'Each step clockwise on the Circle of Fifths moves…', options: ['up a 5th, 7 half steps', 'up a whole step', 'up an octave'], answer: 0, why: 'Up a 5th, and one more sharp.' },
    { id: 'l4-walk-sharp', type: 'seq', prompt: 'Walk the circle clockwise from C: six keys.', notes: ['C4', 'G4', 'D4', 'A4', 'E4', 'B4'], show: 'hidden' },
    { id: 'l4-walk-flat', type: 'seq', prompt: 'Walk the circle anticlockwise from C: F, then BEAD-G.', notes: ['C4', 'F4', 'B♭3', 'E♭4', 'A♭3', 'D♭4', 'G♭3'], show: 'hidden' }
  ],
  '4.4': [
    { id: 'l4-hour', type: 'gen', gen: l4HourQ },
    { id: 'l4-where', type: 'gen', gen: l4WhereQ },
    { id: 'l4-twelve', type: 'choice', q: 'E♭ major sits at 9 o’clock. How many flats does it have?', options: ['3', '9', '4'], answer: 0, why: '12 − 9 = 3: B♭, E♭ and A♭.' },
    { id: 'l4-enh', type: 'gen', gen: l4EnhQ },
    { id: 'l4-enh-sum', type: 'choice', q: 'B major has 5 sharps. Its twin at 5 o’clock, C♭ major, has how many flats?', options: ['5', '6', '7'], answer: 2, why: 'At the far side, sharps plus flats make 12: 5 + 7.' }
  ],
  '4.5': [
    { id: 'l4-slice-read', type: 'gen', gen: () => l4SliceQ(true) },
    { id: 'l4-slice-mem', type: 'gen', gen: () => l4SliceQ(false) },
    { id: 'l4-slice-play', type: 'l4Numeral', make: () => { const key = rand(['C', 'G', 'D', 'F', 'A']), r = rand(['IV', 'V', 'vi', 'ii']); return { prompt: `Play the ${r} chord of ${key} major. Find it in the family slice.`, chord: Theory.romanChord(r, key).sym, label: r }; } },
    { id: 'l4-slice-what', type: 'choice', q: 'On the circle, the six main chords of a key are…', options: ['the key, its two neighbours, and the three minors under them', 'the six keys clockwise from it', 'every key with the same number of sharps'], answer: 0, why: 'The family slice: I IV V outside, vi ii iii inside.' }
  ],
  '4.6': [
    { id: 'l4-relminor', type: 'gen', gen: () => l4RelQ(true) },
    { id: 'l4-relmajor', type: 'gen', gen: () => l4RelQ(false) },
    { id: 'l4-minor-recipe', type: 'choice', q: 'Which recipe is natural minor?', options: ['2-2-1-2-2-2-1', '2-1-2-2-1-2-2', '2-1-2-2-1-3-1'], answer: 1, why: 'Natural minor: 2-1-2-2-1-2-2. A to A on the white keys.' },
    { id: 'l4-down3', type: 'choice', q: 'To find the relative minor of a major key, go…', options: ['down 3 half steps', 'up 3 half steps', 'down a 5th'], answer: 0, why: 'C, B, B♭, A: A minor is the relative minor of C major.' },
    { id: 'l4-seq-e-minor', type: 'seq', prompt: 'Play E natural minor, up from E. Recipe 2-1-2-2-1-2-2.', notes: Theory.scale('E4', 'minor', true), show: 'hidden', steps: true },
    { id: 'l4-minor-tonic', type: 'l4Tonic', mode: 'minor', sigs: [-3, -2, -1, 0, 1, 2, 3], prompt: 'Which minor key? Play its tonic, in any octave.' }
  ],
  '4.7': [
    { id: 'l4-harm', type: 'gen', gen: l4HarmQ },
    { id: 'l4-seq-a-harm', type: 'seq', prompt: 'Play A harmonic minor, up from A.', notes: Theory.scale('A3', 'harmonic', true), show: 'hidden', steps: true },
    { id: 'l4-melodic', type: 'choice', q: 'Going up, melodic minor raises which degrees of natural minor?', options: ['Only 7', '6 and 7', '3 and 7'], answer: 1, why: 'Melodic up = natural with ♯6 ♯7. Coming down, it is natural minor again.' },
    { id: 'l4-harm-recipe', type: 'choice', q: 'Which recipe is harmonic minor?', options: ['2-1-2-2-1-3-1', '2-1-2-2-2-2-1', '2-1-2-2-1-2-2'], answer: 0, why: 'The 3 is the gap from ♭6 up to the raised 7th.' },
    { id: 'l4-which-minor', type: 'gen', gen: () => l4ScaleEarQ(['minor', 'harmonic', 'melodic'], { minor: 'Natural', harmonic: 'Harmonic', melodic: 'Melodic' }) }
  ],
  '4.8': [
    { id: 'l4-parallel', type: 'gen', gen: l4ParallelQ },
    { id: 'l4-parallel-def', type: 'choice', q: 'C major and C minor are…', options: ['relative keys: same notes, different home', 'parallel keys: same home, three notes lowered', 'the same key'], answer: 1, why: 'Parallel keys share a tonic. Minor lowers 3, 6 and 7.' },
    { id: 'l4-parallel-c', type: 'choice', q: 'A minor is the relative minor of C major. What is the parallel minor of C major?', options: ['E minor', 'A minor', 'C minor'], answer: 2, why: 'Parallel means the same tonic: C minor.' },
    { id: 'l4-seq-c-minor', type: 'seq', prompt: 'Play C minor, up from C: lower 3, 6 and 7 of C major.', notes: Theory.scale('C4', 'minor', true), show: 'hidden', steps: true },
    { id: 'l4-maj-min', type: 'gen', gen: l4TuneQ }
  ],
  '4.9': [
    { id: 'l4-minor-chord', type: 'gen', gen: l4MinorChordQ },
    { id: 'l4-borrow', type: 'choice', q: 'In A minor, the major V chord (E G♯ B) borrows which note from harmonic minor?', options: ['F♯', 'G♯', 'C♯'], answer: 1, why: 'G♯ is the raised 7th, the leading tone that pulls up to A.' },
    { id: 'l4-minor-quality', type: 'choice', q: 'In a natural minor key, which chords are minor?', options: ['i, iv and v', 'I, IV and V', 'ii, iii and vi'], answer: 0, why: 'i ii° III iv v VI VII: lowercase means minor.' },
    { id: 'l4-play-minor', type: 'l4Numeral', make: () => { const key = rand(['A', 'E', 'D']), r = rand(['i', 'iv', 'V']); return { prompt: `Play ${r} in ${key} minor${r === 'V' ? ', the borrowed major V' : ''}.`, chord: Theory.romanChord(r, key, 'minor').sym, label: r }; } }
  ]
};

addLevel({
  n: 4, title: 'The Clock', tagline: 'Key signatures, the Circle of Fifths, and the three minors',
  units: L4_UNITS, cards: L4_CARDS,
  passText: 'You can name any key from its signature, draw the Circle of Fifths from memory, find a key’s six chords on it, and play natural, harmonic and melodic minor.',
  create: {
    params: { pcs: [9, 11, 0, 2, 4, 5, 7, 8], pcsLabel: 'A minor', min: 3, max: 8 },
    prompts: [
      'Make a motif in A minor that ends on A, its home note.',
      'Make a motif that walks down from E to A, step by step.',
      'Play G♯ just before your last A. Hear the leading tone pull home.',
      'Make a motif from the notes of the A minor chord: A, C and E.',
      'Make a slow motif with one leap up, from E to C.',
      'Play F, then G♯: the harmonic minor gap. Build a motif around it.'
    ]
  },
  ear: {
    title: 'Major or minor?', sub: 'Hear a scale and name it. Once you know the three minors, name which one.',
    run(body, finish) {
      const which = unitDone('4.7');
      return Tasks.quiz(body, { rounds: 5, gen: () => l4ScaleEarQ(which ? ['major', 'minor', 'harmonic', 'melodic'] : ['major', 'minor'], which ? null : { major: 'Major', minor: 'Minor' }) }, (ok, r) => finish(r.score, 5));
    }
  }
});
