// Experimental RGB-only error diffusion kernel.
// This mirrors the JavaScript RGB palette matching path byte-for-byte.

export function ditherRgbErrorDiffusion(
  dataPtr: i32,
  palettePtr: i32,
  paletteLength: i32,
  width: i32,
  height: i32,
  matrixPtr: i32,
  matrixLength: i32,
  serpentine: i32,
  errorsPtr: i32,
  errorRows: i32
): void {
  if (paletteLength <= 0) return;

  for (let y: i32 = 0; y < height; y += 1) {
    const errorRowPtr = errorsPtr + (y % errorRows) * width * 24;
    const reverse = serpentine != 0 && (y & 1) == 1;
    const xStart: i32 = reverse ? width - 1 : 0;
    const xEnd: i32 = reverse ? -1 : width;
    const xStep: i32 = reverse ? -1 : 1;

    for (let x: i32 = xStart; x != xEnd; x += xStep) {
      const currentPixel = (y * width + x) << 2;
      const currentPtr = dataPtr + currentPixel;
      const errorPtr = errorRowPtr + x * 24;
      const oldR = <f64>load<u8>(currentPtr) + load<f64>(errorPtr);
      const oldG = <f64>load<u8>(currentPtr + 1) + load<f64>(errorPtr + 8);
      const oldB = <f64>load<u8>(currentPtr + 2) + load<f64>(errorPtr + 16);

      let closestIndex: i32 = 0;
      let closestDistance = f64.MAX_VALUE;

      for (let paletteIndex: i32 = 0; paletteIndex < paletteLength; paletteIndex += 1) {
        const colorPtr = palettePtr + paletteIndex * 3;
        const dr = <f64>load<u8>(colorPtr) - <f64>oldR;
        const dg = <f64>load<u8>(colorPtr + 1) - <f64>oldG;
        const db = <f64>load<u8>(colorPtr + 2) - <f64>oldB;
        const distance = Math.sqrt(dr * dr + dg * dg + db * db);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = paletteIndex;
        }
      }

      const closestPtr = palettePtr + closestIndex * 3;
      const newR = load<u8>(closestPtr);
      const newG = load<u8>(closestPtr + 1);
      const newB = load<u8>(closestPtr + 2);

      store<u8>(currentPtr, newR);
      store<u8>(currentPtr + 1, newG);
      store<u8>(currentPtr + 2, newB);
      store<u8>(currentPtr + 3, 255);

      // Match the JS vector bound without changing the residual direction.
      const residualR = oldR - <f64>newR;
      const residualG = oldG - <f64>newG;
      const residualB = oldB - <f64>newB;
      const errorScale = 255.0 / Math.max(
        255.0,
        Math.max(Math.abs(residualR), Math.max(Math.abs(residualG), Math.abs(residualB)))
      );
      const errorR = residualR * errorScale;
      const errorG = residualG * errorScale;
      const errorB = residualB * errorScale;

      for (let index: i32 = 0; index < matrixLength; index += 1) {
        const diffusionPtr = matrixPtr + index * 24;
        const offsetX = <i32>load<f64>(diffusionPtr);
        const offsetY = <i32>load<f64>(diffusionPtr + 8);
        const factor = load<f64>(diffusionPtr + 16);
        const dx = reverse ? -offsetX : offsetX;
        const nx = x + dx;
        const ny = y + offsetY;

        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

        const pixelPtr = errorsPtr + ((ny % errorRows) * width + nx) * 24;
        store<f64>(
          pixelPtr,
          load<f64>(pixelPtr) + errorR * factor
        );
        store<f64>(
          pixelPtr + 8,
          load<f64>(pixelPtr + 8) + errorG * factor
        );
        store<f64>(
          pixelPtr + 16,
          load<f64>(pixelPtr + 16) + errorB * factor
        );
      }
    }
    memory.fill(errorRowPtr, 0, width * 24);
  }
}
