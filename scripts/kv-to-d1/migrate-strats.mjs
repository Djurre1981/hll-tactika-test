/**
 * One-time: copy strats blob from KV (or data/strats.json) into D1 rows.
 *
 * Usage:
 *   node scripts/kv-to-d1/migrate-strats.mjs --local
 *   node scripts/kv-to-d1/migrate-strats.mjs --remote
 *   node scripts/kv-to-d1/migrate-strats.mjs --dry-run --remote
 *
 * Expects wrangler + hll-tactika-db. Reads PINS_KV key "strats" when possible;
 * falls back to data/strats.json.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const DB_NAME = "hll-tactika-db";
const KV_KEY = "strats";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const remote = args.has("--remote");
const local = args.has("--local") || !remote;

function sqlEscape(value) {
  if (value == null) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function stratToInsert(strat) {
  const tags = JSON.stringify(strat.tags || {});
  const match = JSON.stringify(strat.match || {});
  const slides = JSON.stringify(strat.slides || []);
  const importSource = strat.importSource ? JSON.stringify(strat.importSource) : null;
  const now = new Date().toISOString();

  return `INSERT OR REPLACE INTO strats
    (id, title, tags, notes, match_json, folder_id, locked, locked_by,
     slides, import_source, created_by, created_by_name, created_at, updated_at)
    VALUES (
      ${sqlEscape(strat.id)},
      ${sqlEscape(strat.title || "Untitled Strat")},
      ${sqlEscape(tags)},
      ${sqlEscape(strat.notes || "")},
      ${sqlEscape(match)},
      ${sqlEscape(strat.folderId || null)},
      ${strat.locked ? 1 : 0},
      ${sqlEscape(strat.lockedBy || null)},
      ${sqlEscape(slides)},
      ${sqlEscape(importSource)},
      ${sqlEscape(strat.createdBy || "unknown")},
      ${sqlEscape(strat.createdByName || null)},
      ${sqlEscape(strat.createdAt || now)},
      ${sqlEscape(strat.updatedAt || now)}
    );`;
}

function loadFromSeed() {
  const seedPath = path.join(root, "public/data/strats.json");
  const raw = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  return raw.strats || [];
}

function loadFromKv() {
  const flag = remote ? "--remote" : "--local";
  try {
    const out = execFileSync(
      "npx",
      ["wrangler", "kv", "key", "get", KV_KEY, "--binding", "PINS_KV", flag],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    const parsed = JSON.parse(out);
    return parsed.strats || [];
  } catch (error) {
    console.warn("KV read failed, falling back to data/strats.json:", error.message);
    return loadFromSeed();
  }
}

function applySql(sql) {
  const flag = remote ? "--remote" : "--local";
  const tmp = path.join(root, `.tmp-migrate-strats-${Date.now()}.sql`);
  fs.writeFileSync(tmp, sql, "utf8");
  try {
    execFileSync(
      "npx",
      ["wrangler", "d1", "execute", DB_NAME, flag, "--file", tmp],
      { cwd: root, stdio: "inherit" }
    );
  } finally {
    fs.unlinkSync(tmp);
  }
}

const strats = loadFromKv();
console.log(`Found ${strats.length} strat(s) to migrate (${remote ? "remote" : "local"})`);

if (strats.length === 0) {
  console.log("Nothing to migrate.");
  process.exit(0);
}

const sql = strats.map(stratToInsert).join("\n");
if (dryRun) {
  console.log(sql.slice(0, 2000));
  console.log(`\n… dry-run: would insert ${strats.length} row(s)`);
  process.exit(0);
}

applySql(sql);
console.log(`Migrated ${strats.length} strat(s) into D1.`);
