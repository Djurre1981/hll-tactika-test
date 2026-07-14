export function base64urlEncode(bytes) {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlDecode(value) {
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

export async function signPayload(payloadB64, secret) {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return base64urlEncode(sig);
}

export async function verifySignature(payloadB64, signature, secret) {
  const key = await importHmacKey(secret);
  const sigBytes = base64urlDecode(signature);
  return crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(payloadB64));
}
