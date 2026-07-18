import { requireAdmin } from "../../../lib/auth-request.js";
import { ensureMemberAndAddToRoster, getRoster } from "../../../lib/rosters-store.js";
import { isValidSteamId64 } from "../../../lib/users-store.js";
import { errorResponse, json } from "../../../lib/response.js";

function rosterIdFromContext(context) {
  return String(context.params?.rosterId || "").trim();
}

/** Parse CSV with headers name,steamid (case-insensitive). Also accepts display_name. */
export function parseRosterCsv(text) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return { error: "CSV is empty" };

  const splitRow = (line) => {
    const cells = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const header = splitRow(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ""));
  const nameIdx = header.findIndex((h) => h === "name" || h === "displayname" || h === "display_name");
  const steamIdx = header.findIndex((h) => h === "steamid" || h === "steam_id" || h === "steamid64");

  if (nameIdx < 0 || steamIdx < 0) {
    return { error: "CSV must include name and steamid columns" };
  }

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitRow(lines[i]);
    const displayName = String(cells[nameIdx] || "").trim();
    const steamId = String(cells[steamIdx] || "").trim();
    if (!displayName && !steamId) continue;
    rows.push({ displayName, steamId, line: i + 1 });
  }

  return { rows };
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const rosterId = rosterIdFromContext(context);
  if (!rosterId) return errorResponse("Missing roster id", 400);

  const roster = await getRoster(context.env, rosterId);
  if (!roster) return errorResponse("Roster not found", 404);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = parseRosterCsv(body?.csv || "");
  if (parsed.error) return errorResponse(parsed.error, 400);
  if (parsed.rows.length === 0) return errorResponse("No rows to import", 400);

  const now = new Date().toISOString();
  const imported = [];
  const skipped = [];
  const errors = [];

  for (const row of parsed.rows) {
    if (!row.displayName) {
      errors.push({ line: row.line, error: "Display name is required" });
      continue;
    }
    if (!row.steamId || !isValidSteamId64(row.steamId)) {
      errors.push({ line: row.line, error: "Valid Steam ID is required" });
      continue;
    }

    try {
      const result = await ensureMemberAndAddToRoster(context.env, rosterId, {
        id: `roster-${crypto.randomUUID()}`,
        displayName: row.displayName.slice(0, 80),
        steamId: row.steamId,
        avatarUrl: null,
        rosterRole: null,
        status: "active",
        notes: "",
        sortOrder: 0,
        createdBy: auth.session.steamId,
        createdAt: now,
        updatedAt: now,
      });

      if (result.error) {
        errors.push({ line: row.line, error: result.error });
        continue;
      }
      if (result.alreadyMember) {
        skipped.push({ line: row.line, memberId: result.member.id });
      } else {
        imported.push({ line: row.line, memberId: result.member.id });
      }
    } catch (error) {
      errors.push({ line: row.line, error: error?.message || "Import failed" });
    }
  }

  return json({
    rosterId,
    imported: imported.length,
    skipped: skipped.length,
    errors,
    details: { imported, skipped },
  });
}
