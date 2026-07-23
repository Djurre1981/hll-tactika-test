/**
 * T2 Match metadata on events — verify tests for issue #33.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createEvent,
  emptyEventMatch,
  getEvent,
  sanitizeEventMatch,
  updateEvent,
} from "../functions/lib/events-store.js";
import { createTestEnv } from "./helpers/memory-d1.mjs";

const NOW = "2026-07-23T18:00:00.000Z";

function baseEvent(overrides = {}) {
  return {
    id: "event-match-1",
    title: "Saturday scrim",
    description: "",
    startsAt: NOW,
    endsAt: "",
    eventType: "scrim",
    match: emptyEventMatch(),
    components: {
      stratIds: [],
      routePlanIds: [],
      whiteboardIds: [],
      rosterId: null,
    },
    createdBy: "76561198000000000",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("T2 — sanitizeEventMatch", () => {
  it("normalizes opponent, map, faction, starting point, and result", () => {
    const match = sanitizeEventMatch({
      opponent: "  Enemy team  ",
      mapId: "Foy",
      faction: "allies",
      startingPoint: "01",
      result: "win",
      date: "bad-date",
    });

    assert.equal(match.opponent, "Enemy team");
    assert.equal(match.mapId, "Foy");
    assert.equal(match.faction, "allies");
    assert.equal(match.startingPoint, "01");
    assert.equal(match.result, "win");
    assert.equal(match.date, "");
  });

  it("rejects invalid faction and result values", () => {
    const match = sanitizeEventMatch({
      faction: "soviet",
      result: "draw",
    });
    assert.equal(match.faction, "");
    assert.equal(match.result, "");
  });
});

describe("T2 — create / update / GET match round-trip", () => {
  it("createEvent persists empty match for practice-style events", async () => {
    const env = createTestEnv();
    const created = await createEvent(
      env,
      baseEvent({ id: "event-practice", eventType: "practice" })
    );

    assert.deepEqual(created.match, emptyEventMatch());
  });

  it("createEvent persists match metadata for scrims", async () => {
    const env = createTestEnv();
    const created = await createEvent(
      env,
      baseEvent({
        id: "event-scrim",
        match: {
          opponent: "42nd",
          mapId: "Carentan",
          faction: "axis",
          startingPoint: "00",
          result: "",
        },
      })
    );

    assert.equal(created.match.opponent, "42nd");
    assert.equal(created.match.mapId, "Carentan");
    assert.equal(created.match.faction, "axis");
    assert.equal(created.match.startingPoint, "00");

    const loaded = await getEvent(env, "event-scrim");
    assert.deepEqual(loaded.match, created.match);
  });

  it("updateEvent replaces match metadata on edit", async () => {
    const env = createTestEnv();
    await createEvent(env, baseEvent({ id: "event-edit-match" }));

    const updated = await updateEvent(env, "event-edit-match", {
      match: {
        opponent: "Updated foe",
        mapId: "Omaha",
        faction: "allies",
        startingPoint: "02",
        result: "loss",
      },
    });

    assert.equal(updated.match.opponent, "Updated foe");
    assert.equal(updated.match.mapId, "Omaha");
    assert.equal(updated.match.result, "loss");
  });

  it("recovers from corrupt match_json in DB", async () => {
    const env = createTestEnv({
      events: [
        {
          id: "event-bad-match",
          title: "Bad match json",
          description: "",
          starts_at: NOW,
          ends_at: "",
          event_type: "scrim",
          match_json: "{broken",
          components_json: "{}",
          created_by: "76561198000000000",
          created_at: NOW,
          updated_at: NOW,
        },
      ],
    });

    const event = await getEvent(env, "event-bad-match");
    assert.deepEqual(event.match, emptyEventMatch());
  });
});
