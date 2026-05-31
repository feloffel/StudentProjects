/* =====================================================================
   Tetris-Effekt — Mess-App (Teilnehmer-Ansicht)
   Ablauf pro Sitzung: Mentale Rotation -> Lücken-Einpassen -> Corsi
   -> Zeitproduktion -> Kontrollaufgabe (nicht-räumlich) -> Fertig
   Daten: pro Sitzung ein Dokument in Firestore-Collection "sessions"
   ===================================================================== */
'use strict';

/* ---------- Parameter (zentral einstellbar) ---------- */
const CFG = {
  ROTATION_TRIALS: 20,
  GAPFIT_TRIALS: 15,
  CORSI_START: 3,
  CORSI_MAX: 8,
  CORSI_TRIALS_PER_LEN: 2,   // weiter, wenn >=1 richtig; Abbruch, wenn beide falsch
  CONTROL_TRIALS: 20,
  TIME_TARGETS: [30, 60],    // Sekunden (Zeitproduktion)
  FIX_MS: 500,               // Fixationskreuz
  FIX_JITTER_MS: 350,        // zufällige Zusatzpause gegen Antizipation
  ENABLE_PROBE: false        // optionale, suggestive "Transfer-Sonde" (s. Konzept 4.2). Standard: AUS
};

/* ---------- Studientage / Phasen ---------- */
const DAY_OPTIONS = [
  { group: 'Baseline (ohne Tetris)', items: [
    { v: 'baseline:-2', label: 'Baseline 1' },
    { v: 'baseline:-1', label: 'Baseline 2' },
    { v: 'baseline:0',  label: 'Baseline 3' }
  ]},
  { group: 'Intervention (täglich Tetris)', items:
    Array.from({length:14}, (_,i)=>({ v:`intervention:${i+1}`, label:`Tag ${i+1}` })) },
  { group: 'Washout (ohne Tetris)', items: [
    { v: 'washout:1', label: 'Washout 1' },
    { v: 'washout:2', label: 'Washout 2' },
    { v: 'washout:3', label: 'Washout 3' }
  ]}
];

/* ---------- Tetromino-Daten ---------- */
// Zellen als [x,y]. Farben in CSS-Variablen gespiegelt.
const SHAPES = {
  I: { cells: [[0,0],[1,0],[2,0],[3,0]], color: 'var(--t-i)' },
  O: { cells: [[0,0],[1,0],[0,1],[1,1]], color: 'var(--t-o)' },
  T: { cells: [[0,0],[1,0],[2,0],[1,1]], color: 'var(--t-t)' },
  S: { cells: [[1,0],[2,0],[0,1],[1,1]], color: 'var(--t-s)' },
  Z: { cells: [[0,0],[1,0],[1,1],[2,1]], color: 'var(--t-z)' },
  J: { cells: [[0,0],[0,1],[1,1],[2,1]], color: 'var(--t-j)' },
  L: { cells: [[2,0],[0,1],[1,1],[2,1]], color: 'var(--t-l)' }
};
// Chirale Formen für die Rotationsaufgabe (Spiegelbild ist NICHT durch Drehung erreichbar)
const CHIRAL = ['L','J','S','Z'];

/* ---------- Hilfsfunktionen ---------- */
const $  = (sel) => document.querySelector(sel);
const app = () => $('#app');
const rnd  = (a,b) => a + Math.random()*(b-a);
const rint = (a,b) => Math.floor(rnd(a,b+1));
const pick = (arr) => arr[rint(0,arr.length-1)];
const shuffle = (arr) => { const a=arr.slice(); for(let i=a.length-1;i>0;i--){const j=rint(0,i);[a[i],a[j]]=[a[j],a[i]];} return a; };
const mean = (xs) => xs.length ? xs.reduce((s,x)=>s+x,0)/xs.length : null;
const median = (xs) => { if(!xs.length) return null; const a=xs.slice().sort((p,q)=>p-q); const m=Math.floor(a.length/2); return a.length%2? a[m] : (a[m-1]+a[m])/2; };
const round = (x,n=0) => x==null? null : Math.round(x*10**n)/10**n;
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));
function normalize(cells){ const mx=Math.min(...cells.map(c=>c[0])), my=Math.min(...cells.map(c=>c[1])); return cells.map(([x,y])=>[x-mx,y-my]); }
function rotateCells(cells){ // 90° im Uhrzeigersinn
  return normalize(cells.map(([x,y])=>[ -y, x ]));
}
function rotateN(cells,n){ let c=cells; for(let i=0;i<((n%4)+4)%4;i++) c=rotateCells(c); return c; }
function cellKey(cells){ return normalize(cells).map(c=>c.join(',')).sort().join(';'); }

