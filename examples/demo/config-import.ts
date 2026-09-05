import type { DemoConfig } from "./types";

type RecordValue = Record<string, any>;
type Rule = "number" | "boolean" | "rgb" | readonly string[] | { [key: string]: Rule };
const tone: Rule = {
  mode: ["off", "contrast", "scurve"], exposure: "number", saturation: "number",
  contrast: "number", strength: "number", shadowBoost: "number",
  highlightCompress: "number", midpoint: "number",
};
const range: Rule = {
  mode: ["off", "display", "auto"], black: "rgb", white: "rgb", strength: "number",
  lowPercentile: "number", highPercentile: "number", quality: ["fast", "accurate"],
  preserveWhite: "boolean", whitePreservePercentile: "number",
  whitePreserveMinLuma: "number", whitePreserveMaxSaturation: "number",
};
const adjustments: Record<string, Rule> = {
  toneMapping: tone,
  clarity: { amount: "number", radius: "number", midtone: "number" },
  dynamicRangeCompression: range,
  levelCompression: {
    mode: ["off", "perChannel", "luma"], black: "rgb", white: "rgb",
    auto: "boolean", autoThreshold: "number",
    percentileClip: { low: "number", high: "number" },
  },
  paperNormalization: {
    mode: ["off", "warmPaper"], strength: "number", minLuma: "number",
    saturationThreshold: "number", warmBiasThreshold: "number", blackAnchor: "number",
    preserveRed: "number", paperWhite: "rgb",
  },
};

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validate(value: unknown, rule: Rule, path: string): void {
  if (rule === "number" && typeof value === "number" && Number.isFinite(value)) return;
  if (rule === "boolean" && typeof value === "boolean") return;
  if (rule === "rgb") {
    const values = Array.isArray(value) ? value : [value];
    if ((!Array.isArray(value) || value.length === 3) && values.every(v =>
      typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 255)) return;
  }
  if (Array.isArray(rule) && rule.includes(value as string)) return;
  if (isRecord(rule) && isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (!Object.prototype.hasOwnProperty.call(rule, key)) throw new Error(`Unknown option: ${path}.${key}`);
      if (key === "dynamicRangeCompression" && typeof child === "boolean") continue;
      validate(child, rule[key], `${path}.${key}`);
    }
    return;
  }
  throw new Error(`Invalid value for ${path}.`);
}

export function parseDemoConfig(text: string, choices: Record<string, string[]>): DemoConfig {
  if (text.length > 1_000_000) throw new Error("Config is too large (maximum 1 MB).");
  let value: unknown;
  try { value = JSON.parse(text.replace(/^\uFEFF/, "")); }
  catch { throw new Error("Invalid JSON. Check commas, quotes and brackets."); }
  if (!isRecord(value)) throw new Error("Config must be a JSON object.");
  for (const key of Object.keys(value)) {
    if (!["palette", "imageAdjustmentOptions", "canvasDitherOptions"].includes(key)) {
      throw new Error(`Unknown config field: ${key}`);
    }
  }
  if (typeof value.palette === "string") {
    if (!choices.palette.includes(value.palette)) throw new Error(`Unknown palette: ${value.palette}`);
  } else {
    if (!Array.isArray(value.palette) || !value.palette.length || value.palette.length > 256) {
      throw new Error("Palette must be a built-in name or contain 1–256 colors.");
    }
    value.palette = value.palette.map((entry, index) => {
      const item = typeof entry === "string" ? { color: entry, deviceColor: entry } : entry;
      const color = /^#[0-9a-f]{6}$/i;
      if (!isRecord(item) || !color.test(item.color) ||
          (item.deviceColor !== undefined && !color.test(item.deviceColor)) ||
          (item.name !== undefined && typeof item.name !== "string")) {
        throw new Error(`Invalid palette color at position ${index + 1}; use #RRGGBB.`);
      }
      return { name: item.name ?? `color${index + 1}`, color: item.color, deviceColor: item.deviceColor ?? item.color };
    });
  }
  const dither: Record<string, Rule> = {
    ...adjustments, ...choices, serpentine: "boolean",
    edgePreservation: { enabled: "boolean", strength: "number", threshold: "number", radius: "number" },
    edgeAntialiasing: { enabled: "boolean", strength: "number", threshold: "number", bandRadius: "number", localRadius: "number" },
  };
  delete dither.palette;
  const image = value.imageAdjustmentOptions === undefined ? {} : value.imageAdjustmentOptions;
  const canvas = value.canvasDitherOptions === undefined ? {} : value.canvasDitherOptions;
  if (!isRecord(canvas)) throw new Error("canvasDitherOptions must be an object.");
  const { orderedDitheringMatrix: matrix, ...rest } = canvas;
  if (matrix !== undefined && (!Array.isArray(matrix) || matrix.length !== 2 ||
      !matrix.every(v => Number.isInteger(v) && v >= 1 && v <= 16))) {
    throw new Error("orderedDitheringMatrix must contain two integers from 1 to 16.");
  }
  validate(image, adjustments, "imageAdjustmentOptions");
  validate(rest, dither, "canvasDitherOptions");
  return { palette: value.palette, imageAdjustmentOptions: image, canvasDitherOptions: canvas };
}

/** Preserve imported fields without controls; overlay only deliberate UI changes. */
export function mergeControlChanges(original: RecordValue, before: RecordValue, after: RecordValue): RecordValue {
  const result = { ...original };
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue;
    if (isRecord(before[key]) && isRecord(after[key])) {
      result[key] = mergeControlChanges(isRecord(original[key]) ? original[key] : {}, before[key], after[key]);
    } else if (after[key] === undefined) {
      delete result[key];
    } else {
      result[key] = after[key];
    }
  }
  return result;
}
