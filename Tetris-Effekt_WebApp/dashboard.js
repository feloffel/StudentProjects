/* =====================================================================
   dashboard.js — Forscher-Dashboard
   1) Test-Auswahl + Schwierigkeit pro Test  -> schreibt Konfiguration
   2) Teilnehmer auswählen
   3) Ergebnisse je Sitzung in Klartext (ohne Fachbegriffe)
   ===================================================================== */
'use strict';

var $ = function(s){ return document.querySelector(s); };
var DIFFS = ['leicht','mittel','schwer'];

function cloudReady(){
  try{ return typeof firebase!=='undefined' && typeof FIREBASE_CONFIG!=='undefined'
     && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey.indexOf('DEIN_')!==0; }catch(e){ return false; }
}
var _db=null;
function db(){ if(_db) return _db; if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG); _db=firebase.firestore(); return _db; }
function studyId(){ return (typeof STUDY_ID!=='undefined'? STUDY_ID : 'study'); }

/* ---------- Zustand ---------- */
var SESSIONS=[];
var CONFIG=null;          // {tests:[{id,difficulty}]}

/* ---------- Reihenfolge der Studientage ---------- */
function orderIdx(s){
  if(s.phase==='baseline') return (s.day+2);
  if(s.phase==='intervention') return 2 + s.day;
  if(s.phase==='washout') return 16 + s.day;
  return 999;
}
function dayLabel(s){ return s.dayLabel || (s.phase+' '+s.day); }

/* =====================================================================
   START
   ===================================================================== */
function init(){
  if(cloudReady()){
    $('#src').textContent='● Live aus Firebase'; $('#src').className='src on';
    if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    loadConfigCloud();
    db().collection('sessions').onSnapshot(function(snap){
      SESSIONS = snap.docs.map(function(d){ return d.data(); });
      renderResults();
    }, function(err){ console.error(err); $('#src').textContent='⚠ Firebase-Fehler: '+err.code; $('#src').className='src off'; });
  } else {
    $('#src').textContent='○ Lokal (Firebase nicht konfiguriert)'; $('#src').className='src off';
    try{ SESSIONS=JSON.parse(localStorage.getItem('tetris_sessions')||'[]'); }catch(e){ SESSIONS=[]; }
    loadConfigLocal();
    renderResults();
  }
}

/* =====================================================================
   1) KONFIGURATION (Test-Auswahl + Schwierigkeit)
   ===================================================================== */
function defaultConfig(){ return JSON.parse(JSON.stringify(DEFAULT_CONFIG)); }
async function loadConfigCloud(){
  try{
    var doc=await db().collection('config').doc(studyId()).get();
    CONFIG = (doc.exists && doc.data() && Array.isArray(doc.data().tests)) ? { tests:doc.data().tests } : defaultConfig();
  }catch(e){ CONFIG=defaultConfig(); }
  renderConfig();
}
function loadConfigLocal(){
  try{ var c=JSON.parse(localStorage.getItem('tetris_config')||'null'); CONFIG=(c&&c.tests)?c:defaultConfig(); }
  catch(e){ CONFIG=defaultConfig(); }
  renderConfig();
}
function configMap(){ var m={}; (CONFIG.tests||[]).forEach(function(t){ m[t.id]=t.difficulty; }); return m; }

