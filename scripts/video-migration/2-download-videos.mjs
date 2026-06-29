#!/usr/bin/env node
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { videosDir } from "./lib/config.mjs";
import { loadManifest, saveManifest } from "./lib/manifest.mjs";

const manifest = loadManifest();
if (!manifest) {
  throw new Error("Missing data/manifest.json — run 1-export-discord.mjs first.");
}

mkdirSync(videosDir, { recursive: true });

let downloaded = 0;
let skipped = 0;

for (const entry of manifest.entries) {
  const targetPath = join(videosDir, `${entry.messageId}.mp4`);
  if (existsSync(targetPath)) {
    entry.status = "downloaded";
    skipped += 1;
    continue;
  }

  const url = entry.attachment?.url;
  if (!url) {
    entry.status = "download_failed";
    entry.error = "Missing attachment URL";
    continue;
  }

  process.stdout.write(`Downloading ${entry.messageId}… `);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const body = Readable.fromWeb(response.body);
    await pipeline(body, createWriteStream(targetPath));
    entry.status = "downloaded";
    downloaded += 1;
    console.log("ok");
  } catch (error) {
    entry.status = "download_failed";
    entry.error = error.message;
    console.log(`failed (${error.message})`);
  }
}

manifest.downloadedAt = new Date().toISOString();
saveManifest(manifest);
console.log(`Done. Downloaded ${downloaded}, skipped ${skipped}, failed ${manifest.entries.filter((e) => e.status === "download_failed").length}.`);
