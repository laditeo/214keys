# -*- coding: utf-8 -*-
"""Generate MP3 audio for every pinyin syllable of the pynpinyin catalog.

Voice: Microsoft Edge neural TTS (same Azure neural voices, no API key).
Each syllable is synthesized four times, once per tone, from its tone-marked
pinyin form ("zhuāng", "zhuáng", "zhuǎng", "zhuàng"), so the recording always
has the right contour. Files: ``audio/pinyin/cn/<id>-<tone>.mp3``.

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

from tone3_emphasis import emphasize

ROOT = Path(__file__).resolve().parent.parent
ITEMS_PATH = ROOT / "js" / "pinyinItems.js"
OUT_DIR = ROOT / "audio" / "pinyin" / "cn"
FFMPEG = ROOT / "node_modules" / "ffmpeg-static" / "ffmpeg.exe"

VOICE = "zh-CN-XiaoxiaoNeural"
CONCURRENCY = 6
RETRIES = 3
MIN_SECONDS = 0.12
TONES = (1, 2, 3, 4)


def load_items():
    raw = ITEMS_PATH.read_text(encoding="utf-8")
    start = raw.index("[")
    end = raw.rindex("]") + 1
    return json.loads(raw[start:end])


def tone_text(item, tone):
    speech = item.get("speech")
    if speech:
        return speech
    tones = item.get("tones") or []
    if len(tones) >= tone and tones[tone - 1]:
        return tones[tone - 1]
    return item["cn"]


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


async def make_one(item, tone, force, semaphore, report):
    target = OUT_DIR / f"{item['id']:03d}-{tone}.mp3"
    if target.exists() and target.stat().st_size > 0 and not force:
        return "skip"

    async with semaphore:
        for attempt in range(1, RETRIES + 1):
            text = tone_text(item, tone)
            try:
                await synthesize(text, target)
                seconds = audio_seconds(target)
                if seconds is None or seconds >= MIN_SECONDS:
                    finalize(target)
                    report.append(f"ok {item['id']:03d}-{tone} {text}")
                    return "ok"
            except Exception as err:  # noqa: BLE001 - report and retry
                if attempt == RETRIES:
                    report.append(f"FAIL {item['id']:03d}-{tone} {text}: {err}")
                    return "fail"
                await asyncio.sleep(0.6 * attempt)
        report.append(f"FAIL {item['id']:03d}-{tone} {text}: silent audio")
        return "fail"


def write_manifest(items, tones, out_dir):
    """Записываем id -> слог, чтобы потом проверить, что аудио совпадает с данными."""
    lines = []
    for item in items:
        for tone in tones:
            lines.append(f"{int(item['id']):03d}-{tone}\t{tone_text(item, tone)}")
    (out_dir / "manifest.tsv").write_text("\n".join(lines) + "\n", encoding="utf-8")


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="regenerate existing files")
    parser.add_argument(
        "--tones",
        default="",
        help="comma separated tone numbers to regenerate, e.g. 3",
    )
    parser.add_argument("--voice", default="", help="Edge TTS voice name")
    parser.add_argument("--out-dir", default="", help="output subdirectory under audio/<audio-root>")
    parser.add_argument("--audio-root", default="pinyin", help="folder under audio/, e.g. devanagari")
    parser.add_argument("--items", default="", help="items js filename under js/, e.g. devanagariItems.js")
    parser.add_argument("--ids", default="", help="comma separated syllable ids")
    parser.add_argument(
        "--finalize-only",
        action="store_true",
        help="only trim silence and resample existing files",
    )
    args = parser.parse_args()

    global OUT_DIR, VOICE, ITEMS_PATH
    if args.voice:
        VOICE = args.voice
    if args.out_dir:
        OUT_DIR = ROOT / "audio" / args.audio_root / args.out_dir
    if args.items:
        ITEMS_PATH = ROOT / "js" / args.items
    items = load_items()
    if args.ids:
        wanted = {int(part) for part in args.ids.split(",") if part.strip()}
        items = [item for item in items if int(item["id"]) in wanted]
    tones = [int(part) for part in args.tones.split(",") if part.strip()] or TONES
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.finalize_only:
        files = sorted(OUT_DIR.glob("*.mp3"))
        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(finalize, files))
        print(f"finalized: {len(files)}")
        return

    semaphore = asyncio.Semaphore(CONCURRENCY)
    report = []
    write_manifest(items, tones, OUT_DIR)

    tasks = [
        make_one(item, tone, args.force, semaphore, report)
        for item in items
        for tone in tones
    ]
    results = await asyncio.gather(*tasks)

    ok = results.count("ok")
    skipped = results.count("skip")
    failed = results.count("fail")
    (ROOT / "pinyin_audio_report.txt").write_text("\n".join(report), encoding="utf-8")
    print(f"generated: {ok}, skipped: {skipped}, failed: {failed}")
    if failed:
        sys.stdout.reconfigure(encoding="utf-8")
        print("\n".join(report[-20:]))
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
