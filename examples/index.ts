import {
  acepPalette,
  aitjcizeSpectra6Palette,
  defaultPalette,
  ditherImage,
  gameboyPalette,
  getProcessingPreset,
  getProcessingPresetOptions,
  replaceColors,
  spectra6legacyPalette,
  spectra6Palette,
  suggestCanvasProcessingOptions,
} from "../src";
import type {
  DitherImageOptions,
  ImageStyleClassification,
  PaletteColorEntry,
  ProcessingSuggestion,
} from "../src";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const fileInput = $("fileInput") as HTMLInputElement;
const sampleImageGrid = $("sampleImageGrid") as HTMLDivElement;
const imageStyleValue = $("imageStyleValue") as HTMLElement;
const imageStyleConfidence = $("imageStyleConfidence") as HTMLSpanElement;
const imageStyleMeter = $("imageStyleMeter") as HTMLSpanElement;
const imageStyleMetrics = $("imageStyleMetrics") as HTMLDListElement;
const canvasGrid = $("canvasGrid") as HTMLDivElement;
const inputCanvas = $("inputCanvas") as HTMLCanvasElement;
const outputCanvas = $("outputCanvas") as HTMLCanvasElement;
const deviceColorsCanvas = $("deviceColorsCanvas") as HTMLCanvasElement;
const toggleOriginalSizeButton = $(
  "toggleOriginalSizeButton",
) as HTMLButtonElement;
const downloadLink = $("downloadLink") as HTMLAnchorElement;
const downloadDeviceColorsLink = $(
  "downloadDeviceColorsLink",
) as HTMLAnchorElement;
const configOutput = $("configOutput") as HTMLPreElement;
const copyConfigButton = $("copyConfigButton") as HTMLButtonElement;
const jsExampleOutput = $("jsExampleOutput") as HTMLPreElement;
const copyJsExampleButton = $("copyJsExampleButton") as HTMLButtonElement;
const screenResolutionSelect = $("screenResolutionSelect") as HTMLSelectElement;
const orientationSelect = $("orientationSelect") as HTMLSelectElement;
const imageFitSelect = $("imageFitSelect") as HTMLSelectElement;
const paperIdInput = $("paperIdInput") as HTMLInputElement;
const apiKeyInput = $("apiKeyInput") as HTMLInputElement;
const testOnDeviceButton = $("testOnDeviceButton") as HTMLButtonElement;
const deviceTestStatus = $("deviceTestStatus") as HTMLParagraphElement;

const paletteSelect = $("paletteSelect") as HTMLSelectElement;
const palettePreview = $("palettePreview") as HTMLDivElement;
const deviceColorsPreview = $("deviceColorsPreview") as HTMLDivElement;
const processingPresetSelect = $("processingPreset") as HTMLSelectElement;
const ditheringTypeSelect = $("ditheringType") as HTMLSelectElement;
const errorDiffusionMatrixSelect = $(
  "errorDiffusionMatrix",
) as HTMLSelectElement;
const orderedDitheringMatrixW = $(
  "orderedDitheringMatrixW",
) as HTMLInputElement;
const orderedDitheringMatrixH = $(
  "orderedDitheringMatrixH",
) as HTMLInputElement;
const randomDitheringTypeSelect = $("randomDitheringType") as HTMLSelectElement;
const serpentineCheckbox = $("serpentine") as HTMLInputElement;
const colorMatchingSelect = $("colorMatching") as HTMLSelectElement;
const autoRecommendationTitle = $("autoRecommendationTitle") as HTMLElement;
const autoRecommendationSummary = $("autoRecommendationSummary") as HTMLElement;
const autoRecommendationReasons = $(
  "autoRecommendationReasons",
) as HTMLUListElement;

const toneModeSelect = $("toneMode") as HTMLSelectElement;
const exposureInput = $("exposure") as HTMLInputElement;
const saturationInput = $("saturation") as HTMLInputElement;
const contrastInput = $("contrast") as HTMLInputElement;
const scurveStrengthInput = $("scurveStrength") as HTMLInputElement;
const shadowBoostInput = $("shadowBoost") as HTMLInputElement;
const highlightCompressInput = $("highlightCompress") as HTMLInputElement;
const midpointInput = $("midpoint") as HTMLInputElement;

const dynamicRangeModeSelect = $("dynamicRangeMode") as HTMLSelectElement;
const dynamicRangeStrengthInput = $("dynamicRangeStrength") as HTMLInputElement;
const lowPercentileInput = $("lowPercentile") as HTMLInputElement;
const highPercentileInput = $("highPercentile") as HTMLInputElement;

