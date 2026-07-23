import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

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

test("wiki Home and linked media resolve", () => {
  const home = fs.readFileSync(path.join(wikiDir, "Home.md"), "utf8");
  assert.match(home, /Getting started/i);
  const mediaRefs = [...home.matchAll(/!\[[^\]]*\]\((media\/[^)]+)\)/g)].map(
    (m) => m[1]
  );
  assert.ok(mediaRefs.length >= 1);
  for (const rel of mediaRefs) {
    assert.ok(
      fs.existsSync(path.join(wikiDir, rel)),
      `missing media ${rel}`
    );
  }
});

test("wiki markdown renders via marked", () => {
  const md = fs.readFileSync(path.join(wikiDir, "Getting-Started.md"), "utf8");
  const html = marked.parse(md);
  assert.match(String(html), /<h1>/i);
  assert.match(String(html), /Sign in/i);
});
