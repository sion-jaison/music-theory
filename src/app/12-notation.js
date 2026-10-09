/* =================================================================
   Notation and rhythm engine (Level 6 onward)
   Score: a text shorthand for rhythms and melodies, meters, conventional re-writing (normalize), engraving (svg),
   playback with swing, and quantizing taps or played notes into notation.
   MelodyCapture: record a melody from any input, see it engraved, edit it note by note.
   Tasks: rhythmTap, rhythmDictation, meterFeel, capture.

   Durations are quarter notes: w 4, h 2, q 1, e 0.5, s 0.25; dotted ×1.5; triplets ×2/3. Inside, everything runs on
   integer ticks (48 to the quarter), so fractions never need comparing as floats.
   bpm is always quarter notes per minute, in every meter: 6/8 at bpm 90 has its dotted-quarter beat at 60.
   ================================================================= */
const NT_TPQ = 48;
const ntTk = d => Math.round(d * NT_TPQ);
const ntQ = t => t / NT_TPQ;
const NT_VAL = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25, t: 0.125 };
const NT_NAME = { w: 'whole', h: 'half', q: 'quarter', e: 'eighth', s: 'sixteenth', t: '32nd' };
const NT_FLAGS = { w: 0, h: 0, q: 0, e: 1, s: 2, t: 3 };
const NT_BASE = [[192, 'w'], [96, 'h'], [48, 'q'], [24, 'e'], [12, 's'], [6, 't']];
/* the written value of a length in ticks: { b: 'q', dots: 0 | 1 }, or null when no single note shows it */
function ntVal(t) {
  for (const [v, b] of NT_BASE) { if (t === v) return { b, dots: 0 }; if (t === v * 1.5) return { b, dots: 1 }; }
  return null;
}
const ntClone = e => ({ d: +e.d, p: e.p == null || e.rest ? null : e.p, rest: !!e.rest, tie: !!e.tie && !e.rest, tup: e.tup ? 3 : 0 });

/* ---------- the text shorthand ----------
   'q q e e q'  'q. e h'  'q_e e'  '3[e e e] q'  'qr e er'  'C4:q D4:e. E4:s'  '3[C4:e D4:e E4:e]'  ('|' is ignored) */
