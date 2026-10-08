/* =================================================================
   Tasks: each takes (element, params, done) and returns a cleanup
   ================================================================= */
const Tasks = {};

Tasks.climb = (el, p, done) => {
  el.innerHTML = `<p class="prompt">${p.prompt}</p><div class="lane-wrap"><canvas class="lane" aria-label="Pitch picture"></canvas></div><div class="progress-dots">${'<span></span>'.repeat(3)}</div><p class="fb info" aria-live="polite">${Mic.state === 'on' ? 'Sing or play. The dot follows you.' : 'Tap keys or turn on the mic.'}</p>`;
  const lane = PitchLane(el.querySelector('canvas'));
  const dots = el.querySelectorAll('.progress-dots span'), f = el.querySelector('.fb');
  let seq = [], finished = false;
  const off = Bus.on('note', d => {
    if (finished) return;
    const last = seq[seq.length - 1];
    if (last === d.midi) return;
    if (last === undefined || (p.dir > 0 ? d.midi > last : d.midi < last)) seq.push(d.midi); else seq = [d.midi];
    dots.forEach((s, i) => s.classList.toggle('on', i < seq.length));
    if (seq.length >= 3) {
      finished = true;
      fb(f, 'good', seq.map(noteName).join(' → ') + (p.dir > 0 ? ': each one higher.' : ': each one lower.'));
      done(true);
    } else fb(f, 'info', seq.length === 1 ? 'Now go ' + (p.dir > 0 ? 'higher.' : 'lower.') : 'One more, ' + (p.dir > 0 ? 'higher still.' : 'lower still.'));
  });
  return () => { off(); lane.stop(); };
};

Tasks.octave = (el, p, done) => {
  const rounds = p.rounds || 3; let r = 0, target = 0;
  el.innerHTML = `<p class="prompt">Listen, then find the same note in a different octave: higher or lower.</p><div class="row">${playBtn('Hear it again')}<div class="progress-dots">${'<span></span>'.repeat(rounds)}</div></div><p class="fb info" aria-live="polite"></p>`;
  const f = el.querySelector('.fb'), dots = el.querySelectorAll('.progress-dots span');
  const play = () => Sound.tone(target, Sound.now() + 0.05, 0.9);
  const next = () => { target = randInt(53, 67); play(); fb(f, 'info', 'Listening for its octave…'); };
  el.querySelector('[data-act="play"]').onclick = play;
  const off = Bus.on('note', d => {
    if (r >= rounds) return;
    if (d.midi === target) { fb(f, 'info', 'That is the exact same note. Now find it higher or lower.'); return; }
    if (mod12(d.midi) === mod12(target)) {
      dots[r].classList.add('on'); r++;
      fb(f, 'good', `${noteName(target)} and ${noteName(d.midi)}: same letter, ${Math.abs(d.midi - target) / 12} octave${Math.abs(d.midi - target) > 12 ? 's' : ''} apart.`);
      if (r >= rounds) done(true); else setTimeout(next, 1200);
    } else fb(f, 'bad', `That is ${noteName(d.midi)}. An octave sounds like the same note, only higher or lower.`);
  });
  setTimeout(next, 300);
  return off;
};

Tasks.findAll = (el, p, done) => {
  const need = p.need || 3, found = new Set();
  el.innerHTML = `<p class="prompt">Play every ${SHARP[p.pc]} you can reach. You need ${need}.</p><div class="notes-strip"><span class="empty">None yet</span></div><p class="fb info" aria-live="polite">${p.tip || ''}</p>`;
  const strip = el.querySelector('.notes-strip'), f = el.querySelector('.fb');
  const off = Bus.on('note', d => {
    if (found.size >= need) return;
    if (mod12(d.midi) === p.pc) {
      if (found.has(d.midi)) { fb(f, 'info', `You already found ${noteName(d.midi)}. Try another octave.`); return; }
      found.add(d.midi); Keyboard.mark(d.midi, 'found');
      strip.innerHTML = [...found].sort((a, b) => a - b).map(m => `<span class="n">${noteName(m)}</span>`).join('');
      if (found.size >= need) { fb(f, 'good', `All ${need}. Same letter, different octaves.`); done(true); } else fb(f, 'good', `${noteName(d.midi)}. ${need - found.size} to go.`);
    } else fb(f, 'bad', `That is ${noteName(d.midi)}. ${p.tip || ''}`);
  });
  return () => { off(); Keyboard.clearMarks(); };
};

