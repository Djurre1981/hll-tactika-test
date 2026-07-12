async function pinApiRequest(url, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

export async function createPin(mapId, pin) {
  const data = await pinApiRequest("/api/pins", {
    method: "POST",
    body: JSON.stringify({ mapId, pin }),
  });
  return data.pin;
}

export async function updatePin(mapId, pinId, pin) {
  const data = await pinApiRequest(`/api/pins/${encodeURIComponent(pinId)}`, {
    method: "PUT",
    body: JSON.stringify({ mapId, pin }),
  });
  return data.pin;
}

export async function deletePin(mapId, pinId) {
  await pinApiRequest(
    `/api/pins/${encodeURIComponent(pinId)}?mapId=${encodeURIComponent(mapId)}`,
    { method: "DELETE" }
  );
}

export async function fetchPinsCatalog() {
  const response = await fetch("/api/pins", { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error("Failed to load pins");
  }
  return response.json();
}
