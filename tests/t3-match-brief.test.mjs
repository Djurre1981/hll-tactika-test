/**
 * T3 Match Brief page — unit tests for brief helpers (issue #33).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMPONENT_KINDS,
  componentStatusLabel,
  emptyEventComponents,
  formatEventSchedule,
  groupSlotsByKind,
  hasLinkedComponents,
  eventScheduleComponentBadges,
  listEventComponentSlots,
  resolveComponentStatus,
} from "../src/features/events/event-brief-utils.js";

describe("T3 — listEventComponentSlots", () => {
  it("returns empty list for missing components", () => {
    assert.deepEqual(listEventComponentSlots(undefined), []);
    assert.deepEqual(listEventComponentSlots(emptyEventComponents()), []);
  });

  it("lists all component kinds in stable order", () => {
    const slots = listEventComponentSlots({
      stratIds: ["s1", "s2"],
      routePlanIds: ["r1"],
      whiteboardIds: ["w1"],
      rosterId: "roster-1",
    });
    assert.deepEqual(slots, [
      { kind: "strat", id: "s1" },
      { kind: "strat", id: "s2" },
      { kind: "routePlan", id: "r1" },
      { kind: "whiteboard", id: "w1" },
      { kind: "roster", id: "roster-1" },
    ]);
  });
});

describe("T3 — hasLinkedComponents", () => {
  it("detects when any link exists", () => {
    assert.equal(hasLinkedComponents(emptyEventComponents()), false);
    assert.equal(hasLinkedComponents({ ...emptyEventComponents(), stratIds: ["s1"] }), true);
  });
});

describe("T3 — eventScheduleComponentBadges", () => {
  it("returns badges for strats, routes, and whiteboards with counts", () => {
    const badges = eventScheduleComponentBadges({
      stratIds: ["s1", "s2"],
      routePlanIds: ["r1"],
      whiteboardIds: [],
      rosterId: "roster-1",
    });

    assert.equal(badges.length, 2);
    assert.equal(badges[0].kind, "strat");
    assert.equal(badges[0].count, 2);
    assert.equal(badges[1].kind, "routePlan");
    assert.equal(badges[1].count, 1);
  });
});

describe("T3 — resolveComponentStatus", () => {
  it("maps API errors to brief UI states", () => {
    assert.equal(resolveComponentStatus({ status: 404 }), "missing");
    assert.equal(resolveComponentStatus({ status: 403 }), "restricted");
    assert.equal(resolveComponentStatus({ status: 401 }), "restricted");
    assert.equal(resolveComponentStatus({ status: 500 }), "error");
    assert.equal(resolveComponentStatus(null), "error");
  });
});

describe("T3 — componentStatusLabel", () => {
  it("returns human labels for non-ok states", () => {
    assert.match(componentStatusLabel("missing"), /Missing/i);
    assert.match(componentStatusLabel("restricted"), /Admin/i);
    assert.equal(componentStatusLabel("ok"), "");
  });
});

describe("T3 — groupSlotsByKind", () => {
  it("groups resolved slots by kind", () => {
    const grouped = groupSlotsByKind([
      { kind: "strat", id: "s1", status: "ok" },
      { kind: "routePlan", id: "r1", status: "missing" },
    ]);
    assert.equal(grouped.strat.length, 1);
    assert.equal(grouped.routePlan.length, 1);
    assert.equal(grouped.whiteboard.length, 0);
  });
});

describe("T3 — COMPONENT_KINDS hrefs", () => {
  it("builds deep links for each tool type", () => {
    assert.equal(COMPONENT_KINDS.strat.href("s1"), "/strats/s1");
    assert.equal(COMPONENT_KINDS.routePlan.href("r1"), "/routeplanner/r1");
    assert.equal(COMPONENT_KINDS.whiteboard.href("w1"), "/micro-prep/w1");
    assert.equal(COMPONENT_KINDS.roster.href("roster-1"), "/management");
  });
});

describe("T3 — formatEventSchedule", () => {
  it("formats start and optional end time", () => {
    const text = formatEventSchedule({
      startsAt: "2026-07-23T17:00:00.000Z",
      endsAt: "2026-07-23T19:30:00.000Z",
    });
    assert.match(text, /2026/);
    assert.match(text, /–/);
  });
});

describe("T3 — event GET + broken component (store integration)", () => {
  it("returns event with missing strat id without throwing", async () => {
    const { createEvent, getEvent } = await import("../functions/lib/events-store.js");
    const { createTestEnv } = await import("./helpers/memory-d1.mjs");

    const env = createTestEnv();
    const created = await createEvent(env, {
      id: "event-brief-1",
      title: "Brief test",
      description: "",
      startsAt: "2026-07-23T18:00:00.000Z",
      endsAt: "",
      eventType: "scrim",
      match: { opponent: "Enemy", mapId: "Carentan", faction: "axis", startingPoint: "", result: "" },
      components: {
        stratIds: ["missing-strat"],
        routePlanIds: [],
        whiteboardIds: [],
        rosterId: null,
      },
      createdBy: "76561198000000000",
      createdAt: "2026-07-23T18:00:00.000Z",
      updatedAt: "2026-07-23T18:00:00.000Z",
    });

    const loaded = await getEvent(env, created.id);
    assert.equal(loaded.components.stratIds[0], "missing-strat");
    assert.deepEqual(listEventComponentSlots(loaded.components), [
      { kind: "strat", id: "missing-strat" },
    ]);
  });
});
