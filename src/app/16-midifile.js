/* =================================================================
   MIDI export (tool 9): any sketch as a Standard MIDI File, to finish it in a DAW or notation program.

   MidiFile.fromSketch(sketch, opts) → Uint8Array      type 1, 480 ticks per quarter note
   MidiFile.tracksOf(sketch, opts) → the tracks it would write: [{ name, channel (0–15), program, drums, notes: [{ m, t, d, v }] }]
                                     with t and d in quarter-note beats
   MidiFile.write(song) → Uint8Array                    song: { name, bpm, meter, keySig: { sf, mi }, tracks }
   MidiFile.parse(bytes) → { format, ppq, tempo (bpm), timeSig: { num, den }, keySig: { sf, mi }, tracks: [{ name,
                             channel, program, events, notes: [{ m, tick, ticks, beat, beats, t, d, v, ch }] }] }
                             (t and d in seconds at the first tempo; beat and beats in quarter notes)
   MidiFile.download(sketch, opts) → { name, bytes, ok }  saves name.mid through a temporary <a download>
   MidiFile.fileName(sketch) → a safe file name ('My-song-v2.mid')

   What a sketch becomes (one track each, after a conductor track holding the name, tempo, meter and key signature):
     Melody   sketch.score (exact beats) or sketch.notes [{ m, t, d }] in seconds at sketch.bpm
     Chords   sketch.chords [{ sym, t, d }] in seconds, voiced in the middle register with smooth voice leading
     Bass     the chords' bass notes (the slash note of an inversion)
     parts    sketch.parts [{ name, notes [{ m, t, d, v }] in seconds, program (General MIDI 0–127), channel (1–16, as
              music software counts; 10 is drums), inst (an INSTRUMENTS id: its program), drums (GM drum notes), role }]
     voices   sketch.voices (S A T B): { S: notes, A: …, T: …, B: … } (or soprano/alto/tenor/bass), [{ name, notes }],
              or columns [[s, a, t, b], …] of MIDI numbers or note names, one chord per sketch.chords entry (when the
              counts match) or per beat. Notes lists may also be plain MIDI numbers, one per beat.
     backing  sketch.backing: { style, mute } adds the band from that style instead of the plain Chords and Bass:
              Drums (channel 10), Backing bass and Backing chords.
   A part with role 'bass' or 'chords' (or 'pads') replaces the automatic Bass or Chords track. opts: { chords: false,
   bass: false, melody: false } leave a track out; opts.program sets the melody's program.
   ================================================================= */
const MF_PPQ = 480;
const MF_DRUM_NOTE = { kick: 36, snare: 38, rim: 37, hat: 42, ohat: 46, ride: 51 };
const MF_VOICE_NAMES = [['S', 'soprano', 'Soprano'], ['A', 'alto', 'Alto'], ['T', 'tenor', 'Tenor'], ['B', 'bass', 'Bass']];

