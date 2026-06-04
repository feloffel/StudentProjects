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
  { group:'Studientag', items:[
    {v:'pre:0',  label:'Pre-Test'},
    {v:'post:1', label:'Post-Test'} ]}
];

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
    return '<div class="pstep '+(i<STEP?'done':'')+' '+(i===STEP?'active':'')+'"><span class="pdot"></span>'+escapeHtml(p.def.name)+'</div>';
  }).join('')+'</div>';
}
function escapeHtml(s){ return String(s).replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); }

/* ---------- Welcome ---------- */
async function screenWelcome(){
  setScreen('<div class="card"><div class="brand"><span class="logo">'+miniBlocks()+'</span><div><h1>Wahrnehmungs-Studie</h1><p class="sub">Lade Konfiguration…</p></div></div></div>');
  STUDY_CONFIG = await loadConfig();
  PLAN = resolveTests(STUDY_CONFIG);
  var savedPid=localStorage.getItem('tetris_pid')||'';
  var last=null; try{ last=JSON.parse(localStorage.getItem('tetris_lastSession')||'null'); }catch(e){}
  var opts=DAY_OPTIONS.map(function(g){ return '<optgroup label="'+g.group+'">'+g.items.map(function(it){ return '<option value="'+it.v+'">'+it.label+'</option>'; }).join('')+'</optgroup>'; }).join('');
  var mins = Math.max(5, Math.round(PLAN.length*2.5));
  setScreen(
    '<div class="card welcome">'+
      '<div class="brand"><span class="logo">'+miniBlocks()+'</span><div><h1>Wahrnehmungs-Studie</h1>'+
        '<p class="sub">Tägliche Kurzmessung · ca. '+mins+'–'+(mins+5)+' Minuten</p></div></div>'+
      '<p class="lead">Heute sind <b>'+PLAN.length+' kurze Aufgaben</b> dran. Mach sie konzentriert und ungestört. Antworte zügig, aber sorgfältig.</p>'+
      '<label class="fld"><span>Name</span><input id="pid" type="text" placeholder="z. B. TP-01" value="'+savedPid+'" autocomplete="off"></label>'+
      '<label class="fld"><span>Heutiger Studientag</span><select id="day">'+opts+'</select></label>'+
      (last? '<p class="hint">Zuletzt: <b>'+escapeHtml(last.dayLabel)+'</b> ('+new Date(last.finishedAt||last.startedAt).toLocaleString('de-DE')+')</p>':'')+
      '<div class="cloud '+(cloudReady()?'on':'off')+'">'+(cloudReady()?'● Online-Sicherung aktiv':'○ Offline-Modus – Daten werden lokal gespeichert')+'</div>'+
      '<button class="btn primary big" id="start">Sitzung starten</button>'+
      '<button class="btn ghost" id="export">Bisherige Daten exportieren</button>'+
    '</div>');
  $('#start').onclick=function(){
    var pid=$('#pid').value.trim();
    if(!pid){ $('#pid').classList.add('err'); $('#pid').focus(); return; }
    if(!PLAN.length){ alert('Es sind keine Tests konfiguriert. Bitte im Dashboard Tests auswählen.'); return; }
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
  var p=PLAN[STEP], def=p.def;
  setScreen('<div class="card">'+progressBar()+
    '<h2 class="ttl">'+(STEP+1)+' · '+escapeHtml(def.name)+'</h2>'+
    '<p class="lead">'+def.short+'</p>'+
    '<p class="keys">'+keyHint(def.id)+'</p>'+
    '<button class="btn primary big" id="go">Los geht’s</button></div>');
  $('#go').onclick=runCurrent;
}
function keyHint(id){
  switch(id){
    case 'rotation3d': return 'Tasten: <b>F</b> = dieselbe Figur · <b>J</b> = Spiegelbild';
    case 'gapfit': case 'lineclose': case 'control_math': return 'Tasten: <b>1–4</b> für die Auswahl';
    case 'paperfold': return 'Tasten: <b>1–5</b> (A–E) für die Auswahl';
    case 'corsi': return 'Mit Maus/Finger antippen';
    case 'timeprod': return '';
    case 'deary_rt': return 'Tasten: <b>D F J K</b> für die vier Felder';
    case 'taskswitch': return 'Tasten: <b>F</b> = linke Antwort · <b>J</b> = rechte Antwort';
    case 'trunkpack': return 'Tasten: <b>F</b> = passt · <b>J</b> = passt nicht';
    case 'visualsearch': case 'concentration': return 'Mit Maus/Finger antippen';
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
  var p=PLAN[STEP], def=p.def;
  setScreen('<div class="card test"><div class="testhead"><span>'+escapeHtml(def.name)+'</span><span id="cnt"></span></div><div id="timerbar" class="timerbar"></div><div id="host"></div></div>');
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
  setScreen('<div class="card done"><h2 class="ttl">Fast geschafft</h2>'+
    '<p class="lead">Zwei kurze, freiwillige Angaben – dann werden deine Daten gesichert.</p>'+
    '<label class="fld"><span>Falls du heute schon gespielt hast: geschätzte Dauer (Minuten)</span><input id="play" type="number" min="0" inputmode="numeric" placeholder="optional"></label>'+
    '<label class="fld"><span>Notiz (optional – etwas Auffälliges heute?)</span><textarea id="note" rows="3" placeholder="optional"></textarea></label>'+
    '<button class="btn primary big" id="finish">Sitzung abschließen &amp; speichern</button></div>');
  $('#finish').onclick=async function(){
    SESSION.estPlayMin = $('#play').value!==''? Number($('#play').value) : null;
    SESSION.note = $('#note').value.trim();
    SESSION.finishedAt = new Date().toISOString();
    $('#finish').disabled=true; $('#finish').textContent='Speichere…';
    var status=await saveSession(SESSION);
    localStorage.setItem('tetris_lastSession', JSON.stringify({ dayLabel:SESSION.dayLabel, finishedAt:SESSION.finishedAt }));
    screenThanks(status);
  };
}
function screenThanks(status){
  setScreen('<div class="card thanks"><div class="big-tick">'+miniBlocks(true)+'</div>'+
    '<h2 class="ttl">Danke – Sitzung gespeichert</h2>'+
    '<p class="lead">'+(status.cloud?'✓ Online gesichert.':'✓ Lokal gespeichert. <b>Bitte vor dem Schließen exportieren.</b>')+'</p>'+
    '<p class="muted center">Bis zur nächsten Sitzung. Du kannst dieses Fenster jetzt schließen.</p>'+
    '<button class="btn ghost" id="export">Daten exportieren (CSV + JSON)</button>'+
    '<button class="btn ghost" id="again">Neue Sitzung</button></div>');
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
  var all=localSessions(); if(!all.length){ alert('Noch keine Daten vorhanden.'); return; }
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

window.addEventListener('DOMContentLoaded', screenWelcome);
