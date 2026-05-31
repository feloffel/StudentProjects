/* ============================================================
   FIREBASE-KONFIGURATION  —  hier eure Projektdaten eintragen
   ------------------------------------------------------------
   1. Auf https://console.firebase.google.com ein Projekt anlegen
   2. Firestore-Datenbank erstellen (Testmodus für die Studiendauer)
   3. Web-App registrieren -> firebaseConfig kopieren
   4. Die sechs Werte unten ersetzen (siehe README.md)

   Solange hier "DEIN_..." steht, läuft die App im OFFLINE-Modus:
   Alle Tests funktionieren, Daten werden lokal gespeichert und
   lassen sich als CSV/JSON exportieren -- nur die Online-Sicherung
   ist dann deaktiviert.
   ============================================================ */

var FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDYcEDWWqUK-5ZxBD-pMbDo_BEJUArJR58",
  authDomain:        "tetriseffekt-app.firebaseapp.com",
  projectId:         "tetriseffekt-app",
  storageBucket:     "tetriseffekt-app.firebasestorage.app",
  messagingSenderId: "960655455693",
  appId:             "1:960655455693:web:a87111cc3e6fe164640084"
};

// Frei wählbarer Name der Studie (trennt eure Daten, falls ihr das Projekt teilt)
var STUDY_ID = "tetris-effekt-2026";