/* ---------- SVG-Form (Block) zeichnen ---------- */
function shapeSVG(cells, { size=170, cell=26, gap=3, color='var(--accent)', angle=0, mirror=false } = {}){
  const nc = normalize(cells);
  const cols = Math.max(...nc.map(c=>c[0]))+1;
  const rows = Math.max(...nc.map(c=>c[1]))+1;
  const w = cols*cell, h = rows*cell;
  const ox = (size - w)/2, oy = (size - h)/2;
  let rects = '';
  for (const [x,y] of nc){
    const px = ox + x*cell + gap/2, py = oy + y*cell + gap/2, s = cell-gap;
    rects += `<rect x="${px}" y="${py}" width="${s}" height="${s}" rx="3" fill="${color}"/>`
          +  `<rect x="${px}" y="${py}" width="${s}" height="${Math.max(3,s*0.22)}" rx="3" fill="rgba(255,255,255,.28)"/>`;
  }
  const tr = [];
  if (mirror) tr.push(`translate(${size} 0) scale(-1 1)`);
  const inner = `<g transform="${tr.join(' ')}">${rects}</g>`;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">`
       + `<g transform="rotate(${angle} ${size/2} ${size/2})">${inner}</g></svg>`;
}

/* ---------- Sitzungs-Datensatz ---------- */
let SESSION = null;
function newSession(participantId, dayValue, dayLabel){
  const [phase, dayNum] = dayValue.split(':');
  return {
    studyId: (typeof STUDY_ID!=='undefined'? STUDY_ID : 'study'),
    participantId, phase, day: Number(dayNum), dayLabel,
    startedAt: new Date().toISOString(), finishedAt: null,
    device: { ua: navigator.userAgent, screen: `${screen.width}x${screen.height}`, dpr: window.devicePixelRatio||1 },
    rotation:null, gapfit:null, corsi:null, timeprod:null, control:null, probe:null,
    note:'', estPlayMin:null
  };
}

/* =====================================================================
   SCREEN-ROUTER
   ===================================================================== */
function setScreen(html){ app().innerHTML = html; try{ window.scrollTo(0,0); }catch(e){} }

function progressBar(stepIndex){
  const steps = ['Rotation','Einpassen','Gedächtnis','Zeit','Kontrolle'];
  return `<div class="progress">${steps.map((s,i)=>
    `<div class="pstep ${i<stepIndex?'done':''} ${i===stepIndex?'active':''}"><span class="pdot"></span>${s}</div>`
  ).join('')}</div>`;
}

