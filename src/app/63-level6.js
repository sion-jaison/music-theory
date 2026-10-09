/* =================================================================
   Level 6 · Groove & Line (intermediate)
   Units 6.1–6.4 (rhythm) come from 62-level6-rhythm.js; this file adds
   6.5–6.9 (melody craft), the project, the boss, Ear Gym skills and
   the 8 Bars a Day prompts, and registers the level.
   ================================================================= */

/* ---------- helpers ---------- */
const L6_KEYS = ['C', 'G', 'F', 'D'];
const l6Shift = (mot, k) => mot.map(n => Object.assign({}, n, { m: n.m == null ? null : n.m + k }));
const l6KeyShift = key => { let k = Theory.pc(key); if (k > 6) k -= 12; return k; };
/* fit a motive to exactly `beats` beats: hold the last note longer, or cut what spills over */
function l6Fit(mot, beats) {
  const out = []; let t = 0;
  for (const n of mot) { if (t >= beats - 1e-6) break; const d = Math.min(n.d, beats - t); out.push(Object.assign({}, n, { d })); t += d; }
  if (t < beats - 1e-6 && out.length) out[out.length - 1].d += beats - t;
  return out;
}
/* degrees ('1' … '7', '8' = upper do, '-7' = ti below) as MIDI in a key, tonic near C4 */
function l6Deg(list, key) {
  const t = degreeMidi('1', key, 0);
  return list.map(([deg, d]) => {
    if (deg == null) return { m: null, d };
    const low = String(deg).startsWith('-'), up = deg === '8', dd = up ? '1' : low ? String(deg).slice(1) : String(deg);
    return { m: t + degreeSemis(dd) + (up ? 12 : 0) - (low ? 12 : 0), d };
  });
}
const l6Play = (mot, bpm, chords) => playSketch({ notes: motiveSeq(mot, bpm || 96), chords: chords || [] });
/* chords for a melody: one Roman numeral per bar of 4 beats */
const l6Bars = (romans, key, bpm) => { const bar = 4 * 60 / (bpm || 96); return Theory.progression(romans, key).map((c, i) => ({ sym: c.sym, t: i * bar, d: bar * 0.95 })); };
/* a few buttons that each play something (inside a card's mount) */
function l6Players(list) {
  return el => {
    el.innerHTML = `<div class="row">${list.map((x, k) => `<button type="button" class="btn small" data-pl="${k}">▶ ${x[0]}</button>`).join('')}</div>${list.some(x => x[2]) ? '<div class="art l6-pic"></div>' : ''}`;
    const pic = el.querySelector('.l6-pic');
    const click = ev => { const b = ev.target.closest('[data-pl]'); if (!b) return; const x = list[+b.dataset.pl]; x[1](); if (pic && x[2]) pic.innerHTML = x[2](); };
    el.addEventListener('click', click);
    return () => { el.removeEventListener('click', click); Drone.stop(true); };
  };
}
const l6Deeper = txt => `<p class="deeper"><b>Go deeper:</b> ${txt}</p>`;
/* the sounding notes of score events, with their start in beats */
function l6Sounding(events) {
  const out = []; let t = 0;
  events.forEach(e => { if (!e.rest && e.p && !e.tie) out.push({ m: Theory.midi(e.p), at: t, d: e.d }); else if (e.tie && out.length && !e.rest) out[out.length - 1].d += e.d; t += e.d; });
  return out;
}
const l6Last = events => { const s = l6Sounding(events); return s.length ? s[s.length - 1] : null; };

/* ---------- 6.5 scale degrees ---------- */
const L6_TENDENCY = [['7', '1'], ['4', '3'], ['2', '1'], ['6', '5'], ['2', '3']];
function l6CheckTendency(events, key) {
  const s = l6Sounding(events);
  if (s.length < 5) return 'Write at least five notes.';
  const last = s[s.length - 1];
  if (degreeOf(last.m, key) !== '1') return `End on do (${key}). It ends on ${degreeOf(last.m, key) ? DEGREE_SYL[degreeOf(last.m, key)] : noteName(last.m)} now.`;
  let res = 0;
  for (let i = 1; i < s.length; i++) {
    const a = degreeOf(s[i - 1].m, key), b = degreeOf(s[i].m, key), step = Math.abs(s[i].m - s[i - 1].m) <= 2;
    if (step && L6_TENDENCY.some(([x, y]) => x === a && y === b)) res++;
  }
  return res >= 2 ? null : `Let at least two tendency tones resolve by step: ti → do, fa → mi, re → do, la → sol. You have ${res}.`;
}

/* ---------- 6.6 contour ---------- */
const L6_SHAPES = {
  arch: [[0, 1, 2, 4, 5, 4, 2, 1], [2, 3, 4, 5, 7, 6, 4, 2], [0, 2, 4, 6, 7, 5, 3, 1]],
  bowl: [[7, 5, 4, 2, 1, 2, 4, 6], [6, 4, 2, 0, 1, 3, 5, 6], [5, 4, 3, 1, 0, 2, 4, 5]],
  rising: [[0, 1, 2, 1, 3, 4, 5, 7], [0, 2, 1, 3, 4, 5, 6, 7], [-1, 0, 2, 1, 3, 4, 5, 7]],
  falling: [[7, 6, 7, 5, 4, 3, 1, 0], [6, 5, 4, 5, 3, 2, 1, 0], [7, 5, 6, 4, 3, 2, 0, -1]],
  wave: [[0, 3, 1, 4, 2, 5, 3, 1], [2, 5, 1, 4, 0, 3, 1, 4], [3, 0, 4, 1, 5, 2, 4, 0]]
};
const L6_SHAPE_NAMES = { arch: 'Arch', bowl: 'Bowl', rising: 'Rising', falling: 'Falling', wave: 'Wave' };
function l6ShapeMelody(shape, key, idx) {
  const steps = idx == null ? rand(L6_SHAPES[shape]) : L6_SHAPES[shape][idx], s0 = Motive.pos(degreeMidi('1', key, 0), key).step;
  return steps.map((st, i) => ({ m: Motive.at(s0 + st, 0, key), d: i === steps.length - 1 ? 2 : 0.5 + (i % 2 ? 0 : 0.5) }));
}
function l6ContourItem(names) {
  const shape = rand(names || Object.keys(L6_SHAPES)), key = rand(L6_KEYS), mot = l6ShapeMelody(shape, key);
  const opts = (names || Object.keys(L6_SHAPES)).map(k => L6_SHAPE_NAMES[k]);
  return { q: 'What shape does this melody draw?', options: opts, answer: opts.indexOf(L6_SHAPE_NAMES[shape]), play: () => l6Play(mot, 110), playLabel: 'Hear it again', why: `${CONTOUR_WORDS[shape]}.` };
}
function l6CheckClimax(events) {
  const s = l6Sounding(events);
  if (s.length < 6) return 'Write at least six notes.';
  const ms = s.map(n => n.m), hi = Math.max.apply(null, ms), at = ms.indexOf(hi);
  if (ms.filter(m => m === hi).length > 1) return `Your high note, ${noteName(hi)}, appears more than once. Give the melody one high point.`;
  if (at < s.length * 0.4) return `The high point comes early (note ${at + 1} of ${s.length}). Save it for later in the melody.`;
  if (hi - Math.min.apply(null, ms) > 14) return 'The range is wider than an octave and a bit. Keep it singable.';
  return null;
}

