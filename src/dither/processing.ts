export type RGB = [number, number, number];
export type RGBA = [number, number, number, number];

export type ToneMappingMode = "off" | "contrast" | "scurve";
export type ColorMatchingMode = "rgb" | "lab" | "chroma";
export type DynamicRangeCompressionMode = "off" | "display" | "auto";
export type LevelCompressionMode = "off" | "perChannel" | "luma";
export type PaperNormalizationMode = "off" | "warmPaper";
export type AdjustmentQuality = "fast" | "accurate";

export type LevelRGB = number | RGB;

export interface PercentileClip {
  low: number;
  high: number;
}

export interface LevelCompressionOptions {
  mode?: LevelCompressionMode;
  black?: LevelRGB;
  white?: LevelRGB;
  auto?: boolean;
  autoThreshold?: number;
  percentileClip?: PercentileClip;
}

export interface ClarityOptions {
  amount?: number;
  radius?: number;
  midtone?: number;
}

export interface ToneMappingOptions {
  mode?: ToneMappingMode;
  /**
   * Exposure adjustment in stops. `0` is neutral, `1` doubles brightness.
   */
  exposure?: number;
  /**
   * Saturation adjustment. `0` is neutral, `0.5` means 1.5x, `-1` removes saturation.
   */
  saturation?: number;
  /**
   * Contrast adjustment. `0` is neutral, `0.25` means 1.25x, `-1` means 0.5x.
   */
  contrast?: number;
  strength?: number;
  shadowBoost?: number;
  highlightCompress?: number;
  midpoint?: number;
}

export interface DynamicRangeCompressionOptions {
  mode?: DynamicRangeCompressionMode;
  black?: LevelRGB;
  white?: LevelRGB;
  strength?: number;
  lowPercentile?: number;
  highPercentile?: number;
  quality?: AdjustmentQuality;
  preserveWhite?: boolean;
  whitePreservePercentile?: number;
  whitePreserveMinLuma?: number;
  whitePreserveMaxSaturation?: number;
}

export interface PaperNormalizationOptions {
  mode?: PaperNormalizationMode;
  strength?: number;
  minLuma?: number;
  saturationThreshold?: number;
  warmBiasThreshold?: number;
  blackAnchor?: number;
  preserveRed?: number;
  paperWhite?: LevelRGB;
}

export interface ImageProcessingOptions {
  paperNormalization?: PaperNormalizationOptions;
  clarity?: ClarityOptions;
  toneMapping?: ToneMappingOptions;
  dynamicRangeCompression?: DynamicRangeCompressionOptions | boolean;
  levelCompression?: LevelCompressionOptions;
  previewMode?: "fast" | "final";
}

export type ProcessingPresetName =
  | "balanced"
  | "dynamic"
  | "vivid"
  | "soft"
  | "grayscale"
  | "restore"
  | "posterScan"
  | (string & {});

export interface ProcessingPreset {
  name: ProcessingPresetName;
  title: string;
  description: string;
  paperNormalization?: PaperNormalizationOptions;
  toneMapping: ToneMappingOptions;
  dynamicRangeCompression?: DynamicRangeCompressionOptions;
  colorMatching?: ColorMatchingMode;
  errorDiffusionMatrix?: string;
}

