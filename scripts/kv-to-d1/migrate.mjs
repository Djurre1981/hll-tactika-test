/**
 * One-time KV → D1 migration (Phase 0).
 * Lead roadmap: migrate existing KV `pins` and `users` into D1.
 * Keeps KV blobs as backup (does not delete).
 *
 * Usage:
 *   node scripts/kv-to-d1/migrate.mjs --dry-run
 *   node scripts/kv-to-d1/migrate.mjs --remote
 *   node scripts/kv-to-d1/migrate.mjs --remote --preview
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { buildPinRows, buildUserRows } from "./transform.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const BACKUP_DIR = path.join(ROOT, "data", "kv-d1-backup");

const NS_PROD = "25a3a121f49e4bc082cfa7d565d0890d";
const NS_PREVIEW = "e5ed67e5071744a290fa94f020905a6c";
const DB_NAME = "hll-tactika-db";

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
    remote: argv.includes("--remote"),
    preview: argv.includes("--preview"),
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

function wrangler(args, { input } = {}) {
  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["wrangler", ...args],
    {
      cwd: ROOT,
      encoding: "utf8",
      input,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `wrangler ${args.join(" ")} failed:\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

function getKvJson(key, namespaceId, remote) {
  const args = [
    "kv",
    "key",
    "get",
    key,
    "--namespace-id",
    namespaceId,
  ];
  if (remote) args.push("--remote");
  else args.push("--local");
  const raw = wrangler(args).trim();
  if (!raw) return null;
  return JSON.parse(raw);
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function pinInsertSql(row) {
  return (
    "INSERT INTO pins (" +
    "id, map_id, title, description, tag, faction, x, y, dir_x, dir_y, " +
    "video_url, thumbnail, requires_json, media_items_json, created_by, created_by_name, " +
    "source_discord_message_id, created_at, updated_at" +
    ") VALUES (" +
    [
      row.id,
      row.map_id,
      row.title,
      row.description,
      row.tag,
      row.faction,
      row.x,
      row.y,
      row.dir_x,
      row.dir_y,
      row.video_url,
      row.thumbnail,
      row.requires_json,
      row.media_items_json,
      row.created_by,
      row.created_by_name,
      row.source_discord_message_id,
      row.created_at,
      row.updated_at,
    ]
      .map(sqlLiteral)
      .join(", ") +
    ") ON CONFLICT(id) DO UPDATE SET " +
    "map_id=excluded.map_id, title=excluded.title, description=excluded.description, " +
    "tag=excluded.tag, faction=excluded.faction, x=excluded.x, y=excluded.y, " +
    "dir_x=excluded.dir_x, dir_y=excluded.dir_y, video_url=excluded.video_url, " +
    "thumbnail=excluded.thumbnail, requires_json=excluded.requires_json, " +
    "media_items_json=excluded.media_items_json, created_by=excluded.created_by, " +
    "created_by_name=excluded.created_by_name, " +
    "source_discord_message_id=excluded.source_discord_message_id, updated_at=excluded.updated_at;"
  );
}

function userInsertSql(row) {
  return (
    "INSERT INTO users (steam_id, role, display_name, avatar_url, preferences_json, created_at, updated_at) VALUES (" +
    [
      row.steam_id,
      row.role,
      row.display_name,
      row.avatar_url,
      row.preferences_json,
      row.created_at,
      row.updated_at,
    ]
      .map(sqlLiteral)
      .join(", ") +
    ") ON CONFLICT(steam_id) DO UPDATE SET " +
    "role=excluded.role, display_name=excluded.display_name, avatar_url=excluded.avatar_url, " +
    "preferences_json=excluded.preferences_json, updated_at=excluded.updated_at;"
  );
}

function revokedInsertSql(steamId) {
  return (
    "INSERT INTO revoked_users (steam_id, revoked_at) VALUES (" +
    `${sqlLiteral(steamId)}, datetime('now')` +
    ") ON CONFLICT(steam_id) DO NOTHING;"
  );
}

function writeBackup(name, data) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const file = path.join(BACKUP_DIR, `${name}-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

function applySql(sql, { remote, preview, dryRun }) {
  if (dryRun) {
    console.log(`\n-- dry-run SQL (${sql.split("\n").length} lines) --`);
    console.log(sql.slice(0, 2000) + (sql.length > 2000 ? "\n…\n" : ""));
    return;
  }

  const tmp = path.join(BACKUP_DIR, `apply-${Date.now()}.sql`);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.writeFileSync(tmp, sql);

  const args = ["d1", "execute", DB_NAME, "--file", tmp];
  if (remote) args.push("--remote");
  else args.push("--local");
  if (preview) args.push("--preview");

  console.log(`Applying SQL via: wrangler ${args.join(" ")}`);
  console.log(wrangler(args));
  fs.unlinkSync(tmp);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`Usage: node scripts/kv-to-d1/migrate.mjs [--dry-run] [--remote] [--preview]

Migrates KV keys "pins" and "users" into D1 (Phase 0, lead roadmap).
Does not delete KV keys. Writes JSON backups under data/kv-d1-backup/.`);
    process.exit(0);
  }

  if (!opts.remote && !opts.dryRun) {
    console.log("Tip: pass --remote to target Cloudflare, or --dry-run to preview.");
  }

  const namespaceId = opts.preview ? NS_PREVIEW : NS_PROD;
  console.log(`KV namespace: ${namespaceId} (${opts.preview ? "preview" : "production"})`);
  console.log(`D1 target: ${DB_NAME} (${opts.remote ? "remote" : "local"}${opts.preview ? ", preview" : ""})`);

  const pinsData = getKvJson("pins", namespaceId, opts.remote);
  const usersData = getKvJson("users", namespaceId, opts.remote);

  if (!pinsData?.pins) {
    throw new Error('KV key "pins" missing or invalid');
  }
  if (!usersData?.users) {
    throw new Error('KV key "users" missing or invalid');
  }

  const pinsBackup = writeBackup("pins", pinsData);
  const usersBackup = writeBackup("users", usersData);
  console.log(`Backup pins → ${pinsBackup}`);
  console.log(`Backup users → ${usersBackup}`);

  const pinRows = buildPinRows(pinsData);
  const { users: userRows, revoked } = buildUserRows(usersData);

  console.log(`Pins to upsert: ${pinRows.length}`);
  console.log(`Users to upsert: ${userRows.length}`);
  console.log(`Revoked to upsert: ${revoked.length}`);

  const statements = [
    "PRAGMA foreign_keys = ON;",
    ...pinRows.map(pinInsertSql),
    ...userRows.map(userInsertSql),
    ...revoked.map(revokedInsertSql),
  ];
  const sql = statements.join("\n");

  applySql(sql, opts);

  if (!opts.dryRun) {
    console.log("\nDone. KV keys left intact as backup.");
    console.log("Verify with:");
    console.log(
      `  npx wrangler d1 execute ${DB_NAME} ${opts.remote ? "--remote" : "--local"}${opts.preview ? " --preview" : ""} --command "SELECT COUNT(*) AS pins FROM pins; SELECT COUNT(*) AS users FROM users;"`,
    );
  }
}

main();
