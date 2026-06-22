/* =========================================================================
   DER TETRIS-EFFEKT — App-Logik
   Liest die CSV und berechnet & zeichnet die komplette Auswertung
   (alle Metriken pro Test) inkl. spielerischem Tipp-&-Aufdecken.
   Keine Aussortierung von Probanden.
   ========================================================================= */
(() => {
  "use strict";

  const ACCENT = "#2fc8ff";   // cyan  (Verbesserung erwartet)
  const ACCENT2 = "#ffd23d";  // gold  (Kontrolle / Stagnation)
  const INK = "#ffffff", INK_DIM = "rgba(255,255,255,.6)", LINE = "rgba(126,156,255,.28)";
  const SURFACE = "#0f1657";
  const META = window.TEST_META || {};
  const DOMAINS = window.DOMAINS || {};
  const FRAGEN = window.FRAGEBOGEN || [];

  // Jede kognitive Domäne hat ihre eigene Tetromino-Farbe
  const DOMAIN_COLORS = {
    raeumlich: "#2fc8ff",   // cyan
    tempo: "#ff3d9a",       // magenta
    gedaechtnis: "#3fd64a", // grün
    exekutiv: "#ffd23d",    // gold
    reaktion: "#ff9f1f",    // orange
    kontrolle: "#b46bff",   // violett
  };
  const domColor = d => DOMAIN_COLORS[d] || "#2fc8ff";
  const STAT_COLORS = ["#2fc8ff", "#ff3d9a", "#3fd64a", "#ffd23d"];

  /* ---------- 1) CSV laden --------------------------------------------- */
  async function loadCSV() {
    try {
      const r = await fetch("data/rohdaten_alle.csv", { cache: "no-store" });
      if (r.ok) return await r.text();
    } catch (_) {
      console.warn("[Tetris-Effekt] CSV nicht per fetch geladen (file://?). Eingebettete Daten aktiv. " +
        "Nach CSV-Änderung 'python3 tools/build-data.py' ausführen oder über Server/GitHub Pages öffnen.");
    }
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
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const isPre = r => r.phase === "pre";
  const isPost = r => r.phase === "post";

  /* ---------- 2) Metrik-Berechnung ------------------------------------- */
  function median(arr) {
    const a = arr.filter(x => x != null).sort((x, y) => x - y);
    if (!a.length) return null;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  const validTimes = rows => rows.map(r => num(r["Zeit"])).filter(z => z != null && z > 100 && z < 60000);

  function calcMetric(rows, m) {
    if (!rows.length) return null;
    switch (m.calc) {
      case "acc": {
        const v = rows.filter(r => r["Richtig?"] === "true" || r["Richtig?"] === "false");
        return v.length ? 100 * v.filter(r => r["Richtig?"] === "true").length / v.length : null;
      }
      case "rt":
        return median(validTimes(m.correctOnly ? rows.filter(r => r["Richtig?"] === "true") : rows));
      case "maxspan": {
        const ok = rows.filter(r => r["Richtig?"] === "true").map(r => num(r["Länge"])).filter(x => x != null);
        return ok.length ? Math.max(...ok) : null;
      }
      case "meanspan": {
        const all = rows.map(r => num(r["Länge"])).filter(x => x != null);
        return all.length ? mean(all) : null;
      }
      case "mean": {
        const xs = rows.map(r => num(r[m.col])).filter(x => x != null);
        return xs.length ? mean(xs) : null;
      }
      case "ratioTrue": {
        const w = rows.filter(r => r[m.col] === "true" || r[m.col] === "false");
        return w.length ? 100 * w.filter(r => r[m.col] === "true").length / w.length : null;
      }
      case "ratioEquals": {
        const w = rows.filter(r => (r[m.col] || "") !== "");
        return w.length ? 100 * w.filter(r => r[m.col] === m.equals).length / w.length : null;
      }
      case "switchcost": {
        const sw = validTimes(rows.filter(r => r["Regelwechsel?"] === "true"));
        const no = validTimes(rows.filter(r => r["Regelwechsel?"] === "false"));
        return (sw.length && no.length) ? median(sw) - median(no) : null;
      }
    }
    return null;
  }
  function fmtVal(v, unit) {
    if (v == null) return "k. A.";
    if (unit === "pct") return Math.round(v) + " %";
    if (unit === "ms") return Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + " s" : Math.round(v) + " ms";
    if (unit === "int") return String(Math.round(v));
    if (unit === "count") return v.toFixed(1);
    return String(v);
  }
  const axisTick = (v, unit) => unit === "pct" ? v + "%" : (unit === "ms" ? (v >= 1000 ? (v / 1000) + "s" : v) : v);

  /* ---------- 3) State -------------------------------------------------- */
  const CONTROL = new Set(window.CONTROL_GROUP || []);
  let ROWS = [], PARTS = [];
  const manualOff = new Set();
  let activeTest = Object.keys(META)[0];
  let revealed = false, guess = null;   // Tipp-Spiel-Zustand
  let groupFilter = "all";              // "all" | "training" | "control"

  function buildParticipants() {
    const map = new Map();
    ROWS.forEach(r => {
      const p = r.teilnehmer || "?";
      if (!map.has(p)) map.set(p, { name: p, rows: [], pre: 0, post: 0, control: CONTROL.has(p) });
      const e = map.get(p);
      e.rows.push(r);
      if (isPre(r)) e.pre++; else if (isPost(r)) e.post++;
    });
    PARTS = [...map.values()].sort((a, b) => b.rows.length - a.rows.length);
  }
  function inGroup(name) {
    if (groupFilter === "control") return CONTROL.has(name);
    if (groupFilter === "training") return !CONTROL.has(name);
    return true;
  }
  const activeNames = () => new Set(PARTS.filter(p => inGroup(p.name) && !manualOff.has(p.name)).map(p => p.name));

  /* ---------- 4) Statik ------------------------------------------------- */
  function renderStats() {
    const el = document.getElementById("statStrip");
    const cards = [
      ["Proband:innen", PARTS.length, ""],
      ["Kognitive Tests", Object.keys(META).length, ""],
      ["Erfasste Datenpunkte", ROWS.length.toLocaleString("de-DE"), ""],
      ["Trainingsdauer", "14", "<small> Tage · 30 min</small>"],
    ];
    el.innerHTML = cards.map(([k, v, s], i) => {
      const c = STAT_COLORS[i % STAT_COLORS.length];
      return `<div class="stat reveal" style="border-top:3px solid ${c}"><div class="k" style="color:${c}">${k}</div><div class="v">${v}${s}</div></div>`;
    }).join("");
  }
  function renderTestCards() {
    const grid = document.getElementById("testGrid");
    grid.innerHTML = Object.entries(META).map(([name, m]) => {
      const dom = DOMAINS[m.domain] || {};
      const flat = m.domain === "kontrolle";
      const c = domColor(m.domain);
      return `<div class="card reveal" style="border-top:3px solid ${c}">
        <h3 style="color:${c}">${m.short}</h3>
        <p>${m.measures}</p>
        <div class="tagrow">
          <span class="tag" style="color:${c};border-color:${c}99">${dom.label || m.domain}</span>
          <span class="tag ${flat ? "flat" : "up"}">${dom.expectation || ""}</span>
        </div>
        <div class="why" style="border-left-color:${c}">${m.why}</div>
        <div class="metric-list">Erfasst: ${m.metrics.map(x => x.label).join(" · ")}</div>
      </div>`;
    }).join("");
  }

  /* ---------- 5) Ergebnisse -------------------------------------------- */
  function renderGroupFilter() {
    const el = document.getElementById("groupFilter");
    if (!el) return;
    const opts = [["all", "Alle"], ["training", "Trainingsgruppe"], ["control", "Kontrollgruppe"]];
    el.innerHTML = opts.map(([v, l]) =>
      `<button class="gf ${v === groupFilter ? "on" : ""}" data-g="${v}">${l}</button>`).join("");
    el.querySelectorAll(".gf").forEach(b => b.onclick = () => {
      groupFilter = b.dataset.g; renderGroupFilter(); renderChips(); renderMetrics();
    });
  }
  function renderChips() {
    const box = document.getElementById("pchips");
    const list = PARTS.filter(p => inGroup(p.name));
    box.innerHTML = list.length
      ? list.map(p => {
          const off = manualOff.has(p.name);
          const k = p.control ? ' <span class="chip-k" title="Kontrollgruppe">K</span>' : '';
          return `<span class="chip ${off ? "off" : "on"}" data-p="${p.name}">${p.name}${k}</span>`;
        }).join("")
      : `<span class="chip-empty">Keine Proband:innen in dieser Gruppe (Namen in config.js → CONTROL_GROUP eintragen).</span>`;
    box.querySelectorAll(".chip").forEach(c => c.onclick = () => {
      const n = c.dataset.p;
      manualOff.has(n) ? manualOff.delete(n) : manualOff.add(n);
      renderChips(); renderMetrics();
    });
  }
  function renderTabs() {
    const tabs = document.getElementById("testTabs");
    tabs.innerHTML = Object.entries(META).map(([name, m]) => {
      const c = domColor(m.domain), on = name === activeTest;
      const style = on ? ` style="background:${c};border-color:${c};color:#0c1140"` : ` style="border-color:${c}66"`;
      return `<button class="tab ${on ? "on" : ""}"${style} data-t="${name}">${m.short}</button>`;
    }).join("");
    tabs.querySelectorAll(".tab").forEach(b => b.onclick = () => {
      activeTest = b.dataset.t; revealed = false; guess = null;   // neuer Test = neuer Tipp
      renderTabs(); renderMetrics();
    });
  }

  let CHARTS = [];
  function renderMetrics() {
    CHARTS.forEach(c => c.destroy()); CHARTS = [];
    const names = activeNames();
    const sel = ROWS.filter(r => names.has(r.teilnehmer));
    const m = META[activeTest];
    const dom = DOMAINS[m.domain] || {};
    const flat = m.domain === "kontrolle";
    const color = domColor(m.domain);

    const testRows = sel.filter(r => r.test === activeTest);
    const postRows = testRows.filter(isPost);
    const paired = new Set(postRows.map(r => r.teilnehmer));
    const preRows = paired.size ? testRows.filter(r => isPre(r) && paired.has(r.teilnehmer)) : testRows.filter(isPre);
    const hasPost = postRows.length > 0;
    const playable = hasPost && names.size > 0;

    // Hinweis zur Datenlage
    const notice = document.getElementById("resultNotice");
    if (!names.size) notice.innerHTML = `<div class="notice">Keine Proband:innen ausgewählt. Klicke unten mindestens einen Chip an.</div>`;
    else if (!sel.some(isPost)) notice.innerHTML = `<div class="notice">Aktuell liegen nur <b>Pre-Test-Daten</b> vor, die Post-Tests laufen noch. Die Balken zeigen die <span class="accent">Ausgangswerte (Baseline)</span>. Sobald Post-Daten in der CSV stehen, lässt sich hier auch tippen und aufdecken.</div>`;
    else notice.innerHTML = "";

    // Test-Kontext
    document.getElementById("testContext").innerHTML =
      `<span class="tag" style="color:${color};border-color:${color}99">${dom.label || m.domain}</span>
       <span class="tag ${flat ? "flat" : "up"}">${dom.expectation || ""}</span>
       <p>${m.why}</p>`;

    // Tipp-Spiel
    const guessPanel = document.getElementById("guessPanel");
    const verdictEl = document.getElementById("verdict");
    const showPost = revealed || !playable;   // ohne Post-Daten gibt es nichts zu verdecken
    if (playable && !revealed) {
      guessPanel.innerHTML = `<div class="guess">
        <div class="guess-q">Glaubst du, 2&nbsp;Wochen Tetris haben bei <span class="accent">${m.short}</span> geholfen?</div>
        <div class="guess-btns">
          <button class="gbtn" data-g="besser">Ja, besser geworden</button>
          <button class="gbtn" data-g="gleich">Kein Unterschied</button>
          <button class="gbtn" data-g="schlechter">Nein, schlechter</button>
          <button class="gbtn reveal-now" data-g="">Direkt aufdecken</button>
        </div></div>`;
      guessPanel.querySelectorAll(".gbtn").forEach(b => b.onclick = () => {
        guess = b.dataset.g || null; revealed = true; renderMetrics();
      });
      verdictEl.innerHTML = "";
    } else {
      guessPanel.innerHTML = "";
    }

    // Metrik-Charts
    const grid = document.getElementById("metricGrid");
    grid.innerHTML = m.metrics.map((mt, i) =>
      `<div class="chart-card">
        <div class="ch-head"><h4>${mt.label}</h4></div>
        ${mt.desc ? `<div class="metric-desc">${mt.desc}</div>` : ""}
        <div class="sub" id="sub${i}"></div>
        <div class="chart-box"><canvas id="cv${i}"></canvas></div>
        <div class="metric-verdict" id="verdict${i}"></div>
      </div>`).join("");

    let nBetter = 0, nWorse = 0, nSame = 0;
    m.metrics.forEach((mt, i) => {
      const pre = calcMetric(preRows, mt);
      const post = (hasPost && showPost) ? calcMetric(postRows, mt) : null;
      const sub = document.getElementById("sub" + i);
      const vEl = document.getElementById("verdict" + i);

      if (pre != null && post != null) {
        const better = (mt.better === "down") ? post < pre : post > pre;
        const diffPct = mt.unit === "pct" ? Math.abs(post - pre) : (pre ? Math.abs(100 * (post - pre) / pre) : 0);
        const same = diffPct < 2;
        if (same) nSame++; else if (better) nBetter++; else nWorse++;
        const d = (mt.unit === "pct")
          ? (post - pre >= 0 ? "+" : "") + Math.round(post - pre) + " %-Pkt."
          : (post - pre >= 0 ? "+" : "") + Math.round(100 * (post - pre) / pre) + " %";
        sub.textContent = `Δ ${d} · ${same ? "gleich" : (better ? "✓ besser" : "schlechter")}`;
        // Bewertungssatz
        let v;
        if (same) v = "Vorher und nachher fast gleich, also kein klarer Effekt.";
        else {
          const grad = diffPct >= 12 ? "deutlich" : "etwas";
          if (mt.unit === "ms") v = better ? `Die Gruppe war ${grad} schneller.` : `Die Gruppe war ${grad} langsamer.`;
          else if (mt.unit === "pct") v = better ? `Das wurde ${grad} besser.` : `Das wurde ${grad} schlechter.`;
          else v = better ? `Der Wert wurde ${grad} besser.` : `Der Wert wurde ${grad} schlechter.`;
          if (flat && better) v += " Bei der Kontrollaufgabe spricht das eher für einen Übungseffekt.";
        }
        if (vEl) vEl.textContent = "Beurteilung: " + v;
      } else if (pre != null && hasPost && !showPost) {
        sub.textContent = "Pre sichtbar · tippe oben, um Post aufzudecken";
        if (vEl) vEl.textContent = "";
      } else if (pre != null) {
        sub.textContent = "Post-Test ausstehend";
        if (vEl) vEl.textContent = "Beurteilung folgt, sobald die Post-Tests vorliegen.";
      } else {
        sub.textContent = "keine Daten";
        if (vEl) vEl.textContent = "";
      }

      CHARTS.push(new Chart(document.getElementById("cv" + i), {
        type: "bar",
        data: {
          labels: ["Pre", "Post"],
          datasets: [{
            data: [pre, post],
            backgroundColor: [color + "66", color],
            borderColor: color, borderWidth: 1, borderRadius: 3, maxBarThickness: 64,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 650 },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: { label: c => c.raw == null ? "k. A." : fmtVal(c.raw, mt.unit) },
              backgroundColor: SURFACE, borderColor: LINE, borderWidth: 1, titleColor: INK, bodyColor: INK,
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: INK_DIM } },
            y: { beginAtZero: true, grid: { color: LINE }, ticks: { color: INK_DIM, callback: v => axisTick(v, mt.unit) } },
          },
        },
      }));
    });

    // Auflösung des Tipps
    if (playable && revealed) {
      const actual = nBetter > nWorse ? "besser" : (nWorse > nBetter ? "schlechter" : "gleich");
      let cls, emoji, text;
      if (guess === null) { cls = "neutral"; emoji = "👀"; text = "Aufgedeckt!"; }
      else if (guess === actual) { cls = "hit"; emoji = "🎉"; text = "Richtig getippt!"; }
      else { cls = "miss"; emoji = "🤔"; text = "Knapp daneben!"; }
      verdictEl.innerHTML = `<div class="verdict ${cls}">
        <span class="v-emoji">${emoji}</span>
        <span class="v-text">${text}</span>
        <span class="v-sub">Über die Kennzahlen: ${nBetter}× besser, ${nWorse}× schlechter, ${nSame}× gleich.
          <button class="gbtn" id="againBtn" style="margin-left:10px;padding:6px 12px">Nochmal tippen</button></span>
      </div>`;
      const again = document.getElementById("againBtn");
      if (again) again.onclick = () => { revealed = false; guess = null; renderMetrics(); };
    } else {
      verdictEl.innerHTML = "";
    }
  }

  /* ---------- 6) Abschluss-Fragebogen (Audio-Antworten) ---------------- */
  function renderFragebogen() {
    const grid = document.getElementById("qgrid");
    if (!grid) return;
    const palette = ["#2fc8ff", "#ff3d9a", "#3fd64a", "#ffd23d", "#ff9f1f", "#b46bff"];
    grid.innerHTML = FRAGEN.map((q, i) => {
      const c = palette[i % palette.length];
      const ans = q.antworten || [];
      const body = ans.length
        ? `<div class="qanswers">` + ans.map(a =>
            `<div class="qanswer"><span class="alabel">${a.label || "Antwort"}</span>
             <audio controls preload="none" src="${a.src}"></audio></div>`).join("") + `</div>`
        : `<div class="qpending">Antworten folgen. Audiodatei in <code>assets/audio/</code> ablegen und in <code>config.js</code> verknüpfen.</div>`;
      return `<div class="qcard reveal" style="border-top:3px solid ${c}">
        <div class="qtop"><span class="qnum" style="color:${c}">${String(i + 1).padStart(2, "0")}</span>
          <span class="qcat">${q.kategorie}</span></div>
        <p class="qtext">${q.frage}</p>${body}</div>`;
    }).join("");
    revealInit();
  }

  /* ---------- 7) Menü, Reveal, Init ------------------------------------ */
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

  (async function init() {
    ROWS = parseCSV(await loadCSV());
    buildParticipants();
    renderStats();
    renderTestCards();
    renderGroupFilter();
    renderChips();
    renderTabs();
    renderMetrics();
    renderFragebogen();
    wireUI();
    revealInit();
  })();
})();
