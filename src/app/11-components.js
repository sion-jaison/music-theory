/* =================================================================
   Shared components for Levels 2–5
   Staff notation, the Circle of Fifths, chord input (keys, MIDI, mic),
   and three reusable tasks: quiz, playSeq, playChords.
   ================================================================= */

/* ---------- sound helpers ---------- */
Sound.chord = function (midis, when, dur, vel) {
  const t0 = when == null ? this.now() + 0.05 : when;
  midis.forEach((m, i) => this.tone(m, t0 + i * 0.015, dur || 1.2, vel || 0.55));
  return t0 + (dur || 1.2);
};
/* chords: [{ sym, t, d }] → plays each chord voiced from octave 3 (or `oct`); returns duration in ms */
function playChordList(chords, oct) {
  const notes = [];
  chords.forEach(c => {
    const pc = Theory.parseChord(c.sym);
    let ms = Theory.voicing(pc.root, pc.q, oct == null ? 3 : oct);
    if (pc.bass) { const b = Theory.pc(pc.bass); while (mod12(ms[0]) !== b) { ms.push(ms.shift() + 12); } }
    ms.forEach((m, i) => notes.push({ m, t: c.t + i * 0.015, d: c.d || 0.9, v: 0.55 }));
  });
  return Sound.seq(notes);
}
const midiOf = n => Theory.midi(n);
/* play a sketch: its melody plus, if it has them, its chords underneath */
function playSketch(s) {
  const notes = (s.notes || []).map(n => ({ m: n.m, t: n.t, d: n.d || 0.4 }));
  (s.chords || []).forEach(c => {
    try { Theory.voicing(Theory.parseChord(c.sym).root, Theory.parseChord(c.sym).q, 3).forEach(m => notes.push({ m, t: c.t, d: c.d || 1, v: 0.4 })); } catch (e) { /* skip unknown symbols */ }
  });
  return Sound.seq(notes);
}

/* ---------- staff notation ----------
   Staff.svg({ clef: 'treble'|'bass'|'grand', notes, keySig, time, labels, marks, gap, filled, aria })
   notes: 'C4' | ['C4','E4','G4'] (a chord) | null (empty slot) | { n: 'C4' or [...], label, mark, staff }
   keySig: signed count (+ sharps, − flats). time: [3, 4]. marks: 'ok' | 'no' | 'target' per note. */
