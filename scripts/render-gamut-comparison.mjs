import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import * as current from "../dist/index.mjs";

if (!process.argv[2]) throw new Error("Pass the 1.4.0 dist/index.mjs path as the baseline.");
const baseline = await import(pathToFileURL(resolve(process.argv[2])));
const font = process.env.EPD_COMPARISON_FONT || (process.platform === "darwin" ? "/System/Library/Fonts/Supplemental/Arial.ttf" : "DejaVu-Sans");
function canvas(width, height) {
  const c = { width, height, data: new Uint8ClampedArray(width * height * 4).fill(255) };
  c.getContext = () => ({
    getImageData: () => ({ width, height, data: c.data.slice() }),
    putImageData: im => { c.data = im.data.slice(); },
  });
  return c;
}
const width = 320, height = 150, source = canvas(width, height);
// Synthetic hard-edged glyphs/lines: no font rasterizer, antialiasing or private image.
const glyphs = [
  ["11111","10000","10000","11110","10000","10000","11111"],
  ["11110","10001","10001","11110","10000","10000","10000"],
  ["11110","10001","10001","10001","10001","10001","11110"],
];
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const row = Math.floor((y - 20) / 4), gx = Math.floor((x - 20) / 4), glyph = Math.floor(gx / 8);
  const letter = row >= 0 && row < 7 && gx >= 0 && glyph < glyphs.length && glyphs[glyph][row][gx % 8] === "1";
  const line = (y === 64 || y === 108) && x >= 12 && x < width - 12;
  const strokes = y >= 78 && y < 94 && x >= 16 && x < width - 16 && (x % 11 < 2 || y === 85);
  if (letter || line || strokes) source.data.set([0,0,0,255], (y * width + x) * 4);
}
const options = { palette: current.aitjcizeSpectra6Palette, ditheringType: "errorDiffusion",
  errorDiffusionMatrix: "sierra3", serpentine: true, colorMatching: "lab", processingEngine: "js", protectTextAndGraphics: false };
const temp = await mkdtemp(join(tmpdir(), "epd-gamut-"));
try {
  const panels = [], counts = {};
  for (const [name, label, api] of [["source", "Original", null], ["before", "1.4.0 - no text protection", baseline], ["after", "Gamut-aware - no text protection", current]]) {
    let image = source;
    if (api) { const d = canvas(width,height); image = canvas(width,height);
      await api.ditherCanvas(source,d,options); current.replaceColors(d,image,options.palette); }
    let changed = 0;
    for(let i=0;i<image.data.length;i+=4) if(image.data[i]!==source.data[i]||image.data[i+1]!==source.data[i+1]||image.data[i+2]!==source.data[i+2]) changed++;
    counts[name] = changed;
    const panel = join(temp,name+".png");
    execFileSync("magick", ["-size",`${width}x${height}`,"-depth","8","rgba:-","-filter","point","-resize","200%",
      "-background","#101c26","-bordercolor","#101c26","-border","12","-gravity","north","-splice","0x44",
      "-font",font,"-pointsize","21","-fill","white","-annotate","+0+9",label,panel], {input:Buffer.from(image.data)});
    panels.push(panel);
  }
  await mkdir("docs/images",{recursive:true});
  execFileSync("magick",[...panels,"+append","-strip","docs/images/gamut-error-diffusion.png"]);
  await writeFile("docs/images/gamut-error-diffusion.json",JSON.stringify({width,height,changedPixels:counts,options},null,2)+"\n");
  console.log(counts);
} finally { await rm(temp,{recursive:true,force:true}); }
