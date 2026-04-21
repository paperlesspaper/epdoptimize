import palettes from "./data/default-palettes.json";
import diffusionMaps from "./data/diffusion-maps";
//import thresholdMaps from "./data/threshold-maps.json";

/* Functions */
import bayerMatrix from "./functions/bayer-matrix";
import colorHelpers from "./functions/color-helpers";
// import colorPaletteFromImage from "./functions/color-palette-from-image";
import utilities from "./functions/utilities";
import findClosestPaletteColor from "./functions/find-closest-palette-color";
import {
  applyImageProcessing,
  clampByte,
  getProcessingPreset,
  luma709,
  toRGB,
  toScalar,
  type ColorMatchingMode,
  type DynamicRangeCompressionOptions,
  type ImageProcessingOptions,
  type LevelCompressionMode,
  type LevelCompressionOptions,
  type LevelRGB,
  type PercentileClip,
  type ProcessingPreset,
  type ProcessingPresetName,
  type RGB,
  type RGBA,
  type ToneMappingMode,
  type ToneMappingOptions,
} from "./processing";
import {
  getNamedColors,
  type PaletteColorEntry,
  type PaletteRegistry,
} from "./functions/palette-order";

export type DitheringType =
  | "errorDiffusion"
  | "ordered"
  | "random"
  | "quantizationOnly"
  | (string & {});

export interface DitherImageOptions {
  /**
   * Upstream-style processing preset. Presets fill in tone mapping, dynamic
   * range compression, color matching, and diffusion defaults unless overridden.
   */
  processingPreset?: ProcessingPresetName;

  /** Main dithering algorithm. */
  ditheringType?: DitheringType;

  /** Error diffusion kernel (e.g. `floydSteinberg`). */
  errorDiffusionMatrix?: string;

  /**
   * Backwards-compatible alias for `errorDiffusionMatrix`.
   * (The README historically used `algorithm`.)
   */
  algorithm?: string;

  serpentine?: boolean;

  orderedDitheringType?: string;
  /** Tuple preferred; `number[]` accepted for convenience. */
  orderedDitheringMatrix?: [number, number] | number[];

  randomDitheringType?: "blackAndWhite" | "rgb" | (string & {});

  /** Palette name, custom hex strings, or combined palette entries. */
  palette?: string | string[] | PaletteColorEntry[];

  /** Color distance model for palette matching. */
  colorMatching?: ColorMatchingMode;

  sampleColorsFromImage?: boolean;
  numberOfSampleColors?: number;

  /** Reserved/ignored by current implementation (kept for UI compatibility). */
  calibrate?: boolean;

  /**
   * Optional preprocessing step to remap pixel values into the display’s effective black/white limits.
   *
   * Default: undefined (disabled) for backwards compatibility.
   */
  levelCompression?: LevelCompressionOptions;

  /**
   * Exposure/saturation plus contrast or S-curve tone mapping.
   */
  toneMapping?: ToneMappingOptions;

  /**
   * LAB lightness compression into the calibrated display black/white range.
   */
  dynamicRangeCompression?: DynamicRangeCompressionOptions | boolean;
}

