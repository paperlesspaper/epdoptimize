/**
 * Generate the panel-sized blue-noise threshold texture by void-and-cluster.
 *
 *   node scripts/generate-blue-noise.mjs
 *
 * A Gaussian blur of the binary pattern says where the minority pixels are piled
 * up (a cluster, the blur's maximum) and where they are missing (a void, its
 * minimum); the mask is the order in which filling the largest void keeps the
 * pattern most evenly spread (Ulichney 1993). Thresholding the result at any
 * level therefore leaves a well-spread pattern at *every* grey level, which is
 * the part a high-pass or an FFT-shaped noise cannot promise -- those only
 * constrain the mask taken as a whole.
 *
 * Ulichney fills one void per pass, which is a non-starter at panel resolution:
 * two million passes over two million pixels. Two observations make it a few
 * hundred passes instead. A pixel that is the strict minimum of the window
 * around it cannot sit within that window of another such minimum, so a whole
 * pass worth of them is mutually separated by construction; and if the window is
 * as wide as the blur's reach, filling one shifts the others' scores by very
 * little, so filling them together lands where the sequential loop would, in
 * their score order.
 *
 * Everything wraps, so the texture tiles seamlessly.
 */

import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WIDTH = 1200;
const HEIGHT = 1600;
const SIGMA = 1.5; // Ulichney's blur radius, which sets the cluster/void scale
const SEED = 1;

// A pass may fill at most 1/PACE of what is left, lowest score first, and never
// more than it has already filled. The first bound keeps the endgame -- where
// every remaining pixel is isolated and so trivially a local minimum -- from
// being ranked off one stale blur; the second stops the opening, which has
// nothing but dust to go on, from doing the same.
const PACE = 128;

const SEPARATION = Math.trunc(3 * SIGMA); // half-window that guarantees spacing
const REACH = Math.ceil(4 * SIGMA); // where the kernel has decayed into nothing

const TOTAL = WIDTH * HEIGHT;
const output = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "dither",
  "data",
  `blue-noise-${WIDTH}x${HEIGHT}.png`
);

/** Deterministic so re-running the script reproduces the texture exactly. */
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildKernel() {
  const span = 2 * REACH + 1;
  const taps = new Float32Array(span * span);
  for (let dy = -REACH; dy <= REACH; dy += 1) {
    for (let dx = -REACH; dx <= REACH; dx += 1) {
      taps[(dy + REACH) * span + (dx + REACH)] = Math.exp(
        (-0.5 * (dy * dy + dx * dx)) / (SIGMA * SIGMA)
      );
    }
  }
  return taps;
}

const KERNEL = buildKernel();

function stamp(energy, index) {
  const y0 = Math.trunc(index / WIDTH);
  const x0 = index - y0 * WIDTH;
  const span = 2 * REACH + 1;
  for (let dy = -REACH; dy <= REACH; dy += 1) {
    const y = (y0 + dy + HEIGHT) % HEIGHT;
    const row = y * WIDTH;
    const tapRow = (dy + REACH) * span + REACH;
    for (let dx = -REACH; dx <= REACH; dx += 1) {
      energy[row + ((x0 + dx + WIDTH) % WIDTH)] += KERNEL[tapRow + dx];
    }
  }
}

/**
 * The lowest-energy unfilled pixel of each SEPARATION-sized cell.
 *
 * Scanning cells rather than every neighbourhood is what keeps a pass linear;
 * the survivors are then checked properly, and there are few enough of those
 * that the check costs about as much again.
 */
function collectCandidates(energy, filled) {
  const cell = SEPARATION;
  const cellsX = Math.ceil(WIDTH / cell);
  const cellsY = Math.ceil(HEIGHT / cell);
  const best = new Int32Array(cellsX * cellsY).fill(-1);
  const bestScore = new Float32Array(cellsX * cellsY).fill(Infinity);

  for (let y = 0; y < HEIGHT; y += 1) {
    const row = y * WIDTH;
    const cellRow = Math.trunc(y / cell) * cellsX;
    for (let x = 0; x < WIDTH; x += 1) {
      const index = row + x;
      if (filled[index]) continue;
      const score = energy[index];
      const slot = cellRow + Math.trunc(x / cell);
      if (score < bestScore[slot]) {
        bestScore[slot] = score;
        best[slot] = index;
      }
    }
  }

  const candidates = [];
  for (let slot = 0; slot < best.length; slot += 1) {
    const index = best[slot];
    if (index < 0) continue;
    if (isStrictMinimum(energy, filled, index)) candidates.push(index);
  }
  return candidates;
}

