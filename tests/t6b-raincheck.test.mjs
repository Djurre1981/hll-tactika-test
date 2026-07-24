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
  pickNextReserve,
  pickNextWaitlisted,
  resolveCapacityStatus,
  sanitizeRsvpStatus,
  summarizeRsvpCounts,
  summarizeUiCounts,
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

  it("does not default signup target by event type", () => {
    assert.equal(defaultSignupTarget("scrim"), null);
    assert.equal(defaultSignupTarget("comp"), null);
    assert.equal(defaultSignupTarget("practice"), null);
  });

  it("sanitizes signup target", () => {
    assert.equal(sanitizeSignupTarget(40).signupTarget, 40);
    assert.equal(sanitizeSignupTarget("").signupTarget, null);
    assert.match(sanitizeSignupTarget(-1).error || "", /signupTarget/);
  });
});

describe("RSVP seats and reserve list", () => {
  it("includes reserve statuses in counts", () => {
    const counts = summarizeRsvpCounts([
      { status: "confirmed" },
      { status: "tentative" },
      { status: "waitlist" },
      { status: "declined" },
    ]);
    assert.equal(counts.confirmed, 1);
    assert.equal(counts.tentative, 1);
    assert.equal(counts.waitlist, 1);
    assert.equal(counts.total, 4);
  });

  it("maps UI counts to In / Maybe / Out", () => {
    const ui = summarizeUiCounts({
      confirmed: 10,
      tentative: 3,
      waitlist: 2,
      declined: 4,
      unavailable: 1,
    });
    assert.deepEqual(ui, { in: 10, maybe: 5, out: 5, total: 20 });
  });

  it("computes fill needed when under target", () => {
    const seats = computeSeats(
      { signupTarget: 50, effectiveLocked: false },
      { confirmed: 48, tentative: 0, waitlist: 0 }
    );
    assert.equal(seats.open, 2);
    assert.equal(seats.fillNeeded, true);
    assert.equal(seats.lookingForFills, true);
  });

  it("overflow confirmed becomes Maybe (tentative)", () => {
    const seats = computeSeats({ signupTarget: 2 }, { confirmed: 2, tentative: 0, waitlist: 0 });
    assert.deepEqual(resolveCapacityStatus("confirmed", seats), {
      status: "tentative",
      queued: true,
    });
  });

  it("picks FIFO reserve by queuedAt", () => {
    const next = pickNextReserve([
      {
        steamId: "b",
        status: "tentative",
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

  it("pickNextWaitlisted alias still works", () => {
    const next = pickNextWaitlisted([
      { steamId: "a", status: "tentative", queuedAt: "2026-07-01T00:00:00.000Z" },
    ]);
    assert.equal(next.steamId, "a");
  });

  it("maps unavailable and waitlist signup statuses", () => {
    assert.equal(sanitizeRsvpStatus("unavailable").status, "declined");
    assert.equal(sanitizeRsvpStatus("waitlist").status, "tentative");
    assert.equal(sanitizeRsvpStatus("confirmed").status, "confirmed");
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

describe("migration 0026_rsvp_closed", () => {
  it("adds rsvp_closed on events", () => {
    const sql = readFileSync(join(root, "migrations/0026_rsvp_closed.sql"), "utf8");
    assert.match(sql, /rsvp_closed/i);
    assert.match(sql, /ALTER TABLE events/i);
  });
});