type ScreenOrientation = "landscape" | "portrait";
type ImageFitMode = "contain" | "cover";
type DynamicRangeMode = "off" | "display" | "auto";
type ToneMappingMode = "off" | "contrast" | "scurve";

const DEVICE_TEST_STORAGE_KEY = "epdoptimize:device-test";
const SCREEN_RESOLUTIONS = {
  openpaper7: {
    name: "openpaper7",
    label: "7.3 Inch OpenPaper 7",
    width: 800,
    height: 480,
  },
  openpaperL: {
    name: "openpaperL",
    label: "13.3 Inch OpenPaper L",
    width: 1600,
    height: 1200,
  },
};
const DEFAULT_DEVICE_TEST_CONFIG = {
  screenResolution: "openpaper7",
  orientation: "landscape" as ScreenOrientation,
  imageFit: "contain" as ImageFitMode,
  paperId: "69d59c1a23c3a25ca940ac72",
  apiKey: "",
};
const DEFAULT_DITHER_OPTIONS = {
  ditheringType: "errorDiffusion",
  errorDiffusionMatrix: "floydSteinberg",
  serpentine: false,
  orderedDitheringMatrix: [4, 4],
  randomDitheringType: "blackAndWhite",
  colorMatching: "rgb",
};
const PALETTE_OPTIONS = {
  default: {
    label: "Default",
    exportName: "defaultPalette",
    palette: defaultPalette,
  },
  spectra6: {
    label: "Spectra 6",
    exportName: "spectra6Palette",
    palette: spectra6Palette,
  },
  spectra6legacy: {
    label: "Spectra 6 Legacy",
    exportName: "spectra6legacyPalette",
    palette: spectra6legacyPalette,
  },
  "aitjcize-spectra6": {
    label: "aitjcize Spectra 6",
    exportName: "aitjcizeSpectra6Palette",
    palette: aitjcizeSpectra6Palette,
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

const sampleImages = import.meta.glob("./sampleImages/*.{jpg,jpeg,png,webp}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
const sampleImagePreviews = import.meta.glob(
  "./sampleImages/previews/*.{jpg,jpeg,png,webp}",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
) as Record<string, string>;

let lastImage: HTMLImageElement | null = null;
let selectedSampleUrl = "";
let scheduledProcess = 0;
let processToken = 0;
let showOriginalSize = false;
let currentProcessingSuggestion: ProcessingSuggestion | null = null;

window.addEventListener("DOMContentLoaded", async () => {
  populateSampleImageOptions();
  populateProcessingPresetOptions();
  loadDeviceTestConfig();
  applyPresetToUI(processingPresetSelect.value);
  updateCanvasSizeMode();
  refreshControlState();

  await loadSelectedSampleImage();
});

function updateCanvasSizeMode() {
  canvasGrid.classList.toggle("original-size", showOriginalSize);
  toggleOriginalSizeButton.textContent = showOriginalSize
    ? "Fit to panel"
    : "Show original size";
  toggleOriginalSizeButton.setAttribute(
    "aria-pressed",
    String(showOriginalSize),
  );
}

function formatSampleName(path: string) {
  return path
    .split("/")
    .pop()!
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+[a-f0-9]{8,}.*$/i, "")
    .trim();
}

function sampleKey(path: string) {
  return path.split("/").pop() ?? path;
}

function populateSampleImageOptions() {
  sampleImageGrid.innerHTML = "";
  const entries = Object.entries(sampleImages).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const previewByName = new Map(
    Object.entries(sampleImagePreviews).map(([path, url]) => [
      sampleKey(path),
      url,
    ]),
  );

  for (const [path, url] of entries) {
    const name = formatSampleName(path);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sample-thumb";
    button.dataset.sampleUrl = url;
    button.setAttribute("aria-label", name);
    button.title = name;

    const img = document.createElement("img");
    img.src = previewByName.get(sampleKey(path)) ?? url;
    img.alt = "";
    img.loading = "lazy";
    button.append(img);

    button.addEventListener("click", async () => {
      selectedSampleUrl = url;
      updateSelectedSampleButton();
      await loadSelectedSampleImage();
    });

    sampleImageGrid.append(button);
  }

  selectedSampleUrl = entries[0]?.[1] ?? "";
  updateSelectedSampleButton();
}

function updateSelectedSampleButton() {
  sampleImageGrid
    .querySelectorAll<HTMLButtonElement>(".sample-thumb")
    .forEach((button) => {
      const selected = button.dataset.sampleUrl === selectedSampleUrl;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
}

function populateProcessingPresetOptions() {
  processingPresetSelect.innerHTML = "";
  const autoOption = document.createElement("option");
  autoOption.value = "auto";
  autoOption.textContent = "Auto";
  processingPresetSelect.append(autoOption);

  for (const preset of getProcessingPresetOptions()) {
    const option = document.createElement("option");
    option.value = preset.value;
    option.textContent = preset.title;
    processingPresetSelect.append(option);
  }
  processingPresetSelect.value = "auto";
}

async function loadImage(src: string) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

async function loadSelectedSampleImage() {
  const src =
    selectedSampleUrl || import.meta.env.BASE_URL + "example-dither.jpg";
  lastImage = await loadImage(src);
  await processImage();
}

function getDeviceTestConfig() {
  return {
    screenResolution: screenResolutionSelect.value,
    orientation: getSelectedOrientation(),
    imageFit: getSelectedImageFit(),
    paperId: paperIdInput.value.trim(),
    apiKey: apiKeyInput.value.trim(),
  };
}

function getSelectedScreenResolution() {
  return (
    SCREEN_RESOLUTIONS[
      screenResolutionSelect.value as keyof typeof SCREEN_RESOLUTIONS
    ] ?? SCREEN_RESOLUTIONS.openpaper7
  );
}

function getSelectedOrientation(): ScreenOrientation {
  return orientationSelect.value === "portrait" ? "portrait" : "landscape";
}

function getSelectedImageFit(): ImageFitMode {
  return imageFitSelect.value === "cover" ? "cover" : "contain";
}

function loadDeviceTestConfig() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(DEVICE_TEST_STORAGE_KEY) || "{}",
    );
    screenResolutionSelect.value =
      typeof saved.screenResolution === "string" &&
      saved.screenResolution in SCREEN_RESOLUTIONS
        ? saved.screenResolution
        : DEFAULT_DEVICE_TEST_CONFIG.screenResolution;
    orientationSelect.value =
      saved.orientation === "portrait"
        ? "portrait"
        : DEFAULT_DEVICE_TEST_CONFIG.orientation;
    imageFitSelect.value =
      saved.imageFit === "cover" ? "cover" : DEFAULT_DEVICE_TEST_CONFIG.imageFit;
    paperIdInput.value =
      typeof saved.paperId === "string"
        ? saved.paperId
        : DEFAULT_DEVICE_TEST_CONFIG.paperId;
    apiKeyInput.value =
      typeof saved.apiKey === "string"
        ? saved.apiKey
        : DEFAULT_DEVICE_TEST_CONFIG.apiKey;
  } catch {
    screenResolutionSelect.value = DEFAULT_DEVICE_TEST_CONFIG.screenResolution;
    orientationSelect.value = DEFAULT_DEVICE_TEST_CONFIG.orientation;
    imageFitSelect.value = DEFAULT_DEVICE_TEST_CONFIG.imageFit;
    paperIdInput.value = DEFAULT_DEVICE_TEST_CONFIG.paperId;
    apiKeyInput.value = DEFAULT_DEVICE_TEST_CONFIG.apiKey;
  }
}

function saveDeviceTestConfig() {
  localStorage.setItem(
    DEVICE_TEST_STORAGE_KEY,
    JSON.stringify(getDeviceTestConfig()),
  );
}

function setDeviceTestStatus(
  message: string,
  state: "idle" | "success" | "error" = "idle",
) {
  deviceTestStatus.textContent = message;
  deviceTestStatus.dataset.state = state;
}

function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Could not create PNG from canvas."));
    }, "image/png");
  });
}

