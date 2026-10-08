const T = require('../src/theory.js');

let fails = 0;
function eq(got, want, msg) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}${ok ? '' : `\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`}`);
}
const j = a => a.join(' ');

// notes
eq(T.midi('C4'), 60, 'C4 is MIDI 60');
eq(T.midi('B♯3'), 60, 'B♯3 is MIDI 60');
eq(T.midi('Cb4'), 59, 'C♭4 is MIDI 59');
eq(T.pc('F#'), 6, 'F# parses with ASCII sharp');
eq(T.pretty('Bb and F#'), 'B♭ and F♯', 'pretty turns ASCII accidentals into symbols');
eq(T.fromMidi(61), 'C♯4', 'MIDI 61 → C♯4');
eq(T.fromMidi(61, true), 'D♭4', 'MIDI 61 with flats → D♭4');

// transposing by degree keeps letters
eq(T.up('B4', '2'), 'C♯5', 'major 2nd above B4 is C♯5');
eq(T.up('A', 'b3'), 'C', 'minor 3rd above A is C');
eq(T.up('C♭', '3'), 'E♭', 'major 3rd above C♭ is E♭');
eq(T.up('E', '#5'), 'B♯', 'augmented 5th above E is B♯');
eq(T.down('C4', 'b3'), 'A3', 'minor 3rd below C4 is A3');
eq(T.down('F', '2'), 'E♭', 'major 2nd below F is E♭');

// scales: every major key has one of each letter and the right accidentals
eq(j(T.scale('C')), 'C D E F G A B', 'C major');
eq(j(T.scale('G')), 'G A B C D E F♯', 'G major');
eq(j(T.scale('F')), 'F G A B♭ C D E', 'F major');
eq(j(T.scale('E♭')), 'E♭ F G A♭ B♭ C D', 'E♭ major');
eq(j(T.scale('C♯')), 'C♯ D♯ E♯ F♯ G♯ A♯ B♯', 'C♯ major');
eq(j(T.scale('G♭')), 'G♭ A♭ B♭ C♭ D♭ E♭ F', 'G♭ major');
eq(j(T.scale('A', 'minor')), 'A B C D E F G', 'A natural minor');
eq(j(T.scale('A', 'harmonic')), 'A B C D E F G♯', 'A harmonic minor');
eq(j(T.scale('A', 'melodic')), 'A B C D E F♯ G♯', 'A melodic minor (up)');
eq(j(T.scale('D♯', 'harmonic')), 'D♯ E♯ F♯ G♯ A♯ B C𝄪', 'D♯ harmonic minor needs a double sharp');
eq(j(T.scale('A', 'minPent')), 'A C D E G', 'A minor pentatonic');
eq(j(T.scale('C', 'blues')), 'C E♭ F G♭ G B♭', 'C blues');
eq(j(T.scale('G♭', 'majPent')), 'G♭ A♭ B♭ D♭ E♭', 'G♭ major pentatonic is the black keys');
eq(j(T.scale('C4', 'major', true)), 'C4 D4 E4 F4 G4 A4 B4 C5', 'scale with octave numbers and top note');
eq(T.recipe('major'), [2, 2, 1, 2, 2, 2, 1], 'major recipe 2-2-1-2-2-2-1');
eq(T.recipe('minor'), [2, 1, 2, 2, 1, 2, 2], 'natural minor recipe');
eq(T.recipe('harmonic'), [2, 1, 2, 2, 1, 3, 1], 'harmonic minor recipe');
eq(T.recipe('blues'), [3, 2, 1, 1, 3, 2], 'blues recipe');
let allMajorsOk = true;
T.MAJOR_KEYS.forEach(k => {
  const s = T.scale(k);
  const letters = new Set(s.map(T.letterOf));
  const steps = s.concat([s[0]]).slice(1).map((n, i) => T.mod(T.pc(n) - T.pc(s[i]), 12));
  if (letters.size !== 7 || j(steps) !== '2 2 1 2 2 2 1') allMajorsOk = false;
});
eq(allMajorsOk, true, 'all 15 major scales use 7 letters and the 2-2-1-2-2-2-1 recipe');

// intervals
eq(T.interval('C', 'E').short, 'M3', 'C→E is M3');
eq(T.interval('E', 'G').short, 'm3', 'E→G is m3');
eq(T.interval('F', 'B').short, 'A4', 'F→B is an augmented 4th');
eq(T.interval('B', 'F').short, 'd5', 'B→F is a diminished 5th');
eq(T.interval('C4', 'C5').name, 'octave', 'C4→C5 is an octave');
eq(T.interval('D', 'C').short, 'm7', 'D→C is m7');
eq(T.interval('E♭', 'G').short, 'M3', 'E♭→G is M3');
eq(T.interval('A3', 'F4').short, 'm6', 'A3→F4 is m6');
eq(T.INTERVALS.map(i => i.semis), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'interval table covers 0–12 half steps');

// chords
eq(j(T.chordNotes('C', 'maj')), 'C E G', 'C major triad');
eq(j(T.chordNotes('F♯', 'min')), 'F♯ A C♯', 'F♯ minor triad');
eq(j(T.chordNotes('B', 'dim')), 'B D F', 'B diminished');
eq(j(T.chordNotes('C', 'aug')), 'C E G♯', 'C augmented');
eq(j(T.chordNotes('G', '7')), 'G B D F', 'G7');
eq(j(T.chordNotes('E♭', 'maj7')), 'E♭ G B♭ D', 'E♭maj7');
eq(T.symbol('E♭', 'min'), 'E♭m', 'symbol E♭m');
eq(T.parseChord('F#m7'), { root: 'F♯', q: 'm7', bass: null }, 'parse F#m7');
eq(T.parseChord('C/E'), { root: 'C', q: 'maj', bass: 'E' }, 'parse slash chord C/E');
eq(T.parseChord('Bb°'), { root: 'B♭', q: 'dim', bass: null }, 'parse B♭°');
eq(T.identify([0, 4, 7])[0].sym, 'C', 'identify C E G');
eq(T.identify([9, 0, 4])[0].sym, 'Am', 'identify A C E');
eq(T.identify([4, 7, 0], 4)[0].inversion, 1, 'C/E is first inversion');
eq(T.identify([7, 0, 4], 7)[0].inversion, 2, 'C/G is second inversion');
eq(T.identify([1, 4, 8])[0].sym, 'C♯m', 'C♯ minor spelled with a sharp');
eq(T.identify([1, 5, 8])[0].sym, 'D♭', 'D♭ major spelled with a flat');
eq(T.identify([0, 4, 7, 10])[0].sym, 'C7', 'identify C7');
eq(T.identify([0, 2]).length, 0, 'two notes are not a chord');
eq(T.voicing('C', 'maj', 4), [60, 64, 67], 'C major voiced from C4');
eq(T.voicing('C', 'maj', 4, 1), [64, 67, 72], 'C major first inversion');

// keys
eq(T.keySig('D').acc, ['F♯', 'C♯'], 'D major: F♯ C♯');
eq(T.keySig('E♭').acc, ['B♭', 'E♭', 'A♭'], 'E♭ major: B♭ E♭ A♭');
eq(T.keySig('E', 'minor').n, 1, 'E minor has 1 sharp');
eq(T.keySig('C', 'minor').n, -3, 'C minor has 3 flats');
eq(T.keySig('C♭').n, -7, 'C♭ major has 7 flats');
eq(T.keySig('C♯').n, 7, 'C♯ major has 7 sharps');
eq(T.keyFromSig(3), 'A', '3 sharps → A major');
eq(T.keyFromSig(-4, 'minor'), 'F', '4 flats → F minor');
eq(T.relMinor('E♭'), 'C', 'relative minor of E♭ is C');
eq(T.relMajor('F♯'), 'A', 'relative major of F♯ minor is A');
eq(T.CIRCLE.map((k, i) => T.circlePos(k) === i).every(Boolean), true, 'circlePos matches CIRCLE order');
eq(T.circlePos('G♭'), 6, 'G♭ sits at 6 o’clock with F♯');
eq(T.circlePos('D', 'minor'), 11, 'D minor sits under F');
eq(T.CIRCLE.map((k, i) => T.relMinor(k) === T.CIRCLE_MINOR[i]).every(Boolean), true, 'inner ring is each key’s relative minor');
let clockOk = true;
T.CIRCLE.forEach((k, hour) => {
  const n = T.keySig(k).n;
  if (!(n === hour || n === hour - 12 || (hour === 6 && n === 6))) clockOk = false;
});
Object.entries(T.CIRCLE_ALT).forEach(([hour, alt]) => { const n = T.keySig(alt.major).n; if (!(n === +hour || n === +hour - 12)) clockOk = false; });
eq(clockOk, true, 'clock maths: hour = sharps, 12 − hour = flats, for every key including enharmonics');

// diatonic chords and numerals
eq(T.diatonic('C').map(c => c.sym), ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°'], 'chords of C major');
eq(T.diatonic('G').map(c => c.roman), ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'], 'numerals of G major');
eq(T.diatonic('A', 'minor').map(c => c.sym), ['Am', 'B°', 'C', 'Dm', 'Em', 'F', 'G'], 'chords of A natural minor');
eq(T.diatonic('A', 'harmonic').map(c => c.roman), ['i', 'ii°', 'III+', 'iv', 'V', 'VI', 'vii°'], 'numerals of A harmonic minor');
eq(T.diatonic('C', 'major', true).map(c => c.sym), ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bø7'], 'seventh chords of C major');
eq(T.romanChord('V7', 'G').sym, 'D7', 'V7 in G is D7');
eq(T.romanChord('vii°', 'F').sym, 'E°', 'vii° in F is E°');
eq(T.romanChord('V', 'A', 'minor').sym, 'E', 'V in A minor is E major');
eq(T.romanChord('VII', 'A', 'minor').sym, 'G', 'VII in A minor is G');
eq(T.romanChord('bVII', 'C').sym, 'B♭', '♭VII in C is B♭');
eq(T.progression(['I', 'V', 'vi', 'IV'], 'G').map(c => c.sym), ['G', 'D', 'Em', 'C'], 'I–V–vi–IV in G');
eq(T.progression(['ii7', 'V7', 'Imaj7'], 'C').map(c => c.sym), ['Dm7', 'G7', 'Cmaj7'], 'ii–V–I in C');
eq(T.progression(['i', 'VI', 'III', 'VII'], 'A', 'minor').map(c => c.sym), ['Am', 'F', 'C', 'G'], 'epic minor in A');
eq(T.PROGRESSIONS.every(p => T.progression(p.romans, p.mode === 'minor' ? 'A' : 'C', p.mode).length === p.romans.length), true, 'every built-in progression realizes');

console.log(fails ? `\n${fails} failing` : '\nall passing');
process.exit(fails ? 1 : 0);
