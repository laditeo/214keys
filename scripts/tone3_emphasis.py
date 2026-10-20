# -*- coding: utf-8 -*-
"""Exaggerate the falling-rising (3rd) tone of a pinyin recording.

Microsoft's zh-CN voices render tone 3 as a shallow dip, so learners cannot
hear the difference from tone 2. This module re-synthesises the clip with a
TD-PSOLA style contour: a long fall, a clear hold at the bottom, then a short
rise that still ends below the starting pitch.

Time and pitch are controlled independently: the output is stretched by
:data:`STRETCH` (grain repetition) while the pitch multiplier comes from
:data:`CONTOUR`, so the syllable can be made slow *and* deep without turning
into a different voice.

Usage (standalone, re-process every existing tone-3 file):
    python scripts/tone3_emphasis.py
Do not run it twice on the same files: the effect compounds.
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

# How much longer the 3rd tone becomes compared to the raw TTS clip.
STRETCH = 1.55
# Loudness compensation: the low hold sounds quieter than the other tones.
GAIN = 1.3

# Pitch multiplier along the syllable (0 = start, 1 = end).
# 1.0 -> 0.70 (deep fall) -> hold -> 0.95 (short rise, below the start).
CONTOUR = ((0.0, 1.0), (0.12, 0.9), (0.30, 0.7), (0.64, 0.7), (0.84, 0.78), (1.0, 0.95))


def _decode(path):
    wav = path.with_suffix(".psola.wav")
    subprocess.run(
        [str(FFMPEG), "-y", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), str(wav)],
        check=True,
        capture_output=True,
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
        [
            str(FFMPEG), "-y", "-v", "error", "-i", str(wav),
            "-codec:a", "libmp3lame", "-ar", "44100", "-ac", "1", "-b:a", "128k",
            str(path),
        ],
        check=True,
        capture_output=True,
    )
    wav.unlink()


def _f0_track(x):
    """Frame-wise F0 (Hz), 0 where the frame is unvoiced/silent."""
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


def _grains(f0, duration):
    """Pitch-synchronous grain centres (seconds) and their periods."""
    centers = []
    periods = []
    t = 0.0
    while t < duration:
        index = int(t / HOP_SEC)
        freq = float(f0[index]) if 0 <= index < len(f0) else 0.0
        period = 1.0 / freq if freq > 0 else 0.005
        centers.append(t)
        periods.append(period)
        t += period
    return np.asarray(centers, dtype=np.float32), np.asarray(periods, dtype=np.float32)


def emphasize(path):
    """Rewrite ``path`` so its 3rd tone falls deep, holds and then rises."""
    x = _decode(path)
    if len(x) < int(0.08 * SR):
        return False

    f0 = _f0_track(x)
    duration = len(x) / SR
    target = duration * STRETCH

    centers, periods = _grains(f0, duration)
    if not len(centers):
        return False

    out = np.zeros(int(target * SR) + int(0.1 * SR), dtype=np.float32)
    weight = np.zeros_like(out)

    out_pos = 0.0
    cursor = 0
    last = len(centers) - 1
    while out_pos < target:
        # Content position for this output moment, snapped to a pitch period.
        wanted = out_pos / STRETCH
        while cursor < last and centers[cursor + 1] <= wanted:
            cursor += 1
        if cursor < last and abs(centers[cursor + 1] - wanted) < abs(centers[cursor] - wanted):
            index = cursor + 1
        else:
            index = cursor

        center = float(centers[index])
        period = float(periods[index])
        half = max(8, int(period * SR))
        start = int(center * SR) - half
        if start < 0 or start + 2 * half > len(x):
            out_pos += period
            continue

        grain = x[start: start + 2 * half] * np.hanning(2 * half)
        factor = _value_at(CONTOUR, center / duration)
        at = int(out_pos * SR) - half
        if at + 2 * half > len(out):
            break

        out[at: at + 2 * half] += grain
        weight[at: at + 2 * half] += np.hanning(2 * half)
        out_pos += period / factor

    mask = weight > 1e-3
    out[mask] /= weight[mask]
    out = out[: int(min(target, out_pos) * SR) + int(0.02 * SR)]

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
