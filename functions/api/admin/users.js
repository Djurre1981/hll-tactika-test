import { requireAdmin } from "../../lib/auth-request.js";
import { guardAccess } from "../../lib/access-guard.js";
import { addManagedUser, listAllMembers } from "../../lib/roles.js";
import { fetchSteamProfile } from "../../lib/steam.js";
import { isValidSteamId64, saveUserProfile } from "../../lib/users-store.js";
import { errorResponse, json } from "../../lib/response.js";

function resolveMemberName(member, session) {
  if (member.name) return member.name;
  if (session?.steamId === member.steamId && session.name) {
    return session.name;
  }
  return null;
}

function enrichMembers(members, session = null, { includeLastSignedIn = false } = {}) {
  return members.map((member) => {
    const enriched = {
      steamId: member.steamId,
      name: resolveMemberName(member, session),
      avatar: member.avatar || null,
      role: member.role,
      removable: member.removable,
      roleEditable: member.roleEditable,
    };
    if (includeLastSignedIn) {
      enriched.lastSignedInAt = member.lastSignedInAt || null;
    }
    return enriched;
  });
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (auth.error) {
    return auth.error;
  }

  try {
    const access = await guardAccess(context, {
      bucket: "admin",
      endpoint: "admin.users.list",
      steamId: auth.session.steamId,
      steamName: auth.session.name,
    });
    if (access.error) {
      return access.error;
    }

    const members = await listAllMembers(context.env, auth.role);
    const users = enrichMembers(members, auth.session, {
      includeLastSignedIn: auth.role === "owner",
    });
    return json({ users });
  } catch (error) {
    console.error("GET /api/admin/users failed:", error);
    return errorResponse("Failed to load users", 500);
  }
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (auth.error) {
    return auth.error;
  }

  const access = await guardAccess(context, {
    bucket: "admin",
    endpoint: "admin.users.create",
    steamId: auth.session.steamId,
    steamName: auth.session.name,
    statusOnSuccess: 201,
  });
  if (access.error) {
    return access.error;
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const steamId = String(body.steamId || "").trim();
  if (!isValidSteamId64(steamId)) {
    return errorResponse("Enter a valid Steam ID64 (17 digits, starts with 7656119)", 400);
  }

  const result = await addManagedUser(context.env, steamId);
  if (result.error) {
    return errorResponse(result.error, 400);
  }

  const profile = await fetchSteamProfile(steamId, context.env);
  await saveUserProfile(steamId, context.env, profile);
  return json(
    {
      user: {
        steamId,
        name: profile.name,
        avatar: profile.avatar || null,
        role: result.member.role,
        removable: result.member.removable,
        roleEditable: result.member.roleEditable,
      },
    },
    { status: 201 }
  );
}
