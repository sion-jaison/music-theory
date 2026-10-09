/* =================================================================
   Transcribe (tool 8): work out the chords of a recording by ear, with help.
   The learner opens an audio file from their own device (nothing is uploaded) or a practice track Motif renders,
   sees its waveform, loops a passage (A–B), slows it down without changing pitch, and gets chord suggestions from the
   same chroma analysis the mic uses. Each chord is confirmed by ear and by playing it (keys, MIDI or mic) or with
   "Yes, that's it", building a chord chart that saves to the sketchbook.

   Transcribe.mount(el, o) → { destroy, openFile(file), usePractice(spec), select(i), confirm(i, sym), setLoop(a, b),
                               play(), pause(), seek(t), clip, segments, chart, loop, time, ready }
     o: { need (chords to confirm before saving; 0 = any), practice: { romans, key, mode, bpm, style, repeat }, prompt,
          save: { level, tags, prompt, name }, onSave(sketch, chords), decode(arrayBuffer) → Promise<{ samples,
          sampleRate }> (tests stub it) }
   Tasks.transcribe(el, p, done)   p: { prompt, need (default 4), practice, save: { level, tags } };
                                   done(true, { chords, sketch }) once `need` chords are confirmed and saved
   Pure parts (no DOM, no audio), for tests and reuse:
     Transcribe.frameDb(samples, start, n)          one analyser-like frame: Blackman window, dB = 20·log10(|X| / n)
     Transcribe.chroma(samples, sampleRate, o)      → { chroma, bassPc, chord: { sym, root, q, score } | null }
     Transcribe.frames(samples, sampleRate, o)      → [{ t, m }] one chord match (or null) every o.hop seconds
     Transcribe.analyse(samples, sampleRate, o)     the same, in chunks: → Promise<frames> (o.onProgress(0–1))
     Transcribe.smooth(frames, o)                   → segments [{ t, d, sym, root, q, score, alts }] (a chord strip)
     Transcribe.spell(segments)                     → { segments respelled in their key, key: { tonic, mode, name } }
     Transcribe.peaks(samples, n)                   → { min, max } Float32Arrays for a waveform n columns wide
     Transcribe.loopOf(a, b, dur), Transcribe.wrap(t, loop)   loop maths
     Transcribe.wav(samples, sampleRate) / parseWav(buffer)   16-bit mono WAV in and out
     Transcribe.synth(events, sampleRate, spb, seconds)       the practice track without Web Audio (additive sines)
   ================================================================= */
const TR_QUALS = ['maj', 'min', '7', 'maj7', 'm7', 'dim', 'sus4', 'sus2', 'aug'];
/* matchChord options for recordings: the mic's, but a major 3rd may be a little weaker (a doubled root and the bass's
   5th harmonic often outweigh it in a mix) */
const trMatch = o => ({ qualities: (o && o.qualities) || TR_QUALS, need5: 0.42 });

