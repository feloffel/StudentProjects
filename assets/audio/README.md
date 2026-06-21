# Audio-Antworten der Proband:innen

Hier die aufgenommenen Antworten ablegen (z.B. .mp3, .m4a oder .ogg).

Danach in `js/config.js` bei der passenden Frage unter `antworten` verknüpfen, z.B.:

    antworten: [
      { label: "Proband A", src: "assets/audio/f1-proband-a.mp3" },
      { label: "Proband B", src: "assets/audio/f1-proband-b.mp3" },
    ]

Tipp für Dateinamen: `f<Fragennummer>-<proband>.mp3`, also z.B. `f4-anna.mp3`.
