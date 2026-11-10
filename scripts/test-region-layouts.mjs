// Known layout rectangles below are ground truth for evaluation ONLY.
// The detector and dithering API receive just the final flattened RGBA image.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import {
  detectTextAndGraphics,
  ditherCanvas,
  aitjcizeSpectra6Palette as palette,
} from "../dist/index.mjs";

const root = resolve(process.env.LAYOUT_OUTPUT_DIR || "output/region-protection/layouts");
mkdirSync(root, { recursive: true });
const magick = (...args) =>
  execFileSync("magick", args, { maxBuffer: 32 * 1024 * 1024 });
const font = "/System/Library/Fonts/Supplemental/Arial.ttf";
const bold = "/System/Library/Fonts/Supplemental/Arial Bold.ttf";
const photo = resolve("examples/sampleImages/landscape.jpg");
const footer = resolve(root, "footer.png");
magick(
  "-size",
  "600x400",
  "xc:white",
  "-gravity",
  "northwest",
  "-font",
  font,
  "-fill",
  "#bf4428",
  "-pointsize",
  "18",
  "-annotate",
  "+40+51",
  "AUSFLUGSTIPP",
  "-font",
  bold,
  "-fill",
  "#1e60ab",
  "-pointsize",
  "34",
  "-annotate",
  "+40+103",
  "Ein Tag in den Bergen",
  "-font",
  font,
  "-fill",
  "#20252a",
  "-pointsize",
  "23",
  "-annotate",
  "+40+152",
  "Weite Wiesen, klare Luft und ein Blick",
  "-annotate",
  "+40+185",
  "bis zum Horizont.",
  "-stroke",
  "#1e60ab",
  "-strokewidth",
  "2",
  "-draw",
  "line 40,225 560,225",
  "-stroke",
  "none",
  "-font",
  bold,
  "-pointsize",
  "22",
  "-annotate",
  "+40+271",
  "Rundweg am Bergsee",
  "-font",
  font,
  "-pointsize",
  "21",
  "-annotate",
  "+40+310",
  "4,8 km   /   etwa 90 Minuten",
  "-fill",
  "#606870",
  "-pointsize",
  "17",
  "-annotate",
  "+40+362",
  "Beispiellayout: Foto und Text",
  footer,
);

const cases = [
  {
    name: "photo-top",
    title: "Foto oben",
    width: 600,
    height: 800,
    photos: [[0, 0, 600, 400]],
    text: [0, 400, 600, 400],
  },
  {
    name: "photo-bottom",
    title: "Foto unten",
    width: 600,
    height: 800,
    photos: [[0, 400, 600, 400]],
    text: [0, 0, 600, 400],
  },
  {
    name: "photo-left",
    title: "Foto links",
    width: 1000,
    height: 600,
    photos: [[0, 0, 500, 600]],
    text: [500, 130, 500, 333],
  },
  {
    name: "photo-right",
    title: "Foto rechts",
    width: 1000,
    height: 600,
    photos: [[500, 0, 500, 600]],
    text: [0, 130, 500, 333],
  },
  {
    name: "photo-inset",
    title: "Foto mit Rand",
    width: 600,
    height: 800,
    photos: [[75, 50, 450, 300]],
    text: [0, 400, 600, 400],
  },
  {
    name: "small-photo",
    title: "Foto plus kleines Vorschaubild",
    width: 600,
    height: 800,
    photos: [
      [0, 0, 600, 400],
      [460, 700, 96, 64],
    ],
    text: [0, 400, 600, 400],
  },
];
const opts = {
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
    getImageData: () => ({ width, height, data: c.data.slice() }),
    putImageData: (im) => {
      c.data = im.data.slice();
    },
  });
  return c;
}
function save(image, path) {
  execFileSync(
    "magick",
    ["-size", `${image.width}x${image.height}`, "-depth", "8", "rgba:-", path],
    { input: Buffer.from(image.data), maxBuffer: 32 * 1024 * 1024 },
  );
}
const inside = (x, y, [rx, ry, w, h]) =>
  x >= rx && x < rx + w && y >= ry && y < ry + h;
