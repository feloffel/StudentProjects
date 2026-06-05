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
// Dezimaltrennzeichen je nach Sprache (DE: Komma, EN: Punkt)
function _dec(str){ return (typeof I18N!=='undefined' && I18N.lang==='en') ? str : str.replace('.',','); }
function fmtSec(ms){ if(ms==null) return "–"; return _dec((ms/1000).toFixed(2)) + tr(" Sek"," s"); }
function fmtPct(x){ if(x==null) return "–"; return Math.round(x*100) + " %"; }
function fmtPlus(ms){ if(ms==null) return "–"; var s=(ms/1000); return (s>=0?"+":"") + _dec(s.toFixed(1)) + tr(" Sek"," s"); }

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
          '<button class="btn ans" data-a="same"><kbd>F</kbd> '+tr('Dieselbe Figur','Same shape')+'</button>'+
          '<button class="btn ans" data-a="mir"><kbd>J</kbd> '+tr('Spiegelbild','Mirror image')+'</button>'+
        '</div></div>';
    var t0=performance.now();
    var ans=await ui.choice([['same','f'],['mir','j']], P.tl||0);
    var rt=performance.now()-t0;
    var timedOut=(ans===ui.TIMEOUT);
    var correct=!timedOut && ((ans==='mir')===isMirror);
    results.push({ i:i+1, mirror:isMirror, answer:(timedOut?'timeout':ans), correct:correct, rt:T.round(rt) });
    await ui.flash(correct);
  }
  var rts=results.filter(function(r){return r.correct;}).map(function(r){return r.rt;});
  return { n:results.length, source:'generiert', correctCount:results.filter(function(r){return r.correct;}).length,
           accuracy:T.round(results.filter(function(r){return r.correct;}).length/results.length,3),
           avgMs:T.round(T.mean(rts),0), medMs:T.round(T.median(rts),0), trials:results };
}

// Erzeugt n GARANTIERT unterschiedliche Wartezeiten (ms), gut gestreut über [lo,hi]
// und gemischt -> kein vorhersehbarer Rhythmus, keine Wiederholung.
function distinctIntervals(n, lo, hi){
  var step=(hi-lo)/n, arr=[];
  for(var i=0;i<n;i++){ arr.push(Math.round(lo + i*step + Math.random()*step*0.96)); }
  // jeder Wert liegt in einem eigenen, nicht überlappenden Zeitfenster -> alle verschieden
  return T.shuffle(arr);
}

/* =====================================================================
   DER TEST-POOL
   ===================================================================== */
var TEST_POOL = [

/* ---- 1. 3D-Figuren drehen (Mentale Rotation, Würfelfiguren) ---- */
{
  id:'rotation3d',
  name:{de:'Figuren im Kopf drehen', en:'Rotating shapes in your head'},
  short:{de:'Ein Bild mit zwei Figuren: ist die zweite dieselbe (nur gedreht) oder das Spiegelbild?', en:'An image with two shapes: is the second the same (just rotated) or the mirror image?'},
  measures:{de:'Wie schnell und sicher räumlich gedreht wird.', en:'How quickly and reliably you mentally rotate in space.'},
  defaultDifficulty:'mittel',
  difficulties:{
    leicht:{ trials:12, angles:[0,50],     cubes:9,  tl:12000 },
    mittel:{ trials:18, angles:[50,100],   cubes:11, tl:10000 },
    schwer:{ trials:30, angles:[100,150],  cubes:14, tl:8000  }
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
              '<div class="shp3d single"><img class="rotimg" src="'+t.img+'" alt="'+tr('Aufgabenbild','Task image')+'"></div>'+
              '<div class="answers two">'+
                '<button class="btn ans" data-a="same"><kbd>F</kbd> '+tr('Dieselbe Figur','Same shape')+'</button>'+
                '<button class="btn ans" data-a="mir"><kbd>J</kbd> '+tr('Spiegelbild','Mirror image')+'</button>'+
              '</div></div>';
          var t0=performance.now();
          var ans=await ui.choice([['same','f'],['mir','j']], P.tl||0);
          var rt=performance.now()-t0;
          var timedOut=(ans===ui.TIMEOUT);
          var correct=!timedOut && (ans===t.correct);
          results.push({ i:used+1, figure:t.figure, angle:t.angle, mirror:t.mirror, answer:(timedOut?'timeout':ans), correct:correct, rt:T.round(rt) });
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
    {label:tr('Richtig erkannt','Correctly identified'), value:fmtPct(r.accuracy)},
    {label:tr('Typische Antwortzeit','Typical response time'), value:fmtSec(r.medMs)},
    {label:tr('Aufgaben gesamt','Total tasks'), value:r.n}
  ]; }
},

/* ---- 2. Teile einpassen (neutrale Optik) ---- */
{
  id:'gapfit',
  name:{de:'Teile einpassen', en:'Fitting pieces'},
  short:{de:'Oben ist ein Feld mit einer Lücke. Welches der vier Teile füllt sie genau?', en:'At the top is a grid with a gap. Which of the four pieces fills it exactly?'},
  measures:{de:'Wie schnell man erkennt, welche Form in eine Lücke passt.', en:'How quickly you recognise which shape fits a gap.'},
  defaultDifficulty:'mittel',
  difficulties:{
    leicht:{ trials:10, mirrorFrom:99, tl:10000 },
    mittel:{ trials:15, mirrorFrom:8,  tl:8000  },
    schwer:{ trials:20, mirrorFrom:1,  tl:6000  }
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
          '<div class="well">'+gridGapSVG(gapCells)+'<div class="welllbl">'+tr('Welches Teil füllt die Lücke?','Which piece fills the gap?')+'</div></div>'+
          '<div class="answers four">'+
            options.map(function(op,k){ return '<button class="btn ans opt" data-a="'+k+'"><kbd>'+(k+1)+'</kbd>'+pieceSVG(op.cells,{size:88,cell:18})+'</button>'; }).join('')+
          '</div>'+
        '</div>';
      var t0=performance.now();
      var ans=await ui.choice(options.map(function(_,k){ return [String(k), String(k+1)]; }), P.tl||0);
      var rt=performance.now()-t0;
      var timedOut=(ans===ui.TIMEOUT);
      var ok=!timedOut && (Number(ans)===correctIndex);
      results.push({ i:i+1, correct:ok, rt:T.round(rt), timedOut:timedOut });
      await ui.flash(ok);
    }
    var rts=results.filter(function(r){return r.correct;}).map(function(r){return r.rt;});
    return { n:results.length, correctCount:results.filter(function(r){return r.correct;}).length,
             accuracy:T.round(results.filter(function(r){return r.correct;}).length/results.length,3),
             avgMs:T.round(T.mean(rts),0), medMs:T.round(T.median(rts),0), trials:results };
  },
  format:function(r){ return [
    {label:tr('Richtig eingepasst','Correctly fitted'), value:fmtPct(r.accuracy)},
    {label:tr('Typische Antwortzeit','Typical response time'), value:fmtSec(r.medMs)},
    {label:tr('Aufgaben gesamt','Total tasks'), value:r.n}
  ]; }
},

