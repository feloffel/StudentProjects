/* =====================================================================
   Tetris-Effekt — Forscher-Dashboard
   Liest die Sitzungen live aus Firestore (oder lokal, falls offline)
   und zeigt Tabelle + Verlaufskurven. Reines Lesen.
   ===================================================================== */
'use strict';

const $ = (s)=>document.querySelector(s);
const round=(x,n=0)=>x==null?null:Math.round(x*10**n)/10**n;

/* Reihenfolge der Studientage auf der x-Achse */
function orderIdx(s){
  if(s.phase==='baseline') return (s.day+2);          // -2,-1,0 -> 0,1,2
  if(s.phase==='intervention') return 2 + s.day;       // 1..14 -> 3..16
  if(s.phase==='washout') return 16 + s.day;           // 1,2,3 -> 17,18,19
  return 999;
}
function dayLabel(s){ return s.dayLabel || `${s.phase} ${s.day}`; }

let SESSIONS=[];
let CHART_RT=null, CHART_SPAN=null;

/* ---------- Datenquelle ---------- */
function cloudReady(){
  try{ return typeof firebase!=='undefined' && typeof FIREBASE_CONFIG!=='undefined'
     && FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('DEIN_'); }catch(e){ return false; }
}
function init(){
  if(cloudReady()){
    $('#src').textContent='● Live aus Firebase'; $('#src').className='src on';
    if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    firebase.firestore().collection('sessions').onSnapshot(snap=>{
      SESSIONS = snap.docs.map(d=>d.data());
      render();
    }, err=>{ console.error(err); $('#src').textContent='⚠ Firebase-Fehler: '+err.code; $('#src').className='src off'; });
  } else {
    $('#src').textContent='○ Lokale Daten (Firebase nicht konfiguriert)'; $('#src').className='src off';
    SESSIONS = JSON.parse(localStorage.getItem('tetris_sessions')||'[]');
    render();
  }
}

/* ---------- Rendering ---------- */
function participants(){ return [...new Set(SESSIONS.map(s=>s.participantId))].sort(); }
function currentFilter(){ return $('#pfilter').value; }

function render(){
  // Teilnehmer-Filter befüllen
  const sel=$('#pfilter'); const cur=sel.value;
  const ps=participants();
  sel.innerHTML = `<option value="__all">Alle Teilnehmer (${ps.length})</option>`+
    ps.map(p=>`<option value="${p}">${p}</option>`).join('');
  if([...sel.options].some(o=>o.value===cur)) sel.value=cur;

  const f=currentFilter();
  let rows = SESSIONS.filter(s=> f==='__all' || s.participantId===f);
  rows = rows.sort((a,b)=> (a.participantId+'').localeCompare(b.participantId)||orderIdx(a)-orderIdx(b));

  $('#count').textContent = `${rows.length} Sitzung(en)`;
  renderTable(rows);
  renderCharts(rows.filter(s=> f!=='__all').length? rows : pickSingleForChart(rows));
}
// Für Charts ist eine einzelne Person am aussagekräftigsten; bei "Alle" die mit den meisten Sitzungen
function pickSingleForChart(rows){
  const byP={}; rows.forEach(s=>{(byP[s.participantId]=byP[s.participantId]||[]).push(s);});
  const top=Object.values(byP).sort((a,b)=>b.length-a.length)[0]||[];
  if(top.length && currentFilter()==='__all'){
    $('#chartnote').textContent = `Diagramm zeigt: ${top[0].participantId} (meiste Sitzungen). Für andere oben filtern.`;
  } else $('#chartnote').textContent='';
  return top;
}

function renderTable(rows){
  const head=['Teilnehmer','Tag','Phase','Rot RT','Rot %','Gap RT','Gap %','Span','Zeit Δ30','Zeit Δ60','Ktrl RT','Ktrl %','Spiel min','Notiz'];
  const body = rows.map(s=>{
    const td=(v)=>`<td>${v==null?'<span class="na">–</span>':v}</td>`;
    return `<tr>
      <td class="pid">${s.participantId}</td>
      <td>${dayLabel(s)}</td>
      <td><span class="tag ${s.phase}">${s.phase}</span></td>
      ${td(s.rotation?.meanRT)} ${td(pct(s.rotation?.accuracy))}
      ${td(s.gapfit?.meanRT)} ${td(pct(s.gapfit?.accuracy))}
      ${td(s.corsi?.span)}
      ${td(s.timeprod?.prod30_dev_ms!=null? (s.timeprod.prod30_dev_ms/1000).toFixed(1)+'s':null)}
      ${td(s.timeprod?.prod60_dev_ms!=null? (s.timeprod.prod60_dev_ms/1000).toFixed(1)+'s':null)}
      ${td(s.control?.meanRT)} ${td(pct(s.control?.accuracy))}
      ${td(s.estPlayMin)}
      <td class="note" title="${(s.note||'').replace(/"/g,'&quot;')}">${(s.note||'').slice(0,40)}</td>
    </tr>`;
  }).join('');
  $('#table').innerHTML = rows.length
    ? `<table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`
    : `<div class="empty">Noch keine Daten. Sobald eine Sitzung abgeschlossen wird, erscheint sie hier automatisch.</div>`;
}
function pct(x){ return x==null?null:round(x*100)+'%'; }

