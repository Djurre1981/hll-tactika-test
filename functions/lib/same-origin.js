import { errorResponse } from "./response.js";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Reject cross-site cookie-authenticated mutations.
 * Skips non-mutating methods and Steam OpenID callback (browser top-level GET).
 */
export function assertSameOrigin(request) {
  const method = request.method.toUpperCase();
  if (!MUTATING.has(method)) {
    return null;
  }

  const url = new URL(request.url);
  if (url.pathname === "/api/auth/callback") {
    return null;
  }

  // Collab server (Render) persists via Bearer secret — not cookie CSRF.
  if (
    url.pathname.startsWith("/api/rooms/") &&
    (url.pathname.endsWith("/save") || url.pathname.endsWith("/load"))
  ) {
    return null;
  }

  const origin = request.headers.get("Origin");
  if (origin) {
    if (origin !== url.origin) {
      return errorResponse("Cross-origin request blocked", 403);
    }
    return null;
  }

  const site = request.headers.get("Sec-Fetch-Site");
  if (site === "cross-site") {
    return errorResponse("Cross-origin request blocked", 403);
  }

  return null;
}
