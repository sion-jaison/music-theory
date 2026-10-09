/* =================================================================
   Song craft for the intermediate levels
   Listening Maps (real songs by title only, with what to listen for),
   the chord sheet (a chord per bar or half bar, in Roman numerals, with
   key changes and the melody's fit), and Tasks.songDraft: chords and a
   melody together, for workshops and projects from Level 7 on.
   ================================================================= */

/* ---------- Listening Maps ----------
   A real song, named by title and artist only: the learner plays it on their own service and answers what to
   listen for. Motif never plays, copies or quotes the recording, melody or lyrics; `model` may play Motif's own
   generic example of the device (a i–IV vamp, a ♭VI–♭VII–I), never the song.
   addListeningMap({ id, level, unit, topic, song, artist, intro, listenFor: [{ q, options, answer, why }], model, modelLabel }) */
const LISTENING_MAPS = [];
function addListeningMap(m) { if (!LISTENING_MAPS.some(x => x.id === m.id)) LISTENING_MAPS.push(m); return m; }
const listeningLog = () => Store.data.listening || (Store.data.listening = {});
/* maps whose unit is done (or whose level is open, for maps without a unit), least recently heard first */
function listeningOpen() {
  const log = listeningLog();
  return LISTENING_MAPS.filter(m => (m.unit && Store.data.units[m.unit] && Store.data.units[m.unit].done) || (!m.unit && levelUnlocked(m.level)))
    .sort((a, b) => ((log[a.id] || {}).at || '') < ((log[b.id] || {}).at || '') ? -1 : 1);
}
/* this week's map: the one picked this week, or the least recently heard open map */
function listeningThisWeek() {
  const wk = weekKey(), st = Store.data.weekly || (Store.data.weekly = {});
  if (st.mapWeek === wk && LISTENING_MAPS.some(m => m.id === st.map)) return LISTENING_MAPS.find(m => m.id === st.map);
  const open = listeningOpen();
  if (!open.length) return null;
  st.mapWeek = wk; st.map = open[0].id; Store.save();
  return open[0];
}
/* Monday of this week, as a day string */
function weekKey(d) { d = d || new Date(); const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return todayStr(x); }

/* p: { id } (a map) or { ids: [...] } (the least recently heard of these); done(true, { right, of }) after every question */
Tasks.listeningMap = (el, p, done) => {
  const pool = p.id ? LISTENING_MAPS.filter(m => m.id === p.id) : p.ids ? LISTENING_MAPS.filter(m => p.ids.indexOf(m.id) >= 0) : listeningOpen();
  const log = listeningLog();
  const m = pool.slice().sort((a, b) => ((log[a.id] || {}).at || '') < ((log[b.id] || {}).at || '') ? -1 : 1)[0];
  if (!m) { el.innerHTML = '<p class="fb info">No Listening Map is open yet. Finish a unit first.</p>'; done(true, { right: 0, of: 0 }); return () => {}; }
  let right = 0, answered = 0;
  el.innerHTML = `<div class="lm">${p.prompt ? `<p class="prompt">${p.prompt}</p>` : ''}<div class="lm-head"><span class="eyebrow">Listening Map · ${esc(m.topic)}</span><h3 class="lm-song">${esc(m.song)} <span class="muted">· ${esc(m.artist)}</span></h3></div>
    <p class="lm-intro">${m.intro || ''}</p><p class="muted small">Play it on your own music service. Motif never plays or copies recordings; it only tells you what to listen for.</p>
    ${m.model ? `<div class="row"><button type="button" class="btn small" data-act="model">▶ ${esc(m.modelLabel || 'Hear the idea in Motif’s own example')}</button></div>` : ''}
    <ol class="lm-qs">${m.listenFor.map((x, i) => `<li class="lm-q" data-q="${i}"><p>${x.q}</p><div class="choices">${x.options.map((o, k) => `<button type="button" class="choice" data-k="${k}">${o}</button>`).join('')}</div><p class="fb info" aria-live="polite"></p></li>`).join('')}</ol>
    <p class="fb info lm-sum" aria-live="polite">Listen once all the way through, then answer. Listen again as often as you like.</p></div>`;
  const mb = el.querySelector('[data-act="model"]');
  if (mb) mb.onclick = () => m.model();
  el.querySelector('.lm-qs').onclick = ev => {
    const b = ev.target.closest('.choice'), li = ev.target.closest('.lm-q');
    if (!b || !li || li.dataset.done) return;
    const x = m.listenFor[+li.dataset.q], ok = +b.dataset.k === x.answer;
    li.dataset.done = '1'; answered++; if (ok) right++;
    b.classList.add(ok ? 'right' : 'wrong'); li.querySelector(`[data-k="${x.answer}"]`).classList.add('right');
    fb(li.querySelector('.fb'), ok ? 'good' : 'bad', x.why || (ok ? 'Yes.' : 'Listen for it again.'));
    if (answered === m.listenFor.length) {
      log[m.id] = { at: todayStr(), right, of: answered }; Store.save();
      fb(el.querySelector('.lm-sum'), 'good', `${right} of ${answered} heard. ${right === answered ? 'Sharp ears.' : 'Go back to the moments you missed and listen once more.'}`);
      done(true, { right, of: answered, id: m.id });
    }
  };
  return () => {};
};

