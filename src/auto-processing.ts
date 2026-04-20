import type {
  CanvasLike,
  DitherImageOptions,
  ImageDataLike,
} from "./dither/dither";
import type {
  ColorMatchingMode,
  DynamicRangeCompressionOptions,
  ProcessingPresetName,
  ToneMappingOptions,
} from "./dither/processing";
import type { PaletteColorEntry } from "./dither/functions/palette-order";
import {
  classifyCanvasImageStyle,
  classifyImageStyle,
  type ClassifyImageStyleOptions,
  type ImageKind,
  type ImageStyleClassification,
} from "./image-style";

export type AutoProcessingIntent =
  | "natural"
  | "vivid"
  | "readable"
  | "faithful"
  | "lowNoise";

export interface SuggestProcessingOptionsInput
  extends ClassifyImageStyleOptions {
  intent?: AutoProcessingIntent;
}

export interface ProcessingSuggestion {
  classification: ImageStyleClassification;
  imageKind: ImageKind;
  intent: AutoProcessingIntent;
  ditherOptions: Partial<DitherImageOptions>;
  reasons: string[];
  scores: Record<string, number>;
}

interface PaletteProfile {
  colorCount: number;
  lumaRange: number;
  saturationRange: number;
  averageSaturation: number;
}

interface RecommendationBase {
  processingPreset: ProcessingPresetName;
  colorMatching: ColorMatchingMode;
  errorDiffusionMatrix: string;
  ditheringType?: DitherImageOptions["ditheringType"];
  toneMapping?: ToneMappingOptions;
  dynamicRangeCompression?: DynamicRangeCompressionOptions;
}

export function suggestProcessingOptions(
  image: ImageDataLike,
  palette?: PaletteColorEntry[] | string[],
  options: SuggestProcessingOptionsInput = {}
): ProcessingSuggestion {
  const classification = classifyImageStyle(image, options);
  return buildSuggestion(classification, getPaletteProfile(palette), options);
}

export function suggestCanvasProcessingOptions(
  canvas: CanvasLike,
  palette?: PaletteColorEntry[] | string[],
  options: SuggestProcessingOptionsInput = {}
): ProcessingSuggestion {
  const classification = classifyCanvasImageStyle(canvas, options);
  return buildSuggestion(classification, getPaletteProfile(palette), options);
}

function buildSuggestion(
  classification: ImageStyleClassification,
  paletteProfile: PaletteProfile | null,
  options: SuggestProcessingOptionsInput
): ProcessingSuggestion {
  const intent = options.intent ?? "natural";
  const reasons: string[] = [];
  const scores = getPresetScores(classification, paletteProfile, intent);
  const recommendedPreset = getBestScore(scores);
  const base = getBaseRecommendation(classification.kind, recommendedPreset);

  addClassificationReasons(classification, reasons);
  addPaletteReasons(paletteProfile, reasons);
  applyIntent(base, intent, reasons);
  applyPaletteTuning(base, paletteProfile, reasons);

  return {
    classification,
    imageKind: classification.kind,
    intent,
    ditherOptions: {
      processingPreset: base.processingPreset,
      colorMatching: base.colorMatching,
      errorDiffusionMatrix: base.errorDiffusionMatrix,
      ditheringType: base.ditheringType ?? "errorDiffusion",
      ...(base.toneMapping ? { toneMapping: base.toneMapping } : {}),
      ...(base.dynamicRangeCompression
        ? { dynamicRangeCompression: base.dynamicRangeCompression }
        : {}),
    },
    reasons,
    scores,
  };
}

