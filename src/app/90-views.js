/* =================================================================
   Views
   ================================================================= */
const view = document.getElementById('view');
let current = 'home';
function setNav(name) { document.querySelectorAll('.nav button').forEach(b => b.setAttribute('aria-current', b.dataset.view === name ? 'page' : 'false')); }
function go(name, arg) {
  runCleanup(); current = name; setNav(name === 'lesson' || name === 'daily' || name === 'listen' ? 'home' : name);
  ({ home: renderHome, lesson: renderLesson, daily: renderDaily, sketchbook: renderSketchbook, toolbox: renderToolbox, setup: renderSetup, listen: renderListen })[name](arg);
  window.scrollTo({ top: 0 });
}

function paintStreak() {
  const el = document.getElementById('streak');
  el.innerHTML = `<b>${Store.data.streak.count}</b> day streak`;
}

const unitLabel = u => u.boss ? 'Boss' : u.create ? 'Create' : u.id;
/* the level path: each unit is a note head, rising like a scale, ending at the boss's double bar */
function pathSVG(lv) {
  const units = lv.units, n = units.length, w = 660, x0 = 48, dx = (w - x0 - 40) / (n - 1);
  const lines = [30, 42, 54, 66, 78].map(y => `<line class="line" x1="10" y1="${y}" x2="${w - 10}" y2="${y}"/>`).join('');
  const nxt = nextUnit(lv.n);
  const open = levelUnlocked(lv.n);
  let heads = '';
  units.forEach((u, i) => {
    const x = x0 + i * dx;
    const attrs = open ? `tabindex="0" role="button" data-u="${u.id}"` : 'aria-disabled="true"';
    if (u.boss) {
      heads += `<g class="head bossmark ${unitDone(u.id) ? 'done' : ''}" ${attrs} aria-label="Level ${lv.n} boss challenge"><line class="bar" x1="${x - 4}" y1="30" x2="${x - 4}" y2="78" stroke-width="1.5"/><line class="bar" x1="${x + 3}" y1="30" x2="${x + 3}" y2="78" stroke-width="5"/><text x="${x}" y="104" text-anchor="middle">${unitDone(u.id) ? 'Passed' : 'Boss'}</text></g>`;
      return;
    }
    const y = 84 - i * 6;
    const cls = unitDone(u.id) ? 'done' : (open && nxt && nxt.id === u.id ? 'next' : '');
    const ledger = y >= 84 ? `<line class="line" x1="${x - 14}" y1="${y}" x2="${x + 14}" y2="${y}"/>` : '';
    heads += `<g class="head ${cls}" ${attrs} aria-label="${u.id} ${esc(u.title)}${cls === 'done' ? ', done' : ''}">${ledger}<ellipse cx="${x}" cy="${y}" rx="9" ry="6.5" transform="rotate(-20 ${x} ${y})"/><text class="lbl" x="${x}" y="104" text-anchor="middle">${u.pathLabel || (u.create ? 'make' : u.id)}</text></g>`;
  });
  return `<svg class="staff${open ? '' : ' locked'}" viewBox="0 0 ${w} 112" role="group" aria-label="Level ${lv.n} path: each note is a unit, rising like a scale">${lines}<text x="14" y="70" font-family="var(--f-display)" font-size="44" fill="var(--muted)" opacity="0.35">𝄞</text>${heads}</svg>`;
}

