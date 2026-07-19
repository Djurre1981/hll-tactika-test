import { spawn, execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SIDECAR_PORT = 8790;
const API_PORT = 8788;
const VITE_PORT = 5173;
const children = [];
let shuttingDown = false;

/** Kill whatever is still bound to a local port (common after a hung exit). */
function freePort(port) {
  try {
    if (process.platform === "win32") {
      const out = execFileSync("netstat", ["-ano"], { encoding: "utf8" });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        if (!line.includes(`:${port}`) || !line.includes("LISTENING")) continue;
        const pid = line.trim().split(/\s+/).pop();
        if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execFileSync("taskkill", ["/pid", pid, "/t", "/f"], { stdio: "ignore" });
          console.log(`Freed port ${port} (killed PID ${pid})`);
        } catch {
          /* already gone */
        }
      }
      return;
    }
    execFileSync("sh", ["-c", `fuser -k ${port}/tcp 2>/dev/null || true`], { stdio: "ignore" });
  } catch {
    /* ignore lookup failures */
  }
}

function killTree(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    } catch {
      /* already gone */
    }
    return;
  }
  child.kill("SIGTERM");
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\nStopping dev servers...");
  for (const child of children) killTree(child);
  freePort(SIDECAR_PORT);
  freePort(API_PORT);
  freePort(VITE_PORT);
  if (process.stdin.isTTY) {
    try {
      process.stdin.setRawMode(false);
    } catch {
      /* ignore */
    }
  }
  process.exit(code);
}

function enableKeyExit() {
  if (!process.stdin.isTTY) return;

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (key) => {
    const k = String(key);
    // x / X, or Ctrl+C
    if (k === "x" || k === "X" || k === "\u0003") {
      shutdown(0);
    }
  });
}

function runBuildOnce() {
  console.log("Building frontend for :8788...");
  execFileSync("npx", ["vite", "build"], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
}

function run(command, args, name) {
  // Keep stdin on the parent so "x" always reaches this script (not wrangler).
  const child = spawn(command, args, {
    cwd: root,
    stdio: ["ignore", "inherit", "inherit"],
    shell: process.platform === "win32",
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    const exitCode = code ?? (signal ? 1 : 0);
    if (exitCode !== 0) console.error(`${name} exited with code ${exitCode}`);
    shutdown(exitCode);
  });
  return child;
}

freePort(SIDECAR_PORT);
freePort(API_PORT);
freePort(VITE_PORT);

console.log("Applying local D1 migrations...");
execFileSync("npx", ["wrangler", "d1", "migrations", "apply", "hll-tactika-db", "--local"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});

runBuildOnce();

// Open Vite directly — wrangler pages dev serves `dist` on :8788.
// Vite dev (:5173) has HMR; build --watch keeps :8788 in sync.
console.log(`Dev UI (HMR):  http://localhost:${VITE_PORT}/`);
console.log(`Dev full stack: http://localhost:${API_PORT}/  (API + built UI)`);
console.log("Press x to stop all servers.\n");

run("node", ["scripts/stratsketch-dev-import-server.mjs"], "import-sidecar");
run(
  "npx",
  ["wrangler", "pages", "dev", "dist", "--port", String(API_PORT), "--compatibility-date=2024-01-01"],
  "wrangler"
);
run("npx", ["vite", "build", "--watch"], "vite-build");
run("npx", ["vite", "--port", String(VITE_PORT), "--strictPort"], "vite");

enableKeyExit();

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
