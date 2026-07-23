import { canEnterEditorMode } from "./pin-permissions.js";
import { requireDb } from "./d1.js";
import { assertEventEditable, getEvent } from "./events-store.js";

const TASK_COLUMNS =
  "id, event_id, title, description, assignee_steam_id, completed, completed_at, created_by, created_at, updated_at";

function rowToPrepTask(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    title: row.title,
    description: row.description || "",
    assigneeSteamId: row.assignee_steam_id,
    completed: Boolean(row.completed),
    completedAt: row.completed_at || null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMyPrepTask(row) {
  return {
    ...rowToPrepTask(row),
    eventTitle: row.event_title,
    eventStartsAt: row.event_starts_at,
    eventType: row.event_event_type,
  };
}

export function canEditorManagePrepTasks(role) {
  return canEnterEditorMode(role);
}

export function canAssigneeCompletePrepTask(task, steamId, role) {
  if (!task) return false;
  if (canEditorManagePrepTasks(role)) return true;
  return String(task.assigneeSteamId) === String(steamId);
}

export function sanitizeCreatePrepTaskBody(body) {
  const title = String(body?.title || "").trim().slice(0, 200);
  const assigneeSteamId = String(body?.assigneeSteamId || "").trim();
  const description = String(body?.description || "").trim().slice(0, 1000);

  if (!title) return { error: "title is required" };
  if (!assigneeSteamId) return { error: "assigneeSteamId is required" };

  return {
    task: {
      title,
      assigneeSteamId,
      description,
    },
  };
}

export function sanitizeUpdatePrepTaskBody(body) {
  const patch = {};
  const keys = Object.keys(body || {});

  if (keys.includes("title")) {
    const title = String(body.title || "").trim().slice(0, 200);
    if (!title) return { error: "title cannot be empty" };
    patch.title = title;
  }

  if (keys.includes("description")) {
    patch.description = String(body.description || "").trim().slice(0, 1000);
  }

  if (keys.includes("assigneeSteamId")) {
    const assigneeSteamId = String(body.assigneeSteamId || "").trim();
    if (!assigneeSteamId) return { error: "assigneeSteamId cannot be empty" };
    patch.assigneeSteamId = assigneeSteamId;
  }

  if (keys.includes("completed")) {
    patch.completed = Boolean(body.completed);
  }

  if (!Object.keys(patch).length) {
    return { error: "No valid fields to update" };
  }

  return { patch };
}

export function classifyPrepTaskPatch(patch) {
  const fieldKeys = Object.keys(patch).filter((key) => key !== "completed");
  return {
    togglesCompletion: Object.prototype.hasOwnProperty.call(patch, "completed"),
    editsFields: fieldKeys.length > 0,
  };
}

async function assertEventAllowsPrepTaskMutation(env, eventId) {
  const event = await getEvent(env, eventId);
  if (!event) return { error: "Event not found", status: 404 };
  const editable = assertEventEditable(event);
  if (editable.error) return editable;
  return { ok: true, event };
}

export async function listPrepTasksForEvent(env, eventId) {
  const db = requireDb(env);
  const result = await db
    .prepare(
      `SELECT ${TASK_COLUMNS}
       FROM prep_tasks
       WHERE event_id = ?
       ORDER BY completed ASC, created_at ASC`
    )
    .bind(eventId)
    .all();

  return (result.results || []).map(rowToPrepTask);
}

export async function listIncompletePrepTasksForAssignee(env, steamId, { from, to }) {
  const db = requireDb(env);
  const result = await db
    .prepare(
      `SELECT pt.id, pt.event_id, pt.title, pt.description, pt.assignee_steam_id,
              pt.completed, pt.completed_at, pt.created_by, pt.created_at, pt.updated_at,
              e.title AS event_title, e.starts_at AS event_starts_at, e.event_type AS event_event_type
       FROM prep_tasks pt
       INNER JOIN events e ON e.id = pt.event_id
       WHERE pt.assignee_steam_id = ?
         AND pt.completed = 0
         AND e.starts_at >= ?
         AND e.starts_at < ?
       ORDER BY e.starts_at ASC, pt.created_at ASC`
    )
    .bind(steamId, from, to)
    .all();

  return (result.results || []).map(rowToMyPrepTask);
}

export async function getPrepTask(env, eventId, taskId) {
  const db = requireDb(env);
  const row = await db
    .prepare(
      `SELECT ${TASK_COLUMNS}
       FROM prep_tasks
       WHERE event_id = ? AND id = ?`
    )
    .bind(eventId, taskId)
    .first();

  return row ? rowToPrepTask(row) : null;
}

export async function createPrepTask(env, eventId, input, createdBy) {
  const allowed = await assertEventAllowsPrepTaskMutation(env, eventId);
  if (allowed.error) return allowed;

  const now = new Date().toISOString();
  const task = {
    id: `prep-${crypto.randomUUID()}`,
    eventId,
    title: input.title,
    description: input.description || "",
    assigneeSteamId: input.assigneeSteamId,
    completed: false,
    completedAt: null,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };

  const db = requireDb(env);
  await db
    .prepare(
      `INSERT INTO prep_tasks (
        id, event_id, title, description, assignee_steam_id, completed, completed_at,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      task.id,
      task.eventId,
      task.title,
      task.description || null,
      task.assigneeSteamId,
      0,
      null,
      task.createdBy,
      task.createdAt,
      task.updatedAt
    )
    .run();

  return { task };
}

export async function updatePrepTask(env, eventId, taskId, patch) {
  const existing = await getPrepTask(env, eventId, taskId);
  if (!existing) return { error: "Prep task not found", status: 404 };

  const allowed = await assertEventAllowsPrepTaskMutation(env, eventId);
  if (allowed.error) return allowed;

  const now = new Date().toISOString();
  const next = {
    ...existing,
    ...patch,
    updatedAt: now,
  };

  if (Object.prototype.hasOwnProperty.call(patch, "completed")) {
    next.completedAt = patch.completed ? now : null;
  }

  const db = requireDb(env);
  await db
    .prepare(
      `UPDATE prep_tasks
       SET title = ?, description = ?, assignee_steam_id = ?, completed = ?, completed_at = ?, updated_at = ?
       WHERE event_id = ? AND id = ?`
    )
    .bind(
      next.title,
      next.description || null,
      next.assigneeSteamId,
      next.completed ? 1 : 0,
      next.completedAt,
      next.updatedAt,
      eventId,
      taskId
    )
    .run();

  return { task: await getPrepTask(env, eventId, taskId) };
}

export async function deletePrepTask(env, eventId, taskId) {
  const existing = await getPrepTask(env, eventId, taskId);
  if (!existing) return { error: "Prep task not found", status: 404 };

  const allowed = await assertEventAllowsPrepTaskMutation(env, eventId);
  if (allowed.error) return allowed;

  const db = requireDb(env);
  await db
    .prepare("DELETE FROM prep_tasks WHERE event_id = ? AND id = ?")
    .bind(eventId, taskId)
    .run();

  return { ok: true, taskId };
}
