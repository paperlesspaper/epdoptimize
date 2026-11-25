import test from 'node:test';
import assert from 'node:assert/strict';
import { usesSpectra35Tokens } from '../examples/demo/experimental-palette.ts';
import { spectra35ExperimentalPalette, spectra6Palette } from '../dist/index.mjs';

test('recipe output is detected in built-in, cloned and mixed custom palettes', () => {
  assert.equal(usesSpectra35Tokens(spectra35ExperimentalPalette), true);
  assert.equal(usesSpectra35Tokens(JSON.parse(JSON.stringify(spectra35ExperimentalPalette))), true);
  assert.equal(usesSpectra35Tokens([...spectra6Palette, { deviceColor: '#01001a' }]), true);
  for (let i = 0; i < 35; i++) {
    assert.equal(usesSpectra35Tokens([{ deviceColor: '#' + (0x010000 + i).toString(16).padStart(6, '0') }]), true);
  }
  assert.equal(usesSpectra35Tokens(spectra6Palette), false);
  for (const deviceColor of ['#000000', '#FFFFFF', '#00FFFF', '#010023', '#010000ff', '010000']) {
    assert.equal(usesSpectra35Tokens([{ deviceColor }]), false);
  }
});