Tasks.nameBlack = (el, p, done) => {
  const order = shuffle(BLACK_PCS).slice(0, p.rounds || 4); let r = 0;
  el.innerHTML = `<p class="prompt">The glowing black key has two names. Pick both, then check.</p><div class="choices"></div><div class="row"><button type="button" class="btn primary small" data-act="check" disabled>Check</button><div class="progress-dots">${'<span></span>'.repeat(order.length)}</div></div><p class="fb info" aria-live="polite"></p>`;
  const box = el.querySelector('.choices'), chk = el.querySelector('[data-act="check"]'), f = el.querySelector('.fb'), dots = el.querySelectorAll('.progress-dots span');
  let pc = 0, picked = new Set();
  function show() {
    Keyboard.clearMarks(); pc = order[r]; picked = new Set();
    Keyboard.mark(60 + pc, 'target');
    const others = shuffle(BLACK_PCS.filter(x => x !== pc)).slice(0, 2);
    const opts = shuffle([pc, ...others].reduce((a, x) => a.concat([SHARP[x], FLAT[x]]), []));
    box.innerHTML = opts.map(o => `<button type="button" class="choice" aria-pressed="false" data-v="${o}">${o}</button>`).join('');
    chk.disabled = true; fb(f, 'info', 'Hint: count from the white key on each side.');
  }
  box.onclick = ev => {
    const b = ev.target.closest('.choice'); if (!b) return;
    const v = b.dataset.v;
    if (picked.has(v)) picked.delete(v); else if (picked.size < 2) picked.add(v);
    box.querySelectorAll('.choice').forEach(c => c.setAttribute('aria-pressed', picked.has(c.dataset.v)));
    chk.disabled = picked.size !== 2;
  };
  chk.onclick = () => {
    const ok = picked.has(SHARP[pc]) && picked.has(FLAT[pc]);
    box.querySelectorAll('.choice').forEach(c => { if (c.dataset.v === SHARP[pc] || c.dataset.v === FLAT[pc]) c.classList.add('right'); else if (picked.has(c.dataset.v)) c.classList.add('wrong'); });
    chk.disabled = true;
    dots[r].classList.add(ok ? 'on' : 'miss'); r++;
    if (ok) fb(f, 'good', `${SHARP[pc]} is one key above ${SHARP[pc - 1]}; ${FLAT[pc]} is one key below ${SHARP[(pc + 1) % 12]}.`);
    else fb(f, 'bad', `This key is ${SHARP[pc]} (one above ${SHARP[pc - 1]}) and ${FLAT[pc]} (one below ${SHARP[(pc + 1) % 12]}). It comes back in your review deck.`);
    if (r >= order.length) { setTimeout(() => Keyboard.clearMarks(), 1200); done(true); } else setTimeout(show, ok ? 1500 : 2600);
  };
  show();
  return () => Keyboard.clearMarks();
};

