/* =================================================================
   Level 3 · Stack It
   Triads, chord symbols and shapes, inversions, the chords of a key,
   Roman numerals, seventh chords and arpeggios. Mic chord recognition
   starts here (ChordIn: keys, MIDI or mic).
   New tasks: Tasks.firstChord (3.1), Tasks.buildChords (playChords with a
   “Show me” hint) and Tasks.harmonizePhrase (3.H).
   New review card types: l3roman (play a numeral in a key), l3arp (arpeggiate a chord).
   ================================================================= */

/* ---------- chord helpers ---------- */
const L3_WORD = { maj: 'Major', min: 'Minor', dim: 'Diminished', aug: 'Augmented' };
const L3_Q4 = ['maj', 'min', 'dim', 'aug'];

/* spelled notes of a symbol, no octaves: 'F♯m' → F♯ A C♯ */
function l3Notes(sym) { const c = Theory.parseChord(sym); return Theory.chordNotes(c.root, c.q); }
/* 'C major', 'F♯ diminished', 'C major with E in the bass' */
function l3Name(sym) { const c = Theory.parseChord(sym); return c.root + ' ' + Theory.CHORDS[c.q].name + (c.bass ? ' with ' + c.bass + ' in the bass' : ''); }
/* spelled notes with octaves, root in octave `oct` (default 4); a slash chord puts its bass note lowest */
function l3Voice(sym, oct) {
  const c = Theory.parseChord(sym);
  let ns = Theory.chordNotes(Theory.withOct(c.root, oct == null ? 4 : oct), c.q);
  if (c.bass) {
    const b = Theory.pc(c.bass);
    for (let k = 0; k < ns.length && Theory.pc(ns[0]) !== b; k++) ns = ns.slice(1).concat([Theory.up(ns[0], '8')]);
  }
  return ns;
}
/* the voicing that fits the dock keyboard (C3–C5): octave 4 when it fits, else octave 3 */
function l3DockVoice(sym) { const v = l3Voice(sym, 4); return Theory.midi(v[v.length - 1]) <= KB_HI ? v : l3Voice(sym, 3); }
function l3DockMidis(sym) { return l3DockVoice(sym).map(Theory.midi); }
function l3Mark(sym, cls) { l3DockMidis(sym).forEach(m => Keyboard.mark(m, cls || 'hint')); }
/* Sound.chord needs the audio clock running first, so its start time is on the right clock */
function l3Sound(midis, dur) { if (!Sound.ensure()) return; Sound.chord(midis, null, dur || 1.4); }
function l3PlaySym(sym, dur) { l3Sound(l3DockMidis(sym), dur); }
function l3PlayList(syms, gap, dur) { return playChordList(syms.map((s, k) => ({ sym: s, t: k * (gap || 1.1), d: dur || 1 })), 4); }
/* 1-3-5-8 and 1-5-3-5 */
function l3Arp(sym, oct) { const c = Theory.parseChord(sym), r = Theory.withOct(c.root, oct || 4); return Theory.chordNotes(r, c.q).slice(0, 3).concat([Theory.up(r, '8')]); }
function l3Alberti(sym, oct) { const n = Theory.chordNotes(Theory.withOct(Theory.parseChord(sym).root, oct || 4), Theory.parseChord(sym).q); return [n[0], n[2], n[1], n[2]]; }
const l3SeqNotes = (ns, gap) => ns.map((n, k) => ({ m: Theory.midi(n), t: k * (gap || 0.32), d: (gap || 0.32) * 0.95 }));
/* a chord as Sound.seq notes starting at t (slightly rolled, like Sound.chord) */
const l3ChordSeq = (midis, t, d, v) => midis.map((m, i) => ({ m, t: t + i * 0.015, d: d || 1.2, v: v || 0.55 }));

