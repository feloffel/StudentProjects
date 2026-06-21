/* ============================================================
   game-init.js — verbindet Lukas' Spiel (createTetris) mit der Seite:
   - Start-Overlay (kein Auto-Start)
   - Pause-Button IM Spielfeld (oben rechts) + klickbares "Fortsetzen"-Overlay
   - Auto-Pause beim Wegscrollen / Tab-Wechsel MIT Overlay; fortgesetzt wird
     NUR manuell (Klick auf das Overlay oder den Pause-Button)
   - Touch-/Klick-Steuerung
   Wird auf der Doku-Seite und auf spiel.html eingebunden.
   ============================================================ */
(function () {
  function init() {
    const canvas = document.getElementById('game');
    if (!canvas || typeof window.createTetris !== 'function') return;

    const ctl = window.createTetris();
    const startBtn = document.getElementById('game-start');
    const pauseBtn = document.getElementById('game-pause');
    const pauseOverlay = document.getElementById('game-pause-overlay');
    let started = false;

    function showPaused(on) {
      if (pauseOverlay) pauseOverlay.style.display = on ? 'flex' : 'none';
      if (pauseBtn) pauseBtn.style.display = (started && !on) ? 'block' : 'none';
    }

    function begin() {
      if (started) return;
      started = true;
      ctl.start();
      if (startBtn) startBtn.style.display = 'none';
      showPaused(false);
    }
    function doPause() {
      if (!started || ctl.isGameOver() || !ctl.isRunning()) return;
      ctl.pause();
      showPaused(true);
    }
    function doResume() {
      if (!started || ctl.isGameOver()) return;
      ctl.resume();
      showPaused(false);
    }

    if (startBtn) startBtn.addEventListener('click', begin);
    if (pauseBtn) pauseBtn.addEventListener('click', doPause);
    if (pauseOverlay) pauseOverlay.addEventListener('click', doResume);
    showPaused(false); // Grundzustand: nichts sichtbar, bis gestartet wird

    // --- Touch-/Klick-Steuerung ---
    const MAP = {
      't-left': 'moveLeft', 't-right': 'moveRight', 't-down': 'moveDown',
      't-rotate': 'rotate', 't-drop': 'hardDrop', 't-restart': 'restart',
    };
    Object.entries(MAP).forEach(([id, type]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const press = (e) => {
        e.preventDefault();
        begin();
        if (!ctl.isRunning()) return; // pausiert: keine Eingaben
        ctl.inject(type);
      };
      const rel = () => ctl.release(type);
      el.addEventListener('pointerdown', press);
      el.addEventListener('pointerup', rel);
      el.addEventListener('pointerleave', rel);
      el.addEventListener('pointercancel', rel);
    });

    // --- Auto-Pause beim Wegscrollen (kein Auto-Resume) ---
    function isInView() {
      const r = canvas.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const visible = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      return (visible / Math.min(r.height || 1, vh)) > 0.4;
    }
    let lastCheck = 0;
    function onScroll() {
      const now = Date.now();
      if (now - lastCheck < 60) return;
      lastCheck = now;
      if (started && ctl.isRunning() && !isInView()) doPause();
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') doPause();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
