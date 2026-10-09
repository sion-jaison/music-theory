/* =================================================================
   Voices (Level 8 onward)
   VoiceLead   pure functions, no DOM: the voice-leading and counterpoint checker (check), motion, intervalClass,
               nearestVoicing, totalMotion, a textbook S A T B realization of Roman numerals (realize), and deliberate
               errors for "find the error" exercises (corrupt, plant). RULES lists every rule id.
   VoiceView   SVG of two or four voices: a grand staff, one staff or two staves, in treble, bass, alto or tenor clef.
   PartWriter  the interactive part-writing editor (keys, MIDI, mic), checked live.
   Tasks.partWrite, Tasks.findErrors.

   Voices are listed top to bottom (soprano first). Each voice is an array of columns; a column entry is a note name with
   octave ('C4', 'F♯3'), a MIDI number, or null (a rest, or not written yet). Every rule skips cells that are null, so a
   half-written exercise is checked as far as it goes.
   ================================================================= */

/* ---------- the rules ---------- */
/* severity is the default; check() can override it per rule (opts.severity) */
const VL_RULES = {
  parallel5: { name: 'Parallel 5ths', sev: 'error', about: 'Two voices a 5th apart move the same way to another 5th.' },
  parallel8: { name: 'Parallel octaves', sev: 'error', about: 'Two voices an octave apart move the same way to another octave (or unison).' },
  parallelUnison: { name: 'Parallel unisons', sev: 'error', about: 'Two voices on the same note move together to another shared note.' },
  contrary5: { name: '5ths by contrary motion', sev: 'warn', about: 'Two voices jump from a 5th to a 5th in opposite directions.' },
  contrary8: { name: 'Octaves by contrary motion', sev: 'warn', about: 'Two voices jump from an octave to an octave in opposite directions.' },
  direct5: { name: 'Direct 5th', sev: 'error', about: 'The outer voices move the same way into a 5th with a leap in the top voice (in counterpoint: any similar motion into a 5th).' },
  direct8: { name: 'Direct octave', sev: 'error', about: 'The outer voices move the same way into an octave with a leap in the top voice (in counterpoint: any similar motion into an octave).' },
  crossing: { name: 'Voice crossing', sev: 'error', about: 'A voice goes above the voice written above it.' },
  overlap: { name: 'Voice overlap', sev: 'error', about: 'A voice moves past the note the next voice just sang.' },
  spacing: { name: 'Spacing', sev: 'error', about: 'Soprano–alto or alto–tenor more than an octave apart, or tenor–bass more than a 12th.' },
  range: { name: 'Range', sev: 'error', about: 'A note is outside the voice’s range.' },
  doubledLT: { name: 'Doubled leading tone', sev: 'error', about: 'Two voices have the leading tone; both would have to rise, making octaves.' },
  doubled3rd: { name: 'Doubled 3rd', sev: 'warn', about: 'A root-position major or minor chord doubles its 3rd instead of its root.' },
  doubled7th: { name: 'Doubled 7th', sev: 'error', about: 'Two voices have the chord’s 7th; both would have to fall.' },
  incomplete: { name: 'Incomplete chord', sev: 'error', about: 'A chord is missing its root, its 3rd or its 7th (leaving out the 5th is fine).' },
  notInChord: { name: 'Not in the chord', sev: 'error', about: 'A note is not part of the chord named under it.' },
  inversion: { name: 'Wrong bass note', sev: 'error', about: 'The bass does not have the note the figure asks for.' },
  ltResolve: { name: 'Leading tone', sev: 'error', about: 'A leading tone in the soprano or bass does not rise to the tonic at V–I.' },
  seventh: { name: 'Unresolved 7th', sev: 'error', about: 'A chord’s 7th does not step down to the next chord.' },
  aug2: { name: 'Augmented 2nd', sev: 'error', about: 'A voice moves by an augmented 2nd, an awkward gap to sing.' },
  tritone: { name: 'Tritone leap', sev: 'error', about: 'A voice leaps a tritone.' },
  leap: { name: 'Leap over an octave', sev: 'warn', about: 'A voice leaps more than an octave.' },
  twoLeaps: { name: 'Two leaps one way', sev: 'warn', about: 'A voice leaps twice in the same direction.' },
  consonance: { name: 'Dissonance', sev: 'error', about: 'A dissonance where the species needs a consonance.' },
  passing: { name: 'Not a passing tone', sev: 'error', about: 'A weak-beat dissonance that is not reached and left by step in one direction.' },
  startPerfect: { name: 'Opening interval', sev: 'error', about: 'Counterpoint begins on a perfect consonance.' },
  endPerfect: { name: 'Closing interval', sev: 'error', about: 'Counterpoint ends on a unison or octave.' },
  cadence: { name: 'Cadence', sev: 'error', about: 'The counterpoint reaches its last note by step.' },
  repeated: { name: 'Repeated notes', sev: 'error', about: 'Too many repeated notes in the counterpoint.' },
  steps: { name: 'Mostly steps', sev: 'warn', about: 'A counterpoint line that leaps more than it steps.' },
  suspPrep: { name: 'Unprepared dissonance', sev: 'error', about: 'A strong-beat dissonance that is not tied over from a consonance.' },
  suspResolve: { name: 'Unresolved suspension', sev: 'error', about: 'A suspension that does not resolve down by step.' },
  suspType: { name: 'Suspension type', sev: 'error', about: 'A suspension that does not work: above the cantus use 7–6, 4–3 or 9–8; below it, 2–3.' }
};
const VL_SEVENTH_QS = ['7', 'maj7', 'm7', 'm7b5', 'dim7', 'mMaj7'];
/* ranges as MIDI: four-part S C4–G5, A G3–D5, T C3–G4, B E2–C4; two voices get looser ones */
const VL_RANGE4 = [[60, 79], [55, 74], [48, 67], [40, 60]];
const VL_RANGE2 = [[55, 84], [38, 72]];
/* generic size of a simple interval from its half steps (a tritone counts as a 4th) */
const VL_SEMI_NUM = [1, 2, 2, 3, 3, 4, 4, 5, 6, 6, 7, 7];
const VL_ORD = ['', 'unison', '2nd', '3rd', '4th', '5th', '6th', '7th', 'octave'];

/* ---------- notes ---------- */
/* a spelled name with an octave for MIDI m, keeping the letter and accidental of `name` */
function vlAt(name, m) { const q = Theory.parse(name); return Theory.fmt(q.L, q.acc, Math.round((m - Theory.NAT[q.L] - q.acc) / 12) - 1); }
/* spell MIDI m in a key: the chord's own notes first (when known), then the scale (in minor: harmonic, melodic, natural),
   then sharps or flats to match the key signature */
function vlSpell(m, key, mode, chordNotes) {
  const p = mod12(m), tonic = Theory.stripOct(key || 'C'), minor = mode === 'minor';
  let name = (chordNotes || []).find(n => Theory.pc(n) === p);
  if (!name) name = Theory.scale(tonic, minor ? 'harmonic' : 'major').find(n => Theory.pc(n) === p);
  if (!name && minor) name = Theory.scale(tonic, 'melodic').concat(Theory.scale(tonic, 'minor')).find(n => Theory.pc(n) === p);
  if (!name) return ntSpell(m, Theory.keySig(tonic, minor ? 'minor' : 'major').n);
  return vlAt(name, m);
}
/* parsed notes are shared and never changed, so they can be cached by name */
const VL_NOTES = new Map();
function vlMk(name) {
  let x = VL_NOTES.get(name);
  if (!x) { const q = Theory.parse(name); x = { name, m: Theory.midi(name), pc: Theory.pc(name), step: q.L + 7 * q.oct, letter: Theory.stripOct(name) }; VL_NOTES.set(name, x); }
  return x;
}
/* a column entry → { name, m, pc, step, letter } or null */
function vlNote(x, key, mode, chordNotes) {
  if (x == null || x === '') return null;
  if (typeof x === 'object') return x.m != null && x.name ? x : vlNote(x.n != null ? x.n : x.m, key, mode, chordNotes);
  if (typeof x === 'number') return vlMk(vlSpell(x, key, mode, chordNotes));
  const hit = VL_NOTES.get(x);
  if (hit) return hit;
  const q = Theory.parse(x);
  if (q.oct == null) throw new Error('A voice note needs an octave: ' + x);
  return vlMk(Theory.fmt(q.L, q.acc, q.oct));
}
const vlMidi = x => x == null ? null : typeof x === 'number' ? x : typeof x === 'object' ? (x.m != null ? x.m : vlMidi(x.n)) : Theory.midi(x);

