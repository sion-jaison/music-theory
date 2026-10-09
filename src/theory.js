/* ------------------------------------------------------------------
   Motif · theory engine
   Spelled notes (letter + accidental, so G major has F♯ and never G♭),
   scales and modes, chords (triads to 13ths), keys, the Circle of Fifths,
   intervals, Roman numerals (with inversions, applied, borrowed, Neapolitan
   and augmented-sixth chords), analysis, and a key finder. Pure functions; names use ♯ and ♭ for display and
   parse '#' and 'b' too.
   ------------------------------------------------------------------ */

const Theory = (function () {
  const LETTERS = 'CDEFGAB';
  const NAT = [0, 2, 4, 5, 7, 9, 11];
  const mod = (n, m) => ((n % m) + m) % m;
  const ACC = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' };
  const NOTE_RE = /^([A-Ga-g])((?:#|♯|b|♭|x|𝄪|𝄫)*)(-?\d+)?$/u;

  /* ---------- notes ---------- */
  function parse(name) {
    const m = NOTE_RE.exec(String(name).trim());
    if (!m) throw new Error('Not a note: ' + name);
    let acc = 0;
    for (const ch of m[2]) acc += (ch === '#' || ch === '♯') ? 1 : (ch === 'b' || ch === '♭') ? -1 : (ch === 'x' || ch === '𝄪') ? 2 : -2;
    return { L: LETTERS.indexOf(m[1].toUpperCase()), acc, oct: m[3] == null ? null : +m[3] };
  }
  function fmt(L, acc, oct) {
    const a = ACC[acc] != null ? ACC[acc] : (acc > 0 ? '♯'.repeat(acc) : '♭'.repeat(-acc));
    return LETTERS[L] + a + (oct == null ? '' : oct);
  }
  const pc = name => { const p = parse(name); return mod(NAT[p.L] + p.acc, 12); };
  const midi = name => { const p = parse(name); return (p.oct + 1) * 12 + NAT[p.L] + p.acc; };
  const letterOf = name => LETTERS[parse(name).L];
  const accOf = name => parse(name).acc;
  const stripOct = name => { const p = parse(name); return fmt(p.L, p.acc, null); };
  const withOct = (name, oct) => { const p = parse(name); return fmt(p.L, p.acc, oct); };
  const pretty = s => String(s).replace(/([A-G])(#|b)+/g, (m, l) => l + m.slice(1).replace(/#/g, '♯').replace(/b/g, '♭'));

  const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  /* the spelling most chord charts use for a root */
  const ROOT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  const MINOR_ROOT_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'];
  const pcName = (p, flats) => (flats ? FLAT_NAMES : SHARP_NAMES)[mod(p, 12)];
  const fromMidi = (m, flats) => pcName(m, flats) + (Math.floor(m / 12) - 1);

  /* ---------- intervals as scale degrees: '1', 'b3', '#4', 'bb7', '9' ---------- */
  function parseDeg(d) {
    const m = /^(bb|b|##|#|♭|♯)?(\d+)$/.exec(String(d));
    if (!m) throw new Error('Not a degree: ' + d);
    const acc = { bb: -2, b: -1, '♭': -1, '#': 1, '♯': 1, '##': 2 }[m[1]] || 0;
    const n = +m[2];
    return { steps: n - 1, semis: NAT[(n - 1) % 7] + 12 * Math.floor((n - 1) / 7) + acc };
  }
  function up(note, deg) {
    const p = parse(note), d = parseDeg(deg);
    const L2 = p.L + d.steps, nl = L2 % 7, carry = Math.floor(L2 / 7);
    const acc = NAT[p.L] + p.acc + d.semis - (NAT[nl] + 12 * carry);
    return fmt(nl, acc, p.oct == null ? null : p.oct + carry);
  }
  function down(note, deg) {
    const p = parse(note), d = parseDeg(deg);
    const L2 = p.L - d.steps, nl = mod(L2, 7), carry = Math.floor(L2 / 7);
    const acc = NAT[p.L] + p.acc - d.semis - (NAT[nl] + 12 * carry);
    return fmt(nl, acc, p.oct == null ? null : p.oct + carry);
  }
  /* raise or lower a note without changing its letter (F → F♯, B → B♭) */
  function alter(note, by) { const p = parse(note); return fmt(p.L, p.acc + by, p.oct); }

  const ORDINAL = ['', 'unison', '2nd', '3rd', '4th', '5th', '6th', '7th', 'octave'];
  const Q_NAME = { P: 'perfect', M: 'major', m: 'minor', A: 'augmented', d: 'diminished' };
  /* interval from a up to b, by letters and half steps. Without octaves, b is taken as the next one above a. */
  function interval(a, b) {
    const pa = parse(a), pb = parse(b);
    let num, semis;
    if (pa.oct != null && pb.oct != null) {
      num = (pb.L + 7 * pb.oct) - (pa.L + 7 * pa.oct) + 1;
      semis = midi(b) - midi(a);
    } else {
      num = mod(pb.L - pa.L, 7) + 1;
      semis = mod(pc(b) - pc(a), 12);
      if (num === 1 && semis > 6) semis -= 12;
    }
    const simple = ((num - 1) % 7) + 1;
    const base = NAT[simple - 1] + 12 * Math.floor((num - 1) / 7);
    const diff = semis - base;
    const perfectType = simple === 1 || simple === 4 || simple === 5;
    let q;
    if (perfectType) q = diff === 0 ? 'P' : diff === 1 ? 'A' : diff === -1 ? 'd' : null;
    else q = diff === 0 ? 'M' : diff === -1 ? 'm' : diff === -2 ? 'd' : diff === 1 ? 'A' : null;
    const word = num === 8 ? 'octave' : num === 1 ? 'unison' : (num <= 8 ? ORDINAL[num] : num + 'th');
    const name = !q ? '?' : (q === 'P' && (num === 1 || num === 8)) ? word : Q_NAME[q] + ' ' + word;
    return { num, semis, q, short: q ? q + num : '?', name };
  }

  /* one entry per size in half steps, with a song to anchor it (ascending) */
  const INTERVALS = [
    { semis: 0, short: 'P1', name: 'unison', song: 'the same note twice' },
    { semis: 1, short: 'm2', name: 'minor 2nd', song: 'Jaws', hint: 'the shark: dun-dun' },
    { semis: 2, short: 'M2', name: 'major 2nd', song: 'Happy Birthday', hint: '“Hap-py BIRTH-day”: happy → birth' },
    { semis: 3, short: 'm3', name: 'minor 3rd', song: 'Greensleeves', hint: '“A-las”' },
    { semis: 4, short: 'M3', name: 'major 3rd', song: 'When the Saints Go Marching In', hint: '“Oh when”' },
    { semis: 5, short: 'P4', name: 'perfect 4th', song: 'Here Comes the Bride', hint: '“Here comes”' },
    { semis: 6, short: 'TT', name: 'tritone', song: 'The Simpsons', hint: '“The Simp-sons”' },
    { semis: 7, short: 'P5', name: 'perfect 5th', song: 'Twinkle Twinkle Little Star', hint: '“Twin-kle twin-kle”' },
    { semis: 8, short: 'm6', name: 'minor 6th', song: 'The Entertainer', hint: 'the jump after the three opening notes' },
    { semis: 9, short: 'M6', name: 'major 6th', song: 'My Bonnie Lies Over the Ocean', hint: '“My Bon-nie”' },
    { semis: 10, short: 'm7', name: 'minor 7th', song: 'Somewhere (West Side Story)', hint: '“There’s a place”' },
    { semis: 11, short: 'M7', name: 'major 7th', song: 'an octave minus a half step', hint: 'sing an octave, then slip down one key' },
    { semis: 12, short: 'P8', name: 'octave', song: 'Somewhere Over the Rainbow', hint: '“Some-where”' }
  ];

  /* ---------- scales ---------- */
  const SCALES = {
    major: { name: 'major', degrees: ['1', '2', '3', '4', '5', '6', '7'] },
    minor: { name: 'natural minor', degrees: ['1', '2', 'b3', '4', '5', 'b6', 'b7'] },
    harmonic: { name: 'harmonic minor', degrees: ['1', '2', 'b3', '4', '5', 'b6', '7'] },
    melodic: { name: 'melodic minor', degrees: ['1', '2', 'b3', '4', '5', '6', '7'] },
    majPent: { name: 'major pentatonic', degrees: ['1', '2', '3', '5', '6'] },
    minPent: { name: 'minor pentatonic', degrees: ['1', 'b3', '4', '5', 'b7'] },
    blues: { name: 'blues', degrees: ['1', 'b3', '4', 'b5', '5', 'b7'] },
    majBlues: { name: 'major blues', degrees: ['1', '2', 'b3', '3', '5', '6'] },
    diminished: { name: 'diminished (whole–half)', degrees: ['1', '2', 'b3', '4', 'b5', 'b6', '6', '7'] },
    wholeTone: { name: 'whole tone', degrees: ['1', '2', '3', '#4', '#5', 'b7'] }
  };
  /* the seven modes from brightest to darkest; each one lowers one note of the one before.
     char: the degree that gives the mode its colour (against major, or against minor for the dark ones);
     charChord: the chord that carries that note in a vamp; parent: which degree of a major scale the mode starts on */
  const MODES = [
    { id: 'lydian', name: 'Lydian', degrees: ['1', '2', '3', '#4', '5', '6', '7'], char: '#4', charChord: 'II', vamp: ['I', 'II'], parent: 4, mood: 'bright and floating' },
    { id: 'ionian', name: 'Ionian', degrees: ['1', '2', '3', '4', '5', '6', '7'], char: '7', charChord: 'V', vamp: ['I', 'IV', 'V', 'I'], parent: 1, mood: 'bright and settled: the major scale' },
    { id: 'mixolydian', name: 'Mixolydian', degrees: ['1', '2', '3', '4', '5', '6', 'b7'], char: 'b7', charChord: '♭VII', vamp: ['I', '♭VII'], parent: 5, mood: 'bluesy, earthy major' },
    { id: 'dorian', name: 'Dorian', degrees: ['1', '2', 'b3', '4', '5', '6', 'b7'], char: '6', charChord: 'IV', vamp: ['i', 'IV'], parent: 2, mood: 'minor with a lift: cool, soulful' },
    { id: 'aeolian', name: 'Aeolian', degrees: ['1', '2', 'b3', '4', '5', 'b6', 'b7'], char: 'b6', charChord: '♭VI', vamp: ['i', '♭VI', '♭VII', 'i'], parent: 6, mood: 'sad and serious: natural minor' },
    { id: 'phrygian', name: 'Phrygian', degrees: ['1', 'b2', 'b3', '4', '5', 'b6', 'b7'], char: 'b2', charChord: '♭II', vamp: ['i', '♭II'], parent: 3, mood: 'dark and Spanish' },
    { id: 'locrian', name: 'Locrian', degrees: ['1', 'b2', 'b3', '4', 'b5', 'b6', 'b7'], char: 'b5', charChord: '♭V', vamp: ['i°', '♭II'], parent: 7, mood: 'unstable: the tonic chord is diminished' }
  ];
  MODES.forEach(m => { SCALES[m.id] = { name: m.name, degrees: m.degrees }; });
  const modeById = id => MODES.find(m => m.id === id);
  /* scale('G') → G A B C D E F♯ ; scale('G3', 'major', true) adds the octave and keeps octave numbers */
  function scale(root, type, withTop) {
    const degs = SCALES[type || 'major'].degrees.concat(withTop ? ['8'] : []);
    return degs.map(d => up(root, d));
  }
  /* half steps between neighbouring notes, top octave included: major → [2,2,1,2,2,2,1] */
  function recipe(type) {
    const semis = SCALES[type || 'major'].degrees.map(d => parseDeg(d).semis).concat([12]);
    return semis.slice(1).map((s, i) => s - semis[i]);
  }
  const stepName = n => n === 1 ? 'H' : n === 2 ? 'W' : n === 3 ? 'W+H' : String(n);

  const SOLFEGE = ['do', 're', 'mi', 'fa', 'sol', 'la', 'ti'];
  const DEGREE_NAMES = ['tonic', 'supertonic', 'mediant', 'subdominant', 'dominant', 'submediant', 'leading tone'];

  /* ---------- chords ---------- */
  const CHORDS = {
    maj: { name: 'major', sym: '', degrees: ['1', '3', '5'], recipe: '4 + 3' },
    min: { name: 'minor', sym: 'm', degrees: ['1', 'b3', '5'], recipe: '3 + 4' },
    dim: { name: 'diminished', sym: '°', degrees: ['1', 'b3', 'b5'], recipe: '3 + 3' },
    aug: { name: 'augmented', sym: '+', degrees: ['1', '3', '#5'], recipe: '4 + 4' },
    sus2: { name: 'suspended 2nd', sym: 'sus2', degrees: ['1', '2', '5'], recipe: '2 + 5' },
    sus4: { name: 'suspended 4th', sym: 'sus4', degrees: ['1', '4', '5'], recipe: '5 + 2' },
    '7': { name: 'dominant 7th', sym: '7', degrees: ['1', '3', '5', 'b7'], recipe: '4 + 3 + 3' },
    maj7: { name: 'major 7th', sym: 'maj7', degrees: ['1', '3', '5', '7'], recipe: '4 + 3 + 4' },
    m7: { name: 'minor 7th', sym: 'm7', degrees: ['1', 'b3', '5', 'b7'], recipe: '3 + 4 + 3' },
    m7b5: { name: 'half-diminished 7th', sym: 'ø7', degrees: ['1', 'b3', 'b5', 'b7'], recipe: '3 + 3 + 4' },
    dim7: { name: 'diminished 7th', sym: '°7', degrees: ['1', 'b3', 'b5', 'bb7'], recipe: '3 + 3 + 3' },
    /* colours and extensions (not used by chord recognition unless asked for) */
    '6': { name: 'major 6th', sym: '6', degrees: ['1', '3', '5', '6'] },
    m6: { name: 'minor 6th', sym: 'm6', degrees: ['1', 'b3', '5', '6'] },
    add9: { name: 'added 9th', sym: 'add9', degrees: ['1', '3', '5', '9'] },
    madd9: { name: 'minor added 9th', sym: 'm(add9)', degrees: ['1', 'b3', '5', '9'] },
    '69': { name: '6/9', sym: '6/9', degrees: ['1', '3', '5', '6', '9'] },
    '7sus4': { name: 'dominant 7th sus4', sym: '7sus4', degrees: ['1', '4', '5', 'b7'] },
    mMaj7: { name: 'minor-major 7th', sym: 'm(maj7)', degrees: ['1', 'b3', '5', '7'] },
    'maj7#5': { name: 'augmented major 7th', sym: 'maj7♯5', degrees: ['1', '3', '#5', '7'] },
    '7b5': { name: 'dominant 7th flat 5', sym: '7♭5', degrees: ['1', '3', 'b5', 'b7'] },
    '9': { name: 'dominant 9th', sym: '9', degrees: ['1', '3', '5', 'b7', '9'] },
    maj9: { name: 'major 9th', sym: 'maj9', degrees: ['1', '3', '5', '7', '9'] },
    m9: { name: 'minor 9th', sym: 'm9', degrees: ['1', 'b3', '5', 'b7', '9'] },
    '7b9': { name: 'dominant 7th flat 9', sym: '7♭9', degrees: ['1', '3', '5', 'b7', 'b9'] },
    '7#9': { name: 'dominant 7th sharp 9', sym: '7♯9', degrees: ['1', '3', '5', 'b7', '#9'] },
    '11': { name: 'dominant 11th', sym: '11', degrees: ['1', '5', 'b7', '9', '11'] },
    m11: { name: 'minor 11th', sym: 'm11', degrees: ['1', 'b3', '5', 'b7', '9', '11'] },
    'maj7#11': { name: 'major 7th sharp 11', sym: 'maj7♯11', degrees: ['1', '3', '5', '7', '#11'] },
    '13': { name: 'dominant 13th', sym: '13', degrees: ['1', '3', '5', 'b7', '9', '13'] },
    /* augmented sixth chords, built up from the bass (♭6 of the key): Italian, French, German */
    It6: { name: 'Italian augmented 6th', sym: '(It+6)', degrees: ['1', '3', '#6'] },
    Fr6: { name: 'French augmented 6th', sym: '(Fr+6)', degrees: ['1', '3', '#4', '#6'] },
    Ger6: { name: 'German augmented 6th', sym: '(Ger+6)', degrees: ['1', '3', '5', '#6'] }
  };
  /* the qualities chord recognition listens for by default */
  const CORE_QS = ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4', '7', 'maj7', 'm7', 'm7b5', 'dim7'];
  const EXT_QS = CORE_QS.concat(['6', 'm6', 'add9', 'madd9', '69', '7sus4', 'mMaj7', '9', 'maj9', 'm9', '7b9', '7#9', '11', 'm11', 'maj7#11', '13']);
  /* half steps between stacked chord tones: '4 + 3' for major */
  Object.keys(CHORDS).forEach(q => {
    if (CHORDS[q].recipe) return;
    const st = CHORDS[q].degrees.map(d => parseDeg(d).semis);
    CHORDS[q].recipe = st.slice(1).map((x, i) => x - st[i]).join(' + ');
  });
  const chordNotes = (root, q) => CHORDS[q].degrees.map(d => up(root, d));
  const chordPcs = (root, q) => chordNotes(root, q).map(pc);
  const symbol = (root, q, bass) => stripOct(root) + CHORDS[q].sym + (bass ? '/' + stripOct(bass) : '');
  const SYM_TO_Q = { '': 'maj', M: 'maj', maj: 'maj', m: 'min', min: 'min', '-': 'min', '°': 'dim', dim: 'dim', o: 'dim', '+': 'aug', aug: 'aug', sus2: 'sus2', sus4: 'sus4', sus: 'sus4', '7': '7', maj7: 'maj7', M7: 'maj7', 'Δ7': 'maj7', Δ: 'maj7', m7: 'm7', min7: 'm7', '-7': 'm7', 'ø7': 'm7b5', m7b5: 'm7b5', 'm7♭5': 'm7b5', 'ø': 'm7b5', '°7': 'dim7', dim7: 'dim7', o7: 'dim7',
    '6': '6', m6: 'm6', add9: 'add9', madd9: 'madd9', 'm(add9)': 'madd9', '69': '69', '6/9': '69', '7sus4': '7sus4', '7sus': '7sus4', mMaj7: 'mMaj7', 'm(maj7)': 'mMaj7', mM7: 'mMaj7', 'maj7#5': 'maj7#5', 'maj7♯5': 'maj7#5', '7b5': '7b5', '7♭5': '7b5',
    '9': '9', maj9: 'maj9', M9: 'maj9', m9: 'm9', min9: 'm9', '7b9': '7b9', '7♭9': '7b9', '7#9': '7#9', '7♯9': '7#9', '11': '11', m11: 'm11', 'maj7#11': 'maj7#11', 'maj7♯11': 'maj7#11', '13': '13',
    '(It+6)': 'It6', '(Fr+6)': 'Fr6', '(Ger+6)': 'Ger6' };
  /* 'F#m7' → { root: 'F♯', q: 'm7', bass: null } ; 'C/E' → { root: 'C', q: 'maj', bass: 'E' } */
  function parseChord(s) {
    const m = /^([A-G](?:#|♯|b|♭)?)([^/]*)(?:\/([A-G](?:#|♯|b|♭)?))?$/u.exec(String(s).trim().replace(/6\/9/, '69'));
    if (!m || !(m[2] in SYM_TO_Q)) throw new Error('Not a chord symbol: ' + s);
    return { root: pretty(m[1]), q: SYM_TO_Q[m[2]], bass: m[3] ? pretty(m[3]) : null };
  }
  const MINORISH = ['min', 'm7', 'dim', 'm7b5', 'dim7', 'm6', 'madd9', 'mMaj7', 'm9', 'm11'];
  const rootName = (p, q) => (MINORISH.indexOf(q) >= 0 ? MINOR_ROOT_NAMES : ROOT_NAMES)[mod(p, 12)];
  /* every chord in the vocabulary whose notes are exactly this set of pitch classes */
  function identify(pcs, bassPc, qualities) {
    const set = [...new Set(pcs.map(p => mod(p, 12)))].sort((a, b) => a - b);
    const out = [];
    (qualities || CORE_QS).forEach(q => {
      const shape = CHORDS[q].degrees.map(d => parseDeg(d).semis % 12);
      if (shape.length !== set.length) return;
      for (let r = 0; r < 12; r++) {
        const want = shape.map(s => (r + s) % 12).sort((a, b) => a - b);
        if (want.every((v, i) => v === set[i])) {
          const root = rootName(r, q);
          const inv = bassPc == null ? 0 : shape.map(s => (r + s) % 12).indexOf(mod(bassPc, 12));
          out.push({ root, rootPc: r, q, sym: symbol(root, q), inversion: Math.max(0, inv), bassPc: bassPc == null ? r : mod(bassPc, 12) });
        }
      }
    });
    /* prefer the reading whose root is in the bass, then simpler chords */
    const order = Object.keys(CHORDS);
    out.sort((a, b) => (a.inversion === 0 ? 0 : 1) - (b.inversion === 0 ? 0 : 1) || order.indexOf(a.q) - order.indexOf(b.q));
    return out;
  }
  /* MIDI numbers for a chord, stacked upward from root in octave `oct`, optionally inverted */
  function voicing(root, q, oct, inversion) {
    const base = midi(withOct(stripOct(root), oct == null ? 4 : oct));
    let ms = CHORDS[q].degrees.map(d => base + parseDeg(d).semis);
    for (let i = 0; i < (inversion || 0); i++) { const lo = ms.shift(); ms.push(lo + 12); }
    return ms;
  }

  /* ---------- keys and the Circle of Fifths ---------- */
  const ORDER_SHARPS = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
  const ORDER_FLATS = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
  /* clock positions 0–11, C at 12 o'clock, clockwise in 5ths */
  const CIRCLE = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];
  const CIRCLE_MINOR = ['A', 'E', 'B', 'F♯', 'C♯', 'G♯', 'D♯', 'B♭', 'F', 'C', 'G', 'D'];
  const CIRCLE_ALT = { 5: { major: 'C♭', minor: 'A♭' }, 6: { major: 'G♭', minor: 'E♭' }, 7: { major: 'C♯', minor: 'A♯' } };
  const MAJOR_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯', 'F', 'B♭', 'E♭', 'A♭', 'D♭', 'G♭', 'C♭'];
  const MINOR_KEYS = MAJOR_KEYS.map(k => up(k, '6'));

  const relMinor = major => up(major, '6');
  const relMajor = minor => up(minor, 'b3');
  /* signed count: +n sharps, −n flats; with the accidentals in signature order */
  function keySig(tonic, mode) {
    const major = mode === 'minor' ? relMajor(tonic) : stripOct(tonic);
    const n = scale(major).reduce((s, x) => s + accOf(x), 0);
    const acc = n > 0 ? ORDER_SHARPS.slice(0, n).map(l => l + '♯') : ORDER_FLATS.slice(0, -n).map(l => l + '♭');
    return { n, acc, major, minor: relMinor(major) };
  }
  const SHARP_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯'];
  const FLAT_KEYS = ['C', 'F', 'B♭', 'E♭', 'A♭', 'D♭', 'G♭', 'C♭'];
  function keyFromSig(n, mode) {
    const major = n >= 0 ? SHARP_KEYS[n] : FLAT_KEYS[-n];
    return mode === 'minor' ? relMinor(major) : major;
  }
  /* clock position of a major (or, with mode 'minor', a minor) key */
  function circlePos(tonic, mode) {
    const major = mode === 'minor' ? relMajor(tonic) : stripOct(tonic);
    return mod(pc(major) * 7, 12);
  }
  const keyName = (tonic, mode) => stripOct(tonic) + (mode === 'minor' ? ' minor' : ' major');

  /* ---------- chords in a key and Roman numerals ---------- */
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  function qualityOf(notes) {
    const r = pc(notes[0]);
    const iv = notes.slice(1).map(n => mod(pc(n) - r, 12)).join(',');
    return { '4,7': 'maj', '3,7': 'min', '3,6': 'dim', '4,8': 'aug', '4,7,11': 'maj7', '4,7,10': '7', '3,7,10': 'm7', '3,6,10': 'm7b5', '3,6,9': 'dim7', '4,8,11': 'maj7#5', '3,7,11': 'mMaj7' }[iv] || null;
  }
  /* extended chords are analysed as the 7th chord or triad under them */
  const CORE_OF = { '9': '7', '13': '7', '11': '7', '7b9': '7', '7#9': '7', '7sus4': '7', '7b5': '7', maj9: 'maj7', 'maj7#11': 'maj7', m9: 'm7', m11: 'm7', '6': 'maj', '69': 'maj', add9: 'maj', sus2: 'maj', sus4: 'maj', m6: 'min', madd9: 'min' };
  const UPPER_QS = ['maj', 'aug', '7', 'maj7', 'maj7#5', '9', 'maj9', '13', '7b9', '7#9', 'sus2', 'sus4', '7sus4', 'add9', '6', '69'];
  const ROMAN_SUFFIX = { dim: '°', aug: '+', '7': '7', maj7: 'maj7', m7: '7', m7b5: 'ø7', dim7: '°7', mMaj7: 'maj7', 'maj7#5': '+maj7', '9': '9', maj9: 'maj9', m9: '9', '13': '13', sus4: 'sus4', sus2: 'sus2', '7sus4': '7sus4', add9: 'add9' };
  function romanFor(deg, q) {
    const upper = UPPER_QS.indexOf(q) >= 0;
    const r = upper ? ROMAN[deg - 1] : ROMAN[deg - 1].toLowerCase();
    return r + (ROMAN_SUFFIX[q] || '');
  }
  /* figured-bass label for an inversion: triads '', '6', '64'; seventh chords '7', '65', '43', '42' */
  const figureOf = (inversion, seventh) => seventh ? ['7', '65', '43', '42'][inversion || 0] : ['', '6', '64'][inversion || 0];
  /* triads (or 7th chords) on each degree. mode: 'major' | 'minor' | 'harmonic', or any 7-note scale or mode id ('dorian') */
  function diatonic(tonic, mode, sevenths) {
    const type = mode === 'minor' ? 'minor' : mode && SCALES[mode] && SCALES[mode].degrees.length === 7 ? mode : 'major';
    const s = scale(stripOct(tonic), type), degs = SCALES[type].degrees;
    const modal = !!modeById(type) && type !== 'ionian' && type !== 'aeolian';
    return s.map((root, i) => {
      const notes = [root, s[(i + 2) % 7], s[(i + 4) % 7]].concat(sevenths ? [s[(i + 6) % 7]] : []);
      const q = qualityOf(notes), acc = /^b/.test(degs[i]) ? '♭' : /^#/.test(degs[i]) ? '♯' : '';
      return { deg: i + 1, roman: (modal ? acc : '') + romanFor(i + 1, q), root, q, sym: CHORDS[q] ? symbol(root, q) : root + '?', notes };
    });
  }
  /* chords of a mode with numerals measured against the major scale: Mixolydian → I ii iii° IV v vi ♭VII */
  const modeChords = (tonic, modeId, sevenths) => diatonic(tonic, modeId, sevenths);

  /* Roman numerals.
     'V7' 'ii65' 'I64' 'vii°7' 'viiø43' 'bVI' 'iv' 'V7/V' 'vii°7/vi' 'N6' 'It+6' 'Fr+6' 'Ger+6' 'subV7' 'Imaj9' 'Vsus4'.
     Degrees count from the key's own scale (natural minor in minor keys); in minor, a lowercase vii (°, ø) uses the raised
     leading tone. Inversion figures: triads 6 and 64; seventh chords 65, 43, 42 (or 2). */
  const ROMAN_RE = /^(b|♭|#|♯)?(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(°|ø|\+)?(maj7|maj9|7sus4|sus4|sus2|add9|7|9|11|13)?(64|65|43|42|6|2)?$/u;
  const NUM_Q = { maj7: 'maj7', maj9: 'maj9', '7sus4': '7sus4', sus4: 'sus4', sus2: 'sus2', add9: 'add9', '9': '9', '11': '11', '13': '13' };
  function romanChord(roman, tonic, mode) {
    roman = String(roman).trim();
    tonic = stripOct(tonic);
    const minor = mode === 'minor';
    const out = (root, q, inversion, extra) => {
      const notes = chordNotes(root, q), inv = Math.min(inversion || 0, notes.length - 1), bass = notes[inv];
      return Object.assign({ roman, root, q, sym: symbol(root, q, inv ? bass : null), notes, inversion: inv, bass, applied: null, special: null }, extra || {});
    };
    /* applied chords: the left part is read in the key of the chord on the right */
    const slash = roman.indexOf('/');
    if (slash > 0) {
      const target = romanChord(roman.slice(slash + 1), tonic, mode);
      const localMinor = MINORISH.indexOf(target.q) >= 0 && target.q !== 'dim' && target.q !== 'm7b5' && target.q !== 'dim7';
      if (target.q === 'dim' || target.q === 'm7b5' || target.q === 'dim7') throw new Error('A diminished chord cannot be tonicized: ' + roman);
      const c = romanChord(roman.slice(0, slash), target.root, localMinor ? 'minor' : 'major');
      return Object.assign(c, { roman, applied: roman.slice(slash + 1) });
    }
    if (/^subV7?$/.test(roman)) return out(alter(up(tonic, '2'), -1), '7', 0, { special: 'sub' });
    const nea = /^N(6)?$/.exec(roman);
    if (nea) return out(alter(up(tonic, '2'), -1), 'maj', nea[1] ? 1 : 0, { special: 'N' });
    const aug6 = /^(It|Fr|Ger)\+?6$/.exec(roman);
    if (aug6) return out(up(tonic, 'b6'), aug6[1] + '6', 0, { special: aug6[1] });
    if (roman === 'Cad64') return Object.assign(out(tonic, minor ? 'min' : 'maj', 2), { special: 'cad64' });
    const m = ROMAN_RE.exec(roman);
    if (!m) throw new Error('Not a Roman numeral: ' + roman);
    const deg = ROMAN.indexOf(m[2].toUpperCase()) + 1;
    const upper = m[2] === m[2].toUpperCase();
    let root = scale(tonic, minor ? 'minor' : 'major')[deg - 1];
    if (m[1]) root = alter(root, (m[1] === 'b' || m[1] === '♭') ? -1 : 1);
    else if (minor && deg === 7 && !upper) root = alter(root, 1);
    const mark = m[3] || '', ext = m[4] || '', fig = m[5] || '';
    const seventh = ext === '7' || fig === '65' || fig === '43' || fig === '42' || fig === '2';
    let q;
    if (mark === '°') q = seventh ? 'dim7' : 'dim';
    else if (mark === 'ø') q = 'm7b5';
    else if (mark === '+') q = ext === 'maj7' ? 'maj7#5' : 'aug';
    else if (ext === 'maj7') q = upper ? 'maj7' : 'mMaj7';
    else if (ext === '9') q = upper ? '9' : 'm9';
    else if (ext === '11') q = upper ? '11' : 'm11';
    else if (NUM_Q[ext]) q = NUM_Q[ext];
    else if (seventh) q = upper ? '7' : 'm7';
    else q = upper ? 'maj' : 'min';
    const inversion = { '': 0, '6': 1, '64': 2, '65': 1, '43': 2, '42': 3, '2': 3 }[fig];
    return out(root, q, inversion);
  }
  /* the Roman numeral of a chord symbol in a key: 'D7' in C → 'V7/V'; 'A♭' in C → '♭VI'; 'D♭/F' in C → 'N6'.
     Diatonic readings win, then applied dominants and leading-tone chords, then borrowed chords; null if none fits. */
  function romanOf(sym, tonic, mode) {
    const c = typeof sym === 'string' ? parseChord(sym) : sym, minor = mode === 'minor';
    tonic = stripOct(tonic);
    const tpc = pc(tonic), r = pc(c.root), notes = chordNotes(c.root, c.q), seventh = notes.length === 4 && ['7', 'maj7', 'm7', 'm7b5', 'dim7', 'mMaj7'].indexOf(c.q) >= 0;
    const inv = c.bass ? Math.max(0, notes.map(pc).indexOf(pc(c.bass))) : 0;
    const fig = figureOf(inv, seventh), figTail = (base) => seventh ? base.replace(/7$/, '') + fig : base + fig;
    if (['It6', 'Fr6', 'Ger6'].indexOf(c.q) >= 0) return mod(r - tpc, 12) === 8 ? c.q.replace('6', '+6') : null;
    if (CORE_OF[c.q]) return romanOf({ root: c.root, q: CORE_OF[c.q], bass: c.bass }, tonic, mode);
    const tries = [];
    const add = (roman, m2) => tries.push([roman, m2 || mode]);
    const triadQs = q => ({ maj: 'maj', min: 'min', dim: 'dim', aug: 'aug', '7': 'maj', maj7: 'maj', m7: 'min', m7b5: 'dim', dim7: 'dim', mMaj7: 'min' })[q];
    /* 1. diatonic, with the harmonic-minor V, V7, vii° and vii°7 in minor */
    const dia = diatonic(tonic, minor ? 'minor' : 'major', seventh);
    dia.forEach(d => { if (pc(d.root) === r && d.q === c.q) add(d.roman); });
    if (minor) {
      const lt = alter(scale(tonic, 'minor')[6], 1);
      if (mod(r - tpc, 12) === 7 && (c.q === 'maj' || c.q === '7')) add(c.q === '7' ? 'V7' : 'V');
      if (pc(lt) === r && (c.q === 'dim' || c.q === 'dim7' || c.q === 'm7b5')) add(romanFor(7, c.q));
    }
    if (tries.length) return figTail(tries[0][0]);
    /* 2. the Neapolitan and the tritone substitute */
    if (mod(r - tpc, 12) === 1 && c.q === 'maj') return 'N' + (inv === 1 ? '6' : inv === 2 ? '64' : '');
    if (mod(r - tpc, 12) === 1 && c.q === '7' && !inv) return 'subV7';
    /* 3. in minor, chords borrowed from the parallel major come first (the Picardy I, the Dorian IV) */
    const borrowed = () => {
      const par = diatonic(tonic, minor ? 'major' : 'minor', seventh);
      const hit = par.find(d => pc(d.root) === r && d.q === c.q);
      if (!hit) return null;
      const flat = !minor && pc(scale(tonic, 'major')[hit.deg - 1]) !== r ? '♭' : '';
      return figTail(flat + hit.roman);
    };
    if (minor && borrowed()) return borrowed();
    /* 4. applied (secondary) dominants and leading-tone chords, onto a major or minor diatonic chord other than I */
    const targets = diatonic(tonic, minor ? 'minor' : 'major').filter(d => d.deg !== 1 && (d.q === 'maj' || d.q === 'min'))
      .map(d => minor && d.deg === 5 ? Object.assign({}, d, { roman: 'V' }) : d);
    if (c.q === 'maj' || c.q === '7') {
      const t = targets.find(d => mod(pc(d.root) - r, 12) === 5);
      if (t) return figTail(c.q === '7' ? 'V7' : 'V') + '/' + t.roman;
    }
    if (c.q === 'dim' || c.q === 'dim7' || c.q === 'm7b5') {
      const t = targets.find(d => mod(pc(d.root) - r, 12) === 1);
      if (t) return figTail(romanFor(7, c.q)) + '/' + t.roman;
    }
    /* 5. borrowed from the parallel minor (mode mixture): ♭VI, ♭VII, ♭III, iv, ii°, v */
    if (borrowed()) return borrowed();
    /* 6. any chord on a chromatic root, named by its root against the major scale */
    const t3 = triadQs(c.q);
    if (!t3) return null;
    const s = scale(tonic, 'major'), at = s.findIndex(n => pc(n) === r), below = s.findIndex(n => mod(pc(n) - 1, 12) === r);
    if (at >= 0) return figTail(romanFor(at + 1, c.q));
    if (below >= 0) return figTail('♭' + romanFor(below + 1, c.q));
    return null;
  }
  /* ---------- intervals: inversion and compound sizes ---------- */
  /* 'M3' → 'm6', 'P4' → 'P5', 'A4' → 'd5', 'M10' → 'm6' (compound intervals invert as their simple size) */
  function invertInterval(short) {
    const m = /^(P|M|m|A|d)(\d+)$/.exec(short);
    if (!m) throw new Error('Not an interval: ' + short);
    const simple = ((+m[2] - 1) % 7) + 1, num = simple === 1 ? 8 : simple === 8 ? 1 : 9 - simple;
    return { P: 'P', M: 'm', m: 'M', A: 'd', d: 'A' }[m[1]] + (+m[2] === 8 ? 1 : num);
  }
  /* a compound interval's simple form: 'M9' → 'M2', 'P11' → 'P4', 'M13' → 'M6' */
  const simpleInterval = short => { const m = /^(P|M|m|A|d)(\d+)$/.exec(short); const n = +m[2]; return m[1] + (n > 8 ? ((n - 1) % 7) + 1 : n); };
  const COMPOUND = [
    { semis: 13, short: 'm9', name: 'minor 9th' }, { semis: 14, short: 'M9', name: 'major 9th' },
    { semis: 15, short: 'm10', name: 'minor 10th' }, { semis: 16, short: 'M10', name: 'major 10th' },
    { semis: 17, short: 'P11', name: 'perfect 11th' }, { semis: 18, short: 'A11', name: 'augmented 11th' },
    { semis: 19, short: 'P12', name: 'perfect 12th' }, { semis: 20, short: 'm13', name: 'minor 13th' }, { semis: 21, short: 'M13', name: 'major 13th' }
  ];

  /* ---------- quartal chords and chord–scales ---------- */
  /* n notes stacked in perfect 4ths from root: quartal('D4', 3) → D4 G4 C5 */
  const quartal = (root, n) => { const out = [root]; for (let i = 1; i < (n || 3); i++) out.push(up(out[i - 1], '4')); return out; };
  /* which scale fits which chord, first choice first */
  const CHORD_SCALES = {
    maj7: ['ionian', 'lydian'], '6': ['ionian'], maj: ['ionian', 'lydian', 'mixolydian'], '7': ['mixolydian'], '9': ['mixolydian'], '13': ['mixolydian'], '7sus4': ['mixolydian'],
    m7: ['dorian', 'aeolian', 'phrygian'], m9: ['dorian'], min: ['dorian', 'aeolian', 'phrygian'], m6: ['dorian', 'melodic'], mMaj7: ['melodic', 'harmonic'],
    m7b5: ['locrian'], dim7: ['diminished'], dim: ['locrian'], '7b9': ['diminished'], 'maj7#11': ['lydian'], aug: ['wholeTone']
  };

  /* ---------- key finding (Krumhansl–Schmuckler, Krumhansl–Kessler profiles) ---------- */
  const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  /* 12 pitch-class weights from notes: MIDI numbers, note names, { m, d } (weighted by duration) or chord symbols ({ sym, d }) */
  function pcWeights(items) {
    if (items.length === 12 && items.every(x => typeof x === 'number') && items.some(x => x % 1 !== 0 || x < 12)) return items.slice();
    const w = new Array(12).fill(0);
    items.forEach(x => {
      if (typeof x === 'number') w[mod(x, 12)] += 1;
      else if (typeof x === 'string') w[pc(x)] += 1;
      else if (x && x.sym) { const c = parseChord(x.sym); chordPcs(c.root, c.q).forEach(p => { w[p] += (x.d || 1); }); }
      else if (x && x.m != null) w[mod(x.m, 12)] += (x.d || 1);
      else if (x && x.p) w[pc(x.p)] += (x.d || 1);
    });
    return w;
  }
  function corr(a, b) {
    const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
    return da && db ? num / Math.sqrt(da * db) : 0;
  }
  /* every key ranked by fit: [{ tonic, mode, name, r }] best first */
  function findKey(items) {
    const w = pcWeights(items), out = [];
    for (let t = 0; t < 12; t++) {
      const rot = prof => w.map((x, i) => x).map((x, i) => prof[mod(i - t, 12)]);
      out.push({ tonic: ROOT_NAMES[t], mode: 'major', r: corr(w, rot(KK_MAJOR)) });
      out.push({ tonic: MINOR_ROOT_NAMES[t], mode: 'minor', r: corr(w, rot(KK_MINOR)) });
    }
    out.forEach(k => { k.name = keyName(k.tonic, k.mode); });
    return out.sort((a, b) => b.r - a.r);
  }
  /* the key over time: notes with onsets `t` (any unit) and lengths `d`; windows of `win` units every `hop` units.
     Returns stretches [{ from, to, tonic, mode, name }] where the best key held for at least `hold` windows in a row. */
  function keyTrack(notes, opts) {
    const o = Object.assign({ win: 8, hop: 2, hold: 2 }, opts || {});
    if (!notes.length) return [];
    const end = Math.max(...notes.map(n => n.t + (n.d || 0)));
    const wins = [];
    for (let a = 0; a < end; a += o.hop) {
      const b = a + o.win, inside = [];
      notes.forEach(n => {
        const s0 = Math.max(a, n.t), e0 = Math.min(b, n.t + (n.d || 0.0001));
        if (e0 > s0) inside.push(Object.assign({}, n, { d: e0 - s0 }));
      });
      if (inside.length) wins.push({ a, b: Math.min(b, end), k: findKey(inside)[0] });
      if (b >= end) break;
    }
    const segs = [];
    let run = null;
    wins.forEach((x, i) => {
      if (run && run.k.name === x.k.name) { run.n++; run.b = x.b; return; }
      run = { a: x.a, b: x.b, k: x.k, n: 1 };
      segs.push(run);
    });
    const kept = segs.filter(x => x.n >= o.hold || segs.length === 1);
    const out = [];
    kept.forEach(x => {
      const last = out[out.length - 1];
      if (last && last.name === x.k.name) last.to = x.b;
      else out.push({ from: out.length ? last.to : 0, to: x.b, tonic: x.k.tonic, mode: x.k.mode, name: x.k.name });
    });
    if (out.length) out[out.length - 1].to = end;
    return out;
  }
  /* closely related keys: the neighbours on the circle and their relatives */
  function relatedKeys(tonic, mode) {
    const major = mode === 'minor' ? relMajor(tonic) : stripOct(tonic), i = CIRCLE.findIndex(k => pc(k) === pc(major));
    const majors = [CIRCLE[mod(i - 1, 12)], CIRCLE[i], CIRCLE[mod(i + 1, 12)]];
    return majors.map(k => ({ tonic: k, mode: 'major' })).concat(majors.map(k => ({ tonic: relMinor(k), mode: 'minor' })))
      .filter(k => !(pc(k.tonic) === pc(tonic) && k.mode === (mode || 'major')));
  }

  const progression = (romans, tonic, mode) => romans.map(r => romanChord(r, tonic, mode));

  const PROGRESSIONS = [
    { id: 'rock', name: 'Three-chord trick', romans: ['I', 'IV', 'V', 'I'], songs: ['Twist and Shout', 'La Bamba', 'Wild Thing'] },
    { id: 'pop', name: 'The four-chord loop', romans: ['I', 'V', 'vi', 'IV'], songs: ['Let It Be', 'Don’t Stop Believin’', 'Someone Like You'] },
    { id: 'sad', name: 'Four-chord loop from vi', romans: ['vi', 'IV', 'I', 'V'], songs: ['Zombie (The Cranberries)', 'Apologize'] },
    { id: 'fifties', name: '’50s doo-wop', romans: ['I', 'vi', 'IV', 'V'], songs: ['Stand By Me', 'Every Breath You Take'] },
    { id: 'jazz', name: 'ii–V–I', romans: ['ii7', 'V7', 'Imaj7'], songs: ['Autumn Leaves', 'Fly Me to the Moon'] },
    { id: 'canon', name: 'Pachelbel’s Canon', romans: ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'], songs: ['Canon in D', 'Basket Case'] },
    { id: 'blues', name: 'Twelve-bar blues', romans: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'], songs: ['Johnny B. Goode', 'Hound Dog'] },
    { id: 'minor', name: 'Minor i–iv–V–i', romans: ['i', 'iv', 'V', 'i'], mode: 'minor', songs: ['many folk and classical endings'] },
    { id: 'epic', name: 'Epic minor', romans: ['i', 'VI', 'III', 'VII'], mode: 'minor', songs: ['Africa (chorus)', 'Numb'] }
  ];

  return {
    LETTERS, NAT, mod, parse, fmt, pc, midi, letterOf, accOf, stripOct, withOct, pretty,
    SHARP_NAMES, FLAT_NAMES, ROOT_NAMES, pcName, fromMidi,
    parseDeg, up, down, alter, interval, INTERVALS,
    SCALES, scale, recipe, stepName, SOLFEGE, DEGREE_NAMES, MODES, modeById, modeChords,
    CHORDS, CORE_QS, EXT_QS, chordNotes, chordPcs, symbol, parseChord, rootName, identify, voicing,
    invertInterval, simpleInterval, COMPOUND, quartal, CHORD_SCALES,
    pcWeights, findKey, keyTrack, relatedKeys,
    ORDER_SHARPS, ORDER_FLATS, CIRCLE, CIRCLE_MINOR, CIRCLE_ALT, MAJOR_KEYS, MINOR_KEYS,
    relMinor, relMajor, keySig, keyFromSig, circlePos, keyName,
    ROMAN, qualityOf, romanFor, figureOf, diatonic, romanChord, romanOf, progression, PROGRESSIONS
  };
})();

if (typeof module !== 'undefined') module.exports = Theory;
