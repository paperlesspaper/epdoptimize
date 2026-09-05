import palettes from "./data/default-palettes.json";
import diffusionMaps from "./data/diffusion-maps";
//import thresholdMaps from "./data/threshold-maps.json";

/* Functions */
import bayerMatrix from "./functions/bayer-matrix";
import colorHelpers from "./functions/color-helpers";
// import colorPaletteFromImage from "./functions/color-palette-from-image";
import utilities from "./functions/utilities";
import findClosestPaletteColor from "./functions/find-closest-palette-color";
import { applyWasmRgbErrorDiffusion } from "./wasm-error-diffusion-rgb";
import { loadBlueNoiseTexture } from "../utils/blue-noise-texture";
import { coverageDither } from "../utils/coverage";
import {
  bayerDither,
  blueNoiseDither,
  kernelDiffusionDither,
  riemersmaDither,
  rgbQuantDiffusionDither,
  simple2DDither,
  type BayerSize,
} from "../utils/dithering";
import {
  applyImageProcessing,
  clampByte,
  deltaE,
  getProcessingPreset,
  luma709,
  rgbToLab,
  type AdjustmentQuality,
  type ClarityOptions,
  type ColorMatchingMode,
  type DynamicRangeCompressionOptions,
  type ImageProcessingOptions,
  type LevelCompressionMode,
  type LevelCompressionOptions,
  type LevelRGB,
  type PaperNormalizationOptions,
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
import {
  applyImageDataAdjustmentsInWorker,
  getPreviewImageData,
  shouldUseAdjustmentWorker,
  waitForAdjustmentTurn,
} from "./adjustment-async";

export type DitheringType =
  | "errorDiffusion"
  | "ordered"
  | "random"
  | "quantizationOnly"
  | "hueMix"
  | "blueNoise"
  | "simple2D"
  | "riemersma"
  | "ditherItErrorDiffusion"
  | "ditherItOrdered"
  | "ditherItBlueNoise"
  | "ditherItSimple2D"
  | "ditherItRiemersma"
  | (string & {});

export type DitherProcessingEngine = "js" | "wasm" | "auto";
export type AdjustmentProcessingEngine = "auto" | "js" | "worker" | "wasm";

export interface AdjustmentPreviewOptions {
  maxPixels?: number;
  maxLongEdge?: number;
  mode?: "fast" | "final";
}

export interface DitherImageOptions {
  /**
   * Upstream-style processing preset. Presets fill in tone mapping, dynamic
   * range compression, color matching, and diffusion defaults unless overridden.
   */
  processingPreset?: ProcessingPresetName;

  /** Main dithering algorithm. */
  ditheringType?: DitheringType;

  /**
   * Processing engine for supported hot paths.
   *
   * Default: "auto". "wasm" and "auto" currently accelerate RGB error diffusion
   * and fall back to JS for unsupported modes.
   */
  processingEngine?: DitherProcessingEngine;

  /**
   * Processing engine for image adjustments.
   *
   * Default: "auto". "worker" and "auto" move supported async adjustment calls
   * off the main thread where browser Workers are available. "wasm" is
   * reserved for future adjustment kernels and currently falls back to JS.
   */
  adjustmentEngine?: AdjustmentProcessingEngine;

  /**
   * Preview controls for interactive editors. Final mode preserves current
   * quality; fast mode can downscale and use cheaper adjustment paths.
   */
  preview?: AdjustmentPreviewOptions;

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

  /**
   * Selective cleanup for scanned paper/poster sources before tone mapping.
   */
  paperNormalization?: PaperNormalizationOptions;

  /**
   * Midtone local-contrast adjustment before tone mapping.
   */
  clarity?: ClarityOptions;

  /**
   * Preserve hard text/line-art edges by replacing strong edge-core pixels with
   * direct palette quantization after the main dithering pass.
   */
  edgePreservation?: EdgePreservationOptions;

  /**
   * Reduce jagged teeth on antialiased full-color transitions by constraining
   * edge-band pixels to the two local palette colors on either side of an edge.
   */
  edgeAntialiasing?: EdgeAntialiasingOptions;
}

export interface EdgePreservationOptions {
  enabled?: boolean;
  /**
   * 0..1. Higher values preserve more edge-core pixels.
   */
  strength?: number;
  /**
   * Luma-gradient threshold used to detect strong transitions.
   */
  threshold?: number;
  /**
   * Optional dilation radius for the protected edge core.
   */
  radius?: number;
}

export interface EdgeAntialiasingOptions {
  enabled?: boolean;
  /**
   * 0..1. Higher values replace more eligible edge-band pixels.
   */
  strength?: number;
  /**
   * Luma-gradient threshold used to detect antialias transition bands.
   */
  threshold?: number;
  /**
   * Edge-band dilation radius, in pixels.
   */
  bandRadius?: number;
  /**
   * Neighborhood radius used to find the two local palette colors.
   */
  localRadius?: number;
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
  ClarityOptions,
  AdjustmentQuality,
  ColorMatchingMode,
  DynamicRangeCompressionOptions,
  ImageProcessingOptions,
  LevelCompressionMode,
  LevelCompressionOptions,
  LevelRGB,
  PaperNormalizationOptions,
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
    | "processingEngine"
    | "adjustmentEngine"
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
  processingEngine: "auto",
  adjustmentEngine: "auto",

  sampleColorsFromImage: false,
  numberOfSampleColors: 10,
};

interface WhitePreservationPlan {
  sourceLumas: Float64Array;
  sourceWhiteCandidates: Uint8Array;
  sourceWhiteLuma: number;
  targetWhite: RGB;
  targetWhiteLuma: number;
}

const getBytePercentileFromHistogram = (
  histogram: Uint32Array,
  count: number,
  percentile: number
) => {
  if (count <= 0) return 0;

  const target = Math.min(
    count - 1,
    Math.max(0, Math.round((count - 1) * percentile))
  );
  let seen = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    seen += histogram[value];
    if (seen > target) return value;
  }

  return 255;
};

