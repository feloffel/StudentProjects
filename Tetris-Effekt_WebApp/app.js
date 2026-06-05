/* =====================================================================
   app.js — Teilnehmer-App
   Liest die vom Dashboard gesetzte Konfiguration (welche Tests, welche
   Schwierigkeit), führt sie der Reihe nach aus und speichert die Sitzung.
   Test-Logik liegt komplett in tests.js (TEST_POOL).
   ===================================================================== */
'use strict';

var $ = function(s){ return document.querySelector(s); };
var app = function(){ return $('#app'); };
function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }

/* ---------- Studientage / Phasen ---------- */
var DAY_OPTIONS = [
  { group:{de:'Studientag',en:'Study day'}, items:[
    {v:'pre:0',  label:'Pre-Test'},
    {v:'post:1', label:'Post-Test'} ]}
];

/* Zeiger auf die aktuell sichtbare (statische) Screen-Render-Funktion.
   Wird beim Sprachwechsel aufgerufen, damit der Bildschirm live umschaltet.
   Während eines laufenden Tests ist er null (Wechsel greift dann ab dem
   nächsten Bildschirm). */
var CURRENT_RENDER = null;

/* ---------- Konfiguration laden ---------- */
var STUDY_CONFIG = null;
function cloudReady(){
  try { return typeof firebase!=='undefined' && typeof FIREBASE_CONFIG!=='undefined'
      && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey.indexOf('DEIN_')!==0; }
  catch(e){ return false; }
}
var _db=null;
function db(){ if(_db) return _db; if(!firebase.apps || !firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG); _db=firebase.firestore(); return _db; }
function studyId(){ return (typeof STUDY_ID!=='undefined'? STUDY_ID : 'study'); }

async function loadConfig(){
  // 1) Online (vom Dashboard gesetzt)
  if(cloudReady()){
    try {
      var doc = await db().collection('config').doc(studyId()).get();
      if(doc.exists && doc.data() && Array.isArray(doc.data().tests) && doc.data().tests.length){
        return doc.data();
      }
    } catch(e){ console.warn('Config online nicht ladbar:', e); }
  }
  // 2) Lokal (Offline-Test im selben Browser)
  try { var local=JSON.parse(localStorage.getItem('tetris_config')||'null'); if(local && local.tests && local.tests.length) return local; } catch(e){}
  // 3) Standard
  return DEFAULT_CONFIG;
}
// nur Tests behalten, die es im Pool gibt
function resolveTests(cfg){
  return (cfg.tests||[]).map(function(t){
    var def=TEST_BY_ID[t.id]; if(!def) return null;
    var diff = (def.difficulties[t.difficulty]) ? t.difficulty : def.defaultDifficulty;
    return { def:def, difficulty:diff, params:def.difficulties[diff] };
  }).filter(Boolean);
}

/* ---------- Sitzung ---------- */
var SESSION=null, PLAN=[], STEP=0;
function newSession(pid, dayValue, dayLabel, plan){
  var parts=dayValue.split(':');
  return {
    studyId:studyId(), participantId:pid, phase:parts[0], day:Number(parts[1]), dayLabel:dayLabel,
    startedAt:new Date().toISOString(), finishedAt:null,
    device:{ ua:navigator.userAgent, screen:screen.width+'x'+screen.height, dpr:window.devicePixelRatio||1 },
    plan: plan.map(function(p){ return {id:p.def.id, difficulty:p.difficulty}; }),
    results:{}, note:'', estPlayMin:null
  };
}

/* ---------- Screen-Router ---------- */
function setScreen(html){ app().innerHTML=html; try{ window.scrollTo(0,0); }catch(e){} }

function progressBar(){
  return '<div class="progress">'+ PLAN.map(function(p,i){
    return '<div class="pstep '+(i<STEP?'done':'')+' '+(i===STEP?'active':'')+'"><span class="pdot"></span>'+escapeHtml(L(p.def.name))+'</div>';
  }).join('')+'</div>';
}
function escapeHtml(s){ return String(s).replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); }

