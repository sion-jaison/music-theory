/* =================================================================
   Lesson runner
   ================================================================= */
let cleanup = null;
function runCleanup() { if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; } Keyboard.clearMarks(); }

/* Boss steps cannot be skipped: the boss is what opens the next level. Task params may be a function, called each time the step opens. */
function runLesson(unit, host, onFinish, onExit) {
  let i = 0, stepDone = false;
  host.innerHTML = `<section class="panel"><div class="lesson-head"><div><div class="eyebrow">Level ${unit.level} · ${unit.boss ? 'Boss' : unit.create ? 'Create' : 'Unit ' + unit.id}</div><h1>${unit.title}</h1></div><button type="button" class="btn ghost small" data-act="exit">← Level ${unit.level} path</button></div><div class="arc">${ARC.map(a => `<span data-a="${a}">${a}</span>`).join('')}</div><div class="stage"></div></section>`;
  const stage = host.querySelector('.stage'), arc = host.querySelectorAll('.arc span');
  host.querySelector('[data-act="exit"]').onclick = () => { runCleanup(); onExit(); };
  function show() {
    runCleanup(); stepDone = false;
    const s = unit.steps[i];
    const seen = new Set(unit.steps.slice(0, i).map(x => x.tag));
    arc.forEach(a => { a.classList.toggle('on', a.dataset.a === s.tag); a.classList.toggle('past', seen.has(a.dataset.a) && a.dataset.a !== s.tag); });
    stage.innerHTML = `<div class="tag">${s.tag} · step ${i + 1} of ${unit.steps.length}</div>${s.title ? `<h2>${s.title}</h2>` : ''}<div class="task"></div><div class="stepnav"><span>${s.k === 'task' && !unit.boss ? '<button type="button" class="skip" data-act="skip">Skip this step</button>' : ''}</span><button type="button" class="btn primary" data-act="next">${i === unit.steps.length - 1 ? 'Finish' : 'Next'}</button></div>`;
    const body = stage.querySelector('.task'), next = stage.querySelector('[data-act="next"]');
    if (s.k === 'card') { cleanup = Tasks.card(body, s); stepDone = true; }
    else { next.disabled = true; cleanup = Tasks[s.type](body, typeof s.p === 'function' ? s.p() : s.p, () => { stepDone = true; next.disabled = false; next.focus({ preventScroll: true }); }); }
    next.onclick = () => { if (!stepDone) return; i++; if (i >= unit.steps.length) finish(); else show(); };
    const sk = stage.querySelector('[data-act="skip"]'); if (sk) sk.onclick = () => { i++; if (i >= unit.steps.length) finish(); else show(); };
  }
  function finish() {
    runCleanup();
    Store.data.units[unit.id] = { done: true, at: todayStr() };
    unlockCards(unit.id);
    if (unit.boss && unit.level === 1) Store.data.bossPassed = true;
    Store.save();
    onFinish(unit);
  }
  show();
}
