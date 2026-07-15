export const ROUTES = {
  HOME: "/home",
  CLIMBING_GUIDE: "/tool/climbing-guide",
  STRATMAKER: "/tool/stratmaker",
};

let onRouteChange = null;
let silent = false;

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

function notify() {
  if (silent || typeof onRouteChange !== "function") return;
  onRouteChange(parseRoute());
}

export function navigate(path, { replace = false, notify: shouldNotify = true } = {}) {
  const url = new URL(path, window.location.origin);
  const next = url.pathname + url.search + url.hash;
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (next === current) {
    if (shouldNotify) notify();
    return parseRoute(url.pathname);
  }
  if (replace) {
    window.history.replaceState({}, "", next);
  } else {
    window.history.pushState({}, "", next);
  }
  if (shouldNotify) notify();
  return parseRoute(url.pathname);
}

export function setRouteChangeHandler(handler) {
  onRouteChange = handler;
}

/** Normalize `/` and unknown paths to `/home` before the first paint of the route. */
export function initRouter({ onRouteChange: handler } = {}) {
  if (handler) onRouteChange = handler;

  const route = parseRoute();
  const search = window.location.search;
  const hash = window.location.hash;
  const pathname = normalizePathname(window.location.pathname);

  if (pathname === "/" || route.name === "unknown") {
    silent = true;
    window.history.replaceState({}, "", ROUTES.HOME + search + hash);
    silent = false;
  }

  window.addEventListener("popstate", () => {
    const next = parseRoute();
    if (next.name === "unknown") {
      navigate(ROUTES.HOME, { replace: true });
      return;
    }
    notify();
  });

  return parseRoute();
}