function ntParse(input) {
  if (input == null) return [];
  if (Array.isArray(input)) return input.map(ntClone);
  const s = String(input).replace(/\|/g, ' ');
  const re = /\s*(?:(3)\[|(\])|(_)|([^\s_[\]]+))/y;
  const tok = /^(?:([A-Ga-g](?:##|#|♯|bb|b|♭|x|𝄪|𝄫|♮)?-?\d):)?([whqest])(\.)?(r)?(\.)?$/u;
  const out = [];
  let tup = 0, tie = false;
  while (re.lastIndex < s.length) {
    const at = re.lastIndex, m = re.exec(s);
    if (!m) { if (/^\s*$/.test(s.slice(at))) break; throw new Error('Not a rhythm: ' + s.slice(at)); }
    if (m[1]) { if (tup) throw new Error('Triplets cannot nest: ' + s); tup = 3; continue; }
    if (m[2]) { if (!tup) throw new Error('Unmatched ] in ' + s); tup = 0; continue; }
    if (m[3]) { tie = true; continue; }
    const t = tok.exec(m[4]);
    if (!t) throw new Error('Not a rhythm: ' + m[4]);
    const rest = !!t[4], prev = out[out.length - 1];
    let p = null;
    if (t[1] && !rest) { const q = Theory.parse(t[1].replace('♮', '')); p = Theory.fmt(q.L, q.acc, q.oct); }
    if (tie && !rest && !p && prev && !prev.rest) p = prev.p;
    const d = NT_VAL[t[2]] * (t[3] || t[5] ? 1.5 : 1) * (tup ? 2 / 3 : 1);
    out.push({ d, p, rest, tie: tie && !rest && !!prev && !prev.rest && prev.p === p, tup });
    tie = false;
  }
  return out;
}

/* ---------- meters ---------- */
const NT_METERS = {};
const NT_LEVELS = new Map();
/* '4/4' '3/4' '2/4' '2/2' '6/8' '9/8' '12/8' '5/4' '7/4' '5/8' '7/8', optionally with a grouping: '7/8:3+2+2', '5/4:2+3' */
function ntMeter(spec) {
  if (spec && typeof spec === 'object') return spec;
  const key = String(spec || '4/4').replace(/\s+/g, '');
  if (NT_METERS[key]) return NT_METERS[key];
  const m = /^(\d+)\/(\d+)(?::(\d+(?:\+\d+)*))?$/.exec(key);
  if (!m) throw new Error('Not a meter: ' + spec);
  const num = +m[1], den = +m[2], unit = 4 / den, barLen = num * unit;
  let grp = m[3] ? m[3].split('+').map(Number) : null;
  if (grp && grp.reduce((a, b) => a + b, 0) !== num) throw new Error('Grouping does not add up: ' + spec);
  let groups, accents = [0], compound = false, mids = [], midType = 'mid', grouping = null;
  if (den >= 8) {
    const custom = !!grp;
    if (!grp) {
      if (num % 3 === 0) grp = Array(num / 3).fill(3);
      else if (num === 5) grp = [2, 3];
      else if (num === 7) grp = [2, 2, 3];
      else { grp = []; let r = num; while (r > 3) { grp.push(2); r -= 2; } grp.push(r); }
    }
    compound = grp.every(g => g === 3);
    groups = grp.map(g => g * unit);
    if (compound && grp.length === 4) mids = [barLen / 2];
    if (custom || !compound) grouping = grp.join('+');
  } else {
    groups = Array(num).fill(unit);
    const acc = grp || (num === 5 ? [3, 2] : num === 7 ? [4, 3] : null);
    if (acc) {
      let s = 0; accents = [0].concat(acc.slice(0, -1).map(g => (s += g)));
      mids = accents.slice(1).map(i => i * unit); midType = 'acc'; grouping = acc.join('+');
    } else if (num === 4) mids = [2 * unit];
  }
  const starts = []; groups.reduce((s, g) => { starts.push(s); return s + g; }, 0);
  const M = { num, den, barLen, groups, starts, compound, irregular: den >= 8 && !compound, accents, label: num + '/' + den, grouping, mids, midType, spec: key };
  NT_METERS[key] = M;
  return M;
}
const ntMeters = spec => (Array.isArray(spec) ? spec : [spec || '4/4']).map(ntMeter);
/* bars covering `total` ticks (at least one); with a list of meters the last one repeats. A pickup (in quarters) makes the
   first bar short: it is the end of a full bar, so its start lies before 0. */
function ntBars(spec, total, count, pickup) {
  const list = ntMeters(spec), out = [];
  let s = 0, k = 0;
  if (pickup) { const n = ntTk(list[0].barLen); s = Math.min(n, ntTk(pickup)); out.push({ s: s - n, n, M: list[0], k: 0, pickup: true }); k = 1; }
  do { const M = list[Math.min(k, list.length - 1)], n = ntTk(M.barLen); out.push({ s, n, M, k }); s += n; k++; }
  while (count ? k < count : s < total);
  return out;
}
const ntBarAt = (bars, t) => { let b = bars[0]; bars.forEach(x => { if (x.s <= t) b = x; }); return b; };
/* metrical strength of every position in a bar (on a 32nd grid): 0 bar line, 1 the middle of 4/4 or 12/8 (or the
   accent split of 5/4 and 7/4), 2 beats, 3 and up the beat's divisions. Notes should not hide strong positions. */
function ntLevels(M) {
  if (NT_LEVELS.has(M)) return NT_LEVELS.get(M);
  const map = new Map(), n = ntTk(M.barLen);
  const set = (t, l) => { if (!map.has(t) || map.get(t) > l) map.set(t, l); };
  const pow2 = x => Number.isInteger(x) && x > 0 && (x & (x - 1)) === 0;
  function sub(a, len, lev) {
    if (len <= 6) return;
    const third = len / 3;
    if (Number.isInteger(third) && third % 6 === 0 && pow2(third / 6) && !pow2(len / 6)) {
      set(a + third, lev); set(a + 2 * third, lev);
      for (let k = 0; k < 3; k++) sub(a + k * third, third, lev + 1);
    } else if (len % 12 === 0) { const h = len / 2; set(a + h, lev); sub(a, h, lev + 1); sub(a + h, h, lev + 1); }
  }
  set(0, 0);
  M.mids.forEach(x => set(ntTk(x), 1));
  let s = 0;
  M.groups.forEach(g => { const gl = ntTk(g); set(s, 2); sub(s, gl, 3); s += gl; });
  const arr = [...map.entries()].filter(e => e[0] < n).sort((a, b) => a[0] - b[0]);
  const L = { arr, at: t => (t <= 0 || t >= n ? 0 : map.has(t) ? map.get(t) : 99) };
  NT_LEVELS.set(M, L);
  return L;
}

/* ---------- events in ticks ---------- */
function ntAtoms(ev) {
  let at = 0;
  return ev.map((e, i) => { const a = at; at += ntTk(e.d); return { i, a, b: at, p: e.p, rest: e.rest, tie: e.tie, tup: e.tup, d: e.d }; });
}
/* triplet groups: a run of triplet events closes where it lands back on the sixteenth grid */
function ntTupGroups(atoms) {
  const gs = []; let cur = null;
  atoms.forEach(x => {
    if (!x.tup) { if (cur) gs.push(cur); cur = null; return; }
    if (!cur) cur = { a: x.a, b: x.a, idx: [] };
    cur.b = x.b; cur.idx.push(x.i);
    if (x.b % 12 === 0) { gs.push(cur); cur = null; }
  });
  if (cur) gs.push(cur);
  return gs;
}
/* sounds: tied notes merged into one, neighbouring rests merged; { a, b, p, rest, i (first event), j (last event), tup } */
function ntSounds(ev) {
  const out = [];
  ntAtoms(ev).forEach(x => {
    const last = out[out.length - 1];
    if (last && last.b === x.a && ((x.rest && last.rest) || (x.tie && !x.rest && !last.rest && last.p === x.p))) { last.b = x.b; last.j = x.i; last.tup = last.tup && !!x.tup; return; }
    out.push({ a: x.a, b: x.b, p: x.rest ? null : x.p, rest: x.rest, i: x.i, j: x.i, tup: !!x.tup });
  });
  return out;
}

/* ---------- writing rhythms conventionally ----------
   A note may be written as one value when that value exists and it does not hide a strong position:
   – nothing crosses a bar line;
   – a note on a beat may run over later beats if it ends on a beat (or, in simple time, is dotted with its undotted
     part ending on a beat: q. e), but not over the middle of 4/4 or 12/8 unless it starts the bar (a dotted half on
     beat 1 is fine, a half on beat 2 is not), nor over the 3+2 split of 5/4 or the 4+3 split of 7/4;
   – a note off the beat stays inside its beat (e q e becomes e e_e e);
   – rests are stricter: no dotted rests in simple time, and a rest covers several beats only from one strong
     position to the next (a half rest on beat 1 or 3 of 4/4).  */
function ntOkBin(a, b, rest, bar) {
  const M = bar.M, n = bar.n, ra = a - bar.s, rb = b - bar.s, len = b - a;
  if (ra === 0 && rb === n) return rest || !!ntVal(len);
  const v = ntVal(len); if (!v) return false;
  const eighths = M.den >= 8;
  if (rest && v.dots && !eighths) return false;
  const L = ntLevels(M);
  let inside = 99; L.arr.forEach(([t, l]) => { if (t > ra && t < rb && l < inside) inside = l; });
  if (inside === 99) return true;
  const la = L.at(ra);
  if (la > 2) return rest && eighths ? inside > 3 : inside >= 3;
  if (rest) return inside >= 3 || (la <= 1 && L.at(rb) <= 1 && inside >= 2);
  if (inside >= 3) return true;
  if (inside <= 1 && !(ra === 0 && M.midType === 'mid')) return false;
  if (L.at(rb) <= 2) return true;
  return !eighths && !!v.dots && L.at(rb - len / 3) <= 2;
}
function ntSplitBin(a, b, rest, bar) {
  if (ntOkBin(a, b, rest, bar)) return [[a, b]];
  let best = null;
  ntLevels(bar.M).arr.forEach(([t, l]) => { const x = bar.s + t; if (x > a && x < b && (!best || l < best[1])) best = [x, l]; });
  if (!best) return [[a, b]];
  return ntSplitBin(a, best[0], rest, bar).concat(ntSplitBin(best[0], b, rest, bar));
}
/* inside a triplet group: written values are 3/2 of the real ones; split on the triplet slots when needed */
function ntSplitTup(a, b, g) {
  if (ntVal((b - a) * 1.5)) return [[a, b]];
  const gl = g.b - g.a;
  for (const st of [gl / 3, gl / 6, gl / 12]) {
    for (let t = g.a + st; t < g.b - 1e-9; t += st) if (t > a && t < b) return ntSplitTup(a, t, g).concat(ntSplitTup(t, b, g));
  }
  return [[a, b]];
}
function ntNormalize(input, spec, o) {
  const ev = ntParse(input), atoms = ntAtoms(ev);
  const total = atoms.length ? atoms[atoms.length - 1].b : 0;
  if (!total) return [];
  const bars = ntBars(spec, total, 0, o && o.pickup), groups = ntTupGroups(atoms), sounds = ntSounds(ev);
  const bounds = []; sounds.forEach(x => bounds.push(x.a, x.b));
  /* a triplet group is real while something inside it sits off the binary grid */
  const real = groups.filter(g => bounds.some(t => t > g.a && t < g.b && t % 6 !== 0));
  const cuts = [...new Set(bars.map(b => b.s).filter(s => s > 0).concat(...real.map(g => [g.a, g.b])))].sort((x, y) => x - y);
  const out = [];
  sounds.forEach(x => {
    const pts = [x.a].concat(cuts.filter(c => c > x.a && c < x.b), [x.b]);
    let pieces = [];
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k], b = pts[k + 1], g = real.find(r => a >= r.a && b <= r.b);
      pieces = pieces.concat(g ? ntSplitTup(a, b, g).map(q => q.concat([3])) : ntSplitBin(a, b, x.rest, ntBarAt(bars, a)).map(q => q.concat([0])));
    }
    pieces.forEach(([a, b, tup], k) => out.push({ d: ntQ(b - a), p: x.rest ? null : x.p, rest: x.rest, tie: !x.rest && k > 0, tup }));
  });
  return out;
}
const ntLength = input => ntQ(ntAtoms(ntParse(input)).reduce((s, x) => Math.max(s, x.b), 0));
const ntOnsets = input => ntAtoms(ntParse(input)).filter(x => !x.rest && !x.tie).map(x => ntQ(x.a));

/* swing: the off-beat eighth of each quarter moves to `sw` of the beat (0.5 straight, 0.6 light, 0.67 triplet swing).
   Only in meters counted in quarters or halves; compound and odd x/8 meters are left straight. */
function ntSwing(sw, spec) {
  if (sw == null || Math.abs(sw - 0.5) < 1e-3) return x => x;
  if (spec && ntMeters(spec)[0].den >= 8) return x => x;
  return x => { const b = Math.floor(x + 1e-9), f = x - b; return Math.abs(f - 0.5) < 1e-6 ? b + sw : x; };
}
/* events → [{ m, t, d }] in seconds; unpitched notes sound as MIDI 72 (or o.pitch) */
function ntToNotes(input, o) {
  o = o || {};
  const spb = 60 / (o.bpm || 90), warp = ntSwing(o.swing, o.meter);
  return ntSounds(ntParse(input)).filter(x => !x.rest).map(x => {
    const t0 = warp(ntQ(x.a)), t1 = warp(ntQ(x.b));
    return { m: x.p ? Theory.midi(x.p) : (o.pitch || 72), t: +(t0 * spb).toFixed(4), d: +((t1 - t0) * spb).toFixed(4) };
  });
}

/* spell a played MIDI note: white keys plain; black keys as flats in flat keys, sharps in sharp keys,
   and in C the usual chromatic spellings (C♯ E♭ F♯ G♯ B♭) */
function ntSpell(m, ks) {
  const pc = mod12(m);
  return Theory.fromMidi(m, isBlack(m) && (ks ? ks < 0 : (pc === 3 || pc === 10)));
}

/* ---------- sound ---------- */
/* metronome clicks for `bars` bars from t0, one per beat group with the downbeat high; odd x/8 meters also tick every
   eighth so 2+2+3 can be heard. mode: 'count' (the louder count-in), 'click', or 'silent' (times only).
   Returns [{ t, gi, k }] for beat lights. */
function ntClicks(spec, t0, bars, spb, mode) {
  const B = ntBars(spec, 0, bars), out = [], count = mode === 'count';
  B.forEach(bar => {
    const bs = t0 + ntQ(bar.s) * spb, M = bar.M;
    M.groups.forEach((g, gi) => {
      const t = bs + M.starts[gi] * spb, acc = gi > 0 && M.accents.indexOf(gi) >= 0;
      out.push({ t, gi, k: bar.k });
      if (mode === 'silent') return;
      Sound.click(t, gi === 0 || acc || M.irregular, !count && gi !== 0);
      if (M.irregular || (count && M.compound && M.groups.length < 3)) for (let e = 0.5; e < g - 1e-9; e += 0.5) Sound.click(bs + (M.starts[gi] + e) * spb, false, true);
    });
  });
  return out;
}
/* Play a rhythm or melody. o: { meter, bpm, swing, countIn (bars), click, pitch (MIDI for unpitched notes), gate (default
   true: the mic ignores it), lead (s), pickup (quarters before bar 1), onNote(i, when) (called as each note sounds; i is
   the event index), onEnd }
   → { start (beat 1 after the count-in; with a pickup, its first note), end, onsets: [s], beats: [{ t, gi, k }] (count-in
       and bar beats), down (beat 1 of bar 1), time(q) (when position q sounds), stop() } */
function ntPlay(input, o) {
  o = o || {};
  const ctx = Sound.ensure(); if (!ctx) return null;
  const ev = ntParse(input), spec = o.meter || '4/4', M = ntMeters(spec)[0];
  const spb = 60 / (o.bpm || 90), warp = ntSwing(o.swing, spec);
  const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(Sound.master);
  const t0 = ctx.currentTime + (o.lead == null ? 0.15 : o.lead);
  const cin = o.countIn || 0, pk = o.pickup || 0;
  /* down: beat 1 of bar 1; start: the first event (earlier than down by a pickup, which falls in the count-in) */
  const down = t0 + Math.max(cin * M.barLen, pk) * spb, start = down - pk * spb, tm = q => down + warp(q - pk) * spb;
  const sounds = ntSounds(ev).filter(x => !x.rest), len = ntLength(ev);
  const end = start + len * spb, busy0 = Sound.busyUntil, timers = [];
  let beats = [];
  Sound.routed(bus, () => {
    if (cin) beats = ntClicks(M.spec, t0, cin, spb, 'count').map(b => Object.assign(b, { k: b.k - cin }));
    beats = beats.concat(ntClicks(spec, down, Math.max(1, ntBars(spec, ntTk(len), 0, pk).length - (pk ? 1 : 0)), spb, o.click ? 'click' : 'silent'));
    sounds.forEach(x => {
      const t = tm(ntQ(x.a)), d = tm(ntQ(x.b)) - t;
      if (x.p) Sound.tone(Theory.midi(x.p), t, Math.max(0.08, d * 0.92), o.vel || 0.75);
      else { Sound.wood(t); Sound.tone(o.pitch || 72, t, Math.max(0.12, d * 0.85), 0.45); }
    });
  }, { gate: o.gate !== false });
  const onsets = sounds.map(x => tm(ntQ(x.a)));
  if (o.onNote) sounds.forEach((x, k) => timers.push(setTimeout(() => o.onNote(x.i, onsets[k]), Math.max(0, (onsets[k] - Sound.now()) * 1000))));
  if (o.onEnd) timers.push(setTimeout(o.onEnd, Math.max(0, (end - Sound.now()) * 1000 + 60)));
  let stopped = false;
  return {
    start, end, onsets, beats, down, time: tm,
    stop() {
      if (stopped) return; stopped = true;
      timers.forEach(clearTimeout);
      try { const t = Sound.now(); bus.gain.setValueAtTime(1, t); bus.gain.linearRampToValueAtTime(0.0001, t + 0.05); } catch (e) { /* the tail rings out */ }
      setTimeout(() => { try { bus.disconnect(); } catch (e) { /* already gone */ } }, 200);
      if (o.gate !== false) Sound.busyUntil = Math.max(busy0, Math.min(Sound.busyUntil, Sound.now() + 0.1));
    }
  };
}

/* ---------- quantizing ----------
   hits: [{ t, midi?, off? }] in seconds (AudioContext time). o: { bpm, meter, start (time of bar 1 beat 1), bars, keySig,
   grids: ['e', 's', 't'] (eighths, sixteenths, triplets) }.
   Each beat (a quarter, or a dotted quarter in compound and odd meters) gets the grid that fits its hits best: least
   squared error, a small penalty for finer grids, a large one for two hits on one grid point. A note lasts until the
   next onset, unless its release is known and the gap before the next note is long (half a beat or more): then a rest. */
function ntQuantize(hits, o) {
  o = o || {};
  const spec = o.meter || '4/4', spb = 60 / (o.bpm || 90), nb = Math.max(1, o.bars || 1);
  const B = ntBars(spec, 0, nb), end = B[nb - 1].s + B[nb - 1].n;
  const allow = o.grids || ['e', 's', 't'], has = g => allow.indexOf(g) >= 0;
  const pos = t => (t - (o.start || 0)) / spb * NT_TPQ;
  const cells = [];
  B.forEach(bar => {
    let s = bar.s;
    bar.M.groups.forEach(g => {
      const gl = ntTk(g);
      if (gl % 48 === 0 && gl > 48) for (let k = 0; k < gl; k += 48) cells.push({ s: s + k, n: 48 });
      else cells.push({ s, n: gl });
      s += gl;
    });
  });
  const gridsFor = n => {
    const g = [{ k: 1, pen: 0 }];
    if (n === 72) { if (has('e')) g.push({ k: 3, pen: 0.001 }); if (has('s')) g.push({ k: 6, pen: 0.004 }); }
    else if (n === 48) {
      if (has('e')) g.push({ k: 2, pen: 0.001 });
      if (has('s')) g.push({ k: 4, pen: 0.004 });
      if (has('t')) g.push({ k: 3, pen: 0.006, tup: true });
    } else { for (let k = 2; n / k >= 12 && Number.isInteger(n / k); k *= 2) g.push({ k, pen: 0.001 * k }); }
    return g;
  };
  const H = hits.map(h => ({ x: pos(h.t), m: h.midi, off: h.off != null ? pos(h.off) : null }))
    .filter(h => h.x >= -6 && h.x < end - 6).sort((a, b) => a.x - b.x);
  const inWin = (c, x) => x >= c.s - 6 && x < c.s + c.n - 6;
  const snap = (c, x) => c.s + Math.max(0, Math.min(c.G.k, Math.round((x - c.s) / c.st))) * c.st;
  cells.forEach(c => {
    const xs = H.filter(h => inWin(c, h.x)).map(h => h.x), rs = H.filter(h => h.off != null && inWin(c, h.off)).map(h => h.off);
    let best = null;
    gridsFor(c.n).forEach(G => {
      const st = c.n / G.k, used = new Set();
      let cost = G.pen;
      xs.forEach(x => { const k = Math.max(0, Math.min(G.k, Math.round((x - c.s) / st))), e = (x - c.s - k * st) / NT_TPQ; cost += e * e; if (used.has(k)) cost += 0.05; used.add(k); });
      rs.forEach(x => { const k = Math.max(0, Math.min(G.k, Math.round((x - c.s) / st))), e = (x - c.s - k * st) / NT_TPQ; cost += 0.3 * e * e; });
      if (!best || cost < best.cost - 1e-12) best = { G, cost, st };
    });
    c.G = best.G; c.st = best.st;
  });
  const cellOf = x => cells.find(c => inWin(c, x)) || (x < 0 ? cells[0] : null);
  H.forEach(h => { const c = cellOf(h.x); h.q = c ? Math.round(snap(c, h.x)) : null; });
  const ons = [];
  H.forEach(h => { if (h.q == null || h.q >= end) return; const last = ons[ons.length - 1]; if (last && last.q === h.q) return; ons.push(h); });
  const pieces = [];
  let cur = 0;
  ons.forEach((h, i) => {
    const nx = i + 1 < ons.length ? ons[i + 1] : null, nq = nx ? nx.q : end, nraw = nx ? nx.x : end;
    if (h.q > cur) pieces.push({ a: cur, b: h.q, rest: true });
    let e = nq;
    if (h.off != null && (nraw - h.off) / NT_TPQ >= 0.5) {
      const c = cellOf(Math.min(h.off, end - 7));
      const rq = c ? Math.round(snap(c, h.off)) : nq;
      if (rq < nq) e = Math.min(nq, Math.max(rq, h.q + (c ? Math.round(c.st) : 12)));
    }
    pieces.push({ a: h.q, b: e, p: h.m != null ? ntSpell(h.m, o.keySig || 0) : null, rest: false });
    cur = e;
  });
  if (cur < end) pieces.push({ a: cur, b: end, rest: true });
  /* triplet beats: cut what crosses their edges and mark what is inside */
  const tc = cells.filter(c => c.G.tup), ev = [];
  pieces.forEach(x => {
    const pts = [x.a];
    tc.forEach(c => [c.s, c.s + c.n].forEach(t => { if (t > x.a && t < x.b) pts.push(t); }));
    pts.sort((u, v) => u - v); pts.push(x.b);
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k], b = pts[k + 1];
      ev.push({ d: ntQ(b - a), p: x.rest ? null : x.p, rest: x.rest, tie: !x.rest && k > 0, tup: tc.some(c => a >= c.s && b <= c.s + c.n) ? 3 : 0 });
    }
  });
  return ntNormalize(ev, spec);
}
/* notes [{ m, t, d }] (seconds from 0, as sketches store them) → events */
function ntFromNotes(notes, o) {
  o = o || {};
  const spb = 60 / (o.bpm || 90), M = ntMeters(o.meter || '4/4')[0];
  const endQ = notes.reduce((e, n) => Math.max(e, n.t + (n.d || 0.4)), 0) / spb;
  const bars = o.bars || Math.max(1, Math.ceil((endQ - 0.25) / M.barLen));
  return ntQuantize(notes.map(n => ({ t: n.t, midi: n.m, off: n.d != null ? n.t + n.d : null })), { bpm: o.bpm || 90, meter: o.meter || '4/4', start: o.start || 0, bars, keySig: o.keySig, grids: o.grids });
}

/* ---------- engraving ----------
   One staff line (perc) or five (treble, bass, alto, tenor), with the clef, key and time metrics of Staff (11-components.js).
   Every event is drawn as given (call normalize first for conventional spelling), except that an event crossing a
   bar line is re-written with a tie. Staff space = 10 px; the top line (or the single line) is at y = 0. */
