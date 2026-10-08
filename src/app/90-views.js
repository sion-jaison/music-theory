/* =================================================================
   Views
   ================================================================= */
const view = document.getElementById('view');
let current = 'home';
function setNav(name) { document.querySelectorAll('.nav button').forEach(b => b.setAttribute('aria-current', b.dataset.view === name ? 'page' : 'false')); }
function go(name, arg) {
  runCleanup(); current = name; setNav(name === 'lesson' || name === 'daily' ? 'home' : name);
  ({ home: renderHome, lesson: renderLesson, daily: renderDaily, sketchbook: renderSketchbook, setup: renderSetup })[name](arg);
  window.scrollTo({ top: 0 });
}

function paintStreak() {
  const el = document.getElementById('streak');
  el.innerHTML = `<b>${Store.data.streak.count}</b> day streak`;
}

function staffSVG() {
  const n = UNITS.length, w = 660, x0 = 48, dx = (w - x0 - 40) / (n - 1);
  const lines = [30, 42, 54, 66, 78].map(y => `<line class="line" x1="10" y1="${y}" x2="${w - 10}" y2="${y}"/>`).join('');
  const nxt = nextUnit();
  let heads = '';
  UNITS.forEach((u, i) => {
    const x = x0 + i * dx;
    if (u.boss) {
      heads += `<g class="head bossmark ${unitDone(u.id) ? 'done' : ''}" tabindex="0" role="button" data-u="${u.id}" aria-label="Boss challenge"><line class="bar" x1="${x - 4}" y1="30" x2="${x - 4}" y2="78" stroke-width="1.5"/><line class="bar" x1="${x + 3}" y1="30" x2="${x + 3}" y2="78" stroke-width="5"/><text x="${x}" y="104" text-anchor="middle">${unitDone(u.id) ? 'Passed' : 'Boss'}</text></g>`;
      return;
    }
    const y = 84 - i * 6;
    const cls = unitDone(u.id) ? 'done' : (nxt && nxt.id === u.id ? 'next' : '');
    const ledger = y >= 84 ? `<line class="line" x1="${x - 14}" y1="${y}" x2="${x + 14}" y2="${y}"/>` : '';
    heads += `<g class="head ${cls}" tabindex="0" role="button" data-u="${u.id}" aria-label="${u.id} ${esc(u.title)}${cls === 'done' ? ', done' : ''}">${ledger}<ellipse cx="${x}" cy="${y}" rx="9" ry="6.5" transform="rotate(-20 ${x} ${y})"/><text class="lbl" x="${x}" y="104" text-anchor="middle">${u.id.endsWith('M') ? 'motif' : u.id}</text></g>`;
  });
  return `<svg class="staff" viewBox="0 0 ${w} 112" role="group" aria-label="Level 1 path: each note is a unit, rising like a scale">${lines}<text x="14" y="70" font-family="var(--f-display)" font-size="44" fill="var(--muted)" opacity="0.35">𝄞</text>${heads}</svg>`;
}

