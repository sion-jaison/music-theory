/* =================================================================
   Level 5 · Make It Move
   Progressions, cadences, transposing, melody over chords, dynamics,
   tempo and articulation, phrases and form, and the 8-bar piece.
   Every name here starts with l5 / L5: all level files share one scope.
   ================================================================= */

/* ---------- small helpers ---------- */
const l5P = s => Theory.pretty(s);
const l5Prog = (romans, key, mode) => Theory.progression(romans, key, mode);
const l5Pcs = c => Theory.chordPcs(c.root, c.q);
const l5Label = c => `${c.roman} · ${l5P(c.sym)}`;
const l5Dash = list => list.join('–');
const l5Syms = chords => chords.map(c => l5P(c.sym)).join(' ');
const l5ProgById = id => Theory.PROGRESSIONS.find(p => p.id === id);
/* 'A, B and C' */
function l5List(items) { return items.length < 2 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1]; }
/* the songs for a progression from Theory.PROGRESSIONS, in italics */
const l5Songs = (id, skip) => l5List(l5ProgById(id).songs.filter(s => s !== skip).map(s => `<i>${s}</i>`));
const l5KeyPcs = (key, mode) => Theory.scale(key, mode === 'minor' ? 'minor' : 'major').map(Theory.pc);
/* spell a pitch class with a scale's own names when it is in the scale */
function l5Name(pc, names) {
  const n = (names || []).find(x => Theory.pc(x) === pc);
  return n || ((names || []).some(x => /♭/.test(x)) ? FLAT : SHARP)[pc];
}
/* how a note fits: 'ct' in the chord (green), 'inkey' in the key (blue), 'out' outside (red) */
const l5Fit = (pc, chord, keyPcs) => l5Pcs(chord).indexOf(pc) >= 0 ? 'ct' : keyPcs.indexOf(pc) >= 0 ? 'inkey' : 'out';
const L5_FIT_WORD = { ct: 'in the chord', inkey: 'in the key', out: 'outside' };
/* a note name placed in octave 4, kept between C4 and D5 */
function l5Mid(name) { let m = Theory.midi(Theory.withOct(Theory.stripOct(name), 4)); if (m > 74) m -= 12; return m; }
/* play chord objects one after another; returns ms */
function l5PlayProg(chords, gap) {
  gap = gap || 0.95;
  return playChordList(chords.map((c, i) => ({ sym: c.sym, t: i * gap, d: i === chords.length - 1 ? gap * 1.9 : gap * 0.92 })));
}
/* melody from [['E4', beats], …] at a tempo → [{ m, t, d }] */
function l5Melody(list, bpm) {
  const spb = 60 / bpm; let b = 0;
  return list.map(([n, d]) => { const o = { m: Theory.midi(n), t: +(b * spb).toFixed(3), d: +(d * spb * 0.95).toFixed(3), beat: b }; b += d; return o; });
}
/* chord list for playSketch: one chord per bar of `beats` beats */
const l5Bars = (chords, bpm, beats) => chords.map((c, i) => ({ sym: c.sym, t: +(i * beats * 60 / bpm).toFixed(3), d: +(beats * 60 / bpm).toFixed(3) }));

/* ---------- the backing loop ----------
   l5Engine({ chords, bpm, beats, countIn, bars, onStart, onCount(n), onChord(i, chord), onBeat(b), onStop, onEnd })
   chords come from Theory.progression. Each chord sounds for `beats` beats (Theory.voicing, octave 3), with a bass
   note on beats 1 and 3 and a soft click on every beat, scheduled about a bar ahead with setTimeout.
   All of it goes through the loop's own gain node, so stop() silences what is already scheduled.
   The loop leaves Sound.busyUntil as it was, so the mic keeps listening while it plays (headphones help). */
function l5Engine(o) {
  o = Object.assign({ beats: 4, bpm: 90, countIn: 0, bars: 0 }, o);
  const e = { chords: o.chords, bpm: o.bpm, playing: false, startT: 0, cur: 0 };
  let k = 0, nextT = 0, pumpId = 0, timers = [], bus = null, ending = false;
  const spb = () => 60 / e.bpm;
  function later(t, fn) {
    const id = setTimeout(() => { const j = timers.indexOf(id); if (j >= 0) timers.splice(j, 1); fn(); }, Math.max(0, (t - Sound.now()) * 1000));
    timers.push(id);
  }
  /* run fn with Sound routed through the loop's gain node; the mic gate is left alone */
  e.onBus = fn => { if (bus) Sound.routed(bus, fn, { gate: false }); };
  function pump() {
    if (!e.playing) return;
    const now = Sound.now(), horizon = now + spb() * o.beats + 0.05;
    /* if a timer fired late (a background tab), skip the beats already past instead of piling them up */
    while (nextT < now - 0.05 && !(o.bars && k >= o.bars * o.beats)) { k++; nextT += spb(); }
    e.onBus(() => {
      while (e.playing && nextT < horizon) {
        const t = nextT, kk = k;
        if (kk < 0) {
          Sound.click(t, kk === -o.countIn, false);
          later(t, () => { if (o.onCount) o.onCount(-kk); });
        } else if (o.bars && kk >= o.bars * o.beats) {
          if (!ending) { ending = true; later(t, () => { e.stop(); if (o.onEnd) o.onEnd(); }); }
          break;
        } else {
          const b = kk % o.beats, ci = Math.floor(kk / o.beats) % e.chords.length, c = e.chords[ci];
          if (b === 0) Sound.chord(Theory.voicing(c.root, c.q, 3), t, spb() * o.beats * 0.95, 0.3);
          if (b % 2 === 0) Sound.tone(Theory.midi(Theory.withOct(c.root, 2)), t, spb() * 1.6, 0.5);
          Sound.click(t, b === 0, true);
          later(t, () => { if (b === 0) { e.cur = ci; if (o.onChord) o.onChord(ci, c); } if (o.onBeat) o.onBeat(b); });
        }
        k++; nextT += spb();
      }
    });
    pumpId = setTimeout(pump, 150);
  }
  e.start = () => {
    if (e.playing) return true;
    const ctx = Sound.ensure(); if (!ctx) return false;
    bus = ctx.createGain(); bus.gain.value = 1; bus.connect(Sound.master);
    e.playing = true; ending = false; e.cur = 0;
    k = -(o.countIn || 0); nextT = ctx.currentTime + 0.12;
    e.startT = nextT + (o.countIn || 0) * spb();
    if (o.onStart) o.onStart();
    pump();
    return true;
  };
  e.stop = () => {
    if (!e.playing) return;
    e.playing = false; clearTimeout(pumpId); timers.forEach(clearTimeout); timers = [];
    const b = bus; bus = null;
    try { const t = Sound.now(); b.gain.setValueAtTime(b.gain.value || 1, t); b.gain.linearRampToValueAtTime(0.0001, t + 0.06); } catch (err) { /* old browsers: the tail rings out */ }
    setTimeout(() => { try { b.disconnect(); } catch (err) { /* already gone */ } }, 300);
    if (o.onStop) o.onStop();
  };
  return e;
}

/* l5Loop(el, { chords, bpm, beats, min, max, grid, lockTempo, note, onChord }) → { cur, playing, start, stop, setChords, destroy }
   The loop with its controls: the chord now playing with its numeral, every chord in a strip, start/stop and tempo. */
function l5Loop(el, o) {
  o = Object.assign({ bpm: 90, beats: 4, min: 60, max: 140 }, o);
  el.innerHTML = `<div class="l5-loop" data-cur="0"><div class="l5-now"><span class="l5-now-num"></span><span class="l5-now-sym"></span><span class="l5-beats" aria-hidden="true">${'<i></i>'.repeat(o.beats)}</span></div><div class="l5-cells${o.grid ? ' l5-grid' : ''}"></div><div class="row l5-loop-ctl"><button type="button" class="btn small primary" data-l5="go">▶ Start the loop</button><label class="l5-tempo">Tempo <input type="range" min="${o.min}" max="${o.max}" step="2" value="${o.bpm}"><span class="mono">${o.bpm} BPM</span></label></div>${o.note ? `<p class="l5-note">${o.note}</p>` : ''}</div>`;
  const box = el.querySelector('.l5-loop'), num = box.querySelector('.l5-now-num'), sym = box.querySelector('.l5-now-sym'), cellsEl = box.querySelector('.l5-cells');
  const lights = [...box.querySelectorAll('.l5-beats i')], btn = box.querySelector('[data-l5="go"]'), rng = box.querySelector('input'), bpmTxt = box.querySelector('.l5-tempo .mono');
  const lit = b => lights.forEach((x, j) => x.classList.toggle('lit', j === b));
  function show(i) {
    const c = eng.chords[i]; if (!c) return;
    num.textContent = c.roman; sym.textContent = l5P(c.sym); box.dataset.cur = i;
    cellsEl.querySelectorAll('.l5-cell').forEach((x, j) => x.classList.toggle('on', j === i));
  }
  const paintCells = () => { cellsEl.innerHTML = eng.chords.map((c, i) => `<span class="l5-cell" data-i="${i}">${o.grid ? `<small>${i + 1}</small>` : ''}<b>${c.roman}</b><span>${l5P(c.sym)}</span></span>`).join(''); };
  const eng = l5Engine(Object.assign({}, o, {
    onChord(i, c) { show(i); if (o.onChord) o.onChord(i, c); },
    onBeat: lit,
    onStop() { lit(-1); btn.textContent = '▶ Start the loop'; rng.disabled = false; }
  }));
  btn.onclick = () => {
    if (eng.playing) { eng.stop(); return; }
    if (eng.start()) { btn.textContent = '■ Stop the loop'; if (o.lockTempo) rng.disabled = true; show(0); if (o.onChord) o.onChord(0, eng.chords[0]); }
  };
  rng.oninput = () => { eng.bpm = +rng.value; bpmTxt.textContent = rng.value + ' BPM'; };
  paintCells(); show(0);
  return {
    get cur() { return eng.cur; }, get playing() { return eng.playing; }, engine: eng,
    start: () => btn.onclick(), stop: () => eng.stop(),
    setChords(list) { eng.chords = list; eng.cur = eng.cur % list.length; paintCells(); show(eng.cur); },
    destroy: () => eng.stop()
  };
}

/* ---------- content data ---------- */
const L5_CADENCES = [
  { id: 'authentic', name: 'Authentic', short: 'V–I', romans: ['I', 'IV', 'V', 'I'], what: 'A full stop: finished.' },
  { id: 'plagal', name: 'Plagal', short: 'IV–I', romans: ['I', 'vi', 'IV', 'I'], what: 'The “Amen”: a soft, settled ending.' },
  { id: 'half', name: 'Half', short: 'ends on V', romans: ['I', 'vi', 'IV', 'V'], what: 'A comma or a question: there is more to come.' },
  { id: 'deceptive', name: 'Deceptive', short: 'V–vi', romans: ['I', 'IV', 'V', 'vi'], what: 'A twist: you expected home and got a surprise.' }
];
const L5_EAR_KEYS = ['C', 'G', 'F', 'D', 'A', 'B♭', 'E♭'];
const L5_ROT = ['pop', 'sad', 'fifties'];
const L5_DYN = [
  { s: 'p', name: 'piano', say: 'soft', v: 0.14 },
  { s: 'mp', name: 'mezzo-piano', say: 'fairly soft', v: 0.28 },
  { s: 'mf', name: 'mezzo-forte', say: 'fairly loud', v: 0.48 },
  { s: 'f', name: 'forte', say: 'loud, strong', v: 0.74 },
  { s: 'ff', name: 'fortissimo', say: 'very loud', v: 1 }
];
const L5_TEMPI = [
  { w: 'Largo', bpm: 50, d: 'very slow and broad' },
  { w: 'Andante', bpm: 76, d: 'a walking pace' },
  { w: 'Moderato', bpm: 108, d: 'moderate, neither slow nor fast' },
  { w: 'Allegro', bpm: 138, d: 'fast and bright' },
  { w: 'Presto', bpm: 184, d: 'very fast' }
];
/* 5.7: an original tune over C–G–Am–F. Chord tones on beats 1 and 3, passing notes between. */
const L5_TUNE = { key: 'C', romans: ['I', 'V', 'vi', 'IV'], bpm: 96,
  notes: [['E4', 1], ['F4', 1], ['G4', 1], ['F4', 1], ['G4', 1], ['A4', 1], ['B4', 1], ['A4', 1], ['A4', 1], ['B4', 1], ['C5', 1], ['B4', 1], ['A4', 1], ['G4', 1], ['F4', 2]] };