const Staff = (function () {
  const GAP = 10, HALF = GAP / 2;
  const step = n => { const p = Theory.parse(n); return p.L + 7 * p.oct; };
  const CLEFS = {
    treble: { bottom: 30, glyph: '𝄞', size: 40.6, dy: 40.5, sharps: ['F5', 'C5', 'G5', 'D5', 'A4', 'E5', 'B4'], flats: ['B4', 'E5', 'A4', 'D5', 'G4', 'C5', 'F4'] },
    bass: { bottom: 18, glyph: '𝄢', size: 45.4, dy: 40.4, sharps: ['F3', 'C3', 'G3', 'D3', 'A2', 'E3', 'B2'], flats: ['B2', 'E3', 'A2', 'D3', 'G2', 'C3', 'F2'] }
  };
  const ACC_GLYPH = { '-2': '𝄫', '-1': '♭', '0': '♮', '1': '♯', '2': '𝄪' };
  function norm(item) {
    if (item == null) return { ns: [] };
    if (typeof item === 'string' || Array.isArray(item)) return { ns: [].concat(item) };
    return { ns: [].concat(item.n || []), label: item.label, mark: item.mark, staff: item.staff, acc: item.acc };
  }
  function svg(o) {
    o = o || {};
    const clef = o.clef || 'treble', grand = clef === 'grand';
    const items = (o.notes || []).map(norm);
    items.forEach(it => { it.staff = it.staff || (grand ? (it.ns.length && step(it.ns[0]) >= 28 ? 'treble' : 'bass') : clef); });
    const staves = grand ? ['treble', 'bass'] : [clef];
    /* vertical room for ledger lines above and below */
    const ext = {};
    staves.forEach(k => {
      const c = CLEFS[k], top = c.bottom + 8;
      let hi = top, lo = c.bottom;
      items.forEach(it => { if (it.staff !== k) return; it.ns.forEach(n => { const s = step(n); hi = Math.max(hi, s); lo = Math.min(lo, s); }); });
      ext[k] = { above: (hi - top) * HALF + 14, below: (c.bottom - lo) * HALF + 14 };
    });
    const y0 = {};
    let y = 12 + Math.max(16, ext[staves[0]].above);
    y0[staves[0]] = y;
    if (grand) y0.bass = y + 4 * GAP + Math.max(50, ext.treble.below + ext.bass.above);
    const lastStaff = staves[staves.length - 1];
    const labelsY = y0[lastStaff] + 4 * GAP + Math.max(16, ext[lastStaff].below) + 14;
    const H = labelsY + (items.some(it => it.label) || o.labels ? 10 : -4);
    const yOf = (k, s) => y0[k] + 4 * GAP - (s - CLEFS[k].bottom) * HALF;

    const ks = o.keySig || 0, nAcc = Math.abs(ks);
    const xKey = 48, xTime = xKey + nAcc * 11 + (nAcc ? 4 : 0), xNotes = xTime + (o.time ? 30 : 4) + 18;
    const gap = o.gap || 48;
    const W = Math.max(o.minWidth || 0, xNotes + Math.max(1, items.length) * gap);
    let out = '';
    staves.forEach(k => {
      const c = CLEFS[k];
      for (let i = 0; i < 5; i++) out += `<line class="sl" x1="4" x2="${W - 4}" y1="${y0[k] + i * GAP}" y2="${y0[k] + i * GAP}"/>`;
      out += `<text class="clef" x="8" y="${y0[k] + c.dy}" font-size="${c.size}">${c.glyph}</text>`;
      const list = ks > 0 ? c.sharps : c.flats;
      for (let i = 0; i < nAcc; i++) out += `<text class="acc" x="${xKey + i * 11}" y="${yOf(k, step(list[i])) + 5}" text-anchor="middle">${ks > 0 ? '♯' : '♭'}</text>`;
      if (o.time) out += `<text class="tsig" x="${xTime + 10}" y="${y0[k] + 18}" text-anchor="middle">${o.time[0]}</text><text class="tsig" x="${xTime + 10}" y="${y0[k] + 38}" text-anchor="middle">${o.time[1]}</text>`;
    });
    if (grand) out += `<line class="sl" x1="4" x2="4" y1="${y0.treble}" y2="${y0.bass + 4 * GAP}"/>`;
    items.forEach((it, i) => {
      const x = xNotes + i * gap + gap / 2 - 10;
      const k = it.staff, c = CLEFS[k], top = c.bottom + 8;
      const mark = it.mark || (o.marks && o.marks[i]) || '';
      const steps = it.ns.map(step).sort((a, b) => a - b);
      if (steps.length) {
        const lo = steps[0], hi = steps[steps.length - 1];
        for (let s = c.bottom - 2; s >= lo; s -= 2) out += `<line class="sl ledger" x1="${x - 11}" x2="${x + 11}" y1="${yOf(k, s)}" y2="${yOf(k, s)}"/>`;
        for (let s = top + 2; s <= hi; s += 2) out += `<line class="sl ledger" x1="${x - 11}" x2="${x + 11}" y1="${yOf(k, s)}" y2="${yOf(k, s)}"/>`;
      }
      let prev = -99, shift = 0;
      it.ns.slice().sort((a, b) => step(a) - step(b)).forEach(n => {
        const s = step(n), yy = yOf(k, s);
        shift = (s - prev === 1 && !shift) ? 12 : 0; prev = s;
        const p = Theory.parse(n);
        const show = it.acc === false ? false : (p.acc !== 0 || it.acc === 'natural');
        if (show) out += `<text class="acc" x="${x - 15}" y="${yy + 5}" text-anchor="middle">${ACC_GLYPH[p.acc]}</text>`;
        out += o.filled
          ? `<ellipse class="head filled ${mark}" cx="${x + shift}" cy="${yy}" rx="6" ry="4.4" transform="rotate(-20 ${x + shift} ${yy})"/>`
          : `<ellipse class="head ${mark}" cx="${x + shift}" cy="${yy}" rx="6.4" ry="4.4" transform="rotate(-20 ${x + shift} ${yy})"/>`;
      });
      if (o.filled && steps.length) {
        const mid = c.bottom + 4, upStem = steps[0] < mid;
        const yy = upStem ? yOf(k, steps[steps.length - 1]) : yOf(k, steps[0]);
        out += upStem ? `<line class="stem" x1="${x + 5.6}" x2="${x + 5.6}" y1="${yOf(k, steps[0]) - 1}" y2="${yy - 34}"/>` : `<line class="stem" x1="${x - 5.6}" x2="${x - 5.6}" y1="${yOf(k, steps[steps.length - 1]) + 1}" y2="${yy + 34}"/>`;
      }
      const label = it.label != null ? it.label : (o.labels ? o.labels[i] : null);
      if (label != null) out += `<text class="nlabel ${mark}" x="${x}" y="${labelsY}" text-anchor="middle">${label}</text>`;
    });
    const aria = o.aria || (clef + ' staff' + (items.length ? ': ' + items.map(it => it.ns.join(' ')).join(', ') : ''));
    return `<svg class="nstaff" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(aria)}">${out}</svg>`;
  }
  return { svg, step };
})();

