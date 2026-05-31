# Tetris-Effekt — Mess-Web-App

Tägliche Kurzmessung für die Einzelfallstudie zur raum-zeitlichen Wahrnehmung.
Misst über 14+ Tage vier räumliche Aufgaben plus eine nicht-räumliche Kontrollaufgabe und
sichert jede Sitzung online in Firebase (Cloud Firestore). Ihr seht die Daten live im Dashboard.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | **Test-App** für die Testperson (täglich öffnen) |
| `dashboard.html` | **Live-Dashboard** für euch (Tabelle + Verlaufskurven) |
| `app.js` / `dashboard.js` | Logik (nicht ändern nötig, außer ihr wollt anpassen) |
| `firebase-config.js` | **Hier eure Firebase-Zugangsdaten eintragen** |
| `README.md` | dieses Dokument |

Die fünf Aufgaben pro Sitzung (ca. 10–15 Min): **Mentale Rotation → Lücken-Einpassen → Räumliches Gedächtnis (Corsi) → Zeitproduktion → Kopfrechnen (Kontrolle).**

---

## 1. Sofort ausprobieren (ohne Firebase)

Die App läuft auch ohne Cloud — zum Testen des Ablaufs. Wegen der `<script>`-Module muss sie
über einen lokalen Server laufen (nicht per Doppelklick als `file://`).

```bash
# im Projektordner, eine der beiden Varianten:
npx serve .
# oder
python3 -m http.server 8000
```

Dann im Browser `http://localhost:8000/` öffnen. Daten landen lokal im Browser und lassen sich
über „Daten exportieren“ als CSV/JSON herunterladen. In VS Code geht auch die Extension **Live Server**.

---

## 2. Firebase einrichten (für Online-Sicherung)

1. **Projekt anlegen:** [console.firebase.google.com](https://console.firebase.google.com) → *Projekt hinzufügen* (Google Analytics kann aus bleiben).
2. **Firestore erstellen:** linkes Menü *Build → Firestore Database → Datenbank erstellen* → **Im Testmodus starten** → Region z. B. `eur3 (europe-west)`.
3. **Web-App registrieren:** Projektübersicht → Symbol **`</>`** („Web“) → App-Spitzname vergeben → registrieren.
   Firebase zeigt ein `firebaseConfig`-Objekt mit sechs Werten.
4. **Werte eintragen:** diese sechs Werte in `firebase-config.js` ersetzen (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).

Beim nächsten Laden zeigt die App oben **„● Online-Sicherung aktiv“**.

> Der `apiKey` ist bei Firebase-Web-Apps **kein Geheimnis** — er identifiziert nur das Projekt.
> Der Zugriffsschutz läuft über die Firestore-Regeln (nächster Punkt).

### Firestore-Sicherheitsregeln (Studienmodus)

Der Testmodus erlaubt 30 Tage lang offenen Zugriff — für eine kurze Studie ausreichend.
Wollt ihr es etwas enger fassen, unter *Firestore → Regeln* einfügen und das Datum anpassen:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sessions/{doc} {
      allow create: if request.time < timestamp.date(2026, 8, 1);  // schreiben bis Stichtag
      allow read:   if request.time < timestamp.date(2026, 8, 1);  // lesen fürs Dashboard
      allow update, delete: if false;                              // nichts überschreiben/löschen
    }
  }
}
```

Nach der Studie die Regeln auf `allow read, write: if false;` setzen oder die Daten exportieren und das Projekt löschen.

---

## 3. Online stellen (damit die Testperson zuhause zugreifen kann)

Eine statische Seite — jede dieser Optionen funktioniert:

- **Firebase Hosting** (passt am besten):
  ```bash
  npm install -g firebase-tools
  firebase login
  firebase init hosting     # "public"-Ordner = dieser Ordner, als SPA: Nein
  firebase deploy
  ```
- **Netlify:** Ordner einfach auf [app.netlify.com/drop](https://app.netlify.com/drop) ziehen.
- **GitHub Pages:** Dateien ins Repo, Pages aktivieren.

Die Testperson bekommt den Link zu `index.html`, ihr nutzt `dashboard.html`.

---

## 4. Täglicher Ablauf (Protokoll)

- **Immer gleiche Uhrzeit, gleiches Gerät, ruhiger Ort.**
- Reihenfolge laut Konzept: **erst die App-Tests, dann 20–30 Min Tetris, danach Tagebuch.**
- In der App beim Start den **Teilnehmer-Code** (z. B. `TP-01`) und den **richtigen Studientag** wählen
  (Baseline 1–3 → Tag 1–14 → Washout 1–3). Die Phase wird automatisch mitgespeichert.
- Baseline (Tag −2 bis 0) und Washout (Tag 15–17) laufen **ohne** Tetris — nur App + Tagebuch.

---

## 5. Daten ansehen & exportieren

- `dashboard.html` öffnen (gleiche `firebase-config.js`). Es aktualisiert sich live bei jeder neuen Sitzung.
- Oben links nach Teilnehmer filtern. Die obere Kurve zeigt **Rotation / Einpassen / Kontrolle** zusammen —
  genau der Vergleich, der euren Kernbefund trägt: fallen die räumlichen Kurven, während die Kontrolle flach bleibt,
  ist es ein **spezifischer** räumlicher Transfer, kein bloßer Übungseffekt.
- **CSV exportieren** liefert eine Tabelle pro Sitzung; die JSON-Rohdaten (aus der App) enthalten zusätzlich jeden Einzeldurchgang.

---

## 6. Datenschutz

- **Nur einen Code** verwenden (`TP-01`), nie den echten Namen in der App.
- Einverständnis der Testperson schriftlich einholen (auch für spätere Video-Verwendung).
- Tagebuch-Notizen können persönlich sein — sparsam erfassen, nach Auswertung löschen.

---

## 7. Anpassen (optional)

Oben in `app.js` im `CFG`-Block:

- `ROTATION_TRIALS`, `GAPFIT_TRIALS`, `CONTROL_TRIALS` — Anzahl Durchgänge
- `CORSI_START`, `CORSI_MAX` — Spannweite der Gedächtnis-Aufgabe
- `TIME_TARGETS` — Zielzeiten der Zeitproduktion (Sekunden)
- `ENABLE_PROBE` — auf `true` setzen, um am Ende eine optionale Likert-Selbsteinschätzung abzufragen.
  **Achtung:** diese Fragen sind suggestiv und können eure Cover-Story unterlaufen (siehe Konzept 2.1) — standardmäßig **aus**.