const getPaletteWhite = (palette: RGB[]) => {
  if (!palette.length) return [255, 255, 255] satisfies RGB;

  return palette.reduce((lightest, color) =>
    luma709(...color) > luma709(...lightest) ? color : lightest
  );
};

const getWhitePreservationPlan = (
  image: ImageDataLike,
  options: DitherImageOptions & typeof defaultOptions,
  colorPalette: RGB[]
): WhitePreservationPlan | null => {
  const rangeOptions = options.dynamicRangeCompression;
  if (
    !rangeOptions ||
    rangeOptions === true ||
    rangeOptions.preserveWhite !== true
  ) {
    return null;
  }

  const data = image.data;
  const pixelCount = Math.floor(data.length / 4);
  if (pixelCount <= 0) return null;

  const sourceLumas = new Float64Array(pixelCount);
  const sourceWhiteCandidates = new Uint8Array(pixelCount);
  const whiteCandidateHistogram = new Uint32Array(256);
  let visibleLumaCount = 0;
  let whiteCandidateCount = 0;
  const maxWhiteSaturation = Math.min(
    1,
    Math.max(0, rangeOptions.whitePreserveMaxSaturation ?? 0.18)
  );

  for (let i = 0, pixelIndex = 0; i < data.length; i += 4, pixelIndex++) {
    if (data[i + 3] <= 16) {
      sourceLumas[pixelIndex] = -1;
      continue;
    }

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = luma709(r, g, b);
    sourceLumas[pixelIndex] = luma;
    visibleLumaCount += 1;

    if (getSaturationFromChannels(r, g, b) <= maxWhiteSaturation) {
      sourceWhiteCandidates[pixelIndex] = 1;
      whiteCandidateHistogram[clampByte(luma)] += 1;
      whiteCandidateCount += 1;
    }
  }

  if (visibleLumaCount === 0 || whiteCandidateCount === 0) return null;

  const sourceWhiteLuma = getBytePercentileFromHistogram(
    whiteCandidateHistogram,
    whiteCandidateCount,
    rangeOptions.whitePreservePercentile ?? 0.99
  );
  if (sourceWhiteLuma < (rangeOptions.whitePreserveMinLuma ?? 150)) {
    return null;
  }

  const targetWhite = getPaletteWhite(colorPalette);
  return {
    sourceLumas,
    sourceWhiteCandidates,
    sourceWhiteLuma,
    targetWhite,
    targetWhiteLuma: luma709(...targetWhite),
  };
};

const applyWhitePreservation = (
  image: ImageDataLike,
  plan: WhitePreservationPlan | null
) => {
  if (!plan) return;

  const data = image.data;
  const [whiteR, whiteG, whiteB] = plan.targetWhite;
  for (let i = 0, pixelIndex = 0; i < data.length; i += 4, pixelIndex++) {
    if (plan.sourceWhiteCandidates[pixelIndex] !== 1) {
      continue;
    }
    if (plan.sourceLumas[pixelIndex] + 0.0001 < plan.sourceWhiteLuma) {
      continue;
    }
    if (luma709(data[i], data[i + 1], data[i + 2]) >= plan.targetWhiteLuma) {
      continue;
    }

    data[i] = whiteR;
    data[i + 1] = whiteG;
    data[i + 2] = whiteB;
  }
};

const mergeImageProcessingOptions = (
  options: DitherImageOptions & typeof defaultOptions
): ImageProcessingOptions | undefined => {
  const hasToneMapping = options.toneMapping !== undefined;
  const hasLevelCompression = options.levelCompression !== undefined;
  const hasClarity = options.clarity !== undefined;
  const hasPaperNormalization = options.paperNormalization !== undefined;
  const hasDynamicRangeCompression =
    options.dynamicRangeCompression !== undefined;

  if (
    !hasPaperNormalization &&
    !hasClarity &&
    !hasToneMapping &&
    !hasLevelCompression &&
    !hasDynamicRangeCompression
  ) {
    return undefined;
  }

  const previewMode = options.preview?.mode ?? "final";
  const dynamicRangeCompression =
    previewMode === "fast" &&
    options.dynamicRangeCompression &&
    options.dynamicRangeCompression !== true
      ? {
          ...options.dynamicRangeCompression,
          quality: options.dynamicRangeCompression.quality ?? "fast",
        }
      : options.dynamicRangeCompression;

  return {
    paperNormalization: options.paperNormalization,
    clarity: options.clarity,
    toneMapping: options.toneMapping,
    dynamicRangeCompression,
    levelCompression: options.levelCompression,
    previewMode,
  };
};

