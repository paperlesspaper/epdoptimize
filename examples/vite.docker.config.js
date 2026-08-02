import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const normalizeBasePath = (value) => {
  if (!value) return "/";
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
};

export default defineConfig({
  root: __dirname,
  base: normalizeBasePath(process.env.EXAMPLES_BASE_PATH ?? "/"),
  resolve: {
    alias: {
      epdoptimize: path.resolve(__dirname, "../src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../dist/examples"),
    rollupOptions: {
      input: {
        demo: path.resolve(__dirname, "index.html"),
        fabricFilter: path.resolve(__dirname, "fabric-filter.html"),
        ratingTool: path.resolve(__dirname, "rating-tool.html"),
      },
    },
    emptyOutDir: true,
  },
  server: {
    open: true,
  },
});
