import { requireAdmin } from "../lib/auth-request.js";
import { createRoster, listRosters } from "../lib/rosters-store.js";
import { errorResponse, json } from "../lib/response.js";

export function sanitizeRosterMetaBody(body, { partial = false } = {}) {
  const roster = {};

  if (!partial || Object.hasOwn(body, "name")) {
    const name = String(body.name || "").trim();
    if (!name) return { error: "Roster name is required" };
    if (name.length > 80) return { error: "Roster name is too long" };
    roster.name = name;
  }

  if (Object.hasOwn(body, "tournament") || (!partial && body.tournament !== undefined)) {
    const tournament = String(body.tournament || "").trim();
    roster.tournament = tournament.slice(0, 120) || null;
  } else if (!partial) {
    roster.tournament = null;
  }

  if (Object.hasOwn(body, "notes")) {
    roster.notes = String(body.notes || "").trim().slice(0, 500);
  } else if (!partial) {
    roster.notes = "";
  }

  if (Object.hasOwn(body, "sortOrder")) {
    const sortOrder = Number(body.sortOrder);
    roster.sortOrder = Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0;
  } else if (!partial) {
    roster.sortOrder = 0;
  }

  return { roster };
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  try {
    const rosters = await listRosters(context.env);
    return json({ rosters });
  } catch (error) {
    console.error("GET /api/rosters failed:", error);
    return errorResponse("Failed to load rosters", 500);
  }
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  let body;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const sanitized = sanitizeRosterMetaBody(body || {});
  if (sanitized.error) return errorResponse(sanitized.error, 400);

  const now = new Date().toISOString();
  try {
    const roster = await createRoster(context.env, {
      ...sanitized.roster,
      id: `rosters-${crypto.randomUUID()}`,
      createdBy: auth.session.steamId,
      createdAt: now,
      updatedAt: now,
    });
    return json({ roster }, { status: 201 });
  } catch (error) {
    console.error("POST /api/rosters failed:", error);
    return errorResponse("Failed to create roster", 500);
  }
}