/* ---------- writing ---------- */
function mfVlq(n) {
  n = Math.max(0, Math.round(n));
  const out = [n & 0x7f];
  while ((n >>= 7) > 0) out.unshift((n & 0x7f) | 0x80);
  return out;
}
const mfText = s => { const u = unescape(encodeURIComponent(String(s || ''))); return Array.from(u, c => c.charCodeAt(0) & 0xff); };
const mfU32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
function mfChunk(id, data) { return mfText(id).concat(mfU32(data.length), data); }
/* key signature { sf (−7…7), mi (0 major, 1 minor) } from a tonic and a mode ('major', 'minor' or a mode id) */
function mfKeySig(key, mode) {
  try {
    const tonic = Theory.stripOct(String(key || 'C').replace(/\s*(major|minor|m)$/i, '').trim() || 'C');
    const minorish = mode === 'minor' || /m$|minor$/i.test(String(key || '').trim());
    let sf, mi;
    if (!mode || mode === 'major' || mode === 'minor' || mode === 'ionian' || mode === 'aeolian' || minorish) {
      const mn = minorish || mode === 'aeolian';
      sf = Theory.keySig(tonic, mn ? 'minor' : 'major').n; mi = mn ? 1 : 0;
    } else {
      const sc = Theory.scale(tonic, mode);
      sf = sc.reduce((s, x) => s + Theory.accOf(x), 0);
      mi = Theory.SCALES[mode] && Theory.SCALES[mode].degrees[2] === 'b3' ? 1 : 0;
    }
    if (sf > 7) sf -= 12; else if (sf < -7) sf += 12;
    return { sf, mi };
  } catch (e) { return { sf: 0, mi: 0 }; }
}
/* the meter's time-signature bytes: numerator, log2(denominator), MIDI clocks per beat, 32nds per quarter */
function mfTimeSig(meter) {
  let M; try { M = Score.meter(meter || '4/4'); } catch (e) { M = Score.meter('4/4'); }
  return { num: M.num, den: M.den, clocks: M.compound ? 36 : M.den === 2 ? 48 : M.den === 8 ? 12 : 24 };
}
/* song: { name, bpm, meter, keySig: { sf, mi }, tracks: [{ name, channel, program, drums, notes in beats }] } → Uint8Array */
function mfWrite(song) {
  const ppq = MF_PPQ, ts = mfTimeSig(song.meter), ks = song.keySig || { sf: 0, mi: 0 };
  const uspq = Math.round(60000000 / (song.bpm || 90));
  const meta = (type, data) => [0, 0xff, type].concat(mfVlq(data.length), data);
  const conductor = meta(0x03, mfText(song.name || 'Motif sketch'))
    .concat(meta(0x51, [(uspq >> 16) & 255, (uspq >> 8) & 255, uspq & 255]))
    .concat(meta(0x58, [ts.num, Math.round(Math.log2(ts.den)), ts.clocks, 8]))
    .concat(meta(0x59, [(ks.sf + 256) & 255, ks.mi ? 1 : 0]))
    .concat([0, 0xff, 0x2f, 0]);
  const chunks = [mfChunk('MTrk', conductor)];
  (song.tracks || []).forEach(tr => {
    const ch = tr.channel & 15, evs = [];
    /* notes in ticks; a repeated pitch ends the note before it, so nothing hangs */
    const notes = (tr.notes || []).map(n => ({ m: Math.max(0, Math.min(127, Math.round(n.m))), a: Math.max(0, Math.round(n.t * ppq)), b: Math.round((n.t + Math.max(n.d, 1 / ppq)) * ppq), v: n.v }))
      .filter(n => n.b > n.a).sort((x, y) => x.a - y.a || x.m - y.m);
    const open = {};
    notes.forEach(n => { const o = open[n.m]; if (o && o.b > n.a) o.b = Math.max(o.a + 1, n.a); open[n.m] = n; });
    notes.forEach(n => {
      const vel = n.v == null ? (tr.vel || 90) : n.v <= 1 ? Math.round(n.v * 127) : Math.round(n.v);
      evs.push({ tick: n.a, order: 1, bytes: [0x90 | ch, n.m, Math.max(1, Math.min(127, vel))] });
      evs.push({ tick: n.b, order: 0, bytes: [0x80 | ch, n.m, 64] });
    });
    evs.sort((x, y) => x.tick - y.tick || x.order - y.order);
    const data = meta(0x03, mfText(tr.name || 'Track')), put = a => { for (let i = 0; i < a.length; i++) data.push(a[i]); };
    if (!tr.drums && tr.program != null) put([0, 0xc0 | ch, tr.program & 127]);
    let last = 0;
    evs.forEach(e => { put(mfVlq(e.tick - last)); put(e.bytes); last = e.tick; });
    put([0, 0xff, 0x2f, 0]);
    chunks.push(mfChunk('MTrk', data));
  });
  const head = mfChunk('MThd', [0, 1, (chunks.length >> 8) & 255, chunks.length & 255, (ppq >> 8) & 255, ppq & 255]);
  const size = chunks.reduce((n, c) => n + c.length, head.length), out = new Uint8Array(size);
  let at = 0;
  [head].concat(chunks).forEach(c => { out.set(c, at); at += c.length; });
  return out;
}

