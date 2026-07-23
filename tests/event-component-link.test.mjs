import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertLinkedEventEditable,
  findEventIdForComponent,
  findEventIdForRoutePlan,
} from "../functions/lib/event-component-link.js";
import {
  createEvent,
  emptyEventComponents,
  lockEvent,
} from "../functions/lib/events-store.js";
import { createTestEnv, minimalRoutePlanRow } from "./helpers/memory-d1.mjs";

const FUTURE = "2099-06-01T19:00:00.000Z";
const STEAM = "76561198000000000";

function seedEvent(env, { id, components }) {
  return createEvent(env, {
    id,
    title: "Linked event",
    description: "",
    startsAt: FUTURE,
    endsAt: "",
    eventType: "scrim",
    components,
    createdBy: STEAM,
    createdAt: FUTURE,
    updatedAt: FUTURE,
  });
}

describe("event-component-link", () => {
  it("finds hub event for strat, route, and whiteboard ids", async () => {
    const env = createTestEnv();
    await seedEvent(env, {
      id: "event-hub-1",
      components: {
        ...emptyEventComponents(),
        stratIds: ["strat-a"],
        routePlanIds: ["route-a"],
        whiteboardIds: ["board-a"],
      },
    });

    assert.equal(await findEventIdForComponent(env, "strat", "strat-a"), "event-hub-1");
    assert.equal(await findEventIdForComponent(env, "routePlan", "route-a"), "event-hub-1");
    assert.equal(await findEventIdForComponent(env, "whiteboard", "board-a"), "event-hub-1");
    assert.equal(await findEventIdForComponent(env, "strat", "missing"), null);
  });

  it("falls back to route plan eventId when hub link is missing", async () => {
    const env = createTestEnv();
    env.DB.seedRow("route_plans", {
      ...minimalRoutePlanRow("route-b"),
      plan_json: JSON.stringify({ eventId: "event-from-plan" }),
    });

    assert.equal(await findEventIdForRoutePlan(env, "route-b"), "event-from-plan");
  });

  it("blocks edits when linked event is locked", async () => {
    const env = createTestEnv();
    await seedEvent(env, {
      id: "event-locked",
      components: { ...emptyEventComponents(), stratIds: ["strat-locked"] },
    });
    await lockEvent(env, "event-locked", STEAM);

    const blocked = await assertLinkedEventEditable(env, "strat", "strat-locked");
    assert.equal(blocked.error, "Event is locked");
    assert.equal(blocked.status, 423);

    const open = await assertLinkedEventEditable(env, "strat", "unlinked-strat");
    assert.equal(open.ok, true);
    assert.equal(open.eventId, null);
  });
});
