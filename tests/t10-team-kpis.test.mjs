/**
 * T10 Team KPIs — unit tests for aggregation helpers (issue #33).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateWinLossByMonth,
  aggregateWinRateByMap,
  aggregateWinRateByOpponent,
  computeRecentForm,
  formatFormLabel,
  summarizeTeamKpis,
} from "../src/features/records/team-kpi-utils.js";

const NOW = new Date("2026-07-23T18:00:00.000Z");

function event(overrides = {}) {
  return {
    id: "event-1",
    title: "Saturday scrim",
    startsAt: "2026-07-20T18:00:00.000Z",
    eventType: "scrim",
    match: {
      opponent: "Enemy",
      mapId: "Foy",
      faction: "allies",
      startingPoint: "",
      result: "win",
    },
    ...overrides,
  };
}

describe("T10 — summarizeTeamKpis", () => {
  it("returns empty-safe defaults", () => {
    const summary = summarizeTeamKpis([], NOW);
    assert.equal(summary.recorded, 0);
    assert.equal(summary.winRate, null);
    assert.equal(summary.winRateLabel, "—");
    assert.equal(summary.recordLabel, null);
    assert.equal(summary.formLabel, null);
  });

  it("includes record and recent form", () => {
    const summary = summarizeTeamKpis(
      [
        event({ id: "e1", match: { result: "win", mapId: "Foy", opponent: "A" } }),
        event({
          id: "e2",
          startsAt: "2026-07-15T18:00:00.000Z",
          match: { result: "loss", mapId: "Carentan", opponent: "B" },
        }),
        event({
          id: "e3",
          startsAt: "2026-07-10T18:00:00.000Z",
          match: { result: "win", mapId: "Foy", opponent: "C" },
        }),
      ],
      NOW,
    );

    assert.equal(summary.recordLabel, "2–1");
    assert.equal(summary.winRate, 67);
    assert.equal(summary.formLabel, "W · L · W");
  });
});

describe("T10 — computeRecentForm", () => {
  it("limits to latest results", () => {
    const form = computeRecentForm(
      [
        event({ id: "e1", match: { result: "win" } }),
        event({ id: "e2", startsAt: "2026-07-19T18:00:00.000Z", match: { result: "loss" } }),
        event({ id: "e3", startsAt: "2026-07-18T18:00:00.000Z", match: { result: "win" } }),
      ],
      2,
      NOW,
    );
    assert.deepEqual(form, ["win", "loss"]);
    assert.equal(formatFormLabel(form), "W · L");
  });
});

describe("T10 — aggregateWinLossByMonth", () => {
  it("groups wins and losses by month", () => {
    const rows = aggregateWinLossByMonth(
      [
        event({ id: "e1", startsAt: "2026-07-05T18:00:00.000Z", match: { result: "win" } }),
        event({ id: "e2", startsAt: "2026-07-12T18:00:00.000Z", match: { result: "loss" } }),
        event({ id: "e3", startsAt: "2026-06-20T18:00:00.000Z", match: { result: "win" } }),
      ],
      NOW,
    );

    assert.equal(rows.length, 2);
    assert.equal(rows[0].monthKey, "2026-06");
    assert.equal(rows[0].wins, 1);
    assert.equal(rows[1].monthKey, "2026-07");
    assert.equal(rows[1].wins, 1);
    assert.equal(rows[1].losses, 1);
    assert.equal(rows[1].winRate, 50);
  });
});

describe("T10 — aggregateWinRateByMap", () => {
  it("computes win rate per map", () => {
    const rows = aggregateWinRateByMap(
      [
        event({ match: { result: "win", mapId: "Foy" } }),
        event({ id: "e2", match: { result: "loss", mapId: "Foy" } }),
        event({ id: "e3", match: { result: "win", mapId: "Carentan" } }),
      ],
      NOW,
    );

    assert.equal(rows[0].mapId, "Foy");
    assert.equal(rows[0].winRate, 50);
    assert.equal(rows[1].mapId, "Carentan");
    assert.equal(rows[1].winRate, 100);
  });
});

describe("T10 — aggregateWinRateByOpponent", () => {
  it("caps to top opponents by volume", () => {
    const rows = aggregateWinRateByOpponent(
      Array.from({ length: 10 }, (_, index) =>
        event({
          id: `e${index}`,
          startsAt: `2026-07-${String(index + 1).padStart(2, "0")}T18:00:00.000Z`,
          match: { result: index % 2 ? "loss" : "win", opponent: `Team ${index}` },
        }),
      ),
      NOW,
    );

    assert.equal(rows.length, 8);
  });
});
