import { requireAuth } from "../../lib/auth-request.js";
import { listAllMembers } from "../../lib/roles.js";
import { errorResponse, json } from "../../lib/response.js";

/**
 * Lightweight member list for dashboard presence bubbles.
 * Available to any authenticated circle member (not admin-only).
 */
export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  try {
    const members = await listAllMembers(context.env, auth.role);
    const users = members.map((member) => ({
      steamId: member.steamId,
      name: member.name || null,
      avatar: member.avatar || null,
      lastSignedInAt: member.lastSignedInAt || null,
    }));
    return json({ users });
  } catch (error) {
    console.error("GET /api/presence/members failed:", error);
    return errorResponse("Failed to load members", 500);
  }
}
