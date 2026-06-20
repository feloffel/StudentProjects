/* =========================================================================
   TETRIS  —  an die Website angepasste Fassung
   Basiert auf dem MIT-lizenzierten Klon in javascript-tetris-main/
   (Hovhannes Hovhannisyan). Angepasst: Farben/Schrift/Texte im Seitenstil,
   Steuerung auf das fokussierte Spielfeld begrenzt, deutscher Text,
   Start per Button statt Auto-Init.
   ========================================================================= */
(() => {
  "use strict";

  class Controller {
    static #KEY_CODES = { ENTER: 13, SPACE: 32, LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40 };
    static #INITIAL_SPEED = 1000;
    static #SPEED_DECREASE_PER_LEVEL = 100;
    static #MINIMUM_SPEED = 100;

    #game; #view; #el;
    #dropTimerId = null;
    #isPlaying = false;

    constructor(game, view, el) {
      this.#game = game;
      this.#view = view;
      this.#el = el;
      this.#initializeEventListeners();
      this.#view.renderStartScreen();
    }

    get isPlaying() { return this.#isPlaying; }

    // Listener nur auf dem (fokussierbaren) Spielfeld -> kein Konflikt mit der Seite
    #initializeEventListeners() {
      this.#el.addEventListener("keydown", this.#handleKeyDown.bind(this));
      this.#el.addEventListener("keyup", this.#handleKeyUp.bind(this));
      this.#el.addEventListener("blur", () => this.pauseExternally());
    }

    // öffentliche Helfer für die Integration
    start() { this.#handlePauseOrRestart(this.#game.getState()); }
    pauseExternally() { if (this.#isPlaying) this.#pause(); }

    #update() { this.#game.moveTetrominoDown(); this.#updateView(); }

    #play() { this.#isPlaying = true; this.#startDropTimer(); this.#updateView(); }
    #pause() { this.#isPlaying = false; this.#stopDropTimer(); this.#updateView(); }
    #reset() { this.#game.reset(); this.#play(); }

    #updateView() {
      const s = this.#game.getState();
      if (s.isGameOver) this.#view.renderEndScreen(s);
      else if (!this.#isPlaying) this.#view.renderPauseScreen();
      else this.#view.renderMainScreen(s);
    }

    #calculateDropSpeed() {
      const lvl = this.#game.getState().level;
      const speed = Controller.#INITIAL_SPEED - lvl * Controller.#SPEED_DECREASE_PER_LEVEL;
      return Math.max(speed, Controller.#MINIMUM_SPEED);
    }
    #startDropTimer() {
      if (!this.#dropTimerId) this.#dropTimerId = setInterval(() => this.#update(), this.#calculateDropSpeed());
    }
    #stopDropTimer() {
      if (this.#dropTimerId) { clearInterval(this.#dropTimerId); this.#dropTimerId = null; }
    }

    #handleKeyDown(event) {
      const C = Controller.#KEY_CODES, s = this.#game.getState();
      const handled = [C.ENTER, C.SPACE, C.LEFT, C.UP, C.RIGHT, C.DOWN];
      if (handled.includes(event.keyCode)) event.preventDefault();   // kein Page-Scroll

      switch (event.keyCode) {
        case C.SPACE:
        case C.ENTER:
          this.#handlePauseOrRestart(s); break;
        case C.LEFT:
          if (this.#isPlaying && !s.isGameOver) { this.#game.moveTetrominoLeft(); this.#updateView(); } break;
        case C.UP:
          if (this.#isPlaying && !s.isGameOver) { this.#game.rotateTetromino(); this.#updateView(); } break;
        case C.RIGHT:
          if (this.#isPlaying && !s.isGameOver) { this.#game.moveTetrominoRight(); this.#updateView(); } break;
        case C.DOWN:
          if (this.#isPlaying && !s.isGameOver) { this.#stopDropTimer(); this.#game.moveTetrominoDown(); this.#updateView(); } break;
      }
    }
    #handleKeyUp(event) {
      if (event.keyCode === Controller.#KEY_CODES.DOWN && this.#isPlaying) this.#startDropTimer();
    }
    #handlePauseOrRestart(s) {
      if (s.isGameOver) this.#reset();
      else if (this.#isPlaying) this.#pause();
      else this.#play();
    }
  }

  class Game {
    static #POINTS_PER_LINES = { 1: 10, 2: 30, 3: 90, 4: 270 };
    static #BOARD_HEIGHT = 20;
    static #BOARD_WIDTH = 10;
    static #LINES_PER_LEVEL = 25;
    static #TETROMINO_TYPES = "IJLOSTZ";
    static #TETROMINO_SHAPES = {
      I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
      J: [[0,0,0],[2,2,2],[0,0,2]],
      L: [[0,0,0],[3,3,3],[3,0,0]],
      O: [[0,0,0,0],[0,4,4,0],[0,4,4,0],[0,0,0,0]],
      S: [[0,0,0],[0,5,5],[5,5,0]],
      T: [[0,0,0],[6,6,6],[0,6,0]],
      Z: [[0,0,0],[7,7,0],[0,7,7]],
    };

    #score = 0; #linesCleared = 0; #isGameOver = false;
    #gameBoard = []; #currentTetromino = null; #nextTetromino = null;

    constructor() { this.reset(); }

    get level() { return Math.floor(this.#linesCleared / Game.#LINES_PER_LEVEL); }
    get score() { return this.#score; }
    get linesCleared() { return this.#linesCleared; }
    get isGameOver() { return this.#isGameOver; }
    get nextTetromino() { return this.#nextTetromino; }

    reset() {
      this.#score = 0; this.#linesCleared = 0; this.#isGameOver = false;
      this.#gameBoard = this.#createEmptyBoard();
      this.#currentTetromino = this.#generateRandomTetromino();
      this.#nextTetromino = this.#generateRandomTetromino();
    }

    getState() {
      return {
        score: this.#score, level: this.level, lines: this.#linesCleared,
        nextPiece: this.#nextTetromino, playfield: this.#createDisplayBoard(),
        isGameOver: this.#isGameOver,
      };
    }

    moveTetrominoLeft() { this.#currentTetromino.x -= 1; if (this.#hasCollision()) this.#currentTetromino.x += 1; }
    moveTetrominoRight() { this.#currentTetromino.x += 1; if (this.#hasCollision()) this.#currentTetromino.x -= 1; }
    moveTetrominoDown() {
      if (this.#isGameOver) return;
      this.#currentTetromino.y += 1;
      if (this.#hasCollision()) {
        this.#currentTetromino.y -= 1;
        this.#lockTetromino();
        this.#updateScore(this.#clearCompleteLines());
        this.#switchToNextTetromino();
      }
      if (this.#hasCollision()) this.#isGameOver = true;
    }
    rotateTetromino() {
      this.#rotateMatrix(this.#currentTetromino.blocks, true);
      if (this.#hasCollision()) this.#rotateMatrix(this.#currentTetromino.blocks, false);
    }

    #createEmptyBoard() {
      const b = [];
      for (let r = 0; r < Game.#BOARD_HEIGHT; r++) b[r] = new Array(Game.#BOARD_WIDTH).fill(0);
      return b;
    }
    #createDisplayBoard() {
      const d = this.#gameBoard.map(row => [...row]);
      const { y, x, blocks } = this.#currentTetromino;
      for (let r = 0; r < blocks.length; r++)
        for (let c = 0; c < blocks[r].length; c++)
          if (blocks[r][c] && y + r >= 0) d[y + r][x + c] = blocks[r][c];
      return d;
    }
    #generateRandomTetromino() {
      const t = Game.#TETROMINO_TYPES[Math.floor(Math.random() * Game.#TETROMINO_TYPES.length)];
      const blocks = Game.#TETROMINO_SHAPES[t].map(row => [...row]);
      return { blocks, x: Math.floor((Game.#BOARD_WIDTH - blocks[0].length) / 2), y: -1 };
    }
    #hasCollision() {
      const { y, x, blocks } = this.#currentTetromino;
      for (let r = 0; r < blocks.length; r++)
        for (let c = 0; c < blocks[r].length; c++) {
          if (!blocks[r][c]) continue;
          const by = y + r, bx = x + c;
          if (by < 0) continue;
          if (by >= Game.#BOARD_HEIGHT || bx < 0 || bx >= Game.#BOARD_WIDTH) return true;
          if (this.#gameBoard[by] && this.#gameBoard[by][bx]) return true;
        }
      return false;
    }
    #lockTetromino() {
      const { y, x, blocks } = this.#currentTetromino;
      for (let r = 0; r < blocks.length; r++)
        for (let c = 0; c < blocks[r].length; c++)
          if (blocks[r][c]) this.#gameBoard[y + r][x + c] = blocks[r][c];
    }
    #clearCompleteLines() {
      const done = [];
      for (let r = Game.#BOARD_HEIGHT - 1; r >= 0; r--) {
        const n = this.#gameBoard[r].filter(c => c !== 0).length;
        if (n === 0) break;
        else if (n === Game.#BOARD_WIDTH) done.unshift(r);
      }
      for (const i of done) { this.#gameBoard.splice(i, 1); this.#gameBoard.unshift(new Array(Game.#BOARD_WIDTH).fill(0)); }
      return done.length;
    }
    #updateScore(cleared) {
      if (cleared > 0) {
        this.#score += Game.#POINTS_PER_LINES[cleared] * (this.level + 1);
        this.#linesCleared += cleared;
      }
    }
    #switchToNextTetromino() {
      this.#currentTetromino = this.#nextTetromino;
      this.#nextTetromino = this.#generateRandomTetromino();
    }
    #rotateMatrix(m, cw = true) {
      const size = m.length, max = size - 1;
      for (let i = 0; i < Math.floor(size / 2); i++)
        for (let j = i; j < max - i; j++) {
          const tmp = m[i][j];
          if (cw) {
            m[i][j] = m[max - j][i]; m[max - j][i] = m[max - i][max - j];
            m[max - i][max - j] = m[j][max - i]; m[j][max - i] = tmp;
          } else {
            m[i][j] = m[j][max - i]; m[j][max - i] = m[max - i][max - j];
            m[max - i][max - j] = m[max - j][i]; m[max - j][i] = tmp;
          }
        }
    }
  }

  class View {
    // Tetromino-Farben passend zum Spiel-Screenshot (kräftig auf Royalblau)
    static #TETROMINO_COLORS = {
      1: "#2fc8ff", // I  cyan
      2: "#4f7cff", // J  blau
      3: "#ff9f1f", // L  orange
      4: "#ffd23d", // O  gelb
      5: "#3fd64a", // S  grün
      6: "#ff3d9a", // T  magenta
      7: "#ff5a3c", // Z  rot
    };
    static #FONT_FAMILY = "'Space Mono', 'Courier New', monospace";
    static #FONT_SIZE_LARGE = 18;
    static #FONT_SIZE_SMALL = 14;
    static #BORDER_WIDTH = 1;
    static #BORDER_COLOR = "rgba(255,255,255,0.4)";
    static #TEXT_COLOR = "#ffffff";
    static #ACCENT_COLOR = "#2fc8ff";
    static #BLOCK_BORDER_COLOR = "#0f1657";
    static #BLOCK_BORDER_WIDTH = 2;
    static #PANEL_OFFSET = 10;
    static #LINE_SPACING = 24;
    static #OVERLAY_COLOR = "rgba(15,22,87,0.85)";

    #element; #width; #height; #canvas; #context;
    #boardArea; #panelArea; #blockDimensions;

    constructor(element, width, height, rows, columns) {
      this.#element = element; this.#width = width; this.#height = height;
      this.#initializeCanvas();
      this.#calculateDimensions(rows, columns);
      this.#element.appendChild(this.#canvas);
    }

    renderMainScreen(state) { this.#clearScreen(); this.#renderGameBoard(state); this.#renderInfoPanel(state); }
    renderStartScreen() { this.#clearScreen(); this.#drawBoardBorder(); this.#renderCenteredText("Enter = Start", View.#ACCENT_COLOR); }
    renderPauseScreen() { this.#renderOverlay(); this.#renderCenteredText("Enter = Weiter", View.#ACCENT_COLOR); }
    renderEndScreen({ score }) {
      this.#clearScreen();
      const cx = this.#boardArea.width / 2, cy = this.#height / 2, lh = 44;
      this.#context.textAlign = "center"; this.#context.textBaseline = "middle";
      this.#context.font = `${View.#FONT_SIZE_LARGE}px ${View.#FONT_FAMILY}`;
      this.#context.fillStyle = View.#ACCENT_COLOR; this.#context.fillText("GAME OVER", cx, cy - lh);
      this.#context.fillStyle = View.#TEXT_COLOR;
      this.#context.fillText(`Punkte: ${score}`, cx, cy);
      this.#context.fillText("Enter = Neustart", cx, cy + lh);
    }

    #initializeCanvas() {
      this.#canvas = document.createElement("canvas");
      this.#canvas.width = this.#width; this.#canvas.height = this.#height;
      this.#context = this.#canvas.getContext("2d");
    }
    #calculateDimensions(rows, columns) {
      const boardWidth = (this.#width * 2) / 3, boardHeight = this.#height;
      this.#boardArea = {
        x: View.#BORDER_WIDTH, y: View.#BORDER_WIDTH, width: boardWidth, height: boardHeight,
        innerWidth: boardWidth - View.#BORDER_WIDTH * 2, innerHeight: boardHeight - View.#BORDER_WIDTH * 2,
      };
      this.#panelArea = { x: boardWidth + View.#PANEL_OFFSET, y: 0, width: this.#width / 3, height: this.#height };
      this.#blockDimensions = { width: this.#boardArea.innerWidth / columns, height: this.#boardArea.innerHeight / rows };
    }
    #clearScreen() { this.#context.clearRect(0, 0, this.#width, this.#height); }
    #renderOverlay() { this.#context.fillStyle = View.#OVERLAY_COLOR; this.#context.fillRect(0, 0, this.#boardArea.width, this.#height); }
    #renderCenteredText(text, color) {
      this.#context.fillStyle = color || View.#TEXT_COLOR;
      this.#context.font = `${View.#FONT_SIZE_LARGE}px ${View.#FONT_FAMILY}`;
      this.#context.textAlign = "center"; this.#context.textBaseline = "middle";
      this.#context.fillText(text, this.#boardArea.width / 2, this.#height / 2);
    }
    #renderGameBoard({ playfield }) {
      for (let r = 0; r < playfield.length; r++)
        for (let c = 0; c < playfield[r].length; c++)
          if (playfield[r][c])
            this.#renderBlock(
              this.#boardArea.x + c * this.#blockDimensions.width,
              this.#boardArea.y + r * this.#blockDimensions.height,
              this.#blockDimensions.width, this.#blockDimensions.height,
              View.#TETROMINO_COLORS[playfield[r][c]]);
      this.#drawBoardBorder();
    }
    #drawBoardBorder() {
      this.#context.strokeStyle = View.#BORDER_COLOR;
      this.#context.lineWidth = View.#BORDER_WIDTH;
      this.#context.strokeRect(0, 0, this.#boardArea.width, this.#boardArea.height);
    }
    #renderInfoPanel({ level, score, lines, nextPiece }) {
      this.#context.textAlign = "start"; this.#context.textBaseline = "top";
      this.#context.fillStyle = View.#TEXT_COLOR;
      this.#context.font = `${View.#FONT_SIZE_SMALL}px ${View.#FONT_FAMILY}`;
      const labels = [
        { text: `Punkte: ${score}`, y: 0 },
        { text: `Reihen: ${lines}`, y: View.#LINE_SPACING },
        { text: `Level: ${level}`, y: View.#LINE_SPACING * 2 },
        { text: "Nächster:", y: View.#LINE_SPACING * 4 },
      ];
      labels.forEach(({ text, y }) => this.#context.fillText(text, this.#panelArea.x, this.#panelArea.y + y));
      this.#renderNextTetromino(nextPiece);
    }
    #renderNextTetromino(t) {
      const scale = 0.5, offsetY = 100;
      for (let r = 0; r < t.blocks.length; r++)
        for (let c = 0; c < t.blocks[r].length; c++)
          if (t.blocks[r][c])
            this.#renderBlock(
              this.#panelArea.x + c * this.#blockDimensions.width * scale,
              this.#panelArea.y + offsetY + r * this.#blockDimensions.height * scale,
              this.#blockDimensions.width * scale, this.#blockDimensions.height * scale,
              View.#TETROMINO_COLORS[t.blocks[r][c]]);
    }
    #renderBlock(x, y, w, h, color) {
      this.#context.fillStyle = color;
      this.#context.strokeStyle = View.#BLOCK_BORDER_COLOR;
      this.#context.lineWidth = View.#BLOCK_BORDER_WIDTH;
      this.#context.fillRect(x, y, w, h);
      this.#context.strokeRect(x, y, w, h);
    }
  }

  function mountTetris(rootEl) {
    rootEl.setAttribute("tabindex", "0");
    const game = new Game();
    const view = new View(rootEl, 480, 640, 20, 10);
    return new Controller(game, view, rootEl);
  }

  /* ---------- Integration: Start-Button + Pause beim Wegscrollen -------- */
  function init() {
    const startBtn = document.getElementById("tetrisStart");
    const rootEl = document.getElementById("tetrisRoot");
    if (!startBtn || !rootEl) return;
    let controller = null;
    startBtn.addEventListener("click", () => {
      if (!controller) controller = mountTetris(rootEl);
      startBtn.style.display = "none";
      rootEl.focus();
      controller.start();
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting && controller) controller.pauseExternally();
      }), { threshold: 0.25 }).observe(rootEl);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
