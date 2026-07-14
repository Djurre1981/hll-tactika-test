import { getSecurityConfig } from "./security-config.js";
import { isOwner } from "./roles.js";

const DEBOUNCE_MS = 30 * 60 * 1000;
const memorySignals = new Map();

function signalKey(kind, steamId) {
  return `alert:${kind}:${steamId}`;
}

function debounceKey(kind, steamId) {
  return `alert:debounce:v2:${kind}:${steamId}`;
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

async function isAlertDebounced(env, kind, steamId) {
  const last = await readSignal(env, debounceKey(kind, steamId));
  return Boolean(last?.sentAt && Date.now() - last.sentAt < DEBOUNCE_MS);
}

async function markAlertSent(env, kind, steamId) {
  await writeSignal(
    env,
    debounceKey(kind, steamId),
    { sentAt: Date.now() },
    Math.ceil(DEBOUNCE_MS / 1000) + 60
  );
}

function withWaitParam(webhookUrl) {
  try {
    const url = new URL(webhookUrl);
    if (!url.searchParams.has("wait")) {
      url.searchParams.set("wait", "true");
    }
    return url.toString();
  } catch {
    return webhookUrl;
  }
}

/**
 * @returns {Promise<{ ok: boolean, status: number | null, body: string, error?: string, urlHost?: string }>}
 */
export async function postDiscordAlert(webhookUrl, content) {
  let urlHost = null;
  try {
    urlHost = new URL(webhookUrl).host;
  } catch {
    return {
      ok: false,
      status: null,
      body: "",
      error: "Invalid webhook URL (check ALERT_DISCORD_WEBHOOK_URL quoting)",
      urlHost: null,
    };
  }

  try {
    // Prefer wait=true for a clear status; fall back without it if Discord rejects.
    let response = await fetch(withWaitParam(webhookUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "HLL-Tactika-Alerts/1.0",
      },
      body: JSON.stringify({ content }),
    });
    let body = await response.text().catch(() => "");

    if (!response.ok && (response.status === 400 || response.status === 405)) {
      response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "HLL-Tactika-Alerts/1.0",
        },
        body: JSON.stringify({ content }),
      });
      body = await response.text().catch(() => "");
    }

    if (!response.ok) {
      console.error(`Discord alert failed (${response.status}): ${body.slice(0, 300)}`);
      return { ok: false, status: response.status, body: body.slice(0, 500), urlHost };
    }
    console.error(`Discord alert sent host=${urlHost} status=${response.status}`);
    return { ok: true, status: response.status, body: body.slice(0, 500), urlHost };
  } catch (error) {
    console.error("Discord alert failed", error);
    return {
      ok: false,
      status: null,
      body: "",
      error: error?.message || String(error),
      urlHost,
    };
  }
}

/**
 * Post the same alert to every webhook URL.
 * @returns {Promise<{ ok: boolean, sent: number, failed: number, results: object[] }>}
 */
export async function postDiscordAlerts(webhookUrls, content) {
  const urls = Array.isArray(webhookUrls) ? webhookUrls.filter(Boolean) : [];
  if (!urls.length) {
    return { ok: false, sent: 0, failed: 0, results: [] };
  }

  const results = await Promise.all(urls.map((url) => postDiscordAlert(url, content)));
  const sent = results.filter((result) => result.ok).length;
  const failed = results.length - sent;
  return {
    ok: sent > 0,
    sent,
    failed,
    results,
  };
}

