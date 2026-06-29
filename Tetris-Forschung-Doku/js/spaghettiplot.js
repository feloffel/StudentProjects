/* =========================================================================
   Spaghetti-Plot der Pre/Post-Ergebnisse (Lukas' Auswertung, an Theme angepasst)
   Einzelverläufe + Gruppenmittelwerte je Test, mit Statistik-Einblendung.
   ========================================================================= */
(function () {
  let tbChart = null;
  let currentTest = 0;

  // Gruppenfarben: klar unterscheidbar (Kontroll = blau, Test = rot)
  const COLORS = { Kontroll: "#5b9bff", Test: "#ff5a5a" };

  // Reihenfolge der Tests + deutsche Aufbereitung je Test.
  // dir: "up" = höher ist besser, "down" = niedriger ist besser.
  // stat: Ergebnis der Repeated-Measures-ANOVA (Pre→Post = Zeit-Effekt).
  const TESTS = [
    { key: "RegelnWechseln", label: "Regeln wechseln", unit: "Wechselkosten", dir: "down",
      sig: true,  stat: "Pre→Post signifikant (p = .034). Wechselkosten sinken in beiden Gruppen, kein Tetris-Vorteil (Gruppe×Zeit p = .70)." },
    { key: "Rotation", label: "Mentale Rotation", unit: "Trefferquote", dir: "up",
      sig: false, stat: "Keine signifikante Veränderung (p = .53). Beide Gruppen starten schon unterschiedlich (Kontroll im Pre höher)." },
    { key: "Corsi", label: "Corsi-Merkspanne", unit: "Merkspanne", dir: "up",
      sig: false, stat: "Keine signifikante Veränderung (p = .59). Kontroll steigt, Test sinkt, der Unterschied ist aber zufallsnah (p = .11)." },
    { key: "Search", label: "Symbolsuche", unit: "Score", dir: "up",
      sig: false, stat: "Keine signifikante Veränderung (p = .56). Werte bleiben in beiden Gruppen praktisch gleich." },
    { key: "Falten", label: "Papier falten", unit: "gelöste Aufgaben", dir: "up",
      sig: true,  stat: "Pre→Post deutlich signifikant (p = .007, großer Effekt). Beide Gruppen besser, Kontroll sogar stärker, kein Tetris-Vorteil (Gruppe×Zeit p = .14)." },
    { key: "Rechnen", label: "Kopfrechnen", unit: "Score", dir: "up",
      sig: false, stat: "Kontrollaufgabe ohne Raumbezug: keine Veränderung (p = .45). Genau das erwarten wir, wenn es keinen echten Transfer gibt." },
  ];
  const META = Object.fromEntries(TESTS.map(t => [t.key, t]));

  function parseSpaghettiData(csvText) {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(";").map(h => h.trim());
    const cols = TESTS.flatMap(t => [t.key + "_Pre", t.key + "_Post"]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const vals = lines[i].split(";").map(v => v.trim());
      const subjectID = vals[headers.indexOf("Subject_ID")];
      const group = vals[headers.indexOf("Group")];
      cols.forEach(col => {
        const [test, phase] = col.split("_");
        const raw = vals[headers.indexOf(col)];
        const score = (raw === "" || raw === undefined) ? null : parseFloat(raw.replace(",", "."));
        rows.push({ Subject: subjectID, Group: group, test, phase, score });
      });
    }
    return rows;
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!window.SPAGHETTI_CSV || typeof Chart === "undefined") return;

    const rawData = parseSpaghettiData(window.SPAGHETTI_CSV);
    const tests = TESTS.map(t => t.key);

    const label    = document.getElementById("tb-label");
    const unitEl   = document.getElementById("tb-unit");
    const statEl   = document.getElementById("tb-stat");
    const prev     = document.getElementById("tb-prev");
    const next     = document.getElementById("tb-next");
    const showInd  = document.getElementById("tb-show-ind");
    const showMean = document.getElementById("tb-show-mean");
    const groupSel = document.getElementById("tb-group");
    if (!label || !prev) return;

    function getFilteredData() {
      const g = groupSel.value;
      return rawData.filter(d => d.test === tests[currentTest] && (g === "both" || d.Group === g));
    }

    function buildDatasets(data) {
      const datasets = [];
      const subjects = [...new Set(data.map(d => d.Subject))];
      const g = groupSel.value;

      if (showInd.checked) {
        subjects.forEach(subj => {
          const rows = data.filter(d => d.Subject === subj)
            .sort((a, b) => a.phase === "Pre" ? -1 : 1);
          const group = rows[0]?.Group;
          const color = COLORS[group] ?? "#888";
          datasets.push({
            label: `VP${subj} (${group})`,
            data: rows.map(d => ({ x: d.phase, y: d.score })),
            borderColor: color + "55",
            backgroundColor: "transparent",
            pointBackgroundColor: color + "99",
            pointBorderColor: "transparent",
            borderWidth: 1.5, pointRadius: 3, tension: 0, showLine: true
          });
        });
      }

      if (showMean.checked) {
        const groups = g === "both" ? ["Kontroll", "Test"] : [g];
        groups.forEach(grp => {
          const grpData = data.filter(d => d.Group === grp);
          const means = ["Pre", "Post"].map(ph => {
            const vals = grpData.filter(d => d.phase === ph && d.score !== null).map(d => d.score);
            return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null;
          });
          const color = COLORS[grp];
          datasets.push({
            label: `${grp} Mittelwert`,
            data: ["Pre", "Post"].map((ph, i) => ({ x: ph, y: means[i] })),
            borderColor: color, backgroundColor: "transparent",
            pointBackgroundColor: color, pointBorderColor: "#0f1657",
            borderWidth: 3, pointRadius: 6, borderDash: [7, 4], tension: 0, showLine: true
          });
        });
      }
      return datasets;
    }

    function renderChart() {
      const data = getFilteredData();
      const datasets = buildDatasets(data);
      const t = META[tests[currentTest]];

      const allTestData = rawData.filter(d => d.test === t.key && d.score !== null).map(d => d.score);
      const yMin = Math.min(...allTestData);
      const yMax = Math.max(...allTestData);
      const pad = (yMax - yMin) * 0.12 || 1;

      label.textContent = t.label;
      const arrow = t.dir === "up" ? "höher = besser" : "niedriger = besser";
      if (unitEl) unitEl.textContent = `${t.unit} · ${arrow}`;
      if (statEl) {
        statEl.innerHTML = `<span class="tb-stat-badge ${t.sig ? "sig" : "ns"}">${t.sig ? "signifikant" : "nicht signifikant"}</span>${t.stat}`;
      }
      prev.disabled = currentTest === 0;
      next.disabled = currentTest === tests.length - 1;

      if (tbChart) tbChart.destroy();
      tbChart = new Chart(document.getElementById("tb-chart"), {
        type: "line",
        data: { datasets },
        options: {
          responsive: true, maintainAspectRatio: false, parsing: false,
          scales: {
            x: { type: "category", labels: ["Pre", "Post"], grid: { display: false },
                 ticks: { color: "rgba(255,255,255,.75)", font: { family: "'Space Mono', monospace" } } },
            y: { min: yMin - pad, max: yMax + pad,
                 ticks: { color: "rgba(255,255,255,.55)", font: { family: "'Space Mono', monospace" } },
                 grid: { color: "rgba(126,156,255,.18)" } }
          },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}` } }
          }
        }
      });
    }

    prev.addEventListener("click", () => { if (currentTest > 0) { currentTest--; renderChart(); } });
    next.addEventListener("click", () => { if (currentTest < tests.length - 1) { currentTest++; renderChart(); } });
    showInd.addEventListener("change", renderChart);
    showMean.addEventListener("change", renderChart);
    groupSel.addEventListener("change", renderChart);
    renderChart();
  });
})();
