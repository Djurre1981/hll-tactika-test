import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultSignupTarget,
  sanitizeRsvpReason,
  sanitizeSignupTarget,
} from "../functions/lib/rsvp-reasons.js";
import {
  computeSeats,
  pickNextWaitlisted,
  resolveCapacityStatus,
  sanitizeRsvpStatus,
  summarizeRsvpCounts,
} from "../functions/lib/rsvps-store.js";
import { enqueueNotification } from "../functions/lib/notifications.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("T6b raincheck reasons", () => {
  it("requires reason for absence", () => {
    assert.match(sanitizeRsvpReason("", "", { required: true }).error || "", /reason/i);
  });

  it("requires note for other", () => {
    assert.match(
      sanitizeRsvpReason("other", "", { required: true }).error || "",
      /note/i
    );
  });

  it("accepts work without note", () => {
    const ok = sanitizeRsvpReason("work", "", { required: true });
    assert.equal(ok.reasonCode, "work");
    assert.equal(ok.reasonNote, null);
  });

  it("defaults signup target by event type", () => {
    assert.equal(defaultSignupTarget("scrim"), 50);
    assert.equal(defaultSignupTarget("comp"), 50);
    assert.equal(defaultSignupTarget("practice"), null);
  });

  it("sanitizes signup target", () => {
    assert.equal(sanitizeSignupTarget(40).signupTarget, 40);
    assert.equal(sanitizeSignupTarget("").signupTarget, null);
    assert.match(sanitizeSignupTarget(-1).error || "", /signupTarget/);
  });
});

describe("T6b seats and waitlist", () => {
  it("includes waitlist in counts", () => {
    const counts = summarizeRsvpCounts([
      { status: "confirmed" },
      { status: "waitlist" },
      { status: "declined" },
    ]);
    assert.equal(counts.confirmed, 1);
    assert.equal(counts.waitlist, 1);
    assert.equal(counts.total, 3);
  });

  it("computes fill needed when under target", () => {
    const seats = computeSeats(
      { signupTarget: 50, effectiveLocked: false },
      { confirmed: 48, waitlist: 0 }
    );
    assert.equal(seats.open, 2);
    assert.equal(seats.fillNeeded, true);
    assert.equal(seats.lookingForFills, true);
  });

  it("queues confirmed when full", () => {
    const seats = computeSeats({ signupTarget: 2 }, { confirmed: 2, waitlist: 0 });
    assert.deepEqual(resolveCapacityStatus("confirmed", seats), {
      status: "waitlist",
      queued: true,
    });
  });

  it("picks FIFO waitlist by queuedAt", () => {
    const next = pickNextWaitlisted([
      {
        steamId: "b",
        status: "waitlist",
        queuedAt: "2026-07-02T00:00:00.000Z",
      },
      {
        steamId: "a",
        status: "waitlist",
        queuedAt: "2026-07-01T00:00:00.000Z",
      },
      { steamId: "c", status: "confirmed" },
    ]);
    assert.equal(next.steamId, "a");
  });

  it("accepts waitlist status", () => {
    assert.equal(sanitizeRsvpStatus("waitlist").status, "waitlist");
  });
});

describe("T6b notifications stub", () => {
  it("soft-succeeds without delivery", async () => {
    const result = await enqueueNotification({}, { type: "fill_needed", eventId: "e1" });
    assert.equal(result.ok, true);
    assert.equal(result.stub, true);
  });
});

describe("migration 0023", () => {
  it("adds signup_target and waitlist", () => {
    const sql = readFileSync(join(root, "migrations/0023_rsvp_raincheck.sql"), "utf8");
    assert.match(sql, /signup_target/i);
    assert.match(sql, /waitlist/);
    assert.match(sql, /reason_code/);
  });
});
