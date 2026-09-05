import { parseCustomResolution } from "./custom-resolution";
import {
  DEFAULT_DEVICE_TEST_CONFIG,
  DEVICE_TEST_STORAGE_KEY,
  SCREEN_RESOLUTIONS,
} from "./constants";
import {
  customWidthInput,
  customHeightInput,
  customResolutionStatus,
  apiKeyInput,
  deviceColorsCanvas,
  deviceTestStatus,
  imageFitSelect,
  orientationSelect,
  outputCanvas,
  paperIdInput,
  screenResolutionSelect,
  testOnDeviceButton,
} from "./elements";
import type { ImageFitMode, ScreenOrientation } from "./types";

let customResolution = parseCustomResolution(800, 480);

export function updateCustomResolution() {
  try {
    const next = parseCustomResolution(customWidthInput.value, customHeightInput.value);
    customResolution = next;
    customResolutionStatus.textContent = "Width and height set the exact output size.";
    customWidthInput.removeAttribute("aria-invalid");
    customHeightInput.removeAttribute("aria-invalid");
    return true;
  } catch (error) {
    customResolutionStatus.textContent = (error as Error).message;
    customWidthInput.setAttribute("aria-invalid", "true");
    customHeightInput.setAttribute("aria-invalid", "true");
    return false;
  }
}

export function getDeviceTestConfig() {
  return {
    screenResolution: screenResolutionSelect.value,
    customWidth: customResolution.width,
    customHeight: customResolution.height,
    orientation: getSelectedOrientation(),
    imageFit: getSelectedImageFit(),
    paperId: paperIdInput.value.trim(),
    apiKey: apiKeyInput.value.trim(),
  };
}

export function getSelectedScreenResolution() {
  if (screenResolutionSelect.value === "custom") return customResolution;
  return (
    SCREEN_RESOLUTIONS[
      screenResolutionSelect.value as keyof typeof SCREEN_RESOLUTIONS
    ] ?? SCREEN_RESOLUTIONS.openpaper7
  );
}

export function getSelectedOrientation(): ScreenOrientation {
  if (orientationSelect.value === "original") return "original";
  return orientationSelect.value === "portrait" ? "portrait" : "landscape";
}

export function getOriginalImageOrientation(
  img: HTMLImageElement,
): ScreenOrientation {
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  return height > width ? "portrait" : "landscape";
}

export function getDeviceUploadOrientation(): Exclude<
  ScreenOrientation,
  "original"
> {
  return "landscape";
}

export function getSelectedImageFit(): ImageFitMode {
  return imageFitSelect.value === "cover" ? "cover" : "contain";
}

export function loadDeviceTestConfig() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(DEVICE_TEST_STORAGE_KEY) || "{}",
    );
    try { customResolution = parseCustomResolution(saved.customWidth, saved.customHeight); }
    catch { customResolution = parseCustomResolution(800, 480); }
    customWidthInput.value = String(customResolution.width);
    customHeightInput.value = String(customResolution.height);
    screenResolutionSelect.value =
      typeof saved.screenResolution === "string" &&
      (saved.screenResolution === "custom" || Object.prototype.hasOwnProperty.call(SCREEN_RESOLUTIONS, saved.screenResolution))
        ? saved.screenResolution
        : DEFAULT_DEVICE_TEST_CONFIG.screenResolution;
    orientationSelect.value =
      saved.orientation === "portrait" || saved.orientation === "original"
        ? saved.orientation
        : DEFAULT_DEVICE_TEST_CONFIG.orientation;
    imageFitSelect.value =
      saved.imageFit === "cover" || saved.imageFit === "contain"
        ? saved.imageFit
        : DEFAULT_DEVICE_TEST_CONFIG.imageFit;
    paperIdInput.value =
      typeof saved.paperId === "string"
        ? saved.paperId
        : DEFAULT_DEVICE_TEST_CONFIG.paperId;
    apiKeyInput.value =
      typeof saved.apiKey === "string"
        ? saved.apiKey
        : DEFAULT_DEVICE_TEST_CONFIG.apiKey;
  } catch {
    screenResolutionSelect.value = DEFAULT_DEVICE_TEST_CONFIG.screenResolution;
    orientationSelect.value = DEFAULT_DEVICE_TEST_CONFIG.orientation;
    imageFitSelect.value = DEFAULT_DEVICE_TEST_CONFIG.imageFit;
    paperIdInput.value = DEFAULT_DEVICE_TEST_CONFIG.paperId;
    apiKeyInput.value = DEFAULT_DEVICE_TEST_CONFIG.apiKey;
  }
}

export function saveDeviceTestConfig() {
  localStorage.setItem(
    DEVICE_TEST_STORAGE_KEY,
    JSON.stringify(getDeviceTestConfig()),
  );
}

export function setDeviceTestStatus(
  message: string,
  state: "idle" | "success" | "error" = "idle",
) {
  deviceTestStatus.textContent = message;
  deviceTestStatus.dataset.state = state;
}

export async function testOnDevice() {
  const { paperId, apiKey } = getDeviceTestConfig();

  if (!paperId) {
    setDeviceTestStatus("Missing paper ID.", "error");
    return;
  }

  if (!apiKey) {
    setDeviceTestStatus("Missing x-api-key.", "error");
    return;
  }

  if (deviceColorsCanvas.width === 0 || deviceColorsCanvas.height === 0) {
    setDeviceTestStatus("No device image to upload.", "error");
    return;
  }

  testOnDeviceButton.disabled = true;
  setDeviceTestStatus("Uploading...");

  try {
    const pictureBlob = await canvasToLandscapePngBlob(outputCanvas);
    const pictureDeviceBlob = await canvasToLandscapePngBlob(deviceColorsCanvas);
    const formData = new FormData();
    formData.append("picture", pictureBlob, "epdoptimize-dithered.png");
    formData.append(
      "pictureDevice",
      pictureDeviceBlob,
      "epdoptimize-device.png",
    );
    formData.append(
      "settings",
      JSON.stringify({
        meta: {
          orientation: getDeviceUploadOrientation(),
        },
      }),
    );

    const response = await fetch(
      `https://api.paperlesspaper.de/v1/papers/uploadSingleImage/${encodeURIComponent(
        paperId,
      )}`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "x-api-key": apiKey,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        errorText || `Upload failed with status ${response.status}.`,
      );
    }

    setDeviceTestStatus("Sent to device.", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    setDeviceTestStatus(message, "error");
  } finally {
    testOnDeviceButton.disabled = false;
  }
}

function canvasToLandscapePngBlob(canvas: HTMLCanvasElement) {
  return canvasToPngBlob(getLandscapeCanvas(canvas));
}

function getLandscapeCanvas(canvas: HTMLCanvasElement) {
  if (canvas.width >= canvas.height) return canvas;

  const landscapeCanvas = document.createElement("canvas");
  landscapeCanvas.width = canvas.height;
  landscapeCanvas.height = canvas.width;

  const ctx = landscapeCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create landscape canvas.");
  }

  ctx.translate(landscapeCanvas.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(canvas, 0, 0);

  return landscapeCanvas;
}

function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Could not create PNG from canvas."));
    }, "image/png");
  });
}
