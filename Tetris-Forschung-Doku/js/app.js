/* =========================================================================
   DER TETRIS-EFFEKT — App-Logik
   Liest die CSV und berechnet & zeichnet die Auswertung.
   (Es findet KEINE Aussortierung von Probanden statt — die Seite nutzt
    exakt das, was in der CSV steht. Bereinigung passiert in der CSV selbst.)
   ========================================================================= */
(() => {
  "use strict";

  const MINT = "#a6ecc6", PINK = "#f4b9e2", INK = "#d0c9b8";
  const INK_DIM = "rgba(208,201,184,.55)", LINE = "rgba(208,201,184,.2)";
  const META = window.TEST_META || {};
  const DOMAINS = window.DOMAINS || {};

  /* ---------- 1) CSV laden (Server bevorzugt, sonst eingebettet) -------- */
  let DATA_SOURCE = "";   // für die Anzeige im Footer
  async function loadCSV() {
    try {
      const r = await fetch("data/rohdaten_alle.csv", { cache: "no-store" });
      if (r.ok) { DATA_SOURCE = "live: data/rohdaten_alle.csv"; return await r.text(); }
    } catch (_) { /* file:// — fällt auf Embed zurück */ }
    const stamp = (window.TETRIS_CSV || "").match(/Stand:\s*([\d-]+)/);
    DATA_SOURCE = "eingebettet (dataset.js, Stand " + (stamp ? stamp[1] : "?") + ")";
    console.warn("[Tetris-Effekt] CSV konnte nicht per fetch geladen werden (file://?). " +
      "Es werden die EINGEBETTETEN Daten genutzt. Nach CSV-Änderung bitte 'python3 tools/build-data.py' " +
      "ausführen oder die Seite über einen lokalen Server / GitHub Pages öffnen.");
    return window.TETRIS_CSV || "";
  }

  function parseCSV(text) {
    const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim() !== "");
    if (!lines.length) return [];
    const head = lines[0].split(";");
    return lines.slice(1).map(line => {
      const c = line.split(";"), o = {};
      head.forEach((h, i) => o[h] = (c[i] ?? "").trim());
      return o;
    });
  }

  const num = v => { const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : null; };
  // PRE = der eigentliche Pre-Test. (phase "baseline" ist nur Kalibrierung und bleibt außen vor.)
  const isPre = r => r.phase === "pre";
  const isPost = r => r.phase === "post";

  /* ---------- 2) Metriken ---------------------------------------------- */
  function median(arr) {
    const a = arr.filter(x => x != null).sort((x, y) => x - y);
    if (!a.length) return null;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  function metricValue(rows, metric) {
    if (!rows.length) return null;
    if (metric === "rt") {
      const t = rows.map(r => num(r["Zeit"])).filter(z => z != null && z > 100 && z < 60000);
      return median(t);                          // ms
    }
    if (metric === "acc") {
      const v = rows.filter(r => r["Richtig?"] === "true" || r["Richtig?"] === "false");
      if (!v.length) return null;
      return 100 * v.filter(r => r["Richtig?"] === "true").length / v.length; // %
    }
    if (metric === "span") {
      const ok = rows.filter(r => r["Richtig?"] === "true").map(r => num(r["Länge"])).filter(x => x != null);
      const all = rows.map(r => num(r["Länge"])).filter(x => x != null);
      const src = ok.length ? ok : all;
      return src.length ? src.reduce((a, b) => a + b, 0) / src.length : null; // mittlere Länge
    }
    return null;
  }
  function fmt(val, metric) {
    if (val == null) return "k. A.";
    if (metric === "rt") return (val / 1000).toFixed(1) + " s";
    if (metric === "acc") return Math.round(val) + " %";
    if (metric === "span") return val.toFixed(1);
    return String(val);
  }
  const unit = m => m === "rt" ? "Zeit (s)" : m === "acc" ? "Trefferquote (%)" : "Merkspanne";

  /* ---------- 3) State -------------------------------------------------- */
  let ROWS = [];
  let PARTS = [];                 // [{name, rows, pre, post}]
  const manualOff = new Set();    // vom Nutzer in der Ansicht abgewählte Probanden

  function buildParticipants() {
    const map = new Map();
    ROWS.forEach(r => {
      const p = r.teilnehmer || "?";
      if (!map.has(p)) map.set(p, { name: p, rows: [], pre: 0, post: 0 });
      const e = map.get(p);
      e.rows.push(r);
      if (isPre(r)) e.pre++; else if (isPost(r)) e.post++;
    });
    PARTS = [...map.values()].sort((a, b) => b.rows.length - a.rows.length);
  }

  // aktive (nicht in der Ansicht abgewählte) Probanden
  const activeNames = () => new Set(PARTS.filter(p => !manualOff.has(p.name)).map(p => p.name));

  /* ---------- 4) Rendering --------------------------------------------- */
  function renderStats() {
    const trials = ROWS.length;
    const nTests = Object.values(META).filter(m => m.show).length;
    const el = document.getElementById("statStrip");
    const cards = [
      ["Proband:innen", PARTS.length, ""],
      ["Kognitive Tests", nTests, ""],
      ["Erfasste Datenpunkte", trials.toLocaleString("de-DE"), ""],
      ["Trainingsdauer", "14", "<small> Tage · 30 min</small>"],
    ];
    el.innerHTML = cards.map(([k, v, s]) =>
      `<div class="stat reveal"><div class="k">${k}</div><div class="v">${v}${s}</div></div>`
    ).join("");
  }

  function renderTestCards() {
    const grid = document.getElementById("testGrid");
    const entries = Object.entries(META).filter(([, m]) => m.show);
    grid.innerHTML = entries.map(([name, m]) => {
      const dom = DOMAINS[m.domain] || {};
      const flat = m.domain === "kontrolle";
      return `<div class="card reveal">
        <h3>${m.short}</h3>
        <p>${m.measures}</p>
        <div class="tagrow">
          <span class="tag">${dom.label || m.domain}</span>
          <span class="tag ${flat ? "flat" : "up"}">${dom.expectation || ""}</span>
        </div>
        <div class="why ${flat ? "flat" : ""}">${m.why}</div>
      </div>`;
    }).join("");
  }

  function renderChips() {
    const box = document.getElementById("pchips");
    box.innerHTML = PARTS.map(p => {
      const off = manualOff.has(p.name);
      return `<span class="chip ${off ? "off" : "on"}" data-p="${p.name}">${p.name}</span>`;
    }).join("");
    box.querySelectorAll(".chip").forEach(c => c.onclick = () => {
      const n = c.dataset.p;
      manualOff.has(n) ? manualOff.delete(n) : manualOff.add(n);
      renderChips(); renderCharts();
    });
  }

  let CHARTS = [];
  function renderCharts() {
    CHARTS.forEach(c => c.destroy()); CHARTS = [];
    const names = activeNames();
    const sel = ROWS.filter(r => names.has(r.teilnehmer));

    const anyPost = sel.some(isPost);
    const notice = document.getElementById("resultNotice");
    if (!names.size) {
      notice.innerHTML = `<div class="notice">Keine Proband:innen ausgewählt. Klicke oben mindestens einen Chip an.</div>`;
    } else if (!anyPost) {
      notice.innerHTML = `<div class="notice">Aktuell liegen nur <b>Pre-Test-Daten</b> vor, die Post-Tests laufen noch. Die Balken zeigen die <span class="mint">Ausgangswerte (Baseline)</span>. Sobald Post-Daten in der CSV stehen, erscheint hier automatisch der gepaarte Pre&nbsp;→&nbsp;Post-Vergleich.</div>`;
    } else {
      notice.innerHTML = "";
    }

    const grid = document.getElementById("chartGrid");
    const entries = Object.entries(META).filter(([, m]) => m.show);
    grid.innerHTML = entries.map(([name, m], i) => {
      const dom = DOMAINS[m.domain] || {};
      return `<div class="chart-card reveal">
        <div class="ch-head"><h4>${m.short}</h4><span class="dom">${dom.label || ""}</span></div>
        <div class="sub" id="sub${i}"></div>
        <div class="chart-box"><canvas id="cv${i}"></canvas></div>
      </div>`;
    }).join("");

    entries.forEach(([name, m], i) => {
      const rows = sel.filter(r => r.test === name);
      // Gepaart: gibt es Post-Daten, werden Pre UND Post nur über dieselben
      // Personen gerechnet (fairer Vergleich). Sonst Pre-Baseline aller Aktiven.
      const postRows = rows.filter(isPost);
      const paired = new Set(postRows.map(r => r.teilnehmer));
      const preRows = paired.size
        ? rows.filter(r => isPre(r) && paired.has(r.teilnehmer))
        : rows.filter(isPre);
      const pre = metricValue(preRows, m.metric);
      const post = metricValue(postRows, m.metric);
      const flat = m.domain === "kontrolle";
      const color = flat ? PINK : MINT;
      const sub = document.getElementById("sub" + i);

      let delta = "";
      if (pre != null && post != null) {
        const better = (m.better === "down") ? post < pre : post > pre;
        const pct = m.metric === "acc"
          ? Math.round(post - pre) + " %-Pkt."
          : Math.round(100 * (post - pre) / pre) + " %";
        delta = `${unit(m.metric)} · Δ ${pct} ${better ? "✓ besser" : "schlechter"}`;
      } else if (pre != null) {
        delta = `${unit(m.metric)} · Post-Test ausstehend`;
      } else {
        delta = "keine Daten";
      }
      sub.textContent = delta;

      const ctx = document.getElementById("cv" + i);
      CHARTS.push(new Chart(ctx, {
        type: "bar",
        data: {
          labels: ["Pre", "Post"],
          datasets: [{
            data: [pre, post],
            backgroundColor: [color + "66", color],
            borderColor: color, borderWidth: 1, borderRadius: 2,
            maxBarThickness: 70,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: { label: c => fmt(c.raw, m.metric) },
              backgroundColor: "#2c1327", borderColor: LINE, borderWidth: 1,
              titleColor: INK, bodyColor: INK,
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: INK_DIM } },
            y: { beginAtZero: true, grid: { color: LINE }, ticks: { color: INK_DIM,
                 callback: v => m.metric === "rt" ? (v / 1000) + "s" : v } },
          },
        },
      }));
    });
    revealInit();
  }

  /* ---------- 5) Menü, Reveal ------------------------------------------ */
  function wireUI() {
    const mb = document.getElementById("menuBtn"), nav = document.getElementById("nav");
    mb.onclick = () => nav.classList.toggle("open");
    nav.querySelectorAll("a").forEach(a => a.onclick = () => nav.classList.remove("open"));
  }

  let io;
  function revealInit() {
    if (!io) io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { threshold: .12 });
    document.querySelectorAll(".reveal:not(.in)").forEach(el => io.observe(el));
  }

  /* ---------- 6) Init -------------------------------------------------- */
  (async function init() {
    const text = await loadCSV();
    ROWS = parseCSV(text);
    buildParticipants();
    renderStats();
    renderTestCards();
    renderChips();
    renderCharts();
    wireUI();
    revealInit();
    const ds = document.getElementById("dataStamp");
    if (ds) ds.textContent = DATA_SOURCE;
  })();
})();
