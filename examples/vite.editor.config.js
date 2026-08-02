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
  base: normalizeBasePath(process.env.EDITOR_BASE_PATH ?? "/"),
  resolve: {
    alias: {
      epdoptimize: path.resolve(__dirname, "../src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../dist/editor"),
    rollupOptions: {
      input: {
        editor: path.resolve(__dirname, "fabric-filter.html"),
      },
    },
    emptyOutDir: true,
  },
  server: {
    open: "/fabric-filter.html",
  },
});
