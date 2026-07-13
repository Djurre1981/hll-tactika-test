import {
  base64urlDecode,
  base64urlEncode,
  signPayload,
  verifySignature,
} from "./crypto.js";
import { getSecurityConfig } from "./security-config.js";

let secretValidated = false;

export function getPinDetailSecret(env) {
  const secret = env.PIN_DETAIL_SECRET;
  if (!secret) {
    throw new Error(
      "PIN_DETAIL_SECRET is not configured. Set it in Cloudflare Pages environment variables (and .dev.vars for local dev)."
    );
  }
  return secret;
}

export function assertPinDetailSecretConfigured(env) {
  if (secretValidated) return;
  getPinDetailSecret(env);
  secretValidated = true;
}

export async function createDetailToken(env, { pinId, mapId, steamId }) {
  assertPinDetailSecretConfigured(env);
  const secret = getPinDetailSecret(env);
  const config = getSecurityConfig(env);
  const payload = {
    pinId,
    mapId,
    steamId,
    exp: Date.now() + config.detailTokenTtlSec * 1000,
  };
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await signPayload(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

export async function verifyDetailToken(env, token, { pinId, mapId, steamId }) {
  assertPinDetailSecretConfigured(env);
  const secret = getPinDetailSecret(env);
  const raw = String(token || "").trim();
  if (!raw) {
    return { status: "invalid" };
  }

  const dot = raw.lastIndexOf(".");
  if (dot <= 0) {
    return { status: "invalid" };
  }

  const payloadB64 = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  const valid = await verifySignature(payloadB64, signature, secret);
  if (!valid) {
    return { status: "invalid" };
  }

  try {
    const json = new TextDecoder().decode(base64urlDecode(payloadB64));
    const payload = JSON.parse(json);
    if (payload.pinId !== pinId || payload.mapId !== mapId || payload.steamId !== steamId) {
      return { status: "invalid" };
    }
    if (!payload.exp) {
      return { status: "invalid" };
    }
    if (payload.exp < Date.now()) {
      return { status: "expired" };
    }
    return { status: "ok", payload };
  } catch {
    return { status: "invalid" };
  }
}
