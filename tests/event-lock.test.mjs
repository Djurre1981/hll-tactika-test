/**
 * Event locking — auto-lock past/done events, manual lock, admin unlock.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canUnlockEvents,
  enrichEventLockState,
  eventLockReason,
  isEventAutoLocked,
  isEventDone,
  isEventEffectivelyLocked,
  isEventPast,
} from "../functions/lib/event-lock.js";
import {
  createEvent,
  deleteEvent,
  emptyEventComponents,
  getEvent,
  lockEvent,
  mutateEventComponent,
  unlockEvent,
  updateEvent,
} from "../functions/lib/events-store.js";
import { createTestEnv } from "./helpers/memory-d1.mjs";

const PAST = "2020-01-15T19:00:00.000Z";
const FUTURE = "2099-06-01T19:00:00.000Z";
const STEAM = "76561198000000000";

function baseEvent(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: "event-lock-1",
    title: "Lock test scrim",
    description: "",
    startsAt: FUTURE,
    endsAt: "",
    eventType: "scrim",
    components: emptyEventComponents(),
    createdBy: STEAM,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("event-lock helpers", () => {
  it("detects past and done events", () => {
    assert.equal(isEventPast({ startsAt: PAST }), true);
    assert.equal(isEventPast({ startsAt: FUTURE }), false);
    assert.equal(isEventDone({ match: { result: "win" } }), true);
    assert.equal(isEventDone({ match: { result: "" } }), false);
  });

  it("auto-locks past or done events unless override is set", () => {
    const past = enrichEventLockState({ startsAt: PAST, locked: false, lockOverride: false });
    assert.equal(past.effectiveLocked, true);
    assert.equal(past.lockReason, "past");

    const done = enrichEventLockState({
      startsAt: FUTURE,
      match: { result: "loss" },
      locked: false,
      lockOverride: false,
    });
    assert.equal(done.effectiveLocked, true);
    assert.equal(done.lockReason, "done");

    const unlocked = enrichEventLockState({
      startsAt: PAST,
      lockOverride: true,
    });
    assert.equal(isEventEffectivelyLocked(unlocked), false);
    assert.equal(eventLockReason(unlocked), null);
  });

  it("allows only admin and owner to unlock", () => {
    assert.equal(canUnlockEvents("admin"), true);
    assert.equal(canUnlockEvents("owner"), true);
    assert.equal(canUnlockEvents("editor"), false);
    assert.equal(canUnlockEvents("viewer"), false);
  });

  it("treats manual lock before event date as locked", () => {
    const manual = enrichEventLockState({
      startsAt: FUTURE,
      locked: true,
      lockOverride: false,
    });
    assert.equal(manual.effectiveLocked, true);
    assert.equal(manual.lockReason, "manual");
    assert.equal(isEventAutoLocked(manual), false);
  });
});

describe("events-store lock integration", () => {
  it("manual lock blocks property updates", async () => {
    const env = createTestEnv();
    await createEvent(env, baseEvent());

    const locked = await lockEvent(env, "event-lock-1", STEAM);
    assert.equal(locked.event.effectiveLocked, true);
    assert.equal(locked.event.lockReason, "manual");

    const blocked = await updateEvent(env, "event-lock-1", { title: "Changed" });
    assert.equal(blocked.error, "Event is locked");
    assert.equal(blocked.status, 423);

    const loaded = await getEvent(env, "event-lock-1");
    assert.equal(loaded.title, "Lock test scrim");
  });

  it("admin unlock clears effective lock for past events", async () => {
    const env = createTestEnv();
    await createEvent(env, baseEvent({ startsAt: PAST }));

    const past = await getEvent(env, "event-lock-1");
    assert.equal(past.effectiveLocked, true);

    const unlocked = await unlockEvent(env, "event-lock-1");
    assert.equal(unlocked.event.lockOverride, true);
    assert.equal(unlocked.event.effectiveLocked, false);

    const updated = await updateEvent(env, "event-lock-1", { title: "Unlocked edit" });
    assert.equal(updated.title, "Unlocked edit");
  });

  it("blocks delete and component mutations when locked", async () => {
    const env = createTestEnv();
    await createEvent(env, baseEvent({ match: { result: "win" } }));

    const locked = await getEvent(env, "event-lock-1");
    assert.equal(locked.lockReason, "done");

    const del = await deleteEvent(env, "event-lock-1");
    assert.equal(del.error, "Event is locked");

    const attach = await mutateEventComponent(env, "event-lock-1", {
      action: "attach",
      type: "strat",
      id: "strat-1",
    });
    assert.equal(attach.error, "Event is locked");
  });
});