/* ---------- 6.7 motive tools ---------- */
const L6_MOTIVES = [
  [{ m: 60, d: 1 }, { m: 62, d: 0.5 }, { m: 64, d: 0.5 }, { m: 67, d: 2 }],
  [{ m: 67, d: 0.5 }, { m: 65, d: 0.5 }, { m: 64, d: 1 }, { m: 62, d: 1 }, { m: 64, d: 1 }],
  [{ m: 64, d: 1 }, { m: 64, d: 0.5 }, { m: 65, d: 0.5 }, { m: 69, d: 1 }, { m: 67, d: 1 }],
  [{ m: 60, d: 0.5 }, { m: 64, d: 0.5 }, { m: 62, d: 0.5 }, { m: 65, d: 0.5 }, { m: 64, d: 2 }]
];
const L6_QUIZ_TOOLS = ['sequence', 'inversion', 'retrograde', 'augmentation', 'diminution', 'fragment'];
function l6ToolItem(withArt) {
  const pick = rand(L6_QUIZ_TOOLS), t = MOTIVE_TOOLS.find(x => x.id === pick), key = rand(L6_KEYS), mot = l6Shift(rand(L6_MOTIVES), l6KeyShift(key));
  const v = t.fn(mot, key), gap = Motive.length(mot) * 60 / 100 + 0.4;
  const opts = shuffle([t.id].concat(shuffle(L6_QUIZ_TOOLS.filter(x => x !== t.id)).slice(0, 3)));
  return {
    q: 'First the motive, then a variation. Which tool made the variation?',
    html: withArt ? `<div class="l6-pair">${melodyArt(mot, key)}${melodyArt(v, key)}</div>` : '',
    options: opts.map(id => MOTIVE_TOOLS.find(x => x.id === id).name), answer: opts.indexOf(t.id),
    play: () => Sound.seq(motiveSeq(mot, 100).concat(motiveSeq(v, 100).map(n => Object.assign(n, { t: n.t + gap })))), playLabel: 'Hear both again',
    why: `${t.name}: ${t.what}`
  };
}

/* ---------- 6.8 sentence and period ---------- */
/* basic ideas of two bars (8 beats) in C; other keys are shifted */
const L6_BI = [
  [{ m: 60, d: 1 }, { m: 64, d: 1 }, { m: 67, d: 2 }, { m: 69, d: 1 }, { m: 67, d: 1 }, { m: 64, d: 2 }],
  [{ m: 64, d: 0.5 }, { m: 65, d: 0.5 }, { m: 67, d: 1 }, { m: 72, d: 2 }, { m: 71, d: 1 }, { m: 69, d: 1 }, { m: 67, d: 2 }],
  [{ m: 67, d: 1.5 }, { m: 65, d: 0.5 }, { m: 64, d: 1 }, { m: 62, d: 1 }, { m: 60, d: 2 }, { m: 62, d: 2 }],
  [{ m: 60, d: 1 }, { m: 60, d: 0.5 }, { m: 62, d: 0.5 }, { m: 64, d: 2 }, { m: 65, d: 1 }, { m: 64, d: 1 }, { m: 62, d: 2 }]
];
/* build an 8-bar theme from a 2-bar basic idea. o: { form: 'sentence'|'period', rep: 'exact'|'up'|'down', cont: 'fragments'|'faster', end: 'home'|'open', ci: 'falling'|'inverted' } */
function l6Theme(bi, key, o) {
  const B = l6Fit(bi, 8), frag = l6Fit(Motive.fragment(B), 4);
  if (o.form === 'sentence') {
    const rep = o.rep === 'exact' ? B : Motive.sequence(B, key, o.rep === 'down' ? -1 : 1);
    const cont = o.cont === 'faster'
      ? l6Fit([].concat(Motive.diminution(frag), Motive.sequence(Motive.diminution(frag), key, -1), Motive.sequence(Motive.diminution(frag), key, -2), Motive.sequence(Motive.diminution(frag), key, -3)), 8)
      : l6Fit([].concat(frag, Motive.sequence(frag, key, -1)), 8);
    const end = o.end === 'open' ? l6Deg([['3', 1], ['4', 1], ['3', 1], ['2', 1], ['5', 4]], key) : l6Deg([['3', 1], ['2', 1], ['2', 1], ['-7', 1], ['1', 4]], key);
    return { notes: [].concat(B, rep, cont, end), parts: ['basic idea', o.rep === 'exact' ? 'repetition' : 'repetition (sequence)', 'continuation', o.end === 'open' ? 'half cadence' : 'cadence'], romans: ['I', 'I', o.rep === 'exact' ? 'I' : 'V', o.rep === 'exact' ? 'I' : 'V', 'I', 'IV', 'V', o.end === 'open' ? 'V' : 'I'] };
  }
  const ci = o.ci === 'inverted' ? l6Fit(Motive.inversion(frag, key), 4) : l6Deg([['6', 1], ['5', 1], ['4', 1], ['3', 1]], key);
  const half = l6Deg([['2', 4]], key), home = l6Deg([['1', 4]], key);
  return { notes: [].concat(B, ci, half, B, ci, home), parts: ['basic idea', 'contrasting idea → half cadence', 'basic idea again', 'contrasting idea → authentic cadence'], romans: ['I', 'I', 'IV', 'V', 'I', 'I', 'V', 'I'] };
}
function l6FormItem() {
  const form = Math.random() < 0.5 ? 'sentence' : 'period', key = rand(L6_KEYS);
  const th = l6Theme(l6Shift(rand(L6_BI), l6KeyShift(key)), key, { form, rep: rand(['exact', 'up']), cont: rand(['fragments', 'faster']), end: 'home', ci: rand(['falling', 'inverted']) });
  return {
    q: 'Eight bars. Sentence or period?', options: ['Sentence: idea, repeat, then it speeds up to the cadence', 'Period: a question half, then an answer half'], answer: form === 'sentence' ? 0 : 1,
    play: () => l6Play(th.notes, 112, l6Bars(th.romans, key, 112)), playLabel: 'Hear it again',
    why: form === 'sentence' ? 'Sentence: the idea is stated twice, then broken into fragments that drive to one cadence at the end.' : 'Period: the first four bars stop on a half cadence (a question); the next four start the same way and close at home (the answer).'
  };
}
/* Phrase builder: a sentence or period from your motive, then edit it in the notation editor and save.
   p: { prompt, save: { level, tags } } */