const getPresetDefaults = (presetName: ProcessingPresetName | undefined) => {
  if (!presetName) return {};
  const preset = getProcessingPreset(presetName);
  if (!preset) return {};

  return {
    paperNormalization: preset.paperNormalization,
    toneMapping: preset.toneMapping,
    dynamicRangeCompression: preset.dynamicRangeCompression,
    colorMatching: preset.colorMatching,
    errorDiffusionMatrix: preset.errorDiffusionMatrix,
  } satisfies Partial<DitherImageOptions>;
};

const getResolvedDitherOptions = (opts: DitherImageOptions = {}) => {
  const options: DitherImageOptions & typeof defaultOptions = {
    ...defaultOptions,
    ...getPresetDefaults(opts.processingPreset),
    ...opts,
  };

  // Backwards-compatible alias (README historically used `algorithm`).
  if (opts.algorithm && !opts.errorDiffusionMatrix) {
    options.errorDiffusionMatrix = opts.algorithm;
  }

  return options;
};

const getCanvasImageData = (sourceCanvas: CanvasLike) => {
  const ctx = sourceCanvas.getContext("2d");
  if (!ctx) return null;
  return ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
};

const getColorPaletteFromOptions = (
  options: DitherImageOptions & typeof defaultOptions
) => {
  if (!options.palette || options.sampleColorsFromImage === true) {
    // return colorPaletteFromImage(image, options.numberOfSampleColors);
    return [];
  }

  return setColorPalette(options.palette);
};

const applyImageAdjustmentsToImageData = (
  image: ImageDataLike,
  options: DitherImageOptions & typeof defaultOptions,
  colorPalette: RGB[]
) => {
  const whitePreservationPlan = getWhitePreservationPlan(
    image,
    options,
    colorPalette
  );

  applyImageProcessing(image, mergeImageProcessingOptions(options), colorPalette);

  applyWhitePreservation(image, whitePreservationPlan);
};

