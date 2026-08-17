import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegStatic from "ffmpeg-static";
import basicItems from "../js/basicItems.js";
import { getBasicEmoji } from "../js/basicEmoji.js";
import { getSfxRefForEmoji } from "../js/radicalSfx.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "audio", "basic", "sfx");

const FALLBACK = [
  ["Interface Sounds", "pluck_001.ogg"],
  ["Interface Sounds", "confirmation_001.ogg"],
  ["Interface Sounds", "click_001.ogg"],
];

const KENNEY = "https://gamesounds.xyz/Kenney%27s%20Sound%20Pack";

function padId(id) {
  return String(id).padStart(3, "0");
}

function sourceUrl(pack, file) {
  return `${KENNEY}/${encodeURI(pack)}/${encodeURIComponent(file)}`;
}

function isValidOgg(body) {
  return body.length >= 4 && body.toString("ascii", 0, 4) === "OggS";
}

function isValidMp3(body) {
  if (body.length < 4) return false;
  if (body[0] === 0x49 && body[1] === 0x44 && body[2] === 0x33) return true;
  return body[0] === 0xff && (body[1] & 0xe0) === 0xe0;
}

function oggToMp3(oggBuffer) {
  if (!ffmpegStatic) {
    console.error("ffmpeg-static binary not found");
    return null;
  }

  const dir = mkdtempSync(join(tmpdir(), "214keys-basic-sfx-"));
  const oggPath = join(dir, "in.ogg");
  const mp3Path = join(dir, "out.mp3");

  try {
    writeFileSync(oggPath, oggBuffer);
    const result = spawnSync(
      ffmpegStatic,
      ["-y", "-i", oggPath, "-codec:a", "libmp3lame", "-qscale:a", "4", mp3Path],
      { stdio: "pipe" },
    );
    if (result.status !== 0) return null;
    const mp3 = readFileSync(mp3Path);
    return isValidMp3(mp3) ? mp3 : null;
  } catch {
    return null;
  } finally {
    for (const file of [oggPath, mp3Path]) {
      try {
        unlinkSync(file);
      } catch {
        /* ignore */
      }
    }
  }
}

async function downloadOgg(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const bytes = await res.arrayBuffer();
  if (!bytes.byteLength) return null;
  const body = Buffer.from(bytes);
  if (!isValidOgg(body)) return null;
  return body;
}

async function downloadWithFallback(id, emoji) {
  const tried = new Set();
  const { pack, file } = getSfxRefForEmoji(emoji, id);
  const candidates = [
    { url: sourceUrl(pack, file), pack, file },
    ...FALLBACK.map(([fbPack, fbFile]) => ({
      url: sourceUrl(fbPack, fbFile),
      pack: fbPack,
      file: fbFile,
    })),
  ];

  for (const candidate of candidates) {
    const key = `${candidate.pack}/${candidate.file}`;
    if (tried.has(key)) continue;
    tried.add(key);

    try {
      const body = await downloadOgg(candidate.url);
      if (!body) {
        console.warn(`  miss ${padId(id)}: ${candidate.url}`);
        continue;
      }
      return { ...candidate, body };
    } catch (err) {
      console.warn(`  fail ${padId(id)}: ${candidate.url} (${err.message})`);
    }
  }

  return null;
}

async function main() {
  mkdirSync(outDir, { recursive: true });

  const manifest = [];
  let created = 0;
  let skipped = 0;
  let failed = 0;
  const total = basicItems.length;

  for (const item of basicItems) {
    const id = item.id;
    const outPath = join(outDir, `${padId(id)}.mp3`);
    const emoji = getBasicEmoji(id);
    const { pack, file } = getSfxRefForEmoji(emoji, id);
    const expectedUrl = sourceUrl(pack, file);

    if (existsSync(outPath)) {
      const existing = readFileSync(outPath);
      if (isValidMp3(existing)) {
        skipped++;
        manifest.push({
          id,
          char: item.char,
          emoji,
          file: `${padId(id)}.mp3`,
          source: expectedUrl,
          skipped: true,
        });
        console.log(`[${id}/${total}] skip ${padId(id)}.mp3 (${emoji} ${item.char})`);
        continue;
      }
      console.log(`[${id}/${total}] replace invalid ${padId(id)}.mp3 (${emoji} ${item.char})`);
    } else {
      console.log(`[${id}/${total}] build ${padId(id)}.mp3 (${emoji} ${item.char})`);
    }

    const result = await downloadWithFallback(id, emoji);
    if (!result) {
      failed++;
      manifest.push({ id, char: item.char, emoji, error: "download failed", source: expectedUrl });
      continue;
    }

    const mp3 = oggToMp3(result.body);
    if (!mp3) {
      failed++;
      manifest.push({ id, char: item.char, emoji, error: "mp3 conversion failed", source: result.url });
      continue;
    }

    writeFileSync(outPath, mp3);
    created++;
    manifest.push({
      id,
      char: item.char,
      emoji,
      file: `${padId(id)}.mp3`,
      pack: result.pack,
      kenneyFile: result.file,
      source: result.url,
    });
  }

  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`\nDone: ${created} created, ${skipped} skipped, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
