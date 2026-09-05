import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCustomResolution } from '../examples/demo/custom-resolution.ts';
import * as epd from '../dist/index.mjs';

test('custom display dimensions preserve portrait, square and landscape sizes', () => {
  for (const [width, height] of [[600, 448], [448, 600], [400, 400], [8192, 1], [4096, 4096]]) {
    const result = parseCustomResolution(String(width), String(height));
    assert.equal(result.width, width);
    assert.equal(result.height, height);
  }
});

test('invalid and oversized display sizes cannot reach canvas allocation', () => {
  for (const value of ['', ' ', null, undefined, true, '12px', '1.5', '1e3', 0, -1, 1.5, Infinity, 8193]) {
    assert.throws(() => parseCustomResolution(value, 480));
    assert.throws(() => parseCustomResolution(800, value));
  }
  assert.throws(() => parseCustomResolution(8192, 8192), /16 megapixels/);
});

test('new generic color palettes are available through public exports and registry', () => {
  for (const [name, key, colors] of [
    ['genericThreeColorRedPalette', 'generic-3-color-red', ['#000000', '#FFFFFF', '#FF0000']],
    ['genericThreeColorYellowPalette', 'generic-3-color-yellow', ['#000000', '#FFFFFF', '#FFFF00']],
    ['genericFourColorEinkPalette', 'generic-4-color-eink', ['#000000', '#FFFFFF', '#FF0000', '#FFFF00']],
  ]) {
    assert.deepEqual(epd[name].map(entry => entry.color), colors);
    assert.deepEqual(epd.getDefaultPalettes(key), colors);
    assert.deepEqual(epd.getDeviceColors(key), colors);
  }
});
