import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  detectTextAndGraphics,
  ditherImage,
  ditherCanvas,
  applyImageAdjustments,
  replaceColors,
  aitjcizeSpectra6Palette as palette,
} from "../dist/index.mjs";

function canvas(width, height, pixel = () => [255, 255, 255, 255]) {
  const c = { width, height, data: new Uint8ClampedArray(width * height * 4) };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const rgb = pixel(x, y);
      c.data.set([rgb[0], rgb[1], rgb[2], rgb[3] ?? 255], (y * width + x) * 4);
    }
  c.getContext = () => ({
    getImageData: () => ({
      width: c.width,
      height: c.height,
      data: c.data.slice(),
      [Symbol.toStringTag]: "ImageData",
    }),
    putImageData: (im) => {
      c.width = im.width;
      c.height = im.height;
      c.data = im.data.slice();
    },
  });
  return c;
}
const defaults = {
  palette,
  ditheringType: "errorDiffusion",
  serpentine: true,
  processingEngine: "js",
};
async function render(source, options = {}) {
  const dest = canvas(source.width, source.height);
  await ditherImage(source, dest, { ...defaults, ...options });
  return dest;
}
const key = (data, p) => [...data.slice(p * 4, p * 4 + 3)].join(",");
const texture = (x, y) => [
  (x * 71 + y * 31) % 256,
  (x * 29 + y * 83) % 256,
  (x * 113 + y * 47) % 256,
];
function mixed(color = [205, 63, 91]) {
  return canvas(120, 96, (x, y) => {
    if (y >= 48) return texture(x, y);
    // Two H-shaped colored glyphs on a light blue background.
    const xx = x % 40;
    return y >= 8 &&
      y < 40 &&
      ((xx >= 8 && xx < 14) ||
        (xx >= 26 && xx < 32) ||
        (y >= 21 && y < 27 && xx >= 8 && xx < 32))
      ? color
      : [202, 219, 237];
  });
}

test("finds colored, pastel, dark and equal-luminance graphics without color-role assumptions", () => {
  for (const color of [
    [205, 63, 91],
    [28, 99, 204],
    [245, 186, 55],
    [141, 66, 155],
    [100, 100, 100],
    [246, 158, 200],
  ]) {
    const source = mixed(color),
      original = source.data.slice();
    const result = detectTextAndGraphics(source);
    let text = 0,
      protectedText = 0,
      protectedTexture = 0;
    for (let p = 0; p < 120 * 96; p++) {
      if (key(source.data, p) === color.join(",")) {
        text++;
        protectedText += result.mask[p];
      }
      if (Math.floor(p / 120) >= 52) protectedTexture += result.mask[p];
    }
    assert.ok(protectedText / text > 0.98, color.join(","));
    assert.equal(protectedTexture, 0);
    assert.deepEqual(source.data, original);
    assert.deepEqual(detectTextAndGraphics(source), result);
  }
  const equalLuma = canvas(80, 40, (x) =>
    x < 40 ? [220, 30, 30] : [30, 86, 30],
  );
  assert.equal(detectTextAndGraphics(equalLuma).protectedPixels, 80 * 40);
});

test("smooth grayscale/color ramps and textured input are not protected", () => {
  for (const source of [
    canvas(256, 80, (x) => [x, x, x]),
    canvas(256, 80, (x) => [x, 255 - x, 120]),
    canvas(256, 80, (x, y) => [x, y * 3, 180]),
    canvas(120, 96, texture),
  ])
    assert.equal(detectTextAndGraphics(source).protectedPixels, 0);
});

test("low-contrast graphics require explicit relaxed detection", () => {
  const source = mixed([238, 190, 205]);
  const conservative = detectTextAndGraphics(source);
  const relaxed = detectTextAndGraphics(source, { edgeContrast: 24 });
  // A known foreground pixel: default protection does not claim certainty.
  assert.equal(conservative.mask[12 * 120 + 10], 0);
  assert.equal(relaxed.mask[12 * 120 + 10], 1);
});

test("antialiased color fringes are protected without blindly dilating into a gradient", () => {
  const source = canvas(80, 32, (x) => {
    if (x < 25) return [220, 30, 80];
    if (x === 25) return [185, 70, 110];
    if (x === 26) return [115, 150, 170];
    return [80, 190, 200];
  });
  const result = detectTextAndGraphics(source);
  for (let y = 0; y < 32; y++) {
    assert.equal(result.mask[y * 80 + 25], 1);
    assert.equal(result.mask[y * 80 + 26], 1);
  }
});

