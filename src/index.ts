import palettes from "./dither/data/default-palettes.json";
import {
  getNamedEntries,
  getNamedColors,
  getNamedDeviceColors,
  type PaletteColorEntry,
  type PaletteRegistry,
} from "./dither/functions/palette-order";

const paletteRegistry = palettes as PaletteRegistry;

/**
 * Retrieve a named default palette as combined color entries.
 *
 * `color` is the calibrated/display color used for dithering.
 * `deviceColor` is the native device color that should replace it before export.
 */
function getDefaultPalette(
  name: string,
  deviceColorsName = name
): PaletteColorEntry[] {
  const entries = getNamedEntries(paletteRegistry, name);
  if (deviceColorsName === name) {
    return entries.map((entry) => ({ ...entry }));
  }

  const deviceEntries = getNamedEntries(paletteRegistry, deviceColorsName);
  const deviceColorByRole = new Map(
    deviceEntries.map((entry) => [entry.name, entry.deviceColor])
  );

  return entries.map((entry) => ({
    ...entry,
    deviceColor: deviceColorByRole.get(entry.name) ?? entry.deviceColor,
  }));
}

/**
 * Retrieve a named default palette (hex codes).
 * This is used for dithering images to fit the eInk display and uses the real colors of the display.
 */
export function getDefaultPalettes(name: string): string[] {
  return getNamedColors(paletteRegistry, name);
}
/**
 * Retrieve a named default device color set that is used for displaying the colors on the eInk display.
 */
export function getDeviceColors(name: string): string[] {
  return getNamedDeviceColors(paletteRegistry, name);
}

/**
 * Retrieve device colors sorted to match the role order of a selected palette.
 */
export function getDeviceColorsForPalette(
  paletteName: string,
  deviceColorsName: string
): string[] {
  return getDefaultPalette(paletteName, deviceColorsName).map(
    (entry) => entry.deviceColor
  );
}

export const defaultPalette = getDefaultPalette("default");
export const gameboyPalette = getDefaultPalette("gameboy");
export const spectra6legacyPalette = getDefaultPalette("spectra6legacy");
export const spectra6Palette = getDefaultPalette("spectra6");
export const aitjcizeSpectra6Palette = getDefaultPalette("aitjcize-spectra6");
export const acepPalette = getDefaultPalette("acep");

export { replaceColors } from "./replaceColors/replaceColors";
export type {
  ReplaceColorsOptions,
  ReplaceColorsPalette,
} from "./replaceColors/replaceColors";

export { ditherImage } from "./dither/dither";
export {
  getProcessingPreset,
  getProcessingPresetNames,
  getProcessingPresetOptions,
  PROCESSING_PRESETS,
} from "./dither/processing";
export {
  classifyCanvasImageStyle,
  classifyImageStyle,
  isIllustrationImage,
  isPhotoImage,
} from "./image-style";
export {
  suggestCanvasProcessingOptions,
  suggestProcessingOptions,
} from "./auto-processing";

export type {
  ColorMatchingMode,
  CanvasLike,
  DitherImageOptions,
  DynamicRangeCompressionOptions,
  ImageDataLike,
  ImageProcessingOptions,
  LevelCompressionOptions,
  LevelCompressionMode,
  ProcessingPreset,
  ProcessingPresetName,
  ToneMappingMode,
  ToneMappingOptions,
} from "./dither/dither";
export type {
  ClassifyImageStyleOptions,
  ImageKind,
  ImageStyle,
  ImageStyleClassification,
  ImageStyleMetrics,
} from "./image-style";
export type {
  AutoProcessingIntent,
  ProcessingSuggestion,
  SuggestProcessingOptionsInput,
} from "./auto-processing";
export type { PaletteColorEntry } from "./dither/functions/palette-order";