/* ---------- Welcome ---------- */
async function screenWelcome(){
  CURRENT_RENDER = null;
  setScreen('<div class="card"><div class="brand"><span class="logo">'+miniBlocks()+'</span><div><h1>'+tr('Wahrnehmungs-Studie','Perception Study')+'</h1><p class="sub">'+tr('Lade Konfiguration…','Loading configuration…')+'</p></div></div></div>');
  STUDY_CONFIG = await loadConfig();
  PLAN = resolveTests(STUDY_CONFIG);
  renderWelcome();
}
function renderWelcome(){
  CURRENT_RENDER = renderWelcome;   // beim Sprachwechsel diesen Bildschirm neu zeichnen
  var typed = ($('#pid') && $('#pid').value) || '';   // bereits getippten Namen behalten
  var savedPid = typed || localStorage.getItem('tetris_pid') || '';
  var prevDay = $('#day') ? $('#day').value : null;
  var last=null; try{ last=JSON.parse(localStorage.getItem('tetris_lastSession')||'null'); }catch(e){}
  var opts=DAY_OPTIONS.map(function(g){ return '<optgroup label="'+escapeHtml(L(g.group))+'">'+g.items.map(function(it){ return '<option value="'+it.v+'">'+escapeHtml(L(it.label))+'</option>'; }).join('')+'</optgroup>'; }).join('');
  var mins = Math.max(5, Math.round(PLAN.length*2.5));
  setScreen(
    '<div class="card welcome">'+
      '<div class="brand"><span class="logo">'+miniBlocks()+'</span><div><h1>'+tr('Wahrnehmungs-Studie','Perception Study')+'</h1>'+
        '<p class="sub">'+tr('Tägliche Kurzmessung · ca. ','Short daily measurement · approx. ')+mins+'–'+(mins+5)+tr(' Minuten',' minutes')+'</p></div></div>'+
      '<p class="lead">'+tr('Heute sind ','Today there are ')+'<b>'+PLAN.length+tr(' kurze Aufgaben',' short tasks')+'</b>'+tr(' dran. Mach sie konzentriert und ungestört. Antworte zügig, aber sorgfältig.',' to do. Do them focused and undisturbed. Answer quickly but carefully.')+'</p>'+
      '<label class="fld"><span>'+tr('Name','Name')+'</span><input id="pid" type="text" placeholder="'+tr('z. B. TP-01','e.g. TP-01')+'" value="'+escapeHtml(savedPid)+'" autocomplete="off"></label>'+
      '<label class="fld"><span>'+tr('Heutiger Studientag','Today’s study day')+'</span><select id="day">'+opts+'</select></label>'+
      (last? '<p class="hint">'+tr('Zuletzt: ','Last time: ')+'<b>'+escapeHtml(last.dayLabel)+'</b> ('+new Date(last.finishedAt||last.startedAt).toLocaleString(I18N.dateLocale())+')</p>':'')+
      '<div class="cloud '+(cloudReady()?'on':'off')+'">'+(cloudReady()?tr('● Online-Sicherung aktiv','● Online backup active'):tr('○ Offline-Modus – Daten werden lokal gespeichert','○ Offline mode – data is stored locally'))+'</div>'+
      '<button class="btn primary big" id="start">'+tr('Sitzung starten','Start session')+'</button>'+
      '<button class="btn ghost" id="export">'+tr('Bisherige Daten exportieren','Export previous data')+'</button>'+
    '</div>');
  if(prevDay){ var ds=$('#day'); if(ds) ds.value=prevDay; }
  $('#start').onclick=function(){
    var pid=$('#pid').value.trim();
    if(!pid){ $('#pid').classList.add('err'); $('#pid').focus(); return; }
    if(!PLAN.length){ alert(tr('Es sind keine Tests konfiguriert. Bitte im Dashboard Tests auswählen.','No tests are configured. Please select tests in the dashboard.')); return; }
    localStorage.setItem('tetris_pid', pid);
    var sel=$('#day');
    SESSION=newSession(pid, sel.value, sel.options[sel.selectedIndex].text, PLAN);
    STEP=0;
    screenIntro();
  };
  $('#export').onclick=exportLocal;
}

