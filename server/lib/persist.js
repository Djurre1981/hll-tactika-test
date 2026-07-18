function apiBase() {
  return String(process.env.API_BASE_URL || "").replace(/\/+$/, "");
}

function persistSecret() {
  return String(process.env.COLLAB_PERSIST_SECRET || "").trim();
}

export function isPresenceRoom(roomId) {
  return String(roomId || "").startsWith("presence:");
}

export async function loadRoomSnapshot(roomId) {
  if (isPresenceRoom(roomId)) return null;
  const base = apiBase();
  const secret = persistSecret();
  if (!base || !secret) return null;

  const url = `${base}/${encodeURIComponent(roomId)}/load`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${secret}`,
    },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`load failed ${res.status}: ${text}`);
  }

  const body = await res.json();
  if (!body?.update) return null;
  return Buffer.from(body.update, "base64");
}

export async function saveRoomSnapshot(roomId, updateBytes, meta = {}) {
  if (isPresenceRoom(roomId)) return;
  const base = apiBase();
  const secret = persistSecret();
  if (!base || !secret) {
    console.warn("[collab] skip save: API_BASE_URL or COLLAB_PERSIST_SECRET missing");
    return;
  }

  const url = `${base}/${encodeURIComponent(roomId)}/save`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      update: Buffer.from(updateBytes).toString("base64"),
      ...meta,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`save failed ${res.status}: ${text}`);
  }
}
