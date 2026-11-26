// RgbQuant aea71c78 skips column zero and the first kernel entry on reverse rows.
// Apply the two bounds fixes before library/demo builds; never run at consumer install.
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const path = require.resolve("rgbquant");
const original = await readFile(path, "utf8");
let source = original;
for (const [old, fixed] of [
  ["xend = (dir == 1 ? width : 0)", "xend = (dir == 1 ? width : -1)"],
  ["end = (dir == 1 ? ds.length : 0)", "end = (dir == 1 ? ds.length : -1)"],
]) {
  const oldCount = source.split(old).length - 1;
  const fixedCount = source.split(fixed).length - 1;
  if (oldCount === 1 && fixedCount === 0) source = source.replace(old, fixed);
  else if (oldCount !== 0 || fixedCount !== 1) {
    throw new Error("Unsupported RgbQuant source: recheck the serpentine bounds patch.");
  }
}
// Validate both replacements before touching the dependency, and allow repeat builds.
if (source !== original) await writeFile(path, source);
console.log("RgbQuant serpentine bounds verified.");