function renderHome(levelN) {
  if (levelN) { Store.data.viewLevel = levelN; Store.save(); }
  const cur = currentLevel();
  const shown = levelByN(Store.data.viewLevel || cur) || levelByN(cur);
  const open = levelUnlocked(shown.n);
  const doneN = shown.units.filter(u => unitDone(u.id)).length;
  const due = dueCards().length, nx = nextUnit();
  const today = Store.data.history[todayStr()];
  const dailyDone = today && today.done;
  const micLine = Mic.state === 'on' ? '<b>The mic is on.</b> Sing or play and the app follows.' : (Mic.state === 'blocked' || Mic.state === 'unsupported') ? `<b>The mic isn’t available on this page.</b> Everything works with the keys in the dock, your computer keyboard (A to K) or a MIDI keyboard. To use the mic, open the standalone version from your own site or localhost.` : '<b>Use the mic, the keys, or both.</b> Turn on the mic in the dock to sing or play a real instrument; tap the keys or use A to K otherwise.';
  const chip = levelPassed(shown.n) ? '<span class="chip done">Level passed</span>' : open ? `<span class="chip live">${doneN} of ${shown.units.length} done</span>` : '<span class="chip">Locked</span>';
  view.innerHTML = `
  ${beginnerDone() ? (() => { const nextSec = LEVELS.find(l => l.section === 'Intermediate'); return `<section class="panel grad"><div class="eyebrow">Beginner section complete</div><h2>You finished all five beginner levels.</h2><p>${nextSec ? `The intermediate section is open: Level ${nextSec.n}, <b>${nextSec.title}</b>, turns what you know into composing, ear training and arranging.` : 'Keep your Daily Set going: the review deck keeps every scale, chord and progression fresh while the next section is planned.'}</p></section>`; })() : ''}
  <div class="grid-2">
    <section class="panel today">
      <div class="eyebrow">Today · ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
      <h2>${dailyDone ? 'Daily Set done. See you tomorrow.' : 'Your Daily Set is ready'}</h2>
      <p class="lead">Ten minutes in six steps: tune in, review what is due, learn one new thing, make something, train your ear, and see today’s 1% gain.</p>
      <div class="row"><button type="button" class="btn primary" data-act="daily">${dailyDone ? 'Do another round' : 'Start the Daily Set'}</button>${nx ? `<button type="button" class="btn" data-act="next">${nx.boss ? 'Take the Level ' + nx.level + ' boss' : 'Jump to ' + (nx.create ? nx.title : nx.id + ' ' + nx.title)}</button>` : ''}</div>
      <div class="mic-note"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><span>${micLine}</span></div>
    </section>
    <section class="stats" aria-label="Progress">
      <div class="stat"><b>${Store.data.streak.count}</b><span>day streak</span></div>
      <div class="stat"><b>${due}</b><span>cards due</span></div>
      <div class="stat"><b>${Store.data.sketches.length}</b><span>sketches</span></div>
      <div class="stat"><b>${cur}/${LEVELS.length}</b><span>level reached</span></div>
      <div class="stat"><b>${masteredCount()}</b><span>cards mastered</span></div>
      <div class="stat"><b>${Store.data.range ? noteName(Store.data.range.zl) + '–' + noteName(Store.data.range.zh) : '—'}</b><span>voice home zone</span></div>
    </section>
  </div>
  ${isIntermediate() ? weekPanel() : ''}
  <div class="level-sections">${SECTIONS.filter(sec => sectionLevels(sec).length).map(sec => `<div class="level-section"><div class="eyebrow">${sec}</div><nav class="level-tabs" aria-label="${sec} levels">${sectionLevels(sec).map(l => `<button type="button" data-level="${l.n}" aria-current="${l.n === shown.n ? 'true' : 'false'}" class="${levelPassed(l.n) ? 'passed' : levelUnlocked(l.n) ? 'open' : 'locked'}"><span class="mono">${l.n}</span><span class="t">${l.title}</span>${levelPassed(l.n) ? '<span class="st">✓</span>' : levelUnlocked(l.n) ? '' : '<span class="st" aria-label="locked">🔒</span>'}</button>`).join('')}</nav></div>`).join('')}</div>
  <section class="panel">
    <div class="level-head"><div><div class="eyebrow">${shown.section} · Level ${shown.n}</div><h2>${shown.title}</h2><p class="tagline">${shown.tagline || ''}</p></div>${chip}</div>
    ${open ? '' : `<div class="locked-note"><span>Pass the Level ${shown.n - 1} boss to open this level. Already know Level ${shown.n - 1}? The boss is also the way to test out.</span><button type="button" class="btn small" data-boss="${shown.n - 1}">Level ${shown.n - 1} boss</button></div>`}
    <div class="staff-wrap">${pathSVG(shown)}</div>
    <div class="units">${shown.units.map(u => {
      const st = unitDone(u.id) ? '<span class="chip done">Done</span>' : (open && nx && nx.id === u.id ? '<span class="chip next">Next</span>' : '');
      return `<button type="button" class="unit${u.boss ? ' boss' : ''}" ${open ? `data-u="${u.id}"` : 'disabled'}><span class="top-line"><span class="num">${unitLabel(u)}</span>${st}</span><h3>${u.title}</h3><p>${u.blurb}</p></button>`;
    }).join('')}</div>
  </section>`;
  view.querySelector('[data-act="daily"]').onclick = () => go('daily');
  const lmb = view.querySelector('[data-act="map"]'); if (lmb) lmb.onclick = () => go('listen', lmb.dataset.id);
  const pkb = view.querySelector('[data-act="pick"]'); if (pkb) pkb.onclick = () => go('sketchbook', 'pick');
  const nb = view.querySelector('[data-act="next"]'); if (nb) nb.onclick = () => go('lesson', nx.id);
  view.querySelectorAll('[data-level]').forEach(b => { b.onclick = () => renderHome(+b.dataset.level); });
  const bb = view.querySelector('[data-boss]'); if (bb) bb.onclick = () => go('lesson', bb.dataset.boss + '.B');
  view.querySelectorAll('[data-u]').forEach(b => {
    const open = () => go('lesson', b.dataset.u);
    b.addEventListener('click', open);
    b.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); } });
  });
}

