import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(root, "public");
const STATIC_DIRS = ["assets", "maps", "data"];
const STATIC_FILES = ["_headers", "_redirects"];
const WRANGLER_API = "http://127.0.0.1:8788";

const MIME = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".json": "application/json",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function copyExtraToDist() {
  const dist = path.join(root, "dist");
  if (!fs.existsSync(dist)) return;
  for (const file of STATIC_FILES) {
    const candidates = [
      path.join(PUBLIC, file),
      path.join(root, file),
    ];
    const from = candidates.find(
      (p) => fs.existsSync(p) && fs.statSync(p).isFile()
    );
    if (!from) continue;
    try {
      fs.copyFileSync(from, path.join(dist, file));
    } catch (err) {
      console.warn(`[serve-repo-static] skip ${file}:`, err.message);
    }
  }
}

/** Keep /assets|/maps|/data URLs as public paths (no Vite fingerprinting). */
function preserveStaticUrls() {
  return [
    {
      name: "preserve-static-urls-pre",
      transformIndexHtml: {
        order: "pre",
        handler(html) {
          return html.replace(
            /(\b(?:src|href|data-src)=")(\/(?:assets|maps|data)\/[^"]+)(")/g,
            (_m, pre, url, post) => `${pre}@@STATIC:${url}@@${post}`
          );
        },
      },
    },
    {
      name: "preserve-static-urls-post",
      transformIndexHtml: {
        order: "post",
        handler(html) {
          return html.replace(/@@STATIC:(\/(?:assets|maps|data)\/[^@]+)@@/g, "$1");
        },
      },
    },
  ];
}

function sendStaticFile(req, res, filePath) {
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  res.setHeader("Content-Type", type);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "no-cache");

  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m) {
      const size = stat.size;
      let start = m[1] ? Number(m[1]) : 0;
      let end = m[2] ? Number(m[2]) : size - 1;
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
        res.statusCode = 416;
        res.setHeader("Content-Range", `bytes */${size}`);
        res.end();
        return;
      }
      end = Math.min(end, size - 1);
      res.statusCode = 206;
      res.setHeader("Content-Range", `bytes ${start}-${end}`);
      res.setHeader("Content-Length", String(end - start + 1));
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }
  }

  res.setHeader("Content-Length", String(stat.size));
  fs.createReadStream(filePath).pipe(res);
}

function serveRepoStatic() {
  return {
    name: "serve-repo-static",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url || "/";
        const qIndex = raw.indexOf("?");
        const url = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
        const query = qIndex >= 0 ? raw.slice(qIndex) : "";

        const barePages = {
          "/climbing-guide-v1": "/climbing-guide-v1/",
        };
        if (barePages[url]) {
          res.statusCode = 302;
          res.setHeader("Location", `${barePages[url]}${query}`);
          res.end();
          return;
        }

        // React owns /tool/stratmaker — SPA fallback handles refresh.

        const match = STATIC_DIRS.find(
          (dir) => url === `/${dir}` || url.startsWith(`/${dir}/`)
        );
        if (match) {
          const filePath = path.join(PUBLIC, decodeURIComponent(url.slice(1)));
          if (
            filePath.startsWith(path.join(PUBLIC, match)) &&
            fs.existsSync(filePath) &&
            !fs.statSync(filePath).isDirectory()
          ) {
            sendStaticFile(req, res, filePath);
            return;
          }
          return next();
        }

        // SPA history fallback for React routes (MPA mode otherwise 404s on refresh).
        const skipSpa =
          url.startsWith("/api") ||
          url.startsWith("/climbing-guide-v1") ||
          url.startsWith("/src") ||
          url.startsWith("/@") ||
          url.startsWith("/node_modules") ||
          /\.\w+$/.test(url);
        if (!skipSpa && req.method === "GET") {
          req.url = `/${query}`;
        }
        return next();
      });
    },
    closeBundle() {
      copyExtraToDist();
    },
  };
}

export default defineConfig({
  root,
  publicDir: "public",
  appType: "mpa",
  plugins: [react(), ...preserveStaticUrls(), serveRepoStatic()],
  resolve: {
    alias: {
      "@map-kernel": path.resolve(root, "map-kernel"),
    },
  },
  optimizeDeps: {
    include: ["@excalidraw/excalidraw"],
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
  worker: {
    format: "es",
  },
  build: {
    outDir: "dist",
    // Watch rebuilds must keep old hashed chunks so an open :8788 tab
    // does not 404 mid-import (Excalidraw loads large lazy chunks).
    emptyOutDir: !process.argv.includes("--watch"),
    rollupOptions: {
      input: {
        app: path.resolve(root, "index.html"),
        climbingGuide: path.resolve(root, "climbing-guide-v1/index.html"),
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    open: "/",
    fs: {
      // Bundled in-app manual lives under docs/wiki
      allow: [root],
    },
    proxy: {
      "/api": {
        target: WRANGLER_API,
        changeOrigin: true,
        // Browser Origin stays :5173; Pages same-origin guard compares it to
        // the wrangler URL (:8788) and 403s mutating requests without this.
        configure(proxy) {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("Origin", WRANGLER_API);
            proxyReq.setHeader("Referer", `${WRANGLER_API}/`);
          });
        },
      },
    },
  },
});
