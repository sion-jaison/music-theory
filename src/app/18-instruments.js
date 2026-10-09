/* =================================================================
   Instrument data (tool 10): ranges, transpositions and clefs for arranging (Level 10).

   INSTRUMENTS: [{ id, name, short, family, clef, clefs, transpose, range: { low, high }, comfortable: { low, high },
                  names: { low, high }, program, note }]
     transpose: half steps from written to sounding (B♭ clarinet −2: a written D sounds C). sounding = written + transpose.
     range, comfortable: sounding MIDI numbers. names: the range ends spelled, sounding. program: General MIDI (0–127).
     clef: the usual clef; clefs: every clef the part may use, the usual one first.
   Instruments.byId(id)                        → the instrument or null
   Instruments.written(soundingMidi, inst)     → the written MIDI note
   Instruments.sounding(writtenMidi, inst)     → the sounding MIDI note
   Instruments.writtenKey(concertKey, inst, mode) → the key the player reads: concert E♭ → C for alto sax, F for B♭
                                                 instruments. 'E♭', 'Cm' or 'C minor' (or mode 'minor') in, same style out.
   Instruments.checkRange(notes, inst, o)      → [{ i, bar, m, kind, level, text }] in plain sentences
   Instruments.transposeEvents(events, semis, keySig) → score events moved by semis half steps and spelled in the new key
   Instruments.transposeSig(keySig, semis)     → the new key signature (signed count)
   Instruments.part(events, inst, keySig)      → { events, keySig, clef } the written part for a concert-pitch melody
   ================================================================= */
const INS_FAMILY_ORDER = ['Woodwinds', 'Brass', 'Strings', 'Keyboard', 'Voices'];
const INSTRUMENTS = [
  { id: 'piccolo', name: 'piccolo', family: 'Woodwinds', clef: 'treble', transpose: 12, range: ['D5', 'C8'], comfortable: ['G5', 'G7'], program: 72, note: 'Written an octave lower than it sounds, so the part stays on the staff.' },
  { id: 'flute', name: 'flute', family: 'Woodwinds', clef: 'treble', transpose: 0, range: ['C4', 'C7'], comfortable: ['E4', 'A6'], program: 73, note: 'The low octave is soft and breathy; the top is bright and loud.' },
  { id: 'oboe', name: 'oboe', family: 'Woodwinds', clef: 'treble', transpose: 0, range: ['B♭3', 'A6'], comfortable: ['D4', 'E6'], program: 68 },
  { id: 'clarinet', name: 'B♭ clarinet', short: 'clarinet', family: 'Woodwinds', clef: 'treble', transpose: -2, range: ['D3', 'B♭6'], comfortable: ['E3', 'C6'], program: 71, note: 'Sounds a major 2nd lower than written.' },
  { id: 'bassoon', name: 'bassoon', family: 'Woodwinds', clef: 'bass', clefs: ['bass', 'tenor'], transpose: 0, range: ['B♭1', 'E5'], comfortable: ['C2', 'G4'], program: 70, note: 'High passages switch to the tenor clef.' },
  { id: 'altoSax', name: 'alto sax', family: 'Woodwinds', clef: 'treble', transpose: -9, range: ['D♭3', 'A5'], comfortable: ['F3', 'E♭5'], program: 65, note: 'An E♭ instrument: sounds a major 6th lower than written.' },
  { id: 'tenorSax', name: 'tenor sax', family: 'Woodwinds', clef: 'treble', transpose: -14, range: ['A♭2', 'E5'], comfortable: ['C3', 'B♭4'], program: 66, note: 'A B♭ instrument: sounds a major 9th (an octave and a step) lower than written.' },
  { id: 'trumpet', name: 'B♭ trumpet', short: 'trumpet', family: 'Brass', clef: 'treble', transpose: -2, range: ['E3', 'B♭5'], comfortable: ['B♭3', 'F5'], program: 56, note: 'Sounds a major 2nd lower than written.' },
  { id: 'horn', name: 'F horn', short: 'horn', family: 'Brass', clef: 'treble', clefs: ['treble', 'bass'], transpose: -7, range: ['B1', 'F5'], comfortable: ['C3', 'C5'], program: 60, note: 'Sounds a perfect 5th lower than written. Very low notes are written in the bass clef.' },
  { id: 'trombone', name: 'trombone', family: 'Brass', clef: 'bass', clefs: ['bass', 'tenor'], transpose: 0, range: ['E2', 'F5'], comfortable: ['B♭2', 'F4'], program: 57, note: 'Reads at concert pitch; high parts may use the tenor clef.' },
  { id: 'violin', name: 'violin', family: 'Strings', clef: 'treble', transpose: 0, range: ['G3', 'E7'], comfortable: ['G3', 'A6'], program: 40, note: 'G3 is the open bottom string: nothing lower.' },
  { id: 'viola', name: 'viola', family: 'Strings', clef: 'alto', clefs: ['alto', 'treble'], transpose: 0, range: ['C3', 'E6'], comfortable: ['C3', 'A5'], program: 41, note: 'Reads the alto clef, where the middle line is middle C.' },
  { id: 'cello', name: 'cello', family: 'Strings', clef: 'bass', clefs: ['bass', 'tenor', 'treble'], transpose: 0, range: ['C2', 'A5'], comfortable: ['C2', 'E5'], program: 42, note: 'Moves to the tenor clef for high passages.' },
  { id: 'doubleBass', name: 'double bass', family: 'Strings', clef: 'bass', transpose: -12, range: ['E1', 'G4'], comfortable: ['E1', 'D4'], program: 43, note: 'Sounds an octave lower than written.' },
  { id: 'guitar', name: 'guitar', family: 'Strings', clef: 'treble', transpose: -12, range: ['E2', 'B5'], comfortable: ['E2', 'E5'], program: 25, note: 'Written in the treble clef an octave higher than it sounds.' },
  { id: 'bassGuitar', name: 'bass guitar', family: 'Strings', clef: 'bass', transpose: -12, range: ['E1', 'G4'], comfortable: ['E1', 'C4'], program: 33, note: 'Sounds an octave lower than written, like the double bass.' },
  { id: 'piano', name: 'piano', family: 'Keyboard', clef: 'treble', clefs: ['treble', 'bass'], transpose: 0, range: ['A0', 'C8'], comfortable: ['C2', 'C7'], program: 0, note: 'A grand staff: the right hand on the treble, the left on the bass.' },
  { id: 'soprano', name: 'soprano', family: 'Voices', clef: 'treble', transpose: 0, range: ['C4', 'A5'], comfortable: ['E4', 'G5'], program: 52 },
  { id: 'alto', name: 'alto', family: 'Voices', clef: 'treble', transpose: 0, range: ['F3', 'D5'], comfortable: ['G3', 'C5'], program: 52 },
  { id: 'tenor', name: 'tenor', family: 'Voices', clef: 'bass', clefs: ['bass', 'treble'], transpose: 0, range: ['C3', 'A4'], comfortable: ['D3', 'G4'], program: 52, note: 'On the bass staff in four-part writing; a tenor part on its own reads the treble clef an octave up (treble 8vb).' },
  { id: 'bass', name: 'bass', family: 'Voices', clef: 'bass', transpose: 0, range: ['E2', 'E4'], comfortable: ['G2', 'C4'], program: 52 }
];
INSTRUMENTS.forEach(x => {
  x.short = x.short || x.name;
  x.clefs = x.clefs || [x.clef];
  x.names = { low: x.range[0], high: x.range[1] };
  x.range = { low: Theory.midi(x.range[0]), high: Theory.midi(x.range[1]) };
  x.comfortable = { low: Theory.midi(x.comfortable[0]), high: Theory.midi(x.comfortable[1]) };
  x.comfortNames = { low: Theory.fromMidi(x.comfortable.low, true), high: Theory.fromMidi(x.comfortable.high, true) };
});