/* this week: the Listening Map and the Portfolio pick */
function weekPanel() {
  const m = listeningThisWeek(), heard = m && Store.data.listening && Store.data.listening[m.id], pk = weekPick();
  return `<section class="panel week"><div class="eyebrow">This week</div><div class="week-items">
    <div class="week-item"><span class="eyebrow">Listening Map</span>${m ? `<h3>${esc(m.song)} <span class="muted">· ${esc(m.artist)}</span></h3><p class="muted small">${esc(m.topic)}${heard && heard.at >= weekKey() ? ` · heard: ${heard.right} of ${heard.of}` : ''}</p><button type="button" class="btn small" data-act="map" data-id="${m.id}">${heard && heard.at >= weekKey() ? 'Listen again' : 'Open the map'}</button>` : '<p class="muted small">Your first map opens with the first unit that has one.</p>'}</div>
    <div class="week-item"><span class="eyebrow">Portfolio pick</span>${pk ? `<h3>★ ${esc(pk.title)}</h3><p class="muted small">${esc(pk.why)}</p>` : `<p class="muted small">Choose the best sketch you made this week, give it a title and say why. It becomes a seed for your next project.</p>`}<button type="button" class="btn small" data-act="pick">${pk ? 'Change the pick' : 'Pick this week’s best'}</button></div>
  </div></section>`;
}
const weekPick = () => (Store.data.picks || []).find(x => x.week === weekKey());
function renderListen(id) {
  view.innerHTML = `<section class="panel"><div class="lesson-head"><div><div class="eyebrow">This week</div><h1>Listening Map</h1></div><button type="button" class="btn ghost small" data-act="exit">← Home</button></div><div class="stage"><div class="task"></div><div class="stepnav"><span></span><button type="button" class="btn primary" data-act="done" hidden>Done</button></div></div></section>`;
  view.querySelector('[data-act="exit"]').onclick = () => go('home');
  const dn = view.querySelector('[data-act="done"]'); dn.onclick = () => go('home');
  cleanup = Tasks.listeningMap(view.querySelector('.task'), id ? { id } : {}, () => { dn.hidden = false; });
}