Tasks.phraseBuilder = (el, p, done) => {
  const mine = (Store.data.sketches || []).filter(s => sketchMotive(s)).slice(0, 4);
  let key = 'C', bi = L6_BI[0], from = null, o = { form: 'sentence', rep: 'up', cont: 'fragments', end: 'home', ci: 'falling' }, editing = null;
  const opt = (name, label, vals) => `<div class="pb-opt" data-o="${name}"><span class="eyebrow">${label}</span><div class="choices">${vals.map(([v, t]) => `<button type="button" class="choice" data-v="${v}" aria-pressed="${o[name] === v}">${t}</button>`).join('')}</div></div>`;
  el.innerHTML = `${p.prompt ? `<p class="prompt">${p.prompt}</p>` : ''}
    <div class="pb-opt"><span class="eyebrow">Basic idea</span><div class="choices" data-src>${L6_BI.map((b, i) => `<button type="button" class="choice" data-bi="${i}" aria-pressed="${i === 0}">Idea ${i + 1}</button>`).join('')}${mine.map((s, i) => `<button type="button" class="choice" data-sk="${i}" aria-pressed="false">${esc(s.name)}</button>`).join('')}</div></div>
    ${opt('form', 'Form', [['sentence', 'Sentence'], ['period', 'Period']])}
    <div data-sentence>${opt('rep', 'Repetition', [['exact', 'Exact'], ['up', 'A step higher'], ['down', 'A step lower']])}${opt('cont', 'Continuation', [['fragments', 'Fragments'], ['faster', 'Faster fragments']])}${opt('end', 'Ending', [['home', 'Home (do)'], ['open', 'Open (sol)']])}</div>
    <div data-period hidden>${opt('ci', 'Contrasting idea', [['falling', 'A falling line'], ['inverted', 'The idea upside down']])}</div>
    <div class="vl-box"><div class="vl-head"><span class="eyebrow" data-parts></span><button type="button" class="btn small" data-act="play">▶ Play with chords</button><button type="button" class="btn small primary" data-act="edit">Edit and save</button></div><div class="art pb-out"></div></div>
    <div class="pb-edit"></div><p class="fb info" aria-live="polite">Change one choice at a time and listen to what it does.</p>`;
  const $ = s => el.querySelector(s);
  let th = null;
  function paint() {
    th = l6Theme(bi, key, o);
    $('[data-sentence]').hidden = o.form !== 'sentence'; $('[data-period]').hidden = o.form !== 'period';
    $('.pb-out').innerHTML = melodyArt(th.notes, key);
    $('[data-parts]').textContent = th.parts.join(' · ');
  }
  el.addEventListener('click', ev => {
    const b = ev.target.closest('[data-v]');
    if (b) { const name = b.closest('[data-o]').dataset.o; o[name] = b.dataset.v; b.closest('.choices').querySelectorAll('[data-v]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); paint(); return; }
    const s = ev.target.closest('[data-bi], [data-sk]');
    if (s) {
      $('[data-src]').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === s)));
      if (s.dataset.bi != null) { bi = L6_BI[+s.dataset.bi]; key = 'C'; from = null; }
      else { const sk = mine[+s.dataset.sk]; key = sketchKey(sk); bi = sketchMotive(sk); from = sk.id; }
      paint(); l6Play(l6Fit(bi, 8), 112);
    }
  });
  $('[data-act="play"]').onclick = () => l6Play(th.notes, 112, l6Bars(th.romans, key, 112));
  $('[data-act="edit"]').onclick = () => {
    if (editing) editing();
    const sv = p.save || {};
    editing = Tasks.capture($('.pb-edit'), {
      prompt: 'Change anything you like: select a note, then move it or change its length. Then name it and save.',
      meter: '4/4', bpm: 112, bars: 8, keySig: Theory.keySig(key).n, initial: motiveEvents(th.notes, key), name: o.form === 'sentence' ? 'My sentence' : 'My period', min: 8,
      save: { level: sv.level, tags: (sv.tags || []).concat([o.form]), from: from || undefined, prompt: 'Phrase builder', key, extra: { chords: l6Bars(th.romans, key, 112) } }
    }, (ok, r) => done(true, r));
  };
  paint();
  return () => { if (editing) editing(); };
};

/* ---------- 6.9 non-chord tones ---------- */
const L6_NCT = {
  passing: { name: 'Passing tone', what: 'steps between two chord tones, going the same way', notes: [[60, 1], [62, 1], [64, 2]] },
  neighbour: { name: 'Neighbour tone', what: 'steps away from a chord tone and back', notes: [[64, 1], [65, 1], [64, 2]] },
  appoggiatura: { name: 'Appoggiatura', what: 'leaps to a clashing note on the strong beat, then steps into the chord', notes: [[60, 1], [65, 1.5], [64, 1.5]] },
  escape: { name: 'Escape tone', what: 'steps out of the chord, then leaps back to a chord tone', notes: [[64, 1], [65, 1], [60, 2]] },
  anticipation: { name: 'Anticipation', what: 'arrives early: a note of the next chord before that chord sounds', notes: [[64, 1], [62, 1], [62, 2]], next: 'V' }
};
function l6NctItem(withArt) {
  const id = rand(Object.keys(L6_NCT)), x = L6_NCT[id], key = rand(['C', 'G', 'F']), k = l6KeyShift(key);
  const mot = x.notes.map(([m, d]) => ({ m: m + k, d }));
  const chords = [{ sym: Theory.romanChord('I', key).sym, t: 0, d: x.next ? 1.2 : 2.4 }].concat(x.next ? [{ sym: Theory.romanChord('V', key).sym, t: 1.2, d: 1.2 }] : []);
  const opts = shuffle(Object.keys(L6_NCT)).slice(0, 4); if (opts.indexOf(id) < 0) opts[0] = id;
  const ids = shuffle(opts);
  return {
    q: 'The middle note is not in the chord. What kind of note is it?', html: withArt ? melodyArt(mot, key) : '',
    options: ids.map(i => L6_NCT[i].name), answer: ids.indexOf(id),
    play: () => l6Play(mot, 100, chords), playLabel: 'Hear it again',
    why: `${x.name}: it ${x.what}.`
  };
}
const L6_ORN = {
  trill: { name: 'Trill', what: 'a fast shake between the note and the one above', play: m => Sound.seq(Array.from({ length: 12 }, (v, i) => ({ m: i % 2 ? m + 2 : m, t: i * 0.07, d: 0.07 })).concat([{ m, t: 0.84, d: 0.5 }])) },
  mordent: { name: 'Mordent', what: 'one quick flick: note, the note above, back to the note', play: m => Sound.seq([{ m, t: 0, d: 0.08 }, { m: m + 2, t: 0.08, d: 0.08 }, { m, t: 0.16, d: 0.8 }]) },
  turn: { name: 'Turn', what: 'the note above, the note, the note below, the note', play: m => Sound.seq([{ m: m + 2, t: 0, d: 0.12 }, { m, t: 0.12, d: 0.12 }, { m: m - 1, t: 0.24, d: 0.12 }, { m, t: 0.36, d: 0.8 }]) }
};
function l6OrnItem() {
  const id = rand(Object.keys(L6_ORN)), ids = Object.keys(L6_ORN), m = rand([64, 67, 69]);
  return { q: 'Which ornament?', options: ids.map(i => L6_ORN[i].name), answer: ids.indexOf(id), play: () => L6_ORN[id].play(m), playLabel: 'Hear it again', why: `${L6_ORN[id].name}: ${L6_ORN[id].what}.` };
}
/* the skeleton to decorate: half notes on chord tones over I–IV–V–I in C */
const L6_SKELETON = [{ m: 64, d: 2 }, { m: 67, d: 2 }, { m: 65, d: 2 }, { m: 69, d: 2 }, { m: 67, d: 2 }, { m: 62, d: 2 }, { m: 64, d: 2 }, { m: 60, d: 2 }];
const L6_SKELETON_CHORDS = ['I', 'IV', 'V', 'I'];
/* the same skeleton in quarter notes, each chord tone played twice: the second of each pair is free to become a passing or neighbour tone */
const L6_SKELETON_PAIRS = L6_SKELETON.reduce((a, n) => a.concat([{ m: n.m, d: 1 }, { m: n.m, d: 1 }]), []);
function l6CheckDecor(events) {
  const s = l6Sounding(events), pcs = L6_SKELETON_CHORDS.map(r => Theory.romanChord(r, 'C').notes.map(Theory.pc));
  if (s.length < 10) return 'Add more notes: split some half notes and move the new notes to neighbours or passing tones.';
  let nct = 0;
  s.forEach(n => { const bar = Math.min(3, Math.floor(n.at / 4 + 1e-6)); if (pcs[bar].indexOf(mod12(n.m)) < 0) nct++; });
  return nct >= 2 ? null : `Use at least two notes that are not in the bar’s chord (passing or neighbour tones). You have ${nct}.`;
}

