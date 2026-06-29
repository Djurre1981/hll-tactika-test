#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { requireEnv, videosDir } from "./lib/config.mjs";
import { loadManifest, saveManifest } from "./lib/manifest.mjs";
import { createR2Client, objectExists, uploadVideoFile } from "./lib/r2.mjs";

const manifest = loadManifest();
if (!manifest) {
  throw new Error("Missing data/manifest.json — run 1-export-discord.mjs first.");
}

const bucket = requireEnv("R2_BUCKET_NAME");
const client = createR2Client();

let uploaded = 0;
let skipped = 0;

for (const entry of manifest.entries) {
  if (entry.status === "uploaded") {
    skipped += 1;
    continue;
  }

  const filePath = join(videosDir, `${entry.messageId}.mp4`);
  if (!existsSync(filePath)) {
    if (entry.status !== "download_failed") {
      entry.status = "upload_skipped";
      entry.error = "Local file missing — run 2-download-videos.mjs";
    }
    continue;
  }

  if (await objectExists(client, bucket, entry.r2Key)) {
    entry.status = "uploaded";
    skipped += 1;
    continue;
  }

  process.stdout.write(`Uploading ${entry.messageId}… `);
  try {
    await uploadVideoFile(
      client,
      bucket,
      entry.r2Key,
      filePath,
      entry.attachment?.contentType || "video/mp4"
    );
    entry.status = "uploaded";
    uploaded += 1;
    console.log("ok");
  } catch (error) {
    entry.status = "upload_failed";
    entry.error = error.message;
    console.log(`failed (${error.message})`);
  }
}

manifest.uploadedAt = new Date().toISOString();
saveManifest(manifest);
console.log(`Done. Uploaded ${uploaded}, skipped ${skipped}, failed ${manifest.entries.filter((e) => e.status === "upload_failed").length}.`);
