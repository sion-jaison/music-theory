/* =================================================================
   Level 6 · Groove & Line: the four rhythm units
   6.1 compound time · 6.2 triplets, swing and shuffle · 6.3 syncopation, pickups and cut time · 6.4 odd meters.
   Built on the notation engine (12-notation.js). 63-level6.js registers the level with these units and cards:
   L6_RHYTHM_UNITS, L6_RHYTHM_CARDS. Every melody and groove here is written for Motif.
   ================================================================= */

/* a score in its scroll box; src is normalized for its meter first */
const l6rBox = (src, o) => `<div class="nt-box">${Score.svg(Score.normalize(src, o.meter || '4/4', o), o)}</div>`;
const l6rCap = t => `<p class="nt-art-cap">${t}</p>`;
/* the example playing now: starting another one stops it */
let l6rNow = null;
function l6rPlay(src, o) { if (l6rNow) l6rNow.stop(); l6rNow = Score.play(src, Object.assign({ countIn: 0 }, o)); return l6rNow; }
function l6rStop() { if (l6rNow) l6rNow.stop(); l6rNow = null; }

/* ---------- 6.1 compound time ---------- */
const L6R_LILT = 'C4:q E4:e G4:q E4:e | F4:q. A4:q. | G4:q E4:e C4:q D4:e | C4:h.';
const L6R_68 = ['q. q.', 'q e q e', 'e e e q.', 'q e e e e', 'q. e e e', 'e e e e e e', 'q e q.'];
const L6R_128 = ['q. q. q. q.', 'q e q e q. q.', 'e e e q. e e e q.', 'q. e e e q e q.', 'q e q e e e e q.'];
/* six eighths, grouped two ways */
function l6rTwoWays(el) {
  const ways = [['3/4', 'Three beats of two', 'ONE-and TWO-and THREE-and'], ['6/8', 'Two beats of three', 'ONE-la-li TWO-la-li']];
  el.innerHTML = `<div class="l6r-two">${ways.map(([m, t, c], i) => `<div class="l6r-way"><div class="row"><button type="button" class="btn small" data-i="${i}">▶ ${m}</button><b>${t}</b></div>${l6rBox('e e e e e e', { meter: m, clef: 'perc', counts: true })}<p class="l6r-note">${c}</p></div>`).join('')}</div>`;
  el.onclick = ev => { const b = ev.target.closest('[data-i]'); if (b) Score.groove({ meter: ways[+b.dataset.i][0], bpm: 150, bars: 2, pattern: 'e e e e e e e e e e e e' }); };
  return () => {};
}
function l6rLilt() {
  l6rPlay(L6R_LILT, { meter: '6/8', bpm: 132 });
  Score.groove({ meter: '6/8', bpm: 132, bars: 4, root: 36 });
}
const L6R_KINDS = [['2/4', 'simple duple'], ['3/4', 'simple triple'], ['6/8', 'compound duple']];
function l6rKindQ() {
  const k = randInt(0, 2), [m] = L6R_KINDS[k], bpm = m === '6/8' ? randInt(126, 150) : randInt(96, 120);
  return {
    q: 'Listen. Duple, triple or compound?', options: L6R_KINDS.map(x => x[1]), answer: k, playLabel: 'Hear it again',
    play: () => Score.groove({ meter: m, bpm, bars: 2 }),
    why: { '2/4': '2/4: two beats, each split in two.', '3/4': '3/4: three beats, each split in two.', '6/8': '6/8: two beats, each split in three.' }[m]
  };
}