const NT_GAP = 10, NT_HALF = 5;
const NT_CLEFS = {
  treble: { bottom: 30, glyph: '𝄞', size: 40.6, dy: 40.5, sharps: ['F5', 'C5', 'G5', 'D5', 'A4', 'E5', 'B4'], flats: ['B4', 'E5', 'A4', 'D5', 'G4', 'C5', 'F4'] },
  bass: { bottom: 18, glyph: '𝄢', size: 45.4, dy: 40.4, sharps: ['F3', 'C3', 'G3', 'D3', 'A2', 'E3', 'B2'], flats: ['B2', 'E3', 'A2', 'D3', 'G2', 'C3', 'F2'] },
  /* C clefs mark middle C: on the middle line (alto: viola) or the 4th line (tenor: cello, bassoon and trombone high parts) */
  alto: { bottom: 24, cclef: true, sharps: ['F4', 'C4', 'G4', 'D4', 'A3', 'E4', 'B3'], flats: ['B3', 'E4', 'A3', 'D4', 'G3', 'C4', 'F3'] },
  tenor: { bottom: 22, cclef: true, sharps: ['F3', 'C4', 'G3', 'D4', 'A3', 'E4', 'B3'], flats: ['B3', 'E4', 'A3', 'D4', 'G3', 'C4', 'F3'] }
};
/* the C clef, drawn (not a font glyph): two bars and two lobes meeting on the line of middle C at y = yc */
function ntCClef(x, yc) {
  const X = v => ntN(x + v), lobe = s => { const Y = v => ntN(yc + s * v); return `<path class="nt-cclef-l" d="M${X(8.6)} ${Y(1.2)}L${X(11.2)} ${Y(6.4)}Q${X(13.2)} ${Y(8.4)} ${X(16.4)} ${Y(7.8)}C${X(21.2)} ${Y(7.2)} ${X(22.4)} ${Y(10.6)} ${X(22)} ${Y(13.8)}C${X(21.4)} ${Y(18)} ${X(18)} ${Y(19.6)} ${X(15.2)} ${Y(19.2)}C${X(13.2)} ${Y(18.9)} ${X(12.2)} ${Y(17.8)} ${X(12.4)} ${Y(16.6)}"/><circle class="nt-cclef" cx="${X(14.6)}" cy="${Y(16.2)}" r="2.6"/>`; };
  return `<g class="nt-clef-c"><rect class="nt-cclef" x="${X(0)}" y="${ntN(yc - 20)}" width="4.4" height="40"/><rect class="nt-cclef" x="${X(6.2)}" y="${ntN(yc - 20)}" width="1.6" height="40"/>${lobe(-1)}${lobe(1)}</g>`;
}
const NT_ACC = { '-2': '𝄫', '-1': '♭', '0': '♮', '1': '♯', '2': '𝄪' };
const ntN = v => Math.round(v * 10) / 10;
function ntApprox(t) {
  for (const [v, b] of NT_BASE) if (t >= v) return { b, dots: t >= v * 1.5 ? 1 : 0 };
  return { b: 't', dots: 0 };
}
/* note heads: black ones as Staff draws them; half and whole notes with a slanted hole */
function ntHead(cx, cy, b) {
  if (b !== 'w' && b !== 'h') return `<ellipse class="nt-hd" cx="${ntN(cx)}" cy="${ntN(cy)}" rx="6" ry="4.4" transform="rotate(-20 ${ntN(cx)} ${ntN(cy)})"/>`;
  const E = (a, r, rot) => {
    const c = Math.cos(rot * Math.PI / 180), s = Math.sin(rot * Math.PI / 180);
    const x1 = ntN(cx - a * c), y1 = ntN(cy - a * s), x2 = ntN(cx + a * c), y2 = ntN(cy + a * s);
    return `M${x1} ${y1}A${a} ${r} ${rot} 1 0 ${x2} ${y2}A${a} ${r} ${rot} 1 0 ${x1} ${y1}Z`;
  };
  const d = b === 'w' ? E(7.6, 4.8, 0) + E(3.1, 2.3, 60) : E(6.5, 4.5, -20) + E(4.7, 2.0, -32);
  return `<path class="nt-hd" fill-rule="evenodd" d="${d}"/>`;
}
/* flags hang from the end of the stem toward the head */
function ntFlags(sx, sy, up, n) {
  let s = '';
  for (let k = 0; k < n; k++) {
    const y = ntN(sy + (up ? 1 : -1) * k * 7.5);
    s += `<path class="nt-flag" transform="translate(${ntN(sx - 0.65)} ${y})${up ? '' : ' scale(1 -1)'}" d="M0 0C0.5 4.4 3.6 7.2 6.2 10C9.4 13.4 10.6 18.6 7.6 24.2C9.1 18.6 7.2 14.7 3.4 12.4C2 11.5 0.8 11 0 10.8Z"/>`;
  }
  return s;
}
/* rests, centred on x; ym is the middle line (one-line staves: the line) */
function ntRest(x, ym, b, dots, perc) {
  const X = v => ntN(x + v), Y = v => ntN(ym + v);
  let s;
  if (b === 'w') { const y = perc ? ym : ym - 10; s = `<rect class="nt-rest" x="${X(-6)}" y="${ntN(y)}" width="12" height="5"/>`; }
  else if (b === 'h') s = `<rect class="nt-rest" x="${X(-6)}" y="${Y(-5)}" width="12" height="5"/>`;
  else if (b === 'q') {
    s = `<path class="nt-rest" d="M${X(-1.8)} ${Y(-15)}L${X(3.7)} ${Y(-8.4)}C${X(1.8)} ${Y(-6.6)} ${X(1.2)} ${Y(-4.8)} ${X(1.6)} ${Y(-3.3)}C${X(1.9)} ${Y(-2.1)} ${X(2.7)} ${Y(-0.9)} ${X(3.8)} ${Y(0.3)}L${X(3.5)} ${Y(0.6)}C${X(0.6)} ${Y(-1)} ${X(-1.8)} ${Y(0.9)} ${X(-0.4)} ${Y(4.4)}C${X(0.2)} ${Y(5.9)} ${X(0.9)} ${Y(7)} ${X(1.5)} ${Y(7.8)}L${X(1.1)} ${Y(8)}C${X(-2.4)} ${Y(5)} ${X(-4.4)} ${Y(1.4)} ${X(-2.2)} ${Y(-0.6)}C${X(-1.4)} ${Y(-1.3)} ${X(-0.1)} ${Y(-1.4)} ${X(1.1)} ${Y(-1.1)}L${X(-3.6)} ${Y(-6.8)}C${X(-1.6)} ${Y(-8.6)} ${X(-0.9)} ${Y(-10.8)} ${X(-2.5)} ${Y(-14.4)}Z"/>`;
  } else {
    const n = NT_FLAGS[b] || 1, top = -4.6 - (n === 3 ? 10 : 0), bot = top + 10 * n + 4.8;
    const lx = y => 3.6 - 0.27 * (y - top - 1) ;
    s = `<path class="nt-rest-st" d="M${X(lx(top - 1))} ${Y(top - 1)}L${X(lx(bot))} ${Y(bot)}"/>`;
    for (let k = 0; k < n; k++) {
      const yk = top + 10 * k, ex = lx(yk - 1), bx = ex - 6;
      s += `<circle class="nt-rest" cx="${X(bx)}" cy="${Y(yk)}" r="2.5"/><path class="nt-rest-st" d="M${X(bx - 0.6)} ${Y(yk + 2.2)}Q${X((bx + ex) / 2 + 0.8)} ${Y(yk + 3.2)} ${X(ex)} ${Y(yk - 1)}"/>`;
    }
  }
  if (dots) s += `<circle class="nt-dot" cx="${X(b === 'w' || b === 'h' ? 10 : 8)}" cy="${Y(perc ? -4 : -5)}" r="1.9"/>`;
  return s;
}
/* where a position sits in its bar: the beat group, and the offset inside it (ticks) */
function ntWhere(rel, M) {
  let gi = 0; while (gi + 1 < M.starts.length && ntTk(M.starts[gi + 1]) <= rel) gi++;
  return { gi, gl: ntTk(M.groups[gi]), off: rel - ntTk(M.starts[gi]) };
}
/* counting: beat numbers, & e a in quarter beats, la li for beats split in three (compound time and triplets) */
function ntCount(rel, M) {
  const w = ntWhere(rel, M);
  if (w.off === 0) return String(w.gi + 1);
  if (w.gl === 72) return { 24: 'la', 48: 'li' }[w.off] || '';
  if (w.gl === 96) return { 48: '&', 24: 'e', 72: 'a', 32: 'la', 64: 'li' }[w.off] || '';
  return { 24: '&', 12: 'e', 36: 'a', 16: 'la', 32: 'li' }[w.off % 48] || '';
}
/* rhythm syllables: ta ti ti-ka (Kodály) in simple beats, tri-o-la for triplets, ta-ki-da (Takadimi) in compound beats */
function ntSyl(x, len, M, g) {
  if (x.rest) return 'sh';
  if (x.tie) return '';
  const w = ntWhere(x.a - x.bar.s, M);
  if (g) { const slot = (x.a - g.a) / ((g.b - g.a) / 3); return Number.isInteger(slot) ? ['tri', 'o', 'la'][slot] : ''; }
  if (w.gl === 72) return w.off === 0 ? (len >= 144 ? 'ta-a' : 'ta') : ({ 12: 'va', 24: 'ki', 36: 'di', 48: 'da', 60: 'ma' }[w.off] || '');
  const qo = w.off % 48;
  if (qo === 0) return len >= 48 ? ({ 72: 'ta-i', 96: 'ta-a', 144: 'ta-a-a', 192: 'ta-a-a-a' }[len] || 'ta') : 'ti';
  return qo === 24 ? 'ti' : (qo === 12 || qo === 36) ? 'ka' : '';
}
function ntName(x) {
  const v = x.wv, nm = (v.dots ? 'dotted ' : '') + (x.tup ? 'triplet ' : '') + NT_NAME[v.b];
  return x.rest ? (x.wbr ? 'whole-bar rest' : nm + ' rest') : (x.p ? Theory.pretty(x.p) + ' ' : '') + nm + (x.p ? '' : ' note');
}

/* Score.svg(input, { meter, clef: 'treble'|'bass'|'alto'|'tenor'|'perc', keySig, counts, syllables, marks (per sounding onset: 'ok'|'no'),
   selected (event index or array), editable (data-i on each event), labels (per event), playing (event index), pickup
   (quarters before bar 1), aria }) */
