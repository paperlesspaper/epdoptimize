import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  base: "/epdoptimize/",
  resolve: {
    alias: {
      epdoptimize: path.resolve(__dirname, "../src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../dist/examples"),
    rollupOptions: {
      input: path.resolve(__dirname, "index.html"),
    },
    emptyOutDir: true,
  },
  server: {
    open: true,
  },
});