function renderLesson(id) {
  const u = unitById(id);
  runLesson(u, view, unit => showComplete(unit), () => go('home'));
}
function showComplete(unit) {
  const lv = levelByN(unit.level), after = levelByN(unit.level + 1);
  const nx = nextUnit(unit.level) || (unit.boss && after ? after.units[0] : null);
  const cards = (CARD_DEFS[unit.id] || []).length;
  const endsSection = unit.boss && lv.n === SECTION_LAST[lv.section];
  const big = unit.boss ? (endsSection ? `${lv.section} section complete.` : `Level ${unit.level} passed.`) : unit.title + ': done.';
  const body = cards ? `${cards} review card${cards > 1 ? 's' : ''} joined your deck. They come back on a growing schedule: tomorrow, then 3, 7, 14 and 30 days.` : (unit.doneText || (unit.create ? 'Saved to your sketchbook.' : unit.workshop ? 'Your workshop sketch is in your sketchbook.' : 'Nice work.'));
  const coming = !after && PLANNED_LEVELS[unit.level + 1] ? ` Level ${unit.level + 1}, <b>${PLANNED_LEVELS[unit.level + 1]}</b>, is on its way; your Daily Set keeps everything sharp until then.` : '';
  const pass = unit.boss ? `<p>${lv.passText || ''}${after ? ` ${after.section !== lv.section ? `The ${after.section.toLowerCase()} section starts now: Level ${after.n}` : `Level ${after.n}`}, <b>${after.title}</b>, is open.` : coming}</p>` : '';
  view.innerHTML = `<section class="panel done-card"><div class="eyebrow">${unit.boss ? 'Level ' + unit.level : unit.create ? 'Create' : 'Unit ' + unit.id} complete</div><div class="big">${big}</div><p>${body}</p>${pass}<div class="row">${nx ? `<button type="button" class="btn primary" data-act="next">${nx.boss ? 'Level ' + nx.level + ' boss' : 'Next: ' + nx.title}</button>` : ''}<button type="button" class="btn" data-act="home">Level ${nx ? nx.level : unit.level} path</button></div></section>`;
  const nb = view.querySelector('[data-act="next"]'); if (nb) nb.onclick = () => go('lesson', nx.id);
  view.querySelector('[data-act="home"]').onclick = () => go('home', nx ? nx.level : unit.level);
  paintStreak();
}