/* ---------- Welcome ---------- */
function screenWelcome(){
  const last = JSON.parse(localStorage.getItem('tetris_lastSession')||'null');
  const savedPid = localStorage.getItem('tetris_pid')||'';
  const opts = DAY_OPTIONS.map(g=>`<optgroup label="${g.group}">`+
    g.items.map(it=>`<option value="${it.v}">${it.label}</option>`).join('')+`</optgroup>`).join('');
  setScreen(`
    <div class="card welcome">
      <div class="brand"><span class="logo">${miniBlocks()}</span><div>
        <h1>Wahrnehmungs-Studie</h1>
        <p class="sub">Tägliche Kurzmessung · ca. 10–15 Minuten</p></div></div>
      <p class="lead">Diese Sitzung umfasst fünf kurze Aufgaben zu Aufmerksamkeit, Gedächtnis und Zeitgefühl.
      Mach sie ruhig, konzentriert und an einem ungestörten Ort. Es gibt kein „richtig schnell genug“ – antworte zügig, aber sorgfältig.</p>

      <label class="fld"><span>Teilnehmer-Code</span>
        <input id="pid" type="text" placeholder="z. B. TP-01" value="${savedPid}" autocomplete="off"></label>
      <label class="fld"><span>Heutiger Studientag</span>
        <select id="day">${opts}</select></label>

      ${last? `<p class="hint">Zuletzt abgeschlossen: <b>${last.dayLabel}</b> (${new Date(last.finishedAt||last.startedAt).toLocaleString('de-DE')})</p>`:''}

      <div class="cloud ${cloudReady()?'on':'off'}">${cloudReady()
        ? '● Online-Sicherung aktiv (Firebase)'
        : '○ Offline-Modus – Daten werden lokal gespeichert (Firebase nicht konfiguriert)'}</div>

      <button class="btn primary big" id="start">Sitzung starten</button>
      <button class="btn ghost" id="export">Bisherige Daten exportieren</button>
    </div>`);
  $('#start').onclick = () => {
    const pid = $('#pid').value.trim();
    if(!pid){ $('#pid').focus(); $('#pid').classList.add('err'); return; }
    localStorage.setItem('tetris_pid', pid);
    const sel = $('#day'); const dayValue = sel.value; const dayLabel = sel.options[sel.selectedIndex].text;
    SESSION = newSession(pid, dayValue, dayLabel);
    screenIntro('rotation');
  };
  $('#export').onclick = exportLocal;
}

/* ---------- Instruktions-Screens ---------- */
const INTRO = {
  rotation: { step:0, title:'1 · Mentale Rotation', body:
    'Du siehst <b>zwei Figuren</b>. Die rechte ist gedreht. Entscheide, ob sie dieselbe Figur wie links ist (nur gedreht) oder ihr <b>Spiegelbild</b>.',
    keys:'Tasten: <b>F</b> = identisch · <b>J</b> = gespiegelt', go:runRotation },
  gapfit: { step:1, title:'2 · Lücken-Einpassen', body:
    'Oben siehst du ein Feld mit einer <b>Lücke</b>. Wähle aus den vier Teilen darunter das, das die Lücke <b>exakt</b> füllt.',
    keys:'Tasten: <b>1–4</b> für die vier Teile', go:runGapfit },
  corsi: { step:2, title:'3 · Räumliches Gedächtnis', body:
    'Felder leuchten <b>nacheinander</b> auf. Merke dir die Reihenfolge und <b>tippe sie danach in gleicher Reihenfolge</b> nach. Die Folgen werden länger.',
    keys:'Mit Maus/Finger antippen', go:runCorsi },
  timeprod: { step:3, title:'4 · Zeitgefühl', body:
    'Schätze eine Zeitspanne <b>ohne zu zählen</b> und ohne Uhr. Drücke „Start“ und dann „Stopp“, wenn du glaubst, die Zeit sei um. Einfach auf dein Gefühl verlassen.',
    keys:'', go:runTimeprod },
  control: { step:4, title:'5 · Kopfrechnen', body:
    'Löse einfache Rechenaufgaben. Wähle aus vier Antworten die richtige – zügig, aber genau.',
    keys:'Tasten: <b>1–4</b> für die vier Antworten', go:runControl }
};
function screenIntro(key){
  const I = INTRO[key];
  setScreen(`
    <div class="card">
      ${progressBar(I.step)}
      <h2 class="ttl">${I.title}</h2>
      <p class="lead">${I.body}</p>
      ${I.keys? `<p class="keys">${I.keys}</p>`:''}
      <button class="btn primary big" id="go">Los geht’s</button>
    </div>`);
  $('#go').onclick = I.go;
}

/* ---------- Fixationskreuz ---------- */
async function fixation(host){
  host.innerHTML = `<div class="stage"><div class="fix">+</div></div>`;
  await sleep(CFG.FIX_MS + rnd(0,CFG.FIX_JITTER_MS));
}

/* =====================================================================
   TEST 1 — MENTALE ROTATION
   ===================================================================== */