test("disabled option preserves existing output byte for byte", async () => {
  const source = mixed();
  const baseline = (await render(source)).data;
  for (const protectTextAndGraphics of [false, { enabled: false }])
    assert.deepEqual(
      (await render(source, { protectTextAndGraphics })).data,
      baseline,
    );
  const ramp = canvas(256, 24, (x) => [x, 255 - x, x]);
  assert.deepEqual(
    (await render(ramp, { protectTextAndGraphics: true })).data,
    (await render(ramp)).data,
  );
});

test("protected pixels match direct quantization with every dither mode", async () => {
  const source = mixed();
  const mask = detectTextAndGraphics(source).mask;
  const quantized = await render(source, { ditheringType: "quantizationOnly" });
  for (const ditheringType of [
    "errorDiffusion",
    "ordered",
    "random",
    "hueMix",
    "blueNoise",
    "simple2D",
    "riemersma",
    "ditherItErrorDiffusion",
    "ditherItOrdered",
    "ditherItBlueNoise",
    "ditherItSimple2D",
    "ditherItRiemersma",
    "quantizationOnly",
  ]) {
    const result = await render(source, {
      ditheringType,
      protectTextAndGraphics: true,
    });
    for (let p = 0; p < mask.length; p++)
      if (mask[p]) {
        assert.equal(
          key(result.data, p),
          key(quantized.data, p),
          `${ditheringType} pixel ${p}`,
        );
      }
  }
});

test("protected colors cannot emit error into neighboring unprotected content", async () => {
  const make = (color) =>
    canvas(96, 48, (x, y) => (x < 32 ? color : texture(x, y)));
  const a = make([200, 30, 50]),
    b = make([220, 40, 65]);
  assert.deepEqual(
    detectTextAndGraphics(a).mask,
    detectTextAndGraphics(b).mask,
  );
  for (const ditheringType of [
    "errorDiffusion",
    "simple2D",
    "riemersma",
    "ditherItErrorDiffusion",
  ]) {
    for (const colorMatching of ["rgb", "lab"]) {
      const opts = {
        ditheringType,
        colorMatching,
        protectTextAndGraphics: true,
      };
      const aa = await render(a, opts),
        bb = await render(b, opts);
      for (let y = 0; y < 48; y++)
        for (let x = 32; x < 96; x++)
          assert.equal(
            key(aa.data, y * 96 + x),
            key(bb.data, y * 96 + x),
            `${ditheringType}/${colorMatching}`,
          );
    }
  }
});

test("palette membership, engines, kernels, color matchers and device export", async () => {
  const source = mixed();
  const opts = { protectTextAndGraphics: true };
  const js = await render(source, opts);
  for (const processingEngine of ["auto", "wasm"])
    assert.deepEqual(
      (await render(source, { ...opts, processingEngine })).data,
      js.data,
    );
  for (const colorMatching of ["rgb", "lab", "chroma"]) {
    const quantized = await render(source, {
      colorMatching,
      ditheringType: "quantizationOnly",
    });
    const mask = detectTextAndGraphics(source).mask;
    for (const errorDiffusionMatrix of [
      "floydSteinberg",
      "atkinson",
      "stucki",
    ]) {
      const result = await render(source, {
        ...opts,
        colorMatching,
        errorDiffusionMatrix,
      });
      const allowed = new Set(
        palette.map((p) =>
          p.color
            .slice(1)
            .match(/../g)
            .map((v) => parseInt(v, 16))
            .join(","),
        ),
      );
      for (let p = 0; p < mask.length; p++) {
        assert.ok(allowed.has(key(result.data, p)));
        if (mask[p]) assert.equal(key(result.data, p), key(quantized.data, p));
      }
    }
  }
  const device = canvas(source.width, source.height);
  replaceColors(js, device, palette);
  const deviceAllowed = new Set(
    palette.map((p) =>
      p.deviceColor
        .slice(1)
        .match(/../g)
        .map((v) => parseInt(v, 16))
        .join(","),
    ),
  );
  for (let p = 0; p < source.width * source.height; p++)
    assert.ok(deviceAllowed.has(key(device.data, p)));
});

