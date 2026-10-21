# -*- coding: utf-8 -*-
"""Generate js/devanagariItems.js — Devanagari akshara (syllabary) chart.

Ordering follows the traditional varnamala (aksharamala):
  * rows  — vowels, grouped short / long / diphthong / nasal
  * cols  — consonants in vargas of five (क, च, ट, त, प), then semivowels
            (य र ल व), sibilants (श ष स ह) and finally ळ क्ष ज्ञ
  * the first column holds the bare vowels (no consonant)
"""
from pathlib import Path

# (key, independent vowel, matra, romanization, group)
VOWELS = [
    ("a", "अ", "", "a", "short"),
    ("i", "इ", "ि", "i", "short"),
    ("u", "उ", "ु", "u", "short"),
    ("aa", "आ", "ा", "ā", "long"),
    ("ii", "ई", "ी", "ī", "long"),
    ("uu", "ऊ", "ू", "ū", "long"),
    ("e", "ए", "े", "e", "diphthong"),
    ("ai", "ऐ", "ै", "ai", "diphthong"),
    ("o", "ओ", "ो", "o", "diphthong"),
    ("au", "औ", "ौ", "au", "diphthong"),
    ("am", "अं", "ं", "aṃ", "nasal"),
    ("ah", "अः", "ः", "aḥ", "nasal"),
]

# Consonants in varga order: (devanagari, romanization, russian)
CONSONANTS = [
    ("क", "k", "к"),
    ("ख", "kh", "кх"),
    ("ग", "g", "г"),
    ("घ", "gh", "гх"),
    ("ङ", "ṅ", "нг"),
    ("च", "c", "ч"),
    ("छ", "ch", "чх"),
    ("ज", "j", "дж"),
    ("झ", "jh", "джх"),
    ("ञ", "ñ", "н"),
    ("ट", "ṭ", "т"),
    ("ठ", "ṭh", "тх"),
    ("ड", "ḍ", "д"),
    ("ढ", "ḍh", "дх"),
    ("ण", "ṇ", "н"),
    ("त", "t", "т"),
    ("थ", "th", "тх"),
    ("द", "d", "д"),
    ("ध", "dh", "дх"),
    ("न", "n", "н"),
    ("प", "p", "п"),
    ("फ", "ph", "пх"),
    ("ब", "b", "б"),
    ("भ", "bh", "бх"),
    ("म", "m", "м"),
    ("य", "y", "й"),
    ("र", "r", "р"),
    ("ल", "l", "л"),
    ("व", "v", "в"),
    ("श", "ś", "ш"),
    ("ष", "ṣ", "шь"),
    ("स", "s", "с"),
    ("ह", "h", "х"),
    ("ळ", "ḷ", "лл"),
    ("क्ष", "kṣ", "кш"),
    ("ज्ञ", "jñ", "джн"),
]

# Varga bands for the column header: (label, count, title)
VARGA_BANDS = [
    ("स्वर", 1, "самостоятельные гласные"),
    ("क-वर्ग", 5, "гортанные"),
    ("च-वर्ग", 5, "небные"),
    ("ट-वर्ग", 5, "retroflexные"),
    ("त-वर्ग", 5, "зубные"),
    ("प-वर्ग", 5, "губные"),
    ("अन्तःस्थ", 4, "полугласные"),
    ("ऊष्म", 4, "шипящие и х"),
    ("ळक्षज्ञ", 3, "другие"),
]

VOWEL_RU = {
    "a": "а", "i": "и", "u": "у", "aa": "аа", "ii": "ии", "uu": "уу",
    "e": "э", "ai": "эй", "o": "о", "au": "оу", "am": "ам", "ah": "ах",
}

items = []
idx = 1
for vkey, vdev, vmatra, vro, vgroup in VOWELS:
    items.append({
        "id": idx,
        "char": vdev,
        "cn": vro,
        "ru": f"гласная {VOWEL_RU[vkey]}",
        "group": f"{vgroup}:{vkey}",
        "category": vgroup,
        "initial": "",
        "consRoman": "",
        "vowelRoman": vro,
        "vowelDev": vdev,
        "speech": vdev,
    })
    idx += 1
    for cdev, crom, cru in CONSONANTS:
        syll = cdev if vkey == "a" else cdev + vmatra
        trans = crom + vro
        items.append({
            "id": idx,
            "char": syll,
            "cn": trans,
            "ru": f"согласная {cru} · гласная {VOWEL_RU[vkey]}",
            "group": f"{vgroup}:{vkey}",
            "category": vgroup,
            "initial": cdev,
            "consRoman": crom,
            "vowelRoman": vro,
            "vowelDev": vdev,
            "speech": syll,
        })
        idx += 1

out = Path("js/devanagariItems.js")
lines = ["export default ["]
body = []
for it in items:
    body.append(
        "  {"
        f'"id": {it["id"]}, '
        f'"char": "{it["char"]}", '
        f'"cn": "{it["cn"]}", '
        f'"ru": "{it["ru"]}", '
        f'"group": "{it["group"]}", '
        f'"category": "{it["category"]}", '
        f'"initial": "{it["initial"]}", '
        f'"consRoman": "{it["consRoman"]}", '
        f'"vowelRoman": "{it["vowelRoman"]}", '
        f'"vowelDev": "{it["vowelDev"]}", '
        f'"speech": "{it["speech"]}", '
        '"strokes": 0, '
        '"variants": ""'
        "}"
    )
lines.append(",\n".join(body))
lines.append("];")
out.write_text("\n".join(lines), encoding="utf-8")

# Column header bands (used by the table builder)
band_lines = ["export const DEVANAGARI_BANDS = ["]
for label, count, title in VARGA_BANDS:
    band_lines.append(f'  {{ label: "{label}", count: {count}, title: "{title}" }},')
band_lines.append("];")
Path("js/devanagariBands.js").write_text("\n".join(band_lines), encoding="utf-8")

print("items:", len(items), "consonants:", len(CONSONANTS), "vowels:", len(VOWELS))
