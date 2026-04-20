import type { CanvasLike, ImageDataLike } from "./dither/dither";

export type ImageStyle = "photo" | "illustration" | "unknown";
export type ImageKind =
  | "photo"
  | "lowContrastPhoto"
  | "highContrastPhoto"
  | "flatIllustration"
  | "lineArt"
  | "textOrUi"
  | "pixelArt"
  | "unknown";

export interface ImageStyleMetrics {
  sampleCount: number;
  uniqueColorRatio: number;
  topColorCoverage: number;
  paletteEntropy: number;
  flatRatio: number;
  softChangeRatio: number;
  strongEdgeRatio: number;
  edgeDensity: number;
  horizontalEdgeRatio: number;
  verticalEdgeRatio: number;
  lumaStdDev: number;
  saturationMean: number;
  saturationStdDev: number;
  darkRatio: number;
  lightRatio: number;
  grayRatio: number;
  highSaturationRatio: number;
  photoTileRatio: number;
  flatTileRatio: number;
  textTileRatio: number;
  gradientTileRatio: number;
  transparentRatio: number;
}

export interface ImageStyleClassification {
  style: ImageStyle;
  kind: ImageKind;
  kindScores: Record<ImageKind, number>;
  confidence: number;
  photoScore: number;
  metrics: ImageStyleMetrics;
}

export interface ClassifyImageStyleOptions {
  /**
   * Longest side of the internal sample grid. Larger values are slower but can
   * preserve more detail for tiny repeated patterns.
   */
  maxSampleDimension?: number;

  /** Pixels at or below this alpha value are ignored. */
  transparentAlphaThreshold?: number;

  /**
   * Decision threshold for `photoScore`. Raise it to classify ambiguous images
   * as illustrations more often, lower it to classify them as photos more often.
   */
  photoThreshold?: number;
}

interface Sample {
  visible: boolean;
  red: number;
  green: number;
  blue: number;
  luma: number;
  saturation: number;
}

const DEFAULT_MAX_SAMPLE_DIMENSION = 160;
const DEFAULT_ALPHA_THRESHOLD = 16;
const DEFAULT_PHOTO_THRESHOLD = 0.5;

const EMPTY_METRICS: ImageStyleMetrics = {
  sampleCount: 0,
  uniqueColorRatio: 0,
  topColorCoverage: 0,
  paletteEntropy: 0,
  flatRatio: 0,
  softChangeRatio: 0,
  strongEdgeRatio: 0,
  edgeDensity: 0,
  horizontalEdgeRatio: 0,
  verticalEdgeRatio: 0,
  lumaStdDev: 0,
  saturationMean: 0,
  saturationStdDev: 0,
  darkRatio: 0,
  lightRatio: 0,
  grayRatio: 0,
  highSaturationRatio: 0,
  photoTileRatio: 0,
  flatTileRatio: 0,
  textTileRatio: 0,
  gradientTileRatio: 0,
  transparentRatio: 0,
};

const EMPTY_KIND_SCORES: Record<ImageKind, number> = {
  photo: 0,
  lowContrastPhoto: 0,
  highContrastPhoto: 0,
  flatIllustration: 0,
  lineArt: 0,
  textOrUi: 0,
  pixelArt: 0,
  unknown: 1,
};

/**
 * Heuristically classify image data as a photo or an illustration.
 *
 * This does not use ML. It looks for signals that usually separate photos from
 * illustrations: color diversity, soft tonal changes, flat-color regions, edge
 * density, and saturation/luminance variation.
 */
