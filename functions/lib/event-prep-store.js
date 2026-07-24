import { requireDb } from "./d1.js";
import { assertEventEditable, getEvent } from "./events-store.js";
import { getStrat } from "./strats-store.js";
import { canEnterEditorMode } from "./pin-permissions.js";
import {
  PREP_TASK_TYPE_IDS,
  defaultEnabledPrepTypes,
  prepTaskMeta,
} from "./prep-task-types.js";

const SLOT_COLUMNS =
  "id, event_id, task_type, enabled, primary_steam_id, helper_steam_ids, completed_at, note, created_at, updated_at";

function parseHelpers(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((id) => String(id || "").trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

function rowToSlot(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    taskType: row.task_type,
    enabled: Boolean(row.enabled),
    primarySteamId: row.primary_steam_id || null,
    helperSteamIds: parseHelpers(row.helper_steam_ids),
    completedAt: row.completed_at || null,
    note: row.note || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadLinkedStratCategories(env, event) {
  const ids = event?.components?.stratIds || [];
  const categories = new Map();
  for (const stratId of ids) {
    const strat = await getStrat(env, String(stratId));
    if (!strat) continue;
    const category = strat.prepCategory || "general";
    categories.set(String(stratId), category);
  }
  return categories;
}

export function hasPrepToolLink(taskType, event, stratCategories) {
  const meta = prepTaskMeta(taskType);
  if (!meta) return false;
  const components = event?.components || {};

  if (meta.link === "strat" && meta.prepCategory) {
    for (const category of stratCategories.values()) {
      if (category === meta.prepCategory) return true;
    }
    return false;
  }

  if (meta.link === "routes") {
    return Array.isArray(components.routePlanIds) && components.routePlanIds.length > 0;
  }

  if (meta.link === "lineups") {
    return Boolean(components.lineupId);
  }

  return false;
}

export function resolvePrepSlotStatus(slot, event, stratCategories) {
  if (slot.completedAt) return "done";
  const meta = prepTaskMeta(slot.taskType);
  if (hasPrepToolLink(slot.taskType, event, stratCategories)) return "in_progress";
  if (meta?.link === "manual" && (slot.primarySteamId || slot.helperSteamIds?.length)) {
    return "in_progress";
  }
  return "not_started";
}

export function enrichPrepSlot(slot, event, stratCategories) {
  const status = resolvePrepSlotStatus(slot, event, stratCategories);
  const meta = prepTaskMeta(slot.taskType);
  return {
    ...slot,
    status,
    label: meta?.label || slot.taskType,
    autoInProgress: status === "in_progress" && !slot.completedAt && meta?.link !== "manual",
  };
}

function emptySlot(eventId, taskType, now, enabled = false) {
  return {
    id: `prep-slot-${crypto.randomUUID()}`,
    eventId,
    taskType,
    enabled,
    primarySteamId: null,
    helperSteamIds: [],
    completedAt: null,
    note: "",
    createdAt: now,
    updatedAt: now,
  };
}

export async function ensureEventPrepPlan(env, eventId, eventType) {
  const existing = await listPrepSlotsRaw(env, eventId);
  if (existing.length) return existing;

  const now = new Date().toISOString();
  const enabledSet = new Set(defaultEnabledPrepTypes(eventType));
  const db = requireDb(env);

  for (const taskType of PREP_TASK_TYPE_IDS) {
    const slot = emptySlot(eventId, taskType, now, enabledSet.has(taskType));
    await db
      .prepare(
        `INSERT INTO event_prep_slots
         (id, event_id, task_type, enabled, primary_steam_id, helper_steam_ids, completed_at, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        slot.id,
        slot.eventId,
        slot.taskType,
        slot.enabled ? 1 : 0,
        null,
        "[]",
        null,
        null,
        slot.createdAt,
        slot.updatedAt
      )
      .run();
  }

  return listPrepSlotsRaw(env, eventId);
}

async function listPrepSlotsRaw(env, eventId) {
  const db = requireDb(env);
  const result = await db
    .prepare(
      `SELECT ${SLOT_COLUMNS}
       FROM event_prep_slots
       WHERE event_id = ?
       ORDER BY CASE task_type
         WHEN 'general_strat' THEN 0
         WHEN 'tank_strat' THEN 1
         WHEN 'defense_strat' THEN 2
         WHEN 'mg_strat' THEN 3
         WHEN 'routes' THEN 4
         WHEN 'snipes' THEN 5
         WHEN 'commander_prep' THEN 6
         WHEN 'lineups' THEN 7
         WHEN 'other' THEN 8
         ELSE 9 END`
    )
    .bind(eventId)
    .all();

  return (result.results || []).map(rowToSlot);
}

export async function getEventPrepPlan(env, eventId) {
  const event = await getEvent(env, eventId);
  if (!event) return { error: "Event not found", status: 404 };

  let slots = await listPrepSlotsRaw(env, eventId);
  if (!slots.length) {
    slots = await ensureEventPrepPlan(env, eventId, event.eventType);
  }

  const stratCategories = await loadLinkedStratCategories(env, event);
  const enriched = slots.map((slot) => enrichPrepSlot(slot, event, stratCategories));
  const enabled = enriched.filter((slot) => slot.enabled);
  const openCount = enabled.filter((slot) => slot.status !== "done").length;

  return { event, slots: enriched, openCount };
}

function sanitizeSteamId(raw) {
  const id = String(raw || "").trim();
  return /^7656119\d{10}$/.test(id) ? id : null;
}

function sanitizeHelpers(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(sanitizeSteamId).filter(Boolean))].slice(0, 6);
}

export function sanitizePrepPlanBody(body) {
  const slots = body?.slots;
  if (!Array.isArray(slots)) return { error: "slots array is required" };

  const sanitized = [];
  const seen = new Set();

  for (const row of slots) {
    const taskType = String(row?.taskType || "").trim();
    if (!PREP_TASK_TYPE_IDS.includes(taskType) || seen.has(taskType)) continue;
    seen.add(taskType);

    sanitized.push({
      taskType,
      enabled: Boolean(row.enabled),
      primarySteamId: sanitizeSteamId(row.primarySteamId),
      helperSteamIds: sanitizeHelpers(row.helperSteamIds),
      note: String(row.note || "").trim().slice(0, 280),
    });
  }

  if (!sanitized.length) return { error: "At least one prep slot is required" };
  return { slots: sanitized };
}

export async function saveEventPrepPlan(env, eventId, slotsInput, { actorRole } = {}) {
  if (!canEnterEditorMode(actorRole)) {
    return { error: "Editor access required", status: 403 };
  }

  const event = await getEvent(env, eventId);
  if (!event) return { error: "Event not found", status: 404 };
  const editable = assertEventEditable(event);
  if (editable.error) return editable;

  const sanitized = sanitizePrepPlanBody({ slots: slotsInput });
  if (sanitized.error) return { error: sanitized.error, status: 400 };

  await ensureEventPrepPlan(env, eventId, (await getEvent(env, eventId))?.eventType);
  const existing = await listPrepSlotsRaw(env, eventId);
  const byType = new Map(existing.map((slot) => [slot.taskType, slot]));
  const now = new Date().toISOString();
  const db = requireDb(env);

  for (const row of sanitized.slots) {
    const prev = byType.get(row.taskType) || emptySlot(eventId, row.taskType, now);
    await db
      .prepare(
        `INSERT INTO event_prep_slots
         (id, event_id, task_type, enabled, primary_steam_id, helper_steam_ids, completed_at, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(event_id, task_type) DO UPDATE SET
           enabled = excluded.enabled,
           primary_steam_id = excluded.primary_steam_id,
           helper_steam_ids = excluded.helper_steam_ids,
           note = excluded.note,
           updated_at = excluded.updated_at`
      )
      .bind(
        prev.id,
        eventId,
        row.taskType,
        row.enabled ? 1 : 0,
        row.primarySteamId,
        JSON.stringify(row.helperSteamIds),
        prev.completedAt,
        row.note || null,
        prev.createdAt || now,
        now
      )
      .run();
  }

  return getEventPrepPlan(env, eventId);
}

export function canCompletePrepSlot(slot, steamId, role) {
  if (!slot?.enabled) return false;
  if (canEnterEditorMode(role)) return true;
  const id = String(steamId || "");
  if (!id) return false;
  if (String(slot.primarySteamId) === id) return true;
  return (slot.helperSteamIds || []).some((helperId) => String(helperId) === id);
}

export async function setPrepSlotDone(env, eventId, taskType, done, { steamId, role }) {
  const plan = await getEventPrepPlan(env, eventId);
  if (plan.error) return plan;

  const slot = plan.slots.find((row) => row.taskType === taskType);
  if (!slot) return { error: "Prep slot not found", status: 404 };
  if (!slot.enabled) return { error: "Prep slot is not enabled", status: 400 };

  if (!canCompletePrepSlot(slot, steamId, role)) {
    return { error: "Not allowed to update this prep slot", status: 403 };
  }

  const event = plan.event;
  const editable = assertEventEditable(event);
  if (editable.error && !canEnterEditorMode(role)) return editable;

  const now = new Date().toISOString();
  const db = requireDb(env);
  await db
    .prepare(
      `UPDATE event_prep_slots
       SET completed_at = ?, updated_at = ?
       WHERE event_id = ? AND task_type = ?`
    )
    .bind(done ? now : null, now, eventId, taskType)
    .run();

  return getEventPrepPlan(env, eventId);
}

function slotToOpenTask(row) {
  return {
    id: row.id,
    eventId: row.eventId,
    title: row.label || row.taskType,
    description: row.note || "",
    assigneeSteamId: row.primarySteamId || row.helperSteamIds?.[0] || "",
    completed: row.status === "done",
    completedAt: row.completedAt,
    taskType: row.taskType,
    status: row.status,
    eventTitle: row.eventTitle,
    eventStartsAt: row.eventStartsAt,
    eventType: row.eventType,
  };
}

export async function listOpenPrepSlotsInRange(env, { from, to }) {
  const db = requireDb(env);
  const result = await db
    .prepare(
      `SELECT s.id, s.event_id, s.task_type, s.enabled, s.primary_steam_id, s.helper_steam_ids,
              s.completed_at, s.note, s.created_at, s.updated_at,
              e.title AS event_title, e.starts_at AS event_starts_at, e.event_type AS event_event_type,
              e.components_json
       FROM event_prep_slots s
       INNER JOIN events e ON e.id = s.event_id
       WHERE s.enabled = 1
         AND s.completed_at IS NULL
         AND e.starts_at >= ?
         AND e.starts_at < ?
       ORDER BY e.starts_at ASC, s.created_at ASC`
    )
    .bind(from, to)
    .all();

  const out = [];
  for (const row of result.results || []) {
    const event = {
      id: row.event_id,
      title: row.event_title,
      startsAt: row.event_starts_at,
      eventType: row.event_event_type,
      components: row.components_json ? JSON.parse(row.components_json) : {},
    };
    const slot = enrichPrepSlot(rowToSlot(row), event, await loadLinkedStratCategories(env, event));
    if (slot.status === "done") continue;
    out.push(
      slotToOpenTask({
        ...slot,
        eventTitle: row.event_title,
        eventStartsAt: row.event_starts_at,
        eventType: row.event_event_type,
      })
    );
  }
  return out;
}

export async function listIncompletePrepSlotsForAssignee(env, steamId, { from, to }) {
  return listMyPrepSlotsInRange(env, steamId, { from, to });
}

export async function listMyPrepSlotsInRange(env, steamId, { from, to }) {
  const db = requireDb(env);
  const result = await db
    .prepare(
      `SELECT s.id, s.event_id, s.task_type, s.enabled, s.primary_steam_id, s.helper_steam_ids,
              s.completed_at, s.note, s.created_at, s.updated_at,
              e.title AS event_title, e.starts_at AS event_starts_at, e.event_type AS event_event_type,
              e.components_json
       FROM event_prep_slots s
       INNER JOIN events e ON e.id = s.event_id
       WHERE s.enabled = 1
         AND s.completed_at IS NULL
         AND e.starts_at >= ?
         AND e.starts_at < ?
         AND (s.primary_steam_id = ? OR s.helper_steam_ids LIKE ?)
       ORDER BY e.starts_at ASC, s.created_at ASC`
    )
    .bind(from, to, steamId, `%${steamId}%`)
    .all();

  const out = [];
  const id = String(steamId || "");
  for (const row of result.results || []) {
    const slot = rowToSlot(row);
    const helpers = slot.helperSteamIds || [];
    if (String(slot.primarySteamId) !== id && !helpers.includes(id)) continue;

    const event = {
      id: row.event_id,
      components: row.components_json ? JSON.parse(row.components_json) : {},
    };
    const enriched = enrichPrepSlot(slot, event, await loadLinkedStratCategories(env, event));
    if (enriched.status === "done") continue;
    out.push(
      slotToOpenTask({
        ...enriched,
        eventTitle: row.event_title,
        eventStartsAt: row.event_starts_at,
        eventType: row.event_event_type,
      })
    );
  }
  return out;
}

export function countOpenPrepSlots(slots = []) {
  return slots.filter((slot) => slot.enabled && slot.status !== "done").length;
}