/* ---- 3. Corsi Block-Tapping (1:1) ---- */
{
  id:'corsi',
  name:{de:'Felder-Folge merken (Corsi)', en:'Remember the sequence (Corsi)'},
  short:{de:'Unregelmäßig verteilte Felder leuchten nacheinander auf; danach in gleicher Reihenfolge antippen.', en:'Irregularly placed squares light up one after another; then tap them in the same order.'},
  measures:{de:'Wie viele Positionen man sich in der richtigen Reihenfolge merken kann.', en:'How many positions you can remember in the correct order.'},
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
        ui.count(tr('Länge ','Length ')+len);
        ui.host.innerHTML='<div class="stage corsi"><div class="corsiboard" id="cb">'+
          board.map(function(b,k){ return '<button class="cblk" data-k="'+k+'" disabled style="left:'+b[0]+'px;top:'+b[1]+'px"></button>'; }).join('')+
          '</div><div class="status" id="st">'+tr('Merke dir die Reihenfolge…','Memorise the order…')+'</div></div>';
        await ui.sleep(700);
        for(var s=0;s<seq.length;s++){
          var b=ui.host.querySelector('.cblk[data-k="'+seq[s]+'"]');
          b.classList.add('lit'); await ui.sleep(650); b.classList.remove('lit'); await ui.sleep(250);
        }
        ui.host.querySelector('#st').textContent=tr('Jetzt antippen','Now tap');
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
    {label:tr('Längste gemerkte Folge','Longest sequence remembered'), value:(r.bestLength||0)+tr(' Felder',' squares')},
    {label:tr('Richtige Durchgänge','Correct rounds'), value:(r.correctCount||0)+tr(' von ',' of ')+(r.totalTrials||0)}
  ]; }
},

/* ---- 4. Zeitgefühl (Zeitproduktion, OHNE blinkenden Punkt) ---- */
{
  id:'timeprod',
  name:{de:'Zeitgefühl', en:'Sense of time'},
  short:{de:'Ohne Zählen anzeigen, wann eine bestimmte Zeitspanne vorbei ist (Start, dann Stopp).', en:'Without counting, signal when a given interval has passed (start, then stop).'},
  measures:{de:'Wie genau das Zeitgefühl ist.', en:'How accurate your sense of time is.'},
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
    if(!r.targets) return [{label:tr('Ergebnis','Result'), value:'–'}];
    return r.targets.map(function(t){ return { label:t.target+tr(' Sekunden geschätzt',' seconds estimated'), value:tr('Abweichung ','Deviation ')+fmtPlus(t.devMs) }; });
  }
},

/* ---- 5. Kopfrechnen (Kontrolle, ohne Raumbezug) ---- */
{
  id:'control_math',
  name:{de:'Kopfrechnen (Kontrolle)', en:'Mental arithmetic (control)'},
  short:{de:'Einfache Plus- und Minus-Aufgaben lösen. Hat absichtlich nichts mit Raum zu tun.', en:'Solve simple addition and subtraction. Deliberately has nothing to do with space.'},
  measures:{de:'Allgemeines Tempo & Konzentration – als Vergleichswert.', en:'General speed & concentration – as a baseline for comparison.'},
  defaultDifficulty:'mittel',
  difficulties:{
    leicht:{ trials:15, max:50,  tl:9000 },
    mittel:{ trials:20, max:90,  tl:7000 },
    schwer:{ trials:30, max:140, tl:6000 }
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
      var ans=await ui.choice(options.map(function(_,k){ return [String(k),String(k+1)]; }), P.tl||0);
      var rt=performance.now()-t0; var timedOut=(ans===ui.TIMEOUT); var ok=!timedOut && (Number(ans)===ci);
      results.push({ i:i+1, correct:ok, rt:T.round(rt), timedOut:timedOut });
      await ui.flash(ok);
    }
    var rts=results.filter(function(r){return r.correct;}).map(function(r){return r.rt;});
    return { n:results.length, correctCount:results.filter(function(r){return r.correct;}).length,
             accuracy:T.round(results.filter(function(r){return r.correct;}).length/results.length,3),
             avgMs:T.round(T.mean(rts),0), medMs:T.round(T.median(rts),0), trials:results };
  },
  format:function(r){ return [
    {label:tr('Richtig gerechnet','Calculated correctly'), value:fmtPct(r.accuracy)},
    {label:tr('Typische Antwortzeit','Typical response time'), value:fmtSec(r.medMs)},
    {label:tr('Aufgaben gesamt','Total tasks'), value:r.n}
  ]; }
},

