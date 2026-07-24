/**
 * Notification intents (T0e stub).
 * Call sites enqueue intents; Discord delivery wires later.
 */

/**
 * @param {object} env
 * @param {{ type: string, eventId?: string, steamId?: string, reasonCode?: string|null, reasonNote?: string|null, meta?: object }} intent
 */
export async function enqueueNotification(env, intent) {
  const type = String(intent?.type || "").trim();
  if (!type) return { ok: false, skipped: true, reason: "missing_type" };

  // Soft-fail until Discord bot (T0e) is live.
  if (env?.NOTIFICATIONS_DEBUG === "1" || env?.NOTIFICATIONS_DEBUG === "true") {
    console.info("[notifications]", JSON.stringify({ ...intent, type, at: new Date().toISOString() }));
  }

  return { ok: true, delivered: false, stub: true, type };
}