/* 5.9: an original 8-bar period in C. Question I–IV–I–V ends on D (over V); answer I–IV–V–I ends on C. */
const L5_PERIOD = { key: 'C', bpm: 112, q: ['I', 'IV', 'I', 'V'], a: ['I', 'IV', 'V', 'I'],
  notes: [['E4', 1], ['G4', 1], ['C5', 2], ['A4', 1], ['G4', 1], ['F4', 2], ['E4', 1], ['D4', 1], ['E4', 1], ['G4', 1], ['D4', 4],
    ['E4', 1], ['G4', 1], ['C5', 2], ['A4', 1], ['G4', 1], ['F4', 2], ['G4', 1], ['F4', 1], ['D4', 1], ['B3', 1], ['C4', 4]] };
/* 5.P: keys and chord plans. Each plan is [question (ends on V), answer (ends on I)]. */
const L5_PIECE_KEYS = [
  { key: 'C', mode: 'major', label: 'C major' }, { key: 'G', mode: 'major', label: 'G major' },
  { key: 'F', mode: 'major', label: 'F major' }, { key: 'A', mode: 'minor', label: 'A minor' }
];
const L5_PIECE_PLANS = [
  { name: 'Steady', major: [['I', 'IV', 'I', 'V'], ['I', 'IV', 'V', 'I']], minor: [['i', 'iv', 'i', 'V'], ['i', 'iv', 'V', 'i']] },
  { name: 'Pop', major: [['I', 'vi', 'IV', 'V'], ['I', 'vi', 'V', 'I']], minor: [['i', 'VI', 'iv', 'V'], ['i', 'VI', 'V', 'i']] },
  { name: 'Climb', major: [['I', 'ii', 'IV', 'V'], ['vi', 'IV', 'V', 'I']], minor: [['i', 'VII', 'VI', 'V'], ['VI', 'iv', 'V', 'i']] }
];

/* ---------- sound examples ---------- */
function l5PlayDyn(v) { return Sound.seq([60, 64, 67, 72, 67, 64, 60].map((m, i) => ({ m, t: i * 0.3, d: 0.28, v }))); }
function l5PlayRamp(v0, v1) {
  const ms = [60, 64, 67, 64, 60, 64, 67, 64, 60, 64, 67, 72];
  return Sound.seq(ms.map((m, i) => ({ m, t: i * 0.28, d: 0.26, v: Math.max(0.08, v0 + (v1 - v0) * i / (ms.length - 1)) })));
}
function l5PlayArtic(kind) {
  const ms = [60, 62, 64, 65, 67, 65, 64, 62], g = 0.32;
  return Sound.seq(ms.map((m, i) => ({ m, t: i * g, d: kind === 'staccato' ? 0.05 : kind === 'legato' ? g * 1.6 : 0.22, v: kind === 'accent' ? (i % 4 === 0 ? 1 : 0.3) : 0.6 })));
}
function l5PlayTempo(bpm) {
  const spb = 60 / bpm, ms = [60, 62, 64, 67, 64, 62], ctx = Sound.ensure(); if (!ctx) return 0;
  const t0 = ctx.currentTime + 0.1;
  ms.forEach((m, i) => Sound.click(t0 + i * spb, i % 4 === 0, true));
  return Sound.seq(ms.map((m, i) => ({ m, t: i * spb, d: spb * 0.8 })), 0.1);
}
function l5PlayPeriod(part) {
  const P = L5_PERIOD, mel = l5Melody(P.notes, P.bpm), bar = 4 * 60 / P.bpm;
  const chords = l5Bars(l5Prog(P.q.concat(P.a), P.key), P.bpm, 4);
  const from = part === 'a' ? 4 : 0, to = part === 'q' ? 4 : 8;
  return playSketch({
    notes: mel.filter(n => n.t >= from * bar - 0.01 && n.t < to * bar - 0.01).map(n => ({ m: n.m, t: n.t - from * bar, d: n.d })),
    chords: chords.slice(from, to).map(c => ({ sym: c.sym, t: c.t - from * bar, d: c.d }))
  });
}

/* ---------- pictures ---------- */
function l5TsdArt() {
  const f = (cls, L, r, w) => `<span class="l5-f ${cls}"><b>${L}</b><span class="mono">${r}</span><span>${w}</span></span>`, a = '<span class="l5-arrow" aria-hidden="true">→</span>';
  return `<div class="l5-tsd" role="img" aria-label="Tonic I home, subdominant IV away, dominant V tension, tonic I home">${f('t', 'T', 'I', 'home')}${a}${f('s', 'S', 'IV', 'away')}${a}${f('d', 'D', 'V', 'tension')}${a}${f('t', 'T', 'I', 'home')}</div>`;
}
/* a grid of bars: number, numeral, chord, and an optional note under some bars */
function l5BarsArt(chords, notes, heads) {
  const cell = (c, i) => `<span class="l5-cell"><small>${i + 1}</small><b>${c.roman}</b><span>${l5P(c.sym)}</span>${notes && notes[i] ? `<em>${notes[i]}</em>` : ''}</span>`;
  if (!heads) return `<div class="l5-cells l5-grid">${chords.map(cell).join('')}</div>`;
  return `<div class="l5-cells l5-grid">${heads.map((h, k) => `<span class="l5-half">${h}</span>${chords.slice(k * 4, k * 4 + 4).map((c, j) => cell(c, k * 4 + j)).join('')}`).join('')}</div>`;
}
function l5HairpinSVG() {
  return `<svg class="l5-svg" viewBox="0 0 340 74" role="img" aria-label="Crescendo from p to f, then diminuendo from f to p"><text class="dyn" x="6" y="34">p</text><path d="M28 26 L136 10 M28 26 L136 42"/><text class="dyn" x="142" y="34">f</text><text class="dyn" x="178" y="34">f</text><path d="M200 10 L308 26 L200 42"/><text class="dyn" x="316" y="34">p</text><text x="82" y="66" text-anchor="middle">crescendo</text><text x="254" y="66" text-anchor="middle">diminuendo</text></svg>`;
}
/* staccato dots, a legato slur and accents, each on a little staff */
function l5ArticSVG() {
  const staff = x => [0, 1, 2, 3, 4].map(i => `<line x1="${x}" x2="${x + 140}" y1="${24 + i * 8}" y2="${24 + i * 8}" class="thin"/>`).join('');
  const heads = [[28, 52], [56, 48], [84, 44], [112, 40]];
  const note = (x, y) => `<ellipse class="fill" cx="${x}" cy="${y}" rx="5" ry="3.6" transform="rotate(-20 ${x} ${y})"/><line x1="${x + 4.6}" x2="${x + 4.6}" y1="${y - 1}" y2="${y - 26}"/>`;
  let out = '';
  ['staccato', 'legato', 'accent'].forEach((k, p) => {
    const x0 = p * 160 + 4;
    out += staff(x0) + heads.map(([x, y]) => note(x0 + x, y)).join('');
    if (k === 'staccato') out += heads.map(([x, y]) => `<circle class="fill" cx="${x0 + x}" cy="${y + 10}" r="2"/>`).join('');
    if (k === 'legato') out += `<path d="M${x0 + 24} 64 Q${x0 + 70} 82 ${x0 + 116} 56"/>`;
    if (k === 'accent') out += `<path d="M${x0 + 22} 66 L${x0 + 34} 70 L${x0 + 22} 74"/><path d="M${x0 + 106} 54 L${x0 + 118} 58 L${x0 + 106} 62"/>`;
    out += `<text x="${x0 + 70}" y="98" text-anchor="middle">${k}</text>`;
  });
  return `<svg class="l5-svg" viewBox="0 0 472 106" role="img" aria-label="Staccato dots, a legato slur, and accent marks">${out}</svg>`;
}
/* ‖: bar 1 | bar 2 | 1st ending: bar 3 :‖ | 2nd ending: bar 4 ‖ */
function l5RepeatSVG() {
  const lines = [0, 1, 2, 3, 4].map(i => `<line class="thin" x1="10" x2="500" y1="${44 + i * 9}" y2="${44 + i * 9}"/>`).join('');
  const bar = x => `<line x1="${x}" x2="${x}" y1="44" y2="80"/>`;
  const thick = x => `<rect class="fill" x="${x}" y="44" width="4" height="36"/>`;
  const dots = x => `<circle class="fill" cx="${x}" cy="57.5" r="2.4"/><circle class="fill" cx="${x}" cy="66.5" r="2.4"/>`;
  const note = (x, y) => `<ellipse class="fill" cx="${x}" cy="${y}" rx="5" ry="3.6" transform="rotate(-20 ${x} ${y})"/><line x1="${x + 4.6}" x2="${x + 4.6}" y1="${y - 1}" y2="${y - 26}"/>`;
  const notes = [[50, 71], [80, 66], [160, 62], [200, 57], [280, 66], [320, 71], [400, 62], [440, 75]].map(([x, y]) => note(x, y)).join('');
  return `<svg class="l5-svg" viewBox="0 0 512 120" role="img" aria-label="Repeat signs with first and second endings: play bars 1, 2, 3, repeat, then 1, 2, 4">${lines}${thick(10)}${bar(18)}${dots(25)}${bar(130)}${bar(250)}${dots(358)}${bar(364)}${thick(368)}${bar(496)}${thick(500)}`
    + `<path d="M253 32 L253 20 L362 20 L362 32"/><text x="260" y="33">1.</text><path d="M375 32 L375 20 L490 20"/><text x="382" y="33">2.</text>`
    + `${notes}<text x="70" y="104" text-anchor="middle">bar 1</text><text x="190" y="104" text-anchor="middle">bar 2</text><text x="306" y="104" text-anchor="middle">bar 3</text><text x="432" y="104" text-anchor="middle">bar 4</text></svg>`;
}
function l5FormArt() {
  const row = (label, parts) => `<div class="l5-form"><span class="l5-form-l">${label}</span>${parts.map(([t, c]) => `<span class="${c}">${t}</span>`).join('')}</div>`;
  return row('AABA', [['A', 'a'], ['A', 'a'], ['B', 'b'], ['A', 'a']]) + row('Song', [['Verse', 'a'], ['Chorus', 'b'], ['Verse', 'a'], ['Chorus', 'b'], ['Bridge', 'c'], ['Chorus', 'b']]);
}
function l5TuneStaff() {
  const T = L5_TUNE, chords = l5Prog(T.romans, T.key), mel = l5Melody(T.notes, T.bpm);
  const items = T.notes.map(([n], i) => {
    const b = mel[i].beat, c = chords[Math.floor(b / 4)], strong = b % 2 === 0;
    return { n, mark: strong && l5Pcs(c).indexOf(Theory.pc(n)) >= 0 ? 'ok' : '', label: b % 4 === 0 ? l5P(c.sym) : null };
  });
  return Staff.svg({ clef: 'treble', notes: items, gap: 30, filled: true, aria: 'The tune on a treble staff; chord tones on strong beats are green' });
}

