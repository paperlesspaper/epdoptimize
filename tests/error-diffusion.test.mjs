import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ditherCanvas, aitjcizeSpectra6Palette } from "../dist/index.mjs";

const idealPalette = ["#000000", "#ffffff", "#0000ff", "#00ff00", "#ff0000", "#ffff00"];
function canvas(width, height, pixel = () => [0, 0, 0]) {
  const c = { width, height, data: new Uint8ClampedArray(width * height * 4) };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    c.data.set([...pixel(x, y), 255], (y * width + x) * 4);
  }
  c.getContext = () => ({
    getImageData: () => ({ width: c.width, height: c.height, data: c.data.slice() }),
    putImageData: (im) => Object.assign(c, { ...im, data: im.data.slice() }),
  });
  return c;
}
async function render(source, options = {}) {
  const output = canvas(source.width, source.height);
  await ditherCanvas(source, output, {
    palette: idealPalette, colorMatching: "rgb", processingEngine: "js",
    ditheringType: "errorDiffusion", serpentine: true, ...options,
  });
  return output.data;
}
function mean(data) {
  const sums = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) sums[c] += data[i + c];
  return sums.map((s) => s / (data.length / 4));
}

for (const processingEngine of ["js", "wasm"]) {
  test(`${processingEngine}: cyan keeps blue and green instead of collapsing to white`, async () => {
    const data = await render(canvas(128, 128, () => [0, 255, 255]), { processingEngine });
    const counts = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const key = [...data.slice(i, i + 3)].join(",");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    assert.ok(counts.get("0,0,255") > 16384 * 0.2);
    assert.ok(counts.get("0,255,0") > 16384 * 0.2);
    assert.ok(counts.get("255,255,255") < 16384 * 0.6);
  });

  test(`${processingEngine}: representable mixtures retain their mean RGB`, async () => {
    for (const target of [[85, 170, 170], [32, 64, 96], [1, 1, 1], [254, 254, 254]]) {
      const source = canvas(192, 192, () => target);
      const original = source.data.slice();
      const result = await render(source, { processingEngine });
      mean(result).forEach((actual, c) => assert.ok(Math.abs(actual - target[c]) < 2, `${target}: ${mean(result)}`));
      assert.deepEqual(source.data, original);
    }
  });

  test(`${processingEngine}: out-of-gamut highlights do not bleed far into dark regions`, async () => {
    const source = canvas(96, 128, (x, y) => y < 64 ? [255, 255, 255] : [2, 2, 2]);
    const result = await render(source, { processingEngine, palette: aitjcizeSpectra6Palette });
    for (let i = 70 * 96 * 4; i < result.length; i += 4) {
      assert.deepEqual([...result.slice(i, i + 3)], [2, 2, 2]);
    }
  });
}

const kernels = ["floydSteinberg", "falseFloydSteinberg", "atkinson", "jarvis", "stucki", "burkes", "sierra3", "sierra2", "sierra2-4a", "fan", "shiauFan", "shiauFan2", "jarvisJudiceNinke"];
test("WASM matches JS for every kernel, scan direction and narrow image", async () => {
  for (const [width, height] of [[37, 29], [1, 17], [17, 1], [1, 1]]) {
    const source = canvas(width, height, (x, y) => [(x * 71 + y * 31) % 256, (x * 17 + y * 73) % 256, (x * 59 + y * 11) % 256]);
    for (const palette of [idealPalette, aitjcizeSpectra6Palette]) {
      for (const errorDiffusionMatrix of kernels) for (const serpentine of [false, true]) {
        const options = { palette, errorDiffusionMatrix, serpentine };
        assert.deepEqual(
          await render(source, { ...options, processingEngine: "wasm" }),
          await render(source, { ...options, processingEngine: "js" }),
          `${width}x${height} ${errorDiffusionMatrix} serpentine=${serpentine}`,
        );
      }
    }
  }
});

test("embedded WASM executes the float kernel without relying on JS fallback", async () => {
  const wrapper = await readFile(new URL("../src/dither/wasm-error-diffusion-rgb.ts", import.meta.url), "utf8");
  const bytes = Buffer.from(wrapper.match(/const WASM_BASE64 =\s*"([^"]+)"/)[1], "base64");
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const { memory, ditherRgbErrorDiffusion } = instance.exports;
  memory.grow(1);
  const data = new Uint8Array(memory.buffer);
  data.set([0, 255, 255, 255, 0, 255, 255, 255]);
  // White is initially nearest. Its negative red error must reach pixel two.
  data.set([0, 0, 0, 255, 255, 255, 0, 0, 255, 0, 255, 0], 8);
  new Float64Array(memory.buffer, 24, 3).set([1, 0, 1]);
  ditherRgbErrorDiffusion(0, 8, 4, 2, 1, 24, 1, 0, 48, 1, 0, 0, 1);
  assert.deepEqual([...data.slice(0, 8)], [255, 255, 255, 255, 0, 0, 255, 255]);
});