/* ---------- boss: play transformations ---------- */
/* p: { tools: ['sequence', 'inversion', 'retrograde'], maxMisses (per transformation) } */
Tasks.transformPlay = (el, p, done) => {
  const key = rand(['C', 'G', 'F']), mot = l6Shift(rand(L6_MOTIVES), l6KeyShift(key)), tools = p.tools || ['sequence', 'inversion', 'retrograde'];
  let i = 0, inner = null, finished = false;
  el.innerHTML = `<p class="prompt">${p.prompt || 'Here is a motive. Play each transformation of it, in any octave.'}</p><div class="vl-box"><div class="vl-head"><span class="eyebrow">The motive · ${key} major</span><button type="button" class="btn small" data-act="hear">▶ Play</button></div><div class="art">${melodyArt(mot, key)}</div></div><div class="progress-dots">${'<span></span>'.repeat(tools.length)}</div><div class="tp-step"></div><div class="row" data-retry hidden><button type="button" class="btn small" data-act="retry">Try again</button></div>`;
  const dots = el.querySelectorAll('.progress-dots span'), host = el.querySelector('.tp-step'), retry = el.querySelector('[data-retry]');
  el.querySelector('[data-act="hear"]').onclick = () => Sound.seq(motiveSeq(mot, 96));
  function step() {
    if (inner) inner();
    if (i >= tools.length) { finished = true; done(true); return; }
    const t = MOTIVE_TOOLS.find(x => x.id === tools[i]), target = t.fn(mot, key).filter(n => n.m != null);
    inner = Tasks.playSeq(host, {
      prompt: `${i + 1}. Play its ${t.name.toLowerCase()}.`, notes: target.map(n => spellIn(n.m, key)), show: 'hidden',
      hint: () => t.what, endText: `${t.name}: right.`
    }, (ok, r) => {
      if (r.misses > (p.maxMisses == null ? 2 : p.maxMisses)) { dots[i].classList.add('miss'); host.insertAdjacentHTML('beforeend', `<p class="fb bad">${r.misses} wrong notes on the ${t.name.toLowerCase()}. You can have ${p.maxMisses == null ? 2 : p.maxMisses}.</p>`); retry.hidden = false; return; }
      dots[i].classList.add('on'); i++; setTimeout(step, 900);
    });
  }
  el.querySelector('[data-act="retry"]').onclick = () => { retry.hidden = true; dots[i].className = ''; step(); };
  step();
  return () => { if (inner) inner(); void finished; };
};