async function runRotation(){
  const trials = [];
  for(let i=0;i<CFG.ROTATION_TRIALS;i++){
    trials.push({ shape: pick(CHIRAL), angle: pick([30,60,90,120,150,180,210,240,300,330]),
                  mirror: i < CFG.ROTATION_TRIALS/2 });
  }
  const seq = shuffle(trials);
  const results = [];
  setScreen(`<div class="card test"><div class="testhead"><span>Mentale Rotation</span><span id="cnt"></span></div><div id="host"></div></div>`);
  const host = $('#host');

  for(let i=0;i<seq.length;i++){
    $('#cnt').textContent = `${i+1} / ${seq.length}`;
    const t = seq[i];
    await fixation(host);
    const ref = shapeSVG(SHAPES[t.shape].cells, { color: SHAPES[t.shape].color });
    const cmp = shapeSVG(SHAPES[t.shape].cells, { color: SHAPES[t.shape].color, angle: t.angle, mirror: t.mirror });
    host.innerHTML = `
      <div class="stage rot">
        <div class="pair"><div class="shp">${ref}</div><div class="vs">?</div><div class="shp">${cmp}</div></div>
        <div class="answers two">
          <button class="btn ans" data-a="same"><kbd>F</kbd> Identisch (gedreht)</button>
          <button class="btn ans" data-a="mir"><kbd>J</kbd> Gespiegelt</button>
        </div>
      </div>`;
    const t0 = performance.now();
    const ans = await waitChoice([['same','f'],['mir','j']]);
    const rt = performance.now() - t0;
    const correct = (ans==='mir') === t.mirror;
    results.push({ i:i+1, shape:t.shape, angle:t.angle, mirror:t.mirror, answer:ans, correct, rt:round(rt) });
    await feedbackFlash(host, correct);
  }
  const rts = results.filter(r=>r.correct).map(r=>r.rt);
  SESSION.rotation = { n:results.length, meanRT:round(mean(rts),1), medianRT:round(median(rts),1),
                       accuracy:round(results.filter(r=>r.correct).length/results.length,3), trials:results };
  screenIntro('gapfit');
}

/* =====================================================================
   TEST 2 — LÜCKEN-EINPASSEN
   ===================================================================== */
function buildGridWithGap(gapCells){
  // 5 Spalten x 4 Zeilen; Lücke = gapCells, Rest gefüllt
  const COLS=5, ROWS=4, cell=34, gap=3, pad=8;
  const set = new Set(gapCells.map(c=>c.join(',')));
  const w = COLS*cell, h = ROWS*cell;
  let r='';
  for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){
    const px=pad+x*cell+gap/2, py=pad+y*cell+gap/2, s=cell-gap;
    if(set.has(`${x},${y}`)) r+=`<rect x="${px}" y="${py}" width="${s}" height="${s}" rx="3" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.18)" stroke-dasharray="3 3"/>`;
    else r+=`<rect x="${px}" y="${py}" width="${s}" height="${s}" rx="3" fill="var(--block-fill)"/>`;
  }
  return `<svg viewBox="0 0 ${w+pad*2} ${h+pad*2}" width="${w+pad*2}" height="${h+pad*2}">${r}</svg>`;
}
function placeGap(shapeKey, rot){
  // platziere rotierte Form so, dass sie ins 5x4-Feld passt
  const cells = rotateN(SHAPES[shapeKey].cells, rot);
  const cols = Math.max(...cells.map(c=>c[0]))+1, rows=Math.max(...cells.map(c=>c[1]))+1;
  const ox = rint(0,5-cols), oy = rint(0,4-rows);
  return cells.map(([x,y])=>[x+ox,y+oy]);
}
async function runGapfit(){
  const keys = Object.keys(SHAPES);
  const trials = [];
  for(let i=0;i<CFG.GAPFIT_TRIALS;i++){
    const correctKey = pick(keys); const rot = rint(0,3);
    const correctOriented = rotateN(SHAPES[correctKey].cells, rot);
    const correctKeyNorm = cellKey(correctOriented);
    // 3 Distraktoren mit anderer normalisierter Form
    const distract = [];
    let guard=0;
    while(distract.length<3 && guard++<200){
      const dk = pick(keys); const dr = rint(0,3);
      const dc = rotateN(SHAPES[dk].cells, dr);
      const k = cellKey(dc);
      if(k!==correctKeyNorm && !distract.some(d=>d.k===k)) distract.push({ key:dk, cells:dc, color:SHAPES[dk].color, k });
    }
    const correct = { key:correctKey, cells:correctOriented, color:SHAPES[correctKey].color, k:correctKeyNorm, isCorrect:true };
    const options = shuffle([correct, ...distract]);
    trials.push({ correctKey, rot, gapCells: placeGap(correctKey, rot), options, correctIndex: options.indexOf(correct) });
  }
  const results = [];
  setScreen(`<div class="card test"><div class="testhead"><span>Lücken-Einpassen</span><span id="cnt"></span></div><div id="host"></div></div>`);
  const host = $('#host');

  for(let i=0;i<trials.length;i++){
    $('#cnt').textContent = `${i+1} / ${trials.length}`;
    const t = trials[i];
    await fixation(host);
    host.innerHTML = `
      <div class="stage gap">
        <div class="well">${buildGridWithGap(t.gapCells)}<div class="welllbl">Welches Teil füllt die Lücke?</div></div>
        <div class="answers four">
          ${t.options.map((o,k)=>`<button class="btn ans opt" data-a="${k}"><kbd>${k+1}</kbd>${shapeSVG(o.cells,{size:96,cell:20,color:o.color})}</button>`).join('')}
        </div>
      </div>`;
    const t0 = performance.now();
    const ans = await waitChoice(t.options.map((_,k)=>[String(k), String(k+1)]));
    const rt = performance.now() - t0;
    const correct = Number(ans) === t.correctIndex;
    results.push({ i:i+1, shape:t.correctKey, rot:t.rot, chosen:Number(ans), correctIndex:t.correctIndex, correct, rt:round(rt) });
    await feedbackFlash(host, correct);
  }
  const rts = results.filter(r=>r.correct).map(r=>r.rt);
  SESSION.gapfit = { n:results.length, meanRT:round(mean(rts),1), medianRT:round(median(rts),1),
                     accuracy:round(results.filter(r=>r.correct).length/results.length,3), trials:results };
  screenIntro('corsi');
}

