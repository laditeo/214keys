# -*- coding: utf-8 -*-
import sys
from pathlib import Path
OLD, NEW = sys.argv[1], sys.argv[2]
FILES = ["index.html","basic/index.html","pynpinyin/index.html","js/app.js","js/catalog.js","js/radicalSfx.js","js/radicalSpeech.js","js/spatialCanvas.js","js/speakerParticles.js"]
for name in FILES:
    p = Path(name)
    with open(p, "r", encoding="utf-8", newline="") as fh: text = fh.read()
    updated = text.replace(f"v={OLD}", f"v={NEW}").replace(f'BUILD = "{OLD}"', f'BUILD = "{NEW}"')
    if updated != text:
        with open(p, "w", encoding="utf-8", newline="") as fh: fh.write(updated)
        print("bumped", name)
