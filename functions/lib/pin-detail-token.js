import { getSecurityConfig } from "./security-config.js";

function base64urlEncode(bytes) {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const bin = atob(padded + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signPayload(payloadB64, secret) {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return base64urlEncode(sig);
}

async function verifySignature(payloadB64, signature, secret) {
  const key = await importHmacKey(secret);
  const sigBytes = base64urlDecode(signature);
  return crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(payloadB64));
}

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
