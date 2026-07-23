#!/usr/bin/env node
/**
 * Sync docs/wiki ↔ GitHub wiki (*.wiki.git).
 *
 *   node scripts/sync-github-wiki.mjs push
 *   node scripts/sync-github-wiki.mjs pull
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wikiSrc = path.join(root, "docs", "wiki");
const WIKI_REMOTE =
  process.env.TACTIKA_WIKI_REMOTE ||
  "https://github.com/Djurre1981/hll-tactika-test.wiki.git";

const SKIP = new Set(["README.md"]);

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
  if (r.status !== 0) {
    die(
      `${cmd} ${args.join(" ")} failed:\n${r.stderr || r.stdout || r.error}`
    );
  }
  return r.stdout || "";
}

function listWikiFiles(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".") || SKIP.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === "media") {
        for (const media of fs.readdirSync(full)) {
          if (media.startsWith(".")) continue;
          out.push({
            rel: path.join("media", media).replace(/\\/g, "/"),
            abs: path.join(full, media),
          });
        }
      }
      continue;
    }
    if (!/\.(md|markdown)$/i.test(name) && name !== "_Sidebar.md" && name !== "_Footer.md") {
      continue;
    }
    out.push({ rel: name, abs: full });
  }
  return out;
}

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function push() {
  if (!fs.existsSync(wikiSrc)) die(`Missing ${wikiSrc}`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tactika-wiki-"));
  console.log(`Cloning ${WIKI_REMOTE} → ${tmp}`);
  run("git", ["clone", "--depth", "1", WIKI_REMOTE, tmp]);

  // Remove previous tracked pages (keep .git)
  for (const name of fs.readdirSync(tmp)) {
    if (name === ".git") continue;
    fs.rmSync(path.join(tmp, name), { recursive: true, force: true });
  }

  const files = listWikiFiles(wikiSrc);
  if (!files.length) die("No wiki files to push");

  for (const f of files) {
    copyFile(f.abs, path.join(tmp, f.rel));
  }

  run("git", ["add", "-A"], { cwd: tmp });
  const status = run("git", ["status", "--porcelain"], { cwd: tmp }).trim();
  if (!status) {
    console.log("Wiki already up to date.");
    fs.rmSync(tmp, { recursive: true, force: true });
    return;
  }

  run(
    "git",
    [
      "-c",
      "user.email=tactika-wiki-bot@users.noreply.github.com",
      "-c",
      "user.name=Tactika Wiki Sync",
      "commit",
      "-m",
      "Sync from docs/wiki",
    ],
    { cwd: tmp }
  );
  run("git", ["push", "origin", "HEAD"], { cwd: tmp });
  console.log(`Pushed ${files.length} paths to GitHub wiki.`);
  fs.rmSync(tmp, { recursive: true, force: true });
}

function pull() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tactika-wiki-"));
  console.log(`Cloning ${WIKI_REMOTE} → ${tmp}`);
  run("git", ["clone", "--depth", "1", WIKI_REMOTE, tmp]);

  fs.mkdirSync(wikiSrc, { recursive: true });
  fs.mkdirSync(path.join(wikiSrc, "media"), { recursive: true });

  let count = 0;
  for (const name of fs.readdirSync(tmp)) {
    if (name === ".git" || SKIP.has(name)) continue;
    const from = path.join(tmp, name);
    const st = fs.statSync(from);
    if (st.isDirectory()) {
      if (name !== "media") continue;
      for (const media of fs.readdirSync(from)) {
        if (media.startsWith(".")) continue;
        copyFile(path.join(from, media), path.join(wikiSrc, "media", media));
        count += 1;
      }
      continue;
    }
    if (!/\.(md|markdown)$/i.test(name) && !name.startsWith("_")) continue;
    copyFile(from, path.join(wikiSrc, name));
    count += 1;
  }

  console.log(`Pulled ${count} paths into docs/wiki.`);
  fs.rmSync(tmp, { recursive: true, force: true });
}

const mode = (process.argv[2] || "").toLowerCase();
if (mode === "push") push();
else if (mode === "pull") pull();
else die("Usage: node scripts/sync-github-wiki.mjs <push|pull>");
