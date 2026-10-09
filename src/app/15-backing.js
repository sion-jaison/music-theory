/* =================================================================
   Backing styles (tool 7): a small band that plays a chord progression in a style.

   Backing.start(o) → controller          plays now; everything goes through its own gain nodes, so stop() silences
                                          notes already scheduled and setMute() silences one role at once
   Backing.ui(el, o) → { destroy, ctl, … } style picker, tempo, play/stop, mute toggles, the chord now playing
   Backing.arrange(o) → { events, … }     the whole loop as events in beats: pure, so tests (and MIDI export) can read it
   Backing.render(o) → Promise<AudioBuffer> the same band rendered offline (the Transcribe practice track)
   Backing.STYLES, Backing.STYLE_IDS      metadata: { id, name, desc, meter, bpm, swing }

   o: { style ('pop'), chords, key ('C'), mode ('major'), bpm (the style's), meter (the style's), loop (true), bars,
        countIn (bars of clicks first), melody, mute: { drums, bass, chords, melody }, voicing ('quartal' for the main
        comping part), swing (overrides the style's), gate (false: the mic keeps listening), onChord(i, chord),
        onBar(n), onBeat(b), onCount(n), onStart, onStop, onEnd }
   chords, in any of these forms:
     [{ sym: 'Am', beats: 4 }, …]   [{ roman: 'vi', beats: 2 }, …] (with key and mode)   ['Am', 'F', …]   ['vi', 'IV', …]
     Theory.progression(...) objects (one bar each)   a ChordSheet timeline [{ sym, t, d }] in beats (gaps are rests)
   melody: notes [{ m, t, d, v }] in beats, or a sketch (its score, or its notes in seconds at its bpm).
   bpm is quarter notes per minute in every meter, as in Score: 6/8 at 84 has its dotted-quarter beat at 56.
   Roles: drums, bass, chords, melody. Every role has its own gain node under the backing's bus.
   ================================================================= */
const BK_ROLES = ['drums', 'bass', 'chords', 'melody'];
const BK_BASS_LO = 28, BK_BASS_HI = 52;
/* eighths and sixteenths of a 4/4 bar, with louder downbeats */
const bkGrid = (len, step, on, off) => { const out = []; for (let x = 0; x < len - 1e-9; x += step) out.push([+x.toFixed(4), Math.abs(x - Math.round(x)) < 1e-9 ? on : off]); return out; };

/* The styles. Positions are in quarter-note beats from the start of the bar.
   drums: { kick, snare, hat, ohat, ride, rim: [pos | [pos, vel]] }, or a list of such bars that take turns (bossa's clave).
   bass: 'walk' (a walking line, one note a beat), 'drone' (one long note per chord), or [[pos, len, degree, vel]] where
     degree is R (the chord's bass), 5, 8 (octave), 3, 7, or app (a half step from the next chord's bass); a list of
     such bars takes turns.
   comp: one layer or a list. { voicing: 'full'|'shell'|'power'|'quartal', n (voices), range: [lo, hi], sound: 'stab'
     (piano), 'pad' (held, with attack), 'arp' (one voice at a time), hits: [[pos, len, vel]] (arp: [[pos, voice, vel,
     len]]) or a list of bars, or 'change' (one held chord per chord), v (vel for 'change'), attack }. */