/* ---------- intervals and motion ---------- */
/* the interval between two notes (names or MIDI, either order): size, name and its class in two-voice counterpoint
   (the 4th counts as a dissonance there) */
function vlIntervalClass(a, b) {
  const A = vlNote(a), B = vlNote(b);
  if (!A || !B) return null;
  const lo = A.m < B.m || (A.m === B.m && A.step <= B.step) ? A : B, hi = lo === A ? B : A;
  const semis = hi.m - lo.m, simple = semis % 12;
  let num, q, name;
  const named = typeof a !== 'number' && typeof b !== 'number';
  if (named) { const iv = Theory.interval(lo.name, hi.name); num = iv.num; q = iv.q; name = iv.name; }
  else {
    /* from MIDI alone: the usual spelling of each size (6 half steps reads as an augmented 4th) */
    num = VL_SEMI_NUM[simple] + 7 * Math.floor(semis / 12);
    const base = Theory.INTERVALS[simple], cmp = Theory.COMPOUND.find(c => c.semis === semis);
    q = base.short === 'TT' ? 'A' : base.short[0];
    name = semis === 0 ? 'unison' : simple === 0 ? (semis === 12 ? 'octave' : 'two octaves') : semis < 12 ? base.name : cmp ? cmp.name : 'compound ' + base.name;
  }
  const sn = ((num - 1) % 7) + 1;
  const perfect = q === 'P' && (sn === 1 || sn === 5);
  const imperfect = (q === 'M' || q === 'm') && (sn === 3 || sn === 6);
  const consonant = perfect || imperfect;
  return { semis, simple, num, simpleNum: sn, q, name, short: q ? q + num : '?', perfect, imperfect, consonant, dissonant: !consonant, kind: perfect ? 'perfect' : imperfect ? 'imperfect' : 'dissonant', lo: lo.name, hi: hi.name };
}
/* generic size (1–7) between two notes, octaves folded */
function vlGeneric(a, b) {
  const A = vlNote(a), B = vlNote(b);
  if (typeof a !== 'number' && typeof b !== 'number') return (Math.abs(A.step - B.step) % 7) + 1;
  return VL_SEMI_NUM[Math.abs(A.m - B.m) % 12];
}
/* how two voices move: voice A from a1 to a2, voice B from b1 to b2 → 'parallel' (same direction, same interval size),
   'similar' (same direction, the size changes), 'contrary', 'oblique' (one holds), or 'static' (neither moves) */
function vlMotion(a1, a2, b1, b2) {
  const da = vlMidi(a2) - vlMidi(a1), db = vlMidi(b2) - vlMidi(b1);
  if (!da && !db) return 'static';
  if (!da || !db) return 'oblique';
  if (Math.sign(da) !== Math.sign(db)) return 'contrary';
  return vlGeneric(a1, b1) === vlGeneric(a2, b2) ? 'parallel' : 'similar';
}
/* a perfect interval class from half steps: '5', '8' (octave or more) or '1' (unison); null otherwise */
function vlPerf(semis) { const s = Math.abs(semis); return s === 0 ? '1' : s % 12 === 0 ? '8' : s % 12 === 7 ? '5' : null; }
/* half steps moved by every voice between two columns, nulls skipped */
function vlTotalMotion(a, b) { let s = 0; (a || []).forEach((x, i) => { const p = vlMidi(x), q = vlMidi(b[i]); if (p != null && q != null) s += Math.abs(q - p); }); return s; }

