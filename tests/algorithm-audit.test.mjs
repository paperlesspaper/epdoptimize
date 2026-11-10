import test from 'node:test';
import assert from 'node:assert/strict';
import {ditherCanvas,applyImageDataAdjustments,aitjcizeSpectra6Palette} from '../dist/index.mjs';
globalThis.ImageData=class ImageData{constructor(data,width,height){Object.assign(this,{data,width,height})}get [Symbol.toStringTag](){return 'ImageData'}};
function canvas(w,h,pixel){const c={width:w,height:h,data:new Uint8ClampedArray(w*h*4)};for(let y=0;y<h;y++)for(let x=0;x<w;x++)c.data.set([...pixel(x,y),255],(y*w+x)*4);c.getContext=()=>({getImageData:()=>new ImageData(c.data.slice(),w,h),putImageData:im=>{c.data=im.data.slice()}});return c;}
async function render(source,options){const out=canvas(source.width,source.height,()=>[0,0,0]);await ditherCanvas(source,out,{processingEngine:'js',...options});return out.data;}
const key=(d,i)=>Array.from(d.slice(i,i+3)).join(',');
test('ordered preserves midgray coverage and exact grayscale palette levels',async()=>{
 const palette=['#000000','#ffffff'];const data=await render(canvas(64,64,()=>[128,128,128]),{ditheringType:'ordered',palette});
 let white=0;for(let i=0;i<data.length;i+=4)if(data[i]===255)white++;assert.equal(white,2048);
 for(const levels of [[0,255],[0,85,170,255],Array.from({length:16},(_,i)=>i*17)])for(const v of levels){const input=canvas(16,16,()=>[v,v,v]);const out=await render(input,{ditheringType:'ordered',palette:levels.map(l=>'#'+l.toString(16).padStart(2,'0').repeat(3))});assert.deepEqual(out,input.data);}
});
test('DitherIt serpentine visits column zero on reverse rows, including width one',async()=>{
 for(const width of [1,8,37])for(const errorDiffusionMatrix of ['floydSteinberg','stucki','jarvisJudiceNinke']){
  const data=await render(canvas(width,8,()=>[100,150,200]),{palette:['#000000','#ffffff'],ditheringType:'ditherItErrorDiffusion',serpentine:true,errorDiffusionMatrix});
  for(let i=0;i<data.length;i+=4)assert.ok(['0,0,0','255,255,255'].includes(key(data,i)));
 }
});
test('random modes only emit colors from the requested palette',async()=>{
 const saved=Math.random;let state=123;Math.random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
 try{for(const palette of [aitjcizeSpectra6Palette,['#000000','#ffffff'],['#000000','#ffffff','#ff0000']])for(const randomDitheringType of ['rgb','blackAndWhite']){
  const allowed=new Set(palette.map(p=>typeof p==='string'?p:p.color).map(h=>h.slice(1).match(/../g).map(s=>parseInt(s,16)).join(',')));
  const data=await render(canvas(32,32,(x,y)=>[x*8,y*8,255-x*8]),{palette,ditheringType:'random',randomDitheringType});
  for(let i=0;i<data.length;i+=4)assert.ok(allowed.has(key(data,i)));
 }}finally{Math.random=saved}
});
test('luma black lift is continuous at zero and honors strength',()=>{
 for(const options of [{levelCompression:{mode:'luma',black:50,white:200}},{dynamicRangeCompression:{mode:'display',quality:'fast',black:50,white:200}}]){
  const image={width:2,height:1,data:new Uint8ClampedArray([0,0,0,255,1,1,1,255])};applyImageDataAdjustments(image,options);assert.deepEqual(Array.from(image.data),[50,50,50,255,51,51,51,255]);
 }
 const image={width:1,height:1,data:new Uint8ClampedArray([0,0,0,255])};applyImageDataAdjustments(image,{dynamicRangeCompression:{mode:'display',quality:'fast',black:50,white:200,strength:0.5}});assert.equal(image.data[0],25);
});
test('Jarvis and Jarvis-Judice-Ninke use the same complete kernel',async()=>{
 const source=canvas(64,64,(x)=>[x*4,x*4,x*4]);const options={ditheringType:'errorDiffusion',palette:['#000000','#ffffff'],serpentine:true};
 assert.deepEqual(await render(source,{...options,errorDiffusionMatrix:'jarvis'}),await render(source,{...options,errorDiffusionMatrix:'jarvisJudiceNinke'}));
});