Tasks.playName = (el, p, done) => {
  const items = p.items.slice(); const limit = p.limit || 0; const pass = p.pass || items.length;
  let i = 0, score = 0, timer = 0, t0 = 0;
  el.innerHTML = `<p class="prompt">${p.prompt || 'Play this note, in any octave.'}</p><div class="big-name" aria-live="polite"></div>${limit ? '<div class="timer"><i></i></div>' : ''}<div class="progress-dots">${'<span></span>'.repeat(items.length)}</div><p class="fb info" aria-live="polite"></p><div class="row" hidden><button type="button" class="btn small" data-act="retry">Try again</button></div>`;
  const big = el.querySelector('.big-name'), f = el.querySelector('.fb'), dots = el.querySelectorAll('.progress-dots span'), bar = el.querySelector('.timer i'), retry = el.querySelector('.row');
  let finished = false;
  function show() {
    const it = items[i]; big.textContent = it.label; t0 = performance.now();
    if (limit) {
      bar.style.transition = 'none'; bar.style.transform = 'scaleX(1)';
      requestAnimationFrame(() => { bar.style.transition = `transform ${limit}s linear`; bar.style.transform = 'scaleX(0)'; });
      clearTimeout(timer); timer = setTimeout(() => result(false, 'Time. That was ' + it.label + '.'), limit * 1000);
    }
  }
  function result(ok, msg) {
    clearTimeout(timer);
    dots[i].classList.add(ok ? 'on' : 'miss'); if (ok) score++;
    fb(f, ok ? 'good' : 'bad', msg);
    i++;
    if (i >= items.length) {
      finished = true; big.textContent = score + ' / ' + items.length;
      if (score >= pass) { fb(f, 'good', `${score} of ${items.length}. ${p.passMsg || 'Done.'}`); done(true, { score }); }
      else { fb(f, 'bad', `${score} of ${items.length}. You need ${pass}.`); retry.hidden = false; }
    } else setTimeout(show, 650);
  }
  el.querySelector('[data-act="retry"]').onclick = () => { i = 0; score = 0; finished = false; retry.hidden = true; dots.forEach(d => d.className = ''); show(); };
  const off = Bus.on('note', d => {
    if (finished || i >= items.length) return;
    const it = items[i];
    if (mod12(d.midi) === it.pc) result(true, `${noteName(d.midi)} in ${((performance.now() - t0) / 1000).toFixed(1)} s.`);
    else if (!limit) fb(f, 'bad', `That is ${noteName(d.midi)}. Try again.`);
    else result(false, `That is ${noteName(d.midi)}; the target was ${it.label}.`);
  });
  show();
  return () => { off(); clearTimeout(timer); };
};

Tasks.step = (el, p, done) => {
  const rounds = p.rounds || 5; let r = 0, q = null;
  el.innerHTML = `<p class="prompt"></p><div class="progress-dots">${'<span></span>'.repeat(rounds)}</div><p class="fb info" aria-live="polite">The glowing key is where you start.</p>`;
  const pr = el.querySelector('.prompt'), f = el.querySelector('.fb'), dots = el.querySelectorAll('.progress-dots span');
  function next() {
    Keyboard.clearMarks();
    const start = rand([60, 62, 64, 65, 67, 69, 71]);
    const dir = Math.random() < 0.65 ? 1 : -1, size = Math.random() < 0.5 ? 1 : 2;
    q = { start, dir, size, want: start + dir * size };
    Keyboard.mark(start, 'target');
    pr.textContent = `${size === 1 ? 'Half' : 'Whole'} step ${dir > 0 ? 'up' : 'down'} from ${SHARP[mod12(start)]}`;
  }
  const off = Bus.on('note', d => {
    if (!q || r >= rounds) return;
    if (d.midi === q.start) return;
    if (mod12(d.midi) === mod12(q.want)) {
      dots[r].classList.add('on'); r++;
      fb(f, 'good', `${pcLabel(mod12(q.want))}. ${q.size === 2 ? 'Two keys: ' + SHARP[mod12(q.start)] + ' → ' + pcLabel(mod12(q.start + q.dir)) + ' → ' + pcLabel(mod12(q.want)) + '.' : 'The very next key.'}`);
      if (r >= rounds) { Keyboard.clearMarks(); q = null; done(true); } else setTimeout(next, 1100);
    } else fb(f, 'bad', `That is ${noteName(d.midi)}. ${q.size === 1 ? 'A half step is the very next key, black or white.' : 'A whole step skips exactly one key.'}`);
  });
  next();
  return () => { off(); Keyboard.clearMarks(); };
};