/* ---------- chords ---------- */
const vlPrettyRoman = r => String(r).replace(/^b/, '♭').replace(/^#/, '♯').replace(/\/b/, '/♭').replace(/\/#/, '/♯');
/* what a column's chord is: pcs, root, 3rd, 5th, 7th, bass, and its leading tone when it is a dominant (V or vii° of the
   key, or of the chord it is applied to) */
function vlChordInfo(c, key, mode, given, roman) {
  const pcs = c.notes.map(Theory.pc), seventh = VL_SEVENTH_QS.indexOf(c.q) >= 0, triad = ['maj', 'min', 'dim', 'aug'].indexOf(c.q) >= 0;
  const info = {
    roman: roman || null, label: roman ? vlPrettyRoman(roman) : Theory.pretty(Theory.symbol(c.root, c.q)), root: c.root, q: c.q, notes: c.notes, pcs,
    rootPc: pcs[0], thirdPc: triad || seventh ? pcs[1] : null, fifthPc: triad || seventh ? pcs[2] : null, seventhPc: seventh ? pcs[3] : null,
    bassPc: c.bass != null ? Theory.pc(c.bass) : pcs[0], bass: c.bass || c.notes[0], inversion: c.inversion || 0, given: !!given, lt: null, home: null, special: c.special || null
  };
  let home = Theory.pc(key);
  if (c.applied) { try { home = Theory.romanChord(c.applied, key, mode).notes.map(Theory.pc)[0]; } catch (e) { home = null; } }
  const base = roman ? String(roman).split('/')[0] : null;
  const vType = (c.q === 'maj' || c.q === '7') && (base ? /^V(?!I)/.test(base) : true);
  const viiType = (c.q === 'dim' || c.q === 'dim7' || c.q === 'm7b5') && (base ? /^vii/.test(base) : true);
  if (home != null && vType && mod12(info.rootPc - home) === 7) { info.lt = info.thirdPc; info.home = home; }
  if (home != null && viiType && mod12(home - info.rootPc) === 1) { info.lt = info.rootPc; info.home = home; }
  return info;
}
const VL_CHORDS = new Map();
function vlRoman(r, key, mode) {
  if (r == null || r === '') return null;
  const k = r + '|' + key + '|' + mode;
  if (!VL_CHORDS.has(k)) { let c = null; try { c = vlChordInfo(Theory.romanChord(r, key, mode), key, mode, true, r); } catch (e) { c = null; } VL_CHORDS.set(k, c); }
  return VL_CHORDS.get(k);
}
/* a chord guessed from the notes of a column (three or more pitch classes), for checks that need no numerals */
function vlGuess(notes, key, mode) {
  const ns = notes.filter(Boolean);
  const pcs = [...new Set(ns.map(x => x.pc))].sort((a, b) => a - b);
  if (pcs.length < 3) return null;
  const low = ns.reduce((a, b) => (b.m < a.m ? b : a));
  const k = pcs.join(',') + '/' + low.pc + '|' + key + '|' + mode;
  if (!VL_CHORDS.has(k)) {
    const id = Theory.identify(pcs, low.pc, ['maj', 'min', 'dim', 'aug', '7', 'maj7', 'm7', 'm7b5', 'dim7'])[0];
    const notesN = id ? Theory.chordNotes(id.root, id.q) : null;
    VL_CHORDS.set(k, id ? vlChordInfo({ root: id.root, q: id.q, notes: notesN, bass: notesN[Math.max(0, id.inversion)], inversion: id.inversion }, key, mode, false, null) : null);
  }
  return VL_CHORDS.get(k);
}
const vlSameChord = (a, b) => a.rootPc === b.rootPc && a.q === b.q;

/* ---------- the checker ----------
   VoiceLead.check(voices, opts) → [{ rule, col, cols, voices, severity, text }], errors first, then warnings, each by column.
   opts: { key ('C'), mode ('major' | 'minor'), romans (one per column, optional; null entries allowed),
           style: 'chorale' (default) | 'species1' | 'species2' | 'species4' | 'free',
           beats (species 2 and 4: which columns are strong; a number n = every nth column from 0 (default 2), an array of
                  booleans, or an array of strong column indices),
           cantus (species: index of the cantus voice; default the lower voice), fixed (voice indices that are given: no
           melodic or range complaints about them), names (voice names), ranges ([[lo, hi]] MIDI or names per voice),
           colName(c) (default 'beat c+1'), severity ({ rule: 'error' | 'warn' | 'off' }), ignore ([rule ids]), only ([rule ids]) }
   col is the column where the problem is heard: for motion rules the arrival column (cols holds both). voices lists the
   voices involved (one voice for melodic rules). In species 2 and 4 a null in the cantus on a weak column means the
   cantus note is held; in species 4 a strong-column note equal to the weak column before it is a tie. */
function vlContext(voices, opts) {
  opts = opts || {};
  const n = voices.length, cols = voices.reduce((x, v) => Math.max(x, (v || []).length), 0);
  const key = Theory.stripOct(opts.key || 'C'), mode = opts.mode === 'minor' ? 'minor' : 'major';
  const style = opts.style || 'chorale', species = /^species/.test(style), sp = species ? +style.slice(7) || 1 : 0;
  const romanCh = !species && opts.romans ? Array.from({ length: cols }, (_, c) => vlRoman(opts.romans[c], key, mode)) : [];
  const N = voices.map(v => Array.from({ length: cols }, (_, c) => vlNote((v || [])[c], key, mode, romanCh[c] ? romanCh[c].notes : null)));
  /* strong columns */
  let strong = Array(cols).fill(true);
  if (sp === 2 || sp === 4) {
    const b = opts.beats == null ? 2 : opts.beats;
    if (typeof b === 'number') strong = strong.map((_, c) => c % b === 0);
    else if (b.length && typeof b[0] === 'boolean') strong = strong.map((_, c) => !!b[c]);
    else strong = strong.map((_, c) => b.indexOf(c) >= 0);
  }
  const cantus = species ? (opts.cantus != null ? opts.cantus : n - 1) : null;
  const cp = species ? (cantus === 0 ? 1 : 0) : null;
  /* a held cantus: weak-column nulls continue the note before */
  const held = N.map(() => Array(cols).fill(false));
  if (species && cantus != null && (sp === 2 || sp === 4)) {
    for (let c = 1; c < cols; c++) if (!N[cantus][c] && !strong[c] && N[cantus][c - 1]) { N[cantus][c] = N[cantus][c - 1]; held[cantus][c] = true; }
  }
  const fixed = new Set(opts.fixed || (species && cantus != null ? [cantus] : []));
  const names = opts.names || (n === 4 ? ['soprano', 'alto', 'tenor', 'bass'] : n === 3 ? ['top voice', 'middle voice', 'bottom voice']
    : n === 2 ? (species ? (cantus === 0 ? ['cantus', 'counterpoint'] : ['counterpoint', 'cantus']) : ['upper voice', 'lower voice']) : voices.map((v, i) => 'voice ' + (i + 1)));
  const ranges = (opts.ranges || (n === 4 ? VL_RANGE4 : n === 2 ? VL_RANGE2 : [])).map(r => r ? r.map(vlMidi) : null);
  const chords = Array.from({ length: cols }, (_, c) => romanCh[c] || (!species ? vlGuess(N.map(v => v[c]), key, mode) : null));
  return { n, cols, key, mode, style, species, sp, N, strong, cantus, cp, held, fixed, names, ranges, chords, opts, two: n === 2 };
}
const vlCap = s => s.charAt(0).toUpperCase() + s.slice(1);
const vlList = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

function vlCheck(voices, opts) {
  const X = vlContext(voices, opts), o = X.opts, N = X.N, n = X.n, C = X.cols, out = [];
  const nm = i => X.names[i] || 'voice ' + (i + 1);
  const beat = c => (o.colName ? o.colName(c) : 'beat ' + (c + 1));
  const ignore = new Set(o.ignore || []), only = o.only ? new Set(o.only) : null;
  const on = rule => !ignore.has(rule) && (!only || only.has(rule)) && !(o.severity && o.severity[rule] === 'off');
  function add(rule, col, vs, text, extra) {
    if (!on(rule)) return;
    extra = extra || {};
    let sev = (o.severity && o.severity[rule]) || extra.severity;
    if (!sev) sev = X.two && ['crossing', 'overlap', 'spacing', 'range'].indexOf(rule) >= 0 ? 'warn' : VL_RULES[rule].sev;
    out.push({ rule, col, cols: extra.cols || [col], voices: vs, severity: sev, text });
  }
  const pair = (i, j, c) => `${N[i][c].letter}–${N[j][c].letter}`;
  const chorale = X.style === 'chorale', free = X.style === 'free';

  /* --- one column at a time --- */
  for (let c = 0; c < C; c++) {
    const col = N.map(v => v[c]);
    /* crossing: each voice against the next written voice below it */
    for (let i = 0; i < n - 1; i++) {
      const a = col[i]; if (!a) continue;
      let j = i + 1; while (j < n && !col[j]) j++;
      if (j < n && a.m < col[j].m) add('crossing', c, [i, j], `The ${nm(j)} (${col[j].name}) is above the ${nm(i)} (${a.name}) on ${beat(c)}. Keep each voice below the one written above it.`);
    }
    /* spacing */
    if (!free && !X.species && n === 4) {
      [[0, 1, 12], [1, 2, 12], [2, 3, 19]].forEach(([i, j, max]) => {
        const a = col[i], b = col[j];
        if (a && b && a.m - b.m > max) add('spacing', c, [i, j], max === 12
          ? `The ${nm(i)} and ${nm(j)} are more than an octave apart on ${beat(c)} (${a.name} and ${b.name}). Keep the upper three voices within an octave of their neighbours.`
          : `The ${nm(i)} and ${nm(j)} are more than a 12th apart on ${beat(c)} (${a.name} and ${b.name}). Bring the tenor closer to the bass.`);
      });
    }
    if (X.species && col[0] && col[1] && col[0].m - col[1].m > 16) add('spacing', c, [0, 1], `The two voices are more than a 10th apart on ${beat(c)} (${col[0].name} and ${col[1].name}). Bring them closer so they sound like a pair.`);
    /* range */
    if (!free) col.forEach((x, v) => {
      const r = X.ranges[v];
      if (!x || !r || X.fixed.has(v) || X.held[v][c]) return;
      if (x.m < r[0] || x.m > r[1]) {
        const what = ['soprano', 'alto', 'tenor', 'bass'].indexOf(nm(v)) >= 0 ? 'a ' + nm(v) : 'this voice';
        add('range', c, [v], `The ${nm(v)}’s ${x.name} on ${beat(c)} is too ${x.m > r[1] ? 'high' : 'low'} for ${what} (${Theory.fromMidi(r[0])} to ${Theory.fromMidi(r[1])}).`);
      }
    });
    /* the chord */
    const ch = X.chords[c];
    if (!ch) continue;
    const present = col.map((x, v) => ({ x, v })).filter(p => p.x);
    if (ch.given) present.forEach(({ x, v }) => {
      if (ch.pcs.indexOf(x.pc) < 0) add('notInChord', c, [v], `The ${nm(v)}’s ${x.name} on ${beat(c)} is not in the ${ch.label} chord (${ch.notes.join(' ')}).`);
    });
    const withPc = pc => present.filter(p => p.x.pc === pc).map(p => p.v);
    const nameOfPc = pc => ch.notes[ch.pcs.indexOf(pc)];
    if (n >= 3 && !X.species) {
      if (ch.lt != null) { const vs = withPc(ch.lt); if (vs.length >= 2) add('doubledLT', c, vs, `The leading tone (${nameOfPc(ch.lt)}) is doubled on ${beat(c)}, in the ${vlList(vs.map(nm))}. It wants to rise, and two voices rising together make octaves. Double another note.`); }
      if (ch.seventhPc != null) { const vs = withPc(ch.seventhPc); if (vs.length >= 2) add('doubled7th', c, vs, `The 7th of the chord (${nameOfPc(ch.seventhPc)}) is doubled on ${beat(c)}, in the ${vlList(vs.map(nm))}. A 7th has to step down, so only one voice should have it.`); }
      const bass = col[n - 1];
      if ((ch.q === 'maj' || ch.q === 'min') && bass && bass.pc === ch.rootPc && ch.thirdPc !== ch.lt) {
        const vs = withPc(ch.thirdPc);
        if (vs.length >= 2) add('doubled3rd', c, vs, `The 3rd (${nameOfPc(ch.thirdPc)}) is doubled on ${beat(c)}, in the ${vlList(vs.map(nm))}. In a root-position chord, doubling the root sounds steadier.`);
      }
      if (ch.given && present.length === n && ch.thirdPc != null) {
        const miss = [];
        if (withPc(ch.rootPc).length === 0) miss.push(['root', ch.rootPc]);
        if (withPc(ch.thirdPc).length === 0) miss.push(['3rd', ch.thirdPc]);
        if (ch.seventhPc != null && withPc(ch.seventhPc).length === 0) miss.push(['7th', ch.seventhPc]);
        if (miss.length) {
          const why = miss[0][0] === '3rd' ? 'A chord needs its 3rd; leave out the 5th instead.' : miss[0][0] === 'root' ? 'Put the root in one of the voices, often doubled.' : 'Without it the chord loses its pull.';
          add('incomplete', c, present.map(p => p.v), `The ${ch.label} chord on ${beat(c)} has no ${miss.map(m => `${m[0]} (${nameOfPc(m[1])})`).join(' and no ')}. ${why}`);
        }
      }
    }
    if (ch.given && col[n - 1] && n >= 2 && col[n - 1].pc !== ch.bassPc && ch.pcs.indexOf(col[n - 1].pc) >= 0) {
      const what = ['its root', 'its 3rd', 'its 5th', 'its 7th'][ch.inversion] || 'the written bass note';
      add('inversion', c, [n - 1], `The ${ch.label} chord on ${beat(c)} needs ${Theory.stripOct(ch.bass)} in the ${nm(n - 1)} (${what}); the ${nm(n - 1)} has ${col[n - 1].letter}.`);
    }
  }

  /* --- from each column to the next --- */
  for (let c = 0; c + 1 < C; c++) {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a1 = N[i][c], a2 = N[i][c + 1], b1 = N[j][c], b2 = N[j][c + 1];
      if (!a1 || !a2 || !b1 || !b2) continue;
      const da = a2.m - a1.m, db = b2.m - b1.m;
      /* overlap: neighbouring voices only, both moving (if one holds, it is a crossing, reported above) */
      if (j === i + 1 && da && db) {
        if (a2.m < b1.m) add('overlap', c + 1, [i, j], `The ${nm(i)} moves down to ${a2.name} on ${beat(c + 1)}, below the ${nm(j)}’s last note (${b1.name}). Keep each voice from passing the note its neighbour just sang.`, { cols: [c, c + 1] });
        else if (b2.m > a1.m) add('overlap', c + 1, [i, j], `The ${nm(j)} moves up to ${b2.name} on ${beat(c + 1)}, above the ${nm(i)}’s last note (${a1.name}). Keep each voice from passing the note its neighbour just sang.`, { cols: [c, c + 1] });
      }
      if (!da || !db) continue;
      if (da % 12 === 0 && db % 12 === 0) continue;
      const p1 = vlPerf(a1.m - b1.m), p2 = vlPerf(a2.m - b2.m), same = Math.sign(da) === Math.sign(db);
      const cls = p => p === '5' ? '5' : p ? '8' : null;
      const span = `from ${beat(c)} to ${beat(c + 1)} (${pair(i, j, c)} to ${pair(i, j, c + 1)})`;
      if (p1 && p2 && cls(p1) === cls(p2)) {
        if (same) {
          if (p1 === '5') add('parallel5', c + 1, [i, j], `${vlCap(nm(i))} and ${nm(j)} move in parallel 5ths ${span}. Move one of them the other way.`, { cols: [c, c + 1] });
          else if (p1 === '1' && p2 === '1') add('parallelUnison', c + 1, [i, j], `${vlCap(nm(i))} and ${nm(j)} move in unison from ${beat(c)} to ${beat(c + 1)} (${a1.letter} to ${a2.letter}). Give one of them a different note.`, { cols: [c, c + 1] });
          else add('parallel8', c + 1, [i, j], `${vlCap(nm(i))} and ${nm(j)} move in parallel octaves ${span}. Give one of them a different note.`, { cols: [c, c + 1] });
        } else if (p1 === '5') add('contrary5', c + 1, [i, j], `${vlCap(nm(i))} and ${nm(j)} go from a 5th to a 5th in opposite directions ${span}. It still sounds like parallel 5ths; try another note.`, { cols: [c, c + 1] });
        else add('contrary8', c + 1, [i, j], `${vlCap(nm(i))} and ${nm(j)} go from an octave to an octave in opposite directions ${span}. It still sounds like parallel octaves; try another note.`, { cols: [c, c + 1] });
        continue;
      }
      /* direct 5ths and octaves: outer voices with a leap in the top voice (chorale), or any similar motion (species) */
      if (same && p2 && !free) {
        const outer = i === 0 && j === n - 1;
        const what = p2 === '5' ? 'a 5th' : p2 === '8' ? 'an octave' : 'a unison';
        if (X.species) add(p2 === '5' ? 'direct5' : 'direct8', c + 1, [i, j], `${vlCap(nm(i))} and ${nm(j)} arrive on ${what} by moving the same way on ${beat(c + 1)} (${pair(i, j, c)} to ${pair(i, j, c + 1)}). In counterpoint, reach a 5th or an octave by contrary or oblique motion.`, { cols: [c, c + 1] });
        else if (outer && Math.abs(da) > 2) add(p2 === '5' ? 'direct5' : 'direct8', c + 1, [i, j], `${vlCap(nm(i))} and ${nm(j)} arrive on ${what} by moving the same way, with a leap in the ${nm(i)}, on ${beat(c + 1)} (${pair(i, j, c)} to ${pair(i, j, c + 1)}). Move the ${nm(i)} by step, or move the two the opposite way.`, { cols: [c, c + 1] });
      }
    }
    /* leading tone and 7th resolution */
    const ch = X.chords[c], nx = X.chords[c + 1];
    if (ch && nx && !X.species) {
      if (ch.lt != null && ch.home != null && nx.rootPc === ch.home) {
        const ltName = ch.notes[ch.pcs.indexOf(ch.lt)], home = nx.root;
        (n > 1 ? [0, n - 1] : [0]).forEach(v => {
          const x = N[v][c], y = N[v][c + 1];
          if (x && y && x.pc === ch.lt && y.m !== x.m + 1) add('ltResolve', c + 1, [v], `The leading tone (${ltName}) in the ${nm(v)} on ${beat(c)} should rise to ${Theory.stripOct(home)} on ${beat(c + 1)}. Here it goes to ${y.name}.`, { cols: [c, c + 1] });
        });
      }
      if (ch.seventhPc != null && !vlSameChord(ch, nx)) {
        const sev = ch.notes[3];
        N.forEach((v, k) => {
          const x = v[c], y = v[c + 1];
          if (!x || !y || x.pc !== ch.seventhPc || X.held[k][c + 1]) return;
          const d = y.m - x.m;
          if (d === -1 || d === -2) return;
          /* the rising 7th of V4/3 → I6 is allowed */
          if ((d === 1 || d === 2) && ch.inversion === 2 && nx.inversion === 1 && nx.rootPc === ch.home) return;
          const tg = [x.m - 1, x.m - 2].find(m => nx.pcs.indexOf(mod12(m)) >= 0);
          add('seventh', c + 1, [k], `The 7th of the ${ch.label} chord (${Theory.stripOct(sev)}, in the ${nm(k)}) on ${beat(c)} should step down on ${beat(c + 1)}${tg != null ? ' to ' + Theory.stripOct(vlSpell(tg, X.key, X.mode, nx.notes)) : ''}. Here it goes to ${y.name}.`, { cols: [c, c + 1] });
        });
      }
    }
  }

  /* --- each voice's own line --- */
  N.forEach((v, k) => {
    if (X.fixed.has(k)) return;
    let prevMove = null;
    for (let c = 1; c < C; c++) {
      const a = v[c - 1], b = v[c];
      if (!a || !b || X.held[k][c]) { prevMove = null; continue; }
      const d = b.m - a.m;
      if (!d) continue;
      const lo = d > 0 ? a : b, hi = d > 0 ? b : a;
      const iv = Theory.interval(lo.name, hi.name);
      const span = `from ${beat(c - 1)} to ${beat(c)}`;
      if (iv.q === 'A' && (iv.num === 2 || iv.num === 9)) add('aug2', c, [k], `The ${nm(k)} moves an augmented 2nd (${a.letter} to ${b.letter}) ${span}. That gap is awkward to sing; choose a different note.`, { cols: [c - 1, c] });
      else if (Math.abs(d) % 12 === 6) add('tritone', c, [k], `The ${nm(k)} leaps a tritone (${a.letter} to ${b.letter}) ${span}. Tritone leaps are hard to sing; choose a different note.`, { cols: [c - 1, c] });
      if (Math.abs(d) > 12) add('leap', c, [k], `The ${nm(k)} leaps more than an octave (${a.name} to ${b.name}) ${span}. Keep leaps to an octave or less.`, { cols: [c - 1, c] });
      if (prevMove && Math.sign(prevMove.d) === Math.sign(d) && Math.abs(prevMove.d) >= 3 && Math.abs(d) >= 3 && !(Math.abs(prevMove.d) <= 4 && Math.abs(d) <= 4))
        add('twoLeaps', c, [k], `The ${nm(k)} leaps twice the same way (${prevMove.from.name}, ${a.name}, ${b.name}) up to ${beat(c)}. After a leap, step back the other way.`, { cols: [prevMove.c, c - 1, c] });
      prevMove = { d, from: a, c: c - 1 };
    }
  });

  /* --- species counterpoint --- */
  if (X.species && n === 2) vlSpecies(X, add, beat, nm);

  const rank = { error: 0, warn: 1 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || a.col - b.col || a.voices[0] - b.voices[0]);
}