function renderConfig(){
  var sel=configMap();
  var html = TEST_POOL.map(function(t){
    var on = sel.hasOwnProperty(t.id);
    var diff = on ? sel[t.id] : t.defaultDifficulty;
    return '<div class="tcard '+(on?'on':'')+'" data-id="'+t.id+'">'+
      '<label class="trow"><input type="checkbox" class="tchk" data-id="'+t.id+'" '+(on?'checked':'')+'>'+
        '<span class="tname">'+t.name+'</span></label>'+
      '<div class="tdesc">'+t.short+'</div>'+
      '<div class="tmeasure">Erfasst: '+t.measures+'</div>'+
      '<div class="tdiff">Schwierigkeit: '+
        DIFFS.map(function(d){ return '<button class="diffbtn '+(diff===d?'sel':'')+'" data-id="'+t.id+'" data-d="'+d+'">'+d+'</button>'; }).join('')+
      '</div></div>';
  }).join('');
  $('#pool').innerHTML = html;
  $('#poolcount').textContent = (CONFIG.tests||[]).length + ' von ' + TEST_POOL.length + ' aktiv';

  // Events
  $('#pool').querySelectorAll('.tchk').forEach(function(chk){
    chk.onchange=function(){
      var id=chk.dataset.id;
      if(chk.checked){ if(!sel.hasOwnProperty(id)){ CONFIG.tests.push({id:id, difficulty:(TEST_BY_ID[id].defaultDifficulty)}); } }
      else { CONFIG.tests = CONFIG.tests.filter(function(t){ return t.id!==id; }); }
      renderConfig();
    };
  });
  $('#pool').querySelectorAll('.diffbtn').forEach(function(b){
    b.onclick=function(){
      var id=b.dataset.id, d=b.dataset.d;
      var entry=CONFIG.tests.find(function(t){ return t.id===id; });
      if(!entry){ // Schwierigkeit klicken aktiviert den Test gleich mit
        CONFIG.tests.push({id:id, difficulty:d});
      } else { entry.difficulty=d; }
      renderConfig();
    };
  });
}
function moveStatus(msg, ok){ var e=$('#savestate'); e.textContent=msg; e.className='savestate '+(ok?'ok':''); setTimeout(function(){ e.textContent=''; e.className='savestate'; }, 3000); }
async function saveConfig(){
  if(!CONFIG.tests.length){ moveStatus('Bitte mindestens einen Test auswählen.', false); return; }
  // in Pool-Reihenfolge sortieren, damit die App eine sinnvolle Abfolge hat
  var order={}; TEST_POOL.forEach(function(t,i){ order[t.id]=i; });
  CONFIG.tests.sort(function(a,b){ return order[a.id]-order[b.id]; });
  localStorage.setItem('tetris_config', JSON.stringify(CONFIG));
  if(cloudReady()){
    try{ await db().collection('config').doc(studyId()).set({ tests:CONFIG.tests, updatedAt:new Date().toISOString() });
      moveStatus('✓ Gespeichert – die Teilnehmer-App lädt diese Auswahl beim nächsten Start.', true);
    }catch(e){ moveStatus('Online-Speichern fehlgeschlagen: '+e.code, false); }
  } else {
    moveStatus('✓ Lokal gespeichert (Offline-Modus, nur dieser Browser).', true);
  }
}

/* =====================================================================
   2) + 3) TEILNEHMER & ERGEBNISSE
   ===================================================================== */
function participants(){ var s={}; SESSIONS.forEach(function(x){ s[x.participantId]=1; }); return Object.keys(s).sort(); }

function renderResults(){
  var ps=participants();
  var sel=$('#pfilter'); var cur=sel.value;
  sel.innerHTML = '<option value="">— Teilnehmer wählen —</option>' + ps.map(function(p){ return '<option value="'+p+'">'+p+'</option>'; }).join('');
  if(cur && ps.indexOf(cur)>=0) sel.value=cur;
  $('#pcount').textContent = ps.length + ' Teilnehmer · ' + SESSIONS.length + ' Sitzungen';

  var who=sel.value;
  if(!who){ $('#results').innerHTML='<div class="empty">Oben einen Teilnehmer auswählen, um die Ergebnisse zu sehen.</div>'; return; }
  var rows=SESSIONS.filter(function(s){ return s.participantId===who; }).sort(function(a,b){ return orderIdx(a)-orderIdx(b); });
  if(!rows.length){ $('#results').innerHTML='<div class="empty">Für '+who+' liegen noch keine Sitzungen vor.</div>'; return; }

  $('#results').innerHTML = rows.map(function(s){ return sessionCard(s); }).join('');
}

function prettyId(id){ return String(id).replace(/[_-]+/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();}); }

// Klartext-Namen für die Rohdaten-Felder (Spalten der Detailtabelle)
var FIELD_LABELS = {
  i:'Nr.', n:'Anzahl Aufgaben', correct:'Richtig?', rt:'Zeit', answer:'Antwort', mirror:'War Spiegelbild?',
  len:'Länge', seq:'Gezeigte Folge', resp:'Deine Eingabe', target:'Zielzeit (Sek)',
  producedMs:'Gestoppt bei', devMs:'Abweichung', rule:'Regel', switched:'Regelwechsel?',
  fits:'Passt rein?', items:'Anzahl Symbole', a:'Aufgabe', given:'Deine Antwort', sol:'Lösung',
  q:'Aufgabe', value:'Wert', round:'Runde', hit:'Treffer?', kind:'Art', figure:'Figur', angle:'Drehwinkel', source:'Quelle', wait:'Wartezeit davor',
  correctCount:'Richtige gesamt', accuracy:'Trefferquote', avgMs:'Durchschnittszeit', medMs:'Typische Zeit',
  bestLength:'Längste Folge', totalTrials:'Durchgänge gesamt', hits:'Treffer', misses:'Verpasst',
  falseAlarms:'Fehlalarme', rounds:'Runden', switchMs:'Zeit nach Wechsel', stayMs:'Zeit ohne Wechsel',
  switchCost:'Mehraufwand durch Wechsel', targets:'Zeitschätzungen'
};
function fieldLabel(k){ return FIELD_LABELS[k] || prettyId(k); }

