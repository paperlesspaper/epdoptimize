import test from "node:test";
import assert from "node:assert/strict";
import { createPaletteGamutProjector } from "../src/dither/functions/palette-gamut.ts";

const six = [[0,0,0],[255,255,255],[0,0,255],[0,255,0],[255,0,0],[255,255,0]];
const calibrated = [[2,2,2],[190,200,200],[5,64,158],[39,102,60],[135,19,0],[205,202,0]];
const target = (project, rgb) => { const out = new Float64Array(3); project(...rgb, out); return [...out]; };
const close = (actual, expected) => actual.forEach((v,i) => assert.ok(Math.abs(v-expected[i])<1e-8, `${actual} != ${expected}`));

test("palette vertices and reachable mixtures are unchanged", () => {
  for (const palette of [six, calibrated]) {
    const project = createPaletteGamutProjector(palette);
    for (const ink of palette) assert.deepEqual(target(project, ink), ink);
  }
  const project = createPaletteGamutProjector(six);
  for (const rgb of [[85,170,170],[32,64,96],[128,128,128],[1,1,1],[254,254,254]])
    assert.deepEqual(target(project,rgb),rgb);
});

test("unreachable cyan and magenta project to mixtures, not a single ink", () => {
  const project = createPaletteGamutProjector(six);
  close(target(project,[0,255,255]),[85,170,170]);
  close(target(project,[255,0,255]),[170,85,170]);
});

test("calibrated black/white endpoints cannot accumulate impossible error", () => {
  const project = createPaletteGamutProjector(calibrated);
  for (const rgb of [[0,0,0],[1,1,1]]) close(target(project,rgb),calibrated[0]);
  for (const rgb of [[255,255,255],[218,218,218]]) close(target(project,rgb),calibrated[1]);
});

test("singleton, duplicated, line and planar palettes have finite nearest projections", () => {
  close(target(createPaletteGamutProjector([[12,34,56],[12,34,56]]),[200,200,200]),[12,34,56]);
  const line = createPaletteGamutProjector([[200,200,200],[20,20,20],[100,100,100]]);
  close(target(line,[0,255,0]),[85,85,85]);
  close(target(line,[255,255,255]),[200,200,200]);
  const triangle = createPaletteGamutProjector([[0,0,0],[255,0,0],[0,255,0]]);
  close(target(triangle,[255,255,90]),[127.5,127.5,0]);
  close(target(triangle,[20,50,90]),[20,50,0]);
  const square = createPaletteGamutProjector([[0,0,0],[255,0,0],[255,255,0],[0,255,0]]);
  close(target(square,[110,150,200]),[110,150,0]);
});

test("large collinear palettes work, larger general palettes deliberately bypass projection", () => {
  const ramp = Array.from({length:16},(_,i)=>[i*17,i*17,i*17]);
  close(target(createPaletteGamutProjector(ramp),[30,60,90]),[60,60,60]);
  assert.equal(createPaletteGamutProjector([]),null);
  assert.equal(createPaletteGamutProjector([...six,[10,20,30],[40,90,25],[200,40,70]]),null);
});

test("bounded cache collisions and output offsets preserve the exact solution", () => {
  const cached=createPaletteGamutProjector(six,1),paletteCopy=structuredClone(six);
  for(let i=0;i<600;i++){
    const rgb=[i%256,(i*71)%256,(i*109)%256],expected=target(createPaletteGamutProjector(six,1),rgb);
    const out=new Float64Array([999,999,999,999,999,999]);cached(...rgb,out,2);
    assert.deepEqual([...out.slice(2,5)],expected);assert.equal(out[0],999);assert.equal(out[5],999);
  }
  assert.deepEqual(six,paletteCopy);
});