Tasks.chromatic = (el, p, done) => {
  el.innerHTML = `<p class="prompt">Start on any C and play every key, black and white, up to the next C. That is 13 notes.</p><div class="notes-strip"><span class="empty">Waiting for your first note</span></div><p class="fb info" aria-live="polite"></p>`;
  const strip = el.querySelector('.notes-strip'), f = el.querySelector('.fb');
  let run = [], finished = false;
  const off = Bus.on('note', d => {
    if (finished) return;
    if (run.length && d.midi === run[run.length - 1] + 1) run.push(d.midi);
    else run = [d.midi];
    strip.innerHTML = run.map(m => `<span class="n">${SHARP[mod12(m)]}</span>`).join('');
    if (run.length >= 13) { finished = true; fb(f, 'good', 'All 12 half steps: that is the chromatic scale.'); done(true); }
    else fb(f, run.length === 1 ? 'info' : 'good', run.length === 1 ? 'Now the very next key up.' : `${run.length} of 13`);
  });
  return off;
};

Tasks.range = (el, p, done) => {
  function noMic() {
    el.innerHTML = `<p class="prompt">This step listens to your voice, so it needs the mic.</p><p class="fb info">${Mic.state === 'blocked' || Mic.state === 'unsupported' ? micProblem() : 'Turn on the mic to find your range, or skip it for now.'}</p><div class="row"><button type="button" class="btn primary" data-act="mic">Turn on mic</button><button type="button" class="btn" data-act="skip">Skip for now</button></div>`;
    el.querySelector('[data-act="mic"]').onclick = async () => { if (await Mic.start()) start(); else toast(micProblem()); };
    el.querySelector('[data-act="skip"]').onclick = () => done(true, { skipped: true });
  }
  let offP = null, lane = null;
  function start() {
    el.innerHTML = `<p class="prompt"></p><div class="lane-wrap"><canvas class="lane"></canvas></div><p class="fb info" aria-live="polite">Hold the note steady for about two seconds.</p>`;
    lane = PitchLane(el.querySelector('canvas'));
    const pr = el.querySelector('.prompt'), f = el.querySelector('.fb');
    let phase = 'low', samples = [], low = null;
    pr.textContent = 'Sing your lowest comfortable note on “ah” and hold it.';
    offP = Bus.on('pitch', q => {
      if (q.midiFloat == null || q.clarity < 0.9) { samples = []; return; }
      samples.push(q.midiFloat);
      if (samples.length > 3) {
        const med = samples.slice().sort((a, b) => a - b)[Math.floor(samples.length / 2)];
        samples = samples.filter(v => Math.abs(v - med) < 1);
      }
      if (samples.length >= 36) {
        const val = Math.round(mean(samples)); samples = [];
        if (phase === 'low') { low = val; phase = 'high'; pr.textContent = 'Now your highest comfortable note. No straining.'; fb(f, 'good', `Low note: ${noteName(low)}.`); }
        else {
          const lo = Math.min(low, val), hi = Math.max(low, val), span = hi - lo;
          const zl = lo + Math.round(span * 0.2), zh = hi - Math.round(span * 0.2);
          Store.data.range = { lo, hi, zl, zh }; Store.save();
          offP(); offP = null;
          pr.textContent = `Your range: ${noteName(lo)} to ${noteName(hi)}, ${span} half steps.`;
          fb(f, 'good', `Home zone: ${noteName(zl)} to ${noteName(zh)}. Singing tasks will stay inside it.`);
          done(true);
        }
      }
    });
  }
  if (Mic.state === 'on') start(); else noMic();
  return () => { if (offP) offP(); if (lane) lane.stop(); };
};

/* timing helpers for rhythm tasks */
function scheduleLights(lights, times, beatIdx) {
  const ids = [];
  times.forEach((t, i) => {
    const delay = Math.max(0, (t - Sound.now()) * 1000);
    ids.push(setTimeout(() => { lights.forEach(l => l.classList.remove('lit')); const L = lights[beatIdx(i)]; if (L) L.classList.add('lit'); }, delay));
  });
  return () => ids.forEach(clearTimeout);
}
function tapPadHTML() { return `<button type="button" class="tap-pad" data-act="tap">Tap here, press Space, or clap</button>`; }
function wireTapPad(el) {
  const b = el.querySelector('[data-act="tap"]'); if (!b) return;
  b.addEventListener('pointerdown', ev => { ev.preventDefault(); tap('tap'); });
}

