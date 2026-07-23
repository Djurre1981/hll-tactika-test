import { requireDb } from "./d1.js";
import { fetchSteamProfile, fetchSteamProfiles } from "./steam.js";

function parseTournaments(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((t) => String(t).trim()).filter(Boolean);
  } catch {
    /* fall through */
  }
  return String(raw)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseRoles(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((r) => String(r).trim()).filter(Boolean);
  }
  const text = String(raw).trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map((r) => String(r).trim()).filter(Boolean);
    } catch {
      /* fall through */
    }
  }
  if (text.includes(",")) {
    return text.split(",").map((r) => r.trim()).filter(Boolean);
  }
  return [text];
}

function rolesForDb(member) {
  if (typeof member.rosterRole === "string" && member.rosterRole.trim().startsWith("[")) {
    return member.rosterRole.trim();
  }
  const fromList = parseRoles(member.rosterRoles);
  if (fromList.length) return JSON.stringify(fromList);
  if (member.rosterRole) return JSON.stringify([String(member.rosterRole)]);
  return null;
}

function rowToMember(row) {
  const roles = parseRoles(row.roster_role);
  return {
    id: row.id,
    displayName: row.display_name,
    steamId: row.steam_id || null,
    t17Id: row.t17_id || null,
    avatarUrl: row.avatar_url || null,
    rosterRole: roles[0] || row.roster_role || null,
    rosterRoles: roles,
    tournaments: parseTournaments(row.tournaments),
    situation: row.situation || "member",
    status: row.status || "active",
    notes: row.notes || "",
    sortOrder: Number(row.sort_order) || 0,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const MEMBER_SELECT = `id, display_name, steam_id, t17_id, avatar_url, roster_role, tournaments,
              situation, status, notes, sort_order, created_by, created_at, updated_at`;

export async function listRosterMembers(env) {
  const db = requireDb(env);
  const result = await db
    .prepare(
      `SELECT ${MEMBER_SELECT}
       FROM roster_members
       ORDER BY sort_order ASC, display_name COLLATE NOCASE ASC`
    )
    .all();

  return (result.results || []).map(rowToMember);
}

export async function getRosterMember(env, memberId) {
  const db = requireDb(env);
  const row = await db
    .prepare(`SELECT ${MEMBER_SELECT} FROM roster_members WHERE id = ?`)
    .bind(memberId)
    .first();

  return row ? rowToMember(row) : null;
}

export async function createRosterMember(env, member) {
  const db = requireDb(env);
  const tournamentsJson = JSON.stringify(member.tournaments || []);
  await db
    .prepare(
      `INSERT INTO roster_members
       (id, display_name, steam_id, t17_id, avatar_url, roster_role, tournaments, situation,
        status, notes, sort_order, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      member.id,
      member.displayName,
      member.steamId || null,
      member.t17Id || null,
      member.avatarUrl || null,
      rolesForDb(member),
      tournamentsJson,
      member.situation || "member",
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
       SET display_name = ?, steam_id = ?, t17_id = ?, avatar_url = ?, roster_role = ?,
           tournaments = ?, situation = ?, status = ?, notes = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(
      next.displayName,
      next.steamId || null,
      next.t17Id || null,
      next.avatarUrl || null,
      rolesForDb(next),
      JSON.stringify(next.tournaments || []),
      next.situation || "member",
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

/** Resolve Steam avatar for a member payload; mutates nothing, returns avatar URL or null. */
export async function resolveSteamAvatarUrl(env, steamId, existingAvatarUrl = null) {
  if (existingAvatarUrl) return existingAvatarUrl;
  if (!steamId) return null;
  try {
    const profile = await fetchSteamProfile(steamId, env);
    return profile?.avatar || null;
  } catch {
    return null;
  }
}

/** Backfill avatar_url for members missing it; caps work per request for Workers limits. */
export async function backfillMemberAvatars(env, members, { max = 8 } = {}) {
  const needs = (members || []).filter((m) => m.steamId && !m.avatarUrl).slice(0, max);
  if (needs.length === 0) return members;

  let profiles;
  try {
    profiles = await fetchSteamProfiles(
      needs.map((m) => m.steamId),
      env,
    );
  } catch {
    return members;
  }

  const db = requireDb(env);
  const now = new Date().toISOString();
  const byId = new Map(members.map((m) => [m.id, { ...m }]));

  for (const member of needs) {
    const avatar = profiles.get(String(member.steamId))?.avatar || null;
    if (!avatar) continue;
    try {
      await db
        .prepare(`UPDATE roster_members SET avatar_url = ?, updated_at = ? WHERE id = ?`)
        .bind(avatar, now, member.id)
        .run();
      const next = byId.get(member.id);
      if (next) next.avatarUrl = avatar;
    } catch {
      /* keep original */
    }
  }

  return members.map((m) => byId.get(m.id) || m);
}
