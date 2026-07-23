#!/usr/bin/env node
/**
 * Ensure match.team is set on HeLO-imported calendar events.
 * Existing Circle imports → "sr". Events whose heloMatchId / title look like Jr → "jr".
 *
 *   node scripts/backfill-match-team.mjs
 *   node scripts/backfill-match-team.mjs --apply --local-d1
 *   node scripts/backfill-match-team.mjs --apply --remote-d1
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeEventMatch } from "../functions/lib/events-store.js";
import { HELO_TEAM_TAG_JR } from "../functions/lib/comp-teams.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRANGLER_JS = path.join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
const DB_NAME = "hll-tactika-db";
const JR = HELO_TEAM_TAG_JR;

function parseArgs(argv) {
  const opts = { apply: false, localD1: false, remoteD1: false };
  for (const arg of argv) {
    if (arg === "--apply") opts.apply = true;
    else if (arg === "--local-d1") opts.localD1 = true;
    else if (arg === "--remote-d1") opts.remoteD1 = true;
  }
  return opts;
}

function esc(value) {
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
    tmpToDelete = path.join(os.tmpdir(), `helo-team-cmd-${Date.now()}.sql`);
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

function inferTeam(match, title = "") {
  const existing = String(match?.team || "").trim();
  if (existing === "jr" || existing === "sr") return existing;
  const heloId = String(match?.heloMatchId || "");
  // Jr-reported match ids start with ◯- ; "Circle-◯-…" is senior Circle vs Jr.
  if (heloId.startsWith(`${JR}-`)) return "jr";
  if (/^Jr\s/i.test(String(title || "").trim())) return "jr";
  return "sr";
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.localD1 && !opts.remoteD1) {
    console.error("Pass --local-d1 or --remote-d1 (dry-run without --apply).");
    process.exit(1);
  }
  const flag = opts.remoteD1 ? "--remote" : "--local";

  const out = wranglerD1(flag, {
    command: "SELECT id, title, match_json FROM events WHERE match_json LIKE '%heloMatchId%';",
  });
  const parsed = parseWranglerJson(out);
  const rows = parsed?.[0]?.results || parsed?.results || [];

  const updates = [];
  for (const row of rows) {
    if (!row || typeof row.match_json !== "string") continue;
    let match;
    try {
      match = JSON.parse(row.match_json || "{}");
    } catch {
      continue;
    }
    if (!match?.heloMatchId) continue;
    const team = inferTeam(match, row.title || "");
    if (match.team === team) continue;
    const next = sanitizeEventMatch({ ...match, team });
    updates.push({ id: row.id, heloMatchId: match.heloMatchId, from: match.team || "(none)", to: team, match: next });
  }

  console.log(`HeLO events scanned: ${rows.filter((r) => r?.match_json).length}`);
  console.log(`Need team backfill: ${updates.length}`);
  for (const u of updates.slice(0, 20)) {
    console.log(`  ${u.heloMatchId.padEnd(28)} ${u.from} → ${u.to}`);
  }
  if (updates.length > 20) console.log(`  … +${updates.length - 20} more`);

  if (!opts.apply) {
    console.log("\nDry-run only. Re-run with --apply to write.");
    return;
  }

  const CHUNK = 25;
  let written = 0;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    const tmp = path.join(os.tmpdir(), `helo-team-bf-${Date.now()}-${i}.sql`);
    const sql = chunk
      .map(
        (u) =>
          `UPDATE events SET match_json = ${esc(JSON.stringify(u.match))}, updated_at = ${esc(new Date().toISOString())} WHERE id = ${esc(u.id)};`
      )
      .join("\n");
    fs.writeFileSync(tmp, `${sql}\n`, "utf8");
    try {
      wranglerD1(flag, { file: tmp });
      written += chunk.length;
    } finally {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  }
  console.log(`\nDone. updated=${written}`);
}

main();