export interface ImageDataLike {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

const exposureAdjustmentFromMultiplier = (multiplier: number) =>
  Number(Math.log2(multiplier).toFixed(3));

const linearAdjustmentFromMultiplier = (multiplier: number) =>
  Number((multiplier - 1).toFixed(3));

const exposureAdjustmentToMultiplier = (adjustment: number) =>
  Math.pow(2, adjustment);

const linearAdjustmentToMultiplier = (adjustment: number) =>
  Math.max(0, adjustment + 1);

const contrastAdjustmentToMultiplier = (adjustment: number) =>
  adjustment < 0 ? Math.max(0.5, 1 + adjustment * 0.5) : adjustment + 1;

export const PROCESSING_PRESETS: Record<string, ProcessingPreset> = {
  balanced: {
    name: "balanced",
    title: "Balanced",
    description:
      "Compresses display luminance range for general photo conversion.",
    toneMapping: {
      mode: "contrast",
      exposure: 0,
      saturation: 0,
      contrast: 0,
    },
    dynamicRangeCompression: {
      mode: "display",
      strength: 1,
    },
    colorMatching: "rgb",
    errorDiffusionMatrix: "floydSteinberg",
  },
  dynamic: {
    name: "dynamic",
    title: "Dynamic",
    description:
      "Uses S-curve tone mapping for brighter, punchier photographic output.",
    toneMapping: {
      mode: "scurve",
      exposure: 0,
      saturation: linearAdjustmentFromMultiplier(1.3),
      strength: 0.9,
      shadowBoost: 0,
      highlightCompress: -1.5,
      midpoint: 0.5,
    },
    dynamicRangeCompression: {
      mode: "off",
    },
    colorMatching: "rgb",
    errorDiffusionMatrix: "floydSteinberg",
  },
  vivid: {
    name: "vivid",
    title: "Vivid",
    description: "Boosts color and applies a gentler S-curve for illustrations.",
    toneMapping: {
      mode: "scurve",
      exposure: exposureAdjustmentFromMultiplier(1.1),
      saturation: linearAdjustmentFromMultiplier(1.6),
      strength: 0.7,
      shadowBoost: 0.1,
      highlightCompress: -1.3,
      midpoint: 0.5,
    },
    dynamicRangeCompression: {
      mode: "off",
    },
    colorMatching: "rgb",
    errorDiffusionMatrix: "floydSteinberg",
  },
  soft: {
    name: "soft",
    title: "Soft",
    description: "Reduces contrast and uses Stucki diffusion for smoother tones.",
    toneMapping: {
      mode: "contrast",
      exposure: 0,
      saturation: linearAdjustmentFromMultiplier(1.1),
      contrast: linearAdjustmentFromMultiplier(0.9),
    },
    dynamicRangeCompression: {
      mode: "display",
      strength: 1,
    },
    colorMatching: "rgb",
    errorDiffusionMatrix: "stucki",
  },
  grayscale: {
    name: "grayscale",
    title: "Grayscale",
    description: "Removes saturation and uses LAB matching for monochrome work.",
    toneMapping: {
      mode: "scurve",
      exposure: 0,
      saturation: linearAdjustmentFromMultiplier(0),
      strength: 0.8,
      shadowBoost: 0.1,
      highlightCompress: -1.4,
      midpoint: 0.5,
    },
    dynamicRangeCompression: {
      mode: "display",
      strength: 1,
    },
    colorMatching: "lab",
    errorDiffusionMatrix: "floydSteinberg",
  },
  restore: {
    name: "restore",
    title: "Restore",
    description:
      "Expands faded scans and paintings before mapping them to the display range.",
    toneMapping: {
      mode: "scurve",
      exposure: exposureAdjustmentFromMultiplier(1.08),
      saturation: linearAdjustmentFromMultiplier(0.9),
      strength: 1,
      shadowBoost: 0.25,
      highlightCompress: -0.75,
      midpoint: 0.46,
    },
    dynamicRangeCompression: {
      mode: "auto",
      strength: 0.9,
      lowPercentile: 0.02,
      highPercentile: 0.98,
    },
    colorMatching: "lab",
    errorDiffusionMatrix: "floydSteinberg",
  },
  posterscan: {
    name: "posterScan",
    title: "Poster Scan",
    description:
      "Neutralizes warm paper, anchors black ink, and preserves strong poster colors.",
    paperNormalization: {
      mode: "warmPaper",
      strength: 0.95,
      minLuma: 82,
      saturationThreshold: 0.56,
      warmBiasThreshold: 8,
      blackAnchor: 0.95,
      preserveRed: 0.85,
      paperWhite: [248, 248, 246],
    },
    toneMapping: {
      mode: "scurve",
      exposure: exposureAdjustmentFromMultiplier(1.04),
      saturation: linearAdjustmentFromMultiplier(1.05),
      strength: 0.92,
      shadowBoost: 0.08,
      highlightCompress: -0.55,
      midpoint: 0.44,
    },
    dynamicRangeCompression: {
      mode: "auto",
      strength: 1,
      lowPercentile: 0.015,
      highPercentile: 0.985,
    },
    colorMatching: "rgb",
    errorDiffusionMatrix: "floydSteinberg",
  },
};

export const getProcessingPreset = (
  name: ProcessingPresetName
): ProcessingPreset | null => {
  const preset = PROCESSING_PRESETS[String(name).toLowerCase()];
  return preset
    ? {
        ...preset,
        paperNormalization: preset.paperNormalization
          ? { ...preset.paperNormalization }
          : undefined,
        toneMapping: { ...preset.toneMapping },
        dynamicRangeCompression: preset.dynamicRangeCompression
          ? { ...preset.dynamicRangeCompression }
          : undefined,
      }
    : null;
};

export const getProcessingPresetNames = () =>
  Object.values(PROCESSING_PRESETS).map(({ name }) => name);

export const getProcessingPresetOptions = () =>
  Object.values(PROCESSING_PRESETS).map(({ name, title, description }) => ({
    value: name,
    title,
    description,
  }));

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

const SHADOW_TONE_RESPONSE = 1.5;

export const clampByte = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(clamp(value, 0, 255));
};

export const luma709 = (r: number, g: number, b: number) =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;

const srgbToLinear = (() => {
  const values = new Float64Array(256);
  for (let value = 0; value < values.length; value += 1) {
    const normalized = value / 255;
    values[value] =
      normalized > 0.04045
        ? Math.pow((normalized + 0.055) / 1.055, 2.4)
        : normalized / 12.92;
  }
  return values;
})();

const labForwardPivot = (value: number) =>
  value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;