/* ---------- units 6.5–6.9, project, boss ---------- */
const L6_MELODY_UNITS = [
  { id: '6.5', title: 'Scale degrees in context', blurb: 'Hear every note’s job in the key.', workshop: true, steps: [
    { k: 'card', tag: 'Hear', title: 'Settled and restless', body: '<p>Press each button. A drone and four chords set up the key of C. Some notes sound settled over it; others pull toward a neighbour.</p>',
      mount: l6Players([['The key', () => { Drone.start('C', 2); playKeyContext('C'); }], ['do', () => Sound.tone(60, null, 1.2)], ['mi', () => Sound.tone(64, null, 1.2)], ['ti → do', () => Sound.seq([{ m: 71, t: 0, d: 0.7 }, { m: 72, t: 0.75, d: 1 }])], ['fa → mi', () => Sound.seq([{ m: 65, t: 0, d: 0.7 }, { m: 64, t: 0.75, d: 1 }])], ['Drone off', () => Drone.stop()]]) },
    { k: 'task', tag: 'Echo', title: 'Do, mi or sol?', type: 'degreeEar', p: { degrees: ['1', '3', '5'], keys: ['C'], rounds: 6, context: 'first', prompt: 'Hear the key, then one note. Which is it?' } },
    { k: 'card', tag: 'Name', title: 'Scale degrees', body: `<p>A <b>scale degree</b> is a note’s position in the key: do is 1, re 2, and so on. Musicians hear notes by their job in the key, not by their letter, so a tune sounds the same in any key.</p>
      <table class="tbl"><thead><tr><th>Degree</th><th>Syllable</th><th>Job</th></tr></thead><tbody>
      <tr><td>1</td><td>do</td><td>Home. Rest.</td></tr><tr><td>2</td><td>re</td><td>Leans down to do (or up to mi).</td></tr><tr><td>3</td><td>mi</td><td>Settled; the colour of major.</td></tr>
      <tr><td>4</td><td>fa</td><td>Leans down to mi.</td></tr><tr><td>5</td><td>sol</td><td>Settled and strong.</td></tr><tr><td>6</td><td>la</td><td>Leans down to sol.</td></tr><tr><td>7</td><td>ti</td><td>The <b>leading tone</b>: pulls up to do.</td></tr></tbody></table>
      <p class="hook"><b>The restless pair:</b> ti goes up, fa goes down. Together they make the pull of V7 to I.</p>${l6Deeper('Gordon, <i>Learning Sequences in Music</i> (audiation); Kodály movable-do; Karpinski, <i>Aural Skills Acquisition</i>.')}` },
    { k: 'task', tag: 'Explore', title: 'All seven, and where they lean', type: 'degreeEar', p: { degrees: ['1', '2', '3', '4', '5', '6', '7'], keys: ['C', 'G', 'F'], rounds: 8, context: 'first', prompt: 'After each answer you hear the note resolve. Listen for the pull.' } },
    { k: 'task', tag: 'Echo', title: 'Sing them', type: 'degreeEar', p: { mode: 'play', degrees: ['1', '2', '3', '4', '5', '6', '7'], keys: ['D', 'F'], rounds: 5, context: 'first', prompt: 'A syllable appears. Sing it (the mic listens) or play it, in any octave.' } },
    { k: 'task', tag: 'Create', title: 'Workshop: lean and land', type: 'capture', p: () => ({ prompt: 'Write 4 bars in C that lean on restless notes and let them land: ti → do, fa → mi, re → do, la → sol. End on do.', meter: '4/4', bpm: 92, bars: 4, keySig: 0, min: 5, check: ev => l6CheckTendency(ev, 'C'), save: { level: 6, tags: ['scale degrees', 'tendency tones'], key: 'C', prompt: 'Lean and land' } }) }
  ] },
  { id: '6.6', title: 'Contour and range', blurb: 'The shape a melody draws.', workshop: true, steps: [
    { k: 'card', tag: 'Hear', title: 'Three shapes', body: '<p>Play each melody and watch the line it draws. Same key, same notes to choose from, three different shapes.</p>',
      mount: l6Players(['arch', 'falling', 'wave'].map(sh => [L6_SHAPE_NAMES[sh], () => l6Play(l6ShapeMelody(sh, 'C', 0), 110), () => contourSVG(l6ShapeMelody(sh, 'C', 0))])) },
    { k: 'task', tag: 'Echo', title: 'Name the shape', type: 'quiz', p: { rounds: 5, gen: () => l6ContourItem() } },
    { k: 'card', tag: 'Name', title: 'One high point', art: () => contourSVG(l6ShapeMelody('arch', 'C', 1)), body: `<p>The <b>contour</b> is the shape a melody draws. Melodies people remember usually have:</p>
      <p>· <b>one climax</b>, a single highest note, often about two-thirds of the way through;<br>· a range of about an octave, so it can be sung;<br>· mostly steps, with a few leaps for drama;<br>· after a leap, a step back the other way, to fill the gap.</p>
      <p class="hook"><b>Leap, then step back.</b> A leap opens a gap; the ear wants it filled.</p>${l6Deeper('Perricone, <i>Melody in Songwriting</i>; Huron, <i>Sweet Anticipation</i> (why a leap creates expectation).')}` },
    { k: 'task', tag: 'Explore', title: 'Leap, then step back', type: 'playSeq', p: { prompt: 'Play this tune. Feel the leap up to A, then the steps that fill it in.', notes: ['C4', 'E4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4'], steps: false, endText: 'The leap opened a gap; the steps filled it.' } },
    { k: 'task', tag: 'Create', title: 'Workshop: one high point', type: 'capture', p: () => ({ prompt: 'Write 4 bars with a single high point that arrives late, and keep it within an octave. Any key.', meter: '4/4', bpm: 96, bars: 4, keySig: 0, min: 6, check: l6CheckClimax, save: { level: 6, tags: ['contour', 'climax'], prompt: 'One high point' } }) },
    { k: 'card', tag: 'Name', title: 'Your melody’s shape', art: () => { const s = (Store.data.sketches || [])[0]; return s && s.score ? contourSVG(l6Sounding(s.score.events).map(n => ({ m: n.m, d: n.d }))) : ''; },
      body: '<p>This is the line your melody draws, with its high point marked. Does it go where you meant it to?</p>' }
  ] },
  { id: '6.7', title: 'The motive and its tools', blurb: 'Small idea, many lives.', workshop: true, steps: [
    { k: 'card', tag: 'Hear', title: 'One idea, a whole tune', body: '<p>First a four-note motive. Then a tune made only from it: repeated, moved up a step, turned upside down, cut in half.</p>',
      mount: l6Players([['The motive', () => l6Play(L6_MOTIVES[0], 100)], ['What a composer makes of it', () => l6Play([].concat(L6_MOTIVES[0], Motive.sequence(L6_MOTIVES[0], 'C', 1), Motive.inversion(L6_MOTIVES[0], 'C'), Motive.fragment(L6_MOTIVES[0]), Motive.sequence(Motive.fragment(L6_MOTIVES[0]), 'C', -1), [{ m: 60, d: 2 }]), 100)]]) },
    { k: 'card', tag: 'Name', title: 'The tools', art: () => `<div class="l6-tools">${MOTIVE_TOOLS.slice(1).map(t => `<div class="l6-tool"><b>${t.name}</b><span>${t.what}</span>${melodyArt(t.fn(L6_MOTIVES[0], 'C'), 'C')}</div>`).join('')}</div>`,
      body: `<p>A <b>motive</b> is the smallest idea that is still recognizable. Composers rarely invent new material for every bar; they develop the motive with a handful of tools. Here each tool is applied to the motive you just heard.</p>${l6Deeper('Schoenberg, <i>Fundamentals of Musical Composition</i>, on the motive and its variations.')}` },
    { k: 'task', tag: 'Echo', title: 'Which tool?', type: 'quiz', p: { rounds: 5, gen: () => l6ToolItem(true) } },
    { k: 'task', tag: 'Create', title: 'Workshop: the Variation Lab', type: 'variationLab', p: { prompt: 'Start from your own motive (your Level 1 motif is here if you saved it) or the example. Try every tool, then chain three variations you like into a phrase.', need: 3, save: { level: 6, tags: ['motive development'], prompt: 'Variation Lab' } } }
  ] },
  { id: '6.8', title: 'Sentence and period', blurb: 'Two ways to build a theme.', workshop: true, steps: [
    { k: 'card', tag: 'Hear', title: 'Two themes from one idea', body: '<p>Both start with the same two-bar idea. Listen for where each one breathes and where it ends.</p>',
      mount: l6Players([['Theme 1', () => { const th = l6Theme(L6_BI[0], 'C', { form: 'sentence', rep: 'up', cont: 'fragments', end: 'home' }); l6Play(th.notes, 112, l6Bars(th.romans, 'C', 112)); }], ['Theme 2', () => { const th = l6Theme(L6_BI[0], 'C', { form: 'period', ci: 'falling' }); l6Play(th.notes, 112, l6Bars(th.romans, 'C', 112)); }]]) },
    { k: 'card', tag: 'Name', title: 'Sentence and period', body: `<p>Theme 1 is a <b>sentence</b>: a two-bar <b>basic idea</b>, its <b>repetition</b> (exact or a step away), then a <b>continuation</b> that breaks the idea into fragments and speeds up into the <b>cadence</b>.</p>
      <div class="l6-form"><span>basic idea</span><span>repetition</span><span class="w">continuation → cadence</span></div>
      <p>Theme 2 is a <b>period</b>: an <b>antecedent</b> that stops on a half cadence, like a question, then a <b>consequent</b> that starts the same way and ends at home, the answer.</p>
      <div class="l6-form"><span>basic idea</span><span>contrasting idea → half cadence</span><span>basic idea</span><span>contrasting idea → home</span></div>${l6Deeper('Caplin, <i>Classical Form</i> and <i>Analyzing Classical Form</i>; Schoenberg, <i>Fundamentals of Musical Composition</i>.')}` },
    { k: 'task', tag: 'Echo', title: 'Sentence or period?', type: 'quiz', p: { rounds: 4, gen: () => l6FormItem() } },
    { k: 'task', tag: 'Create', title: 'Workshop: the phrase builder', type: 'phraseBuilder', p: { prompt: 'Build an 8-bar theme from a basic idea (one of yours or an example). Try both forms and every choice, then edit it and save the one you like.', save: { level: 6, tags: ['phrase structure'] } } }
  ] },
  { id: '6.9', title: 'Decorating a melody', blurb: 'The notes between the chord tones.', workshop: true, steps: [
    { k: 'card', tag: 'Hear', title: 'Bones and decoration', body: '<p>First the skeleton: one chord tone every two beats over I–IV–V–I. Then the same skeleton with notes in between.</p>',
      mount: l6Players([['Skeleton', () => l6Play(L6_SKELETON, 96, l6Bars(L6_SKELETON_CHORDS, 'C', 96))], ['Decorated', () => l6Play([{ m: 64, d: 1 }, { m: 65, d: 1 }, { m: 67, d: 2 }, { m: 65, d: 1 }, { m: 67, d: 1 }, { m: 69, d: 2 }, { m: 67, d: 1 }, { m: 65, d: 0.5 }, { m: 64, d: 0.5 }, { m: 62, d: 2 }, { m: 64, d: 1 }, { m: 62, d: 1 }, { m: 60, d: 2 }], 96, l6Bars(L6_SKELETON_CHORDS, 'C', 96))]]) },
    { k: 'card', tag: 'Name', title: 'Non-chord tones', art: () => `<div class="l6-tools">${Object.keys(L6_NCT).map(k => `<div class="l6-tool"><b>${L6_NCT[k].name}</b><span>It ${L6_NCT[k].what}.</span>${melodyArt(L6_NCT[k].notes.map(([m, d]) => ({ m, d })), 'C')}</div>`).join('')}</div>`,
      body: `<p>Notes that are not in the chord are <b>non-chord tones</b>. On a weak beat they add motion; on a strong beat (an appoggiatura) they add longing. Each has a shape: how it arrives and how it leaves.</p>${l6Deeper('Kostka, Payne & Almén, <i>Tonal Harmony</i>; Laitz, <i>The Complete Musician</i>.')}` },
    { k: 'task', tag: 'Echo', title: 'Which kind?', type: 'quiz', p: { rounds: 5, gen: () => l6NctItem(true) } },
    { k: 'task', tag: 'Explore', title: 'Ornaments', type: 'quiz', p: { rounds: 3, prompt: 'Ornaments are written as small signs above a note: tr for a trill, a short squiggle for a mordent, a sideways S for a turn. Hear each and name it.', gen: () => l6OrnItem() } },
    { k: 'task', tag: 'Create', title: 'Workshop: decorate the skeleton', type: 'capture', p: () => ({ prompt: 'Here is the skeleton with every chord tone written twice. Select the second note of a pair and play a new note to replace it: a step toward the next chord tone (passing) or a step away and back (neighbour). Make at least two, listen, then save.', meter: '4/4', bpm: 96, bars: 4, keySig: 0, initial: motiveEvents(L6_SKELETON_PAIRS, 'C'), name: 'Decorated skeleton', min: 10, check: l6CheckDecor, save: { level: 6, tags: ['non-chord tones'], key: 'C', prompt: 'Decorate the skeleton', extra: { chords: l6Bars(L6_SKELETON_CHORDS, 'C', 96) } } }) }
  ] },
  { id: '6.P', title: 'Project: a 16-bar theme', blurb: 'Draft it, review it, make version 2.', create: true, steps: [
    { k: 'card', tag: 'Name', title: 'The brief', body: '<p>Write a <b>16-bar theme</b>: a sentence answered by a period, or two periods. Use what this level taught: a motive and its tools, one high point, tendency tones that land, a groove that suits the flavour.</p><p>You will make a <b>draft</b>, review it against five questions, write <b>version 2</b>, then compare the two. Revising is the skill; it is fine if the draft wins.</p>' },
    { k: 'task', tag: 'Explore', title: 'Flavour and seed', type: 'projectSetup', p: { project: '6.P', prompt: 'Pick a flavour (it sets the meter and groove) and, if you like, a sketch to grow.' } },
    { k: 'task', tag: 'Create', title: 'Draft', type: 'projectDraft', p: { project: '6.P', bars: 16, level: 6, tags: ['theme', 'draft'], prompt: 'Record your 16-bar theme over the click. Fix notes in the editor. End on a stable note.', check: (ev, key) => { const l = l6Last(ev); return l && ['1', '3', '5'].indexOf(degreeOf(l.m, key)) >= 0 ? null : `End on do, mi or sol of ${key} so the theme sounds finished.`; } } },
    { k: 'task', tag: 'Name', title: 'Review', type: 'review', p: { project: '6.P', prompt: 'Play your draft and rate it honestly.', criteria: [
      { id: 'motive', label: 'A memorable motive', help: 'Could someone hum the opening after one listen?' },
      { id: 'form', label: 'Clear phrases', help: 'Can you hear where each phrase ends, and is it a sentence or a period?' },
      { id: 'climax', label: 'One high point', help: 'Is there a single peak, late in the theme?' },
      { id: 'cadence', label: 'Question and answer', help: 'Does the middle sound unfinished and the end finished?' },
      { id: 'groove', label: 'Groove', help: 'Does the rhythm suit the flavour?' }] } },
    { k: 'task', tag: 'Create', title: 'Version 2', type: 'projectDraft', p: { project: '6.P', version: 2, bars: 16, level: 6, tags: ['theme', 'version 2'], prompt: 'Your draft is loaded. Change what your review asked for.', check: (ev, key) => { const l = l6Last(ev); return l && ['1', '3', '5'].indexOf(degreeOf(l.m, key)) >= 0 ? null : `End on do, mi or sol of ${key}.`; } } },
    { k: 'task', tag: 'Name', title: 'Compare', type: 'compare', p: { project: '6.P', prompt: 'Play both. Which is stronger, and why?' } }
  ], doneText: 'Your theme, its review and version 2 are in your sketchbook.' },
  { id: '6.B', title: 'Boss challenge', blurb: 'Rhythm, scale degrees and motive tools.', boss: true, steps: [
    { k: 'card', tag: 'Name', title: 'Show what you know', body: '<p>Part 1: hear four rhythms in 6/8 and four syncopated rhythms in 4/4, and pick the notation for each. You need 3 of 4 each time.</p><p>Part 2: name 8 scale degrees by ear, in two keys. You need 7.</p><p>Part 3: play three transformations of a motive: its sequence, its inversion and its retrograde. Two wrong notes each are allowed.</p>' },
    { k: 'task', tag: 'Echo', title: 'Rhythm in 6/8', type: 'rhythmDictation', p: { mode: 'choose', meter: '6/8', bpm: 120, rounds: 4, pass: 3, patterns: ['q e q e', 'q. q e', 'e e e q.', 'q e e e e', 'q. e e e', 'e e e e e e', 'q.r q e', 'q e q.'] } },
    { k: 'task', tag: 'Echo', title: 'Syncopation in 4/4', type: 'rhythmDictation', p: { mode: 'choose', meter: '4/4', bpm: 80, rounds: 4, pass: 3, patterns: ['q e q e q', 'e q e q q', 'q q e q e', 'e q q q e', 'q. e_q q', 'e e_q e q e', 'q e e_e e q', 'qr e q e q'] } },
    { k: 'task', tag: 'Echo', title: 'Scale degrees', type: 'degreeEar', p: { degrees: ['1', '2', '3', '4', '5', '6', '7'], keys: ['C', 'G', 'F', 'D'], rounds: 8, pass: 7, context: 'first', passMsg: 'Part 2 passed.' } },
    { k: 'task', tag: 'Echo', title: 'Motive tools', type: 'transformPlay', p: { tools: ['sequence', 'inversion', 'retrograde'], maxMisses: 2 } }
  ] }
];