function getBaseRecommendation(
  kind: ImageKind,
  fallbackPreset: ProcessingPresetName
): RecommendationBase {
  switch (kind) {
    case "textOrUi":
      return {
        processingPreset: "balanced",
        colorMatching: "lab",
        errorDiffusionMatrix: "floydSteinberg",
        ditheringType: "quantizationOnly",
        toneMapping: {
          mode: "contrast",
          exposure: 1.05,
          saturation: 1,
          contrast: 1.18,
        },
        dynamicRangeCompression: { mode: "display", strength: 0.75 },
      };
    case "lineArt":
      return {
        processingPreset: "balanced",
        colorMatching: "lab",
        errorDiffusionMatrix: "floydSteinberg",
        ditheringType: "quantizationOnly",
        toneMapping: {
          mode: "contrast",
          exposure: 1,
          saturation: 0.8,
          contrast: 1.25,
        },
        dynamicRangeCompression: { mode: "display", strength: 0.65 },
      };
    case "pixelArt":
      return {
        processingPreset: "vivid",
        colorMatching: "rgb",
        errorDiffusionMatrix: "floydSteinberg",
        ditheringType: "quantizationOnly",
        toneMapping: { mode: "off", exposure: 1, saturation: 1 },
        dynamicRangeCompression: { mode: "off" },
      };
    case "flatIllustration":
      return {
        processingPreset: "vivid",
        colorMatching: "rgb",
        errorDiffusionMatrix: "floydSteinberg",
        ditheringType: "errorDiffusion",
      };
    case "lowContrastPhoto":
      return {
        processingPreset: "dynamic",
        colorMatching: "rgb",
        errorDiffusionMatrix: "stucki",
        ditheringType: "errorDiffusion",
        toneMapping: {
          mode: "scurve",
          exposure: 1.08,
          saturation: 1.25,
          strength: 0.82,
          shadowBoost: 0.06,
          highlightCompress: 1.35,
          midpoint: 0.48,
        },
        dynamicRangeCompression: { mode: "display", strength: 0.85 },
      };
    case "highContrastPhoto":
      return {
        processingPreset: "soft",
        colorMatching: "rgb",
        errorDiffusionMatrix: "stucki",
        ditheringType: "errorDiffusion",
        dynamicRangeCompression: { mode: "display", strength: 0.9 },
      };
    case "photo":
      return {
        processingPreset: fallbackPreset,
        colorMatching: "rgb",
        errorDiffusionMatrix:
          fallbackPreset === "soft" ? "stucki" : "floydSteinberg",
        ditheringType: "errorDiffusion",
      };
    case "unknown":
    default:
      return {
        processingPreset: "balanced",
        colorMatching: "rgb",
        errorDiffusionMatrix: "floydSteinberg",
        ditheringType: "errorDiffusion",
      };
  }
}

function getPresetScores(
  classification: ImageStyleClassification,
  paletteProfile: PaletteProfile | null,
  intent: AutoProcessingIntent
): Record<string, number> {
  const { metrics } = classification;
  const { kindScores } = classification;
  const scores: Record<string, number> = {
    balanced: 0.52,
    dynamic: 0.48,
    vivid: 0.45,
    soft: 0.44,
    grayscale: 0.28,
  };

  if (classification.style === "photo") {
    scores.dynamic += 0.18;
    scores.balanced += 0.12;
    scores.soft += metrics.lumaStdDev >= 68 ? 0.2 : 0.06;
  } else if (classification.style === "illustration") {
    scores.vivid += 0.28;
    scores.balanced += 0.08;
  }

  scores.dynamic += kindScores.lowContrastPhoto * 0.24;
  scores.soft += kindScores.highContrastPhoto * 0.26;
  scores.vivid += kindScores.flatIllustration * 0.24;
  scores.vivid += kindScores.pixelArt * 0.18;
  scores.balanced += (kindScores.textOrUi + kindScores.lineArt) * 0.18;
  scores.grayscale +=
    (kindScores.textOrUi + kindScores.lineArt) *
    (metrics.grayRatio >= 0.7 ? 0.24 : 0.08);

  if (metrics.saturationMean <= 0.1 && metrics.grayRatio >= 0.82) {
    scores.grayscale += 0.22;
  }

  if (paletteProfile && paletteProfile.colorCount <= 2) {
    scores.grayscale += 0.3;
    scores.vivid -= 0.1;
  }

  if (intent === "vivid") scores.vivid += 0.18;
  if (intent === "faithful") scores.balanced += 0.16;
  if (intent === "lowNoise") scores.soft += 0.16;
  if (intent === "readable") {
    scores.balanced += 0.14;
    scores.grayscale += 0.1;
  }

  return scores;
}

function addClassificationReasons(
  classification: ImageStyleClassification,
  reasons: string[]
) {
  const { metrics } = classification;
  reasons.push(`Detected ${classification.kind}.`);

  if (metrics.flatRatio >= 0.65) {
    reasons.push("Large flat regions suggest graphic-style preservation.");
  }
  if (metrics.softChangeRatio >= 0.38) {
    reasons.push("Soft tonal transitions suggest photo-oriented processing.");
  }
  if (metrics.lumaStdDev <= 28) {
    reasons.push("Low luminance spread benefits from stronger tone shaping.");
  }
  if (metrics.lumaStdDev >= 72) {
    reasons.push("High luminance spread benefits from softer compression.");
  }
  if (metrics.strongEdgeRatio >= 0.22) {
    reasons.push("Strong edges favor edge-preserving quantization.");
  }
  if (metrics.topColorCoverage >= 0.55) {
    reasons.push("Dominant repeated colors suggest palette-preserving settings.");
  }
  if (metrics.textTileRatio >= 0.12) {
    reasons.push("Text-like tiles favor readable edge handling.");
  }
  if (metrics.photoTileRatio >= 0.4) {
    reasons.push("Photo-like tiles favor smoother tonal processing.");
  }
  if (metrics.edgeDensity >= 0.14) {
    reasons.push("High edge density affects dithering and matching choice.");
  }
}

