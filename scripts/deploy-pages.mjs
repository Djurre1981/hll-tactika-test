/**
 * Deploy this staging repo only to the hll-tactika-test Pages project.
 * Never targets production V1 (hll-tactika / HLL_interactive_climb).
 */
import { spawnSync } from "node:child_process";

const PROJECT = "hll-tactika-test";
const FORBIDDEN = new Set(["hll-tactika"]);

const projectArg = process.argv.find((a) => a.startsWith("--project-name="));
const project = projectArg ? projectArg.slice("--project-name=".length) : PROJECT;

if (FORBIDDEN.has(project)) {
  console.error(
    `Refusing to deploy to "${project}". That is production V1 (climbing guide).\n` +
      `This repo deploys only to "${PROJECT}".\n` +
      `V1 lives in https://github.com/Djurre1981/HLL_interactive_climb and auto-deploys from that repo.`
  );
  process.exit(1);
}

if (project !== PROJECT) {
  console.error(`Refusing unexpected Pages project "${project}". Expected "${PROJECT}".`);
  process.exit(1);
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npx", ["vite", "build"]);
run("npx", ["wrangler", "pages", "deploy", "dist", `--project-name=${PROJECT}`, "--branch=main"]);