/* ---------- the Circle of Fifths ----------
   Circle.svg({ selected, family, hide, reveal, marks, ring, center })
   selected: clock position 0–11 (C = 0, G = 1 …). family: light the six chords of the selected key.
   hide: hide the labels (fill-the-clock), reveal: positions to show anyway. marks: { pos: 'ok'|'no' }. */
const Circle = (function () {
  const C = 180, R1 = 176, R2 = 122, R3 = 74;
  const rad = d => d * Math.PI / 180;
  const pt = (r, deg) => [C + r * Math.cos(rad(deg)), C + r * Math.sin(rad(deg))].map(v => v.toFixed(1));
  function wedge(i, rin, rout) {
    const a0 = -90 + 30 * i - 15, a1 = a0 + 30;
    const [x0, y0] = pt(rout, a0), [x1, y1] = pt(rout, a1), [x2, y2] = pt(rin, a1), [x3, y3] = pt(rin, a0);
    return `M${x0} ${y0}A${rout} ${rout} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${rin} ${rin} 0 0 0 ${x3} ${y3}Z`;
  }
  function sigText(i) {
    if (i === 0) return 'no ♯ or ♭';
    if (i === 6) return '6♯ / 6♭';
    const n = Theory.keySig(Theory.CIRCLE[i]).n;
    return n > 0 ? n + '♯' : (-n) + '♭';
  }
  const FAMILY = { major: { '-1': 'IV', '0': 'I', '1': 'V' }, minor: { '-1': 'ii', '0': 'vi', '1': 'iii' } };
  function role(ring, i, sel) {
    if (sel == null) return null;
    let d = ((i - sel) % 12 + 12) % 12; if (d === 11) d = -1;
    return FAMILY[ring][d] || null;
  }
  function svg(o) {
    o = o || {};
    const sel = o.selected == null ? null : o.selected;
    const shown = i => !o.hide || (o.reveal && o.reveal.indexOf(i) >= 0);
    let out = '';
    for (let i = 0; i < 12; i++) {
      const a = -90 + 30 * i;
      ['major', 'minor'].forEach(ring => {
        if (ring === 'minor' && o.ring === 'major') return;
        const fam = o.family ? role(ring, i, sel) : null;
        const mk = o.marks && o.marks[ring === 'major' ? i : 'm' + i];
        const cls = `wedge ${ring}${sel === i && (ring === 'major' || o.family) ? ' sel' : ''}${fam ? ' fam' : ''}${mk ? ' ' + mk : ''}`;
        const r0 = ring === 'major' ? R2 : R3, r1 = ring === 'major' ? R1 : R2;
        const name = ring === 'major' ? Theory.CIRCLE[i] : Theory.CIRCLE_MINOR[i] + 'm';
        const alt = Theory.CIRCLE_ALT[i];
        let label = '';
        if (shown(i)) {
          if (ring === 'major') {
            const [x, y] = pt((R1 + R2) / 2 + 6, a);
            label = `<text class="kname" x="${x}" y="${(+y + 2).toFixed(1)}" text-anchor="middle">${name}</text>`;
            if (alt) label += `<text class="kalt" x="${x}" y="${(+y + 15).toFixed(1)}" text-anchor="middle">${alt.major}</text>`;
            if (o.sigs !== false && !fam) { const [sx, sy] = pt(R2 + 12, a); label += `<text class="ksig" x="${sx}" y="${(+sy + 3).toFixed(1)}" text-anchor="middle">${sigText(i)}</text>`; }
          } else {
            const [x, y] = pt((R2 + R3) / 2 + 4, a);
            label = `<text class="mname" x="${x}" y="${(+y + 4).toFixed(1)}" text-anchor="middle">${name}</text>`;
          }
        }
        if (fam) { const [fx, fy] = pt(ring === 'major' ? R2 + 12 : R3 + 8, a); label += `<text class="froman" x="${fx}" y="${(+fy + 4).toFixed(1)}" text-anchor="middle">${fam}</text>`; }
        out += `<g class="${cls}" data-pos="${i}" data-ring="${ring}" tabindex="${o.static ? -1 : 0}" role="${o.static ? 'img' : 'button'}" aria-label="${shown(i) ? (ring === 'major' ? Theory.CIRCLE[i] + ' major, ' + sigText(i) : Theory.CIRCLE_MINOR[i] + ' minor') : 'hidden key at ' + (i || 12) + ' o’clock'}"><path d="${wedge(i, r0, r1)}"/>${label}</g>`;
      });
    }
    let center = o.center;
    if (center == null) center = sel == null ? ['Tap a key'] : [Theory.CIRCLE[sel] + ' major', sigText(sel), Theory.CIRCLE_MINOR[sel] + ' minor'];
    const cy = C - (center.length - 1) * 9;
    out += `<circle class="hub" cx="${C}" cy="${C}" r="${R3 - 6}"/>` + center.map((t, k) => `<text class="hubtxt${k ? ' sub' : ''}" x="${C}" y="${cy + k * 19 + 5}" text-anchor="middle">${t}</text>`).join('');
    return `<svg class="circle5" viewBox="0 0 360 360" role="group" aria-label="Circle of Fifths">${out}</svg>`;
  }
  /* interactive: onPick(pos, ring) on click or Enter */
  function mount(el, o, onPick) {
    o = Object.assign({}, o);
    el.innerHTML = svg(o);
    const pick = ev => { const w = ev.target.closest('[data-pos]'); if (w && onPick) onPick(+w.dataset.pos, w.dataset.ring); };
    const key = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(ev); } };
    el.addEventListener('click', pick); el.addEventListener('keydown', key);
    return {
      update(n) { Object.assign(o, n); el.innerHTML = svg(o); },
      get opts() { return o; },
      destroy() { el.removeEventListener('click', pick); el.removeEventListener('keydown', key); }
    };
  }
  return { svg, mount, sigText };
})();

