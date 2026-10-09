/* The studio tools: backing styles (15-backing.js), MIDI export (16-midifile.js), Transcribe (17-transcribe.js) and
   instrument data (18-instruments.js), plus playSketch with parts and a backing, and the Toolbox's Studio tabs. */
const H = require('./helpers');
const mod12 = n => ((n % 12) + 12) % 12;
const close = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 1e-6 : eps);

(async () => {
  const t = await H.load();
  const M = t.w.Motif, B = M.Backing, S = M.Sound, T = M.Theory;

  /* ================= Backing: the arrangement, bar by bar ================= */
  const count = (arr, bar) => { const c = {}; arr.events.filter(e => e.bar === bar).forEach(e => { const k = e.role === 'drums' ? e.kind : e.role; c[k] = (c[k] || 0) + 1; }); return c; };
  const at = (arr, bar, kind) => arr.events.filter(e => e.bar === bar && (e.kind === kind || e.role === kind)).map(e => +(e.t - bar * arr.barLen).toFixed(3));
  t.check(B.STYLE_IDS.join() === 'pop,rock,ballad,swing,bossa,waltz,ballad68,odd54,odd78,funk,ambient' && B.STYLE_IDS.every(id => B.STYLES[id].desc && B.STYLES[id].name && B.STYLES[id].meter), 'eleven styles, each with a name, meter and description');

  let a = B.arrange({ style: 'pop', chords: ['I', 'vi', 'IV', 'V'], key: 'C' });
  let c = count(a, 1);
  t.check(a.bars === 4 && c.hat === 8 && c.kick === 3 && c.snare === 2 && c.bass === 4 && c.chords === 4, 'pop: 8 hats, 3 kicks, 2 snares, 4 bass notes and 4 chord hits a bar — ' + JSON.stringify(c));
  t.check(at(a, 2, 'snare').join() === '1,3' && at(a, 2, 'hat').join() === '0,0.5,1,1.5,2,2.5,3,3.5', 'pop: snare on 2 and 4, straight eighths on the hi-hat');
  const pb = a.events.filter(e => e.role === 'bass' && e.bar === 1);
  t.check(mod12(pb[0].m) === 9 && pb[0].t === 4 && mod12(pb[2].m) === 4 && pb[2].t === 6, 'pop: root–fifth bass (A on 1, E on 3 under Am)');

  a = B.arrange({ style: 'rock', chords: ['I', 'bVII', 'IV', 'I'], key: 'E' });
  c = count(a, 0);
  t.check(c.bass === 8 && c.hat === 8 && c.snare === 2 && a.events.filter(e => e.role === 'chords' && e.bar === 0).every(e => e.kind === 'pad' && e.ms.length === 3 && e.ms[1] - e.ms[0] === 7 && e.ms[2] - e.ms[0] === 12), 'rock: eighth-note bass and power-chord pads (root, 5th, octave)');

  a = B.arrange({ style: 'swing', chords: ['ii7', 'V7', 'Imaj7', 'vi7'], key: 'F' });
  const ride = at(a, 0, 'ride'), sw = 2 / 3;
  t.check(ride.length === 6 && close(ride[2], 1 + sw, 1e-3) && close(ride[5], 3 + sw, 1e-3) && ride[1] === 1 && ride[3] === 2, 'swing: ride pattern with swung eighths at the 2:1 ratio — ' + ride.join(' '));
  t.check(count(a, 2).bass === 4 && at(a, 2, 'bass').join() === '0,1,2,3', 'swing: walking bass, one note a beat');
  const walkOk = key => {
    const arr = B.arrange({ style: 'swing', chords: ['ii7', 'V7', 'Imaj7', 'vi7', 'ii7', 'V7', 'I6', 'V7/ii'], key });
    const bass = arr.events.filter(e => e.role === 'bass');
    let ok = true;
    for (let i = 3; i < bass.length; i += 4) {
      const next = bass[(i + 1) % bass.length], cur = bass[i];
      const nextRoot = arr.chords[((i + 1) / 4) % arr.chords.length].bassPc;
      if (mod12(next.m) !== nextRoot) ok = false;
      const step = Math.abs(next.m - cur.m);
      if (step !== 1 && step !== 2) ok = false;
    }
    return ok && bass.every(e => e.m >= 28 && e.m <= 56);
  };
  t.check(['C', 'F', 'B♭', 'E♭', 'G', 'D', 'A', 'E'].every(walkOk), 'swing: every bar walks onto the next root, arriving by a half or whole step, in eight keys');
  const comp = a.events.filter(e => e.role === 'chords');
  t.check(comp.every(e => e.ms.length === 3) && at(a, 0, 'chords').join() === '1,3' && close(at(a, 1, 'chords')[1], 1 + sw, 1e-3), 'swing: three-note shell voicings on 2 and 4, then the Charleston');
  const shell = a.voicings[0].map(mod12).sort((x, y) => x - y), gm7 = T.chordPcs('G', 'm7');
  t.check(shell.indexOf(gm7[1]) >= 0 && shell.indexOf(gm7[3]) >= 0, 'swing: the shell of Gm7 holds its 3rd and 7th');

  a = B.arrange({ style: 'bossa', chords: ['ii7', 'V7', 'Imaj7', 'Imaj7'], key: 'C' });
  t.check(at(a, 0, 'rim').join() === '0,1.5,3' && at(a, 1, 'rim').join() === '1,2.5', 'bossa: a two-bar clave on the rim');
  t.check(at(a, 0, 'kick').join() === '0,1.5,2,3.5' && count(a, 0).bass === 3, 'bossa: two-feel bass and kick');

  a = B.arrange({ style: 'waltz', chords: ['I', 'IV', 'V7', 'I'], key: 'G' });
  t.check(a.barLen === 3 && at(a, 1, 'kick').join() === '0' && at(a, 1, 'hat').join() === '1,2' && at(a, 1, 'bass').join() === '0' && at(a, 1, 'chords').join() === '1,2', 'waltz: 3/4 with bass on 1 and chords on 2 and 3');
  const wb = a.events.filter(e => e.role === 'bass');
  t.check(mod12(wb[0].m) === 7 && mod12(wb[1].m) === 7, 'waltz: root on the first bar, the fifth (of C: G) on the second');

  a = B.arrange({ style: 'ballad68', chords: ['I', 'vi', 'ii', 'V'], key: 'D' });
  c = count(a, 0);
  t.check(a.barLen === 3 && at(a, 0, 'hat').join() === '0,0.5,1,1.5,2,2.5' && at(a, 0, 'kick').join() === '0' && at(a, 0, 'rim').join() === '1.5', '6/8: six eighths, kick on beat 1 and rim on beat 2 (the second dotted quarter)');
  t.check(at(a, 0, 'bass').join() === '0,1.5' && a.events.filter(e => e.kind === 'arp' && e.bar === 0).length === 6, '6/8: bass on both dotted-quarter beats, a rolling arpeggio in eighths');

  a = B.arrange({ style: 'odd54', chords: ['i', 'iv'], key: 'A', mode: 'minor' });
  t.check(a.barLen === 5 && at(a, 0, 'kick').join() === '0,3' && count(a, 0).hat === 10 && at(a, 0, 'snare').join() === '2,4', '5/4 as 3 + 2: kick on 1 and 4, ten eighths');

  a = B.arrange({ style: 'odd78', chords: ['I', 'bVII'], key: 'D' });
  t.check(a.barLen === 3.5 && at(a, 0, 'kick').join() === '0,2' && at(a, 0, 'snare').join() === '1,3' && count(a, 0).hat === 7 && at(a, 0, 'chords').join() === '0,1,2', '7/8 as 2 + 2 + 3: hits on 1, 3 and 5 (in eighths), seven eighths');

  a = B.arrange({ style: 'funk', chords: ['i7', 'IV7'], key: 'E' });
  t.check(count(a, 0).hat === 16 && at(a, 0, 'snare').filter(x => x === 1 || x === 3).length === 2 && count(a, 0).bass >= 6, 'funk: sixteenth hats, backbeat with ghost notes, syncopated bass');

  a = B.arrange({ style: 'ambient', chords: ['i7', 'IV7'], key: 'D', voicing: 'quartal' });
  t.check(!a.events.some(e => e.role === 'drums') && a.events.filter(e => e.role === 'chords').every(e => e.kind === 'pad' && e.d === 4), 'ambient: no drums, one long pad a chord');
  t.check(a.voicings.every(v => v.every((m, i) => !i || m - v[i - 1] === 5)), 'ambient: quartal voicing stacks perfect 4ths');

  /* any style in another meter falls back to a pattern built from the meter's groups */
  a = B.arrange({ style: 'pop', meter: '3/4', chords: ['I', 'V'], key: 'C' });
  t.check(a.barLen === 3 && at(a, 0, 'kick').join() === '0' && count(a, 0).hat === 6, 'pop in 3/4: a generic pattern from the meter');
  t.check(B.styleFor('6/8') === 'ballad68' && B.styleFor('3/4', 'pop') === 'waltz' && B.styleFor('4/4', 'swing') === 'swing', 'styleFor picks a style written in the meter');

  /* a ChordSheet timeline in beats, with a half-bar change: the change still gets a chord hit */
  a = B.arrange({ style: 'pop', chords: [{ sym: 'C', t: 0, d: 2 }, { sym: 'G/B', t: 2, d: 2 }, { sym: 'Am', t: 4, d: 4 }] });
  t.check(a.bars === 2 && at(a, 0, 'chords').indexOf(2) >= 0 && a.events.filter(e => e.role === 'bass' && e.t >= 2 && e.t < 4).every(e => mod12(e.m) === 11), 'timeline: a chord on beat 3 is heard, and G/B keeps B in the bass');
  /* a melody on top, as notes in beats or as a sketch */
  a = B.arrange({ style: 'ballad', chords: ['I', 'V'], key: 'C', melody: { bpm: 120, notes: [{ m: 72, t: 0, d: 0.5 }, { m: 74, t: 5.5, d: 0.5 }] } });
  t.check(a.bars === 3 && a.events.filter(e => e.role === 'melody').map(e => e.t).join() === '0,11' && a.events.filter(e => e.role === 'bass' && e.bar === 2)[0].m % 12 === 0, 'melody from a sketch (seconds at its bpm) lands on beats 1 and 12; the loop grows to fit it and the chords repeat under it');

  /* ================= smooth voicings ================= */
  const moves = (vs) => { let mx = 0; for (let i = 1; i < vs.length; i++) vs[i].forEach((m, j) => { mx = Math.max(mx, Math.abs(m - vs[i - 1][j])); }); return mx; };
  let worst = 0, worstKey = '';
  T.MAJOR_KEYS.slice(0, 12).forEach(k => ['full', 'shell'].forEach(how => {
    const vs = B.voiceLead(T.progression(['ii7', 'V7', 'Imaj7'], k).map(x => B.chord(x)), how, how === 'shell' ? 3 : 4, how === 'shell' ? [50, 72] : [52, 76], false);
    const mv = moves(vs); if (mv > worst) { worst = mv; worstKey = k + ' ' + how; }
  }));
  t.check(worst <= 5, 'ii–V–I in twelve keys: no voice moves more than a 4th (largest move ' + worst + ' half steps, ' + worstKey + ')');
  const pv = B.voiceLead(['G', 'D', 'Em', 'C'].map(x => B.chord(x)), 'full', 4, [52, 76], true);
  t.check(moves(pv.concat([pv[0]])) <= 3, 'I–V–vi–IV loop: every voice moves 3 half steps or less, the join back to the start included');
  t.check(pv.every((v, i) => [...new Set(v.map(mod12))].sort().join() === T.chordPcs(['G', 'D', 'E', 'C'][i], i === 2 ? 'min' : 'maj').sort().join()), 'every voicing holds exactly its chord’s notes');

  /* ================= Backing.start: live scheduling, mute, stop ================= */
  const calls = [];
  const spy = name => { const f = S[name].bind(S); S[name] = function (...args) { calls.push({ name, when: name === 'bass' || name === 'tone' || name === 'chord' || name === 'pad' ? args[1] : args[0], args }); return f(...args); }; return () => { S[name] = f; }; };
  const unspy = ['kick', 'snare', 'hat', 'ride', 'rim', 'bass', 'chord', 'pad', 'tone', 'click'].map(spy);
  let ended = false, chordsSeen = [], barsSeen = [];
  let ctl = B.start({ style: 'pop', chords: ['I', 'vi', 'IV', 'V'], key: 'C', bpm: 240, bars: 2, onChord: i => chordsSeen.push(i), onBar: n => barsSeen.push(n), onEnd: () => { ended = true; } });
  await t.wait(2500);
  const of = n => calls.filter(x => x.name === n);
  const spb = 0.25, rel = n => of(n).map(x => +((x.when - ctl.startT) / spb).toFixed(2));
  t.check(ended && !ctl.playing && barsSeen.join() === '0,1' && chordsSeen.join() === '0,1', 'start: two bars at 240 BPM play, report each bar and chord, then end');
  t.check(of('kick').length === 6 && of('snare').length === 4 && of('hat').length === 16 && of('bass').length === 8 && of('chord').length === 8, 'start: 6 kicks, 4 snares, 16 hats, 8 bass notes, 8 chord hits in two bars');
  t.check(rel('kick').join() === '0,2,2.5,4,6,6.5' && rel('snare').join() === '1,3,5,7', 'start: kicks and snares land on their beats (startT + beat × 60/bpm)');

  /* swing live: the ride's off-beats land two-thirds of the way through the beat */
  calls.length = 0;
  ctl = B.start({ style: 'swing', chords: ['ii7', 'V7'], key: 'C', bpm: 240, bars: 1 });
  await t.wait(1400);
  const r = rel('ride');
  t.check(r.length === 6 && close(r[2], 1.67, 0.011) && close(r[5], 3.67, 0.011), 'start: swing ride off-beats at 1⅔ and 3⅔ beats — ' + r.join(' '));

  /* mute from the start, mute and unmute while playing, then stop */
  calls.length = 0;
  ctl = B.start({ style: 'pop', chords: ['I', 'V'], key: 'C', bpm: 240, mute: { drums: true } });
  await t.wait(300);
  t.check(of('kick').length === 0 && of('hat').length === 0 && of('chord').length > 0 && ctl.gains.drums.gain.value === 0, 'mute: drums muted from the start are never scheduled; chords still play');
  ctl.setMute('drums', false);
  t.check(of('hat').length > 0, 'mute: unmuting brings the drums back at once (notes already in the window)');
  ctl.setMute('bass', true);
  const ev = ctl.gains.bass.gain.ev, lastB = ev[ev.length - 1];
  const bassBefore = of('bass').length;
  await t.wait(1600);
  t.check(lastB && lastB[0] === 'lin' && lastB[1] < 0.001 && of('bass').length === bassBefore && ctl.muted.bass, 'mute: the bass fades out at once and is no longer scheduled');
  const busy = calls.length;
  ctl.stop();
  const bev = ctl.bus.gain.ev, last = bev[bev.length - 1];
  await t.wait(1200);
  t.check(!ctl.playing && last[0] === 'lin' && last[1] < 0.001 && calls.length === busy, 'stop: the bus fades to silence (cutting notes already scheduled) and nothing more is scheduled');

  /* count-in, tempo change, chords change while playing */
  calls.length = 0;
  let counts = [];
  ctl = B.start({ style: 'ballad', chords: ['I', 'IV'], key: 'C', bpm: 240, countIn: 1, onCount: n => counts.push(n) });
  await t.wait(1300);
  t.check(of('click').length === 4 && counts.join() === '1', 'count-in: one bar of four clicks before bar 1');
  ctl.setChords(['vi', 'V']);
  ctl.setTempo(200);
  await t.wait(1500);
  t.check(ctl.bpm === 200 && ctl.arrangement.chords[0].sym === 'Am', 'setChords and setTempo take effect while playing');
  ctl.stop();
  unspy.forEach(f => f());

  /* the widget */
  const host = t.d.createElement('div'); t.d.body.appendChild(host);
  let ui = B.ui(host, { style: 'swing', chords: ['ii7', 'V7', 'Imaj7'], key: 'B♭', bpm: 180 });
  t.check(host.querySelectorAll('.bk-chip').length === 3 && /Cm7/.test(host.querySelector('.bk-chips, .bk-chords').textContent) && /walking bass/.test(host.querySelector('.bk-desc').textContent), 'ui: chords as chips (ii7 in B♭ is Cm7) and the style’s description');
  t.click(host.querySelector('[data-bk="go"]'));
  await t.wait(400);
  t.check(ui.playing && ui.ctl && host.querySelector('.bk-chip.on') && /Stop/.test(host.querySelector('[data-bk="go"]').textContent), 'ui: Play starts the band and lights the chord playing');
  t.click(host.querySelector('.bk-mute[data-role="drums"]'));
  t.check(ui.ctl.muted.drums && host.querySelector('.bk-mute[data-role="drums"]').getAttribute('aria-pressed') === 'false', 'ui: the Drums toggle mutes the drums');
  const st = host.querySelector('[data-bk="style"]'); st.value = 'bossa'; st.dispatchEvent(new t.w.Event('change'));
  t.check(ui.style === 'bossa' && ui.ctl.style === 'bossa' && /clave/.test(host.querySelector('.bk-desc').textContent), 'ui: picking another style carries on in the new style');
  ui.destroy();
  t.check(!ui.playing, 'ui: destroy stops the band');

  /* ================= MIDI export ================= */
  const MF = M.MidiFile;
  const sk1 = { name: 'Round trip', bpm: 96, key: 'A', mode: 'minor', meter: '3/4',
    notes: [{ m: 69, t: 0, d: 0.3125 }, { m: 72, t: 0.3125, d: 0.3125 }, { m: 76, t: 0.625, d: 0.9375 }, { m: 74, t: 1.875, d: 0.625 }],
    chords: [{ sym: 'Am', t: 0, d: 1.875 }, { sym: 'E7/G♯', t: 1.875, d: 1.875 }] };
  let P = MF.parse(MF.fromSketch(sk1));
  t.check(P.format === 1 && P.ppq === 480 && close(P.tempo, 96, 0.01) && P.timeSig.num === 3 && P.timeSig.den === 4 && P.keySig.sf === 0 && P.keySig.mi === 1, 'MIDI: type 1, 480 PPQ, tempo 96, 3/4, A minor');
  const names = P.tracks.map(x => x.name);
  t.check(names.join() === 'Round trip,Melody,Chords,Bass', 'MIDI: a conductor track, then Melody, Chords and Bass — ' + names.join(', '));
  const k = 96 / 60;
  t.check(P.tracks[1].notes.length === 4 && P.tracks[1].notes.every((n, i) => n.m === sk1.notes[i].m && Math.abs(n.beat - sk1.notes[i].t * k) <= 1 / 480 && Math.abs(n.beats - sk1.notes[i].d * k) <= 1 / 480), 'MIDI: the melody comes back note for note, within a tick');
  t.check(P.tracks[1].notes.every((n, i) => close(n.t, sk1.notes[i].t, 0.002)), 'MIDI: and in seconds at the file’s tempo');
  t.check(P.tracks[2].notes.length === 8 && P.tracks[2].notes.every(n => n.m >= 52 && n.m <= 76), 'MIDI: chords voiced in the middle register (4 notes each)');
  t.check(P.tracks[3].notes.map(n => mod12(n.m)).join() === '9,8', 'MIDI: bass has the roots, and the slash note of E7/G♯');
  t.check(P.tracks.slice(1).map(x => x.channel).join() === '0,1,2' && P.tracks[3].program === 33, 'MIDI: one channel per track, a bass program on the bass');

  const sk2 = { name: 'From the score', bpm: 90, key: 'E♭', score: { meter: '6/8', bpm: 90, keySig: -3, events: M.Score.parse('E♭4:q G4:e B♭4:q. | C5:e. D5:s E♭5:e B♭4:q.') } };
  P = MF.parse(MF.fromSketch(sk2));
  t.check(P.timeSig.num === 6 && P.timeSig.den === 8 && P.timeSig.clocks === 36 && P.keySig.sf === -3 && close(P.tempo, 90, 0.01), 'MIDI: 6/8 (dotted-quarter clicks) and three flats from the score');
  t.check(P.tracks[1].notes.map(n => n.tick).join() === '0,480,720,1440,1800,1920,2160' && P.tracks[1].notes.map(n => n.m).join() === '63,67,70,72,74,75,70', 'MIDI: score events land on exact ticks');

  const sk3 = { name: 'Band', bpm: 120, key: 'G', notes: [{ m: 71, t: 0, d: 0.5 }], chords: [{ sym: 'G', t: 0, d: 2 }, { sym: 'C', t: 2, d: 2 }],
    parts: [{ name: 'Flute', inst: 'flute', notes: [{ m: 79, t: 0, d: 1 }, { m: 81, t: 1, d: 1 }] }, { name: 'Cello', program: 42, notes: [{ m: 43, t: 0, d: 2 }] }, { name: 'Shaker', channel: 10, notes: [{ m: 70, t: 0, d: 0.1 }, { m: 70, t: 0.25, d: 0.1 }] }] };
  P = MF.parse(MF.fromSketch(sk3));
  t.check(P.tracks.map(x => x.name).join() === 'Band,Melody,Chords,Bass,Flute,Cello,Shaker', 'MIDI: one track per part after melody, chords and bass');
  const fl = P.tracks[4], ce = P.tracks[5], sh = P.tracks[6];
  t.check(fl.program === 73 && ce.program === 42 && sh.channel === 9 && sh.program == null && fl.notes.map(n => n.m).join() === '79,81' && new Set(P.tracks.slice(1).map(x => x.channel)).size === 6, 'MIDI: parts keep their programs (flute from INSTRUMENTS), drums on channel 10, every track its own channel');
  P = MF.parse(MF.fromSketch(Object.assign({}, sk3, { parts: [{ name: 'Walking bass', role: 'bass', inst: 'doubleBass', notes: [{ m: 43, t: 0, d: 0.5 }] }] })));
  t.check(P.tracks.map(x => x.name).join() === 'Band,Melody,Chords,Walking bass' && P.tracks[3].program === 43, 'MIDI: a part with role bass replaces the automatic bass');

  const satb = { name: 'Chorale', bpm: 72, key: 'D', voices: { S: [{ m: 74, t: 0, d: 0.8 }, { m: 73, t: 0.8, d: 0.8 }], A: [{ m: 66, t: 0, d: 0.8 }, { m: 69, t: 0.8, d: 0.8 }], T: [{ m: 57, t: 0, d: 0.8 }, { m: 57, t: 0.8, d: 0.8 }], B: [{ m: 50, t: 0, d: 0.8 }, { m: 45, t: 0.8, d: 0.8 }] } };
  P = MF.parse(MF.fromSketch(satb));
  t.check(P.tracks.map(x => x.name).join() === 'Chorale,Soprano,Alto,Tenor,Bass' && P.tracks.slice(1).map(x => x.notes.map(n => n.m).join('-')).join() === '74-73,66-69,57-57,50-45' && P.keySig.sf === 2, 'MIDI: S A T B voices, one track each, in D major');
  P = MF.parse(MF.fromSketch({ name: 'Columns', bpm: 60, voices: [[67, 62, 59, 43], ['F♯4', 'D4', 'A3', 'D3'], [67, 62, 59, 43]] }));
  t.check(P.tracks.length === 5 && P.tracks[2].notes.map(n => n.m).join() === '62,62,62' && P.tracks[4].notes.map(n => n.beat).join() === '0,1,2' && P.tracks[1].notes[1].m === 66, 'MIDI: voices as chord columns (numbers or names), one beat each');
  P = MF.parse(MF.fromSketch({ name: 'Pop band', bpm: 100, chords: [{ sym: 'C', t: 0, d: 2.4 }, { sym: 'Am', t: 2.4, d: 2.4 }], backing: { style: 'pop' } }));
  const drums = P.tracks.find(x => x.name === 'Drums');
  t.check(drums && drums.channel === 9 && drums.notes.filter(n => n.m === 36).length === 6 && drums.notes.filter(n => n.m === 42).length === 16 && P.tracks.some(x => x.name === 'Backing bass'), 'MIDI: a sketch with a backing style exports its drums on channel 10, its bass and chords');
  t.check(MF.fileName({ name: 'F♯ blues / take 2' }) === 'F-sharp-blues-take-2.mid' && MF.fileName({ name: '  ' }) === 'Motif-sketch.mid' && MF.fileName({ name: 'Café “v2”' }) === 'Cafe-v2.mid', 'MIDI: safe file names');
  /* download: a Blob through a temporary link */
  let clicked = null;
  t.w.URL.createObjectURL = () => 'blob:motif-test'; t.w.URL.revokeObjectURL = () => {};
  const origClick = t.w.HTMLAnchorElement.prototype.click;
  t.w.HTMLAnchorElement.prototype.click = function () { clicked = { name: this.download, href: this.getAttribute('href') }; };
  const dl = MF.download(sk1);
  t.check(dl.ok && clicked && clicked.name === 'Round-trip.mid' && clicked.href === 'blob:motif-test' && dl.bytes[0] === 0x4d, 'MIDI: download clicks a temporary link named Round-trip.mid');
  t.w.HTMLAnchorElement.prototype.click = origClick;
  /* without object URLs (as in jsdom) Transcribe falls back to its own clock; the media test below puts them back */
  const stubUrl = on => { if (on) { t.w.URL.createObjectURL = () => 'blob:motif-test'; t.w.URL.revokeObjectURL = () => {}; } else { delete t.w.URL.createObjectURL; delete t.w.URL.revokeObjectURL; } };
  stubUrl(false);

  /* ================= instruments ================= */
  const I = M.Instruments, byId = I.byId;
  const want = { flute: 0, oboe: 0, clarinet: -2, bassoon: 0, altoSax: -9, tenorSax: -14, trumpet: -2, horn: -7, trombone: 0, violin: 0, viola: 0, cello: 0, doubleBass: -12, guitar: -12, bassGuitar: -12, piano: 0, soprano: 0, alto: 0, tenor: 0, bass: 0, piccolo: 12 };
  t.check(Object.keys(want).every(id => byId(id) && byId(id).transpose === want[id]), 'instruments: all twenty-one with their transpositions');
  t.check(M.INSTRUMENTS.every(x => x.range.low < x.range.high && x.comfortable.low >= x.range.low && x.comfortable.high <= x.range.high && x.program >= 0 && x.program < 128 && ['treble', 'bass', 'alto', 'tenor'].indexOf(x.clef) >= 0 && x.family), 'instruments: ranges, comfortable ranges, clefs and programs are sane');
  t.check(byId('viola').clef === 'alto' && byId('cello').clefs.indexOf('tenor') >= 0 && byId('altoSax').range.low === T.midi('D♭3') && byId('violin').range.low === T.midi('G3'), 'instruments: viola reads the alto clef; alto sax goes down to D♭3, violin to G3');
  t.check(I.written(60, 'clarinet') === 62 && I.sounding(62, 'trumpet') === 60 && I.written(T.midi('E♭4'), 'altoSax') === T.midi('C5') && I.written(60, 'tenorSax') === 74 && I.written(60, 'horn') === 67 && I.written(40, 'guitar') === 52 && I.sounding(84, 'piccolo') === 96, 'instruments: written and sounding notes');
  t.check(I.writtenKey('E♭', 'altoSax') === 'C' && I.writtenKey('E♭', 'clarinet') === 'F' && I.writtenKey('E♭', 'trumpet') === 'F' && I.writtenKey('E♭', 'tenorSax') === 'F' && I.writtenKey('E♭', 'horn') === 'B♭' && I.writtenKey('E♭', 'violin') === 'E♭', 'instruments: concert E♭ is C for alto sax, F for B♭ instruments, B♭ for horn');
  t.check(I.writtenKey('C minor', 'clarinet') === 'D minor' && I.writtenKey('Cm', 'altoSax') === 'Am' && I.writtenKey('F♯', 'clarinet') === 'A♭' && I.writtenKey('B', 'altoSax') === 'A♭' && I.writtenKey('G', 'guitar') === 'G', 'instruments: minor keys and the simpler enharmonic key');
  let probs = I.checkRange([{ m: 58, t: 0, d: 1 }, { m: T.midi('B♭2'), t: 9, d: 1 }, { m: T.midi('C♯6'), t: 13, d: 1 }], 'altoSax', { keySig: -3 });
  t.check(probs.length === 2 && probs[0].text === 'Bar 3: the B♭2 is below the alto sax’s lowest note, D♭3 (sounding).' && probs[1].text === 'Bar 4: the D♭6 is above the alto sax’s highest note, A5 (sounding).', 'instruments: range problems in plain sentences — ' + probs.map(p => p.text).join(' | '));
  probs = I.checkRange(M.Score.parse('E4:h D7:q G3:q | G4:w A3:w'), 'flute');
  t.check(probs.length === 3 && probs[0].kind === 'high' && probs[0].bar === 1 && probs[1].kind === 'low' && probs[2].bar === 3, 'instruments: score events are checked too (D7 too high, G3 too low for the flute)');
  probs = I.checkRange([{ m: 98, t: 0, d: 1 }], 'violin');
  t.check(probs.length === 1 && probs[0].level === 'warn' && /strained/.test(probs[0].text), 'instruments: a playable but high note is a warning');
  probs = I.checkRange([{ m: T.midi('B♭3'), t: 0 }, { m: T.midi('A3'), t: 1 }], 'altoSax', { written: true });
  t.check(probs.length === 2 && probs[0].level === 'warn' && probs[1].level === 'error' && /below/.test(probs[1].text), 'instruments: a written B♭3 is the alto sax’s lowest note (sounding D♭3, playable but weak); a written A3 is too low');
  const evs = M.Score.parse('E♭4:q G4:q B♭4:q C5:q');
  t.check(I.transposeEvents(evs, 9, -3).map(e => e.p).join() === 'C5,E5,G5,A5' && I.transposeSig(-3, 9) === 0, 'instruments: E♭ G B♭ C up a major 6th is C E G A (alto sax part of E♭ major)');
  t.check(I.transposeEvents(M.Score.parse('F♯4:q C♯5:q'), 2, 2).map(e => e.p).join() === 'G♯4,D♯5' && I.transposeSig(2, 2) === 4, 'instruments: D major up a whole step spells G♯ and D♯ in E major');
  const part = I.part(evs, 'tenorSax', -3);
  t.check(part.keySig === -1 && part.events[0].p === 'F5' && part.clef === 'treble', 'instruments: a tenor sax part of a melody in E♭ is in F, a 9th up');

  /* ================= Transcribe: the pure parts ================= */
  const TR = M.Transcribe;
  const tone = (sr, secs, notes, amp) => { const x = new Float32Array(Math.round(sr * secs)); notes.forEach(m => { const f = 440 * Math.pow(2, (m - 69) / 12); for (let i = 0; i < x.length; i++) x[i] += (amp || 0.25) * (Math.sin(2 * Math.PI * f * i / sr) + 0.4 * Math.sin(4 * Math.PI * f * i / sr) + 0.15 * Math.sin(6 * Math.PI * f * i / sr)); }); return x; };
  let ch = TR.chroma(tone(44100, 0.5, [60, 64, 67]), 44100);
  const top3 = c => Array.from(c.chroma).map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]).slice(0, 3).map(x => x[1]).sort((x, y) => x - y).join();
  t.check(ch.chord && ch.chord.sym === 'C' && top3(ch) === '0,4,7', 'chroma: a synthesized C major triad (44.1 kHz) is C — ' + (ch.chord && ch.chord.sym));
  ch = TR.chroma(tone(22050, 0.5, [45, 57, 60, 64, 67]), 22050);
  t.check(ch.chord && ch.chord.sym === 'Am7' && ch.bassPc === 9, 'chroma: A C E G over a low A (22 kHz) is Am7 with A in the bass — ' + (ch.chord && ch.chord.sym));
  t.check(TR.chroma(new Float32Array(8192), 22050).chord === null, 'chroma: silence is no chord');
  const pk = TR.peaks(tone(8000, 1, [69], 0.5), 50);
  t.check(pk.max.length === 50 && pk.max.every(v => v > 0.5 && v < 0.9) && pk.min.every(v => v < -0.5), 'peaks: one max and min per column');
  /* smoothing: a one-frame blip disappears, a short gap joins the chord after it, and edges snap to the beat grid */
  const fr = (seq) => seq.map((k, i) => ({ t: +(0.1 + i * 0.2).toFixed(2), m: k ? { root: { C: 0, G: 7, F: 5, A: 9 }[k[0]], quality: k.length > 1 ? 'min' : 'maj', score: 0.9 } : null }));
  let sg = TR.smooth(fr(['C', 'C', 'C', 'C', 'C', 'C', 'G', 'C', 'C', 'C', 'C', 'C', null, null, null, 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', null, null, null, null, null, null, null, null, null, null, 'Am', 'Am', 'Am', 'Am', 'Am', 'Am']));
  t.check(sg.map(s => s.sym).join(' ') === 'C G Am' && close(sg[0].t, 0) && close(sg[0].d, 2.4, 1e-6) && close(sg[1].t, 2.4) && close(sg[1].d, 2.6, 1e-6), 'smooth: the G blip inside C is gone; the short gap before G joins G — ' + JSON.stringify(sg.map(s => [s.sym, s.t, s.d])));
  t.check(close(sg[2].t, 7) && sg[2].d > 1, 'smooth: a long silence stays a gap (Am starts at 7 s)');
  sg = TR.smooth(fr(['C', 'C', 'C', 'C', 'C', 'C', 'C', 'C', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F']), { grid: 0.5, offset: 0.05 });
  t.check(close(sg[0].t, 0.05) && close(sg[1].t, 1.55) && close(sg[1].d, 2), 'smooth: edges snap to a beat grid');
  const sp = TR.spell([{ t: 0, d: 2, sym: 'A♯', rootPc: 10, q: 'maj', alts: [] }, { t: 2, d: 2, sym: 'F', rootPc: 5, q: 'maj', alts: [] }, { t: 4, d: 2, sym: 'C', rootPc: 0, q: 'maj', alts: [] }]);
  t.check(sp.segments[0].sym === 'B♭' && sp.key.tonic === 'F' && sp.key.mode === 'major', 'spell: A♯ becomes B♭ in F major');
  t.check(JSON.stringify(TR.loopOf(5, 2, 10)) === '{"a":2,"b":5}' && TR.loopOf(9.95, 12, 10).a === 9.75 && TR.loopOf(9.95, 12, 10).b === 10 && TR.loopOf(3, 3.1, 10).b - TR.loopOf(3, 3.1, 10).a >= 0.25 && TR.loopOf(null, 2, 10) === null, 'loop maths: ordered, inside the clip, at least a quarter second');
  t.check(TR.wrap(5.2, { a: 2, b: 5 }) === 2 && TR.wrap(4, { a: 2, b: 5 }) === 4 && TR.wrap(7, null) === 7, 'loop maths: past B goes back to A');
  const wv = TR.wav(Float32Array.from([0, 0.5, -0.5, 1, -1]), 8000), back = TR.parseWav(wv.buffer);
  t.check(wv.length === 54 && back.sampleRate === 8000 && back.samples.length === 5 && Array.from(back.samples).every((v, i) => close(v, [0, 0.5, -0.5, 1, -1][i], 1e-4)) && TR.parseWav(new Uint8Array([1, 2, 3])) === null, 'WAV: written and read back; junk is not a WAV');
  /* the practice track, rendered without Web Audio here, analysed end to end */
  const pt = await TR.practice({ romans: ['I', 'vi', 'IV', 'V7/V', 'V'], key: 'G', bpm: 96, repeat: 1 });
  const sug = TR.spell(TR.smooth(TR.frames(pt.samples, pt.sampleRate, { hop: 0.2 }), { hop: 0.2, grid: pt.grid, offset: pt.offset })).segments;
  t.check(sug.map(s => s.sym).join(' ') === 'G Em C A7 D' && sug.every((s, i) => close(s.t, pt.answer[i].t, 0.01)), 'practice track G–Em–C–A7–D: every chord suggested, on its bar — ' + sug.map(s => s.sym + '@' + s.t).join(' '));

  /* ================= Transcribe in the Toolbox ================= */
  const chordBus = () => (M.Bus.h.chord ? M.Bus.h.chord.size : 0);
  const busBefore = chordBus();
  t.click('.nav [data-view="toolbox"]'); await t.wait(30);
  t.check(t.$$('.tool-tabs button').length === 6 && t.$$('.studio-tabs button').length === 3, 'toolbox: six reference tabs and three Studio tabs');
  t.click('[data-tab="transcribe"]'); await t.wait(30);
  t.check(/Nothing is uploaded/.test(t.$('.tr-private').textContent) && t.$('.tr input[type="file"]').getAttribute('accept') === 'audio/*', 'transcribe: opens your own audio file, and says nothing is uploaded');
  t.click('[data-tr="practice"]');
  const waitFor = async (fn, ms) => { const end = Date.now() + (ms || 15000); while (Date.now() < end) { if (fn()) return true; await t.wait(50); } return false; };
  t.check(await waitFor(() => t.$$('.tr-seg').length >= 8), 'transcribe: the practice track loads and the strip fills with suggestions');
  t.check(t.$$('.tr-seg b').map(b => b.textContent).join(' ') === 'C Am F G C Am F G' && /C major/.test(t.$('[data-tr="status"]').textContent), 'transcribe: suggests C Am F G twice, probably in C major — ' + t.$$('.tr-seg b').map(b => b.textContent).join(' '));
  t.check(t.$('.tr-seg.sel') && /Motif hears/.test(t.$('[data-tr="pick"]').textContent) && t.$('[data-tr="pick"] .tr-sug').textContent === 'C', 'transcribe: the first chord is selected, ready to confirm');
  // confirm by playing it on the keys
  t.pc('C'); t.pc('E'); t.pc('G'); await t.wait(40);
  t.check(t.$$('.tr-seg.ok').length === 1 && /you played C/.test(t.$('[data-tr="status"]').textContent) && t.$('.tr-seg.sel').dataset.i === '1', 'transcribe: playing C E G confirms C and moves on to the next chord');
  // a different chord first, then the suggested one
  t.pc('D'); t.pc('F'); t.pc('A'); await t.wait(40);
  t.check(/Use Dm/.test(t.$('[data-tp="yes"]').textContent) && t.$$('.tr-seg.ok').length === 1, 'transcribe: playing Dm offers “Use Dm” instead of confirming');
  await t.wait(1700);
  t.pc('A'); t.pc('C'); t.pc('E'); await t.wait(40);
  t.check(t.$$('.tr-seg.ok').length === 2 && t.$$('.tr-cell b').map(b => b.textContent).join(' ') === 'C Am', 'transcribe: then playing A C E confirms Am; the chart reads C Am');
  // Yes, that's it
  t.click('[data-tp="yes"]'); await t.wait(20);
  // another chord picked from the alternatives
  const alt = t.$$('.tr-alt').find(b => b.textContent === 'Em');
  t.check(!!alt, 'transcribe: other chords that fit are offered (Em among them)');
  t.click(alt); await t.wait(20);
  t.check(/Use Em/.test(t.$('[data-tp="yes"]').textContent), 'transcribe: tapping Em makes it the candidate');
  t.click('[data-tp="yes"]'); await t.wait(20);
  t.check(t.$$('.tr-cell b').map(b => b.textContent).join(' ') === 'C Am F Em', 'transcribe: the chart keeps what you chose: C Am F Em');
  // loop and speed, on the clock (no media element here)
  t.click('.tr-seg[data-i="5"]'); await t.wait(20);
  t.check(/Looping 0:1[0-9]–0:1[0-9]/.test(t.$('[data-tr="loopinfo"]').textContent), 'transcribe: selecting a chord loops its bar — ' + t.$('[data-tr="loopinfo"]').textContent);
  const sp2 = t.$('[data-tr="speed"]'); sp2.value = '50'; sp2.dispatchEvent(new t.w.Event('input'));
  t.check(t.$('[data-tr="rate"]').textContent === '50%', 'transcribe: speed down to 50%');
  t.click('[data-tr="play"]'); await t.wait(30);
  const tm0 = t.$('[data-tr="time"]').textContent;
  t.check(/Pause/.test(t.$('[data-tr="play"]').textContent) && /^0:1\d$/.test(tm0), 'transcribe: plays from the loop start — ' + tm0);
  t.click('[data-tr="play"]');
  t.click('[data-tr="clear"]'); await t.wait(20);
  t.check(/Drag across/.test(t.$('[data-tr="loopinfo"]').textContent), 'transcribe: Clear loop');
  t.click('[data-tr="setA"]'); t.click('[data-tr="setB"]'); await t.wait(20);
  t.check(/Looping/.test(t.$('[data-tr="loopinfo"]').textContent), 'transcribe: Set A and Set B make a loop at the playhead');
  t.$('[data-tr="nm"]').value = 'Practice chords';
  t.click('[data-tr="save"]'); await t.wait(20);
  let saved = M.Store.data.sketches[0];
  t.check(saved && saved.name === 'Practice chords' && saved.tags.indexOf('transcription') >= 0 && saved.chords.map(c => c.sym).join() === 'C,Am,F,Em' && saved.chords[0].t === 0 && saved.key === 'C' && saved.mode === 'major' && saved.bpm === 92, 'transcribe: saves the chart to the sketchbook (chords from 0 s, key C major, tag transcription)');
  t.check(/Saved “Practice chords”/.test(t.$('[data-tr="saved"]').textContent), 'transcribe: says it saved');

  /* an audio file from the device: no decoder here, so the WAV reader opens it */
  const wavBytes = TR.wav(pt.samples, pt.sampleRate);
  const file = new t.w.File([wavBytes], 'my song.wav', { type: 'audio/wav' });
  const host2 = t.d.createElement('div'); t.d.body.appendChild(host2);
  let tr2 = TR.mount(host2, {});
  await tr2.openFile(file);
  t.check(await waitFor(() => tr2.segments.length === 5), 'file: a WAV from the device opens and gets five suggestions');
  t.check(host2.querySelector('[data-tr="name"]').textContent === 'my song.wav' && host2.querySelector('[data-tr="nm"]').value === 'Transcription: my song' && tr2.segments.map(s => s.sym).join(' ') === 'G Em C A7 D', 'file: named after the file; G Em C A7 D suggested');
  await tr2.openFile(new t.w.File([new Uint8Array([1, 2, 3, 4])], 'notes.txt', { type: 'text/plain' }));
  t.check(/could not be opened/.test(host2.querySelector('[data-tr="status"]').textContent), 'file: something that is not audio gets a plain message');
  tr2.destroy();
  /* the media element path: the pitch is kept when slowed down */
  const MP = t.w.HTMLMediaElement.prototype, keep = {};
  ['play', 'pause'].forEach(k => { keep[k] = MP[k]; });
  const desc = k => Object.getOwnPropertyDescriptor(MP, k);
  ['paused', 'currentTime'].forEach(k => { keep[k] = desc(k); });
  stubUrl(true);
  MP.play = function () { this._on = true; this._at = Date.now(); return Promise.resolve(); };
  MP.pause = function () { this._pos = this.currentTime; this._on = false; };
  Object.defineProperty(MP, 'paused', { configurable: true, get() { return !this._on; } });
  Object.defineProperty(MP, 'currentTime', { configurable: true, get() { return (this._pos || 0) + (this._on ? (Date.now() - this._at) / 1000 * (this.playbackRate || 1) : 0); }, set(v) { this._pos = v; this._at = Date.now(); } });
  tr2 = TR.mount(host2, {});
  await tr2.usePractice({ romans: ['I', 'IV'], key: 'D', repeat: 1 });
  await waitFor(() => tr2.segments.length >= 2);
  const media = tr2.player.media;
  const sp3 = host2.querySelector('[data-tr="speed"]'); sp3.value = '75'; sp3.dispatchEvent(new t.w.Event('input'));
  t.check(media && media.src === 'blob:motif-test' && media.playbackRate === 0.75 && media.preservesPitch === true, 'media: an <audio> element plays the clip at 75% with preservesPitch');
  tr2.setLoop(0.5, 1.0); tr2.seek(0.5); tr2.play();
  await t.wait(1200);
  t.check(tr2.player.playing && tr2.time >= 0.5 && tr2.time < 1.0, 'media: the A–B loop wraps playback back to A — ' + tr2.time.toFixed(2));
  tr2.pause();
  t.check(!tr2.player.playing, 'media: pause');
  tr2.destroy();
  ['play', 'pause'].forEach(k => { MP[k] = keep[k]; });
  ['paused', 'currentTime'].forEach(k => { if (keep[k]) Object.defineProperty(MP, k, keep[k]); else delete MP[k]; });
  stubUrl(false);

  /* ================= Tasks.transcribe ================= */
  let res = null;
  const host3 = t.d.createElement('div'); t.d.body.appendChild(host3);
  const clean = M.Tasks.transcribe(host3, { prompt: 'Find the four chords.', need: 4, practice: { romans: ['I', 'V7/vi', 'vi', 'IV'], key: 'F', bpm: 100, repeat: 1 }, save: { level: 9, tags: ['9.9'] } }, (ok, r) => { res = Object.assign({ ok }, r); });
  t.check(/Find the four chords/.test(host3.querySelector('.prompt').textContent), 'task: shows its prompt');
  host3.querySelector('[data-tr="practice"]').click();
  t.check(await waitFor(() => host3.querySelectorAll('.tr-seg').length === 4), 'task: the practice track (with a secondary dominant) loads');
  t.check([...host3.querySelectorAll('.tr-seg b')].map(b => b.textContent).join(' ') === 'F A7 Dm B♭', 'task: suggests F A7 Dm B♭ (V/vi spelled in F) — ' + [...host3.querySelectorAll('.tr-seg b')].map(b => b.textContent).join(' '));
  for (let i = 0; i < 3; i++) { host3.querySelector('[data-tp="yes"]').click(); await t.wait(20); }
  t.check(host3.querySelector('[data-tr="save"]').disabled && /3 so far/.test(host3.querySelector('[data-tr="checks"]').textContent), 'task: three of four confirmed, so it cannot be saved yet');
  t.pc('B♭'); t.pc('D'); t.pc('F'); await t.wait(40);
  t.check(!host3.querySelector('[data-tr="save"]').disabled, 'task: the fourth chord, played on the keys, enables saving');
  host3.querySelector('[data-tr="save"]').click(); await t.wait(20);
  t.check(res && res.ok && res.chords.length === 4 && res.sketch.level === 9 && res.sketch.tags.join() === 'transcription,9.9' && res.sketch.key === M.Theory.findKey(res.chords)[0].tonic && res.chords.map(c => c.sym).join() === 'F,A7,Dm,B♭', 'task: done(true, { chords, sketch }) with the level, tags and the key the chords suggest (' + (res && res.sketch.key + ' ' + res.sketch.mode) + ')');
  clean();
  t.check(chordBus() === busBefore + (t.$('.tool-body .tr') ? 1 : 0), 'task: cleanup removes its chord listener');

  /* ================= playSketch with parts, voices and a backing ================= */
  calls.length = 0;
  const unspy2 = ['tone', 'kick', 'hat', 'bass', 'chord'].map(spy);
  let ms = M.playSketch({ bpm: 120, notes: [{ m: 72, t: 0, d: 0.5 }], parts: [{ name: 'Counter', notes: [{ m: 64, t: 0, d: 0.5 }, { m: 65, t: 0.5, d: 0.5 }] }, { name: 'Kit', channel: 10, notes: [{ m: 36, t: 0, d: 0.1 }] }], voices: { S: [{ m: 76, t: 0, d: 1 }], B: [{ m: 48, t: 0, d: 1 }] } });
  t.check(ms > 0 && of('tone').length === 5 && of('kick').length === 1, 'playSketch: melody, every part (drum part on the kit) and every voice');
  M.stopSketch();
  calls.length = 0;
  ms = M.playSketch({ bpm: 240, notes: [{ m: 72, t: 0, d: 0.25 }], chords: [{ sym: 'C', t: 0, d: 1 }, { sym: 'G', t: 1, d: 1 }], backing: { style: 'pop' } });
  await t.wait(400);
  t.check(ms > 1900 && of('kick').length >= 3 && of('bass').length >= 4 && of('tone').filter(x => x.args[0] === 72).length === 1, 'playSketch: with backing: { style } a pop band plays the chords under the melody');
  M.stopSketch();
  await t.wait(300);
  const n0 = calls.length; await t.wait(1200);
  t.check(calls.length === n0, 'stopSketch stops the band');
  unspy2.forEach(f => f());

  /* ================= the Toolbox's other Studio tabs ================= */
  t.click('[data-tab="export"]'); await t.wait(30);
  t.check(t.$$('.ex-item').length === M.Store.data.sketches.length && t.$$('.ex-item').length >= 2, 'export: every sketch listed with a Download button');
  clicked = null; stubUrl(true);
  t.w.HTMLAnchorElement.prototype.click = function () { clicked = { name: this.download }; };
  const band = t.$('#ex-band'); band.value = 'bossa'; band.dispatchEvent(new t.w.Event('change'));
  t.click('[data-ex="1"]'); await t.wait(20);
  t.check(clicked && /\.mid$/.test(clicked.name) && /Saved/.test(t.$('[data-ex-fb]').textContent), 'export: Download MIDI saves a .mid file — ' + (clicked && clicked.name));
  t.w.HTMLAnchorElement.prototype.click = origClick; stubUrl(false);
  t.click('[data-tab="instruments"]'); await t.wait(30);
  const ins = t.$('#in-id'); ins.value = 'altoSax'; ins.dispatchEvent(new t.w.Event('change')); await t.wait(10);
  t.check(/major 6th lower/.test(t.$('.tool-out').textContent) && /written in C major/.test(t.$('.tool-out').textContent) && /D♭3–A5/.test(t.$('.tool-out').textContent), 'instruments: alto sax sounds a major 6th lower; concert E♭ is written in C');
  t.click('[data-tab="progressions"]'); await t.wait(30);
  const prb = t.$('#pr-band'); prb.value = 'swing'; prb.dispatchEvent(new t.w.Event('change')); await t.wait(10);
  t.check(/walking bass/.test(t.$('.tool-out').textContent), 'progressions: a band can play the progression (swing)');
  calls.length = 0;
  const unspy3 = ['ride'].map(spy);
  t.click('.tool-out [data-act="play"]'); await t.wait(500);
  t.check(of('ride').length > 0 && t.$$('.prog-chord.on').length === 1, 'progressions: the band plays and lights the chord');
  t.click('.tool-out [data-act="stop"]'); unspy3.forEach(f => f());
  prb.value = 'plain'; prb.dispatchEvent(new t.w.Event('change'));
  /* every tab opens cleanly */
  for (const b of t.$$('.tool-tabs button, .studio-tabs button')) { t.click(`[data-tab="${b.dataset.tab}"]`); await t.wait(30); }
  t.check(t.$$('.tool-tabs button, .studio-tabs button').length === 9 && t.$('.tool-body').children.length > 0, 'toolbox: all nine tabs open');
  t.click('.nav [data-view="home"]'); await t.wait(30);
  t.check(chordBus() === busBefore && !t.$('.tool-body .tr'), 'leaving the toolbox leaves no chord listener behind');

  t.finish();
})();