test("protection wins over edge postprocessing and agrees in split/combined pipelines", async () => {
  const source = mixed();
  const options = {
    ...defaults,
    protectTextAndGraphics: true,
    toneMapping: { mode: "contrast", contrast: 0.1 },
    edgePreservation: { enabled: true },
    edgeAntialiasing: { enabled: true, strength: 1 },
  };
  const adjusted = canvas(120, 96),
    split = canvas(120, 96);
  await applyImageAdjustments(source, adjusted, options);
  await ditherCanvas(adjusted, split, options);
  assert.deepEqual(split.data, (await render(source, options)).data);
  const quantized = canvas(120, 96);
  await ditherCanvas(adjusted, quantized, {
    ...defaults,
    ditheringType: "quantizationOnly",
  });
  const mask = detectTextAndGraphics(adjusted).mask;
  for (let p = 0; p < mask.length; p++)
    if (mask[p]) assert.equal(key(split.data, p), key(quantized.data, p));
});

test("transparent pixels, tiny images, invalid input and custom palettes", async () => {
  assert.equal(detectTextAndGraphics(canvas(0, 0)).protectedPixels, 0);
  assert.equal(detectTextAndGraphics(canvas(1, 1)).protectedPixels, 0);
  assert.equal(
    detectTextAndGraphics(canvas(30, 30, () => [220, 20, 30, 0]))
      .protectedPixels,
    0,
  );
  assert.equal(
    detectTextAndGraphics(canvas(30, 30, () => [220, 20, 30, 128]))
      .protectedPixels,
    0,
  );
  assert.throws(
    () =>
      detectTextAndGraphics({
        width: 5,
        height: 4,
        data: new Uint8ClampedArray(4),
      }),
    RangeError,
  );
  const source = mixed();
  for (const custom of [
    [],
    ["#000000"],
    ["#000000", "#ffffff"],
    ["#000000", "#b20044", "#ffddee"],
  ]) {
    const result = await render(source, {
      palette: custom,
      protectTextAndGraphics: true,
    });
    if (!custom.length) assert.deepEqual(result.data, source.data);
    else {
      const allowed = new Set(
        custom.map((p) =>
          p
            .slice(1)
            .match(/../g)
            .map((v) => parseInt(v, 16))
            .join(","),
        ),
      );
      for (let p = 0; p < source.width * source.height; p++)
        assert.ok(allowed.has(key(result.data, p)));
    }
  }
});

test("region grouping removes photo islands and completes small text in any layout direction", () => {
  const width = 192,
    height = 144;
  const source = canvas(width, height, (x, y) => {
    if (y < 72) {
      // An actual flat patch inside textured content fooled the pixel detector.
      if (x >= 80 && x < 88 && y >= 30 && y < 36) return [220, 20, 40];
      return texture(x, y);
    }
    // Tiny disconnected strokes with antialiasing, each below minRegionPixels.
    if (y >= 100 && y < 105 && x > 16 && x < 176 && x % 8 === 0)
      return [40, 80, 150];
    if (y >= 100 && y < 105 && x > 16 && x < 176 && x % 8 === 1)
      return [145, 165, 200];
    return [250, 250, 250];
  });
  const raw = detectTextAndGraphics(source, { regionGrouping: false });
  assert.equal(
    raw.mask[32 * width + 83],
    1,
    "fixture exercises a false-positive photo patch",
  );
  assert.equal(
    raw.mask[102 * width + 32],
    0,
    "fixture exercises missing small lettering",
  );

  for (const orientation of ["top", "bottom", "left", "right"]) {
    const vertical = orientation === "left" || orientation === "right";
    const transformed = canvas(
      vertical ? height : width,
      vertical ? width : height,
      (x, y) => {
        const sx = vertical ? y : x;
        const sy =
          orientation === "top"
            ? y
            : orientation === "bottom"
              ? height - 1 - y
              : orientation === "left"
                ? x
                : height - 1 - x;
        return [
          ...source.data.slice(
            (sy * width + sx) * 4,
            (sy * width + sx) * 4 + 4,
          ),
        ];
      },
    );
    const result = detectTextAndGraphics(transformed);
    for (let y = 0; y < transformed.height; y++)
      for (let x = 0; x < transformed.width; x++) {
        const sy =
          orientation === "top"
            ? y
            : orientation === "bottom"
              ? height - 1 - y
              : orientation === "left"
                ? x
                : height - 1 - x;
        assert.equal(
          result.mask[y * transformed.width + x],
          sy < 72 ? 0 : 1,
          `${orientation}: ${x},${y}`,
        );
      }
    assert.equal(result.regionCount, 1);
  }
});