/* =====================================================================
   TEST 3 — CORSI (räumliches Arbeitsgedächtnis)
   ===================================================================== */
async function runCorsi(){
  const N=9; // 3x3
  setScreen(`<div class="card test"><div class="testhead"><span>Räumliches Gedächtnis</span><span id="cnt"></span></div><div id="host"></div></div>`);
  const host = $('#host');
  const trials = [];
  let span = 0;
  let len = CFG.CORSI_START;

  while(len <= CFG.CORSI_MAX){
    let correctAtLen = 0;
    for(let rep=0; rep<CFG.CORSI_TRIALS_PER_LEN; rep++){
      const seq = shuffle([...Array(N).keys()]).slice(0,len);
      $('#cnt').textContent = `Länge ${len}`;
      host.innerHTML = `<div class="stage corsi"><div class="grid3" id="grid">${
        Array.from({length:N},(_,k)=>`<button class="cblk" data-k="${k}" disabled></button>`).join('')}</div>
        <div class="status" id="st">Merke dir die Reihenfolge…</div></div>`;
      await sleep(700);
      // Sequenz zeigen
      for(const k of seq){
        const b = host.querySelector(`.cblk[data-k="${k}"]`);
        b.classList.add('lit'); await sleep(550); b.classList.remove('lit'); await sleep(230);
      }
      // Eingabe
      $('#st').textContent = 'Jetzt nachtippen';
      const resp = await collectTaps(host, len);
      const correct = resp.length===seq.length && resp.every((v,idx)=>v===seq[idx]);
      if(correct) correctAtLen++;
      trials.push({ len, seq, resp, correct });
    }
    if(correctAtLen>0) span = len;
    if(correctAtLen===0) break;      // beide falsch -> Abbruch
    len++;
  }
  const total = trials.length, corr = trials.filter(t=>t.correct).length;
  SESSION.corsi = { span, correctTrials:corr, totalTrials:total, errorRate:round(1-corr/total,3), trials };
  screenIntro('timeprod');
}
function collectTaps(host, need){
  return new Promise(resolve=>{
    const resp=[]; const grid=$('#grid');
    grid.querySelectorAll('.cblk').forEach(b=>{ b.disabled=false; b.onclick=()=>{
      const k=Number(b.dataset.k); resp.push(k);
      b.classList.add('tap'); setTimeout(()=>b.classList.remove('tap'),160);
      if(resp.length>=need){ grid.querySelectorAll('.cblk').forEach(x=>{x.disabled=true;x.onclick=null;}); setTimeout(()=>resolve(resp),200); }
    };});
  });
}