const BK_STYLE_LIST = [
  { id: 'pop', name: 'Pop', meter: '4/4', bpm: 100, desc: 'Straight eighths on the hi-hat, a root–fifth bass and a light piano.',
    drums: { hat: bkGrid(4, 0.5, 0.42, 0.3), kick: [[0, 0.85], [2, 0.75], [2.5, 0.55]], snare: [[1, 0.6], [3, 0.6]] },
    bass: [[0, 1.4, 'R'], [1.5, 0.45, 'R', 0.5], [2, 1.4, '5'], [3.5, 0.45, 'R', 0.5]],
    comp: { voicing: 'full', n: 4, range: [52, 76], sound: 'stab', hits: [[0, 1.4, 0.3], [1.5, 0.9, 0.22], [2.5, 0.45, 0.2], [3, 0.9, 0.24]] } },
  { id: 'rock', name: 'Rock', meter: '4/4', bpm: 116, desc: 'Driving eighths: bass on every eighth, power chords held under a hard backbeat.',
    drums: { hat: bkGrid(4, 0.5, 0.5, 0.36), kick: [[0, 0.95], [1.5, 0.6], [2, 0.9], [2.5, 0.6]], snare: [[1, 0.85], [3, 0.85]] },
    bass: bkGrid(4, 0.5, 0.7, 0.55).map(([x, v]) => [x, 0.42, 'R', v]),
    comp: { voicing: 'power', range: [40, 64], sound: 'pad', attack: 0.012, hits: [[0, 1.95, 0.42], [2, 1.95, 0.4]] } },
  { id: 'ballad', name: 'Ballad', meter: '4/4', bpm: 72, desc: 'Sustained pads, a soft kick and cross-stick, the bass on beats 1 and 3.',
    drums: { kick: [[0, 0.5], [2.5, 0.32]], rim: [[1, 0.22], [3, 0.22]], hat: [[0, 0.12], [1, 0.12], [2, 0.12], [3, 0.12]] },
    bass: [[0, 1.9, 'R', 0.6], [2, 1.9, '5', 0.5]],
    comp: [{ voicing: 'full', n: 4, range: [52, 76], sound: 'pad', attack: 0.35, hits: 'change', v: 0.24 },
      { voicing: 'full', n: 4, range: [52, 76], sound: 'stab', hits: [[0, 1.9, 0.2], [2, 1.9, 0.14]] }] },
  { id: 'swing', name: 'Swing', meter: '4/4', bpm: 132, swing: 2 / 3, desc: 'Ride cymbal with swung eighths, a walking bass, shell voicings on 2 and 4 or the Charleston.',
    drums: { ride: [[0, 0.42], [1, 0.5], [1.5, 0.3], [2, 0.42], [3, 0.5], [3.5, 0.3]], hat: [[1, 0.32], [3, 0.32]], kick: [[0, 0.16], [2, 0.12]] },
    bass: 'walk',
    comp: { voicing: 'shell', n: 3, range: [50, 72], sound: 'stab', hits: [[[1, 0.55, 0.3], [3, 0.55, 0.26]], [[0, 1.2, 0.3], [1.5, 0.6, 0.26]]] } },
  { id: 'bossa', name: 'Bossa nova', meter: '4/4', bpm: 128, desc: 'A clave on the rim, a two-feel bass (root and fifth) and syncopated guitar-style chords.',
    drums: [{ rim: [[0, 0.4], [1.5, 0.4], [3, 0.4]], hat: bkGrid(4, 0.5, 0.18, 0.13), kick: [[0, 0.5], [1.5, 0.3], [2, 0.5], [3.5, 0.3]] },
      { rim: [[1, 0.4], [2.5, 0.4]], hat: bkGrid(4, 0.5, 0.18, 0.13), kick: [[0, 0.5], [1.5, 0.3], [2, 0.5], [3.5, 0.3]] }],
    bass: [[0, 1.45, 'R'], [1.5, 2, '5', 0.55], [3.5, 0.45, 'R', 0.5]],
    comp: { voicing: 'full', n: 4, range: [52, 74], sound: 'stab', hits: [[[0, 0.9, 0.26], [1.5, 0.4, 0.2], [3, 0.9, 0.24]], [[1, 0.4, 0.2], [2.5, 0.9, 0.24]]] } },
  { id: 'waltz', name: 'Waltz', meter: '3/4', bpm: 138, desc: 'Three in a bar: bass on 1 (root, then fifth), chords on 2 and 3.',
    drums: { kick: [[0, 0.45]], hat: [[1, 0.26], [2, 0.26]] },
    bass: [[[0, 0.9, 'R']], [[0, 0.9, '5']]],
    comp: { voicing: 'full', n: 3, range: [55, 76], sound: 'stab', hits: [[1, 0.5, 0.26], [2, 0.5, 0.22]] } },
  { id: 'ballad68', name: '6/8 ballad', meter: '6/8', bpm: 84, desc: 'Two dotted-quarter beats a bar: a rolling piano in eighths over a held pad.',
    drums: { kick: [[0, 0.5]], rim: [[1.5, 0.3]], hat: [[0, 0.2], [0.5, 0.12], [1, 0.12], [1.5, 0.18], [2, 0.12], [2.5, 0.12]] },
    bass: [[0, 1.4, 'R'], [1.5, 1.4, '5', 0.55]],
    comp: [{ voicing: 'full', n: 4, range: [52, 76], sound: 'pad', attack: 0.25, hits: 'change', v: 0.16 },
      { voicing: 'full', n: 4, range: [52, 76], sound: 'arp', hits: [[0, 0, 0.24], [0.5, 1, 0.18], [1, 2, 0.18], [1.5, 3, 0.2], [2, 2, 0.18], [2.5, 1, 0.18]] }] },
  { id: 'odd54', name: '5/4 groove', meter: '5/4', bpm: 120, desc: 'Five beats grouped 3 + 2: kick on 1 and 4, snare closing each group.',
    drums: { kick: [[0, 0.8], [3, 0.65]], snare: [[2, 0.5], [4, 0.55]], hat: bkGrid(5, 0.5, 0.34, 0.24).map(([x, v]) => [x, x === 0 || x === 3 ? 0.44 : v]) },
    bass: [[0, 2.4, 'R'], [3, 1.4, '5'], [4.5, 0.45, 'app', 0.5]],
    comp: { voicing: 'full', n: 4, range: [52, 76], sound: 'stab', hits: [[0, 1.4, 0.28], [1.5, 1.4, 0.2], [3, 0.9, 0.26], [4, 0.9, 0.2]] } },
  { id: 'odd78', name: '7/8 groove', meter: '7/8', bpm: 160, desc: 'Seven eighths grouped 2 + 2 + 3, with the long group last.',
    drums: { kick: [[0, 0.8], [2, 0.7]], snare: [[1, 0.5], [3, 0.45]], hat: bkGrid(3.5, 0.5, 0.26, 0.26).map(([x, v]) => [x, x === 0 || x === 1 || x === 2 ? 0.4 : v]) },
    bass: [[0, 0.9, 'R'], [1, 0.9, '5', 0.55], [2, 1.4, 'R']],
    comp: { voicing: 'full', n: 4, range: [52, 76], sound: 'stab', hits: [[0, 0.9, 0.28], [1, 0.9, 0.2], [2, 1.4, 0.26]] } },
  { id: 'funk', name: 'Funk', meter: '4/4', bpm: 100, desc: 'Sixteenths on the hi-hat, ghost notes on the snare and a syncopated bass.',
    drums: { hat: bkGrid(4, 0.25, 0.34, 0.16).map(([x, v]) => [x, Math.abs(x * 2 - Math.round(x * 2)) < 1e-9 ? Math.max(v, 0.26) : v]),
      kick: [[0, 0.9], [0.75, 0.55], [2.5, 0.75]], snare: [[1, 0.75], [1.75, 0.12], [3, 0.75], [3.25, 0.12], [3.75, 0.16]] },
    bass: [[0, 0.4, 'R', 0.8], [0.75, 0.2, '8', 0.55], [1.5, 0.3, 'R', 0.6], [2.5, 0.25, '5', 0.65], [2.75, 0.2, '7', 0.5], [3.5, 0.25, '8', 0.55], [3.75, 0.2, 'app', 0.5]],
    comp: { voicing: 'full', n: 3, range: [60, 79], sound: 'stab', hits: [[0.5, 0.15, 0.26], [1.75, 0.15, 0.2], [2.5, 0.15, 0.24], [3.75, 0.15, 0.18]] } },
  { id: 'ambient', name: 'Ambient', meter: '4/4', bpm: 70, desc: 'Long pads with a slow attack over a low drone, no drums: for modal and quartal colours.',
    drums: null, bass: 'drone',
    comp: { voicing: 'full', n: 4, range: [50, 79], sound: 'pad', attack: 1.6, hits: 'change', v: 0.3 } }
];
const BK_STYLES = {};
BK_STYLE_LIST.forEach(s => { BK_STYLES[s.id] = s; });

