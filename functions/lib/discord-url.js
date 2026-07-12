function parseMediaUrl(url) {
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

function getHostname(url) {
  const parsed = parseMediaUrl(url);
  return parsed?.hostname.replace(/^www\./, "") || "";
}

export function isDiscordMediaUrl(url) {
  const hostname = getHostname(url);
  if (hostname !== "cdn.discordapp.com" && hostname !== "media.discordapp.net") {
    return false;
  }
  const parsed = parseMediaUrl(url);
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