const ditherImageData = async (
  image: ImageDataLike,
  options: DitherImageOptions & typeof defaultOptions,
  colorPalette: RGB[]
) => {
  const width = image.width;
  const height = image.height;
  const edgeSourceData = shouldApplyEdgeHandling(options, colorPalette)
    ? new Uint8ClampedArray(image.data)
    : null;

  function setPixel(pixelIndex: number, pixel: RGBA) {
    image.data[pixelIndex] = pixel[0];
    image.data[pixelIndex + 1] = pixel[1];
    image.data[pixelIndex + 2] = pixel[2];
    image.data[pixelIndex + 3] = pixel[3] ?? 255;
  }

  if (isUtilsDitheringType(options.ditheringType)) {
    // The mask is a file, so it has to be in hand before the synchronous dither.
    if (needsBlueNoise(options.ditheringType)) await loadBlueNoiseTexture();
    applyUtilsDithering(image, options, colorPalette);
    applyEdgeHandling(image, options, colorPalette, edgeSourceData);
    return;
  }

  const thresholdMap = bayerMatrix([
    options.orderedDitheringMatrix[0],
    options.orderedDitheringMatrix[1],
  ]);

  if (options.ditheringType === "ordered") {
    const rows = thresholdMap.length;
    const columns = thresholdMap[0].length;
    const cells = rows * columns;
    // The map holds contiguous ranks, so the cell centres are the uniform
    // variate the coverage solve spends on choosing an ink.
    const covered = coverageDither(
      image.data,
      width,
      height,
      colorPalette,
      (x, y) => (thresholdMap[y % rows][x % columns] + 0.5) / cells
    );
    if (covered) {
      applyEdgeHandling(image, options, colorPalette, edgeSourceData);
      return;
    }
  }

  let current: number;
  let newPixel: RGBA;
  let oldPixel: RGBA;
  const hueMixPalette = getHueMixPalette(colorPalette);

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
      // Only reached when the palette is too large or too small to solve.
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

    if (options.ditheringType === "hueMix") {
      newPixel = hueMixDitherPixelValue(
        oldPixel,
        pixelXY(currentPixel / 4, width),
        hueMixPalette,
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
    const diffusionMap = getDiffusionMap(options.errorDiffusionMatrix);
    const usedWasm =
      shouldUseWasmErrorDiffusion(
        options.processingEngine,
        options.colorMatching
      ) &&
      (await applyWasmRgbErrorDiffusion(
        image,
        colorPalette,
        diffusionMap,
        options.serpentine
      ));

    if (!usedWasm) {
      applyErrorDiffusion(
        image,
        width,
        height,
        colorPalette,
        diffusionMap,
        options.colorMatching,
        options.serpentine
      );
    }
  }

  applyEdgeHandling(image, options, colorPalette, edgeSourceData);
};

const applyImageAdjustments = async (
  sourceCanvas: CanvasLike,
  canvas: CanvasLike,
  opts: DitherImageOptions = {}
): Promise<CanvasLike | undefined> => {
  if (!sourceCanvas || !canvas) return;

  const image = getCanvasImageData(sourceCanvas);
  if (!image) return;

  const options = getResolvedDitherOptions(opts);
  const colorPalette = getColorPaletteFromOptions(options);
  applyImageAdjustmentsToImageData(image, options, colorPalette);

  return imageDataToCanvas(image, canvas);
};

const applyImageDataAdjustments = (
  image: ImageDataLike,
  opts: DitherImageOptions = {}
): ImageDataLike | undefined => {
  if (!image) return;

  const options = getResolvedDitherOptions(opts);
  const colorPalette = getColorPaletteFromOptions(options);
  applyImageAdjustmentsToImageData(image, options, colorPalette);

  return image;
};

const applyImageDataAdjustmentsAsync = async (
  image: ImageDataLike,
  opts: DitherImageOptions = {}
): Promise<ImageDataLike | undefined> => {
  if (!image) return;

  const previewImage = getPreviewImageData(image, opts.preview, "final");
  const workerOptions = getResolvedDitherOptions(opts);
  if (shouldUseAdjustmentWorker(workerOptions, previewImage)) {
    return applyImageDataAdjustmentsInWorker(previewImage, opts);
  }

  await waitForAdjustmentTurn();

  return applyImageDataAdjustments(previewImage, opts);
};

const applyImageAdjustmentsPreview = async (
  sourceCanvas: CanvasLike,
  canvas: CanvasLike,
  opts: DitherImageOptions = {}
): Promise<CanvasLike | undefined> => {
  if (!sourceCanvas || !canvas) return;

  const image = getCanvasImageData(sourceCanvas);
  if (!image) return;

  const previewImage = getPreviewImageData(image, opts.preview, "fast");
  const adjusted = await applyImageDataAdjustmentsAsync(previewImage, {
    ...opts,
    preview: {
      ...opts.preview,
      mode: opts.preview?.mode ?? "fast",
    },
  });
  if (!adjusted) return;

  return imageDataToCanvas(adjusted, canvas);
};

const ditherCanvas = async (
  sourceCanvas: CanvasLike,
  canvas: CanvasLike,
  opts: DitherImageOptions = {}
): Promise<CanvasLike | undefined> => {
  if (!sourceCanvas || !canvas) return;

  const image = getCanvasImageData(sourceCanvas);
  if (!image) return;

  const options = getResolvedDitherOptions(opts);
  const colorPalette = getColorPaletteFromOptions(options);
  await ditherImageData(image, options, colorPalette);

  return imageDataToCanvas(image, canvas);
};

const ditherImage = async (
  sourceCanvas: CanvasLike,
  canvas: CanvasLike,
  opts: DitherImageOptions = {}
): Promise<CanvasLike | undefined> => {
  if (!sourceCanvas || !canvas) return;

  const image = getCanvasImageData(sourceCanvas);
  if (!image) return;

  const options = getResolvedDitherOptions(opts);
  const colorPalette = getColorPaletteFromOptions(options);
  applyImageAdjustmentsToImageData(image, options, colorPalette);
  await ditherImageData(image, options, colorPalette);

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

const getDiffusionMap = (matrixName: string) => {
  const matrixFactory = diffusionMaps[matrixName] || diffusionMaps.floydSteinberg;
  return matrixFactory();
};

type DiffusionMap = ReturnType<typeof getDiffusionMap>;

const shouldUseWasmErrorDiffusion = (
  engine: DitherProcessingEngine | undefined,
  colorMatching: ColorMatchingMode
) => (engine === "wasm" || engine === "auto") && colorMatching === "rgb";

const isUtilsDitheringType = (ditheringType: DitheringType | undefined) =>
  ditheringType === "blueNoise" ||
  ditheringType === "simple2D" ||
  ditheringType === "riemersma" ||
  ditheringType === "ditherItErrorDiffusion" ||
  ditheringType === "ditherItOrdered" ||
  ditheringType === "ditherItBlueNoise" ||
  ditheringType === "ditherItSimple2D" ||
  ditheringType === "ditherItRiemersma";

const needsBlueNoise = (ditheringType: DitheringType | undefined) =>
  ditheringType === "blueNoise" || ditheringType === "ditherItBlueNoise";

type UtilsColorSpace = "rgb" | "oklab";

const applyUtilsDithering = (
  image: ImageDataLike,
  options: DitherImageOptions & typeof defaultOptions,
  colorPalette: RGB[]
) => {
  const context = createUtilsDitherContext(image);
  const imageData = image as unknown as ImageData;
  const blockSize = 1;
  const colorSpace = getUtilsColorSpace(options.colorMatching);

  if (options.ditheringType === "ditherItOrdered") {
    bayerDither(
      context,
      imageData,
      colorPalette,
      blockSize,
      getUtilsBayerSize(options.orderedDitheringMatrix)
    );
    return;
  }

  if (
    options.ditheringType === "blueNoise" ||
    options.ditheringType === "ditherItBlueNoise"
  ) {
    blueNoiseDither(context, imageData, colorPalette, blockSize);
    return;
  }

  if (
    options.ditheringType === "simple2D" ||
    options.ditheringType === "ditherItSimple2D"
  ) {
    simple2DDither(context, imageData, colorPalette, blockSize, colorSpace);
    return;
  }

  if (
    options.ditheringType === "riemersma" ||
    options.ditheringType === "ditherItRiemersma"
  ) {
    riemersmaDither(context, imageData, colorPalette, blockSize, colorSpace);
    return;
  }

  if (colorSpace === "rgb") {
    rgbQuantDiffusionDither(
      context,
      imageData,
      colorPalette,
      blockSize,
      getUtilsKernelName(options.errorDiffusionMatrix),
      options.serpentine
    );
    return;
  }

  kernelDiffusionDither(
    context,
    imageData,
    colorPalette,
    blockSize,
    getUtilsKernelName(options.errorDiffusionMatrix),
    options.serpentine,
    colorSpace
  );
};

const createUtilsDitherContext = (image: ImageDataLike) =>
  ({
    canvas: {
      width: image.width,
      height: image.height,
    },
    putImageData(nextImage: ImageDataLike) {
      if (nextImage.data !== image.data) {
        image.data.set(nextImage.data);
      }
    },
  }) as unknown as CanvasRenderingContext2D;

const getUtilsColorSpace = (
  colorMatching: ColorMatchingMode
): UtilsColorSpace => (colorMatching === "lab" ? "oklab" : "rgb");

const getUtilsBayerSize = (
  matrixSize: [number, number] | number[]
): BayerSize => {
  const size = Math.max(matrixSize[0] ?? 4, matrixSize[1] ?? matrixSize[0] ?? 4);
  if (size <= 2) return 2;
  if (size <= 4) return 4;
  if (size <= 8) return 8;
  return 16;
};

const getUtilsKernelName = (matrixName: string) => {
  const kernelNames: Record<string, string> = {
    floydSteinberg: "FloydSteinberg",
    FloydSteinberg: "FloydSteinberg",
    falseFloydSteinberg: "FloydSteinberg",
    atkinson: "Atkinson",
    Atkinson: "Atkinson",
    jarvis: "JarvisJudiceNinke",
    jarvisJudiceNinke: "JarvisJudiceNinke",
    JarvisJudiceNinke: "JarvisJudiceNinke",
    stucki: "Stucki",
    Stucki: "Stucki",
    burkes: "Burkes",
    Burkes: "Burkes",
    sierra3: "Sierra3",
    Sierra3: "Sierra3",
    sierra2: "Sierra2",
    Sierra2: "Sierra2",
    "sierra2-4a": "Sierra24A",
    fan: "Fan",
    Fan: "Fan",
    shiauFan: "ShiauFan",
    ShiauFan: "ShiauFan",
    shiauFan2: "ShiauFan2",
    ShiauFan2: "ShiauFan2",
  };

  return kernelNames[matrixName] ?? "FloydSteinberg";
};

interface PaletteMatcher {
  hasPalette: boolean;
  findIndex(
    r: number,
    g: number,
    b: number,
    sourceR: number,
    sourceG: number,
    sourceB: number
  ): number;
}

const createPaletteMatcher = (
  colorPalette: RGB[],
  colorMatching: ColorMatchingMode
): PaletteMatcher => {
  const paletteLabs =
    colorMatching === "lab"
      ? colorPalette.map((color) => rgbToLab(color[0], color[1], color[2]))
      : [];
  const paletteSaturations =
    colorMatching === "chroma"
      ? colorPalette.map((color) =>
          getSaturationFromChannels(color[0], color[1], color[2])
        )
      : [];
  const paletteHues =
    colorMatching === "chroma"
      ? colorPalette.map((color) =>
          getHueFromChannels(color[0], color[1], color[2])
        )
      : [];

  return {
    hasPalette: colorPalette.length > 0,
    findIndex(r, g, b, sourceR, sourceG, sourceB) {
      if (!colorPalette.length) return -1;

      let closestIndex = 0;
      let closestDistance = Infinity;

      if (colorMatching === "lab") {
        const pixelLab = rgbToLab(r, g, b);
        for (let index = 0; index < colorPalette.length; index += 1) {
          const distance = deltaE(paletteLabs[index], pixelLab);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
          }
        }
        return closestIndex;
      }

      const sourceSaturation =
        colorMatching === "chroma"
          ? getSaturationFromChannels(sourceR, sourceG, sourceB)
          : 0;
      const sourceHue =
        colorMatching === "chroma" && sourceSaturation >= 0.12
          ? getHueFromChannels(sourceR, sourceG, sourceB)
          : null;

      for (let index = 0; index < colorPalette.length; index += 1) {
        const color = colorPalette[index];
        const dr = color[0] - r;
        const dg = color[1] - g;
        const db = color[2] - b;
        let distance = Math.sqrt(dr * dr + dg * dg + db * db);

        if (colorMatching === "chroma") {
          const paletteSaturation = paletteSaturations[index];
          if (sourceSaturation >= 0.12 && paletteSaturation <= 0.12) {
            distance += Math.min(330, sourceSaturation * 1300);
          }
          if (sourceHue !== null && paletteSaturation > 0.12) {
            distance += getHueDistance(sourceHue, paletteHues[index]) * 3;
          }
        }

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      }

      return closestIndex;
    },
  };
};

const applyErrorDiffusion = (
  image: ImageDataLike,
  width: number,
  height: number,
  colorPalette: RGB[],
  diffusionMap: DiffusionMap,
  colorMatching: ColorMatchingMode,
  serpentine: boolean
) => {
  const sourceData = new Uint8ClampedArray(image.data);
  const data = image.data;
  const matcher = createPaletteMatcher(colorPalette, colorMatching);

  for (let y = 0; y < height; y++) {
    const reverse = serpentine && y % 2 === 1;
    const xStart = reverse ? width - 1 : 0;
    const xEnd = reverse ? -1 : width;
    const xStep = reverse ? -1 : 1;

    for (let x = xStart; x !== xEnd; x += xStep) {
      const currentPixel = (y * width + x) * 4;
      const oldR = data[currentPixel];
      const oldG = data[currentPixel + 1];
      const oldB = data[currentPixel + 2];
      const oldA = data[currentPixel + 3];
      const sourceR = sourceData[currentPixel];
      const sourceG = sourceData[currentPixel + 1];
      const sourceB = sourceData[currentPixel + 2];
      const closestIndex = matcher.findIndex(
        oldR,
        oldG,
        oldB,
        sourceR,
        sourceG,
        sourceB
      );
      const newR = matcher.hasPalette ? colorPalette[closestIndex][0] : oldR;
      const newG = matcher.hasPalette ? colorPalette[closestIndex][1] : oldG;
      const newB = matcher.hasPalette ? colorPalette[closestIndex][2] : oldB;
      const newA = matcher.hasPalette ? 255 : oldA;

      data[currentPixel] = newR;
      data[currentPixel + 1] = newG;
      data[currentPixel + 2] = newB;
      data[currentPixel + 3] = newA;

      const errorR = oldR - newR;
      const errorG = oldG - newG;
      const errorB = oldB - newB;

      for (let index = 0; index < diffusionMap.length; index += 1) {
        const diffusion = diffusionMap[index];
        const dx = reverse ? -diffusion.offset[0] : diffusion.offset[0];
        const nx = x + dx;
        const ny = y + diffusion.offset[1];
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

        const pixelIndex = (ny * width + nx) * 4;
        const factor = diffusion.factor;
        data[pixelIndex] = clampByte(data[pixelIndex] + errorR * factor);
        data[pixelIndex + 1] = clampByte(
          data[pixelIndex + 1] + errorG * factor
        );
        data[pixelIndex + 2] = clampByte(
          data[pixelIndex + 2] + errorB * factor
        );
      }
    }
  }
};

interface EdgeMasks {
  core: Uint8Array;
  band: Uint8Array;
}

const shouldApplyEdgeHandling = (
  options: DitherImageOptions,
  colorPalette: RGB[]
) =>
  colorPalette.length > 0 &&
  (options.edgePreservation?.enabled === true ||
    options.edgeAntialiasing?.enabled === true);

const applyEdgeHandling = (
  image: ImageDataLike,
  options: DitherImageOptions,
  colorPalette: RGB[],
  sourceData: Uint8ClampedArray | null
) => {
  if (!sourceData || !shouldApplyEdgeHandling(options, colorPalette)) return;

  const preserveOptions = options.edgePreservation;
  const antialiasOptions = options.edgeAntialiasing;
  const preserveEnabled = preserveOptions?.enabled === true;
  const antialiasEnabled = antialiasOptions?.enabled === true;
  const preserveStrength = clamp(preserveOptions?.strength ?? 0.65, 0, 1);
  const antialiasStrength = clamp(antialiasOptions?.strength ?? 0.75, 0, 1);

  if (
    (preserveEnabled && preserveStrength <= 0) ||
    (antialiasEnabled && antialiasStrength <= 0)
  ) {
    if (
      (!preserveEnabled || preserveStrength <= 0) &&
      (!antialiasEnabled || antialiasStrength <= 0)
    ) {
      return;
    }
  }

  const threshold = Math.min(
    preserveEnabled ? preserveOptions?.threshold ?? 42 : Infinity,
    antialiasEnabled ? antialiasOptions?.threshold ?? 42 : Infinity
  );
  if (!Number.isFinite(threshold)) return;

  const masks = buildEdgeMasks(sourceData, image.width, image.height, {
    threshold,
    coreThreshold:
      threshold *
      (preserveEnabled ? 1.7 - preserveStrength * 0.7 : 1.45),
    coreRadius: preserveEnabled ? Math.max(0, preserveOptions?.radius ?? 0) : 0,
    bandRadius: antialiasEnabled
      ? Math.max(1, antialiasOptions?.bandRadius ?? 1)
      : 0,
  });
  const quantized = getQuantizedData(
    sourceData,
    colorPalette,
    options.colorMatching
  );

  if (antialiasEnabled) {
    applyEdgeAntialiasing(
      image,
      sourceData,
      quantized,
      masks,
      antialiasStrength,
      Math.max(1, antialiasOptions?.localRadius ?? 2)
    );
  }

  if (preserveEnabled) {
    applyEdgePreservation(image, quantized, masks, preserveStrength);
  }
};

const buildEdgeMasks = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: {
    threshold: number;
    coreThreshold: number;
    coreRadius: number;
    bandRadius: number;
  }
): EdgeMasks => {
  const rawCore = new Uint8Array(width * height);
  const core = new Uint8Array(width * height);
  const band = new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixel = (y * width + x) * 4;
      if (data[pixel + 3] <= 16) continue;

      const left = (y * width + x - 1) * 4;
      const right = (y * width + x + 1) * 4;
      const up = ((y - 1) * width + x) * 4;
      const down = ((y + 1) * width + x) * 4;
      const dx = luma709(data[right], data[right + 1], data[right + 2]) -
        luma709(data[left], data[left + 1], data[left + 2]);
      const dy = luma709(data[down], data[down + 1], data[down + 2]) -
        luma709(data[up], data[up + 1], data[up + 2]);
      const magnitude = Math.sqrt(dx * dx + dy * dy);
      const index = y * width + x;

      if (magnitude >= options.threshold) {
        dilateMaskAt(band, width, height, x, y, options.bandRadius);
      }

      if (magnitude >= options.coreThreshold) {
        rawCore[index] = 1;
      }
    }
  }

  if (options.coreRadius > 0) {
    for (let index = 0; index < rawCore.length; index += 1) {
      if (rawCore[index] !== 1) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      dilateMaskAt(core, width, height, x, y, options.coreRadius);
    }
  } else {
    core.set(rawCore);
  }

  return { core, band };
};