const rgbToLabLightness = (r: number, g: number, b: number) => {
  const y =
    srgbToLinear[r] * 0.2126729 +
    srgbToLinear[g] * 0.7151522 +
    srgbToLinear[b] * 0.072175;

  return 116 * labForwardPivot(y) - 16;
};

export const toRGB = (value: LevelRGB | undefined, fallback: number): RGB => {
  if (Array.isArray(value)) {
    return [
      value[0] ?? fallback,
      value[1] ?? fallback,
      value[2] ?? fallback,
    ];
  }
  const v = typeof value === "number" ? value : fallback;
  return [v, v, v];
};

export const toScalar = (value: LevelRGB | undefined, fallback: number) => {
  if (Array.isArray(value)) {
    return luma709(
      value[0] ?? fallback,
      value[1] ?? fallback,
      value[2] ?? fallback
    );
  }
  return typeof value === "number" ? value : fallback;
};

const rgbToXyz = (r: number, g: number, b: number) => {
  const rn = linearizeSrgbChannel(r);
  const gn = linearizeSrgbChannel(g);
  const bn = linearizeSrgbChannel(b);

  return [
    (rn * 0.4124564 + gn * 0.3575761 + bn * 0.1804375) * 100,
    (rn * 0.2126729 + gn * 0.7151522 + bn * 0.072175) * 100,
    (rn * 0.0193339 + gn * 0.119192 + bn * 0.9503041) * 100,
  ] as RGB;
};

// Diffusion candidates contain fractional and out-of-range channels. Preserve
// these for matching; indexing the byte lookup with them would produce NaN.
const linearizeSrgbChannel = (value: number) => {
  const cached = srgbToLinear[value];
  if (cached !== undefined) return cached;
  const normalized = value / 255;
  return normalized > 0.04045
    ? Math.pow((normalized + 0.055) / 1.055, 2.4)
    : normalized / 12.92;
};

const xyzToLab = (x: number, y: number, z: number) => {
  const xn = labForwardPivot(x / 95.047);
  const yn = labForwardPivot(y / 100);
  const zn = labForwardPivot(z / 108.883);

  return [116 * yn - 16, 500 * (xn - yn), 200 * (yn - zn)] as RGB;
};

export const rgbToLab = (r: number, g: number, b: number) => {
  const [x, y, z] = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
};

const labToXyz = (l: number, a: number, b: number) => {
  let y = (l + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;

  x = x > 0.206897 ? Math.pow(x, 3) : (x - 16 / 116) / 7.787;
  y = y > 0.206897 ? Math.pow(y, 3) : (y - 16 / 116) / 7.787;
  z = z > 0.206897 ? Math.pow(z, 3) : (z - 16 / 116) / 7.787;

  return [x * 95.047, y * 100, z * 108.883] as RGB;
};

const xyzToRgb = (x: number, y: number, z: number) => {
  const xn = x / 100;
  const yn = y / 100;
  const zn = z / 100;

  let r = xn * 3.2404542 + yn * -1.5371385 + zn * -0.4985314;
  let g = xn * -0.969266 + yn * 1.8760108 + zn * 0.041556;
  let b = xn * 0.0556434 + yn * -0.2040259 + zn * 1.0572252;

  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;

  return [clampByte(r * 255), clampByte(g * 255), clampByte(b * 255)] as RGB;
};

export const labToRgb = (l: number, a: number, b: number) => {
  const [x, y, z] = labToXyz(l, a, b);
  return xyzToRgb(x, y, z);
};

export const deltaE = (lab1: RGB, lab2: RGB) => {
  const dl = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];
  return Math.sqrt(dl * dl + da * da + db * db);
};

const getSaturation = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  return max === 0 ? 0 : (max - min) / max;
};

const normalize = (value: number, min: number, max: number) =>
  clamp((value - min) / (max - min), 0, 1);

const smoothstep = (edge0: number, edge1: number, value: number) => {
  if (edge1 <= edge0) return value >= edge1 ? 1 : 0;
  const x = normalize(value, edge0, edge1);
  return x * x * (3 - 2 * x);
};

const getDynamicRangeChromaProtection = (r: number, g: number, b: number) =>
  smoothstep(0.18, 0.68, getSaturation(r, g, b)) * 0.85;

const isRedInk = (r: number, g: number, b: number, saturation: number) =>
  saturation >= 0.34 && r >= g + 24 && r >= b + 28;