/* ---------- Daily Set ---------- */
const DAILY = ['Tune-in', 'Review', 'New bite', 'Create', 'Ear spark', 'Today’s 1%'];
/* intermediate order: the Ear Gym comes before the day's 8 bars */
const DAILY_I = ['Tune-in', 'Review', 'New bite', 'Ear Gym', '8 Bars', 'Today’s 1%'];
function renderDaily() {
  let s = 0;
  const inter = isIntermediate(), LABELS = inter ? DAILY_I : DAILY;
  view.innerHTML = `<section class="panel"><div class="lesson-head"><div><div class="eyebrow">Daily Set · about 10 minutes</div><h1>Today’s practice</h1></div><button type="button" class="btn ghost small" data-act="exit">← Home</button></div><div class="strip">${LABELS.map(d => `<div>${d}</div>`).join('')}</div><div class="stage"></div></section>`;
  const stage = view.querySelector('.stage'), strip = view.querySelectorAll('.strip div');
  view.querySelector('[data-act="exit"]').onclick = () => go('home');
  const day = Store.day();
  function frame(title, sub) {
    strip.forEach((d, i) => { d.classList.toggle('on', i === s); d.classList.toggle('past', i < s); });
    stage.innerHTML = `<div class="tag">${LABELS[s]} · ${s + 1} of ${LABELS.length}</div><h2>${title}</h2>${sub ? `<p class="lead">${sub}</p>` : ''}<div class="task"></div><div class="stepnav"><button type="button" class="skip" data-act="skip">Skip</button><button type="button" class="btn primary" data-act="next" disabled>Next</button></div>`;
    const next = stage.querySelector('[data-act="next"]');
    const advance = () => { runCleanup(); s++; steps[s](); };
    next.onclick = advance; stage.querySelector('[data-act="skip"]').onclick = advance;
    return { body: stage.querySelector('.task'), ready: () => { next.disabled = false; } };
  }
  const steps = [
    function tune() {
      /* a level can bring its own tune-in: tune: { title, sub, task, params } */
      const tl = levelByN(currentLevel()), tn = inter && tl && tl.tune && Tasks[tl.tune.task] ? tl.tune : null;
      if (tn && Math.random() < (tn.share == null ? 0.5 : tn.share)) { const f = frame(tn.title, tn.sub || ''); cleanup = Tasks[tn.task](f.body, Object.assign({}, typeof tn.params === 'function' ? tn.params() : tn.params), () => f.ready()); return; }
      if (inter) { const f = frame('Tune in over a drone', 'The drone sets the key. Sing or play the three degrees it asks for, in any octave.'); cleanup = Tasks.droneTune(f.body, {}, () => f.ready()); return; }
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
      const f = frame(practice ? (unlocked.length ? 'Nothing due: a quick warm-up' : 'Your review deck is empty') : `${due.length} card${due.length > 1 ? 's' : ''} due`, unlocked.length ? 'Answer by playing, singing or choosing. Speed counts toward mastery.' : 'Cards join the deck as you finish units. The first lesson adds the first card.');
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
        cleanup = CARD_TYPES[c.type](holder, c, fin);
      }
      show();
    },
    function newBite() {
      const nx = nextUnit();
      const f = frame(nx ? (nx.boss ? `Level ${nx.level} boss challenge` : `Up next: ${nx.title}`) : 'Every level complete', nx ? nx.blurb : 'You have finished every unit built so far. Your review deck and Ear Gym keep the skills sharp.');
      if (!nx) { f.ready(); return; }
      f.body.innerHTML = `<button type="button" class="btn primary" data-act="open">Start ${nx.boss ? 'the boss challenge' : nx.create ? nx.title : 'unit ' + nx.id}</button>`;
      f.body.querySelector('[data-act="open"]').onclick = () => {
        const host = document.createElement('div'); f.body.innerHTML = ''; f.body.appendChild(host);
        runLesson(nx, host, unit => { host.innerHTML = `<p class="fb good">${unit.title}: done. ${(CARD_DEFS[unit.id] || []).length ? 'New review cards joined your deck.' : ''}</p>`; f.ready(); }, () => { host.innerHTML = `<p class="fb info">Lesson paused. You can pick it up from the Level ${nx.level} path.</p>`; f.ready(); });
      };
    },
    function create() {
      const lv = levelByN(currentLevel()), cr = lv.create || levelByN(1).create;
      const f = inter ? frame('8 bars a day', 'One constraint, eight bars, a few minutes. Quantity first: quality follows. It goes in your sketchbook.') : frame('Make something', 'Two minutes, one small constraint. Everything you save goes in your sketchbook.');
      cleanup = Tasks[cr.task || 'motif'](f.body, Object.assign({ prompt: rand(cr.prompts), level: lv.n }, cr.params), () => f.ready());
    },
    function ear() {
      if (inter) { const f = frame('Ear Gym', 'Five rounds of your weakest ear skill. It gets harder as you get better.'); cleanup = EarGym.run(f.body, (ok, total) => { day.earOk += ok; day.earN += total; Store.save(); f.ready(); }); return; }
      let n = currentLevel(); while (n > 1 && !(levelByN(n) && levelByN(n).ear)) n--;
      const e = levelByN(n).ear;
      const f = frame(e.title, e.sub);
      cleanup = e.run(f.body, (ok, total) => { day.earOk += ok; day.earN += total; Store.save(); f.ready(); });
    },
    function onePercentStep() {
      day.done = true; bumpStreak(); Store.save(); paintStreak();
      const f = frame('Today’s 1%', '');
      const msg = onePercentMessage();
      f.body.innerHTML = `<div class="one-percent">${msg.big}</div><p>${msg.small}</p><p class="eyebrow" style="margin-top:12px">${Store.data.streak.count} day streak · ${dueCards().length} cards due now</p>`;
      const nb = stage.querySelector('[data-act="next"]'); nb.disabled = false; nb.textContent = 'Done'; nb.onclick = () => go('home');
      stage.querySelector('[data-act="skip"]').hidden = true;
      strip.forEach(d => { d.classList.remove('on'); d.classList.add('past'); });
    }
  ];
  /* steps by name, then in the section's order */
  const byName = { tune: steps[0], review: steps[1], bite: steps[2], create: steps[3], ear: steps[4], done: steps[5] };
  steps.length = 0;
  (inter ? ['tune', 'review', 'bite', 'ear', 'create', 'done'] : ['tune', 'review', 'bite', 'create', 'ear', 'done']).forEach(k => steps.push(byName[k]));
  steps[0]();
}
function onePercentMessage() {
  const h = Store.data.history, t = todayStr();
  const today = h[t];
  const prevDays = Object.keys(h).filter(d => d < t).sort();
  const prev = prevDays.length ? h[prevDays[prevDays.length - 1]] : null;
  const speed = x => x && x.revMs && x.revMs.length ? mean(x.revMs) / 1000 : null;
  const acc = (o, n) => n ? o / n : null;
  if (today && today.wins && today.wins.length) return today.wins[today.wins.length - 1];
  if (prev) {
    const s0 = speed(prev), s1 = speed(today);
    if (s0 && s1 && s1 < s0) return { big: `${s0.toFixed(1)} s → ${s1.toFixed(1)} s`, small: 'Average time per review card, last session vs today. Faster recall is what mastery looks like.' };
    const e0 = acc(prev.earOk, prev.earN), e1 = acc(today.earOk, today.earN);
    if (e0 != null && e1 != null && e1 > e0) return { big: `${Math.round(e0 * 100)}% → ${Math.round(e1 * 100)}%`, small: isIntermediate() ? 'Ear Gym accuracy, last session vs today.' : 'Ear spark accuracy, last session vs today.' };
    const u0 = acc(prev.tuneOk, prev.tuneN), u1 = acc(today.tuneOk, today.tuneN);
    if (u0 != null && u1 != null && u1 > u0) return { big: `${Math.round(u0 * 100)}% → ${Math.round(u1 * 100)}%`, small: 'Notes matched on the first try, last session vs today.' };
    const bars = barsThisWeek();
    if (bars) return { big: `${bars} bar${bars > 1 ? 's' : ''} this week`, small: 'Bars of music you wrote in the last 7 days. Quantity first; quality follows.' };
    return { big: 'Steady', small: 'No number beat last time today, and that is normal. Spaced practice dips before it climbs.' };
  }
  const s1 = speed(today);
  return { big: s1 ? `${s1.toFixed(1)} s per card` : 'Day one', small: s1 ? 'Your first review speed. Tomorrow’s Daily Set compares against it.' : 'Your first Daily Set is done. From tomorrow, this step shows one number that improved.' };
}

