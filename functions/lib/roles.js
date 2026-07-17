import { loadUsersData, saveUsersData } from "./users-store.js";

export const ASSIGNABLE_ROLES = ["viewer", "editor", "assist", "admin"];

function normalizeSteamId(steamId) {
  return String(steamId).trim();
}

function parseSteamIds(raw) {
  return (raw || "")
    .split(",")
    .map((id) => normalizeSteamId(id))
    .filter((id) => /^\d+$/.test(id));
}

export function getEnvOwnerSteamIds(env) {
  return parseSteamIds(env.OWNER_STEAM_IDS);
}

export function getEnvAdminSteamIds(env) {
  const admins = parseSteamIds(env.ADMIN_STEAM_IDS);
  if (admins.length > 0) {
    return admins;
  }
  return parseSteamIds(env.ALLOWED_STEAM_IDS);
}

/** @deprecated Use getEnvAdminSteamIds */
export const getAdminSteamIds = getEnvAdminSteamIds;

export function getEnvAssistSteamIds(env) {
  return parseSteamIds(env.ASSIST_STEAM_IDS);
}

export function getEnvEditorSteamIds(env) {
  return parseSteamIds(env.EDITOR_STEAM_IDS);
}

export function getEnvViewerSteamIds(env) {
  const viewers = parseSteamIds(env.VIEWER_STEAM_IDS);
  if (viewers.length > 0) {
    return viewers;
  }
  return parseSteamIds(env.USER_STEAM_IDS);
}

/** @deprecated Use getEnvViewerSteamIds */
export function getEnvUserSteamIds(env) {
  return getEnvViewerSteamIds(env);
}

/** @deprecated Use getEnvViewerSteamIds */
export const getUserSteamIds = getEnvViewerSteamIds;

function normalizeStoredRole(role) {
  if (role === "user") {
    return "viewer";
  }
  return role;
}

function isEnvOwner(steamId, env) {
  return getEnvOwnerSteamIds(env).includes(String(steamId));
}

function isEnvAdmin(steamId, env) {
  return getEnvAdminSteamIds(env).includes(String(steamId));
}

function isEnvAssist(steamId, env) {
  return getEnvAssistSteamIds(env).includes(String(steamId));
}

function isEnvEditor(steamId, env) {
  return getEnvEditorSteamIds(env).includes(String(steamId));
}

function isEnvViewer(steamId, env) {
  return getEnvViewerSteamIds(env).includes(String(steamId));
}

function isRevokedId(revoked, steamId) {
  const id = normalizeSteamId(steamId);
  return (revoked || []).some((entry) => normalizeSteamId(entry) === id);
}

function memberListEntry(steamId, role, actorIsOwner, stored = null) {
  const base = {
    steamId,
    role,
    name: stored?.displayName || null,
    avatar: stored?.avatarUrl || null,
    lastSignedInAt: stored?.lastSignedInAt || null,
  };
  if (role === "owner") {
    return { ...base, removable: false, roleEditable: false };
  }
  if (role === "admin") {
    return {
      ...base,
      removable: actorIsOwner,
      roleEditable: actorIsOwner,
    };
  }
  return {
    ...base,
    removable: true,
    roleEditable: actorIsOwner,
  };
}

function syncRevokedForRole(data, targetId, env, newRole) {
  if (isEnvAdmin(targetId, env) && !isEnvOwner(targetId, env) && newRole !== "admin") {
    if (!isRevokedId(data.revoked, targetId)) {
      data.revoked.push(targetId);
    }
  }
  if (isEnvAssist(targetId, env) && newRole !== "assist") {
    if (!isRevokedId(data.revoked, targetId)) {
      data.revoked.push(targetId);
    }
  }
  if (isEnvEditor(targetId, env) && newRole !== "editor") {
    if (!isRevokedId(data.revoked, targetId)) {
      data.revoked.push(targetId);
    }
  }
  if (isEnvViewer(targetId, env) && newRole !== "viewer") {
    if (!isRevokedId(data.revoked, targetId)) {
      data.revoked.push(targetId);
    }
  }
}