// Einen einzelnen Zellenwert laienverständlich darstellen
function cellVal(k, v){
  if(v==null) return '–';
  if(k==='correct' || k==='hit') return v ? '✓ richtig' : '✗ falsch';
  if(k==='mirror' || k==='switched' || k==='fits') return v ? 'ja' : 'nein';
  if(k==='accuracy'){ var pc=Math.round(Number(v)*100); return isNaN(pc)?String(v):pc+' %'; }
  if(k==='angle'){ return v+'°'; }
  if(k==='rt' || k==='producedMs' || k==='devMs' || k==='avgMs' || k==='medMs' || k==='switchMs' || k==='stayMs' || k==='switchCost' || k==='wait'){
    var ms=Number(v); if(isNaN(ms)) return String(v);
    return (k==='devMs'||k==='switchCost' ? (ms>=0?'+':'') : '') + (ms/1000).toFixed(2).replace('.',',')+' s';
  }
  if(Array.isArray(v)){
    // Folgen/Eingaben als 1-basierte Liste zeigen
    if(v.length && Array.isArray(v[0])) return v.map(function(x){return '('+x.join(',')+')';}).join(' ');
    return v.map(function(x){ return (typeof x==='number')? (x+1) : x; }).join(' – ');
  }
  if(typeof v==='number') return Number.isInteger(v)? String(v) : String(v).replace('.',',');
  if(typeof v==='boolean') return v?'ja':'nein';
  return escapeHtml(String(v));
}

// Generische Detailtabelle aus einem Array von Durchgängen (trials/targets/…)
function detailTable(arr){
  if(!arr || !arr.length) return '';
  // Spalten = Vereinigung aller Schlüssel, in sinnvoller Reihenfolge
  var pref=['i','wait','len','target','rule','items','answer','given','sol','seq','resp','mirror','switched','fits','correct','hit','rt','producedMs','devMs'];
  var keys={}; arr.forEach(function(row){ Object.keys(row).forEach(function(k){ keys[k]=1; }); });
  var cols=pref.filter(function(k){return keys[k];}).concat(Object.keys(keys).filter(function(k){return pref.indexOf(k)<0;}));
  var head='<tr>'+cols.map(function(k){ return '<th>'+fieldLabel(k)+'</th>'; }).join('')+'</tr>';
  var body=arr.map(function(row, idx){
    return '<tr>'+cols.map(function(k){
      var v = (k==='i' && row[k]==null) ? (idx+1) : row[k];
      var cls = (k==='correct'||k==='hit') ? (row[k]? ' class="ok"' : ' class="no"') : '';
      return '<td'+cls+'>'+cellVal(k,v)+'</td>';
    }).join('')+'</tr>';
  }).join('');
  return '<table class="dtbl">'+head+body+'</table>';
}

// Findet das Array mit den Einzeldurchgängen in einem Ergebnisobjekt
function trialArrayOf(r){
  if(!r) return null;
  if(Array.isArray(r.trials)) return r.trials;
  if(Array.isArray(r.targets)) return r.targets;
  return null;
}

function genericRows(r){
  var rows=[];
  Object.keys(r||{}).forEach(function(k){
    var v=r[k];
    if(v==null || Array.isArray(v)) return;
    if(typeof v==='number'){ rows.push({label:fieldLabel(k), value:cellVal(k,v)}); }
    else if(typeof v==='string' && v.length<40){ rows.push({label:fieldLabel(k), value:v}); }
    else if(typeof v==='boolean'){ rows.push({label:fieldLabel(k), value:v?'ja':'nein'}); }
  });
  return rows.slice(0,8);
}

