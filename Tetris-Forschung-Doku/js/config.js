/* =========================================================================
   KONFIGURATION  —  hier stellt ihr alles ein, ohne Code anzufassen.
   ========================================================================= */

/* HINWEIS: Die Website sortiert KEINE Probanden aus. Sie wertet exakt das aus,
   was in data/rohdaten_alle.csv steht. Test-/Fake-Durchläufe bitte direkt in der
   CSV löschen. */

/* 1) KOGNITIVE DOMÄNEN (Gruppierung + Erwartung laut Hypothese) */
window.DOMAINS = {
  raeumlich:   { label: "Visuell-räumlich",        expectation: "Verbesserung erwartet", color: "mint" },
  tempo:       { label: "Verarbeitungstempo",      expectation: "Verbesserung erwartet", color: "mint" },
  gedaechtnis: { label: "Räumliches Arbeitsgedächtnis", expectation: "Verbesserung erwartet", color: "mint" },
  exekutiv:    { label: "Exekutive Funktionen",    expectation: "leichte Verbesserung",  color: "mint" },
  reaktion:    { label: "Reaktion & Inhibition",   expectation: "Verbesserung erwartet", color: "mint" },
  kontrolle:   { label: "Numerische Kontrolle",    expectation: "Stagnation erwartet",   color: "pink" },
};

/* 2) TESTS  —  Zuordnung, Metrik und BEGRÜNDUNG der Auswahl
   metric: "rt"  -> Bearbeitungszeit (ms), kleiner = besser
           "acc" -> Trefferquote (%), größer = besser
           "span"-> gemerkte Länge (Corsi), größer = besser
   better: "down" | "up"  (Richtung einer Verbesserung)               */
window.TEST_META = {
  "Figuren im Kopf drehen": {
    domain: "raeumlich", metric: "rt", better: "down", show: true,
    short: "Mentale Rotation",
    measures: "Gedrehte Figuren als Spiegelbild erkennen.",
    why: "Kernfähigkeit beim Tetris: Steine im Kopf rotieren. Stärkster erwarteter Transfer-Effekt.",
  },
  "Papier im Kopf falten": {
    domain: "raeumlich", metric: "rt", better: "down", show: true,
    short: "Mentales Falten",
    measures: "Vorstellen, wie ein gefaltetes Papier aussieht.",
    why: "Räumliches Vorstellungsvermögen ohne direkten Tetris-Bezug. Testet, wie weit der Transfer reicht.",
  },
  "Symbol suchen": {
    domain: "tempo", metric: "rt", better: "down", show: true,
    short: "Visuelle Suche",
    measures: "Zielsymbol in einer Reihe finden (Odd-one-out).",
    why: "Tetris trainiert schnelles visuelles Scannen des Spielfelds.",
  },
  "Felder-Folge merken (Corsi)": {
    domain: "gedaechtnis", metric: "span", better: "up", show: true,
    short: "Corsi-Block",
    measures: "Eine räumliche Klopf-Sequenz nachklicken.",
    why: "Klassiker fürs räumliche Arbeitsgedächtnis (Kapazität).",
  },
  "Regeln wechseln": {
    domain: "exekutiv", metric: "rt", better: "down", show: true,
    short: "Regelwechsel",
    measures: "Sortierregel wechselt unangekündigt (Task-Switching).",
    why: "Kognitive Flexibilität. Tetris verlangt ständiges Umplanen.",
  },
  "Schnell reagieren": {
    domain: "reaktion", metric: "rt", better: "down", show: true,
    short: "Go/No-Go",
    measures: "Schnell reagieren, aber Fehlreize unterdrücken.",
    why: "Reaktionsgeschwindigkeit und Impulskontrolle unter Zeitdruck.",
  },
  "Kopfrechnen (Kontrolle)": {
    domain: "kontrolle", metric: "rt", better: "down", show: true,
    short: "Kopfrechnen",
    measures: "Einfache Rechenaufgaben unter Zeit.",
    why: "KONTROLLAUFGABE: nicht-räumlich. Sollte sich NICHT verbessern. So trennen wir echten Transfer von reinem Übungseffekt.",
  },

  /* kleinere Nebentests (zu wenig Daten für eigene Charts) */
  "Muster vervollständigen": { domain: "raeumlich", metric: "rt", better: "down", show: false, short: "Muster", measures: "Fehlendes Musterstück erkennen.", why: "Ergänzender räumlicher Test." },
  "Teile einpassen":         { domain: "raeumlich", metric: "rt", better: "down", show: false, short: "Einpassen", measures: "Form in Lücke einpassen.", why: "Ergänzender räumlicher Test." },
  "Kofferraum packen":       { domain: "raeumlich", metric: "rt", better: "down", show: false, short: "Packen", measures: "Objekte platzsparend anordnen.", why: "Anwendungsnaher Packing-Task." },
  "Konzentration unter Ablenkung": { domain: "reaktion", metric: "acc", better: "up", show: false, short: "Ablenkung", measures: "Aufgabe trotz Störreizen lösen.", why: "Selektive Aufmerksamkeit." },
  "Zeitgefühl":              { domain: "reaktion", metric: "rt", better: "down", show: false, short: "Zeitgefühl", measures: "Zeitspanne ohne Uhr schätzen.", why: "Interne Zeitwahrnehmung." },
};
