/* =========================================================================
   KONFIGURATION  —  hier stellt ihr Inhalte ein, ohne Code anzufassen.

   Die Website sortiert KEINE Probanden aus. Sie wertet exakt das aus, was in
   data/rohdaten_alle.csv steht. Test-/Fake-Durchläufe bitte direkt in der CSV
   löschen.
   ========================================================================= */

/* 0) KONTROLLGRUPPE — Namen der Proband:innen, die NICHT Tetris gespielt haben
   (Pre + Post im gleichen Abstand, aber ohne Training). Alle, die hier NICHT
   stehen, gelten als Trainingsgruppe. Auf der Ergebnis-Seite lässt sich darüber
   "Trainingsgruppe vs. Kontrollgruppe" filtern. Namen exakt wie in der CSV. */
window.CONTROL_GROUP = [
  "1",
  "Laurel",
  "Burcu",
  "Polly",
  "TP-08",
];

/* Standardmäßig in der Ergebnis-Ansicht ausgeblendete Proband:innen
   (z.B. wer den Post-Test noch nicht gemacht hat). Per Klick wieder aktivierbar. */
window.DEFAULT_OFF = [
  "Laurel",
];

/* 1) KOGNITIVE DOMÄNEN (Gruppierung + Erwartung laut Hypothese) */
window.DOMAINS = {
  raeumlich:   { label: "Visuell-räumlich",             expectation: "Verbesserung erwartet" },
  tempo:       { label: "Verarbeitungstempo",           expectation: "Verbesserung erwartet" },
  gedaechtnis: { label: "Räumliches Arbeitsgedächtnis",  expectation: "Verbesserung erwartet" },
  exekutiv:    { label: "Exekutive Funktionen",         expectation: "leichte Verbesserung"  },
  reaktion:    { label: "Reaktion & Inhibition",        expectation: "Verbesserung erwartet" },
  kontrolle:   { label: "Numerische Kontrolle",         expectation: "Stagnation erwartet"   },
};

