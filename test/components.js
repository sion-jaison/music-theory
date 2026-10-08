/* Shared tasks from src/app/11-components.js, driven through the computer keys. */
const H = require('./helpers');
(async () => {
  const t = await H.load();
  const M = t.w.Motif;
  const host = t.d.createElement('div'); t.d.body.appendChild(host);
  let result = null;
  const doneFn = (ok, r) => { result = Object.assign({ ok }, r); };

  // playSeq: G major scale up, any octave, with a wrong note on the way
  let clean = M.Tasks.playSeq(host, { prompt: 'Play G major', notes: M.Theory.scale('G3', 'major', true), steps: true }, doneFn);
  for (const n of ['G', 'A', 'B', 'C', 'D', 'E']) { t.pc(n); await t.wait(10); }
  t.pc('F'); await t.wait(10);
  t.check(/whole step up from E/.test(host.querySelector('.fb').textContent), 'playSeq: a wrong note gets a step hint');
  t.pc('F♯'); t.pc('G'); await t.wait(10);
  t.check(result && result.ok && result.misses === 1, 'playSeq: finishes and counts one miss');
  t.check(host.querySelectorAll('.stp.on').length === 7, 'playSeq: W/H labels revealed between all 8 notes');
  clean();

  // playChords: C, then Am, then C/E (bass matters)
  result = null;
  clean = M.Tasks.playChords(host, { chords: ['C', 'Am', 'C/E'] }, doneFn);
  t.pc('C'); t.pc('E'); t.pc('G'); await t.wait(1000);
  t.check(host.querySelectorAll('.progress-dots span.on').length === 1, 'playChords: C E G recognized as C');
  t.pc('A'); t.pc('C'); t.pc('E'); await t.wait(1000);
  t.check(host.querySelectorAll('.progress-dots span.on').length === 2, 'playChords: A C E recognized as Am');
  t.key('z'); await t.wait(10); // octave down: C3–C4 so we can put E below C
  t.key('d'); t.key('g'); t.key('k'); await t.wait(1000); // E3 G3 C4
  t.check(result && result.ok, 'playChords: E G C with E in the bass counts as C/E');
  t.key('x'); clean();

  // playChords rejects the wrong inversion
  result = null;
  clean = M.Tasks.playChords(host, { chords: ['C/G'] }, doneFn);
  t.key('a'); t.key('d'); t.key('g'); await t.wait(50); // C4 E4 G4 root position
  t.check(!result && /put G at the bottom/.test(host.querySelector('.fb').textContent), 'playChords: root position is not C/G, with a hint');
  clean();

  // quiz: 3 rounds, answer right each time
  result = null;
  clean = M.Tasks.quiz(host, { rounds: 3, pass: 3, gen: i => ({ q: 'Pick ' + i, options: ['a', 'b'], answer: i % 2 }) }, doneFn);
  for (let i = 0; i < 3; i++) { host.querySelector(`.choice[data-i="${i % 2}"]`).click(); await t.wait(1200); }
  t.check(result && result.ok && result.score === 3, 'quiz: three right answers pass');
  clean();

  // staff and circle render
  const svg = M.Staff.svg({ clef: 'grand', notes: ['C4', ['E3', 'G3'], 'F♯5'], keySig: -3 });
  t.check(/<svg/.test(svg) && (svg.match(/class="head/g) || []).length === 4, 'Staff: grand staff with 4 note heads');
  const circ = M.Circle.svg({ selected: 0, family: true });
  t.check((circ.match(/class="wedge/g) || []).length === 24 && (circ.match(/ fam/g) || []).length === 6, 'Circle: 24 wedges, six lit for the family of C');
  t.finish();
})();