function renderHome() {
  const doneN = UNITS.filter(u => unitDone(u.id)).length;
  const due = dueCards().length, nx = nextUnit();
  const today = Store.data.history[todayStr()];
  const dailyDone = today && today.done;
  const micLine = Mic.state === 'on' ? '<b>The mic is on.</b> Sing or play and the app follows.' : (Mic.state === 'blocked' || Mic.state === 'unsupported') ? `<b>The mic isn’t available on this page.</b> Everything works with the keys in the dock, your computer keyboard (A to K) or a MIDI keyboard. To use the mic, open the standalone version from your own site or localhost.` : '<b>Use the mic, the keys, or both.</b> Turn on the mic in the dock to sing or play a real instrument; tap the keys or use A to K otherwise.';
  view.innerHTML = `
  <div class="grid-2">
    <section class="panel today">
      <div class="eyebrow">Today · ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
      <h2>${dailyDone ? 'Daily Set done. See you tomorrow.' : 'Your Daily Set is ready'}</h2>
      <p class="lead">Ten minutes in six steps: tune in, review what is due, learn one new thing, make something, train your ear, and see today’s 1% gain.</p>
      <div class="row"><button type="button" class="btn primary" data-act="daily">${dailyDone ? 'Do another round' : 'Start the Daily Set'}</button>${nx ? `<button type="button" class="btn" data-act="next">${nx.boss ? 'Take the boss challenge' : 'Jump to ' + (nx.id.endsWith('M') ? 'the motif' : nx.id + ' ' + nx.title)}</button>` : ''}</div>
      <div class="mic-note"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><span>${micLine}</span></div>
    </section>
    <section class="stats" aria-label="Progress">
      <div class="stat"><b>${Store.data.streak.count}</b><span>day streak</span></div>
      <div class="stat"><b>${due}</b><span>cards due</span></div>
      <div class="stat"><b>${Store.data.sketches.length}</b><span>sketches</span></div>
      <div class="stat"><b>${doneN}/${UNITS.length}</b><span>Level 1 stops</span></div>
      <div class="stat"><b>${masteredCount()}</b><span>cards mastered</span></div>
      <div class="stat"><b>${Store.data.range ? noteName(Store.data.range.zl) + '–' + noteName(Store.data.range.zh) : '—'}</b><span>voice home zone</span></div>
    </section>
  </div>
  <section class="panel">
    <div class="level-head"><div><div class="eyebrow">Level 1 of 5</div><h2>Hear It, Find It</h2></div><span class="chip ${Store.data.bossPassed ? 'done' : 'live'}">${Store.data.bossPassed ? 'Level passed' : doneN + ' of ' + UNITS.length + ' done'}</span></div>
    <div class="staff-wrap">${staffSVG()}</div>
    <div class="units">${UNITS.map(u => {
      const st = unitDone(u.id) ? '<span class="chip done">Done</span>' : (nx && nx.id === u.id ? '<span class="chip next">Next</span>' : '');
      return `<button type="button" class="unit${u.boss ? ' boss' : ''}" data-u="${u.id}"><span class="top-line"><span class="num">${u.boss ? 'Boss' : u.create ? 'Create' : u.id}</span>${st}</span><h3>${u.title}</h3><p>${u.blurb}</p></button>`;
    }).join('')}</div>
  </section>
  <section class="panel later" aria-label="Coming levels">
    <div class="eyebrow">Next in the path</div>
    ${[['Level 2', 'Steps & Scales', 'Intervals, the major scale, solfège, reading rhythm'], ['Level 3', 'Stack It', 'Triads, inversions, the chords of a key'], ['Level 4', 'The Clock', 'Circle of Fifths, key signatures, three minors'], ['Level 5', 'Make It Move', 'Progressions, cadences, periods, your 8-bar piece']].map(([a, b, c]) => `<div class="item"><span><b>${a} · ${b}</b><br>${c}</span><span class="chip">Locked</span></div>`).join('')}
  </section>`;
  view.querySelector('[data-act="daily"]').onclick = () => go('daily');
  const nb = view.querySelector('[data-act="next"]'); if (nb) nb.onclick = () => go('lesson', nx.id);
  view.querySelectorAll('[data-u]').forEach(b => {
    const open = () => go('lesson', b.dataset.u);
    b.addEventListener('click', open);
    b.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); } });
  });
}

function renderLesson(id) {
  const u = unitById(id);
  runLesson(u, view, unit => showComplete(unit), () => go('home'));
}
function showComplete(unit) {
  const nx = nextUnit();
  const cards = (CARD_DEFS[unit.id] || []).length;
  view.innerHTML = `<section class="panel done-card"><div class="eyebrow">${unit.boss ? 'Level 1' : 'Unit ' + unit.id} complete</div><div class="big">${unit.boss ? 'Level 1 passed.' : unit.title + ': done.'}</div><p>${cards ? `${cards} review card${cards > 1 ? 's' : ''} joined your deck. They come back on a growing schedule: tomorrow, then 3, 7, 14 and 30 days.` : unit.create ? 'Your motif is in the sketchbook. You will grow it into a phrase in Level 2.' : 'Nice work.'}</p>${unit.boss ? '<p>You can find any note, step by half and whole steps, keep a steady beat and read basic rhythms. Level 2 arrives in the next build.</p>' : ''}<div class="row">${nx ? `<button type="button" class="btn primary" data-act="next">${nx.boss ? 'Boss challenge' : 'Next: ' + nx.title}</button>` : ''}<button type="button" class="btn" data-act="home">Level 1 path</button></div></section>`;
  const nb = view.querySelector('[data-act="next"]'); if (nb) nb.onclick = () => go('lesson', nx.id);
  view.querySelector('[data-act="home"]').onclick = () => go('home');
  paintStreak();
}