const dilateMaskAt = (
  mask: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number
) => {
  if (radius <= 0) {
    mask[y * width + x] = 1;
    return;
  }

  for (let oy = -radius; oy <= radius; oy += 1) {
    for (let ox = -radius; ox <= radius; ox += 1) {
      const nx = x + ox;
      const ny = y + oy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      mask[ny * width + nx] = 1;
    }
  }
};

const getQuantizedData = (
  sourceData: Uint8ClampedArray,
  colorPalette: RGB[],
  colorMatching: ColorMatchingMode
) => {
  const quantized = new Uint8ClampedArray(sourceData);
  const matcher = createPaletteMatcher(colorPalette, colorMatching);

  for (let pixel = 0; pixel < quantized.length; pixel += 4) {
    if (sourceData[pixel + 3] <= 16) continue;

    const r = sourceData[pixel];
    const g = sourceData[pixel + 1];
    const b = sourceData[pixel + 2];
    const closestIndex = matcher.findIndex(r, g, b, r, g, b);
    if (closestIndex < 0) continue;

    const color = colorPalette[closestIndex];
    quantized[pixel] = color[0];
    quantized[pixel + 1] = color[1];
    quantized[pixel + 2] = color[2];
    quantized[pixel + 3] = 255;
  }

  return quantized;
};