/* ---------- chord input ----------
   Emits Bus 'chord' events: { source, pcs, bassPc, rootPc, q, sym, inversion }.
   Keys and on-screen taps: notes played within WINDOW seconds form a chord.
   MIDI: held notes form a chord. Mic: chroma analysis (Mic.wantChords). */
const ChordIn = {
  users: 0, recent: [], held: new Set(), offs: [], WINDOW: 1.6,
  start() {
    if (this.users++ > 0) return;
    this.offs = [Bus.on('note', d => this.note(d)), Bus.on('noteoff', d => { if (d.source === 'midi') this.held.delete(d.midi); })];
    Mic.wantChords(true);
  },
  stop() {
    if (this.users === 0 || --this.users > 0) return;
    this.offs.forEach(f => f()); this.offs = []; this.recent = []; this.held.clear();
    Mic.wantChords(false);
  },
  clear() { this.recent = []; },
  note(d) {
    if (d.source === 'mic') return;
    const t = performance.now() / 1000;
    if (d.source === 'midi') this.held.add(d.midi);
    this.recent = this.recent.filter(n => t - n.t < this.WINDOW).concat([{ m: d.midi, t }]);
    const pool = d.source === 'midi' && this.held.size >= 3 ? [...this.held] : this.recent.map(n => n.m);
    /* try the whole window, then the last 4 and last 3 notes, so one wrong note does not block the chord */
    const tries = [pool, pool.slice(-4), pool.slice(-3)];
    let best = null, ms = pool;
    for (const cand of tries) {
      const pcs = [...new Set(cand.map(mod12))];
      if (pcs.length < 3) continue;
      const bass = Math.min.apply(null, cand);
      const id = Theory.identify(pcs, mod12(bass))[0];
      if (id) { best = id; ms = cand; break; }
    }
    const pcs = [...new Set(ms.map(mod12))].sort((a, b) => a - b);
    if (pcs.length < 3) return;
    Bus.emit('chord', chordEvent(d.source, pcs, mod12(Math.min.apply(null, ms)), best ? best.rootPc : null, best ? best.q : null));
  }
};
function chordEvent(source, pcs, bassPc, rootPc, q) {
  let sym = null, inversion = 0;
  if (q) {
    const root = Theory.rootName(rootPc, q);
    const shape = Theory.chordPcs(root, q);
    inversion = Math.max(0, shape.indexOf(bassPc));
    sym = Theory.symbol(root, q) + (inversion ? '/' + Theory.pcName(bassPc, Theory.accOf(root) < 0 || q === 'min') : '');
  }
  return { source, pcs, bassPc, rootPc, q, sym, inversion };
}
/* target: a symbol ('Am', 'C/E') or { root, q, bass } → comparable form */
function chordTarget(t) {
  const c = typeof t === 'string' ? Theory.parseChord(t) : t;
  return { root: c.root, q: c.q, rootPc: Theory.pc(c.root), pcs: Theory.chordPcs(c.root, c.q).sort((a, b) => a - b), bassPc: c.bass ? Theory.pc(c.bass) : null, sym: Theory.symbol(c.root, c.q, c.bass), notes: Theory.chordNotes(c.root, c.q) };
}
const sameSet = (a, b) => a.length === b.length && a.slice().sort((x, y) => x - y).every((v, i) => v === b.slice().sort((x, y) => x - y)[i]);
/* did this chord event play the target? Compares pitch-class sets, so C+ = E+ and Csus2 = Gsus4 count as the same chord */
function chordHit(ev, T) {
  let pcs = ev.pcs;
  if (ev.source === 'mic') { if (ev.q == null) return false; pcs = Theory.chordPcs(Theory.rootName(ev.rootPc, ev.q), ev.q); }
  return sameSet(pcs, T.pcs) && (T.bassPc == null || ev.bassPc === T.bassPc);
}
const chordWords = ev => ev.sym ? `${Theory.pretty(ev.sym)}${ev.q ? ' (' + Theory.CHORDS[ev.q].name + ')' : ''}` : ev.pcs.map(p => Theory.pcName(p)).join(' ');

