/** Root-absolute path for static assets (safe under nested SPA routes like /tool/...). */
export function assetUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }
  return path.startsWith("/") ? path : `/${path}`;
}
