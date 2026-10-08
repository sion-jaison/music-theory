/* =================================================================
   Progress: units, review deck, sketches, streak
   ================================================================= */
const UNITS = LEVELS.reduce((a, l) => a.concat(l.units), []);
const unitById = id => UNITS.find(u => u.id === id);
const unitDone = id => !!(Store.data.units[id] && Store.data.units[id].done);
/* a level opens when the boss of the level before it is passed */
const levelUnlocked = n => n === 1 || unitDone((n - 1) + '.B');
const levelPassed = n => unitDone(n + '.B');
/* the furthest level the learner has opened */
function currentLevel() { let n = 1; LEVELS.forEach(l => { if (levelUnlocked(l.n)) n = l.n; }); return n; }
/* next unfinished unit: in level n if given, else in the current level */
function nextUnit(n) {
  const lv = levelByN(n || currentLevel());
  return lv ? lv.units.find(u => !unitDone(u.id)) : undefined;
}
const beginnerDone = () => LEVELS.length > 0 && levelPassed(LEVELS[LEVELS.length - 1].n);
const LADDER = [0, 1, 3, 7, 14, 30];
function unlockCards(unitId) {
  (CARD_DEFS[unitId] || []).forEach(c => { if (!Store.data.cards[c.id]) Store.data.cards[c.id] = { box: 0, due: todayStr(), n: 0, ok: 0 }; });
}
function allCardDefs() { return Object.values(CARD_DEFS).reduce((a, b) => a.concat(b), []); }
function dueCards() {
  const t = todayStr();
  return allCardDefs().filter(c => Store.data.cards[c.id] && Store.data.cards[c.id].due <= t);
}
function gradeCard(id, ok, ms) {
  const s = Store.data.cards[id]; if (!s) return;
  s.n++; if (ok) s.ok++;
  if (ok) { s.box = Math.min(LADDER.length - 1, s.box + 1); s.due = addDays(todayStr(), LADDER[s.box]); }
  else { s.box = 0; s.due = addDays(todayStr(), 1); }
  const day = Store.day(); day.revN++; if (ok) { day.revOk++; day.revMs.push(ms); }
}
function masteredCount() { return Object.values(Store.data.cards).filter(s => s.box >= LADDER.length - 1).length; }

/* a sketch is { name, notes: [{ m, t, d? }], prompt, level } plus optional chords: [{ sym, t, d }], key, bpm, from (id of the sketch it grew from) */
function saveSketch(s) {
  const sk = Object.assign({}, s, { id: 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), prompt: s.prompt || '', created: todayStr(), level: s.level || currentLevel() });
  Store.data.sketches.unshift(sk); Store.save(); paintStreak();
  return sk;
}

function bumpStreak() {
  const s = Store.data.streak, t = todayStr();
  if (s.last === t) return;
  if (!s.last) s.count = 1;
  else {
    const gap = daysBetween(s.last, t);
    if (gap === 1) s.count++;
    else if (gap === 2 && (!s.rest || daysBetween(s.rest, t) >= 7)) { s.count++; s.rest = addDays(t, -1); }
    else s.count = 1;
  }
  s.last = t;
}

/* Personal bests feed Today's 1%. lowerIsBetter for times. Returns true when this beats the old best. */
function recordBest(key, value, opts) {
  opts = opts || {};
  const b = Store.data.bests || (Store.data.bests = {});
  const prev = b[key];
  const better = prev == null || (opts.lowerIsBetter ? value < prev : value > prev);
  if (better) {
    b[key] = value;
    if (prev != null && opts.label) {
      const f = opts.format || (v => String(v));
      Store.day().wins.push({ big: `${f(prev)} → ${f(value)}`, small: opts.label });
    }
    Store.save();
  }
  return better;
}
