import { apiClient } from "../api-client.js";

/** Session 431df7 — dual sink: local ingest + CF KV (production-safe). */
export function dbgPresence(hypothesisId, location, message, data = {}) {
  const payload = {
    sessionId: "431df7",
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  // #region agent log
  fetch("http://127.0.0.1:7690/ingest/c0931af6-dcb4-42f7-b0ac-3e61b92aee3b", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "431df7",
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
  void apiClient("/collab/debug-log", {
    method: "POST",
    body: JSON.stringify(payload),
  }).catch(() => {});
  try {
    const w = typeof window !== "undefined" ? window : null;
    if (w) {
      w.__TACTIKA_PRESENCE_DEBUG__ = w.__TACTIKA_PRESENCE_DEBUG__ || [];
      w.__TACTIKA_PRESENCE_DEBUG__.push(payload);
      if (w.__TACTIKA_PRESENCE_DEBUG__.length > 50) {
        w.__TACTIKA_PRESENCE_DEBUG__.shift();
      }
    }
  } catch {
    /* ignore */
  }
  // #endregion
}