/* ---------- Intro pro Test ---------- */
function screenIntro(){
  CURRENT_RENDER = screenIntro;
  var p=PLAN[STEP], def=p.def;
  setScreen('<div class="card">'+progressBar()+
    '<h2 class="ttl">'+(STEP+1)+' · '+escapeHtml(L(def.name))+'</h2>'+
    '<p class="lead">'+escapeHtml(L(def.short))+'</p>'+
    '<p class="keys">'+keyHint(def.id)+'</p>'+
    '<button class="btn primary big" id="go">'+tr('Los geht’s','Let’s go')+'</button></div>');
  $('#go').onclick=runCurrent;
}
function keyHint(id){
  switch(id){
    case 'rotation3d': return tr('Tasten: <b>F</b> = dieselbe Figur · <b>J</b> = Spiegelbild','Keys: <b>F</b> = same shape · <b>J</b> = mirror image');
    case 'gapfit': case 'lineclose': case 'control_math': return tr('Tasten: <b>1–4</b> für die Auswahl','Keys: <b>1–4</b> to choose');
    case 'paperfold': return tr('Tasten: <b>1–5</b> (A–E) für die Auswahl','Keys: <b>1–5</b> (A–E) to choose');
    case 'corsi': return tr('Mit Maus/Finger antippen','Tap with mouse/finger');
    case 'timeprod': return '';
    case 'deary_rt': return tr('Tasten: <b>D F J K</b> für die vier Felder','Keys: <b>D F J K</b> for the four boxes');
    case 'taskswitch': return tr('Tasten: <b>F</b> = linke Antwort · <b>J</b> = rechte Antwort','Keys: <b>F</b> = left answer · <b>J</b> = right answer');
    case 'trunkpack': return tr('Tasten: <b>F</b> = passt · <b>J</b> = passt nicht','Keys: <b>F</b> = fits · <b>J</b> = does not fit');
    case 'visualsearch': case 'concentration': return tr('Mit Maus/Finger antippen','Tap with mouse/finger');
    default: return '';
  }
}

/* ---------- Test ausführen ---------- */
var UI = {
  host:null,
  sleep:sleep,
  TIMEOUT:'__timeout__',
  count:function(text){ var c=$('#cnt'); if(c) c.textContent=text; },
  fixation:async function(){ UI.host.innerHTML='<div class="stage"><div class="fix">+</div></div>'; await sleep(500+Math.random()*350); },
  flash:async function(ok){ var s=UI.host.querySelector('.stage'); if(s) s.classList.add(ok?'ok':'no'); await sleep(220); },
  // Sichtbarer Countdown in der Leiste #timerbar. Gibt eine Abbruch-Funktion zurück.
  countdownStart:function(ms, onEnd){
    var bar=document.getElementById('timerbar');
    if(!bar || !ms || ms<=0) return function(){};
    bar.innerHTML='<div class="cd-track"><div class="cd-fill"></div></div><div class="cd-num"></div>';
    bar.classList.add('on');
    var fill=bar.querySelector('.cd-fill'), num=bar.querySelector('.cd-num');
    var start=Date.now(), raf=null, to=null, stopped=false;
    fill.style.transition='none'; fill.style.width='100%';
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      if(stopped) return; fill.style.transition='width '+ms+'ms linear'; fill.style.width='0%';
    }); });
    function upd(){
      if(stopped) return;
      var left=Math.max(0, ms-(Date.now()-start));
      num.textContent=(left/1000).toFixed(1)+'s';
      if(left<=ms*0.30) bar.classList.add('warn'); else bar.classList.remove('warn');
      if(left>0) raf=requestAnimationFrame(upd);
    }
    upd();
    function clear(){ if(to){clearTimeout(to);to=null;} if(raf){cancelAnimationFrame(raf);raf=null;} bar.classList.remove('on'); bar.classList.remove('warn'); bar.innerHTML=''; }
    to=setTimeout(function(){ if(stopped) return; stopped=true; clear(); if(onEnd) onEnd(); }, ms);
    return function(){ if(stopped) return; stopped=true; clear(); };
  },
  // choice(map) wie bisher; mit optionalem timeLimitMs startet ein Countdown.
  // Läuft die Zeit ab, wird mit UI.TIMEOUT aufgelöst (-> Aufgabe gilt als falsch).
  choice:function(map, timeLimitMs){
    return new Promise(function(resolve){
      var done=false, cancelCd=function(){};
      function finish(v){ if(done) return; done=true; document.removeEventListener('keydown',onKey); cancelCd(); resolve(v); }
      UI.host.querySelectorAll('.ans').forEach(function(b){ b.onclick=function(){ finish(b.dataset.a); }; });
      function onKey(e){ var k=(e.key||'').toLowerCase(); for(var i=0;i<map.length;i++){ if(map[i][1]===k){ finish(map[i][0]); return; } } }
      document.addEventListener('keydown',onKey);
      if(timeLimitMs && timeLimitMs>0){ cancelCd=UI.countdownStart(timeLimitMs, function(){ finish(UI.TIMEOUT); }); }
    });
  }
};
async function runCurrent(){
  CURRENT_RENDER = null;   // laufender Test: Sprachwechsel erst ab nächstem Bildschirm
  var p=PLAN[STEP], def=p.def;
  setScreen('<div class="card test"><div class="testhead"><span>'+escapeHtml(L(def.name))+'</span><span id="cnt"></span></div><div id="timerbar" class="timerbar"></div><div id="host"></div></div>');
  UI.host=$('#host');
  var result;
  try { result = await def.run(p.params, UI); }
  catch(err){ console.error('Testfehler ('+def.id+'):', err); result={ error:String(err) }; }
  SESSION.results[def.id]=result;
  STEP++;
  if(STEP<PLAN.length) screenIntro();
  else screenDone();
}

