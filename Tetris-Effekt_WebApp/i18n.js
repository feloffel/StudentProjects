/* =====================================================================
   i18n.js — Sprachumschaltung DE/EN  (gemeinsam für App + Dashboard)
   ---------------------------------------------------------------------
   Wird VOR tests.js / app.js / dashboard.js geladen und stellt bereit:
     I18N.lang            'de' | 'en'  (aktuelle Sprache, in localStorage)
     I18N.set(l)          Sprache setzen + alle Abonnenten neu rendern
     I18N.toggle()        zwischen de/en wechseln
     I18N.onChange(fn)    Callback bei Sprachwechsel registrieren
     I18N.dateLocale()    'de-DE' | 'en-GB' für Datum/Uhrzeit
     tr(de, en)           gibt je nach Sprache de ODER en zurück
     L(value)             löst {de,en}-Objekte (oder reine Strings) auf
     buildLangToggle(cb)  baut den schwebenden DE/EN-Schalter
     I18N.applyDom(root)  übersetzt statisches HTML mit data-i18n-* Attributen
   ===================================================================== */
'use strict';

var I18N = {
  lang: 'de',
  _subs: [],
  init: function(){
    try { var s = localStorage.getItem('tetris_lang'); if (s === 'de' || s === 'en') this.lang = s; } catch (e) {}
    try { document.documentElement.setAttribute('lang', this.lang); } catch (e) {}
    return this.lang;
  },
  set: function(l){
    if (l !== 'de' && l !== 'en') return;
    this.lang = l;
    try { localStorage.setItem('tetris_lang', l); } catch (e) {}
    try { document.documentElement.setAttribute('lang', l); } catch (e) {}
    this._subs.forEach(function(fn){ try { fn(l); } catch (e) { console.error(e); } });
  },
  // wie tr(), aber als Methode -> nutzbar dort, wo eine lokale Variable 'tr' existiert
  t: function(de, en){ return this.lang === 'en' ? en : de; },
  toggle: function(){ this.set(this.lang === 'en' ? 'de' : 'en'); },
  onChange: function(fn){ if (typeof fn === 'function') this._subs.push(fn); },
  dateLocale: function(){ return this.lang === 'en' ? 'en-GB' : 'de-DE'; }
};
I18N.init();

/* Kurzform: passende Sprachfassung wählen */
function tr(de, en){ return I18N.lang === 'en' ? en : de; }

/* {de:'…', en:'…'}-Objekte (oder einfache Strings) auflösen */
function L(v){
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v[I18N.lang] != null ? v[I18N.lang] : (v.de != null ? v.de : (v.en != null ? v.en : ''));
  }
  return v;
}

/* Statisches HTML übersetzen:
     <h2 data-i18n-de="Ergebnisse" data-i18n-en="Results">…</h2>
     <p  data-i18n-de-html="…<b>x</b>…" data-i18n-en-html="…<b>x</b>…">…</p>
   Ohne passendes Attribut für die aktuelle Sprache bleibt der Inhalt unberührt. */
I18N.applyDom = function(root){
  root = root || document;
  var lang = this.lang;
  // Textinhalte
  root.querySelectorAll('[data-i18n-de],[data-i18n-en]').forEach(function(el){
    var v = el.getAttribute('data-i18n-' + lang);
    if (v != null) el.textContent = v;
  });
  // HTML-Inhalte (mit Markup/Entities)
  root.querySelectorAll('[data-i18n-de-html],[data-i18n-en-html]').forEach(function(el){
    var v = el.getAttribute('data-i18n-' + lang + '-html');
    if (v != null) el.innerHTML = v;
  });
  // Platzhalter von Eingabefeldern
  root.querySelectorAll('[data-i18n-de-ph],[data-i18n-en-ph]').forEach(function(el){
    var v = el.getAttribute('data-i18n-' + lang + '-ph');
    if (v != null) el.setAttribute('placeholder', v);
  });
  // <title>
  var t = root.querySelector ? root.querySelector('title[data-i18n-de]') : null;
  if (t) { var tv = t.getAttribute('data-i18n-' + lang); if (tv != null) document.title = tv; }
};

/* Schwebender DE/EN-Schalter. onToggle wird NACH dem Sprachwechsel aufgerufen. */
function buildLangToggle(onToggle){
  var existing = document.getElementById('langtoggle');
  if (existing) return existing;
  var b = document.createElement('button');
  b.id = 'langtoggle';
  b.type = 'button';
  b.className = 'langtoggle';
  function paint(){
    b.innerHTML =
      '<span class="lt-opt ' + (I18N.lang === 'de' ? 'on' : '') + '">DE</span>' +
      '<span class="lt-sep">/</span>' +
      '<span class="lt-opt ' + (I18N.lang === 'en' ? 'on' : '') + '">EN</span>';
    b.setAttribute('aria-label', tr('Sprache wechseln (Deutsch/Englisch)', 'Switch language (German/English)'));
    b.setAttribute('title', tr('Sprache: Deutsch', 'Language: English'));
  }
  paint();
  b.onclick = function(){
    I18N.toggle();
    paint();
    if (onToggle) onToggle(I18N.lang);
  };
  // Mitzeichnen, falls die Sprache anderswo geändert wird
  I18N.onChange(function(){ paint(); });
  document.body.appendChild(b);
  return b;
}

/* Export für Node (Tests), schadet im Browser nicht */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { I18N: I18N, tr: tr, L: L };
}