export function classifyImageStyle(
  image: ImageDataLike,
  options: ClassifyImageStyleOptions = {}
): ImageStyleClassification {
  validateImageData(image);

  const width = image.width;
  const height = image.height;
  const maxSampleDimension = Math.max(
    1,
    Math.floor(options.maxSampleDimension ?? DEFAULT_MAX_SAMPLE_DIMENSION)
  );
  const alphaThreshold =
    options.transparentAlphaThreshold ?? DEFAULT_ALPHA_THRESHOLD;
  const photoThreshold = options.photoThreshold ?? DEFAULT_PHOTO_THRESHOLD;

  const scale = Math.min(1, maxSampleDimension / Math.max(width, height));
  const sampleWidth = Math.max(1, Math.round(width * scale));
  const sampleHeight = Math.max(1, Math.round(height * scale));
  const samples = new Array<Sample>(sampleWidth * sampleHeight);
  const colorCounts = new Map<number, number>();

  let visibleCount = 0;
  let transparentCount = 0;
  let lumaSum = 0;
  let lumaSquareSum = 0;
  let saturationSum = 0;
  let saturationSquareSum = 0;
  let darkCount = 0;
  let lightCount = 0;
  let grayCount = 0;
  let highSaturationCount = 0;

  for (let y = 0; y < sampleHeight; y += 1) {
    const sourceY = Math.min(
      height - 1,
      Math.floor((y / sampleHeight) * height)
    );

    for (let x = 0; x < sampleWidth; x += 1) {
      const sourceX = Math.min(
        width - 1,
        Math.floor((x / sampleWidth) * width)
      );
      const sourceIndex = (sourceY * width + sourceX) * 4;
      const alpha = image.data[sourceIndex + 3] ?? 255;

      if (alpha <= alphaThreshold) {
        transparentCount += 1;
        samples[y * sampleWidth + x] = {
          visible: false,
          red: 0,
          green: 0,
          blue: 0,
          luma: 0,
          saturation: 0,
        };
        continue;
      }

      const red = image.data[sourceIndex];
      const green = image.data[sourceIndex + 1];
      const blue = image.data[sourceIndex + 2];
      const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      const saturation = getSaturation(red, green, blue);

      visibleCount += 1;
      lumaSum += luma;
      lumaSquareSum += luma * luma;
      saturationSum += saturation;
      saturationSquareSum += saturation * saturation;
      if (luma <= 36) darkCount += 1;
      if (luma >= 220) lightCount += 1;
      if (saturation <= 0.08) grayCount += 1;
      if (saturation >= 0.72) highSaturationCount += 1;
      const colorKey = getQuantizedColorKey(red, green, blue);
      colorCounts.set(colorKey, (colorCounts.get(colorKey) ?? 0) + 1);

      samples[y * sampleWidth + x] = {
        visible: true,
        red,
        green,
        blue,
        luma,
        saturation,
      };
    }
  }

  if (visibleCount === 0) {
    return {
      style: "unknown",
      kind: "unknown",
      kindScores: { ...EMPTY_KIND_SCORES },
      confidence: 0,
      photoScore: 0,
      metrics: {
        ...EMPTY_METRICS,
        transparentRatio: transparentCount / samples.length,
      },
    };
  }

  const neighborMetrics = getNeighborMetrics(samples, sampleWidth, sampleHeight);
  const colorMetrics = getColorDistributionMetrics(colorCounts, visibleCount);
  const edgeMetrics = getEdgeMetrics(samples, sampleWidth, sampleHeight);
  const tileMetrics = getTileMetrics(samples, sampleWidth, sampleHeight);
  const lumaMean = lumaSum / visibleCount;
  const saturationMean = saturationSum / visibleCount;
  const metrics: ImageStyleMetrics = {
    sampleCount: visibleCount,
    uniqueColorRatio: colorCounts.size / visibleCount,
    topColorCoverage: colorMetrics.topColorCoverage,
    paletteEntropy: colorMetrics.paletteEntropy,
    flatRatio: neighborMetrics.flatRatio,
    softChangeRatio: neighborMetrics.softChangeRatio,
    strongEdgeRatio: neighborMetrics.strongEdgeRatio,
    edgeDensity: edgeMetrics.edgeDensity,
    horizontalEdgeRatio: edgeMetrics.horizontalEdgeRatio,
    verticalEdgeRatio: edgeMetrics.verticalEdgeRatio,
    lumaStdDev: Math.sqrt(
      Math.max(0, lumaSquareSum / visibleCount - lumaMean * lumaMean)
    ),
    saturationMean,
    saturationStdDev: Math.sqrt(
      Math.max(
        0,
        saturationSquareSum / visibleCount - saturationMean * saturationMean
      )
    ),
    darkRatio: darkCount / visibleCount,
    lightRatio: lightCount / visibleCount,
    grayRatio: grayCount / visibleCount,
    highSaturationRatio: highSaturationCount / visibleCount,
    photoTileRatio: tileMetrics.photoTileRatio,
    flatTileRatio: tileMetrics.flatTileRatio,
    textTileRatio: tileMetrics.textTileRatio,
    gradientTileRatio: tileMetrics.gradientTileRatio,
    transparentRatio: transparentCount / samples.length,
  };

  const photoScore = getPhotoScore(metrics);
  const confidence = clamp01(Math.abs(photoScore - photoThreshold) * 2);
  const style = photoScore >= photoThreshold ? "photo" : "illustration";
  const kindScores = getImageKindScores(metrics, photoScore);
  const kind = getBestKind(kindScores);

  return {
    style,
    kind,
    kindScores,
    confidence,
    photoScore,
    metrics,
  };
}

