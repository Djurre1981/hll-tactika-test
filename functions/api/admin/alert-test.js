import { requireOwner } from "../../lib/auth-request.js";
import { guardAccess } from "../../lib/access-guard.js";
import { getSecurityConfig } from "../../lib/security-config.js";
import { errorResponse, json } from "../../lib/response.js";
import {
  describeWebhookUrls,
  postDiscordAlerts,
} from "../../lib/alert-notify.js";

async function runAlertTest(context) {
  const auth = await requireOwner(context);
  if (auth.error) {
    return auth.error;
  }

  const access = await guardAccess(context, {
    bucket: "admin",
    endpoint: "admin.alert_test",
    steamId: auth.session.steamId,
    steamName: auth.session.name,
  });
  if (access.error) {
    return access.error;
  }

  const config = getSecurityConfig(context.env);
  const describe = describeWebhookUrls(config.alertDiscordWebhookUrls);

  if (!config.alertDiscordWebhookUrls?.length) {
    return json(
      {
        ...describe,
        ok: false,
        discordStatus: null,
        error: "ALERT_DISCORD_WEBHOOK_URL is not set",
      },
      { status: 503 }
    );
  }

  const result = await postDiscordAlerts(
    config.alertDiscordWebhookUrls,
    `Alert probe from HLL Tactika — **${auth.session.name || "unknown"}** (\`${auth.session.steamId}\`) at ${new Date().toISOString()}.`
  );

  const firstFailure = result.results.find((item) => !item.ok);

  return json(
    {
      ...describe,
      ok: result.ok,
      sent: result.sent,
      failed: result.failed,
      discordStatus: result.results[0]?.status ?? null,
      error: result.ok
        ? null
        : firstFailure?.error || firstFailure?.body || "All webhook deliveries failed",
    },
    { status: result.ok ? 200 : 502 }
  );
}

export async function onRequestPost(context) {
  return runAlertTest(context);
}

export async function onRequestGet() {
  return errorResponse("Use POST", 405);
}
