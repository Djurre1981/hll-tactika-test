import { requireOwner } from "../../lib/auth-request.js";
import { buildKvTextBackup } from "../../lib/kv-backup.js";
import { errorResponse, json } from "../../lib/response.js";

export async function onRequestGet(context) {
  const auth = await requireOwner(context);
  if (auth.error) {
    return auth.error;
  }

  const kv = context.env?.PINS_KV;
  if (!kv) {
    return errorResponse("KV namespace is not configured", 503);
  }

  try {
    const backup = await buildKvTextBackup(kv, {
      exportedAt: new Date().toISOString(),
      exportedBy: auth.session.steamId,
    });
    return json(backup);
  } catch (error) {
    console.error("GET /api/admin/backup-kv failed:", error);
    return errorResponse("Failed to export KV backup", 500);
  }
}
