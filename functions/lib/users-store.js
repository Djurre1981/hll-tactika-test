function parseSteamIds(raw) {
  return (raw || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

const KV_KEY = "users";

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
  if (env.PINS_KV) {
    const stored = await env.PINS_KV.get(KV_KEY, "json");
    if (stored?.users) {
      return migrateEnvUsers(env, stored);
    }

    const initial = seedFromEnv(env);
    return migrateEnvUsers(env, initial);
  }

  if (!memoryStore) {
    memoryStore = seedFromEnv(env);
  }
  return migrateEnvUsers(env, memoryStore);
}

async function migrateEnvUsers(env, data) {
  const envOwners = new Set(parseSteamIds(env.OWNER_STEAM_IDS));
  const envAdmins = new Set(parseSteamIds(env.ADMIN_STEAM_IDS));
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
  if (env.PINS_KV) {
    await env.PINS_KV.put(KV_KEY, JSON.stringify(data));
    return;
  }

  memoryStore = data;
}

export function isValidSteamId64(steamId) {
  return /^7656119\d{10}$/.test(String(steamId).trim());
}
