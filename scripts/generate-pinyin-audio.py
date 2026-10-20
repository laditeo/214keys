# -*- coding: utf-8 -*-
"""Generate MP3 audio for every pinyin syllable of the pynpinyin catalog.

Voice: Microsoft Edge neural TTS (same Azure neural voices, no API key).
The syllable is fed as pinyin text, so every card is read in a consistent
first tone instead of inheriting the tone of the example character.
If a syllable produces no usable audio, the example hanzi is used instead.

Usage:
    python scripts/generate-pinyin-audio.py            # only missing files
    python scripts/generate-pinyin-audio.py --force    # regenerate everything
"""
import argparse
import asyncio
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
ITEMS_PATH = ROOT / "js" / "pinyinItems.js"
OUT_DIR = ROOT / "audio" / "pinyin" / "cn"
FFMPEG = ROOT / "node_modules" / "ffmpeg-static" / "ffmpeg.exe"

VOICE = "zh-CN-XiaoxiaoNeural"
CONCURRENCY = 4
RETRIES = 3
MIN_SECONDS = 0.12


def load_items():
    raw = ITEMS_PATH.read_text(encoding="utf-8")
    start = raw.index("[")
    end = raw.rindex("]") + 1
    return json.loads(raw[start:end])


def audio_seconds(path):
    """Duration of an mp3 via ffmpeg; 0 when unreadable."""
    if not FFMPEG.exists():
        return None
    result = subprocess.run(
        [str(FFMPEG), "-hide_banner", "-i", str(path)],
        capture_output=True,
    )
    text = result.stderr.decode("utf-8", "ignore")
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("Duration:"):
            stamp = line.split("Duration:")[1].split(",")[0].strip()
            try:
                hours, minutes, seconds = stamp.split(":")
                return int(hours) * 3600 + int(minutes) * 60 + float(seconds)
            except ValueError:
                return 0.0
    return 0.0


def finalize(path):
    """Trim leading/trailing silence and resample to 44.1 kHz for Safari/iOS."""
    if not FFMPEG.exists():
        return
    temp = path.with_suffix(".tmp.mp3")
    result = subprocess.run(
        [
            str(FFMPEG), "-y", "-v", "error", "-i", str(path),
            "-af",
            "silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB,"
            "areverse,"
            "silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB,"
            "areverse",
            "-codec:a", "libmp3lame", "-ar", "44100", "-ac", "1", "-b:a", "128k",
            str(temp),
        ],
        capture_output=True,
    )
    if result.returncode == 0 and temp.exists() and temp.stat().st_size > 0:
        temp.replace(path)
    elif temp.exists():
        temp.unlink()


async def synthesize(text, path):
    communicate = edge_tts.Communicate(text, VOICE)
    await communicate.save(str(path))


async def make_one(item, force, semaphore, report):
    target = OUT_DIR / f"{item['id']:03d}.mp3"
    if target.exists() and target.stat().st_size > 0 and not force:
        return "skip"

    async with semaphore:
        for attempt in range(1, RETRIES + 1):
            text = item["cn"]
            try:
                await synthesize(text, target)
                seconds = audio_seconds(target)
                if seconds is None or seconds >= MIN_SECONDS:
                    finalize(target)
                    report.append(f"ok {item['id']:03d} {item['cn']} via pinyin")
                    return "ok"

                # Fall back to the example character (rare syllables / "ê").
                await synthesize(item["char"], target)
                seconds = audio_seconds(target)
                if seconds is None or seconds >= MIN_SECONDS:
                    finalize(target)
                    report.append(f"ok {item['id']:03d} {item['cn']} via hanzi {item['char']}")
                    return "ok"
            except Exception as err:  # noqa: BLE001 - report and retry
                if attempt == RETRIES:
                    report.append(f"FAIL {item['id']:03d} {item['cn']}: {err}")
                    return "fail"
                await asyncio.sleep(0.6 * attempt)
        report.append(f"FAIL {item['id']:03d} {item['cn']}: silent audio")
        return "fail"


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="regenerate existing files")
    parser.add_argument(
        "--finalize-only",
        action="store_true",
        help="only trim silence and resample existing files",
    )
    args = parser.parse_args()

    items = load_items()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.finalize_only:
        files = sorted(OUT_DIR.glob("*.mp3"))
        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(finalize, files))
        print(f"finalized: {len(files)}")
        return

    semaphore = asyncio.Semaphore(CONCURRENCY)
    report = []

    results = await asyncio.gather(
        *(make_one(item, args.force, semaphore, report) for item in items)
    )

    ok = results.count("ok")
    skipped = results.count("skip")
    failed = results.count("fail")
    (ROOT / "pinyin_audio_report.txt").write_text("\n".join(report), encoding="utf-8")
    print(f"generated: {ok}, skipped: {skipped}, failed: {failed}")
    if failed:
        print("\n".join(report[-20:]))
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
