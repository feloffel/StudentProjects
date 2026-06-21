const SHAPES = [
    // I
    [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
    ],
    // J
    [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0],
    ],
    // L
    [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0],
    ],
    // O
    [
        [1, 1],
        [1, 1],
    ],
    // S
    [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0],
    ],
    // T
    [
        [1, 1, 1],
        [0, 1, 0],
        [0, 0, 0],
    ],
    // Z
    [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0],
    ],
];

// Farben an das Website-Theme angepasst (Tetromino-Palette: I,J,L,O,S,T,Z)
const SHAPE_COLORS = [
    '#00BCD4', // I cyan
    '#485FE5', // J blau
    '#FF9800', // L orange
    '#FFEB3B', // O gelb
    '#4CAF50', // S grün
    '#A629BC', // T magenta
    '#F44336', // Z rot 
];

const COLOR_SIDEBAR_BORDER = 'rgba(126,156,255,.45)';
const COLOR_EMPTY_BLOCK = '#172159';
const COLOR_GAME_OVER_OVERLAY = 'rgba(10,15,60,.80)'
const COLOR_FONT = '#FFFFFF';
const COLOR_LABEL = '#2fc8ff';

const BLOCK_SIZE = 40;
const BLOCK_BACKGROUND = '#0f1657';

// NOTE on gravity tuning: `speed` is expressed in "progress units per ms",
// matched against GRAVITY_THRESHOLD (progress needed for one row to drop).
// Fall speed depends only on LEVEL, never on framerate - see updateGravity.
// (0.6 progress/ms at level 0 means one row every ~1.67s - tune to taste.)
const GRAVITY_SPEED = 0.6;
const GRAVITY_THRESHOLD = 1000; //After reaching this progress, the piece moves down

const GRID_COLS = 10;
const GRID_ROWS = 20;

const SIDEBAR_BORDER = 20;
const SIDEBAR_WIDTH_BLOCKS = 6;

const MAX_DT = 100; //Maximum Delta time in ms

const INPUT_REPEAT_THRESHOLD = 400;
const INPUT_REPEAT_INTERVAL = 5;

// --- Lock delay settings ---
// Time (ms) a piece can sit on the ground before it gets fixed in place.
const LOCK_DELAY = 400;
// How many times the lock timer is allowed to reset (via move/rotate)
// before the piece is force-locked regardless. Prevents infinite stalling.
const LOCK_DELAY_MAX_RESETS = 10;

// --- Spawn input delay ---
// Time (ms) after a new piece spawns during which inputs are ignored.
const SPAWN_INPUT_DELAY = 200;

const KEY_TO_INPUT_TYPE = {
    ArrowLeft: 'moveLeft',
    ArrowRight: 'moveRight',
    ArrowDown: 'moveDown',
    ArrowUp: 'rotate',
    ' ': 'hardDrop',
    r: 'restart',
};

const GRID_WIDTH = GRID_COLS * BLOCK_SIZE;
const GRID_HEIGHT = GRID_ROWS * BLOCK_SIZE;

const SIDEBAR_WIDTH = SIDEBAR_WIDTH_BLOCKS * BLOCK_SIZE;
const SIDEBAR_CONTENT_X = GRID_WIDTH + SIDEBAR_BORDER + BLOCK_SIZE;
const SIDEBAR_CONTENT_Y = BLOCK_SIZE;

const CANVAS_WIDTH = GRID_WIDTH + SIDEBAR_BORDER + SIDEBAR_WIDTH;
const CANVAS_HEIGHT = GRID_HEIGHT;

const BLOCK_EMPTY = -1;

const INPUT_STATE_INITIAL = 0;
const INPUT_STATE_CHARGING = 1;
const INPUT_STATE_REPEATING = 2;

function initCanvas() {
    const canvas = document.getElementById('game');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    canvas.style.visibility = 'visible';

    return canvas.getContext('2d');
}

function makeEmptyGrid() {
    return Array.from({ length: GRID_ROWS }, () =>
        Array(GRID_COLS).fill(BLOCK_EMPTY)
    );
}

