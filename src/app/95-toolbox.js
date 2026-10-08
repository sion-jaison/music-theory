/* =================================================================
   Toolbox: always-open references that also listen.
   Listen (what am I playing?), Circle, Scales, Chords, Progressions, Hooks.
   ================================================================= */
const TOOL_TABS = [['listen', 'Listen'], ['circle', 'Circle of Fifths'], ['scales', 'Scales'], ['chords', 'Chords'], ['progressions', 'Progressions'], ['hooks', 'Memory hooks']];
const SPELLED_ROOTS = ['C', 'C♯', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const SCALE_HOOKS = {
  major: 'Recipe 2-2-1-2-2-2-1: two matching halves (W W H) joined by a whole step. Every letter once.',
  minor: 'Recipe 2-1-2-2-1-2-2. Start a major scale on its 6th note (la). Same key signature as its relative major.',
  harmonic: 'Natural minor with a raised 7th: the leading tone pulls home, and the gap from ♭6 to 7 sounds exotic.',
  melodic: 'Going up: natural minor with raised 6th and 7th. Coming down it is usually played as natural minor.',
  majPent: 'Major scale without 4 and 7: nothing clashes. From G♭ it is exactly the five black keys.',
  minPent: '1 ♭3 4 5 ♭7: the relative minor of the major pentatonic, the core of rock and blues solos.',
  blues: 'Minor pentatonic plus the ♭5 “blue note”: 1 ♭3 4 ♭5 5 ♭7.'
};
const CHORD_HOOKS = {
  maj: 'Big then small: 4 + 3 half steps. Bright, settled.',
  min: 'Small then big: 3 + 4. Move the middle of a major chord down a half step.',
  dim: 'Squeeze both: 3 + 3. Tense, wants to move.',
  aug: 'Stretch both: 4 + 4. Dreamy, unresolved; any of its notes can be the root.',
  sus2: 'Swap the 3rd for the 2nd: open, neither major nor minor.',
  sus4: 'Swap the 3rd for the 4th: it leans back toward the major chord.',
  '7': 'A major chord plus a minor 7th (4 + 3 + 3): the V7 that pulls home; the blues chord.',
  maj7: 'A major chord plus a major 7th (4 + 3 + 4): soft and dreamy.',
  m7: 'A minor chord plus a minor 7th (3 + 4 + 3): mellow; the ii in ii–V–I.',
  m7b5: 'A diminished triad plus a minor 7th (3 + 3 + 4): the vii in a major key.',
  dim7: 'Three minor 3rds stacked (3 + 3 + 3): every note is the same distance apart.'
};
/* every memory hook in the plan, with the level that teaches it */
const HOOKS = [
  [1, 'Find C and F', 'C sits just left of every pair of black keys; F sits just left of every group of three.'],
  [1, 'Two names', '♯ means one key up, ♭ one key down, so every black key has two names (C♯ = D♭).'],
  [1, 'Half and whole', 'A half step is the very next key; a whole step skips one. B–C and E–F are half steps with no black key between.'],
  [1, 'Count rhythms aloud', 'ta (quarter), ti-ti (two eighths), ta-a (half), ta-a-a-a (whole), sh (rest).'],
  [2, 'Treble lines and spaces', 'Lines E G B D F: Every Good Boy Does Fine. Spaces spell FACE.'],
  [2, 'Bass lines and spaces', 'Lines G B D F A: Good Boys Do Fine Always. Spaces A C E G: All Cows Eat Grass.'],
  [2, 'Major scale', '2-2-1-2-2-2-1 (W W H W W W H). Every letter once, in order.'],
  [2, 'Solfège', 'do re mi fa sol la ti do. Do is home; ti pulls back to do; do-mi-sol is the home chord.'],
  [2, 'Interval numbers', 'Count the letters, including both ends. Line to line or space to space is odd; line to space is even.'],
  [2, 'Interval songs', Theory.INTERVALS.slice(1).map(i => `${i.short}: ${i.song}`).join(' · ')],
  [2, 'Dots', 'A dot adds half again: a dotted half lasts 3 beats, a dotted quarter 1½.'],
  [2, 'Split the beat', 'ta · ti-ti · ti-ka-ti-ka: count 1, 1 &, 1 e & a. A tie is one sound.'],
  [3, 'Triads', 'Skip a key, skip a key: root, 3rd, 5th.'],
  [3, 'Chord recipes', 'Major 4+3, minor 3+4, diminished 3+3, augmented 4+4. To make major minor, move the middle down.'],
  [3, 'Chords of a major key', 'M m m M M m d: the Big Three majors on 1, 4 and 5; minors on 2, 3 and 6; diminished on 7.'],
  [3, 'Inversions', 'Same chord, different bottom: C/E has E in the bass, C/G has G.'],
  [3, 'Seventh chords', 'maj7 = 4+3+4, dominant 7 = 4+3+3, m7 = 3+4+3.'],
  [4, 'Order of sharps', 'F C G D A E B: Father Charles Goes Down And Ends Battle.'],
  [4, 'Order of flats', 'B E A D G C F: Battle Ends And Down Goes Charles’ Father.'],
  [4, 'Name the key', 'Sharp keys: the last sharp, then up a half step. Flat keys: the second-to-last flat. F has one flat; C has none.'],
  [4, 'Around the circle', 'C G D A E B: Cats Go Down Alleys Eating Birds. Flat side: F, then B♭ E♭ A♭ D♭ G♭ (BEAD-G).'],
  [4, 'Clock maths', 'The hour is the number of sharps. On the flat side, 12 minus the hour is the number of flats.'],
  [4, 'The family slice', 'A key and its two neighbours are I, IV and V; the minors inside them are vi, ii and iii.'],
  [4, 'Minor scales', 'Natural 2-1-2-2-1-2-2. Harmonic = natural with ♯7. Melodic going up = natural with ♯6 ♯7.'],
  [4, 'Relative and parallel', 'Relative minor: down 3 half steps, same key signature. Parallel minor: same tonic, lower 3, 6 and 7.'],
  [5, 'Functions', 'Home, away, tension, home: T → S → D → T (I → IV → V → I).'],
  [5, 'The four-chord loop', 'I–V–vi–IV: Let It Be, Don’t Stop Believin’, Someone Like You. Rotations: vi–IV–I–V, I–vi–IV–V.'],
  [5, 'Blues', 'I I I I · IV IV I I · V IV I V. Blues scale 1 ♭3 4 ♭5 5 ♭7.'],
  [5, 'Cadences', 'V–I full stop, IV–I “Amen”, ending on V a comma, V–vi a surprise.'],
  [5, 'Transposing', 'Keep the numbers, change the key.'],
  [5, 'Dynamics', 'Piano = quiet, forte = strong; mezzo = medium. Crescendo grows, diminuendo fades.']
];

function renderToolbox(tab) {
  const st = Store.data.settings;
  tab = tab || st.toolTab || 'listen';
  st.toolTab = tab; Store.save();
  view.innerHTML = `<section class="panel tools"><div class="level-head"><div><div class="eyebrow">Toolbox</div><h1>Look it up, hear it, play it</h1></div></div>
    <nav class="tool-tabs" aria-label="Tools">${TOOL_TABS.map(([k, n]) => `<button type="button" data-tab="${k}" aria-current="${k === tab ? 'true' : 'false'}">${n}</button>`).join('')}</nav>
    <div class="tool-body"></div></section>`;
  view.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => { runCleanup(); renderToolbox(b.dataset.tab); }; });
  const body = view.querySelector('.tool-body');
  cleanup = ({ listen: toolListen, circle: toolCircle, scales: toolScales, chords: toolChords, progressions: toolProgressions, hooks: toolHooks })[tab](body) || null;
}
const selectHTML = (id, label, opts, val) => `<label class="sel" for="${id}"><span>${label}</span><select id="${id}">${opts.map(([v, t]) => `<option value="${esc(v)}"${v === val ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`;
const noteChips = notes => `<div class="notes-strip">${notes.map(n => `<span class="n">${Theory.stripOct(n)}</span>`).join('')}</div>`;

/* ---------- Listen: notes, chords and the likely key ---------- */
function toolListen(el) {
  el.innerHTML = `<p class="lead">Play or sing anything. Single notes show on the left, chords on the right, and after a few notes Motif guesses the key. Works with the mic, the dock keys, your computer keys or a MIDI keyboard.</p>
    <div class="listen-grid">
      <div class="listen-card"><div class="eyebrow">Note</div><div class="big-name" data-note>–</div><div class="mono muted" data-cents>&nbsp;</div></div>
      <div class="listen-card"><div class="eyebrow">Chord</div><div class="big-name chord" data-chord>–</div><div class="mono muted" data-chord-notes>&nbsp;</div></div>
    </div>
    <div class="meter-slot"></div>
    <div class="trail-wrap"><div class="eyebrow">Recent</div><div class="notes-strip" data-trail><span class="empty">Nothing yet</span></div></div>
    <div class="hook" data-key>Play at least four different notes and Motif will suggest the key they fit.</div>
    <div class="row">${Mic.state === 'on' ? '' : '<button type="button" class="btn primary" data-act="mic">Turn on the mic</button>'}<button type="button" class="btn ghost" data-act="clear">Clear</button></div>`;
  const $ = s => el.querySelector(s);
  const trail = [], heard = [];
  const paintTrail = () => { $('[data-trail]').innerHTML = trail.length ? trail.slice(-10).map(x => `<span class="n${x.chord ? ' chord' : ''}">${x.label}</span>`).join('') : '<span class="empty">Nothing yet</span>'; };
  function paintKey() {
    const now = performance.now();
    const pcs = [...new Set(heard.filter(h => now - h.t < 30000).map(h => h.pc))];
    const box = $('[data-key]');
    if (pcs.length < 4) { box.innerHTML = 'Play at least four different notes and Motif will suggest the key they fit.'; return; }
    const fits = Theory.CIRCLE.map((k, i) => ({ k, i, n: pcs.filter(p => Theory.scale(k).map(Theory.pc).indexOf(p) >= 0).length }));
    const best = Math.max.apply(null, fits.map(f => f.n));
    const keys = fits.filter(f => f.n === best).slice(0, 3);
    box.innerHTML = best === pcs.length
      ? `These notes fit <b>${keys.map(f => f.k + ' major / ' + Theory.CIRCLE_MINOR[f.i] + ' minor').join('</b>, or <b>')}</b>.`
      : `Closest: <b>${keys.map(f => f.k + ' major').join('</b> or <b>')}</b> (${best} of ${pcs.length} notes fit).`;
  }
  const offs = [
    Bus.on('note', d => {
      $('[data-note]').textContent = noteName(d.midi);
      trail.push({ label: noteName(d.midi) }); heard.push({ pc: mod12(d.midi), t: performance.now() });
      paintTrail(); paintKey();
    }),
    Bus.on('pitch', p => { if (p.midiFloat != null) { const c = Math.round((p.midiFloat - Math.round(p.midiFloat)) * 100); $('[data-cents]').textContent = (c >= 0 ? '+' : '') + c + ' cents'; } }),
    Bus.on('chord', ev => {
      $('[data-chord]').textContent = ev.sym ? Theory.pretty(ev.sym) : '?';
      $('[data-chord-notes]').textContent = (ev.q ? Theory.CHORDS[ev.q].name + ' · ' : '') + ev.pcs.map(p => Theory.pcName(p)).join(' ');
      if (ev.sym) { trail.push({ label: Theory.pretty(ev.sym), chord: true }); ev.pcs.forEach(pc => heard.push({ pc, t: performance.now() })); paintTrail(); paintKey(); }
    })
  ];
  const offMeter = chromaMeter($('.meter-slot'));
  ChordIn.start();
  const mb = $('[data-act="mic"]'); if (mb) mb.onclick = async () => { if (await Mic.start()) { runCleanup(); renderToolbox('listen'); } else toast(micProblem()); };
  $('[data-act="clear"]').onclick = () => { trail.length = 0; heard.length = 0; ChordIn.clear(); paintTrail(); paintKey(); $('[data-note]').textContent = '–'; $('[data-chord]').textContent = '–'; $('[data-chord-notes]').innerHTML = '&nbsp;'; $('[data-cents]').innerHTML = '&nbsp;'; };
  return () => { offs.forEach(f => f()); offMeter(); ChordIn.stop(); };
}

/* ---------- Circle of Fifths explorer ---------- */
function toolCircle(el) {
  el.innerHTML = `<div class="tool-circle"><div class="circle-host"></div><div class="key-info"></div></div>`;
  const info = el.querySelector('.key-info');
  let pos = 0, ring = 'major';
  const circle = Circle.mount(el.querySelector('.circle-host'), { selected: 0, family: true }, (p, r) => { pos = p; ring = r; paint(true); });
  function paint(play) {
    const minor = ring === 'minor';
    const tonic = minor ? Theory.CIRCLE_MINOR[pos] : Theory.CIRCLE[pos];
    const sig = Theory.keySig(tonic, minor ? 'minor' : 'major');
    const alt = Theory.CIRCLE_ALT[pos];
    const scale = Theory.scale(Theory.withOct(tonic, 4), minor ? 'minor' : 'major', true);
    const chords = Theory.diatonic(tonic, minor ? 'minor' : 'major');
    const n = sig.n;
    circle.update({ selected: pos, family: true, center: minor ? [tonic + ' minor', Circle.sigText(pos), 'relative: ' + sig.major] : [tonic + ' major', Circle.sigText(pos), 'relative: ' + sig.minor + 'm'] });
    info.innerHTML = `<h2>${tonic} ${minor ? 'minor' : 'major'}${alt ? ` <span class="muted small">(also written ${minor ? alt.minor + ' minor' : alt.major + ' major'})</span>` : ''}</h2>
      <p>${n === 0 ? 'No sharps or flats.' : `${Math.abs(n)} ${n > 0 ? 'sharp' : 'flat'}${Math.abs(n) > 1 ? 's' : ''}: ${sig.acc.join(' ')}.`} ${minor ? `Relative major: <b>${sig.major} major</b> (up 3 half steps).` : `Relative minor: <b>${sig.minor} minor</b> (down 3 half steps).`}</p>
      <div class="art">${Staff.svg({ clef: 'treble', keySig: n, notes: scale.map(x => ({ n: x, acc: false })), gap: 30 })}</div>
      <div class="row"><button type="button" class="btn small" data-act="scale">▶ Scale</button></div>
      <div class="eyebrow" style="margin-top:12px">Chords in this key</div>
      <div class="chord-row">${chords.map((c, i) => `<button type="button" class="chord-btn" data-i="${i}"><span class="mono">${c.roman}</span><b>${Theory.pretty(c.sym)}</b></button>`).join('')}</div>
      <p class="muted small">The lit slice of the circle holds the six main chords: three majors outside, three minors inside.${minor ? ' In minor keys the V is often made major (from harmonic minor) for a stronger pull home.' : ' The diminished vii° sits outside the slice.'}</p>`;
    Keyboard.clearMarks(); Keyboard.markPcs(scale.map(Theory.pc), 'hint');
    const playScale = () => Sound.seq(scale.map((x, i) => ({ m: Theory.midi(x), t: i * 0.28, d: 0.3 })));
    info.querySelector('[data-act="scale"]').onclick = playScale;
    info.querySelectorAll('.chord-btn').forEach(b => { b.onclick = () => { const c = chords[+b.dataset.i]; Sound.chord(Theory.voicing(c.root, c.q, 4)); Keyboard.clearMarks(); Keyboard.markPcs(c.notes.map(Theory.pc), 'hint'); }; });
    if (play) playScale();
  }
  paint(false);
  return () => { circle.destroy(); Keyboard.clearMarks(); };
}

/* ---------- Scale finder ---------- */
function toolScales(el) {
  const st = Store.data.settings;
  let root = st.toolScaleRoot || 'C', type = st.toolScaleType || 'major';
  el.innerHTML = `<div class="row tool-controls">${selectHTML('sc-root', 'Root', SPELLED_ROOTS.map(r => [r, r]), root)}${selectHTML('sc-type', 'Scale', Object.keys(Theory.SCALES).map(k => [k, Theory.SCALES[k].name]), type)}</div><div class="tool-out"></div><div class="try"></div>`;
  const out = el.querySelector('.tool-out'), tryEl = el.querySelector('.try');
  let inner = null;
  function paint() {
    if (inner) { inner(); inner = null; } tryEl.innerHTML = '';
    st.toolScaleRoot = root; st.toolScaleType = type; Store.save();
    const notes = Theory.scale(Theory.withOct(root, 4), type, true);
    const rec = Theory.recipe(type);
    const degs = Theory.SCALES[type].degrees.map(d => d.replace(/b/g, '♭').replace(/#/g, '♯'));
    out.innerHTML = `<h2>${root} ${Theory.SCALES[type].name}</h2>${noteChips(notes)}
      <table class="tbl"><tr><th>Steps</th><td class="mono">${rec.map(Theory.stepName).join(' ')} <span class="muted">(${rec.join('-')} half steps)</span></td></tr><tr><th>Degrees</th><td class="mono">${degs.join(' ')}</td></tr></table>
      <div class="art">${Staff.svg({ clef: 'treble', notes, gap: 34 })}</div>
      <div class="hook">${SCALE_HOOKS[type]}</div>
      <div class="row"><button type="button" class="btn small" data-act="play">▶ Play</button><button type="button" class="btn small primary" data-act="try">Play it yourself</button></div>`;
    Keyboard.clearMarks(); Keyboard.markPcs(notes.map(Theory.pc), 'hint');
    out.querySelector('[data-act="play"]').onclick = () => Sound.seq(notes.map((n, i) => ({ m: Theory.midi(n), t: i * 0.3, d: 0.32 })));
    out.querySelector('[data-act="try"]').onclick = () => { if (inner) inner(); inner = Tasks.playSeq(tryEl, { prompt: `Play ${root} ${Theory.SCALES[type].name}, bottom to top.`, notes, steps: true, endText: 'All the way up. Now try it without looking.' }, () => {}); };
  }
  el.querySelector('#sc-root').onchange = e => { root = e.target.value; paint(); };
  el.querySelector('#sc-type').onchange = e => { type = e.target.value; paint(); };
  paint();
  return () => { if (inner) inner(); Keyboard.clearMarks(); };
}

/* ---------- Chord finder ---------- */
function toolChords(el) {
  const st = Store.data.settings;
  let root = st.toolChordRoot || 'C', q = st.toolChordQ || 'maj', inv = 0;
  el.innerHTML = `<div class="row tool-controls">${selectHTML('ch-root', 'Root', SPELLED_ROOTS.map(r => [r, r]), root)}${selectHTML('ch-q', 'Quality', Object.keys(Theory.CHORDS).map(k => [k, Theory.CHORDS[k].name]), q)}</div><div class="tool-out"></div><div class="try"></div>`;
  const out = el.querySelector('.tool-out'), tryEl = el.querySelector('.try');
  let inner = null;
  function paint() {
    if (inner) { inner(); inner = null; } tryEl.innerHTML = '';
    st.toolChordRoot = root; st.toolChordQ = q; Store.save();
    const C = Theory.CHORDS[q], notes = Theory.chordNotes(root, q);
    if (inv >= notes.length) inv = 0;
    const ms = Theory.voicing(root, q, 4, inv);
    /* spell each voiced MIDI note with its chord letter: midi = (octave + 1) × 12 + letter + accidental */
    const staffNotes = ms.map((m, i) => { const n = notes[(i + inv) % notes.length], pn = Theory.parse(n); return Theory.withOct(n, (m - Theory.NAT[pn.L] - pn.acc) / 12 - 1); });
    const bass = inv ? notes[inv] : null;
    const invNames = ['root position', 'first inversion', 'second inversion', 'third inversion'];
    out.innerHTML = `<h2>${Theory.pretty(Theory.symbol(root, q, bass))} <span class="muted small">${root} ${C.name}${inv ? ', ' + invNames[inv] : ''}</span></h2>${noteChips(notes)}
      <table class="tbl"><tr><th>Recipe</th><td class="mono">${C.recipe} half steps</td></tr><tr><th>Degrees</th><td class="mono">${C.degrees.map(d => d.replace(/bb/g, '𝄫').replace(/b/g, '♭').replace(/#/g, '♯')).join(' ')}</td></tr></table>
      <div class="art">${Staff.svg({ clef: 'treble', notes: [staffNotes] })}</div>
      <div class="hook">${CHORD_HOOKS[q]}</div>
      <div class="row">${notes.map((n, i) => `<button type="button" class="btn small${i === inv ? ' primary' : ''}" data-inv="${i}">${i ? n + ' in the bass' : 'Root position'}</button>`).join('')}</div>
      <div class="row"><button type="button" class="btn small" data-act="play">▶ Play</button><button type="button" class="btn small" data-act="arp">▶ One at a time</button><button type="button" class="btn small primary" data-act="try">Play it yourself</button></div>`;
    Keyboard.clearMarks(); ms.forEach(m => Keyboard.mark(m, 'hint'));
    out.querySelector('[data-act="play"]').onclick = () => Sound.chord(ms);
    out.querySelector('[data-act="arp"]').onclick = () => Sound.seq(ms.map((m, i) => ({ m, t: i * 0.35, d: 0.6 })));
    out.querySelectorAll('[data-inv]').forEach(b => { b.onclick = () => { inv = +b.dataset.inv; paint(); Sound.chord(Theory.voicing(root, q, 4, inv)); }; });
    out.querySelector('[data-act="try"]').onclick = () => { if (inner) inner(); inner = Tasks.playChords(tryEl, { prompt: 'Play it on any instrument. With the mic on, Motif listens.', chords: [Theory.symbol(root, q, bass)], tones: true }, () => {}); };
  }
  el.querySelector('#ch-root').onchange = e => { root = e.target.value; inv = 0; paint(); };
  el.querySelector('#ch-q').onchange = e => { q = e.target.value; inv = 0; paint(); };
  paint();
  return () => { if (inner) inner(); Keyboard.clearMarks(); };
}

/* ---------- Progression player ---------- */
function toolProgressions(el) {
  const st = Store.data.settings;
  let pid = st.toolProg || 'pop', key = st.toolProgKey || 'C', bpm = 90;
  el.innerHTML = `<div class="row tool-controls">${selectHTML('pr-id', 'Progression', Theory.PROGRESSIONS.map(p => [p.id, p.name]), pid)}${selectHTML('pr-key', 'Key', Theory.MAJOR_KEYS.slice(0, 12).map(k => [k, k]), key)}<label class="sel" for="pr-bpm"><span>Tempo</span><input id="pr-bpm" type="range" min="50" max="140" step="5" value="${bpm}"></label></div><div class="tool-out"></div><div class="try"></div>`;
  const out = el.querySelector('.tool-out'), tryEl = el.querySelector('.try');
  let inner = null, timers = [];
  const stop = () => { timers.forEach(clearTimeout); timers = []; out.querySelectorAll('.prog-chord').forEach(c => c.classList.remove('on')); Keyboard.clearMarks(); };
  function paint() {
    stop(); if (inner) { inner(); inner = null; } tryEl.innerHTML = '';
    st.toolProg = pid; st.toolProgKey = key; Store.save();
    const P = Theory.PROGRESSIONS.find(p => p.id === pid);
    const tonic = P.mode === 'minor' ? Theory.relMinor(key) : key;
    const chords = Theory.progression(P.romans, tonic, P.mode);
    out.innerHTML = `<h2>${P.name} <span class="muted small">in ${Theory.keyName(tonic, P.mode)}</span></h2>
      <div class="prog">${chords.map((c, i) => `<div class="prog-chord" data-i="${i}"><span class="mono">${c.roman}</span><b>${Theory.pretty(c.sym)}</b></div>`).join('')}</div>
      <p class="muted">Heard in: ${P.songs.join(', ')}.</p>
      <div class="hook">Keep the numbers, change the key: pick another key above and the same numbers give new chord names.</div>
      <div class="row"><button type="button" class="btn small" data-act="play">▶ Play</button><button type="button" class="btn small" data-act="stop">■ Stop</button><button type="button" class="btn small primary" data-act="try">Play it yourself</button></div>`;
    out.querySelector('[data-act="play"]').onclick = () => {
      stop();
      const beat = 60 / bpm, bar = beat * (P.id === 'blues' ? 4 : 2);
      playChordList(chords.map((c, i) => ({ sym: c.sym, t: i * bar, d: bar * 0.95 })));
      chords.forEach((c, i) => timers.push(setTimeout(() => {
        out.querySelectorAll('.prog-chord').forEach((x, k) => x.classList.toggle('on', k === i));
        Keyboard.clearMarks(); Keyboard.markPcs(c.notes.map(Theory.pc), 'hint');
      }, (0.08 + i * bar) * 1000)));
      timers.push(setTimeout(stop, (0.08 + chords.length * bar) * 1000));
    };
    out.querySelector('[data-act="stop"]').onclick = stop;
    out.querySelector('[data-act="try"]').onclick = () => { stop(); if (inner) inner(); inner = Tasks.playChords(tryEl, { prompt: 'Play each chord in turn. Tap the notes together, use MIDI, or play into the mic.', chords: chords.map(c => c.sym), labels: chords.map(c => `${c.roman} · ${Theory.pretty(c.sym)}`), tones: true }, () => {}); };
  }
  el.querySelector('#pr-id').onchange = e => { pid = e.target.value; paint(); };
  el.querySelector('#pr-key').onchange = e => { key = e.target.value; paint(); };
  el.querySelector('#pr-bpm').oninput = e => { bpm = +e.target.value; };
  paint();
  return () => { stop(); if (inner) inner(); };
}

/* ---------- Memory hooks ---------- */
function toolHooks(el) {
  const reached = currentLevel();
  el.innerHTML = `<p class="lead">Every recipe, saying and song anchor from the course. Hooks from levels you have not reached yet are shown faded; peek if you like.</p>
    <div class="hooks">${LEVELS.map(l => `<section class="hook-group${l.n > reached ? ' later' : ''}"><h3><span class="mono">Level ${l.n}</span> ${l.title}</h3>${HOOKS.filter(h => h[0] === l.n).map(h => `<div class="hook"><b>${h[1]}.</b> ${h[2]}</div>`).join('')}</section>`).join('')}</div>`;
}
