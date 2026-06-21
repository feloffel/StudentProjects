/* ============================================================
   music.js — ausklappbarer Hintergrund-Musik-Player.
   Spielt das in <audio id="musicAudio"> hinterlegte MP3.
   MP3 wechseln: Datei in assets/music/ ablegen und das src-Attribut
   (und ggf. den Titel) in index.html anpassen.
   ============================================================ */
(function () {
  function init() {
    const root = document.getElementById('musicPlayer');
    const audio = document.getElementById('musicAudio');
    if (!root || !audio) return;

    const toggle = document.getElementById('musicToggle');
    const closeBtn = document.getElementById('musicClose');
    const playBtn = document.getElementById('musicPlay');
    const seek = document.getElementById('musicSeek');
    const vol = document.getElementById('musicVol');
    const timeEl = document.getElementById('musicTime');
    const note = document.getElementById('musicNote');

    // Ausklappen / Einklappen
    toggle.addEventListener('click', () => root.classList.toggle('open'));
    if (closeBtn) closeBtn.addEventListener('click', () => root.classList.remove('open'));

    // Lautstärke
    if (vol) {
      audio.volume = vol.value / 100;
      vol.addEventListener('input', () => { audio.volume = vol.value / 100; });
    }

    // Play / Pause
    function setPlayIcon() { playBtn.textContent = audio.paused ? '▶' : '⏸'; }
    playBtn.addEventListener('click', () => {
      if (audio.paused) {
        const p = audio.play();
        if (p && p.catch) p.catch(() => {
          if (note) note.textContent = 'Konnte die Audiodatei nicht abspielen — liegt sie unter assets/music/ und stimmt der Dateiname?';
        });
      } else {
        audio.pause();
      }
    });
    audio.addEventListener('play', setPlayIcon);
    audio.addEventListener('pause', setPlayIcon);

    // Fortschritt + Zeit
    function fmt(t) {
      if (!isFinite(t)) return '0:00';
      const m = Math.floor(t / 60), s = Math.floor(t % 60);
      return m + ':' + String(s).padStart(2, '0');
    }
    audio.addEventListener('timeupdate', () => {
      if (seek && !seek.dragging && audio.duration) {
        seek.value = (audio.currentTime / audio.duration) * 100;
      }
      if (timeEl) timeEl.textContent = fmt(audio.currentTime);
    });
    if (seek) {
      seek.addEventListener('input', () => {
        seek.dragging = true;
        if (audio.duration) audio.currentTime = (seek.value / 100) * audio.duration;
      });
      seek.addEventListener('change', () => { seek.dragging = false; });
    }
    audio.addEventListener('error', () => {
      if (note) note.textContent = 'Keine Audiodatei gefunden. Lege eine MP3 unter assets/music/ ab und trage sie in index.html ein.';
    });

    setPlayIcon();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