/* ---------- chords in ---------- */
/* a symbol, a Roman numeral (in key and mode) or a chord object → { sym, roman, root, q, bass, rootPc, bassPc, pcs } or null */
function bkChord(x, key, mode) {
  if (x == null) return null;
  let sym = null, roman = null;
  if (typeof x === 'string') { const s = x.trim(); if (/^[A-G]/.test(s)) sym = s; else roman = s; }
  else { sym = x.sym || null; roman = x.roman || null; }
  try {
    if (!sym && roman) sym = Theory.romanChord(roman, key || 'C', mode === 'minor' ? 'minor' : 'major').sym;
    if (!sym) return null;
    const c = Theory.parseChord(sym), rootPc = Theory.pc(c.root);
    return { sym, roman, root: c.root, q: c.q, bass: c.bass, rootPc, bassPc: c.bass ? Theory.pc(c.bass) : rootPc, pcs: Theory.chordPcs(c.root, c.q) };
  } catch (e) { return null; }
}
/* any of the accepted chord lists → { chords: [{ …chord, t, d, idx }] in beats, len (whole bars), M, barLen }.
   idx is the position in the list given (onChord reports it). */
function bkTimeline(list, o) {
  const M = Score.meter(o.meter || '4/4'), barLen = M.barLen, out = [];
  const items = list || [];
  const timed = items.some(x => x && typeof x === 'object' && typeof x.t === 'number');
  let end = 0;
  if (timed) {
    const sorted = items.map((x, idx) => ({ x, idx })).filter(e => e.x && typeof e.x.t === 'number').sort((a, b) => a.x.t - b.x.t);
    sorted.forEach((e, k) => {
      const x = e.x, next = sorted[k + 1], d = x.d != null ? x.d : next ? next.x.t - x.t : barLen;
      const c = bkChord(x, x.key || o.key, x.mode || o.mode);
      if (c && d > 0) out.push(Object.assign(c, { t: x.t, d, idx: e.idx }));
      end = Math.max(end, x.t + d);
    });
  } else {
    items.forEach((x, idx) => {
      const beats = x && typeof x === 'object' && (x.beats || x.d) ? (x.beats || x.d) : (o.beats || barLen);
      const c = bkChord(x, o.key, o.mode);
      if (c) out.push(Object.assign(c, { t: end, d: beats, idx }));
      end += beats;
    });
  }
  return { chords: out, len: Math.max(barLen, Math.ceil(end / barLen - 1e-9) * barLen), M, barLen };
}
/* a melody: notes in beats, or a sketch → notes in beats */
function bkMelody(mel) {
  if (!mel) return [];
  if (Array.isArray(mel)) return mel.filter(n => n && n.m != null).map(n => ({ m: n.m, t: +n.t || 0, d: n.d || 0.5, v: n.v }));
  if (mel.score && mel.score.events) {
    try { return Score.toNotes(mel.score.events, { bpm: 60, meter: mel.score.meter, swing: mel.score.swing }).map(n => ({ m: n.m, t: n.t, d: n.d })); } catch (e) { /* fall back to the notes */ }
  }
  const k = (mel.bpm || 90) / 60;
  return (mel.notes || []).map(n => ({ m: n.m, t: n.t * k, d: (n.d || 0.4) * k, v: n.v }));
}

/* ---------- voicing: smooth, nearest-note voice leading ---------- */
const bkDegN = d => +String(d).replace(/[^0-9]/g, '');
/* the chord's pitch classes to voice, most important first: 3rd (or sus), 7th (or 6th), top extension, root, 5th */
function bkTones(c, how) {
  const degs = Theory.CHORDS[c.q].degrees, pcs = Theory.chordNotes(c.root, c.q).map(Theory.pc);
  const pick = test => { for (let i = 0; i < degs.length; i++) if (test(bkDegN(degs[i]))) return pcs[i]; return null; };
  const root = pcs[0], fifth = pick(n => n === 5);
  let third = pick(n => n === 3); if (third == null) third = pick(n => n === 2 || n === 4);
  let sev = pick(n => n === 7); if (sev == null) sev = pick(n => n === 6);
  const ext = degs.map((d, i) => bkDegN(d) >= 9 ? pcs[i] : null).filter(x => x != null).reverse();
  const uniq = a => a.filter((x, i) => x != null && a.indexOf(x) === i);
  if (how === 'power') return [root, fifth == null ? root : fifth];
  if (how === 'shell') return uniq([third, sev, ext[0], sev == null ? fifth : null, root]).slice(0, 3);
  return uniq([third, sev, ext[0], root, fifth].concat(ext.slice(1)).concat(pcs)).slice(0, 4);
}
/* every way to put these pitch classes in [lo, hi] as sorted MIDI lists, doubling the root or the 5th when there are
   more voices than tones: close and open positions within a 10th, no minor 2nd between the top two voices */
function bkCandidates(pcs, n, lo, hi, root, fifth) {
  const base = pcs.slice(0, n), extra = n - base.length;
  const fills = extra <= 0 ? [[]] : [root, fifth].concat(pcs).filter((p, i, a) => p != null && a.indexOf(p) === i).slice(0, 2).map(p => Array(extra).fill(p));
  const seen = new Set(), all = [];
  fills.forEach(fill => {
    const use = base.concat(fill);
    const opts = use.map(pc => { const a = []; for (let m = lo; m <= hi; m++) if (mod12(m) === pc) a.push(m); return a; });
    (function rec(i, acc) {
      if (i === use.length) { const s = acc.slice().sort((a, b) => a - b), k = s.join(','); if (!seen.has(k)) { seen.add(k); all.push(s); } return; }
      opts[i].forEach(m => { if (acc.indexOf(m) < 0) { acc.push(m); rec(i + 1, acc); acc.pop(); } });
    })(0, []);
  });
  const good = all.filter(s => s[s.length - 1] - s[0] <= (n > 3 ? 16 : 12) && (s.length < 2 || s[s.length - 1] - s[s.length - 2] >= 2));
  return good.length ? good : all;
}
/* the voicing that moves least from prev (sum of each voice's move, then the largest move), drifting little from centre */
function bkNearest(cands, prev, centre) {
  let best = null, bestCost = Infinity;
  cands.forEach(s => {
    const mean = s.reduce((a, b) => a + b, 0) / s.length;
    let cost;
    if (prev && prev.length === s.length) {
      let sum = 0, mx = 0;
      s.forEach((m, i) => { const d = Math.abs(m - prev[i]); sum += d; mx = Math.max(mx, d); });
      cost = sum + 0.6 * Math.max(0, mx - 2) + 0.15 * Math.abs(mean - centre);
    } else cost = Math.abs(mean - (prev && prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : centre)) + 0.3 * (s[s.length - 1] - s[0]);
    if (cost < bestCost - 1e-9) { bestCost = cost; best = s; }
  });
  return best;
}
/* stacked 4ths: from the root for minor-type and sus chords, from the 3rd for major and dominant chords */
function bkQuartal(c, n, lo, hi, prev, centre) {
  const minorish = ['min', 'm7', 'm6', 'm9', 'm11', 'madd9', 'mMaj7', 'sus2', 'sus4', '7sus4'].indexOf(c.q) >= 0;
  const t = bkTones(c, 'full'), start = minorish ? c.rootPc : t[0];
  const ref = prev && prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : centre;
  let best = null;
  for (let b = lo; b <= hi; b++) {
    if (mod12(b) !== start) continue;
    const s = []; for (let i = 0; i < n; i++) s.push(b + 5 * i);
    if (s[n - 1] > hi + 4) continue;
    const mean = s.reduce((a, x) => a + x, 0) / n;
    if (!best || Math.abs(mean - ref) < Math.abs(best.mean - ref)) best = { s, mean };
  }
  return best ? best.s : Theory.voicing(c.root, c.q, 4);
}
/* one voicing per chord, each as near as possible to the one before. how: 'full' | 'shell' | 'power' | 'quartal'.
   With loop, the first chord is voiced again from the last so the loop joins smoothly. */
