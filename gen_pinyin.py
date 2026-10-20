# -*- coding: utf-8 -*-
"""Generate pinyin syllable items for the pynpinyin catalog.

Source of valid initial/final combinations: Wikipedia "Pinyin table"
(ISO 7098 / 现代汉语词典). Hanzi examples: pinyin-json (hanzidb, GPL-3.0).
"""
import json
from pathlib import Path

GROUP_FINALS = {
    "a": ["a", "o", "e", "ê", "ai", "ei", "ao", "ou", "an", "en", "ang", "eng", "er"],
    "i": ["i", "ia", "io", "ie", "iao", "iu", "ian", "in", "iang", "ing"],
    "u": ["u", "ua", "uo", "uai", "ui", "uan", "un", "uang", "ong"],
    "ü": ["ü", "üe", "üan", "ün", "iong"],
}

# Valid initials for each final (standard putonghua, rare/regional forms omitted).
VALID_INITIALS = {
    "a": ["b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "zh", "ch", "sh", "z", "c", "s"],
    "o": ["b", "p", "m", "f"],
    "e": ["m", "d", "t", "n", "l", "g", "k", "h", "zh", "ch", "sh", "r", "z", "c", "s"],
    "ê": [],
    "ai": ["b", "p", "m", "d", "t", "n", "l", "g", "k", "h", "zh", "ch", "sh", "z", "c", "s"],
    "ei": ["b", "p", "m", "f", "d", "n", "l", "g", "h", "zh", "sh", "z"],
    "ao": ["b", "p", "m", "d", "t", "n", "l", "g", "k", "h", "zh", "ch", "sh", "r", "z", "c", "s"],
    "ou": ["p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "zh", "ch", "sh", "r", "z", "c", "s"],
    "an": ["b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "zh", "ch", "sh", "r", "z", "c", "s"],
    "en": ["b", "p", "m", "f", "d", "n", "g", "k", "h", "zh", "ch", "sh", "r", "z", "c", "s"],
    "ang": ["b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "zh", "ch", "sh", "r", "z", "c", "s"],
    "eng": ["b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "zh", "ch", "sh", "r", "z", "c", "s"],
    "er": [],
    "i": ["b", "p", "m", "d", "t", "n", "l", "j", "q", "x"],
    "ia": ["j", "q", "x"],
    "io": [],
    "ie": ["b", "p", "m", "d", "t", "n", "l", "j", "q", "x"],
    "iao": ["b", "p", "m", "d", "t", "n", "l", "j", "q", "x"],
    "iu": ["m", "d", "n", "l", "j", "q", "x"],
    "ian": ["b", "p", "m", "d", "t", "n", "l", "j", "q", "x"],
    "in": ["b", "p", "m", "n", "l", "j", "q", "x"],
    "iang": ["n", "l", "j", "q", "x"],
    "ing": ["b", "p", "m", "d", "t", "n", "l", "j", "q", "x"],
    "u": ["b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "zh", "ch", "sh", "r", "z", "c", "s"],
    "ua": ["g", "k", "h", "zh", "ch", "sh"],
    "uo": ["d", "t", "n", "l", "g", "k", "h", "zh", "ch", "sh", "r", "z", "c", "s"],
    "uai": ["g", "k", "h", "zh", "ch", "sh"],
    "ui": ["d", "t", "g", "k", "h", "zh", "ch", "sh", "r", "z", "c", "s"],
    "uan": ["d", "t", "n", "l", "g", "k", "h", "zh", "ch", "sh", "r", "z", "c", "s"],
    "un": ["d", "t", "n", "l", "g", "k", "h", "zh", "ch", "sh", "r", "z", "c", "s"],
    "uang": ["g", "k", "h", "zh", "ch", "sh"],
    "ong": ["d", "t", "n", "l", "g", "k", "h", "zh", "ch", "r", "z", "c", "s"],
    "ü": ["n", "l", "j", "q", "x"],
    "üe": ["n", "l", "j", "q", "x"],
    "üan": ["j", "q", "x"],
    "ün": ["j", "q", "x"],
    "iong": ["j", "q", "x"],
}

# Syllables written without an initial.
NO_INITIAL = {
    "a": "a", "o": "o", "e": "e", "ê": "ê",
    "ai": "ai", "ei": "ei", "ao": "ao", "ou": "ou",
    "an": "an", "en": "en", "ang": "ang", "eng": "eng", "er": "er",
    "i": "yi", "ia": "ya", "io": "yo", "ie": "ye",
    "iao": "yao", "iu": "you", "ian": "yan", "in": "yin",
    "iang": "yang", "ing": "ying",
    "u": "wu", "ua": "wa", "uo": "wo", "uai": "wai", "ui": "wei",
    "uan": "wan", "un": "wen", "uang": "wang", "ong": "weng",
    "ü": "yu", "üe": "yue", "üan": "yuan", "ün": "yun", "iong": "yong",
}

# zhi chi shi ri zi ci si: written with i, but the final is apical [ʅ]/[ɿ].
WHOLE_SYLLABLES = [("zh", "zhi"), ("ch", "chi"), ("sh", "shi"), ("r", "ri"),
                   ("z", "zi"), ("c", "ci"), ("s", "si")]

# The hanzi dictionary spells ü as v.
SYLLABLE_ALIASES = {
    "nü": "nv", "lü": "lv", "nüe": "nve", "lüe": "lve",
}

# Orthography: after j/q/x the umlaut is dropped (ju, que, xuan, jun).
UMLAUT_DROP_INITIALS = {"j", "q", "x"}

# Rare syllables missing from the frequency dictionary (现代汉语词典 forms).
RARE_HANZI = {
    "ê": "欸", "zhei": "这", "den": "扽", "eng": "鞥", "chua": "欻",
    "nun": "黁", "nüe": "虐", "lüe": "略",
}


def spell(initial, final):
    """Return the written pinyin syllable for an initial + final pair."""
    if initial in UMLAUT_DROP_INITIALS:
        final = final.replace("ü", "u")
    return initial + final


def written_final(final, initial):
    if initial in UMLAUT_DROP_INITIALS:
        return final.replace("ü", "u")
    return final

INITIAL_LABELS = {
    "b": "b", "p": "p", "m": "m", "f": "f", "d": "d", "t": "t", "n": "n",
    "l": "l", "g": "g", "k": "k", "h": "h", "j": "j", "q": "q", "x": "x",
    "zh": "zh", "ch": "ch", "sh": "sh", "r": "r", "z": "z", "c": "c", "s": "s",
}


def load_hanzi_table():
    path = Path(__file__).parent / "data" / "pinyin_hanzi.json"
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def hanzi_for(table, syllable):
    hanzis = table.get(SYLLABLE_ALIASES.get(syllable, syllable), [])
    if hanzis:
        return hanzis
    rare = RARE_HANZI.get(syllable)
    return [rare] if rare else []


def make_item(item_id, syllable, initial, final, group, table):
    hanzis = hanzi_for(table, syllable)
    if not hanzis:
        return None

    char = hanzis[0]
    if group == "special":
        note = f"целый слог {syllable}"
    elif initial:
        note = f"инициаль {INITIAL_LABELS[initial]} · финаль {written_final(final, initial)}"
    else:
        note = f"без инициали · финаль {final}"

    return {
        "id": item_id,
        "char": char,
        "variants": "",
        "strokes": 0,
        "cn": syllable,
        "ru": note,
        "category": group,
        "group": f"{group}:{final}",
        "groupLabel": f"Финаль {final}" if group != "special" else "Целые слоги",
    }


def generate_items():
    table = load_hanzi_table()
    items = []
    seen = set()

    for group, finals in GROUP_FINALS.items():
        for final in finals:
            syllable = NO_INITIAL.get(final)
            if syllable and syllable not in seen:
                item = make_item(len(items) + 1, syllable, "", final, group, table)
                if item:
                    seen.add(syllable)
                    items.append(item)

            for initial in VALID_INITIALS.get(final, []):
                syllable = spell(initial, final)
                if syllable in seen:
                    continue
                item = make_item(len(items) + 1, syllable, initial, final, group, table)
                if item:
                    seen.add(syllable)
                    items.append(item)

    for initial, syllable in WHOLE_SYLLABLES:
        if syllable in seen:
            continue
        item = make_item(len(items) + 1, syllable, initial, "i", "special", table)
        if item:
            seen.add(syllable)
            items.append(item)

    return items


def main():
    items = generate_items()
    out_dir = Path(__file__).parent / "js"
    out_dir.mkdir(parents=True, exist_ok=True)

    with open(out_dir / "pinyinItems.js", "w", encoding="utf-8") as f:
        f.write("export default ")
        json.dump(items, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    with open(Path(__file__).parent / "pinyin_gen_summary.txt", "w", encoding="utf-8") as f:
        f.write(f"Generated {len(items)} pinyin items\n")
        for group in ["a", "i", "u", "ü", "special"]:
            count = sum(1 for item in items if item["category"] == group)
            f.write(f"  {group}: {count}\n")
    print(f"Generated {len(items)} pinyin items")


if __name__ == "__main__":
    main()
