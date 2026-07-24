/**
 * Unit tests for strat history filter/sort helpers.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterStratHistory,
  sortStratHistory,
  stratHistoryLine,
  stratSortTimestamp,
  summarizeStratHistory,
} from "../src/features/records/strat-history-utils.js";

function strat(overrides = {}) {
  return {
    id: "strat-1",
    title: "FOY Axis mid",
    tags: { team: "jr", type: "friendly" },
    match: {
      date: "2026-06-01",
      opponent: "PF",
      mapId: "Foy",
      faction: "axis",
      startingPoint: "01",
      result: "win",
    },
    updatedAt: "2026-06-02T12:00:00.000Z",
    createdAt: "2026-05-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("strat-history-utils", () => {
  it("sorts by match date descending by default", () => {
    const a = strat({ id: "a", match: { ...strat().match, date: "2026-01-01" } });
    const b = strat({ id: "b", match: { ...strat().match, date: "2026-06-01" } });
    const sorted = filterStratHistory([a, b], {});
    assert.equal(sorted[0].id, "b");
    assert.equal(sorted[1].id, "a");
  });

  it("filters by faction, map, strongpoint, and opponent search", () => {
    const list = [
      strat({ id: "keep" }),
      strat({
        id: "drop",
        title: "Other",
        match: {
          date: "2026-06-02",
          opponent: "CHMA",
          mapId: "SME",
          faction: "allies",
          startingPoint: "02",
          result: "loss",
        },
      }),
    ];
    const filtered = filterStratHistory(list, {
      faction: "axis",
      mapId: "Foy",
      startingPoint: "01",
      query: "pf",
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, "keep");
  });

  it("sorts by latest updated", () => {
    const older = strat({
      id: "old",
      updatedAt: "2026-01-01T00:00:00.000Z",
      match: { ...strat().match, date: "2026-06-01" },
    });
    const newer = strat({
      id: "new",
      updatedAt: "2026-07-01T00:00:00.000Z",
      match: { ...strat().match, date: "2026-01-01" },
    });
    const sorted = sortStratHistory([older, newer], "latest");
    assert.equal(sorted[0].id, "new");
  });

  it("builds a match line and summary", () => {
    assert.match(stratHistoryLine(strat()), /JR/);
    assert.match(stratHistoryLine(strat()), /vs PF/);
    assert.match(stratHistoryLine(strat()), /Foy/);
    const summary = summarizeStratHistory([strat(), strat({ id: "2", match: { result: "loss" } })]);
    assert.equal(summary.entries, 2);
    assert.equal(summary.wins, 1);
    assert.equal(summary.losses, 1);
    assert.ok(stratSortTimestamp(strat()) > 0);
  });
});