function vlSpecies(X, add, beat, nm) {
  const N = X.N, C = X.cols, sp = X.sp, cp = X.cp, cf = X.cantus, above = cp === 0;
  const iv = c => (N[0][c] && N[1][c] ? vlIntervalClass(N[1][c].name, N[0][c].name) : null);
  const ivWords = v => `a ${v.name} (${Theory.stripOct(v.lo)}–${Theory.stripOct(v.hi)})`;
  for (let c = 0; c < C; c++) {
    const v = iv(c); if (!v) continue;
    const strong = X.strong[c];
    if (sp === 1 && v.dissonant) add('consonance', c, [0, 1], `${vlCap(beat(c))} has ${ivWords(v)}, a dissonance. In first species every interval is a consonance: a unison, 3rd, 5th, 6th or octave.`);
    if (sp === 2) {
      if (strong && v.dissonant) add('consonance', c, [0, 1], `${vlCap(beat(c))} is a strong beat with ${ivWords(v)}, a dissonance. Strong beats need consonances.`);
      if (!strong && v.dissonant) {
        const p = N[cp][c - 1], x = N[cp][c], q = N[cp][c + 1];
        if (p && q) {
          const d1 = x.m - p.m, d2 = q.m - x.m, step = d => Math.abs(d) === 1 || Math.abs(d) === 2;
          if (!(step(d1) && step(d2) && Math.sign(d1) === Math.sign(d2))) add('passing', c, [cp], `The ${nm(cp)}’s ${x.name} on ${beat(c)} makes ${ivWords(v)} but is not a passing tone. A weak-beat dissonance must be reached and left by step in one direction.`);
        } else if (p && c === C - 1) add('passing', c, [cp], `The ${nm(cp)}’s ${x.name} on ${beat(c)} makes ${ivWords(v)} and goes nowhere. End on a consonance.`);
      }
    }
    if (sp === 4) {
      if (!strong && v.dissonant) add('consonance', c, [0, 1], `${vlCap(beat(c))} has ${ivWords(v)}, a dissonance. In fourth species the second note of each bar must be a consonance.`);
      if (strong && v.dissonant) {
        const prep = N[cp][c - 1], x = N[cp][c];
        if (!prep || prep.m !== x.m) add('suspPrep', c, [cp], `The dissonance on ${beat(c)}, ${ivWords(v)}, is not prepared. Tie it over from the same note on the beat before, where it was a consonance.`);
        else {
          const res = N[cp][c + 1];
          if (res) {
            const d = res.m - x.m;
            if (d !== -1 && d !== -2) add('suspResolve', c + 1, [cp], `The suspension on ${beat(c)}, ${ivWords(v)}, should resolve down by step on ${beat(c + 1)}. Here it goes to ${res.name}.`, { cols: [c, c + 1] });
            else {
              const r = vlIntervalClass(N[1][c + 1].name, N[0][c + 1].name);
              const a = v.num, b = r.num;
              const sa = ((a - 1) % 7) + 1;
              const okAbove = (sa === 7 && b % 7 === 6) || (sa === 4 && ((b - 1) % 7) + 1 === 3) || (sa === 2 && a >= 9 && ((b - 1) % 7) + 1 === 1 && b >= 8);
              const okBelow = sa === 2 && ((b - 1) % 7) + 1 === 3;
              if (above ? !okAbove : !okBelow) add('suspType', c, [cp], `This ${a}–${b} suspension on ${beat(c)} does not work: ${above ? 'above the cantus use 7–6, 4–3 or 9–8' : 'below the cantus use 2–3'}.`);
            }
          }
        }
      }
    }
  }
  /* perfect intervals on successive strong beats (species 2) or successive weak beats (species 4) */
  if (sp === 2 || sp === 4) {
    const list = [];
    for (let c = 0; c < C; c++) if ((sp === 2 ? X.strong[c] : !X.strong[c]) && iv(c)) list.push(c);
    for (let k = 1; k < list.length; k++) {
      const c1 = list[k - 1], c2 = list[k];
      if (c2 - c1 > 2) continue;
      const v1 = iv(c1), v2 = iv(c2), p1 = vlPerf(v1.semis), p2 = vlPerf(v2.semis);
      const moved = N[0][c1].m !== N[0][c2].m && N[1][c1].m !== N[1][c2].m;
      if (!p1 || !p2 || !moved || (p1 === '5') !== (p2 === '5')) continue;
      const word = p1 === '5' ? '5ths' : 'octaves';
      const rule = p1 === '5' ? 'parallel5' : 'parallel8';
      add(rule, c2, [0, 1], sp === 2
        ? `The voices make ${word} on two strong beats in a row (${beat(c1)} and ${beat(c2)}). The ear still hears parallel ${word}; change one of them.`
        : `The voices make ${word} on ${beat(c1)} and ${beat(c2)}, one after the other. Suspensions do not hide parallel ${word}; change one of them.`,
      { cols: [c1, c2], severity: sp === 2 ? 'warn' : 'error' });
    }
  }
  /* the opening, the ending and the cadence */
  const first = N[cp].findIndex(Boolean);
  if (first >= 0) {
    const v = iv(first);
    if (v && !(v.perfect && (above || v.simpleNum === 1))) add('startPerfect', first, [0, 1], `The first interval, ${ivWords(v)}, should be a perfect consonance: ${above ? 'a unison, 5th or octave' : 'a unison or octave'}.`);
  }
  let last = -1; for (let c = C - 1; c >= 0; c--) if (N[cf][c] && !X.held[cf][c]) { last = c; break; }
  if (last > 0 && N[cp][last]) {
    const v = iv(last);
    if (v && !(v.perfect && v.simpleNum === 1)) add('endPerfect', last, [0, 1], `The last interval, ${ivWords(v)}, should be a unison or an octave, so the line ends at home.`);
    let pen = last - 1; while (pen >= 0 && !N[cp][pen]) pen--;
    if (pen >= 0) {
      const d = N[cp][last].m - N[cp][pen].m;
      if (Math.abs(d) !== 1 && Math.abs(d) !== 2) add('cadence', last, [cp], `The ${nm(cp)} should reach its last note by step (here ${N[cp][pen].name} to ${N[cp][last].name}). End with a step into the octave or unison, often from the leading tone.`, { cols: [pen, last] });
    }
  }
  /* repeated notes and the shape of the line */
  if (sp !== 4) {
    let reps = 0, steps = 0, leaps = 0, lastC = -1;
    for (let c = 1; c < C; c++) {
      const a = N[cp][c - 1], b = N[cp][c];
      if (!a || !b) continue;
      const d = Math.abs(b.m - a.m);
      if (d === 0) {
        reps++;
        if (reps > (sp === 1 ? 1 : 0)) add('repeated', c, [cp], `The ${nm(cp)} repeats ${b.letter} on ${beat(c)}. ${sp === 1 ? 'One repeated note is fine; more make the line stall.' : 'In second species, keep the line moving.'}`);
      } else if (d <= 2) steps++; else leaps++;
      lastC = c;
    }
    if (steps + leaps >= 4 && leaps > steps) add('steps', lastC, [cp], `The ${nm(cp)} leaps more often than it steps (${leaps} leaps, ${steps} steps). A good line moves mostly by step, with a few leaps for shape.`);
  }
}

