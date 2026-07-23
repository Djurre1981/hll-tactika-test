/**
 * One-shot: attach high-confidence CRCON links found via browser scrape
 * onto local D1 HeLO-imported events.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

const LINKS = [
  { helo: "Circle-PF-2026-07-12", id: 96379, url: "https://stats4.the-circle.team/games/96379" },
  { helo: "Circle-PF-2026-06-27", id: 94969, url: "https://stats4.the-circle.team/games/94969" },
  { helo: "Circle-HTD-2026-06-14", id: 93643, url: "https://stats4.the-circle.team/games/93643" },
  { helo: "Circle-GID-2026-05-31", id: 92348, url: "https://stats4.the-circle.team/games/92348" },
  { helo: "Circle-82AD-2026-05-24", id: 91690, url: "https://stats4.the-circle.team/games/91690" },
];

function esc(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function d1File(file) {
  return execFileSync(
    NPX,
    ["wrangler", "d1", "execute", "hll-tactika-db", "--local", "--json", "-y", "--file", file],
    { cwd: ROOT, encoding: "utf8", shell: process.platform === "win32" }
  );
}

const sel = path.join(os.tmpdir(), `helo-crcon-sel-${Date.now()}.sql`);
fs.writeFileSync(sel, "SELECT id, match_json FROM events WHERE match_json LIKE '%heloMatchId%';\n");
const raw = d1File(sel);
const start = raw.indexOf("[");
const end = raw.lastIndexOf("]");
const rows = JSON.parse(raw.slice(start, end + 1))[0].results;

const byHelo = new Map();
for (const row of rows) {
  const match = JSON.parse(row.match_json || "{}");
  if (match.heloMatchId) byHelo.set(match.heloMatchId, { id: row.id, match });
}

const stmts = [];
for (const link of LINKS) {
  const row = byHelo.get(link.helo);
  if (!row) {
    console.log("missing", link.helo);
    continue;
  }
  const match = {
    ...row.match,
    crconGameId: String(link.id),
    crconUrl: link.url,
  };
  stmts.push(
    `UPDATE events SET match_json = ${esc(JSON.stringify(match))}, updated_at = ${esc(new Date().toISOString())} WHERE id = ${esc(row.id)};`
  );
  console.log("update", link.helo, "->", link.url);
}

const up = path.join(os.tmpdir(), `helo-crcon-up-${Date.now()}.sql`);
fs.writeFileSync(up, `${stmts.join("\n")}\n`);
d1File(up);
console.log("done", stmts.length);
