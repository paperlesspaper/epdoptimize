// Capture the unchanged build first:
// npm run build && mkdir -p output/error-diffusion-comparison/baseline
// cp dist/index.mjs output/error-diffusion-comparison/baseline/index.mjs
// After rebuilding the fix: node scripts/compare-error-diffusion.mjs [sample filename ...]
// Requires ImageMagick. Only source images are resized; dither outputs stay at 1:1.
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const output = resolve(process.env.COMPARISON_OUTPUT || 'output/error-diffusion-comparison');
const beforePath = resolve(process.env.COMPARISON_BASELINE || `${output}/baseline/index.mjs`);
const afterPath = resolve('dist/index.mjs');
const before = await import(pathToFileURL(beforePath));
const after = await import(pathToFileURL(afterPath));
const palette = after.aitjcizeSpectra6Palette;
const longEdge = 800;
const sampleDir = resolve(process.env.COMPARISON_SAMPLES || 'examples/sampleImages');
const files = process.argv.length > 2 ? process.argv.slice(2) : (await readdir(sampleDir)).filter(f => /\.(png|jpe?g)$/i.test(f)).sort();
const preferred = ['rainbow.png', 'landscape.jpg', 'holiday_photo.jpeg', 'regular_photo.jpeg', 'illustration.png', 'van-gogh-starry-night-google-art-project.jpg', 'VerlaufGrau.png'];
files.sort((a,b) => (preferred.indexOf(a) < 0 ? 999 : preferred.indexOf(a)) - (preferred.indexOf(b) < 0 ? 999 : preferred.indexOf(b)));
const base = { palette, ditheringType:'errorDiffusion', errorDiffusionMatrix:'floydSteinberg', colorMatching:'rgb', serpentine:true, processingEngine:'js' };
const allowed = new Set(palette.map(p => p.color.slice(1).match(/../g).map(v => parseInt(v,16)).join(',')));
const hash = data => createHash('sha256').update(data).digest('hex');
function canvas(width=1,height=1,data=new Uint8ClampedArray(width*height*4)) {
 const c={width,height,data};
 c.getContext=()=>({getImageData:()=>({width:c.width,height:c.height,data:c.data.slice()}),putImageData:im=>Object.assign(c,{...im,data:im.data.slice()})});
 return c;
}
function magick(args,input) { return execFileSync('magick',args,{input,maxBuffer:100*1024*1024}); }
function savePng(c,path) { magick(['-size',`${c.width}x${c.height}`,'-depth','8','rgba:-',path],Buffer.from(c.data)); }
function stats(data) {
 const counts = Object.fromEntries(palette.map(p => [p.name,0]));
 const names = new Map(palette.map(p => [p.color.slice(1).match(/../g).map(v=>parseInt(v,16)).join(','),p.name]));
 for(let i=0;i<data.length;i+=4) {
  const key=`${data[i]},${data[i+1]},${data[i+2]}`;
  assert.ok(allowed.has(key),`Non-palette pixel: ${key}`);
  assert.equal(data[i+3],255);
  counts[names.get(key)]++;
 }
 return Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,+(v*400/data.length).toFixed(2)]));
}
await mkdir(output,{recursive:true});
const entries=[];
for(const file of files) {
 const name=basename(file),dir=resolve(output,name);await mkdir(dir,{recursive:true});
 const original=resolve(dir,'original.png');
 magick([resolve(sampleDir,file),'-auto-orient','-resize',`${longEdge}x${longEdge}>`,'-background','white','-alpha','remove','-alpha','off',original]);
 const [width,height]=magick(['identify','-format','%w %h',original]).toString().split(' ').map(Number);
 const source=canvas(width,height,new Uint8ClampedArray(magick([original,'-depth','8','rgba:-'])));
 const suggestion=before.suggestLayeredProcessingOptions({width,height,data:source.data},palette);
 const entry={name,width,height,sourceSha256:hash(await readFile(resolve(sampleDir,file))),imageKind:suggestion.imageKind,modes:{}};
 for(const mode of ['neutral','auto']) {
  const options=mode==='auto'?{...base,...suggestion.ditherOptions}:base;
  const old=canvas(),next=canvas(),wasm=canvas();
  await before.ditherImage(source,old,options);
  await after.ditherImage(source,next,options);
  if(options.colorMatching==='rgb') {
   await after.ditherImage(source,wasm,{...options,processingEngine:'wasm'});
   assert.deepEqual(wasm.data,next.data,`${name}/${mode}: JS/WASM mismatch`);
  }
  savePng(old,resolve(dir,`${mode}-before.png`));savePng(next,resolve(dir,`${mode}-after.png`));
  let changed=0;for(let i=0;i<old.data.length;i+=4)if(old.data[i]!==next.data[i]||old.data[i+1]!==next.data[i+1]||old.data[i+2]!==next.data[i+2])changed++;
  entry.modes[mode]={options,before:stats(old.data),after:stats(next.data),changedPixels:changed,beforeSha256:hash(old.data),afterSha256:hash(next.data)};
 }
 entries.push(entry);console.log(`${entries.length}/${files.length}: ${name}`);
}
const manifest={createdAt:new Date().toISOString(),baselineSha256:hash(await readFile(beforePath)),afterSha256:hash(await readFile(afterPath)),longEdge,palette,entries};
await writeFile(resolve(output,'comparison.json'),JSON.stringify(manifest,null,2));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const sections=entries.map(e=>`<section data-name="${esc(e.name)}"><h2>${esc(e.name)}</h2><p class="meta">${e.width} × ${e.height} · Erkannt: ${e.imageKind}</p><div class="grid">${[['Original','original.png','original'],['Vorher','neutral-before.png','before'],['Nachher','neutral-after.png','after']].map(([label,path,role])=>`<figure><figcaption>${label}</figcaption><a target="_blank" rel="noopener" data-role="${role}" href="${encodeURIComponent(e.name)}/${path}"><img loading="lazy" width="${e.width}" height="${e.height}" alt="${label}: ${esc(e.name)}" src="${encodeURIComponent(e.name)}/${path}"></a></figure>`).join('')}</div><p class="stats"></p></section>`).join('\n');
await writeFile(resolve(output,'index.html'),`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>EPD Optimizer · Fehlerdiffusion im Vergleich</title><style>
:root{font:16px system-ui,sans-serif;color:#dce8e7;background:#101817;color-scheme:dark}body{margin:0}header{padding:40px max(24px,4vw) 24px;background:#152421;border-bottom:1px solid #34534c}h1{font-size:clamp(26px,4vw,44px);margin:8px 0 16px;letter-spacing:-.04em}header p{max-width:950px;line-height:1.6;color:#b1c5be}.eyebrow{font-size:12px;letter-spacing:.15em;color:#6bd6b5}nav{display:flex;flex-wrap:wrap;gap:18px;align-items:center;padding:16px max(24px,4vw);background:#182b25;position:sticky;top:0;z-index:1;border-bottom:1px solid #34534c}label{display:flex;align-items:center;gap:10px}select,input{font:inherit;padding:9px;border:1px solid #476256;border-radius:7px;background:#101c18}main{padding:0 max(24px,4vw) 50px}section{padding:28px 0;border-bottom:1px solid #34534c}h2{font-size:20px;margin:0;overflow-wrap:anywhere}.meta,.stats{font-size:13px;color:#9eb9ac}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}figure{margin:0}figcaption{padding:10px 0;font-weight:650}figure:last-child figcaption{color:#6bd6b5}img{display:block;width:100%;height:auto;background:#25312b}a{color:#6bd6b5}.note{color:#b6c7c0;font-size:14px}body.zoom .grid{overflow:auto;grid-template-columns:repeat(3,max-content)}body.zoom img{width:auto;max-width:none}@media(max-width:650px){.grid{gap:6px}main{padding:0 12px}nav{position:static}h2{font-size:16px}figcaption{font-size:12px}}
</style><header><div class="eyebrow">EPD OPTIMIZER / ISSUE #27</div><h1>Fehlerdiffusion: Vorher → Nachher</h1><p>Alle ${entries.length} lokalen Beispielbilder mit unveränderter Palette und identischen Einstellungen. Vorher: begrenzte 8-Bit-Zwischenwerte. Nachher: vorzeichenbehafteter Fließkommapuffer mit Begrenzung extremer Fehlerbeträge. Die Bilder zeigen die simulierten Displayfarben der Palette <strong>aitjcize Spectra 6</strong>.</p><p class="note">Neutral isoliert die Fehlerdiffusion. Automatik verwendet für beide Seiten dieselbe Empfehlung aus dem Vorher-Stand. Die Eingabe wird auf maximal 800 Pixel Kantenlänge verkleinert. Bilder anklicken für die volle Auflösung. Die Vorschau ersetzt keinen Test auf dem Panel.</p></header><nav><label>Verarbeitung <select id="mode"><option value="neutral">Neutral · nur Dithering</option><option value="auto">Automatik · identische Bildkorrekturen</option></select></label><label>Bild suchen <input id="search" type="search" placeholder="z. B. rainbow"></label><label><input id="zoom" type="checkbox">1:1-Pixel</label><a href="comparison.json">Einstellungen & Messwerte</a><span id="count"></span></nav><main>${sections}</main><script>
const entries=${JSON.stringify(entries).replaceAll('<','\\u003c')};
const mode=document.querySelector('#mode'),search=document.querySelector('#search');
function update(){let visible=0;for(const [i,section] of [...document.querySelectorAll('section')].entries()) {const e=entries[i],m=mode.value;section.hidden=!e.name.toLowerCase().includes(search.value.toLowerCase());if(!section.hidden)visible++;for(const role of ['before','after']){const a=section.querySelector('[data-role='+role+']'),src=encodeURIComponent(e.name)+'/'+m+'-'+role+'.png';a.href=src;a.querySelector('img').src=src;}const result=e.modes[m];section.querySelector('.stats').textContent='Weißanteil: '+result.before.white.toFixed(1)+' % → '+result.after.white.toFixed(1)+' % · '+(result.changedPixels*100/(e.width*e.height)).toFixed(1)+' % der Pixel geändert · '+result.options.colorMatching.toUpperCase()+' / '+result.options.errorDiffusionMatrix+' · Weißanteil allein ist kein Qualitätsmaß.';}document.querySelector('#count').textContent=visible+' / '+entries.length+' Bilder';}
mode.addEventListener('change',update);search.addEventListener('input',update);document.querySelector('#zoom').addEventListener('change',e=>document.body.classList.toggle('zoom',e.target.checked));update();</script></html>`);
console.log('Gallery: '+resolve(output,'index.html'));
