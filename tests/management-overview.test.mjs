import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRankFilter,
  buildParticipationBoard,
  buildRoleDepth,
  computeEventReadiness,
  filterEventsByPeriod,
  mergeCombatIntoFormBoard,
  splitFormBoard,
  summarizeRsvpCounts,
} from "../src/features/management/overview-utils.js";
import { extractCircleSlimStats } from "../scripts/lib/helo-player-stats.mjs";
import { sanitizeRsvpStatus, summarizeRsvpCounts as serverRsvpCounts } from "../functions/lib/rsvps-store.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("management overview utils", () => {
  const events = [
    {
      id: "e1",
      startsAt: "2026-06-01T18:00:00.000Z",
      eventType: "comp",
      match: { result: "win", participantSteamIds: ["76561198014575147"] },
      components: { stratIds: ["s1"], routePlanIds: [], whiteboardIds: [], rosterId: "r1" },
    },
    {
      id: "e2",
      startsAt: "2026-06-08T18:00:00.000Z",
      eventType: "comp",
      match: { result: "loss", participantSteamIds: ["76561198014575147", "76561198884648099"] },
      components: { stratIds: [], routePlanIds: [], whiteboardIds: [], rosterId: null },
    },
  ];

  const members = [
    { id: "m1", steamId: "76561198014575147", displayName: "Alpha", status: "active", rosterRole: "infantry" },
    { id: "m2", steamId: "76561198884648099", displayName: "Bravo", status: "active", rosterRoles: ["commander"] },
  ];

  it("ranks participation board by games played", () => {
    const board = buildParticipationBoard(events, members, {
      now: new Date("2026-07-01T00:00:00.000Z"),
    });
    assert.equal(board.poolSize, 2);
    assert.equal(board.rows[0].steamId, "76561198014575147");
    assert.equal(board.rows[0].gamesPlayed, 2);
    assert.equal(board.rows[0].winRate, 50);
    assert.equal(board.rows[1].gamesPlayed, 1);
  });

  it("filters events by period and reverses rank filter", () => {
    const now = new Date("2026-07-01T00:00:00.000Z");
    const windowed = filterEventsByPeriod(events, "30d", now);
    assert.equal(windowed.length, 2);
    const oldOnly = filterEventsByPeriod(
      [...events, { id: "old", startsAt: "2024-01-01T00:00:00.000Z" }],
      "year",
      now
    );
    assert.equal(oldOnly.length, 2);
    const ranked = applyRankFilter(
      [
        { steamId: "a", gamesPlayed: 10, winRate: 80 },
        { steamId: "b", gamesPlayed: 3, winRate: 20 },
      ],
      "worst",
      "gamesPlayed"
    );
    assert.equal(ranked[0].steamId, "b");
  });

  it("computes readiness from tools and open tasks", () => {
    const ready = computeEventReadiness(events[0], { openPrepCount: 0 });
    const needs = computeEventReadiness(events[1], { openPrepCount: 4 });
    assert.ok(ready > needs);
    assert.ok(ready >= 45);
  });

  it("merges combat aggregates into form rows", () => {
    const board = buildParticipationBoard(events, members, {
      now: new Date("2026-07-01T00:00:00.000Z"),
    });
    const merged = mergeCombatIntoFormBoard(board.top, {
      "76561198014575147": { kills: 10, deaths: 5, combatPoints: 1000, matches: 2 },
    });
    assert.equal(merged[0].kd, 2);
    assert.equal(merged[0].kills, 10);
  });

  it("splits form board into hot and cold", () => {
    const rows = [
      { steamId: "1", gamesPlayed: 10, wins: 8, losses: 2, winRate: 80 },
      { steamId: "2", gamesPlayed: 10, wins: 2, losses: 8, winRate: 20 },
      { steamId: "3", gamesPlayed: 8, wins: 5, losses: 3, winRate: 62 },
      { steamId: "4", gamesPlayed: 1, wins: 1, losses: 0, winRate: 100 },
    ];
    const { hot, cold } = splitFormBoard(rows, { minGames: 3, limit: 2 });
    assert.equal(hot[0].steamId, "1");
    assert.ok(cold.some((r) => r.steamId === "2"));
    assert.ok(!hot.some((r) => r.steamId === "4"));
  });

  it("summarizes RSVP counts", () => {
    const counts = summarizeRsvpCounts([
      { status: "confirmed" },
      { status: "confirmed" },
      { status: "tentative" },
      { status: "declined" },
    ]);
    assert.equal(counts.confirmed, 2);
    assert.equal(counts.total, 4);
  });

  it("builds role depth", () => {
    const depth = buildRoleDepth(members);
    assert.ok(depth.some((row) => row.role === "infantry" && row.count === 1));
    assert.ok(depth.some((row) => row.role === "commander" && row.count === 1));
  });
});

describe("HeLO slim player stats", () => {
  it("extracts Circle-side combat snapshot fields", () => {
    const stats = extractCircleSlimStats(
      {
        player_stats: {
          "76561198014575147": {
            side: "Axis",
            name: "Circle | A",
            kills: 12,
            deaths: 4,
            combat_points: 800,
            support_points: 100,
            offensive_points: 50,
            defensive_points: 200,
            playtime: 5400,
            kpm: 0.13,
          },
          "76561198884648099": {
            side: "Allies",
            name: "Enemy",
            kills: 9,
            deaths: 9,
          },
        },
      },
      "event-1",
      "axis"
    );
    assert.equal(stats.length, 1);
    assert.equal(stats[0].steamId, "76561198014575147");
    assert.equal(stats[0].kills, 12);
    assert.equal(stats[0].combatPoints, 800);
    assert.equal(stats[0].source, "helo");
  });
});

describe("rsvps store sanitize", () => {
  it("accepts valid statuses", () => {
    assert.equal(sanitizeRsvpStatus("confirmed").status, "confirmed");
    assert.equal(sanitizeRsvpStatus("TENTATIVE").status, "tentative");
  });

  it("accepts waitlist status", () => {
    assert.equal(sanitizeRsvpStatus("waitlist").status, "waitlist");
  });

  it("rejects invalid status", () => {
    assert.match(sanitizeRsvpStatus("maybe").error || "", /status/);
  });

  it("counts server-side", () => {
    const counts = serverRsvpCounts([
      { status: "unavailable" },
      { status: "confirmed" },
      { status: "waitlist" },
    ]);
    assert.equal(counts.unavailable, 1);
    assert.equal(counts.confirmed, 1);
    assert.equal(counts.waitlist, 1);
  });
});

describe("management migrations 0020–0023", () => {
  it("creates rsvps table", () => {
    const sql = readFileSync(join(root, "migrations/0020_rsvps.sql"), "utf8");
    assert.match(sql, /CREATE TABLE IF NOT EXISTS rsvps/i);
    assert.match(sql, /confirmed/);
  });

  it("creates player_match_stats table", () => {
    const sql = readFileSync(join(root, "migrations/0021_player_match_stats.sql"), "utf8");
    assert.match(sql, /CREATE TABLE IF NOT EXISTS player_match_stats/i);
    assert.match(sql, /combat_points/i);
  });

  it("adds roster is_template", () => {
    const sql = readFileSync(join(root, "migrations/0022_roster_templates.sql"), "utf8");
    assert.match(sql, /is_template/i);
  });

  it("adds raincheck columns", () => {
    const sql = readFileSync(join(root, "migrations/0023_rsvp_raincheck.sql"), "utf8");
    assert.match(sql, /signup_target/i);
    assert.match(sql, /waitlist/);
  });
});
