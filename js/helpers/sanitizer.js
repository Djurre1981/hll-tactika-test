export function escapeHtml(value) {
  return value
    .replaceAll("&", "&" + "amp;")
    .replaceAll("<", "&" + "lt;")
    .replaceAll(">", "&" + "gt;")
    .replaceAll('"', "&" + "quot;");
}

/** Safe for href/src: app-relative paths or http(s) only. */
export function safeUrlAttr(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (value.startsWith("/") && !value.startsWith("//")) {
    return escapeHtml(value);
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:") {
      return escapeHtml(parsed.href);
    }
  } catch {
    /* ignore */
  }
  return "";
}
