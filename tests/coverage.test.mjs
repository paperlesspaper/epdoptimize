import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCoverageSolver, solveCoverageWeights, coverageDither } from '../src/utils/coverage.ts';

const palettes = JSON.parse(readFileSync(new URL('../src/dither/data/default-palettes.json', import.meta.url)));
const spectra = palettes['aitjcize-spectra6'].map(p => p.color.slice(1).match(/../g).map(v => parseInt(v, 16)));
const linear = byte => (byte /= 255) <= .04045 ? byte / 12.92 : ((byte + .055) / 1.055) ** 2.4;
const cube = [[0,0,0],[255,0,0],[0,255,0],[0,0,255],[255,255,0],[255,0,255],[0,255,255],[255,255,255]];
function solve(palette, target) {
  const weights = new Float32Array(palette.length);
  solveCoverageWeights(buildCoverageSolver(palette), ...target, weights);
  assert.ok(weights.every(w => Number.isFinite(w) && w >= 0));
  assert.ok(Math.abs(weights.reduce((a,b) => a+b, 0) - 1) < 1e-6);
  return { weights, mix: [0,1,2].map(c => palette.reduce((sum, ink, i) => sum + weights[i] * linear(ink[c]), 0)) };
}

test('bright neutral targets choose the closest display white, without yellow/red', () => {
  for (const value of [220, 240, 255]) {
    const { weights } = solve(spectra, [value,value,value]);
    assert.equal(weights[1], 1);
    assert.equal(weights.filter(w => w > 0).length, 1);
  }
});

test('every exact palette colour remains an unmixed colour', () => {
  for (const palette of [spectra,cube]) for (let i=0;i<palette.length;i++) {
    assert.equal(solve(palette,palette[i]).weights[i], 1);
  }
});

test('outside targets project onto the tetrahedron face, edge and vertex', () => {
  const tetra = cube.slice(0,4);
  const face = solve(tetra,[255,255,255]);
  face.mix.forEach(value => assert.ok(Math.abs(value-1/3)<1e-6));
  const target = [255,188,89];
  const theta = (linear(target[0])+linear(target[1])-1)/2;
  const edge = solve(tetra,target);
  assert.ok(Math.abs(edge.mix[0]-(linear(target[0])-theta))<1e-6);
  assert.ok(Math.abs(edge.mix[1]-(linear(target[1])-theta))<1e-6);
  assert.equal(edge.weights[3],0);
  const dim = tetra.map(ink => ink.map(v => v/3));
  assert.equal(solve(dim,[255,0,0]).weights[1],1);
});

test('coplanar polygon faces are covered: project onto a cube face', () => {
  const dim = cube.map(ink => ink.map(v => v/3));
  const {mix} = solve(dim,[255,40,60]);
  [linear(85),linear(40),linear(60)].forEach((value,c) => assert.ok(Math.abs(mix[c]-value)<1e-6));
});

test('random in-gamut RGB values retain their linear average', () => {
  let seed=7;
  const byte=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>24};
  for(let i=0;i<200;i++){
    const target=[byte(),byte(),byte()];
    const {mix}=solve(cube,target);
    mix.forEach((value,c)=>assert.ok(Math.abs(value-linear(target[c]))<1e-6));
  }
});

test('unsupported palette sizes and grayscale palettes fall back without mutation', () => {
  for(const palette of [cube.slice(0,2),cube.slice(0,3),[...cube,cube[0]],[[0,0,0],[85,85,85],[170,170,170],[255,255,255]]]){
    const data=new Uint8ClampedArray([123,80,45,200]);
    assert.equal(buildCoverageSolver(palette),null);
    assert.equal(coverageDither(data,1,1,palette,()=>.5),false);
    assert.deepEqual([...data],[123,80,45,200]);
  }
});

test('cache collisions do not change exact solutions or alpha', () => {
  const width=257,height=263;
  const data=new Uint8ClampedArray(width*height*4);
  for(let p=0;p<width*height;p++) data.set([(p*17)%256,(p>>>8)%256,p%256,p%255],p*4);
  const source=new Uint8ClampedArray(data);
  assert.equal(coverageDither(data,width,height,spectra,()=>.99999999),true);
  const solver=buildCoverageSolver(spectra),weights=new Float32Array(spectra.length);
  for(let p=0;p<width*height;p+=101){
    solveCoverageWeights(solver,...source.slice(p*4,p*4+3),weights);
    let cumulative=0,index=0;
    for(let i=0;i<weights.length;i++){
      if(weights[i]>0)index=i;
      cumulative+=weights[i];
      if(.99999999<cumulative)break;
    }
    assert.deepEqual([...data.slice(p*4,p*4+3)],spectra[index]);
    assert.equal(data[p*4+3],source[p*4+3]);
  }
});