export function classifyCanvasImageStyle(
  canvas: CanvasLike,
  options: ClassifyImageStyleOptions = {}
): ImageStyleClassification {
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Unable to read image data from canvas.");
  }

  return classifyImageStyle(
    ctx.getImageData(0, 0, canvas.width, canvas.height),
    options
  );
}

export function isPhotoImage(
  image: ImageDataLike,
  options: ClassifyImageStyleOptions = {}
): boolean {
  return classifyImageStyle(image, options).style === "photo";
}

export function isIllustrationImage(
  image: ImageDataLike,
  options: ClassifyImageStyleOptions = {}
): boolean {
  return classifyImageStyle(image, options).style === "illustration";
}

function validateImageData(image: ImageDataLike) {
  if (!image || image.width <= 0 || image.height <= 0) {
    throw new Error("Image data must have a positive width and height.");
  }

  if (!image.data || image.data.length < image.width * image.height * 4) {
    throw new Error("Image data does not contain enough RGBA pixel data.");
  }
}

function getNeighborMetrics(
  samples: Sample[],
  width: number,
  height: number
): Pick<ImageStyleMetrics, "flatRatio" | "softChangeRatio" | "strongEdgeRatio"> {
  let neighborCount = 0;
  let flatCount = 0;
  let softChangeCount = 0;
  let strongEdgeCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sample = samples[y * width + x];

      if (!sample.visible) {
        continue;
      }

      if (x + 1 < width) {
        const neighbor = samples[y * width + x + 1];
        if (neighbor.visible) {
          neighborCount += 1;
          const difference = getColorDifference(sample, neighbor);
          if (difference <= 4) {
            flatCount += 1;
          } else if (difference <= 28) {
            softChangeCount += 1;
          } else {
            strongEdgeCount += 1;
          }
        }
      }

      if (y + 1 < height) {
        const neighbor = samples[(y + 1) * width + x];
        if (neighbor.visible) {
          neighborCount += 1;
          const difference = getColorDifference(sample, neighbor);
          if (difference <= 4) {
            flatCount += 1;
          } else if (difference <= 28) {
            softChangeCount += 1;
          } else {
            strongEdgeCount += 1;
          }
        }
      }
    }
  }

  if (neighborCount === 0) {
    return {
      flatRatio: 1,
      softChangeRatio: 0,
      strongEdgeRatio: 0,
    };
  }

  return {
    flatRatio: flatCount / neighborCount,
    softChangeRatio: softChangeCount / neighborCount,
    strongEdgeRatio: strongEdgeCount / neighborCount,
  };
}

function getColorDistributionMetrics(
  colorCounts: Map<number, number>,
  sampleCount: number
): Pick<ImageStyleMetrics, "topColorCoverage" | "paletteEntropy"> {
  if (sampleCount === 0) {
    return {
      topColorCoverage: 0,
      paletteEntropy: 0,
    };
  }

  const counts = [...colorCounts.values()].sort((a, b) => b - a);
  const topCount = counts
    .slice(0, 8)
    .reduce((total, count) => total + count, 0);
  const entropy = counts.reduce((total, count) => {
    const probability = count / sampleCount;
    return total - probability * Math.log2(probability);
  }, 0);
  const maxEntropy = Math.log2(Math.max(2, colorCounts.size));

  return {
    topColorCoverage: topCount / sampleCount,
    paletteEntropy: maxEntropy === 0 ? 0 : entropy / maxEntropy,
  };
}

