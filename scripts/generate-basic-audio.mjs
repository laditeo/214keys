import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { resampleToIosMp3 } from "./ios-mp3.mjs";
import basicItems from "../js/basicItems.js";

const VOICES = {
  jp: "ja-JP-NanamiNeural",
  cn: "zh-CN-XiaoxiaoNeural",
};

const DELAY_MS = 150;
const FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3;
const MAX_RETRIES = 3;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const audioRoot = join(root, "audio", "basic");

function padId(id) {
  return String(id).padStart(3, "0");
}

function outPath(lang, id) {
  return join(audioRoot, lang, `${padId(id)}.mp3`);
}

function streamToFile(stream, path) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(path);
    stream.pipe(file);
    file.on("finish", resolve);
    file.on("error", reject);
    stream.on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function primaryReading(raw) {
  return String(raw || "")
    .split(/[·・/,]/)[0]
    .trim();
}

function speechText(item, lang) {
  if (lang === "jp") return primaryReading(item.jp);
  // Мандарин по самому знаку звучит естественнее pinyin; 〇 голос часто не знает.
  if (item.char === "〇") return "零";
  return item.char;
}

async function synthesize(tts, spoken, path) {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { audioStream } = tts.toStream(spoken);
      await streamToFile(audioStream, path);
      return;
    } catch (err) {
      lastError = err;
      if (existsSync(path)) {
        try {
          const { unlinkSync } = await import("node:fs");
          unlinkSync(path);
        } catch {
          /* ignore */
        }
      }
      if (attempt < MAX_RETRIES) await sleep(400 * attempt);
    }
  }
  throw lastError;
}

async function main() {
  mkdirSync(join(audioRoot, "jp"), { recursive: true });
  mkdirSync(join(audioRoot, "cn"), { recursive: true });

  const ttsByLang = {};
  for (const lang of ["jp", "cn"]) {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(VOICES[lang], FORMAT);
    ttsByLang[lang] = tts;
  }

  const tasks = [];
  for (const item of basicItems) {
    for (const lang of ["jp", "cn"]) {
      tasks.push({ item, lang });
    }
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < tasks.length; i++) {
    const { item, lang } = tasks[i];
    const path = outPath(lang, item.id);
    const spoken = speechText(item, lang);

    if (!spoken) {
      console.log(`[${i + 1}/${tasks.length}] skip empty ${lang} #${item.id}`);
      continue;
    }

    if (existsSync(path)) {
      skipped++;
      console.log(`[${i + 1}/${tasks.length}] skip ${lang}/${padId(item.id)} (${spoken})`);
      continue;
    }

    try {
      await synthesize(ttsByLang[lang], spoken, path);
      resampleToIosMp3(path);
      created++;
      console.log(`[${i + 1}/${tasks.length}] ok ${lang}/${padId(item.id)} ${item.char} (${spoken})`);
    } catch (err) {
      failed++;
      console.error(`[${i + 1}/${tasks.length}] fail ${lang}/${padId(item.id)} ${item.char} (${spoken}):`, err?.message || err);
    }

    if (i < tasks.length - 1) await sleep(DELAY_MS);
  }

  const groups = {};
  for (const item of basicItems) {
    const key = item.group || "other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item.id);
  }

  const manifest = {
    voices: VOICES,
    files: {
      jp: "audio/basic/jp/{id}.mp3",
      cn: "audio/basic/cn/{id}.mp3",
    },
    groups,
  };

  writeFileSync(join(audioRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`\nDone: ${created} created, ${skipped} skipped, ${failed} failed, ${tasks.length} total`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