function ntSvg(input, o) {
  o = o || {};
  const spec = o.meter || '4/4', clef = o.clef || 'treble', perc = clef === 'perc';
  let ev = ntParse(input), A = ntAtoms(ev);
  const total = A.length ? A[A.length - 1].b : 0;
  const B = ntBars(spec, Math.max(1, total), 0, o.pickup);
  if (A.some(x => B.some(b => b.s > x.a && b.s < x.b))) { ev = ntNormalize(ev, spec, o); A = ntAtoms(ev); }
  const CL = perc ? null : (NT_CLEFS[clef] || NT_CLEFS.treble);
  const mid = perc ? 0 : CL.bottom + 4, ym = perc ? 0 : 20;
  const yOf = s => perc ? 0 : 4 * NT_GAP - (s - CL.bottom) * NT_HALF;
  const ks = perc ? 0 : (o.keySig || 0), nAcc = Math.abs(ks);
  const keyAcc = {}; (ks > 0 ? Theory.ORDER_SHARPS : Theory.ORDER_FLATS).slice(0, nAcc).forEach(l => { keyAcc[l] = ks > 0 ? 1 : -1; });
  const tg = ntTupGroups(A), sounds = ntSounds(ev);
  const sel = new Set([].concat(o.selected == null ? [] : o.selected));
  let onset = 0;
  A.forEach(x => {
    const len = x.b - x.a;
    x.bar = ntBarAt(B, x.a);
    x.g = tg.find(g => g.idx.indexOf(x.i) >= 0) || null;
    x.wbr = x.rest && !x.tup && x.a === x.bar.s && x.b === x.bar.s + x.bar.n;
    x.wv = x.wbr ? { b: 'w', dots: 0 } : (ntVal(x.tup ? len * 1.5 : len) || ntApprox(x.tup ? len * 1.5 : len));
    x.snd = sounds.find(s => s.i <= x.i && s.j >= x.i);
    if (!x.rest && !x.tie) x.on = onset++;
  });
  /* accidentals: shown when a note differs from the key signature or from an earlier note on the same line or space in
     the bar; a tied-over note shows none and changes nothing */
  let barK = -1, state = new Map();
  A.forEach(x => {
    if (x.bar.k !== barK) { barK = x.bar.k; state = new Map(); }
    if (x.rest) return;
    if (perc || !x.p) { x.step = mid; return; }
    const q = Theory.parse(x.p); x.step = q.L + 7 * q.oct;
    if (x.tie) return;
    const cur = state.has(x.step) ? state.get(x.step) : (keyAcc[Theory.LETTERS[q.L]] || 0);
    if (q.acc !== cur) x.acc = NT_ACC[q.acc] || '';
    state.set(x.step, q.acc);
  });
  /* beams: eighths and shorter inside one beat group (6/8 in threes, 7/8 as 2+2+3); four plain eighths on a half bar of
     4/4 or 2/4 share a beam; 2/2 beams by the half unless sixteenths are about; triplets beam among themselves */
  const flagged = x => !x.rest && NT_FLAGS[x.wv.b] > 0;
  const beams = [];
  B.forEach(bar => {
    const M = bar.M, inBar = A.filter(x => x.bar === bar);
    let units = [];
    M.groups.forEach((g, gi) => {
      const s = bar.s + ntTk(M.starts[gi]), gl = ntTk(g);
      if (gl > 48 && gl % 48 === 0 && inBar.some(x => x.a >= s && x.b <= s + gl && flagged(x) && NT_FLAGS[x.wv.b] > 1)) for (let k = 0; k < gl; k += 48) units.push([s + k, s + k + 48]);
      else units.push([s, s + gl]);
    });
    if (M.den === 4 && (M.num === 4 || M.num === 2) && !M.grouping) {
      for (let h = 0; h < M.num; h += 2) {
        const s = bar.s + h * 48, e = s + 96, xs = inBar.filter(x => x.a >= s && x.b <= e);
        if (xs.length === 4 && xs.every(x => !x.rest && !x.tup && x.b - x.a === 24)) units = units.filter(u => u[1] <= s || u[0] >= e).concat([[s, e]]);
      }
      units.sort((u, v) => u[0] - v[0]);
    }
    units.forEach(([s, e]) => {
      let run = [];
      const flush = () => { if (run.length > 1) beams.push(run); run = []; };
      inBar.filter(x => x.a >= s && x.b <= e).forEach(x => {
        if (!flagged(x)) { flush(); return; }
        if (run.length && run[0].g !== x.g) flush();
        run.push(x);
      });
      flush();
    });
  });
  const dirFor = list => {
    if (perc) return 'up';
    let far = 0;
    list.forEach(x => { const d = x.step - mid; if (Math.abs(d) > Math.abs(far) || (Math.abs(d) === Math.abs(far) && d > 0)) far = d; });
    return far >= 0 ? 'down' : 'up';
  };
  beams.forEach((g, k) => { g.dir = dirFor(g); g.forEach(x => { x.dir = g.dir; x.beam = k; }); });
  A.forEach(x => { if (!x.rest && !x.dir) x.dir = dirFor([x]); });
  /* words over and under the staff */
  const syl = o.syllables ? A.map(x => ntSyl(x, x.snd ? x.snd.b - x.snd.a : x.b - x.a, x.bar.M, x.g)) : null;
  /* a triplet over two beats (3[q q q]) is counted on its own notes: 1 la li */
  const slotOf = x => x.g ? (x.a - x.g.a) / ((x.g.b - x.g.a) / 3) : -1;
  const cnt = o.counts ? A.map(x => x.g && x.g.b - x.g.a > 48 && slotOf(x) > 0 ? (['', 'la', 'li'][slotOf(x)] || '') : ntCount(x.a - x.bar.s, x.bar.M)) : null;
  /* with counts shown, every beat a note or rest holds needs room for its number */
  const beatsIn = x => x.bar.M.starts.filter(st => { const t = x.bar.s + ntTk(st); return t > x.a && t < x.b; }).length;
  const lab = o.labels ? A.map(x => o.labels[x.i] == null ? '' : String(o.labels[x.i])) : null;
  const tw = s => s ? String(s).length * 7.4 + 2 : 0;
  /* spacing: roughly proportional to duration, never tighter than the heads, dots, flags and words need */
  const prop = len => Math.max(22, 40 * Math.pow(len / 48, 0.6));
  A.forEach(x => {
    x.lead = x.acc ? 21 : 9;
    x.tail = 8 + (x.wv.dots ? 7 : 0) + (!x.rest && x.beam == null && NT_FLAGS[x.wv.b] > 0 && x.dir === 'up' ? 8 : 0);
    x.txt = Math.max(tw(syl && syl[x.i]), tw(cnt && cnt[x.i]), tw(lab && lab[x.i]));
  });
  const tsW = M => (M.num >= 10 ? 30 : 22);
  const xKey = perc ? 30 : 48, xTime = xKey + nAcc * 11 + (nAcc ? 4 : 0);
  let cx = xTime + tsW(B[0].M) + 2;
  B.forEach((bar, k) => {
    const its = A.filter(x => x.bar === bar);
    if (k > 0 && bar.M !== B[k - 1].M) { bar.tsX = cx + 5; cx += tsW(bar.M) + 8; }
    bar.x0 = cx;
    if (!its.length) { cx += 60; bar.x1 = cx; return; }
    if (its.length === 1 && its[0].wbr) { const w = Math.max(72, its[0].txt + 24, cnt ? bar.M.groups.length * 26 + 10 : 0); its[0].x = cx + w / 2 + 2; cx += w + 4; bar.x1 = cx; return; }
    its.forEach((x, j) => {
      if (j === 0) x.x = cx + Math.max(13 + x.lead, x.txt / 2 + 6);
      else { const p = its[j - 1]; x.x = p.x + Math.max(prop(p.b - p.a), p.tail + x.lead + 3, (p.txt + x.txt) / 2 + 6, cnt ? (beatsIn(p) + 1) * 26 : 0); }
    });
    const l = its[its.length - 1];
    cx = l.x + Math.max(prop(l.b - l.a) * 0.75, l.tail + 10, l.txt / 2 + 6, cnt ? (beatsIn(l) + 1) * 26 : 0);
    bar.x1 = cx;
  });
  const W = Math.ceil(cx + 6);
  let minY = perc ? -12 : 0, maxY = perc ? 12 : 40;
  const ext = (...ys) => ys.forEach(y => { if (y < minY) minY = y; if (y > maxY) maxY = y; });
  if (CL && CL.cclef) ext(yOf(28) - 21, yOf(28) + 21);
  const own = A.map(() => '');
  let shared = '';
  /* stems and beams */
  A.forEach(x => { if (!x.rest) { x.y = yOf(x.step); x.sx = x.dir === 'up' ? x.x + 5.6 : x.x - 5.6; ext(x.y - 6, x.y + 6); } });
  beams.forEach(g => {
    const up = g.dir === 'up', f = g[0], l = g[g.length - 1], nB = Math.max(...g.map(x => NT_FLAGS[x.wv.b]));
    const dx = (l.sx - f.sx) || 1;
    let rise = l.y - f.y;
    const concave = g.slice(1, -1).some(x => up ? x.y < Math.min(f.y, l.y) : x.y > Math.max(f.y, l.y));
    if (concave || f.step === l.step) rise = 0;
    rise = Math.max(-NT_GAP, Math.min(NT_GAP, rise * 0.5));
    if (Math.abs(rise / dx) > 0.2) rise = Math.sign(rise) * 0.2 * dx;
    const slope = rise / dx, minStem = (perc ? 25 : 27) + 7.5 * (nB - 1);
    let c;
    if (up) { c = Math.min(...g.map(x => x.y - minStem - slope * (x.sx - f.sx))); if (!perc) c = Math.min(c, ym, ym - slope * dx); }
    else { c = Math.max(...g.map(x => x.y + minStem - slope * (x.sx - f.sx))); if (!perc) c = Math.max(c, ym, ym - slope * dx); }
    const yb = xx => c + slope * (xx - f.sx);
    g.yb = yb;
    g.forEach(x => { x.end = yb(x.sx); });
    const T = 5, inward = up ? 1 : -1;
    const poly = (x1, x2, off, lev) => {
      const y1 = yb(x1) + inward * off, y2 = yb(x2) + inward * off;
      return `<path class="nt-beam" data-level="${lev}" d="M${ntN(x1)} ${ntN(y1)}L${ntN(x2)} ${ntN(y2)}L${ntN(x2)} ${ntN(y2 + inward * T)}L${ntN(x1)} ${ntN(y1 + inward * T)}Z"/>`;
    };
    shared += poly(f.sx - 0.65, l.sx + 0.65, 0, 1);
    for (let lev = 2; lev <= nB; lev++) {
      let k = 0;
      while (k < g.length) {
        if (NT_FLAGS[g[k].wv.b] < lev) { k++; continue; }
        let j = k; while (j + 1 < g.length && NT_FLAGS[g[j + 1].wv.b] >= lev) j++;
        if (j > k) shared += poly(g[k].sx - 0.65, g[j].sx + 0.65, (lev - 1) * 7.5, lev);
        else {
          const x = g[k], right = k === 0 || (k !== g.length - 1 && (x.a - x.bar.s) % 24 === 0);
          const len = Math.min(9, Math.abs((right ? g[k + 1].sx : g[k - 1].sx) - x.sx) * 0.55);
          shared += right ? poly(x.sx - 0.65, x.sx + len, (lev - 1) * 7.5, lev) : poly(x.sx - len, x.sx + 0.65, (lev - 1) * 7.5, lev);
        }
        k = j + 1;
      }
    }
    ext(c, yb(l.sx));
  });
  /* each event's own marks: ledger lines, accidental, head, stem, flags and dot, or its rest */
  A.forEach(x => {
    let s = '';
    if (x.rest) {
      const b = x.wv.b;
      s += ntRest(x.x, b === 'w' && perc ? 0 : ym, b, x.wv.dots, perc);
      ext(ym - 16, ym + (NT_FLAGS[b] > 1 ? 10 * NT_FLAGS[b] + 2 : 15));
      own[x.i] = s; return;
    }
    if (!perc) {
      const top = CL.bottom + 8;
      for (let st = top + 2; st <= x.step; st += 2) s += `<line class="nt-ledger" x1="${ntN(x.x - 10)}" x2="${ntN(x.x + 10)}" y1="${yOf(st)}" y2="${yOf(st)}"/>`;
      for (let st = CL.bottom - 2; st >= x.step; st -= 2) s += `<line class="nt-ledger" x1="${ntN(x.x - 10)}" x2="${ntN(x.x + 10)}" y1="${yOf(st)}" y2="${yOf(st)}"/>`;
    }
    if (x.acc) s += `<text class="nt-acc" x="${ntN(x.x - 15)}" y="${ntN(x.y + 5)}" text-anchor="middle">${x.acc}</text>`;
    s += ntHead(x.x, x.y, x.wv.b);
    if (x.wv.b !== 'w') {
      const up = x.dir === 'up', nF = NT_FLAGS[x.wv.b];
      if (x.end == null) {
        const len = (perc ? 30 : 35) + (nF > 1 ? (nF - 1) * 5 : 0);
        x.end = up ? (perc ? x.y - len : Math.min(x.y - len, ym)) : Math.max(x.y + len, ym);
        if (nF) s += ntFlags(x.sx, x.end, up, nF);
      }
      s += `<line class="nt-stem" x1="${ntN(x.sx)}" x2="${ntN(x.sx)}" y1="${ntN(x.y + (up ? -1 : 1))}" y2="${ntN(x.end)}"/>`;
      ext(x.end);
    }
    if (x.wv.dots) { const onLine = perc || (x.step - CL.bottom) % 2 === 0; s += `<circle class="nt-dot" cx="${ntN(x.x + (x.wv.b === 'w' ? 13 : 11))}" cy="${ntN(onLine ? x.y - 5 : x.y)}" r="1.9"/>`; }
    own[x.i] = s;
  });
  /* ties: under the heads when stems go up, over them when stems go down */
  A.forEach((x, k) => {
    const nx = A[k + 1];
    if (!nx || !nx.tie || x.rest || nx.rest) return;
    const below = perc || x.dir === 'up', sg = below ? 1 : -1;
    const x1 = x.x + 6 + (x.wv.dots ? 8 : 0), x2 = nx.x - 6, y = x.y + sg * 6, mx = (x1 + x2) / 2;
    const h = sg * Math.min(9, 4 + (x2 - x1) * 0.05);
    shared += `<path class="nt-tie" d="M${ntN(x1)} ${ntN(y)}Q${ntN(mx)} ${ntN(y + 2 * h)} ${ntN(x2)} ${ntN(y)}Q${ntN(mx)} ${ntN(y + 2 * h - sg * 2.6)} ${ntN(x1)} ${ntN(y)}Z"/>`;
    ext(y + h);
  });
  /* triplets: a 3 by the beam, or a bracket with a 3 when the notes are not beamed together */
  tg.forEach(g => {
    const xs = A.filter(x => g.idx.indexOf(x.i) >= 0), ns = xs.filter(x => !x.rest);
    const bg = ns.length === xs.length && ns.length > 1 && ns[0].beam != null && ns.every(x => x.beam === ns[0].beam) && beams[ns[0].beam].length === xs.length ? beams[ns[0].beam] : null;
    const up = perc || !ns.length || ns.filter(x => x.dir === 'up').length * 2 >= ns.length;
    const x1 = xs[0].x - 7, x2 = xs[xs.length - 1].x + 7, xm = (x1 + x2) / 2;
    if (bg) {
      const yb = bg.yb((bg[0].sx + bg[bg.length - 1].sx) / 2), ty = up ? yb - 5 : yb + 14;
      shared += `<text class="nt-tup" x="${ntN(xm)}" y="${ntN(ty)}" text-anchor="middle">3</text>`;
      ext(ty - 11, ty + 2);
      return;
    }
    const edge = xs.map(x => x.rest ? (up ? ym - 17 : ym + 16) : (x.end != null ? x.end : x.y + (up ? -8 : 8)));
    const yy = up ? Math.min(...edge, perc ? -12 : -2) - 8 : Math.max(...edge, 42) + 8, hk = up ? 5 : -5;
    shared += `<path class="nt-brk" d="M${ntN(x1)} ${ntN(yy + hk)}V${ntN(yy)}H${ntN(xm - 7)}M${ntN(xm + 7)} ${ntN(yy)}H${ntN(x2)}V${ntN(yy + hk)}"/><text class="nt-tup" x="${ntN(xm)}" y="${ntN(yy + 4.5)}" text-anchor="middle">3</text>`;
    ext(yy - 7, yy + 7);
  });
  /* rows of words: counts above; syllables, labels and marks below */
  const pts = [];
  B.forEach(bar => {
    const its = A.filter(x => x.bar === bar);
    if (its.length && !its[0].wbr) its.forEach(x => pts.push([x.a, x.x]));
    else pts.push([bar.s, bar.x0 + 18]);
    pts.push([Math.min(bar.s + bar.n, total), bar.x1 - 6]);
  });
  const xAt = t => {
    let k = 0; while (k + 1 < pts.length && pts[k + 1][0] <= t) k++;
    const [ta, xa] = pts[k], nx = pts[k + 1];
    return !nx || nx[0] === ta ? xa : xa + (t - ta) / (nx[0] - ta) * (nx[1] - xa);
  };
  let texts = '';
  if (cnt) {
    const y = minY - 9;
    B.forEach(bar => {
      const seen = new Set();
      A.filter(x => x.bar === bar && !x.wbr).forEach(x => { const c = cnt[x.i]; seen.add(x.a); if (c) texts += `<text class="nt-cnt${/^\d/.test(c) ? ' beat' : ''}" x="${ntN(x.x)}" y="${ntN(y)}" text-anchor="middle">${c}</text>`; });
      bar.M.starts.forEach((st, gi) => { const t = bar.s + ntTk(st); if (t >= 0 && t < total && !seen.has(t) && !tg.some(g => t > g.a && t < g.b)) texts +=`<text class="nt-cnt beat" x="${ntN(xAt(t))}" y="${ntN(y)}" text-anchor="middle">${gi + 1}</text>`; });
    });
    minY = y - 12;
  }
  let rowY = maxY + 17;
  if (syl) { A.forEach(x => { if (syl[x.i]) texts += `<text class="nt-syl" x="${ntN(x.x)}" y="${ntN(rowY)}" text-anchor="middle">${syl[x.i]}</text>`; }); rowY += 16; }
  if (lab && lab.some(Boolean)) { A.forEach(x => { if (lab[x.i]) texts += `<text class="nt-lab" x="${ntN(x.x)}" y="${ntN(rowY)}" text-anchor="middle">${esc(lab[x.i])}</text>`; }); rowY += 16; }
  if (o.marks) { A.forEach(x => { const mk = x.on != null && o.marks[x.on]; if (mk) texts += `<circle class="nt-mk ${mk === 'ok' ? 'ok' : 'no'}" cx="${ntN(x.x)}" cy="${ntN(rowY - 5)}" r="4.5"/>`; }); rowY += 8; }
  maxY = Math.max(maxY + 8, rowY - 10);
  minY -= 6;
  /* staff, clef, key, time and bar lines */
  let staff = '';
  const endX = B[B.length - 1].x1;
  if (perc) staff += `<line class="nt-sl" x1="4" x2="${ntN(endX)}" y1="0" y2="0"/><rect class="nt-pclef" x="12" y="-9" width="2.8" height="18"/><rect class="nt-pclef" x="18" y="-9" width="2.8" height="18"/>`;
  else {
    for (let i = 0; i < 5; i++) staff += `<line class="nt-sl" x1="4" x2="${ntN(endX)}" y1="${i * NT_GAP}" y2="${i * NT_GAP}"/>`;
    staff += CL.cclef ? ntCClef(9, yOf(28)) : `<text class="nt-clef" x="8" y="${CL.dy}" font-size="${CL.size}">${CL.glyph}</text>`;
    const list = ks > 0 ? CL.sharps : CL.flats;
    for (let i = 0; i < nAcc; i++) staff += `<text class="nt-acc" x="${xKey + i * 11}" y="${yOf(Staff.step(list[i])) + 5}" text-anchor="middle">${ks > 0 ? '♯' : '♭'}</text>`;
  }
  const tsig = (x, M) => perc
    ? `<text class="nt-ts" x="${ntN(x)}" y="-2" text-anchor="middle">${M.num}</text><text class="nt-ts" x="${ntN(x)}" y="17" text-anchor="middle">${M.den}</text>`
    : `<text class="nt-ts" x="${ntN(x)}" y="18" text-anchor="middle">${M.num}</text><text class="nt-ts" x="${ntN(x)}" y="38" text-anchor="middle">${M.den}</text>`;
  staff += tsig(xTime + tsW(B[0].M) / 2, B[0].M);
  const yt = perc ? -10 : 0, ybt = perc ? 10 : 40;
  B.forEach((bar, k) => {
    if (bar.tsX) staff += tsig(bar.tsX + tsW(bar.M) / 2, bar.M);
    if (k < B.length - 1) staff += `<line class="nt-bar" x1="${ntN(bar.x1)}" x2="${ntN(bar.x1)}" y1="${yt}" y2="${ybt}"/>`;
  });
  staff += `<line class="nt-bar" x1="${ntN(endX - 6)}" x2="${ntN(endX - 6)}" y1="${yt}" y2="${ybt}"/><rect class="nt-bar-end" x="${ntN(endX - 3.5)}" y="${yt}" width="4" height="${ybt - yt}"/>`;
  /* the events: groups that can be clicked, with a generous hit area when editable */
  let evs = '', bg = '';
  A.forEach((x, k) => {
    const cls = ['nt-ev'];
    if (x.on != null && o.marks && o.marks[x.on]) cls.push(o.marks[x.on] === 'ok' ? 'ok' : 'no');
    if (sel.has(x.i)) cls.push('sel');
    if (o.playing === x.i) cls.push('now');
    const l = k > 0 && A[k - 1].bar === x.bar ? (A[k - 1].x + x.x) / 2 : x.x - 14, r = k + 1 < A.length && A[k + 1].bar === x.bar ? (x.x + A[k + 1].x) / 2 : x.x + 16;
    if (sel.has(x.i)) bg += `<rect class="nt-selbg" x="${ntN(x.x - 12 - (x.acc ? 10 : 0))}" y="${ntN(minY + 4)}" width="${x.acc ? 34 : 24}" height="${ntN(maxY - minY - 8)}" rx="5"/>`;
    const hit = o.editable ? `<rect class="nt-hit" x="${ntN(l)}" y="${ntN(minY)}" width="${ntN(r - l)}" height="${ntN(maxY - minY)}"/>` : '';
    evs += `<g class="${cls.join(' ')}"${o.editable ? ` data-i="${x.i}"` : ''}>${hit}${own[x.i]}</g>`;
  });
  const words = [];
  A.forEach(x => { const w = ntName(x); if (x.tie && words.length) words[words.length - 1] += ' tied to ' + w; else words.push(w); });
  const aria = o.aria || `${perc || !A.some(x => x.p) ? 'Rhythm' : 'Melody'} in ${B[0].M.label}${B.length > 1 ? ', ' + B.length + ' bars' : ''}: ${words.join(', ')}`;
  const H = Math.ceil(maxY - minY);
  return `<svg class="ntn" viewBox="0 ${ntN(minY)} ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(aria)}">${bg}${staff}${shared}${evs}${texts}</svg>`;
}