/* ---------- question generators ---------- */
/* a cadence by ear in a random key */
function l5CadenceItem(keys) {
  const cad = rand(L5_CADENCES), key = rand(keys || L5_EAR_KEYS), chords = l5Prog(cad.romans, key);
  return {
    q: 'Which cadence is this? Listen to the last two chords.',
    options: L5_CADENCES.map(c => `${c.name} (${c.short})`), answer: L5_CADENCES.indexOf(cad),
    play: () => l5PlayProg(chords, 0.85), playLabel: 'Hear it again',
    why: `${cad.name}: ${l5Dash(chords.map(c => c.roman))} in ${key} (${l5Syms(chords)}). ${cad.what}`
  };
}
/* one of the three four-chord loops by ear */
function l5LoopItem() {
  const pr = l5ProgById(rand(L5_ROT)), key = rand(['C', 'G', 'D', 'F']), chords = l5Prog(pr.romans, key);
  const opts = L5_ROT.map(id => l5Dash(l5ProgById(id).romans));
  return {
    q: 'Which loop is this? Listen for where the minor chord falls.', options: opts, answer: L5_ROT.indexOf(pr.id),
    play: () => l5PlayProg(chords, 0.8), playLabel: 'Hear it again',
    why: `${l5Dash(pr.romans)} in ${key}: ${l5Syms(chords)}. Songs: ${l5List(pr.songs)}.`
  };
}
/* where did it stop: home, away or tension? */
function l5StopItem() {
  const key = rand(['C', 'G', 'F']), last = rand(['I', 'IV', 'V']);
  const mid = rand(['IV', 'V', 'vi'].filter(r => r !== last)), chords = l5Prog(['I', mid, last], key);
  const i = ['I', 'IV', 'V'].indexOf(last);
  return {
    q: 'Three chords, then a stop. Where did it stop?', options: ['Home (I, tonic)', 'Away (IV, subdominant)', 'Tension (V, dominant)'], answer: i,
    play: () => l5PlayProg(chords, 0.9), playLabel: 'Hear it again',
    why: `${l5Dash(chords.map(c => c.roman))} in ${key}: it stopped on ${last}, ${['home. Nothing more to say.', 'away from home. It drifts.', 'tension. It leans back toward I.'][i]}`
  };
}
/* turn a numeral into a chord in a key, with the circle to help (family: show the numerals on the slice) */
const L5_SLICE = { I: 'the key itself, in the middle of the slice', IV: 'the outer neighbour anticlockwise', V: 'the outer neighbour clockwise', vi: 'inside, just under the key', ii: 'inside, under IV', iii: 'inside, under V' };
function l5NumItem(key, roman, family) {
  const target = Theory.romanChord(roman, key);
  const others = shuffle(Theory.diatonic(key).slice(0, 6).filter(d => d.sym !== target.sym)).slice(0, 3).map(d => d.sym);
  const opts = shuffle([target.sym].concat(others));
  return {
    q: `In ${key} major, which chord is ${roman}?`,
    html: Circle.svg({ selected: Theory.circlePos(key), family: !!family, static: true, center: [key + ' major', roman + ' = ?'] }),
    options: opts.map(l5P), answer: opts.indexOf(target.sym), autoplay: false,
    why: `${roman} in ${key} is ${l5P(target.sym)} (${target.notes.join(' ')}): ${L5_SLICE[roman]}.`
  };
}
/* question or answer? a generated 4-chord phrase that ends on V or on I */
function l5PhraseItem() {
  const isQ = Math.random() < 0.5, key = rand(['C', 'G', 'F']);
  const chords = l5Prog(isQ ? ['I', 'IV', 'I', 'V'] : ['I', 'IV', 'V', 'I'], key);
  const scaleM = []; Theory.scale(key + '3', 'major').concat(Theory.scale(key + '4', 'major'), Theory.scale(key + '5', 'major')).forEach(n => scaleM.push(Theory.midi(n)));
  const tonic = l5Mid(key), mel = [];
  chords.forEach((c, i) => {
    const tones = c.notes.map(l5Mid), t = i * 1.0;
    if (i < 3) {
      const a = rand(tones), k = scaleM.indexOf(a), b = scaleM[k + (Math.random() < 0.5 ? 1 : -1)] || a;
      mel.push({ m: a, t, d: 0.45 }, { m: b, t: t + 0.5, d: 0.45 });
    } else mel.push({ m: isQ ? rand(tones.filter(m => mod12(m) !== mod12(tonic))) : tonic, t, d: 1.8 });
  });
  const last = chords[3];
  return {
    q: 'Question or answer? Listen to where the phrase stops.', options: ['Question: ends on V (half cadence)', 'Answer: ends on I (authentic cadence)'], answer: isQ ? 0 : 1,
    play: () => { playChordList(chords.map((c, i) => ({ sym: c.sym, t: i * 1.0, d: i === 3 ? 1.8 : 0.95 }))); Sound.seq(mel); }, playLabel: 'Hear it again',
    why: `${isQ ? 'Question' : 'Answer'}: ${l5Dash(chords.map(c => c.roman))} in ${key}, ending on ${last.roman} (${l5P(last.sym)}). ${isQ ? 'It hangs in the air, wanting more.' : 'It lands at home.'}`
  };
}
function l5TempoItem() {
  const T = rand(L5_TEMPI), opts = shuffle([T].concat(shuffle(L5_TEMPI.filter(x => x !== T)).slice(0, 2)));
  return { q: 'Listen to the speed. Which tempo word fits?', options: opts.map(x => x.w), answer: opts.indexOf(T), play: () => l5PlayTempo(T.bpm), playLabel: 'Hear it again', why: `${T.w}: about ${T.bpm} BPM, ${T.d}.` };
}
const L5_FORM_QS = [
  { q: 'In what order do you play these bars?', html: l5RepeatSVG(), options: ['1 2 3 1 2 4', '1 2 3 4', '1 2 3 4 1 2 3 4'], answer: 0, why: 'Play to the repeat sign, go back to the start, then skip the 1st ending and take the 2nd.' },
  { q: 'A song goes A A B A. Which section brings the contrast?', options: ['The first A', 'B', 'The last A'], answer: 1, why: 'B is the new material; the A sections repeat around it.' },
  { q: 'Verse, chorus, verse, chorus: which part comes back with the same words?', options: ['The verse', 'The chorus'], answer: 1, why: 'The chorus repeats its words and tune. Each verse keeps the tune and changes the words.' },
  { q: 'A question phrase usually ends on…', options: ['I (home)', 'V (a half cadence)', 'vi (a surprise)'], answer: 1, why: 'Ending on V leaves it open, like a comma.' },
  { q: 'An answer phrase that ends V–I ends with…', options: ['A half cadence', 'An authentic cadence', 'A plagal cadence'], answer: 1, why: 'V–I is the authentic cadence: a full stop.' },
  { q: 'What do the dots in the signs ‖: and :‖ mean?', options: ['Play louder', 'Repeat the music between them', 'Stop here'], answer: 1, why: 'Repeat signs face each other. Play the music between them twice.' }
];

/* ---------- tasks ---------- */

/* Play a progression chord by chord; the strip shows where you are. Built on Tasks.playChords.
   p: { key, mode, romans, prompt, tones (show the notes), hideSyms (numerals only), hear (default true), art, limit, pass, passMsg } */
Tasks.l5Follow = (el, p, done) => {
  const chords = l5Prog(p.romans, p.key, p.mode);
  const cells = chords.map((c, i) => `<span class="l5-cell" data-i="${i}"><b>${c.roman}</b><span>${p.hideSyms ? '?' : l5P(c.sym)}</span></span>`).join('');
  el.innerHTML = `<div class="l5-task">${p.prompt ? `<p class="prompt">${p.prompt}</p>` : ''}${p.art ? `<div class="art l5-art">${p.art}</div>` : ''}<div class="l5-prog"><span class="l5-keyname" data-key="${p.key}" data-mode="${p.mode || 'major'}">${Theory.keyName(p.key, p.mode)}</span><div class="l5-cells">${cells}</div></div>${p.hear === false ? '' : `<div class="row">${playBtn('Hear it')}</div>`}<div class="l5-follow"></div></div>`;
  const host = el.querySelector('.l5-follow'), cellEls = [...el.querySelectorAll('.l5-prog .l5-cell')];
  const pb = el.querySelector('[data-act="play"]'); if (pb) pb.onclick = () => l5PlayProg(chords);
  const inner = Tasks.playChords(host, { chords: chords.map(c => c.sym), labels: chords.map(c => p.hideSyms ? c.roman : l5Label(c)), tones: p.tones, limit: p.limit, pass: p.pass, passMsg: p.passMsg }, done);
  const dots = [...host.querySelectorAll('.progress-dots span')];
  const paint = () => {
    const st = dots.map(d => d.classList.contains('on') ? 'ok' : d.classList.contains('miss') ? 'no' : '');
    const cur = st.indexOf('');
    cellEls.forEach((c, i) => { c.className = 'l5-cell' + (st[i] ? ' ' + st[i] : '') + (i === cur ? ' cur' : ''); if (p.hideSyms) c.querySelector('span').textContent = st[i] ? l5P(chords[i].sym) : '?'; });
  };
  const mo = typeof MutationObserver === 'function' ? new MutationObserver(paint) : null;
  if (mo) mo.observe(host.querySelector('.progress-dots'), { attributes: true, subtree: true });
  paint();
  return () => { if (mo) mo.disconnect(); inner(); };
};

/* Plan a progression from numerals, hear it, and see its functions (T, S, D).
   p: { key, palette, slots, prompt } */
Tasks.l5Builder = (el, p, done) => {
  const key = p.key || 'C', pal = p.palette || ['I', 'IV', 'V'], n = p.slots || 4;
  const FN = { I: 'T', IV: 'S', V: 'D', ii: 'S', vi: 'T' };
  let slots = [], timers = [], finished = false;
  el.innerHTML = `<div class="l5-task"><p class="prompt">${p.prompt}</p><div class="l5-cells l5-slots"></div><div class="choices">${pal.map(r => `<button type="button" class="choice" data-r="${r}">${r} · ${l5P(Theory.romanChord(r, key).sym)}</button>`).join('')}</div><div class="row">${playBtn('Hear my progression')}<button type="button" class="btn small ghost" data-act="clear">Clear</button></div><p class="fb info" aria-live="polite">Tap the numerals to fill the ${n} slots.</p></div>`;
  const box = el.querySelector('.l5-slots'), f = el.querySelector('.fb');
  const paint = hi => {
    let html = '';
    for (let i = 0; i < n; i++) {
      const r = slots[i];
      html += r ? `<span class="l5-cell${i === hi ? ' on' : ''}"><b>${r}</b><span>${l5P(Theory.romanChord(r, key).sym)} · ${FN[r]}</span></span>` : '<span class="l5-cell l5-empty"><b>?</b><span>empty</span></span>';
    }
    box.innerHTML = html;
  };
  const clearT = () => { timers.forEach(clearTimeout); timers = []; };
  el.querySelector('.choices').onclick = ev => {
    const b = ev.target.closest('[data-r]'); if (!b) return;
    if (slots.length >= n) { fb(f, 'info', 'All slots are full. Hear it, or clear and start again.'); return; }
    slots.push(b.dataset.r); paint();
    const c = Theory.romanChord(b.dataset.r, key); Sound.chord(Theory.voicing(c.root, c.q, 3), null, 0.8);
    fb(f, 'info', slots.length < n ? `${slots.length} of ${n}.` : 'Full. Now hear it.');
  };
  el.querySelector('[data-act="clear"]').onclick = () => { clearT(); slots = []; paint(); fb(f, 'info', `Tap the numerals to fill the ${n} slots.`); };
  el.querySelector('[data-act="play"]').onclick = () => {
    if (slots.length < n) { fb(f, 'bad', `Fill all ${n} slots first.`); return; }
    clearT();
    const chords = l5Prog(slots, key);
    l5PlayProg(chords);
    chords.forEach((c, i) => timers.push(setTimeout(() => paint(i), 80 + i * 950)));
    timers.push(setTimeout(() => paint(), 80 + n * 950 + 800));
    const trip = slots.map(r => FN[r]).join(' → ');
    if (slots[0] !== 'I') fb(f, 'bad', `${trip}. Start at home: put I first.`);
    else if (slots[n - 1] !== 'I') fb(f, 'bad', `${trip}. It stops away from home. Hear how it hangs? End on I to land.`);
    else { fb(f, 'good', `${trip}: out and back home. ${slots.indexOf('V') > 0 ? 'The V before home is the strongest pull.' : 'Try a V just before the end for a stronger pull home.'}`); if (!finished) { finished = true; done(true); } }
  };
  paint();
  return () => { clearT(); };
};

/* Improvise over a backing loop; every note lights up by how it fits.
   p: { key, mode, romans, bpm, prompt, kind: 'radar' (green chord tone, blue in the key, red outside) | 'scale' (green in p.scale, red outside),
        scale (Theory scale type for 'scale'), need (notes in the window, default 16), share (part in the key/scale to pass, default 0.75),
        tones (chord tones needed, default 4), landings (instead: first note after each chord change must be a chord tone, this many in a row) } */