const applyEdgePreservation = (
  image: ImageDataLike,
  quantized: Uint8ClampedArray,
  masks: EdgeMasks,
  strength: number
) => {
  const data = image.data;

  for (let index = 0; index < masks.core.length; index += 1) {
    if (masks.core[index] !== 1) continue;
    const x = index % image.width;
    const y = Math.floor(index / image.width);
    if (stableNoiseThreshold(x + 811, y + 3571) > strength) continue;

    const pixel = index * 4;
    data[pixel] = quantized[pixel];
    data[pixel + 1] = quantized[pixel + 1];
    data[pixel + 2] = quantized[pixel + 2];
    data[pixel + 3] = quantized[pixel + 3];
  }
};

const applyEdgeAntialiasing = (
  image: ImageDataLike,
  sourceData: Uint8ClampedArray,
  quantized: Uint8ClampedArray,
  masks: EdgeMasks,
  strength: number,
  localRadius: number
) => {
  const { width, height } = image;
  const data = image.data;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (masks.band[index] !== 1) continue;
      if (stableNoiseThreshold(x + 2371, y + 593) > strength) continue;

      const pair = getLocalPalettePair(
        quantized,
        width,
        height,
        x,
        y,
        localRadius
      );
      if (!pair) continue;

      const pixel = index * 4;
      const source: RGB = [
        sourceData[pixel],
        sourceData[pixel + 1],
        sourceData[pixel + 2],
      ];
      const coverage = getSegmentCoverage(source, pair[0], pair[1]);
      const residual = getSegmentResidual(source, pair[0], pair[1], coverage);

      if (residual > 95) continue;

      if (coverage <= 0.08 || coverage >= 0.92 || masks.core[index] === 1) {
        data[pixel] = quantized[pixel];
        data[pixel + 1] = quantized[pixel + 1];
        data[pixel + 2] = quantized[pixel + 2];
        data[pixel + 3] = quantized[pixel + 3];
        continue;
      }

      const color =
        stableNoiseThreshold(x, y) < coverage ? pair[1] : pair[0];
      data[pixel] = color[0];
      data[pixel + 1] = color[1];
      data[pixel + 2] = color[2];
      data[pixel + 3] = 255;
    }
  }
};

