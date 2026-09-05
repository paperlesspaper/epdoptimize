/** Keep canvas allocations bounded while supporting common large EPD panels. */
export function parseCustomResolution(width: unknown, height: unknown) {
  const parse = (value: unknown) =>
    typeof value === "number" ? value :
      typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : NaN;
  const w = parse(width);
  const h = parse(height);
  if (![w, h].every(value => Number.isInteger(value) && value >= 1 && value <= 8192)) {
    throw new Error("Enter whole-number dimensions from 1 to 8192 pixels.");
  }
  if (w * h > 16_777_216) throw new Error("Use a resolution of at most 16 megapixels.");
  return { name: "custom", label: "Custom resolution", width: w, height: h };
}
