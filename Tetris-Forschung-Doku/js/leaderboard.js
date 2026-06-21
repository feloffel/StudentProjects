// ============================================================================
// leaderboard.js
//
// Handles the Firebase/Firestore leaderboard:
//   - submits the player's score + level when the game ends
//   - renders a top-N list (sorted by score)
//   - blocks game input (e.g. 'r' for restart) while the name-entry
//     overlay is open, via window.isScoreSubmitOpen()
//
// SETUP REQUIRED:
// 1. Go to https://console.firebase.google.com, create a project (or use an
//    existing one).
// 2. In the project, enable "Firestore Database" (Build > Firestore Database
//    > Create database). Start in test mode for local development - see the
//    security-rules note at the bottom of this file before going live.
// 3. Go to Project settings (gear icon) > General > "Your apps" > add a Web
//    app. Firebase will show you a `firebaseConfig` object - copy its values
//    into FIREBASE_CONFIG below.
// ============================================================================

// --- PLACEHOLDER CONFIG: replace with your real Firebase project values ---
const FIREBASE_CONFIG = {
    apiKey:            "AIzaSyDYcEDWWqUK-5ZxBD-pMbDo_BEJUArJR58",
    authDomain:        "tetriseffekt-app.firebaseapp.com",
    projectId:         "tetriseffekt-app",
    storageBucket:     "tetriseffekt-app.firebasestorage.app",
    messagingSenderId: "960655455693",
    appId:             "1:960655455693:web:a87111cc3e6fe164640084"
};

const LEADERBOARD_COLLECTION = 'tetris_scores';
const LEADERBOARD_TOP_N = 10;

let firestoreDb = null;

// NEW: tracks whether the name-entry overlay is currently open. game.js
// reads this (via window.isScoreSubmitOpen) to suppress game input - most
// importantly 'r' for restart - while the player is typing their name.
let scoreSubmitOpen = false;

function isScoreSubmitOpen() {
    return scoreSubmitOpen;
}
window.isScoreSubmitOpen = isScoreSubmitOpen;

function initLeaderboard() {
    try {
        firebase.initializeApp(FIREBASE_CONFIG);
        firestoreDb = firebase.firestore();
    } catch (err) {
        console.error('Firebase init failed - leaderboard disabled.', err);
    }

    refreshLeaderboardView();
}

// Submits a single score entry (score + level) to Firestore.
async function submitScore(name, score, level) {
    if (!firestoreDb) {
        console.warn('Firestore not initialized, skipping submitScore.');
        return;
    }

    const trimmedName = (name || 'Anonymous').trim().slice(0, 20) || 'Anonymous';

    try {
        await firestoreDb.collection(LEADERBOARD_COLLECTION).add({
            name: trimmedName,
            score,
            level,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    } catch (err) {
        console.error('Failed to submit score:', err);
    }

    await refreshLeaderboardView();
}

// Fetches the top N scores (sorted by score desc) and renders them,
// including each entry's level, into #leaderboard-list.
async function refreshLeaderboardView() {
    const listEl = document.getElementById('leaderboard-list');
    if (!listEl) {
        return;
    }

    if (!firestoreDb) {
        listEl.innerHTML = '<li>Leaderboard nicht verf&uuml;gbar (Firebase nicht konfiguriert)</li>';
        return;
    }

    listEl.innerHTML = '<li>Lade...</li>';

    try {
        const snapshot = await firestoreDb
            .collection(LEADERBOARD_COLLECTION)
            .orderBy('score', 'desc')
            .limit(LEADERBOARD_TOP_N)
            .get();

        listEl.innerHTML = '';

        if (snapshot.empty) {
            listEl.innerHTML = '<li>Noch keine Eintr&auml;ge</li>';
            return;
        }

        let rank = 1;
        snapshot.forEach((doc) => {
            const data = doc.data();
            const li = document.createElement('li');
            // level may be missing on older entries written before this
            // field existed - fall back gracefully.
            const levelText = data.level !== undefined ? ` (Lvl ${data.level})` : '';
            li.textContent = `${rank}. ${data.name} - ${data.score}${levelText}`;
            listEl.appendChild(li);
            rank++;
        });
    } catch (err) {
        console.error('Failed to load leaderboard:', err);
        listEl.innerHTML = '<li>Fehler beim Laden</li>';
    }
}

// Called from game.js (lockCurrentPiece) once isGameOver becomes true.
// Receives both the final score and the final level.
function onGameOver(score, level) {
    const overlay = document.getElementById('score-submit-overlay');
    const scoreLabel = document.getElementById('score-submit-value');
    const levelLabel = document.getElementById('score-submit-level');
    const nameInput = document.getElementById('score-submit-name');
    const form = document.getElementById('score-submit-form');

    if (!overlay || !form) {
        // No submit UI present in the page - just refresh the list.
        refreshLeaderboardView();
        return;
    }

    scoreLabel.textContent = score;
    if (levelLabel) {
        levelLabel.textContent = level;
    }
    nameInput.value = '';
    overlay.style.display = 'flex';
    scoreSubmitOpen = true;
    nameInput.focus();

    // Avoid stacking multiple submit handlers across game-overs.
    form.onsubmit = async (event) => {
        event.preventDefault();
        await submitScore(nameInput.value, score, level);
        overlay.style.display = 'none';
        scoreSubmitOpen = false;
    };

    const skipBtn = document.getElementById('score-submit-skip');
    if (skipBtn) {
        skipBtn.onclick = () => {
            overlay.style.display = 'none';
            scoreSubmitOpen = false;
        };
    }
}

window.addEventListener('DOMContentLoaded', initLeaderboard);

// ============================================================================
// SECURITY RULES NOTE:
// Test mode (open read/write) is fine for local development but NOT for
// production - anyone could overwrite or spam your leaderboard. Once you're
// ready to deploy, go to Firestore > Rules and use something like:
//
//   rules_version = '2';
//   service cloud.firestore {
//     match /databases/{database}/documents {
//       match /tetris_scores/{entry} {
//         allow read: if true;
//         allow create: if request.resource.data.keys().hasOnly(['name', 'score', 'level', 'createdAt'])
//                       && request.resource.data.score is int
//                       && request.resource.data.score >= 0
//                       && request.resource.data.score < 1000000
//                       && request.resource.data.level is int
//                       && request.resource.data.level >= 0
//                       && request.resource.data.name is string
//                       && request.resource.data.name.size() <= 20;
//         allow update, delete: if false;
//       }
//     }
//   }
//
// This still doesn't stop a determined cheater from posting a fake score
// directly via the API (any client-only setup can't truly prevent that) -
// but it blocks casual tampering and keeps the data shape sane.
// ============================================================================