for (const colorMatching of ["lab", "chroma"]) {
  test(`${colorMatching}: fractional candidates still select valid nonblack colors`, async () => {
    const result = await render(canvas(64, 64, (x, y) => [60 + x * 2, 110 + y, 190]), { colorMatching });
    const allowed = new Set(idealPalette.map((hex) => hex.slice(1).match(/../g).map((v) => parseInt(v, 16)).join(",")));
    let nonblack = 0;
    for (let i = 0; i < result.length; i += 4) {
      const key = [...result.slice(i, i + 3)].join(",");
      assert.ok(allowed.has(key));
      assert.equal(result[i + 3], 255);
      if (key !== "0,0,0") nonblack++;
    }
    assert.ok(nonblack > 4096 * 0.4);
  });
}

for (const processingEngine of ["js", "wasm"]) {
  for (const colorMatching of processingEngine === "wasm" ? ["rgb"] : ["rgb", "lab", "chroma"]) {
    test(`${processingEngine}/${colorMatching}: calibrated hard edges survive without text protection`, async () => {
      for (const [ink, paper] of [[0,255],[1,218]]) {
        const source = canvas(96,64,(x,y) => {
          const stroke = y % 16 === 8 || (y % 16 >= 3 && y % 16 <= 12 && x % 12 >= 4 && x % 12 <= 6);
          return stroke ? [ink,ink,ink] : [paper,paper,paper];
        });
        for (const serpentine of [false,true]) {
          const output = await render(source, { palette:aitjcizeSpectra6Palette, processingEngine,
            colorMatching, errorDiffusionMatrix:"sierra3", serpentine, protectTextAndGraphics:false });
          for(let i=0;i<output.length;i+=4) assert.deepEqual([...output.slice(i,i+3)],
            source.data[i] === ink ? [2,2,2] : [190,200,200]);
        }
      }
    });
  }
}

test("WASM row projection matches JS for degenerate and larger fallback palettes", async () => {
  const palettes = [
    ["#123456"], ["#123456","#123456"], ["#141414","#c8c8c8"],
    ["#000000","#ff0000","#00ff00"], ["#000000","#ff0000","#00ff00","#ffff00"],
    Array.from({length:16},(_,i)=>"#"+(i*17).toString(16).padStart(2,"0").repeat(3)),
    [...idealPalette,"#102030","#405060","#708090"],
  ];
  for(const [width,height] of [[1,1],[1,13],[13,1],[29,31],[0,0]]) {
    const source=canvas(width,height,(x,y)=>[(x*19+y*77)%256,(x*89+y*23)%256,(x*11+y*67)%256]);
    for(const palette of palettes) {
      const options={palette,errorDiffusionMatrix:"sierra3",serpentine:true,protectTextAndGraphics:false};
      assert.deepEqual(await render(source,{...options,processingEngine:"wasm"}),await render(source,{...options,processingEngine:"js"}));
    }
  }
});

test("embedded WASM consumes projected fractional rows and keeps errors between calls", async () => {
  const wrapper=await readFile(new URL("../src/dither/wasm-error-diffusion-rgb.ts",import.meta.url),"utf8");
  const {instance}=await WebAssembly.instantiate(Buffer.from(wrapper.match(/const WASM_BASE64 =\s*"([^"]+)"/)[1],"base64"),{});
  const {memory,ditherRgbErrorDiffusion}=instance.exports;memory.grow(1);
  const bytes=new Uint8Array(memory.buffer),floats=new Float64Array(memory.buffer);
  bytes.set([0,0,0,255,0,0,0,255]); // Source bytes differ deliberately from projected values.
  bytes.set([0,0,0,255,255,255],8);
  floats.set([0,1,1],2); // Propagate the entire residual into the next row.
  floats.set([127.5,127.5,127.5],11);
  ditherRgbErrorDiffusion(0,8,2,1,2,16,1,0,40,2,88,0,1);
  ditherRgbErrorDiffusion(0,8,2,1,2,16,1,0,40,2,88,1,2);
  assert.deepEqual([...bytes.slice(0,8)],[0,0,0,255,255,255,255,255]);
});
