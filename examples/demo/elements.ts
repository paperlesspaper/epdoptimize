export const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

export const fileInput = $("fileInput") as HTMLInputElement;
export const sampleImageGrid = $("sampleImageGrid") as HTMLDivElement;
export const imageStyleValue = $("imageStyleValue") as HTMLElement;
export const imageStyleConfidence = $(
  "imageStyleConfidence",
) as HTMLSpanElement;
export const imageStyleMeter = $("imageStyleMeter") as HTMLSpanElement;
export const imageStyleMetrics = $("imageStyleMetrics") as HTMLDListElement;
export const canvasGrid = $("canvasGrid") as HTMLDivElement;
export const inputCanvas = $("inputCanvas") as HTMLCanvasElement;
export const adjustedCanvas = $("adjustedCanvas") as HTMLCanvasElement;
export const outputCanvas = $("outputCanvas") as HTMLCanvasElement;
export const deviceColorsCanvas = $("deviceColorsCanvas") as HTMLCanvasElement;
export const canvasFrames = Array.from(
  document.querySelectorAll<HTMLDivElement>("[data-scroll-sync]"),
);
export const toggleOriginalSizeButton = $(
  "toggleOriginalSizeButton",
) as HTMLButtonElement;
export const downloadLink = $("downloadLink") as HTMLAnchorElement;
export const downloadDeviceColorsLink = $(
  "downloadDeviceColorsLink",
) as HTMLAnchorElement;
export const configOutput = $("configOutput") as HTMLPreElement;
export const copyConfigButton = $("copyConfigButton") as HTMLButtonElement;
export const jsExampleOutput = $("jsExampleOutput") as HTMLPreElement;
export const copyJsExampleButton = $(
  "copyJsExampleButton",
) as HTMLButtonElement;
export const jsAdvancedExampleOutput = $(
  "jsAdvancedExampleOutput",
) as HTMLPreElement;
export const copyJsAdvancedExampleButton = $(
  "copyJsAdvancedExampleButton",
) as HTMLButtonElement;
export const configTabButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-config-tab]"),
);
export const configPanels = Array.from(
  document.querySelectorAll<HTMLDivElement>("[data-config-panel]"),
);
export const screenResolutionSelect = $(
  "screenResolutionSelect",
) as HTMLSelectElement;
export const customResolutionFields = $("customResolutionFields");
export const customWidthInput = $("customWidth") as HTMLInputElement;
export const customHeightInput = $("customHeight") as HTMLInputElement;
export const customResolutionStatus = $("customResolutionStatus");
export const orientationSelect = $("orientationSelect") as HTMLSelectElement;
export const imageFitSelect = $("imageFitSelect") as HTMLSelectElement;
export const orientationToggleButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-orientation-option]"),
);
export const imageFitToggleButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-image-fit-option]"),
);
export const paperIdInput = $("paperIdInput") as HTMLInputElement;
export const apiKeyInput = $("apiKeyInput") as HTMLInputElement;
export const testOnDeviceButton = $("testOnDeviceButton") as HTMLButtonElement;
export const deviceTestStatus = $("deviceTestStatus") as HTMLParagraphElement;

export const paletteSelect = $("paletteSelect") as HTMLSelectElement;
export const palettePreview = $("palettePreview") as HTMLDivElement;
export const deviceColorsPreview = $("deviceColorsPreview") as HTMLDivElement;
export const paletteNameInput = $("paletteName") as HTMLInputElement;
export const paletteEditorRows = $("paletteEditorRows") as HTMLDivElement;
export const newPaletteButton = $("newPaletteButton") as HTMLButtonElement;
export const clonePaletteButton = $("clonePaletteButton") as HTMLButtonElement;
export const savePaletteButton = $("savePaletteButton") as HTMLButtonElement;
export const resetPaletteButton = $("resetPaletteButton") as HTMLButtonElement;
export const addPaletteColorButton = $(
  "addPaletteColorButton",
) as HTMLButtonElement;
export const paletteEditorStatus = $(
  "paletteEditorStatus",
) as HTMLParagraphElement;
export const processingPresetSelect = $(
  "processingPreset",
) as HTMLSelectElement;
export const autoFlowSelect = $("autoFlow") as HTMLSelectElement;
export const autoAdjustmentsButton = $(
  "autoAdjustmentsButton",
) as HTMLButtonElement;
export const resetImageAdjustmentsButton = $(
  "resetImageAdjustmentsButton",
) as HTMLButtonElement;
export const ditheringTypeSelect = $("ditheringType") as HTMLSelectElement;
export const errorDiffusionMatrixSelect = $(
  "errorDiffusionMatrix",
) as HTMLSelectElement;
export const orderedDitheringMatrixW = $(
  "orderedDitheringMatrixW",
) as HTMLInputElement;
export const orderedDitheringMatrixH = $(
  "orderedDitheringMatrixH",
) as HTMLInputElement;
export const randomDitheringTypeSelect = $(
  "randomDitheringType",
) as HTMLSelectElement;
export const serpentineCheckbox = $("serpentine") as HTMLInputElement;
export const colorMatchingSelect = $("colorMatching") as HTMLSelectElement;
export const processingEngineSelect = $(
  "processingEngine",
) as HTMLSelectElement;
export const edgePreservationCheckbox = $(
  "edgePreservation",
) as HTMLInputElement;
export const edgePreservationStrengthInput = $(
  "edgePreservationStrength",
) as HTMLInputElement;
export const edgeAntialiasingCheckbox = $(
  "edgeAntialiasing",
) as HTMLInputElement;
export const edgeAntialiasingStrengthInput = $(
  "edgeAntialiasingStrength",
) as HTMLInputElement;
export const autoRecommendationTitle = $(
  "autoRecommendationTitle",
) as HTMLElement;
export const autoRecommendationReasons = $(
  "autoRecommendationReasons",
) as HTMLUListElement;

export const exposureInput = $("exposure") as HTMLInputElement;
export const saturationInput = $("saturation") as HTMLInputElement;
export const contrastInput = $("contrast") as HTMLInputElement;
export const clarityInput = $("clarity") as HTMLInputElement;
export const scurveStrengthInput = $("scurveStrength") as HTMLInputElement;
export const shadowBoostInput = $("shadowBoost") as HTMLInputElement;
export const highlightCompressInput = $(
  "highlightCompress",
) as HTMLInputElement;
export const midpointInput = $("midpoint") as HTMLInputElement;
export const toneCurvePreviewCanvas = $(
  "toneCurvePreview",
) as HTMLCanvasElement;
export const histogramPreviewCanvas = $(
  "histogramPreview",
) as HTMLCanvasElement;

export const dynamicRangeModeSelect = $(
  "dynamicRangeMode",
) as HTMLSelectElement;
export const dynamicRangeStrengthInput = $(
  "dynamicRangeStrength",
) as HTMLInputElement;
export const lowPercentileInput = $("lowPercentile") as HTMLInputElement;
export const highPercentileInput = $("highPercentile") as HTMLInputElement;
export const rangeFittingPreviewCanvas = $(
  "rangeFittingPreview",
) as HTMLCanvasElement;
