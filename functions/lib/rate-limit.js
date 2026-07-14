/** Per-isolate memory only — zero KV reads/writes (free-tier friendly). */
const memoryBuckets = new Map();

function bucketKey(bucket, steamId) {
  return `rl:${bucket}:${steamId}`;
}

function readTimestamps(key) {
  return memoryBuckets.get(key) || [];
}

function writeTimestamps(key, timestamps) {
  memoryBuckets.set(key, timestamps);
}

function pruneTimestamps(timestamps, windowStart) {
  return timestamps.filter((ts) => typeof ts === "number" && ts > windowStart);
}

function retryAfterSec(timestamps, windowMs, now) {
  if (!timestamps.length) return 1;
  const oldest = Math.min(...timestamps);
  return Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
}

export async function checkRateLimit(_env, bucket, steamId, limit, windowMs) {
  const key = bucketKey(bucket, steamId);
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = pruneTimestamps(readTimestamps(key), windowStart);

  if (timestamps.length >= limit) {
    return {
      allowed: false,
      retryAfterSec: retryAfterSec(timestamps, windowMs, now),
      timestamps,
    };
  }

  return { allowed: true, timestamps };
}

export async function incrementRateLimit(_env, bucket, steamId, limit, windowMs, existingTimestamps) {
  const key = bucketKey(bucket, steamId);
  const now = Date.now();
  const windowStart = now - windowMs;
  let timestamps = pruneTimestamps(existingTimestamps || [], windowStart);
  timestamps.push(now);
  if (timestamps.length > limit * 2) {
    timestamps = timestamps.slice(-limit);
  }
  writeTimestamps(key, timestamps);
  return timestamps;
}

export function rateLimitedResponse(retryAfterSec, message = "Rate limit exceeded") {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Retry-After": String(Math.max(1, retryAfterSec)),
  });
  return new Response(JSON.stringify({ error: message }), { status: 429, headers });
}