/* review card bodies (Level 1); later levels register their own types */
CARD_TYPES.choice = (el, c, fin) => Tasks.choice(el, c, fin);
CARD_TYPES.play = (el, c, fin) => cardPlay(el, c, fin);
CARD_TYPES.step = (el, c, fin) => cardStep(el, c, fin);
CARD_TYPES.nameBlack = (el, c, fin) => cardBlack(el, c, fin);
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
/* what stage of growth a sketch is at, from the level that made it */
const sketchKind = s => s.version === 2 ? 'version 2' : s.project ? 'project draft' : ({ 1: 'motif', 2: 'phrase', 3: 'with chords', 4: 'minor', 5: '8-bar piece', 6: 'theme', 7: 'colour study', 8: 'voices', 9: 'chromatic', 10: 'song' })[s.level] || 'idea';
const rubricSum = r => r && r.scores ? Object.values(r.scores).reduce((a, b) => a + b, 0) + ' of ' + Object.keys(r.scores).length * 2 : '';
/* notation for a sketch: its score if it has one, else its notes on a staff */
function sketchArt(s) {
  try {
    if (s.score && s.score.events) return `<div class="nt-box">${Score.svg(s.score.events, { meter: s.score.meter, keySig: s.score.keySig || 0 })}</div>`;
    if (typeof VoiceView !== 'undefined' && s.voices) return `<div class="vv-box">${VoiceView.svg({ voices: s.voices, labels: s.romans, style: s.style, key: s.key })}</div>`;
    if (s.notes && s.notes.length) return `<div class="nt-box">${Staff.svg({ clef: 'treble', notes: s.notes.slice(0, 32).map(n => Theory.fromMidi(n.m)) })}</div>`;
  } catch (e) { /* fall through */ }
  return '<p class="muted small">No notation for this one.</p>';
}
/* arg 'pick' opens the Portfolio pick form */
function renderSketchbook(arg) {
  const list = Store.data.sketches, picks = Store.data.picks || (Store.data.picks = []);
  const tags = {};
  list.forEach(s => (s.tags || []).forEach(t => { tags[t] = (tags[t] || 0) + 1; }));
  const tagList = Object.keys(tags).sort((a, b) => tags[b] - tags[a] || (a < b ? -1 : 1));
  const filt = Store.data.settings.portfolioTag || '';
  const shown = filt === '★' ? list.filter(s => picks.some(p => p.id === s.id)) : filt ? list.filter(s => (s.tags || []).indexOf(filt) >= 0) : list;
  const inter = isIntermediate(), week = weekKey(), thisWeek = list.filter(s => s.created >= week), pk = weekPick();
  const pickOf = s => picks.filter(p => p.id === s.id).slice(-1)[0];
  view.innerHTML = `<section class="panel"><div class="level-head"><div><div class="eyebrow">${inter ? 'Portfolio' : 'Sketchbook'}</div><h2>Your musical ideas</h2></div><span class="chip">${list.length} saved</span></div>
    <p style="color:var(--muted);margin-top:8px;max-width:60ch">${inter ? 'Every sketch, theme and project you save lives here, tagged with the techniques it uses. Each week, pick your best one: it becomes a seed for the next project. Saved in this browser.' : 'Every idea you save lives here. One idea grows through the levels: a motif, then a phrase, then a phrase with chords, a minor version, and finally an 8-bar piece. Saved in this browser.'}</p>
    ${inter || picks.length ? `<div class="pick-box${arg === 'pick' ? ' open' : ''}"><div class="eyebrow">Pick of the week</div>${pk && arg !== 'pick' ? `<p><b>★ ${esc(pk.title)}</b> · ${esc(pk.why)} <button type="button" class="btn small ghost" data-act="repick">Change</button></p>` : thisWeek.length ? `<div class="pick-form"><label class="sel" for="pk-s"><span>This week’s sketch</span><select id="pk-s">${thisWeek.map(s => `<option value="${s.id}"${pk && pk.id === s.id ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label><div class="field"><label for="pk-t">Its title</label><input id="pk-t" type="text" maxlength="40" value="${esc(pk ? pk.title : thisWeek[0].name)}"></div><div class="field"><label for="pk-w">Why it is your best, in one sentence</label><input id="pk-w" type="text" maxlength="140" value="${esc(pk ? pk.why : '')}"></div><div class="row"><button type="button" class="btn primary small" data-act="savepick" disabled>Make it the pick</button></div></div>` : '<p class="muted small">Nothing saved this week yet. Make something in the Daily Set’s 8 Bars, then pick it here.</p>'}</div>` : ''}
    ${tagList.length ? `<div class="choices tag-filter" role="group" aria-label="Filter by technique"><button type="button" class="choice" data-tag="" aria-pressed="${!filt}">All</button>${picks.length ? `<button type="button" class="choice" data-tag="★" aria-pressed="${filt === '★'}">★ Picks</button>` : ''}${tagList.map(t => `<button type="button" class="choice" data-tag="${esc(t)}" aria-pressed="${filt === t}">${esc(t)} <small>${tags[t]}</small></button>`).join('')}</div>` : ''}
    <div class="sketches" style="margin-top:16px">${shown.length ? shown.map(s => { const pkd = pickOf(s); return `<div class="sketch" data-id="${s.id}"><div><h3>${pkd ? '★ ' : ''}${esc(pkd ? pkd.title : s.name)}</h3><div class="meta"><span class="chip">${sketchKind(s)}</span>${s.level ? ` <span class="chip">Level ${s.level}</span>` : ''} ${(s.tags || []).map(t => `<span class="chip tag">${esc(t)}</span>`).join(' ')} ${s.score ? '' : (s.notes || []).slice(0, 16).map(n => SHARP[mod12(n.m)]).join(' · ')}${s.chords && s.chords.length ? ' · chords ' + s.chords.slice(0, 12).map(c => Theory.pretty(c.sym)).join(' ') + (s.chords.length > 12 ? ' …' : '') : ''}${s.key ? ' · ' + esc(s.key) : ''} · ${s.created}${s.prompt ? ' · ' + esc(s.prompt) : ''}${s.from && list.some(x => x.id === s.from) ? ' · grew from “' + esc(list.find(x => x.id === s.from).name) + '”' : ''}${s.review ? ' · rubric ' + rubricSum(s.review) : ''}${s.compare ? ' · ' + (s.compare.winner === s.id ? 'judged stronger than the draft' : 'the draft stayed stronger') : ''}${pkd ? ' · ' + esc(pkd.why) : ''}</div><div class="sk-art" hidden></div></div><div class="row"><button type="button" class="btn small" data-act="play">▶ Play</button><button type="button" class="btn small ghost" data-act="see">Notation</button>${typeof MidiFile !== 'undefined' ? '<button type="button" class="btn small ghost" data-act="midi">MIDI</button>' : ''}<span class="del"><button type="button" class="btn small ghost" data-act="del">Delete</button></span></div></div>`; }).join('') : list.length ? '<p class="muted">No sketches with this tag.</p>' : '<div class="empty-state"><b>No sketches yet.</b><span>Your first one comes from the “Your first motif” stop on the Level 1 path, or the Create step of any Daily Set.</span><button type="button" class="btn primary" data-act="motif">Make a motif now</button></div>'}</div></section>`;
  const mk = view.querySelector('[data-act="motif"]'); if (mk) mk.onclick = () => go('lesson', '1.M');
  view.querySelectorAll('[data-tag]').forEach(b => { b.onclick = () => { Store.data.settings.portfolioTag = b.dataset.tag; Store.save(); renderSketchbook(); }; });
  const rp = view.querySelector('[data-act="repick"]'); if (rp) rp.onclick = () => renderSketchbook('pick');
  const sp = view.querySelector('[data-act="savepick"]');
  if (sp) {
    const t = view.querySelector('#pk-t'), wy = view.querySelector('#pk-w'), sel = view.querySelector('#pk-s');
    const ok = () => { sp.disabled = !t.value.trim() || !wy.value.trim(); };
    t.oninput = ok; wy.oninput = ok; sel.onchange = () => { const x = list.find(y => y.id === sel.value); if (x && !pk) t.value = x.name; ok(); }; ok();
    sp.onclick = () => {
      Store.data.picks = picks.filter(p => p.week !== week).concat([{ week, id: sel.value, title: t.value.trim(), why: wy.value.trim(), at: todayStr() }]);
      Store.day().wins.push({ big: '★ ' + t.value.trim(), small: 'Your pick of the week. Choosing your best work, and saying why, trains the ear you write with. It is first in line as a seed for your next project.' });
      Store.save(); renderSketchbook();
    };
  }
  /* a sketch playing with its band stops when you leave */
  cleanup = () => { if (typeof stopSketch === 'function') stopSketch(); };
  view.querySelectorAll('.sketch').forEach(row => {
    const s = list.find(x => x.id === row.dataset.id);
    row.querySelector('[data-act="play"]').onclick = () => { if (typeof stopSketch === 'function') stopSketch(); playSketch(s); };
    const art = row.querySelector('.sk-art');
    row.querySelector('[data-act="see"]').onclick = () => { if (art.hidden) art.innerHTML = sketchArt(s); art.hidden = !art.hidden; };
    const mb = row.querySelector('[data-act="midi"]'); if (mb) mb.onclick = () => MidiFile.download(s);
    const del = row.querySelector('.del');
    row.querySelector('[data-act="del"]').onclick = () => {
      del.innerHTML = '<span class="confirm">Delete for good? <button type="button" class="btn small" data-act="yes">Delete</button><button type="button" class="btn small ghost" data-act="no">Keep</button></span>';
      del.querySelector('[data-act="yes"]').onclick = () => { Store.data.sketches = Store.data.sketches.filter(x => x.id !== s.id); Store.data.picks = (Store.data.picks || []).filter(x => x.id !== s.id); Store.save(); renderSketchbook(); };
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