const applyPaperNormalization = (
  image: ImageDataLike,
  options: PaperNormalizationOptions | undefined
) => {
  if (!options || options.mode === "off") return;

  const strength = clamp(options.strength ?? 1, 0, 1);
  if (strength === 0) return;

  const data = image.data;
  const minLuma = options.minLuma ?? 86;
  const saturationThreshold = options.saturationThreshold ?? 0.44;
  const warmBiasThreshold = options.warmBiasThreshold ?? 8;
  const blackAnchor = clamp(options.blackAnchor ?? 0.85, 0, 1);
  const preserveRed = clamp(options.preserveRed ?? 0.75, 0, 1);
  const paperWhite = toRGB(options.paperWhite, 248);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = luma709(r, g, b);
    const saturation = getSaturation(r, g, b);
    const redInk = isRedInk(r, g, b, saturation);

    if (redInk) {
      const redBoost = strength * preserveRed;
      data[i] = clampByte(r + (255 - r) * 0.08 * redBoost);
      data[i + 1] = clampByte(g * (1 - 0.08 * redBoost));
      data[i + 2] = clampByte(b * (1 - 0.12 * redBoost));
      continue;
    }

    const darkNeutralMask =
      normalize(112 - luma, 0, 72) * normalize(0.42 - saturation, 0, 0.32);
    if (darkNeutralMask > 0) {
      const amount = darkNeutralMask * blackAnchor * strength;
      data[i] = clampByte(r * (1 - 0.72 * amount));
      data[i + 1] = clampByte(g * (1 - 0.72 * amount));
      data[i + 2] = clampByte(b * (1 - 0.72 * amount));
      continue;
    }

    const warmBias = Math.min(r - b, (r + g) / 2 - b);
    const warmPaperMask =
      normalize(luma, minLuma, 210) *
      normalize(245 - luma, 0, 80) *
      normalize(saturationThreshold - saturation, 0, saturationThreshold) *
      normalize(warmBias, warmBiasThreshold, 34);

    if (warmPaperMask <= 0) continue;

    const amount = warmPaperMask * strength;
    const targetLuma = Math.min(
      252,
      luma + (paperWhite[0] - luma) * (0.72 + 0.2 * strength)
    );
    const neutralR = targetLuma + (paperWhite[0] - 248) * 0.4;
    const neutralG = targetLuma + (paperWhite[1] - 248) * 0.4;
    const neutralB = targetLuma + (paperWhite[2] - 248) * 0.4;

    data[i] = clampByte(r + (neutralR - r) * amount);
    data[i + 1] = clampByte(g + (neutralG - g) * amount);
    data[i + 2] = clampByte(b + (neutralB - b) * amount);
  }
};

const applyClarity = (
  image: ImageDataLike,
  options: ClarityOptions | undefined,
  previewMode: "fast" | "final" = "final"
) => {
  if (!options) return;

  const amount = clamp(options.amount ?? 0, -1, 1);
  if (amount === 0) return;
  if (previewMode === "fast") return;

  const effectiveAmount = amount * 2;
  const radius = clamp(Math.round(options.radius ?? 2), 1, 4);
  const midtone = Math.max(0.1, options.midtone ?? 1.2);
  const { data, width, height } = image;
  const { source, temp } = getClarityScratch(data.length);
  source.set(data);
  const kernelSize = radius * 2 + 1;

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const xi = clamp(k, 0, width - 1);
      const index = (row + xi) * 4;
      sumR += source[index];
      sumG += source[index + 1];
      sumB += source[index + 2];
    }

    for (let x = 0; x < width; x += 1) {
      const output = (y * width + x) * 4;
      temp[output] = sumR / kernelSize;
      temp[output + 1] = sumG / kernelSize;
      temp[output + 2] = sumB / kernelSize;

      const removeX = clamp(x - radius, 0, width - 1);
      const addX = clamp(x + radius + 1, 0, width - 1);
      const removeIndex = (row + removeX) * 4;
      const addIndex = (row + addX) * 4;
      sumR += source[addIndex] - source[removeIndex];
      sumG += source[addIndex + 1] - source[removeIndex + 1];
      sumB += source[addIndex + 2] - source[removeIndex + 2];
    }
  }

  for (let x = 0; x < width; x += 1) {
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const yi = clamp(k, 0, height - 1);
      const index = (yi * width + x) * 4;
      sumR += temp[index];
      sumG += temp[index + 1];
      sumB += temp[index + 2];
    }

    for (let y = 0; y < height; y += 1) {
      const output = (y * width + x) * 4;
      const blurredR = sumR / kernelSize;
      const blurredG = sumG / kernelSize;
      const blurredB = sumB / kernelSize;
      const r = source[output];
      const g = source[output + 1];
      const b = source[output + 2];
      const lightness = luma709(r, g, b) / 255;
      const midtoneWeight = Math.pow(
        clamp(1 - Math.abs(2 * lightness - 1), 0, 1),
        midtone
      );

      data[output] = clampByte(
        r + effectiveAmount * (r - blurredR) * midtoneWeight
      );
      data[output + 1] = clampByte(
        g + effectiveAmount * (g - blurredG) * midtoneWeight
      );
      data[output + 2] = clampByte(
        b + effectiveAmount * (b - blurredB) * midtoneWeight
      );

      const removeY = clamp(y - radius, 0, height - 1);
      const addY = clamp(y + radius + 1, 0, height - 1);
      const removeIndex = (removeY * width + x) * 4;
      const addIndex = (addY * width + x) * 4;
      sumR += temp[addIndex] - temp[removeIndex];
      sumG += temp[addIndex + 1] - temp[removeIndex + 1];
      sumB += temp[addIndex + 2] - temp[removeIndex + 2];
    }
  }
};

