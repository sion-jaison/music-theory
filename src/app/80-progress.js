/* =================================================================
   Progress: units, review deck, sketches, streak
   ================================================================= */
const unitById = id => UNITS.find(u => u.id === id);
const unitDone = id => !!(Store.data.units[id] && Store.data.units[id].done);
const nextUnit = () => UNITS.find(u => !unitDone(u.id));
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

function saveSketch(s) {
  const sk = { id: 's' + Date.now().toString(36), name: s.name, notes: s.notes, prompt: s.prompt || '', created: todayStr(), level: 1 };
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