Tasks.pulse = (el, p, done) => {
  const bpm = p.bpm || 80, spb = 60 / bpm, beats = 8;
  el.innerHTML = `<p class="prompt">Keep the beat at ${bpm} BPM for two bars, clapping a little louder on beat 1.</p><div class="beats"><span class="strong"></span><span></span><span></span><span></span></div>${tapPadHTML()}<div class="offsets" hidden></div><div class="row"><button type="button" class="btn primary" data-act="go">Start: four clicks, then you</button></div><p class="fb info" aria-live="polite">${Mic.state === 'on' ? 'With the mic on, the clicks stop after the count-in so the mic only hears you. Keep the beat with the light.' : 'Tap along with the clicks.'}</p>`;
  wireTapPad(el);
  const lights = [...el.querySelectorAll('.beats span')], go = el.querySelector('[data-act="go"]'), f = el.querySelector('.fb'), offs = el.querySelector('.offsets');
  let onsets = [], listening = false, cancelLights = null, endTimer = 0;
  const off = Bus.on('onset', d => { if (listening) onsets.push(d.t); });
  go.onclick = () => {
    const ctx = Sound.ensure(); if (!ctx) { fb(f, 'bad', 'This browser has no Web Audio, so the metronome can’t run.'); return; }
    go.disabled = true; offs.hidden = true; onsets = [];
    const t0 = ctx.currentTime + 0.35;
    const silent = Mic.state === 'on';
    const all = [];
    for (let i = 0; i < 4 + beats; i++) {
      const t = t0 + i * spb; all.push(t);
      if (i < 4 || !silent) Sound.click(t, i % 4 === 0, i >= 4);
    }
    const expected = all.slice(4);
    cancelLights = scheduleLights(lights, all, i => i % 4);
    fb(f, 'info', 'One, two, three, four…');
    setTimeout(() => { listening = true; fb(f, 'info', 'Your turn.'); }, Math.max(0, (t0 + 3.5 * spb - ctx.currentTime) * 1000));
    endTimer = setTimeout(() => {
      listening = false; lights.forEach(l => l.classList.remove('lit'));
      const used = new Set(); let hits = 0; const errs = [];
      const cells = expected.map(t => {
        let best = -1, bd = 1;
        onsets.forEach((o, k) => { if (!used.has(k) && Math.abs(o - t) < bd) { bd = Math.abs(o - t); best = k; } });
        if (best >= 0 && bd <= 0.15) { used.add(best); hits++; const e = (onsets[best] - t) * 1000; errs.push(Math.abs(e)); return e; }
        return null;
      });
      offs.hidden = false;
      offs.innerHTML = cells.map((e, i) => {
        if (e === null) return `<div><div class="bar"><i class="miss"></i></div>${i % 4 + 1}</div>`;
        const top = 50 - Math.max(-48, Math.min(48, e / 150 * 48));
        return `<div><div class="bar"><i class="${Math.abs(e) < 50 ? '' : (e < 0 ? 'early' : 'late')}" style="top:calc(${top}% - 3px)"></i></div>${i % 4 + 1}</div>`;
      }).join('');
      go.disabled = false; go.textContent = 'Go again';
      if (hits >= 6) { fb(f, 'good', `${hits} of 8 beats, ${Math.round(mean(errs))} ms off on average. Bars above the line were early, below were late.`); done(true, { hits }); }
      else fb(f, 'bad', `${hits} of 8 beats landed. Watch the light and try again: you need 6.`);
    }, Math.max(0, (expected[beats - 1] + 0.5 - ctx.currentTime) * 1000));
  };
  return () => { off(); if (cancelLights) cancelLights(); clearTimeout(endTimer); };
};