/* ---------- voicing helpers ---------- */
/* what a chord asks for: its pitch classes and roles. chord: a symbol ('G7', 'C/E'), a Roman numeral (with opts.key),
   an array of pitch classes, or an array of note names */
function vlChordSpec(chord, opts) {
  opts = opts || {};
  let c = null;
  if (Array.isArray(chord)) {
    const pcs = [...new Set(chord.map(x => typeof x === 'number' ? mod12(x) : Theory.pc(x)))];
    const id = Theory.identify(pcs, null, ['maj', 'min', 'dim', 'aug', '7', 'maj7', 'm7', 'm7b5', 'dim7', 'mMaj7', 'sus2', 'sus4'])[0];
    if (!id) return { pcs, notes: pcs.map(p => Theory.pcName(p)), rootPc: pcs[0], thirdPc: null, fifthPc: null, seventhPc: null, bassPc: null };
    c = { root: id.root, q: id.q, notes: Theory.chordNotes(id.root, id.q), bass: null };
  } else {
    try { const p = Theory.parseChord(chord); c = { root: p.root, q: p.q, notes: Theory.chordNotes(p.root, p.q), bass: p.bass }; }
    catch (e) { const r = Theory.romanChord(chord, opts.key || 'C', opts.mode); c = { root: r.root, q: r.q, notes: r.notes, bass: r.inversion ? r.bass : null }; }
  }
  const pcs = c.notes.map(Theory.pc), seventh = VL_SEVENTH_QS.indexOf(c.q) >= 0, tri = ['maj', 'min', 'dim', 'aug'].indexOf(c.q) >= 0 || seventh;
  return { pcs, notes: c.notes, rootPc: pcs[0], thirdPc: tri ? pcs[1] : null, fifthPc: tri ? pcs[2] : null, seventhPc: seventh ? pcs[3] : null, bassPc: c.bass ? Theory.pc(c.bass) : null };
}
/* VoiceLead.nearestVoicing(prev, chord, opts) → MIDI numbers, one per voice of prev, in the same order (null if nothing fits)
   prev: the voicing before (MIDI numbers or names, any order). chord: see vlChordSpec. Common tones stay; the other voices
   move to the nearest chord tone, without crossing, so the total motion is as small as it can be.
   opts: { key, mode (for numerals), bass (true: the lowest voice takes the chord's bass note: the note after the slash, or the
   root), lo, hi (MIDI limits), complete (default true: every chord tone when there are enough voices; with fewer voices the
   3rd and 7th come first, then the root; a 5th is the first to go), names (true: return spelled names) } */
