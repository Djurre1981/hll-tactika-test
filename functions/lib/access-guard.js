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

/**
 * @param {object} opts
 * @param {string|null} [opts.bucket] Rate-limit bucket; omit/null to skip limiting.
 */
export async function guardAccess(context, {
  bucket = null,
  endpoint: _endpoint,
  steamId,
  steamName: _steamName = null,
  mapId: _mapId = null,
  pinId: _pinId = null,
  statusOnSuccess: _statusOnSuccess = 200,
}) {
  const config = getSecurityConfig(context.env);

  if (!bucket) {
    return { ok: true };
  }

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

  return { ok: true };
}