function revokeEnvGrants(data, targetId, env) {
  if (!data.revoked) {
    data.revoked = [];
  }

  if (
    (isEnvAdmin(targetId, env) && !isEnvOwner(targetId, env)) ||
    isEnvAssist(targetId, env) ||
    isEnvEditor(targetId, env) ||
    isEnvViewer(targetId, env)
  ) {
    if (!isRevokedId(data.revoked, targetId)) {
      data.revoked.push(targetId);
    }
  }
}

export async function getUserRole(steamId, env) {
  const id = normalizeSteamId(steamId);

  if (isEnvOwner(id, env)) {
    return "owner";
  }

  const data = await loadUsersData(env);
  const member = data.users.find((user) => normalizeSteamId(user.steamId) === id);

  if (member?.role === "owner") {
    return "owner";
  }

  if (member) {
    return normalizeStoredRole(member.role);
  }

  if (isRevokedId(data.revoked, id)) {
    return null;
  }

  if (isEnvAdmin(id, env)) {
    return "admin";
  }

  if (isEnvAssist(id, env)) {
    return "assist";
  }

  if (isEnvEditor(id, env)) {
    return "editor";
  }

  if (isEnvViewer(id, env)) {
    return "viewer";
  }

  return null;
}

export async function isAllowedSteamId(steamId, env) {
  return (await getUserRole(steamId, env)) !== null;
}

export async function isAdmin(steamId, env) {
  const role = await getUserRole(steamId, env);
  return role === "admin" || role === "owner";
}

export async function isOwner(steamId, env) {
  return (await getUserRole(steamId, env)) === "owner";
}

export function isStaffRole(role) {
  return role === "admin" || role === "owner";
}

export async function listAllMembers(env, actorRole) {
  const data = await loadUsersData(env);
  const revoked = new Set((data.revoked || []).map(normalizeSteamId));
  const storedById = new Map(data.users.map((user) => [normalizeSteamId(user.steamId), user]));
  const members = [];
  const seen = new Set();
  const actorIsOwner = actorRole === "owner";

  for (const steamId of getEnvOwnerSteamIds(env)) {
    const id = normalizeSteamId(steamId);
    members.push(memberListEntry(id, "owner", actorIsOwner, storedById.get(id)));
    seen.add(id);
  }

  for (const steamId of getEnvAdminSteamIds(env)) {
    const id = normalizeSteamId(steamId);
    if (seen.has(id) || revoked.has(id)) {
      continue;
    }
    members.push(memberListEntry(id, "admin", actorIsOwner, storedById.get(id)));
    seen.add(id);
  }

  for (const steamId of getEnvAssistSteamIds(env)) {
    const id = normalizeSteamId(steamId);
    if (seen.has(id) || revoked.has(id)) {
      continue;
    }
    members.push(memberListEntry(id, "assist", actorIsOwner, storedById.get(id)));
    seen.add(id);
  }

  for (const steamId of getEnvEditorSteamIds(env)) {
    const id = normalizeSteamId(steamId);
    if (seen.has(id) || revoked.has(id)) {
      continue;
    }
    members.push(memberListEntry(id, "editor", actorIsOwner, storedById.get(id)));
    seen.add(id);
  }

  for (const steamId of getEnvViewerSteamIds(env)) {
    const id = normalizeSteamId(steamId);
    if (seen.has(id) || revoked.has(id)) {
      continue;
    }
    members.push(memberListEntry(id, "viewer", actorIsOwner, storedById.get(id)));
    seen.add(id);
  }

  for (const user of data.users) {
    const id = normalizeSteamId(user.steamId);
    if (seen.has(id)) {
      continue;
    }

    const role = normalizeStoredRole(user.role);
    members.push(memberListEntry(id, role, actorIsOwner, user));
    seen.add(id);
  }

  return members;
}

function hasManagedAccess(data, id, env) {
  if (isEnvOwner(id, env) || isEnvAdmin(id, env)) {
    return true;
  }
  if (isEnvAssist(id, env) || isEnvEditor(id, env) || isEnvViewer(id, env)) {
    return true;
  }
  return data.users.some((user) => normalizeSteamId(user.steamId) === normalizeSteamId(id));
}

