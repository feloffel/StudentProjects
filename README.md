# Der Tetris-Effekt — Dokumentations-Website

Statische Website (HTML/CSS/JS), die unsere Forschung dokumentiert und die Auswertung
**automatisch aus der CSV** berechnet. Läuft ohne Build-Tools direkt auf GitHub Pages.

## Aufbau
```
doku/
├── index.html          # die ganze Seite (One-Pager mit Sektionen)
├── css/style.css       # Look im Stil von Prof. Kuschmirz (Aubergine/Mono/Grotesk)
├── js/config.js        # Tests, Domänen, Begründungen (siehe unten)
├── js/app.js           # Datenlogik + Charts (i.d.R. nicht anfassen)
├── data/rohdaten_alle.csv   # die Rohdaten
├── data/dataset.js     # auto-generierte Einbettung (für lokale Vorschau)
├── tools/build-data.py # erzeugt dataset.js aus der CSV
└── assets/             # Screenshots, GIFs, Screencast (Medien-Galerie)
```

## Neue Daten einspielen
1. `data/rohdaten_alle.csv` durch die neue Datei ersetzen (gleicher Name).
2. `python3 tools/build-data.py` ausführen (nur nötig für lokale Doppelklick-Vorschau).
3. Fertig — auf GitHub Pages liest die Seite die CSV direkt, Charts aktualisieren sich von selbst.

## Fake-/Test-Probanden
Die Website sortiert **nichts** automatisch aus — sie wertet exakt das aus, was in
`data/rohdaten_alle.csv` steht. Test-/Fake-Durchläufe also direkt in der CSV löschen.
(Zum reinen Anschauen lassen sich einzelne Proband:innen auf der Ergebnis-Seite per
Klick temporär aus der Ansicht nehmen — das verändert die Daten aber nicht.)

## Tests / Begründungen / Domänen ändern
Ebenfalls in `js/config.js`: `TEST_META` (was misst der Test, welche Domäne, Begründung)
und `DOMAINS` (Gruppen + Erwartung). `metric` steuert die Kennzahl:
`rt` = Zeit (s, kleiner = besser), `acc` = Trefferquote (%), `span` = Merkspanne (Corsi).

## Pre/Post-Logik
- **PRE** = Phase `pre` (eigentlicher Pre-Test). Phase `baseline` wird ignoriert (Kalibrierung).
- **POST** = Phase `post`.
- Sobald für eine Person Post-Daten existieren, rechnet die Seite **gepaart** (Pre und Post
  nur über dieselben Personen). Solange keine Post-Daten da sind, zeigen die Balken die
  Gruppen-Baseline und sind als „Post-Test ausstehend" gekennzeichnet.

## Lokal ansehen
Wegen `fetch()` am besten über einen kleinen Server:
```
cd doku && python3 -m http.server 8000
# -> http://localhost:8000
```
(Per Doppelklick auf `index.html` funktioniert es dank `dataset.js` auch, dann aber mit den
zuletzt per `build-data.py` eingebetteten Daten.)

## Auf GitHub Pages
Den `doku/`-Ordner ins Pages-Repo legen (z. B. `StudentProjects/Tetris-Effekt_Doku/`).
Die WebApp ist bereits unter
`feloffel.github.io/StudentProjects/Tetris-Effekt_WebApp/dashboard.html` verlinkt/eingebettet.
