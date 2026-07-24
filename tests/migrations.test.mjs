/**
 * Schema / migration smoke checks for PR #34 (T1 + folders sort_order fix).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("T1 migration 0014_event_components", () => {
  it("adds components_json column with default empty object", () => {
    const sql = readFileSync(join(root, "migrations/0014_event_components.sql"), "utf8");
    assert.match(sql, /components_json/i);
    assert.match(sql, /DEFAULT\s+'\{\}'/i);
    assert.match(sql, /ALTER TABLE events/i);
  });
});

describe("LineUp migration 0024_lineups", () => {
  it("adds roster_size and lineups table", () => {
    const sql = readFileSync(join(root, "migrations/0024_lineups.sql"), "utf8");
    assert.match(sql, /roster_size/i);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS lineups/i);
  });
});

describe("PR #34 migration 0015_strat_folders_sort_order", () => {
  it("adds sort_order expected by folders-store", () => {
    const sql = readFileSync(join(root, "migrations/0015_strat_folders_sort_order.sql"), "utf8");
    assert.match(sql, /sort_order/i);
    assert.match(sql, /strat_folders/i);
  });

  it("folders-store orders by sort_order", async () => {
    const source = readFileSync(join(root, "functions/lib/folders-store.js"), "utf8");
    assert.match(source, /sort_order/);
    assert.match(source, /ORDER BY sort_order/i);
  });
});

describe("T2 migration 0016_event_match_json", () => {
  it("adds match_json column with default empty object", () => {
    const sql = readFileSync(join(root, "migrations/0016_event_match_json.sql"), "utf8");
    assert.match(sql, /match_json/i);
    assert.match(sql, /DEFAULT\s+'\{\}'/i);
    assert.match(sql, /ALTER TABLE events/i);
  });
});

describe("T9 migration 0017_prep_tasks", () => {
  it("creates prep_tasks table", () => {
    const sql = readFileSync(join(root, "migrations/0017_prep_tasks.sql"), "utf8");
    assert.match(sql, /CREATE TABLE IF NOT EXISTS prep_tasks/i);
    assert.match(sql, /assignee_steam_id/i);
  });
});

describe("Event lock migration 0018_event_lock", () => {
  it("adds lock columns on events", () => {
    const sql = readFileSync(join(root, "migrations/0018_event_lock.sql"), "utf8");
    assert.match(sql, /locked INTEGER/i);
    assert.match(sql, /lock_override INTEGER/i);
    assert.match(sql, /locked_by TEXT/i);
    assert.match(sql, /locked_at TEXT/i);
    assert.match(sql, /ALTER TABLE events/i);
  });
});

describe("Tool lock migration 0019_tool_lock", () => {
  it("adds lock columns on route plans and whiteboards", () => {
    const sql = readFileSync(join(root, "migrations/0019_tool_lock.sql"), "utf8");
    assert.match(sql, /route_plans ADD COLUMN locked/i);
    assert.match(sql, /whiteboards ADD COLUMN locked/i);
  });
});
