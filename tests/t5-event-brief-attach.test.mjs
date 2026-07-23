/**
 * T5 Match Brief attach/detach — unit tests for sync helpers (issue #33).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMPONENT_API_TYPES,
  buildRoutePlanEventIdPutBody,
  linkedIdsForKind,
  normalizeRoutePlanRecord,
} from "../src/features/events/event-component-sync.js";

describe("T5 — COMPONENT_API_TYPES", () => {
  it("maps brief kinds to components API type strings", () => {
    assert.equal(COMPONENT_API_TYPES.strat, "strat");
    assert.equal(COMPONENT_API_TYPES.routePlan, "routePlan");
    assert.equal(COMPONENT_API_TYPES.whiteboard, "whiteboard");
    assert.equal(COMPONENT_API_TYPES.roster, "roster");
  });
});

describe("T5 — linkedIdsForKind", () => {
  const components = {
    stratIds: ["s1", "s2"],
    routePlanIds: ["r1"],
    whiteboardIds: [],
    rosterId: "roster-1",
  };

  it("returns linked ids per kind", () => {
    assert.deepEqual(linkedIdsForKind(components, "strat"), ["s1", "s2"]);
    assert.deepEqual(linkedIdsForKind(components, "routePlan"), ["r1"]);
    assert.deepEqual(linkedIdsForKind(components, "whiteboard"), []);
    assert.deepEqual(linkedIdsForKind(components, "roster"), ["roster-1"]);
  });

  it("handles missing components", () => {
    assert.deepEqual(linkedIdsForKind(null, "strat"), []);
    assert.deepEqual(linkedIdsForKind({}, "roster"), []);
  });
});

describe("T5 — buildRoutePlanEventIdPutBody", () => {
  it("builds nested plan payload with eventId set or cleared", () => {
    const record = normalizeRoutePlanRecord({
      id: "p1",
      title: "Main push",
      plan: {
        mapId: "Carentan",
        factionId: "ger",
        hqIndex: 1,
        eventId: null,
        routes: [{ id: "route-1" }],
        obstacles: [],
        obstacleVectorBuildId: "build-1",
      },
    });

    const attachBody = buildRoutePlanEventIdPutBody(record, "event-42");
    assert.equal(attachBody.plan.title, "Main push");
    assert.equal(attachBody.plan.plan.eventId, "event-42");
    assert.equal(attachBody.plan.plan.mapId, "Carentan");
    assert.equal(attachBody.plan.plan.factionId, "ger");
    assert.equal(attachBody.plan.plan.routes.length, 1);

    const detachBody = buildRoutePlanEventIdPutBody(record, null);
    assert.equal(detachBody.plan.plan.eventId, null);
  });
});

describe("T5 — mutateEventComponent attach/detach (store integration)", () => {
  it("attaches and detaches route plans on event hub", async () => {
    const { createEvent, mutateEventComponent } = await import("../functions/lib/events-store.js");
    const { createTestEnv, minimalRoutePlanRow } = await import("./helpers/memory-d1.mjs");

    const env = createTestEnv({
      route_plans: [minimalRoutePlanRow("plan-99")],
    });
    const created = await createEvent(env, {
      id: "event-t5-1",
      title: "T5 test",
      description: "",
      startsAt: "2026-07-23T18:00:00.000Z",
      endsAt: "",
      eventType: "scrim",
      match: { opponent: "", mapId: "", faction: "", startingPoint: "", result: "" },
      components: {
        stratIds: [],
        routePlanIds: [],
        whiteboardIds: [],
        rosterId: null,
      },
      createdBy: "76561198000000000",
      createdAt: "2026-07-23T18:00:00.000Z",
      updatedAt: "2026-07-23T18:00:00.000Z",
    });

    const attached = await mutateEventComponent(env, created.id, {
      action: "attach",
      type: "routePlan",
      id: "plan-99",
    });
    assert.ok(attached.event.components.routePlanIds.includes("plan-99"));

    const detached = await mutateEventComponent(env, created.id, {
      action: "detach",
      type: "routePlan",
      id: "plan-99",
    });
    assert.equal(detached.event.components.routePlanIds.length, 0);
  });
});
