import { requireAdmin } from "../../lib/auth-request.js";
import { deleteFolder, getFolder, updateFolder } from "../../lib/folders-store.js";
import { clearFolderFromStrats } from "../../lib/strats-store.js";
import { errorResponse, json } from "../../lib/response.js";
import { sanitizeFolderBody } from "../folders.js";

function folderIdFromContext(context) {
  return String(context.params?.folderId || "").trim();
}

async function requireFolderAdmin(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth;
  return auth;
}

export async function onRequestPatch(context) {
  const auth = await requireFolderAdmin(context);
  if (auth.error) return auth.error;

  const folderId = folderIdFromContext(context);
  if (!folderId) return errorResponse("Missing folder id", 400);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const sanitized = sanitizeFolderBody(body || {}, { partial: true });
  if (sanitized.error) return errorResponse(sanitized.error, 400);

  if (Object.hasOwn(sanitized.folder, "parentId") && sanitized.folder.parentId) {
    if (sanitized.folder.parentId === folderId) {
      return errorResponse("Folder cannot be its own parent", 400);
    }
    const parent = await getFolder(context.env, sanitized.folder.parentId);
    if (!parent) return errorResponse("Parent folder not found", 404);
  }

  try {
    const folder = await updateFolder(context.env, folderId, sanitized.folder);
    if (!folder) return errorResponse("Folder not found", 404);
    return json({ folder });
  } catch (error) {
    console.error("PATCH /api/folders/:folderId failed:", error);
    return errorResponse("Failed to update folder", 500);
  }
}

export async function onRequestDelete(context) {
  const auth = await requireFolderAdmin(context);
  if (auth.error) return auth.error;

  const folderId = folderIdFromContext(context);
  if (!folderId) return errorResponse("Missing folder id", 400);

  try {
    const folder = await deleteFolder(context.env, folderId);
    if (!folder) return errorResponse("Folder not found", 404);

    await clearFolderFromStrats(context.env, folderId);

    return json({ ok: true, folderId });
  } catch (error) {
    console.error("DELETE /api/folders/:folderId failed:", error);
    return errorResponse("Failed to delete folder", 500);
  }
}