function bkVoiceLead(chords, how, n, range, loop) {
  const lo = range ? range[0] : 52, hi = range ? range[1] : 76, centre = (lo + hi) / 2 - 1;
  n = n || (how === 'shell' ? 3 : 4);
  const one = (c, prev) => {
    if (how === 'power') {
      const ref = prev ? prev[0] : lo + 6;
      let r = null; for (let m = lo; m <= hi - 12; m++) if (mod12(m) === c.rootPc && (r == null || Math.abs(m - ref) < Math.abs(r - ref))) r = m;
      if (r == null) r = lo + mod12(c.rootPc - lo);
      return [r, r + 7, r + 12];
    }
    if (how === 'quartal') return bkQuartal(c, n, lo, hi, prev, centre);
    const t = bkTones(c, how), degs = Theory.CHORDS[c.q].degrees, pcs = Theory.chordNotes(c.root, c.q).map(Theory.pc);
    const fifth = degs.findIndex(d => bkDegN(d) === 5);
    return bkNearest(bkCandidates(t, n, lo, hi, c.rootPc, fifth >= 0 ? pcs[fifth] : null), prev, centre);
  };
  let out = [], prev = null;
  chords.forEach(c => { prev = one(c, prev); out.push(prev); });
  if (loop && chords.length > 1) {
    prev = out[out.length - 1]; const again = [];
    chords.forEach(c => { prev = one(c, prev); again.push(prev); });
    out = again;
  }
  return out;
}

/* ---------- bass ---------- */
/* the MIDI note of pitch class pc nearest ref, within lo–hi */
function bkNear(pc, ref, lo, hi) {
  let best = null;
  for (let m = lo; m <= hi; m++) if (mod12(m) === mod12(pc) && (best == null || Math.abs(m - ref) < Math.abs(best - ref))) best = m;
  return best == null ? lo + mod12(pc - lo) : best;
}
/* a chord degree for the bass: R (the bass note of the chord), 5, 8, 3, 7 (5 when there is none) */
function bkBassDeg(c, deg, R) {
  const degs = Theory.CHORDS[c.q].degrees, pcs = c.pcs;
  const find = n => { const i = degs.findIndex(d => bkDegN(d) === n); return i >= 0 ? pcs[i] : null; };
  if (deg === '8') return R + 12 <= BK_BASS_HI + 7 ? R + 12 : R;
  let pc = deg === '3' ? find(3) : deg === '7' ? find(7) : find(5);
  if (pc == null) pc = find(5);
  if (pc == null) return R;
  const up = R + mod12(pc - R);
  return up <= BK_BASS_HI + 3 ? up : up - 12;
}
/* a half step from the next chord's bass note, on the side nearer the note before it */
function bkApproach(T, from) {
  const a = T - 1, b = T + 1;
  const pick = Math.abs(a - from) <= Math.abs(b - from) ? a : b;
  return pick === from ? (pick === a ? b : a) : pick;
}
/* A walking line over one chord: one note a beat, the root first and, on the last beat, a half step (or, when that
   would repeat the note before, a whole step) into the next chord's bass. Chord tones in between, heading for it. */
function bkWalk(c, nx, beats, prev) {
  const R = bkNear(c.bassPc, prev == null ? 40 : prev, BK_BASS_LO, BK_BASS_HI - 4);
  const k = Math.max(1, Math.floor(beats + 1e-9));
  if (k === 1) return [R];
  const T = nx ? bkNear(nx.bassPc, R, BK_BASS_LO, BK_BASS_HI) : null;
  const tones = c.pcs.filter(p => p !== c.bassPc);
  const line = dir => {
    const out = [R];
    let cur = R;
    for (let i = 1; i < k - 1; i++) {
      let best = null;
      for (let s = 1; s <= 7; s++) { const m = cur + dir * s; if (tones.indexOf(mod12(m)) >= 0 || mod12(m) === mod12(c.bassPc)) { best = m; break; } }
      cur = best == null ? cur + dir * 2 : best;
      out.push(cur);
    }
    if (T == null) out.push(bkBassDeg(c, '5', R));
    else {
      let a = bkApproach(T, cur);
      if (a === cur) a = T + (cur > T ? 2 : -2);
      out.push(a);
    }
    return out;
  };
  const dirUp = T == null ? (R < 40 ? 1 : -1) : (T >= R ? 1 : -1);
  let ln = line(dirUp);
  if (ln.some(m => m < BK_BASS_LO || m > BK_BASS_HI + 3)) { const other = line(-dirUp); if (!other.some(m => m < BK_BASS_LO || m > BK_BASS_HI + 3)) ln = other; }
  return ln;
}

