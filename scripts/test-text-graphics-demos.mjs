// Reproducible visual regression run. Requires ImageMagick, no browser or OCR service.
// npm run build && node scripts/test-text-graphics-demos.mjs [filename ...]
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  detectTextAndGraphics,
  ditherCanvas,
  replaceColors,
  aitjcizeSpectra6Palette as palette,
} from "../dist/index.mjs";

const exec = promisify(execFile);
const sourceDir = resolve("examples/sampleImages");
const outputDir = resolve(process.env.DEMO_OUTPUT_DIR || "output/selective-quantization");
const longEdge = Number(process.env.DEMO_LONG_EDGE || 800);
const options = {
  palette,
  ditheringType: "errorDiffusion",
  errorDiffusionMatrix: "floydSteinberg",
  serpentine: true,
  colorMatching: "lab",
  processingEngine: "js",
};

function canvas(
  width,
  height,
  data = new Uint8ClampedArray(width * height * 4),
) {
  const c = { width, height, data };
  c.getContext = () => ({
    getImageData: () => ({
      width: c.width,
      height: c.height,
      data: c.data.slice(),
    }),
    putImageData: (im) => {
      c.width = im.width;
      c.height = im.height;
      c.data = im.data.slice();
    },
  });
  return c;
}
async function png(c, file) {
  const child = spawn("magick", [
    "-size",
    `${c.width}x${c.height}`,
    "-depth",
    "8",
    "rgba:-",
    file,
  ]);
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`magick: ${code}`)),
    );
  });
  child.stdin.end(Buffer.from(c.data));
  await done;
}
const rgb = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16))
    .join(",");
const key = (data, p) => `${data[p * 4]},${data[p * 4 + 1]},${data[p * 4 + 2]}`;
const allowed = new Set(palette.map((p) => rgb(p.color)));
const deviceAllowed = new Set(palette.map((p) => rgb(p.deviceColor)));
const files =
  process.argv.length > 2
    ? process.argv.slice(2)
    : (await readdir(sourceDir))
        .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
        .sort();
const results = [];
await mkdir(outputDir, { recursive: true });

