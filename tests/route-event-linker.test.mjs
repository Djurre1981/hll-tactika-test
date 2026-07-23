import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  eventMatchFactionToRouteFaction,
  eventPropertiesToRoutePlanPatch,
  findLinkedEventIdForRoutePlan,
} from "../src/features/routeplanner/event-route-sync.js";

describe("Route event linker — eventMatchFactionToRouteFaction", () => {
  it("maps axis/allies to ger/us", () => {
    assert.equal(eventMatchFactionToRouteFaction("axis"), "ger");
    assert.equal(eventMatchFactionToRouteFaction("allies"), "us");
    assert.equal(eventMatchFactionToRouteFaction(""), "");
  });
});

describe("Route event linker — eventPropertiesToRoutePlanPatch", () => {
  it("copies map and faction from event match once", () => {
    const patch = eventPropertiesToRoutePlanPatch({
      match: {
        mapId: "Carentan",
        faction: "axis",
      },
    });

    assert.equal(patch.mapId, "Carentan");
    assert.equal(patch.factionId, "ger");
  });
});

describe("Route event linker — findLinkedEventIdForRoutePlan", () => {
  it("finds the event that lists this route plan id", () => {
    const id = findLinkedEventIdForRoutePlan(
      [
        { id: "e1", components: { routePlanIds: ["p-other"] } },
        { id: "e2", components: { routePlanIds: ["p1", "p2"] } },
      ],
      "p1"
    );
    assert.equal(id, "e2");
  });
});
