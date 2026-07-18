import { requireDb } from "./d1.js";

function rowToFolder(row) {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id || null,
    sortOrder: Number(row.sort_order) || 0,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listFolders(env) {
  const db = requireDb(env);
  const result = await db
    .prepare(
      `SELECT id, name, parent_id, sort_order, created_by, created_at, updated_at
       FROM strat_folders
       ORDER BY sort_order ASC, name COLLATE NOCASE ASC`
    )
    .all();

  return (result.results || []).map(rowToFolder);
}

export async function getFolder(env, folderId) {
  const db = requireDb(env);
  const row = await db
    .prepare(
      `SELECT id, name, parent_id, sort_order, created_by, created_at, updated_at
       FROM strat_folders
       WHERE id = ?`
    )
    .bind(folderId)
    .first();

  return row ? rowToFolder(row) : null;
}

export async function createFolder(env, folder) {
  const db = requireDb(env);
  await db
    .prepare(
      `INSERT INTO strat_folders
       (id, name, parent_id, sort_order, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      folder.id,
      folder.name,
      folder.parentId || null,
      folder.sortOrder ?? 0,
      folder.createdBy,
      folder.createdAt,
      folder.updatedAt
    )
    .run();

  return getFolder(env, folder.id);
}

export async function updateFolder(env, folderId, updates) {
  const existing = await getFolder(env, folderId);
  if (!existing) return null;

  const next = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  if (next.parentId === folderId) {
    throw new Error("Folder cannot be its own parent");
  }

  const db = requireDb(env);
  await db
    .prepare(
      `UPDATE strat_folders
       SET name = ?, parent_id = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(next.name, next.parentId || null, next.sortOrder ?? 0, next.updatedAt, folderId)
    .run();

  return getFolder(env, folderId);
}

export async function deleteFolder(env, folderId) {
  const existing = await getFolder(env, folderId);
  if (!existing) return null;

  const db = requireDb(env);
  await db
    .prepare("UPDATE strat_folders SET parent_id = NULL WHERE parent_id = ?")
    .bind(folderId)
    .run();
  await db.prepare("DELETE FROM strat_folders WHERE id = ?").bind(folderId).run();
  return existing;
}
