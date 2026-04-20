export type RGB = [number, number, number];
export type RGBA = [number, number, number, number];

export type ToneMappingMode = "off" | "contrast" | "scurve";
export type ColorMatchingMode = "rgb" | "lab";
export type DynamicRangeCompressionMode = "off" | "display" | "auto";
export type LevelCompressionMode = "off" | "perChannel" | "luma";

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

export interface ToneMappingOptions {
  mode?: ToneMappingMode;
  exposure?: number;
  saturation?: number;
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
}

export interface ImageProcessingOptions {
  toneMapping?: ToneMappingOptions;
  dynamicRangeCompression?: DynamicRangeCompressionOptions | boolean;
}

export type ProcessingPresetName =
  | "balanced"
  | "dynamic"
  | "vivid"
  | "soft"
  | "grayscale"
  | (string & {});

export interface ProcessingPreset {
  name: ProcessingPresetName;
  title: string;
  description: string;
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

export const PROCESSING_PRESETS: Record<string, ProcessingPreset> = {
  balanced: {
    name: "balanced",
    title: "Balanced",
    description:
      "Compresses display luminance range for general photo conversion.",
    toneMapping: {
      mode: "contrast",
      exposure: 1,
      saturation: 1,
      contrast: 1,
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
      exposure: 1,
      saturation: 1.3,
      strength: 0.9,
      shadowBoost: 0,
      highlightCompress: 1.5,
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
      exposure: 1.1,
      saturation: 1.6,
      strength: 0.7,
      shadowBoost: 0.1,
      highlightCompress: 1.3,
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
      exposure: 1,
      saturation: 1.1,
      contrast: 0.9,
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
      exposure: 1,
      saturation: 0,
      strength: 0.8,
      shadowBoost: 0.1,
      highlightCompress: 1.4,
      midpoint: 0.5,
    },
    dynamicRangeCompression: {
      mode: "display",
      strength: 1,
    },
    colorMatching: "lab",
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
        toneMapping: { ...preset.toneMapping },
        dynamicRangeCompression: preset.dynamicRangeCompression
          ? { ...preset.dynamicRangeCompression }
          : undefined,
      }
    : null;
};

export const getProcessingPresetNames = () => Object.keys(PROCESSING_PRESETS);

export const getProcessingPresetOptions = () =>
  Object.values(PROCESSING_PRESETS).map(({ name, title, description }) => ({
    value: name,
    title,
    description,
  }));

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

export const clampByte = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(clamp(value, 0, 255));
};

export const luma709 = (r: number, g: number, b: number) =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;

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
  let rn = r / 255;
  let gn = g / 255;
  let bn = b / 255;

  rn = rn > 0.04045 ? Math.pow((rn + 0.055) / 1.055, 2.4) : rn / 12.92;
  gn = gn > 0.04045 ? Math.pow((gn + 0.055) / 1.055, 2.4) : gn / 12.92;
  bn = bn > 0.04045 ? Math.pow((bn + 0.055) / 1.055, 2.4) : bn / 12.92;

  return [
    (rn * 0.4124564 + gn * 0.3575761 + bn * 0.1804375) * 100,
    (rn * 0.2126729 + gn * 0.7151522 + bn * 0.072175) * 100,
    (rn * 0.0193339 + gn * 0.119192 + bn * 0.9503041) * 100,
  ] as RGB;
};

const xyzToLab = (x: number, y: number, z: number) => {
  let xn = x / 95.047;
  let yn = y / 100;
  let zn = z / 108.883;

  xn = xn > 0.008856 ? Math.pow(xn, 1 / 3) : 7.787 * xn + 16 / 116;
  yn = yn > 0.008856 ? Math.pow(yn, 1 / 3) : 7.787 * yn + 16 / 116;
  zn = zn > 0.008856 ? Math.pow(zn, 1 / 3) : 7.787 * zn + 16 / 116;

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

const applyExposure = (image: ImageDataLike, exposure: number) => {
  if (exposure === 1) return;
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clampByte(data[i] * exposure);
    data[i + 1] = clampByte(data[i + 1] * exposure);
    data[i + 2] = clampByte(data[i + 2] * exposure);
  }
};

const applyContrast = (image: ImageDataLike, contrast: number) => {
  if (contrast === 1) return;
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clampByte((data[i] - 128) * contrast + 128);
    data[i + 1] = clampByte((data[i + 1] - 128) * contrast + 128);
    data[i + 2] = clampByte((data[i + 2] - 128) * contrast + 128);
  }
};

