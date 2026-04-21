import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.mjs" : "index.cjs"),
    },
    target: "es2020",
    sourcemap: true,
    outDir: "dist",
  },
  resolve: {
    alias: {
      epdoptimize: path.resolve(__dirname, "src"),
    },
  },
});