/* ---- 6. Papier falten (Paper Folding VZ-2-Stil) ---- */
{
  id:'paperfold',
  name:{de:'Papier im Kopf falten', en:'Folding paper in your head'},
  short:{de:'Ein Blatt wird gefaltet und gelocht. Wo sind die Löcher, wenn man es wieder aufklappt?', en:'A sheet is folded and punched. Where are the holes once it is unfolded again?'},
  measures:{de:'Räumliches Vorstellungsvermögen (mehrschrittiges Denken).', en:'Spatial visualisation (multi-step reasoning).'},
  defaultDifficulty:'mittel',
  // Pro Durchgang werden "trials" Aufgaben FRISCH aus dem Generator gezogen
  // (zufällige Faltungen + zufällig gestanztes Loch). Standard = 10 Aufgaben.
  // Jede Aufgabe hat 5 Antwortmöglichkeiten A–E wie im VZ-2; die richtige
  // Lösung wird geometrisch berechnet (kein fester Antwortschlüssel nötig).
  // sim = Ähnlichkeit der falschen Optionen zur richtigen
  //   0 = leicht (deutlich verschieden), 1 = mittel (gleiche Lochzahl, ein Loch erkennbar daneben),
  //   2 = schwer (gleiche Lochzahl, nur ein Loch leicht verschoben -> man muss genau prüfen)
  difficulties:{
    leicht:{ trials:10, folds:1, holes:1, tl:18000, sim:0 },
    mittel:{ trials:20, folds:2, holes:1, tl:20000, sim:1 },
    schwer:{ trials:20, folds:3, holes:2, tl:25000, sim:2 }
  },
  run: async function(P, ui) {
    var totalTrials = P.trials || 10;
    var results = [];
    var timeUp = false;
    var TOTAL_MS = 2 * 60 * 1000; // 2 Minuten für alle Aufgaben zusammen

    var startTime = performance.now();

    // Globaler Timer startet jetzt und bleibt für alle Aufgaben sichtbar.
    // Er läuft in #timerbar (per ui.countdownStart, wie bei anderen Tests).
    var resolveCurrentChoice = null;  // Zeiger auf die aktive choice-Auflösung

    var cancelTimer = ui.countdownStart(TOTAL_MS, function() {
      timeUp = true;
      if (resolveCurrentChoice) resolveCurrentChoice(ui.TIMEOUT);
    });

    for (var i = 0; i < totalTrials; i++) {
      if (timeUp) break;

      var elapsed = performance.now() - startTime;
      var remaining = Math.max(0, TOTAL_MS - elapsed);
      if (remaining <= 0) break;

      // Aufgabe generieren mit makeFoldTrial() – der echte Generator in tests.js
      var tr = makeFoldTrial(P.folds || 2, P.holes || 1, P.sim || 0);
      // tr.stepSVGs  = Schritt-Bilder (Faltungen + gestanztes Loch)
      // tr.optionSVGs = die 5 Antwort-SVGs
      // tr.correctIndex = Index der richtigen Antwort (0–4)

      ui.count((i + 1) + ' / ' + totalTrials);
      await ui.fixation();

      ui.host.innerHTML =
        '<div class="stage paperfold" style="flex-direction:column;gap:14px;padding:12px 0">' +
          '<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:center">' +
            tr.stepSVGs.map(function(svg, si) {
              return '<div style="text-align:center">' +
                '<div style="font-size:.72rem;color:var(--muted);margin-bottom:3px">' +
                  (si < tr.stepSVGs.length - 1 ? I18N.t('Schritt ','Step ') + (si + 1) : '📍 ' + I18N.t('Loch','Hole')) +
                '</div>' + svg + '</div>';
            }).join('<div style="color:var(--muted);align-self:center">→</div>') +
          '</div>' +
          '<div class="conhead" style="font-size:.9rem">' + I18N.t('Wie sieht das aufgeklappte Blatt aus?','What does the unfolded sheet look like?') + '</div>' +
          '<div class="answers five">' +
            tr.optionSVGs.map(function(svg, idx) {
              return '<button class="btn ans opt" data-a="' + idx + '">' +
                svg +
                '<span style="font-size:.78rem;color:var(--accent2)">' + String.fromCharCode(65 + idx) + '</span>' +
                '</button>';
            }).join('') +
          '</div>' +
        '</div>';

      // Tastenbelegung: 1–5 für A–E (wie in keyHint definiert)
      var keyMap = tr.optionSVGs.map(function(_, idx) {
        return [String(idx), String(idx + 1)];
      });

      var t0 = performance.now();
      var ans = await new Promise(function(resolve) {
        resolveCurrentChoice = resolve;
        ui.choice(keyMap, 0).then(resolve);
      });
      resolveCurrentChoice = null;
      var rt = performance.now() - t0;

      var timedOut = (ans === ui.TIMEOUT);
      if (timedOut) {
        // Zeit lief ab, während diese Aufgabe noch offen war -> als "unbeantwortet" protokollieren.
        results.push({
          i: i + 1,
          given: '—',                                       // keine Antwort gegeben
          sol:   String.fromCharCode(65 + tr.correctIndex),  // richtige Antwort A–E
          correct: null,                                     // weder richtig noch falsch -> "–"
          status: 'unbeantwortet',                           // <- Zeit abgelaufen, Aufgabe gezeigt
          rt: null,
          folds: tr.nFolds
        });
        timeUp = true;
        break;
      }

      var chosenIdx = Number(ans);
      var ok = (chosenIdx === tr.correctIndex);
      results.push({
        i: i + 1,
        given: String.fromCharCode(65 + chosenIdx),       // gewählte Antwort A–E
        sol:   String.fromCharCode(65 + tr.correctIndex),  // richtige Antwort A–E
        correct: ok,
        status: 'beantwortet',
        rt: T.round(rt),
        folds: tr.nFolds                                   // Anzahl Faltungen in dieser Aufgabe
      });
      await ui.flash(ok);
    }

    // Timer stoppen und aus #timerbar entfernen
    cancelTimer();

    // Alle restlichen, gar nicht mehr gezeigten Aufgaben als "nicht erreicht" auffüllen.
    // (generisch: füllt von der nächsten Nummer bis "total" auf – nutzbar für jeden Test mit Gesamt-Timer)
    var nextNum = (results.length ? results[results.length - 1].i : 0) + 1;
    for (var num = nextNum; num <= totalTrials; num++) {
      results.push({ i: num, given: '—', sol: '—', correct: null, status: 'nicht_erreicht', rt: null, folds: null });
    }

    // Kennzahlen NUR aus beantworteten Aufgaben (un-/nicht-beantwortete verfälschen die Quote nicht)
    var answeredList   = results.filter(function(r){ return r.status === 'beantwortet'; });
    var unansweredCnt  = results.filter(function(r){ return r.status === 'unbeantwortet'; }).length;
    var notReachedCnt  = results.filter(function(r){ return r.status === 'nicht_erreicht'; }).length;
    var correctCount   = answeredList.filter(function(r){ return r.correct; }).length;
    return {
      completed: (unansweredCnt === 0 && notReachedCnt === 0),  // wirklich alle Aufgaben geschafft?
      trials_completed: answeredList.length,                    // tatsächlich beantwortete Aufgaben
      unanswered: unansweredCnt,                                // gezeigt, aber Zeit lief ab
      not_reached: notReachedCnt,                               // gar nicht mehr gezeigt
      correct: correctCount,
      total: totalTrials,
      accuracy: answeredList.length ? T.round(correctCount / answeredList.length, 3) : null,
      medMs: T.round(T.median(answeredList.map(function(r){ return r.rt; })), 0),
      details: results
    };
  },
  format:function(r){
    var rows=[
      {label:tr('Richtig gelöst','Solved correctly'), value:fmtPct(r.accuracy)},
      {label:tr('Typische Antwortzeit','Typical response time'), value:fmtSec(r.medMs)},
      {label:tr('Aufgaben abgeschlossen','Tasks completed'), value: (r.trials_completed != null ? r.trials_completed + ' / ' + r.total : '–')}
    ];
    if(r.unanswered){ rows.push({label:tr('Unbeantwortet (Zeit abgelaufen)','Unanswered (time ran out)'), value:r.unanswered}); }
    if(r.not_reached){ rows.push({label:tr('Nicht erreicht (Zeit abgelaufen)','Not reached (time ran out)'), value:r.not_reached}); }
    return rows;
  }
},

