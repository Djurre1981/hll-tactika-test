function readInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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
  return {
    detailTokenTtlSec: readInt(env.DETAIL_TOKEN_TTL_SEC, 1200),
    alertDiscordWebhookUrls: readWebhookUrls(env.ALERT_DISCORD_WEBHOOK_URL),
  };
}
