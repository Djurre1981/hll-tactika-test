#!/usr/bin/env node
/**
 * Import The Circle HeLO match history into Tactika calendar events.
 *
 * Usage:
 *   node scripts/import-helo-history.mjs
 *   node scripts/import-helo-history.mjs --only Circle-PF-2026-07-12
 *   node scripts/import-helo-history.mjs --type competitive
 *   node scripts/import-helo-history.mjs --apply --local-d1
 *   node scripts/import-helo-history.mjs --apply
 *
 * Env for --apply (HTTP):
 *   TACTIKA_BASE_URL          e.g. http://127.0.0.1:8788 or https://your-deploy.pages.dev
 *   TACTIKA_SESSION_COOKIE    full Cookie header value including hll-tactika-session=…
 *
 * --apply --local-d1 writes into local wrangler D1 (hll-tactika-db) without HTTP auth.
 */

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SERIES,
  DEFAULT_TEAM_TAG,
  HELO_BASE,
  heloMatchToEvent,
} from "./lib/helo-mapper.mjs";
import {
  extractCircleSlimStats,
  slimStatToInsertSql,
} from "./lib/helo-player-stats.mjs";
import {
  HELO_TEAM_TAG_JR,
  resolveCompTeam,
} from "../functions/lib/comp-teams.js";

const PAGE_SIZE = 50;
const DB_NAME = "hll-tactika-db";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRANGLER_JS = path.join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
const IMPORT_ACTOR = "helo-import";

function parseArgs(argv) {
  const opts = {
    apply: false,
    localD1: false,
    remoteD1: false,
    only: null,
    type: null,
    team: DEFAULT_TEAM_TAG,
    series: DEFAULT_SERIES,
    fetchDetails: true,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") opts.apply = true;
    else if (arg === "--local-d1") opts.localD1 = true;
    else if (arg === "--remote-d1") opts.remoteD1 = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--only") opts.only = String(argv[++i] || "").trim() || null;
    else if (arg === "--type") opts.type = String(argv[++i] || "").trim().toLowerCase() || null;
    else if (arg === "--team") opts.team = String(argv[++i] || "").trim() || DEFAULT_TEAM_TAG;
    else if (arg === "--series") opts.series = String(argv[++i] || "").trim() || DEFAULT_SERIES;
    else if (arg === "--no-details") opts.fetchDetails = false;
    else {
      console.error(`Unknown argument: ${arg}`);
      opts.help = true;
    }
  }
  if (opts.type && opts.type !== "competitive" && opts.type !== "friendly") {
    console.error(`--type must be competitive or friendly (got ${opts.type})`);
    opts.help = true;
  }
  if (opts.localD1 && opts.remoteD1) {
    console.error("Use only one of --local-d1 / --remote-d1");
    opts.help = true;
  }
  return opts;
}

function printHelp() {
  console.log(`Import HeLO matches into Tactika calendar.

Usage:
  node scripts/import-helo-history.mjs [options]

Options:
  --only <match_id>   Import a single HeLO match_id
  --type <kind>       Filter: competitive | friendly
  --team <tag>        Team: Circle | jr | circle-jr | ${HELO_TEAM_TAG_JR} (default: Circle)
  --series <tag>      HeLO series (default: 2024)
  --no-details        Skip per-match detail fetch (no participants/stats)
  --apply             Write events (default: dry-run)
  --local-d1          With --apply: insert into local wrangler D1
  --remote-d1         With --apply: insert into remote wrangler D1
  --help              Show this help

Env (--apply without --*-d1):
  TACTIKA_BASE_URL
  TACTIKA_SESSION_COOKIE
`);
}

