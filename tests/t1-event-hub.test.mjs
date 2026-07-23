/**
 * T1 Event hub (data hooks) — automated verify tests for issue #33 / PR #34.
 *
 * Maps to closed-release-peer-playbook.md T1 verify checklist and
 * intertool-rallypoint-release.md T1 self-check items.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createEvent,
  emptyEventComponents,
  getEvent,
  listEvents,
  mutateEventComponent,
  sanitizeEventComponents,
  updateEvent,
} from "../functions/lib/events-store.js";
import {
  createTestEnv,
  minimalRosterRow,
  minimalRoutePlanRow,
  minimalStratRow,
  minimalWhiteboardRow,
} from "./helpers/memory-d1.mjs";

const NOW = "2026-07-23T18:00:00.000Z";
const LATER = "2026-07-23T20:00:00.000Z";

function baseEvent(overrides = {}) {
  return {
    id: "event-test-1",
    title: "Saturday scrim",
    description: "",
    startsAt: NOW,
    endsAt: LATER,
    eventType: "scrim",
    components: emptyEventComponents(),
    createdBy: "76561198000000000",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("T1 — sanitizeEventComponents (plan: normalized shape)", () => {
  it("returns empty arrays and null roster for missing input", () => {
    assert.deepEqual(sanitizeEventComponents(undefined), emptyEventComponents());
    assert.deepEqual(sanitizeEventComponents(null), emptyEventComponents());
    assert.deepEqual(sanitizeEventComponents([]), emptyEventComponents());
  });

  it("deduplicates ids and trims rosterId", () => {
    const result = sanitizeEventComponents({
      stratIds: ["s1", "s1", " s2 "],
      routePlanIds: ["r1"],
      whiteboardIds: ["w1", ""],
      rosterId: " roster-1 ",
    });
    assert.deepEqual(result.stratIds, ["s1", "s2"]);
    assert.deepEqual(result.routePlanIds, ["r1"]);
    assert.deepEqual(result.whiteboardIds, ["w1"]);
    assert.equal(result.rosterId, "roster-1");
  });

  it("coerces empty rosterId to null", () => {
    assert.equal(sanitizeEventComponents({ rosterId: "" }).rosterId, null);
    assert.equal(sanitizeEventComponents({ rosterId: null }).rosterId, null);
  });

  it("recovers from corrupt components_json stored in DB", async () => {
    const env = createTestEnv({
      events: [
        {
          id: "event-corrupt",
          title: "Corrupt",
          description: "",
          starts_at: NOW,
          ends_at: "",
          event_type: "other",
          components_json: "{not-json",
          created_by: "76561198000000000",
          created_at: NOW,
          updated_at: NOW,
        },
      ],
    });

    const event = await getEvent(env, "event-corrupt");
    assert.deepEqual(event.components, emptyEventComponents());
  });
});

describe("T1 — create / GET event (plan: empty components on create)", () => {
  it("createEvent persists empty components object", async () => {
    const env = createTestEnv();
    const created = await createEvent(env, baseEvent());

    assert.deepEqual(created.components, emptyEventComponents());
    const loaded = await getEvent(env, created.id);
    assert.deepEqual(loaded.components, emptyEventComponents());
  });

  it("GET /api/events/:id equivalent returns normalized components", async () => {
    const env = createTestEnv();
    await createEvent(env, baseEvent({ id: "event-get" }));

    const event = await getEvent(env, "event-get");
    assert.ok(event);
    assert.ok(Array.isArray(event.components.stratIds));
    assert.ok(Array.isArray(event.components.routePlanIds));
    assert.ok(Array.isArray(event.components.whiteboardIds));
    assert.equal(event.components.rosterId, null);
  });
});

describe("T1 — attach / detach components (plan verify checklist)", () => {
  it("attach fake strat id → 404", async () => {
    const env = createTestEnv();
    await createEvent(env, baseEvent({ id: "event-attach-fail" }));

    const result = await mutateEventComponent(env, "event-attach-fail", {
      action: "attach",
      type: "strat",
      id: "missing-strat",
    });

    assert.equal(result.status, 404);
    assert.match(result.error, /Strat not found/i);
  });

  it("attach real strat → appears in stratIds", async () => {
    const env = createTestEnv({
      strats: [minimalStratRow("strat-real")],
    });
    await createEvent(env, baseEvent({ id: "event-attach-ok" }));

    const result = await mutateEventComponent(env, "event-attach-ok", {
      action: "attach",
      type: "strat",
      id: "strat-real",
    });

    assert.ok(result.event);
    assert.deepEqual(result.event.components.stratIds, ["strat-real"]);
  });

  it("detach removes strat id", async () => {
    const env = createTestEnv({
      strats: [minimalStratRow("strat-real")],
    });
    await createEvent(
      env,
      baseEvent({
        id: "event-detach",
        components: { stratIds: ["strat-real"], routePlanIds: [], whiteboardIds: [], rosterId: null },
      })
    );

    const result = await mutateEventComponent(env, "event-detach", {
      action: "detach",
      type: "strat",
      id: "strat-real",
    });

    assert.deepEqual(result.event.components.stratIds, []);
  });

  it("attach does not duplicate ids", async () => {
    const env = createTestEnv({
      strats: [minimalStratRow("strat-real")],
    });
    await createEvent(env, baseEvent({ id: "event-dedupe" }));

    await mutateEventComponent(env, "event-dedupe", {
      action: "attach",
      type: "strat",
      id: "strat-real",
    });
    const second = await mutateEventComponent(env, "event-dedupe", {
      action: "attach",
      type: "strat",
      id: "strat-real",
    });

    assert.deepEqual(second.event.components.stratIds, ["strat-real"]);
  });

  it("validates routePlan, whiteboard, and roster on attach", async () => {
    const env = createTestEnv({
      route_plans: [minimalRoutePlanRow("plan-1")],
      whiteboards: [minimalWhiteboardRow("board-1")],
      rosters: [minimalRosterRow("roster-1")],
    });
    await createEvent(env, baseEvent({ id: "event-all-types" }));

    await mutateEventComponent(env, "event-all-types", {
      action: "attach",
      type: "routePlan",
      id: "plan-1",
    });
    await mutateEventComponent(env, "event-all-types", {
      action: "attach",
      type: "whiteboard",
      id: "board-1",
    });
    const final = await mutateEventComponent(env, "event-all-types", {
      action: "attach",
      type: "roster",
      id: "roster-1",
    });

    assert.deepEqual(final.event.components.routePlanIds, ["plan-1"]);
    assert.deepEqual(final.event.components.whiteboardIds, ["board-1"]);
    assert.equal(final.event.components.rosterId, "roster-1");
  });

  it("roster attach replaces previous rosterId", async () => {
    const env = createTestEnv({
      rosters: [minimalRosterRow("roster-a"), minimalRosterRow("roster-b")],
    });
    await createEvent(env, baseEvent({ id: "event-roster-swap" }));

    await mutateEventComponent(env, "event-roster-swap", {
      action: "attach",
      type: "roster",
      id: "roster-a",
    });
    const swapped = await mutateEventComponent(env, "event-roster-swap", {
      action: "attach",
      type: "roster",
      id: "roster-b",
    });

    assert.equal(swapped.event.components.rosterId, "roster-b");
  });

  it("rejects invalid action, type, or missing id", async () => {
    const env = createTestEnv();
    await createEvent(env, baseEvent({ id: "event-validation" }));

    const badAction = await mutateEventComponent(env, "event-validation", {
      action: "link",
      type: "strat",
      id: "x",
    });
    assert.equal(badAction.status, 400);

    const badType = await mutateEventComponent(env, "event-validation", {
      action: "attach",
      type: "video",
      id: "x",
    });
    assert.equal(badType.status, 400);

    const missingId = await mutateEventComponent(env, "event-validation", {
      action: "attach",
      type: "strat",
      id: "",
    });
    assert.equal(missingId.status, 400);
  });
});

describe("T1 — PATCH components replace (plan: merge/replace via updateEvent)", () => {
  it("updateEvent replaces components when PATCH body includes components", async () => {
    const env = createTestEnv();
    await createEvent(env, baseEvent({ id: "event-patch" }));

    const updated = await updateEvent(env, "event-patch", {
      components: {
        stratIds: ["s-a", "s-b"],
        routePlanIds: ["r-1"],
        whiteboardIds: [],
        rosterId: "roster-x",
      },
    });

    assert.deepEqual(updated.components.stratIds, ["s-a", "s-b"]);
    assert.deepEqual(updated.components.routePlanIds, ["r-1"]);
    assert.equal(updated.components.rosterId, "roster-x");
  });
});

describe("T1 — month list includes components (plan: calendar list unchanged)", () => {
  it("listEvents returns components on each event in range", async () => {
    const env = createTestEnv({
      strats: [minimalStratRow("strat-list")],
    });
    await createEvent(
      env,
      baseEvent({
        id: "event-in-range",
        startsAt: "2026-07-15T19:00:00.000Z",
        components: { stratIds: ["strat-list"], routePlanIds: [], whiteboardIds: [], rosterId: null },
      })
    );
    await createEvent(
      env,
      baseEvent({
        id: "event-out-range",
        startsAt: "2026-08-01T19:00:00.000Z",
      })
    );

    const events = await listEvents(env, {
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-08-01T00:00:00.000Z",
    });

    assert.equal(events.length, 1);
    assert.equal(events[0].id, "event-in-range");
    assert.deepEqual(events[0].components.stratIds, ["strat-list"]);
  });
});