const results = [];
for (const layout of cases) {
  const { width, height, name, photos, text } = layout;
  const dir = resolve(root, name);
  mkdirSync(dir, { recursive: true });
  const original = resolve(dir, "original.png");
  const [tx, ty, tw, th] = text;
  magick(
    "-size",
    `${width}x${height}`,
    "xc:white",
    "(",
    footer,
    "-resize",
    `${tw}x${th}!`,
    ")",
    "-gravity",
    "northwest",
    "-geometry",
    `+${tx}+${ty}`,
    "-composite",
    original,
  );
  // Place photos last so the small inset does not inherit text pixels.
  for (const [x, y, w, h] of photos) {
    magick(
      original,
      "(",
      photo,
      "-resize",
      `${w}x${h}^`,
      "-gravity",
      "center",
      "-extent",
      `${w}x${h}`,
      ")",
      "-gravity",
      "northwest",
      "-geometry",
      `+${x}+${y}`,
      "-composite",
      original,
    );
  }
  const source = canvas(
    width,
    height,
    new Uint8ClampedArray(magick(original, "-depth", "8", "rgba:-")),
  );
  const raw = detectTextAndGraphics(source, { regionGrouping: false });
  const grouped = detectTextAndGraphics(source);
  const before = canvas(width, height),
    after = canvas(width, height),
    quantized = canvas(width, height);
  await ditherCanvas(source, before, {
    ...opts,
    protectTextAndGraphics: { regionGrouping: false },
  });
  await ditherCanvas(source, after, { ...opts, protectTextAndGraphics: true });
  await ditherCanvas(source, quantized, {
    ...opts,
    ditheringType: "quantizationOnly",
  });
  const metrics = Object.fromEntries(
    ["photo", "text", "background"].map((key) => [
      key,
      { pixels: 0, before: 0, after: 0 },
    ]),
  );
  for (const [method, detection] of [
    ["before", raw],
    ["after", grouped],
  ]) {
    const overlay = canvas(width, height, source.data.slice());
    const binary = canvas(width, height);
    for (let p = 0; p < width * height; p++) {
      const i = p * 4,
        x = p % width,
        y = Math.floor(p / width);
      const category = photos.some((rect) => inside(x, y, rect))
        ? "photo"
        : source.data[i] === 255 &&
            source.data[i + 1] === 255 &&
            source.data[i + 2] === 255
          ? "background"
          : "text";
      if (method === "before") metrics[category].pixels++;
      metrics[category][method] += detection.mask[p];
      for (let c = 0; c < 3; c++)
        binary.data[i + c] = detection.mask[p] ? 255 : 0;
      binary.data[i + 3] = 255;
      if (!detection.mask[p]) continue;
      if (method === "after")
        for (let c = 0; c < 4; c++)
          assert.equal(after.data[i + c], quantized.data[i + c]);
      overlay.data[i] = Math.round(source.data[i] * 0.35 + 255 * 0.65);
      overlay.data[i + 1] = Math.round(source.data[i + 1] * 0.35);
      overlay.data[i + 2] = Math.round(source.data[i + 2] * 0.35 + 190 * 0.65);
    }
    save(overlay, resolve(dir, `${method}-overlay.png`));
    save(binary, resolve(dir, `${method}-mask.png`));
  }
  save(before, resolve(dir, "before.png"));
  save(after, resolve(dir, "after.png"));
  assert.equal(
    metrics.photo.after,
    0,
    `${name}: photograph must remain completely unprotected`,
  );
  assert.equal(
    metrics.text.after,
    metrics.text.pixels,
    `${name}: protect all lettering and antialiasing`,
  );
  assert.equal(
    metrics.background.after,
    metrics.background.pixels,
    `${name}: protect the layout background`,
  );
  for (const value of Object.values(metrics)) {
    value.beforePercent = +((value.before / value.pixels) * 100).toFixed(3);
    value.afterPercent = +((value.after / value.pixels) * 100).toFixed(3);
  }
  results.push({ ...layout, metrics, regions: grouped.regionCount });
  console.log(name, JSON.stringify(metrics));
}
writeFileSync(
  resolve(root, "results.json"),
  JSON.stringify(
    {
      note: "Photo rectangles are evaluation truth only. Text includes all non-white non-photo pixels, including antialiasing. No tone adjustments; source resized before dithering.",
      options: opts,
      results,
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  resolve(root, "index.html"),
  `<!doctype html><html lang="de"><meta charset="utf-8"><title>EPD Optimize – Bereichserkennung</title>
<style>body{font:16px system-ui;margin:24px;background:#f4f4f4;color:#222}section{background:white;padding:20px;margin:24px 0}h2{font-size:22px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}img{width:100%;image-rendering:pixelated}figure{margin:0}figcaption{margin-bottom:8px;font-weight:600}</style>
<h1>Foto- und Textbereiche automatisch abgrenzen</h1><p>Magenta = direkt quantisieren. Bilder anklicken für volle Auflösung. Die Layout-Koordinaten dienen nur zur Messung und werden der Erkennung nicht übergeben.</p>
${results
  .map(
    (r) =>
      `<section><h2>${r.title}</h2><p>Geschützte Fotopixel: ${r.metrics.photo.beforePercent}% → ${r.metrics.photo.afterPercent}% · Geschützte Schriftpixel: ${r.metrics.text.beforePercent}% → ${r.metrics.text.afterPercent}%</p><div class="grid">${[
        ["original", "Original"],
        ["before-overlay", "Bisherige Pixelmaske"],
        ["after-overlay", "Neue Bereichsmaske"],
        ["after", "Ergebnis"],
      ]
        .map(
          ([file, title]) =>
            `<figure><figcaption>${title}</figcaption><a href="${r.name}/${file}.png"><img src="${r.name}/${file}.png"></a></figure>`,
        )
        .join("")}</div></section>`,
  )
  .join("\n")}</html>`,
);
