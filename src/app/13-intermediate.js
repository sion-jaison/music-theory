/* =================================================================
   Shared pieces for the intermediate section (Levels 6–10)
   Drone and key context, scale degrees by ear, the adaptive Ear Gym,
   motive tools and the Variation Lab, melodic contour, and the
   draft → review → version 2 → compare steps of every project.
   Notation comes from 12-notation.js (Score, MelodyCapture, Tasks.capture).
   ================================================================= */

/* ---------- spelling a MIDI note inside a key ---------- */
/* the scale's own spelling when the note is in the key, otherwise sharps or flats to match the key signature */
function spellIn(m, key, minor) {
  const tonic = Theory.stripOct(key || 'C');
  const sc = Theory.scale(tonic, minor ? 'minor' : 'major');
  const p = mod12(m);
  let name = sc.find(n => Theory.pc(n) === p);
  if (!name) name = Theory.pcName(p, Theory.keySig(tonic, minor ? 'minor' : 'major').n < 0);
  const pn = Theory.parse(name);
  return Theory.withOct(name, (m - Theory.NAT[pn.L] - pn.acc) / 12 - 1);
}
/* notes [{ m, d }] (d in beats) → Score events, spelled in the key */
const motiveEvents = (mot, key) => mot.map(n => ({ d: n.d, p: n.m == null ? null : spellIn(n.m, key), rest: n.m == null, tie: false, tup: 0 }));
/* a picture of a short melody: the full notation engine when it is loaded, else note heads on a staff */
function melodyArt(mot, key, o) {
  o = o || {};
  if (typeof Score !== 'undefined') return Score.svg(motiveEvents(mot, key), Object.assign({ meter: o.meter || '4/4', clef: 'treble', keySig: Theory.keySig(key || 'C').n }, o));
  return Staff.svg({ clef: 'treble', keySig: Theory.keySig(key || 'C').n, filled: true, gap: 34, notes: mot.filter(n => n.m != null).map(n => ({ n: spellIn(n.m, key), acc: false })) });
}
/* notes [{ m, d }] in beats → [{ m, t, d }] in seconds */
const motiveSeq = (mot, bpm) => { const spb = 60 / (bpm || 96); let t = 0; return mot.map(n => { const o = { m: n.m, t: t * spb, d: n.d * spb * 0.92 }; t += n.d; return o; }).filter(n => n.m != null); };

/* ---------- drone and key context ---------- */
/* A soft, sustained tonic and fifth. Drone.bleed(ev) tells a task when a mic note is probably the drone itself. */
const Drone = {
  nodes: null, midi: null,
  start(tonic, oct) {
    this.stop(true);
    const ctx = Sound.ensure(); if (!ctx) return;
    const m = Theory.midi(Theory.withOct(Theory.stripOct(tonic), oct == null ? 2 : oct));
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.6);
    lp.connect(g); g.connect(Sound.master);
    const oscs = [[m, 'sawtooth', 0.22], [m, 'sine', 0.6], [m + 7, 'sine', 0.28], [m + 12, 'sine', 0.18]].map(([mm, type, a]) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = type; o.frequency.value = 440 * Math.pow(2, (mm - 69) / 12); og.gain.value = a;
      o.connect(og); og.connect(lp); o.start();
      return o;
    });
    this.nodes = { g, oscs }; this.midi = m;
  },
  stop(now) {
    if (!this.nodes) return;
    const { g, oscs } = this.nodes, ctx = Sound.ctx, t = ctx.currentTime;
    try { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value || 0.16), t); g.gain.exponentialRampToValueAtTime(0.0001, t + (now ? 0.05 : 0.4)); } catch (e) { /* older browsers */ }
    oscs.forEach(o => { try { o.stop(t + (now ? 0.08 : 0.45)); } catch (e) { /* already stopped */ } });
    this.nodes = null; this.midi = null;
  },
  get on() { return !!this.nodes; },
  /* a mic note on the drone's own pitch classes, at or near its register */
  bleed(ev) { return this.midi != null && ev.source === 'mic' && [0, 7].indexOf(mod12(ev.midi - this.midi)) >= 0 && ev.midi <= this.midi + 19; }
};
/* play I–IV–V–I (or i–iv–V–i) so the ear knows where home is; returns ms */
function playKeyContext(tonic, minor) {
  const chords = Theory.progression(minor ? ['i', 'iv', 'V', 'i'] : ['I', 'IV', 'V', 'I'], Theory.stripOct(tonic), minor ? 'minor' : 'major');
  return playChordList(chords.map((c, i) => ({ sym: c.sym, t: i * 0.62, d: i === 3 ? 1.1 : 0.58 })));
}

/* ---------- scale degrees ---------- */
/* degrees are '1'…'7' plus chromatic 'b2' 'b3' '#4' 'b6' 'b7'; movable-do syllables, with la-based minor left for later */
const DEGREE_SYL = { 1: 'do', b2: 'ra', 2: 're', b3: 'me', 3: 'mi', 4: 'fa', '#4': 'fi', 5: 'sol', b6: 'le', 6: 'la', b7: 'te', 7: 'ti' };
const degreeLabel = d => `${DEGREE_SYL[d]} · ${String(d).replace('b', '♭').replace('#', '♯')}`;
/* where each degree wants to go (functional ear training: hear the pull, then hear it land) */
const DEGREE_RESOLVE = { 1: [], 2: ['1'], 3: [], 4: ['3'], 5: [], 6: ['5'], 7: ['8'], b2: ['1'], b3: ['2', '1'], '#4': ['5'], b6: ['5'], b7: ['6', '5'] };
const degreeSemis = d => Theory.parseDeg(d).semis;
/* the degree of MIDI note m in a major key (null when chromatic and not in the list) */
function degreeOf(m, tonic) {
  const s = mod12(m - Theory.pc(tonic));
  return Object.keys(DEGREE_SYL).find(d => degreeSemis(d) % 12 === s) || null;
}
/* a degree as a MIDI note in a comfortable octave (tonic around C4–B4) */
function degreeMidi(d, tonic, lift) {
  const base = Theory.midi(Theory.withOct(Theory.stripOct(tonic), 4));
  let m = base + degreeSemis(d) + (lift || 0);
  if (base > 66) m -= 12;
  return m;
}