const insById = id => (id && typeof id === 'object') ? id : (INSTRUMENTS.find(x => x.id === id) || INSTRUMENTS.find(x => x.name === id || x.short === id) || null);
/* the major key with this pitch class and the fewest sharps or flats (ties go to the spelling nearest `steps` letters away) */
function insKeyFor(pc, fromTonic, semis) {
  const want = semis * 7 / 12;
  const fromL = Theory.parse(fromTonic).L;
  const cands = Theory.MAJOR_KEYS.filter(k => Theory.pc(k) === mod12(pc)).map(k => {
    const n = Math.abs(Theory.keySig(k, 'major').n), base = Theory.mod(Theory.parse(k).L - fromL, 7);
    const steps = base + 7 * Math.round((want - base) / 7);
    return { k, n, steps, off: Math.abs(steps - want) };
  });
  cands.sort((a, b) => a.n - b.n || a.off - b.off);
  return cands[0];
}
/* move a spelled note `steps` letters and `semis` half steps; respelled plainly if that needs more than a double accidental */
function insShift(name, steps, semis) {
  const p = Theory.parse(name), m = Theory.midi(name) + semis;
  const L2 = p.L + 7 * p.oct + steps, nl = Theory.mod(L2, 7), oct = Math.floor(L2 / 7);
  const acc = m - ((oct + 1) * 12 + Theory.NAT[nl]);
  if (Math.abs(acc) > 2) return Theory.fromMidi(m, acc < 0);
  return Theory.fmt(nl, acc, oct);
}
/* the new key signature after moving a key by semis half steps */
function insTransposeSig(keySig, semis) {
  const from = Theory.keyFromSig(keySig || 0, 'major');
  return Theory.keySig(insKeyFor(Theory.pc(from) + semis, from, semis).k, 'major').n;
}
/* Score events moved by semis half steps, spelled in the new key (by letter: a B♭ instrument's part of a piece in E♭
   is in F, and every note moves up a major 2nd). keySig: the key signature the events are written in (default 0). */