/* =====================================================================
   TEST 4 — ZEITPRODUKTION
   ===================================================================== */
async function runTimeprod(){
  const out = {};
  for(const target of CFG.TIME_TARGETS){
    const ms = await produceInterval(target);
    out[`prod${target}_ms`] = round(ms);
    out[`prod${target}_dev_ms`] = round(ms - target*1000);
  }
  SESSION.timeprod = out;
  screenIntro('control');   // Test 5 folgt
}
function produceInterval(targetSec){
  return new Promise(resolve=>{
    setScreen(`<div class="card test"><div class="testhead"><span>Zeitgefühl</span><span></span></div>
      <div class="stage time">
        <p class="lead center">Drücke <b>Start</b> und dann <b>Stopp</b>, wenn du glaubst, dass
        <b>${targetSec} Sekunden</b> vergangen sind.<br><span class="muted">Nicht zählen, keine Uhr ansehen.</span></p>
        <div class="timebox"><button class="btn primary big" id="tstart">Start</button></div>
      </div></div>`);
    $('#tstart').onclick = () => {
      const t0 = performance.now();
      $('.timebox').innerHTML = `<div class="pulse">●</div><button class="btn primary big" id="tstop">Stopp</button>`;
      $('#tstop').onclick = () => resolve(performance.now()-t0);
    };
  });
}

/* ---------- optionale Transfer-Sonde (Likert) ---------- */
function screenProbe(){
  const qs = [
    'Wie stark hattest du heute den Eindruck, Dinge gedanklich zu „ordnen“ oder „einzupassen“?',
    'Wie oft sind dir heute Muster oder Raster in deiner Umgebung aufgefallen?',
    'Wie lebhaft waren deine inneren Bilder, kurz bevor du gestern eingeschlafen bist?'
  ];
  setScreen(`<div class="card"><h2 class="ttl">Kurze Einschätzung</h2>
    ${qs.map((q,i)=>`<div class="likert"><p>${q}</p><div class="scale" data-q="${i}">
      ${[1,2,3,4,5,6,7].map(n=>`<button data-v="${n}">${n}</button>`).join('')}</div></div>`).join('')}
    <button class="btn primary big" id="pnext" disabled>Weiter</button></div>`);
  const vals={};
  document.querySelectorAll('.scale').forEach(sc=>sc.querySelectorAll('button').forEach(b=>b.onclick=()=>{
    sc.querySelectorAll('button').forEach(x=>x.classList.remove('sel')); b.classList.add('sel');
    vals[sc.dataset.q]=Number(b.dataset.v);
    if(Object.keys(vals).length===qs.length) $('#pnext').disabled=false;
  }));
  $('#pnext').onclick=()=>{ SESSION.probe={ ratings:vals }; screenDone(); };
}

/* =====================================================================
   TEST 5 — KONTROLLE (Kopfrechnen, nicht-räumlich)
   ===================================================================== */
