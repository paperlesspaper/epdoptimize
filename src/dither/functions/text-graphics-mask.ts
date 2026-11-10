import { groupTextAndGraphicsRegions } from "./text-graphics-regions";
import { recoverFlatLayouts, type FlatBackground } from "./text-graphics-layout";

export interface TextAndGraphicsProtectionOptions {
  enabled?: boolean;
  /** Maximum per-channel deviation from a region's seed color (default 6). */
  colorTolerance?: number;
  /** Minimum RGB channel contrast across most of a region's boundary (default 48). */
  edgeContrast?: number;
  /** Minimum connected flat region size at output resolution (default 12). */
  minRegionPixels?: number;
  /** Group candidates into coherent layout regions (default true). False exposes raw pixel candidates. */
  regionGrouping?: boolean;
}

export interface TextAndGraphicsMask {
  width: number;
  height: number;
  /** One byte per pixel: 1 = direct quantization, 0 = normal dithering. */
  mask: Uint8Array;
  protectedPixels: number;
  /** Final connected areas with grouping enabled; accepted seed regions otherwise. */
  regionCount: number;
}

const bounded = (
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
) => (Number.isFinite(value) ? Math.max(min, Math.min(max, value!)) : fallback);

/**
 * Conservative, color-independent layout-region detector, not OCR. Run at the
 * final output size, on the same adjusted pixels that will be dithered.
 * Regions grow against a FIXED seed color: local neighbor similarity alone
 * would chain across a smooth gradient and incorrectly protect the whole ramp.
 * A flat interior is insufficient for a seed; most of its boundary must also
 * be sharp. A second stage removes isolated seeds and completes supported
 * lettering areas, preserving continuous-tone image regions.
 */