/* ---------- Daily Set ---------- */
const DAILY = ['Tune-in', 'Review', 'New bite', 'Create', 'Ear spark', 'Today’s 1%'];
const CREATE_PROMPTS = [
  'Make a 4-note motif on black keys that climbs, then falls.',
  'Make a motif that starts and ends on the same note.',
  'Make a motif with one big jump in it.',
  'Make a motif that uses only two different notes.',
  'Make a motif that sounds like a question.',
  'Repeat one note three times, then move. Make that a motif.'
];
function renderDaily() {
  let s = 0;
  view.innerHTML = `<section class="panel"><div class="lesson-head"><div><div class="eyebrow">Daily Set · about 10 minutes</div><h1>Today’s practice</h1></div><button type="button" class="btn ghost small" data-act="exit">← Home</button></div><div class="strip">${DAILY.map(d => `<div>${d}</div>`).join('')}</div><div class="stage"></div></section>`;
  const stage = view.querySelector('.stage'), strip = view.querySelectorAll('.strip div');
  view.querySelector('[data-act="exit"]').onclick = () => go('home');
  const day = Store.day();
  function frame(title, sub) {
    strip.forEach((d, i) => { d.classList.toggle('on', i === s); d.classList.toggle('past', i < s); });
    stage.innerHTML = `<div class="tag">${DAILY[s]} · ${s + 1} of 6</div><h2>${title}</h2>${sub ? `<p class="lead">${sub}</p>` : ''}<div class="task"></div><div class="stepnav"><button type="button" class="skip" data-act="skip">Skip</button><button type="button" class="btn primary" data-act="next" disabled>Next</button></div>`;
    const next = stage.querySelector('[data-act="next"]');
    const advance = () => { runCleanup(); s++; steps[s](); };
    next.onclick = advance; stage.querySelector('[data-act="skip"]').onclick = advance;
    return { body: stage.querySelector('.task'), ready: () => { next.disabled = false; } };
  }
  const steps = [
    function tune() {
      const f = frame('Match three notes', 'Listen, then play or sing the same note. Any octave counts.');
      const zone = Store.data.range;
      const lo = zone ? Math.max(48, zone.zl) : 55, hi = zone ? Math.min(72, zone.zh) : 67;
      let r = 0, target = randInt(lo, hi), tries = 0;
      f.body.innerHTML = `<div class="row">${playBtn('Hear it again')}<div class="progress-dots"><span></span><span></span><span></span></div></div><p class="fb info" aria-live="polite">Listening…</p>`;
      const fbEl = f.body.querySelector('.fb'), dots = f.body.querySelectorAll('.progress-dots span');
      const play = () => Sound.tone(target, Sound.now() + 0.05, 1);
      f.body.querySelector('[data-act="play"]').onclick = play;
      setTimeout(play, 250);
      cleanup = Bus.on('note', d => {
        if (r >= 3) return;
        tries++;
        if (mod12(d.midi) === mod12(target)) {
          dots[r].classList.add('on'); r++; if (tries === 1) day.tuneOk++; day.tuneN++; tries = 0;
          fb(fbEl, 'good', `${pcLabel(mod12(target))}. Matched.`);
          if (r >= 3) { Store.save(); f.ready(); } else { target = randInt(lo, hi); setTimeout(play, 900); }
        } else fb(fbEl, 'bad', `That is ${noteName(d.midi)}. ${d.midi < target ? 'Go higher.' : 'Go lower.'}`);
      });
    },
    function review() {
      let due = dueCards();
      const practice = !due.length;
      const unlocked = allCardDefs().filter(c => Store.data.cards[c.id]);
      if (practice) due = shuffle(unlocked).slice(0, 3);
      due = shuffle(due).slice(0, 8);
      const f = frame(practice ? (unlocked.length ? 'Nothing due: a quick warm-up' : 'Your review deck is empty') : `${due.length} card${due.length > 1 ? 's' : ''} due`, unlocked.length ? 'Answer by playing, singing or choosing. Speed counts toward mastery.' : 'Cards join the deck as you finish Level 1 units. The first lesson adds the first card.');
      if (!due.length) { f.ready(); return; }
      let k = 0;
      const holder = document.createElement('div'); f.body.appendChild(holder);
      const counter = document.createElement('p'); counter.className = 'eyebrow'; f.body.prepend(counter);
      function show() {
        runCleanup();
        if (k >= due.length) { counter.textContent = 'Deck done'; holder.innerHTML = '<p class="fb good">All cards answered. The scheduler has moved each one to its next date.</p>'; Store.save(); f.ready(); return; }
        counter.textContent = `Card ${k + 1} of ${due.length}`;
        const c = due[k], t0 = performance.now();
        const fin = ok => { if (!practice) gradeCard(c.id, ok, performance.now() - t0); k++; setTimeout(show, ok ? 900 : 1900); };
        if (c.type === 'choice') cleanup = Tasks.choice(holder, c, fin);
        else if (c.type === 'play') cleanup = cardPlay(holder, c, fin);
        else if (c.type === 'step') cleanup = cardStep(holder, c, fin);
        else if (c.type === 'nameBlack') cleanup = cardBlack(holder, c, fin);
      }
      show();
    },
    function newBite() {
      const nx = nextUnit();
      const f = frame(nx ? (nx.boss ? 'Boss challenge' : `Up next: ${nx.title}`) : 'Level 1 complete', nx ? nx.blurb : 'Every Level 1 stop is done. Level 2 arrives in the next build; for now, your review deck keeps the skills sharp.');
      if (!nx) { f.ready(); return; }
      f.body.innerHTML = `<button type="button" class="btn primary" data-act="open">Start ${nx.boss ? 'the boss challenge' : nx.id.endsWith('M') ? 'the motif' : 'unit ' + nx.id}</button>`;
      f.body.querySelector('[data-act="open"]').onclick = () => {
        const host = document.createElement('div'); f.body.innerHTML = ''; f.body.appendChild(host);
        runLesson(nx, host, unit => { host.innerHTML = `<p class="fb good">${unit.title}: done. ${(CARD_DEFS[unit.id] || []).length ? 'New review cards joined your deck.' : ''}</p>`; f.ready(); }, () => { host.innerHTML = '<p class="fb info">Lesson paused. You can pick it up from the Level 1 path.</p>'; f.ready(); });
      };
    },
    function create() {
      const prompt = rand(CREATE_PROMPTS);
      const f = frame('Make something', 'Two minutes, one small constraint. Everything you save goes in your sketchbook.');
      cleanup = Tasks.motif(f.body, { prompt, blackOnly: true, min: 3, max: 8 }, () => f.ready());
    },
    function ear() {
      const f = frame('Higher or lower?', 'Two notes. Was the second one higher or lower than the first?');
      let r = 0, a = 0, b = 0, ok = 0;
      f.body.innerHTML = `<div class="row">${playBtn('Hear them again')}<div class="progress-dots">${'<span></span>'.repeat(5)}</div></div><div class="choices"><button type="button" class="choice" data-v="1">Higher</button><button type="button" class="choice" data-v="-1">Lower</button></div><p class="fb info" aria-live="polite"></p>`;
      const fbEl = f.body.querySelector('.fb'), dots = f.body.querySelectorAll('.progress-dots span'), box = f.body.querySelector('.choices');
      const play = () => Sound.seq([{ m: a, t: 0, d: 0.6 }, { m: b, t: 0.75, d: 0.6 }]);
      function next() {
        const gap = r < 2 ? randInt(4, 7) : r < 4 ? randInt(2, 3) : 1;
        a = randInt(55, 68); b = a + (Math.random() < 0.5 ? gap : -gap);
        box.querySelectorAll('.choice').forEach(c => { c.className = 'choice'; c.disabled = false; });
        play();
      }
      f.body.querySelector('[data-act="play"]').onclick = play;
      box.onclick = ev => {
        const c = ev.target.closest('.choice'); if (!c || c.disabled) return;
        const right = Math.sign(b - a) === +c.dataset.v;
        box.querySelectorAll('.choice').forEach(x => { x.disabled = true; });
        c.classList.add(right ? 'right' : 'wrong'); dots[r].classList.add(right ? 'on' : 'miss');
        if (right) ok++;
        fb(fbEl, right ? 'good' : 'bad', `${noteName(a)} → ${noteName(b)}: ${Math.abs(b - a)} half step${Math.abs(b - a) > 1 ? 's' : ''} ${b > a ? 'up' : 'down'}.`);
        r++;
        if (r >= 5) { day.earOk += ok; day.earN += 5; Store.save(); f.ready(); } else setTimeout(next, 1300);
      };
      setTimeout(next, 250);
    },
    function onePercent() {
      day.done = true; bumpStreak(); Store.save(); paintStreak();
      const f = frame('Today’s 1%', '');
      const msg = onePercentMessage();
      f.body.innerHTML = `<div class="one-percent">${msg.big}</div><p>${msg.small}</p><p class="eyebrow" style="margin-top:12px">${Store.data.streak.count} day streak · ${dueCards().length} cards due now</p>`;
      const nb = stage.querySelector('[data-act="next"]'); nb.disabled = false; nb.textContent = 'Done'; nb.onclick = () => go('home');
      stage.querySelector('[data-act="skip"]').hidden = true;
      strip.forEach(d => { d.classList.remove('on'); d.classList.add('past'); });
    }
  ];
  steps[0]();
}
function onePercentMessage() {
  const h = Store.data.history, t = todayStr();
  const today = h[t];
  const prevDays = Object.keys(h).filter(d => d < t).sort();
  const prev = prevDays.length ? h[prevDays[prevDays.length - 1]] : null;
  const speed = x => x && x.revMs && x.revMs.length ? mean(x.revMs) / 1000 : null;
  const acc = (o, n) => n ? o / n : null;
  if (prev) {
    const s0 = speed(prev), s1 = speed(today);
    if (s0 && s1 && s1 < s0) return { big: `${s0.toFixed(1)} s → ${s1.toFixed(1)} s`, small: 'Average time per review card, last session vs today. Faster recall is what mastery looks like.' };
    const e0 = acc(prev.earOk, prev.earN), e1 = acc(today.earOk, today.earN);
    if (e0 != null && e1 != null && e1 > e0) return { big: `${Math.round(e0 * 100)}% → ${Math.round(e1 * 100)}%`, small: 'Higher-or-lower accuracy, last session vs today.' };
    const u0 = acc(prev.tuneOk, prev.tuneN), u1 = acc(today.tuneOk, today.tuneN);
    if (u0 != null && u1 != null && u1 > u0) return { big: `${Math.round(u0 * 100)}% → ${Math.round(u1 * 100)}%`, small: 'Notes matched on the first try, last session vs today.' };
    return { big: 'Steady', small: 'No number beat last time today, and that is normal. Spaced practice dips before it climbs.' };
  }
  const s1 = speed(today);
  return { big: s1 ? `${s1.toFixed(1)} s per card` : 'Day one', small: s1 ? 'Your first review speed. Tomorrow’s Daily Set compares against it.' : 'Your first Daily Set is done. From tomorrow, this step shows one number that improved.' };
}