/* a staff of stacked chords in octave 4, labelled with their symbols */
function l3Staff(syms, o) {
  o = o || {};
  return Staff.svg(Object.assign({
    clef: 'treble', notes: syms.map(s => l3Voice(s, o.oct)), labels: o.labels || syms.map(Theory.pretty),
    aria: 'Treble staff: ' + syms.map(s => Theory.pretty(s) + ' (' + l3Voice(s, o.oct).map(Theory.stripOct).join(' ') + ')').join(', ')
  }, o.staff || {}));
}
function l3Table(head, rows, cls) {
  return `<div class="tbl-wrap"><table class="tbl l3-tbl ${cls || ''}"><thead><tr>${head.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => i === 0 ? `<th scope="row">${c}</th>` : `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const l3Recipe = q => Theory.CHORDS[q].recipe;

/* chords whose spelling a beginner can read: no double accidentals, no E♯ B♯ C♭ F♭ */
const l3Plain = notes => !notes.some(n => /𝄫|𝄪|E♯|B♯|C♭|F♭/u.test(n));
/* a random chord of quality q, voiced around middle C: { q, root, sym, notes, midis } */
function l3RandChord(q, lo, hi) {
  let c = null;
  for (let k = 0; k < 40 && !c; k++) {
    const rm = randInt(lo == null ? 50 : lo, hi == null ? 62 : hi);
    const root = Theory.rootName(mod12(rm), q), notes = Theory.chordNotes(root, q);
    if (l3Plain(notes)) c = { q, root, sym: Theory.symbol(root, q), notes, midis: Theory.CHORDS[q].degrees.map(d => rm + Theory.parseDeg(d).semis) };
  }
  return c || l3ChordOf(q === 'maj' ? 'C' : 'C' + Theory.CHORDS[q].sym);
}
function l3ChordOf(sym) { const c = Theory.parseChord(sym); return { q: c.q, root: c.root, sym, notes: l3Notes(sym), midis: l3DockMidis(sym) }; }
/* n different triads with mixed qualities (two each of major and minor, then one diminished and one augmented, …) */
function l3Mixed(n) {
  const qs = shuffle(['maj', 'min', 'dim', 'aug', 'maj', 'min', 'maj', 'min'].slice(0, Math.max(4, n))).slice(0, n);
  const used = new Set();
  return qs.map(q => { let c = l3RandChord(q); for (let k = 0; k < 20 && used.has(c.sym); k++) c = l3RandChord(q); used.add(c.sym); return c.sym; });
}

/* ---------- quiz items ---------- */
/* hear a chord, name its quality */
function l3EarItem(quals, c) {
  c = c || l3RandChord(rand(quals));
  return {
    q: 'Listen. Which kind of chord is it?', options: quals.map(q => L3_WORD[q]), answer: quals.indexOf(c.q),
    play: () => l3Sound(c.midis), playLabel: 'Hear it again',
    why: ok => `${ok ? 'Yes: ' : 'That was '}${Theory.pretty(c.sym)}, ${Theory.CHORDS[c.q].name}: ${c.notes.join(' ')}, ${l3Recipe(c.q)} half steps.`
  };
}
function l3EarQuiz(quals, order, extra) {
  /* order: a quality ('maj') for a random root, or a symbol ('Cm') for that exact chord */
  return Object.assign({ rounds: order.length, gen: i => l3EarItem(quals, L3_WORD[order[i]] ? l3RandChord(order[i]) : l3ChordOf(order[i])) }, extra || {});
}
/* triad or seventh, then maj7 or 7 */
function l3SeventhItem(i) {
  if (i < 3) {
    const seventh = Math.random() < 0.5, c = l3RandChord(seventh ? rand(['maj7', '7', 'm7']) : rand(['maj', 'min']));
    return { q: 'Three notes or four?', options: ['Triad', 'Seventh chord'], answer: seventh ? 1 : 0, play: () => l3Sound(c.midis), playLabel: 'Hear it again', why: () => `${Theory.pretty(c.sym)}: ${c.notes.join(' ')}. ${seventh ? 'Four notes: a 7th sits on top.' : 'Three notes: root, 3rd and 5th.'}` };
  }
  const q = rand(['maj7', '7']), c = l3RandChord(q);
  return { q: 'Dreamy or bluesy?', options: ['maj7 (dreamy)', '7 (bluesy)'], answer: q === 'maj7' ? 0 : 1, play: () => l3Sound(c.midis), playLabel: 'Hear it again', why: () => `${Theory.pretty(c.sym)}: ${c.notes.join(' ')}, ${l3Recipe(q)}. ${q === 'maj7' ? 'The 7th is a half step under the octave.' : 'The 7th is a whole step under the octave.'}` };
}
/* which position is this chord in? */
function l3InvItem() {
  const base = rand(['C', 'Dm', 'Em', 'F', 'G', 'Am']), inv = randInt(0, 2);
  const bass = l3Notes(base)[inv], sym = inv ? base + '/' + bass : base, v = l3DockVoice(sym);
  return {
    q: 'Which position is this chord in?', html: Staff.svg({ notes: [v], minWidth: 150, aria: 'Treble staff: a chord, ' + v.join(' ') }),
    options: ['Root position', 'First inversion', 'Second inversion'], answer: inv, play: () => l3Sound(v.map(Theory.midi)), playLabel: 'Hear it',
    why: `${bass} is at the bottom: the ${['root', '3rd', '5th'][inv]} of ${Theory.pretty(base)}. As a symbol: ${Theory.pretty(sym)}.`
  };
}
/* which triad sits on degree N of a major key? */
function l3DegreeItem(key, deg) {
  const c = Theory.diatonic(key)[(deg || randInt(1, 7)) - 1], qs = ['maj', 'min', 'dim'];
  return {
    q: `In ${key} major, which triad is built on ${c.root}, degree ${c.deg}?`, options: qs.map(q => Theory.pretty(Theory.symbol(c.root, q))), answer: qs.indexOf(c.q),
    why: `M m m M M m d: degree ${c.deg} is ${Theory.CHORDS[c.q].name}, so it is ${Theory.pretty(c.sym)} (${c.notes.join(' ')}).`
  };
}
/* numeral → chord */
function l3RomanItem(key, roman) {
  const d = Theory.diatonic(key), c = d.find(x => x.roman === roman) || rand(d);
  const opts = shuffle([c].concat(shuffle(d.filter(x => x !== c)).slice(0, 2)));
  const how = c.q === 'maj' ? 'Uppercase, so major' : c.q === 'min' ? 'Lowercase, so minor' : 'Lowercase with °, so diminished';
  return { q: `What is ${c.roman} in ${key} major?`, options: opts.map(x => Theory.pretty(x.sym)), answer: opts.indexOf(c), why: `Count up ${key} major to degree ${c.deg}: ${c.root}. ${how}: ${Theory.pretty(c.sym)}.` };
}
/* chord → numeral */
function l3RomanBackItem(key) {
  const d = Theory.diatonic(key), c = rand(d.slice(0, 6));
  const opts = shuffle([c].concat(shuffle(d.filter(x => x !== c)).slice(0, 2)));
  return { q: `In ${key} major, ${Theory.pretty(c.sym)} is which numeral?`, options: opts.map(x => x.roman), answer: opts.indexOf(c), why: `${c.root} is degree ${c.deg} of ${key} major, and ${Theory.pretty(c.sym)} is ${Theory.CHORDS[c.q].name}: ${c.roman}.` };
}
/* which chord is broken here? */
function l3ArpItem() {
  const pool = ['C', 'F', 'G', 'Am', 'Dm', 'Em'], sym = rand(pool), ns = l3Arp(sym);
  const opts = shuffle([sym].concat(shuffle(pool.filter(x => x !== sym)).slice(0, 2)));
  return {
    q: 'Which chord is this arpeggio?', html: Staff.svg({ notes: ns, filled: true, minWidth: 200, aria: 'Treble staff: ' + ns.join(' ') }),
    options: opts.map(Theory.pretty), answer: opts.indexOf(sym), play: () => Sound.seq(l3SeqNotes(ns)), playLabel: 'Hear it',
    why: `${ns.map(Theory.stripOct).join(' ')}: root, 3rd, 5th and octave of ${Theory.pretty(sym)}.`
  };
}

/* ---------- guitar chord boxes and piano shapes ---------- */
/* frets from low E to high E (x = not played), fingers 1–4 (- = none) */
const L3_GUITAR = [['C', 'x32010', '-32-1-'], ['G', '320003', '21---3'], ['D', 'xx0232', '---132'], ['A', 'x02220', '--123-'],
  ['E', '022100', '-231--'], ['Am', 'x02210', '--231-'], ['Em', '022000', '-23---'], ['Dm', 'xx0231', '---231']].map(([sym, frets, fingers]) => ({ sym, frets, fingers }));
const L3_OPEN = [40, 45, 50, 55, 59, 64];
const L3_STRINGS = ['low E', 'A', 'D', 'G', 'B', 'high E'];
const l3GuitarMidis = g => [...g.frets].map((f, s) => f === 'x' ? null : L3_OPEN[s] + +f).filter(m => m != null);
const l3StrumSeq = (g, t) => l3GuitarMidis(g).map((m, k) => ({ m, t: (t || 0) + k * 0.035, d: 1.6, v: 0.6 }));
function l3Strum(g) { return Sound.seq(l3StrumSeq(g)); }
function l3GuitarBox(g, o) {
  o = o || {};
  const sx = 20, gap = 16, ny = 40, fh = 22, W = 120, frets = 4, H = ny + frets * fh + (o.notes === false ? 8 : 22);
  const notes = l3Notes(g.sym), spell = m => notes.find(n => Theory.pc(n) === mod12(m)) || SHARP[mod12(m)];
  let s = o.title === false ? '' : `<text class="gname" x="${W / 2}" y="17" text-anchor="middle">${Theory.pretty(g.sym)}</text>`;
  for (let k = 1; k <= frets; k++) s += `<line class="fr" x1="${sx}" x2="${sx + 5 * gap}" y1="${ny + k * fh}" y2="${ny + k * fh}"/>`;
  for (let i = 0; i < 6; i++) s += `<line class="str" x1="${sx + i * gap}" x2="${sx + i * gap}" y1="${ny}" y2="${ny + frets * fh}"/>`;
  s += `<line class="nut" x1="${sx - 1}" x2="${sx + 5 * gap + 1}" y1="${ny}" y2="${ny}"/>`;
  [...g.frets].forEach((f, i) => {
    const x = sx + i * gap;
    if (f === 'x') s += `<text class="mk" x="${x}" y="${ny - 7}" text-anchor="middle">×</text>`;
    else if (f === '0') s += `<circle class="open" cx="${x}" cy="${ny - 11}" r="4"/>`;
    else {
      const cy = ny + (+f - 0.5) * fh;
      s += `<circle class="dot" cx="${x}" cy="${cy}" r="7"/>`;
      if (g.fingers[i] !== '-') s += `<text class="fing" x="${x}" y="${cy + 3.6}" text-anchor="middle">${g.fingers[i]}</text>`;
    }
    if (o.notes !== false && f !== 'x') s += `<text class="gnote" x="${x}" y="${ny + frets * fh + 15}" text-anchor="middle">${spell(L3_OPEN[i] + +f)}</text>`;
  });
  const aria = `${l3Name(g.sym)} on guitar: ` + [...g.frets].map((f, i) => `${L3_STRINGS[i]} string ${f === 'x' ? 'not played' : f === '0' ? 'open' : 'fret ' + f + (g.fingers[i] !== '-' ? ', finger ' + g.fingers[i] : '')}`).join('; ');
  return `<svg class="l3-g" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(aria)}">${s}</svg>`;
}
/* a small piano with the chord's keys lit; names: spelled note names in the same order as midis */
function l3Keys(midis, names) {
  const lo = Math.floor(Math.min.apply(null, midis) / 12) * 12, hi = Math.max(lo + 23, Math.ceil((Math.max.apply(null, midis) + 1) / 12) * 12 - 1);
  const ww = 16, wh = 60, bw = 10, bh = 37, whites = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
  const xOf = m => whites.indexOf(m) * ww;
  let s = '', lab = '';
  whites.forEach(m => {
    const on = midis.indexOf(m) >= 0;
    s += `<rect class="w${on ? ' on' : ''}" x="${xOf(m) + 0.5}" y="0.5" width="${ww - 1}" height="${wh}" rx="2"/>`;
    if (on) lab += `<text class="kl" x="${xOf(m) + ww / 2}" y="${wh + 14}" text-anchor="middle">${names ? names[midis.indexOf(m)] : SHARP[mod12(m)]}</text>`;
  });
  for (let m = lo; m <= hi; m++) {
    if (!isBlack(m)) continue;
    const on = midis.indexOf(m) >= 0, x = xOf(m - 1) + ww - bw / 2;
    s += `<rect class="b${on ? ' on' : ''}" x="${x}" y="0.5" width="${bw}" height="${bh}" rx="1.5"/>`;
    if (on) lab += `<text class="kl" x="${x + bw / 2}" y="${wh + 14}" text-anchor="middle">${names ? names[midis.indexOf(m)] : SHARP[mod12(m)]}</text>`;
  }
  const W = whites.length * ww + 1;
  return `<svg class="l3-keys" viewBox="0 0 ${W} ${wh + 20}" width="${W}" height="${wh + 20}" role="img" aria-label="Piano shape: ${esc((names || midis.map(noteName)).join(' '))}">${s}${lab}</svg>`;
}

/* ---------- widgets for reading cards ---------- */
/* Tap-to-hear chord chips. The picked chord shows on the staff (broken, then stacked), on the dock keys and as note names.
   items: symbols or { sym, chip, sub }. o: { staff: false, label, hint } */
function l3Explorer(items, o) {
  o = o || {};
  return el => {
    const list = items.map(it => typeof it === 'string' ? { sym: it } : it);
    el.innerHTML = `<div class="l3-ex"><div class="choices l3-chips" role="group" aria-label="${o.label || 'Chords to try'}">${list.map((it, i) => `<button type="button" class="choice" data-i="${i}" aria-pressed="false">${it.chip || Theory.pretty(it.sym)}${it.sub ? `<small>${it.sub}</small>` : ''}</button>`).join('')}</div>${o.staff === false ? '' : '<div class="art l3-ex-staff"></div>'}<p class="l3-info" aria-live="polite">${o.hint || 'Tap a chord to hear it and see it on the keys.'}</p></div>`;
    const box = el.querySelector('.l3-chips'), staff = el.querySelector('.l3-ex-staff'), info = el.querySelector('.l3-info');
    function pick(i, play) {
      const it = list[i], v = l3DockVoice(it.sym), q = Theory.parseChord(it.sym).q, names = v.map(Theory.stripOct);
      box.querySelectorAll('.choice').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
      Keyboard.clearMarks(); v.forEach(n => Keyboard.mark(Theory.midi(n), 'hint'));
      if (staff) staff.innerHTML = Staff.svg({ notes: v.concat([v]), labels: names.concat([Theory.pretty(it.sym)]), gap: 44, aria: `Treble staff: ${Theory.pretty(it.sym)}, ${v.join(' ')}, one at a time and then together` });
      info.textContent = `${Theory.pretty(it.sym)}: ${l3Name(it.sym)} · ${names.join(' ')} · ${l3Recipe(q)} half steps`;
      if (play) l3Sound(v.map(Theory.midi));
    }
    box.onclick = ev => { const b = ev.target.closest('.choice'); if (b) pick(+b.dataset.i, true); };
    if (staff) pick(0, false);
    return () => { box.onclick = null; };
  };
}
/* the eight open guitar chords: tap one to strum it and see its piano shape */
function l3GuitarWidget(el) {
  el.innerHTML = `<div class="l3-gboxes" role="group" aria-label="Open guitar chords">${L3_GUITAR.map((g, i) => `<button type="button" class="l3-gbox" data-i="${i}" aria-pressed="false" aria-label="${l3Name(g.sym)}: strum it and see the piano shape">${l3GuitarBox(g)}</button>`).join('')}</div><div class="l3-gdetail" aria-live="polite"><p class="l3-info">Tap a chord box to hear it.</p></div>`;
  const grid = el.querySelector('.l3-gboxes'), detail = el.querySelector('.l3-gdetail');
  let cur = null;
  function pick(i) {
    const g = L3_GUITAR[i]; cur = g;
    grid.querySelectorAll('.l3-gbox').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    const v = l3DockVoice(g.sym), ms = v.map(Theory.midi), names = v.map(Theory.stripOct);
    Keyboard.clearMarks(); ms.forEach(m => Keyboard.mark(m, 'hint'));
    detail.innerHTML = `<div class="l3-pshape"><div class="l3-pshape-k">${l3Keys(ms, names)}</div><div class="l3-pshape-t"><p><b>${Theory.pretty(g.sym)}</b>, ${l3Name(g.sym)}: ${l3Notes(g.sym).join(' ')}. On piano it is this shape, also lit on the dock keys. The guitar plays the same notes, some of them twice.</p><div class="row"><button type="button" class="btn small" data-act="strum">▶ Guitar</button><button type="button" class="btn small" data-act="piano">▶ Piano</button></div></div></div>`;
    l3Strum(g);
  }
  grid.onclick = ev => { const b = ev.target.closest('.l3-gbox'); if (b) pick(+b.dataset.i); };
  detail.onclick = ev => {
    const b = ev.target.closest('[data-act]'); if (!b || !cur) return;
    if (b.dataset.act === 'strum') l3Strum(cur); else l3PlaySym(cur.sym);
  };
  return () => { grid.onclick = null; detail.onclick = null; };
}

/* ---------- tasks ---------- */

/* 3.1: play C E G (keys, MIDI, or a real piano or guitar with the mic) and the app names the chord.
   Keeps naming whatever is played afterwards, so the learner can explore. */
Tasks.firstChord = (el, p, done) => {
  const T = chordTarget('C');
  el.innerHTML = `<div class="l3-task"><p class="prompt">${p.prompt || 'Play C, E and G at the same time.'}</p>
    <div class="l3-first"><div class="l3-namer" aria-live="polite"><span class="eyebrow">The app hears</span><div class="big-name idle">?</div><div class="l3-namer-sub">Waiting for three notes</div></div><figure class="l3-fig">${l3GuitarBox(L3_GUITAR[0])}<figcaption>Open C on guitar</figcaption></figure></div>
    <div class="l3-meter"></div>
    <p class="l3-how"><b>How the mic hears a chord:</b> it splits the sound into all 12 note names at once, the bars above, and matches the tallest bars to chord shapes. Tapped keys skip that step: the app reads your notes directly.</p>
    <div class="row" data-mic hidden><button type="button" class="btn small" data-act="mic">Turn on the mic</button></div>
    <p class="fb info" aria-live="polite"></p></div>`;
  const namer = el.querySelector('.l3-namer'), big = namer.querySelector('.big-name'), sub = namer.querySelector('.l3-namer-sub');
  const f = el.querySelector('.fb'), micRow = el.querySelector('[data-mic]');
  const offMeter = chromaMeter(el.querySelector('.l3-meter'));
  const bars = [...el.querySelectorAll('.l3-meter .chroma i')];
  let got = false, barTimer = 0;
  ChordIn.start();
  l3Mark('C', 'hint');
  function paintMic() {
    micRow.hidden = Mic.state !== 'off';
    if (got) return;
    fb(f, 'info', Mic.state === 'on'
      ? 'The mic is listening. Play C, E and G on a piano, or strum open C on a guitar, and let it ring.'
      : Mic.state === 'off'
        ? 'Tap C, E and G on the keys within a second (A, D and G on a computer keyboard). Have a piano or guitar nearby? Turn on the mic and play it.'
        : 'Tap C, E and G on the keys within a second (A, D and G on a computer keyboard), or use a MIDI keyboard.');
  }
  el.querySelector('[data-act="mic"]').onclick = async () => { if (!(await Mic.start())) toast(micProblem()); };
  const offMic = Bus.on('mic', paintMic);
  /* tapped chords light the same 12 bars the mic uses */
  function light(pcs) {
    if (Mic.state === 'on') return;
    bars.forEach((b, k) => { b.style.transform = `scaleY(${pcs.indexOf(k) >= 0 ? 1 : 0.02})`; });
    clearTimeout(barTimer); barTimer = setTimeout(() => bars.forEach(b => { b.style.transform = 'scaleY(0.02)'; }), 1800);
  }
  const off = Bus.on('chord', ev => {
    if (ev.source !== 'mic') light(ev.pcs);
    if (ev.q) { big.textContent = Theory.pretty(ev.sym); sub.textContent = `${l3Name(ev.sym)}: ${l3Notes(ev.sym).join(' ')}`; }
    else { big.textContent = '?'; sub.textContent = `${ev.pcs.map(pc => Theory.pcName(pc)).join(' ')}: not a chord shape yet. Try skipping a key between notes.`; }
    namer.classList.toggle('hit', !!ev.q); big.classList.remove('idle');
    if (!got && chordHit(ev, T)) {
      got = true; Keyboard.clearMarks();
      fb(f, 'good', `C major: C, E and G${ev.source === 'mic' ? ', heard through the mic' : ''}. That is your first chord. Now move one note up or down a key and watch the name change.`);
      done(true);
    } else if (got && ev.q) fb(f, 'good', `${Theory.pretty(ev.sym)}: ${l3Name(ev.sym)}. Keep exploring, or press Next.`);
  });
  paintMic();
  return () => { off(); offMic(); offMeter(); ChordIn.stop(); clearTimeout(barTimer); Keyboard.clearMarks(); };
};

/* Tasks.playChords with a “Show me the notes” button: it reveals the current chord’s notes and lights them on the keys. Same params. */
Tasks.buildChords = (el, p, done) => {
  el.innerHTML = '<div class="l3-pc"></div><div class="row l3-showrow"><button type="button" class="btn small ghost" data-act="show">Show me the notes</button></div>';
  const host = el.querySelector('.l3-pc');
  const stop = Tasks.playChords(host, p, done);
  el.querySelector('[data-act="show"]').onclick = () => {
    const i = host.querySelectorAll('.progress-dots .on, .progress-dots .miss').length;
    if (i >= p.chords.length) return;
    const sym = p.chords[i], tones = host.querySelector('.tones');
    if (tones) tones.textContent = (p.labels ? Theory.pretty(sym) + ': ' : '') + l3DockVoice(sym).map(Theory.stripOct).join(' · ');
    Keyboard.clearMarks(); l3Mark(sym, 'hint');
  };
  return stop;
};

/* 3.H: pick a sketch, split it into bars, choose I, IV or V for each bar, hear it, save it. */
const L3_EXAMPLE = (function () {
  const tune = [['C4', 1], ['C4', 1], ['G4', 1], ['G4', 1], ['A4', 1], ['A4', 1], ['G4', 2], ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 1], ['D4', 1], ['C4', 2]];
  const spb = 0.6; let b = 0;
  const notes = tune.map(([n, d]) => { const o = { m: Theory.midi(n), t: Math.round(b * spb * 1000) / 1000, d: d * spb * 0.92 }; b += d; return o; });
  return { name: 'Example: Twinkle, Twinkle', notes, key: 'C', bpm: 100, example: true };
})();
/* the key a sketch is in: its saved key, or the major key whose scale holds most of its notes */
function l3KeyOf(s) {
  const m = s.key ? /^\s*([A-Ga-g](?:#|♯|b|♭)?)\s*(.*)$/u.exec(String(s.key)) : null;
  if (m) {
    const tonic = Theory.pretty(m[1][0].toUpperCase() + m[1].slice(1)), rest = m[2].trim().toLowerCase();
    return { tonic, minor: rest === 'm' || rest.indexOf('min') === 0 || s.mode === 'minor', guessed: false };
  }
  const notes = s.notes || [];
  let best = null;
  ['C', 'G', 'F', 'D', 'B♭', 'A', 'E♭', 'E', 'A♭', 'B', 'D♭', 'F♯'].forEach(k => {
    const sc = Theory.scale(k).map(Theory.pc);
    let fit = notes.reduce((a, n) => a + (sc.indexOf(mod12(n.m)) >= 0 ? 1 : 0), 0);
    if (notes.length && mod12(notes[notes.length - 1].m) === Theory.pc(k)) fit += 0.5;
    if (!best || fit > best.fit) best = { k, fit };
  });
  return { tonic: best.k, minor: false, guessed: true };
}
/* seconds per bar from a sketch's bpm and time signature (4/4 unless it says otherwise), or null */
const l3BarLen = s => s.bpm ? ((s.beats || (s.time && s.time[0]) || 4) * 60 / s.bpm) : null;
/* split a melody into n bars: by the beat when its bpm gives n bars, else into n even groups of notes.
   Each bar's main note is its longest (the first one when they tie). */
function l3Bars(notes, n, barLen) {
  const ns = notes.slice().sort((a, b) => a.t - b.t).map((x, i, a) => ({ m: x.m, t: x.t, d: x.d, len: a[i + 1] ? Math.max(0.05, a[i + 1].t - x.t) : (x.d || 0.5) }));
  const last = ns[ns.length - 1], end = last.t + (last.d || last.len);
  let groups = null;
  if (barLen) {
    const bar = barLen;
    if (Math.ceil(end / bar - 1e-6) === n) {
      groups = [];
      for (let k = 0; k < n; k++) groups.push({ t0: k * bar, t1: (k + 1) * bar, notes: ns.filter(x => Math.min(n - 1, Math.floor(x.t / bar + 1e-6)) === k) });
    }
  }
  if (!groups) {
    const size = ns.length / n;
    groups = [];
    for (let k = 0; k < n; k++) groups.push({ notes: ns.slice(Math.round(k * size), Math.round((k + 1) * size)) });
    groups.forEach((g, k) => { g.t0 = k === 0 ? Math.min(0, g.notes[0].t) : g.notes[0].t; });
    groups.forEach((g, k) => { g.t1 = k < n - 1 ? groups[k + 1].t0 : end; });
  }
  groups.forEach(g => { g.main = g.notes.reduce((b, x) => (!b || x.len > b.len + 1e-6 ? x : b), null); });
  return groups;
}
function l3DefaultBars(s) {
  const ns = s.notes, last = ns[ns.length - 1];
  if (s.bpm) { const c = Math.ceil((last.t + (last.d || 0.5)) / l3BarLen(s) - 1e-6); if (c >= 2 && c <= 4 && c <= ns.length) return c; }
  return Math.max(2, Math.min(4, ns.length, Math.round(ns.length / 3)));
}
Tasks.harmonizePhrase = (el, p, done) => {
  const own = (Store.data.sketches || []).filter(s => s.notes && s.notes.length >= 2);
  const options = own.filter(s => s.level === 2).concat(own.filter(s => s.level !== 2)).concat([L3_EXAMPLE]);
  let sk = null, key = null, chords = [], bars = [], pickd = [], saved = false, scale = [], flats = false;
  /* note names spelled for the key: B♭ in F major, F♯ in G major */
  const spell = m => scale.find(n => Theory.pc(n) === mod12(m)) || Theory.pcName(mod12(m), flats);
  el.innerHTML = `<div class="l3-task"><p class="prompt">${p.prompt || 'Choose I, IV or V for each bar of your phrase.'}</p>
    <div class="field l3-field"><label for="l3-sk">Phrase</label><select id="l3-sk">${options.map((s, i) => `<option value="${i}">${esc(s.name || 'Sketch ' + (i + 1))}${s.example ? '' : s.level ? ' · Level ' + s.level : ''}</option>`).join('')}</select></div>
    <div class="row l3-nbars" role="group" aria-label="Number of bars"><span class="eyebrow">Bars</span>${[2, 3, 4].map(n => `<button type="button" class="choice" data-n="${n}" aria-pressed="false">${n}</button>`).join('')}</div>
    <p class="l3-key"></p><div class="l3-bars"></div>
    <div class="row"><button type="button" class="btn" data-act="play">▶ Play with chords</button><button type="button" class="btn ghost" data-act="melody">▶ Melody only</button><button type="button" class="btn ghost" data-act="suggest">Use the suggestions</button></div>
    <div class="field"><label for="l3-hname">Name it</label><input id="l3-hname" type="text" maxlength="40"></div>
    <div class="row"><button type="button" class="btn primary" data-act="save" disabled>Save to sketchbook</button></div>
    <p class="fb info" aria-live="polite"></p></div>`;
  const sel = el.querySelector('#l3-sk'), nb = el.querySelector('.l3-nbars'), keyEl = el.querySelector('.l3-key'), barsEl = el.querySelector('.l3-bars');
  const name = el.querySelector('#l3-hname'), save = el.querySelector('[data-act="save"]'), f = el.querySelector('.fb');
  const fits = (c, g) => g.main && c.pcs.indexOf(mod12(g.main.m)) >= 0;
  const chordList = () => bars.map((g, k) => pickd[k] == null ? null : { sym: chords[pickd[k]].sym, t: Math.round(g.t0 * 1000) / 1000, d: Math.max(0.4, Math.round((g.t1 - g.t0) * 1000) / 1000) }).filter(Boolean);
  function paintBars() {
    barsEl.innerHTML = bars.map((g, k) => `<div class="l3-bar" data-b="${k}"><div class="l3-bar-head"><span class="eyebrow">Bar ${k + 1}</span><span class="l3-bar-notes">${g.notes.length ? g.notes.map(x => x === g.main ? `<b title="main note">${spell(x.m)}</b>` : spell(x.m)).join(' · ') : 'rest'}</span></div><div class="l3-opts" role="group" aria-label="Chord for bar ${k + 1}">${chords.map((c, j) => `<button type="button" class="l3-opt${fits(c, g) ? ' fits' : ''}" data-j="${j}" aria-pressed="${pickd[k] === j}" aria-label="${c.roman}, ${l3Name(c.sym)}${fits(c, g) ? ', contains the main note ' + spell(g.main.m) : ''}"><b>${c.roman}</b><span>${Theory.pretty(c.sym)}</span><small>${fits(c, g) ? 'fits' : ''}</small></button>`).join('')}</div></div>`).join('');
    save.disabled = saved || pickd.some(x => x == null) || pickd.length !== bars.length;
  }
  function setBars(n) {
    bars = l3Bars(sk.notes, n, l3BarLen(sk)); pickd = bars.map(() => null);
    nb.querySelectorAll('[data-n]').forEach(b => { b.setAttribute('aria-pressed', String(+b.dataset.n === n)); b.disabled = +b.dataset.n > sk.notes.length; });
    paintBars();
  }
  function setSketch(i) {
    sk = options[i]; key = l3KeyOf(sk); saved = false;
    scale = Theory.scale(key.tonic, key.minor ? 'harmonic' : 'major'); flats = Theory.keySig(key.tonic, key.minor ? 'minor' : 'major').n < 0;
    chords = (key.minor ? ['i', 'iv', 'V'] : ['I', 'IV', 'V']).map(r => { const c = Theory.romanChord(r, key.tonic, key.minor ? 'minor' : 'major'); c.pcs = c.notes.map(Theory.pc); return c; });
    keyEl.innerHTML = `Key: <b>${key.tonic} ${key.minor ? 'minor' : 'major'}</b>${key.guessed ? ' (the best fit for your notes)' : ''}. ${chords.map(c => `${c.roman} = ${Theory.pretty(c.sym)}`).join(', ')}. The main note of each bar is in bold; chords that contain it say “fits”.`;
    name.value = (sk.example ? 'Twinkle' : sk.name || 'Phrase') + ' with chords';
    setBars(l3DefaultBars(sk));
    fb(f, 'info', 'Tap a chord under each bar to hear that bar with it.');
  }
  const playBar = k => { const g = bars[k], c = chords[pickd[k]]; playSketch({ notes: g.notes.map(x => ({ m: x.m, t: x.t - g.t0, d: x.d })), chords: [{ sym: c.sym, t: 0, d: Math.max(0.6, g.t1 - g.t0) }] }); };
  sel.onchange = () => setSketch(+sel.value);
  nb.onclick = ev => { const b = ev.target.closest('[data-n]'); if (b && !b.disabled) { saved = false; setBars(+b.dataset.n); } };
  barsEl.onclick = ev => {
    const b = ev.target.closest('.l3-opt'); if (!b) return;
    const k = +b.closest('.l3-bar').dataset.b; pickd[k] = +b.dataset.j; saved = false;
    paintBars(); playBar(k);
  };
  el.querySelector('[data-act="suggest"]').onclick = () => {
    pickd = bars.map((g, k) => {
      const pref = k === 0 ? [0, 1, 2] : k === bars.length - 1 ? [0, 2, 1] : [1, 2, 0];
      const j = pref.find(x => fits(chords[x], g));
      return j == null ? (k === 0 || k === bars.length - 1 ? 0 : 2) : j;
    });
    saved = false; paintBars(); fb(f, 'info', 'Suggestions filled in. Change any bar you like, then play it.');
  };
  el.querySelector('[data-act="play"]').onclick = () => playSketch({ notes: sk.notes, chords: chordList() });
  el.querySelector('[data-act="melody"]').onclick = () => playSketch({ notes: sk.notes });
  save.onclick = () => {
    const cs = chordList();
    if (cs.length !== bars.length) return;
    const s = saveSketch(Object.assign({ name: name.value.trim() || 'Harmonized phrase', notes: sk.notes.map(x => ({ m: x.m, t: x.t, d: x.d })), prompt: 'Harmonized with ' + chords.map(c => c.roman).join(', '), level: 3, chords: cs, key: key.tonic + (key.minor ? 'm' : '') }, sk.bpm ? { bpm: sk.bpm } : {}, sk.time ? { time: sk.time } : {}, sk.id ? { from: sk.id } : {}));
    saved = true; save.disabled = true;
    fb(f, 'good', `Saved “${s.name}” to your sketchbook: ${pickd.map(j => chords[j].roman).join(' · ')}.`);
    done(true);
  };
  setSketch(0);
  return () => { sel.onchange = null; nb.onclick = null; barsEl.onclick = null; };
};

/* ---------- review card types ---------- */
/* { type: 'l3roman', keys, romans }: play a Roman numeral in a key */
CARD_TYPES.l3roman = (el, c, fin) => {
  const key = rand(c.keys || ['G', 'F']), r = rand(c.romans || ['I', 'ii', 'IV', 'V', 'vi']);
  return Tasks.playChords(el, { prompt: `Play the ${r} chord in ${key} major.`, chords: [Theory.romanChord(r, key).sym], labels: [r + ' in ' + key] }, (ok, res) => fin(res.misses <= 1));
};
/* { type: 'l3arp', chords }: arpeggiate a chord 1-3-5-8 from memory; one slip allowed */
CARD_TYPES.l3arp = (el, c, fin) => {
  const sym = rand(c.chords);
  return Tasks.playSeq(el, { prompt: `Arpeggiate ${Theory.pretty(sym)}: 1-3-5-8, one note at a time.`, notes: l3Arp(sym), show: 'hidden' }, (ok, r) => fin(r.misses <= 1));
};

/* ---------- units ---------- */
const L3_DIA_C = Theory.diatonic('C');
const L3_FIT_C = (function () {
  const ch = ['I', 'IV', 'V'].map(r => Theory.romanChord(r, 'C'));
  return Theory.scale('C').map(n => `${n} is in ${ch.filter(c => c.notes.indexOf(n) >= 0).map(c => c.roman + ' (' + c.sym + ')').join(' and ')}`).join('; ') + '.';
})();
const L3_SEVENTHS = ['maj7', '7', 'm7'];

const L3_UNITS = [
  { id: '3.1', title: 'What a chord is', blurb: 'Three notes at once, and the app names them.', steps: [
    { k: 'card', tag: 'Hear', title: 'One, two, three, together', play: () => Sound.seq(l3SeqNotes(['C4', 'E4', 'G4'], 0.45).concat(l3ChordSeq(l3DockMidis('C'), 1.5, 1.6))), playLabel: 'C, E, G, then all three',
      art: Staff.svg({ notes: ['C4', 'E4', 'G4', ['C4', 'E4', 'G4']], labels: ['C', 'E', 'G', 'C E G'], aria: 'Treble staff: C, E and G one at a time, then stacked together' }),
      body: '<p>Press play: three notes one after another, then all three at once.</p><p>Notes sounding together make a <b>chord</b>. Listen to how the three blend into one sound.</p>' },
    { k: 'task', tag: 'Echo', type: 'firstChord', p: {} },
    { k: 'task', tag: 'Explore', type: 'buildChords', p: { prompt: 'Start on the named white key, then skip a key, play a key, skip a key, play a key. White keys only.', chords: ['F', 'G', 'Dm', 'Am'], labels: ['on F', 'on G', 'on D', 'on A'] } },
    { k: 'card', tag: 'Name', title: 'Skip a key, skip a key', marks: [0, 4, 7],
      art: Staff.svg({ notes: ['C4', 'E4', 'G4', ['C4', 'E4', 'G4']], labels: ['root', '3rd', '5th', 'C'], gap: 56, aria: 'Treble staff: root C, 3rd E, 5th G, then the C triad stacked' }),
      body: '<p>A <b>triad</b> is three notes stacked in 3rds. On white keys: play a key, skip a key, play a key, skip a key, play a key. In letters: C (D) E (F) G.</p><p>The bottom note is the <b>root</b> and gives the chord its name. The others are the <b>3rd</b> and the <b>5th</b>, counted up from the root. On the staff a stacked triad looks like a snowman: three lines or three spaces in a row.</p><p class="hook"><b>Skip a key, skip a key.</b> It works from any white key, and the app tells you which chord you built.</p>' }
  ] },
  { id: '3.2', title: 'Major and minor triads', blurb: 'Bright and dark: move the middle.', steps: [
    { k: 'card', tag: 'Hear', title: 'Bright, then dark', play: () => l3PlayList(['C', 'Cm'], 1.5, 1.3), playLabel: 'Play two chords',
      art: l3Staff(['C', 'Cm'], { staff: { minWidth: 200 } }),
      body: '<p>Two chords. Same bottom note, same top note. Listen: the first sounds bright and settled, the second darker.</p><p>Only the middle note changed. E moved down a half step to E♭.</p>' },
    { k: 'task', tag: 'Echo', type: 'buildChords', p: { prompt: 'Play C, then move the middle note down a half step to make C minor.', chords: ['C', 'Cm'], tones: true } },
    { k: 'task', tag: 'Explore', type: 'quiz', p: () => { const o = shuffle(['C', 'Cm']).concat(shuffle(['maj', 'min', Math.random() < 0.5 ? 'maj' : 'min'])); return l3EarQuiz(['maj', 'min'], o, { prompt: 'Bright or dark? The first two are C and C minor, in some order.' }); } },
    { k: 'card', tag: 'Name', title: 'Big then small', mount: l3Explorer(['C', 'Cm', 'D', 'Dm', 'E', 'Em', 'A', 'Am']),
      body: '<p>Count half steps up from the root. A <b>major</b> triad is <b>4 + 3</b>: a big 3rd, then a small one. A <b>minor</b> triad is <b>3 + 4</b>: small, then big.</p><p>A letter on its own means major (D). A small m means minor (Dm).</p><p class="hook"><b>Move the middle.</b> To turn any major triad minor, move the middle note down a half step. The root and the 5th stay put.</p>' },
    { k: 'task', tag: 'Explore', type: 'buildChords', p: { prompt: 'Build each one from its recipe: 4 + 3 for major, 3 + 4 for minor.', chords: ['D', 'Dm', 'A', 'Am', 'E', 'Em'] } },
    { k: 'task', tag: 'Explore', type: 'buildChords', p: { prompt: 'Same recipes, now with black keys. The letters still skip: F A C, B♭ D F.', chords: ['F', 'Fm', 'B♭', 'F♯m'] } }
  ] },
  { id: '3.3', title: 'Diminished and augmented', blurb: 'Squeeze it, stretch it: two tense triads.', steps: [
    { k: 'card', tag: 'Hear', title: 'Four chords on C', play: () => l3PlayList(['C', 'Cm', 'C°', 'C+'], 1.4, 1.2), playLabel: 'Play four chords',
      art: l3Staff(['C', 'Cm', 'C°', 'C+'], { staff: { gap: 56 } }),
      body: '<p>Four chords, all built on C. You know the first two. Listen to the last two: one sounds squeezed and uneasy, the other stretched, as if it is waiting for something.</p>' },
    { k: 'card', tag: 'Name', title: 'Squeeze both, stretch both', mount: l3Explorer(['C', 'Cm', 'C°', 'C+', 'G', 'Gm', 'G°', 'G+']),
      body: '<p>A <b>diminished</b> triad is <b>3 + 3</b>: both 3rds small, squeezed together. It is a minor triad with the 5th lowered too. Its symbol is <b>°</b>: C° (sometimes Cdim).</p><p>An <b>augmented</b> triad is <b>4 + 4</b>: both 3rds big, stretched apart. It is a major triad with the 5th raised. Its symbol is <b>+</b>: C+ (sometimes Caug).</p>' +
        l3Table(['Quality', 'Recipe', 'On C', 'Symbol'], L3_Q4.map(q => [Theory.CHORDS[q].name, l3Recipe(q), Theory.chordNotes('C', q).join(' '), Theory.symbol('C', q)]), 'l3-tight') +
        '<p class="hook"><b>Squeeze both, stretch both.</b> Diminished squeezes both 3rds to 3 half steps; augmented stretches both to 4.</p>' },
    { k: 'task', tag: 'Echo', type: 'buildChords', p: { prompt: 'Squeeze or stretch: build each one.', chords: ['C°', 'C+', 'B°', 'F+'] } },
    { k: 'task', tag: 'Explore', type: 'quiz', p: () => l3EarQuiz(L3_Q4, shuffle(['maj', 'min', 'dim', 'aug', 'dim', 'aug']), { prompt: 'Bright, dark, squeezed or stretched? Name each chord.' }) }
  ] },
  { id: '3.4', title: 'Chord symbols and shapes', blurb: 'Read a symbol, play the shape on piano or guitar.', steps: [
    { k: 'card', tag: 'Hear', title: 'One symbol, two instruments', play: () => Sound.seq(l3ChordSeq(l3DockMidis('C'), 0, 1.3).concat(l3StrumSeq(L3_GUITAR[0], 1.7))), playLabel: 'C on piano, then on guitar',
      body: '<p>Press play: C major on a piano, then the same chord strummed on a guitar. Different instruments, different shapes, one name: <b>C</b>.</p><p>A <b>chord symbol</b> is how songbooks, lead sheets and guitar charts tell everyone what to play.</p>' },
    { k: 'card', tag: 'Name', title: 'Root + recipe', mount: l3Explorer(['C', 'Cm', 'C°', 'C+', 'F♯m', 'B♭', 'E°', 'A♭+'], { label: 'Symbols to read' }),
      body: '<p>The letter, with any ♯ or ♭, is the <b>root</b>. Whatever follows is the recipe.</p>' +
        l3Table(['Symbol', 'Means', 'Recipe', 'Notes'], L3_Q4.map(q => [Theory.symbol('C', q), 'C ' + Theory.CHORDS[q].name, l3Recipe(q), Theory.chordNotes('C', q).join(' ')]), 'l3-tight') +
        '<p class="hook"><b>The symbol tells root + recipe.</b> F♯m is F♯ with the minor recipe; A♭+ is A♭ with the augmented one.</p>' },
    { k: 'task', tag: 'Echo', type: 'buildChords', p: { prompt: 'Read each symbol and play it.', chords: ['C', 'Cm', 'C°', 'C+'] } },
    { k: 'card', tag: 'Explore', title: 'Guitar boxes and piano shapes', mount: l3GuitarWidget,
      body: '<p>A <b>chord box</b> is a picture of the guitar neck. The six lines are the strings, low E on the left to high E on the right. The thick bar is the nut. Dots show where fingers press, and the number says which finger. <b>o</b> means play the string open, <b>×</b> means don’t play it.</p><p>Tap a box to hear it and see the same chord as a piano shape.</p>' },
    { k: 'task', tag: 'Explore', type: 'buildChords', p: () => ({ prompt: 'Six chords from their symbols. Use the keys, a piano or a guitar.', chords: l3Mixed(6), passMsg: 'Six symbols read and played.' }) }
  ] },
  { id: '3.5', title: 'Inversions', blurb: 'Same chord, different bottom.', steps: [
    { k: 'card', tag: 'Hear', title: 'C, three ways', play: () => l3PlayList(['C', 'C/E', 'C/G'], 1.3, 1.1), playLabel: 'Play C three ways',
      art: l3Staff(['C', 'C/E', 'C/G'], { staff: { gap: 56 } }),
      body: '<p>Three chords made only of C, E and G, each with a different note at the bottom. All three still sound like C, with a slightly different weight.</p>' },
    { k: 'card', tag: 'Name', title: 'Same chord, different bottom',
      art: l3Staff(['C', 'C/E', 'C/G'], { labels: ['root', '1st inv.', '2nd inv.'], staff: { gap: 60 } }),
      body: '<p><b>Root position</b>: the root is the lowest note (C E G). <b>First inversion</b>: the 3rd is lowest (E G C). <b>Second inversion</b>: the 5th is lowest (G C E).</p><p>A <b>slash chord</b> names the bass note after a slash: <b>C/E</b> is a C chord with E at the bottom, <b>C/G</b> has G at the bottom. The app listens for the lowest note too, so it can tell C/E from C.</p><p class="hook"><b>Same chord, different bottom.</b> Lift the lowest note up an octave and you get the next inversion.</p>' },
    { k: 'task', tag: 'Echo', type: 'buildChords', p: { prompt: 'Play C three ways. Put E at the bottom for C/E and G for C/G. On a computer keyboard, Z moves down an octave and X moves back up.', chords: ['C', 'C/E', 'C/G'], tones: true } },
    { k: 'task', tag: 'Explore', type: 'buildChords', p: { prompt: 'Other chords, other bottoms. The note after the slash goes lowest.', chords: ['G/B', 'F/A', 'Am/C', 'G/D'] } },
    { k: 'task', tag: 'Explore', type: 'quiz', p: { rounds: 4, prompt: 'Look at the lowest note: root, 3rd or 5th?', gen: () => l3InvItem() } }
  ] },
  { id: '3.6', title: 'The chords of a key', blurb: 'Seven chords from one scale: M m m M M m d.', steps: [
    { k: 'card', tag: 'Hear', title: 'A chord on every step', play: () => l3PlayList(L3_DIA_C.map(c => c.sym).concat(['C']), 0.9, 0.85), playLabel: 'Play seven chords',
      art: Staff.svg({ notes: L3_DIA_C.map(c => l3Voice(c.sym)), gap: 44, aria: 'Treble staff: a triad on every note of C major, white keys only' }),
      body: '<p>Press play: a triad on every note of the C major scale, white keys only. Same snowman shape each time, but listen. Some sound bright, some dark, and one sounds tense.</p>' },
    { k: 'task', tag: 'Echo', type: 'buildChords', p: { prompt: 'White keys only: build a triad on each note of C major. Skip a key, skip a key. The app tells you what you made.', chords: L3_DIA_C.map(c => c.sym), labels: L3_DIA_C.map(c => 'on ' + c.root) } },
    { k: 'card', tag: 'Name', title: 'M m m M M m d', mount: l3Explorer(L3_DIA_C.map(c => ({ sym: c.sym, sub: String(c.deg) })), { staff: false, label: 'The chords of C major' }),
      art: l3Staff(L3_DIA_C.map(c => c.sym), { staff: { gap: 44 } }),
      body: '<p>Major, minor, minor, Major, Major, minor, diminished. Say it a few times: <b>M m m M M m d</b>.</p><p>The <b>Big Three</b> major chords sit on 1, 4 and 5: C, F and G. The minors sit on 2, 3 and 6. The odd one, diminished, is on 7. Every major key has the same pattern, because every major scale has the same recipe.</p><p class="hook"><b>M m m M M m d.</b> Majors on 1-4-5, minors on 2-3-6, the odd one on 7.</p>' },
    { k: 'task', tag: 'Explore', type: 'quiz', p: () => { const o = shuffle([1, 2, 3, 4, 5, 6, 7]); return { rounds: 5, prompt: 'Use the pattern: M m m M M m d.', gen: i => l3DegreeItem('C', o[i]) }; } },
    { k: 'task', tag: 'Explore', type: 'buildChords', p: { prompt: 'The Big Three of C: play the chords on 1, 4 and 5, then home to 1.', chords: ['C', 'F', 'G', 'C'], labels: ['1', '4', '5', '1'], passMsg: 'Those three chords carry thousands of songs.' } }
  ] },
  { id: '3.7', title: 'Roman numerals', blurb: 'Numbers that travel to every key.', steps: [
    { k: 'card', tag: 'Hear', title: 'Same pattern, new key', play: () => l3PlayList(Theory.progression(['I', 'IV', 'V', 'I'], 'C').map(c => c.sym).concat(Theory.progression(['I', 'IV', 'V', 'I'], 'G').map(c => c.sym)), 1, 0.95), playLabel: 'Four chords in C, then in G',
      body: '<p>Press play: four chords in C, then the same four in G. The notes are different, but the pattern is the same.</p>' },
    { k: 'card', tag: 'Name', title: L3_DIA_C.map(c => c.roman).join(' '),
      mount: l3Explorer(Theory.diatonic('G').map(c => ({ sym: c.sym, chip: c.roman, sub: Theory.pretty(c.sym) })), { staff: false, label: 'The numerals in G major', hint: 'Tap a numeral to hear it in G.' }),
      body: '<p>Musicians number the chords of a key with <b>Roman numerals</b>: I for the chord on 1, ii on 2, and so on up to vii°. <b>Uppercase</b> means major, <b>lowercase</b> means minor, and ° means diminished.</p>' +
        l3Table(['Key'].concat(L3_DIA_C.map(c => c.roman)), ['C', 'G', 'F'].map(k => [k + ' major'].concat(Theory.diatonic(k).map(c => Theory.pretty(c.sym)))), 'l3-rn') +
        '<p class="hook"><b>Numbers travel to every key.</b> V is always the major chord on 5: G in C, D in G, C in F.</p>' },
    { k: 'task', tag: 'Echo', type: 'buildChords', p: () => { const r = ['I', 'IV', 'V', 'vi']; return { prompt: 'In C: play each numeral as a chord.', chords: r.map(x => Theory.romanChord(x, 'C').sym), labels: r.map(x => x + ' in C') }; } },
    { k: 'task', tag: 'Explore', type: 'buildChords', p: () => {
      const pairs = shuffle(['I', 'ii', 'IV', 'V', 'vi'].map(r => [r, 'G']).concat(['I', 'IV', 'V', 'vi'].map(r => [r, 'F']))).slice(0, 6);
      return { prompt: 'Now in G and F. Count up the scale to the number, then use the numeral’s case: uppercase major, lowercase minor.', chords: pairs.map(([r, k]) => Theory.romanChord(r, k).sym), labels: pairs.map(([r, k]) => r + ' in ' + k) };
    } },
    { k: 'task', tag: 'Explore', type: 'quiz', p: () => { const ks = shuffle(['C', 'G', 'F', 'G', 'F']); return { rounds: 5, gen: i => l3RomanItem(ks[i], rand(['I', 'ii', 'iii', 'IV', 'V', 'vi'])) }; } }
  ] },
  { id: '3.8', title: 'Seventh chords', blurb: 'Add one more 3rd: dreamy, bluesy, mellow.', steps: [
    { k: 'card', tag: 'Hear', title: 'One more 3rd', play: () => l3PlayList(['C', 'Cmaj7', 'C7', 'Cm7'], 1.5, 1.35), playLabel: 'Play four chords',
      body: '<p>A C triad, then three chords with a fourth note stacked on top. Listen for the mood of each: dreamy, then bluesy and restless, then soft and mellow.</p>' },
    { k: 'card', tag: 'Name', title: 'Three 7th recipes',
      art: l3Staff(['Cmaj7', 'C7', 'Cm7', 'G7'], { staff: { gap: 60 } }),
      body: '<p>Stack one more 3rd on a triad and you get a <b>seventh chord</b>: root, 3rd, 5th and 7th.</p>' +
        l3Table(['Chord', 'Recipe', 'Notes', 'Sounds'], L3_SEVENTHS.map((q, i) => [`${Theory.symbol('C', q)}<small>${Theory.CHORDS[q].name}</small>`, l3Recipe(q), Theory.chordNotes('C', q).join(' '), ['dreamy', 'bluesy, restless', 'mellow'][i]]), 'l3-tight') +
        `<p>In a key, the chord on 5 with a 7th added is <b>V7</b>, the <b>dominant 7th</b>: ${Theory.romanChord('V7', 'C').sym} in C (${Theory.romanChord('V7', 'C').notes.join(' ')}). It leans hard toward home.</p><p class="hook"><b>maj7 = 4+3+4, 7 = 4+3+3, m7 = 3+4+3.</b> The last number decides the 7th.</p>` },
    { k: 'task', tag: 'Echo', type: 'buildChords', p: { prompt: 'Play all four notes. The name changes when you add the 7th.', chords: ['Cmaj7', 'C7', 'Cm7'], tones: true } },
    { k: 'task', tag: 'Explore', type: 'buildChords', p: () => { const ks = ['C', 'G', 'F']; return { prompt: 'Find V7 in each key: the chord on 5, with the 4 + 3 + 3 recipe.', chords: ks.map(k => Theory.romanChord('V7', k).sym), labels: ks.map(k => 'V7 in ' + k) }; } },
    { k: 'task', tag: 'Explore', type: 'quiz', p: { rounds: 6, prompt: 'First: three notes or four? Then: dreamy maj7 or bluesy 7?', gen: i => l3SeventhItem(i) } }
  ] },
  { id: '3.9', title: 'Broken chords and arpeggios', blurb: 'One note at a time: 1-3-5-8 and Alberti.', steps: [
    { k: 'card', tag: 'Hear', title: 'One chord, three ways', playLabel: 'Block, arpeggio, Alberti',
      play: () => Sound.seq(l3ChordSeq(l3DockMidis('F'), 0, 1).concat(l3SeqNotes(l3Arp('F'), 0.3).map(n => Object.assign(n, { t: n.t + 1.4 })), l3SeqNotes(l3Alberti('F').concat(l3Alberti('F')), 0.22).map(n => Object.assign(n, { t: n.t + 2.9 })))),
      body: '<p>Press play: F major all at once, then one note at a time going up, then rocking low, high, middle, high.</p><p>Same three notes every time. Spreading a chord out like this is how many piano parts, guitar picking patterns and melodies are made.</p>' },
    { k: 'card', tag: 'Name', title: 'Broken chords',
      art: Staff.svg({ notes: l3Arp('F').concat([null], l3Alberti('F'), l3Alberti('F')), filled: true, gap: 34, labels: ['1', '3', '5', '8', '', '1', '5', '3', '5', '1', '5', '3', '5'], aria: 'Treble staff: F A C F as an arpeggio, then F C A C twice as an Alberti pattern' }),
      body: '<p>A <b>broken chord</b> plays a chord’s notes one after another instead of together. Straight up or down, 1-3-5-8, it is called an <b>arpeggio</b>, from the Italian word for harp.</p><p>The <b>Alberti bass</b> plays 1-5-3-5: low, high, middle, high. Mozart’s left hand is full of it.</p>' },
    { k: 'task', tag: 'Echo', type: 'playSeq', p: () => { const syms = ['F', 'G', 'Am'], ns = [].concat(...syms.map(s => l3Arp(s))); return { prompt: 'Arpeggiate F, G and A minor: 1-3-5-8 each.', notes: ns, mark: true, art: Staff.svg({ notes: ns, filled: true, gap: 30, aria: 'Treble staff: ' + ns.join(' ') }), progress: i => i % 4 ? `${i} of ${ns.length}` : `${Theory.pretty(syms[i / 4 - 1])} done.`, endText: 'Three arpeggios: F, G and A minor.' }; } },
    { k: 'task', tag: 'Explore', type: 'playSeq', p: () => { const syms = ['C', 'F', 'G', 'C'], ns = [].concat(...syms.map(s => l3Alberti(s))); return { prompt: 'Alberti, 1-5-3-5, over C, F, G and back to C.', notes: ns, mark: true, art: Staff.svg({ notes: ns, filled: true, gap: 26, aria: 'Treble staff: ' + ns.join(' ') }), progress: i => i % 4 ? `${i} of ${ns.length}` : `${Theory.pretty(syms[i / 4 - 1])}: low, high, middle, high.`, endText: 'That rocking pattern is the Alberti bass.' }; } },
    { k: 'task', tag: 'Explore', type: 'quiz', p: { rounds: 4, prompt: 'Listen and look: which chord is broken here?', gen: () => l3ArpItem() } }
  ] },
  { id: '3.H', title: 'Harmonize your phrase', blurb: 'Put I, IV and V under a phrase of your own.', create: true, steps: [
    { k: 'card', tag: 'Hear', title: 'A tune with chords underneath', playLabel: 'Melody, then melody with chords',
      play: () => {
        const tune = L3_EXAMPLE.notes, gap = tune[tune.length - 1].t + 2, half = 120 / L3_EXAMPLE.bpm;
        const chords = ['I', 'I', 'IV', 'I', 'IV', 'I', 'V', 'I'].map((r, k) => l3ChordSeq(l3Voice(Theory.romanChord(r, 'C').sym, 3).map(Theory.midi), gap + k * half, half * 0.95, 0.4));
        return Sound.seq(tune.map(n => ({ m: n.m, t: n.t, d: n.d })).concat(tune.map(n => ({ m: n.m, t: gap + n.t, d: n.d })), ...chords));
      },
      body: '<p>Press play: a tune on its own, then the same tune with chords under it.</p><p>The chords don’t change the tune. They give it a floor to stand on.</p>' },
    { k: 'card', tag: 'Name', title: 'Pick a chord that holds the note',
      body: `<p>The Big Three, <b>I, IV and V</b>, can harmonize many simple tunes. For each bar, find its <b>main note</b>, usually the longest or the first. Then pick a chord that contains it.</p><p>In C: ${L3_FIT_C}</p><p>Ending on I sounds finished. Ending on V sounds like a question.</p>` },
    { k: 'task', tag: 'Create', type: 'harmonizePhrase', p: { prompt: 'Choose I, IV or V for each bar of your phrase, play it back, then save it.' } }
  ] },
  { id: '3.B', title: 'Boss challenge', blurb: 'Six triads against the clock, eight chords by ear, four Roman numerals.', boss: true, steps: [
    { k: 'card', tag: 'Name', title: 'Show what you know', body: '<p>Part 1: play 6 named triads, 12 seconds each. You need 5.</p><p>Part 2: name 8 chords by ear: major, minor, diminished or augmented. You need 6.</p><p>Part 3: play 4 Roman numerals in G or F major. You need 3.</p><p>Tap a chord’s notes within a second, use a MIDI keyboard, or turn on the mic and play.</p>' },
    { k: 'task', tag: 'Echo', type: 'playChords', p: () => ({ prompt: 'Play each triad. 12 seconds each.', chords: l3Mixed(6), limit: 12, pass: 5, passMsg: 'Part 1 passed.' }) },
    { k: 'task', tag: 'Name', type: 'quiz', p: () => l3EarQuiz(L3_Q4, shuffle(['maj', 'maj', 'min', 'min', 'dim', 'dim', 'aug', 'aug']), { pass: 6, passMsg: 'Part 2 passed.' }) },
    { k: 'task', tag: 'Echo', type: 'playChords', p: () => { const k = rand(['G', 'F']), r = shuffle(['I', 'ii', 'iii', 'IV', 'V', 'vi']).slice(0, 4); return { prompt: `${k} major: play each numeral as a chord. 15 seconds each.`, chords: r.map(x => Theory.romanChord(x, k).sym), labels: r.map(x => x + ' in ' + k), limit: 15, pass: 3, passMsg: 'Part 3 passed.' }; } }
  ] }
];

/* ---------- review deck ---------- */
const l3Pick = (pool) => () => rand(pool);
const L3_CARDS = {
  '3.1': [
    { id: 'l3-triad', type: 'choice', q: 'A triad is…', options: ['Three notes stacked in 3rds', 'Any three notes played together', 'Three keys side by side'], answer: 0, why: 'Skip a key, skip a key: root, 3rd and 5th.' },
    { id: 'l3-root', type: 'gen', gen: () => {
      const c = rand(L3_DIA_C.slice(0, 6)), v = l3Voice(c.sym), opts = shuffle([c.root, c.notes[1], c.notes[2]]);
      return { q: 'Which note is the root of this triad?', html: Staff.svg({ notes: [v], minWidth: 150, aria: 'Treble staff: a triad, ' + v.join(' ') }), options: opts, answer: opts.indexOf(c.root), why: `The bottom note of a stacked triad is the root: ${c.root}. The chord is ${Theory.pretty(c.sym)}.` };
    } },
    { id: 'l3-play-c', type: 'chord', chord: 'C', prompt: 'Play C major: C, E and G together.' },
    { id: 'l3-skip', type: 'chord', chord: l3Pick(['F', 'G', 'Dm', 'Em', 'Am']), prompt: 'White keys only: from the root, skip a key, skip a key.' }
  ],
  '3.2': [
    { id: 'l3-maj-recipe', type: 'choice', q: 'Counting half steps from the root, a major triad is…', options: ['4 + 3', '3 + 4', '3 + 3'], answer: 0, why: 'Big then small: 4 + 3. Minor is the other way round, 3 + 4.' },
    { id: 'l3-move-middle', type: 'choice', q: 'How do you turn C major into C minor?', options: ['Move the middle note down a half step', 'Move the top note down a half step', 'Move the bottom note up a half step'], answer: 0, why: 'Move the middle: C E G becomes C E♭ G.' },
    { id: 'l3-ear-mm', type: 'gen', gen: () => l3EarItem(['maj', 'min']) },
    { id: 'l3-spell-mm', type: 'gen', gen: () => {
      const q = rand(['maj', 'min']), c = l3RandChord(q, 48, 59), other = Theory.chordNotes(c.root, q === 'maj' ? 'min' : 'maj'), wrong = [c.root, Theory.up(c.root, '4'), Theory.up(c.root, '5')];
      const opts = shuffle([c.notes, other, wrong]);
      return { q: `Which notes make ${Theory.pretty(c.sym)}?`, options: opts.map(o => o.join(' ')), answer: opts.indexOf(c.notes), why: `${Theory.pretty(c.sym)} is ${Theory.CHORDS[q].name}: ${l3Recipe(q)} half steps, ${c.notes.join(' ')}.` };
    } },
    { id: 'l3-play-maj', type: 'chord', chord: l3Pick(['D', 'E', 'A', 'F', 'G', 'B♭', 'E♭']), prompt: 'Play this major triad: 4 + 3.' },
    { id: 'l3-play-min', type: 'chord', chord: l3Pick(['Dm', 'Em', 'Am', 'Cm', 'Gm', 'F♯m']), prompt: 'Play this minor triad: 3 + 4.' }
  ],
  '3.3': [
    { id: 'l3-dim-recipe', type: 'choice', q: 'A diminished triad is…', options: ['3 + 3 half steps', '4 + 4 half steps', '4 + 3 half steps'], answer: 0, why: 'Squeeze both: 3 + 3, as in B D F.' },
    { id: 'l3-aug-recipe', type: 'choice', q: 'An augmented triad is…', options: ['3 + 4 half steps', '4 + 4 half steps', '3 + 3 half steps'], answer: 1, why: 'Stretch both: 4 + 4, as in C E G♯.' },
    { id: 'l3-sym-dimaug', type: 'gen', gen: () => {
      const q = rand(['dim', 'aug']), c = l3RandChord(q), opts = ['dim', 'aug', 'min'];
      return { q: `What does ${Theory.pretty(c.sym)} mean?`, options: opts.map(x => c.root + ' ' + Theory.CHORDS[x].name), answer: opts.indexOf(q), why: `${q === 'dim' ? '° means diminished' : '+ means augmented'}: ${c.notes.join(' ')}, ${l3Recipe(q)}.` };
    } },
    { id: 'l3-ear-4q', type: 'gen', gen: () => l3EarItem(L3_Q4) },
    { id: 'l3-play-dim', type: 'chord', chord: l3Pick(['B°', 'C♯°', 'F♯°', 'D°', 'E°']), prompt: 'Squeeze both 3rds: 3 + 3.' },
    { id: 'l3-play-aug', type: 'chord', chord: l3Pick(['C+', 'D+', 'E♭+', 'F+', 'G+']), prompt: 'Stretch both 3rds: 4 + 4.' }
  ],
  '3.4': [
    { id: 'l3-sym-mean', type: 'gen', gen: () => {
      const c = l3RandChord(rand(L3_Q4)), opts = shuffle([c.q].concat(shuffle(L3_Q4.filter(x => x !== c.q)).slice(0, 2)));
      return { q: `What does the symbol ${Theory.pretty(c.sym)} mean?`, options: opts.map(x => c.root + ' ' + Theory.CHORDS[x].name), answer: opts.indexOf(c.q), why: `Root ${c.root}, ${Theory.CHORDS[c.q].name} recipe: ${c.notes.join(' ')}.` };
    } },
    { id: 'l3-sym-notes', type: 'gen', gen: () => {
      const root = rand(['C', 'D', 'E', 'F', 'G', 'A']), qs = shuffle(L3_Q4.filter(x => l3Plain(Theory.chordNotes(root, x)))).slice(0, 3);
      const c = l3ChordOf(Theory.symbol(root, qs[0])), opts = shuffle(qs.map(x => Theory.chordNotes(root, x)));
      return { q: `Which notes are in ${Theory.pretty(c.sym)}?`, options: opts.map(o => o.join(' ')), answer: opts.findIndex(o => o.join() === c.notes.join()), why: `${Theory.pretty(c.sym)}: ${l3Recipe(c.q)} up from ${c.root} gives ${c.notes.join(' ')}.` };
    } },
    { id: 'l3-gbox', type: 'gen', gen: () => {
      const g = rand(L3_GUITAR), opts = shuffle([g].concat(shuffle(L3_GUITAR.filter(x => x !== g)).slice(0, 2)));
      return { q: 'Which guitar chord is this?', html: l3GuitarBox(g, { notes: false, title: false }), options: opts.map(x => Theory.pretty(x.sym)), answer: opts.indexOf(g), play: () => l3Strum(g), playLabel: 'Strum it', autoplay: false, why: `${Theory.pretty(g.sym)}: frets ${g.frets} from low E to high E, the notes ${l3Notes(g.sym).join(' ')}.` };
    } },
    { id: 'l3-play-sym', type: 'chord', chord: () => l3Mixed(1)[0], prompt: 'Read the symbol and play it.' },
    { id: 'l3-play-open', type: 'chord', chord: l3Pick(L3_GUITAR.map(g => g.sym)), prompt: 'An open guitar chord. Play it on guitar with the mic on, or as a piano shape.' }
  ],
  '3.5': [
    { id: 'l3-inv-first', type: 'choice', q: 'In first inversion, which note is lowest?', options: ['The root', 'The 3rd', 'The 5th'], answer: 1, why: 'First inversion puts the 3rd at the bottom: E G C for C/E.' },
    { id: 'l3-inv-slash', type: 'choice', q: 'What does C/G mean?', options: ['A C chord with G at the bottom', 'C and G played together', 'A G chord with C at the bottom'], answer: 0, why: 'Same chord, different bottom: C E G with G lowest, so G C E.' },
    { id: 'l3-inv-which', type: 'gen', gen: () => l3InvItem() },
    { id: 'l3-play-ce', type: 'chord', chord: 'C/E', prompt: 'C with E at the bottom.' },
    { id: 'l3-play-inv', type: 'chord', chord: l3Pick(['C/G', 'G/B', 'F/A', 'Am/C', 'F/C', 'D/F♯', 'Em/G']), prompt: 'Put the note after the slash at the bottom.' }
  ],
  '3.6': [
    { id: 'l3-mmm', type: 'choice', q: 'From 1 to 7, the triads of a major key are…', options: ['M M m m M m d', 'M m m M M m d', 'm M M m m M d'], answer: 1, why: 'M m m M M m d: majors on 1, 4, 5; minors on 2, 3, 6; diminished on 7.' },
    { id: 'l3-big3', type: 'choice', q: 'Where are the three major chords of a major key?', options: ['On 1, 4 and 5', 'On 1, 3 and 5', 'On 2, 3 and 6'], answer: 0, why: 'The Big Three: 1, 4 and 5. In C they are C, F and G.' },
    { id: 'l3-dia-c', type: 'gen', gen: () => l3DegreeItem('C') },
    { id: 'l3-dia-play', type: 'chord', chord: l3Pick(L3_DIA_C.map(c => c.sym)), prompt: 'A chord from C major. White keys only.' }
  ],
  '3.7': [
    { id: 'l3-rn-case', type: 'choice', q: 'In Roman numerals, lowercase ii means…', options: ['A minor chord on degree 2', 'A major chord on degree 2', 'Play the chord twice'], answer: 0, why: 'Uppercase is major, lowercase is minor. ii in C is Dm.' },
    { id: 'l3-rn-to', type: 'gen', gen: () => l3RomanItem(rand(['G', 'F', 'D']), rand(['I', 'ii', 'IV', 'V', 'vi'])) },
    { id: 'l3-rn-back', type: 'gen', gen: () => l3RomanBackItem(rand(['G', 'F'])) },
    { id: 'l3-rn-play', type: 'l3roman', keys: ['G', 'F'], romans: ['I', 'ii', 'IV', 'V', 'vi'] }
  ],
  '3.8': [
    { id: 'l3-7-recipe', type: 'gen', gen: () => {
      const q = rand(L3_SEVENTHS), opts = L3_SEVENTHS.map(l3Recipe);
      return { q: `Which recipe builds a ${Theory.CHORDS[q].name} chord (C${Theory.CHORDS[q].sym})?`, options: opts, answer: L3_SEVENTHS.indexOf(q), why: `C${Theory.CHORDS[q].sym}: ${l3Recipe(q)}, ${Theory.chordNotes('C', q).join(' ')}.` };
    } },
    { id: 'l3-v7', type: 'gen', gen: () => {
      const k = rand(['C', 'G', 'F', 'D']), c = Theory.romanChord('V7', k), opts = shuffle([c.sym, Theory.romanChord('V', k).sym, Theory.romanChord('IV7', k).sym]);
      return { q: `What is V7 in ${k} major?`, options: opts.map(Theory.pretty), answer: opts.indexOf(c.sym), why: `Degree 5 of ${k} is ${c.root}; add the 4 + 3 + 3 recipe: ${c.notes.join(' ')}.` };
    } },
    { id: 'l3-ear-7', type: 'gen', gen: () => l3SeventhItem(randInt(0, 3)) },
    { id: 'l3-play-7', type: 'chord', chord: l3Pick(['G7', 'D7', 'C7', 'Cmaj7', 'Fmaj7', 'Am7', 'Dm7', 'Em7']), prompt: 'Four notes: root, 3rd, 5th and 7th.' }
  ],
  '3.9': [
    { id: 'l3-arp', type: 'choice', q: 'An arpeggio is…', options: ['A chord played one note at a time', 'A chord with four notes', 'A fast scale'], answer: 0, why: 'A broken chord, straight up or down: 1-3-5-8.' },
    { id: 'l3-alberti', type: 'choice', q: 'The Alberti bass plays chord notes in which order?', options: ['1-3-5-8', '1-5-3-5', '5-3-1'], answer: 1, why: 'Low, high, middle, high: 1-5-3-5.' },
    { id: 'l3-arp-play', type: 'l3arp', chords: ['C', 'F', 'G', 'Am', 'Dm', 'D', 'Em'] },
    { id: 'l3-arp-name', type: 'gen', gen: () => l3ArpItem() }
  ]
};

/* Daily Set “Create”: arpeggio and chord-tone motifs. The prompts getter picks a chord each time
   (views read prompts before params), so every Create step can use a different chord. */
const L3_ARP_SYMS = ['C', 'F', 'G', 'Am', 'Dm', 'Em', 'D', 'B♭', 'E♭', 'A'];
let l3CreateSym = rand(L3_ARP_SYMS);
const L3_CREATE = {
  get prompts() {
    l3CreateSym = rand(L3_ARP_SYMS);
    const s = Theory.pretty(l3CreateSym), n = l3Notes(l3CreateSym);
    return [
      `Arpeggio motif on ${s} (${n.join(' ')}): climb 1-3-5-8, then find your own way down.`,
      `Use only ${n.join(', ')}. Start on the 5th (${n[2]}) and end on the root (${n[0]}).`,
      `Play the Alberti pattern on ${s}, ${n[0]}-${n[2]}-${n[1]}-${n[2]}, then change one note to make it yours.`,
      `Make a motif from the notes of ${s} (${n.join(' ')}) with one big leap, then smaller moves back.`,
      `Use just two of the three notes of ${s} (${n.join(' ')}) and give them a rhythm you like.`,
      `Make a motif from ${n.join(' ')} that sounds like a question: end on the 3rd (${n[1]}) or the 5th (${n[2]}).`
    ];
  },
  params: {
    get pcs() { return l3Notes(l3CreateSym).map(Theory.pc); },
    get pcsLabel() { return Theory.pretty(l3CreateSym) + ' (' + l3Notes(l3CreateSym).join(' ') + ')'; },
    min: 3, max: 8
  }
};

addLevel({
  n: 3, title: 'Stack It', tagline: 'Triads, chord symbols, inversions, the chords of a key, Roman numerals and 7ths',
  units: L3_UNITS, cards: L3_CARDS,
  passText: 'You can build, play and hear major, minor, diminished and augmented triads and their inversions, read chord symbols, find the chords of a key with Roman numerals, and add a 7th.',
  create: L3_CREATE,
  ear: {
    title: 'Chord quality', sub: 'Five chords. Name each one: bright major or dark minor, and after unit 3.3 the occasional diminished or augmented.',
    run(body, finish) {
      const four = unitDone('3.3'), quals = four ? L3_Q4 : ['maj', 'min'];
      const order = [0, 1, 2, 3, 4].map(() => four && Math.random() < 0.3 ? rand(['dim', 'aug']) : rand(['maj', 'min']));
      return Tasks.quiz(body, { rounds: 5, gen: i => l3EarItem(quals, l3RandChord(order[i])) }, (ok, r) => finish(r.score, 5));
    }
  }
});
