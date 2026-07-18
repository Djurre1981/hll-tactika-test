import {
  base64urlDecode,
  base64urlEncode,
  signPayload,
  verifySignature,
} from "./crypto.js";

const DEFAULT_TTL_MS = 15 * 60 * 1000;

export function getCollabJwtSecret(env) {
  const secret = String(env.COLLAB_JWT_SECRET || "").trim();
  if (!secret) {
    throw new Error(
      "COLLAB_JWT_SECRET is not configured. Set it in Cloudflare Pages env (and .dev.vars)."
    );
  }
  return secret;
}

export function getCollabPersistSecret(env) {
  const secret = String(env.COLLAB_PERSIST_SECRET || "").trim();
  if (!secret) {
    throw new Error(
      "COLLAB_PERSIST_SECRET is not configured. Set it in Cloudflare Pages env (and .dev.vars)."
    );
  }
  return secret;
}

export function getCollabWsUrl(env) {
  let url = String(env.COLLAB_WS_URL || "").trim().replace(/\/+$/, "");
  if (!url) {
    throw new Error(
      "COLLAB_WS_URL is not configured (e.g. wss://collab.tactika.gg)."
    );
  }
  // Browsers require ws:/wss: — https:/http: in the dashboard would never connect
  url = url.replace(/^http/i, "ws");
  return url;
}

export async function createCollabToken(
  env,
  { roomId, steamId, role, displayName }
) {
  const secret = getCollabJwtSecret(env);
  const ttl = Number.parseInt(String(env.COLLAB_TOKEN_TTL_MS || ""), 10);
  const payload = {
    roomId,
    steamId,
    role,
    displayName: displayName || "",
    exp: Date.now() + (Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_TTL_MS),
  };
  const payloadB64 = base64urlEncode(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const signature = await signPayload(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

export async function verifyCollabToken(env, token) {
  const secret = getCollabJwtSecret(env);
  const raw = String(token || "").trim();
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return { status: "invalid" };

  const payloadB64 = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  const valid = await verifySignature(payloadB64, signature, secret);
  if (!valid) return { status: "invalid" };

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(base64urlDecode(payloadB64))
    );
    if (!payload?.roomId || !payload?.steamId || !payload?.exp) {
      return { status: "invalid" };
    }
    if (payload.exp < Date.now()) return { status: "expired" };
    return { status: "ok", payload };
  } catch {
    return { status: "invalid" };
  }
}

export function assertPersistAuth(request, env) {
  const expected = getCollabPersistSecret(env);
  const header = String(request.headers.get("Authorization") || "");
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const provided = match?.[1]?.trim() || "";
  if (!provided || provided !== expected) {
    return false;
  }
  return true;
}
