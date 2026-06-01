# Tetris-Effekt — Mess-Web-App

Tägliche Kurzmessung für die Einzelfallstudie zur raum-zeitlichen Wahrnehmung.
Die App zeigt der Testperson pro Tag ein kurzes Test-Set (ca. 10–15 Min) und sichert jede
Sitzung online in Firebase (Cloud Firestore). **Welche** Tests drankommen und in welcher
**Schwierigkeit**, stellt ihr bequem im Dashboard ein — ganz ohne Code.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | **Test-App** für die Testperson (täglich öffnen) |
| `dashboard.html` | **Dashboard** für euch: Tests auswählen + Ergebnisse ansehen |
| `tests.js` | **Der Test-Pool** (alle Aufgaben in einer Datei, von App & Dashboard genutzt) |
| `app.js` | Ablauf-Logik der Test-App |
| `dashboard.js` | Logik des Dashboards |
| `firebase-config.js` | **Hier eure Firebase-Zugangsdaten eintragen** |
| `README.md` | dieses Dokument |

### Der Test-Pool (12 Aufgaben)

Ihr wählt im Dashboard aus, welche davon laufen. Die ersten fünf sind die Standard-Auswahl
aus dem Konzept (vier räumliche + eine Kontrolle):

1. **Figuren im Kopf drehen** – mentale Rotation (3D-Würfelfiguren)
2. **Teile einpassen** – Lücken-Einpassen
3. **Felder-Folge merken (Corsi)** – räumliches Arbeitsgedächtnis
4. **Zeitgefühl** – Zeitproduktion (ohne Zählen)
5. **Kopfrechnen (Kontrolle)** – bewusst ohne Raumbezug
6. **Papier im Kopf falten** – Paper-Folding-Stil (VZ-2)
7. **Schnell reagieren** – Wahlreaktionszeit (Deary-Liewald-Stil)
8. **Regeln wechseln** – Task-Switching (Mehraufwand durch Wechsel)
9. **Muster vervollständigen** – visuelle Schließung / Gestalt
10. **Kofferraum packen** – Pack-/Alltagslogik (passt es rein?)
11. **Symbol suchen** – visuelle Suche mit Störern
12. **Konzentration unter Ablenkung** – Zielsymbol unter Zeitdruck antippen

Jeder Test hat drei Schwierigkeitsstufen: **leicht / mittel / schwer** (z. B. mehr Durchgänge,
größere Felder, kürzere Zeitfenster). Standard ist überall „mittel“.

---

## 1. Sofort ausprobieren (ohne Firebase)

Die App läuft auch ohne Cloud — zum Testen des Ablaufs. Wegen der `<script>`-Dateien muss sie
über einen lokalen Server laufen (nicht per Doppelklick als `file://`).

```bash
# im Projektordner, eine der beiden Varianten:
npx serve .
# oder
python3 -m http.server 8000
```

Dann im Browser `http://localhost:8000/` (App) bzw. `…/dashboard.html` öffnen. Ohne Firebase
wird die Auswahl aus dem Dashboard **lokal im Browser** gespeichert und gilt dann nur auf
demselben Gerät/Browser. Sitzungsdaten lassen sich in der App über „Daten exportieren“ als
CSV/JSON sichern. In VS Code geht auch die Extension **Live Server**.

> Hinweis: Ohne Firebase „sehen“ sich App und Dashboard nur, wenn sie im **gleichen Browser**
> laufen (gemeinsamer lokaler Speicher). Für die echte Studie (Testperson zuhause, ihr am
> Dashboard) braucht ihr Firebase — siehe Schritt 2.

---

## 2. Firebase einrichten (für Online-Sicherung)

