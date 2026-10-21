# -*- coding: utf-8 -*-
"""Generate js/devanagariItems.js — Devanagari akshara (syllabary) chart.

Ordering follows the traditional varnamala (aksharamala):
  * columns — vowels, grouped short / long / diphthong / nasal
  * rows    — consonants in vargas of five (क, च, ट, त, प), then the
              semivowels (य र ल व), sibilants (श ष स ह) and ळ क्ष ज्ञ
  * the first row holds the bare vowels (no consonant)

Names come in Russian and English (articulation included); frequencies are
from published Hindi letter-frequency tables (Wikipedia «वर्ण आवृत्ति»,
sttmedia letter frequency) and flag the most common aksharas.
"""
from pathlib import Path

# key, independent, matra, translit, ru, en, group, matra weight
VOWELS = [
    ("a", "अ", "", "a", "а", "a (as in about)", "short", 1.00),
    ("aa", "आ", "ा", "ā", "аа", "aa (father)", "long", 1.00),
    ("i", "इ", "ि", "i", "и", "i (sit)", "short", 0.40),
    ("ii", "ई", "ी", "ī", "ии", "ee (see)", "long", 0.45),
    ("u", "उ", "ु", "u", "у", "u (put)", "short", 0.18),
    ("uu", "ऊ", "ू", "ū", "уу", "oo (moon)", "long", 0.10),
    ("e", "ए", "े", "e", "э", "e (bed)", "diphthong", 0.85),
    ("ai", "ऐ", "ै", "ai", "ай", "ai (eye)", "diphthong", 0.25),
    ("o", "ओ", "ो", "o", "о", "o (over)", "diphthong", 0.30),
    ("au", "औ", "ौ", "au", "ау", "au (out)", "diphthong", 0.02),
    ("am", "अं", "ं", "aṃ", "ам", "am (anusvara)", "nasal", 0.44),
    ("ah", "अः", "ः", "aḥ", "ах", "ah (visarga)", "nasal", 0.01),
]

VOWEL_ART = {
    "short": "краткий",
    "long": "длинный",
    "diphthong": "двойной",
    "nasal": "назальный",
}

