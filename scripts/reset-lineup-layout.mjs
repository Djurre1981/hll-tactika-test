/**
 * Reset local test LineUp to sparse one-squad-per-sector default.
 * Usage: node scripts/reset-lineup-layout.mjs
 *        npm exec wrangler d1 execute hll-tactika-db --local --file scripts/_reset-lineup.sql
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDefaultLayout } from "../functions/lib/lineup-layouts.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const eventId = process.argv[2] || "event-lineup-test-hca-fap-2026-07-26";
const rosterSize = Number(process.argv[3]) || 49;

const layout = buildDefaultLayout(rosterSize);
const json = JSON.stringify(layout).replaceAll("'", "''");
const now = new Date().toISOString();
const sql = `UPDATE lineups
SET layout_json = '${json}',
    roster_size = ${rosterSize},
    locked = 0,
    locked_by = NULL,
    locked_at = NULL,
    updated_at = '${now}'
WHERE event_id = '${eventId}';
`;

const out = join(root, "scripts/_reset-lineup.sql");
writeFileSync(out, sql, "utf8");

console.log(
  "Sectors:",
  layout.sectors.map((s) => `${s.label}: ${s.squads.map((q) => q.label).join(", ")}`).join(" | ")
);
console.log("Wrote", out);
