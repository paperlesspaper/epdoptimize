/**
 * Sanity-check the blue-noise texture: decode it and exercise the sampling that
 * blueNoiseDither performs.
 *
 *   node --experimental-strip-types scripts/check-blue-noise.mjs
 *
 * This reaches for png.ts directly rather than blue-noise-texture.ts, whose
 * extensionless imports only resolve through the bundler.
 */

import { readFile } from "node:fs/promises";
import { decodeGreyscalePng } from "../src/utils/png.ts";

const file = "blue-noise-1200x1600.png";
const bytes = new Uint8Array(
  await readFile(new URL(`../src/dither/data/${file}`, import.meta.url))
);
const mask = await decodeGreyscalePng(bytes);

let min = Infinity;
let max = -Infinity;
const seen = new Set();
for (const value of mask.samples) {
  if (value < min) min = value;
  if (value > max) max = value;
  seen.add(value);
}
console.log(
  `mask ${mask.width}x${mask.height} maxValue ${mask.maxValue} ` +
    `range ${min}..${max} distinct ${seen.size}`
);

// The thresholds a 2000x2000 image sees, i.e. wrapping past the mask on both axes.
const scale = 255 / mask.maxValue;
let low = Infinity;
let high = -Infinity;
let sum = 0;
for (let y = 0; y < 2000; y += 1) {
  for (let x = 0; x < 2000; x += 1) {
    const threshold = mask.samples[(y % mask.height) * mask.width + (x % mask.width)] * scale;
    if (threshold < low) low = threshold;
    if (threshold > high) high = threshold;
    sum += threshold;
  }
}
console.log(
  `thresholds over 2000x2000: ${low.toFixed(2)}..${high.toFixed(2)} ` +
    `mean ${(sum / 4e6).toFixed(2)}, uniform wants 127.50`
);

let hash = 2166136261 >>> 0;
for (const value of mask.samples) {
  hash = Math.imul(hash ^ (value & 0xff), 16777619) >>> 0;
  hash = Math.imul(hash ^ (value >>> 8), 16777619) >>> 0;
}
console.log(`fnv1a ${hash}`);
