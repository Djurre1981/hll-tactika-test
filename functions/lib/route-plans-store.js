import { requireDb } from "./d1.js";

function parseJson(raw, fallback) {
  if (raw == null || raw === "") return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function rowToPlan(row, { includePlan = true } = {}) {
  const parsed = parseJson(row.plan_json, {});
  const plan = {
    id: row.id,
    title: row.title,
    mapId: parsed.mapId || null,
    factionId: parsed.factionId || null,
    locked: Boolean(row.locked),
    lockedBy: row.locked_by || null,
    createdBy: row.created_by,
    createdByName: row.created_by_name || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (includePlan) {
    plan.plan = parsed;
  }
  return plan;
}

const FULL_COLUMNS =
  "id, title, plan_json, locked, locked_by, created_by, created_by_name, created_at, updated_at";

export async function listRoutePlans(env) {
  const db = requireDb(env);
  const result = await db
    .prepare(`SELECT ${FULL_COLUMNS} FROM route_plans ORDER BY updated_at DESC`)
    .all();
  return (result.results || []).map((row) => rowToPlan(row, { includePlan: false }));
}

export async function getRoutePlan(env, id) {
  const db = requireDb(env);
  const row = await db
    .prepare(`SELECT ${FULL_COLUMNS} FROM route_plans WHERE id = ?`)
    .bind(id)
    .first();
  return row ? rowToPlan(row, { includePlan: true }) : null;
}

export async function saveRoutePlan(env, plan) {
  const db = requireDb(env);
  await db
    .prepare(
      `INSERT INTO route_plans (
        id, title, plan_json, locked, locked_by, created_by, created_by_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        plan_json = excluded.plan_json,
        locked = excluded.locked,
        locked_by = excluded.locked_by,
        updated_at = excluded.updated_at`
    )
    .bind(
      plan.id,
      plan.title,
      JSON.stringify(plan.plan || {}),
      plan.locked ? 1 : 0,
      plan.lockedBy || null,
      plan.createdBy,
      plan.createdByName || null,
      plan.createdAt,
      plan.updatedAt
    )
    .run();
  return getRoutePlan(env, plan.id);
}

export async function deleteRoutePlan(env, id) {
  const db = requireDb(env);
  await db.prepare("DELETE FROM route_plans WHERE id = ?").bind(id).run();
}
