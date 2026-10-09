/* =================================================================
   Boot
   ================================================================= */
function boot() {
  Store.load();
  Keyboard.mount(document.getElementById('kb'));
  mountReadout(document.getElementById('readout'));
  paintStreak();
  document.querySelectorAll('.nav button').forEach(b => { b.onclick = () => go(b.dataset.view); });
  document.getElementById('brand').onclick = () => go('home');
  const dock = document.querySelector('.dock');
  const setDock = () => document.documentElement.style.setProperty('--dock-h', dock.offsetHeight + 'px');
  setDock();
  if (window.ResizeObserver) new ResizeObserver(setDock).observe(dock);
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext)) Mic.set('unsupported');
  go('home');
}
/* a handle for tests and the browser console */
window.Motif = { Theory, Tasks, Staff, Circle, ChordIn, Store, Bus, Sound, Keyboard, LEVELS, CARD_DEFS, CARD_TYPES, go, chordTarget, chordHit,
  Drone, Motive, MOTIVE_TOOLS, EarGym, EAR_SKILLS, spellIn, degreeOf, contourShape, motiveEvents, saveSketch, Score, MelodyCapture };
/* intermediate song craft */
Object.assign(window.Motif, { ChordSheet, SheetHas, csPlay, addListeningMap, LISTENING_MAPS, listeningThisWeek, listeningOpen, weekKey, projectOf, sketchById, levelUnlocked });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
