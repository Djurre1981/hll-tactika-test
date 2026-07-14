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
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function fetchMapMarkers(mapId) {
  return pinApiRequest(`/api/pins?mapId=${encodeURIComponent(mapId)}`);
}

export async function fetchPinDetail(mapId, pinId, detailToken) {
  const url = `/api/pins/${encodeURIComponent(pinId)}/details?mapId=${encodeURIComponent(mapId)}&token=${encodeURIComponent(detailToken)}`;
  const response = await fetch(url, { credentials: "same-origin" });
  const data = await response.json().catch(() => ({}));
  if (response.status === 498) {
    const error = new Error(data.error || "Detail token expired");
    error.status = 498;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data.pin;
}

export async function refreshPinDetailToken(mapId, pinId) {
  const data = await pinApiRequest(`/api/pins/${encodeURIComponent(pinId)}/token`, {
    method: "POST",
    body: JSON.stringify({ mapId }),
  });
  return data.detailToken;
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

/** Apply many pin field updates in one request / one KV write. */
export async function batchUpdatePins(mapId, pins) {
  const data = await pinApiRequest("/api/pins", {
    method: "PATCH",
    body: JSON.stringify({ mapId, pins }),
  });
  return data.pins || [];
}

export async function deletePin(mapId, pinId) {
  await pinApiRequest(
    `/api/pins/${encodeURIComponent(pinId)}?mapId=${encodeURIComponent(mapId)}`,
    { method: "DELETE" }
  );
}

/** Upload a still and set pin.thumbnail only if still empty (any signed-in member). */
export async function fillPinThumbnail(mapId, pinId, file) {
  const formData = new FormData();
  formData.append("mapId", mapId);
  formData.append("file", file);

  const response = await fetch(`/api/pins/${encodeURIComponent(pinId)}/thumbnail`, {
    method: "POST",
    credentials: "same-origin",
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

/** Persist a YouTube/Medal (or other) CDN still when pin.thumbnail is empty. */
export async function fillPinThumbnailUrl(mapId, pinId, thumbnailUrl) {
  const data = await pinApiRequest(`/api/pins/${encodeURIComponent(pinId)}/thumbnail`, {
    method: "POST",
    body: JSON.stringify({ mapId, thumbnailUrl }),
  });
  return data;
}
