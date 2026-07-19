import { errorResponse } from "./response.js";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isLoopbackHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/** Treat localhost / 127.0.0.1 (and matching ports) as the same site for local CSRF. */
function originsMatch(originHeader, requestUrl) {
  if (originHeader === requestUrl.origin) return true;
  try {
    const from = new URL(originHeader);
    if (from.protocol !== requestUrl.protocol) return false;
    if (!isLoopbackHost(from.hostname) || !isLoopbackHost(requestUrl.hostname)) {
      return false;
    }
    const fromPort = from.port || (from.protocol === "https:" ? "443" : "80");
    const toPort = requestUrl.port || (requestUrl.protocol === "https:" ? "443" : "80");
    if (fromPort === toPort) return true;
    // Vite HMR (:5173) proxies /api to wrangler Pages (:8788).
    const vite = fromPort === "5173" || fromPort === "5174";
    const api = toPort === "8788" || toPort === "8787";
    return vite && api;
  } catch {
    return false;
  }
}

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
    if (!originsMatch(origin, url)) {
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