function vlNearest(prev, chord, opts) {
  opts = opts || {};
  const P = prev.map(vlMidi), S = vlChordSpec(chord, opts), n = P.filter(m => m != null).length;
  const live = P.map((m, i) => i).filter(i => P[i] != null).sort((a, b) => P[b] - P[a] || a - b);
  const prio = [S.thirdPc, S.seventhPc, S.rootPc, S.fifthPc].filter((p, i, a) => p != null && a.indexOf(p) === i);
  S.pcs.forEach(p => { if (prio.indexOf(p) < 0) prio.push(p); });
  const need = opts.complete === false ? prio.slice(0, Math.min(2, n)) : prio.slice(0, Math.min(n, prio.length));
  const bassPc = S.bassPc != null ? S.bassPc : opts.bass ? S.rootPc : null;
  function search(win) {
    let best = null;
    const pick = new Array(P.length).fill(null);
    const go = k => {
      if (k === live.length) {
        const have = new Set(live.map(i => mod12(pick[i])));
        if (need.some(p => !have.has(p))) return;
        if (bassPc != null && mod12(pick[live[live.length - 1]]) !== bassPc) return;
        let cost = 0;
        live.forEach(i => { cost += Math.abs(pick[i] - P[i]); });
        /* parallel 5ths and octaves cost extra, and so does doubling the 3rd */
        for (let x = 0; x < live.length; x++) for (let y = x + 1; y < live.length; y++) {
          const i = live[x], j = live[y], da = pick[i] - P[i], db = pick[j] - P[j];
          if (da && db && Math.sign(da) === Math.sign(db)) { const p1 = vlPerf(P[i] - P[j]), p2 = vlPerf(pick[i] - pick[j]); if (p1 && p2 && (p1 === '5') === (p2 === '5')) cost += 4; }
        }
        if (S.thirdPc != null && live.filter(i => mod12(pick[i]) === S.thirdPc).length > 1) cost += 1;
        cost += 0.001 * live.reduce((s, i) => s + Math.abs(pick[i] - P[i]) ** 2, 0);
        if (!best || cost < best.cost - 1e-9) best = { cost, m: pick.slice() };
        return;
      }
      const i = live[k], above = k ? pick[live[k - 1]] : Infinity;
      for (let d = 0; d <= win; d++) {
        for (const m of d ? [P[i] - d, P[i] + d] : [P[i]]) {
          if (S.pcs.indexOf(mod12(m)) < 0 || (m >= above && !(m === above && P[i] === P[live[k - 1]]))) continue;
          if ((opts.lo != null && m < vlMidi(opts.lo)) || (opts.hi != null && m > vlMidi(opts.hi))) continue;
          pick[i] = m; go(k + 1); pick[i] = null;
        }
      }
    };
    go(0);
    return best;
  }
  const best = search(7) || search(12);
  if (!best) return null;
  return opts.names ? best.m.map(m => m == null ? null : vlAt(S.notes[S.pcs.indexOf(mod12(m))] || Theory.pcName(m), m)) : best.m;
}

/* ---------- a textbook realization ----------
   VoiceLead.realize(romans, key, mode, opts) → [soprano, alto, tenor, bass] as arrays of note names, or null if no voicing
   fits. Every chord is complete or leaves out only its 5th, the root is doubled in root position, the leading tone and 7ths
   are never doubled and resolve, there are no parallels, direct 5ths or octaves in the outer voices, overlaps, augmented 2nds
   or tritone leaps, and the upper voices move as little as they can. opts: { soprano, bass } (lines to keep, one entry
   per column, null where free) */
