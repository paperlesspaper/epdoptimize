/**
 * Turn conservative pixel candidates into coherent layout regions. This is a
 * spatial heuristic, not OCR or a rule about where photos/text may be placed.
 * Photo texture forms a large unprotected component; gaps in lettering form
 * small, thin components surrounded by strong graphic/background evidence.
 */
export function groupTextAndGraphicsRegions(
  image: { width: number; height: number; data: Uint8ClampedArray },
  mask: Uint8Array,
  colorTolerance: number,
  colorRegions: Int32Array,
  excluded?: Uint8Array,
): number {
  const { width, height, data } = image;
  const count = width * height;
  const radius = Math.max(
    8,
    Math.min(24, Math.round(Math.min(width, height) / 32)),
  );
  const stride = width + 1;
  const integral = new Uint32Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += mask[y * width + x];
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + row;
    }
  }
  const support = (p: number) => {
    const x = p % width,
      y = Math.floor(p / width);
    const x0 = Math.max(0, x - radius),
      x1 = Math.min(width, x + radius + 1);
    const y0 = Math.max(0, y - radius),
      y1 = Math.min(height, y + radius + 1);
    return (
      (integral[y1 * stride + x1] -
        integral[y0 * stride + x1] -
        integral[y1 * stride + x0] +
        integral[y0 * stride + x0]) /
      ((x1 - x0) * (y1 - y0))
    );
  };
  const queue = new Int32Array(count);
  const visited = new Uint8Array(count);
  const protectedRegionSizes = new Uint32Array(count + 1);
  let retainedPixels = 0;

  // A flat speck inside a photo is not a layout region. Keep connected
  // candidates only when they have substantial support at a larger scale.
  for (let seed = 0; seed < count; seed++) {
    if (!mask[seed] || visited[seed]) continue;
    let head = 0,
      tail = 1,
      supported = 0;
    visited[seed] = 1;
    queue[0] = seed;
    const visit = (p: number) => {
      // Do not let a flat photo speck borrow support through a different-color
      // layout background just because their pixels touch at the boundary.
      if (!visited[p] && mask[p] && colorRegions[p] === colorRegions[seed]) {
        visited[p] = 1;
        queue[tail++] = p;
      }
    };
    while (head < tail) {
      const p = queue[head++],
        x = p % width,
        y = Math.floor(p / width);
      if (support(p) >= 0.6) supported++;
      if (x > 0) visit(p - 1);
      if (x + 1 < width) visit(p + 1);
      if (y > 0) visit(p - width);
      if (y + 1 < height) visit(p + width);
    }
    if (supported < Math.min(tail, Math.max(4, Math.ceil(tail * 0.1)))) {
      for (let j = 0; j < tail; j++) mask[queue[j]] = 0;
    } else {
      retainedPixels += tail;
      protectedRegionSizes[colorRegions[seed]] += tail;
    }
  }
  if (!retainedPixels) return 0;

  // Distance to reliable protection, including diagonal neighbors. A hard
  // thickness limit prevents filling an inset photograph surrounded by text.
  const distance = new Uint8Array(count);
  for (let p = 0; p < count; p++) distance[p] = mask[p] ? 0 : 255;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!distance[p]) continue;
      let d = distance[p];
      if (x > 0) d = Math.min(d, distance[p - 1] + 1);
      if (y > 0) {
        d = Math.min(d, distance[p - width] + 1);
        if (x > 0) d = Math.min(d, distance[p - width - 1] + 1);
        if (x + 1 < width) d = Math.min(d, distance[p - width + 1] + 1);
      }
      distance[p] = d;
    }
  for (let y = height - 1; y >= 0; y--)
    for (let x = width - 1; x >= 0; x--) {
      const p = y * width + x;
      if (!distance[p]) continue;
      let d = distance[p];
      if (x + 1 < width) d = Math.min(d, distance[p + 1] + 1);
      if (y + 1 < height) {
        d = Math.min(d, distance[p + width] + 1);
        if (x > 0) d = Math.min(d, distance[p + width - 1] + 1);
        if (x + 1 < width) d = Math.min(d, distance[p + width + 1] + 1);
      }
      distance[p] = d;
    }

  const maxThickness = Math.max(
    3,
    Math.min(10, Math.round(Math.min(width, height) / 80)),
  );
  const maxGapArea = (radius * 4) ** 2;
  const residualLimit = 3 * Math.max(6, colorTolerance * 2) ** 2;
  visited.fill(0);
  for (let seed = 0; seed < count; seed++) {
    if (mask[seed] || visited[seed]) continue;
    let head = 0,
      tail = 1,
      maxDistance = 0,
      opaque = true,
      supported = 0;
    let minX = width,
      minY = height,
      maxX = 0,
      maxY = 0;
    visited[seed] = 1;
    queue[0] = seed;
    const visit = (p: number) => {
      if (!visited[p] && !mask[p]) {
        visited[p] = 1;
        queue[tail++] = p;
      }
    };
    while (head < tail) {
      const p = queue[head++],
        x = p % width,
        y = Math.floor(p / width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      maxDistance = Math.max(maxDistance, distance[p]);
      opaque = opaque && data[p * 4 + 3] === 255;
      if (support(p) >= 0.5) supported++;
      if (x > 0) visit(p - 1);
      if (x + 1 < width) visit(p + 1);
      if (y > 0) visit(p - width);
      if (y + 1 < height) visit(p + width);
    }
    const boxWidth = maxX - minX + 1,
      boxHeight = maxY - minY + 1;
    if (
      opaque &&
      boxWidth >= 12 &&
      boxHeight >= 12 &&
      tail / (boxWidth * boxHeight) >= 0.9
    ) {
      const colors = new Set<number>();
      for (let j = 0; j < tail && colors.size < 8; j++) {
        const i = queue[j] * 4;
        colors.add(
          ((data[i] >> 3) << 10) |
            ((data[i + 1] >> 3) << 5) |
            (data[i + 2] >> 3),
        );
      }
      if (colors.size >= 8) {
        // A nearly rectangular continuous-tone component is strong evidence
        // of an image/gradient inset. Snap its outline to the rectangle so
        // white pixels at a photo edge cannot attach to the page background.
        // Flat endpoint strips of a ramp can have become candidates themselves.
        // Follow a smooth continuation a few pixels to its actual hard edge,
        // but never extend into a large connected layout background.
        const maxStripRegion = Math.max(64, boxWidth * boxHeight * 0.25);
        const smoothSide = (vertical: boolean, edge: number, next: number) => {
          if (next < 0 || next >= (vertical ? width : height)) return false;
          const start = vertical ? minY : minX,
            end = vertical ? maxY : maxX;
          let difference = 0,
            eligible = 0;
          for (let v = start; v <= end; v++) {
            const p = vertical ? v * width + edge : edge * width + v;
            const q = vertical ? v * width + next : next * width + v;
            if (data[q * 4 + 3] !== 255) return false;
            if (
              mask[q] &&
              protectedRegionSizes[colorRegions[q]] <= maxStripRegion
            )
              eligible++;
            difference += Math.max(
              Math.abs(data[p * 4] - data[q * 4]),
              Math.abs(data[p * 4 + 1] - data[q * 4 + 1]),
              Math.abs(data[p * 4 + 2] - data[q * 4 + 2]),
            );
          }
          return (
            eligible / (end - start + 1) >= 0.8 &&
            difference / (end - start + 1) <= Math.max(12, colorTolerance * 2)
          );
        };
        for (
          let k = 0;
          k < maxThickness && smoothSide(true, minX, minX - 1);
          k++
        )
          minX--;
        for (
          let k = 0;
          k < maxThickness && smoothSide(true, maxX, maxX + 1);
          k++
        )
          maxX++;
        for (
          let k = 0;
          k < maxThickness && smoothSide(false, minY, minY - 1);
          k++
        )
          minY--;
        for (
          let k = 0;
          k < maxThickness && smoothSide(false, maxY, maxY + 1);
          k++
        )
          maxY++;
        for (let y = minY; y <= maxY; y++)
          for (let x = minX; x <= maxX; x++) {
            const p = y * width + x;
            mask[p] = 0;
            visited[p] = 1;
          }
        continue;
      }
    }
    if (
      !opaque ||
      tail > maxGapArea ||
      maxDistance > maxThickness ||
      supported / tail < 0.9
    )
      continue;

    // Antialiasing is approximately a two-color mixture. Do not fill colorful
    // photo fragments merely because they happen to fit between nearby text.
    const farthestFrom = (from: number) => {
      let farthest = from,
        best = -1;
      for (let j = 0; j < tail; j++) {
        const i = queue[j] * 4;
        const d =
          (data[i] - data[from]) ** 2 +
          (data[i + 1] - data[from + 1]) ** 2 +
          (data[i + 2] - data[from + 2]) ** 2;
        if (d > best) {
          best = d;
          farthest = i;
        }
      }
      return farthest;
    };
    const a = farthestFrom(seed * 4),
      b = farthestFrom(a);
    const dr = data[b] - data[a],
      dg = data[b + 1] - data[a + 1],
      db = data[b + 2] - data[a + 2];
    const length = dr * dr + dg * dg + db * db;
    let matching = 0,
      endpoints = 0;
    for (let j = 0; j < tail; j++) {
      const i = queue[j] * 4;
      const r = data[i] - data[a],
        g = data[i + 1] - data[a + 1],
        blue = data[i + 2] - data[a + 2];
      const t = length
        ? Math.max(0, Math.min(1, (r * dr + g * dg + blue * db) / length))
        : 0;
      if (
        (r - t * dr) ** 2 + (g - t * dg) ** 2 + (blue - t * db) ** 2 <=
        residualLimit
      )
        matching++;
      if (t <= 0.2 || t >= 0.8) endpoints++;
    }
    // Broad rectangular ramps have many intermediate shades. Thin edge bands
    // and letter-shaped gaps may consist mostly of antialiasing after resize.
    if (
      matching / tail < 0.95 ||
      (maxDistance > 2 &&
        tail / (boxWidth * boxHeight) >= 0.85 &&
        endpoints / tail < 0.5)
    )
      continue;
    for (let j = 0; j < tail; j++) mask[queue[j]] = 1;
  }

  // Report the actual final protected regions, rather than the seed fragments.
  if (excluded)
    for (let p = 0; p < count; p++) if (excluded[p]) mask[p] = 0;
  let regionCount = 0;
  visited.fill(0);
  for (let seed = 0; seed < count; seed++) {
    if (!mask[seed] || visited[seed]) continue;
    regionCount++;
    let head = 0,
      tail = 1;
    queue[0] = seed;
    visited[seed] = 1;
    const visit = (p: number) => {
      if (!visited[p] && mask[p]) {
        visited[p] = 1;
        queue[tail++] = p;
      }
    };
    while (head < tail) {
      const p = queue[head++],
        x = p % width,
        y = Math.floor(p / width);
      if (x > 0) visit(p - 1);
      if (x + 1 < width) visit(p + 1);
      if (y > 0) visit(p - width);
      if (y + 1 < height) visit(p + width);
    }
  }
  return regionCount;
}
