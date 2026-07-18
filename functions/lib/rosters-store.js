import { requireDb } from "./d1.js";
import { createRosterMember, getRosterMember, listRosterMembers } from "./roster-store.js";

function rowToRoster(row) {
  return {
    id: row.id,
    name: row.name,
    tournament: row.tournament || null,
    notes: row.notes || "",
    sortOrder: Number(row.sort_order) || 0,
    memberCount: Number(row.member_count) || 0,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMember(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    steamId: row.steam_id || null,
    avatarUrl: row.avatar_url || null,
    rosterRole: row.membership_role || row.roster_role || null,
    status: row.status || "active",
    notes: row.notes || "",
    sortOrder: Number(row.membership_sort ?? row.sort_order) || 0,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listRosters(env) {
  const db = requireDb(env);
  const result = await db
    .prepare(
      `SELECT r.id, r.name, r.tournament, r.notes, r.sort_order,
              r.created_by, r.created_at, r.updated_at,
              COUNT(m.member_id) AS member_count
       FROM rosters r
       LEFT JOIN roster_memberships m ON m.roster_id = r.id
       GROUP BY r.id
       ORDER BY r.sort_order ASC, r.name COLLATE NOCASE ASC`
    )
    .all();

  return (result.results || []).map(rowToRoster);
}

export async function getRoster(env, rosterId) {
  const db = requireDb(env);
  const row = await db
    .prepare(
      `SELECT r.id, r.name, r.tournament, r.notes, r.sort_order,
              r.created_by, r.created_at, r.updated_at,
              (SELECT COUNT(*) FROM roster_memberships m WHERE m.roster_id = r.id) AS member_count
       FROM rosters r
       WHERE r.id = ?`
    )
    .bind(rosterId)
    .first();

  return row ? rowToRoster(row) : null;
}

export async function createRoster(env, roster) {
  const db = requireDb(env);
  await db
    .prepare(
      `INSERT INTO rosters
       (id, name, tournament, notes, sort_order, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      roster.id,
      roster.name,
      roster.tournament || null,
      roster.notes || null,
      roster.sortOrder ?? 0,
      roster.createdBy,
      roster.createdAt,
      roster.updatedAt
    )
    .run();

  return getRoster(env, roster.id);
}

export async function updateRoster(env, rosterId, updates) {
  const existing = await getRoster(env, rosterId);
  if (!existing) return null;

  const next = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const db = requireDb(env);
  await db
    .prepare(
      `UPDATE rosters
       SET name = ?, tournament = ?, notes = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(
      next.name,
      next.tournament || null,
      next.notes || null,
      next.sortOrder ?? 0,
      next.updatedAt,
      rosterId
    )
    .run();

  return getRoster(env, rosterId);
}

export async function deleteRoster(env, rosterId) {
  const existing = await getRoster(env, rosterId);
  if (!existing) return null;

  const db = requireDb(env);
  await db.prepare("DELETE FROM rosters WHERE id = ?").bind(rosterId).run();
  return existing;
}

export async function listRosterMembersInRoster(env, rosterId) {
  const db = requireDb(env);
  const result = await db
    .prepare(
      `SELECT rm.id, rm.display_name, rm.steam_id, rm.avatar_url, rm.roster_role,
              rm.status, rm.notes, rm.sort_order, rm.created_by, rm.created_at, rm.updated_at,
              m.roster_role AS membership_role, m.sort_order AS membership_sort
       FROM roster_memberships m
       JOIN roster_members rm ON rm.id = m.member_id
       WHERE m.roster_id = ?
       ORDER BY m.sort_order ASC, rm.display_name COLLATE NOCASE ASC`
    )
    .bind(rosterId)
    .all();

  return (result.results || []).map(rowToMember);
}

export async function findMemberBySteamId(env, steamId) {
  if (!steamId) return null;
  const db = requireDb(env);
  const row = await db
    .prepare(
      `SELECT id, display_name, steam_id, avatar_url, roster_role, status, notes,
              sort_order, created_by, created_at, updated_at
       FROM roster_members
       WHERE steam_id = ?
       LIMIT 1`
    )
    .bind(steamId)
    .first();

  if (!row) return null;
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

export async function addMemberToRoster(env, rosterId, memberId, { rosterRole = null, sortOrder = 0 } = {}) {
  const roster = await getRoster(env, rosterId);
  if (!roster) return { error: "Roster not found", status: 404 };

  const member = await getRosterMember(env, memberId);
  if (!member) return { error: "Member not found", status: 404 };

  const db = requireDb(env);
  const existing = await db
    .prepare(
      `SELECT roster_id FROM roster_memberships WHERE roster_id = ? AND member_id = ?`
    )
    .bind(rosterId, memberId)
    .first();

  if (existing) {
    return { member, alreadyMember: true };
  }

  await db
    .prepare(
      `INSERT INTO roster_memberships (roster_id, member_id, roster_role, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(rosterId, memberId, rosterRole || member.rosterRole || null, sortOrder, new Date().toISOString())
    .run();

  const members = await listRosterMembersInRoster(env, rosterId);
  return { member: members.find((m) => m.id === memberId) || member };
}

export async function removeMemberFromRoster(env, rosterId, memberId) {
  const db = requireDb(env);
  const existing = await db
    .prepare(
      `SELECT roster_id FROM roster_memberships WHERE roster_id = ? AND member_id = ?`
    )
    .bind(rosterId, memberId)
    .first();

  if (!existing) return null;

  await db
    .prepare(`DELETE FROM roster_memberships WHERE roster_id = ? AND member_id = ?`)
    .bind(rosterId, memberId)
    .run();

  return { rosterId, memberId };
}

export async function ensureMemberAndAddToRoster(env, rosterId, memberData) {
  let member = null;
  if (memberData.steamId) {
    member = await findMemberBySteamId(env, memberData.steamId);
  }

  if (!member) {
    member = await createRosterMember(env, memberData);
  }

  return addMemberToRoster(env, rosterId, member.id, {
    rosterRole: memberData.rosterRole || null,
  });
}

export { listRosterMembers };
