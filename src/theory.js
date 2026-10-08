/* ------------------------------------------------------------------
   Motif · theory engine
   Spelled notes (letter + accidental, so G major has F♯ and never G♭),
   scales, chords, keys, the Circle of Fifths, intervals, Roman numerals
   and progressions. Pure functions; names use ♯ and ♭ for display and
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
    blues: { name: 'blues', degrees: ['1', 'b3', '4', 'b5', '5', 'b7'] }
  };
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
    dim7: { name: 'diminished 7th', sym: '°7', degrees: ['1', 'b3', 'b5', 'bb7'], recipe: '3 + 3 + 3' }
  };
  const chordNotes = (root, q) => CHORDS[q].degrees.map(d => up(root, d));
  const chordPcs = (root, q) => chordNotes(root, q).map(pc);
  const symbol = (root, q, bass) => stripOct(root) + CHORDS[q].sym + (bass ? '/' + stripOct(bass) : '');
  const SYM_TO_Q = { '': 'maj', M: 'maj', maj: 'maj', m: 'min', min: 'min', '-': 'min', '°': 'dim', dim: 'dim', o: 'dim', '+': 'aug', aug: 'aug', sus2: 'sus2', sus4: 'sus4', sus: 'sus4', '7': '7', maj7: 'maj7', M7: 'maj7', 'Δ7': 'maj7', m7: 'm7', min7: 'm7', 'ø7': 'm7b5', m7b5: 'm7b5', 'ø': 'm7b5', '°7': 'dim7', dim7: 'dim7', o7: 'dim7' };
  /* 'F#m7' → { root: 'F♯', q: 'm7', bass: null } ; 'C/E' → { root: 'C', q: 'maj', bass: 'E' } */
  function parseChord(s) {
    const m = /^([A-G](?:#|♯|b|♭)?)([^/]*)(?:\/([A-G](?:#|♯|b|♭)?))?$/u.exec(String(s).trim());
    if (!m || !(m[2] in SYM_TO_Q)) throw new Error('Not a chord symbol: ' + s);
    return { root: pretty(m[1]), q: SYM_TO_Q[m[2]], bass: m[3] ? pretty(m[3]) : null };
  }
  const rootName = (p, q) => (q === 'min' || q === 'm7' || q === 'dim' || q === 'm7b5' || q === 'dim7' ? MINOR_ROOT_NAMES : ROOT_NAMES)[mod(p, 12)];
  /* every chord in the vocabulary whose notes are exactly this set of pitch classes */
  function identify(pcs, bassPc, qualities) {
    const set = [...new Set(pcs.map(p => mod(p, 12)))].sort((a, b) => a - b);
    const out = [];
    (qualities || Object.keys(CHORDS)).forEach(q => {
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
  function romanFor(deg, q) {
    const upper = q === 'maj' || q === 'aug' || q === '7' || q === 'maj7';
    const r = upper ? ROMAN[deg - 1] : ROMAN[deg - 1].toLowerCase();
    return r + ({ dim: '°', aug: '+', '7': '7', maj7: 'maj7', m7: '7', m7b5: 'ø7', dim7: '°7' }[q] || '');
  }
  /* triads (or 7th chords) on each degree. mode: 'major' | 'minor' | 'harmonic' */
  function diatonic(tonic, mode, sevenths) {
    const s = scale(stripOct(tonic), mode === 'minor' ? 'minor' : mode === 'harmonic' ? 'harmonic' : 'major');
    return s.map((root, i) => {
      const notes = [root, s[(i + 2) % 7], s[(i + 4) % 7]].concat(sevenths ? [s[(i + 6) % 7]] : []);
      const q = qualityOf(notes);
      return { deg: i + 1, roman: romanFor(i + 1, q), root, q, sym: CHORDS[q] ? symbol(root, q) : root + '?', notes };
    });
  }
  const ROMAN_RE = /^(b|♭|#|♯)?(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(°7|ø7|°|ø|\+|maj7|7)?$/u;
  /* 'V7' in G → { root: 'D', q: '7', sym: 'D7' }. Degrees count from the key's own scale (natural minor in minor keys). */
  function romanChord(roman, tonic, mode) {
    const m = ROMAN_RE.exec(roman);
    if (!m) throw new Error('Not a Roman numeral: ' + roman);
    const deg = ROMAN.indexOf(m[2].toUpperCase()) + 1;
    let root = scale(stripOct(tonic), mode === 'minor' ? 'minor' : 'major')[deg - 1];
    if (m[1]) root = alter(root, (m[1] === 'b' || m[1] === '♭') ? -1 : 1);
    const upper = m[2] === m[2].toUpperCase();
    const suf = m[3] || '';
    let q;
    if (suf === '°' ) q = 'dim';
    else if (suf === '°7') q = 'dim7';
    else if (suf === 'ø' || suf === 'ø7') q = 'm7b5';
    else if (suf === '+') q = 'aug';
    else if (suf === 'maj7') q = 'maj7';
    else if (suf === '7') q = upper ? '7' : 'm7';
    else q = upper ? 'maj' : 'min';
    return { roman, root, q, sym: symbol(root, q), notes: chordNotes(root, q) };
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
    SCALES, scale, recipe, stepName, SOLFEGE, DEGREE_NAMES,
    CHORDS, chordNotes, chordPcs, symbol, parseChord, rootName, identify, voicing,
    ORDER_SHARPS, ORDER_FLATS, CIRCLE, CIRCLE_MINOR, CIRCLE_ALT, MAJOR_KEYS, MINOR_KEYS,
    relMinor, relMajor, keySig, keyFromSig, circlePos, keyName,
    ROMAN, qualityOf, romanFor, diatonic, romanChord, progression, PROGRESSIONS
  };
})();

if (typeof module !== 'undefined') module.exports = Theory;