export interface ImageDataLike {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface Canvas2DContextLike {
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageDataLike;
  putImageData(imageData: ImageDataLike, dx: number, dy: number): void;
}

export interface CanvasLike {
  width: number;
  height: number;
  getContext(contextId: "2d"): Canvas2DContextLike | null;
}

export type {
  ColorMatchingMode,
  DynamicRangeCompressionOptions,
  ImageProcessingOptions,
  LevelCompressionMode,
  LevelCompressionOptions,
  LevelRGB,
  PercentileClip,
  ProcessingPreset,
  ProcessingPresetName,
  RGB,
  RGBA,
  ToneMappingMode,
  ToneMappingOptions,
};

const defaultOptions: Required<
  Pick<
    DitherImageOptions,
    | "ditheringType"
    | "errorDiffusionMatrix"
    | "serpentine"
    | "orderedDitheringType"
    | "orderedDitheringMatrix"
    | "randomDitheringType"
    | "palette"
    | "colorMatching"
    | "sampleColorsFromImage"
    | "numberOfSampleColors"
  >
> = {
  ditheringType: "errorDiffusion",

  errorDiffusionMatrix: "floydSteinberg",
  serpentine: false,

  orderedDitheringType: "bayer",
  orderedDitheringMatrix: [4, 4],

  randomDitheringType: "blackAndWhite",

  palette: "default",
  colorMatching: "rgb",

  sampleColorsFromImage: false,
  numberOfSampleColors: 10,
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
        outOfRange++;
      }
    }
  } else {
    const b = toScalar(black, 0);
    const w = toScalar(white, 255);
    for (let i = 0; i < data.length; i += 4) {
      const y = luma709(data[i], data[i + 1], data[i + 2]);
      if (y < b || y > w) outOfRange++;
    }
  }

  return outOfRange / pixelCount >= autoThreshold;
};

const applyLevelCompression = (
  image: ImageDataLike,
  options: LevelCompressionOptions
) => {
  const mode: LevelCompressionMode = options.mode ?? "perChannel";
  if (mode === "off") return;

  const auto = options.auto === true;
  const autoThreshold =
    typeof options.autoThreshold === "number" ? options.autoThreshold : 0.01;

  if (auto) {
    const enabled = shouldEnableLevelCompression(
      image,
      mode,
      options.black,
      options.white,
      autoThreshold
    );
    if (!enabled) return;
  }

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
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Map [0..255] -> [black..white] to keep output within the display's usable range.
      data[i] = clampByte(bR + (r * dR) / 255);
      data[i + 1] = clampByte(bG + (g * dG) / 255);
      data[i + 2] = clampByte(bB + (b * dB) / 255);
    }
    return;
  }

  // mode === 'luma'
  const blackL = toScalar(options.black, 0);
  const whiteL = toScalar(options.white, 255);
  const dL = whiteL - blackL;
  if (dL <= 0) return;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const y = luma709(r, g, b);

    // Map [0..255] -> [black..white]
    const yNew = blackL + (y * dL) / 255;
    let ratio = y > 0 ? yNew / y : 0;

    // Prevent overflow clipping by capping the ratio based on the brightest channel.
    const maxChannel = Math.max(r, g, b);
    if (maxChannel > 0) {
      ratio = Math.min(ratio, 255 / maxChannel);
    }

    data[i] = clampByte(r * ratio);
    data[i + 1] = clampByte(g * ratio);
    data[i + 2] = clampByte(b * ratio);
  }
};

const mergeImageProcessingOptions = (
  options: DitherImageOptions & typeof defaultOptions
): ImageProcessingOptions | undefined => {
  const hasToneMapping = options.toneMapping !== undefined;
  const hasDynamicRangeCompression =
    options.dynamicRangeCompression !== undefined;

  if (!hasToneMapping && !hasDynamicRangeCompression) return undefined;

  return {
    toneMapping: options.toneMapping,
    dynamicRangeCompression: options.dynamicRangeCompression,
  };
};

const getPresetDefaults = (presetName: ProcessingPresetName | undefined) => {
  if (!presetName) return {};
  const preset = getProcessingPreset(presetName);
  if (!preset) return {};

  return {
    toneMapping: preset.toneMapping,
    dynamicRangeCompression: preset.dynamicRangeCompression,
    colorMatching: preset.colorMatching,
    errorDiffusionMatrix: preset.errorDiffusionMatrix,
  } satisfies Partial<DitherImageOptions>;
};

