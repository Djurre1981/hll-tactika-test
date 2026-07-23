/** Bundled wiki pages + media from docs/wiki (synced with GitHub wiki). */

const mdModules = import.meta.glob("../../../docs/wiki/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

const mediaModules = import.meta.glob("../../../docs/wiki/media/**/*", {
  query: "?url",
  import: "default",
  eager: true,
});

const SKIP_PAGES = new Set(["README"]);

function pageIdFromPath(modPath) {
  const base = modPath.split("/").pop() || "";
  return base.replace(/\.md$/i, "");
}

/** @type {Record<string, string>} */
export const wikiPages = {};
for (const [modPath, raw] of Object.entries(mdModules)) {
  const id = pageIdFromPath(modPath);
  if (!id || id.startsWith("_") || SKIP_PAGES.has(id)) continue;
  wikiPages[id] = typeof raw === "string" ? raw : String(raw ?? "");
}

/** @type {Record<string, string>} */
export const wikiMedia = {};
for (const [modPath, url] of Object.entries(mediaModules)) {
  const idx = modPath.lastIndexOf("/media/");
  const rel =
    idx >= 0
      ? modPath.slice(idx + 1) // media/...
      : `media/${modPath.split("/").pop()}`;
  wikiMedia[rel.replace(/\\/g, "/")] = url;
}

export function resolveWikiMedia(href) {
  if (!href) return href;
  if (/^https?:\/\//i.test(href) || href.startsWith("data:")) return href;
  const cleaned = href.replace(/^\.\//, "").replace(/^\/+/, "");
  if (wikiMedia[cleaned]) return wikiMedia[cleaned];
  if (wikiMedia[`media/${cleaned}`]) return wikiMedia[`media/${cleaned}`];
  const bare = cleaned.split("/").pop();
  for (const [key, url] of Object.entries(wikiMedia)) {
    if (key.endsWith(`/${bare}`) || key === bare) return url;
  }
  return href;
}

/**
 * Parse GitHub-wiki `_Sidebar.md` into nav sections.
 * @param {string} md
 */
export function parseWikiSidebar(md) {
  const sections = [];
  let current = null;
  for (const line of (md || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    const sec = /^\*\*(.+)\*\*$/.exec(trimmed);
    if (sec) {
      current = { title: sec[1], pages: [] };
      sections.push(current);
      continue;
    }
    const link = /^\*\s*\[([^\]]+)\]\(([^)]+)\)/.exec(trimmed);
    if (link && current) {
      current.pages.push({ title: link[1], id: link[2] });
    }
  }
  return sections;
}

export const wikiSidebarRaw =
  mdModules["../../../docs/wiki/_Sidebar.md"] ||
  Object.entries(mdModules).find(([p]) => p.endsWith("/_Sidebar.md"))?.[1] ||
  "";

export const wikiNav = parseWikiSidebar(
  typeof wikiSidebarRaw === "string" ? wikiSidebarRaw : ""
);

export function getWikiPage(id) {
  if (!id) return null;
  if (wikiPages[id]) return { id, markdown: wikiPages[id] };
  const hit = Object.keys(wikiPages).find(
    (k) => k.toLowerCase() === String(id).toLowerCase()
  );
  return hit ? { id: hit, markdown: wikiPages[hit] } : null;
}