Tasks.l5Radar = (el, p, done) => {
  const chords = l5Prog(p.romans, p.key, p.mode), keyPcs = l5KeyPcs(p.key, p.mode), keyNames = Theory.scale(p.key, p.mode === 'minor' ? 'minor' : 'major');
  const scale = p.kind === 'scale' ? Theory.scale(p.key, p.scale) : null, scalePcs = scale ? scale.map(Theory.pc) : null;
  const degs = scale ? Theory.SCALES[p.scale].degrees.map(d => d.replace('b', '♭')) : null;
  const need = p.need || 16, share = p.share || 0.75, minCt = p.tones == null ? 4 : p.tones;
  el.innerHTML = `<div class="l5-task"><p class="prompt">${p.prompt}</p><div class="l5-loop-slot"></div><div class="l5-tally" aria-live="polite"></div><div class="notes-strip l5-trail"><span class="empty">Your notes appear here</span></div><p class="fb info" aria-live="polite">${Mic.state === 'on' ? 'The mic hears you over the loop best with headphones on.' : 'Play on the keys, A to K, MIDI, or turn on the mic.'}</p></div>`;
  const tally = el.querySelector('.l5-tally'), trail = el.querySelector('.l5-trail'), f = el.querySelector('.fb');
  const markChord = c => { if (scale) return; Keyboard.clearMarks(); Keyboard.markPcs(l5Pcs(c), 'hint'); };
  const loop = l5Loop(el.querySelector('.l5-loop-slot'), { chords, bpm: p.bpm || 90, grid: chords.length > 4, onChord: (i, c) => markChord(c), note: 'The glowing keys are the notes of the chord playing now.' });
  if (scale) { el.querySelector('.l5-note').textContent = `The glowing keys are the ${Theory.SCALES[p.scale].name} scale: ${scale.join(' ')}.`; Keyboard.markPcs(scalePcs, 'hint'); } else markChord(chords[0]);
  let hist = [], chips = [], finished = false, landings = 0, lastCi = -1;
  const count = (list, c) => list.filter(x => x === c).length;
  const paintTally = () => {
    const win = hist.slice(-need);
    tally.innerHTML = p.landings ? `<span class="l5-t ct"><b>${landings}</b> of ${p.landings} landings</span>` : (scale
      ? `<span class="l5-t ct"><b>${count(win, 'ct')}</b> in the scale</span><span class="l5-t out"><b>${count(win, 'out')}</b> outside</span>`
      : `<span class="l5-t ct"><b>${count(win, 'ct')}</b> in the chord</span><span class="l5-t inkey"><b>${count(win, 'inkey')}</b> in the key</span><span class="l5-t out"><b>${count(win, 'out')}</b> outside</span>`) + (p.landings ? '' : `<span class="l5-t"><b>${Math.min(hist.length, need)}</b> of ${need} notes</span>`);
  };
  const off = Bus.on('note', d => {
    const pc = mod12(d.midi), c = chords[loop.cur];
    const cls = scale ? (scalePcs.indexOf(pc) >= 0 ? 'ct' : 'out') : l5Fit(pc, c, keyPcs);
    const name = scale ? l5Name(pc, scale) : l5Name(pc, keyNames);
    hist.push(cls); Keyboard.flash(d.midi, 'l5-hit-' + cls, 450);
    chips.push(`<span class="n ${cls}">${name}</span>`); chips = chips.slice(-need);
    trail.innerHTML = chips.join('');
    if (p.landings) {
      if (finished) return;
      if (!loop.playing) { fb(f, 'info', 'Start the loop first, so the chords change under you.'); return; }
      if (loop.cur === lastCi) return;
      lastCi = loop.cur;
      if (cls === 'ct') { landings++; fb(f, 'good', `${name} on ${l5P(c.sym)}: a chord tone. ${landings < p.landings ? 'Walk with blue notes, then land on the next chord.' : ''}`); }
      else { landings = 0; fb(f, 'bad', `${name} is ${L5_FIT_WORD[cls]} on ${l5P(c.sym)}. Its chord tones are ${c.notes.join(' ')}. Start the count again.`); }
      paintTally();
      if (landings >= p.landings) { finished = true; fb(f, 'good', `${p.landings} landings in a row. That is how a tune locks onto its chords.`); done(true); }
      return;
    }
    paintTally();
    if (scale) fb(f, cls === 'ct' ? 'good' : 'bad', cls === 'ct' ? `${name}: in the scale (${degs[scalePcs.indexOf(pc)]}).` : `${name} is outside the scale. Its neighbours ${l5Name(mod12(pc - 1), scale)} and ${l5Name(mod12(pc + 1), scale)} are safer.`);
    else fb(f, cls === 'out' ? 'bad' : 'good', cls === 'ct' ? `${name}: a chord tone of ${l5P(c.sym)}.` : cls === 'inkey' ? `${name}: in ${Theory.keyName(p.key, p.mode)}, a passing note over ${l5P(c.sym)}.` : `${name} is outside ${Theory.keyName(p.key, p.mode)}. It clashes; step a half step to a white key.`);
    if (finished || hist.length < need) return;
    const win = hist.slice(-need), inn = need - count(win, 'out'), ct = count(win, 'ct');
    if (inn >= Math.ceil(share * need) && (scale || ct >= minCt)) {
      finished = true;
      fb(f, 'good', scale ? `${inn} of your last ${need} notes were in the scale. That is the blues.` : `${ct} chord tones and ${inn - ct} passing notes in your last ${need}, ${need - inn} outside. Keep playing as long as you like.`);
      done(true);
    } else if (hist.length % 4 === 0) fb(f, 'info', scale ? 'Stay on the glowing keys for a few bars.' : (inn < Math.ceil(share * need) ? 'Too many red notes. Keep to the white keys for a while.' : 'Aim for the glowing keys more often: they are the chord.'));
  });
  paintTally();
  return () => { off(); loop.destroy(); Keyboard.clearMarks(); };
};

/* Crescendo: with the mic, play or sing soft to loud over 4 s and the app checks the loudness rises (Mic.level).
   Without a mic, order the dynamics from softest to loudest on the keys. */
Tasks.l5Crescendo = (el, p, done) => {
  let iv = 0, rampT = 0, finished = false;
  const stopAll = () => { clearInterval(iv); clearTimeout(rampT); iv = 0; };
  const win = () => { if (finished) return; finished = true; done(true); };
  function micMode() {
    stopAll();
    el.innerHTML = `<div class="l5-task"><p class="prompt">Play or sing one note, held or repeated, from very soft to loud over about four seconds.</p><div class="l5-cresc" aria-hidden="true">${'<i></i>'.repeat(20)}</div><div class="art">${l5HairpinSVG()}</div><div class="row"><button type="button" class="btn primary" data-act="go">Start soft</button><button type="button" class="skip" data-act="keys">No mic? Use the keys instead</button></div><p class="fb info" aria-live="polite">Start at p, end at f. The bars should climb like the opening hairpin.</p></div>`;
    const bars = [...el.querySelectorAll('.l5-cresc i')], f = el.querySelector('.fb'), go = el.querySelector('[data-act="go"]');
    el.querySelector('[data-act="keys"]').onclick = keysMode;
    go.onclick = () => {
      stopAll(); go.disabled = true;
      const samples = [], t0 = performance.now(), T = 4000;
      bars.forEach(b => { b.style.transform = 'scaleY(0.02)'; });
      fb(f, 'info', 'Soft… growing…');
      iv = setInterval(() => {
        const el2 = performance.now() - t0, lv = Mic.level || 0;
        samples.push(lv);
        const k = Math.min(19, Math.floor(el2 / (T / 20)));
        bars[k].style.transform = `scaleY(${Math.max(0.02, Math.min(1, Math.sqrt(lv) * 3))})`;
        if (el2 < T) return;
        stopAll(); go.disabled = false; go.textContent = 'Try again';
        const q = [0, 1, 2, 3].map(i => mean(samples.slice(Math.floor(i * samples.length / 4), Math.floor((i + 1) * samples.length / 4))));
        const grows = q[3] >= q[0] * 2 && q[3] >= 0.02 && q[1] >= q[0] * 0.8 && q[2] >= q[1] * 0.8 && q[3] >= q[2] * 0.8;
        if (grows) { fb(f, 'good', `Soft to loud: about ${Math.round(q[3] / Math.max(q[0], 0.001))} times stronger at the end. That is a crescendo.`); win(); }
        else if (q[3] < 0.02) fb(f, 'bad', 'The end was too quiet to hear. Finish strong: forte.');
        else if (q[3] < q[0] * 2) fb(f, 'bad', 'It did not grow much. Start softer and finish stronger.');
        else fb(f, 'bad', 'It dipped on the way up. Grow steadily, like the hairpin opening.');
      }, 50);
    };
  }
  function keysMode() {
    stopAll();
    let placed = 0;
    const pool = shuffle(L5_DYN);
    el.innerHTML = `<div class="l5-task"><p class="prompt">Put the dynamics in order, softest to loudest. Each one plays as you tap it.</p><div class="choices" data-pool>${pool.map(d => `<button type="button" class="choice" data-d="${d.s}"><span class="l5-it">${d.s}</span></button>`).join('')}</div><div class="l5-order">${L5_DYN.map(() => '<span></span>').join('')}</div><p class="fb info" aria-live="polite">Softest first.</p>${Mic.state === 'off' ? '<div class="row"><button type="button" class="btn small" data-act="mic">Turn on the mic for a real crescendo</button></div>' : ''}</div>`;
    const f = el.querySelector('.fb'), slots = el.querySelectorAll('.l5-order span');
    const mic = el.querySelector('[data-act="mic"]');
    if (mic) mic.onclick = async () => { if (await Mic.start()) micMode(); else toast(micProblem()); };
    el.querySelector('[data-pool]').onclick = ev => {
      const b = ev.target.closest('[data-d]'); if (!b || b.disabled || placed >= L5_DYN.length) return;
      const d = L5_DYN.find(x => x.s === b.dataset.d);
      l5PlayDyn(d.v);
      if (d !== L5_DYN[placed]) { fb(f, 'bad', `${d.s} (${d.name}) is ${d.say}. Something softer is still left.`); return; }
      b.disabled = true; b.classList.add('right');
      slots[placed].innerHTML = `<span class="l5-it">${d.s}</span>`; slots[placed].classList.add('ok'); placed++;
      if (placed < L5_DYN.length) fb(f, 'good', `${d.s}: ${d.name}, ${d.say}.`);
      else { rampT = setTimeout(() => l5PlayRamp(0.1, 1), 2300); fb(f, 'good', 'p → mp → mf → f → ff. Growing like that is a crescendo, drawn as an opening hairpin.'); win(); }
    };
  }
  if (Mic.state === 'on') micMode(); else keysMode();
  return stopAll;
};

/* 5.P: an 8-bar piece over a backing loop. Pick a key and a chord plan; optionally start from a sketch; record, play back, save.
   Saves { name, notes, chords: [{ sym, t, d }], key, bpm, level: 5, from, prompt }. */