function getRandomIndex(n) {
    return Math.floor(Math.random() * n);
}

// --- 7-bag randomizer ---
// Returns a shuffled array containing every shape index exactly once.
function createShuffledBag() {
    const bag = SHAPES.map((_, index) => index);

    // Fisher-Yates shuffle
    for (let i = bag.length - 1; i > 0; i--) {
        const j = getRandomIndex(i + 1);
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }

    return bag;
}

// Pulls the next shape id out of the bag, refilling the bag with a freshly
// shuffled sequence of all 7 shapes whenever it runs out. Mutates `bagState`
// (an object of the shape { bag: number[] }) in place and returns the id.
function drawFromBag(bagState) {
    if (bagState.bag.length === 0) {
        bagState.bag = createShuffledBag();
    }

    return bagState.bag.pop();
}

function createCurrentPiece(shapeId) {
    const shape = SHAPES[shapeId];

    return {
        shapeId,
        shape,
        position: {
            x: getRandomIndex(GRID_COLS - shape[0].length + 1),
            y: 0,
        },
        // lock-delay bookkeeping lives on the piece itself so it's
        // automatically reset whenever a new piece is created.
        lockTimer: 0,
        lockResets: 0,
        isLocking: false,
        // spawn grace period before inputs are honored.
        spawnTimer: 0,
    };
}

function getInitialState() {
    const bagState = { bag: createShuffledBag() };
    const initialShapeID = drawFromBag(bagState);

    return {
        isGameOver: false,
        score: 0,
        // FIX: level now lives on state (was a module-level `let LEVEL`),
        // so a restart via resetGameState() correctly brings it back to 0
        // instead of carrying over the previous run's level.
        level: 0,
        gravity: {
            progress: 0,
            speed: GRAVITY_SPEED,
        },
        bagState,
        currentPiece: createCurrentPiece(initialShapeID),
        nextShapeId: drawFromBag(bagState),
        grid: makeEmptyGrid(),
    };
}

function canGridFitShape(grid, shape, shapeX, shapeY) {
    return shape.every((row, i) => {
        const gridY = shapeY + i;

        return row.every((isSolid, j) => {
            if (!isSolid) {
                return true;
            }

            // below the floor - collision
            if (gridY >= grid.length) {
                return false;
            }

            // outside the walls - collision
            const gridX = shapeX + j;
            if(gridX < 0 || gridX >= grid[0].length) {
                return false;
            }

            // check if the place is free
            return grid[gridY][gridX] === BLOCK_EMPTY;
        });
    });
}

// checks whether a piece is currently resting on something
// (i.e. it cannot move down any further).
function isPieceGrounded(grid, currentPiece) {
    const { shape, position } = currentPiece;
    return !canGridFitShape(grid, shape, position.x, position.y + 1);
}

// registers a successful move/rotate against the lock-delay budget.
// Resets the lock timer so the player gets a fresh grace window, but only
// up to LOCK_DELAY_MAX_RESETS times - after that, the timer keeps running
// so the piece can't be stalled forever.
function notifyPieceMoved(currentPiece) {
    if (currentPiece.isLocking && currentPiece.lockResets < LOCK_DELAY_MAX_RESETS) {
        currentPiece.lockTimer = 0;
        currentPiece.lockResets += 1;
    }
}

function moveCurrentPiece(grid, currentPiece, moveX, moveY) {
    const {shape, position} = currentPiece;
    const {x, y} = position;

    const canMove = canGridFitShape(grid, shape, x + moveX, y + moveY);

    if (canMove) {
        position.x += moveX;
        position.y += moveY;

        // Moving resets "is this piece on the ground" bookkeeping.
        if (moveY !== 0) {
            // A successful downward move means we're not (yet) grounded.
            currentPiece.isLocking = false;
            currentPiece.lockTimer = 0;
        } else {
            // A horizontal move while sitting on the ground refreshes
            // the lock delay (within the reset budget).
            notifyPieceMoved(currentPiece);
        }
    }

    return canMove;
}