export async function addManagedUser(env, steamId) {
  const id = normalizeSteamId(steamId);

  if (isEnvOwner(id, env)) {
    return { error: "This Steam ID is already an owner" };
  }

  const data = await loadUsersData(env);
  const revoked = isRevokedId(data.revoked, id);

  if (isEnvAdmin(id, env)) {
    if (revoked) {
      data.revoked = (data.revoked || []).filter((entry) => normalizeSteamId(entry) !== id);
      await saveUsersData(env, data);
      return {
        member: { steamId: id, role: "admin", removable: true, roleEditable: true },
      };
    }
    return { error: "This Steam ID is already a Comp Admin" };
  }

  if (hasManagedAccess(data, id, env) && !revoked) {
    return { error: "User already has access" };
  }

  if (revoked) {
    data.revoked = (data.revoked || []).filter((entry) => normalizeSteamId(entry) !== id);
  }

  const existing = data.users.find((user) => normalizeSteamId(user.steamId) === id);
  if (existing) {
    existing.role = "viewer";
  } else {
    data.users.push({ steamId: id, role: "viewer" });
  }

  await saveUsersData(env, data);
  return {
    member: { steamId: id, role: "viewer", removable: true, roleEditable: false },
  };
}

export async function removeManagedUser(env, steamId, actorSteamId, actorRole) {
  const id = String(steamId).trim();
  const actorId = String(actorSteamId).trim();

  if (id === actorId) {
    return { error: "Cannot remove yourself" };
  }

  if (isEnvOwner(id, env)) {
    return { error: "Cannot remove an owner" };
  }

  const data = await loadUsersData(env);
  const kvMember = data.users.find((user) => user.steamId === id);
  if (kvMember?.role === "owner") {
    return { error: "Cannot remove an owner" };
  }

  if (actorRole !== "owner") {
    if (isEnvAdmin(id, env)) {
      return { error: "Cannot remove a Comp Admin" };
    }
    if (kvMember?.role === "admin") {
      return { error: "Cannot remove a Comp Admin" };
    }
  }

  let changed = false;

  revokeEnvGrants(data, id, env);
  if (isEnvAdmin(id, env) || isEnvAssist(id, env) || isEnvEditor(id, env) || isEnvViewer(id, env)) {
    changed = true;
  }

  const index = data.users.findIndex((user) => user.steamId === id);
  if (index >= 0) {
    data.users.splice(index, 1);
    changed = true;
  }

  if (!changed) {
    return { error: "User not found" };
  }

  await saveUsersData(env, data);
  return { ok: true };
}

export async function updateManagedUserRole(env, actorSteamId, targetSteamId, newRole) {
  const targetId = String(targetSteamId).trim();
  const actorId = String(actorSteamId).trim();

  if (!ASSIGNABLE_ROLES.includes(newRole)) {
    return { error: "Role must be Comp Member, Comp Advisor, Comp Assist, or Comp Admin" };
  }

  if (targetId === actorId) {
    return { error: "Cannot change your own role" };
  }

  if (isEnvOwner(targetId, env)) {
    return { error: "Cannot change an owner's role" };
  }

  const data = await loadUsersData(env);
  const kvMember = data.users.find((user) => user.steamId === targetId);
  if (kvMember?.role === "owner") {
    return { error: "Cannot change an owner's role" };
  }

  const envAdmin = isEnvAdmin(targetId, env);
  const inKv = Boolean(kvMember);
  const activeEnvAdmin = envAdmin && !isRevokedId(data.revoked, targetId);
  const hasAccess =
    inKv ||
    activeEnvAdmin ||
    (isEnvAssist(targetId, env) && !isRevokedId(data.revoked, targetId)) ||
    (isEnvEditor(targetId, env) && !isRevokedId(data.revoked, targetId)) ||
    (isEnvViewer(targetId, env) && !isRevokedId(data.revoked, targetId));

  if (!hasAccess) {
    return { error: "User not found" };
  }

  if (!data.revoked) {
    data.revoked = [];
  }

  if (newRole === "admin") {
    data.revoked = data.revoked.filter((entry) => entry !== targetId);
    if (inKv) {
      kvMember.role = "admin";
    } else {
      data.users.push({ steamId: targetId, role: "admin" });
    }
  } else {
    syncRevokedForRole(data, targetId, env, newRole);
    if (inKv) {
      kvMember.role = newRole;
    } else {
      data.users.push({ steamId: targetId, role: newRole });
    }
  }

  await saveUsersData(env, data);
  return {
    member: {
      steamId: targetId,
      role: newRole,
      removable: newRole === "admin" ? true : true,
      roleEditable: true,
    },
  };
}
