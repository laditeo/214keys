# -*- coding: utf-8 -*-
import subprocess, wave, numpy as np
from pathlib import Path
ROOT = Path('.')
FFMPEG = ROOT/'node_modules/ffmpeg-static/ffmpeg.exe'
p = ROOT/'_rubber_test.mp3'
wav = p.with_suffix('.chk.wav')
subprocess.run([str(FFMPEG),'-y','-v','error','-i',str(p),'-ac','1','-ar','16000',str(wav)],check=True,capture_output=True)
with wave.open(str(wav)) as w: d=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
wav.unlink()
peak=np.max(np.abs(d)); idx=np.where(np.abs(d)>0.02*peak)[0]; d=d[idx[0]:idx[-1]+1]
j=np.abs(np.diff(d))
print('p999_jump=%.4f (rms=%.3f)'%(np.percentile(j,99.9), np.sqrt(np.mean(d**2))))
# find max jump location
k=int(np.argmax(j))
print('max jump at %.3fs (%.4f)'%(k/16000, j[k]))
"