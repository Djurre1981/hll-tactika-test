export function parseMediaUrl(url) {
  if (!url) return null;
  try {
    return new URL(url);
  } catch {
    try {
      return new URL(url, "https://localhost/");
    } catch {
      return null;
    }
  }
}

export function getHostname(url) {
  const parsed = parseMediaUrl(url);
  return parsed?.hostname.replace(/^www\./, "") || "";
}

/** Absolute https URLs only — blocks javascript:/data:/http: etc. */
export function isSafeHttpUrl(url) {
  const parsed = parseMediaUrl(url);
  if (!parsed) return false;
  if (parsed.protocol !== "https:") {
    return false;
  }
  // Relative app paths rebased against localhost are not "safe external" URLs
  // when the original string was not absolute; callers should handle /api/ first.
  const original = String(url || "").trim();
  if (original.startsWith("/") && !original.startsWith("//")) {
    return false;
  }
  return Boolean(parsed.hostname);
}

export function isDiscordMediaUrl(url) {
  const hostname = getHostname(url);
  if (hostname !== "cdn.discordapp.com" && hostname !== "media.discordapp.net") {
    return false;
  }
  const parsed = parseMediaUrl(url);
  if (parsed?.protocol !== "https:") {
    return false;
  }
  return parsed?.pathname.includes("/attachments/") ?? false;
}

export function extractDiscordAttachmentId(url) {
  if (!isDiscordMediaUrl(url)) {
    return null;
  }
  const parsed = parseMediaUrl(url);
  const match = parsed?.pathname.match(/\/attachments\/\d+\/(\d+)(?:\/|$)/);
  return match?.[1] || null;
}