/* ---------- Fertig + speichern ---------- */
function screenDone(){
  CURRENT_RENDER = screenDone;
  var prevPlay = $('#play') ? $('#play').value : '';
  var prevNote = $('#note') ? $('#note').value : '';
  setScreen('<div class="card done"><h2 class="ttl">'+tr('Fast geschafft','Almost done')+'</h2>'+
    '<p class="lead">'+tr('Zwei kurze, freiwillige Angaben – dann werden deine Daten gesichert.','Two short, optional questions – then your data will be saved.')+'</p>'+
    '<label class="fld"><span>'+tr('Falls du heute schon gespielt hast: geschätzte Dauer (Minuten)','If you have already played today: estimated duration (minutes)')+'</span><input id="play" type="number" min="0" inputmode="numeric" placeholder="'+tr('optional','optional')+'" value="'+escapeHtml(prevPlay)+'"></label>'+
    '<label class="fld"><span>'+tr('Notiz (optional – etwas Auffälliges heute?)','Note (optional – anything notable today?)')+'</span><textarea id="note" rows="3" placeholder="'+tr('optional','optional')+'">'+escapeHtml(prevNote)+'</textarea></label>'+
    '<button class="btn primary big" id="finish">'+tr('Sitzung abschließen &amp; speichern','Finish &amp; save session')+'</button></div>');
  $('#finish').onclick=async function(){
    SESSION.estPlayMin = $('#play').value!==''? Number($('#play').value) : null;
    SESSION.note = $('#note').value.trim();
    SESSION.finishedAt = new Date().toISOString();
    $('#finish').disabled=true; $('#finish').textContent=tr('Speichere…','Saving…');
    var status=await saveSession(SESSION);
    localStorage.setItem('tetris_lastSession', JSON.stringify({ dayLabel:SESSION.dayLabel, finishedAt:SESSION.finishedAt }));
    screenThanks(status);
  };
}
/* ---------- Kurze Leistungs-Zusammenfassung pro Test (für die Testperson) ---------- */
function performanceSummaryHTML(){
  if(!SESSION || !SESSION.results) return '';
  var cards = PLAN.map(function(p){
    var def=p.def, r=SESSION.results[def.id];
    if(!r || r.error) return '';                 // nicht absolvierte / fehlerhafte Tests überspringen
    var rows=[];
    try { rows = def.format(r) || []; } catch(e){ rows=[]; }
    if(!rows.length) return '';
    var rowsHtml = rows.map(function(x){
      return '<div class="sr-row"><span>'+escapeHtml(String(x.label))+'</span><b>'+escapeHtml(String(x.value))+'</b></div>';
    }).join('');
    return '<div class="sr-card"><div class="sr-name">'+escapeHtml(L(def.name))+'</div>'+rowsHtml+'</div>';
  }).filter(Boolean).join('');
  if(!cards) return '';
  return '<div class="summary">'+
    '<h3 class="sr-h">'+tr('Deine Ergebnisse','Your results')+'</h3>'+
    '<p class="sr-sub">'+tr('Kurzer Überblick über deine heutige Sitzung – nur zur Orientierung.','A short overview of today’s session – just for your information.')+'</p>'+
    '<div class="sr-grid">'+cards+'</div>'+
  '</div>';
}

function screenThanks(status){
  CURRENT_RENDER = function(){ screenThanks(status); };
  setScreen('<div class="card thanks"><div class="big-tick">'+miniBlocks(true)+'</div>'+
    '<h2 class="ttl">'+tr('Danke – Sitzung gespeichert','Thank you – session saved')+'</h2>'+
    '<p class="lead">'+(status.cloud?tr('✓ Online gesichert.','✓ Backed up online.'):tr('✓ Lokal gespeichert. <b>Bitte vor dem Schließen exportieren.</b>','✓ Saved locally. <b>Please export before closing.</b>'))+'</p>'+
    performanceSummaryHTML()+
    '<p class="muted center">'+tr('Bis zur nächsten Sitzung. Du kannst dieses Fenster jetzt schließen.','See you at the next session. You can close this window now.')+'</p>'+
    '<button class="btn ghost" id="export">'+tr('Daten exportieren (CSV + JSON)','Export data (CSV + JSON)')+'</button>'+
    '<button class="btn ghost" id="again">'+tr('Neue Sitzung','New session')+'</button></div>');
  $('#export').onclick=exportLocal;
  $('#again').onclick=screenWelcome;
}