const Score = {
  parse: ntParse, meter: ntMeter, normalize: ntNormalize, svg: ntSvg, onsets: ntOnsets, length: ntLength,
  toNotes: ntToNotes, play: ntPlay, quantize: ntQuantize, fromNotes: ntFromNotes,
  /* extras: spell a MIDI note for a key signature; a groove that makes a meter audible ({ meter, bpm, bars, pattern } → ms);
     wrong-answer variants that differ from a rhythm in one beat ((pattern, meter, k) → [events]); the label of the felt
     beat (♩. = 60 in 6/8 at bpm 90) */
  spell: ntSpell, groove: ntGroove, variants: ntDistractors,
  tempoLabel: (spec, bpm) => { const M = ntMeters(spec)[0]; return M.compound ? `♩. = ${Math.round(bpm / 1.5)}` : M.den === 2 ? `𝅗𝅥 = ${Math.round(bpm / 2)}` : `♩ = ${Math.round(bpm)}`; }
};

/* ---------- shared pieces of the rhythm tasks ---------- */
/* one light per beat group, as wide as the group: 7/8 shows short, short, long */
const ntBeatsHTML = M => `<div class="nt-beats" aria-hidden="true">${M.groups.map((g, i) => `<span class="${i === 0 ? 'strong' : M.accents.indexOf(i) > 0 ? 'acc' : ''}" style="flex-grow:${g}"></span>`).join('')}</div>`;
const ntMeterChip = M => M.label + (M.grouping ? ` <small>(${M.grouping})</small>` : '');
const ntTempoHTML = (spec, bpm) => esc(Score.tempoLabel(spec, bpm)).replace(/^(♩\.?|𝅗𝅥)/u, '<span class="nt-note">$1</span>');
/* ±12% of a beat, between 70 and 140 ms */
const ntTol = (M, spb) => Math.max(0.07, Math.min(0.14, 0.12 * (M.compound ? 1.5 : M.den === 2 ? 2 : 1) * spb));
function ntLights(lights, beats) {
  if (!lights.length || !beats.length) return () => {};
  const stop = scheduleLights(lights, beats.map(b => b.t), i => beats[i].gi % lights.length);
  const last = beats[beats.length - 1], id = setTimeout(() => lights.forEach(l => l.classList.remove('lit')), Math.max(0, (last.t - Sound.now()) * 1000 + 450));
  return () => { stop(); clearTimeout(id); lights.forEach(l => l.classList.remove('lit')); };
}
/* score claps against a rhythm: every sounding onset needs a clap within tol; one stray clap is forgiven (as in
   Levels 1 and 2), but not a clap on a tied note or a rest. Mic claps arrive already corrected for mic delay. */
function ntScoreTaps(taps, input, tm, tol) {
  const A = ntAtoms(ntParse(input)), at = x => tm(ntQ(x.a)), start = tm(0);
  const exp = A.filter(x => !x.rest && !x.tie).map(at);
  const used = new Set(), marks = [];
  let hit = 0;
  exp.forEach(t => {
    let best = -1, bd = 1;
    taps.forEach((o, k) => { if (!used.has(k) && Math.abs(o - t) < bd) { bd = Math.abs(o - t); best = k; } });
    if (best >= 0 && bd <= tol) { used.add(best); hit++; marks.push('ok'); } else marks.push('no');
  });
  const extras = taps.filter((o, k) => !used.has(k) && o > start - 0.15);
  const near = pick => extras.some(o => A.some(x => pick(x) && Math.abs(o - at(x)) <= tol));
  const onTie = near(x => x.tie && !x.rest), onRest = near(x => x.rest);
  return { marks, hit, n: exp.length, extras: extras.length, onTie, onRest, ok: hit === exp.length && extras.length <= 1 && !onTie && !onRest };
}
function ntTapWords(res) {
  let tip = ' Hear it again, then retry.';
  if (res.onTie) tip = ' A tie makes one sound: clap the first note and hold through the second.';
  else if (res.onRest) tip = ' Rests are silent: no clap on the “sh”.';
  return `${res.hit} of ${res.n} notes landed${res.extras ? `, plus ${res.extras} extra clap${res.extras > 1 ? 's' : ''}` : ''}.${res.hit < res.n ? ' Red dots show the ones to fix.' : ''}` + tip;
}
/* rounds from a pool: the first pattern first (usually the easiest), then the rest shuffled, repeating if needed */
function ntRounds(pool, n) {
  const list = [pool[0]].concat(shuffle(pool.slice(1)));
  while (list.length < n) list.push(...shuffle(pool));
  return list.slice(0, n);
}

/* Hear a rhythm, then clap or tap it back after a count-in that follows the meter.
   p: { patterns: [shorthand], meter, bpm, swing, rounds, counts, syllables, prompt, once (one try), pass (rounds that
   must land; each round is then one try), showNotation (default true; false hides it until after a try), countIn, pickup }
   done(true, { ok, score }): score is the rounds that landed on the first try */