Tasks.l5Piece = (el, p, done) => {
  let keyI = 0, planI = 0, bpm = 84, seedId = null, seedRaw = [], rec = [], recording = false, eng = null, saved = false;
  const sk = Store.data.sketches || [];
  const K = () => L5_PIECE_KEYS[keyI];
  const chords8 = () => { const pl = L5_PIECE_PLANS[planI][K().mode]; return l5Prog(pl[0].concat(pl[1]), K().key, K().mode); };
  const spb = () => 60 / bpm, bar = () => 4 * spb();
  /* a sketch from another key (a black-key motif, a C major phrase) is moved by the fewest half steps that fit it into this key */
  const seedShift = () => {
    const kp = l5KeyPcs(K().key, K().mode); let best = 0, bestN = -1;
    [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6].forEach(sh => { const n = seedRaw.filter(x => kp.indexOf(mod12(x.m + sh)) >= 0).length; if (n > bestN) { bestN = n; best = sh; } });
    return best;
  };
  const seedNotes = () => {
    if (!seedRaw.length) return [];
    const dur = Math.max.apply(null, seedRaw.map(n => n.t)) + 0.5, k = Math.min(1, (2 * bar() - 0.3) / dur), sh = seedShift();
    return seedRaw.map(n => ({ m: n.m + sh, t: +(n.t * k).toFixed(3) }));
  };
  const all = () => seedNotes().concat(rec).sort((a, b) => a.t - b.t);
  el.innerHTML = `<div class="l5-task l5-piece"><p class="prompt">${p.prompt}</p>
    <div class="l5-opt"><span class="eyebrow">Key</span><div class="choices" data-g="key">${L5_PIECE_KEYS.map((k, i) => `<button type="button" class="choice" data-i="${i}" aria-pressed="${i === 0}">${k.label}</button>`).join('')}</div></div>
    <div class="l5-opt"><span class="eyebrow">Chords</span><div class="choices" data-g="plan">${L5_PIECE_PLANS.map((pl, i) => `<button type="button" class="choice" data-i="${i}" aria-pressed="${i === 0}">${pl.name}</button>`).join('')}</div></div>
    <div class="l5-opt l5-seed">${sk.length ? `<label class="eyebrow" for="l5-seed">Start from a sketch (optional)</label><div class="row"><select id="l5-seed">${sk.map(s => `<option value="${s.id}">${esc(s.name)}${s.level ? ' · Level ' + s.level : ''}</option>`).join('')}</select><button type="button" class="btn small" data-act="hearseed">▶ Hear it</button><button type="button" class="btn small" data-act="useseed">Use it to open bar 1</button></div>` : '<p class="l5-note">No sketches yet, so you start fresh. Your Level 1 motif would make a good opening.</p>'}</div>
    <div class="l5-piece-bars"></div>
    <div class="row"><label class="l5-tempo">Tempo <input type="range" min="60" max="132" step="2" value="${bpm}"><span class="mono">${bpm} BPM</span></label></div>
    <div class="row"><button type="button" class="btn primary" data-act="rec">● Record over the loop</button><button type="button" class="btn" data-act="playback" disabled>▶ Play back with chords</button><button type="button" class="btn ghost" data-act="clear" disabled>Clear</button></div>
    <p class="fb info" aria-live="polite">Four clicks count you in, then 8 bars play once. Record as many times as you like.</p>
    <ul class="l5-checks"></ul>
    <div class="field"><label for="l5-piece-name">Name it</label><input id="l5-piece-name" type="text" maxlength="40" placeholder="e.g. Walking home"></div>
    <div class="row"><button type="button" class="btn primary" data-act="save" disabled>Save to sketchbook</button></div></div>`;
  const barsEl = el.querySelector('.l5-piece-bars'), checksEl = el.querySelector('.l5-checks'), f = el.querySelector('.fb');
  const bRec = el.querySelector('[data-act="rec"]'), bPlay = el.querySelector('[data-act="playback"]'), bClear = el.querySelector('[data-act="clear"]'), bSave = el.querySelector('[data-act="save"]');
  const rng = el.querySelector('.l5-tempo input'), bpmTxt = el.querySelector('.l5-tempo .mono'), nameIn = el.querySelector('#l5-piece-name');
  function paintBars(on) {
    const cs = chords8(), keyPcs = l5KeyPcs(K().key, K().mode), names = Theory.scale(K().key, K().mode === 'minor' ? 'minor' : 'major'), ns = all();
    const cell = i => {
      const c = cs[i], mine = ns.filter(n => Math.min(7, Math.floor(n.t / bar())) === i);
      return `<div class="l5-bar${i === on ? ' on' : ''}" data-b="${i}"><div class="l5-bar-h"><small>${i + 1}</small><b>${c.roman}</b><span>${l5P(c.sym)}</span></div><div class="l5-bar-n">${mine.map(n => `<span class="n ${l5Fit(mod12(n.m), c, keyPcs)}">${l5Name(mod12(n.m), names)}</span>`).join('')}</div></div>`;
    };
    barsEl.innerHTML = `<span class="l5-half">Question · bars 1–4 · ends on V</span>${[0, 1, 2, 3].map(cell).join('')}<span class="l5-half">Answer · bars 5–8 · ends on I</span>${[4, 5, 6, 7].map(cell).join('')}`;
  }
  function checks() {
    const ns = all(), cs = chords8(), b4 = 4 * bar(), last = ns[ns.length - 1];
    const q = ns.filter(n => n.t < b4), lastQ = q[q.length - 1];
    return [
      { ok: ns.length >= 8, t: `At least 8 notes (${ns.length} so far)` },
      { ok: q.length > 0 && ns.some(n => n.t >= b4), t: 'Notes in both halves: the question and the answer' },
      { ok: !!lastQ && l5Pcs(cs[3]).indexOf(mod12(lastQ.m)) >= 0, t: `Tip: end the question on a note of V (${cs[3].notes.join(' ')}) so it sounds open`, soft: true },
      { ok: !!last && l5Pcs(cs[7]).indexOf(mod12(last.m)) >= 0, t: `Tip: end the answer on a note of I (${cs[7].notes.join(' ')}), best of all ${cs[7].notes[0]}`, soft: true }
    ];
  }
  function paint(on) {
    paintBars(on);
    const ch = checks(), n = all().length;
    checksEl.innerHTML = ch.map(c => `<li class="${c.ok ? 'ok' : c.soft ? 'soft' : ''}">${c.ok ? '✓' : c.soft ? '·' : '○'} ${c.t}</li>`).join('');
    bPlay.disabled = !n || recording; bClear.disabled = !n || recording;
    bSave.disabled = recording || saved || !(ch[0].ok && ch[1].ok);
    el.querySelectorAll('[data-g] .choice, #l5-seed, [data-act="useseed"]').forEach(b => { b.disabled = recording; });
    rng.disabled = recording;
  }
  function build() {
    const ns = all(), s = spb();
    const notes = ns.map((n, i) => ({ m: n.m, t: n.t, d: +Math.min(2 * s, Math.max(0.15, (ns[i + 1] ? ns[i + 1].t : n.t + 2 * s) - n.t)).toFixed(3) }));
    const out = { name: nameIn.value.trim() || `Piece in ${K().label}`, notes, chords: l5Bars(chords8(), bpm, 4), key: K().label, bpm, level: 5, prompt: 'Your 8-bar piece: a question (bars 1–4, ending on V) and an answer (bars 5–8, ending on I)' };
    if (seedId) out.from = seedId;
    return out;
  }
  function stopRec(ended) {
    recording = false;
    if (eng) eng.stop();
    eng = null; bRec.textContent = '● Record again';
    paint();
    const ch = checks();
    fb(f, ch[0].ok && ch[1].ok ? 'good' : 'info', ended ? (ch[0].ok && ch[1].ok ? 'Eight bars done. Play it back, name it and save it.' : 'Eight bars done. Record again to fill both halves.') : 'Stopped. Play it back, or record again.');
  }
  el.querySelectorAll('[data-g]').forEach(g => {
    g.onclick = ev => {
      const b = ev.target.closest('.choice'); if (!b || recording) return;
      if (g.dataset.g === 'key') keyI = +b.dataset.i; else planI = +b.dataset.i;
      g.querySelectorAll('.choice').forEach(x => x.setAttribute('aria-pressed', x === b));
      saved = false; paint();
      l5PlayProg(chords8().slice(g.dataset.g === 'key' ? 0 : 4, g.dataset.g === 'key' ? 4 : 8), 0.6);
    };
  });
  const sel = el.querySelector('#l5-seed');
  if (sel) {
    const pick = () => sk.find(s => s.id === sel.value);
    el.querySelector('[data-act="hearseed"]').onclick = () => { const s = pick(); if (s) playSketch(s); };
    el.querySelector('[data-act="useseed"]').onclick = () => {
      const s = pick(); if (!s || !s.notes || !s.notes.length) return;
      seedId = s.id; seedRaw = s.notes.map(n => ({ m: n.m, t: n.t || 0 })); saved = false;
      const sh = seedShift();
      paint(); fb(f, 'good', `“${s.name}” opens bar 1${sh ? `, moved ${sh > 0 ? 'up' : 'down'} ${Math.abs(sh)} half step${Math.abs(sh) > 1 ? 's' : ''} to fit ${K().label}` : ''}. Record to grow it into a question and an answer.`);
    };
  }
  rng.oninput = () => { bpm = +rng.value; bpmTxt.textContent = bpm + ' BPM'; paint(); };
  bRec.onclick = () => {
    if (recording) { stopRec(false); return; }
    rec = []; recording = true; saved = false; bRec.textContent = '■ Stop';
    eng = l5Engine({
      chords: chords8(), bpm, beats: 4, countIn: 4, bars: 8,
      onStart() { const s = seedNotes(); eng.onBus(() => s.forEach(n => Sound.tone(n.m, eng.startT + n.t, 0.4, 0.75))); },
      onCount(n) { fb(f, 'info', `${n}…`); },
      onChord(i) { paint(i); if (i === 0) fb(f, 'info', 'Bar 1. Play.'); else if (i === 4) fb(f, 'info', 'Bar 5: the answer. Start it like the question.'); },
      onEnd() { stopRec(true); }
    });
    if (!eng.start()) { recording = false; eng = null; bRec.textContent = '● Record over the loop'; fb(f, 'bad', 'This browser has no Web Audio, so the loop can’t play.'); return; }
    paint();
  };
  bPlay.onclick = () => playSketch(build());
  bClear.onclick = () => { rec = []; seedRaw = []; seedId = null; saved = false; paint(); fb(f, 'info', 'Cleared.'); };
  bSave.onclick = () => {
    const s = saveSketch(build());
    saved = true; paint();
    fb(f, 'good', `Saved “${s.name}” to your sketchbook, with its chords, key and tempo.`);
    done(true);
  };
  const off = Bus.on('note', d => {
    if (!recording || !eng) return;
    const t = (d.t != null ? d.t : Sound.now()) - eng.startT;
    if (t < -0.3) { fb(f, 'info', 'Wait for bar 1. The clicks count you in.'); return; }
    if (t >= 8 * bar()) return;
    rec.push({ m: d.midi, t: +Math.max(0, t).toFixed(3) });
    paint(Math.min(7, Math.floor(Math.max(0, t) / bar())));
  });
  paint();
  return () => { off(); if (eng) eng.stop(); eng = null; };
};

/* Daily Set "Create" for Level 5: the motif recorder under a looping I–V–vi–IV in C.
   Used when the Daily Set honours create.task (see the Level 5 notes); otherwise the plain recorder runs. */
Tasks.l5LoopMotif = (el, p, done) => {
  el.innerHTML = '<div class="l5-loop-slot"></div><div class="l5-motif"></div>';
  const loop = l5Loop(el.querySelector('.l5-loop-slot'), { chords: l5Prog(['I', 'V', 'vi', 'IV'], 'C'), bpm: 84 });
  const inner = Tasks.motif(el.querySelector('.l5-motif'), p, done);
  return () => { inner(); loop.destroy(); };
};

