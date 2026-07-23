import { getDb, requireDb } from "./d1.js";

function parseSteamIds(raw) {
  return (raw || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

let memoryStore = null;

function seedFromEnv(env) {
  const users = [];
  const seen = new Set();

  function addRole(steamIds, role) {
    for (const steamId of steamIds) {
      if (seen.has(steamId)) continue;
      users.push({ steamId, role });
      seen.add(steamId);
    }
  }

  addRole(parseSteamIds(env.VIEWER_STEAM_IDS), "viewer");
  addRole(parseSteamIds(env.USER_STEAM_IDS), "viewer");
  addRole(parseSteamIds(env.EDITOR_STEAM_IDS), "editor");
  addRole(parseSteamIds(env.ASSIST_STEAM_IDS), "assist");

  return { users, revoked: [] };
}

function normalizeStoredRole(role) {
  if (role === "user") {
    return "viewer";
  }
  return role;
}

export async function loadUsersData(env) {
  if (getDb(env)) {
    const db = requireDb(env);
    const [usersResult, revokedResult] = await Promise.all([
      db
        .prepare(
          `SELECT steam_id, role, display_name, avatar_url, preferences_json,
                  created_at, updated_at, last_signed_in_at
             FROM users
            ORDER BY display_name COLLATE NOCASE, steam_id`
        )
        .all(),
      db.prepare("SELECT steam_id FROM revoked_users ORDER BY steam_id").all(),
    ]);

    return migrateEnvUsers(env, {
      users: (usersResult.results || []).map(rowToUser),
      revoked: (revokedResult.results || []).map((row) => row.steam_id),
    });
  }

  if (!memoryStore) {
    memoryStore = seedFromEnv(env);
  }
  return migrateEnvUsers(env, memoryStore);
}

function parseJsonObject(raw) {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function rowToUser(row) {
  return {
    steamId: String(row.steam_id),
    role: normalizeStoredRole(row.role),
    displayName: row.display_name || null,
    avatarUrl: row.avatar_url || null,
    preferences: parseJsonObject(row.preferences_json),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    lastSignedInAt: row.last_signed_in_at || null,
  };
}

async function migrateEnvUsers(env, data) {
  const envOwners = new Set(parseSteamIds(env.OWNER_STEAM_IDS));
  // Match getEnvAdminSteamIds: ALLOWED_STEAM_IDS is the admin fallback.
  const adminIds = parseSteamIds(env.ADMIN_STEAM_IDS);
  const envAdmins = new Set(
    adminIds.length > 0 ? adminIds : parseSteamIds(env.ALLOWED_STEAM_IDS)
  );
  const envAssists = new Set(parseSteamIds(env.ASSIST_STEAM_IDS));
  const envEditors = new Set(parseSteamIds(env.EDITOR_STEAM_IDS));
  const envViewers = new Set([
    ...parseSteamIds(env.VIEWER_STEAM_IDS),
    ...parseSteamIds(env.USER_STEAM_IDS),
  ]);
  let changed = false;

  if (!Array.isArray(data.revoked)) {
    data.revoked = [];
    changed = true;
  }

  for (const user of data.users) {
    const normalized = normalizeStoredRole(user.role);
    if (user.role !== normalized) {
      user.role = normalized;
      changed = true;
    }
  }

  const ownerIds = new Set(envOwners);
  for (const user of data.users) {
    if (user.role === "owner") {
      ownerIds.add(user.steamId);
    }
  }

  if (ownerIds.size > 0) {
    const before = data.revoked.length;
    data.revoked = data.revoked.filter((steamId) => !ownerIds.has(steamId));
    if (data.revoked.length !== before) {
      changed = true;
    }
  }

  function syncEnvRole(steamIds, role, skipIf) {
    for (const steamId of steamIds) {
      if (skipIf.has(steamId)) {
        continue;
      }
      const existing = data.users.find((user) => user.steamId === steamId);
      if (existing) {
        if (existing.role !== role) {
          existing.role = role;
          changed = true;
        }
      } else {
        data.users.push({ steamId, role });
        changed = true;
      }
    }
  }

  syncEnvRole(envOwners, "owner", new Set());
  syncEnvRole(envAdmins, "admin", envOwners);
  syncEnvRole(envAssists, "assist", new Set([...envOwners, ...envAdmins]));
  syncEnvRole(envEditors, "editor", new Set([...envOwners, ...envAdmins, ...envAssists]));
  syncEnvRole(envViewers, "viewer", new Set([...envOwners, ...envAdmins, ...envAssists, ...envEditors]));

  if (changed) {
    await saveUsersData(env, data);
  }

  return data;
}

export async function saveUsersData(env, data) {
  if (getDb(env)) {
    const db = requireDb(env);
    const [existingUsers, existingRevoked] = await Promise.all([
      db.prepare("SELECT steam_id FROM users").all(),
      db.prepare("SELECT steam_id FROM revoked_users").all(),
    ]);
    const desiredUsers = new Set((data.users || []).map((user) => String(user.steamId).trim()));
    const desiredRevoked = new Set((data.revoked || []).map((steamId) => String(steamId).trim()));
    const statements = [];

    for (const row of existingUsers.results || []) {
      if (!desiredUsers.has(String(row.steam_id))) {
        statements.push(db.prepare("DELETE FROM users WHERE steam_id = ?").bind(row.steam_id));
      }
    }

    for (const user of data.users || []) {
      const steamId = String(user.steamId).trim();
      if (!steamId) continue;
      statements.push(
        db
          .prepare(
            `INSERT INTO users (
               steam_id, role, display_name, avatar_url, preferences_json,
               created_at, updated_at, last_signed_in_at
             ) VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'), ?)
             ON CONFLICT(steam_id) DO UPDATE SET
               role = excluded.role,
               display_name = COALESCE(excluded.display_name, users.display_name),
               avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
               preferences_json = excluded.preferences_json,
               updated_at = datetime('now'),
               last_signed_in_at = COALESCE(excluded.last_signed_in_at, users.last_signed_in_at)`
          )
          .bind(
            steamId,
            normalizeStoredRole(user.role),
            user.displayName || null,
            user.avatarUrl || null,
            user.preferences ? JSON.stringify(user.preferences) : null,
            user.createdAt || null,
            user.lastSignedInAt || null
          )
      );
    }

    for (const row of existingRevoked.results || []) {
      if (!desiredRevoked.has(String(row.steam_id))) {
        statements.push(db.prepare("DELETE FROM revoked_users WHERE steam_id = ?").bind(row.steam_id));
      }
    }

    for (const steamId of desiredRevoked) {
      if (!steamId) continue;
      statements.push(
        db
          .prepare("INSERT INTO revoked_users (steam_id) VALUES (?) ON CONFLICT(steam_id) DO NOTHING")
          .bind(steamId)
      );
    }

    if (statements.length > 0) {
      await db.batch(statements);
    }
    return;
  }

  memoryStore = data;
}

export async function saveUserProfile(steamId, env, profile = {}) {
  const id = String(steamId).trim();
  if (!id || (!profile.name && !profile.avatar)) {
    return;
  }

  if (getDb(env)) {
    const db = requireDb(env);
    await db
      .prepare(
        `UPDATE users
            SET display_name = COALESCE(?, display_name),
                avatar_url = COALESCE(?, avatar_url),
                updated_at = datetime('now')
          WHERE steam_id = ?`
      )
      .bind(profile.name || null, profile.avatar || null, id)
      .run();
    return;
  }

  const data = await loadUsersData(env);
  const member = data.users.find((user) => String(user.steamId).trim() === id);
  if (!member) {
    return;
  }
  member.displayName = profile.name || member.displayName || null;
  member.avatarUrl = profile.avatar || member.avatarUrl || null;
  await saveUsersData(env, data);
}

export async function recordUserLastSignedIn(steamId, env, profile = {}, role = "viewer") {
  const id = String(steamId).trim();
  if (!id) {
    return;
  }

  const nextRole = normalizeStoredRole(role) || "viewer";

  if (getDb(env)) {
    const db = requireDb(env);
    // Upsert so env-allowlisted users (not yet in D1) can create sessions.
    await db
      .prepare(
        `INSERT INTO users (
           steam_id, role, display_name, avatar_url, last_signed_in_at, updated_at
         ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(steam_id) DO UPDATE SET
           display_name = COALESCE(excluded.display_name, users.display_name),
           avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
           last_signed_in_at = datetime('now'),
           updated_at = datetime('now')`
      )
      .bind(id, nextRole, profile.name || null, profile.avatar || null)
      .run();
    return;
  }

  const data = await loadUsersData(env);
  let member = data.users.find((user) => String(user.steamId).trim() === id);
  if (!member) {
    member = { steamId: id, role: nextRole };
    data.users.push(member);
  }

  member.lastSignedInAt = new Date().toISOString();
  member.displayName = profile.name || member.displayName || null;
  member.avatarUrl = profile.avatar || member.avatarUrl || null;
  await saveUsersData(env, data);
}

export function isValidSteamId64(steamId) {
  return /^7656119\d{10}$/.test(String(steamId).trim());
}
