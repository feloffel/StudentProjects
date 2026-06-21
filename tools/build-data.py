#!/usr/bin/env python3
"""Bettet die Roh-CSV als JS-String ein, damit die Seite auch lokal
(per Doppelklick, ohne Server) funktioniert.

Aufruf:  python3 tools/build-data.py
Liest:   data/rohdaten_alle.csv   (einfach diese Datei ersetzen, um neue Daten einzuspielen)
Schreibt: data/dataset.js
"""
import pathlib, datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
csv_path = ROOT / "data" / "rohdaten_alle.csv"
out_path = ROOT / "data" / "dataset.js"

raw = csv_path.read_text(encoding="utf-8")
# Backticks / Backslashes / ${ entschaerfen, da wir ein JS-Template-Literal nutzen
safe = raw.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")

stamp = datetime.date.today().isoformat()
js = (
    "// AUTOMATISCH GENERIERT von tools/build-data.py — nicht von Hand bearbeiten.\n"
    f"// Quelle: data/rohdaten_alle.csv  ·  Stand: {stamp}\n"
    "window.TETRIS_CSV = `" + safe + "`;\n"
)
out_path.write_text(js, encoding="utf-8")
print(f"OK  ->  {out_path}  ({len(raw):,} Zeichen CSV eingebettet)")
