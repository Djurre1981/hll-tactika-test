import { createHmac, timingSafeEqual } from "node:crypto";

function base64urlEncode(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(value) {
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (value.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

export function verifyCollabToken(token, secret) {
  const raw = String(token || "").trim();
  const dot = raw.lastIndexOf(".");
  if (dot <= 0 || !secret) {
    return { status: "invalid" };
  }

  const payloadB64 = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payloadB64).digest();
  let actual;
  try {
    actual = base64urlDecode(signature);
  } catch {
    return { status: "invalid" };
  }

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return { status: "invalid" };
  }

  try {
    const payload = JSON.parse(base64urlDecode(payloadB64).toString("utf8"));
    if (!payload?.roomId || !payload?.steamId || !payload?.exp) {
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

export function signCollabTokenForTests(payload, secret) {
  const payloadB64 = base64urlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  const signature = base64urlEncode(
    createHmac("sha256", secret).update(payloadB64).digest()
  );
  return `${payloadB64}.${signature}`;
}
