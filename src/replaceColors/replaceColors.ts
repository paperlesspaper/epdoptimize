import type { PaletteColorEntry } from "../dither/functions/palette-order";

type RGB = [number, number, number];

export interface ReplaceColorsOptions {
  originalColors: string[];
  replaceColors: string[];
}

export type ReplaceColorsPalette = Pick<
  PaletteColorEntry,
  "color" | "deviceColor"
>[];

const hexToRgb = (h: string): RGB => {
  const rgb = h
    .replace(
      /^#?([a-f\d])([a-f\d])([a-f\d])$/i,
      (_, r, g, b) => "#" + r + r + g + g + b + b
    )
    .substring(1)
    .match(/.{2}/g)
    ?.map((x) => parseInt(x, 16));

  if (!rgb || rgb.length !== 3 || rgb.some((channel) => Number.isNaN(channel))) {
    throw new Error(`Invalid hex color: ${h}`);
  }

  return rgb as RGB;
};

const colorKey = (rgb: RGB) => rgb.join(",");

const isPaletteEntryArray = (
  palette: ReplaceColorsPalette | ReplaceColorsOptions
): palette is ReplaceColorsPalette =>
  Array.isArray(palette) &&
  palette.every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      "color" in entry &&
      "deviceColor" in entry
  );

const createReplacementMap = (
  palette: ReplaceColorsPalette | ReplaceColorsOptions
) => {
  const entries = isPaletteEntryArray(palette)
    ? palette
    : palette.originalColors.map((color, index) => ({
        color,
        deviceColor: palette.replaceColors[index],
      }));

  return new Map(
    entries
      .filter((entry) => Boolean(entry.deviceColor))
      .map((entry) => [
        colorKey(hexToRgb(entry.color)),
        hexToRgb(entry.deviceColor),
      ])
  );
};

export const replaceColors = (
  fromCanvas: HTMLCanvasElement,
  destCanvas: HTMLCanvasElement,
  palette: ReplaceColorsPalette | ReplaceColorsOptions
) => {
  const fromCtx = fromCanvas.getContext("2d");
  if (!fromCtx) return;

  const width = fromCanvas.width;
  const height = fromCanvas.height;

  const destCtx = destCanvas.getContext("2d");
  if (!destCtx) return;

  const imageData = fromCtx.getImageData(0, 0, width, height);
  let errorColors = 0;
  const replacementMap = createReplacementMap(palette);

  for (let i = 0; i < imageData.data.length; i += 4) {
    const replacement = replacementMap.get(
      `${imageData.data[i]},${imageData.data[i + 1]},${imageData.data[i + 2]}`
    );

    if (!replacement) {
      errorColors++;
      continue;
    }

    imageData.data[i] = replacement[0];
    imageData.data[i + 1] = replacement[1];
    imageData.data[i + 2] = replacement[2];
  }

  if (errorColors > 0) {
    console.warn(
      `replaceColors: ${errorColors} pixels were not replaced. Check if the colors match exactly.`
    );
  }

  destCanvas.width = width;
  destCanvas.height = height;
  destCtx.putImageData(imageData, 0, 0);
};
