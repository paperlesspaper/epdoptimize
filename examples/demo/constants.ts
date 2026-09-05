import {
  acepPalette,
  aitjcizeSpectra6Palette,
  defaultPalette,
  gameboyPalette,
  genericFourGrayscalePalette,
  genericTwoColorEinkPalette,
  genericThreeColorRedPalette,
  genericThreeColorYellowPalette,
  genericFourColorEinkPalette,
  spectra6BoeberPalette,
  spectra6OriginalPalette,
  spectra6OriginalPreviewPalette,
  spectra6legacyPalette,
  spectra6Palette,
  trmnlSeeed16GrayscalePalette,
} from "../../src";
import type { ImageFitMode, ScreenOrientation } from "./types";

export const DEVICE_TEST_STORAGE_KEY = "epdoptimize:device-test";
export const AUTO_RATING_STORAGE_KEY = "epdoptimize:auto-ratings:v1";
export const CUSTOM_PALETTES_STORAGE_KEY = "epdoptimize:custom-palettes:v1";

export const SCREEN_RESOLUTIONS = {
  trmnl_x: {
    name: "trmnl_x", label: "10.3 Inch TRMNL X (16 grayscale)",
    width: 1872, height: 1404,
  },
  seeed_e1003: {
    name: "seeed_e1003", label: "10.3 Inch Seeed reTerminal E1003 (16 grayscale)",
    width: 1872, height: 1404,
  },
  spectra6_1_54: {
    name: "spectra6_1_54",
    label: "1.54 Inch Spectra 6",
    width: 240,
    height: 240,
  },
  spectra6_1_69: {
    name: "spectra6_1_69",
    label: "1.69 Inch Round Spectra 6",
    width: 400,
    height: 400,
  },
  spectra6_3_7: {
    name: "spectra6_3_7",
    label: "3.7 Inch Spectra 6",
    width: 720,
    height: 480,
  },
  spectra6_4: {
    name: "spectra6_4",
    label: "4 Inch Spectra 6",
    width: 600,
    height: 400,
  },
  spectra6_5_9: {
    name: "spectra6_5_9",
    label: "5.9 Inch Spectra 6",
    width: 960,
    height: 680,
  },
  spectra6_7_09: {
    name: "spectra6_7_09",
    label: "7.09 Inch Spectra 6",
    width: 1600,
    height: 1200,
  },
  openpaper7: {
    name: "openpaper7",
    label: "7.3 Inch Spectra 6 / OpenPaper 7",
    width: 800,
    height: 480,
  },
  spectra6_8_14: {
    name: "spectra6_8_14",
    label: "8.14 Inch Spectra 6",
    width: 1024,
    height: 576,
  },
  spectra6_10: {
    name: "spectra6_10",
    label: "10 Inch Spectra 6",
    width: 1600,
    height: 1200,
  },
  openpaperL: {
    name: "openpaperL",
    label: "13.3 Inch Spectra 6 / OpenPaper L",
    width: 1600,
    height: 1200,
  },
  spectra6_25_3: {
    name: "spectra6_25_3",
    label: "25.3 Inch Spectra 6",
    width: 3200,
    height: 1800,
  },
  spectra6_28_5: {
    name: "spectra6_28_5",
    label: "28.5 Inch Spectra 6",
    width: 3060,
    height: 2160,
  },
  spectra6_31_5: {
    name: "spectra6_31_5",
    label: "31.5 Inch Spectra 6",
    width: 2560,
    height: 1440,
  },
};

export const DEFAULT_DEVICE_TEST_CONFIG = {
  screenResolution: "openpaper7",
  orientation: "landscape" as ScreenOrientation,
  imageFit: "cover" as ImageFitMode,
  paperId: "69d59c1a23c3a25ca940ac72",
  apiKey: "",
};

export const DEFAULT_DITHER_OPTIONS = {
  ditheringType: "errorDiffusion",
  errorDiffusionMatrix: "floydSteinberg",
  serpentine: false,
  orderedDitheringMatrix: [4, 4],
  randomDitheringType: "blackAndWhite",
  colorMatching: "rgb",
  processingEngine: "auto",
  edgePreservation: {
    enabled: false,
    strength: 0.65,
  },
  edgeAntialiasing: {
    enabled: false,
    strength: 0.75,
  },
};

export const PALETTE_OPTIONS = {
  default: {
    label: "Default",
    exportName: "defaultPalette",
    palette: defaultPalette,
  },
  "generic-2-color-eink": {
    label: "2 Color eInk (generic)",
    exportName: "genericTwoColorEinkPalette",
    palette: genericTwoColorEinkPalette,
  },
  "generic-3-color-red": { label: "3 Color eInk (black / white / red)", exportName: "genericThreeColorRedPalette", palette: genericThreeColorRedPalette },
  "generic-3-color-yellow": { label: "3 Color eInk (black / white / yellow)", exportName: "genericThreeColorYellowPalette", palette: genericThreeColorYellowPalette },
  "generic-4-color-eink": { label: "4 Color eInk (black / white / red / yellow)", exportName: "genericFourColorEinkPalette", palette: genericFourColorEinkPalette },
  "generic-4-grayscale": {
    label: "4 Grayscale (generic)",
    exportName: "genericFourGrayscalePalette",
    palette: genericFourGrayscalePalette,
  },
  "trmnl-seeed-16-grayscale": {
    label: "16 Grayscale (generic; TRMNL / Seeed)",
    exportName: "trmnlSeeed16GrayscalePalette",
    palette: trmnlSeeed16GrayscalePalette,
  },
  "aitjcize-spectra6": {
    label: "aitjcize Spectra 6",
    exportName: "aitjcizeSpectra6Palette",
    palette: aitjcizeSpectra6Palette,
  },
  spectra6: {
    label: "Spectra 6 (legacy)",
    exportName: "spectra6Palette",
    palette: spectra6Palette,
  },
  "spectra6-boeber": {
    label: "Spectra 6 Böber",
    exportName: "spectra6BoeberPalette",
    palette: spectra6BoeberPalette,
  },
  "spectra6-original": {
    label: "Spectra 6 Original (no replace)",
    exportName: "spectra6OriginalPalette",
    palette: spectra6OriginalPalette,
  },
  "spectra6-original-preview": {
    label: "Spectra 6 Original + preview",
    exportName: "spectra6OriginalPreviewPalette",
    palette: spectra6OriginalPreviewPalette,
  },
  spectra6legacy: {
    label: "Spectra 6 Legacy",
    exportName: "spectra6legacyPalette",
    palette: spectra6legacyPalette,
  },
  acep: {
    label: "Gallery",
    exportName: "acepPalette",
    palette: acepPalette,
  },
  gameboy: {
    label: "Game Boy",
    exportName: "gameboyPalette",
    palette: gameboyPalette,
  },
};