/* ---- 7. Reaktionstest (Deary-Liewald-Stil, Wahlreaktion) ---- */
{
  id:'deary_rt',
  name:{de:'Schnell reagieren', en:'React quickly'},
  short:{de:'Es leuchtet eines von vier Feldern auf – so schnell wie möglich die passende Taste drücken.', en:'One of four boxes lights up – press the matching key as fast as possible.'},
  measures:{de:'Reine Reaktionsgeschwindigkeit.', en:'Pure reaction speed.'},
  defaultDifficulty:'mittel',
  difficulties:{
    leicht:{ trials:15, tl:3500 },
    mittel:{ trials:25, tl:3000 },
    schwer:{ trials:40, tl:2500 }
  },
  run: async function(P, ui){
    var results=[]; var keys=['d','f','j','k'];
    var waits=distinctIntervals(P.trials, 800, 2200);   // alle unterschiedlich, gemischt
    for(var i=0;i<P.trials;i++){
      ui.count((i+1)+' / '+P.trials);
      ui.host.innerHTML='<div class="stage rt"><div class="rtrow">'+
        [0,1,2,3].map(function(k){ return '<div class="rtbox" data-k="'+k+'"><kbd>'+keys[k].toUpperCase()+'</kbd></div>'; }).join('')+
        '</div><div class="status">'+tr('Warten…','Wait…')+'</div></div>';
      await ui.sleep(waits[i]);
      var target=T.rint(0,3);
      var box=ui.host.querySelector('.rtbox[data-k="'+target+'"]'); box.classList.add('lit');
      ui.host.querySelector('.status').textContent=tr('Jetzt!','Now!');
      var t0=performance.now();
      var ans=await ui.choice([[String(target),keys[target]]].concat(
        [0,1,2,3].filter(function(k){return k!==target;}).map(function(k){ return ['wrong'+k, keys[k]]; })
      ), P.tl||0);
      var rt=performance.now()-t0;
      var timedOut=(ans===ui.TIMEOUT);
      var ok = !timedOut && (ans===String(target));
      box.classList.remove('lit');
      results.push({ i:i+1, wait:waits[i], correct:ok, rt:T.round(rt), timedOut:timedOut });
      await ui.flash(ok);
    }
    var rts=results.filter(function(r){return r.correct;}).map(function(r){return r.rt;});
    return { n:results.length, correctCount:results.filter(function(r){return r.correct;}).length,
             accuracy:T.round(results.filter(function(r){return r.correct;}).length/results.length,3),
             avgMs:T.round(T.mean(rts),0), medMs:T.round(T.median(rts),0), trials:results };
  },
  format:function(r){ return [
    {label:tr('Typische Reaktionszeit','Typical reaction time'), value:fmtSec(r.medMs)},
    {label:tr('Richtige Taste','Correct key'), value:fmtPct(r.accuracy)},
    {label:tr('Durchgänge','Rounds'), value:r.n}
  ]; }
},

/* ---- 8. Regeln wechseln (Task Switching) ---- */
{
  id:'taskswitch',
  name:{de:'Regeln wechseln', en:'Switching rules'},
  short:{de:'Mal soll man beurteilen, ob eine Zahl groß/klein ist, mal ob sie gerade/ungerade ist. Die Regel wechselt.', en:'Sometimes judge whether a number is big/small, sometimes whether it is even/odd. The rule keeps switching.'},
  measures:{de:'Wie flexibel man zwischen Aufgaben umschaltet.', en:'How flexibly you switch between tasks.'},
  defaultDifficulty:'mittel',
  difficulties:{
    leicht:{ trials:18, tl:4000 },
    mittel:{ trials:28, tl:3500 },
    schwer:{ trials:40, tl:3000 }
  },
  run: async function(P, ui){
    var results=[]; var prevRule=null;
    for(var i=0;i<P.trials;i++){
      var rule=T.pick(['groesse','paritaet']);
      var n=T.pick([1,2,3,4,6,7,8,9]);
      var switched = prevRule!==null && rule!==prevRule;
      ui.count((i+1)+' / '+P.trials);
      var qLabel = rule==='groesse' ? tr('GRÖSSE: kleiner oder größer als 5?','SIZE: smaller or larger than 5?') : tr('ZAHL: gerade oder ungerade?','NUMBER: even or odd?');
      var leftLabel = rule==='groesse' ? '&lt; 5' : tr('gerade','even');
      var rightLabel= rule==='groesse' ? '&gt; 5' : tr('ungerade','odd');
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
      var ans=await ui.choice([['left','f'],['right','j']], P.tl||0);
      var rt=performance.now()-t0; var timedOut=(ans===ui.TIMEOUT); var ok=!timedOut && (ans===correctSide);
      results.push({ i:i+1, rule:rule, switched:switched, correct:ok, rt:T.round(rt), timedOut:timedOut });
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
    {label:tr('Richtig beurteilt','Judged correctly'), value:fmtPct(r.accuracy)},
    {label:tr('Antwortzeit normal','Response time, no switch'), value:fmtSec(r.stayMs)},
    {label:tr('Antwortzeit nach Regelwechsel','Response time after a rule switch'), value:fmtSec(r.switchMs)},
    {label:tr('Mehraufwand durch Wechsel','Extra cost of switching'), value:(r.switchCost!=null? fmtPlus(r.switchCost):'–')}
  ]; }
},

/* ---- 9. Muster vervollständigen (Linien-/Einrast-Effekt, Gestalt) ---- */
{
  id:'lineclose',
  name:{de:'Muster vervollständigen', en:'Complete the pattern'},
  short:{de:'Ein Raster-Muster hat eine fehlende Stelle. Welches Teil vervollständigt das Muster?', en:'A grid pattern has a missing spot. Which piece completes the pattern?'},
  measures:{de:'Wie schnell das Auge ein Muster „schließt“ und ergänzt.', en:'How quickly the eye “closes” and completes a pattern.'},
  defaultDifficulty:'mittel',
  difficulties:{
    leicht:{ trials:10, grid:3, tl:10000 },
    mittel:{ trials:14, grid:4, tl:8000  },
    schwer:{ trials:18, grid:5, tl:7000  }
  },
  run: async function(P, ui){
    var results=[];
    for(var i=0;i<P.trials;i++){
      var tr=makePatternTrial(P.grid);
      ui.count((i+1)+' / '+P.trials);
      await ui.fixation();
      ui.host.innerHTML='<div class="stage pattern">'+
        '<div class="pgrid">'+tr.gridSVG+'</div>'+
        '<div class="welllbl">'+I18N.t('Welches Teil schließt das Muster?','Which piece completes the pattern?')+'</div>'+
        '<div class="answers four">'+
          tr.options.map(function(op,k){ return '<button class="btn ans opt" data-a="'+k+'"><kbd>'+(k+1)+'</kbd>'+op+'</button>'; }).join('')+
        '</div></div>';
      var t0=performance.now();
      var ans=await ui.choice(tr.options.map(function(_,k){ return [String(k),String(k+1)]; }), P.tl||0);
      var rt=performance.now()-t0; var timedOut=(ans===ui.TIMEOUT); var ok=!timedOut && (Number(ans)===tr.correctIndex);
      results.push({ i:i+1, correct:ok, rt:T.round(rt), timedOut:timedOut });
      await ui.flash(ok);
    }
    var rts=results.filter(function(r){return r.correct;}).map(function(r){return r.rt;});
    return { n:results.length, correctCount:results.filter(function(r){return r.correct;}).length,
             accuracy:T.round(results.filter(function(r){return r.correct;}).length/results.length,3),
             avgMs:T.round(T.mean(rts),0), medMs:T.round(T.median(rts),0), trials:results };
  },
  format:function(r){ return [
    {label:tr('Richtig ergänzt','Correctly completed'), value:fmtPct(r.accuracy)},
    {label:tr('Typische Antwortzeit','Typical response time'), value:fmtSec(r.medMs)},
    {label:tr('Aufgaben gesamt','Total tasks'), value:r.n}
  ]; }
},