/* review card bodies */
function cardPlay(el, c, fin) {
  el.innerHTML = `<p class="prompt">Play this note, in any octave.</p><div class="big-name">${c.label}</div><p class="fb info" aria-live="polite"></p>`;
  const f = el.querySelector('.fb'); let done = false;
  const off = Bus.on('note', d => { if (done) return; done = true; const ok = mod12(d.midi) === c.pc; fb(f, ok ? 'good' : 'bad', ok ? `${noteName(d.midi)}. Right.` : `That was ${noteName(d.midi)}. ${c.label} is ${landmarkHint(c.pc)}.`); fin(ok); });
  return off;
}
function landmarkHint(pc) {
  return { 0: 'just left of the two black keys', 2: 'between the two black keys', 4: 'just right of the two black keys', 5: 'just left of the three black keys', 7: 'between the first and second of the three', 9: 'between the second and third of the three', 11: 'just right of the three black keys', 1: 'the first of the two black keys', 3: 'the second of the two black keys', 6: 'the first of the three black keys', 8: 'the middle of the three black keys', 10: 'the last of the three black keys' }[pc];
}
function cardStep(el, c, fin) {
  Keyboard.mark(c.start, 'target');
  el.innerHTML = `<p class="prompt">${c.size === 1 ? 'Half' : 'Whole'} step ${c.dir > 0 ? 'up' : 'down'} from ${SHARP[mod12(c.start)]}</p><p class="fb info" aria-live="polite">Start from the glowing key.</p>`;
  const f = el.querySelector('.fb'); let done = false; const want = c.start + c.dir * c.size;
  const off = Bus.on('note', d => { if (done || d.midi === c.start) return; done = true; const ok = mod12(d.midi) === mod12(want); fb(f, ok ? 'good' : 'bad', ok ? `${pcLabel(mod12(want))}. Right.` : `The answer is ${pcLabel(mod12(want))}.`); fin(ok); });
  return () => { off(); Keyboard.clearMarks(); };
}
function cardBlack(el, c, fin) {
  Keyboard.mark(60 + c.pc, 'target');
  const opts = shuffle([SHARP[c.pc], FLAT[c.pc], ...shuffle(BLACK_PCS.filter(x => x !== c.pc)).slice(0, 1).reduce((a, x) => a.concat([SHARP[x], FLAT[x]]), [])]);
  el.innerHTML = `<p class="prompt">Name the glowing key. Pick both names.</p><div class="choices">${opts.map(o => `<button type="button" class="choice" aria-pressed="false" data-v="${o}">${o}</button>`).join('')}</div><p class="fb info" aria-live="polite"></p>`;
  const box = el.querySelector('.choices'), f = el.querySelector('.fb'); const picked = new Set(); let done = false;
  box.onclick = ev => {
    const b = ev.target.closest('.choice'); if (!b || done) return;
    picked.add(b.dataset.v); b.setAttribute('aria-pressed', 'true');
    if (picked.size === 2) {
      done = true; const ok = picked.has(SHARP[c.pc]) && picked.has(FLAT[c.pc]);
      box.querySelectorAll('.choice').forEach(x => { if (x.dataset.v === SHARP[c.pc] || x.dataset.v === FLAT[c.pc]) x.classList.add('right'); else if (picked.has(x.dataset.v)) x.classList.add('wrong'); });
      fb(f, ok ? 'good' : 'bad', ok ? 'Both names. Right.' : `It is ${SHARP[c.pc]} and ${FLAT[c.pc]}.`); fin(ok);
    }
  };
  return () => Keyboard.clearMarks();
}