/* ---------- FFT frames, like an AnalyserNode without smoothing ---------- */
const trFftCache = {};
function trFft(n) {
  if (trFftCache[n]) return trFftCache[n];
  const win = new Float64Array(n), rev = new Uint32Array(n), cos = new Float64Array(n / 2), sin = new Float64Array(n / 2), bits = Math.round(Math.log2(n));
  for (let i = 0; i < n; i++) {
    win[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / n) + 0.08 * Math.cos(4 * Math.PI * i / n);
    let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r;
  }
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(2 * Math.PI * i / n); sin[i] = -Math.sin(2 * Math.PI * i / n); }
  return (trFftCache[n] = { win, rev, cos, sin, re: new Float64Array(n), im: new Float64Array(n) });
}
/* samples[start … start + n) (zeros past either end) → Float32Array(n / 2) of dB */
function trFrameDb(samples, start, n, out) {
  const F = trFft(n), re = F.re, im = F.im;
  for (let i = 0; i < n; i++) { const j = start + i, x = j >= 0 && j < samples.length ? samples[j] : 0; re[F.rev[i]] = x * F.win[i]; im[i] = 0; }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1, step = n / size;
    for (let s = 0; s < n; s += size) {
      for (let k = 0; k < half; k++) {
        const a = s + k, b = a + half, wr = F.cos[k * step], wi = F.sin[k * step];
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
  }
  const db = out || new Float32Array(n / 2);
  for (let k = 0; k < n / 2; k++) db[k] = 20 * Math.log10(Math.sqrt(re[k] * re[k] + im[k] * im[k]) / n + 1e-12);
  return db;
}
/* the FFT size that gives the mic's resolution (16384 at 44.1–48 kHz) */
const trSize = sr => sr >= 32000 ? 16384 : sr >= 16000 ? 8192 : 4096;
/* a chord symbol from a matchChord result */
function trSym(m) {
  if (!m) return null;
  const root = Theory.rootName(m.root, m.quality);
  return { sym: Theory.symbol(root, m.quality), root, q: m.quality, score: m.score, rootPc: m.root };
}
/* one window of samples (centred on o.at seconds, default the middle) → { chroma, bassPc, energy, chord } */
function trChroma(samples, sr, o) {
  o = o || {};
  const n = o.fftSize || trSize(sr), mid = o.at != null ? Math.round(o.at * sr) : Math.floor(samples.length / 2);
  const r = spectrumChord(trFrameDb(samples, mid - n / 2, n), sr, n, trMatch(o));
  return r.a ? { chroma: r.a.chroma, bassPc: r.a.bassPc, energy: r.a.energy, chord: trSym(r.m) } : { chroma: null, bassPc: -1, energy: 0, chord: null };
}
/* chord matches through a clip: o { hop (s, default 0.2), from, to (s), fftSize } → [{ t, m: { root, quality, score } | null }] */
function trFramesSync(samples, sr, o) {
  o = o || {};
  const hop = o.hop || 0.2, n = o.fftSize || trSize(sr), db = new Float32Array(n / 2), out = [];
  const t0 = o.from || 0, t1 = Math.min(o.to == null ? samples.length / sr : o.to, samples.length / sr);
  for (let t = t0 + hop / 2; t < t1; t += hop) {
    const r = spectrumChord(trFrameDb(samples, Math.round(t * sr) - n / 2, n, db), sr, n, trMatch(o));
    out.push({ t: +t.toFixed(4), m: r.m && r.m.score >= (o.minScore || 0.75) ? { root: r.m.root, quality: r.m.quality, score: r.m.score } : null, bassPc: r.a ? r.a.bassPc : -1 });
  }
  return out;
}
/* the same in chunks of about 40 ms, so the page stays responsive: → Promise<frames>; o.cancelled() stops it */
function trAnalyse(samples, sr, o) {
  o = o || {};
  const dur = samples.length / sr, hop = o.hop || 0.2, out = [];
  return new Promise(res => {
    let t = 0;
    const step = () => {
      if (o.cancelled && o.cancelled()) { res(out); return; }
      const stop = Date.now() + 40;
      while (t < dur && Date.now() < stop) {
        const part = trFramesSync(samples, sr, Object.assign({}, o, { from: t, to: Math.min(dur, t + hop * 5) }));
        part.forEach(f => out.push(f));
        t += hop * 5;
      }
      if (o.onProgress) o.onProgress(Math.min(1, t / dur));
      if (t < dur) setTimeout(step, 0); else res(out);
    };
    step();
  });
}

/* ---------- the chord strip ----------
   frames → segments. Each frame votes (weighted by its score) for its chord in a window of ±o.win frames; frames with
   no chord vote for silence. Runs of the same winner become segments; segments shorter than o.minDur seconds merge
   into a neighbour (the same chord, or the longer one) until none is left; a silence up to o.gap seconds long joins the
   chord after it; other silences are dropped. With o.grid (seconds) and o.offset, segment edges snap to that beat grid. */
function trSmooth(frames, o) {
  o = Object.assign({ win: 2, minDur: 0.8, gap: 1.6 }, o || {});
  if (!frames.length) return [];
  const hop = o.hop || (frames.length > 1 ? frames[1].t - frames[0].t : 0.2);
  const key = f => f.m ? f.m.root + ':' + f.m.quality : null;
  const lab = frames.map((f, i) => {
    const votes = {}; let none = 0;
    for (let j = Math.max(0, i - o.win); j <= Math.min(frames.length - 1, i + o.win); j++) {
      const k = key(frames[j]); if (!k) { none += 0.8; continue; }
      votes[k] = (votes[k] || 0) + frames[j].m.score;
    }
    const best = Object.keys(votes).sort((a, b) => votes[b] - votes[a])[0];
    return best && votes[best] >= none ? best : null;
  });
  let segs = [];
  lab.forEach((k, i) => { const last = segs[segs.length - 1]; if (last && last.k === k) last.n++; else segs.push({ k, i, n: 1 }); });
  const minN = Math.max(1, Math.round(o.minDur / hop));
  for (let guard = 0; guard < 500 && segs.length > 1; guard++) {
    let s = -1;
    segs.forEach((x, i) => { if (x.n < minN && (s < 0 || x.n < segs[s].n)) s = i; });
    if (s < 0) break;
    const L = segs[s - 1], R = segs[s + 1], x = segs[s];
    /* a short gap goes to the chord after it (its attack, missed); a short chord to the same chord around it, else the
       longer neighbour */
    const into = !L ? R : !R ? L : (!x.k && R.k) ? R : (L.k === R.k ? L : (L.k && !R.k) ? L : (!L.k && R.k) ? R : (L.n >= R.n ? L : R));
    into.n += x.n; if (into === R) into.i = x.i;
    segs.splice(s, 1);
    /* the neighbours may now be the same chord: join them */
    for (let i = segs.length - 1; i > 0; i--) if (segs[i].k === segs[i - 1].k) { segs[i - 1].n += segs[i].n; segs.splice(i, 1); }
  }
  /* a short gap before a chord is usually its attack, missed: the chord after it starts there */
  const gapN = Math.round(o.gap / hop);
  for (let i = segs.length - 2; i >= 0; i--) {
    if (!segs[i].k && segs[i].n <= gapN && segs[i + 1].k) { segs[i + 1].n += segs[i].n; segs[i + 1].i = segs[i].i; segs.splice(i, 1); }
  }
  const snap = x => o.grid ? Math.max(0, Math.round((x - (o.offset || 0)) / o.grid) * o.grid + (o.offset || 0)) : x;
  const out = [];
  segs.forEach(x => {
    if (!x.k) return;
    const fs = frames.slice(x.i, x.i + x.n), [root, q] = x.k.split(':'), alts = {};
    fs.forEach(f => { const k = key(f); if (k && k !== x.k) alts[k] = (alts[k] || 0) + f.m.score; });
    const a = snap(Math.max(0, frames[x.i].t - hop / 2)), b = snap(frames[x.i + x.n - 1].t + hop / 2);
    if (b - a < 1e-6) return;
    const sym = trSym({ root: +root, quality: q, score: 0 });
    out.push({ t: +a.toFixed(3), d: +(b - a).toFixed(3), sym: sym.sym, root: sym.root, q, rootPc: +root,
      score: +(fs.reduce((s, f) => s + (f.m && key(f) === x.k ? f.m.score : 0), 0) / fs.length).toFixed(3),
      alts: Object.keys(alts).sort((p, r) => alts[r] - alts[p]).slice(0, 3).map(k => trSym({ root: +k.split(':')[0], quality: k.split(':')[1], score: 0 }).sym) });
  });
  return out;
}
/* respell roots in the key the chords suggest (B♭ rather than A♯ in F major) → { segments, key } */
function trSpell(segs) {
  if (!segs.length) return { segments: segs, key: null };
  const k = Theory.findKey(segs.map(s => ({ sym: s.sym, d: s.d })))[0];
  const names = Theory.scale(k.tonic, k.mode === 'minor' ? 'minor' : 'major').concat(k.mode === 'minor' ? [Theory.alter(Theory.scale(k.tonic, 'minor')[6], 1)] : []);
  const spell = (pc, q) => { const n = names.find(x => Theory.pc(x) === mod12(pc)); return n || Theory.rootName(pc, q); };
  const fix = sym => { try { const c = Theory.parseChord(sym); return Theory.symbol(spell(Theory.pc(c.root), c.q), c.q); } catch (e) { return sym; } };
  return { key: k, segments: segs.map(s => Object.assign({}, s, { sym: fix(s.sym), root: spell(s.rootPc, s.q), alts: (s.alts || []).map(fix) })) };
}

/* ---------- waveform, loop maths, WAV ---------- */
function trPeaks(samples, n) {
  n = Math.max(1, n | 0);
  const min = new Float32Array(n), max = new Float32Array(n), per = samples.length / n;
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * per), b = Math.max(a + 1, Math.floor((i + 1) * per)), stride = Math.max(1, Math.floor((b - a) / 2000));
    let lo = 0, hi = 0;
    for (let j = a; j < b && j < samples.length; j += stride) { const x = samples[j]; if (x < lo) lo = x; if (x > hi) hi = x; }
    min[i] = lo; max[i] = hi;
  }
  return { min, max };
}
/* an A–B loop inside 0…dur, in order, at least `least` seconds long; null when either end is missing */
function trLoopOf(a, b, dur, least) {
  if (a == null || b == null || !(dur > 0)) return null;
  least = least || 0.25;
  let x = Math.max(0, Math.min(a, b, dur)), y = Math.min(dur, Math.max(a, b));
  if (y - x < least) { y = Math.min(dur, x + least); x = Math.max(0, y - least); }
  return { a: +x.toFixed(3), b: +y.toFixed(3) };
}
/* where playback goes next: back to A once it reaches B */
const trWrap = (t, loop) => loop && t >= loop.b - 0.005 ? loop.a : t;
const trClock = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + String(r).padStart(2, '0'); };
function trWav(samples, sr) {
  const n = samples.length, out = new Uint8Array(44 + n * 2), dv = new DataView(out.buffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const x = Math.max(-1, Math.min(1, samples[i])); dv.setInt16(44 + i * 2, x < 0 ? x * 32768 : x * 32767, true); }
  return out;
}
/* a WAV file (PCM 8/16/24/32-bit or 32-bit float) → { samples (mono), sampleRate } or null */
function trParseWav(buf) {
  try {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const str = (o, n) => String.fromCharCode.apply(null, u8.subarray(o, o + n));
    if (str(0, 4) !== 'RIFF' || str(8, 4) !== 'WAVE') return null;
    let p = 12, fmt = null;
    while (p + 8 <= u8.length) {
      const id = str(p, 4), len = dv.getUint32(p + 4, true), body = p + 8;
      if (id === 'fmt ') fmt = { format: dv.getUint16(body, true), ch: dv.getUint16(body + 2, true), sr: dv.getUint32(body + 4, true), bits: dv.getUint16(body + 14, true) };
      else if (id === 'data' && fmt) {
        const bps = fmt.bits / 8, frames = Math.floor(Math.min(len, u8.length - body) / (bps * fmt.ch)), out = new Float32Array(frames);
        for (let i = 0; i < frames; i++) {
          let s = 0;
          for (let c = 0; c < fmt.ch; c++) {
            const o = body + (i * fmt.ch + c) * bps;
            s += fmt.format === 3 && fmt.bits === 32 ? dv.getFloat32(o, true) : fmt.bits === 16 ? dv.getInt16(o, true) / 32768 : fmt.bits === 8 ? (u8[o] - 128) / 128 : fmt.bits === 24 ? (((u8[o + 2] << 24) | (u8[o + 1] << 16) | (u8[o] << 8)) >> 8) / 8388608 : dv.getInt32(o, true) / 2147483648;
          }
          out[i] = s / fmt.ch;
        }
        return { samples: out, sampleRate: fmt.sr };
      }
      p = body + len + (len & 1);
    }
  } catch (e) { /* not a WAV file */ }
  return null;
}
/* an AudioBuffer → mono samples */
function trMono(ab) {
  const n = ab.numberOfChannels || 1, out = new Float32Array(ab.length);
  for (let c = 0; c < n; c++) { const d = ab.getChannelData(c); for (let i = 0; i < out.length; i++) out[i] += d[i] / n; }
  return out;
}
/* halve the sample rate (averaging pairs) while it is above 32 kHz: the chords live below 2 kHz */
function trDecimate(samples, sr) {
  while (sr > 32000) {
    const out = new Float32Array(Math.floor(samples.length / 2));
    for (let i = 0; i < out.length; i++) out[i] = (samples[2 * i] + samples[2 * i + 1]) / 2;
    samples = out; sr /= 2;
  }
  return { samples, sampleRate: sr };
}
/* The practice track without Web Audio: bass, chords and melody events (Backing.arrange) as sines with a few
   harmonics, decaying like a piano (pads hold). → Float32Array */