/* ---- 10. Kofferraum packen (Pack-Logik / Alltag) ---- */
{
  id:'trunkpack',
  name:{de:'Kofferraum packen', en:'Packing the boot'},
  short:{de:'Eine Kiste ist halb gefüllt. Passt das übrige Teil noch hinein (auch gedreht)?', en:'A box is half full. Does the remaining piece still fit (even rotated)?'},
  measures:{de:'Räumliches Planen wie beim Packen oder Spülmaschine-Einräumen.', en:'Spatial planning, like packing or loading a dishwasher.'},
  defaultDifficulty:'mittel',
  difficulties:{
    leicht:{ trials:10, grid:4, tl:14000 },
    mittel:{ trials:14, grid:5, tl:12000 },
    schwer:{ trials:18, grid:6, tl:10000 }
  },
  run: async function(P, ui){
    var results=[];
    for(var i=0;i<P.trials;i++){
      var tr=makePackTrial(P.grid);
      ui.count((i+1)+' / '+P.trials);
      await ui.fixation();
      ui.host.innerHTML='<div class="stage pack">'+
        '<div class="packrow">'+
          '<div class="packbox"><div class="packlbl">'+I18N.t('Kiste','Box')+'</div>'+tr.boxSVG+'</div>'+
          '<div class="packpiece"><div class="packlbl">'+I18N.t('Dieses Teil','This piece')+'</div>'+tr.pieceSVG+'</div>'+
        '</div>'+
        '<div class="welllbl">'+I18N.t('Passt das Teil noch hinein (auch gedreht)?','Does the piece still fit (even rotated)?')+'</div>'+
        '<div class="answers two">'+
          '<button class="btn ans" data-a="yes"><kbd>F</kbd> '+I18N.t('Passt','Fits')+'</button>'+
          '<button class="btn ans" data-a="no"><kbd>J</kbd> '+I18N.t('Passt nicht','Does not fit')+'</button>'+
        '</div></div>';
      var t0=performance.now();
      var ans=await ui.choice([['yes','f'],['no','j']], P.tl||0);
      var rt=performance.now()-t0; var timedOut=(ans===ui.TIMEOUT); var ok=!timedOut && ((ans==='yes')===tr.fits);
      results.push({ i:i+1, fits:tr.fits, correct:ok, rt:T.round(rt), timedOut:timedOut });
      await ui.flash(ok);
    }
    var rts=results.filter(function(r){return r.correct;}).map(function(r){return r.rt;});
    return { n:results.length, correctCount:results.filter(function(r){return r.correct;}).length,
             accuracy:T.round(results.filter(function(r){return r.correct;}).length/results.length,3),
             avgMs:T.round(T.mean(rts),0), medMs:T.round(T.median(rts),0), trials:results };
  },
  format:function(r){ return [
    {label:tr('Richtig entschieden','Decided correctly'), value:fmtPct(r.accuracy)},
    {label:tr('Typische Antwortzeit','Typical response time'), value:fmtSec(r.medMs)},
    {label:tr('Aufgaben gesamt','Total tasks'), value:r.n}
  ]; }
},

/* ---- 11. Symbol suchen (visuelle Suche mit Störern) ---- */
{
  id:'visualsearch',
  name:{de:'Symbol suchen', en:'Find the symbol'},
  short:{de:'In einem Raster aus ähnlichen Kästchen das eine abweichende finden und antippen.', en:'In a grid of similar boxes, find the one odd box and tap it.'},
  measures:{de:'Wie schnell das Auge im Gewimmel das Besondere findet.', en:'How quickly the eye finds the odd one out in a clutter.'},
  defaultDifficulty:'mittel',
  difficulties:{
    leicht:{ trials:10, items:16, tl:12000 },
    mittel:{ trials:20, items:30, tl:10000 },
    schwer:{ trials:30, items:48, tl:9000  }
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
        }).join('')+'</div><div class="status">'+tr('Tippe das Kästchen mit dem blauen Punkt an','Tap the box with the blue dot')+'</div></div>';
      var t0=performance.now();
      var ok=await waitTargetTap(ui, P.tl||0);
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
    {label:tr('Typische Suchzeit','Typical search time'), value:fmtSec(r.medMs)},
    {label:tr('Treffer','Hits'), value:fmtPct(r.accuracy)},
    {label:tr('Suchdurchgänge','Search rounds'), value:r.n}
  ]; }
},