/* 2) TESTS  —  Domäne, Begründung der Auswahl und ALLE auszuwertenden Metriken.
   Jede Metrik:
     label   : Anzeigename
     calc    : Rechenart (siehe app.js): "acc" | "rt" | "maxspan" | "meanspan"
               | "mean" | "ratioTrue" | "ratioEquals" | "switchcost"
     col     : Quellspalte (bei mean/ratioTrue/ratioEquals)
     equals  : Zielwert (bei ratioEquals)
     unit    : "pct" | "ms" | "int" | "count"
     better  : "up" | "down"  (Richtung einer Verbesserung)
     correctOnly: bei "rt" nur korrekte Durchgänge zählen
*/
window.TEST_META = {
  "Figuren im Kopf drehen": {
    domain: "raeumlich", short: "Mentale Rotation",
    measures: "Gedrehte Figuren als Original oder Spiegelbild erkennen.",
    why: "Kernfähigkeit beim Tetris: Steine im Kopf rotieren. Stärkster erwarteter Transfer-Effekt.",
    metrics: [
      { label: "Trefferquote",   calc: "acc",                   unit: "pct", better: "up",   desc: "Anteil der richtig erkannten Figuren." },
      { label: "Reaktionszeit",  calc: "rt", correctOnly: true, unit: "ms",  better: "down", desc: "Wie lange man im Schnitt für eine richtige Antwort braucht." },
    ],
  },
  "Papier im Kopf falten": {
    domain: "raeumlich", short: "Mentales Falten",
    measures: "Vorstellen, wie ein gefaltetes und gelochtes Papier aussieht.",
    why: "Räumliches Vorstellungsvermögen ohne direkten Tetris-Bezug. Testet, wie weit der Transfer reicht.",
    metrics: [
      { label: "Trefferquote",     calc: "acc",                                       unit: "pct", better: "up",   desc: "Anteil der richtig gelösten Falt-Aufgaben." },
      { label: "Bearbeitungszeit", calc: "rt",                                        unit: "ms",  better: "down", desc: "Wie lange man im Schnitt für eine Aufgabe braucht." },
      { label: "Beantwortet",      calc: "ratioEquals", col: "Status", equals: "beantwortet", unit: "pct", better: "up", desc: "Anteil der Aufgaben, die man überhaupt rechtzeitig beantwortet hat." },
    ],
  },
  "Symbol suchen": {
    domain: "tempo", short: "Visuelle Suche",
    measures: "Zielsymbol in einer Reihe vieler Symbole finden.",
    why: "Tetris trainiert schnelles visuelles Scannen des Spielfelds.",
    metrics: [
      { label: "Trefferquote", calc: "acc",                   unit: "pct", better: "up",   desc: "Anteil der richtig gefundenen Zielsymbole." },
      { label: "Suchzeit",     calc: "rt", correctOnly: true, unit: "ms",  better: "down", desc: "Wie lange man im Schnitt fürs Finden braucht." },
    ],
  },
  "Felder-Folge merken (Corsi)": {
    domain: "gedaechtnis", short: "Corsi-Block",
    measures: "Eine räumliche Klopf-Sequenz aus Feldern nachklicken.",
    why: "Klassiker fürs räumliche Arbeitsgedächtnis. Misst die Merkspanne (Kapazität).",
    metrics: [
      { label: "Max. Merkspanne", calc: "maxspan",  unit: "int",   better: "up", desc: "Die längste Felder-Folge, die man fehlerfrei nachklicken konnte." },
      { label: "Mittlere Länge",  calc: "meanspan", unit: "count", better: "up", desc: "Durchschnittliche Länge der nachgeklickten Folgen." },
      { label: "Trefferquote",    calc: "acc",      unit: "pct",   better: "up", desc: "Anteil der richtig nachgeklickten Folgen." },
    ],
  },
  "Regeln wechseln": {
    domain: "exekutiv", short: "Regelwechsel",
    measures: "Sortierregel (Größe / Parität) wechselt unangekündigt.",
    why: "Kognitive Flexibilität. Tetris verlangt ständiges Umplanen.",
    metrics: [
      { label: "Trefferquote",  calc: "acc",        unit: "pct", better: "up",   desc: "Anteil der richtig einsortierten Reize." },
      { label: "Reaktionszeit", calc: "rt",         unit: "ms",  better: "down", desc: "Wie lange man im Schnitt pro Reiz braucht." },
      { label: "Wechselkosten", calc: "switchcost", unit: "ms",  better: "down", desc: "Wie viel langsamer man direkt nach einem Regelwechsel ist als ohne Wechsel. Kleiner ist besser." },
    ],
  },
  "Schnell reagieren": {
    domain: "reaktion", short: "Go / No-Go",
    measures: "Schnell auf Reize reagieren, Fehlreize unterdrücken.",
    why: "Reaktionsgeschwindigkeit und Impulskontrolle unter Zeitdruck.",
    metrics: [
      { label: "Reaktionszeit",      calc: "rt", correctOnly: true,                  unit: "ms",  better: "down", desc: "Wie schnell man auf die richtigen Reize reagiert." },
      { label: "Trefferquote",       calc: "acc",                                    unit: "pct", better: "up",   desc: "Anteil der richtigen Reaktionen (reagieren bzw. bewusst nicht reagieren)." },
      { label: "Verpasst (Timeout)", calc: "ratioTrue", col: "Zeit abgelaufen?",     unit: "pct", better: "down", desc: "Anteil der Reize, bei denen die Zeit ablief, ohne zu reagieren. Weniger ist besser." },
    ],
  },
  "Kopfrechnen (Kontrolle)": {
    domain: "kontrolle", short: "Kopfrechnen",
    measures: "Einfache Rechenaufgaben unter Zeitdruck lösen.",
    why: "KONTROLLAUFGABE: nicht-räumlich. Sollte sich NICHT verbessern. So trennen wir echten Transfer von reinem Übungseffekt.",
    metrics: [
      { label: "Trefferquote",    calc: "acc",                              unit: "pct", better: "up",   desc: "Anteil der richtig gelösten Rechenaufgaben." },
      { label: "Reaktionszeit",   calc: "rt",                               unit: "ms",  better: "down", desc: "Wie lange man im Schnitt pro Aufgabe braucht." },
      { label: "Zeit abgelaufen", calc: "ratioTrue", col: "Zeit abgelaufen?", unit: "pct", better: "down", desc: "Anteil der Aufgaben, bei denen die Zeit ablief. Weniger ist besser." },
    ],
  },
  "Konzentration unter Ablenkung": {
    domain: "reaktion", short: "Daueraufmerksamkeit",
    measures: "Über viele Runden Ziele treffen und Störreize ignorieren.",
    why: "Selektive Aufmerksamkeit über längere Zeit (Vigilanz).",
    metrics: [
      { label: "Treffer",            calc: "mean", col: "Treffer",       unit: "count", better: "up",   desc: "Wie viele Ziele man im Schnitt getroffen hat." },
      { label: "Übersehen",          calc: "mean", col: "Verpasst",      unit: "count", better: "down", desc: "Wie viele Ziele man im Schnitt verpasst hat. Weniger ist besser." },
      { label: "Fehlalarme",         calc: "mean", col: "Fehlalarme",    unit: "count", better: "down", desc: "Wie oft man auf den falschen Reiz reagiert hat. Weniger ist besser." },
      { label: "Typ. Reaktionszeit", calc: "mean", col: "Typische Zeit", unit: "ms",    better: "down", desc: "Die typische Reaktionszeit über die Runden." },
    ],
  },
};

