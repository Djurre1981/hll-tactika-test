import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { manifestPath, dataDir } from "./config.mjs";

export function loadManifest() {
  if (!existsSync(manifestPath)) {
    return null;
  }
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

export function saveManifest(manifest) {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export function getPrimaryVideoAttachment(message) {
  const attachments = message.attachments || [];
  const videos = attachments.filter(isVideoAttachment);
  if (videos.length === 0) {
    return null;
  }
  return videos[0];
}

export function isVideoAttachment(attachment) {
  const type = String(attachment.content_type || "").toLowerCase();
  const name = String(attachment.filename || "").toLowerCase();
  return (
    type.startsWith("video/") ||
    name.endsWith(".mp4") ||
    name.endsWith(".webm") ||
    name.endsWith(".mov")
  );
}
