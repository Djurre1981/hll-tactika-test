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
    alertDetailInWindow: readInt(env.ALERT_DETAIL_IN_WINDOW ?? env.ALERT_DETAIL_PER_HOUR, 100),
    alertDetailWindowMin: readInt(env.ALERT_DETAIL_WINDOW_MIN, 30),
    alertMapsInWindow: readInt(env.ALERT_MAPS_IN_WINDOW, 15),
    alertMapWindowMin: readInt(env.ALERT_MAP_WINDOW_MIN, 15),
    alertDiscordWebhookUrls,
    /** @deprecated Prefer alertDiscordWebhookUrls */
    alertDiscordWebhookUrl: alertDiscordWebhookUrls[0] || null,
    auditEnabled: readBool(env.AUDIT_ENABLED, true),
    auditMaxEvents: readInt(env.AUDIT_MAX_EVENTS, 500),
  };
}
