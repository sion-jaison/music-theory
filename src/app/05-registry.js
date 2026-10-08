/* =================================================================
   Level registry
   Each level file calls addLevel({...}). Everything that lists units,
   unlocks levels or picks Daily Set content reads from LEVELS.
   ================================================================= */
const LEVELS = [];
/* the creative arc every unit follows; each lesson step is tagged with one of these */
const ARC = ['Hear', 'Echo', 'Explore', 'Name', 'Create'];
/* review cards by unit id: finishing the unit adds them to the deck */
const CARD_DEFS = {};
/* how a review card is shown, by card.type: (el, card, fin(ok)) → cleanup */
const CARD_TYPES = {};

/* levels 1–5 are the beginner section, 6–10 the intermediate section */
const SECTIONS = ['Beginner', 'Intermediate'];
function addLevel(lv) {
  lv.section = lv.section || (lv.n <= 5 ? 'Beginner' : 'Intermediate');
  lv.units.forEach(u => { u.level = lv.n; });
  LEVELS.push(lv);
  LEVELS.sort((a, b) => a.n - b.n);
  if (lv.cards) Object.assign(CARD_DEFS, lv.cards);
}
const levelByN = n => LEVELS.find(l => l.n === n);