export function detectTextAndGraphics(
  image: { width: number; height: number; data: Uint8ClampedArray },
  options: TextAndGraphicsProtectionOptions = {},
): TextAndGraphicsMask {
  const { width, height, data } = image;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 0 ||
    height < 0 ||
    data.length !== width * height * 4
  ) {
    throw new RangeError(
      "Text/graphics detection requires width × height RGBA pixels.",
    );
  }
  const count = width * height;
  const mask = new Uint8Array(count);
  const result = { width, height, mask, protectedPixels: 0, regionCount: 0 };
  if (!count || options.enabled === false) return result;

  const tolerance = bounded(options.colorTolerance, 6, 0, 32);
  const contrast = bounded(options.edgeContrast, 48, 16, 128);
  const minPixels = Math.round(bounded(options.minRegionPixels, 12, 2, count));
  const labels = new Int32Array(count);
  const queue = new Int32Array(count);
  let label = 0;
  const backgrounds: FlatBackground[] = [];

  for (let seed = 0; seed < count; seed++) {
    if (labels[seed] || data[seed * 4 + 3] !== 255) continue;
    label++;
    const sr = data[seed * 4],
      sg = data[seed * 4 + 1],
      sb = data[seed * 4 + 2];
    let head = 0,
      tail = 1;
    queue[0] = seed;
    labels[seed] = label;
    let sumR = 0,
      sumG = 0,
      sumB = 0,
      sumSquares = 0;
    let minX = width, minY = height, maxX = 0, maxY = 0;

    const visit = (p: number) => {
      if (labels[p]) return;
      const i = p * 4;
      if (
        data[i + 3] !== 255 ||
        Math.abs(data[i] - sr) > tolerance ||
        Math.abs(data[i + 1] - sg) > tolerance ||
        Math.abs(data[i + 2] - sb) > tolerance
      )
        return;
      labels[p] = label;
      queue[tail++] = p;
    };

    while (head < tail) {
      const p = queue[head++],
        x = p % width,
        y = Math.floor(p / width),
        i = p * 4;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      sumR += r;
      sumG += g;
      sumB += b;
      sumSquares += r * r + g * g + b * b;
      if (x > 0) visit(p - 1);
      if (x + 1 < width) visit(p + 1);
      if (y > 0) visit(p - width);
      if (y + 1 < height) visit(p + width);
    }
    if (tail < minPixels) continue;
    const mr = sumR / tail,
      mg = sumG / tail,
      mb = sumB / tail;
    const variance = Math.max(
      0,
      (sumSquares / tail - mr * mr - mg * mg - mb * mb) / 3,
    );
    if (variance > Math.max(1, tolerance * tolerance * 0.22)) continue;

    let boundary = 0,
      sharpBoundary = 0;
    for (let j = 0; j < tail; j++) {
      const p = queue[j],
        x = p % width,
        y = Math.floor(p / width);
      const boundaryPixel =
        (x > 0 && labels[p - 1] !== label) ||
        (x + 1 < width && labels[p + 1] !== label) ||
        (y > 0 && labels[p - width] !== label) ||
        (y + 1 < height && labels[p + width] !== label);
      if (!boundaryPixel) continue;
      boundary++;
      let sharp = false;
      // Look through a narrow antialiased fringe, never far into a gradient.
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        for (let step = 1; step <= 3; step++) {
          const xx = x + dx * step,
            yy = y + dy * step;
          if (xx < 0 || xx >= width || yy < 0 || yy >= height) break;
          const q = yy * width + xx,
            i = q * 4;
          if (labels[q] === label || data[i + 3] !== 255) continue;
          if (
            Math.max(
              Math.abs(data[i] - mr),
              Math.abs(data[i + 1] - mg),
              Math.abs(data[i + 2] - mb),
            ) >= contrast
          ) {
            sharp = true;
            break;
          }
        }
        if (sharp) break;
      }
      if (sharp) sharpBoundary++;
    }
    // An entirely uniform image is also a legitimate flat graphic. Image
    // borders themselves are NOT evidence of a sharp contour.
    if (boundary === 0 ? tail !== count : sharpBoundary / boundary < 0.7) {
      if (options.regionGrouping !== false && tail >= Math.max(64, count * 0.08))
        backgrounds.push({ size: tail, rgb: [mr, mg, mb], bounds: [minX, minY, maxX, maxY] });
      continue;
    }
    result.regionCount++;
    for (let j = 0; j < tail; j++) mask[queue[j]] = 1;
  }

  // Add only narrow color-mixture fringes BETWEEN two accepted flat regions.
  // Blind dilation would eat photographic detail next to a protected shape.
  const core = mask.slice();
  for (let p = 0; p < count; p++) {
    if (core[p] || data[p * 4 + 3] !== 255) continue;
    const x = p % width,
      y = Math.floor(p / width);
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1],
    ]) {
      let a = -1,
        b = -1;
      for (let step = 1; step <= 2; step++) {
        const ax = x - step * dx,
          ay = y - step * dy;
        const bx = x + step * dx,
          by = y + step * dy;
        if (
          a < 0 &&
          ax >= 0 &&
          ax < width &&
          ay >= 0 &&
          ay < height &&
          core[ay * width + ax]
        )
          a = (ay * width + ax) * 4;
        if (
          b < 0 &&
          bx >= 0 &&
          bx < width &&
          by >= 0 &&
          by < height &&
          core[by * width + bx]
        )
          b = (by * width + bx) * 4;
      }
      if (a < 0 || b < 0) continue;
      let length = 0,
        projection = 0;
      for (let c = 0; c < 3; c++) {
        const d = data[b + c] - data[a + c];
        length += d * d;
        projection += (data[p * 4 + c] - data[a + c]) * d;
      }
      if (length < contrast * contrast) continue;
      const t = projection / length;
      if (t < 0 || t > 1) continue;
      let residual = 0;
      for (let c = 0; c < 3; c++)
        residual +=
          (data[p * 4 + c] - (data[a + c] + t * (data[b + c] - data[a + c]))) **
          2;
      if (residual <= 3 * Math.max(4, tolerance) ** 2) {
        mask[p] = 1;
        break;
      }
    }
  }
  if (options.regionGrouping !== false) {
    const excluded = recoverFlatLayouts(image, mask, backgrounds, tolerance, contrast);
    result.regionCount = groupTextAndGraphicsRegions(
      image,
      mask,
      tolerance,
      labels,
      excluded,
    );
  }
  for (const value of mask) result.protectedPixels += value;
  return result;
}
