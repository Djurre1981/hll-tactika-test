function readInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBool(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  return fallback;
}

function readSecret(value) {
  let text = String(value ?? "").trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }
  return text || null;
}

function readWebhookUrls(value) {
  const raw = readSecret(value);
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function getSecurityConfig(env) {
  const alertDiscordWebhookUrls = readWebhookUrls(env.ALERT_DISCORD_WEBHOOK_URL);
  return {
    detailTokenTtlSec: readInt(env.DETAIL_TOKEN_TTL_SEC, 1200),
    rateLimitMapPerMin: readInt(env.RATE_LIMIT_MAP_PER_MIN, 10),
    rateLimitDetailPerMin: readInt(env.RATE_LIMIT_DETAIL_PER_MIN, 20),
    rateLimitTokenPerMin: readInt(env.RATE_LIMIT_TOKEN_PER_MIN, 30),
    rateLimitMediaPerHour: readInt(env.RATE_LIMIT_MEDIA_PER_HOUR, 60),
    rateLimitAdminExportPerHour: readInt(env.RATE_LIMIT_ADMIN_EXPORT_PER_HOUR, 5),
    rateLimitUploadPerHour: readInt(env.RATE_LIMIT_UPLOAD_PER_HOUR, 30),
    rateLimitPinWritePerMin: readInt(env.RATE_LIMIT_PIN_WRITE_PER_MIN, 30),
    rateLimitMedalPerMin: readInt(env.RATE_LIMIT_MEDAL_PER_MIN, 20),
    rateLimitAuthPerMin: readInt(env.RATE_LIMIT_AUTH_PER_MIN, 20),
    rateLimitAdminPerMin: readInt(env.RATE_LIMIT_ADMIN_PER_MIN, 30),
    rateLimitPrefsPerMin: readInt(env.RATE_LIMIT_PREFS_PER_MIN, 30),
    alertDetailPerHour: readInt(env.ALERT_DETAIL_PER_HOUR, 100),
    alertMapsInWindow: readInt(env.ALERT_MAPS_IN_WINDOW, 15),
    alertMapWindowMin: readInt(env.ALERT_MAP_WINDOW_MIN, 15),
    alert429Count: readInt(env.ALERT_429_COUNT, 5),
    alert429WindowMin: readInt(env.ALERT_429_WINDOW_MIN, 10),
    alertDiscordWebhookUrls,
    /** @deprecated Prefer alertDiscordWebhookUrls */
    alertDiscordWebhookUrl: alertDiscordWebhookUrls[0] || null,
    auditEnabled: readBool(env.AUDIT_ENABLED, true),
    auditMaxEvents: readInt(env.AUDIT_MAX_EVENTS, 500),
  };
}
