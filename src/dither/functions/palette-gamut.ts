import type { RGB } from "../processing";

interface Edge { a: RGB; u: RGB; length: number }
interface Face {
  a: RGB; u: RGB; v: RGB; normal: RGB;
  uu: number; uv: number; vv: number; inverse: number;
}
export type PaletteGamutProjector = (
  r: number, g: number, b: number, output: Float64Array, offset?: number,
) => void;

const subtract = (a: RGB, b: RGB): RGB => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: RGB, b: RGB) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: RGB, b: RGB): RGB => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Reduce collinear palettes, including arbitrarily long grayscale ramps. */
function lineEndpoints(colors: RGB[]): RGB[] | null {
  const a = colors[0], u = subtract(colors[1], a), length = dot(u, u);
  let low = 0, high = 1, first = a, last = colors[1];
  for (const color of colors) {
    const delta = subtract(color, a), perpendicular = cross(delta, u);
    if (dot(perpendicular, perpendicular) > 1e-12 * length) return null;
    const t = dot(delta, u) / length;
    if (t < low) { low = t; first = color; }
    if (t > high) { high = t; last = color; }
  }
  return [first, last];
}

/**
 * Project unmodified byte-valued source RGB onto the palette's convex hull.
 * This uses the same RGB code-value space as native error diffusion, not a
 * physical pigment/linear-light model. In-gamut colors are unchanged; outside
 * colors map to the nearest reachable MIXTURE, not necessarily one ink.
 *
 * Only the source is projected: incoming signed/fractional diffusion errors
 * must not be clipped again. No text detection, region mask or edge threshold.
 * Supports 1–8 distinct inks (including planar/degenerate palettes) and longer
 * collinear palettes. Larger non-collinear palettes retain the existing path.
 */
export function createPaletteGamutProjector(
  palette: RGB[], pixelCount = 65536,
): PaletteGamutProjector | null {
  let colors = [...new Map(palette.map(c => [c.join(","), c])).values()];
  if (!colors.length) return null;
  if (colors.length > 1) {
    const line = lineEndpoints(colors);
    if (line) colors = line;
  }
  if (colors.length > 8) return null;

  const edges: Edge[] = [], faces: Face[] = [];
  let fullDimensional = false;
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const a = colors[i], u = subtract(colors[j], a), uu = dot(u, u);
      edges.push({ a, u, length: uu });
      for (let k = j + 1; k < colors.length; k++) {
        const v = subtract(colors[k], a), normal = cross(u, v);
        if (dot(normal, normal) < 1e-12) continue;
        let positive = false, negative = false;
        for (const p of colors) {
          const side = dot(normal, subtract(p, a));
          positive ||= side > 1e-6;
          negative ||= side < -1e-6;
        }
        if (positive && negative) continue;
        fullDimensional ||= positive || negative;
        // Coplanar palettes keep all triangles: together they cover the polygon.
        const vv = dot(v, v), uv = dot(u, v);
        faces.push({ a, u, v, uu, uv, vv, inverse: 1 / (uu * vv - uv * uv),
          normal: positive ? [-normal[0], -normal[1], -normal[2]] : normal });
      }
    }
  }

  // Bounded exact-key cache: collisions recompute, never approximate colors.
  // Float64 retains the same projected targets in JS and the WASM row buffer.
  const bits = Math.min(16, Math.max(8, Math.ceil(Math.log2(pixelCount || 1))));
  const size = 2 ** bits;
  const keys = new Uint32Array(size).fill(0xffffffff);
  const cache = new Float64Array(size * 3);
  return (r, g, b, output, offset = 0) => {
    const key = (r << 16) | (g << 8) | b;
    const slot = Math.imul(key, 0x9e3779b1) >>> (32 - bits), at = slot * 3;
    if (keys[slot] !== key) {
      let inside = fullDimensional;
      if (inside) for (const f of faces) {
        if (f.normal[0] * (r - f.a[0]) + f.normal[1] * (g - f.a[1]) +
            f.normal[2] * (b - f.a[2]) > 1e-6) { inside = false; break; }
      }
      let red = r, green = g, blue = b;
      if (!inside) {
        let best = Infinity;
        const consider = (cr: number, cg: number, cb: number) => {
          const dr = r - cr, dg = g - cg, db = b - cb;
          const distance = dr * dr + dg * dg + db * db;
          if (distance < best) { best = distance; red = cr; green = cg; blue = cb; }
        };
        for (const c of colors) consider(c[0], c[1], c[2]);
        for (const { a, u, length } of edges) {
          const t = Math.max(0, Math.min(1,
            ((r - a[0]) * u[0] + (g - a[1]) * u[1] + (b - a[2]) * u[2]) / length));
          consider(a[0] + t * u[0], a[1] + t * u[1], a[2] + t * u[2]);
        }
        for (const { a, u, v, uu, uv, vv, inverse } of faces) {
          const dr = r - a[0], dg = g - a[1], db = b - a[2];
          const du = dr * u[0] + dg * u[1] + db * u[2];
          const dv = dr * v[0] + dg * v[1] + db * v[2];
          const beta = (du * vv - dv * uv) * inverse;
          const gamma = (dv * uu - du * uv) * inverse;
          if (beta < 0 || gamma < 0 || beta + gamma > 1) continue;
          consider(a[0] + beta * u[0] + gamma * v[0],
            a[1] + beta * u[1] + gamma * v[1],
            a[2] + beta * u[2] + gamma * v[2]);
        }
      }
      keys[slot] = key;
      cache[at] = red; cache[at + 1] = green; cache[at + 2] = blue;
    }
    output[offset] = cache[at]; output[offset + 1] = cache[at + 1]; output[offset + 2] = cache[at + 2];
  };
}
