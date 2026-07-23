/**
 * D1 helpers for Cloudflare Pages Functions.
 * Binding name: DB (see wrangler.toml).
 * Structured data → D1 (pins, users, steam_profiles, …). KV → audit (V1) / Yjs (V2).
 */

export function getDb(env) {
  const db = env?.DB;
  if (!db) {
    return null;
  }
  return db;
}

export function requireDb(env) {
  const db = getDb(env);
  if (!db) {
    throw new Error("D1 database (DB) is not configured");
  }
  return db;
}
