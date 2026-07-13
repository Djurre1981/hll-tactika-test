const memoryBuckets = new Map();

function bucketKey(bucket, steamId) {
  return `rl:${bucket}:${steamId}`;
}

async function readTimestamps(env, key) {
  if (env.PINS_KV) {
    const stored = await env.PINS_KV.get(key, "json");
    return Array.isArray(stored) ? stored : [];
  }
  return memoryBuckets.get(key) || [];
}

async function writeTimestamps(env, key, timestamps, windowMs) {
  const ttlSec = Math.ceil(windowMs / 1000) + 120;
  if (env.PINS_KV) {
    await env.PINS_KV.put(key, JSON.stringify(timestamps), { expirationTtl: ttlSec });
    return;
  }
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

export async function checkRateLimit(env, bucket, steamId, limit, windowMs) {
  const key = bucketKey(bucket, steamId);
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = pruneTimestamps(await readTimestamps(env, key), windowStart);

  if (timestamps.length >= limit) {
    return {
      allowed: false,
      retryAfterSec: retryAfterSec(timestamps, windowMs, now),
      timestamps,
    };
  }

  return { allowed: true, timestamps };
}

export async function incrementRateLimit(env, bucket, steamId, limit, windowMs, existingTimestamps) {
  const key = bucketKey(bucket, steamId);
  const now = Date.now();
  const windowStart = now - windowMs;
  let timestamps = pruneTimestamps(existingTimestamps || [], windowStart);
  timestamps.push(now);
  if (timestamps.length > limit * 2) {
    timestamps = timestamps.slice(-limit);
  }
  await writeTimestamps(env, key, timestamps, windowMs);
  return timestamps;
}

export function rateLimitedResponse(retryAfterSec, message = "Rate limit exceeded") {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Retry-After": String(Math.max(1, retryAfterSec)),
  });
  return new Response(JSON.stringify({ error: message }), { status: 429, headers });
}