function rotate(shape) {
    return Array.from({length: shape[0].length}, (_, i) =>
        Array.from(
            {length: shape.length},
            (_, j) => shape[shape.length - 1 - j][i]
        )
    );
}

function rotateCurrentPiece(grid, currentPiece) {
    const {shape, position} = currentPiece;

    const newShape = rotate(shape);

    if (canGridFitShape(grid, newShape, position.x, position.y)) {
        currentPiece.shape = newShape;
        notifyPieceMoved(currentPiece);
    }
}

function handleInputState(input, dt) {
    if (!input) {
        return false;
    }

    input.timer += dt;

    switch(input.state) {
        case INPUT_STATE_INITIAL:
            input.state = INPUT_STATE_CHARGING;
            return true;

        case INPUT_STATE_CHARGING:
            const isCharged = input.timer >= INPUT_REPEAT_THRESHOLD;
            if (isCharged) {
                input.state = INPUT_STATE_REPEATING;
                input.timer = 0;
            }

            return isCharged;

        case INPUT_STATE_REPEATING:
            const shouldRepeat = input.timer >= INPUT_REPEAT_INTERVAL;
            if (shouldRepeat) {
                input.timer = 0;
            }

            return shouldRepeat;
    }
}

function updateCurrentPiece(state, inputs, dt) {
    const { grid, currentPiece } = state;

    // while still within the spawn grace period, advance the timer
    // and ignore all inputs entirely (they're left untouched in `inputs`,
    // so e.g. a held-down key will be honored as soon as the delay ends).
    if (currentPiece.spawnTimer < SPAWN_INPUT_DELAY) {
        currentPiece.spawnTimer += dt;
        return;
    }

    const isInputActive = (inputType) => handleInputState(inputs[inputType], dt);

    if (isInputActive('moveLeft')) {
        moveCurrentPiece(grid, currentPiece, -1, 0);
    }

    if (isInputActive('moveRight')) {
        moveCurrentPiece(grid, currentPiece, 1, 0);
    }

    if (isInputActive('rotate')) {
        rotateCurrentPiece(grid, currentPiece);
    }

    if (isInputActive('moveDown')) {
        moveCurrentPieceDown(state, dt);
    }

    if (isInputActive('hardDrop')) {
        // Hard drop bypasses lock delay entirely - it's a deliberate,
        // immediate placement.
        while (moveCurrentPiece(grid, currentPiece, 0, 1)) {}
        lockCurrentPiece(state);
    }
}

function attachToGrid(grid, currentPiece) {
    const {shapeId, shape, position} = currentPiece;

    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[0].length; j++) {
            if (shape[i][j]) {
                grid[position.y + i][position.x + j] = shapeId;
            }
        }
    }
}

function clearCompleteLines(grid) {
    let clearedLines = 0;

    for (let i = grid.length - 1; i >= 0; i--) {
        if (grid[i].every(cell => cell !== BLOCK_EMPTY)) {
            clearedLines++;
        } else if (clearedLines > 0) {
            grid[i + clearedLines] = [...grid[i]];
        }
    }

    // clear top rows
    for (let i = 0; i < clearedLines; i++) {
        grid[i].fill(BLOCK_EMPTY);
    }

    return clearedLines;
}

// FIX: level now updates state.level instead of the module-level LEVEL.
function advanceLevel(state) {
    state.level = Math.floor(state.score / 10);
}

// Performs the "fix piece in place" step, called once the lock delay has
// expired (or immediately on hard drop).
function lockCurrentPiece(state) {
    // attach the piece to grid
    attachToGrid(state.grid, state.currentPiece);

    // clear complete lines
    const clearedLines = clearCompleteLines(state.grid);
    // update score
    state.score += clearedLines;
    if (clearedLines > 0) {
        advanceLevel(state);
    }

    // draw the next piece from the 7-bag and queue up a new "next" piece
    const newPiece = createCurrentPiece(state.nextShapeId);
    const {shape, position} = newPiece;

    // if it doesnt fit - game over
    if (canGridFitShape(state.grid, shape, position.x, position.y)) {
        state.currentPiece = newPiece;
        state.nextShapeId = drawFromBag(state.bagState);
    } else {
        state.isGameOver = true;
        // game just ended - hand off to the leaderboard module so it
        // can prompt for a name / submit the score to Firebase.
        if (typeof onGameOver === 'function') {
            onGameOver(state.score, state.level);
        }
    }
}

