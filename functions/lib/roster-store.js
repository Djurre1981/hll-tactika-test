import { requireDb } from "./d1.js";

function rowToMember(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    steamId: row.steam_id || null,
    avatarUrl: row.avatar_url || null,
    rosterRole: row.roster_role || null,
    status: row.status || "active",
    notes: row.notes || "",
    sortOrder: Number(row.sort_order) || 0,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listRosterMembers(env) {
  const db = requireDb(env);
  const result = await db
    .prepare(
      `SELECT id, display_name, steam_id, avatar_url, roster_role, status, notes,
              sort_order, created_by, created_at, updated_at
       FROM roster_members
       ORDER BY sort_order ASC, display_name COLLATE NOCASE ASC`
    )
    .all();

  return (result.results || []).map(rowToMember);
}

export async function getRosterMember(env, memberId) {
  const db = requireDb(env);
  const row = await db
    .prepare(
      `SELECT id, display_name, steam_id, avatar_url, roster_role, status, notes,
              sort_order, created_by, created_at, updated_at
       FROM roster_members
       WHERE id = ?`
    )
    .bind(memberId)
    .first();

  return row ? rowToMember(row) : null;
}

export async function createRosterMember(env, member) {
  const db = requireDb(env);
  await db
    .prepare(
      `INSERT INTO roster_members
       (id, display_name, steam_id, avatar_url, roster_role, status, notes,
        sort_order, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      member.id,
      member.displayName,
      member.steamId || null,
      member.avatarUrl || null,
      member.rosterRole || null,
      member.status || "active",
      member.notes || null,
      member.sortOrder ?? 0,
      member.createdBy,
      member.createdAt,
      member.updatedAt
    )
    .run();

  return getRosterMember(env, member.id);
}

export async function updateRosterMember(env, memberId, updates) {
  const existing = await getRosterMember(env, memberId);
  if (!existing) return null;

  const next = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const db = requireDb(env);
  await db
    .prepare(
      `UPDATE roster_members
       SET display_name = ?, steam_id = ?, avatar_url = ?, roster_role = ?,
           status = ?, notes = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(
      next.displayName,
      next.steamId || null,
      next.avatarUrl || null,
      next.rosterRole || null,
      next.status || "active",
      next.notes || null,
      next.sortOrder ?? 0,
      next.updatedAt,
      memberId
    )
    .run();

  return getRosterMember(env, memberId);
}

export async function deleteRosterMember(env, memberId) {
  const existing = await getRosterMember(env, memberId);
  if (!existing) return null;

  const db = requireDb(env);
  await db.prepare("DELETE FROM roster_members WHERE id = ?").bind(memberId).run();
  return existing;
}
