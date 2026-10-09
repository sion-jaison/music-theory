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
      if (j === i + 1 && da && db && a1.m !== b1.m) {
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
  const ivWords = v => `${/^(augmented|octave|eleventh)/.test(v.name) ? 'an' : 'a'} ${v.name} (${Theory.stripOct(v.lo)}–${Theory.stripOct(v.hi)})`;
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
      const word = p1 === '5' ? '5ths' : p1 === '1' && p2 === '1' ? 'unisons' : p1 === '1' || p2 === '1' ? 'octaves and unisons' : 'octaves';
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

/* =================================================================
   VoiceView: several voices in notation
   VoiceView.svg({ voices, staves: 'grand' | 'single' | 'two', clef (for 'single'), clefs ([top, bottom] for 'two'),
     key and mode ('E♭', 'minor'; or key 'E♭ minor') or keySig, labels (under the bass: Roman numerals with figures, e.g. 'V65', 'I64', 'V7/V'),
     marks: [{ col, voice, kind: 'error' | 'warn' | 'ok' | 'found' | 'hint' }],
     lines: [{ from: { col, voice }, to: { col, voice }, kind }] (e.g. two voices moving in parallel 5ths),
     sel: { col, voice }, durations ('w' | 'h' | 'q', one per column, or one array per voice), style (sets the defaults:
     chorale half notes, species1 whole notes, species2 and 4 halves against a whole-note cantus), held ([voices whose
     nulls continue the note before], default the cantus in species 2 and 4), cantus, barCols (columns per bar), ties
     (tie a note into the same note at the start of a bar: species 4), editable (a hit area per cell with data-col and
     data-voice), placeholders (true: dashed heads in every empty editable cell; or a list of { col, voice }), fixed
     ([given voices], drawn quieter), playing (a column to light up),
     names, aria }) → SVG string
   Two voices on one staff share it: the upper voice's stems go up, the lower voice's down. Default staves: four voices on
   a grand staff (soprano and alto above, tenor and bass below); two voices on one staff when they both fit it, else
   on a grand staff.
   ================================================================= */
const VV_NAMES4 = ['Soprano', 'Alto', 'Tenor', 'Bass'];
/* the clef that suits a set of MIDI notes */
function vvClefFor(ms) {
  if (!ms.length) return 'treble';
  const lo = Math.min(...ms), hi = Math.max(...ms);
  if (lo >= 57) return 'treble';
  if (hi <= 64) return 'bass';
  return (lo + hi) / 2 >= 60 ? 'treble' : 'bass';
}
/* a Roman numeral with its figures: main text, then the figure (one number up high, two stacked), then any '/V' */
function vvLabel(x, y, text) {
  const m = /^([^/]*?)(64|65|43|42|7|6|2)?(\/.*)?$/.exec(String(text)) || [null, String(text)];
  const main = vlPrettyRoman(m[1] || ''), fig = m[2] || '', tail = m[3] ? vlPrettyRoman(m[3]) : '';
  /* tspans let the browser measure: a stacked figure steps back by one figure's width (10 px monospace) */
  let s = esc(main);
  if (fig.length === 1) s += `<tspan class="vv-fig" dy="-7">${fig}</tspan>${tail ? `<tspan dy="7">${esc(tail)}</tspan>` : ''}`;
  else if (fig) s += `<tspan class="vv-fig" dy="-8">${fig[0]}</tspan><tspan class="vv-fig" dx="-6" dy="10">${fig[1]}</tspan>${tail ? `<tspan dy="-2">${esc(tail)}</tspan>` : ''}`;
  else s += esc(tail);
  return `<text class="vv-lab" x="${ntN(x)}" y="${ntN(y)}" text-anchor="middle">${s}</text>`;
}
function vvSvg(o) {
  o = o || {};
  const raw = o.voices || [], n = raw.length, cols = raw.reduce((x, v) => Math.max(x, (v || []).length), 0);
  /* key: 'E♭' with mode, or 'E♭ minor' as sketches store it */
  const km = /^(\S+)\s+(major|minor)$/.exec(String(o.key || ''));
  const key = Theory.stripOct(km ? km[1] : o.key || 'C'), mode = km ? km[2] : o.mode === 'minor' ? 'minor' : 'major';
  const ks = o.keySig != null ? o.keySig : o.key ? Theory.keySig(key, mode).n : 0, nAcc = Math.abs(ks);
  const style = o.style || (n >= 3 ? 'chorale' : 'free'), sp = /^species/.test(style) ? +style.slice(7) || 1 : 0;
  const N = raw.map(v => Array.from({ length: cols }, (_, c) => vlNote((v || [])[c], key, mode)));
  const cantus = o.cantus != null ? o.cantus : sp ? n - 1 : null;
  const held = new Set(o.held || (sp === 2 || sp === 4 ? [cantus] : []));
  const fixed = new Set(o.fixed || []);
  const barCols = o.barCols || (sp === 1 ? 1 : 2);
  /* durations per voice and column */
  const D = raw.map((v, k) => Array.from({ length: cols }, (_, c) => {
    const d = o.durations;
    if (Array.isArray(d)) { const x = Array.isArray(d[k]) ? d[k][c] : d[c]; if (x) return x; }
    else if (typeof d === 'string') return held.has(k) ? 'w' : d;
    if (held.has(k)) return 'w';
    /* species 2 and 4: a note alone in the last bar fills it */
    if ((sp === 2 || sp === 4) && c % barCols === 0 && c + barCols >= cols && !(v || []).slice(c + 1).some(x => x != null)) return 'w';
    return sp === 1 ? 'w' : 'h';
  }));
  /* staves */
  const all = [].concat(...N.map(v => v.filter(Boolean).map(x => x.m)));
  let kind = o.staves;
  if (!kind) {
    if (n !== 2) kind = 'grand';
    else { const c = vvClefFor(all), lo = Math.min(...all.concat([60])), hi = Math.max(...all.concat([60])); kind = (c === 'treble' ? lo >= 55 : hi <= 67) ? 'single' : 'grand'; }
  }
  let staffs;
  if (kind === 'single') staffs = [{ clef: o.clef || vvClefFor(all), vs: raw.map((v, k) => k) }];
  else {
    const split = Math.ceil(n / 2), groups = [raw.map((v, k) => k).slice(0, split), raw.map((v, k) => k).slice(split)];
    const clefs = o.clefs || (kind === 'grand' ? ['treble', 'bass'] : groups.map(g => vvClefFor([].concat(...g.map(k => N[k].filter(Boolean).map(x => x.m))))));
    staffs = groups.map((g, i) => ({ clef: clefs[i], vs: g }));
  }
  const staffOf = [];
  staffs.forEach((s, i) => { s.CL = NT_CLEFS[s.clef] || NT_CLEFS.treble; s.vs.forEach(k => { staffOf[k] = i; }); });
  const ext = (s, st) => 4 * NT_GAP - (st - s.CL.bottom) * NT_HALF;   /* y of a staff step, relative to the staff's top line */
  /* a default step for an empty cell: the voice's nearest written note, else the middle of its range */
  const DEF = n === 4 ? [35, 31, 25, 20] : null;
  function ghostStep(k, c) {
    for (let d = 1; d < cols; d++) { const a = N[k][c - d], b = N[k][c + d]; if (a) return a.step; if (b) return b.step; }
    if (DEF) return DEF[k];
    const s = staffs[staffOf[k]];
    return s.CL.bottom + (s.vs.length > 1 && s.vs.indexOf(k) === 0 ? 6 : s.vs.length > 1 ? 2 : 4);
  }
  /* what is drawn in each cell */
  const editable = new Set(o.editable ? raw.map((v, k) => k).filter(k => !fixed.has(k)) : []);
  const marks = {}; (o.marks || []).forEach(mk => { marks[mk.col + ':' + mk.voice] = mk.kind || 'error'; });
  const cells = [];
  for (let c = 0; c < cols; c++) {
    cells[c] = [];
    for (let k = 0; k < n; k++) {
      const x = N[k][c];
      const cont = !x && held.has(k) && N[k].slice(0, c).some(Boolean);
      const isSel = o.sel && o.sel.col === c && o.sel.voice === k;
      const ph = Array.isArray(o.placeholders) ? o.placeholders.some(p => p.col === c && p.voice === k) : o.placeholders && editable.has(k);
      if (x) cells[c].push({ k, x, step: x.step, d: D[k][c] });
      else if (!cont && (isSel || ph)) cells[c].push({ k, ghost: true, step: ghostStep(k, c), d: 'h', sel: isSel });
    }
  }
  /* stems, collisions and accidentals, per staff and column */
  const state = staffs.map(() => new Map());
  const keyAcc = {}; (ks > 0 ? Theory.ORDER_SHARPS : Theory.ORDER_FLATS).slice(0, nAcc).forEach(l => { keyAcc[l] = ks > 0 ? 1 : -1; });
  const lead = [], tail = [];
  for (let c = 0; c < cols; c++) {
    if (c % barCols === 0) state.forEach(m => m.clear());
    let L = 13, T = 13;
    staffs.forEach((s, si) => {
      const here = cells[c].filter(e => staffOf[e.k] === si);
      const multi = s.vs.length > 1;
      here.forEach(e => {
        const rank = s.vs.indexOf(e.k);
        e.si = si;
        e.up = multi ? rank < s.vs.length / 2 : e.step < s.CL.bottom + 4;
        e.shift = 0;
        if (e.ghost) return;
        const q = Theory.parse(e.x.name), cur = state[si].has(e.step) ? state[si].get(e.step) : (keyAcc[Theory.LETTERS[q.L]] || 0);
        if (q.acc !== cur) e.acc = NT_ACC[q.acc] || '';
        state[si].set(e.step, q.acc);
      });
      /* a 2nd or a unison between neighbouring voices: the upper voice's head moves right (a unison of equal notes shares one head) */
      const real = here.filter(e => !e.ghost).sort((a, b) => a.k - b.k);
      for (let i = 0; i + 1 < real.length; i++) {
        const a = real[i], b = real[i + 1], gap = a.step - b.step;
        if (gap === 0 && a.x.m === b.x.m && a.d === b.d && a.d !== 'w' && a.up !== b.up) b.shared = true;
        else if (gap <= 1) { a.shift = 12; T = Math.max(T, 25); }
      }
      const accs = here.filter(e => e.acc).sort((a, b) => b.step - a.step);
      let lastStep = null, col = 0;
      accs.forEach(e => { col = lastStep != null && lastStep - e.step < 6 ? col + 1 : 0; e.accX = -15 - col * 10; lastStep = e.step; L = Math.max(L, 25 + col * 10); });
    });
    lead.push(L); tail.push(T);
  }
  const xKey = 44, xNotes = xKey + nAcc * 11 + (nAcc ? 6 : 0) + 10;
  const X = [], barX = [];
  let cx = xNotes;
  for (let c = 0; c < cols; c++) {
    X[c] = cx + lead[c];
    if (c > 0) X[c] = Math.max(X[c], X[c - 1] + 40);
    cx = X[c] + tail[c];
    if ((c + 1) % barCols === 0 && c + 1 < cols) { barX.push(cx + 4); cx += 10; }
  }
  const W = Math.max(o.minWidth || 0, Math.ceil(cx + 16));
  /* vertical room for each staff: heads, ledger lines and stems */
  const STEM = 34;
  staffs.forEach((s, si) => {
    let top = -14, bot = 54;
    for (let c = 0; c < cols; c++) cells[c].forEach(e => {
      if (e.si !== si) return;
      const y = ext(s, e.step);
      top = Math.min(top, y - 10, e.d !== 'w' && e.up && !e.ghost ? y - STEM - 2 : 0);
      bot = Math.max(bot, y + 10, e.d !== 'w' && !e.up && !e.ghost ? y + STEM + 2 : 0);
    });
    if (s.CL.cclef) top = Math.min(top, ext(s, 28) - 22);
    s.top = top; s.bot = bot;
  });
  let y = 8 - staffs[0].top;
  staffs.forEach((s, si) => { if (si) y += Math.max(staffs[si - 1].bot + 8, 0) - s.top + 10; s.Y = y; });
  const last = staffs[staffs.length - 1];
  const hasLabels = o.labels && o.labels.some(l => l != null && l !== '');
  const labelsY = last.Y + Math.max(last.bot, 50) + 16;
  const H = Math.ceil(hasLabels ? labelsY + 14 : last.Y + last.bot + 8);
  const yAt = e => staffs[e.si].Y + ext(staffs[e.si], e.step);
  /* drawing */
  let staffSvg = '', bg = '', notes = '', over = '', hits = '';
  staffs.forEach(s => {
    for (let i = 0; i < 5; i++) staffSvg += `<line class="vv-sl" x1="4" x2="${W - 4}" y1="${s.Y + i * NT_GAP}" y2="${s.Y + i * NT_GAP}"/>`;
    staffSvg += s.CL.cclef ? ntCClef(9, s.Y + ext(s, 28)) : `<text class="vv-clef" x="8" y="${s.Y + s.CL.dy}" font-size="${s.CL.size}">${s.CL.glyph}</text>`;
    const list = ks > 0 ? s.CL.sharps : s.CL.flats;
    for (let i = 0; i < nAcc; i++) staffSvg += `<text class="vv-acc" x="${xKey + i * 11}" y="${s.Y + ext(s, Staff.step(list[i])) + 5}" text-anchor="middle">${ks > 0 ? '♯' : '♭'}</text>`;
  });
  const sysTop = staffs[0].Y, sysBot = last.Y + 4 * NT_GAP;
  if (staffs.length > 1) staffSvg += `<line class="vv-bar" x1="4" x2="4" y1="${sysTop}" y2="${sysBot}"/>`;
  const barLine = x => staffs.length > 1 && kind !== 'two'
    ? `<line class="vv-bar" x1="${ntN(x)}" x2="${ntN(x)}" y1="${sysTop}" y2="${sysBot}"/>`
    : staffs.map(s => `<line class="vv-bar" x1="${ntN(x)}" x2="${ntN(x)}" y1="${s.Y}" y2="${s.Y + 4 * NT_GAP}"/>`).join('');
  barX.forEach(x => { staffSvg += barLine(x); });
  staffSvg += barLine(W - 10) + (staffs.length > 1 && kind !== 'two' ? `<rect class="vv-bar-end" x="${W - 7.5}" y="${sysTop}" width="4" height="${sysBot - sysTop}"/>` : staffs.map(s => `<rect class="vv-bar-end" x="${W - 7.5}" y="${s.Y}" width="4" height="${4 * NT_GAP}"/>`).join(''));
  const pos = {};
  for (let c = 0; c < cols; c++) {
    let g = '';
    cells[c].forEach(e => {
      const s = staffs[e.si], yy = yAt(e), x = X[c] + e.shift;
      pos[c + ':' + e.k] = { x, y: yy };
      const isSel = o.sel && o.sel.col === c && o.sel.voice === e.k;
      if (isSel) bg += `<rect class="vv-selbg" x="${ntN(X[c] - 15 + Math.min(0, e.accX || 0) + (e.acc ? 4 : 0))}" y="${ntN(s.Y - 12)}" width="${ntN(30 + e.shift + (e.acc ? -(e.accX || 0) - 4 : 0))}" height="${4 * NT_GAP + 24}" rx="6"/>`;
      if (e.ghost) { g += `<ellipse class="vv-ph${isSel ? ' sel' : ''}" cx="${ntN(x)}" cy="${ntN(yy)}" rx="6.4" ry="4.6" transform="rotate(-20 ${ntN(x)} ${ntN(yy)})"/>`; return; }
      const mk = marks[c + ':' + e.k];
      const cls = ['vv-n', 'vv-v' + e.k];
      if (mk) cls.push('vv-' + mk);
      if (isSel) cls.push('vv-sel');
      if (fixed.has(e.k)) cls.push('vv-fixed');
      let s2 = '';
      const top = s.CL.bottom + 8;
      for (let st = top + 2; st <= e.step; st += 2) s2 += `<line class="vv-ledger" x1="${ntN(x - 10)}" x2="${ntN(x + 10)}" y1="${ntN(s.Y + ext(s, st))}" y2="${ntN(s.Y + ext(s, st))}"/>`;
      for (let st = s.CL.bottom - 2; st >= e.step; st -= 2) s2 += `<line class="vv-ledger" x1="${ntN(x - 10)}" x2="${ntN(x + 10)}" y1="${ntN(s.Y + ext(s, st))}" y2="${ntN(s.Y + ext(s, st))}"/>`;
      if (e.acc) s2 += `<text class="vv-acc" x="${ntN(X[c] + e.accX)}" y="${ntN(yy + 5)}" text-anchor="middle">${e.acc}</text>`;
      if (!e.shared) s2 += ntHead(x, yy, e.d);
      if (mk === 'error' || mk === 'warn' || mk === 'found') s2 += `<circle class="vv-ring vv-ring-${mk}" cx="${ntN(x)}" cy="${ntN(yy)}" r="10"/>`;
      if (e.d !== 'w') {
        const hx = e.shared ? X[c] : x;
        s2 += e.up ? `<line class="vv-stem" x1="${ntN(hx + 5.6)}" x2="${ntN(hx + 5.6)}" y1="${ntN(yy - 1)}" y2="${ntN(yy - STEM)}"/>` : `<line class="vv-stem" x1="${ntN(hx - 5.6)}" x2="${ntN(hx - 5.6)}" y1="${ntN(yy + 1)}" y2="${ntN(yy + STEM)}"/>`;
      }
      g += `<g class="${cls.join(' ')}" data-col="${c}" data-voice="${e.k}">${s2}</g>`;
    });
    notes += `<g class="vv-col${o.playing === c ? ' vv-now' : ''}" data-c="${c}">${g}</g>`;
  }
  /* ties: a note held into the same note at the start of the next bar */
  if (o.ties || sp === 4) {
    for (let c = 1; c < cols; c++) {
      if (c % barCols !== 0) continue;
      for (let k = 0; k < n; k++) {
        const a = N[k][c - 1], b = N[k][c];
        if (!a || !b || a.m !== b.m || held.has(k)) continue;
        const p = pos[(c - 1) + ':' + k], q = pos[c + ':' + k];
        const e = cells[c].find(z => z.k === k), sg = e && e.up ? 1 : -1;
        const x1 = p.x + 7, x2 = q.x - 7, yy = p.y + sg * 6, mx = (x1 + x2) / 2, h = sg * Math.min(9, 4 + (x2 - x1) * 0.05);
        over += `<path class="vv-tie" d="M${ntN(x1)} ${ntN(yy)}Q${ntN(mx)} ${ntN(yy + 2 * h)} ${ntN(x2)} ${ntN(yy)}Q${ntN(mx)} ${ntN(yy + 2 * h - sg * 2.6)} ${ntN(x1)} ${ntN(yy)}Z"/>`;
      }
    }
  }
  /* lines between notes (parallels, motion) */
  (o.lines || []).forEach(l => {
    const p = pos[l.from.col + ':' + l.from.voice], q = pos[l.to.col + ':' + l.to.voice];
    if (!p || !q) return;
    const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1, cut = 8;
    over += `<line class="vv-line ${l.kind || 'error'}" x1="${ntN(p.x + dx / len * cut)}" y1="${ntN(p.y + dy / len * cut)}" x2="${ntN(q.x - dx / len * cut)}" y2="${ntN(q.y - dy / len * cut)}"/>`;
  });
  /* labels under the bass */
  let labs = '';
  if (hasLabels) o.labels.forEach((l, c) => { if (l != null && l !== '' && X[c] != null) labs += vvLabel(X[c], labelsY, l); });
  /* hit areas: each column split between the voices of each staff at the midpoints of their notes */
  if (o.editable) {
    for (let c = 0; c < cols; c++) {
      const xl = c ? (X[c - 1] + X[c]) / 2 : X[c] - 22, xr = c + 1 < cols ? (X[c] + X[c + 1]) / 2 : X[c] + 22;
      staffs.forEach((s, si) => {
        const ys = s.vs.map(k => { const e = cells[c].find(z => z.k === k); return s.Y + ext(s, e ? e.step : ghostStep(k, c)); });
        s.vs.forEach((k, i) => {
          const y0 = i === 0 ? s.Y + s.top : (ys[i - 1] + ys[i]) / 2, y1 = i === s.vs.length - 1 ? s.Y + s.bot : (ys[i] + ys[i + 1]) / 2;
          hits += `<rect class="vv-hit" data-col="${c}" data-voice="${k}" x="${ntN(xl)}" y="${ntN(Math.min(y0, y1))}" width="${ntN(xr - xl)}" height="${ntN(Math.max(4, Math.abs(y1 - y0)))}"/>`;
        });
      });
    }
  }
  const names = o.names || (n === 4 ? VV_NAMES4 : n === 2 ? (sp ? (cantus === 0 ? ['Cantus', 'Counterpoint'] : ['Counterpoint', 'Cantus']) : ['Upper voice', 'Lower voice']) : raw.map((v, k) => 'Voice ' + (k + 1)));
  const aria = o.aria || `${n === 4 ? 'Four' : n === 2 ? 'Two' : n} voices, ${cols} ${n >= 3 ? 'chord' : 'note'}${cols === 1 ? '' : 's'}${o.key ? ' in ' + Theory.keyName(key, mode) : ''}. `
    + N.map((v, k) => `${vlCap(names[k])}: ${v.map((x, c) => x ? Theory.pretty(x.name) : held.has(k) && v.slice(0, c).some(Boolean) ? 'held' : 'blank').join(', ')}.`).join(' ')
    + (hasLabels ? ` Numerals: ${o.labels.map(l => l ? vlPrettyRoman(l) : 'none').join(', ')}.` : '');
  return `<svg class="vv" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(aria)}">${bg}${staffSvg}${notes}${over}${labs}${hits}</svg>`;
}
const VoiceView = { svg: vvSvg, clefFor: vvClefFor };

/* =================================================================
   PartWriter: write voices against given ones, checked as you go
   PartWriter.mount(el, opts) → { voices, problems, set(voices), select(col, voice), play(), destroy() }
   opts: { voices: 2 | 4 (default 4), cols, key, mode, style ('chorale' default for four voices; 'species1' for two with a
           cantus), romans (shown under the bass and used by the checker),
           given: { cantus, soprano | upper, alto, tenor, bass | lower } (fixed lines, one entry per column; a cantus may
                  give one note per bar in species 2 and 4), cantusAbove (two voices: the cantus is the upper one),
           initial (voices to start from), names, staves, beats, secPerCol (playback, seconds per column), skip ([{ col, voice }]
           cells that stay empty; species 2 and 4 skip the cells a whole note or the opening rest covers), check (extra
           VoiceLead.check options), order ('column' for four voices, 'voice' for two: where the selection goes after a note),
           mic (default true), sing (default true: a Sing along button when one voice is written against a given one: after
           a count-in the given voice plays and each column takes the note sung, or played on the keys, in its time),
           onChange(voices, problems) }
   Select a cell by clicking it (or a voice button), then play a note: on-screen keys, computer keys A–K, MIDI, or the
   mic. The note keeps the octave you played. With the score focused: ←/→ column, ↑/↓ half step (an empty cell gets a
   note), Shift+↑/↓ octave, Alt+↑/↓ or Page Up/Down voice, Delete clears, Enter plays the column. Problems show as
   marks and as sentences under the score, errors first; click a sentence to jump to it.
   ================================================================= */
let pwUid = 0;
function pwSetup(o) {
  const n = o.voices === 2 ? 2 : (o.voices || 4);
  const given = o.given || {};
  const style = o.style || (n === 2 && given.cantus ? 'species1' : 'chorale');
  const sp = /^species/.test(style) ? +style.slice(7) || 1 : 0;
  /* where each given line goes */
  const lines = new Array(n).fill(null);
  const put = (k, line) => { if (line && k >= 0 && k < n) lines[k] = line.slice(); };
  if (n === 2) {
    put(0, given.soprano || given.upper); put(1, given.bass || given.lower);
    if (given.cantus) put(o.cantusAbove ? 0 : 1, given.cantus);
  } else { put(0, given.soprano); put(1, given.alto); put(n - 2, given.tenor); put(n - 1, given.bass); }
  const per = sp === 2 || sp === 4 ? 2 : 1;
  let cols = o.cols || 0;
  lines.forEach(l => { if (l) cols = Math.max(cols, l.length); });
  if (o.romans) cols = Math.max(cols, o.romans.length);
  (o.initial || []).forEach(v => { if (v) cols = Math.max(cols, v.length); });
  /* a cantus given one note per bar spreads over the bar's columns */
  if (per > 1 && given.cantus) {
    const k = n === 2 && o.cantusAbove ? 0 : n - 1;
    if (lines[k] && !lines[k].some(x => x == null) && (!o.cols || lines[k].length * per <= cols) && lines[k].length * per >= cols) {
      const spread = []; lines[k].forEach(x => { spread.push(x); spread.push(null); });
      lines[k] = spread; cols = Math.max(cols, spread.length);
    }
  }
  const fixed = lines.map((l, k) => (l ? k : -1)).filter(k => k >= 0);
  const cantus = n === 2 && given.cantus ? (o.cantusAbove ? 0 : 1) : null;
  const skip = new Set((o.skip || []).map(s => s.col + ':' + s.voice));
  if (per > 1 && cantus != null && !o.skip) {
    const cp = 1 - cantus;
    if (sp === 4) skip.add('0:' + cp);
    if (cols % 2 === 0) skip.add((cols - 1) + ':' + cp);
  }
  return { n, given, style, sp, lines, cols, fixed, cantus, skip, per };
}
const PartWriter = {
  mount(el, o) {
    o = Object.assign({ key: 'C', mode: 'major', mic: true, sing: true }, o || {});
    const S = pwSetup(o), n = S.n, cols = S.cols, key = Theory.stripOct(o.key), mode = o.mode === 'minor' ? 'minor' : 'major';
    const fixed = new Set(S.fixed), uid = ++pwUid;
    const names = o.names || (n === 4 ? ['soprano', 'alto', 'tenor', 'bass'] : S.cantus != null ? (S.cantus === 0 ? ['cantus', 'counterpoint'] : ['counterpoint', 'cantus']) : ['upper voice', 'lower voice']);
    const romans = o.romans || null, chordsOn = romans && !S.sp;
    const secPerCol = o.secPerCol || (S.sp === 1 ? 1.1 : S.sp ? 0.7 : 1);
    const order = o.order || (n === 4 ? 'column' : 'voice');
    const chordNotes = c => { const ch = chordsOn ? vlRoman(romans[c], key, mode) : null; return ch ? ch.notes : null; };
    const spell = (m, c) => vlSpell(m, key, mode, chordNotes(c));
    const norm = (x, c) => { const nn = vlNote(x, key, mode, chordNotes(c)); return nn ? nn.name : null; };
    /* the grid of note names */
    let V = Array.from({ length: n }, (_, k) => Array.from({ length: cols }, (_, c) => {
      if (S.lines[k]) return norm(S.lines[k][c], c);
      const init = o.initial && o.initial[k];
      return init ? norm(init[c], c) : null;
    }));
    const editable = (c, k) => c >= 0 && c < cols && k >= 0 && k < n && !fixed.has(k) && !S.skip.has(c + ':' + k);
    const checkOpts = () => Object.assign({ key, mode, style: S.style, romans: chordsOn ? romans : null, fixed: S.fixed, names, beats: o.beats }, S.cantus != null ? { cantus: S.cantus } : {}, o.check || {});
    let problems = [], sel = null, timers = [], singing = null, clearArm = 0, alive = true;
    const firstEmpty = () => { for (let c = 0; c < cols; c++) for (let k = 0; k < n; k++) if (editable(c, k) && !V[k][c]) return { col: c, voice: k }; return null; };
    const firstEditable = () => { for (let c = 0; c < cols; c++) for (let k = 0; k < n; k++) if (editable(c, k)) return { col: c, voice: k }; return null; };
    sel = firstEmpty() || firstEditable();
    const voiceBtns = names.map((nm, k) => `<button type="button" class="choice" data-v="${k}"${fixed.has(k) ? ' disabled' : ''} aria-pressed="false">${esc(vlCap(nm))}${fixed.has(k) ? ' (given)' : ''}</button>`).join('');
    el.innerHTML = `<div class="pw">
      <div class="pw-top"><span class="chip live">${esc(Theory.keyName(key, mode))}</span><div class="pw-voices" role="group" aria-label="Voice to write">${voiceBtns}</div></div>
      <div class="vv-box pw-score" tabindex="0" role="group" aria-label="The score. Click a note or a blank to select it. Arrow keys move and change notes."></div>
      <div class="pw-ed" role="toolbar" aria-label="Edit the selected note">
        <button type="button" class="btn small" data-e="prev" aria-label="Previous column" title="Previous column (←)">←</button><button type="button" class="btn small" data-e="next" aria-label="Next column" title="Next column (→)">→</button>
        <button type="button" class="btn small" data-e="up" aria-label="Half step up" title="Half step up (↑)">↑</button><button type="button" class="btn small" data-e="down" aria-label="Half step down" title="Half step down (↓)">↓</button>
        <button type="button" class="btn small" data-e="oup" title="Octave up (Shift+↑)">8va ↑</button><button type="button" class="btn small" data-e="odown" title="Octave down (Shift+↓)">8va ↓</button>
        <button type="button" class="btn small ghost" data-e="del" title="Clear this note (Delete)">Clear note</button>
      </div>
      <p class="pw-info" aria-live="polite"></p>
      <div class="row"><button type="button" class="btn small" data-a="play">▶ Play all</button><button type="button" class="btn small" data-a="one">▶ Play this voice</button>${o.sing && n === 2 && fixed.size === 1 ? '<button type="button" class="btn small" data-a="sing">Sing along</button>' : ''}<button type="button" class="btn small ghost" data-a="clear">Clear all</button></div>
      <div class="pw-msg"><p class="fb info" aria-live="polite"></p></div>
      <p class="pw-count" aria-live="polite"></p>
      <ul class="pw-probs"></ul>
    </div>`;
    const $ = s => el.querySelector(s);
    const box = $('.pw-score'), info = $('.pw-info'), f = $(".pw-msg .fb"), count = $('.pw-count'), list = $('.pw-probs');
    const bOne = $('[data-a="one"]'), bClear = $('[data-a="clear"]'), bSing = $('[data-a="sing"]');
    const colName = c => 'beat ' + (c + 1);
    function describe() {
      if (!sel) return 'Every note is given here.';
      const x = V[sel.voice][sel.col];
      return `${vlCap(colName(sel.col))}, ${names[sel.voice]}: ${x ? Theory.pretty(x) + '. Play a note to change it, or ↑ ↓ to move it.' : 'blank. Play a note, or press ↑ to write one.'}`;
    }
    const RULE_LINES = ['parallel5', 'parallel8', 'parallelUnison', 'contrary5', 'contrary8', 'direct5', 'direct8'];
    function render() {
      problems = vlCheck(V, checkOpts());
      const marks = [], lines = [], seen = {};
      problems.forEach(p => {
        p.voices.forEach(v => p.cols.forEach(c => {
          const k = c + ':' + v;
          if (seen[k] === 'error') return;
          seen[k] = p.severity === 'error' ? 'error' : (seen[k] || 'warn');
        }));
        if (RULE_LINES.indexOf(p.rule) >= 0 && p.cols.length === 2) p.voices.forEach(v => lines.push({ from: { col: p.cols[0], voice: v }, to: { col: p.cols[1], voice: v }, kind: p.severity }));
      });
      Object.keys(seen).forEach(k => { const [c, v] = k.split(':').map(Number); marks.push({ col: c, voice: v, kind: seen[k] }); });
      const ph = [];
      for (let c = 0; c < cols; c++) for (let k = 0; k < n; k++) if (editable(c, k) && !V[k][c]) ph.push({ col: c, voice: k });
      box.innerHTML = vvSvg({ voices: V, key, mode, style: S.style, labels: romans, marks, lines, sel, editable: true, placeholders: ph, fixed: S.fixed, staves: o.staves, cantus: S.cantus, names: names.map(vlCap) });
      el.querySelectorAll('[data-v]').forEach(b => b.setAttribute('aria-pressed', String(!!sel && +b.dataset.v === sel.voice)));
      bOne.textContent = '▶ Play ' + (sel ? names[sel.voice] : 'one voice');
      info.textContent = describe();
      const sum = VoiceLead.summary(problems), filled = V.some((v, k) => !fixed.has(k) && v.some(Boolean));
      const words = (x, w) => `${x} ${w}${x === 1 ? '' : 's'}`;
      count.textContent = !filled ? '' : sum.errors ? `${words(sum.errors, 'error')}${sum.warnings ? ' and ' + words(sum.warnings, 'warning') : ''}.` : sum.warnings ? `No errors. ${words(sum.warnings, 'warning')}: worth a look, but allowed.` : 'No problems so far.';
      const shown = problems.slice(0, 12);
      list.innerHTML = shown.map((p, i) => `<li class="${p.severity}"><span class="pw-kind">${p.severity === 'error' ? 'Error' : 'Warning'}</span><button type="button" data-p="${i}"><span class="pw-rule">${esc(VL_RULES[p.rule].name)}.</span> ${esc(p.text)}</button></li>`).join('')
        + (problems.length > shown.length ? `<li class="warn"><span class="pw-kind">More</span><span>${problems.length - shown.length} more after you fix these.</span></li>` : '');
    }
    const emit = () => { if (o.onChange) o.onChange(V.map(v => v.slice()), problems.slice()); };
    function setCell(c, k, name, quiet) {
      V[k][c] = name;
      render(); emit();
      if (name && !quiet) Sound.tone(Theory.midi(name), null, 0.5, 0.75);
    }
    /* after a note: the next empty cell, voice by voice or column by column */
    function advance() {
      if (!sel) return;
      const cells = [];
      if (order === 'voice') { for (let c = sel.col + 1; c < cols; c++) cells.push([c, sel.voice]); for (let c = 0; c < cols; c++) for (let k = 0; k < n; k++) cells.push([c, k]); }
      else { for (let k = sel.voice + 1; k < n; k++) cells.push([sel.col, k]); for (let c = sel.col + 1; c < cols; c++) for (let k = 0; k < n; k++) cells.push([c, k]); for (let c = 0; c <= sel.col; c++) for (let k = 0; k < n; k++) cells.push([c, k]); }
      const nx = cells.find(([c, k]) => editable(c, k) && !V[k][c]);
      if (nx) sel = { col: nx[0], voice: nx[1] };
      else { const c = Math.min(cols - 1, sel.col + 1); if (editable(c, sel.voice)) sel = { col: c, voice: sel.voice }; }
    }
    function select(c, k) {
      if (!editable(c, k)) {
        if (V[k] && V[k][c]) { Sound.tone(Theory.midi(V[k][c]), null, 0.6, 0.7); fb(f, 'info', `The ${names[k]} is given: ${Theory.pretty(V[k][c])}.`); }
        return;
      }
      sel = { col: c, voice: k }; render();
    }
    function moveCol(d) {
      if (!sel) return;
      for (let c = sel.col + d; c >= 0 && c < cols; c += d) if (editable(c, sel.voice)) { sel = { col: c, voice: sel.voice }; render(); return; }
    }
    function moveVoice(d) {
      if (!sel) return;
      for (let k = sel.voice + d; k >= 0 && k < n; k += d) if (editable(sel.col, k)) { sel = { col: sel.col, voice: k }; render(); return; }
    }
    function nudge(by) {
      if (!sel) return;
      const x = V[sel.voice][sel.col];
      let m;
      if (!x) {
        /* an empty cell gets the note its neighbours suggest */
        const row = V[sel.voice];
        let near = null; for (let d = 1; d < cols && !near; d++) near = row[sel.col - d] || row[sel.col + d] || null;
        m = near ? Theory.midi(near) : (n === 4 ? [72, 65, 57, 48][sel.voice] : sel.voice === 0 ? 72 : 55);
      } else m = Theory.midi(x) + by;
      if (m < 28 || m > 96) { fb(f, 'info', 'That is as far as it goes.'); return; }
      setCell(sel.col, sel.voice, spell(m, sel.col));
    }
    function clearCell() { if (sel && V[sel.voice][sel.col]) { setCell(sel.col, sel.voice, null); fb(f, 'info', 'Cleared.'); } }
    /* playback */
    function stopPlay() { timers.forEach(clearTimeout); timers = []; box.querySelectorAll('.vv-now').forEach(g => g.classList.remove('vv-now')); }
    function notesOf(which) {
      const out = [];
      V.forEach((row, k) => {
        if (which != null && which !== k) return;
        let cur = null;
        row.forEach((x, c) => {
          const tie = cur && x && Theory.midi(x) === cur.m && S.sp === 4 && c % 2 === 0;
          if (!x) { if (cur && (S.sp === 2 || S.sp === 4) && (k === S.cantus || c === cols - 1)) cur.d += secPerCol; else cur = null; return; }
          if (tie) { cur.d += secPerCol; return; }
          cur = { m: Theory.midi(x), t: +(c * secPerCol).toFixed(3), d: secPerCol, v: k === 0 || k === n - 1 ? 0.7 : 0.5 };
          out.push(cur);
        });
      });
      return out.map(x => Object.assign({}, x, { d: +(x.d * 0.94).toFixed(3) }));
    }
    /* light each column as it sounds, `lead` ms from now */
    function lights(lead) {
      for (let c = 0; c < cols; c++) timers.push(setTimeout(() => {
        box.querySelectorAll('.vv-now').forEach(g => g.classList.remove('vv-now'));
        const g = box.querySelector(`.vv-col[data-c="${c}"]`); if (g) g.classList.add('vv-now');
      }, lead + c * secPerCol * 1000));
    }
    function play(which) {
      if (singing) return;
      stopPlay();
      const ns = notesOf(which);
      if (!ns.length) { fb(f, 'info', 'Nothing to play yet.'); return; }
      Sound.seq(ns);
      lights(80);
      timers.push(setTimeout(stopPlay, 80 + cols * secPerCol * 1000));
    }
    function playCol(c) { const ms = V.map(v => v[c]).filter(Boolean).map(Theory.midi); if (ms.length) Sound.chord(ms, null, 1.1, 0.5); }
    /* sing (or play) along: after a count-in the given voice plays, the mic stays open, and each column takes the last
       note that arrives in its time (from the mic, or the keys; a note up to a quarter of a column early counts) */
    function singAlong() {
      if (singing) return;
      const ctx = Sound.ensure(); if (!ctx) return;
      stopPlay();
      const k = [0, 1].find(v => !fixed.has(v)), gain = ctx.createGain(); gain.gain.value = 1; gain.connect(Sound.master);
      const spb = secPerCol, t0 = ctx.currentTime + 0.2 + 4 * spb * 0.5, mic = Mic.state === 'on';
      Sound.routed(gain, () => {
        for (let b = 0; b < 4; b++) Sound.click(ctx.currentTime + 0.2 + b * spb * 0.5, b === 0, false);
        notesOf(S.cantus).forEach(x => Sound.tone(x.m, t0 + x.t, x.d, 0.55));
      }, { gate: false });
      singing = { k, t0, got: {} };
      bSing.disabled = true;
      lights((t0 - ctx.currentTime) * 1000);
      fb(f, 'info', mic ? 'Count-in… then sing your line, one note per column. Headphones keep the cantus out of the mic.' : 'Count-in… then play your line on the keys, one note per column. Turn on the mic to sing it instead.');
      const finish = () => {
        const s = singing; singing = null; bSing.disabled = false;
        box.querySelectorAll('.vv-now').forEach(g => g.classList.remove('vv-now'));
        try { gain.disconnect(); } catch (e) { /* gone */ }
        let got = 0;
        Object.keys(s.got).forEach(c => { if (editable(+c, s.k)) { V[s.k][+c] = spell(s.got[c], +c); got++; } });
        render(); emit();
        fb(f, got ? 'good' : 'info', got ? `${got} note${got === 1 ? '' : 's'} written down. Fix any by selecting it and playing, or with the arrows.` : `No notes came in. Try again${mic ? ', a little louder' : ''}.`);
      };
      timers.push(setTimeout(finish, (t0 - ctx.currentTime + cols * spb + 0.4) * 1000));
    }
    /* input */
    const offs = [];
    offs.push(Bus.on('note', d => {
      if (!alive) return;
      if (d.source === 'mic' && !o.mic) return;
      if (singing) {
        const t = (d.t != null ? d.t : Sound.now()) - (d.source === 'mic' ? (Store.data.settings.micLatency || 0) / 1000 : 0);
        const c = Math.floor((t - singing.t0) / secPerCol + 0.25);
        if (c >= 0 && c < cols) singing.got[c] = d.midi;
        return;
      }
      if (!sel || !editable(sel.col, sel.voice)) return;
      const c = sel.col, k = sel.voice;
      V[k][c] = spell(d.midi, c);
      advance(); render(); emit();
      fb(f, 'info', '');
    }));
    box.addEventListener('click', ev => {
      const t = ev.target.closest && ev.target.closest('[data-col][data-voice]');
      if (!t) return;
      select(+t.getAttribute('data-col'), +t.getAttribute('data-voice'));
      try { box.focus({ preventScroll: true }); } catch (e) { box.focus(); }
    });
    box.addEventListener('keydown', ev => {
      let handled = true;
      const k = ev.key;
      if ((k === 'ArrowUp' || k === 'ArrowDown') && ev.altKey) moveVoice(k === 'ArrowUp' ? -1 : 1);
      else if (k === 'PageUp' || k === 'PageDown') moveVoice(k === 'PageUp' ? -1 : 1);
      else if (k === 'ArrowUp' || k === 'ArrowDown') nudge((k === 'ArrowUp' ? 1 : -1) * (ev.shiftKey ? 12 : 1));
      else if (k === 'ArrowLeft' || k === 'ArrowRight') moveCol(k === 'ArrowLeft' ? -1 : 1);
      else if (k === 'Home' || k === 'End') { if (sel) { const c0 = k === 'Home' ? 0 : cols - 1; moveCol(0); for (let c = c0; c >= 0 && c < cols; c += k === 'Home' ? 1 : -1) if (editable(c, sel.voice)) { sel = { col: c, voice: sel.voice }; render(); break; } } }
      else if (k === 'Delete' || k === 'Backspace') clearCell();
      else if (k === 'Enter') { if (sel) playCol(sel.col); }
      else handled = false;
      if (handled) { ev.preventDefault(); ev.stopPropagation(); }
    });
    el.querySelectorAll('[data-e]').forEach(b => { b.onclick = () => ({ prev: () => moveCol(-1), next: () => moveCol(1), up: () => nudge(1), down: () => nudge(-1), oup: () => nudge(12), odown: () => nudge(-12), del: clearCell })[b.dataset.e](); });
    el.querySelectorAll('[data-v]').forEach(b => { b.onclick = () => { const k = +b.dataset.v; if (!sel) return; if (editable(sel.col, k)) select(sel.col, k); else { for (let c = 0; c < cols; c++) if (editable(c, k)) { select(c, k); break; } } }; });
    list.addEventListener('click', ev => {
      const b = ev.target.closest('[data-p]'); if (!b) return;
      const p = problems[+b.dataset.p]; if (!p) return;
      const k = p.voices.find(v => editable(p.col, v));
      if (k != null) { sel = { col: p.col, voice: k }; render(); }
      try { box.focus({ preventScroll: true }); } catch (e) { box.focus(); }
    });
    $('[data-a="play"]').onclick = () => play(null);
    bOne.onclick = () => play(sel ? sel.voice : 0);
    if (bSing) bSing.onclick = singAlong;
    bClear.onclick = () => {
      if (!clearArm) { bClear.textContent = 'Clear all? Press again'; clearArm = setTimeout(() => { clearArm = 0; bClear.textContent = 'Clear all'; }, 3000); return; }
      clearTimeout(clearArm); clearArm = 0; bClear.textContent = 'Clear all';
      V = V.map((row, k) => row.map((x, c) => (editable(c, k) ? null : x)));
      sel = firstEmpty() || sel; render(); emit(); fb(f, 'info', 'Cleared. Start again from the first blank.');
    };
    render();
    return {
      get voices() { return V.map(v => v.slice()); },
      get problems() { return problems.slice(); },
      get selected() { return sel ? Object.assign({}, sel) : null; },
      get cols() { return cols; },
      /* how many editable cells there are, and how many hold a note */
      get progress() { let need = 0, have = 0; for (let c = 0; c < cols; c++) for (let k = 0; k < n; k++) if (editable(c, k)) { need++; if (V[k][c]) have++; } return { need, have }; },
      /* notes [{ m, t, d }] in seconds, every voice, as playback and sketches use them */
      get notes() { return notesOf(null); },
      secPerCol,
      set(voices) { V = V.map((row, k) => row.map((x, c) => (editable(c, k) ? norm(voices[k] ? voices[k][c] : null, c) : x))); render(); emit(); },
      select(c, k) { select(c, k); },
      play() { play(null); },
      destroy() { alive = false; offs.forEach(fn => fn()); stopPlay(); clearTimeout(clearArm); singing = null; }
    };
  }
};

/* PartWriter with a name and Save.
   p: { prompt, voices, cols, given, romans, key, mode, style, need ('no-errors' default | 'complete'), name, placeholder,
        initial, cantusAbove, staves, secPerCol, save: { level, tags, prompt, from, extra } }
   Save opens once every cell is written and (with 'no-errors') nothing is an error; warnings are allowed. It saves
   { name, notes (every voice, seconds), voices (note names, so it can be opened again), romans, style, key, level, tags,
   prompt, bpm }. done(true, { sketch, voices, problems }) */
Tasks.partWrite = (el, p, done) => {
  const id = 'pw-name-' + (++pwUid), sv = p.save || {}, need = p.need || 'no-errors';
  let saved = false, pw = null;
  el.innerHTML = `<div class="nt-task">${p.prompt ? `<p class="prompt">${p.prompt}</p>` : ''}<div class="pw-slot"></div><ul class="nt-checks"></ul>
    <div class="field"><label for="${id}">Name it</label><input id="${id}" type="text" maxlength="40" placeholder="${esc(p.placeholder || 'Give it a name')}" value="${esc(p.name || '')}"></div>
    <div class="row"><button type="button" class="btn primary" data-act="save" disabled>Save to sketchbook</button></div><p class="fb info pw-saved" aria-live="polite"></p></div>`;
  const checks = el.querySelector('.nt-checks'), bSave = el.querySelector('[data-act="save"]'), name = el.querySelector('#' + id), f = el.querySelector('.pw-saved');
  function refresh() {
    if (!pw) return;
    const pr = pw.progress, sum = VoiceLead.summary(pw.problems), full = pr.have >= pr.need;
    checks.innerHTML = `<li class="${full ? 'ok' : ''}">${full ? '✓' : '○'} Every note written (${pr.have} of ${pr.need})</li>`
      + (need === 'no-errors' ? `<li class="${sum.errors ? '' : 'ok'}">${sum.errors ? `○ ${sum.errors} error${sum.errors === 1 ? '' : 's'} to fix` : '✓ No errors'}${sum.warnings ? ` (${sum.warnings} warning${sum.warnings === 1 ? '' : 's'}: allowed)` : ''}</li>` : '');
    bSave.disabled = saved || !full || (need === 'no-errors' && sum.errors > 0);
  }
  pw = PartWriter.mount(el.querySelector('.pw-slot'), Object.assign({}, p, { onChange: () => { saved = false; f.textContent = ''; refresh(); } }));
  refresh();
  bSave.onclick = () => {
    const voices = pw.voices, problems = pw.problems, key = Theory.stripOct(p.key || 'C'), mode = p.mode === 'minor' ? 'minor' : 'major';
    const sketch = saveSketch(Object.assign({
      name: name.value.trim() || p.name || (voices.length === 4 ? 'Four voices ' : 'Two voices ') + (Store.data.sketches.length + 1),
      notes: pw.notes, voices, romans: p.romans || null, style: p.style || null, key: Theory.keyName(key, mode),
      level: sv.level, tags: sv.tags || [], from: sv.from, prompt: sv.prompt || p.prompt || '', bpm: Math.round(60 / pw.secPerCol)
    }, sv.extra || {}));
    saved = true; bSave.disabled = true;
    fb(f, 'good', `Saved “${sketch.name}” to your sketchbook.`);
    done(true, { sketch, voices, problems });
  };
  return () => pw.destroy();
};

/* Find the errors: a realization with planted mistakes. Tap a note that breaks a rule (or, with name: true, tap it and
   then name the rule). Done when every planted error is found; with fix: true the score then opens in the editor and is
   done once nothing is an error.
   p: { romans, key, mode, errors: ['parallel5', 'doubledLT', …], voices (a correct version to plant them in; default a
        realization of the numerals), prompt, name, fix, random }
   done(true, { found, misses, planted }) */
Tasks.findErrors = (el, p, done) => {
  const key = Theory.stripOct(p.key || 'C'), mode = p.mode === 'minor' ? 'minor' : 'major', romans = p.romans || null;
  const opts = { key, mode, romans, style: p.style || 'chorale', random: p.random };
  let res = vlPlant(p.voices || null, p.errors || ['parallel5'], opts);
  if (!res) {
    /* keep the errors that fit this progression */
    const kept = [];
    (p.errors || []).forEach(r => { if (vlPlant(p.voices || null, kept.concat([r]), opts)) kept.push(r); });
    res = kept.length ? vlPlant(p.voices || null, kept, opts) : null;
  }
  if (!res) { el.innerHTML = '<p class="fb info">This progression has no room for those errors.</p>'; done(true, { found: 0, misses: 0, planted: [] }); return () => {}; }
  const voices = res.voices, planted = res.planted, n = voices.length, cols = voices[0].length;
  const found = new Set(), okCells = new Set();
  let misses = 0, sel = { col: 0, voice: 0 }, naming = null, inner = null, finished = false, fixed = false;
  el.innerHTML = `<div class="nt-task">${p.prompt ? `<p class="prompt">${p.prompt}</p>` : `<p class="prompt">${planted.length === 1 ? 'One note breaks a rule' : planted.length + ' things break the rules'}. Tap ${planted.length === 1 ? 'it' : 'a note in each one'}.</p>`}
    <div class="row"><span class="chip live">${esc(Theory.keyName(key, mode))}</span><button type="button" class="btn small" data-act="play">▶ Play it</button><span class="chip" data-count></span></div>
    <div class="vv-box pw-score fe-score" tabindex="0" role="group" aria-label="The score. Click a note that breaks a rule, or move with the arrow keys and press Enter."></div>
    <div class="fe-names" hidden></div>
    <div class="fe-msg"><p class="fb info" aria-live="polite">Listen first, then look at how each voice moves.</p></div>
    <ul class="fe-found"></ul><div class="fe-fix"></div></div>`;
  const $ = s => el.querySelector(s), box = $('.fe-score'), f = $(".fe-msg .fb"), cnt = $('[data-count]'), namesEl = $('.fe-names'), list = $('.fe-found');
  function render() {
    const marks = [];
    planted.forEach((pl, i) => { if (found.has(i)) pl.voices.forEach(v => pl.cols.forEach(c => marks.push({ col: c, voice: v, kind: 'found' }))); });
    okCells.forEach(k => { const [c, v] = k.split(':').map(Number); marks.push({ col: c, voice: v, kind: 'ok' }); });
    const lines = [];
    planted.forEach((pl, i) => { if (found.has(i) && pl.cols.length === 2 && /^(parallel|contrary|direct)/.test(pl.rule)) pl.voices.forEach(v => lines.push({ from: { col: pl.cols[0], voice: v }, to: { col: pl.cols[1], voice: v }, kind: 'found' })); });
    box.innerHTML = vvSvg({ voices, key, mode, labels: romans, marks, lines, sel: finished ? null : sel, editable: true, style: opts.style });
    cnt.textContent = `${found.size} of ${planted.length} found`;
  }
  const at = (c, v) => planted.findIndex((pl, i) => !found.has(i) && pl.cols.indexOf(c) >= 0 && (pl.voices.indexOf(v) >= 0 || (pl.also || []).some(a => a.cols.indexOf(c) >= 0 && a.voices.indexOf(v) >= 0)));
  function markFound(i) {
    found.add(i); naming = null; namesEl.hidden = true;
    const pl = planted[i];
    list.insertAdjacentHTML('beforeend', `<li><b>${esc(VL_RULES[pl.rule].name)}.</b> ${esc(pl.text)}</li>`);
    fb(f, 'good', found.size < planted.length ? `Found one. ${planted.length - found.size} to go.` : 'All found.');
    render();
    if (found.size === planted.length) finish();
  }
  function finish() {
    finished = true; render();
    if (!p.fix) { done(true, { found: found.size, misses, planted }); return; }
    fb(f, 'info', 'Now fix them: change the notes until no errors are left.');
    const fixEl = $('.fe-fix');
    inner = PartWriter.mount(fixEl, { voices: n, key, mode, romans, style: opts.style, initial: voices, cols, onChange: (vs, ps) => {
      if (!VoiceLead.summary(ps).errors && !fixed) { fixed = true; fb(f, 'good', 'Fixed: no errors left.'); done(true, { found: found.size, misses, planted, voices: vs }); }
    } });
  }
  function tapCell(c, v) {
    if (finished || naming != null) return;
    sel = { col: c, voice: v };
    const i = at(c, v);
    if (i < 0) {
      misses++;
      okCells.add(c + ':' + v);
      const left = planted.filter((pl, j) => !found.has(j));
      fb(f, 'bad', `That ${n === 4 ? VV_NAMES4[v].toLowerCase() + ' note' : 'note'} is fine.${misses >= 3 && left.length ? ` Hint: look at beat ${left[0].cols[0] + 1}.` : ''}`);
      render(); return;
    }
    if (!p.name) { markFound(i); return; }
    /* name it: the planted rules plus a few others */
    const pool = Object.keys(VL_RULES).filter(r => ['consonance', 'passing', 'startPerfect', 'endPerfect', 'cadence', 'repeated', 'steps', 'suspPrep', 'suspResolve', 'suspType'].indexOf(r) < 0);
    const choices = shuffle([planted[i].rule].concat(shuffle(pool.filter(r => r !== planted[i].rule)).slice(0, 3)));
    naming = i;
    namesEl.hidden = false;
    namesEl.innerHTML = `<p class="lead" style="flex-basis:100%">Which rule does it break?</p>` + choices.map(r => `<button type="button" class="choice" data-r="${r}">${esc(VL_RULES[r].name)}</button>`).join('');
    render();
  }
  namesEl.addEventListener('click', ev => {
    const b = ev.target.closest('[data-r]'); if (!b || naming == null) return;
    if (b.dataset.r === planted[naming].rule) markFound(naming);
    else { misses++; b.classList.add('wrong'); b.disabled = true; fb(f, 'bad', `Not ${VL_RULES[b.dataset.r].name.toLowerCase()}. Look again at what these notes do.`); }
  });
  box.addEventListener('click', ev => { const t = ev.target.closest && ev.target.closest('[data-col][data-voice]'); if (t) tapCell(+t.getAttribute('data-col'), +t.getAttribute('data-voice')); });
  box.addEventListener('keydown', ev => {
    const k = ev.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight') sel = { col: Math.max(0, Math.min(cols - 1, sel.col + (k === 'ArrowLeft' ? -1 : 1))), voice: sel.voice };
    else if (k === 'ArrowUp' || k === 'ArrowDown') sel = { col: sel.col, voice: Math.max(0, Math.min(n - 1, sel.voice + (k === 'ArrowUp' ? -1 : 1))) };
    else if (k === 'Enter' || k === ' ') { tapCell(sel.col, sel.voice); ev.preventDefault(); ev.stopPropagation(); return; }
    else return;
    ev.preventDefault(); ev.stopPropagation(); render();
  });
  $('[data-act="play"]').onclick = () => {
    const sec = 1; Sound.seq([].concat(...voices.map((row, k) => row.map((x, c) => x ? { m: Theory.midi(x), t: c * sec, d: sec * 0.94, v: k === 0 || k === n - 1 ? 0.7 : 0.5 } : null).filter(Boolean))));
  };
  render();
  return () => { if (inner) inner.destroy(); };
};