# glyph, translit, ru, en, varga, frequency %, артикуляция ru, en
CONSONANTS = [
    ("क", "k", "ка", "k (throat)", "velar", 7.14,
     "взрывной, безгласный", "plosive, unasp."),
    ("ख", "kh", "кх", "kh (throat)", "velar", 0.70,
     "взрывной, придыхательный", "plosive, asp."),
    ("ग", "g", "г", "g (throat)", "velar", 1.31,
     "взрывной, звонкий", "plosive, voiced."),
    ("घ", "gh", "гх", "gh (throat)", "velar", 0.20,
     "взрывной, звонкий придыхательный", "plosive, voiced asp."),
    ("ङ", "ṅ", "нг", "ng (throat)", "velar", 0.00,
     "носовой, безгласный", "nasal, unasp."),
    ("च", "c", "ч", "ch (roof)", "palatal", 1.16,
     "аффрикат, безгласный", "affricate, unasp."),
    ("छ", "ch", "чх", "chh (roof)", "palatal", 0.45,
     "аффрикат, придыхательный", "affricate, asp."),
    ("ज", "j", "дж", "j (roof)", "palatal", 1.39,
     "аффрикат, звонкий", "affricate, voiced."),
    ("झ", "jh", "джх", "jh (roof)", "palatal", 0.19,
     "аффрикат, звонкий придыхательный", "affricate, voiced asp."),
    ("ञ", "ñ", "нь", "ny (roof)", "palatal", 0.01,
     "носовой", "nasal."),
    ("ट", "ṭ", "т", "ṭ (retroflex)", "retroflex", 0.57,
     "взрывной, безгласный, церебральный", "plosive, unasp."),
    ("ठ", "ṭh", "тх", "ṭh (retroflex)", "retroflex", 0.17,
     "взрывной, придыхательный, церебральный", "plosive, asp."),
    ("ड", "ḍ", "д", "ḍ (retroflex)", "retroflex", 0.75,
     "взрывной, звонкий, церебральный", "plosive, voiced."),
    ("ढ", "ḍh", "дх", "ḍh (retroflex)", "retroflex", 0.09,
     "взрывной, звонкий придыхательный, церебральный", "plosive, voiced asp."),
    ("ण", "ṇ", "н", "ṇ (retroflex)", "retroflex", 0.13,
     "носовой, церебральный", "nasal."),
    ("त", "t", "т", "t (teeth)", "dental", 2.89,
     "взрывной, безгласный, зубной", "plosive, unasp."),
    ("थ", "th", "тх", "th (teeth)", "dental", 1.15,
     "взрывной, придыхательный, зубной", "plosive, asp."),
    ("द", "d", "д", "d (teeth)", "dental", 1.68,
     "взрывной, звонкий, зубной", "plosive, voiced."),
    ("ध", "dh", "дх", "dh (teeth)", "dental", 0.36,
     "взрывной, звонкий придыхательный, зубной", "plosive, voiced asp."),
    ("न", "n", "н", "n (teeth)", "dental", 3.48,
     "носовой, зубной", "nasal."),
    ("प", "p", "п", "p (lips)", "labial", 2.66,
     "взрывной, безгласный, губной", "plosive, unasp."),
    ("फ", "ph", "пх", "ph (lips)", "labial", 0.35,
     "взрывной, придыхательный, губной", "plosive, asp."),
    ("ब", "b", "б", "b (lips)", "labial", 1.78,
     "взрывной, звонкий, губной", "plosive, voiced."),
    ("भ", "bh", "бх", "bh (lips)", "labial", 0.67,
     "взрывной, звонкий придыхательный, губной", "plosive, voiced asp."),
    ("म", "m", "м", "m (lips)", "labial", 3.28,
     "носовой, губной", "nasal."),
    ("य", "y", "й", "y (semivowel)", "antahstha", 2.20,
     "полугласный, небный", "approximant, palatal."),
    ("र", "r", "р", "r (semivowel)", "antahstha", 5.91,
     "полугласный, язычный", "approximant, apical."),
    ("ल", "l", "л", "l (semivowel)", "antahstha", 2.45,
     "полугласный, язычный", "approximant, dental."),
    ("व", "v", "в", "v (semivowel)", "antahstha", 1.62,
     "полугласный, губной", "approximant, labial."),
    ("श", "ś", "ш", "sh (sibilant)", "ushma", 0.76,
     "фрикативный, небный", "fricative, palatal."),
    ("ष", "ṣ", "шь", "ṣ (sibilant)", "ushma", 0.27,
     "фрикативный, язычный", "fricative, retroflex."),
    ("स", "s", "с", "s (sibilant)", "ushma", 3.78,
     "фрикативный, зубной", "fricative, dental."),
    ("ह", "h", "х", "h (aspirate)", "ushma", 4.82,
     "придыхательный, гортанный", "aspirate, glottal."),
    ("ळ", "ḷ", "лл", "ḷ (rare)", "other", 0.00,
     "полугласный, ретрозубной", "approximant, retroflex."),
    ("क्ष", "kṣ", "кш", "ksh (conjunct)", "other", 0.05,
     "аффрикат, сложный", "conjunct, complex."),
    ("ज्ञ", "jñ", "джн", "gy (conjunct)", "other", 0.02,
     "аффрикат, сложный", "conjunct, complex."),
]

# varga -> (devanagari, russian, english)
VARGAS = [
    ("velar", "क-वर्ग", "гортанные", "velars (throat)"),
    ("palatal", "च-वर्ग", "небные", "palatals (roof)"),
    ("retroflex", "ट-वर्ग", "церебральные", "retroflexes"),
    ("dental", "त-वर्ग", "зубные", "dentals (teeth)"),
    ("labial", "प-वर्ग", "губные", "labials (lips)"),
    ("antahstha", "अन्तःस्थ", "полугласные", "semivowels"),
    ("ushma", "ऊष्म", "шипящие", "sibilants"),
    ("other", "ळ क्ष ज्ञ", "прочие", "others"),
]

TOP_COUNT = 50

items = []


