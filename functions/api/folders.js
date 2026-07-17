import { requireAdmin, requireAuth } from "../lib/auth-request.js";
import { guardAccess } from "../lib/access-guard.js";
import { createFolder, getFolder, listFolders } from "../lib/folders-store.js";
import { errorResponse, json } from "../lib/response.js";

export function sanitizeFolderBody(body, { partial = false } = {}) {
  const folder = {};

  if (!partial || Object.hasOwn(body, "name")) {
    const name = String(body.name || "").trim();
    if (!name) return { error: "Folder name is required" };
    if (name.length > 80) return { error: "Folder name is too long" };
    folder.name = name;
  }

  if (Object.hasOwn(body, "parentId")) {
    const parentId = String(body.parentId || "").trim();
    folder.parentId = parentId || null;
  } else if (!partial) {
    folder.parentId = null;
  }

  if (Object.hasOwn(body, "sortOrder")) {
    const sortOrder = Number(body.sortOrder);
    folder.sortOrder = Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0;
  } else if (!partial) {
    folder.sortOrder = 0;
  }

  return { folder };
}

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  const access = await guardAccess(context, {
    bucket: "folders",
    endpoint: "folders.list",
    steamId: auth.session.steamId,
    steamName: auth.session.name,
  });
  if (access.error) return access.error;

  try {
    const folders = await listFolders(context.env);
    return json({ folders });
  } catch (error) {
    console.error("GET /api/folders failed:", error);
    return errorResponse("Failed to load folders", 500);
  }
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const access = await guardAccess(context, {
    bucket: "folders",
    endpoint: "folders.create",
    steamId: auth.session.steamId,
    steamName: auth.session.name,
    statusOnSuccess: 201,
  });
  if (access.error) return access.error;

  let body;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const sanitized = sanitizeFolderBody(body || {});
  if (sanitized.error) return errorResponse(sanitized.error, 400);

  if (sanitized.folder.parentId) {
    const parent = await getFolder(context.env, sanitized.folder.parentId);
    if (!parent) return errorResponse("Parent folder not found", 404);
  }

  const now = new Date().toISOString();
  try {
    const folder = await createFolder(context.env, {
      ...sanitized.folder,
      id: `folder-${crypto.randomUUID()}`,
      createdBy: auth.session.steamId,
      createdAt: now,
      updatedAt: now,
    });
    return json({ folder }, { status: 201 });
  } catch (error) {
    console.error("POST /api/folders failed:", error);
    return errorResponse("Failed to create folder", 500);
  }
}
