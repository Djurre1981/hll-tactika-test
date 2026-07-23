#!/usr/bin/env node
/**
 * Backfill slim player_match_stats from HeLO player_stats for imported events.
 *
 *   node scripts/backfill-helo-player-stats.mjs
 *   node scripts/backfill-helo-player-stats.mjs --apply --local-d1
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeEventMatch } from "../functions/lib/events-store.js";
import { DEFAULT_SERIES, HELO_BASE } from "./lib/helo-mapper.mjs";
import {
  extractCircleSlimStats,
  slimStatToInsertSql,
} from "./lib/helo-player-stats.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRANGLER_JS = path.join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
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

function wranglerD1(flag, { file, command } = {}) {
  const args = [WRANGLER_JS, "d1", "execute", DB_NAME, flag, "--json", "-y"];
  let tmpToDelete = null;
  if (command && flag === "--remote") {
    args.push(`--command=${command}`);
  } else if (file) {
    args.push("--file", file);
  } else if (command) {
    tmpToDelete = path.join(os.tmpdir(), `helo-stats-cmd-${Date.now()}.sql`);
    fs.writeFileSync(tmpToDelete, `${command}\n`);
    args.push("--file", tmpToDelete);
  } else {
    throw new Error("wranglerD1 requires file or command");
  }
  try {
    return execFileSync(process.execPath, args, {
      cwd: ROOT,
      encoding: "utf8",
      windowsHide: true,
    });
  } finally {
    if (tmpToDelete) {
      try {
        fs.unlinkSync(tmpToDelete);
      } catch {
        /* ignore */
      }
    }
  }
}

function parseWranglerJson(out) {
  const text = String(out || "");
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < start) {
    throw new Error(`No JSON array in wrangler output:\n${text.slice(0, 400)}`);
  }
  return JSON.parse(text.slice(start, end + 1));
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
  const selectSql = "SELECT id, match_json FROM events WHERE match_json LIKE '%heloMatchId%'";
  let raw;
  if (flag === "--remote") {
    raw = wranglerD1(flag, { command: selectSql });
  } else {
    const sel = path.join(os.tmpdir(), `helo-stats-sel-${Date.now()}.sql`);
    fs.writeFileSync(sel, `${selectSql}\n`);
    try {
      raw = wranglerD1(flag, { file: sel });
    } finally {
      try {
        fs.unlinkSync(sel);
      } catch {
        /* ignore */
      }
    }
  }

  const rows = (parseWranglerJson(raw)[0].results || []).filter(
    (r) => r && typeof r.id === "string" && typeof r.match_json === "string"
  );

  console.log(`Events with HeLO id: ${rows.length}`);

  const inserts = [];
  let fetched = 0;
  let withStats = 0;
  let errors = 0;

  for (const row of rows) {
    const match = sanitizeEventMatch(JSON.parse(row.match_json || "{}"));
    if (!match.heloMatchId) continue;
    try {
      const helo = await fetchHeloMatch(opts.series, match.heloMatchId);
      fetched += 1;
      const stats = extractCircleSlimStats(helo, row.id, match.faction);
      if (stats.length) withStats += 1;
      console.log(
        `ok  ${match.heloMatchId.padEnd(28)} players=${stats.length} faction=${match.faction || "?"}`
      );
      inserts.push(...stats);
    } catch (err) {
      errors += 1;
      console.error(`fail ${match.heloMatchId}: ${err.message}`);
    }
  }

  console.log(`\nFetched=${fetched} withStats=${withStats} rows=${inserts.length} errors=${errors}`);

  if (!opts.apply) {
    console.log("Dry-run only. Re-run with --apply --local-d1 to write.");
    return;
  }

  if (!inserts.length) {
    console.log("Nothing to write.");
    return;
  }

  const now = new Date().toISOString();
  const CHUNK = 40;
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const chunk = inserts.slice(i, i + CHUNK);
    const tmp = path.join(os.tmpdir(), `helo-stats-up-${Date.now()}-${i}.sql`);
    fs.writeFileSync(tmp, `${chunk.map((s) => slimStatToInsertSql(s, now)).join("\n")}\n`);
    wranglerD1(flag, { file: tmp });
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
  console.log(`Applied ${inserts.length} player_match_stats rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