/* ---------- Sketchbook ---------- */
function renderSketchbook() {
  const list = Store.data.sketches;
  view.innerHTML = `<section class="panel"><div class="level-head"><div><div class="eyebrow">Sketchbook</div><h2>Your motifs and answers</h2></div><span class="chip">${list.length} saved</span></div><p style="color:var(--muted);margin-top:8px;max-width:60ch">Every idea you save lives here. Later levels grow these into phrases, then into an 8-bar piece. Saved in this browser.</p><div class="sketches" style="margin-top:16px">${list.length ? list.map(s => `<div class="sketch" data-id="${s.id}"><div><h3>${esc(s.name)}</h3><div class="meta">${s.notes.map(n => SHARP[mod12(n.m)]).join(' · ')} · ${s.created}${s.prompt ? ' · ' + esc(s.prompt) : ''}</div></div><div class="row"><button type="button" class="btn small" data-act="play">▶ Play</button><span class="del"><button type="button" class="btn small ghost" data-act="del">Delete</button></span></div></div>`).join('') : '<div class="empty-state"><b>No sketches yet.</b><span>Your first one comes from the “Your first motif” stop on the Level 1 path, or the Create step of any Daily Set.</span><button type="button" class="btn primary" data-act="motif">Make a motif now</button></div>'}</div></section>`;
  const mk = view.querySelector('[data-act="motif"]'); if (mk) mk.onclick = () => go('lesson', '1.M');
  view.querySelectorAll('.sketch').forEach(row => {
    const s = list.find(x => x.id === row.dataset.id);
    row.querySelector('[data-act="play"]').onclick = () => Sound.seq(s.notes.map(n => ({ m: n.m, t: n.t, d: 0.4 })));
    const del = row.querySelector('.del');
    row.querySelector('[data-act="del"]').onclick = () => {
      del.innerHTML = '<span class="confirm">Delete for good? <button type="button" class="btn small" data-act="yes">Delete</button><button type="button" class="btn small ghost" data-act="no">Keep</button></span>';
      del.querySelector('[data-act="yes"]').onclick = () => { Store.data.sketches = Store.data.sketches.filter(x => x.id !== s.id); Store.save(); renderSketchbook(); };
      del.querySelector('[data-act="no"]').onclick = () => renderSketchbook();
    };
  });
}

