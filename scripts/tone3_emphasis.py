# -*- coding: utf-8 -*-
"""Exaggerate the falling-rising (3rd) tone of a pinyin recording.

Microsoft's zh-CN voices render tone 3 as a shallow dip, so learners cannot
hear the difference from tone 2. This module re-synthesises the clip with a
TD-PSOLA style pitch contour: down, a short hold at the bottom, then up.

Usage (standalone, re-process every existing tone-3 file):
    python scripts/tone3-emphasis.py
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

# Pitch multiplier along the syllable (0 = start, 1 = end).
CONTOUR = ((0.0, 1.0), (0.18, 0.9), (0.38, 0.76), (0.66, 0.76), (0.85, 1.05), (1.0, 1.42))


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

    # Fill gaps with the nearest voiced value and smooth.
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
    """Rewrite ``path`` so its 3rd tone dips deeper and holds longer.

    TD-PSOLA with a pitch multiplier that follows :data:`CONTOUR`: grains are
    taken at the original period but laid out at ``period / factor``, so a
    factor below 1 both lowers the pitch and stretches the dip.
    """
    x = _decode(path)
    if len(x) < int(0.08 * SR):
        return False

    f0 = _f0_track(x)

    def f0_at(t):
        i = int(t / HOP_SEC)
        return float(f0[i]) if 0 <= i < len(f0) else 0.0

    duration = len(x) / SR
    # Output is longer than the input: integral of 1/factor, plus headroom.
    out = np.zeros(int(duration * 2.0 * SR) + int(0.08 * SR), dtype=np.float32)
    weight = np.zeros_like(out)

    pos = 0.0
    out_pos = 0.0
    while pos < duration:
        freq = f0_at(pos)
        period = 1.0 / freq if freq > 0 else 0.005
        half = max(8, int(period * SR))
        center = int(pos * SR)
        a, b = center - half, center + half
        if a < 0 or b > len(x):
            pos += period
            out_pos += period
            continue

        grain = x[a:b] * np.hanning(b - a)
        factor = _value_at(CONTOUR, pos / duration)
        target = int(out_pos * SR)
        ga, gb = target - half, target + half
        if gb > len(out):
            break

        out[ga:gb] += grain
        weight[ga:gb] += np.hanning(b - a)
        pos += period
        out_pos += period / factor

    mask = weight > 1e-3
    out[mask] /= weight[mask]
    out = out[: int(out_pos * SR) + int(0.02 * SR)]

    # Keep the perceived loudness in line with the other tones.
    rms_in = float(np.sqrt(np.mean(x ** 2)))
    rms_out = float(np.sqrt(np.mean(out ** 2))) if out.size else 0.0
    if rms_in > 0 and rms_out > 0:
        out *= min(1.35, rms_in / rms_out)

    peak = float(np.max(np.abs(out))) if out.size else 0.0
    if peak > 0.99:
        out *= 0.99 / peak

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
