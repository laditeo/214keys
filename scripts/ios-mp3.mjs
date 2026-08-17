import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ffmpegStatic from "ffmpeg-static";

/** Safari/iOS Web Audio often fails on Edge TTS 24 kHz MPEG-2 MP3. */
export function resampleToIosMp3(filePath) {
  if (!ffmpegStatic) {
    throw new Error("ffmpeg-static binary not found");
  }

  const dir = mkdtempSync(join(tmpdir(), "214keys-ios-mp3-"));
  const outPath = join(dir, "out.mp3");

  try {
    const result = spawnSync(
      ffmpegStatic,
      [
        "-y",
        "-i",
        filePath,
        "-codec:a",
        "libmp3lame",
        "-ar",
        "44100",
        "-ac",
        "1",
        "-b:a",
        "128k",
        outPath,
      ],
      { stdio: "pipe", windowsHide: true },
    );
    if (result.status !== 0) {
      const err = result.stderr?.toString() || "ffmpeg failed";
      throw new Error(err.slice(-400));
    }
    writeFileSync(filePath, readFileSync(outPath));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
