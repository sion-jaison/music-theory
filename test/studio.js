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

  t.finish();
})();