const PATTERNS = [[1, 1, 1, 1], [1, 1, 2], [0.5, 0.5, 1, 0.5, 0.5, 1], [1, -1, 1, 1], [2, 0.5, 0.5, 1], [4], [0.5, 0.5, 0.5, 0.5, 2]];
Tasks.clapback = (el, p, done) => {
  const list = [PATTERNS[0]].concat(shuffle(PATTERNS.slice(1)).slice(0, (p.rounds || 3) - 1));
  const spb = 60 / (p.bpm || 72);
  let r = 0, onsets = [], listening = false, timers = [];
  el.innerHTML = `<p class="prompt">Listen, then clap or tap the rhythm back.</p><div class="notation"></div><div class="beats"><span class="strong"></span><span></span><span></span><span></span></div>${tapPadHTML()}<div class="row"><button type="button" class="btn" data-act="hear">▶ Hear it</button><button type="button" class="btn primary" data-act="go">My turn</button><div class="progress-dots">${'<span></span>'.repeat(list.length)}</div></div><p class="fb info" aria-live="polite"></p>`;
  wireTapPad(el);
  const nota = el.querySelector('.notation'), f = el.querySelector('.fb'), dots = el.querySelectorAll('.progress-dots span'), lights = [...el.querySelectorAll('.beats span')];
  const hear = el.querySelector('[data-act="hear"]'), go = el.querySelector('[data-act="go"]');
  const off = Bus.on('onset', d => { if (listening) onsets.push(d.t); });
  const starts = pat => { const out = []; let b = 0; pat.forEach(d => { if (d > 0) out.push(b); b += Math.abs(d); }); return out; };
  const draw = marks => { nota.innerHTML = rhythmSVG(list[r], marks); };
  function clearT() { timers.forEach(clearTimeout); timers = []; }
  hear.onclick = () => {
    const ctx = Sound.ensure(); if (!ctx) return; clearT();
    const t0 = ctx.currentTime + 0.3;
    for (let i = 0; i < 4; i++) Sound.click(t0 + i * spb, i === 0, true);
    const bar = t0 + 4 * spb;
    starts(list[r]).forEach(b => Sound.wood(bar + b * spb));
    const times = []; for (let i = 0; i < 8; i++) times.push(t0 + i * spb);
    const cancel = scheduleLights(lights, times, i => i % 4); timers.push(setTimeout(() => { cancel(); lights.forEach(l => l.classList.remove('lit')); }, (8 * spb + 0.6) * 1000));
  };
  go.onclick = () => {
    const ctx = Sound.ensure(); if (!ctx) return; clearT();
    go.disabled = true; hear.disabled = true; onsets = [];
    const t0 = ctx.currentTime + 0.3;
    for (let i = 0; i < 4; i++) Sound.click(t0 + i * spb, i === 0, true);
    const bar = t0 + 4 * spb;
    const times = []; for (let i = 0; i < 8; i++) times.push(t0 + i * spb);
    scheduleLights(lights, times, i => i % 4);
    timers.push(setTimeout(() => { listening = true; fb(f, 'info', 'Your turn.'); }, (3.6 * spb + 0.3) * 1000));
    timers.push(setTimeout(() => {
      listening = false; lights.forEach(l => l.classList.remove('lit'));
      const exp = starts(list[r]).map(b => bar + b * spb);
      const used = new Set(); const marks = []; let matched = 0;
      exp.forEach(t => {
        let best = -1, bd = 1;
        onsets.forEach((o, k) => { if (!used.has(k) && Math.abs(o - t) < bd) { bd = Math.abs(o - t); best = k; } });
        if (best >= 0 && bd <= 0.14) { used.add(best); matched++; marks.push('ok'); } else marks.push('no');
      });
      const extra = onsets.filter((o, k) => !used.has(k) && o > bar - 0.15).length;
      const full = []; let mi = 0; list[r].forEach(d => full.push(d > 0 ? marks[mi++] : null));
      draw(full);
      go.disabled = false; hear.disabled = false;
      if (matched === exp.length && extra <= 1) {
        dots[r].classList.add('on'); r++;
        fb(f, 'good', 'Every note landed.');
        if (r >= list.length) { done(true); go.disabled = true; hear.disabled = true; }
        else timers.push(setTimeout(() => { draw(); fb(f, 'info', 'Next rhythm. Hear it first.'); }, 1600));
      } else fb(f, 'bad', `${matched} of ${exp.length} notes landed${extra > 1 ? `, plus ${extra} extra claps` : ''}. Red dots show the ones to fix. Hear it again, then retry.`);
    }, (8 * spb + 0.55) * 1000));
  };
  draw();
  return () => { off(); clearT(); };
};

