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
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