/* ---------- the chord sheet ----------
   ChordSheet.mount(el, o) → { chords, sketchChords(bpm), keys, fit(), set(list), select(bar, half), destroy() }
   o: { key, mode, meter ('4/4'), bars, palette: Roman numerals (in the bar's key), keyChanges (false: offer
        'New key from here'), keyOptions ([{ key, mode }]: the keys offered; default: closely related keys plus a step up),
        initial: [{ bar, half (0|1), roman | sym, key?, mode? }] and initialKeys: [{ bar, key, mode }], split (true),
        melody: notes [{ m, t, d }] in quarter-note beats to show bar by bar with their fit, locked (bars that cannot change),
        playChords (true: tap a chord to hear it), onChange(sheet) }
   Each slot holds { sym, roman }. A bar has one slot, or two once split (the split falls on the bar's middle beat
   group: 2+2 in 4/4, 2+1 in 3/4, 3+3 eighths in 6/8). Playing a chord on the keys while a slot is selected puts it in,
   named against the bar's key (so applied and borrowed chords can be played in, not just picked). */
const CS_FIT = { ct: 'chord tone', nct: 'in the key', out: 'outside the key' };
/* signed key signature for a major or minor key or a mode: D Dorian → 0, A Mixolydian → 2 sharps */
const CS_MODE_SHIFT = { lydian: 1, ionian: 0, major: 0, mixolydian: -1, dorian: -2, aeolian: -3, minor: -3, phrygian: -4, locrian: -5 };
function csSig(key, mode) { return Theory.keySig(key).n + (CS_MODE_SHIFT[mode || 'major'] || 0); }
function csKeyPcs(key, mode) { return Theory.scale(key, mode === 'minor' ? 'harmonic' : mode && Theory.SCALES[mode] ? mode : 'major').map(Theory.pc).concat(mode === 'minor' ? [Theory.pc(Theory.scale(key, 'minor')[6])] : []); }
function csChord(roman, key, mode) {
  try { const c = Theory.romanChord(roman, key, mode === 'minor' ? 'minor' : 'major'); return { sym: c.sym, roman }; } catch (e) { return null; }
}
function csRoman(sym, key, mode) { try { return Theory.romanOf(sym, key, mode === 'minor' ? 'minor' : 'major') || '?'; } catch (e) { return '?'; } }
function csVoice(sym, oct) {
  const c = Theory.parseChord(sym);
  let ms = Theory.voicing(c.root, c.q, oct == null ? 3 : oct);
  if (ms.length > 4) ms = [ms[0]].concat(ms.slice(-3));
  if (c.bass) { const b = Theory.pc(c.bass); let lo = ms[0] - 12; while (mod12(lo) !== b) lo++; ms = [lo].concat(ms); }
  return ms;
}
const ChordSheet = {
  mount(el, o) {
    o = Object.assign({ key: 'C', mode: 'major', meter: '4/4', bars: 4, palette: null, split: true, playChords: true }, o);
    const M = Score.meter(o.meter), barLen = M.barLen;
    /* the split point: the group boundary nearest the middle of the bar */
    const splitAt = (() => { let acc = 0, best = barLen / 2, gap = 99; (M.groups || [barLen]).forEach(g => { acc += g; if (acc < barLen && Math.abs(acc - barLen / 2) < gap) { gap = Math.abs(acc - barLen / 2); best = acc; } }); return best; })();
    const bars = Array.from({ length: o.bars }, () => [null]);
    const keyAt = Array.from({ length: o.bars }, () => null);
    keyAt[0] = { key: o.key, mode: o.mode };
    (o.initialKeys || []).forEach(k => { if (k.bar < o.bars) keyAt[k.bar] = { key: k.key, mode: k.mode || 'major' }; });
    const barKey = b => { for (let i = b; i >= 0; i--) if (keyAt[i]) return keyAt[i]; return keyAt[0]; };
    (o.initial || []).forEach(x => {
      if (x.bar >= o.bars) return;
      const k = x.key ? { key: x.key, mode: x.mode || 'major' } : barKey(x.bar);
      const c = x.roman ? csChord(x.roman, k.key, k.mode) : { sym: x.sym, roman: csRoman(x.sym, k.key, k.mode) };
      if (!c) return;
      if (x.half === 1) { if (bars[x.bar].length < 2) bars[x.bar].push(null); bars[x.bar][1] = c; } else bars[x.bar][0] = c;
    });
    const locked = new Set(o.locked || []);
    let sel = { b: 0, h: 0 };
    el.innerHTML = `<div class="cs"><div class="cs-bar-row"></div><div class="cs-tools"><div class="cs-pal choices"></div>
      <div class="row cs-acts">${o.split ? '<button type="button" class="btn small" data-cs="split">Split the bar</button>' : ''}<button type="button" class="btn small ghost" data-cs="clear">Clear this bar</button>${o.keyChanges ? '<label class="sel cs-keysel"><span>Key from this bar</span><select data-cs="key"></select></label>' : ''}</div>
      <p class="muted small cs-hint">Pick a bar, then a chord. Or play any chord on the keys to put it in.</p></div></div>`;
    const row = el.querySelector('.cs-bar-row'), pal = el.querySelector('.cs-pal'), keySel = el.querySelector('[data-cs="key"]');
    const keyLabel = k => `${k.key} ${k.mode === 'minor' ? 'minor' : k.mode && k.mode !== 'major' ? k.mode : 'major'}`;
    const keyOpts = () => {
      if (o.keyOptions) return o.keyOptions;
      const home = keyAt[0], rel = Theory.relatedKeys(home.key, home.mode === 'minor' ? 'minor' : 'major').map(k => ({ key: k.tonic, mode: k.mode }));
      const lift = { key: Theory.pcName(Theory.pc(home.key) + 1, true), mode: home.mode }, lift2 = { key: Theory.up(home.key, '2'), mode: home.mode };
      return [home].concat(rel, [lift, lift2]);
    };
    function timeline() {
      const out = [];
      bars.forEach((slots, b) => slots.forEach((s, h) => {
        if (!s) return;
        const t = b * barLen + (h ? splitAt : 0), d = slots.length > 1 ? (h ? barLen - splitAt : splitAt) : barLen, k = barKey(b);
        out.push({ bar: b, half: h, t, d, sym: s.sym, roman: s.roman, key: k.key, mode: k.mode });
      }));
      return out;
    }
    /* strong beats: accented beat groups (beat 1; beat 4 of 5/4 as 3+2), plus the middle of a bar of equal even groups
       (beat 3 of 4/4, the second dotted quarter of 6/8) */
    const strongAt = (() => {
      const g = M.groups || [barLen], starts = g.map((x, i) => g.slice(0, i).reduce((a, b) => a + b, 0));
      const out = (M.accents || [0]).map(i => starts[i]);
      if (g.length % 2 === 0 && g.every(x => x === g[0])) out.push(barLen / 2);
      return out;
    })();
    /* each melody note against the chord sounding when it starts: ct, nct (in the key) or out; strong = on a strong beat */
    function fit() {
      const tl = timeline(), starts = strongAt;
      return (o.melody || []).map(n => {
        const c = tl.find(x => n.t >= x.t - 1e-6 && n.t < x.t + x.d - 1e-6), b = Math.floor(n.t / barLen + 1e-6), k = barKey(Math.min(b, o.bars - 1));
        const pos = n.t - b * barLen, strong = starts.some(s => Math.abs(s - pos) < 1e-3);
        let kind = 'out';
        if (c) { const pcs = Theory.parseChord(c.sym); const set = Theory.chordPcs(pcs.root, pcs.q); kind = set.indexOf(mod12(n.m)) >= 0 ? 'ct' : csKeyPcs(k.key, k.mode).indexOf(mod12(n.m)) >= 0 ? 'nct' : 'out'; }
        else kind = csKeyPcs(k.key, k.mode).indexOf(mod12(n.m)) >= 0 ? 'nct' : 'out';
        return { n, bar: b, strong, kind, chord: c ? c.sym : null };
      });
    }
    function paint() {
      const f = fit();
      row.innerHTML = bars.map((slots, b) => {
        const k = keyAt[b] && b > 0 ? `<span class="cs-key">→ ${keyLabel(keyAt[b])}</span>` : '';
        const mel = f.filter(x => x.bar === b).map(x => `<span class="n ${x.kind}${x.strong ? ' strong' : ''}" title="${CS_FIT[x.kind]}${x.strong ? ', on a strong beat' : ''}">${Theory.pretty(Theory.pcName(x.n.m, csSig(barKey(b).key, barKey(b).mode) < 0))}</span>`).join('');
        return `<div class="cs-bar${locked.has(b) ? ' locked' : ''}" data-b="${b}"><div class="cs-bar-n"><small>${b + 1}</small>${k}</div><div class="cs-slots">${slots.map((s, h) => `<button type="button" class="cs-slot${sel.b === b && sel.h === h ? ' sel' : ''}${s ? '' : ' empty'}" data-b="${b}" data-h="${h}" aria-label="Bar ${b + 1}${slots.length > 1 ? (h ? ', second half' : ', first half') : ''}: ${s ? s.roman + ', ' + s.sym : 'empty'}"><b>${s ? esc(s.roman) : '?'}</b><span>${s ? Theory.pretty(s.sym) : '–'}</span></button>`).join('')}</div>${o.melody ? `<div class="cs-mel">${mel}</div>` : ''}</div>`;
      }).join('');
      const k = barKey(sel.b);
      pal.innerHTML = (o.palette || Theory.diatonic(k.key, k.mode === 'minor' ? 'minor' : 'major').map(d => d.roman)).map(r => {
        const c = csChord(r, k.key, k.mode);
        return c ? `<button type="button" class="choice" data-r="${esc(r)}">${esc(r)} <small>${Theory.pretty(c.sym)}</small></button>` : '';
      }).join('');
      if (keySel) {
        const opts = keyOpts(), cur = keyAt[sel.b] || null;
        keySel.innerHTML = `<option value="">${sel.b === 0 ? keyLabel(keyAt[0]) : 'Same key'}</option>` + opts.map((x, i) => `<option value="${i}"${cur && sel.b > 0 && cur.key === x.key && cur.mode === x.mode ? ' selected' : ''}>${keyLabel(x)}</option>`).join('');
        keySel.disabled = sel.b === 0;
      }
      const sp = el.querySelector('[data-cs="split"]');
      if (sp) sp.textContent = bars[sel.b].length > 1 ? 'Join the bar' : 'Split the bar';
    }
    const changed = () => { paint(); if (o.onChange) o.onChange(api); };
    const hear = sym => { if (o.playChords) try { Sound.chord(csVoice(sym, 3), null, 0.9, 0.5); } catch (e) { /* unknown symbol */ } };
    function put(c) {
      if (!c || locked.has(sel.b)) return;
      bars[sel.b][sel.h] = c;
      hear(c.sym);
      /* move on to the next empty slot */
      const flat = [];
      bars.forEach((s, b) => s.forEach((x, h) => flat.push({ b, h, x })));
      const i = flat.findIndex(x => x.b === sel.b && x.h === sel.h), nx = flat.slice(i + 1).find(x => !x.x && !locked.has(x.b));
      if (nx) sel = { b: nx.b, h: nx.h };
      changed();
    }
    row.onclick = ev => {
      const s = ev.target.closest('.cs-slot'); if (!s) return;
      sel = { b: +s.dataset.b, h: +s.dataset.h };
      const c = bars[sel.b][sel.h]; if (c) hear(c.sym);
      paint();
    };
    pal.onclick = ev => { const b = ev.target.closest('[data-r]'); if (!b) return; const k = barKey(sel.b); put(csChord(b.dataset.r, k.key, k.mode)); };
    el.querySelector('[data-cs="clear"]').onclick = () => { if (locked.has(sel.b)) return; bars[sel.b] = [null]; sel.h = 0; changed(); };
    const sp = el.querySelector('[data-cs="split"]');
    if (sp) sp.onclick = () => { if (locked.has(sel.b)) return; if (bars[sel.b].length > 1) { bars[sel.b] = [bars[sel.b][0]]; sel.h = 0; } else bars[sel.b].push(null); changed(); };
    if (keySel) keySel.onchange = () => {
      if (sel.b === 0) return;
      const i = keySel.value; keyAt[sel.b] = i === '' ? null : keyOpts()[+i];
      /* chords after a key change keep their sound; their numerals are renamed in the new key */
      bars.forEach((slots, b) => slots.forEach((s, h) => { if (s) { const k = barKey(b); slots[h] = { sym: s.sym, roman: csRoman(s.sym, k.key, k.mode) }; } }));
      changed();
    };
    /* a chord played on the keys (or into the mic) fills the selected slot; o.accept() can say no (while a melody is
       being played in next to the sheet). The window is cleared after each chord so its notes do not fill the next slot. */
    ChordIn.start();
    let lastPut = 0;
    const off = Bus.on('chord', ev => {
      if (!ev.sym || (o.accept && !o.accept()) || performance.now() - lastPut < 400) return;
      lastPut = performance.now(); ChordIn.clear();
      const k = barKey(sel.b);
      put({ sym: ev.sym, roman: csRoman(ev.sym, k.key, k.mode) });
    });
    paint();
    const api = {
      get chords() { return timeline(); },
      /* [{ sym, t, d }] in seconds, for sketches and playSketch */
      sketchChords(bpm) { const spb = 60 / (bpm || 90); return timeline().map(c => ({ sym: c.sym, t: +(c.t * spb).toFixed(3), d: +(c.d * spb).toFixed(3), roman: c.roman })); },
      /* the key stretches: [{ bar, key, mode }] */
      get keys() { return keyAt.map((k, b) => k ? { bar: b, key: k.key, mode: k.mode } : null).filter(Boolean); },
      get full() { return bars.every(s => s.every(Boolean)); },
      fit,
      set(list, keys) { bars.forEach((s, b) => { bars[b] = [null]; }); if (keys) { keyAt.fill(null); keyAt[0] = { key: o.key, mode: o.mode }; keys.forEach(k => { keyAt[k.bar] = { key: k.key, mode: k.mode }; }); } list.forEach(x => { if (x.bar >= o.bars) return; const k = barKey(x.bar); const c = x.roman && !x.sym ? csChord(x.roman, k.key, k.mode) : { sym: x.sym, roman: csRoman(x.sym, k.key, k.mode) }; if (x.half === 1) { if (bars[x.bar].length < 2) bars[x.bar].push(null); bars[x.bar][1] = c; } else bars[x.bar][0] = c; }); changed(); },
      select(b, h) { sel = { b, h: h || 0 }; paint(); },
      setMelody(notes) { o.melody = notes; paint(); },
      destroy() { off(); ChordIn.stop(); }
    };
    return api;
  }
};
/* play a chord timeline ([{ sym, t, d }] in beats) with an optional melody ([{ m, t, d }] in beats) at bpm; → ms */
function csPlay(chords, melody, bpm, lead) {
  const spb = 60 / (bpm || 90), notes = [];
  chords.forEach(c => { try { csVoice(c.sym, 3).forEach((m, i) => notes.push({ m, t: c.t * spb + i * 0.012, d: Math.max(0.2, c.d * spb * 0.95), v: 0.38 })); } catch (e) { /* skip */ } });
  (melody || []).forEach(n => notes.push({ m: n.m, t: n.t * spb, d: Math.max(0.1, (n.d || 0.5) * spb * 0.92), v: 0.8 }));
  return Sound.seq(notes, lead);
}
/* questions a project or workshop can ask of a chord timeline */
const SheetHas = {
  sevenths: cs => cs.filter(c => /7|9|11|13/.test(c.sym)).length,
  extended: cs => cs.filter(c => { const q = Theory.parseChord(c.sym).q; return Theory.EXT_QS.indexOf(q) >= Theory.CORE_QS.length; }).length,
  applied: cs => cs.filter(c => /\/[♭♯]?[ivIV]/.test(c.roman || '')).length,
  borrowed: cs => cs.filter(c => { const r = (c.roman || '').replace(/(64|65|43|42|6|7)$/, ''); return c.mode !== 'minor' && !/\//.test(r) && (/^♭/.test(r) || ['iv', 'v', 'ii°', 'iiø'].indexOf(r) >= 0); }).length,
  modulates: (cs, keys) => (keys || []).filter(k => k.bar > 0).length,
  endsOn: (cs, roman) => { const l = cs[cs.length - 1]; return !!l && l.roman === roman; }
};

/* ---------- Tasks.songDraft: chords and a melody together ----------
   p: { prompt, key, mode, meter, bpm, swing, bars, palette, keyChanges, keyOptions, initial (chords), initialKeys,
        melody: 'capture' (default) | 'none' | 'given' (with p.given: score events or a pattern; chords go under it),
        min (melody notes, default 8), check(ctx) → null | 'message' with ctx { chords, keys, events, notes, fit, key, mode },
        checkOk, name, project (unit id: drafts and version 2 are linked like projectDraft), version, useFlavour (meter,
        tempo and swing from the project's flavour), save: { level, tags, prompt } }
   done(true, { sketch }) */
Tasks.songDraft = (el, p, done) => {
  const pr = p.project ? projectOf(p.project) : null, fl = pr && p.useFlavour ? PROJECT_FLAVOURS[pr.flavour || 'song'] : null;
  const draft = pr && p.version === 2 ? sketchById(pr.draft) : null;
  if (pr && p.version === 2 && !draft) { el.innerHTML = '<p class="fb bad">Save a draft first: the step before this one.</p>'; return () => {}; }
  const meter = (draft && draft.score && draft.score.meter) || (fl && fl.meter) || p.meter || '4/4', M = Score.meter(meter);
  let bpm = (draft && draft.bpm) || (fl && fl.bpm) || p.bpm || 90;
  const swing = (fl && fl.swing) || p.swing || 0.5, bars = p.bars || 8, mode = (draft && draft.mode) || p.mode || 'major';
  const seed = pr && !draft && pr.seed ? sketchById(pr.seed) : null;
  const key = (draft && draft.key) || p.key || (seed && sketchKey(seed)) || 'C';
  const melodyMode = p.melody || 'capture', min = p.min == null ? 8 : p.min, id = 'sd-name-' + Math.random().toString(36).slice(2, 7);
  let saved = false, cap = null, timers = [], band = null, bandUsed = false;
  el.innerHTML = `<div class="sd">${p.prompt ? `<p class="prompt">${p.prompt}${draft && draft.review && draft.review.note ? ` Your note to yourself: “${esc(draft.review.note)}”` : ''}</p>` : ''}
    <div class="eyebrow">Chords · ${esc(key)} ${mode === 'minor' ? 'minor' : mode === 'major' ? 'major' : esc(mode)} · ${M.label}</div><div class="sd-sheet"></div>
    ${melodyMode === 'none' ? '' : `<div class="eyebrow" style="margin-top:10px">${melodyMode === 'given' ? 'The melody' : 'Melody'}</div>`}<div class="sd-mel"></div>
    <div class="row sd-play"><button type="button" class="btn" data-act="hear">▶ Play it all</button>${melodyMode === 'capture' ? '<label class="toggle"><input type="checkbox" data-sd="backing" checked> Chords while I record</label>' : ''}</div>
    ${typeof Backing !== 'undefined' ? '<details class="sd-band"><summary>Play it with a band</summary><div class="sd-band-ui"></div></details>' : ''}
    <ul class="nt-checks sd-checks"></ul>
    <div class="field"><label for="${id}">Name it</label><input id="${id}" type="text" maxlength="40" value="${esc(draft ? draft.name.replace(/( v2)?$/, ' v2') : p.name || '')}" placeholder="Give it a name"></div>
    <div class="row"><button type="button" class="btn primary" data-act="save" disabled>Save to sketchbook</button></div><p class="fb info sd-saved" aria-live="polite"></p></div>`;
  const checks = el.querySelector('.sd-checks'), bSave = el.querySelector('[data-act="save"]'), nameIn = el.querySelector('#' + id), f = el.querySelector('.sd-saved');
  const melBeats = () => {
    if (melodyMode === 'none') return [];
    if (melodyMode === 'given') return Score.toNotes(p.given, { bpm: 60, meter }).map(n => ({ m: n.m, t: n.t, d: n.d }));
    return cap ? Score.toNotes(cap.events, { bpm: 60, meter }).map(n => ({ m: n.m, t: n.t, d: n.d })) : [];
  };
  const initial = draft && draft.sheet ? draft.sheet : p.initial;
  const initialKeys = draft && draft.sheetKeys ? draft.sheetKeys : p.initialKeys;
  const sheet = ChordSheet.mount(el.querySelector('.sd-sheet'), {
    key, mode, meter, bars, palette: p.palette, keyChanges: p.keyChanges, keyOptions: p.keyOptions, initial, initialKeys, locked: p.locked,
    melody: melodyMode === 'none' ? null : melBeats(), onChange: () => refresh(),
    accept: () => zone === 'sheet' && !(cap && cap.recording)
  });
  /* the keys go to whichever half was touched last: the chord sheet or the melody */
  let zone = 'sheet';
  el.querySelector('.sd-sheet').addEventListener('pointerdown', () => { zone = 'sheet'; });
  el.querySelector('.sd-sheet').addEventListener('click', () => { zone = 'sheet'; });
  el.querySelector('.sd-mel').addEventListener('pointerdown', () => { zone = 'mel'; });
  el.querySelector('.sd-mel').addEventListener('click', () => { zone = 'mel'; });
  function ctx() {
    const events = cap ? cap.events : melodyMode === 'given' ? Score.parse(p.given) : [];
    return { chords: sheet.chords, keys: sheet.keys, events, notes: melBeats(), fit: sheet.fit(), key, mode };
  }
  function refresh() {
    if (melodyMode !== 'none') sheet.setMelody(melBeats());
    bandSync();
    const c = ctx(), n = c.notes.length, msg = p.check ? p.check(c) : null;
    const items = [`<li class="${sheet.full ? 'ok' : ''}">${sheet.full ? '✓' : '○'} A chord in every bar</li>`];
    if (melodyMode === 'capture') items.push(`<li class="${n >= min ? 'ok' : ''}">${n >= min ? '✓' : '○'} At least ${min} melody notes (${n} so far)</li>`);
    if (p.check) items.push(`<li class="${msg ? '' : 'ok'}">${msg ? '○ ' + esc(msg) : '✓ ' + esc(p.checkOk || 'Fits the brief')}</li>`);
    checks.innerHTML = items.join('');
    bSave.disabled = saved || !sheet.full || (melodyMode === 'capture' && n < min) || !!msg;
  }
  if (melodyMode === 'capture') {
    const initEvents = draft && draft.score ? draft.score.events : seed && seed.score && seed.score.meter === meter ? seed.score.events : p.initialMelody || null;
    cap = MelodyCapture.mount(el.querySelector('.sd-mel'), { meter, bpm, bars, keySig: csSig(key, mode), initial: initEvents, swing, onChange: () => { saved = false; f.textContent = ''; refresh(); } });
    /* the chords play along while recording (not with the mic on: it would hear them) */
    el.querySelector('.sd-mel').addEventListener('click', ev => {
      const b = ev.target.closest('[data-c="rec"]');
      if (!b || b.disabled || Mic.state === 'on' || !el.querySelector('[data-sd="backing"]').checked || !Sound.ensure()) return;
      const spb = 60 / cap.bpm, start = Sound.now() + 0.15 + M.barLen * spb;
      sheet.chords.forEach(c => { try { Sound.chord(csVoice(c.sym, 3), start + c.t * spb, c.d * spb * 0.95, 0.32); } catch (e) { /* skip */ } });
    }, true);
  } else if (melodyMode === 'given') {
    el.querySelector('.sd-mel').innerHTML = `<div class="nt-box">${Score.svg(p.given, { meter, keySig: csSig(key, mode) })}</div>`;
  }
  /* the band: a backing style for the chords (and the melody on top); the style chosen is saved with the sketch */
  const FLAVOUR_STYLE = { song: 'pop', jazz: 'swing', classical: 'ballad', film: 'ambient' };
  const bandEl = el.querySelector('.sd-band');
  if (bandEl) bandEl.addEventListener('toggle', () => {
    if (!bandEl.open || band) return;
    const pref = (draft && draft.backing && draft.backing.style) || p.style || FLAVOUR_STYLE[(pr && pr.flavour) || ''] || 'pop';
    band = Backing.ui(bandEl.querySelector('.sd-band-ui'), { style: Backing.styleFor ? Backing.styleFor(meter, pref) : pref, chords: sheet.chords, melody: melBeats(), bpm: cap ? cap.bpm : bpm, meter, key, mode: mode === 'minor' ? 'minor' : 'major', note: 'Mute a part to hear what it adds. The style you leave set is saved with the sketch.' });
    bandUsed = true;
  });
  function bandSync() { if (band && band.setChords && sheet.full) { try { band.setChords(sheet.chords); } catch (e) { /* keep playing the old chords */ } } }
  el.querySelector('[data-act="hear"]').onclick = () => {
    const t = cap ? cap.bpm : bpm;
    csPlay(sheet.chords, melBeats(), t);
  };
  bSave.onclick = () => {
    const c = ctx(), b = cap ? cap.bpm : bpm, spb = 60 / b, sv = p.save || {};
    const notes = c.notes.map(n => ({ m: n.m, t: +(n.t * spb).toFixed(3), d: +(n.d * spb).toFixed(3) }));
    const sketch = saveSketch(Object.assign({
      name: nameIn.value.trim() || p.name || 'Song sketch ' + (Store.data.sketches.length + 1), notes, chords: sheet.sketchChords(b),
      sheet: sheet.chords.map(x => ({ bar: x.bar, half: x.half, sym: x.sym, roman: x.roman })), sheetKeys: sheet.keys,
      bpm: b, key, mode, level: sv.level || p.level, tags: (sv.tags || p.tags || []).concat(fl ? [fl.name.toLowerCase()] : []), prompt: sv.prompt || p.prompt || '',
      from: draft ? draft.id : (pr && pr.seed) || undefined
    }, cap || melodyMode === 'given' ? { score: Object.assign({ meter, bpm: b, keySig: csSig(key, mode), events: cap ? cap.events : Score.parse(p.given) }, swing > 0.52 ? { swing } : {}) } : {},
    pr ? { project: p.project, version: p.version || 1 } : {}, band && bandUsed ? { backing: { style: band.style } } : {}));
    if (pr) { pr[p.version === 2 ? 'v2' : 'draft'] = sketch.id; Store.save(); }
    saved = true; bSave.disabled = true;
    fb(f, 'good', `Saved “${sketch.name}” to your sketchbook.`);
    done(true, { sketch });
  };
  refresh();
  return () => { timers.forEach(clearTimeout); if (band) band.destroy(); sheet.destroy(); if (cap) cap.destroy(); };
};
