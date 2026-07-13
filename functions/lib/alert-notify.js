import { getSecurityConfig } from "./security-config.js";

const DEBOUNCE_MS = 30 * 60 * 1000;
const memorySignals = new Map();

function signalKey(kind, steamId) {
  return `alert:${kind}:${steamId}`;
}

async function readSignal(env, key) {
  if (env.PINS_KV) {
    return (await env.PINS_KV.get(key, "json")) || null;
  }
  return memorySignals.get(key) || null;
}

async function writeSignal(env, key, value, ttlSec) {
  if (env.PINS_KV) {
    await env.PINS_KV.put(key, JSON.stringify(value), { expirationTtl: ttlSec });
    return;
  }
  memorySignals.set(key, value);
}

function pruneTimestamps(timestamps, windowStart) {
  return timestamps.filter((ts) => typeof ts === "number" && ts > windowStart);
}

async function shouldDebounce(env, kind, steamId) {
  const key = `alert:debounce:${kind}:${steamId}`;
  const last = await readSignal(env, key);
  if (last?.sentAt && Date.now() - last.sentAt < DEBOUNCE_MS) {
    return true;
  }
  await writeSignal(env, key, { sentAt: Date.now() }, Math.ceil(DEBOUNCE_MS / 1000) + 60);
  return false;
}

async function postDiscordAlert(webhookUrl, content) {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  } catch (error) {
    console.error("Discord alert failed", error);
  }
}

async function trackTimestamps(env, key, windowMs) {
  const now = Date.now();
  const windowStart = now - windowMs;
  const stored = (await readSignal(env, key)) || { timestamps: [] };
  const timestamps = pruneTimestamps(stored.timestamps || [], windowStart);
  timestamps.push(now);
  const ttlSec = Math.ceil(windowMs / 1000) + 120;
  await writeSignal(env, key, { timestamps }, ttlSec);
  return timestamps;
}

export async function recordDetailFetch(env, steamId) {
  const config = getSecurityConfig(env);
  if (!config.alertDiscordWebhookUrl) return;

  const key = signalKey("detail", steamId);
  const timestamps = await trackTimestamps(env, key, 60 * 60 * 1000);
  if (timestamps.length <= config.alertDetailPerHour) return;
  if (await shouldDebounce(env, "detail", steamId)) return;

  await postDiscordAlert(
    config.alertDiscordWebhookUrl,
    `⚠️ **Detail fetch alert** — Steam \`${steamId}\` loaded ${timestamps.length} pin details in the last hour (threshold: ${config.alertDetailPerHour}).`
  );
}

export async function recordMapLoad(env, steamId, mapId) {
  const config = getSecurityConfig(env);
  if (!config.alertDiscordWebhookUrl || !mapId) return;

  const key = signalKey("maps", steamId);
  const windowMs = config.alertMapWindowMin * 60 * 1000;
  const stored = (await readSignal(env, key)) || { maps: {}, timestamps: [] };
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = pruneTimestamps(stored.timestamps || [], windowStart);
  timestamps.push(now);

  const maps = { ...(stored.maps || {}) };
  maps[mapId] = now;
  for (const [id, ts] of Object.entries(maps)) {
    if (ts <= windowStart) delete maps[id];
  }

  const ttlSec = Math.ceil(windowMs / 1000) + 120;
  await writeSignal(env, key, { maps, timestamps }, ttlSec);

  const distinctMaps = Object.keys(maps).length;
  if (distinctMaps < config.alertMapsInWindow) return;
  if (await shouldDebounce(env, "maps", steamId)) return;

  await postDiscordAlert(
    config.alertDiscordWebhookUrl,
    `⚠️ **Map sweep alert** — Steam \`${steamId}\` loaded ${distinctMaps} distinct maps in ${config.alertMapWindowMin} minutes (threshold: ${config.alertMapsInWindow}).`
  );
}

export async function recordRateLimitHit(env, steamId) {
  const config = getSecurityConfig(env);
  if (!config.alertDiscordWebhookUrl) return;

  const key = signalKey("429", steamId);
  const windowMs = config.alert429WindowMin * 60 * 1000;
  const stored = (await readSignal(env, key)) || { consecutive: 0, lastAt: 0 };
  const now = Date.now();

  let consecutive = stored.consecutive || 0;
  if (now - (stored.lastAt || 0) > windowMs) {
    consecutive = 0;
  }
  consecutive += 1;

  const ttlSec = Math.ceil(windowMs / 1000) + 120;
  await writeSignal(env, key, { consecutive, lastAt: now }, ttlSec);

  if (consecutive < config.alert429Count) return;
  if (await shouldDebounce(env, "429", steamId)) return;

  await postDiscordAlert(
    config.alertDiscordWebhookUrl,
    `⚠️ **Rate limit alert** — Steam \`${steamId}\` hit ${consecutive} consecutive 429 responses (threshold: ${config.alert429Count} in ${config.alert429WindowMin} min).`
  );
}

export async function resetRateLimitAlertCounter(env, steamId) {
  const key = signalKey("429", steamId);
  await writeSignal(env, key, { consecutive: 0, lastAt: Date.now() }, 3600);
}