1. **Projekt anlegen:** [console.firebase.google.com](https://console.firebase.google.com) → *Projekt hinzufügen* (Google Analytics kann aus bleiben).
2. **Firestore erstellen:** linkes Menü *Build → Firestore Database → Datenbank erstellen* → **Im Testmodus starten** → Region z. B. `eur3 (europe-west)`.
3. **Web-App registrieren:** Projektübersicht → Symbol **`</>`** („Web“) → App-Spitzname vergeben → registrieren.
   Firebase zeigt ein `firebaseConfig`-Objekt mit sechs Werten.
4. **Werte eintragen:** diese sechs Werte in `firebase-config.js` ersetzen (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).

Beim nächsten Laden zeigt die App oben **„● Online-Sicherung aktiv“** und das Dashboard
**„● Live aus Firebase“**.

> Der `apiKey` ist bei Firebase-Web-Apps **kein Geheimnis** — er identifiziert nur das Projekt.
> Der Zugriffsschutz läuft über die Firestore-Regeln (nächster Punkt).

### Firestore-Sicherheitsregeln (Studienmodus)

Der Testmodus erlaubt 30 Tage lang offenen Zugriff — für eine kurze Studie ausreichend.
Wollt ihr es enger fassen, unter *Firestore → Regeln* einfügen und das Datum anpassen.
Wichtig: Es gibt jetzt **zwei** Sammlungen — `sessions` (die Messdaten) und `config`
(die im Dashboard gewählte Test-Auswahl):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sessions/{doc} {
      allow create: if request.time < timestamp.date(2026, 8, 1);  // schreiben bis Stichtag
      allow read:   if request.time < timestamp.date(2026, 8, 1);  // lesen fürs Dashboard
      allow update, delete: if false;                              // nichts überschreiben/löschen
    }
    match /config/{doc} {
      allow read, write: if request.time < timestamp.date(2026, 8, 1); // Test-Auswahl
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

## 4. Tests auswählen (Dashboard → Tab „Tests & Schwierigkeit“)

1. `dashboard.html` öffnen, Tab **„Tests & Schwierigkeit“**.
2. Gewünschte Tests **anhaken** und je Test die Stufe **leicht / mittel / schwer** wählen.
3. **„Auswahl speichern“** klicken. Fertig.

Die App liest diese Auswahl **beim nächsten Start** (also wenn die Testperson am nächsten Tag
neu öffnet). Die Reihenfolge in der App entspricht der Reihenfolge im Pool. Ändert ihr während
einer Studie nichts mehr, bleibt alles über alle Tage gleich — empfohlen, damit die Tage
vergleichbar sind.

> Tipp: Auswahl **vor** Beginn der Baseline festlegen und dann nicht mehr ändern. Wer mitten
> in der Studie Tests dazunimmt oder rausnimmt, hat für diese Tests keine durchgehende Kurve.

---

## 5. Täglicher Ablauf (Protokoll)

- **Immer gleiche Uhrzeit, gleiches Gerät, ruhiger Ort.**
- Reihenfolge laut Konzept: **erst die App-Tests, dann 20–30 Min Tetris, danach Tagebuch.**
- In der App beim Start den **Teilnehmer-Code** (z. B. `TP-01`) und den **richtigen Studientag** wählen
  (Baseline 1–3 → Tag 1–14 → Washout 1–3). Die Phase wird automatisch mitgespeichert.
- Baseline (Tag −2 bis 0) und Washout (Tag 15–17) laufen **ohne** Tetris — nur App + Tagebuch.

---

## 6. Ergebnisse ansehen & exportieren (Dashboard → Tab „Ergebnisse“)

- Tab **„Ergebnisse ansehen“** öffnen und oben **eine:n Teilnehmer:in auswählen**.
- Für jede Tagessitzung erscheint eine Karte mit der **Studienphase** (farbige Marke) und den
  Ergebnissen **in Alltagssprache** — z. B. „Richtig erkannt: 90 %“, „Typische Antwortzeit:
  0,88 Sek“, „Längste gemerkte Folge: 6 Felder“. **Keine Fachbegriffe** nötig.
- Das Dashboard aktualisiert sich live bei jeder neuen Sitzung (oder „Aktualisieren“ klicken).
- **CSV-Export** liefert eine Tabelle über alle Sitzungen der gewählten Person; die JSON-Rohdaten
  (aus der App) enthalten zusätzlich jeden Einzeldurchgang.

**Worauf es beim Auswerten ankommt:** Der Kernbefund steckt im **Vergleich** zwischen den
räumlichen Tests (1–4) und der **Kontrolle** (Kopfrechnen). Werden die räumlichen besser,
während die Kontrolle gleich bleibt, spricht das für einen **spezifischen** räumlichen Transfer
— und nicht für einen bloßen Übungseffekt. Klingt der Effekt in der spielfreien Washout-Phase
wieder ab, stützt das die Vermutung zusätzlich.

---

## 7. Datenschutz

- **Nur einen Code** verwenden (`TP-01`), nie den echten Namen in der App.
- Einverständnis der Testperson schriftlich einholen (auch für spätere Video-Verwendung).
- Tagebuch-Notizen können persönlich sein — sparsam erfassen, nach Auswertung löschen.

---

## 8. Eigene Tests / Schwierigkeiten anpassen (optional)

Alle Aufgaben stehen in **`tests.js`** im Array `TEST_POOL`. Jeder Test ist ein Objekt mit:

- `id` – eindeutiger Kurzname (für Speicherung/CSV)
- `name` / `short` / `measures` – Anzeige-Texte (laienverständlich)
- `defaultDifficulty` und `difficulties` – die Stufen `leicht / mittel / schwer` mit ihren
  Parametern (z. B. `{ trials: 20, max: 90 }`)
- `run(params, ui)` – der eigentliche Test-Ablauf (bekommt die Parameter der gewählten Stufe)
- `format(result)` – wandelt das Ergebnis in die laienverständlichen Zeilen fürs Dashboard

Eine neue Aufgabe hinzufügen = ein weiteres Objekt ins `TEST_POOL` eintragen. Schwierigkeiten
ändern = die Zahlen in `difficulties` anpassen. Die Standard-Auswahl (welche Tests „ab Werk“
aktiv sind) steht in `DEFAULT_CONFIG` am Ende von `tests.js` — sie greift nur, solange im
Dashboard noch nichts gespeichert wurde.
