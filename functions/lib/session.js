import { base64urlEncode } from "./crypto.js";
import { requireDb } from "./d1.js";

const COOKIE_NAME = "hll-tactika-session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function cookieFlags(request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `; Path=/; HttpOnly${secure}; SameSite=Lax`;
}

function createToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

async function hashToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return base64urlEncode(new Uint8Array(digest));
}

export async function createSessionCookie(user, env, request) {
  const db = requireDb(env);
  const token = createToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  await db
    .prepare(
      `INSERT INTO sessions (token_hash, steam_id, expires_at)
       VALUES (?, ?, ?)`
    )
    .bind(tokenHash, String(user.steamId), expiresAt)
    .run();

  return `${COOKIE_NAME}=${token}${cookieFlags(request)}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
}

export function clearSessionCookie(request) {
  return `${COOKIE_NAME}=;${cookieFlags(request).slice(1)}; Max-Age=0`;
}

export function readSessionCookie(request) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) {
      return rest.join("=");
    }
  }
  return null;
}

export async function verifySession(request, env) {
  const token = readSessionCookie(request);
  if (!token) return null;

  const db = requireDb(env);
  const tokenHash = await hashToken(token);
  try {
    const row = await db
      .prepare(
        `SELECT s.token_hash, s.steam_id, s.expires_at, u.display_name, u.avatar_url
           FROM sessions s
           JOIN users u ON u.steam_id = s.steam_id
          WHERE s.token_hash = ?`
      )
      .bind(tokenHash)
      .first();

    if (!row || !row.expires_at || row.expires_at <= new Date().toISOString()) {
      return null;
    }

    await db
      .prepare("UPDATE sessions SET last_seen_at = datetime('now') WHERE token_hash = ?")
      .bind(tokenHash)
      .run();

    return {
      steamId: String(row.steam_id),
      name: row.display_name || null,
      avatar: row.avatar_url || null,
      exp: Date.parse(row.expires_at),
    };
  } catch (error) {
    console.error("Session verification failed:", error);
    return null;
  }
}

export async function destroySession(request, env) {
  const token = readSessionCookie(request);
  if (!token) return;

  const db = requireDb(env);
  const tokenHash = await hashToken(token);
  await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}