let clarityScratch:
  | {
      length: number;
      source: Uint8ClampedArray;
      temp: Uint8ClampedArray;
    }
  | undefined;

const getClarityScratch = (length: number) => {
  if (!clarityScratch || clarityScratch.length < length) {
    clarityScratch = {
      length,
      source: new Uint8ClampedArray(length),
      temp: new Uint8ClampedArray(length),
    };
  }
  return clarityScratch;
};

const buildScurveLookup = (
  strength: number,
  shadowBoost: number,
  highlightBoost: number,
  midpoint: number
) => {
  const mid = clamp(midpoint, 0.01, 0.99);
  const shadowExponent = clamp(
    1 - strength * shadowBoost * SHADOW_TONE_RESPONSE,
    0.15,
    3
  );
  const highlightExponent = clamp(1 - strength * highlightBoost, 0.15, 3);
  const lookup = new Uint8ClampedArray(256);

  for (let value = 0; value < lookup.length; value += 1) {
    const normalized = value / 255;
    let result: number;

    if (normalized <= mid) {
      const shadowValue = normalized / mid;
      result = Math.pow(shadowValue, shadowExponent) * mid;
    } else {
      const highlightValue = (normalized - mid) / (1 - mid);
      result =
        mid + Math.pow(highlightValue, highlightExponent) * (1 - mid);
    }

    lookup[value] = clampByte(result * 255);
  }

  return lookup;
};

const LIGHTNESS_HISTOGRAM_SCALE = 100;
const LIGHTNESS_HISTOGRAM_BINS = 100 * LIGHTNESS_HISTOGRAM_SCALE + 1;

const percentileFromHistogram = (
  histogram: Uint32Array,
  count: number,
  p: number
) => {
  if (count <= 0) return 0;

  const target = clamp(Math.round((count - 1) * p), 0, count - 1);
  let seen = 0;

  for (let index = 0; index < histogram.length; index += 1) {
    seen += histogram[index];
    if (seen > target) return index / LIGHTNESS_HISTOGRAM_SCALE;
  }

  return 100;
};

const BYTE_HISTOGRAM_BINS = 256;

const percentileFromByteHistogram = (
  histogram: Uint32Array,
  count: number,
  p: number
) => {
  if (count <= 0) return 0;

  const target = clamp(Math.round((count - 1) * p), 0, count - 1);
  let seen = 0;

  for (let index = 0; index < histogram.length; index += 1) {
    seen += histogram[index];
    if (seen > target) return index;
  }

  return 255;
};

const CHROMA_GUARD_STEPS = 5;

const isProtectedChromaFit = (
  sourceLuma: number,
  resultR: number,
  resultG: number,
  resultB: number,
  sourceSaturation: number
) => {
  if (sourceSaturation < 0.16) return true;

  const resultSaturation = getSaturation(resultR, resultG, resultB);
  const minimumSaturation = Math.max(0.12, sourceSaturation * 0.72);
  if (resultSaturation >= minimumSaturation) return true;

  return luma709(resultR, resultG, resultB) <= sourceLuma + 4;
};

const labToRgbWithChromaGuard = (
  sourceR: number,
  sourceG: number,
  sourceB: number,
  sourceL: number,
  a: number,
  b: number,
  targetL: number,
  amount: number
) => {
  const sourceSaturation = getSaturation(sourceR, sourceG, sourceB);
  const sourceLuma = luma709(sourceR, sourceG, sourceB);
  const toRgb = (fitAmount: number) =>
    labToRgb(sourceL + (targetL - sourceL) * fitAmount, a, b);
  const result = toRgb(amount);

  if (
    targetL <= sourceL ||
    isProtectedChromaFit(
      sourceLuma,
      result[0],
      result[1],
      result[2],
      sourceSaturation
    )
  ) {
    return result;
  }

  let low = 0;
  let high = amount;
  let protectedResult: RGB = [sourceR, sourceG, sourceB];

  for (let step = 0; step < CHROMA_GUARD_STEPS; step += 1) {
    const mid = (low + high) / 2;
    const candidate = toRgb(mid);

    if (
      isProtectedChromaFit(
        sourceLuma,
        candidate[0],
        candidate[1],
        candidate[2],
        sourceSaturation
      )
    ) {
      low = mid;
      protectedResult = candidate;
    } else {
      high = mid;
    }
  }

  return protectedResult;
};

