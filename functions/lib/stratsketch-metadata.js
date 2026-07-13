const STRATSKETCH_ORIGIN = "https://stratsketch.com";

export function buildStratSketchScreenshotUrl(code, revision, { slideId } = {}) {
  const params = new URLSearchParams({ revision: String(revision) });
  if (slideId != null) {
    params.set("slide", String(slideId));
  }
  return `${STRATSKETCH_ORIGIN}/api/screenshot/${code}.webp?${params}`;
}

export function resolveStratSketchCreator(persistedUsers = []) {
  const named = persistedUsers.filter((user) => user?.name);
  if (!named.length) return null;
  const sorted = [...named].sort((a, b) => a.role - b.role);
  return sorted[0].name;
}

export function parseStratSketchPageMetadata(nextData, html = "") {
  const briefing = nextData?.props?.pageProps?.briefing || {};
  const ogImage = html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1] || null;

  return {
    code: briefing.code || null,
    name: briefing.name || null,
    host: briefing.host || null,
    revision: briefing.revision ?? null,
    game: briefing.game || null,
    screenshotUrl: ogImage
      || (briefing.code && briefing.revision != null
        ? buildStratSketchScreenshotUrl(briefing.code, briefing.revision)
        : null),
    createdAt: briefing.createdAt || briefing.created || null,
    creatorUsername: briefing.username || briefing.author || briefing.creator || null,
  };
}