function renderCharts(rows){
  const data = rows.slice().sort((a,b)=>orderIdx(a)-orderIdx(b));
  const labels = data.map(dayLabel);
  const ds = (key,sub,color)=>({ label:key, data:data.map(s=>s[sub]? s[sub].meanRT:null),
    borderColor:color, backgroundColor:color, tension:.3, spanGaps:true, pointRadius:4 });
  const cfgRT={ type:'line', data:{ labels, datasets:[
      ds('Rotation (RT)','rotation','#22d3ee'),
      ds('Einpassen (RT)','gapfit','#b35cf0'),
      ds('Kontrolle (RT)','control','#f5c451')
    ]}, options:lineOpts('Reaktionszeit (ms) — niedriger = schneller') };
  const cfgSpan={ type:'line', data:{ labels, datasets:[
      { label:'Corsi-Span', data:data.map(s=>s.corsi?s.corsi.span:null), borderColor:'#34d399',
        backgroundColor:'#34d399', tension:.3, spanGaps:true, pointRadius:4 }
    ]}, options:lineOpts('Span (höher = besser)') };
  if(CHART_RT) CHART_RT.destroy(); if(CHART_SPAN) CHART_SPAN.destroy();
  CHART_RT  = new Chart($('#chartRT'),  cfgRT);
  CHART_SPAN= new Chart($('#chartSpan'),cfgSpan);
}
function lineOpts(title){
  const grid='rgba(255,255,255,.07)', tick='#8b96bd';
  return { responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{ labels:{ color:'#eef2fb', font:{ family:'Outfit' } } },
      title:{ display:true, text:title, color:'#8b96bd', font:{ family:'JetBrains Mono', size:12 } } },
    scales:{ x:{ grid:{ color:grid }, ticks:{ color:tick } }, y:{ grid:{ color:grid }, ticks:{ color:tick } } } };
}

/* ---------- Export ---------- */
function summaryRow(s){
  return { participant:s.participantId, phase:s.phase, day:s.day, dayLabel:dayLabel(s),
    startedAt:s.startedAt, finishedAt:s.finishedAt,
    rot_meanRT:s.rotation?.meanRT, rot_acc:s.rotation?.accuracy,
    gap_meanRT:s.gapfit?.meanRT, gap_acc:s.gapfit?.accuracy,
    corsi_span:s.corsi?.span, corsi_err:s.corsi?.errorRate,
    time_dev30_ms:s.timeprod?.prod30_dev_ms, time_dev60_ms:s.timeprod?.prod60_dev_ms,
    ctrl_meanRT:s.control?.meanRT, ctrl_acc:s.control?.accuracy,
    estPlayMin:s.estPlayMin, note:(s.note||'').replace(/\s+/g,' ') };
}
function toCSV(rows){ if(!rows.length) return '';
  const cols=Object.keys(rows[0]);
  const esc=(v)=>v==null?'':/[",;\n]/.test(String(v))?`"${String(v).replace(/"/g,'""')}"`:String(v);
  return [cols.join(';'),...rows.map(r=>cols.map(c=>esc(r[c])).join(';'))].join('\n'); }
function download(name,text,type){ const b=new Blob([text],{type}),u=URL.createObjectURL(b),a=document.createElement('a');
  a.href=u;a.download=name;a.click();URL.revokeObjectURL(u); }

window.addEventListener('DOMContentLoaded',()=>{
  $('#pfilter').addEventListener('change',render);
  $('#refresh').addEventListener('click',init);
  $('#csv').addEventListener('click',()=>{
    const f=currentFilter(); const rows=SESSIONS.filter(s=>f==='__all'||s.participantId===f);
    if(!rows.length){ alert('Keine Daten.'); return; }
    download(`tetris_dashboard_${new Date().toISOString().slice(0,10)}.csv`,
      toCSV(rows.sort((a,b)=>orderIdx(a)-orderIdx(b)).map(summaryRow)),'text/csv;charset=utf-8');
  });
  init();
});
