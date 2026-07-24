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
      assert.equal(countPlayingSlots(layout), size);
      assert.ok(countSquadBudget(layout) <= 20);
      const result = validateLineupLayout(layout, { rosterSize: size });
      assert.equal(result.ok, true, result.error);
    });
  }

  it("rejects oversize infantry squad", () => {
    const layout = buildDefaultLayout(36);
    layout.sectors[1].squads[0].slots.push({
      id: "extra",
      role: "rifleman",
      steamId: null,
      present: false,
      displayName: "",
    });
    // playing slot count now wrong too
    const result = validateLineupLayout(layout, { rosterSize: 36 });
    assert.ok(result.error);
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