/* ---------- Setup ---------- */
function renderSetup() {
  const st = Store.data.settings;
  view.innerHTML = `<div class="setup-list">
    <section class="panel"><h2>Microphone</h2><p>The mic hears single notes from a voice, guitar, piano or any instrument, and claps for rhythm work. Sound is analysed on this device and never uploaded.</p><p style="margin-top:8px"><b>Status:</b> <span data-mic-status></span></p><div class="row"><button type="button" class="btn primary" data-act="mic"></button></div><p style="margin-top:12px">Headphones help: they keep the app’s own sounds out of the mic. Your browser’s voice processing is switched off so musical notes stay clean.</p></section>
    <section class="panel"><h2>Rhythm timing</h2><p>Phones and Bluetooth headsets add delay. If your claps keep scoring late, raise this.</p><div class="row"><label for="lat">Mic delay correction</label><input id="lat" type="range" min="0" max="160" step="10" value="${st.micLatency}"><span class="mono" data-lat>${st.micLatency} ms</span></div></section>
    <section class="panel"><h2>Keyboard</h2><p>Your computer keyboard plays one octave. Space taps a beat.</p><div class="kbd-map" style="margin-top:10px">${Object.keys(KEYMAP).map(k => `<kbd>${k.toUpperCase()} ${SHARP[KEYMAP[k] % 12]}</kbd>`).join('')}<kbd>Z octave down</kbd><kbd>X octave up</kbd><kbd>Space tap</kbd></div><div class="row"><label class="toggle"><input id="labels" type="checkbox" ${st.labels ? 'checked' : ''}> Show note names on the keys</label></div></section>
    <section class="panel"><h2>MIDI keyboard</h2><p>Plug in a USB MIDI keyboard for exact notes. Works in Chrome, Edge and Firefox; Safari does not support it.</p><div class="row"><button type="button" class="btn" data-act="midi">Connect MIDI</button><span data-midi-status class="chip">${Midi.state === 'on' ? 'Connected' : 'Not connected'}</span></div></section>
    <section class="panel"><h2>Start over</h2><p>Clears units, review cards, streak and sketches from this browser.</p><div class="row" data-reset><button type="button" class="btn ghost" data-act="reset">Reset progress</button></div></section>
  </div>`;
  const micBtn = view.querySelector('[data-act="mic"]'), micSt = view.querySelector('[data-mic-status]');
  const paint = () => {
    micSt.textContent = { on: 'listening', off: 'off', starting: 'asking for permission…', blocked: 'blocked on this page', unsupported: 'not available on this page', nodevice: 'no microphone found' }[Mic.state];
    micBtn.textContent = Mic.state === 'on' ? 'Turn mic off' : 'Turn mic on';
  };
  paint(); const offMic = Bus.on('mic', paint);
  micBtn.onclick = async () => { if (Mic.state === 'on') Mic.stop(); else if (!(await Mic.start())) toast(micProblem()); };
  const lat = view.querySelector('#lat'), latTxt = view.querySelector('[data-lat]');
  lat.oninput = () => { st.micLatency = +lat.value; latTxt.textContent = lat.value + ' ms'; Store.save(); };
  view.querySelector('#labels').onchange = ev => { st.labels = ev.target.checked; Keyboard.setLabels(st.labels); Store.save(); };
  view.querySelector('[data-act="midi"]').onclick = async () => {
    await Midi.start();
    view.querySelector('[data-midi-status]').textContent = { on: 'Connected', nodevice: 'No MIDI keyboard found', blocked: 'Blocked on this page', unsupported: 'Not supported in this browser' }[Midi.state] || 'Not connected';
  };
  const rs = view.querySelector('[data-reset]');
  view.querySelector('[data-act="reset"]').onclick = () => {
    rs.innerHTML = '<span class="confirm">This clears everything in this browser. <button type="button" class="btn small" data-act="yes">Reset</button><button type="button" class="btn small ghost" data-act="no">Cancel</button></span>';
    rs.querySelector('[data-act="yes"]').onclick = () => { Store.data = Store.defaults(); Store.save(); paintStreak(); Keyboard.setLabels(true); toast('Progress cleared.'); go('home'); };
    rs.querySelector('[data-act="no"]').onclick = () => renderSetup();
  };
  cleanup = offMic;
}