function getEdgeMetrics(
  samples: Sample[],
  width: number,
  height: number
): Pick<
  ImageStyleMetrics,
  "edgeDensity" | "horizontalEdgeRatio" | "verticalEdgeRatio"
> {
  let checkedCount = 0;
  let edgeCount = 0;
  let horizontalCount = 0;
  let verticalCount = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const center = samples[y * width + x];
      const left = samples[y * width + x - 1];
      const right = samples[y * width + x + 1];
      const up = samples[(y - 1) * width + x];
      const down = samples[(y + 1) * width + x];

      if (
        !center.visible ||
        !left.visible ||
        !right.visible ||
        !up.visible ||
        !down.visible
      ) {
        continue;
      }

      checkedCount += 1;
      const dx = Math.abs(right.luma - left.luma);
      const dy = Math.abs(down.luma - up.luma);
      const magnitude = Math.sqrt(dx * dx + dy * dy);

      if (magnitude >= 42) {
        edgeCount += 1;
        if (dy > dx * 1.2) {
          horizontalCount += 1;
        } else if (dx > dy * 1.2) {
          verticalCount += 1;
        }
      }
    }
  }

  if (checkedCount === 0 || edgeCount === 0) {
    return {
      edgeDensity: 0,
      horizontalEdgeRatio: 0,
      verticalEdgeRatio: 0,
    };
  }

  return {
    edgeDensity: edgeCount / checkedCount,
    horizontalEdgeRatio: horizontalCount / edgeCount,
    verticalEdgeRatio: verticalCount / edgeCount,
  };
}

function getTileMetrics(
  samples: Sample[],
  width: number,
  height: number
): Pick<
  ImageStyleMetrics,
  "photoTileRatio" | "flatTileRatio" | "textTileRatio" | "gradientTileRatio"
> {
  const tileSize = Math.max(8, Math.floor(Math.min(width, height) / 10));
  let tileCount = 0;
  let photoTileCount = 0;
  let flatTileCount = 0;
  let textTileCount = 0;
  let gradientTileCount = 0;

  for (let tileY = 0; tileY < height; tileY += tileSize) {
    for (let tileX = 0; tileX < width; tileX += tileSize) {
      const tile = getTileStats(samples, width, height, tileX, tileY, tileSize);
      if (!tile) continue;

      tileCount += 1;

      if (
        tile.edgeDensity >= 0.16 &&
        tile.grayRatio >= 0.55 &&
        tile.lumaStdDev >= 38
      ) {
        textTileCount += 1;
      }

      if (tile.uniqueColorRatio <= 0.12 && tile.flatRatio >= 0.62) {
        flatTileCount += 1;
      }

      if (
        tile.uniqueColorRatio >= 0.18 &&
        tile.lumaStdDev >= 18 &&
        tile.flatRatio <= 0.68
      ) {
        photoTileCount += 1;
      }

      if (
        tile.softChangeRatio >= 0.38 &&
        tile.strongEdgeRatio <= 0.16 &&
        tile.lumaStdDev >= 12
      ) {
        gradientTileCount += 1;
      }
    }
  }

  if (tileCount === 0) {
    return {
      photoTileRatio: 0,
      flatTileRatio: 0,
      textTileRatio: 0,
      gradientTileRatio: 0,
    };
  }

  return {
    photoTileRatio: photoTileCount / tileCount,
    flatTileRatio: flatTileCount / tileCount,
    textTileRatio: textTileCount / tileCount,
    gradientTileRatio: gradientTileCount / tileCount,
  };
}

