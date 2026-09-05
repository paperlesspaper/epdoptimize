import { applyImageAdjustments, ditherCanvas, replaceColors } from "../../src";
import type { CanvasLike, DitherImageOptions, PaletteColorEntry } from "../../src";

interface ProcessRequest {
  id: number;
  imageData: ImageData;
  options: DitherImageOptions;
  adjustmentOptions?: DitherImageOptions;
  palette: PaletteColorEntry[];
}

interface ProcessResponse {
  id: number;
  adjustedImageData?: ImageData;
  ditheredImageData?: ImageData;
  deviceImageData?: ImageData;
  error?: string;
}

const postWorkerMessage = (
  response: ProcessResponse,
  transfer?: Transferable[],
) => {
  (self as unknown as {
    postMessage(message: ProcessResponse, transfer?: Transferable[]): void;
  }).postMessage(response, transfer);
};

interface MemoryCanvas extends CanvasLike {
  imageData: ImageData;
}

const cloneImageData = (imageData: ImageData) =>
  new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height,
  );

const createMemoryCanvas = (imageData: ImageData): MemoryCanvas => {
  const canvas = {
    width: imageData.width,
    height: imageData.height,
    imageData,
    getContext() {
      return {
        getImageData() {
          return cloneImageData(canvas.imageData);
        },
        putImageData(nextImageData: ImageData) {
          canvas.width = nextImageData.width;
          canvas.height = nextImageData.height;
          canvas.imageData = nextImageData;
        },
      };
    },
  };

  return canvas;
};

self.addEventListener("message", async (event: MessageEvent<ProcessRequest>) => {
  const { id, imageData, options, adjustmentOptions = options, palette } = event.data;

  try {
    const sourceCanvas = createMemoryCanvas(imageData);
    const adjustedCanvas = createMemoryCanvas(cloneImageData(imageData));
    const ditheredCanvas = createMemoryCanvas(cloneImageData(imageData));
    const deviceCanvas = createMemoryCanvas(cloneImageData(imageData));

    await applyImageAdjustments(sourceCanvas, adjustedCanvas, {
      ...adjustmentOptions,
      palette,
    });
    await ditherCanvas(adjustedCanvas, ditheredCanvas, {
      ...options,
      palette,
    });
    replaceColors(ditheredCanvas, deviceCanvas, palette);

    const adjustedImageData = adjustedCanvas.imageData;
    const ditheredImageData = ditheredCanvas.imageData;
    const deviceImageData = deviceCanvas.imageData;
    const response: ProcessResponse = {
      id,
      adjustedImageData,
      ditheredImageData,
      deviceImageData,
    };

    postWorkerMessage(response, [
      adjustedImageData.data.buffer,
      ditheredImageData.data.buffer,
      deviceImageData.data.buffer,
    ]);
  } catch (error) {
    const response: ProcessResponse = {
      id,
      error: error instanceof Error ? error.message : "Worker processing failed.",
    };
    postWorkerMessage(response);
  }
});