/* ---------- 6.2 triplets, swing and shuffle ---------- */
const L6R_TRIP = ['q 3[e e e] q q', 'q q 3[e e e] q', '3[e e e] q 3[e e e] q', 'e e 3[e e e] q q', 'q 3[e e e] e e q'];
const L6R_SWING_LINES = [
  'E4:e G4:e A4:e G4:e C5:e A4:e G4:e E4:e | D4:e E4:e G4:e A4:e G4:q E4:q',
  'C4:e E4:e G4:e A4:e B♭4:e A4:e G4:e E4:e | F4:e A4:e C5:e A4:e G4:h',
  'A4:e C5:e D5:e C5:e A4:e G4:e E4:e G4:e | A4:e G4:e E4:e D4:e C4:h'
];
const l6rFeel = v => v < 0.54 ? 'Straight' : v < 0.63 ? 'Light swing' : v < 0.7 ? 'Triplet swing' : 'Hard shuffle';
/* slide from straight to swung and hear the same written eighths change */
function l6rSwingWidget(el) {
  let v = 50;
  const mel = L6R_SWING_LINES[0];
  el.innerHTML = `<div class="l6r-swing">${l6rCap('Written')}${l6rBox(mel, { meter: '4/4' })}
    <div class="row"><label class="nt-tempo"><span>Swing</span><input type="range" min="50" max="75" step="1" value="50" aria-label="Swing amount: the share of the beat the first eighth takes"><span class="mono" data-v></span></label><button type="button" class="btn small" data-act="swplay">▶ Play</button></div>
    ${l6rCap('Swung about 2:1, it sounds like this')}${l6rBox('3[q e] 3[q e] 3[q e] 3[q e]', { meter: '4/4', clef: 'perc' })}</div>`;
  const rng = el.querySelector('input'), out = el.querySelector('[data-v]');
  const label = () => { out.textContent = `${l6rFeel(v / 100)} · ${v}:${100 - v}`; };
  const play = () => l6rPlay(mel, { meter: '4/4', bpm: 100, swing: v / 100, click: true });
  rng.oninput = () => { v = +rng.value; label(); };
  rng.onchange = play;
  el.querySelector('[data-act="swplay"]').onclick = play;
  label();
  return l6rStop;
}
function l6rSwingQ() {
  const sw = Math.random() < 0.5, line = rand(L6R_SWING_LINES), bpm = randInt(92, 112), amt = sw ? randInt(64, 70) / 100 : 0.5;
  return {
    q: 'Straight or swung? Listen to the eighth notes.', options: ['Straight', 'Swung'], answer: sw ? 1 : 0, playLabel: 'Hear it again',
    play: () => l6rPlay(line, { meter: '4/4', bpm, swing: amt, click: true }),
    why: sw ? 'Swung: each pair of eighths goes long–short, like a triplet with its first two notes tied.' : 'Straight: every eighth note is the same length.'
  };
}
const L6R_FEELS = [[0.5, 'Straight'], [0.6, 'Light swing'], [0.67, 'Swung'], [0.75, 'Shuffle']];
const L6R_OWN_TUNE = 'E4:q G4:e A4:e C5:q A4:e G4:e | E4:e D4:e E4:e G4:e A4:h | C5:e A4:e G4:e E4:e D4:q E4:e G4:e | A4:e G4:e E4:e D4:e C4:h';
/* the latest Level 5 piece (or any sketch with notes and a tempo) as notation, else a tune written for Motif */
function l6rSeed() {
  const list = Store.data.sketches || [];
  const sk = list.find(s => s.level === 5 && s.notes && s.notes.length >= 4) || list.find(s => s.notes && s.notes.length >= 4 && s.bpm);
  if (!sk) return { events: Score.normalize(L6R_OWN_TUNE, '4/4'), bpm: 96, keySig: 0, from: null, name: '' };
  const km = /^([A-G][♯♭#b]?)\s*(major|minor)?/.exec(sk.key || '');
  let keySig = 0; try { if (km) keySig = Theory.keySig(Theory.pretty(km[1]), km[2] === 'minor' ? 'minor' : 'major').n; } catch (e) { keySig = 0; }
  const bpm = Math.max(60, Math.min(140, sk.bpm || 96));
  const events = sk.score ? Score.normalize(sk.score.events, sk.score.meter || '4/4') : Score.fromNotes(sk.notes, { bpm, meter: '4/4', keySig, grids: ['e'] });
  return { events, bpm, keySig, from: sk.id, name: sk.name };
}
/* 6.2 workshop: your Level 5 melody (or an original one), heard straight and swung; keep the feel that suits it */
Tasks.l6SwingShop = (el, p, done) => {
  const seed = l6rSeed(), heard = new Set(), id = 'l6r-swing-name';
  let feel = 0.5, saved = false;
  el.innerHTML = `<div class="nt-task"><p class="prompt">${seed.from ? `Your melody “${esc(seed.name)}”, written out. Hear it straight and swung, then keep the feel that suits it.` : 'No Level 5 melody in your sketchbook, so here is a tune written for Motif. Hear it straight and swung, then keep the feel that suits it.'}</p>
    <div class="choices" role="group" aria-label="Feel">${L6R_FEELS.map(([v, n], i) => `<button type="button" class="choice" data-i="${i}" aria-pressed="${i === 0}">${n}</button>`).join('')}</div>
    <div class="l6r-cap"></div><ul class="nt-checks"></ul>
    <div class="field"><label for="${id}">Name it</label><input id="${id}" type="text" maxlength="40" value="${esc(seed.name ? seed.name + ' (swung)' : '')}" placeholder="e.g. Late-night version"></div>
    <div class="row"><button type="button" class="btn primary" data-act="save" disabled>Save to sketchbook</button></div><p class="fb info" aria-live="polite"></p></div>`;
  const nBars = Math.max(1, Math.ceil(Score.length(seed.events) / 4 - 1e-6));
  const cap = MelodyCapture.mount(el.querySelector('.l6r-cap'), { meter: '4/4', bpm: seed.bpm, bars: nBars, keySig: seed.keySig, initial: seed.events, onChange: () => { saved = false; paint(); } });
  const checks = el.querySelector('.nt-checks'), bSave = el.querySelector('[data-act="save"]'), f = el.querySelector('.fb'), box = el.querySelector('.choices');
  function paint() {
    checks.innerHTML = `<li class="${heard.size >= 2 ? 'ok' : ''}">${heard.size >= 2 ? '✓' : '○'} Hear it at least two ways (${heard.size} so far)</li><li class="ok">✓ Keeping: ${l6rFeel(feel)}</li>`;
    bSave.disabled = saved || heard.size < 2;
  }
  box.onclick = ev => {
    const b = ev.target.closest('.choice'); if (!b) return;
    feel = L6R_FEELS[+b.dataset.i][0]; heard.add(feel);
    box.querySelectorAll('.choice').forEach(x => x.setAttribute('aria-pressed', x === b));
    cap.setSwing(feel); cap.play(); paint();
  };
  bSave.onclick = () => {
    const events = cap.events, sw = feel > 0.52;
    const score = { meter: '4/4', bpm: cap.bpm, keySig: seed.keySig, events };
    if (sw) score.swing = feel;
    const sketch = saveSketch({ name: el.querySelector('#' + id).value.trim() || (sw ? 'Swung tune' : 'Straight tune'), notes: cap.notes, score, bpm: cap.bpm, level: 6, tags: sw ? ['swing', l6rFeel(feel).toLowerCase()] : ['straight eighths'], from: seed.from || undefined, prompt: 'Swing your Level 5 melody and keep the feel that suits it' });
    saved = true; paint();
    fb(f, 'good', `Saved “${sketch.name}”, ${sw ? l6rFeel(feel).toLowerCase() : 'straight'}.`);
    done(true, { sketch, events });
  };
  paint();
  return () => cap.destroy();
};

/* ---------- 6.3 syncopation, pickups and cut time ---------- */
const L6R_SQUARE = 'C5:q A4:q G4:q E4:q | F4:q D4:q C4:h';
const L6R_PUSHED = 'C5:e A4:q G4:e_G4:e E4:q. | F4:q D4:e C4:e_C4:h';
const L6R_SYNC = ['e q e q q', 'q e q e q', 'q. q. q', 'e q q q e', 'q e q q e', 'e q e h'];
const L6R_DICT = ['q e q e q', 'e q e h', 'q. e_q q', 'e q q q e', 'q q. e q', 'h. e e'];
const L6R_CUT = ['h h', 'q h q', 'h. q', 'q q h', 'q h. | e e q h'];
const L6R_SQUARE4 = 'C4:q E4:q G4:q A4:q | G4:q E4:q D4:h | E4:q G4:q A4:q C5:q | A4:q G4:q C5:h';
/* syncopations: sounds that start off the beat and are still sounding when the next beat comes */
function l6rSyncopations(events) {
  const out = []; let at = 0;
  Score.parse(events).forEach(e => {
    if (!e.rest && e.tie && out.length) out[out.length - 1].b = at + e.d;
    else if (!e.rest) out.push({ a: at, b: at + e.d });
    at += e.d;
  });
  return out.filter(s => Math.abs(s.a - Math.round(s.a)) > 1e-6 && Math.ceil(s.a) < s.b - 1e-6).length;
}

/* ---------- 6.4 odd meters ---------- */
const L6R_54 = ['q q q q q', 'q. e q q q', 'h. h', 'q e e q q q', 'e e q q e e q', 'q q q h'];
const L6R_78 = ['q q q.', 'e e e e e e e', 'q e e q.', 'e e q e e e', 'q q e e e'];
const L6R_RIFF5 = 'A2:q C3:q D3:q E3:e D3:e C3:q | A2:q C3:q D3:q G2:h';
function l6rFive() {
  l6rPlay(L6R_RIFF5, { meter: '5/4', bpm: 150 });
  Score.groove({ meter: '5/4', bpm: 150, bars: 2, root: 33 });
}
/* 6.4 workshop: pick 5/4 or 7/8, then write a riff whose groups can be heard */
Tasks.l6Riff = (el, p, done) => {
  const OPT = {
    '5/4': { bpm: 132, starts: [0, 3], miss: 'Put a note on beat 1 and on beat 4 of bar 1, so the 3 + 2 can be heard.' },
    '7/8': { bpm: 120, starts: [0, 1, 2], miss: 'Start a note on each group of bar 1 (1, 2 and 3 of the 2 + 2 + 3), so the groups can be heard.' }
  };
  el.innerHTML = `<div class="nt-task"><p class="prompt">${p.prompt}</p><div class="choices" role="group" aria-label="Meter">${Object.keys(OPT).map(m => `<button type="button" class="choice" data-m="${m}" aria-pressed="false">${m} <small>(${Score.meter(m).grouping})</small></button>`).join('')}</div><div class="l6r-slot"></div></div>`;
  const slot = el.querySelector('.l6r-slot'), box = el.querySelector('.choices');
  let inner = null;
  box.onclick = ev => {
    const b = ev.target.closest('.choice'); if (!b) return;
    const m = b.dataset.m, O = OPT[m];
    box.querySelectorAll('.choice').forEach(x => x.setAttribute('aria-pressed', x === b));
    if (inner) inner();
    Score.groove({ meter: m, bpm: O.bpm, bars: 1, root: 33 });
    inner = Tasks.capture(slot, {
      meter: m, bpm: O.bpm, bars: 2, keySig: 0, pcs: [9, 0, 2, 4, 7], pcsLabel: 'A minor pentatonic (A C D E G)', min: 5,
      check: ev2 => { const on = Score.onsets(ev2); return O.starts.every(s => on.some(x => Math.abs(x - s) < 1e-6)) ? null : O.miss; }, checkOk: 'You can hear the groups',
      save: { level: 6, tags: ['odd meter', m], key: 'A minor pentatonic', prompt: `A riff in ${m}` }
    }, done);
  };
  return () => { if (inner) inner(); };
};
const L6R_ODD_SONGS = [['Take Five', '5/4'], ['the Mission: Impossible theme', '5/4'], ['Money', '7/4']];

/* ---------- the units ---------- */
const L6_RHYTHM_UNITS = [
  { id: '6.1', title: 'Compound time', blurb: 'Beats that split in three.', steps: [
    { k: 'card', tag: 'Hear', title: 'Six eighths, two ways', mount: l6rTwoWays,
      body: '<p>Play both. Each bar has the same six even eighth notes. Listen for where the weight falls.</p><p>In the first, the eighths pair up: <b>ONE</b>-and <b>TWO</b>-and <b>THREE</b>-and. Three beats. In the second, they group in threes: <b>ONE</b>-la-li <b>TWO</b>-la-li. Two beats, each split in three.</p><p>Tap your foot to each: three steps a bar, then two.</p>' },
    { k: 'task', tag: 'Echo', type: 'rhythmTap', p: { patterns: L6R_68, meter: '6/8', bpm: 132, rounds: 3, counts: true, syllables: true, prompt: 'Clap it back. Count two beats in a bar, each split in three: “1 la li 2 la li”.' } },
    { k: 'task', tag: 'Explore', type: 'meterFeel', p: { rounds: 4, choices: ['3/4', '6/8'], q: 'Same six eighths. Three beats of two (3/4), or two beats of three (6/8)?', items: [{ meter: '3/4', bpm: 150, pattern: 'e e e e e e e e e e e e' }, { meter: '6/8', bpm: 150, pattern: 'e e e e e e e e e e e e' }, { meter: '3/4', bpm: 132 }, { meter: '6/8', bpm: 132 }] } },
    { k: 'card', tag: 'Name', title: 'Compound time', play: l6rLilt, playLabel: 'Play a tune in 6/8',
      art: () => l6rCap('6/8: two beats') + l6rBox(L6R_LILT, { meter: '6/8', counts: true }) + l6rCap('9/8: three beats') + l6rBox('q. e e e q e', { meter: '9/8', clef: 'perc', counts: true }) + l6rCap('12/8: four beats') + l6rBox('q. e e e q e q.', { meter: '12/8', clef: 'perc', counts: true }),
      body: '<p>In <b>compound time</b> every beat splits in three. The beat is a <b>dotted quarter</b>: three eighth notes. The time signature counts the eighths, so 6/8 means six eighths in a bar, felt as two beats.</p><p><b>6/8</b> has two beats, <b>9/8</b> three, <b>12/8</b> four. In simple time (2/4, 3/4, 4/4) each beat splits in two.</p><p>Eighths are beamed in threes so you can see the beats. Count “1 la li 2 la li”, or say ta-ki-da for three eighths and ta-da for a quarter and an eighth.</p><p>Heard in <i>House of the Rising Sun</i> and <i>We Are the Champions</i>. Listen for the slow, rolling beats with three inside each one.</p><p class="l6r-deeper">Go deeper: Hindemith, <i>Elementary Training for Musicians</i>.</p>' },
    { k: 'task', tag: 'Echo', type: 'rhythmTap', p: { patterns: L6R_128, meter: '12/8', bpm: 150, rounds: 2, counts: true, prompt: 'Now 12/8: four beats, each split in three. Clap it back.' } },
    { k: 'task', tag: 'Create', type: 'capture', p: {
      prompt: 'Workshop: tap a 2-bar groove in 6/8. Let bar 1 roll in two big beats and bar 2 answer it. Use a “la” or a “li” somewhere so the threes can be heard.',
      meter: '6/8', bpm: 120, bars: 2, clef: 'perc', min: 5, checkOk: 'The threes can be heard',
      check: ev => Score.onsets(ev).some(x => Math.abs(x / 1.5 - Math.round(x / 1.5)) > 1e-6) ? null : 'Use a “la” or “li”: a note between the two big beats.',
      save: { level: 6, tags: ['compound time', '6/8', 'groove'], prompt: 'A 2-bar groove in 6/8' } } }
  ] },
  { id: '6.2', title: 'Triplets, swing and shuffle', blurb: 'Three in a beat, and the long–short lilt.', steps: [
    { k: 'card', tag: 'Hear', title: 'Three in the time of two', play: () => l6rPlay('q q e e e e | q q 3[e e e] 3[e e e]', { meter: '4/4', bpm: 84, click: true }), playLabel: 'Play two, then three',
      art: () => l6rBox('q q e e e e | q q 3[e e e] 3[e e e]', { meter: '4/4', clef: 'perc', counts: true }),
      body: '<p>Listen: in bar 1 the last two beats split in two. In bar 2 they split in three. The beat itself does not move.</p><p>Three notes squeezed into the time of two make a <b>triplet</b>. It is written with a small 3 over the notes, and counted like compound time: 1 la li.</p>' },
    { k: 'task', tag: 'Echo', type: 'rhythmTap', p: { patterns: L6R_TRIP, meter: '4/4', bpm: 72, rounds: 3, counts: true, syllables: true, prompt: 'Clap it back. Keep the beat steady and fit three even claps into each triplet.' } },
    { k: 'card', tag: 'Explore', title: 'Written even, played long–short', mount: l6rSwingWidget,
      body: '<p>Jazz, blues and plenty of pop write plain eighth notes but play them <b>swung</b>: the first of each pair long, the second short. Move the slider from straight to swung and listen.</p><p>Near 2:1 the long–short pair matches a triplet with its first two notes tied. Push further and the lilt turns into a heavier <b>shuffle</b>.</p>' },
    { k: 'task', tag: 'Explore', type: 'quiz', p: { rounds: 5, prompt: 'Straight or swung? Listen to the eighth notes.', gen: l6rSwingQ } },
    { k: 'card', tag: 'Name', title: 'Triplets, swing, shuffle',
      art: () => l6rCap('A triplet: three in the time of two') + l6rBox('q 3[e e e] q 3[q e]', { meter: '4/4', clef: 'perc', counts: true }) + l6rCap('Swing: written like this…') + l6rBox('e e e e e e e e', { meter: '4/4', clef: 'perc' }) + l6rCap('…played like this') + l6rBox('3[q e] 3[q e] 3[q e] 3[q e]', { meter: '4/4', clef: 'perc' }),
      body: '<p>A <b>triplet</b> fits three equal notes into the time of two. The 3 tells you. Three triplet eighths fill one beat; three triplet quarters fill two.</p><p><b>Swing</b> keeps the page simple: plain eighths, often with “Swing” written at the top, played long–short. How long the first one is depends on the style: about 60:40 for a light swing, 2:1 for a classic triplet swing.</p><p>A <b>shuffle</b> is that triplet feel driven hard and steady, often by the drums or a rolling bass. <b>Straight</b> eighths are even: most rock, folk and classical music.</p><p class="l6r-deeper">Go deeper: Hindemith, <i>Elementary Training for Musicians</i>; Levine, <i>The Jazz Theory Book</i>.</p>' },
    { k: 'task', tag: 'Create', type: 'l6SwingShop', p: {} }
  ] },
  { id: '6.3', title: 'Syncopation, pickups and cut time', blurb: 'Weight off the beat, and notes that arrive early.', steps: [
    { k: 'card', tag: 'Hear', title: 'Square, then pushed', play: () => l6rPlay(L6R_SQUARE + ' | ' + L6R_PUSHED, { meter: '4/4', bpm: 92, click: true }), playLabel: 'Play both',
      art: () => l6rCap('Square') + l6rBox(L6R_SQUARE, { meter: '4/4', counts: true }) + l6rCap('Pushed') + l6rBox(L6R_PUSHED, { meter: '4/4', counts: true }),
      body: '<p>The same tune twice. The first puts every note on a beat. The second moves some notes early, so they start between beats and ring over the next one.</p><p>That is <b>syncopation</b>: weight where the beat isn’t. It makes a rhythm lean forward.</p>' },
    { k: 'task', tag: 'Echo', type: 'rhythmTap', p: { patterns: L6R_SYNC, meter: '4/4', bpm: 84, rounds: 3, counts: true, prompt: 'Clap it back. Count the eighths in your head (1 & 2 &) and clap only where a note starts. A tie means hold, not clap.' } },
    { k: 'task', tag: 'Explore', type: 'rhythmDictation', p: { patterns: L6R_DICT, meter: '4/4', bpm: 84, rounds: 3, mode: 'tap', prompt: 'Rhythmic dictation, part 1: hear it, then tap it. Your taps are written out under the answer.' } },
    { k: 'card', tag: 'Name', title: 'Push, pickup, cut time',
      art: () => l6rCap('A tie across the beat') + l6rBox('q e q e q', { meter: '4/4', clef: 'perc', counts: true }) + l6rCap('A push: beat 1 arrives early') + l6rBox('C4:q E4:q G4:q. C5:e_C5:w', { meter: '4/4', counts: true }) + l6rCap('A pickup of one beat') + l6rBox('G4:q | C5:q B4:q A4:q G4:q | E4:h. ', { meter: '4/4', counts: true, pickup: 1 }) + l6rCap('Cut time: two half-note beats') + l6rBox('q h q | h h', { meter: '2/2', clef: 'perc', counts: true }),
      play: () => l6rPlay('G4:q | C5:q B4:q A4:q G4:q | E4:h.', { meter: '4/4', bpm: 96, pickup: 1, countIn: 1, click: true }), playLabel: 'Play the pickup tune',
      body: '<p>A note that starts on an “&” and is held over the next beat is <b>tied across the beat</b>. You hear it start early, and the beat it covers goes quiet.</p><p>A <b>push</b> (or <b>anticipation</b>) does that at a bar line: the note that belongs on beat 1 arrives an eighth early and is tied over. Pop songs push all the time.</p><p>A <b>pickup</b> (an <b>anacrusis</b>) is a short first bar: the tune starts on a weak beat and leans into beat 1. Count “1 2 3” and come in on 4.</p><p><b>Cut time</b>, 2/2, counts two half-note beats in a bar. It looks like 4/4 but feels in two: marches, show tunes, fast swing. It is sometimes written as a C with a line through it.</p><p class="l6r-deeper">Go deeper: Hindemith, <i>Elementary Training for Musicians</i>.</p>' },
    { k: 'task', tag: 'Explore', type: 'rhythmDictation', p: { patterns: L6R_SYNC, meter: '4/4', bpm: 84, rounds: 3, mode: 'choose', prompt: 'Rhythmic dictation, part 2: hear it, then pick the notation.' } },
    { k: 'task', tag: 'Create', type: 'capture', p: {
      prompt: 'Workshop: this tune is square: every note lands on a beat. Rewrite it with three syncopations. Click a note and press [ (or ½): it gets shorter, and the next note arrives early, across the beat. Play it back after each change.',
      meter: '4/4', bpm: 96, bars: 4, initial: L6R_SQUARE4, min: 8, checkOk: 'Three syncopations',
      check: ev => { const n = l6rSyncopations(ev); return n >= 3 ? null : `${n} of 3 syncopations so far: a note that starts on an “&” and rings over the next beat.`; },
      save: { level: 6, tags: ['syncopation'], key: 'C major', prompt: 'A square tune rewritten with three syncopations' } } }
  ] },
  { id: '6.4', title: 'Odd meters', blurb: 'Fives and sevens, built from twos and threes.', steps: [
    { k: 'card', tag: 'Hear', title: 'Count to five', play: l6rFive, playLabel: 'Play a riff in 5/4',
      art: () => l6rBox(L6R_RIFF5, { meter: '5/4', clef: 'bass', counts: true }),
      body: '<p>Count along: 1 2 3 4 5, 1 2 3 4 5. Five beats feel lopsided at first, until you hear them fall into two groups: <b>1 2 3</b>, <b>4 5</b>.</p><p>The low notes mark the start of each group.</p>' },
    { k: 'task', tag: 'Echo', type: 'rhythmTap', p: { patterns: L6R_54, meter: '5/4', bpm: 120, rounds: 3, counts: true, prompt: 'Clap it back in 5/4. Feel the bar as 3 + 2.' } },
    { k: 'task', tag: 'Explore', type: 'meterFeel', p: { rounds: 4, choices: ['4 beats', '5 beats', '7 beats'], q: 'Count the beats in a bar. The low note starts each bar.', items: [{ meter: '4/4', bpm: 140 }, { meter: '5/4', bpm: 140 }, { meter: '7/4', bpm: 150 }] } },
    { k: 'card', tag: 'Name', title: 'Odd meters',
      art: () => l6rCap('7/4: 4 + 3') + l6rBox('q q q q q q q', { meter: '7/4', clef: 'perc', counts: true }) + l6rCap('7/8: 2 + 2 + 3') + l6rBox('e e e e e e e | q q q.', { meter: '7/8', clef: 'perc', counts: true }) + l6rCap('Changing meter') + l6rBox('q q q | q q | e e e e e e | h', { meter: ['3/4', '2/4', '3/4', '2/4'], clef: 'perc', counts: true }),
      body: '<p><b>Odd meters</b> have bars that do not split evenly into twos or threes. They are built from both.</p><p><b>5/4</b> is usually 3 + 2 (sometimes 2 + 3). <b>7/4</b> is often 4 + 3. <b>7/8</b> is quick and lopsided, usually 2 + 2 + 3: short, short, long, counted “1 & 2 & 3 la li”. The beams show the groups.</p><p>In <b>changing meter</b> the time signature changes from bar to bar, and a new one is written wherever it changes.</p><p>Heard in <i>Take Five</i> and the <i>Mission: Impossible</i> theme (5/4), and <i>Money</i> (7/4).</p><p class="l6r-deeper">Go deeper: Hindemith, <i>Elementary Training for Musicians</i>.</p>' },
    { k: 'task', tag: 'Echo', type: 'rhythmTap', p: { patterns: L6R_78, meter: '7/8', bpm: 120, rounds: 3, counts: true, prompt: 'Clap it back in 7/8: short, short, long. Count “1 & 2 & 3 la li”.' } },
    { k: 'task', tag: 'Create', type: 'l6Riff', p: { prompt: 'Workshop: a riff in 5/4 or 7/8. Pick one, listen to its groove, then record two bars on A minor pentatonic (A C D E G). Make the groups audible: start notes where the groups start.' } }
  ] }
];

/* ---------- review cards ---------- */
/* { type: 'l6clap', meter, patterns, bpm, counts, swing, pickup, prompt }: clap one rhythm back in any meter; one try */
CARD_TYPES.l6clap = (el, c, fin) => Tasks.rhythmTap(el, { patterns: [rand(c.patterns)], meter: c.meter, bpm: c.bpm || 84, swing: c.swing, counts: c.counts, pickup: c.pickup, once: true, prompt: c.prompt || 'Clap it back. One try.' }, (ok, r) => fin(!!r.ok));
const l6rOpt = (src, meter, o) => `<span class="nt-opt">${Score.svg(Score.normalize(src, meter), Object.assign({ meter, clef: 'perc' }, o || {}))}</span>`;
const L6_RHYTHM_CARDS = {
  '6.1': [
    { id: 'l6-feel-kind', type: 'gen', gen: l6rKindQ },
    { id: 'l6-34-68', type: 'gen', gen() {
      const m = rand(['3/4', '6/8']);
      return { q: 'Same six eighths. Is it 3/4 or 6/8?', options: ['3/4', '6/8'], answer: m === '3/4' ? 0 : 1, playLabel: 'Hear it again', play: () => Score.groove({ meter: m, bpm: 150, bars: 2, pattern: 'e e e e e e e e e e e e' }), why: m === '3/4' ? '3/4: the eighths pair up, three beats.' : '6/8: the eighths group in threes, two beats.' };
    } },
    { id: 'l6-compound-beats', type: 'gen', gen() {
      const [m, n] = rand([['6/8', 2], ['9/8', 3], ['12/8', 4]]), opts = shuffle([String(n), String(n * 3), String(n === 2 ? 3 : 2)]);
      return { q: `How many beats in a bar of ${m}?`, html: l6rBox(Array(n * 3).fill('e').join(' '), { meter: m, clef: 'perc' }), options: opts, answer: opts.indexOf(String(n)), why: `${m}: ${n * 3} eighths in groups of three, so ${n} dotted-quarter beats.` };
    } },
    { id: 'l6-clap-68', type: 'l6clap', meter: '6/8', bpm: 132, counts: true, patterns: L6R_68 },
    { id: 'l6-clap-128', type: 'l6clap', meter: '12/8', bpm: 150, counts: true, patterns: L6R_128 }
  ],
  '6.2': [
    { id: 'l6-swing-ear', type: 'gen', gen: l6rSwingQ },
    { id: 'l6-trip-find', type: 'gen', gen() {
      const plain = shuffle(['q e e q q', 'e e q q q', 'q q s s e q', 'q q q e e']).slice(0, 2), trip = rand(L6R_TRIP), opts = shuffle([trip].concat(plain));
      return { q: 'Which rhythm has a triplet?', options: opts.map(x => l6rOpt(x, '4/4')), answer: opts.indexOf(trip), why: 'The one with the 3: three notes in the time of two.' };
    } },
    { id: 'l6-swing-written', type: 'choice', q: 'Swung eighths are usually written as…', options: ['Plain eighth notes, played long–short', 'Dotted eighths and sixteenths', 'Triplets in every beat'], answer: 0, why: 'Plain eighths, with “Swing” at the top. The player makes them long–short.' },
    { id: 'l6-clap-trip', type: 'l6clap', meter: '4/4', bpm: 72, counts: true, patterns: L6R_TRIP }
  ],
  '6.3': [
    { id: 'l6-sync-dict', type: 'gen', gen() {
      const pat = rand(L6R_SYNC), opts = shuffle([pat].concat(Score.variants(pat, '4/4', 2)));
      return { q: 'Listen. Which rhythm is it?', options: opts.map(x => l6rOpt(x, '4/4')), answer: opts.indexOf(pat), playLabel: 'Hear it again', play: () => l6rPlay(pat, { meter: '4/4', bpm: 84, countIn: 1 }), why: 'Follow the notes with your eyes as it plays again.' };
    } },
    { id: 'l6-sync-which', type: 'gen', gen() {
      const sync = rand(L6R_SYNC), opts = shuffle([sync, 'q q q q', rand(['h q q', 'q q h', 'e e q q q', 'q e e h'])]);
      return { q: 'Which rhythm is syncopated?', options: opts.map(x => l6rOpt(x, '4/4', { counts: true })), answer: opts.indexOf(sync), why: 'The syncopated one has a note that starts on an “&” and rings over the next beat.' };
    } },
    { id: 'l6-pickup', type: 'gen', gen() {
      const [pk, src, ans] = rand([[1, 'G4:q | C5:h G4:h | C5:h.', '1 beat'], [2, 'E4:q G4:q | C5:w | G4:h', '2 beats'], [0.5, 'G4:e | C5:q E5:q G5:q E5:q | C5:h. G4:e', 'half a beat']]), opts = ['half a beat', '1 beat', '2 beats'];
      return { q: 'How long is the pickup before bar 1?', html: l6rBox(src, { meter: '4/4', pickup: pk, counts: true }), options: opts, answer: opts.indexOf(ans), why: `The first bar is short: ${ans}, so beat 1 comes after it.` };
    } },
    { id: 'l6-clap-sync', type: 'l6clap', meter: '4/4', bpm: 84, counts: true, patterns: L6R_SYNC },
    { id: 'l6-clap-cut', type: 'l6clap', meter: '2/2', bpm: 132, counts: true, patterns: L6R_CUT, prompt: 'Cut time: two half-note beats. Clap it back. One try.' }
  ],
  '6.4': [
    { id: 'l6-count-odd', type: 'gen', gen() {
      const m = rand(['4/4', '5/4', '7/4']), opts = ['4 beats', '5 beats', '7 beats'];
      return { q: 'Count the beats in a bar.', options: opts, answer: opts.indexOf(m[0] + ' beats'), playLabel: 'Hear it again', play: () => Score.groove({ meter: m, bpm: 144, bars: 2 }), why: `${m}: ${m[0]} beats${m === '5/4' ? ', as 3 + 2' : m === '7/4' ? ', as 4 + 3' : ''}.` };
    } },
    { id: 'l6-78-group', type: 'gen', gen() {
      const opts = ['2+2+3', '3+2+2', '2+3+2'], g = rand(opts);
      return { q: 'How do the beams group this bar of 7/8?', html: `<div class="nt-box">${Score.svg('e e e e e e e', { meter: '7/8:' + g, clef: 'perc' })}</div>`, options: opts, answer: opts.indexOf(g), why: `${g}: each beam is one group.` };
    } },
    { id: 'l6-odd-songs', type: 'gen', gen() {
      const [t, m] = rand(L6R_ODD_SONGS), opts = ['5/4', '7/4', '6/8'];
      return { q: `Which meter is ${t === 'Money' ? '<i>Money</i>' : t === 'Take Five' ? '<i>Take Five</i>' : 'the <i>Mission: Impossible</i> theme'} in?`, options: opts, answer: opts.indexOf(m), why: m === '5/4' ? 'Five beats, felt as 3 + 2.' : 'Seven beats, felt as 4 + 3.' };
    } },
    { id: 'l6-clap-54', type: 'l6clap', meter: '5/4', bpm: 120, counts: true, patterns: L6R_54 },
    { id: 'l6-clap-78', type: 'l6clap', meter: '7/8', bpm: 120, counts: true, patterns: L6R_78 }
  ]
};
