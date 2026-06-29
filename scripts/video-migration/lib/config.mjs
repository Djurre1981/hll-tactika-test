import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const migrationDir = join(rootDir, "..");
export const dataDir = join(migrationDir, "data");
export const videosDir = join(dataDir, "videos");
export const manifestPath = join(dataDir, "manifest.json");

loadEnvFile(join(migrationDir, ".env"));

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) {
      continue;
    }
    process.env[match[1]] = match[2].trim();
  }
}

export function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

export function appVideoUrl(messageId) {
  return `/api/videos/${messageId}`;
}

export function r2ObjectKey(messageId) {
  return `tricks/${messageId}.mp4`;
}

export function r2Endpoint(accountId) {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}
