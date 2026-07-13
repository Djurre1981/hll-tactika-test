import {
  recordDetailFetch,
  recordMapLoad,
  recordRateLimitHit,
  resetRateLimitAlertCounter,
} from "./alert-notify.js";
import { appendAuditEvent } from "./audit-log.js";
import { getSecurityConfig } from "./security-config.js";
import { checkRateLimit, incrementRateLimit, rateLimitedResponse } from "./rate-limit.js";

const BUCKET_WINDOWS = {
  map: (config) => ({ limit: config.rateLimitMapPerMin, windowMs: 60 * 1000 }),
  detail: (config) => ({ limit: config.rateLimitDetailPerMin, windowMs: 60 * 1000 }),
  token: (config) => ({ limit: config.rateLimitTokenPerMin, windowMs: 60 * 1000 }),
  media: (config) => ({ limit: config.rateLimitMediaPerHour, windowMs: 60 * 60 * 1000 }),
  admin_export: (config) => ({
    limit: config.rateLimitAdminExportPerHour,
    windowMs: 60 * 60 * 1000,
  }),
};

export async function guardAccess(context, {
  bucket,
  endpoint,
  steamId,
  mapId = null,
  pinId = null,
  statusOnSuccess = 200,
}) {
  const config = getSecurityConfig(context.env);
  const { limit, windowMs } = BUCKET_WINDOWS[bucket](config);
  const check = await checkRateLimit(context.env, bucket, steamId, limit, windowMs);

  if (!check.allowed) {
    await appendAuditEvent(context.env, {
      steamId,
      endpoint,
      mapId,
      pinId,
      status: 429,
    });
    await recordRateLimitHit(context.env, steamId);
    return {
      error: rateLimitedResponse(check.retryAfterSec),
    };
  }

  await incrementRateLimit(context.env, bucket, steamId, limit, windowMs, check.timestamps);

  await appendAuditEvent(context.env, {
    steamId,
    endpoint,
    mapId,
    pinId,
    status: statusOnSuccess,
  });

  if (statusOnSuccess >= 200 && statusOnSuccess < 300) {
    await resetRateLimitAlertCounter(context.env, steamId);
  }

  if (bucket === "map" && mapId) {
    await recordMapLoad(context.env, steamId, mapId);
  }
  if (bucket === "detail") {
    await recordDetailFetch(context.env, steamId);
  }

  return { ok: true };
}