interface LocalPaletteCandidate {
  color: RGB;
  count: number;
}

const getLocalPalettePair = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number
): [RGB, RGB] | null => {
  const counts = new Map<number, LocalPaletteCandidate>();

  for (let oy = -radius; oy <= radius; oy += 1) {
    for (let ox = -radius; ox <= radius; ox += 1) {
      const nx = x + ox;
      const ny = y + oy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const pixel = (ny * width + nx) * 4;
      if (data[pixel + 3] <= 16) continue;

      const color: RGB = [data[pixel], data[pixel + 1], data[pixel + 2]];
      const key = (color[0] << 16) | (color[1] << 8) | color[2];
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { color, count: 1 });
      }
    }
  }

  const candidates = Array.from(counts.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
  if (candidates.length < 2) return null;

  let best: [RGB, RGB] | null = null;
  let bestScore = -Infinity;
  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < candidates.length;
      rightIndex += 1
    ) {
      const left = candidates[leftIndex];
      const right = candidates[rightIndex];
      const distance = colorDistance(left.color, right.color);
      const score = distance + Math.min(left.count, right.count) * 8;
      if (score > bestScore) {
        bestScore = score;
        best = [left.color, right.color];
      }
    }
  }

  return bestScore >= 45 ? best : null;
};

const getSegmentCoverage = (source: RGB, a: RGB, b: RGB) => {
  const abR = b[0] - a[0];
  const abG = b[1] - a[1];
  const abB = b[2] - a[2];
  const lengthSq = abR * abR + abG * abG + abB * abB;
  if (lengthSq <= 0.0001) return 0;

  return clamp(
    ((source[0] - a[0]) * abR +
      (source[1] - a[1]) * abG +
      (source[2] - a[2]) * abB) /
      lengthSq,
    0,
    1
  );
};

