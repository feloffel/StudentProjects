# Tetris-Effekt — Mess-Web-App

Tägliche Kurzmessung für die Einzelfallstudie zur raum-zeitlichen Wahrnehmung.
Die App zeigt der Testperson ein kurzes Test-Set (ca. 10–15 Min) und sichert jede
Sitzung online in Firebase (Cloud Firestore). 

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | **Test-App** für die Testperson (täglich öffnen) |
| `dashboard.html` | **Dashboard**  Tests auswählen + Ergebnisse ansehen |
| `tests.js` | **Der Test-Pool** (alle Aufgaben in einer Datei |
| `app.js` | Ablauf-Logik der Test-App |
| `dashboard.js` | Logik des Dashboards |
| `firebase-config.js` |
| `README.md` | dieses Dokument |

### Der Test-Pool (12 Aufgaben)

Im Dashboard kann ausgewählt werden, welche Tests abgefragt werden sollen. 
Liste der Tests:

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

## Ohne Datensicherung / Firebase:

Die App läuft auch ohne Cloud zum Testen des Ablaufs. Wegen der `<script>`-Dateien muss sie
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

> Hinweis: Ohne Firebase „sehen“ sich App und Dashboard nur, wenn sie im **gleichen Browser** laufen (gemeinsamer lokaler Speicher). Für die echte Studie wird Firebase verwendet.

---


## Tests auswählen (Dashboard → Tab „Tests & Schwierigkeit“)

1. `dashboard.html` öffnen, Tab **„Tests & Schwierigkeit“**
2. Gewünschte Tests **anhaken** und je Test die Stufe **leicht / mittel / schwer** wählen
3. **„Auswahl speichern“** klicken

Die App liest diese Auswahl **beim nächsten Start**. Die Reihenfolge in der App entspricht der Reihenfolge im Pool. 

---