function vlCands(ch, sFix, bFix) {
  const out = [], R = VL_RANGE4, pcs = ch.pcs;
  const need = [ch.rootPc, ch.thirdPc, ch.seventhPc].filter(p => p != null);
  const aug6 = ch.special === 'It' || ch.special === 'Fr' || ch.special === 'Ger';
  const has = m => pcs.indexOf(mod12(m)) >= 0;
  const stepOf = m => { const q = Theory.parse(vlAt(ch.notes[pcs.indexOf(mod12(m))], m)); return q.L + 7 * q.oct; };
  for (let b = R[3][0]; b <= R[3][1]; b++) {
    if (mod12(b) !== ch.bassPc || (bFix != null && b !== bFix)) continue;
    for (let t = Math.max(R[2][0], b + 1); t <= Math.min(R[2][1], b + 19); t++) {
      if (!has(t)) continue;
      for (let a = Math.max(R[1][0], t + 1); a <= Math.min(R[1][1], t + 12); a++) {
        if (!has(a)) continue;
        for (let s = Math.max(R[0][0], a + 1); s <= Math.min(R[0][1], a + 12); s++) {
          if (!has(s) || (sFix != null && s !== sFix)) continue;
          const m = [s, a, t, b], cnt = {};
          m.forEach(x => { const p = mod12(x); cnt[p] = (cnt[p] || 0) + 1; });
          if (need.some(p => !cnt[p])) continue;
          if ((ch.lt != null && cnt[ch.lt] > 1) || (ch.seventhPc != null && cnt[ch.seventhPc] > 1)) continue;
          if (aug6 && (cnt[pcs[0]] > 1 || cnt[pcs[pcs.length - 1]] > 1)) continue;
          let pen = 0;
          if (ch.fifthPc != null && !cnt[ch.fifthPc]) pen += ch.seventhPc != null ? 1.5 : 4;
          if (ch.thirdPc != null && cnt[ch.thirdPc] > 1) pen += (ch.q === 'maj' || ch.q === 'min') && ch.inversion === 0 ? 8 : ch.q === 'dim' ? 0 : 1.5;
          if (ch.q === 'dim' && ch.fifthPc != null && cnt[ch.fifthPc] > 1) pen += 1;
          if (ch.inversion === 2 && ch.seventhPc == null && cnt[ch.bassPc] < 2) pen += 5;
          if (ch.special === 'N' && cnt[ch.bassPc] < 2) pen += 2;
          pen += Math.max(0, s - t - 12) * 0.2;
          out.push({ m, st: m.map(stepOf), pen });
        }
      }
    }
  }
  return out;
}
/* the cost of moving from voicing u to voicing v (1e6 = breaks a rule) */
function vlTrans(u, v, c1, c2) {
  const U = u.m, V = v.m;
  let cost = 0;
  for (let k = 0; k < 4; k++) {
    const d = V[k] - U[k], ad = d < 0 ? -d : d;
    if (ad > 12 || ad % 12 === 6) return 1e6;
    if (ad === 3 && Math.abs(v.st[k] - u.st[k]) === 1) return 1e6;
    if (k < 3) { cost += ad; if (ad > 4) cost += k === 0 ? 3 : 5; if (ad > 7) cost += 12; }
    else cost += ad * 0.25;
  }
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const da = V[i] - U[i], db = V[j] - U[j];
    if (j === i + 1 && (V[i] < U[j] || V[j] > U[i])) return 1e6;
    if (!da || !db || (da % 12 === 0 && db % 12 === 0)) continue;
    const p1 = vlPerf(U[i] - U[j]), p2 = vlPerf(V[i] - V[j]), same = (da > 0) === (db > 0);
    if (p1 && p2 && (p1 === '5') === (p2 === '5')) { if (same) return 1e6; cost += 40; continue; }
    if (same && p2 && i === 0 && j === 3 && Math.abs(da) > 2) return 1e6;
  }
  if (c1.lt != null && c1.home != null && c2.rootPc === c1.home) {
    for (let k = 0; k < 4; k++) if (mod12(U[k]) === c1.lt && V[k] !== U[k] + 1) { if (k === 0 || k === 3) return 1e6; cost += 2; }
  }
  if (c1.seventhPc != null && !vlSameChord(c1, c2)) {
    for (let k = 0; k < 4; k++) if (mod12(U[k]) === c1.seventhPc) { const d = V[k] - U[k]; if (d !== -1 && d !== -2) return 1e6; }
  }
  return cost;
}
function vlRealize(romans, key, mode, opts) {
  opts = opts || {};
  key = Theory.stripOct(key || 'C'); mode = mode === 'minor' ? 'minor' : 'major';
  const chords = romans.map(r => { const c = vlRoman(r, key, mode); if (!c) throw new Error('Not a Roman numeral: ' + r); return c; });
  const fs = opts.soprano || [], fbs = opts.bass || [];
  const layers = chords.map((ch, k) => vlCands(ch, vlMidi(fs[k]), vlMidi(fbs[k])));
  if (!layers.length || layers.some(l => !l.length)) return null;
  let cost = layers[0].map(v => v.pen + Math.abs(v.m[0] - 72) * 0.3 + Math.abs(v.m[3] - 50) * 0.05);
  const back = [layers[0].map(() => -1)];
  for (let k = 1; k < layers.length; k++) {
    const prevL = layers[k - 1], nc = [], bk = [];
    layers[k].forEach(v => {
      let best = Infinity, bi = 0;
      for (let i = 0; i < prevL.length; i++) { if (cost[i] >= best) continue; const t = cost[i] + vlTrans(prevL[i], v, chords[k - 1], chords[k]); if (t < best) { best = t; bi = i; } }
      nc.push(best + v.pen); bk.push(bi);
    });
    cost = nc; back.push(bk);
  }
  let j = cost.indexOf(Math.min(...cost));
  const path = [];
  for (let k = layers.length - 1; k >= 0; k--) { path.unshift(layers[k][j]); j = back[k][j]; }
  return [0, 1, 2, 3].map(v => path.map((x, k) => vlAt(chords[k].notes[chords[k].pcs.indexOf(mod12(x.m[v]))], x.m[v])));
}

/* ---------- deliberate errors ---------- */
/* voices as note names (MIDI spelled in the key, against the column's chord when numerals are given) */
function vlNames(voices, opts) {
  opts = opts || {};
  const key = Theory.stripOct(opts.key || 'C'), mode = opts.mode === 'minor' ? 'minor' : 'major';
  return voices.map(v => (v || []).map((x, c) => {
    const ch = opts.romans ? vlRoman(opts.romans[c], key, mode) : null, n = vlNote(x, key, mode, ch ? ch.notes : null);
    return n ? n.name : null;
  }));
}
const vlKeyOf = p => p.rule + '@' + p.col + ':' + p.voices.join(',');
/* errors that come with a planted one by nature (a voice that crosses usually overlaps too) */
const VL_COMPANIONS = { crossing: ['overlap'], overlap: ['crossing'], doubled7th: ['seventh', 'parallel8'], doubledLT: ['ltResolve', 'parallel8'] };
/* VoiceLead.corrupt(voices, ruleId, opts) → a copy of voices (note names) with one deliberate error of that kind, or null
   when none can be made. It changes one note (or one note plus a second that tidies up any other error the first one
   caused), so the copy has exactly one new problem of that rule and, as far as possible, nothing else new.
   opts: the check() options (key, mode, romans, style …), plus avoid ([columns] to leave alone), fixed ([voices] to leave
   alone) and random (a function like Math.random, for repeatable results). New notes are chord tones when numerals are
   given (a non-chord tone for 'notInChord'), else notes of the key.
   The copy is an array with an extra property:
   .planted = { rule, col, cols, voices, text, severity, also: [other new problems], change: { voice, col, from, to }, changes: [...] }
   Rules that need two voices to agree over two columns (parallelUnison, contrary8) may not be possible in a given
   progression; the caller should be ready for null. */
