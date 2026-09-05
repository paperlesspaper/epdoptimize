import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDemoConfig, mergeControlChanges } from '../examples/demo/config-import.ts';

const choices = {
  palette: ['aitjcizeSpectra6Palette'], ditheringType: ['ordered', 'ditherItBlueNoise'],
  colorMatching: ['rgb', 'lab'], processingEngine: ['auto', 'js', 'wasm'],
};
const parse = config => parseDemoConfig(JSON.stringify(config), choices);
const config = {
  palette: 'aitjcizeSpectra6Palette',
  imageAdjustmentOptions: {
    dynamicRangeCompression: { mode: 'display', preserveWhite: true, whitePreserveMinLuma: 150 },
    paperNormalization: { mode: 'warmPaper', paperWhite: [230, 240, 250] },
  },
  canvasDitherOptions: { ditheringType: 'ordered', orderedDitheringMatrix: [8, 8], edgePreservation: { enabled: true, threshold: 40 } },
};

test('exported configs retain advanced options and support a UTF-8 BOM', () => {
  assert.deepEqual(parse(config), config);
  assert.deepEqual(parseDemoConfig('\uFEFF' + JSON.stringify(config), choices), config);
  assert.deepEqual(parse({ palette: config.palette }).imageAdjustmentOptions, {});
});

test('custom palettes preserve device colors and normalize hex-only entries', () => {
  const palette = [{ name: 'paper', color: '#bec8c8', deviceColor: '#ffffff' }];
  assert.deepEqual(parse({ palette }).palette, palette);
  assert.deepEqual(parse({ palette: ['#123456'] }).palette, [{ name: 'color1', color: '#123456', deviceColor: '#123456' }]);
});

test('malformed shapes, unsupported names and invalid values are rejected', () => {
  for (const invalid of [null, [], {}, {palette: 'unknown'}, {palette: []},
    {palette: ['#zzzzzz']}, {palette: [null]},
    {...config, imageAdjustmentOptions: []}, {...config, canvasDitherOptions: null},
    {...config, canvasDitherOptions: {ditheringType:'typo'}},
    {...config, canvasDitherOptions: {serpentine:'false'}},
    {...config, canvasDitherOptions: {orderedDitheringMatrix:[0,8]}},
    {...config, imageAdjustmentOptions: {toneMapping:{exposure:'bright'}}},
    {...config, imageAdjustmentOptions: {levelCompression:{black:[1,2]}}},
  ]) assert.throws(() => parse(invalid));
  assert.throws(() => parseDemoConfig('{', choices), /Invalid JSON/);
  assert.throws(() => parseDemoConfig('{"palette":"aitjcizeSpectra6Palette","canvasDitherOptions":{"__proto__":{}}}', choices), /Unknown option/);
});

test('editing one control retains invisible settings and other processing stages', () => {
  const before = { dynamicRangeCompression: {mode:'display',strength:1}, toneMapping:{exposure:0}, clarity:{amount:1} };
  const after = { dynamicRangeCompression: {mode:'display',strength:0.5}, toneMapping:{exposure:0} };
  const original = {...config.imageAdjustmentOptions, clarity:{amount:1,radius:3}};
  const updated = mergeControlChanges(original,before,after);
  assert.equal(updated.dynamicRangeCompression.strength,0.5);
  assert.equal(updated.dynamicRangeCompression.preserveWhite,true);
  assert.deepEqual(updated.paperNormalization,original.paperNormalization);
  assert.equal(updated.clarity,undefined);
  assert.deepEqual(mergeControlChanges(original,before,before),original);
  assert.equal(original.clarity.radius,3);
});