const getPaletteEndpoints = (
  palette: RGB[] | undefined,
  black: LevelRGB | undefined,
  white: LevelRGB | undefined
) => {
  if (black !== undefined && white !== undefined) {
    return {
      black: toRGB(black, 0),
      white: toRGB(white, 255),
    };
  }

  if (!palette || palette.length === 0) {
    return {
      black: toRGB(black, 0),
      white: toRGB(white, 255),
    };
  }

  let darkest = palette[0];
  let lightest = palette[0];
  for (const color of palette) {
    if (luma709(...color) < luma709(...darkest)) darkest = color;
    if (luma709(...color) > luma709(...lightest)) lightest = color;
  }

  return {
    black: black !== undefined ? toRGB(black, 0) : darkest,
    white: white !== undefined ? toRGB(white, 255) : lightest,
  };
};

const normalizeDynamicRangeOptions = (
  options: DynamicRangeCompressionOptions | boolean | undefined
): DynamicRangeCompressionOptions | undefined => {
  if (options === true) return { mode: "display", strength: 1 };
  if (!options || options.mode === "off") return undefined;
  return options;
};

const applyDynamicRangeCompression = (
  image: ImageDataLike,
  options: DynamicRangeCompressionOptions | boolean | undefined,
  palette: RGB[] | undefined
) => {
  const normalized = normalizeDynamicRangeOptions(options);
  if (!normalized) return;

  const mode = normalized.mode ?? "display";
  const strength = clamp(normalized.strength ?? 1, 0, 1);
  if (strength === 0) return;

  if (normalized.quality === "fast") {
    applyFastDynamicRangeCompression(image, normalized, palette);
    return;
  }

  const { black, white } = getPaletteEndpoints(
    palette,
    normalized.black,
    normalized.white
  );
  const [blackL] = rgbToLab(...black);
  const [whiteL] = rgbToLab(...white);
  const targetRange = whiteL - blackL;
  if (targetRange <= 0) return;

  const data = image.data;
  let sourceBlackL = 0;
  let sourceWhiteL = 100;

  if (mode === "auto") {
    const lightnessHistogram = new Uint32Array(LIGHTNESS_HISTOGRAM_BINS);
    let lightnessCount = 0;

    for (let i = 0; i < data.length; i += 4) {
      const l = rgbToLabLightness(data[i], data[i + 1], data[i + 2]);
      const bin = clamp(
        Math.round(l * LIGHTNESS_HISTOGRAM_SCALE),
        0,
        LIGHTNESS_HISTOGRAM_BINS - 1
      );
      lightnessHistogram[bin] += 1;
      lightnessCount += 1;
    }
    sourceBlackL = percentileFromHistogram(
      lightnessHistogram,
      lightnessCount,
      normalized.lowPercentile ?? 0.01
    );
    sourceWhiteL = percentileFromHistogram(
      lightnessHistogram,
      lightnessCount,
      normalized.highPercentile ?? 0.99
    );
  }

  const sourceRange = sourceWhiteL - sourceBlackL;
  if (sourceRange <= 0.0001) return;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const blue = data[i + 2];
    const [l, a, b] = rgbToLab(r, g, blue);
    const normalizedL = clamp((l - sourceBlackL) / sourceRange, 0, 1);
    const compressedL = blackL + normalizedL * targetRange;
    const chromaProtection = getDynamicRangeChromaProtection(r, g, blue);
    const effectiveStrength = strength * (1 - chromaProtection);
    const [newR, newG, newBlue] = labToRgbWithChromaGuard(
      r,
      g,
      blue,
      l,
      a,
      b,
      compressedL,
      effectiveStrength
    );

    data[i] = newR;
    data[i + 1] = newG;
    data[i + 2] = newBlue;
  }
};

const applyFastDynamicRangeCompression = (
  image: ImageDataLike,
  options: DynamicRangeCompressionOptions,
  palette: RGB[] | undefined
) => {
  const mode = options.mode ?? "display";
  const strength = clamp(options.strength ?? 1, 0, 1);
  if (strength === 0) return;

  const { black, white } = getPaletteEndpoints(
    palette,
    options.black,
    options.white
  );
  const blackY = luma709(...black);
  const whiteY = luma709(...white);
  const targetRange = whiteY - blackY;
  if (targetRange <= 0) return;

  const data = image.data;
  let sourceBlackY = 0;
  let sourceWhiteY = 255;

  if (mode === "auto") {
    const histogram = new Uint32Array(BYTE_HISTOGRAM_BINS);
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      histogram[clampByte(luma709(data[i], data[i + 1], data[i + 2]))] += 1;
      count += 1;
    }
    sourceBlackY = percentileFromByteHistogram(
      histogram,
      count,
      options.lowPercentile ?? 0.01
    );
    sourceWhiteY = percentileFromByteHistogram(
      histogram,
      count,
      options.highPercentile ?? 0.99
    );
  }

  const sourceRange = sourceWhiteY - sourceBlackY;
  if (sourceRange <= 0.0001) return;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const y = luma709(r, g, b);
    const normalizedY = clamp((y - sourceBlackY) / sourceRange, 0, 1);
    const targetY = blackY + normalizedY * targetRange;
    const chromaProtection = getDynamicRangeChromaProtection(r, g, b);
    const effectiveStrength = strength * (1 - chromaProtection);
    const nextY = y + (targetY - y) * effectiveStrength;
    let ratio = y > 0 ? nextY / y : 0;
    const maxChannel = Math.max(r, g, b);
    if (maxChannel > 0) ratio = Math.min(ratio, 255 / maxChannel);

    data[i] = clampByte(r * ratio);
    data[i + 1] = clampByte(g * ratio);
    data[i + 2] = clampByte(b * ratio);
  }
};

