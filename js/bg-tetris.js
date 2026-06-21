/* ============================================================
   HINTERGRUND-TETRIS (links & rechts) — von Kim Chi
   Fallende Tetrissteine als Dekoration in den Seitenrändern,
   mit originalgetreuen Farben. Auf schmalen Screens (<=820px)
   per CSS ausgeblendet.
   ============================================================ */
(function () {
  "use strict";

  function createBgTetris(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const cvs = document.createElement('canvas');
    container.appendChild(cvs);

    const rect = container.getBoundingClientRect();
    const w = rect.width || 120;
    const h = rect.height || window.innerHeight;
    cvs.width = w;
    cvs.height = h;
    const bgCtx = cvs.getContext('2d');

    // Original Tetris-Farben
    const COLORS = {
      I: '#2fc8ff', J: '#4f7cff', L: '#ff9f1f', O: '#ffd23d',
      S: '#3fd64a', T: '#ff3d9a', Z: '#ff5a3c'
    };

    const SHAPES = {
      I: [[1, 1, 1, 1]],
      J: [[1, 0, 0], [1, 1, 1]],
      L: [[0, 0, 1], [1, 1, 1]],
      O: [[1, 1], [1, 1]],
      S: [[0, 1, 1], [1, 1, 0]],
      T: [[0, 1, 0], [1, 1, 1]],
      Z: [[1, 1, 0], [0, 1, 1]]
    };

    const blockSize = 12;
    let drops = [];

    function spawnDrop() {
      const types = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
      const type = types[Math.floor(Math.random() * types.length)];
      const matrix = SHAPES[type].map(row => [...row]);
      const cols = matrix[0].length;
      const rows = matrix.length;
      const x = Math.floor(Math.random() * (Math.floor(w / blockSize) - cols));
      drops.push({ x, y: -rows, color: COLORS[type], speed: 0.2 + Math.random() * 0.4, matrix, rows, cols });
    }

    for (let i = 0; i < 6; i++) spawnDrop();

    function drawBg() {
      bgCtx.clearRect(0, 0, w, h);

      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.y += d.speed;

        for (let r = 0; r < d.rows; r++) {
          for (let c = 0; c < d.cols; c++) {
            if (d.matrix[r] && d.matrix[r][c]) {
              const px = (d.x + c) * blockSize;
              const py = (d.y + r) * blockSize;
              bgCtx.fillStyle = d.color;
              bgCtx.fillRect(px, py, blockSize - 1, blockSize - 1);
              bgCtx.fillStyle = 'rgba(255,255,255,0.08)';
              bgCtx.fillRect(px, py, blockSize - 1, 2);
              bgCtx.fillStyle = 'rgba(0,0,0,0.10)';
              bgCtx.fillRect(px, py + blockSize - 3, blockSize - 1, 2);
            }
          }
        }

        if (d.y * blockSize > h + 20) drops.splice(i, 1);
      }

      if (drops.length < 8 && Math.random() < 0.025) spawnDrop();

      requestAnimationFrame(drawBg);
    }

    drawBg();

    window.addEventListener('resize', () => {
      const newRect = container.getBoundingClientRect();
      const newW = newRect.width || 120;
      const newH = newRect.height || window.innerHeight;
      if (cvs.width !== newW || cvs.height !== newH) {
        cvs.width = newW;
        cvs.height = newH;
      }
    });
  }

  // etwas verzögert, damit das Layout steht
  setTimeout(() => {
    createBgTetris('bgLeft');
    createBgTetris('bgRight');
  }, 100);
})();