for (const file of files) {
  // Keep the extension: landscape.jpg and landscape.png are different demos.
  const name = basename(file);
  const dir = resolve(outputDir, name);
  await mkdir(dir, { recursive: true });
  const originalPath = resolve(dir, "original.png");
  // Resize ONLY the input, preserve aspect ratio, never upscale or pad it.
  await exec("magick", [
    resolve(sourceDir, file),
    "-auto-orient",
    "-resize",
    `${longEdge}x${longEdge}>`,
    "-background",
    "white",
    "-alpha",
    "remove",
    "-alpha",
    "off",
    originalPath,
  ]);
  const { stdout: dimensions } = await exec("magick", [
    "identify",
    "-format",
    "%w %h",
    originalPath,
  ]);
  const [width, height] = dimensions.split(" ").map(Number);
  const { stdout } = await exec(
    "magick",
    [originalPath, "-depth", "8", "rgba:-"],
    { encoding: "buffer", maxBuffer: 256 * 1024 * 1024 },
  );
  const source = canvas(width, height, new Uint8ClampedArray(stdout));
  const t = performance.now();
  const detected = detectTextAndGraphics(source);
  const detectionMs = performance.now() - t;
  const baseline = canvas(width, height),
    protectedImage = canvas(width, height),
    quantized = canvas(width, height);
  await ditherCanvas(source, baseline, options);
  const t2 = performance.now();
  await ditherCanvas(source, protectedImage, {
    ...options,
    protectTextAndGraphics: true,
  });
  const processingMs = performance.now() - t2;
  await ditherCanvas(source, quantized, {
    ...options,
    ditheringType: "quantizationOnly",
  });
  const device = canvas(width, height);
  replaceColors(protectedImage, device, palette);
  let changed = 0,
    protectedChanged = 0,
    unprotectedChanged = 0;
  const overlay = canvas(width, height, source.data.slice());
  const maskImage = canvas(width, height);
  for (let p = 0; p < width * height; p++) {
    const protectedPixel = detected.mask[p] === 1;
    if (protectedPixel) {
      assert.equal(
        key(protectedImage.data, p),
        key(quantized.data, p),
        `${file}: protected pixel ${p}`,
      );
      overlay.data[p * 4] = Math.round(source.data[p * 4] * 0.35 + 255 * 0.65);
      overlay.data[p * 4 + 1] = Math.round(source.data[p * 4 + 1] * 0.35);
      overlay.data[p * 4 + 2] = Math.round(
        source.data[p * 4 + 2] * 0.35 + 190 * 0.65,
      );
    }
    for (let c = 0; c < 3; c++)
      maskImage.data[p * 4 + c] = protectedPixel ? 255 : 0;
    maskImage.data[p * 4 + 3] = 255;
    assert.ok(
      allowed.has(key(protectedImage.data, p)),
      `${file}: palette violation`,
    );
    assert.ok(
      deviceAllowed.has(key(device.data, p)),
      `${file}: device encoding`,
    );
    if (key(baseline.data, p) !== key(protectedImage.data, p)) {
      changed++;
      if (protectedPixel) protectedChanged++;
      else unprotectedChanged++;
    }
  }
  if (!detected.protectedPixels)
    assert.deepEqual(baseline.data, protectedImage.data);
  await png(baseline, resolve(dir, "before.png"));
  await png(protectedImage, resolve(dir, "after.png"));
  await png(overlay, resolve(dir, "overlay.png"));
  await png(maskImage, resolve(dir, "mask.png"));
  const result = {
    file,
    name,
    width,
    height,
    protectedPixels: detected.protectedPixels,
    protectedPercent: +(
      (detected.protectedPixels / (width * height)) *
      100
    ).toFixed(3),
    regionCount: detected.regionCount,
    changedPixels: changed,
    protectedChanged,
    unprotectedChanged,
    detectionMs: +detectionMs.toFixed(1),
    processingMs: +processingMs.toFixed(1),
  };
  results.push(result);
  console.log(
    `${file}: ${result.protectedPercent}% protected, ${result.regionCount} regions, ${result.detectionMs} ms`,
  );
}
await writeFile(
  resolve(outputDir, "results.json"),
  JSON.stringify(
    {
      longEdge,
      options,
      description:
        "Input resized once; no tone adjustments. Magenta = detected protection. Pixel checks are not semantic recognition accuracy.",
      results,
    },
    null,
    2,
  ) + "\n",
);
const escape = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
await writeFile(
  resolve(outputDir, "index.html"),
  `<!doctype html><html lang="de"><meta charset="utf-8">
<title>EPD Optimize – Text- und Grafikschutz</title><style>
body{font:16px system-ui;background:#f2f2f2;color:#171717;margin:24px}h1{font-size:28px}section{background:white;padding:16px;margin:24px 0;border-radius:12px}h2{overflow-wrap:anywhere;font-size:20px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}figure{margin:0}img{width:100%;height:auto;image-rendering:pixelated}figcaption{font-weight:600;margin-bottom:8px}a{color:inherit}small{color:#555}
</style><h1>Automatischer Text- und Grafikschutz</h1>
<p>${results.length} Demobilder · Spectra 6 · LAB · Floyd–Steinberg · Serpentine · maximale Kante ${longEdge} px.</p>
<p>Keine Tonwertanpassungen. Magenta zeigt erkannte Schutzbereiche. Der Flächenanteil ist keine Erkennungsgenauigkeit. Fotos können ebenfalls flache Formen enthalten; kleine oder strukturierte Schrift kann übersehen werden.</p>
<p>Alle geschützten Pixel entsprechen direkter Quantisierung. Palette und Gerätefarben geprüft. Bilder anklicken für Originalgröße.</p>
${results
  .map(
    (r) =>
      `<section><h2>${escape(r.file)}</h2><p>${r.width} × ${r.height} · ${r.protectedPercent}% geschützt · ${r.regionCount} Regionen · Erkennung ${r.detectionMs} ms</p><div class="grid">${[
        ["original", "Original"],
        ["before", "Ohne Schutz"],
        ["after", "Mit Schutz"],
        ["overlay", "Erkannte Bereiche"],
      ]
        .map(
          ([f, label]) =>
            `<figure><figcaption>${label}</figcaption><a href="${encodeURIComponent(r.name)}/${f}.png"><img loading="lazy" src="${encodeURIComponent(r.name)}/${f}.png"></a></figure>`,
        )
        .join("")}</div></section>`,
  )
  .join("\n")}</html>`,
);
console.log(`Report: ${resolve(outputDir, "index.html")}`);
