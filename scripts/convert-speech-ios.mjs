import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resampleToIosMp3 } from "./ios-mp3.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dirs = [
  join(root, "audio", "jp"),
  join(root, "audio", "cn"),
  join(root, "audio", "pinyin", "cn"),
  join(root, "audio", "basic", "jp"),
  join(root, "audio", "basic", "cn"),
];

const files = dirs.flatMap((dir) =>
  readdirSync(dir)
    .filter((name) => name.endsWith(".mp3"))
    .map((name) => join(dir, name)),
);

const CONCURRENCY = 8;
let done = 0;
let failed = 0;

async function runPool() {
  let index = 0;
  async function worker() {
    while (index < files.length) {
      const i = index++;
      const file = files[i];
      try {
        resampleToIosMp3(file);
        done++;
      } catch (err) {
        failed++;
        console.error(`fail ${file}: ${err.message}`);
      }
      if ((done + failed) % 40 === 0 || done + failed === files.length) {
        console.log(`${done + failed}/${files.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

console.log(`Resampling ${files.length} speech MP3s to 44.1 kHz for iOS`);
await runPool();
console.log(`Done: ${done} ok, ${failed} failed`);
if (failed) process.exit(1);