/* live bars of the 12 pitch classes the mic hears; returns a cleanup */
function chromaMeter(el) {
  el.innerHTML = `<div class="chroma" aria-hidden="true">${Theory.SHARP_NAMES.map(n => `<div><i></i><span>${n}</span></div>`).join('')}</div>`;
  const bars = [...el.querySelectorAll('.chroma i')];
  return Bus.on('chroma', a => { bars.forEach((b, k) => { b.style.transform = `scaleY(${a ? Math.max(0.02, a.chroma[k]) : 0.02})`; }); });
}

/* ---------- reusable tasks ---------- */

/* A run of multiple-choice questions.
   p: { rounds, pass (0 = always completes), gen(i) → { q, html, options, answer, why, play, autoplay }, onAnswer(ok, item) } */
Tasks.quiz = (el, p, done) => {
  const rounds = p.rounds || 5, pass = p.pass || 0;
  let r = 0, score = 0, timer = 0, inner = null;
  el.innerHTML = `${p.prompt ? `<p class="lead">${p.prompt}</p>` : ''}<div class="progress-dots">${'<span></span>'.repeat(rounds)}</div><div class="quiz-q"></div><div class="row" data-retry hidden><button type="button" class="btn small" data-act="retry">Try again</button></div>`;
  const dots = el.querySelectorAll('.progress-dots span'), host = el.querySelector('.quiz-q'), retry = el.querySelector('[data-retry]');
  function next() {
    if (inner) inner();
    if (r >= rounds) {
      if (score >= pass) { host.insertAdjacentHTML('beforeend', `<p class="fb good">${score} of ${rounds}.${p.passMsg ? ' ' + p.passMsg : ''}</p>`); done(true, { score }); }
      else { host.insertAdjacentHTML('beforeend', `<p class="fb bad">${score} of ${rounds}. You need ${pass}.</p>`); retry.hidden = false; }
      return;
    }
    const item = p.gen(r);
    inner = Tasks.choice(host, item, ok => {
      dots[r].classList.add(ok ? 'on' : 'miss'); if (ok) score++;
      if (p.onAnswer) p.onAnswer(ok, item);
      r++; timer = setTimeout(next, ok ? 1100 : 2200);
    });
  }
  el.querySelector('[data-act="retry"]').onclick = () => { r = 0; score = 0; retry.hidden = true; dots.forEach(d => { d.className = ''; }); next(); };
  next();
  return () => { clearTimeout(timer); if (inner) inner(); };
};

