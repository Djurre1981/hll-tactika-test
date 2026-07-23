import { requireDb } from "./d1.js";
import {
  createRosterMember,
  getRosterMember,
  listRosterMembers,
  resolveSteamAvatarUrl,
  updateRosterMember,
} from "./roster-store.js";
import { fetchSteamProfiles } from "./steam.js";

function rowToRoster(row) {
  return {
    id: row.id,
    name: row.name,
    tournament: row.tournament || null,
    color: row.color || null,
    notes: row.notes || "",
    sortOrder: Number(row.sort_order) || 0,
    isTemplate: Boolean(row.is_template),
    memberCount: Number(row.member_count) || 0,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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

function rowToMember(row) {
  // Prefer member-level roles (supports multi-role JSON) over membership single role
  const roles = parseRoles(row.roster_role || row.membership_role);
  return {
    id: row.id,
    displayName: row.display_name,
    steamId: row.steam_id || null,
    t17Id: row.t17_id || null,
    avatarUrl: row.avatar_url || null,
    rosterRole: roles[0] || null,
    rosterRoles: roles,
    tournaments: parseTournaments(row.tournaments),
    situation: row.situation || "member",
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
      `SELECT r.id, r.name, r.tournament, r.color, r.notes, r.sort_order, r.is_template,
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
      `SELECT r.id, r.name, r.tournament, r.color, r.notes, r.sort_order, r.is_template,
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
       (id, name, tournament, color, notes, sort_order, is_template, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      roster.id,
      roster.name,
      roster.tournament || null,
      roster.color || null,
      roster.notes || null,
      roster.sortOrder ?? 0,
      roster.isTemplate ? 1 : 0,
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
       SET name = ?, tournament = ?, color = ?, notes = ?, sort_order = ?, is_template = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(
      next.name,
      next.tournament || null,
      next.color || null,
      next.notes || null,
      next.sortOrder ?? 0,
      next.isTemplate ? 1 : 0,
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
      `SELECT rm.id, rm.display_name, rm.steam_id, rm.t17_id, rm.avatar_url, rm.roster_role,
              rm.tournaments, rm.situation, rm.status, rm.notes, rm.sort_order, rm.created_by,
              rm.created_at, rm.updated_at,
              m.roster_role AS membership_role, m.sort_order AS membership_sort
       FROM roster_memberships m
       JOIN roster_members rm ON rm.id = m.member_id
       WHERE m.roster_id = ?
       ORDER BY m.sort_order ASC, rm.display_name COLLATE NOCASE ASC`
    )
    .bind(rosterId)
    .all();

  // Do not Steam-backfill on list — large rosters time out the Worker and the
  // UI falls back to a stale 1-row cache. Avatars resolve on PlayerCard / add.
  return (result.results || []).map(rowToMember);
}

export async function findMemberBySteamId(env, steamId) {
  if (!steamId) return null;
  const db = requireDb(env);
  const row = await db
    .prepare(
      `SELECT id, display_name, steam_id, t17_id, avatar_url, roster_role, tournaments, situation,
              status, notes, sort_order, created_by, created_at, updated_at
       FROM roster_members
       WHERE steam_id = ?
       LIMIT 1`
    )
    .bind(steamId)
    .first();

  if (!row) return null;
  const roles = parseRoles(row.roster_role);
  return {
    id: row.id,
    displayName: row.display_name,
    steamId: row.steam_id || null,
    t17Id: row.t17_id || null,
    avatarUrl: row.avatar_url || null,
    rosterRole: roles[0] || null,
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

  return { member };
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

/** Duplicate a roster and copy memberships. Optionally mark the copy as a template. */
export async function duplicateRoster(env, sourceRosterId, { name, isTemplate = false, createdBy }) {
  const source = await getRoster(env, sourceRosterId);
  if (!source) return { error: "Roster not found", status: 404 };

  const members = await listRosterMembersInRoster(env, sourceRosterId);
  const now = new Date().toISOString();
  const copy = await createRoster(env, {
    id: `rosters-${crypto.randomUUID()}`,
    name: name || `${source.name} (copy)`,
    tournament: source.tournament,
    color: source.color,
    notes: source.notes,
    sortOrder: source.sortOrder + 1,
    isTemplate: Boolean(isTemplate),
    createdBy: createdBy || "system",
    createdAt: now,
    updatedAt: now,
  });

  const db = requireDb(env);
  if (members.length) {
    const stmts = members.map((member, index) =>
      db
        .prepare(
          `INSERT INTO roster_memberships (roster_id, member_id, roster_role, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(
          copy.id,
          member.id,
          member.rosterRole || null,
          member.sortOrder ?? index,
          now
        )
    );
    await db.batch(stmts);
  }

  return { roster: await getRoster(env, copy.id) };
}

export async function ensureMemberAndAddToRoster(env, rosterId, memberData) {
  let member = null;
  if (memberData.steamId) {
    member = await findMemberBySteamId(env, memberData.steamId);
  }

  if (!member) {
    const avatarUrl =
      memberData.avatarUrl ||
      (await resolveSteamAvatarUrl(env, memberData.steamId, null));
    member = await createRosterMember(env, { ...memberData, avatarUrl });
  } else if (member.steamId && !member.avatarUrl) {
    const avatarUrl = await resolveSteamAvatarUrl(env, member.steamId, null);
    if (avatarUrl) {
      member = (await updateRosterMember(env, member.id, { avatarUrl })) || member;
    }
  }

  return addMemberToRoster(env, rosterId, member.id, {
    rosterRole: memberData.rosterRole || null,
  });
}

/**
 * Seed a roster from Circle-side HeLO participant Steam IDs on calendar events.
 * Does NOT grant site access — only creates/links roster_members.
 *
 * Designed for Workers time limits: processes up to `limit` new Steam IDs per call
 * (default 40). Call again while `remaining > 0`. Steam profile fetch is optional
 * and batched lightly so a timeout still returns partial progress.
 */
export async function seedRosterFromMatchParticipants(
  env,
  rosterId,
  createdBy,
  { limit = 40, enrichProfiles = true } = {}
) {
  const roster = await getRoster(env, rosterId);
  if (!roster) return { error: "Roster not found", status: 404 };

  const db = requireDb(env);
  const result = await db
    .prepare(
      `SELECT id, match_json FROM events
       WHERE match_json IS NOT NULL AND match_json LIKE '%participantSteamIds%'`
    )
    .all();

  const steamIds = new Set();
  for (const row of result.results || []) {
    try {
      const match = JSON.parse(row.match_json || "{}");
      const list = Array.isArray(match.participantSteamIds) ? match.participantSteamIds : [];
      for (const raw of list) {
        const id = String(raw || "").trim();
        if (/^\d{17}$/.test(id)) steamIds.add(id);
      }
    } catch {
      /* ignore corrupt rows */
    }
  }

  const allIds = [...steamIds];
  if (!allIds.length) {
    return {
      added: 0,
      linked: 0,
      skipped: 0,
      failed: 0,
      totalSteamIds: 0,
      remaining: 0,
      done: true,
    };
  }

  // Who still needs to be created or linked onto this roster?
  const existingOnRoster = await db
    .prepare(
      `SELECT rm.steam_id
       FROM roster_memberships m
       JOIN roster_members rm ON rm.id = m.member_id
       WHERE m.roster_id = ? AND rm.steam_id IS NOT NULL`
    )
    .bind(rosterId)
    .all();
  const alreadyOnRoster = new Set(
    (existingOnRoster.results || []).map((row) => String(row.steam_id || "").trim()).filter(Boolean)
  );

  const pendingIds = allIds.filter((id) => !alreadyOnRoster.has(id));
  const batch = pendingIds.slice(0, Math.max(1, Math.min(80, Number(limit) || 40)));
  const remainingAfter = Math.max(0, pendingIds.length - batch.length);

  let profiles = new Map();
  if (enrichProfiles && batch.length) {
    try {
      profiles = await fetchSteamProfiles(batch, env);
    } catch {
      profiles = new Map();
    }
  }

  let added = 0;
  let linked = 0;
  let skipped = allIds.length - pendingIds.length;
  let failed = 0;
  const now = new Date().toISOString();
  const errors = [];

  // Fast path: insert members + memberships without per-row avatar resolve or
  // listRosterMembersInRoster (those blow Workers CPU/time on large seeds).
  for (const steamId of batch) {
    try {
      const existing = await findMemberBySteamId(env, steamId);
      let memberId = existing?.id || null;

      if (!memberId) {
        const profile = profiles.get(steamId) || {};
        const displayName =
          String(profile.name || "").trim().slice(0, 80) || `Player ${steamId.slice(-4)}`;
        const member = await createRosterMember(env, {
          id: `roster-${crypto.randomUUID()}`,
          displayName,
          steamId,
          avatarUrl: profile.avatar || null,
          rosterRoles: ["infantry"],
          situation: "member",
          status: "active",
          tournaments: [],
          notes: "Seeded from HeLO match participants",
          sortOrder: 0,
          createdBy: createdBy || "helo-seed",
          createdAt: now,
          updatedAt: now,
        });
        memberId = member.id;
        added += 1;
      }

      const already = await db
        .prepare(
          `SELECT roster_id FROM roster_memberships WHERE roster_id = ? AND member_id = ?`
        )
        .bind(rosterId, memberId)
        .first();
      if (already) {
        if (existing) skipped += 1;
        continue;
      }

      await db
        .prepare(
          `INSERT INTO roster_memberships (roster_id, member_id, roster_role, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(rosterId, memberId, "infantry", 0, now)
        .run();

      if (existing) linked += 1;
    } catch (err) {
      failed += 1;
      errors.push({ steamId, error: err?.message || "seed failed" });
    }
  }

  return {
    added,
    linked,
    skipped,
    failed,
    totalSteamIds: allIds.length,
    processed: batch.length,
    remaining: remainingAfter,
    done: remainingAfter === 0,
    errors: errors.slice(0, 10),
  };
}

/**
 * Fill Steam persona names/avatars for seeded placeholders ("Player 1234").
 * Processes up to `limit` members per call — re-run while remaining > 0.
 */
export async function enrichRosterMemberProfiles(env, rosterId, { limit = 20 } = {}) {
  const roster = await getRoster(env, rosterId);
  if (!roster) return { error: "Roster not found", status: 404 };

  const db = requireDb(env);
  const result = await db
    .prepare(
      `SELECT rm.id, rm.display_name, rm.steam_id, rm.avatar_url
       FROM roster_memberships m
       JOIN roster_members rm ON rm.id = m.member_id
       WHERE m.roster_id = ?
         AND rm.steam_id IS NOT NULL
         AND (
           rm.display_name LIKE 'Player %'
           OR rm.avatar_url IS NULL
           OR TRIM(rm.avatar_url) = ''
         )
       ORDER BY rm.display_name COLLATE NOCASE ASC`
    )
    .bind(rosterId)
    .all();

  const pending = result.results || [];
  const batch = pending.slice(0, Math.max(1, Math.min(40, Number(limit) || 20)));
  const remainingAfter = Math.max(0, pending.length - batch.length);

  if (!batch.length) {
    return { updated: 0, remaining: 0, done: true, pending: 0 };
  }

  let profiles = new Map();
  try {
    profiles = await fetchSteamProfiles(
      batch.map((row) => row.steam_id),
      env
    );
  } catch {
    profiles = new Map();
  }

  let updated = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (const row of batch) {
    try {
      const profile = profiles.get(String(row.steam_id)) || {};
      const nextName = String(profile.name || "").trim().slice(0, 80);
      const nextAvatar = profile.avatar || null;
      const isPlaceholder = /^Player \d{1,6}$/i.test(String(row.display_name || "").trim());
      const displayName = nextName && isPlaceholder ? nextName : row.display_name;
      const avatarUrl = nextAvatar || row.avatar_url || null;

      if (displayName === row.display_name && avatarUrl === (row.avatar_url || null)) {
        continue;
      }

      await db
        .prepare(
          `UPDATE roster_members SET display_name = ?, avatar_url = ?, updated_at = ? WHERE id = ?`
        )
        .bind(displayName, avatarUrl, now, row.id)
        .run();
      updated += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    updated,
    failed,
    processed: batch.length,
    pending: pending.length,
    remaining: remainingAfter,
    done: remainingAfter === 0,
  };
}

export { listRosterMembers };