export function describeWebhookUrl(webhookUrl) {
  if (!webhookUrl) {
    return { webhookConfigured: false, webhookHost: null, webhookPathPrefix: null, webhookCount: 0 };
  }
  try {
    const url = new URL(webhookUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    // /api/webhooks/{id}/{token} → show path without token
    const prefix =
      parts.length >= 3 ? `/${parts.slice(0, 3).join("/")}/…` : url.pathname;
    return {
      webhookConfigured: true,
      webhookHost: url.host,
      webhookPathPrefix: prefix,
      webhookCount: 1,
    };
  } catch {
    return { webhookConfigured: true, webhookHost: null, webhookPathPrefix: null, webhookCount: 1 };
  }
}

export function describeWebhookUrls(webhookUrls) {
  const urls = Array.isArray(webhookUrls) ? webhookUrls.filter(Boolean) : [];
  if (!urls.length) {
    return { webhookConfigured: false, webhookHost: null, webhookPathPrefix: null, webhookCount: 0 };
  }
  const first = describeWebhookUrl(urls[0]);
  return {
    ...first,
    webhookConfigured: true,
    webhookCount: urls.length,
  };
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

function formatSteamActor(steamId, steamName = null) {
  const id = String(steamId || "").trim() || "unknown";
  const name = String(steamName || "").trim();
  if (name) {
    return `**${name}** (\`${id}\`)`;
  }
  return `Steam \`${id}\``;
}

export async function recordDetailFetch(env, steamId, steamName = null) {
  const config = getSecurityConfig(env);
  if (!config.alertDiscordWebhookUrls?.length) return;
  if (await isOwner(steamId, env)) return;

  const key = signalKey("detail", steamId);
  const windowMs = config.alertDetailWindowMin * 60 * 1000;
  const timestamps = await trackTimestamps(env, key, windowMs);
  if (timestamps.length <= config.alertDetailInWindow) return;
  if (await isAlertDebounced(env, "detail", steamId)) {
    console.error("detail alert debounced");
    return;
  }

  const result = await postDiscordAlerts(
    config.alertDiscordWebhookUrls,
    `⚠️ **Detail fetch alert** — ${formatSteamActor(steamId, steamName)} loaded ${timestamps.length} pin details in the last ${config.alertDetailWindowMin} minutes (threshold: ${config.alertDetailInWindow}).`
  );
  if (result.ok) await markAlertSent(env, "detail", steamId);
}

export async function recordMapLoad(env, steamId, mapId, steamName = null) {
  const config = getSecurityConfig(env);
  if (!config.alertDiscordWebhookUrls?.length || !mapId) {
    console.error(
      `recordMapLoad skip: mapId=${mapId || "none"} webhook=${Boolean(config.alertDiscordWebhookUrls?.length)}`
    );
    return;
  }
  if (await isOwner(steamId, env)) return;

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
  console.error(
    `recordMapLoad ${mapId}: distinct=${distinctMaps} threshold=${config.alertMapsInWindow}`
  );
  if (distinctMaps < config.alertMapsInWindow) return;
  if (await isAlertDebounced(env, "maps", steamId)) {
    console.error("recordMapLoad debounced");
    return;
  }

  const result = await postDiscordAlerts(
    config.alertDiscordWebhookUrls,
    `⚠️ **Map sweep alert** — ${formatSteamActor(steamId, steamName)} loaded ${distinctMaps} distinct maps in ${config.alertMapWindowMin} minutes (threshold: ${config.alertMapsInWindow}).`
  );
  if (result.ok) await markAlertSent(env, "maps", steamId);
}

export async function recordRateLimitHit(env, steamId, steamName = null) {
  const config = getSecurityConfig(env);
  if (!config.alertDiscordWebhookUrls?.length) return;
  if (await isOwner(steamId, env)) return;

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

  console.error(`recordRateLimitHit consecutive=${consecutive} threshold=${config.alert429Count}`);
  if (consecutive < config.alert429Count) return;
  if (await isAlertDebounced(env, "429", steamId)) {
    console.error("429 alert debounced");
    return;
  }

  const result = await postDiscordAlerts(
    config.alertDiscordWebhookUrls,
    `⚠️ **Rate limit alert** — ${formatSteamActor(steamId, steamName)} hit ${consecutive} consecutive 429 responses (threshold: ${config.alert429Count} in ${config.alert429WindowMin} min).`
  );
  if (result.ok) await markAlertSent(env, "429", steamId);
}

export async function resetRateLimitAlertCounter(env, steamId) {
  const key = signalKey("429", steamId);
  await writeSignal(env, key, { consecutive: 0, lastAt: Date.now() }, 3600);
}