/* ---------- arranging ---------- */
const bkHit = h => Array.isArray(h) ? h : [h, null];
/* a pattern, or a list of bar patterns that take turns: drums as a list of objects, bass and hits as a list of hit lists */
function bkBarsOf(pat, n) {
  if (!Array.isArray(pat) || !pat.length) return pat;
  const f = pat[0], bars = (!Array.isArray(f) && typeof f === 'object') || (Array.isArray(f) && Array.isArray(f[0]));
  return bars ? pat[n % pat.length] : pat;
}
/* swing: an off-beat eighth (x.5 of a beat) moves to x + sw */
function bkSwing(x, sw) {
  if (!sw || Math.abs(sw - 0.5) < 1e-3) return x;
  const b = Math.floor(x + 1e-9);
  return Math.abs(x - b - 0.5) < 1e-6 ? b + sw : x;
}
/* patterns for a meter the style was not written for: kick on the first beat (and the accents), snare on the other
   beats, the style's own cymbal on every eighth, bass on the first beat and the accents, chords on every beat */
function bkGeneric(st, M) {
  const g = M.groups, s = M.starts, acc = (M.accents || [0]).map(i => s[i]).filter(x => x != null);
  const cym = st.drums && (st.drums.ride || (st.drums[0] && st.drums[0].ride)) ? 'ride' : 'hat';
  const drums = st.drums ? { kick: acc.map((x, i) => [x, i ? 0.6 : 0.8]), snare: s.filter(x => acc.indexOf(x) < 0).map(x => [x, 0.45]) } : null;
  if (drums) drums[cym] = bkGrid(M.barLen, 0.5, 0.36, 0.26);
  const bass = st.bass === 'walk' || st.bass === 'drone' ? st.bass : acc.map((x, i) => { const nx = acc[i + 1] != null ? acc[i + 1] : M.barLen; return [x, (nx - x) * 0.9, i ? '5' : 'R']; });
  const layers = [].concat(st.comp || []).map(L => L.hits === 'change' || L.sound === 'arp' ? L : Object.assign({}, L, { hits: s.map((x, i) => [x, g[i] * 0.85, i ? 0.2 : 0.28]) }));
  return { drums, bass, comp: layers };
}
/* The whole loop as events, in beats from the start:
   { style, M, barLen, bars, len, chords, changes: [{ t, idx, chord }], events: [{ role, kind, t, d, m, ms, v, attack, bar }] }
   kinds: drums kick snare hat ohat ride rim; bass bass; chords stab pad arp; melody note. Pure: no sound. */
function bkArrange(o) {
  o = o || {};
  const st = BK_STYLES[o.style] || BK_STYLES.pop;
  const meter = o.meter || st.meter;
  const tl = bkTimeline(o.chords, { meter, key: o.key, mode: o.mode, beats: o.beats });
  const M = tl.M, barLen = tl.barLen, chords = tl.chords, loop = o.loop !== false;
  const mel = bkMelody(o.melody), melEnd = mel.reduce((e, n) => Math.max(e, n.t + n.d), 0);
  const len = Math.max(tl.len, Math.ceil(melEnd / barLen - 1e-9) * barLen), bars = Math.round(len / barLen);
  const native = Score.meter(st.meter).spec === M.spec;
  const pat = native ? { drums: st.drums, bass: st.bass, comp: [].concat(st.comp || []) } : bkGeneric(st, M);
  const sw = o.swing != null ? o.swing : (st.swing || 0.5), swing = M.den >= 8 ? 0.5 : sw;
  const chordLen = tl.len;
  const events = [];
  /* the chord sounding at beat t of the loop (the chord list repeats under a longer melody) */
  const at = t => { const x = chordLen ? ((t % chordLen) + chordLen) % chordLen : 0, base = t - x; for (const c of chords) if (x >= c.t - 1e-6 && x < c.t + c.d - 1e-6) return { c, start: base + c.t, end: base + c.t + c.d }; return null; };
  const nextOf = c => { const i = chords.indexOf(c); return chords[i + 1] || (loop ? chords[0] : null); };
  const layers = pat.comp.map((L, li) => {
    const how = li === 0 && o.voicing ? o.voicing : L.voicing;
    return { L, how, voicings: chords.length ? bkVoiceLead(chords, how, L.n, L.range, loop) : [] };
  });
  const voiceOf = (layer, c) => layer.voicings[chords.indexOf(c)];
  /* drums */
  if (pat.drums) {
    for (let b = 0; b < bars; b++) {
      const bp = bkBarsOf(pat.drums, b) || {};
      Object.keys(bp).forEach(kind => (bp[kind] || []).forEach(h => {
        const [x, v] = bkHit(h);
        events.push({ role: 'drums', kind, t: b * barLen + bkSwing(x, swing), d: 0.1, v: v == null ? 0.5 : v, bar: b });
      }));
    }
  }
  /* bass */
  if (pat.bass === 'walk') {
    let prev = null;
    for (let rep = 0; rep * chordLen < len; rep++) chords.forEach(c => {
      const t0 = rep * chordLen + c.t; if (t0 >= len) return;
      bkWalk(c, nextOf(c), Math.min(c.d, len - t0), prev).forEach((m, i) => { prev = m; events.push({ role: 'bass', kind: 'bass', t: t0 + i, d: 0.9, m, v: i ? 0.62 : 0.72, bar: Math.floor((t0 + i) / barLen) }); });
    });
  } else if (pat.bass === 'drone') {
    let prev = 38;
    for (let rep = 0; rep * chordLen < len; rep++) chords.forEach(c => {
      const t0 = rep * chordLen + c.t; if (t0 >= len) return;
      prev = bkNear(c.bassPc, prev, 31, 47);
      events.push({ role: 'bass', kind: 'bass', t: t0, d: Math.min(c.d, len - t0), m: prev, v: 0.42, bar: Math.floor(t0 / barLen) });
    });
  } else if (pat.bass) {
    let prev = 40;
    for (let b = 0; b < bars; b++) {
      (bkBarsOf(pat.bass, b) || []).forEach(h => {
        const [x, d, deg, v] = h, t = b * barLen + bkSwing(x, swing), here = at(t);
        if (!here) return;
        const c = here.c, R = bkNear(c.bassPc, prev, BK_BASS_LO, BK_BASS_HI - 2);
        let m;
        if (deg === 'app') {
          const nx = here.end - t <= 1 + 1e-6 ? nextOf(c) : null;
          m = nx ? bkApproach(bkNear(nx.bassPc, R, BK_BASS_LO, BK_BASS_HI), prev) : bkBassDeg(c, '5', R);
        } else if (c.bass) m = deg === '8' ? bkBassDeg(c, '8', R) : R;   /* an inversion: the bass stays on its note */
        else m = deg === 'R' ? R : bkBassDeg(c, deg, R);
        if (deg === 'R') prev = R;
        events.push({ role: 'bass', kind: 'bass', t, d: Math.max(0.1, Math.min(d, here.end - t)), m, v: v == null ? 0.66 : v, bar: b });
      });
    }
  }
  /* chords */
  layers.forEach(layer => {
    const L = layer.L;
    if (L.hits === 'change') {
      for (let rep = 0; rep * chordLen < len; rep++) chords.forEach(c => {
        const t0 = rep * chordLen + c.t; if (t0 >= len) return;
        events.push({ role: 'chords', kind: L.sound || 'pad', t: t0, d: Math.min(c.d, len - t0), ms: voiceOf(layer, c), v: L.v || 0.28, attack: L.attack, bar: Math.floor(t0 / barLen) });
      });
      return;
    }
    for (let b = 0; b < bars; b++) {
      const hits = (bkBarsOf(L.hits, b) || []).map(h => ({ x: bkSwing(h[0], swing), h }));
      /* a chord that changes inside the bar and has no hit near its start gets one, so the change is heard */
      if (L.sound !== 'arp') chords.forEach(c => {
        for (let rep = 0; rep * chordLen < len; rep++) {
          const t0 = rep * chordLen + c.t - b * barLen;
          if (t0 > 1e-6 && t0 < barLen - 1e-6 && !hits.some(e => Math.abs(e.x - t0) < 0.3)) {
            const nextHit = hits.filter(e => e.x > t0).map(e => e.x)[0];
            hits.push({ x: t0, h: [t0, Math.min(1, (nextHit == null ? barLen : nextHit) - t0) * 0.9, 0.24] });
          }
        }
      });
      hits.forEach(({ x, h }) => {
        const t = b * barLen + x, here = at(t + 1e-6); if (!here) return;
        const ms = voiceOf(layer, here.c); if (!ms) return;
        if (L.sound === 'arp') {
          const m = ms[Math.min(h[1], ms.length - 1)];
          events.push({ role: 'chords', kind: 'arp', t, d: Math.min(h[3] || 0.5, here.end - t), m, ms: [m], v: h[2] == null ? 0.2 : h[2], bar: b });
        } else events.push({ role: 'chords', kind: L.sound || 'stab', t, d: Math.max(0.1, Math.min(h[1], here.end - t)), ms, v: h[2] == null ? 0.26 : h[2], attack: L.attack, bar: b });
      });
    }
  });
  /* melody */
  mel.forEach(n => { if (n.t < len) events.push({ role: 'melody', kind: 'note', t: n.t, d: n.d, m: n.m, v: n.v || 0.75, bar: Math.floor(n.t / barLen) }); });
  events.sort((a, b) => a.t - b.t);
  const changes = [];
  for (let rep = 0; rep * chordLen < len; rep++) chords.forEach(c => { const t = rep * chordLen + c.t; if (t < len) changes.push({ t, idx: c.idx, chord: c }); });
  return { style: st, M, barLen, bars, len, chords, changes, events, swing, voicings: layers.length ? layers[0].voicings : [] };
}

