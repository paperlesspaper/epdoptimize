/**
 * A minimal greyscale PNG decoder.
 *
 * The blue-noise mask ships as a 16-bit PNG, and 16 bits is the whole point of
 * it: decoding through a canvas would hand back 8-bit channels and quietly throw
 * away half the precision. Nothing here is general -- it reads the greyscale,
 * non-interlaced files the generator writes and refuses anything else.
 */

export interface GreyscaleImage {
  width: number;
  height: number;
  /** One sample per pixel, 0..255 or 0..65535 depending on the file's depth. */
  samples: Uint16Array;
  maxValue: number;
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  // IDAT carries a zlib wrapper, which is what "deflate" means here;
  // "deflate-raw" would be the headerless variant.
  const stream = new Response(data as BufferSource).body;
  if (!stream) throw new Error("blue noise: cannot read the compressed data");
  const inflated = stream.pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(inflated).arrayBuffer());
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * Undo the per-scanline filters, in place, one row at a time.
 *
 * Each row is predicted from the one above and from `bpp` bytes to the left, so
 * the rows have to be walked in order -- the previous row must already be raw.
 */
function unfilter(raw: Uint8Array, height: number, stride: number, bpp: number): Uint8Array {
  const out = new Uint8Array(height * stride);
  let read = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[read];
    read += 1;
    const line = y * stride;
    const above = line - stride;
    for (let i = 0; i < stride; i += 1) {
      const left = i >= bpp ? out[line + i - bpp] : 0;
      const up = y > 0 ? out[above + i] : 0;
      const upLeft = y > 0 && i >= bpp ? out[above + i - bpp] : 0;
      const x = raw[read + i];
      let value: number;
      switch (filter) {
        case 0:
          value = x;
          break;
        case 1:
          value = x + left;
          break;
        case 2:
          value = x + up;
          break;
        case 3:
          value = x + ((left + up) >> 1);
          break;
        case 4:
          value = x + paeth(left, up, upLeft);
          break;
        default:
          throw new Error(`blue noise: unknown PNG row filter ${filter}`);
      }
      out[line + i] = value & 0xff;
    }
    read += stride;
  }
  return out;
}

export async function decodeGreyscalePng(bytes: Uint8Array): Promise<GreyscaleImage> {
  for (let i = 0; i < SIGNATURE.length; i += 1) {
    if (bytes[i] !== SIGNATURE[i]) throw new Error("blue noise: not a PNG");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  let depth = 0;
  const parts: Uint8Array[] = [];

  let at = SIGNATURE.length;
  while (at + 8 <= bytes.length) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(
      bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]
    );
    const body = at + 8;
    if (type === "IHDR") {
      width = view.getUint32(body);
      height = view.getUint32(body + 4);
      depth = bytes[body + 8];
      const colourType = bytes[body + 9];
      const interlace = bytes[body + 12];
      if (colourType !== 0) {
        throw new Error(`blue noise: expected a greyscale PNG, got colour type ${colourType}`);
      }
      if (interlace !== 0) throw new Error("blue noise: interlaced PNG is not supported");
      if (depth !== 8 && depth !== 16) {
        throw new Error(`blue noise: expected 8 or 16 bits per sample, got ${depth}`);
      }
    } else if (type === "IDAT") {
      parts.push(bytes.subarray(body, body + length));
    } else if (type === "IEND") {
      break;
    }
    at = body + length + 4; // skip the body and its CRC
  }

  if (!width || !height) throw new Error("blue noise: PNG has no IHDR");

  let compressed: Uint8Array;
  if (parts.length === 1) {
    compressed = parts[0];
  } else {
    compressed = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
    let offset = 0;
    for (const part of parts) {
      compressed.set(part, offset);
      offset += part.length;
    }
  }

  const bytesPerSample = depth === 16 ? 2 : 1;
  const stride = width * bytesPerSample;
  const rows = unfilter(await inflate(compressed), height, stride, bytesPerSample);

  const samples = new Uint16Array(width * height);
  if (depth === 16) {
    for (let i = 0; i < samples.length; i += 1) {
      samples[i] = (rows[i * 2] << 8) | rows[i * 2 + 1]; // PNG samples are big-endian
    }
  } else {
    samples.set(rows);
  }

  return { width, height, samples, maxValue: depth === 16 ? 65535 : 255 };
}