function makeArithmetic(){
  const op = pick(['+','-']);
  let a=rint(11,89), b=rint(11,89);
  if(op==='-' && b>a) [a,b]=[b,a];
  const res = op==='+'? a+b : a-b;
  const opts = new Set([res]);
  while(opts.size<4){ const d=res + pick([-1,1])*rint(1,9); if(d!==res && d>0) opts.add(d); }
  const options = shuffle([...opts]);
  return { q:`${a} ${op} ${b}`, res, options, correctIndex:options.indexOf(res) };
}
async function runControl(){
  const trials = Array.from({length:CFG.CONTROL_TRIALS}, makeArithmetic);
  const results=[];
  setScreen(`<div class="card test"><div class="testhead"><span>Kopfrechnen</span><span id="cnt"></span></div><div id="host"></div></div>`);
  const host=$('#host');
  for(let i=0;i<trials.length;i++){
    $('#cnt').textContent=`${i+1} / ${trials.length}`;
    const t=trials[i];
    await fixation(host);
    host.innerHTML=`<div class="stage calc">
      <div class="eq">${t.q.replace('-','−')} =</div>
      <div class="answers four num">
        ${t.options.map((o,k)=>`<button class="btn ans" data-a="${k}"><kbd>${k+1}</kbd>${o}</button>`).join('')}
      </div></div>`;
    const t0=performance.now();
    const ans=await waitChoice(t.options.map((_,k)=>[String(k),String(k+1)]));
    const rt=performance.now()-t0;
    const correct=Number(ans)===t.correctIndex;
    results.push({ i:i+1, q:t.q, chosen:t.options[Number(ans)], correctAnswer:t.res, correct, rt:round(rt) });
    await feedbackFlash(host, correct);
  }
  const rts=results.filter(r=>r.correct).map(r=>r.rt);
  SESSION.control={ n:results.length, meanRT:round(mean(rts),1), medianRT:round(median(rts),1),
                    accuracy:round(results.filter(r=>r.correct).length/results.length,3), trials:results };
  if(CFG.ENABLE_PROBE) return screenProbe();
  screenDone();
}

/* =====================================================================
   Eingabe-Helfer (Klick ODER Tastatur)
   ===================================================================== */
function waitChoice(map){ // map: [[answerValue, key], ...]
  return new Promise(resolve=>{
    let done=false;
    const finish=(v)=>{ if(done) return; done=true; document.removeEventListener('keydown',onKey); resolve(v); };
    document.querySelectorAll('.ans').forEach(b=>b.onclick=()=>finish(b.dataset.a));
    const onKey=(e)=>{ const k=e.key.toLowerCase(); const hit=map.find(m=>m[1]===k); if(hit) finish(hit[0]); };
    document.addEventListener('keydown',onKey);
  });
}
async function feedbackFlash(host, correct){
  const s=host.querySelector('.stage'); if(s) s.classList.add(correct?'ok':'no');
  await sleep(220);
}

/* =====================================================================
   FERTIG + SPEICHERN
   ===================================================================== */
function screenDone(){
  setScreen(`<div class="card done">
    <h2 class="ttl">Fast geschafft</h2>
    <p class="lead">Zwei kurze, freiwillige Angaben – dann werden deine Daten gesichert.</p>
    <label class="fld"><span>Falls du heute schon gespielt hast: geschätzte Dauer (Minuten)</span>
      <input id="play" type="number" min="0" inputmode="numeric" placeholder="optional"></label>
    <label class="fld"><span>Notiz (optional – etwas Auffälliges heute?)</span>
      <textarea id="note" rows="3" placeholder="optional"></textarea></label>
    <button class="btn primary big" id="finish">Sitzung abschließen &amp; speichern</button>
  </div>`);
  $('#finish').onclick = async () => {
    SESSION.estPlayMin = $('#play').value!==''? Number($('#play').value) : null;
    SESSION.note = $('#note').value.trim();
    SESSION.finishedAt = new Date().toISOString();
    $('#finish').disabled = true; $('#finish').textContent='Speichere…';
    const status = await saveSession(SESSION);
    localStorage.setItem('tetris_lastSession', JSON.stringify({ dayLabel:SESSION.dayLabel, finishedAt:SESSION.finishedAt }));
    screenThanks(status);
  };
}
function screenThanks(status){
  setScreen(`<div class="card thanks">
    <div class="big-tick">${miniBlocks(true)}</div>
    <h2 class="ttl">Danke – Sitzung gespeichert</h2>
    <p class="lead">${status.cloud? '✓ Online gesichert.' : '✓ Lokal gespeichert.'} ${status.cloud?'':'<b>Bitte vor dem Schließen exportieren.</b>'}</p>
    <p class="muted center">Bis zur nächsten Sitzung. Du kannst dieses Fenster jetzt schließen.</p>
    <button class="btn ghost" id="export">Daten exportieren (CSV + JSON)</button>
    <button class="btn ghost" id="again">Neue Sitzung</button>
  </div>`);
  $('#export').onclick=exportLocal;
  $('#again').onclick=screenWelcome;
}