const shouldEnableLevelCompression = (
  image: ImageDataLike,
  mode: Exclude<LevelCompressionMode, "off">,
  black: LevelRGB | undefined,
  white: LevelRGB | undefined,
  autoThreshold: number
) => {
  const data = image.data;
  const pixelCount = Math.floor(data.length / 4);
  if (pixelCount <= 0) return false;

  let outOfRange = 0;
  if (mode === "perChannel") {
    const b = toRGB(black, 0);
    const w = toRGB(white, 255);
    const bR = b[0];
    const bG = b[1];
    const bB = b[2];
    const wR = w[0];
    const wG = w[1];
    const wB = w[2];

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const bch = data[i + 2];
      if (r < bR || r > wR || g < bG || g > wG || bch < bB || bch > wB) {
        outOfRange += 1;
      }
    }
  } else {
    const b = toScalar(black, 0);
    const w = toScalar(white, 255);
    for (let i = 0; i < data.length; i += 4) {
      const y = luma709(data[i], data[i + 1], data[i + 2]);
      if (y < b || y > w) outOfRange += 1;
    }
  }

  return outOfRange / pixelCount >= autoThreshold;
};

const shouldApplyLevelCompression = (
  image: ImageDataLike,
  options: LevelCompressionOptions | undefined
) => {
  if (!options) return false;
  const mode: LevelCompressionMode = options.mode ?? "perChannel";
  if (mode === "off") return false;

  if (options.auto === true) {
    const autoThreshold =
      typeof options.autoThreshold === "number" ? options.autoThreshold : 0.01;
    return shouldEnableLevelCompression(
      image,
      mode,
      options.black,
      options.white,
      autoThreshold
    );
  }

  return true;
};

const applyLevelCompression = (
  image: ImageDataLike,
  options: LevelCompressionOptions | undefined
) => {
  if (!shouldApplyLevelCompression(image, options) || !options) return;

  const mode: LevelCompressionMode = options.mode ?? "perChannel";
  const data = image.data;
  if (mode === "perChannel") {
    const black = toRGB(options.black, 0);
    const white = toRGB(options.white, 255);

    const bR = black[0];
    const bG = black[1];
    const bB = black[2];
    const wR = white[0];
    const wG = white[1];
    const wB = white[2];

    const dR = wR - bR;
    const dG = wG - bG;
    const dB = wB - bB;
    if (dR <= 0 || dG <= 0 || dB <= 0) return;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = clampByte(bR + (data[i] * dR) / 255);
      data[i + 1] = clampByte(bG + (data[i + 1] * dG) / 255);
      data[i + 2] = clampByte(bB + (data[i + 2] * dB) / 255);
    }
    return;
  }

  const blackL = toScalar(options.black, 0);
  const whiteL = toScalar(options.white, 255);
  const dL = whiteL - blackL;
  if (dL <= 0) return;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const y = luma709(r, g, b);
    const yNew = blackL + (y * dL) / 255;
    let ratio = y > 0 ? yNew / y : 0;
    const maxChannel = Math.max(r, g, b);
    if (maxChannel > 0) ratio = Math.min(ratio, 255 / maxChannel);

    data[i] = clampByte(r * ratio);
    data[i + 1] = clampByte(g * ratio);
    data[i + 2] = clampByte(b * ratio);
  }
};

