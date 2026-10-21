# -*- coding: utf-8 -*-
"""Check that the Devanagari recordings match the syllables in the items file.

The file name is derived from the item id, so any reordering of the data
silently breaks the audio. This script re-derives the expected id -> syllable
mapping and compares it with the manifest written by the generator.
"""
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "js" / "devanagariItems.js"
MANIFEST = ROOT / "audio" / "devanagari" / "female" / "manifest.tsv"

raw = ITEMS.read_text(encoding="utf-8")
items = json.loads(raw[raw.index("["): raw.rindex("]") + 1])

expected = {}
for it in items:
    expected[f"{int(it['id']):03d}-1"] = it["speech"]

if not MANIFEST.exists():
    print("FAIL: нет манифеста", MANIFEST)
    sys.exit(1)

actual = {}
for line in MANIFEST.read_text(encoding="utf-8").splitlines():
    key, _, text = line.partition("\t")
    actual[key] = text

bad = [k for k, v in expected.items() if actual.get(k) != v]
missing = [k for k in expected if k not in actual]

print("items:", len(expected), "manifest:", len(actual))
if missing:
    print("FAIL: нет записей", missing[:10])
if bad:
    print("FAIL: расхождений", len(bad))
    for k in bad[:10]:
        print("  ", k, "ожидалось", expected[k], "в манифесте", actual.get(k))
    sys.exit(1)

# Проверяем, что файлы на месте.
missing_files = [k for k in expected if not (MANIFEST.parent / f"{k}.mp3").exists()]
if missing_files:
    print("FAIL: нет файлов", len(missing_files), missing_files[:10])
    sys.exit(1)

print("OK: записи совпадают с таблицей, все файлы на месте")