/* Scale degrees by ear.
   p: { keys: ['C','G'…], degrees: ['1','3','5'], rounds, mode: 'name' (hear it, choose) | 'play' (see the syllable, sing or play it),
        drone (default true), context: 'first' | 'each' (play I–IV–V–I before the first or every round), resolve (default true), pass, prompt }
   done(true, { score }) */
Tasks.degreeEar = (el, p, done) => {
  const rounds = p.rounds || 6, pool = p.degrees || ['1', '3', '5'], mode = p.mode || 'name', pass = p.pass || 0;
  let r = 0, score = 0, key = rand(p.keys || ['C']), target = null, timers = [], busy = false, finished = false, droneOn = p.drone !== false, firstTry = true, fresh = true;
  el.innerHTML = `${p.prompt ? `<p class="prompt">${p.prompt}</p>` : ''}<div class="row"><span class="chip live" data-key></span><button type="button" class="btn small" data-act="ctx">▶ Hear the key</button>${mode === 'name' ? '<button type="button" class="btn small" data-act="again">▶ Hear the note</button>' : ''}<button type="button" class="btn small ghost" data-act="drone" aria-pressed="${droneOn}">Drone ${droneOn ? 'on' : 'off'}</button></div>
    <div class="deg-ask big-name" aria-live="polite"></div><div class="progress-dots">${'<span></span>'.repeat(rounds)}</div>
    ${mode === 'name' ? `<div class="choices deg-choices">${pool.map(d => `<button type="button" class="choice" data-d="${d}">${degreeLabel(d)}</button>`).join('')}</div>` : ''}
    <p class="fb info" aria-live="polite">${mode === 'play' ? 'Sing or play it, in any octave. Headphones keep the drone out of the mic.' : ''}</p><div class="row" data-retry hidden><button type="button" class="btn small" data-act="retry">Try again</button></div>`;
  const $ = s => el.querySelector(s), f = $('.fb'), ask = $('.deg-ask'), dots = el.querySelectorAll('.progress-dots span');
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const drone = () => { if (droneOn) Drone.start(key, 2); else Drone.stop(); };
  const playTarget = () => Sound.tone(target.m, null, 1.1, 0.75);
  /* a new key always gets its I–IV–V–I again before the next note */
  function setKey(k) { key = k; fresh = true; $('[data-key]').textContent = 'Key of ' + key + ' major'; drone(); }
  function round() {
    busy = true; firstTry = true;
    const d = rand(pool);
    let m = degreeMidi(d, key, Math.random() < 0.25 ? -12 : 0);
    if (m < 52) m += 12;
    target = { m, d };
    el.querySelectorAll('.choice').forEach(c => { c.className = 'choice'; c.disabled = false; });
    const ctxFirst = p.context === 'each' || fresh;
    fresh = false;
    if (mode === 'name') {
      ask.textContent = '?';
      const wait = ctxFirst ? playKeyContext(key) + 300 : 150;
      later(wait, () => { playTarget(); busy = false; });
    } else {
      ask.textContent = DEGREE_SYL[d];
      if (ctxFirst) later(playKeyContext(key) + 200, () => { busy = false; }); else busy = false;
    }
  }
  function resolveAfter(d) {
    if (p.resolve === false) return 0;
    const path = DEGREE_RESOLVE[d] || [];
    if (!path.length) return 0;
    const notes = [target.m].concat(path.map(x => degreeMidi(x === '8' ? '1' : x, key, 0) + (x === '8' ? 12 : 0) + (target.m - degreeMidi(d, key, 0))));
    return Sound.seq(notes.map((m, i) => ({ m, t: i * 0.45, d: 0.42 })));
  }
  function result(ok, msg) {
    busy = true; const d = target.d;
    dots[r].classList.add(ok ? 'on' : 'miss'); if (ok) score++;
    fb(f, ok ? 'good' : 'bad', msg);
    if (p.onAnswer) p.onAnswer(ok, d);
    const t = resolveAfter(d);
    r++;
    later(Math.max(t, ok ? 900 : 1600) + 300, () => {
      if (r < rounds) { if (p.keys && p.keys.length > 1 && r === Math.ceil(rounds / 2)) setKey(rand(p.keys.filter(k => k !== key)) || key); round(); return; }
      finished = true; Drone.stop();
      if (score >= pass) { fb(f, 'good', `${score} of ${rounds}.${p.passMsg ? ' ' + p.passMsg : ''}`); done(true, { score }); }
      else { fb(f, 'bad', `${score} of ${rounds}. You need ${pass}.`); $('[data-retry]').hidden = false; }
    });
  }
  const pull = d => DEGREE_RESOLVE[d] && DEGREE_RESOLVE[d].length ? ` It leans toward ${DEGREE_SYL[DEGREE_RESOLVE[d][0] === '8' ? '1' : DEGREE_RESOLVE[d][0]]}.` : ' A stable, restful note.';
  const box = $('.deg-choices');
  if (box) box.onclick = ev => {
    const b = ev.target.closest('[data-d]'); if (!b || busy || finished) return;
    el.querySelectorAll('.choice').forEach(c => { c.disabled = true; });
    const ok = b.dataset.d === target.d;
    b.classList.add(ok ? 'right' : 'wrong'); const rb = el.querySelector(`.choice[data-d="${target.d}"]`); if (rb) rb.classList.add('right');
    ask.textContent = DEGREE_SYL[target.d];
    result(ok, `${ok ? 'Yes: ' : 'It was '}${degreeLabel(target.d)} (${spellIn(target.m, key)}).${pull(target.d)}`);
  };
  const off = Bus.on('note', ev => {
    if (mode !== 'play' || busy || finished || Drone.bleed(ev)) return;
    const got = degreeOf(ev.midi, key);
    if (mod12(ev.midi) === mod12(target.m)) result(firstTry, `${firstTry ? 'Yes' : 'There it is'}: ${DEGREE_SYL[target.d]} is ${Theory.stripOct(spellIn(target.m, key))} in ${key}.${pull(target.d)}`);
    else { firstTry = false; fb(f, 'bad', `That is ${got ? DEGREE_SYL[got] : 'outside the key'} (${noteName(ev.midi)}). ${got && degreeSemis(got) % 12 < degreeSemis(target.d) % 12 ? 'Go up.' : 'Go down.'}`); }
  });
  $('[data-act="ctx"]').onclick = () => playKeyContext(key);
  const ag = $('[data-act="again"]'); if (ag) ag.onclick = () => { if (target) playTarget(); };
  $('[data-act="drone"]').onclick = ev => { droneOn = !droneOn; ev.currentTarget.setAttribute('aria-pressed', droneOn); ev.currentTarget.textContent = 'Drone ' + (droneOn ? 'on' : 'off'); drone(); };
  $('[data-act="retry"]').onclick = () => { r = 0; score = 0; finished = false; $('[data-retry]').hidden = true; dots.forEach(d => { d.className = ''; }); drone(); round(); };
  setKey(key); round();
  return () => { off(); timers.forEach(clearTimeout); Drone.stop(true); };
};

