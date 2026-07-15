export const ROUTES = {
  HOME: "/home",
  CLIMBING_GUIDE: "/tool/climbing-guide",
  STRATMAKER: "/tool/stratmaker",
};

function normalizePathname(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

export function parseRoute(pathname = window.location.pathname) {
  const path = normalizePathname(pathname);
  if (path === "/" || path === ROUTES.HOME) {
    return { name: "home", path: ROUTES.HOME, mode: null, tool: null };
  }
  if (path === ROUTES.CLIMBING_GUIDE) {
    return {
      name: "climbing-guide",
      path: ROUTES.CLIMBING_GUIDE,
      mode: "viewer",
      tool: "climbing-guide",
    };
  }
  if (path === ROUTES.STRATMAKER) {
    return {
      name: "stratmaker",
      path: ROUTES.STRATMAKER,
      mode: "strats",
      tool: "stratmaker",
    };
  }
  return { name: "unknown", path, mode: null, tool: null };
}

export function pathForMode(mode) {
  if (mode === "strats") return ROUTES.STRATMAKER;
  if (mode === "viewer" || mode === "editor") return ROUTES.CLIMBING_GUIDE;
  return ROUTES.HOME;
}

export function getRoute() {
  return parseRoute();
}

/** Full navigation between MPA pages (and same-document assign). */
export function go(path, { replace = false } = {}) {
  const url = new URL(path, window.location.origin);
  const next = url.pathname + url.search + url.hash;
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (next === current) return parseRoute(url.pathname);
  if (replace) {
    window.location.replace(next);
  } else {
    window.location.assign(next);
  }
  return parseRoute(url.pathname);
}

/** @deprecated Use go() — soft History routing is no longer used across pages. */
export function navigate(path, { replace = false } = {}) {
  return go(path, { replace });
}