function addPaletteReasons(
  paletteProfile: PaletteProfile | null,
  reasons: string[]
) {
  if (!paletteProfile) return;

  if (paletteProfile.colorCount <= 2) {
    reasons.push("Two-color palette favors LAB matching and grayscale-safe output.");
  } else if (paletteProfile.averageSaturation >= 0.55) {
    reasons.push("Colorful target palette can support vivid color mapping.");
  }

  if (paletteProfile.lumaRange <= 150) {
    reasons.push("Limited palette luminance range benefits from range compression.");
  }
}

function applyIntent(
  recommendation: RecommendationBase,
  intent: AutoProcessingIntent,
  reasons: string[]
) {
  if (intent === "vivid") {
    recommendation.processingPreset = "vivid";
    recommendation.colorMatching = "rgb";
    recommendation.toneMapping = {
      ...recommendation.toneMapping,
      mode: "scurve",
      saturation: Math.max(recommendation.toneMapping?.saturation ?? 1, 1.45),
      strength: recommendation.toneMapping?.strength ?? 0.72,
      shadowBoost: recommendation.toneMapping?.shadowBoost ?? 0.08,
      highlightCompress: recommendation.toneMapping?.highlightCompress ?? 1.3,
      midpoint: recommendation.toneMapping?.midpoint ?? 0.5,
    };
    reasons.push("Vivid intent boosts saturation and color-priority matching.");
  } else if (intent === "readable") {
    recommendation.colorMatching = "lab";
    recommendation.ditheringType = "quantizationOnly";
    reasons.push("Readable intent favors clear edges over dithering texture.");
  } else if (intent === "lowNoise") {
    recommendation.errorDiffusionMatrix = "stucki";
    recommendation.processingPreset = "soft";
    reasons.push("Low-noise intent chooses smoother tone handling.");
  } else if (intent === "faithful") {
    recommendation.processingPreset = "balanced";
    reasons.push("Faithful intent keeps transformations restrained.");
  }
}

function applyPaletteTuning(
  recommendation: RecommendationBase,
  paletteProfile: PaletteProfile | null,
  reasons: string[]
) {
  if (!paletteProfile) return;

  if (paletteProfile.colorCount <= 2) {
    recommendation.colorMatching = "lab";
    recommendation.processingPreset = "grayscale";
    recommendation.toneMapping = {
      mode: "scurve",
      exposure: 1,
      saturation: 0,
      strength: 0.8,
      shadowBoost: 0.1,
      highlightCompress: 1.4,
      midpoint: 0.5,
    };
    reasons.push("Monochrome palette switches to grayscale-oriented settings.");
  } else if (paletteProfile.lumaRange <= 150) {
    recommendation.dynamicRangeCompression = {
      mode: "display",
      strength: Math.max(
        recommendation.dynamicRangeCompression?.strength ?? 0,
        0.8
      ),
    };
  }
}

function getBestScore(scores: Record<string, number>): ProcessingPresetName {
  return Object.entries(scores).reduce(
    (best, current) => (current[1] > best[1] ? current : best),
    ["balanced", -Infinity]
  )[0] as ProcessingPresetName;
}

function getPaletteProfile(
  palette: PaletteColorEntry[] | string[] | undefined
): PaletteProfile | null {
  if (!palette?.length) return null;

  const colors = palette
    .map((entry) => (typeof entry === "string" ? entry : entry.color))
    .map(hexToRgb)
    .filter((color): color is [number, number, number] => color !== null);

  if (!colors.length) return null;

  const lumas = colors.map(([r, g, b]) => getLuma(r, g, b));
  const saturations = colors.map(([r, g, b]) => getSaturation(r, g, b));

  return {
    colorCount: colors.length,
    lumaRange: Math.max(...lumas) - Math.min(...lumas),
    saturationRange: Math.max(...saturations) - Math.min(...saturations),
    averageSaturation:
      saturations.reduce((sum, saturation) => sum + saturation, 0) /
      saturations.length,
  };
}

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = hex.replace(/^#/, "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;

  return [
    parseInt(expanded.slice(0, 2), 16),
    parseInt(expanded.slice(2, 4), 16),
    parseInt(expanded.slice(4, 6), 16),
  ];
}

function getLuma(red: number, green: number, blue: number) {
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function getSaturation(red: number, green: number, blue: number): number {
  const max = Math.max(red, green, blue) / 255;
  const min = Math.min(red, green, blue) / 255;

  return max === 0 ? 0 : (max - min) / max;
}
