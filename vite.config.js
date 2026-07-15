import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));
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

function copyStaticToDist() {
  const dist = path.join(root, "dist");
  for (const dir of STATIC_DIRS) {
    const from = path.join(root, dir);
    if (!fs.existsSync(from)) continue;
    fs.cpSync(from, path.join(dist, dir), { recursive: true });
  }
  for (const file of STATIC_FILES) {
    const from = path.join(root, file);
    if (!fs.existsSync(from)) continue;
    fs.copyFileSync(from, path.join(dist, file));
  }
}

/** Keep /assets|/maps|/data URLs as public paths (no Vite fingerprinting). */
function preserveStaticUrls() {
  // Encode the path in the placeholder so multi-page builds can't race a shared map.
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
      res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
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

        if (url === "/" || url === "") {
          res.statusCode = 302;
          res.setHeader("Location", `/home/${query}`);
          res.end();
          return;
        }

        const barePages = {
          "/home": "/home/",
          "/tool/stratmaker": "/tool/stratmaker/",
          "/tool/climbing-guide": "/tool/climbing-guide/",
        };
        if (barePages[url]) {
          res.statusCode = 302;
          res.setHeader("Location", `${barePages[url]}${query}`);
          res.end();
          return;
        }

        const match = STATIC_DIRS.find(
          (dir) => url === `/${dir}` || url.startsWith(`/${dir}/`)
        );
        if (!match) return next();
        const filePath = path.join(root, decodeURIComponent(url.slice(1)));
        if (
          !filePath.startsWith(path.join(root, match)) ||
          !fs.existsSync(filePath) ||
          fs.statSync(filePath).isDirectory()
        ) {
          return next();
        }
        sendStaticFile(req, res, filePath);
      });
    },
    closeBundle() {
      copyStaticToDist();
    },
  };
}

export default defineConfig({
  root,
  publicDir: false,
  appType: "mpa",
  plugins: [...preserveStaticUrls(), serveRepoStatic()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: path.resolve(root, "home/index.html"),
        stratmaker: path.resolve(root, "tool/stratmaker/index.html"),
        climbingGuide: path.resolve(root, "tool/climbing-guide/index.html"),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: WRANGLER_API,
        changeOrigin: true,
      },
    },
  },
});