/* The intermediate Daily Set tune-in: a drone sets a key; sing or play a three-note degree pattern. */
const TUNE_PATTERNS = [['1', '3', '5'], ['5', '4', '3'], ['7', '1', '2'], ['3', '2', '1'], ['1', '5', '1'], ['6', '5', '3'], ['4', '3', '2'], ['5', '6', '7']];
Tasks.droneTune = (el, p, done) => {
  const key = rand(['C', 'D', 'F', 'G', 'A', 'B♭']), pat = rand(TUNE_PATTERNS);
  let i = 0, finished = false;
  el.innerHTML = `<div class="row"><span class="chip live">Key of ${key} major</span><button type="button" class="btn small" data-act="ctx">▶ Hear the key</button></div><div class="notes-strip seq">${pat.map((d, k) => `<span class="n${k ? '' : ' cur'}" data-k="${k}">${DEGREE_SYL[d]}</span>`).join('')}</div><p class="fb info" aria-live="polite">Sing or play each one, in any octave.</p>`;
  const f = el.querySelector('.fb'), chips = [...el.querySelectorAll('.notes-strip .n')];
  Drone.start(key, 2);
  const t = setTimeout(() => playKeyContext(key), 300);
  el.querySelector('[data-act="ctx"]').onclick = () => playKeyContext(key);
  const off = Bus.on('note', ev => {
    if (finished || Drone.bleed(ev)) return;
    const want = (Theory.pc(key) + degreeSemis(pat[i])) % 12;
    if (mod12(ev.midi) === want) {
      chips[i].classList.remove('cur'); chips[i].classList.add('ok'); chips[i].textContent = `${DEGREE_SYL[pat[i]]} · ${Theory.stripOct(spellIn(ev.midi, key))}`;
      i++;
      if (i >= pat.length) { finished = true; Drone.stop(); fb(f, 'good', `${pat.map(d => DEGREE_SYL[d]).join('-')} in ${key}. Tuned in.`); done(true); }
      else { chips[i].classList.add('cur'); fb(f, 'good', `${i} of ${pat.length}`); }
    } else { const g = degreeOf(ev.midi, key); fb(f, 'bad', `That is ${g ? DEGREE_SYL[g] : noteName(ev.midi)}. Find ${DEGREE_SYL[pat[i]]}.`); }
  });
  return () => { off(); clearTimeout(t); Drone.stop(true); };
};

/* ---------- the Ear Gym: adaptive practice of the weakest unlocked ear skill ----------
   addEarSkill({ id, label, unit (unlocking unit id) or level (unlocked with the level), run(body, finish(ok, total), difficulty 1–5) → cleanup }) */