/* ---------- a sketch → tracks in beats ---------- */
const mfNum = x => typeof x === 'number' ? x : (() => { try { return Theory.midi(x); } catch (e) { return null; } })();
/* a notes list in seconds (or plain MIDI numbers / names, one per beat) → notes in beats */
function mfBeats(list, k) {
  return (list || []).map((n, i) => {
    if (n == null) return null;
    if (typeof n === 'number' || typeof n === 'string') { const m = mfNum(n); return m == null ? null : { m, t: i, d: 1 }; }
    const m = mfNum(n.m != null ? n.m : n.p);
    return m == null ? null : { m, t: (n.t || 0) * k, d: (n.d || 0.4) * k, v: n.v };
  }).filter(Boolean);
}
/* S A T B from any of the shapes Level 8 may save → [{ name, notes in beats }] */
function mfVoices(s, k) {
  const v = s.voices;
  if (!v) return [];
  if (Array.isArray(v) && v.length && Array.isArray(v[0])) {
    /* columns: one chord after another */
    const cs = s.chords && s.chords.length === v.length ? s.chords : null;
    const parts = [0, 1, 2, 3].slice(0, Math.max.apply(null, v.map(c => c.length))).map(i => ({ name: (MF_VOICE_NAMES[i] || [0, 0, 'Voice ' + (i + 1)])[2], notes: [] }));
    let at = 0;
    v.forEach((col, j) => {
      const t = cs ? cs[j].t * k : at, d = cs ? (cs[j].d || 1) * k : 1;
      col.forEach((x, i) => { const m = mfNum(x); if (m != null && parts[i]) parts[i].notes.push({ m, t, d }); });
      at = t + d;
    });
    return parts;
  }
  if (Array.isArray(v)) return v.map((x, i) => ({ name: x.name || (MF_VOICE_NAMES[i] || [0, 0, 'Voice ' + (i + 1)])[2], notes: mfBeats(x.notes, k), program: x.program }));
  return MF_VOICE_NAMES.map(([a, b, name]) => ({ name, notes: mfBeats(v[a] || v[b] || v[name], k) })).filter(x => x.notes.length);
}
function mfTracksOf(s, opts) {
  opts = opts || {};
  s = s || {};
  const bpm = s.bpm || (s.score && s.score.bpm) || 90, k = bpm / 60, meter = (s.score && s.score.meter) || s.meter || '4/4';
  const tracks = [], parts = s.parts || [];
  const roleTaken = r => parts.some(p => p.role === r || (r === 'chords' && p.role === 'pads'));
  const instProg = id => { const ins = typeof Instruments !== 'undefined' && id ? Instruments.byId(id) : null; return ins ? ins.program : null; };
  /* melody */
  let mel = [];
  if (opts.melody !== false) {
    if (s.score && s.score.events) {
      try { mel = Score.toNotes(s.score.events, { bpm: 60, meter, swing: s.score.swing }).map(n => ({ m: n.m, t: n.t, d: n.d })); } catch (e) { mel = []; }
    }
    if (!mel.length) mel = mfBeats(s.notes, k);
    if (mel.length) tracks.push({ name: 'Melody', program: opts.program != null ? opts.program : (instProg(s.inst) != null ? instProg(s.inst) : 0), notes: mel, vel: 96 });
  }
  /* chords and bass, or a backing band */
  const chords = (s.chords || []).map(c => ({ sym: c.sym, t: (c.t || 0) * k, d: (c.d || 1) * k }));
  if (s.backing && s.backing.style && typeof Backing !== 'undefined' && chords.length) {
    const arr = Backing.arrange({ style: s.backing.style, chords, meter, loop: false, mute: s.backing.mute });
    const mute = s.backing.mute || {}, of = role => arr.events.filter(e => e.role === role);
    if (!mute.drums && arr.style.drums) tracks.push({ name: 'Drums', drums: true, channel: 9, notes: of('drums').map(e => ({ m: MF_DRUM_NOTE[e.kind] || 38, t: e.t, d: 0.1, v: e.v })) });
    if (!mute.bass && opts.bass !== false && !roleTaken('bass')) tracks.push({ name: 'Backing bass', program: 33, notes: of('bass').map(e => ({ m: e.m, t: e.t, d: e.d, v: Math.min(1, e.v + 0.1) })) });
    if (!mute.chords && opts.chords !== false && !roleTaken('chords')) {
      const notes = [];
      of('chords').forEach(e => (e.kind === 'arp' ? [e.m] : e.ms).forEach(m => notes.push({ m, t: e.t, d: e.d, v: Math.min(1, e.v * 2) })));
      tracks.push({ name: 'Backing chords', program: arr.style.id === 'rock' ? 29 : arr.style.id === 'ambient' ? 89 : 0, notes });
    }
  } else if (chords.length) {
    const cs = chords.map(c => typeof Backing !== 'undefined' ? Backing.chord(c.sym) : null);
    const ok = chords.map((c, i) => Object.assign({}, c, cs[i] || {})).filter((c, i) => cs[i]);
    if (opts.chords !== false && !roleTaken('chords') && ok.length) {
      const vs = Backing.voiceLead(ok, 'full', 4, [52, 76], false), notes = [];
      ok.forEach((c, i) => vs[i].forEach(m => notes.push({ m, t: c.t, d: c.d, v: 0.55 })));
      tracks.push({ name: 'Chords', program: 0, notes });
    }
    if (opts.bass !== false && !roleTaken('bass') && ok.length) {
      let prev = 40;
      tracks.push({ name: 'Bass', program: 33, notes: ok.map(c => { prev = bkNear(c.bassPc, prev, 31, 50); return { m: prev, t: c.t, d: c.d, v: 0.7 }; }) });
    }
  }
  /* parts and voices */
  parts.forEach((p, i) => {
    const drums = !!p.drums || p.channel === 10;
    tracks.push({ name: p.name || 'Part ' + (i + 1), program: p.program != null ? p.program : (instProg(p.inst) != null ? instProg(p.inst) : 0), drums, channel: drums ? 9 : (p.channel ? p.channel - 1 : null), notes: mfBeats(p.notes, k) });
  });
  mfVoices(s, k).forEach(v => tracks.push({ name: v.name, program: v.program != null ? v.program : (s.voicesProgram != null ? s.voicesProgram : 52), notes: v.notes }));
  /* channels: drums on 10 (index 9); the rest in order, skipping the drum channel and any a part asked for */
  const used = new Set(tracks.filter(t => t.channel != null).map(t => t.channel));
  let next = 0;
  tracks.forEach(t => {
    if (t.channel != null) return;
    let tries = 0;
    while ((next === 9 || used.has(next)) && tries++ < 16) next = (next + 1) % 16;
    t.channel = next; used.add(next); next = (next + 1) % 16;
  });
  return tracks;
}
function mfFromSketch(s, opts) {
  s = s || {};
  const meter = (s.score && s.score.meter) || s.meter || '4/4';
  /* the score's own key signature wins, unless it is a default 0 and the sketch names a key with sharps or flats */
  const fromKey = mfKeySig(s.key || 'C', s.mode), sig = s.score && s.score.keySig;
  const ks = typeof sig === 'number' && !(sig === 0 && s.key && fromKey.sf !== 0) ? { sf: sig, mi: fromKey.mi } : fromKey;
  return mfWrite({ name: s.name || 'Motif sketch', bpm: s.bpm || (s.score && s.score.bpm) || 90, meter, keySig: ks, tracks: mfTracksOf(s, opts) });
}