/* ---------- playing ---------- */
/* one event into the Sound methods, at audio time `when` with seconds per beat spb */
function bkSound(e, when, spb) {
  const d = Math.max(0.05, e.d * spb);
  if (e.role === 'drums') {
    if (e.kind === 'ohat') Sound.hat(when, e.v, true);
    else if (Sound[e.kind]) Sound[e.kind](when, e.v);
  } else if (e.role === 'bass') Sound.bass(e.m, when, d * 0.95, e.v);
  else if (e.role === 'chords') {
    if (e.kind === 'pad') Sound.pad(e.ms, when, d, e.v * 1.4, e.attack);
    else if (e.kind === 'arp') Sound.tone(e.m, when, Math.max(0.15, d * 1.6), e.v * 1.5);
    else Sound.chord(e.ms, when, d * 0.92, e.v * 1.6);
  } else Sound.tone(e.m, when, d * 0.95, e.v);
}

/* Backing.start(o) → { stop(), setMute(role, on), setChords(list), setTempo(bpm), setStyle(id), playing, cur, bar,
   bpm, style, arrangement, startT, spb, time(beat), muted }
   cur: idx of the chord playing now. bar: the bar playing now (counting from 0; count-in bars are negative).
   startT: audio time of beat 1 of bar 0; time(beat) → audio time of that beat of the first pass (tempo changes aside).
   setMute(role, true) silences that role at once (its gain falls to 0) and stops scheduling it; false brings it back
   from the next note. setChords/setTempo/setStyle take effect from the next bar that is not yet scheduled. */
