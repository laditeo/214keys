# -*- coding: utf-8 -*-
"""Exaggerate the falling-rising (3rd) tone of a pinyin recording.

Uses a smooth time-varying resample (vinyl-style): the playback speed follows
the pitch contour, so the pitch goes down and back up without any grain
boundaries or ring-modulation artefacts. Formants move with the pitch, exactly
like speeding up / slowing down a tape.
"""
import subprocess
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
FFMPEG = ROOT / "node_modules" / "ffmpeg-static" / "ffmpeg.exe"
SR = 16000
HOP_SEC = 0.005
WIN_SEC = 0.04

GAIN = 1.25

# Pitch multiplier on the *voiced* part (0 = vowel onset, 1 = end):
CONTOUR = ((0.0, 1.0), (0.10, 0.9), (0.25, 0.8), (0.45, 0.8), (0.55, 1.0), (1.0, 1.0))


def _decode(path):
    wav = path.with_suffix(".psola.wav")
    subprocess.run(
        [str(FFMPEG), "-y", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), str(wav)],
        check=True, capture_output=True,
    )
    with wave.open(str(wav)) as handle:
        data = np.frombuffer(handle.readframes(handle.getnframes()), dtype=np.int16)
    wav.unlink()
    return data.astype(np.float32) / 32768.0


def _encode(samples, path):
    wav = path.with_suffix(".psola.wav")
    with wave.open(str(wav), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes((np.clip(samples, -1.0, 1.0) * 32767).astype(np.int16).tobytes())
    subprocess.run(
        [str(FFMPEG), "-y", "-v", "error", "-i", str(wav),
         "-codec:a", "libmp3lame", "-ar", "44100", "-ac", "1", "-b:a", "128k",
         str(path)],
        check=True, capture_output=True,
    )
    wav.unlink()


def _f0_track(x):
    hop = int(HOP_SEC * SR)
    win = int(WIN_SEC * SR)
    frames = max(0, 1 + (len(x) - win) // hop)
    f0 = np.zeros(frames, dtype=np.float32)
    for i in range(frames):
        seg = x[i * hop: i * hop + win]
        if len(seg) < win:
            break
        seg = seg - seg.mean()
        if np.sqrt(np.mean(seg ** 2)) < 0.008:
            continue
        corr = np.correlate(seg, seg, mode="full")[len(seg) - 1:]
        corr /= max(corr[0], 1e-9)
        lo, hi = int(SR / 420), min(len(corr) - 1, int(SR / 70))
        peak = lo + int(np.argmax(corr[lo:hi]))
        if corr[peak] > 0.32:
            f0[i] = SR / peak
    if not f0.any():
        return f0
    idx = np.where(f0 > 0)[0]
    filled = np.interp(np.arange(frames), idx, f0[idx])
    kernel = np.ones(3) / 3
    return np.convolve(filled, kernel, mode="same")


def _value_at(points, u):
    u = min(1.0, max(0.0, u))
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        if u <= x1:
            span = x1 - x0 or 1e-6
            return y0 + (y1 - y0) * (u - x0) / span
    return points[-1][1]


def emphasize(path):
    x = _decode(path)
    if len(x) < int(0.08 * SR):
        return False

    f0 = _f0_track(x)
    duration = len(x) / SR

    # Voiced onset.
    voiced_frames = np.where(f0 > 0)[0]
    if len(voiced_frames):
        onset = voiced_frames[0] * HOP_SEC
    else:
        onset = 0.0
    voiced_span = max(0.05, duration - onset)

    def factor_at(t):
        if t < onset:
            return 1.0
        rel = (t - onset) / voiced_span
        return _value_at(CONTOUR, rel)

    # Vinyl resample: output time s -> input time u, with du/ds = factor(u).
    # Integrate to get the output length (stops when u reaches duration).
    out = []
    u = 0.0
    max_out = int(duration * 2.0 * SR)  # safety
    while u < duration and len(out) < max_out:
        i0 = int(u * SR)
        i1 = min(i0 + 1, len(x) - 1)
        frac = u * SR - i0
        val = x[i0] * (1 - frac) + x[i1] * frac
        out.append(val)
        p = factor_at(u)
        u += p / SR

    out = np.asarray(out, dtype=np.float32)
    if not out.size:
        return False

    rms_in = float(np.sqrt(np.mean(x ** 2)))
    rms_out = float(np.sqrt(np.mean(out ** 2))) if out.size else 0.0
    if rms_in > 0 and rms_out > 0:
        out *= rms_in / rms_out * GAIN

    peak = float(np.max(np.abs(out))) if out.size else 0.0
    if peak > 0.97:
        out *= 0.97 / peak

    _encode(out, path)
    return True


def main():
    files = sorted((ROOT / "audio" / "pinyin" / "cn").glob("*-3.mp3"))
    done = 0
    for path in files:
        if emphasize(path):
            done += 1
    print(f"emphasized: {done}/{len(files)}")


if __name__ == "__main__":
    main()