const ditherImage = async (
  sourceCanvas: CanvasLike,
  canvas: CanvasLike,
  opts: DitherImageOptions = {}
): Promise<CanvasLike | undefined> => {
  if (!sourceCanvas || !canvas) {
    return;
  }

  const ctx = sourceCanvas.getContext("2d");
  if (!ctx) return;
  const image = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);

  const options: DitherImageOptions & typeof defaultOptions = {
    ...defaultOptions,
    ...getPresetDefaults(opts.processingPreset),
    ...opts,
  };

  // Backwards-compatible alias (README historically used `algorithm`).
  if (opts.algorithm && !opts.errorDiffusionMatrix) {
    options.errorDiffusionMatrix = opts.algorithm;
  }

  const width = image.width;
  const height = image.height;
  let colorPalette: RGB[] = [];

  if (!options.palette || options.sampleColorsFromImage === true) {
    // colorPalette = colorPaletteFromImage(image, options.numberOfSampleColors);
  } else {
    colorPalette = setColorPalette(options.palette);
  }

  applyImageProcessing(image, mergeImageProcessingOptions(options), colorPalette);

  if (options.levelCompression) {
    applyLevelCompression(image, options.levelCompression);
  }

  function setPixel(pixelIndex, pixel) {
    image.data[pixelIndex] = pixel[0];
    image.data[pixelIndex + 1] = pixel[1];
    image.data[pixelIndex + 2] = pixel[2];
    image.data[pixelIndex + 3] = pixel[3] ?? 255;
  }

  const thresholdMap = bayerMatrix([
    options.orderedDitheringMatrix[0],
    options.orderedDitheringMatrix[1],
  ]);

  let current, newPixel, oldPixel;

  for (current = 0; current < image.data.length; current += 4) {
    const currentPixel = current;
    oldPixel = getPixelColorValues(currentPixel, image.data);

    if (
      !options.ditheringType ||
      options.ditheringType === "quantizationOnly"
    ) {
      newPixel = findClosestPaletteColor(
        oldPixel,
        colorPalette,
        options.colorMatching
      );
      setPixel(currentPixel, newPixel);
    }

    if (
      options.ditheringType === "random" &&
      options.randomDitheringType === "rgb"
    ) {
      newPixel = randomDitherPixelValue(oldPixel);
      setPixel(currentPixel, newPixel);
    }

    if (
      options.ditheringType === "random" &&
      options.randomDitheringType === "blackAndWhite"
    ) {
      newPixel = randomDitherBlackAndWhitePixelValue(oldPixel);
      setPixel(currentPixel, newPixel);
    }

    if (options.ditheringType === "ordered") {
      const orderedDitherThreshold = 256 / 4;
      newPixel = orderedDitherPixelValue(
        oldPixel,
        pixelXY(currentPixel / 4, width),
        thresholdMap,
        orderedDitherThreshold
      );
      newPixel = findClosestPaletteColor(
        newPixel,
        colorPalette,
        options.colorMatching
      );
      setPixel(currentPixel, newPixel);
    }

    if (options.ditheringType === "errorDiffusion") {
      break;
    }
  }

  if (options.ditheringType === "errorDiffusion") {
    applyErrorDiffusion(
      image,
      width,
      height,
      colorPalette,
      options.errorDiffusionMatrix,
      options.colorMatching,
      options.serpentine
    );
  }

  return imageDataToCanvas(image, canvas);
};

const getPixelColorValues = (
  pixelIndex: number,
  data: Uint8ClampedArray
): RGBA => {
  return [
    data[pixelIndex],
    data[pixelIndex + 1],
    data[pixelIndex + 2],
    data[pixelIndex + 3],
  ];
};

const getQuantError = (oldPixel: RGBA, newPixel: RGBA): RGBA => {
  //const maxValue = 255
  const quant = oldPixel.map((color, i) => {
    return color - newPixel[i];
  });

  return quant as RGBA;
};

const addQuantError = (
  pixel: RGBA,
  quantError: RGBA,
  diffusionFactor: number
): RGBA => {
  return pixel.map(
    (color, i) =>
      i === 3 ? color : clampByte(color + quantError[i] * diffusionFactor)
  ) as RGBA;
};

const getDiffusionMap = (matrixName: string) => {
  const matrixFactory = diffusionMaps[matrixName] || diffusionMaps.floydSteinberg;
  return matrixFactory();
};

