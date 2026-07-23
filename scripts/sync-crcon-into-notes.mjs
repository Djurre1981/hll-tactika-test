/**
 * Ensure HeLO-imported events with crconUrl also list it in description (Notes),
 * and keep match_json crcon fields intact.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeEventMatch } from "../functions/lib/events-store.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

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

const sel = path.join(os.tmpdir(), `crcon-notes-sel-${Date.now()}.sql`);
fs.writeFileSync(
  sel,
  "SELECT id, description, match_json FROM events WHERE match_json LIKE '%crconUrl%';\n"
);
const raw = d1File(sel);
const rows = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1))[0].results;

const stmts = [];
for (const row of rows) {
  const match = sanitizeEventMatch(JSON.parse(row.match_json || "{}"));
  if (!match.crconUrl) {
    console.log("skip (sanitize dropped)", row.id);
    continue;
  }
  let description = String(row.description || "");
  if (!description.includes(match.crconUrl)) {
    description = `${description}${description ? "\n" : ""}CRCON: ${match.crconUrl}`.slice(0, 1000);
  }
  stmts.push(
    `UPDATE events SET match_json = ${esc(JSON.stringify(match))}, description = ${esc(description)}, updated_at = ${esc(new Date().toISOString())} WHERE id = ${esc(row.id)};`
  );
  console.log("ok", row.id, match.crconUrl);
}

if (!stmts.length) {
  console.log("nothing to update");
  process.exit(0);
}

const up = path.join(os.tmpdir(), `crcon-notes-up-${Date.now()}.sql`);
fs.writeFileSync(up, `${stmts.join("\n")}\n`);
d1File(up);
console.log("updated", stmts.length);
