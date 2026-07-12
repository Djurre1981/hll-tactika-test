async function stratsApiRequest(url, options = {}) {
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

export async function fetchStratsCatalog() {
  return stratsApiRequest("/api/strats");
}

export async function createStrat(strat) {
  const data = await stratsApiRequest("/api/strats", {
    method: "POST",
    body: JSON.stringify({ strat }),
  });
  return data.strat;
}

export async function updateStrat(stratId, strat) {
  const data = await stratsApiRequest(`/api/strats/${encodeURIComponent(stratId)}`, {
    method: "PUT",
    body: JSON.stringify({ strat }),
  });
  return data.strat;
}

export async function deleteStrat(stratId) {
  await stratsApiRequest(`/api/strats/${encodeURIComponent(stratId)}`, {
    method: "DELETE",
  });
}

export async function duplicateStrat(stratId, { title } = {}) {
  const data = await stratsApiRequest(`/api/strats/${encodeURIComponent(stratId)}/duplicate`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  return data.strat;
}

export async function duplicateSlide(stratId, slideId, { targetStratId, name } = {}) {
  const data = await stratsApiRequest(
    `/api/strats/${encodeURIComponent(stratId)}/slides/${encodeURIComponent(slideId)}/duplicate`,
    {
      method: "POST",
      body: JSON.stringify({ targetStratId, name }),
    }
  );
  return data;
}