const applyErrorDiffusion = (
  image: ImageDataLike,
  width: number,
  height: number,
  colorPalette: RGB[],
  matrixName: string,
  colorMatching: ColorMatchingMode,
  serpentine: boolean
) => {
  const diffusionMap = getDiffusionMap(matrixName);

  for (let y = 0; y < height; y++) {
    const reverse = serpentine && y % 2 === 1;
    const xStart = reverse ? width - 1 : 0;
    const xEnd = reverse ? -1 : width;
    const xStep = reverse ? -1 : 1;

    for (let x = xStart; x !== xEnd; x += xStep) {
      const currentPixel = (y * width + x) * 4;
      const oldPixel = getPixelColorValues(currentPixel, image.data);
      const newPixel = findClosestPaletteColor(
        oldPixel,
        colorPalette,
        colorMatching
      );

      setImageDataPixel(image, currentPixel, newPixel);

      const quantError = getQuantError(oldPixel, newPixel);

      diffusionMap.forEach((diffusion) => {
        const dx = reverse ? -diffusion.offset[0] : diffusion.offset[0];
        const nx = x + dx;
        const ny = y + diffusion.offset[1];
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) return;

        const pixelIndex = (ny * width + nx) * 4;
        const errorPixel = addQuantError(
          getPixelColorValues(pixelIndex, image.data),
          quantError,
          diffusion.factor
        );
        setImageDataPixel(image, pixelIndex, errorPixel);
      });
    }
  }
};

const setImageDataPixel = (
  image: ImageDataLike,
  pixelIndex: number,
  pixel: RGBA
) => {
  image.data[pixelIndex] = pixel[0];
  image.data[pixelIndex + 1] = pixel[1];
  image.data[pixelIndex + 2] = pixel[2];
  image.data[pixelIndex + 3] = pixel[3] ?? 255;
};

const randomDitherPixelValue = (pixel: RGBA): RGBA => {
  return [
    pixel[0] < utilities.randomInteger(0, 255) ? 0 : 255,
    pixel[1] < utilities.randomInteger(0, 255) ? 0 : 255,
    pixel[2] < utilities.randomInteger(0, 255) ? 0 : 255,
    pixel[3],
  ];
};

const randomDitherBlackAndWhitePixelValue = (pixel: RGBA): RGBA => {
  const averageRGB = (pixel[0] + pixel[1] + pixel[2]) / 3;
  return averageRGB < utilities.randomInteger(0, 255)
    ? [0, 0, 0, 255]
    : [255, 255, 255, 255];
};

const orderedDitherPixelValue = (
  pixel: RGBA,
  coordinates: [number, number],
  thresholdMap: number[][],
  threshold: number
): RGBA => {
  const factor =
    thresholdMap[coordinates[1] % thresholdMap.length][
      coordinates[0] % thresholdMap[0].length
    ] /
    (thresholdMap.length * thresholdMap[0].length);
  return [
    clampByte(pixel[0] + factor * threshold),
    clampByte(pixel[1] + factor * threshold),
    clampByte(pixel[2] + factor * threshold),
    pixel[3],
  ];
};

const pixelXY = (index: number, width: number): [number, number] => {
  return [index % width, Math.floor(index / width)];
};

const isPaletteColorEntry = (
  color: string | PaletteColorEntry
): color is PaletteColorEntry =>
  typeof color === "object" && color !== null && "color" in color;

const setColorPalette = (
  palette: string | string[] | PaletteColorEntry[]
): RGB[] => {
  const paletteArray =
    typeof palette === "string"
      ? getNamedColors(palettes as PaletteRegistry, palette)
      : palette;
  return paletteArray
    .map((color) =>
      colorHelpers.hexToRgb(isPaletteColorEntry(color) ? color.color : color)
    )
    .filter((color): color is RGB => Array.isArray(color));
};

const imageDataToCanvas = (imageData: ImageDataLike, canvas: CanvasLike) => {
  canvas.width = imageData.width;
  canvas.height = imageData.height;

  const ctx = canvas.getContext("2d");

  ctx.putImageData(imageData, 0, 0);

  return canvas;
};

export { ditherImage };
