import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: false,
});

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function isExternalHref(href) {
  return /^(https?:|mailto:|tel:)/i.test(href || "");
}

function wikiPageIdFromHref(href) {
  if (!href || isExternalHref(href) || href.startsWith("#")) return null;
  return href
    .replace(/^\.\//, "")
    .replace(/\.md$/i, "")
    .split("/")
    .pop();
}

const renderer = new marked.Renderer();

/** Screenshots are not shipped — render a dark placeholder that matches the glass UI. */
renderer.image = function image({ title, text }) {
  const label = text?.trim() || "Screenshot";
  const alt = escapeAttr(label);
  const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
  const caption = `<figcaption class="wiki-figcaption">${escapeAttr(label)}</figcaption>`;
  return `<figure class="wiki-figure"${titleAttr}><div class="wiki-media-placeholder" role="img" aria-label="${alt}"><span class="wiki-media-placeholder-mark">Screenshot placeholder</span></div>${caption}</figure>`;
};

renderer.link = function link({ href, title, text }) {
  const pageId = wikiPageIdFromHref(href);
  const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
  if (pageId) {
    return `<a href="#wiki/${escapeAttr(pageId)}" data-wiki-page="${escapeAttr(pageId)}"${titleAttr}>${text}</a>`;
  }
  const safe = escapeAttr(href || "#");
  const external = isExternalHref(href)
    ? ` target="_blank" rel="noopener noreferrer"`
    : "";
  return `<a href="${safe}"${titleAttr}${external}>${text}</a>`;
};

/**
 * @param {string} markdown
 * @returns {string}
 */
export function renderWikiMarkdown(markdown) {
  const html = marked.parse(markdown || "", { renderer });
  // marked wraps custom block HTML (figure) in <p> — unwrap for valid DOM
  return String(html)
    .replace(/<p>\s*(<figure[\s\S]*?<\/figure>)\s*<\/p>/gi, "$1")
    .replace(/<p>\s*(<table[\s\S]*?<\/table>)\s*<\/p>/gi, "$1");
}
