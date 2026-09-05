import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import * as esm from '../dist/index.mjs';

const require = createRequire(import.meta.url);
const cjs = require('../dist/index.cjs');
const png = readFileSync(new URL('../src/dither/data/blue-noise-1200x1600.png', import.meta.url));
globalThis.ImageData = class ImageData {
  constructor(data,width,height){Object.assign(this,{data,width,height})}
  get [Symbol.toStringTag](){return 'ImageData'}
};
const canvas = (data,width,height) => {
  const result={width,height,data:new Uint8ClampedArray(data),getContext(){return{
    getImageData:()=>new ImageData(new Uint8ClampedArray(result.data),width,height),
    putImageData:next=>{result.data=new Uint8ClampedArray(next.data)},
  }}};
  return result;
};
async function dither(lib, mode='blueNoise', palette=lib.aitjcizeSpectra6Palette, input=new Uint8ClampedArray(32*32*4).fill(255)) {
  const source=canvas(input,32,32),target=canvas(input,32,32);
  await lib.ditherCanvas(source,target,{palette,ditheringType:mode,processingEngine:'js',orderedDitheringMatrix:[8,8]});
  return target.data;
}

test('shipped ESM and CJS resolve their PNG without fetch or configuration', async () => {
  const saved=globalThis.fetch;
  globalThis.fetch=()=>{throw new Error('Node file assets must not use fetch')};
  try{
    for(const lib of [esm,cjs]) for(const mode of ['blueNoise','ditherItBlueNoise','ordered','ditherItOrdered']){
      const data=await dither(lib,mode);
      for(let i=0;i<data.length;i+=4)assert.deepEqual([...data.slice(i,i+4)],[190,200,200,255]);
    }
  }finally{globalThis.fetch=saved}
});

test('JS bundles stay small and exactly one separate mask is shipped', () => {
  for(const file of ['index.mjs','index.cjs']) assert.ok(statSync(new URL(`../dist/${file}`,import.meta.url)).size<250_000);
  const files=readdirSync(new URL('../dist',import.meta.url),{recursive:true});
  const masks=files.filter(f=>f.endsWith('.png'));
  assert.equal(masks.length,1);
  assert.deepEqual(readFileSync(new URL(`../dist/${masks[0]}`,import.meta.url)),png);
});

test('a public byte override works for both module formats', async () => {
  for(const lib of [esm,cjs]){
    assert.equal(typeof lib.setBlueNoiseSource,'function');
    // A view with nonzero byte offset must not include surrounding bytes.
    const padded=Buffer.concat([Buffer.from([1,2,3]),png,Buffer.from([4])]);
    lib.setBlueNoiseSource(padded.subarray(3,3+png.length));
    await dither(lib);
    lib.setBlueNoiseSource(png.buffer.slice(png.byteOffset,png.byteOffset+png.byteLength));
    await dither(lib);
  }
});

test('non-blue-noise modes never load the mask', async () => {
  const saved=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async()=>{calls++;throw new Error('unexpected fetch')};
  try{
    esm.setBlueNoiseSource('https://example.invalid/mask.png');
    for(const mode of ['ordered','ditherItOrdered','errorDiffusion','quantizationOnly','riemersma'])await dither(esm,mode);
    assert.equal(calls,0);
  }finally{globalThis.fetch=saved}
});

test('concurrent calls share one load and a failed load can be retried', async () => {
  const saved=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async()=>{calls++;return calls===1?new Response('unavailable',{status:503}):new Response(png)};
  try{
    esm.setBlueNoiseSource('https://example.invalid/mask.png');
    await assert.rejects(dither(esm),/503/);
    const outputs=await Promise.all([dither(esm),dither(esm)]);
    assert.equal(calls,2);
    assert.deepEqual(outputs[0],outputs[1]);
  }finally{globalThis.fetch=saved}
});

test('an earlier pending load cannot overwrite a newer source', async () => {
  const saved=globalThis.fetch;
  let rejectOld;
  globalThis.fetch=()=>new Promise((_,reject)=>{rejectOld=reject});
  try{
    esm.setBlueNoiseSource('https://example.invalid/old.png');
    const first=dither(esm);
    const rejected=assert.rejects(first,/old request failed/);
    esm.setBlueNoiseSource(png);
    await dither(esm);
    rejectOld(new Error('old request failed'));
    await rejected;
    globalThis.fetch=()=>{throw new Error('new cached source should survive')};
    await dither(esm);
  }finally{globalThis.fetch=saved}
});

test('two-, three- and sixteen-colour blue noise keeps output in its palette', async () => {
  for(const palette of [esm.genericTwoColorEinkPalette,esm.trmnlSeeed16GrayscalePalette,['#000000','#ffffff','#ff0000']]){
    esm.setBlueNoiseSource(png);
    const input=new Uint8ClampedArray(32*32*4);
    for(let i=0;i<input.length;i+=4)input.set([(i*7)%256,(i*13)%256,(i*23)%256,255],i);
    const data=await dither(esm,'blueNoise',palette,input);
    const allowed=new Set(palette.map(p=>(typeof p==='string'?p:p.color).slice(1).toLowerCase()));
    for(let i=0;i<data.length;i+=4)assert.ok(allowed.has([...data.slice(i,i+3)].map(x=>x.toString(16).padStart(2,'0')).join('')));
  }
});
