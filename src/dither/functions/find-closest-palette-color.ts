import {
  deltaE,
  rgbToLab,
  type ColorMatchingMode,
  type RGB,
  type RGBA,
} from "../processing";

const withAlpha = (color: RGB | RGBA): RGBA => [
  color[0],
  color[1],
  color[2],
  (color as RGBA)[3] ?? 255,
];

const findClosestPaletteColor = (
  pixel: RGB | RGBA,
  colorPalette: RGB[],
  colorMatching: ColorMatchingMode = "rgb"
): RGBA => {
  if (!colorPalette.length) return withAlpha(pixel);
  const pixelLab =
    colorMatching === "lab" ? rgbToLab(pixel[0], pixel[1], pixel[2]) : null;

  const colors = colorPalette.map((color) => {
    return {
      distance:
        colorMatching === "lab" && pixelLab
          ? deltaE(rgbToLab(...color), pixelLab)
          : distanceInColorSpace(color, pixel),
      color,
    };
  });

  let closestColor: { distance: number; color: RGB };
  colors.forEach((color) => {
    if (!closestColor) {
      closestColor = color;
    } else {
      if (color.distance < closestColor.distance) {
        closestColor = color;
      }
    }
  });

  return withAlpha(closestColor.color);
};

const distanceInColorSpace = (color1: RGB, color2: RGB | RGBA) => {
  // Currenlty ignores alpha

  // Luminosity needs to be accounted for, for better results.
  // var lumR = .2126,
  //     lumG = .7152,
  //     lumB = .0722

  // const max = 255

  // const averageMax = Math.sqrt(lumR * max * max + lumG * max * max + lumB * max * max) // I Dont understand this

  const r = color1[0] - color2[0];
  const g = color1[1] - color2[1];
  const b = color1[2] - color2[2];

  const distance = Math.sqrt(r * r + g * g + b * b);
  return distance;
};

export default findClosestPaletteColor;