/* ---------- reading (tests, and anyone who wants to check a file) ---------- */
function mfParse(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let p = 0;
  const str = n => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(b[p + i]); p += n; return s; };
  const u32 = () => { const v = ((b[p] << 24) >>> 0) + (b[p + 1] << 16) + (b[p + 2] << 8) + b[p + 3]; p += 4; return v; };
  const u16 = () => { const v = (b[p] << 8) | b[p + 1]; p += 2; return v; };
  const vlq = () => { let v = 0, c; do { c = b[p++]; v = (v * 128) + (c & 0x7f); } while (c & 0x80 && p < b.length); return v; };
  if (str(4) !== 'MThd') throw new Error('Not a MIDI file');
  const hl = u32(), start = p, format = u16(), ntrks = u16(), ppq = u16();
  p = start + hl;
  const out = { format, ppq, tracks: [], tempo: 120, tempos: [], timeSig: { num: 4, den: 4 }, keySig: { sf: 0, mi: 0 } };
  let gotTempo = false, gotTs = false, gotKs = false;
  for (let tn = 0; tn < ntrks && p < b.length; tn++) {
    const id = str(4), len = u32(), end = p + len;
    if (id !== 'MTrk') { p = end; continue; }
    const tr = { name: '', channel: null, program: null, events: [], notes: [] };
    const active = {};
    let tick = 0, status = 0;
    while (p < end) {
      tick += vlq();
      let st = b[p];
      if (st & 0x80) p++; else st = status;
      if (st === 0xff) {
        const type = b[p++], l = vlq(), data = Array.from(b.slice(p, p + l)); p += l;
        const ev = { tick, type: 'meta', meta: type, data };
        if (type === 0x03) { try { tr.name = decodeURIComponent(escape(String.fromCharCode.apply(null, data))); } catch (e) { tr.name = String.fromCharCode.apply(null, data); } ev.text = tr.name; }
        if (type === 0x51) { const us = (data[0] << 16) | (data[1] << 8) | data[2]; ev.bpm = +(60000000 / us).toFixed(3); out.tempos.push({ tick, bpm: ev.bpm }); if (!gotTempo) { out.tempo = ev.bpm; gotTempo = true; } }
        if (type === 0x58 && !gotTs) { out.timeSig = { num: data[0], den: Math.pow(2, data[1]), clocks: data[2] }; gotTs = true; }
        if (type === 0x59 && !gotKs) { out.keySig = { sf: data[0] > 127 ? data[0] - 256 : data[0], mi: data[1] }; gotKs = true; }
        tr.events.push(ev);
        if (type === 0x2f) { p = end; break; }
        continue;
      }
      if (st === 0xf0 || st === 0xf7) { const l = vlq(); p += l; continue; }
      status = st;
      const hi = st & 0xf0, ch = st & 0x0f, d1 = b[p++], d2 = (hi === 0xc0 || hi === 0xd0) ? null : b[p++];
      if (hi === 0x90 && d2 > 0) {
        tr.events.push({ tick, type: 'noteOn', ch, m: d1, v: d2 });
        (active[ch * 128 + d1] = active[ch * 128 + d1] || []).push({ m: d1, tick, v: d2, ch });
        if (tr.channel == null) tr.channel = ch;
      } else if (hi === 0x80 || hi === 0x90) {
        tr.events.push({ tick, type: 'noteOff', ch, m: d1 });
        const q = active[ch * 128 + d1];
        if (q && q.length) { const n = q.shift(); n.ticks = tick - n.tick; tr.notes.push(n); }
      } else if (hi === 0xc0) { tr.events.push({ tick, type: 'program', ch, program: d1 }); if (tr.program == null) tr.program = d1; if (tr.channel == null) tr.channel = ch; }
      else tr.events.push({ tick, type: 'channel', status: hi, ch, d1, d2 });
    }
    p = end;
    tr.notes.sort((x, y) => x.tick - y.tick || x.m - y.m);
    out.tracks.push(tr);
  }
  const spt = 60 / out.tempo / ppq;
  out.tracks.forEach(tr => tr.notes.forEach(n => { n.beat = n.tick / ppq; n.beats = n.ticks / ppq; n.t = +(n.tick * spt).toFixed(4); n.d = +(n.ticks * spt).toFixed(4); }));
  return out;
}

/* ---------- saving ---------- */
function mfFileName(s) {
  let base = String((s && s.name) || 'Motif sketch').replace(/♯/g, ' sharp').replace(/♭/g, ' flat');
  try { base = base.normalize('NFKD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* old browsers keep accents */ }
  base = base.replace(/[^A-Za-z0-9 _-]+/g, ' ').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60).replace(/^-|-$/g, '');
  return (base || 'Motif-sketch') + '.mid';
}
function mfDownload(s, opts) {
  const bytes = mfFromSketch(s, opts), name = mfFileName(s);
  if (typeof Blob === 'undefined' || !window.URL || typeof URL.createObjectURL !== 'function') return { name, bytes, ok: false };
  const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener'; a.hidden = true;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); try { URL.revokeObjectURL(url); } catch (e) { /* gone */ } }, 1500);
  return { name, bytes, ok: true };
}

const MidiFile = { PPQ: MF_PPQ, DRUM_NOTE: MF_DRUM_NOTE, fromSketch: mfFromSketch, tracksOf: mfTracksOf, write: mfWrite, parse: mfParse, download: mfDownload, fileName: mfFileName, keySig: mfKeySig };
