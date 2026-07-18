import { requireDb } from "./d1.js";

function parseJson(raw, fallback) {
  if (raw == null || raw === "") return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function rowToStrat(row, { includeSlides = true } = {}) {
  const slides = parseJson(row.slides, []);
  const strat = {
    id: row.id,
    title: row.title,
    tags: parseJson(row.tags, { team: "jr", type: "friendly" }),
    notes: row.notes || "",
    match: parseJson(row.match_json, {}),
    folderId: row.folder_id || null,
    locked: Boolean(row.locked),
    lockedBy: row.locked_by || null,
    createdBy: row.created_by,
    createdByName: row.created_by_name || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  const importSource = parseJson(row.import_source, null);
  if (importSource) {
    strat.importSource = importSource;
  }

  if (includeSlides) {
    strat.slides = Array.isArray(slides) ? slides : [];
  } else {
    strat.slideCount = Number(row.slide_count);
    if (!Number.isFinite(strat.slideCount)) {
      strat.slideCount = Array.isArray(slides) ? slides.length : 0;
    }
  }

  return strat;
}

function bindStratColumns(strat) {
  return [
    strat.id,
    strat.title,
    JSON.stringify(strat.tags || {}),
    strat.notes || "",
    JSON.stringify(strat.match || {}),
    strat.folderId || null,
    strat.locked ? 1 : 0,
    strat.lockedBy || null,
    JSON.stringify(strat.slides || []),
    strat.importSource ? JSON.stringify(strat.importSource) : null,
    strat.createdBy,
    strat.createdByName || null,
    strat.createdAt,
    strat.updatedAt,
  ];
}

const FULL_COLUMNS = `id, title, tags, notes, match_json, folder_id, locked, locked_by,
  slides, import_source, created_by, created_by_name, created_at, updated_at`;

const META_COLUMNS = `id, title, tags, notes, match_json, folder_id, locked, locked_by,
  import_source, created_by, created_by_name, created_at, updated_at,
  json_array_length(slides) AS slide_count`;

export async function listStrats(env, { folderId, meta = false } = {}) {
  const db = requireDb(env);
  const columns = meta ? META_COLUMNS : FULL_COLUMNS;
  let sql = `SELECT ${columns} FROM strats`;
  const binds = [];

  if (folderId === "none") {
    sql += " WHERE folder_id IS NULL";
  } else if (folderId) {
    sql += " WHERE folder_id = ?";
    binds.push(folderId);
  }

  sql += " ORDER BY updated_at DESC";

  const stmt = db.prepare(sql);
  const result = binds.length ? await stmt.bind(...binds).all() : await stmt.all();
  return (result.results || []).map((row) => rowToStrat(row, { includeSlides: !meta }));
}

export async function getStrat(env, stratId) {
  const db = requireDb(env);
  const row = await db
    .prepare(`SELECT ${FULL_COLUMNS} FROM strats WHERE id = ?`)
    .bind(stratId)
    .first();
  return row ? rowToStrat(row, { includeSlides: true }) : null;
}

export async function createStrat(env, strat) {
  const db = requireDb(env);
  await db
    .prepare(
      `INSERT INTO strats
       (id, title, tags, notes, match_json, folder_id, locked, locked_by,
        slides, import_source, created_by, created_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(...bindStratColumns(strat))
    .run();

  return getStrat(env, strat.id);
}

export async function saveStrat(env, strat) {
  const db = requireDb(env);
  await db
    .prepare(
      `UPDATE strats
       SET title = ?, tags = ?, notes = ?, match_json = ?, folder_id = ?,
           locked = ?, locked_by = ?, slides = ?, import_source = ?,
           created_by_name = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(
      strat.title,
      JSON.stringify(strat.tags || {}),
      strat.notes || "",
      JSON.stringify(strat.match || {}),
      strat.folderId || null,
      strat.locked ? 1 : 0,
      strat.lockedBy || null,
      JSON.stringify(strat.slides || []),
      strat.importSource ? JSON.stringify(strat.importSource) : null,
      strat.createdByName || null,
      strat.updatedAt,
      strat.id
    )
    .run();

  return getStrat(env, strat.id);
}

export async function deleteStrat(env, stratId) {
  const existing = await getStrat(env, stratId);
  if (!existing) return null;

  const db = requireDb(env);
  await db.prepare("DELETE FROM strats WHERE id = ?").bind(stratId).run();
  return existing;
}

export async function clearFolderFromStrats(env, folderId) {
  const db = requireDb(env);
  await db
    .prepare("UPDATE strats SET folder_id = NULL WHERE folder_id = ?")
    .bind(folderId)
    .run();
}

export async function countStrats(env) {
  const db = requireDb(env);
  const row = await db.prepare("SELECT COUNT(*) AS count FROM strats").first();
  return Number(row?.count) || 0;
}
