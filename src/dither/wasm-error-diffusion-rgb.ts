import { createPaletteGamutProjector } from "./functions/palette-gamut";
import type { ImageDataLike, RGB } from "./processing";

interface DiffusionEntry {
  offset: number[];
  factor: number;
}

interface WasmExports {
  memory: WebAssembly.Memory;
  ditherRgbErrorDiffusion: (
    dataPtr: number,
    palettePtr: number,
    paletteLength: number,
    width: number,
    height: number,
    matrixPtr: number,
    matrixLength: number,
    serpentine: number,
    errorsPtr: number,
    errorRows: number,
    sourcePtr: number,
    firstRow: number,
    endRow: number
  ) => void;
}

const WASM_BASE64 =
  "AGFzbQEAAAABEQFgDX9/f39/f39/f39/f38AAwIBAAUDAQAAByQCF2RpdGhlclJnYkVycm9yRGlmZnVzaW9uAAAGbWVtb3J5AgAKggUB/wQCCX8FfCACQQBMBEAPCwNAIAsgDEgEQCAIIAsgCW8gA2xBGGxqIRQgB0EARyIOBEAgC0EBcSEOC0F/IAMgDhshE0F/QQEgDhshEiADQQFrQQAgDhshFQNAIBMgFUcEQCADIAtsIBVqQQJ0IABqIREgFUEYbCINIBRqIQ8gCiANaiENIAoEfCANKwMABSARLQAAuAsgDysDAKAhGCAKBHwgDSsDCAUgES0AAbgLIA8rAwigIRogCgR8IA0rAxAFIBEtAAK4CyAPKwMQoCEZQQAhDUT////////vfyEXQQAhEANAIAIgEEoEQCABIBBBA2xqIg8tAAC4IBihIhYgFqIgDy0AAbggGqEiFiAWoqAgDy0AArggGaEiFiAWoqCfIhYgF2MEQCAWIRcgECENCyAQQQFqIRAMAQsLIAEgDUEDbGoiDS0AACEQIA0tAAEhDyANLQACIQ0gESAQOgAAIBEgDzoAASARIA06AAIgEUH/AToAAyAYIBC4oSIWRAAAAAAA4G9AIBaZIBogD7ihIhiZIBkgDbihIheZpaVEAAAAAADgb0CloyIWoiEZIBggFqIhGCAXIBaiIRdBACENA0AgBiANSgRAIAUgDUEYbGoiESsDAPwCIQ8gESsDECEWQQAgD2sgDyAOGyAVaiIQQQBIIAMgEExyIBErAwj8AiALaiIPQQBIciAEIA9MckUEQCAIIA8gCW8gA2wgEGpBGGxqIg8gDysDACAZIBaioDkDACAPIA8rAwggGCAWoqA5AwggDyAPKwMQIBcgFqKgOQMQCyANQQFqIQ0MAQsLIBIgFWohFQwBCwsgFEEAIANBGGz8CwAgC0EBaiELDAELCws=";

let exportsPromise: Promise<WasmExports | null> | null = null;

const align = (value: number, boundary: number) =>
  Math.ceil(value / boundary) * boundary;

const decodeBase64 = (base64: string) => {
  if (typeof atob === "function") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  const bufferCtor = (
    globalThis as unknown as {
      Buffer?: { from(value: string, encoding: string): Uint8Array };
    }
  ).Buffer;
  if (bufferCtor) return new Uint8Array(bufferCtor.from(base64, "base64"));

  throw new Error("No base64 decoder is available for the WASM module.");
};

const getWasmExports = async (): Promise<WasmExports | null> => {
  if (typeof WebAssembly === "undefined") return null;
  if (!exportsPromise) {
    exportsPromise = WebAssembly.instantiate(decodeBase64(WASM_BASE64), {})
      .then((result) => result.instance.exports as unknown as WasmExports)
      .catch(() => null);
  }
  return exportsPromise;
};

const ensureMemory = (memory: WebAssembly.Memory, byteLength: number) => {
  const requiredPages = Math.ceil(byteLength / 65536);
  const currentPages = memory.buffer.byteLength / 65536;
  if (requiredPages > currentPages) memory.grow(requiredPages - currentPages);
};

export const applyWasmRgbErrorDiffusion = async (
  image: ImageDataLike,
  colorPalette: RGB[],
  diffusionMap: DiffusionEntry[],
  serpentine: boolean
) => {
  if (!colorPalette.length) return false;

  const wasmExports = await getWasmExports();
  if (!wasmExports) return false;

  const { memory, ditherRgbErrorDiffusion } = wasmExports;
  const dataByteLength = image.data.byteLength;
  const paletteByteLength = colorPalette.length * 3;
  const matrixByteLength = diffusionMap.length * 24;
  const dataPtr = 0;
  const palettePtr = align(dataPtr + dataByteLength, 8);
  const matrixPtr = align(palettePtr + paletteByteLength, 8);
  const errorsPtr = matrixPtr + matrixByteLength;
  const errorRows = Math.min(
    image.height,
    1 + Math.max(0, ...diffusionMap.map((d) => d.offset[1]))
  );
  const errorLength = image.width * errorRows * 3;
  const project = createPaletteGamutProjector(colorPalette, image.width * image.height);
  const sourcePtr = errorsPtr + errorLength * 8;
  // One source row rather than an additional image-sized Float64 allocation.
  const totalBytes = sourcePtr + (project ? image.width * 3 * 8 : 0);

  ensureMemory(memory, totalBytes);

  const bytes = new Uint8Array(memory.buffer);
  bytes.set(image.data, dataPtr);

  let paletteIndex = palettePtr;
  for (const color of colorPalette) {
    bytes[paletteIndex] = color[0];
    bytes[paletteIndex + 1] = color[1];
    bytes[paletteIndex + 2] = color[2];
    paletteIndex += 3;
  }

  const floats = new Float64Array(memory.buffer);
  // The module is reused across calls: never retain errors from another image.
  floats.fill(0, errorsPtr / 8, errorsPtr / 8 + errorLength);
  let matrixIndex = matrixPtr / 8;
  for (const diffusion of diffusionMap) {
    floats[matrixIndex] = diffusion.offset[0];
    floats[matrixIndex + 1] = diffusion.offset[1];
    floats[matrixIndex + 2] = diffusion.factor;
    matrixIndex += 3;
  }

  const run = (firstRow: number, endRow: number, projectedPtr: number) =>
    ditherRgbErrorDiffusion(
      dataPtr, palettePtr, colorPalette.length, image.width, image.height,
      matrixPtr, diffusionMap.length, serpentine ? 1 : 0, errorsPtr, errorRows,
      projectedPtr, firstRow, endRow
    );
  if (project) {
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const p = (y * image.width + x) * 4;
        project(image.data[p], image.data[p + 1], image.data[p + 2], floats, sourcePtr / 8 + x * 3);
      }
      run(y, y + 1, sourcePtr);
    }
  } else {
    run(0, image.height, 0);
  }

  image.data.set(bytes.subarray(dataPtr, dataPtr + dataByteLength));
  return true;
};