function insTransposeEvents(events, semis, keySig) {
  const from = Theory.keyFromSig(keySig || 0, 'major'), to = insKeyFor(Theory.pc(from) + semis, from, semis);
  const list = Array.isArray(events) ? events : Score.parse(events);
  return list.map(e => {
    const o = Object.assign({}, e);
    if (o.p && !o.rest) o.p = insShift(o.p, to.steps, semis);
    return o;
  });
}
const insWritten = (m, inst) => m - (insById(inst) || { transpose: 0 }).transpose;
const insSounding = (m, inst) => m + (insById(inst) || { transpose: 0 }).transpose;
/* the written key for a concert key: 'E♭' → 'C' on alto sax; 'Cm' / 'C minor' / mode 'minor' keep their form */
function insWrittenKey(concertKey, inst, mode) {
  const ins = insById(inst); if (!ins) return concertKey;
  const s = String(concertKey).trim(), mm = /^([A-Ga-g](?:#|♯|b|♭)?)\s*(m|min|minor|maj|major)?$/u.exec(s);
  if (!mm) return concertKey;
  const tonic = Theory.pretty(mm[1][0].toUpperCase() + mm[1].slice(1)), minor = mode === 'minor' || /^m(in(or)?)?$/.test(mm[2] || '');
  const semis = -ins.transpose, major = minor ? Theory.relMajor(tonic) : tonic;
  const k = insKeyFor(Theory.pc(major) + semis, major, semis).k, out = minor ? Theory.relMinor(k) : k;
  const tail = mm[2] ? (mm[2] === 'm' ? 'm' : ' ' + (minor ? 'minor' : 'major')) : '';
  return out + (mm[2] && /^(maj|major)$/.test(mm[2]) ? ' major' : tail);
}
/* Range check, in plain sentences. notes: [{ m (sounding MIDI) | p (a note name), t, d }] or Score events (lengths only).
   o: { bpm (when t is in seconds), meter (default 4/4), written (true when the notes are the written part), keySig (for
   spelling), comfortable (default true: also flag notes outside the comfortable range, as warnings) }
   → [{ i, bar, m (sounding), kind: 'low'|'high'|'hardLow'|'hardHigh', level: 'error'|'warn', text }] */
function insCheckRange(notes, inst, o) {
  o = o || {};
  const ins = insById(inst); if (!ins) return [];
  let barLen = 4; try { barLen = Score.meter(o.meter || '4/4').barLen; } catch (e) { /* 4/4 */ }
  const k = o.bpm ? o.bpm / 60 : 1, out = [];
  const scoreLike = (notes || []).length && notes.every(n => n && n.t == null && n.d != null);
  let at = 0;
  (notes || []).forEach((n, i) => {
    const beat = scoreLike ? at : (n.t || 0) * k;
    if (scoreLike) at += n.d;
    if (!n || n.rest || (n.m == null && !n.p)) return;
    if (scoreLike && n.tie) return;
    let m = n.m != null ? n.m : Theory.midi(n.p);
    if (o.written) m = insSounding(m, ins);
    const name = n.p && !o.written ? Theory.pretty(n.p) : ntSpell(m, o.keySig || 0);
    const bar = n.bar != null ? n.bar : Math.floor(beat / barLen + 1e-9) + 1;
    const who = `the ${ins.short}’s`;
    let kind = null, level = 'error', text = '';
    if (m < ins.range.low) { kind = 'low'; text = `Bar ${bar}: the ${name} is below ${who} lowest note, ${ins.names.low} (sounding).`; }
    else if (m > ins.range.high) { kind = 'high'; text = `Bar ${bar}: the ${name} is above ${who} highest note, ${ins.names.high} (sounding).`; }
    else if (o.comfortable !== false && m < ins.comfortable.low) { kind = 'hardLow'; level = 'warn'; text = `Bar ${bar}: the ${name} is playable but low for the ${ins.short}; it will sound weak.`; }
    else if (o.comfortable !== false && m > ins.comfortable.high) { kind = 'hardHigh'; level = 'warn'; text = `Bar ${bar}: the ${name} is playable but high for the ${ins.short}; it will sound strained.`; }
    if (kind) out.push({ i, bar, m, kind, level, text });
  });
  return out;
}
/* the written part for a concert-pitch melody: transposed events, the written key signature and the clef */
function insPart(events, inst, keySig) {
  const ins = insById(inst); if (!ins) return { events, keySig: keySig || 0, clef: 'treble' };
  const semis = -ins.transpose;
  return { events: insTransposeEvents(events, semis, keySig), keySig: insTransposeSig(keySig || 0, semis), clef: ins.clef };
}

const Instruments = {
  list: INSTRUMENTS, FAMILIES: INS_FAMILY_ORDER,
  byId: insById, written: insWritten, sounding: insSounding, writtenKey: insWrittenKey, checkRange: insCheckRange,
  transposeEvents: insTransposeEvents, transposeSig: insTransposeSig, part: insPart
};
