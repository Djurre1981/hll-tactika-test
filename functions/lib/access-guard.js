import {
  recordDetailFetch,
  recordMapLoad,
  recordRateLimitHit,
  resetRateLimitAlertCounter,
} from "./alert-notify.js";
import { appendAuditEvent } from "./audit-log.js";
import { getSecurityConfig } from "./security-config.js";
import { checkRateLimit, incrementRateLimit, rateLimitedResponse } from "./rate-limit.js";

/** User-facing labels — no numeric quotas. */
const RATE_LIMIT_MESSAGES = {
  map: "Map loading limit reached. Try again shortly.",
  detail: "Pin details limit reached. Try again shortly.",
  token: "Refresh limit reached. Try again shortly.",
  media: "Video playback limit reached. Try again shortly.",
  medal: "Medal lookup limit reached. Try again shortly.",
  auth: "Sign-in limit reached. Try again shortly.",
  admin: "Admin action limit reached. Try again shortly.",
  prefs: "Preferences limit reached. Try again shortly.",
  admin_export: "Export limit reached. Try again shortly.",
};

const BUCKET_WINDOWS = {
  map: (config) => ({ limit: config.rateLimitMapPerMin, windowMs: 60 * 1000 }),
  detail: (config) => ({ limit: config.rateLimitDetailPerMin, windowMs: 60 * 1000 }),
  token: (config) => ({ limit: config.rateLimitTokenPerMin, windowMs: 60 * 1000 }),
  /** Video playback only — image/thumbnail GETs are not rate-limited. */
  media: (config) => ({ limit: config.rateLimitMediaPerMin, windowMs: 60 * 1000 }),
  medal: (config) => ({ limit: config.rateLimitMedalPerMin, windowMs: 60 * 1000 }),
  auth: (config) => ({ limit: config.rateLimitAuthPerMin, windowMs: 60 * 1000 }),
  admin: (config) => ({ limit: config.rateLimitAdminPerMin, windowMs: 60 * 1000 }),
  prefs: (config) => ({ limit: config.rateLimitPrefsPerMin, windowMs: 60 * 1000 }),
  admin_export: (config) => ({
    limit: config.rateLimitAdminExportPerHour,
    windowMs: 60 * 60 * 1000,
  }),
};

/** Side effects must not take down the request (KV blips, Discord latency, etc.). */
async function safeSideEffect(label, fn) {
  try {
    await fn();
  } catch (error) {
    console.error(`guardAccess side effect failed (${label}):`, error);
  }
}

/**
 * @param {object} opts
 * @param {string|null} [opts.bucket] Rate-limit bucket; omit/null to audit only (no limit).
 */
export async function guardAccess(context, {
  bucket = null,
  endpoint,
  steamId,
  steamName = null,
  mapId = null,
  pinId = null,
  statusOnSuccess = 200,
}) {
  const config = getSecurityConfig(context.env);

  if (bucket) {
    const windowFn = BUCKET_WINDOWS[bucket];
    if (!windowFn) {
      throw new Error(`Unknown rate-limit bucket: ${bucket}`);
    }
    const { limit, windowMs } = windowFn(config);

    let check;
    try {
      check = await checkRateLimit(context.env, bucket, steamId, limit, windowMs);
    } catch (error) {
      console.error(`guardAccess rate-limit check failed (${bucket}):`, error);
      check = { allowed: true, timestamps: [] };
    }

    if (!check.allowed) {
      await safeSideEffect("audit.429", () =>
        appendAuditEvent(context.env, {
          steamId,
          endpoint,
          mapId,
          pinId,
          status: 429,
        })
      );
      await safeSideEffect("alert.429", () =>
        recordRateLimitHit(context.env, steamId, steamName)
      );
      return {
        error: rateLimitedResponse(
          check.retryAfterSec,
          RATE_LIMIT_MESSAGES[bucket] || "Request limit reached. Try again shortly."
        ),
      };
    }

    try {
      await incrementRateLimit(context.env, bucket, steamId, limit, windowMs, check.timestamps);
    } catch (error) {
      console.error(`guardAccess rate-limit increment failed (${bucket}):`, error);
    }
  }

  await safeSideEffect("audit", () =>
    appendAuditEvent(context.env, {
      steamId,
      endpoint,
      mapId,
      pinId,
      status: statusOnSuccess,
    })
  );

  if (statusOnSuccess >= 200 && statusOnSuccess < 300) {
    await safeSideEffect("alert.reset429", () =>
      resetRateLimitAlertCounter(context.env, steamId)
    );
  }

  if (bucket === "map" && mapId) {
    // Fire-and-forget: Discord wait=true must not block / time out map loads.
    context.waitUntil?.(
      recordMapLoad(context.env, steamId, mapId, steamName).catch((error) => {
        console.error("guardAccess side effect failed (alert.map):", error);
      })
    );
    if (!context.waitUntil) {
      await safeSideEffect("alert.map", () =>
        recordMapLoad(context.env, steamId, mapId, steamName)
      );
    }
  }
  if (bucket === "detail") {
    context.waitUntil?.(
      recordDetailFetch(context.env, steamId, steamName).catch((error) => {
        console.error("guardAccess side effect failed (alert.detail):", error);
      })
    );
    if (!context.waitUntil) {
      await safeSideEffect("alert.detail", () =>
        recordDetailFetch(context.env, steamId, steamName)
      );
    }
  }

  return { ok: true };
}