Tasks.rhythmTap = (el, p, done) => {
  const spec = p.meter || '4/4', M = ntMeters(spec)[0], bpm = p.bpm || 80, spb = 60 / bpm;
  const rounds = p.once ? 1 : Math.max(1, p.rounds || Math.min(3, p.patterns.length));
  const list = ntRounds(p.patterns, rounds).map(x => ntNormalize(x, spec, { pickup: p.pickup })), test = p.pass != null && !p.once, show = p.showNotation !== false;
  const tol = ntTol(M, spb);
  let r = 0, score = 0, first = true, taps = [], listening = false, timers = [], pl = null, unlight = null, over = false, pending = false;
  el.innerHTML = `<div class="nt-task"><p class="prompt">${p.prompt || 'Listen, then clap or tap the rhythm back.'}</p>
    <div class="nt-chips"><span class="chip">${ntMeterChip(M)}</span><span class="chip">${ntTempoHTML(spec, bpm)}</span>${p.swing && p.swing > 0.52 ? '<span class="chip">swung</span>' : ''}</div>
    <div class="nt-box"></div>${ntBeatsHTML(M)}${tapPadHTML()}
    <div class="row"><button type="button" class="btn" data-act="hear">▶ Hear it</button><button type="button" class="btn primary" data-act="go">My turn</button>${rounds > 1 ? `<div class="progress-dots">${'<span></span>'.repeat(rounds)}</div>` : ''}</div>
    <p class="fb info" aria-live="polite">${Mic.state === 'on' ? 'Clap after the count-in. The mic is listening.' : 'After the count-in, tap the pad, press Space, or clap with the mic on.'}</p>
    <div class="row" data-retry hidden><button type="button" class="btn small" data-act="retry">Try again</button></div></div>`;
  wireTapPad(el);
  const box = el.querySelector('.nt-box'), lights = [...el.querySelectorAll('.nt-beats span')], f = el.querySelector('.fb');
  const dots = el.querySelectorAll('.progress-dots span'), hear = el.querySelector('[data-act="hear"]'), go = el.querySelector('[data-act="go"]'), retry = el.querySelector('[data-retry]');
  const off = Bus.on('onset', d => { if (listening) taps.push(d.t); });
  const draw = (marks, reveal) => {
    box.innerHTML = show || reveal ? ntSvg(list[r], { meter: spec, clef: 'perc', counts: p.counts, syllables: p.syllables, marks, pickup: p.pickup }) : '<p class="nt-hidden">Listen first. The notation appears after your try.</p>';
  };
  function stopAll() {
    timers.forEach(clearTimeout); timers = [];
    if (pl) { pl.stop(); pl = null; }
    if (unlight) { unlight(); unlight = null; }
    listening = false;
  }
  const advance = () => { if (!pending) return; pending = false; draw(); fb(f, 'info', 'Next rhythm. Hear it first.'); };
  hear.onclick = () => {
    advance(); stopAll();
    pl = ntPlay(list[r], { meter: spec, bpm, swing: p.swing, countIn: 1, pickup: p.pickup });
    if (pl) unlight = ntLights(lights, pl.beats);
  };
  go.onclick = () => {
    if (over || !Sound.ensure()) return;
    advance(); stopAll();
    go.disabled = true; hear.disabled = true; taps = [];
    const quiet = Mic.state === 'on';
    pl = ntPlay([{ d: ntLength(list[r]), rest: true }], { meter: spec, bpm, swing: p.swing, countIn: p.countIn || 1, click: !quiet, pickup: p.pickup });
    unlight = ntLights(lights, pl.beats);
    fb(f, 'info', 'Count-in…');
    const start = pl.start, end = pl.end, tm = pl.time;
    timers.push(setTimeout(() => { listening = true; fb(f, 'info', 'Your turn.'); }, Math.max(0, (start - Sound.now() - 0.4 * spb) * 1000)));
    timers.push(setTimeout(() => judge(tm), Math.max(0, (end - Sound.now() + 0.55) * 1000)));
  };
  function judge(tm) {
    listening = false;
    const res = ntScoreTaps(taps, list[r], tm, tol);
    draw(res.marks, true);
    go.disabled = false; hear.disabled = false;
    if (p.once) { over = true; go.disabled = true; hear.disabled = true; fb(f, res.ok ? 'good' : 'bad', res.ok ? 'Every note landed.' : ntTapWords(res).replace(' Hear it again, then retry.', '')); done(true, { ok: res.ok, score: res.ok ? 1 : 0 }); return; }
    if (test) {
      if (dots[r]) dots[r].classList.add(res.ok ? 'on' : 'miss');
      if (res.ok) score++;
      fb(f, res.ok ? 'good' : 'bad', res.ok ? 'Every note landed.' : ntTapWords(res).replace(' Hear it again, then retry.', ''));
      r++;
      if (r < rounds) { pending = true; timers.push(setTimeout(advance, 1800)); return; }
      over = true; go.disabled = true; hear.disabled = true;
      if (score >= p.pass) { fb(f, 'good', `${score} of ${rounds} landed.`); done(true, { ok: true, score }); }
      else { fb(f, 'bad', `${score} of ${rounds} landed. You need ${p.pass}.`); retry.hidden = false; }
      return;
    }
    if (res.ok) {
      if (dots[r]) dots[r].classList.add('on');
      if (first) score++;
      first = true; r++;
      fb(f, 'good', 'Every note landed.');
      if (r >= rounds) { over = true; go.disabled = true; hear.disabled = true; done(true, { ok: true, score }); }
      else { pending = true; timers.push(setTimeout(advance, 1600)); }
    } else { first = false; fb(f, 'bad', ntTapWords(res)); }
  }
  el.querySelector('[data-act="retry"]').onclick = () => { stopAll(); r = 0; score = 0; over = false; pending = false; retry.hidden = true; dots.forEach(d => { d.className = ''; }); go.disabled = false; hear.disabled = false; draw(); fb(f, 'info', 'From the top. Hear it first.'); };
  draw();
  return () => { off(); stopAll(); };
};

/* fragments that fill one beat group, for wrong answers that differ from the right one in a single beat */
const NT_FRAGS = {
  48: ['q', 'e e', 'e. s', 's s e', 'e s s', 's s s s', '3[e e e]', 'qr', 'er e', 's e s'],
  72: ['q.', 'q e', 'e q', 'e e e', 'e. s e', 's s e e', 'e e s s', 'er e e', 'q er', 'e er e'],
  96: ['h', 'q q', 'q. e', 'e e q', 'q e e', 'e e e e', 'qr q', 'q qr']
};
const ntKey = ev => ntNormalize(ev, '4/4').map(e => ntTk(e.d) + (e.rest ? 'r' : e.tie ? 't' : 'n')).join(' ');
function ntDistractors(pattern, spec, k) {
  const ev = ntNormalize(pattern, spec), A = ntAtoms(ev), total = A.length ? A[A.length - 1].b : 0;
  const bars = ntBars(spec, total), wins = [];
  bars.forEach(bar => bar.M.groups.forEach((g, gi) => {
    const s = bar.s + ntTk(bar.M.starts[gi]), e = s + ntTk(g);
    if (e <= total && !A.some(x => (x.a < s && x.b > s) || (x.a < e && x.b > e))) wins.push({ s, e, n: e - s });
  }));
  const useT = A.some(x => x.tup), out = [], seen = new Set([ntKey(ev)]);
  for (let tries = 0; tries < 80 && out.length < k && wins.length; tries++) {
    const w = rand(wins), frags = (NT_FRAGS[w.n] || []).filter(x => useT || x.indexOf('[') < 0);
    if (!frags.length) continue;
    const before = A.filter(x => x.b <= w.s), after = A.filter(x => x.a >= w.e);
    const cand = before.map(x => ev[x.i]).concat(ntParse(rand(frags)), after.map(x => ev[x.i]));
    if (after.length && after[0].tie) continue;
    if (cand.every(x => x.rest)) continue;
    const key = ntKey(cand);
    if (seen.has(key)) continue;
    seen.add(key); out.push(ntNormalize(cand, spec));
  }
  return out;
}
/* undo swing on tap times so a swung performance quantizes to the even eighths it was written with */
function ntUnswing(t, start, spb, sw) {
  if (sw == null || Math.abs(sw - 0.5) < 1e-3) return t;
  const q = (t - start) / spb, b = Math.floor(q), f = q - b;
  return start + (b + (f < sw ? f * 0.5 / sw : 0.5 + (f - sw) * 0.5 / (1 - sw))) * spb;
}

/* Rhythmic dictation: hear a rhythm without seeing it.
   p: { patterns, meter, bpm, swing, rounds, mode: 'choose' | 'tap', pass, prompt }
   choose: pick the notation among three or four that differ in one beat. tap: tap it back after a count-in; the taps are
   quantized and written under the answer so the two can be compared. done(true, { score }) */
Tasks.rhythmDictation = (el, p, done) => {
  const spec = p.meter || '4/4', M = ntMeters(spec)[0], bpm = p.bpm || 80, spb = 60 / bpm, rounds = Math.max(1, p.rounds || 3);
  const list = ntRounds(p.patterns, rounds);
  let pl = null;
  const stopPl = () => { if (pl) pl.stop(); pl = null; };
  if ((p.mode || 'choose') === 'choose') {
    el.innerHTML = `<div class="nt-task nt-dict">${p.prompt ? `<p class="lead">${p.prompt}</p>` : ''}<div class="nt-chips"><span class="chip">${ntMeterChip(M)}</span><span class="chip">${ntTempoHTML(spec, bpm)}</span></div><div class="nt-quiz"></div></div>`;
    const inner = Tasks.quiz(el.querySelector('.nt-quiz'), {
      rounds, pass: p.pass || 0,
      gen: i => {
        const pat = list[i], opts = shuffle([pat].concat(ntDistractors(pat, spec, 3)));
        return {
          q: 'Listen. Which rhythm did you hear?', playLabel: 'Hear it again',
          options: opts.map(x => `<span class="nt-opt">${ntSvg(ntNormalize(x, spec), { meter: spec, clef: 'perc' })}</span>`), answer: opts.indexOf(pat),
          play: () => { stopPl(); pl = ntPlay(pat, { meter: spec, bpm, swing: p.swing, countIn: 1 }); },
          why: ok => ok ? 'Right: that is what played.' : 'The green one is what played. Hear it again and follow it with your eyes.'
        };
      }
    }, (ok, r) => done(true, { score: r.score }));
    return () => { inner(); stopPl(); };
  }
  const grids = list.some(x => ntParse(x).some(e => e.tup)) ? ['e', 's', 't'] : ['e', 's'];
  let r = 0, score = 0, tried = false, taps = [], listening = false, timers = [], unlight = null;
  el.innerHTML = `<div class="nt-task"><p class="prompt">${p.prompt || 'Listen, then tap the rhythm back. Your taps are written out under the answer.'}</p>
    <div class="nt-chips"><span class="chip">${ntMeterChip(M)}</span><span class="chip">${ntTempoHTML(spec, bpm)}</span></div>
    <div class="nt-box nt-target"></div><div class="nt-yours" hidden><div class="eyebrow">You tapped</div><div class="nt-box nt-mine"></div></div>
    ${ntBeatsHTML(M)}${tapPadHTML()}
    <div class="row"><button type="button" class="btn" data-act="hear">▶ Hear it</button><button type="button" class="btn primary" data-act="go">My turn</button><button type="button" class="btn" data-act="more" hidden>Next rhythm</button><div class="progress-dots">${'<span></span>'.repeat(rounds)}</div></div>
    <p class="fb info" aria-live="polite">Hear it as often as you like. Then tap it after the count-in.</p>
    <div class="row" data-retry hidden><button type="button" class="btn small" data-act="retry">Try again</button></div></div>`;
  wireTapPad(el);
  const tgt = el.querySelector('.nt-target'), yours = el.querySelector('.nt-yours'), mine = el.querySelector('.nt-mine'), f = el.querySelector('.fb');
  const lights = [...el.querySelectorAll('.nt-beats span')], dots = el.querySelectorAll('.progress-dots span');
  const hear = el.querySelector('[data-act="hear"]'), go = el.querySelector('[data-act="go"]'), next = el.querySelector('[data-act="more"]'), retry = el.querySelector('[data-retry]');
  const off = Bus.on('onset', d => { if (listening) taps.push(d.t); });
  const hide = () => { tgt.innerHTML = '<p class="nt-hidden">The notation appears after you tap.</p>'; yours.hidden = true; };
  function stopAll() { timers.forEach(clearTimeout); timers = []; stopPl(); if (unlight) { unlight(); unlight = null; } listening = false; }
  hear.onclick = () => { stopAll(); pl = ntPlay(list[r], { meter: spec, bpm, swing: p.swing, countIn: 1 }); if (pl) unlight = ntLights(lights, pl.beats); };
  go.onclick = () => {
    if (!Sound.ensure()) return;
    stopAll(); go.disabled = true; hear.disabled = true; next.hidden = true; taps = [];
    pl = ntPlay([{ d: ntLength(list[r]), rest: true }], { meter: spec, bpm, countIn: 1, click: Mic.state !== 'on' });
    unlight = ntLights(lights, pl.beats);
    fb(f, 'info', 'Count-in…');
    const start = pl.start, end = pl.end;
    timers.push(setTimeout(() => { listening = true; fb(f, 'info', 'Your turn.'); }, Math.max(0, (start - Sound.now() - 0.4 * spb) * 1000)));
    timers.push(setTimeout(() => judge(start), Math.max(0, (end - Sound.now() + 0.55) * 1000)));
  };
  function judge(start) {
    listening = false; go.disabled = false; hear.disabled = false;
    const target = ntNormalize(list[r], spec), nb = ntBars(spec, ntTk(ntLength(target))).length;
    const got = ntQuantize(taps.map(t => ({ t: ntUnswing(t, start, spb, p.swing) })), { bpm, meter: spec, start, bars: nb, grids });
    const tOn = ntAtoms(target).filter(x => !x.rest && !x.tie).map(x => x.a), gOn = ntAtoms(got).filter(x => !x.rest && !x.tie).map(x => x.a);
    const ok = tOn.length === gOn.length && tOn.every((a, k) => a === gOn[k]);
    tgt.innerHTML = ntSvg(target, { meter: spec, clef: 'perc', marks: tOn.map(a => gOn.indexOf(a) >= 0 ? 'ok' : 'no') });
    yours.hidden = false;
    mine.innerHTML = taps.length ? ntSvg(got, { meter: spec, clef: 'perc', marks: gOn.map(a => tOn.indexOf(a) >= 0 ? 'ok' : 'no') }) : '<p class="nt-hidden">No taps came in.</p>';
    const hits = tOn.filter(a => gOn.indexOf(a) >= 0).length;
    if (!tried) { if (dots[r]) dots[r].classList.add(ok ? 'on' : 'miss'); if (ok) score++; tried = true; }
    fb(f, ok ? 'good' : 'bad', ok ? 'Exactly right: your taps write out the same rhythm.' : `${hits} of ${tOn.length} notes in the right place${gOn.length > hits ? `, and ${gOn.length - hits} extra` : ''}. Red marks the differences. Hear it again and tap it again, or move on.`);
    go.textContent = 'Tap it again';
    if (r + 1 < rounds) { next.hidden = false; next.textContent = 'Next rhythm'; }
    else finish();
  }
  function finish() {
    if (score >= (p.pass || 0)) { next.hidden = true; done(true, { score }); }
    else { retry.hidden = false; fb(f, 'bad', `${score} of ${rounds} right on the first try. You need ${p.pass}.`); }
  }
  next.onclick = () => { stopAll(); r++; tried = false; next.hidden = true; go.textContent = 'My turn'; hide(); fb(f, 'info', 'Next rhythm. Hear it first.'); };
  el.querySelector('[data-act="retry"]').onclick = () => { stopAll(); r = 0; score = 0; tried = false; retry.hidden = true; go.textContent = 'My turn'; dots.forEach(d => { d.className = ''; }); hide(); fb(f, 'info', 'From the top.'); };
  hide();
  return () => { off(); stopAll(); };
};