function isStrictMinimum(energy, filled, index) {
  const y0 = Math.trunc(index / WIDTH);
  const x0 = index - y0 * WIDTH;
  const score = energy[index];
  for (let dy = -SEPARATION; dy <= SEPARATION; dy += 1) {
    const row = ((y0 + dy + HEIGHT) % HEIGHT) * WIDTH;
    for (let dx = -SEPARATION; dx <= SEPARATION; dx += 1) {
      const other = row + ((x0 + dx + WIDTH) % WIDTH);
      if (other === index || filled[other]) continue;
      if (energy[other] < score) return false;
    }
  }
  return true;
}

function voidAndCluster() {
  const random = mulberry32(SEED);
  const energy = new Float32Array(TOTAL);
  // Dust, far below the smallest tap that matters: it makes every score
  // distinct, so the minima above are strict, and it is what the first pass has
  // to go on.
  for (let i = 0; i < TOTAL; i += 1) energy[i] = random() * 1e-3;

  const filled = new Uint8Array(TOTAL);
  const rank = new Int32Array(TOTAL);
  let placed = 0;
  let passes = 0;

  while (placed < TOTAL) {
    const candidates = collectCandidates(energy, filled);
    candidates.sort((a, b) => energy[a] - energy[b]);

    const allowance = Math.max(
      1,
      Math.min(Math.trunc((TOTAL - placed) / PACE), placed || 1)
    );
    const take = Math.min(candidates.length, allowance);
    for (let i = 0; i < take; i += 1) {
      const index = candidates[i];
      rank[index] = placed;
      filled[index] = 1;
      stamp(energy, index);
      placed += 1;
    }

    passes += 1;
    if (passes % 25 === 0 || placed === TOTAL) {
      process.stdout.write(
        `\r  pass ${passes}, ${((100 * placed) / TOTAL).toFixed(1)}% filled`
      );
    }
  }
  process.stdout.write(`\n  ${passes} passes\n`);
  return rank;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(body.length, 0);
  header.write(type, 4, "ascii");
  const trailer = Buffer.alloc(4);
  trailer.writeUInt32BE(crc32(Buffer.concat([header.subarray(4), body])), 0);
  return Buffer.concat([header, body, trailer]);
}

/** A 16-bit greyscale PNG, hand-rolled so the library needs no encoder dependency. */
function encodeGreyscalePng(samples, width, height) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 16; // bit depth
  header[9] = 0; // colour type: greyscale
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlace

  const stride = width * 2;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const at = y * (stride + 1);
    raw[at] = 0; // per-scanline filter: none, since noise does not predict
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const sample = samples[row + x];
      raw[at + 1 + x * 2] = sample >>> 8; // PNG samples are big-endian
      raw[at + 2 + x * 2] = sample & 0xff;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const started = Date.now();
console.log(`void-and-cluster ${WIDTH}x${HEIGHT}, sigma ${SIGMA}`);
const rank = voidAndCluster();

// Ranks run 0..TOTAL-1 and a 16-bit sample holds 65536 levels, so a level covers
// about thirty equally ranked pixels rather than the seven thousand an 8-bit file
// would lump together. Every level is still spread across the frame, which is the
// property the mask exists for; this just stops coarse banding at low coverage.
const samples = new Uint16Array(TOTAL);
for (let i = 0; i < TOTAL; i += 1) {
  samples[i] = Math.min(65535, Math.trunc((rank[i] * 65536) / TOTAL));
}

await mkdir(dirname(output), { recursive: true });
await writeFile(output, encodeGreyscalePng(samples, WIDTH, HEIGHT));
console.log(
  `wrote ${output} in ${((Date.now() - started) / 1000).toFixed(1)}s`
);