function bkStart(o) {
  o = Object.assign({}, o || {});
  const ctl = { playing: false, cur: -1, bar: -1, bpm: 0, style: null, arrangement: null, startT: 0, muted: {} };
  const ctx = Sound.ensure();
  let arr = bkArrange(o);
  ctl.style = arr.style.id; ctl.arrangement = arr;
  ctl.bpm = o.bpm || arr.style.bpm;
  BK_ROLES.forEach(r => { ctl.muted[r] = !!(o.mute && o.mute[r]); });
  if (!ctx) return Object.assign(ctl, { stop() {}, setMute(r, on) { ctl.muted[r] = !!on; }, setChords() {}, setTempo() {}, setStyle() {}, time: () => 0, spb: 60 / ctl.bpm });
  const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(Sound.master);
  const gains = {};
  BK_ROLES.forEach(r => { const g = ctx.createGain(); g.gain.value = ctl.muted[r] ? 0 : 1; g.connect(bus); gains[r] = g; });
  let timers = [], pumpId = 0, n = -(o.countIn || 0), nextT = ctx.currentTime + 0.12, ending = false, pending = [];
  const spb = () => 60 / ctl.bpm;
  const playBars = o.bars || (o.loop === false ? arr.bars : 0);
  function later(t, fn) {
    const id = setTimeout(() => { const j = timers.indexOf(id); if (j >= 0) timers.splice(j, 1); fn(); }, Math.max(0, (t - Sound.now()) * 1000));
    timers.push(id);
  }
  const route = (role, fn) => Sound.routed(gains[role], fn, { gate: o.gate === true });
  function scheduleBar(k, t0) {
    const s = spb();
    if (k < 0) {
      const M = arr.M;
      M.groups.forEach((g, gi) => Sound.routed(bus, () => Sound.click(t0 + M.starts[gi] * s, gi === 0, false), { gate: o.gate === true }));
      later(t0, () => { ctl.bar = k; if (o.onCount) o.onCount(-k); });
      return;
    }
    const lb = k % arr.bars, b0 = lb * arr.barLen;
    arr.events.forEach(e => {
      if (e.t < b0 - 1e-6 || e.t >= b0 + arr.barLen - 1e-6) return;
      const when = t0 + (e.t - b0) * s;
      pending.push({ e, when, s });
      if (!ctl.muted[e.role]) route(e.role, () => bkSound(e, when, s));
    });
    later(t0, () => { ctl.bar = k; if (o.onBar) o.onBar(k); });
    arr.M.groups.forEach((g, gi) => later(t0 + arr.M.starts[gi] * s, () => { if (o.onBeat) o.onBeat(gi); }));
    arr.changes.forEach(ch => {
      if (ch.t < b0 - 1e-6 || ch.t >= b0 + arr.barLen - 1e-6) return;
      later(t0 + (ch.t - b0) * s, () => { ctl.cur = ch.idx; if (o.onChord) o.onChord(ch.idx, ch.chord); });
    });
  }
  function pump() {
    if (!ctl.playing) return;
    const now = Sound.now(), barDur = arr.barLen * spb(), ahead = Math.max(0.35, Math.min(barDur, 1.2));
    pending = pending.filter(p => p.when > now - 0.05);
    /* a timer that fired late (a background tab): skip the bars already past instead of piling them up */
    while (nextT + barDur < now && !(playBars && n >= playBars)) { n++; nextT += barDur; }
    while (ctl.playing && nextT < now + ahead) {
      if (playBars && n >= playBars) {
        if (!ending) { ending = true; later(nextT, () => { ctl.stop(); if (o.onEnd) o.onEnd(); }); }
        break;
      }
      scheduleBar(n, nextT);
      nextT += (n < 0 ? arr.M.barLen : arr.barLen) * spb();
      n++;
    }
    pumpId = setTimeout(pump, 120);
  }
  ctl.spb = 60 / ctl.bpm;
  ctl.time = beat => ctl.startT + beat * 60 / ctl.bpm;
  ctl.stop = () => {
    if (!ctl.playing) return;
    ctl.playing = false; clearTimeout(pumpId); timers.forEach(clearTimeout); timers = []; pending = [];
    try { const t = Sound.now(); bus.gain.setValueAtTime(bus.gain.value || 1, t); bus.gain.linearRampToValueAtTime(0.0001, t + 0.06); } catch (err) { /* old browsers: the tail rings out */ }
    setTimeout(() => { try { bus.disconnect(); } catch (err) { /* already gone */ } }, 300);
    if (o.onStop) o.onStop();
  };
  ctl.setMute = (role, on) => {
    if (!gains[role]) return;
    on = !!on;
    const was = ctl.muted[role]; ctl.muted[role] = on;
    try { const t = Sound.now(), g = gains[role].gain; g.setValueAtTime(on ? 1 : 0.0001, t); g.linearRampToValueAtTime(on ? 0.0001 : 1, t + 0.03); } catch (err) { gains[role].gain.value = on ? 0 : 1; }
    /* unmuting: play this role's notes already in the window, from now on */
    if (was && !on && ctl.playing) { const now = Sound.now() + 0.03; pending.forEach(p => { if (p.e.role === role && p.when > now) route(role, () => bkSound(p.e, p.when, p.s)); }); }
  };
  const rearrange = () => { arr = bkArrange(o); ctl.arrangement = arr; ctl.style = arr.style.id; };
  ctl.setChords = list => { o.chords = list; rearrange(); };
  ctl.setTempo = bpm => { if (bpm > 0) { ctl.bpm = bpm; ctl.spb = 60 / bpm; } };
  ctl.setStyle = id => { if (BK_STYLES[id]) { o.style = id; rearrange(); } };
  ctl.playing = true;
  ctl.startT = nextT + (o.countIn || 0) * arr.M.barLen * spb();
  if (o.onStart) o.onStart();
  pump();
  return ctl;
}

/* Render a backing offline (no speakers) → Promise<AudioBuffer>, or null without OfflineAudioContext.
   o as for start, plus seconds (default: the arrangement once, or o.bars bars) and sampleRate (default 44100). */
function bkRender(o) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OAC) return null;
  const arr = bkArrange(Object.assign({}, o, { loop: o && o.loop }));
  const bpm = (o && o.bpm) || arr.style.bpm, spb = 60 / bpm, bars = (o && o.bars) || arr.bars;
  const sr = (o && o.sampleRate) || 44100, secs = (o && o.seconds) || bars * arr.barLen * spb + 1.5;
  let ctx;
  try { ctx = new OAC(1, Math.ceil(secs * sr), sr); } catch (e) { return null; }
  const mute = (o && o.mute) || {};
  Sound.offline(ctx, () => {
    const t0 = 0.05;
    for (let k = 0; k < bars; k++) {
      const lb = k % arr.bars, b0 = lb * arr.barLen, bs = t0 + k * arr.barLen * spb;
      arr.events.forEach(e => { if (!mute[e.role] && e.t >= b0 - 1e-6 && e.t < b0 + arr.barLen - 1e-6) bkSound(e, bs + (e.t - b0) * spb, spb); });
    }
  });
  return new Promise((res, rej) => {
    ctx.oncomplete = e => res(e.renderedBuffer);   /* older Safari: an event instead of a promise */
    try { const p = ctx.startRendering(); if (p && p.then) p.then(res, rej); } catch (e) { rej(e); }
  });
}

/* ---------- the widget ----------
   Backing.ui(el, o) → { destroy, ctl (the playing controller or null), play(), stop(), setChords(list), setStyle(id),
   playing, style, bpm }
   o: everything Backing.start takes, plus styles (ids to offer; default all), lockStyle, min/max tempo, note (a line
   under the controls). Shows a style picker with its description, tempo, play/stop, mute toggles for drums, bass and
   chords, and the chords as chips with the one playing now lit. Changing the style or tempo while playing carries on. */