export const applyToneMapping = (
  image: ImageDataLike,
  options: ToneMappingOptions | undefined,
  levelCompression?: LevelCompressionOptions
) => {
  if (!options && !levelCompression) return;

  let applyLevel =
    levelCompression &&
    shouldApplyLevelCompression(image, levelCompression) &&
    levelCompression.auto !== true &&
    (levelCompression.mode ?? "perChannel") === "perChannel";
  const exposure = exposureAdjustmentToMultiplier(options?.exposure ?? 0);
  const saturation = linearAdjustmentToMultiplier(options?.saturation ?? 0);
  const contrast = contrastAdjustmentToMultiplier(options?.contrast ?? 0);
  const mode = options?.mode;
  const exposureLookup = new Uint8ClampedArray(256);
  const toneLookup = new Uint8ClampedArray(256);
  const levelLookupR = new Uint8ClampedArray(256);
  const levelLookupG = new Uint8ClampedArray(256);
  const levelLookupB = new Uint8ClampedArray(256);
  const scurveLookup =
    (!mode || mode === "scurve") &&
    (options?.strength ?? (mode === "scurve" ? 0.9 : 0)) !== 0
      ? buildScurveLookup(
          options?.strength ?? (mode === "scurve" ? 0.9 : 0),
          options?.shadowBoost ?? 0,
          options?.highlightCompress ?? -1.5,
          options?.midpoint ?? 0.5
        )
      : undefined;

  for (let value = 0; value < 256; value += 1) {
    exposureLookup[value] = clampByte(value * exposure);
    let toneValue = value;
    if (mode !== "off") {
      if (!mode || mode === "contrast") {
        toneValue = clampByte((toneValue - 128) * contrast + 128);
      }
      if (scurveLookup) {
        toneValue = scurveLookup[toneValue];
      }
    }
    toneLookup[value] = toneValue;
  }

  if (applyLevel && levelCompression) {
    const black = toRGB(levelCompression.black, 0);
    const white = toRGB(levelCompression.white, 255);
    const ranges = [
      white[0] - black[0],
      white[1] - black[1],
      white[2] - black[2],
    ];
    if (ranges[0] <= 0 || ranges[1] <= 0 || ranges[2] <= 0) {
      applyLevel = false;
    }

    for (let value = 0; value < 256; value += 1) {
      levelLookupR[value] = clampByte(black[0] + (value * ranges[0]) / 255);
      levelLookupG[value] = clampByte(black[1] + (value * ranges[1]) / 255);
      levelLookupB[value] = clampByte(black[2] + (value * ranges[2]) / 255);
    }
  }

  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    if (saturation === 1) {
      const r = toneLookup[exposureLookup[data[i]]];
      const g = toneLookup[exposureLookup[data[i + 1]]];
      const b = toneLookup[exposureLookup[data[i + 2]]];
      data[i] = applyLevel ? levelLookupR[r] : r;
      data[i + 1] = applyLevel ? levelLookupG[g] : g;
      data[i + 2] = applyLevel ? levelLookupB[b] : b;
      continue;
    }

    const r0 = exposureLookup[data[i]] / 255;
    const g0 = exposureLookup[data[i + 1]] / 255;
    const b0 = exposureLookup[data[i + 2]] / 255;

    const max = Math.max(r0, g0, b0);
    const min = Math.min(r0, g0, b0);
    const lightness = (max + min) / 2;
    let r = r0;
    let g = g0;
    let b = b0;

    if (max !== min) {
      const delta = max - min;
      const sat =
        lightness > 0.5
          ? delta / (2 - max - min)
          : delta / Math.max(max + min, 0.000001);
      let hue: number;
      if (max === r0) {
        hue = ((g0 - b0) / delta + (g0 < b0 ? 6 : 0)) / 6;
      } else if (max === g0) {
        hue = ((b0 - r0) / delta + 2) / 6;
      } else {
        hue = ((r0 - g0) / delta + 4) / 6;
      }

      const newSat = clamp(sat * saturation, 0, 1);
      const c = (1 - Math.abs(2 * lightness - 1)) * newSat;
      const x = c * (1 - Math.abs(((hue * 6) % 2) - 1));
      const m = lightness - c / 2;
      const sector = Math.floor(hue * 6);

      if (sector === 0) [r, g, b] = [c + m, x + m, m];
      else if (sector === 1) [r, g, b] = [x + m, c + m, m];
      else if (sector === 2) [r, g, b] = [m, c + m, x + m];
      else if (sector === 3) [r, g, b] = [m, x + m, c + m];
      else if (sector === 4) [r, g, b] = [x + m, m, c + m];
      else [r, g, b] = [c + m, m, x + m];
    }

    const nextR = toneLookup[clampByte(r * 255)];
    const nextG = toneLookup[clampByte(g * 255)];
    const nextB = toneLookup[clampByte(b * 255)];
    data[i] = applyLevel ? levelLookupR[nextR] : nextR;
    data[i + 1] = applyLevel ? levelLookupG[nextG] : nextG;
    data[i + 2] = applyLevel ? levelLookupB[nextB] : nextB;
  }

  if (levelCompression && !applyLevel) {
    applyLevelCompression(image, levelCompression);
  }
};

export const applyImageProcessing = (
  image: ImageDataLike,
  options: ImageProcessingOptions | undefined,
  palette?: RGB[]
) => {
  if (!options) return;
  applyPaperNormalization(image, options.paperNormalization);
  applyClarity(image, options.clarity, options.previewMode);
  const canFuseLevel =
    !normalizeDynamicRangeOptions(options.dynamicRangeCompression) &&
    options.levelCompression?.auto !== true;
  applyToneMapping(
    image,
    options.toneMapping,
    canFuseLevel ? options.levelCompression : undefined
  );
  applyDynamicRangeCompression(
    image,
    options.dynamicRangeCompression,
    palette
  );
  if (!canFuseLevel) {
    applyLevelCompression(image, options.levelCompression);
  }
};
