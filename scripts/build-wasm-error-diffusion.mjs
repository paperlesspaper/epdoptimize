import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const binary = new URL("../experiments/wasm/error-diffusion-rgb.wasm", import.meta.url);
const wrapper = new URL("../src/dither/wasm-error-diffusion-rgb.ts", import.meta.url);
await mkdir(new URL("../experiments/wasm/", import.meta.url), { recursive: true });
execFileSync(process.execPath, [
  "node_modules/assemblyscript/bin/asc.js", "wasm-src/error-diffusion-rgb.ts",
  "-o", fileURLToPath(binary), "-O", "--noAssert", "--runtime", "stub", "--enable", "simd",
], { cwd: root, stdio: "inherit" });
const source = await readFile(wrapper, "utf8");
const pattern = /const WASM_BASE64 =\s*"[A-Za-z0-9+/=]+";/;
if (!pattern.test(source)) throw new Error("Embedded WASM constant not found");
const base64 = (await readFile(binary)).toString("base64");
await writeFile(wrapper, source.replace(pattern, `const WASM_BASE64 =\n  "${base64}";`));
console.log("Built and embedded RGB error diffusion WASM.");