/* ---------- review cards ---------- */
CARD_TYPES.l6degree = (el, c, fin) => Tasks.degreeEar(el, { degrees: c.degrees || ['1', '2', '3', '4', '5', '6', '7'], keys: L6_KEYS, rounds: 1, context: 'first' }, (ok, r) => fin(r.score === 1));
const l6Q = (q, right, wrongs, why) => () => { const opts = shuffle([right].concat(wrongs)); return { q, options: opts, answer: opts.indexOf(right), why }; };
const L6_MELODY_CARDS = {
  '6.5': [
    { id: 'l6-deg-ear', type: 'l6degree', degrees: ['1', '3', '5', '7'] },
    { id: 'l6-deg-ear-all', type: 'l6degree' },
    { id: 'l6-leading', type: 'gen', gen: l6Q('Which scale degree is the leading tone?', 'ti (7)', ['fa (4)', 'sol (5)', 're (2)'], 'Ti, the 7th degree, a half step below do, pulls up to it.') },
    { id: 'l6-fa', type: 'gen', gen: () => { const k = rand(['G', 'D', 'F', 'B♭', 'A']), right = Theory.scale(k)[3]; return l6Q(`In ${k} major, which note is fa?`, right, shuffle(Theory.scale(k).filter(n => n !== right)).slice(0, 3), `Fa is the 4th degree: ${right} in ${k}. It leans down to mi (${Theory.scale(k)[2]}).`)(); } },
    { id: 'l6-lean', type: 'gen', gen: l6Q('Where does fa want to go?', 'Down a half step to mi', ['Up to sol', 'Down to re', 'Nowhere: it is stable'], 'Fa leans down to mi; ti leans up to do.') }
  ],
  '6.6': [
    { id: 'l6-contour', type: 'gen', gen: () => l6ContourItem() },
    { id: 'l6-gap', type: 'gen', gen: l6Q('After a big leap up, a melody usually…', 'steps back down to fill the gap', ['leaps up again', 'stops', 'repeats the high note'], 'Leap, then step back: the ear wants the gap filled.') },
    { id: 'l6-climax', type: 'gen', gen: l6Q('Where does a melody’s single high point usually sit?', 'About two-thirds of the way through', ['On the first note', 'On the very last note', 'Everywhere: repeat it often'], 'Saving the climax gives the melody somewhere to go.') }
  ],
  '6.7': [
    { id: 'l6-tool-ear', type: 'gen', gen: () => l6ToolItem(false) },
    { id: 'l6-tool-see', type: 'gen', gen: () => l6ToolItem(true) },
    { id: 'l6-inversion', type: 'gen', gen: l6Q('In an inversion, a step up becomes…', 'a step down', ['a leap up', 'the same step up', 'a rest'], 'Inversion mirrors every interval.') },
    { id: 'l6-seq', type: 'gen', gen: l6Q('Repeating a motive a step higher is called…', 'a sequence', ['a retrograde', 'an augmentation', 'a fragment'], 'A sequence repeats the shape starting on another note.') }
  ],
  '6.8': [
    { id: 'l6-form-ear', type: 'gen', gen: () => l6FormItem() },
    { id: 'l6-sentence', type: 'gen', gen: l6Q('A sentence is built from…', 'a basic idea, its repetition, then a continuation to a cadence', ['a question and an answer', 'four different ideas', 'one idea played four times'], 'Basic idea, repetition, continuation with fragments, cadence.') },
    { id: 'l6-antecedent', type: 'gen', gen: l6Q('The first half of a period (the antecedent) usually ends on…', 'a half cadence, on V', ['an authentic cadence, on I', 'a rest', 'the highest note'], 'The antecedent asks a question by stopping on V; the consequent answers on I.') }
  ],
  '6.9': [
    { id: 'l6-nct-ear', type: 'gen', gen: () => l6NctItem(true) },
    { id: 'l6-passing', type: 'gen', gen: l6Q('A note that steps between two chord tones in the same direction is…', 'a passing tone', ['a neighbour tone', 'an appoggiatura', 'an escape tone'], 'Passing tones pass; neighbour tones go and come back.') },
    { id: 'l6-orn', type: 'gen', gen: () => l6OrnItem() }
  ]
};

