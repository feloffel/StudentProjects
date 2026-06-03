/* =====================================================================
   tests.js — Zentraler Test-Pool für die Wahrnehmungs-Studie
   ---------------------------------------------------------------------
   Wird von der Teilnehmer-App (app.js) UND vom Dashboard (dashboard.js)
   geladen. Jeder Test ist ein eigenständiges Objekt:
     id            eindeutiger Schlüssel (für Speicherung/Config)
     name          laienverständlicher Name (Dashboard + App)
     short         was der Test tut, in einem Satz ohne Fachbegriffe
     measures      was er erfasst, in Alltagssprache
     difficulties  { leicht|mittel|schwer: {parameter...} }
     run(P, ui)    führt den Test aus (P = Parameter der Stufe, ui = Helfer)
                   liefert ein Ergebnis-Objekt zurück
     format(r)     macht aus dem Ergebnis lesbare Zeilen [{label, value}]
   Die run()-Funktionen laufen nur in der App (brauchen ui). Das Dashboard
   nutzt nur name/short/measures/difficulties/format.
   ===================================================================== */
'use strict';

/* ---------- kleine Helfer (rein, ohne DOM) ---------- */
var T = {
  rnd:  function(a,b){ return a + Math.random()*(b-a); },
  rint: function(a,b){ return Math.floor(T.rnd(a,b+1)); },
  pick: function(arr){ return arr[T.rint(0,arr.length-1)]; },
  shuffle: function(arr){ var a=arr.slice(); for(var i=a.length-1;i>0;i--){ var j=T.rint(0,i); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; },
  mean: function(xs){ return xs.length ? xs.reduce(function(s,x){return s+x;},0)/xs.length : null; },
  median: function(xs){ if(!xs.length) return null; var a=xs.slice().sort(function(p,q){return p-q;}); var m=Math.floor(a.length/2); return a.length%2? a[m] : (a[m-1]+a[m])/2; },
  round: function(x,n){ if(x==null) return null; n=n||0; var f=Math.pow(10,n); return Math.round(x*f)/f; }
};

/* ---------- Formatierungs-Helfer fürs Dashboard ---------- */
function fmtSec(ms){ if(ms==null) return "–"; return (ms/1000).toFixed(2).replace('.',',') + " Sek"; }
function fmtPct(x){ if(x==null) return "–"; return Math.round(x*100) + " %"; }
function fmtPlus(ms){ if(ms==null) return "–"; var s=(ms/1000); return (s>=0?"+":"") + s.toFixed(1).replace('.',',') + " Sek"; }

/* =====================================================================
   GEOMETRIE: 3D-Würfelfiguren (Shepard-Metzler-Stil)
   ===================================================================== */
// Polywürfel als Liste von [x,y,z]. Erzeugt eine zusammenhängende
// "Arm"-Figur mit ein paar 90°-Knicken (wie die klassischen Figuren).
function makePolycube(nCubes){
  var axes=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  function axisOf(d){ return d[0]!==0?0:(d[1]!==0?1:2); }
  for(var attempt=0; attempt<300; attempt++){
    var cells=[[0,0,0]], seen={"0,0,0":1}, pos=[0,0,0], lastAxis=-1, used={}, ok=true;
    while(cells.length<nCubes){
      // neue Richtung mit ANDERER Achse als zuletzt -> echte Arme mit 90°-Knick
      var choices=T.shuffle(axes.slice()).filter(function(d){ return axisOf(d)!==lastAxis; });
      var chosen=null;
      for(var ci=0; ci<choices.length; ci++){
        var d=choices[ci], np=[pos[0]+d[0],pos[1]+d[1],pos[2]+d[2]];
        if(!seen[np.join(',')]){ chosen=d; break; }
      }
      if(!chosen){ ok=false; break; }
      var armLen=T.rint(2,4), grew=false;
      for(var s=0; s<armLen && cells.length<nCubes; s++){
        var n2=[pos[0]+chosen[0],pos[1]+chosen[1],pos[2]+chosen[2]], key=n2.join(',');
        if(seen[key]) break;
        pos=n2; seen[key]=1; cells.push(n2); grew=true;
      }
      if(!grew){ ok=false; break; }
      used[axisOf(chosen)]=1; lastAxis=axisOf(chosen);
    }
    // nur akzeptieren, wenn die Figur wirklich räumlich ist (alle 3 Achsen genutzt)
    if(ok && cells.length===nCubes && used[0] && used[1] && used[2]) return cells;
  }
  // Fallback: garantierte 3D-Treppe über x/y/z
  var fb=[[0,0,0]], p=[0,0,0], seq=[[1,0,0],[0,1,0],[0,0,1]];
  for(var i=1;i<nCubes;i++){ var d=seq[i%3]; p=[p[0]+d[0],p[1]+d[1],p[2]+d[2]]; fb.push(p.slice()); }
  return fb;
}
function rotX(c){ return [ c[0], -c[2], c[1] ]; }
function rotY(c){ return [ c[2], c[1], -c[0] ]; }
function rotZ(c){ return [ -c[1], c[0], c[2] ]; }
function applyRots(cells, seq){
  return cells.map(function(c){
    var p=c.slice();
    for(var i=0;i<seq.length;i++){ p = seq[i]==='x'?rotX(p):seq[i]==='y'?rotY(p):rotZ(p); }
    return p;
  });
}
function mirrorCells(cells){ return cells.map(function(c){ return [-c[0], c[1], c[2]]; }); }
function normKey(cells){
  var mn=[Infinity,Infinity,Infinity];
  cells.forEach(function(c){ for(var k=0;k<3;k++) if(c[k]<mn[k]) mn[k]=c[k]; });
  return cells.map(function(c){ return (c[0]-mn[0])+','+(c[1]-mn[1])+','+(c[2]-mn[2]); }).sort().join(';');
}
function randomRotSeq(){
  var ax=['x','y','z']; var n=T.rint(2,4); var s=[];
  for(var i=0;i<n;i++) s.push(T.pick(ax));
  return s.join('');
}
// alle 24 Rotationen als Schlüsselmenge (für "ist Spiegelbild wirklich nicht erreichbar?")
function intersects(a,b){ for(var k in a){ if(b[k]) return true; } return false; }
function allRotKeys(cells){
  var seqs = ['', 'x','y','z','xx','xy','xz','yx','yy','yz','zx','zy','zz',
              'xxx','xxy','xyx','xyy','yyy','zzz','xxz','xzz','yzz','zzy','xyz'];
  var set={};
  for(var i=0;i<seqs.length;i++){ set[normKey(applyRots(cells, seqs[i]))]=1; }
  return set;
}
// Isometrische SVG-Zeichnung einer Würfelfigur
function cubesSVG(cells, opts){
  opts = opts || {};
  var size = opts.size || 200;
  var pad = opts.pad || 16;
  var col = opts.color || "#9aa6c8";
  // iso-Projektion (Skalierung u wird unten automatisch an die Figur angepasst)
  function projU(x,y,z){ return [ (x - y), (x + y) * 0.5 - z ]; }
  var uPts = cells.map(function(c){ return projU(c[0],c[1],c[2]); });
  // Bounds inkl. der oberen/rechten Würfelflächen (+1 Zelle)
  var corners=[];
  cells.forEach(function(c){
    corners.push(projU(c[0],c[1],c[2]+1));
    corners.push(projU(c[0]+1,c[1]+1,c[2]));
    corners.push(projU(c[0]+1,c[1],c[2]+1));
    corners.push(projU(c[0],c[1]+1,c[2]+1));
  });
  var minx=Infinity,maxx=-Infinity,miny=Infinity,maxy=-Infinity;
  corners.forEach(function(p){ if(p[0]<minx)minx=p[0]; if(p[0]>maxx)maxx=p[0]; if(p[1]<miny)miny=p[1]; if(p[1]>maxy)maxy=p[1]; });
  var spanx=Math.max(0.001,maxx-minx), spany=Math.max(0.001,maxy-miny);
  var u = Math.min( (size-2*pad)/spanx, (size-2*pad)/spany );
  u = Math.min(u, opts.u || 22);                 // nicht größer als nötig
  function proj(x,y,z){ var p=projU(x,y,z); return [p[0]*u, p[1]*u]; }
  var ox = size/2 - ((minx+maxx)/2)*u;
  var oy = size/2 - ((miny+maxy)/2)*u;
  // Maler-Algorithmus: hintere zuerst
  var order = cells.map(function(c,i){ return {c:c, k:c[0]+c[1]+c[2]}; })
                   .sort(function(a,b){ return a.k-b.k; });
  function shade(hex,f){ // f<1 dunkler, >1 heller
    var n=parseInt(hex.slice(1),16); var r=(n>>16)&255,g=(n>>8)&255,b=n&255;
    r=Math.max(0,Math.min(255,Math.round(r*f))); g=Math.max(0,Math.min(255,Math.round(g*f))); b=Math.max(0,Math.min(255,Math.round(b*f)));
    return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  }
  var top=shade(col,1.18), left=shade(col,0.82), right=shade(col,0.62), edge=shade(col,0.45);
  var svg='';
  order.forEach(function(o){
    var c=o.c;
    function P(x,y,z){ var p=proj(x,y,z); return (ox+p[0]).toFixed(1)+','+(oy+p[1]).toFixed(1); }
    var x=c[0],y=c[1],z=c[2];
    // top face (z+1)
    svg += '<polygon points="'+P(x,y,z+1)+' '+P(x+1,y,z+1)+' '+P(x+1,y+1,z+1)+' '+P(x,y+1,z+1)+'" fill="'+top+'" stroke="'+edge+'" stroke-width="1"/>';
    // left face (y+1 side)
    svg += '<polygon points="'+P(x,y+1,z+1)+' '+P(x,y+1,z)+' '+P(x,y,z)+' '+P(x,y,z+1)+'" fill="'+left+'" stroke="'+edge+'" stroke-width="1"/>';
    // right face (x+1 side)
    svg += '<polygon points="'+P(x+1,y,z+1)+' '+P(x+1,y,z)+' '+P(x+1,y+1,z)+' '+P(x+1,y+1,z+1)+'" fill="'+right+'" stroke="'+edge+'" stroke-width="1"/>';
  });
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'" aria-hidden="true">'+svg+'</svg>';
}

/* =====================================================================
   GEOMETRIE: neutrale Puzzle-Teile (für Einpassen, ohne Tetris-Optik)
   ===================================================================== */
// Pentominoes (5 Felder) – bewusst KEINE Tetris-Formen (Tetris = 4 Felder)
var PIECES = {
  F:[[1,0],[2,0],[0,1],[1,1],[1,2]],
  L:[[0,0],[0,1],[0,2],[0,3],[1,3]],
  N:[[1,0],[1,1],[0,2],[1,2],[0,3]],
  P:[[0,0],[1,0],[0,1],[1,1],[0,2]],
  T:[[0,0],[1,0],[2,0],[1,1],[1,2]],
  U:[[0,0],[2,0],[0,1],[1,1],[2,1]],
  V:[[0,0],[0,1],[0,2],[1,2],[2,2]],
  W:[[0,0],[0,1],[1,1],[1,2],[2,2]],
  Y:[[1,0],[0,1],[1,1],[1,2],[1,3]],
  Z:[[0,0],[1,0],[1,1],[1,2],[2,2]]
};
// Spiegelung in 2D (x negieren) + Normalisierung
function preflect(cells){ return pnorm(cells.map(function(c){ return [-c[0], c[1]]; })); }
// chiral = Spiegelbild ist durch keine 90°-Drehung erreichbar (taugt als harter Distraktor)
function pIsChiral(key){
  var base={}, mir={};
  for(var r=0;r<4;r++){ base[pkey(protN(PIECES[key],r))]=1; mir[pkey(protN(preflect(PIECES[key]),r))]=1; }
  for(var k in mir){ if(base[k]) return false; }
  return true;
}
function pnorm(cells){ var mx=Math.min.apply(null,cells.map(function(c){return c[0];})), my=Math.min.apply(null,cells.map(function(c){return c[1];})); return cells.map(function(c){ return [c[0]-mx,c[1]-my]; }); }
function prot(cells){ return pnorm(cells.map(function(c){ return [-c[1], c[0]]; })); }
function protN(cells,n){ var c=cells; n=((n%4)+4)%4; for(var i=0;i<n;i++) c=prot(c); return c; }
function pkey(cells){ return pnorm(cells).map(function(c){return c.join(',');}).sort().join(';'); }
function pdistinctRots(key){ var seen={}, res=[]; for(var r=0;r<4;r++){ var k=pkey(protN(PIECES[key],r)); if(!(k in seen)){ seen[k]=1; res.push(r); } } return res; }
function pieceSVG(cells, opts){
  opts=opts||{}; var size=opts.size||100, cell=opts.cell||22, gap=3, col=opts.color||"#8d97bd";
  var nc=pnorm(cells); var cols=Math.max.apply(null,nc.map(function(c){return c[0];}))+1; var rows=Math.max.apply(null,nc.map(function(c){return c[1];}))+1;
  var w=cols*cell, h=rows*cell, ox=(size-w)/2, oy=(size-h)/2, r='';
  nc.forEach(function(c){ var px=ox+c[0]*cell+gap/2, py=oy+c[1]*cell+gap/2, s=cell-gap;
    r+='<rect x="'+px+'" y="'+py+'" width="'+s+'" height="'+s+'" rx="3" fill="'+col+'"/>'; });
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'">'+r+'</svg>';
}
function placeGap(cells){ // platziert ein (rotiertes) Teil in ein 6x5-Feld, gibt belegte Zellen
  var cols=Math.max.apply(null,cells.map(function(c){return c[0];}))+1, rows=Math.max.apply(null,cells.map(function(c){return c[1];}))+1;
  var ox=T.rint(0,Math.max(0,6-cols)), oy=T.rint(0,Math.max(0,5-rows));
  return cells.map(function(c){ return [c[0]+ox, c[1]+oy]; });
}
function gridGapSVG(gapCells){
  var COLS=6, ROWS=5, cell=34, gap=3, pad=8;
  var set={}; gapCells.forEach(function(c){ set[c[0]+','+c[1]]=1; });
  var w=COLS*cell, h=ROWS*cell, r='';
  for(var y=0;y<ROWS;y++) for(var x=0;x<COLS;x++){
    var px=pad+x*cell+gap/2, py=pad+y*cell+gap/2, s=cell-gap;
    if(set[x+','+y]) r+='<rect x="'+px+'" y="'+py+'" width="'+s+'" height="'+s+'" rx="3" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.20)" stroke-dasharray="3 3"/>';
    else r+='<rect x="'+px+'" y="'+py+'" width="'+s+'" height="'+s+'" rx="3" fill="#3a4263"/>';
  }
  return '<svg viewBox="0 0 '+(w+pad*2)+' '+(h+pad*2)+'" width="'+(w+pad*2)+'" height="'+(h+pad*2)+'">'+r+'</svg>';
}

/* =====================================================================
   MENTALE ROTATION – BILD-BASIERT (Bilder aus dem Ordner MentalRotationImages)
   Dateiname {Figur}_{Winkel}.jpg = gedreht (Antwort "gleich"),
   {Figur}_{Winkel}_R.jpg = gespiegelt (Antwort "Spiegelbild").
   ===================================================================== */
var __rotManifest;  // undefined=noch nicht gebaut, Objekt=fertig
// Standard-Schema, falls keine manifest.js vorhanden ist: Dateinamen werden selbst gebildet.
function rotConventionManifest(){
  var folder='MentalRotationImages', FIGS=48, ANGLES=[0,50,100,150], images=[];
  for(var f=1; f<=FIGS; f++){
    for(var ai=0; ai<ANGLES.length; ai++){
      images.push({ file:f+'_'+ANGLES[ai]+'.jpg',   figure:f, angle:ANGLES[ai], mirror:false });
      images.push({ file:f+'_'+ANGLES[ai]+'_R.jpg', figure:f, angle:ANGLES[ai], mirror:true  });
    }
  }
  return { folder:folder, images:images };
}
// Liest die Bildliste OHNE fetch (läuft daher auch per Doppelklick / file://):
// 1) globale Variable aus MentalRotationImages/manifest.js (per <script> geladen),
// 2) sonst nach Namensschema selbst erzeugt.
// Jede Bilddatei ist EIN kompletter Durchgang (Ursprungs- und veränderte Figur sind im selben Bild).
// Antwort: ohne _R = "Dieselbe Figur" (same), mit _R = "Spiegelbild" (mir).
function loadRotationImages(){
  if(__rotManifest!==undefined) return __rotManifest;
  var data = (typeof window!=='undefined' && window.MENTAL_ROTATION_MANIFEST) ? window.MENTAL_ROTATION_MANIFEST
           : (typeof MENTAL_ROTATION_MANIFEST!=='undefined' ? MENTAL_ROTATION_MANIFEST : null);
  if(!data || !data.images || !data.images.length) data = rotConventionManifest();
  var fld=data.folder||'MentalRotationImages';
  var items=data.images.map(function(im){
    return { figure:im.figure, angle:im.angle, mirror:!!im.mirror,
             img: fld+'/'+im.file, correct: im.mirror ? 'mir' : 'same' };
  });
  __rotManifest={ folder:fld, items:items };
  return __rotManifest;
}
// Durchgänge nach erlaubten Winkeln (Schwierigkeit) filtern, gemischt
function rotPool(man, angles){
  var ok={}; (angles||[]).forEach(function(a){ ok[a]=1; });
  var pool=man.items.filter(function(it){ return !angles || !angles.length || ok[it.angle]; });
  return T.shuffle(pool.slice());
}
// Bild vorab laden; false, wenn es nicht existiert -> Code wählt dann ein anderes
function preloadImg(src){
  return new Promise(function(resolve){
    var done=false; function fin(v){ if(!done){ done=true; resolve(v); } }
    try{
      var im=new Image();
      im.onload=function(){ fin(true); };
      im.onerror=function(){ fin(false); };
      im.src=src;
      setTimeout(function(){ fin(false); }, 4000);   // Sicherheits-Timeout, falls nichts feuert
    }catch(e){ fin(false); }
  });
}
// Fallback: code-generierte 3D-Würfelfiguren, falls keine Bilder/kein Manifest da sind
async function rotationFallbackRun(P, ui){
  var results=[], cubes=P.cubes||11;
  for(var i=0;i<P.trials;i++){
    var base, isMirror=(i % 2 === 0), guard=0;
    do { base = makePolycube(cubes); guard++; }
    while(isMirror && guard<40 && intersects(allRotKeys(base), allRotKeys(mirrorCells(base))));
    var refCells=applyRots(base, randomRotSeq());
    var cmpCells=applyRots(isMirror?mirrorCells(base):base, randomRotSeq());
    ui.count((i+1)+' / '+P.trials);
    await ui.fixation();
    ui.host.innerHTML =
      '<div class="stage rot3d"><div class="pair3d">'+
        '<div class="shp3d">'+cubesSVG(refCells,{})+'</div><div class="vs">?</div>'+
        '<div class="shp3d">'+cubesSVG(cmpCells,{})+'</div></div>'+
        '<div class="answers two">'+
          '<button class="btn ans" data-a="same"><kbd>F</kbd> Dieselbe Figur</button>'+
          '<button class="btn ans" data-a="mir"><kbd>J</kbd> Spiegelbild</button>'+
        '</div></div>';
    var t0=performance.now();
    var ans=await ui.choice([['same','f'],['mir','j']]);
    var rt=performance.now()-t0;
    var correct=(ans==='mir')===isMirror;
    results.push({ i:i+1, mirror:isMirror, answer:ans, correct:correct, rt:T.round(rt) });
    await ui.flash(correct);
  }
  var rts=results.filter(function(r){return r.correct;}).map(function(r){return r.rt;});
  return { n:results.length, source:'generiert', correctCount:results.filter(function(r){return r.correct;}).length,
           accuracy:T.round(results.filter(function(r){return r.correct;}).length/results.length,3),
           avgMs:T.round(T.mean(rts),0), medMs:T.round(T.median(rts),0), trials:results };
}

/* =====================================================================
   DER TEST-POOL
   ===================================================================== */
var TEST_POOL = [

/* ---- 1. 3D-Figuren drehen (Mentale Rotation, Würfelfiguren) ---- */
{
  id:'rotation3d',
  name:'Figuren im Kopf drehen',
  short:'Ein Bild mit zwei Figuren: ist die zweite dieselbe (nur gedreht) oder das Spiegelbild?',
  measures:'Wie schnell und sicher räumlich gedreht wird.',
  defaultDifficulty:'mittel',
  difficulties:{
    leicht:{ trials:12, angles:[0,50],     cubes:9  },
    mittel:{ trials:18, angles:[50,100],   cubes:11 },
    schwer:{ trials:24, angles:[100,150],  cubes:14 }
  },
  run: async function(P, ui){
    var man = loadRotationImages();
    if(man && man.items && man.items.length){
      var pool = rotPool(man, P.angles || [50,100,150]);
      if(pool.length){
        var results=[], used=0, idx=0, guard=pool.length*4;
        while(used<P.trials && idx<guard){
          var t=pool[idx % pool.length]; idx++;
          var ok=await preloadImg(t.img);                  // fehlt das Bild -> nächstes
          if(!ok){ if(used===0 && idx>=pool.length) break; continue; }
          ui.count((used+1)+' / '+P.trials);
          await ui.fixation();
          ui.host.innerHTML =
            '<div class="stage rot3d">'+
              '<div class="shp3d single"><img class="rotimg" src="'+t.img+'" alt="Aufgabenbild"></div>'+
              '<div class="answers two">'+
                '<button class="btn ans" data-a="same"><kbd>F</kbd> Dieselbe Figur</button>'+
                '<button class="btn ans" data-a="mir"><kbd>J</kbd> Spiegelbild</button>'+
              '</div></div>';
          var t0=performance.now();
          var ans=await ui.choice([['same','f'],['mir','j']]);
          var rt=performance.now()-t0;
          var correct=(ans===t.correct);
          results.push({ i:used+1, figure:t.figure, angle:t.angle, mirror:t.mirror, answer:ans, correct:correct, rt:T.round(rt) });
          await ui.flash(correct);
          used++;
        }
        if(results.length){
          var rts=results.filter(function(r){return r.correct;}).map(function(r){return r.rt;});
          return { n:results.length, source:'bilder', correctCount:results.filter(function(r){return r.correct;}).length,
                   accuracy:T.round(results.filter(function(r){return r.correct;}).length/results.length,3),
                   avgMs:T.round(T.mean(rts),0), medMs:T.round(T.median(rts),0), trials:results };
        }
      }
    }
    // keine Bilder gefunden -> generierte Würfelfiguren als Rückfallebene
    return await rotationFallbackRun(P, ui);
  },
  format:function(r){ return [
    {label:'Richtig erkannt', value:fmtPct(r.accuracy)},
    {label:'Typische Antwortzeit', value:fmtSec(r.medMs)},
    {label:'Aufgaben gesamt', value:r.n}
  ]; }
},

/* ---- 2. Teile einpassen (neutrale Optik) ---- */
{
  id:'gapfit',
  name:'Teile einpassen',
  short:'Oben ist ein Feld mit einer Lücke. Welches der vier Teile füllt sie genau?',
  measures:'Wie schnell man erkennt, welche Form in eine Lücke passt.',
  defaultDifficulty:'mittel',
  difficulties:{
    leicht:{ trials:10, mirrorFrom:99 },
    mittel:{ trials:15, mirrorFrom:8 },
    schwer:{ trials:20, mirrorFrom:1 }
  },
  run: async function(P, ui){
    var keys=Object.keys(PIECES), targets=keys.slice();
    var results=[];
    for(var i=0;i<P.trials;i++){
      var ck=T.pick(targets), drs=pdistinctRots(ck), gapRot=T.pick(drs);
      var gapNorm=pkey(protN(PIECES[ck],gapRot));
      var turned=drs.filter(function(rr){ return pkey(protN(PIECES[ck],rr))!==gapNorm; });
      var dispRot = turned.length? T.pick(turned) : gapRot;
      var correct={ key:ck, cells:protN(PIECES[ck],dispRot), isCorrect:true };
      var distract=[];
      // harter Distraktor: Spiegelbild des richtigen Teils (nur wenn chiral)
      if(i>=P.mirrorFrom && pIsChiral(ck)){
        distract.push({ key:ck+'\u2032', cells:protN(preflect(PIECES[ck]), T.rint(0,3)), isCorrect:false });
      }
      var others=T.shuffle(keys.filter(function(k){return k!==ck;}));
      for(var o=0;o<others.length && distract.length<3;o++){
        var k=others[o];
        distract.push({ key:k, cells:protN(PIECES[k], T.pick(pdistinctRots(k))), isCorrect:false });
      }
      distract=distract.slice(0,3);
      var options=T.shuffle([correct].concat(distract));
      var correctIndex=options.findIndex(function(o){return o.isCorrect;});
      var gapCells=placeGap(protN(PIECES[ck],gapRot));
      ui.count((i+1)+' / '+P.trials);
      await ui.fixation();
      ui.host.innerHTML =
        '<div class="stage gap">'+
          '<div class="well">'+gridGapSVG(gapCells)+'<div class="welllbl">Welches Teil füllt die Lücke?</div></div>'+
          '<div class="answers four">'+
            options.map(function(op,k){ return '<button class="btn ans opt" data-a="'+k+'"><kbd>'+(k+1)+'</kbd>'+pieceSVG(op.cells,{size:88,cell:18})+'</button>'; }).join('')+
          '</div>'+
        '</div>';
      var t0=performance.now();
      var ans=await ui.choice(options.map(function(_,k){ return [String(k), String(k+1)]; }));
      var rt=performance.now()-t0;
      var ok=Number(ans)===correctIndex;
      results.push({ i:i+1, correct:ok, rt:T.round(rt) });
      await ui.flash(ok);
    }
    var rts=results.filter(function(r){return r.correct;}).map(function(r){return r.rt;});
    return { n:results.length, correctCount:results.filter(function(r){return r.correct;}).length,
             accuracy:T.round(results.filter(function(r){return r.correct;}).length/results.length,3),
             avgMs:T.round(T.mean(rts),0), medMs:T.round(T.median(rts),0), trials:results };
  },
  format:function(r){ return [
    {label:'Richtig eingepasst', value:fmtPct(r.accuracy)},
    {label:'Typische Antwortzeit', value:fmtSec(r.medMs)},
    {label:'Aufgaben gesamt', value:r.n}
  ]; }
},

/* ---- 3. Corsi Block-Tapping (1:1) ---- */
{
  id:'corsi',
  name:'Felder-Folge merken (Corsi)',
  short:'Unregelmäßig verteilte Felder leuchten nacheinander auf; danach in gleicher Reihenfolge antippen.',
  measures:'Wie viele Positionen man sich in der richtigen Reihenfolge merken kann.',
  defaultDifficulty:'mittel',
  difficulties:{
    leicht:{ start:2, max:6, perLen:2 },
    mittel:{ start:3, max:8, perLen:2 },
    schwer:{ start:4, max:9, perLen:2 }
  },
  // Größeres, unregelmäßiges Board (14 Felder) – verhindert Raten per Ausschluss.
  board:[ [12,14],[70,6],[128,18],[186,8],
          [34,60],[96,50],[152,64],[206,44],
          [8,108],[72,100],[132,110],[192,96],
          [44,154],[150,150] ],
  run: async function(P, ui){
    var board=this.board, N=board.length;
    var trials=[], span=0, len=P.start;
    while(len<=P.max){
      var correctAtLen=0;
      for(var rep=0; rep<P.perLen; rep++){
        var seq=T.shuffle(Array.apply(null,{length:N}).map(function(_,k){return k;})).slice(0,len);
        ui.count('Länge '+len);
        ui.host.innerHTML='<div class="stage corsi"><div class="corsiboard" id="cb">'+
          board.map(function(b,k){ return '<button class="cblk" data-k="'+k+'" disabled style="left:'+b[0]+'px;top:'+b[1]+'px"></button>'; }).join('')+
          '</div><div class="status" id="st">Merke dir die Reihenfolge…</div></div>';
        await ui.sleep(700);
        for(var s=0;s<seq.length;s++){
          var b=ui.host.querySelector('.cblk[data-k="'+seq[s]+'"]');
          b.classList.add('lit'); await ui.sleep(650); b.classList.remove('lit'); await ui.sleep(250);
        }
        ui.host.querySelector('#st').textContent='Jetzt antippen';
        var resp=await collectTaps(ui.host, len);
        var ok = resp.length===seq.length && resp.every(function(v,idx){ return v===seq[idx]; });
        if(ok) correctAtLen++;
        trials.push({ len:len, seq:seq, resp:resp, correct:ok });
      }
      if(correctAtLen>0) span=len;
      if(correctAtLen===0) break;
      len++;
    }
    var corr=trials.filter(function(t){return t.correct;}).length;
    return { bestLength:span, correctCount:corr, totalTrials:trials.length, trials:trials };
  },
  format:function(r){ return [
    {label:'Längste gemerkte Folge', value:(r.bestLength||0)+' Felder'},
    {label:'Richtige Durchgänge', value:(r.correctCount||0)+' von '+(r.totalTrials||0)}
  ]; }
},

/* ---- 4. Zeitgefühl (Zeitproduktion, OHNE blinkenden Punkt) ---- */
{
  id:'timeprod',
  name:'Zeitgefühl',
  short:'Ohne Zählen anzeigen, wann eine bestimmte Zeitspanne vorbei ist (Start, dann Stopp).',
  measures:'Wie genau das Zeitgefühl ist.',
  defaultDifficulty:'mittel',
  difficulties:{
    leicht:{ targets:[30] },
    mittel:{ targets:[30,60] },
    schwer:{ targets:[30,60,90] }
  },
  run: async function(P, ui){
    var out=[];
    for(var i=0;i<P.targets.length;i++){
      var target=P.targets[i];
      var ms=await produceInterval(ui, target);
      out.push({ target:target, producedMs:T.round(ms,0), devMs:T.round(ms-target*1000,0) });
    }
    return { targets:out };
  },
  format:function(r){
    if(!r.targets) return [{label:'Ergebnis', value:'–'}];
    return r.targets.map(function(t){ return { label:t.target+' Sekunden geschätzt', value:'Abweichung '+fmtPlus(t.devMs) }; });
  }
},

/* ---- 5. Kopfrechnen (Kontrolle, ohne Raumbezug) ---- */
{
  id:'control_math',
  name:'Kopfrechnen (Kontrolle)',
  short:'Einfache Plus- und Minus-Aufgaben lösen. Hat absichtlich nichts mit Raum zu tun.',
  measures:'Allgemeines Tempo & Konzentration – als Vergleichswert.',
  defaultDifficulty:'mittel',
  difficulties:{
    leicht:{ trials:15, max:50 },
    mittel:{ trials:20, max:90 },
    schwer:{ trials:25, max:140 }
  },
  run: async function(P, ui){
    var results=[];
    for(var i=0;i<P.trials;i++){
      var op=T.pick(['+','-']); var a=T.rint(11,P.max), b=T.rint(11,P.max);
      if(op==='-' && b>a){ var tmp=a; a=b; b=tmp; }
      var res = op==='+'? a+b : a-b;
      var opts={}; opts[res]=1;
      var arr=[res];
      while(arr.length<4){ var d=res + T.pick([-1,1])*T.rint(1,9); if(d>0 && arr.indexOf(d)<0) arr.push(d); }
      var options=T.shuffle(arr); var ci=options.indexOf(res);
      ui.count((i+1)+' / '+P.trials);
      await ui.fixation();
      ui.host.innerHTML='<div class="stage calc"><div class="eq">'+a+' '+(op==='-'?'−':'+')+' '+b+' =</div>'+
        '<div class="answers four num">'+options.map(function(o,k){ return '<button class="btn ans" data-a="'+k+'"><kbd>'+(k+1)+'</kbd>'+o+'</button>'; }).join('')+'</div></div>';
      var t0=performance.now();
      var ans=await ui.choice(options.map(function(_,k){ return [String(k),String(k+1)]; }));
      var rt=performance.now()-t0; var ok=Number(ans)===ci;
      results.push({ i:i+1, correct:ok, rt:T.round(rt) });
      await ui.flash(ok);
    }
    var rts=results.filter(function(r){return r.correct;}).map(function(r){return r.rt;});
    return { n:results.length, correctCount:results.filter(function(r){return r.correct;}).length,
             accuracy:T.round(results.filter(function(r){return r.correct;}).length/results.length,3),
             avgMs:T.round(T.mean(rts),0), medMs:T.round(T.median(rts),0), trials:results };
  },
  format:function(r){ return [
    {label:'Richtig gerechnet', value:fmtPct(r.accuracy)},
    {label:'Typische Antwortzeit', value:fmtSec(r.medMs)},
    {label:'Aufgaben gesamt', value:r.n}
  ]; }
},

/* ---- 6. Papier falten (Paper Folding VZ-2-Stil) ---- */
{
  id:'paperfold',
  name:'Papier im Kopf falten',
  short:'Ein Blatt wird gefaltet und gelocht. Wo sind die Löcher, wenn man es wieder aufklappt?',
  measures:'Räumliches Vorstellungsvermögen (mehrschrittiges Denken).',
  defaultDifficulty:'mittel',
  difficulties:{
    leicht:{ trials:8,  folds:1, holes:1 },
    mittel:{ trials:10, folds:2, holes:1 },
    schwer:{ trials:12, folds:3, holes:1 }
  },
  run: async function(P, ui){
    var results=[];
    for(var i=0;i<P.trials;i++){
      var tr=makeFoldTrial(P.folds, P.holes||1);
      ui.count((i+1)+' / '+P.trials);
      await ui.fixation();
      ui.host.innerHTML =
        '<div class="stage fold">'+
          '<div class="foldsteps">'+tr.stepSVGs.join('<span class="arrow">→</span>')+'</div>'+
          '<div class="foldq">Wo sind die Löcher nach dem Aufklappen?</div>'+
          '<div class="answers four">'+
            tr.options.map(function(op,k){ return '<button class="btn ans opt" data-a="'+k+'"><kbd>'+(k+1)+'</kbd>'+foldGridSVG(op,72)+'</button>'; }).join('')+
          '</div>'+
        '</div>';
      var t0=performance.now();
      var ans=await ui.choice(tr.options.map(function(_,k){ return [String(k),String(k+1)]; }));
      var rt=performance.now()-t0; var ok=Number(ans)===tr.correctIndex;
      results.push({ i:i+1, correct:ok, rt:T.round(rt) });
      await ui.flash(ok);
    }
    var rts=results.filter(function(r){return r.correct;}).map(function(r){return r.rt;});
    return { n:results.length, correctCount:results.filter(function(r){return r.correct;}).length,
             accuracy:T.round(results.filter(function(r){return r.correct;}).length/results.length,3),
             avgMs:T.round(T.mean(rts),0), medMs:T.round(T.median(rts),0), trials:results };
  },
  format:function(r){ return [
    {label:'Richtig gelöst', value:fmtPct(r.accuracy)},
    {label:'Typische Antwortzeit', value:fmtSec(r.medMs)},
    {label:'Aufgaben gesamt', value:r.n}
  ]; }
},

/* ---- 7. Reaktionstest (Deary-Liewald-Stil, Wahlreaktion) ---- */
{
  id:'deary_rt',
  name:'Schnell reagieren',
  short:'Es leuchtet eines von vier Feldern auf – so schnell wie möglich die passende Taste drücken.',
  measures:'Reine Reaktionsgeschwindigkeit.',
  defaultDifficulty:'mittel',
  difficulties:{
    leicht:{ trials:15 },
    mittel:{ trials:24 },
    schwer:{ trials:32 }
  },
  run: async function(P, ui){
    var results=[]; var keys=['d','f','j','k'];
    for(var i=0;i<P.trials;i++){
      ui.count((i+1)+' / '+P.trials);
      ui.host.innerHTML='<div class="stage rt"><div class="rtrow">'+
        [0,1,2,3].map(function(k){ return '<div class="rtbox" data-k="'+k+'"><kbd>'+keys[k].toUpperCase()+'</kbd></div>'; }).join('')+
        '</div><div class="status">Warten…</div></div>';
      await ui.sleep(T.rint(800,1800));
      var target=T.rint(0,3);
      var box=ui.host.querySelector('.rtbox[data-k="'+target+'"]'); box.classList.add('lit');
      ui.host.querySelector('.status').textContent='Jetzt!';
      var t0=performance.now();
      var ans=await ui.choice([[String(target),keys[target]]].concat(
        [0,1,2,3].filter(function(k){return k!==target;}).map(function(k){ return ['wrong'+k, keys[k]]; })
      ));
      var rt=performance.now()-t0;
      var ok = ans===String(target);
      box.classList.remove('lit');
      results.push({ i:i+1, correct:ok, rt:T.round(rt) });
      await ui.flash(ok);
    }
    var rts=results.filter(function(r){return r.correct;}).map(function(r){return r.rt;});
    return { n:results.length, correctCount:results.filter(function(r){return r.correct;}).length,
             accuracy:T.round(results.filter(function(r){return r.correct;}).length/results.length,3),
             avgMs:T.round(T.mean(rts),0), medMs:T.round(T.median(rts),0), trials:results };
  },
  format:function(r){ return [
    {label:'Typische Reaktionszeit', value:fmtSec(r.medMs)},
    {label:'Richtige Taste', value:fmtPct(r.accuracy)},
    {label:'Durchgänge', value:r.n}
  ]; }
},

/* ---- 8. Regeln wechseln (Task Switching) ---- */
{
  id:'taskswitch',
  name:'Regeln wechseln',
  short:'Mal soll man beurteilen, ob eine Zahl groß/klein ist, mal ob sie gerade/ungerade ist. Die Regel wechselt.',
  measures:'Wie flexibel man zwischen Aufgaben umschaltet.',
  defaultDifficulty:'mittel',
  difficulties:{
    leicht:{ trials:18 },
    mittel:{ trials:28 },
    schwer:{ trials:40 }
  },
  run: async function(P, ui){
    var results=[]; var prevRule=null;
    for(var i=0;i<P.trials;i++){
      var rule=T.pick(['groesse','paritaet']);
      var n=T.pick([1,2,3,4,6,7,8,9]);
      var switched = prevRule!==null && rule!==prevRule;
      ui.count((i+1)+' / '+P.trials);
      var qLabel = rule==='groesse' ? 'GRÖSSE: kleiner oder größer als 5?' : 'ZAHL: gerade oder ungerade?';
      var leftLabel = rule==='groesse' ? '&lt; 5' : 'gerade';
      var rightLabel= rule==='groesse' ? '&gt; 5' : 'ungerade';
      await ui.fixation();
      ui.host.innerHTML='<div class="stage switch '+(rule==='groesse'?'r-size':'r-par')+'">'+
        '<div class="ruleban">'+qLabel+'</div>'+
        '<div class="bignum">'+n+'</div>'+
        '<div class="answers two">'+
          '<button class="btn ans" data-a="left"><kbd>F</kbd> '+leftLabel+'</button>'+
          '<button class="btn ans" data-a="right"><kbd>J</kbd> '+rightLabel+'</button>'+
        '</div></div>';
      var correctSide = rule==='groesse' ? (n<5?'left':'right') : (n%2===0?'left':'right');
      var t0=performance.now();
      var ans=await ui.choice([['left','f'],['right','j']]);
      var rt=performance.now()-t0; var ok=ans===correctSide;
      results.push({ i:i+1, rule:rule, switched:switched, correct:ok, rt:T.round(rt) });
      await ui.flash(ok);
      prevRule=rule;
    }
    var rts=results.filter(function(r){return r.correct;}).map(function(r){return r.rt;});
    var sw=results.filter(function(r){return r.switched && r.correct;}).map(function(r){return r.rt;});
    var st=results.filter(function(r){return !r.switched && r.correct;}).map(function(r){return r.rt;});
    return { n:results.length, correctCount:results.filter(function(r){return r.correct;}).length,
             accuracy:T.round(results.filter(function(r){return r.correct;}).length/results.length,3),
             avgMs:T.round(T.mean(rts),0), medMs:T.round(T.median(rts),0),
             switchMs:T.round(T.median(sw),0), stayMs:T.round(T.median(st),0),
             switchCost:(T.median(sw)!=null && T.median(st)!=null)? T.round(T.median(sw)-T.median(st),0) : null,
             trials:results };
  },
  format:function(r){ return [
    {label:'Richtig beurteilt', value:fmtPct(r.accuracy)},
    {label:'Antwortzeit normal', value:fmtSec(r.stayMs)},
    {label:'Antwortzeit nach Regelwechsel', value:fmtSec(r.switchMs)},
    {label:'Mehraufwand durch Wechsel', value:(r.switchCost!=null? fmtPlus(r.switchCost):'–')}
  ]; }
},

/* ---- 9. Muster vervollständigen (Linien-/Einrast-Effekt, Gestalt) ---- */
{
  id:'lineclose',
  name:'Muster vervollständigen',
  short:'Ein Raster-Muster hat eine fehlende Stelle. Welches Teil vervollständigt das Muster?',
  measures:'Wie schnell das Auge ein Muster „schließt“ und ergänzt.',
  defaultDifficulty:'mittel',
  difficulties:{
    leicht:{ trials:10, grid:3 },
    mittel:{ trials:14, grid:4 },
    schwer:{ trials:18, grid:5 }
  },
  run: async function(P, ui){
    var results=[];
    for(var i=0;i<P.trials;i++){
      var tr=makePatternTrial(P.grid);
      ui.count((i+1)+' / '+P.trials);
      await ui.fixation();
      ui.host.innerHTML='<div class="stage pattern">'+
        '<div class="pgrid">'+tr.gridSVG+'</div>'+
        '<div class="welllbl">Welches Teil schließt das Muster?</div>'+
        '<div class="answers four">'+
          tr.options.map(function(op,k){ return '<button class="btn ans opt" data-a="'+k+'"><kbd>'+(k+1)+'</kbd>'+op+'</button>'; }).join('')+
        '</div></div>';
      var t0=performance.now();
      var ans=await ui.choice(tr.options.map(function(_,k){ return [String(k),String(k+1)]; }));
      var rt=performance.now()-t0; var ok=Number(ans)===tr.correctIndex;
      results.push({ i:i+1, correct:ok, rt:T.round(rt) });
      await ui.flash(ok);
    }
    var rts=results.filter(function(r){return r.correct;}).map(function(r){return r.rt;});
    return { n:results.length, correctCount:results.filter(function(r){return r.correct;}).length,
             accuracy:T.round(results.filter(function(r){return r.correct;}).length/results.length,3),
             avgMs:T.round(T.mean(rts),0), medMs:T.round(T.median(rts),0), trials:results };
  },
  format:function(r){ return [
    {label:'Richtig ergänzt', value:fmtPct(r.accuracy)},
    {label:'Typische Antwortzeit', value:fmtSec(r.medMs)},
    {label:'Aufgaben gesamt', value:r.n}
  ]; }
},

/* ---- 10. Kofferraum packen (Pack-Logik / Alltag) ---- */
{
  id:'trunkpack',
  name:'Kofferraum packen',
  short:'Eine Kiste ist halb gefüllt. Passt das übrige Teil noch hinein (auch gedreht)?',
  measures:'Räumliches Planen wie beim Packen oder Spülmaschine-Einräumen.',
  defaultDifficulty:'mittel',
  difficulties:{
    leicht:{ trials:10, grid:4 },
    mittel:{ trials:14, grid:5 },
    schwer:{ trials:18, grid:6 }
  },
  run: async function(P, ui){
    var results=[];
    for(var i=0;i<P.trials;i++){
      var tr=makePackTrial(P.grid);
      ui.count((i+1)+' / '+P.trials);
      await ui.fixation();
      ui.host.innerHTML='<div class="stage pack">'+
        '<div class="packrow">'+
          '<div class="packbox"><div class="packlbl">Kiste</div>'+tr.boxSVG+'</div>'+
          '<div class="packpiece"><div class="packlbl">Dieses Teil</div>'+tr.pieceSVG+'</div>'+
        '</div>'+
        '<div class="welllbl">Passt das Teil noch hinein (auch gedreht)?</div>'+
        '<div class="answers two">'+
          '<button class="btn ans" data-a="yes"><kbd>F</kbd> Passt</button>'+
          '<button class="btn ans" data-a="no"><kbd>J</kbd> Passt nicht</button>'+
        '</div></div>';
      var t0=performance.now();
      var ans=await ui.choice([['yes','f'],['no','j']]);
      var rt=performance.now()-t0; var ok=(ans==='yes')===tr.fits;
      results.push({ i:i+1, fits:tr.fits, correct:ok, rt:T.round(rt) });
      await ui.flash(ok);
    }
    var rts=results.filter(function(r){return r.correct;}).map(function(r){return r.rt;});
    return { n:results.length, correctCount:results.filter(function(r){return r.correct;}).length,
             accuracy:T.round(results.filter(function(r){return r.correct;}).length/results.length,3),
             avgMs:T.round(T.mean(rts),0), medMs:T.round(T.median(rts),0), trials:results };
  },
  format:function(r){ return [
    {label:'Richtig entschieden', value:fmtPct(r.accuracy)},
    {label:'Typische Antwortzeit', value:fmtSec(r.medMs)},
    {label:'Aufgaben gesamt', value:r.n}
  ]; }
},

/* ---- 11. Symbol suchen (visuelle Suche mit Störern) ---- */
{
  id:'visualsearch',
  name:'Symbol suchen',
  short:'In einem Raster aus ähnlichen Kästchen das eine abweichende finden und antippen.',
  measures:'Wie schnell das Auge im Gewimmel das Besondere findet.',
  defaultDifficulty:'mittel',
  difficulties:{
    leicht:{ trials:10, items:16 },
    mittel:{ trials:12, items:30 },
    schwer:{ trials:14, items:48 }
  },
  run: async function(P, ui){
    var results=[];
    for(var i=0;i<P.trials;i++){
      var n=P.items, target=T.rint(0,n-1), rot=T.pick([0,90,180,270]);
      ui.count((i+1)+' / '+P.trials);
      ui.host.innerHTML='<div class="stage search"><div class="searchgrid" id="sg">'+
        Array.apply(null,{length:n}).map(function(_,k){
          var isT=(k===target);
          var ang = isT ? rot : T.pick([0,90,180,270]);
          // Störer: „C“ mit Öffnung nach einer Seite; Ziel: Öffnung nach oben fehlt (geschlossen oben) -> einziges mit Lücke oben? Einfacher: Ziel hat zusätzlichen Punkt.
          return '<button class="sitem'+(isT?' target':'')+'" data-t="'+(isT?1:0)+'" style="transform:rotate('+ang+'deg)">'+
                   '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M19 5 H7 V19 H19" fill="none" stroke="#9aa6c8" stroke-width="3"/>'+
                   (isT?'<circle cx="19" cy="5" r="2.6" fill="#22d3ee"/>':'')+'</svg>'+
                 '</button>';
        }).join('')+'</div><div class="status">Tippe das Kästchen mit dem blauen Punkt an</div></div>';
      var t0=performance.now();
      var ok=await waitTargetTap(ui.host);
      var rt=performance.now()-t0;
      results.push({ i:i+1, items:n, correct:ok, rt:T.round(rt) });
      await ui.flash(ok);
    }
    var rts=results.filter(function(r){return r.correct;}).map(function(r){return r.rt;});
    return { n:results.length, correctCount:results.filter(function(r){return r.correct;}).length,
             accuracy:T.round(results.filter(function(r){return r.correct;}).length/results.length,3),
             avgMs:T.round(T.mean(rts),0), medMs:T.round(T.median(rts),0), trials:results };
  },
  format:function(r){ return [
    {label:'Typische Suchzeit', value:fmtSec(r.medMs)},
    {label:'Treffer', value:fmtPct(r.accuracy)},
    {label:'Suchdurchgänge', value:r.n}
  ]; }
},

/* ---- 12. Konzentration unter Ablenkung ---- */
{
  id:'concentration',
  name:'Konzentration unter Ablenkung',
  short:'Immer wieder erscheint ein Symbol unter vielen anderen – nur ein bestimmtes Ziel antippen, während es ringsum flackert.',
  measures:'Konzentration, wenn drumherum viel los ist.',
  defaultDifficulty:'mittel',
  difficulties:{
    leicht:{ seconds:40, items:12 },
    mittel:{ seconds:45, items:20 },
    schwer:{ seconds:50, items:28 }
  },
  run: async function(P, ui){
    var symbols=['◆','●','▲','★','■','✦','✚','◗'];
    var targetSym='★';
    var hits=0, misses=0, falseAlarms=0, total=0, rts=[];
    ui.host.innerHTML='<div class="stage concentration"><div class="conhead">Tippe jedes <b class="tgt">'+targetSym+'</b> an – ignoriere den Rest. <span id="clock"></span></div><div class="congrid" id="cg"></div></div>';
    var grid=ui.host.querySelector('#cg'), clock=ui.host.querySelector('#clock');
    var endAt=performance.now()+P.seconds*1000, running=true, shownAt=0, curHasTarget=false;
    function render(){
      var hasTarget = Math.random()<0.5;
      curHasTarget=hasTarget; shownAt=performance.now(); total++;
      var n=P.items, tIdx = hasTarget? T.rint(0,n-1) : -1, html='';
      for(var k=0;k<n;k++){
        var sym = (k===tIdx)? targetSym : T.pick(symbols.filter(function(s){return s!==targetSym;}));
        html+='<span class="csym'+(k===tIdx?' ct':'')+'" data-t="'+(k===tIdx?1:0)+'" style="opacity:'+(0.55+Math.random()*0.45).toFixed(2)+'">'+sym+'</span>';
      }
      grid.innerHTML=html;
    }
    function tick(){
      if(!running) return;
      var left=Math.max(0,Math.round((endAt-performance.now())/1000));
      clock.textContent='⏱ '+left+'s';
      if(performance.now()>=endAt){ running=false; cleanup(); resolveDone(); return; }
      requestAnimationFrame(tick);
    }
    var resolveDone;
    var done=new Promise(function(res){ resolveDone=res; });
    function onClick(e){
      var s=e.target.closest('.csym'); if(!s) return;
      if(s.dataset.t==='1'){ hits++; rts.push(performance.now()-shownAt); }
      else { falseAlarms++; }
      render();
    }
    // automatischer Wechsel, falls Ziel verpasst
    var swap=setInterval(function(){ if(!running) return; if(curHasTarget) misses++; render(); }, 1400);
    grid.addEventListener('click', onClick);
    function cleanup(){ clearInterval(swap); grid.removeEventListener('click', onClick); }
    render(); tick();
    await done;
    return { hits:hits, misses:misses, falseAlarms:falseAlarms, rounds:total, medMs:T.round(T.median(rts),0) };
  },
  format:function(r){ return [
    {label:'Richtig getroffen', value:(r.hits||0)},
    {label:'Übersehen', value:(r.misses||0)},
    {label:'Daneben getippt', value:(r.falseAlarms||0)},
    {label:'Typische Reaktionszeit', value:fmtSec(r.medMs)}
  ]; }
}

];

/* ---- Pool als Map für schnellen Zugriff ---- */
var TEST_BY_ID = {};
TEST_POOL.forEach(function(t){ TEST_BY_ID[t.id]=t; });

/* Standard-Konfiguration (falls Dashboard noch nichts gesetzt hat):
   die ursprünglichen fünf Tests, mittlere Schwierigkeit */
var DEFAULT_CONFIG = {
  tests:[
    {id:'rotation3d', difficulty:'mittel'},
    {id:'gapfit',     difficulty:'mittel'},
    {id:'corsi',      difficulty:'mittel'},
    {id:'timeprod',   difficulty:'mittel'},
    {id:'control_math', difficulty:'mittel'}
  ]
};

/* =====================================================================
   Hilfs-Routinen, die DOM/ui brauchen (nur in der App aktiv genutzt)
   ===================================================================== */
function collectTaps(host, need){
  return new Promise(function(resolve){
    var resp=[]; var grid=host.querySelector('.corsiboard') || host;
    var blocks=host.querySelectorAll('.cblk');
    blocks.forEach(function(b){
      b.disabled=false;
      b.onclick=function(){
        var k=Number(b.dataset.k); resp.push(k);
        b.classList.add('tap'); setTimeout(function(){ b.classList.remove('tap'); },160);
        if(resp.length>=need){ blocks.forEach(function(x){ x.disabled=true; x.onclick=null; }); setTimeout(function(){ resolve(resp); },220); }
      };
    });
  });
}
function waitTargetTap(host){
  return new Promise(function(resolve){
    var items=host.querySelectorAll('.sitem');
    items.forEach(function(it){
      it.onclick=function(){
        var ok=it.dataset.t==='1';
        items.forEach(function(x){ x.onclick=null; });
        resolve(ok);
      };
    });
  });
}
function produceInterval(ui, targetSec){
  return new Promise(function(resolve){
    ui.host.innerHTML='<div class="stage time">'+
      '<p class="lead center">Drücke <b>Start</b> und dann <b>Stopp</b>, wenn du glaubst, dass <b>'+targetSec+' Sekunden</b> vergangen sind.<br>'+
      '<span class="muted">Bitte nicht mitzählen und nicht auf eine Uhr schauen.</span></p>'+
      '<div class="timebox"><button class="btn primary big" id="tstart">Start</button></div></div>';
    ui.host.querySelector('#tstart').onclick=function(){
      var t0=performance.now();
      // bewusst KEIN blinkender Punkt / keine Anzeige -> erschwert das Zählen nicht künstlich
      ui.host.querySelector('.timebox').innerHTML='<div class="timewait">Konzentrier dich… und drücke Stopp, wenn es so weit ist.</div><button class="btn primary big" id="tstop">Stopp</button>';
      ui.host.querySelector('#tstop').onclick=function(){ resolve(performance.now()-t0); };
    };
  });
}

/* ----- Papier falten: Aufgabe erzeugen ----- */
function makeFoldTrial(nFolds, nHoles){
  // Echtes Faltmodell auf 4x4-Raster. Jeder Falz halbiert das aktuelle Papier
  // entlang einer zufälligen Achse UND Richtung. Löcher liegen irgendwo im
  // gefalteten Bereich; beim Aufklappen werden sie über die echten Falzlinien gespiegelt.
  var N=4;
  var region={x0:0,x1:N-1,y0:0,y1:N-1};
  var folds=[], regionsSeq=[];
  for(var f=0; f<nFolds; f++){
    regionsSeq.push({x0:region.x0,x1:region.x1,y0:region.y0,y1:region.y1});
    var canV=(region.x1-region.x0+1)>=2, canH=(region.y1-region.y0+1)>=2;
    var axis = (canV&&canH) ? T.pick(['v','h']) : (canV?'v':'h');
    if(axis==='v'){
      var mid=(region.x0+region.x1)/2, rl=Math.random()<0.5;
      folds.push({axis:'v', crease:mid, dir: rl?'RL':'LR'});
      if(rl) region.x1=Math.floor(mid); else region.x0=Math.ceil(mid);
    }else{
      var midy=(region.y0+region.y1)/2, bt=Math.random()<0.5;
      folds.push({axis:'h', crease:midy, dir: bt?'BT':'TB'});
      if(bt) region.y1=Math.floor(midy); else region.y0=Math.ceil(midy);
    }
  }
  regionsSeq.push({x0:region.x0,x1:region.x1,y0:region.y0,y1:region.y1}); // gefalteter Endzustand
  var fin=region;
  function randHole(){ return [T.rint(fin.x0,fin.x1), T.rint(fin.y0,fin.y1)]; }
  var holes=[randHole()];
  var cap=(fin.x1-fin.x0+1)*(fin.y1-fin.y0+1); nHoles=Math.min(nHoles||1, cap);
  var g=0; while(holes.length<nHoles && g++<30){ var h=randHole(); if(!holes.some(function(c){return c[0]===h[0]&&c[1]===h[1];})) holes.push(h); }

  function reflect(set, fd){ return set.map(function(c){ return fd.axis==='v' ? [2*fd.crease-c[0], c[1]] : [c[0], 2*fd.crease-c[1]]; }); }
  function dedupe(set){ var s={},o=[]; set.forEach(function(c){var k=c[0]+','+c[1]; if(!s[k]){s[k]=1;o.push(c);}}); return o; }
  function unfold(set, skipIdx){
    var cur=set.map(function(c){return c.slice();});
    for(var i=folds.length-1;i>=0;i--){ if(i===skipIdx) continue; cur=dedupe(cur.concat(reflect(cur,folds[i]))); }
    return cur;
  }
  function keyOf(set){ return set.map(function(c){return c[0]+','+c[1];}).sort().join(';'); }

  var correct=unfold(holes,-1), ckey=keyOf(correct);
  // plausible Distraktoren
  var cands=[];
  if(folds.length>1) cands.push(unfold(holes, T.rint(0,folds.length-1)));        // einen Falz "vergessen"
  cands.push(dedupe(correct.map(function(c){return [N-1-c[0],c[1]];})));          // ganz waagerecht gespiegelt
  cands.push(dedupe(correct.map(function(c){return [c[0],N-1-c[1]];})));          // ganz senkrecht gespiegelt
  cands.push(holes.map(function(c){return c.slice();}));                          // nur die gestanzten Punkte
  var opts=[correct], oset={}; oset[ckey]=1;
  for(var ci=0; ci<cands.length && opts.length<4; ci++){ var k=keyOf(cands[ci]); if(cands[ci].length && !oset[k]){ oset[k]=1; opts.push(cands[ci]); } }
  var guard=0; while(opts.length<4 && guard++<60){ var rnd=unfold([randHole()],-1); var k2=keyOf(rnd); if(!oset[k2]){ oset[k2]=1; opts.push(rnd); } }
  opts=T.shuffle(opts.slice(0,4));

  // Visualisierung: pro Falz ein Bild (Papier wird sichtbar kleiner), zum Schluss gefaltet + gelocht
  var stepSVGs=[];
  for(var s=0;s<folds.length;s++) stepSVGs.push(paperFrameSVG(regionsSeq[s], folds[s], null, 90));
  stepSVGs.push(paperFrameSVG(regionsSeq[folds.length], null, holes, 90));
  return { folds:folds, holes:holes, options:opts, correctIndex:opts.findIndex(function(o){return keyOf(o)===ckey;}), stepSVGs:stepSVGs };
}
function _arrow(x0,y0,x1,y1,col){
  var ang=Math.atan2(y1-y0,x1-x0), ah=6;
  var hx1=x1-ah*Math.cos(ang-0.5), hy1=y1-ah*Math.sin(ang-0.5);
  var hx2=x1-ah*Math.cos(ang+0.5), hy2=y1-ah*Math.sin(ang+0.5);
  return '<line x1="'+x0.toFixed(1)+'" y1="'+y0.toFixed(1)+'" x2="'+x1.toFixed(1)+'" y2="'+y1.toFixed(1)+'" stroke="'+col+'" stroke-width="2"/>'+
         '<path d="M'+x1.toFixed(1)+' '+y1.toFixed(1)+' L'+hx1.toFixed(1)+' '+hy1.toFixed(1)+' L'+hx2.toFixed(1)+' '+hy2.toFixed(1)+' Z" fill="'+col+'"/>';
}
// Ein Falt-Schritt: zeigt das AKTUELLE Papier (echte Größe/Position) + Flap, Falzlinie, Pfeil
function paperFrameSVG(region, fold, holes, size){
  size=size||90; var N=4, pad=9, cell=(size-2*pad)/N, r='';
  var paper='#e4eaf7', edge='#8d97bd', cc='#22d3ee', holeFill='#0c1226';
  function px(g){ return pad+g*cell; }
  var rx=px(region.x0), ry=px(region.y0), rw=(region.x1-region.x0+1)*cell, rh=(region.y1-region.y0+1)*cell;
  // ganz schwacher Umriss des Originalblatts (Orientierung, wie groß es mal war)
  r+='<rect x="'+pad+'" y="'+pad+'" width="'+(N*cell)+'" height="'+(N*cell)+'" rx="4" fill="none" stroke="rgba(255,255,255,.10)" stroke-dasharray="2 3"/>';
  // aktuelles Papier
  r+='<rect x="'+rx.toFixed(1)+'" y="'+ry.toFixed(1)+'" width="'+rw.toFixed(1)+'" height="'+rh.toFixed(1)+'" rx="4" fill="'+paper+'" stroke="'+edge+'"/>';
  if(fold){
    if(fold.axis==='v'){
      var cx=px(fold.crease+0.5);
      var flapX=(fold.dir==='RL')?cx:rx, flapW=(fold.dir==='RL')?(rx+rw-cx):(cx-rx);
      r+='<rect x="'+flapX.toFixed(1)+'" y="'+ry.toFixed(1)+'" width="'+flapW.toFixed(1)+'" height="'+rh.toFixed(1)+'" fill="rgba(34,211,238,.18)" stroke="'+cc+'" stroke-dasharray="3 2"/>';
      r+='<line x1="'+cx.toFixed(1)+'" y1="'+ry.toFixed(1)+'" x2="'+cx.toFixed(1)+'" y2="'+(ry+rh).toFixed(1)+'" stroke="'+cc+'" stroke-dasharray="4 3" stroke-width="2"/>';
      var fcx=flapX+flapW/2, tcx=(fold.dir==='RL')?(cx-rw*0.12):(cx+rw*0.12);
      r+=_arrow(fcx, ry+rh/2, tcx, ry+rh/2, cc);
    }else{
      var cy=px(fold.crease+0.5);
      var flapY=(fold.dir==='BT')?cy:ry, flapH=(fold.dir==='BT')?(ry+rh-cy):(cy-ry);
      r+='<rect x="'+rx.toFixed(1)+'" y="'+flapY.toFixed(1)+'" width="'+rw.toFixed(1)+'" height="'+flapH.toFixed(1)+'" fill="rgba(34,211,238,.18)" stroke="'+cc+'" stroke-dasharray="3 2"/>';
      r+='<line x1="'+rx.toFixed(1)+'" y1="'+cy.toFixed(1)+'" x2="'+(rx+rw).toFixed(1)+'" y2="'+cy.toFixed(1)+'" stroke="'+cc+'" stroke-dasharray="4 3" stroke-width="2"/>';
      var fcy=flapY+flapH/2, tcy=(fold.dir==='BT')?(cy-rh*0.12):(cy+rh*0.12);
      r+=_arrow(rx+rw/2, fcy, rx+rw/2, tcy, cc);
    }
  }
  if(holes){ holes.forEach(function(c){ var hx=px(c[0]+0.5), hy=px(c[1]+0.5); r+='<circle cx="'+hx.toFixed(1)+'" cy="'+hy.toFixed(1)+'" r="'+(cell*0.2).toFixed(1)+'" fill="'+holeFill+'" stroke="'+edge+'" stroke-width="1"/>'; }); }
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'">'+r+'</svg>';
}
// Antwortoption: aufgeklapptes Blatt (4x4) mit gestanzten Löchern
function foldGridSVG(holes, size){
  size=size||76; var N=4, pad=6, cell=(size-2*pad)/N, r='';
  r+='<rect x="'+pad+'" y="'+pad+'" width="'+(N*cell)+'" height="'+(N*cell)+'" rx="4" fill="#e4eaf7" stroke="#8d97bd"/>';
  for(var i=1;i<N;i++){ var p=pad+i*cell;
    r+='<line x1="'+p+'" y1="'+pad+'" x2="'+p+'" y2="'+(pad+N*cell)+'" stroke="rgba(20,29,58,.10)"/>'+
       '<line x1="'+pad+'" y1="'+p+'" x2="'+(pad+N*cell)+'" y2="'+p+'" stroke="rgba(20,29,58,.10)"/>'; }
  var set={}; holes.forEach(function(c){ set[c[0]+','+c[1]]=1; });
  for(var y=0;y<N;y++) for(var x=0;x<N;x++){ if(set[x+','+y]){ var cx=pad+(x+0.5)*cell, cy=pad+(y+0.5)*cell; r+='<circle cx="'+cx+'" cy="'+cy+'" r="'+(cell*0.22)+'" fill="#0c1226" stroke="#8d97bd"/>'; } }
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'">'+r+'</svg>';
}

/* ----- Muster vervollständigen: Aufgabe erzeugen ----- */
function makePatternTrial(g){
  // Regelmäßiges Muster: Schachbrett ODER Streifen; ein Feld fehlt -> richtige Füllung wählen.
  var type=T.pick(['checker','rows','cols','diag']);
  function filled(x,y){
    if(type==='checker') return (x+y)%2===0;
    if(type==='rows') return y%2===0;
    if(type==='cols') return x%2===0;
    return (x+y)%3===0; // diag-ish
  }
  var mx=T.rint(0,g-1), my=T.rint(0,g-1); // fehlendes Feld
  var correctFilled=filled(mx,my);
  var cell=Math.min(26, Math.floor(150/g)), pad=4, size=g*cell+pad*2, r='';
  r+='<rect x="1" y="1" width="'+(size-2)+'" height="'+(size-2)+'" rx="6" fill="#1b2440" stroke="#3a4263"/>';
  for(var y=0;y<g;y++) for(var x=0;x<g;x++){
    var px=pad+x*cell+2, py=pad+y*cell+2, s=cell-4;
    if(x===mx && y===my){ r+='<rect x="'+px+'" y="'+py+'" width="'+s+'" height="'+s+'" rx="3" fill="none" stroke="#22d3ee" stroke-dasharray="3 2"/>'; }
    else if(filled(x,y)){ r+='<rect x="'+px+'" y="'+py+'" width="'+s+'" height="'+s+'" rx="3" fill="#8d97bd"/>'; }
  }
  var gridSVG='<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'">'+r+'</svg>';
  function tile(isFilled){ var s=44, p=6; var rr='<rect x="1" y="1" width="'+(s-2)+'" height="'+(s-2)+'" rx="6" fill="#1b2440" stroke="#3a4263"/>'; if(isFilled) rr+='<rect x="'+p+'" y="'+p+'" width="'+(s-p*2)+'" height="'+(s-p*2)+'" rx="3" fill="#8d97bd"/>'; return '<svg viewBox="0 0 '+s+' '+s+'" width="'+s+'" height="'+s+'">'+rr+'</svg>'; }
  // Optionen: gefüllt / leer / halb / falsch-platziert. Genau eine korrekt.
  var optsSpec=T.shuffle([ {filled:correctFilled, correct:true}, {filled:!correctFilled, correct:false},
                           {half:true, correct:false}, {dot:true, correct:false} ]);
  var options=optsSpec.map(function(o){
    if(o.half){ var s=44; return '<svg viewBox="0 0 '+s+' '+s+'" width="'+s+'" height="'+s+'"><rect x="1" y="1" width="'+(s-2)+'" height="'+(s-2)+'" rx="6" fill="#1b2440" stroke="#3a4263"/><rect x="6" y="6" width="'+((s-12)/2)+'" height="'+(s-12)+'" rx="2" fill="#8d97bd"/></svg>'; }
    if(o.dot){ var s2=44; return '<svg viewBox="0 0 '+s2+' '+s2+'" width="'+s2+'" height="'+s2+'"><rect x="1" y="1" width="'+(s2-2)+'" height="'+(s2-2)+'" rx="6" fill="#1b2440" stroke="#3a4263"/><circle cx="'+(s2/2)+'" cy="'+(s2/2)+'" r="8" fill="#8d97bd"/></svg>'; }
    return tile(o.filled);
  });
  return { gridSVG:gridSVG, options:options, correctIndex:optsSpec.findIndex(function(o){return o.correct;}) };
}

/* ----- Kofferraum packen: Aufgabe erzeugen ----- */
function makePackTrial(g){
  // Kiste g x g, teils gefüllt; ein Rechteck-Teil; passt es (auch gedreht) in eine freie Lücke?
  var box=[]; for(var y=0;y<g;y++){ var row=[]; for(var x=0;x<g;x++) row.push(0); box.push(row); }
  // ein paar Blöcke zufällig belegen (zusammenhängende Rechtecke)
  var fillCount=T.rint(1,2);
  for(var f=0; f<fillCount; f++){
    var bw=T.rint(1,g-1), bh=T.rint(1,g-1), bx=T.rint(0,g-bw), by=T.rint(0,g-bh);
    for(var yy=by; yy<by+bh; yy++) for(var xx=bx; xx<bx+bw; xx++) box[yy][xx]=1;
  }
  // Teil-Größe
  var pw=T.rint(1,Math.max(1,g-1)), ph=T.rint(1,Math.max(1,g-1));
  function fitsAt(w,h){
    for(var oy=0; oy<=g-h; oy++) for(var ox=0; ox<=g-w; ox++){
      var clear=true;
      for(var yy=oy; yy<oy+h && clear; yy++) for(var xx=ox; xx<ox+w; xx++){ if(box[yy][xx]){ clear=false; break; } }
      if(clear) return true;
    }
    return false;
  }
  var fits = fitsAt(pw,ph) || fitsAt(ph,pw);
  return { fits:fits, boxSVG:packBoxSVG(box,g), pieceSVG:packPieceSVG(pw,ph) };
}
function packBoxSVG(box,g){
  var cell=Math.min(26, Math.floor(150/g)), pad=4, size=g*cell+pad*2, r='';
  r+='<rect x="1" y="1" width="'+(size-2)+'" height="'+(size-2)+'" rx="6" fill="#1b2440" stroke="#3a4263" stroke-width="2"/>';
  for(var y=0;y<g;y++) for(var x=0;x<g;x++){ var px=pad+x*cell+1.5, py=pad+y*cell+1.5, s=cell-3;
    r+='<rect x="'+px+'" y="'+py+'" width="'+s+'" height="'+s+'" rx="2" fill="'+(box[y][x]?'#6b7499':'rgba(255,255,255,.04)')+'" stroke="rgba(255,255,255,.07)"/>'; }
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'">'+r+'</svg>';
}
function packPieceSVG(w,h){
  var cell=22, pad=4, W=w*cell+pad*2, H=h*cell+pad*2, r='';
  for(var y=0;y<h;y++) for(var x=0;x<w;x++){ var px=pad+x*cell+1.5, py=pad+y*cell+1.5, s=cell-3;
    r+='<rect x="'+px+'" y="'+py+'" width="'+s+'" height="'+s+'" rx="2" fill="#e0a23c"/>'; }
  return '<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">'+r+'</svg>';
}

/* Export für Node-Tests (ignoriert im Browser) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { T, TEST_POOL, TEST_BY_ID, DEFAULT_CONFIG,
    makePolycube, applyRots, mirrorCells, normKey, allRotKeys, randomRotSeq, cubesSVG, intersects,
    PIECES, protN, pkey, pdistinctRots, placeGap, preflect, pIsChiral, makeFoldTrial, makePatternTrial, makePackTrial };
}
