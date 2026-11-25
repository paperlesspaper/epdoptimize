import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import * as esm from '../dist/index.mjs';
const cjs = createRequire(import.meta.url)('../dist/index.cjs');
globalThis.ImageData = class ImageData {
  constructor(data, width, height) { Object.assign(this, { data, width, height }); }
  get [Symbol.toStringTag]() { return 'ImageData'; }
};
function canvas(data, width, height) {
  return { data: new Uint8ClampedArray(data), width, height, getContext() {
    return {
      getImageData: () => new ImageData(this.data.slice(), this.width, this.height),
      putImageData: image => { this.data = image.data.slice(); this.width = image.width; this.height = image.height; },
    };
  } };
}
// Independent bench export: preserve the RGB-to-recipe association for every state.
const measuredPalette = JSON.parse(readFileSync(new URL(
  '../docs/calibration/spectra35-2026-11-25/palette.json', import.meta.url), 'utf8'));
const rgb = hex => hex.slice(1).match(/../g).map(v => parseInt(v, 16));

for (const [format, lib] of [['ESM', esm], ['CJS', cjs]]) {
  test(`${format}: experimental palette retains all 35 exact recipe tokens`, async () => {
    const p = lib.spectra35ExperimentalPalette;
    assert.equal(p.length, 35);
    assert.equal(new Set(p.map(x => x.color)).size, 35);
    assert.deepEqual(p.map(x => x.deviceColor), Array.from({length: 35}, (_, i) => '#' + (0x010000 + i).toString(16).toUpperCase().padStart(6, '0')));
    assert.deepEqual(lib.getDefaultPalettes('spectra35-experimental'), p.map(x => x.color));
    assert.deepEqual(lib.getDeviceColors('spectra35-experimental'), p.map(x => x.deviceColor));
    assert.deepEqual(p, measuredPalette, 'all matching RGB values must retain their measured recipe association');
    assert.equal(p[4].color, '#00419F'); // recipe 4 is blue, native code 4 is not.
    const input = Uint8ClampedArray.from(p.flatMap(x => [...rgb(x.color), 255]));
    for (const ditheringType of ['quantizationOnly', 'errorDiffusion']) {
      const source = canvas(input, 35, 1), preview = canvas([], 35, 1), tokens = canvas([], 35, 1);
      await lib.ditherCanvas(source, preview, { palette: p, ditheringType, colorMatching: 'rgb', errorDiffusionMatrix: 'floydSteinberg', processingEngine: 'js', serpentine: true });
      assert.deepEqual(preview.data, input, 'exact appearance swatches must survive dithering');
      lib.replaceColors(preview, tokens, p);
      assert.deepEqual(tokens.data, Uint8ClampedArray.from(p.flatMap(x => [...rgb(x.deviceColor), 255])));
      for (let i = 0; i < 35; i++) assert.equal((tokens.data[4*i]<<16 | tokens.data[4*i+1]<<8 | tokens.data[4*i+2]) - 0x010000, i);
    }
    assert.equal(lib.spectra6Palette.length, 6);
    assert.equal(lib.defaultPalette.length, 2);
  });
}

test('named Spectra35 dithering and exported palette produce identical token rasters', async () => {
  const input = new Uint8ClampedArray(64 * 8 * 4);
  for (let i = 0; i < input.length; i += 4) input.set([(i*7)%256, (i*11)%256, (i*13)%256, 255], i);
  const results = [];
  for (const palette of ['spectra35-experimental', esm.spectra35ExperimentalPalette]) {
    const preview = canvas([],64,8), tokens = canvas([],64,8);
    await esm.ditherCanvas(canvas(input,64,8), preview, {palette, ditheringType:'errorDiffusion', errorDiffusionMatrix:'floydSteinberg', colorMatching:'rgb', processingEngine:'js'});
    esm.replaceColors(preview,tokens,esm.spectra35ExperimentalPalette);
    for(let i=0;i<tokens.data.length;i+=4) {
      assert.equal(tokens.data[i],1); assert.equal(tokens.data[i+1],0);
      assert.ok(tokens.data[i+2] <= 34); assert.equal(tokens.data[i+3],255);
    }
    results.push(tokens.data);
  }
  assert.deepEqual(results[0],results[1]);
});