/* =====================================================================
   SPEICHERN: Firestore (wenn konfiguriert) + lokal immer
   ===================================================================== */
function cloudReady(){
  try { return typeof firebase!=='undefined' && typeof FIREBASE_CONFIG!=='undefined'
      && FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('DEIN_'); }
  catch(e){ return false; }
}
let _db=null;
function db(){
  if(_db) return _db;
  if(!firebase.apps || !firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  _db = firebase.firestore(); return _db;
}
function localSessions(){ return JSON.parse(localStorage.getItem('tetris_sessions')||'[]'); }
function pushLocal(s){ const a=localSessions(); a.push(s); localStorage.setItem('tetris_sessions', JSON.stringify(a)); }

async function saveSession(s){
  pushLocal(s); // lokale Sicherung IMMER
  if(!cloudReady()) return { cloud:false };
  try {
    await db().collection('sessions').add(Object.assign({}, s, { serverTime: firebase.firestore.FieldValue.serverTimestamp() }));
    return { cloud:true };
  } catch(err){ console.error('Firestore-Fehler:', err); return { cloud:false, error:String(err) }; }
}

/* ---------- Export (CSV-Zusammenfassung + JSON-Rohdaten) ---------- */
function summaryRow(s){
  return {
    participant:s.participantId, phase:s.phase, day:s.day, dayLabel:s.dayLabel,
    startedAt:s.startedAt, finishedAt:s.finishedAt,
    rot_meanRT:s.rotation?.meanRT, rot_medianRT:s.rotation?.medianRT, rot_acc:s.rotation?.accuracy,
    gap_meanRT:s.gapfit?.meanRT, gap_medianRT:s.gapfit?.medianRT, gap_acc:s.gapfit?.accuracy,
    corsi_span:s.corsi?.span, corsi_err:s.corsi?.errorRate,
    time_dev30_ms:s.timeprod?.prod30_dev_ms, time_dev60_ms:s.timeprod?.prod60_dev_ms,
    ctrl_meanRT:s.control?.meanRT, ctrl_medianRT:s.control?.medianRT, ctrl_acc:s.control?.accuracy,
    estPlayMin:s.estPlayMin, note:(s.note||'').replace(/\s+/g,' ')
  };
}
function toCSV(rows){
  if(!rows.length) return '';
  const cols=Object.keys(rows[0]);
  const esc=(v)=> v==null?'':/[",;\n]/.test(String(v))?`"${String(v).replace(/"/g,'""')}"`:String(v);
  return [cols.join(';'), ...rows.map(r=>cols.map(c=>esc(r[c])).join(';'))].join('\n');
}
function download(name, text, type){ const b=new Blob([text],{type}); const u=URL.createObjectURL(b);
  const a=document.createElement('a'); a.href=u; a.download=name; a.click(); URL.revokeObjectURL(u); }
function exportLocal(){
  const all=localSessions();
  if(!all.length){ alert('Noch keine Daten vorhanden.'); return; }
  const stamp=new Date().toISOString().slice(0,10);
  download(`tetris_summary_${stamp}.csv`, toCSV(all.map(summaryRow)), 'text/csv;charset=utf-8');
  download(`tetris_rohdaten_${stamp}.json`, JSON.stringify(all,null,2), 'application/json');
}

/* ---------- kleines Logo ---------- */
function miniBlocks(big){
  const c=['var(--t-z)','var(--t-s)','var(--t-i)','var(--t-l)']; const s=big?22:16;
  return `<svg width="${s*2}" height="${s*2}" viewBox="0 0 40 40">
    <rect x="2" y="2" width="17" height="17" rx="3" fill="${c[0]}"/>
    <rect x="21" y="2" width="17" height="17" rx="3" fill="${c[1]}"/>
    <rect x="2" y="21" width="17" height="17" rx="3" fill="${c[2]}"/>
    <rect x="21" y="21" width="17" height="17" rx="3" fill="${c[3]}"/></svg>`;
}

/* ---------- Start ---------- */
window.addEventListener('DOMContentLoaded', screenWelcome);
