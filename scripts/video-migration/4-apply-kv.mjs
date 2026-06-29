#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { requireEnv } from "./lib/config.mjs";
import { loadManifest } from "./lib/manifest.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const manifest = loadManifest();
if (!manifest) {
  throw new Error("Missing data/manifest.json — run migration steps 1–3 first.");
}

const namespaceId = requireEnv("PINS_KV_NAMESPACE_ID");
const uploaded = manifest.entries.filter((entry) => entry.status === "uploaded");
if (uploaded.length === 0) {
  throw new Error("No uploaded entries in manifest.");
}

const byMessageId = new Map(uploaded.map((entry) => [entry.messageId, entry]));
const byAttachmentId = new Map(
  uploaded.map((entry) => [entry.attachment.id, entry])
);

function discordAttachmentId(url) {
  const match = String(url || "").match(/\/attachments\/\d+\/(\d+)\//);
  return match?.[1] || null;
}

function runWrangler(args) {
  const result = spawnSync("npx", ["wrangler", ...args], {
    encoding: "utf8",
    shell: true,
    cwd: repoRoot,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `wrangler failed: ${args.join(" ")}`);
  }
  return result.stdout;
}

console.log("Reading pins from production KV…");
const raw = runWrangler([
  "kv",
  "key",
  "get",
  "pins",
  "--namespace-id",
  namespaceId,
  "--remote",
]);
const data = JSON.parse(raw);
let updated = 0;

for (const mapId of Object.keys(data.pins || {})) {
  for (const pin of data.pins[mapId]) {
    const attachmentId = discordAttachmentId(pin.videoUrl);
    let entry =
      (pin.sourceDiscordMessageId && byMessageId.get(pin.sourceDiscordMessageId)) ||
      (attachmentId && byAttachmentId.get(attachmentId));

    if (!entry && pin.videoUrl) {
      entry = uploaded.find((item) => pin.videoUrl.startsWith(item.attachment.url.split("?")[0]));
    }

    if (!entry) {
      continue;
    }

    pin.videoUrl = entry.appVideoUrl;
    pin.sourceDiscordMessageId = entry.messageId;
    updated += 1;
  }
}

if (updated === 0) {
  console.log("No pins matched manifest entries. Add sourceDiscordMessageId to pins or check videoUrl matching.");
  process.exit(0);
}

const tempDir = mkdtempSync(join(tmpdir(), "hll-pins-"));
const tempFile = join(tempDir, "pins.json");
writeFileSync(tempFile, JSON.stringify(data));

console.log(`Updating ${updated} pin(s) in production KV…`);
runWrangler([
  "kv",
  "key",
  "put",
  "pins",
  "--path",
  tempFile,
  "--namespace-id",
  namespaceId,
  "--remote",
]);

unlinkSync(tempFile);
console.log("Done.");
