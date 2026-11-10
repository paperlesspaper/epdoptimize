type Image = { width: number; height: number; data: Uint8ClampedArray };
export type FlatBackground = {
  size: number;
  rgb: number[];
  bounds: [number, number, number, number];
};

/** Recover lettering on a shared flat background without requiring the
 * background's entire contour (including an illustration) to be sharp.
 * Foreground components supply independent evidence: repeated flat glyphs
 * support the layout, while continuous-tone objects reserve their bounds.
 */
export function recoverFlatLayouts(
  image: Image,
  mask: Uint8Array,
  backgrounds: FlatBackground[],
  tolerance: number,
  contrast: number,
): Uint8Array | undefined {
  if (!backgrounds.length) return undefined;
  const { width, height, data } = image;
  const count = width * height;
  const excluded = new Uint8Array(count);
  const visited = new Uint8Array(count);
  const queue = new Int32Array(count);
  const backgroundTolerance = Math.max(12, tolerance * 2);
  const endpointTolerance = Math.max(18, tolerance * 3);
  type Box = { x0: number; y0: number; x1: number; y1: number };
  for (const background of backgrounds.sort((a, b) => b.size - a.size).slice(0, 8)) {
    const [x0, y0, x1, y1] = background.bounds;
    const bg = background.rgb;
    const isBackground = (p: number) =>
      data[p * 4 + 3] === 255 &&
      Math.abs(data[p * 4] - bg[0]) <= backgroundTolerance &&
      Math.abs(data[p * 4 + 1] - bg[1]) <= backgroundTolerance &&
      Math.abs(data[p * 4 + 2] - bg[2]) <= backgroundTolerance;
    visited.fill(0);
    const graphics: Box[] = [], pictures: Box[] = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const seed = y * width + x;
      if (visited[seed] || isBackground(seed)) continue;
      let head = 0, tail = 1, opaque = true;
      const colors = new Map<number, { count: number; sum: number[] }>();
      const box = { x0: x, y0: y, x1: x, y1: y };
      visited[seed] = 1;
      queue[0] = seed;
      while (head < tail) {
        const p = queue[head++], px = p % width, py = Math.floor(p / width);
        box.x0 = Math.min(box.x0, px); box.x1 = Math.max(box.x1, px);
        box.y0 = Math.min(box.y0, py); box.y1 = Math.max(box.y1, py);
        opaque = opaque && data[p * 4 + 3] === 255;
        const i = p * 4;
        const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
        let bin = colors.get(key);
        if (!bin) { bin = { count: 0, sum: [0, 0, 0] }; colors.set(key, bin); }
        bin.count++;
        for (let c = 0; c < 3; c++) bin.sum[c] += data[i + c];
        // Diagonal connectivity includes antialiased contours and avoids
        // splitting textured objects into tiny, apparently flat islands.
        for (let yy = Math.max(y0, py - 1); yy <= Math.min(y1, py + 1); yy++)
          for (let xx = Math.max(x0, px - 1); xx <= Math.min(x1, px + 1); xx++) {
            const q = yy * width + xx;
            if (!visited[q] && !isBackground(q)) { visited[q] = 1; queue[tail++] = q; }
          }
      }
      // The modal foreground is stable under JPEG ringing. The darkest or
      // farthest pixel can instead be a single spurious edge color.
      let dominant = { count: 0, sum: [0, 0, 0] };
      for (const bin of colors.values()) if (bin.count > dominant.count) dominant = bin;
      const delta = bg.map((v, c) => dominant.sum[c] / dominant.count - v);
      const length = delta.reduce((sum, v) => sum + v * v, 0);
      let matching = 0, endpoints = 0;
      for (let j = 0; j < tail; j++) {
        const p = queue[j] * 4;
        const rgb = bg.map((v, c) => data[p + c] - v);
        const t = length ? Math.max(0, Math.min(1, rgb.reduce((sum, v, c) => sum + v * delta[c], 0) / length)) : 0;
        if (Math.max(...rgb.map((v, c) => Math.abs(v - t * delta[c]))) <= endpointTolerance) matching++;
        if (Math.max(...rgb.map((v, c) => Math.abs(v - delta[c]))) <= endpointTolerance) endpoints++;
      }
      const large = Math.min(box.x1 - box.x0 + 1, box.y1 - box.y0 + 1) > Math.min(width, height) * 0.1;
      if (opaque && tail >= 3 && Math.max(...delta.map(Math.abs)) >= contrast &&
        matching / tail >= (large ? 0.99 : 0.9) && endpoints / tail >= (large ? 0.85 : 0.2)) {
        graphics.push(box);
      } else if (!opaque || (box.x1 - box.x0 >= 11 && box.y1 - box.y0 >= 11)) {
        pictures.push(box);
      }
    }
    // Several aligned glyphs establish a text line. A single flat patch in a
    // photograph cannot establish a layout background on its own.
    const aligned = graphics.some(a => {
      let neighbors = 0;
      for (const b of graphics) {
        const ah = a.y1 - a.y0 + 1, bh = b.y1 - b.y0 + 1;
        if (Math.abs(a.y1 - b.y1) <= Math.max(2, Math.min(ah, bh) * 0.35) &&
          Math.max(ah, bh) <= Math.min(ah, bh) * 2 &&
          Math.abs(a.x0 - b.x0) <= Math.max(ah, bh) * 8 && ++neighbors >= 4)
          return true;
      }
      return false;
    });
    if (!aligned) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const p = y * width + x;
      if (isBackground(p)) mask[p] = 1;
    }
    for (const box of graphics)
      for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++)
        if (data[(y * width + x) * 4 + 3] === 255) mask[y * width + x] = 1;
    for (const box of pictures)
      for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++)
        excluded[y * width + x] = 1;
  }
  for (let p = 0; p < count; p++) if (excluded[p]) mask[p] = 0;
  return excluded;
}
