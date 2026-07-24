/**
 * Layout + validation unit tests for Match LineUp.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  buildDefaultLayout,
  countPlayingSlots,
  countSquadBudget,
  ROSTER_SIZES,
} from "../functions/lib/lineup-layouts.js";
import { validateLineupLayout } from "../functions/lib/lineup-validate.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("migration 0024_lineups", () => {
  it("adds roster_size and lineups table", () => {
    const sql = readFileSync(join(root, "migrations/0024_lineups.sql"), "utf8");
    assert.match(sql, /roster_size/i);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS lineups/i);
    assert.match(sql, /layout_json/i);
  });
});

describe("lineup default layouts", () => {
  for (const size of ROSTER_SIZES) {
    it(`builds valid ${size} layout`, () => {
      const layout = buildDefaultLayout(size);
      assert.ok(countPlayingSlots(layout) <= size);
      assert.ok(countPlayingSlots(layout) >= 1);
      assert.ok(countSquadBudget(layout) <= 20);
      for (const sec of layout.sectors) {
        const expected = sec.id === "tanks" && size !== 18 ? 3 : 1;
        assert.equal(
          sec.squads.length,
          expected,
          `${sec.id} should start with ${expected} squad(s)`
        );
      }
      const result = validateLineupLayout(layout, { rosterSize: size });
      assert.equal(result.ok, true, result.error);
    });
  }

  it("rejects oversize infantry squad", () => {
    const layout = buildDefaultLayout(36);
    const infantry = layout.sectors.find((s) => s.squads?.[0]?.type === "infantry");
    const squad = infantry.squads[0];
    while (squad.slots.length <= 6) {
      squad.slots.push({
        id: `extra-${squad.slots.length}`,
        role: "rifleman",
        steamId: null,
        present: false,
        displayName: "",
      });
    }
    const result = validateLineupLayout(layout, { rosterSize: 36 });
    assert.ok(result.error);
  });

  it("rejects playing slots over roster size", () => {
    const layout = buildDefaultLayout(18);
    // Force over-capacity by cloning many infantry squads
    const meat = layout.sectors.find((s) => s.id === "meat");
    for (let i = 0; i < 8; i += 1) {
      meat.squads.push({
        id: `meat-extra-${i}`,
        type: "infantry",
        label: `Extra ${i}`,
        slots: [
          { id: `e${i}-a`, role: "sl", steamId: null, present: false, displayName: "" },
          { id: `e${i}-b`, role: "support", steamId: null, present: false, displayName: "" },
          { id: `e${i}-c`, role: "mg", steamId: null, present: false, displayName: "" },
          { id: `e${i}-d`, role: "engineer", steamId: null, present: false, displayName: "" },
        ],
      });
    }
    const result = validateLineupLayout(layout, { rosterSize: 18 });
    assert.match(result.error || "", /exceed/i);
  });

  it("requires confirmed RSVP when gate provided", () => {
    const layout = buildDefaultLayout(18);
    layout.specials[0].steamId = "76561198000000001";
    layout.specials[0].displayName = "Cmd";
    const result = validateLineupLayout(layout, {
      rosterSize: 18,
      confirmedSteamIds: new Set(),
    });
    assert.match(result.error || "", /not RSVP confirmed/i);
  });

  it("nodes assignee must be on infantry", () => {
    const layout = buildDefaultLayout(18);
    layout.specials[0].steamId = "76561198000000001";
    layout.nodes.north.slots[0].steamId = "76561198000000001";
    const result = validateLineupLayout(layout, {
      rosterSize: 18,
      confirmedSteamIds: new Set(["76561198000000001"]),
    });
    assert.match(result.error || "", /infantry/i);
  });
});

describe("migration 0025_player_lineup_attendance", () => {
  it("creates attendance table", () => {
    const sql = readFileSync(
      join(root, "migrations/0025_player_lineup_attendance.sql"),
      "utf8"
    );
    assert.match(sql, /CREATE TABLE IF NOT EXISTS player_lineup_attendance/i);
    assert.match(sql, /was_reserve/i);
    assert.match(sql, /was_playing/i);
  });
});

describe("syncReservesWhenFull", () => {
  it("auto-fills reserves when playing slots hit rosterSize", async () => {
    const { syncReservesWhenFull } = await import(
      "../functions/lib/lineup-reserves.js"
    );
    const layout = buildDefaultLayout(18);
    const confirmed = [];
    for (let i = 0; i < 22; i += 1) {
      confirmed.push({
        steamId: `76561198000000${String(i).padStart(3, "0")}`,
        displayName: `P${i}`,
      });
    }
    let idx = 0;
    for (const sp of layout.specials) {
      if (sp.role === "streamer") continue;
      const p = confirmed[idx++];
      sp.steamId = p.steamId;
      sp.displayName = p.displayName;
    }
    for (const sec of layout.sectors) {
      for (const sq of sec.squads) {
        for (const slot of sq.slots) {
          if (idx >= 18) break;
          const p = confirmed[idx++];
          slot.steamId = p.steamId;
          slot.displayName = p.displayName;
        }
      }
    }
    syncReservesWhenFull(layout, confirmed, 18);
    assert.equal(layout.reserves.length, 4);
    const reserveIds = new Set(layout.reserves.map((r) => r.steamId));
    assert.ok(reserveIds.has(confirmed[18].steamId));
    assert.ok(!reserveIds.has(confirmed[0].steamId));
  });

  it("drops player from reserves when promoted to playing", async () => {
    const { syncReservesWhenFull } = await import(
      "../functions/lib/lineup-reserves.js"
    );
    const layout = buildDefaultLayout(18);
    layout.reserves = [
      { steamId: "76561198000000100", displayName: "Bench", present: false },
    ];
    layout.specials[0].steamId = "76561198000000100";
    layout.specials[0].displayName = "Bench";
    syncReservesWhenFull(layout, [{ steamId: "76561198000000100" }], 18);
    assert.equal(layout.reserves.length, 0);
  });
});