function blackCall() {
  const L = BLACK_IN_RANGE.filter(m => m >= 54 && m <= 70);
  let i = randInt(1, L.length - 3); const out = [L[i]];
  while (out.length < 4) { i = Math.max(0, Math.min(L.length - 1, i + rand([-2, -1, 1, 1, 2]))); out.push(L[i]); }
  return out;
}
Tasks.echo = (el, p, done) => {
  let phase = 'echo', round = 0, call = blackCall(), got = [];
  el.innerHTML = `<p class="prompt"></p><div class="notes-strip"></div><div class="row">${playBtn('Hear the call')}<button type="button" class="btn small" data-act="clear">Start over</button></div><p class="fb info" aria-live="polite"></p><div class="row" data-save hidden><button type="button" class="btn primary small" data-act="save">Save this answer to my sketchbook</button></div>`;
  const pr = el.querySelector('.prompt'), strip = el.querySelector('.notes-strip'), f = el.querySelector('.fb'), saveRow = el.querySelector('[data-save]');
  const play = () => Sound.seq(call.map((m, i) => ({ m, t: i * 0.42, d: 0.38 })));
  const paint = () => { strip.innerHTML = got.length ? got.map(m => `<span class="n">${SHARP[mod12(m)]}</span>`).join('') : '<span class="empty">Your notes appear here</span>'; };
  const setPrompt = () => { pr.textContent = phase === 'echo' ? `Echo ${round + 1} of 2: play the call back, note for note, on black keys.` : 'Now answer it: four black-key notes of your own that are different from the call.'; };
  el.querySelector('[data-act="play"]').onclick = play;
  el.querySelector('[data-act="clear"]').onclick = () => { got = []; paint(); fb(f, 'info', ''); };
  el.querySelector('[data-act="save"]').onclick = () => {
    saveSketch({ name: 'Answer to a call', notes: got.map((m, i) => ({ m, t: i * 0.42 })), prompt: 'Echo and answer' });
    saveRow.hidden = true; fb(f, 'good', 'Saved to your sketchbook.');
  };
  const off = Bus.on('note', d => {
    if (phase === 'done') return;
    got.push(d.midi); paint();
    if (got.length < 4) return;
    const same = got.every((m, i) => mod12(m) === mod12(call[i]));
    if (phase === 'echo') {
      if (same) {
        round++; fb(f, 'good', 'Exact echo.');
        if (round >= 2) { phase = 'answer'; call = blackCall(); }
        else call = blackCall();
        got = []; setTimeout(() => { paint(); setPrompt(); play(); }, 1200);
      } else {
        strip.innerHTML = got.map((m, i) => `<span class="n${mod12(m) === mod12(call[i]) ? '' : ' off'}">${SHARP[mod12(m)]}</span>`).join('');
        fb(f, 'bad', 'Close. The red notes differ from the call. Hear it again and retry.'); got = [];
      }
    } else {
      const allBlack = got.every(isBlack);
      if (!allBlack) { fb(f, 'bad', 'Keep the answer on black keys so it fits the call.'); got = []; return; }
      if (same) { fb(f, 'bad', 'That repeats the call exactly. Change at least one note to make it yours.'); got = []; return; }
      phase = 'done';
      fb(f, 'good', 'That is your answer. Listen to the call and answer together.');
      Sound.seq(call.map((m, i) => ({ m, t: i * 0.42, d: 0.38 })).concat(got.map((m, i) => ({ m, t: 2 + i * 0.42, d: 0.38 }))));
      saveRow.hidden = false; done(true);
    }
  });
  paint(); setPrompt(); setTimeout(play, 300);
  return off;
};