const getSegmentResidual = (source: RGB, a: RGB, b: RGB, coverage: number) => {
  const mixed: RGB = [
    a[0] + (b[0] - a[0]) * coverage,
    a[1] + (b[1] - a[1]) * coverage,
    a[2] + (b[2] - a[2]) * coverage,
  ];
  return colorDistance(source, mixed);
};

const colorDistance = (left: RGB, right: RGB) => {
  const dr = left[0] - right[0];
  const dg = left[1] - right[1];
  const db = left[2] - right[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

const stableNoiseThreshold = (x: number, y: number) => {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
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

interface HueMixColor {
  color: RGB;
  hue: number;
  luma: number;
  saturation: number;
}

interface HueMixPalette {
  chromatic: HueMixColor[];
  white: HueMixColor | null;
}

const getHueMixPalette = (palette: RGB[]): HueMixPalette => {
  const colors = palette.map((color) => ({
    color,
    hue: getHue(color),
    luma: luma709(color[0], color[1], color[2]),
    saturation: getSaturation(color),
  }));
  const chromatic = colors
    .filter((entry) => entry.saturation >= 0.18 && entry.luma >= 24)
    .sort((left, right) => left.hue - right.hue);
  const neutralCandidates = colors.filter((entry) => entry.saturation < 0.18);
  const whiteCandidates = neutralCandidates.length ? neutralCandidates : colors;
  let white: HueMixColor | null = null;
  for (const entry of whiteCandidates) {
    if (!white || entry.luma > white.luma) white = entry;
  }

  return {
    chromatic,
    white,
  };
};

const hueMixDitherPixelValue = (
  pixel: RGBA,
  coordinates: [number, number],
  hueMixPalette: HueMixPalette,
  colorPalette: RGB[],
  colorMatching: ColorMatchingMode
): RGBA => {
  if (hueMixPalette.chromatic.length < 2 || !hueMixPalette.white) {
    return findClosestPaletteColor(pixel, colorPalette, colorMatching);
  }

  const targetSaturation = getSaturation(pixel);
  if (targetSaturation < 0.08) {
    return findClosestPaletteColor(pixel, colorPalette, colorMatching);
  }

  const targetHue = getHue(pixel);
  const [left, right, t] = getHueNeighbors(targetHue, hueMixPalette.chromatic);
  const hueMix = smoothstep(0, 1, t);
  const mixedLuma = left.luma * (1 - hueMix) + right.luma * hueMix;
  const targetLuma = luma709(pixel[0], pixel[1], pixel[2]);
  const whiteLuma = hueMixPalette.white.luma;
  const saturationCoverage = smoothstep(0.08, 0.55, targetSaturation);
  const lumaCoverage =
    whiteLuma > mixedLuma
      ? clamp((whiteLuma - targetLuma) / (whiteLuma - mixedLuma), 0, 1)
      : 0;
  const coverage = clamp(Math.max(saturationCoverage, lumaCoverage), 0, 1);
  const whiteWeight = 1 - coverage;
  const leftWeight = coverage * (1 - hueMix);
  const rightWeight = coverage * hueMix;
  const threshold = hashUnit(coordinates[0], coordinates[1]);

  if (threshold < whiteWeight) return withAlpha(hueMixPalette.white.color, pixel);
  if (threshold < whiteWeight + leftWeight) return withAlpha(left.color, pixel);
  if (rightWeight > 0) return withAlpha(right.color, pixel);
  return withAlpha(left.color, pixel);
};

const getHueNeighbors = (
  targetHue: number,
  chromatic: HueMixColor[]
): [HueMixColor, HueMixColor, number] => {
  for (let index = 0; index < chromatic.length; index += 1) {
    const left = chromatic[index];
    const right = chromatic[(index + 1) % chromatic.length];
    const span = positiveHueDelta(left.hue, right.hue);
    const offset = positiveHueDelta(left.hue, targetHue);
    if (offset <= span) {
      return [left, right, span === 0 ? 0 : offset / span];
    }
  }

  return [chromatic[0], chromatic[0], 0];
};

const withAlpha = (color: RGB, pixel: RGBA): RGBA => [
  color[0],
  color[1],
  color[2],
  pixel[3],
];

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
};

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

const hashUnit = (x: number, y: number) => {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
};

const getSaturation = (color: RGB | RGBA) =>
  getSaturationFromChannels(color[0], color[1], color[2]);

const getSaturationFromChannels = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;

  return max === 0 ? 0 : (max - min) / max;
};

const getHue = (color: RGB | RGBA) =>
  getHueFromChannels(color[0], color[1], color[2]);

const getHueFromChannels = (r: number, g: number, b: number) => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  if (delta === 0) return 0;

  let hue: number;
  if (max === red) {
    hue = 60 * (((green - blue) / delta) % 6);
  } else if (max === green) {
    hue = 60 * ((blue - red) / delta + 2);
  } else {
    hue = 60 * ((red - green) / delta + 4);
  }

  return hue < 0 ? hue + 360 : hue;
};

const getHueDistance = (hueA: number, hueB: number) => {
  const delta = Math.abs(hueA - hueB) % 360;
  return Math.min(delta, 360 - delta);
};

const positiveHueDelta = (from: number, to: number) => (to - from + 360) % 360;

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

export {
  applyImageAdjustments,
  applyImageAdjustmentsPreview,
  applyImageDataAdjustments,
  applyImageDataAdjustmentsAsync,
  ditherCanvas,
  ditherImage,
};
