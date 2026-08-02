# Copilot instructions for `epdoptimize`

## Build, typecheck, and validation commands

Run from repository root:

```bash
npm ci
npm run build
npm run typecheck
```

Library and examples:

```bash
# Build JS bundles + .d.ts (published output)
npm run build

# Build only JS bundles with Vite
npm run build:js

# Build only TypeScript declarations
npm run build:types

# Build examples site into dist/examples
npm run build:examples

# Run examples/dev playground (Fabric + rating tool)
npm run examples:dev
```

WASM-specific path (only when changing WASM error diffusion code):

```bash
npm run build:wasm
```

There is currently **no `npm test` script** and **no lint script** in `package.json`, so there is no built-in single-test command in this repository today.

## High-level architecture

### 1) Public API surface (`src/index.ts`)

`src/index.ts` is the single export surface. It re-exports:

- Palette helpers and built-in palette constants
- Main pipeline APIs: `ditherImage`, `ditherCanvas`, `applyImageAdjustments*`
- Auto recommendation APIs from `src/auto-processing.ts`
- Image classification APIs from `src/image-style.ts`
- `replaceColors` final device-color mapping

When adding/removing APIs, wire them through `src/index.ts` so package consumers can import them.

### 2) Image pipeline split (`src/dither/dither.ts` + `src/dither/processing.ts`)

The core flow is intentionally staged:

1. **Adjustment stage** (`applyImageProcessing` in `processing.ts`): paper normalization, clarity, tone mapping, dynamic range compression, level compression.
2. **Dither stage** (`ditherImageData` in `dither.ts`): quantization / ordered / random / error diffusion / utility-based algorithms.
3. **Optional post-processing**: edge preservation and edge antialiasing cleanup.
4. **Final mapping stage** (`src/replaceColors/replaceColors.ts`): calibrated palette colors -> device colors.

`ditherImage()` runs adjustments + dithering; `ditherCanvas()` only runs dithering; `applyImageAdjustments*()` only runs the adjustment stage.

### 3) Engine selection and fallbacks

- `processingEngine: "wasm" | "auto"` currently accelerates **RGB error diffusion only**; unsupported combinations fall back to JS.
- `adjustmentEngine: "auto"` can offload adjustment work to a Worker for large images (`src/dither/adjustment-async.ts`).
- Worker code (`src/dither/adjustment-worker.ts`) forces `adjustmentEngine: "js"` inside the worker path to avoid nested worker recursion.

### 4) Auto recommendation subsystem (`src/image-style.ts` + `src/auto-processing.ts`)

- `classifyImageStyle` computes heuristics/metrics and emits `kind` + confidence.
- Auto APIs build recommended `ditherOptions` from classification + palette profile + intent.
- Two strategies exist: `"legacy"` and `"layered"`.
- Split helpers (`suggestCanvasImageAdjustmentOptions`, `suggestCanvasDitherOptions`) are used for editor workflows that keep image-stage and canvas-stage settings separate.

### 5) Palette model and role ordering

- Default palette data lives in `src/dither/data/default-palettes.json`.
- Palette entries are `{ name, color, deviceColor }`.
- `color` is the calibrated display appearance for dithering; `deviceColor` is the native panel color for export.
- `src/dither/functions/palette-order.ts` enforces canonical role ordering (black/gray/white/colors), and palette keys are normalized case-insensitively.

## Key repository conventions

- **Use combined palette entries** (`{ name, color, deviceColor }`) as the primary format. The legacy `{ originalColors, replaceColors }` shape is only for backward compatibility.
- **Keep adjustment and dithering concerns separate** in editor integrations (also documented in `FABRIC_FILTER_README.md`): per-image adjustment controls first, whole-canvas dithering/export second.
- **Preserve preset key behavior** in `PROCESSING_PRESETS`: lookup is lowercase (`getProcessingPreset(String(name).toLowerCase())`), while preset `name` values keep public API casing (for example `posterScan` name with `posterscan` key).
- **Do not bypass role-aware palette alignment** when mixing calibration and device palettes; use existing palette-order helpers so role mapping remains stable.
- **`replaceColors` expects exact calibrated color matches** in source pixels and warns when pixels cannot be replaced; do not introduce fuzzy matching without explicit design changes.
- **Examples app routing/deploy assumes `/epdoptimize/` base** (`examples/vite.config.js`), and the rating tool persists votes to `examples/rating-data/pairwise-votes.jsonl` (+ JSON snapshot).