Tasks.motif = (el, p, done) => {
  let notes = [], rec = false, tStart = 0;
  el.innerHTML = `<p class="prompt">${p.prompt}</p><div class="notes-strip"></div><div class="row"><button type="button" class="btn primary" data-act="rec">● Record</button><button type="button" class="btn" data-act="play" disabled>▶ Play back</button><button type="button" class="btn ghost" data-act="clear" disabled>Clear</button></div><div class="field"><label for="motif-name">Name it</label><input id="motif-name" type="text" maxlength="40" placeholder="e.g. Rain on the roof"></div><div class="row"><button type="button" class="btn primary" data-act="save" disabled>Save to sketchbook</button></div><p class="fb info" aria-live="polite">${p.blackOnly ? 'Black keys only. Any order sounds good.' : ''}</p>`;
  const strip = el.querySelector('.notes-strip'), f = el.querySelector('.fb');
  const bRec = el.querySelector('[data-act="rec"]'), bPlay = el.querySelector('[data-act="play"]'), bClear = el.querySelector('[data-act="clear"]'), bSave = el.querySelector('[data-act="save"]'), name = el.querySelector('#motif-name');
  const max = p.max || 8, min = p.min || 3;
  const paint = () => {
    strip.innerHTML = notes.length ? notes.map(n => `<span class="n">${SHARP[mod12(n.m)]}</span>`).join('') : '<span class="empty">Press Record, then play your notes</span>';
    bPlay.disabled = !notes.length; bClear.disabled = !notes.length; bSave.disabled = notes.length < min;
  };
  bRec.onclick = () => { rec = !rec; bRec.textContent = rec ? '■ Stop' : '● Record'; if (rec) { notes = []; tStart = 0; paint(); fb(f, 'info', 'Recording. Play up to ' + max + ' notes.'); } };
  bPlay.onclick = () => Sound.seq(notes.map(n => ({ m: n.m, t: n.t, d: 0.4 })));
  bClear.onclick = () => { notes = []; paint(); };
  bSave.onclick = () => {
    const s = saveSketch({ name: name.value.trim() || 'Motif ' + (Store.data.sketches.length + 1), notes, prompt: p.prompt });
    fb(f, 'good', `Saved “${s.name}” to your sketchbook.`); bSave.disabled = true; done(true);
  };
  const off = Bus.on('note', d => {
    if (!rec) return;
    if (p.blackOnly && !isBlack(d.midi)) { fb(f, 'bad', `${noteName(d.midi)} is a white key. This motif uses black keys only.`); return; }
    if (!notes.length) tStart = d.t || Sound.now();
    notes.push({ m: d.midi, t: Math.max(0, Math.min(8, (d.t || Sound.now()) - tStart)) });
    paint();
    if (notes.length >= max) { rec = false; bRec.textContent = '● Record'; fb(f, 'info', 'That is ' + max + ' notes. Play it back, name it, save it.'); }
  });
  paint();
  return off;
};

Tasks.choice = (el, p, done) => {
  el.innerHTML = `<p class="prompt">${p.q}</p><div class="choices">${p.options.map((o, i) => `<button type="button" class="choice" data-i="${i}">${o}</button>`).join('')}</div><p class="fb info" aria-live="polite"></p>`;
  const box = el.querySelector('.choices'), f = el.querySelector('.fb'); let answered = false;
  box.onclick = ev => {
    const b = ev.target.closest('.choice'); if (!b || answered) return;
    answered = true; const ok = +b.dataset.i === p.answer;
    b.classList.add(ok ? 'right' : 'wrong');
    box.querySelector(`[data-i="${p.answer}"]`).classList.add('right');
    fb(f, ok ? 'good' : 'bad', p.why || (ok ? 'Right.' : 'Not this time.'));
    done(ok);
  };
  return () => {};
};

Tasks.card = (el, step) => {
  el.innerHTML = `<div class="body">${step.body}</div>${step.play ? `<div class="row">${playBtn(step.playLabel)}</div>` : ''}${step.fret ? `<div class="fret">${fretSVG()}</div>` : ''}${step.rhythm ? `<div class="notation">${rhythmSVG(step.rhythm)}</div>` : ''}`;
  const b = el.querySelector('[data-act="play"]');
  if (b) b.onclick = () => { if (step.play === 'metronome') { const ctx = Sound.ensure(); if (!ctx) return; const t0 = ctx.currentTime + 0.1; for (let i = 0; i < 8; i++) Sound.click(t0 + i * 0.75, i % 4 === 0); } else Sound.seq(step.play); };
  if (step.marks) Keyboard.markPcs(step.marks, 'hint');
  return () => Keyboard.clearMarks();
};