function bkUi(el, o) {
  o = Object.assign({}, o || {});
  let style = BK_STYLES[o.style] ? o.style : 'pop', bpm = o.bpm || BK_STYLES[style].bpm, ctl = null, alive = true;
  const muted = Object.assign({ drums: false, bass: false, chords: false }, o.mute || {});
  const ids = (o.styles || BK_STYLE_LIST.map(s => s.id)).filter(id => BK_STYLES[id]);
  const uid = 'bk-' + Math.random().toString(36).slice(2, 7);
  el.innerHTML = `<div class="bk">
    <div class="row bk-top">${o.lockStyle ? `<div class="bk-style-name"><span class="eyebrow">Style</span><b>${esc(BK_STYLES[style].name)}</b></div>` : `<label class="sel" for="${uid}-st"><span>Style</span><select id="${uid}-st" data-bk="style">${ids.map(id => `<option value="${id}"${id === style ? ' selected' : ''}>${esc(BK_STYLES[id].name)}</option>`).join('')}</select></label>`}
      <label class="sel bk-tempo" for="${uid}-t"><span>Tempo <b class="mono" data-bk="bpm"></b></span><input id="${uid}-t" type="range" min="${o.min || 50}" max="${o.max || 200}" step="2" value="${bpm}" data-bk="tempo"></label></div>
    <p class="muted small bk-desc" data-bk="desc"></p>
    <div class="bk-chords" data-bk="chords"></div>
    <div class="row bk-ctl"><button type="button" class="btn primary" data-bk="go">▶ Play</button>
      <div class="bk-mutes" role="group" aria-label="Parts">${['drums', 'bass', 'chords'].map(r => `<button type="button" class="bk-mute" data-role="${r}" aria-pressed="${muted[r] ? 'false' : 'true'}">${r[0].toUpperCase() + r.slice(1)}</button>`).join('')}</div></div>
    ${o.note ? `<p class="muted small">${o.note}</p>` : ''}</div>`;
  const $ = s => el.querySelector(s);
  const go = $('[data-bk="go"]'), rng = $('[data-bk="tempo"]'), sel = $('[data-bk="style"]'), chipsEl = $('[data-bk="chords"]');
  function paintInfo() {
    const S = BK_STYLES[style];
    $('[data-bk="desc"]').textContent = S.desc;
    $('[data-bk="bpm"]').textContent = Score.tempoLabel(o.meter || S.meter, bpm);
    $('.bk-mute[data-role="drums"]').disabled = !S.drums;
  }
  function paintChords() {
    const tl = bkTimeline(o.chords, { meter: o.meter || BK_STYLES[style].meter, key: o.key, mode: o.mode, beats: o.beats }).chords;
    chipsEl.innerHTML = tl.length ? tl.map(c => `<span class="bk-chip" data-i="${c.idx}">${c.roman ? `<small>${esc(c.roman)}</small>` : ''}<b>${esc(Theory.pretty(c.sym))}</b></span>`).join('') : '<span class="muted small">No chords yet.</span>';
    light(ctl ? ctl.cur : -1);
  }
  const light = i => chipsEl.querySelectorAll('.bk-chip').forEach(x => x.classList.toggle('on', +x.dataset.i === i));
  function play() {
    if (ctl && ctl.playing) return ctl;
    ctl = bkStart(Object.assign({}, o, { style, bpm, mute: Object.assign({}, muted),
      onChord(i, c) { light(i); if (o.onChord) o.onChord(i, c); },
      onStop() { go.textContent = '▶ Play'; light(-1); if (o.onStop) o.onStop(); }
    }));
    if (ctl.playing) go.textContent = '■ Stop';
    return ctl;
  }
  const stop = () => { if (ctl) ctl.stop(); };
  go.onclick = () => { if (ctl && ctl.playing) stop(); else play(); };
  if (sel) sel.onchange = () => {
    style = sel.value; if (o.followStyleTempo !== false) { bpm = BK_STYLES[style].bpm; rng.value = bpm; }
    paintInfo(); paintChords();
    if (ctl && ctl.playing) { ctl.setTempo(bpm); ctl.setStyle(style); }
  };
  rng.oninput = () => { bpm = +rng.value; paintInfo(); if (ctl) ctl.setTempo(bpm); };
  el.querySelectorAll('.bk-mute').forEach(b => { b.onclick = () => {
    const r = b.dataset.role; muted[r] = !muted[r]; b.setAttribute('aria-pressed', muted[r] ? 'false' : 'true');
    if (ctl) ctl.setMute(r, muted[r]);
  }; });
  paintInfo(); paintChords();
  return {
    get ctl() { return ctl && ctl.playing ? ctl : null }, get playing() { return !!(ctl && ctl.playing); },
    get style() { return style; }, get bpm() { return bpm; },
    play, stop,
    setChords(list) { o.chords = list; paintChords(); if (ctl && ctl.playing) ctl.setChords(list); },
    setStyle(id) { if (!BK_STYLES[id]) return; style = id; if (sel) sel.value = id; paintInfo(); paintChords(); if (ctl && ctl.playing) ctl.setStyle(id); },
    destroy() { if (!alive) return; alive = false; stop(); }
  };
}

const Backing = {
  STYLES: BK_STYLES, STYLE_IDS: BK_STYLE_LIST.map(s => s.id), ROLES: BK_ROLES,
  start: bkStart, ui: bkUi, arrange: bkArrange, render: bkRender,
  /* helpers: the chord timeline in beats, one voicing per chord, a walking line over one chord */
  timeline: bkTimeline, voiceLead: bkVoiceLead, walk: bkWalk, chord: bkChord,
  /* a style that suits a meter: the preferred one when its meter matches, else the first style written in that meter */
  styleFor(meter, preferred) {
    const spec = Score.meter(meter || '4/4').spec;
    if (preferred && BK_STYLES[preferred] && Score.meter(BK_STYLES[preferred].meter).spec === spec) return preferred;
    const hit = BK_STYLE_LIST.find(s => Score.meter(s.meter).spec === spec);
    return hit ? hit.id : (preferred && BK_STYLES[preferred] ? preferred : 'pop');
  }
};