function trSynth(events, sr, spb, seconds, lead) {
  const out = new Float32Array(Math.ceil(seconds * sr)), t0 = lead || 0.05;
  const note = (m, at, dur, vel, held) => {
    const f = 440 * Math.pow(2, (m - 69) / 12), a = Math.floor(at * sr), len = Math.min(out.length - a, Math.floor((dur + 0.15) * sr));
    [[1, 1], [2, 0.45], [3, 0.2], [4, 0.1]].forEach(([h, amp]) => {
      const w = 2 * Math.PI * f * h / sr; if (f * h > sr * 0.45) return;
      const cw = Math.cos(w), sw = Math.sin(w), k = held ? 0.4 / sr : 2.2 / sr;
      let c = 1, s = 0, env = vel * amp;
      for (let i = 0; i < len; i++) {
        const fade = i < 200 ? i / 200 : (i > len - 800 ? Math.max(0, (len - i) / 800) : 1);
        out[a + i] += s * env * fade;
        const nc = c * cw - s * sw; s = s * cw + c * sw; c = nc;
        env *= 1 - k;
      }
    });
  };
  events.forEach(e => {
    if (e.role === 'drums') return;
    const at = t0 + e.t * spb, d = e.d * spb;
    if (e.role === 'chords') (e.kind === 'arp' ? [e.m] : e.ms).forEach(m => note(m, at, d, e.kind === 'pad' ? 0.18 : 0.25, e.kind === 'pad'));
    else note(e.m, at, d, e.role === 'bass' ? 0.4 : 0.3, false);
  });
  let peak = 0; for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] *= 0.8 / peak;
  return out;
}

