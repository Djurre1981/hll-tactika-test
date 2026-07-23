/**
 * T8 Match history — unit tests for history helpers (issue #33).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterMatchHistory,
  hasRecordedResult,
  isMatchHistoryEntry,
  isPastEvent,
  summarizeMatchHistory,
  uniqueMapIds,
} from "../src/features/records/match-history-utils.js";

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

describe("T8 — isPastEvent", () => {
  it("detects events before now", () => {
    assert.equal(isPastEvent(event(), NOW), true);
    assert.equal(
      isPastEvent(event({ startsAt: "2026-08-01T18:00:00.000Z" }), NOW),
      false
    );
  });
});

describe("T8 — isMatchHistoryEntry", () => {
  it("includes past scrims and past events with results", () => {
    assert.equal(isMatchHistoryEntry(event(), NOW), true);
    assert.equal(
      isMatchHistoryEntry(
        event({ eventType: "practice", match: { ...event().match, result: "loss" } }),
        NOW
      ),
      true
    );
    assert.equal(
      isMatchHistoryEntry(event({ startsAt: "2026-08-01T18:00:00.000Z" }), NOW),
      false
    );
  });
});

describe("T8 — filterMatchHistory", () => {
  const events = [
    event({ id: "e1", match: { opponent: "Alpha", mapId: "Foy", result: "win" } }),
    event({
      id: "e2",
      startsAt: "2026-07-10T18:00:00.000Z",
      match: { opponent: "Bravo", mapId: "Carentan", result: "loss" },
    }),
    event({
      id: "e3",
      startsAt: "2026-08-01T18:00:00.000Z",
      match: { opponent: "Future", mapId: "Foy", result: "win" },
    }),
  ];

  it("filters by map, opponent, and result", () => {
    const byMap = filterMatchHistory(events, { mapId: "Foy" }, NOW);
    assert.deepEqual(byMap.map((item) => item.id), ["e1"]);

    const byOpponent = filterMatchHistory(events, { opponent: "brav" }, NOW);
    assert.deepEqual(byOpponent.map((item) => item.id), ["e2"]);

    const byResult = filterMatchHistory(events, { result: "loss" }, NOW);
    assert.deepEqual(byResult.map((item) => item.id), ["e2"]);
  });

  it("sorts newest first", () => {
    const list = filterMatchHistory(events, {}, NOW);
    assert.deepEqual(list.map((item) => item.id), ["e1", "e2"]);
  });
});

describe("T8 — summarizeMatchHistory", () => {
  it("counts wins, losses, and win rate", () => {
    const summary = summarizeMatchHistory(
      [
        event({ match: { result: "win" } }),
        event({ id: "e2", match: { result: "win" } }),
        event({ id: "e3", match: { result: "loss" } }),
        event({ id: "e4", startsAt: "2026-08-01T18:00:00.000Z", match: { result: "win" } }),
      ],
      NOW
    );

    assert.equal(summary.recorded, 3);
    assert.equal(summary.wins, 2);
    assert.equal(summary.losses, 1);
    assert.equal(summary.winRate, 67);
  });
});

describe("T8 — uniqueMapIds", () => {
  it("returns sorted unique map ids", () => {
    assert.deepEqual(
      uniqueMapIds([
        event({ match: { mapId: "Foy" } }),
        event({ id: "e2", match: { mapId: "Carentan" } }),
        event({ id: "e3", match: { mapId: "Foy" } }),
      ]),
      ["Carentan", "Foy"]
    );
  });
});

describe("T8 — hasRecordedResult", () => {
  it("detects win and loss only", () => {
    assert.equal(hasRecordedResult(event()), true);
    assert.equal(hasRecordedResult(event({ match: { result: "" } })), false);
  });
});
