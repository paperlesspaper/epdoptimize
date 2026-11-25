/** Also recognize copied/imported palettes: recipe tokens are not native RGB. */
export function usesSpectra35Tokens(palette: readonly { deviceColor: string }[]) {
  return palette.some(({ deviceColor }) => {
    if (!/^#[0-9a-f]{6}$/i.test(deviceColor)) return false;
    const value = Number.parseInt(deviceColor.slice(1), 16);
    return value >= 0x010000 && value <= 0x010022;
  });
}

export const SPECTRA35_UPLOAD_NOTICE =
  "Spectra35 is experimental. Its recipe-token PNG requires a custom LUT driver; normal device upload is unavailable.";
