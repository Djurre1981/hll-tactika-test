import { requireDb } from "./d1.js";
import { getEvent } from "./events-store.js";
import { isLineupAutoLocked } from "./lineup-validate.js";
import { enqueueNotification } from "./notifications.js";
import { sanitizeRsvpReason } from "./rsvp-reasons.js";

export const RSVP_STATUSES = [
  "confirmed",
  "tentative",
  "declined",
  "unavailable",
  "waitlist",
];

const ABSENCE_STATUSES = new Set(["declined", "unavailable"]);
const SEAT_HOLDING = new Set(["confirmed"]);
const RESERVE_STATUSES = new Set(["tentative", "waitlist"]);

function rowToRsvp(row) {
  return {
    eventId: row.event_id,
    steamId: row.steam_id,
    status: row.status,
    reasonCode: row.reason_code || null,
    reasonNote: row.reason_note || null,
    queuedAt: row.queued_at || null,
    updatedAt: row.updated_at,
  };
}

function parseLineupLayout(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function getLineupEffectivelyLocked(env, event) {
  if (!event?.id) return false;
  const db = requireDb(env);
  const row = await db
    .prepare(`SELECT locked, layout_json FROM lineups WHERE event_id = ?`)
    .bind(event.id)
    .first();
  if (!row) return false;
  const lineup = {
    locked: Boolean(row.locked),
    layout: parseLineupLayout(row.layout_json),
    eventId: event.id,
  };
  return isLineupAutoLocked(lineup, event);
}

export async function isRsvpClosedForEvent(env, event) {
  if (!event) return true;
  if (event.rsvpClosed) return true;
  return getLineupEffectivelyLocked(env, event);
}

export function normalizeSignupStatus(raw) {
  const status = String(raw || "").trim().toLowerCase();
  if (status === "unavailable") return "declined";
  if (status === "waitlist") return "tentative";
  return status;
}

export function sanitizeRsvpStatus(raw) {
  const status = normalizeSignupStatus(raw);
  if (!["confirmed", "tentative", "declined"].includes(status)) {
    return { error: "status must be confirmed, tentative, or declined" };
  }
  return { status };
}

export function summarizeRsvpCounts(rsvps = []) {
  const counts = {
    confirmed: 0,
    tentative: 0,
    declined: 0,
    unavailable: 0,
    waitlist: 0,
    total: 0,
  };
  for (const row of rsvps) {
    if (RSVP_STATUSES.includes(row.status)) {
      counts[row.status] += 1;
      counts.total += 1;
    }
  }
  return counts;
}

export function summarizeUiCounts(counts = {}) {
  const confirmed = Number(counts.confirmed) || 0;
  const tentative = Number(counts.tentative) || 0;
  const waitlist = Number(counts.waitlist) || 0;
  const declined = Number(counts.declined) || 0;
  const unavailable = Number(counts.unavailable) || 0;
  const maybe = tentative + waitlist;
  const out = declined + unavailable;
  return {
    in: confirmed,
    maybe,
    out,
    total: confirmed + maybe + out,
  };
}

/**
 * @param {{ signupTarget?: number|null, locked?: boolean }} eventLike
 * @param {ReturnType<typeof summarizeRsvpCounts>} counts
 */
export function computeSeats(eventLike, counts) {
  const target =
    eventLike?.signupTarget == null || eventLike?.signupTarget === ""
      ? null
      : Number(eventLike.signupTarget);
  const confirmed = Number(counts?.confirmed) || 0;
  const reserve =
    (Number(counts?.tentative) || 0) + (Number(counts?.waitlist) || 0);
  const hasTarget = Number.isInteger(target) && target >= 0;
  const open = hasTarget ? Math.max(0, target - confirmed) : null;
  const locked = Boolean(eventLike?.effectiveLocked ?? eventLike?.locked);
  const fillNeeded = hasTarget && confirmed < target && !locked;
  const lookingForFills = fillNeeded && reserve === 0;

  return {
    target: hasTarget ? target : null,
    confirmed,
    open,
    reserve,
    waitlist: Number(counts?.waitlist) || 0,
    fillNeeded,
    lookingForFills,
  };
}

/**
 * Pure: if requesting confirmed and seats are full, become reserve (Maybe).
 * @returns {{ status: string, queued: boolean }}
 */
export function resolveCapacityStatus(requestedStatus, seats) {
  if (requestedStatus !== "confirmed") {
    return { status: requestedStatus, queued: false };
  }
  if (seats?.target == null) {
    return { status: "confirmed", queued: false };
  }
  if ((seats.open ?? 0) > 0) {
    return { status: "confirmed", queued: false };
  }
  return { status: "tentative", queued: true };
}

/** Pure FIFO pick from reserve rows (Maybe + legacy waitlist). */
export function pickNextReserve(rsvps = []) {
  const queue = rsvps
    .filter((row) => RESERVE_STATUSES.has(row.status))
    .slice()
    .sort((a, b) => {
      const aq = Date.parse(a.queuedAt || a.updatedAt || 0);
      const bq = Date.parse(b.queuedAt || b.updatedAt || 0);
      if (aq !== bq) return aq - bq;
      return String(a.steamId).localeCompare(String(b.steamId));
    });
  return queue[0] || null;
}

/** @deprecated use pickNextReserve */
export function pickNextWaitlisted(rsvps = []) {
  return pickNextReserve(rsvps);
}

function redactReasons(rsvp, { viewerSteamId, canSeeAllReasons }) {
  if (!rsvp) return rsvp;
  if (canSeeAllReasons || rsvp.steamId === viewerSteamId) return rsvp;
  if (!ABSENCE_STATUSES.has(rsvp.status)) return rsvp;
  return { ...rsvp, reasonCode: null, reasonNote: null };
}

export async function listRsvpsForEvent(env, eventId) {
  const db = requireDb(env);
  const result = await db
    .prepare(
      `SELECT event_id, steam_id, status, reason_code, reason_note, queued_at, updated_at
       FROM rsvps
       WHERE event_id = ?
       ORDER BY
         CASE status
           WHEN 'confirmed' THEN 0
           WHEN 'waitlist' THEN 1
           WHEN 'tentative' THEN 2
           WHEN 'declined' THEN 3
           WHEN 'unavailable' THEN 4
           ELSE 5
         END,
         COALESCE(queued_at, updated_at) ASC,
         updated_at DESC`
    )
    .bind(eventId)
    .all();

  return (result.results || []).map(rowToRsvp);
}

export async function getRsvp(env, eventId, steamId) {
  const db = requireDb(env);
  const row = await db
    .prepare(
      `SELECT event_id, steam_id, status, reason_code, reason_note, queued_at, updated_at
       FROM rsvps
       WHERE event_id = ? AND steam_id = ?`
    )
    .bind(eventId, steamId)
    .first();
  return row ? rowToRsvp(row) : null;
}

async function promoteNextReserve(env, eventId) {
  const rsvps = await listRsvpsForEvent(env, eventId);
  const next = pickNextReserve(rsvps);
  if (!next) return null;

  const now = new Date().toISOString();
  const db = requireDb(env);
  await db
    .prepare(
      `UPDATE rsvps
       SET status = 'confirmed', reason_code = NULL, reason_note = NULL, queued_at = NULL, updated_at = ?
       WHERE event_id = ? AND steam_id = ? AND status IN ('tentative', 'waitlist')`
    )
    .bind(now, eventId, next.steamId)
    .run();

  const promoted = await getRsvp(env, eventId, next.steamId);
  if (promoted?.status === "confirmed") {
    await enqueueNotification(env, {
      type: "waitlist_promoted",
      eventId,
      steamId: next.steamId,
    });
    return promoted;
  }
  return null;
}

async function persistRsvp(env, eventId, steamId, requestedStatus, reasonCode, reasonNote, queuedAt) {
  const now = new Date().toISOString();
  const db = requireDb(env);
  await db
    .prepare(
      `INSERT INTO rsvps (event_id, steam_id, status, reason_code, reason_note, queued_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(event_id, steam_id) DO UPDATE SET
         status = excluded.status,
         reason_code = excluded.reason_code,
         reason_note = excluded.reason_note,
         queued_at = excluded.queued_at,
         updated_at = excluded.updated_at`
    )
    .bind(eventId, steamId, requestedStatus, reasonCode, reasonNote, queuedAt, now)
    .run();
}

/**
 * @param {object} env
 * @param {string} eventId
 * @param {string} steamId
 * @param {{ status: string, reasonCode?: string, reasonNote?: string, forceConfirm?: boolean, actorRole?: string, isEditor?: boolean }} options
 */
export async function upsertRsvp(env, eventId, steamId, options = {}) {
  const event = await getEvent(env, eventId);
  if (!event) return { error: "Event not found", status: 404 };

  const isEditor = Boolean(options.isEditor);
  const closed = await isRsvpClosedForEvent(env, event);
  if (closed && !isEditor) {
    return { error: "RSVP is closed", status: 423 };
  }

  const sanitized = sanitizeRsvpStatus(options.status);
  if (sanitized.error) return { error: sanitized.error, status: 400 };

  let requestedStatus = sanitized.status;
  const previous = await getRsvp(env, eventId, steamId);
  const existing = await listRsvpsForEvent(env, eventId);
  const countsBefore = summarizeRsvpCounts(existing);
  const seatsBaseline = computeSeats(event, {
    ...countsBefore,
    confirmed:
      previous?.status === "confirmed"
        ? Math.max(0, countsBefore.confirmed - 1)
        : countsBefore.confirmed,
  });

  if (requestedStatus === "confirmed" && !options.forceConfirm) {
    const resolved = resolveCapacityStatus("confirmed", seatsBaseline);
    requestedStatus = resolved.status;
  } else if (requestedStatus === "confirmed" && options.forceConfirm && !isEditor) {
    return { error: "Editor access required to force confirm", status: 403 };
  }

  let reasonCode = null;
  let reasonNote = null;

  const now = new Date().toISOString();
  let queuedAt = null;
  if (requestedStatus === "tentative") {
    if (previous?.status === "tentative" || previous?.status === "waitlist") {
      queuedAt = previous.queuedAt || previous.updatedAt || now;
    } else {
      queuedAt = now;
    }
  }

  await persistRsvp(env, eventId, steamId, requestedStatus, reasonCode, reasonNote, queuedAt);

  let promoted = null;
  const freedSeat =
    previous &&
    SEAT_HOLDING.has(previous.status) &&
    !SEAT_HOLDING.has(requestedStatus);

  if (freedSeat && event.signupTarget != null) {
    promoted = await promoteNextReserve(env, eventId);
  }

  const rsvp = await getRsvp(env, eventId, steamId);
  const rsvps = await listRsvpsForEvent(env, eventId);
  const counts = summarizeRsvpCounts(rsvps);
  const seats = computeSeats(event, counts);

  if (seats.lookingForFills && freedSeat) {
    await enqueueNotification(env, {
      type: "fill_needed",
      eventId,
      meta: { confirmed: seats.confirmed, target: seats.target },
    });
  }

  return { rsvp, rsvps, counts, seats, promoted, rsvpClosed: closed };
}

export async function submitRaincheck(env, eventId, steamId, options = {}) {
  const event = await getEvent(env, eventId);
  if (!event) return { error: "Event not found", status: 404 };

  const closed = await isRsvpClosedForEvent(env, event);
  if (!closed) {
    return { error: "Raincheck is only available after RSVP closes", status: 400 };
  }

  const previous = await getRsvp(env, eventId, steamId);
  if (previous?.status !== "confirmed") {
    return { error: "Raincheck is only for confirmed players", status: 400 };
  }

  const reason = sanitizeRsvpReason(options.reasonCode, options.reasonNote, { required: true });
  if (reason.error) return { error: reason.error, status: 400 };

  await persistRsvp(
    env,
    eventId,
    steamId,
    "declined",
    reason.reasonCode,
    reason.reasonNote,
    null
  );

  let promoted = null;
  if (event.signupTarget != null) {
    promoted = await promoteNextReserve(env, eventId);
  }

  await enqueueNotification(env, {
    type: "raincheck",
    eventId,
    steamId,
    reasonCode: reason.reasonCode,
    reasonNote: reason.reasonNote,
  });

  const rsvp = await getRsvp(env, eventId, steamId);
  const rsvps = await listRsvpsForEvent(env, eventId);
  const counts = summarizeRsvpCounts(rsvps);
  const seats = computeSeats(event, counts);

  return { rsvp, rsvps, counts, seats, promoted, rsvpClosed: closed };
}

export async function deleteRsvp(env, eventId, steamId) {
  const db = requireDb(env);
  await db
    .prepare(`DELETE FROM rsvps WHERE event_id = ? AND steam_id = ?`)
    .bind(eventId, steamId)
    .run();
  return { ok: true };
}

/** Incomplete RSVPs are not tracked; rolling attendance = confirmed / (confirmed+declined+unavailable) over window. */
export async function listRsvpsForEvents(env, eventIds) {
  const ids = (eventIds || []).map((id) => String(id || "").trim()).filter(Boolean);
  if (!ids.length) return [];

  const db = requireDb(env);
  const placeholders = ids.map(() => "?").join(",");
  const result = await db
    .prepare(
      `SELECT event_id, steam_id, status, reason_code, reason_note, queued_at, updated_at
       FROM rsvps
       WHERE event_id IN (${placeholders})`
    )
    .bind(...ids)
    .all();

  return (result.results || []).map(rowToRsvp);
}

export async function presentRsvpPayload({
  rsvps,
  event,
  viewerSteamId,
  canSeeAllReasons,
  promoted = null,
  env = null,
}) {
  const counts = summarizeRsvpCounts(rsvps);
  const seats = computeSeats(event, counts);
  const uiCounts = summarizeUiCounts(counts);
  const visible = rsvps.map((row) =>
    redactReasons(row, { viewerSteamId, canSeeAllReasons })
  );
  const mine = visible.find((row) => row.steamId === viewerSteamId) || null;
  const rsvpClosed =
    env && event ? await isRsvpClosedForEvent(env, event) : Boolean(event?.rsvpClosed);
  return {
    rsvps: visible,
    counts,
    uiCounts,
    seats,
    mine,
    rsvpClosed,
    promoted: promoted
      ? redactReasons(promoted, { viewerSteamId, canSeeAllReasons })
      : null,
  };
}
