#!/usr/bin/env node
/**
 * Add HeLO participant Steam IDs (from player_match_stats / match.participantSteamIds)
 * into the shared Comp Roster (roster-default). Does not grant site access.
 *
 *   node scripts/seed-roster-from-helo-events.mjs --local-d1
 *   node scripts/seed-roster-from-helo-events.mjs --apply --remote-d1
 *   node scripts/seed-roster-from-helo-events.mjs --apply --remote-d1 --team jr
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeCompTeamId } from "../functions/lib/comp-teams.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRANGLER_JS = path.join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
const DB_NAME = "hll-tactika-db";
const DEFAULT_ROSTER_ID = "roster-default";
const STEAM_RE = /^7656119\d{10}$/;

function parseArgs(argv) {
  const opts = {
    apply: false,
    localD1: false,
    remoteD1: false,
    team: null,
    rosterId: DEFAULT_ROSTER_ID,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") opts.apply = true;
    else if (arg === "--local-d1") opts.localD1 = true;
    else if (arg === "--remote-d1") opts.remoteD1 = true;
    else if (arg === "--team") opts.team = String(argv[++i] || "").trim() || null;
    else if (arg === "--roster") opts.rosterId = String(argv[++i] || "").trim() || DEFAULT_ROSTER_ID;
  }
  return opts;
}

function esc(value) {
  if (value == null) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function wranglerD1(flag, { file, command } = {}) {
  const args = [WRANGLER_JS, "d1", "execute", DB_NAME, flag, "--json", "-y"];
  let tmpToDelete = null;
  if (command && flag === "--remote") {
    args.push(`--command=${command}`);
  } else if (file) {
    args.push("--file", file);
  } else if (command) {
    tmpToDelete = path.join(os.tmpdir(), `roster-seed-cmd-${Date.now()}.sql`);
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

function queryRows(flag, command) {
  const out = wranglerD1(flag, { command });
  const parsed = parseWranglerJson(out);
  return parsed?.[0]?.results || parsed?.results || [];
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.localD1 && !opts.remoteD1) {
    console.error("Pass --local-d1 or --remote-d1");
    process.exit(1);
  }
  const flag = opts.remoteD1 ? "--remote" : "--local";
  const teamFilter = opts.team ? normalizeCompTeamId(opts.team) : null;

  const eventRows = queryRows(
    flag,
    "SELECT id, match_json FROM events WHERE match_json LIKE '%participantSteamIds%' OR match_json LIKE '%heloMatchId%';"
  );

  /** @type {Map<string, string>} */
  const namesBySteam = new Map();
  const steamIds = new Set();

  for (const row of eventRows) {
    if (!row || typeof row.match_json !== "string") continue;
    let match;
    try {
      match = JSON.parse(row.match_json || "{}");
    } catch {
      continue;
    }
    if (teamFilter && normalizeCompTeamId(match.team) !== teamFilter) continue;
    const list = Array.isArray(match.participantSteamIds) ? match.participantSteamIds : [];
    for (const raw of list) {
      const id = String(raw || "").trim();
      if (STEAM_RE.test(id)) steamIds.add(id);
    }
  }

  const statRows = queryRows(
    flag,
    "SELECT steam_id, display_name FROM player_match_stats WHERE steam_id IS NOT NULL"
  );
  for (const row of statRows) {
    const id = String(row?.steam_id || "").trim();
    if (!STEAM_RE.test(id)) continue;
    // Only keep names for steam ids we care about when team-filtered; otherwise all stats names help
    if (teamFilter && !steamIds.has(id)) continue;
    if (!teamFilter) steamIds.add(id);
    const name = String(row?.display_name || "").trim();
    if (name && !namesBySteam.has(id)) namesBySteam.set(id, name.slice(0, 120));
  }

  const existingMembers = queryRows(
    flag,
    "SELECT id, steam_id, display_name FROM roster_members WHERE steam_id IS NOT NULL"
  );
  const memberBySteam = new Map();
  for (const row of existingMembers) {
    const id = String(row?.steam_id || "").trim();
    if (STEAM_RE.test(id)) memberBySteam.set(id, row);
  }

  const memberships = queryRows(
    flag,
    `SELECT member_id FROM roster_memberships WHERE roster_id = '${opts.rosterId.replace(/'/g, "''")}'`
  );
  const onRoster = new Set(memberships.map((r) => String(r.member_id || "").trim()).filter(Boolean));

  const now = new Date().toISOString();
  const inserts = [];
  let createCount = 0;
  let linkCount = 0;
  let skipCount = 0;

  for (const steamId of [...steamIds].sort()) {
    let member = memberBySteam.get(steamId);
    if (!member) {
      const memberId = `member-${randomUUID()}`;
      const displayName =
        namesBySteam.get(steamId) || `Player ${steamId.slice(-4)}`;
      inserts.push(
        `INSERT INTO roster_members
          (id, display_name, steam_id, t17_id, avatar_url, roster_role, tournaments, situation,
           status, notes, sort_order, created_by, created_at, updated_at)
         VALUES (
           ${esc(memberId)},
           ${esc(displayName)},
           ${esc(steamId)},
           NULL, NULL, NULL, '[]', 'member', 'active',
           ${esc("Seeded from HeLO participants")},
           0,
           ${esc("helo-roster-seed")},
           ${esc(now)},
           ${esc(now)}
         );`
      );
      member = { id: memberId, steam_id: steamId };
      memberBySteam.set(steamId, member);
      createCount += 1;
    }

    if (onRoster.has(member.id)) {
      skipCount += 1;
      continue;
    }
    inserts.push(
      `INSERT OR IGNORE INTO roster_memberships (roster_id, member_id, roster_role, sort_order, created_at)
       VALUES (${esc(opts.rosterId)}, ${esc(member.id)}, NULL, 0, ${esc(now)});`
    );
    onRoster.add(member.id);
    linkCount += 1;
  }

  console.log(`Steam IDs from events${teamFilter ? ` (team=${teamFilter})` : ""}: ${steamIds.size}`);
  console.log(`Would create members: ${createCount}`);
  console.log(`Would link to ${opts.rosterId}: ${linkCount}`);
  console.log(`Already on roster: ${skipCount}`);

  if (!opts.apply) {
    console.log("\nDry-run only. Re-run with --apply to write.");
    return;
  }

  if (!inserts.length) {
    console.log("Nothing to write.");
    return;
  }

  const CHUNK = 20;
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const chunk = inserts.slice(i, i + CHUNK);
    const tmp = path.join(os.tmpdir(), `roster-seed-${Date.now()}-${i}.sql`);
    fs.writeFileSync(tmp, `${chunk.join("\n")}\n`, "utf8");
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
  console.log(`\nDone. created=${createCount} linked=${linkCount}`);
}

main();
