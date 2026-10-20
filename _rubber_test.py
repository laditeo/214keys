# -*- coding: utf-8 -*-
"""Test rubberband formant-preserved pitch on the first half of a tone-3 file."""
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FFMPEG = ROOT / "node_modules" / "ffmpeg-static" / "ffmpeg.exe"
SRC = ROOT / "audio" / "pinyin" / "cn" / "360-3.mp3"
OUT = ROOT / "_rubber_test.mp3"

# Split: first half pitch down (formant preserved), second half untouched, crossfade.
# Use ffmpeg filter: trim first half, rubberband, then concat with crossfade.
cmd = [
    str(FFMPEG), "-y", "-v", "error",
    "-i", str(SRC),
    "-filter_complex",
    "[0:a]asplit=2[a][b];"
    "[a]atrim=0:0.20,asetpts=PTS-STARTPTS,afade=t=out:st=0.12:d=0.08,rubberband=pitch=0.75:formant=1[low];"
    "[b]atrim=0.08,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.08[high];"
    "[low][high]acrossfade=d=0.08:c1=qsin:c2=qsin[out]",
    "-map", "[out]",
    "-codec:a", "libmp3lame", "-ar", "44100", "-ac", "1", "-b:a", "128k",
    str(OUT),
]
r = subprocess.run(cmd, capture_output=True, text=True)
print("rc", r.returncode)
print(r.stderr[:500])
print("size", OUT.stat().st_size if OUT.exists() else None)
