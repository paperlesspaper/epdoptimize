import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ratingDataDir = path.resolve(__dirname, "rating-data");
const ratingJsonlPath = path.join(ratingDataDir, "pairwise-votes.jsonl");
const ratingJsonPath = path.join(ratingDataDir, "pairwise-votes.json");
const ratingEndpoint = "/__epdoptimize-rating-votes";

async function readRequestBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function readDiskVotes() {
  try {
    const content = await fs.readFile(ratingJsonlPath, "utf8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function writeVoteSnapshot(votes) {
  await fs.mkdir(ratingDataDir, { recursive: true });
  await fs.writeFile(
    ratingJsonPath,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        count: votes.length,
        votes,
      },
      null,
      2,
    ),
  );
}

async function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

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
    // The root is examples/, but the library and its assets live in ../src.
    fs: { allow: [path.resolve(__dirname, "..")] },
  },
  plugins: [
    {
      name: "epdoptimize-rating-disk-storage",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const pathname = new URL(req.url ?? "", "http://localhost").pathname;
          if (
            pathname !== ratingEndpoint &&
            pathname !== `/epdoptimize${ratingEndpoint}`
          ) {
            next();
            return;
          }

          try {
            if (req.method === "GET") {
              await sendJson(res, 200, {
                storage: "disk",
                jsonlPath: path.relative(path.resolve(__dirname, ".."), ratingJsonlPath),
                jsonPath: path.relative(path.resolve(__dirname, ".."), ratingJsonPath),
                votes: await readDiskVotes(),
              });
              return;
            }

            if (req.method === "POST") {
              const body = await readRequestBody(req);
              const vote = JSON.parse(body || "{}");
              await fs.mkdir(ratingDataDir, { recursive: true });
              await fs.appendFile(ratingJsonlPath, `${JSON.stringify(vote)}\n`);
              const votes = await readDiskVotes();
              await writeVoteSnapshot(votes);
              await sendJson(res, 200, {
                ok: true,
                count: votes.length,
                storage: "disk",
                jsonlPath: path.relative(path.resolve(__dirname, ".."), ratingJsonlPath),
                jsonPath: path.relative(path.resolve(__dirname, ".."), ratingJsonPath),
              });
              return;
            }

            if (req.method === "DELETE") {
              await fs.rm(ratingJsonlPath, { force: true });
              await writeVoteSnapshot([]);
              await sendJson(res, 200, {
                ok: true,
                count: 0,
                storage: "disk",
              });
              return;
            }

            res.statusCode = 405;
            res.end("Method not allowed");
          } catch (error) {
            await sendJson(res, 500, {
              ok: false,
              error: error instanceof Error ? error.message : "Storage error",
            });
          }
        });
      },
    },
  ],
});
