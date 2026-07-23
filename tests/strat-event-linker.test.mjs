import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  eventPropertiesToStratPatch,
  eventTypeToStratType,
  findLinkedEventId,
  isUpcomingEvent,
} from "../src/features/strats/editor/event-strat-sync.js";

describe("Strat event linker — eventTypeToStratType", () => {
  it("maps comp to tournament and other types to friendly", () => {
    assert.equal(eventTypeToStratType("comp"), "tournament");
    assert.equal(eventTypeToStratType("scrim"), "friendly");
    assert.equal(eventTypeToStratType("practice"), "friendly");
  });
});

describe("Strat event linker — eventPropertiesToStratPatch", () => {
  it("copies match metadata and type from event once", () => {
    const patch = eventPropertiesToStratPatch({
      eventType: "scrim",
      startsAt: "2026-07-25T18:00:00.000Z",
      description: "Scrim notes",
      match: {
        opponent: "Enemy team",
        mapId: "Carentan",
        faction: "axis",
        startingPoint: "05",
        result: "",
      },
    });

    assert.equal(patch.tags.type, "friendly");
    assert.equal(patch.match.opponent, "Enemy team");
    assert.equal(patch.match.mapId, "Carentan");
    assert.equal(patch.match.faction, "axis");
    assert.equal(patch.notes, "Scrim notes");
    assert.match(patch.match.date, /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("Strat event linker — findLinkedEventId", () => {
  it("finds the event that lists this strat id", () => {
    const id = findLinkedEventId(
      [
        { id: "e1", components: { stratIds: ["s-other"] } },
        { id: "e2", components: { stratIds: ["s1", "s2"] } },
      ],
      "s1"
    );
    assert.equal(id, "e2");
  });
});

describe("Strat event linker — isUpcomingEvent", () => {
  it("includes today and future events only", () => {
    const now = new Date("2026-07-23T12:00:00");
    assert.equal(isUpcomingEvent({ startsAt: "2026-07-23T08:00:00.000Z" }, now), true);
    assert.equal(isUpcomingEvent({ startsAt: "2026-07-22T18:00:00.000Z" }, now), false);
    assert.equal(isUpcomingEvent({ startsAt: "2026-07-24T18:00:00.000Z" }, now), true);
  });
});