/* ---------- Ear Gym skills from Level 6 ---------- */
addEarSkill({ id: 'contour', label: 'Melodic contour', unit: '6.6', run: (body, fin, diff) => Tasks.quiz(body, { rounds: 5, gen: () => l6ContourItem(diff <= 2 ? ['arch', 'rising', 'falling'] : null) }, (ok, r) => fin(r.score, 5)) });
addEarSkill({ id: 'motive', label: 'Motive tools', unit: '6.7', run: (body, fin, diff) => Tasks.quiz(body, { rounds: 5, gen: () => l6ToolItem(diff <= 2) }, (ok, r) => fin(r.score, 5)) });
addEarSkill({ id: 'phrase', label: 'Sentence or period', unit: '6.8', run: (body, fin) => Tasks.quiz(body, { rounds: 4, gen: () => l6FormItem() }, (ok, r) => fin(r.score, 4)) });
addEarSkill({ id: 'nct', label: 'Non-chord tones', unit: '6.9', run: (body, fin, diff) => Tasks.quiz(body, { rounds: 5, gen: () => l6NctItem(diff <= 2) }, (ok, r) => fin(r.score, 5)) });
addEarSkill({ id: 'meter', label: 'Meter by ear', unit: '6.1', run: (body, fin, diff) => Tasks.meterFeel(body, { rounds: 5, choices: diff <= 2 ? ['3/4', '6/8'] : diff <= 3 ? ['2/4', '3/4', '6/8'] : ['3/4', '6/8', '5/4', '7/8'] }, (ok, r) => fin(r.score, 5)) });
/* dictation patterns per meter: a 6/8 bar is three quarters long, a 4/4 bar four */
const L6_DICT = {
  '4/4': ['q e q e q', 'e q e q q', 'q q e q e', 'q. e q q', 'e e_q e q e', 'q e e_e e q'],
  '6/8': ['q e q e', 'q. q e', 'e e e q.', 'q e e e e', 'q. e e e', 'e e e e e e']
};
addEarSkill({ id: 'rhythm', label: 'Rhythm dictation', unit: '6.3', run: (body, fin, diff) => {
  const m = diff <= 2 ? '4/4' : rand(['6/8', '4/4']);
  return Tasks.rhythmDictation(body, { mode: 'choose', meter: m, bpm: m === '6/8' ? 102 + diff * 6 : 72 + diff * 4, rounds: 4, patterns: L6_DICT[m] }, (ok, r) => fin(r.score, 4));
} });