/* Play notes in order (a scale, an arpeggio, a melody).
   p: { prompt, notes: ['C4', …], anyOctave (default true), show: 'names'|'hidden'|'degrees'|'solfege', steps (show W/H as you go),
        art (HTML above), hint(i, want) → text, endText, mark (glow the next key on the dock) }
   done(true, { misses }) */
Tasks.playSeq = (el, p, done) => {
  const notes = p.notes, any = p.anyOctave !== false, show = p.show || 'names';
  let i = 0, misses = 0, finished = false;
  const label = (n, k) => show === 'degrees' ? String(k % 7 + 1) : show === 'solfege' ? Theory.SOLFEGE[k % 7] : Theory.stripOct(n);
  const chip = (n, k) => `<span class="n${show === 'hidden' ? ' hid' : ''}" data-k="${k}">${show === 'hidden' ? '?' : label(n, k)}</span>`;
  const stepOf = k => k > 0 ? Theory.stepName(Theory.midi(notes[k]) - Theory.midi(notes[k - 1])) : '';
  el.innerHTML = `${p.prompt ? `<p class="prompt">${p.prompt}</p>` : ''}${p.art ? `<div class="art">${p.art}</div>` : ''}<div class="notes-strip seq">${notes.map((n, k) => (p.steps && k ? `<span class="stp" data-s="${k}"></span>` : '') + chip(n, k)).join('')}</div><p class="fb info" aria-live="polite">${p.start || ''}</p>`;
  const f = el.querySelector('.fb');
  const chips = [...el.querySelectorAll('.notes-strip .n')];
  const markNext = () => { if (!p.mark) return; Keyboard.clearMarks(); if (i < notes.length) Keyboard.markPcs([Theory.pc(notes[i])], 'target'); };
  const hit = m => any ? mod12(m) === Theory.pc(notes[i]) : m === Theory.midi(notes[i]);
  chips.forEach((c, k) => c.classList.toggle('cur', k === 0));
  markNext();
  const off = Bus.on('note', d => {
    if (finished) return;
    if (hit(d.midi)) {
      const c = chips[i]; c.classList.remove('hid', 'cur'); c.classList.add('ok'); c.textContent = label(notes[i], i);
      if (p.steps && i > 0) { const s = el.querySelector(`[data-s="${i}"]`); if (s) { s.textContent = stepOf(i); s.classList.add('on'); } }
      i++;
      if (chips[i]) chips[i].classList.add('cur');
      markNext();
      if (i >= notes.length) { finished = true; Keyboard.clearMarks(); fb(f, 'good', p.endText || 'All the way through.'); done(true, { misses }); }
      else fb(f, 'good', p.progress ? p.progress(i) : `${i} of ${notes.length}`);
    } else if (i > 0 && (any ? mod12(d.midi) === Theory.pc(notes[i - 1]) : d.midi === Theory.midi(notes[i - 1]))) {
      /* repeating the last right note is not a mistake */
    } else {
      misses++;
      fb(f, 'bad', `That is ${noteName(d.midi)}. ${p.hint ? p.hint(i, notes[i]) : (p.steps && i > 0 ? `Next is a ${Theory.stepName(Theory.midi(notes[i]) - Theory.midi(notes[i - 1])) === 'H' ? 'half' : 'whole'} step up from ${Theory.stripOct(notes[i - 1])}.` : 'Try again.')}`);
    }
  });
  return () => { off(); Keyboard.clearMarks(); };
};

/* Play named chords, one after another, on any instrument.
   p: { prompt, chords: ['C', 'Am', 'G7', 'C/E', …], labels (shown instead of the names, e.g. Roman numerals), tones (show the notes as a hint),
        limit (seconds per chord), pass (how many must land, default all), passMsg }
   done(true, { score, misses }) */