function getTileStats(
  samples: Sample[],
  width: number,
  height: number,
  tileX: number,
  tileY: number,
  tileSize: number
) {
  const colors = new Set<number>();
  let visibleCount = 0;
  let grayCount = 0;
  let lumaSum = 0;
  let lumaSquareSum = 0;
  let neighborCount = 0;
  let flatCount = 0;
  let softChangeCount = 0;
  let strongEdgeCount = 0;

  const maxY = Math.min(height, tileY + tileSize);
  const maxX = Math.min(width, tileX + tileSize);

  for (let y = tileY; y < maxY; y += 1) {
    for (let x = tileX; x < maxX; x += 1) {
      const sample = samples[y * width + x];
      if (!sample.visible) continue;

      visibleCount += 1;
      lumaSum += sample.luma;
      lumaSquareSum += sample.luma * sample.luma;
      if (sample.saturation <= 0.08) grayCount += 1;
      colors.add(getQuantizedColorKey(sample.red, sample.green, sample.blue));

      if (x + 1 < maxX) {
        const neighbor = samples[y * width + x + 1];
        if (neighbor.visible) {
          const difference = getColorDifference(sample, neighbor);
          neighborCount += 1;
          if (difference <= 4) flatCount += 1;
          else if (difference <= 28) softChangeCount += 1;
          else strongEdgeCount += 1;
        }
      }

      if (y + 1 < maxY) {
        const neighbor = samples[(y + 1) * width + x];
        if (neighbor.visible) {
          const difference = getColorDifference(sample, neighbor);
          neighborCount += 1;
          if (difference <= 4) flatCount += 1;
          else if (difference <= 28) softChangeCount += 1;
          else strongEdgeCount += 1;
        }
      }
    }
  }

  if (visibleCount < Math.max(12, (tileSize * tileSize) / 4)) return null;

  const lumaMean = lumaSum / visibleCount;
  const strongEdgeRatio = neighborCount === 0 ? 0 : strongEdgeCount / neighborCount;

  return {
    uniqueColorRatio: colors.size / visibleCount,
    grayRatio: grayCount / visibleCount,
    flatRatio: neighborCount === 0 ? 1 : flatCount / neighborCount,
    softChangeRatio: neighborCount === 0 ? 0 : softChangeCount / neighborCount,
    strongEdgeRatio,
    edgeDensity: strongEdgeRatio,
    lumaStdDev: Math.sqrt(
      Math.max(0, lumaSquareSum / visibleCount - lumaMean * lumaMean)
    ),
  };
}

function getPhotoScore(metrics: ImageStyleMetrics): number {
  const uniqueScore = normalize(metrics.uniqueColorRatio, 0.08, 0.35);
  const softChangeScore = normalize(metrics.softChangeRatio, 0.18, 0.48);
  const textureScore = normalize(1 - metrics.flatRatio, 0.2, 0.65);
  const lumaScore = normalize(metrics.lumaStdDev, 24, 72);
  const saturationSpreadScore = normalize(metrics.saturationStdDev, 0.08, 0.26);
  const entropyScore = normalize(metrics.paletteEntropy, 0.55, 0.9);
  const photoTileScore = normalize(metrics.photoTileRatio, 0.18, 0.62);
  const desaturatedPhotoScore = Math.min(
    normalize(metrics.grayRatio, 0.45, 0.75),
    normalize(metrics.photoTileRatio, 0.34, 0.58),
    normalize(metrics.lumaStdDev, 48, 76),
    normalize(1 - metrics.flatRatio, 0.34, 0.58),
    normalize(metrics.paletteEntropy, 0.62, 0.88)
  );
  const flatIllustrationPenalty = normalize(metrics.flatRatio, 0.55, 0.88);
  const topColorPenalty = normalize(metrics.topColorCoverage, 0.45, 0.86);
  const hardEdgePenalty =
    metrics.flatRatio > 0.35
      ? normalize(metrics.strongEdgeRatio, 0.28, 0.58)
      : 0;

  return clamp01(
    uniqueScore * 0.34 +
      softChangeScore * 0.22 +
      textureScore * 0.16 +
      lumaScore * 0.1 +
      saturationSpreadScore * 0.06 +
      entropyScore * 0.07 +
      photoTileScore * 0.13 +
      desaturatedPhotoScore * 0.24 -
      flatIllustrationPenalty * 0.12 -
      topColorPenalty * 0.1 -
      hardEdgePenalty * 0.08
  );
}

