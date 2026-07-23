#!/usr/bin/env node
/**
 * Backfill match.participantSteamIds on HeLO-imported events from HeLO player_stats
 * (Steam ID64s on Circle's side). Same IDs appear on CRCON scoreboards.
 *
 *   node scripts/backfill-helo-participants.mjs
 *   node scripts/backfill-helo-participants.mjs --apply --local-d1
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeEventMatch } from "../functions/lib/events-store.js";
import { DEFAULT_SERIES, HELO_BASE } from "./lib/helo-mapper.mjs";
import { extractCircleParticipantSteamIds } from "./lib/helo-participants.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NPX = process.platform === "win32" ? "npx.cmd" : "npx";
const DB_NAME = "hll-tactika-db";

function parseArgs(argv) {
  const opts = { apply: false, localD1: false, remoteD1: false, series: DEFAULT_SERIES };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") opts.apply = true;
    else if (arg === "--local-d1") opts.localD1 = true;
    else if (arg === "--remote-d1") opts.remoteD1 = true;
    else if (arg === "--series") opts.series = String(argv[++i] || DEFAULT_SERIES);
  }
  return opts;
}

function esc(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function wranglerD1(flag, file) {
  return execFileSync(
    NPX,
    ["wrangler", "d1", "execute", DB_NAME, flag, "--json", "-y", "--file", file],
    { cwd: ROOT, encoding: "utf8", shell: process.platform === "win32" }
  );
}

async function fetchHeloMatch(series, matchId) {
  const url = `${HELO_BASE}/v3/series/${encodeURIComponent(series)}/matches/${encodeURIComponent(matchId)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HeLO ${matchId} → ${res.status}`);
  return res.json();
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.apply && !(opts.localD1 || opts.remoteD1)) {
    console.error("Use --apply with --local-d1 or --remote-d1");
    process.exit(1);
  }

  const flag = opts.remoteD1 ? "--remote" : "--local";
  const sel = path.join(os.tmpdir(), `helo-part-sel-${Date.now()}.sql`);
  fs.writeFileSync(
    sel,
    "SELECT id, match_json FROM events WHERE match_json LIKE '%heloMatchId%';\n"
  );
  const raw = wranglerD1(flag, sel);
  const rows = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1))[0].results;

  console.log(`Events with HeLO id: ${rows.length}`);

  const updates = [];
  let fetched = 0;
  let withPlayers = 0;
  let errors = 0;

  for (const row of rows) {
    const match = sanitizeEventMatch(JSON.parse(row.match_json || "{}"));
    if (!match.heloMatchId) continue;
    try {
      const helo = await fetchHeloMatch(opts.series, match.heloMatchId);
      fetched += 1;
      const ids = extractCircleParticipantSteamIds(helo, match.faction);
      if (ids.length) withPlayers += 1;
      const next = sanitizeEventMatch({ ...match, participantSteamIds: ids });
      const changed =
        JSON.stringify(match.participantSteamIds || []) !==
        JSON.stringify(next.participantSteamIds);
      console.log(
        `${changed ? "upd" : "ok "} ${match.heloMatchId.padEnd(28)} players=${ids.length} faction=${match.faction || "?"}`
      );
      if (changed) {
        updates.push({ id: row.id, match: next });
      }
    } catch (err) {
      errors += 1;
      console.error(`fail ${match.heloMatchId}: ${err.message}`);
    }
  }

  console.log(`\nFetched=${fetched} withPlayers=${withPlayers} toUpdate=${updates.length} errors=${errors}`);

  if (!opts.apply) {
    console.log("Dry-run only. Re-run with --apply --local-d1 to write.");
    return;
  }

  if (!updates.length) {
    console.log("Nothing to write.");
    return;
  }

  const CHUNK = 20;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    const tmp = path.join(os.tmpdir(), `helo-part-up-${Date.now()}-${i}.sql`);
    const now = new Date().toISOString();
    const sql = chunk
      .map(
        (u) =>
          `UPDATE events SET match_json = ${esc(JSON.stringify(u.match))}, updated_at = ${esc(now)} WHERE id = ${esc(u.id)};`
      )
      .join("\n");
    fs.writeFileSync(tmp, `${sql}\n`);
    wranglerD1(flag, tmp);
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
  console.log(`Applied ${updates.length} updates.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