// drives the lock-delay countdown. Called every frame regardless of
// input. If the piece is resting on something, the timer ticks up; once it
// passes LOCK_DELAY, the piece is locked in place. If the piece is no
// longer grounded (e.g. it fell further due to gravity), the lock state
// is cleared.
function updateLockDelay(state, dt) {
    const { grid, currentPiece } = state;

    if (isPieceGrounded(grid, currentPiece)) {
        if (!currentPiece.isLocking) {
            currentPiece.isLocking = true;
            currentPiece.lockTimer = 0;
            currentPiece.lockResets = 0;
        } else {
            currentPiece.lockTimer += dt;

            if (currentPiece.lockTimer >= LOCK_DELAY) {
                lockCurrentPiece(state);
            }
        }
    } else {
        currentPiece.isLocking = false;
        currentPiece.lockTimer = 0;
    }
}

// moveCurrentPieceDown is ONLY responsible for moving the piece down
// (via soft-drop input or gravity). It no longer locks the piece itself -
// that's handled by updateLockDelay once the lock timer expires.
function moveCurrentPieceDown(state, dt) {
    state.gravity.progress = 0;

    return moveCurrentPiece(state.grid, state.currentPiece, 0, 1);
}

// Computes fall speed ("progress units per ms") purely as a function of
// `level`. Same level => same speed, regardless of framerate.
function getGravitySpeedForLevel(level) {
    if (level >= 5) {
        return GRAVITY_SPEED + (level * (level - 3)) * GRAVITY_SPEED;
    }

    return GRAVITY_SPEED + (level * 1.5) * GRAVITY_SPEED;
}

// FIX: gravity now scales with `dt` again (state.gravity.progress +=
// speed * dt), so the piece falls at the same real-world speed regardless
// of framerate. Speed itself depends only on `state.level`, never on dt or
// framerate - recomputed fresh each call from the level alone, so it can't
// drift.
function updateGravity(state, dt) {
    state.gravity.speed = getGravitySpeedForLevel(state.level);
    state.gravity.progress += state.gravity.speed * dt;

    if (state.gravity.progress >= GRAVITY_THRESHOLD) {
        moveCurrentPieceDown(state, dt);
    }
}

function resetGameState(state) {
    Object.assign(state, getInitialState());
}

function update(state, inputs, dt) {
    if (state.isGameOver) {
        if (inputs.restart) {
            resetGameState(state);
        }
    } else {
        updateCurrentPiece(state, inputs, dt);
        updateGravity(state, dt);
        // lock delay is evaluated every frame, after movement/gravity
        // have had a chance to move the piece.
        updateLockDelay(state, dt);
    }
}

function drawBlock(ctx, color, x, y) {
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
}

function drawShape(ctx, shape, colorId, x, y) {
    const color = SHAPE_COLORS[colorId];

    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[0].length; j++) {
            if (shape[i][j]) {
                drawBlock(ctx, color, x + j * BLOCK_SIZE, y + i * BLOCK_SIZE);
            }
        }
    }
}

