import { requireAdmin } from "../../lib/auth-request.js";
import { importSheetsIntoRosters } from "../../lib/rosters-store.js";
import { errorResponse, json } from "../../lib/response.js";

/**
 * POST /api/rosters/import-sheets
 * Pull ECL + Comp Google Sheets into matching rosters (Steam64 only, no site access).
 */
export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  let body = {};
  try {
    body = await context.request.json();
  } catch {
    body = {};
  }

  const offset = Number(body?.offset) || 0;
  const limit = Number(body?.limit) || 40;

  try {
    const result = await importSheetsIntoRosters(context.env, {
      createdBy: auth.session.steamId,
      offset,
      limit,
    });
    if (result.error) return errorResponse(result.error, result.status || 400);
    return json({
      ...result,
      note: "Sheets import is roster-only — site access unchanged. Re-run while remaining > 0.",
    });
  } catch (error) {
    console.error("POST /api/rosters/import-sheets failed:", error);
    return errorResponse(error?.message || "Failed to import from sheets", 500);
  }
}
