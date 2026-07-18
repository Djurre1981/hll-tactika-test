const API_BASE = "/api";

export class ApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export async function apiClient(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    ...options,
  });

  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && body.error) ||
      res.statusText ||
      "Request failed";
    throw new ApiError(String(message), { status: res.status, body });
  }

  return body;
}
