import { luma709, type ImageDataLike, type RGB } from "../processing";

// Interpolate between adjacent levels instead of adding a positive RGB bias.
// For grayscale palettes this preserves exact palette entries and the mean
// encoded RGB level. Alpha is left untouched.
export function lumaThresholdDither(
  image: ImageDataLike,
  palette: RGB[],
  thresholdAt: (x: number, y: number) => number
): void {
  if (!palette.length) return;
  const levels = palette.map(color => ({ color, luma: luma709(...color) }))
    .sort((a, b) => a.luma - b.luma);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      const target = luma709(image.data[i], image.data[i + 1], image.data[i + 2]);
      let upper = 0;
      while (upper < levels.length - 1 && levels[upper].luma < target) upper++;
      const low = levels[Math.max(0, upper - 1)];
      const high = levels[upper];
      const span = high.luma - low.luma;
      const fraction = span > 0 ? Math.max(0, Math.min(1, (target - low.luma) / span)) : 0;
      const color = thresholdAt(x, y) < fraction ? high.color : low.color;
      image.data[i] = color[0];
      image.data[i + 1] = color[1];
      image.data[i + 2] = color[2];
    }
  }
}