test("region grouping keeps inset color and grayscale photos out of a text block", () => {
  for (const monochrome of [false, true]) {
    const source = canvas(192, 144, (x, y) => {
      if (x >= 70 && x < 102 && y >= 50 && y < 82) {
        const color = texture(x, y);
        return monochrome ? [color[0], color[0], color[0]] : color;
      }
      if (x >= 10 && x < 20 && y > 15 && y < 30) return [30, 80, 180];
      return [255, 255, 255];
    });
    const result = detectTextAndGraphics(source);
    for (let y = 50; y < 82; y++)
      for (let x = 70; x < 102; x++) {
        assert.equal(
          result.mask[y * 192 + x],
          0,
          `thumbnail ${monochrome}: ${x},${y}`,
        );
      }
    assert.equal(result.mask[120 * 192 + 150], 1);
  }
});

test("grouping preserves gradient insets and transparent holes", () => {
  const source = canvas(160, 128, (x, y) => {
    if (x >= 60 && x < 100 && y >= 40 && y < 80)
      return [(x - 60) * 6, 120, 255 - (x - 60) * 6];
    if (x >= 120 && x < 136 && y >= 90 && y < 106) return [30, 40, 60, 128];
    if (x >= 10 && x < 20 && y >= 10 && y < 30) return [20, 40, 80];
    return [255, 255, 255];
  });
  const result = detectTextAndGraphics(source);
  for (let y = 40; y < 80; y++)
    for (let x = 60; x < 100; x++) assert.equal(result.mask[y * 160 + x], 0);
  for (let y = 90; y < 106; y++)
    for (let x = 120; x < 136; x++) assert.equal(result.mask[y * 160 + x], 0);
  assert.equal(result.mask[110 * 160 + 50], 1);
});

test("real cutout illustration remains dithered while all separate text blocks are protected", () => {
  for (const landscape of [false, true]) {
    const name = landscape ? "bird-landscape" : "bird";
    const width = landscape ? 800 : 480, height = landscape ? 480 : 800;
    const rgba = gunzipSync(readFileSync(new URL(`./fixtures/${name}.rgba.gz`, import.meta.url)));
    // Both placements and inverted colors must work; these are evaluation
    // regions only, never inputs to detection.
    for (const invert of [false, true]) {
      const source = canvas(width, height, (x, y) => {
        const i = (y * width + x) * 4;
        return [...rgba.subarray(i, i + 3)].map(v => invert ? 255 - v : v);
      });
      const result = detectTextAndGraphics(source);
      let illustrationPixels = 0;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const p = y * width + x;
        const text = landscape ? y < 100 || y >= 340 : y < 160 || y >= 510;
        if (text) assert.equal(result.mask[p], 1, `${name}/${invert}: lettering or background ${x},${y}`);
        // Non-white pixels in the independently bounded illustration band,
        // including the pale breast, must never become protected islands.
        if (!text && Math.min(...rgba.subarray(p * 4, p * 4 + 3)) < 230) {
          illustrationPixels++;
          assert.equal(result.mask[p], 0, `${name}/${invert}: illustration ${x},${y}`);
        }
      }
      assert.ok(illustrationPixels > 10000);
    }
  }
});

test("lossless colored layouts recover text around a soft-edged illustration", () => {
  for (const bg of [[255, 255, 255], [225, 205, 240], [20, 30, 40]]) {
    const dark = bg[0] > 100;
    const fg = dark ? [20, 45, 75] : [235, 210, 180];
    const source = canvas(256, 192, (x, y) => {
      const xx = (x - 20) % 34;
      if (x >= 20 && x < 224 && y >= 10 && y < 25 &&
          (xx < 3 || (xx >= 15 && xx < 18) || (y >= 16 && y < 19 && xx < 18))) return fg;
      const distance = Math.hypot(x - 128, y - 115);
      if (distance < 48) {
        const t = (1 - distance / 48) * (0.65 + 0.3 * Math.sin(x * 0.7) ** 2);
        return bg.map((v, c) => Math.round(v + (fg[c] - v) * t));
      }
      return bg;
    });
    const result = detectTextAndGraphics(source);
    for (let y = 0; y < 40; y++) for (let x = 0; x < 256; x++)
      assert.equal(result.mask[y * 256 + x], 1, `text ${bg}: ${x},${y}`);
    for (let y = 80; y < 150; y++) for (let x = 95; x < 160; x++)
      if (Math.hypot(x - 128, y - 115) < 30)
        assert.equal(result.mask[y * 256 + x], 0, `illustration ${bg}: ${x},${y}`);
    // A cutout on a uniform background alone is not evidence of a text layout.
    for (let y = 0; y < 40; y++) for (let x = 0; x < 256; x++)
      source.data.set([...bg, 255], (y * 256 + x) * 4);
    assert.equal(detectTextAndGraphics(source).protectedPixels, 0);
  }
});
