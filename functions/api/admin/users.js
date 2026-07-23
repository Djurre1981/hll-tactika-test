import { requireAdmin } from "../../lib/auth-request.js";
import { addManagedUser, listAllMembers } from "../../lib/roles.js";
import { fetchSteamProfile, fetchSteamProfiles } from "../../lib/steam.js";
import { isValidSteamId64, saveUserProfile } from "../../lib/users-store.js";
import { errorResponse, json } from "../../lib/response.js";

function resolveMemberName(member, session) {
  if (member.name) return member.name;
  if (session?.steamId === member.steamId && session.name) {
    return session.name;
  }
  return null;
}

function enrichMembers(members, session = null, profiles = new Map(), { includeLastSignedIn = false } = {}) {
  return members.map((member) => {
    const profile = profiles.get(String(member.steamId));
    const enriched = {
      steamId: member.steamId,
      name: resolveMemberName(
        { ...member, name: member.name || profile?.name || null },
        session
      ),
      avatar: member.avatar || profile?.avatar || null,
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

async function backfillMissingProfiles(members, env) {
  const missingIds = members
    .filter((member) => !member.name || !member.avatar)
    .map((member) => member.steamId);
  if (missingIds.length === 0) {
    return new Map();
  }

  let profiles = new Map();
  try {
    profiles = await fetchSteamProfiles(missingIds, env);
  } catch (error) {
    console.error("Steam profile backfill failed:", error);
    return profiles;
  }

  await Promise.all(
    [...profiles.entries()]
      .filter(([, profile]) => profile?.name)
      .map(([steamId, profile]) => saveUserProfile(steamId, env, profile))
  );

  return profiles;
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (auth.error) {
    return auth.error;
  }

  try {
    const members = await listAllMembers(context.env, auth.role);
    const profiles = await backfillMissingProfiles(members, context.env);
    const users = enrichMembers(members, auth.session, profiles, {
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