function render(ctx, state) {
    ctx.fillStyle = BLOCK_BACKGROUND;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const {grid, currentPiece, nextShapeId } = state;

    for (let i = 0; i < grid.length; i++) {
        for (let j = 0; j < grid[0].length; j++) {
            const colorId = grid[i][j];

            const color =
                colorId === BLOCK_EMPTY ? COLOR_EMPTY_BLOCK : SHAPE_COLORS[colorId];

            drawBlock(ctx, color, j * BLOCK_SIZE, i * BLOCK_SIZE);
        }
    }

    drawShape(
        ctx,
        currentPiece.shape,
        currentPiece.shapeId,
        currentPiece.position.x * BLOCK_SIZE,
        currentPiece.position.y * BLOCK_SIZE,
    );

    drawShape(
        ctx,
        SHAPES[nextShapeId],
        nextShapeId,
        SIDEBAR_CONTENT_X,
        BLOCK_SIZE
    );

    ctx.fillStyle = COLOR_SIDEBAR_BORDER;
    ctx.fillRect(GRID_WIDTH, 0, SIDEBAR_BORDER, CANVAS_HEIGHT);

    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const score = `${state.score}`.padStart(7, '0');
    ctx.fillStyle = COLOR_LABEL;
    ctx.fillText('Score:', SIDEBAR_CONTENT_X, SIDEBAR_CONTENT_Y + BLOCK_SIZE * 5);
    ctx.fillStyle = COLOR_FONT;
    ctx.fillText(score, SIDEBAR_CONTENT_X, SIDEBAR_CONTENT_Y + BLOCK_SIZE * 6);

    const level = `${state.level}`.padStart(2, '0');
    ctx.fillStyle = COLOR_LABEL;
    ctx.fillText('Level:', SIDEBAR_CONTENT_X, SIDEBAR_CONTENT_Y + BLOCK_SIZE * 8);
    ctx.fillStyle = COLOR_FONT;
    ctx.fillText(level, SIDEBAR_CONTENT_X, SIDEBAR_CONTENT_Y + BLOCK_SIZE * 9);

    if (state.isGameOver) {
        ctx.fillStyle = COLOR_GAME_OVER_OVERLAY;
        ctx.fillRect(0, 0, GRID_WIDTH, GRID_HEIGHT);

        ctx.fillStyle = COLOR_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Game Over!', GRID_WIDTH / 2, GRID_HEIGHT / 2);
    }
}

// `getRunning` lets us only react to game keys (and only block page-scroll
// via preventDefault) while the game is actually running, so the rest of the
// page scrolls normally before start / while paused.
function startCollectingInputs(inputs, getRunning) {
    function handleKeyEvent(event, inputValue) {
        if (event.repeat) {
            return;
        }

        // While the name-entry overlay is open, swallow all game input so it
        // can't act on the game behind the overlay (the text field handles
        // 'r' etc. as ordinary typed text).
        if (window.isScoreSubmitOpen && window.isScoreSubmitOpen()) {
            return;
        }

        const inputType = KEY_TO_INPUT_TYPE[event.key];
        if (inputType) {
            // Only honor game keys (and block the page from scrolling on
            // arrows / space) while the game is running and in view.
            if (!getRunning()) {
                return;
            }
            if (event.type === 'keydown' && (event.key.startsWith('Arrow') || event.key === ' ')) {
                event.preventDefault();
            }
            inputs[inputType] = inputValue;
        }
    }

    window.addEventListener('keydown', (event) => handleKeyEvent(event, { state: INPUT_STATE_INITIAL, timer: 0 }), { passive: false });
    window.addEventListener('keyup', (event) => handleKeyEvent(event, undefined));
}

// Creates a Tetris instance bound to the #game canvas. The render loop runs
// immediately (so the board is visible), but the game logic only advances
// once .start() is called. Returns a small controller used by game-init.js.
function createTetris() {
    const ctx = initCanvas();
    const state = getInitialState();
    const inputs = {};
    let running = false;
    let previousTime = performance.now();

    startCollectingInputs(inputs, () => running);

    function loop(currentTime) {
        const dt = Math.min(currentTime - previousTime, MAX_DT);
        previousTime = currentTime;

        if (running) {
            update(state, inputs, dt);
        }
        render(ctx, state);

        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // Lets touch buttons feed the same inputs as the keyboard.
    function inject(type) {
        if (!inputs[type]) {
            inputs[type] = { state: INPUT_STATE_INITIAL, timer: 0 };
        }
    }
    function release(type) {
        inputs[type] = undefined;
    }

    return {
        start() { if (!running) { running = true; previousTime = performance.now(); } },
        pause() { running = false; },
        resume() { if (!state.isGameOver) { running = true; previousTime = performance.now(); } },
        isRunning: () => running,
        isGameOver: () => state.isGameOver,
        inject,
        release,
    };
}

window.createTetris = createTetris;
