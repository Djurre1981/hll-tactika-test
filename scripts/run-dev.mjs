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
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  child.kill("SIGTERM");
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) killTree(child);
  process.exit(code);
}

function run(command, args, name) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
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

// Open Vite directly — wrangler.toml pages_build_output_dir=dist would otherwise
// serve a stale production build on :8788 without HMR.
console.log(`Dev: http://127.0.0.1:${VITE_PORT}/  (API → wrangler :${API_PORT})`);

run("node", ["scripts/stratsketch-dev-import-server.mjs"], "import-sidecar");
run(
  "npx",
  ["wrangler", "pages", "dev", "dist", "--port", String(API_PORT), "--compatibility-date=2024-01-01"],
  "wrangler"
);
run("npx", ["vite", "--port", String(VITE_PORT), "--strictPort"], "vite");

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
