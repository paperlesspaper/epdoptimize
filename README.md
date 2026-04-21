# EPD Optimize

[Interactive demo](https://utzel-butzel.github.io/epdoptimize/)

A JavaScript library for reducing, tone-mapping, and dithering images for color e-paper displays.

E-paper displays have a much smaller reproducible color range than LCD/OLED screens. This library converts images into calibrated palette colors that better match the measured appearance of a target display, then maps those calibrated colors back to the native device colors needed for export.

We use it for our eInk picture frames at [paperlesspaper](https://paperlesspaper.de/en).

The library works in browser JavaScript with the Canvas API and in Node.js when used with [node-canvas](https://www.npmjs.com/package/canvas).

[Blog post](https://paperlesspaper.de/en/blog/dither-eink-tool-open-source)

You can order our Spectra 6 eInk picture frame [here](https://paperlesspaper.de/buy-7-inch-epaper-picture-frame).

[![Node.js Package](https://github.com/Utzel-Butzel/epdoptimize/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/Utzel-Butzel/epdoptimize/actions/workflows/npm-publish.yml)

## Supported Displays

- [Spectra 6](https://www.eink.com/brand?bookmark=Spectra)
- [AcEP / Gallery](https://www.eink.com/brand/detail/Gallery)
- Custom palettes

Built-in palette exports currently include:

- `defaultPalette` (black and white)
- `aitjcizeSpectra6Palette` (Spectra 6)
- `spectra6Palette` (not recommended)
- `spectra6legacyPalette` (not recommended)
- `acepPalette`
- `gameboyPalette`

![Intro image](https://raw.githubusercontent.com/Utzel-Butzel/epdoptimize/refs/heads/main/intro-image.jpg)

## Features

- **Calibrated display palettes:** Dither against measured display colors, then export native device colors.
- **Single palette config:** Palette entries contain `name`, `color`, and `deviceColor`.
- **Multiple dithering modes:** Error diffusion, ordered dithering, random dithering, and quantization-only conversion.
- **Advanced tone mapping:** Exposure, saturation, contrast, and S-curve controls inspired by [epaper-image-convert](https://github.com/aitjcize/epaper-image-convert).
- **Dynamic range compression:** LAB lightness remapping into the target display range.
- **Color matching modes:** RGB or LAB palette matching.
- **Automatic processing suggestions:** Heuristically classify the image, score presets, and suggest dither options for the selected palette.
- **Interactive demo:** Sample images, palette previews, automatic/manual processing controls, downloads, compact config JSON, and copyable JS example.

## Installation

```bash
npm install epdoptimize
```

## Quick Start

```html
<canvas id="inputCanvas"></canvas>
<canvas id="ditheredCanvas"></canvas>
<canvas id="deviceCanvas"></canvas>
```

```js
import {
  ditherImage,
  replaceColors,
  aitjcizeSpectra6Palette,
} from "epdoptimize";

const inputCanvas = document.getElementById("inputCanvas");
const ditheredCanvas = document.getElementById("ditheredCanvas");
const deviceCanvas = document.getElementById("deviceCanvas");

await ditherImage(inputCanvas, ditheredCanvas, {
  palette: aitjcizeSpectra6Palette,
  processingPreset: "balanced",
  ditheringType: "errorDiffusion",
  errorDiffusionMatrix: "floydSteinberg",
  serpentine: true,
});

replaceColors(ditheredCanvas, deviceCanvas, aitjcizeSpectra6Palette);
```

`ditherImage` uses each entry's calibrated `color` value. `replaceColors` then maps every matching `color` to its corresponding `deviceColor`.

## Automatic Processing

If you do not want to choose a preset manually, use the auto recommender. It analyzes the source image and target palette, then returns concrete `ditherOptions` plus the reasons behind the choice.

```js
import {
  ditherImage,
  replaceColors,
  spectra6Palette,
  suggestCanvasProcessingOptions,
} from "epdoptimize";

const suggestion = suggestCanvasProcessingOptions(inputCanvas, spectra6Palette);

await ditherImage(inputCanvas, ditheredCanvas, {
  ...suggestion.ditherOptions,
  palette: spectra6Palette,
});

replaceColors(ditheredCanvas, deviceCanvas, aitjcizeSpectra6Palette);

console.log(suggestion.imageKind);
console.log(suggestion.reasons);
```

The optional `intent` can steer the recommendation:

```js
const suggestion = suggestCanvasProcessingOptions(
  inputCanvas,
  aitjcizeSpectra6Palette,
  {
    intent: "readable",
  },
);
```

Available intents are `natural`, `vivid`, `readable`, `faithful`, and `lowNoise`.

## Palette Format

Palettes live in [src/dither/data/default-palettes.json](src/dither/data/default-palettes.json). Each palette is an array of entries:

```json
{
  "spectra6": [
    { "name": "black", "color": "#1F2226", "deviceColor": "#000000" },
    { "name": "white", "color": "#B9C7C9", "deviceColor": "#FFFFFF" },
    { "name": "blue", "color": "#233F8E", "deviceColor": "#0000FF" },
    { "name": "green", "color": "#35563A", "deviceColor": "#00FF00" },
    { "name": "red", "color": "#62201E", "deviceColor": "#FF0000" },
    { "name": "yellow", "color": "#C1BB1E", "deviceColor": "#FFFF00" }
  ]
}
```

The fields mean:

- `name`: Stable role used to align palette colors with device colors.
- `color`: Calibrated display appearance used for dithering and color matching.
- `deviceColor`: Native output color sent to the display.

You can pass one combined palette to both `ditherImage` and `replaceColors`.

## Built-In Palettes

Built-in palettes are exported as combined palette entries, so the same import can be passed to both `ditherImage` and `replaceColors`.

```js
import {
  ditherImage,
  replaceColors,
  aitjcizeSpectra6Palette,
} from "epdoptimize";

await ditherImage(inputCanvas, ditheredCanvas, {
  palette: aitjcizeSpectra6Palette,
  processingPreset: "dynamic",
});

replaceColors(ditheredCanvas, deviceCanvas, aitjcizeSpectra6Palette);
```

This is the same pattern used by the demo's generated JS example.

## Custom Palettes

For a display-ready conversion, define entries with both calibrated colors and native device colors:

```js
const myPalette = [
  { name: "black", color: "#1c1f22", deviceColor: "#000000" },
  { name: "white", color: "#d8d8d2", deviceColor: "#FFFFFF" },
  { name: "red", color: "#7f1d1d", deviceColor: "#FF0000" },
  { name: "yellow", color: "#c8b72c", deviceColor: "#FFFF00" },
];

await ditherImage(inputCanvas, ditheredCanvas, {
  palette: myPalette,
  colorMatching: "lab",
});

replaceColors(ditheredCanvas, deviceCanvas, myPalette);
```

If you only need a dithered preview and do not need device color replacement, `palette` can also be a plain hex array:

```js
await ditherImage(inputCanvas, ditheredCanvas, {
  palette: ["#000000", "#FFFFFF", "#FF0000"],
});
```

## Demo Config

The demo exposes a compact JSON config and a matching JS example. The generated config includes the selected palette export name and only the dither options that differ from defaults or preset values. When the demo's **Auto** preset is selected, Auto is resolved into concrete `ditherOptions`.

```js
import {
  ditherImage,
  replaceColors,
  aitjcizeSpectra6Palette,
} from "epdoptimize";

const config = {
  palette: "aitjcizeSpectra6Palette",
  ditherOptions: {
    processingPreset: "dynamic",
    errorDiffusionMatrix: "stucki",
  },
};

const palette = spectra6Palette;

await ditherImage(inputCanvas, ditheredCanvas, {
  ...config.ditherOptions,
  palette,
});

replaceColors(ditheredCanvas, deviceCanvas, palette);
```

## API

### `ditherImage(sourceCanvas, destinationCanvas, options)`

Reads pixels from `sourceCanvas`, processes and dithers them, then writes to `destinationCanvas`.

```js
await ditherImage(sourceCanvas, destinationCanvas, options);
```

### `replaceColors(sourceCanvas, destinationCanvas, palette)`

Maps dithered calibrated palette colors to native device colors.

```js
replaceColors(ditheredCanvas, deviceCanvas, palette);
```

The preferred `palette` argument is:

```ts
Array<{
  name: string;
  color: string;
  deviceColor: string;
}>;
```

### `classifyImageStyle(imageData, options)`

Heuristically classifies image data as a photo or illustration and reports a
more specific `kind`, such as `lowContrastPhoto`, `flatIllustration`,
`textOrUi`, `lineArt`, or `pixelArt`. The result includes a confidence value
and the metrics used for the decision. It also returns `kindScores` so callers
can react to ambiguous images instead of relying only on the top label.

```js
import { classifyImageStyle } from "epdoptimize";

const result = classifyImageStyle(ctx.getImageData(0, 0, width, height));

if (result.style === "photo") {
  // use photo-oriented processing
}
```

The metrics include color distribution (`topColorCoverage`, `paletteEntropy`),
edge structure (`edgeDensity`, `horizontalEdgeRatio`, `verticalEdgeRatio`), and
tile ratios (`photoTileRatio`, `flatTileRatio`, `textTileRatio`,
`gradientTileRatio`).

For canvas input, use `classifyCanvasImageStyle(canvas, options)`.

Result shape:

```ts
{
  style: "photo" | "illustration" | "unknown";
  kind:
    | "photo"
    | "lowContrastPhoto"
    | "highContrastPhoto"
    | "flatIllustration"
    | "lineArt"
    | "textOrUi"
    | "pixelArt"
    | "unknown";
  kindScores: Record<string, number>;
  confidence: number;
  photoScore: number;
  metrics: ImageStyleMetrics;
}
```

### `suggestProcessingOptions(imageData, palette, options)`

Suggests processing options from the image classification and the target palette.
The result includes the classification, recommended `ditherOptions`, preset
scores, and human-readable reasons.

```js
import {
  ditherImage,
  replaceColors,
  aitjcizeSpectra6Palette,
  suggestCanvasProcessingOptions,
} from "epdoptimize";

const suggestion = suggestCanvasProcessingOptions(
  inputCanvas,
  aitjcizeSpectra6Palette,
);

await ditherImage(inputCanvas, ditheredCanvas, {
  ...suggestion.ditherOptions,
  palette: aitjcizeSpectra6Palette,
});

replaceColors(ditheredCanvas, deviceCanvas, aitjcizeSpectra6Palette);
```

The optional `intent` can be `natural`, `vivid`, `readable`, `faithful`, or
`lowNoise`.

Result shape:

```ts
{
  classification: ImageStyleClassification;
  imageKind: ImageKind;
  intent: AutoProcessingIntent;
  ditherOptions: Partial<DitherImageOptions>;
  reasons: string[];
  scores: Record<string, number>;
}
```

### Built-In Palette Exports

```js
import {
  defaultPalette,
  gameboyPalette,
  spectra6legacyPalette,
  spectra6Palette,
  aitjcizeSpectra6Palette,
  acepPalette,
} from "epdoptimize";
```

Each export is an array of `{ name, color, deviceColor }` entries.

### Palette Helper Exports

Named palette imports are preferred for new code. The lower-level helpers remain available when you need raw color arrays:

```js
import {
  getDefaultPalettes,
  getDeviceColors,
  getDeviceColorsForPalette,
} from "epdoptimize";
```

- `getDefaultPalettes(name)`: Returns calibrated `color` hex values.
- `getDeviceColors(name)`: Returns native `deviceColor` hex values.
- `getDeviceColorsForPalette(paletteName, deviceColorsName)`: Returns device colors aligned to another palette's role order.

### Processing Preset Helpers

```js
import {
  getProcessingPreset,
  getProcessingPresetNames,
  getProcessingPresetOptions,
} from "epdoptimize";
```

- `getProcessingPreset(name)`: Returns the full preset definition.
- `getProcessingPresetNames()`: Returns preset names.
- `getProcessingPresetOptions()`: Returns `{ value, title, description }` options for UI controls.

## Dithering Options

| Option                    | Type                                | Default            | Description                                                                                                                                                                                                                                        |
| ------------------------- | ----------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `palette`                 | string / string[] / palette entries | `"default"`        | Palette to use for quantization. Prefer a built-in palette export or combined palette entries with `color` and `deviceColor`; plain hex arrays work for dither-only previews.                                                                      |
| `processingPreset`        | string                              | `undefined`        | Preset name. Options: `balanced`, `dynamic`, `vivid`, `soft`, `grayscale`. Presets fill tone mapping, dynamic range compression, color matching, and diffusion defaults unless overridden. Use `suggestProcessingOptions` for automatic selection. |
| `ditheringType`           | string                              | `"errorDiffusion"` | Main dithering mode. Options: `errorDiffusion`, `ordered`, `random`, `quantizationOnly`.                                                                                                                                                           |
| `errorDiffusionMatrix`    | string                              | `"floydSteinberg"` | Error diffusion kernel. Options include `floydSteinberg`, `atkinson`, `falseFloydSteinberg`, `jarvis`, `stucki`, `burkes`, `sierra3`, `sierra2`, `sierra2-4a`.                                                                                     |
| `algorithm`               | string                              | `undefined`        | Backwards-compatible alias for `errorDiffusionMatrix`.                                                                                                                                                                                             |
| `serpentine`              | boolean                             | `false`            | Alternates scan direction on each row for error diffusion.                                                                                                                                                                                         |
| `orderedDitheringType`    | string                              | `"bayer"`          | Type of ordered dithering. Currently `bayer`.                                                                                                                                                                                                      |
| `orderedDitheringMatrix`  | [number, number]                    | `[4, 4]`           | Size of the Bayer matrix for ordered dithering.                                                                                                                                                                                                    |
| `randomDitheringType`     | string                              | `"blackAndWhite"`  | Random mode. Options: `blackAndWhite`, `rgb`.                                                                                                                                                                                                      |
| `colorMatching`           | string                              | `"rgb"`            | Palette distance model. Options: `rgb`, `lab`.                                                                                                                                                                                                     |
| `toneMapping`             | object                              | `undefined`        | Exposure, saturation, contrast, or S-curve preprocessing.                                                                                                                                                                                          |
| `dynamicRangeCompression` | object / boolean                    | `undefined`        | LAB lightness compression. Use `{ mode: "display" }`, `{ mode: "auto" }`, or `{ mode: "off" }`.                                                                                                                                                    |
| `levelCompression`        | object                              | `undefined`        | Optional legacy/preprocessing range remap with `perChannel` or `luma` mode.                                                                                                                                                                        |
| `sampleColorsFromImage`   | boolean                             | `false`            | Reserved for image-derived palettes.                                                                                                                                                                                                               |
| `numberOfSampleColors`    | number                              | `10`               | Number of colors to sample when image-derived palettes are enabled.                                                                                                                                                                                |

## Tone Mapping

Tone mapping runs before palette matching.

```js
await ditherImage(inputCanvas, ditheredCanvas, {
  palette,
  toneMapping: {
    mode: "scurve",
    exposure: 1.1,
    saturation: 1.4,
    strength: 0.8,
    shadowBoost: 0.1,
    highlightCompress: 1.4,
    midpoint: 0.5,
  },
});
```

Tone mapping options:

- `mode`: `off`, `contrast`, or `scurve`.
- `exposure`: Multiplies brightness before tone shaping.
- `saturation`: Multiplies color saturation.
- `contrast`: Contrast multiplier for `contrast` mode.
- `strength`: S-curve strength for `scurve` mode.
- `shadowBoost`: Lifts dark values in `scurve` mode.
- `highlightCompress`: Compresses bright values in `scurve` mode.
- `midpoint`: S-curve midpoint.

## Dynamic Range Compression

Dynamic range compression remaps LAB lightness into the display palette range. This can keep photos from crushing into black/white too early on limited-color e-paper displays.

```js
await ditherImage(inputCanvas, ditheredCanvas, {
  palette,
  dynamicRangeCompression: {
    mode: "auto",
    strength: 0.85,
    lowPercentile: 0.01,
    highPercentile: 0.99,
  },
});
```

Modes:

- `off`: Disable dynamic range compression.
- `display`: Compress into the lightness range of the selected palette.
- `auto`: Uses percentile clipping before compression.

## Dithering Algorithms

Dithering creates the impression of intermediate colors by distributing quantization errors across neighboring pixels.

| Algorithm             | Description                                                                          |
| --------------------- | ------------------------------------------------------------------------------------ |
| `floydSteinberg`      | Classic Floyd-Steinberg error diffusion. Distributes error to four neighbors.        |
| `atkinson`            | Atkinson diffusion. Lighter diffusion pattern with a distinctive high-contrast look. |
| `falseFloydSteinberg` | Simplified Floyd-Steinberg. Faster, slightly different texture.                      |
| `jarvis`              | Jarvis, Judice, and Ninke. Smooth gradients, more blur.                              |
| `stucki`              | Similar to Jarvis with different weights. Balances smoothness and sharpness.         |
| `burkes`              | Simplified Stucki. Fewer neighbors and less computation.                             |
| `sierra3`             | Sierra-3. High quality with less blur than Jarvis.                                   |
| `sierra2`             | Reduced Sierra-3. Fewer neighbors and faster processing.                             |
| `sierra2-4a`          | Lightweight Sierra variant for speed-sensitive conversions.                          |

## How It Works

1. Load pixels from the source canvas.
2. Apply optional tone mapping and dynamic range compression.
3. Quantize or dither pixels into the calibrated palette `color` values.
4. Use `replaceColors` to replace calibrated `color` values with native `deviceColor` values.
5. Export the device-color canvas as PNG or another format.

## Resources

- [paperlesspaper](https://paperlesspaper.de)
- [Interactive demo](https://utzel-butzel.github.io/epdoptimize/)
- [epaper-image-convert](https://github.com/aitjcize/epaper-image-convert), the reference project for several tone mapping, range compression, and palette ideas.

## Credits

- [Dither me this](https://github.com/DitheringIdiot/dither-me-this)
- [Inkify](https://github.com/cmdwtf/Inkify)
- [epaper-image-convert](https://github.com/aitjcize/epaper-image-convert)

---

Contributions and feedback are welcome.