const EAR_SKILLS = [];
function addEarSkill(s) { if (!EAR_SKILLS.some(x => x.id === s.id)) EAR_SKILLS.push(s); }
const EarGym = {
  stats() { return Store.data.ear || (Store.data.ear = {}); },
  unlocked() {
    /* the beginner levels' ear sparks join as skills of their own */
    LEVELS.forEach(l => { if (l.ear && l.section === 'Beginner' && l.n > 1) addEarSkill({ id: 'lv' + l.n, label: l.ear.title, level: l.n, run: (body, fin) => l.ear.run(body, fin) }); });
    return EAR_SKILLS.filter(s => s.unit ? unitDone(s.unit) : levelPassed(s.level));
  },
  /* lowest accuracy first; a skill never practised counts as 60%; a little randomness keeps it varied */
  pick() {
    const st = this.stats(), list = this.unlocked();
    if (!list.length) return null;
    const accOf = s => { const x = st[s.id]; return x && x.n ? x.ok / x.n : 0.6; };
    return list.map(s => ({ s, k: accOf(s) + Math.random() * 0.15 })).sort((a, b) => a.k - b.k)[0].s;
  },
  run(body, finish) {
    const s = this.pick();
    if (!s) { body.innerHTML = '<p class="fb info">Finish a unit with an ear skill to start the Ear Gym.</p>'; finish(0, 0); return () => {}; }
    const st = this.stats(), x = st[s.id] || (st[s.id] = { diff: 1, n: 0, ok: 0 });
    body.innerHTML = `<div class="row ear-head"><span class="chip live">${s.label}</span><span class="chip">difficulty ${x.diff} of 5</span></div><div class="ear-body"></div>`;
    return s.run(body.querySelector('.ear-body'), (ok, total) => {
      x.n += total; x.ok += ok;
      const rate = total ? ok / total : 0, was = x.diff;
      if (rate >= 0.8) x.diff = Math.min(5, x.diff + 1); else if (rate < 0.5) x.diff = Math.max(1, x.diff - 1);
      Store.save();
      if (x.diff !== was) body.insertAdjacentHTML('beforeend', `<p class="fb ${x.diff > was ? 'good' : 'info'}">${s.label}: difficulty ${was} → ${x.diff}.</p>`);
      finish(ok, total);
    }, x.diff);
  }
};
/* scale degrees by difficulty: 1 3 5 → 1–5 → all seven → all seven in moving keys → with chromatic degrees */
const DEGREE_LADDER = [['1', '3', '5'], ['1', '2', '3', '4', '5'], ['1', '2', '3', '4', '5', '6', '7'], ['1', '2', '3', '4', '5', '6', '7'], ['1', '2', '3', '4', '5', '6', '7', 'b3', 'b7', '#4', 'b6']];
addEarSkill({
  id: 'degrees', label: 'Scale degrees', unit: '6.5',
  run: (body, fin, diff) => Tasks.degreeEar(body, { degrees: DEGREE_LADDER[diff - 1], keys: diff >= 4 ? ['C', 'G', 'F', 'D', 'B♭', 'A', 'E♭', 'E'] : ['C', 'G', 'F'], rounds: 5, context: diff >= 4 ? 'first' : 'each' }, (ok, r) => fin(r.score, 5))
});

/* ---------- motive tools ----------
   A motive is [{ m, d }]: MIDI note (null for a rest) and length in beats. Diatonic tools move by scale steps in the key. */
