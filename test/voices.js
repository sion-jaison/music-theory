/* Voices (src/app/14-voices.js): the voice-leading and counterpoint checker against textbook cases, motion and interval
   helpers, nearestVoicing, realize, corrupt and plant, VoiceView, the alto and tenor clefs in the Score engine, and jsdom
   walkthroughs of PartWriter, Tasks.partWrite and Tasks.findErrors driven by the computer keys. */
const H = require('./helpers');

(async () => {
  const t = await H.load({ unlock: 1 });
  const { w, d, wait } = t, M = w.Motif, VL = M.VoiceLead, VV = M.VoiceView;
  const host = d.createElement('div'); d.body.appendChild(host);
  const show = ps => ps.map(p => `${p.rule}@${p.col}[${p.voices}]`).join(' ') || 'none';
  const errorsOf = ps => ps.filter(p => p.severity === 'error');
  /* exactly one problem of this rule, at this column (and with these voices, when given) */
  function once(ps, rule, col, voices, msg) {
    const hits = ps.filter(p => p.rule === rule);
    const ok = hits.length === 1 && hits[0].col === col && (!voices || hits[0].voices.join() === voices.join());
    t.check(ok, `${msg}: ${rule} at beat ${col + 1} (${show(ps)})`);
    return hits[0];
  }
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  /* ---------- correct four-part writing passes ---------- */
  const IIVVI = [['C5', 'C5', 'B4', 'C5'], ['G4', 'A4', 'G4', 'G4'], ['E4', 'F4', 'D4', 'E4'], ['C3', 'F3', 'G3', 'C3']];
  let ps = VL.check(IIVVI, { key: 'C', romans: ['I', 'IV', 'V', 'I'] });
  t.check(ps.length === 0, `I–IV–V–I in C, textbook voicing: no problems (${show(ps)})`);
  const iiVI = [['D5', 'D5', 'C5'], ['A4', 'B4', 'C5'], ['F4', 'F4', 'E4'], ['F3', 'G3', 'C3']];
  ps = VL.check(iiVI, { key: 'C', romans: ['ii6', 'V7', 'I'] });
  t.check(errorsOf(ps).length === 0, `ii6–V7–I: the 7th steps down, the leading tone rises, an incomplete I is fine (${show(ps)})`);
  const minor = [['A4', 'A4', 'G♯4', 'A4'], ['E4', 'F4', 'E4', 'E4'], ['C4', 'D4', 'B3', 'C4'], ['A2', 'D3', 'E3', 'A2']];
  ps = VL.check(minor, { key: 'A', mode: 'minor', romans: ['i', 'iv', 'V', 'i'] });
  t.check(ps.length === 0, `i–iv–V–i in A minor with G♯: no problems (${show(ps)})`);
  t.check(VL.check([[60, 62], [48, 53]], { key: 'C', style: 'free' }).length === 0 && VL.check([['C5', null], [null, 'C3']]).length === 0, 'MIDI numbers work, and blank cells are skipped');

  /* ---------- each error is found once, with its rule and column ---------- */
  const P5 = [['C5', 'C5', 'D5', 'C5'], ['G4', 'A4', 'B4', 'G4'], ['E4', 'F4', 'D4', 'E4'], ['C3', 'F3', 'G3', 'C3']];
  ps = VL.check(P5, { key: 'C', romans: ['I', 'IV', 'V', 'I'] });
  const p5 = once(ps, 'parallel5', 2, [0, 3], 'soprano C5→D5 over F3→G3');
  t.check(errorsOf(ps).length === 1 && p5 && p5.cols.join() === '1,2' && /Soprano and bass move in parallel 5ths from beat 2 to beat 3 \(C–F to D–G\)\. Move one of them the other way\./.test(p5.text),
    `parallel 5ths: the only error, cols 2–3, in plain words (${p5 && p5.text})`);
  once(VL.check([['G4', 'A4'], ['C4', 'D4']], { style: 'free' }), 'parallel5', 1, [0, 1], 'two voices G–C to A–D');
  once(VL.check([['C5', 'D5'], ['C4', 'D4']], { style: 'free' }), 'parallel8', 1, [0, 1], 'octaves C to D');
  once(VL.check([['C4', 'D4'], ['C4', 'D4']], { style: 'free' }), 'parallelUnison', 1, [0, 1], 'unisons C to D');
  const c5 = once(VL.check([['G4', 'C5'], ['C4', 'F3']], { style: 'free' }), 'contrary5', 1, [0, 1], 'a 5th to a 12th in opposite directions');
  t.check(c5 && c5.severity === 'warn', '5ths by contrary motion are a warning');
  once(VL.check([['C5', 'D5'], ['C4', 'D3']], { style: 'free' }), 'contrary8', 1, [0, 1], 'an octave to two octaves in opposite directions');
  once(VL.check([['E5', 'G5'], ['C5', 'D5'], ['G4', 'G4'], ['C3', 'G3']], { key: 'C' }), 'direct8', 1, [0, 3], 'outer voices into an octave, soprano leaping');
  once(VL.check([['E5', 'A5'], ['C3', 'D3']], { key: 'C' }), 'direct5', 1, [0, 1], 'two voices into a 5th, upper leaping');
  t.check(!VL.check([['E5', 'D5'], ['C5', 'B4'], ['G4', 'G4'], ['C3', 'G3']], { key: 'C' }).some(p => /^direct/.test(p.rule)), 'no direct octave when the soprano moves by step');
  once(VL.check([['C5'], ['E5'], ['G4'], ['C3']], { key: 'C' }), 'crossing', 0, [0, 1], 'alto above soprano');
  once(VL.check([['C5', 'G4'], ['A4', 'E4']], { style: 'free' }), 'overlap', 1, [0, 1], 'upper voice drops below the lower voice’s last note');
  once(VL.check([['E5'], ['C4'], ['G3'], ['C3']], { key: 'C' }), 'spacing', 0, [0, 1], 'soprano and alto a 10th apart');
  once(VL.check([['C5'], ['G4'], ['E4'], ['C2']], { key: 'C', only: ['spacing'] }), 'spacing', 0, [2, 3], 'tenor and bass more than a 12th apart');
  once(VL.check([['A5'], ['C5'], ['E4'], ['C3']], { key: 'C' }), 'range', 0, [0], 'soprano A5');
  once(VL.check([['D5'], ['B4'], ['B3'], ['G3']], { key: 'C', romans: ['V'] }), 'doubledLT', 0, [1, 2], 'V with B doubled');
  const d3 = once(VL.check([['E5'], ['G4'], ['E4'], ['C3']], { key: 'C', romans: ['I'] }), 'doubled3rd', 0, [0, 2], 'root-position I with E doubled');
  t.check(d3 && d3.severity === 'warn', 'a doubled 3rd is a warning');
  once(VL.check([['F5'], ['B4'], ['F4'], ['G3']], { key: 'C', romans: ['V7'] }), 'doubled7th', 0, [0, 2], 'V7 with F doubled');
  const inc = once(VL.check([['C5'], ['G4'], ['C4'], ['C3']], { key: 'C', romans: ['I'] }), 'incomplete', 0, null, 'I with no E');
  t.check(inc && /has no 3rd \(E\)/.test(inc.text), 'incomplete names what is missing');
  t.check(!VL.check([['C5'], ['C5'], ['E4'], ['C3']], { key: 'C', romans: ['I'] }).some(p => p.rule === 'incomplete'), 'leaving out the 5th is fine');
  once(VL.check([['D5'], ['G4'], ['E4'], ['C3']], { key: 'C', romans: ['I'] }), 'notInChord', 0, [0], 'D5 over I');
  once(VL.check([['C5'], ['G4'], ['E4'], ['C3']], { key: 'C', romans: ['I6'] }), 'inversion', 0, [3], 'I6 with C in the bass');
  const lt = once(VL.check([['B4', 'G4'], ['G4', 'E4'], ['D4', 'C4'], ['G2', 'C3']], { key: 'C', romans: ['V', 'I'] }), 'ltResolve', 1, [0], 'soprano B → G at V–I');
  t.check(lt && /leading tone \(B\) in the soprano on beat 1 should rise to C on beat 2/.test(lt.text), 'the leading-tone sentence names the notes and beats');
  t.check(!VL.check([['G4', 'G4'], ['D4', 'E4'], ['B3', 'G3'], ['G2', 'C3']], { key: 'C', romans: ['V', 'I'] }).some(p => p.rule === 'ltResolve'), 'an inner-voice leading tone may fall');
  once(VL.check([['F5', 'G5'], ['B4', 'C5'], ['D4', 'E4'], ['G3', 'C3']], { key: 'C', romans: ['V7', 'I'] }), 'seventh', 1, [0], 'the 7th F rising to G');
  t.check(!VL.check([['F5', 'E5'], ['B4', 'C5'], ['D4', 'C4'], ['G3', 'C3']], { key: 'C', romans: ['V7', 'I'] }).some(p => p.rule === 'seventh'), 'the 7th stepping down passes');
  once(VL.check([['F4', 'G♯4'], ['D3', 'E3']], { key: 'A', mode: 'minor', style: 'free' }), 'aug2', 1, [0], 'F to G♯ in A minor');
  t.check(!VL.check([['F4', 'A♭4'], ['D3', 'E3']], { key: 'C', style: 'free' }).some(p => p.rule === 'aug2'), 'F to A♭ (a minor 3rd) is not an augmented 2nd');
  once(VL.check([['F4', 'B4'], ['D3', 'G3']], { style: 'free' }), 'tritone', 1, [0], 'F to B');
  once(VL.check([['C4', 'E5'], ['C3', 'C3']], { style: 'free' }), 'leap', 1, [0], 'C4 to E5');
  once(VL.check([['C4', 'F4', 'C5'], ['C3', 'C3', 'C3']], { style: 'free' }), 'twoLeaps', 2, [0], 'C, F, C upward');
  t.check(!VL.check([['C4', 'E4', 'G4'], ['C3', 'C3', 'C3']], { style: 'free' }).some(p => p.rule === 'twoLeaps'), 'two 3rds outlining a triad are fine');
  ps = VL.check(P5, { key: 'C', romans: ['I', 'IV', 'V', 'I'], ignore: ['parallel5'] });
  t.check(!ps.some(p => p.rule === 'parallel5') && VL.check(P5, { key: 'C', romans: ['I', 'IV', 'V', 'I'], severity: { parallel5: 'warn' } })[0].severity === 'warn', 'rules can be ignored or given another severity');

  /* ---------- first species ---------- */
  const cf1 = ['C4', 'E4', 'D4', 'F4', 'E4', 'G4', 'F4', 'E4', 'D4', 'C4'];
  const cp1 = ['C5', 'G4', 'B4', 'A4', 'C5', 'B4', 'D5', 'C5', 'B4', 'C5'];
  const sp1 = (cp, cf, o) => VL.check([cp, cf || cf1], Object.assign({ style: 'species1', key: 'C' }, o || {}));
  const with1 = (i, n) => cp1.map((x, k) => (k === i ? n : x));
  ps = sp1(cp1);
  t.check(ps.length === 0, `first species above a cantus: consonances, contrary motion into the octaves, cadence by step (${show(ps)})`);
  const cons = once(sp1(with1(3, 'G4')), 'consonance', 3, [0, 1], 'a 2nd (F–G)');
  t.check(cons && /major 2nd \(F–G\), a dissonance/.test(cons.text), 'the dissonance is named');
  once(sp1(with1(4, 'B4').map((x, k) => (k === 5 ? 'D5' : x))), 'parallel5', 5, [0, 1], 'E–B to G–D');
  once(sp1(with1(5, 'G5')), 'direct8', 5, [0, 1], 'both voices up into the octave G');
  once(sp1(with1(0, 'A4')), 'startPerfect', 0, [0, 1], 'starting on a 6th');
  t.check(!sp1(with1(0, 'G4')).some(p => p.rule === 'startPerfect'), 'a 5th may open above the cantus');
  once(VL.check([['C4', 'E4', 'D4', 'F4'], ['G3', 'C4', 'B3', 'D4']], { style: 'species1', key: 'C', cantus: 0 }), 'startPerfect', 0, [0, 1], 'below the cantus a 5th will not do');
  once(sp1(with1(9, 'A4')), 'endPerfect', 9, [0, 1], 'ending on a 6th');
  once(sp1(with1(8, 'F4')), 'cadence', 9, [1 - 1], 'reaching the octave by a leap');
  once(VL.check([['C5', 'B4', 'B4', 'B4', 'C5'], ['C4', 'D4', 'E4', 'D4', 'C4']], { style: 'species1', key: 'C' }), 'repeated', 3, [0], 'a second repeated note');
  t.check(!VL.check([['C5', 'B4', 'B4', 'A4', 'B4', 'C5'], ['C4', 'D4', 'E4', 'F4', 'D4', 'C4']], { style: 'species1', key: 'C' }).some(p => p.rule === 'repeated'), 'one repeated note is fine');
  once(sp1(['C5', 'G4', 'D5', 'A4', 'E5', 'B4', 'D5', 'C5', 'B4', 'C5']), 'steps', 9, [0], 'six leaps and three steps');
  once(VL.check([['C5', 'B4', 'G3'], ['C4', 'D4', 'E4']], { style: 'species1', key: 'C' }), 'crossing', 2, [0, 1], 'the counterpoint below the cantus');

  /* ---------- second species: two notes against one ---------- */
  const cf2 = ['C4', null, 'D4', null, 'F4', null, 'E4', null, 'D4', null, 'C4', null];
  const cp2 = ['C5', 'B4', 'A4', 'B4', 'D5', 'A4', 'C5', 'G4', 'A4', 'B4', 'C5', null];
  const sp2 = cp => VL.check([cp, cf2], { style: 'species2', key: 'C' });
  ps = sp2(cp2);
  t.check(ps.length === 0, `second species with a passing 7th on a weak beat: no problems (${show(ps)})`);
  once(sp2(cp2.map((x, k) => (k === 2 ? 'G4' : x))), 'consonance', 2, [0, 1], 'a 4th on a strong beat');
  once(sp2(cp2.map((x, k) => (k === 3 ? 'E5' : x))), 'passing', 3, [0], 'a weak-beat 9th reached by leap');
  t.check(VL.check([cp2, cf2], { style: 'species2', key: 'C', beats: [0, 2, 4, 6, 8, 10] }).length === 0, 'beats can list the strong columns');

  /* ---------- fourth species: suspensions ---------- */
  const cf4 = ['C4', null, 'F4', null, 'E4', null, 'D4', null, 'C4', null];
  const cp4 = [null, 'C5', 'C5', 'D5', 'D5', 'C5', 'C5', 'B4', 'C5', null];
  const sp4 = cp => VL.check([cp, cf4], { style: 'species4', key: 'C' });
  ps = sp4(cp4);
  t.check(ps.length === 0, `fourth species: a chain of 7–6 suspensions above the cantus (${show(ps)})`);
  once(sp4(cp4.map((x, k) => (k === 4 ? 'F5' : x))), 'suspPrep', 4, [0], 'a 9th struck, not tied');
  once(sp4(cp4.map((x, k) => (k === 5 ? 'E5' : x))), 'suspResolve', 5, [0], 'a 7th rising');
  once(sp4([null, 'C5', 'C5', 'F4', 'F4', 'E4', 'B4', 'B4', 'C5', null]), 'suspType', 4, [0], '2–1 above the cantus');
  ps = VL.check([['F4', null, 'E4', null, 'D4', null, 'C4', null], [null, 'D4', 'D4', 'C4', 'C4', 'B3', 'C4', null]], { style: 'species4', key: 'C', cantus: 0 });
  t.check(!ps.some(p => /^susp/.test(p.rule)), `2–3 suspensions below the cantus work (${show(ps)})`);
  once(VL.check([['F4', null, 'E4', null, 'D4', null, 'C4', null], [null, 'F3', 'F3', 'E3', 'B3', 'B3', 'C4', null]], { style: 'species4', key: 'C', cantus: 0 }), 'suspType', 2, [1], '7–8 below the cantus');

  /* ---------- motion and intervals ---------- */
  t.check(VL.motion('C4', 'D4', 'E4', 'F4') === 'parallel' && VL.motion('C4', 'D4', 'G4', 'A4') === 'parallel' && VL.motion('C4', 'D4', 'G4', 'F4') === 'contrary'
    && VL.motion('C4', 'C4', 'G4', 'F4') === 'oblique' && VL.motion('C4', 'D4', 'E4', 'A4') === 'similar' && VL.motion(60, 60, 64, 64) === 'static' && VL.motion('E4', 'F4', 'C4', 'D4') === 'parallel',
    'motion: parallel (3rds stay 3rds), contrary, oblique, similar, static; names or MIDI');
  const i5 = VL.intervalClass('C4', 'G4'), i4 = VL.intervalClass('G4', 'C5'), i6 = VL.intervalClass(64, 72), itt = VL.intervalClass('F4', 'B4'), i10 = VL.intervalClass('C3', 'E4');
  t.check(i5.perfect && i5.consonant && i5.short === 'P5' && i4.dissonant && i4.short === 'P4' && i6.imperfect && i6.short === 'm6' && itt.dissonant && itt.name === 'augmented 4th' && i10.imperfect && i10.num === 10,
    'intervalClass: perfect 5th, the 4th as a dissonance, imperfect 6th and 10th, the tritone');
  t.check(VL.intervalClass('G4', 'C4').short === 'P5' && VL.totalMotion(['C5', 'G4', 'E4'], [72, 65, 62]) === 4, 'intervalClass in either order; totalMotion adds every voice’s half steps');

  /* ---------- nearestVoicing ---------- */
  const nv1 = VL.nearestVoicing([67, 64, 60], 'F'), nv2 = VL.nearestVoicing([72, 67, 64], 'G'), nv3 = VL.nearestVoicing(['E4', 'C4', 'G3'], 'Am', { names: true });
  t.check(nv1.join() === '69,65,60' && nv2.join() === '71,67,62' && nv3.join() === 'E4,C4,A3', `nearestVoicing keeps common tones and moves the rest the least (${nv1} / ${nv2} / ${nv3})`);
  const nv4 = VL.nearestVoicing([67, 64, 60, 48], 'G7'), nv5 = VL.nearestVoicing([64, 60, 55], 'V7', { key: 'C' }), nv6 = VL.nearestVoicing([64, 60, 55, 48], 'C/E');
  t.check(nv4.join() === '67,65,59,50' && nv5.join() === '65,59,55' && nv6[3] % 12 === 4 && VL.totalMotion([64, 60, 55, 48], nv6) <= 6,
    `nearestVoicing: a complete G7, a three-voice V7 keeps G and moves E to F and C to B, a slash chord puts E in the bass (${nv4} / ${nv5} / ${nv6})`);

  /* ---------- realize: textbook S A T B ---------- */
  for (const [romans, key, mode] of [[['I', 'IV', 'V', 'I'], 'C'], [['ii6', 'V7', 'I'], 'C'], [['I', 'vi', 'ii6', 'V', 'I'], 'C'], [['i', 'iv', 'V', 'i'], 'A', 'minor'], [['I', 'IV', 'I64', 'V7', 'I'], 'G'], [['I', 'vii°6', 'I6', 'IV', 'V43', 'I'], 'D'], [['i', 'VI', 'ii°6', 'V7', 'i'], 'E♭', 'minor']]) {
    const v = VL.realize(romans, key, mode);
    const errs = errorsOf(VL.check(v, { key, mode, romans }));
    const bassOk = romans.every((r, c) => M.Theory.pc(v[3][c]) === M.Theory.pc(M.Theory.romanChord(r, key, mode).bass));
    t.check(v.length === 4 && v.every(x => x.length === romans.length && x.every(Boolean)) && !errs.length && bassOk,
      `realize ${romans.join('–')} in ${key} ${mode || 'major'}: four complete voices, the right bass, no errors (${v.map(x => x.join(' ')).join(' | ')}${errs.length ? ' · ' + show(errs) : ''})`);
  }
  const mn = VL.realize(['i', 'iv', 'V', 'i'], 'A', 'minor');
  t.check(mn.some(x => x[2] === 'G♯4' || x[2] === 'G♯3' || x[2] === 'G♯5'), 'realize spells the raised leading tone (G♯) in A minor');
  const given = VL.realize(['I', 'IV', 'V', 'I'], 'C', 'major', { soprano: ['E5', 'F5', 'D5', 'C5'] });
  t.check(given[0].join(' ') === 'E5 F5 D5 C5' && !errorsOf(VL.check(given, { key: 'C', romans: ['I', 'IV', 'V', 'I'] })).length, 'realize harmonizes a given soprano line');

  /* ---------- corrupt and plant ---------- */
  const R8 = ['I', 'IV', 'V', 'I', 'vi', 'ii6', 'V7', 'I'], base8 = VL.realize(R8, 'C', 'major'), o8 = { key: 'C', romans: R8, random: rnd };
  for (const rule of ['parallel5', 'parallel8', 'doubledLT', 'ltResolve', 'seventh', 'crossing', 'spacing', 'range', 'incomplete', 'notInChord', 'inversion', 'doubled3rd', 'leap']) {
    const bad = VL.corrupt(base8, rule, o8);
    const ok = !!bad && bad.planted.rule === rule && VL.check(bad, o8).filter(p => p.rule === rule).length === 1 && VL.check(bad, o8).some(p => p.rule === rule && p.col === bad.planted.col)
      && bad.planted.changes.length >= 1 && bad.planted.changes.every(ch => ch.from !== ch.to);
    t.check(ok, `corrupt(${rule}) plants exactly one, at beat ${bad ? bad.planted.col + 1 : '?'}${bad ? ' (' + bad.planted.changes.map(ch => ch.from + '→' + ch.to).join(', ') + ')' : ''}`);
  }
  t.check(VL.check(base8, o8).length === 0 && VL.corrupt(base8, 'parallel5', o8) !== base8, 'corrupt leaves the original alone');
  const pl = VL.plant(null, ['parallel5', 'doubledLT', 'ltResolve'], o8);
  const now = pl ? VL.check(pl.voices, o8) : [];
  t.check(pl && pl.planted.map(p => p.rule).join() === 'parallel5,doubledLT,ltResolve' && pl.planted.every(p => now.filter(q => q.rule === p.rule && q.col === p.col).length === 1),
    `plant: three errors, each found once (${pl ? pl.planted.map(p => p.rule + '@' + (p.col + 1)).join(' ') : 'none'})`);
  const plm = VL.plant(null, ['aug2'], { key: 'A', mode: 'minor', romans: ['i', 'iv', 'V', 'i', 'VI', 'ii°6', 'V7', 'i'], random: rnd });
  t.check(plm && plm.planted[0].rule === 'aug2', 'plant: an augmented 2nd in a minor key');
  t.check(VL.corrupt(VL.realize(['I', 'IV', 'V', 'I'], 'G'), 'seventh', { key: 'G', romans: ['I', 'IV', 'V', 'I'] }) === null, 'corrupt returns null when there is no 7th to leave unresolved');

  /* ---------- VoiceView ---------- */
  const count = (s, re) => (s.match(re) || []).length;
  let g = VV.svg({ voices: IIVVI, key: 'C', labels: ['I', 'IV', 'V65', 'I'], marks: [{ col: 2, voice: 0, kind: 'error' }], lines: [{ from: { col: 1, voice: 0 }, to: { col: 2, voice: 0 } }], sel: { col: 1, voice: 1 } });
  t.check(/^<svg class="vv"/.test(g) && /role="img"/.test(g) && count(g, /class="nt-hd"/g) >= 15 && count(g, /class="vv-stem"/g) === 16 && count(g, /class="vv-sl"/g) === 10,
    `VoiceView: a grand staff with 16 half notes and a stem each (${count(g, /class="nt-hd"/g)} heads, ${count(g, /class="vv-stem"/g)} stems)`);
  t.check(/Soprano: C5, C5, B4, C5\. Alto: G4, A4, G4, G4\. Tenor: E4, F4, D4, E4\. Bass: C3, F3, G3, C3\. Numerals: I, IV, V65, I\./.test(g), 'VoiceView: the aria-label reads every voice and the numerals');
  t.check(/vv-error/.test(g) && count(g, /class="vv-ring vv-ring-error"/g) === 1 && count(g, /class="vv-line error"/g) === 1 && /vv-sel/.test(g) && /vv-selbg/.test(g) && /class="vv-fig"/.test(g),
    'VoiceView: marks with a ring, a line, the selection and stacked figures');
  const up = s => (s.match(/class="vv-stem" x1="([\d.]+)"[^>]*y1="([\d.]+)" y2="([\d.]+)"/g) || []).map(x => { const m = /y1="([\d.]+)" y2="([\d.]+)"/.exec(x); return +m[2] < +m[1]; });
  const dirs = up(VV.svg({ voices: [['C5'], ['G4'], ['E4'], ['C3']] }));
  t.check(dirs.join() === 'true,false,true,false', `VoiceView: soprano and tenor stems up, alto and bass down (${dirs})`);
  g = VV.svg({ voices: [['A4'], ['G4']], staves: 'single', durations: 'q' });
  const hx = [...g.matchAll(/class="nt-hd" cx="([\d.]+)"/g)].map(m => +m[1]);
  t.check(count(g, /class="vv-sl"/g) === 5 && hx.length === 2 && Math.abs(hx[0] - hx[1]) > 8, 'VoiceView: two voices a 2nd apart on one staff sit side by side');
  g = VV.svg({ voices: [[null, 'C5', 'C5', 'D5', 'D5', 'C5', 'C5', 'B4', 'C5', null], ['C4', null, 'F4', null, 'E4', null, 'D4', null, 'C4', null]], style: 'species4', fixed: [1], editable: true, placeholders: [{ col: 0, voice: 0 }] });
  t.check(count(g, /class="vv-tie"/g) === 3 && count(g, /class="vv-ph"/g) === 1 && count(g, /class="vv-hit"/g) === 20 && count(g, /vv-fixed/g) === 5 && count(g, /class="vv-bar"/g) === 5,
    `VoiceView: species 4 ties, a placeholder, a hit area per cell, the given cantus, a bar line per bar (${count(g, /class="vv-tie"/g)} ties, ${count(g, /class="vv-bar"/g)} bars)`);
  g = VV.svg({ voices: [['F♯4', 'G4'], ['D3', 'C♯3']], staves: 'two', clefs: ['alto', 'tenor'], key: 'D' });
  t.check(count(g, /nt-clef-c/g) === 2 && count(g, /class="vv-acc"/g) === 4, 'VoiceView: alto and tenor clefs, each with the key signature of D (F♯ C♯ shown in the signature only)');

  /* ---------- clefs in the Score engine ---------- */
  const S = M.Score;
  g = S.svg('C4:q E5:q C3:q G4:q', { meter: '4/4', clef: 'alto' });
  t.check(/nt-clef-c/.test(g) && count(g, /class="nt-ledger"/g) === 3 && !/𝄞/.test(g), `Score: alto clef draws a C clef; E5 needs 2 ledger lines and C3 one (${count(g, /class="nt-ledger"/g)})`);
  g = S.svg('C4:q E4:q F4:q G4:q | D3:w', { meter: '4/4', clef: 'tenor' });
  t.check(/nt-clef-c/.test(g) && count(g, /class="nt-ledger"/g) === 1, 'Score: tenor clef, E4 on the top line, F4 just above it, G4 on one ledger line, D3 on the bottom line');
  g = S.svg('C4:w', { clef: 'tenor', keySig: -3 }); const g2 = S.svg('D4:w', { clef: 'alto', keySig: 2 });
  t.check(count(g, /class="nt-acc"/g) === 3 && count(g2, /class="nt-acc"/g) === 2 && /viewBox="0 -/.test(g), 'Score: alto and tenor key signatures; the tenor clef sticks out above the staff and the view makes room');
  t.check(/𝄞/.test(S.svg('C4:w', {})) && /𝄢/.test(S.svg('C3:w', { clef: 'bass' })), 'Score: treble and bass clefs unchanged');
  const capT = M.MelodyCapture.mount(host, { meter: '4/4', bars: 1, clef: 'tenor', initial: S.parse('C4:q D4:q E4:q F4:q') });
  t.check(host.querySelector('.nt-edit svg .nt-clef-c') && capT.events.length === 4, 'MelodyCapture: a tenor-clef part');
  capT.destroy();

  /* ---------- PartWriter: first species from the computer keys ---------- */
  let kb = 60;
  async function play(name) {
    const m = M.Theory.midi(name);
    while (m < kb) { t.key('z'); kb -= 12; }
    while (m > kb + 12) { t.key('x'); kb += 12; }
    t.key(m - kb === 12 ? 'k' : H.PC_KEY[m - kb]); await wait(5);
  }
  let changes = 0, lastPs = null;
  const pw = M.PartWriter.mount(host, { voices: 2, given: { cantus: cf1 }, key: 'C', onChange: (v, p) => { changes++; lastPs = p; } });
  const box = () => host.querySelector('.pw-score');
  const press = (key, o) => box().dispatchEvent(new w.KeyboardEvent('keydown', Object.assign({ key, bubbles: true }, o || {})));
  t.check(pw.selected.col === 0 && pw.selected.voice === 0 && host.querySelectorAll('.vv-ph').length === 10 && host.querySelector('[data-v="1"]').disabled,
    'PartWriter: the counterpoint starts selected at beat 1, every blank shows, the cantus is given');
  await play('C5'); await play('G4'); await play('B4');
  t.check(pw.voices[0].slice(0, 3).join(' ') === 'C5 G4 B4' && pw.selected.col === 3 && changes === 3, `PartWriter: notes keep the octave played and the selection moves on (${pw.voices[0].join(' ')})`);
  await play('G4');
  t.check(pw.problems.some(p => p.rule === 'consonance' && p.col === 3) && host.querySelector('.vv-error') && /Dissonance/.test(host.querySelector('.pw-probs').textContent) && /1 error/.test(host.querySelector('.pw-count').textContent),
    'PartWriter: a dissonance shows as a mark and a sentence, counted');
  t.click(box().querySelector('[data-col="3"][data-voice="0"]'));
  t.check(pw.selected.col === 3 && /Beat 4, counterpoint: G4/.test(host.querySelector('.pw-info').textContent), 'PartWriter: clicking a cell selects it and says what is there');
  press('ArrowUp'); press('ArrowUp');
  t.check(pw.voices[0][3] === 'A4' && !pw.problems.some(p => p.rule === 'consonance'), `PartWriter: ↑ twice moves G4 to A4 and the error clears (${pw.voices[0][3]})`);
  press('ArrowUp', { shiftKey: true }); t.check(pw.voices[0][3] === 'A5', 'PartWriter: Shift+↑ moves an octave');
  press('ArrowDown', { shiftKey: true }); press('Delete');
  t.check(pw.voices[0][3] === null && host.querySelectorAll('.vv-ph').length === 7, 'PartWriter: Delete clears the note');
  press('ArrowRight'); t.check(pw.selected.col === 4, '→ moves to the next column');
  press('ArrowLeft');
  M.Bus.emit('note', { midi: 69, source: 'mic', t: 0 });
  t.check(pw.voices[0][3] === 'A4' && pw.selected.col === 4, 'PartWriter: a sung note (mic) fills the selected voice');
  for (const n of ['C5', 'B4', 'D5', 'C5', 'B4', 'C5']) await play(n);
  t.check(pw.voices[0].join(' ') === cp1.join(' ') && pw.problems.length === 0 && /No problems so far/.test(host.querySelector('.pw-count').textContent) && lastPs && lastPs.length === 0,
    'PartWriter: the finished counterpoint passes every rule');
  t.click(host.querySelector('[data-a="play"]'));
  await wait(150);
  t.check(host.querySelector('.vv-col.vv-now'), 'PartWriter: Play all lights the column that sounds');
  t.click(host.querySelector('[data-a="clear"]'));
  t.check(pw.voices[0][0] === 'C5' && /Press again/.test(host.querySelector('[data-a="clear"]').textContent), 'PartWriter: Clear all asks first');
  t.click(host.querySelector('[data-a="clear"]'));
  t.check(pw.voices[0].every(x => x === null) && pw.voices[1].join(' ') === cf1.join(' '), 'PartWriter: Clear all clears only the written voice');
  pw.destroy();

  /* species 2: a cantus given one note per bar, the final whole note */
  const pw2 = M.PartWriter.mount(host, { voices: 2, style: 'species2', given: { cantus: ['C4', 'D4', 'F4', 'E4', 'D4', 'C4'] }, key: 'C' });
  t.check(pw2.cols === 12 && pw2.voices[1][1] === null && pw2.voices[1][2] === 'D4' && pw2.progress.need === 11, `PartWriter species 2: 12 columns, the cantus spread over its bars, 11 cells to write (${pw2.progress.need})`);
  for (const n of cp2.slice(0, 11)) await play(n);
  t.check(pw2.voices[0].slice(0, 11).join(' ') === cp2.slice(0, 11).join(' ') && pw2.problems.length === 0 && pw2.notes.some(x => x.m === 60 && x.d > 1.2), `PartWriter species 2: written and clean; the cantus sounds for a whole bar (${M.VoiceLead.check(pw2.voices, { style: 'species2' }).length})`);
  pw2.destroy();

  /* ---------- Tasks.partWrite: four voices, saved ---------- */
  let res = null;
  const doneFn = (ok, r) => { res = Object.assign({ ok }, r); };
  const before = M.Store.data.sketches.length;
  let clean = M.Tasks.partWrite(host, { prompt: 'Add soprano, alto and tenor.', voices: 4, romans: ['I', 'IV', 'V', 'I'], key: 'C', given: { bass: ['C3', 'F3', 'G3', 'C3'] }, save: { level: 8, tags: ['four-part'] } }, doneFn);
  const bSave = () => host.querySelector('[data-act="save"]');
  t.check(bSave().disabled && /0 of 12/.test(host.querySelector('.nt-checks').textContent), 'partWrite: Save waits for every note');
  /* column by column: soprano, alto, tenor; one parallel 5th on the way */
  for (const n of ['C5', 'G4', 'E4', 'C5', 'A4', 'F4', 'D5', 'B4', 'D4', 'C5', 'G4', 'E4']) await play(n);
  t.check(bSave().disabled && res === null && host.querySelector('.pw-probs').textContent.includes('Parallel 5ths') && /1 error to fix/.test(host.querySelector('.nt-checks').textContent),
    'partWrite: all written, but parallel 5ths keep Save closed');
  t.click(host.querySelector('.pw-probs [data-p="0"]'));
  t.check(host.querySelector('.vv-sel'), 'partWrite: clicking the sentence selects a note of the error');
  t.click(host.querySelector('[data-col="2"][data-voice="0"]'));
  await play('B4');
  /* B4 in the soprano doubles the leading tone with the alto: fix the alto too */
  t.check(bSave().disabled && /Doubled leading tone/.test(host.querySelector('.pw-probs').textContent), 'partWrite: soprano B4 now doubles the alto’s leading tone');
  t.click(host.querySelector('[data-col="2"][data-voice="1"]'));
  await play('G4');
  t.check(!bSave().disabled && /✓ No errors/.test(host.querySelector('.nt-checks').textContent), 'partWrite: fixed (soprano B4, alto G4): Save opens');
  host.querySelector('input[type="text"]').value = 'Chorale test';
  t.click(bSave());
  const sk = M.Store.data.sketches[0];
  t.check(res && res.ok && res.problems.length === 0 && M.Store.data.sketches.length === before + 1 && sk.name === 'Chorale test' && sk.voices.length === 4 && sk.voices[0].join(' ') === 'C5 C5 B4 C5'
    && sk.notes.length === 16 && sk.notes.every(n => n.m > 30 && n.t >= 0 && n.d > 0) && sk.key === 'C major' && sk.level === 8 && sk.tags[0] === 'four-part' && sk.romans.join() === 'I,IV,V,I' && sk.bpm > 0,
    'partWrite: saves name, notes (every voice, in seconds), voices as note names, numerals, key, level and tags');
  t.check(/class="vv"/.test(VV.svg({ voices: sk.voices })), 'a saved sketch’s voices draw again');
  clean();

  /* need: 'complete' saves with errors left */
  res = null;
  clean = M.Tasks.partWrite(host, { voices: 2, cols: 2, style: 'free', need: 'complete', key: 'C', given: { lower: ['C4', 'D4'] } }, doneFn);
  await play('G4'); await play('A4');
  t.check(!bSave().disabled, 'partWrite need complete: parallel 5ths do not block Save');
  clean();

  /* ---------- Tasks.findErrors ---------- */
  res = null; seed = 5;
  clean = M.Tasks.findErrors(host, { romans: R8, key: 'C', errors: ['parallel5', 'doubledLT'], random: rnd }, doneFn);
  const fbText = () => host.querySelector('.fe-msg .fb').textContent;
  const planted = (() => { const vs = [...host.querySelectorAll('.fe-score .vv-n')]; return vs.length; })();
  t.check(planted === 32 && /0 of 2 found/.test(host.querySelector('[data-count]').textContent), 'findErrors: shows the faulty realization and the count');
  /* find the planted notes the way a learner would: tap every note until both are found */
  const svgAria = host.querySelector('.fe-score svg').getAttribute('aria-label');
  let taps = 0;
  for (let c = 0; c < 8 && !res; c++) for (let v = 0; v < 4 && !res; v++) {
    const cell = host.querySelector(`.fe-score .vv-hit[data-col="${c}"][data-voice="${v}"]`);
    if (!cell) continue;
    t.click(cell); taps++;
  }
  t.check(res && res.found === 2 && res.planted.length === 2 && res.misses === taps - 2 && host.querySelectorAll('.fe-found li').length === 2 && /Parallel 5ths|Doubled leading tone/.test(host.querySelector('.fe-found').textContent),
    `findErrors: tapping a note of each error finds it; fine notes count as misses (${res && res.misses} misses, ${svgAria.length > 0})`);
  clean();
  /* naming the rule, then fixing */
  res = null; seed = 9;
  clean = M.Tasks.findErrors(host, { romans: ['I', 'IV', 'V', 'I', 'vi', 'ii6', 'V7', 'I'], key: 'C', errors: ['ltResolve'], name: true, fix: true, random: rnd }, doneFn);
  let hit = null;
  for (let c = 0; c < 8 && !hit; c++) for (let v = 0; v < 4 && !hit; v++) {
    t.click(host.querySelector(`.fe-score .vv-hit[data-col="${c}"][data-voice="${v}"]`));
    if (!host.querySelector('.fe-names').hidden) hit = { c, v };
  }
  const wrong = [...host.querySelectorAll('.fe-names [data-r]')].find(b => b.dataset.r !== 'ltResolve');
  t.click(wrong);
  t.check(hit && /Not /.test(fbText()) && !res, 'findErrors name: a wrong rule name is refused');
  t.click(host.querySelector('.fe-names [data-r="ltResolve"]'));
  t.check(host.querySelector('.fe-fix .pw') && !res, 'findErrors fix: after finding, the editor opens');
  /* fix it: the soprano's leading tone must rise to the tonic */
  const fx = host.querySelector('.fe-fix');
  const errs = () => [...fx.querySelectorAll('.pw-probs li.error')].length;
  t.check(errs() === 1, 'findErrors fix: the planted error is listed');
  t.click(fx.querySelector('.pw-probs [data-p="0"]'));
  const selNote = fx.querySelector('.vv-sel');
  const col = +selNote.getAttribute('data-col');
  const prev = fx.querySelector(`.vv-n[data-col="${col - 1}"][data-voice="${selNote.getAttribute('data-voice')}"]`);
  t.check(!!prev, 'findErrors fix: the leading tone is the note before');
  await play('C5');
  if (!res) { await play('C6'); }
  t.check(res && res.voices && M.VoiceLead.summary(M.VoiceLead.check(res.voices, { key: 'C', romans: R8 })).errors === 0, `findErrors fix: done once no errors are left (${res ? 'done' : fx.querySelector('.pw-probs').textContent})`);
  clean();

  t.finish();
})();
