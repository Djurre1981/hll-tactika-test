import { requireDb } from "./d1.js";

function parseJson(raw, fallback) {
  if (raw == null || raw === "") return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function normalizeBoardMode(mode) {
  return mode === "slideshow" ? "slideshow" : "whiteboard";
}

function rowToWhiteboard(row, { includeScene = true } = {}) {
  const board = {
    id: row.id,
    title: row.title,
    mode: normalizeBoardMode(row.mode),
    backgroundUrl: row.background_url || null,
    createdBy: row.created_by,
    createdByName: row.created_by_name || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (includeScene) {
    board.scene = parseJson(row.scene_json, {});
  }

  return board;
}

const FULL_COLUMNS =
  "id, title, mode, scene_json, background_url, created_by, created_by_name, created_at, updated_at";

const META_COLUMNS =
  "id, title, mode, background_url, created_by, created_by_name, created_at, updated_at";

export async function listWhiteboards(env, { meta = false } = {}) {
  const db = requireDb(env);
  const columns = meta ? META_COLUMNS : FULL_COLUMNS;
  const result = await db
    .prepare(`SELECT ${columns} FROM whiteboards ORDER BY updated_at DESC`)
    .all();
  return (result.results || []).map((row) =>
    rowToWhiteboard(row, { includeScene: !meta })
  );
}

export async function getWhiteboard(env, id) {
  const db = requireDb(env);
  const row = await db
    .prepare(`SELECT ${FULL_COLUMNS} FROM whiteboards WHERE id = ?`)
    .bind(id)
    .first();
  return row ? rowToWhiteboard(row, { includeScene: true }) : null;
}

export async function createWhiteboard(env, board) {
  return saveWhiteboard(env, board);
}

export async function saveWhiteboard(env, board) {
  const db = requireDb(env);
  const mode = normalizeBoardMode(board.mode);
  await db
    .prepare(
      `INSERT INTO whiteboards (
        id, title, mode, scene_json, background_url, created_by, created_by_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        mode = excluded.mode,
        scene_json = excluded.scene_json,
        background_url = excluded.background_url,
        updated_at = excluded.updated_at`
    )
    .bind(
      board.id,
      board.title,
      mode,
      JSON.stringify(board.scene || {}),
      board.backgroundUrl || null,
      board.createdBy,
      board.createdByName || null,
      board.createdAt,
      board.updatedAt
    )
    .run();
  return getWhiteboard(env, board.id);
}

export async function deleteWhiteboard(env, id) {
  const db = requireDb(env);
  await db.prepare("DELETE FROM whiteboards WHERE id = ?").bind(id).run();
}