function drawImageToScreenCanvas(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
) {
  const { width, height } = getSelectedScreenResolution();
  const ctx = canvas.getContext("2d")!;
  const orientation = getSelectedOrientation();
  const imageFit = getSelectedImageFit();

  canvas.width = width;
  canvas.height = height;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  if (orientation === "landscape") {
    drawImageWithFit(img, ctx, width, height, imageFit);
    return;
  }

  const portraitCanvas = document.createElement("canvas");
  portraitCanvas.width = height;
  portraitCanvas.height = width;

  const portraitCtx = portraitCanvas.getContext("2d")!;
  portraitCtx.fillStyle = "#ffffff";
  portraitCtx.fillRect(0, 0, portraitCanvas.width, portraitCanvas.height);
  drawImageWithFit(
    img,
    portraitCtx,
    portraitCanvas.width,
    portraitCanvas.height,
    imageFit,
  );

  ctx.save();
  ctx.setTransform(0, 1, -1, 0, width, 0);
  ctx.drawImage(portraitCanvas, 0, 0);
  ctx.restore();
}

function drawImageWithFit(
  img: HTMLImageElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  imageFit: ImageFitMode,
) {
  const scale =
    imageFit === "cover"
      ? Math.max(width / img.width, height / img.height)
      : Math.min(width / img.width, height / img.height);
  const drawWidth = Math.round(img.width * scale);
  const drawHeight = Math.round(img.height * scale);
  const offsetX = Math.round((width - drawWidth) / 2);
  const offsetY = Math.round((height - drawHeight) / 2);

  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

async function testOnDevice() {
  const { paperId, apiKey } = getDeviceTestConfig();

  if (!paperId) {
    setDeviceTestStatus("Missing paper ID.", "error");
    return;
  }

  if (!apiKey) {
    setDeviceTestStatus("Missing x-api-key.", "error");
    return;
  }

  if (deviceColorsCanvas.width === 0 || deviceColorsCanvas.height === 0) {
    setDeviceTestStatus("No device image to upload.", "error");
    return;
  }

  testOnDeviceButton.disabled = true;
  setDeviceTestStatus("Uploading...");

  try {
    const pictureBlob = await canvasToPngBlob(outputCanvas);
    const pictureDeviceBlob = await canvasToPngBlob(deviceColorsCanvas);
    const formData = new FormData();
    formData.append("picture", pictureBlob, "epdoptimize-dithered.png");
    formData.append(
      "pictureDevice",
      pictureDeviceBlob,
      "epdoptimize-device.png",
    );
    formData.append(
      "settings",
      JSON.stringify({
        meta: {
          orientation: getSelectedOrientation(),
        },
      }),
    );

    const response = await fetch(
      `http://localhost:5002/v1/papers/uploadSingleImage/${encodeURIComponent(
        paperId,
      )}`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "x-api-key": apiKey,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        errorText || `Upload failed with status ${response.status}.`,
      );
    }

    setDeviceTestStatus("Sent to device.", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    setDeviceTestStatus(message, "error");
  } finally {
    testOnDeviceButton.disabled = false;
  }
}

function setInputValue(input: HTMLInputElement, value: number | undefined) {
  if (typeof value === "number") input.value = String(value);
}

function applyPresetToUI(name: string) {
  if (name === "auto") return;

  const preset = getProcessingPreset(name);
  if (!preset) return;

  toneModeSelect.value = preset.toneMapping.mode ?? "contrast";
  setInputValue(exposureInput, preset.toneMapping.exposure);
  setInputValue(saturationInput, preset.toneMapping.saturation);
  setInputValue(contrastInput, preset.toneMapping.contrast);
  setInputValue(scurveStrengthInput, preset.toneMapping.strength);
  setInputValue(shadowBoostInput, preset.toneMapping.shadowBoost);
  setInputValue(highlightCompressInput, preset.toneMapping.highlightCompress);
  setInputValue(midpointInput, preset.toneMapping.midpoint);

  dynamicRangeModeSelect.value = preset.dynamicRangeCompression?.mode ?? "off";
  setInputValue(
    dynamicRangeStrengthInput,
    preset.dynamicRangeCompression?.strength,
  );

  colorMatchingSelect.value = preset.colorMatching ?? "rgb";
  if (preset.errorDiffusionMatrix) {
    errorDiffusionMatrixSelect.value = preset.errorDiffusionMatrix;
  }
}

function readNumber(input: HTMLInputElement, fallback: number) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function numbersEqual(a: number | undefined, b: number | undefined) {
  return a === b || Math.abs((a ?? 0) - (b ?? 0)) < 0.000001;
}

function numberArraysEqual(a: number[], b: number[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function renderColorPalette(target: HTMLElement, colors: string[]) {
  target.innerHTML = "";
  for (const color of colors) {
    const swatch = document.createElement("span");
    swatch.className = "color-swatch";
    swatch.style.backgroundColor = color;
    swatch.title = color;
    swatch.setAttribute("aria-label", color);
    target.append(swatch);
  }
}

function getSelectedPaletteOption() {
  return (
    PALETTE_OPTIONS[paletteSelect.value as keyof typeof PALETTE_OPTIONS] ??
    PALETTE_OPTIONS.spectra6
  );
}

function updatePalettePreviews() {
  const { palette } = getSelectedPaletteOption();

  renderColorPalette(
    palettePreview,
    palette.map((entry) => entry.color),
  );
  renderColorPalette(
    deviceColorsPreview,
    palette.map((entry) => entry.deviceColor),
  );
}

function getToneMappingFromUI() {
  return {
    mode: toneModeSelect.value as ToneMappingMode,
    exposure: readNumber(exposureInput, 1),
    saturation: readNumber(saturationInput, 1),
    contrast: readNumber(contrastInput, 1),
    strength: readNumber(scurveStrengthInput, 0.9),
    shadowBoost: readNumber(shadowBoostInput, 0),
    highlightCompress: readNumber(highlightCompressInput, 1.5),
    midpoint: readNumber(midpointInput, 0.5),
  };
}

function getDynamicRangeCompressionFromUI() {
  const dynamicRangeMode = dynamicRangeModeSelect.value as DynamicRangeMode;

  if (dynamicRangeMode === "off") {
    return { mode: "off" as const };
  }

  return {
    mode: dynamicRangeMode,
    strength: readNumber(dynamicRangeStrengthInput, 1),
    lowPercentile: readNumber(lowPercentileInput, 0.01),
    highPercentile: readNumber(highPercentileInput, 0.99),
  };
}

function getDitherOptionsFromUI(palette: PaletteColorEntry[]) {
  return {
    processingPreset: processingPresetSelect.value,
    ditheringType: ditheringTypeSelect.value,
    errorDiffusionMatrix: errorDiffusionMatrixSelect.value,
    serpentine: serpentineCheckbox.checked,
    orderedDitheringMatrix: [
      parseInt(orderedDitheringMatrixW.value, 10),
      parseInt(orderedDitheringMatrixH.value, 10),
    ],
    randomDitheringType: randomDitheringTypeSelect.value,
    palette,
    colorMatching: colorMatchingSelect.value as "rgb" | "lab",
    calibrate: true,
    toneMapping: getToneMappingFromUI(),
    dynamicRangeCompression: getDynamicRangeCompressionFromUI(),
  };
}

function isToneMappingPresetValue() {
  const preset = getProcessingPreset(processingPresetSelect.value);
  if (!preset) return false;

  const current = getToneMappingFromUI();
  const presetToneMapping = preset.toneMapping;
  const presetMode = presetToneMapping.mode ?? "contrast";

  if (
    current.mode !== presetMode ||
    !numbersEqual(current.exposure, presetToneMapping.exposure ?? 1) ||
    !numbersEqual(current.saturation, presetToneMapping.saturation ?? 1)
  ) {
    return false;
  }

  if (presetMode === "contrast") {
    return numbersEqual(current.contrast, presetToneMapping.contrast ?? 1);
  }

  if (presetMode === "scurve") {
    return (
      numbersEqual(current.strength, presetToneMapping.strength ?? 0.9) &&
      numbersEqual(current.shadowBoost, presetToneMapping.shadowBoost ?? 0) &&
      numbersEqual(
        current.highlightCompress,
        presetToneMapping.highlightCompress ?? 1.5,
      ) &&
      numbersEqual(current.midpoint, presetToneMapping.midpoint ?? 0.5)
    );
  }

  return true;
}

function isDynamicRangePresetValue() {
  const preset = getProcessingPreset(processingPresetSelect.value);
  if (!preset) return false;

  const current = getDynamicRangeCompressionFromUI();
  const presetRange = preset.dynamicRangeCompression ?? {
    mode: "off" as const,
  };
  const presetMode = presetRange.mode ?? "off";

  if (current.mode !== presetMode) return false;
  if (presetMode === "off") return true;

  if (!numbersEqual(current.strength, presetRange.strength ?? 1)) {
    return false;
  }

  if (presetMode === "auto") {
    return (
      numbersEqual(
        current.lowPercentile,
        presetRange.lowPercentile ?? 0.01,
      ) &&
      numbersEqual(current.highPercentile, presetRange.highPercentile ?? 0.99)
    );
  }

  return true;
}

function getConfigDitherOptionsFromUI() {
  if (processingPresetSelect.value === "auto") {
    return currentProcessingSuggestion
      ? getCompactDitherOptions(currentProcessingSuggestion.ditherOptions)
      : { processingPreset: "balanced" };
  }

  const preset = getProcessingPreset(processingPresetSelect.value);
  const orderedDitheringMatrix = [
    parseInt(orderedDitheringMatrixW.value, 10),
    parseInt(orderedDitheringMatrixH.value, 10),
  ];
  const configOptions: Record<string, unknown> = {
    processingPreset: processingPresetSelect.value,
  };

  if (ditheringTypeSelect.value !== DEFAULT_DITHER_OPTIONS.ditheringType) {
    configOptions.ditheringType = ditheringTypeSelect.value;
  }

  if (serpentineCheckbox.checked !== DEFAULT_DITHER_OPTIONS.serpentine) {
    configOptions.serpentine = serpentineCheckbox.checked;
  }

  if (
    !numberArraysEqual(
      orderedDitheringMatrix,
      DEFAULT_DITHER_OPTIONS.orderedDitheringMatrix,
    )
  ) {
    configOptions.orderedDitheringMatrix = orderedDitheringMatrix;
  }

  if (
    randomDitheringTypeSelect.value !==
    DEFAULT_DITHER_OPTIONS.randomDitheringType
  ) {
    configOptions.randomDitheringType = randomDitheringTypeSelect.value;
  }

  if (
    colorMatchingSelect.value !==
    (preset?.colorMatching ?? DEFAULT_DITHER_OPTIONS.colorMatching)
  ) {
    configOptions.colorMatching = colorMatchingSelect.value;
  }

  if (
    errorDiffusionMatrixSelect.value !==
    (preset?.errorDiffusionMatrix ?? DEFAULT_DITHER_OPTIONS.errorDiffusionMatrix)
  ) {
    configOptions.errorDiffusionMatrix = errorDiffusionMatrixSelect.value;
  }

  if (!isToneMappingPresetValue()) {
    configOptions.toneMapping = getToneMappingFromUI();
  }

  if (!isDynamicRangePresetValue()) {
    configOptions.dynamicRangeCompression =
      getDynamicRangeCompressionFromUI();
  }

  return configOptions;
}

function getCompactDitherOptions(options: Partial<DitherImageOptions>) {
  const presetName =
    typeof options.processingPreset === "string"
      ? options.processingPreset
      : undefined;
  const preset = presetName ? getProcessingPreset(presetName) : null;
  const configOptions: Record<string, unknown> = {};

  if (presetName) {
    configOptions.processingPreset = presetName;
  }

  if (
    options.ditheringType &&
    options.ditheringType !== DEFAULT_DITHER_OPTIONS.ditheringType
  ) {
    configOptions.ditheringType = options.ditheringType;
  }

  if (
    typeof options.serpentine === "boolean" &&
    options.serpentine !== DEFAULT_DITHER_OPTIONS.serpentine
  ) {
    configOptions.serpentine = options.serpentine;
  }

  if (
    Array.isArray(options.orderedDitheringMatrix) &&
    !numberArraysEqual(
      [...options.orderedDitheringMatrix],
      DEFAULT_DITHER_OPTIONS.orderedDitheringMatrix,
    )
  ) {
    configOptions.orderedDitheringMatrix = options.orderedDitheringMatrix;
  }

  if (
    options.randomDitheringType &&
    options.randomDitheringType !== DEFAULT_DITHER_OPTIONS.randomDitheringType
  ) {
    configOptions.randomDitheringType = options.randomDitheringType;
  }

  if (
    options.colorMatching &&
    options.colorMatching !==
      (preset?.colorMatching ?? DEFAULT_DITHER_OPTIONS.colorMatching)
  ) {
    configOptions.colorMatching = options.colorMatching;
  }

  if (
    options.errorDiffusionMatrix &&
    options.errorDiffusionMatrix !==
      (preset?.errorDiffusionMatrix ?? DEFAULT_DITHER_OPTIONS.errorDiffusionMatrix)
  ) {
    configOptions.errorDiffusionMatrix = options.errorDiffusionMatrix;
  }

  if (options.toneMapping) {
    configOptions.toneMapping = options.toneMapping;
  }

  if (options.dynamicRangeCompression) {
    configOptions.dynamicRangeCompression = options.dynamicRangeCompression;
  }

  return configOptions;
}

function getDemoConfig() {
  const selectedPalette = getSelectedPaletteOption();

  return {
    palette: selectedPalette.exportName,
    ditherOptions: getConfigDitherOptionsFromUI(),
  };
}

function updateConfigOutput() {
  const config = getDemoConfig();
  const configJson = JSON.stringify(config, null, 2);
  const paletteExportName = getSelectedPaletteOption().exportName;

  configOutput.textContent = configJson;
  jsExampleOutput.textContent = `import {
  ditherImage,
  replaceColors,
  ${paletteExportName},
} from "epdoptimize";

const config = ${configJson};
const palette = ${paletteExportName};

const inputCanvas = document.querySelector("#inputCanvas");
const ditheredCanvas = document.querySelector("#ditheredCanvas");
const deviceCanvas = document.querySelector("#deviceCanvas");

await ditherImage(inputCanvas, ditheredCanvas, {
  ...config.ditherOptions,
  palette,
});
replaceColors(ditheredCanvas, deviceCanvas, palette);`;
}

function formatImageStyle(style: ImageStyleClassification["style"]) {
  if (style === "photo") return "Photo";
  if (style === "illustration") return "Illustration";
  return "Unknown";
}

function formatImageKind(kind: ImageStyleClassification["kind"]) {
  return kind
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}

function formatPresetName(name: unknown) {
  return String(name)
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}

function formatTopScores(scores: Record<string, number>, count = 3) {
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([name, score]) => `${formatPresetName(name)} ${formatRatio(score)}`)
    .join(", ");
}

function formatRatio(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDecimal(value: number) {
  return value.toFixed(2);
}

function updateImageStyleResult(result: ImageStyleClassification) {
  imageStyleValue.textContent = formatImageKind(result.kind);
  imageStyleConfidence.textContent =
    result.style === "unknown"
      ? "-"
      : `${Math.round(result.confidence * 100)}% confidence`;
  imageStyleMeter.style.width =
    result.style === "unknown"
      ? "0%"
      : `${Math.round(result.confidence * 100)}%`;

  const { metrics } = result;
  const metricRows = [
    ["Style", formatImageStyle(result.style)],
    ["Photo score", formatRatio(result.photoScore)],
    ["Samples", String(metrics.sampleCount)],
    ["Unique colors", formatRatio(metrics.uniqueColorRatio)],
    ["Top colors", formatRatio(metrics.topColorCoverage)],
    ["Palette entropy", formatRatio(metrics.paletteEntropy)],
    ["Flat regions", formatRatio(metrics.flatRatio)],
    ["Soft changes", formatRatio(metrics.softChangeRatio)],
    ["Strong edges", formatRatio(metrics.strongEdgeRatio)],
    ["Edge density", formatRatio(metrics.edgeDensity)],
    ["Horizontal edges", formatRatio(metrics.horizontalEdgeRatio)],
    ["Vertical edges", formatRatio(metrics.verticalEdgeRatio)],
    ["Luma spread", formatDecimal(metrics.lumaStdDev)],
    ["Saturation avg", formatRatio(metrics.saturationMean)],
    ["Saturation spread", formatRatio(metrics.saturationStdDev)],
    ["Dark pixels", formatRatio(metrics.darkRatio)],
    ["Light pixels", formatRatio(metrics.lightRatio)],
    ["Gray pixels", formatRatio(metrics.grayRatio)],
    ["High saturation", formatRatio(metrics.highSaturationRatio)],
    ["Photo tiles", formatRatio(metrics.photoTileRatio)],
    ["Flat tiles", formatRatio(metrics.flatTileRatio)],
    ["Text tiles", formatRatio(metrics.textTileRatio)],
    ["Gradient tiles", formatRatio(metrics.gradientTileRatio)],
    ["Transparent", formatRatio(metrics.transparentRatio)],
  ];

  imageStyleMetrics.replaceChildren(
    ...metricRows.map(([label, value]) => {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");

      term.textContent = label;
      description.textContent = value;
      row.append(term, description);

      return row;
    }),
  );
}

function updateAutoRecommendation(suggestion: ProcessingSuggestion | null) {
  autoRecommendationReasons.replaceChildren();

  if (!suggestion) {
    autoRecommendationTitle.textContent = "Auto recommendation";
    autoRecommendationSummary.textContent = "Analyzing image...";
    return;
  }

  const { ditherOptions } = suggestion;
  autoRecommendationTitle.textContent = `Auto: ${formatPresetName(
    ditherOptions.processingPreset,
  )}`;
  autoRecommendationSummary.textContent = [
    formatImageKind(suggestion.imageKind),
    ditherOptions.colorMatching
      ? `${String(ditherOptions.colorMatching).toUpperCase()} matching`
      : "",
    ditherOptions.errorDiffusionMatrix
      ? `${formatPresetName(ditherOptions.errorDiffusionMatrix)} diffusion`
      : "",
    ditherOptions.ditheringType === "quantizationOnly"
      ? "quantization only"
      : "",
    `kind scores: ${formatTopScores(suggestion.classification.kindScores)}`,
    `preset scores: ${formatTopScores(suggestion.scores)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  autoRecommendationReasons.replaceChildren(
    ...suggestion.reasons.slice(0, 4).map((reason) => {
      const item = document.createElement("li");
      item.textContent = reason;
      return item;
    }),
  );
}

async function processImage() {
  if (!lastImage) return;
  const token = ++processToken;

  drawImageToScreenCanvas(lastImage, inputCanvas);

  const { palette } = getSelectedPaletteOption();
  currentProcessingSuggestion = suggestCanvasProcessingOptions(
    inputCanvas,
    palette,
  );
  updateImageStyleResult(currentProcessingSuggestion.classification);
  updateAutoRecommendation(currentProcessingSuggestion);
  updateConfigOutput();

  const options =
    processingPresetSelect.value === "auto"
      ? { ...currentProcessingSuggestion.ditherOptions, palette }
      : getDitherOptionsFromUI(palette);

  await ditherImage(inputCanvas, outputCanvas, options);
  if (token !== processToken) return;

  downloadLink.href = outputCanvas.toDataURL("image/png");
  replaceColors(outputCanvas, deviceColorsCanvas, palette);
  downloadDeviceColorsLink.href = deviceColorsCanvas.toDataURL("image/png");
}

fileInput.addEventListener("change", async () => {
  if (!fileInput.files?.length) return;

  const file = fileInput.files[0];
  const src = URL.createObjectURL(file);
  const img = await loadImage(src);
  lastImage = img;
  URL.revokeObjectURL(src);
  await processImage();
});

function refreshControlState() {
  updatePalettePreviews();
  updateConfigOutput();

  document
    .querySelectorAll<HTMLOutputElement>("output[data-for]")
    .forEach((output) => {
      const input = document.getElementById(
        output.dataset.for ?? "",
      ) as HTMLInputElement | null;
      if (input) output.value = input.value;
    });

  const toneMode = toneModeSelect.value;
  document.querySelectorAll<HTMLElement>("[data-tone-panel]").forEach((el) => {
    el.hidden = el.dataset.tonePanel !== toneMode;
  });

  const showAutoRange = dynamicRangeModeSelect.value === "auto";
  document.querySelectorAll<HTMLElement>("[data-drc-auto]").forEach((el) => {
    el.hidden = !showAutoRange;
  });
}

function scheduleProcessImage() {
  window.clearTimeout(scheduledProcess);
  scheduledProcess = window.setTimeout(async () => {
    refreshControlState();
    await processImage();
  }, 80);
}

const controls = [
  paletteSelect,
  processingPresetSelect,
  ditheringTypeSelect,
  errorDiffusionMatrixSelect,
  orderedDitheringMatrixW,
  orderedDitheringMatrixH,
  randomDitheringTypeSelect,
  serpentineCheckbox,
  colorMatchingSelect,
  toneModeSelect,
  exposureInput,
  saturationInput,
  contrastInput,
  scurveStrengthInput,
  shadowBoostInput,
  highlightCompressInput,
  midpointInput,
  dynamicRangeModeSelect,
  dynamicRangeStrengthInput,
  lowPercentileInput,
  highPercentileInput,
];

controls.forEach((el) => {
  el.addEventListener("change", () => {
    if (el === processingPresetSelect) {
      applyPresetToUI(processingPresetSelect.value);
    }
    scheduleProcessImage();
  });

  if (el instanceof HTMLInputElement) {
    el.addEventListener("input", scheduleProcessImage);
  }
});

copyConfigButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(configOutput.textContent ?? "");
});

copyJsExampleButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(jsExampleOutput.textContent ?? "");
});

[screenResolutionSelect, orientationSelect, imageFitSelect].forEach((select) => {
  select.addEventListener("change", () => {
    saveDeviceTestConfig();
    setDeviceTestStatus("");
    scheduleProcessImage();
  });
});

[paperIdInput, apiKeyInput].forEach((input) => {
  input.addEventListener("input", () => {
    saveDeviceTestConfig();
    setDeviceTestStatus("");
  });
});

testOnDeviceButton.addEventListener("click", testOnDevice);

toggleOriginalSizeButton.addEventListener("click", () => {
  showOriginalSize = !showOriginalSize;
  updateCanvasSizeMode();
});
