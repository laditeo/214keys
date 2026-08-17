import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const betaRoot = join(root, "beta");
const COPY = ["css", "js", "data"];

if (existsSync(betaRoot)) rmSync(betaRoot, { recursive: true, force: true });
mkdirSync(betaRoot, { recursive: true });

for (const name of COPY) {
  const src = join(root, name);
  if (!existsSync(src)) continue;
  cpSync(src, join(betaRoot, name), { recursive: true });
}

const basicSrc = join(root, "basic");
if (existsSync(basicSrc)) {
  cpSync(basicSrc, join(betaRoot, "basic"), { recursive: true });
}

console.log("Synced beta/{css,js,data} from main (audio stays at /214keys/audio/)");
