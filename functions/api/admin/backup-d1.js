import { requireOwner } from "../../lib/auth-request.js";
import { buildD1SqlDump } from "../../lib/d1-backup.js";
import { requireDb } from "../../lib/d1.js";
import { errorResponse } from "../../lib/response.js";

export async function onRequestGet(context) {
  const auth = await requireOwner(context);
  if (auth.error) {
    return auth.error;
  }

  let db;
  try {
    db = requireDb(context.env);
  } catch {
    return errorResponse("D1 database is not configured", 503);
  }

  try {
    const exportedAt = new Date().toISOString();
    const { sql, tableCount, statementCount } = await buildD1SqlDump(db, {
      exportedAt,
      exportedBy: auth.session.steamId,
    });
    const date = exportedAt.slice(0, 10);
    const headers = new Headers({
      "Content-Type": "application/sql; charset=utf-8",
      "Content-Disposition": `attachment; filename="tactika-d1-backup-${date}.sql"`,
      "X-Backup-Table-Count": String(tableCount),
      "X-Backup-Statement-Count": String(statementCount),
    });
    return new Response(sql, { headers });
  } catch (error) {
    console.error("GET /api/admin/backup-d1 failed:", error);
    return errorResponse("Failed to export D1 backup", 500);
  }
}