function vlCorrupt(voices, rule, opts) {
  opts = opts || {};
  const rnd = opts.random || Math.random, key = Theory.stripOct(opts.key || 'C'), mode = opts.mode === 'minor' ? 'minor' : 'major';
  const names = vlNames(voices, opts), before = new Set(vlCheck(names, opts).map(vlKeyOf));
  const chs = names[0] ? names[0].map((x, c) => opts.romans ? vlRoman(opts.romans[c], key, mode) : null) : [];
  const scalePcs = Theory.scale(key, mode === 'minor' ? 'harmonic' : 'major').concat(mode === 'minor' ? Theory.scale(key, 'minor') : []).map(Theory.pc);
  const avoid = opts.avoid || [], fixed = opts.fixed || [], comp = VL_COMPANIONS[rule] || [];
  const moves = [];
  names.forEach((v, k) => v.forEach((x, c) => {
    if (!x || avoid.indexOf(c) >= 0 || fixed.indexOf(k) >= 0) return;
    const m = Theory.midi(x), ch = chs[c];
    for (let d = -12; d <= 12; d++) {
      if (!d) continue;
      const p = mod12(m + d), inCh = ch ? ch.pcs.indexOf(p) >= 0 : false, inKey = scalePcs.indexOf(p) >= 0;
      if (rule === 'notInChord' ? (ch && !inCh && inKey) : (ch ? inCh : inKey)) moves.push({ k, c, t: m + d });
    }
  }));
  for (let i = moves.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = moves[i]; moves[i] = moves[j]; moves[j] = t; }
  const apply = (base, mv) => { const copy = base.map(v => v.slice()); copy[mv.k][mv.c] = vlSpell(mv.t, key, mode, chs[mv.c] ? chs[mv.c].notes : null); return copy; };
  /* tier 0: nothing else new; 1: only warnings or companions; 2: other errors too (worth a repair) */
  const grade = copy => {
    const fresh = vlCheck(copy, opts).filter(p => !before.has(vlKeyOf(p)));
    const hits = fresh.filter(p => p.rule === rule);
    if (hits.length !== 1) return null;
    const also = fresh.filter(p => p !== hits[0]);
    const hard = also.filter(p => p.severity === 'error' && comp.indexOf(p.rule) < 0);
    return { hit: hits[0], also, hard, tier: !also.length ? 0 : !hard.length ? 1 : 2 };
  };
  let pick = null;
  const near = [];
  for (const mv of moves) {
    const copy = apply(names, mv), g = grade(copy);
    if (!g) continue;
    if (g.tier === 0) { pick = { copy, g, mvs: [mv] }; break; }
    if (g.tier === 1 && !pick) pick = { copy, g, mvs: [mv] };
    if (g.tier === 2 && g.hard.length <= 2) near.push({ copy, g, mv });
  }
  if (!pick) {
    /* a second change that clears what else the first one broke: a note in the columns of those other errors, but not
       one of the planted error's own notes */
    near.sort((a, b) => a.g.hard.length - b.g.hard.length);
    search: for (const x of near.slice(0, 30)) {
      const cols = new Set([].concat(...x.g.hard.map(p => p.cols)));
      for (const mv2 of moves) {
        if (!cols.has(mv2.c) || (mv2.k === x.mv.k && mv2.c === x.mv.c) || (x.g.hit.cols.indexOf(mv2.c) >= 0 && x.g.hit.voices.indexOf(mv2.k) >= 0)) continue;
        const copy = apply(x.copy, mv2), g = grade(copy);
        if (g && g.tier <= 1) { pick = { copy, g, mvs: [x.mv, mv2] }; if (g.tier === 0) break search; }
      }
      if (pick) break;
    }
  }
  if (!pick) return null;
  const { copy, g, mvs } = pick, hit = g.hit;
  const changes = mvs.map(mv => ({ voice: mv.k, col: mv.c, from: names[mv.k][mv.c], to: copy[mv.k][mv.c] }));
  copy.planted = { rule, col: hit.col, cols: hit.cols, voices: hit.voices, text: hit.text, severity: hit.severity, also: g.also, change: changes[0], changes };
  return copy;
}
/* other correct realizations of the same numerals: the soprano starting on each note of the first chord, and the leading
   tone in the soprano before each V–I (so a leading-tone error can be planted) */
function vlVariants(romans, key, mode) {
  const out = [], seen = new Set(), add = v => { if (v && !seen.has(v.join('|'))) { seen.add(v.join('|')); out.push(v); } };
  const chs = romans.map(r => vlRoman(r, key, mode));
  const sop = (k, pc) => { let m = 60 + mod12(pc - 60); if (m < 65) m += 12; return m; };
  chs.forEach((ch, k) => {
    if (ch && ch.lt != null && chs[k + 1] && chs[k + 1].rootPc === ch.home) {
      const s = []; s[k] = sop(k, ch.lt);
      try { add(vlRealize(romans, key, mode, { soprano: s })); } catch (e) { /* skip */ }
    }
  });
  if (chs[0]) chs[0].pcs.forEach(pc => { const s = [sop(0, pc)]; try { add(vlRealize(romans, key, mode, { soprano: s })); } catch (e) { /* skip */ } });
  return out;
}
/* VoiceLead.plant(voices, rules, opts) → { voices, planted: [planted, …], base } with one error of each kind in rules, each in
   columns of its own (so fixing one never undoes another), or null. voices may be null when opts.romans are given: a
   realization is made. When the given voices cannot take an error and numerals are given, other correct realizations
   are tried; base is the correct version the errors were planted in. opts as for corrupt. */
function vlPlant(voices, rules, opts) {
  opts = opts || {};
  const key = Theory.stripOct(opts.key || 'C'), mode = opts.mode === 'minor' ? 'minor' : 'major';
  const chorale = opts.romans && !/^species/.test(opts.style || '');
  const bases = voices ? [vlNames(voices, opts)] : chorale ? [vlRealize(opts.romans, key, mode)].filter(Boolean) : [];
  let variantsMade = false;
  /* three orders: as given, the rules with the fewest places to go first, and reversed */
  const HARD = ['ltResolve', 'seventh', 'doubled7th', 'aug2', 'doubledLT', 'direct5', 'direct8', 'tritone', 'inversion'];
  const hard = r => (HARD.indexOf(r) < 0 ? 99 : HARD.indexOf(r));
  const orders = [rules.slice(), rules.slice().sort((a, b) => hard(a) - hard(b)), rules.slice().reverse()];
  for (let b = 0; b < bases.length; b++) {
    for (let attempt = 0; attempt < (rules.length > 1 ? 3 : 1); attempt++) {
      let cur = bases[b].map(v => v.slice()), failed = null;
      const planted = [], avoid = (opts.avoid || []).slice();
      for (const r of orders[attempt]) {
        const res = vlCorrupt(cur, r, Object.assign({}, opts, { avoid }));
        if (!res) { failed = r; break; }
        planted.push(res.planted);
        res.planted.cols.concat(res.planted.changes.map(x => x.col)).forEach(c => { if (avoid.indexOf(c) < 0) avoid.push(c); });
        cur = res.map(v => v.slice());
      }
      if (!failed) {
        const now = new Set(vlCheck(cur, opts).map(vlKeyOf));
        if (planted.every(p => now.has(vlKeyOf(p)))) { planted.sort((x, y) => rules.indexOf(x.rule) - rules.indexOf(y.rule)); return { voices: cur, planted, base: bases[b] }; }
      }
    }
    if (b === bases.length - 1 && chorale && !variantsMade) { variantsMade = true; vlVariants(opts.romans, key, mode).forEach(v => bases.push(v)); }
  }
  return null;
}

const VoiceLead = {
  RULES: VL_RULES, RANGES: { four: VL_RANGE4, two: VL_RANGE2 },
  check: vlCheck, motion: vlMotion, intervalClass: vlIntervalClass, nearestVoicing: vlNearest, totalMotion: vlTotalMotion,
  realize: vlRealize, corrupt: vlCorrupt, plant: vlPlant,
  /* extras: spell a MIDI note in a key (chord notes first); voices as note names; a column's chord (from opts.romans, or
     guessed from the notes); a rule's display name; counts of a problem list */
  spell: vlSpell, names: vlNames, chordAt: (voices, opts, c) => vlContext(voices, opts).chords[c] || null,
  ruleName: id => (VL_RULES[id] || { name: id }).name,
  summary: ps => ({ errors: ps.filter(p => p.severity === 'error').length, warnings: ps.filter(p => p.severity === 'warn').length })
};
