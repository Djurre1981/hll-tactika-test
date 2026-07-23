import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import { renderWikiMarkdown } from "../src/features/help/renderWikiMarkdown.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wikiDir = path.join(root, "docs", "wiki");

function parseSidebar(md) {
  const sections = [];
  let current = null;
  for (const line of md.split(/\r?\n/)) {
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

test("wiki sidebar pages exist as markdown files", () => {
  const sidebar = fs.readFileSync(path.join(wikiDir, "_Sidebar.md"), "utf8");
  const nav = parseSidebar(sidebar);
  assert.ok(nav.length >= 2, "expected multiple sidebar sections");
  for (const section of nav) {
    for (const page of section.pages) {
      const file = path.join(wikiDir, `${page.id}.md`);
      assert.ok(fs.existsSync(file), `missing ${page.id}.md`);
    }
  }
});

test("wiki Home has no GitHub wiki referral and uses placeholders", () => {
  const home = fs.readFileSync(path.join(wikiDir, "Home.md"), "utf8");
  assert.match(home, /Getting started/i);
  assert.doesNotMatch(home, /github\.com\/.*\/wiki/i);
  assert.doesNotMatch(home, /GitHub wiki/i);
  assert.match(home, /!\[[^\]]*\]\(placeholder\)/);
});

test("wiki pages do not ship screenshot media files", () => {
  const mediaDir = path.join(wikiDir, "media");
  if (!fs.existsSync(mediaDir)) return;
  const files = fs
    .readdirSync(mediaDir)
    .filter((f) => !f.startsWith(".") && f !== ".gitkeep");
  assert.deepEqual(files, [], `unexpected media files: ${files.join(", ")}`);
});

test("wiki markdown renders via marked", () => {
  const md = fs.readFileSync(path.join(wikiDir, "Getting-Started.md"), "utf8");
  const html = marked.parse(md);
  assert.match(String(html), /<h1>/i);
  assert.match(String(html), /Sign in/i);
});

test("wiki image markdown becomes dark placeholders", () => {
  const html = renderWikiMarkdown("![Hub overview](placeholder)");
  assert.match(html, /wiki-media-placeholder/);
  assert.match(html, /Screenshot placeholder/);
  assert.doesNotMatch(html, /<img\b/i);
});