const applySaturation = (image: ImageDataLike, saturation: number) => {
  if (saturation === 1) return;
  const data = image.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;

    if (max === min) continue;

    const delta = max - min;
    const sat =
      lightness > 0.5
        ? delta / (2 - max - min)
        : delta / Math.max(max + min, 0.000001);

    let hue: number;
    if (max === r) {
      hue = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      hue = ((b - r) / delta + 2) / 6;
    } else {
      hue = ((r - g) / delta + 4) / 6;
    }

    const newSat = clamp(sat * saturation, 0, 1);
    const c = (1 - Math.abs(2 * lightness - 1)) * newSat;
    const x = c * (1 - Math.abs(((hue * 6) % 2) - 1));
    const m = lightness - c / 2;

    let rp = 0;
    let gp = 0;
    let bp = 0;
    const sector = Math.floor(hue * 6);

    if (sector === 0) [rp, gp, bp] = [c, x, 0];
    else if (sector === 1) [rp, gp, bp] = [x, c, 0];
    else if (sector === 2) [rp, gp, bp] = [0, c, x];
    else if (sector === 3) [rp, gp, bp] = [0, x, c];
    else if (sector === 4) [rp, gp, bp] = [x, 0, c];
    else [rp, gp, bp] = [c, 0, x];

    data[i] = clampByte((rp + m) * 255);
    data[i + 1] = clampByte((gp + m) * 255);
    data[i + 2] = clampByte((bp + m) * 255);
  }
};

const applyScurveToneMap = (
  image: ImageDataLike,
  strength: number,
  shadowBoost: number,
  highlightCompress: number,
  midpoint: number
) => {
  if (strength === 0) return;
  const data = image.data;
  const mid = clamp(midpoint, 0.01, 0.99);

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const normalized = data[i + c] / 255;
      let result: number;

      if (normalized <= mid) {
        const shadowValue = normalized / mid;
        result = Math.pow(shadowValue, 1 - strength * shadowBoost) * mid;
      } else {
        const highlightValue = (normalized - mid) / (1 - mid);
        result =
          mid +
          Math.pow(highlightValue, 1 + strength * highlightCompress) *
            (1 - mid);
      }

      data[i + c] = clampByte(result * 255);
    }
  }
};

const percentile = (values: number[], p: number) => {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = clamp(Math.round((sorted.length - 1) * p), 0, sorted.length - 1);
  return sorted[idx];
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
    const lightnesses: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      const [l] = rgbToLab(data[i], data[i + 1], data[i + 2]);
      lightnesses.push(l);
    }
    sourceBlackL = percentile(lightnesses, normalized.lowPercentile ?? 0.01);
    sourceWhiteL = percentile(lightnesses, normalized.highPercentile ?? 0.99);
  }

  const sourceRange = sourceWhiteL - sourceBlackL;
  if (sourceRange <= 0.0001) return;

  for (let i = 0; i < data.length; i += 4) {
    const [l, a, b] = rgbToLab(data[i], data[i + 1], data[i + 2]);
    const normalizedL = clamp((l - sourceBlackL) / sourceRange, 0, 1);
    const compressedL = blackL + normalizedL * targetRange;
    const blendedL = l + (compressedL - l) * strength;
    const [r, g, blue] = labToRgb(blendedL, a, b);

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = blue;
  }
};

export const applyToneMapping = (
  image: ImageDataLike,
  options: ToneMappingOptions | undefined
) => {
  if (!options) return;

  const exposure = options.exposure ?? 1;
  const saturation = options.saturation ?? 1;
  const mode = options.mode ?? "contrast";

  applyExposure(image, exposure);
  applySaturation(image, saturation);

  if (mode === "contrast") {
    applyContrast(image, options.contrast ?? 1);
  } else if (mode === "scurve") {
    applyScurveToneMap(
      image,
      options.strength ?? 0.9,
      options.shadowBoost ?? 0,
      options.highlightCompress ?? 1.5,
      options.midpoint ?? 0.5
    );
  }
};

export const applyImageProcessing = (
  image: ImageDataLike,
  options: ImageProcessingOptions | undefined,
  palette?: RGB[]
) => {
  if (!options) return;
  applyToneMapping(image, options.toneMapping);
  applyDynamicRangeCompression(
    image,
    options.dynamicRangeCompression,
    palette
  );
};