/* ---------- Listening Maps: real songs by title only; Motif plays its own groove in the same meter ---------- */
const l6Groove = (meter, bpm) => () => Score.groove({ meter, bpm, bars: 2 });
addListeningMap({ id: 'lm6-rising', level: 6, unit: '6.1', topic: 'Compound time', song: 'The House of the Rising Sun', artist: 'The Animals',
  intro: 'The guitar picks out each chord as a steady stream of notes. Count them against the slow beat.', model: l6Groove('6/8', 120), modelLabel: 'Hear a 6/8 groove (Motif’s own)',
  listenFor: [
    { q: 'Tap your foot to the slow beat. How do the guitar’s notes fill each beat?', options: ['In twos', 'In threes', 'In fours'], answer: 1, why: 'Three notes to each beat: that is compound time, written in 6/8.' },
    { q: 'So is it simple time (beats split in two) or compound time (beats split in three)?', options: ['Simple', 'Compound'], answer: 1, why: 'Compound: each beat splits in three.' }] });
addListeningMap({ id: 'lm6-champions', level: 6, unit: '6.1', topic: 'Compound time', song: 'We Are the Champions', artist: 'Queen',
  intro: 'A big, slow ballad that lilts. Feel where the beat is, then how it divides.', model: l6Groove('6/8', 100), modelLabel: 'Hear a slow 6/8 groove (Motif’s own)',
  listenFor: [
    { q: 'Sway to it. Does each beat split in two or in three?', options: ['Two', 'Three'], answer: 1, why: 'In three: the lilt of compound time. It is usually written in 6/8 or 12/8.' },
    { q: 'Which meter fits it best?', options: ['4/4', '3/4', '6/8'], answer: 2, why: 'Two big beats a bar, each in three: 6/8.' }] });
addListeningMap({ id: 'lm6-takefive', level: 6, unit: '6.4', topic: 'Odd meters', song: 'Take Five', artist: 'The Dave Brubeck Quartet',
  intro: 'The piano repeats a short vamp all the way under the saxophone. Count the beats in one turn of it.', model: l6Groove('5/4', 168), modelLabel: 'Hear a 5/4 groove (Motif’s own)',
  listenFor: [
    { q: 'How many beats are in each bar of the piano vamp?', options: ['3', '4', '5', '7'], answer: 2, why: 'Five: the tune is famous for being in 5/4.' },
    { q: 'How do the five beats group?', options: ['3 + 2', '2 + 3', '1 + 4'], answer: 0, why: 'Three then two: ONE two three FOUR five.' }] });
addListeningMap({ id: 'lm6-mission', level: 6, unit: '6.4', topic: 'Odd meters', song: 'Mission: Impossible Theme', artist: 'Lalo Schifrin',
  intro: 'The famous spy theme rides on a driving ostinato. Count the long and short notes of one bar.', model: l6Groove('5/4', 168), modelLabel: 'Hear a 5/4 groove (Motif’s own)',
  listenFor: [
    { q: 'How many beats are in each bar of the ostinato?', options: ['4', '5', '6'], answer: 1, why: 'Five: the theme is in 5/4.' }] });
addListeningMap({ id: 'lm6-money', level: 6, unit: '6.4', topic: 'Changing meter', song: 'Money', artist: 'Pink Floyd',
  intro: 'A bass riff opens the song and comes back again and again. Count it, then listen for what happens when the guitar solo starts.', model: l6Groove('7/4', 120), modelLabel: 'Hear a 7/4 groove (Motif’s own)',
  listenFor: [
    { q: 'How many beats are in one bar of the bass riff?', options: ['5', '6', '7', '8'], answer: 2, why: 'Seven: the riff is in 7/4.' },
    { q: 'When the guitar solo starts, what happens to the meter?', options: ['It stays in 7', 'It changes to 4/4', 'It changes to 3/4'], answer: 1, why: 'The band switches to 4/4 for the solo, then returns to 7/4: a changing meter used for effect.' }] });

/* ---------- the level ---------- */
const L6_DAILY = [
  { meter: '4/4', bpm: 92, prompt: 'Eight bars in 4/4 that use one motive at least three times.' },
  { meter: '6/8', bpm: 108, prompt: 'Eight bars in 6/8 with one high point in bar 6.' },
  { meter: '4/4', bpm: 100, swing: 0.62, prompt: 'Eight swung bars with three syncopations.' },
  { meter: '3/4', bpm: 96, prompt: 'A waltz melody: eight bars, a sentence (idea, repeat, continuation).' },
  { meter: '4/4', bpm: 88, prompt: 'Eight bars where ti always goes to do and fa always goes to mi.' },
  { meter: '5/4', bpm: 112, prompt: 'Eight bars in 5/4, grouped 3 + 2, with a pickup into bar 1.' },
  { meter: '4/4', bpm: 92, prompt: 'Eight bars that start with a leap and fill it with steps.' },
  { meter: '7/8', bpm: 140, prompt: 'A riff in 7/8 (2 + 2 + 3), repeated with one change each time.' }
];
addLevel({
  n: 6, section: 'Intermediate', title: 'Groove & Line', tagline: 'Compound and odd meters, swing, scale degrees, motives, sentences and periods',
  units: (typeof L6_RHYTHM_UNITS !== 'undefined' ? L6_RHYTHM_UNITS : []).concat(L6_MELODY_UNITS),
  cards: Object.assign({}, typeof L6_RHYTHM_CARDS !== 'undefined' ? L6_RHYTHM_CARDS : {}, L6_MELODY_CARDS),
  passText: 'You can feel and write compound, odd and swung rhythms, hear every scale degree in a key, develop a motive with a composer’s tools, and shape a theme as a sentence or a period.',
  create: {
    task: 'capture', prompts: L6_DAILY.map(d => d.prompt),
    /* a fresh constraint, with its meter and tempo, each time the Daily Set asks */
    get params() { const d = rand(L6_DAILY); return { prompt: d.prompt, meter: d.meter, bpm: d.bpm, swing: d.swing || 0.5, bars: 8, keySig: 0, min: 6, save: { level: 6, tags: ['8 bars a day'], prompt: d.prompt } }; }
  }
});

/* a handle for tests and the browser console */
window.MotifL6 = { l6ShapeMelody, l6Theme, l6CheckTendency, l6CheckClimax, l6CheckDecor, l6Sounding, L6_SHAPES, L6_BI, L6_MOTIVES, L6_SKELETON };