/* ---------- Speichern ---------- */
function localSessions(){ try{ return JSON.parse(localStorage.getItem('tetris_sessions')||'[]'); }catch(e){ return []; } }
function pushLocal(s){ var a=localSessions(); a.push(s); localStorage.setItem('tetris_sessions', JSON.stringify(a)); }
async function saveSession(s){
  pushLocal(s);
  if(!cloudReady()) return { cloud:false };
  try {
    await db().collection('sessions').add(Object.assign({}, s, { serverTime: firebase.firestore.FieldValue.serverTimestamp() }));
    return { cloud:true };
  } catch(err){ console.error('Firestore-Fehler:', err); return { cloud:false, error:String(err) }; }
}

/* ---------- Export ---------- */
function summaryRow(s){
  var row={ participant:s.participantId, phase:s.phase, day:s.day, dayLabel:s.dayLabel, startedAt:s.startedAt, finishedAt:s.finishedAt };
  Object.keys(s.results||{}).forEach(function(id){
    var r=s.results[id]; if(!r) return;
    if(r.accuracy!=null) row[id+'_genauigkeit']=r.accuracy;
    if(r.medMs!=null) row[id+'_zeit_ms']=r.medMs;
    if(r.bestLength!=null) row[id+'_laenge']=r.bestLength;
    if(r.switchCost!=null) row[id+'_wechselkosten_ms']=r.switchCost;
    if(r.hits!=null) row[id+'_treffer']=r.hits;
    if(r.targets){ r.targets.forEach(function(t){ row[id+'_dev'+t.target+'_ms']=t.devMs; }); }
  });
  row.estPlayMin=s.estPlayMin; row.note=(s.note||'').replace(/\s+/g,' ');
  return row;
}
function toCSV(rows){
  if(!rows.length) return '';
  var cols={}; rows.forEach(function(r){ Object.keys(r).forEach(function(k){ cols[k]=1; }); }); cols=Object.keys(cols);
  var esc=function(v){ return v==null?'':/[",;\n]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':String(v); };
  return [cols.join(';')].concat(rows.map(function(r){ return cols.map(function(c){ return esc(r[c]); }).join(';'); })).join('\n');
}
function download(name,text,type){ var b=new Blob([text],{type:type}),u=URL.createObjectURL(b),a=document.createElement('a'); a.href=u; a.download=name; a.click(); URL.revokeObjectURL(u); }
function exportLocal(){
  var all=localSessions(); if(!all.length){ alert(tr('Noch keine Daten vorhanden.','No data available yet.')); return; }
  var stamp=new Date().toISOString().slice(0,10);
  download('studie_zusammenfassung_'+stamp+'.csv', toCSV(all.map(summaryRow)), 'text/csv;charset=utf-8');
  download('studie_rohdaten_'+stamp+'.json', JSON.stringify(all,null,2), 'application/json');
}

/* ---------- Logo ---------- */
function miniBlocks(big){
  var c=['#ef4b5b','#54d66a','#31c7e6','#f08a3c']; var s=big?22:16;
  return '<svg width="'+(s*2)+'" height="'+(s*2)+'" viewBox="0 0 40 40">'+
    '<rect x="2" y="2" width="17" height="17" rx="3" fill="'+c[0]+'"/>'+
    '<rect x="21" y="2" width="17" height="17" rx="3" fill="'+c[1]+'"/>'+
    '<rect x="2" y="21" width="17" height="17" rx="3" fill="'+c[2]+'"/>'+
    '<rect x="21" y="21" width="17" height="17" rx="3" fill="'+c[3]+'"/></svg>';
}

window.addEventListener('DOMContentLoaded', function(){
  // DE/EN-Schalter: bei Wechsel den aktuellen (statischen) Bildschirm neu zeichnen
  buildLangToggle(function(){ if (CURRENT_RENDER) CURRENT_RENDER(); });
  document.title = tr('Wahrnehmungs-Studie','Perception Study');
  I18N.onChange(function(){ document.title = tr('Wahrnehmungs-Studie','Perception Study'); });
  screenWelcome();
});