def add(idx, **fields):
    fields["id"] = idx
    fields.setdefault("strokes", 0)
    fields.setdefault("variants", "")
    items.append(fields)


idx = 1
# Самостоятельные гласные — верхняя строка таблицы.
for vkey, vdev, vmatra, vro, vru, ven, vgroup, vweight in VOWELS:
    add(
        idx,
        char=vdev,
        cn=vro,
        ru=f"гласная {vru} — {VOWEL_ART[vgroup]}",
        group=f"{vgroup}:{vkey}",
        groupLabel="Самостоятельные гласные",
        category=vgroup,
        initial="",
        consRoman="",
        consRu="",
        consEn="",
        consArtRu="",
        consArtEn="",
        varga="vowel",
        vowelRoman=vro,
        vowelRu=vru,
        vowelEn=ven,
        vowelArtRu=VOWEL_ART[vgroup],
        vowelDev=vdev,
        speech=vdev,
        freq=round(vweight * 6.0, 3),
    )
    idx += 1

for vkey, vdev, vmatra, vro, vru, ven, vgroup, vweight in VOWELS:
    for cdev, crom, cru, cen, varga, cfreq, art_ru, art_en in CONSONANTS:
        syll = cdev if vkey == "a" else cdev + vmatra
        add(
            idx,
            char=syll,
            cn=crom + vro,
            ru=f"согласная {cru} ({crom}) — {art_ru}; гласная {vru} ({vro}) — {VOWEL_ART[vgroup]}",
            group=f"{vgroup}:{vkey}",
            groupLabel="Самостоятельные гласные",
            category=vgroup,
            initial=cdev,
            consRoman=crom,
            consRu=cru,
            consEn=cen,
            consArtRu=art_ru,
            consArtEn=art_en,
            varga=varga,
            vowelRoman=vro,
            vowelRu=vru,
            vowelEn=ven,
            vowelArtRu=VOWEL_ART[vgroup],
            vowelDev=vdev,
            speech=syll,
            freq=round(cfreq * vweight, 3),
        )
        idx += 1

# Ранг по частоте: чем выше, тем употребительнее слог.
ordered = sorted(items, key=lambda it: (-it["freq"], it["id"]))
for rank, item in enumerate(ordered, start=1):
    item["rank"] = rank
    item["popular"] = rank <= TOP_COUNT

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
        f'"groupLabel": "{it["groupLabel"]}", '
        f'"category": "{it["category"]}", '
        f'"initial": "{it["initial"]}", '
        f'"consRoman": "{it["consRoman"]}", '
        f'"consRu": "{it["consRu"]}", '
        f'"consEn": "{it["consEn"]}", '
        f'"consArtRu": "{it["consArtRu"]}", '
        f'"consArtEn": "{it["consArtEn"]}", '
        f'"varga": "{it["varga"]}", '
        f'"vowelRoman": "{it["vowelRoman"]}", '
        f'"vowelRu": "{it["vowelRu"]}", '
        f'"vowelEn": "{it["vowelEn"]}", '
        f'"vowelArtRu": "{it["vowelArtRu"]}", '
        f'"vowelDev": "{it["vowelDev"]}", '
        f'"speech": "{it["speech"]}", '
        f'"freq": {it["freq"]}, '
        f'"rank": {it["rank"]}, '
        f'"popular": {"true" if it["popular"] else "false"}, '
        f'"strokes": 0, '
        f'"variants": ""'
        "}"
    )
lines.append(",\n".join(body))
lines.append("];")
out.write_text("\n".join(lines), encoding="utf-8")

# Полосы варг для шапки таблицы.
band_lines = ["export const DEVANAGARI_BANDS = ["]
for vkey, dev, ru, en in VARGAS:
    band_lines.append(f'  {{ id: "{vkey}", label: "{dev}", ru: "{ru}", en: "{en}" }},')
band_lines.append("];")
Path("js/devanagariBands.js").write_text("\n".join(band_lines), encoding="utf-8")

top = [it for it in items if it["popular"]]
print("items:", len(items), "top:", len(top))
print("top:", ", ".join(it["cn"] for it in sorted(top, key=lambda x: x["rank"])[:30]))