/* 3) ABSCHLUSS-FRAGEBOGEN für die Proband:innen.
   Wird auf der Seite als Karten gezeigt. Unter jeder Frage erscheinen Audio-Player
   mit den aufgenommenen Antworten.

   AUDIO HINTERLEGEN:
   1) Audiodatei (z.B. .mp3 / .m4a / .ogg) in den Ordner  assets/audio/  legen.
   2) Bei der passenden Frage unten in "antworten" einen Eintrag ergänzen:
        antworten: [
          { label: "Proband A", src: "assets/audio/f1-proband-a.mp3" },
          { label: "Proband B", src: "assets/audio/f1-proband-b.mp3" },
        ]
   Solange "antworten" leer ist, zeigt die Karte einen Hinweis "Antworten folgen". */
window.FRAGEBOGEN = [
  { kategorie: "Ablauf & Vorgehen",
    frage: "Wie verständlich und gut organisiert fandest du den Ablauf der Studie aus Pre-Test, zwei Wochen Tetris und Post-Test?",
    antworten: [
      { label: "Proband", src: "assets/audio/f1/f1_Janik.m4a" },
      { label: "Kontrollperson", src: "assets/audio/f1/f1_kontrollgruppe1.mp3" },
    ] },
  { kategorie: "Umsetzung & Tool",
    frage: "Wie hat dir die Test-WebApp gefallen? Gab es technische Hürden, unklare Aufgaben oder etwas, das dich gestört hat?",
    antworten: [
      { label: "Proband", src: "assets/audio/f2/f2_Janik.m4a" },
      { label: "Kontrollperson", src: "assets/audio/f2/f2_kontrollgruppe1.mp3" },
    ] },
  { kategorie: "Erleben: die 2 Wochen",
    frage: "Wie hat sich das tägliche, 30-minütige Tetris-Spielen über die zwei Wochen angefühlt? Hat sich deine Motivation oder Routine im Verlauf verändert?",
    antworten: [
      { label: "Proband", src: "assets/audio/f3/f3_Janik.m4a" },
    ] },
  { kategorie: "Tetris-Effekt",
    frage: "Hattest du während oder nach den zwei Wochen typische Tetris-Momente, zum Beispiel Formen im Alltag gedanklich angeordnet, Muster gesehen oder sogar davon geträumt?",
    antworten: [
      { label: "Proband", src: "assets/audio/f4/f4_Janik.m4a" },
    ] },
  { kategorie: "Selbstwahrnehmung",
    frage: "Hattest du das Gefühl, in bestimmten Bereichen wie räumlichem Denken, Reaktion oder Konzentration schneller oder besser geworden zu sein?",
    antworten: [
      { label: "Proband", src: "assets/audio/f5/f5_Janik.m4a" },
    ] },
  { kategorie: "Jetzt: danach",
    frage: "Wie geht es dir jetzt nach Abschluss? Vermisst du das tägliche Spielen, ist es zur Gewohnheit geworden, oder bist du froh, dass es vorbei ist?",
    antworten: [
      { label: "Proband", src: "assets/audio/f6/f6_Janik.m4a" },
    ] },
  { kategorie: "Kritik & Verbesserung",
    frage: "Was würdest du an der Studie, den Tests oder unserer Vorgehensweise verbessern, wenn wir sie wiederholen würden?",
    antworten: [
      { label: "Proband", src: "assets/audio/f7/f7_Janik.m4a" },
      { label: "Kontrollperson", src: "assets/audio/f7/f7_kontrollgruppe1.mp3" },
    ] },
  { kategorie: "Offen",
    frage: "Ist dir sonst noch etwas aufgefallen oder durch den Kopf gegangen, das du uns mitteilen möchtest?",
    antworten: [
      { label: "Proband", src: "assets/audio/f8/f8_Janik.m4a" },
    ] },
];
