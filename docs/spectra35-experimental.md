# Spectra35 — experimental tests

> **EXPERIMENTAL · NOT A STANDARD SPECTRA6 OUTPUT FORMAT.**
> This is a camera-derived 35-state palette for one experimental 13.3-inch
> OpenPaper L setup. It needs custom firmware and a matching multi-pass LUT
> adapter. Changing panel drive can permanently damage the panel. Do not upload
> the token image through the normal device API or interpret it as native RGB.

“Spectra35” is the project's experiment name, not a manufacturer-specified
35-color panel mode. The 35 entries identify preparation/waveform recipes;
not all pairs are proven independently distinguishable under every condition.

## Use the palette

```js
import {
  applyImageAdjustments,
  ditherCanvas,
  replaceColors,
  spectra35ExperimentalPalette,
  suggestCanvasDitherOptions,
} from 'epdoptimize';

// Fit/rotate the source to 1600 × 1200 BEFORE processing.
// input, adjusted, preview and tokens are separate canvases.
const palette = spectra35ExperimentalPalette;
const automatic = suggestCanvasDitherOptions(input, palette, { intent: 'natural' });
const options = {
  ...automatic.ditherOptions,
  palette,
  processingEngine: 'js',
  calibrate: true,
  toneMapping: { mode: 'off' },
  clarity: { amount: 0 },
  dynamicRangeCompression: { mode: 'display', strength: 1 },
  levelCompression: { mode: 'off' },
  paperNormalization: { mode: 'off' },
};
await applyImageAdjustments(input, adjusted, options);
await ditherCanvas(adjusted, preview, options);
replaceColors(preview, tokens, palette);
// preview contains appearance RGB; tokens contains IDs for the LUT adapter.
// Save tokens losslessly as PNG, without resizing or color conversion.
```

The named lookup APIs also accept `spectra35-experimental`:
`getDefaultPalettes()` returns the appearance colors and `getDeviceColors()`
returns the corresponding tokens. Use the same palette for dithering and
replacement; do not pair this palette with a Spectra6 replacement table.
`quantizationOnly` can be selected instead of automatic dithering for solid
fields. It does not synthesize additional intermediate states.

## Appearance versus output

| Recipe index | Appearance `color` | Output `deviceColor` | Meaning |
| --- | --- | --- | --- |
| 0 | `#2D263E` | `#010000` | Dark reference state, with a visible violet bias |
| 1 | `#C4BEBD` | `#010001` | Light reference state |
| 3 | `#C44F45` | `#010003` | Red recipe |
| 4 | `#2F72C7` | `#010004` | Blue recipe; **not** native image code 4 |
| 34 | `#3893D5` | `#010022` | Last recipe in this palette revision |

All 35 appearance values are copied from the November 2026 `natural35` bench
palette, in its original order. Names `C03`–`C35` are stable recipe labels, not
claims of standardized hues. The role names `black` and `white` identify
reference endpoints; the measured colors are neither ideal black nor ideal white.
The source `palette.json` SHA-256 is
`c829d104627fcf7e7666ef24b4733809fdeb0947a95900e6df537b3850bf26c0`.

The token RGB integer is `0x010000 + recipeIndex`, for indices 0–34 inclusive.
A token PNG therefore looks almost black. That is expected: it is an index
carrier, not a display preview. Require opaque pixels and reject any token
outside that range rather than choosing the nearest color. Do not resize,
JPEG-compress, interpolate, apply an ICC transform to, or re-dither token images.
The index is not a directly writable four-bit controller code.

## From tokens to a physical image

The [Panels guide](https://docs.paperlesspaper.de/panels/spectra35) supplies the
versioned recipe table, four complete 2048-byte LUTs and an offline planner:

1. Decode tokens to exact recipe indices.
2. Prepare each pixel using the recipe's native Spectra6 history.
3. Run the four LUT passes in their measured order. Each image mask selects a
   waveform bank; the final color depends on both that bank and the history.
4. Verify both controller rasters, every LUT hash and natural BUSY completion.
   A failed staging operation must not trigger a refresh or a blind replay.

Epdoptimize only computes images. This PR does not flash firmware, upload LUTs,
implement a panel driver, or make ordinary Spectra6 firmware accept 35 colors.
Source0 is an experimental hold code, not electrically verified high impedance.
The downloadable planner does not communicate with hardware.

## Calibration and limitations

The palette comes from camera observations of uniform fields, two fresh chart
builds and both controller halves, with an in-frame reference card and camera
sharpness disabled for the palette measurements. These RGB estimates are not
spectrophotometer measurements or an ICC profile. Later live comparisons use
geometry-corrected photographs without adding a color-correction matrix.

Fine 1-, 2- and 4-pixel mixtures can differ from the average of their solid
swatches. Position, illumination, pigment history, later passes and drift also
matter. Skin tones, dark neutral grays and pale pink remain difficult. The tests
do not establish 35 universally stable colors, 16 neutral grays, panel lifetime,
or calibrated absolute Source/VCOM voltages.

The later lake/flags/balcony/poster trials additionally used a linear-light
8-bit adapter, gamut compression and a source-color-dependent v3 correction.
Those scene-tuned transforms are **not baked into this palette** or the generic
example above. Selecting the palette alone does not reproduce those previews.
The five-pass bench photo builds took roughly 4–5.5 minutes, including staging,
cooldowns and an intermediate capture. This is not a 120-second photo mode.
