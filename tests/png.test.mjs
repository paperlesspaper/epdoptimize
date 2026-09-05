import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { decodeGreyscalePng } from '../src/utils/png.ts';

function chunk(type, data) {
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length);
  result.write(type, 4);
  result.set(data, 8);
  // The decoder deliberately does not validate CRCs.
  return result;
}

function png(depth, rows) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(2, 0);
  header.writeUInt32BE(1, 4);
  header[8] = depth;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

test('PNG decoder preserves 16-bit samples and supports each scanline filter', async () => {
  for (const depth of [8, 16]) {
    const expected = depth === 8 ? [19, 201] : [0x1234, 0xabcd];
    const bytes = depth === 8 ? [19, 201] : [0x12, 0x34, 0xab, 0xcd];
    const bpp = depth / 8;
    for (let filter = 0; filter <= 4; filter++) {
      const encoded = bytes.map((value, i) => {
        const left = i >= bpp ? bytes[i - bpp] : 0;
        const prediction = filter === 1 || filter === 4 ? left : filter === 3 ? left >> 1 : 0;
        return (value - prediction) & 255;
      });
      const decoded = await decodeGreyscalePng(png(depth, [filter, ...encoded]));
      assert.deepEqual([...decoded.samples], expected);
      assert.equal(decoded.maxValue, depth === 8 ? 255 : 65535);
    }
  }
});

test('PNG decoder rejects truncated chunks, missing ends and invalid scanlines', async () => {
  const valid = png(8, [0, 19, 201]);
  await assert.rejects(decodeGreyscalePng(valid.subarray(0, valid.length - 2)), /truncated/);
  await assert.rejects(decodeGreyscalePng(valid.subarray(0, valid.length - 12)), /incomplete/);
  await assert.rejects(decodeGreyscalePng(png(8, [0, 19])), /scanline length/);
  await assert.rejects(decodeGreyscalePng(png(8, [5, 19, 201])), /unknown PNG row filter/);
});