const Motive = {
  /* scale-step position of a note: index in the key's scale counted across octaves, plus any chromatic offset */
  pos(m, key) {
    const sc = Theory.scale(key).map(Theory.pc), base = Theory.pc(key), rel = m - base;
    const oct = Math.floor(rel / 12), pc = mod12(m);
    let i = sc.indexOf(pc), alt = 0;
    if (i < 0) { i = sc.indexOf(mod12(pc - 1)); alt = 1; }
    return { step: i + 7 * oct, alt };
  },
  at(step, alt, key) {
    const sc = Theory.scale(key).map(n => mod12(Theory.pc(n) - Theory.pc(key)));
    const oct = Math.floor(step / 7), i = ((step % 7) + 7) % 7;
    const semis = sc[i] < sc[0] ? sc[i] + 12 : sc[i];
    return Theory.pc(key) + 12 * oct + semis + (alt || 0);
  },
  map(mot, key, fn) { return mot.map(n => n.m == null ? Object.assign({}, n) : (pp => Object.assign({}, n, { m: Motive.at(fn(pp.step), pp.alt, key) }))(Motive.pos(n.m, key))); },
  sequence(mot, key, steps) { return Motive.map(mot, key, s => s + (steps == null ? 1 : steps)); },
  inversion(mot, key) { const first = mot.find(n => n.m != null); const s0 = first ? Motive.pos(first.m, key).step : 0; return Motive.map(mot, key, s => 2 * s0 - s); },
  retrograde(mot) { return mot.slice().reverse().map(n => Object.assign({}, n)); },
  augmentation(mot) { return mot.map(n => Object.assign({}, n, { d: n.d * 2 })); },
  diminution(mot) { return mot.map(n => Object.assign({}, n, { d: n.d / 2 })); },
  fragment(mot) { return mot.slice(0, Math.max(2, Math.ceil(mot.length / 2))).map(n => Object.assign({}, n)); },
  /* widen the biggest leap by one scale step, moving the notes after it with it */
  expand(mot, key) {
    const ps = mot.map(n => n.m == null ? null : Motive.pos(n.m, key).step);
    let best = -1, size = -1;
    for (let i = 1; i < ps.length; i++) if (ps[i] != null && ps[i - 1] != null && Math.abs(ps[i] - ps[i - 1]) > size) { size = Math.abs(ps[i] - ps[i - 1]); best = i; }
    if (best < 0) return mot.map(n => Object.assign({}, n));
    const dir = ps[best] >= ps[best - 1] ? 1 : -1;
    return mot.map((n, i) => n.m == null || i < best ? Object.assign({}, n) : Object.assign({}, n, { m: Motive.at(Motive.pos(n.m, key).step + dir, Motive.pos(n.m, key).alt, key) }));
  },
  /* same notes, new rhythm: long–short pairs */
  rerhythm(mot) {
    const total = mot.reduce((s, n) => s + n.d, 0);
    const out = mot.map((n, i) => Object.assign({}, n, { d: i % 2 === 0 ? 0.75 : 0.25 }));
    const used = out.reduce((s, n) => s + n.d, 0);
    if (out.length) out[out.length - 1].d += Math.max(0, total - used);
    return out;
  },
  length: mot => mot.reduce((s, n) => s + n.d, 0)
};
const MOTIVE_TOOLS = [
  { id: 'repeat', name: 'Repetition', what: 'Say it again, exactly. Repetition is how a listener learns your idea.', fn: (m) => m.map(n => Object.assign({}, n)) },
  { id: 'sequence', name: 'Sequence', what: 'The same shape, one step higher (or lower). The most common way to develop an idea.', fn: (m, k) => Motive.sequence(m, k, 1) },
  { id: 'inversion', name: 'Inversion', what: 'Turn it upside down: every step up becomes a step down.', fn: (m, k) => Motive.inversion(m, k) },
  { id: 'retrograde', name: 'Retrograde', what: 'Play it backwards, last note first.', fn: (m) => Motive.retrograde(m) },
  { id: 'augmentation', name: 'Augmentation', what: 'Every note twice as long: the idea, slowed down and grander.', fn: (m) => Motive.augmentation(m) },
  { id: 'diminution', name: 'Diminution', what: 'Every note half as long: the idea, hurried.', fn: (m) => Motive.diminution(m) },
  { id: 'fragment', name: 'Fragmentation', what: 'Keep just the start. Short pieces of an idea build momentum.', fn: (m) => Motive.fragment(m) },
  { id: 'expand', name: 'Interval change', what: 'Stretch the biggest leap by one step. Familiar, but new.', fn: (m, k) => Motive.expand(m, k) },
  { id: 'rerhythm', name: 'New rhythm', what: 'Keep the notes, change the rhythm.', fn: (m) => Motive.rerhythm(m) }
];
const DEFAULT_MOTIVE = [{ m: 60, d: 1 }, { m: 62, d: 0.5 }, { m: 64, d: 0.5 }, { m: 67, d: 2 }];
/* a learner's sketch as a motive: from its score if it has one, else from note timing */
function sketchMotive(s, max) {
  if (s && s.score && s.score.events) {
    const out = []; s.score.events.forEach(e => { if (e.tie && out.length) out[out.length - 1].d += e.d; else out.push({ m: e.rest || !e.p ? null : Theory.midi(e.p), d: e.d }); });
    return out.slice(0, max || 8);
  }
  if (!s || !s.notes || !s.notes.length) return null;
  const ns = s.notes.slice(0, max || 6), beat = 0.42;
  return ns.map((n, i) => ({ m: n.m, d: i < ns.length - 1 ? Math.min(2, Math.max(0.5, Math.round((ns[i + 1].t - n.t) / beat * 2) / 2)) : 1 }));
}
/* the key a sketch is in, as a major tonic */
function sketchKey(s) {
  const m = /^\s*([A-Ga-g])(#|♯|b|♭)?/u.exec((s && s.key) || '');
  if (m) return Theory.pretty(m[1].toUpperCase() + (m[2] || ''));
  return s && s.notes && s.notes.length && s.notes.every(n => isBlack(n.m)) ? 'G♭' : 'C';
}

/* The Variation Lab: hear each tool applied to a motive, chain the ones you like, save the phrase.
   p: { motive, key, bpm, need (variations to chain, default 3), fromSketches (offer the learner's sketches), save: { level, tags, prompt } }
   done(true, { sketch }) */
Tasks.variationLab = (el, p, done) => {
  const need = p.need || 3, bpm = p.bpm || 96;
  const mine = p.fromSketches === false ? [] : (Store.data.sketches || []).filter(s => sketchMotive(s)).slice(0, 5);
  let key = p.key || 'C', motive = (p.motive || DEFAULT_MOTIVE).map(n => Object.assign({}, n)), chain = [], from = null, lastTool = null;
  el.innerHTML = `${p.prompt ? `<p class="prompt">${p.prompt}</p>` : ''}
    ${mine.length ? `<div class="vl-pick"><span class="eyebrow">Start from</span><div class="choices">${['<button type="button" class="choice" data-sk="-1" aria-pressed="true">The example motive</button>'].concat(mine.map((s, i) => `<button type="button" class="choice" data-sk="${i}" aria-pressed="false">${esc(s.name)}</button>`)).join('')}</div></div>` : ''}
    <div class="vl-box"><div class="vl-head"><span class="eyebrow">Motive</span><button type="button" class="btn small" data-act="orig">▶ Play</button></div><div class="art vl-orig"></div></div>
    <div class="vl-tools">${MOTIVE_TOOLS.map(t => `<button type="button" class="btn small" data-tool="${t.id}">${t.name}</button>`).join('')}</div>
    <div class="vl-box vl-try" hidden><div class="vl-head"><span class="eyebrow" data-tname></span><button type="button" class="btn small" data-act="var">▶ Play</button><button type="button" class="btn small primary" data-act="add">Add to my phrase</button></div><p class="vl-what"></p><div class="art vl-var"></div></div>
    <div class="vl-box"><div class="vl-head"><span class="eyebrow">My phrase · <span data-count>0</span> of ${need} variations</span><button type="button" class="btn small" data-act="phrase">▶ Play</button><button type="button" class="btn small ghost" data-act="undo">Remove last</button></div><div class="art vl-chain"></div></div>
    <div class="field"><label for="vl-name">Name it</label><input id="vl-name" type="text" maxlength="40" placeholder="e.g. Lantern theme"></div>
    <div class="row"><button type="button" class="btn primary" data-act="save" disabled>Save the phrase</button></div><p class="fb info" aria-live="polite">Try every tool. Keep the ones you like.</p>`;
  const $ = s => el.querySelector(s), f = $('.fb');
  const phrase = () => [motive].concat(chain.map(c => c.notes)).reduce((a, b) => a.concat(b), []);
  let current = null;
  function paint() {
    $('.vl-orig').innerHTML = melodyArt(motive, key);
    $('.vl-chain').innerHTML = melodyArt(phrase(), key);
    $('[data-count]').textContent = chain.length;
    $('[data-act="save"]').disabled = chain.length < need;
    if (chain.length) $('.vl-chain').insertAdjacentHTML('afterbegin', `<p class="vl-trail">${['motive'].concat(chain.map(c => c.name.toLowerCase())).join(' → ')}</p>`);
  }
  el.addEventListener('click', ev => {
    const sk = ev.target.closest('[data-sk]');
    if (sk) {
      el.querySelectorAll('[data-sk]').forEach(b => b.setAttribute('aria-pressed', String(b === sk)));
      const s = +sk.dataset.sk >= 0 ? mine[+sk.dataset.sk] : null;
      from = s ? s.id : null; key = s ? sketchKey(s) : (p.key || 'C'); motive = s ? sketchMotive(s) : (p.motive || DEFAULT_MOTIVE).map(n => Object.assign({}, n));
      chain = []; current = null; $('.vl-try').hidden = true; paint(); Sound.seq(motiveSeq(motive, bpm)); return;
    }
    const tb = ev.target.closest('[data-tool]');
    if (tb) {
      const t = MOTIVE_TOOLS.find(x => x.id === tb.dataset.tool);
      lastTool = t; current = t.fn(motive, key);
      $('.vl-try').hidden = false; $('[data-tname]').textContent = t.name; $('.vl-what').textContent = t.what; $('.vl-var').innerHTML = melodyArt(current, key);
      Sound.seq(motiveSeq(motive, bpm).concat(motiveSeq(current, bpm).map(n => Object.assign(n, { t: n.t + Motive.length(motive) * 60 / bpm + 0.3 }))));
      return;
    }
  });
  $('[data-act="orig"]').onclick = () => Sound.seq(motiveSeq(motive, bpm));
  $('[data-act="var"]').onclick = () => { if (current) Sound.seq(motiveSeq(current, bpm)); };
  $('[data-act="add"]').onclick = () => { if (!current) return; chain.push({ name: lastTool.name, notes: current }); paint(); fb(f, 'good', chain.length >= need ? 'Enough to save. Play the phrase: does it hang together?' : `${need - chain.length} more.`); };
  $('[data-act="undo"]').onclick = () => { chain.pop(); paint(); };
  $('[data-act="phrase"]').onclick = () => Sound.seq(motiveSeq(phrase(), bpm));
  $('[data-act="save"]').onclick = () => {
    const all = phrase(), events = motiveEvents(all, key);
    const sv = p.save || {};
    const s = saveSketch(Object.assign({ name: $('#vl-name').value.trim() || 'Variations on a motive', notes: motiveSeq(all, bpm), score: { meter: '4/4', bpm, keySig: Theory.keySig(key).n, events }, key, level: sv.level, tags: (sv.tags || ['motive development']).concat(chain.map(c => c.name.toLowerCase())), prompt: sv.prompt || 'Variation Lab' }, from ? { from } : {}));
    $('[data-act="save"]').disabled = true; fb(f, 'good', `Saved “${s.name}”: motive, then ${chain.map(c => c.name.toLowerCase()).join(', ')}.`);
    done(true, { sketch: s });
  };
  paint();
  return () => {};
};

/* ---------- melodic contour ---------- */
/* arch, bowl, rising, falling or wave, from a list of MIDI notes */
function contourShape(ms) {
  if (ms.length < 3) return 'flat';
  const first = ms[0], last = ms[ms.length - 1], hi = Math.max.apply(null, ms), lo = Math.min.apply(null, ms);
  const iHi = ms.indexOf(hi), iLo = ms.indexOf(lo), n = ms.length;
  let turns = 0, dir = 0;
  for (let i = 1; i < n; i++) { const d = Math.sign(ms[i] - ms[i - 1]); if (d && dir && d !== dir) turns++; if (d) dir = d; }
  const mid = i => i > 0 && i < n - 1;
  if (turns >= 3 && hi - lo >= 4) return 'wave';
  if (mid(iHi) && hi - first >= 3 && hi - last >= 3) return 'arch';
  if (mid(iLo) && first - lo >= 3 && last - lo >= 3) return 'bowl';
  if (last - first >= 3) return 'rising';
  if (first - last >= 3) return 'falling';
  return 'wave';
}
const CONTOUR_WORDS = { arch: 'Arch: up to a high point, then down', bowl: 'Bowl: down to a low point, then up', rising: 'Rising: it climbs', falling: 'Falling: it descends', wave: 'Wave: up and down more than once', flat: 'Flat' };
/* a line drawing of pitch over time, with the highest note marked */
function contourSVG(notes) {
  const ms = notes.map(n => n.m), lo = Math.min.apply(null, ms) - 2, hi = Math.max.apply(null, ms) + 2, W = 320, H = 110;
  let t = 0; const pts = notes.map(n => { const x = t; t += n.d || 1; return [x, n.m]; });
  const X = x => 12 + x / Math.max(1, t) * (W - 24), Y = m => H - 12 - (m - lo) / Math.max(1, hi - lo) * (H - 24);
  const top = ms.indexOf(Math.max.apply(null, ms));
  return `<svg class="contour" viewBox="0 0 ${W} ${H}" role="img" aria-label="${CONTOUR_WORDS[contourShape(ms)]}"><polyline points="${pts.map(([x, m]) => X(x).toFixed(1) + ',' + Y(m).toFixed(1)).join(' ')}"/>${pts.map(([x, m], i) => `<circle cx="${X(x).toFixed(1)}" cy="${Y(m).toFixed(1)}" r="${i === top ? 5.5 : 3.5}" class="${i === top ? 'peak' : ''}"/>`).join('')}</svg>`;
}

/* ---------- projects: draft, review, version 2, compare ----------
   A project's state lives in Store.data.projects[unitId] = { flavour, seed, draft, v2 } (sketch ids). */
const PROJECT_FLAVOURS = {
  song: { name: 'Song', meter: '4/4', bpm: 92, swing: 0.5, note: 'Pop and singer-songwriter: a steady 4/4, a hook you could sing.' },
  jazz: { name: 'Jazz', meter: '4/4', bpm: 120, swing: 0.62, note: 'Swung eighths, a relaxed walk, room for blue notes.' },
  classical: { name: 'Classical', meter: '6/8', bpm: 72, swing: 0.5, note: 'Lilting 6/8, clear phrases and cadences, a theme that could grow into variations.' },
  film: { name: 'Film & game', meter: '7/8', bpm: 132, swing: 0.5, note: 'A driving odd meter for chase scenes and boss levels.' }
};
const projectOf = id => { const all = Store.data.projects || (Store.data.projects = {}); return all[id] || (all[id] = {}); };
const sketchById = id => (Store.data.sketches || []).find(s => s.id === id);

/* Choose a flavour and a seed sketch. p: { project (unit id), prompt } */
Tasks.projectSetup = (el, p, done) => {
  const pr = projectOf(p.project), mine = (Store.data.sketches || []).slice(0, 6);
  el.innerHTML = `${p.prompt ? `<p class="prompt">${p.prompt}</p>` : ''}<div class="eyebrow">Flavour</div><div class="choices" data-fl>${Object.keys(PROJECT_FLAVOURS).map(k => `<button type="button" class="choice" data-k="${k}" aria-pressed="${pr.flavour === k}">${PROJECT_FLAVOURS[k].name}</button>`).join('')}</div><p class="fl-note muted"></p>
    <div class="eyebrow" style="margin-top:8px">Seed</div><div class="choices" data-seed><button type="button" class="choice" data-s="" aria-pressed="${!pr.seed}">Start fresh</button>${mine.map(s => `<button type="button" class="choice" data-s="${s.id}" aria-pressed="${pr.seed === s.id}">${esc(s.name)}</button>`).join('')}</div>
    <div class="row"><button type="button" class="btn small" data-act="hear" ${pr.seed ? '' : 'disabled'}>▶ Hear the seed</button></div><p class="fb info" aria-live="polite">Pick a flavour to go on.</p>`;
  const f = el.querySelector('.fb'), note = el.querySelector('.fl-note');
  const ready = () => { if (pr.flavour) { fb(f, 'good', `${PROJECT_FLAVOURS[pr.flavour].name}, ${pr.seed ? 'growing “' + esc((sketchById(pr.seed) || {}).name || '') + '”' : 'starting fresh'}.`); Store.save(); done(true); } };
  if (pr.flavour) note.textContent = PROJECT_FLAVOURS[pr.flavour].note;
  el.querySelector('[data-fl]').onclick = ev => { const b = ev.target.closest('[data-k]'); if (!b) return; pr.flavour = b.dataset.k; el.querySelectorAll('[data-k]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); note.textContent = PROJECT_FLAVOURS[pr.flavour].note; ready(); };
  el.querySelector('[data-seed]').onclick = ev => { const b = ev.target.closest('[data-s]'); if (!b) return; pr.seed = b.dataset.s || null; el.querySelectorAll('[data-s]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); el.querySelector('[data-act="hear"]').disabled = !pr.seed; ready(); };
  el.querySelector('[data-act="hear"]').onclick = () => { const s = sketchById(pr.seed); if (s) playSketch(s); };
  if (pr.flavour) ready();
  return () => {};
};

/* Record the draft (or, with version: 2, revise the draft). p: { project, bars, prompt, check, tags, level, version } */
Tasks.projectDraft = (el, p, done) => {
  const pr = projectOf(p.project), fl = PROJECT_FLAVOURS[pr.flavour || 'song'];
  const draft = p.version === 2 ? sketchById(pr.draft) : null;
  const seed = sketchById(pr.seed), key = (draft && draft.key) || (seed && sketchKey(seed)) || 'C';
  const initial = draft && draft.score ? draft.score.events : (seed && seed.score && seed.score.meter === fl.meter ? seed.score.events : null);
  if (p.version === 2 && !draft) { el.innerHTML = '<p class="fb bad">Save a draft first: the step before this one.</p>'; return () => {}; }
  return Tasks.capture(el, {
    prompt: p.prompt + (p.version === 2 && draft && draft.review && draft.review.note ? ` Your note to yourself: “${esc(draft.review.note)}”` : ''),
    meter: fl.meter, bpm: fl.bpm, swing: fl.swing, bars: p.bars || 16, keySig: Theory.keySig(key).n, initial,
    name: draft ? draft.name.replace(/( v2)?$/, ' v2') : '', min: p.min || 12, check: p.check ? (events => p.check(events, key)) : undefined,
    save: { level: p.level, tags: (p.tags || []).concat([fl.name.toLowerCase()]), from: draft ? draft.id : pr.seed || undefined, prompt: p.prompt, key, extra: { version: p.version || 1, project: p.project } }
  }, (ok, r) => { if (r && r.sketch) { pr[p.version === 2 ? 'v2' : 'draft'] = r.sketch.id; Store.save(); } done(true, r); });
};

/* Rate a draft against a rubric and write one sentence about what to change. p: { project, criteria: [{ id, label, help }], prompt } */
const RUBRIC_LEVELS = ['Not yet', 'Getting there', 'Yes'];
Tasks.review = (el, p, done) => {
  const pr = projectOf(p.project), s = sketchById(pr.draft);
  if (!s) { el.innerHTML = '<p class="fb bad">Save a draft first: the step before this one.</p>'; return () => {}; }
  const scores = {};
  el.innerHTML = `${p.prompt ? `<p class="prompt">${p.prompt}</p>` : ''}<div class="row"><button type="button" class="btn small" data-act="play">▶ Play “${esc(s.name)}”</button></div>
    <div class="rubric">${p.criteria.map(c => `<fieldset class="rub" data-c="${c.id}"><legend><b>${c.label}</b><span class="muted small">${c.help}</span></legend><div class="choices">${RUBRIC_LEVELS.map((w, i) => `<button type="button" class="choice" data-v="${i}" aria-pressed="false">${w}</button>`).join('')}</div></fieldset>`).join('')}</div>
    <div class="field"><label for="rv-note">One thing to change in version 2</label><input id="rv-note" type="text" maxlength="140" placeholder="e.g. make bar 7 the high point"></div>
    <div class="row"><button type="button" class="btn primary" data-act="save" disabled>Save my review</button></div><p class="fb info" aria-live="polite">Listen first, then rate each line honestly. Nobody else sees this.</p>`;
  const save = el.querySelector('[data-act="save"]'), note = el.querySelector('#rv-note');
  const check = () => { save.disabled = Object.keys(scores).length < p.criteria.length || !note.value.trim(); };
  el.querySelector('.rubric').onclick = ev => { const b = ev.target.closest('[data-v]'); if (!b) return; const fs = b.closest('[data-c]'); scores[fs.dataset.c] = +b.dataset.v; fs.querySelectorAll('[data-v]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); check(); };
  note.oninput = check;
  el.querySelector('[data-act="play"]').onclick = () => playSketch(s);
  save.onclick = () => {
    s.review = { scores, note: note.value.trim(), at: todayStr() }; Store.save();
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    fb(el.querySelector('.fb'), 'good', `Saved: ${total} of ${p.criteria.length * 2}. Version 2 starts from your draft and your note.`);
    save.disabled = true; done(true, { scores });
  };
  return () => {};
};

/* Play draft and version 2 side by side, pick the stronger one and say why. p: { project, prompt } */
Tasks.compare = (el, p, done) => {
  const pr = projectOf(p.project), a = sketchById(pr.draft), b = sketchById(pr.v2);
  if (!a || !b) { el.innerHTML = '<p class="fb bad">You need a draft and a version 2 first.</p>'; return () => {}; }
  let pick = null;
  el.innerHTML = `${p.prompt ? `<p class="prompt">${p.prompt}</p>` : ''}<div class="ab"><div class="ab-side"><div class="eyebrow">A · draft</div><button type="button" class="btn" data-play="a">▶ Play A</button><button type="button" class="choice" data-pick="a" aria-pressed="false">A is stronger</button></div><div class="ab-side"><div class="eyebrow">B · version 2</div><button type="button" class="btn" data-play="b">▶ Play B</button><button type="button" class="choice" data-pick="b" aria-pressed="false">B is stronger</button></div></div>
    <div class="field"><label for="ab-why">Why, in one sentence</label><input id="ab-why" type="text" maxlength="160"></div><div class="row"><button type="button" class="btn primary" data-act="save" disabled>Save</button></div><p class="fb info" aria-live="polite">Revising does not always win. Saying why is the skill.</p>`;
  const why = el.querySelector('#ab-why'), save = el.querySelector('[data-act="save"]');
  const check = () => { save.disabled = !pick || !why.value.trim(); };
  el.addEventListener('click', ev => {
    const pl = ev.target.closest('[data-play]'); if (pl) playSketch(pl.dataset.play === 'a' ? a : b);
    const pk = ev.target.closest('[data-pick]'); if (pk) { pick = pk.dataset.pick; el.querySelectorAll('[data-pick]').forEach(x => x.setAttribute('aria-pressed', String(x === pk))); check(); }
  });
  why.oninput = check;
  save.onclick = () => {
    b.compare = { winner: pick === 'a' ? a.id : b.id, why: why.value.trim(), at: todayStr() };
    if (pick === 'b' && a.review) { const before = Object.values(a.review.scores).reduce((x, y) => x + y, 0); Store.day().wins.push({ big: 'Version 2', small: `You judged your revision stronger than the draft (draft rubric ${before} of ${Object.keys(a.review.scores).length * 2}). That is the skill that keeps improving your music.` }); }
    Store.save(); save.disabled = true; fb(el.querySelector('.fb'), 'good', 'Saved to the sketchbook with your reason.'); done(true, { winner: pick });
  };
  return () => {};
};