function sqlEscape(value) {
  if (value == null) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function wranglerD1(flag, { command, file } = {}) {
  const args = [WRANGLER_JS, "d1", "execute", DB_NAME, flag, "--json", "-y"];
  let tmpToDelete = null;
  // Remote --file often returns a summary instead of SELECT rows; --command works.
  // Local --command can be mangled by shells, so local prefers --file.
  if (command && flag === "--remote") {
    args.push(`--command=${command}`);
  } else if (file) {
    args.push("--file", file);
  } else if (command) {
    tmpToDelete = path.join(os.tmpdir(), `helo-cmd-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`);
    fs.writeFileSync(tmpToDelete, `${command}\n`, "utf8");
    args.push("--file", tmpToDelete);
  } else {
    throw new Error("wranglerD1 requires command or file");
  }
  try {
    return execFileSync(process.execPath, args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
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

/** Wrangler often prints progress lines before the JSON array when using --remote. */
function parseWranglerJson(out) {
  const text = String(out || "");
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < start) {
    throw new Error(`No JSON array in wrangler output:\n${text.slice(0, 400)}`);
  }
  return JSON.parse(text.slice(start, end + 1));
}

function fetchExistingHeloIdsFromD1(flag) {
  let out;
  if (flag === "--remote") {
    out = wranglerD1(flag, {
      command: "SELECT match_json FROM events WHERE match_json LIKE '%heloMatchId%';",
    });
  } else {
    const tmp = path.join(os.tmpdir(), `helo-existing-${Date.now()}.sql`);
    fs.writeFileSync(
      tmp,
      "SELECT match_json FROM events WHERE match_json LIKE '%heloMatchId%';\n",
      "utf8"
    );
    try {
      out = wranglerD1(flag, { file: tmp });
    } finally {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  }
  const ids = new Set();
  let parsed;
  try {
    parsed = parseWranglerJson(out);
  } catch {
    return ids;
  }
  const rows = parsed?.[0]?.results || parsed?.results || [];
  for (const row of rows) {
    // Ignore wrangler summary rows that are not SELECT results.
    if (!row || typeof row.match_json !== "string") continue;
    try {
      const match = JSON.parse(row.match_json || "{}");
      const id = String(match.heloMatchId || "").trim();
      if (id) ids.add(id);
    } catch {
      /* ignore */
    }
  }
  return ids;
}

function eventToInsertSql(event) {
  const now = new Date().toISOString();
  const id = `event-${randomUUID()}`;
  const matchJson = JSON.stringify(event.match || {});
  const componentsJson = JSON.stringify({
    stratIds: [],
    routePlanIds: [],
    whiteboardIds: [],
    rosterId: null,
  });
  return {
    id,
    sql: `INSERT INTO events
      (id, title, description, starts_at, ends_at, event_type, match_json, components_json,
       locked, lock_override, locked_by, locked_at, created_by, created_at, updated_at)
      VALUES (
        ${sqlEscape(id)},
        ${sqlEscape(event.title)},
        ${sqlEscape(event.description || "")},
        ${sqlEscape(event.startsAt)},
        ${sqlEscape(event.endsAt || "")},
        ${sqlEscape(event.eventType || "other")},
        ${sqlEscape(matchJson)},
        ${sqlEscape(componentsJson)},
        0, 0, NULL, NULL,
        ${sqlEscape(IMPORT_ACTOR)},
        ${sqlEscape(now)},
        ${sqlEscape(now)}
      );`,
  };
}

function playerStatsSqlForMapped(row, eventId) {
  const helo = row.heloMatch;
  if (!helo) return [];
  const faction = row.event?.match?.faction || "";
  const stats = extractCircleSlimStats(helo, eventId, faction);
  const now = new Date().toISOString();
  return stats.map((stat) => slimStatToInsertSql(stat, now));
}

function ensureEventsSchema(flag) {
  const out = wranglerD1(flag, {
    command: "PRAGMA table_info(events);",
  });
  let parsed;
  try {
    parsed = parseWranglerJson(out);
  } catch (err) {
    throw new Error(`Could not read events schema: ${err.message}\n${out}`);
  }
  const rows = parsed?.[0]?.results || parsed?.results || [];
  const cols = new Set(rows.filter((r) => r && typeof r.name === "string").map((r) => r.name));
  if (cols.size === 0) {
    throw new Error(`Could not read events columns from PRAGMA (got ${rows.length} result row(s))`);
  }
  const alters = [];
  if (!cols.has("event_type")) {
    alters.push("ALTER TABLE events ADD COLUMN event_type TEXT NOT NULL DEFAULT 'other';");
  }
  if (!cols.has("match_json")) {
    alters.push("ALTER TABLE events ADD COLUMN match_json TEXT NOT NULL DEFAULT '{}';");
  }
  if (!cols.has("components_json")) {
    alters.push("ALTER TABLE events ADD COLUMN components_json TEXT NOT NULL DEFAULT '{}';");
  }
  if (!cols.has("description")) {
    alters.push("ALTER TABLE events ADD COLUMN description TEXT");
  }
  if (!cols.has("locked")) {
    alters.push("ALTER TABLE events ADD COLUMN locked INTEGER NOT NULL DEFAULT 0");
  }
  if (!cols.has("lock_override")) {
    alters.push("ALTER TABLE events ADD COLUMN lock_override INTEGER NOT NULL DEFAULT 0");
  }
  if (!cols.has("locked_by")) {
    alters.push("ALTER TABLE events ADD COLUMN locked_by TEXT");
  }
  if (!cols.has("locked_at")) {
    alters.push("ALTER TABLE events ADD COLUMN locked_at TEXT");
  }
  if (alters.length === 0) return;
  console.log(`Repairing local events schema (${alters.length} column(s))…`);
  const tmp = path.join(os.tmpdir(), `helo-schema-${Date.now()}.sql`);
  fs.writeFileSync(tmp, `${alters.join(";\n")};\n`, "utf8");
  try {
    wranglerD1(flag, { file: tmp });
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function applyViaD1(mapped, flag) {
  // Remote schema comes from migrations; local may need column repair for older DBs.
  if (flag !== "--remote") ensureEventsSchema(flag);
  console.log(`\nLoading existing HeLO ids from D1 (${flag}) …`);
  const existing = fetchExistingHeloIdsFromD1(flag);
  console.log(`Existing imported HeLO matches: ${existing.size}`);

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const batch = [];

  for (const row of mapped) {
    if (existing.has(row.heloMatchId)) {
      skipped += 1;
      console.log(`skip  ${row.heloMatchId}`);
      continue;
    }
    const { id, sql } = eventToInsertSql(row.event);
    const statsSql = playerStatsSqlForMapped(row, id);
    batch.push({ heloMatchId: row.heloMatchId, id, sql, statsSql });
  }

  // Execute in chunks via temp SQL files (wrangler command length limits)
  const CHUNK = 8;
  for (let i = 0; i < batch.length; i += CHUNK) {
    const chunk = batch.slice(i, i + CHUNK);
    const tmp = path.join(os.tmpdir(), `helo-import-${Date.now()}-${i}.sql`);
    const parts = [];
    for (const item of chunk) {
      parts.push(item.sql);
      parts.push(...(item.statsSql || []));
    }
    fs.writeFileSync(tmp, parts.join("\n"), "utf8");
    try {
      wranglerD1(flag, { file: tmp });
      for (const item of chunk) {
        created += 1;
        existing.add(item.heloMatchId);
        const nStats = item.statsSql?.length || 0;
        console.log(`ok    ${item.heloMatchId} → ${item.id}${nStats ? ` (+${nStats} player stats)` : ""}`);
      }
    } catch (err) {
      failed += chunk.length;
      console.error(`fail  chunk @${i}: ${err.message}`);
      if (err.stderr) console.error(err.stderr);
    } finally {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  }

  console.log(`\nDone. created=${created} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET ${url} → ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchAllHeloMatches({ team, series }) {
  const matches = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const url = new URL(`${HELO_BASE}/v3/series/${encodeURIComponent(series)}/matches`);
    url.searchParams.set("tag", team);
    url.searchParams.set("desc", "true");
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(offset));
    const page = await fetchJson(url);
    const batch = Array.isArray(page.matches) ? page.matches : [];
    total = Number(page.meta?.total_count ?? page.meta?.count ?? batch.length);
    matches.push(...batch);
    if (batch.length === 0) break;
    offset += batch.length;
  }
  return matches;
}

async function fetchOneHeloMatch({ series, matchId }) {
  const url = `${HELO_BASE}/v3/series/${encodeURIComponent(series)}/matches/${encodeURIComponent(matchId)}`;
  return fetchJson(url);
}

async function fetchExistingHeloIds(baseUrl, cookie) {
  const ids = new Set();
  // Cover HeLO series span with yearly windows
  for (let year = 2023; year <= 2027; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const url = `${baseUrl.replace(/\/$/, "")}/api/events?year=${year}&month=${month}`;
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          Cookie: cookie,
        },
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Auth failed listing events (${res.status}). Check TACTIKA_SESSION_COOKIE.`);
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`GET ${url} → ${res.status} ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      const events = Array.isArray(data.events) ? data.events : Array.isArray(data) ? data : [];
      for (const event of events) {
        const id = String(event?.match?.heloMatchId || "").trim();
        if (id) ids.add(id);
      }
    }
  }
  return ids;
}

async function createTactikaEvent(baseUrl, cookie, event) {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/events`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify(event),
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`POST /api/events → ${res.status} ${text.slice(0, 400)}`);
  }
  return body;
}

function formatRow(mapped) {
  const e = mapped.event;
  return [
    mapped.heloMatchId.padEnd(28),
    e.eventType.padEnd(6),
    e.match.result.padEnd(4),
    e.match.faction.padEnd(6),
    e.match.mapId.padEnd(14),
    e.startsAt.slice(0, 10),
    e.match.opponent,
  ].join("  ");
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const resolvedTeam = resolveCompTeam(opts.team);
  const heloTeamTag = resolvedTeam?.heloTag || opts.team;
  if (!resolvedTeam && opts.team !== DEFAULT_TEAM_TAG) {
    console.warn(
      `Warning: unknown --team "${opts.team}" — using as raw HeLO tag (match.team will default to sr).`
    );
  } else {
    console.log(
      `Team: ${resolvedTeam?.label || "Circle"} (HeLO tag=${heloTeamTag}, match.team=${resolvedTeam?.id || "sr"})`
    );
  }

  let heloMatches;
  if (opts.only) {
    const one = await fetchOneHeloMatch({ series: opts.series, matchId: opts.only });
    heloMatches = [one];
  } else {
    heloMatches = await fetchAllHeloMatches({ team: heloTeamTag, series: opts.series });
  }

  if (opts.type) {
    heloMatches = heloMatches.filter(
      (m) => String(m.type || "").toLowerCase() === opts.type
    );
  }

  if (opts.fetchDetails && heloMatches.length) {
    console.log(`Fetching match details for ${heloMatches.length} match(es)…`);
    const detailed = [];
    for (let i = 0; i < heloMatches.length; i += 1) {
      const summary = heloMatches[i];
      const matchId = String(summary?.match_id || "").trim();
      if (!matchId) {
        detailed.push(summary);
        continue;
      }
      try {
        const full = await fetchOneHeloMatch({ series: opts.series, matchId });
        detailed.push(full && typeof full === "object" ? { ...summary, ...full } : summary);
      } catch (err) {
        console.warn(`  detail fail ${matchId}: ${err.message}`);
        detailed.push(summary);
      }
      if ((i + 1) % 10 === 0 || i === heloMatches.length - 1) {
        console.log(`  details ${i + 1}/${heloMatches.length}`);
      }
    }
    heloMatches = detailed;
  }

  const mapped = [];
  const errors = [];
  const warnings = [];
  for (const helo of heloMatches) {
    const result = heloMatchToEvent(helo, { teamTag: heloTeamTag, series: opts.series });
    if (result.error) {
      errors.push(result.error);
      continue;
    }
    warnings.push(...result.warnings);
    mapped.push({ ...result, heloMatch: helo });
  }

  console.log(`HeLO matches fetched: ${heloMatches.length}`);
  console.log(`Mapped OK: ${mapped.length}  errors: ${errors.length}`);
  if (errors.length) {
    console.log("\nErrors:");
    for (const err of errors) console.log(`  - ${err}`);
  }
  if (warnings.length) {
    console.log("\nWarnings:");
    for (const w of warnings) console.log(`  - ${w}`);
  }

  console.log("\nmatch_id                      type    res   side    map             date        opponent");
  console.log("-".repeat(100));
  for (const row of mapped) {
    console.log(formatRow(row));
  }

  if (!opts.apply) {
    console.log(`\nDry-run only. Re-run with --apply to create events.`);
    return;
  }

  if (opts.localD1 || opts.remoteD1) {
    applyViaD1(mapped, opts.remoteD1 ? "--remote" : "--local");
    return;
  }

  const baseUrl = String(process.env.TACTIKA_BASE_URL || "").trim();
  const cookie = String(process.env.TACTIKA_SESSION_COOKIE || "").trim();
  if (!baseUrl || !cookie) {
    console.error(
      "\n--apply requires TACTIKA_BASE_URL and TACTIKA_SESSION_COOKIE, or use --local-d1 / --remote-d1."
    );
    process.exit(1);
  }

  console.log(`\nLoading existing HeLO ids from ${baseUrl} …`);
  const existing = await fetchExistingHeloIds(baseUrl, cookie);
  console.log(`Existing imported HeLO matches: ${existing.size}`);

  let created = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of mapped) {
    if (existing.has(row.heloMatchId)) {
      skipped += 1;
      console.log(`skip  ${row.heloMatchId}`);
      continue;
    }
    try {
      const body = await createTactikaEvent(baseUrl, cookie, row.event);
      const id = body?.event?.id || body?.id || "?";
      created += 1;
      existing.add(row.heloMatchId);
      console.log(`ok    ${row.heloMatchId} → ${id}`);
    } catch (err) {
      failed += 1;
      console.error(`fail  ${row.heloMatchId}: ${err.message}`);
    }
  }

  console.log(`\nDone. created=${created} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