var _blkSeq=0;
function sessionCard(s){
  var plan = s.plan || Object.keys(s.results||{}).map(function(id){return {id:id};});
  var resultsHtml = plan.map(function(p){
    var id=p.id, def=TEST_BY_ID[id], r=(s.results||{})[id];
    var name = def ? def.name : prettyId(id);
    var unknownTag = def ? '' : ' <span class="rdiff">unbekannter Test</span>';
    if(!r || r.error){ return '<div class="rblock"><div class="rname">'+name+unknownTag+'</div><div class="rrow muted">— keine Daten —</div></div>'; }
    var rows=[];
    if(def){ try{ rows=def.format(r)||[]; }catch(e){ rows=[]; } }
    if(!rows.length) rows=genericRows(r);
    var summary = rows.length
      ? rows.map(function(row){ return '<div class="rrow"><span class="rlabel">'+row.label+'</span><span class="rval">'+row.value+'</span></div>'; }).join('')
      : '<div class="rrow muted">— Ergebnis ohne Anzeigeformat —</div>';

    // --- Detailbereich: alle Einzeldurchgänge + alle übrigen Kennzahlen ---
    var detail='';
    var trials=trialArrayOf(r);
    var tbl = detailTable(trials);
    // zusätzliche Kennzahlen, die NICHT schon in der Zusammenfassung stehen
    var summaryKeys = {accuracy:1, medMs:1, avgMs:1, n:1, correctCount:1, bestLength:1,
                       totalTrials:1, hits:1, misses:1, falseAlarms:1, rounds:1,
                       switchMs:1, stayMs:1, switchCost:1};
    var extra = [];
    Object.keys(r||{}).forEach(function(k){
      if(summaryKeys[k]) return;                 // schon in Zusammenfassung abgedeckt
      var v=r[k]; if(v==null || Array.isArray(v) || typeof v==='object') return;
      extra.push({ label:fieldLabel(k), value:cellVal(k,v) });
    });
    var extraHtml = extra.length
      ? '<div class="dmetrics">'+extra.map(function(x){ return '<span class="dmetric"><b>'+x.label+':</b> '+x.value+'</span>'; }).join('')+'</div>'
      : '';
    if(tbl || extraHtml){
      var bid='d'+(_blkSeq++);
      detail='<button class="dtoggle" onclick="(function(b){var x=document.getElementById(\''+bid+'\');var open=x.style.display===\'block\';x.style.display=open?\'none\':\'block\';b.textContent=open?\'▸ Alle Daten anzeigen\':\'▾ Alle Daten verbergen\';})(this)">▸ Alle Daten anzeigen</button>'+
        '<div class="ddetail" id="'+bid+'" style="display:none">'+extraHtml+tbl+'</div>';
    }

    return '<div class="rblock"><div class="rname">'+name+(p.difficulty?' <span class="rdiff">'+p.difficulty+'</span>':'')+unknownTag+'</div>'+
      summary + detail +
    '</div>';
  }).join('');
  if(!resultsHtml) resultsHtml='<div class="rblock"><div class="rrow muted">— keine Testergebnisse in dieser Sitzung —</div></div>';
  var note = s.note ? '<div class="snote">📝 '+escapeHtml(s.note)+'</div>' : '';
  var play = (s.estPlayMin!=null) ? '<span class="chip">Spielzeit ~'+s.estPlayMin+' min</span>' : '';
  return '<div class="scard">'+
    '<div class="shead"><div><span class="tag '+s.phase+'">'+s.phase+'</span> <b>'+dayLabel(s)+'</b></div>'+
      '<div class="smeta">'+(s.finishedAt?new Date(s.finishedAt).toLocaleString('de-DE'):'')+' '+play+'</div></div>'+
    '<div class="rgrid">'+resultsHtml+'</div>'+ note +
  '</div>';
}
function escapeHtml(s){ return String(s).replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); }