/* ---------- card widgets (mount) ---------- */
function l5RotationWidget(el) {
  el.innerHTML = `<div class="choices" data-g="rot">${L5_ROT.map((id, i) => `<button type="button" class="choice" data-id="${id}" aria-pressed="${i === 0}">${l5Dash(l5ProgById(id).romans)}</button>`).join('')}</div><div class="l5-loop-slot"></div><p class="l5-songs"></p>`;
  const songs = el.querySelector('.l5-songs');
  const loop = l5Loop(el.querySelector('.l5-loop-slot'), { chords: l5Prog(l5ProgById('pop').romans, 'G'), bpm: 92 });
  const show = id => { const pr = l5ProgById(id); songs.innerHTML = `<b>${pr.name}</b>: ${l5List(pr.songs.map(s => `<i>${s}</i>`))}.`; };
  el.querySelector('[data-g]').onclick = ev => {
    const b = ev.target.closest('[data-id]'); if (!b) return;
    el.querySelectorAll('[data-g] .choice').forEach(x => x.setAttribute('aria-pressed', x === b));
    loop.setChords(l5Prog(l5ProgById(b.dataset.id).romans, 'G')); show(b.dataset.id);
  };
  show('pop');
  return () => loop.destroy();
}
function l5BluesWidget(el) {
  const loop = l5Loop(el, { chords: l5Prog(l5ProgById('blues').romans, 'C'), bpm: 100, grid: true });
  return () => loop.destroy();
}
function l5CadenceWidget(el) {
  const keys = ['C', 'G', 'F', 'D', 'A', 'B♭'];
  let n = 0;
  el.innerHTML = `<div class="l5-btns">${L5_CADENCES.map((c, i) => `<button type="button" class="btn small" data-c="${i}">▶ ${c.name} (${c.short})</button>`).join('')}</div><p class="l5-note" aria-live="polite">Each press moves to a new key.</p>`;
  const note = el.querySelector('.l5-note');
  el.querySelector('.l5-btns').onclick = ev => {
    const b = ev.target.closest('[data-c]'); if (!b) return;
    const c = L5_CADENCES[+b.dataset.c], key = keys[n++ % keys.length], chords = l5Prog(c.romans, key);
    l5PlayProg(chords, 0.85);
    note.textContent = `${c.name} in ${key} major: ${l5Dash(chords.map(x => x.roman))} (${l5Syms(chords)}). ${c.what}`;
  };
}
function l5CircleWidget(el) {
  el.innerHTML = '<div class="l5-cx"><div class="l5-circle"></div><div class="l5-cx-side"><p class="l5-cx-line" aria-live="polite"></p><div class="row"><button type="button" class="btn small" data-act="hearkey">▶ Hear I–IV–V–I here</button></div></div></div>';
  let pos = 0;
  const line = el.querySelector('.l5-cx-line');
  const chords = () => l5Prog(['I', 'IV', 'V', 'I'], Theory.CIRCLE[pos]);
  const paint = () => {
    const key = Theory.CIRCLE[pos], minors = l5Prog(['ii', 'iii', 'vi'], key);
    line.innerHTML = `<b>${key} major</b>. I–IV–V–I: ${chords().map(c => l5P(c.sym)).join(' – ')}.<br>The minor chords inside: ${minors.map(c => `${c.roman} ${l5P(c.sym)}`).join(', ')}.`;
  };
  const ctl = Circle.mount(el.querySelector('.l5-circle'), { selected: 0, family: true }, p => { pos = p; ctl.update({ selected: p }); paint(); l5PlayProg(chords(), 0.7); });
  el.querySelector('[data-act="hearkey"]').onclick = () => l5PlayProg(chords(), 0.7);
  paint();
  return () => ctl.destroy();
}
function l5DynWidget(el) {
  el.innerHTML = `<div class="l5-btns">${L5_DYN.map(d => `<button type="button" class="btn small" data-v="${d.v}"><span class="l5-it">${d.s}</span> ${d.name}</button>`).join('')}<button type="button" class="btn small" data-ramp="up">▶ crescendo</button><button type="button" class="btn small" data-ramp="down">▶ diminuendo</button></div>`;
  el.firstChild.onclick = ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.ramp) l5PlayRamp(b.dataset.ramp === 'up' ? 0.08 : 1, b.dataset.ramp === 'up' ? 1 : 0.08); else l5PlayDyn(+b.dataset.v);
  };
}
function l5ArticWidget(el) {
  el.innerHTML = `<div class="l5-btns">${['staccato', 'legato', 'accent'].map(k => `<button type="button" class="btn small" data-k="${k}">▶ ${k}</button>`).join('')}</div>`;
  el.firstChild.onclick = ev => { const b = ev.target.closest('[data-k]'); if (b) l5PlayArtic(b.dataset.k); };
}
function l5TempoWidget(el) {
  el.innerHTML = `<div class="l5-btns">${L5_TEMPI.map(t => `<button type="button" class="btn small" data-bpm="${t.bpm}">▶ ${t.w} <span class="mono">${t.bpm}</span></button>`).join('')}</div>`;
  el.firstChild.onclick = ev => { const b = ev.target.closest('[data-bpm]'); if (b) l5PlayTempo(+b.dataset.bpm); };
}
function l5PeriodWidget(el) {
  el.innerHTML = `<div class="l5-btns"><button type="button" class="btn small" data-part="q">▶ Question (bars 1–4)</button><button type="button" class="btn small" data-part="a">▶ Answer (bars 5–8)</button><button type="button" class="btn small primary" data-part="all">▶ The whole period</button></div>`;
  el.firstChild.onclick = ev => { const b = ev.target.closest('[data-part]'); if (b) l5PlayPeriod(b.dataset.part); };
}