/* ---------- decoding and the practice track ---------- */
/* an ArrayBuffer from a file → Promise<{ samples, sampleRate }>: the browser's decoder, else a WAV reader */
function trDecode(ab) {
  const ctx = Sound.ensure();
  const viaWav = () => { const w = trParseWav(ab); if (!w) throw new Error('This file could not be opened.'); return w; };
  if (!ctx || typeof ctx.decodeAudioData !== 'function') return Promise.resolve().then(viaWav);
  return new Promise((res, rej) => {
    let settled = false;
    const ok = buf => { if (!settled) { settled = true; res({ samples: trMono(buf), sampleRate: buf.sampleRate, buffer: buf }); } };
    const bad = () => { if (!settled) { settled = true; try { res(viaWav()); } catch (e) { rej(e); } } };
    try { const p = ctx.decodeAudioData(ab.slice(0), ok, bad); if (p && p.then) p.then(ok, bad); } catch (e) { bad(); }
  });
}
/* the practice track: a Motif-written progression played by a backing style → Promise<clip> */
function trPractice(spec) {
  spec = Object.assign({ romans: ['I', 'vi', 'IV', 'V'], key: 'C', mode: 'major', bpm: 92, style: 'ballad', repeat: 2 }, spec || {});
  const list = [];
  for (let r = 0; r < spec.repeat; r++) spec.romans.forEach(x => list.push(x));
  const opts = { style: spec.style, chords: list, key: spec.key, mode: spec.mode, bpm: spec.bpm, loop: false, voices: 3, mute: { drums: !spec.drums } };
  const arr = Backing.arrange(opts), spb = 60 / spec.bpm, secs = arr.len * spb + 1.2;
  const name = `Practice track: ${spec.romans.join('–')} in ${Theory.keyName(spec.key, spec.mode)}`;
  const chords = arr.chords.map(c => ({ sym: c.sym, t: 0.05 + c.t * spb, d: c.d * spb }));
  const base = { name, practice: true, bpm: spec.bpm, grid: spb, offset: 0.05, answer: chords, key: spec.key, mode: spec.mode };
  const rendered = Backing.render(Object.assign({}, opts, { seconds: secs, sampleRate: 22050 }));
  const fromSynth = () => { const sr = 22050; return Object.assign(base, { samples: trSynth(arr.events, sr, spb, secs), sampleRate: sr }); };
  if (!rendered) return Promise.resolve(fromSynth());
  return rendered.then(buf => {
    const s = trMono(buf);
    /* a silent render (a browser that only pretends) falls back to the synth */
    let e = 0; for (let i = 0; i < s.length; i += 64) e += Math.abs(s[i]);
    return e > 0 ? Object.assign(base, { samples: s, sampleRate: buf.sampleRate, buffer: buf }) : fromSynth();
  }, fromSynth);
}

/* ---------- playback: an <audio> element (pitch kept when slowed), else a buffer source, else a silent clock ---------- */
function trPlayer(clip, onLive) {
  const ctx = Sound.ensure();
  let au = null, src = null, an = null, srcNode = null, startAt = 0, pos = 0, rate = 1, playing = false;
  const canUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
  if (canUrl && (clip.file || clip.samples)) {
    try {
      const blob = clip.file || new Blob([trWav(clip.samples, clip.sampleRate)], { type: 'audio/wav' });
      clip.url = URL.createObjectURL(blob);
      au = document.createElement('audio'); au.preload = 'auto'; au.src = clip.url;
      au.preservesPitch = true; au.mozPreservesPitch = true; au.webkitPreservesPitch = true;
    } catch (e) { au = null; }
  }
  /* the analyser hears what plays, through the same chroma analysis as the mic */
  function wire() {
    if (an || !ctx || !ctx.createAnalyser) return;
    try {
      an = ctx.createAnalyser(); an.fftSize = 16384; an.smoothingTimeConstant = 0.5;
      if (au && ctx.createMediaElementSource) { srcNode = ctx.createMediaElementSource(au); srcNode.connect(ctx.destination); srcNode.connect(an); }
      if (onLive) onLive(an);
    } catch (e) { an = null; }
  }
  const p = {
    get time() { if (au) return au.currentTime || 0; return playing ? pos + (Sound.now() - startAt) * rate : pos; },
    get playing() { return au ? !au.paused : playing; },
    get media() { return au; }, get analyser() { return an; }, get rate() { return rate; },
    get pitchKept() { return !!au; },
    play() {
      if (p.playing) return;
      Sound.ensure(); wire();
      if (au) { const r = au.play(); if (r && r.catch) r.catch(() => { /* blocked or not playable: the button shows Play again */ }); return; }
      playing = true;
      startAt = Sound.now();
      if (clip.buffer && ctx && ctx.createBufferSource) {
        try { src = ctx.createBufferSource(); src.buffer = clip.buffer; src.playbackRate.value = rate; src.connect(ctx.destination); if (an) src.connect(an); src.start(0, pos); } catch (e) { src = null; }
      }
    },
    pause() {
      if (au) { if (!au.paused) au.pause(); return; }
      if (!playing) return;
      pos = p.time; playing = false;
      if (src) { try { src.stop(); } catch (e) { /* already stopped */ } src = null; }
    },
    seek(t) {
      t = Math.max(0, Math.min(clip.duration || 0, t));
      if (au) { try { au.currentTime = t; } catch (e) { /* not ready yet */ } return; }
      const was = playing; if (was) p.pause(); pos = t; if (was) p.play();
    },
    setRate(r) {
      const was = playing && !au; if (was) p.pause();
      rate = r;
      if (au) { au.playbackRate = r; au.preservesPitch = true; au.mozPreservesPitch = true; au.webkitPreservesPitch = true; }
      if (was) p.play();
    },
    destroy() {
      p.pause();
      try { if (srcNode) srcNode.disconnect(); if (an) an.disconnect(); } catch (e) { /* gone */ }
      if (au) { try { au.removeAttribute('src'); } catch (e) { /* gone */ } }
      if (clip.url && canUrl && URL.revokeObjectURL) { try { URL.revokeObjectURL(clip.url); } catch (e) { /* gone */ } }
    }
  };
  return p;
}