/* a short groove that makes a meter audible: bass on the downbeat (and on the accent beats of 5/4 and 7/4), a chord on the
   other beats, a click on every beat and a soft tick on every eighth. it: { meter, pattern?, bpm, bars, root } → ms */
function ntGroove(it) {
  const ctx = Sound.ensure(); if (!ctx) return 0;
  const spec = it.meter || '4/4', spb = 60 / (it.bpm || 96), B = ntBars(spec, 0, it.bars || 2), root = it.root || 48;
  const t0 = ctx.currentTime + 0.12;
  B.forEach(bar => {
    const M = bar.M, bs = t0 + ntQ(bar.s) * spb;
    M.groups.forEach((g, gi) => {
      const t = bs + M.starts[gi] * spb;
      if (gi === 0) Sound.tone(root, t, g * spb * 0.9, 0.85);
      else if (M.accents.indexOf(gi) > 0) Sound.tone(root + 7, t, g * spb * 0.8, 0.65);
      else Sound.chord([root + 16, root + 19, root + 24], t, Math.min(g, 1) * spb * 0.45, 0.3);
      Sound.click(t, gi === 0, gi !== 0);
      for (let e = 0.5; e < g - 1e-9; e += 0.5) Sound.click(t + e * spb, false, true);
    });
  });
  const len = B.reduce((s, b) => s + ntQ(b.n), 0);
  if (it.pattern) ntParse(it.pattern).reduce((at, e) => { if (!e.rest && !e.tie) Sound.wood(t0 + at * spb); return at + e.d; }, 0);
  return (t0 - ctx.currentTime + len * spb) * 1000;
}
const NT_COUNTS = { 2: 'duple', 3: 'triple', 4: 'quadruple', 5: 'quintuple', 7: 'septuple' };
/* which choice names this meter: a meter ('6/8'), words ('compound duple', 'simple triple', 'irregular'), or 'N beats' */
function ntMeterAnswer(it, choices) {
  if (it.answer != null) return typeof it.answer === 'number' ? it.answer : choices.indexOf(it.answer);
  const M = ntMeters(it.meter)[0], beats = M.den >= 8 ? M.groups.length : M.num;
  const words = new Set([M.compound ? 'compound' : M.irregular ? 'irregular' : 'simple', NT_COUNTS[beats] || '', M.irregular || M.num === 5 || M.num === 7 ? 'odd' : '']);
  const VOCAB = ['simple', 'compound', 'irregular', 'odd', 'duple', 'triple', 'quadruple', 'quintuple', 'septuple'];
  let best = -1, bestN = -1;
  choices.forEach((c, i) => {
    const s = String(c).toLowerCase().trim(), m = /^(\d+)\/(\d+)/.exec(s);
    if (m) { if (+m[1] === M.num && +m[2] === M.den && bestN < 99) { best = i; bestN = 99; } return; }
    const nb = /(\d+)\s*beats?/.exec(s);
    if (nb) { if (+nb[1] === beats && bestN < 50) { best = i; bestN = 50; } return; }
    const ws = s.split(/[\s,]+/).filter(w => VOCAB.indexOf(w) >= 0);
    if (!ws.length || ws.some(w => !words.has(w))) return;
    if (ws.length > bestN) { best = i; bestN = ws.length; }
  });
  return best;
}
/* Hear a short groove and say what you heard.
   p: { rounds, choices: ['simple duple', 'simple triple', 'compound duple', …] or meters ['3/4', '6/8'],
        items: [{ meter, pattern?, bpm, bars, answer? }], prompt, q, pass } → done(true, { score }) */
Tasks.meterFeel = (el, p, done) => {
  const choices = p.choices || ['simple duple', 'simple triple', 'compound duple'], rounds = p.rounds || 4;
  const order = ntRounds(shuffle(p.items), rounds);
  const why = it => {
    const M = ntMeters(it.meter)[0], g = M.grouping ? ` (${M.grouping})` : '';
    const kind = M.compound ? `compound: ${M.groups.length} beats, each split in three` : M.irregular ? `odd: beats of two and three eighths${g}` : `simple: ${M.num} beats${g}, each split in two`;
    return `${M.label}, ${kind}.`;
  };
  return Tasks.quiz(el, {
    rounds, pass: p.pass || 0, prompt: p.prompt,
    gen: i => {
      const it = order[i], answer = ntMeterAnswer(it, choices);
      if (answer < 0) throw new Error('No choice fits ' + it.meter);
      return { q: p.q || 'Listen to the groove. What do you hear?', options: choices.slice(), answer, play: () => ntGroove(it), playLabel: 'Hear it again', why: why(it) };
    }
  }, (ok, r) => done(true, { score: r.score }));
};

/* ---------- MelodyCapture: record, see and edit a melody ----------
   MelodyCapture.mount(el, { meter, bpm, bars, keySig, clef ('treble' 'bass' 'alto' 'tenor' 'perc'), countIn (bars, default 1), pcs, pcsLabel, initial (events),
     prompt, swing, onChange(events) })
   → { events, notes, bpm, record(), stop(), play(), clear(), set(events), setSwing(v), select(i), destroy() }
   Recording takes Bus 'note' from any source (a 'perc' clef takes 'onset' instead: taps, Space, claps) and 'noteoff'
   for releases, stops by itself after `bars`, and quantizes. The editor works on the selected note: buttons, or keys
   while the score has focus: ↑/↓ half step, Shift+↑/↓ octave, ←/→ previous/next, [ and ] halve/double, . dot,
   Delete rest, Z undo. Playing a key while a note is selected gives it that pitch. Bars always stay full. */
