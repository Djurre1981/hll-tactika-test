import {
  base64urlDecode,
  base64urlEncode,
  signPayload,
  verifySignature,
} from "./crypto.js";

const COOKIE_NAME = "hll-tactika-session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function getSessionSecret(env) {
  const secret = env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not configured");
  }
  return secret;
}

function cookieFlags(request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `; Path=/; HttpOnly${secure}; SameSite=Lax`;
}

export async function createSessionCookie(user, secret, request) {
  const payload = {
    steamId: user.steamId,
    name: user.name || null,
    avatar: user.avatar || null,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await signPayload(payloadB64, secret);
  const value = `${payloadB64}.${signature}`;
  return `${COOKIE_NAME}=${value}${cookieFlags(request)}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
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
  const secret = getSessionSecret(env);
  const raw = readSessionCookie(request);
  if (!raw) return null;

  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;

  const payloadB64 = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  const valid = await verifySignature(payloadB64, signature, secret);
  if (!valid) return null;

  try {
    const json = new TextDecoder().decode(base64urlDecode(payloadB64));
    const payload = JSON.parse(json);
    if (!payload.steamId || !payload.exp || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
