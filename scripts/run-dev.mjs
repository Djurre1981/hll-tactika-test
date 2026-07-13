import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function run(command, args, name) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      process.exit(code);
    }
  });
  return child;
}

const sidecar = run("node", ["scripts/stratsketch-dev-import-server.mjs"], "import-sidecar");
const wrangler = run("npx", ["wrangler", "pages", "dev", ".", "--compatibility-date=2024-01-01"], "wrangler");

function shutdown() {
  sidecar.kill();
  wrangler.kill();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
