import { spawn, execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SIDECAR_PORT = 8790;
const children = [];
let shuttingDown = false;

/** Kill whatever is still bound to the StratSketch sidecar port (common after a hung exit). */
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
    // Either child stopping (incl. wrangler [x]) should tear everything down.
    shutdown(exitCode);
  });
  return child;
}

freePort(SIDECAR_PORT);

run("node", ["scripts/stratsketch-dev-import-server.mjs"], "import-sidecar");
run("npx", ["wrangler", "pages", "dev", ".", "--compatibility-date=2024-01-01"], "wrangler");

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