/* ---- 12. Konzentration unter Ablenkung ---- */
{
  id:'concentration',
  name:{de:'Konzentration unter Ablenkung', en:'Concentration under distraction'},
  short:{de:'Immer wieder erscheint ein Symbol unter vielen anderen – nur ein bestimmtes Ziel antippen, während es ringsum flackert.', en:'A symbol keeps appearing among many others – tap only one specific target while everything around it flickers.'},
  measures:{de:'Konzentration, wenn drumherum viel los ist.', en:'Concentration when there is a lot going on around you.'},
  defaultDifficulty:'mittel',
  difficulties:{
    leicht:{ seconds:40, items:12 },
    mittel:{ seconds:60, items:20 },
    schwer:{ seconds:120, items:28 }
  },
  run: async function(P, ui){
    var symbols=['◆','●','▲','★','■','✦','✚','◗'];
    var targetSym='★';
    var hits=0, misses=0, falseAlarms=0, total=0, rts=[];
    ui.host.innerHTML='<div class="stage concentration"><div class="conhead">'+tr('Tippe jedes','Tap every')+' <b class="tgt">'+targetSym+'</b> '+tr('an – ignoriere den Rest.','– ignore the rest.')+' <span id="clock"></span></div><div class="congrid" id="cg"></div></div>';
    var grid=ui.host.querySelector('#cg'), clock=ui.host.querySelector('#clock');
    var endAt=performance.now()+P.seconds*1000, running=true, shownAt=0, curHasTarget=false;
    function render(){
      var hasTarget = Math.random()<0.35;
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
      // render();
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
    {label:tr('Richtig getroffen','Correct hits'), value:(r.hits||0)},
    {label:tr('Übersehen','Missed'), value:(r.misses||0)},
    {label:tr('Daneben getippt','Tapped wrongly'), value:(r.falseAlarms||0)},
    {label:tr('Typische Reaktionszeit','Typical reaction time'), value:fmtSec(r.medMs)}
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
function waitTargetTap(ui, timeoutMs){
  return new Promise(function(resolve){
    var host=ui.host, done=false, cancelCd=function(){};
    var items=host.querySelectorAll('.sitem');
    function finish(v){ if(done) return; done=true; cancelCd(); items.forEach(function(x){ x.onclick=null; }); resolve(v); }
    items.forEach(function(it){ it.onclick=function(){ finish(it.dataset.t==='1'); }; });
    if(timeoutMs && timeoutMs>0 && ui.countdownStart){ cancelCd=ui.countdownStart(timeoutMs, function(){ finish(false); }); }
  });
}
function produceInterval(ui, targetSec){
  return new Promise(function(resolve){
    ui.host.innerHTML='<div class="stage time">'+
      '<p class="lead center">'+tr('Drücke','Press')+' <b>Start</b> '+tr('und dann','and then')+' <b>'+tr('Stopp','Stop')+'</b>, '+tr('wenn du glaubst, dass','when you think that')+' <b>'+targetSec+' '+tr('Sekunden','seconds')+'</b> '+tr('vergangen sind.','have passed.')+'<br>'+
      '<span class="muted">'+tr('Bitte nicht mitzählen und nicht auf eine Uhr schauen.','Please do not count along and do not look at a clock.')+'</span></p>'+
      '<div class="timebox"><button class="btn primary big" id="tstart">Start</button></div></div>';
    ui.host.querySelector('#tstart').onclick=function(){
      var t0=performance.now();
      // bewusst KEIN blinkender Punkt / keine Anzeige -> erschwert das Zählen nicht künstlich
      ui.host.querySelector('.timebox').innerHTML='<div class="timewait">'+tr('Konzentrier dich… und drücke Stopp, wenn es so weit ist.','Concentrate… and press Stop when the time feels right.')+'</div><button class="btn primary big" id="tstop">'+tr('Stopp','Stop')+'</button>';
      ui.host.querySelector('#tstop').onclick=function(){ resolve(performance.now()-t0); };
    };
  });
}

/* ----- Papier falten (Paper-Folding VZ-2-Stil): Aufgabe erzeugen -----
   Originaler Generator (keine Kopien fremder Testbögen). Modell mit
   stetigen Koordinaten im Einheitsquadrat [0,1]x[0,1].
   Formen: achsenparalleles Rechteck ODER gleichschenklig-rechtwinkliges
   Dreieck. Jeder Falz halbiert die aktuelle Form auf eine spiegel-
   kongruente Hälfte (waagerecht, senkrecht oder diagonal). Beim Aufklappen
   werden die Löcher in umgekehrter Reihenfolge an jeder Falzlinie
   gespiegelt – die richtige Lösung wird also BERECHNET und ist immer korrekt. */
function _fl_line(p0,p1){ var dx=p1[0]-p0[0], dy=p1[1]-p0[1]; var a=dy,b=-dx,n=Math.hypot(a,b); a/=n; b/=n; return {a:a,b:b,c:-(a*p0[0]+b*p0[1])}; }
function _fl_reflect(p,L){ var d=L.a*p[0]+L.b*p[1]+L.c; return [p[0]-2*L.a*d, p[1]-2*L.b*d]; }
function _fl_mid(p,q){ return [(p[0]+q[0])/2,(p[1]+q[1])/2]; }
function _fl_poly(s){
  if(s.kind==='rect'){ var x0=s.cx-s.w/2,x1=s.cx+s.w/2,y0=s.cy-s.h/2,y1=s.cy+s.h/2; return [[x0,y0],[x1,y0],[x1,y1],[x0,y1]]; }
  return [s.p,s.q,s.r];
}
function _fl_centroid(s){ if(s.kind==='rect') return [s.cx,s.cy]; return [(s.r[0]+s.p[0]+s.q[0])/3,(s.r[1]+s.p[1]+s.q[1])/3]; }
function _fl_rawPoint(s, margin){
  if(s.kind==='rect'){ var mx=Math.min(margin,s.w*0.3), my=Math.min(margin,s.h*0.3);
    return [ s.cx-s.w/2+mx+Math.random()*(s.w-2*mx), s.cy-s.h/2+my+Math.random()*(s.h-2*my) ]; }
  var r=s.r,p=s.p,q=s.q, u=Math.random(), v=Math.random(); if(u+v>1){u=1-u;v=1-v;}
  var x=r[0]+u*(p[0]-r[0])+v*(q[0]-r[0]), y=r[1]+u*(p[1]-r[1])+v*(q[1]-r[1]);
  var c=_fl_centroid(s), k=0.3; return [x+(c[0]-x)*k, y+(c[1]-y)*k];
}
function _fl_interior(s, margin){
  var c=_fl_centroid(s), diag=(s.kind==='rect')?Math.hypot(s.w,s.h):0.5, minOff=diag*0.18;
  for(var t=0;t<60;t++){ var pt=_fl_rawPoint(s,margin); if(Math.hypot(pt[0]-c[0],pt[1]-c[1])>=minOff) return pt; }
  return _fl_rawPoint(s,margin);
}
function _fl_foldOptions(s){
  var out=[];
  if(s.kind==='rect'){
    var x0=s.cx-s.w/2,x1=s.cx+s.w/2,y0=s.cy-s.h/2,y1=s.cy+s.h/2;
    out.push({ crease:_fl_line([s.cx,y0],[s.cx,y1]), halves:[
      {kind:'rect',cx:s.cx-s.w/4,cy:s.cy,w:s.w/2,h:s.h},{kind:'rect',cx:s.cx+s.w/4,cy:s.cy,w:s.w/2,h:s.h}] });
    out.push({ crease:_fl_line([x0,s.cy],[x1,s.cy]), halves:[
      {kind:'rect',cx:s.cx,cy:s.cy-s.h/4,w:s.w,h:s.h/2},{kind:'rect',cx:s.cx,cy:s.cy+s.h/4,w:s.w,h:s.h/2}] });
    if(Math.abs(s.w-s.h)<1e-9){
      var TL=[x0,y0],TR=[x1,y0],BR=[x1,y1],BL=[x0,y1];
      out.push({ crease:_fl_line(TL,BR), halves:[ {kind:'tri',r:TR,p:TL,q:BR},{kind:'tri',r:BL,p:BR,q:TL} ] });
      out.push({ crease:_fl_line(TR,BL), halves:[ {kind:'tri',r:TL,p:BL,q:TR},{kind:'tri',r:BR,p:TR,q:BL} ] });
    }
  } else {
    var m=_fl_mid(s.p,s.q);
    out.push({ crease:_fl_line(s.r,m), halves:[ {kind:'tri',r:m,p:s.r,q:s.p},{kind:'tri',r:m,p:s.r,q:s.q} ] });
  }
  return out;
}
function makeFoldTrial(nFolds, nHoles, hardness){
  nHoles=nHoles||1;
  var sim = (typeof hardness==='number') ? hardness : 0;   // 0=leicht, 1=mittel, 2=schwer
  var shape={kind:'rect',cx:0.5,cy:0.5,w:1,h:1}, creases=[], shapesSeq=[shape], flaps=[];
  for(var f=0; f<nFolds; f++){
    var opt=T.pick(_fl_foldOptions(shape)); var half=T.pick(opt.halves);
    var other=(opt.halves[0]===half)?opt.halves[1]:opt.halves[0]; // die Hälfte, die umgeklappt wird
    flaps.push({ flap:_fl_poly(other), from:_fl_centroid(other), to:_fl_centroid(half) });
    creases.push(opt.crease); shape=half; shapesSeq.push(shape);
  }
  var holes=[], tries=0;
  while(holes.length<nHoles && tries++<200){ var h=_fl_interior(shape,0.12);
    if(holes.every(function(o){return Math.hypot(o[0]-h[0],o[1]-h[1])>0.18;})) holes.push(h); }
  function dedupe(set){ var out=[]; set.forEach(function(p){ if(out.every(function(o){return Math.hypot(o[0]-p[0],o[1]-p[1])>0.02;})) out.push(p); }); return out; }
  function unfold(set, skip){ var cur=set.map(function(p){return p.slice();});
    for(var i=creases.length-1;i>=0;i--){ if(i===skip) continue; cur=dedupe(cur.concat(cur.map(function(p){return _fl_reflect(p,creases[i]);}))); } return cur; }
  function keyOf(set){ return set.map(function(p){return Math.round(p[0]*1000)/1000+','+Math.round(p[1]*1000)/1000;}).sort().join(';'); }
  var correct=unfold(holes,-1), ckey=keyOf(correct);
  function setDist(A,B){ if(A.length!==B.length) return 1; var used={},tot=0;
    A.forEach(function(p){ var best=9,bi=-1; for(var j=0;j<B.length;j++){ if(used[j])continue; var d=Math.hypot(p[0]-B[j][0],p[1]-B[j][1]); if(d<best){best=d;bi=j;} } used[bi]=1; tot+=best; }); return tot/A.length; }

  // Ein einzelnes Loch der korrekten Lösung an eine plausible, aber falsche Stelle schieben.
  // Lochzahl bleibt gleich -> man muss wirklich jedes Loch prüfen statt das "vollständige" Muster zu raten.
  function nudgeOne(set, mag){
    if(!set.length) return null;
    var s=set.map(function(p){return p.slice();});
    var idx=T.rint(0,s.length-1);
    var dirs=T.shuffle([[1,0],[-1,0],[0,1],[0,-1],[0.71,0.71],[-0.71,0.71],[0.71,-0.71],[-0.71,-0.71]]);
    for(var d=0; d<dirs.length; d++){
      var np=[ s[idx][0]+dirs[d][0]*mag, s[idx][1]+dirs[d][1]*mag ];
      if(np[0]<0.06||np[0]>0.94||np[1]<0.06||np[1]>0.94) continue;
      var clash=false;
      for(var k=0;k<s.length;k++){ if(k===idx) continue; if(Math.hypot(np[0]-s[k][0],np[1]-s[k][1])<0.07){ clash=true; break; } }
      if(clash) continue;
      s[idx]=np; return s;
    }
    return null;
  }
  // Spiegelungen/Drehungen des GANZEN Musters (gleiche Lochzahl, sehen plausibel "gefaltet" aus)
  var reflTransforms=[
    function(p){return [1-p[0],p[1]];},      // an senkrechter Mittelachse
    function(p){return [p[0],1-p[1]];},      // an waagerechter Mittelachse
    function(p){return [p[1],p[0]];},        // an Hauptdiagonale
    function(p){return [1-p[1],1-p[0]];},    // an Nebendiagonale
    function(p){return [1-p[0],1-p[1]];}     // 180°-Drehung
  ];

  // Mindestabstand zur korrekten Lösung: je schwerer, desto näher dürfen die Distraktoren sein.
  var minDist = (sim>=2) ? 0.012 : (sim>=1 ? 0.03 : 0.09);
  var opts=[correct], seen={}; seen[ckey]=1;
  function tryAdd(cd){
    if(!cd || opts.length>=5) return;
    if(sim>0 && cd.length!==correct.length) return;   // mittel/schwer: gleiche Lochzahl erzwingen
    if(cd.length===0) return;
    if(setDist(cd,correct) < minDist) return;          // zu identisch -> unfair, verwerfen
    var k=keyOf(cd); if(seen[k]) return; seen[k]=1; opts.push(cd);
  }

  if(sim===0){
    // leicht: wie bisher – auch deutlich verschiedene Muster (z. B. weniger Löcher) erlaubt
    if(creases.length>1) tryAdd(unfold(holes, T.rint(0,creases.length-1)));
    tryAdd(dedupe(correct.map(function(p){return [1-p[0],p[1]];})));
    tryAdd(dedupe(correct.map(function(p){return [p[0],1-p[1]];})));
    tryAdd(holes.map(function(p){return p.slice();}));
    tryAdd(dedupe(correct.map(function(p){return [p[1],p[0]];})));
  } else {
    // mittel/schwer: gleiche Lochzahl + "Beinahe-Treffer"
    var mag = (sim>=2) ? 0.15 : 0.22;
    // ein paar plausible Spiegelungen (falls sie sich überhaupt vom Original unterscheiden)
    T.shuffle(reflTransforms.slice()).forEach(function(fn){ tryAdd(dedupe(correct.map(fn))); });
    // hauptsächlich: je ein Loch leicht verschoben
    var att=0; while(opts.length<5 && att++<200){ tryAdd(nudgeOne(correct, mag)); }
    // Notfall: zwei Löcher verschieben, falls noch nicht genug eindeutige Varianten
    att=0; while(opts.length<5 && att++<200){ var two=nudgeOne(correct, mag); if(two) tryAdd(nudgeOne(two, mag)); }
  }
  // Letzte Absicherung (sollte selten greifen): Zufalls-Jitter
  var guard=0;
  while(opts.length<5 && guard++<300){
    var j=dedupe(correct.map(function(p){return [p[0]+(Math.random()-0.5)*0.5,p[1]+(Math.random()-0.5)*0.5];})
      .filter(function(p){return p[0]>0.05&&p[0]<0.95&&p[1]>0.05&&p[1]<0.95;}));
    if(j.length && keyOf(j)!==ckey && !seen[keyOf(j)]){ seen[keyOf(j)]=1; opts.push(j); }
  }
  opts=T.shuffle(opts.slice(0,5));
  var correctIndex=-1; for(var oi=0;oi<opts.length;oi++){ if(keyOf(opts[oi])===ckey){ correctIndex=oi; break; } }
  // Schritt-Bilder fürs Prompt + Antwort-Bögen
  var stepSVGs=[];
  for(var st=0; st<flaps.length; st++)
    stepSVGs.push(foldStepSVG(_fl_poly(shapesSeq[st]), flaps[st].flap, creases[st], flaps[st].from, flaps[st].to, 96));
  stepSVGs.push(foldFinalSVG(_fl_poly(shapesSeq[shapesSeq.length-1]), holes, 96));
  var optionSVGs=opts.map(function(o){ return foldGridSVG(o,80); });
  return { nFolds:nFolds, holes:holes, options:opts, optionSVGs:optionSVGs, stepSVGs:stepSVGs, correctIndex:correctIndex };
}
// kleiner Pfeil von (x0,y0) nach (x1,y1)
function _fl_arrow(x0,y0,x1,y1,col){
  var ang=Math.atan2(y1-y0,x1-x0), ah=6;
  return '<line x1="'+x0.toFixed(1)+'" y1="'+y0.toFixed(1)+'" x2="'+x1.toFixed(1)+'" y2="'+y1.toFixed(1)+'" stroke="'+col+'" stroke-width="2" stroke-linecap="round"/>'+
         '<path d="M'+x1.toFixed(1)+' '+y1.toFixed(1)+' L'+(x1-ah*Math.cos(ang-0.5)).toFixed(1)+' '+(y1-ah*Math.sin(ang-0.5)).toFixed(1)+
         ' L'+(x1-ah*Math.cos(ang+0.5)).toFixed(1)+' '+(y1-ah*Math.sin(ang+0.5)).toFixed(1)+' Z" fill="'+col+'"/>';
}
// Ein Falt-Schritt: schwacher Umriss des Originalblatts + aktuelles Papier,
// die umzuklappende Hälfte (Flap) türkis hervorgehoben, Falzlinie + Richtungspfeil.
function foldStepSVG(prePoly, flapPoly, crease, from, to, size){
  size=size||96; var pad=11, span=size-2*pad, r='';
  var paper='#e4eaf7', edge='#8d97bd', cc='#22d3ee';
  function P(x,y){ return (pad+x*span).toFixed(1)+','+(pad+y*span).toFixed(1); }
  function pts(poly){ return poly.map(function(p){return P(p[0],p[1]);}).join(' '); }
  // Originalblatt (zur Orientierung, wie groß es einmal war)
  r+='<rect x="'+pad+'" y="'+pad+'" width="'+span+'" height="'+span+'" rx="3" fill="none" stroke="rgba(255,255,255,.12)" stroke-dasharray="2 3"/>';
  // aktuelles Papier
  r+='<polygon points="'+pts(prePoly)+'" fill="'+paper+'" stroke="'+edge+'" stroke-width="1.6" stroke-linejoin="round"/>';
  // Flap (klappt um)
  r+='<polygon points="'+pts(flapPoly)+'" fill="rgba(34,211,238,.20)" stroke="'+cc+'" stroke-width="1.4" stroke-dasharray="3 2" stroke-linejoin="round"/>';
  // Falzlinie
  if(crease){
    var xs=prePoly.map(function(p){return p[0];}), ys=prePoly.map(function(p){return p[1];});
    var minx=Math.min.apply(null,xs),maxx=Math.max.apply(null,xs),miny=Math.min.apply(null,ys),maxy=Math.max.apply(null,ys);
    var L=crease, pis=[];
    function addpt(x,y){ if(x>=minx-1e-6&&x<=maxx+1e-6&&y>=miny-1e-6&&y<=maxy+1e-6) pis.push([x,y]); }
    if(Math.abs(L.b)>1e-9){ addpt(minx,-(L.a*minx+L.c)/L.b); addpt(maxx,-(L.a*maxx+L.c)/L.b); }
    if(Math.abs(L.a)>1e-9){ addpt(-(L.b*miny+L.c)/L.a,miny); addpt(-(L.b*maxy+L.c)/L.a,maxy); }
    if(pis.length>=2) r+='<line x1="'+P(pis[0][0],pis[0][1]).split(',')[0]+'" y1="'+P(pis[0][0],pis[0][1]).split(',')[1]+'" x2="'+P(pis[1][0],pis[1][1]).split(',')[0]+'" y2="'+P(pis[1][0],pis[1][1]).split(',')[1]+'" stroke="'+cc+'" stroke-width="2" stroke-dasharray="4 3"/>';
  }
  // Richtungspfeil: von der Flap-Mitte Richtung bleibender Hälfte
  if(from && to){
    var fx=pad+from[0]*span, fy=pad+from[1]*span, tx=pad+to[0]*span, ty=pad+to[1]*span;
    // etwas einkürzen, damit der Pfeil nicht über die ganze Fläche läuft
    var mx=fx+(tx-fx)*0.78, my=fy+(ty-fy)*0.78;
    r+=_fl_arrow(fx+(tx-fx)*0.15, fy+(ty-fy)*0.15, mx, my, cc);
  }
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'">'+r+'</svg>';
}
// Endzustand: gefaltetes Papier + gestanzte Löcher (ausgefüllte Punkte)
function foldFinalSVG(shapePoly, holes, size){
  size=size||96; var pad=11, span=size-2*pad, r='';
  var paper='#e4eaf7', edge='#8d97bd', holeFill='#0c1226';
  function pts(poly){ return poly.map(function(p){return (pad+p[0]*span).toFixed(1)+','+(pad+p[1]*span).toFixed(1);}).join(' '); }
  r+='<rect x="'+pad+'" y="'+pad+'" width="'+span+'" height="'+span+'" rx="3" fill="none" stroke="rgba(255,255,255,.12)" stroke-dasharray="2 3"/>';
  r+='<polygon points="'+pts(shapePoly)+'" fill="'+paper+'" stroke="'+edge+'" stroke-width="1.6" stroke-linejoin="round"/>';
  if(holes) holes.forEach(function(h){ r+='<circle cx="'+(pad+h[0]*span).toFixed(1)+'" cy="'+(pad+h[1]*span).toFixed(1)+'" r="'+(span*0.05).toFixed(1)+'" fill="'+holeFill+'" stroke="'+edge+'" stroke-width="1"/>'; });
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'">'+r+'</svg>';
}
// Antwort-Option: aufgeklapptes Blatt mit feinem Orientierungsraster + gestanzten Löchern
function foldGridSVG(holes, size){
  size=size||80; var pad=8, span=size-2*pad, r='';
  r+='<rect x="'+pad+'" y="'+pad+'" width="'+span+'" height="'+span+'" rx="3" fill="#e4eaf7" stroke="#8d97bd" stroke-width="1.6"/>';
  for(var i=1;i<4;i++){ var p=pad+i*span/4;
    r+='<line x1="'+p.toFixed(1)+'" y1="'+pad+'" x2="'+p.toFixed(1)+'" y2="'+(pad+span)+'" stroke="rgba(20,29,58,.10)"/>'+
       '<line x1="'+pad+'" y1="'+p.toFixed(1)+'" x2="'+(pad+span)+'" y2="'+p.toFixed(1)+'" stroke="rgba(20,29,58,.10)"/>'; }
  holes.forEach(function(h){ r+='<circle cx="'+(pad+h[0]*span).toFixed(1)+'" cy="'+(pad+h[1]*span).toFixed(1)+'" r="'+(span*0.06).toFixed(1)+'" fill="#0c1226" stroke="#8d97bd" stroke-width="1"/>'; });
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