/* ---------- units ---------- */
const l5Table = (head, rows) => `<div class="tbl-wrap"><table class="tbl"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const L5_UNITS = [
  { id: '5.1', title: 'Home, away, tension', blurb: 'Three chords, three feelings.', steps: [
    { k: 'card', tag: 'Hear', title: 'Leave home, come back', play: () => l5PlayProg(l5Prog(['I', 'IV', 'V', 'I'], 'C'), 1.1), playLabel: 'Play C, F, G, C', body: '<p>Four chords in C. Listen to how each one feels.</p><p>The first is settled. The second drifts away. The third leans forward, as if it can’t wait. The last one lands, and the trip is over.</p>' },
    { k: 'task', tag: 'Echo', type: 'l5Follow', p: { key: 'C', romans: ['I', 'IV', 'V', 'I'], tones: true, prompt: 'Play each chord as it comes up. Tap its three notes together, or strum it with the mic on. The app follows you.' } },
    { k: 'card', tag: 'Name', title: 'Home, away, tension', art: l5TsdArt, body: '<p>Every chord in a key has a job. The three big ones:</p><p><b>Tonic</b> (I) is home: settled, nothing left to say. <b>Subdominant</b> (IV) moves away from home. <b>Dominant</b> (V) is tension: it pulls hard back to I.</p><p>Why V pulls: G B D has B in it, a half step below C. Your ear wants that B to step up.</p><div class="hook"><b>T → S → D → T</b>: home, away, tension, home. Most music makes this trip again and again.</div>' },
    { k: 'task', tag: 'Explore', type: 'quiz', p: { rounds: 4, pass: 3, prompt: 'Is the last chord home, away or tension?', gen: l5StopItem, passMsg: 'Your ear knows the three jobs.' } },
    { k: 'task', tag: 'Create', type: 'l5Builder', p: { key: 'C', prompt: 'Plan your own trip: four chords that start and end at home. Tap the numerals, then hear it.' } }
  ] },
  { id: '5.2', title: 'The four-chord loop', blurb: 'Four chords, thousands of songs.', steps: [
    { k: 'card', tag: 'Hear', title: 'One loop, many songs', play: () => { const c = l5Prog(l5ProgById('pop').romans, 'G'); return l5PlayProg(c.concat(c), 0.8); }, playLabel: 'Play G, D, Em, C', body: `<p>Four chords, round and round: G, D, E minor, C. If it sounds familiar, that is because thousands of songs use it.</p><p>You can hear it in ${l5Songs('pop')}.</p>` },
    { k: 'task', tag: 'Echo', type: 'l5Follow', p: { key: 'G', romans: ['I', 'V', 'vi', 'IV'], tones: true, prompt: 'Play the loop in G, one chord at a time. Em is the minor one.' } },
    { k: 'card', tag: 'Explore', title: 'Start in a different place', mount: l5RotationWidget, body: '<p>Start the loop, then choose where it begins. The chords stay the same; only the starting point moves.</p><p>Hear how starting on the minor chord, vi, makes the same loop darker.</p>' },
    { k: 'card', tag: 'Name', title: 'Three loops from four chords', body: '<p>Call the chords by number and the loop works in every key. Here each one is shown in G.</p>' + l5Table(['Loop', 'Songs'], L5_ROT.map(id => { const pr = l5ProgById(id); return [`<b class="l5-nw">${l5Dash(pr.romans)}</b><br><span class="l5-nw mono">${l5Syms(l5Prog(pr.romans, 'G'))}</span>`, l5List(pr.songs.map(s => `<i>${s}</i>`))]; })) + '<div class="hook"><b>I–V–vi–IV</b> is the four-chord loop. Start it on vi for <b>vi–IV–I–V</b> (<i>Zombie</i>); swap the middle for <b>I–vi–IV–V</b> (<i>Stand By Me</i>).</div>' },
    { k: 'task', tag: 'Explore', type: 'quiz', p: { rounds: 4, pass: 3, prompt: 'Which loop is it?', gen: l5LoopItem } }
  ] },
  { id: '5.3', title: 'Twelve-bar blues', blurb: 'Twelve bars, three chords, one blue note.', steps: [
    { k: 'card', tag: 'Hear', title: 'Twelve bars', mount: l5BluesWidget, body: '<p>Start the loop and count the bars as the chords change: four on C7, two on F7, two on C7, then G7, F7, C7, G7. Then round again.</p><p>That is the <b>twelve-bar blues</b>, the shape behind rock ’n’ roll as well as the blues.</p>' },
    { k: 'card', tag: 'Name', title: 'I I I I · IV IV I I · V IV I V', art: () => l5BarsArt(l5Prog(l5ProgById('blues').romans, 'C')), body: `<p>Three lines of four bars, built from I, IV and V.</p><p>Each chord is a <b>dominant 7th</b>: a major chord plus one more note, a ♭7 (recipe 4 + 3 + 3). C7 is C E G B♭. That extra note gives the bluesy, restless sound.</p><p>You can hear it in ${l5Songs('blues')}.</p>` },
    { k: 'task', tag: 'Echo', type: 'l5Follow', p: { key: 'C', romans: ['I7', 'IV7', 'V7'], tones: true, prompt: 'Play the three blues chords. Each has four notes.' } },
    { k: 'card', tag: 'Name', title: 'The blues scale', marks: Theory.scale('C', 'blues').map(Theory.pc), play: () => Sound.seq(Theory.scale('C4', 'blues', true).map((n, i) => ({ m: Theory.midi(n), t: i * 0.32, d: 0.3 }))), playLabel: 'Play the C blues scale', body: `<p>Six notes that sound right over all three chords: ${Theory.scale('C', 'blues').join(' ')}. They glow on the keys.</p><div class="hook"><b>Blues scale: 1 ♭3 4 ♭5 5 ♭7</b> (half steps ${Theory.recipe('blues').join('-')}). Leave out ♭5, the <b>blue note</b>, and you have the minor pentatonic: 1 ♭3 4 5 ♭7.</div>` },
    { k: 'task', tag: 'Echo', type: 'playSeq', p: { prompt: 'Play the C blues scale up to the next C.', notes: Theory.scale('C4', 'blues', true), mark: true, endText: `${Theory.scale('C', 'blues').join(' ')} C: the blues scale.` } },
    { k: 'task', tag: 'Create', type: 'l5Radar', p: { kind: 'scale', scale: 'blues', key: 'C', romans: l5ProgById('blues').romans, bpm: 100, need: 12, share: 0.75, prompt: 'Start the loop and improvise with the C blues scale. Green notes are in the scale; red ones are outside. Repeat a note, bend toward the blue note, leave gaps.' } }
  ] },
  { id: '5.4', title: 'ii–V–I and the Canon', blurb: 'The jazz cadence and a 300-year-old loop.', steps: [
    { k: 'card', tag: 'Hear', title: 'The jazz cadence', play: () => l5PlayProg(l5Prog(['ii7', 'V7', 'Imaj7'], 'C'), 1.2), playLabel: 'Play Dm7, G7, Cmaj7', body: `<p>Three 7th chords that sound like a question, a lean and a smile: D minor 7, G7, C major 7.</p><p>Jazz players call it the <b>ii–V–I</b>. You can hear it in ${l5Songs('jazz')}.</p>` },
    { k: 'task', tag: 'Echo', type: 'l5Follow', p: { key: 'C', romans: ['ii7', 'V7', 'Imaj7'], tones: true, prompt: 'Play the ii–V–I in C. Four notes each.' } },
    { k: 'card', tag: 'Name', title: 'Falling fifths', art: () => Circle.svg({ selected: 0, static: true, marks: { 2: 'ok', 1: 'ok' }, center: ['ii → V → I', 'D → G → C'] }), body: '<p>Look at the roots: D, G, C. Each is a 5th below the one before. On the circle that is one step anticlockwise, then another, and you are home.</p><p>That is why ii–V–I feels so strong: ii leads to V the same way V leads to I.</p>' },
    { k: 'card', tag: 'Hear', title: 'Pachelbel’s Canon', play: () => l5PlayProg(l5Prog(l5ProgById('canon').romans, 'D'), 0.9), playLabel: 'Play the Canon in D', body: `<p>Around 1700, Johann Pachelbel wrote a piece over eight chords that repeat again and again: <b>${l5Dash(l5ProgById('canon').romans)}</b>. In D that is ${l5Syms(l5Prog(l5ProgById('canon').romans, 'D'))}.</p><p>The same chords still turn up today, in ${l5Songs('canon', 'Canon in D')}.</p>` },
    { k: 'task', tag: 'Echo', type: 'l5Follow', p: { key: 'D', romans: l5ProgById('canon').romans, tones: true, prompt: 'Play the Canon’s eight chords in D. The notes under each name help.' } }
  ] },
  { id: '5.5', title: 'Cadences', blurb: 'Full stop, comma, Amen and surprise.', steps: [
    { k: 'card', tag: 'Hear', title: 'Four ways to stop', mount: l5CadenceWidget, body: '<p>Music has punctuation. The last two chords of a phrase are its <b>cadence</b>: they tell you whether the sentence is over.</p><p>Play each one. Every press moves to a new key, so you hear the shape, not the notes.</p>' },
    { k: 'card', tag: 'Name', title: 'Cadences are punctuation', body: l5Table(['Cadence', 'Chords', 'Sounds like'], [['<b>Authentic</b>', 'V–I', 'A full stop. Finished.'], ['<b>Plagal</b>', 'IV–I', 'The “Amen” at the end of a hymn.'], ['<b>Half</b>', 'ends on V', 'A comma or a question mark: more to come.'], ['<b>Deceptive</b>', 'V–vi', 'A twist: you expect home and get a surprise.']]) + '<div class="hook"><b>Cadences are punctuation marks</b>: full stop V–I, Amen IV–I, comma …–V, twist V–vi.</div>' },
    { k: 'task', tag: 'Echo', type: 'l5Follow', p: { key: 'C', romans: ['V', 'I', 'V', 'vi'], tones: true, prompt: 'Play a full stop, then a twist: V–I, then V–vi.' } },
    { k: 'task', tag: 'Explore', type: 'quiz', p: { rounds: 6, pass: 4, prompt: 'Which cadence? Each one is in a new key.', gen: () => l5CadenceItem(), passMsg: 'You can hear how a phrase ends.' } }
  ] },
  { id: '5.6', title: 'Transpose anything', blurb: 'Keep the numbers, change the key.', steps: [
    { k: 'card', tag: 'Hear', title: 'Same trip, new key', play: () => l5PlayProg(l5Prog(['I', 'IV', 'V', 'I'], 'C').concat(l5Prog(['I', 'IV', 'V', 'I'], 'D')), 0.9), playLabel: 'Play it in C, then in D', body: '<p>I–IV–V–I twice: first in C, then in D. The second is higher, but the shape and the feeling are the same.</p><p>Moving music to a new key is called <b>transposing</b>.</p>' },
    { k: 'card', tag: 'Explore', title: 'Find the chords on the circle', mount: l5CircleWidget, body: '<p>Tap any key. Its I sits in the middle of the lit slice, IV on its left, V on its right. The three minor chords inside them are ii, vi and iii.</p><div class="hook"><b>Keep the numbers, change the key.</b> I–IV–V–I is the same trip everywhere; the circle tells you the letters.</div>' },
    { k: 'task', tag: 'Echo', type: 'l5Follow', p: { key: 'D', romans: ['I', 'IV', 'V', 'I'], tones: true, art: Circle.svg({ selected: Theory.circlePos('D'), family: true, static: true }), prompt: 'Play I–IV–V–I in D. The slice of the circle shows where each chord lives.' } },
    { k: 'task', tag: 'Explore', type: 'l5Follow', p: { key: 'F', romans: ['I', 'IV', 'V', 'I'], art: Circle.svg({ selected: Theory.circlePos('F'), family: true, static: true }), prompt: 'Now F major, without note names. Read the chords off the slice.' } },
    { k: 'card', tag: 'Name', title: 'A note for guitarists: the capo', body: '<p>A <b>capo</b> clamps across all six strings and raises every chord. One fret is one half step, so a capo on fret 2 turns your C shape into a D chord.</p>' + l5Table(['Capo on fret', 'C shape sounds', 'G shape sounds'], ['b2', '2', 'b3', '3', '4'].map((d, i) => [String(i + 1), Theory.up('C', d), Theory.up('G', d)])) + '<p>So a song in E♭ can be played with easy C shapes and the capo on fret 3.</p>' },
    { k: 'task', tag: 'Explore', type: 'quiz', p: { rounds: 5, pass: 4, prompt: 'Numbers into chords, using the slice.', gen: () => l5NumItem(rand(['G', 'D', 'A', 'F', 'B♭', 'E♭']), rand(['I', 'IV', 'V', 'vi', 'ii', 'iii']), true) } }
  ] },
  { id: '5.7', title: 'Melody meets chords', blurb: 'Chord tones on strong beats, passing notes between.', steps: [
    { k: 'card', tag: 'Hear', title: 'A tune that fits', art: l5TuneStaff, play: () => playSketch({ notes: l5Melody(L5_TUNE.notes, L5_TUNE.bpm), chords: l5Bars(l5Prog(L5_TUNE.romans, L5_TUNE.key), L5_TUNE.bpm, 4) }), playLabel: 'Play the tune with chords', body: '<p>A short tune over C, G, Am and F. Listen to how it sits on the chords.</p><p>On beats 1 and 3, the strong beats, every note belongs to the chord underneath (green). The notes between just walk from one to the next.</p>' },
    { k: 'card', tag: 'Name', title: 'Chord tones and passing notes', body: '<p><b>Chord tones</b> are the notes of the chord that is playing. Put them on strong beats and the tune sounds anchored.</p><p><b>Passing notes</b> are other notes of the key that step between chord tones. On a weak beat they add motion without a clash.</p><p>Notes from outside the key clash, unless they move on quickly.</p>' },
    { k: 'task', tag: 'Explore', type: 'l5Radar', p: { kind: 'radar', key: 'C', romans: ['I', 'V', 'vi', 'IV'], bpm: 84, need: 16, share: 0.75, tones: 4, prompt: 'Start the loop and improvise. The chord-tone radar lights each note: green is in the chord, blue is in the key, red is outside. Play about 16 notes.' } },
    { k: 'task', tag: 'Create', type: 'l5Radar', p: { kind: 'radar', key: 'C', romans: ['I', 'V', 'vi', 'IV'], bpm: 76, landings: 4, prompt: 'Land on the chord: each time the chord changes, make your first note green. Walk with any notes between. Four changes in a row.' } }
  ] },
  { id: '5.8', title: 'Dynamics, tempo and articulation', blurb: 'How loud, how fast, how smooth.', steps: [
    { k: 'card', tag: 'Hear', title: 'Soft and strong', mount: l5DynWidget, body: '<p>The same notes can whisper or shout. Play each level, then the two hairpins: one grows, one fades.</p>' },
    { k: 'card', tag: 'Name', title: 'Dynamics', art: l5HairpinSVG, body: l5Table(['Mark', 'Italian', 'Means'], L5_DYN.map(d => [`<span class="l5-it">${d.s}</span>`, d.name, d.say]).concat([['&lt;', 'crescendo', 'getting louder'], ['&gt;', 'diminuendo', 'getting softer']])) + '<div class="hook"><b>Piano = quiet, forte = strong.</b> Mezzo means “medium”: mp is a little louder than p, mf a little softer than f.</div>' },
    { k: 'task', tag: 'Explore', type: 'l5Crescendo', p: {} },
    { k: 'card', tag: 'Hear', title: 'Short, smooth, strong', mount: l5ArticWidget, art: l5ArticSVG, body: '<p><b>Articulation</b> is how each note starts and ends.</p><p><b>Staccato</b> (a dot): short and detached. <b>Legato</b> (a curved slur): smooth, each note joined to the next. <b>Accent</b> (&gt;): lean on that note, stronger than the rest.</p>' },
    { k: 'card', tag: 'Name', title: 'Tempo words', mount: l5TempoWidget, body: '<p>Tempo words are Italian too. Each one covers a range of speeds; these are typical.</p>' + l5Table(['Word', 'About', 'Feels'], L5_TEMPI.map(t => [`<b>${t.w}</b>`, t.bpm + ' BPM', t.d])) },
    { k: 'task', tag: 'Explore', type: 'quiz', p: { rounds: 4, pass: 3, prompt: 'Name the tempo by ear.', gen: l5TempoItem } }
  ] },
  { id: '5.9', title: 'Phrases, periods and form', blurb: 'Question, answer, and how songs are built.', steps: [
    { k: 'card', tag: 'Hear', title: 'A question and an answer', mount: l5PeriodWidget, art: () => l5BarsArt(l5Prog(L5_PERIOD.q.concat(L5_PERIOD.a), 'C'), { 3: 'half cadence', 7: 'authentic' }, ['Question', 'Answer']), body: '<p>Eight bars in C. The first four end up in the air. The next four start the same way, then come home.</p>' },
    { k: 'card', tag: 'Name', title: 'Question + answer = a period', body: '<p>A <b>phrase</b> is a musical sentence, often four bars long. It ends with a cadence.</p><p>The <b>question</b> (bars 1–4) ends on V, a half cadence: a comma. The <b>answer</b> (bars 5–8) ends on I, an authentic cadence: a full stop. Together they make a <b>period</b>.</p><p>The answer starts like the question. That repetition makes a tune easy to remember; the new ending is the contrast.</p>' },
    { k: 'task', tag: 'Explore', type: 'quiz', p: { rounds: 4, pass: 3, prompt: 'Question or answer? Listen to where it stops.', gen: l5PhraseItem } },
    { k: 'card', tag: 'Name', title: 'How songs are built', art: () => l5FormArt() + l5RepeatSVG(), body: '<p>Songs are built from <b>repetition</b> (a part comes back) and <b>contrast</b> (something new).</p><p><b>AABA</b>: a tune, the tune again, something different, the tune once more. <b>Verse and chorus</b>: verses tell the story with new words; the chorus comes back the same each time.</p><p><b>Repeat signs</b> ‖: and :‖ mean play the music between them twice. With <b>1st and 2nd endings</b>, play the 1st ending the first time; on the repeat, skip it and take the 2nd.</p>' },
    { k: 'task', tag: 'Explore', type: 'quiz', p: () => { const qs = shuffle(L5_FORM_QS).slice(0, 4); return { rounds: 4, pass: 3, prompt: 'Read the form.', gen: i => qs[i] }; } }
  ] },
  { id: '5.P', title: 'Your 8-bar piece', blurb: 'Grow your motif into a question and an answer.', create: true, steps: [
    { k: 'card', tag: 'Name', title: 'Eight bars, two halves', body: '<p>This is where your motif has been heading since Level 1. You will make an 8-bar piece:</p><p><b>Bars 1–4, the question</b>, end on V. <b>Bars 5–8, the answer</b>, end on I.</p><p>Pick a key and a set of chords, start from one of your sketches if you like, and record a melody over the loop. Chord tones on strong beats, steps between. Save it when it sounds like yours.</p>' },
    { k: 'task', tag: 'Create', type: 'l5Piece', p: { prompt: 'Choose a key and chords, then record your melody over the loop.' } },
    { k: 'card', tag: 'Hear', title: 'Play it to someone', play: () => { const s = (Store.data.sketches || []).find(x => x.level === 5 && x.chords); if (s) playSketch(s); else toast('No 8-bar piece saved yet.'); }, playLabel: 'Play my piece', body: '<p>Your piece is in the sketchbook with its chords, key and tempo. One idea, grown from a few notes into a question and an answer.</p>' }
  ] },
  { id: '5.B', title: 'Final boss', blurb: 'Progressions, cadences and the circle. Pass it to finish the beginner section.', boss: true, steps: [
    { k: 'card', tag: 'Name', title: 'The last challenge', body: '<p>Three parts, no skipping. The keys alone are enough.</p><p><b>Part 1</b>: play I–IV–V–I in the key shown, from the numerals alone. 10 seconds per chord.</p><p><b>Part 2</b>: name 6 cadences by ear. You need 5.</p><p><b>Part 3</b>: turn numbers into chords in three keys, using the circle. You need 5 of 6.</p>' },
    { k: 'task', tag: 'Echo', type: 'l5Follow', p: () => { const key = rand(['C', 'G', 'F', 'D']); return { key, romans: ['I', 'IV', 'V', 'I'], hideSyms: true, hear: false, limit: 10, prompt: `Play I–IV–V–I in ${key} major.`, passMsg: 'Part 1 passed.' }; } },
    { k: 'task', tag: 'Hear', type: 'quiz', p: { rounds: 6, pass: 5, prompt: 'Name each cadence by ear.', gen: () => l5CadenceItem(), passMsg: 'Part 2 passed.' } },
    { k: 'task', tag: 'Name', type: 'quiz', p: () => { const keys = shuffle(['G', 'D', 'A', 'E', 'F', 'B♭', 'E♭']).slice(0, 3), picks = keys.map(() => shuffle(['I', 'IV', 'V', 'vi', 'ii', 'iii']).slice(0, 2)); return { rounds: 6, pass: 5, prompt: 'Find each chord with the circle: IV and V are the neighbours, the minors sit inside.', gen: i => l5NumItem(keys[Math.floor(i / 2)], picks[Math.floor(i / 2)][i % 2], false), passMsg: 'Part 3 passed.' }; } }
  ] }
];

/* ---------- review cards ---------- */
/* { type: 'l5roman', roman, key, mode }: play the named numeral in a key; the chord's letters are not shown */
CARD_TYPES.l5roman = (el, c, fin) => {
  const ch = Theory.romanChord(c.roman, c.key, c.mode);
  return Tasks.playChords(el, { prompt: c.prompt || `Play the ${c.roman} chord in ${Theory.keyName(c.key, c.mode)}.`, chords: [ch.sym], labels: [`${c.roman} in ${c.key}`] }, (ok, r) => fin(r.misses <= 1));
};
/* { type: 'l5prog', romans, key }: play a whole progression from numerals; one wrong chord is allowed */
CARD_TYPES.l5prog = (el, c, fin) => Tasks.l5Follow(el, { key: c.key, mode: c.mode, romans: c.romans, hideSyms: true, hear: false, prompt: c.prompt || `Play ${l5Dash(c.romans)} in ${Theory.keyName(c.key, c.mode)}.` }, (ok, r) => fin(r.misses <= 1));

const L5_CARDS = {
  '5.1': [
    { id: 'l5-home', type: 'choice', q: 'Which chord is home in a major key?', options: ['I', 'IV', 'V'], answer: 0, why: 'I, the tonic, is home.' },
    { id: 'l5-tsdt', type: 'choice', q: 'Home, away, tension, home: T → S → D → T in numerals is…', options: ['I–IV–V–I', 'I–V–IV–I', 'IV–I–V–IV'], answer: 0, why: 'Tonic I, subdominant IV, dominant V, back to I.' },
    { id: 'l5-iv-c', type: 'l5roman', roman: 'IV', key: 'C' },
    { id: 'l5-v-c', type: 'l5roman', roman: 'V', key: 'C' },
    { id: 'l5-func', type: 'gen', gen() { const key = rand(['C', 'G', 'F', 'D']), r = rand(['I', 'IV', 'V']), c = Theory.romanChord(r, key), i = ['I', 'IV', 'V'].indexOf(r); return { q: `In ${key} major, ${l5P(c.sym)} is…`, options: ['Tonic: home', 'Subdominant: away', 'Dominant: tension'], answer: i, why: `${l5P(c.sym)} is ${r} in ${key}.` }; } }
  ],
  '5.2': [
    { id: 'l5-pop', type: 'choice', q: '<i>Let It Be</i> and <i>Someone Like You</i> loop which chords?', options: ['I–V–vi–IV', 'I–IV–V–I', 'ii–V–I'], answer: 0, why: 'The four-chord loop: I–V–vi–IV.' },
    { id: 'l5-zombie', type: 'choice', q: '<i>Zombie</i> starts the four-chord loop on its minor chord. The order is…', options: ['vi–IV–I–V', 'I–vi–IV–V', 'IV–V–I–vi'], answer: 0, why: 'vi–IV–I–V: the same four chords, starting on vi.' },
    { id: 'l5-stand', type: 'choice', q: '<i>Stand By Me</i> uses the ’50s loop…', options: ['I–V–vi–IV', 'I–vi–IV–V', 'vi–IV–I–V'], answer: 1, why: 'I–vi–IV–V, the doo-wop loop.' },
    { id: 'l5-vi-g', type: 'l5roman', roman: 'vi', key: 'G' },
    { id: 'l5-pop-g', type: 'l5prog', romans: ['I', 'V', 'vi', 'IV'], key: 'G' }
  ],
  '5.3': [
    { id: 'l5-blues-56', type: 'choice', q: 'In a twelve-bar blues, bars 5 and 6 are on…', options: ['I7', 'IV7', 'V7'], answer: 1, why: 'I I I I · IV IV I I · V IV I V.' },
    { id: 'l5-blues-scale', type: 'seq', prompt: 'Play the C blues scale up to C. Recipe: 1 ♭3 4 ♭5 5 ♭7 8.', notes: Theory.scale('C4', 'blues', true), show: 'hidden' },
    { id: 'l5-blue-note', type: 'choice', q: 'The blues scale is the minor pentatonic plus one note. Which?', options: ['♭5', '♭6', '7'], answer: 0, why: '1 ♭3 4 ♭5 5 ♭7: the ♭5 is the blue note.' },
    { id: 'l5-v7-c', type: 'l5roman', roman: 'V7', key: 'C' },
    { id: 'l5-blues-bar', type: 'gen', gen() { const R = l5ProgById('blues').romans, b = randInt(0, 11), opts = ['I7', 'IV7', 'V7']; return { q: `In a twelve-bar blues, which chord is bar ${b + 1}?`, options: opts, answer: opts.indexOf(R[b]), why: 'I I I I · IV IV I I · V IV I V.' }; } }
  ],
  '5.4': [
    { id: 'l5-251-c', type: 'l5prog', romans: ['ii7', 'V7', 'Imaj7'], key: 'C' },
    { id: 'l5-251-gen', type: 'gen', gen() { const key = rand(['F', 'G', 'D', 'B♭']), right = l5Syms(l5Prog(['ii7', 'V7', 'Imaj7'], key)), wrong = [l5Syms(l5Prog(['IV', 'V7', 'I'], key)), l5Syms(l5Prog(['vi', 'ii7', 'V7'], key))], opts = shuffle([right].concat(wrong)); return { q: `ii–V–I in ${key} is…`, options: opts, answer: opts.indexOf(right), why: `ii7 V7 Imaj7 in ${key}: ${right}.` }; } },
    { id: 'l5-canon', type: 'choice', q: 'Pachelbel’s Canon runs…', options: ['I–V–vi–iii–IV–I–IV–V', 'I–IV–V–I–I–IV–V–I', 'vi–IV–I–V–vi–IV–I–V'], answer: 0, why: 'Eight chords, I–V–vi–iii–IV–I–IV–V.' },
    { id: 'l5-251-why', type: 'choice', q: 'In ii–V–I the roots move by…', options: ['Falling 5ths, anticlockwise on the circle', 'Half steps up', 'Rising 3rds'], answer: 0, why: 'D → G → C: each a 5th down.' }
  ],
  '5.5': [
    { id: 'l5-cad-ear-1', type: 'gen', gen: () => l5CadenceItem() },
    { id: 'l5-cad-ear-2', type: 'gen', gen: () => l5CadenceItem() },
    { id: 'l5-cad-half', type: 'choice', q: 'A half cadence ends on…', options: ['I', 'IV', 'V'], answer: 2, why: 'Ending on V sounds like a comma: more to come.' },
    { id: 'l5-cad-amen', type: 'choice', q: 'Which cadence is the “Amen” at the end of a hymn?', options: ['Authentic', 'Plagal', 'Deceptive'], answer: 1, why: 'Plagal: IV–I.' },
    { id: 'l5-cad-dec', type: 'choice', q: 'V moving to vi instead of I is…', options: ['An authentic cadence', 'A half cadence', 'A deceptive cadence'], answer: 2, why: 'Deceptive: you expect home and get vi.' }
  ],
  '5.6': [
    { id: 'l5-tr-d', type: 'l5prog', romans: ['I', 'IV', 'V', 'I'], key: 'D' },
    { id: 'l5-tr-f', type: 'l5prog', romans: ['I', 'IV', 'V', 'I'], key: 'F' },
    { id: 'l5-tr-gen', type: 'gen', gen: () => l5NumItem(rand(['G', 'D', 'A', 'E', 'F', 'B♭', 'E♭']), rand(['IV', 'V', 'vi', 'ii']), false) },
    { id: 'l5-capo', type: 'choice', q: 'Capo on fret 2, C chord shape. Which chord sounds?', options: ['C♯', 'D', 'E'], answer: 1, why: 'Two frets = two half steps: C → D.' },
    { id: 'l5-iv-a', type: 'l5roman', roman: 'IV', key: 'A' }
  ],
  '5.7': [
    { id: 'l5-ct-gen', type: 'gen', gen() { const c = rand(Theory.diatonic('C').slice(0, 6)), pcs = l5Pcs(c), right = rand(c.notes), wrong = shuffle(Theory.scale('C').filter(n => pcs.indexOf(Theory.pc(n)) < 0)).slice(0, 2), opts = shuffle([right].concat(wrong)); return { q: `Over ${l5P(c.sym)}, which note is a chord tone?`, options: opts, answer: opts.indexOf(right), why: `${l5P(c.sym)} is ${c.notes.join(' ')}.` }; } },
    { id: 'l5-strong', type: 'choice', q: 'Where do chord tones do the most good?', options: ['On strong beats', 'Only on the last note', 'Between beats'], answer: 0, why: 'Chord tones on beats 1 and 3 anchor the tune to the chords.' },
    { id: 'l5-passing', type: 'choice', q: 'A passing note…', options: ['Steps between two chord tones', 'Must be outside the key', 'Is always the loudest note'], answer: 0, why: 'It walks by step from one chord tone to the next.' }
  ],
  '5.8': [
    { id: 'l5-dyn-p', type: 'choice', q: '<span class="l5-it">p</span> (piano) means…', options: ['Soft', 'Loud', 'Fast'], answer: 0, why: 'Piano = quiet, forte = strong.' },
    { id: 'l5-dyn-gen', type: 'gen', gen() { const [a, b] = shuffle(L5_DYN).slice(0, 2), louder = L5_DYN.indexOf(a) > L5_DYN.indexOf(b) ? a : b, opts = [a, b]; return { q: 'Which is louder?', options: opts.map(d => `<span class="l5-it">${d.s}</span> ${d.name}`), answer: opts.indexOf(louder), why: 'Softest to loudest: p, mp, mf, f, ff.' }; } },
    { id: 'l5-cresc', type: 'choice', q: 'Crescendo means…', options: ['Getting louder', 'Getting softer', 'Getting faster'], answer: 0, why: 'Crescendo grows; diminuendo fades.' },
    { id: 'l5-stacc', type: 'choice', q: 'Staccato notes are…', options: ['Short and detached', 'Smooth and joined', 'Held extra long'], answer: 0, why: 'A dot over or under the note: short. A slur means legato.' },
    { id: 'l5-tempo-gen', type: 'gen', gen() { const T = rand(L5_TEMPI), opts = shuffle([T].concat(shuffle(L5_TEMPI.filter(x => x !== T)).slice(0, 2))); return { q: `Which tempo word fits about ${T.bpm} BPM?`, options: opts.map(x => x.w), answer: opts.indexOf(T), why: `${T.w}: ${T.d}. Slow to fast: Largo, Andante, Moderato, Allegro, Presto.` }; } }
  ],
  '5.9': [
    { id: 'l5-period', type: 'choice', q: 'A period is…', options: ['A question phrase and an answer phrase', 'Any eight notes', 'A chord with a 7th'], answer: 0, why: 'Question (ends on V) + answer (ends on I).' },
    { id: 'l5-q-end', type: 'choice', q: 'The question phrase of a period ends on…', options: ['I', 'V', 'IV'], answer: 1, why: 'A half cadence on V: a comma.' },
    { id: 'l5-aaba', type: 'choice', q: 'In AABA form, which section brings contrast?', options: ['A', 'B'], answer: 1, why: 'B is the new part between the As.' },
    { id: 'l5-endings', type: 'choice', q: 'In what order do you play these bars?', html: l5RepeatSVG(), options: ['1 2 3 1 2 4', '1 2 3 4', '1 2 4'], answer: 0, why: 'Repeat after the 1st ending; the second time, skip it and take the 2nd.' },
    { id: 'l5-qa-ear', type: 'gen', gen: l5PhraseItem }
  ]
};

addLevel({
  n: 5, title: 'Make It Move', tagline: 'Progressions, cadences, transposing, melody over chords, dynamics and form',
  units: L5_UNITS, cards: L5_CARDS,
  passText: 'You can play I–IV–V–I, the four-chord loop and the blues in any key, hear how a phrase ends, put a melody over chords, read dynamics, tempo and articulation, and shape eight bars into a question and an answer. That is everything a beginner needs.',
  create: {
    task: 'l5LoopMotif',
    params: { pcs: [0, 2, 4, 5, 7, 9, 11], pcsLabel: 'C major', min: 4, max: 12 },
    prompts: [
      'For the loop C–G–Am–F, make a 4-bar melody that starts on E and ends on C.',
      'Make a 4-bar melody where each bar starts on a note of its chord: C, then G, then Am, then F.',
      'Make a 4-bar melody that climbs for two bars and falls for two.',
      'Make a 4-bar question: end it on D, G or B so it sounds unfinished.',
      'Make a 4-bar melody from C, E and G, with one passing note between each pair.',
      'Make a 4-bar melody with one long note in every bar.'
    ]
  },
  ear: {
    title: 'Name the cadence', sub: 'A few chords, then a stop. Which ending was it? Now and then it is a whole loop instead.',
    run(body, finish) {
      return Tasks.quiz(body, { rounds: 5, gen: i => (i === 2 || Math.random() < 0.15 ? l5LoopItem() : l5CadenceItem()) }, (ok, r) => finish(r.score, 5));
    }
  }
});
