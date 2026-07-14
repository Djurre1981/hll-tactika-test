import { showEditorToast } from "../ui/editor-toast.js";

const DEDUPE_MS = 2500;
let lastShownAt = 0;
let lastMessage = "";

/** Toast when a rate limit is hit. Dedupes rapid parallel 429s. */
export function notifyRateLimited(message) {
  const text = String(message || "").trim() || "Request limit reached. Try again shortly.";
  const now = Date.now();
  if (text === lastMessage && now - lastShownAt < DEDUPE_MS) return;
  lastMessage = text;
  lastShownAt = now;
  showEditorToast(text, { durationMs: 5000 });
}

/**
 * If response is 429, toast the server message and throw with .status = 429.
 * @returns {false} when not rate-limited
 */
export function throwIfRateLimited(response, data, fallbackMessage) {
  if (response.status !== 429) return false;
  const message =
    (data && data.error) ||
    fallbackMessage ||
    "Request limit reached. Try again shortly.";
  notifyRateLimited(message);
  const error = new Error(message);
  error.status = 429;
  error.rateLimitNotified = true;
  throw error;
}

/** True when the UI already toasted this rate-limit error. */
export function wasRateLimitNotified(error) {
  return Boolean(error?.rateLimitNotified || error?.status === 429);
}