Tasks.playChords = (el, p, done) => {
  const targets = p.chords.map(chordTarget);
  const pass = p.pass == null ? targets.length : p.pass;
  let i = 0, score = 0, misses = 0, timer = 0, finished = false, wait = 0;
  el.innerHTML = `${p.prompt ? `<p class="prompt">${p.prompt}</p>` : ''}<div class="chord-target"><div class="big-name"></div><div class="tones"></div></div>${p.limit ? '<div class="timer"><i></i></div>' : ''}<div class="progress-dots">${'<span></span>'.repeat(targets.length)}</div><div class="heard-chord" aria-live="polite"></div><div class="meter-slot"></div><p class="fb info" aria-live="polite">${Mic.state === 'on' ? 'Play the chord and let it ring. The mic is listening.' : 'Tap the chord’s notes within a second or so, use a MIDI keyboard, or turn on the mic and play a real instrument.'}</p><div class="row" data-retry hidden><button type="button" class="btn small" data-act="retry">Try again</button></div>`;
  const big = el.querySelector('.big-name'), tones = el.querySelector('.tones'), heard = el.querySelector('.heard-chord'), f = el.querySelector('.fb');
  const dots = el.querySelectorAll('.progress-dots span'), bar = el.querySelector('.timer i'), retry = el.querySelector('[data-retry]');
  const offMeter = Mic.state === 'on' ? chromaMeter(el.querySelector('.meter-slot')) : () => {};
  ChordIn.start();
  function show() {
    const T = targets[i];
    big.textContent = p.labels ? p.labels[i] : Theory.pretty(T.sym);
    tones.textContent = p.tones ? T.notes.join(' · ') : '';
    ChordIn.clear();
    if (p.limit) {
      bar.style.transition = 'none'; bar.style.transform = 'scaleX(1)';
      requestAnimationFrame(() => { bar.style.transition = `transform ${p.limit}s linear`; bar.style.transform = 'scaleX(0)'; });
      clearTimeout(timer); timer = setTimeout(() => result(false), p.limit * 1000);
    }
  }
  function result(ok, ev) {
    clearTimeout(timer);
    const T = targets[i];
    dots[i].classList.add(ok ? 'on' : 'miss'); if (ok) score++;
    if (ok) { fb(f, 'good', `${Theory.pretty(T.sym)}: ${T.notes.join(' ')}.${ev && ev.source === 'mic' ? ' Heard it.' : ''}`); Keyboard.markPcs(T.pcs, 'found'); }
    else fb(f, 'bad', `Time. ${Theory.pretty(T.sym)} is ${T.notes.join(' ')}.`);
    i++;
    if (i >= targets.length) {
      finished = true;
      if (score >= pass) { if (targets.length > 1) fb(f, 'good', `${score} of ${targets.length}. ${p.passMsg || 'Done.'}`); done(true, { score, misses }); }
      else { fb(f, 'bad', `${score} of ${targets.length}. You need ${pass}.`); retry.hidden = false; }
      wait = setTimeout(() => Keyboard.clearMarks(), 1200);
    } else wait = setTimeout(() => { Keyboard.clearMarks(); show(); }, 900);
  }
  el.querySelector('[data-act="retry"]').onclick = () => { i = 0; score = 0; misses = 0; finished = false; retry.hidden = true; dots.forEach(d => { d.className = ''; }); show(); };
  const off = Bus.on('chord', ev => {
    if (finished || i >= targets.length) return;
    heard.textContent = (ev.source === 'mic' ? 'Mic hears: ' : 'You played: ') + chordWords(ev);
    if (chordHit(ev, targets[i])) { ChordIn.clear(); result(true, ev); }
    else if (ev.q) { misses++; fb(f, 'bad', `That is ${Theory.pretty(ev.sym)}, not ${Theory.pretty(targets[i].sym)}.${targets[i].bassPc != null && sameSet(ev.pcs, targets[i].pcs) ? ' Right notes; put ' + Theory.pcName(targets[i].bassPc) + ' at the bottom.' : ''}`); }
  });
  show();
  return () => { off(); offMeter(); ChordIn.stop(); clearTimeout(timer); clearTimeout(wait); Keyboard.clearMarks(); };
};

/* ---------- review card types shared by Levels 2–5 ---------- */
/* { type: 'gen', gen() → quiz item }: one generated multiple-choice question */
CARD_TYPES.gen = (el, c, fin) => Tasks.choice(el, c.gen(), fin);
/* { type: 'seq', prompt, notes, show }: play a short sequence; one slip is allowed */
CARD_TYPES.seq = (el, c, fin) => Tasks.playSeq(el, Object.assign({}, c, { notes: typeof c.notes === 'function' ? c.notes() : c.notes }), (ok, r) => fin(r.misses <= 1));
/* { type: 'chord', prompt, chord }: play one named chord; one wrong chord is allowed */
CARD_TYPES.chord = (el, c, fin) => Tasks.playChords(el, { prompt: c.prompt || 'Play this chord.', chords: [typeof c.chord === 'function' ? c.chord() : c.chord], tones: c.tones }, (ok, r) => fin(r.misses <= 1));