/* ---------- the tool ---------- */
function trMount(el, o) {
  o = Object.assign({ need: 0 }, o || {});
  const need = o.need || 0, uid = 'tr-' + Math.random().toString(36).slice(2, 7);
  el.innerHTML = `<div class="tr">
    ${o.prompt ? `<p class="prompt">${o.prompt}</p>` : ''}
    <p class="lead">Open a song from your own device, loop a passage, slow it down, and work out its chords. Motif suggests a chord for each stretch; you decide by ear, and by playing it.</p>
    <div class="row tr-open"><label class="btn primary tr-file" for="${uid}-f">Open an audio file<input id="${uid}-f" type="file" accept="audio/*" data-tr="file"></label><button type="button" class="btn" data-tr="practice">Use a practice track</button></div>
    <p class="muted small tr-private">Your file stays on this device. Nothing is uploaded.</p>
    <p class="fb info" data-tr="status" aria-live="polite"></p>
    <div class="tr-work" hidden>
      <div class="tr-title"><b data-tr="name"></b> <span class="mono muted" data-tr="dur"></span></div>
      <div class="tr-wave" data-tr="wave"><canvas aria-label="Waveform. Drag across it to loop a passage; tap to jump there." role="img"></canvas></div>
      <div class="row tr-transport">
        <button type="button" class="btn small primary" data-tr="play">▶ Play</button>
        <button type="button" class="btn small" data-tr="back" aria-label="Back 5 seconds">⟲ 5 s</button>
        <span class="mono tr-time" data-tr="time">0:00</span>
        <button type="button" class="btn small" data-tr="setA">Set A</button><button type="button" class="btn small" data-tr="setB">Set B</button><button type="button" class="btn small ghost" data-tr="clear">Clear loop</button>
        <label class="sel tr-speed" for="${uid}-s"><span>Speed <b class="mono" data-tr="rate">100%</b></span><input id="${uid}-s" type="range" min="50" max="100" step="5" value="100" data-tr="speed"></label>
      </div>
      <p class="muted small" data-tr="loopinfo">Drag across the waveform to loop a passage, or use Set A and Set B while it plays.</p>
      <div class="eyebrow">Suggested chords <span class="tr-now" data-tr="now"></span></div>
      <div class="tr-strip" data-tr="strip"></div>
      <div class="row"><button type="button" class="btn small ghost" data-tr="add">+ Add a chord here</button><span class="muted small">for a stretch Motif found nothing in (the loop, or two seconds from the playhead)</span></div>
      <div class="tr-pick" data-tr="pick" hidden></div>
      <div class="eyebrow">Your chord chart</div>
      <div class="tr-chart" data-tr="chart"></div>
      <ul class="nt-checks" data-tr="checks"></ul>
      <div class="field"><label for="${uid}-n">Name it</label><input id="${uid}-n" type="text" maxlength="40" placeholder="Give it a name" data-tr="nm"></div>
      <div class="row"><button type="button" class="btn primary" data-tr="save" disabled>Save to sketchbook</button></div>
      <p class="fb info" data-tr="saved" aria-live="polite"></p>
    </div></div>`;
  const $ = s => el.querySelector(`[data-tr="${s}"]`);
  const work = el.querySelector('.tr-work'), status = $('status'), strip = $('strip'), pickEl = $('pick'), canvas = $('wave').querySelector('canvas');
  let clip = null, player = null, segs = [], key = null, sel = -1, cand = null, loop = null, peaks = null, raf = 0, alive = true, token = 0, saved = false;
  let wasPlaying = false, liveTrack = null, liveDb = null, liveAn = null, nowSym = null, lastLive = 0, drag = null;
  ChordIn.start();
  const say = (kind, text) => fb(status, kind, text);
  const confirmed = () => segs.filter(s => s.ok).sort((a, b) => a.t - b.t);

  /* ----- loading ----- */
  function load(c) {
    if (player) player.destroy();
    clip = c; clip.duration = clip.samples.length / clip.sampleRate;
    segs = []; sel = -1; cand = null; loop = null; saved = false; key = null; nowSym = null;
    player = trPlayer(clip, an => { liveAn = an; liveDb = new Float32Array(an.frequencyBinCount); liveTrack = createChordTracker({ need: 3, release: 5 }); });
    if (player.media) clip.buffer = null;   /* the <audio> element plays it: no need to keep the decoded copy */
    work.hidden = false;
    $('name').textContent = clip.name; $('dur').textContent = trClock(clip.duration);
    $('nm').value = o.save && o.save.name ? o.save.name : (clip.practice ? 'Practice transcription' : 'Transcription: ' + clip.name.replace(/\.[a-z0-9]+$/i, '')).slice(0, 40);
    $('rate').textContent = '100%'; $('speed').value = 100;
    if (!player.pitchKept) $('loopinfo').textContent = 'Drag across the waveform to loop a passage. In this browser, slowing down also lowers the pitch.';
    peaks = null; draw(); paint();
    const my = ++token, d = trDecimate(clip.samples, clip.sampleRate);
    say('info', 'Listening for chords… 0%');
    return trAnalyse(d.samples, d.sampleRate, { hop: 0.2, cancelled: () => !alive || my !== token, onProgress: f => { if (alive && my === token) say('info', `Listening for chords… ${Math.round(f * 100)}%`); } })
      .then(frames => {
        if (!alive || my !== token) return;
        const sp = trSpell(trSmooth(frames, { hop: 0.2, minDur: 0.8, grid: clip.grid, offset: clip.offset }));
        segs = sp.segments; key = sp.key;
        say(segs.length ? 'info' : 'warn', segs.length ? `${segs.length} chord${segs.length === 1 ? '' : 's'} suggested${key ? `, probably in ${key.name}` : ''}. Pick one, listen, and confirm it by playing it.` : 'No clear chords found. Loop a passage and play along to find them by ear.');
        if (segs.length) select(0, true);
        paint();
      });
  }
  function openFile(file) {
    if (!file) return Promise.resolve();
    say('info', 'Opening ' + file.name + '…');
    const read = file.arrayBuffer ? file.arrayBuffer() : new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsArrayBuffer(file); });
    return read.then(ab => (o.decode || trDecode)(ab)).then(d => load({ name: file.name, file, samples: d.samples, sampleRate: d.sampleRate, buffer: d.buffer }))
      .catch(() => say('bad', 'This file could not be opened here. Try an MP3, M4A or WAV file, or use the practice track.'));
  }
  function usePractice(spec) {
    say('info', 'Making the practice track…');
    return trPractice(Object.assign({}, o.practice || {}, spec || {})).then(c => alive ? load(c) : null);
  }

  /* ----- selecting and confirming ----- */
  function select(i, quiet) {
    if (!segs[i]) return;
    sel = i; cand = null; ChordIn.clear();
    const s = segs[i];
    loop = trLoopOf(s.t, s.t + s.d, clip.duration);
    if (player && !quiet) player.seek(loop.a);
    paint();
  }
  function confirm(i, sym) {
    const s = segs[i]; if (!s) return;
    s.ok = true; s.chosen = sym || s.chosen || s.sym; saved = false; $('saved').textContent = '';
    ChordIn.clear();
    const next = segs.findIndex((x, j) => j > i && !x.ok);
    if (next >= 0) select(next); else paint();
    if (o.onConfirm) o.onConfirm(confirmed());
  }
  function hearChord(sym) { try { playChordList([{ sym, t: 0, d: 1.4 }], 4); } catch (e) { /* unknown symbol */ } }

  /* ----- painting ----- */
  function paint() {
    if (!clip) return;
    strip.innerHTML = segs.length ? segs.map((s, i) => `<button type="button" class="tr-seg${s.ok ? ' ok' : ''}${i === sel ? ' sel' : ''}" data-i="${i}" aria-pressed="${i === sel}"><small class="mono">${trClock(s.t)}</small><b>${esc(Theory.pretty(s.ok ? s.chosen : s.sym || '?'))}</b>${s.ok ? '<i aria-label="confirmed">✓</i>' : ''}</button>`).join('') : '<span class="muted small">No suggestions yet.</span>';
    strip.querySelectorAll('.tr-seg').forEach(b => { b.onclick = () => select(+b.dataset.i); });
    const s = segs[sel];
    pickEl.hidden = !s;
    if (s) {
      const k = key || { tonic: 'C', mode: 'major' };
      const alts = [...new Set((s.alts || []).concat(Theory.diatonic(k.tonic, k.mode === 'minor' ? 'minor' : 'major').slice(0, 6).map(c => c.sym)))].filter(x => x !== s.sym).slice(0, 6);
      const use = cand || s.sym;
      const said = s.sym ? `Motif hears <b class="tr-sug">${esc(Theory.pretty(s.sym))}</b>` : 'Motif found no clear chord here';
      pickEl.innerHTML = `<p><span class="mono">${trClock(s.t)}–${trClock(s.t + s.d)}</span> · ${said}${s.ok ? `. You confirmed <b>${esc(Theory.pretty(s.chosen))}</b>.` : s.sym ? '. Listen, then play it on the keys or tap Yes.' : '. Play the chord you hear on the keys, or pick one below.'}</p>
        <div class="row"><button type="button" class="btn small" data-tp="bit">▶ This bit</button>${use ? `<button type="button" class="btn small" data-tp="hear">▶ ${esc(Theory.pretty(use))} on its own</button>` : ''}<button type="button" class="btn small primary" data-tp="yes"${use ? '' : ' disabled'}>${cand ? '✓ Use ' + esc(Theory.pretty(cand)) : '✓ Yes, that’s it'}</button></div>
        <div class="tr-alts"><span class="muted small">Not quite? Tap another to hear it:</span>${alts.map(a => `<button type="button" class="chip tr-alt${a === cand ? ' on' : ''}" data-alt="${esc(a)}">${esc(Theory.pretty(a))}</button>`).join('')}</div>
        <p class="fb" data-tp="fb"></p>`;
      pickEl.querySelector('[data-tp="bit"]').onclick = () => { loop = trLoopOf(s.t, s.t + s.d, clip.duration); player.seek(loop.a); player.play(); paintPlay(); };
      if (use) pickEl.querySelector('[data-tp="hear"]').onclick = () => hearChord(use);
      pickEl.querySelector('[data-tp="yes"]').onclick = () => { if (cand || s.sym) confirm(sel, cand || s.sym); };
      pickEl.querySelectorAll('[data-alt]').forEach(b => { b.onclick = () => { cand = b.dataset.alt; hearChord(cand); paint(); }; });
    }
    const ch = confirmed();
    $('chart').innerHTML = ch.length ? ch.map(x => `<span class="tr-cell"><b>${esc(Theory.pretty(x.chosen))}</b><small class="mono">${trClock(x.t)}</small></span>`).join('') : '<span class="muted small">Confirmed chords appear here, in order.</span>';
    const goal = Math.max(1, need), n = ch.length;
    $('checks').innerHTML = `<li class="${n >= goal ? 'ok' : ''}">${n >= goal ? '✓' : '○'} Confirm ${goal === 1 ? 'at least one chord' : goal + ' chords'} (${n} so far)</li>`;
    $('save').disabled = saved || n < goal;
    paintLoop(); draw();
  }
  function paintLoop() {
    $('loopinfo').textContent = loop ? `Looping ${trClock(loop.a)}–${trClock(loop.b)}${loop.b - loop.a < 10 ? ` (${(loop.b - loop.a).toFixed(1)} s)` : ''}.` : (player && !player.pitchKept ? 'Drag across the waveform to loop a passage. In this browser, slowing down also lowers the pitch.' : 'Drag across the waveform to loop a passage, or use Set A and Set B while it plays.');
  }
  const paintPlay = () => { $('play').textContent = player && player.playing ? '❚❚ Pause' : '▶ Play'; };
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  function draw() {
    if (!clip || !canvas.getContext) return;
    const w = canvas.clientWidth || 0, h = canvas.clientHeight || 72, dpr = window.devicePixelRatio || 1;
    if (!w) return;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); peaks = null; }
    if (!peaks) peaks = trPeaks(clip.samples, Math.max(1, Math.floor(w)));
    const g = canvas.getContext('2d'); if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const x = t => t / clip.duration * w;
    if (loop) { g.fillStyle = css('--glow-soft'); g.fillRect(x(loop.a), 0, x(loop.b) - x(loop.a), h); }
    g.fillStyle = css('--accent');
    let top = 0.001; for (let i = 0; i < peaks.max.length; i++) top = Math.max(top, peaks.max[i], -peaks.min[i]);
    for (let i = 0; i < peaks.max.length; i++) { const y0 = h / 2 - peaks.max[i] / top * h * 0.46, y1 = h / 2 - peaks.min[i] / top * h * 0.46; g.fillRect(i, y0, 1, Math.max(1, y1 - y0)); }
    g.fillStyle = css('--muted');
    segs.forEach(s => g.fillRect(x(s.t), h - 6, 1, 6));
    if (player) { g.fillStyle = css('--glow'); g.fillRect(Math.min(w - 2, x(player.time)), 0, 2, h); }
  }
  /* ----- the clock: playhead, loop, live analysis ----- */
  function tick() {
    if (!alive) return;
    raf = requestAnimationFrame(tick);
    if (!player || !clip) return;
    if (player.playing !== wasPlaying) { wasPlaying = player.playing; paintPlay(); }
    let tm = player.time;
    if (player.playing) {
      const w = trWrap(tm, loop);
      if (w !== tm) { player.seek(w); tm = w; }
      else if (tm >= clip.duration - 0.02 && !player.media) { player.pause(); player.seek(0); paintPlay(); }
    }
    $('time').textContent = trClock(tm);
    const at = segs.findIndex(s => tm >= s.t && tm < s.t + s.d);
    strip.querySelectorAll('.tr-seg').forEach(b => b.classList.toggle('on', +b.dataset.i === at && player.playing));
    if (liveAn && player.playing && Date.now() - lastLive > 60) {
      lastLive = Date.now();
      liveAn.getFloatFrequencyData(liveDb);
      const r = spectrumChord(liveDb, Sound.ctx.sampleRate, liveAn.fftSize, trMatch());
      const u = liveTrack.update(r.m);
      if (u.on) nowSym = trSym(u.on).sym; else if (u.off) nowSym = null;
      $('now').textContent = nowSym ? '· hearing ' + Theory.pretty(nowSym) + ' now' : '';
    }
    if (player.playing) draw();
  }
  /* ----- input: the learner plays the chord ----- */
  const offChord = Bus.on('chord', ev => {
    if (!clip || !segs.length) return;
    if (ev.source === 'mic' && player && player.playing) return;   /* the mic would hear the recording itself */
    if (sel < 0) { const tm = player ? player.time : 0, at = segs.findIndex(s => tm >= s.t && tm < s.t + s.d); select(at >= 0 ? at : 0, true); }
    const s = segs[sel]; if (!s || !ev.sym) return;
    /* the suggestion, or the chord picked instead of it: playing either confirms it */
    const target = [s.sym, cand].filter(Boolean).find(x => { try { return chordHit(ev, chordTarget(x)); } catch (e) { return false; } });
    if (target) {
      confirm(sel, target);
      say('good', `${trClock(s.t)}: you played ${Theory.pretty(target)}${target === s.sym ? ', the chord Motif heard' : ''}. Confirmed.`);
    } else {
      cand = ev.sym.replace(/\/.*$/, '');
      paint();
      const f3 = pickEl.querySelector('[data-tp="fb"]');
      if (f3) fb(f3, 'info', `You played ${Theory.pretty(ev.sym)}. Does it match? Tap “Use ${Theory.pretty(cand)}” to keep it, or keep listening.`);
    }
  });

  /* ----- controls ----- */
  const fileIn = $('file');
  fileIn.onchange = () => { const f = fileIn.files && fileIn.files[0]; if (f) openFile(f); fileIn.value = ''; };
  $('practice').onclick = () => usePractice();
  $('play').onclick = () => { if (!player) return; if (player.playing) player.pause(); else { if (loop && (player.time < loop.a || player.time >= loop.b)) player.seek(loop.a); player.play(); } paintPlay(); };
  $('back').onclick = () => { if (player) player.seek(player.time - 5); };
  $('setA').onclick = () => { if (!player) return; const t = player.time; loop = loop && loop.b > t + 0.25 ? trLoopOf(t, loop.b, clip.duration) : trLoopOf(t, Math.min(clip.duration, t + 4), clip.duration); paint(); };
  $('setB').onclick = () => { if (!player) return; const t = player.time; loop = trLoopOf(loop ? loop.a : Math.max(0, t - 4), t, clip.duration); paint(); };
  $('clear').onclick = () => { loop = null; paint(); };
  $('add').onclick = () => {
    if (!player) return;
    const a = loop ? loop.a : player.time, b = loop ? loop.b : Math.min(clip.duration, player.time + 2);
    if (b - a < 0.2) return;
    const seg = { t: +a.toFixed(3), d: +(b - a).toFixed(3), sym: null, root: null, q: null, rootPc: null, score: 0, alts: [], added: true };
    segs.push(seg); segs.sort((x, y) => x.t - y.t);
    select(segs.indexOf(seg), true);
    say('info', 'Added a chord at ' + trClock(a) + '. Play the chord you hear on the keys.');
  };
  $('speed').oninput = () => { const r = +$('speed').value / 100; $('rate').textContent = Math.round(r * 100) + '%'; if (player) player.setRate(r); };
  const timeAt = ev => { const r = canvas.getBoundingClientRect(); return r.width > 0 && clip ? Math.max(0, Math.min(clip.duration, (ev.clientX - r.left) / r.width * clip.duration)) : null; };
  canvas.addEventListener('pointerdown', ev => { const t = timeAt(ev); if (t == null) return; drag = { a: t, x: ev.clientX }; try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ } });
  canvas.addEventListener('pointermove', ev => { if (!drag) return; const t = timeAt(ev); if (t == null) return; if (Math.abs(ev.clientX - drag.x) > 6) { loop = trLoopOf(drag.a, t, clip.duration); draw(); } });
  canvas.addEventListener('pointerup', ev => {
    if (!drag) return; const t = timeAt(ev), d = drag; drag = null; if (t == null) return;
    if (Math.abs(ev.clientX - d.x) > 6) { loop = trLoopOf(d.a, t, clip.duration); player.seek(loop.a); } else player.seek(t);
    paint();
  });
  $('save').onclick = () => {
    const ch = confirmed(); if (ch.length < Math.max(1, need)) return;
    const t0 = ch[0].t, chords = ch.map(x => ({ sym: x.chosen, t: +(x.t - t0).toFixed(3), d: +x.d.toFixed(3) }));
    const k = Theory.findKey(chords.map(x => ({ sym: x.sym, d: x.d })))[0], sv = o.save || {};
    const sketch = saveSketch({
      name: $('nm').value.trim() || 'Transcription', chords, key: k.tonic, mode: k.mode, bpm: clip.bpm || undefined,
      prompt: sv.prompt || o.prompt || 'Transcribe the chords of a recording.', tags: ['transcription'].concat(sv.tags || []), level: sv.level,
      source: { name: clip.name, start: t0, practice: !!clip.practice }
    });
    saved = true; $('save').disabled = true;
    fb($('saved'), 'good', `Saved “${sketch.name}” to your sketchbook: ${chords.map(x => Theory.pretty(x.sym)).join(' ')}, in ${k.name}.`);
    if (o.onSave) o.onSave(sketch, chords);
  };
  raf = requestAnimationFrame(tick);
  const onResize = () => { peaks = null; draw(); };
  window.addEventListener('resize', onResize);
  return {
    openFile, usePractice, select, confirm, play: () => { if (player) { player.play(); paintPlay(); } }, pause: () => { if (player) { player.pause(); paintPlay(); } },
    seek: t => player && player.seek(t), setLoop(a, b) { loop = clip ? trLoopOf(a, b, clip.duration) : null; paint(); },
    get clip() { return clip; }, get segments() { return segs; }, get chart() { return confirmed().map(x => ({ sym: x.chosen, t: x.t, d: x.d })); },
    get loop() { return loop; }, get time() { return player ? player.time : 0; }, get ready() { return !!(clip && token && segs); }, get key() { return key; },
    get player() { return player; }, get selected() { return sel; }, get candidate() { return cand; },
    destroy() {
      if (!alive) return; alive = false;
      cancelAnimationFrame(raf); offChord(); ChordIn.stop(); window.removeEventListener('resize', onResize);
      if (player) player.destroy();
    }
  };
}

/* the task: confirm `need` chords (default 4), then save the chart */
Tasks.transcribe = (el, p, done) => {
  const tr = trMount(el, { prompt: p.prompt, need: p.need || 4, practice: p.practice, save: p.save, decode: p.decode,
    onSave: (sketch, chords) => done(true, { chords, sketch }) });
  return () => tr.destroy();
};

const Transcribe = {
  mount: trMount, frameDb: trFrameDb, chroma: trChroma, frames: trFramesSync, analyse: trAnalyse, smooth: trSmooth, spell: trSpell,
  peaks: trPeaks, loopOf: trLoopOf, wrap: trWrap, wav: trWav, parseWav: trParseWav, synth: trSynth, mono: trMono, decimate: trDecimate,
  decode: trDecode, practice: trPractice, clock: trClock, QUALITIES: TR_QUALS
};