function getImageKindScores(
  metrics: ImageStyleMetrics,
  photoScore: number
): Record<ImageKind, number> {
  const contrastEndpointRatio = metrics.darkRatio + metrics.lightRatio;
  const photoTileLineArtPenalty = normalize(metrics.photoTileRatio, 0.32, 0.58);

  return {
    photo: clamp01(
      photoScore * 0.55 +
        normalize(metrics.photoTileRatio, 0.12, 0.62) * 0.25 +
        normalize(metrics.paletteEntropy, 0.55, 0.9) * 0.12 +
        normalize(metrics.softChangeRatio, 0.22, 0.48) * 0.08
    ),
    lowContrastPhoto: clamp01(
      photoScore * 0.38 +
        normalize(34 - metrics.lumaStdDev, 0, 22) * 0.34 +
        normalize(metrics.gradientTileRatio, 0.16, 0.55) * 0.18 +
        normalize(metrics.softChangeRatio, 0.24, 0.5) * 0.1
    ),
    highContrastPhoto: clamp01(
      photoScore * 0.42 +
        normalize(metrics.lumaStdDev, 58, 92) * 0.3 +
        normalize(contrastEndpointRatio, 0.18, 0.42) * 0.18 +
        normalize(metrics.photoTileRatio, 0.18, 0.58) * 0.1
    ),
    flatIllustration: clamp01(
      (1 - photoScore) * 0.32 +
        normalize(metrics.flatRatio, 0.52, 0.9) * 0.2 +
        normalize(metrics.topColorCoverage, 0.38, 0.85) * 0.22 +
        normalize(metrics.flatTileRatio, 0.18, 0.72) * 0.18 +
        normalize(metrics.highSaturationRatio, 0.08, 0.38) * 0.08
    ),
    lineArt: clamp01(
      normalize(metrics.grayRatio, 0.48, 0.9) * 0.28 +
        normalize(metrics.edgeDensity, 0.05, 0.22) * 0.24 +
        normalize(metrics.flatRatio, 0.5, 0.86) * 0.18 +
        normalize(metrics.topColorCoverage, 0.45, 0.9) * 0.18 +
        normalize(0.16 - metrics.highSaturationRatio, 0, 0.16) * 0.12 -
        photoTileLineArtPenalty * 0.14
    ),
    textOrUi: clamp01(
      normalize(metrics.textTileRatio, 0.05, 0.35) * 0.32 +
        normalize(metrics.edgeDensity, 0.06, 0.24) * 0.22 +
        normalize(metrics.grayRatio, 0.42, 0.86) * 0.16 +
        normalize(metrics.topColorCoverage, 0.42, 0.86) * 0.16 +
        normalize(metrics.flatTileRatio, 0.12, 0.58) * 0.14
    ),
    pixelArt: clamp01(
      normalize(metrics.flatRatio, 0.62, 0.94) * 0.25 +
        normalize(metrics.topColorCoverage, 0.5, 0.92) * 0.24 +
        normalize(metrics.flatTileRatio, 0.25, 0.82) * 0.2 +
        normalize(metrics.highSaturationRatio, 0.08, 0.45) * 0.16 +
        normalize(0.22 - metrics.softChangeRatio, 0, 0.22) * 0.15
    ),
    unknown: 0,
  };
}

function getBestKind(scores: Record<ImageKind, number>): ImageKind {
  return Object.entries(scores).reduce(
    (best, current) => (current[1] > best[1] ? current : best),
    ["unknown", -Infinity]
  )[0] as ImageKind;
}

function getColorDifference(a: Sample, b: Sample): number {
  const red = a.red - b.red;
  const green = a.green - b.green;
  const blue = a.blue - b.blue;

  return Math.sqrt(red * red + green * green + blue * blue);
}

function getSaturation(red: number, green: number, blue: number): number {
  const normalizedRed = red / 255;
  const normalizedGreen = green / 255;
  const normalizedBlue = blue / 255;
  const max = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
  const min = Math.min(normalizedRed, normalizedGreen, normalizedBlue);

  if (max === 0) {
    return 0;
  }

  return (max - min) / max;
}

function getQuantizedColorKey(red: number, green: number, blue: number): number {
  return ((red >> 3) << 10) | ((green >> 3) << 5) | (blue >> 3);
}

function normalize(value: number, min: number, max: number): number {
  if (max <= min) {
    return value >= max ? 1 : 0;
  }

  return clamp01((value - min) / (max - min));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