/* ---------- Export ---------- */
function exportCSV(){
  var who=$('#pfilter').value;
  var rows=SESSIONS.filter(function(s){ return !who || s.participantId===who; }).sort(function(a,b){ return orderIdx(a)-orderIdx(b); });
  if(!rows.length){ alert('Keine Daten.'); return; }
  var flat=rows.map(function(s){
    var o={ teilnehmer:s.participantId, phase:s.phase, tag:dayLabel(s), abgeschlossen:s.finishedAt };
    Object.keys(s.results||{}).forEach(function(id){
      var r=s.results[id]; var def=TEST_BY_ID[id]; if(!r||r.error) return;
      var rws=[];
      if(def){ try{ rws=def.format(r)||[]; }catch(e){ rws=[]; } }
      if(!rws.length) rws=genericRows(r);
      rws.forEach(function(row,i){ o[id+'_'+(i+1)+'_'+String(row.label).replace(/\s+/g,'_')]=row.value; });
    });
    o.spielzeit_min=s.estPlayMin; o.notiz=(s.note||'').replace(/\s+/g,' ');
    return o;
  });
  var cols={}; flat.forEach(function(r){ Object.keys(r).forEach(function(k){ cols[k]=1; }); }); cols=Object.keys(cols);
  var esc=function(v){ return v==null?'':/[",;\n]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':String(v); };
  var csv=[cols.join(';')].concat(flat.map(function(r){ return cols.map(function(c){ return esc(r[c]); }).join(';'); })).join('\n');
  var b=new Blob([csv],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(b),a=document.createElement('a');
  a.href=u; a.download='ergebnisse_'+(who||'alle')+'_'+new Date().toISOString().slice(0,10)+'.csv'; a.click(); URL.revokeObjectURL(u);
}

// Rohdaten-Export: eine Zeile pro Einzeldurchgang (alle erfassten Felder)
function exportRawCSV(){
  var who=$('#pfilter').value;
  var sess=SESSIONS.filter(function(s){ return !who || s.participantId===who; }).sort(function(a,b){ return orderIdx(a)-orderIdx(b); });
  if(!sess.length){ alert('Keine Daten.'); return; }
  var flat=[];
  sess.forEach(function(s){
    Object.keys(s.results||{}).forEach(function(id){
      var r=s.results[id]; if(!r||r.error) return;
      var def=TEST_BY_ID[id];
      var arr=trialArrayOf(r);
      if(arr && arr.length){
        arr.forEach(function(row,idx){
          var o={ teilnehmer:s.participantId, phase:s.phase, tag:dayLabel(s), test:(def?def.name:id), durchgang:(row.i!=null?row.i:idx+1) };
          Object.keys(row).forEach(function(k){ if(k==='i') return; var v=row[k];
            o[fieldLabel(k)] = Array.isArray(v)? v.map(function(x){return typeof x==='number'?x+1:x;}).join(' ') : v; });
          flat.push(o);
        });
      } else {
        // kein Trial-Array (z. B. Konzentration) -> Kennzahlen als eine Zeile
        var o={ teilnehmer:s.participantId, phase:s.phase, tag:dayLabel(s), test:(def?def.name:id), durchgang:'(gesamt)' };
        Object.keys(r).forEach(function(k){ var v=r[k]; if(Array.isArray(v)) return; o[fieldLabel(k)]=v; });
        flat.push(o);
      }
    });
  });
  if(!flat.length){ alert('Keine Einzeldaten vorhanden.'); return; }
  var cols={}; flat.forEach(function(r){ Object.keys(r).forEach(function(k){ cols[k]=1; }); }); cols=Object.keys(cols);
  var esc=function(v){ return v==null?'':/[",;\n]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':String(v); };
  var csv=[cols.join(';')].concat(flat.map(function(r){ return cols.map(function(c){ return esc(r[c]); }).join(';'); })).join('\n');
  var b=new Blob([csv],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(b),a=document.createElement('a');
  a.href=u; a.download='rohdaten_'+(who||'alle')+'_'+new Date().toISOString().slice(0,10)+'.csv'; a.click(); URL.revokeObjectURL(u);
}

/* ---------- Tabs ---------- */
function showTab(which){
  $('#tab-config').style.display = which==='config'?'block':'none';
  $('#tab-results').style.display = which==='results'?'block':'none';
  $('#nav-config').classList.toggle('active', which==='config');
  $('#nav-results').classList.toggle('active', which==='results');
}

window.addEventListener('DOMContentLoaded', function(){
  $('#nav-config').onclick=function(){ showTab('config'); };
  $('#nav-results').onclick=function(){ showTab('results'); };
  $('#savecfg').onclick=saveConfig;
  $('#pfilter').addEventListener('change', renderResults);
  $('#csv').onclick=exportCSV;
  var rawBtn=$('#csvraw'); if(rawBtn) rawBtn.onclick=exportRawCSV;
  $('#refresh').onclick=init;
  showTab('config');
  init();
});