let ntUid = 0;
const MelodyCapture = {
  mount(el, o) {
    const given = {}; Object.keys(o || {}).forEach(k => { if (o[k] !== undefined) given[k] = o[k]; });
    o = Object.assign({ meter: '4/4', bpm: 90, bars: 2, keySig: 0, clef: 'treble', countIn: 1, pcs: null }, given);
    const spec = o.meter, M0 = ntMeters(spec)[0], perc = o.clef === 'perc', uid = ++ntUid;
    const totalTk = () => { const b = ntBars(spec, 0, o.bars), l = b[b.length - 1]; return l.s + l.n; };
    let bpm = o.bpm, swing = o.swing, events = [], sel = null, undo = [], recording = false, rec = null, pl = null, timers = [], hits = [], before = null, alive = true;
    el.innerHTML = `<div class="nt-cap">
      ${o.prompt ? `<p class="prompt">${o.prompt}</p>` : ''}
      <div class="nt-tools"><div class="row">
        <button type="button" class="btn small primary" data-c="rec">● Record</button><button type="button" class="btn small" data-c="stop" disabled>■ Stop</button>
        <button type="button" class="btn small" data-c="play">▶ Play</button><button type="button" class="btn small ghost" data-c="clear">Clear</button>
      </div><div class="row">
        <label class="nt-tempo"><span>Tempo</span><input type="range" min="40" max="176" step="2" value="${bpm}" aria-label="Tempo, quarter notes per minute"><span class="mono" data-c="bpm">${ntTempoHTML(spec, bpm)}</span></label>
        <label class="toggle nt-met"><input type="checkbox" data-c="met"> Click along</label>
      </div></div>
      ${ntBeatsHTML(M0)}
      <div class="nt-box nt-edit" tabindex="0" role="group" aria-label="Your score. Click a note to edit it; arrow keys change it."></div>
      <div class="nt-ed" role="toolbar" aria-label="Edit the selected note">
        <button type="button" class="btn small" data-e="prev" aria-label="Previous note" title="Previous (←)">←</button><button type="button" class="btn small" data-e="next" aria-label="Next note" title="Next (→)">→</button>
        ${perc ? '' : `<button type="button" class="btn small" data-e="up" aria-label="Half step up" title="Half step up (↑)">↑</button><button type="button" class="btn small" data-e="down" aria-label="Half step down" title="Half step down (↓)">↓</button><button type="button" class="btn small" data-e="oup" title="Octave up (Shift+↑)">8va ↑</button><button type="button" class="btn small" data-e="odown" title="Octave down (Shift+↓)">8va ↓</button>`}
        <button type="button" class="btn small" data-e="half" title="Halve the length ([)">½</button><button type="button" class="btn small" data-e="double" title="Double the length (])">×2</button><button type="button" class="btn small" data-e="dot" title="Dot (.)">Dot</button>
        <button type="button" class="btn small" data-e="rest" title="Make it a rest (Delete)">${perc ? 'Note / rest' : 'Rest'}</button><button type="button" class="btn small ghost" data-e="undo" title="Undo (Z)">Undo</button>
      </div>
      <p class="nt-info" aria-live="polite"></p>
      <p class="fb info" aria-live="polite">${perc ? 'Press Record, wait for the count-in, then tap the pad below, press Space, or clap.' : 'Press Record, wait for the count-in, then play. Any keys, MIDI or the mic.'}</p>
      ${perc ? tapPadHTML() : ''}
    </div>`;
    if (perc) wireTapPad(el);
    const $ = s => el.querySelector(s);
    const box = $('.nt-edit'), info = $('.nt-info'), f = $('.fb'), lights = [...el.querySelectorAll('.nt-beats span')];
    const bRec = $('[data-c="rec"]'), bStop = $('[data-c="stop"]'), bPlay = $('[data-c="play"]'), bClear = $('[data-c="clear"]');
    const rng = $('.nt-tempo input'), bpmTxt = $('[data-c="bpm"]'), met = $('[data-c="met"]');
    const edBtns = [...el.querySelectorAll('[data-e]')];
    let unlight = null;
    function fit(evs) {
      let e = ntParse(evs || []);
      const len = ntAtoms(e).reduce((s, x) => Math.max(s, x.b), 0);
      if (len > totalTk()) o.bars = ntBars(spec, len).length;
      if (len < totalTk()) e = e.concat([{ d: ntQ(totalTk() - len), p: null, rest: true, tie: false, tup: 0 }]);
      return ntNormalize(e, spec);
    }
    const sounds = () => ntSounds(events);
    const cur = () => { if (sel == null) return null; const S = sounds(), k = S.findIndex(s => s.a <= sel && sel < s.b); return k < 0 ? null : { S, k, s: S[k] }; };
    function describe(s) {
      const bars = ntBars(spec, 0, o.bars), bar = ntBarAt(bars, s.a), rel = s.a - bar.s, len = s.b - s.a;
      const w = ntWhere(rel, bar.M), c = ntCount(rel, bar.M);
      const v = ntVal(s.tup ? len * 1.5 : len), nm = v ? (v.dots ? 'dotted ' : '') + (s.tup ? 'triplet ' : '') + NT_NAME[v.b] : ntQ(len) + ' beats';
      return `Bar ${bar.k + 1}, beat ${w.gi + 1}${c && !/^\d/.test(c) ? ' ' + c : ''}: ${s.rest ? nm + ' rest' : (s.p ? Theory.pretty(s.p) + ', ' : '') + nm}.`;
    }
    function render() {
      const c = cur();
      if (c) sel = c.s.a;
      const idx = []; if (c) for (let i = c.s.i; i <= c.s.j; i++) idx.push(i);
      box.innerHTML = ntSvg(events, { meter: spec, clef: o.clef, keySig: o.keySig, editable: true, selected: idx });
      edBtns.forEach(b => { b.disabled = b.dataset.e === 'undo' ? !undo.length : (!c || recording); });
      info.textContent = recording ? '' : c ? describe(c.s) + (perc ? '' : ' Play a key to change its pitch.') : 'Click a note to edit it.';
    }
    const emit = () => { if (o.onChange) o.onChange(events.map(ntClone)); };
    function commit(next) { undo.push(events); if (undo.length > 60) undo.shift(); events = next; render(); emit(); }
    /* rebuild events from sounds, keeping the triplet groups that were there */
    function rebuild(S) {
      const R = ntTupGroups(ntAtoms(events)).map(g => ({ a: g.a, b: g.b })), merged = [], ev = [];
      S.forEach(s => { if (s.b <= s.a) return; const last = merged[merged.length - 1]; if (last && last.rest && s.rest) { last.b = s.b; return; } merged.push(Object.assign({}, s)); });
      merged.forEach(s => {
        const pts = [s.a]; R.forEach(r => [r.a, r.b].forEach(t => { if (t > s.a && t < s.b) pts.push(t); }));
        pts.sort((x, y) => x - y); pts.push(s.b);
        for (let k = 0; k + 1 < pts.length; k++) {
          const a = pts[k], b = pts[k + 1];
          ev.push({ d: ntQ(b - a), p: s.rest ? null : s.p, rest: s.rest, tie: !s.rest && k > 0, tup: R.some(r => a >= r.a && b <= r.b) ? 3 : 0 });
        }
      });
      return ntNormalize(ev, spec);
    }
    const copy = () => sounds().map(s => ({ a: s.a, b: s.b, p: s.p, rest: s.rest, tup: s.tup }));
    /* change one sound's length; the next sound (rest or note) shrinks or stretches so the bars stay full */
    function setLen(S, k, nl) {
      const s = S[k], old = s.b - s.a;
      if (nl > old) {
        let need = nl - old;
        if (S.slice(k + 1).reduce((t, x) => t + x.b - x.a, 0) < need) return null;
        s.b = s.a + nl;
        for (let j = k + 1; need > 0; j++) { const take = Math.min(need, S[j].b - S[j].a); S[j].a += take; need -= take; }
      } else if (nl < old) {
        s.b = s.a + nl;
        if (k + 1 < S.length) S[k + 1].a = s.b; else S.push({ a: s.b, b: s.a + old, p: null, rest: true, tup: false });
      }
      return S.filter(x => x.b > x.a);
    }
    const defPitch = () => o.clef === 'bass' ? 'C3' : 'C4';
    function pitchOf(S, k) { for (let j = k - 1; j >= 0; j--) if (!S[j].rest && S[j].p) return S[j].p; for (let j = k + 1; j < S.length; j++) if (!S[j].rest && S[j].p) return S[j].p; return defPitch(); }
    const say = (kind, text) => fb(f, kind, text);
    function edit(op) {
      if (recording) return;
      if (op === 'undo') { if (!undo.length) return; events = undo.pop(); render(); emit(); say('info', 'Undone.'); return; }
      const c = cur(); if (!c) return;
      const S = copy(), k = c.k, s = S[k], len = s.b - s.a;
      if (op === 'prev' || op === 'next') { const j = Math.max(0, Math.min(S.length - 1, k + (op === 'prev' ? -1 : 1))); sel = S[j].a; render(); return; }
      let out = null, sound = null;
      if (op === 'up' || op === 'down' || op === 'oup' || op === 'odown') {
        if (perc) { if (!s.rest) return; s.rest = false; s.p = null; out = S; }
        else if (s.rest) { s.rest = false; s.p = pitchOf(S, k); out = S; sound = s.p; }
        else {
          const by = { up: 1, down: -1, oup: 12, odown: -12 }[op];
          let m = Theory.midi(s.p) + by;
          if (o.pcs && Math.abs(by) === 1) { let g = 0; while (o.pcs.indexOf(mod12(m)) < 0 && g++ < 12) m += by; }
          if (m < 36 || m > 96) { say('info', 'That is as far as it goes.'); return; }
          s.p = ntSpell(m, o.keySig); out = S; sound = s.p;
        }
      } else if (op === 'half' || op === 'double' || op === 'dot') {
        let nl;
        if (op === 'half') nl = len / 2;
        else if (op === 'double') nl = len * 2;
        else {
          const v = ntVal(s.tup ? len * 1.5 : len);
          if (s.tup || !v) { say('info', s.tup ? 'Triplet notes take no dot here.' : 'This length can’t take a dot.'); return; }
          nl = v.dots ? len * 2 / 3 : len * 1.5;
        }
        if (!Number.isInteger(nl) || nl < (s.tup ? 8 : 12)) { say('info', 'That is as short as notes go here.'); return; }
        out = setLen(S, k, nl);
        if (!out) { say('info', 'No room after this note. Shorten something later first.'); return; }
      } else if (op === 'rest') {
        if (perc && s.rest) { s.rest = false; s.p = null; } else { s.rest = true; s.p = null; }
        out = S;
      }
      if (!out) return;
      commit(rebuild(out));
      if (sound) Sound.tone(Theory.midi(sound), null, 0.45, 0.8);
      say('info', '');
    }
    edBtns.forEach(b => { b.onclick = () => { edit(b.dataset.e); }; });
    box.addEventListener('click', ev => {
      const g = ev.target.closest && ev.target.closest('[data-i]'); if (!g || recording) return;
      const i = +g.getAttribute('data-i'), s = sounds().find(x => x.i <= i && x.j >= i);
      if (!s) return;
      sel = s.a; render();
      try { box.focus({ preventScroll: true }); } catch (e) { box.focus(); }
    });
    const KEYS = { ArrowLeft: 'prev', ArrowRight: 'next', '[': 'half', ']': 'double', '.': 'dot', Delete: 'rest', Backspace: 'rest' };
    box.addEventListener('keydown', ev => {
      let op = KEYS[ev.key];
      if (ev.key === 'ArrowUp') op = ev.shiftKey ? 'oup' : 'up';
      if (ev.key === 'ArrowDown') op = ev.shiftKey ? 'odown' : 'down';
      if (ev.key === 'z' || ev.key === 'Z') op = 'undo';
      if (!op || ev.altKey || ((ev.ctrlKey || ev.metaKey) && op !== 'undo')) return;
      ev.preventDefault(); ev.stopPropagation();
      if (op === 'undo' || sel != null) edit(op);
    });
    /* recording */
    const lat = () => (Store.data.settings.micLatency || 0) / 1000;
    function preview() {
      if (!rec) return;
      events = ntQuantize(hits, { bpm, meter: spec, start: rec.start, bars: o.bars, keySig: o.keySig });
      render();
    }
    function stopRecAudio() { timers.forEach(clearTimeout); timers = []; if (rec) rec.stop(); if (unlight) { unlight(); unlight = null; } }
    function finish() {
      if (!recording) return;
      const r = rec;
      recording = false; stopRecAudio();
      const got = hits.length ? ntQuantize(hits, { bpm, meter: spec, start: r.start, bars: o.bars, keySig: o.keySig }) : null;
      events = before; rec = null;
      bRec.disabled = false; bStop.disabled = true; bPlay.disabled = false; bClear.disabled = false; rng.disabled = false;
      if (got) { commit(got); const n = got.filter(e => !e.rest && !e.tie).length; say('good', `${n} note${n === 1 ? '' : 's'} written down. Click any note to fix it, or record again.`); }
      else { render(); say('info', 'Nothing came in. Press Record and play after the count-in.'); }
    }
    function record() {
      if (recording || !alive) return;
      stopPlay();
      if (!Sound.ensure()) { say('bad', 'This browser has no Web Audio, so recording can’t run.'); return; }
      sel = null; hits = []; before = events; recording = true;
      const quiet = Mic.state === 'on';
      rec = ntPlay([{ d: ntQ(totalTk()), rest: true }], { meter: spec, bpm, countIn: o.countIn, click: !quiet });
      unlight = ntLights(lights, rec.beats);
      bRec.disabled = true; bStop.disabled = false; bPlay.disabled = true; bClear.disabled = true; rng.disabled = true;
      say('info', o.countIn ? 'Count-in…' : 'Recording.');
      render();
      const r = rec;
      timers.push(setTimeout(() => say('info', `Recording ${o.bars} bar${o.bars > 1 ? 's' : ''}. Play.`), Math.max(0, (r.start - Sound.now()) * 1000)));
      timers.push(setTimeout(finish, Math.max(0, (r.end - Sound.now() + 0.08) * 1000)));
    }
    const offs = [];
    offs.push(Bus.on('note', d => {
      if (recording) {
        if (perc) return;
        const t = (d.t != null ? d.t : Sound.now()) - (d.source === 'mic' ? lat() : 0);
        if (t >= rec.end) return;
        if (t < rec.start - 0.25) { say('info', 'Wait for bar 1: the clicks count you in.'); return; }
        if (o.pcs && o.pcs.indexOf(mod12(d.midi)) < 0) { say('bad', `${noteName(d.midi)} is not in ${o.pcsLabel || 'this scale'}.`); return; }
        hits.push({ t, midi: d.midi }); preview();
        return;
      }
      /* step entry: a selected note takes the pitch you play, then the next note is selected */
      const c = cur();
      if (!c || perc || pl || d.source === 'mic') return;
      if (o.pcs && o.pcs.indexOf(mod12(d.midi)) < 0) { say('bad', `${noteName(d.midi)} is not in ${o.pcsLabel || 'this scale'}.`); return; }
      const S = copy(); S[c.k].rest = false; S[c.k].p = ntSpell(d.midi, o.keySig);
      const nx = S.slice(c.k + 1).find(x => !x.rest);
      commit(rebuild(S));
      if (nx) { sel = nx.a; render(); }
    }));
    offs.push(Bus.on('onset', d => {
      if (!recording || !perc) return;
      const t = d.t != null ? d.t : Sound.now();
      if (t >= rec.end || t < rec.start - 0.25) return;
      hits.push({ t }); preview();
    }));
    offs.push(Bus.on('noteoff', d => {
      if (!recording || perc) return;
      const t = Sound.now() - (d.source === 'mic' ? lat() : 0);
      for (let k = hits.length - 1; k >= 0; k--) if (hits[k].midi === d.midi && hits[k].off == null) { hits[k].off = t; break; }
    }));
    /* playback */
    function mark(i) { box.querySelectorAll('.nt-ev.now').forEach(g => g.classList.remove('now')); if (i != null) { const g = box.querySelector(`[data-i="${i}"]`); if (g) g.classList.add('now'); } }
    function stopPlay() { if (pl) { pl.stop(); pl = null; } if (!recording && unlight) { unlight(); unlight = null; } mark(null); bStop.disabled = !recording; }
    function play() {
      if (recording) return;
      stopPlay();
      pl = ntPlay(events, { meter: spec, bpm, swing, click: met.checked, onNote: i => mark(i), onEnd: () => { pl = null; mark(null); bStop.disabled = true; } });
      if (pl) { unlight = ntLights(lights, pl.beats); bStop.disabled = false; }
    }
    function stop() { if (recording) finish(); else stopPlay(); }
    function clear() { if (recording) return; stopPlay(); sel = null; commit(fit([])); say('info', 'Cleared. Record again, or click a rest and press ↑ to write a note.'); }
    bRec.onclick = record; bStop.onclick = stop; bPlay.onclick = play; bClear.onclick = clear;
    rng.oninput = () => { bpm = +rng.value; bpmTxt.innerHTML = ntTempoHTML(spec, bpm); };
    events = fit(o.initial);
    render();
    return {
      get events() { return events.map(ntClone); },
      get notes() { return ntToNotes(events, { bpm, swing, meter: spec }); },
      get bpm() { return bpm; },
      get recording() { return recording; },
      record, stop, play, clear,
      set(evs) { stopPlay(); commit(fit(evs)); },
      setSwing(v) { swing = v; },
      select(i) { const s = sounds().find(x => x.i <= i && x.j >= i); sel = s ? s.a : null; render(); },
      destroy() { alive = false; offs.forEach(fn => fn()); if (recording) { recording = false; stopRecAudio(); } stopPlay(); }
    };
  }
};

/* MelodyCapture with a name and Save.
   p: { prompt, meter, bpm, bars, keySig, clef, countIn, pcs, pcsLabel, min (notes, default 3), check(events) → null | 'message', checkOk (text when it passes), placeholder,
        initial (events), name (default name), swing, save: { level, tags, from, prompt, key, extra } }
   Saves { name, notes, score: { meter, bpm, keySig, events, swing? }, bpm, level, tags, from, key, prompt, …extra }.
   done(true, { sketch, events }) */
Tasks.capture = (el, p, done) => {
  const id = 'nt-name-' + (++ntUid), min = p.min == null ? 3 : p.min, sv = p.save || {};
  let saved = false;
  el.innerHTML = `<div class="nt-task">${p.prompt ? `<p class="prompt">${p.prompt}</p>` : ''}<div class="nt-cap-slot"></div><ul class="nt-checks"></ul>
    <div class="field"><label for="${id}">Name it</label><input id="${id}" type="text" maxlength="40" placeholder="${esc(p.placeholder || 'Give it a name')}" value="${esc(p.name || '')}"></div>
    <div class="row"><button type="button" class="btn primary" data-act="save" disabled>Save to sketchbook</button></div><p class="fb info nt-saved" aria-live="polite"></p></div>`;
  const checks = el.querySelector('.nt-checks'), bSave = el.querySelector('[data-act="save"]'), name = el.querySelector('#' + id), f = el.querySelector('.nt-saved');
  function refresh(evs) {
    const n = evs.filter(e => !e.rest && !e.tie).length, msg = p.check ? p.check(evs) : null;
    checks.innerHTML = `<li class="${n >= min ? 'ok' : ''}">${n >= min ? '✓' : '○'} At least ${min} note${min === 1 ? '' : 's'} (${n} so far)</li>` + (p.check ? `<li class="${msg ? '' : 'ok'}">${msg ? '○ ' + esc(msg) : '✓ ' + esc(p.checkOk || 'Fits the brief')}</li>` : '');
    bSave.disabled = saved || n < min || !!msg;
  }
  const cap = MelodyCapture.mount(el.querySelector('.nt-cap-slot'), {
    meter: p.meter, bpm: p.bpm, bars: p.bars, keySig: p.keySig, clef: p.clef, countIn: p.countIn, pcs: p.pcs, pcsLabel: p.pcsLabel,
    initial: p.initial, swing: p.swing, onChange: evs => { saved = false; f.textContent = ''; refresh(evs); }
  });
  refresh(cap.events);
  bSave.onclick = () => {
    const events = cap.events, meter = p.meter || '4/4';
    const score = { meter, bpm: cap.bpm, keySig: p.keySig || 0, events };
    if (p.swing && p.swing > 0.52) score.swing = p.swing;
    const sketch = saveSketch(Object.assign({
      name: name.value.trim() || p.name || 'Sketch ' + (Store.data.sketches.length + 1), notes: cap.notes, score, bpm: cap.bpm,
      level: sv.level, tags: sv.tags || [], from: sv.from, key: sv.key, prompt: sv.prompt || p.prompt || ''
    }, sv.extra || {}));
    saved = true; bSave.disabled = true;
    fb(f, 'good', `Saved “${sketch.name}” to your sketchbook.`);
    done(true, { sketch, events });
  };
  return () => cap.destroy();
};

window.MotifNotation = { Score, MelodyCapture };
